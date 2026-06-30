<script setup lang="ts">
/**
 * `param-sweep` archetype: drag one control and hear + see a DSP transform respond.
 *
 * Five processors share this component, selected by `config.processor`:
 * - `pitch-shift` — drag the semitone slider and the whole harmonic comb slides while
 *   the duration stays fixed. The marker tracks the fundamental in Hz. Pitch shifting
 *   here is not formant-preserving, so formants ride along — the "chipmunk" effect.
 * - `time-stretch` — drag the rate slider and the waveform grows or shrinks in time
 *   while the spectrum stays put: same pitch, different length. The two are exact
 *   opposites, which is the whole point of placing them side by side.
 * - `formant-shift` — drag the formant factor and the spectral envelope (the formant
 *   peaks that give a voice its character) shifts while the harmonic comb and the
 *   fundamental marker stay put: timbre moves, pitch does not. The counterpart to
 *   pitch-shift, where the comb moves and the envelope rides along.
 * - `griffin-lim` — reconstruct audio from a mel spectrogram and drag the iteration
 *   count: more Griffin-Lim passes settle the invented phase into something cleaner
 *   and less "phasey". The magnitude is fixed; only the phase quality improves.
 * - `tilt-eq` — drag the tilt amount and the broadband spectrum rotates around a fixed
 *   midrange pivot: positive tilt lifts the highs and trims the lows (brighter),
 *   negative tilt does the reverse (warmer). Loudness is matched per render so the
 *   change you hear is tone, not level. A complementary low-/high-shelf pair around
 *   the pivot, the mastering-EQ way to rebalance the whole spectrum at once.
 *
 * The top panel is the waveform you hear; the bottom is the averaged magnitude
 * spectrum. A playback-synced beam sweeps the waveform.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useSonareDemoAudio } from '@/composables/useSonareDemoAudio';
import type { SonareDemoDef } from '@/demos/types';
import { prepareCanvas2D } from '../canvas';
import { useDemoChrome, useDemoParams } from '../composables';
import DemoControls from '../DemoControls.vue';
import DemoFrame from '../DemoFrame.vue';
import {
  fillParamSweepSpectrum,
  fillParamSweepWavePeaks,
  PARAM_SWEEP_SPEC_COLS,
  PARAM_SWEEP_SPEC_MAX_HZ,
  PARAM_SWEEP_WAVE_COLS,
} from './paramSweepData';
import {
  type ParamSweepProcessor,
  type ParamSweepProcessorWasm,
  renderParamSweepAudio,
} from './paramSweepProcessing';

const props = defineProps<{ def: SonareDemoDef; active: boolean }>();

const { ensureWasm, loadClip, play, playingId, progress } = useSonareDemoAudio();

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

// ---- reader-adjustable parameters ------------------------------------------
const { values, updateParams } = useDemoParams(props.def);

const processor = computed<ParamSweepProcessor>(
  () => (props.def.config?.processor as ParamSweepProcessor) ?? 'pitch-shift',
);
const semitones = computed<number>(() => Number(values.semitones ?? 0));
const rate = computed<number>(() => Number(values.rate ?? 1));
const formant = computed<number>(() => Number(values.formant ?? 1));
const iters = computed<number>(() => Number(values.iters ?? 16));
const tilt = computed<number>(() => Number(values.tilt ?? 0));
/** The value that triggers a re-render, whichever processor is active. */
const activeValue = computed(() => {
  switch (processor.value) {
    case 'time-stretch':
      return rate.value;
    case 'formant-shift':
      return formant.value;
    case 'griffin-lim':
      return iters.value;
    case 'tilt-eq':
      return tilt.value;
    default:
      return semitones.value;
  }
});
const clipName = computed(() => (props.def.source.kind === 'clip' ? props.def.source.clip : ''));
const eyebrow = computed(() => {
  switch (processor.value) {
    case 'time-stretch':
      return 'PARAM SWEEP · TIME STRETCH';
    case 'formant-shift':
      return 'PARAM SWEEP · FORMANT';
    case 'griffin-lim':
      return 'PARAM SWEEP · GRIFFIN-LIM';
    case 'tilt-eq':
      return 'PARAM SWEEP · TILT EQ';
    default:
      return 'PARAM SWEEP · PITCH SHIFT';
  }
});
/** The fundamental marker is meaningful only when there is a fixed pitch to mark. */
const showFundamental = computed(
  () => processor.value === 'pitch-shift' || processor.value === 'formant-shift',
);

