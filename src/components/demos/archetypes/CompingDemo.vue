<script setup lang="ts">
/**
 * `comping` archetype: assemble one performance from the best of several takes.
 *
 * Three takes of the same short phrase are loaded (same length, same note timing,
 * so they line up). The timeline is split into four segments; one select per
 * segment picks which take owns it. The chosen path is highlighted across the take
 * lanes, and a fourth lane shows the assembled comp — built by copying each
 * segment from its take with a short equal-power crossfade at every boundary.
 * Pressing play auditions that comp. Take B has a wrong note in segment 3, so the
 * demo also shows comping *around* a flubbed moment.
 *
 * Pure clip assembly — no WASM transform.
 */
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useSonareDemoAudio } from '@/composables/useSonareDemoAudio';
import { type DemoLocale, localized, type SonareDemoDef } from '@/demos/types';
import DemoControls from '../DemoControls.vue';
import DemoFrame from '../DemoFrame.vue';

const props = defineProps<{ def: SonareDemoDef; active: boolean }>();

const { locale } = useI18n();
const { loadClip, play, playingId, progress } = useSonareDemoAudio();

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

const TAKES = ['a', 'b', 'c'] as const;
type Take = (typeof TAKES)[number];
const SEG_KEYS = ['seg1', 'seg2', 'seg3', 'seg4'] as const;
const NSEG = SEG_KEYS.length;

/** The take chosen for each of the four segments. */
const segChoices = computed<Take[]>(() =>
  SEG_KEYS.map((k) => (TAKES.includes(values[k] as Take) ? (values[k] as Take) : 'a')),
);

const tone = computed(() => {
  if (status.value === 'error') return 'error' as const;
  if (status.value === 'loading') return 'loading' as const;
  if (isPlaying.value) return 'playing' as const;
  if (status.value === 'ready') return 'ready' as const;
  return 'idle' as const;
});
const stateLabel = computed(() => {
  if (status.value === 'loading') return 'LOADING';
  if (status.value === 'error') return 'ERROR';
  if (isPlaying.value) return `▸ ${Math.round(progress.value * 100)}%`;
  if (status.value !== 'ready') return 'IDLE';
  return segChoices.value.map((t) => t.toUpperCase()).join(' · ');
});

// ---- clip data -------------------------------------------------------------
const WAVE_COLS = 300;
let sampleRate = 32000;
let clipLen = 0;
const takeBuf: Record<Take, Float32Array | null> = { a: null, b: null, c: null };
const takePeaks: Record<Take, Float32Array> = {
  a: new Float32Array(WAVE_COLS),
  b: new Float32Array(WAVE_COLS),
  c: new Float32Array(WAVE_COLS),
};
const compPeaks = new Float32Array(WAVE_COLS);
const dispComp = new Float32Array(WAVE_COLS);
let assembled: Float32Array | null = null;
const reveal = ref(0);

/** Per-column absolute peaks, normalized to the loudest column. */
function fillPeaks(samples: Float32Array, out: Float32Array): void {
  const n = samples.length;
  let max = 1e-6;
  for (let c = 0; c < WAVE_COLS; c++) {
    const a = Math.floor((c / WAVE_COLS) * n);
    const b = Math.max(a + 1, Math.floor(((c + 1) / WAVE_COLS) * n));
    let p = 0;
    for (let i = a; i < b && i < n; i++) {
      const v = Math.abs(samples[i]);
      if (v > p) p = v;
    }
    out[c] = p;
    if (p > max) max = p;
  }
  for (let c = 0; c < WAVE_COLS; c++) out[c] /= max;
}

/** Segment boundaries in samples (NSEG + 1 edges). */
function bounds(): number[] {
  const b: number[] = [];
  for (let k = 0; k <= NSEG; k++) b.push(Math.round((k / NSEG) * clipLen));
  return b;
}

/** Build the comp: each segment from its take, with equal-power boundary crossfades. */
function assemble(segs: Take[]): Float32Array {
  const comp = new Float32Array(clipLen);
  const edges = bounds();
  const bufOf = (k: number) => takeBuf[segs[k]] as Float32Array;
  for (let k = 0; k < NSEG; k++) {
    const src = bufOf(k);
    for (let i = edges[k]; i < edges[k + 1]; i++) comp[i] = src[i];
  }
  const xf = Math.round(sampleRate * 0.008);
  for (let k = 1; k < NSEG; k++) {
    if (segs[k] === segs[k - 1]) continue; // same take → already seamless
    const edge = edges[k];
    const prev = bufOf(k - 1);
    const next = bufOf(k);
    for (let j = -xf; j <= xf; j++) {
      const i = edge + j;
      if (i < 0 || i >= clipLen) continue;
      const t = (j + xf) / (2 * xf); // 0..1 across the fade
      comp[i] = prev[i] * Math.cos((t * Math.PI) / 2) + next[i] * Math.sin((t * Math.PI) / 2);
    }
  }
  return comp;
}

