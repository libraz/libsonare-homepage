<script setup lang="ts">
/**
 * How each runtime reaches the C++ core, drawn as layers bottom to top.
 *
 * The C ABI is a layer only some paths cross: the Python package calls it
 * through ctypes, while the Embind (WASM) and N-API (Node) bindings call the
 * C++ classes directly and use the C ABI only for some entry points, so their
 * direct pipe passes through a gap in the band. Each CLI sits on the runtime
 * it is built from: the Python CLI on the Python package, the native CLI on C++.
 */
import { computed } from 'vue';
import FigureFrame, { type FigureLegendItem } from './FigureFrame.vue';

const props = defineProps<{
  title?: string;
  caption?: string;
  labels?: Partial<Record<Key, string>>;
}>();

type Key =
  | 'cliLayer'
  | 'bindingLayer'
  | 'abiLayer'
  | 'coreLayer'
  | 'pythonCli'
  | 'nativeCli'
  | 'nodeName'
  | 'cppName'
  | 'core'
  | 'direct'
  | 'viaAbi'
  | 'note';

const DEFAULTS: Record<Key, string> = {
  cliLayer: 'CLI',
  bindingLayer: 'bindings',
  abiLayer: 'C ABI',
  coreLayer: 'core',
  pythonCli: 'Python CLI',
  nativeCli: 'native CLI',
  nodeName: 'Node native',
  cppName: 'C++ API',
  core: 'C++ core: DSP, analysis, mixing, engine',
  direct: 'calls the C++ classes directly',
  viaAbi: 'goes through the C ABI',
  note: 'Every path ends in the same core. A binding translates shapes; it never reimplements DSP.',
};

const label = (key: Key) => props.labels?.[key] ?? DEFAULTS[key];

const legend = computed<FigureLegendItem[]>(() => [
  { series: 1, label: label('direct') },
  { series: 2, label: label('viaAbi') },
]);

const W = 640;
const GUTTER_X = 12;
const X0 = 108;
const X1 = 628;
const COL_GAP = 10;
const COLS = 4;
const COL_W = (X1 - X0 - (COLS - 1) * COL_GAP) / COLS;
const CLI_Y = 22;
const CLI_H = 26;
const BIND_Y = 74;
const BIND_H = 40;
const ABI_Y = 144;
const ABI_H = 26;
const CORE_Y = 200;
const CORE_H = 32;
const GAP_HALF = 6;

const colX = (i: number) => X0 + i * (COL_W + COL_GAP);

const chevronDown = (x: number, y: number) =>
  `M ${x - 3.5} ${y - 4} L ${x} ${y} L ${x + 3.5} ${y - 4}`;
const pipe = (x: number, y1: number, y2: number) => `M ${x} ${y1} V ${y2} ${chevronDown(x, y2)}`;

const geom = computed(() => {
  // direct: pipe straight to the core; abi: pipe into the C ABI band.
  const bindings = [
    { name: 'WASM', mech: 'Embind', direct: true, abi: true },
    { name: label('nodeName'), mech: 'N-API addon', direct: true, abi: true },
    { name: 'Python', mech: 'ctypes', direct: false, abi: true },
    { name: label('cppName'), mech: 'sonare.h', direct: true, abi: false },
  ].map((b, i) => {
    const x = colX(i);
    const both = b.direct && b.abi;
    return {
      ...b,
      x,
      directX: both ? x + COL_W * 0.3 : x + COL_W / 2,
      abiX: both ? x + COL_W * 0.7 : x + COL_W / 2,
    };
  });

  // The band starts right of the leftmost direct pipe, so no stub is left beside it.
  const abiStart = bindings[0].directX + 2 * GAP_HALF;
  const abiEnd = colX(2) + COL_W;
  const cuts = bindings
    .filter((b) => b.direct && b.directX > abiStart && b.directX < abiEnd)
    .map((b) => b.directX);
  // The band label sits right of the last direct pipe that crosses it.
  const abiLabelX = (cuts[cuts.length - 1] + GAP_HALF + abiEnd) / 2;

  const clis = [
    { col: 2, text: label('pythonCli') },
    { col: 3, text: label('nativeCli') },
  ].map((c) => ({ ...c, x: colX(c.col), cx: colX(c.col) + COL_W / 2 }));

  return { bindings, abi: { x: abiStart, w: abiEnd - abiStart }, cuts, abiLabelX, clis };
});

