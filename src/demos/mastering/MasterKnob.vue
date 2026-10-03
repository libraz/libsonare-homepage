<script setup lang="ts">
/**
 * One parameter as a horizontal slider with a typed readout. Pointer drags
 * emit `begin` / `end` around their updates so the page can fold a drag into
 * one history entry; keys and the wheel emit single updates.
 */
import { computed, nextTick, ref } from 'vue';
import { formatParam, type ParamScale } from '@/demos/mastering/masteringUi';

const props = withDefaults(
  defineProps<{
    modelValue: number;
    min: number;
    max: number;
    step: number;
    label: string;
    unit?: string;
    scale?: ParamScale;
    /** Double-click target; the bipolar centre or the minimum when absent. */
    default?: number;
    disabled?: boolean;
    /** Help shown as the control's title. */
    hint?: string;
    /** Marks a parameter applied on release. */
    deferred?: boolean;
  }>(),
  {
    unit: '',
    scale: 'linear',
    default: undefined,
    disabled: false,
    hint: undefined,
    deferred: false,
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: number];
  begin: [];
  end: [];
}>();

const dragging = ref(false);
const editing = ref(false);
const draft = ref('');
const inputRef = ref<HTMLInputElement | null>(null);
const trackRef = ref<HTMLElement | null>(null);

const logScale = computed(() => props.scale === 'log' && props.min > 0);
const bipolar = computed(() => props.min < 0 && props.max > 0);

function toFraction(value: number): number {
  const clamped = Math.min(props.max, Math.max(props.min, value));
  if (logScale.value) return Math.log(clamped / props.min) / Math.log(props.max / props.min);
  return props.max === props.min ? 0 : (clamped - props.min) / (props.max - props.min);
}

function fromFraction(fraction: number): number {
  const f = Math.min(1, Math.max(0, fraction));
  if (logScale.value) return props.min * (props.max / props.min) ** f;
  return props.min + f * (props.max - props.min);
}

const position = computed(() => toFraction(props.modelValue) * 100);
const origin = computed(() => (bipolar.value ? toFraction(0) * 100 : 0));
const fillStyle = computed(() => ({
  left: `${Math.min(origin.value, position.value)}%`,
  width: `${Math.abs(position.value - origin.value)}%`,
}));

const display = computed(() => formatParam(props.modelValue, props.step));
const valueText = computed(() => (props.unit ? `${display.value} ${props.unit}` : display.value));

function snap(value: number): number {
  const stepped = props.step > 0 ? Math.round(value / props.step) * props.step : value;
  const clamped = Math.min(props.max, Math.max(props.min, stepped));
  return Number(clamped.toFixed(6));
}

function commit(value: number): void {
  const next = snap(value);
  if (next !== props.modelValue) emit('update:modelValue', next);
}

/** Moves by `steps` steps; on a log scale a step is a ratio, so low values move finely. */
function nudge(steps: number): void {
  if (logScale.value) {
    const ratio = (props.max / props.min) ** (1 / 200);
    commit(Math.max(props.min, props.modelValue) * ratio ** steps);
  } else {
    commit(props.modelValue + steps * props.step);
  }
}

function fractionAt(event: PointerEvent): number {
  const rect = trackRef.value?.getBoundingClientRect();
  if (!rect || rect.width === 0) return toFraction(props.modelValue);
  return (event.clientX - rect.left) / rect.width;
}

let fineOrigin: { x: number; fraction: number } | null = null;

