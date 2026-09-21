<script setup lang="ts">
/**
 * The GS parameter space as an addressed structure, and what an address promises.
 *
 * Top: one DT1 write is a Roland frame whose three address bytes say where the
 * data lands. The high byte picks a map (system, user, patch, drum setup), the
 * mid byte a block inside it — for `40` that is the system, effect, EQ, EFX
 * and per-part blocks, with the part or unit number carried in the nibble —
 * and the low byte the parameter. Bottom: every address carries one of four
 * levels, drawn as how far a written byte travels: decoded, held, heard.
 * AUDIBLE reaches the render, STATE stops in the store, ACCEPT and IGNORE are
 * decoded and dropped; IGNORE is a declared boundary with a reason on the row.
 */
import { computed } from 'vue';
import FigureFrame, { type FigureLegendItem } from './FigureFrame.vue';

const props = defineProps<{
  title?: string;
  caption?: string;
  labels?: Partial<Record<Key, string>>;
}>();

const FRAME_KEYS = [
  'byF0',
  'by41',
  'byDev',
  'by42',
  'by12',
  'byHi',
  'byMid',
  'byLo',
  'byData',
  'bySum',
  'byF7',
] as const;

const HI_KEYS = ['hi00', 'hi20', 'hi40', 'hi41', 'hi50'] as const;
const MID_KEYS = ['m00', 'm01', 'm02', 'm03', 'm1x', 'm2x', 'm3u', 'm4x'] as const;
const LEVEL_KEYS = ['audible', 'state', 'accept', 'ignore'] as const;

type FrameKey = (typeof FRAME_KEYS)[number];
type HiKey = (typeof HI_KEYS)[number];
type MidKey = (typeof MID_KEYS)[number];
type LevelKey = (typeof LEVEL_KEYS)[number];

type Key =
  | FrameKey
  | 'grpHead'
  | 'grpAddr'
  | 'grpTail'
  | 'hiHead'
  | `${HiKey}Byte`
  | `${HiKey}Name`
  | `${HiKey}Sub1`
  | `${HiKey}Sub2`
  | 'midHead'
  | `${MidKey}Byte`
  | `${MidKey}Name`
  | `${MidKey}Sub`
  | 'loNote'
  | 'levelHead'
  | 'stDecoded'
  | 'stHeld'
  | 'stHeard'
  | `${LevelKey}Name`
  | `${LevelKey}Addr`
  | `${LevelKey}What`
  | `${LevelKey}Note`
  | 'legendReach'
  | 'legendStop'
  | 'legendIgnore'
  | 'caption';