const LAYERS: { key: Key; y: number }[] = [
  { key: 'cliLayer', y: CLI_Y + CLI_H / 2 },
  { key: 'bindingLayer', y: BIND_Y + BIND_H / 2 },
  { key: 'abiLayer', y: ABI_Y + ABI_H / 2 },
  { key: 'coreLayer', y: CORE_Y + CORE_H / 2 },
];
const H = CORE_Y + CORE_H + 30;
</script>

<template>
  <FigureFrame
    :title="props.title"
    :caption="props.caption"
    :view-box="`0 0 ${W} ${H}`"
    :width="W"
    :legend="legend"
  >
    <!-- Layer names in the gutter, top to bottom -->
    <text
      v-for="l in LAYERS"
      :key="l.key"
      class="fx-axis-label"
      :x="GUTTER_X"
      :y="l.y"
      dy="0.35em"
    >
      {{ label(l.key) }}
    </text>

    <!-- CLIs, each on the runtime it is built from -->
    <g v-for="c in geom.clis" :key="`cli-${c.col}`">
      <rect class="fx-block fx-block--3" :x="c.x" :y="CLI_Y" :width="COL_W" :height="CLI_H" rx="3" />
      <text class="fx-value" :x="c.cx" :y="CLI_Y + CLI_H / 2" dy="0.35em" text-anchor="middle">
        {{ c.text }}
      </text>
      <path class="fx-axis" :d="pipe(c.cx, CLI_Y + CLI_H, BIND_Y)" />
    </g>

    <!-- C ABI band; a direct path is knocked through it rather than joined to it -->
    <rect class="fx-block fx-block--2" :x="geom.abi.x" :y="ABI_Y" :width="geom.abi.w" :height="ABI_H" rx="3" />
    <rect
      v-for="(c, i) in geom.cuts"
      :key="`cut-${i}`"
      class="fx-knockout"
      :x="c - GAP_HALF"
      :y="ABI_Y - 1"
      :width="2 * GAP_HALF"
      :height="ABI_H + 2"
    />
    <text class="fx-value" :x="geom.abiLabelX" :y="ABI_Y + ABI_H / 2" dy="0.35em" text-anchor="middle">
      sonare_c*.h
    </text>

    <!-- Bindings and their paths down -->
    <g v-for="b in geom.bindings" :key="b.mech">
      <rect class="fx-block fx-block--muted" :x="b.x" :y="BIND_Y" :width="COL_W" :height="BIND_H" rx="3" />
      <text class="fx-value" :x="b.x + COL_W / 2" :y="BIND_Y + 16" text-anchor="middle">{{ b.name }}</text>
      <text class="fx-tick" :x="b.x + COL_W / 2" :y="BIND_Y + 30" text-anchor="middle">{{ b.mech }}</text>
      <path v-if="b.direct" class="fx-curve fx-curve--thin" :d="pipe(b.directX, BIND_Y + BIND_H, CORE_Y - 1)" />
      <template v-if="b.abi">
        <path class="fx-curve fx-curve--thin fx-curve--2" :d="pipe(b.abiX, BIND_Y + BIND_H, ABI_Y - 1)" />
        <path class="fx-curve fx-curve--thin fx-curve--2" :d="pipe(b.abiX, ABI_Y + ABI_H, CORE_Y - 1)" />
      </template>
    </g>

    <!-- The one core every path ends in -->
    <rect class="fx-block" :x="X0" :y="CORE_Y" :width="X1 - X0" :height="CORE_H" rx="4" />
    <text class="fx-value" :x="(X0 + X1) / 2" :y="CORE_Y + CORE_H / 2" dy="0.35em" text-anchor="middle">
      {{ label('core') }}
    </text>

    <text class="fx-note" :x="X0" :y="H - 10">{{ label('note') }}</text>
  </FigureFrame>
</template>
