<script setup lang="ts">
/**
 * How audio moves through the mixer: strips feed buses, buses feed the master,
 * and a send taps a strip in parallel without interrupting that main path.
 *
 * The one thing to see is where a send taps relative to the fader. Every strip
 * carries both tap points — one after the pre inserts, one after the post
 * inserts — and a send picks one. A pre-fader send never hears a fader move; a
 * post-fader send follows it. Both taps are drawn on every strip so the reader
 * compares the two positions inside a single lane rather than across strips.
 *
 * Insert chains sit inside the strip on either side of the fader, and each bus
 * carries its own chain that runs once on the summed signal.
 */
import { computed } from 'vue';
import FigureFrame from './FigureFrame.vue';

const props = withDefaults(
  defineProps<{
    title?: string;
    caption?: string;
    /** Number of input strips drawn; the last one feeds the master directly. */
    strips?: number;
    labels?: Partial<Record<Key, string>>;
  }>(),
  { strips: 3 },
);

type BusKey = 'submix' | 'aux' | 'master';

type Key =
  | BusKey
  | 'strip'
  | 'preInserts'
  | 'fader'
  | 'postInserts'
  | 'inserts'
  | 'preSend'
  | 'postSend'
  | 'output'
  | 'note';

const DEFAULTS: Record<Key, string> = {
  strip: 'strip',
  preInserts: 'pre inserts',
  fader: 'fader',
  postInserts: 'post inserts',
  inserts: 'inserts',
  submix: 'submix bus',
  aux: 'aux bus',
  master: 'master',
  preSend: 'pre-fader send',
  postSend: 'post-fader send',
  output: 'output',
  note: 'Pre-fader sends ignore the fader; post-fader sends follow it. The strip’s own path continues either way.',
};

const label = (key: Key) => props.labels?.[key] ?? DEFAULTS[key];

const MIN_STRIPS = 2;
const MAX_STRIPS = 5;

// --- Layout. Strips are lanes on the left, buses a column to the right, master last.
const W = 640;
const X0 = 12;
const PAD = 5;
// 92 px holds nine CJK characters at 10 px mono; the fader block holds five.
const BOX_W = 92;
const FADER_W = 56;
const BOX_H = 24;
const TAP_W = 16; // wire span that carries a tap dot
const STAGE_GAP = 10;
const LANE_H = BOX_H + 2 * PAD;
const LANE_GAP = 20;
const LANE_PITCH = LANE_H + LANE_GAP;
const TOP = 22;
const SEND_DROP = 9; // a send's horizontal run sits this far below its lane

// Stage x positions inside a lane.
const PRE_X = X0 + PAD;
const PRE_TAP_X = PRE_X + BOX_W + TAP_W / 2;
const FADER_X = PRE_X + BOX_W + TAP_W;
const POST_X = FADER_X + FADER_W + STAGE_GAP;
const POST_TAP_X = POST_X + BOX_W + TAP_W / 2;
const LANE_W = POST_X + BOX_W + TAP_W + PAD - X0;
const STRIP_R = X0 + LANE_W;

// Wiring column between the strips and the buses.
const PRE_RAIL_X = STRIP_R + 12;
const POST_RAIL_X = STRIP_R + 22;
const MAIN_RAIL_X = STRIP_R + 36;
const BUS_X = STRIP_R + 48;
const BUS_W = BOX_W + 2 * PAD;
const MASTER_RAIL_X = BUS_X + BUS_W + 22;
const MASTER_X = MASTER_RAIL_X + 22;
const EXIT_X = MASTER_X + BUS_W + 16;
const AUX_JOIN = 5; // the two sends enter the aux bus this far above/below its centre

/** Arrowhead with its tip at (x, y), pointing right. */
const chevron = (x: number, y: number) => `M ${x - 4} ${y - 3.5} L ${x} ${y} L ${x - 4} ${y + 3.5}`;

