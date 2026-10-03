<script lang="ts">
/** Visitor-facing copy for {@link SpectrumView}; the demo passes its own locale. */
export interface SpectrumViewLabels {
  /** Accessible name of the plot. */
  name: string;
  /** Text of the slope-compensation switch. */
  tilt: string;
  /** Legend names for the spectra, in the order of the `spectra` prop. */
  traces?: readonly string[];
}

/** An EQ band handle drawn on the overlay scale. */
export interface SpectrumBand {
  id: string;
  /** Accessible name, e.g. "Band 2". */
  label: string;
  freqHz: number;
  gainDb: number;
}

/** Payload of `update:band`. */
export interface SpectrumBandUpdate {
  id: string;
  freqHz: number;
  gainDb: number;
}

/** One point of an overlay curve such as an EQ response. */
export interface SpectrumOverlayPoint {
  freqHz: number;
  db: number;
}
</script>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useCanvasRedraw } from '@/composables/useCanvasRedraw';
import { prepareCanvas2D } from '@/utils/canvas';
import { dbScaleTicks, formatMeterValue } from './meterBallistics';

const props = withDefaults(
  defineProps<{
    /** Bin centre frequencies in Hz, shared by every spectrum. */
    freqs: ArrayLike<number> | null;
    /** Up to two spectra in dB (e.g. post, pre); the first is drawn filled. */
    spectra: readonly (ArrayLike<number> | null)[];
    /** Bottom of the level axis in dB. */
    minDb?: number;
    /** Top of the level axis in dB. */
    maxDb?: number;
    /** Weight of the running average per new frame, 0 (none) to just under 1. */
    smoothing?: number;
    /** Curve drawn on its own ±{@link overlayRangeDb} gain axis, e.g. an EQ response. */
    overlay?: readonly SpectrumOverlayPoint[] | null;
    /** Half-height of the overlay gain axis in dB. */
    overlayRangeDb?: number;
    /** Draggable band handles placed on the overlay axis. */
    bands?: readonly SpectrumBand[] | null;
    labels: SpectrumViewLabels;
  }>(),
  {
    minDb: -90,
    maxDb: 0,
    smoothing: 0.6,
    overlay: null,
    overlayRangeDb: 18,
    bands: null,
  },
);

/** Apply the 4.5 dB/oct display slope (pivot 1 kHz) so mastered music reads flat. */
const tilt = defineModel<boolean>('tilt', { default: true });

const emit = defineEmits<{
  'update:band': [update: SpectrumBandUpdate];
  'band-drag-start': [id: string];
  'band-drag-end': [id: string];
}>();

const F_MIN = 20;
const F_MAX = 20000;
const LOG_SPAN = Math.log(F_MAX / F_MIN);
const TILT_DB_PER_OCTAVE = 4.5;
const TILT_PIVOT_HZ = 1000;
const MAX_TRACES = 2;
/** Keyboard steps for a band handle. */
const SEMITONE = 2 ** (1 / 12);
const GAIN_STEP_DB = 0.5;
const GRID_FREQS = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];

const canvasRef = ref<HTMLCanvasElement | null>(null);
const plotRef = ref<HTMLElement | null>(null);
const averaged: (Float32Array | null)[] = [null, null];
let frame = 0;

function freqToFraction(freqHz: number): number {
  return Math.log(Math.max(F_MIN, Math.min(F_MAX, freqHz)) / F_MIN) / LOG_SPAN;
}

function fractionToFreq(fraction: number): number {
  return F_MIN * Math.exp(Math.max(0, Math.min(1, fraction)) * LOG_SPAN);
}

function tiltAt(freqHz: number): number {
  return tilt.value ? TILT_DB_PER_OCTAVE * Math.log2(freqHz / TILT_PIVOT_HZ) : 0;
}

/** Height fraction (0 = top) of a level on the spectrum axis. */
function levelToY(db: number): number {
  const span = props.maxDb - props.minDb || 1;
  return 1 - Math.max(0, Math.min(1, (db - props.minDb) / span));
}

/** Height fraction (0 = top) of a gain on the overlay axis. */
function gainToY(db: number): number {
  return 0.5 - Math.max(-0.5, Math.min(0.5, db / (2 * props.overlayRangeDb)));
}

function clampGain(db: number): number {
  return Math.max(-props.overlayRangeDb, Math.min(props.overlayRangeDb, db));
}

function clampFreq(freqHz: number): number {
  return Math.max(F_MIN, Math.min(F_MAX, freqHz));
}

