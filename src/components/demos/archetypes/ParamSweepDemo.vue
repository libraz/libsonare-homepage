<script setup lang="ts">
/**
 * `param-sweep` archetype: drag one control and hear + see a DSP transform respond.
 *
 * Five processors share this component, selected by `config.processor`:
 * - `pitch-shift` — drag the semitone slider and the whole harmonic comb slides while
 *   the duration stays fixed. The marker tracks the fundamental in Hz. Pitch shifting
 *   here is not formant-preserving, so formants ride along — the "chipmunk" effect.
 * - `time-stretch` — drag the rate slider and the waveform grows or shrinks in time
 *   while the spectrum stays put: same pitch, different length. The two are exact
 *   opposites, which is the whole point of placing them side by side.
 * - `formant-shift` — drag the formant factor and the spectral envelope (the formant
 *   peaks that give a voice its character) shifts while the harmonic comb and the
 *   fundamental marker stay put: timbre moves, pitch does not. The counterpart to
 *   pitch-shift, where the comb moves and the envelope rides along.
 * - `griffin-lim` — reconstruct audio from a mel spectrogram and drag the iteration
 *   count: more Griffin-Lim passes settle the invented phase into something cleaner
 *   and less "phasey". The magnitude is fixed; only the phase quality improves.
 * - `tilt-eq` — drag the tilt amount and the broadband spectrum rotates around a fixed
 *   midrange pivot: positive tilt lifts the highs and trims the lows (brighter),
 *   negative tilt does the reverse (warmer). Loudness is matched per render so the
 *   change you hear is tone, not level. A complementary low-/high-shelf pair around
 *   the pivot, the mastering-EQ way to rebalance the whole spectrum at once.
 *
 * The top panel is the waveform you hear; the bottom is the averaged magnitude
 * spectrum. A playback-synced beam sweeps the waveform.
 */
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useSonareDemoAudio } from '@/composables/useSonareDemoAudio';
import { type DemoLocale, localized, type SonareDemoDef } from '@/demos/types';
import DemoControls from '../DemoControls.vue';
import DemoFrame from '../DemoFrame.vue';

const props = defineProps<{ def: SonareDemoDef; active: boolean }>();

const { locale } = useI18n();
const { ensureWasm, loadClip, play, playingId, progress } = useSonareDemoAudio();

const loc = computed<DemoLocale>(() => (locale.value.startsWith('ja') ? 'ja' : 'en'));
const title = computed(() => localized(props.def.title, loc.value));
const caption = computed(() => localized(props.def.caption, loc.value));

const canvas = ref<HTMLCanvasElement | null>(null);
const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle');
const errorMsg = ref('');
const isPlaying = computed(() => playingId.value === props.def.id);

// ---- reader-adjustable parameters ------------------------------------------
type ParamValue = number | string | boolean;
const values = reactive<Record<string, ParamValue>>({});
for (const p of props.def.params ?? []) values[p.key] = p.default;

function onParams(next: Record<string, ParamValue>): void {
  Object.assign(values, next);
}

type Processor = 'pitch-shift' | 'time-stretch' | 'formant-shift' | 'griffin-lim' | 'tilt-eq';
const processor = computed<Processor>(
  () => (props.def.config?.processor as Processor) ?? 'pitch-shift',
);
const semitones = computed<number>(() => Number(values.semitones ?? 0));
const rate = computed<number>(() => Number(values.rate ?? 1));
const formant = computed<number>(() => Number(values.formant ?? 1));
const iters = computed<number>(() => Number(values.iters ?? 16));
const tilt = computed<number>(() => Number(values.tilt ?? 0));
/** The value that triggers a re-render, whichever processor is active. */
const activeValue = computed(() => {
  switch (processor.value) {
    case 'time-stretch':
      return rate.value;
    case 'formant-shift':
      return formant.value;
    case 'griffin-lim':
      return iters.value;
    case 'tilt-eq':
      return tilt.value;
    default:
      return semitones.value;
  }
});
const clipName = computed(() => (props.def.source.kind === 'clip' ? props.def.source.clip : ''));
const eyebrow = computed(() => {
  switch (processor.value) {
    case 'time-stretch':
      return 'PARAM SWEEP · TIME STRETCH';
    case 'formant-shift':
      return 'PARAM SWEEP · FORMANT';
    case 'griffin-lim':
      return 'PARAM SWEEP · GRIFFIN-LIM';
    case 'tilt-eq':
      return 'PARAM SWEEP · TILT EQ';
    default:
      return 'PARAM SWEEP · PITCH SHIFT';
  }
});
/** The fundamental marker is meaningful only when there is a fixed pitch to mark. */
const showFundamental = computed(
  () => processor.value === 'pitch-shift' || processor.value === 'formant-shift',
);

