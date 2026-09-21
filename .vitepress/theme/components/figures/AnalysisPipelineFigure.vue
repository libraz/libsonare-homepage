<script setup lang="ts">
/**
 * How decoded audio becomes an analysis result, at one level of zoom.
 *
 * Four layers, left to right: the decoded samples, the STFT, the features
 * (each a matrix over time), and the estimators (each a decision read from
 * features). The STFT is drawn as one stage because it is computed once and
 * fanned out — mel, chroma and the onset envelope all read the same matrix.
 * Not everything passes through it: RMS, zero-crossing rate and the pitch
 * trackers read the waveform directly, so the figure carries a second rail
 * under the STFT rather than pretending the pipeline is serial. The framing
 * inside the STFT stage is the subject of StftFramingFigure.
 */
import { computed } from 'vue';
import FigureFrame, { type FigureLegendItem } from './FigureFrame.vue';

const props = defineProps<{
  title?: string;
  caption?: string;
  labels?: Partial<Record<Key, string>>;
}>();

/** Export names from feature_spectrogram / feature_spectral / feature_pitch; identity labels. */
const FEATURE_IDS = [
  'melSpectrogram',
  'mfcc',
  'chroma',
  'onsetEnvelope',
  'rmsEnergy',
  'zeroCrossingRate',
  'pitchYin',
  'pitchPyin',
] as const;

/** Export names from quick_analysis / feature_music; identity labels. */
const ESTIMATOR_IDS = [
  'detectKey',
  'detectChords',
  'analyzeSections',
  'detectBpm',
  'detectBeats',
  'analyzeMelody',
] as const;

type FeatureId = (typeof FEATURE_IDS)[number];
type EstimatorId = (typeof ESTIMATOR_IDS)[number];

type Key =
  | FeatureId
  | EstimatorId
  | 'decode'
  | 'decodeSub'
  | 'stft'
  | 'stftSub'
  | 'features'
  | 'featuresSub'
  | 'estimators'
  | 'estimatorsSub'
  | 'audio'
  | 'audioSub'
  | 'stftParams'
  | 'bypass'
  | 'noteOnce'
  | 'noteEach'
  | 'legendStft'
  | 'legendTime'
  | 'legendEstimator';

const identity = <T extends string>(keys: readonly T[]): Record<T, string> => {
  const out = {} as Record<T, string>;
  for (const key of keys) out[key] = key;
  return out;
};

const DEFAULTS: Record<Key, string> = {
  ...identity(FEATURE_IDS),
  ...identity(ESTIMATOR_IDS),
  decode: 'decode',
  decodeSub: 'mono Float32Array',
  stft: 'stft',
  stftSub: 'one matrix, shared',
  features: 'features',
  featuresSub: 'a matrix over time',
  estimators: 'estimators',
  estimatorsSub: 'a decision',
  audio: 'Audio',
  audioSub: 'fromMemory → data',
  stftParams: 'nFft · hopLength',
  bypass: 'no STFT',
  noteOnce: 'analyze() runs the STFT once and hands the same matrices to every estimator.',
  noteEach:
    'The single-answer helpers (detectBpm, detectKey, …) each rebuild the chain from the samples.',
  legendStft: 'computed through the STFT',
  legendTime: 'read straight from the samples',
  legendEstimator: 'estimator — one decision, from features',
};

const label = (key: Key) => props.labels?.[key] ?? DEFAULTS[key];

const legend = computed<FigureLegendItem[]>(() => [
  { series: 1, shape: 'block', label: label('legendStft') },
  { series: 3, shape: 'block', label: label('legendTime') },
  { series: 0, shape: 'block', label: label('legendEstimator') },
]);

// Layout. Five equal columns; a box line holds 18 characters of 10 px mono
// (0.6 em advance), or about 10 CJK characters.
const W = 640;
const MARGIN = 10;
const COL_W = 106;
const COL_GAP = 22;
const BOX_H = 36;
const ROW_PITCH = 48;
const ROW0_TOP = 52;
// Rows 3 and 4 are the time-domain rail; the gap separates it from the STFT rows.
const RAIL_ROW = 3;
const RAIL_GAP = 14;
const HEAD_Y = 22;
const HEAD_SUB_Y = 35;
const LINE = 13;

type Kind = 'source' | 'stft' | 'spectral' | 'time' | 'estimator';

