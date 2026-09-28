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
 *   negative tilt does the reverse (warmer). A complementary low-/high-shelf pair
 *   around the pivot, the mastering-EQ way to rebalance the whole spectrum at once.
 *
 * Every render is peak-normalized to a fixed ceiling (see `paramSweepProcessing`).
 * That is peak matching, not loudness matching — a bright tilt still measures a
 * couple of LU under a dark one.
 *
 * The top panel is the selected Original or Processed waveform; the bottom is the
 * matching averaged magnitude spectrum. A playback-synced beam sweeps the waveform.
 */
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import { type I18nText, localized, type SonareDemoDef } from '@/demos/inline/types';
import { useSonareDemoAudio } from '@/demos/inline/useSonareDemoAudio';
import { prepareCanvas2D } from '@/utils/canvas';
import { useCanvasRedraw, useDemoChrome, useDemoParams } from '../composables';
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
  type ParamSweepAudio,
  type ParamSweepProcessor,
  type ParamSweepProcessorWasm,
  type ParamSweepSide,
  renderParamSweepComparison,
} from './paramSweepProcessing';

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

// ---- original / processed preview -----------------------------------------
const selectedSide = ref<ParamSweepSide>('processed');
interface ParamSweepView extends ParamSweepAudio {
  wavePeaks: Float32Array;
  spectrum: Float32Array;
}
const views = shallowRef<Record<ParamSweepSide, ParamSweepView> | null>(null);

const AB_LABEL: I18nText = { en: 'Preview', ja: '試聴対象' };
const AB_HINT: I18nText = {
  en: 'Switching during playback restarts the selected audio from the beginning.',
  ja: '再生中に切り替えると、選んだ音を先頭から再生します。',
};
const SIDE_LABELS: Record<ParamSweepSide, I18nText> = {
  original: { en: 'Original', ja: 'オリジナル' },
  processed: { en: 'Processed', ja: '処理後' },
};
const abLabel = computed(() => localized(AB_LABEL, loc.value));
const abHint = computed(() => localized(AB_HINT, loc.value));
const selectedAudio = computed(() => views.value?.[selectedSide.value] ?? null);
const selectedSideLabel = computed(() => localized(SIDE_LABELS[selectedSide.value], loc.value));

// ---- canvas copy, localized -------------------------------------------------
const PIVOT_LABEL: I18nText = { en: 'PIVOT', ja: 'ピボット' };
const pivotLabel = computed<string>(() => localized(PIVOT_LABEL, loc.value));

// ---- presentation state ----------------------------------------------------
const fundHz = computed(() => selectedAudio.value?.fundHz ?? 0);
const pivotHz = computed(() => selectedAudio.value?.pivotHz ?? 0); // tilt-eq rotation axis; 0 when not applicable
const outDur = computed(() => selectedAudio.value?.outDur ?? 0); // rendered duration in seconds
const widthFrac = computed(() => selectedAudio.value?.widthFrac ?? 1); // fraction of the waveform panel the rendered clip fills (time-stretch)
const stateLabel = computed(() => {
  if (status.value === 'loading') return 'RENDERING';
  if (status.value === 'error') return 'ERROR';
  if (isPlaying.value) return `▸ ${Math.round(progress.value * 100)}%`;
  if (status.value !== 'ready') return 'IDLE';
  switch (processor.value) {
    case 'time-stretch':
      return `${outDur.value.toFixed(1)} s`;
    case 'formant-shift':
      return `×${(selectedSide.value === 'original' ? 1 : formant.value).toFixed(2)}`;
    case 'griffin-lim':
      return selectedSide.value === 'original' ? 'ORIGINAL' : `${iters.value} iter`;
    case 'tilt-eq':
      return `${selectedSide.value === 'original' || tilt.value >= 0 ? '+' : ''}${(selectedSide.value === 'original' ? 0 : tilt.value).toFixed(1)} dB`;
    default:
      return `${Math.round(fundHz.value)} Hz`;
  }
});

// ---- audio + figure data ---------------------------------------------------
const dispSpec = new Float32Array(PARAM_SWEEP_SPEC_COLS);
const targetSpec = new Float32Array(PARAM_SWEEP_SPEC_COLS);

let baseClip: { samples: Float32Array; sampleRate: number } | null = null;
const reveal = ref(0);

/** Smallest rate the slider allows; sets the longest (reference) duration. */
function minRate(): number {
  return props.def.params?.find((p) => p.key === 'rate')?.min ?? 0.5;
}

async function compute(): Promise<void> {
  try {
    if (isPlaying.value) stop();
    if (status.value === 'idle') status.value = 'loading';
    const wasm = (await ensureWasm()) as ParamSweepProcessorWasm;
    if (!baseClip) baseClip = await loadClip(clipName.value);

    const result = renderParamSweepComparison(wasm, baseClip, {
      processor: processor.value,
      semitones: semitones.value,
      rate: rate.value,
      formant: formant.value,
      iters: iters.value,
      tilt: tilt.value,
      minRate: minRate(),
    });
    views.value = {
      original: buildView(wasm, result.original),
      processed: buildView(wasm, result.processed),
    };
    applySelectedView();
    status.value = 'ready';
    startMorph();
  } catch (e) {
    fail(e);
  }
}

