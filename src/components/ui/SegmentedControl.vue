<script setup lang="ts">
import { computed } from 'vue';

/** One choice in a {@link SegmentedControl}. */
export interface SegmentedOption {
  id: string;
  label: string;
  disabled?: boolean;
}

/**
 * Single-choice picker: a radiogroup of equal-width segments with a sliding
 * indicator. Arrow keys move the selection; only the checked segment is in
 * the tab order.
 */
const props = withDefaults(
  defineProps<{
    modelValue: string;
    options: SegmentedOption[];
    ariaLabel: string;
    size?: 'sm' | 'md';
    /** Stretch to the full row. Defaults to true for three or more options. */
    fill?: boolean;
  }>(),
  { size: 'md', fill: undefined },
);

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const buttons: (HTMLButtonElement | null)[] = [];

const selectedIndex = computed(() => props.options.findIndex((o) => o.id === props.modelValue));
const isFill = computed(() => props.fill ?? props.options.length >= 3);
const focusIndex = computed(() =>
  selectedIndex.value >= 0 ? selectedIndex.value : props.options.findIndex((o) => !o.disabled),
);

function select(index: number) {
  const option = props.options[index];
  if (!option || option.disabled) return;
  if (option.id !== props.modelValue) emit('update:modelValue', option.id);
}

function step(from: number, delta: 1 | -1): number {
  const count = props.options.length;
  for (let i = 1; i <= count; i++) {
    const next = (from + delta * i + count) % count;
    if (!props.options[next].disabled) return next;
  }
  return from;
}

function onKeydown(event: KeyboardEvent, index: number) {
  let next: number;
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = step(index, 1);
  else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = step(index, -1);
  else if (event.key === 'Home') next = step(-1, 1);
  else if (event.key === 'End') next = step(props.options.length, -1);
  else return;
  event.preventDefault();
  select(next);
  buttons[next]?.focus();
}
</script>

<template>
  <div
    class="segmented"
    :class="[`segmented--${size}`, { 'segmented--fill': isFill }]"
    role="radiogroup"
    :aria-label="ariaLabel"
    :style="{ '--seg-count': options.length, '--seg-index': Math.max(0, selectedIndex) }"
  >
    <span v-if="selectedIndex >= 0" class="segmented__indicator" aria-hidden="true"></span>
    <button
      v-for="(option, index) in options"
      :key="option.id"
      :ref="(el) => (buttons[index] = el as HTMLButtonElement | null)"
      type="button"
      role="radio"
      class="segmented__option"
      :aria-checked="option.id === modelValue"
      :tabindex="index === focusIndex ? 0 : -1"
      :disabled="option.disabled"
      @click="select(index)"
      @keydown="onKeydown($event, index)"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<style scoped>
.segmented {
  --seg-pad: 3px;
  --seg-h: 30px;

  position: relative;
  display: inline-grid;
  grid-auto-columns: 1fr;
  grid-auto-flow: column;
  padding: var(--seg-pad);
  border: 1px solid var(--demo-border);
  border-radius: var(--demo-radius-sm);
  background: var(--demo-control-bg-strong);
}

html:not(.dark) .segmented {
  background: var(--demo-control-bg);
}

.segmented--fill {
  display: grid;
  width: 100%;
}

.segmented--sm {
  --seg-pad: 2px;
  --seg-h: 24px;
}

.segmented__indicator {
  position: absolute;
  top: var(--seg-pad);
  bottom: var(--seg-pad);
  left: var(--seg-pad);
  width: calc((100% - 2 * var(--seg-pad)) / var(--seg-count));
  border-radius: calc(var(--demo-radius-sm) - var(--seg-pad));
  background: var(--demo-accent);
  transform: translateX(calc(var(--seg-index) * 100%));
  transition: transform var(--demo-dur-base) var(--demo-ease-standard);
}

.segmented__option {
  position: relative;
  min-width: 0;
  height: var(--seg-h);
  padding: 0 14px;
  border: 0;
  border-radius: calc(var(--demo-radius-sm) - var(--seg-pad));
  background: transparent;
  color: var(--demo-text-muted);
  cursor: pointer;
  font: inherit;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.05em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition:
    color var(--demo-dur-fast) var(--demo-ease-standard),
    transform var(--demo-dur-instant) var(--demo-ease-standard);
}

.segmented--sm .segmented__option {
  padding: 0 10px;
  font-size: 9px;
}

.segmented__option:hover:not(:disabled) {
  color: var(--demo-text-strong);
}

.segmented__option:active:not(:disabled) {
  transform: scale(0.97);
}

.segmented__option:focus-visible {
  outline: 2px solid var(--demo-accent);
  outline-offset: 1px;
}

.segmented__option[aria-checked='true'],
.segmented__option[aria-checked='true']:hover {
  color: var(--demo-on-accent);
}

.segmented__option:disabled {
  opacity: var(--demo-disabled-opacity);
  cursor: not-allowed;
}
</style>
