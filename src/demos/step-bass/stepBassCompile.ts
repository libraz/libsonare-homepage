/**
 * Compile the pattern a visitor edits into the engine-ready form that the live
 * worklet and the WAV export both apply. Pure and deterministic: the same
 * inputs give a structurally equal result every time.
 *
 * Two timebases describe the same instants. Clip events are in frames, because
 * MIDI is scheduled by render frame; lanes and the loop are in ppq, because the
 * transport rewinds those with it.
 *
 * Three measured engine behaviours shape the output. A lane holds a value only
 * when two breakpoints carry it, so every lane here is a step function written
 * as pairs. A lane is latched into a voice at note-on and read once per block,
 * so each value is in place a block before the step it serves. And an event
 * past the loop end never fires — the wrap releases whatever is sounding — so
 * the last step's slide is pitch alone.
 */

import {
  ACCENT_DECAY_MS,
  accentBrightnessCents,
  accentMemory,
  accentVelocity,
  resonanceQ,
  SLIDE_GLIDE_MS,
  SLIDE_LEAD_FRAMES,
  STEP_BASS_ARTICULATION,
  STEP_BASS_BASE_PATCH,
  STEP_BASS_TRACK_ID,
  STEP_COUNT,
  STEP_VELOCITY,
} from '@/demos/step-bass/stepBassPatch';
import type {
  CompiledClip,
  CompiledLane,
  CompiledLanePoint,
  CompiledMidiEvent,
  CompiledPattern,
  Knobs,
  Pattern,
  Step,
} from '@/demos/step-bass/stepBassTypes';
import { masterLimiterStripJson } from '@/utils/masterLimiter';
import { noteOffWord, noteOnWord } from '@/utils/ump';
import type { SynthPatch } from '@/wasm/index';

/** A step is a sixteenth, so the sequencer's bar is four quarters. */
export const STEP_PPQ = 0.25;
/** Loop length in ppq: the whole pattern, which the transport wraps. */
export const LOOP_PPQ = STEP_COUNT * STEP_PPQ;

/** The instrument plays one clip; the id only has to be stable. */
export const STEP_BASS_CLIP_ID = 1;

/** Passes the accent scan may take before its memory is declared settled. */
const ACCENT_CONVERGENCE_PASSES = 8;
/** A pass that moves the memory less than this has reached the steady state. */
const ACCENT_CONVERGENCE_EPSILON = 1e-9;

/** One held span of a lane, from `startPpq` until the next segment begins. */
interface LaneSegment {
  startPpq: number;
  value: number;
}

/** A clip event with its tie-break: at one frame, a release comes before a strike. */
interface OrderedEvent extends CompiledMidiEvent {
  rank: number;
}

/** An accent is a strike, so only a `note` step carries one. */
function isAccented(step: Step): boolean {
  return step.accent && step.gate === 'note';
}

/**
 * A slide means something only when the step sounds and the step it glides into
 * speaks a new note. Step 16 glides into step 1 across the wrap.
 */
function slidesInto(steps: Step[], index: number): boolean {
  const step = steps[index];
  if (!step.slide || step.gate === 'rest') return false;
  return steps[(index + 1) % STEP_COUNT].gate === 'note';
}

/**
 * Put segments in time order and leave only the ones that change something: a
 * segment another starts on top of never held anything, and one repeating the
 * value before it would write a pair the engine reads as the same hold.
 */
function normalizeSegments(segments: LaneSegment[]): LaneSegment[] {
  const sorted = [...segments].sort((a, b) => a.startPpq - b.startPpq);
  const kept: LaneSegment[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i + 1 < sorted.length && sorted[i + 1].startPpq === sorted[i].startPpq) continue;
    const previous = kept[kept.length - 1];
    if (previous && previous.value === sorted[i].value) continue;
    kept.push(sorted[i]);
  }
  return kept;
}

