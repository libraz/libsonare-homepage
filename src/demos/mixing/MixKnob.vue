<script setup lang="ts">
/**
 * A small strip pot: vertical drag (Shift for fine), wheel, arrow keys,
 * double-click to reset. Bipolar ranges draw their arc from the centre. A
 * drag emits `begin` / `end` so the page folds it into one history entry.
 */
import { computed, ref } from 'vue';
import { Tooltip } from '@/components/ui';
import type { ParamControl } from '@/demos/mixing/mixingUi';

const props = withDefaults(
  defineProps<{
    modelValue: number;
    control: ParamControl;
    /** Accessible name. */
    label: string;
    /** Printed readout; also the accessible value text. */
    display: string;
    /** Short printed caption above the pot. */
    caption?: string;
    defaultValue: number;
    disabled?: boolean;
    locked?: boolean;
    /** Help shown beside the readout while locked. */
    lockedHint?: string;
  }>(),
  { caption: undefined, disabled: false, locked: false, lockedHint: undefined },
);

const emit = defineEmits<{
  'update:modelValue': [value: number];
  begin: [];
  end: [];
}>();

const START = -135;
const END = 135;
const DRAG_PX = 140;

const dragging = ref(false);
let origin: { y: number; fraction: number } | null = null;
const inert = computed(() => props.disabled || props.locked);

const log = computed(() => props.control.scale === 'log' && props.control.min > 0);

function toFraction(value: number): number {
  const { min, max } = props.control;
  const v = Math.min(max, Math.max(min, value));
  if (log.value) return Math.log(v / min) / Math.log(max / min);
  return max === min ? 0 : (v - min) / (max - min);
}

function fromFraction(fraction: number): number {
  const { min, max } = props.control;
  const f = Math.min(1, Math.max(0, fraction));
  return log.value ? min * (max / min) ** f : min + f * (max - min);
}

function polar(deg: number, r: number): string {
  const rad = ((deg - 90) * Math.PI) / 180;
  return `${(20 + r * Math.cos(rad)).toFixed(2)} ${(20 + r * Math.sin(rad)).toFixed(2)}`;
}

function arc(from: number, to: number): string {
  const [a, b] = from <= to ? [from, to] : [to, from];
  if (b - a < 0.5) return '';
  return `M ${polar(a, 15)} A 15 15 0 ${b - a > 180 ? 1 : 0} 1 ${polar(b, 15)}`;
}

const angle = computed(() => START + toFraction(props.modelValue) * (END - START));
const originAngle = computed(() =>
  props.control.min < 0 && props.control.max > 0 ? START + toFraction(0) * (END - START) : START,
);
const track = arc(START, END);
const value = computed(() => arc(originAngle.value, angle.value));
const pointer = computed(() => ({ from: polar(angle.value, 5), to: polar(angle.value, 13) }));

function commit(next: number): void {
  const { min, max, step } = props.control;
  const stepped = Math.round(next / step) * step;
  const clamped = Number(Math.min(max, Math.max(min, stepped)).toFixed(6));
  if (clamped !== props.modelValue) emit('update:modelValue', clamped);
}

function nudge(steps: number): void {
  if (inert.value) return;
  if (log.value) commit(fromFraction(toFraction(props.modelValue) + steps / 200));
  else commit(props.modelValue + steps * props.control.step);
}

function onPointerDown(event: PointerEvent): void {
  if (inert.value || event.button !== 0) return;
  event.preventDefault();
  const host = event.currentTarget as HTMLElement;
  host.setPointerCapture?.(event.pointerId);
  host.focus();
  origin = { y: event.clientY, fraction: toFraction(props.modelValue) };
  dragging.value = true;
  emit('begin');
}

function onPointerMove(event: PointerEvent): void {
  if (!dragging.value || !origin) return;
  const delta = ((origin.y - event.clientY) / DRAG_PX) * (event.shiftKey ? 0.2 : 1);
  origin = { y: event.clientY, fraction: Math.min(1, Math.max(0, origin.fraction + delta)) };
  commit(fromFraction(origin.fraction));
}

