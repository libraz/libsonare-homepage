<script setup lang="ts">
/**
 * `piano-roll` archetype: a multi-voice MIDI passage on the built-in instrument.
 *
 * A short three-voice phrase (melody / chords / bass) is sequenced as one MIDI
 * clip and bounced to PCM through a named NativeSynth preset. The notes are drawn
 * as a DAW-style piano roll — pitch up the vertical axis, time across the
 * horizontal — with a playhead locked to the audio clock. Switching the
 * instrument re-voices the *identical* MIDI through a different preset; dragging
 * the tempo restretches the whole sequence. Pressing play auditions the buffer
 * on screen, no clip or external asset.
 */
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useSonareDemoAudio } from '@/composables/useSonareDemoAudio';
import { type DemoLocale, localized, type SonareDemoDef } from '@/demos/types';
import DemoControls from '../DemoControls.vue';
import DemoFrame from '../DemoFrame.vue';
import { PHRASE_BEATS, PHRASE_BEATS_PER_BAR, PHRASE_VOICES } from './midiPhrase';

const props = defineProps<{ def: SonareDemoDef; active: boolean }>();

const { locale } = useI18n();
const { ensureWasm, play, playingId, progress } = useSonareDemoAudio();

const loc = computed<DemoLocale>(() => (locale.value.startsWith('ja') ? 'ja' : 'en'));
const title = computed(() => localized(props.def.title, loc.value));
const caption = computed(() => localized(props.def.caption, loc.value));

const canvas = ref<HTMLCanvasElement | null>(null);
const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle');
const errorMsg = ref('');
const isPlaying = computed(() => playingId.value === props.def.id);

// ---- reader-adjustable parameters -----------------------------------------
type ParamValue = number | string | boolean;
const values = reactive<Record<string, ParamValue>>({});
for (const p of props.def.params ?? []) values[p.key] = p.default;

function onParams(next: Record<string, ParamValue>): void {
  Object.assign(values, next);
}

const instrument = computed<string>(() => String(values.instrument ?? 'acoustic-piano'));
const tempo = computed<number>(() => Number(values.tempo ?? 100));

// ---- presentation state ----------------------------------------------------
const tone = computed(() => {
  if (status.value === 'error') return 'error' as const;
  if (status.value === 'loading') return 'loading' as const;
  if (isPlaying.value) return 'playing' as const;
  if (status.value === 'ready') return 'ready' as const;
  return 'idle' as const;
});
const stateLabel = computed(() => {
  if (status.value === 'loading') return 'RENDERING';
  if (status.value === 'error') return 'ERROR';
  if (isPlaying.value) return `▸ ${Math.round(progress.value * 100)}%`;
  if (status.value === 'ready') return `3 VOICES · ${tempo.value} BPM`;
  return 'IDLE';
});

// ---- the passage -----------------------------------------------------------
// A two-bar phrase in C major: I – vi – IV – V (one chord per half bar). Each
// voice carries its own color so the arrangement reads at a glance. Notes are
// authored in beats (quarter notes) — the same unit the Project MIDI API uses
// for `ppq`, see renderPassage — and the engine renders them at the reader's tempo.
const SR = 44100;
const BEATS = PHRASE_BEATS; // two 4/4 bars, in quarter notes
const BEATS_PER_BAR = PHRASE_BEATS_PER_BAR;
const GATE = 0.94; // note held for 94% of its slot, so it re-articulates cleanly
const TAIL_SEC = 1.2; // release tail captured past the last note-off

/** One note as `[startBeat, durationBeats, midi, velocity?]`. */
type Note = [number, number, number, number?];
interface Voice {
  hue: string;
  notes: Note[];
}

// Built from the shared phrase so the piano roll and the score render the exact
// same MIDI. Each voice's notes are contiguous, so the start beat is the running
// sum of the durations before it.
const VOICES: Voice[] = PHRASE_VOICES.map((voice) => {
  let beat = 0;
  const notes: Note[] = voice.notes.map(([midi, durBeat]) => {
    const note: Note = [beat, durBeat, midi, voice.velocity];
    beat += durBeat;
    return note;
  });
  return { hue: voice.hue, notes };
});

