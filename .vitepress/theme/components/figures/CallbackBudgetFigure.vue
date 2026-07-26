<script setup lang="ts">
/**
 * The audio callback's deadline, and what missing it once costs.
 *
 * Every block has a fixed wall-clock budget: fill it before the device needs it.
 * Normal blocks finish with headroom to spare. The rule about allocation and
 * locks exists because their cost is *unbounded* — one block that waits on a
 * mutex blows through its deadline, the output buffer is not ready, and the
 * listener hears a click. Nothing about the DSP changed; only the timing did.
 */
import { computed } from 'vue';
import FigureFrame, { type FigureLegendItem } from './FigureFrame.vue';

const props = withDefaults(
  defineProps<{
    title?: string;
    caption?: string;
    /**
     * Processing time per block as a fraction of the block period. Values above
     * 1 miss the deadline.
     */
    loads?: number[];
    /** Index of the block whose output never arrives. */
    dropoutAt?: number;
    /** Block size note, e.g. "128 frames @ 48 kHz ≈ 2.7 ms". */
    scaleNote?: string;
    labels?: Partial<Record<Key, string>>;
  }>(),
  {
    loads: () => [0.42, 0.5, 0.38, 0.46, 1.35, 0.44, 0.4, 0.48],
    dropoutAt: 4,
    scaleNote: '128 frames @ 48 kHz ≈ 2.7 ms',
  },
);

type Key =
  | 'process'
  | 'output'
  | 'period'
  | 'headroom'
  | 'overrun'
  | 'dropout'
  | 'metDeadline'
  | 'missedDeadline'
  | 'delivered';

const DEFAULTS: Record<Key, string> = {
  process: 'process',
  output: 'output',
  period: 'one block period — one deadline',
  headroom: 'headroom',
  overrun: 'allocation or lock wait',
  dropout: 'audible click',
  metDeadline: 'finished inside the deadline',
  missedDeadline: 'ran past the deadline',
  delivered: 'block delivered to the device',
};

const label = (key: Key) => props.labels?.[key] ?? DEFAULTS[key];

const legend = computed<FigureLegendItem[]>(() => [
  { series: 4, shape: 'block', label: label('metDeadline') },
  { series: 5, shape: 'block', label: label('missedDeadline') },
  { series: 0, shape: 'block', label: label('delivered') },
]);

const X0 = 94;
const X1 = 606;
const PROC_TOP = 56;
const PROC_BOT = 100;
const OUT_TOP = 132;
const OUT_BOT = 176;

const geom = computed(() => {
  const n = props.loads.length;
  const w = (X1 - X0) / n;
  const bars: {
    x: number;
    inTime: number;
    over: number;
    start: number;
  }[] = [];
  // A late block pushes the next callback back, so bars start where the
  // previous one actually finished.
  let cursor = X0;
  props.loads.forEach((load, i) => {
    const slotStart = X0 + i * w;
    const deadline = slotStart + w;
    const start = Math.max(slotStart, cursor);
    const end = start + load * w;
    bars.push({
      x: start,
      start,
      inTime: Math.max(0, Math.min(end, deadline) - start),
      over: Math.max(0, end - deadline),
    });
    cursor = end;
  });

  const headroomIdx = 1;
  const headroom = {
    from: bars[headroomIdx].x + bars[headroomIdx].inTime,
    to: X0 + (headroomIdx + 1) * w,
  };

  const overIdx = props.loads.findIndex((l) => l > 1);
  const over = overIdx >= 0 ? bars[overIdx] : null;

  return {
    w,
    bars,
    boundaries: Array.from({ length: n + 1 }, (_, i) => X0 + i * w),
    headroom,
    headroomCx: (headroom.from + headroom.to) / 2,
    overX: over ? X0 + (overIdx + 1) * w : 0,
    overEnd: over ? over.x + over.inTime + over.over : 0,
    outputs: props.loads.map((_, i) => ({
      x: X0 + i * w + 2,
      w: w - 4,
      dropped: i === props.dropoutAt,
      cx: X0 + i * w + w / 2,
    })),
    dropCx: X0 + props.dropoutAt * w + w / 2,
  };
});
</script>

