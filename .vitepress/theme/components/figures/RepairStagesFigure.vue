<script setup lang="ts">
/**
 * The six repair stages in the order the chain runs them, each beside the
 * detector whose evidence enables it and the defect it addresses.
 *
 * The rail reads top to bottom. The short-time defects come first because a
 * flat clipped region hides the transient a click detector needs, and the
 * sustained ones follow in the order that keeps each estimate clean: hum out
 * before the broadband floor is estimated, the floor out before the late tail.
 */
import { computed } from 'vue';
import FigureFrame from './FigureFrame.vue';

const props = defineProps<{
  title?: string;
  caption?: string;
  labels?: Partial<Record<Key, string>>;
}>();

type StageKey = 'declip' | 'declick' | 'decrackle' | 'dehum' | 'denoise' | 'dereverb';
type GroupKey = 'shortTime' | 'sustained';
type Key = GroupKey | `${StageKey}Fix` | 'detectorHead' | 'stageHead' | 'fixHead' | 'note';

const DEFAULTS: Record<Key, string> = {
  shortTime: 'short-time defects',
  sustained: 'sustained defects',
  declipFix: 'flat-topped peaks, a hard digital ceiling',
  declickFix: 'isolated discontinuities and pops',
  decrackleFix: 'dense, sample-scale surface defects',
  dehumFix: 'a 50/60 Hz tone and its harmonics',
  denoiseFix: 'a steady broadband noise floor',
  dereverbFix: 'a diffuse tail after the direct sound',
  detectorHead: 'detector',
  stageHead: 'stage, in run order',
  fixHead: 'what it repairs',
  note: 'A stage runs only when enabled. Enabling one never moves it.',
};

const label = (key: Key) => props.labels?.[key] ?? DEFAULTS[key];

/** Engine run order; detector names are the WASM exports. */
const GROUPS: { key: GroupKey; series: 2 | 3; stages: { id: StageKey; detector: string }[] }[] = [
  {
    key: 'shortTime',
    series: 3,
    stages: [
      { id: 'declip', detector: 'masteringRepairDetectClipping' },
      { id: 'declick', detector: 'masteringRepairDetectClicks' },
      { id: 'decrackle', detector: 'masteringRepairDetectCrackle' },
    ],
  },
  {
    key: 'sustained',
    series: 2,
    stages: [
      { id: 'dehum', detector: 'masteringRepairDetectHum' },
      { id: 'denoise', detector: 'masteringRepairDetectNoiseFloor' },
      { id: 'dereverb', detector: 'masteringRepairDetectReverb' },
    ],
  },
];

const W = 640;
const HEAD_Y = 14;
const LANE_X = 10;
const LANE_TOP0 = 22;
const LANE_LABEL = 18; // room above the first row for the group label
const LANE_PAD = 8;
const LANE_GAP = 10;
const ROW_PITCH = 40;
const BLOCK_H = 24;
// 186 px holds the longest detector name at the 8.5 px tick size.
const DET_X = 20;
const DET_W = 186;
const STAGE_X = 232;
const STAGE_W = 124;
const SPINE_X = STAGE_X + STAGE_W / 2;
const FIX_X = 378;

const chevronDown = (x: number, y: number) =>
  `M ${x - 3.5} ${y - 4} L ${x} ${y} L ${x + 3.5} ${y - 4}`;
const chevronRight = (x: number, y: number) =>
  `M ${x - 4} ${y - 3.5} L ${x} ${y} L ${x - 4} ${y + 3.5}`;

const geom = computed(() => {
  let top = LANE_TOP0;
  let order = 0;
  const lanes = GROUPS.map((g) => {
    const laneTop = top;
    const rows = g.stages.map((s, i) => {
      order += 1;
      const y = laneTop + LANE_LABEL + i * ROW_PITCH;
      return { ...s, order, y, mid: y + BLOCK_H / 2 };
    });
    const laneBot = rows[rows.length - 1].y + BLOCK_H + LANE_PAD;
    top = laneBot + LANE_GAP;
    return { ...g, laneTop, laneBot, rows };
  });
  const all = lanes.flatMap((l) => l.rows);
  const links = all.slice(1).map((r, i) => {
    const from = all[i].y + BLOCK_H;
    return `M ${SPINE_X} ${from} V ${r.y} ${chevronDown(SPINE_X, r.y)}`;
  });
  const bottom = lanes[lanes.length - 1].laneBot;
  return { lanes, links, noteY: bottom + 18, h: bottom + 28 };
});
</script>

<template>
  <FigureFrame
    :title="props.title"
    :caption="props.caption"
    :view-box="`0 0 ${W} ${geom.h}`"
    :width="W"
  >
    <text class="fx-axis-label" :x="DET_X" :y="HEAD_Y">{{ label('detectorHead') }}</text>
    <text class="fx-axis-label" :x="STAGE_X" :y="HEAD_Y">{{ label('stageHead') }}</text>
    <text class="fx-axis-label" :x="FIX_X" :y="HEAD_Y">{{ label('fixHead') }}</text>

    <g v-for="lane in geom.lanes" :key="lane.key">
      <rect
        class="fx-lane"
        :x="LANE_X"
        :y="lane.laneTop"
        :width="W - 2 * LANE_X"
        :height="lane.laneBot - lane.laneTop"
        rx="5"
      />
      <text :class="`fx-axis-label fx-value--${lane.series}`" :x="DET_X" :y="lane.laneTop + 12">
        {{ label(lane.key) }}
      </text>

      <g v-for="r in lane.rows" :key="r.id">
        <!-- Detector evidence feeds the stage -->
        <rect class="fx-block fx-block--muted" :x="DET_X" :y="r.y" :width="DET_W" :height="BLOCK_H" rx="3" />
        <text class="fx-tick" :x="DET_X + 8" :y="r.mid" dy="0.35em">{{ r.detector }}</text>
        <path class="fx-leader" :d="`M ${DET_X + DET_W} ${r.mid} H ${STAGE_X - 2} ${chevronRight(STAGE_X - 2, r.mid)}`" />

        <rect :class="`fx-block fx-block--${lane.series}`" :x="STAGE_X" :y="r.y" :width="STAGE_W" :height="BLOCK_H" rx="3" />
        <text :class="`fx-tick fx-value--${lane.series}`" :x="STAGE_X + 9" :y="r.mid" dy="0.35em">{{ r.order }}</text>
        <text class="fx-value" :x="STAGE_X + 24" :y="r.mid" dy="0.35em">{{ r.id }}</text>

        <text class="fx-note" :x="FIX_X" :y="r.mid" dy="0.35em">{{ label(`${r.id}Fix`) }}</text>
      </g>
    </g>

    <!-- Run order: each stage hands its output to the next -->
    <path v-for="(d, i) in geom.links" :key="`link-${i}`" class="fx-axis" :d="d" />

    <text class="fx-note" :x="DET_X" :y="geom.noteY">{{ label('note') }}</text>
  </FigureFrame>
</template>
