<script setup lang="ts">
/**
 * `clarity-split` archetype: move the early/late boundary over an impulse
 * response and watch the clarity value it defines.
 *
 * The IR is the shared shoebox room (`roomRir.ts`), drawn as energy per 2 ms
 * after the direct sound. Bars before the boundary count as early, after it as
 * late; the readout is 10·log10(early/late) at the boundary (`clarityMath.ts`).
 * The 50 and 80 ms marks carry the engine's own C50 and C80 from
 * `analyzeImpulseResponse`, which the movable split reproduces when it sits on
 * them. Play auditions a clap in the same room.
 */
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import type { SonareDemoDef } from '@/demos/inline/types';
import { useSonareDemoAudio } from '@/demos/inline/useSonareDemoAudio';
import { prepareCanvas2D } from '@/utils/canvas';
import { useCanvasRedraw, useDemoChrome, useDemoParams, useDisposed } from '../composables';
import DemoControls from '../DemoControls.vue';
import DemoFrame from '../DemoFrame.vue';
import {
  CLARITY_ROOMS,
  type ClarityRoom,
  energyBinsDb,
  renderClarityRoom,
  splitEnergy,
} from './clarityMath';
import { clapThroughRir } from './roomRir';

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

const room = computed<ClarityRoom>(() => {
  const v = String(values.room ?? 'medium');
  return v in CLARITY_ROOMS ? (v as ClarityRoom) : 'medium';
});
const splitMs = computed(() => Number(values.split ?? 50));

const BIN_MS = 2;
const SPAN_MS = 300;
const FLOOR_DB = -60;

const ir = shallowRef<{ rir: Float32Array; sampleRate: number } | null>(null);
let clap: Float32Array | null = null;
const bins = ref<Float32Array>(new Float32Array(0));
const engine = ref<{ c50: number; c80: number; d50: number } | null>(null);
const split = computed(() =>
  ir.value ? splitEnergy(ir.value.rir, ir.value.sampleRate, splitMs.value) : null,
);
const dispSplitMs = ref(50);

function signedDb(v: number): string {
  const s = (Math.abs(v) < 0.05 ? 0 : v).toFixed(1);
  return v > 0 && Number(s) !== 0 ? `+${s}` : s.startsWith('-') ? `−${s.slice(1)}` : s;
}

const stateLabel = computed(() => {
  if (status.value === 'loading') return 'TRACING';
  if (status.value === 'error') return 'ERROR';
  const s = split.value;
  if (!s) return 'IDLE';
  return `C${Math.round(splitMs.value)} ${signedDb(s.clarityDb)} dB · EARLY ${Math.round(s.earlyFraction * 100)}%`;
});

