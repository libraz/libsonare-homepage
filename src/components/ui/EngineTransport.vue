<script lang="ts">
/** Visitor-facing copy for {@link EngineTransport}; the demo passes its own locale. */
export interface EngineTransportLabels {
  play: string;
  stop: string;
  toHome: string;
  loop: string;
  seek: string;
  loopStart: string;
  loopEnd: string;
}

/** Loop range in seconds. */
export interface EngineTransportLoop {
  enabled: boolean;
  start: number;
  end: number;
}

/** `mm:ss.mmm`; minutes keep counting past 59. Negative and non-finite read as zero. */
export function formatTransportTime(seconds: number): string {
  const ms = Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds * 1000) : 0;
  const minutes = Math.floor(ms / 60000);
  const secs = Math.floor(ms / 1000) % 60;
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`;
}
</script>

<script setup lang="ts">
import { computed, ref } from 'vue';

const props = withDefaults(
  defineProps<{
    playing: boolean;
    /** Playhead in seconds. */
    position: number;
    /** Programme length in seconds. */
    duration: number;
    loop: EngineTransportLoop;
    disabled?: boolean;
    labels: EngineTransportLabels;
  }>(),
  { disabled: false },
);

const emit = defineEmits<{
  play: [];
  stop: [];
  seek: [seconds: number];
  toHome: [];
  toggleLoop: [];
  'update:loop': [loop: EngineTransportLoop];
}>();

/** Arrow-key step and PageUp/PageDown step, in seconds. */
const STEP_SECONDS = 1;
const PAGE_SECONDS = 10;
/** Shortest loop the handles allow. */
const MIN_LOOP_SECONDS = 0.1;

const timelineRef = ref<HTMLElement | null>(null);
const dragging = ref<'seek' | 'start' | 'end' | null>(null);

const length = computed(() => (Number.isFinite(props.duration) && props.duration > 0 ? props.duration : 0));

function clampTime(seconds: number): number {
  return Math.max(0, Math.min(length.value, seconds));
}

function percent(seconds: number): string {
  return length.value ? `${((clampTime(seconds) / length.value) * 100).toFixed(3)}%` : '0%';
}

const loopStyle = computed(() => {
  const start = clampTime(props.loop.start);
  const end = clampTime(props.loop.end);
  return {
    left: percent(start),
    width: length.value ? `${(((end - start) / length.value) * 100).toFixed(3)}%` : '0%',
  };
});

function togglePlay(): void {
  if (props.disabled) return;
  if (props.playing) emit('stop');
  else emit('play');
}

function seekTo(seconds: number): void {
  emit('seek', clampTime(seconds));
}

function setLoopEdge(edge: 'start' | 'end', seconds: number): void {
  const { enabled, start, end } = props.loop;
  const next =
    edge === 'start'
      ? { enabled, start: Math.max(0, Math.min(seconds, end - MIN_LOOP_SECONDS)), end }
      : { enabled, start, end: Math.min(length.value, Math.max(seconds, start + MIN_LOOP_SECONDS)) };
  if (next.start === start && next.end === end) return;
  emit('update:loop', next);
}

/** Key → new time for an APG slider over [0, duration]; null when the key is not ours. */
function keyTarget(event: KeyboardEvent, current: number): number | null {
  switch (event.key) {
    case 'ArrowRight':
    case 'ArrowUp':
      return current + STEP_SECONDS;
    case 'ArrowLeft':
    case 'ArrowDown':
      return current - STEP_SECONDS;
    case 'PageUp':
      return current + PAGE_SECONDS;
    case 'PageDown':
      return current - PAGE_SECONDS;
    case 'Home':
      return 0;
    case 'End':
      return length.value;
    default:
      return null;
  }
}

function onSeekKey(event: KeyboardEvent): void {
  if (props.disabled) return;
  const target = keyTarget(event, props.position);
  if (target === null) return;
  event.preventDefault();
  seekTo(target);
}

function onLoopKey(event: KeyboardEvent, edge: 'start' | 'end'): void {
  if (props.disabled) return;
  const target = keyTarget(event, edge === 'start' ? props.loop.start : props.loop.end);
  if (target === null) return;
  event.preventDefault();
  setLoopEdge(edge, target);
}

function timeAt(event: PointerEvent): number | null {
  const rect = timelineRef.value?.getBoundingClientRect();
  if (!rect || rect.width === 0 || !length.value) return null;
  return ((event.clientX - rect.left) / rect.width) * length.value;
}

function apply(event: PointerEvent): void {
  const t = timeAt(event);
  if (t === null || !dragging.value) return;
  if (dragging.value === 'seek') seekTo(t);
  else setLoopEdge(dragging.value, t);
}

function onPointerDown(event: PointerEvent, target: 'seek' | 'start' | 'end'): void {
  if (props.disabled || event.button !== 0) return;
  event.preventDefault();
  event.stopPropagation();
  timelineRef.value?.setPointerCapture?.(event.pointerId);
  dragging.value = target;
  apply(event);
}

function onPointerMove(event: PointerEvent): void {
  if (dragging.value) apply(event);
}

function onPointerUp(event: PointerEvent): void {
  if (!dragging.value) return;
  dragging.value = null;
  timelineRef.value?.releasePointerCapture?.(event.pointerId);
}
</script>

<template>
  <div class="engine-transport" :class="{ 'engine-transport--disabled': disabled }">
    <div class="engine-transport__buttons">
      <button
        type="button"
        class="engine-transport__button"
        :disabled="disabled"
        :aria-label="labels.toHome"
        :title="labels.toHome"
        @click="emit('toHome')"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="5" y="6" width="2.4" height="12" rx="0.6" />
          <path d="M19 6.5v11L9.5 12z" />
        </svg>
      </button>
      <button
        type="button"
        class="engine-transport__button engine-transport__button--primary"
        :disabled="disabled"
        :aria-label="playing ? labels.stop : labels.play"
        :title="playing ? labels.stop : labels.play"
        @click="togglePlay"
      >
        <svg v-if="playing" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="6.5" y="6.5" width="11" height="11" rx="1.2" />
        </svg>
        <svg v-else viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 5.5v13l11-6.5z" />
        </svg>
      </button>
      <button
        type="button"
        class="engine-transport__button"
        :class="{ 'engine-transport__button--on': loop.enabled }"
        :disabled="disabled"
        :aria-label="labels.loop"
        :aria-pressed="loop.enabled"
        :title="labels.loop"
        @click="emit('toggleLoop')"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" class="engine-transport__stroke">
          <path d="M7 9h9.5a3 3 0 0 1 0 6H15" />
          <path d="M17 15H7.5a3 3 0 0 1 0-6H9" />
          <path d="M14 6.5 16.5 9 14 11.5" />
          <path d="M10 12.5 7.5 15 10 17.5" />
        </svg>
      </button>
    </div>

    <div class="engine-transport__clock">
      <span class="engine-transport__time">{{ formatTransportTime(position) }}</span>
      <span class="engine-transport__time engine-transport__time--total">{{ formatTransportTime(duration) }}</span>
    </div>

    <div
      ref="timelineRef"
      class="engine-transport__timeline"
      :class="{ 'is-dragging': dragging !== null }"
      @pointerdown="onPointerDown($event, 'seek')"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <div class="engine-transport__loop-lane">
        <div
          class="engine-transport__loop"
          :class="{ 'engine-transport__loop--on': loop.enabled }"
          :style="loopStyle"
        />
        <div
          class="engine-transport__loop-handle"
          role="slider"
          :tabindex="disabled ? -1 : 0"
          :aria-label="labels.loopStart"
          :aria-disabled="disabled || undefined"
          aria-valuemin="0"
          :aria-valuemax="length"
          :aria-valuenow="clampTime(loop.start)"
          :aria-valuetext="formatTransportTime(loop.start)"
          :style="{ left: percent(loop.start) }"
          @pointerdown="onPointerDown($event, 'start')"
          @keydown="onLoopKey($event, 'start')"
        />
        <div
          class="engine-transport__loop-handle engine-transport__loop-handle--end"
          role="slider"
          :tabindex="disabled ? -1 : 0"
          :aria-label="labels.loopEnd"
          :aria-disabled="disabled || undefined"
          aria-valuemin="0"
          :aria-valuemax="length"
          :aria-valuenow="clampTime(loop.end)"
          :aria-valuetext="formatTransportTime(loop.end)"
          :style="{ left: percent(loop.end) }"
          @pointerdown="onPointerDown($event, 'end')"
          @keydown="onLoopKey($event, 'end')"
        />
      </div>
      <div class="engine-transport__track">
        <div class="engine-transport__fill" :style="{ width: percent(position) }" />
      </div>
      <div
        class="engine-transport__playhead"
        role="slider"
        :tabindex="disabled ? -1 : 0"
        :aria-label="labels.seek"
        :aria-disabled="disabled || undefined"
        aria-valuemin="0"
        :aria-valuemax="length"
        :aria-valuenow="clampTime(position)"
        :aria-valuetext="formatTransportTime(position)"
        :style="{ left: percent(position) }"
        @keydown="onSeekKey"
      />
    </div>
  </div>
</template>

<style scoped>
.engine-transport {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 8px 12px;
  border: 1px solid var(--demo-border);
  border-radius: 10px;
  background: var(--demo-bg-elevated);
  font-family: var(--font-mono);
}

.engine-transport--disabled {
  opacity: var(--demo-disabled-opacity);
}

.engine-transport__buttons {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.engine-transport__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid var(--demo-border-strong);
  border-radius: 6px;
  background: var(--demo-control-bg);
  color: var(--demo-text);
  cursor: pointer;
  transition: background-color 0.16s ease, border-color 0.16s ease, color 0.16s ease;
}

.engine-transport__button:not(:disabled):hover {
  border-color: var(--demo-accent-border);
  color: var(--demo-text-strong);
}

.engine-transport__button:disabled {
  cursor: not-allowed;
}

.engine-transport__button--primary {
  width: 38px;
  border-color: var(--demo-accent-border);
  background: var(--demo-accent-dim);
  color: var(--demo-text-strong);
}

.engine-transport__button--on {
  border-color: var(--demo-accent);
  background: var(--demo-accent-subtle);
  color: var(--demo-accent);
}

.engine-transport__button svg {
  width: 16px;
  height: 16px;
  fill: currentColor;
}

.engine-transport__button .engine-transport__stroke {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.engine-transport__clock {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  line-height: 1.25;
  font-variant-numeric: tabular-nums;
}

.engine-transport__time {
  font-size: 13px;
  font-weight: 600;
  color: var(--demo-text-strong);
}

.engine-transport__time--total {
  font-size: 10px;
  font-weight: 400;
  color: var(--demo-text-muted);
}

.engine-transport__timeline {
  position: relative;
  flex: 1;
  min-width: 120px;
  height: 34px;
  cursor: pointer;
  touch-action: none;
}

.engine-transport--disabled .engine-transport__timeline {
  cursor: not-allowed;
}

.engine-transport__loop-lane {
  position: absolute;
  inset: 0 0 auto;
  height: 12px;
}

.engine-transport__loop {
  position: absolute;
  top: 3px;
  height: 6px;
  border: 1px solid var(--demo-border-strong);
  border-radius: 2px;
  background: var(--demo-control-bg-strong);
}

.engine-transport__loop--on {
  border-color: var(--demo-accent-border);
  background: var(--demo-accent-dim);
}

.engine-transport__loop-handle {
  position: absolute;
  top: 0;
  width: 10px;
  height: 12px;
  border-radius: 2px 2px 0 0;
  background: var(--demo-text-muted);
  transform: translateX(-100%);
  cursor: ew-resize;
}

.engine-transport__loop-handle--end {
  transform: none;
}

.engine-transport__loop--on ~ .engine-transport__loop-handle {
  background: var(--demo-accent);
}

.engine-transport__track {
  position: absolute;
  left: 0;
  right: 0;
  top: 20px;
  height: 4px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--demo-control-bg-strong);
}

.engine-transport__fill {
  height: 100%;
  background: var(--demo-accent);
}

.engine-transport__playhead {
  position: absolute;
  top: 12px;
  bottom: 0;
  width: 2px;
  background: var(--demo-playhead);
  transform: translateX(-50%);
}

.engine-transport__playhead::after {
  content: '';
  position: absolute;
  top: 6px;
  left: 50%;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--demo-playhead);
  transform: translateX(-50%);
}

.engine-transport__playhead:focus-visible,
.engine-transport__loop-handle:focus-visible {
  outline: 2px solid var(--demo-accent);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .engine-transport__button {
    transition: none;
  }
}
</style>
