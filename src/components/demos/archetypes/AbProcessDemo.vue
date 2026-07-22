<script setup lang="ts">
/**
 * `ab-process` archetype: run a clip through one processor and A/B the result.
 *
 * The current instance is the classical denoiser. A clean sustained chord is fed a
 * deterministic layer of broadband hiss (the "Damaged" source), then the repair stage
 * removes it (the "Repaired" output). Both averaged spectra are drawn at once so the
 * raised noise floor — and the gap it leaves when removed — is the whole story: the
 * Damaged tail rides high across the highs, the Repaired tail drops back onto the
 * music. Flip Compare to audition each side (loudness is untouched, so the hiss is the
 * only thing that moves) and switch the algorithm to see how much floor each one pulls
 * down. The FLOOR readout is the high-band reduction in dB.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useSonareDemoAudio } from '@/composables/useSonareDemoAudio';
import {
  averagedSpectrum,
  hexA,
  mulberry32,
  peakEnvelope,
  SPECTRUM_COMPRESSION,
} from '@/demos/audio/processors';
import type { SonareDemoDef } from '@/demos/types';
import { prepareCanvas2D } from '../canvas';
import { useDemoChrome, useDemoParams } from '../composables';
import DemoControls from '../DemoControls.vue';
import DemoFrame from '../DemoFrame.vue';

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

const view = computed<string>(() => String(values.view ?? 'damaged'));
const mode = computed<string>(() => String(values.mode ?? 'logMmse'));
const repaired = computed(() => view.value === 'repaired');
const clipName = computed(() => (props.def.source.kind === 'clip' ? props.def.source.clip : ''));

// ---- presentation state ----------------------------------------------------
const floorDb = ref(0); // high-band reduction Repaired vs Damaged, in dB
const stateLabel = computed(() => {
  if (status.value === 'loading') return 'REPAIRING';
  if (status.value === 'error') return 'ERROR';
  if (isPlaying.value) return `▸ ${Math.round(progress.value * 100)}%`;
  if (status.value === 'ready') return repaired.value ? 'REPAIRED' : 'DAMAGED';
  return 'IDLE';
});

// ---- audio + figure data ---------------------------------------------------
const NOISE_AMP = 0.05; // injected broadband hiss (linear)
const FLOOR_HZ = 4000; // band above which we score the noise floor
const SPEC_MAX_HZ = 8000;
const SPEC_COLS = 320;
const WAVE_COLS = 360;
const specDmg = new Float32Array(SPEC_COLS); // damaged averaged spectrum (shared scale)
const specRep = new Float32Array(SPEC_COLS); // repaired averaged spectrum (shared scale)
const wavePeaks = new Float32Array(WAVE_COLS); // selected side, time-domain peaks
const dispEmph = ref(0); // 0 = damaged emphasized, 1 = repaired emphasized (eased)

let damaged: { samples: Float32Array; sampleRate: number } | null = null;
let cleaned: { samples: Float32Array; sampleRate: number } | null = null;
const reveal = ref(0);

/** Mean linear magnitude above FLOOR_HZ — the high-band noise-floor proxy. */
function highBandMean(spec: Float32Array): number {
  const c0 = Math.round((FLOOR_HZ / SPEC_MAX_HZ) * (SPEC_COLS - 1));
  let s = 0;
  let n = 0;
  for (let c = c0; c < SPEC_COLS; c++) {
    // Undo the display compression per column so this is a true linear-magnitude
    // average: averaging the compressed columns and de-compressing the mean would
    // bias it, since the mean of a power is not the power of the mean.
    s += spec[c] ** (1 / SPECTRUM_COMPRESSION);
    n++;
  }
  return n > 0 ? s / n : 0;
}

