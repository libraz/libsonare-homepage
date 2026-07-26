<script setup lang="ts">
/**
 * What "gated integrated LUFS" throws away.
 *
 * Integrated loudness is not the average of the whole file. Blocks below the
 * absolute gate (−70 LUFS) never count at all, and a second, relative gate
 * 10 LU below the surviving mean drops the quiet material as well — so silence
 * and a hushed intro cannot drag the number down. This is why a track's
 * integrated LUFS sits close to the level of its *body*, not of its timeline.
 */
import { computed } from 'vue';
import FigureFrame, { type FigureLegendItem } from './FigureFrame.vue';
import { gatedMean, linScale, loudnessBlocks } from './figureMath';

const props = withDefaults(
  defineProps<{
    title?: string;
    caption?: string;
    /** Number of 400 ms blocks drawn. */
    blocks?: number;
    labels?: Partial<Record<Key, string>>;
  }>(),
  { blocks: 60 },
);

type Key =
  | 'axisTime'
  | 'axisLoudness'
  | 'counted'
  | 'relativeOut'
  | 'absoluteOut'
  | 'absoluteGate'
  | 'relativeGate'
  | 'integrated'
  | 'blockNote';

const DEFAULTS: Record<Key, string> = {
  axisTime: '400 ms blocks, in order',
  axisLoudness: 'block loudness (LUFS)',
  counted: 'counted toward the integrated value',
  relativeOut: 'dropped by the relative gate',
  absoluteOut: 'dropped by the absolute gate',
  absoluteGate: 'absolute gate −70 LUFS',
  relativeGate: 'relative gate — 10 LU below',
  integrated: 'integrated LUFS',
  blockNote: 'silence and a quiet intro never reach the average',
};

const label = (key: Key) => props.labels?.[key] ?? DEFAULTS[key];

const legend = computed<FigureLegendItem[]>(() => [
  { series: 1, shape: 'block', label: label('counted') },
  { series: 3, shape: 'block', label: label('relativeOut') },
  { series: 0, shape: 'block', label: label('absoluteOut') },
]);

const X0 = 70;
const X1 = 600;
const Y0 = 40;
const Y1 = 230;
const TOP_DB = -5;
const BOT_DB = -82;
const ABSOLUTE = -70;

const y = linScale(TOP_DB, BOT_DB, Y0, Y1);

const geom = computed(() => {
  const values = loudnessBlocks(props.blocks);
  const relative = gatedMean(values, ABSOLUTE) - 10;
  const integrated = gatedMean(values, Math.max(ABSOLUTE, relative));
  const slot = (X1 - X0) / props.blocks;
  return {
    relative,
    integrated,
    bars: values.map((db, i) => ({
      x: X0 + i * slot + 1,
      w: Math.max(2, slot - 2),
      y: y(db),
      h: Y1 - y(db),
      state: db <= ABSOLUTE ? 'absolute' : db <= relative ? 'relative' : 'counted',
    })),
  };
});

const dbTicks = [-10, -20, -30, -40, -50, -60, -70, -80];
</script>

<template>
  <FigureFrame
    :title="props.title"
    :caption="props.caption"
    view-box="0 0 640 292"
    :width="640"
    :legend="legend"
  >
    <g v-for="db in dbTicks" :key="`db-${db}`">
      <line class="fx-grid fx-grid--dashed" :x1="X0" :x2="X1" :y1="y(db)" :y2="y(db)" />
      <text class="fx-tick" :x="X0 - 8" :y="y(db)" text-anchor="end" dy="0.34em">{{ db }}</text>
    </g>

    <rect
      v-for="(b, i) in geom.bars"
      :key="`b-${i}`"
      :class="
        b.state === 'counted'
          ? 'fx-block'
          : b.state === 'relative'
            ? 'fx-block fx-block--3'
            : 'fx-block fx-block--muted'
      "
      :x="b.x"
      :y="b.y"
      :width="b.w"
      :height="b.h"
    />

    <!-- Gates -->
    <line class="fx-guide fx-guide--neutral" :x1="X0" :x2="X1" :y1="y(ABSOLUTE)" :y2="y(ABSOLUTE)" />
    <text class="fx-value" :x="X1 - 2" :y="y(ABSOLUTE) - 6" text-anchor="end">
      {{ label('absoluteGate') }}
    </text>

    <line
      class="fx-guide"
      :x1="X0"
      :x2="X1"
      :y1="y(geom.relative)"
      :y2="y(geom.relative)"
    />
    <text class="fx-value fx-value--3" :x="X1 - 2" :y="y(geom.relative) + 14" text-anchor="end">
      {{ label('relativeGate') }}
    </text>

    <!-- Result -->
    <line
      class="fx-curve fx-curve--4 fx-curve--thin"
      :x1="X0"
      :x2="X1"
      :y1="y(geom.integrated)"
      :y2="y(geom.integrated)"
    />
    <text class="fx-value fx-value--4" :x="X1 - 2" :y="y(geom.integrated) - 6" text-anchor="end">
      {{ label('integrated') }} {{ geom.integrated.toFixed(1) }}
    </text>

    <!-- Axes -->
    <line class="fx-axis" :x1="X0" :x2="X0" :y1="Y0" :y2="Y1" />
    <line class="fx-axis" :x1="X0" :x2="X1" :y1="Y1" :y2="Y1" />
    <text class="fx-axis-label" :x="X0" :y="Y1 + 18">{{ label('axisTime') }}</text>
    <text class="fx-axis-label" :x="X1" :y="Y1 + 18" text-anchor="end">{{ label('blockNote') }}</text>
    <text
      class="fx-axis-label"
      :x="20"
      :y="(Y0 + Y1) / 2"
      text-anchor="middle"
      :transform="`rotate(-90 20 ${(Y0 + Y1) / 2})`"
    >
      {{ label('axisLoudness') }}
    </text>
  </FigureFrame>
</template>
