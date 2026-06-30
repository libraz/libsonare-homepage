<script setup lang="ts">
/**
 * `meters` archetype: show how loudness metering reads a piece of program material.
 *
 * The big bar on the left is a live loudness meter; the panel on the right is the
 * loudness contour over time. Press play and the bar tracks the *momentary* loudness
 * of what you hear while the playhead sweeps the contour — a peak-hold marks the
 * loudest moment. The readouts give the single numbers an engineer ships against:
 * integrated LUFS (overall loudness), true-peak (the real ceiling), and LRA (how much
 * the loudness varies). Switch the window to compare fast momentary metering with the
 * slower short-term measure.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useSonareDemoAudio } from '@/composables/useSonareDemoAudio';
import type { SonareDemoDef } from '@/demos/types';
import { prepareCanvas2D } from '../canvas';
import { useDemoChrome, useDemoParams } from '../composables';
import DemoControls from '../DemoControls.vue';
import DemoFrame from '../DemoFrame.vue';

const props = defineProps<{ def: SonareDemoDef; active: boolean }>();

const { ensureWasm, loadClip, play, playingId, progress } = useSonareDemoAudio();

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

const windowMode = computed<string>(() => String(values.window ?? 'momentary'));
const clipName = computed(() => (props.def.source.kind === 'clip' ? props.def.source.clip : ''));

// ---- presentation state ----------------------------------------------------
const integrated = ref(0);
const truePeak = ref(0);
const lra = ref(0);

const stateLabel = computed(() => {
  if (status.value === 'loading') return 'METERING';
  if (status.value === 'error') return 'ERROR';
  if (isPlaying.value) return `▸ ${Math.round(progress.value * 100)}%`;
  if (status.value === 'ready') return `${integrated.value.toFixed(1)} LUFS`;
  return 'IDLE';
});

// ---- meter data ------------------------------------------------------------
const LO = -40; // LUFS axis bottom
const HI = 0; // LUFS axis top
const COLS = 240;
const dispContour = new Float32Array(COLS); // 0..1 normalized fill height
const targetContour = new Float32Array(COLS);
let peakHold = 0; // max momentary fill seen during the current playback

let clip: { samples: Float32Array; sampleRate: number } | null = null;
const reveal = ref(0);

type WasmModule = Awaited<ReturnType<typeof ensureWasm>>;

/** Map a LUFS value to a 0..1 meter fill. */
function fill(lufsValue: number): number {
  return Math.max(0, Math.min(1, (lufsValue - LO) / (HI - LO)));
}

/** Resample a loudness series to COLS, converting each value to a meter fill. */
function fillContour(series: Float32Array): void {
  const n = series.length;
  for (let c = 0; c < COLS; c++) {
    const idx = n <= 1 ? 0 : (c / (COLS - 1)) * (n - 1);
    const i0 = Math.floor(idx);
    const frac = idx - i0;
    const v = i0 + 1 < n ? series[i0] * (1 - frac) + series[i0 + 1] * frac : series[i0];
    // Loudness can be -inf for silence; clamp to the axis floor.
    targetContour[c] = fill(Number.isFinite(v) ? v : LO);
  }
}

async function compute(): Promise<void> {
  try {
    if (status.value === 'idle') status.value = 'loading';
    const wasm = await ensureWasm();
    if (!clip) clip = await loadClip(clipName.value);
    const { samples, sampleRate } = clip;
    const summary = wasm.lufs(samples, sampleRate);
    integrated.value = summary.integratedLufs;
    lra.value = summary.loudnessRange;
    truePeak.value = wasm.meteringTruePeakDb(samples, sampleRate);
    const series =
      windowMode.value === 'short-term'
        ? wasm.shortTermLufs(samples, sampleRate)
        : wasm.momentaryLufs(samples, sampleRate);
    fillContour(series);
    status.value = 'ready';
    startMorph();
  } catch (e) {
    fail(e);
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
    for (let c = 0; c < COLS; c++) {
      const d = targetContour[c] - dispContour[c];
      dispContour[c] += d * 0.26;
      delta = Math.max(delta, Math.abs(d));
    }
    paint();
    if (delta > 0.002) {
      rafId = requestAnimationFrame(step);
    } else {
      dispContour.set(targetContour);
      paint();
      rafId = 0;
    }
  };
  rafId = requestAnimationFrame(step);
}

// Live meter: repaint each frame while playing.
let playRaf = 0;
watch(isPlaying, (on) => {
  if (on) {
    peakHold = 0;
    if (!playRaf) {
      const step = () => {
        paint();
        playRaf = isPlaying.value ? requestAnimationFrame(step) : 0;
      };
      playRaf = requestAnimationFrame(step);
    }
  } else {
    paint();
  }
});

/** Colour for a meter fill level: green low, amber high, red near the ceiling. */
function meterColor(level: number): string {
  if (level > 0.85) return '#f87171';
  if (level > 0.7) return '#fbbf24';
  return '#2dd4bf';
}

