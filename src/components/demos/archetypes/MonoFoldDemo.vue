<script setup lang="ts">
/**
 * `mono-fold` archetype: hear and see what summing to mono does to stereo content.
 *
 * A musical tone is the centre (left) channel; the right channel is the same tone
 * driven from in-phase to anti-phase by one control. Summing to mono averages the
 * two, so as the right channel swings negative the sum shrinks — at full anti-phase
 * it cancels to silence. The panels show both channels, the mono sum collapsing, and
 * a correlation meter swinging +1 → −1. Pressing play auditions the *mono sum*, the
 * signal a phone or club PA actually reproduces, so the cancellation is audible.
 *
 * Pure JS — no WASM. The lesson is phase, not a transform.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useSonareDemoAudio } from '@/composables/useSonareDemoAudio';
import type { SonareDemoDef } from '@/demos/types';
import { prepareCanvas2D } from '../canvas';
import { useDemoChrome, useDemoParams } from '../composables';
import DemoControls from '../DemoControls.vue';
import DemoFrame from '../DemoFrame.vue';

const props = defineProps<{ def: SonareDemoDef; active: boolean }>();

const { play, playingId, progress } = useSonareDemoAudio();

const canvas = ref<HTMLCanvasElement | null>(null);
const isPlaying = computed(() => playingId.value === props.def.id);
const { locale: loc, title, caption, status, tone } = useDemoChrome(props.def, isPlaying);

// ---- reader-adjustable parameters ------------------------------------------
const { values, updateParams } = useDemoParams(props.def);

/** 0 = in-phase (mono-safe), 1 = full anti-phase (cancels in mono). */
const antiphase = computed<number>(() => Number(values.antiphase ?? 70) / 100);
/** Right-channel polarity factor: +1 (in-phase) … 0 … −1 (inverted). */
const rGain = computed<number>(() => 1 - 2 * antiphase.value);
/** Mono sum keeps a (1 − antiphase) fraction; reaches 0 at full anti-phase. */
const monoLevel = computed<number>(() => 1 - antiphase.value);
const correlation = computed<number>(() => (rGain.value > 1e-4 ? 1 : rGain.value < -1e-4 ? -1 : 0));

const stateLabel = computed(() => {
  if (isPlaying.value) return `▸ ${Math.round(progress.value * 100)}%`;
  if (status.value !== 'ready') return 'IDLE';
  const db = monoLevel.value <= 1e-4 ? -Infinity : 20 * Math.log10(monoLevel.value);
  return Number.isFinite(db) ? `MONO ${db.toFixed(1)} dB` : 'MONO −∞ dB';
});

// ---- centre signal (left channel) ------------------------------------------
const SR = 44100;
const DUR = 1.8;
const N = Math.round(SR * DUR);
const HARMONICS: Array<[number, number]> = [
  [220, 1],
  [440, 0.5],
  [660, 0.32],
  [880, 0.2],
];
let mid: Float32Array | null = null;

/** Build the mono centre tone once: a few harmonics under a soft window. */
function buildMid(): Float32Array {
  const m = new Float32Array(N);
  let peak = 1e-6;
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    let s = 0;
    for (const [f, a] of HARMONICS) s += a * Math.sin(2 * Math.PI * f * t);
    // Soft fade in/out so playback has no clicks.
    const env = Math.min(1, t / 0.05, (DUR - t) / 0.05);
    m[i] = s * Math.max(0, env);
    const abs = Math.abs(m[i]);
    if (abs > peak) peak = abs;
  }
  const g = 0.7 / peak;
  for (let i = 0; i < N; i++) m[i] *= g;
  return m;
}

// ---- display waveforms (a short window, a few cycles) ----------------------
const WAVE_COLS = 360;
const dispL = new Float32Array(WAVE_COLS);
const dispR = new Float32Array(WAVE_COLS);
const dispMono = new Float32Array(WAVE_COLS);
const targetR = new Float32Array(WAVE_COLS);
const targetMono = new Float32Array(WAVE_COLS);
const reveal = ref(0);

