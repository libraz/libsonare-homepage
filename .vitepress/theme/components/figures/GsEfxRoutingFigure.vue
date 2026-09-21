<script setup lang="ts">
/**
 * Where a GS insertion effect sits on a part's way to the output.
 *
 * The insert is a stage on ONE part's path — whichever parts `40 4x 22` assigns
 * to a unit — and everything else goes straight to the mix. Reverb, chorus and
 * delay are not stages at all: they are send-return units, wet only, running in
 * parallel, and their returns sum back into the mix. The thing readers get
 * wrong is where the send is taken. A bypassed part sends from the part itself
 * (CC91/93/94); a part through an insert sends AFTER the effect, by the unit's
 * own three send levels, so the wet tail is made from the processed signal.
 * The master EQ comes last and takes the returns with it.
 */
import { computed } from 'vue';
import FigureFrame, { type FigureLegendItem } from './FigureFrame.vue';

const props = defineProps<{
  title?: string;
  caption?: string;
  labels?: Partial<Record<Key, string>>;
}>();

const UNIT_KEYS = ['reverb', 'chorus', 'delay'] as const;
type UnitKey = (typeof UNIT_KEYS)[number];

type Key =
  | UnitKey
  | `${UnitKey}Sub`
  | 'part'
  | 'partSub1'
  | 'partSub2'
  | 'insert'
  | 'insertSub1'
  | 'insertSub2'
  | 'eq'
  | 'eqSub1'
  | 'eqSub2'
  | 'out'
  | 'mix'
  | 'bypassNote'
  | 'partTap1'
  | 'partTap2'
  | 'efxTap1'
  | 'efxTap2'
  | 'sendsHead'
  | 'sendsSub1'
  | 'sendsSub2'
  | 'returns'
  | 'crossNote'
  | 'legendPath'
  | 'legendSend'
  | 'legendBypass'
  | 'caption';

const DEFAULTS: Record<Key, string> = {
  reverb: 'Reverb',
  reverbSub: '40 01 30–37',
  chorus: 'Chorus',
  chorusSub: '40 01 38–40',
  delay: 'Delay',
  delaySub: '40 01 50–5A',
  part: 'Part x',
  partSub1: '40 4x 22',
  partSub2: 'to unit: 01–10',
  insert: 'Insertion effect',
  insertSub1: 'type + 20 parameters',
  insertSub2: 'runs once on the sum',
  eq: 'Master EQ',
  eqSub1: '40 02 00–03',
  eqSub2: 'bypass: 40 4x 20',
  out: 'out',
  mix: 'dry mix',
  bypassNote: '40 4x 22 = 00: bypass, no insert',
  partTap1: 'send at the part',
  partTap2: 'CC91 · 93 · 94',
  efxTap1: 'send after the effect',
  efxTap2: '40 03 17–19',
  sendsHead: 'System effects',
  sendsSub1: 'send-return, wet only',
  sendsSub2: 'in parallel',
  returns: 'returns sum into the mix',
  crossNote: 'chorus → reverb · chorus → delay · delay → reverb: held, never routed (STATE)',
  legendPath: "the assigned part's path",
  legendSend: 'sends and returns, wet only',
  legendBypass: 'bypass: 40 4x 22 = 00',
  caption:
    'The insert is one stage on one part. Its sends are taken after it, the three system effects run in parallel off those sends, and their returns rejoin the mix before the master EQ.',
};

const label = (key: Key) => props.labels?.[key] ?? DEFAULTS[key];

const captionText = computed(() => props.caption ?? label('caption'));

const legend = computed<FigureLegendItem[]>(() => [
  { series: 1, shape: 'block', label: label('legendPath') },
  { series: 2, label: label('legendSend') },
  { series: 0, label: label('legendBypass') },
]);

