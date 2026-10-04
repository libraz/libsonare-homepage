<script lang="ts">
/** Visitor-facing copy for {@link GainReductionMeter}; the demo passes its own locale. */
export interface GainReductionMeterLabels {
  /** Accessible name, e.g. the processor whose reduction is shown. */
  name: string;
}
</script>

<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue';
import {
  createPeakBallistics,
  dbScaleTicks,
  dbToFraction,
  formatMeterValue,
  isPeakBallisticsMoving,
  type PeakBallistics,
  stepPeakBallistics,
  tickText,
} from './meterBallistics';
import { useMeterClock } from './useMeterClock';

const props = withDefaults(
  defineProps<{
    /** Gain reduction in dB, 0 or negative; NaN reads as no reduction. */
    grDb: number;
    /** Depth of the scale in dB (the bar spans 0 to -rangeDb). */
    rangeDb?: number;
    /** `horizontal` is the compact console-strip variant without a printed scale. */
    orientation?: 'vertical' | 'horizontal';
    labels: GainReductionMeterLabels;
  }>(),
  { rangeDb: 20, orientation: 'vertical' },
);

/** Reduction as a positive depth; the hold tick is a peak hold on this depth. */
const depth = computed(() => (Number.isFinite(props.grDb) ? Math.max(0, -props.grDb) : 0));

const hold = shallowRef<PeakBallistics>(createPeakBallistics(0));

const clock = useMeterClock((timeSec, resumed) => {
  const from = resumed ? { ...hold.value, lastTime: null } : hold.value;
  hold.value = stepPeakBallistics(from, depth.value, timeSec, 0);
  return isPeakBallisticsMoving(hold.value, depth.value, 0);
});

watch(depth, () => clock.wake(), { immediate: true });

const vertical = computed(() => props.orientation === 'vertical');

function extent(depthDb: number): number {
  return dbToFraction(depthDb, 0, props.rangeDb);
}

/** The bar shows the reduction as received; only the hold tick has ballistics. */
const barClip = computed(() => {
  const hidden = `${((1 - extent(depth.value)) * 100).toFixed(2)}%`;
  return vertical.value ? `inset(0 0 ${hidden} 0)` : `inset(0 0 0 ${hidden})`;
});

const holdOffset = computed(() => `${(extent(hold.value.holdDb) * 100).toFixed(2)}%`);
const holdVisible = computed(() => hold.value.holdDb > 0);

const ticks = computed(() => {
  const step = props.rangeDb <= 12 ? 3 : props.rangeDb <= 24 ? 6 : 12;
  return dbScaleTicks(0, props.rangeDb, step).map((d) => ({
    label: d === 0 ? '0' : `-${d}`,
    offset: `${(extent(d) * 100).toFixed(2)}%`,
  }));
});

/** Reported value; half-dB steps keep assistive tech from a 47 Hz stream. */
const ariaNow = computed(() => -Math.min(props.rangeDb, Math.round(depth.value * 2) / 2));

const readout = computed(() => formatMeterValue(depth.value > 0 ? -depth.value : 0));
</script>

<template>
  <div
    class="gr-meter"
    :class="`gr-meter--${orientation}`"
    role="meter"
    :aria-label="labels.name"
    :aria-valuemin="-rangeDb"
    :aria-valuemax="0"
    :aria-valuenow="ariaNow"
    :aria-valuetext="`${ariaNow.toFixed(1)} dB`"
  >
    <span v-if="vertical" class="gr-meter__readout" aria-hidden="true">{{ readout }}</span>
    <div class="gr-meter__body" aria-hidden="true">
      <div v-if="vertical" class="gr-meter__scale">
        <span
          v-for="tick in ticks"
          :key="tick.label"
          class="gr-meter__tick"
          :style="{ top: tick.offset }"
        >{{ tickText(tick.label) }}</span>
      </div>
      <div class="gr-meter__track">
        <div class="gr-meter__fill" :style="{ clipPath: barClip }" />
        <div
          v-show="holdVisible"
          class="gr-meter__hold"
          :style="vertical ? { top: holdOffset } : { right: holdOffset }"
        />
      </div>
    </div>
    <span v-if="!vertical" class="gr-meter__readout" aria-hidden="true">{{ readout }}</span>
  </div>
</template>

<style scoped>
.gr-meter {
  display: flex;
  gap: 4px;
  font-family: var(--font-mono);
  color: var(--demo-text-muted);
}

.gr-meter--vertical {
  flex-direction: column;
  align-items: center;
  min-height: 120px;
  height: 100%;
}

.gr-meter--horizontal {
  align-items: center;
  width: 100%;
}

.gr-meter__readout {
  font-size: var(--demo-label-size);
  line-height: 12px;
  font-variant-numeric: tabular-nums;
  color: var(--demo-text-strong);
  white-space: nowrap;
}

.gr-meter--horizontal .gr-meter__readout {
  min-width: 4ch;
  text-align: right;
}

.gr-meter__body {
  display: flex;
  flex: 1;
  gap: 4px;
  min-height: 0;
  min-width: 0;
}

.gr-meter--vertical .gr-meter__body {
  align-self: stretch;
  justify-content: center;
}

.gr-meter__scale {
  position: relative;
  width: 18px;
}

.gr-meter__tick {
  position: absolute;
  right: 0;
  transform: translateY(-50%);
  font-size: var(--demo-label-size);
  line-height: 1;
  font-variant-numeric: tabular-nums;
  color: var(--demo-text-faint);
}

.gr-meter__track {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--demo-border);
  border-radius: 3px;
  background: var(--demo-control-bg-strong);
}

.gr-meter--vertical .gr-meter__track {
  width: 10px;
}

.gr-meter--horizontal .gr-meter__track {
  flex: 1;
  height: 5px;
  border-radius: 2px;
}

/* Hangs from 0 dB: top edge when vertical, right edge when horizontal. */
.gr-meter__fill {
  position: absolute;
  inset: 0;
  background: var(--demo-amber);
  will-change: clip-path;
}

.gr-meter__hold {
  position: absolute;
  background: var(--demo-text-strong);
}

.gr-meter--vertical .gr-meter__hold {
  left: 0;
  right: 0;
  height: 2px;
  transform: translateY(-50%);
}

.gr-meter--horizontal .gr-meter__hold {
  top: 0;
  bottom: 0;
  width: 2px;
  transform: translateX(50%);
}
</style>