/** Write segments as breakpoint pairs, the only form the engine holds flat. */
function stepFunction(segments: LaneSegment[], gapPpq: number): CompiledLanePoint[] {
  const points: CompiledLanePoint[] = [];
  for (let i = 0; i < segments.length; i++) {
    const next = i + 1 < segments.length ? segments[i + 1].startPpq : LOOP_PPQ;
    points.push({ ppq: segments[i].startPpq, value: segments[i].value });
    points.push({ ppq: next - gapPpq, value: segments[i].value });
  }
  return points;
}

/**
 * The accent memory `s[i] = s[prev]·exp(-Δt/τ) + 1` seen at every accented step,
 * scanned until a whole lap stops changing it. The pattern loops, so the value
 * a lap starts with is the value the previous lap left: emitting the first lap
 * of a cold start would make lap 1 sound unlike every lap after it.
 *
 * @param passes Laps to scan. Only a test cuts this short, to show that the
 *   convergence is what keeps consecutive laps alike.
 */
export function accentMemories(
  steps: Step[],
  bpm: number,
  passes = ACCENT_CONVERGENCE_PASSES,
): number[] {
  const secondsPerPpq = 60 / bpm;
  const struck: number[] = [];
  for (let i = 0; i < STEP_COUNT; i++) {
    if (isAccented(steps[i])) struck.push(i);
  }
  let settled = new Array<number>(STEP_COUNT).fill(0);
  if (struck.length === 0) return settled;

  let memory = 0;
  // Seeded a lap back from the last accent, so the first gap is the wrap gap.
  let lastPpq = struck[struck.length - 1] * STEP_PPQ - LOOP_PPQ;
  for (let pass = 0; pass < passes; pass++) {
    const scan = new Array<number>(STEP_COUNT).fill(0);
    for (const index of struck) {
      const ppq = index * STEP_PPQ;
      memory = accentMemory(memory, (ppq - lastPpq) * secondsPerPpq);
      scan[index] = memory;
      lastPpq = ppq;
    }
    lastPpq -= LOOP_PPQ;
    let moved = 0;
    for (let i = 0; i < STEP_COUNT; i++) moved = Math.max(moved, Math.abs(scan[i] - settled[i]));
    settled = scan;
    if (moved <= ACCENT_CONVERGENCE_EPSILON) break;
  }
  return settled;
}

/** The base patch with the knob-backed fields written in. */
function compiledPatch(knobs: Knobs): SynthPatch {
  const q = resonanceQ(knobs.resonancePct);
  return {
    ...STEP_BASS_BASE_PATCH,
    waveform: knobs.waveform,
    cutoffHz: knobs.cutoffHz,
    resonanceQ: q,
    envToCutoffCents: knobs.envModCents,
    pitchOffsetCents: knobs.tuningCents,
    filterDecayMs: knobs.decayMs,
    // Whole-patch rather than a lane: the parameter is referenced to velocity
    // 127, so it sinks the plain steps instead of lifting the accented ones.
    velToCutoffCents: accentBrightnessCents(knobs.accent, q),
    // Routings replace the base set rather than merge, so the array travels as
    // a copy and no engine call can reach the shared constant.
    modRoutings: (STEP_BASS_BASE_PATCH.modRoutings ?? []).map((routing) => ({ ...routing })),
  };
}

/**
 * Compile a pattern and the panel's knob positions for one engine instance.
 *
 * @param pattern The 16 steps and the root they were built around.
 * @param knobs Panel positions, in panel units.
 * @param sampleRate Render rate; the export passes the live context's own rate.
 * @param bpm Transport tempo, which sets the frame mapping and nothing else.
 */