// ---- presentation state ----------------------------------------------------
const fundHz = ref(0);
const pivotHz = ref(0); // tilt-eq rotation axis; 0 when not applicable
const outDur = ref(0); // rendered duration in seconds
let widthFrac = 1; // fraction of the waveform panel the rendered clip fills (time-stretch)
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
  if (status.value !== 'ready') return 'IDLE';
  switch (processor.value) {
    case 'time-stretch':
      return `${outDur.value.toFixed(1)} s`;
    case 'formant-shift':
      return `×${formant.value.toFixed(2)}`;
    case 'griffin-lim':
      return `${iters.value} iter`;
    case 'tilt-eq':
      return `${tilt.value >= 0 ? '+' : ''}${tilt.value.toFixed(1)} dB`;
    default:
      return `${Math.round(fundHz.value)} Hz`;
  }
});

// ---- audio + figure data ---------------------------------------------------
const BASE_F0 = 220; // the vowel clip's fundamental (A3)
const TILT_PIVOT_HZ = 800; // broad midrange axis the tilt rotates around
const WAVE_COLS = 420;
const SPEC_COLS = 300;
const SPEC_MAX_HZ = 4500;
const wavePeaks = new Float32Array(WAVE_COLS);
const dispSpec = new Float32Array(SPEC_COLS);
const targetSpec = new Float32Array(SPEC_COLS);

let baseClip: { samples: Float32Array; sampleRate: number } | null = null;
let rendered: { samples: Float32Array; sampleRate: number } | null = null;
const reveal = ref(0);

type WasmModule = Awaited<ReturnType<typeof ensureWasm>>;

/** Per-column absolute peaks of the rendered audio (top waveform panel). */
function fillWave(samples: Float32Array): void {
  const n = samples.length;
  let max = 1e-6;
  for (let c = 0; c < WAVE_COLS; c++) {
    const start = Math.floor((c / WAVE_COLS) * n);
    const end = Math.max(start + 1, Math.floor(((c + 1) / WAVE_COLS) * n));
    let p = 0;
    for (let i = start; i < end && i < n; i++) {
      const a = Math.abs(samples[i]);
      if (a > p) p = a;
    }
    wavePeaks[c] = p;
    if (p > max) max = p;
  }
  for (let c = 0; c < WAVE_COLS; c++) wavePeaks[c] /= max;
}

/** Averaged magnitude spectrum (0..SPEC_MAX_HZ), mildly compressed for legibility. */
function fillSpec(wasm: WasmModule, samples: Float32Array, sr: number): void {
  const r = wasm.stft(samples, sr, 2048, 512);
  const { nBins, nFrames, magnitude } = r;
  const binHz = sr / 2048;
  const avg = new Float32Array(nBins);
  let max = 1e-6;
  for (let b = 0; b < nBins; b++) {
    let s = 0;
    for (let fr = 0; fr < nFrames; fr++) s += magnitude[b * nFrames + fr];
    avg[b] = s / nFrames;
    if (avg[b] > max) max = avg[b];
  }
  for (let c = 0; c < SPEC_COLS; c++) {
    const hz = (c / (SPEC_COLS - 1)) * SPEC_MAX_HZ;
    const bin = hz / binHz;
    const b0 = Math.floor(bin);
    const frac = bin - b0;
    const v = b0 + 1 < nBins ? avg[b0] * (1 - frac) + avg[b0 + 1] * frac : (avg[b0] ?? 0);
    targetSpec[c] = (v / max) ** 0.6; // compress so high harmonics stay visible
  }
}

/** Smallest rate the slider allows; sets the longest (reference) duration. */
function minRate(): number {
  return props.def.params?.find((p) => p.key === 'rate')?.min ?? 0.5;
}

