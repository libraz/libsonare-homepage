<script setup lang="ts">
/**
 * One DAHDSR amplitude envelope (no delay or hold) drawn in decibels: the
 * SynthPatch amp and filter envelope, whose decay and release are three time
 * constants. The built-in oscillator instrument's ADSR is a linear ramp and
 * is not what this draws.
 *
 * The stages follow the engine's one-pole segments: the attack aims at 1.3×
 * full scale and stops where it crosses 1.0, so it is steep early and arrives
 * at exactly the attack time; decay and release move toward their target with
 * a time constant of one third of the set time. On a dB axis the release is a
 * straight line that has fallen 20·log10(e³) ≈ 26 dB at the set time and keeps
 * going below it.
 */
import { computed } from 'vue';
import FigureFrame, { type FigureLegendItem } from './FigureFrame.vue';
import { linScale, type Pt, path } from './figureMath';

const props = defineProps<{
  title?: string;
  caption?: string;
  labels?: Partial<Record<Key, string>>;
}>();

type Key =
  | 'envelope'
  | 'target'
  | 'attack'
  | 'decay'
  | 'sustain'
  | 'release'
  | 'keyUp'
  | 'releaseTime'
  | 'timeConstant'
  | 'tail'
  | 'time'
  | 'scope';

const DEFAULTS: Record<Key, string> = {
  envelope: 'level',
  target: 'attack target',
  attack: 'A',
  decay: 'D',
  sustain: 'S',
  release: 'R',
  keyUp: 'key up',
  releaseTime: 'release time',
  timeConstant: 'one time constant',
  tail: 'tail keeps falling',
  time: 'time (s)',
  scope: 'SynthPatch envelope: decay and release = 3 time constants',
};

const label = (key: Key) => props.labels?.[key] ?? DEFAULTS[key];

// Envelope settings, in seconds and linear level.
const ATTACK = 0.2;
const DECAY = 0.3;
const SUSTAIN = 0.5;
const KEY_UP = 1.0;
const RELEASE = 0.6;
const ATTACK_TARGET = 1.3;
const TAU_A = ATTACK / Math.log(ATTACK_TARGET / (ATTACK_TARGET - 1));
const TAU_D = DECAY / 3;
const TAU_R = RELEASE / 3;
const T_END = 2.2;

const dB = (v: number) => 20 * Math.log10(v);

function level(t: number): number {
  if (t <= ATTACK) return ATTACK_TARGET * (1 - Math.exp(-t / TAU_A));
  if (t <= KEY_UP) return SUSTAIN + (1 - SUSTAIN) * Math.exp(-(t - ATTACK) / TAU_D);
  return level(KEY_UP) * Math.exp(-(t - KEY_UP) / TAU_R);
}

const X0 = 64;
const X1 = 596;
const Y0 = 44;
const Y1 = 224;
const DB_TOP = 6;
const DB_BOT = -60;
const x = linScale(0, T_END, X0, X1);
const y = linScale(DB_BOT, DB_TOP, Y1, Y0);
const DB_TICKS = [0, -12, -24, -36, -48, -60];
const T_TICKS = [0, 0.4, 0.8, 1.2, 1.6, 2.0];

const legend = computed<FigureLegendItem[]>(() => [
  { series: 1, label: label('envelope') },
  { series: 3, shape: 'dashed', label: label('target') },
]);

const geom = computed(() => {
  const pts: Pt[] = [];
  const n = 660;
  for (let i = 0; i <= n; i++) {
    const t = (T_END * i) / n;
    const v = level(t);
    if (dB(v) >= DB_BOT) pts.push([x(t), y(dB(v))]);
  }
  const startDb = dB(level(KEY_UP));
  const steps = [1, 2, 3].map((k) => {
    const t = KEY_UP + k * TAU_R;
    const drop = startDb - dB(level(t));
    return { x: x(t), y: y(dB(level(t))), drop };
  });
  return {
    curve: path(pts),
    startY: y(startDb),
    endY: y(dB(level(KEY_UP + RELEASE))),
    totalDrop: startDb - dB(level(KEY_UP + RELEASE)),
    steps,
    targetY: y(dB(ATTACK_TARGET)),
    tailX: x(KEY_UP + 2 * RELEASE),
    tailY: y(dB(level(KEY_UP + 2 * RELEASE))),
  };
});

const STAGES = computed(() => [
  { key: 'attack' as const, a: 0, b: ATTACK },
  { key: 'decay' as const, a: ATTACK, b: ATTACK + DECAY },
  { key: 'sustain' as const, a: ATTACK + DECAY, b: KEY_UP },
  { key: 'release' as const, a: KEY_UP, b: KEY_UP + RELEASE },
]);
</script>

