<script setup lang="ts">
/**
 * The selected track's automation lane for one parameter: click to add a
 * point, drag to move it, double-click to delete. Points are cheap engine
 * edits, so a drag applies live and folds into one history entry.
 */
import { computed, ref, watch } from 'vue';
import { AUTOMATION_RANGES } from '@/demos/mixing/mixingConstants';
import { useMixingCopy } from '@/demos/mixing/mixingCopy';
import type { AutomationCurve, AutomationParam, AutomationPoint } from '@/demos/mixing/mixingState';
import { faderPosition, formatClock, formatFader, formatPan } from '@/demos/mixing/mixingUi';
import type { MixingController } from '@/demos/mixing/useMixingStudio';
import { fill } from '@/utils/template';

const props = defineProps<{
  m: MixingController;
  param: AutomationParam;
  /** Pixels per second of the arrangement. */
  pps: number;
  width: number;
  height: number;
}>();

/** Curve for new points; picking a point adopts its curve. */
const curve = defineModel<AutomationCurve>('curve', { required: true });

const copy = useMixingCopy();
const { m } = props;
const { selectedTrack, editLocked } = m;
const selectedPoint = ref<string | null>(null);
const x = (sec: number) => sec * props.pps;

watch(
  () => props.param,
  () => {
    selectedPoint.value = null;
  },
);

const lane = computed<AutomationPoint[]>(() => selectedTrack.value?.automation[props.param] ?? []);
const range = computed(() => AUTOMATION_RANGES[props.param]);

function valueToY(value: number): number {
  if (props.param === 'fader') return (1 - faderPosition(value)) * props.height;
  const { min, max } = range.value;
  return (1 - (value - min) / (max - min)) * props.height;
}

function yToValue(y: number): number {
  const f = Math.min(1, Math.max(0, 1 - y / props.height));
  if (props.param === 'fader') {
    // Invert the fader taper by bisection; the taper is monotonic.
    let lo = range.value.min;
    let hi = range.value.max;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (faderPosition(mid) < f) lo = mid;
      else hi = mid;
    }
    return Math.round(((lo + hi) / 2) * 10) / 10;
  }
  const { min, max } = range.value;
  return Math.round((min + f * (max - min)) * 100) / 100;
}

function formatValue(value: number): string {
  if (props.param === 'fader') return `${formatFader(value)} dB`;
  if (props.param === 'pan') return formatPan(value);
  return `${Math.round(value * 100)}%`;
}

const autoPath = computed(() => {
  const points = lane.value;
  if (points.length === 0) return '';
  const parts = [`M 0 ${valueToY(points[0].value).toFixed(1)}`];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const px = x(p.timeSec);
    const py = valueToY(p.value);
    parts.push(`L ${px.toFixed(1)} ${py.toFixed(1)}`);
    const next = points[i + 1];
    if (next && p.curve === 'hold') parts.push(`L ${x(next.timeSec).toFixed(1)} ${py.toFixed(1)}`);
    else if (next && p.curve !== 'linear') {
      const steps = 12;
      for (let s = 1; s < steps; s++) {
        const f = s / steps;
        const shaped = p.curve === 'exponential' ? f * f : f * f * (3 - 2 * f);
        const t = p.timeSec + (next.timeSec - p.timeSec) * f;
        const v = p.value + (next.value - p.value) * shaped;
        parts.push(`L ${x(t).toFixed(1)} ${valueToY(v).toFixed(1)}`);
      }
    }
  }
  parts.push(`L ${props.width} ${valueToY(points[points.length - 1].value).toFixed(1)}`);
  return parts.join(' ');
});

const autoBase = computed(() => {
  const track = selectedTrack.value;
  if (!track) return 0;
  if (props.param === 'fader') return track.faderDb;
  if (props.param === 'pan') return track.pan;
  return track.slots.width.params.width;
});

let pointDrag: { id: string; rect: DOMRect } | null = null;

function lanePoint(event: PointerEvent | MouseEvent, rect: DOMRect) {
  return {
    timeSec: Math.max(0, (event.clientX - rect.left) / props.pps),
    value: yToValue(event.clientY - rect.top),
  };
}

