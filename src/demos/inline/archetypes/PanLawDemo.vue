<script setup lang="ts">
/**
 * `pan-law` archetype: what each pan law does to level as a source moves across.
 *
 * Every curve is measured from a `Mixer` strip (see `panLawMath.ts`): the top
 * panel plots the left and right gains against pan position, the bottom panel the
 * total power and the coherent mono sum in dB against a hard pan, with the other
 * laws ghosted for comparison. Play sweeps a mono noise source from hard left to
 * hard right through the same strip, and a marker rides the curves in step.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { generateSignal } from '@/demos/inline/signal';
import type { SonareDemoDef } from '@/demos/inline/types';
import { useSonareDemoAudio } from '@/demos/inline/useSonareDemoAudio';
import { prepareCanvas2D } from '@/utils/canvas';
import { useCanvasRedraw, useDemoChrome, useDemoParams, useDisposed } from '../composables';
import DemoControls from '../DemoControls.vue';
import DemoFrame from '../DemoFrame.vue';
import {
  measurePanCurve,
  monoSumDb,
  PAN_LAWS,
  PAN_MODES,
  type PanCurve,
  type PanLawId,
  type PanModeId,
  powerDb,
  renderPanSweep,
} from './panLawMath';

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

const law = computed<PanLawId>(() => {
  const v = String(values.law ?? 'const3dB');
  return (PAN_LAWS as readonly string[]).includes(v) ? (v as PanLawId) : 'const3dB';
});
const mode = computed<PanModeId>(() =>
  String(values.mode ?? 'stereoPan') === 'balance' ? 'balance' : 'stereoPan',
);

const POINTS = 41;
const CENTER = (POINTS - 1) / 2;
type CurveKey = `${PanModeId}:${PanLawId}`;
const curves = new Map<CurveKey, PanCurve>();
let wasmRef: Awaited<ReturnType<typeof ensureWasm>> | null = null;

// Displayed curves ease toward the selected law's measurement.
const dispL = new Float32Array(POINTS);
const dispR = new Float32Array(POINTS);

function target(): PanCurve | undefined {
  return curves.get(`${mode.value}:${law.value}`);
}

function db(v: number): string {
  if (v <= 1e-6) return '−∞';
  const d = 20 * Math.log10(v);
  const s = (Math.abs(d) < 0.05 ? 0 : d).toFixed(1);
  return s.startsWith('-') ? `−${s.slice(1)}` : s;
}

const playPan = computed(() => -1 + 2 * Math.max(0, Math.min(1, progress.value)));

const stateLabel = computed(() => {
  if (status.value === 'loading') return 'MEASURING';
  if (status.value === 'error') return 'ERROR';
  if (isPlaying.value) {
    const p = playPan.value;
    return `PAN ${p >= 0 ? '+' : '−'}${Math.abs(p).toFixed(2)}`;
  }
  const c = target();
  if (status.value === 'ready' && c) return `CENTER ${db(c.left[CENTER])} dB / CH`;
  return 'IDLE';
});

// ---- paint -----------------------------------------------------------------
const C_LEFT = '#2dd4bf';
const C_RIGHT = '#a78bfa';
const C_POWER = '#fbbf24';
const C_MONO = '#38bdf8';
const DB_MIN = -4;
const DB_MAX = 7;

function sampleAt(arr: Float32Array, pan: number): number {
  const x = ((pan + 1) / 2) * (POINTS - 1);
  const i = Math.max(0, Math.min(POINTS - 2, Math.floor(x)));
  const t = x - i;
  return arr[i] * (1 - t) + arr[i + 1] * t;
}

function paint(): void {
  const frame = prepareCanvas2D(canvas.value);
  if (!frame) return;
  const { ctx, width: w, height: h } = frame;
  ctx.font = '9px "JetBrains Mono", ui-monospace, monospace';

  const padL = 40;
  const padR = 14;
  const top = 16;
  const bottom = h - 18;
  const gap = 18;
  const split = top + (bottom - top) * 0.44;
  const gTop = top;
  const gBot = split - gap / 2;
  const dTop = split + gap / 2;
  const dBot = bottom;
  const xOf = (pan: number) => padL + ((pan + 1) / 2) * (w - padL - padR);
  const yGain = (g: number) => gBot - (Math.min(1.05, g) / 1.05) * (gBot - gTop);
  const yDb = (d: number) =>
    dBot - ((Math.max(DB_MIN, Math.min(DB_MAX, d)) - DB_MIN) / (DB_MAX - DB_MIN)) * (dBot - dTop);

  // Grid and axis labels.
  ctx.lineWidth = 1;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';
  for (const g of [0, 0.5, 1]) {
    ctx.strokeStyle = g === 1 ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.07)';
    ctx.beginPath();
    ctx.moveTo(padL, yGain(g));
    ctx.lineTo(w - padR, yGain(g));
    ctx.stroke();
    ctx.fillStyle = 'rgba(186,230,224,0.5)';
    ctx.fillText(g.toFixed(1), padL - 6, yGain(g));
  }
  for (const d of [-3, 0, 3, 6]) {
    ctx.strokeStyle = d === 0 ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.07)';
    ctx.beginPath();
    ctx.moveTo(padL, yDb(d));
    ctx.lineTo(w - padR, yDb(d));
    ctx.stroke();
    ctx.fillStyle = 'rgba(186,230,224,0.5)';
    ctx.fillText(`${d > 0 ? '+' : d < 0 ? '−' : ''}${Math.abs(d)} dB`, padL - 6, yDb(d));
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (const [pan, label] of [
    [-1, 'L'],
    [0, 'C'],
    [1, 'R'],
  ] as const) {
    ctx.strokeStyle = pan === 0 ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)';
    ctx.beginPath();
    ctx.moveTo(xOf(pan), gTop);
    ctx.lineTo(xOf(pan), dBot);
    ctx.stroke();
    ctx.fillStyle = 'rgba(186,230,224,0.6)';
    ctx.fillText(label, xOf(pan), dBot + 4);
  }

  const line = (ys: (i: number) => number, color: string, width: number, dash: number[] = []) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dash);
    ctx.beginPath();
    for (let i = 0; i < POINTS; i++) {
      const x = xOf(-1 + (2 * i) / (POINTS - 1));
      if (i === 0) ctx.moveTo(x, ys(i));
      else ctx.lineTo(x, ys(i));
    }
    ctx.stroke();
    ctx.setLineDash([]);
  };

  // The other laws in this mode, ghosted, so the selected one reads as a choice.
  for (const other of PAN_LAWS) {
    if (other === law.value) continue;
    const c = curves.get(`${mode.value}:${other}`);
    if (!c) continue;
    line((i) => yDb(powerDb(c.left[i], c.right[i])), 'rgba(251,191,36,0.16)', 1);
    line((i) => yDb(monoSumDb(c.left[i], c.right[i])), 'rgba(56,189,248,0.16)', 1);
  }

  line((i) => yGain(dispL[i]), C_LEFT, 2);
  line((i) => yGain(dispR[i]), C_RIGHT, 2);
  line((i) => yDb(powerDb(dispL[i], dispR[i])), C_POWER, 2);
  line((i) => yDb(monoSumDb(dispL[i], dispR[i])), C_MONO, 2, [5, 3]);

  // Legend.
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const legend = (x: number, y: number, color: string, text: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y - 1, 10, 2);
    ctx.fillStyle = 'rgba(226,242,240,0.85)';
    ctx.fillText(text, x + 14, y);
  };
  legend(padL + 6, gTop + 6, C_LEFT, 'LEFT GAIN');
  legend(padL + 86, gTop + 6, C_RIGHT, 'RIGHT GAIN');
  legend(padL + 6, dTop + 6, C_POWER, 'POWER L²+R²');
  legend(padL + 100, dTop + 6, C_MONO, 'MONO SUM L+R');

  // Marker: the sweep position while playing, the center otherwise.
  const pan = isPlaying.value ? playPan.value : 0;
  const x = xOf(pan);
  const l = sampleAt(dispL, pan);
  const r = sampleAt(dispR, pan);
  ctx.strokeStyle = isPlaying.value ? 'rgba(251,191,36,0.75)' : 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, gTop);
  ctx.lineTo(x, dBot);
  ctx.stroke();
  const dot = (y: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  };
  dot(yGain(l), C_LEFT);
  dot(yGain(r), C_RIGHT);
  dot(yDb(powerDb(l, r)), C_POWER);
  dot(yDb(monoSumDb(l, r)), C_MONO);

  // Readout beside the marker.
  ctx.textAlign = pan > 0.4 ? 'right' : 'left';
  const tx = pan > 0.4 ? x - 8 : x + 8;
  ctx.fillStyle = 'rgba(226,242,240,0.9)';
  ctx.fillText(`L ${l.toFixed(3)}  R ${r.toFixed(3)}`, tx, (gTop + gBot) / 2);
  const p = powerDb(l, r);
  const m = monoSumDb(l, r);
  const fmt = (d: number) => `${d >= 0.05 ? '+' : d <= -0.05 ? '−' : ''}${Math.abs(d).toFixed(1)}`;
  ctx.fillText(`PWR ${fmt(p)} dB  SUM ${fmt(m)} dB`, tx, (dTop + dBot) / 2 + 12);
  ctx.textAlign = 'left';
}

useCanvasRedraw(canvas, paint);

// ---- animation -------------------------------------------------------------
let morphRaf = 0;
function startMorph(): void {
  if (morphRaf) return;
  const step = () => {
    const c = target();
    let moving = false;
    if (c) {
      for (let i = 0; i < POINTS; i++) {
        const dl = c.left[i] - dispL[i];
        const dr = c.right[i] - dispR[i];
        dispL[i] += dl * 0.22;
        dispR[i] += dr * 0.22;
        if (Math.abs(dl) > 5e-4 || Math.abs(dr) > 5e-4) moving = true;
      }
      if (!moving) {
        dispL.set(c.left);
        dispR.set(c.right);
      }
    }
    paint();
    morphRaf = moving ? requestAnimationFrame(step) : 0;
  };
  morphRaf = requestAnimationFrame(step);
}

let playRaf = 0;
function startPlayLoop(): void {
  if (playRaf) return;
  const step = () => {
    paint();
    playRaf = isPlaying.value ? requestAnimationFrame(step) : 0;
    if (!playRaf) paint();
  };
  playRaf = requestAnimationFrame(step);
}
watch(isPlaying, (on) => {
  if (on) startPlayLoop();
  else paint();
});

// ---- engine ----------------------------------------------------------------
const disposed = useDisposed();

async function measure(): Promise<void> {
  status.value = 'loading';
  try {
    const wasm = await ensureWasm();
    if (disposed()) return;
    wasmRef = wasm;
    for (const m of PAN_MODES) {
      for (const l of PAN_LAWS) curves.set(`${m}:${l}`, measurePanCurve(wasm, l, m, POINTS));
    }
    const c = target();
    if (c) {
      // Open on a flat line at unity so the first law visibly settles into shape.
      dispL.fill(1);
      dispR.fill(1);
    }
    status.value = 'ready';
    startMorph();
  } catch (e) {
    if (disposed()) return;
    fail(e);
  }
}

async function onPlay(): Promise<void> {
  if (!wasmRef || props.def.source.kind !== 'generate') return;
  const src = generateSignal(props.def.source);
  await play(
    props.def.id,
    renderPanSweep(wasmRef, law.value, mode.value, src.samples, src.sampleRate),
  );
}

watch([law, mode], () => {
  // The sweep buffer belongs to one law and mode; stop rather than mislabel it.
  if (isPlaying.value) stop();
  if (status.value === 'ready') startMorph();
});

watch(
  () => props.active,
  (on) => {
    if (on && status.value === 'idle') measure();
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  if (morphRaf) cancelAnimationFrame(morphRaf);
  if (playRaf) cancelAnimationFrame(playRaf);
});
</script>

<template>
  <DemoFrame
    eyebrow="MIXER · PAN LAW"
    :title="title"
    :caption="caption"
    :state="stateLabel"
    :tone="tone"
    :playing="isPlaying"
    :progress="progress"
    :disabled="status !== 'ready'"
    :error="status === 'error' ? errorMsg : null"
    loading-label="MEASURING…"
    :show-playhead="false"
    @toggle="onPlay"
  >
    <template #screen>
      <canvas ref="canvas" class="pl-canvas" />
    </template>
    <template #controls>
      <DemoControls
        :model-value="values"
        :params="def.params ?? []"
        :locale="loc"
        :disabled="status !== 'ready'"
        @update:model-value="updateParams"
      />
    </template>
  </DemoFrame>
</template>

<style scoped>
.pl-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
</style>