async function compute(): Promise<void> {
  try {
    if (status.value === 'idle') status.value = 'loading';
    const wasm = await ensureWasm();
    const clip = await loadClip(clipName.value);
    const sr = clip.sampleRate;

    // Damaged source: clean clip + deterministic broadband hiss. Cache once.
    if (!damaged) {
      const rng = mulberry32(0x4ad9c1f7);
      const noisy = new Float32Array(clip.samples.length);
      for (let i = 0; i < noisy.length; i++) {
        noisy[i] = clip.samples[i] + (rng() * 2 - 1) * NOISE_AMP;
      }
      damaged = { samples: noisy, sampleRate: sr };
    }

    // Repaired output: classical denoiser at the selected algorithm.
    const out = wasm.masteringRepairDenoiseClassical(damaged.samples, sr, {
      mode: mode.value as 'logMmse' | 'spectralSubtraction' | 'mmseStsa',
      overSubtraction: 1.5,
    });
    cleaned = { samples: out, sampleRate: sr };

    // Both spectra share the damaged scale so the floor drop is read on one axis.
    const scale = 1 / averagedSpectrum(wasm, damaged.samples, sr, specDmg, SPEC_MAX_HZ, 1);
    averagedSpectrum(wasm, damaged.samples, sr, specDmg, SPEC_MAX_HZ, scale);
    averagedSpectrum(wasm, out, sr, specRep, SPEC_MAX_HZ, scale);

    // High-band reduction in dB, from the linear-magnitude band means.
    const dmgHi = highBandMean(specDmg);
    const repHi = highBandMean(specRep);
    floorDb.value = repHi > 0 ? 20 * Math.log10(repHi / Math.max(dmgHi, 1e-9)) : 0;

    peakEnvelope((repaired.value ? cleaned : damaged).samples, wavePeaks);
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
    const targetEmph = repaired.value ? 1 : 0;
    const de = targetEmph - dispEmph.value;
    dispEmph.value += de * 0.22;
    delta = Math.max(delta, Math.abs(de));
    paint();
    if (delta > 0.002) {
      rafId = requestAnimationFrame(step);
    } else {
      dispEmph.value = targetEmph;
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
  const waveH = h * 0.26;
  const waveMid = 10 + waveH / 2;
  const specTop = 10 + waveH + gap;
  const specBot = h - 18;
  const specH = specBot - specTop;
  const playT = isPlaying.value ? progress.value : -1;

  const emph = dispEmph.value; // 0 damaged .. 1 repaired
  const dmgCol = '#fb923c'; // amber = the problem
  const repCol = '#2dd4bf'; // teal = the fix
  const accent = emph > 0.5 ? repCol : dmgCol;

  // --- top: waveform of the auditioned side. Passed portion brightens on playback. ---
  for (let c = 0; c < WAVE_COLS; c++) {
    const x = padX + (c / (WAVE_COLS - 1)) * innerW;
    const a = wavePeaks[c] * (waveH / 2) * reveal.value;
    const passed = playT >= 0 && c / (WAVE_COLS - 1) <= playT;
    ctx.strokeStyle = passed
      ? emph > 0.5
        ? 'rgba(45, 212, 191, 0.95)'
        : 'rgba(251, 146, 60, 0.95)'
      : 'rgba(148, 163, 184, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, waveMid - a);
    ctx.lineTo(x, waveMid + a);
    ctx.stroke();
  }

  // --- noise-floor band shading above FLOOR_HZ (the scored region) ---
  const floorX = padX + (FLOOR_HZ / SPEC_MAX_HZ) * innerW;
  ctx.fillStyle = 'rgba(148, 163, 184, 0.06)';
  ctx.fillRect(floorX, specTop, padX + innerW - floorX, specH);
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 3]);
  ctx.beginPath();
  ctx.moveTo(floorX, specTop);
  ctx.lineTo(floorX, specBot);
  ctx.stroke();
  ctx.setLineDash([]);

  // --- spectra: both drawn at once, the auditioned side emphasized ---
  const drawSpec = (spec: Float32Array, color: string, strong: boolean): void => {
    const alphaFill = strong ? 0.34 : 0.08;
    const grad = ctx.createLinearGradient(0, specTop, 0, specBot);
    grad.addColorStop(0, hexA(color, alphaFill));
    grad.addColorStop(1, hexA(color, 0.02));
    ctx.beginPath();
    ctx.moveTo(padX, specBot);
    for (let c = 0; c < SPEC_COLS; c++) {
      const x = padX + (c / (SPEC_COLS - 1)) * innerW;
      ctx.lineTo(x, specBot - spec[c] * specH * reveal.value);
    }
    ctx.lineTo(padX + innerW, specBot);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.strokeStyle = hexA(color, strong ? 0.95 : 0.4);
    ctx.lineWidth = strong ? 1.8 : 1.1;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let c = 0; c < SPEC_COLS; c++) {
      const x = padX + (c / (SPEC_COLS - 1)) * innerW;
      const y = specBot - spec[c] * specH * reveal.value;
      c === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  };

  // Draw the de-emphasized one first, the emphasized one on top.
  if (emph > 0.5) {
    drawSpec(specDmg, dmgCol, false);
    drawSpec(specRep, repCol, true);
  } else {
    drawSpec(specRep, repCol, false);
    drawSpec(specDmg, dmgCol, true);
  }

  // FLOOR readout (high-band reduction).
  ctx.font = '9px "JetBrains Mono", ui-monospace, monospace';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(45, 212, 191, 0.95)';
  ctx.fillText(
    `FLOOR ${floorDb.value <= 0 ? '' : '+'}${floorDb.value.toFixed(1)} dB`,
    padX + innerW,
    specTop + 2,
  );
  ctx.textAlign = 'left';

  // Legend.
  const legendY = specTop + 2;
  ctx.font = '9px "JetBrains Mono", ui-monospace, monospace';
  ctx.fillStyle = hexA(dmgCol, emph > 0.5 ? 0.5 : 0.95);
  ctx.fillRect(padX, legendY + 1, 9, 3);
  ctx.fillText('Damaged', padX + 13, legendY);
  ctx.fillStyle = hexA(repCol, emph > 0.5 ? 0.95 : 0.5);
  ctx.fillRect(padX + 72, legendY + 1, 9, 3);
  ctx.fillText('Repaired', padX + 85, legendY);

  // Axis labels.
  ctx.fillStyle = 'rgba(186, 230, 224, 0.5)';
  ctx.fillText('WAVE', padX, 2);
  ctx.fillStyle = 'rgba(186, 230, 224, 0.45)';
  ctx.textBaseline = 'bottom';
  ctx.fillText('0 Hz', padX, specBot + 14);
  ctx.fillText(`${(FLOOR_HZ / 1000).toFixed(0)}k`, floorX + 3, specBot + 14);
  ctx.textAlign = 'right';
  ctx.fillText(`${(SPEC_MAX_HZ / 1000).toFixed(0)} kHz`, padX + innerW, specBot + 14);
  ctx.textAlign = 'left';

  // The accent colour drives the frame beam through `tone`; keep a faint tracer.
  if (playT >= 0) {
    const x = padX + playT * innerW;
    ctx.strokeStyle = hexA(accent, 0.5);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, 8);
    ctx.lineTo(x, waveMid + waveH / 2);
    ctx.stroke();
  }
}