<template>
  <FigureFrame
    :title="props.title"
    :caption="props.caption"
    view-box="0 0 640 244"
    :width="640"
    :legend="legend"
  >
    <!-- Deadlines -->
    <line
      v-for="(bx, i) in geom.boundaries"
      :key="`bd-${i}`"
      class="fx-grid fx-grid--dashed fx-grid--strong"
      :x1="bx"
      :x2="bx"
      y1="50"
      :y2="OUT_BOT + 6"
    />

    <!-- One period, measured -->
    <path
      class="fx-leader"
      :d="`M ${X0} 34 L ${X0} 46 M ${X0 + geom.w} 34 L ${X0 + geom.w} 46`"
    />
    <path class="fx-axis" :d="`M ${X0} 40 L ${X0 + geom.w} 40`" />
    <text class="fx-axis-label" :x="X0 + geom.w + 10" y="44">{{ label('period') }}</text>

    <!-- Processing lane -->
    <text class="fx-axis-label" :x="X0 - 10" :y="(PROC_TOP + PROC_BOT) / 2 + 3" text-anchor="end">
      {{ label('process') }}
    </text>
    <g v-for="(b, i) in geom.bars" :key="`bar-${i}`">
      <rect
        class="fx-block fx-block--4"
        :x="b.x"
        :y="PROC_TOP + 8"
        :width="b.inTime"
        :height="PROC_BOT - PROC_TOP - 16"
        rx="2"
      />
      <rect
        v-if="b.over > 0"
        class="fx-block fx-block--5"
        :x="b.x + b.inTime"
        :y="PROC_TOP + 8"
        :width="b.over"
        :height="PROC_BOT - PROC_TOP - 16"
        rx="2"
      />
    </g>

    <!-- Headroom on a healthy block -->
    <path
      class="fx-leader"
      :d="`M ${geom.headroom.from} ${PROC_BOT + 2} L ${geom.headroom.from} ${PROC_BOT + 14} M ${geom.headroom.to} ${PROC_BOT + 2} L ${geom.headroom.to} ${PROC_BOT + 14}`"
    />
    <path
      class="fx-axis"
      :d="`M ${geom.headroom.from} ${PROC_BOT + 8} L ${geom.headroom.to} ${PROC_BOT + 8}`"
    />
    <text class="fx-axis-label" :x="geom.headroomCx" :y="PROC_BOT + 24" text-anchor="middle">
      {{ label('headroom') }}
    </text>

    <!-- The overrun -->
    <text class="fx-value fx-value--5" :x="geom.overEnd + 10" :y="PROC_TOP - 4">
      {{ label('overrun') }}
    </text>
    <path
      class="fx-leader"
      :d="`M ${geom.overEnd + 6} ${PROC_TOP - 7} L ${geom.overEnd - 4} ${PROC_TOP + 12}`"
    />

    <!-- Output lane -->
    <text class="fx-axis-label" :x="X0 - 10" :y="(OUT_TOP + OUT_BOT) / 2 + 3" text-anchor="end">
      {{ label('output') }}
    </text>
    <g v-for="(o, i) in geom.outputs" :key="`out-${i}`">
      <rect
        :class="o.dropped ? 'fx-block fx-block--outline' : 'fx-block fx-block--muted'"
        :x="o.x"
        :y="OUT_TOP + 8"
        :width="o.w"
        :height="OUT_BOT - OUT_TOP - 16"
        rx="2"
      />
      <path
        v-if="o.dropped"
        class="fx-curve fx-curve--5 fx-curve--thin"
        :d="`M ${o.x + 6} ${OUT_TOP + 14} L ${o.x + o.w - 6} ${OUT_BOT - 14} M ${o.x + o.w - 6} ${OUT_TOP + 14} L ${o.x + 6} ${OUT_BOT - 14}`"
      />
    </g>
    <text class="fx-value fx-value--5" :x="geom.dropCx" :y="OUT_BOT + 26" text-anchor="middle">
      {{ label('dropout') }}
    </text>
    <path
      class="fx-leader"
      :d="`M ${geom.dropCx} ${OUT_BOT + 18} L ${geom.dropCx} ${OUT_BOT + 4}`"
    />

    <text class="fx-axis-label" :x="X1" :y="OUT_BOT + 46" text-anchor="end">
      {{ props.scaleNote }}
    </text>
  </FigureFrame>
</template>
