<script setup lang="ts">
/**
 * `comping` archetype: assemble one performance from the best of several takes.
 *
 * Three takes of the same short phrase are loaded (same length, same note timing,
 * so they line up). The timeline is split at the phrase's eighth-note pairs; one
 * select per segment picks which take owns it. The chosen path is highlighted
 * across the take lanes, and a fourth lane shows the assembled comp — built by
 * copying each segment from its take with a short linear crossfade at every
 * boundary. Take B has a wrong note at the start of segment 3, so the demo also
 * shows comping around a flubbed moment.
 *
 * Pure clip assembly — no WASM transform.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { peakEnvelope } from '@/demos/inline/audio/processors';
import { type I18nText, localized, type SonareDemoDef } from '@/demos/inline/types';
import { useSonareDemoAudio } from '@/demos/inline/useSonareDemoAudio';
import { prepareCanvas2D } from '@/utils/canvas';
import { useCanvasRedraw, useDemoChrome, useDemoParams, useDisposed } from '../composables';
import DemoControls from '../DemoControls.vue';
import DemoFrame from '../DemoFrame.vue';
import {
  assembleComp,
  type CompingTake,
  compSegmentAtFrame,
  compSegmentBoundaries,
} from './compingSession';

const props = defineProps<{ def: SonareDemoDef; active: boolean }>();

const { loadClip, play, stop, playingId, progress } = useSonareDemoAudio();

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

const TAKES = ['a', 'b', 'c'] as const satisfies readonly CompingTake[];
type Take = (typeof TAKES)[number];
const SEG_KEYS = ['seg1', 'seg2', 'seg3', 'seg4'] as const;
const NSEG = SEG_KEYS.length;

type AuditionMode = 'comp' | Take;
const AUDITION_OPTIONS: readonly { mode: AuditionMode; label: I18nText }[] = [
  { mode: 'comp', label: { en: 'Comp', ja: 'コンプ' } },
  { mode: 'a', label: { en: 'Take A', ja: 'テイク A' } },
  { mode: 'b', label: { en: 'Take B', ja: 'テイク B' } },
  { mode: 'c', label: { en: 'Take C', ja: 'テイク C' } },
];
const AUDITION_GROUP_LABEL: I18nText = { en: 'Audition source', ja: '試聴する音源' };
const PLAY_LABEL: I18nText = { en: 'Play', ja: '再生' };
const STOP_LABEL: I18nText = { en: 'Stop', ja: '停止' };
const selectedAudition = ref<AuditionMode>('comp');

/** The take chosen for each of the four segments. */
const segChoices = computed<Take[]>(() =>
  SEG_KEYS.map((k) => (TAKES.includes(values[k] as Take) ? (values[k] as Take) : 'a')),
);

function auditionLabel(mode: AuditionMode): string {
  const option = AUDITION_OPTIONS.find((candidate) => candidate.mode === mode);
  return option ? localized(option.label, loc.value) : mode.toUpperCase();
}

const auditionGroupLabel = computed(() => localized(AUDITION_GROUP_LABEL, loc.value));
const currentAuditionLabel = computed(() => auditionLabel(selectedAudition.value));

