<script setup lang="ts">
import type { GoldbergMovement } from '@/components/practice/goldberg';
import type { PracticeCopy } from '@/components/practice/practiceCopy';
import { useI18n } from '@/composables/useI18n';

const props = defineProps<{
  copy: PracticeCopy;
  movements: GoldbergMovement[];
  currentMovement: number;
  isBusy: boolean;
  gameMode: boolean;
  midiSupported: boolean | null;
  midiConnected: boolean;
  midiConnecting: boolean;
  /** Access granted but no keyboard is plugged in yet. */
  midiWaiting: boolean;
  /** Permission / availability error message, empty when none. */
  midiError: string;
}>();

const emit = defineEmits<{
  previous: [];
  next: [];
  select: [movement: number];
  toggleGame: [];
  connectMidi: [];
}>();

const { localizedValue } = useI18n();

function movementText(movement: GoldbergMovement): string {
  const label = localizedValue(movement.label);
  const tag = movement.tag ? localizedValue(movement.tag) : '';
  return tag ? `${label} - ${tag}` : label;
}

function onSelect(event: Event): void {
  emit('select', Number((event.target as HTMLSelectElement).value));
}
</script>

<template>
  <div class="practice__bar">
    <div class="practice__selector">
      <span class="practice__select-label demo-label">{{ copy.selector.label }}</span>
      <div class="practice__selector-row">
        <button
          type="button"
          class="practice__nav"
          :disabled="isBusy || currentMovement <= 0"
          :aria-label="copy.selector.prev"
          @click="$emit('previous')"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.4"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <select
          class="practice__select"
          :value="currentMovement"
          :aria-label="copy.selector.aria"
          :disabled="isBusy"
          @change="onSelect"
        >
          <option v-for="movement in movements" :key="movement.no" :value="movement.no">
            {{ movementText(movement) }}
          </option>
        </select>
        <button
          type="button"
          class="practice__nav"
          :disabled="isBusy || currentMovement >= movements.length - 1"
          :aria-label="copy.selector.next"
          @click="$emit('next')"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.4"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </div>
    </div>

    <div class="practice__gamebar">
      <button
        type="button"
        class="practice__game-toggle"
        :class="{ 'is-on': gameMode }"
        :aria-pressed="gameMode"
        @click="$emit('toggleGame')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path
            d="M21 6H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1ZM8 14H6v2H4v-2H2v-2h2v-2h2v2h2v2Zm7 1a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5Zm3-3a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5Z"
          />
        </svg>
        <span>{{ gameMode ? copy.game.on : copy.game.enable }}</span>
      </button>
      <button
        v-if="midiSupported"
        type="button"
        class="practice__midi"
        :class="{ 'is-on': midiConnected }"
        :disabled="midiConnecting"
        @click="$emit('connectMidi')"
      >
        <span class="practice__midi-dot" :class="{ 'is-on': midiConnected }"></span>
        {{ midiConnected ? copy.midi.connected : copy.midi.connect }}
      </button>
      <span v-else class="practice__midi-note">{{ copy.midi.unsupported }}</span>
      <span v-if="midiError" class="practice__midi-note practice__midi-note--error" role="alert">
        {{ copy.midi.denied }}
      </span>
      <span v-else-if="midiWaiting" class="practice__midi-note">{{ copy.midi.waiting }}</span>
    </div>
  </div>
</template>
