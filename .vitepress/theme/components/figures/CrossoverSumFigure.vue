<script setup lang="ts">
/**
 * What the low and high band add back to around one cutoff, per crossover mode.
 *
 * Each curve is |LP(jω) ± HP(jω)| of the analog prototype with HP(s) = LP(1/s):
 * Butterworth and Bessel are −3 dB-normalized, Linkwitz-Riley is a squared
 * Butterworth, and the linear-phase FIR reconstructs the input exactly. The
 * engine inverts the high band of a Butterworth or Bessel pair that is out of
 * phase at its cutoff, so the sign is picked from the phase at ω = 1. The
 * curves match `multiband.compressor` at ratio 1 to within 0.1 dB near the cutoff.
 */
import { computed } from 'vue';
import FigureFrame, { type FigureLegendItem } from './FigureFrame.vue';
import { linScale, logScale, type Pt, path } from './figureMath';

const props = defineProps<{
  title?: string;
  caption?: string;
  labels?: Partial<Record<Key, string>>;
}>();

type Key = 'lr' | 'fir' | 'bw4' | 'bw2' | 'bessel4' | 'cutoff' | 'sum' | 'frequency';

const DEFAULTS: Record<Key, string> = {
  lr: 'linkwitzRiley lr4',
  fir: 'firLinearPhase',
  bw4: 'butterworth lr4',
  bw2: 'butterworth lr2',
  bessel4: 'bessel lr4',
  cutoff: 'cutoff',
  sum: 'summed bands',
  frequency: 'frequency / cutoff',
};

const label = (key: Key) => props.labels?.[key] ?? DEFAULTS[key];

// --- Complex arithmetic on [re, im] pairs -------------------------------
type Cx = [number, number];
const cadd = (a: Cx, b: Cx): Cx => [a[0] + b[0], a[1] + b[1]];
const cmul = (a: Cx, b: Cx): Cx => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const cdiv = (a: Cx, b: Cx): Cx => {
  const d = b[0] * b[0] + b[1] * b[1];
  return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d];
};
const cabs = (a: Cx) => Math.hypot(a[0], a[1]);
/** Polynomial with coefficients highest power first, evaluated at s. */
const polyval = (c: number[], s: Cx): Cx =>
  c.reduce<Cx>((acc, k) => cadd(cmul(acc, s), [k, 0]), [0, 0]);
const polymul = (a: number[], b: number[]) => {
  const out = new Array(a.length + b.length - 1).fill(0);
  a.forEach((x, i) => b.forEach((y, j) => (out[i + j] += x * y)));
  return out;
};

type Lowpass = (s: Cx) => Cx;
const allPole =
  (c: number[], wScale = 1): Lowpass =>
  (s) =>
    cdiv([c[c.length - 1], 0], polyval(c, cmul(s, [wScale, 0])));

const B2 = [1, Math.SQRT2, 1];
const B4 = polymul([1, 2 * Math.sin(Math.PI / 8), 1], [1, 2 * Math.sin((3 * Math.PI) / 8), 1]);
const BESSEL4 = [1, 10, 45, 105, 105];

/** Frequency scale that puts an all-pole low-pass at −3 dB at ω = 1. */
function minus3dbScale(c: number[]): number {
  const mag = (w: number) => cabs(allPole(c)([0, w]));
  let lo = 1e-3;
  let hi = 1e3;
  for (let i = 0; i < 80; i++) {
    const m = Math.sqrt(lo * hi);
    if (mag(m) > Math.SQRT1_2) lo = m;
    else hi = m;
  }
  return lo;
}

const hp = (lp: Lowpass, s: Cx) => lp(cdiv([1, 0], s));

const crossoverSum = (lp: Lowpass) => {
  // Re(LP · conj(HP)) < 0 at the cutoff means the bands are more than 90° apart.
  const l1 = lp([0, 1]);
  const h1 = hp(lp, [0, 1]);
  const sign = l1[0] * h1[0] + l1[1] * h1[1] < 0 ? -1 : 1;
  return (w: number) => {
    const s: Cx = [0, w];
    const h = hp(lp, s);
    return 20 * Math.log10(cabs(cadd(lp(s), [sign * h[0], sign * h[1]])));
  };
};

const MODES = {
  lr: crossoverSum(allPole(polymul(B2, B2))),
  fir: () => 0,
  bw4: crossoverSum(allPole(B4)),
  bw2: crossoverSum(allPole(B2)),
  bessel4: crossoverSum(allPole(BESSEL4, minus3dbScale(BESSEL4))),
};

const SERIES: { key: keyof typeof MODES; series: 1 | 2 | 3 | 4 | 5; dashed?: boolean }[] = [
  { key: 'lr', series: 1 },
  { key: 'fir', series: 2, dashed: true },
  { key: 'bw4', series: 3 },
  { key: 'bessel4', series: 4 },
  { key: 'bw2', series: 5 },
];

