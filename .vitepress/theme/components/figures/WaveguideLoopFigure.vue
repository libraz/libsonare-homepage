<script setup lang="ts">
/**
 * The loop every waveguide voice is built on, and the one slot that differs.
 *
 * There is no oscillator: an exciter injects energy into a delay line, the
 * wave reflects at the far end through a lossy lowpass and comes back to meet
 * the exciter again, and the length of that round trip is the pitch. The
 * output is a tap at the reflection point, outside the loop. Bowed string,
 * reed, brass and flute all share this shape and the same two loss knobs; what
 * each swaps in is the exciter — a friction table, a pressure valve, a resonant
 * lip, an air jet — so the cards under the loop name the exciter and the
 * parameter that drives it, and nothing else changes between them.
 */
import { computed } from 'vue';
import FigureFrame, { type FigureLegendItem } from './FigureFrame.vue';

const props = defineProps<{
  title?: string;
  caption?: string;
  labels?: Partial<Record<Key, string>>;
}>();

/** Engine modes from SYNTH_ENGINE_MODES; identity labels so a page may gloss them. */
const VOICE_IDS = ['bowed-string', 'reed', 'brass', 'flute'] as const;

/** Patch parameter names as the voice cores declare them. */
const PARAM_IDS = [
  'bow_position',
  'bow_force',
  'breath_pressure',
  'reed_stiffness',
  'lip_tension',
  'jet_ratio',
  'brightness',
  'damping',
] as const;

type VoiceId = (typeof VOICE_IDS)[number];
type ParamId = (typeof PARAM_IDS)[number];

type Key =
  | VoiceId
  | ParamId
  | 'exciter'
  | 'exciterSub1'
  | 'exciterSub2'
  | 'delay'
  | 'delaySub1'
  | 'delaySub2'
  | 'loss'
  | 'lossSub1'
  | 'radiation'
  | 'radiationSub1'
  | 'radiationSub2'
  | 'out'
  | 'inject'
  | 'reflect'
  | 'returning'
  | 'roundTrip'
  | 'slotHeader'
  | 'mechBow'
  | 'mechReed'
  | 'mechLip'
  | 'mechJet'
  | 'struckNote'
  | 'legendLoop'
  | 'legendSlot'
  | 'legendTap';

const identity = <T extends string>(keys: readonly T[]): Record<T, string> => {
  const out = {} as Record<T, string>;
  for (const key of keys) out[key] = key;
  return out;
};

const DEFAULTS: Record<Key, string> = {
  ...identity(VOICE_IDS),
  ...identity(PARAM_IDS),
  exciter: 'Exciter',
  exciterSub1: 'valve or friction',
  exciterSub2: 'swapped per voice',
  delay: 'Delay line',
  delaySub1: 'the travelling wave',
  delaySub2: 'no oscillator — length is pitch',
  loss: 'Loss filter',
  lossSub1: 'lowpass × gain per round trip',
  radiation: 'Radiation',
  radiationSub1: 'what is heard',
  radiationSub2: 'shared body resonance',
  out: 'out',
  inject: 'injects',
  reflect: 'reflects back',
  returning: 'returning wave',
  roundTrip: 'round trip = sample rate ÷ f0',
  slotHeader: 'exciter per voice — the only stage that changes',
  mechBow: 'stick–slip bow friction',
  mechReed: 'memoryless reed valve',
  mechLip: 'resonant lip valve',
  mechJet: 'air jet, its own delay',
  struckNote: 'piano · plucked-string: the exciter strikes once, then the loop rings down',
  legendLoop: 'the loop, shared by every voice',
  legendSlot: 'exciter slot, swapped per voice',
  legendTap: 'output tap, outside the loop',
};

const label = (key: Key) => props.labels?.[key] ?? DEFAULTS[key];

const legend = computed<FigureLegendItem[]>(() => [
  { series: 1, label: label('legendLoop') },
  { series: 3, shape: 'block', label: label('legendSlot') },
  { series: 0, label: label('legendTap') },
]);

// Layout. Text budgets at PAD inset: a title line (10.5px) holds about
// (w - 2 * PAD) / 10.5 CJK glyphs, a sub line (8.5px) about (w - 2 * PAD) / 8.5.
// Exciter / radiation 132 → 10 title / 13 sub; delay 220 → 19 / 23;
// loss 184 → 15 / 19; each card 146 → 12 / 14; round-trip plate 192 → 18.
const W = 640;
const MARGIN = 16;
const PAD = 10;
const LINE = 12;
const TOP = 24;
const BLOCK_H = 52;
const EXC_W = 132;
const DELAY_W = 220;
const LOSS_W = 184;
const RAD_W = 132;
const GAP = 44;
const NODE_GAP = 22;
const OUT_END = 612;
const DIM_PLATE_W = 192;
const ROW_GAP = 30;
const CARD_GAP = 8;
const CARD_H = 64;
const GHOSTS = 2;
const GHOST_STEP = 5;

const chainY = TOP + BLOCK_H / 2;

