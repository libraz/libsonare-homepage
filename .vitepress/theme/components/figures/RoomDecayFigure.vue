<script setup lang="ts">
/**
 * Energy decay curve with the T20/T30 and EDT fits drawn on it.
 *
 * The point the prose cannot make on its own: reverberation time is never
 * measured across a full 60 dB — the noise floor arrives first. Both fits are
 * straight lines through a clean part of the decay, extrapolated (dashed) down
 * to −60 dB, and because EDT's slope is taken from the steeper first 10 dB its
 * extrapolation lands earlier than T30's. That gap is EDT < RT60.
 */
import { computed } from 'vue';
import FigureFrame, { type FigureLegendItem } from './FigureFrame.vue';
import { energyDecay, linScale, path, sample } from './figureMath';

const props = withDefaults(
  defineProps<{
    title?: string;
    caption?: string;
    labels?: Partial<Record<Key, string>>;
  }>(),
  {},
);

type Key =
  | 'axisTime'
  | 'axisLevel'
  | 'curve'
  | 'edtFit'
  | 'lateFit'
  | 'noiseFloor'
  | 'early'
  | 'edtSpan'
  | 'lateSpan'
  | 'edtLands'
  | 'lateLands';

const DEFAULTS: Record<Key, string> = {
  axisTime: 'time after the source stops (s)',
  axisLevel: 'energy remaining (dB)',
  curve: 'measured energy decay curve',
  edtFit: 'EDT fit — first 10 dB, ×6',
  lateFit: 'T20 / T30 fit — −5 dB down, ×3 / ×2',
  noiseFloor: 'noise floor',
  early: 'direct + early',
  edtSpan: 'EDT fit · 0 → −10 dB',
  lateSpan: 'T30 fit · −5 → −35 dB',
  edtLands: 'EDT → 60 dB',
  lateLands: 'T30 → 60 dB',
};

const label = (key: Key) => props.labels?.[key] ?? DEFAULTS[key];

const legend = computed<FigureLegendItem[]>(() => [
  { series: 1, label: label('curve') },
  { series: 2, label: label('edtFit') },
  { series: 3, label: label('lateFit') },
]);

// --- Plot frame --------------------------------------------------------
const X0 = 70;
const X1 = 608;
const Y0 = 34;
const Y1 = 250;
const T_MAX = 1.25;
const DB_MIN = -65;
const NOISE_DB = -52;

// A live-ish room with pronounced early reflections: the first 6 dB fall away
// in 60 ms, then the diffuse tail settles onto its own slower slope.
const EARLY_DB = 6;
const EARLY_SEC = 0.06;
const RT_PARAM = 1.1;

const x = linScale(0, T_MAX, X0, X1);
const y = linScale(0, DB_MIN, Y0, Y1);
const edc = energyDecay(RT_PARAM, NOISE_DB, EARLY_DB, EARLY_SEC);
const tailSlope = -60 / RT_PARAM;

/** Time at which the ideal (noise-free) decay passes `db`. */
function timeAt(db: number): number {
  if (db > -EARLY_DB) return (-db * EARLY_SEC) / EARLY_DB;
  return EARLY_SEC + (-db - EARLY_DB) / -tailSlope;
}

const geom = computed(() => {
  const curve = path(sample(0, T_MAX, 260, (s) => y(edc(s))).map(([s, py]) => [x(s), py]));

  // EDT: slope of the first 10 dB, extrapolated to −60.
  const t10 = timeAt(-10);
  const edtSlope = -10 / t10;
  const edtEnd = -60 / edtSlope;

  // T20/T30: slope between −5 dB and −35 dB, extrapolated to −60.
  const t5 = timeAt(-5);
  const t35 = timeAt(-35);
  const lateSlope = -30 / (t35 - t5);
  const lateEnd = t5 + (-60 - -5) / lateSlope;

  return {
    curve,
    edtSolid: path([
      [x(0), y(0)],
      [x(t10), y(-10)],
    ]),
    edtDashed: path([
      [x(t10), y(-10)],
      [x(edtEnd), y(-60)],
    ]),
    lateSolid: path([
      [x(t5), y(-5)],
      [x(t35), y(-35)],
    ]),
    lateDashed: path([
      [x(t35), y(-35)],
      [x(lateEnd), y(-60)],
    ]),
    band: {
      x: x(t5),
      y: y(-5),
      w: x(t35) - x(t5),
      h: y(-35) - y(-5),
      labelW: Math.min(x(t35) - x(t5) - 12, 170),
    },
    edtEndX: x(edtEnd),
    lateEndX: x(lateEnd),
    earlyW: x(EARLY_SEC) - X0,
  };
});

const dbTicks = [0, -5, -10, -25, -35, -52, -60];
const timeTicks = [0, 0.25, 0.5, 0.75, 1.0, 1.25];
</script>

