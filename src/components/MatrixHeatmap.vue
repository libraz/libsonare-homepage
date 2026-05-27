<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useTheme } from '@/composables/useTheme';

const props = defineProps<{
  rows: number;
  columns: number;
  values: Float32Array;
  min: number;
  max: number;
  label?: string;
}>();

const { isDark } = useTheme();
const canvasRef = ref<HTMLCanvasElement | null>(null);

function draw() {
  const canvas = canvasRef.value;
  if (!canvas || !props.rows || !props.columns) return;

  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const cellWidth = canvas.width / props.columns;
  const cellHeight = canvas.height / props.rows;
  const range = Math.max(1e-9, props.max - props.min);
  const dark = isDark.value;

  for (let r = 0; r < props.rows; r++) {
    for (let c = 0; c < props.columns; c++) {
      const value = props.values[r * props.columns + c];
      const normalized = Math.max(0, Math.min(1, (value - props.min) / range));
      const hue = 194 + normalized * 78;
      // Dark mode: low energy fades to near-black. Light mode: invert the ramp
      // so low energy is near-white and the heatmap matches the light page.
      const saturation = dark ? 85 : 72;
      const lightness = dark ? 12 + normalized * 54 : 96 - normalized * 54;
      ctx.fillStyle = `hsl(${hue} ${saturation}% ${lightness}%)`;
      ctx.fillRect(
        c * cellWidth,
        (props.rows - 1 - r) * cellHeight,
        Math.ceil(cellWidth),
        Math.ceil(cellHeight),
      );
    }
  }

  if (dark) {
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
    gradient.addColorStop(0, 'rgba(255,255,255,0.08)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

onMounted(draw);
watch(() => [props.rows, props.columns, props.values, props.min, props.max, isDark.value], draw, {
  deep: false,
});
</script>

<template>
  <div class="heatmap">
    <canvas ref="canvasRef" class="heatmap__canvas" :aria-label="label"></canvas>
  </div>
</template>

<style scoped>
.heatmap {
  position: relative;
  min-height: 220px;
  height: 100%;
  border: 1px solid var(--demo-border, rgba(139, 92, 246, 0.12));
  border-radius: 8px;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.28);
}

html:not(.dark) .heatmap {
  background: rgba(255, 255, 255, 0.6);
}

.heatmap__canvas {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 220px;
}
</style>

