<script setup lang="ts">
/**
 * The project object model, laid out the way a timeline stores it.
 *
 * A track holds clips; an audio clip holds its takes; the comp lane under the
 * clip picks one take per region and falls back to the active take wherever no
 * segment covers. The takes are drawn muted except where the comp chooses them,
 * so the reader sees comping as selection, not as a merged copy. A MIDI track
 * shows the other clip kind and a track-level automation lane beside it.
 *
 * Every position is in PPQ — quarter notes as a float, so a 4/4 bar is 4.0 and
 * a beat line is 1.0. The ruler makes that relationship visible, since "ticks
 * per quarter" is the unit readers most often assume and the engine does not use.
 */
import { computed } from 'vue';
import FigureFrame, { type FigureLegendItem } from './FigureFrame.vue';
import { linScale, path } from './figureMath';

const props = withDefaults(
  defineProps<{
    title?: string;
    caption?: string;
    /** Bars on the ruler. */
    bars?: number;
    /** Time-signature numerator: quarter notes per bar, so bar lines fall every N PPQ. */
    beatsPerBar?: number;
    labels?: Partial<Record<Key, string>>;
  }>(),
  { bars: 4, beatsPerBar: 4 },
);

type Key =
  | 'audioTrack'
  | 'midiTrack'
  | 'clip'
  | 'midiClip'
  | 'take'
  | 'comp'
  | 'automation'
  | 'bar'
  | 'axis'
  | 'activeNote'
  | 'compNote';

const DEFAULTS: Record<Key, string> = {
  audioTrack: 'audio track',
  midiTrack: 'MIDI track',
  clip: 'clip',
  midiClip: 'MIDI clip',
  take: 'take',
  comp: 'comp lane',
  automation: 'automation lane',
  bar: 'bar',
  axis: 'position in PPQ · 1.0 = one quarter note',
  activeNote: 'active take — fills uncovered regions',
  compNote: 'segments pick a take; nothing is copied',
};

const label = (key: Key) => props.labels?.[key] ?? DEFAULTS[key];

// --- Model data: one audio clip with three takes and a comp, one MIDI clip, one lane.
const CLIP = { start: 0, length: 8 };
const TAKES = [
  { id: 1, series: 2, active: false },
  { id: 2, series: 3, active: true },
  { id: 3, series: 4, active: false },
];
// Clip-local ranges, as ProjectClipCompSegment stores them.
const SEGMENTS = [
  { start: 0, end: 3, takeId: 1 },
  { start: 3, end: 6, takeId: 3 },
];
const MIDI_CLIP = { start: 8, length: 8 };
const NOTES = [
  { ppq: 8, length: 1, row: 2 },
  { ppq: 9, length: 0.5, row: 3 },
  { ppq: 10, length: 1, row: 1 },
  { ppq: 12, length: 2, row: 2 },
  { ppq: 14, length: 1, row: 0 },
  { ppq: 15, length: 1, row: 3 },
];
const AUTOMATION = [
  { ppq: 0, value: 0.2 },
  { ppq: 6, value: 0.9 },
  { ppq: 12, value: 0.5 },
  { ppq: 16, value: 0.7 },
];

// --- Layout. Lane names live in a left gutter sized for the longest label.
const W = 640;
const LABEL_EM = 10; // px per CJK glyph at the 9px mono lane-label size, tracking included
const LABEL_CHARS = 11; // longest lane name budgeted (ja "automation lane")
const INDENT = 12; // nested rows step in by this
const GUTTER_X = 10;
const X0 = GUTTER_X + INDENT + LABEL_CHARS * LABEL_EM + 8;
const X1 = 628;
const RULER_TOP = 12;
const RULER_BOT = 30;
const ROW_H = 22;
const NEST_H = 16;
const ROW_GAP = 3;
const GROUP_GAP = 12;
const NOTE_ROWS = 4;

interface Row {
  id: string;
  depth: 0 | 1;
  text: string;
  top: number;
  bot: number;
  mid: number;
}

