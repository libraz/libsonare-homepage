<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { peakEnvelope } from '@/components/tuner/compareMetrics';

/**
 * A/B comparison scope: overlays the libsonare original, the tuned (adjusted)
 * TS render, and an optional oracle target as peak-envelope waveforms, with a
 * shaded delta band between the adjusted trace and the active target so the
 * divergence the user is tuning is obvious at a glance.
 */
const props = defineProps<{
  original: Float32Array | null;
  adjusted: Float32Array | null;
  oracle: Float32Array | null;
  rmsErrorPct: number;
  specSimPct: number;
  rendering: boolean;
  hasData: boolean;
  labels: {
    original: string;
    adjusted: string;
    oracle: string;
    delta: string;
    rmsError: string;
    specSim: string;
    against: string;
    auditionOriginal: string;
    auditionAdjusted: string;
    auditionOracle: string;
    compare: string;
    rendering: string;
    empty: string;
    hint: string;
  };
}>();

const emit = defineEmits<{
  (e: 'compare'): void;
  (e: 'audition', trace: 'original' | 'adjusted' | 'oracle'): void;
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
let resizeObserver: ResizeObserver | null = null;

/** The target the error is measured against (oracle when present, else original). */
const targetLabel = computed(() => (props.oracle ? props.labels.oracle : props.labels.original));

function cssColor(el: HTMLElement, name: string, fallback: string): string {
  return getComputedStyle(el).getPropertyValue(name).trim() || fallback;
}

/** Draw one peak-envelope trace, mirrored around the mid-line. */
function drawTrace(
  g: CanvasRenderingContext2D,
  peaks: Float32Array,
  width: number,
  height: number,
  color: string,
  fill: boolean,
): void {
  const mid = height / 2;
  const n = peaks.length;
  g.beginPath();
  for (let c = 0; c < n; ++c) {
    const x = (c / (n - 1)) * width;
    const y = mid - peaks[c] * mid * 0.94;
    if (c === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  if (fill) {
    for (let c = n - 1; c >= 0; --c) {
      const x = (c / (n - 1)) * width;
      const y = mid + peaks[c] * mid * 0.94;
      g.lineTo(x, y);
    }
    g.closePath();
    g.fillStyle = color;
    g.globalAlpha = 0.12;
    g.fill();
    g.globalAlpha = 1;
  }
  g.strokeStyle = color;
  g.lineWidth = 1.6;
  g.lineJoin = 'round';
  g.stroke();
}

function draw(): void {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (width === 0 || height === 0) return;
  const pxWidth = Math.round(width * dpr);
  const pxHeight = Math.round(height * dpr);
  if (canvas.width !== pxWidth || canvas.height !== pxHeight) {
    canvas.width = pxWidth;
    canvas.height = pxHeight;
  }
  const g = canvas.getContext('2d');
  if (!g) return;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, width, height);

  const accent = cssColor(canvas, '--demo-accent', '#8B5CF6');
  const cyan = cssColor(canvas, '--demo-cyan', '#22D3EE');
  const amber = cssColor(canvas, '--demo-amber', '#F59E0B');
  const gridColor = cssColor(canvas, '--demo-text-faint', 'rgba(148,148,168,0.4)');

  // Mid-line graticule.
  g.save();
  g.strokeStyle = gridColor;
  g.globalAlpha = 0.5;
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(0, height / 2);
  g.lineTo(width, height / 2);
  g.stroke();
  g.restore();

  const columns = Math.max(64, Math.floor(width));
  const target = props.oracle ?? props.original;

  // Delta band between adjusted and the active target.
  if (props.adjusted && target) {
    const adj = peakEnvelope(props.adjusted, columns);
    const tgt = peakEnvelope(target, columns);
    const mid = height / 2;
    g.beginPath();
    for (let c = 0; c < columns; ++c) {
      const x = (c / (columns - 1)) * width;
      g.lineTo(x, mid - adj[c] * mid * 0.94);
    }
    for (let c = columns - 1; c >= 0; --c) {
      const x = (c / (columns - 1)) * width;
      g.lineTo(x, mid - tgt[c] * mid * 0.94);
    }
    g.closePath();
    g.fillStyle = amber;
    g.globalAlpha = 0.14;
    g.fill();
    g.globalAlpha = 1;
  }

  // Traces: original (cyan), oracle (amber), adjusted (accent, on top).
  if (props.original)
    drawTrace(g, peakEnvelope(props.original, columns), width, height, cyan, false);
  if (props.oracle) drawTrace(g, peakEnvelope(props.oracle, columns), width, height, amber, false);
  if (props.adjusted)
    drawTrace(g, peakEnvelope(props.adjusted, columns), width, height, accent, true);
}

onMounted(() => {
  resizeObserver = new ResizeObserver(draw);
  if (canvasRef.value) resizeObserver.observe(canvasRef.value);
  draw();
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
});

watch(
  () => [props.original, props.adjusted, props.oracle],
  () => draw(),
);
</script>

<template>
  <div class="tn-cmp">
    <div class="tn-cmp__scope">
      <canvas ref="canvasRef" class="tn-cmp__canvas" aria-hidden="true"></canvas>
      <div v-if="!hasData && !rendering" class="tn-cmp__empty">{{ labels.empty }}</div>
      <div v-if="rendering" class="tn-cmp__rendering">{{ labels.rendering }}</div>
      <div class="tn-cmp__legend">
        <span class="tn-cmp__key tn-cmp__key--original">{{ labels.original }}</span>
        <span class="tn-cmp__key tn-cmp__key--adjusted">{{ labels.adjusted }}</span>
        <span v-if="oracle" class="tn-cmp__key tn-cmp__key--oracle">{{ labels.oracle }}</span>
        <span class="tn-cmp__key tn-cmp__key--delta">{{ labels.delta }}</span>
      </div>
    </div>

    <div class="tn-cmp__side">
      <div class="tn-cmp__metrics">
        <div class="tn-cmp__metric">
          <span class="tn-cmp__metric-label">{{ labels.specSim }}</span>
          <span class="tn-cmp__metric-value tn-cmp__metric-value--good">{{ specSimPct.toFixed(1) }}%</span>
        </div>
        <div class="tn-cmp__metric">
          <span class="tn-cmp__metric-label">{{ labels.rmsError }}</span>
          <span class="tn-cmp__metric-value">{{ rmsErrorPct.toFixed(1) }}%</span>
        </div>
        <div class="tn-cmp__against">{{ labels.against }}: {{ targetLabel }}</div>
      </div>

      <div class="tn-cmp__actions">
        <button type="button" class="tn-chip tn-chip--wide" @click="emit('compare')">{{ labels.compare }}</button>
        <button type="button" class="tn-chip" :disabled="!original" @click="emit('audition', 'original')">{{ labels.auditionOriginal }}</button>
        <button type="button" class="tn-chip" :disabled="!adjusted" @click="emit('audition', 'adjusted')">{{ labels.auditionAdjusted }}</button>
        <button type="button" class="tn-chip" :disabled="!oracle" @click="emit('audition', 'oracle')">{{ labels.auditionOracle }}</button>
      </div>
      <p class="tn-hint">{{ labels.hint }}</p>
    </div>
  </div>
</template>

<style scoped>
.tn-cmp {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
  gap: 14px;
}

.tn-cmp__scope {
  position: relative;
  min-height: 200px;
  border: 1px solid var(--demo-border);
  border-radius: 8px;
  overflow: hidden;
  background:
    radial-gradient(120% 90% at 50% 0%, var(--demo-accent-subtle), transparent 70%),
    var(--demo-screen-bg, var(--demo-control-bg-strong));
}

.tn-cmp__canvas {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  color: var(--demo-text-strong);
}

.tn-cmp__empty,
.tn-cmp__rendering {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 24px;
  text-align: center;
  color: var(--demo-text-muted);
  font-size: 12px;
}

.tn-cmp__rendering {
  color: var(--demo-accent-light);
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.tn-cmp__legend {
  position: absolute;
  top: 8px;
  left: 10px;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.tn-cmp__key {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--demo-text-muted);
}

.tn-cmp__key::before {
  content: '';
  width: 12px;
  height: 3px;
  border-radius: 2px;
}

.tn-cmp__key--original::before { background: var(--demo-cyan); }
.tn-cmp__key--adjusted::before { background: var(--demo-accent); }
.tn-cmp__key--oracle::before { background: var(--demo-amber); }
.tn-cmp__key--delta::before { background: var(--demo-amber); opacity: 0.4; }

.tn-cmp__side {
  display: grid;
  gap: 12px;
  align-content: start;
}

.tn-cmp__metrics {
  display: grid;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--demo-border);
  border-radius: 8px;
  background: var(--demo-control-bg);
}

.tn-cmp__metric {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.tn-cmp__metric-label {
  color: var(--demo-text-muted);
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.tn-cmp__metric-value {
  color: var(--demo-text-strong);
  font-family: var(--font-mono);
  font-size: 18px;
  font-variant-numeric: tabular-nums;
}

.tn-cmp__metric-value--good {
  color: var(--demo-accent-light);
}

.tn-cmp__against {
  color: var(--demo-text-faint);
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.tn-cmp__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

@media (max-width: 860px) {
  .tn-cmp {
    grid-template-columns: 1fr;
  }
}
</style>
