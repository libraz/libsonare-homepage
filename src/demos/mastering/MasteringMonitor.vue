<script setup lang="ts">
/**
 * A/B/R monitor selection. The three lanes run together on the engine, so a
 * switch is a fader move with no gap; with matching on, each lane sits at the
 * gain that brings it to the quietest lane. While a loudness is being measured
 * the gains shown are the last ones applied.
 */
import { computed } from 'vue';
import { Tooltip } from '@/components/ui';
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
const selectedIndex = computed(() => MASTERING_LANES.indexOf(props.lane));
const buttons: (HTMLButtonElement | null)[] = [];

/** Arrow keys move the selection among the lanes that can be heard, as a radiogroup does. */
function onKeydown(event: KeyboardEvent, index: number): void {
  const delta =
    event.key === 'ArrowRight' || event.key === 'ArrowDown'
      ? 1
      : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
        ? -1
        : 0;
  if (delta === 0) return;
  event.preventDefault();
  const count = options.value.length;
  for (let step = 1; step < count; step++) {
    const next = (index + delta * step + count) % count;
    if (!options.value[next].unavailable) {
      emit('lane', options.value[next].lane);
      buttons[next]?.focus();
      return;
    }
  }
}
</script>

<template>
  <div class="monitor">
    <div
      class="monitor__lanes"
      :class="{ 'is-matching': matchLoudness && matching }"
      role="radiogroup"
      :aria-label="copy.monitor.name"
      :style="{ '--lane-index': selectedIndex }"
    >
      <span class="monitor__indicator" aria-hidden="true"></span>
      <button
        v-for="(option, index) in options"
        :key="option.lane"
        :ref="(el) => (buttons[index] = el as HTMLButtonElement | null)"
        type="button"
        role="radio"
        class="monitor__lane"
        :class="`monitor__lane--${option.lane}`"
        :aria-checked="lane === option.lane"
        :aria-keyshortcuts="option.key"
        :tabindex="lane === option.lane ? 0 : -1"
        :disabled="disabled || option.unavailable"
        @click="emit('lane', option.lane)"
        @keydown="onKeydown($event, index)"
      >
        <kbd class="demo-kbd">{{ option.key }}</kbd>
        <span class="monitor__name">{{ option.name }}</span>
        <span class="monitor__gain">{{ option.unavailable ? copy.monitor.unavailable : option.gain }}</span>
      </button>
    </div>
    <span class="monitor__match">
      <label>
        <input
          type="checkbox"
          role="switch"
          :checked="matchLoudness"
          :disabled="disabled"
          @change="emit('match', ($event.target as HTMLInputElement).checked)"
        >
        <span>{{ copy.monitor.match }}</span>
      </label>
      <Tooltip :title="copy.monitor.match" :body="copy.monitor.matchHint" :aria-label="copy.monitor.match" />
    </span>
    <span
      class="monitor__matching demo-anim-loop"
      :class="{ 'is-on': matchLoudness && matching }"
      role="status"
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
  --lane-pad: 3px;

  position: relative;
  display: grid;
  flex: 1 1 280px;
  grid-auto-columns: 1fr;
  grid-auto-flow: column;
  padding: var(--lane-pad);
  border: 1px solid var(--demo-border-strong);
  border-radius: var(--demo-radius-sm);
  background: var(--demo-control-bg);
}

/* Slides under the lane being heard, as the shared segmented control's indicator does. */
.monitor__indicator {
  position: absolute;
  top: var(--lane-pad);
  bottom: var(--lane-pad);
  left: var(--lane-pad);
  width: calc((100% - 2 * var(--lane-pad)) / 3);
  border: 1px solid var(--demo-accent);
  border-radius: calc(var(--demo-radius-sm) - var(--lane-pad));
  background: var(--demo-accent-subtle);
  transform: translateX(calc(var(--lane-index) * 100%));
  transition: transform var(--demo-dur-base) var(--demo-ease-standard);
}

.monitor__lane {
  position: relative;
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-rows: auto auto;
  column-gap: 8px;
  align-items: center;
  min-width: 0;
  padding: 5px 9px;
  border: 0;
  border-radius: calc(var(--demo-radius-sm) - var(--lane-pad));
  background: transparent;
  color: var(--demo-text);
  text-align: left;
  cursor: pointer;
  transition:
    color var(--demo-dur-fast) var(--demo-ease-standard),
    transform var(--demo-dur-instant) var(--demo-ease-standard);
}

.monitor__lane:active:not(:disabled) {
  transform: scale(0.97);
}

.monitor__lane .demo-kbd {
  grid-row: span 2;
  transition:
    border-color var(--demo-dur-fast) var(--demo-ease-standard),
    color var(--demo-dur-fast) var(--demo-ease-standard);
}

.monitor__name {
  color: var(--demo-text-strong);
  font-size: 12.5px;
  font-weight: 600;
}

.monitor__gain {
  overflow: hidden;
  color: var(--demo-text-muted);
  font-family: var(--font-mono);
  font-size: 10.5px;
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: opacity var(--demo-dur-fast) var(--demo-ease-standard);
}

.monitor__lane[aria-checked='true'] .demo-kbd {
  border-color: var(--demo-accent);
  color: var(--demo-accent);
}

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
  outline-offset: 1px;
}

.monitor__match {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.monitor__match label {
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

.monitor__matching.is-on {
  animation: monitor-matching 1.2s var(--demo-ease-standard) infinite alternate;
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
