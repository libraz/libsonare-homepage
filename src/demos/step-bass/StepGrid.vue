<script setup lang="ts">
/**
 * The sixteen steps, as four lanes a visitor can walk with the arrow keys.
 *
 * Two of the lanes carry a flag the engine only reads under a condition, and
 * the grid says so where the flag is rather than in a paragraph underneath:
 * an accent is latched at a note-on, so a hold or a rest cannot take one, and
 * the last step's slide can move pitch but not carry the envelope across the
 * wrap. Both are drawn as an unavailable cell and spelled out for the selected
 * step, because a flag that can be set and does nothing is the defect this
 * panel exists to avoid.
 *
 * Accent and slide are told apart by shape — a ring and an arrow — so the
 * lanes still read with the colours removed.
 */
import { computed, nextTick, ref, watch } from 'vue';
import { TransportButton } from '@/components/ui';
import type { StepBassCopy } from '@/demos/step-bass/stepBassCopy';
import { STEP_COUNT } from '@/demos/step-bass/stepBassPatch';
import { STEP_NOTE_MAX, STEP_NOTE_MIN } from '@/demos/step-bass/stepBassPatterns';
import type { Step, StepGate } from '@/demos/step-bass/stepBassTypes';

const props = defineProps<{
  steps: readonly Step[];
  copy: StepBassCopy;
  /** Step the transport is on, or -1 while it is stopped. */
  playhead: number;
  /** Two banks of eight rather than one row of sixteen. */
  folded: boolean;
}>();

const emit = defineEmits<{ update: [index: number, step: Step] }>();

const LANES = ['note', 'gate', 'accent', 'slide'] as const;
type Lane = (typeof LANES)[number];

const GATE_CYCLE: StepGate[] = ['note', 'tie', 'rest'];

const PITCH_CLASSES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** Vertical drag distance that moves the pitch by one semitone. */
const DRAG_PX_PER_SEMITONE = 8;

function noteName(midi: number): string {
  return `${PITCH_CLASSES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`));
}

/** Half-open step ranges: one bank of sixteen, or two of eight. */
const banks = computed<[number, number][]>(() =>
  props.folded
    ? [
        [0, STEP_COUNT / 2],
        [STEP_COUNT / 2, STEP_COUNT],
      ]
    : [[0, STEP_COUNT]],
);

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from }, (_, i) => from + i);
}

/** Steps per beat; each beat is set apart by a wider gutter, as on the bench. */
const BEAT = 4;

/** Equal step tracks with a narrow spacer track between beats. */
function bankColumns(from: number, to: number): string {
  const beats = Array.from({ length: (to - from) / BEAT }, () => `repeat(${BEAT}, minmax(0, 1fr))`);
  return `var(--sb-gutter) ${beats.join(' var(--sb-beat-gap) ')}`;
}

/** Grid column of a step, skipping the spacer tracks. */
function column(index: number, from: number): string {
  const at = index - from;
  return String(2 + at + Math.floor(at / BEAT));
}

// ------------------------------------------------------------ cell states

/** An accent is latched at a note-on, so only a struck step can hold one. */
function accentState(index: number): 'on' | 'off' | 'unavailable' {
  const step = props.steps[index];
  if (step.gate !== 'note') return 'unavailable';
  return step.accent ? 'on' : 'off';
}

/**
 * A slide needs a note to leave and a struck note to arrive at. The last step
 * has both across the wrap, but the loop releases the voice as it rewinds, so
 * what survives is the pitch and not the envelope.
 */
function slideState(index: number): 'active' | 'pitch-only' | 'inert' | 'off' | 'unavailable' {
  const step = props.steps[index];
  if (step.gate === 'rest') return 'unavailable';
  if (!step.slide) return 'off';
  if (props.steps[(index + 1) % STEP_COUNT].gate !== 'note') return 'inert';
  return index === STEP_COUNT - 1 ? 'pitch-only' : 'active';
}

function gateLabel(gate: StepGate): string {
  return props.copy.grid.gates[gate];
}