async function ensureClips(): Promise<void> {
  if (takeBuf.a) return;
  const loaded = await Promise.all(TAKES.map((t) => loadClip(`comp-take-${t}`)));
  sampleRate = loaded[0].sampleRate;
  clipLen = Math.min(...loaded.map((c) => c.samples.length));
  TAKES.forEach((t, i) => {
    takeBuf[t] = loaded[i].samples;
    fillPeaks(loaded[i].samples, takePeaks[t]);
  });
}

async function compute(): Promise<void> {
  try {
    if (status.value === 'idle') status.value = 'loading';
    await ensureClips();
    assembled = assemble(segChoices.value);
    fillPeaks(assembled, compPeaks);
    status.value = 'ready';
    startMorph();
  } catch (e) {
    status.value = 'error';
    errorMsg.value = e instanceof Error ? e.message : String(e);
  }
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
      const d = compPeaks[c] - dispComp[c];
      dispComp[c] += d * 0.3;
      delta = Math.max(delta, Math.abs(d));
    }
    paint();
    if (delta > 0.002) {
      rafId = requestAnimationFrame(step);
    } else {
      dispComp.set(compPeaks);
      paint();
      rafId = 0;
    }
  };
  rafId = requestAnimationFrame(step);
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

const TAKE_COLORS: Record<Take, string> = {
  a: 'rgba(45, 212, 191, 1)',
  b: 'rgba(167, 139, 250, 1)',
  c: 'rgba(251, 146, 60, 1)',
};

function paintLane(
  peaks: Float32Array,
  midY: number,
  amp: number,
  baseColor: string,
  ownedBy: (seg: number) => boolean,
  rev: number,
): void {
  const el = canvas.value;
  const ctx = el?.getContext('2d');
  if (!ctx || !el) return;
  const w = el.clientWidth;
  const padX = 16;
  const innerW = w - padX * 2;
  for (let c = 0; c < WAVE_COLS; c++) {
    const seg = Math.min(NSEG - 1, Math.floor((c / WAVE_COLS) * NSEG));
    const owned = ownedBy(seg);
    const x = padX + (c / (WAVE_COLS - 1)) * innerW;
    const a = peaks[c] * amp * rev;
    ctx.strokeStyle = baseColor.replace('1)', owned ? '0.95)' : '0.18)');
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, midY - a);
    ctx.lineTo(x, midY + a);
    ctx.stroke();
  }
}

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
  const segs = segChoices.value;
  // Four lanes: take A, B, C, then the assembled comp.
  const laneH = h / 4.6;
  const amp = laneH * 0.36;
  const laneMid = (i: number) => laneH * (i + 0.5) + 4;

  // Segment boundary guides.
  for (let k = 1; k < NSEG; k++) {
    const x = padX + (k / NSEG) * innerW;
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(x, 4);
    ctx.lineTo(x, laneH * 3 + 4);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Take lanes: highlight the segments that the comp draws from this take.
  TAKES.forEach((t, i) => {
    paintLane(takePeaks[t], laneMid(i), amp, TAKE_COLORS[t], (seg) => segs[seg] === t, 1);
  });

  // Comp lane: assembled result, each segment tinted by its source take.
  const compMid = laneMid(3);
  for (let c = 0; c < WAVE_COLS; c++) {
    const seg = Math.min(NSEG - 1, Math.floor((c / WAVE_COLS) * NSEG));
    const x = padX + (c / (WAVE_COLS - 1)) * innerW;
    const a = dispComp[c] * amp * reveal.value;
    ctx.strokeStyle = TAKE_COLORS[segs[seg]].replace('1)', '0.95)');
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, compMid - a);
    ctx.lineTo(x, compMid + a);
    ctx.stroke();
  }

  // Playhead.
  if (isPlaying.value) {
    const x = padX + progress.value * innerW;
    ctx.strokeStyle = 'rgba(94, 234, 212, 0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, 4);
    ctx.lineTo(x, h - 4);
    ctx.stroke();
  }

  // Lane labels.
  ctx.font = '9px "JetBrains Mono", ui-monospace, monospace';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  TAKES.forEach((t, i) => {
    ctx.fillStyle = TAKE_COLORS[t].replace('1)', '0.9)');
    ctx.fillText(`TAKE ${t.toUpperCase()}`, padX, laneMid(i) - amp - 7);
  });
  ctx.fillStyle = 'rgba(226, 232, 240, 0.9)';
  ctx.fillText('COMP', padX, compMid - amp - 7);
}

// ---- audition --------------------------------------------------------------
async function onPlay(): Promise<void> {
  if (!assembled) await compute();
  if (assembled) await play(props.def.id, { samples: assembled, sampleRate });
}

let pending = 0;
function scheduleCompute(): void {
  if (pending) return;
  pending = requestAnimationFrame(() => {
    pending = 0;
    compute();
  });
}

watch(segChoices, () => {
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
    eyebrow="ARRANGEMENT · COMPING"
    :title="title"
    :caption="caption"
    :state="stateLabel"
    :tone="tone"
    :playing="isPlaying"
    :progress="progress"
    :disabled="status === 'loading'"
    :error="status === 'error' ? errorMsg : null"
    loading-label="LOADING…"
    :show-playhead="false"
    @toggle="onPlay"
  >
    <template #screen>
      <canvas ref="canvas" class="cp-canvas" />
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
.cp-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
</style>
