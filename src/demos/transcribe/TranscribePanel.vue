<script setup lang="ts">
import { computed } from 'vue';
import { RotaryKnob, SegmentedControl, TermLabel } from '@/components/ui';
import {
  DEFAULT_SETTINGS,
  type DetectorMode,
  type DetectorSettings,
  formatDivision,
  formatKnob,
  isDefault,
  KNOB_RANGES,
  type KnobKey,
  MIN_NOTE_MS_DEFAULT,
  MONO_ONLY,
  NOTE_DIVISIONS,
  type NoteDivision,
  POLY_ONLY,
  readBy,
} from './detectorSettings';
import type { TranscribeCopy } from './transcribeCopy';

const props = defineProps<{
  copy: TranscribeCopy;
  settings: DetectorSettings;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  mode: [mode: DetectorMode];
  knob: [key: KnobKey, value: number];
  tuning: [auto: boolean];
  division: [division: NoteDivision];
  reset: [];
}>();

const MODES: readonly DetectorMode[] = ['poly', 'mono'];

/** Path-independent knobs first, then the ones only one path reads. */
const SHARED: readonly KnobKey[] = ['minNoteMs', 'velocityFloorDb'];

const d = computed(() => props.copy.detector);
const modeOptions = computed(() =>
  MODES.map((mode) => ({ id: mode, label: d.value.modes[mode], disabled: props.disabled })),
);
const divisionOptions = computed(() =>
  NOTE_DIVISIONS.map((n) => ({
    id: String(n),
    label: formatDivision(n, d.value.division.off),
    disabled: props.disabled,
  })),
);
const tuningOptions = computed(() => [
  { id: 'fixed', label: d.value.tuningFixed, disabled: props.disabled },
  { id: 'auto', label: d.value.tuningAuto, disabled: props.disabled },
]);
const atDefault = computed(() => isDefault(props.settings));

/** Every knob in one grid, shared first; the path-only ones carry their path's colour. */
const KNOBS: readonly KnobKey[] = [...SHARED, ...POLY_ONLY, ...MONO_ONLY];

function pathOf(key: KnobKey): DetectorMode | null {
  if (POLY_ONLY.includes(key)) return 'poly';
  if (MONO_ONLY.includes(key)) return 'mono';
  return null;
}

const ACCENT: Record<DetectorMode, string> = {
  poly: 'var(--demo-cyan)',
  mono: 'var(--demo-amber)',
};

function accentOf(key: KnobKey): string | undefined {
  const path = pathOf(key);
  return path ? ACCENT[path] : undefined;
}

function inactive(key: KnobKey): boolean {
  return !readBy(key, props.settings);
}

function defaultOf(key: KnobKey): number {
  return key === 'minNoteMs' ? MIN_NOTE_MS_DEFAULT[props.settings.mode] : DEFAULT_SETTINGS[key];
}

function help(item: { title: string; body: string; tip: string }) {
  return {
    eyebrow: d.value.helpEyebrow,
    title: item.title,
    body: item.body,
    tip: item.tip,
    tipLabel: d.value.tipLabel,
  };
}

function onKnob(key: KnobKey, value: number): void {
  const step = KNOB_RANGES[key].step;
  emit('knob', key, Math.round(value / step) * step);
}
</script>

<template>
  <section class="tx-panel" :aria-label="d.title">
    <header class="tx-panel__head">
      <h2 class="tx-panel__title demo-label">{{ d.title }}</h2>
      <button
        type="button"
        class="demo-btn demo-btn--sm"
        :disabled="atDefault || disabled"
        :aria-label="d.resetAria"
        @click="emit('reset')"
      >
        {{ d.reset }}
      </button>
    </header>

    <div class="tx-panel__field">
      <TermLabel class="tx-panel__field-label" v-bind="help(d.modeHelp)">{{ d.mode }}</TermLabel>
      <SegmentedControl
        :model-value="settings.mode"
        :options="modeOptions"
        :ariaLabel="d.modeAria"
        fill
        @update:model-value="emit('mode', $event as DetectorMode)"
      />
    </div>
    <div class="tx-panel__field">
      <TermLabel class="tx-panel__field-label" v-bind="help(d.tuningHelp)">{{ d.tuning }}</TermLabel>
      <SegmentedControl
        :model-value="settings.autoTuning ? 'auto' : 'fixed'"
        :options="tuningOptions"
        :ariaLabel="d.tuningAria"
        fill
        @update:model-value="emit('tuning', $event === 'auto')"
      />
    </div>

    <div class="tx-panel__field">
      <TermLabel class="tx-panel__field-label" v-bind="help(d.division.help)">{{ d.division.label }}</TermLabel>
      <SegmentedControl
        :model-value="String(settings.minNoteDivision)"
        :options="divisionOptions"
        :ariaLabel="d.division.aria"
        size="sm"
        @update:model-value="emit('division', Number($event) as NoteDivision)"
      />
    </div>

    <div class="tx-panel__knobs-head">
      <span class="tx-panel__group-tag">{{ d.knobsTitle }}</span>
      <span class="tx-panel__paths">
        <span class="tx-panel__path tx-panel__path--poly">{{ d.polyOnly }}</span>
        <span class="tx-panel__path tx-panel__path--mono">{{ d.monoOnly }}</span>
      </span>
    </div>
    <div class="tx-panel__knobs">
      <div
        v-for="key in KNOBS"
        :key="key"
        class="tx-panel__knob"
        :class="{ 'is-inactive': inactive(key) }"
      >
        <RotaryKnob
          :label="d.knobs[key].label"
          :model-value="settings[key]"
          :min="KNOB_RANGES[key].min"
          :max="KNOB_RANGES[key].max"
          :step="KNOB_RANGES[key].step"
          :default-value="defaultOf(key)"
          :display="formatKnob(key, settings[key], d.off)"
          :size="48"
          :disabled="inactive(key) || disabled"
          :accent="accentOf(key)"
          v-bind="help(d.knobs[key])"
          @update:model-value="onKnob(key, $event)"
        />
      </div>
    </div>
  </section>
</template>