// Layout. Text budgets at PAD inset: a title line (10.5px) holds about
// (w - 2 * PAD) / 10.5 CJK glyphs, a sub line (8.5px) about (w - 2 * PAD) / 8.5.
// Part / effect units 96 → 7 title / 8 sub; insert 152 → 12 / 15; EQ 120 → 9 / 11;
// tap notes 15 (post-effect) and 28 (part); sends header 13.
const W = 640;
const MARGIN = 16;
const PAD = 10;
const LINE = 12;
const TOP = 30;
const BLOCK_H = 52;
const PART_W = 96;
const INSERT_W = 152;
const UNIT_W = 96;
const UNIT_GAP = 8;
const EQ_W = 120;
const GAP = 36;
const BYPASS_Y = 14;
const BYPASS_EXIT = 10;
const BYPASS_TURN = 14;
const TAP_X = 320;
const MIX_X = 384;
const RETURN_X = 464;
const EQ_X = 484;
const OUT_END = 626;
const SEND_BUS_Y = 112;
const SENDS_TOP = 130;
const RETURN_Y = 200;
const NOTE_Y = 222;
const GHOSTS = 2;
const GHOST_STEP = 5;
const H = 236;

const chainY = TOP + BLOCK_H / 2;

const arrowRight = (x: number, y: number) => `M ${x - 6} ${y - 4} L ${x} ${y} L ${x - 6} ${y + 4}`;
const arrowDown = (x: number, y: number) => `M ${x - 4} ${y - 6} L ${x} ${y} L ${x + 4} ${y - 6}`;
const arrowUp = (x: number, y: number) => `M ${x - 4} ${y + 6} L ${x} ${y} L ${x + 4} ${y + 6}`;

const part = {
  x: MARGIN,
  y: TOP,
  w: PART_W,
  h: BLOCK_H,
  right: MARGIN + PART_W,
  cx: MARGIN + PART_W / 2,
};
const insert = {
  x: part.right + GAP,
  y: TOP,
  w: INSERT_W,
  h: BLOCK_H,
  right: part.right + GAP + INSERT_W,
};
const eq = { x: EQ_X, y: TOP, w: EQ_W, h: BLOCK_H, right: EQ_X + EQ_W };

// The chain: part → insert → mix (bypass joins, returns join) → EQ → out.
const chain = computed(() => ({
  toInsert: `M ${part.right + 2} ${chainY} H ${insert.x - 2}`,
  toInsertHead: arrowRight(insert.x - 2, chainY),
  toEq: `M ${insert.right + 2} ${chainY} H ${eq.x - 2}`,
  toEqHead: arrowRight(eq.x - 2, chainY),
  out: `M ${eq.right + 2} ${chainY} H ${OUT_END}`,
  outHead: arrowRight(OUT_END, chainY),
  bypass: `M ${part.right + 2} ${part.y + BYPASS_EXIT} H ${part.right + BYPASS_TURN} V ${BYPASS_Y} H ${MIX_X} V ${chainY - 2}`,
  bypassHead: arrowDown(MIX_X, chainY - 2),
}));

// Send-return units under the chain, one per system effect.
const units = computed(() =>
  UNIT_KEYS.map((key, i) => {
    const x = insert.x + i * (UNIT_W + UNIT_GAP);
    return {
      key,
      x,
      y: SENDS_TOP,
      cx: x + UNIT_W / 2,
      bottom: SENDS_TOP + BLOCK_H,
      sub: `${key}Sub` as Key,
    };
  }),
);

const sendBusEnd = computed(() => units.value[units.value.length - 1].cx);

// Sends: the part tap (bypassed part) and the post-effect tap feed one bus, which
// feeds each unit; the returns collect under the units and rise into the mix.
const sends = computed(() => ({
  partTap: `M ${part.cx} ${part.y + part.h} V ${SEND_BUS_Y}`,
  efxTap: `M ${TAP_X} ${chainY} V ${SEND_BUS_Y}`,
  bus: `M ${part.cx} ${SEND_BUS_Y} H ${sendBusEnd.value}`,
  feeds: units.value.map((u) => ({
    key: u.key,
    d: `M ${u.cx} ${SEND_BUS_Y} V ${u.y - 2}`,
    head: arrowDown(u.cx, u.y - 2),
  })),
  drops: units.value.map((u) => ({ key: u.key, d: `M ${u.cx} ${u.bottom} V ${RETURN_Y}` })),
  returnBus: `M ${units.value[0].cx} ${RETURN_Y} H ${RETURN_X} V ${chainY + 2}`,
  returnHead: arrowUp(RETURN_X, chainY + 2),
}));

