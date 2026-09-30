<script setup lang="ts">
/**
 * `chord-track` archetype: run chord recognition over a clip and lane the detected
 * segments above its waveform.
 *
 * `detectChords` returns labelled spans. Each is drawn as a block in a lane over the
 * waveform, named, coloured by whether it is one of the four triads or a richer
 * quality, and faded by its confidence; the boundaries drop through the waveform as
 * markers that light up when the playhead crosses them. The template vocabulary and
 * the minimum segment duration are the two controls because they are the two that
 * move the answer on the shipped clip: the default STFT pass reads the four triads
 * cleanly, while a shorter minimum preserves brief extension readings near changes.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { hexA, peakEnvelope } from '@/demos/inline/audio/processors';
import { type I18nText, localized, type SonareDemoDef } from '@/demos/inline/types';
import { useSonareDemoAudio } from '@/demos/inline/useSonareDemoAudio';
import { prepareCanvas2D } from '@/utils/canvas';
import { useCanvasRedraw, useDemoChrome, useDemoParams, useDisposed } from '../composables';
import DemoControls from '../DemoControls.vue';
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

// ---- reader-adjustable parameters ------------------------------------------
const { values, updateParams } = useDemoParams(props.def);

/** Template set: `triads` searches the four triads, anything else the full 24 qualities. */
const triadsOnly = computed<boolean>(() => String(values.vocabulary ?? 'full') === 'triads');
/** Segments shorter than this are merged into a neighbour, in seconds. */
const minDuration = computed<number>(() => Number(values.minDuration ?? 0.3));
const clipName = computed(() => (props.def.source.kind === 'clip' ? props.def.source.clip : ''));

// ---- presentation state ----------------------------------------------------
type WasmModule = Awaited<ReturnType<typeof ensureWasm>>;
type Chord = ReturnType<WasmModule['detectChords']>['chords'][number];

/** Segment as drawn: the engine's span plus whether its quality is a plain triad. */
interface Segment {
  chord: Chord;
  triad: boolean;
}

let segments: Segment[] = [];
const segmentCount = ref(0);
const activeName = ref('');

const NO_CHORDS: I18nText = { en: 'NO CHORDS', ja: 'コードなし' };
const LEGEND_TRIAD: I18nText = { en: 'Triad', ja: '三和音' };
const LEGEND_EXTENDED: I18nText = { en: 'Extended', ja: '拡張' };
const noChordsText = computed(() => localized(NO_CHORDS, loc.value));
const legendTriadText = computed(() => localized(LEGEND_TRIAD, loc.value));
const legendExtendedText = computed(() => localized(LEGEND_EXTENDED, loc.value));

const stateLabel = computed(() => {
  if (status.value === 'loading') return 'ANALYZING';
  if (status.value === 'error') return 'ERROR';
  if (isPlaying.value) return activeName.value ? `▸ ${activeName.value}` : '▸';
  if (status.value !== 'ready') return 'IDLE';
  return segmentCount.value > 0 ? `${segmentCount.value} CHORDS` : noChordsText.value;
});

// ---- waveform + chord data -------------------------------------------------
const COLS = 540;
const peaks = new Float32Array(COLS); // 0..1 absolute peak per column
let duration = 0;
let clip: { samples: Float32Array; sampleRate: number } | null = null;
const reveal = ref(0); // 0..1 lane and waveform fade-in

/** Run recognition with the current controls and keep the spans inside the clip. */
function detect(wasm: WasmModule, samples: Float32Array, sr: number): void {
  const { chords } = wasm.detectChords(samples, sr, {
    useBeatSync: false,
    useTriadsOnly: triadsOnly.value,
    minDuration: minDuration.value,
  });
  const triadMax = wasm.ChordQuality.Augmented;
  segments = chords
    .filter((c) => c.end > c.start && c.start < duration)
    .map((chord) => ({ chord, triad: chord.quality <= triadMax }));
  segmentCount.value = segments.length;
}

const disposed = useDisposed();