<template>
  <FigureFrame
    :title="props.title"
    :caption="props.caption"
    view-box="0 0 640 262"
    :width="640"
    :legend="legend"
  >
    <!-- Grid -->
    <g v-for="db in DB_TICKS" :key="`db-${db}`">
      <line
        :class="db === 0 ? 'fx-grid fx-grid--strong' : 'fx-grid'"
        :x1="X0"
        :x2="X1"
        :y1="y(db)"
        :y2="y(db)"
      />
      <text class="fx-tick" :x="X0 - 6" :y="y(db) + 3" text-anchor="end">
        {{ db === 0 ? '0' : `−${-db}` }}
      </text>
    </g>
    <g v-for="t in T_TICKS" :key="`t-${t}`">
      <text class="fx-tick" :x="x(t)" :y="Y1 + 14" text-anchor="middle">{{ t.toFixed(1) }}</text>
    </g>
    <text class="fx-tick" :x="X0 - 6" :y="Y0 - 8" text-anchor="end">dB</text>
    <text class="fx-axis-label" :x="X1" :y="Y1 + 30" text-anchor="end">{{ label('time') }}</text>
    <text class="fx-note" :x="X0" :y="Y1 + 30">{{ label('scope') }}</text>
    <line class="fx-axis" :x1="X0" :x2="X0" :y1="Y0" :y2="Y1" />
    <line class="fx-axis" :x1="X0" :x2="X1" :y1="Y1" :y2="Y1" />

    <!-- Stage spans -->
    <g v-for="s in STAGES" :key="`st-${s.key}`">
      <line class="fx-grid fx-grid--dashed" :x1="x(s.b)" :x2="x(s.b)" :y1="Y0 - 18" :y2="Y1" />
      <text class="fx-axis-label" :x="(x(s.a) + x(s.b)) / 2" :y="Y0 - 22" text-anchor="middle">
        {{ label(s.key) }}
      </text>
    </g>

    <!-- Attack target above full scale -->
    <line class="fx-guide" :x1="X0" :x2="x(ATTACK)" :y1="geom.targetY" :y2="geom.targetY" />
    <text class="fx-value fx-value--3" :x="X0 + 4" :y="geom.targetY - 5">
      +{{ dB(ATTACK_TARGET).toFixed(1) }} dB
    </text>

    <path class="fx-curve" :d="geom.curve" />

    <!-- Release: key-up, three time constants, set release time -->
    <line class="fx-guide fx-guide--neutral" :x1="x(KEY_UP)" :x2="x(KEY_UP)" :y1="Y0" :y2="Y1" />
    <text class="fx-note" :x="x(KEY_UP) - 5" :y="Y1 - 8" text-anchor="end">{{ label('keyUp') }}</text>
    <line
      class="fx-guide fx-guide--strong"
      :x1="x(KEY_UP + RELEASE)"
      :x2="x(KEY_UP + RELEASE)"
      :y1="Y0"
      :y2="Y1"
    />
    <text class="fx-note fx-note--strong" :x="x(KEY_UP + RELEASE) + 5" :y="Y0 + 12">
      {{ label('releaseTime') }}
    </text>

    <line class="fx-leader" :x1="x(KEY_UP)" :x2="x(KEY_UP + RELEASE)" :y1="geom.startY" :y2="geom.startY" />
    <line
      class="fx-curve fx-curve--3 fx-curve--thin"
      :x1="x(KEY_UP + RELEASE) + 10"
      :x2="x(KEY_UP + RELEASE) + 10"
      :y1="geom.startY"
      :y2="geom.endY"
    />
    <text class="fx-value fx-value--3" :x="x(KEY_UP + RELEASE) + 15" :y="(geom.startY + geom.endY) / 2 + 4">
      −{{ geom.totalDrop.toFixed(1) }} dB
    </text>

    <g v-for="(s, i) in geom.steps" :key="`tau-${i}`">
      <circle class="fx-dot fx-dot--3" :cx="s.x" :cy="s.y" r="3.2" />
      <text v-if="i < 2" class="fx-value" :x="s.x + 6" :y="s.y - 5">−{{ s.drop.toFixed(1) }}</text>
    </g>
    <text class="fx-note" :x="geom.steps[0].x - 4" :y="geom.steps[0].y + 16" text-anchor="end">
      {{ label('timeConstant') }}
    </text>

    <text class="fx-note" :x="geom.tailX - 34" :y="geom.tailY - 4" text-anchor="end">{{ label('tail') }}</text>
  </FigureFrame>
</template>