/** Scale to a fixed peak so reconstructions at different iteration counts audition equally loud. */
function peakNormalize(samples: Float32Array, target: number): Float32Array {
  let max = 1e-6;
  for (let i = 0; i < samples.length; i++) {
    const a = Math.abs(samples[i]);
    if (a > max) max = a;
  }
  const g = target / max;
  for (let i = 0; i < samples.length; i++) samples[i] *= g;
  return samples;
}

/**
 * Apply one RBJ shelving biquad and return a fresh buffer. `gainDb` may be negative.
 * Slope S is fixed at 1 (the gentle shelf a tilt EQ wants, not a surgical corner).
 */
function shelf(
  samples: Float32Array,
  sr: number,
  kind: 'low' | 'high',
  f0: number,
  gainDb: number,
): Float32Array {
  const A = 10 ** (gainDb / 40);
  const w0 = (2 * Math.PI * f0) / sr;
  const cw = Math.cos(w0);
  const sw = Math.sin(w0);
  const sqA = Math.sqrt(A);
  const alpha = (sw / 2) * Math.SQRT2; // S = 1
  const tsa = 2 * sqA * alpha;
  let b0: number;
  let b1: number;
  let b2: number;
  let a0: number;
  let a1: number;
  let a2: number;
  if (kind === 'low') {
    b0 = A * (A + 1 - (A - 1) * cw + tsa);
    b1 = 2 * A * (A - 1 - (A + 1) * cw);
    b2 = A * (A + 1 - (A - 1) * cw - tsa);
    a0 = A + 1 + (A - 1) * cw + tsa;
    a1 = -2 * (A - 1 + (A + 1) * cw);
    a2 = A + 1 + (A - 1) * cw - tsa;
  } else {
    b0 = A * (A + 1 + (A - 1) * cw + tsa);
    b1 = -2 * A * (A - 1 + (A + 1) * cw);
    b2 = A * (A + 1 + (A - 1) * cw - tsa);
    a0 = A + 1 - (A - 1) * cw + tsa;
    a1 = 2 * (A - 1 - (A + 1) * cw);
    a2 = A + 1 - (A - 1) * cw - tsa;
  }
  const nb0 = b0 / a0;
  const nb1 = b1 / a0;
  const nb2 = b2 / a0;
  const na1 = a1 / a0;
  const na2 = a2 / a0;
  const out = new Float32Array(samples.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < samples.length; i++) {
    const x0 = samples[i];
    const y0 = nb0 * x0 + nb1 * x1 + nb2 * x2 - na1 * y1 - na2 * y2;
    out[i] = y0;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
  }
  return out;
}

