<script setup lang="ts">
/**
 * One NativeSynth voice, and where the mod matrix reaches into it.
 *
 * Top: the chain a note flows through — one oscillator (unison copies of a
 * single waveform, noise among them), a filter slot that takes one of four
 * models, the amp envelope, and then a body resonance stage that most synth
 * diagrams do not have. Bottom: the mod matrix, twelve sources routed to
 * twelve destinations, at most eight at once. Each routing arrow lands on the
 * stage its destination actually reaches, which is the point of the figure:
 * the body stage is not a destination, and one destination is another source.
 */
import { computed } from 'vue';
import FigureFrame, { type FigureLegendItem } from './FigureFrame.vue';

const props = defineProps<{
  title?: string;
  caption?: string;
  labels?: Partial<Record<Key, string>>;
}>();

/** Enum members from instrument_types.d.ts; identity labels so a page may gloss them. */
const SOURCE_IDS = [
  'amp-env',
  'filter-env',
  'lfo1',
  'lfo2',
  'velocity',
  'key-track',
  'mod-wheel',
  'random',
  'breath',
  'aftertouch',
  'expression-cc',
  'pitch-bend',
] as const;

const DESTINATION_IDS = [
  'pitch-cents',
  'vibrato-depth-cents',
  'excitation-force',
  'excitation-position',
  'excitation-brightness',
  'spectrum-morph',
  'cutoff-cents',
  'resonance-q',
  'filter-env-depth',
  'amp-gain',
  'pan-units',
  'lfo1-rate-scale',
] as const;

const MAX_ROUTINGS = 8;

type SourceId = (typeof SOURCE_IDS)[number];
type DestinationId = (typeof DESTINATION_IDS)[number];

type Key =
  | SourceId
  | DestinationId
  | 'osc'
  | 'oscSub1'
  | 'oscSub2'
  | 'oscSub3'
  | 'oscSub4'
  | 'filter'
  | 'filterSub1'
  | 'filterSub2'
  | 'filterSub3'
  | 'filterSub4'
  | 'amp'
  | 'ampSub1'
  | 'body'
  | 'bodySub1'
  | 'bodySub2'
  | 'bodySub3'
  | 'bodySub4'
  | 'out'
  | 'matrix'
  | 'matrixSub'
  | 'sources'
  | 'noDest'
  | 'loopNote'
  | 'legendChain'
  | 'legendBody'
  | 'legendRoute';

const identity = <T extends string>(keys: readonly T[]): Record<T, string> => {
  const out = {} as Record<T, string>;
  for (const key of keys) out[key] = key;
  return out;
};

const DEFAULTS: Record<Key, string> = {
  ...identity(SOURCE_IDS),
  ...identity(DESTINATION_IDS),
  osc: 'Oscillator',
  oscSub1: 'one waveform:',
  oscSub2: 'sine saw square',
  oscSub3: 'triangle noise',
  oscSub4: 'unison 1–7 · detune',
  filter: 'Filter',
  filterSub1: 'one of 4 models:',
  filterSub2: 'svf · moog-ladder',
  filterSub3: 'diode-ladder',
  filterSub4: 'sallen-key',
  amp: 'Amplifier',
  ampSub1: 'ADSR envelope',
  body: 'Body resonance',
  bodySub1: 'guitar violin',
  bodySub2: 'wood-tube brass-bell',
  bodySub3: 'vocal · none',
  bodySub4: 'bodyMix 0–1',
  out: 'out',
  matrix: 'Modulation matrix',
  matrixSub: `${SOURCE_IDS.length} sources × ${DESTINATION_IDS.length} destinations · at most ${MAX_ROUTINGS} routings at once`,
  sources: 'sources',
  noDest: 'not a destination',
  loopNote: 'lands on a source',
  legendChain: 'voice chain',
  legendBody: 'body resonance, after the amp',
  legendRoute: `mod routing (max ${MAX_ROUTINGS} at once)`,
};

const label = (key: Key) => props.labels?.[key] ?? DEFAULTS[key];

const legend = computed<FigureLegendItem[]>(() => [
  { series: 1, shape: 'block', label: label('legendChain') },
  { series: 3, shape: 'block', label: label('legendBody') },
  { series: 2, label: label('legendRoute') },
]);

