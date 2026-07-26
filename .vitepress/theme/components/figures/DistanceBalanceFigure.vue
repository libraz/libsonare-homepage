<script setup lang="ts">
/**
 * Why DRR reads as distance, and why the same DRR means different distances in
 * different rooms.
 *
 * The direct sound obeys the inverse-square law — 6 dB per doubling — while the
 * reverberant field is roughly the same everywhere in the room. DRR is the gap
 * between the two curves, and it hits 0 dB where they cross: the critical
 * distance. Treating the room lowers the reverberant line, which pushes that
 * crossing further out, so the same measured DRR maps to a larger distance.
 */
import { computed } from 'vue';
import FigureFrame, { type FigureLegendItem } from './FigureFrame.vue';
import { linScale, logScale, path } from './figureMath';

const props = defineProps<{
  title?: string;
  caption?: string;
  labels?: Partial<Record<Key, string>>;
}>();

type Key =
  | 'axisDistance'
  | 'axisLevel'
  | 'direct'
  | 'reverbLive'
  | 'reverbTreated'
  | 'drr'
  | 'critLive'
  | 'critTreated'
  | 'closer'
  | 'farther';

const DEFAULTS: Record<Key, string> = {
  axisDistance: 'distance from the source (m, log)',
  axisLevel: 'level (dB)',
  direct: 'direct sound — 6 dB per doubling',
  reverbLive: 'reverberant field — live room',
  reverbTreated: 'reverberant field — treated room',
  drr: 'DRR at that distance',
  critLive: 'dc — live room',
  critTreated: 'dc — treated room',
  closer: 'closer: direct wins, DRR rises',
  farther: 'farther: the room wins, DRR falls',
};

const label = (key: Key) => props.labels?.[key] ?? DEFAULTS[key];

const legend = computed<FigureLegendItem[]>(() => [
  { series: 1, label: label('direct') },
  { series: 2, label: label('reverbLive') },
  { series: 4, shape: 'dashed', label: label('reverbTreated') },
  { series: 3, label: label('drr') },
]);

const X0 = 70;
const X1 = 600;
const Y0 = 40;
const Y1 = 250;
const D_MIN = 0.25;
const D_MAX = 16;
const REF_M = 2; // distance at which the direct sound is 0 dB here
const REV_LIVE = -6;
const REV_TREATED = -14;

const x = logScale(D_MIN, D_MAX, X0, X1);
const y = linScale(18, -24, Y0, Y1);

/** Inverse-square falloff, referenced to 0 dB at REF_M. */
const directDb = (d: number) => -20 * Math.log10(d / REF_M);
/** Distance at which the direct sound equals a given reverberant level. */
const crossing = (revDb: number) => REF_M * 10 ** (-revDb / 20);

const geom = computed(() => {
  const dcLive = crossing(REV_LIVE);
  const dcTreated = crossing(REV_TREATED);
  return {
    direct: path([
      [x(D_MIN), y(directDb(D_MIN))],
      [x(D_MAX), y(directDb(D_MAX))],
    ]),
    dcLive: { x: x(dcLive), y: y(REV_LIVE) },
    dcTreated: { x: x(dcTreated), y: y(REV_TREATED) },
    // Two sample distances either side of the live room's critical distance.
    near: { x: x(1), top: y(directDb(1)), bottom: y(REV_LIVE) },
    far: { x: x(8), top: y(REV_LIVE), bottom: y(directDb(8)) },
    nearDrr: `+${Math.round(directDb(1) - REV_LIVE)} dB`,
    farDrr: `−${Math.round(REV_LIVE - directDb(8))} dB`,
  };
});

const dTicks = [0.25, 0.5, 1, 2, 4, 8, 16];
const dbTicks = [12, 0, -12, -24];
</script>

