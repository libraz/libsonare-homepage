<script setup lang="ts">
/**
 * Why an even-Hz grid is the wrong grid for pitch.
 *
 * Two octaves, drawn at the same width. A CQT-style bank puts the same number of
 * bins in each — one per semitone — while an STFT's bins are spaced a constant
 * number of hertz apart, so the low octave gets a handful and the high octave
 * gets hundreds. That single asymmetry is the whole argument for log-frequency
 * transforms, and it is much harder to believe from a table.
 */
import { computed } from 'vue';
import FigureFrame, { type FigureLegendItem } from './FigureFrame.vue';
import { logScale } from './figureMath';

const props = withDefaults(
  defineProps<{
    title?: string;
    caption?: string;
    /** Sample rate and FFT length that set the STFT bin spacing. */
    sampleRate?: number;
    nFft?: number;
    labels?: Partial<Record<Key, string>>;
  }>(),
  { sampleRate: 44100, nFft: 2048 },
);

type Key = 'cqt' | 'stft' | 'lowOctave' | 'highOctave' | 'binUnit';

const DEFAULTS: Record<Key, string> = {
  cqt: 'CQT bins — one per semitone',
  stft: 'STFT bins — constant Hz spacing',
  lowOctave: 'a low octave',
  highOctave: 'a high octave',
  binUnit: 'bins',
};

const label = (key: Key) => props.labels?.[key] ?? DEFAULTS[key];

const legend = computed<FigureLegendItem[]>(() => [
  { series: 2, label: label('cqt') },
  { series: 1, label: label('stft') },
]);

const PANELS = [
  { x0: 56, x1: 306, lo: 110, hi: 220, key: 'lowOctave' as const },
  { x0: 350, x1: 600, lo: 3520, hi: 7040, key: 'highOctave' as const },
];

const CQT_TOP = 52;
const CQT_BOT = 80;
const STFT_TOP = 106;
const STFT_BOT = 134;

const spacing = computed(() => props.sampleRate / props.nFft);

const panels = computed(() =>
  PANELS.map((p) => {
    const x = logScale(p.lo, p.hi, p.x0, p.x1);
    // Twelve equal-tempered steps: evenly spaced on a log axis by construction.
    const semitones = Array.from({ length: 13 }, (_, i) => x(p.lo * 2 ** (i / 12)));
    const first = Math.ceil(p.lo / spacing.value);
    const last = Math.floor(p.hi / spacing.value);
    const bins: number[] = [];
    for (let k = first; k <= last; k++) bins.push(x(k * spacing.value));
    return {
      ...p,
      title: `${label(p.key)} · ${p.lo}–${p.hi} Hz`,
      semitones,
      bins,
      cqtCount: `12 ${label('binUnit')}`,
      stftCount: `${bins.length} ${label('binUnit')}`,
      cx: (p.x0 + p.x1) / 2,
    };
  }),
);

const note = computed(
  () => `${spacing.value.toFixed(1)} Hz · ${props.sampleRate / 1000} kHz / ${props.nFft}`,
);
</script>

<template>
  <FigureFrame
    :title="props.title"
    :caption="props.caption"
    view-box="0 0 640 190"
    :width="640"
    :legend="legend"
  >
    <g v-for="p in panels" :key="`p-${p.lo}`">
      <text class="fx-axis-label" :x="p.cx" y="34" text-anchor="middle">{{ p.title }}</text>

      <!-- CQT lane -->
      <rect
        class="fx-lane"
        :x="p.x0"
        :y="CQT_TOP"
        :width="p.x1 - p.x0"
        :height="CQT_BOT - CQT_TOP"
        rx="3"
      />
      <line
        v-for="(sx, i) in p.semitones"
        :key="`s-${i}`"
        class="fx-curve fx-curve--2 fx-curve--thin"
        :x1="sx"
        :x2="sx"
        :y1="CQT_TOP + 4"
        :y2="CQT_BOT - 4"
      />
      <text class="fx-value fx-value--2" :x="p.cx" :y="CQT_BOT + 16" text-anchor="middle">
        {{ p.cqtCount }}
      </text>

      <!-- STFT lane -->
      <rect
        class="fx-lane"
        :x="p.x0"
        :y="STFT_TOP"
        :width="p.x1 - p.x0"
        :height="STFT_BOT - STFT_TOP"
        rx="3"
      />
      <line
        v-for="(bx, i) in p.bins"
        :key="`b-${i}`"
        class="fx-curve fx-curve--thin"
        :x1="bx"
        :x2="bx"
        :y1="STFT_TOP + 4"
        :y2="STFT_BOT - 4"
      />
      <text class="fx-value fx-value--1" :x="p.cx" :y="STFT_BOT + 16" text-anchor="middle">
        {{ p.stftCount }}
      </text>
    </g>

    <text class="fx-axis-label" x="600" y="176" text-anchor="end">{{ note }}</text>
  </FigureFrame>
</template>