async function compute(): Promise<void> {
  if (disposed()) return;
  try {
    if (status.value === 'idle') status.value = 'loading';
    const wasm = await ensureWasm();
    if (disposed()) return;
    if (!clip) {
      const loaded = await loadClip(clipName.value);
      if (disposed()) return;
      clip = loaded;
      duration = clip.samples.length / clip.sampleRate;
      peakEnvelope(clip.samples, peaks);
    }
    detect(wasm, clip.samples, clip.sampleRate);
    status.value = 'ready';
    if (reveal.value < 1) startReveal();
    else paint();
  } catch (e) {
    if (disposed()) return;
    fail(e);
  }
}

// ---- animation -------------------------------------------------------------
let revealRaf = 0;
function startReveal(): void {
  if (revealRaf) return;
  const step = () => {
    reveal.value = Math.min(1, reveal.value + 0.06);
    paint();
    revealRaf = reveal.value < 1 ? requestAnimationFrame(step) : 0;
  };
  revealRaf = requestAnimationFrame(step);
}

// Repaint every frame while playing so the active block follows the playhead.
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
  else {
    activeName.value = '';
    paint();
  }
});

// ---- paint -----------------------------------------------------------------
const PAD_X = 14;
const LANE_TOP = 10;
const LANE_H = 26;
const PAD_BOT = 16; // room for the legend under the waveform
const TRIAD_COL = '#2dd4bf'; // teal = one of the four triads
const EXT_COL = '#a78bfa'; // violet = any richer quality
const NC_COL = '#94a3b8'; // slate = no chord (below threshold)

function segmentColor(seg: Segment): string {
  if (seg.chord.name === 'N.C.') return NC_COL;
  return seg.triad ? TRIAD_COL : EXT_COL;
}

