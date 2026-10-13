<script setup lang="ts">
/**
 * Transport and program timeline: the engine transport, a zoomable waveform
 * of the program with the loop range and playhead, and the short-term
 * loudness of the last render against the target. Click seeks; Shift-drag
 * sets the loop range.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import EngineTransport, { type EngineTransportLoop } from '@/components/ui/EngineTransport.vue';
import { useMasteringCopy } from '@/demos/mastering/masteringCopy';
import { formatNumber } from '@/demos/mastering/masteringUi';
import type { WaveformPeak } from '@/utils/audio';
import { prepareCanvas2D } from '@/utils/canvas';

const props = defineProps<{
  peaks: readonly WaveformPeak[] | null;
  duration: number;
  position: number;
  playing: boolean;
  loop: EngineTransportLoop;
  /** Short-term loudness of the last render, one point per 100 ms. */
  shortTerm: Float32Array | null;
  targetLufs: number;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  play: [];
  stop: [];
  seek: [seconds: number];
  toHome: [];
  toggleLoop: [];
  'update:loop': [loop: EngineTransportLoop];
}>();

const copy = useMasteringCopy();
const ZOOMS = [1, 2, 4, 8, 16, 32] as const;
const SHORT_TERM_STEP_SECONDS = 0.1;
const LANE_MIN_LUFS = -36;
const LANE_MAX_LUFS = -4;

const zoomIndex = ref(0);
const viewStart = ref(0);
const waveRef = ref<HTMLCanvasElement | null>(null);
const laneRef = ref<HTMLCanvasElement | null>(null);
const bodyRef = ref<HTMLElement | null>(null);

const zoom = computed(() => ZOOMS[zoomIndex.value]);
const span = computed(() => (props.duration > 0 ? props.duration / zoom.value : 0));
const viewEnd = computed(() => viewStart.value + span.value);

function clampView(start: number): number {
  return Math.max(0, Math.min(Math.max(0, props.duration - span.value), start));
}

function setZoom(index: number): void {
  const next = Math.max(0, Math.min(ZOOMS.length - 1, index));
  if (next === zoomIndex.value) return;
  const centre =
    props.position >= viewStart.value && props.position <= viewEnd.value
      ? props.position
      : viewStart.value + span.value / 2;
  zoomIndex.value = next;
  viewStart.value = clampView(centre - span.value / 2);
}

// Keep the playhead in view while playing.
watch(
  () => props.position,
  (seconds) => {
    if (zoom.value === 1 || !props.playing) return;
    if (seconds < viewStart.value || seconds > viewEnd.value - span.value * 0.05) {
      viewStart.value = clampView(seconds - span.value * 0.1);
    }
  },
);

watch(
  () => props.duration,
  () => {
    zoomIndex.value = 0;
    viewStart.value = 0;
  },
);

const toFraction = (seconds: number) => (span.value ? (seconds - viewStart.value) / span.value : 0);
/** The playhead layer spans the body, so a translate by its own width moves it along the time axis. */
const playheadTransform = computed(
  () => `translateX(${(toFraction(props.position) * 100).toFixed(3)}%)`,
);
const playheadVisible = computed(
  () => props.duration > 0 && props.position >= viewStart.value && props.position <= viewEnd.value,
);
const loopStyle = computed(() => {
  const start = Math.max(0, toFraction(props.loop.start));
  const end = Math.min(1, toFraction(props.loop.end));
  return { left: `${start * 100}%`, width: `${Math.max(0, end - start) * 100}%` };
});

function cssColor(element: Element, name: string, fallback: string): string {
  return getComputedStyle(element).getPropertyValue(name).trim() || fallback;
}