function addPoint(event: MouseEvent): void {
  const track = selectedTrack.value;
  if (!track || editLocked.value) return;
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  const at = lanePoint(event, rect);
  const id = `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  m.edit('addAutomationPoint', track.id, props.param, { id, ...at, curve: curve.value });
  selectedPoint.value = id;
}

function startPointDrag(event: PointerEvent, point: AutomationPoint): void {
  if (editLocked.value || event.button !== 0) return;
  event.stopPropagation();
  event.preventDefault();
  const laneEl = (event.currentTarget as HTMLElement).parentElement;
  if (!laneEl) return;
  (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  selectedPoint.value = point.id;
  curve.value = point.curve;
  pointDrag = { id: point.id, rect: laneEl.getBoundingClientRect() };
  m.begin();
}

function movePointDrag(event: PointerEvent): void {
  const track = selectedTrack.value;
  if (!pointDrag || !track) return;
  const at = lanePoint(event, pointDrag.rect);
  m.edit('moveAutomationPoint', track.id, props.param, pointDrag.id, at.timeSec, at.value);
}

function endPointDrag(event: PointerEvent): void {
  if (!pointDrag) return;
  pointDrag = null;
  (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
  m.end();
}

function removePoint(point: AutomationPoint): void {
  const track = selectedTrack.value;
  if (track) m.edit('removeAutomationPoint', track.id, props.param, point.id);
}

/** Reshapes the selected point to `next`, the curve new points also take. */
function applyCurve(next: AutomationCurve): void {
  const track = selectedTrack.value;
  const point = lane.value.find((p) => p.id === selectedPoint.value);
  if (track && point && point.curve !== next) {
    m.edit('setAutomationCurve', track.id, props.param, point.id, next);
  }
}

defineExpose({ applyCurve });
</script>

<template>
  <div
    class="arr__auto"
    :class="{ 'arr__auto--disabled': !selectedTrack || editLocked }"
    :style="{ height: `${height}px` }"
    @click.self="addPoint"
  >
    <svg class="arr__auto-svg" :width="width" :height="height" aria-hidden="true">
      <line
        class="arr__auto-base"
        x1="0"
        :y1="valueToY(autoBase)"
        :x2="width"
        :y2="valueToY(autoBase)"
      />
      <path v-if="autoPath" class="arr__auto-line" :d="autoPath" />
    </svg>
    <button
      v-for="point in lane"
      :key="point.id"
      type="button"
      class="arr__point"
      :class="{ 'arr__point--selected': point.id === selectedPoint }"
      :style="{ left: `${x(point.timeSec)}px`, top: `${valueToY(point.value)}px` }"
      :aria-label="fill(copy.arrange.point, { time: formatClock(point.timeSec), value: formatValue(point.value) })"
      :title="`${formatClock(point.timeSec)} · ${formatValue(point.value)}`"
      :disabled="editLocked"
      @pointerdown="startPointDrag($event, point)"
      @pointermove="movePointDrag"
      @pointerup="endPointDrag"
      @pointercancel="endPointDrag"
      @dblclick.stop="removePoint(point)"
      @click.stop
    ></button>
    <span v-if="!selectedTrack" class="arr__auto-hint">{{ copy.arrange.noTrack }}</span>
    <span v-else-if="lane.length === 0" class="arr__auto-hint">{{ copy.arrange.hint }}</span>
  </div>
</template>

<style scoped>
.arr__auto {
  position: relative;
  background: var(--demo-control-bg);
  cursor: crosshair;
}

.arr__auto--disabled {
  cursor: default;
}

.arr__auto-svg {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.arr__auto-base {
  stroke: var(--demo-border-strong);
  stroke-dasharray: 3 3;
}

.arr__auto-line {
  fill: none;
  stroke: var(--demo-cyan);
  stroke-width: 1.5;
}

.arr__point {
  position: absolute;
  width: 10px;
  height: 10px;
  margin: -5px 0 0 -5px;
  padding: 0;
  border: 1.5px solid var(--demo-cyan);
  border-radius: 50%;
  background: var(--demo-bg);
  cursor: grab;
  touch-action: none;
}

.arr__point--selected {
  background: var(--demo-cyan);
}

.arr__auto-hint {
  position: absolute;
  left: 10px;
  bottom: 6px;
  color: var(--demo-text-faint);
  font-size: 11px;
  pointer-events: none;
}
</style>
