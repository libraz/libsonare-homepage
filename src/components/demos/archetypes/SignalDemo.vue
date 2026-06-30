<script setup lang="ts">
/**
 * `signal` archetype: generate a test signal and observe it in two domains at once.
 *
 * The top panel draws a few cycles of the time-domain waveform; the bottom panel
 * draws its magnitude spectrum (computed with the engine's STFT) so the reader can
 * *see* where harmonics come from. Changing the waveform shape or frequency morphs
 * both panels — the displayed curves ease toward the new target over a few frames,
 * so a sine collapsing to a single spike or a saw sprouting a full harmonic comb is
 * unmistakable. No clip or external asset: the signal is generated in-browser and
 * only the analysis runs through WASM.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useSonareDemoAudio } from '@/composables/useSonareDemoAudio';
import { generateSignal } from '@/demos/signal';
import { type GeneratedSignal, type SonareDemoDef } from '@/demos/types';
import { prepareCanvas2D } from '../canvas';
import { useDemoChrome, useDemoParams } from '../composables';
import DemoControls from '../DemoControls.vue';
import DemoFrame from '../DemoFrame.vue';

const props = defineProps<{ def: SonareDemoDef; active: boolean }>();

const { ensureWasm, play, playingId, progress } = useSonareDemoAudio();

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

// ---- reader-adjustable parameters (seeded from the registry defaults) ------
const { values, updateParams } = useDemoParams(props.def);

const waveform = computed<GeneratedSignal>(() => (values.waveform as GeneratedSignal) ?? 'saw');
const freq = computed<number>(() => Number(values.freq ?? 220));

// ---- presentation state ----------------------------------------------------
const stateLabel = computed(() => {
  if (status.value === 'loading') return 'BUILDING';
  if (status.value === 'error') return 'ERROR';
  if (isPlaying.value) return `▸ ${Math.round(progress.value * 100)}%`;
  if (status.value === 'ready') return `${freq.value} Hz`;
  return 'IDLE';
});

// ---- signal + analysis -----------------------------------------------------
const WAVE_N = 480; // display points for the waveform panel
const MAX_HARM = 48; // harmonics tracked for the spectrum panel
const SPEC_MAX_HZ = 5200; // top of the spectrum frequency axis

// `disp*` is what's painted; `target*` is the latest computed frame. Each frame
// `disp` eases toward `target`, producing the morph when parameters change.
// The spectrum is stored as one amplitude per harmonic (index 0 = fundamental),
// normalized to the fundamental so the comb structure reads at a glance.
const dispWave = new Float32Array(WAVE_N);
const targetWave = new Float32Array(WAVE_N);
const dispHarm = new Float32Array(MAX_HARM);
const targetHarm = new Float32Array(MAX_HARM);

let lastAudio: { samples: Float32Array; sampleRate: number } | null = null;

/** Build the current signal and refresh both target curves. */
async function compute(): Promise<void> {
  try {
    const audio = generateSignal({
      kind: 'generate',
      signal: waveform.value,
      freq: freq.value,
      duration: 2,
    });
    lastAudio = audio;
    fillWaveTarget(audio.samples, audio.sampleRate);

    if (status.value === 'idle') status.value = 'loading';
    const wasm = await ensureWasm();
    const r = wasm.stft(audio.samples, audio.sampleRate, 2048, 512);
    fillSpecTarget(r, audio.sampleRate);
    status.value = 'ready';
    startMorph();
  } catch (e) {
    fail(e);
  }
}

/** Sample a few steady-state cycles into the waveform target. */
function fillWaveTarget(samples: Float32Array, sampleRate: number): void {
  const period = sampleRate / Math.max(1, freq.value);
  const span = Math.min(samples.length - 1, Math.max(8, Math.round(period * 3)));
  const start = Math.floor((samples.length - span) / 2);
  for (let i = 0; i < WAVE_N; i++) {
    const idx = start + Math.floor((i / (WAVE_N - 1)) * span);
    targetWave[i] = Math.max(-1, Math.min(1, samples[idx] ?? 0));
  }
}

/**
 * Sample the STFT at each harmonic (n·f0) and normalize to the fundamental.
 *
 * Reading discrete harmonics — rather than a uniform frequency grid — is what
 * makes the comb legible: a sine keeps only its fundamental, a saw shows every
 * harmonic falling off as 1/n, a square keeps only the odd ones, a triangle the
 * odd ones falling off far faster. Linear amplitude (not dB) preserves those
 * textbook ratios.
 */
function fillSpecTarget(
  r: { nBins: number; nFrames: number; magnitude: Float32Array },
  sampleRate: number,
): void {
  const { nBins, nFrames, magnitude } = r;
  const frame = nFrames >> 1;
  const binHz = sampleRate / 2048;
  const f0 = Math.max(1, freq.value);

  // Peak magnitude in a small window around a frequency (robust to bin rounding).
  const peakAt = (hz: number): number => {
    const center = hz / binHz;
    const lo = Math.max(0, Math.floor(center) - 2);
    const hi = Math.min(nBins - 1, Math.ceil(center) + 2);
    let m = 0;
    for (let b = lo; b <= hi; b++) m = Math.max(m, magnitude[b * nFrames + frame] ?? 0);
    return m;
  };

  const fund = Math.max(1e-6, peakAt(f0));
  for (let n = 1; n <= MAX_HARM; n++) {
    const hz = n * f0;
    targetHarm[n - 1] = hz > SPEC_MAX_HZ ? 0 : Math.min(1, peakAt(hz) / fund);
  }
}

// ---- morph + paint loop ----------------------------------------------------
let rafId = 0;

