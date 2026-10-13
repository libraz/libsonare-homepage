<script setup lang="ts">
/**
 * The four `setClipFade` curves, and what a crossfade built from them sums to.
 *
 * Left: gain against the fraction of a fade-in completed, from each curve's
 * formula. Right: a crossfade pairs a fade-out (the curve mirrored in time)
 * with a fade-in. Correlated material adds in amplitude, 20·log10(gOut + gIn);
 * uncorrelated material adds in power, 10·log10(gOut² + gIn²). Linear is flat
 * for the first and equal-power for the second; each is 3 dB off for the other.
 */
import { computed } from 'vue';
import FigureFrame, { type FigureLegendItem } from './FigureFrame.vue';
import { linScale, path, sample } from './figureMath';

const props = defineProps<{
  title?: string;
  caption?: string;
  labels?: Partial<Record<Key, string>>;
}>();

type Key =
  | 'curves'
  | 'sums'
  | 'linear'
  | 'equalPower'
  | 'exponential'
  | 'logarithmic'
  | 'correlated'
  | 'uncorrelated'
  | 'progress';

const DEFAULTS: Record<Key, string> = {
  curves: 'fade-in gain',
  sums: 'crossfade, summed level',
  linear: "'linear'  x",
  equalPower: "'equal-power'  sin(x·π/2)",
  exponential: "'exponential'  x²",
  logarithmic: "'logarithmic'  √x",
  correlated: 'near-identical',
  uncorrelated: 'unrelated',
  progress: 'fade progress x',
};

const label = (key: Key) => props.labels?.[key] ?? DEFAULTS[key];

const CURVES = [
  { key: 'linear' as const, series: 1 as const, fn: (x: number) => x },
  {
    key: 'equalPower' as const,
    series: 2 as const,
    fn: (x: number) => Math.sin((x * Math.PI) / 2),
  },
  { key: 'exponential' as const, series: 3 as const, fn: (x: number) => x * x },
  { key: 'logarithmic' as const, series: 4 as const, fn: (x: number) => Math.sqrt(x) },
];

const TOP = 44;
const BOT = 206;
const P1 = { x0: 60, x1: 290 };
const P2 = { x0: 376, x1: 600 };
const DB_RANGE = 4;

const g = linScale(0, 1, BOT, TOP);
const s1 = linScale(0, 1, P1.x0, P1.x1);
const s2 = linScale(0, 1, P2.x0, P2.x1);
const d = linScale(-DB_RANGE, DB_RANGE, BOT, TOP);

const legend = computed<FigureLegendItem[]>(() =>
  CURVES.map((c) => ({ series: c.series, label: label(c.key) })),
);

const fades = computed(() =>
  CURVES.map((c) => ({
    ...c,
    d: path(sample(0, 1, 200, c.fn).map(([x, v]) => [s1(x), g(v)])),
    midY: g(c.fn(0.5)),
  })),
);

const sums = computed(() =>
  CURVES.slice(0, 2).flatMap((c) => {
    const pair = (x: number) => [c.fn(1 - x), c.fn(x)] as const;
    const correlated = (x: number) => {
      const [o, i] = pair(x);
      return 20 * Math.log10(o + i);
    };
    const uncorrelated = (x: number) => {
      const [o, i] = pair(x);
      return 10 * Math.log10(o * o + i * i);
    };
    return [
      { key: `${c.key}-c`, series: c.series, dashed: false, fn: correlated },
      { key: `${c.key}-u`, series: c.series, dashed: true, fn: uncorrelated },
    ].map((s) => ({
      ...s,
      d: path(sample(0, 1, 200, s.fn).map(([x, v]) => [s2(x), d(v)])),
      mid: s.fn(0.5),
    }));
  }),
);

const peak = computed(() => sums.value.reduce((a, b) => (b.mid > a.mid ? b : a)));
const dip = computed(() => sums.value.reduce((a, b) => (b.mid < a.mid ? b : a)));
const KEY_STROKE = { stroke: 'var(--fx-ink-dim)' };
const fmtDb = (db: number) => `${db > 0 ? '+' : '−'}${Math.abs(db).toFixed(1)} dB`;
</script>

