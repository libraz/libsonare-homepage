<script setup lang="ts">
/**
 * `transform` archetype: source audio → WASM spectral transform → 2D visualization.
 *
 * Renders a time–feature heatmap into the shared {@link DemoFrame} screen. The
 * transform is config-driven (`config.transform`): an STFT magnitude spectrogram, a
 * mel spectrogram, a chromagram (12 pitch classes), or an MFCC map. The audio source
 * is either a generated test signal or a pre-rendered clip; the reader can audition
 * it, and a playback-synced playhead sweeps the screen.
 *
 * The WASM/data wiring is independent of presentation; the frame owns all chrome
 * and the playback visuals (beam, reveal, progress ring) via its props.
 */
import { computed, ref, watch } from 'vue';
import { type MonoAudio, useSonareDemoAudio } from '@/composables/useSonareDemoAudio';
import { generateSignal } from '@/demos/signal';
import type { SonareDemoDef } from '@/demos/types';
import { useDemoChrome } from '../composables';
import DemoFrame from '../DemoFrame.vue';

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

type TransformKind = 'stft' | 'mel' | 'chroma' | 'mfcc';
const transform = computed<TransformKind>(
  () => (props.def.config?.transform as TransformKind) ?? 'stft',
);
const EYEBROWS: Record<TransformKind, string> = {
  stft: 'STFT · SPECTRAL',
  mel: 'MEL · SPECTRAL',
  chroma: 'CHROMA · PITCH CLASS',
  mfcc: 'MFCC · TIMBRE',
};
const eyebrow = computed(() => EYEBROWS[transform.value]);
const axisFreq = computed(() => {
  switch (transform.value) {
    case 'chroma':
      return 'NOTE';
    case 'mfcc':
      return 'COEF';
    default:
      return 'FREQ';
  }
});

// ---- presentation-only derived values (no effect on data flow) -------------
const stateLabel = computed(() => {
  if (status.value === 'loading') return 'ANALYZING';
  if (status.value === 'error') return 'ERROR';
  if (isPlaying.value) return `▸ ${Math.round(progress.value * 100)}%`;
  if (status.value === 'ready') return 'READY';
  return 'IDLE';
});

let audio: MonoAudio | null = null;
type WasmModule = Awaited<ReturnType<typeof ensureWasm>>;

/** Resolve the demo's audio: generated in-browser, or decoded from a clip. */
async function resolveAudio(): Promise<MonoAudio> {
  if (props.def.source.kind === 'generate') {
    return generateSignal(props.def.source);
  }
  return loadClip(props.def.source.clip);
}

/** Map a normalized 0..1 magnitude to an RGB ramp (dark → warm → bright). */
function ramp(v: number, out: Uint8ClampedArray, o: number): void {
  const t = Math.max(0, Math.min(1, v));
  out[o] = Math.round(255 * Math.min(1, t * 1.6)); // R
  out[o + 1] = Math.round(255 * Math.max(0, t * 1.4 - 0.4)); // G
  out[o + 2] = Math.round(255 * Math.max(0, t * 1.2 - 0.7) + 40 * (1 - t)); // B
  out[o + 3] = 255;
}

/**
 * Build a normalized `[rows × cols]` grid (values 0..1, row 0 = bottom of the
 * image) for the configured transform. Each transform has its own natural scaling:
 * STFT/mel use dB, chroma/MFCC are min–max normalized over the whole map.
 */
type Grid = { rows: number; cols: number; norm: Float32Array };

function gridFromStft(wasm: WasmModule, a: MonoAudio, nFft: number, hop: number): Grid {
  const r = wasm.stft(a.samples, a.sampleRate, nFft, hop);
  const { nBins, nFrames, magnitude } = r;
  const norm = new Float32Array(nBins * nFrames);
  const floorDb = -90;
  for (let bin = 0; bin < nBins; bin++) {
    for (let frame = 0; frame < nFrames; frame++) {
      const db = 20 * Math.log10(magnitude[bin * nFrames + frame] + 1e-9);
      norm[bin * nFrames + frame] = (db - floorDb) / -floorDb;
    }
  }
  return { rows: nBins, cols: nFrames, norm };
}