function formatFreq(freqHz: number): string {
  return freqHz >= 1000 ? `${(freqHz / 1000).toFixed(freqHz >= 10000 ? 1 : 2)} kHz` : `${Math.round(freqHz)} Hz`;
}

/** Fold a new frame into the running average; non-finite bins count as the floor. */
function accumulate(): void {
  for (let t = 0; t < MAX_TRACES; t++) {
    const next = props.spectra[t] ?? null;
    const prev = averaged[t];
    if (!next) {
      averaged[t] = null;
      continue;
    }
    const continuing = prev !== null && prev.length === next.length;
    const avg = continuing ? prev : new Float32Array(next.length);
    const keep = continuing ? Math.max(0, Math.min(0.99, props.smoothing)) : 0;
    for (let i = 0; i < next.length; i++) {
      const v = Number.isFinite(next[i]) ? next[i] : props.minDb;
      avg[i] = keep * avg[i] + (1 - keep) * v;
    }
    averaged[t] = avg;
  }
}

function tracePath(g: CanvasRenderingContext2D, db: Float32Array, width: number, height: number): boolean {
  const freqs = props.freqs;
  if (!freqs) return false;
  const count = Math.min(freqs.length, db.length);
  let started = false;
  let column = -1;
  let columnDb = Number.NEGATIVE_INFINITY;
  let columnX = 0;
  const flush = () => {
    if (column < 0) return;
    const y = levelToY(columnDb) * height;
    if (started) g.lineTo(columnX, y);
    else {
      g.moveTo(columnX, y);
      started = true;
    }
  };
  for (let i = 0; i < count; i++) {
    const f = freqs[i];
    if (f < F_MIN || f > F_MAX) continue;
    const x = freqToFraction(f) * width;
    const px = Math.round(x);
    const v = db[i] + tiltAt(f);
    // Several high bins share one pixel column; draw their maximum.
    if (px === column) {
      columnDb = Math.max(columnDb, v);
      continue;
    }
    flush();
    column = px;
    columnX = x;
    columnDb = v;
  }
  flush();
  return started;
}

const levelTicks = computed(() => {
  const span = props.maxDb - props.minDb;
  return dbScaleTicks(props.minDb, props.maxDb, span > 60 ? 12 : 6).filter(
    (db) => db > props.minDb && db < props.maxDb,
  );
});

function cssVar(el: HTMLElement, name: string, fallback: string): string {
  return getComputedStyle(el).getPropertyValue(name).trim() || fallback;
}

function draw(): void {
  const canvas = canvasRef.value;
  const prepared = prepareCanvas2D(canvas);
  if (!canvas || !prepared) return;
  const { ctx: g, width, height } = prepared;
  const primary = cssVar(canvas, '--demo-cyan', '#0891B2');
  const secondary = cssVar(canvas, '--demo-text-muted', 'rgba(0, 0, 0, 0.42)');
  const accent = cssVar(canvas, '--demo-accent', '#7C3AED');
  const grid = cssVar(canvas, '--demo-border', 'rgba(0, 0, 0, 0.08)');

  g.strokeStyle = grid;
  g.lineWidth = 1;
  g.beginPath();
  for (const f of GRID_FREQS) {
    const x = Math.round(freqToFraction(f) * width) + 0.5;
    g.moveTo(x, 0);
    g.lineTo(x, height);
  }
  for (const tick of levelTicks.value) {
    const y = Math.round(levelToY(tick) * height) + 0.5;
    g.moveTo(0, y);
    g.lineTo(width, y);
  }
  g.stroke();

  // Secondary first so the primary sits on top of it.
  for (let t = MAX_TRACES - 1; t >= 0; t--) {
    const db = averaged[t];
    if (!db) continue;
    g.beginPath();
    if (!tracePath(g, db, width, height)) continue;
    g.lineJoin = 'round';
    if (t === 0) {
      g.strokeStyle = primary;
      g.lineWidth = 1.5;
      g.stroke();
      g.lineTo(width, height);
      g.lineTo(0, height);
      g.closePath();
      g.globalAlpha = 0.16;
      g.fillStyle = primary;
      g.fill();
      g.globalAlpha = 1;
    } else {
      g.strokeStyle = secondary;
      g.lineWidth = 1;
      g.stroke();
    }
  }

  const overlay = props.overlay;
  if (overlay && overlay.length > 1) {
    g.strokeStyle = accent;
    g.lineWidth = 2;
    g.beginPath();
    overlay.forEach((p, i) => {
      const x = freqToFraction(p.freqHz) * width;
      const y = gainToY(p.db) * height;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    });
    g.stroke();
  }
}

