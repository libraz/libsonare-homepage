<script setup lang="ts">
/**
 * How blind estimation gets a decay out of ordinary music.
 *
 * Top panel: the program envelope. It sits near its own level almost
 * everywhere, and only in the gaps — note releases, rests, transient
 * shadows — does the room's tail become audible on its own.
 * Bottom panel: those exposed fragments, replotted against decay time and
 * fitted into one slope. Each fragment covers a different, partial dB range
 * and disagrees slightly with the others, which is exactly what the
 * confidence score reports on.
 */
import { computed } from 'vue';
import FigureFrame, { type FigureLegendItem } from './FigureFrame.vue';
import { areaPath, linScale, path, sample, wobble } from './figureMath';

const props = defineProps<{
  title?: string;
  caption?: string;
  labels?: Partial<Record<Key, string>>;
}>();

type Key =
  | 'panelProgram'
  | 'panelDecay'
  | 'axisRecording'
  | 'axisDecay'
  | 'axisLevel'
  | 'program'
  | 'exposed'
  | 'fit'
  | 'gapTag'
  | 'lands';

const DEFAULTS: Record<Key, string> = {
  panelProgram: 'the recording',
  panelDecay: 'the recovered decay',
  axisRecording: 'time in the recording (s)',
  axisDecay: 'decay time (s)',
  axisLevel: 'level (dB)',
  program: 'program envelope',
  exposed: 'tail exposed in a gap',
  fit: 'stitched decay estimate',
  gapTag: 'gap',
  lands: '→ −60 dB',
};

const label = (key: Key) => props.labels?.[key] ?? DEFAULTS[key];

const legend = computed<FigureLegendItem[]>(() => [
  { series: 0, shape: 'block', label: label('program') },
  { series: 3, label: label('exposed') },
  { series: 1, shape: 'dashed', label: label('fit') },
]);

const X0 = 66;
const X1 = 606;
// Top panel: the program over 6 s of music.
const YA0 = 40;
const YA1 = 150;
// Bottom panel: the same fragments against decay time.
const YB0 = 222;
const YB1 = 332;
const DB_MIN = -60;

const GAPS = [
  { start: 1.35, end: 1.95 },
  { start: 3.25, end: 3.85 },
  { start: 5.05, end: 5.65 },
];

/**
 * Each gap exposes a different, partial slice of the decay — a later gap
 * catches the tail already lower down, and none of them agrees exactly with
 * the others. The fit has to reconcile them.
 */
const FRAGMENTS = [
  { t0: 0.0, db0: 0, t1: 0.35, db1: -15.4 },
  { t0: 0.18, db0: -5, t1: 0.58, db1: -19.8 },
  { t0: 0.34, db0: -15, t1: 0.78, db1: -32.5 },
];

const FIT_SLOPE = -41; // dB per second through the fragments

const xa = linScale(0, 6, X0, X1);
const ya = linScale(0, DB_MIN, YA0, YA1);
const xb = linScale(0, 1.6, X0, X1);
const yb = linScale(0, DB_MIN, YB0, YB1);

/** Program level in dB: a busy bed that falls away inside each gap. */
function programDb(s: number): number {
  const gap = GAPS.find((g) => s >= g.start && s <= g.end);
  if (gap) return Math.max(-46, -6 - 42 * (s - gap.start));
  return -6 + 2.6 * wobble(s * 1.7, 1.1);
}

const geom = computed(() => {
  const pts = sample(0, 6, 480, (s) => ya(programDb(s))).map(
    ([s, py]) => [xa(s), py] as [number, number],
  );
  const fitEnd = DB_MIN / FIT_SLOPE;
  return {
    programArea: areaPath(pts, YA1),
    programLine: path(pts),
    gaps: GAPS.map((g, i) => ({
      x: xa(g.start),
      w: xa(g.end) - xa(g.start),
      tag: `${label('gapTag')} ${i + 1}`,
      exposed: path([
        [xa(g.start), ya(-6)],
        [xa(g.end), ya(programDb(g.end))],
      ]),
    })),
    fragments: FRAGMENTS.map((f, i) => ({
      d: path([
        [xb(f.t0), yb(f.db0)],
        [xb(f.t1), yb(f.db1)],
      ]),
      x0: xb(f.t0),
      y0: yb(f.db0),
      x1: xb(f.t1),
      y1: yb(f.db1),
      tag: `${label('gapTag')} ${i + 1}`,
    })),
    fit: path([
      [xb(0), yb(0)],
      [xb(fitEnd), yb(DB_MIN)],
    ]),
    fitEndX: xb(fitEnd),
  };
});

const dbTicks = [0, -20, -40, -60];
const recTicks = [0, 1, 2, 3, 4, 5, 6];
const decayTicks = [0, 0.4, 0.8, 1.2, 1.6];
</script>