function gridFromMel(
  wasm: WasmModule,
  a: MonoAudio,
  nFft: number,
  hop: number,
  nMels: number,
): Grid {
  const r = wasm.melSpectrogram(a.samples, a.sampleRate, nFft, hop, nMels);
  const { nFrames, db } = r;
  // mel `db` is power-to-dB without a fixed reference, so values are not bounded to
  // ≤0. Display the top 80 dB below the peak (librosa's top_db convention).
  let peak = Number.NEGATIVE_INFINITY;
  for (const v of db) if (v > peak) peak = v;
  const range = 80;
  const floorDb = peak - range;
  const norm = new Float32Array(nMels * nFrames);
  for (let i = 0; i < norm.length; i++) {
    norm[i] = Math.max(0, Math.min(1, (db[i] - floorDb) / range));
  }
  return { rows: nMels, cols: nFrames, norm };
}

function gridFromChroma(wasm: WasmModule, a: MonoAudio, nFft: number, hop: number): Grid {
  const r = wasm.chroma(a.samples, a.sampleRate, nFft, hop);
  const { nChroma, nFrames, features } = r;
  let max = 1e-9;
  for (const v of features) if (v > max) max = v;
  const norm = new Float32Array(features.length);
  for (let i = 0; i < norm.length; i++) norm[i] = features[i] / max;
  return { rows: nChroma, cols: nFrames, norm };
}

function gridFromMfcc(
  wasm: WasmModule,
  a: MonoAudio,
  nFft: number,
  hop: number,
  nMfcc: number,
): Grid {
  const r = wasm.mfcc(a.samples, a.sampleRate, nFft, hop, 40, nMfcc);
  const { nFrames, coefficients } = r;
  // Drop the 0th coefficient (overall energy) so the timbral detail is visible,
  // then min–max normalize the rest across the whole map.
  const rows = Math.max(1, nMfcc - 1);
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (let c = 1; c < nMfcc; c++) {
    for (let frame = 0; frame < nFrames; frame++) {
      const v = coefficients[c * nFrames + frame];
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  const span = hi - lo || 1;
  const norm = new Float32Array(rows * nFrames);
  for (let c = 1; c < nMfcc; c++) {
    for (let frame = 0; frame < nFrames; frame++) {
      norm[(c - 1) * nFrames + frame] = (coefficients[c * nFrames + frame] - lo) / span;
    }
  }
  return { rows, cols: nFrames, norm };
}

/** Compute the configured transform and paint it as a time–feature heatmap. */
async function run(): Promise<void> {
  status.value = 'loading';
  errorMsg.value = '';
  try {
    const wasm = await ensureWasm();
    audio = await resolveAudio();
    const cfg = props.def.config ?? {};
    const nFft = (cfg.nFft as number) ?? 1024;
    const hop = (cfg.hopLength as number) ?? 256;

    let grid: Grid;
    switch (transform.value) {
      case 'mel':
        grid = gridFromMel(wasm, audio, nFft, hop, (cfg.nMels as number) ?? 64);
        break;
      case 'chroma':
        grid = gridFromChroma(wasm, audio, nFft, hop);
        break;
      case 'mfcc':
        grid = gridFromMfcc(wasm, audio, nFft, hop, (cfg.nMfcc as number) ?? 20);
        break;
      default:
        grid = gridFromStft(wasm, audio, nFft, hop);
    }

    const { rows, cols, norm } = grid;
    const el = canvas.value;
    if (!el) return;
    el.width = cols;
    el.height = rows;
    const ctx = el.getContext('2d');
    if (!ctx) return;

    const img = ctx.createImageData(cols, rows);
    for (let r = 0; r < rows; r++) {
      // Row 0 is the bottom of the image (low freq / first pitch class / first coef).
      const y = rows - 1 - r;
      for (let frame = 0; frame < cols; frame++) {
        ramp(norm[r * cols + frame], img.data, (y * cols + frame) * 4);
      }
    }
    ctx.putImageData(img, 0, 0);
    status.value = 'ready';
  } catch (e) {
    fail(e);
  }
}

async function onPlay(): Promise<void> {
  if (!audio) audio = await resolveAudio();
  await play(props.def.id, audio);
}

watch(
  () => props.active,
  (on) => {
    if (on && status.value === 'idle') run();
  },
  { immediate: true },
);
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
    loading-label="ANALYZING…"
    :axis-freq="axisFreq"
    axis-time="TIME →"
    @toggle="onPlay"
  >
    <template #screen>
      <canvas ref="canvas" class="td-canvas" />
    </template>
  </DemoFrame>
</template>

<style scoped>
/* Slotted into DemoFrame's screen; fills it. Frame owns all other styling. */
.td-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  image-rendering: auto;
  opacity: 0.96;
}
</style>