async function onPlay(): Promise<void> {
  if (!damaged || !cleaned) await compute();
  const audio = repaired.value ? cleaned : damaged;
  if (audio) await play(props.def.id, audio);
}

watch(view, () => {
  if (status.value === 'idle') return;
  // Re-emphasize the figure and re-fill the waveform for the newly selected side.
  peakEnvelope((repaired.value ? cleaned : damaged)?.samples ?? wavePeaks, wavePeaks);
  startMorph();
  // If a side is sounding, swap to the other side seamlessly.
  if (isPlaying.value) {
    stop();
    const audio = repaired.value ? cleaned : damaged;
    if (audio) play(props.def.id, audio);
  }
});

// Coalesce rapid algorithm changes into one render per frame.
let pending = 0;
function scheduleCompute(): void {
  if (pending) return;
  pending = requestAnimationFrame(() => {
    pending = 0;
    compute();
  });
}

watch(mode, () => {
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
    eyebrow="A/B PROCESS · DENOISE"
    :title="title"
    :caption="caption"
    :state="stateLabel"
    :tone="tone"
    :playing="isPlaying"
    :progress="progress"
    :disabled="status === 'loading'"
    :error="status === 'error' ? errorMsg : null"
    loading-label="REPAIRING…"
    :show-playhead="isPlaying"
    @toggle="onPlay"
  >
    <template #screen>
      <canvas ref="canvas" class="ab-canvas" />
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
.ab-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
</style>
