<script setup lang="ts">
/**
 * Where the air band sits, and what air-band processing is actually doing there.
 *
 * The prose distinguishes two situations that look the same on a fader: a source
 * with usable high-frequency material (a shelf lifts it) and a source that falls
 * off a cliff (a shelf has nothing to lift, so the upper edge has to be inferred
 * from the harmonics below it). Plotting the roll-off against the band ruler
 * makes the distinction concrete — and shows why the region is mostly texture
 * rather than pitch.
 */
import { computed } from 'vue';
import FigureFrame, { type FigureLegendItem } from './FigureFrame.vue';
import { areaPath, linScale, logScale, path, sample } from './figureMath';

export interface BandSpan {
  from: number;
  to: number;
  label: string;
  highlight?: boolean;
}

const props = withDefaults(
  defineProps<{
    title?: string;
    caption?: string;
    /** Frequency where the source stops carrying usable material. */
    cliffHz?: number;
    bands?: BandSpan[];
    labels?: Partial<Record<Key, string>>;
  }>(),
  {
    cliffHz: 16000,
    bands: () => [
      { from: 20, to: 60, label: 'sub' },
      { from: 60, to: 250, label: 'low' },
      { from: 250, to: 800, label: 'low-mid' },
      { from: 800, to: 3000, label: 'mid' },
      { from: 3000, to: 10000, label: 'presence' },
      { from: 10000, to: 20000, label: 'air', highlight: true },
    ],
  },
);

type Key = 'axisFreq' | 'axisLevel' | 'source' | 'restored' | 'airBand' | 'cliff' | 'bands';

const DEFAULTS: Record<Key, string> = {
  axisFreq: 'frequency (Hz, log)',
  axisLevel: 'level (dB)',
  source: 'source spectrum',
  restored: 'inferred upper edge',
  airBand: 'air band',
  cliff: 'source falls off',
  bands: 'mastering bands',
};

const label = (key: Key) => props.labels?.[key] ?? DEFAULTS[key];

const legend = computed<FigureLegendItem[]>(() => [
  { series: 1, label: label('source') },
  { series: 3, shape: 'dashed', label: label('restored') },
  { series: 3, shape: 'block', label: label('airBand') },
]);

const X0 = 66;
const X1 = 606;
const Y0 = 44;
const Y1 = 200;
const RULER_TOP = 240;
const RULER_BOT = 266;
const F_MIN = 20;
const F_MAX = 20000;

const x = logScale(F_MIN, F_MAX, X0, X1);
const y = linScale(4, -46, Y0, Y1);

/** A plausible music spectrum: flat low end, gentle tilt, then a hard cliff. */
function sourceDb(f: number): number {
  const tilt = f <= 200 ? 0 : -3 * Math.log2(f / 200);
  if (f <= props.cliffHz) return tilt;
  return tilt - 60 * Math.log2(f / props.cliffHz);
}

/** The trend the cliff interrupted — what reconstruction aims at. */
const trendDb = (f: number) => (f <= 200 ? 0 : -3 * Math.log2(f / 200));

const geom = computed(() => {
  const spectrum = sample(Math.log10(F_MIN), Math.log10(F_MAX), 300, (l) => {
    const f = 10 ** l;
    return y(sourceDb(f));
  }).map(([l, py]) => [x(10 ** l), py] as [number, number]);

  const from = Math.log10(props.cliffHz);
  const to = Math.log10(F_MAX);
  // Start the trend line well below the cliff, where it still coincides with
  // the source: it reads as the line the roll-off departs from.
  const trendFrom = Math.log10(props.cliffHz / 2.8);
  const trend = sample(trendFrom, to, 60, (l) => y(trendDb(10 ** l))).map(
    ([l, py]) => [x(10 ** l), py] as [number, number],
  );
  const upper = sample(from, to, 40, (l) => y(trendDb(10 ** l))).map(
    ([l, py]) => [x(10 ** l), py] as [number, number],
  );
  const cliff = sample(from, to, 40, (l) => y(sourceDb(10 ** l))).map(
    ([l, py]) => [x(10 ** l), py] as [number, number],
  );

  const air = props.bands.find((b) => b.highlight);

  return {
    spectrum: path(spectrum),
    spectrumArea: areaPath(spectrum, Y1),
    upper: path(trend),
    // The wedge between where the source stops and where the trend was heading.
    gap: `${path(upper)} ${cliff
      .slice()
      .reverse()
      .map((p) => `L ${p[0]} ${p[1]}`)
      .join(' ')} Z`,
    cliffX: x(props.cliffHz),
    airRegion: air ? { x: x(air.from), w: x(air.to) - x(air.from) } : null,
    ruler: props.bands.map((b) => ({
      x: x(b.from),
      w: x(b.to) - x(b.from),
      cx: (x(b.from) + x(b.to)) / 2,
      label: b.label,
      highlight: b.highlight === true,
    })),
  };
});

