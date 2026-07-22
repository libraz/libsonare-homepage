<script setup lang="ts">
/**
 * `pitch-correct` archetype: retune a deliberately off-pitch vocal to a scale.
 *
 * A short C-major melody is sequenced as MIDI and each note is pushed off the grid
 * with a per-note pitch bend before its note-on, so the raw bounce (the sung
 * "vocal" engine) is expressive but out of tune. `pitchPyin` measures the per-frame
 * pitch and `pitchCorrectTimevarying` snaps it toward the chosen scale. The figure
 * plots both measured contours in semitones over faint scale-degree gridlines, so
 * the corrected line visibly settles onto the grid the raw line wanders around.
 * Retune strength trades a natural nudge for a hard robotic snap, retune speed sets
 * the glide, and Compare auditions the raw take against the tuned one.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useSonareDemoAudio } from '@/composables/useSonareDemoAudio';
import type { SonareDemoDef } from '@/demos/types';
import { prepareCanvas2D } from '../canvas';
import { useDemoChrome, useDemoParams } from '../composables';
import DemoControls from '../DemoControls.vue';
import DemoFrame from '../DemoFrame.vue';

const props = defineProps<{ def: SonareDemoDef; active: boolean }>();

const { ensureWasm, play, stop, playingId, progress } = useSonareDemoAudio();

const canvas = ref<HTMLCanvasElement | null>(null);
const isPlaying = computed(() => playingId.value === props.def.id);
const {
  locale: loc,
  title,
  caption,
  status,
  errorMsg,
  tone,
  fail,
} = useDemoChrome(props.def, isPlaying);

// ---- reader-adjustable parameters ------------------------------------------
const { values, updateParams } = useDemoParams(props.def);

const retuneAmount = computed<number>(() => Number(values.retuneAmount ?? 1));
const retuneSpeedMs = computed<number>(() => Number(values.retuneSpeedMs ?? 15));
const scale = computed<string>(() => String(values.scale ?? 'major'));
const view = computed<string>(() => String(values.view ?? 'tuned'));
const tuned = computed(() => view.value === 'tuned');

// ---- the passage -----------------------------------------------------------
// A one-note-per-beat C-major line, sung by the built-in vocal engine at 100 BPM.
// The line only uses in-scale tones, so a correct C-major retune restores the
// intended melody; the per-note detune below is what makes the raw take wrong.
const SR = 32_000;
const HOP = 256;
const BPM = 100;
const GATE = 0.9; // note held for 90% of its beat so repeats re-articulate
const TAIL_SEC = 0.4; // release tail captured past the last note-off
const MELODY = [60, 62, 64, 65, 67, 65, 64, 62, 64, 65, 67, 69, 67, 65, 64, 60];
// Deterministic per-note detune in semitones (±, off the equal-tempered grid).
const DETUNE = [
  0.4, -0.3, 0.6, -0.5, 0.35, -0.6, 0.5, -0.25, 0.45, -0.4, 0.55, -0.5, 0.3, -0.45, 0.5, -0.35,
];
const BEND_CENTER = 8192; // pitch-bend neutral
const BEND_PER_SEMITONE = 4096; // ±2-semitone range over the 14-bit span
const SCALE_ROOT = 0; // C
const SCALE_MASKS: Record<string, number> = {
  // 12-bit degree masks (bit i = semitone i above the root is in the scale).
  major: 0xab5, // C D E F G A B
  minor: 0x5ad, // C D Eb F G Ab Bb (natural minor)
};

/** Semitones above the root that the current scale allows (for the gridlines). */
const scaleDegrees = computed<number[]>(() => {
  const mask = SCALE_MASKS[scale.value] ?? SCALE_MASKS.major;
  const out: number[] = [];
  for (let i = 0; i < 12; i++) if (mask & (1 << i)) out.push(i);
  return out;
});

