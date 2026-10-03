<script lang="ts">
/** Visitor-facing copy for {@link LoudnessMeter}; the demo passes its own locale. */
export interface LoudnessMeterLabels {
  /** Accessible name of the meter. */
  name: string;
  /** Accessible name of the scale switch. */
  scale: string;
  /** Caption of the target marker. */
  target: string;
}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import {
  CLIP_THRESHOLD_DBTP,
  dbToFraction,
  formatMeterValue,
  type LoudnessScale,
  loudnessScaleSpec,
  lufsInScale,
  METER_FLOOR_DB,
} from './meterBallistics';

const props = withDefaults(
  defineProps<{
    /** Momentary loudness (400 ms) in LUFS. */
    momentaryLufs: number;
    /** Short-term loudness (3 s) in LUFS. */
    shortTermLufs: number;
    /** Integrated loudness in LUFS. */
    integratedLufs: number;
    /** Loudness range in LU. */
    lra: number;
    /** Maximum true peak in dBTP. */
    truePeakDb: number;
    /** Optional target loudness in LUFS, drawn as a marker. */
    targetLufs?: number | null;
    labels: LoudnessMeterLabels;
  }>(),
  { targetLufs: null },
);

/** Absolute LUFS by default; `ebu9` relabels the scale in LU around -23 LUFS. */
const scale = defineModel<LoudnessScale>('scale', { default: 'absolute' });

/** At or below this the engine reports its floor: there is no reading yet, not a level. */
const NO_READING_DB = METER_FLOOR_DB + 1;

/** The value, or NaN when it is the engine floor (silence or nothing measured). */
function reading(value: number): number {
  return Number.isFinite(value) && value > NO_READING_DB ? value : Number.NaN;
}

const spec = computed(() => loudnessScaleSpec(scale.value));

function position(lufs: number): string {
  return `${(dbToFraction(lufs, spec.value.minLufs, spec.value.maxLufs) * 100).toFixed(2)}%`;
}

function reveal(lufs: number): string {
  const lit = dbToFraction(lufs, spec.value.minLufs, spec.value.maxLufs);
  return `inset(${((1 - lit) * 100).toFixed(2)}% 0 0 0)`;
}

/** A loudness in the scale's own unit, signed on the relative scale. */
function inScale(lufs: number): string {
  return formatMeterValue(lufsInScale(lufs, scale.value), scale.value === 'ebu9');
}

const plr = computed(() => reading(props.truePeakDb) - reading(props.integratedLufs));

const readouts = computed(() => [
  { key: 'M', value: inScale(reading(props.momentaryLufs)), unit: spec.value.unit },
  { key: 'S', value: inScale(reading(props.shortTermLufs)), unit: spec.value.unit },
  { key: 'LRA', value: formatMeterValue(props.lra), unit: 'LU' },
  {
    key: 'TP',
    value: formatMeterValue(reading(props.truePeakDb)),
    unit: 'dBTP',
    hot: props.truePeakDb > CLIP_THRESHOLD_DBTP,
  },
  { key: 'PLR', value: formatMeterValue(plr.value), unit: 'dB' },
]);

const target = computed(() =>
  props.targetLufs !== null && Number.isFinite(props.targetLufs)
    ? { offset: position(props.targetLufs), text: inScale(props.targetLufs) }
    : null,
);

const integratedVisible = computed(() => Number.isFinite(reading(props.integratedLufs)));

/** Whole-unit values so a 47 Hz stream does not churn the accessible name. */
const summary = computed(() => {
  const unit = spec.value.unit;
  const round = (lufs: number) => {
    const text = inScale(Math.round(reading(lufs)));
    return text === '—' ? text : `${text} ${unit}`;
  };
  return `${props.labels.name}: M ${round(props.momentaryLufs)}, S ${round(props.shortTermLufs)}, I ${round(props.integratedLufs)}`;
});

function toggleScale(): void {
  scale.value = scale.value === 'absolute' ? 'ebu9' : 'absolute';
}
</script>

