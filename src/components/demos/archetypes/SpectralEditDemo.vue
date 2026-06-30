<script setup lang="ts">
/**
 * `spectral-edit` archetype: surgically remove a localized artifact with `spectralEdit`.
 *
 * A clean sustained tone is given a deterministic narrow-band "whistle" over a middle
 * time window (the Artifact source). One `spectralEdit` region op — the same
 * time x frequency rectangle the whistle occupies — then removes it (the Edited output).
 * Both averaged spectra are drawn at once: the whistle reads as a sharp spike in the
 * notch band; after the edit it drops back onto the music while everything outside the
 * band is untouched. The mode select switches how the masked bins are treated —
 * attenuate (gainDb), mute (silence the bins) or heal (interpolate from neighbour
 * frames). Flip Compare to audition each side at matched loudness; the NOTCH readout is
 * the in-band reduction in dB.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useSonareDemoAudio } from '@/composables/useSonareDemoAudio';
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

type EditMode = 'attenuate' | 'mute' | 'heal';
const view = computed<string>(() => String(values.view ?? 'artifact'));
const mode = computed<EditMode>(() => String(values.mode ?? 'heal') as EditMode);
const edited = computed(() => view.value === 'edited');
const clipName = computed(() => (props.def.source.kind === 'clip' ? props.def.source.clip : ''));

// ---- whistle artifact + edit region (fixed time x frequency rectangle) ------
const WHISTLE_HZ = 2600; // injected narrow-band tone
const BAND_HALF_HZ = 220; // notch half-width around the whistle
const WIN_START = 0.32; // artifact time window (fraction of the clip)
const WIN_END = 0.7;
const ATTENUATE_DB = -28; // gainDb used in 'attenuate' mode

// ---- presentation state ----------------------------------------------------
const notchDb = ref(0); // in-band reduction Edited vs Artifact, in dB
const stateLabel = computed(() => {
  if (status.value === 'loading') return 'EDITING';
  if (status.value === 'error') return 'ERROR';
  if (isPlaying.value) return `▸ ${Math.round(progress.value * 100)}%`;
  if (status.value === 'ready') return edited.value ? 'EDITED' : 'ARTIFACT';
  return 'IDLE';
});

// ---- audio + figure data ---------------------------------------------------
const SPEC_MAX_HZ = 6000;
const SPEC_COLS = 320;
const WAVE_COLS = 360;
const specArt = new Float32Array(SPEC_COLS); // artifact averaged spectrum (shared scale)
const specEd = new Float32Array(SPEC_COLS); // edited averaged spectrum (shared scale)
const wavePeaks = new Float32Array(WAVE_COLS); // selected side, time-domain peaks
const dispEmph = ref(0); // 0 = artifact emphasized, 1 = edited emphasized (eased)

let artifact: { samples: Float32Array; sampleRate: number } | null = null;
let editedAudio: { samples: Float32Array; sampleRate: number } | null = null;
const reveal = ref(0);

type WasmModule = Awaited<ReturnType<typeof ensureWasm>>;

/** Per-column absolute peaks of the selected side (top waveform strip). */
function fillWave(samples: Float32Array): void {
  const n = samples.length;
  let max = 1e-6;
  for (let c = 0; c < WAVE_COLS; c++) {
    const start = Math.floor((c / WAVE_COLS) * n);
    const end = Math.max(start + 1, Math.floor(((c + 1) / WAVE_COLS) * n));
    let p = 0;
    for (let i = start; i < end && i < n; i++) {
      const a = Math.abs(samples[i]);
      if (a > p) p = a;
    }
    wavePeaks[c] = p;
    if (p > max) max = p;
  }
  for (let c = 0; c < WAVE_COLS; c++) wavePeaks[c] /= max;
}