const DEFAULTS: Record<Key, string> = {
  byF0: 'F0',
  by41: '41',
  byDev: 'dev',
  by42: '42',
  by12: '12',
  byHi: 'hi',
  byMid: 'mid',
  byLo: 'lo',
  byData: 'data…',
  bySum: 'sum',
  byF7: 'F7',
  grpHead: 'Roland · GS · DT1',
  grpAddr: 'address',
  grpTail: 'data · checksum',
  hiHead: 'hi byte — which map',
  hi00Byte: '00',
  hi00Name: 'System',
  hi00Sub1: 'mode set',
  hi00Sub2: '',
  hi20Byte: '20–27',
  hi20Name: 'User · stored',
  hi20Sub1: '21 drums: heard',
  hi20Sub2: '20, 22–27 ignored',
  hi40Byte: '40',
  hi40Name: 'Patch',
  hi40Sub1: 'system · effects · EQ · EFX · parts',
  hi40Sub2: 'the mid byte picks the block',
  hi41Byte: '41',
  hi41Name: 'Drum setup',
  hi41Sub1: 'map m, note rr',
  hi41Sub2: '',
  hi50Byte: '50·51',
  hi50Name: 'Other group',
  hi50Sub1: 'one port only',
  hi50Sub2: '',
  midHead: 'mid byte inside 40 — which block',
  m00Byte: '00',
  m00Name: 'System',
  m00Sub: 'tune · volume · pan',
  m01Byte: '01',
  m01Name: 'Patch · effects',
  m01Sub: 'reverb · chorus · delay',
  m02Byte: '02',
  m02Name: 'Master EQ',
  m02Sub: 'low & high shelf',
  m03Byte: '03',
  m03Name: 'EFX',
  m03Sub: 'type · 20 params · sends',
  m1xByte: '1x',
  m1xName: 'Part x',
  m1xSub: 'x = part; 0 is part 10',
  m2xByte: '2x',
  m2xName: 'Controllers',
  m2xSub: '6 sources × 11 targets',
  m3uByte: '3u',
  m3uName: 'Insertion unit u',
  m3uSub: 'extension: units 0–15',
  m4xByte: '4x',
  m4xName: 'Part x routing',
  m4xSub: 'EQ switch · EFX assign',
  loNote: 'lo byte — the parameter inside the block; under 41 it is the drum note',
  levelHead: 'level — how far a write travels',
  stDecoded: 'decoded',
  stHeld: 'held',
  stHeard: 'heard',
  audibleName: 'AUDIBLE',
  audibleAddr: '40 01 33',
  audibleWhat: 'reverb level',
  audibleNote: 'changing the byte changes the render',
  stateName: 'STATE',
  stateAddr: '40 01 32',
  stateWhat: 'reverb pre-LPF',
  stateNote: 'held and read back; the bus takes no such control',
  acceptName: 'ACCEPT',
  acceptAddr: '40 01 00',
  acceptWhat: 'patch name',
  acceptNote: 'decoded, then dropped: nothing to display it on',
  ignoreName: 'IGNORE',
  ignoreAddr: '40 4x 21',
  ignoreWhat: 'output assign',
  ignoreNote: 'decoded, then dropped: one output pair, and the row says so',
  legendReach: 'how far the byte travels',
  legendStop: 'not reached',
  legendIgnore: 'declared absent, reason on the row',
  caption:
    'A level is a property of the address. STATE marks a value the engine holds but no effect reads — the insert has no such control, which is a fact about the effect and not a feature still to come.',
};

const label = (key: Key) => props.labels?.[key] ?? DEFAULTS[key];

const captionText = computed(() => props.caption ?? label('caption'));

const legend = computed<FigureLegendItem[]>(() => [
  { series: 1, label: label('legendReach') },
  { series: 0, label: label('legendStop') },
  { shape: 'dashed', label: label('legendIgnore') },
]);

// Layout. Text budgets at PAD inset, mono ~0.6em: a block name (10.5px) holds
// about (w - 2 * PAD) / 10.5 CJK glyphs, a sub line (8.5px) about
// (w - 2 * PAD) / 8.5. Hi blocks 88 → 6 / 8, 112 → 8 / 10, 192 → 16 / 20;
// mid cells 144 with a 30px byte column → 9 name / 14 sub; level notes 294 → 34.
const W = 640;
const MARGIN = 16;
const PAD = 10;
const LINE = 12;
const FRAME_TOP = 22;
const CELL_W = 46;
const CELL_H = 20;
const CELL_GAP = 4;
const HI_HEAD_Y = 82;
const HI_TOP = 90;
const BLOCK_H = 52;
const HI_GAP = 8;
const HI_WIDTHS: Record<HiKey, number> = { hi00: 88, hi20: 112, hi40: 192, hi41: 96, hi50: 88 };
const LANE_TOP = 162;
const LANE_PAD = 7;
const MID_W = 144;
const MID_H = 40;
const MID_GAP = 6;
const MID_COLS = 4;
const BYTE_COL = 30;
const LO_NOTE_Y = 288;
const LEVEL_HEAD_Y = 312;
const LEVEL_TOP = 326;
const ROW = 26;
const NAME_X = MARGIN;
const PATH_X0 = 96;
const STATION_X = [136, 216, 296] as const;
const EXAMPLE_X = 330;
const ADDR_COL = 58;

const arrowDown = (x: number, y: number) => `M ${x - 4} ${y - 6} L ${x} ${y} L ${x + 4} ${y - 6}`;

// The frame: header bytes, the three address bytes, then data and checksum.
const ADDRESS_CELLS: readonly FrameKey[] = ['byHi', 'byMid', 'byLo'];

const frameCells = computed(() =>
  FRAME_KEYS.map((key, i) => ({
    key,
    x: MARGIN + i * (CELL_W + CELL_GAP),
    cx: MARGIN + i * (CELL_W + CELL_GAP) + CELL_W / 2,
    cls: ADDRESS_CELLS.includes(key) ? 'fx-block' : 'fx-block fx-block--muted',
  })),
);

