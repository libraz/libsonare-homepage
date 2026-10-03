<script setup lang="ts">
/**
 * A/B/R monitor selection. The three lanes run together on the engine, so a
 * switch is a fader move with no gap; with matching on, each lane sits at the
 * gain that brings it to the quietest lane. While a loudness is being measured
 * the gains shown are the last ones applied.
 */
import { computed } from 'vue';
import { useMasteringCopy } from '@/demos/mastering/masteringCopy';
import { MASTERING_LANES, type MasteringLane } from '@/demos/mastering/masteringState';
import { formatNumber } from '@/demos/mastering/masteringUi';

const props = defineProps<{
  lane: MasteringLane;
  matchLoudness: boolean;
  gains: Readonly<Record<MasteringLane, number>>;
  canReference: boolean;
  /** A lane loudness is being measured; the match gains follow when it is known. */
  matching?: boolean;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  lane: [lane: MasteringLane];
  match: [on: boolean];
}>();

const copy = useMasteringCopy();
const KEYS: Record<MasteringLane, string> = { after: 'A', before: 'B', reference: 'R' };

const options = computed(() =>
  MASTERING_LANES.map((lane) => ({
    lane,
    key: KEYS[lane],
    name: copy.value.monitor[lane],
    gain: props.matchLoudness ? `${formatNumber(props.gains[lane], 1, true)} dB` : '0.0 dB',
    unavailable: lane === 'reference' && !props.canReference,
  })),
);
</script>

<template>
  <div class="monitor">
    <div
      class="monitor__lanes"
      :class="{ 'is-matching': matchLoudness && matching }"
      role="radiogroup"
      :aria-label="copy.monitor.name"
    >
      <button
        v-for="option in options"
        :key="option.lane"
        type="button"
        role="radio"
        class="monitor__lane"
        :class="`monitor__lane--${option.lane}`"
        :aria-checked="lane === option.lane"
        :aria-keyshortcuts="option.key"
        :disabled="disabled || option.unavailable"
        :title="option.unavailable ? copy.monitor.noReference : undefined"
        @click="emit('lane', option.lane)"
      >
        <kbd>{{ option.key }}</kbd>
        <span class="monitor__name">{{ option.name }}</span>
        <span class="monitor__gain">{{ option.unavailable ? '—' : option.gain }}</span>
      </button>
    </div>
    <label class="monitor__match" :title="copy.monitor.matchHint">
      <input
        type="checkbox"
        role="switch"
        :checked="matchLoudness"
        :disabled="disabled"
        @change="emit('match', ($event.target as HTMLInputElement).checked)"
      >
      <span>{{ copy.monitor.match }}</span>
    </label>
    <span
      class="monitor__matching"
      :class="{ 'is-on': matchLoudness && matching }"
      role="status"
      :title="copy.monitor.matchingHint"
    >{{ matchLoudness && matching ? copy.monitor.matching : '' }}</span>
  </div>
</template>

<style scoped>
.monitor {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 14px;
}

.monitor__lanes {
  display: flex;
  flex: 1 1 280px;
  border: 1px solid var(--demo-border-strong);
  border-radius: 6px;
  overflow: hidden;
}

.monitor__lane {
  display: grid;
  flex: 1 1 0;
  grid-template-columns: auto 1fr;
  grid-template-rows: auto auto;
  column-gap: 8px;
  align-items: baseline;
  padding: 6px 10px;
  border: 0;
  background: transparent;
  color: var(--demo-text);
  text-align: left;
  cursor: pointer;
}

.monitor__lane + .monitor__lane {
  border-left: 1px solid var(--demo-border-strong);
}

.monitor__lane kbd {
  grid-row: span 2;
  align-self: center;
  color: var(--demo-text-muted);
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
}

.monitor__name {
  color: var(--demo-text-strong);
  font-size: 12.5px;
  font-weight: 600;
}

.monitor__gain {
  color: var(--demo-text-muted);
  font-family: var(--font-mono);
  font-size: 10.5px;
  font-variant-numeric: tabular-nums;
}

.monitor__lane[aria-checked='true'] {
  background: var(--demo-accent-subtle);
  box-shadow: inset 0 -2px 0 var(--demo-accent);
}

.monitor__lane[aria-checked='true'] kbd,
.monitor__lane[aria-checked='true'] .monitor__name {
  color: var(--demo-accent);
}

.monitor__lane:disabled {
  opacity: var(--demo-disabled-opacity);
  cursor: not-allowed;
}

.monitor__lane:focus-visible,
.monitor__match input:focus-visible {
  outline: 2px solid var(--demo-accent);
  outline-offset: -2px;
}

.monitor__match {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--demo-text);
  font-family: var(--font-mono);
  font-size: 11px;
  cursor: pointer;
}

.monitor__match input {
  accent-color: var(--demo-accent);
}

.monitor__matching {
  min-width: 7em;
  color: var(--demo-text-muted);
  font-family: var(--font-mono);
  font-size: 10.5px;
}

.monitor__lanes.is-matching .monitor__gain {
  opacity: 0.55;
}

@media (prefers-reduced-motion: no-preference) {
  .monitor__matching.is-on {
    animation: monitor-matching 1.2s ease-in-out infinite alternate;
  }
}

@keyframes monitor-matching {
  from {
    opacity: 1;
  }

  to {
    opacity: 0.45;
  }
}
</style>