// Pitch window the roll spans, padded a little above and below the extremes.
const PITCH_PAD = 2;
const allMidi = VOICES.flatMap((v) => v.notes.map((n) => n[2]));
const MIN_PITCH = Math.min(...allMidi) - PITCH_PAD;
const MAX_PITCH = Math.max(...allMidi) + PITCH_PAD;
const PITCH_RANGE = MAX_PITCH - MIN_PITCH + 1;

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const isBlackKey = (midi: number): boolean => [1, 3, 6, 8, 10].includes(((midi % 12) + 12) % 12);
const octaveOf = (midi: number): number => Math.floor(midi / 12) - 1;

// ---- render ----------------------------------------------------------------
type WasmModule = Awaited<ReturnType<typeof ensureWasm>>;

interface ProjectMidiEvent {
  __brand?: 'midi';
}
interface ProjectLike {
  setSampleRate(sr: number): void;
  setTempoSegments(segments: Array<{ startPpq: number; bpm: number }>): void;
  addMidiClip(startPpq: number, lengthPpq: number): { trackId: number; clipId: number };
  setMidiEvents(clipId: number, events: ProjectMidiEvent[]): void;
  bounceWithSynthInstrument(
    instrument: string | Record<string, unknown>,
    options: { numChannels: number; sampleRate: number; totalFrames: number },
  ): Float32Array;
  delete(): void;
}
interface ProjectCtor {
  new (): ProjectLike;
  midiNoteOn(
    ppq: number,
    group: number,
    channel: number,
    note: number,
    velocity: number,
  ): ProjectMidiEvent;
  midiNoteOff(
    ppq: number,
    group: number,
    channel: number,
    note: number,
    velocity?: number,
  ): ProjectMidiEvent;
}

let lastAudio: { samples: Float32Array; sampleRate: number } | null = null;
/** Audio buffer duration in seconds (phrase + release tail) for playhead mapping. */
let audioDur = 0;

/**
 * Sequence the passage and bounce it through the chosen preset to mono PCM.
 *
 * The Project MIDI API measures position in QUARTER NOTES, not ticks — `ppq: 1`
 * is one quarter note, so a beat maps to its index directly (no PPQ multiply).
 * Each note is gated slightly short so repeats re-articulate, and the rendered
 * buffer is peak-normalized so every preset auditions at a comparable level.
 */
function renderPassage(wasm: WasmModule): Float32Array {
  const Project = (wasm as unknown as { Project: ProjectCtor }).Project;
  const project = new Project();
  try {
    project.setSampleRate(SR);
    project.setTempoSegments([{ startPpq: 0, bpm: tempo.value }]);
    const { clipId } = project.addMidiClip(0, BEATS);

    // Tag each event with its beat so the stream can be ordered before handing it
    // to the clip. At a shared position, note-offs (key 0) sort before note-ons
    // (key 1) so a re-struck pitch is released before it is hit again.
    const tagged: Array<{ at: number; key: number; ev: ProjectMidiEvent }> = [];
    for (const voice of VOICES) {
      for (const [startBeat, durBeat, midi, vel = 90] of voice.notes) {
        const offBeat = startBeat + durBeat * GATE;
        tagged.push({ at: startBeat, key: 1, ev: Project.midiNoteOn(startBeat, 0, 0, midi, vel) });
        tagged.push({ at: offBeat, key: 0, ev: Project.midiNoteOff(offBeat, 0, 0, midi, 0) });
      }
    }
    tagged.sort((a, b) => a.at - b.at || a.key - b.key);
    project.setMidiEvents(
      clipId,
      tagged.map((t) => t.ev),
    );

    const phraseSec = (BEATS * 60) / tempo.value;
    const totalFrames = Math.round(SR * (phraseSec + TAIL_SEC));
    audioDur = totalFrames / SR;
    const pcm = project.bounceWithSynthInstrument(instrument.value, {
      numChannels: 1,
      sampleRate: SR,
      totalFrames,
    });

    // Presets span a wide level range (a struck piano is far hotter than a
    // plucked harp); normalize to a fixed headroom so the audition level — and
    // the on-screen note opacity — stay consistent across instruments.
    let peak = 1e-6;
    for (let i = 0; i < pcm.length; i++) peak = Math.max(peak, Math.abs(pcm[i]));
    const gain = 0.85 / peak;
    for (let i = 0; i < pcm.length; i++) pcm[i] *= gain;
    return pcm;
  } finally {
    project.delete();
  }
}