<template>
  <FigureFrame
    :title="props.title"
    :caption="props.caption"
    view-box="0 0 640 380"
    :width="640"
    :legend="legend"
  >
    <!-- ===== Top panel: the recording ===== -->
    <text class="fx-axis-label" :x="X0" :y="YA0 - 12">{{ label('panelProgram') }}</text>

    <g v-for="(g, i) in geom.gaps" :key="`gap-${i}`">
      <rect class="fx-block fx-block--3" :x="g.x" :y="YA0" :width="g.w" :height="YA1 - YA0" />
      <text class="fx-axis-label" :x="g.x + g.w / 2" :y="YA0 - 3" text-anchor="middle">
        {{ g.tag }}
      </text>
    </g>

    <path class="fx-area fx-area--faint" :d="geom.programArea" />
    <path class="fx-curve fx-curve--ghost" :d="geom.programLine" />
    <path
      v-for="(g, i) in geom.gaps"
      :key="`exp-${i}`"
      class="fx-curve fx-curve--3 fx-curve--thin"
      :d="g.exposed"
    />

    <g v-for="db in dbTicks" :key="`a-${db}`">
      <line class="fx-grid fx-grid--dashed" :x1="X0" :x2="X1" :y1="ya(db)" :y2="ya(db)" />
      <text class="fx-tick" :x="X0 - 8" :y="ya(db)" text-anchor="end" dy="0.34em">{{ db }}</text>
    </g>
    <line class="fx-axis" :x1="X0" :x2="X0" :y1="YA0" :y2="YA1" />
    <line class="fx-axis" :x1="X0" :x2="X1" :y1="YA1" :y2="YA1" />
    <g v-for="tick in recTicks" :key="`ra-${tick}`">
      <line class="fx-axis" :x1="xa(tick)" :x2="xa(tick)" :y1="YA1" :y2="YA1 + 4" />
      <text class="fx-tick" :x="xa(tick)" :y="YA1 + 15" text-anchor="middle">{{ tick }}</text>
    </g>
    <text class="fx-axis-label" :x="X1" :y="YA1 + 30" text-anchor="end">
      {{ label('axisRecording') }}
    </text>

    <!-- ===== Bottom panel: the recovered decay ===== -->
    <text class="fx-axis-label" :x="X0" :y="YB0 - 12">{{ label('panelDecay') }}</text>

    <g v-for="db in dbTicks" :key="`b-${db}`">
      <line
        :class="db === DB_MIN ? 'fx-guide' : 'fx-grid fx-grid--dashed'"
        :x1="X0"
        :x2="X1"
        :y1="yb(db)"
        :y2="yb(db)"
      />
      <text class="fx-tick" :x="X0 - 8" :y="yb(db)" text-anchor="end" dy="0.34em">{{ db }}</text>
    </g>

    <path class="fx-curve fx-curve--thin fx-curve--dashed" :d="geom.fit" />

    <g v-for="(f, i) in geom.fragments" :key="`frag-${i}`">
      <path class="fx-curve fx-curve--3" :d="f.d" />
      <circle class="fx-dot fx-dot--3" :cx="f.x0" :cy="f.y0" r="2.8" />
      <circle class="fx-dot fx-dot--3" :cx="f.x1" :cy="f.y1" r="2.8" />
      <text class="fx-axis-label" :x="f.x1 + 8" :y="f.y1 + 12">{{ f.tag }}</text>
    </g>

    <circle class="fx-dot" :cx="geom.fitEndX" :cy="yb(DB_MIN)" r="3.4" />
    <text class="fx-value fx-value--1" :x="geom.fitEndX + 7" :y="yb(DB_MIN) - 6">
      {{ label('lands') }}
    </text>

    <line class="fx-axis" :x1="X0" :x2="X0" :y1="YB0" :y2="YB1" />
    <line class="fx-axis" :x1="X0" :x2="X1" :y1="YB1" :y2="YB1" />
    <g v-for="tick in decayTicks" :key="`rb-${tick}`">
      <line class="fx-axis" :x1="xb(tick)" :x2="xb(tick)" :y1="YB1" :y2="YB1 + 4" />
      <text class="fx-tick" :x="xb(tick)" :y="YB1 + 15" text-anchor="middle">{{ tick }}</text>
    </g>
    <text class="fx-axis-label" :x="X1" :y="YB1 + 30" text-anchor="end">{{ label('axisDecay') }}</text>

    <text
      class="fx-axis-label"
      :x="20"
      :y="(YA0 + YB1) / 2"
      text-anchor="middle"
      :transform="`rotate(-90 20 ${(YA0 + YB1) / 2})`"
    >
      {{ label('axisLevel') }}
    </text>
  </FigureFrame>
</template>