function buildView(wasm: ParamSweepProcessorWasm, audio: ParamSweepAudio): ParamSweepView {
  const wave = new Float32Array(PARAM_SWEEP_WAVE_COLS);
  const spectrum = new Float32Array(PARAM_SWEEP_SPEC_COLS);
  fillParamSweepWavePeaks(audio.samples, wave);
  fillParamSweepSpectrum(wasm, audio.samples, audio.sampleRate, spectrum);
  return { ...audio, wavePeaks: wave, spectrum };
}

function applySelectedView(instant = false): void {
  const view = views.value?.[selectedSide.value];
  if (!view) return;
  targetSpec.set(view.spectrum);
  if (instant) dispSpec.set(targetSpec);
  startMorph();
  paint();
}

function selectSide(side: ParamSweepSide): void {
  if (selectedSide.value === side) return;
  const restart = isPlaying.value;
  if (restart) stop();
  selectedSide.value = side;
  applySelectedView(true);
  if (restart) {
    const audio = selectedAudio.value;
    if (audio) void play(props.def.id, audio).catch(fail);
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
  const waveW = innerW * widthFrac.value;
  for (let c = 0; c < PARAM_SWEEP_WAVE_COLS; c++) {
    const x = padX + (c / (PARAM_SWEEP_WAVE_COLS - 1)) * waveW;
    const a = (selectedAudio.value?.wavePeaks[c] ?? 0) * (waveH / 2) * reveal.value;
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
    ctx.fillText(pivotLabel.value, px + 4, specTop);
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

/** Re-paint when the screen is first laid out and on every later resize. */
useCanvasRedraw(canvas, paint);

async function onPlay(): Promise<void> {
  if (!selectedAudio.value) await compute();
  if (selectedAudio.value) await play(props.def.id, selectedAudio.value);
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
      <div class="ps-controls">
        <div
          class="ps-ab"
          role="group"
          :aria-labelledby="`${def.id}-preview-label`"
          :aria-describedby="`${def.id}-preview-hint`"
        >
          <span :id="`${def.id}-preview-label`" class="ps-ab__label">{{ abLabel }}</span>
          <div class="ps-ab__buttons">
            <button
              v-for="side in (['original', 'processed'] as ParamSweepSide[])"
              :key="side"
              type="button"
              class="ps-ab__button"
              :class="{ 'is-on': selectedSide === side }"
              :data-side="side"
              :aria-pressed="selectedSide === side"
              :aria-describedby="`${def.id}-preview-hint`"
              :aria-label="localized(SIDE_LABELS[side], loc)"
              :disabled="status === 'loading'"
              @click="selectSide(side)"
            >
              {{ localized(SIDE_LABELS[side], loc) }}
            </button>
          </div>
          <span :id="`${def.id}-preview-hint`" class="ps-ab__hint">{{ abHint }}</span>
          <span class="ps-ab__selected" aria-live="polite">
            {{ selectedSideLabel }}
          </span>
        </div>
        <DemoControls
          :model-value="values"
          :params="def.params ?? []"
          :locale="loc"
          :disabled="status === 'loading'"
          @update:model-value="updateParams"
        />
      </div>
    </template>
  </DemoFrame>
</template>

<style scoped>
.ps-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: var(--space-3) var(--space-5);
  width: 100%;
}

.ps-ab {
  display: flex;
  flex: 1 1 100%;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2) var(--space-3);
}

.ps-ab__label,
.ps-ab__selected {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--color-text-tertiary);
  white-space: nowrap;
}

.ps-ab__buttons {
  display: inline-flex;
  padding: 2px;
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-full, 999px);
  background: var(--vp-c-bg);
}

.ps-ab__button {
  appearance: none;
  border: 0;
  border-radius: var(--radius-full, 999px);
  padding: 4px 10px;
  color: var(--color-text-secondary);
  background: transparent;
  cursor: pointer;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  transition: color var(--transition-fast), background var(--transition-fast),
    box-shadow var(--transition-fast);
}

.ps-ab__button:hover:not(:disabled):not(.is-on) {
  color: var(--color-text-primary);
}

.ps-ab__button.is-on {
  color: #fff;
  background: linear-gradient(150deg, var(--color-brand-light), var(--color-brand-dark));
  box-shadow: 0 2px 8px -2px color-mix(in srgb, var(--color-brand) 70%, transparent);
}

.ps-ab__button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.ps-ab__hint {
  flex: 1 1 100%;
  color: var(--color-text-tertiary);
  font-size: 11px;
  line-height: 1.35;
}

.ps-ab__selected {
  color: var(--color-brand);
}

.ps-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
</style>
