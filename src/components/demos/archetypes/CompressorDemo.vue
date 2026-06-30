<script setup lang="ts">
/**
 * `compressor` archetype: see — and hear — how a compressor's controls interact.
 *
 * Two panels share the screen. The left is the static transfer curve: input level
 * in, output level out, with the 1:1 reference, the threshold, and the soft knee
 * drawn on top, so threshold/ratio/knee read as one shape. The right is a fixed
 * test program (a steady bed with transient hits) showing the input envelope, the
 * compressed output, and the gain reduction between them — which is where attack
 * and release become visible. Pressing play auditions the compressed program, so
 * the pumping you see is the pumping you hear. Everything is computed in-browser;
 * no clip or WASM.
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

const threshold = computed<number>(() => Number(values.threshold ?? -18));
const ratio = computed<number>(() => Number(values.ratio ?? 4));
const knee = computed<number>(() => Number(values.knee ?? 6));
const attackMs = computed<number>(() => Number(values.attack ?? 15));
const releaseMs = computed<number>(() => Number(values.release ?? 160));
// Parallel-compression blend: 100% = fully compressed (the default, so demos without
// this param are unchanged); lower values mix the dry signal back in under the comp.
const mix = computed<number>(() => Number(values.mix ?? 100) / 100);

// ---- presentation state ----------------------------------------------------
const maxGr = ref(0);
const stateLabel = computed(() => {
  if (status.value === 'error') return 'ERROR';
  if (isPlaying.value) return `▸ ${Math.round(progress.value * 100)}%`;
  if (status.value === 'ready')
    return `${ratio.value.toFixed(1)}:1 · -${maxGr.value.toFixed(1)} dB`;
  return 'IDLE';
});

// ---- the model -------------------------------------------------------------
const DUR = 2.6; // test-program length in seconds
const COLS = 360; // time-grid columns for the envelope panel
const FLOOR_DB = -48; // bottom of both axes

/**
 * Soft-knee gain computer (Reiss & McPherson formulation): returns the target
 * output level in dB for an input level in dB, given threshold/ratio/knee.
 */
function gainComputer(xDb: number): number {
  const t = threshold.value;
  const r = Math.max(1, ratio.value);
  const w = Math.max(0.0001, knee.value);
  const over = xDb - t;
  if (2 * over < -w) return xDb;
  if (2 * Math.abs(over) <= w) {
    return xDb + ((1 / r - 1) * (over + w / 2) ** 2) / (2 * w);
  }
  return t + over / r;
}

/**
 * Blend a dry and a compressed level (both dB) in the linear domain — parallel
 * ("New York") compression. At full mix the compressed level is returned unchanged.
 */
function blendDb(dryDb: number, compDb: number, m: number): number {
  if (m >= 1) return compDb;
  const lin = (1 - m) * 10 ** (dryDb / 20) + m * 10 ** (compDb / 20);
  return Math.max(FLOOR_DB, 20 * Math.log10(lin + 1e-12));
}

/** The fixed test program as an input level in dB at normalized time u∈[0,1). */
function programDb(u: number): number {
  const bed = -20;
  // Four transient hits that punch above the bed, plus a louder sustained swell.
  const hits = [0.08, 0.28, 0.48, 0.68];
  let level = bed;
  for (const h of hits) {
    const dt = u - h;
    if (dt >= 0) level = Math.max(level, -1 - 26 * dt); // -1 dB attack, fast decay
  }
  if (u >= 0.8) level = Math.max(level, -7); // sustained loud section
  return Math.max(FLOOR_DB, level);
}

// `disp*` painted, `target*` latest — eased each frame for a smooth morph.
const dispIn = new Float32Array(COLS);
const dispOut = new Float32Array(COLS);
const targetIn = new Float32Array(COLS);
const targetOut = new Float32Array(COLS);