function drawWave(): void {
  const canvas = waveRef.value;
  const frame = prepareCanvas2D(canvas);
  if (!canvas || !frame) return;
  const { ctx, width, height } = frame;
  const peaks = props.peaks;
  const mid = height / 2;
  ctx.fillStyle = cssColor(canvas, '--demo-border', 'rgba(0,0,0,0.08)');
  ctx.fillRect(0, mid, width, 1);
  if (!peaks?.length || props.duration <= 0) return;
  ctx.fillStyle = cssColor(canvas, '--demo-cyan', '#0891B2');
  const perSecond = peaks.length / props.duration;
  for (let x = 0; x < width; x++) {
    const from = Math.floor((viewStart.value + (x / width) * span.value) * perSecond);
    const to = Math.max(
      from + 1,
      Math.floor((viewStart.value + ((x + 1) / width) * span.value) * perSecond),
    );
    let min = 0;
    let max = 0;
    for (let i = from; i < Math.min(to, peaks.length); i++) {
      if (peaks[i].min < min) min = peaks[i].min;
      if (peaks[i].max > max) max = peaks[i].max;
    }
    const top = mid - max * mid * 0.95;
    ctx.fillRect(x, top, 1, Math.max(1, (max - min) * mid * 0.95));
  }
}

function drawLane(): void {
  const canvas = laneRef.value;
  const frame = prepareCanvas2D(canvas);
  if (!canvas || !frame) return;
  const { ctx, width, height } = frame;
  const y = (lufs: number) =>
    height -
    ((Math.min(LANE_MAX_LUFS, Math.max(LANE_MIN_LUFS, lufs)) - LANE_MIN_LUFS) /
      (LANE_MAX_LUFS - LANE_MIN_LUFS)) *
      height;
  ctx.fillStyle = cssColor(canvas, '--demo-amber', '#B45309');
  ctx.globalAlpha = 0.7;
  ctx.fillRect(0, Math.round(y(props.targetLufs)), width, 1);
  ctx.globalAlpha = 1;
  const series = props.shortTerm;
  if (!series?.length || span.value <= 0) return;
  ctx.strokeStyle = cssColor(canvas, '--demo-accent', '#7C3AED');
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  let drawing = false;
  for (let x = 0; x <= width; x += 2) {
    const seconds = viewStart.value + (x / width) * span.value;
    const value = series[Math.floor(seconds / SHORT_TERM_STEP_SECONDS)];
    if (value === undefined || !Number.isFinite(value) || value < LANE_MIN_LUFS - 20) {
      drawing = false;
      continue;
    }
    if (drawing) ctx.lineTo(x, y(value));
    else ctx.moveTo(x, y(value));
    drawing = true;
  }
  ctx.stroke();
}

function draw(): void {
  drawWave();
  drawLane();
}

watch(
  () => [
    props.peaks,
    props.shortTerm,
    props.targetLufs,
    viewStart.value,
    zoomIndex.value,
    props.duration,
  ],
  draw,
);

let resize: ResizeObserver | null = null;
let theme: MutationObserver | null = null;
onMounted(() => {
  draw();
  if (typeof ResizeObserver !== 'undefined' && bodyRef.value) {
    resize = new ResizeObserver(draw);
    resize.observe(bodyRef.value);
  }
  theme = new MutationObserver(draw);
  theme.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
});
onBeforeUnmount(() => {
  resize?.disconnect();
  theme?.disconnect();
});

// Pointer: click seeks, Shift-drag selects the loop range.
let dragFrom: number | null = null;

function timeAt(event: PointerEvent): number {
  const rect = bodyRef.value?.getBoundingClientRect();
  if (!rect || rect.width === 0) return 0;
  const fraction = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  return viewStart.value + fraction * span.value;
}

