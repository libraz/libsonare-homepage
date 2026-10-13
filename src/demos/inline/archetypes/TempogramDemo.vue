<script setup lang="ts">
/**
 * `tempogram` archetype: the onset autocorrelation behind a tempo estimate, with
 * its octave relatives marked.
 *
 * The top panel is the autocorrelation tempogram (time × tempo, tempo on a log
 * axis); the bottom panel is that tempogram averaged over time, the curve whose
 * peaks are the candidate tempos. The 80–180 BPM band the estimator prefers is
 * shaded, and the tempo `analyzeBpm` reports is marked with its half and double.
 * Sources are click tracks at fixed tempos and the drum loop; play auditions the
 * source with a playhead across the tempogram.
 */
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import type { SonareDemoDef } from '@/demos/inline/types';
import { useSonareDemoAudio } from '@/demos/inline/useSonareDemoAudio';
import { prepareCanvas2D } from '@/utils/canvas';
import { useCanvasRedraw, useDemoChrome, useDemoParams, useDisposed } from '../composables';
import DemoControls from '../DemoControls.vue';
import DemoFrame from '../DemoFrame.vue';
import {
  analyzeTempo,
  clickTrack,
  TEMPO_SR,
  type TempoAnalysis,
  valueAtBpm,
} from './tempogramMath';

const props = defineProps<{ def: SonareDemoDef; active: boolean }>();

const { ensureWasm, loadClip, play, stop, playingId, progress } = useSonareDemoAudio();

const canvas = ref<HTMLCanvasElement | null>(null);
const isPlaying = computed(() => playingId.value === props.def.id);
const {
  locale: loc,
  title,
  caption,
  status,
  errorMsg,
  tone,
  fail,
} = useDemoChrome(props.def, isPlaying);
const { values, updateParams } = useDemoParams(props.def);

/** `click-<bpm>` renders a click track; anything else plays the registry clip. */
const sourceKey = computed(() => String(values.source ?? 'drum'));
const clickBpm = computed(() => {
  const m = sourceKey.value.match(/^click-(\d+)$/);
  return m ? Number(m[1]) : null;
});
const clipName = computed(() => (props.def.source.kind === 'clip' ? props.def.source.clip : ''));

const BPM_MIN = 30;
const BPM_MAX = 300;
const PREF_LO = 80;
const PREF_HI = 180;
const HEAT_ROWS = 96;

const analysis = shallowRef<TempoAnalysis | null>(null);
let heat: HTMLCanvasElement | null = null;

const stateLabel = computed(() => {
  if (status.value === 'loading') return 'ANALYZING';
  if (status.value === 'error') return 'ERROR';
  const a = analysis.value;
  if (!a) return 'IDLE';
  return `ENGINE ${a.bpm.toFixed(1)} BPM · CONF ${a.confidence.toFixed(2)}`;
});

function bpmToUnit(bpm: number): number {
  return Math.log(bpm / BPM_MIN) / Math.log(BPM_MAX / BPM_MIN);
}