/** Recompute the input/output envelopes with attack/release ballistics. */
function compute(): void {
  try {
    const gridRate = COLS / DUR; // grid steps per second
    const aCoef = Math.exp(-1 / Math.max(1e-4, (attackMs.value / 1000) * gridRate));
    const rCoef = Math.exp(-1 / Math.max(1e-4, (releaseMs.value / 1000) * gridRate));
    let gr = 0; // current gain reduction in dB (≤ 0), smoothed
    let peakGr = 0;
    for (let i = 0; i < COLS; i++) {
      const u = i / COLS;
      const inDb = programDb(u);
      targetIn[i] = inDb;
      const grTarget = gainComputer(inDb) - inDb; // ≤ 0
      // Attack when reduction deepens, release when it recovers.
      const coef = grTarget < gr ? aCoef : rCoef;
      gr = grTarget + (gr - grTarget) * coef;
      const outDb = blendDb(inDb, inDb + gr, mix.value);
      targetOut[i] = outDb;
      peakGr = Math.min(peakGr, outDb - inDb);
    }
    maxGr.value = -peakGr;
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
    for (let i = 0; i < COLS; i++) {
      const di = targetIn[i] - dispIn[i];
      const dout = targetOut[i] - dispOut[i];
      dispIn[i] += di * 0.3;
      dispOut[i] += dout * 0.3;
      delta = Math.max(delta, Math.abs(di), Math.abs(dout));
    }
    paint();
    if (delta > 0.02) {
      rafId = requestAnimationFrame(step);
    } else {
      dispIn.set(targetIn);
      dispOut.set(targetOut);
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

const dbToY = (db: number, top: number, bot: number): number =>
  bot - ((db - FLOOR_DB) / (0 - FLOOR_DB)) * (bot - top);

function paint(): void {
  const frame = prepareCanvas2D(canvas.value);
  if (!frame) return;
  const { ctx, width: w, height: h } = frame;

  const pad = 14;
  const gap = 20;
  const top = 14;
  const bot = h - 16;
  const curveW = Math.min(h - top - 16 + 8, (w - pad * 3) * 0.42); // keep the curve square-ish
  const curveX = pad;
  const envX = curveX + curveW + gap;
  const envW = w - envX - pad;

  ctx.font = '9px "JetBrains Mono", ui-monospace, monospace';
  ctx.textBaseline = 'top';

  // ----- transfer curve (left) -----
  const cBot = bot;
  const cTop = top;
  const cH = cBot - cTop;
  const sx = (db: number): number => curveX + ((db - FLOOR_DB) / (0 - FLOOR_DB)) * curveW;
  const sy = (db: number): number => cBot - ((db - FLOOR_DB) / (0 - FLOOR_DB)) * cH;

  // 1:1 reference
  ctx.strokeStyle = 'rgba(186, 230, 224, 0.22)';
  ctx.setLineDash([3, 3]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sx(FLOOR_DB), sy(FLOOR_DB));
  ctx.lineTo(sx(0), sy(0));
  ctx.stroke();
  ctx.setLineDash([]);

  // threshold guides
  const tDb = threshold.value;
  ctx.strokeStyle = 'rgba(255, 184, 108, 0.4)';
  ctx.beginPath();
  ctx.moveTo(sx(tDb), cTop);
  ctx.lineTo(sx(tDb), cBot);
  ctx.moveTo(curveX, sy(tDb));
  ctx.lineTo(curveX + curveW, sy(tDb));
  ctx.stroke();

  // the compression curve
  ctx.strokeStyle = '#a78bfa';
  ctx.lineWidth = 2;
  ctx.shadowColor = 'rgba(139, 92, 246, 0.6)';
  ctx.shadowBlur = 7;
  ctx.beginPath();
  for (let i = 0; i <= 96; i++) {
    const x = FLOOR_DB + (i / 96) * (0 - FLOOR_DB);
    const y = blendDb(x, gainComputer(x), mix.value);
    const px = sx(x);
    const py = sy(y);
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.fillStyle = 'rgba(186, 230, 224, 0.5)';
  ctx.fillText('IN → OUT', curveX + 2, cTop - 2);

  // ----- envelope panel (right) -----
  const eBot = bot;
  const eTop = top;
  const colX = (i: number): number => envX + (i / (COLS - 1)) * envW;

  // threshold line
  ctx.strokeStyle = 'rgba(255, 184, 108, 0.4)';
  ctx.beginPath();
  ctx.moveTo(envX, dbToY(tDb, eTop, eBot));
  ctx.lineTo(envX + envW, dbToY(tDb, eTop, eBot));
  ctx.stroke();

  // gain-reduction shading between input and output
  ctx.fillStyle = 'rgba(255, 120, 92, 0.22)';
  ctx.beginPath();
  ctx.moveTo(colX(0), dbToY(dispIn[0], eTop, eBot));
  for (let i = 1; i < COLS; i++) ctx.lineTo(colX(i), dbToY(dispIn[i], eTop, eBot));
  for (let i = COLS - 1; i >= 0; i--) ctx.lineTo(colX(i), dbToY(dispOut[i], eTop, eBot));
  ctx.closePath();
  ctx.fill();

  // input envelope (faint)
  ctx.strokeStyle = 'rgba(186, 230, 224, 0.45)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let i = 0; i < COLS; i++) {
    const x = colX(i);
    const y = dbToY(dispIn[i], eTop, eBot);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();

  // output envelope (bright teal)
  ctx.strokeStyle = '#2dd4bf';
  ctx.lineWidth = 1.8;
  ctx.shadowColor = 'rgba(45, 212, 191, 0.7)';
  ctx.shadowBlur = 6;
  ctx.beginPath();
  for (let i = 0; i < COLS; i++) {
    const x = colX(i);
    const y = dbToY(dispOut[i], eTop, eBot);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.fillStyle = 'rgba(186, 230, 224, 0.5)';
  ctx.fillText('GAIN REDUCTION', envX + 2, eTop - 2);
  ctx.textAlign = 'right';
  ctx.fillText('TIME', envX + envW, eBot + 2);
  ctx.textAlign = 'left';
}

// ---- audition: synthesize and play the compressed program ------------------
function buildAudio(): { samples: Float32Array; sampleRate: number } {
  const sampleRate = 44100;
  const n = Math.round(sampleRate * DUR);
  const out = new Float32Array(n);
  const gridRate = COLS / DUR;
  const aCoef = Math.exp(-1 / Math.max(1e-4, (attackMs.value / 1000) * sampleRate));
  const rCoef = Math.exp(-1 / Math.max(1e-4, (releaseMs.value / 1000) * sampleRate));
  let gr = 0;
  let ph = 0;
  const f = 150; // a low saw makes pumping easy to hear
  for (let i = 0; i < n; i++) {
    const u = i / n;
    const inDb = programDb(u);
    const grTarget = gainComputer(inDb) - inDb;
    const coef = grTarget < gr ? aCoef : rCoef;
    gr = grTarget + (gr - grTarget) * coef;
    const ampLin = 10 ** (blendDb(inDb, inDb + gr, mix.value) / 20);
    ph += f / sampleRate;
    if (ph >= 1) ph -= 1;
    out[i] = (2 * ph - 1) * 0.6 * ampLin; // saw × envelope
  }
  void gridRate;
  return { samples: out, sampleRate };
}

async function onPlay(): Promise<void> {
  await play(props.def.id, buildAudio());
}

let pending = 0;
function scheduleCompute(): void {
  if (pending) return;
  pending = requestAnimationFrame(() => {
    pending = 0;
    compute();
  });
}

watch(
  () => [threshold.value, ratio.value, knee.value, attackMs.value, releaseMs.value, mix.value],
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
    eyebrow="DYNAMICS · COMPRESSOR"
    :title="title"
    :caption="caption"
    :state="stateLabel"
    :tone="tone"
    :playing="isPlaying"
    :progress="progress"
    :error="status === 'error' ? errorMsg : null"
    :show-playhead="isPlaying"
    @toggle="onPlay"
  >
    <template #screen>
      <canvas ref="canvas" class="cd-canvas" />
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
.cd-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
</style>
