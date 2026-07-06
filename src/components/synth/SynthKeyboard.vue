<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue';
import { KEY_LAYOUT, type KeyDef } from '@/components/synth/synthCopy';

const props = defineProps<{
  /** Lowest MIDI note (the range's base C). */
  baseNote: number;
  /** Currently sounding MIDI notes, for pressed-key visual state. */
  active: Set<number>;
  /**
   * Octaves to render. When set, the keybed is generated to span this many
   * octaves (ending on the top C) instead of the fixed `KEY_LAYOUT` span, so a
   * wide-range instrument (e.g. piano) gets a full keyboard. Computer-keyboard
   * hints are kept only for the notes `KEY_LAYOUT` covers.
   */
  octaves?: number;
}>();

const emit = defineEmits<{
  (e: 'note-on', note: number, velocity: number): void;
  (e: 'note-off', note: number): void;
}>();

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

interface RenderKey extends KeyDef {
  note: number;
  /** Index among white keys, used to position black keys. */
  whiteIndex: number;
  /** Note name printed on the key (C keys only, like a real keybed). */
  name?: string;
}

/** Computer-keyboard hint per semitone, taken from the canonical layout. */
const PC_BY_SEMITONE = new Map(
  KEY_LAYOUT.filter((k) => k.pc).map((k) => [k.semitone, k.pc as string]),
);
/** Semitones-in-octave that are accidental (black) keys. */
const BLACK_PCS = new Set([1, 3, 6, 8, 10]);

/** The key layout to render: the fixed one, or a generated wide-range keybed. */
const layout = computed<KeyDef[]>(() => {
  if (props.octaves == null) return KEY_LAYOUT;
  const out: KeyDef[] = [];
  // Inclusive of the final top C, so the keybed reads as full octaves.
  for (let s = 0; s <= props.octaves * 12; ++s) {
    out.push({ semitone: s, black: BLACK_PCS.has(s % 12), pc: PC_BY_SEMITONE.get(s) });
  }
  return out;
});

const keys = computed<RenderKey[]>(() => {
  let whiteIndex = -1;
  return layout.value.map((k) => {
    if (!k.black) whiteIndex += 1;
    const note = props.baseNote + k.semitone;
    const name =
      note % 12 === 0 ? `${NOTE_NAMES[note % 12]}${Math.floor(note / 12) - 1}` : undefined;
    return { ...k, note, whiteIndex, name };
  });
});

const whiteKeys = computed(() => keys.value.filter((k) => !k.black));
const blackKeys = computed(() => keys.value.filter((k) => k.black));
const whiteCount = computed(() => whiteKeys.value.length);

/** Left offset (in white-key widths) for a black key sitting after its white. */
function blackLeft(key: RenderKey): number {
  return key.whiteIndex + 1;
}

function isActive(note: number): boolean {
  return props.active.has(note);
}

/** Press depth → velocity: striking lower on the key plays louder. */
function velocityFromEvent(event: PointerEvent): number {
  const target = event.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  const depth = rect.height > 0 ? (event.clientY - rect.top) / rect.height : 1;
  return Math.round(64 + Math.min(1, Math.max(0, depth)) * 56);
}

/** Notes this keyboard is currently sounding, so a pointerup anywhere (even off
 *  a key, where the per-key handler never fires) reliably releases them. Without
 *  this, a mouse-up that lands off the pressed key leaves the note stuck on. */
const pressed = new Set<number>();

