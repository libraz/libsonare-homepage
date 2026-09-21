<script setup lang="ts">
/**
 * Wide, range-adjustable piano keyboard for the practice player.
 *
 * Keys are laid out from the shared {@link KeyboardLayout} so the bed lines up
 * exactly with the falling-note canvas above it: white keys are equal-width
 * columns, black keys straddle the boundary after their preceding white. Keys
 * light from the `active` set (driven by the playhead) and also play on click,
 * so a learner can noodle along with the audio muted.
 */
import { computed } from 'vue';
import type { KeyboardLayout } from './keyboard';

const props = withDefaults(
  defineProps<{
    layout: KeyboardLayout;
    /** MIDI notes currently sounding, for the lit-key state. */
    active: Set<number>;
    /** MIDI notes about to sound, for a faint anticipation pre-glow. */
    upcoming?: Set<number>;
  }>(),
  { upcoming: () => new Set<number>() },
);

const emit = defineEmits<{
  (e: 'note-on', midi: number): void;
  (e: 'note-off', midi: number): void;
}>();

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const whiteCount = computed(() => props.layout.whiteCount);

function labelFor(midi: number): string | undefined {
  return midi % 12 === 0 ? `C${Math.floor(midi / 12) - 1}` : undefined;
}

function isActive(midi: number): boolean {
  return props.active.has(midi);
}

function isUpcoming(midi: number): boolean {
  return props.upcoming.has(midi) && !props.active.has(midi);
}

/** Left edge (in white-key columns) of a black key's center. */
function blackLeft(whiteIndex: number): number {
  return whiteIndex + 1;
}