let disposed = false;

async function compute(): Promise<void> {
  if (disposed) return;
  try {
    if (status.value === 'idle') status.value = 'loading';
    const wasm = await ensureWasm();
    if (disposed) return;
    const pcm = renderPassage(wasm);
    lastAudio = { samples: pcm, sampleRate: SR };
    status.value = 'ready';
    startReveal();
  } catch (e) {
    if (disposed) return;
    status.value = 'error';
    errorMsg.value = e instanceof Error ? e.message : String(e);
  }
}

// ---- paint loop ------------------------------------------------------------
const reducedMotion =
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

let rafId = 0;
const REVEAL_MS = 520;
let reveal = 0; // 0..1 left-to-right wipe as the roll draws in
let revealing = false;
let revealT0 = -1;

function startReveal(): void {
  reveal = reducedMotion ? 1 : 0;
  revealing = !reducedMotion;
  revealT0 = -1;
  ensureLoop();
}

function ensureLoop(): void {
  if (!rafId) rafId = requestAnimationFrame(loop);
}

function loop(now: number): void {
  if (revealing) {
    if (revealT0 < 0) revealT0 = now;
    reveal = Math.min(1, (now - revealT0) / REVEAL_MS);
    if (reveal >= 1) revealing = false;
  }
  paint();
  rafId = revealing || isPlaying.value ? requestAnimationFrame(loop) : 0;
}

function stopLoop(): void {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
}

const PAD_X = 12;
const PAD_TOP = 12;
const PAD_BOT = 10;