function onPointerDown(event: PointerEvent): void {
  if (props.disabled || event.button !== 0) return;
  event.preventDefault();
  (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  (event.currentTarget as HTMLElement).focus();
  dragging.value = true;
  emit('begin');
  fineOrigin = null;
  commit(fromFraction(fractionAt(event)));
}

function onPointerMove(event: PointerEvent): void {
  if (!dragging.value) return;
  if (event.shiftKey) {
    const width = trackRef.value?.getBoundingClientRect().width || 1;
    fineOrigin ??= { x: event.clientX, fraction: toFraction(props.modelValue) };
    commit(fromFraction(fineOrigin.fraction + ((event.clientX - fineOrigin.x) / width) * 0.1));
  } else {
    fineOrigin = null;
    commit(fromFraction(fractionAt(event)));
  }
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
  const fine = event.shiftKey ? 1 : 4;
  const keys: Record<string, () => void> = {
    ArrowUp: () => nudge(fine),
    ArrowRight: () => nudge(fine),
    ArrowDown: () => nudge(-fine),
    ArrowLeft: () => nudge(-fine),
    PageUp: () => nudge(40),
    PageDown: () => nudge(-40),
    Home: () => commit(props.min),
    End: () => commit(props.max),
  };
  const action = keys[event.key];
  if (!action) return;
  event.preventDefault();
  event.stopPropagation();
  action();
}

function reset(): void {
  if (props.disabled) return;
  commit(props.default ?? (bipolar.value ? 0 : props.min));
}

async function startEditing(): Promise<void> {
  if (props.disabled) return;
  draft.value = display.value.replace('−', '-');
  editing.value = true;
  await nextTick();
  inputRef.value?.focus();
  inputRef.value?.select();
}

function finishEditing(apply: boolean): void {
  if (!editing.value) return;
  editing.value = false;
  const parsed = Number.parseFloat(draft.value.replace('−', '-'));
  if (apply && Number.isFinite(parsed)) commit(parsed);
}
</script>

<template>
  <div
    class="knob"
    :class="{ 'knob--dragging': dragging, 'knob--disabled': disabled, 'knob--deferred': deferred }"
  >
    <div class="knob__head">
      <span class="knob__label" :title="hint">{{ label }}</span>
      <input
        v-if="editing"
        ref="inputRef"
        v-model="draft"
        class="knob__input"
        inputmode="decimal"
        :aria-label="label"
        @keydown.enter.prevent="finishEditing(true)"
        @keydown.escape.prevent="finishEditing(false)"
        @blur="finishEditing(true)"
      >
      <button
        v-else
        type="button"
        class="knob__value"
        :disabled="disabled"
        :aria-label="`${label}: ${valueText}`"
        @click="startEditing"
      >
        {{ display }}<span v-if="unit" class="knob__unit">{{ unit }}</span>
      </button>
    </div>
    <div
      ref="trackRef"
      class="knob__track"
      role="slider"
      :tabindex="disabled ? -1 : 0"
      :aria-label="label"
      :aria-valuemin="min"
      :aria-valuemax="max"
      :aria-valuenow="modelValue"
      :aria-valuetext="valueText"
      :aria-disabled="disabled || undefined"
      :title="hint"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @wheel="onWheel"
      @dblclick="reset"
      @keydown="onKeyDown"
    >
      <span class="knob__rail" aria-hidden="true">
        <span class="knob__fill" :style="fillStyle"></span>
        <span v-if="bipolar" class="knob__origin" :style="{ left: `${origin}%` }"></span>
      </span>
      <span class="knob__thumb" :style="{ left: `${position}%` }" aria-hidden="true"></span>
    </div>
  </div>
</template>

<style scoped>
.knob {
  display: grid;
  gap: 4px;
  min-width: 0;
  user-select: none;
}

.knob__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  min-height: 18px;
}

.knob__label {
  overflow: hidden;
  color: var(--demo-text-muted);
  font-family: var(--font-mono);
  font-size: var(--demo-label-size);
  font-weight: var(--demo-label-weight);
  letter-spacing: var(--demo-label-tracking);
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}

.knob__value,
.knob__input {
  min-width: 0;
  padding: 0 2px;
  border: 0;
  border-radius: 3px;
  background: transparent;
  color: var(--demo-text-strong);
  font-family: var(--font-mono);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.knob__value {
  cursor: text;
}

.knob__input {
  width: 6em;
  outline: 1px solid var(--demo-accent);
}

.knob__unit {
  margin-left: 3px;
  color: var(--demo-text-muted);
  font-size: 10px;
}

.knob__value:focus-visible,
.knob__track:focus-visible {
  outline: 2px solid var(--demo-accent);
  outline-offset: 2px;
}

.knob__track {
  position: relative;
  height: 18px;
  cursor: ew-resize;
  touch-action: none;
}

.knob__rail {
  position: absolute;
  inset: 8px 0 auto;
  height: 2px;
  border-radius: 1px;
  background: var(--demo-border-strong);
}

.knob__fill {
  position: absolute;
  inset-block: 0;
  border-radius: inherit;
  background: var(--demo-accent);
}

.knob--deferred .knob__fill {
  background: var(--demo-amber);
}

.knob__origin {
  position: absolute;
  top: -3px;
  width: 1px;
  height: 8px;
  background: var(--demo-text-muted);
}

.knob__thumb {
  position: absolute;
  top: 3px;
  width: 4px;
  height: 12px;
  border-radius: 1px;
  background: var(--demo-text-strong);
  transform: translateX(-50%);
}

.knob--dragging .knob__thumb,
.knob__track:focus-visible .knob__thumb {
  background: var(--demo-accent);
}

.knob--disabled {
  opacity: var(--demo-disabled-opacity);
}

.knob--disabled .knob__track {
  cursor: not-allowed;
}
</style>