/** Render the tempogram once into an offscreen canvas, rows on the log-BPM axis. */
function buildHeat(a: TempoAnalysis): void {
  heat = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  const ctx = heat?.getContext('2d');
  if (!heat || !ctx) return;
  heat.width = a.nFrames;
  heat.height = HEAT_ROWS;
  const img = ctx.createImageData?.(a.nFrames, HEAT_ROWS);
  if (!img) return;
  let max = 1e-9;
  for (const v of a.tempogram) max = Math.max(max, v);
  const column = new Float32Array(a.winLength);
  for (let f = 0; f < a.nFrames; f++) {
    for (let lag = 0; lag < a.winLength; lag++) column[lag] = a.tempogram[lag * a.nFrames + f];
    for (let r = 0; r < HEAT_ROWS; r++) {
      const unit = 1 - r / (HEAT_ROWS - 1);
      const bpm = BPM_MIN * (BPM_MAX / BPM_MIN) ** unit;
      const v = Math.max(0, Math.min(1, valueAtBpm(column, a.winLength, bpm) / max));
      const o = (r * a.nFrames + f) * 4;
      img.data[o] = Math.round(30 + 200 * v);
      img.data[o + 1] = Math.round(20 + 150 * v * v);
      img.data[o + 2] = Math.round(60 + 120 * (1 - v) * v + 60 * v);
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

// ---- paint -----------------------------------------------------------------
function paint(): void {
  const frame = prepareCanvas2D(canvas.value);
  const a = analysis.value;
  if (!frame || !a) return;
  const { ctx, width: w, height: h } = frame;
  ctx.font = '9px "JetBrains Mono", ui-monospace, monospace';

  const padL = 44;
  const padR = 12;
  const hTop = 10;
  const hBot = h * 0.5;
  const cTop = hBot + 14;
  const cBot = h - 18;
  const yHeat = (bpm: number) => hBot - bpmToUnit(bpm) * (hBot - hTop);
  const xCurve = (bpm: number) => padL + bpmToUnit(bpm) * (w - padL - padR);

  // Tempogram heatmap with the preferred band over it.
  if (heat) {
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(heat, padL, hTop, w - padL - padR, hBot - hTop);
  }
  ctx.fillStyle = 'rgba(251,191,36,0.08)';
  ctx.fillRect(padL, yHeat(PREF_HI), w - padL - padR, yHeat(PREF_LO) - yHeat(PREF_HI));
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(186,230,224,0.55)';
  for (const bpm of [60, 120, 240]) ctx.fillText(`${bpm}`, padL - 6, yHeat(bpm));
  ctx.fillText('BPM', padL - 6, hTop + 4);

  // Global autocorrelation against tempo.
  let max = 1e-9;
  for (let lag = 1; lag < a.winLength; lag++) max = Math.max(max, a.globalAc[lag]);
  ctx.fillStyle = 'rgba(251,191,36,0.1)';
  ctx.fillRect(xCurve(PREF_LO), cTop, xCurve(PREF_HI) - xCurve(PREF_LO), cBot - cTop);
  ctx.fillStyle = 'rgba(251,191,36,0.7)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('PREFERRED 80–180', (xCurve(PREF_LO) + xCurve(PREF_HI)) / 2, cTop + 2);

  const steps = 300;
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const bpm = BPM_MIN * (BPM_MAX / BPM_MIN) ** (i / steps);
    const v = Math.max(0, valueAtBpm(a.globalAc, a.winLength, bpm) / max);
    const x = xCurve(bpm);
    const y = cBot - v * (cBot - cTop - 14);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = 'rgba(45,212,191,0.95)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // The reported tempo and its octave relatives, on both panels.
  const marks: Array<[number, string, boolean]> = [
    [a.bpm / 2, '×½', true],
    [a.bpm, a.bpm.toFixed(1), false],
    [a.bpm * 2, '×2', true],
  ];
  for (const [bpm, label, relative] of marks) {
    if (bpm < BPM_MIN || bpm > BPM_MAX) continue;
    const color = relative ? 'rgba(167,139,250,0.9)' : '#fbbf24';
    const x = xCurve(bpm);
    ctx.strokeStyle = color;
    ctx.setLineDash(relative ? [3, 3] : []);
    ctx.beginPath();
    ctx.moveTo(x, cTop + 12);
    ctx.lineTo(x, cBot);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = color;
    ctx.fillText(label, x, cBot + 3);
    ctx.fillRect(w - padR - 4, yHeat(bpm) - 1, 4, 2);
  }
  if (clickBpm.value !== null) {
    ctx.fillStyle = 'rgba(226,242,240,0.7)';
    ctx.textAlign = 'left';
    ctx.fillText(`CLICKS AT ${clickBpm.value} BPM`, padL + 4, cTop + 2);
  }

  if (isPlaying.value) {
    const x = padL + Math.max(0, Math.min(1, progress.value)) * (w - padL - padR);
    ctx.strokeStyle = 'rgba(251,191,36,0.85)';
    ctx.beginPath();
    ctx.moveTo(x, hTop);
    ctx.lineTo(x, hBot);
    ctx.stroke();
  }
  ctx.textAlign = 'left';
}

useCanvasRedraw(canvas, paint);

let playRaf = 0;
function startPlayLoop(): void {
  if (playRaf) return;
  const step = () => {
    paint();
    playRaf = isPlaying.value ? requestAnimationFrame(step) : 0;
  };
  playRaf = requestAnimationFrame(step);
}
watch(isPlaying, (on) => {
  if (on) startPlayLoop();
  else paint();
});

// ---- engine ----------------------------------------------------------------
const disposed = useDisposed();

async function compute(): Promise<void> {
  if (disposed()) return;
  try {
    status.value = 'loading';
    const wasm = await ensureWasm();
    if (disposed()) return;
    let samples: Float32Array;
    let sampleRate = TEMPO_SR;
    if (clickBpm.value !== null) {
      samples = clickTrack(wasm, clickBpm.value);
    } else {
      const clip = await loadClip(clipName.value);
      if (disposed()) return;
      samples = clip.samples;
      sampleRate = clip.sampleRate;
    }
    const a = analyzeTempo(wasm, samples, sampleRate);
    buildHeat(a);
    analysis.value = a;
    status.value = 'ready';
    paint();
  } catch (e) {
    if (disposed()) return;
    fail(e);
  }
}

async function onPlay(): Promise<void> {
  const a = analysis.value;
  if (!a) return;
  await play(props.def.id, { samples: a.samples, sampleRate: TEMPO_SR });
}

watch(sourceKey, () => {
  if (isPlaying.value) stop();
  if (status.value !== 'idle') compute();
});

watch(
  () => props.active,
  (on) => {
    if (on && status.value === 'idle') compute();
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  if (playRaf) cancelAnimationFrame(playRaf);
});
</script>

<template>
  <DemoFrame
    eyebrow="TEMPO · AUTOCORRELATION"
    :title="title"
    :caption="caption"
    :state="stateLabel"
    :tone="tone"
    :playing="isPlaying"
    :progress="progress"
    :disabled="status !== 'ready'"
    :error="status === 'error' ? errorMsg : null"
    loading-label="ANALYZING…"
    :show-playhead="false"
    @toggle="onPlay"
  >
    <template #screen>
      <canvas ref="canvas" class="tg-canvas" />
    </template>
    <template #controls>
      <DemoControls
        :model-value="values"
        :params="def.params ?? []"
        :locale="loc"
        :disabled="status === 'loading'"
        @update:model-value="updateParams"
      />
    </template>
  </DemoFrame>
</template>

<style scoped>
.tg-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
</style>