const arrowRight = (x: number, y: number) => `M ${x - 6} ${y - 4} L ${x} ${y} L ${x - 6} ${y + 4}`;
const arrowLeft = (x: number, y: number) => `M ${x + 6} ${y - 4} L ${x} ${y} L ${x + 6} ${y + 4}`;
const arrowUp = (x: number, y: number) => `M ${x - 4} ${y + 6} L ${x} ${y} L ${x + 4} ${y + 6}`;

const exciter = { x: MARGIN, y: TOP, w: EXC_W, h: BLOCK_H, right: MARGIN + EXC_W };
const delay = {
  x: exciter.right + GAP,
  y: TOP,
  w: DELAY_W,
  h: BLOCK_H,
  right: exciter.right + GAP + DELAY_W,
};
const nodeX = delay.right + NODE_GAP;
const radiation = {
  x: nodeX + NODE_GAP,
  y: TOP,
  w: RAD_W,
  h: BLOCK_H,
  right: nodeX + NODE_GAP + RAD_W,
};

// Return row: the reflection travels back under the delay line through the loss filter.
const returnY = TOP + BLOCK_H + ROW_GAP + BLOCK_H / 2;
const loss = {
  x: delay.x + (DELAY_W - LOSS_W) / 2,
  y: returnY - BLOCK_H / 2,
  w: LOSS_W,
  h: BLOCK_H,
  right: delay.x + (DELAY_W - LOSS_W) / 2 + LOSS_W,
};
const returnX = exciter.x + EXC_W / 2;

// Round-trip dimension between the two rows, spanning the delay line.
const dimY = TOP + BLOCK_H + ROW_GAP / 2 - 2;

const loopPath = computed(() => ({
  inject: `M ${exciter.right + 2} ${chainY} L ${delay.x - 2} ${chainY}`,
  injectHead: arrowRight(delay.x - 2, chainY),
  toNode: `M ${delay.right + 2} ${chainY} L ${nodeX} ${chainY}`,
  down: `M ${nodeX} ${chainY} V ${returnY} H ${loss.right + 2}`,
  downHead: arrowLeft(loss.right + 2, returnY),
  back: `M ${loss.x - 2} ${returnY} H ${returnX} V ${exciter.y + exciter.h + 2}`,
  backHead: arrowUp(returnX, exciter.y + exciter.h + 2),
  tap: `M ${nodeX} ${chainY} L ${radiation.x - 2} ${chainY}`,
  tapHead: arrowRight(radiation.x - 2, chainY),
  out: `M ${radiation.right + 2} ${chainY} L ${OUT_END} ${chainY}`,
  outHead: arrowRight(OUT_END, chainY),
}));

const stages = computed(() => [
  { key: 'delay' as const, box: delay, cls: 'fx-block', subs: ['delaySub1', 'delaySub2'] as Key[] },
  { key: 'loss' as const, box: loss, cls: 'fx-block', subs: ['lossSub1'] as Key[] },
  {
    key: 'radiation' as const,
    box: radiation,
    cls: 'fx-block fx-block--muted',
    subs: ['radiationSub1', 'radiationSub2'] as Key[],
  },
]);

// Exciter cards: one per sustained voice, equal width, the driving parameters stacked.
const CARDS: { id: VoiceId; mech: Key; params: ParamId[] }[] = [
  { id: 'bowed-string', mech: 'mechBow', params: ['bow_position', 'bow_force'] },
  { id: 'reed', mech: 'mechReed', params: ['breath_pressure', 'reed_stiffness'] },
  { id: 'brass', mech: 'mechLip', params: ['breath_pressure', 'lip_tension'] },
  { id: 'flute', mech: 'mechJet', params: ['breath_pressure', 'jet_ratio'] },
];

const CARD_W = (W - 2 * MARGIN - (CARDS.length - 1) * CARD_GAP) / CARDS.length;
const cardsHeaderY = loss.y + loss.h + 22;
const cardsTop = cardsHeaderY + 8;

const cards = computed(() =>
  CARDS.map((c, i) => ({
    ...c,
    x: MARGIN + i * (CARD_W + CARD_GAP),
    y: cardsTop,
    nameY: cardsTop + 16,
    mechY: cardsTop + 30,
    paramYs: c.params.map((_, j) => cardsTop + 44 + j * LINE),
  })),
);

const struckY = cardsTop + CARD_H + 18;
const H = struckY + 14;
</script>

