<script setup lang="ts">
import { computed, ref } from 'vue';
import Tooltip from './Tooltip.vue';

const props = withDefaults(
  defineProps<{
    modelValue: number;
    min: number;
    max: number;
    /** Keyboard / wheel increment. Defaults to 1% of the range. */
    step?: number;
    /** Silk-screen label printed above the knob. */
    label: string;
    /** Formatted value readout shown under the knob (and to screen readers). */
    display?: string;
    /** Value restored on double click. */
    defaultValue?: number;
    /** Knob diameter in px. */
    size?: number;
    /** Accent color for the value arc and pointer. */
    accent?: string;
    disabled?: boolean;
    /**
     * Help content. When `body` is set, an "i" info dot appears next to the
     * label and opens a rich {@link Tooltip}. The remaining props mirror the
     * Tooltip API so a `term()` helper can be spread straight onto the knob.
     */
    eyebrow?: string;
    /** Tooltip heading; falls back to {@link label}. Declared so it is not echoed as a native DOM title. */
    title?: string;
    body?: string;
    tip?: string;
    tipLabel?: string;
    defaultRationale?: string;
    defaultLabel?: string;
    href?: string;
    linkLabel?: string;
  }>(),
  {
    step: undefined,
    display: undefined,
    defaultValue: undefined,
    size: 56,
    accent: 'var(--demo-accent)',
    disabled: false,
    eyebrow: undefined,
    title: undefined,
    body: undefined,
    tip: undefined,
    tipLabel: undefined,
    defaultRationale: undefined,
    defaultLabel: undefined,
    href: undefined,
    linkLabel: undefined,
  },
);

const emit = defineEmits<(e: 'update:modelValue', value: number) => void>();

// 270° sweep, gap at the bottom — the classic hardware pot throw.
const START_ANGLE = -135;
const END_ANGLE = 135;
/** Vertical drag distance (px) that covers the full range. */
const DRAG_RANGE_PX = 160;

const dragging = ref(false);

const stepSize = computed(() => props.step ?? (props.max - props.min) / 100);
const norm = computed(() => {
  const span = props.max - props.min || 1;
  return Math.min(1, Math.max(0, (props.modelValue - props.min) / span));
});
const angle = computed(() => START_ANGLE + norm.value * (END_ANGLE - START_ANGLE));

