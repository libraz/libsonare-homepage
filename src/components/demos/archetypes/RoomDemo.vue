<script setup lang="ts">
/**
 * `room` archetype: synthesize a room impulse response and show how it decays.
 *
 * `synthesizeRir` turns shoebox dimensions + absorption into a mono RIR. We draw
 * its energy-decay curve on a dB scale — the classic reverberation picture — and
 * mark the estimated RT60 (time to fall 60 dB). Make the room bigger or the walls
 * less absorptive and the tail visibly stretches; the RT60 readout climbs with it.
 * Pressing play convolves a short synthesized clap with the RIR, so you hear the
 * very room on screen. No measured IR, no external asset.
 */
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useSonareDemoAudio } from '@/composables/useSonareDemoAudio';
import { type DemoLocale, localized, type SonareDemoDef } from '@/demos/types';
import DemoControls from '../DemoControls.vue';
import DemoFrame from '../DemoFrame.vue';

const props = defineProps<{ def: SonareDemoDef; active: boolean }>();

const { locale } = useI18n();
const { ensureWasm, play, playingId, progress } = useSonareDemoAudio();

const loc = computed<DemoLocale>(() => locale.value);
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

const size = computed<number>(() => Number(values.size ?? 7));
const absorption = computed<number>(() => Number(values.absorption ?? 0.16));

// ---- presentation state ----------------------------------------------------
const rt60 = ref(0);
const tone = computed(() => {
  if (status.value === 'error') return 'error' as const;
  if (status.value === 'loading') return 'loading' as const;
  if (isPlaying.value) return 'playing' as const;
  if (status.value === 'ready') return 'ready' as const;
  return 'idle' as const;
});
const stateLabel = computed(() => {
  if (status.value === 'loading') return 'TRACING';
  if (status.value === 'error') return 'ERROR';
  if (isPlaying.value) return `▸ ${Math.round(progress.value * 100)}%`;
  if (status.value === 'ready') return `RT60 ≈ ${rt60.value.toFixed(2)} s`;
  return 'IDLE';
});

// ---- RIR synthesis + decay analysis ----------------------------------------
const DISPLAY_SEC = 1.8; // fixed time axis so tails are comparable
const COLS = 240;
const dispEnv = new Float32Array(COLS);
const targetEnv = new Float32Array(COLS);

let lastAudio: { samples: Float32Array; sampleRate: number } | null = null;
let lastRir: Float32Array | null = null;
let lastSr = 48000;

type WasmModule = Awaited<ReturnType<typeof ensureWasm>>;

/** Map the size slider to shoebox dimensions and synthesize a mono RIR. */
function renderRir(wasm: WasmModule): { rir: Float32Array; sampleRate: number } {
  const lengthM = size.value;
  const widthM = size.value * 0.72;
  const heightM = Math.min(6, Math.max(2.4, size.value * 0.42));
  const r = wasm.synthesizeRir({
    lengthM,
    widthM,
    heightM,
    absorption: absorption.value,
    sourceX: lengthM * 0.28,
    sourceY: widthM * 0.3,
    sourceZ: 1.3,
    listenerX: lengthM * 0.68,
    listenerY: widthM * 0.62,
    listenerZ: 1.3,
    sampleRate: 48000,
    maxSeconds: DISPLAY_SEC + 0.2,
  });
  if (r.hasError || !r.rir.length) {
    throw new Error('source/listener fell outside the room');
  }
  return { rir: r.rir, sampleRate: r.sampleRate };
}

/**
 * Build the Schroeder energy-decay curve (EDC) and estimate RT60 from it.
 *
 * The EDC is the backward-integrated energy of the RIR, normalized to the total.
 * Unlike a per-window peak envelope it is monotonically decreasing, so the gap
 * between the direct sound and the first reflections in a large room can't be
 * mistaken for the −60 dB crossing. RT60 is the time the EDC falls 60 dB.
 */
function fillTargets(rir: Float32Array, sr: number): void {
  const n = rir.length;
  const edc = new Float64Array(n);
  let acc = 0;
  for (let i = n - 1; i >= 0; i--) {
    acc += rir[i] * rir[i];
    edc[i] = acc;
  }
  const total = edc[0] + 1e-20;
  const totalSamp = Math.round(sr * DISPLAY_SEC);
  let crossCol = COLS;
  for (let c = 0; c < COLS; c++) {
    const idx = Math.floor((c / (COLS - 1)) * (totalSamp - 1));
    const e = idx < n ? edc[idx] : 0;
    const db = 10 * Math.log10(e / total + 1e-12);
    const hgt = Math.max(0, Math.min(1, (db + 60) / 60));
    targetEnv[c] = hgt;
    if (crossCol === COLS && hgt <= 0.001) crossCol = c;
  }
  rt60.value = (crossCol / COLS) * DISPLAY_SEC;
}

async function compute(): Promise<void> {
  try {
    if (status.value === 'idle') status.value = 'loading';
    const wasm = await ensureWasm();
    const { rir, sampleRate } = renderRir(wasm);
    lastRir = rir;
    lastSr = sampleRate;
    lastAudio = null; // audition rebuilt lazily for the new room
    fillTargets(rir, sampleRate);
    status.value = 'ready';
    startMorph();
  } catch (e) {
    status.value = 'error';
    errorMsg.value = e instanceof Error ? e.message : String(e);
  }
}

