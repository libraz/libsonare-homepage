<script setup lang="ts">
/**
 * Crest factor as a distance you can see.
 *
 * Both panels are normalised to the same peak, so the only difference is how
 * much of the time the signal sits near that peak. The gap between the peak line
 * and the RMS line *is* the crest factor — which is why two files can share a
 * peak level and still feel nothing alike, and why "crest dropped" and "peaks
 * were shaved" are the same observation.
 */
import { computed } from 'vue';
import FigureFrame, { type FigureLegendItem } from './FigureFrame.vue';
import { areaPath, crestStats, crestWave, linScale, path } from './figureMath';

const props = defineProps<{
  title?: string;
  caption?: string;
  labels?: Partial<Record<Key, string>>;
}>();

type Key = 'high' | 'low' | 'peak' | 'rms' | 'crest' | 'signal';

const DEFAULTS: Record<Key, string> = {
  high: 'high crest factor',
  low: 'low crest factor',
  peak: 'peak',
  rms: 'RMS',
  crest: 'crest',
  signal: 'waveform envelope',
};

const label = (key: Key) => props.labels?.[key] ?? DEFAULTS[key];

const legend = computed<FigureLegendItem[]>(() => [
  { series: 1, label: label('signal') },
  { series: 5, shape: 'dashed', label: label('peak') },
  { series: 2, shape: 'dashed', label: label('rms') },
]);

const TOP = 56;
const BOT = 208;
const MID = (TOP + BOT) / 2;
const AMP = (BOT - TOP) / 2;

const PANELS = [
  { x0: 60, x1: 306, transient: 1, bed: 0.26, key: 'high' as const },
  { x0: 350, x1: 596, transient: 0.96, bed: 0.8, key: 'low' as const },
];

/** Level in [0,1] → distance from the centre line. */
const lift = linScale(0, 1, 0, AMP);

const panels = computed(() =>
  PANELS.map((p) => {
    const wave = crestWave(300, p.transient, p.bed);
    const stats = crestStats(wave);
    const sx = linScale(0, 1, p.x0, p.x1);
    const top = wave.map(([s, v]) => [sx(s), MID - lift(v)] as [number, number]);
    const bottom = wave.map(([s, v]) => [sx(s), MID + lift(v)] as [number, number]);
    const peakY = MID - lift(10 ** (stats.peakDb / 20));
    const rmsY = MID - lift(10 ** (stats.rmsDb / 20));
    return {
      ...p,
      title: label(p.key),
      top: path(top),
      bottom: path(bottom),
      area: `${areaPath(top, MID)} ${areaPath(bottom, MID)}`,
      peakY,
      rmsY,
      crestLabel: `${stats.crestDb.toFixed(1)} dB`,
      cx: (p.x0 + p.x1) / 2,
    };
  }),
);
</script>

<template>
  <FigureFrame
    :title="props.title"
    :caption="props.caption"
    view-box="0 0 640 268"
    :width="640"
    :legend="legend"
  >
    <g v-for="p in panels" :key="`p-${p.key}`">
      <text class="fx-axis-label" :x="p.x0" y="36">{{ p.title }}</text>

      <path class="fx-area" :d="p.area" />
      <path class="fx-curve fx-curve--thin" :d="p.top" />
      <path class="fx-curve fx-curve--thin" :d="p.bottom" />
      <line class="fx-grid" :x1="p.x0" :x2="p.x1" :y1="MID" :y2="MID" />

      <!-- Peak and RMS -->
      <line
        class="fx-curve fx-curve--5 fx-curve--thin fx-curve--dashed"
        :x1="p.x0"
        :x2="p.x1"
        :y1="p.peakY"
        :y2="p.peakY"
      />
      <text class="fx-value fx-value--5" :x="p.x1 + 4" :y="p.peakY + 4">{{ label('peak') }}</text>
      <line
        class="fx-curve fx-curve--2 fx-curve--thin fx-curve--dashed"
        :x1="p.x0"
        :x2="p.x1"
        :y1="p.rmsY"
        :y2="p.rmsY"
      />
      <text class="fx-value fx-value--2" :x="p.x1 + 4" :y="p.rmsY + 4">{{ label('rms') }}</text>

      <!-- The gap between them -->
      <line
        class="fx-curve fx-curve--3 fx-curve--thin"
        :x1="p.x0 + 14"
        :x2="p.x0 + 14"
        :y1="p.peakY"
        :y2="p.rmsY"
      />
      <rect
        class="fx-plate"
        :x="p.x0 + 18"
        :y="(p.peakY + p.rmsY) / 2 - 8"
        width="62"
        height="16"
      />
      <text class="fx-value fx-value--3" :x="p.x0 + 20" :y="(p.peakY + p.rmsY) / 2 + 4">
        {{ label('crest') }} {{ p.crestLabel }}
      </text>
    </g>
  </FigureFrame>
</template>
