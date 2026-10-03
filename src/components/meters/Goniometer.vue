<script lang="ts">
/** Visitor-facing copy for {@link Goniometer}; the demo passes its own locale. */
export interface GoniometerLabels {
  /** Accessible name of the scope. */
  name: string;
}
</script>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import { useCanvasRedraw } from '@/composables/useCanvasRedraw';

const props = defineProps<{
  /** Mid points, (L + R) / √2, as returned by `meteringPhaseScope`. */
  mid: ArrayLike<number> | null;
  /** Side points, (L - R) / √2, paired with {@link mid}. */
  side: ArrayLike<number> | null;
  labels: GoniometerLabels;
}>();

/** Full-scale mono reads √2 on the mid axis; that lands on the outer ring. */
const FULL_SCALE = Math.SQRT2;
/** Share of the previous frame erased per new frame (phosphor persistence). */
const FADE_PER_FRAME = 0.28;
const MAX_DPR = 2;

const canvasRef = ref<HTMLCanvasElement | null>(null);
let frame = 0;
const reduceMotion =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;

function draw(persist: boolean): void {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (width === 0 || height === 0) return;
  const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
  const pixelWidth = Math.round(width * dpr);
  const pixelHeight = Math.round(height * dpr);
  let keep = persist && !reduceMotion?.matches;
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
    keep = false;
  }
  const g = canvas.getContext('2d');
  if (!g) return;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (keep) {
    // Erase a share of what is there so older points fade instead of vanishing.
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = `rgba(0, 0, 0, ${FADE_PER_FRAME})`;
    g.fillRect(0, 0, width, height);
    g.globalCompositeOperation = 'source-over';
  } else {
    g.clearRect(0, 0, width, height);
  }

  const { mid, side } = props;
  if (!mid || !side) return;
  const count = Math.min(mid.length, side.length);
  const cx = width / 2;
  const cy = height / 2;
  const scale = (Math.min(width, height) / 2) * 0.92 / FULL_SCALE;
  g.fillStyle = getComputedStyle(canvas).getPropertyValue('--demo-cyan').trim() || '#0891B2';
  g.globalAlpha = 0.85;
  for (let i = 0; i < count; i++) {
    // Rotated Lissajous: L-only leans up-left, R-only up-right, mono is vertical.
    const x = cx - side[i] * scale;
    const y = cy - mid[i] * scale;
    g.fillRect(x - 0.75, y - 0.75, 1.5, 1.5);
  }
  g.globalAlpha = 1;
}

function schedule(): void {
  if (frame || typeof requestAnimationFrame !== 'function') return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    draw(true);
  });
}

watch([() => props.mid, () => props.side], schedule);
useCanvasRedraw(canvasRef, () => draw(false));

onBeforeUnmount(() => {
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
});
</script>

<template>
  <div class="goniometer" role="img" :aria-label="labels.name">
    <svg class="goniometer__grid" viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="46" />
      <circle cx="50" cy="50" r="23" class="goniometer__minor" />
      <line x1="50" y1="4" x2="50" y2="96" />
      <line x1="4" y1="50" x2="96" y2="50" />
      <line x1="17.5" y1="17.5" x2="82.5" y2="82.5" class="goniometer__minor" />
      <line x1="82.5" y1="17.5" x2="17.5" y2="82.5" class="goniometer__minor" />
      <text x="50" y="3" text-anchor="middle" dominant-baseline="hanging">M</text>
      <text x="13" y="13" text-anchor="middle">L</text>
      <text x="87" y="13" text-anchor="middle">R</text>
    </svg>
    <canvas ref="canvasRef" class="goniometer__canvas" />
  </div>
</template>

<style scoped>
.goniometer {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  overflow: hidden;
  border: 1px solid var(--demo-border);
  border-radius: 8px;
  background:
    radial-gradient(circle at 50% 50%, var(--demo-accent-subtle), transparent 70%),
    var(--demo-screen-bg);
}

.goniometer__grid {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  fill: none;
  stroke: var(--demo-border-strong);
  stroke-width: 0.4;
}

.goniometer__minor {
  stroke-dasharray: 1.2 1.6;
}

.goniometer__grid text {
  fill: var(--demo-text-faint);
  stroke: none;
  font-family: var(--font-mono);
  font-size: 4px;
  font-weight: 600;
}

.goniometer__canvas {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
}
</style>
