<script setup lang="ts">
/**
 * `fm-sidebands` archetype: modulator ratio and modulation index on the engine's
 * FM voice, read off the spectrum they produce.
 *
 * Each control change bounces one held A3 through NativeSynth's `fm` engine
 * (see `fmSidebandMath.ts`) and measures the frame-averaged spectrum. The
 * spectrum is drawn over a grid at multiples of the note, so partials landing on
 * the grid read as a pitched tone and partials between it as a bell-like one. A
 * strip above shows a few cycles of the waveform the same render produced.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import type { SonareDemoDef } from '@/demos/inline/types';
import { useSonareDemoAudio } from '@/demos/inline/useSonareDemoAudio';
import { prepareCanvas2D } from '@/utils/canvas';
import { useCanvasRedraw, useDemoChrome, useDemoParams, useDisposed } from '../composables';
import DemoControls from '../DemoControls.vue';
import DemoFrame from '../DemoFrame.vue';
import {
  FM_F0,
  FM_SAMPLE_RATE,
  findPartials,
  fmSpectrum,
  type Partial,
  renderFmNote,
} from './fmSidebandMath';

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
const { values, updateParams } = useDemoParams(props.def);

const ratio = computed(() => Number(values.ratio ?? 1));
const index = computed(() => Number(values.index ?? 1.5));

const MAX_HZ = 4500;
const MIN_DB = -60;
const COLS = 450;
const WAVE_POINTS = 360;
/** About four and a half cycles of A3. */
const WAVE_SEC = 0.02;

const targetSpec = new Float32Array(COLS).fill(MIN_DB);
const dispSpec = new Float32Array(COLS).fill(MIN_DB);
const targetWave = new Float32Array(WAVE_POINTS);
const dispWave = new Float32Array(WAVE_POINTS);
const partials = ref<Partial[]>([]);
let pcm: Float32Array | null = null;

function fmtRatio(r: number): string {
  return Number.isInteger(r) ? String(r) : r.toFixed(2);
}

const stateLabel = computed(() => {
  if (status.value === 'loading') return 'RENDERING';
  if (status.value === 'error') return 'ERROR';
  if (status.value !== 'ready') return 'IDLE';
  return `1 : ${fmtRatio(ratio.value)} · I ${index.value.toFixed(1)} · ${partials.value.length} PARTIALS`;
});

