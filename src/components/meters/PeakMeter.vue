<script lang="ts">
/** Visitor-facing copy for {@link PeakMeter}; the demo passes its own locale. */
export interface PeakMeterLabels {
  /** Accessible name of the meter, e.g. the strip or bus it measures. */
  name: string;
  /** Text of the clip indicator. */
  clip: string;
  /** Accessible name of the clip indicator while it is latched and clickable. */
  clearClip: string;
}
</script>

<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue';
import {
  CLIP_THRESHOLD_DBTP,
  createPeakBallistics,
  dbScaleTicks,
  dbToFraction,
  formatMeterValue,
  isPeakBallisticsMoving,
  latchClip,
  METER_FLOOR_DB,
  type PeakBallistics,
  stepPeakBallistics,
} from './meterBallistics';
import { useMeterClock } from './useMeterClock';

const props = withDefaults(
  defineProps<{
    /** Sample peak per channel [L, R] in dBFS. */
    peakDb: readonly [number, number];
    /** RMS per channel [L, R] in dBFS, displayed as received. */
    rmsDb?: readonly [number, number] | null;
    /** True peak (dBTP) that drives the clip latch; falls back to the louder sample peak. */
    truePeakDb?: number | null;
    /** Bottom of the scale in dB. */
    minDb?: number;
    /** Top of the scale in dB. */
    maxDb?: number;
    /** `horizontal` is the compact console-strip variant without a printed scale. */
    orientation?: 'vertical' | 'horizontal';
    labels: PeakMeterLabels;
  }>(),
  { rmsDb: null, truePeakDb: null, minDb: -60, maxDb: 0, orientation: 'vertical' },
);

/** Level above which a bar turns from the normal to the hot colour. */
const HOT_ZONE_DB = -6;
/** At or below this the engine reports its floor: no reading, so the readout shows a dash. */
const NO_READING_DB = METER_FLOOR_DB + 1;

const channels = shallowRef<[PeakBallistics, PeakBallistics]>([
  createPeakBallistics(),
  createPeakBallistics(),
]);
const clipped = shallowRef(false);

const clock = useMeterClock((timeSec, resumed) => {
  const next = channels.value.map((state, i) => {
    const from = resumed ? { ...state, lastTime: null } : state;
    return stepPeakBallistics(from, props.peakDb[i], timeSec);
  }) as [PeakBallistics, PeakBallistics];
  channels.value = next;
  return next.some((state, i) => isPeakBallisticsMoving(state, props.peakDb[i]));
});

watch(
  [() => props.peakDb[0], () => props.peakDb[1], () => props.truePeakDb],
  () => {
    const clipSource = props.truePeakDb ?? Math.max(props.peakDb[0], props.peakDb[1]);
    clipped.value = latchClip(clipped.value, clipSource);
    clock.wake();
  },
  { immediate: true },
);

function clearClip(): void {
  clipped.value = false;
}

function fraction(valueDb: number): number {
  return dbToFraction(valueDb, props.minDb, props.maxDb);
}

const vertical = computed(() => props.orientation === 'vertical');

/** Hard colour stops so the lit bar reads as zones, not a blend. */
const zoneStyle = computed(() => ({
  '--pm-hot': `${(fraction(HOT_ZONE_DB) * 100).toFixed(2)}%`,
  '--pm-clip': `${(fraction(CLIP_THRESHOLD_DBTP) * 100).toFixed(2)}%`,
}));

function reveal(valueDb: number): string {
  const hidden = `${((1 - fraction(valueDb)) * 100).toFixed(2)}%`;
  return vertical.value ? `inset(${hidden} 0 0 0)` : `inset(0 ${hidden} 0 0)`;
}

function holdOffset(valueDb: number): string {
  return `${(fraction(valueDb) * 100).toFixed(2)}%`;
}

const bars = computed(() =>
  channels.value.map((state, i) => {
    const rms = props.rmsDb?.[i] ?? METER_FLOOR_DB;
    const holdVisible = state.holdDb > Math.max(props.minDb, NO_READING_DB);
    return {
      key: i === 0 ? 'L' : 'R',
      peakClip: reveal(state.levelDb),
      rmsClip: reveal(rms),
      hold: holdOffset(state.holdDb),
      holdVisible,
      holdHot: state.holdDb > CLIP_THRESHOLD_DBTP,
      readout: holdVisible ? formatMeterValue(state.holdDb) : '—',
    };
  }),
);

const ticks = computed(() => {
  const span = props.maxDb - props.minDb;
  const step = span <= 24 ? 3 : span <= 48 ? 6 : 12;
  return dbScaleTicks(props.minDb, props.maxDb, step).map((db) => ({
    db,
    offset: holdOffset(db),
  }));
});

/** Whole-dB summary so assistive tech is not fed a 47 Hz stream of decimals. */
const summary = computed(() => {
  const parts = channels.value.map((state, i) => {
    const db =
      state.holdDb > Math.max(props.minDb, NO_READING_DB) ? `${Math.round(state.holdDb)} dB` : '—';
    return `${i === 0 ? 'L' : 'R'} ${db}`;
  });
  return `${props.labels.name}: ${parts.join(', ')}`;
});
</script>