<template>
  <FigureFrame
    :title="props.title"
    :caption="props.caption"
    view-box="0 0 640 250"
    :width="640"
    :legend="legend"
  >
    <!-- Left: the four fade-in curves -->
    <text class="fx-axis-label" :x="P1.x0" y="22">{{ label('curves') }}</text>
    <g v-for="v in [0, 0.25, 0.5, 0.75, 1]" :key="`g-${v}`">
      <line class="fx-grid" :x1="P1.x0" :x2="P1.x1" :y1="g(v)" :y2="g(v)" />
      <text class="fx-tick" :x="P1.x0 - 6" :y="g(v) + 3" text-anchor="end">{{ v }}</text>
    </g>
    <line class="fx-grid fx-grid--dashed" :x1="s1(0.5)" :x2="s1(0.5)" :y1="TOP" :y2="BOT" />
    <line class="fx-axis" :x1="P1.x0" :x2="P1.x0" :y1="TOP" :y2="BOT" />
    <line class="fx-axis" :x1="P1.x0" :x2="P1.x1" :y1="BOT" :y2="BOT" />
    <text class="fx-tick" :x="P1.x0" :y="BOT + 14" text-anchor="middle">0</text>
    <text class="fx-tick" :x="s1(0.5)" :y="BOT + 14" text-anchor="middle">0.5</text>
    <text class="fx-tick" :x="P1.x1" :y="BOT + 14" text-anchor="middle">1</text>
    <text class="fx-axis-label" :x="P1.x1" :y="BOT + 30" text-anchor="end">{{ label('progress') }}</text>
    <path
      v-for="c in fades"
      :key="`f-${c.key}`"
      :class="['fx-curve', `fx-curve--${c.series}`]"
      :d="c.d"
    />
    <circle
      v-for="c in fades"
      :key="`m-${c.key}`"
      :class="'fx-dot'"
      :style="{ fill: `var(--fx-${c.series})` }"
      :cx="s1(0.5)"
      :cy="c.midY"
      r="3"
    />

    <!-- Right: what a crossfade pair sums to -->
    <text class="fx-axis-label" :x="P2.x0" y="22">{{ label('sums') }}</text>
    <g v-for="v in [-3, 0, 3]" :key="`d-${v}`">
      <line
        :class="v === 0 ? 'fx-grid fx-grid--strong' : 'fx-grid fx-grid--dashed'"
        :x1="P2.x0"
        :x2="P2.x1"
        :y1="d(v)"
        :y2="d(v)"
      />
      <text class="fx-tick" :x="P2.x0 - 6" :y="d(v) + 3" text-anchor="end">
        {{ v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0' }}
      </text>
    </g>
    <text class="fx-tick" :x="P2.x0 - 6" :y="TOP - 6" text-anchor="end">dB</text>
    <line class="fx-axis" :x1="P2.x0" :x2="P2.x0" :y1="TOP" :y2="BOT" />
    <line class="fx-axis" :x1="P2.x0" :x2="P2.x1" :y1="BOT" :y2="BOT" />
    <text class="fx-tick" :x="P2.x0" :y="BOT + 14" text-anchor="middle">0</text>
    <text class="fx-tick" :x="s2(0.5)" :y="BOT + 14" text-anchor="middle">0.5</text>
    <text class="fx-tick" :x="P2.x1" :y="BOT + 14" text-anchor="middle">1</text>
    <text class="fx-axis-label" :x="P2.x1" :y="BOT + 30" text-anchor="end">{{ label('progress') }}</text>
    <path
      v-for="s in sums"
      :key="`s-${s.key}`"
      :class="['fx-curve', `fx-curve--${s.series}`, s.dashed ? 'fx-curve--dashed fx-curve--thin' : '']"
      :d="s.d"
    />
    <text class="fx-value" :class="`fx-value--${peak.series}`" :x="s2(0.5)" :y="d(peak.mid) - 7" text-anchor="middle">
      {{ fmtDb(peak.mid) }}
    </text>
    <text class="fx-value" :class="`fx-value--${dip.series}`" :x="s2(0.5)" :y="d(dip.mid) + 15" text-anchor="middle">
      {{ fmtDb(dip.mid) }}
    </text>

    <!-- Line-style key: solid = correlated, dashed = uncorrelated -->
    <line class="fx-curve fx-curve--thin" :style="KEY_STROKE" :x1="P2.x0 + 8" :x2="P2.x0 + 28" y1="36" y2="36" />
    <text class="fx-note" :x="P2.x0 + 32" y="40">{{ label('correlated') }}</text>
    <line
      class="fx-curve fx-curve--thin fx-curve--dashed"
      :style="KEY_STROKE"
      :x1="P2.x0 + 118"
      :x2="P2.x0 + 138"
      y1="36"
      y2="36"
    />
    <text class="fx-note" :x="P2.x0 + 142" y="40">{{ label('uncorrelated') }}</text>
  </FigureFrame>
</template>
