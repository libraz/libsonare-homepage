<script setup lang="ts">
import { ref } from 'vue';
import Tooltip from '@/components/ui/Tooltip.vue';
import { meterFillPercent } from '@/utils/scale';

/** Rich-tooltip content, shaped to spread straight onto {@link Tooltip}. */
interface StripHelp {
  eyebrow?: string;
  title?: string;
  body?: string;
  tip?: string;
  tipLabel?: string;
  defaultRationale?: string;
  defaultLabel?: string;
  href?: string;
  linkLabel?: string;
}

const props = withDefaults(
  defineProps<{
    /** Strip name printed on the scribble strip. */
    label: string;
    /** Fader gain (linear). */
    gain: number;
    /** Live post-fader peak (linear) for the LED meter. */
    level: number;
    /** Show a mute button below the fader. */
    mutable?: boolean;
    muted?: boolean;
    muteLabel?: string;
    unmuteLabel?: string;
    /** Fader range and double-click reset point. */
    max?: number;
    defaultGain?: number;
    /** Optional help shown via an info dot next to the strip name. */
    help?: StripHelp;
  }>(),
  {
    mutable: false,
    muted: false,
    muteLabel: 'Mute',
    unmuteLabel: 'Unmute',
    max: 1.4,
    defaultGain: 0.9,
    help: undefined,
  },
);

const emit = defineEmits<{
  (e: 'update:gain', value: number): void;
  (e: 'toggle-mute'): void;
}>();

const trackRef = ref<HTMLElement | null>(null);
const dragging = ref(false);

function gainToDb(gain: number): string {
  if (gain <= 0.001) return '-∞';
  return `${(20 * Math.log10(gain)).toFixed(1)}`;
}

function commitFromPointer(event: PointerEvent): void {
  const track = trackRef.value;
  if (!track) return;
  const rect = track.getBoundingClientRect();
  const ratio = 1 - (event.clientY - rect.top) / rect.height;
  const value = Math.min(props.max, Math.max(0, ratio * props.max));
  emit('update:gain', Math.round(value * 100) / 100);
}

function onPointerDown(event: PointerEvent): void {
  event.preventDefault();
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  dragging.value = true;
  commitFromPointer(event);
}

function onPointerMove(event: PointerEvent): void {
  if (dragging.value) commitFromPointer(event);
}

function onPointerUp(event: PointerEvent): void {
  if (!dragging.value) return;
  dragging.value = false;
  (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
}

function onKeyDown(event: KeyboardEvent): void {
  let next: number | null = null;
  if (event.key === 'ArrowUp') next = props.gain + 0.02;
  else if (event.key === 'ArrowDown') next = props.gain - 0.02;
  else if (event.key === 'PageUp') next = props.gain + 0.2;
  else if (event.key === 'PageDown') next = props.gain - 0.2;
  else if (event.key === 'Home') next = props.max;
  else if (event.key === 'End') next = 0;
  if (next === null) return;
  event.preventDefault();
  emit('update:gain', Math.min(props.max, Math.max(0, Math.round(next * 100) / 100)));
}
</script>

<template>
  <div class="channel-strip" :class="{ 'channel-strip--muted': muted }">
    <span class="channel-strip__name">
      {{ label }}
      <Tooltip v-if="help" v-bind="help">
        <button type="button" class="channel-strip__info" :aria-label="help.title || label">
          <span aria-hidden="true">i</span>
        </button>
      </Tooltip>
    </span>
    <span class="channel-strip__db">{{ gainToDb(gain) }}<small>dB</small></span>
    <div class="channel-strip__bay">
      <div
        ref="trackRef"
        class="channel-strip__fader"
        role="slider"
        tabindex="0"
        :aria-label="label"
        :aria-valuemin="0"
        :aria-valuemax="max"
        :aria-valuenow="gain"
        :aria-valuetext="`${gainToDb(gain)} dB`"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @dblclick="emit('update:gain', defaultGain)"
        @keydown="onKeyDown"
      >
        <div class="channel-strip__slot"></div>
        <div
          class="channel-strip__thumb"
          :style="{ bottom: `calc(${(gain / max) * 100}% - 9px)` }"
        ></div>
      </div>
      <div class="channel-strip__meter" aria-hidden="true">
        <div
          class="channel-strip__meter-fill"
          :style="{ clipPath: `inset(${100 - (muted ? 0 : meterFillPercent(level))}% 0 0 0)` }"
        ></div>
      </div>
    </div>
    <button
      v-if="mutable"
      type="button"
      class="channel-strip__mute"
      :class="{ 'channel-strip__mute--on': muted }"
      :aria-label="muted ? unmuteLabel : muteLabel"
      :aria-pressed="muted"
      @click="emit('toggle-mute')"
    >M</button>
    <span v-else class="channel-strip__mute-spacer"></span>
  </div>
</template>

<style scoped>
.channel-strip {
  --strip-hue: var(--track-hue, var(--demo-accent));
  --strip-glow: var(--track-hue-glow, var(--demo-accent-dim));

  display: grid;
  gap: 6px;
  justify-items: center;
  padding: 10px 8px 9px;
  border: 1px solid var(--demo-border);
  border-radius: 8px;
  background: var(--demo-control-bg);
  min-width: 74px;
  transition: opacity 0.15s ease;
}

.channel-strip--muted {
  opacity: 0.62;
}

.channel-strip__name {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  max-width: 100%;
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--strip-glow);
  color: var(--demo-text-strong);
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  white-space: nowrap;
}

