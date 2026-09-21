<script setup lang="ts">
/**
 * Where the cost of making a sound sits, for the four ways this engine can make one.
 *
 * Two lanes, one per kind of cost: data the browser has to load, and work per
 * sounding voice. Sample playback pays almost entirely in the first lane and the
 * three synthesis methods almost entirely in the second — that contrast is the
 * whole figure. Bar length is an ordinal rank (small, medium, large), not a
 * measurement, so the lanes carry words rather than a numeric axis; the one real
 * number is the size of the shipped binary, which holds all three synthesis
 * methods and no sample data. The sample-data bar runs off its lane through a
 * break mark because a sample library grows with timbres and layers and has no
 * ceiling the figure could honestly draw.
 */
import { computed } from 'vue';
import wasmMeta from '@/wasm/meta.json';
import FigureFrame, { type FigureLegendItem } from './FigureFrame.vue';

const props = withDefaults(
  defineProps<{
    title?: string;
    caption?: string;
    /**
     * Size of the shipped WASM binary in bytes; printed beside the synthesis
     * rows. Taken from the copied build's own metadata, so a rebuild moves it.
     */
    binaryBytes?: number;
    labels?: Partial<Record<Key, string>>;
  }>(),
  { binaryBytes: wasmMeta.assets['sonare.wasm'].size },
);

type MethodKey = 'sample' | 'fm' | 'physical' | 'analog';
type SubKey = `${MethodKey}Sub`;

type Key =
  | MethodKey
  | SubKey
  | 'method'
  | 'inEngine'
  | 'data'
  | 'compute'
  | 'small'
  | 'medium'
  | 'large'
  | 'sampleGrows'
  | 'bytes'
  | 'binaryNote'
  | 'legendData'
  | 'legendCompute'
  | 'ordinal';

const DEFAULTS: Record<Key, string> = {
  sample: 'sample playback',
  sampleSub: 'SoundFont player',
  fm: 'FM',
  fmSub: 'GS fallback voices',
  physical: 'physical modelling',
  physicalSub: '9 voices',
  analog: 'virtual analog',
  analogSub: 'SynthPatch',
  method: 'method',
  inEngine: 'in this engine',
  data: 'data',
  compute: 'compute',
  small: 'small',
  medium: 'medium',
  large: 'large',
  sampleGrows: 'timbres × layers, into gigabytes',
  bytes: 'bytes',
  binaryNote: 'whole binary, no samples',
  legendData: 'data — what the browser must load',
  legendCompute: 'compute — work per sounding voice',
  ordinal: 'Bar length ranks the four methods against each other; it is not a measurement.',
};

const label = (key: Key) => props.labels?.[key] ?? DEFAULTS[key];

const legend = computed<FigureLegendItem[]>(() => [
  { series: 3, shape: 'block', label: label('legendData') },
  { series: 1, shape: 'block', label: label('legendCompute') },
]);

/** Ordinal cost rank; the lane prints these as words, never as numbers. */
type Level = 1 | 2 | 3;
type Lane = 'data' | 'compute';

interface Method {
  key: MethodKey;
  sub: SubKey;
  data: Level;
  compute: Level;
  /** The data cost has no ceiling: the bar leaves the lane through a break mark. */
  unbounded?: Lane;
}

const METHODS: Method[] = [
  { key: 'sample', sub: 'sampleSub', data: 3, compute: 1, unbounded: 'data' },
  { key: 'fm', sub: 'fmSub', data: 1, compute: 2 },
  { key: 'physical', sub: 'physicalSub', data: 1, compute: 3 },
  { key: 'analog', sub: 'analogSub', data: 1, compute: 2 },
];

const LANES: Lane[] = ['data', 'compute'];
const STEPS: { key: Key; level: Level }[] = [
  { key: 'small', level: 1 },
  { key: 'medium', level: 2 },
  { key: 'large', level: 3 },
];

const LANE_CLASS: Record<Lane, string> = {
  data: 'fx-block fx-block--3',
  compute: 'fx-block',
};

// --- Layout. Method names on the left, one lane per kind of cost to the right.
const W = 640;
const MARGIN = 12;
// 164 px holds 27 characters of 10 px mono, or 16 CJK glyphs.
const NAME_W = 164;
const LANE_X0 = MARGIN + NAME_W + 10;
const LANE_W = 210;
const LANE_GAP = 20;
// Three ordinal steps; the spare at the end is where an unbounded bar breaks out.
const STEP = 60;
const SPARE = LANE_W - 3 * STEP;
const OVERHANG = 6;
const HEAD_Y = 18;
const STEP_Y = 32;
const LANE_TOP = 40;
const ROW0_TOP = LANE_TOP + 6;
const ROW_PITCH = 46;
const BAR_H = 14;
const LANE_BOT = ROW0_TOP + METHODS.length * ROW_PITCH + 2;
const NOTE_Y = LANE_BOT + 24;
const H = NOTE_Y + 12;
const BRACKET_TICK = 4;
const BREAK_SLANT = 3;

const laneX = (lane: Lane) => LANE_X0 + LANES.indexOf(lane) * (LANE_W + LANE_GAP);

/** Thousands-grouped integer, locale-independent so SSR and client agree. */
const groupDigits = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

