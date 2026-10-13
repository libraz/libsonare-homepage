<script setup lang="ts">
/**
 * `ducking` archetype: a voice pulling a music bed down through the mixer's
 * sidechain router, and what the release does between words.
 *
 * Three lanes share one time axis (see `duckingMath.ts`): the host's level
 * against the threshold, the bed before and after the duck, and the gain
 * reduction measured between those two. The talk spans are shaded so the short
 * word gaps, where a fast release lets the bed swell back, are easy to find.
 * Play auditions the rendered master with a marker riding all three lanes.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import type { SonareDemoDef } from '@/demos/inline/types';
import { useSonareDemoAudio } from '@/demos/inline/useSonareDemoAudio';
import { prepareCanvas2D } from '@/utils/canvas';
import { useCanvasRedraw, useDemoChrome, useDemoParams, useDisposed } from '../composables';
import DemoControls from '../DemoControls.vue';
import DemoFrame from '../DemoFrame.vue';
import {
  buildDuckKey,
  DUCK_PHRASES,
  DUCK_WINDOW_SEC,
  type DuckRun,
  duckSummary,
  runDuck,
} from './duckingMath';

const props = defineProps<{ def: SonareDemoDef; active: boolean }>();

const { ensureWasm, loadClip, play, stop, playingId, progress } = useSonareDemoAudio();

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

const thresholdDb = computed(() => Number(values.threshold ?? -30));
const ratio = computed(() => Number(values.ratio ?? 4));
const releaseMs = computed(() => Number(values.release ?? 100));
const ATTACK_MS = 5;
const RANGE_DB = 18;

/** `config.clips` is `[voice, bed]`. */
const clipNames = computed(() => (props.def.config?.clips as string[] | undefined) ?? []);

const run = ref<DuckRun | null>(null);
const summary = computed(() => (run.value ? duckSummary(run.value) : null));
let key: Float32Array | null = null;
let bed: { samples: Float32Array; sampleRate: number } | null = null;

function db(v: number): string {
  const s = (Math.abs(v) < 0.05 ? 0 : v).toFixed(1);
  return s.startsWith('-') ? `−${s.slice(1)}` : s;
}

const stateLabel = computed(() => {
  if (status.value === 'loading') return 'RENDERING';
  if (status.value === 'error') return 'ERROR';
  const s = summary.value;
  if (!s) return 'IDLE';
  return `UNDER VOICE ${db(s.underVoiceDb)} dB · IN GAPS ${db(s.inGapsDb)} dB`;
});

