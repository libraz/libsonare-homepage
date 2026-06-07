<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import Tooltip from '@/components/ui/Tooltip.vue';

const props = defineProps<{
  modelValue: number;
  min: number;
  max: number;
  step: number;
  label: string;
  unit?: string;
  hint?: string;
  tip?: string;
  tipLabel?: string;
  default?: number;
  defaultRationale?: string;
  defaultLabel?: string;
  defaultOffLabel?: string;
  docsHref?: string;
  docsLinkLabel?: string;
}>();

const emit = defineEmits<(e: 'update:modelValue', value: number) => void>();

const dragging = ref(false);
const editing = ref(false);
const draftValue = ref('');
const inputRef = ref<HTMLInputElement | null>(null);
const trackRef = ref<HTMLElement | null>(null);

const range = computed(() => props.max - props.min);
const bipolar = computed(() => props.min < 0 && props.max > 0);

const normalized = computed(() => {
  if (range.value === 0) return 0;
  return Math.max(0, Math.min(1, (props.modelValue - props.min) / range.value));
});

const percent = computed(() => normalized.value * 100);
const zeroPercent = computed(() => (range.value === 0 ? 0 : (-props.min / range.value) * 100));

const fillStyle = computed(() => {
  if (bipolar.value) {
    const z = zeroPercent.value;
    const p = percent.value;
    const left = Math.min(z, p);
    const width = Math.abs(p - z);
    return { left: `${left}%`, width: `${width}%` };
  }
  return { left: '0%', width: `${percent.value}%` };
});

const ticks = computed(() => {
  if (bipolar.value) return [0, 25, zeroPercent.value, 75, 100];
  return [0, 25, 50, 75, 100];
});

const decimals = computed(() => {
  const text = props.step.toString();
  const dot = text.indexOf('.');
  return dot === -1 ? 0 : text.length - dot - 1;
});

const displayValue = computed(() => {
  if (decimals.value === 0) return Math.round(props.modelValue).toString();
  return props.modelValue.toFixed(decimals.value);
});

const defaultDisplay = computed(() => {
  if (props.default === undefined) return undefined;
  if (props.default === 0 && !props.unit && props.defaultOffLabel) {
    return `0 · ${props.defaultOffLabel}`;
  }
  const num =
    decimals.value === 0
      ? Math.round(props.default).toString()
      : props.default.toFixed(decimals.value);
  return props.unit ? `${num} ${props.unit}` : num;
});

function snapValue(value: number): number {
  let v = value;
  if (props.step > 0) v = Math.round(v / props.step) * props.step;
  v = Math.max(props.min, Math.min(props.max, v));
  if (decimals.value > 0) v = parseFloat(v.toFixed(decimals.value));
  return v;
}

function commit(value: number) {
  const v = snapValue(value);
  if (v !== props.modelValue) emit('update:modelValue', v);
}

function valueFromClientX(clientX: number): number {
  const track = trackRef.value;
  if (!track) return props.modelValue;
  const rect = track.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  return props.min + ratio * range.value;
}

function onPointerDown(event: PointerEvent) {
  event.preventDefault();
  const target = event.currentTarget as HTMLElement;
  target.setPointerCapture(event.pointerId);
  dragging.value = true;
  commit(valueFromClientX(event.clientX));
}

function onPointerMove(event: PointerEvent) {
  if (!dragging.value) return;
  if (event.shiftKey) {
    const sensitivity = range.value / 800;
    commit(props.modelValue + event.movementX * sensitivity);
  } else {
    commit(valueFromClientX(event.clientX));
  }
}

function onPointerUp(event: PointerEvent) {
  if (!dragging.value) return;
  dragging.value = false;
  (event.currentTarget as Element).releasePointerCapture(event.pointerId);
}

function onWheel(event: WheelEvent) {
  event.preventDefault();
  const dir = event.deltaY < 0 ? 1 : -1;
  const fine = event.shiftKey ? 0.25 : 1;
  commit(props.modelValue + dir * props.step * (1 / fine));
}

function onDoubleClick() {
  commit(bipolar.value ? 0 : (props.min + props.max) / 2);
}

async function startEditing() {
  if (editing.value) return;
  draftValue.value = displayValue.value;
  editing.value = true;
  await nextTick();
  inputRef.value?.focus();
  inputRef.value?.select();
}

function commitDraft() {
  if (!editing.value) return;
  const parsed = parseFloat(draftValue.value);
  if (Number.isFinite(parsed)) commit(parsed);
  editing.value = false;
}

function cancelDraft() {
  editing.value = false;
}

function onDraftKey(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    event.preventDefault();
    commitDraft();
  } else if (event.key === 'Escape') {
    event.preventDefault();
    cancelDraft();
  }
}

const shortcutHint = computed(() => {
  const base = `${props.label}: drag / click anywhere on the track / ←→ keys to nudge / Shift = fine / double-click = reset / click value to type`;
  return props.hint ? `${props.hint}\n\n${base}` : base;
});