// ---- presentation state ----------------------------------------------------
const fundHz = ref(0);
const pivotHz = ref(0); // tilt-eq rotation axis; 0 when not applicable
const outDur = ref(0); // rendered duration in seconds
let widthFrac = 1; // fraction of the waveform panel the rendered clip fills (time-stretch)
const stateLabel = computed(() => {
  if (status.value === 'loading') return 'RENDERING';
  if (status.value === 'error') return 'ERROR';
  if (isPlaying.value) return `▸ ${Math.round(progress.value * 100)}%`;
  if (status.value !== 'ready') return 'IDLE';
  switch (processor.value) {
    case 'time-stretch':
      return `${outDur.value.toFixed(1)} s`;
    case 'formant-shift':
      return `×${formant.value.toFixed(2)}`;
    case 'griffin-lim':
      return `${iters.value} iter`;
    case 'tilt-eq':
      return `${tilt.value >= 0 ? '+' : ''}${tilt.value.toFixed(1)} dB`;
    default:
      return `${Math.round(fundHz.value)} Hz`;
  }
});

// ---- audio + figure data ---------------------------------------------------
const wavePeaks = new Float32Array(PARAM_SWEEP_WAVE_COLS);
const dispSpec = new Float32Array(PARAM_SWEEP_SPEC_COLS);
const targetSpec = new Float32Array(PARAM_SWEEP_SPEC_COLS);

let baseClip: { samples: Float32Array; sampleRate: number } | null = null;
let rendered: { samples: Float32Array; sampleRate: number } | null = null;
const reveal = ref(0);

/** Smallest rate the slider allows; sets the longest (reference) duration. */
function minRate(): number {
  return props.def.params?.find((p) => p.key === 'rate')?.min ?? 0.5;
}

async function compute(): Promise<void> {
  try {
    if (status.value === 'idle') status.value = 'loading';
    const wasm = (await ensureWasm()) as ParamSweepProcessorWasm;
    if (!baseClip) baseClip = await loadClip(clipName.value);

    const audio = renderParamSweepAudio(wasm, baseClip, {
      processor: processor.value,
      semitones: semitones.value,
      rate: rate.value,
      formant: formant.value,
      iters: iters.value,
      tilt: tilt.value,
      minRate: minRate(),
    });
    fundHz.value = audio.fundHz;
    pivotHz.value = audio.pivotHz;
    outDur.value = audio.outDur;
    widthFrac = audio.widthFrac;
    rendered = { samples: audio.samples, sampleRate: audio.sampleRate };
    fillParamSweepWavePeaks(audio.samples, wavePeaks);
    fillParamSweepSpectrum(wasm, audio.samples, audio.sampleRate, targetSpec);
    status.value = 'ready';
    startMorph();
  } catch (e) {
    fail(e);
  }
}

// ---- morph + paint ---------------------------------------------------------
let rafId = 0;
function startMorph(): void {
  if (rafId) return;
  const step = () => {
    let delta = 0;
    if (reveal.value < 1) {
      reveal.value = Math.min(1, reveal.value + 0.08);
      delta = Math.max(delta, 1 - reveal.value);
    }
    for (let c = 0; c < PARAM_SWEEP_SPEC_COLS; c++) {
      const d = targetSpec[c] - dispSpec[c];
      dispSpec[c] += d * 0.26;
      delta = Math.max(delta, Math.abs(d));
    }
    paint();
    if (delta > 0.002) {
      rafId = requestAnimationFrame(step);
    } else {
      dispSpec.set(targetSpec);
      paint();
      rafId = 0;
    }
  };
  rafId = requestAnimationFrame(step);
}

// Keep the playhead beam smooth over the waveform during playback.
let playRaf = 0;
watch(isPlaying, (on) => {
  if (on && !playRaf) {
    const step = () => {
      paint();
      playRaf = isPlaying.value ? requestAnimationFrame(step) : 0;
    };
    playRaf = requestAnimationFrame(step);
  }
});

