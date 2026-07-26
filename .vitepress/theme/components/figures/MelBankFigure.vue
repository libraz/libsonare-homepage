<script setup lang="ts">
/**
 * The mel filterbank, and the warp that produces it.
 *
 * Top: triangular filters over a linear hertz axis — narrow and tightly packed
 * at the bottom, wide and sparse at the top. Bottom: the same filter centres on
 * a mel axis, where they are evenly spaced. The leader lines between the two
 * axes *are* the warp: mel spacing is what turns into uneven hertz spacing, and
 * that is why a mel spectrogram spends its resolution where hearing does.
 */
import { computed } from 'vue';
import FigureFrame, { type FigureLegendItem } from './FigureFrame.vue';
import { hzToMel, linScale, melTriangles } from './figureMath';

const props = withDefaults(
  defineProps<{
    title?: string;
    caption?: string;
    /** Filters drawn. The runtime default is far higher; this is for legibility. */
    filters?: number;
    fmin?: number;
    fmax?: number;
    labels?: Partial<Record<Key, string>>;
  }>(),
  { filters: 14, fmin: 0, fmax: 8000 },
);

type Key = 'axisHz' | 'axisMel' | 'filters' | 'narrow' | 'wide' | 'even' | 'drawn';

const DEFAULTS: Record<Key, string> = {
  axisHz: 'frequency (Hz, linear)',
  axisMel: 'the same centres on the mel scale',
  filters: 'triangular mel filters',
  narrow: 'narrow, closely spaced',
  wide: 'wide, far apart',
  even: 'evenly spaced',
  drawn: 'filters drawn',
};

const label = (key: Key) => props.labels?.[key] ?? DEFAULTS[key];

const legend = computed<FigureLegendItem[]>(() => [
  { series: 1, shape: 'block', label: label('filters') },
  { series: 2, label: label('even') },
]);

const X0 = 66;
const X1 = 606;
const TOP = 46;
const BASE = 182;
const MEL_TOP = 246;
const MEL_BOT = 268;
const WARP_TOP = 216;

const x = computed(() => linScale(props.fmin, props.fmax, X0, X1));
const xm = computed(() => linScale(hzToMel(props.fmin), hzToMel(props.fmax), X0, X1));

const geom = computed(() => {
  const tri = melTriangles(props.filters, props.fmin, props.fmax);
  const sx = x.value;
  const sm = xm.value;
  return {
    triangles: tri.map((f, i) => ({
      points: `${sx(f.lo)},${BASE} ${sx(f.center)},${TOP} ${sx(f.hi)},${BASE}`,
      alt: i % 2 === 1,
    })),
    centres: tri.map((f) => ({ hz: sx(f.center), mel: sm(hzToMel(f.center)) })),
  };
});

const hzTicks = computed(() => {
  const step = props.fmax / 8;
  return Array.from({ length: 9 }, (_, i) => Math.round(i * step));
});
</script>

<template>
  <FigureFrame
    :title="props.title"
    :caption="props.caption"
    view-box="0 0 640 300"
    :width="640"
    :legend="legend"
  >
    <!-- Filters -->
    <polygon
      v-for="(f, i) in geom.triangles"
      :key="`tri-${i}`"
      :class="f.alt ? 'fx-block fx-block--2' : 'fx-block'"
      :points="f.points"
    />

    <!-- Hz axis -->
    <line class="fx-axis" :x1="X0" :x2="X1" :y1="BASE" :y2="BASE" />
    <g v-for="hz in hzTicks" :key="`hz-${hz}`">
      <line class="fx-axis" :x1="x(hz)" :x2="x(hz)" :y1="BASE" :y2="BASE + 4" />
      <text class="fx-tick" :x="x(hz)" :y="BASE + 15" text-anchor="middle">{{ hz }}</text>
    </g>
    <text class="fx-axis-label" :x="X1" :y="BASE + 28" text-anchor="end">{{ label('axisHz') }}</text>

    <!-- Reading the shape -->
    <text class="fx-note" :x="X0 + 8" :y="TOP - 12">{{ label('narrow') }}</text>
    <text class="fx-note" :x="X1 - 4" :y="TOP - 12" text-anchor="end">{{ label('wide') }}</text>

    <!-- The warp: same centres, evenly spaced on the mel axis -->
    <path
      v-for="(c, i) in geom.centres"
      :key="`warp-${i}`"
      class="fx-leader"
      :d="`M ${c.hz} ${WARP_TOP} L ${c.mel} ${MEL_TOP}`"
    />
    <line class="fx-axis" :x1="X0" :x2="X1" :y1="MEL_BOT" :y2="MEL_BOT" />
    <line
      v-for="(c, i) in geom.centres"
      :key="`mel-${i}`"
      class="fx-curve fx-curve--2 fx-curve--thin"
      :x1="c.mel"
      :x2="c.mel"
      :y1="MEL_TOP"
      :y2="MEL_BOT"
    />

    <text class="fx-axis-label" :x="X0" :y="MEL_BOT + 18">{{ label('axisMel') }}</text>
    <text class="fx-axis-label" :x="X1" :y="MEL_BOT + 18" text-anchor="end">
      {{ props.filters }} {{ label('drawn') }}
    </text>
  </FigureFrame>
</template>