/** Draw the piano roll: lanes, bar grid, notes, octave labels, playhead. */
function paint(): void {
  const el = canvas.value;
  if (!el) return;
  const w = el.clientWidth;
  const h = el.clientHeight;
  if (w === 0 || h === 0) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (el.width !== Math.round(w * dpr) || el.height !== Math.round(h * dpr)) {
    el.width = Math.round(w * dpr);
    el.height = Math.round(h * dpr);
  }
  const ctx = el.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const innerW = w - PAD_X * 2;
  const innerH = h - PAD_TOP - PAD_BOT;
  const laneH = innerH / PITCH_RANGE;
  const xOf = (beat: number): number => PAD_X + (beat / BEATS) * innerW;
  const yOf = (midi: number): number => PAD_TOP + (MAX_PITCH - midi) * laneH;

  // Background semitone lanes — black keys sit a shade darker.
  for (let midi = MIN_PITCH; midi <= MAX_PITCH; midi++) {
    const y = yOf(midi);
    ctx.fillStyle = isBlackKey(midi) ? 'rgba(0, 0, 0, 0.22)' : 'rgba(45, 212, 191, 0.02)';
    ctx.fillRect(PAD_X, y, innerW, laneH);
    if (midi % 12 === 0) {
      // Octave boundary line, a touch brighter.
      ctx.strokeStyle = 'rgba(186, 230, 224, 0.14)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD_X, y + laneH);
      ctx.lineTo(PAD_X + innerW, y + laneH);
      ctx.stroke();
    }
  }

  // Bar / beat grid.
  for (let beat = 0; beat <= BEATS; beat++) {
    const x = xOf(beat);
    const onBar = beat % BEATS_PER_BAR === 0;
    ctx.strokeStyle = onBar ? 'rgba(186, 230, 224, 0.22)' : 'rgba(186, 230, 224, 0.08)';
    ctx.lineWidth = onBar ? 1 : 0.5;
    ctx.beginPath();
    ctx.moveTo(x, PAD_TOP);
    ctx.lineTo(x, PAD_TOP + innerH);
    ctx.stroke();
  }

  // Notes, clipped to the reveal wipe so the roll "draws in" left to right.
  const revealX = PAD_X + reveal * innerW;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, revealX, h);
  ctx.clip();
  const radius = Math.min(3, laneH * 0.4);
  for (const voice of VOICES) {
    for (const [startBeat, durBeat, midi, vel = 90] of voice.notes) {
      const x = xOf(startBeat);
      const y = yOf(midi) + 0.5;
      const noteW = Math.max(2, xOf(startBeat + durBeat) - x - 1);
      const noteH = Math.max(2, laneH - 1.5);
      const alpha = 0.55 + (vel / 127) * 0.42;
      ctx.fillStyle = `rgba(${voice.hue}, ${alpha})`;
      ctx.shadowColor = `rgba(${voice.hue}, 0.5)`;
      ctx.shadowBlur = 5;
      ctx.beginPath();
      if (noteW > radius * 2 && noteH > radius * 2) ctx.roundRect(x, y, noteW, noteH, radius);
      else ctx.rect(x, y, noteW, noteH);
      ctx.fill();
    }
  }
  ctx.shadowBlur = 0;
  ctx.restore();

  // Leading edge of the reveal wipe.
  if (reveal < 1) {
    ctx.strokeStyle = 'rgba(45, 212, 191, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(revealX, PAD_TOP);
    ctx.lineTo(revealX, PAD_TOP + innerH);
    ctx.stroke();
  }

  // Octave labels (C of each octave) floated at the left edge.
  ctx.font = '9px "JetBrains Mono", ui-monospace, monospace';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(186, 230, 224, 0.5)';
  for (let midi = MIN_PITCH; midi <= MAX_PITCH; midi++) {
    if (midi % 12 !== 0) continue;
    ctx.fillText(`${NOTE_NAMES[0]}${octaveOf(midi)}`, PAD_X + 3, yOf(midi) + laneH / 2);
  }

  // Playhead — locked to the audio clock. The phrase fills the note area, so the
  // marker maps the phrase span (audio minus the release tail) onto the width and
  // then parks at the right edge while the last chord rings out.
  if (isPlaying.value && progress.value > 0) {
    const phraseSec = (BEATS * 60) / tempo.value;
    const ratio = phraseSec > 0 ? audioDur / phraseSec : 1;
    const frac = Math.min(1, progress.value * ratio);
    const px = PAD_X + frac * innerW;
    ctx.strokeStyle = '#2dd4bf';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#2dd4bf';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, h);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
}

// ---- audition --------------------------------------------------------------
async function onPlay(): Promise<void> {
  if (!lastAudio) await compute();
  if (lastAudio) await play(props.def.id, lastAudio);
}

// Coalesce rapid changes (slider drags) into one render per frame.
let pending = 0;
function scheduleCompute(): void {
  if (pending) return;
  pending = requestAnimationFrame(() => {
    pending = 0;
    compute();
  });
}

watch(
  () => [instrument.value, tempo.value],
  () => {
    if (props.active) scheduleCompute();
  },
);

watch(isPlaying, (on) => {
  if (on) ensureLoop();
  // When playback stops, repaint once so the parked playhead clears.
  else
    requestAnimationFrame(() => {
      if (!rafId) paint();
    });
});

watch(
  () => props.active,
  (on) => {
    if (on && status.value === 'idle') compute();
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  disposed = true;
  stopLoop();
  if (pending) cancelAnimationFrame(pending);
});
</script>

<template>
  <DemoFrame
    eyebrow="MIDI · PIANO ROLL"
    :title="title"
    :caption="caption"
    :state="stateLabel"
    :tone="tone"
    :playing="isPlaying"
    :progress="progress"
    :disabled="status === 'loading'"
    :error="status === 'error' ? errorMsg : null"
    loading-label="RENDERING…"
    :show-playhead="false"
    @toggle="onPlay"
  >
    <template #screen>
      <canvas ref="canvas" class="pr-canvas" />
    </template>
    <template #controls>
      <DemoControls
        :model-value="values"
        :params="def.params ?? []"
        :locale="loc"
        :disabled="status === 'loading'"
        @update:model-value="onParams"
      />
    </template>
  </DemoFrame>
</template>

<style scoped>
.pr-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
</style>