const fTicks = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
const fTickLabel = (f: number) => (f >= 1000 ? `${f / 1000}k` : `${f}`);
const dbTicks = [0, -12, -24, -36];
</script>

<template>
  <FigureFrame
    :title="props.title"
    :caption="props.caption"
    view-box="0 0 640 308"
    :width="640"
    :legend="legend"
  >
    <!-- Air band -->
    <rect
      v-if="geom.airRegion"
      class="fx-area fx-area--3"
      :x="geom.airRegion.x"
      :y="Y0"
      :width="geom.airRegion.w"
      :height="Y1 - Y0"
    />

    <g v-for="db in dbTicks" :key="`db-${db}`">
      <line class="fx-grid fx-grid--dashed" :x1="X0" :x2="X1" :y1="y(db)" :y2="y(db)" />
      <text class="fx-tick" :x="X0 - 8" :y="y(db)" text-anchor="end" dy="0.34em">{{ db }}</text>
    </g>

    <!-- What reconstruction has to invent -->
    <path class="fx-area fx-area--3" :d="geom.gap" />
    <path class="fx-area fx-area--faint" :d="geom.spectrumArea" />
    <path class="fx-curve fx-curve--3 fx-curve--thin fx-curve--dashed" :d="geom.upper" />
    <path class="fx-curve" :d="geom.spectrum" />

    <!-- Cliff -->
    <line class="fx-guide" :x1="geom.cliffX" :x2="geom.cliffX" :y1="Y0" :y2="Y1" />
    <text
      class="fx-value fx-value--3"
      :x="geom.cliffX - 8"
      :y="Y0 + 14"
      text-anchor="end"
    >
      {{ label('cliff') }}
    </text>

    <!-- Axes -->
    <line class="fx-axis" :x1="X0" :x2="X0" :y1="Y0" :y2="Y1" />
    <line class="fx-axis" :x1="X0" :x2="X1" :y1="Y1" :y2="Y1" />
    <g v-for="f in fTicks" :key="`f-${f}`">
      <line class="fx-axis" :x1="x(f)" :x2="x(f)" :y1="Y1" :y2="Y1 + 4" />
      <text class="fx-tick" :x="x(f)" :y="Y1 + 15" text-anchor="middle">{{ fTickLabel(f) }}</text>
    </g>
    <text
      class="fx-axis-label"
      :x="20"
      :y="(Y0 + Y1) / 2"
      text-anchor="middle"
      :transform="`rotate(-90 20 ${(Y0 + Y1) / 2})`"
    >
      {{ label('axisLevel') }}
    </text>

    <!-- Band ruler -->
    <g v-for="(b, i) in geom.ruler" :key="`band-${i}`">
      <rect
        :class="b.highlight ? 'fx-block fx-block--3' : 'fx-block fx-block--muted'"
        :x="b.x"
        :y="RULER_TOP"
        :width="b.w"
        :height="RULER_BOT - RULER_TOP"
        rx="2"
      />
      <text class="fx-axis-label" :x="b.cx" :y="RULER_TOP + 17" text-anchor="middle">
        {{ b.label }}
      </text>
    </g>
    <text class="fx-axis-label" :x="X0" :y="RULER_TOP - 8">{{ label('bands') }}</text>
    <text class="fx-axis-label" :x="X1" :y="RULER_BOT + 18" text-anchor="end">
      {{ label('axisFreq') }}
    </text>
  </FigureFrame>
</template>