const geom = computed(() => {
  const count = Math.min(MAX_STRIPS, Math.max(MIN_STRIPS, Math.round(props.strips)));
  const last = count - 1;
  const strips = Array.from({ length: count }, (_, i) => {
    const top = TOP + i * LANE_PITCH;
    const mid = top + LANE_H / 2;
    return {
      index: i,
      top,
      mid,
      bottom: top + LANE_H,
      entry: `M 2 ${mid} H ${X0} ${chevron(X0, mid)}`,
      wires: `M ${PRE_X + BOX_W} ${mid} H ${FADER_X} M ${FADER_X + FADER_W} ${mid} H ${POST_X}`,
      // The post-fader send leaves the strip above the last; the pre-fader send leaves the last.
      preSend: i === last,
      postSend: i === last - 1,
    };
  });

  // Every strip but the last sums into the submix; the last feeds the master directly.
  const feeding = strips.slice(0, last);
  const submixMid = feeding.reduce((sum, s) => sum + s.mid, 0) / feeding.length;
  const auxTop = strips[last].bottom + LANE_GAP + 10;
  const auxMid = auxTop + LANE_H / 2;
  const masterMid = strips[last].mid;
  const buses: { key: BusKey; x: number; top: number; mid: number }[] = [
    { key: 'submix', x: BUS_X, top: submixMid - LANE_H / 2, mid: submixMid },
    { key: 'aux', x: BUS_X, top: auxTop, mid: auxMid },
    { key: 'master', x: MASTER_X, top: masterMid - LANE_H / 2, mid: masterMid },
  ];

  const mainOuts = feeding.map((s) => `M ${POST_X + BOX_W} ${s.mid} H ${MAIN_RAIL_X}`);
  const submixRail = `M ${MAIN_RAIL_X} ${feeding[0].mid} V ${feeding[feeding.length - 1].mid} M ${MAIN_RAIL_X} ${submixMid} H ${BUS_X} ${chevron(BUS_X, submixMid)}`;
  const direct = `M ${POST_X + BOX_W} ${masterMid} H ${MASTER_RAIL_X}`;
  const masterRail = `M ${BUS_X + BUS_W} ${submixMid} H ${MASTER_RAIL_X} V ${auxMid} H ${BUS_X + BUS_W} M ${MASTER_RAIL_X} ${masterMid} H ${MASTER_X} ${chevron(MASTER_X, masterMid)}`;
  const exit = `M ${MASTER_X + BUS_W} ${masterMid} H ${EXIT_X} ${chevron(EXIT_X, masterMid)}`;

  // Sends drop out of their tap into the gap below the lane, run to their rail, then down to the aux bus.
  const preStrip = strips[last];
  const preRunY = preStrip.bottom + SEND_DROP;
  const preSend = {
    d: `M ${PRE_TAP_X} ${preStrip.mid} V ${preRunY} H ${PRE_RAIL_X} V ${auxMid - AUX_JOIN} H ${BUS_X} ${chevron(BUS_X, auxMid - AUX_JOIN)}`,
    labelX: PRE_TAP_X + 8,
    labelY: preRunY,
  };
  const postStrip = strips[last - 1];
  const postRunY = postStrip.bottom + SEND_DROP;
  const postSend = {
    d: `M ${POST_TAP_X} ${postStrip.mid} V ${postRunY} H ${POST_RAIL_X} V ${auxMid + AUX_JOIN} H ${BUS_X} ${chevron(BUS_X, auxMid + AUX_JOIN)}`,
    labelX: POST_TAP_X - 8,
    labelY: postRunY,
  };

  const noteY = auxTop + LANE_H + 24;
  return {
    strips,
    buses,
    mainOuts,
    submixRail,
    direct,
    masterRail,
    exit,
    preSend,
    postSend,
    outputX: MASTER_X + BUS_W / 2,
    outputY: masterMid + LANE_H / 2 + 14,
    noteY,
    h: noteY + 10,
  };
});
</script>