const X0 = 64;
const X1 = 560;
const Y0 = 36;
const Y1 = 214;
const DB_TOP = 4.5;
const DB_BOT = -1.5;
const W_MIN = 1 / 8;
const W_MAX = 8;

const x = logScale(W_MIN, W_MAX, X0, X1);
const y = linScale(DB_BOT, DB_TOP, Y1, Y0);
const DB_TICKS = [4, 3, 2, 1, 0, -1];
const W_TICKS = [
  { w: 1 / 8, t: '1/8' },
  { w: 1 / 4, t: '1/4' },
  { w: 1 / 2, t: '1/2' },
  { w: 1, t: '1' },
  { w: 2, t: '2' },
  { w: 4, t: '4' },
  { w: 8, t: '8' },
];

const fmtDb = (db: number) =>
  `${db > 0.05 ? '+' : db < -0.05 ? '−' : ''}${Math.abs(db).toFixed(1)} dB`;

const legend = computed<FigureLegendItem[]>(() =>
  SERIES.map((s) => ({ series: s.series, label: label(s.key) })),
);

const curves = computed(() =>
  SERIES.map((s) => {
    const fn = MODES[s.key];
    const pts: Pt[] = [];
    const n = 400;
    for (let i = 0; i <= n; i++) {
      const w = W_MIN * (W_MAX / W_MIN) ** (i / n);
      pts.push([x(w), y(fn(w))]);
    }
    return { ...s, d: path(pts), atCutoff: fn(1) };
  }),
);

const cutoffValues = computed(() => {
  const at = (key: keyof typeof MODES) => curves.value.find((c) => c.key === key)?.atCutoff ?? 0;
  return {
    bw4: at('bw4'),
    bessel4: at('bessel4'),
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
    <defs>
      <clipPath id="fx-xover-plot">
        <rect :x="X0" :y="Y0" :width="X1 - X0" :height="Y1 - Y0" />
      </clipPath>
    </defs>

    <text class="fx-axis-label" :x="X0" y="24">{{ label('sum') }}</text>

    <g v-for="db in DB_TICKS" :key="`db-${db}`">
      <line
        :class="db === 0 ? 'fx-grid fx-grid--strong' : 'fx-grid'"
        :x1="X0"
        :x2="X1"
        :y1="y(db)"
        :y2="y(db)"
      />
      <text class="fx-tick" :x="X0 - 6" :y="y(db) + 3" text-anchor="end">
        {{ db > 0 ? `+${db}` : db === 0 ? '0' : `−${-db}` }}
      </text>
    </g>
    <g v-for="t in W_TICKS" :key="`w-${t.t}`">
      <line class="fx-grid" :x1="x(t.w)" :x2="x(t.w)" :y1="Y0" :y2="Y1" />
      <text class="fx-tick" :x="x(t.w)" :y="Y1 + 14" text-anchor="middle">{{ t.t }}</text>
    </g>
    <text class="fx-axis-label" :x="X1" :y="Y1 + 30" text-anchor="end">{{ label('frequency') }}</text>
    <text class="fx-tick" :x="X0 - 6" :y="Y0 - 8" text-anchor="end">dB</text>
    <line class="fx-axis" :x1="X0" :x2="X0" :y1="Y0" :y2="Y1" />
    <line class="fx-axis" :x1="X0" :x2="X1" :y1="Y1" :y2="Y1" />

    <!-- Cutoff -->
    <line class="fx-guide fx-guide--neutral" :x1="x(1)" :x2="x(1)" :y1="Y0" :y2="Y1" />

    <g clip-path="url(#fx-xover-plot)">
      <path
        v-for="c in curves"
        :key="`c-${c.key}`"
        :class="[
          'fx-curve',
          `fx-curve--${c.series}`,
          c.dashed ? 'fx-curve--dashed' : '',
          c.key === 'bw2' || c.dashed ? 'fx-curve--thin' : '',
        ]"
        :d="c.d"
      />
    </g>

    <!-- Values at the cutoff -->
    <text class="fx-value fx-value--3" :x="x(1)" :y="y(cutoffValues.bw4) - 6" text-anchor="middle">
      {{ fmtDb(cutoffValues.bw4) }}
    </text>
    <text class="fx-value fx-value--4" :x="x(1)" :y="y(0.45)" text-anchor="middle">
      {{ fmtDb(cutoffValues.bessel4) }}
    </text>
    <text class="fx-value fx-value--1" :x="X1 + 6" :y="y(0) + 3">0 dB</text>
    <text class="fx-note" :x="x(1)" :y="Y0 - 6" text-anchor="middle">{{ label('cutoff') }}</text>
  </FigureFrame>
</template>
