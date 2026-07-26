<script setup lang="ts">
/**
 * What `nFft` and `hopLength` actually do to the signal.
 *
 * The parameter table says "window size" and "step between windows", which only
 * lands once you see that consecutive windows cover mostly the same samples:
 * with the defaults each sample is analysed four times, and the tapered window
 * edges are filled in by the neighbours. One frame becomes one spectrogram
 * column, so hopLength — not nFft — sets how many columns per second you get.
 */
import { computed } from 'vue';
import FigureFrame, { type FigureLegendItem } from './FigureFrame.vue';
import { linScale, path, sample, wobble } from './figureMath';

const props = defineProps<{
  title?: string;
  caption?: string;
  labels?: Partial<Record<Key, string>>;
}>();

type Key = 'signal' | 'windows' | 'frames' | 'nfft' | 'hop' | 'overlap' | 'column' | 'continues';

const DEFAULTS: Record<Key, string> = {
  signal: 'input samples',
  windows: 'windowed frames',
  frames: 'spectrogram columns',
  nfft: 'nFft — window length',
  hop: 'hopLength',
  overlap: 'the same samples, analysed again',
  column: 'one FFT per frame → one column',
  continues: '…',
};

const label = (key: Key) => props.labels?.[key] ?? DEFAULTS[key];

const legend = computed<FigureLegendItem[]>(() => [
  { series: 1, label: label('windows') },
  { series: 3, shape: 'block', label: label('overlap') },
  { series: 2, shape: 'block', label: label('frames') },
]);

const X0 = 70;
const X1 = 604;
// One window is four hops wide, matching the 2048 / 512 defaults.
const WIN_W = 200;
const HOP = WIN_W / 4;
const STARTS = [X0, X0 + HOP, X0 + HOP * 2, X0 + HOP * 3, X0 + HOP * 4, X0 + HOP * 5];

const SIG_TOP = 42;
const SIG_BOT = 100;
const NFFT_Y = 118;
const WIN_LABEL_Y = 142;
const WIN_BASE = 236;
const WIN_H = 84;
const HOP_Y = 248;
const FRAME_LABEL_Y = 276;
const FRAME_TOP = 284;
const FRAME_BOT = 328;

const sigY = linScale(-1, 1, SIG_BOT, SIG_TOP);

const geom = computed(() => ({
  signal: path(
    sample(0, 1, 320, (s) => sigY(wobble(s * 4.4, 0.9) * 0.72)).map(([s, py]) => [
      X0 + s * (X1 - X0),
      py,
    ]),
  ),
  // Hann bells on a shared baseline, so the overlap is unmistakable.
  windows: STARTS.map((start, i) => ({
    d: path(
      sample(0, 1, 48, (u) => WIN_BASE - 0.5 * (1 - Math.cos(2 * Math.PI * u)) * WIN_H).map(
        ([u, py]) => [start + u * WIN_W, py],
      ),
    ),
    ghost: i > 2,
  })),
  // Each frame is centred on its window and yields one column.
  frames: STARTS.map((start, i) => ({
    x: start + WIN_W / 2 - 7,
    ghost: i > 2,
  })),
  overlap: { x: STARTS[1], w: STARTS[0] + WIN_W - STARTS[1] },
}));
</script>

<template>
  <FigureFrame
    :title="props.title"
    :caption="props.caption"
    view-box="0 0 640 372"
    :width="640"
    :legend="legend"
  >
    <!-- ===== Signal ===== -->
    <text class="fx-axis-label" :x="X0" :y="SIG_TOP - 14">{{ label('signal') }}</text>
    <line
      class="fx-grid"
      :x1="X0"
      :x2="X1"
      :y1="(SIG_TOP + SIG_BOT) / 2"
      :y2="(SIG_TOP + SIG_BOT) / 2"
    />
    <path class="fx-curve fx-curve--thin" :d="geom.signal" />

    <!-- nFft span -->
    <path
      class="fx-leader"
      :d="`M ${X0} ${NFFT_Y - 8} L ${X0} ${NFFT_Y + 8} M ${X0 + WIN_W} ${NFFT_Y - 8} L ${X0 + WIN_W} ${NFFT_Y + 8}`"
    />
    <path class="fx-axis" :d="`M ${X0} ${NFFT_Y} L ${X0 + WIN_W} ${NFFT_Y}`" />
    <rect class="fx-plate" :x="X0 + 22" :y="NFFT_Y - 8" :width="WIN_W - 44" height="16" />
    <text class="fx-value" :x="X0 + WIN_W / 2" :y="NFFT_Y + 4" text-anchor="middle">
      {{ label('nfft') }}
    </text>

    <!-- ===== Windows ===== -->
    <text class="fx-axis-label" :x="X0" :y="WIN_LABEL_Y">{{ label('windows') }}</text>
    <rect
      class="fx-area fx-area--3"
      :x="geom.overlap.x"
      :y="WIN_BASE - WIN_H - 6"
      :width="geom.overlap.w"
      :height="WIN_H + 6"
    />
    <line class="fx-axis" :x1="X0" :x2="X1" :y1="WIN_BASE" :y2="WIN_BASE" />
    <path
      v-for="(w, i) in geom.windows"
      :key="`win-${i}`"
      :class="w.ghost ? 'fx-curve fx-curve--ghost' : 'fx-curve fx-curve--thin'"
      :d="w.d"
    />

    <!-- hop span -->
    <path
      class="fx-leader"
      :d="`M ${X0} ${HOP_Y - 8} L ${X0} ${HOP_Y + 8} M ${X0 + HOP} ${HOP_Y - 8} L ${X0 + HOP} ${HOP_Y + 8}`"
    />
    <path class="fx-axis" :d="`M ${X0} ${HOP_Y} L ${X0 + HOP} ${HOP_Y}`" />
    <text class="fx-value fx-value--1" :x="X0 + HOP + 8" :y="HOP_Y + 4">{{ label('hop') }}</text>

    <!-- ===== Frames ===== -->
    <text class="fx-axis-label" :x="X0" :y="FRAME_LABEL_Y">{{ label('frames') }}</text>
    <rect
      v-for="(f, i) in geom.frames"
      :key="`fr-${i}`"
      :class="f.ghost ? 'fx-block fx-block--outline' : 'fx-block fx-block--2'"
      :x="f.x"
      :y="FRAME_TOP"
      width="14"
      :height="FRAME_BOT - FRAME_TOP"
      rx="2"
    />
    <text class="fx-note" :x="X0" :y="FRAME_BOT + 18">{{ label('column') }}</text>
    <text class="fx-axis-label" :x="X1 - 4" :y="FRAME_TOP + 26" text-anchor="end">
      {{ label('continues') }}
    </text>
  </FigureFrame>
</template>
