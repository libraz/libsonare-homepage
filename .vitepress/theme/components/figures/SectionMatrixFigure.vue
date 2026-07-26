<script setup lang="ts">
/**
 * How repetition becomes a section list.
 *
 * Left: a self-similarity matrix — every frame compared with every other frame.
 * Repeats of the same section light up as off-diagonal blocks, which is the
 * signal that the analysis is actually looking for. Right: the novelty curve
 * derived from that matrix, whose peaks are the boundaries, and the section
 * labels those boundaries produce. Reading the three together explains why a
 * track with literal repeats segments cleanly and a through-composed one does not.
 */
import { computed } from 'vue';
import FigureFrame, { type FigureLegendItem } from './FigureFrame.vue';
import { linScale, noveltyCurve, path, similarityMatrix } from './figureMath';

const props = withDefaults(
  defineProps<{
    title?: string;
    caption?: string;
    /** Section boundaries as fractions of the track, with a repeat id. */
    sections?: { end: number; id: number; label: string }[];
    labels?: Partial<Record<Key, string>>;
  }>(),
  {
    sections: () => [
      { end: 0.14, id: 0, label: 'intro' },
      { end: 0.36, id: 1, label: 'A' },
      { end: 0.54, id: 2, label: 'B' },
      { end: 0.76, id: 1, label: 'A' },
      { end: 0.92, id: 3, label: 'C' },
      { end: 1, id: 1, label: 'A' },
    ],
  },
);

type Key = 'matrix' | 'novelty' | 'sectionsLane' | 'similar' | 'boundary' | 'axisTime' | 'repeats';

const DEFAULTS: Record<Key, string> = {
  matrix: 'self-similarity matrix',
  novelty: 'novelty',
  sectionsLane: 'detected sections',
  similar: 'frames that sound alike',
  boundary: 'boundary',
  axisTime: 'time →',
  repeats: 'a repeat, off the diagonal',
};

const label = (key: Key) => props.labels?.[key] ?? DEFAULTS[key];

const legend = computed<FigureLegendItem[]>(() => [
  { series: 1, shape: 'block', label: label('similar') },
  { series: 3, label: label('novelty') },
  { series: 2, shape: 'dashed', label: label('boundary') },
]);

const SIZE = 36;
const MX = 70;
const MY = 46;
const M_SPAN = 168;
const CELL = M_SPAN / SIZE;

const PX0 = 292;
const PX1 = 604;
const NOV_TOP = 46;
const NOV_BOT = 138;
const LANE_TOP = 178;
const LANE_BOT = 214;

const grid = computed(() => similarityMatrix(SIZE, props.sections));
const novelty = computed(() => noveltyCurve(grid.value));

const nx = linScale(0, 1, PX0, PX1);
const ny = linScale(0, 1, NOV_BOT, NOV_TOP);

const geom = computed(() => {
  const nv = novelty.value;
  const pts = nv.map((v, i) => [nx(i / (nv.length - 1)), ny(v)] as [number, number]);
  const bounds = props.sections.slice(0, -1).map((s) => s.end);
  let from = 0;
  const lanes = props.sections.map((s) => {
    const seg = { x: nx(from), w: nx(s.end) - nx(from), label: s.label, id: s.id };
    from = s.end;
    return seg;
  });
  return { novelty: path(pts), bounds, lanes };
});

/** Similarity 0-1 → opacity, so one class can render the whole grid. */
const cellOpacity = (v: number) => (v < 0.28 ? 0 : Math.min(0.92, (v - 0.28) * 1.5));
</script>

<template>
  <FigureFrame
    :title="props.title"
    :caption="props.caption"
    view-box="0 0 640 268"
    :width="640"
    :legend="legend"
  >
    <!-- ===== Matrix ===== -->
    <text class="fx-axis-label" :x="MX" :y="MY - 12">{{ label('matrix') }}</text>
    <rect class="fx-lane" :x="MX" :y="MY" :width="M_SPAN" :height="M_SPAN" />
    <template v-for="(row, ry) in grid" :key="`row-${ry}`">
      <rect
        v-for="(v, rx) in row"
        :key="`c-${ry}-${rx}`"
        class="fx-cell"
        :x="MX + rx * CELL"
        :y="MY + ry * CELL"
        :width="CELL + 0.4"
        :height="CELL + 0.4"
        :opacity="cellOpacity(v)"
      />
    </template>
    <rect class="fx-block fx-block--outline" :x="MX" :y="MY" :width="M_SPAN" :height="M_SPAN" />
    <text class="fx-axis-label" :x="MX" :y="MY + M_SPAN + 16">{{ label('axisTime') }}</text>
    <text class="fx-note" :x="MX" :y="MY + M_SPAN + 38">{{ label('repeats') }}</text>

    <!-- ===== Novelty ===== -->
    <text class="fx-axis-label" :x="PX0" :y="NOV_TOP - 12">{{ label('novelty') }}</text>
    <line class="fx-axis" :x1="PX0" :x2="PX1" :y1="NOV_BOT" :y2="NOV_BOT" />
    <line
      v-for="(b, i) in geom.bounds"
      :key="`nb-${i}`"
      class="fx-curve fx-curve--2 fx-curve--thin fx-curve--dashed"
      :x1="nx(b)"
      :x2="nx(b)"
      :y1="NOV_TOP - 4"
      :y2="LANE_BOT"
    />
    <path class="fx-curve fx-curve--3 fx-curve--thin" :d="geom.novelty" />

    <!-- ===== Sections ===== -->
    <text class="fx-axis-label" :x="PX0" :y="LANE_TOP - 10">{{ label('sectionsLane') }}</text>
    <g v-for="(l, i) in geom.lanes" :key="`ln-${i}`">
      <rect
        :class="l.id === 1 ? 'fx-block' : 'fx-block fx-block--muted'"
        :x="l.x + 1"
        :y="LANE_TOP"
        :width="l.w - 2"
        :height="LANE_BOT - LANE_TOP"
        rx="2"
      />
      <text class="fx-value" :x="l.x + l.w / 2" :y="LANE_TOP + 22" text-anchor="middle">
        {{ l.label }}
      </text>
    </g>
    <text class="fx-axis-label" :x="PX0" :y="LANE_BOT + 18">{{ label('axisTime') }}</text>
  </FigureFrame>
</template>