<template>
  <div
    class="peak-meter"
    :class="`peak-meter--${orientation}`"
    role="group"
    :aria-label="labels.name"
    :style="zoneStyle"
  >
    <div class="peak-meter__body" role="img" :aria-label="summary">
      <div v-if="vertical" class="peak-meter__scale" aria-hidden="true">
        <span
          v-for="tick in ticks"
          :key="tick.db"
          class="peak-meter__tick"
          :style="{ bottom: tick.offset }"
        >{{ tick.db }}</span>
      </div>
      <div v-for="bar in bars" :key="bar.key" class="peak-meter__channel">
        <span v-if="vertical" class="peak-meter__readout">{{ bar.readout }}</span>
        <div class="peak-meter__track">
          <div class="peak-meter__fill peak-meter__fill--peak" :style="{ clipPath: bar.peakClip }" />
          <div class="peak-meter__fill peak-meter__fill--rms" :style="{ clipPath: bar.rmsClip }" />
          <div
            v-show="bar.holdVisible"
            class="peak-meter__hold"
            :class="{ 'peak-meter__hold--hot': bar.holdHot }"
            :style="vertical ? { bottom: bar.hold } : { left: bar.hold }"
          />
        </div>
        <span class="peak-meter__channel-name">{{ bar.key }}</span>
      </div>
    </div>
    <button
      type="button"
      class="peak-meter__clip"
      :class="{ 'peak-meter__clip--on': clipped }"
      :disabled="!clipped"
      :aria-label="clipped ? labels.clearClip : labels.clip"
      @click="clearClip"
    >
      {{ labels.clip }}
    </button>
  </div>
</template>

<style scoped>
.peak-meter {
  display: flex;
  gap: 6px;
  font-family: var(--font-mono);
  color: var(--demo-text-muted);
}

.peak-meter--vertical {
  flex-direction: column;
  align-items: stretch;
  min-height: 160px;
  height: 100%;
}

.peak-meter--horizontal {
  flex-direction: row;
  align-items: center;
  width: 100%;
}

.peak-meter__body {
  position: relative;
  display: flex;
  flex: 1;
  min-height: 0;
  min-width: 0;
}

.peak-meter--vertical .peak-meter__body {
  gap: 4px;
}

.peak-meter--horizontal .peak-meter__body {
  flex-direction: column;
  gap: 2px;
}

.peak-meter__scale {
  position: relative;
  width: 22px;
  /* Align with the tracks, which sit between the readout and the channel name. */
  margin: 16px 0 14px;
}

.peak-meter__tick {
  position: absolute;
  right: 0;
  transform: translateY(50%);
  font-size: var(--demo-label-size);
  line-height: 1;
  font-variant-numeric: tabular-nums;
  color: var(--demo-text-faint);
}

.peak-meter__channel {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.peak-meter--vertical .peak-meter__channel {
  flex-direction: column;
  min-width: 12px;
}

.peak-meter__readout {
  height: 12px;
  font-size: var(--demo-label-size);
  line-height: 12px;
  font-variant-numeric: tabular-nums;
  color: var(--demo-text-strong);
  white-space: nowrap;
}

.peak-meter__channel-name {
  font-size: var(--demo-label-size);
  font-weight: var(--demo-label-weight);
  letter-spacing: var(--demo-label-tracking);
  line-height: 10px;
}

.peak-meter__track {
  position: relative;
  flex: 1;
  overflow: hidden;
  border: 1px solid var(--demo-border);
  border-radius: 3px;
  background: var(--demo-control-bg-strong);
}

.peak-meter--vertical .peak-meter__track {
  width: 100%;
  min-height: 0;
}

.peak-meter--horizontal .peak-meter__track {
  height: 5px;
  border-radius: 2px;
}

.peak-meter--horizontal .peak-meter__channel-name {
  order: -1;
  width: 8px;
  font-size: 8px;
}

.peak-meter__fill {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    var(--pm-direction),
    var(--demo-cyan) 0,
    var(--demo-cyan) var(--pm-hot),
    var(--demo-amber) var(--pm-hot),
    var(--demo-amber) var(--pm-clip),
    var(--demo-clip) var(--pm-clip)
  );
  will-change: clip-path;
}

.peak-meter--vertical .peak-meter__fill {
  --pm-direction: to top;
}

.peak-meter--horizontal .peak-meter__fill {
  --pm-direction: to right;
}

/* The translucent peak sits above the solid RMS body it encloses. */
.peak-meter__fill--peak {
  opacity: 0.42;
}

.peak-meter__hold {
  position: absolute;
  background: var(--demo-text-strong);
}

.peak-meter--vertical .peak-meter__hold {
  left: 0;
  right: 0;
  height: 2px;
  transform: translateY(50%);
}

.peak-meter--horizontal .peak-meter__hold {
  top: 0;
  bottom: 0;
  width: 2px;
  transform: translateX(-50%);
}

.peak-meter__hold--hot {
  background: var(--demo-clip);
}

.peak-meter__clip {
  flex-shrink: 0;
  padding: 2px 5px;
  border: 1px solid var(--demo-border-strong);
  border-radius: 3px;
  background: var(--demo-control-bg);
  color: var(--demo-text-faint);
  font-family: var(--font-mono);
  font-size: var(--demo-label-size);
  font-weight: var(--demo-label-weight);
  letter-spacing: var(--demo-label-tracking);
  text-transform: uppercase;
  line-height: 1.2;
}

.peak-meter__clip:disabled {
  cursor: default;
}

.peak-meter__clip--on {
  border-color: var(--demo-clip);
  background: var(--demo-clip);
  color: var(--demo-on-accent);
  cursor: pointer;
}

.dark .peak-meter__clip--on {
  box-shadow: 0 0 8px color-mix(in srgb, var(--demo-clip) 60%, transparent);
}

.peak-meter--horizontal .peak-meter__clip {
  padding: 1px 3px;
  font-size: 8px;
}
</style>