function cellValueText(lane: Lane, index: number): string {
  const step = props.steps[index];
  const grid = props.copy.grid;
  if (lane === 'note') return step.gate === 'note' ? noteName(step.note) : grid.unavailable;
  if (lane === 'gate') return gateLabel(step.gate);
  if (lane === 'accent') {
    const state = accentState(index);
    return state === 'unavailable' ? grid.unavailable : state === 'on' ? grid.on : grid.off;
  }
  const state = slideState(index);
  if (state === 'unavailable') return grid.unavailable;
  if (state === 'pitch-only') return grid.pitchOnlyBadge;
  if (state === 'inert') return grid.slideInert;
  return state === 'active' ? grid.on : grid.off;
}

function cellLabel(lane: Lane, index: number): string {
  const head = fill(props.copy.grid.cell, {
    n: index + 1,
    lane: props.copy.grid.lanes[lane],
  });
  return `${head}: ${cellValueText(lane, index)}`;
}

// ------------------------------------------------------------- navigation

const cursor = ref({ lane: 0, step: 0 });
const cells = new Map<string, HTMLElement>();

function cellKey(lane: number, step: number): string {
  return `${lane}:${step}`;
}

function registerCell(lane: number, step: number, el: unknown): void {
  const key = cellKey(lane, step);
  if (el instanceof HTMLElement) cells.set(key, el);
  else cells.delete(key);
}

function isCursor(lane: number, step: number): boolean {
  return cursor.value.lane === lane && cursor.value.step === step;
}

function focusCursor(): void {
  cells.get(cellKey(cursor.value.lane, cursor.value.step))?.focus();
}

function moveTo(lane: number, step: number): void {
  cursor.value = { lane, step };
  void nextTick(focusCursor);
}

/** The fold rebuilds the cells, so the cursor has to be handed its new element. */
watch(
  () => props.folded,
  () => {
    const held = cells.get(cellKey(cursor.value.lane, cursor.value.step));
    if (held !== document.activeElement) return;
    void nextTick(focusCursor);
  },
);

function onCellKeydown(event: KeyboardEvent, lane: number, step: number): void {
  const last = STEP_COUNT - 1;
  let nextLane = lane;
  let nextStep = step;
  switch (event.key) {
    case 'ArrowLeft':
      nextStep = Math.max(0, step - 1);
      break;
    case 'ArrowRight':
      nextStep = Math.min(last, step + 1);
      break;
    case 'ArrowUp':
      nextLane = Math.max(0, lane - 1);
      break;
    case 'ArrowDown':
      nextLane = Math.min(LANES.length - 1, lane + 1);
      break;
    case 'Home':
      nextStep = 0;
      break;
    case 'End':
      nextStep = last;
      break;
    default:
      if (LANES[lane] === 'note') onPitchKeydown(event, step);
      return;
  }
  event.preventDefault();
  moveTo(nextLane, nextStep);
}

function onPitchKeydown(event: KeyboardEvent, index: number): void {
  const moves: Record<string, number> = {
    '+': 1,
    '=': 1,
    '-': -1,
    _: -1,
    PageUp: 12,
    PageDown: -12,
  };
  const delta = moves[event.key];
  if (delta === undefined) return;
  event.preventDefault();
  nudgePitch(index, delta);
}

// ----------------------------------------------------------------- edits

function patchStep(index: number, changes: Partial<Step>): void {
  emit('update', index, { ...props.steps[index], ...changes });
}

function nudgePitch(index: number, delta: number): void {
  const step = props.steps[index];
  if (step.gate !== 'note') return;
  const note = Math.min(STEP_NOTE_MAX, Math.max(STEP_NOTE_MIN, step.note + delta));
  if (note !== step.note) patchStep(index, { note });
}

function cycleGate(index: number): void {
  const at = GATE_CYCLE.indexOf(props.steps[index].gate);
  patchStep(index, { gate: GATE_CYCLE[(at + 1) % GATE_CYCLE.length] });
}

function toggleAccent(index: number): void {
  if (accentState(index) === 'unavailable') return;
  patchStep(index, { accent: !props.steps[index].accent });
}

function toggleSlide(index: number): void {
  if (slideState(index) === 'unavailable') return;
  patchStep(index, { slide: !props.steps[index].slide });
}