<template>
  <div class="loudness-meter" role="group" :aria-label="labels.name">
    <div class="loudness-meter__graph" role="img" :aria-label="summary">
      <div class="loudness-meter__scale" aria-hidden="true">
        <span
          v-for="tick in spec.ticks"
          :key="tick.lufs"
          class="loudness-meter__tick"
          :style="{ bottom: position(tick.lufs) }"
        >{{ tick.label }}</span>
      </div>
      <div class="loudness-meter__bars">
        <div v-for="bar in ['M', 'S']" :key="bar" class="loudness-meter__bar">
          <div class="loudness-meter__track">
            <div
              class="loudness-meter__fill"
              :class="`loudness-meter__fill--${bar}`"
              :style="{ clipPath: reveal(bar === 'M' ? momentaryLufs : shortTermLufs) }"
            />
          </div>
          <span class="loudness-meter__bar-name">{{ bar }}</span>
        </div>
        <div class="loudness-meter__markers">
          <div
            v-if="target"
            class="loudness-meter__marker loudness-meter__marker--target"
            :style="{ bottom: target.offset }"
            :title="`${labels.target} ${target.text}`"
          />
          <div
            v-if="integratedVisible"
            class="loudness-meter__marker loudness-meter__marker--integrated"
            :style="{ bottom: position(integratedLufs) }"
          />
        </div>
      </div>
    </div>

    <div class="loudness-meter__panel">
      <button
        type="button"
        class="loudness-meter__switch"
        :aria-label="labels.scale"
        :aria-pressed="scale === 'ebu9'"
        @click="toggleScale"
      >
        <span :class="{ 'is-active': scale === 'absolute' }">LUFS</span>
        <span :class="{ 'is-active': scale === 'ebu9' }">EBU +9</span>
      </button>

      <div class="loudness-meter__integrated">
        <span class="loudness-meter__key">I</span>
        <strong class="loudness-meter__big">{{ inScale(reading(integratedLufs)) }}</strong>
        <span class="loudness-meter__unit">{{ spec.unit }}</span>
      </div>

      <dl class="loudness-meter__readouts">
        <div
          v-for="item in readouts"
          :key="item.key"
          class="loudness-meter__readout"
          :class="{ 'loudness-meter__readout--hot': item.hot }"
        >
          <dt class="loudness-meter__key">{{ item.key }}</dt>
          <dd>
            <span class="loudness-meter__value">{{ item.value }}</span>
            <span class="loudness-meter__unit">{{ item.unit }}</span>
          </dd>
        </div>
      </dl>

      <p v-if="target" class="loudness-meter__target-note">
        <span class="loudness-meter__swatch" aria-hidden="true" />
        {{ labels.target }} {{ target.text }} {{ spec.unit }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.loudness-meter {
  display: grid;
  grid-template-columns: minmax(64px, auto) minmax(0, 1fr);
  gap: 14px;
  min-height: 180px;
  font-family: var(--font-mono);
  color: var(--demo-text-muted);
}

.loudness-meter__graph {
  display: flex;
  gap: 4px;
  min-height: 0;
}

.loudness-meter__scale {
  position: relative;
  width: 24px;
  margin-bottom: 14px;
}

.loudness-meter__tick {
  position: absolute;
  right: 0;
  transform: translateY(50%);
  font-size: var(--demo-label-size);
  line-height: 1;
  font-variant-numeric: tabular-nums;
  color: var(--demo-text-faint);
}

.loudness-meter__bars {
  position: relative;
  display: flex;
  gap: 4px;
}

.loudness-meter__bar {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 14px;
}

.loudness-meter__track {
  position: relative;
  flex: 1;
  width: 100%;
  overflow: hidden;
  border: 1px solid var(--demo-border);
  border-radius: 3px;
  background: var(--demo-control-bg-strong);
}

.loudness-meter__fill {
  position: absolute;
  inset: 0;
  background: var(--demo-cyan);
  will-change: clip-path;
}

.loudness-meter__fill--M {
  opacity: 0.55;
}

.loudness-meter__bar-name {
  font-size: var(--demo-label-size);
  font-weight: var(--demo-label-weight);
  line-height: 10px;
}

/* Markers span both bars, over the same vertical extent as the tracks. */
.loudness-meter__markers {
  position: absolute;
  inset: 0 -3px 14px;
  pointer-events: none;
}

.loudness-meter__marker {
  position: absolute;
  left: 0;
  right: 0;
  transform: translateY(50%);
}

.loudness-meter__marker--integrated {
  height: 2px;
  background: var(--demo-accent);
}

.loudness-meter__marker--target {
  height: 0;
  border-top: 2px dashed var(--demo-success);
}

.loudness-meter__panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.loudness-meter__switch {
  display: flex;
  align-self: flex-start;
  padding: 2px;
  border: 1px solid var(--demo-border-strong);
  border-radius: 6px;
  background: var(--demo-control-bg);
  font-family: var(--font-mono);
  font-size: var(--demo-label-size);
  font-weight: var(--demo-label-weight);
  letter-spacing: var(--demo-label-tracking);
  color: var(--demo-text-muted);
  cursor: pointer;
}

.loudness-meter__switch span {
  padding: 2px 6px;
  border-radius: 4px;
}

.loudness-meter__switch span.is-active {
  background: var(--demo-accent-dim);
  color: var(--demo-text-strong);
}

.loudness-meter__integrated {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.loudness-meter__big {
  font-size: 22px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--demo-text-strong);
}

.loudness-meter__key {
  font-size: var(--demo-label-size);
  font-weight: var(--demo-label-weight);
  letter-spacing: var(--demo-label-tracking);
  color: var(--demo-text-muted);
}

.loudness-meter__unit {
  margin-left: 3px;
  font-size: var(--demo-label-size);
  color: var(--demo-text-faint);
}

.loudness-meter__readouts {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
  gap: 6px 12px;
  margin: 0;
}

.loudness-meter__readout {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 6px;
  padding-bottom: 3px;
  border-bottom: 1px solid var(--demo-border);
}

.loudness-meter__readout dd {
  margin: 0;
  white-space: nowrap;
}

.loudness-meter__value {
  font-size: 12px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  color: var(--demo-text-strong);
}

.loudness-meter__readout--hot .loudness-meter__value {
  color: var(--demo-clip);
}

.loudness-meter__target-note {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: var(--demo-label-size);
  font-variant-numeric: tabular-nums;
  color: var(--demo-text-muted);
}

.loudness-meter__swatch {
  width: 12px;
  border-top: 2px dashed var(--demo-success);
}
</style>