async function compute(): Promise<void> {
  try {
    if (status.value === 'idle') status.value = 'loading';
    const wasm = await ensureWasm();
    if (!baseClip) baseClip = await loadClip(clipName.value);
    const sr = baseClip.sampleRate;
    const baseDur = baseClip.samples.length / sr;

    let samples: Float32Array;
    pivotHz.value = 0; // only tilt-eq marks a pivot
    if (processor.value === 'time-stretch') {
      const r = rate.value;
      samples = r === 1 ? baseClip.samples : wasm.timeStretch(baseClip.samples, sr, r);
      // Pitch is preserved, so the fundamental marker stays put — that is the lesson.
      fundHz.value = BASE_F0;
      outDur.value = samples.length / sr;
      // The slowest rate gives the longest clip; draw every render against that width.
      const refDur = baseDur / minRate();
      widthFrac = Math.max(0.04, Math.min(1, outDur.value / refDur));
    } else if (processor.value === 'formant-shift') {
      const f = formant.value;
      // Shift only the spectral envelope; pitch is held, so the fundamental marker
      // stays put while the formant peaks slide — pitch and formant on separate axes.
      samples =
        f === 1 ? baseClip.samples : wasm.voiceChange(baseClip.samples, sr, { formantFactor: f });
      fundHz.value = BASE_F0;
      outDur.value = baseDur;
      widthFrac = 1;
    } else if (processor.value === 'griffin-lim') {
      // Forward to a mel spectrogram, then reconstruct with N Griffin-Lim passes.
      // The magnitude is fixed; more iterations only settle the invented phase.
      const mel = wasm.melSpectrogram(baseClip.samples, sr, 2048, 512, 128);
      const out = wasm.melToAudio(
        mel.power,
        mel.nMels,
        mel.nFrames,
        sr,
        2048,
        512,
        0,
        0,
        iters.value,
      );
      samples = peakNormalize(out, 0.7);
      fundHz.value = 0;
      outDur.value = samples.length / sr;
      widthFrac = 1;
    } else if (processor.value === 'tilt-eq') {
      // Complementary shelves around the pivot: cut one end by the same amount the
      // other is boosted, so the spectrum rotates instead of just getting louder.
      const t = tilt.value;
      let s: Float32Array;
      if (t === 0) {
        s = Float32Array.from(baseClip.samples);
      } else {
        s = shelf(baseClip.samples, sr, 'low', TILT_PIVOT_HZ, -t / 2);
        s = shelf(s, sr, 'high', TILT_PIVOT_HZ, t / 2);
      }
      // Match loudness per render so the lesson is tone, not level.
      samples = peakNormalize(s, 0.7);
      fundHz.value = 0;
      pivotHz.value = TILT_PIVOT_HZ;
      outDur.value = baseDur;
      widthFrac = 1;
    } else {
      const st = semitones.value;
      samples = st === 0 ? baseClip.samples : wasm.pitchShift(baseClip.samples, sr, st);
      fundHz.value = BASE_F0 * 2 ** (st / 12);
      outDur.value = baseDur;
      widthFrac = 1;
    }
    rendered = { samples, sampleRate: sr };
    fillWave(samples);
    fillSpec(wasm, samples, sr);
    status.value = 'ready';
    startMorph();
  } catch (e) {
    status.value = 'error';
    errorMsg.value = e instanceof Error ? e.message : String(e);
  }
}

// ---- morph + paint ---------------------------------------------------------
let rafId = 0;
function startMorph(): void {
  if (rafId) return;
  const step = () => {
    let delta = 0;
    if (reveal.value < 1) {
      reveal.value = Math.min(1, reveal.value + 0.08);
      delta = Math.max(delta, 1 - reveal.value);
    }
    for (let c = 0; c < SPEC_COLS; c++) {
      const d = targetSpec[c] - dispSpec[c];
      dispSpec[c] += d * 0.26;
      delta = Math.max(delta, Math.abs(d));
    }
    paint();
    if (delta > 0.002) {
      rafId = requestAnimationFrame(step);
    } else {
      dispSpec.set(targetSpec);
      paint();
      rafId = 0;
    }
  };
  rafId = requestAnimationFrame(step);
}