function onCellClick(lane: Lane, index: number): void {
  cursor.value = { lane: LANES.indexOf(lane), step: index };
  if (lane === 'gate') cycleGate(index);
  else if (lane === 'accent') toggleAccent(index);
  else if (lane === 'slide') toggleSlide(index);
}

// ------------------------------------------------------------ pitch drag

let drag: { index: number; startY: number; startNote: number } | null = null;

function onPitchPointerDown(event: PointerEvent, index: number): void {
  cursor.value = { lane: 0, step: index };
  if (props.steps[index].gate !== 'note') return;
  event.preventDefault();
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  drag = { index, startY: event.clientY, startNote: props.steps[index].note };
}

function onPitchPointerMove(event: PointerEvent): void {
  if (!drag) return;
  const semitones = Math.round((drag.startY - event.clientY) / DRAG_PX_PER_SEMITONE);
  const note = Math.min(STEP_NOTE_MAX, Math.max(STEP_NOTE_MIN, drag.startNote + semitones));
  if (note !== props.steps[drag.index].note) patchStep(drag.index, { note });
}

function onPitchPointerUp(event: PointerEvent): void {
  if (!drag) return;
  drag = null;
  (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
}

// -------------------------------------------------------------- selection

const selected = computed(() => cursor.value.step);
const selectedStep = computed(() => props.steps[selected.value]);
const selectedAccent = computed(() => accentState(selected.value));
const selectedSlide = computed(() => slideState(selected.value));
const selectedSlideOff = computed(
  () => selectedSlide.value === 'off' || selectedSlide.value === 'unavailable',
);

/** Why the selected step's flags do or do not reach the engine. */
const reasons = computed(() => {
  const grid = props.copy.grid;
  const notes: string[] = [];
  if (selectedStep.value.gate !== 'note') notes.push(grid.pitchUnavailable);
  if (selectedAccent.value === 'unavailable') notes.push(grid.accentUnavailable);
  if (selectedSlide.value === 'unavailable') notes.push(grid.slideUnavailable);
  else if (selectedSlide.value === 'inert') notes.push(grid.slideInert);
  else if (selectedSlide.value === 'pitch-only') notes.push(grid.slidePitchOnly);
  return notes;
});
</script>

<template>
  <div class="step-grid">
    <div class="step-grid__banks">
      <div
        v-for="([from, to], bank) in banks"
        :key="bank"
        class="step-grid__bank"
        role="grid"
        :aria-label="fill(copy.grid.bank, { a: from + 1, b: to })"
        :style="{ '--sb-columns': bankColumns(from, to) }"
      >
        <div class="step-grid__row step-grid__row--ruler" role="row">
          <span class="step-grid__gutter" role="columnheader">{{ copy.grid.ruler }}</span>
          <span
            v-for="index in range(from, to)"
            :key="index"
            class="step-grid__tick"
            role="columnheader"
            :style="{ gridColumn: column(index, from) }"
            :class="{
              'step-grid__tick--beat': index % 4 === 0,
              'step-grid__tick--playing': index === playhead,
            }"
          >{{ index + 1 }}</span>
        </div>

        <div v-for="(lane, row) in LANES" :key="lane" class="step-grid__row" role="row">
          <span class="step-grid__gutter" role="rowheader">{{ copy.grid.lanes[lane] }}</span>
          <span
            v-for="index in range(from, to)"
            :key="index"
            class="step-grid__cell"
            :class="{ 'step-grid__cell--playing': index === playhead }"
            role="gridcell"
            :style="{ gridColumn: column(index, from) }"
          >
            <!-- Pitch: a value rather than a switch, so it is a spin button and
                 plus / minus move it. -->
            <div
              v-if="lane === 'note'"
              :ref="(el) => registerCell(row, index, el)"
              class="step-grid__button step-grid__button--note"
              :class="{
                'step-grid__button--beat': index % 4 === 0,
                'step-grid__button--unavailable': steps[index].gate !== 'note',
                'step-grid__button--selected': isCursor(row, index),
              }"
              role="spinbutton"
              :tabindex="isCursor(row, index) ? 0 : -1"
              :aria-label="cellLabel('note', index)"
              :aria-valuemin="STEP_NOTE_MIN"
              :aria-valuemax="STEP_NOTE_MAX"
              :aria-valuenow="steps[index].note"
              :aria-valuetext="cellValueText('note', index)"
              :aria-disabled="steps[index].gate !== 'note' || undefined"
              aria-keyshortcuts="Plus Minus PageUp PageDown"
              @keydown="onCellKeydown($event, row, index)"
              @pointerdown="onPitchPointerDown($event, index)"
              @pointermove="onPitchPointerMove"
              @pointerup="onPitchPointerUp"
              @pointercancel="onPitchPointerUp"
            >{{ steps[index].gate === 'note' ? noteName(steps[index].note) : '·' }}</div>

            <button
              v-else
              :ref="(el) => registerCell(row, index, el)"
              type="button"
              class="step-grid__button"
              :class="{
                'step-grid__button--beat': index % 4 === 0,
                'step-grid__button--selected': isCursor(row, index),
                'step-grid__button--strike': lane === 'gate' && steps[index].gate === 'note',
                'step-grid__button--tie': lane === 'gate' && steps[index].gate === 'tie',
                'step-grid__button--accent-on': lane === 'accent' && accentState(index) === 'on',
                'step-grid__button--slide-on':
                  lane === 'slide' &&
                  (slideState(index) === 'active' || slideState(index) === 'pitch-only'),
                'step-grid__button--unavailable':
                  (lane === 'accent' && accentState(index) === 'unavailable') ||
                  (lane === 'slide' && slideState(index) === 'unavailable'),
              }"
              :tabindex="isCursor(row, index) ? 0 : -1"
              :aria-label="cellLabel(lane, index)"
              :aria-pressed="
                lane === 'gate'
                  ? undefined
                  : lane === 'accent'
                    ? accentState(index) === 'on'
                    : slideState(index) !== 'off' && slideState(index) !== 'unavailable'
              "
              :aria-disabled="
                (lane === 'accent' && accentState(index) === 'unavailable') ||
                (lane === 'slide' && slideState(index) === 'unavailable') ||
                undefined
              "
              @keydown="onCellKeydown($event, row, index)"
              @click="onCellClick(lane, index)"
            >
              <!-- Gate -->
              <svg
                v-if="lane === 'gate'"
                class="step-grid__glyph"
                width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"
              >
                <rect
                  v-if="steps[index].gate === 'note'"
                  x="5" y="1" width="4" height="12" rx="1" fill="currentColor"
                />
                <path
                  v-else-if="steps[index].gate === 'tie'"
                  d="M1 7 H13" stroke="currentColor" stroke-width="3" stroke-linecap="round"
                />
                <path
                  v-else
                  d="M3 7 H11" stroke="currentColor" stroke-width="1.5"
                  stroke-dasharray="2 2" opacity="0.6"
                />
              </svg>

              <!-- Accent: a ring, so it is not the slide with another colour -->
              <svg
                v-else-if="lane === 'accent'"
                class="step-grid__glyph step-grid__glyph--accent"
                :class="{ 'step-grid__glyph--muted': accentState(index) !== 'on' }"
                width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"
              >
                <template v-if="accentState(index) === 'on'">
                  <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" stroke-width="1.6" />
                  <circle cx="7" cy="7" r="2" fill="currentColor" />
                </template>
                <path
                  v-else-if="accentState(index) === 'unavailable'"
                  d="M3.5 10.5 L10.5 3.5" stroke="currentColor" stroke-width="1.4"
                  stroke-linecap="round"
                />
                <circle v-else cx="7" cy="7" r="1.6" fill="currentColor" />
              </svg>

              <!-- Slide: an arrow, and a broken tail where only pitch crosses -->
              <svg
                v-else
                class="step-grid__glyph step-grid__glyph--slide"
                :class="{
                  'step-grid__glyph--muted':
                    slideState(index) === 'off' ||
                    slideState(index) === 'inert' ||
                    slideState(index) === 'unavailable',
                }"
                width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"
              >
                <template v-if="slideState(index) === 'active'">
                  <path d="M2 7 H11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
                  <path
                    d="M8 4 L11 7 L8 10" fill="none" stroke="currentColor" stroke-width="1.6"
                    stroke-linecap="round" stroke-linejoin="round"
                  />
                </template>
                <template v-else-if="slideState(index) === 'pitch-only'">
                  <path
                    d="M2 10 L10 4" stroke="currentColor" stroke-width="1.6"
                    stroke-dasharray="2.5 2" stroke-linecap="round"
                  />
                  <path
                    d="M7.5 3.5 L11 3.5 L11 7" fill="none" stroke="currentColor" stroke-width="1.6"
                    stroke-linecap="round" stroke-linejoin="round"
                  />
                </template>
                <template v-else-if="slideState(index) === 'inert'">
                  <path
                    d="M2 7 H11" stroke="currentColor" stroke-width="1.4" stroke-dasharray="2 2"
                    stroke-linecap="round"
                  />
                  <path
                    d="M8 4 L11 7 L8 10" fill="none" stroke="currentColor" stroke-width="1.4"
                    stroke-linecap="round" stroke-linejoin="round"
                  />
                </template>
                <path
                  v-else-if="slideState(index) === 'unavailable'"
                  d="M3.5 10.5 L10.5 3.5" stroke="currentColor" stroke-width="1.4"
                  stroke-linecap="round"
                />
                <path
                  v-else
                  d="M5 7 H9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"
                />
              </svg>
            </button>
          </span>
        </div>
      </div>
    </div>

    <div class="step-grid__inspector">
      <div class="step-grid__inspector-row">
        <span class="step-grid__inspector-title">{{ copy.grid.inspector }}</span>
        <span class="step-grid__value">{{ fill(copy.grid.step, { n: selected + 1 }) }}</span>

        <span class="step-grid__field">
          <span class="step-grid__field-label">{{ copy.grid.lanes.note }}</span>
          <TransportButton
            size="sm"
            :disabled="selectedStep.gate !== 'note'"
            @click="nudgePitch(selected, -1)"
          >
            <span :aria-label="copy.grid.pitchDown">&minus;</span>
          </TransportButton>
          <span class="step-grid__value">{{ cellValueText('note', selected) }}</span>
          <TransportButton
            size="sm"
            :disabled="selectedStep.gate !== 'note'"
            @click="nudgePitch(selected, 1)"
          >
            <span :aria-label="copy.grid.pitchUp">+</span>
          </TransportButton>
        </span>

        <span class="step-grid__field">
          <span class="step-grid__field-label">{{ copy.grid.lanes.gate }}</span>
          <TransportButton size="sm" @click="cycleGate(selected)">
            <span :aria-label="copy.grid.nextGate">{{ gateLabel(selectedStep.gate) }}</span>
          </TransportButton>
        </span>

        <span class="step-grid__field">
          <span class="step-grid__field-label">{{ copy.grid.lanes.accent }}</span>
          <TransportButton
            size="sm"
            :variant="selectedAccent === 'on' ? 'primary' : 'default'"
            :disabled="selectedAccent === 'unavailable'"
            @click="toggleAccent(selected)"
          >
            <span :aria-label="copy.grid.toggleAccent">{{ cellValueText('accent', selected) }}</span>
          </TransportButton>
        </span>

        <span class="step-grid__field">
          <span class="step-grid__field-label">{{ copy.grid.lanes.slide }}</span>
          <TransportButton
            size="sm"
            :variant="selectedSlideOff ? 'default' : 'primary'"
            :disabled="selectedSlide === 'unavailable'"
            @click="toggleSlide(selected)"
          >
            <span :aria-label="copy.grid.toggleSlide">
              {{ selectedSlideOff ? copy.grid.off : copy.grid.on }}
            </span>
          </TransportButton>
          <span v-if="selectedSlide === 'pitch-only'" class="step-grid__badge">
            {{ copy.grid.pitchOnlyBadge }}
          </span>
        </span>
      </div>

      <p v-for="reason in reasons" :key="reason" class="step-grid__reason">{{ reason }}</p>
      <p class="step-grid__keyhint">{{ copy.grid.keyHint }}</p>
    </div>
  </div>
</template>