<template>
  <FigureFrame
    :title="props.title"
    :caption="props.caption"
    view-box="0 0 640 300"
    :width="640"
    :legend="legend"
  >
    <g v-for="db in dbTicks" :key="`db-${db}`">
      <line class="fx-grid fx-grid--dashed" :x1="X0" :x2="X1" :y1="y(db)" :y2="y(db)" />
      <text class="fx-tick" :x="X0 - 8" :y="y(db)" text-anchor="end" dy="0.34em">{{ db }}</text>
    </g>

    <!-- Reverberant levels: roughly independent of distance -->
    <line
      class="fx-curve fx-curve--2 fx-curve--thin"
      :x1="X0"
      :x2="X1"
      :y1="y(REV_LIVE)"
      :y2="y(REV_LIVE)"
    />
    <line
      class="fx-curve fx-curve--4 fx-curve--thin fx-curve--dashed"
      :x1="X0"
      :x2="X1"
      :y1="y(REV_TREATED)"
      :y2="y(REV_TREATED)"
    />

    <!-- DRR gaps -->
    <g>
      <line
        class="fx-curve fx-curve--3 fx-curve--thin"
        :x1="geom.near.x"
        :x2="geom.near.x"
        :y1="geom.near.top"
        :y2="geom.near.bottom"
      />
      <rect
        class="fx-plate"
        :x="geom.near.x - 42"
        :y="(geom.near.top + geom.near.bottom) / 2 - 8"
        width="38"
        height="16"
      />
      <text
        class="fx-value fx-value--3"
        :x="geom.near.x - 6"
        :y="(geom.near.top + geom.near.bottom) / 2 + 4"
        text-anchor="end"
      >
        {{ geom.nearDrr }}
      </text>
    </g>
    <g>
      <line
        class="fx-curve fx-curve--3 fx-curve--thin"
        :x1="geom.far.x"
        :x2="geom.far.x"
        :y1="geom.far.top"
        :y2="geom.far.bottom"
      />
      <text
        class="fx-value fx-value--3"
        :x="geom.far.x + 7"
        :y="(geom.far.top + geom.far.bottom) / 2 + 4"
      >
        {{ geom.farDrr }}
      </text>
    </g>

    <!-- Direct sound -->
    <path class="fx-curve" :d="geom.direct" />

    <!-- Critical distances -->
    <circle class="fx-dot fx-dot--2" :cx="geom.dcLive.x" :cy="geom.dcLive.y" r="4" />
    <text class="fx-value fx-value--2" :x="geom.dcLive.x + 8" :y="geom.dcLive.y - 8">
      {{ label('critLive') }}
    </text>
    <circle class="fx-dot" :cx="geom.dcTreated.x" :cy="geom.dcTreated.y" r="4" />
    <text
      class="fx-value fx-value--4"
      :x="geom.dcTreated.x - 8"
      :y="geom.dcTreated.y + 16"
      text-anchor="end"
    >
      {{ label('critTreated') }}
    </text>

    <!-- Reading the two halves -->
    <text class="fx-note" :x="X0 + 8" :y="Y1 - 14">{{ label('closer') }}</text>
    <text class="fx-note" :x="X1 - 8" :y="Y1 - 14" text-anchor="end">{{ label('farther') }}</text>

    <!-- Axes -->
    <line class="fx-axis" :x1="X0" :x2="X0" :y1="Y0" :y2="Y1" />
    <line class="fx-axis" :x1="X0" :x2="X1" :y1="Y1" :y2="Y1" />
    <g v-for="d in dTicks" :key="`d-${d}`">
      <line class="fx-axis" :x1="x(d)" :x2="x(d)" :y1="Y1" :y2="Y1 + 4" />
      <text class="fx-tick" :x="x(d)" :y="Y1 + 15" text-anchor="middle">{{ d }}</text>
    </g>
    <text class="fx-axis-label" :x="X1" :y="Y1 + 32" text-anchor="end">
      {{ label('axisDistance') }}
    </text>
    <text
      class="fx-axis-label"
      :x="20"
      :y="(Y0 + Y1) / 2"
      text-anchor="middle"
      :transform="`rotate(-90 20 ${(Y0 + Y1) / 2})`"
    >
      {{ label('axisLevel') }}
    </text>
  </FigureFrame>
</template>