// ---- presentation state ----------------------------------------------------
const rawCents = ref(0); // raw mean distance from the nearest scale tone, cents
const tunedCents = ref(0); // corrected mean distance, cents
const stateLabel = computed(() => {
  if (status.value === 'loading') return 'RETUNING';
  if (status.value === 'error') return 'ERROR';
  if (isPlaying.value) return `▸ ${Math.round(progress.value * 100)}%`;
  if (status.value === 'ready') return tuned.value ? 'TUNED' : 'RAW';
  return 'IDLE';
});

// ---- render + analysis -----------------------------------------------------
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
  midiPitchBend(ppq: number, group: number, channel: number, bend: number): ProjectMidiEvent;
}

/** A measured pitch contour: MIDI note per hop, a voiced flag per hop, and the
 * raw pYIN f0 (Hz) it was derived from, kept so correction can reuse it. */
interface Contour {
  midi: Float32Array;
  voiced: Uint8Array;
  f0: Float32Array;
}

let rawAudio: { samples: Float32Array; sampleRate: number } | null = null;
let tunedAudio: { samples: Float32Array; sampleRate: number } | null = null;
let rawF0: Float32Array | null = null; // measured Hz per hop, reused for correction
let voicedInt: Int32Array | null = null; // per-hop voiced flags for correction
let rawContour: Contour | null = null;
let tunedContour: Contour | null = null;
/** Audio buffer duration in seconds (phrase + release tail) for playhead mapping. */
let audioDur = 0;

/** Peak-normalize a buffer in place to a fixed headroom. */
function peakNormalize(pcm: Float32Array, target = 0.85): void {
  let peak = 1e-9;
  // A spread over the whole buffer overflows the call stack, so scan in a loop.
  for (let i = 0; i < pcm.length; i++) {
    const a = Math.abs(pcm[i]);
    if (a > peak) peak = a;
  }
  const gain = target / peak;
  for (let i = 0; i < pcm.length; i++) pcm[i] *= gain;
}

/**
 * Sequence the off-pitch melody and bounce it through the sung vocal engine.
 *
 * The Project MIDI API measures position in QUARTER NOTES, not ticks, so beat i
 * maps to `ppq: i` directly. Each note is bent off the grid before its note-on so
 * the raw take is expressive but out of tune; the vocal engine is quiet, so the
 * bounce is peak-normalized before analysis.
 */
function renderRaw(wasm: WasmModule): Float32Array {
  const Project = (wasm as unknown as { Project: ProjectCtor }).Project;
  const project = new Project();
  try {
    project.setSampleRate(SR);
    project.setTempoSegments([{ startPpq: 0, bpm: BPM }]);
    const beats = MELODY.length;
    const { clipId } = project.addMidiClip(0, beats);

    // Tag each event with its beat and a sort key so the stream is ordered before
    // it reaches the clip: bend (0) lands before note-on (1) at the same beat, and
    // note-off (2) trails so a re-struck pitch is released before it is hit again.
    const tagged: Array<{ at: number; key: number; ev: ProjectMidiEvent }> = [];
    for (let i = 0; i < MELODY.length; i++) {
      const midi = MELODY[i];
      const bend = BEND_CENTER + Math.round(DETUNE[i] * BEND_PER_SEMITONE);
      const offBeat = i + GATE;
      tagged.push({ at: i, key: 0, ev: Project.midiPitchBend(i, 0, 0, bend) });
      tagged.push({ at: i, key: 1, ev: Project.midiNoteOn(i, 0, 0, midi, 96) });
      tagged.push({ at: offBeat, key: 2, ev: Project.midiNoteOff(offBeat, 0, 0, midi, 0) });
    }
    tagged.sort((a, b) => a.at - b.at || a.key - b.key);
    project.setMidiEvents(
      clipId,
      tagged.map((t) => t.ev),
    );

    const phraseSec = (beats * 60) / BPM;
    const totalFrames = Math.round(SR * (phraseSec + TAIL_SEC));
    audioDur = totalFrames / SR;
    const pcm = project.bounceWithSynthInstrument(
      { engineMode: 'vocal', gain: 1, polyphony: 1, ampAttackMs: 8, ampReleaseMs: 120 },
      { numChannels: 1, sampleRate: SR, totalFrames },
    );
    peakNormalize(pcm);
    return pcm;
  } finally {
    project.delete();
  }
}