const x = computed(() => linScale(0, props.bars * props.beatsPerBar, X0, X1));

const rows = computed(() => {
  const spec: { id: string; depth: 0 | 1; text: string; gapBefore?: boolean }[] = [
    { id: 'audio', depth: 0, text: label('audioTrack') },
    ...TAKES.map((t) => ({
      id: `take-${t.id}`,
      depth: 1 as const,
      text: `${label('take')} ${t.id}`,
    })),
    { id: 'comp', depth: 1, text: label('comp') },
    { id: 'midi', depth: 0, text: label('midiTrack'), gapBefore: true },
    { id: 'auto', depth: 1, text: label('automation') },
  ];
  const out: Record<string, Row> = {};
  let y = RULER_BOT + 6;
  for (const s of spec) {
    if (s.gapBefore) y += GROUP_GAP;
    const h = s.depth === 0 ? ROW_H : NEST_H;
    out[s.id] = { id: s.id, depth: s.depth, text: s.text, top: y, bot: y + h, mid: y + h / 2 };
    y += h + ROW_GAP;
  }
  return out;
});

const rowList = computed(() => Object.values(rows.value));
const LANES_BOT = computed(() => rowList.value[rowList.value.length - 1].bot);
const AXIS_Y = computed(() => LANES_BOT.value + 8);
const H = computed(() => AXIS_Y.value + 34);

// Tree brackets in the gutter: parent row down to its last nested row.
const brackets = computed(() => {
  const r = rows.value;
  const make = (parent: Row, children: Row[]) => ({
    x: GUTTER_X + INDENT / 2,
    y1: parent.bot,
    y2: children[children.length - 1].mid,
    stubs: children.map((c) => c.mid),
  });
  return [make(r.audio, [...TAKES.map((t) => r[`take-${t.id}`]), r.comp]), make(r.midi, [r.auto])];
});

const grid = computed(() => {
  const sx = x.value;
  const total = props.bars * props.beatsPerBar;
  const beats = [];
  for (let q = 0; q <= total; q++) beats.push({ x: sx(q), bar: q % props.beatsPerBar === 0 });
  const bars = Array.from({ length: props.bars }, (_, i) => ({
    n: i + 1,
    x: sx(i * props.beatsPerBar),
  }));
  return { beats, bars };
});

const geom = computed(() => {
  const sx = x.value;
  const r = rows.value;
  const clipEnd = CLIP.start + CLIP.length;

  // Regions of the clip no segment covers: the active take plays there.
  const gaps: { start: number; end: number }[] = [];
  let cursor = CLIP.start;
  for (const s of [...SEGMENTS].sort((a, b) => a.start - b.start)) {
    if (s.start > cursor) gaps.push({ start: cursor, end: s.start });
    cursor = Math.max(cursor, s.end);
  }
  if (cursor < clipEnd) gaps.push({ start: cursor, end: clipEnd });

  const takes = TAKES.map((t) => {
    const row = r[`take-${t.id}`];
    const picked = SEGMENTS.filter((s) => s.takeId === t.id);
    return {
      ...t,
      row,
      picked: picked.map((s) => ({ x: sx(s.start), w: sx(s.end) - sx(s.start) })),
      fallback: t.active ? gaps.map((g) => ({ x: sx(g.start), w: sx(g.end) - sx(g.start) })) : [],
    };
  });

  const compRow = r.comp;
  const activeTake = TAKES.find((t) => t.active) ?? TAKES[0];
  const comp = [
    ...SEGMENTS.map((s) => ({
      x: sx(s.start),
      w: sx(s.end) - sx(s.start),
      series: TAKES.find((t) => t.id === s.takeId)?.series ?? activeTake.series,
      takeId: s.takeId,
      fallback: false,
    })),
    ...gaps.map((g) => ({
      x: sx(g.start),
      w: sx(g.end) - sx(g.start),
      series: activeTake.series,
      takeId: activeTake.id,
      fallback: true,
    })),
  ];

  const midiRow = r.midi;
  const noteTop = midiRow.top + 4;
  const noteStep = (midiRow.bot - midiRow.top - 8) / NOTE_ROWS;
  const notes = NOTES.map((n) => ({
    x: sx(n.ppq) + 1,
    w: sx(n.ppq + n.length) - sx(n.ppq) - 2,
    y: noteTop + (NOTE_ROWS - 1 - n.row) * noteStep,
    h: noteStep - 1,
  }));

  const autoRow = r.auto;
  const vy = linScale(0, 1, autoRow.bot - 3, autoRow.top + 3);
  const autoPts = AUTOMATION.map((p) => ({ x: sx(p.ppq), y: vy(p.value) }));

  return {
    clip: { x: sx(CLIP.start), w: sx(clipEnd) - sx(CLIP.start), row: r.audio },
    noteX: sx(clipEnd) + 10,
    takes,
    comp,
    compRow,
    midiClip: {
      x: sx(MIDI_CLIP.start),
      w: sx(MIDI_CLIP.start + MIDI_CLIP.length) - sx(MIDI_CLIP.start),
      row: midiRow,
    },
    notes,
    autoRow,
    autoPts,
    autoPath: path(autoPts.map((p) => [p.x, p.y])),
  };
});