export function compile(
  pattern: Pattern,
  knobs: Knobs,
  sampleRate: number,
  bpm: number,
): CompiledPattern {
  const steps = pattern.steps;
  const framesPerPpq = (sampleRate * 60) / bpm;
  const lengthSamples = Math.round(framesPerPpq * LOOP_PPQ);
  const stepFrame = (index: number) => Math.round(framesPerPpq * index * STEP_PPQ);
  // A lane value has to be standing before the note-on that latches it; half a
  // step is the ceiling, so the lead never reorders two steps' values.
  const leadPpq = Math.min(SLIDE_LEAD_FRAMES / framesPerPpq, STEP_PPQ / 2);
  // A pair's closing point sits one frame short of the next value.
  const gapPpq = 1 / framesPerPpq;
  const transitionPpq = (index: number) => Math.max(0, index * STEP_PPQ - leadPpq);

  // ------------------------------------------------------------------ clip
  const memories = accentMemories(steps, bpm);
  const ordered: OrderedEvent[] = [];
  const velocityOf = (step: Step, at: number) =>
    isAccented(step) ? accentVelocity(knobs.accent, memories[at]) : STEP_VELOCITY;
  let index = 0;
  while (index < STEP_COUNT) {
    const head = steps[index];
    if (head.gate !== 'note') {
      index++;
      continue;
    }
    // A tie holds the note already sounding rather than speaking a new one.
    let tail = index;
    while (tail + 1 < STEP_COUNT && steps[tail + 1].gate === 'tie') tail++;
    const after = tail + 1;
    ordered.push({
      renderFrame: stepFrame(index),
      word0: noteOnWord(head.note, velocityOf(head, index)),
      rank: 1,
    });

    let offFrame: number;
    if (after >= STEP_COUNT) {
      // The wrap releases the voice on its own, and nothing past the loop end
      // fires, so the last step hands over through the glide lane alone.
      offFrame = lengthSamples - 1;
    } else if (slidesInto(steps, tail)) {
      // Held one frame past the next strike, so the slur has two notes to join.
      offFrame = stepFrame(after) + 1;
    } else {
      offFrame = stepFrame(after);
    }
    ordered.push({ renderFrame: offFrame, word0: noteOffWord(head.note), rank: 0 });
    index = after;
  }
  ordered.sort((a, b) => a.renderFrame - b.renderFrame || a.rank - b.rank);
  const events: CompiledMidiEvent[] = ordered.map(({ renderFrame, word0 }) => ({
    renderFrame,
    word0,
  }));

  const clip: CompiledClip = {
    id: STEP_BASS_CLIP_ID,
    trackId: STEP_BASS_TRACK_ID,
    destinationId: STEP_BASS_TRACK_ID,
    startSample: 0,
    startPpq: 0,
    lengthSamples,
    events,
  };

  // ------------------------------------------------------------------ lanes
  const glideSegments: LaneSegment[] = [{ startPpq: 0, value: 0 }];
  for (let i = 0; i < STEP_COUNT; i++) {
    if (!slidesInto(steps, i)) continue;
    const onPpq = ((i + 1) % STEP_COUNT) * STEP_PPQ;
    const from = Math.max(0, onPpq - leadPpq);
    const to = Math.min(LOOP_PPQ, onPpq + leadPpq);
    glideSegments.push({ startPpq: from, value: SLIDE_GLIDE_MS });
    if (to < LOOP_PPQ) glideSegments.push({ startPpq: to, value: 0 });
  }

  const decaySegments: LaneSegment[] = [];
  for (let i = 0; i < STEP_COUNT; i++) {
    const startPpq = transitionPpq(i);
    const accented = isAccented(steps[i]);
    decaySegments.push({ startPpq, value: accented ? ACCENT_DECAY_MS : knobs.decayMs });
  }

  const lanes: CompiledLane[] = [
    { param: 'glideMs', points: stepFunction(normalizeSegments(glideSegments), gapPpq) },
    { param: 'filterDecayMs', points: stepFunction(normalizeSegments(decaySegments), gapPpq) },
  ];

  return {
    sampleRate,
    bpm,
    patch: compiledPatch(knobs),
    articulation: STEP_BASS_ARTICULATION,
    clip,
    loop: { startPpq: 0, endPpq: LOOP_PPQ },
    lanes,
    knobs: {
      cutoffHz: knobs.cutoffHz,
      resonanceQ: resonanceQ(knobs.resonancePct),
      envToCutoffCents: knobs.envModCents,
      pitchOffsetCents: knobs.tuningCents,
      faderDb: knobs.faderDb,
    },
    masterStripJson: masterLimiterStripJson(knobs.faderDb),
  };
}