<template>
  <FigureFrame
    :title="props.title"
    :caption="props.caption"
    :view-box="`0 0 ${W} ${H}`"
    :width="W"
    :legend="legend"
  >
    <!-- Exciter slot: outlines behind it are the alternatives it can hold -->
    <rect
      v-for="g in GHOSTS"
      :key="`ghost-${g}`"
      class="fx-block fx-block--outline"
      :x="exciter.x + g * GHOST_STEP"
      :y="exciter.y - g * GHOST_STEP"
      :width="exciter.w"
      :height="exciter.h"
      rx="2"
    />
    <rect class="fx-plate" :x="exciter.x" :y="exciter.y" :width="exciter.w" :height="exciter.h" rx="2" />
    <rect class="fx-block fx-block--3" :x="exciter.x" :y="exciter.y" :width="exciter.w" :height="exciter.h" rx="2" />
    <text class="fx-note fx-note--strong" :x="exciter.x + PAD" :y="exciter.y + 18">{{ label('exciter') }}</text>
    <text class="fx-tick" :x="exciter.x + PAD" :y="exciter.y + 34">{{ label('exciterSub1') }}</text>
    <text class="fx-tick" :x="exciter.x + PAD" :y="exciter.y + 34 + LINE">{{ label('exciterSub2') }}</text>

    <!-- Loop stages every voice shares, and the radiation tap outside it -->
    <g v-for="s in stages" :key="`stage-${s.key}`">
      <rect :class="s.cls" :x="s.box.x" :y="s.box.y" :width="s.box.w" :height="s.box.h" rx="2" />
      <text class="fx-note fx-note--strong" :x="s.box.x + PAD" :y="s.box.y + 18">{{ label(s.key) }}</text>
      <text
        v-for="(sub, j) in s.subs"
        :key="sub"
        class="fx-tick"
        :x="s.box.x + PAD"
        :y="s.box.y + 34 + j * LINE"
      >
        {{ label(sub) }}
      </text>
    </g>
    <text class="fx-value fx-value--1" :x="loss.x + PAD" :y="loss.y + 34 + LINE">
      {{ label('brightness') }} · {{ label('damping') }}
    </text>

    <!-- The loop: inject, travel, reflect, return -->
    <path class="fx-curve fx-curve--thin" :d="loopPath.inject" />
    <path class="fx-curve fx-curve--thin" :d="loopPath.injectHead" />
    <text class="fx-tick" :x="(exciter.right + delay.x) / 2" :y="chainY - 7" text-anchor="middle">
      {{ label('inject') }}
    </text>
    <path class="fx-curve fx-curve--thin" :d="loopPath.toNode" />
    <path class="fx-curve fx-curve--thin" :d="loopPath.down" />
    <path class="fx-curve fx-curve--thin" :d="loopPath.downHead" />
    <text class="fx-tick" :x="nodeX + 6" :y="dimY + 4">{{ label('reflect') }}</text>
    <path class="fx-curve fx-curve--thin" :d="loopPath.back" />
    <path class="fx-curve fx-curve--thin" :d="loopPath.backHead" />
    <text class="fx-tick" :x="returnX + 6" :y="dimY + 4">{{ label('returning') }}</text>
    <circle class="fx-dot" :cx="nodeX" :cy="chainY" r="3" />

    <!-- Output tap: from the reflection point outward, not part of the loop -->
    <path class="fx-axis" :d="loopPath.tap" />
    <path class="fx-axis" :d="loopPath.tapHead" />
    <path class="fx-axis" :d="loopPath.out" />
    <path class="fx-axis" :d="loopPath.outHead" />
    <text class="fx-axis-label" :x="OUT_END" :y="chainY - 8" text-anchor="end">{{ label('out') }}</text>

    <!-- The delay length is the pitch -->
    <line class="fx-leader" :x1="delay.x" :x2="delay.right" :y1="dimY" :y2="dimY" />
    <line class="fx-leader" :x1="delay.x" :x2="delay.x" :y1="dimY - 4" :y2="dimY + 4" />
    <line class="fx-leader" :x1="delay.right" :x2="delay.right" :y1="dimY - 4" :y2="dimY + 4" />
    <rect
      class="fx-plate"
      :x="delay.x + (DELAY_W - DIM_PLATE_W) / 2"
      :y="dimY - 6"
      :width="DIM_PLATE_W"
      height="12"
    />
    <text class="fx-value" :x="delay.x + DELAY_W / 2" :y="dimY + 3.5" text-anchor="middle">
      {{ label('roundTrip') }}
    </text>

    <!-- What each voice puts in the slot -->
    <text class="fx-axis-label" :x="MARGIN" :y="cardsHeaderY">{{ label('slotHeader') }}</text>
    <g v-for="c in cards" :key="`card-${c.id}`">
      <rect class="fx-block fx-block--outline" :x="c.x" :y="c.y" :width="CARD_W" :height="CARD_H" rx="2" />
      <text class="fx-value fx-value--3" :x="c.x + PAD" :y="c.nameY">{{ label(c.id) }}</text>
      <text class="fx-tick" :x="c.x + PAD" :y="c.mechY">{{ label(c.mech) }}</text>
      <text
        v-for="(p, j) in c.params"
        :key="`${c.id}-${p}`"
        class="fx-tick"
        :x="c.x + PAD"
        :y="c.paramYs[j]"
      >
        {{ label(p) }}
      </text>
    </g>

    <!-- Struck voices use the same loop with a one-shot exciter -->
    <text class="fx-note" :x="MARGIN" :y="struckY">{{ label('struckNote') }}</text>
  </FigureFrame>
</template>