// ---- paint -----------------------------------------------------------------
function paint(): void {
  const frame = prepareCanvas2D(canvas.value);
  const b = bins.value;
  if (!frame || b.length === 0) return;
  const { ctx, width: w, height: h } = frame;
  ctx.font = '9px "JetBrains Mono", ui-monospace, monospace';

  const padL = 40;
  const padR = 12;
  const top = 34;
  const bottom = h - 18;
  const xOfMs = (ms: number) => padL + (ms / SPAN_MS) * (w - padL - padR);
  const yOfDb = (d: number) => bottom - ((d - FLOOR_DB) / -FLOOR_DB) * (bottom - top);

  // dB grid.
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (const d of [0, -20, -40, -60]) {
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.moveTo(padL, yOfDb(d));
    ctx.lineTo(w - padR, yOfDb(d));
    ctx.stroke();
    ctx.fillStyle = 'rgba(186,230,224,0.5)';
    ctx.fillText(d === 0 ? '0 dB' : `−${-d}`, padL - 6, yOfDb(d));
  }

  // Energy bars, coloured by which side of the boundary they fall on.
  const barW = Math.max(1, xOfMs(BIN_MS) - xOfMs(0) - 0.6);
  for (let k = 0; k < b.length; k++) {
    const ms = k * BIN_MS;
    const early = ms < dispSplitMs.value;
    ctx.fillStyle = early ? 'rgba(45,212,191,0.85)' : 'rgba(167,139,250,0.7)';
    const y = yOfDb(b[k]);
    ctx.fillRect(xOfMs(ms), y, barW, bottom - y);
  }

  // The engine's fixed C50 / C80 marks.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const e = engine.value;
  for (const [ms, label] of [
    [50, e ? `C50 ${signedDb(e.c50)}` : 'C50'],
    [80, e ? `C80 ${signedDb(e.c80)}` : 'C80'],
  ] as const) {
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(xOfMs(ms), top);
    ctx.lineTo(xOfMs(ms), bottom);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(226,242,240,0.75)';
    ctx.fillText(label, xOfMs(ms), bottom + 4);
  }
  for (const ms of [150, 200, 250, 300]) {
    ctx.fillStyle = 'rgba(186,230,224,0.4)';
    ctx.fillText(`${ms} ms`, xOfMs(ms) - (ms === 300 ? 14 : 0), bottom + 4);
  }

  // The movable boundary.
  const sx = xOfMs(dispSplitMs.value);
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(sx, top - 4);
  ctx.lineTo(sx, bottom);
  ctx.stroke();
  ctx.lineWidth = 1;

  // Early/late balance bar across the top.
  const s = split.value;
  if (s) {
    const bw = w - padL - padR;
    const ew = bw * s.earlyFraction;
    ctx.fillStyle = 'rgba(45,212,191,0.85)';
    ctx.fillRect(padL, 8, ew, 10);
    ctx.fillStyle = 'rgba(167,139,250,0.7)';
    ctx.fillRect(padL + ew, 8, bw - ew, 10);
    ctx.fillStyle = 'rgba(10,20,24,0.9)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    if (ew > 60) ctx.fillText(`EARLY ${Math.round(s.earlyFraction * 100)}%`, padL + 4, 13);
    ctx.textAlign = 'right';
    if (bw - ew > 60)
      ctx.fillText(`LATE ${Math.round((1 - s.earlyFraction) * 100)}%`, w - padR - 4, 13);
    ctx.textAlign = sx > w * 0.7 ? 'right' : 'left';
    ctx.fillStyle = '#fbbf24';
    ctx.fillText(
      `C${Math.round(splitMs.value)} = ${signedDb(s.clarityDb)} dB`,
      sx + (sx > w * 0.7 ? -8 : 8),
      top + 6,
    );
  }
  ctx.textAlign = 'left';
}

useCanvasRedraw(canvas, paint);

let morphRaf = 0;
function startMorph(): void {
  if (morphRaf) return;
  const step = () => {
    const d = splitMs.value - dispSplitMs.value;
    dispSplitMs.value += d * 0.3;
    if (Math.abs(d) < 0.2) dispSplitMs.value = splitMs.value;
    paint();
    morphRaf = dispSplitMs.value !== splitMs.value ? requestAnimationFrame(step) : 0;
  };
  morphRaf = requestAnimationFrame(step);
}

// ---- engine ----------------------------------------------------------------
const disposed = useDisposed();

async function compute(): Promise<void> {
  if (disposed()) return;
  try {
    status.value = 'loading';
    const wasm = await ensureWasm();
    if (disposed()) return;
    const r = renderClarityRoom(wasm, room.value);
    clap = null;
    const a = wasm.analyzeImpulseResponse(r.rir, r.sampleRate);
    engine.value = { c50: a.c50, c80: a.c80, d50: a.d50 };
    bins.value = energyBinsDb(r.rir, r.sampleRate, BIN_MS, SPAN_MS, FLOOR_DB);
    ir.value = r;
    status.value = 'ready';
    dispSplitMs.value = splitMs.value;
    paint();
  } catch (e) {
    if (disposed()) return;
    fail(e);
  }
}

async function onPlay(): Promise<void> {
  const r = ir.value;
  if (!r) return;
  if (!clap) clap = clapThroughRir(r.rir, r.sampleRate);
  await play(props.def.id, { samples: clap, sampleRate: r.sampleRate });
}

watch(splitMs, () => {
  if (status.value === 'ready') startMorph();
});
watch(room, () => {
  if (isPlaying.value) stop();
  if (status.value !== 'idle') compute();
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
});
</script>

<template>
  <DemoFrame
    eyebrow="ROOM · EARLY / LATE SPLIT"
    :title="title"
    :caption="caption"
    :state="stateLabel"
    :tone="tone"
    :playing="isPlaying"
    :progress="progress"
    :disabled="status !== 'ready'"
    :error="status === 'error' ? errorMsg : null"
    loading-label="TRACING…"
    :show-playhead="false"
    axis-time="TIME AFTER DIRECT SOUND →"
    @toggle="onPlay"
  >
    <template #screen>
      <canvas ref="canvas" class="cs-canvas" />
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
.cs-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
</style>
