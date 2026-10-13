<script setup lang="ts">
/**
 * One parameter as a horizontal slider with its readout, for the inspector,
 * the returns and the master. A pointer drag emits `begin` / `end` around its
 * updates; keys and the wheel emit single updates. `deferred` marks a
 * parameter the strip only takes on release.
 */
import { computed, ref } from 'vue';
import { Tooltip } from '@/components/ui';
import { formatParam, type ParamControl } from '@/demos/mixing/mixingUi';

const props = withDefaults(
  defineProps<{
    modelValue: number;
    control: ParamControl;
    label: string;
    defaultValue: number;
    disabled?: boolean;
    deferred?: boolean;
    /** Help shown from an info dot beside the label. */
    hint?: string;
  }>(),
  { disabled: false, deferred: false, hint: undefined },
);

const emit = defineEmits<{
  'update:modelValue': [value: number];
  begin: [];
  end: [];
}>();

const trackRef = ref<HTMLElement | null>(null);
const dragging = ref(false);
const log = computed(() => props.control.scale === 'log' && props.control.min > 0);
const bipolar = computed(() => props.control.min < 0 && props.control.max > 0);

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

const position = computed(() => toFraction(props.modelValue) * 100);
const origin = computed(() => (bipolar.value ? toFraction(0) * 100 : 0));
const fillStyle = computed(() => ({
  left: `${Math.min(origin.value, position.value)}%`,
  width: `${Math.abs(position.value - origin.value)}%`,
}));
const readout = computed(() => formatParam(props.modelValue, props.control));
const unit = computed(() => props.control.unit);

function commit(value: number): void {
  const { min, max, step } = props.control;
  const stepped = Math.round(value / step) * step;
  const next = Number(Math.min(max, Math.max(min, stepped)).toFixed(6));
  if (next !== props.modelValue) emit('update:modelValue', next);
}

function nudge(steps: number): void {
  if (props.disabled) return;
  if (log.value) commit(fromFraction(toFraction(props.modelValue) + steps / 200));
  else commit(props.modelValue + steps * props.control.step);
}

function fractionAt(event: PointerEvent): number {
  const rect = trackRef.value?.getBoundingClientRect();
  if (!rect || rect.width === 0) return toFraction(props.modelValue);
  return (event.clientX - rect.left) / rect.width;
}

let fine: { x: number; fraction: number } | null = null;

function onPointerDown(event: PointerEvent): void {
  if (props.disabled || event.button !== 0) return;
  event.preventDefault();
  const host = event.currentTarget as HTMLElement;
  host.setPointerCapture?.(event.pointerId);
  host.focus();
  dragging.value = true;
  fine = null;
  emit('begin');
  commit(fromFraction(fractionAt(event)));
}

function onPointerMove(event: PointerEvent): void {
  if (!dragging.value) return;
  if (event.shiftKey) {
    const width = trackRef.value?.getBoundingClientRect().width || 1;
    fine ??= { x: event.clientX, fraction: toFraction(props.modelValue) };
    commit(fromFraction(fine.fraction + ((event.clientX - fine.x) / width) * 0.1));
    return;
  }
  fine = null;
  commit(fromFraction(fractionAt(event)));
}

function onPointerUp(event: PointerEvent): void {
  if (!dragging.value) return;
  dragging.value = false;
  (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
  emit('end');
}

function onWheel(event: WheelEvent): void {
  if (props.disabled) return;
  event.preventDefault();
  nudge((event.deltaY < 0 ? 1 : -1) * (event.shiftKey ? 1 : 4));
}

function onKeyDown(event: KeyboardEvent): void {
  if (props.disabled) return;
  const step = event.shiftKey ? 1 : 4;
  const actions: Record<string, () => void> = {
    ArrowUp: () => nudge(step),
    ArrowRight: () => nudge(step),
    ArrowDown: () => nudge(-step),
    ArrowLeft: () => nudge(-step),
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
  if (!props.disabled) commit(props.defaultValue);
}
</script>

<template>
  <div
    class="param"
    :class="{ 'param--dragging': dragging, 'param--disabled': disabled, 'param--deferred': deferred }"
  >
    <span class="param__label">
      <span class="param__label-text">{{ label }}</span>
      <Tooltip v-if="hint" :title="label" :body="hint" />
    </span>
    <span class="param__value">{{ readout }}<small v-if="unit">{{ unit }}</small></span>
    <div
      ref="trackRef"
      class="param__track"
      role="slider"
      :tabindex="disabled ? -1 : 0"
      :aria-label="label"
      :aria-valuemin="control.min"
      :aria-valuemax="control.max"
      :aria-valuenow="modelValue"
      :aria-valuetext="unit ? `${readout} ${unit}` : readout"
      :aria-disabled="disabled || undefined"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @dblclick="reset"
      @wheel="onWheel"
      @keydown="onKeyDown"
    >
      <span class="param__rail" aria-hidden="true"></span>
      <span class="param__fill" aria-hidden="true" :style="fillStyle"></span>
      <span class="param__thumb" aria-hidden="true" :style="{ left: `${position}%` }"></span>
    </div>
  </div>
</template>

<style scoped>
.param {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: baseline;
  gap: 2px 8px;
  min-width: 0;
  user-select: none;
}

.param__label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  color: var(--demo-text-muted);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.04em;
}

.param__label-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.param__value {
  color: var(--demo-text-strong);
  font-family: var(--font-mono);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.param__value small {
  margin-left: 2px;
  color: var(--demo-text-muted);
  font-size: 9px;
}

.param__track {
  position: relative;
  grid-column: 1 / -1;
  height: 16px;
  border-radius: 3px;
  cursor: ew-resize;
  touch-action: none;
}

.param__track:focus-visible {
  outline: 2px solid var(--demo-accent);
  outline-offset: 1px;
}

.param__rail,
.param__fill {
  position: absolute;
  top: 7px;
  height: 2px;
  border-radius: 1px;
}

.param__rail {
  left: 0;
  right: 0;
  background: var(--demo-border-strong);
}

.param__fill {
  background: var(--demo-accent);
}

.param__thumb {
  position: absolute;
  top: 3px;
  width: 4px;
  height: 10px;
  margin-left: -2px;
  border-radius: 1px;
  background: var(--demo-text-strong);
}

.param--dragging .param__thumb {
  background: var(--demo-accent);
}

.param--deferred .param__fill {
  background: var(--demo-amber);
}

.param--disabled {
  opacity: var(--demo-disabled-opacity);
}

.param--disabled .param__track {
  cursor: not-allowed;
}
</style>