function onPointerDown(event: PointerEvent): void {
  if (props.disabled || props.duration <= 0 || event.button !== 0) return;
  (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  const at = timeAt(event);
  if (event.shiftKey) {
    dragFrom = at;
  } else {
    dragFrom = null;
    emit('seek', at);
  }
}

function onPointerMove(event: PointerEvent): void {
  if (dragFrom === null) return;
  const at = timeAt(event);
  const start = Math.min(dragFrom, at);
  const end = Math.max(dragFrom, at);
  if (end - start >= 0.1) emit('update:loop', { enabled: true, start, end });
}

function onPointerUp(event: PointerEvent): void {
  dragFrom = null;
  (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
}

function onWheel(event: WheelEvent): void {
  if (props.duration <= 0) return;
  if (event.ctrlKey || event.metaKey) {
    event.preventDefault();
    setZoom(zoomIndex.value + (event.deltaY < 0 ? 1 : -1));
  } else if (zoom.value > 1 && Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
    event.preventDefault();
    viewStart.value = clampView(viewStart.value + (event.deltaX / 600) * span.value);
  }
}

const transportLabels = computed(() => copy.value.transport);
const targetLabel = computed(
  () => `${copy.value.timeline.target} ${formatNumber(props.targetLufs, 1)} LUFS`,
);
</script>

<template>
  <section class="timeline" :aria-label="copy.timeline.name">
    <EngineTransport
      :playing="playing"
      :position="position"
      :duration="duration"
      :loop="loop"
      :disabled="disabled || duration <= 0"
      :labels="transportLabels"
      @play="emit('play')"
      @stop="emit('stop')"
      @seek="emit('seek', $event)"
      @to-home="emit('toHome')"
      @toggle-loop="emit('toggleLoop')"
      @update:loop="emit('update:loop', $event)"
    />
    <div class="timeline__view">
      <div class="timeline__zoom" role="group" :aria-label="copy.timeline.name">
        <button type="button" class="demo-btn demo-btn--sm demo-btn--icon" :disabled="zoomIndex === 0" :aria-label="copy.timeline.zoomOut" @click="setZoom(zoomIndex - 1)">−</button>
        <span>{{ zoom }}×</span>
        <button type="button" class="demo-btn demo-btn--sm demo-btn--icon" :disabled="zoomIndex === ZOOMS.length - 1" :aria-label="copy.timeline.zoomIn" @click="setZoom(zoomIndex + 1)">+</button>
        <button type="button" class="demo-btn demo-btn--sm" :disabled="zoomIndex === 0" @click="setZoom(0)">{{ copy.timeline.zoomFit }}</button>
      </div>
      <div
        ref="bodyRef"
        class="timeline__body"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @wheel="onWheel"
      >
        <canvas ref="waveRef" class="timeline__wave" role="img" :aria-label="copy.timeline.name"></canvas>
        <div class="timeline__lane">
          <canvas ref="laneRef" role="img" :aria-label="copy.timeline.loudness"></canvas>
        </div>
        <span v-if="loop.enabled && loop.end > loop.start" class="timeline__loop" :style="loopStyle" aria-hidden="true"></span>
        <span v-if="playheadVisible" class="timeline__playhead" :style="{ transform: playheadTransform }" aria-hidden="true"></span>
      </div>
      <div class="timeline__caption">
        <span>{{ shortTerm ? copy.timeline.loudness : copy.timeline.noRender }}</span>
        <span class="timeline__caption-target">{{ targetLabel }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.timeline {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.timeline__view {
  display: grid;
  gap: 4px;
}

.timeline__zoom {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  color: var(--demo-text-muted);
  font-family: var(--font-mono);
  font-size: 10.5px;
  font-variant-numeric: tabular-nums;
}

.timeline__zoom span {
  min-width: 2.6em;
  text-align: center;
}

.timeline__body {
  position: relative;
  display: grid;
  grid-template-rows: 96px 44px;
  overflow: hidden;
  border: 1px solid var(--demo-border);
  border-radius: var(--demo-radius-sm);
  background: var(--demo-screen-bg-alpha);
  cursor: text;
  touch-action: none;
}

.timeline__wave,
.timeline__lane canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.timeline__lane {
  position: relative;
  border-top: 1px solid var(--demo-border);
}

.timeline__caption {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 2px 16px;
  padding-inline: 2px;
  color: var(--demo-text-muted);
  font-family: var(--font-mono);
  font-size: 10px;
  line-height: 1.4;
}

.timeline__caption-target {
  color: var(--demo-warn-text);
  white-space: nowrap;
}

.timeline__loop {
  position: absolute;
  inset-block: 0;
  background: color-mix(in srgb, var(--demo-accent) 9%, transparent);
  border-inline: 1px solid var(--demo-accent-border);
  pointer-events: none;
}

.timeline__playhead {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.timeline__playhead::before {
  content: '';
  position: absolute;
  inset-block: 0;
  left: 0;
  width: 1px;
  background: var(--demo-playhead);
}
</style>