// ---- paint -----------------------------------------------------------------
function paint(): void {
  const frame = prepareCanvas2D(canvas.value);
  const r = run.value;
  if (!frame || !r) return;
  const { ctx, width: w, height: h } = frame;
  ctx.font = '9px "JetBrains Mono", ui-monospace, monospace';

  const padL = 50;
  const padR = 12;
  const gap = 12;
  const laneH = (h - 12 - 14 - gap * 2) / 3;
  const lanes = [0, 1, 2].map((i) => 12 + i * (laneH + gap));
  const n = r.gainReductionDb.length;
  const dur = n * DUCK_WINDOW_SEC;
  const xOfT = (t: number) => padL + (t / dur) * (w - padL - padR);
  const xOf = (i: number) => xOfT(i * DUCK_WINDOW_SEC);

  // Talk spans across every lane.
  for (const [a, b] of DUCK_PHRASES) {
    ctx.fillStyle = 'rgba(251,191,36,0.06)';
    ctx.fillRect(xOfT(a), lanes[0], xOfT(b) - xOfT(a), lanes[2] + laneH - lanes[0]);
  }

  const levelLane = (top: number, min: number, max: number) => (d: number) =>
    top + laneH - ((Math.max(min, Math.min(max, d)) - min) / (max - min)) * laneH;
  const trace = (ys: Float32Array, y: (d: number) => number, color: string, fill?: string) => {
    if (fill) {
      ctx.beginPath();
      ctx.moveTo(xOf(0), y(-1e9));
      for (let i = 0; i < n; i++) ctx.lineTo(xOf(i), y(ys[i]));
      ctx.lineTo(xOf(n - 1), y(-1e9));
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      if (i === 0) ctx.moveTo(xOf(i), y(ys[i]));
      else ctx.lineTo(xOf(i), y(ys[i]));
    }
    ctx.stroke();
  };
  const label = (top: number, text: string) => {
    ctx.fillStyle = 'rgba(186,230,224,0.6)';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, padL - 6, top + laneH / 2);
  };

  // Lane 1: the key against the threshold.
  const yKey = levelLane(lanes[0], -60, 0);
  trace(r.keyDb, yKey, 'rgba(251,191,36,0.95)', 'rgba(251,191,36,0.2)');
  ctx.strokeStyle = '#fb7185';
  ctx.setLineDash([5, 3]);
  ctx.beginPath();
  ctx.moveTo(padL, yKey(thresholdDb.value));
  ctx.lineTo(w - padR, yKey(thresholdDb.value));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#fb7185';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`THRESHOLD ${db(thresholdDb.value)} dB`, w - padR - 4, yKey(thresholdDb.value) - 2);
  label(lanes[0], 'HOST');

  // Lane 2: the bed before and after the duck.
  const yBed = levelLane(lanes[1], -60, -10);
  trace(r.bedDb, yBed, 'rgba(255,255,255,0.3)');
  trace(r.duckedDb, yBed, 'rgba(45,212,191,0.95)', 'rgba(45,212,191,0.18)');
  label(lanes[1], 'BED');

  // Lane 3: gain reduction, 0 at the top.
  const yGr = (d: number) => lanes[2] + (Math.max(-20, Math.min(0, d)) / -20) * laneH;
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath();
  ctx.moveTo(padL, yGr(0));
  ctx.lineTo(w - padR, yGr(0));
  ctx.stroke();
  ctx.strokeStyle = 'rgba(167,139,250,0.35)';
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(padL, yGr(-RANGE_DB));
  ctx.lineTo(w - padR, yGr(-RANGE_DB));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(xOf(0), yGr(0));
  for (let i = 0; i < n; i++) ctx.lineTo(xOf(i), yGr(r.gainReductionDb[i]));
  ctx.lineTo(xOf(n - 1), yGr(0));
  ctx.closePath();
  ctx.fillStyle = 'rgba(167,139,250,0.35)';
  ctx.fill();
  trace(r.gainReductionDb, yGr, 'rgba(196,181,253,0.95)');
  label(lanes[2], 'GR');

  // Time ticks.
  ctx.fillStyle = 'rgba(186,230,224,0.45)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let t = 0; t <= dur; t += 1) ctx.fillText(`${t}s`, xOfT(t), lanes[2] + laneH + 3);

  if (isPlaying.value) {
    const i = Math.min(n - 1, Math.max(0, Math.round(progress.value * (n - 1))));
    const x = xOf(i);
    ctx.strokeStyle = 'rgba(251,191,36,0.8)';
    ctx.beginPath();
    ctx.moveTo(x, lanes[0]);
    ctx.lineTo(x, lanes[2] + laneH);
    ctx.stroke();
    ctx.fillStyle = '#c4b5fd';
    ctx.beginPath();
    ctx.arc(x, yGr(r.gainReductionDb[i]), 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.textAlign = x > w * 0.75 ? 'right' : 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(226,242,240,0.9)';
    ctx.fillText(
      `${db(r.gainReductionDb[i])} dB`,
      x + (x > w * 0.75 ? -8 : 8),
      lanes[2] + laneH / 2,
    );
  }
  ctx.textAlign = 'left';
}

useCanvasRedraw(canvas, paint);

let playRaf = 0;
function startPlayLoop(): void {
  if (playRaf) return;
  const step = () => {
    paint();
    playRaf = isPlaying.value ? requestAnimationFrame(step) : 0;
  };
  playRaf = requestAnimationFrame(step);
}
watch(isPlaying, (on) => {
  if (on) startPlayLoop();
  else paint();
});

// ---- engine ----------------------------------------------------------------
const disposed = useDisposed();

async function compute(): Promise<void> {
  if (disposed()) return;
  try {
    if (status.value === 'idle') status.value = 'loading';
    const wasm = await ensureWasm();
    if (disposed()) return;
    if (!bed || !key) {
      const [voiceName, bedName] = clipNames.value;
      const [voice, loadedBed] = await Promise.all([loadClip(voiceName), loadClip(bedName)]);
      if (disposed()) return;
      bed = loadedBed;
      key = buildDuckKey(voice.samples, bed.samples.length, bed.sampleRate);
    }
    run.value = runDuck(wasm, key, bed.samples, bed.sampleRate, {
      thresholdDb: thresholdDb.value,
      ratio: ratio.value,
      attackMs: ATTACK_MS,
      releaseMs: releaseMs.value,
      rangeDb: RANGE_DB,
    });
    status.value = 'ready';
    paint();
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
  const r = run.value;
  if (!r) return;
  await play(props.def.id, { samples: r.mix, sampleRate: r.sampleRate });
}

watch([thresholdDb, ratio, releaseMs], () => {
  // The buffer belongs to the previous settings; stop rather than let it mislabel the plot.
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
  if (playRaf) cancelAnimationFrame(playRaf);
  if (pending) cancelAnimationFrame(pending);
});
</script>

<template>
  <DemoFrame
    eyebrow="MIXER · SIDECHAIN DUCK"
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
    axis-time="TIME →"
    @toggle="onPlay"
  >
    <template #screen>
      <canvas ref="canvas" class="dk-canvas" />
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
.dk-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
</style>
