<script setup lang="ts">
/**
 * Sampling on two axes, then what happens above Nyquist.
 *
 * Left: a continuous wave read at a fixed time grid, each reading rounded to
 * the nearest of eight levels (3 bits), so both the sample period and the
 * quantization step are visible distances. Right: a 30 kHz cosine sampled at
 * 44.1 kHz; the samples are computed from the tone, and the 14.1 kHz curve is
 * cos(2π·(fs − f)·t − φ), which passes through every one of them.
 */
import { computed } from 'vue';
import FigureFrame, { type FigureLegendItem } from './FigureFrame.vue';
import { linScale, path, sample } from './figureMath';

const props = defineProps<{
  title?: string;
  caption?: string;
  labels?: Partial<Record<Key, string>>;
}>();

type Key = 'sampling' | 'aliasing' | 'wave' | 'period' | 'step' | 'tone' | 'alias' | 'rate';

const DEFAULTS: Record<Key, string> = {
  sampling: 'sampling and quantization',
  aliasing: 'a tone above Nyquist',
  wave: 'continuous wave',
  period: '1 / sample rate',
  step: 'quantization step',
  tone: 'tone',
  alias: 'alias',
  rate: 'sampled at',
};

const label = (key: Key) => props.labels?.[key] ?? DEFAULTS[key];

const FS = 44_100;
const TONE_HZ = 30_000;
const ALIAS_HZ = FS - TONE_HZ;
const PHASE = 0.5;
const ALIAS_SAMPLES = 10;

const BITS = 3;
const LEVELS = 2 ** BITS;
const SAMPLES = 16;

const TOP = 50;
const BOT = 196;
const MID = (TOP + BOT) / 2;
const AMP = (BOT - TOP) / 2;
const P1 = { x0: 64, x1: 314 };
const P2 = { x0: 366, x1: 610 };

const ya = linScale(-1, 1, MID + AMP, MID - AMP);
const kHz = (hz: number) => `${(hz / 1000).toFixed(1).replace(/\.0$/, '')} kHz`;

const legend = computed<FigureLegendItem[]>(() => [
  { series: 1, label: label('wave') },
  { series: 3, label: `${label('tone')} ${kHz(TONE_HZ)}` },
  { series: 2, label: `${label('alias')} ${kHz(ALIAS_HZ)}` },
]);

/** Mid-rise quantizer levels: ±1/8, ±3/8, ±5/8, ±7/8 of full scale. */
const LEVEL_VALUES = Array.from({ length: LEVELS }, (_, k) => (2 * k + 1) / LEVELS - 1);
const quantize = (v: number) =>
  LEVEL_VALUES.reduce((best, l) => (Math.abs(l - v) < Math.abs(best - v) ? l : best));

const wave = (t: number) =>
  0.62 * Math.sin(2 * Math.PI * 1.15 * t + 0.3) + 0.24 * Math.sin(2 * Math.PI * 2.6 * t + 1.1);

const left = computed(() => {
  const sx = linScale(0, 1, P1.x0, P1.x1);
  const dt = 1 / SAMPLES;
  const pts = Array.from({ length: SAMPLES }, (_, i) => {
    const t = (i + 0.5) * dt;
    const q = quantize(wave(t));
    return { x: sx(t), y: ya(q), trueY: ya(wave(t)) };
  });
  return {
    curve: path(sample(0, 1, 240, wave).map(([t, v]) => [sx(t), ya(v)])),
    levels: LEVEL_VALUES.map((l) => ya(l)),
    pts,
    periodX0: pts[3].x,
    periodX1: pts[4].x,
    stepY0: ya(LEVEL_VALUES[0]),
    stepY1: ya(LEVEL_VALUES[1]),
  };
});

const right = computed(() => {
  const span = ALIAS_SAMPLES / FS;
  const sx = linScale(0, span, P2.x0, P2.x1);
  const tone = (t: number) => Math.cos(2 * Math.PI * TONE_HZ * t + PHASE);
  const alias = (t: number) => Math.cos(2 * Math.PI * ALIAS_HZ * t - PHASE);
  const scale = 0.82;
  const toPx = (fn: (t: number) => number) =>
    path(sample(0, span, 600, fn).map(([t, v]) => [sx(t), ya(scale * v)]));
  return {
    tone: toPx(tone),
    alias: toPx(alias),
    dots: Array.from({ length: ALIAS_SAMPLES + 1 }, (_, n) => ({
      x: sx(n / FS),
      y: ya(scale * tone(n / FS)),
    })),
  };
});
</script>