const legend = computed<FigureLegendItem[]>(() =>
  TAKES.map((t) => ({
    series: t.series as FigureLegendItem['series'],
    shape: 'block' as const,
    label: `${label('take')} ${t.id}`,
  })),
);
</script>

<template>
  <FigureFrame
    :title="props.title"
    :caption="props.caption"
    :view-box="`0 0 ${W} ${H}`"
    :width="W"
    :legend="legend"
  >
    <!-- Lane backgrounds and names -->
    <g v-for="row in rowList" :key="row.id">
      <rect class="fx-lane" :x="X0" :y="row.top" :width="X1 - X0" :height="row.bot - row.top" rx="2" />
      <text class="fx-axis-label" :x="GUTTER_X + row.depth * INDENT" :y="row.mid + 3.5">
        {{ row.text }}
      </text>
    </g>
    <g v-for="(b, i) in brackets" :key="`br-${i}`">
      <line class="fx-leader" :x1="b.x" :x2="b.x" :y1="b.y1" :y2="b.y2" />
      <line
        v-for="(sy, j) in b.stubs"
        :key="`stub-${i}-${j}`"
        class="fx-leader"
        :x1="b.x"
        :x2="b.x + INDENT / 2 - 2"
        :y1="sy"
        :y2="sy"
      />
    </g>

    <!-- Beat and bar grid: every beat line is one quarter note, 1.0 PPQ -->
    <line
      v-for="(b, i) in grid.beats"
      :key="`beat-${i}`"
      :class="b.bar ? 'fx-grid fx-grid--strong' : 'fx-grid'"
      :x1="b.x"
      :x2="b.x"
      :y1="b.bar ? RULER_BOT : rowList[0].top"
      :y2="LANES_BOT"
    />

    <!-- Ruler: bars on top, PPQ underneath -->
    <line class="fx-axis" :x1="X0" :x2="X1" :y1="RULER_BOT" :y2="RULER_BOT" />
    <text
      v-for="b in grid.bars"
      :key="`bar-${b.n}`"
      class="fx-tick"
      :x="b.x + 4"
      :y="RULER_TOP + 9"
    >
      {{ label('bar') }} {{ b.n }}
    </text>
    <line class="fx-axis" :x1="X0" :x2="X1" :y1="AXIS_Y" :y2="AXIS_Y" />
    <g v-for="(b, i) in grid.beats" :key="`ppq-${i}`">
      <line class="fx-axis" :x1="b.x" :x2="b.x" :y1="AXIS_Y" :y2="AXIS_Y + (b.bar ? 5 : 2.5)" />
      <text v-if="b.bar" class="fx-tick" :x="b.x" :y="AXIS_Y + 15" text-anchor="middle">
        {{ i }}
      </text>
    </g>
    <text class="fx-axis-label" :x="X1" :y="AXIS_Y + 29" text-anchor="end">{{ label('axis') }}</text>

    <!-- Audio track: the clip container -->
    <rect
      class="fx-block fx-block--muted"
      :x="geom.clip.x"
      :y="geom.clip.row.top + 3"
      :width="geom.clip.w"
      :height="geom.clip.row.bot - geom.clip.row.top - 6"
      rx="2"
    />
    <text class="fx-value" :x="geom.clip.x + 6" :y="geom.clip.row.mid + 3.5">{{ label('clip') }}</text>
    <text class="fx-tick" :x="geom.noteX" :y="geom.clip.row.mid + 3">
      startPpq {{ CLIP.start }} · lengthPpq {{ CLIP.length }}
    </text>

    <!-- Takes: muted across the clip, coloured only where the comp picks them -->
    <g v-for="t in geom.takes" :key="`take-${t.id}`">
      <rect
        class="fx-block fx-block--muted"
        :x="geom.clip.x"
        :y="t.row.top + 2"
        :width="geom.clip.w"
        :height="t.row.bot - t.row.top - 4"
        rx="2"
      />
      <rect
        v-for="(p, i) in t.picked"
        :key="`pick-${t.id}-${i}`"
        :class="`fx-block fx-block--${t.series}`"
        :x="p.x"
        :y="t.row.top + 2"
        :width="p.w"
        :height="t.row.bot - t.row.top - 4"
        rx="2"
      />
      <rect
        v-for="(f, i) in t.fallback"
        :key="`fall-${t.id}-${i}`"
        :class="`fx-area fx-area--${t.series}`"
        :x="f.x"
        :y="t.row.top + 2"
        :width="f.w"
        :height="t.row.bot - t.row.top - 4"
        rx="2"
      />
      <text v-if="t.active" class="fx-note" :x="geom.noteX" :y="t.row.mid + 3.5">
        {{ label('activeNote') }}
      </text>
    </g>

    <!-- Comp lane: one take per region; the active take shows through the gaps -->
    <g v-for="(s, i) in geom.comp" :key="`comp-${i}`">
      <rect
        :class="s.fallback ? `fx-area fx-area--${s.series}` : `fx-block fx-block--${s.series}`"
        :x="s.x"
        :y="geom.compRow.top + 2"
        :width="s.w"
        :height="geom.compRow.bot - geom.compRow.top - 4"
        rx="2"
      />
      <text :class="`fx-value fx-value--${s.series}`" :x="s.x + 5" :y="geom.compRow.mid + 3.5">
        {{ label('take') }} {{ s.takeId }}
      </text>
    </g>
    <text class="fx-note fx-note--strong" :x="geom.noteX" :y="geom.compRow.mid + 3.5">
      {{ label('compNote') }}
    </text>

    <!-- MIDI track: a clip of note events on the same PPQ axis -->
    <rect
      class="fx-block fx-block--muted"
      :x="geom.midiClip.x"
      :y="geom.midiClip.row.top + 3"
      :width="geom.midiClip.w"
      :height="geom.midiClip.row.bot - geom.midiClip.row.top - 6"
      rx="2"
    />
    <rect
      v-for="(n, i) in geom.notes"
      :key="`note-${i}`"
      class="fx-cell"
      :x="n.x"
      :y="n.y"
      :width="n.w"
      :height="n.h"
      rx="1"
    />
    <text class="fx-value" :x="geom.midiClip.x - 6" :y="geom.midiClip.row.mid + 3.5" text-anchor="end">
      {{ label('midiClip') }}
    </text>

    <!-- Automation lane: breakpoints at PPQ positions, owned by the track -->
    <path class="fx-curve fx-curve--thin" :d="geom.autoPath" />
    <circle
      v-for="(p, i) in geom.autoPts"
      :key="`auto-${i}`"
      class="fx-dot"
      :cx="p.x"
      :cy="p.y"
      r="2.6"
    />
  </FigureFrame>
</template>