.channel-strip__info {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 13px;
  height: 13px;
  padding: 0;
  border: 1px solid var(--demo-border);
  border-radius: 50%;
  background: var(--demo-bg);
  color: var(--demo-text-muted);
  cursor: pointer;
  transition: color var(--transition-fast), border-color var(--transition-fast),
    background-color var(--transition-fast);
}

.channel-strip__info > span {
  font-family: var(--font-body);
  font-size: 8px;
  font-style: italic;
  font-weight: 700;
  line-height: 1;
  transform: translateY(-0.5px);
}

.channel-strip__info:hover,
.channel-strip__info:focus-visible {
  color: var(--demo-accent);
  border-color: var(--demo-accent);
  background: var(--demo-accent-subtle);
  outline: none;
}

.channel-strip__db {
  color: var(--demo-text);
  font-family: var(--font-mono);
  font-size: 10.5px;
  font-variant-numeric: tabular-nums;
}

.channel-strip__db small {
  margin-left: 2px;
  color: var(--demo-text-faint);
  font-size: 7.5px;
  letter-spacing: 0.06em;
}

.channel-strip__bay {
  display: flex;
  gap: 7px;
  align-items: stretch;
  height: 128px;
}

.channel-strip__fader {
  position: relative;
  width: 26px;
  cursor: ns-resize;
  touch-action: none;
  outline: none;
  /* Tick marks */
  background-image: repeating-linear-gradient(
    0deg,
    var(--demo-border) 0 1px,
    transparent 1px 15.8px
  );
  background-size: 7px 100%;
  background-repeat: no-repeat;
  background-position: left center;
}

.channel-strip__fader:focus-visible {
  box-shadow: 0 0 0 2px var(--demo-accent-dim);
  border-radius: 4px;
}

.channel-strip__slot {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 4px;
  transform: translateX(-50%);
  border-radius: 2px;
  background: var(--demo-track-bg);
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.35);
}

.channel-strip__thumb {
  position: absolute;
  left: 50%;
  width: 24px;
  height: 18px;
  transform: translateX(-50%);
  border: 1px solid var(--demo-border-strong);
  border-radius: 4px;
  background: linear-gradient(180deg, var(--demo-bg-header) 0%, var(--demo-bg-elevated) 45%, var(--demo-bg-header) 100%);
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.35);
  pointer-events: none;
}

.channel-strip__thumb::after {
  /* Center grip line */
  content: '';
  position: absolute;
  top: 50%;
  left: 3px;
  right: 3px;
  height: 2px;
  transform: translateY(-50%);
  border-radius: 1px;
  background: var(--strip-hue);
  box-shadow: 0 0 4px var(--strip-glow);
}

.channel-strip__fader:hover .channel-strip__thumb,
.channel-strip__fader:focus-visible .channel-strip__thumb {
  border-color: var(--strip-hue);
}

.channel-strip__meter {
  position: relative;
  width: 9px;
  border-radius: 2px;
  background: var(--demo-track-bg);
  overflow: hidden;
}

/* Full-height gradient clipped from the top, keeping the amber/red zone
   anchored to the top of the meter rather than the moving fill edge. */
.channel-strip__meter-fill {
  position: absolute;
  inset: 0;
  background: linear-gradient(0deg, var(--strip-hue) 0%, var(--strip-hue) 80%, var(--demo-amber) 90%, var(--demo-clip) 98%);
  -webkit-mask-image: repeating-linear-gradient(0deg, #000 0 4px, transparent 4px 6px);
  mask-image: repeating-linear-gradient(0deg, #000 0 4px, transparent 4px 6px);
  transition: clip-path 0.06s linear;
}

@media (prefers-reduced-motion: reduce) {
  .channel-strip__meter-fill {
    transition: none;
  }
}

.channel-strip__mute {
  width: 24px;
  height: 22px;
  padding: 0;
  border: 1px solid var(--demo-border);
  border-radius: 5px;
  background: var(--demo-control-bg);
  color: var(--demo-text-muted);
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 800;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.channel-strip__mute:hover {
  border-color: var(--demo-warn-border);
  color: var(--demo-warn-text);
}

.channel-strip__mute:focus-visible {
  outline: 2px solid var(--demo-accent);
  outline-offset: 2px;
}

.channel-strip__mute--on {
  border-color: var(--demo-warn-border);
  background: var(--demo-warn-bg);
  color: var(--demo-warn-text);
  box-shadow: 0 0 8px var(--demo-warn-bg);
}

.channel-strip__mute-spacer {
  height: 22px;
}
</style>