function onPointerUp(event: PointerEvent): void {
  if (!dragging.value) return;
  dragging.value = false;
  origin = null;
  (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
  emit('end');
}

function onWheel(event: WheelEvent): void {
  if (inert.value) return;
  event.preventDefault();
  nudge((event.deltaY < 0 ? 1 : -1) * (event.shiftKey ? 1 : 4));
}

function onKeyDown(event: KeyboardEvent): void {
  if (inert.value) return;
  const fine = event.shiftKey ? 1 : 4;
  const actions: Record<string, () => void> = {
    ArrowUp: () => nudge(fine),
    ArrowRight: () => nudge(fine),
    ArrowDown: () => nudge(-fine),
    ArrowLeft: () => nudge(-fine),
    PageUp: () => nudge(40),
    PageDown: () => nudge(-40),
    Home: () => commit(props.control.min),
    End: () => commit(props.control.max),
  };
  const action = actions[event.key];
  if (!action) return;
  event.preventDefault();
  event.stopPropagation();
  action();
}

function reset(): void {
  if (!inert.value) commit(props.defaultValue);
}
</script>

<template>
  <div
    class="knob"
    :class="{ 'knob--dragging': dragging, 'knob--locked': locked, 'knob--disabled': disabled }"
  >
    <span v-if="caption" class="knob__caption">{{ caption }}</span>
    <div
      class="knob__control"
      role="slider"
      :tabindex="disabled ? -1 : 0"
      :aria-label="label"
      :aria-valuemin="control.min"
      :aria-valuemax="control.max"
      :aria-valuenow="modelValue"
      :aria-valuetext="display"
      :aria-readonly="locked || undefined"
      :aria-disabled="disabled || undefined"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @dblclick="reset"
      @wheel="onWheel"
      @keydown="onKeyDown"
    >
      <svg viewBox="0 0 40 40" aria-hidden="true">
        <path class="knob__track" :d="track" />
        <path v-if="value" class="knob__value" :d="value" />
        <circle class="knob__cap" cx="20" cy="20" r="10.5" />
        <path class="knob__pointer" :d="`M ${pointer.from} L ${pointer.to}`" />
      </svg>
    </div>
    <span class="knob__display">
      {{ display }}
      <Tooltip v-if="locked && lockedHint" :title="label" :body="lockedHint" />
    </span>
  </div>
</template>

<style scoped>
.knob {
  display: grid;
  justify-items: center;
  gap: 0;
  min-width: 0;
  user-select: none;
}

.knob__control {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  cursor: ns-resize;
  touch-action: none;
}

.knob__control:focus-visible {
  outline: 2px solid var(--demo-accent);
  outline-offset: 1px;
}

.knob__control svg {
  display: block;
  width: 100%;
  height: 100%;
}

.knob__track,
.knob__value {
  fill: none;
  stroke-linecap: round;
  stroke-width: 3;
}

.knob__track {
  stroke: var(--demo-border-strong);
}

.knob__value {
  stroke: var(--demo-accent);
}

.knob__cap {
  fill: var(--demo-control-bg-strong);
  stroke: var(--demo-border-strong);
}

.knob__pointer {
  stroke: var(--demo-text-strong);
  stroke-linecap: round;
  stroke-width: 2;
}

.knob__caption {
  color: var(--demo-text-faint);
  font-family: var(--font-mono);
  font-size: var(--demo-label-size);
  font-weight: var(--demo-label-weight);
  letter-spacing: var(--demo-label-tracking);
  text-transform: uppercase;
  white-space: nowrap;
}

.knob__display {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: var(--demo-text);
  font-family: var(--font-mono);
  font-size: 9.5px;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
  white-space: nowrap;
}

.knob--locked .knob__control {
  cursor: default;
}

.knob--locked .knob__value {
  stroke: var(--demo-cyan);
}

.knob--disabled {
  opacity: var(--demo-disabled-opacity);
}

.knob--disabled .knob__control {
  cursor: not-allowed;
}
</style>