function press(note: number, event: PointerEvent): void {
  event.preventDefault();
  // Release implicit capture so dragging across keys plays a glissando.
  (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
  if (pressed.has(note)) return;
  pressed.add(note);
  emit('note-on', note, velocityFromEvent(event));
}

function glide(note: number, event: PointerEvent): void {
  if ((event.buttons & 1) === 0) return;
  if (pressed.has(note)) return;
  pressed.add(note);
  emit('note-on', note, velocityFromEvent(event));
}

function release(note: number): void {
  if (!pressed.delete(note)) return;
  emit('note-off', note);
}

/** Release every held note on a global pointer-up (the safety net). */
function releaseAllPressed(): void {
  for (const note of pressed) emit('note-off', note);
  pressed.clear();
}

onMounted(() => {
  window.addEventListener('pointerup', releaseAllPressed);
  window.addEventListener('pointercancel', releaseAllPressed);
});

onBeforeUnmount(() => {
  window.removeEventListener('pointerup', releaseAllPressed);
  window.removeEventListener('pointercancel', releaseAllPressed);
});
</script>

<template>
  <div class="synth-keyboard" :style="{ '--white-count': whiteCount }">
    <div class="synth-keyboard__rail" aria-hidden="true"></div>
    <div class="synth-keyboard__bed">
      <button
        v-for="key in whiteKeys"
        :key="key.note"
        type="button"
        class="synth-keyboard__white"
        :class="{ 'is-active': isActive(key.note) }"
        :aria-label="`Note ${key.note}`"
        :aria-pressed="isActive(key.note)"
        @pointerdown="press(key.note, $event)"
        @pointerenter="glide(key.note, $event)"
        @pointerup="release(key.note)"
        @pointerleave="release(key.note)"
        @pointercancel="release(key.note)"
      >
        <span v-if="key.name" class="synth-keyboard__name" aria-hidden="true">{{ key.name }}</span>
        <span v-if="key.pc" class="synth-keyboard__hint" aria-hidden="true">{{ key.pc.toUpperCase() }}</span>
      </button>

      <button
        v-for="key in blackKeys"
        :key="key.note"
        type="button"
        class="synth-keyboard__black"
        :class="{ 'is-active': isActive(key.note) }"
        :style="{ left: `calc(${blackLeft(key)} * (100% / var(--white-count)))` }"
        :aria-label="`Note ${key.note}`"
        :aria-pressed="isActive(key.note)"
        @pointerdown="press(key.note, $event)"
        @pointerenter="glide(key.note, $event)"
        @pointerup="release(key.note)"
        @pointerleave="release(key.note)"
        @pointercancel="release(key.note)"
      >
        <span v-if="key.pc" class="synth-keyboard__hint synth-keyboard__hint--black">{{ key.pc.toUpperCase() }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.synth-keyboard {
  /* Keybed palette — explicit per theme so both reads as intentional hardware.
     Dark is the flagship look (deep bed, near-black sharps); light is a true
     light keybed (lavender felt, near-white naturals, deep-grey sharps). */
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

html:not(.dark) .synth-keyboard {
  /* Lavender felt bed derived from the elevated-surface tones. */
  --kb-bed: #d7cfec;
  --kb-bed-shadow: rgba(80, 60, 140, 0.35);
  --kb-white: linear-gradient(180deg, #ffffff 0%, #f6f4fc 74%, #e6e1f3 96%, #d6cfe8 100%);
  --kb-white-pressed: linear-gradient(180deg, var(--color-purple-200) 0%, var(--color-purple-300) 85%, #c9aef6 100%);
  --kb-black: linear-gradient(180deg, #4b4658 0%, #393546 22%, #2c2937 85%, #423d50 100%);
  --kb-black-pressed: linear-gradient(180deg, var(--color-purple-600) 0%, var(--color-purple-700) 60%, var(--color-purple-800) 100%);
}

/* Felt strip above the keybed. */
.synth-keyboard__rail {
  height: 7px;
  border-radius: 3px 3px 0 0;
  background: linear-gradient(180deg, var(--demo-accent) 0%, color-mix(in srgb, var(--demo-accent) 62%, #000) 100%);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
}

html:not(.dark) .synth-keyboard__rail {
  box-shadow: 0 1px 3px rgba(80, 60, 140, 0.25);
}

.synth-keyboard__bed {
  position: relative;
  display: flex;
  height: 140px;
  border-radius: 0 0 8px 8px;
  background: var(--kb-bed);
  padding: 0 1px 4px;
  box-shadow: inset 0 6px 10px -6px var(--kb-bed-shadow);
}

.synth-keyboard__white {
  position: relative;
  flex: 1 1 0;
  margin: 0 1px;
  padding: 0;
  border: none;
  border-radius: 0 0 5px 5px;
  background: var(--kb-white);
  box-shadow:
    inset 0 -3px 0 rgba(0, 0, 0, 0.12),
    inset -1px 0 0 rgba(0, 0, 0, 0.05);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  padding-bottom: 8px;
  transform-origin: top center;
  transition: transform 0.04s ease, background 0.05s ease;
}

/* Inset ring: an outer ring would be clipped between adjacent keys. */
.synth-keyboard__white:focus-visible {
  outline: 2px solid var(--demo-accent);
  outline-offset: -3px;
}

.synth-keyboard__white.is-active {
  background: var(--kb-white-pressed);
  transform: scaleY(1.015);
  box-shadow:
    inset 0 -1px 0 rgba(0, 0, 0, 0.18),
    inset 0 3px 6px rgba(60, 35, 140, 0.28),
    0 0 14px var(--demo-accent-dim);
}

.synth-keyboard__black {
  position: absolute;
  top: 0;
  width: calc((100% / var(--white-count)) * 0.6);
  height: 60%;
  margin: 0;
  padding: 0 0 6px;
  transform: translateX(-50%);
  border: none;
  border-radius: 0 0 4px 4px;
  background: var(--kb-black);
  box-shadow:
    inset 1px 0 0 rgba(255, 255, 255, 0.08),
    inset -1px 0 0 rgba(0, 0, 0, 0.5),
    inset 0 -4px 0 rgba(0, 0, 0, 0.45),
    0 3px 5px rgba(0, 0, 0, 0.45);
  cursor: pointer;
  z-index: 2;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  transform-origin: top center;
  transition: transform 0.04s ease, background 0.05s ease;
}

/* Inset ring: an outer ring would be clipped between adjacent keys. */
.synth-keyboard__black:focus-visible {
  outline: 2px solid var(--demo-accent-light);
  outline-offset: -3px;
}

.synth-keyboard__black.is-active {
  background: var(--kb-black-pressed);
  transform: translateX(-50%) scaleY(1.04);
  box-shadow:
    inset 0 -2px 0 rgba(0, 0, 0, 0.4),
    0 0 14px var(--demo-accent-dim);
}

/* PC-shortcut printed as a physical keycap, clearly distinct from note names. */
.synth-keyboard__hint {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 15px;
  height: 15px;
  padding: 0 3px;
  border: 1px solid rgba(0, 0, 0, 0.16);
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.6);
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.14);
  color: rgba(0, 0, 0, 0.42);
  font-family: var(--font-mono);
  font-size: 0.58rem;
  font-weight: 700;
  line-height: 1;
  pointer-events: none;
}

.synth-keyboard__white.is-active .synth-keyboard__hint {
  border-color: rgba(60, 35, 140, 0.3);
  background: rgba(255, 255, 255, 0.55);
  color: rgba(40, 20, 90, 0.75);
}

.synth-keyboard__hint--black {
  border-color: rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.1);
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.5);
  color: rgba(255, 255, 255, 0.62);
}

@media (prefers-reduced-motion: reduce) {
  .synth-keyboard__white,
  .synth-keyboard__black {
    transition: background 0.05s ease;
  }

  .synth-keyboard__white.is-active {
    transform: none;
  }

  .synth-keyboard__black.is-active {
    transform: translateX(-50%);
  }
}

/* Note name printed above the keycap hint, so the keycap row stays aligned. */
.synth-keyboard__name {
  color: rgba(0, 0, 0, 0.3);
  font-family: var(--font-mono);
  font-size: 0.52rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  line-height: 1;
  pointer-events: none;
}
</style>
