<script lang="ts">
/** Visitor-facing copy for {@link CorrelationMeter}; the demo passes its own locale. */
export interface CorrelationMeterLabels {
  /** Accessible name of the meter. */
  name: string;
}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import { tickText } from '@/components/meters/meterBallistics';

const props = defineProps<{
  /** Stereo correlation in [-1, +1]; +1 is mono, negative cancels in mono. NaN shows no needle. */
  correlation: number;
  labels: CorrelationMeterLabels;
}>();

const known = computed(() => Number.isFinite(props.correlation));
const value = computed(() => (known.value ? Math.max(-1, Math.min(1, props.correlation)) : 0));

/** Bar grows from the centre towards the reading. */
const bar = computed(() => {
  const half = Math.abs(value.value) * 50;
  return value.value >= 0
    ? { left: '50%', width: `${half.toFixed(2)}%` }
    : { left: `${(50 - half).toFixed(2)}%`, width: `${half.toFixed(2)}%` };
});

const readout = computed(() => {
  if (!known.value) return '—';
  const text = value.value.toFixed(2);
  if (text === '-0.00') return '0.00';
  return value.value > 0 ? `+${text}` : tickText(text);
});

/** Two-decimal reading for assistive tech, matching the printed value. */
const ariaNow = computed(() => Math.round(value.value * 100) / 100);
</script>

<template>
  <div
    class="corr-meter"
    role="meter"
    :aria-label="labels.name"
    aria-valuemin="-1"
    aria-valuemax="1"
    :aria-valuenow="ariaNow"
    :aria-valuetext="readout"
  >
    <div class="corr-meter__track" aria-hidden="true">
      <span class="corr-meter__centre" />
      <div
        v-if="known"
        class="corr-meter__bar"
        :class="value < 0 ? 'corr-meter__bar--negative' : 'corr-meter__bar--positive'"
        :style="bar"
      />
    </div>
    <div class="corr-meter__scale" aria-hidden="true">
      <span>-1</span>
      <span>0</span>
      <span>+1</span>
    </div>
    <span
      class="corr-meter__readout"
      :class="{ 'corr-meter__readout--negative': known && value < 0 }"
      aria-hidden="true"
    >{{ readout }}</span>
  </div>
</template>

<style scoped>
.corr-meter {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 2px 10px;
  font-family: var(--font-mono);
  color: var(--demo-text-muted);
}

.corr-meter__track {
  position: relative;
  height: 8px;
  overflow: hidden;
  border: 1px solid var(--demo-border);
  border-radius: 3px;
  background: var(--demo-control-bg-strong);
}

.corr-meter__centre {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 1px;
  background: var(--demo-border-strong);
}

.corr-meter__bar {
  position: absolute;
  top: 0;
  bottom: 0;
}

.corr-meter__bar--positive {
  background: var(--demo-status-ok);
}

.corr-meter__bar--negative {
  background: var(--demo-clip);
}

.corr-meter__scale {
  display: flex;
  justify-content: space-between;
  grid-column: 1;
  font-size: var(--demo-label-size);
  line-height: 1;
  font-variant-numeric: tabular-nums;
  color: var(--demo-text-faint);
}

.corr-meter__readout {
  grid-column: 2;
  grid-row: 1;
  min-width: 5ch;
  font-size: 11px;
  font-weight: 500;
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: var(--demo-text-strong);
}

/* Colour is not the only cue: the sign is printed too. */
.corr-meter__readout--negative {
  color: var(--demo-clip);
}
</style>