/** Averaged magnitude spectrum sampled to SPEC_COLS, on a caller-supplied scale. */
function sampleSpectrum(
  wasm: WasmModule,
  samples: Float32Array,
  sr: number,
  out: Float32Array,
  scale: number,
): number {
  const r = wasm.stft(samples, sr, 2048, 512);
  const { nBins, nFrames, magnitude } = r;
  const binHz = sr / 2048;
  const avg = new Float32Array(nBins);
  let max = 1e-6;
  for (let b = 0; b < nBins; b++) {
    let s = 0;
    for (let fr = 0; fr < nFrames; fr++) s += magnitude[b * nFrames + fr];
    avg[b] = s / nFrames;
    if (avg[b] > max) max = avg[b];
  }
  for (let c = 0; c < SPEC_COLS; c++) {
    const hz = (c / (SPEC_COLS - 1)) * SPEC_MAX_HZ;
    const bin = hz / binHz;
    const b0 = Math.floor(bin);
    const frac = bin - b0;
    const v = b0 + 1 < nBins ? avg[b0] * (1 - frac) + avg[b0 + 1] * frac : (avg[b0] ?? 0);
    out[c] = ((v * scale) ** 0.6) as number; // compress for legibility; shared scale
  }
  return max;
}

/** Mean linear magnitude inside the notch band — the in-band level proxy. */
function bandMean(spec: Float32Array): number {
  const c0 = Math.round(((WHISTLE_HZ - BAND_HALF_HZ) / SPEC_MAX_HZ) * (SPEC_COLS - 1));
  const c1 = Math.round(((WHISTLE_HZ + BAND_HALF_HZ) / SPEC_MAX_HZ) * (SPEC_COLS - 1));
  let s = 0;
  let n = 0;
  for (let c = Math.max(0, c0); c <= Math.min(SPEC_COLS - 1, c1); c++) {
    s += spec[c];
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
    const n = clip.samples.length;
    const s0 = Math.floor(WIN_START * n);
    const s1 = Math.floor(WIN_END * n);

    // Artifact source: clean clip + a deterministic narrow-band whistle over the
    // middle window. A short raised-cosine fade on each edge avoids click transients
    // that would smear across the whole spectrum. Cache once.
    if (!artifact) {
      const noisy = Float32Array.from(clip.samples);
      const fade = Math.floor(sr * 0.02);
      const w = (2 * Math.PI * WHISTLE_HZ) / sr;
      for (let i = s0; i < s1; i++) {
        let env = 0.08;
        if (i - s0 < fade) env *= (i - s0) / fade;
        else if (s1 - i < fade) env *= (s1 - i) / fade;
        noisy[i] += env * Math.sin(w * (i - s0));
      }
      artifact = { samples: noisy, sampleRate: sr };
    }

    // Edited output: one region op over the whistle's time x frequency rectangle.
    const op = {
      startSample: s0,
      endSample: s1,
      lowHz: WHISTLE_HZ - BAND_HALF_HZ,
      highHz: WHISTLE_HZ + BAND_HALF_HZ,
      mode: mode.value,
      gainDb: mode.value === 'attenuate' ? ATTENUATE_DB : 0,
    };
    const out = wasm.spectralEdit(artifact.samples, sr, [op], { nFft: 2048, hopLength: 512 });
    editedAudio = { samples: out, sampleRate: sr };

    // Both spectra share the artifact scale so the in-band drop is read on one axis.
    const scale = 1 / sampleSpectrum(wasm, artifact.samples, sr, specArt, 1);
    sampleSpectrum(wasm, artifact.samples, sr, specArt, scale);
    sampleSpectrum(wasm, out, sr, specEd, scale);

    // In-band reduction in dB (uses the underlying linear means, pre-compression).
    const artBand = bandMean(specArt) ** (1 / 0.6);
    const edBand = bandMean(specEd) ** (1 / 0.6);
    notchDb.value =
      artBand > 0 ? 20 * Math.log10(Math.max(edBand, 1e-9) / Math.max(artBand, 1e-9)) : 0;

    fillWave((edited.value ? editedAudio : artifact).samples);
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
    const targetEmph = edited.value ? 1 : 0;
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

  const emph = dispEmph.value; // 0 artifact .. 1 edited
  const artCol = '#fb923c'; // amber = the artifact
  const edCol = '#2dd4bf'; // teal = the edit
  const accent = emph > 0.5 ? edCol : artCol;

  // --- top: waveform of the auditioned side. Artifact window is shaded; passed
  // portion brightens on playback. ---
  const winX0 = padX + WIN_START * innerW;
  const winX1 = padX + WIN_END * innerW;
  ctx.fillStyle = 'rgba(148, 163, 184, 0.07)';
  ctx.fillRect(winX0, 8, winX1 - winX0, waveH);
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

  // --- notch band shading around the whistle (the edited region) ---
  const bandX0 = padX + ((WHISTLE_HZ - BAND_HALF_HZ) / SPEC_MAX_HZ) * innerW;
  const bandX1 = padX + ((WHISTLE_HZ + BAND_HALF_HZ) / SPEC_MAX_HZ) * innerW;
  ctx.fillStyle = 'rgba(148, 163, 184, 0.08)';
  ctx.fillRect(bandX0, specTop, bandX1 - bandX0, specH);
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 3]);
  for (const bx of [bandX0, bandX1]) {
    ctx.beginPath();
    ctx.moveTo(bx, specTop);
    ctx.lineTo(bx, specBot);
    ctx.stroke();
  }
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
    drawSpec(specArt, artCol, false);
    drawSpec(specEd, edCol, true);
  } else {
    drawSpec(specEd, edCol, false);
    drawSpec(specArt, artCol, true);
  }

  // NOTCH readout (in-band reduction).
  ctx.font = '9px "JetBrains Mono", ui-monospace, monospace';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(45, 212, 191, 0.95)';
  ctx.fillText(
    `NOTCH ${notchDb.value >= 0 ? '+' : ''}${notchDb.value.toFixed(1)} dB`,
    padX + innerW,
    specTop + 2,
  );
  ctx.textAlign = 'left';

  // Legend.
  const legendY = specTop + 2;
  ctx.fillStyle = hexA(artCol, emph > 0.5 ? 0.5 : 0.95);
  ctx.fillRect(padX, legendY + 1, 9, 3);
  ctx.fillText('Artifact', padX + 13, legendY);
  ctx.fillStyle = hexA(edCol, emph > 0.5 ? 0.95 : 0.5);
  ctx.fillRect(padX + 68, legendY + 1, 9, 3);
  ctx.fillText('Edited', padX + 81, legendY);

  // Axis labels.
  ctx.fillStyle = 'rgba(186, 230, 224, 0.5)';
  ctx.fillText('WAVE', padX, 2);
  ctx.fillStyle = 'rgba(186, 230, 224, 0.45)';
  ctx.textBaseline = 'bottom';
  ctx.fillText('0 Hz', padX, specBot + 14);
  ctx.fillText(`${(WHISTLE_HZ / 1000).toFixed(1)}k`, (bandX0 + bandX1) / 2 - 8, specBot + 14);
  ctx.textAlign = 'right';
  ctx.fillText(`${(SPEC_MAX_HZ / 1000).toFixed(0)} kHz`, padX + innerW, specBot + 14);
  ctx.textAlign = 'left';

  // Faint tracer beam during playback.
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

/** Append an alpha to a #rrggbb colour as an rgba() string. */
function hexA(hex: string, a: number): string {
  const num = Number.parseInt(hex.slice(1), 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

async function onPlay(): Promise<void> {
  if (!artifact || !editedAudio) await compute();
  const audio = edited.value ? editedAudio : artifact;
  if (audio) await play(props.def.id, audio);
}

watch(view, () => {
  if (status.value === 'idle') return;
  fillWave((edited.value ? editedAudio : artifact)?.samples ?? wavePeaks);
  startMorph();
  if (isPlaying.value) {
    stop();
    const audio = edited.value ? editedAudio : artifact;
    if (audio) play(props.def.id, audio);
  }
});

// Coalesce rapid mode changes into one render per frame.
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
    eyebrow="SPECTRAL EDIT · REGION"
    :title="title"
    :caption="caption"
    :state="stateLabel"
    :tone="tone"
    :playing="isPlaying"
    :progress="progress"
    :disabled="status === 'loading'"
    :error="status === 'error' ? errorMsg : null"
    loading-label="EDITING…"
    :show-playhead="isPlaying"
    @toggle="onPlay"
  >
    <template #screen>
      <canvas ref="canvas" class="spec-canvas" />
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
.spec-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
</style>