function schedule(): void {
  if (frame || typeof requestAnimationFrame !== 'function') return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    draw();
  });
}

watch(
  [() => props.spectra[0], () => props.spectra[1]],
  () => {
    accumulate();
    schedule();
  },
  { immediate: true },
);
watch([() => props.overlay, () => props.freqs, () => props.minDb, () => props.maxDb, tilt], schedule);
useCanvasRedraw(canvasRef, draw);

onBeforeUnmount(() => {
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
});

const freqLabels = computed(() =>
  GRID_FREQS.slice(1, -1).map((f) => ({
    f,
    text: f >= 1000 ? `${f / 1000}k` : String(f),
    left: `${(freqToFraction(f) * 100).toFixed(2)}%`,
  })),
);

const levelLabels = computed(() =>
  levelTicks.value.map((db) => ({ db, top: `${(levelToY(db) * 100).toFixed(2)}%` })),
);

const gainLabels = computed(() => {
  const r = props.overlayRangeDb;
  return [r / 2, 0, -r / 2].map((db) => ({
    db,
    text: db > 0 ? `+${db}` : String(db),
    top: `${(gainToY(db) * 100).toFixed(2)}%`,
  }));
});

const legend = computed(() =>
  (props.labels.traces ?? [])
    .slice(0, MAX_TRACES)
    .map((name, i) => ({ name, primary: i === 0 }))
    .filter((_, i) => props.spectra[i] != null),
);

const handles = computed(() =>
  (props.bands ?? []).map((band) => ({
    band,
    left: `${(freqToFraction(band.freqHz) * 100).toFixed(2)}%`,
    top: `${(gainToY(band.gainDb) * 100).toFixed(2)}%`,
    text: `${band.label}: ${formatFreq(band.freqHz)}, ${formatMeterValue(band.gainDb, true)} dB`,
  })),
);

function emitBand(band: SpectrumBand, freqHz: number, gainDb: number): void {
  const next = { id: band.id, freqHz: clampFreq(freqHz), gainDb: clampGain(gainDb) };
  if (next.freqHz === band.freqHz && next.gainDb === band.gainDb) return;
  emit('update:band', next);
}

function onHandleKey(event: KeyboardEvent, band: SpectrumBand): void {
  let freq = band.freqHz;
  let gain = band.gainDb;
  switch (event.key) {
    case 'ArrowRight':
      freq *= SEMITONE;
      break;
    case 'ArrowLeft':
      freq /= SEMITONE;
      break;
    case 'ArrowUp':
      gain += GAIN_STEP_DB;
      break;
    case 'ArrowDown':
      gain -= GAIN_STEP_DB;
      break;
    case 'Home':
      freq = F_MIN;
      break;
    case 'End':
      freq = F_MAX;
      break;
    default:
      return;
  }
  event.preventDefault();
  emitBand(band, freq, gain);
}

let dragging: SpectrumBand['id'] | null = null;

function pointerToBand(event: PointerEvent, band: SpectrumBand): void {
  const rect = plotRef.value?.getBoundingClientRect();
  if (!rect || rect.width === 0 || rect.height === 0) return;
  const fx = (event.clientX - rect.left) / rect.width;
  const fy = (event.clientY - rect.top) / rect.height;
  emitBand(band, fractionToFreq(fx), (0.5 - fy) * 2 * props.overlayRangeDb);
}

