<script setup lang="ts">
/**
 * `detector` archetype: run an analyzer over a clip and overlay what it found on the
 * waveform.
 *
 * The clip's waveform is drawn once; on top of it we mark the times the detector
 * reports. Switch the view between *onsets* (every attack in the audio) and *beats*
 * (the steady pulse the tracker infers from them) to see the difference — onsets are
 * dense and uneven, beats are sparse and regular. Press play and each marker lights
 * up the instant the playhead crosses it, so you watch the detection happen in time
 * with the sound.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useSonareDemoAudio } from '@/composables/useSonareDemoAudio';
import { peakEnvelope } from '@/demos/audio/processors';
import type { SonareDemoDef } from '@/demos/types';
import { prepareCanvas2D } from '../canvas';
import { useDemoChrome, useDemoParams } from '../composables';
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

/** Which detector to overlay. Falls back to onsets. */
const view = computed<string>(() => String(values.view ?? 'onset'));
const clipName = computed(() => (props.def.source.kind === 'clip' ? props.def.source.clip : ''));

/** Eyebrow reflects the detectors this demo actually offers (onset/beat/downbeat). */
const eyebrow = computed(() => {
  const opts = props.def.params?.find((p) => p.key === 'view')?.options ?? [];
  const labels = opts.map((o) => o.value.toUpperCase());
  return `DETECTOR · ${labels.join(' / ') || 'ONSET'}`;
});

// ---- presentation state ----------------------------------------------------
const markerCount = ref(0);
const bpm = ref(0);

const stateLabel = computed(() => {
  if (status.value === 'loading') return 'ANALYZING';
  if (status.value === 'error') return 'ERROR';
  if (isPlaying.value) return `▸ ${Math.round(progress.value * 100)}%`;
  if (status.value !== 'ready') return 'IDLE';
  if (view.value === 'beat') return bpm.value > 0 ? `≈ ${Math.round(bpm.value)} BPM` : 'BEATS';
  if (view.value === 'downbeat') return `${markerCount.value} BARS`;
  return `${markerCount.value} ONSETS`;
});

// ---- waveform + detector data ----------------------------------------------
const COLS = 540;
const peaks = new Float32Array(COLS); // 0..1 absolute peak per column
let markers: number[] = []; // detected times, seconds
let duration = 0;
let clip: { samples: Float32Array; sampleRate: number } | null = null;
const reveal = ref(0); // 0..1 waveform fade-in

type WasmModule = Awaited<ReturnType<typeof ensureWasm>>;

/** Run the selected detector and store the marker times + a tempo readout. */
function detect(wasm: WasmModule, samples: Float32Array, sr: number): void {
  let times: Float32Array;
  if (view.value === 'beat') times = wasm.detectBeats(samples, sr);
  else if (view.value === 'downbeat') times = wasm.detectDownbeats(samples, sr);
  else times = wasm.detectOnsets(samples, sr);
  markers = Array.from(times).filter((t) => t >= 0 && t <= duration);
  markerCount.value = markers.length;

  // Tempo from the detected beats themselves, so the readout matches the markers.
  if (view.value === 'beat' && markers.length >= 2) {
    const gaps: number[] = [];
    for (let i = 1; i < markers.length; i++) gaps.push(markers[i] - markers[i - 1]);
    gaps.sort((a, b) => a - b);
    const median = gaps[Math.floor(gaps.length / 2)];
    bpm.value = median > 0 ? 60 / median : 0;
  } else {
    bpm.value = 0;
  }
}

async function compute(): Promise<void> {
  try {
    if (status.value === 'idle') status.value = 'loading';
    const wasm = await ensureWasm();
    if (!clip) {
      clip = await loadClip(clipName.value);
      duration = clip.samples.length / clip.sampleRate;
      peakEnvelope(clip.samples, peaks);
    }
    detect(wasm, clip.samples, clip.sampleRate);
    status.value = 'ready';
    if (reveal.value < 1) startReveal();
    else paint();
  } catch (e) {
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

// Repaint every frame while playing so marker flashes track the playhead.
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
  else paint(); // settle to the resting overlay
});

/** Distinct colour families: violet onsets, teal beats, amber downbeats. */
function markerColor(): { core: string; glow: string } {
  if (view.value === 'downbeat') {
    return { core: '#fbbf24', glow: 'rgba(251, 191, 36, 0.9)' };
  }
  if (view.value === 'beat') {
    return { core: '#2dd4bf', glow: 'rgba(45, 212, 191, 0.9)' };
  }
  return { core: '#a78bfa', glow: 'rgba(167, 139, 250, 0.9)' };
}

function paint(): void {
  const frame = prepareCanvas2D(canvas.value);
  if (!frame) return;
  const { ctx, width: w, height: h } = frame;

  const padX = 14;
  const innerW = w - padX * 2;
  const mid = h / 2;
  const ampH = h * 0.4;
  const playT = isPlaying.value ? progress.value * duration : -1;
  const { core, glow } = markerColor();

  // Waveform (mirrored peaks). Passed portion brightens during playback.
  for (let c = 0; c < COLS; c++) {
    const x = padX + (c / (COLS - 1)) * innerW;
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

  // Detector markers. Each flashes as the playhead crosses it, then settles lit.
  for (const t of markers) {
    const x = padX + (t / duration) * innerW;
    let alpha = 0.5;
    let lw = 1.4;
    let blur = 0;
    if (playT >= 0) {
      if (t > playT) {
        alpha = 0.22; // not reached yet
      } else {
        const since = playT - t;
        const flash = Math.exp(-since / 0.16); // bright spike, fades ~160ms
        alpha = 0.55 + 0.45 * flash;
        lw = 1.4 + 2.4 * flash;
        blur = 10 * flash;
      }
    }
    ctx.globalAlpha = alpha * reveal.value;
    ctx.strokeStyle = core;
    ctx.lineWidth = lw;
    ctx.shadowColor = glow;
    ctx.shadowBlur = blur;
    ctx.beginPath();
    ctx.moveTo(x, mid - ampH * 1.15);
    ctx.lineTo(x, mid + ampH * 1.15);
    ctx.stroke();
    // Cap dots at the ends of the marker.
    if (blur > 0) {
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(x, mid - ampH * 1.15, 1.6 + 1.4 * (blur / 10), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

async function onPlay(): Promise<void> {
  if (!clip) await compute();
  if (clip) await play(props.def.id, clip);
}

// Coalesce rapid view changes into one analysis per frame.
let pending = 0;
function scheduleCompute(): void {
  if (pending) return;
  pending = requestAnimationFrame(() => {
    pending = 0;
    compute();
  });
}

watch(view, () => {
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
  if (revealRaf) cancelAnimationFrame(revealRaf);
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
    loading-label="ANALYZING…"
    :show-playhead="isPlaying"
    @toggle="onPlay"
  >
    <template #screen>
      <canvas ref="canvas" class="dt-canvas" />
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
.dt-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
</style>
