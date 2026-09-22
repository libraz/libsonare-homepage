/**
 * WAV and MIDI export for the step bass instrument. The WAV path boots a
 * `RealtimeEngine` through the same main-thread facade `@/wasm/index.js`
 * exposes, applies the identical `CompiledPattern` the live worklet renders
 * (D1), and hand-turns `processPrepared` over it — so a download is the
 * signal path a visitor heard, not an offline approximation, at the live
 * context's own sample rate. `applyCompiled` leaves the transport alone;
 * starting it here is what turns "applied" into "playing".
 *
 * MIDI export reads the pattern directly rather than the compiled clip: a
 * file is notation, so accent velocity is fixed rather than following the
 * ACCENT knob, and a slide is written as the outgoing note's release sitting
 * past the incoming note's onset.
 */

import { applyCompiled } from '@/demos/step-bass/stepBassApply';
import { LOOP_PPQ, STEP_PPQ } from '@/demos/step-bass/stepBassCompile';
import {
  ACCENT_MEMORY_CAP,
  accentVelocity,
  RENDER_NOW,
  STEP_BASS_CHANNEL,
  STEP_COUNT,
  STEP_VELOCITY,
} from '@/demos/step-bass/stepBassPatch';
import type {
  CompiledPattern,
  Pattern,
  Step,
  StepBassEngine,
} from '@/demos/step-bass/stepBassTypes';
import { wavBlob } from '@/utils/audio';
import { buildSmf, noteEvents, type SmfEvent } from '@/utils/gsSysex';

/** AudioWorklet render quantum; matches what `applyCompiled` prepares the engine for. */
const BLOCK = 128;

/** The main-thread `RealtimeEngine` export, as `studioBounce` also boots it. */
export type StepBassWasmModule = typeof import('@/wasm/index.js');

/** Loops the WAV export renders when the caller doesn't ask for a specific length. */
export const DEFAULT_EXPORT_LOOPS = 1;

/**
 * Hand-turn a freshly booted engine over `loops` passes of `compiled`,
 * collecting stereo output. Owns the engine's lifetime start to finish, so a
 * caller never has to release a native object itself.
 */
export function renderStepBassChannels(
  mod: StepBassWasmModule,
  compiled: CompiledPattern,
  loops: number,
): [Float32Array, Float32Array] {
  const engine = new mod.RealtimeEngine(compiled.sampleRate, BLOCK, 1024, 1024);
  try {
    applyCompiled(engine as unknown as StepBassEngine, compiled, 'facade');
    engine.play(RENDER_NOW);

    const totalFrames = compiled.clip.lengthSamples * loops;
    const left = new Float32Array(totalFrames);
    const right = new Float32Array(totalFrames);
    let done = 0;
    while (done < totalFrames) {
      const n = Math.min(BLOCK, totalFrames - done);
      const l = engine.getChannelBuffer(0, BLOCK);
      const r = engine.getChannelBuffer(1, BLOCK);
      l.fill(0, 0, n);
      r.fill(0, 0, n);
      engine.processPrepared(n);
      left.set(l.subarray(0, n), done);
      right.set(r.subarray(0, n), done);
      done += n;
    }
    return [left, right];
  } finally {
    engine.destroy();
  }
}

/**
 * Render `compiled` and encode it as a 16-bit PCM WAV at the sample rate it
 * was built for — the live context's own rate, so the file is what the
 * visitor heard rather than a resampled approximation of it.
 */
export function exportStepBassWav(
  mod: StepBassWasmModule,
  compiled: CompiledPattern,
  loops: number = DEFAULT_EXPORT_LOOPS,
): Blob {
  const channels = renderStepBassChannels(mod, compiled, loops);
  return wavBlob(channels, compiled.sampleRate);
}

// -------------------------------------------------------------------- MIDI

/** Full-accent velocity: a file is notation, not a capture of the current ACCENT knob. */
const ACCENT_MIDI_VELOCITY = accentVelocity(1, ACCENT_MEMORY_CAP);

/** How far a slide's outgoing note release sits past the incoming note-on, so it reads as an overlap. */
const SLIDE_OVERLAP_BEATS = STEP_PPQ / 8;

function isAccentedNote(step: Step): boolean {
  return step.accent && step.gate === 'note';
}

/** A slide means something only when the next step speaks a new note. */
function slidesIntoNext(steps: Step[], index: number): boolean {
  const step = steps[index];
  if (!step.slide || step.gate === 'rest') return false;
  const next = index + 1;
  return next < STEP_COUNT && steps[next].gate === 'note';
}

/**
 * Encode the pattern as a one-track SMF. A tie extends the note it follows; a
 * slide's release overlaps the next note's onset instead of meeting it at the
 * boundary. Step 16's slide has no next note inside the file to overlap with
 * (D18), so it closes at the file's end like any other unslid note.
 */
export function stepBassSmfBytes(pattern: Pattern): Uint8Array {
  const steps = pattern.steps;
  const events: SmfEvent[] = [];
  let index = 0;
  while (index < STEP_COUNT) {
    const head = steps[index];
    if (head.gate !== 'note') {
      index++;
      continue;
    }
    let tail = index;
    while (tail + 1 < STEP_COUNT && steps[tail + 1].gate === 'tie') tail++;
    const after = tail + 1;

    const onBeat = index * STEP_PPQ;
    const velocity = isAccentedNote(head) ? ACCENT_MIDI_VELOCITY : STEP_VELOCITY;
    const offBeat =
      after < STEP_COUNT && slidesIntoNext(steps, tail)
        ? after * STEP_PPQ + SLIDE_OVERLAP_BEATS
        : Math.min(after, STEP_COUNT) * STEP_PPQ;
    events.push(...noteEvents(STEP_BASS_CHANNEL, head.note, velocity, onBeat, offBeat));
    index = after;
  }
  return buildSmf(events, LOOP_PPQ);
}

/** Wrap the pattern's SMF bytes as a downloadable file. */
export function exportStepBassSmf(pattern: Pattern): Blob {
  // Copied into a plain-ArrayBuffer view: the builder's is `ArrayBufferLike`,
  // which a Blob part will not accept.
  return new Blob([new Uint8Array(stepBassSmfBytes(pattern))], { type: 'audio/midi' });
}