function onKeyDown(event: KeyboardEvent) {
  let handled = true;
  if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
    commit(props.modelValue + props.step * (event.shiftKey ? 0.25 : 1));
  } else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
    commit(props.modelValue - props.step * (event.shiftKey ? 0.25 : 1));
  } else if (event.key === 'PageUp') {
    commit(props.modelValue + props.step * 10);
  } else if (event.key === 'PageDown') {
    commit(props.modelValue - props.step * 10);
  } else if (event.key === 'Home') {
    commit(props.min);
  } else if (event.key === 'End') {
    commit(props.max);
  } else {
    handled = false;
  }
  if (handled) event.preventDefault();
}
</script>

<template>
  <div class="fader" :class="{ 'fader--dragging': dragging, 'fader--bipolar': bipolar }">
    <div class="fader__head">
      <span class="fader__label">{{ label }}</span>
      <button
        v-if="!editing"
        type="button"
        class="fader__readout"
        :title="`Click to type a value · ${label}`"
        @click="startEditing"
      >
        <strong>{{ displayValue }}</strong>
        <em v-if="unit">{{ unit }}</em>
      </button>
      <div v-else class="fader__readout fader__readout--editing">
        <input
          ref="inputRef"
          v-model="draftValue"
          type="number"
          :min="min"
          :max="max"
          :step="step"
          @keydown="onDraftKey"
          @blur="commitDraft"
        >
        <em v-if="unit">{{ unit }}</em>
      </div>
      <Tooltip
        v-if="hint !== undefined"
        :title="label"
        :body="hint"
        :tip="tip"
        :tip-label="tipLabel"
        :default-value="defaultDisplay"
        :default-rationale="defaultRationale"
        :default-label="defaultLabel"
        :href="docsHref"
        :link-label="docsLinkLabel"
      >
        <button
          type="button"
          class="fader__info"
          :aria-label="hint || label"
        >
          <span aria-hidden="true">i</span>
        </button>
      </Tooltip>
    </div>

    <div
      ref="trackRef"
      class="fader__track"
      :tabindex="0"
      role="slider"
      :aria-label="label"
      :aria-valuemin="min"
      :aria-valuemax="max"
      :aria-valuenow="modelValue"
      :aria-valuetext="displayValue + (unit ? ' ' + unit : '')"
      :title="shortcutHint"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @wheel.passive="onWheel"
      @dblclick="onDoubleClick"
      @keydown="onKeyDown"
    >
      <div class="fader__ticks" aria-hidden="true">
        <span
          v-for="(pos, i) in ticks"
          :key="i"
          class="fader__tick"
          :class="{ 'fader__tick--major': i === 0 || i === ticks.length - 1 || (bipolar && i === 2) }"
          :style="{ left: `${pos}%` }"
        ></span>
      </div>

      <div class="fader__rail" aria-hidden="true">
        <span class="fader__fill" :style="fillStyle"></span>
        <span class="fader__fill-glow" :style="fillStyle"></span>
      </div>

      <span
        class="fader__thumb"
        :style="{ left: `${percent}%` }"
        aria-hidden="true"
      >
        <span class="fader__thumb-grip"></span>
        <span class="fader__thumb-grip"></span>
        <span class="fader__thumb-grip"></span>
      </span>
    </div>
  </div>
</template>

<style scoped>
.fader {
  position: relative;
  display: grid;
  grid-template-rows: auto 36px;
  gap: 6px;
  width: 168px;
  user-select: none;
}

.fader__head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 6px;
  min-height: 18px;
}

