<script setup lang="ts">
/**
 * A console fader: 0 dB at three quarters of the throw, a relative drag (the
 * cap never jumps to the pointer), Shift for fine moves, double-click to
 * reset, wheel and arrow keys. A drag emits `begin` / `end` around its updates
 * so the page folds it into one history entry. `locked` shows the value
 * (an automated fader) without taking edits.
 */
import { computed, ref } from 'vue';
import {
  FADER_MARKS,
  FADER_MAX_DB,
  FADER_MIN_DB,
  faderDbAt,
  faderPosition,
  formatFader,
} from '@/demos/mixing/mixingUi';

const props = withDefaults(
  defineProps<{
    modelValue: number;
    /** Accessible name. */
    label: string;
    defaultValue?: number;
    disabled?: boolean;
    locked?: boolean;
    /** Help shown while locked. */
    lockedHint?: string;
    scale?: boolean;
  }>(),
  { defaultValue: 0, disabled: false, locked: false, lockedHint: undefined, scale: true },
);

const emit = defineEmits<{
  'update:modelValue': [db: number];
  begin: [];
  end: [];
}>();

const trackRef = ref<HTMLElement | null>(null);
const dragging = ref(false);
let origin: { y: number; position: number; height: number } | null = null;

const inert = computed(() => props.disabled || props.locked);
const position = computed(() => faderPosition(props.modelValue));
const capStyle = computed(() => ({ bottom: `${(position.value * 100).toFixed(2)}%` }));
const marks = computed(() =>
  FADER_MARKS.map((db) => ({
    db,
    bottom: `${(faderPosition(db) * 100).toFixed(2)}%`,
    text: db === FADER_MIN_DB ? '∞' : db > 0 ? `+${db}` : String(Math.abs(db)),
  })),
);

function commit(db: number): void {
  const next = Math.round(Math.min(FADER_MAX_DB, Math.max(FADER_MIN_DB, db)) * 10) / 10;
  if (next !== props.modelValue) emit('update:modelValue', next);
}

function onPointerDown(event: PointerEvent): void {
  if (inert.value || event.button !== 0) return;
  event.preventDefault();
  const host = event.currentTarget as HTMLElement;
  host.setPointerCapture?.(event.pointerId);
  host.focus();
  const height = trackRef.value?.getBoundingClientRect().height || 1;
  origin = { y: event.clientY, position: position.value, height };
  dragging.value = true;
  emit('begin');
}

function onPointerMove(event: PointerEvent): void {
  if (!dragging.value || !origin) return;
  const delta = ((origin.y - event.clientY) / origin.height) * (event.shiftKey ? 0.2 : 1);
  const next = Math.min(1, Math.max(0, origin.position + delta));
  origin = { ...origin, y: event.clientY, position: next };
  commit(faderDbAt(next));
}

function onPointerUp(event: PointerEvent): void {
  if (!dragging.value) return;
  dragging.value = false;
  origin = null;
  (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
  emit('end');
}

function nudge(db: number): void {
  if (!inert.value) commit(props.modelValue + db);
}

function onWheel(event: WheelEvent): void {
  if (inert.value) return;
  event.preventDefault();
  nudge((event.deltaY < 0 ? 1 : -1) * (event.shiftKey ? 0.1 : 0.5));
}

function onKeyDown(event: KeyboardEvent): void {
  if (inert.value) return;
  const fine = event.shiftKey ? 0.1 : 0.5;
  const actions: Record<string, () => void> = {
    ArrowUp: () => nudge(fine),
    ArrowRight: () => nudge(fine),
    ArrowDown: () => nudge(-fine),
    ArrowLeft: () => nudge(-fine),
    PageUp: () => nudge(6),
    PageDown: () => nudge(-6),
    Home: () => commit(FADER_MAX_DB),
    End: () => commit(FADER_MIN_DB),
  };
  const action = actions[event.key];
  if (!action) return;
  event.preventDefault();
  event.stopPropagation();
  action();
}

function reset(): void {
  if (!inert.value) commit(props.defaultValue);
}
</script>

<template>
  <div
    class="fader"
    :class="{ 'fader--dragging': dragging, 'fader--locked': locked, 'fader--disabled': disabled }"
    :title="locked ? lockedHint : undefined"
  >
    <div v-if="scale" class="fader__scale" aria-hidden="true">
      <span v-for="mark in marks" :key="mark.db" :style="{ bottom: mark.bottom }">{{ mark.text }}</span>
    </div>
    <div
      ref="trackRef"
      class="fader__track"
      role="slider"
      :tabindex="disabled ? -1 : 0"
      :aria-label="label"
      aria-orientation="vertical"
      :aria-valuemin="FADER_MIN_DB"
      :aria-valuemax="FADER_MAX_DB"
      :aria-valuenow="modelValue"
      :aria-valuetext="`${formatFader(modelValue)} dB`"
      :aria-readonly="locked || undefined"
      :aria-disabled="disabled || undefined"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @dblclick="reset"
      @wheel="onWheel"
      @keydown="onKeyDown"
    >
      <span class="fader__slot" aria-hidden="true"></span>
      <span class="fader__unity" aria-hidden="true" :style="{ bottom: '75%' }"></span>
      <span class="fader__cap" aria-hidden="true" :style="capStyle"></span>
    </div>
  </div>
</template>

<style scoped>
.fader {
  --fader-height: 156px;
  display: grid;
  grid-template-columns: auto 22px;
  gap: 3px;
  height: var(--fader-height);
  user-select: none;
}

.fader__scale {
  position: relative;
  width: 16px;
  color: var(--demo-text-faint);
  font-family: var(--font-mono);
  font-size: 8px;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.fader__scale span {
  position: absolute;
  right: 0;
  transform: translateY(50%);
  line-height: 1;
}

.fader__track {
  position: relative;
  height: 100%;
  border-radius: 3px;
  cursor: ns-resize;
  touch-action: none;
}

.fader__track:focus-visible {
  outline: 2px solid var(--demo-accent);
  outline-offset: 2px;
}

.fader__slot {
  position: absolute;
  inset: 0 auto 0 50%;
  width: 3px;
  border-radius: 2px;
  background: var(--demo-border-strong);
  transform: translateX(-50%);
}

.fader__unity {
  position: absolute;
  left: 2px;
  right: 2px;
  height: 1px;
  background: var(--demo-text-faint);
}

.fader__cap {
  position: absolute;
  left: 0;
  right: 0;
  height: 26px;
  border: 1px solid var(--demo-border-strong);
  border-radius: 3px;
  background:
    linear-gradient(
      180deg,
      var(--demo-control-bg-strong) 0 46%,
      var(--demo-text-strong) 46% 54%,
      var(--demo-control-bg-strong) 54% 100%
    );
  box-shadow: 0 2px 4px -1px var(--demo-shadow);
  transform: translateY(50%);
}

.fader--dragging .fader__cap {
  border-color: var(--demo-accent);
}

.fader--locked .fader__track {
  cursor: default;
}

.fader--locked .fader__cap {
  background:
    linear-gradient(
      180deg,
      var(--demo-accent-subtle) 0 46%,
      var(--demo-accent) 46% 54%,
      var(--demo-accent-subtle) 54% 100%
    );
  border-color: var(--demo-accent-border);
}

.fader--disabled {
  opacity: var(--demo-disabled-opacity);
}

.fader--disabled .fader__track {
  cursor: not-allowed;
}
</style>
