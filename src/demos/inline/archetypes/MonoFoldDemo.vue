<script setup lang="ts">
/**
 * `mono-fold` archetype: hear and see how phase offset changes a mono fold.
 *
 * The two channels are the same sine wave with a continuous phase offset. The
 * display and audition both come from the same finite PCM buffers, so the
 * correlation and RMS readouts describe the signal the listener receives.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import type { SonareDemoDef } from '@/demos/inline/types';
import { useSonareDemoAudio } from '@/demos/inline/useSonareDemoAudio';
import { prepareCanvas2D } from '@/utils/canvas';
import { useCanvasRedraw, useDemoChrome, useDemoParams } from '../composables';
import DemoControls from '../DemoControls.vue';
import DemoFrame from '../DemoFrame.vue';
import {
  buildMonoFoldSignal,
  type MonoFoldMetrics,
  type MonoFoldSignal,
  measureMonoFold,
} from './monoFoldMath';

const props = defineProps<{ def: SonareDemoDef; active: boolean }>();

const { play, stop, playingId, progress } = useSonareDemoAudio();

const canvas = ref<HTMLCanvasElement | null>(null);
const isPlaying = computed(() => playingId.value === props.def.id);
const { locale: loc, title, caption, status, tone } = useDemoChrome(props.def, isPlaying);
const { values, updateParams } = useDemoParams(props.def);

const SAMPLE_RATE = 44_100;
const DURATION = 1.8;
const FREQUENCY = 220;
const WAVE_COLS = 360;

const phaseDegrees = computed(() => Math.max(0, Math.min(180, Number(values.phase ?? 90))));
const phaseRadians = computed(() => (phaseDegrees.value * Math.PI) / 180);
const audition = computed(() => (values.audition === 'left' ? 'left' : 'mono'));

const displayedLeft = new Float32Array(WAVE_COLS);
const displayedRight = new Float32Array(WAVE_COLS);
const displayedMono = new Float32Array(WAVE_COLS);
const targetLeft = new Float32Array(WAVE_COLS);
const targetRight = new Float32Array(WAVE_COLS);
const targetMono = new Float32Array(WAVE_COLS);
const reveal = ref(0);
const metrics = ref<MonoFoldMetrics | null>(null);
let currentSignal: MonoFoldSignal | null = null;

function signed(value: number, decimals: number): string {
  const rounded = Math.abs(value) < 0.5 * 10 ** -decimals ? 0 : value;
  return `${rounded >= 0 ? '+' : ''}${rounded.toFixed(decimals)}`;
}

function relativeDbLabel(value: number): string {
  if (!Number.isFinite(value) || value < -120) return '−∞ dB';
  const formatted = value.toFixed(2);
  return `${formatted.startsWith('-') ? `−${formatted.slice(1)}` : formatted} dB`;
}

const correlation = computed(() => metrics.value?.correlation ?? 0);
const stateLabel = computed(() => {
  if (isPlaying.value) return `▸ ${Math.round(progress.value * 100)}%`;
  if (status.value !== 'ready' || !metrics.value) return 'IDLE';
  return `MONO ${relativeDbLabel(metrics.value.monoRelativeDb)}`;
});

function fillWindow(signal: MonoFoldSignal): void {
  const period = SAMPLE_RATE / FREQUENCY;
  const span = Math.min(signal.left.length - 1, Math.max(8, Math.round(period * 6)));
  const start = Math.max(0, Math.floor((signal.left.length - span) * 0.4));
  for (let column = 0; column < WAVE_COLS; column++) {
    const ratio = WAVE_COLS > 1 ? column / (WAVE_COLS - 1) : 0;
    const index = Math.min(signal.left.length - 1, start + Math.floor(ratio * span));
    targetLeft[column] = signal.left[index] ?? 0;
    targetRight[column] = signal.right[index] ?? 0;
    targetMono[column] = signal.mono[index] ?? 0;
  }
}

function compute(): void {
  const signal = buildMonoFoldSignal({
    sampleRate: SAMPLE_RATE,
    duration: DURATION,
    frequency: FREQUENCY,
    phaseRadians: phaseRadians.value,
    amplitude: 0.7,
    fadeSeconds: 0.05,
  });
  currentSignal = signal;
  metrics.value = measureMonoFold(signal);
  fillWindow(signal);
  reveal.value = 0;
  status.value = 'ready';
  startMorph();
}

// ---- morph + paint ---------------------------------------------------------
let morphRaf = 0;
function startMorph(): void {
  if (morphRaf) return;
  const step = () => {
    let delta = 0;
    if (reveal.value < 1) {
      reveal.value = Math.min(1, reveal.value + 0.1);
      delta = Math.max(delta, 1 - reveal.value);
    }
    for (let column = 0; column < WAVE_COLS; column++) {
      const leftDelta = targetLeft[column] - displayedLeft[column];
      const rightDelta = targetRight[column] - displayedRight[column];
      const monoDelta = targetMono[column] - displayedMono[column];
      displayedLeft[column] += leftDelta * 0.28;
      displayedRight[column] += rightDelta * 0.28;
      displayedMono[column] += monoDelta * 0.28;
      delta = Math.max(delta, Math.abs(leftDelta), Math.abs(rightDelta), Math.abs(monoDelta));
    }
    paint();
    if (delta > 0.001) {
      morphRaf = requestAnimationFrame(step);
    } else {
      displayedLeft.set(targetLeft);
      displayedRight.set(targetRight);
      displayedMono.set(targetMono);
      paint();
      morphRaf = 0;
    }
  };
  morphRaf = requestAnimationFrame(step);
}

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

function trace(
  ctx: CanvasRenderingContext2D,
  width: number,
  samples: Float32Array,
  midY: number,
  amplitude: number,
  color: string,
  lineWidth: number,
): void {
  const padX = 16;
  const innerWidth = width - padX * 2;
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let column = 0; column < WAVE_COLS; column++) {
    const x = padX + (column / (WAVE_COLS - 1)) * innerWidth;
    const y = midY - samples[column] * amplitude * reveal.value;
    column === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function paint(): void {
  const frame = prepareCanvas2D(canvas.value);
  if (!frame) return;
  const { ctx, width, height } = frame;
  const padX = 16;
  const innerWidth = width - padX * 2;
  const channelMid = height * 0.22;
  const channelAmplitude = height * 0.16;
  const monoMid = height * 0.56;
  const monoAmplitude = height * 0.16;
  const correlationY = height * 0.86;

  ctx.strokeStyle = 'rgba(186, 230, 224, 0.14)';
  ctx.lineWidth = 1;
  for (const y of [channelMid, monoMid]) {
    ctx.beginPath();
    ctx.moveTo(padX, y + 0.5);
    ctx.lineTo(padX + innerWidth, y + 0.5);
    ctx.stroke();
  }

  trace(ctx, width, displayedLeft, channelMid, channelAmplitude, 'rgba(45, 212, 191, 0.9)', 1.8);
  trace(ctx, width, displayedRight, channelMid, channelAmplitude, 'rgba(167, 139, 250, 0.9)', 1.6);

  const gradient = ctx.createLinearGradient(0, monoMid - monoAmplitude, 0, monoMid + monoAmplitude);
  gradient.addColorStop(0, 'rgba(251, 191, 36, 0.5)');
  gradient.addColorStop(1, 'rgba(251, 191, 36, 0.05)');
  ctx.beginPath();
  ctx.moveTo(padX, monoMid);
  for (let column = 0; column < WAVE_COLS; column++) {
    const x = padX + (column / (WAVE_COLS - 1)) * innerWidth;
    ctx.lineTo(x, monoMid - displayedMono[column] * monoAmplitude * reveal.value);
  }
  ctx.lineTo(padX + innerWidth, monoMid);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();
  trace(ctx, width, displayedMono, monoMid, monoAmplitude, '#fbbf24', 1.6);

  ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padX, correlationY);
  ctx.lineTo(padX + innerWidth, correlationY);
  ctx.stroke();
  const zeroX = padX + innerWidth / 2;
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)';
  ctx.beginPath();
  ctx.moveTo(zeroX, correlationY - 7);
  ctx.lineTo(zeroX, correlationY + 7);
  ctx.stroke();
  const correlationX = padX + ((correlation.value + 1) / 2) * innerWidth;
  const correlationColor =
    correlation.value < -0.1 ? '#f87171' : correlation.value < 0.1 ? '#fbbf24' : '#2dd4bf';
  ctx.fillStyle = correlationColor;
  ctx.beginPath();
  ctx.arc(correlationX, correlationY, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = '9px "JetBrains Mono", ui-monospace, monospace';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(45, 212, 191, 0.9)';
  ctx.fillText('L · REFERENCE', padX, channelMid - channelAmplitude - 12);
  ctx.fillStyle = 'rgba(167, 139, 250, 0.9)';
  ctx.fillText(
    `R · PHASE ${phaseDegrees.value.toFixed(0)}°`,
    padX + 105,
    channelMid - channelAmplitude - 12,
  );
  ctx.fillStyle = 'rgba(251, 191, 36, 0.9)';
  ctx.fillText(
    `MONO FOLD · ${relativeDbLabel(metrics.value?.monoRelativeDb ?? Number.NEGATIVE_INFINITY)}`,
    padX,
    monoMid - monoAmplitude - 12,
  );
  ctx.fillStyle = 'rgba(186, 230, 224, 0.5)';
  ctx.fillText('−1', padX, correlationY + 8);
  ctx.textAlign = 'center';
  ctx.fillText('CORRELATION', zeroX, correlationY + 8);
  ctx.textAlign = 'right';
  ctx.fillText('+1', padX + innerWidth, correlationY + 8);
  ctx.fillStyle = correlationColor;
  ctx.fillText(
    `CORR ${signed(correlation.value, 2)}`,
    padX + innerWidth,
    channelMid - channelAmplitude - 12,
  );
  ctx.textAlign = 'left';
}

useCanvasRedraw(canvas, paint);

// ---- audition --------------------------------------------------------------
async function onPlay(): Promise<void> {
  if (!currentSignal) compute();
  const signal = currentSignal;
  if (!signal) return;
  const samples = audition.value === 'left' ? signal.left : signal.mono;
  await play(props.def.id, { samples, sampleRate: signal.sampleRate });
}

let pending = 0;
function scheduleCompute(): void {
  if (pending) return;
  pending = requestAnimationFrame(() => {
    pending = 0;
    compute();
  });
}

watch([phaseDegrees, audition], () => {
  if (!props.active || status.value === 'idle') return;
  // The shared transport cannot retarget an existing AudioBuffer. Stop it before
  // changing the displayed signal so the playhead never describes a different
  // phase or audition choice than the waveform.
  if (isPlaying.value) stop();
  scheduleCompute();
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
