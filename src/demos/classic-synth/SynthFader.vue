<script setup lang="ts">
/**
 * A vertical fader: a thin recessed track, a light cap, tick marks beside the
 * travel, a silkscreen caption above and the value below.
 *
 * It is the sibling of `RotaryKnob` and takes the same props and keyboard
 * contract, so a page can hold either without two conventions. The one
 * difference is pointer behaviour: pressing the cap drags it relatively, while
 * pressing the track jumps the cap there first — a fader a reader cannot set by
 * pointing at the position they want does not feel like a fader.
 *
 * The caption and the value reserve their height and width, so a value growing
 * a digit or a caption wrapping never moves the cap beside it.
 *
 * Travel is a length the stylesheet owns (`--fader-travel`), so a panel can
 * set it per breakpoint; the pointer math measures the slot rather than
 * trusting a prop. `travel` exists for a fader that is not on such a panel.
 */
import { computed, ref } from 'vue';

const props = withDefaults(
  defineProps<{
    modelValue: number;
    min: number;
    max: number;
    /** Keyboard / wheel increment. Defaults to 1% of the range. */
    step?: number;
    /** Accessible name of the control. */
    label: string;
    /** Silkscreen printed above the travel; falls back to {@link label}. */
    caption?: string;
    /** Formatted value readout shown under the fader (and to screen readers). */
    display?: string;
    /** Value restored on double click. */
    defaultValue?: number;
    /** Travel length in px; when unset, the stylesheet's `--fader-travel` decides. */
    travel?: number;
    disabled?: boolean;
    /** Id of an element describing the control, such as a note on why it is inert. */
    describedBy?: string;
  }>(),
  {
    step: undefined,
    caption: undefined,
    display: undefined,
    defaultValue: undefined,
    travel: undefined,
    disabled: false,
    describedBy: undefined,
  },
);

const emit = defineEmits<(e: 'update:modelValue', value: number) => void>();

/** Cap height in px; the slot is the travel plus one cap so the cap never leaves it. */
const CAP_PX = 18;

const slot = ref<HTMLElement | null>(null);
const dragging = ref(false);

const stepSize = computed(() => props.step ?? (props.max - props.min) / 100);
const norm = computed(() => {
  const span = props.max - props.min || 1;
  return Math.min(1, Math.max(0, (props.modelValue - props.min) / span));
});

/** Eleven marks down the travel; the ends and the centre are longer. */
const ticks = [...Array(11).keys()].map((i) => ({
  y: i * 10,
  major: i === 0 || i === 5 || i === 10,
}));

function commit(value: number): void {
  const stepped = Math.round(value / stepSize.value) * stepSize.value;
  const clamped = Math.min(props.max, Math.max(props.min, stepped));
  if (clamped !== props.modelValue) emit('update:modelValue', clamped);
}

let dragStartY = 0;
let dragStartValue = 0;

/** The travel as laid out, in px: the slot less the cap it keeps room for. */
function travelPx(): number {
  const height = slot.value?.getBoundingClientRect().height ?? 0;
  return Math.max(1, height - CAP_PX);
}

/** The value under a pointer, from its distance down the travel. */
function valueAt(clientY: number): number {
  const rect = slot.value?.getBoundingClientRect();
  if (!rect) return props.modelValue;
  const y = clientY - rect.top - CAP_PX / 2;
  const n = 1 - Math.min(1, Math.max(0, y / travelPx()));
  return props.min + n * (props.max - props.min);
}

function onPointerDown(event: PointerEvent): void {
  if (props.disabled) return;
  event.preventDefault();
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  dragging.value = true;
  const onCap = (event.target as HTMLElement).closest('.fader__cap') !== null;
  if (!onCap) commit(valueAt(event.clientY));
  dragStartY = event.clientY;
  dragStartValue = onCap ? props.modelValue : valueAt(event.clientY);
}

function onPointerMove(event: PointerEvent): void {
  if (!dragging.value) return;
  const fine = event.shiftKey ? 0.18 : 1;
  const delta = ((dragStartY - event.clientY) / travelPx()) * (props.max - props.min) * fine;
  commit(dragStartValue + delta);
}