const FRAME_GROUPS: { key: Key; from: number; to: number }[] = [
  { key: 'grpHead', from: 0, to: 4 },
  { key: 'grpAddr', from: 5, to: 7 },
  { key: 'grpTail', from: 8, to: 10 },
];

const frameGroups = computed(() =>
  FRAME_GROUPS.map((g) => {
    const x1 = frameCells.value[g.from].x;
    const x2 = frameCells.value[g.to].x + CELL_W;
    return { key: g.key, x1, x2, cx: (x1 + x2) / 2 };
  }),
);

const frameRuleY = FRAME_TOP + CELL_H + 5;
const frameLabelY = frameRuleY + 12;

// Hi byte: which map. The `40` block is the one the lane below expands.
const HI_CLASS: Record<HiKey, string> = {
  hi00: 'fx-block fx-block--muted',
  hi20: 'fx-block fx-block--muted',
  hi40: 'fx-block',
  hi41: 'fx-block fx-block--muted',
  hi50: 'fx-block fx-block--outline fx-grid--dashed',
};

const hiBlocks = computed(() => {
  let x = MARGIN;
  return HI_KEYS.map((key) => {
    const w = HI_WIDTHS[key];
    const block = {
      key,
      x,
      w,
      cx: x + w / 2,
      cls: HI_CLASS[key],
      byte: `${key}Byte` as Key,
      name: `${key}Name` as Key,
      subs: [`${key}Sub1`, `${key}Sub2`].filter((s) => label(s as Key) !== '') as Key[],
    };
    x += w + HI_GAP;
    return block;
  });
});

const hi40 = computed(() => hiBlocks.value.find((b) => b.key === 'hi40') ?? hiBlocks.value[2]);

// Mid byte inside 40: a lane of cells, one per block.
const lane = {
  x: MARGIN,
  y: LANE_TOP,
  w: W - 2 * MARGIN,
  h: 2 * LANE_PAD + 2 * MID_H + MID_GAP,
};

const midCells = computed(() =>
  MID_KEYS.map((key, i) => ({
    key,
    x: lane.x + LANE_PAD + (i % MID_COLS) * (MID_W + MID_GAP),
    y: lane.y + LANE_PAD + Math.floor(i / MID_COLS) * (MID_H + MID_GAP),
    byte: `${key}Byte` as Key,
    name: `${key}Name` as Key,
    sub: `${key}Sub` as Key,
  })),
);

const laneLeader = computed(() => ({
  x: hi40.value.cx,
  y1: HI_TOP + BLOCK_H + 1,
  y2: LANE_TOP - 1,
}));

// Levels: how far a written byte travels. `reach` is the last station it hits.
const LEVEL_REACH: Record<LevelKey, number> = { audible: 2, state: 1, accept: 0, ignore: 0 };

const stations = computed(() =>
  (['stDecoded', 'stHeld', 'stHeard'] as const).map((key, i) => ({ key, x: STATION_X[i] })),
);

const levelRows = computed(() =>
  LEVEL_KEYS.map((key, i) => {
    const y = LEVEL_TOP + i * ROW;
    const reach = LEVEL_REACH[key];
    const reachX = STATION_X[reach];
    return {
      key,
      y,
      textY: y + 3.5,
      noteY: y + 14,
      name: `${key}Name` as Key,
      addr: `${key}Addr` as Key,
      what: `${key}What` as Key,
      note: `${key}Note` as Key,
      solid: `M ${PATH_X0} ${y} H ${reachX}`,
      rest: reach < 2 ? `M ${reachX} ${y} H ${STATION_X[2]}` : '',
      restCls: key === 'ignore' ? 'fx-guide' : 'fx-curve fx-curve--ghost',
      dots: STATION_X.map((x, s) => ({ x, cls: s <= reach ? 'fx-dot' : 'fx-dot fx-dot--hollow' })),
    };
  }),
);

const H = LEVEL_TOP + (LEVEL_KEYS.length - 1) * ROW + 20;
</script>

