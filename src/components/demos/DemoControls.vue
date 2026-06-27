<script setup lang="ts">
/**
 * Shared parameter-control surface for control-bearing demo archetypes.
 *
 * The counterpart to {@link DemoFrame}: where the frame owns the screen and
 * transport, this owns the row of reader-adjustable controls placed in the
 * frame's `#controls` slot. It renders each {@link ParamDef} generically —
 * `select` as a segmented control, `range` as a slider with a live readout,
 * `toggle` as a switch — so every archetype gets the same instrument look.
 *
 * Values flow through `v-model`: the component never mutates the record in place,
 * it emits a fresh object so parent reactivity (and watchers that regenerate
 * audio) fire on every change.
 */

import { useId } from 'vue';
import { type DemoLocale, localized, type ParamDef } from '@/demos/types';

type ParamValue = number | string | boolean;

const props = defineProps<{
  params: ParamDef[];
  modelValue: Record<string, ParamValue>;
  locale: DemoLocale;
  disabled?: boolean;
}>();

const emit = defineEmits<(e: 'update:modelValue', value: Record<string, ParamValue>) => void>();
const controlsId = useId();

/** Emit a new record with one key changed, keeping the rest intact. */
function set(key: string, value: ParamValue): void {
  emit('update:modelValue', { ...props.modelValue, [key]: value });
}

function unitLabel(p: ParamDef): string {
  if (!p.unit) return '';
  return typeof p.unit === 'string' ? p.unit : localized(p.unit, props.locale);
}

function readout(p: ParamDef): string {
  const v = props.modelValue[p.key];
  return `${v}${unitLabel(p) ? ` ${unitLabel(p)}` : ''}`;
}

/** Percentage the slider track is filled, for the gradient background. */
function fillPct(p: ParamDef): string {
  const min = p.min ?? 0;
  const max = p.max ?? 100;
  const v = Number(props.modelValue[p.key]);
  const t = max > min ? (v - min) / (max - min) : 0;
  return `${Math.min(100, Math.max(0, t * 100))}%`;
}
</script>

<template>
  <div class="dc">
    <div v-for="p in params" :key="p.key" class="dc__field" :class="`dc__field--${p.kind}`">
      <span :id="`${controlsId}-${p.key}-label`" class="dc__label">
        {{ localized(p.label, locale) }}
      </span>

      <!-- select → segmented control -->
      <div
        v-if="p.kind === 'select'"
        class="dc__seg"
        role="group"
        :aria-labelledby="`${controlsId}-${p.key}-label`"
      >
        <button
          v-for="opt in p.options"
          :key="opt.value"
          type="button"
          class="dc__seg-btn"
          :class="{ 'is-on': modelValue[p.key] === opt.value }"
          :disabled="disabled"
          :aria-pressed="modelValue[p.key] === opt.value"
          @click="set(p.key, opt.value)"
        >
          {{ localized(opt.label, locale) }}
        </button>
      </div>

      <!-- range → slider + live readout -->
      <div v-else-if="p.kind === 'range'" class="dc__range">
        <input
          type="range"
          class="dc__slider"
          :style="{ '--fill': fillPct(p) }"
          :min="p.min"
          :max="p.max"
          :step="p.step ?? 1"
          :value="modelValue[p.key] as number"
          :disabled="disabled"
          :aria-labelledby="`${controlsId}-${p.key}-label`"
          :aria-describedby="`${controlsId}-${p.key}-value`"
          @input="set(p.key, Number(($event.target as HTMLInputElement).value))"
        />
        <output :id="`${controlsId}-${p.key}-value`" class="dc__value">{{ readout(p) }}</output>
      </div>

      <!-- toggle → switch -->
      <button
        v-else
        type="button"
        class="dc__switch"
        :class="{ 'is-on': modelValue[p.key] === true }"
        :disabled="disabled"
        role="switch"
        :aria-checked="modelValue[p.key] === true"
        :aria-labelledby="`${controlsId}-${p.key}-label`"
        @click="set(p.key, modelValue[p.key] !== true)"
      >
        <span class="dc__switch-knob" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Instrument-panel controls. Chrome follows the page theme via global tokens,
   so the row stays light in light mode and dark in dark mode. */
.dc {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3) var(--space-5);
}
.dc__field {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}
.dc__label {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--color-text-tertiary);
  white-space: nowrap;
}

/* ── segmented control ─────────────────────────────────────────────────── */
.dc__seg {
  display: inline-flex;
  padding: 2px;
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-full, 999px);
  background: var(--vp-c-bg);
}
.dc__seg-btn {
  appearance: none;
  border: none;
  cursor: pointer;
  padding: 4px 10px;
  border-radius: var(--radius-full, 999px);
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--color-text-secondary);
  background: transparent;
  transition: color var(--transition-fast), background var(--transition-fast),
    box-shadow var(--transition-fast);
}
.dc__seg-btn:hover:not(:disabled) {
  color: var(--color-text-primary);
}
.dc__seg-btn.is-on {
  color: #fff;
  background: linear-gradient(150deg, var(--color-brand-light), var(--color-brand-dark));
  box-shadow: 0 2px 8px -2px color-mix(in srgb, var(--color-brand) 70%, transparent);
}
.dc__seg-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ── range slider ──────────────────────────────────────────────────────── */
.dc__range {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}
.dc__slider {
  -webkit-appearance: none;
  appearance: none;
  width: 124px;
  height: 4px;
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    var(--color-brand) 0%,
    var(--color-brand) var(--fill, 50%),
    var(--color-border-default) var(--fill, 50%)
  );
  cursor: pointer;
}
.dc__slider:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.dc__slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid var(--color-brand);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
  transition: transform var(--transition-fast);
}
.dc__slider::-webkit-slider-thumb:hover {
  transform: scale(1.15);
}
.dc__slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid var(--color-brand);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
}
.dc__value {
  min-width: 4.5ch;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  color: var(--color-brand);
  font-variant-numeric: tabular-nums;
}

/* ── toggle switch ─────────────────────────────────────────────────────── */
.dc__switch {
  position: relative;
  width: 36px;
  height: 20px;
  border-radius: 999px;
  border: 1px solid var(--color-border-default);
  background: var(--vp-c-bg);
  cursor: pointer;
  padding: 0;
  transition: background var(--transition-fast), border-color var(--transition-fast);
}
.dc__switch.is-on {
  background: linear-gradient(150deg, var(--color-brand-light), var(--color-brand-dark));
  border-color: transparent;
}
.dc__switch:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.dc__switch-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  transition: transform var(--transition-fast);
}
.dc__switch.is-on .dc__switch-knob {
  transform: translateX(16px);
}

@media (prefers-reduced-motion: reduce) {
  .dc__seg-btn,
  .dc__switch,
  .dc__switch-knob,
  .dc__slider::-webkit-slider-thumb {
    transition: none;
  }
}
</style>