function onPointerUp(event: PointerEvent): void {
  if (!dragging.value) return;
  dragging.value = false;
  (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
}

function onDoubleClick(): void {
  if (props.disabled || props.defaultValue === undefined) return;
  emit('update:modelValue', props.defaultValue);
}

function onWheel(event: WheelEvent): void {
  if (props.disabled) return;
  event.preventDefault();
  const direction = event.deltaY < 0 ? 1 : -1;
  commit(props.modelValue + direction * stepSize.value * (event.shiftKey ? 1 : 4));
}

function onKeyDown(event: KeyboardEvent): void {
  if (props.disabled) return;
  const big = stepSize.value * 10;
  let next: number | null = null;
  if (event.key === 'ArrowUp' || event.key === 'ArrowRight')
    next = props.modelValue + stepSize.value;
  else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft')
    next = props.modelValue - stepSize.value;
  else if (event.key === 'PageUp') next = props.modelValue + big;
  else if (event.key === 'PageDown') next = props.modelValue - big;
  else if (event.key === 'Home') next = props.min;
  else if (event.key === 'End') next = props.max;
  if (next === null) return;
  event.preventDefault();
  commit(next);
}
</script>

<template>
  <div
    class="fader"
    :class="{ 'fader--dragging': dragging, 'fader--disabled': disabled }"
    :style="{
      '--fader-travel': travel === undefined ? undefined : `${travel}px`,
      '--fader-cap': `${CAP_PX}px`,
      '--fader-norm': norm,
    }"
  >
    <span class="fader__caption" aria-hidden="true">{{ caption ?? label }}</span>
    <div class="fader__body">
      <svg class="fader__scale" viewBox="0 0 8 100" preserveAspectRatio="none" aria-hidden="true">
        <line
          v-for="tick in ticks"
          :key="tick.y"
          class="fader__tick"
          :class="{ 'fader__tick--major': tick.major }"
          :x1="tick.major ? 0 : 3"
          :y1="tick.y"
          x2="8"
          :y2="tick.y"
        />
      </svg>
      <div
        ref="slot"
        class="fader__slot"
        role="slider"
        :tabindex="disabled ? -1 : 0"
        :aria-label="label"
        :aria-valuemin="min"
        :aria-valuemax="max"
        :aria-valuenow="modelValue"
        :aria-valuetext="display"
        :aria-disabled="disabled || undefined"
        :aria-describedby="describedBy"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @dblclick="onDoubleClick"
        @wheel="onWheel"
        @keydown="onKeyDown"
      >
        <span class="fader__track" aria-hidden="true" />
        <span class="fader__cap" aria-hidden="true" />
      </div>
    </div>
    <span class="fader__value">{{ display ?? '' }}</span>
  </div>
</template>

<style scoped>
.fader {
  --fader-len: var(--fader-travel, 96px);

  display: grid;
  gap: 4px;
  justify-items: center;
  min-inline-size: 0;
  user-select: none;
}

.fader--disabled {
  opacity: var(--demo-disabled-opacity, 0.45);
  pointer-events: none;
}

/* Two lines are reserved, so a wrapping caption and a one-word one share a baseline. */
.fader__caption {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  min-block-size: calc(2 * 1.25em);
  max-inline-size: 100%;
  color: var(--plate-ink-dim);
  font-family: var(--font-mono);
  font-size: var(--plate-caption-size);
  font-weight: 600;
  letter-spacing: var(--plate-caption-tracking, 0.08em);
  line-height: 1.25;
  text-align: center;
  text-transform: uppercase;
  text-wrap: balance;
}

.fader__body {
  display: grid;
  grid-template-columns: 8px var(--fader-cap);
  gap: 3px;
  align-items: start;
}

/* The scale sits beside the travel, inset by half a cap so its ends meet the cap's centre. */
.fader__scale {
  block-size: var(--fader-len);
  inline-size: 8px;
  margin-block-start: calc(var(--fader-cap) / 2);
  overflow: visible;
}

.fader__tick {
  stroke: var(--plate-ink-dim);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}

.fader__tick--major {
  stroke: var(--plate-ink);
}

/* The slot is as wide as the cap, which is the touch target for the whole travel. */
.fader__slot {
  position: relative;
  inline-size: var(--fader-cap);
  min-inline-size: 24px;
  block-size: calc(var(--fader-len) + var(--fader-cap));
  border-radius: 3px;
  cursor: ns-resize;
  touch-action: none;
  outline: none;
}

.fader__slot:focus-visible {
  outline: 2px solid var(--plate-focus);
  outline-offset: 3px;
}

.fader__track {
  position: absolute;
  inset-block: calc(var(--fader-cap) / 2);
  inset-inline-start: 50%;
  inline-size: 4px;
  border-radius: 2px;
  /* A dark groove in both finishes: the cap is light, so the slot must not be. */
  background: var(--plate-slot);
  box-shadow:
    inset 0 1px 2px var(--plate-groove),
    0 1px 0 var(--plate-highlight);
  transform: translateX(-50%);
}

/* A light cap with a dark index line; its centre rides the travel by `--fader-norm`. */
.fader__cap {
  position: absolute;
  inset-inline: 0;
  inset-block-start: calc((1 - var(--fader-norm)) * var(--fader-len));
  block-size: var(--fader-cap);
  border: 1px solid var(--plate-cap-edge);
  border-radius: 2px;
  background: linear-gradient(180deg, var(--plate-cap-light), var(--plate-cap));
  box-shadow: 0 1px 2px var(--plate-shadow);
  transition: inset-block-start 0.04s linear;
}

.fader__cap::after {
  content: '';
  position: absolute;
  inset-inline: 2px;
  inset-block-start: calc(50% - 1px);
  block-size: 2px;
  border-radius: 1px;
  background: var(--plate-cap-index);
}

.fader--dragging .fader__cap,
.fader__slot:hover .fader__cap {
  border-color: var(--plate-lamp);
}

/* Reserved width and tabular digits: a value never nudges its neighbours. */
.fader__value {
  min-inline-size: 100%;
  min-block-size: 1.3em;
  color: var(--plate-ink);
  font-family: var(--font-mono);
  font-size: var(--plate-value-size);
  font-variant-numeric: tabular-nums;
  line-height: 1.3;
  text-align: center;
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  .fader__cap {
    transition: none;
  }
}
</style>