<template>
  <FigureFrame
    :title="props.title"
    :caption="props.caption"
    :view-box="`0 0 ${W} ${geom.h}`"
    :width="W"
  >
    <!-- Lanes: one per strip, one per bus -->
    <rect
      v-for="s in geom.strips"
      :key="`lane-${s.index}`"
      class="fx-lane"
      :x="X0"
      :y="s.top"
      :width="LANE_W"
      :height="LANE_H"
      rx="5"
    />
    <rect
      v-for="b in geom.buses"
      :key="`lane-${b.key}`"
      class="fx-lane"
      :x="b.x"
      :y="b.top"
      :width="BUS_W"
      :height="LANE_H"
      rx="5"
    />

    <!-- Main path: strip input, in-lane wires, strips to buses, buses to master -->
    <g v-for="s in geom.strips" :key="`wire-${s.index}`">
      <path class="fx-axis" :d="s.entry" />
      <path class="fx-axis" :d="s.wires" />
    </g>
    <path v-for="(d, i) in geom.mainOuts" :key="`out-${i}`" class="fx-axis" :d="d" />
    <path class="fx-axis" :d="geom.submixRail" />
    <path class="fx-axis" :d="geom.direct" />
    <path class="fx-axis" :d="geom.masterRail" />
    <path class="fx-axis" :d="geom.exit" />

    <!-- Stages inside each strip -->
    <g v-for="s in geom.strips" :key="`stage-${s.index}`">
      <rect
        class="fx-block fx-block--outline"
        :x="PRE_X"
        :y="s.top + PAD"
        :width="BOX_W"
        :height="BOX_H"
        rx="3"
      />
      <text class="fx-value" :x="PRE_X + BOX_W / 2" :y="s.mid" dy="0.35em" text-anchor="middle">
        {{ label('preInserts') }}
      </text>
      <rect class="fx-block" :x="FADER_X" :y="s.top + PAD" :width="FADER_W" :height="BOX_H" rx="3" />
      <text class="fx-value" :x="FADER_X + FADER_W / 2" :y="s.mid" dy="0.35em" text-anchor="middle">
        {{ label('fader') }}
      </text>
      <rect
        class="fx-block fx-block--outline"
        :x="POST_X"
        :y="s.top + PAD"
        :width="BOX_W"
        :height="BOX_H"
        rx="3"
      />
      <text class="fx-value" :x="POST_X + BOX_W / 2" :y="s.mid" dy="0.35em" text-anchor="middle">
        {{ label('postInserts') }}
      </text>
    </g>

    <!-- Bus insert chains -->
    <g v-for="b in geom.buses" :key="`chip-${b.key}`">
      <rect
        class="fx-block fx-block--outline"
        :x="b.x + PAD"
        :y="b.top + PAD"
        :width="BOX_W"
        :height="BOX_H"
        rx="3"
      />
      <text class="fx-value" :x="b.x + BUS_W / 2" :y="b.mid" dy="0.35em" text-anchor="middle">
        {{ label('inserts') }}
      </text>
    </g>

    <!-- Sends: a parallel copy, tapped before or after the fader -->
    <path class="fx-curve fx-curve--thin fx-curve--3" :d="geom.preSend.d" />
    <path class="fx-curve fx-curve--thin fx-curve--2" :d="geom.postSend.d" />

    <!-- Tap points: both exist on every strip; the filled one is the tap a send uses -->
    <g v-for="s in geom.strips" :key="`tap-${s.index}`">
      <circle
        :class="s.preSend ? 'fx-dot fx-dot--3' : 'fx-dot fx-dot--hollow'"
        :cx="PRE_TAP_X"
        :cy="s.mid"
        :r="s.preSend ? 3.5 : 2.5"
      />
      <circle
        :class="s.postSend ? 'fx-dot fx-dot--2' : 'fx-dot fx-dot--hollow'"
        :cx="POST_TAP_X"
        :cy="s.mid"
        :r="s.postSend ? 3.5 : 2.5"
      />
    </g>

    <!-- Names -->
    <text
      v-for="s in geom.strips"
      :key="`name-${s.index}`"
      class="fx-axis-label"
      :x="X0 + 2"
      :y="s.top - 6"
    >
      {{ label('strip') }} {{ s.index + 1 }}
    </text>
    <text v-for="b in geom.buses" :key="`name-${b.key}`" class="fx-axis-label" :x="b.x + 2" :y="b.top - 6">
      {{ label(b.key) }}
    </text>
    <text
      class="fx-value fx-value--3"
      :x="geom.preSend.labelX"
      :y="geom.preSend.labelY"
      dy="0.35em"
    >
      {{ label('preSend') }}
    </text>
    <text
      class="fx-value fx-value--2"
      :x="geom.postSend.labelX"
      :y="geom.postSend.labelY"
      dy="0.35em"
      text-anchor="end"
    >
      {{ label('postSend') }}
    </text>
    <text class="fx-axis-label" :x="geom.outputX" :y="geom.outputY" text-anchor="middle">
      {{ label('output') }}
    </text>

    <text class="fx-note" :x="X0" :y="geom.noteY">{{ label('note') }}</text>
  </FigureFrame>
</template>