function startMorph(): void {
  if (rafId) return;
  const step = () => {
    let delta = 0;
    for (let i = 0; i < WAVE_N; i++) {
      const d = targetWave[i] - dispWave[i];
      dispWave[i] += d * 0.24;
      delta = Math.max(delta, Math.abs(d));
    }
    for (let i = 0; i < MAX_HARM; i++) {
      const d = targetHarm[i] - dispHarm[i];
      dispHarm[i] += d * 0.24;
      delta = Math.max(delta, Math.abs(d));
    }
    paint();
    if (delta > 0.002) {
      rafId = requestAnimationFrame(step);
    } else {
      dispWave.set(targetWave);
      dispHarm.set(targetHarm);
      paint();
      rafId = 0;
    }
  };
  rafId = requestAnimationFrame(step);
}

function stopMorph(): void {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
}

/** Draw both panels at the current display resolution. */
function paint(): void {
  const frame = prepareCanvas2D(canvas.value);
  if (!frame) return;
  const { ctx, width: w, height: h } = frame;

  const padX = 16;
  const innerW = w - padX * 2;
  const waveTop = 12;
  const waveBot = h * 0.44;
  const specTop = h * 0.52;
  const specBot = h - 16;

  // --- waveform (time domain) ---
  const mid = (waveTop + waveBot) / 2;
  const amp = ((waveBot - waveTop) / 2) * 0.86;
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = '#2dd4bf';
  ctx.shadowColor = 'rgba(45, 212, 191, 0.7)';
  ctx.shadowBlur = 7;
  ctx.beginPath();
  for (let i = 0; i < WAVE_N; i++) {
    const x = padX + (i / (WAVE_N - 1)) * innerW;
    const y = mid - dispWave[i] * amp;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;

  // --- spectrum (frequency domain): discrete harmonic stems ---
  const specH = specBot - specTop;
  const f0 = Math.max(1, freq.value);
  // Stem width scales with harmonic spacing so a sparse comb (high f0) stays bold
  // and a dense one (low f0) stays readable.
  const spacingPx = (f0 / SPEC_MAX_HZ) * innerW;
  const stemW = Math.max(2.5, Math.min(13, spacingPx * 0.34));
  ctx.lineCap = 'round';
  ctx.lineWidth = stemW;
  ctx.shadowColor = 'rgba(255, 168, 92, 0.55)';
  for (let n = 1; n <= MAX_HARM; n++) {
    const v = dispHarm[n - 1];
    if (v < 0.004) continue;
    const hz = n * f0;
    if (hz > SPEC_MAX_HZ) continue;
    const x = padX + (hz / SPEC_MAX_HZ) * innerW;
    const top = specBot - v * specH;
    // Fundamental in brand violet, harmonics warm — so "the fundamental + its
    // overtones" reads as two distinct ideas.
    const grad = ctx.createLinearGradient(0, specBot, 0, top);
    if (n === 1) {
      grad.addColorStop(0, 'rgba(139, 92, 246, 0.35)');
      grad.addColorStop(1, 'rgba(167, 139, 250, 1)');
    } else {
      grad.addColorStop(0, 'rgba(236, 120, 92, 0.3)');
      grad.addColorStop(1, 'rgba(255, 184, 108, 0.96)');
    }
    ctx.strokeStyle = grad;
    ctx.shadowBlur = n === 1 ? 8 : 5;
    ctx.beginPath();
    ctx.moveTo(x, specBot);
    ctx.lineTo(x, top);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
  ctx.lineCap = 'butt';

  // Faint spectrum baseline.
  ctx.strokeStyle = 'rgba(186, 230, 224, 0.18)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padX, specBot + 0.5);
  ctx.lineTo(padX + innerW, specBot + 0.5);
  ctx.stroke();

  // --- panel labels ---
  ctx.shadowBlur = 0;
  ctx.font = '9px "JetBrains Mono", ui-monospace, monospace';
  ctx.fillStyle = 'rgba(186, 230, 224, 0.5)';
  ctx.textBaseline = 'top';
  ctx.fillText('WAVEFORM', padX, waveTop - 2);
  ctx.fillText('SPECTRUM', padX, specTop - 2);
  ctx.textAlign = 'right';
  ctx.fillText('5 kHz', padX + innerW, specBot + 2);
  ctx.textAlign = 'left';
}

// ---- audition --------------------------------------------------------------
async function onPlay(): Promise<void> {
  if (!lastAudio) {
    lastAudio = generateSignal({
      kind: 'generate',
      signal: waveform.value,
      freq: freq.value,
      duration: 2,
    });
  }
  await play(props.def.id, lastAudio);
}

// Coalesce rapid parameter changes (slider drags) into one recompute per frame.
let pending = 0;
function scheduleCompute(): void {
  if (pending) return;
  pending = requestAnimationFrame(() => {
    pending = 0;
    compute();
  });
}

watch(
  () => [waveform.value, freq.value],
  () => {
    if (props.active) scheduleCompute();
  },
);

watch(
  () => props.active,
  (on) => {
    if (on && status.value === 'idle') compute();
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  stopMorph();
  if (pending) cancelAnimationFrame(pending);
});
</script>

<template>
  <DemoFrame
    eyebrow="SIGNAL · HARMONICS"
    :title="title"
    :caption="caption"
    :state="stateLabel"
    :tone="tone"
    :playing="isPlaying"
    :progress="progress"
    :disabled="status === 'loading'"
    :error="status === 'error' ? errorMsg : null"
    loading-label="BUILDING…"
    :show-playhead="isPlaying"
    @toggle="onPlay"
  >
    <template #screen>
      <canvas ref="canvas" class="sd-canvas" />
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
/* Slotted into DemoFrame's screen; fills it. Frame owns all other styling. */
.sd-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
</style>