const geom = computed(() => {
  const rows = METHODS.map((m, i) => {
    const top = ROW0_TOP + i * ROW_PITCH;
    const mid = top + ROW_PITCH / 2;
    const bars = LANES.map((lane) => {
      const x = laneX(lane);
      const unbounded = m.unbounded === lane;
      return {
        lane,
        cls: LANE_CLASS[lane],
        x,
        w: unbounded ? LANE_W + OVERHANG : m[lane] * STEP,
        unbounded,
        breakX: x + 3 * STEP + SPARE / 2,
        labelX: x + LANE_W,
      };
    });
    return { ...m, top, mid, barTop: mid - BAR_H / 2, barBot: mid + BAR_H / 2, bars };
  });

  // Every synthesis row is contiguous below the sample row; one bracket spans them, ticks toward the bars.
  const synth = rows.filter((r) => r.key !== 'sample');
  const bracketX = laneX('data') + STEP + 8;
  const bracket = {
    d: `M ${bracketX - BRACKET_TICK} ${synth[0].barTop} H ${bracketX} V ${synth[synth.length - 1].barBot} H ${bracketX - BRACKET_TICK}`,
    textX: bracketX + 10,
    midY: (synth[0].barTop + synth[synth.length - 1].barBot) / 2,
  };

  // Axis-break mark: a slanted knockout slit with a rule on each side.
  const breaks = rows.flatMap((r) =>
    r.bars
      .filter((b) => b.unbounded)
      .map((b) => {
        const y0 = r.barTop - 2;
        const y1 = r.barBot + 2;
        const s = BREAK_SLANT;
        return {
          key: `${r.key}-${b.lane}`,
          slit: `${b.breakX - 2 + s},${y0} ${b.breakX + 2 + s},${y0} ${b.breakX + 2 - s},${y1} ${b.breakX - 2 - s},${y1}`,
          rules: `M ${b.breakX - 2 + s} ${y0} L ${b.breakX - 2 - s} ${y1} M ${b.breakX + 2 + s} ${y0} L ${b.breakX + 2 - s} ${y1}`,
          labelX: b.labelX,
          labelY: r.barBot + 12,
        };
      }),
  );

  return { rows, bracket, breaks };
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
    <!-- Column headers -->
    <text class="fx-axis-label" :x="MARGIN" :y="HEAD_Y">{{ label('method') }}</text>
    <text class="fx-tick" :x="MARGIN" :y="STEP_Y">{{ label('inEngine') }}</text>
    <g v-for="lane in LANES" :key="`head-${lane}`">
      <text class="fx-axis-label" :x="laneX(lane)" :y="HEAD_Y">{{ label(lane) }}</text>
      <text
        v-for="s in STEPS"
        :key="`step-${lane}-${s.key}`"
        class="fx-tick"
        :x="laneX(lane) + (s.level - 0.5) * STEP"
        :y="STEP_Y"
        text-anchor="middle"
      >
        {{ label(s.key) }}
      </text>
    </g>

    <!-- Lanes with a tick at each step boundary -->
    <g v-for="lane in LANES" :key="`lane-${lane}`">
      <rect
        class="fx-lane"
        :x="laneX(lane)"
        :y="LANE_TOP"
        :width="LANE_W"
        :height="LANE_BOT - LANE_TOP"
        rx="5"
      />
      <path
        v-for="s in STEPS"
        :key="`tick-${lane}-${s.key}`"
        class="fx-axis"
        :d="`M ${laneX(lane) + s.level * STEP} ${LANE_TOP} V ${LANE_TOP + 5}`"
      />
    </g>

    <!-- Rows: method name, engine mapping, one bar per lane -->
    <g v-for="r in geom.rows" :key="r.key">
      <text class="fx-value" :x="MARGIN" :y="r.mid - 5" dy="0.35em">{{ label(r.key) }}</text>
      <text class="fx-tick" :x="MARGIN" :y="r.mid + 9" dy="0.35em">{{ label(r.sub) }}</text>
      <rect
        v-for="b in r.bars"
        :key="`${r.key}-${b.lane}`"
        :class="b.cls"
        :x="b.x"
        :y="r.barTop"
        :width="b.w"
        :height="BAR_H"
        rx="2"
      />
    </g>

    <!-- Unbounded bars leave the lane through a break mark -->
    <g v-for="k in geom.breaks" :key="`break-${k.key}`">
      <polygon class="fx-plate" :points="k.slit" />
      <path class="fx-axis" :d="k.rules" />
      <text class="fx-value fx-value--3" :x="k.labelX" :y="k.labelY" text-anchor="end">
        {{ label('sampleGrows') }}
      </text>
    </g>

    <!-- The one real number: everything the synthesis rows need ships in the binary -->
    <path class="fx-leader" :d="geom.bracket.d" />
    <text class="fx-value" :x="geom.bracket.textX" :y="geom.bracket.midY - 3">
      {{ groupDigits(props.binaryBytes) }} {{ label('bytes') }}
    </text>
    <text class="fx-tick" :x="geom.bracket.textX" :y="geom.bracket.midY + 10">
      {{ label('binaryNote') }}
    </text>

    <text class="fx-note" :x="MARGIN" :y="NOTE_Y">{{ label('ordinal') }}</text>
  </FigureFrame>
</template>