/** Sample the centre tone across ~6 fundamental cycles for the display window. */
function fillWindow(): void {
  if (!mid) mid = buildMid();
  const cycles = 6;
  const span = Math.round((SR / 220) * cycles);
  const start = Math.floor(N * 0.4);
  for (let c = 0; c < WAVE_COLS; c++) {
    const idx = start + Math.floor((c / (WAVE_COLS - 1)) * span);
    const v = mid[Math.min(N - 1, idx)];
    dispL[c] = v; // left = centre, constant across the sweep
    targetR[c] = v * rGain.value;
    targetMono[c] = v * monoLevel.value;
  }
}

function compute(): void {
  fillWindow();
  status.value = 'ready';
  startMorph();
}

// ---- morph + paint ---------------------------------------------------------
let rafId = 0;
function startMorph(): void {
  if (rafId) return;
  const step = () => {
    let delta = 0;
    if (reveal.value < 1) {
      reveal.value = Math.min(1, reveal.value + 0.1);
      delta = Math.max(delta, 1 - reveal.value);
    }
    for (let c = 0; c < WAVE_COLS; c++) {
      const dr = targetR[c] - dispR[c];
      const dm = targetMono[c] - dispMono[c];
      dispR[c] += dr * 0.28;
      dispMono[c] += dm * 0.28;
      delta = Math.max(delta, Math.abs(dr), Math.abs(dm));
    }
    paint();
    if (delta > 0.001) {
      rafId = requestAnimationFrame(step);
    } else {
      dispR.set(targetR);
      dispMono.set(targetMono);
      paint();
      rafId = 0;
    }
  };
  rafId = requestAnimationFrame(step);
}

let playRaf = 0;
watch(isPlaying, (on) => {
  if (on && !playRaf) {
    const stepFn = () => {
      paint();
      playRaf = isPlaying.value ? requestAnimationFrame(stepFn) : 0;
    };
    playRaf = requestAnimationFrame(stepFn);
  }
});