/**
 * Measure a pitch contour with pYIN and convert per-hop Hz to MIDI note numbers.
 * The f0 track is copied out of the WASM result so callers can retain and reuse it
 * (e.g. feed it straight into correction) without measuring the same take twice.
 */
function measureContour(wasm: WasmModule, samples: Float32Array): Contour {
  const pr = wasm.pitchPyin(samples, SR, 2048, HOP, 65, 1000, 0.1, true);
  const n = pr.f0.length;
  const midi = new Float32Array(n);
  const voiced = new Uint8Array(n);
  const f0 = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const hz = pr.f0[i];
    f0[i] = hz;
    voiced[i] = pr.voicedFlag[i] && hz > 0 ? 1 : 0;
    midi[i] = hz > 0 ? 69 + 12 * Math.log2(hz / 440) : Number.NaN;
  }
  return { midi, voiced, f0 };
}

/** Mean absolute distance from the nearest allowed scale tone, in cents. */
function meanCentsOffScale(contour: Contour, degrees: number[]): number {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < contour.midi.length; i++) {
    if (!contour.voiced[i]) continue;
    const m = contour.midi[i];
    if (!Number.isFinite(m)) continue;
    let best = Number.POSITIVE_INFINITY;
    // Search a couple of octaves around the note for the nearest scale tone.
    const base = Math.round((m - SCALE_ROOT) / 12) * 12 + SCALE_ROOT;
    for (let oct = -1; oct <= 1; oct++) {
      for (const d of degrees) {
        const cents = Math.abs((m - (base + oct * 12 + d)) * 100);
        if (cents < best) best = cents;
      }
    }
    sum += best;
    n++;
  }
  return n > 0 ? sum / n : 0;
}

let disposed = false;

/** Bounce + analyze the raw take once; cache it across param changes. */
function ensureRaw(wasm: WasmModule): void {
  if (rawAudio) return;
  const pcm = renderRaw(wasm);
  rawAudio = { samples: pcm, sampleRate: SR };
  // One pYIN pass measures the contour; correction reuses its f0 track directly.
  rawContour = measureContour(wasm, pcm);
  const voiced = new Int32Array(rawContour.voiced.length);
  for (let i = 0; i < voiced.length; i++) voiced[i] = rawContour.voiced[i];
  rawF0 = rawContour.f0;
  voicedInt = voiced;
}

async function compute(): Promise<void> {
  if (disposed) return;
  try {
    if (status.value === 'idle') status.value = 'loading';
    const wasm = await ensureWasm();
    if (disposed) return;
    ensureRaw(wasm);
    if (!rawAudio || !rawF0 || !voicedInt || !rawContour) return;

    const mask = SCALE_MASKS[scale.value] ?? SCALE_MASKS.major;
    const out = wasm.pitchCorrectTimevarying(rawAudio.samples, rawF0, SR, HOP, {
      mode: 'scale',
      scaleRoot: SCALE_ROOT,
      scaleModeMask: mask,
      retuneAmount: retuneAmount.value,
      retuneSpeedMs: retuneSpeedMs.value,
      vibratoThresholdCents: 10,
      voiced: voicedInt,
    });
    peakNormalize(out);
    tunedAudio = { samples: out, sampleRate: SR };
    tunedContour = measureContour(wasm, out);

    rawCents.value = meanCentsOffScale(rawContour, scaleDegrees.value);
    tunedCents.value = meanCentsOffScale(tunedContour, scaleDegrees.value);

    status.value = 'ready';
    startReveal();
  } catch (e) {
    if (disposed) return;
    fail(e);
  }
}