const stateLabel = computed(() => {
  if (status.value === 'loading') return 'LOADING';
  if (status.value === 'error') return 'ERROR';
  if (isPlaying.value)
    return `▸ ${currentAuditionLabel.value} ${Math.round(progress.value * 100)}%`;
  if (status.value !== 'ready') return 'IDLE';
  return currentAuditionLabel.value;
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

/** Segment boundaries in samples (NSEG + 1 edges), aligned to phrase notes. */
function bounds(): number[] {
  return compSegmentBoundaries(clipLen, sampleRate);
}

/** Build the comp: each segment from its take, with linear boundary crossfades. */
function assemble(segs: readonly Take[]): Float32Array {
  return assembleComp(
    {
      a: takeBuf.a as Float32Array,
      b: takeBuf.b as Float32Array,
      c: takeBuf.c as Float32Array,
    },
    segs,
    sampleRate,
  );
}

/**
 * Clip asset keys, one per take, in take order. They come from the registry rather
 * than a name template so every asset this demo loads is named in one place — the
 * clip-existence gate can only see clip names that appear in the registry.
 */
function takeClipNames(): string[] {
  const configured = props.def.config?.clips;
  const names = Array.isArray(configured) ? configured.filter((c) => typeof c === 'string') : [];
  if (names.length !== TAKES.length) {
    throw new Error(`comping demo "${props.def.id}": config.clips must name ${TAKES.length} clips`);
  }
  return names;
}

async function ensureClips(): Promise<void> {
  if (takeBuf.a) return;
  const loaded = await Promise.all(takeClipNames().map((name) => loadClip(name)));
  sampleRate = loaded[0].sampleRate;
  clipLen = Math.min(...loaded.map((c) => c.samples.length));
  TAKES.forEach((t, i) => {
    takeBuf[t] = loaded[i].samples;
    peakEnvelope(loaded[i].samples, takePeaks[t]);
  });
}

const disposed = useDisposed();

async function compute(): Promise<void> {
  if (disposed()) return;
  try {
    if (status.value === 'idle') status.value = 'loading';
    await ensureClips();
    if (disposed()) return;
    assembled = assemble(segChoices.value);
    peakEnvelope(assembled, compPeaks);
    status.value = 'ready';
    startMorph();
  } catch (e) {
    if (disposed()) return;
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
  segmentAtColumn: (column: number) => number,
  rev: number,
): void {
  const el = canvas.value;
  const ctx = el?.getContext('2d');
  if (!ctx || !el) return;
  const w = el.clientWidth;
  const padX = 16;
  const innerW = w - padX * 2;
  for (let c = 0; c < WAVE_COLS; c++) {
    const seg = segmentAtColumn(c);
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
  const frame = prepareCanvas2D(canvas.value);
  if (!frame) return;
  const { ctx, width: w, height: h } = frame;

  const padX = 16;
  const innerW = w - padX * 2;
  const segs = segChoices.value;
  const edges = bounds();
  const segmentAtColumn = (column: number) =>
    compSegmentAtFrame(((column + 0.5) / WAVE_COLS) * clipLen, edges);
  // Four lanes: take A, B, C, then the assembled comp.
  const laneH = h / 4.6;
  const amp = laneH * 0.36;
  const laneMid = (i: number) => laneH * (i + 0.5) + 4;

  // Segment boundary guides.
  for (let k = 1; k < NSEG; k++) {
    const x = padX + (clipLen > 0 ? edges[k] / clipLen : k / NSEG) * innerW;
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(x, 4);
    ctx.lineTo(x, h - 4);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Take lanes: highlight the segments that the comp draws from this take.
  TAKES.forEach((t, i) => {
    paintLane(
      takePeaks[t],
      laneMid(i),
      amp,
      TAKE_COLORS[t],
      (seg) => segs[seg] === t,
      segmentAtColumn,
      1,
    );
  });

  // Comp lane: assembled result, each segment tinted by its source take.
  const compMid = laneMid(3);
  for (let c = 0; c < WAVE_COLS; c++) {
    const seg = segmentAtColumn(c);
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

/** Re-paint when the screen is first laid out and on every later resize. */
useCanvasRedraw(canvas, paint);

// ---- audition --------------------------------------------------------------
function isAuditionPlaying(mode: AuditionMode): boolean {
  return isPlaying.value && selectedAudition.value === mode;
}

function auditionButtonLabel(mode: AuditionMode): string {
  const action = isAuditionPlaying(mode)
    ? localized(STOP_LABEL, loc.value)
    : localized(PLAY_LABEL, loc.value);
  return `${action} ${auditionLabel(mode)}`;
}

async function onAudition(mode: AuditionMode): Promise<void> {
  const switchingSource = isPlaying.value && selectedAudition.value !== mode;
  selectedAudition.value = mode;
  if (switchingSource) stop();
  if (!assembled) await compute();

  const samples = mode === 'comp' ? assembled : takeBuf[mode];
  if (samples) await play(props.def.id, { samples, sampleRate });
}

async function onPlay(): Promise<void> {
  await onAudition('comp');
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
  if (isPlaying.value && selectedAudition.value === 'comp') stop();
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
      <div class="cp-controls">
        <div class="cp-audition" role="group" :aria-label="auditionGroupLabel">
          <button
            v-for="option in AUDITION_OPTIONS"
            :key="option.mode"
            type="button"
            class="cp-audition__button"
            :class="{ 'is-playing': isAuditionPlaying(option.mode) }"
            :aria-label="auditionButtonLabel(option.mode)"
            :aria-pressed="isAuditionPlaying(option.mode)"
            :disabled="status === 'loading'"
            @click="onAudition(option.mode)"
          >
            {{ localized(option.label, loc) }}
          </button>
        </div>
        <DemoControls
          :model-value="values"
          :params="def.params ?? []"
          :locale="loc"
          :disabled="status === 'loading'"
          @update:model-value="updateParams"
        />
      </div>
    </template>
  </DemoFrame>
</template>

<style scoped>
.cp-controls {
  display: grid;
  gap: var(--space-3);
  width: 100%;
}

.cp-audition {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
}

.cp-audition__button {
  appearance: none;
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-full, 999px);
  padding: 5px 10px;
  color: var(--color-text-secondary);
  background: var(--vp-c-bg);
  cursor: pointer;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  transition: color var(--transition-fast), background var(--transition-fast),
    border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.cp-audition__button:hover:not(:disabled),
.cp-audition__button:focus-visible {
  border-color: var(--color-brand);
  color: var(--color-text-primary);
  outline: none;
}

.cp-audition__button.is-playing {
  border-color: var(--color-brand);
  color: var(--color-text-primary);
  background: color-mix(in srgb, var(--color-brand) 12%, var(--vp-c-bg));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-brand) 24%, transparent);
}

.cp-audition__button:disabled {
  cursor: wait;
  opacity: 0.55;
}

.cp-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
</style>