// Layout. Every box is BLOCK_W wide; a label line inside one has
// BLOCK_W - 2 * PAD px, about 12 CJK characters at the tick size.
const W = 640;
const H = 292;
const MARGIN = 16;
const BLOCK_W = 128;
const BLOCK_H = 80;
const GAP = 18;
const PAD = 10;
const TOP = 34;
const LINE = 12;
const OUT_END = 604;
const MATRIX_TOP = 200;
const MATRIX_H = 80;
const UNISON_GHOSTS = 2;
const GHOST_STEP = 5;

const STAGE_KEYS = ['osc', 'filter', 'amp', 'body'] as const;
type Stage = (typeof STAGE_KEYS)[number];

const STAGE_SUBS: Record<Stage, Key[]> = {
  osc: ['oscSub1', 'oscSub2', 'oscSub3', 'oscSub4'],
  filter: ['filterSub1', 'filterSub2', 'filterSub3', 'filterSub4'],
  amp: ['ampSub1'],
  body: ['bodySub1', 'bodySub2', 'bodySub3', 'bodySub4'],
};

/** Which stage each destination reaches; 'out' is the pan after the body, 'self' the matrix. */
const ROUTES: { target: Stage | 'out' | 'self'; ids: DestinationId[] }[] = [
  {
    target: 'osc',
    ids: [
      'pitch-cents',
      'vibrato-depth-cents',
      'excitation-force',
      'excitation-position',
      'excitation-brightness',
      'spectrum-morph',
    ],
  },
  { target: 'filter', ids: ['cutoff-cents', 'resonance-q', 'filter-env-depth'] },
  { target: 'amp', ids: ['amp-gain'] },
  { target: 'out', ids: ['pan-units'] },
  { target: 'self', ids: ['lfo1-rate-scale'] },
];

const chainY = TOP + BLOCK_H / 2;

const arrowUp = (x: number, y: number) => `M ${x - 4} ${y + 6} L ${x} ${y} L ${x + 4} ${y + 6}`;
const arrowDown = (x: number, y: number) => `M ${x - 4} ${y - 6} L ${x} ${y} L ${x + 4} ${y - 6}`;
const arrowRight = (x: number, y: number) =>
  `M ${x - 6} ${y - 4} L ${x} ${y} L ${x + 6 - 6} ${y + 4}`;

const stages = computed(() =>
  STAGE_KEYS.map((key, i) => {
    const x = MARGIN + i * (BLOCK_W + GAP);
    return {
      key,
      x,
      right: x + BLOCK_W,
      bottom: TOP + BLOCK_H,
      titleY: TOP + 18,
      subs: STAGE_SUBS[key].map((sub, j) => ({ key: sub, y: TOP + 34 + j * LINE })),
    };
  }),
);

const chainRight = computed(() => stages.value[stages.value.length - 1].right);

const links = computed(() =>
  stages.value.slice(0, -1).map((s) => ({ x1: s.right + 2, x2: s.x + BLOCK_W + GAP - 2 })),
);

const matrix = { x: MARGIN, y: MATRIX_TOP, w: OUT_END - MARGIN, h: MATRIX_H };

const SOURCE_COLS = 6;
const SOURCE_X0 = 72;
const SOURCE_COL_W = 84;

const sourceCells = computed(() =>
  SOURCE_IDS.map((id, i) => ({
    id,
    x: matrix.x + SOURCE_X0 + (i % SOURCE_COLS) * SOURCE_COL_W,
    y: matrix.y + 54 + Math.floor(i / SOURCE_COLS) * 14,
  })),
);

/** Routing arrows rise from the matrix to the stage they reach; labels stack beside each. */
const routes = computed(() =>
  ROUTES.flatMap((r) => {
    if (r.target === 'self') return [];
    const stage = stages.value.find((s) => s.key === r.target);
    const x = stage ? stage.x + 12 : OUT_END - 10;
    const top = stage ? stage.bottom + 2 : chainY + 2;
    return [
      {
        target: r.target,
        x,
        top,
        labelX: stage ? x + 6 : x - 6,
        anchor: stage ? 'start' : 'end',
        labels: r.ids.map((id, i) => ({
          id,
          y: stage ? stage.bottom + 18 + i * LINE : MATRIX_TOP - 8 - i * LINE,
        })),
      },
    ];
  }),
);

// The self-routing loop sits under the amp column, clear of its single label.
const loop = computed(() => {
  const amp = stages.value[2];
  const x0 = amp.x + 64;
  const x1 = x0 + 22;
  const top = MATRIX_TOP - 22;
  return {
    d: `M ${x0} ${MATRIX_TOP} V ${top} H ${x1} V ${MATRIX_TOP}`,
    head: arrowDown(x1, MATRIX_TOP),
    cx: (x0 + x1) / 2,
    nameY: top - 18,
    noteY: top - 7,
  };
});

