<script setup lang="ts">
/**
 * The 50 ms / 80 ms split on a squared impulse response.
 *
 * C50, C80, and D50 are all the same operation — integrate the energy either
 * side of a time boundary — so the one thing worth drawing is where those
 * boundaries fall relative to the direct sound, the discrete early reflections,
 * and the diffuse tail. The shaded zones are the integrals the formulas divide.
 */
import { computed } from 'vue';
import FigureFrame, { type FigureLegendItem } from './FigureFrame.vue';
import { areaPath, impulseEnergy, linScale, path, sample } from './figureMath';

const props = defineProps<{
  title?: string;
  caption?: string;
  labels?: Partial<Record<Key, string>>;
}>();

type Key =
  | 'axisTime'
  | 'axisEnergy'
  | 'early'
  | 'extra'
  | 'late'
  | 'direct'
  | 'reflections'
  | 'tail'
  | 'truncation'
  | 'bound50'
  | 'bound80';

const DEFAULTS: Record<Key, string> = {
  axisTime: 'time after the direct sound (ms)',
  axisEnergy: 'energy',
  early: 'early 0–50 ms',
  extra: '+30 ms for C80',
  late: 'late',
  direct: 'direct sound',
  reflections: 'discrete early reflections',
  tail: 'diffuse tail',
  truncation: 'noise-floor truncation',
  bound50: '50 ms',
  bound80: '80 ms',
};

const label = (key: Key) => props.labels?.[key] ?? DEFAULTS[key];

const legend = computed<FigureLegendItem[]>(() => [
  { series: 4, shape: 'block', label: label('early') },
  { series: 2, shape: 'block', label: label('extra') },
  { series: 0, shape: 'block', label: label('late') },
]);

const X0 = 66;
const X1 = 606;
const Y0 = 34;
const Y1 = 222;
const T_MAX = 0.2;
const TRUNC = 0.185;

const x = linScale(0, T_MAX, X0, X1);
const y = linScale(0, 1, Y1, Y0);
const ir = impulseEnergy(1.1);

/** Filled area under the response between two times. */
function zone(a: number, b: number): string {
  const pts = sample(a, b, Math.max(24, Math.round((b - a) * 1400)), (s) => y(ir(s)));
  return areaPath(
    pts.map(([s, py]) => [x(s), py]),
    Y1,
  );
}

const geom = computed(() => ({
  early: zone(0, 0.05),
  extra: zone(0.05, 0.08),
  late: zone(0.08, T_MAX),
  outline: path(sample(0, T_MAX, 420, (s) => y(ir(s))).map(([s, py]) => [x(s), py])),
}));

const msTicks = [0, 50, 100, 150, 200];
</script>

<template>
  <FigureFrame
    :title="props.title"
    :caption="props.caption"
    view-box="0 0 640 300"
    :width="640"
    :legend="legend"
  >
    <path class="fx-area fx-area--4" :d="geom.early" />
    <path class="fx-area fx-area--2" :d="geom.extra" />
    <path class="fx-area fx-area--faint" :d="geom.late" />
    <path class="fx-curve fx-curve--thin" :d="geom.outline" />

    <!-- Boundaries -->
    <line class="fx-guide fx-guide--strong" :x1="x(0.05)" :x2="x(0.05)" :y1="Y0 - 6" :y2="Y1" />
    <text class="fx-value fx-value--3" :x="x(0.05)" :y="Y0 - 12" text-anchor="middle">
      {{ label('bound50') }}
    </text>
    <line class="fx-guide" :x1="x(0.08)" :x2="x(0.08)" :y1="Y0 - 6" :y2="Y1" />
    <text class="fx-value fx-value--3" :x="x(0.08)" :y="Y0 - 12" text-anchor="middle">
      {{ label('bound80') }}
    </text>

    <!-- Where integration stops -->
    <line class="fx-guide fx-guide--neutral" :x1="x(TRUNC)" :x2="x(TRUNC)" :y1="Y0" :y2="Y1" />
    <text
      class="fx-axis-label"
      :x="x(TRUNC) - 6"
      :y="Y1 - 8"
      :transform="`rotate(-90 ${x(TRUNC) - 6} ${Y1 - 8})`"
    >
      {{ label('truncation') }}
    </text>

    <!-- Axes -->
    <line class="fx-axis" :x1="X0" :x2="X0" :y1="Y0 - 6" :y2="Y1" />
    <line class="fx-axis" :x1="X0" :x2="X1" :y1="Y1" :y2="Y1" />
    <g v-for="ms in msTicks" :key="`ms-${ms}`">
      <line class="fx-axis" :x1="x(ms / 1000)" :x2="x(ms / 1000)" :y1="Y1" :y2="Y1 + 4" />
      <text class="fx-tick" :x="x(ms / 1000)" :y="Y1 + 15" text-anchor="middle">{{ ms }}</text>
    </g>
    <text class="fx-axis-label" :x="X1" :y="Y1 + 60" text-anchor="end">{{ label('axisTime') }}</text>
    <text
      class="fx-axis-label"
      :x="20"
      :y="(Y0 + Y1) / 2"
      text-anchor="middle"
      :transform="`rotate(-90 20 ${(Y0 + Y1) / 2})`"
    >
      {{ label('axisEnergy') }}
    </text>

    <!-- Zone names, aligned under the region each formula integrates -->
    <text class="fx-axis-label" :x="(X0 + x(0.05)) / 2" :y="Y1 + 34" text-anchor="middle">
      {{ label('early') }}
    </text>
    <text class="fx-axis-label" :x="(x(0.05) + x(0.08)) / 2" :y="Y1 + 46" text-anchor="middle">
      {{ label('extra') }}
    </text>
    <text class="fx-axis-label" :x="(x(0.08) + X1) / 2" :y="Y1 + 34" text-anchor="middle">
      {{ label('late') }}
    </text>

    <!-- Callouts -->
    <text class="fx-note" :x="X0 + 22" :y="Y0 + 10">{{ label('direct') }}</text>
    <path class="fx-leader" :d="`M ${X0 + 18} ${Y0 + 7} L ${X0 + 4} ${Y0 + 2}`" />
    <text class="fx-note" :x="x(0.048)" :y="y(0.88)" text-anchor="end">
      {{ label('reflections') }}
    </text>
    <path class="fx-leader" :d="`M ${x(0.041)} ${y(0.86)} L ${x(0.027)} ${y(0.55)}`" />
    <text class="fx-note" :x="x(0.126)" :y="y(0.3)">{{ label('tail') }}</text>
    <path class="fx-leader" :d="`M ${x(0.128)} ${y(0.27)} L ${x(0.132)} ${y(0.15)}`" />
  </FigureFrame>
</template>
