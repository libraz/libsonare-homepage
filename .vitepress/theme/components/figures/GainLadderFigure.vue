<script setup lang="ts">
/**
 * Gain staging as one picture: where the signal sits at each stage, and what it
 * is sitting relative to.
 *
 * Each bar spans a stage's average level up to its peak level, on one dBFS
 * scale. The three things gain staging is actually about then become spatial:
 * the empty room above the peaks (headroom), where the compressor threshold
 * falls relative to the signal that is arriving, and the ceiling — which is a
 * peak-safety limit, not a loudness target.
 */
import { computed } from 'vue';
import FigureFrame, { type FigureLegendItem } from './FigureFrame.vue';
import { linScale } from './figureMath';

export interface LadderStage {
  label: string;
  peak: number;
  avg: number;
  /** Draw a threshold tick inside this stage at this level. */
  threshold?: number;
}

const props = withDefaults(
  defineProps<{
    title?: string;
    caption?: string;
    stages?: LadderStage[];
    /** True-peak ceiling, in dBFS. */
    ceiling?: number;
    labels?: Partial<Record<Key, string>>;
  }>(),
  {
    ceiling: -1,
    stages: () => [
      { label: 'source', peak: -6, avg: -20 },
      { label: 'input gain', peak: -6, avg: -20 },
      { label: 'compressor', peak: -7, avg: -19, threshold: -18 },
      { label: 'saturation', peak: -6, avg: -17 },
      { label: 'limiter', peak: -1, avg: -10.5 },
    ],
  },
);

type Key =
  | 'axisLevel'
  | 'clip'
  | 'ceilingLabel'
  | 'headroom'
  | 'peak'
  | 'avg'
  | 'threshold'
  | 'span'
  | 'unity';

const DEFAULTS: Record<Key, string> = {
  axisLevel: 'level (dBFS)',
  clip: '0 dBFS — clipping',
  ceilingLabel: 'true-peak ceiling',
  headroom: 'headroom',
  peak: 'peak',
  avg: 'average',
  threshold: 'threshold',
  span: 'peak-to-average span',
  unity: 'unity unless the source demands otherwise',
};

const label = (key: Key) => props.labels?.[key] ?? DEFAULTS[key];

const legend = computed<FigureLegendItem[]>(() => [
  { series: 1, shape: 'block', label: label('span') },
  { series: 5, label: label('clip') },
  { series: 3, shape: 'dashed', label: label('ceilingLabel') },
]);

const X0 = 116;
const X1 = 604;
const Y0 = 40;
const Y1 = 226;
const TOP_DB = 2;
const BOT_DB = -30;
const BAR_W = 38;

const y = linScale(TOP_DB, BOT_DB, Y0, Y1);

const geom = computed(() => {
  const slot = (X1 - X0) / props.stages.length;
  return {
    slot,
    bars: props.stages.map((s, i) => ({
      ...s,
      x: X0 + i * slot + (slot - BAR_W) / 2,
      cx: X0 + i * slot + slot / 2,
      top: y(s.peak),
      h: y(s.avg) - y(s.peak),
    })),
    headroom: { from: y(0), to: y(props.stages[0].peak), x: X0 + (slot - BAR_W) / 2 - 12 },
  };
});

const dbTicks = [0, -6, -12, -18, -24, -30];
</script>

<template>
  <FigureFrame
    :title="props.title"
    :caption="props.caption"
    view-box="0 0 640 292"
    :width="640"
    :legend="legend"
  >
    <g v-for="db in dbTicks" :key="`db-${db}`">
      <line class="fx-grid fx-grid--dashed" :x1="X0 - 20" :x2="X1" :y1="y(db)" :y2="y(db)" />
      <text class="fx-tick" :x="X0 - 28" :y="y(db)" text-anchor="end" dy="0.34em">{{ db }}</text>
    </g>

    <!-- Bars: average up to peak -->
    <g v-for="(b, i) in geom.bars" :key="`bar-${i}`">
      <rect class="fx-block" :x="b.x" :y="b.top" :width="BAR_W" :height="b.h" rx="3" />
      <line
        v-if="b.threshold !== undefined"
        class="fx-guide"
        :x1="b.x - 8"
        :x2="b.x + BAR_W + 8"
        :y1="y(b.threshold)"
        :y2="y(b.threshold)"
      />
      <text
        v-if="b.threshold !== undefined"
        class="fx-value fx-value--3"
        :x="b.x + BAR_W + 12"
        :y="y(b.threshold) + 4"
      >
        {{ label('threshold') }}
      </text>
      <text class="fx-axis-label" :x="b.cx" :y="Y1 + 18" text-anchor="middle">{{ b.label }}</text>
    </g>

    <!-- Peak / average, named once -->
    <text class="fx-note" :x="geom.bars[0].x + BAR_W + 6" :y="geom.bars[0].top - 5">
      {{ label('peak') }}
    </text>
    <text class="fx-note" :x="geom.bars[0].x + BAR_W + 6" :y="geom.bars[0].top + geom.bars[0].h + 12">
      {{ label('avg') }}
    </text>

    <!-- Clip line and ceiling -->
    <line class="fx-curve fx-curve--5 fx-curve--thin" :x1="X0 - 20" :x2="X1" :y1="y(0)" :y2="y(0)" />
    <text class="fx-value fx-value--5" :x="X1" :y="y(0) - 7" text-anchor="end">{{ label('clip') }}</text>
    <line
      class="fx-guide"
      :x1="X0 - 20"
      :x2="X1"
      :y1="y(props.ceiling)"
      :y2="y(props.ceiling)"
    />
    <text
      class="fx-value fx-value--3"
      :x="geom.bars[geom.bars.length - 1].x - 10"
      :y="y(props.ceiling) + 15"
      text-anchor="end"
    >
      {{ label('ceilingLabel') }} {{ props.ceiling }} dBTP
    </text>

    <!-- Headroom above the incoming peaks -->
    <path
      class="fx-leader"
      :d="`M ${geom.headroom.x - 6} ${geom.headroom.from} L ${geom.headroom.x + 6} ${geom.headroom.from} M ${geom.headroom.x - 6} ${geom.headroom.to} L ${geom.headroom.x + 6} ${geom.headroom.to}`"
    />
    <path
      class="fx-axis"
      :d="`M ${geom.headroom.x} ${geom.headroom.from} L ${geom.headroom.x} ${geom.headroom.to}`"
    />
    <text
      class="fx-axis-label"
      :x="geom.headroom.x - 10"
      :y="(geom.headroom.from + geom.headroom.to) / 2"
      text-anchor="middle"
      :transform="`rotate(-90 ${geom.headroom.x - 10} ${(geom.headroom.from + geom.headroom.to) / 2})`"
    >
      {{ label('headroom') }}
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

    <text class="fx-note" :x="geom.bars[1].cx" :y="Y1 + 40" text-anchor="middle">
      {{ label('unity') }}
    </text>
    <path
      class="fx-leader"
      :d="`M ${geom.bars[1].cx} ${Y1 + 30} L ${geom.bars[1].cx} ${Y1 + 22}`"
    />
  </FigureFrame>
</template>
