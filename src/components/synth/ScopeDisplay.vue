<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = defineProps<{
  /** Live analyser tap; the scope idles on a flat line while null. */
  analyser: AnalyserNode | null;
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);

let rafId = 0;
let resizeObserver: ResizeObserver | null = null;
let timeData: Float32Array<ArrayBuffer> | null = null;
let freqData: Uint8Array<ArrayBuffer> | null = null;

/** Log-spaced spectrum bars look musical; linear bins crowd the bass. */
const SPECTRUM_BARS = 56;

function colors(canvas: HTMLCanvasElement) {
  const style = getComputedStyle(canvas);
  return {
    trace: style.getPropertyValue('--demo-accent').trim() || '#8B5CF6',
    spectrum: style.getPropertyValue('--demo-cyan').trim() || '#22D3EE',
    grid: style.color,
  };
}

function draw(): void {
  rafId = requestAnimationFrame(draw);
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

  const { trace, spectrum, grid } = colors(canvas);

  // Graticule.
  g.save();
  g.strokeStyle = grid;
  g.globalAlpha = 0.07;
  g.lineWidth = 1;
  g.beginPath();
  for (let i = 1; i < 4; i++) {
    const y = (height / 4) * i;
    g.moveTo(0, y);
    g.lineTo(width, y);
  }
  for (let i = 1; i < 8; i++) {
    const x = (width / 8) * i;
    g.moveTo(x, 0);
    g.lineTo(x, height);
  }
  g.stroke();
  g.restore();

  const analyser = props.analyser;
  if (!analyser) {
    g.strokeStyle = trace;
    g.globalAlpha = 0.4;
    g.beginPath();
    g.moveTo(0, height / 2);
    g.lineTo(width, height / 2);
    g.stroke();
    g.globalAlpha = 1;
    return;
  }

  // Spectrum bars behind the trace.
  if (!freqData || freqData.length !== analyser.frequencyBinCount) {
    freqData = new Uint8Array(analyser.frequencyBinCount);
  }
  analyser.getByteFrequencyData(freqData);
  const bins = freqData.length;
  const barWidth = width / SPECTRUM_BARS;
  g.save();
  g.fillStyle = spectrum;
  g.globalAlpha = 0.22;
  for (let i = 0; i < SPECTRUM_BARS; i++) {
    // Log-spaced bin range for this bar.
    const from = Math.floor(bins ** (i / SPECTRUM_BARS)) - 1;
    const to = Math.max(from + 1, Math.floor(bins ** ((i + 1) / SPECTRUM_BARS)));
    let peak = 0;
    for (let b = Math.max(0, from); b < Math.min(bins, to); b++) {
      if (freqData[b] > peak) peak = freqData[b];
    }
    const barHeight = (peak / 255) * height * 0.92;
    if (barHeight < 1) continue;
    g.fillRect(i * barWidth + 1, height - barHeight, Math.max(1, barWidth - 2), barHeight);
  }
  g.restore();

  // Waveform trace.
  if (!timeData || timeData.length !== analyser.fftSize) {
    timeData = new Float32Array(analyser.fftSize);
  }
  analyser.getFloatTimeDomainData(timeData);
  g.save();
  g.strokeStyle = trace;
  g.lineWidth = 1.7;
  g.lineJoin = 'round';
  g.shadowColor = trace;
  g.shadowBlur = 7;
  g.beginPath();
  const mid = height / 2;
  const samples = timeData.length;
  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * width;
    const y = mid - timeData[i] * mid * 0.92;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.stroke();
  g.restore();
}

onMounted(() => {
  resizeObserver = new ResizeObserver(() => {
    /* size is re-read every frame; the observer just keeps layout honest */
  });
  if (canvasRef.value) resizeObserver.observe(canvasRef.value);
  rafId = requestAnimationFrame(draw);
});

onBeforeUnmount(() => {
  cancelAnimationFrame(rafId);
  resizeObserver?.disconnect();
});

watch(
  () => props.analyser,
  () => {
    timeData = null;
    freqData = null;
  },
);
</script>

<template>
  <div class="scope-display">
    <canvas ref="canvasRef" class="scope-display__canvas" aria-hidden="true"></canvas>
    <slot />
  </div>
</template>

<style scoped>
.scope-display {
  position: relative;
  border: 1px solid var(--demo-border);
  border-radius: 8px;
  background:
    radial-gradient(120% 90% at 50% 0%, var(--demo-accent-subtle), transparent 70%),
    var(--demo-control-bg-strong);
  overflow: hidden;
}

.scope-display::after {
  /* CRT-style inner vignette */
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  box-shadow: inset 0 0 28px rgba(0, 0, 0, 0.16);
  border-radius: 8px;
}

html:not(.dark) .scope-display::after {
  box-shadow: inset 0 0 22px rgba(80, 60, 140, 0.08);
}

.scope-display__canvas {
  /* Absolutely positioned so the canvas backing-store size (set every frame
     from clientWidth/Height × dpr) can never feed back into layout height. */
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  color: var(--demo-text-strong);
}
</style>