.fader__label {
  color: var(--demo-text-muted);
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fader__info {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  border: 1px solid var(--demo-border);
  border-radius: 50%;
  background: var(--demo-bg);
  color: var(--demo-text-muted);
  cursor: pointer;
  transition: color 0.18s ease, border-color 0.18s ease, background-color 0.18s ease;
}

.fader__info > span {
  font-family: var(--font-body);
  font-size: 9px;
  font-style: italic;
  font-weight: 700;
  line-height: 1;
  transform: translateY(-0.5px);
}

.fader__info:hover,
.fader__info:focus-visible {
  color: var(--demo-accent);
  border-color: var(--demo-accent);
  background: var(--demo-accent-subtle);
  outline: none;
}

.fader__readout {
  display: inline-flex;
  align-items: baseline;
  gap: 3px;
  padding: 1px 7px;
  border: 1px solid var(--demo-border);
  border-radius: 4px;
  background: var(--master-code-bg);
  color: inherit;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  line-height: 1.4;
  cursor: text;
  transition: border-color 0.15s ease, background-color 0.15s ease, color 0.15s ease;
}

button.fader__readout {
  font: inherit;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.fader__readout strong {
  color: var(--demo-text-strong);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.fader__readout em {
  color: var(--demo-text-muted);
  font-size: 9px;
  font-style: normal;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: lowercase;
}

.fader__readout:hover {
  border-color: var(--demo-accent-border);
  background: color-mix(in srgb, var(--demo-accent) 10%, var(--master-code-bg));
}

.fader__readout:focus-visible {
  outline: none;
  border-color: var(--demo-accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--demo-accent) 35%, transparent);
}

.fader--dragging .fader__readout {
  border-color: var(--demo-accent);
  color: var(--demo-text-strong);
  background: color-mix(in srgb, var(--demo-accent) 14%, var(--master-code-bg));
}

.fader__readout--editing {
  padding: 0 4px;
  border-color: var(--demo-accent);
}

.fader__readout input {
  width: 4.2em;
  padding: 1px 2px;
  border: 0;
  background: transparent;
  color: var(--demo-text-strong);
  font: inherit;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.fader__readout input:focus {
  outline: none;
}

.fader__readout input::-webkit-outer-spin-button,
.fader__readout input::-webkit-inner-spin-button {
  margin: 0;
  -webkit-appearance: none;
  appearance: none;
}

.fader__track {
  position: relative;
  height: 36px;
  padding: 0 9px;
  cursor: ew-resize;
  touch-action: none;
}

.fader__track:focus-visible {
  outline: none;
}

.fader__track:focus-visible .fader__rail {
  box-shadow:
    inset 0 1px 2px rgba(0, 0, 0, 0.35),
    0 0 0 2px color-mix(in srgb, var(--demo-accent) 45%, transparent);
}

.fader__ticks {
  position: absolute;
  inset: 4px 9px auto 9px;
  height: 5px;
  pointer-events: none;
}

.fader__tick {
  position: absolute;
  top: 0;
  width: 1px;
  height: 4px;
  background: var(--demo-border-strong);
  opacity: 0.55;
  transform: translateX(-50%);
}

.fader__tick--major {
  height: 5px;
  background: var(--demo-text-muted);
  opacity: 0.9;
}

.fader__rail {
  position: absolute;
  left: 9px;
  right: 9px;
  top: 50%;
  height: 7px;
  transform: translateY(-50%);
  border-radius: 999px;
  background:
    linear-gradient(180deg,
      color-mix(in srgb, black 35%, var(--master-code-bg)),
      var(--master-code-bg));
  border: 1px solid var(--demo-border);
  box-shadow:
    inset 0 1px 2px rgba(0, 0, 0, 0.35),
    inset 0 -1px 0 color-mix(in srgb, white 5%, transparent);
  transition: box-shadow 0.18s ease;
}

html:not(.dark) .fader__rail {
  background:
    linear-gradient(180deg,
      color-mix(in srgb, black 10%, var(--master-code-bg)),
      var(--master-code-bg));
}

.fader__fill {
  position: absolute;
  top: 0;
  bottom: 0;
  border-radius: inherit;
  background: linear-gradient(90deg,
    color-mix(in srgb, var(--demo-accent) 80%, transparent),
    var(--demo-accent));
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, white 30%, transparent),
    inset 0 -1px 0 color-mix(in srgb, black 30%, transparent);
}

.fader__fill-glow {
  position: absolute;
  top: -3px;
  bottom: -3px;
  border-radius: inherit;
  background: var(--demo-accent);
  filter: blur(6px);
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;
}

.fader--dragging .fader__fill-glow,
.fader__track:focus-visible .fader__fill-glow,
.fader__track:hover .fader__fill-glow {
  opacity: 0.35;
}

.fader__thumb {
  position: absolute;
  top: 50%;
  left: 0;
  width: 18px;
  height: 26px;
  transform: translate(-50%, -50%);
  border-radius: 5px;
  background: linear-gradient(180deg,
    color-mix(in srgb, white 12%, var(--demo-bg-elevated)),
    var(--demo-bg-elevated) 45%,
    color-mix(in srgb, black 18%, var(--demo-bg-elevated)));
  border: 1px solid var(--demo-border-strong);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, white 18%, transparent),
    inset 0 -1px 0 color-mix(in srgb, black 20%, transparent),
    0 2px 5px color-mix(in srgb, black 30%, transparent);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 0 3px;
  pointer-events: none;
  transition: transform 0.12s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}

.fader__thumb::before {
  content: '';
  position: absolute;
  top: 1px;
  left: 1px;
  right: 1px;
  height: 2px;
  border-radius: 4px;
  background: linear-gradient(90deg,
    transparent,
    color-mix(in srgb, var(--demo-accent) 70%, transparent),
    transparent);
}

.fader__thumb-grip {
  width: 70%;
  height: 1px;
  background: color-mix(in srgb, black 45%, transparent);
  box-shadow: 0 1px 0 color-mix(in srgb, white 12%, transparent);
  border-radius: 1px;
}

html:not(.dark) .fader__thumb-grip {
  background: color-mix(in srgb, black 25%, transparent);
}

.fader__track:focus-visible .fader__thumb,
.fader--dragging .fader__thumb {
  border-color: var(--demo-accent);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, white 25%, transparent),
    inset 0 -1px 0 color-mix(in srgb, black 25%, transparent),
    0 2px 6px color-mix(in srgb, black 35%, transparent),
    0 0 0 3px color-mix(in srgb, var(--demo-accent) 22%, transparent);
}

.fader__track:hover:not(.fader--dragging) .fader__thumb {
  transform: translate(-50%, -50%) scaleY(1.06);
}

.fader--dragging .fader__thumb {
  transform: translate(-50%, -50%) scale(1.08);
}
</style>
