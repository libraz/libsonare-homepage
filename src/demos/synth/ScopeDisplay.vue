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

const reduceMotion =
  typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

/** True when the surrounding theme is light; trace alphas/glow adapt to it. */
function isLightTheme(): boolean {
  return typeof document !== 'undefined' && !document.documentElement.classList.contains('dark');
}

function colors(canvas: HTMLCanvasElement) {
  const style = getComputedStyle(canvas);
  return {
    trace: style.getPropertyValue('--demo-accent').trim() || '#8B5CF6',
    spectrum: style.getPropertyValue('--demo-cyan').trim() || '#22D3EE',
    grid: style.color,
  };
}

/**
 * Render one scope frame. Under reduced motion this runs once per analyser
 * change instead of every animation frame; otherwise it schedules the next.
 */
function draw(): void {
  if (!reduceMotion?.matches) rafId = requestAnimationFrame(draw);
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
  const light = isLightTheme();

  // Graticule.
  g.save();
  g.strokeStyle = grid;
  g.globalAlpha = light ? 0.12 : 0.07;
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
    g.globalAlpha = light ? 0.6 : 0.4;
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
  g.globalAlpha = light ? 0.42 : 0.22;
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
  // Crisper, slightly heavier trace on the light screen; glow suits the dark one.
  g.lineWidth = light ? 2 : 1.7;
  g.lineJoin = 'round';
  if (!light) {
    g.shadowColor = trace;
    g.shadowBlur = 7;
  }
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

/** Reduced motion: the live loop is paused, so redraw on size/preference changes. */
function staticDraw(): void {
  if (reduceMotion?.matches) draw();
}

onMounted(() => {
  resizeObserver = new ResizeObserver(staticDraw);
  if (canvasRef.value) resizeObserver.observe(canvasRef.value);
  reduceMotion?.addEventListener('change', onMotionPreferenceChange);
  if (reduceMotion?.matches) draw();
  else rafId = requestAnimationFrame(draw);
});

/** Switch between the live rAF loop and a single static frame on the fly. */
function onMotionPreferenceChange(): void {
  cancelAnimationFrame(rafId);
  if (reduceMotion?.matches) draw();
  else rafId = requestAnimationFrame(draw);
}

onBeforeUnmount(() => {
  cancelAnimationFrame(rafId);
  resizeObserver?.disconnect();
  reduceMotion?.removeEventListener('change', onMotionPreferenceChange);
});

watch(
  () => props.analyser,
  () => {
    timeData = null;
    freqData = null;
    staticDraw();
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