// ---- morph + paint loop ----------------------------------------------------
let rafId = 0;

function startMorph(): void {
  if (rafId) return;
  const step = () => {
    let delta = 0;
    for (let c = 0; c < COLS; c++) {
      const d = targetEnv[c] - dispEnv[c];
      dispEnv[c] += d * 0.24;
      delta = Math.max(delta, Math.abs(d));
    }
    paint();
    if (delta > 0.002) {
      rafId = requestAnimationFrame(step);
    } else {
      dispEnv.set(targetEnv);
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

/** Draw the dB energy-decay curve with an RT60 marker. */
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

  const padX = 16;
  const innerW = w - padX * 2;
  const top = 16;
  const bot = h - 18;
  const innerH = bot - top;

  // Filled decay area under the curve.
  const grad = ctx.createLinearGradient(0, top, 0, bot);
  grad.addColorStop(0, 'rgba(45, 212, 191, 0.55)');
  grad.addColorStop(1, 'rgba(45, 212, 191, 0.04)');
  ctx.beginPath();
  ctx.moveTo(padX, bot);
  for (let c = 0; c < COLS; c++) {
    const x = padX + (c / (COLS - 1)) * innerW;
    ctx.lineTo(x, bot - dispEnv[c] * innerH);
  }
  ctx.lineTo(padX + innerW, bot);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Decay curve.
  ctx.strokeStyle = '#2dd4bf';
  ctx.lineWidth = 1.8;
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(45, 212, 191, 0.6)';
  ctx.shadowBlur = 6;
  ctx.beginPath();
  for (let c = 0; c < COLS; c++) {
    const x = padX + (c / (COLS - 1)) * innerW;
    const y = bot - dispEnv[c] * innerH;
    c === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;

  // RT60 marker (vertical line where the decay reaches -60 dB).
  if (rt60.value > 0 && rt60.value < DISPLAY_SEC) {
    const mx = padX + (rt60.value / DISPLAY_SEC) * innerW;
    ctx.strokeStyle = 'rgba(255, 184, 108, 0.9)';
    ctx.lineWidth = 1.4;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(mx, top);
    ctx.lineTo(mx, bot);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255, 196, 128, 0.95)';
    ctx.font = '9px "JetBrains Mono", ui-monospace, monospace';
    ctx.textBaseline = 'top';
    ctx.fillText('RT60', mx + 4, top);
  }

  // Axis labels.
  ctx.font = '9px "JetBrains Mono", ui-monospace, monospace';
  ctx.fillStyle = 'rgba(186, 230, 224, 0.5)';
  ctx.textBaseline = 'top';
  ctx.fillText('0 dB', padX, top - 3);
  ctx.textBaseline = 'bottom';
  ctx.fillText('-60 dB', padX, bot + 14);
  ctx.textAlign = 'right';
  ctx.fillText(`${DISPLAY_SEC.toFixed(1)} s`, padX + innerW, bot + 14);
  ctx.textAlign = 'left';
}

// ---- audition: a short clap convolved with the RIR -------------------------
/** Convolve a brief synthesized clap with the current RIR; normalize for play. */
function buildClap(rir: Float32Array, sr: number): Float32Array {
  const bn = Math.round(sr * 0.006);
  const burst = new Float32Array(bn);
  let s = 0x9e3779b9 >>> 0;
  const rand = (): number => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = 0; i < bn; i++) burst[i] = (rand() * 2 - 1) * (1 - i / bn);

  const out = new Float32Array(rir.length + bn - 1);
  for (let i = 0; i < bn; i++) {
    const b = burst[i];
    if (Math.abs(b) < 1e-5) continue;
    for (let j = 0; j < rir.length; j++) out[i + j] += b * rir[j];
  }
  let pk = 1e-6;
  for (let i = 0; i < out.length; i++) pk = Math.max(pk, Math.abs(out[i]));
  const g = 0.75 / pk;
  for (let i = 0; i < out.length; i++) out[i] *= g;
  return out;
}

async function onPlay(): Promise<void> {
  if (!lastRir) {
    const wasm = await ensureWasm();
    const { rir, sampleRate } = renderRir(wasm);
    lastRir = rir;
    lastSr = sampleRate;
  }
  if (!lastAudio) {
    lastAudio = { samples: buildClap(lastRir, lastSr), sampleRate: lastSr };
  }
  await play(props.def.id, lastAudio);
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

watch(
  () => [size.value, absorption.value],
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
    eyebrow="ROOM · IMPULSE RESPONSE"
    :title="title"
    :caption="caption"
    :state="stateLabel"
    :tone="tone"
    :playing="isPlaying"
    :progress="progress"
    :disabled="status === 'loading'"
    :error="status === 'error' ? errorMsg : null"
    loading-label="TRACING…"
    :show-playhead="isPlaying"
    @toggle="onPlay"
  >
    <template #screen>
      <canvas ref="canvas" class="rm-canvas" />
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
.rm-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
</style>
