<script setup lang="ts">
/** A strip's EQ response as a thumbnail: log frequency across, ±rangeDb up and down. */
import { computed } from 'vue';
import type { EqCurvePoint } from '@/demos/mixing/mixingEqResponse';

const props = withDefaults(
  defineProps<{
    points: readonly EqCurvePoint[] | null;
    rangeDb?: number;
  }>(),
  { rangeDb: 18 },
);

const W = 100;
const H = 32;
const LOG_SPAN = Math.log(1000);

const path = computed(() => {
  const points = props.points;
  if (!points || points.length === 0) return `M 0 ${H / 2} L ${W} ${H / 2}`;
  return points
    .map((point, i) => {
      const x = (Math.log(point.freqHz / 20) / LOG_SPAN) * W;
      const db = Number.isFinite(point.db) ? point.db : -props.rangeDb;
      const y =
        H / 2 -
        (Math.max(-props.rangeDb, Math.min(props.rangeDb, db)) / props.rangeDb) * (H / 2 - 1);
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
});
</script>

<template>
  <svg class="eq-curve" :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" aria-hidden="true">
    <line class="eq-curve__zero" x1="0" :y1="H / 2" :x2="W" :y2="H / 2" />
    <path class="eq-curve__line" :d="path" />
  </svg>
</template>

<style scoped>
.eq-curve {
  display: block;
  width: 100%;
  height: 28px;
}

.eq-curve__zero {
  stroke: var(--demo-border-strong);
  stroke-dasharray: 2 2;
  stroke-width: 0.6;
  vector-effect: non-scaling-stroke;
}

.eq-curve__line {
  fill: none;
  stroke: var(--demo-accent);
  stroke-width: 1.4;
  vector-effect: non-scaling-stroke;
}
</style>