interface Box {
  id: string;
  col: number;
  row: number;
  kind: Kind;
  lines: Key[];
  /** Small second line under a single-line title. */
  sub?: Key;
}

const BOXES: Box[] = [
  { id: 'audio', col: 0, row: 1, kind: 'source', lines: ['audio'], sub: 'audioSub' },
  { id: 'stft', col: 1, row: 1, kind: 'stft', lines: ['stft'], sub: 'stftParams' },
  { id: 'mel', col: 2, row: 1.5, kind: 'spectral', lines: ['melSpectrogram'] },
  { id: 'chroma', col: 3, row: 0, kind: 'spectral', lines: ['chroma'] },
  { id: 'mfcc', col: 3, row: 1, kind: 'spectral', lines: ['mfcc'] },
  { id: 'onset', col: 3, row: 2, kind: 'spectral', lines: ['onsetEnvelope'] },
  { id: 'level', col: 3, row: 3, kind: 'time', lines: ['rmsEnergy', 'zeroCrossingRate'] },
  { id: 'pitch', col: 3, row: 4, kind: 'time', lines: ['pitchYin', 'pitchPyin'] },
  { id: 'harmony', col: 4, row: 0, kind: 'estimator', lines: ['detectKey', 'detectChords'] },
  { id: 'sections', col: 4, row: 1, kind: 'estimator', lines: ['analyzeSections'] },
  { id: 'rhythm', col: 4, row: 2, kind: 'estimator', lines: ['detectBpm', 'detectBeats'] },
  { id: 'melody', col: 4, row: 4, kind: 'estimator', lines: ['analyzeMelody'] },
];

const BOX_CLASS: Record<Kind, string> = {
  source: 'fx-block fx-block--outline',
  stft: 'fx-block',
  spectral: 'fx-block',
  time: 'fx-block fx-block--3',
  estimator: 'fx-block fx-block--muted',
};

const HEADERS: { key: Key; sub: Key; col: number }[] = [
  { key: 'decode', sub: 'decodeSub', col: 0 },
  { key: 'stft', sub: 'stftSub', col: 1 },
  { key: 'features', sub: 'featuresSub', col: 2 },
  { key: 'estimators', sub: 'estimatorsSub', col: 4 },
];

const colX = (col: number) => MARGIN + col * (COL_W + COL_GAP);
const rowTop = (row: number) => ROW0_TOP + row * ROW_PITCH + (row >= RAIL_ROW ? RAIL_GAP : 0);
const rowMid = (row: number) => rowTop(row) + BOX_H / 2;

/** Arrowhead with its tip at (x, y), pointing right. */
const chevron = (x: number, y: number) => `M ${x - 4} ${y - 3.5} L ${x} ${y} L ${x - 4} ${y + 3.5}`;

const STFT_EDGE = 'fx-curve fx-curve--thin';
const TIME_EDGE = 'fx-curve fx-curve--3 fx-curve--thin';