function paint(): void {
  const frame = prepareCanvas2D(canvas.value);
  if (!frame) return;
  const { ctx, width: w, height: h } = frame;

  const padX = 14;
  const innerW = w - padX * 2;
  const gap = 12;
  const waveH = h * 0.3;
  const waveMid = 10 + waveH / 2;
  const specTop = 10 + waveH + gap;
  const specBot = h - 18;
  const specH = specBot - specTop;
  const playT = isPlaying.value ? progress.value : -1;

  // --- top: waveform (time). Passed portion brightens during playback. ---
  // For time-stretch the clip fills only `widthFrac` of the panel, so a shorter
  // (faster) render visibly occupies less width than a longer (slower) one.
  const waveW = innerW * widthFrac;
  for (let c = 0; c < PARAM_SWEEP_WAVE_COLS; c++) {
    const x = padX + (c / (PARAM_SWEEP_WAVE_COLS - 1)) * waveW;
    const a = wavePeaks[c] * (waveH / 2) * reveal.value;
    const passed = playT >= 0 && c / (PARAM_SWEEP_WAVE_COLS - 1) <= playT;
    ctx.strokeStyle = passed ? 'rgba(45, 212, 191, 0.9)' : 'rgba(148, 163, 184, 0.42)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, waveMid - a);
    ctx.lineTo(x, waveMid + a);
    ctx.stroke();
  }
  // In-canvas beam aligned to the (possibly shortened) waveform during playback.
  if (playT >= 0) {
    const bx = padX + playT * waveW;
    ctx.strokeStyle = 'rgba(94, 234, 212, 0.85)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(bx, waveMid - waveH / 2);
    ctx.lineTo(bx, waveMid + waveH / 2);
    ctx.stroke();
  }

  // --- bottom: harmonic-comb spectrum (frequency), filled. ---
  const grad = ctx.createLinearGradient(0, specTop, 0, specBot);
  grad.addColorStop(0, 'rgba(167, 139, 250, 0.55)');
  grad.addColorStop(1, 'rgba(167, 139, 250, 0.04)');
  ctx.beginPath();
  ctx.moveTo(padX, specBot);
  for (let c = 0; c < PARAM_SWEEP_SPEC_COLS; c++) {
    const x = padX + (c / (PARAM_SWEEP_SPEC_COLS - 1)) * innerW;
    ctx.lineTo(x, specBot - dispSpec[c] * specH * reveal.value);
  }
  ctx.lineTo(padX + innerW, specBot);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.strokeStyle = '#a78bfa';
  ctx.lineWidth = 1.6;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let c = 0; c < PARAM_SWEEP_SPEC_COLS; c++) {
    const x = padX + (c / (PARAM_SWEEP_SPEC_COLS - 1)) * innerW;
    const y = specBot - dispSpec[c] * specH * reveal.value;
    c === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Fundamental marker. Drawn when there is a fixed pitch to mark: pitch-shift (it
  // moves) and formant-shift (it deliberately holds). For time-stretch and griffin-lim
  // the spectrum is the constant — a moving Hz marker would mislead.
  if (showFundamental.value && fundHz.value > 0 && fundHz.value < PARAM_SWEEP_SPEC_MAX_HZ) {
    const mx = padX + (fundHz.value / PARAM_SWEEP_SPEC_MAX_HZ) * innerW;
    ctx.strokeStyle = 'rgba(45, 212, 191, 0.9)';
    ctx.lineWidth = 1.4;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(mx, specTop);
    ctx.lineTo(mx, specBot);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(94, 234, 212, 0.95)';
    ctx.font = '9px "JetBrains Mono", ui-monospace, monospace';
    ctx.textBaseline = 'top';
    ctx.fillText(`${Math.round(fundHz.value)} Hz`, mx + 4, specTop);
  }

  // Tilt pivot: the rotation axis. The spectrum lifts on one side and drops on the
  // other around this fixed line — drawn in amber to read as an axis, not a peak.
  if (pivotHz.value > 0 && pivotHz.value < PARAM_SWEEP_SPEC_MAX_HZ) {
    const px = padX + (pivotHz.value / PARAM_SWEEP_SPEC_MAX_HZ) * innerW;
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.85)';
    ctx.lineWidth = 1.4;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(px, specTop);
    ctx.lineTo(px, specBot);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(252, 211, 77, 0.95)';
    ctx.font = '9px "JetBrains Mono", ui-monospace, monospace';
    ctx.textBaseline = 'top';
    ctx.fillText('PIVOT', px + 4, specTop);
  }

  // Axis labels.
  ctx.font = '9px "JetBrains Mono", ui-monospace, monospace';
  ctx.fillStyle = 'rgba(186, 230, 224, 0.5)';
  ctx.textBaseline = 'top';
  ctx.fillText('WAVE', padX, 2);
  ctx.fillText('0 Hz', padX, specBot + 4);
  ctx.textAlign = 'right';
  ctx.fillText(`${(PARAM_SWEEP_SPEC_MAX_HZ / 1000).toFixed(1)} kHz`, padX + innerW, specBot + 4);
  ctx.textAlign = 'left';
}

async function onPlay(): Promise<void> {
  if (!rendered) await compute();
  if (rendered) await play(props.def.id, rendered);
}

// Coalesce rapid slider changes into one render per frame.
let pending = 0;
function scheduleCompute(): void {
  if (pending) return;
  pending = requestAnimationFrame(() => {
    pending = 0;
    compute();
  });
}

watch(activeValue, () => {
  if (props.active && status.value !== 'idle') scheduleCompute();
});

watch(
  () => props.active,
  (on) => {
    if (on && status.value === 'idle') compute();
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  if (rafId) cancelAnimationFrame(rafId);
  if (playRaf) cancelAnimationFrame(playRaf);
  if (pending) cancelAnimationFrame(pending);
});
</script>

<template>
  <DemoFrame
    :eyebrow="eyebrow"
    :title="title"
    :caption="caption"
    :state="stateLabel"
    :tone="tone"
    :playing="isPlaying"
    :progress="progress"
    :disabled="status === 'loading'"
    :error="status === 'error' ? errorMsg : null"
    loading-label="RENDERING…"
    :show-playhead="false"
    @toggle="onPlay"
  >
    <template #screen>
      <canvas ref="canvas" class="ps-canvas" />
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
.ps-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
</style>