// ---- paint loop ------------------------------------------------------------
const reducedMotion =
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

let rafId = 0;
const REVEAL_MS = 520;
let reveal = 0; // 0..1 left-to-right wipe as the contours draw in
let revealing = false;
let revealT0 = -1;
let dispEmph = 0; // 0 = raw emphasized, 1 = tuned emphasized (eased)

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
  const target = tuned.value ? 1 : 0;
  dispEmph += (target - dispEmph) * 0.22;
  const settling = Math.abs(target - dispEmph) > 0.002;
  if (!settling) dispEmph = target;
  paint();
  rafId = revealing || settling || isPlaying.value ? requestAnimationFrame(loop) : 0;
}

function stopLoop(): void {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
}

const PAD_X = 30; // leaves room for the note labels on the left edge
const PAD_TOP = 14;
const PAD_BOT = 22;
const RAW_COL = '#fb923c'; // amber = the out-of-tune take
const TUNED_COL = '#2dd4bf'; // teal = the correction
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** Semitone window the contours span, padded above and below the extremes. */
function pitchWindow(): { lo: number; hi: number } {
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (const c of [rawContour, tunedContour]) {
    if (!c) continue;
    for (let i = 0; i < c.midi.length; i++) {
      if (!c.voiced[i]) continue;
      const m = c.midi[i];
      if (!Number.isFinite(m)) continue;
      if (m < lo) lo = m;
      if (m > hi) hi = m;
    }
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return { lo: 55, hi: 72 };
  return { lo: Math.floor(lo) - 1.5, hi: Math.ceil(hi) + 1.5 };
}

/** Draw the pitch contours over the scale-degree grid. */
function paint(): void {
  const frame = prepareCanvas2D(canvas.value);
  if (!frame) return;
  const { ctx, width: w, height: h } = frame;

  const innerW = w - PAD_X - 10;
  const innerH = h - PAD_TOP - PAD_BOT;
  const { lo, hi } = pitchWindow();
  const span = Math.max(1, hi - lo);
  const xOf = (frac: number): number => PAD_X + frac * innerW;
  const yOf = (midi: number): number => PAD_TOP + ((hi - midi) / span) * innerH;

  const degrees = new Set(scaleDegrees.value);
  // Scale-degree gridlines: every semitone whose pitch class is in the scale gets
  // a faint line; the tonic C sits a shade brighter and carries a note label.
  for (let midi = Math.ceil(lo); midi <= Math.floor(hi); midi++) {
    const pc = (((midi - SCALE_ROOT) % 12) + 12) % 12;
    if (!degrees.has(pc)) continue;
    const isRoot = pc === 0;
    const y = yOf(midi);
    ctx.strokeStyle = isRoot ? 'rgba(186, 230, 224, 0.2)' : 'rgba(148, 163, 184, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD_X, y);
    ctx.lineTo(PAD_X + innerW, y);
    ctx.stroke();
    ctx.font = '9px "JetBrains Mono", ui-monospace, monospace';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    ctx.fillStyle = isRoot ? 'rgba(186, 230, 224, 0.65)' : 'rgba(148, 163, 184, 0.4)';
    ctx.fillText(
      `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`,
      PAD_X - 4,
      y,
    );
  }

  // The contours are clipped to the reveal wipe so they "draw in" left to right.
  const revealX = PAD_X + reveal * innerW;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, revealX, h);
  ctx.clip();

  const drawContour = (c: Contour | null, color: string, strong: boolean): void => {
    if (!c) return;
    ctx.strokeStyle = strong ? color : hexA(color, 0.35);
    ctx.lineWidth = strong ? 2 : 1.1;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    let pen = false;
    for (let i = 0; i < c.midi.length; i++) {
      if (!c.voiced[i] || !Number.isFinite(c.midi[i])) {
        pen = false;
        continue;
      }
      const x = xOf(c.midi.length > 1 ? i / (c.midi.length - 1) : 0);
      const y = yOf(c.midi[i]);
      if (pen) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
      pen = true;
    }
    ctx.stroke();
  };

  // Draw the de-emphasized contour first, the auditioned one on top.
  if (dispEmph > 0.5) {
    drawContour(rawContour, RAW_COL, false);
    drawContour(tunedContour, TUNED_COL, true);
  } else {
    drawContour(tunedContour, TUNED_COL, false);
    drawContour(rawContour, RAW_COL, true);
  }
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

  // OFF readout: mean cents off-scale, raw vs tuned.
  ctx.font = '9px "JetBrains Mono", ui-monospace, monospace';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(45, 212, 191, 0.95)';
  ctx.fillText(
    `OFF ${rawCents.value.toFixed(0)} → ${tunedCents.value.toFixed(0)} cents`,
    PAD_X + innerW,
    PAD_TOP - 2,
  );

  // Legend.
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = hexA(RAW_COL, dispEmph > 0.5 ? 0.5 : 0.95);
  ctx.fillRect(PAD_X, PAD_TOP - 1, 9, 3);
  ctx.fillText('Raw', PAD_X + 13, PAD_TOP - 2);
  ctx.fillStyle = hexA(TUNED_COL, dispEmph > 0.5 ? 0.95 : 0.5);
  ctx.fillRect(PAD_X + 44, PAD_TOP - 1, 9, 3);
  ctx.fillText('Tuned', PAD_X + 57, PAD_TOP - 2);

  // Playhead — locked to the audio clock, mapping the phrase span onto the width.
  if (isPlaying.value && progress.value > 0) {
    const phraseSec = (MELODY.length * 60) / BPM;
    const ratio = phraseSec > 0 ? audioDur / phraseSec : 1;
    const frac = Math.min(1, progress.value * ratio);
    const px = xOf(frac);
    ctx.strokeStyle = dispEmph > 0.5 ? TUNED_COL : RAW_COL;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(px, PAD_TOP);
    ctx.lineTo(px, PAD_TOP + innerH);
    ctx.stroke();
  }
}