const mixLabelX = (MIX_X + RETURN_X) / 2;
const partTapText = { x: part.cx + 6, y1: SEND_BUS_Y - 16, y2: SEND_BUS_Y - 5 };
const efxTapText = { x: TAP_X + 6, y1: SEND_BUS_Y - 16, y2: SEND_BUS_Y - 5 };
const sendsHeadText = { x: MARGIN, y1: SENDS_TOP + 16, y2: SENDS_TOP + 30, y3: SENDS_TOP + 42 };
const returnsText = { x: RETURN_X + 8, y: RETURN_Y - 6 };
</script>

<template>
  <FigureFrame
    :title="props.title"
    :caption="captionText"
    :view-box="`0 0 ${W} ${H}`"
    :width="W"
    :legend="legend"
  >
    <!-- One part of sixteen: the outlines behind it are the others, stacked away from the exits -->
    <rect
      v-for="g in GHOSTS"
      :key="`ghost-${g}`"
      class="fx-block fx-block--outline"
      :x="part.x - g * GHOST_STEP"
      :y="part.y - g * GHOST_STEP"
      :width="part.w"
      :height="part.h"
      rx="2"
    />
    <rect class="fx-plate" :x="part.x" :y="part.y" :width="part.w" :height="part.h" rx="2" />
    <rect class="fx-block" :x="part.x" :y="part.y" :width="part.w" :height="part.h" rx="2" />
    <text class="fx-note fx-note--strong" :x="part.x + PAD" :y="part.y + 18">{{ label('part') }}</text>
    <text class="fx-tick" :x="part.x + PAD" :y="part.y + 34">{{ label('partSub1') }}</text>
    <text class="fx-tick" :x="part.x + PAD" :y="part.y + 34 + LINE">{{ label('partSub2') }}</text>

    <!-- The insert, then the master EQ -->
    <rect class="fx-block" :x="insert.x" :y="insert.y" :width="insert.w" :height="insert.h" rx="2" />
    <text class="fx-note fx-note--strong" :x="insert.x + PAD" :y="insert.y + 18">{{ label('insert') }}</text>
    <text class="fx-tick" :x="insert.x + PAD" :y="insert.y + 34">{{ label('insertSub1') }}</text>
    <text class="fx-tick" :x="insert.x + PAD" :y="insert.y + 34 + LINE">{{ label('insertSub2') }}</text>
    <rect class="fx-block" :x="eq.x" :y="eq.y" :width="eq.w" :height="eq.h" rx="2" />
    <text class="fx-note fx-note--strong" :x="eq.x + PAD" :y="eq.y + 18">{{ label('eq') }}</text>
    <text class="fx-tick" :x="eq.x + PAD" :y="eq.y + 34">{{ label('eqSub1') }}</text>
    <text class="fx-tick" :x="eq.x + PAD" :y="eq.y + 34 + LINE">{{ label('eqSub2') }}</text>

    <!-- The chain -->
    <path class="fx-curve fx-curve--thin" :d="chain.toInsert" />
    <path class="fx-curve fx-curve--thin" :d="chain.toInsertHead" />
    <path class="fx-curve fx-curve--thin" :d="chain.toEq" />
    <path class="fx-curve fx-curve--thin" :d="chain.toEqHead" />
    <path class="fx-axis" :d="chain.out" />
    <path class="fx-axis" :d="chain.outHead" />
    <text class="fx-axis-label" :x="OUT_END" :y="chainY - 8" text-anchor="end">{{ label('out') }}</text>
    <text class="fx-axis-label" :x="mixLabelX" :y="chainY - 8" text-anchor="middle">{{ label('mix') }}</text>

    <!-- Bypass: the same part with 40 4x 22 at 00 skips the insert -->
    <path class="fx-curve fx-curve--ghost" :d="chain.bypass" />
    <path class="fx-curve fx-curve--ghost" :d="chain.bypassHead" />
    <text class="fx-tick" :x="(insert.x + insert.right) / 2" :y="BYPASS_Y + 12" text-anchor="middle">
      {{ label('bypassNote') }}
    </text>

    <!-- Sends: from the part when bypassed, after the effect when inserted -->
    <path class="fx-curve fx-curve--2 fx-curve--thin" :d="sends.partTap" />
    <path class="fx-curve fx-curve--2 fx-curve--thin" :d="sends.efxTap" />
    <path class="fx-curve fx-curve--2 fx-curve--thin" :d="sends.bus" />
    <g v-for="f in sends.feeds" :key="`feed-${f.key}`">
      <path class="fx-curve fx-curve--2 fx-curve--thin" :d="f.d" />
      <path class="fx-curve fx-curve--2 fx-curve--thin" :d="f.head" />
    </g>
    <circle class="fx-dot fx-dot--2" :cx="part.cx" :cy="part.y + part.h" r="3" />
    <circle class="fx-dot fx-dot--2" :cx="TAP_X" :cy="chainY" r="3" />
    <text class="fx-tick" :x="partTapText.x" :y="partTapText.y1">{{ label('partTap1') }}</text>
    <text class="fx-tick" :x="partTapText.x" :y="partTapText.y2">{{ label('partTap2') }}</text>
    <text class="fx-tick" :x="efxTapText.x" :y="efxTapText.y1">{{ label('efxTap1') }}</text>
    <text class="fx-tick" :x="efxTapText.x" :y="efxTapText.y2">{{ label('efxTap2') }}</text>

    <!-- The three system effects, in parallel -->
    <text class="fx-axis-label" :x="sendsHeadText.x" :y="sendsHeadText.y1">{{ label('sendsHead') }}</text>
    <text class="fx-tick" :x="sendsHeadText.x" :y="sendsHeadText.y2">{{ label('sendsSub1') }}</text>
    <text class="fx-tick" :x="sendsHeadText.x" :y="sendsHeadText.y3">{{ label('sendsSub2') }}</text>
    <g v-for="u in units" :key="`unit-${u.key}`">
      <rect class="fx-block fx-block--2" :x="u.x" :y="u.y" :width="UNIT_W" :height="BLOCK_H" rx="2" />
      <text class="fx-note fx-note--strong" :x="u.x + PAD" :y="u.y + 18">{{ label(u.key) }}</text>
      <text class="fx-tick" :x="u.x + PAD" :y="u.y + 34">{{ label(u.sub) }}</text>
    </g>

    <!-- Returns: wet only, summed into the mix ahead of the EQ -->
    <path v-for="d in sends.drops" :key="`drop-${d.key}`" class="fx-curve fx-curve--2 fx-curve--thin" :d="d.d" />
    <path class="fx-curve fx-curve--2 fx-curve--thin" :d="sends.returnBus" />
    <path class="fx-curve fx-curve--2 fx-curve--thin" :d="sends.returnHead" />
    <circle class="fx-dot" :cx="MIX_X" :cy="chainY" r="3" />
    <circle class="fx-dot" :cx="RETURN_X" :cy="chainY" r="3" />
    <text class="fx-tick" :x="returnsText.x" :y="returnsText.y">{{ label('returns') }}</text>

    <!-- Unit-to-unit sends exist on the wire and stop in the store -->
    <text class="fx-tick" :x="insert.x" :y="NOTE_Y">{{ label('crossNote') }}</text>
  </FigureFrame>
</template>