const noDest = computed(() => {
  const body = stages.value[3];
  return { x: body.x + 18, y: body.bottom + 18 };
});
</script>

<template>
  <FigureFrame
    :title="props.title"
    :caption="props.caption"
    :view-box="`0 0 ${W} ${H}`"
    :width="W"
    :legend="legend"
  >
    <!-- Unison: the same oscillator, stacked -->
    <rect
      v-for="g in UNISON_GHOSTS"
      :key="`ghost-${g}`"
      class="fx-block fx-block--outline"
      :x="stages[0].x + g * GHOST_STEP"
      :y="TOP - g * GHOST_STEP"
      :width="BLOCK_W"
      :height="BLOCK_H"
      rx="2"
    />
    <rect class="fx-plate" :x="stages[0].x" :y="TOP" :width="BLOCK_W" :height="BLOCK_H" rx="2" />

    <!-- Voice chain -->
    <g v-for="s in stages" :key="`stage-${s.key}`">
      <rect
        :class="s.key === 'body' ? 'fx-block fx-block--3' : 'fx-block'"
        :x="s.x"
        :y="TOP"
        :width="BLOCK_W"
        :height="BLOCK_H"
        rx="2"
      />
      <text class="fx-note fx-note--strong" :x="s.x + PAD" :y="s.titleY">{{ label(s.key) }}</text>
      <text v-for="sub in s.subs" :key="sub.key" class="fx-tick" :x="s.x + PAD" :y="sub.y">
        {{ label(sub.key) }}
      </text>
    </g>

    <path v-for="(l, i) in links" :key="`link-${i}`" class="fx-axis" :d="`M ${l.x1} ${chainY} L ${l.x2} ${chainY}`" />
    <path v-for="(l, i) in links" :key="`head-${i}`" class="fx-axis" :d="arrowRight(l.x2, chainY)" />
    <path class="fx-axis" :d="`M ${chainRight + 2} ${chainY} L ${OUT_END} ${chainY}`" />
    <path class="fx-axis" :d="arrowRight(OUT_END, chainY)" />
    <text class="fx-axis-label" :x="OUT_END" :y="chainY - 8" text-anchor="end">{{ label('out') }}</text>

    <!-- Modulation matrix -->
    <rect class="fx-block fx-block--2" :x="matrix.x" :y="matrix.y" :width="matrix.w" :height="matrix.h" rx="2" />
    <text class="fx-note fx-note--strong" :x="matrix.x + PAD" :y="matrix.y + 18">{{ label('matrix') }}</text>
    <text class="fx-tick" :x="matrix.x + PAD" :y="matrix.y + 32">{{ label('matrixSub') }}</text>
    <text class="fx-axis-label" :x="matrix.x + PAD" :y="matrix.y + 54">{{ label('sources') }}</text>
    <text v-for="c in sourceCells" :key="`src-${c.id}`" class="fx-tick" :x="c.x" :y="c.y">
      {{ label(c.id) }}
    </text>

    <!-- Routings, landing where their destination lives -->
    <g v-for="r in routes" :key="`route-${r.target}`">
      <path class="fx-curve fx-curve--2 fx-curve--thin" :d="`M ${r.x} ${MATRIX_TOP} L ${r.x} ${r.top}`" />
      <path class="fx-curve fx-curve--2 fx-curve--thin" :d="arrowUp(r.x, r.top)" />
      <text
        v-for="d in r.labels"
        :key="`dest-${d.id}`"
        class="fx-value fx-value--2"
        :x="r.labelX"
        :y="d.y"
        :text-anchor="r.anchor"
      >
        {{ label(d.id) }}
      </text>
    </g>

    <!-- One destination is a source: the loop returns to the matrix -->
    <path class="fx-curve fx-curve--2 fx-curve--thin" :d="loop.d" />
    <path class="fx-curve fx-curve--2 fx-curve--thin" :d="loop.head" />
    <text class="fx-value fx-value--2" :x="loop.cx" :y="loop.nameY" text-anchor="middle">
      {{ label('lfo1-rate-scale') }}
    </text>
    <text class="fx-tick" :x="loop.cx" :y="loop.noteY" text-anchor="middle">{{ label('loopNote') }}</text>

    <!-- The body stage is reached by nothing -->
    <text class="fx-note" :x="noDest.x" :y="noDest.y">{{ label('noDest') }}</text>
  </FigureFrame>
</template>