/** Append an alpha to a #rrggbb colour as an rgba() string. */
function hexA(hex: string, a: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

// ---- audition --------------------------------------------------------------
async function onPlay(): Promise<void> {
  if (!rawAudio || !tunedAudio) await compute();
  const audio = tuned.value ? tunedAudio : rawAudio;
  if (audio) await play(props.def.id, audio);
}

// Coalesce rapid changes (slider drags) into one correction pass per frame.
let pending = 0;
function scheduleCompute(): void {
  if (pending) return;
  pending = requestAnimationFrame(() => {
    pending = 0;
    compute();
  });
}

watch([retuneAmount, retuneSpeedMs, scale], () => {
  if (status.value !== 'idle') scheduleCompute();
});

watch(view, () => {
  if (status.value === 'idle') return;
  ensureLoop();
  // If a side is sounding, swap to the other side seamlessly.
  if (isPlaying.value) {
    stop();
    const audio = tuned.value ? tunedAudio : rawAudio;
    if (audio) play(props.def.id, audio);
  }
});

watch(isPlaying, (on) => {
  if (on) ensureLoop();
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
    eyebrow="PITCH CORRECT · RETUNE"
    :title="title"
    :caption="caption"
    :state="stateLabel"
    :tone="tone"
    :playing="isPlaying"
    :progress="progress"
    :disabled="status === 'loading'"
    :error="status === 'error' ? errorMsg : null"
    loading-label="RETUNING…"
    :show-playhead="isPlaying"
    @toggle="onPlay"
  >
    <template #screen>
      <canvas ref="canvas" class="pc-canvas" />
    </template>
    <template #controls>
      <DemoControls
        :model-value="values"
        :params="def.params ?? []"
        :locale="loc"
        :disabled="status === 'loading'"
        @update:model-value="updateParams"
      />
    </template>
  </DemoFrame>
</template>

<style scoped>
.pc-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
</style>
