<script setup lang="ts">
/**
 * `limiter` archetype: drive a clip into the true-peak limiter and watch the
 * ceiling hold.
 *
 * The drive slider is input gain ahead of `maximizer.truePeakLimiter` (see
 * `limiterMath.ts`). The top panel overlays the driven input's peak envelope and
 * the limited output's against the ceiling; the bottom panel is the gain
 * reduction measured between them. Play auditions the limited output, with a
 * marker riding the gain-reduction trace.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import type { SonareDemoDef } from '@/demos/inline/types';
import { useSonareDemoAudio } from '@/demos/inline/useSonareDemoAudio';
import { prepareCanvas2D } from '@/utils/canvas';
import { useCanvasRedraw, useDemoChrome, useDemoParams, useDisposed } from '../composables';
import DemoControls from '../DemoControls.vue';
import DemoFrame from '../DemoFrame.vue';
import { LIMITER_CEILING_DB, type LimiterRun, runLimiter } from './limiterMath';

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

const drive = computed(() => Number(values.drive ?? 9));
const ceiling = computed(() => LIMITER_CEILING_DB);
const clipName = computed(() => (props.def.source.kind === 'clip' ? props.def.source.clip : ''));

const LEVEL_MIN = -36;
const LEVEL_MAX = 20;
const GR_MIN = -20;

const run = ref<LimiterRun | null>(null);
let clip: { samples: Float32Array; sampleRate: number } | null = null;
let baseRmsDb = 0;

function signedDb(v: number, digits = 1): string {
  const s = (Math.abs(v) < 0.5 * 10 ** -digits ? 0 : v).toFixed(digits);
  return v > 0 && Number(s) !== 0 ? `+${s}` : s.startsWith('-') ? `−${s.slice(1)}` : s;
}

const maxGr = computed(() => {
  const r = run.value;
  if (!r) return 0;
  let m = 0;
  for (const v of r.gainReductionDb) m = Math.min(m, v);
  return m;
});

const stateLabel = computed(() => {
  if (status.value === 'loading') return 'LIMITING';
  if (status.value === 'error') return 'ERROR';
  const r = run.value;
  if (!r) return 'IDLE';
  return `IN ${signedDb(r.inputTruePeakDb)} → OUT ${signedDb(r.outputTruePeakDb)} dBTP`;
});

// ---- paint -----------------------------------------------------------------
function paint(): void {
  const frame = prepareCanvas2D(canvas.value);
  const r = run.value;
  if (!frame || !r) return;
  const { ctx, width: w, height: h } = frame;
  ctx.font = '9px "JetBrains Mono", ui-monospace, monospace';

  const padL = 44;
  const padR = 12;
  const lTop = 14;
  const lBot = h * 0.6;
  const gTop = lBot + 16;
  const gBot = h - 14;
  const n = r.gainReductionDb.length;
  const xOf = (i: number) => padL + (i / Math.max(1, n - 1)) * (w - padL - padR);
  const yLevel = (d: number) =>
    lBot -
    ((Math.max(LEVEL_MIN, Math.min(LEVEL_MAX, d)) - LEVEL_MIN) / (LEVEL_MAX - LEVEL_MIN)) *
      (lBot - lTop);
  const yGr = (d: number) => gTop + (Math.max(GR_MIN, Math.min(0, d)) / GR_MIN) * (gBot - gTop);

  // Level grid.
  ctx.lineWidth = 1;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (const d of [-24, -12, 0, 12]) {
    ctx.strokeStyle = d === 0 ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.moveTo(padL, yLevel(d));
    ctx.lineTo(w - padR, yLevel(d));
    ctx.stroke();
    ctx.fillStyle = 'rgba(186,230,224,0.5)';
    ctx.fillText(`${signedDb(d, 0)} dB`, padL - 6, yLevel(d));
  }

  const area = (ys: Float32Array, fill: string, stroke: string) => {
    ctx.beginPath();
    ctx.moveTo(xOf(0), lBot);
    for (let i = 0; i < n; i++) ctx.lineTo(xOf(i), yLevel(ys[i]));
    ctx.lineTo(xOf(n - 1), lBot);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      if (i === 0) ctx.moveTo(xOf(i), yLevel(ys[i]));
      else ctx.lineTo(xOf(i), yLevel(ys[i]));
    }
    ctx.stroke();
  };
  area(r.inputPeakDb, 'rgba(251,113,133,0.16)', 'rgba(251,113,133,0.7)');
  area(r.outputPeakDb, 'rgba(45,212,191,0.28)', 'rgba(45,212,191,0.95)');

  // Ceiling.
  ctx.strokeStyle = '#fbbf24';
  ctx.setLineDash([6, 4]);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(padL, yLevel(ceiling.value));
  ctx.lineTo(w - padR, yLevel(ceiling.value));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = '#fbbf24';
  ctx.fillText(`CEILING ${signedDb(ceiling.value)} dBTP`, w - padR - 4, yLevel(ceiling.value) - 3);

  // Legend.
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const legend = (x: number, color: string, text: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, lTop + 4, 10, 3);
    ctx.fillStyle = 'rgba(226,242,240,0.85)';
    ctx.fillText(text, x + 14, lTop + 5);
  };
  legend(padL + 6, 'rgba(251,113,133,0.9)', 'INPUT + DRIVE');
  legend(padL + 112, 'rgba(45,212,191,0.95)', 'OUTPUT');

  // Gain-reduction trace.
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath();
  ctx.moveTo(padL, gTop);
  ctx.lineTo(w - padR, gTop);
  ctx.stroke();
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(186,230,224,0.5)';
  ctx.fillText('GR 0', padL - 6, gTop);
  ctx.fillText(`${signedDb(GR_MIN, 0)}`, padL - 6, gBot);
  ctx.beginPath();
  ctx.moveTo(xOf(0), gTop);
  for (let i = 0; i < n; i++) ctx.lineTo(xOf(i), yGr(r.gainReductionDb[i]));
  ctx.lineTo(xOf(n - 1), gTop);
  ctx.closePath();
  ctx.fillStyle = 'rgba(167,139,250,0.4)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(196,181,253,0.95)';
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    if (i === 0) ctx.moveTo(xOf(i), yGr(r.gainReductionDb[i]));
    else ctx.lineTo(xOf(i), yGr(r.gainReductionDb[i]));
  }
  ctx.stroke();

  // Playback marker with the gain reduction at that moment.
  if (isPlaying.value) {
    const i = Math.min(n - 1, Math.max(0, Math.round(progress.value * (n - 1))));
    const x = xOf(i);
    ctx.strokeStyle = 'rgba(251,191,36,0.8)';
    ctx.beginPath();
    ctx.moveTo(x, lTop);
    ctx.lineTo(x, gBot);
    ctx.stroke();
    ctx.fillStyle = '#c4b5fd';
    ctx.beginPath();
    ctx.arc(x, yGr(r.gainReductionDb[i]), 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.textAlign = x > w * 0.7 ? 'right' : 'left';
    ctx.fillStyle = 'rgba(226,242,240,0.9)';
    ctx.fillText(
      `${signedDb(r.gainReductionDb[i])} dB`,
      x + (x > w * 0.7 ? -8 : 8),
      yGr(r.gainReductionDb[i]),
    );
  } else {
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(226,242,240,0.85)';
    ctx.fillText(
      `MAX GR ${signedDb(maxGr.value)} dB · RMS ${signedDb(r.outputRmsDb - baseRmsDb)} dB`,
      padL + 6,
      gBot - 8,
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
    if (!clip) {
      const loaded = await loadClip(clipName.value);
      if (disposed()) return;
      clip = loaded;
      // Output RMS is reported against the clip limited at 0 dB drive.
      baseRmsDb = runLimiter(wasm, clip.samples, clip.sampleRate, 0, ceiling.value).outputRmsDb;
    }
    run.value = runLimiter(wasm, clip.samples, clip.sampleRate, drive.value, ceiling.value);
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
  await play(props.def.id, { samples: r.output, sampleRate: r.sampleRate });
}

watch(drive, () => {
  // The buffer belongs to the previous drive; stop rather than let it mislabel the plot.
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
    eyebrow="MAXIMIZER · TRUE PEAK LIMITER"
    :title="title"
    :caption="caption"
    :state="stateLabel"
    :tone="tone"
    :playing="isPlaying"
    :progress="progress"
    :disabled="status !== 'ready'"
    :error="status === 'error' ? errorMsg : null"
    loading-label="LIMITING…"
    :show-playhead="false"
    axis-time="TIME →"
    @toggle="onPlay"
  >
    <template #screen>
      <canvas ref="canvas" class="lm-canvas" />
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
.lm-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
</style>