function paint(): void {
  const frame = prepareCanvas2D(canvas.value);
  if (!frame) return;
  const { ctx, width: w, height: h } = frame;

  const top = 12;
  const bot = h - 20;
  const innerH = bot - top;
  const barX = 16;
  const barW = 34;
  const plotX = barX + barW + 26;
  const plotW = w - plotX - 14;

  const playT = isPlaying.value ? progress.value : -1;
  const playCol = playT >= 0 ? Math.min(COLS - 1, Math.round(playT * (COLS - 1))) : -1;

  // Current meter level: live momentary at rest shows integrated reference.
  let level = fill(integrated.value);
  if (playCol >= 0) {
    level = dispContour[playCol];
    if (level > peakHold) peakHold = level;
  }
  level *= reveal.value;

  // --- left: vertical loudness meter ---
  ctx.fillStyle = 'rgba(148, 163, 184, 0.12)';
  ctx.fillRect(barX, top, barW, innerH);
  const barTopY = bot - level * innerH;
  const grad = ctx.createLinearGradient(0, bot, 0, top);
  grad.addColorStop(0, 'rgba(45, 212, 191, 0.85)');
  grad.addColorStop(0.7, 'rgba(45, 212, 191, 0.85)');
  grad.addColorStop(0.82, 'rgba(251, 191, 36, 0.9)');
  grad.addColorStop(1, 'rgba(248, 113, 113, 0.95)');
  ctx.fillStyle = grad;
  ctx.fillRect(barX, barTopY, barW, bot - barTopY);
  // Peak-hold tick.
  if (peakHold > 0) {
    const py = bot - peakHold * reveal.value * innerH;
    ctx.fillStyle = meterColor(peakHold);
    ctx.fillRect(barX - 2, py - 1.5, barW + 4, 2.5);
  }
  // Integrated reference line on the bar.
  const intY = bot - fill(integrated.value) * innerH;
  ctx.strokeStyle = 'rgba(226, 232, 240, 0.75)';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 2]);
  ctx.beginPath();
  ctx.moveTo(barX - 3, intY);
  ctx.lineTo(barX + barW + 3, intY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Scale ticks (LUFS).
  ctx.font = '8px "JetBrains Mono", ui-monospace, monospace';
  ctx.fillStyle = 'rgba(186, 230, 224, 0.55)';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';
  for (const v of [0, -9, -18, -27, -36]) {
    const y = bot - fill(v) * innerH;
    ctx.fillText(`${v}`, barX - 4, y);
  }
  ctx.textAlign = 'left';

  // --- right: loudness contour over time ---
  const grad2 = ctx.createLinearGradient(0, top, 0, bot);
  grad2.addColorStop(0, 'rgba(45, 212, 191, 0.4)');
  grad2.addColorStop(1, 'rgba(45, 212, 191, 0.03)');
  ctx.beginPath();
  ctx.moveTo(plotX, bot);
  for (let c = 0; c < COLS; c++) {
    const x = plotX + (c / (COLS - 1)) * plotW;
    ctx.lineTo(x, bot - dispContour[c] * innerH * reveal.value);
  }
  ctx.lineTo(plotX + plotW, bot);
  ctx.closePath();
  ctx.fillStyle = grad2;
  ctx.fill();

  // Contour line; passed portion brightens during playback.
  ctx.lineWidth = 1.5;
  ctx.lineJoin = 'round';
  for (let c = 1; c < COLS; c++) {
    const x0 = plotX + ((c - 1) / (COLS - 1)) * plotW;
    const y0 = bot - dispContour[c - 1] * innerH * reveal.value;
    const x1 = plotX + (c / (COLS - 1)) * plotW;
    const y1 = bot - dispContour[c] * innerH * reveal.value;
    ctx.strokeStyle = playCol >= 0 && c <= playCol ? '#5eead4' : 'rgba(45, 212, 191, 0.55)';
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }

  // Integrated reference across the plot.
  ctx.strokeStyle = 'rgba(226, 232, 240, 0.4)';
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(plotX, intY);
  ctx.lineTo(plotX + plotW, intY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Playhead marker on the contour.
  if (playCol >= 0) {
    const x = plotX + (playCol / (COLS - 1)) * plotW;
    const y = bot - dispContour[playCol] * innerH * reveal.value;
    ctx.fillStyle = '#5eead4';
    ctx.shadowColor = 'rgba(94, 234, 212, 0.9)';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Readouts (top-right corner).
  ctx.font = '9px "JetBrains Mono", ui-monospace, monospace';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(226, 232, 240, 0.85)';
  ctx.fillText(`INT ${integrated.value.toFixed(1)} LUFS`, plotX + plotW, top - 4);
  ctx.fillStyle = truePeak.value > -1 ? 'rgba(251, 191, 36, 0.95)' : 'rgba(186, 230, 224, 0.7)';
  ctx.fillText(
    `TP ${truePeak.value >= 0 ? '+' : ''}${truePeak.value.toFixed(1)} dBTP`,
    plotX + plotW,
    top + 9,
  );
  ctx.fillStyle = 'rgba(186, 230, 224, 0.7)';
  ctx.fillText(`LRA ${lra.value.toFixed(1)} LU`, plotX + plotW, top + 22);
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(186, 230, 224, 0.5)';
  ctx.textBaseline = 'bottom';
  ctx.fillText('LUFS', barX - 4, bot + 16);
}

async function onPlay(): Promise<void> {
  if (!clip) await compute();
  if (clip) await play(props.def.id, clip);
}

// Coalesce rapid window-mode changes into one analysis per frame.
let pending = 0;
function scheduleCompute(): void {
  if (pending) return;
  pending = requestAnimationFrame(() => {
    pending = 0;
    compute();
  });
}

watch(windowMode, () => {
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
    eyebrow="METERS · LOUDNESS"
    :title="title"
    :caption="caption"
    :state="stateLabel"
    :tone="tone"
    :playing="isPlaying"
    :progress="progress"
    :disabled="status === 'loading'"
    :error="status === 'error' ? errorMsg : null"
    loading-label="METERING…"
    :show-playhead="false"
    @toggle="onPlay"
  >
    <template #screen>
      <canvas ref="canvas" class="mt-canvas" />
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
.mt-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
</style>