function polar(cx: number, cy: number, r: number, deg: number): { x: number; y: number } {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/** SVG arc path between two angles on the knob's track radius. */
function arcPath(from: number, to: number, r: number): string {
  const start = polar(40, 40, r, from);
  const end = polar(40, 40, r, to);
  const largeArc = to - from > 180 ? 1 : 0;
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

const trackPath = computed(() => arcPath(START_ANGLE, END_ANGLE, 34));
const valuePath = computed(() =>
  norm.value <= 0.002 ? '' : arcPath(START_ANGLE, angle.value, 34),
);

/** Tick marks around the throw (major at both ends and center). */
const ticks = computed(() => {
  const marks = [] as { x1: number; y1: number; x2: number; y2: number; major: boolean }[];
  for (let i = 0; i <= 10; i++) {
    const deg = START_ANGLE + (i / 10) * (END_ANGLE - START_ANGLE);
    const major = i === 0 || i === 5 || i === 10;
    const outer = polar(40, 40, 39, deg);
    const inner = polar(40, 40, major ? 36 : 37.5, deg);
    marks.push({ x1: inner.x, y1: inner.y, x2: outer.x, y2: outer.y, major });
  }
  return marks;
});

const pointer = computed(() => {
  const tip = polar(40, 40, 24, angle.value);
  const base = polar(40, 40, 10, angle.value);
  return { x1: base.x, y1: base.y, x2: tip.x, y2: tip.y };
});

function commit(value: number): void {
  const stepped = Math.round(value / stepSize.value) * stepSize.value;
  const clamped = Math.min(props.max, Math.max(props.min, stepped));
  if (clamped !== props.modelValue) emit('update:modelValue', clamped);
}

let dragStartY = 0;
let dragStartValue = 0;

function onPointerDown(event: PointerEvent): void {
  if (props.disabled) return;
  event.preventDefault();
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  dragging.value = true;
  dragStartY = event.clientY;
  dragStartValue = props.modelValue;
}

function onPointerMove(event: PointerEvent): void {
  if (!dragging.value) return;
  const fine = event.shiftKey ? 0.18 : 1;
  const delta = ((dragStartY - event.clientY) / DRAG_RANGE_PX) * (props.max - props.min) * fine;
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
    class="rotary-knob"
    :class="{ 'rotary-knob--dragging': dragging, 'rotary-knob--disabled': disabled }"
    :style="{ '--knob-size': `${size}px`, '--knob-accent': accent }"
  >
    <span class="rotary-knob__head">
      <span class="rotary-knob__label">{{ label }}</span>
      <Tooltip
        v-if="body"
        :eyebrow="eyebrow"
        :title="title || label"
        :body="body"
        :tip="tip"
        :tip-label="tipLabel"
        :default-rationale="defaultRationale"
        :default-label="defaultLabel"
        :href="href"
        :link-label="linkLabel"
      >
        <button type="button" class="rotary-knob__info" :aria-label="title || label">
          <span aria-hidden="true">i</span>
        </button>
      </Tooltip>
    </span>
    <div
      class="rotary-knob__control"
      role="slider"
      :tabindex="disabled ? -1 : 0"
      :aria-label="label"
      :aria-valuemin="min"
      :aria-valuemax="max"
      :aria-valuenow="modelValue"
      :aria-valuetext="display"
      :aria-disabled="disabled || undefined"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @dblclick="onDoubleClick"
      @wheel="onWheel"
      @keydown="onKeyDown"
    >
      <svg viewBox="0 0 80 80" aria-hidden="true">
        <line
          v-for="(tick, i) in ticks"
          :key="i"
          class="rotary-knob__tick"
          :class="{ 'rotary-knob__tick--major': tick.major }"
          :x1="tick.x1" :y1="tick.y1" :x2="tick.x2" :y2="tick.y2"
        />
        <path class="rotary-knob__track" :d="trackPath" />
        <path v-if="valuePath" class="rotary-knob__value-arc" :d="valuePath" />
        <circle class="rotary-knob__cap" cx="40" cy="40" r="26" />
        <ellipse class="rotary-knob__cap-light" cx="40" cy="32" rx="18" ry="11" />
        <circle class="rotary-knob__cap-rim" cx="40" cy="40" r="26" />
        <line
          class="rotary-knob__pointer"
          :x1="pointer.x1" :y1="pointer.y1" :x2="pointer.x2" :y2="pointer.y2"
        />
      </svg>
    </div>
    <span v-if="display !== undefined" class="rotary-knob__display">{{ display }}</span>
  </div>
</template>

<style scoped>
.rotary-knob {
  display: grid;
  gap: 2px;
  justify-items: center;
  user-select: none;
  width: max-content;
}

.rotary-knob--disabled {
  opacity: var(--demo-disabled-opacity);
  pointer-events: none;
}

.rotary-knob__head {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.rotary-knob__label {
  color: var(--demo-text-muted);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.1em;
  line-height: 1.2;
  text-transform: uppercase;
  white-space: nowrap;
}

.rotary-knob__info {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  padding: 0;
  border: 1px solid var(--demo-border);
  border-radius: 50%;
  background: var(--demo-bg);
  color: var(--demo-text-muted);
  cursor: pointer;
  transition: color var(--transition-fast), border-color var(--transition-fast),
    background-color var(--transition-fast);
}

.rotary-knob__info > span {
  font-family: var(--font-body);
  font-size: 8px;
  font-style: italic;
  font-weight: 700;
  line-height: 1;
  transform: translateY(-0.5px);
}

.rotary-knob__info:hover,
.rotary-knob__info:focus-visible {
  color: var(--demo-accent);
  border-color: var(--demo-accent);
  background: var(--demo-accent-subtle);
  outline: none;
}

.rotary-knob__control {
  width: var(--knob-size);
  height: var(--knob-size);
  border-radius: 50%;
  cursor: ns-resize;
  touch-action: none;
  outline: none;
}

.rotary-knob__control:focus-visible {
  box-shadow: 0 0 0 2px var(--demo-accent-dim);
}

.rotary-knob__control svg {
  display: block;
  width: 100%;
  height: 100%;
}

.rotary-knob__tick {
  stroke: var(--demo-text-faint);
  stroke-width: 1;
  opacity: 0.5;
}

.rotary-knob__tick--major {
  stroke: var(--demo-text-muted);
  stroke-width: 1.4;
  opacity: 0.7;
}

.rotary-knob__track {
  fill: none;
  stroke: var(--demo-track-bg);
  stroke-width: 4;
  stroke-linecap: round;
}

.rotary-knob__value-arc {
  fill: none;
  stroke: var(--knob-accent);
  stroke-width: 4;
  stroke-linecap: round;
  filter: drop-shadow(0 0 3px var(--knob-accent));
  transition: d 0.04s linear;
}

/* The arc glow is a dark-mode effect; drop it on light panels. */
html:not(.dark) .rotary-knob__value-arc {
  filter: none;
}

.rotary-knob__cap {
  fill: var(--demo-control-bg-strong);
}

.rotary-knob__cap-light {
  fill: rgba(255, 255, 255, 0.09);
}

html:not(.dark) .rotary-knob__cap-light {
  fill: rgba(255, 255, 255, 0.55);
}

.rotary-knob__cap-rim {
  fill: none;
  stroke: var(--demo-border-strong);
  stroke-width: 1.2;
}

.rotary-knob--dragging .rotary-knob__cap-rim,
.rotary-knob__control:hover .rotary-knob__cap-rim {
  stroke: var(--knob-accent);
}

.rotary-knob__pointer {
  stroke: var(--demo-text-strong);
  stroke-width: 2.6;
  stroke-linecap: round;
}

.rotary-knob__display {
  min-height: 13px;
  color: var(--demo-text);
  font-family: var(--font-mono);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  line-height: 1.25;
  white-space: nowrap;
}
</style>