function paint(): void {
  const frame = prepareCanvas2D(canvas.value);
  if (!frame) return;
  const { ctx, width: w, height: h } = frame;

  const innerW = w - PAD_X * 2;
  const laneBottom = LANE_TOP + LANE_H;
  const waveTop = laneBottom + 6;
  const waveBottom = h - PAD_BOT;
  const mid = (waveTop + waveBottom) / 2;
  const ampH = (waveBottom - waveTop) * 0.45;
  const playT = isPlaying.value ? progress.value * duration : -1;
  const xOf = (t: number): number => PAD_X + (duration > 0 ? t / duration : 0) * innerW;

  // Waveform (mirrored peaks). Passed portion brightens during playback.
  for (let c = 0; c < COLS; c++) {
    const x = PAD_X + (c / (COLS - 1)) * innerW;
    const a = peaks[c] * ampH * reveal.value;
    const t = (c / (COLS - 1)) * duration;
    const passed = playT >= 0 && t <= playT;
    ctx.strokeStyle = passed ? 'rgba(186, 230, 224, 0.85)' : 'rgba(148, 163, 184, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, mid - a);
    ctx.lineTo(x, mid + a);
    ctx.stroke();
  }

  // Lane track behind the blocks.
  ctx.fillStyle = 'rgba(148, 163, 184, 0.08)';
  ctx.fillRect(PAD_X, LANE_TOP, innerW, LANE_H);

  ctx.font = '10px "JetBrains Mono", ui-monospace, monospace';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  let nowName = '';

  for (const seg of segments) {
    const { chord } = seg;
    const x0 = xOf(chord.start);
    const x1 = xOf(Math.min(chord.end, duration));
    const bw = Math.max(1, x1 - x0 - 2);
    const color = segmentColor(seg);
    const live = playT >= 0 && playT >= chord.start && playT < chord.end;
    if (live) nowName = chord.name;
    const reached = playT < 0 || chord.start <= playT;
    // Confidence sets the block's weight; an unreached block waits dimmed.
    const conf = Math.max(0, Math.min(1, chord.confidence));
    const base = (0.18 + 0.42 * conf) * (reached ? 1 : 0.45);
    ctx.globalAlpha = reveal.value;
    ctx.fillStyle = hexA(color, live ? 0.85 : base);
    ctx.shadowColor = hexA(color, 0.9);
    ctx.shadowBlur = live ? 12 : 0;
    ctx.fillRect(x0 + 1, LANE_TOP, bw, LANE_H);
    ctx.shadowBlur = 0;

    // Name only where it fits inside its block.
    if (ctx.measureText(chord.name).width + 6 <= bw) {
      ctx.fillStyle = live ? '#0f172a' : hexA('#e2e8f0', reached ? 0.95 : 0.5);
      ctx.fillText(chord.name, x0 + 1 + bw / 2, LANE_TOP + LANE_H / 2);
    }

    // Boundary marker through the waveform, flashing as the playhead crosses it.
    if (chord.start > 0) {
      let alpha = 0.45;
      let lw = 1.2;
      let blur = 0;
      if (playT >= 0) {
        if (chord.start > playT) alpha = 0.2;
        else {
          const flash = Math.exp(-(playT - chord.start) / 0.16); // fades ~160ms
          alpha = 0.5 + 0.5 * flash;
          lw = 1.2 + 2 * flash;
          blur = 10 * flash;
        }
      }
      ctx.globalAlpha = alpha * reveal.value;
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      ctx.shadowColor = hexA(color, 0.9);
      ctx.shadowBlur = blur;
      ctx.beginPath();
      ctx.moveTo(x0, LANE_TOP);
      ctx.lineTo(x0, waveBottom);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }
  ctx.globalAlpha = 1;
  activeName.value = nowName;

  // Playhead through the lane and the waveform.
  if (playT >= 0) {
    const px = xOf(playT);
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(px, LANE_TOP);
    ctx.lineTo(px, waveBottom);
    ctx.stroke();
  }

  // Legend: swatch + word for each colour family.
  ctx.font = '9px "JetBrains Mono", ui-monospace, monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const ly = h - PAD_BOT / 2;
  ctx.fillStyle = hexA(TRIAD_COL, 0.9);
  ctx.fillRect(PAD_X, ly - 1.5, 9, 3);
  ctx.fillStyle = 'rgba(203, 213, 225, 0.8)';
  ctx.fillText(legendTriadText.value, PAD_X + 13, ly);
  const triadW = ctx.measureText(legendTriadText.value).width;
  const lx = PAD_X + 13 + triadW + 14;
  ctx.fillStyle = hexA(EXT_COL, 0.9);
  ctx.fillRect(lx, ly - 1.5, 9, 3);
  ctx.fillStyle = 'rgba(203, 213, 225, 0.8)';
  ctx.fillText(legendExtendedText.value, lx + 13, ly);

  if (status.value === 'ready' && segments.length === 0) {
    ctx.textAlign = 'center';
    ctx.fillStyle = hexA(NC_COL, 0.8);
    ctx.fillText(noChordsText.value, PAD_X + innerW / 2, LANE_TOP + LANE_H / 2);
  }
}

/** Re-paint when the screen is first laid out and on every later resize. */
useCanvasRedraw(canvas, paint);

async function onPlay(): Promise<void> {
  if (!clip) await compute();
  if (clip) await play(props.def.id, clip);
}

// Coalesce rapid control changes (slider drags) into one analysis per frame.
let pending = 0;
function scheduleCompute(): void {
  if (pending) return;
  pending = requestAnimationFrame(() => {
    pending = 0;
    compute();
  });
}

watch([triadsOnly, minDuration], () => {
  if (status.value !== 'idle') scheduleCompute();
});

watch(
  () => props.active,
  (on) => {
    if (on && status.value === 'idle') compute();
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  if (revealRaf) cancelAnimationFrame(revealRaf);
  if (playRaf) cancelAnimationFrame(playRaf);
  if (pending) cancelAnimationFrame(pending);
});
</script>

<template>
  <DemoFrame
    eyebrow="CHORD TRACK · DETECT CHORDS"
    :title="title"
    :caption="caption"
    :state="stateLabel"
    :tone="tone"
    :playing="isPlaying"
    :progress="progress"
    :disabled="status === 'loading'"
    :error="status === 'error' ? errorMsg : null"
    loading-label="ANALYZING…"
    :show-playhead="isPlaying"
    @toggle="onPlay"
  >
    <template #screen>
      <canvas ref="canvas" class="ct-canvas" />
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
.ct-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
</style>