<template>
  <FigureFrame
    :title="props.title"
    :caption="props.caption"
    view-box="0 0 640 316"
    :width="640"
    :legend="legend"
  >
    <!-- Fit band: the part of the decay the T20/T30 line is actually fitted to -->
    <rect
      class="fx-area fx-area--3"
      :x="geom.band.x"
      :y="geom.band.y"
      :width="geom.band.w"
      :height="geom.band.h"
    />
    <rect
      class="fx-plate"
      :x="geom.band.x + 6"
      :y="geom.band.y + geom.band.h - 24"
      :width="geom.band.labelW"
      height="16"
    />
    <text class="fx-axis-label" :x="geom.band.x + 10" :y="geom.band.y + geom.band.h - 12">
      {{ label('lateSpan') }}
    </text>

    <!-- Direct-sound + early-reflection region, excluded from the fit -->
    <rect class="fx-area fx-area--faint" :x="X0" :y="Y0" :width="geom.earlyW" :height="Y1 - Y0" />
    <text
      class="fx-axis-label"
      :x="X0 + geom.earlyW / 2 + 3"
      :y="Y1 - 14"
      :transform="`rotate(-90 ${X0 + geom.earlyW / 2 + 3} ${Y1 - 14})`"
    >
      {{ label('early') }}
    </text>

    <!-- dB guides -->
    <g v-for="db in dbTicks" :key="`db-${db}`">
      <line
        :class="db === -60 ? 'fx-guide' : 'fx-grid fx-grid--dashed'"
        :x1="X0"
        :x2="X1"
        :y1="y(db)"
        :y2="y(db)"
      />
      <text class="fx-tick" :x="X0 - 8" :y="y(db)" text-anchor="end" dy="0.34em">{{ db }}</text>
    </g>

    <!-- Noise floor -->
    <text class="fx-note" :x="X1 - 4" :y="y(NOISE_DB) - 7" text-anchor="end">
      {{ label('noiseFloor') }}
    </text>

    <!-- Axes -->
    <line class="fx-axis" :x1="X0" :x2="X0" :y1="Y0" :y2="Y1" />
    <line class="fx-axis" :x1="X0" :x2="X1" :y1="Y1" :y2="Y1" />
    <g v-for="tick in timeTicks" :key="`t-${tick}`">
      <line class="fx-axis" :x1="x(tick)" :x2="x(tick)" :y1="Y1" :y2="Y1 + 4" />
      <text class="fx-tick" :x="x(tick)" :y="Y1 + 15" text-anchor="middle">{{ tick }}</text>
    </g>
    <text class="fx-axis-label" :x="X1" :y="Y1 + 52" text-anchor="end">{{ label('axisTime') }}</text>
    <text
      class="fx-axis-label"
      :x="18"
      :y="(Y0 + Y1) / 2"
      text-anchor="middle"
      :transform="`rotate(-90 18 ${(Y0 + Y1) / 2})`"
    >
      {{ label('axisLevel') }}
    </text>

    <!-- Fits -->
    <path class="fx-curve fx-curve--2 fx-curve--thin" :d="geom.edtSolid" />
    <path class="fx-curve fx-curve--2 fx-curve--thin fx-curve--dashed" :d="geom.edtDashed" />
    <path class="fx-curve fx-curve--3 fx-curve--thin" :d="geom.lateSolid" />
    <path class="fx-curve fx-curve--3 fx-curve--thin fx-curve--dashed" :d="geom.lateDashed" />

    <!-- Measured decay, drawn last so it reads as the ground truth -->
    <path class="fx-curve" :d="geom.curve" />

    <text class="fx-axis-label" :x="X0 + 84" :y="Y0 + 14">{{ label('edtSpan') }}</text>
    <path class="fx-leader" :d="`M ${X0 + 80} ${Y0 + 11} L ${X0 + 40} ${Y0 + 21}`" />

    <!-- Where each extrapolation reaches 60 dB -->
    <g>
      <circle class="fx-dot fx-dot--2" :cx="geom.edtEndX" :cy="y(-60)" r="3.4" />
      <text class="fx-value fx-value--2" :x="geom.edtEndX" :y="Y1 + 32" text-anchor="middle">
        {{ label('edtLands') }}
      </text>
      <line class="fx-leader" :x1="geom.edtEndX" :x2="geom.edtEndX" :y1="y(-60) + 5" :y2="Y1 + 22" />
    </g>
    <g>
      <circle class="fx-dot fx-dot--3" :cx="geom.lateEndX" :cy="y(-60)" r="3.4" />
      <text class="fx-value fx-value--3" :x="geom.lateEndX" :y="Y1 + 32" text-anchor="middle">
        {{ label('lateLands') }}
      </text>
      <line
        class="fx-leader"
        :x1="geom.lateEndX"
        :x2="geom.lateEndX"
        :y1="y(-60) + 5"
        :y2="Y1 + 22"
      />
    </g>
  </FigureFrame>
</template>