function press(midi: number, event: PointerEvent): void {
  event.preventDefault();
  (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
  emit('note-on', midi);
}

function glide(midi: number, event: PointerEvent): void {
  if ((event.buttons & 1) === 0) return;
  emit('note-on', midi);
}

function release(midi: number): void {
  emit('note-off', midi);
}
</script>

<template>
  <div class="pk" :style="{ '--white-count': whiteCount }">
    <div class="pk__rail" aria-hidden="true"></div>
    <div class="pk__bed">
      <button
        v-for="key in layout.whiteKeys"
        :key="key.midi"
        type="button"
        class="pk__white"
        :class="{ 'is-active': isActive(key.midi), 'is-upcoming': isUpcoming(key.midi) }"
        :aria-label="`Note ${key.midi}`"
        :aria-pressed="isActive(key.midi)"
        @pointerdown="press(key.midi, $event)"
        @pointerenter="glide(key.midi, $event)"
        @pointerup="release(key.midi)"
        @pointerleave="release(key.midi)"
        @pointercancel="release(key.midi)"
      >
        <span v-if="labelFor(key.midi)" class="pk__name" aria-hidden="true">{{ labelFor(key.midi) }}</span>
      </button>

      <button
        v-for="key in layout.blackKeys"
        :key="key.midi"
        type="button"
        class="pk__black"
        :class="{ 'is-active': isActive(key.midi), 'is-upcoming': isUpcoming(key.midi) }"
        :style="{ left: `calc(${blackLeft(key.whiteIndex)} * (100% / var(--white-count)))` }"
        :aria-label="`Note ${key.midi}`"
        :aria-pressed="isActive(key.midi)"
        @pointerdown="press(key.midi, $event)"
        @pointerenter="glide(key.midi, $event)"
        @pointerup="release(key.midi)"
        @pointerleave="release(key.midi)"
        @pointercancel="release(key.midi)"
      ></button>
    </div>
  </div>
</template>

<style scoped>
.pk {
  /* Keybed palette, mirrored from the synth demo so both demos read as the
     same hardware. Dark is the flagship; light is a true light keybed. */
  --kb-bed: #0c0d12;
  --kb-bed-shadow: rgba(0, 0, 0, 0.8);
  --kb-white: linear-gradient(180deg, #fcfcfd 0%, #f4f4f7 78%, #e4e4ea 96%, #cfcfd8 100%);
  --kb-white-pressed: linear-gradient(180deg, #ddd4f6 0%, #cdbef2 80%, #b9a6ec 100%);
  --kb-black: linear-gradient(180deg, #3a3d47 0%, #23252d 18%, #15161c 85%, #2c2e38 100%);
  --kb-black-pressed: linear-gradient(180deg, #6d57c4 0%, #50409a 60%, #3d3175 100%);

  position: relative;
  width: 100%;
  user-select: none;
  touch-action: none;
}

html:not(.dark) .pk {
  --kb-bed: #d7cfec;
  --kb-bed-shadow: rgba(80, 60, 140, 0.35);
  --kb-white: linear-gradient(180deg, #ffffff 0%, #f6f4fc 74%, #e6e1f3 96%, #d6cfe8 100%);
  --kb-white-pressed: linear-gradient(180deg, var(--color-purple-200) 0%, var(--color-purple-300) 85%, #c9aef6 100%);
  --kb-black: linear-gradient(180deg, #4b4658 0%, #393546 22%, #2c2937 85%, #423d50 100%);
  --kb-black-pressed: linear-gradient(180deg, var(--color-purple-600) 0%, var(--color-purple-700) 60%, var(--color-purple-800) 100%);
}

.pk__rail {
  height: 6px;
  border-radius: 3px 3px 0 0;
  background: linear-gradient(180deg, var(--demo-accent) 0%, color-mix(in srgb, var(--demo-accent) 62%, #000) 100%);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
}

html:not(.dark) .pk__rail {
  box-shadow: 0 1px 3px rgba(80, 60, 140, 0.25);
}

.pk__bed {
  position: relative;
  display: flex;
  height: 132px;
  border-radius: 0 0 8px 8px;
  background: var(--kb-bed);
  /* No horizontal padding: white keys must tile the full width exactly so the
     falling-note canvas above lines up column for column. */
  padding: 0 0 4px;
  box-shadow: inset 0 6px 10px -6px var(--kb-bed-shadow);
}

.pk__white {
  position: relative;
  flex: 1 1 0;
  margin: 0;
  padding: 0 0 7px;
  border: none;
  border-radius: 0 0 4px 4px;
  background: var(--kb-white);
  box-shadow:
    inset -1px 0 0 rgba(0, 0, 0, 0.12),
    inset 0 -3px 0 rgba(0, 0, 0, 0.1);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  transform-origin: top center;
  transition: transform 0.04s ease, background 0.05s ease;
}

.pk__white:focus-visible {
  outline: 2px solid var(--demo-accent);
  outline-offset: -3px;
}

.pk__white.is-active {
  background: var(--kb-white-pressed);
  transform: scaleY(1.012);
  box-shadow:
    inset -1px 0 0 rgba(0, 0, 0, 0.12),
    inset 0 3px 6px rgba(60, 35, 140, 0.28),
    0 0 16px var(--demo-accent-dim);
}

/* Anticipation: a soft top-down wash on the next keys to be played. */
.pk__white.is-upcoming::after,
.pk__black.is-upcoming::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  box-shadow: inset 0 7px 14px -6px var(--demo-accent);
  background: linear-gradient(180deg, var(--demo-accent-subtle), transparent 62%);
  animation: pk-anticipate 0.9s ease-in-out infinite;
}
.pk__black.is-upcoming::after {
  box-shadow: inset 0 6px 12px -5px var(--demo-accent-light);
}
@keyframes pk-anticipate {
  0%, 100% { opacity: 0.45; }
  50% { opacity: 0.9; }
}

.pk__black {
  position: absolute;
  top: 0;
  width: calc((100% / var(--white-count)) * 0.62);
  height: 60%;
  margin: 0;
  padding: 0;
  transform: translateX(-50%);
  border: none;
  border-radius: 0 0 3px 3px;
  background: var(--kb-black);
  box-shadow:
    inset 1px 0 0 rgba(255, 255, 255, 0.08),
    inset -1px 0 0 rgba(0, 0, 0, 0.5),
    inset 0 -4px 0 rgba(0, 0, 0, 0.45),
    0 3px 5px rgba(0, 0, 0, 0.45);
  cursor: pointer;
  z-index: 2;
  transform-origin: top center;
  transition: transform 0.04s ease, background 0.05s ease;
}

.pk__black:focus-visible {
  outline: 2px solid var(--demo-accent-light);
  outline-offset: -3px;
}

.pk__black.is-active {
  background: var(--kb-black-pressed);
  transform: translateX(-50%) scaleY(1.04);
  box-shadow:
    inset 0 -2px 0 rgba(0, 0, 0, 0.4),
    0 0 16px var(--demo-accent-dim);
}

.pk__name {
  color: rgba(0, 0, 0, 0.32);
  font-family: var(--font-mono);
  font-size: 0.5rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  line-height: 1;
  pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
  .pk__white,
  .pk__black {
    transition: background 0.05s ease;
  }
  .pk__white.is-active {
    transform: none;
  }
  .pk__black.is-active {
    transform: translateX(-50%);
  }
  .pk__white.is-upcoming::after,
  .pk__black.is-upcoming::after {
    animation: none;
    opacity: 0.6;
  }
}
</style>