// Keep the playhead beam smooth over the waveform during playback.
let playRaf = 0;
watch(isPlaying, (on) => {
  if (on && !playRaf) {
    const step = () => {
      paint();
      playRaf = isPlaying.value ? requestAnimationFrame(step) : 0;
    };
    playRaf = requestAnimationFrame(step);
  }
});

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

  const padX = 14;
  const innerW = w - padX * 2;
  const gap = 12;
  const waveH = h * 0.3;
  const waveMid = 10 + waveH / 2;
  const specTop = 10 + waveH + gap;
  const specBot = h - 18;
  const specH = specBot - specTop;
  const playT = isPlaying.value ? progress.value : -1;

  // --- top: waveform (time). Passed portion brightens during playback. ---
  // For time-stretch the clip fills only `widthFrac` of the panel, so a shorter
  // (faster) render visibly occupies less width than a longer (slower) one.
  const waveW = innerW * widthFrac;
  for (let c = 0; c < WAVE_COLS; c++) {
    const x = padX + (c / (WAVE_COLS - 1)) * waveW;
    const a = wavePeaks[c] * (waveH / 2) * reveal.value;
    const passed = playT >= 0 && c / (WAVE_COLS - 1) <= playT;
    ctx.strokeStyle = passed ? 'rgba(45, 212, 191, 0.9)' : 'rgba(148, 163, 184, 0.42)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, waveMid - a);
    ctx.lineTo(x, waveMid + a);
    ctx.stroke();
  }
  // In-canvas beam aligned to the (possibly shortened) waveform during playback.
  if (playT >= 0) {
    const bx = padX + playT * waveW;
    ctx.strokeStyle = 'rgba(94, 234, 212, 0.85)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(bx, waveMid - waveH / 2);
    ctx.lineTo(bx, waveMid + waveH / 2);
    ctx.stroke();
  }

  // --- bottom: harmonic-comb spectrum (frequency), filled. ---
  const grad = ctx.createLinearGradient(0, specTop, 0, specBot);
  grad.addColorStop(0, 'rgba(167, 139, 250, 0.55)');
  grad.addColorStop(1, 'rgba(167, 139, 250, 0.04)');
  ctx.beginPath();
  ctx.moveTo(padX, specBot);
  for (let c = 0; c < SPEC_COLS; c++) {
    const x = padX + (c / (SPEC_COLS - 1)) * innerW;
    ctx.lineTo(x, specBot - dispSpec[c] * specH * reveal.value);
  }
  ctx.lineTo(padX + innerW, specBot);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.strokeStyle = '#a78bfa';
  ctx.lineWidth = 1.6;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let c = 0; c < SPEC_COLS; c++) {
    const x = padX + (c / (SPEC_COLS - 1)) * innerW;
    const y = specBot - dispSpec[c] * specH * reveal.value;
    c === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Fundamental marker. Drawn when there is a fixed pitch to mark: pitch-shift (it
  // moves) and formant-shift (it deliberately holds). For time-stretch and griffin-lim
  // the spectrum is the constant — a moving Hz marker would mislead.
  if (showFundamental.value && fundHz.value > 0 && fundHz.value < SPEC_MAX_HZ) {
    const mx = padX + (fundHz.value / SPEC_MAX_HZ) * innerW;
    ctx.strokeStyle = 'rgba(45, 212, 191, 0.9)';
    ctx.lineWidth = 1.4;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(mx, specTop);
    ctx.lineTo(mx, specBot);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(94, 234, 212, 0.95)';
    ctx.font = '9px "JetBrains Mono", ui-monospace, monospace';
    ctx.textBaseline = 'top';
    ctx.fillText(`${Math.round(fundHz.value)} Hz`, mx + 4, specTop);
  }

  // Tilt pivot: the rotation axis. The spectrum lifts on one side and drops on the
  // other around this fixed line — drawn in amber to read as an axis, not a peak.
  if (pivotHz.value > 0 && pivotHz.value < SPEC_MAX_HZ) {
    const px = padX + (pivotHz.value / SPEC_MAX_HZ) * innerW;
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.85)';
    ctx.lineWidth = 1.4;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(px, specTop);
    ctx.lineTo(px, specBot);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(252, 211, 77, 0.95)';
    ctx.font = '9px "JetBrains Mono", ui-monospace, monospace';
    ctx.textBaseline = 'top';
    ctx.fillText('PIVOT', px + 4, specTop);
  }

  // Axis labels.
  ctx.font = '9px "JetBrains Mono", ui-monospace, monospace';
  ctx.fillStyle = 'rgba(186, 230, 224, 0.5)';
  ctx.textBaseline = 'top';
  ctx.fillText('WAVE', padX, 2);
  ctx.fillText('0 Hz', padX, specBot + 4);
  ctx.textAlign = 'right';
  ctx.fillText(`${(SPEC_MAX_HZ / 1000).toFixed(1)} kHz`, padX + innerW, specBot + 4);
  ctx.textAlign = 'left';
}

async function onPlay(): Promise<void> {
  if (!rendered) await compute();
  if (rendered) await play(props.def.id, rendered);
}

// Coalesce rapid slider changes into one render per frame.
let pending = 0;
function scheduleCompute(): void {
  if (pending) return;
  pending = requestAnimationFrame(() => {
    pending = 0;
    compute();
  });
}

watch(activeValue, () => {
  if (props.active && status.value !== 'idle') scheduleCompute();
});

watch(
  () => props.active,
  (on) => {
    if (on && status.value === 'idle') compute();
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  if (rafId) cancelAnimationFrame(rafId);
  if (playRaf) cancelAnimationFrame(playRaf);
  if (pending) cancelAnimationFrame(pending);
});
</script>

<template>
  <DemoFrame
    :eyebrow="eyebrow"
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
      <canvas ref="canvas" class="ps-canvas" />
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
.ps-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
</style>