<template>
  <FigureFrame
    :title="props.title"
    :caption="captionText"
    :view-box="`0 0 ${W} ${H}`"
    :width="W"
    :legend="legend"
  >
    <!-- One DT1 write: header, address, data -->
    <g v-for="c in frameCells" :key="`cell-${c.key}`">
      <rect :class="c.cls" :x="c.x" :y="FRAME_TOP" :width="CELL_W" :height="CELL_H" rx="2" />
      <text class="fx-value" :x="c.cx" :y="FRAME_TOP + 14" text-anchor="middle">{{ label(c.key) }}</text>
    </g>
    <g v-for="g in frameGroups" :key="`grp-${g.key}`">
      <line class="fx-leader" :x1="g.x1" :x2="g.x2" :y1="frameRuleY" :y2="frameRuleY" />
      <text class="fx-tick" :x="g.cx" :y="frameLabelY" text-anchor="middle">{{ label(g.key) }}</text>
    </g>

    <!-- Hi byte: which map -->
    <text class="fx-axis-label" :x="MARGIN" :y="HI_HEAD_Y">{{ label('hiHead') }}</text>
    <g v-for="b in hiBlocks" :key="`hi-${b.key}`">
      <rect :class="b.cls" :x="b.x" :y="HI_TOP" :width="b.w" :height="BLOCK_H" rx="2" />
      <text class="fx-value" :x="b.x + PAD" :y="HI_TOP + 14">{{ label(b.byte) }}</text>
      <text class="fx-note fx-note--strong" :x="b.x + PAD" :y="HI_TOP + 27">{{ label(b.name) }}</text>
      <text v-for="(sub, j) in b.subs" :key="sub" class="fx-tick" :x="b.x + PAD" :y="HI_TOP + 39 + j * (LINE - 2)">
        {{ label(sub) }}
      </text>
    </g>

    <!-- Mid byte inside 40: which block -->
    <line class="fx-leader" :x1="laneLeader.x" :x2="laneLeader.x" :y1="laneLeader.y1" :y2="laneLeader.y2" />
    <path class="fx-leader" :d="arrowDown(laneLeader.x, laneLeader.y2)" />
    <rect class="fx-lane" :x="lane.x" :y="lane.y" :width="lane.w" :height="lane.h" rx="2" />
    <text class="fx-axis-label" :x="MARGIN" :y="LANE_TOP - 6">{{ label('midHead') }}</text>
    <g v-for="c in midCells" :key="`mid-${c.key}`">
      <rect class="fx-block fx-block--outline" :x="c.x" :y="c.y" :width="MID_W" :height="MID_H" rx="2" />
      <text class="fx-value fx-value--1" :x="c.x + PAD" :y="c.y + 16">{{ label(c.byte) }}</text>
      <text class="fx-note fx-note--strong" :x="c.x + PAD + BYTE_COL" :y="c.y + 16">{{ label(c.name) }}</text>
      <text class="fx-tick" :x="c.x + PAD" :y="c.y + 31">{{ label(c.sub) }}</text>
    </g>
    <text class="fx-note" :x="MARGIN" :y="LO_NOTE_Y">{{ label('loNote') }}</text>

    <!-- Levels: how far a written byte travels -->
    <text class="fx-axis-label" :x="MARGIN" :y="LEVEL_HEAD_Y">{{ label('levelHead') }}</text>
    <text
      v-for="s in stations"
      :key="`st-${s.key}`"
      class="fx-axis-label"
      :x="s.x"
      :y="LEVEL_HEAD_Y"
      text-anchor="middle"
    >
      {{ label(s.key) }}
    </text>
    <g v-for="r in levelRows" :key="`lv-${r.key}`">
      <text class="fx-value" :x="NAME_X" :y="r.textY">{{ label(r.name) }}</text>
      <path class="fx-curve fx-curve--thin" :d="r.solid" />
      <path v-if="r.rest" :class="r.restCls" :d="r.rest" />
      <circle v-for="d in r.dots" :key="`${r.key}-${d.x}`" :class="d.cls" :cx="d.x" :cy="r.y" r="3" />
      <text class="fx-value" :x="EXAMPLE_X" :y="r.textY">{{ label(r.addr) }}</text>
      <text class="fx-tick" :x="EXAMPLE_X + ADDR_COL" :y="r.textY">{{ label(r.what) }}</text>
      <text class="fx-tick" :x="EXAMPLE_X" :y="r.noteY">{{ label(r.note) }}</text>
    </g>
  </FigureFrame>
</template>