<template>
  <FigureFrame
    :title="props.title"
    :caption="props.caption"
    view-box="0 0 640 262"
    :width="640"
    :legend="legend"
  >
    <!-- Left panel: sampling and quantization -->
    <text class="fx-axis-label" :x="P1.x0" y="30">{{ label('sampling') }}</text>
    <line
      v-for="(y, i) in left.levels"
      :key="`lv-${i}`"
      class="fx-grid fx-grid--dashed"
      :x1="P1.x0"
      :x2="P1.x1"
      :y1="y"
      :y2="y"
    />
    <line class="fx-axis" :x1="P1.x0" :x2="P1.x0" :y1="TOP" :y2="BOT" />
    <line class="fx-grid fx-grid--strong" :x1="P1.x0" :x2="P1.x1" :y1="MID" :y2="MID" />
    <path class="fx-curve fx-curve--thin" :d="left.curve" />
    <g v-for="(p, i) in left.pts" :key="`s-${i}`">
      <line class="fx-leader" :x1="p.x" :x2="p.x" :y1="MID" :y2="p.y" />
      <circle class="fx-dot fx-dot--3" :cx="p.x" :cy="p.y" r="3.4" />
    </g>

    <!-- Sample period -->
    <line class="fx-guide fx-guide--neutral" :x1="left.periodX0" :x2="left.periodX0" :y1="BOT" :y2="BOT + 12" />
    <line class="fx-guide fx-guide--neutral" :x1="left.periodX1" :x2="left.periodX1" :y1="BOT" :y2="BOT + 12" />
    <line class="fx-leader" :x1="left.periodX0" :x2="left.periodX1" :y1="BOT + 8" :y2="BOT + 8" />
    <text class="fx-note" :x="left.periodX0" :y="BOT + 26">{{ label('period') }}</text>

    <!-- Quantization step -->
    <line class="fx-curve fx-curve--3 fx-curve--thin" :x1="P1.x1 + 8" :x2="P1.x1 + 8" :y1="left.stepY0" :y2="left.stepY1" />
    <line class="fx-leader" :x1="P1.x1 + 5" :x2="P1.x1 + 11" :y1="left.stepY0" :y2="left.stepY0" />
    <line class="fx-leader" :x1="P1.x1 + 5" :x2="P1.x1 + 11" :y1="left.stepY1" :y2="left.stepY1" />
    <text class="fx-note" :x="P1.x1 + 8" :y="BOT + 26" text-anchor="end">{{ label('step') }}</text>

    <!-- Right panel: aliasing -->
    <text class="fx-axis-label" :x="P2.x0" y="30">{{ label('aliasing') }}</text>
    <line class="fx-axis" :x1="P2.x0" :x2="P2.x0" :y1="TOP" :y2="BOT" />
    <line class="fx-grid fx-grid--strong" :x1="P2.x0" :x2="P2.x1" :y1="MID" :y2="MID" />
    <line
      v-for="(d, i) in right.dots"
      :key="`ag-${i}`"
      class="fx-grid"
      :x1="d.x"
      :x2="d.x"
      :y1="TOP"
      :y2="BOT"
    />
    <path class="fx-curve fx-curve--3 fx-curve--thin" :d="right.tone" />
    <path class="fx-curve fx-curve--2" :d="right.alias" />
    <circle
      v-for="(d, i) in right.dots"
      :key="`ad-${i}`"
      class="fx-dot fx-dot--2"
      :cx="d.x"
      :cy="d.y"
      r="3.4"
    />
    <text class="fx-note" :x="P2.x0" :y="BOT + 26">
      {{ label('rate') }} {{ kHz(FS) }}: {{ kHz(TONE_HZ) }} → {{ kHz(ALIAS_HZ) }}
    </text>
  </FigureFrame>
</template>