const geom = computed(() => {
  const boxes = BOXES.map((b) => {
    const x = colX(b.col);
    const top = rowTop(b.row);
    const mid = rowMid(b.row);
    const textYs = b.sub
      ? [mid - 5]
      : b.lines.length === 1
        ? [mid]
        : b.lines.map((_, i) => mid + (i - (b.lines.length - 1) / 2) * LINE);
    return {
      ...b,
      x,
      top,
      mid,
      right: x + COL_W,
      cx: x + COL_W / 2,
      bottom: top + BOX_H,
      texts: b.lines.map((key, i) => ({ key, y: textYs[i] })),
      subY: mid + 9,
    };
  });
  const at = (id: string) => {
    const box = boxes.find((b) => b.id === id);
    if (!box) throw new Error(`AnalysisPipelineFigure: no box ${id}`);
    return box;
  };

  const audio = at('audio');
  const stft = at('stft');
  const mel = at('mel');
  const chroma = at('chroma');
  const mfcc = at('mfcc');
  const onset = at('onset');
  const level = at('level');
  const pitch = at('pitch');
  const harmony = at('harmony');
  const sections = at('sections');
  const rhythm = at('rhythm');
  const melody = at('melody');

  const straight = (from: typeof audio, to: typeof audio, cls: string) => ({
    cls,
    d: `M ${from.right} ${from.mid} H ${to.x} ${chevron(to.x, from.mid)}`,
  });

  // One STFT, two branches: chroma straight across, mel a row and a half down.
  const stftBus = stft.right + COL_GAP / 2;
  // Mel feeds both mfcc and the onset envelope.
  const melBus = mel.right + COL_GAP / 2;
  // Chroma also feeds sections; it enters above the mfcc edge so the two stay apart.
  const chromaTurn = chroma.right + COL_GAP / 2;
  const sectionsUpper = sections.top + 7;

  const edges = [
    straight(audio, stft, STFT_EDGE),
    {
      cls: STFT_EDGE,
      d: `M ${stft.right} ${stft.mid} H ${stftBus} V ${chroma.mid} H ${chroma.x} ${chevron(chroma.x, chroma.mid)}`,
    },
    {
      cls: STFT_EDGE,
      d: `M ${stftBus} ${stft.mid} V ${mel.mid} H ${mel.x} ${chevron(mel.x, mel.mid)}`,
    },
    {
      cls: STFT_EDGE,
      d: `M ${mel.right} ${mel.mid} H ${melBus} V ${mfcc.mid} H ${mfcc.x} ${chevron(mfcc.x, mfcc.mid)}`,
    },
    {
      cls: STFT_EDGE,
      d: `M ${melBus} ${mel.mid} V ${onset.mid} H ${onset.x} ${chevron(onset.x, onset.mid)}`,
    },
    straight(chroma, harmony, STFT_EDGE),
    {
      cls: STFT_EDGE,
      d: `M ${chroma.right} ${chroma.bottom - 6} H ${chromaTurn} V ${sectionsUpper} H ${sections.x} ${chevron(sections.x, sectionsUpper)}`,
    },
    straight(mfcc, sections, STFT_EDGE),
    straight(onset, rhythm, STFT_EDGE),
    // The time-domain rail drops out of the samples box and runs under the STFT.
    {
      cls: TIME_EDGE,
      d: `M ${audio.cx} ${audio.bottom} V ${level.mid} H ${level.x} ${chevron(level.x, level.mid)}`,
    },
    {
      cls: TIME_EDGE,
      d: `M ${audio.cx} ${level.mid} V ${pitch.mid} H ${pitch.x} ${chevron(pitch.x, pitch.mid)}`,
    },
    straight(pitch, melody, TIME_EDGE),
  ];

  const last = boxes.reduce((m, b) => Math.max(m, b.bottom), 0);
  return {
    boxes,
    edges,
    bypass: { x: stft.x, y: level.mid - 6 },
    noteY1: last + 26,
    noteY2: last + 26 + LINE,
    h: last + 26 + LINE + 10,
  };
});
</script>

<template>
  <FigureFrame
    :title="props.title"
    :caption="props.caption"
    :view-box="`0 0 ${W} ${geom.h}`"
    :width="W"
    :legend="legend"
  >
    <!-- Layer headers -->
    <g v-for="h in HEADERS" :key="`head-${h.key}`">
      <text class="fx-axis-label" :x="colX(h.col)" :y="HEAD_Y">{{ label(h.key) }}</text>
      <text class="fx-tick" :x="colX(h.col)" :y="HEAD_SUB_Y">{{ label(h.sub) }}</text>
    </g>

    <!-- Edges first, so boxes sit on top of the rails -->
    <path v-for="(e, i) in geom.edges" :key="`edge-${i}`" :class="e.cls" :d="e.d" />
    <text class="fx-value fx-value--3" :x="geom.bypass.x" :y="geom.bypass.y">{{ label('bypass') }}</text>

    <!-- Stages -->
    <g v-for="b in geom.boxes" :key="b.id">
      <rect :class="BOX_CLASS[b.kind]" :x="b.x" :y="b.top" :width="COL_W" :height="BOX_H" rx="3" />
      <text
        v-for="t in b.texts"
        :key="`${b.id}-${t.key}`"
        class="fx-value"
        :x="b.cx"
        :y="t.y"
        dy="0.35em"
        text-anchor="middle"
      >
        {{ label(t.key) }}
      </text>
      <text v-if="b.sub" class="fx-tick" :x="b.cx" :y="b.subY" dy="0.35em" text-anchor="middle">
        {{ label(b.sub) }}
      </text>
    </g>

    <text class="fx-note" :x="MARGIN" :y="geom.noteY1">{{ label('noteOnce') }}</text>
    <text class="fx-note" :x="MARGIN" :y="geom.noteY2">{{ label('noteEach') }}</text>
  </FigureFrame>
</template>