// ---- paint -----------------------------------------------------------------
function paint(): void {
  const frame = prepareCanvas2D(canvas.value);
  if (!frame) return;
  const { ctx, width: w, height: h } = frame;
  ctx.font = '9px "JetBrains Mono", ui-monospace, monospace';

  const padL = 38;
  const padR = 12;
  const waveTop = 10;
  const waveBot = h * 0.26;
  const specTop = waveBot + 16;
  const specBot = h - 18;
  const xOfHz = (hz: number) => padL + (hz / MAX_HZ) * (w - padL - padR);
  const yOfDb = (d: number) =>
    specBot - ((Math.max(MIN_DB, Math.min(0, d)) - MIN_DB) / -MIN_DB) * (specBot - specTop);

  // Waveform strip.
  const mid = (waveTop + waveBot) / 2;
  const amp = (waveBot - waveTop) / 2 - 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padL, mid);
  ctx.lineTo(w - padR, mid);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(45,212,191,0.9)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < WAVE_POINTS; i++) {
    const x = padL + (i / (WAVE_POINTS - 1)) * (w - padL - padR);
    const y = mid - dispWave[i] * amp;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.fillStyle = 'rgba(186,230,224,0.5)';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText('WAVE', padL - 6, mid);

  // Harmonic grid: multiples of the note.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let k = 1; k * FM_F0 <= MAX_HZ; k++) {
    const x = xOfHz(k * FM_F0);
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.beginPath();
    ctx.moveTo(x, specTop);
    ctx.lineTo(x, specBot);
    ctx.stroke();
    if (k <= 4 || k % 2 === 0) {
      ctx.fillStyle = 'rgba(186,230,224,0.45)';
      ctx.fillText(`${k}f`, x, specBot + 4);
    }
  }
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (const d of [0, -20, -40, -60]) {
    ctx.strokeStyle = d === -40 ? 'rgba(251,191,36,0.18)' : 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.moveTo(padL, yOfDb(d));
    ctx.lineTo(w - padR, yOfDb(d));
    ctx.stroke();
    ctx.fillStyle = 'rgba(186,230,224,0.5)';
    ctx.fillText(d === 0 ? '0 dB' : `−${-d}`, padL - 6, yOfDb(d));
  }

  // Spectrum as a filled trace.
  const grad = ctx.createLinearGradient(0, specTop, 0, specBot);
  grad.addColorStop(0, 'rgba(167,139,250,0.55)');
  grad.addColorStop(1, 'rgba(167,139,250,0.02)');
  ctx.beginPath();
  ctx.moveTo(xOfHz(0), specBot);
  for (let c = 0; c < COLS; c++) ctx.lineTo(xOfHz(((c + 0.5) / COLS) * MAX_HZ), yOfDb(dispSpec[c]));
  ctx.lineTo(xOfHz(MAX_HZ), specBot);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(196,181,253,0.95)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (let c = 0; c < COLS; c++) {
    const x = xOfHz(((c + 0.5) / COLS) * MAX_HZ);
    if (c === 0) ctx.moveTo(x, yOfDb(dispSpec[c]));
    else ctx.lineTo(x, yOfDb(dispSpec[c]));
  }
  ctx.stroke();

  // Partials within 40 dB: amber on the harmonic grid, rose between it.
  for (const p of partials.value) {
    if (p.hz > MAX_HZ) continue;
    const k = p.hz / FM_F0;
    const onGrid = Math.abs(k - Math.round(k)) < 0.04;
    ctx.fillStyle = onGrid ? '#fbbf24' : '#fb7185';
    ctx.beginPath();
    ctx.arc(xOfHz(p.hz), yOfDb(p.db) - 5, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.textAlign = 'left';
}

useCanvasRedraw(canvas, paint);

// ---- data ------------------------------------------------------------------
function fillTargets(wasm: Awaited<ReturnType<typeof ensureWasm>>, samples: Float32Array): void {
  const spec = fmSpectrum(wasm, samples);
  partials.value = findPartials(spec, -40);
  targetSpec.fill(MIN_DB);
  for (let b = 0; b < spec.db.length; b++) {
    const hz = b * spec.binHz;
    if (hz >= MAX_HZ) break;
    const c = Math.floor((hz / MAX_HZ) * COLS);
    targetSpec[c] = Math.max(targetSpec[c], spec.db[b]);
  }
  // A window from the sustain, started at a rising zero crossing so the strip holds still.
  let start = Math.round(0.5 * FM_SAMPLE_RATE);
  for (let i = start; i < start + 400; i++) {
    if (samples[i - 1] <= 0 && samples[i] > 0) {
      start = i;
      break;
    }
  }
  const span = WAVE_SEC * FM_SAMPLE_RATE;
  for (let i = 0; i < WAVE_POINTS; i++) {
    targetWave[i] = samples[start + Math.round((i / (WAVE_POINTS - 1)) * span)] / 0.85;
  }
}

let morphRaf = 0;
function startMorph(): void {
  if (morphRaf) return;
  const step = () => {
    let moving = false;
    for (let c = 0; c < COLS; c++) {
      const d = targetSpec[c] - dispSpec[c];
      dispSpec[c] += d * 0.25;
      if (Math.abs(d) > 0.05) moving = true;
    }
    for (let i = 0; i < WAVE_POINTS; i++) {
      const d = targetWave[i] - dispWave[i];
      dispWave[i] += d * 0.25;
      if (Math.abs(d) > 1e-3) moving = true;
    }
    paint();
    morphRaf = moving ? requestAnimationFrame(step) : 0;
  };
  morphRaf = requestAnimationFrame(step);
}

const disposed = useDisposed();

async function compute(): Promise<void> {
  if (disposed()) return;
  try {
    if (status.value === 'idle') status.value = 'loading';
    const wasm = await ensureWasm();
    if (disposed()) return;
    pcm = renderFmNote(wasm, ratio.value, index.value);
    fillTargets(wasm, pcm);
    status.value = 'ready';
    startMorph();
  } catch (e) {
    if (disposed()) return;
    fail(e);
  }
}

let pending = 0;
function scheduleCompute(): void {
  if (pending) return;
  pending = requestAnimationFrame(() => {
    pending = 0;
    compute();
  });
}

async function onPlay(): Promise<void> {
  if (!pcm) return;
  await play(props.def.id, { samples: pcm, sampleRate: FM_SAMPLE_RATE });
}

watch([ratio, index], () => {
  // The buffer belongs to the previous patch; stop rather than let it mislabel the plot.
  if (isPlaying.value) stop();
  if (status.value !== 'idle') scheduleCompute();
});

watch(
  () => props.active,
  (on) => {
    if (on && status.value === 'idle') compute();
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  if (morphRaf) cancelAnimationFrame(morphRaf);
  if (pending) cancelAnimationFrame(pending);
});
</script>

<template>
  <DemoFrame
    eyebrow="FM · RATIO × INDEX"
    :title="title"
    :caption="caption"
    :state="stateLabel"
    :tone="tone"
    :playing="isPlaying"
    :progress="progress"
    :disabled="status !== 'ready'"
    :error="status === 'error' ? errorMsg : null"
    loading-label="RENDERING…"
    :show-playhead="false"
    axis-freq="dB"
    axis-time="FREQ →"
    @toggle="onPlay"
  >
    <template #screen>
      <canvas ref="canvas" class="fm-canvas" />
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
.fm-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
</style>
