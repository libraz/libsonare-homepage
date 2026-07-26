<script setup lang="ts">
/**
 * What a warp marker is: a pinned correspondence between a point in the source
 * audio and a point on the project timeline.
 *
 * Between two markers the audio is resampled to fit whatever distance the
 * timeline gives it, so one span can be stretched while the next is compressed
 * in the same clip. The trapezoids are those spans — their slant is the local
 * playback-rate change, and the beat grid underneath is what the markers were
 * pinned to.
 */
import { computed } from 'vue';
import FigureFrame, { type FigureLegendItem } from './FigureFrame.vue';
import { linScale, path, sample, wobble } from './figureMath';

export interface WarpMarker {
  /** Position in the source audio, 0-1. */
  source: number;
  /** Position on the timeline, 0-1. */
  timeline: number;
}

const props = withDefaults(
  defineProps<{
    title?: string;
    caption?: string;
    markers?: WarpMarker[];
    /** Beat divisions drawn on the timeline lane. */
    beats?: number;
    labels?: Partial<Record<Key, string>>;
  }>(),
  {
    beats: 8,
    markers: () => [
      { source: 0, timeline: 0 },
      { source: 0.18, timeline: 0.25 },
      { source: 0.34, timeline: 0.5 },
      { source: 0.55, timeline: 0.75 },
      { source: 0.78, timeline: 0.875 },
      { source: 1, timeline: 1 },
    ],
  },
);

type Key = 'sourceLane' | 'timelineLane' | 'marker' | 'stretched' | 'compressed' | 'grid';

const DEFAULTS: Record<Key, string> = {
  sourceLane: 'source audio, as recorded',
  timelineLane: 'the project timeline',
  marker: 'warp marker',
  stretched: 'stretched',
  compressed: 'compressed',
  grid: 'beat grid',
};

const label = (key: Key) => props.labels?.[key] ?? DEFAULTS[key];

const legend = computed<FigureLegendItem[]>(() => [
  { series: 2, shape: 'block', label: label('stretched') },
  { series: 3, shape: 'block', label: label('compressed') },
  { series: 1, label: label('marker') },
]);

const X0 = 70;
const X1 = 606;
const SRC_TOP = 52;
const SRC_BOT = 100;
const TL_TOP = 190;
const TL_BOT = 238;

const x = linScale(0, 1, X0, X1);
const srcMid = (SRC_TOP + SRC_BOT) / 2;

const geom = computed(() => {
  const spans = [];
  for (let i = 0; i < props.markers.length - 1; i++) {
    const a = props.markers[i];
    const b = props.markers[i + 1];
    const srcLen = b.source - a.source;
    const tlLen = b.timeline - a.timeline;
    // A span drawn wider on the timeline than in the source is being stretched.
    const ratio = tlLen / srcLen;
    spans.push({
      points: [
        `${x(a.source)},${SRC_BOT}`,
        `${x(b.source)},${SRC_BOT}`,
        `${x(b.timeline)},${TL_TOP}`,
        `${x(a.timeline)},${TL_TOP}`,
      ].join(' '),
      ratio,
      kind: ratio > 1.08 ? 'stretch' : ratio < 0.92 ? 'compress' : 'neutral',
      cx: (x(a.source) + x(b.source) + x(a.timeline) + x(b.timeline)) / 4,
      cy: (SRC_BOT + TL_TOP) / 2,
      label: ratio > 1.08 ? label('stretched') : ratio < 0.92 ? label('compressed') : '',
    });
  }
  return {
    spans,
    waveform: path(
      sample(0, 1, 340, (s) => srcMid + wobble(s * 6.1, 2.4) * 18).map(([s, py]) => [x(s), py]),
    ),
    markers: props.markers,
    beats: Array.from({ length: props.beats + 1 }, (_, i) => x(i / props.beats)),
  };
});
</script>

<template>
  <FigureFrame
    :title="props.title"
    :caption="props.caption"
    view-box="0 0 640 290"
    :width="640"
    :legend="legend"
  >
    <!-- Mapping between the lanes -->
    <polygon
      v-for="(s, i) in geom.spans"
      :key="`span-${i}`"
      :class="
        s.kind === 'stretch'
          ? 'fx-area fx-area--2'
          : s.kind === 'compress'
            ? 'fx-area fx-area--3'
            : 'fx-area fx-area--faint'
      "
      :points="s.points"
    />
    <text
      v-for="(s, i) in geom.spans"
      :key="`sl-${i}`"
      class="fx-axis-label"
      :x="s.cx"
      :y="s.cy"
      text-anchor="middle"
    >
      {{ s.label }}
    </text>

    <!-- Source lane -->
    <text class="fx-axis-label" :x="X0" :y="SRC_TOP - 12">{{ label('sourceLane') }}</text>
    <rect class="fx-lane" :x="X0" :y="SRC_TOP" :width="X1 - X0" :height="SRC_BOT - SRC_TOP" rx="3" />
    <path class="fx-curve fx-curve--thin" :d="geom.waveform" />

    <!-- Timeline lane, with the grid the markers were pinned to -->
    <rect class="fx-lane" :x="X0" :y="TL_TOP" :width="X1 - X0" :height="TL_BOT - TL_TOP" rx="3" />
    <line
      v-for="(bx, i) in geom.beats"
      :key="`beat-${i}`"
      class="fx-grid"
      :x1="bx"
      :x2="bx"
      :y1="TL_TOP"
      :y2="TL_BOT"
    />
    <text class="fx-axis-label" :x="X0" :y="TL_BOT + 18">{{ label('grid') }}</text>
    <text class="fx-axis-label" :x="X1" :y="TL_BOT + 18" text-anchor="end">
      {{ label('timelineLane') }}
    </text>

    <!-- Markers -->
    <g v-for="(m, i) in geom.markers" :key="`m-${i}`">
      <line
        class="fx-curve fx-curve--thin"
        :x1="x(m.source)"
        :x2="x(m.source)"
        :y1="SRC_TOP"
        :y2="SRC_BOT"
      />
      <circle class="fx-dot" :cx="x(m.source)" :cy="SRC_BOT" r="3.2" />
      <circle class="fx-dot" :cx="x(m.timeline)" :cy="TL_TOP" r="3.2" />
      <line
        class="fx-curve fx-curve--thin"
        :x1="x(m.timeline)"
        :x2="x(m.timeline)"
        :y1="TL_TOP"
        :y2="TL_BOT"
      />
    </g>
  </FigureFrame>
</template>