function trace(disp: Float32Array, midY: number, amp: number, color: string, w: number): void {
  const el = canvas.value;
  const ctx = el?.getContext('2d');
  if (!ctx || !el) return;
  const width = el.clientWidth;
  const padX = 16;
  const innerW = width - padX * 2;
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let c = 0; c < WAVE_COLS; c++) {
    const x = padX + (c / (WAVE_COLS - 1)) * innerW;
    const y = midY - disp[c] * amp * reveal.value;
    c === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function paint(): void {
  const frame = prepareCanvas2D(canvas.value);
  if (!frame) return;
  const { ctx, width: w, height: h } = frame;

  const padX = 16;
  const innerW = w - padX * 2;
  // Three stacked lanes: channels (L/R overlaid), mono sum, correlation bar.
  const chMid = h * 0.22;
  const chAmp = h * 0.16;
  const monoMid = h * 0.56;
  const monoAmp = h * 0.16;
  const corrY = h * 0.86;

  // Zero baselines.
  ctx.strokeStyle = 'rgba(186, 230, 224, 0.14)';
  ctx.lineWidth = 1;
  for (const y of [chMid, monoMid]) {
    ctx.beginPath();
    ctx.moveTo(padX, y + 0.5);
    ctx.lineTo(padX + innerW, y + 0.5);
    ctx.stroke();
  }

  // Channels: left (teal, constant) and right (violet, swings to anti-phase).
  trace(dispL, chMid, chAmp, 'rgba(45, 212, 191, 0.85)', 1.8);
  trace(dispR, chMid, chAmp, 'rgba(167, 139, 250, 0.9)', 1.6);

  // Mono sum (amber), filled, collapsing toward the baseline as it cancels.
  const grad = ctx.createLinearGradient(0, monoMid - monoAmp, 0, monoMid + monoAmp);
  grad.addColorStop(0, 'rgba(251, 191, 36, 0.5)');
  grad.addColorStop(1, 'rgba(251, 191, 36, 0.05)');
  ctx.beginPath();
  ctx.moveTo(padX, monoMid);
  for (let c = 0; c < WAVE_COLS; c++) {
    const x = padX + (c / (WAVE_COLS - 1)) * innerW;
    ctx.lineTo(x, monoMid - dispMono[c] * monoAmp * reveal.value);
  }
  ctx.lineTo(padX + innerW, monoMid);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
  trace(dispMono, monoMid, monoAmp, '#fbbf24', 1.6);

  // Correlation meter: −1 (left) … 0 (centre) … +1 (right).
  const barW = innerW;
  const barX = padX;
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(barX, corrY);
  ctx.lineTo(barX + barW, corrY);
  ctx.stroke();
  const zeroX = barX + barW / 2;
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)';
  ctx.beginPath();
  ctx.moveTo(zeroX, corrY - 7);
  ctx.lineTo(zeroX, corrY + 7);
  ctx.stroke();
  const corrX = barX + ((correlation.value + 1) / 2) * barW;
  const corrColor =
    correlation.value < -0.1 ? '#f87171' : correlation.value < 0.1 ? '#fbbf24' : '#2dd4bf';
  ctx.fillStyle = corrColor;
  ctx.beginPath();
  ctx.arc(corrX, corrY, 5, 0, Math.PI * 2);
  ctx.fill();

  // Labels + readouts.
  ctx.font = '9px "JetBrains Mono", ui-monospace, monospace';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(45, 212, 191, 0.85)';
  ctx.fillText('L', padX, chMid - chAmp - 12);
  ctx.fillStyle = 'rgba(167, 139, 250, 0.9)';
  ctx.fillText('R', padX + 14, chMid - chAmp - 12);
  ctx.fillStyle = 'rgba(251, 191, 36, 0.9)';
  ctx.fillText('MONO SUM', padX, monoMid - monoAmp - 12);
  ctx.fillStyle = 'rgba(186, 230, 224, 0.5)';
  ctx.fillText('−1', barX, corrY + 8);
  ctx.textAlign = 'center';
  ctx.fillText('CORRELATION', zeroX, corrY + 8);
  ctx.textAlign = 'right';
  ctx.fillText('+1', barX + barW, corrY + 8);
  ctx.fillStyle = corrColor;
  ctx.fillText(
    `CORR ${correlation.value >= 0 ? '+' : ''}${correlation.value.toFixed(0)}`,
    padX + innerW,
    chMid - chAmp - 12,
  );
  ctx.textAlign = 'left';
}

// ---- audition: play the mono sum -------------------------------------------
async function onPlay(): Promise<void> {
  if (!mid) mid = buildMid();
  const sum = new Float32Array(N);
  const g = monoLevel.value;
  for (let i = 0; i < N; i++) sum[i] = mid[i] * g;
  await play(props.def.id, { samples: sum, sampleRate: SR });
}

let pending = 0;
function scheduleCompute(): void {
  if (pending) return;
  pending = requestAnimationFrame(() => {
    pending = 0;
    compute();
  });
}

watch(antiphase, () => {
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
    eyebrow="STEREO · MONO FOLD"
    :title="title"
    :caption="caption"
    :state="stateLabel"
    :tone="tone"
    :playing="isPlaying"
    :progress="progress"
    :show-playhead="false"
    @toggle="onPlay"
  >
    <template #screen>
      <canvas ref="canvas" class="mf-canvas" />
    </template>
    <template #controls>
      <DemoControls
        :model-value="values"
        :params="def.params ?? []"
        :locale="loc"
        @update:model-value="updateParams"
      />
    </template>
  </DemoFrame>
</template>

<style scoped>
.mf-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
</style>