function onHandleDown(event: PointerEvent, band: SpectrumBand): void {
  event.preventDefault();
  (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  (event.currentTarget as HTMLElement).focus();
  dragging = band.id;
  emit('band-drag-start', band.id);
}

function onHandleMove(event: PointerEvent, band: SpectrumBand): void {
  if (dragging === band.id) pointerToBand(event, band);
}

function onHandleUp(event: PointerEvent, band: SpectrumBand): void {
  if (dragging !== band.id) return;
  dragging = null;
  (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
  emit('band-drag-end', band.id);
}
</script>

<template>
  <div class="spectrum-view">
    <div class="spectrum-view__bar">
      <ul v-if="legend.length" class="spectrum-view__legend">
        <li v-for="item in legend" :key="item.name">
          <span
            class="spectrum-view__swatch"
            :class="{ 'spectrum-view__swatch--primary': item.primary }"
            aria-hidden="true"
          />
          {{ item.name }}
        </li>
      </ul>
      <button
        type="button"
        class="spectrum-view__toggle"
        :aria-pressed="tilt"
        @click="tilt = !tilt"
      >
        {{ labels.tilt }}
      </button>
    </div>
    <div ref="plotRef" class="spectrum-view__plot">
      <canvas ref="canvasRef" class="spectrum-view__canvas" role="img" :aria-label="labels.name" />
      <div class="spectrum-view__labels" aria-hidden="true">
        <span
          v-for="label in freqLabels"
          :key="label.f"
          class="spectrum-view__freq"
          :style="{ left: label.left }"
        >{{ label.text }}</span>
        <span
          v-for="label in levelLabels"
          :key="label.db"
          class="spectrum-view__level"
          :style="{ top: label.top }"
        >{{ label.db }}</span>
        <template v-if="overlay || bands?.length">
          <span
            v-for="label in gainLabels"
            :key="label.db"
            class="spectrum-view__gain"
            :style="{ top: label.top }"
          >{{ label.text }}</span>
        </template>
      </div>
      <button
        v-for="handle in handles"
        :key="handle.band.id"
        type="button"
        class="spectrum-view__handle"
        role="slider"
        :aria-label="handle.band.label"
        :aria-valuemin="F_MIN"
        :aria-valuemax="F_MAX"
        :aria-valuenow="Math.round(handle.band.freqHz)"
        :aria-valuetext="handle.text"
        :title="handle.text"
        :style="{ left: handle.left, top: handle.top }"
        @keydown="onHandleKey($event, handle.band)"
        @pointerdown="onHandleDown($event, handle.band)"
        @pointermove="onHandleMove($event, handle.band)"
        @pointerup="onHandleUp($event, handle.band)"
        @pointercancel="onHandleUp($event, handle.band)"
      />
    </div>
  </div>
</template>

<style scoped>
.spectrum-view {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-family: var(--font-mono);
  color: var(--demo-text-muted);
}

.spectrum-view__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.spectrum-view__legend {
  display: flex;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: var(--demo-label-size);
  letter-spacing: var(--demo-label-tracking);
}

.spectrum-view__legend li {
  display: flex;
  align-items: center;
  gap: 5px;
}

.spectrum-view__swatch {
  width: 12px;
  height: 2px;
  background: var(--demo-text-muted);
}

.spectrum-view__swatch--primary {
  background: var(--demo-cyan);
}

.spectrum-view__toggle {
  margin-left: auto;
  padding: 3px 8px;
  border: 1px solid var(--demo-border-strong);
  border-radius: 6px;
  background: var(--demo-control-bg);
  color: var(--demo-text-muted);
  font-family: var(--font-mono);
  font-size: var(--demo-label-size);
  font-weight: var(--demo-label-weight);
  letter-spacing: var(--demo-label-tracking);
  cursor: pointer;
}

.spectrum-view__toggle[aria-pressed='true'] {
  border-color: var(--demo-accent-border);
  background: var(--demo-accent-dim);
  color: var(--demo-text-strong);
}

.spectrum-view__plot {
  position: relative;
  min-height: 180px;
  flex: 1;
  overflow: hidden;
  border: 1px solid var(--demo-border);
  border-radius: 8px;
  background: var(--demo-screen-bg);
  touch-action: none;
}

.spectrum-view__canvas {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
}

.spectrum-view__labels {
  position: absolute;
  inset: 0;
  pointer-events: none;
  font-size: var(--demo-label-size);
  line-height: 1;
  font-variant-numeric: tabular-nums;
  color: var(--demo-text-faint);
}

.spectrum-view__freq {
  position: absolute;
  bottom: 4px;
  transform: translateX(-50%);
}

.spectrum-view__level {
  position: absolute;
  left: 4px;
  transform: translateY(-50%);
}

.spectrum-view__gain {
  position: absolute;
  right: 4px;
  transform: translateY(-50%);
  color: var(--demo-accent);
  opacity: 0.8;
}

.spectrum-view__handle {
  position: absolute;
  width: 14px;
  height: 14px;
  padding: 0;
  border: 2px solid var(--demo-accent);
  border-radius: 50%;
  background: var(--demo-bg);
  transform: translate(-50%, -50%);
  cursor: grab;
  touch-action: none;
}

.spectrum-view__handle:active {
  cursor: grabbing;
  background: var(--demo-accent);
}

.spectrum-view__handle:focus-visible {
  outline: 2px solid var(--demo-accent);
  outline-offset: 2px;
}
</style>
