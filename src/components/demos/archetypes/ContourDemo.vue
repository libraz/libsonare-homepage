<script setup lang="ts">
/**
 * `contour` archetype: track the pitch of a monophonic clip and draw the melody as an
 * f0 contour over time.
 *
 * The clip is a single melodic line; `pitchYin` estimates the fundamental frequency at
 * each frame. We map those frequencies to musical pitch (a log axis in semitones) and
 * draw the contour as a line, breaking it wherever the tracker reports silence. Toggle
 * *Smooth* to see the raw estimate — which jumps the odd octave at note attacks — settle
 * into a clean line once a median filter and octave correction are applied. Press play
 * and a dot rides the contour at the pitch you hear.
 */
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useSonareDemoAudio } from '@/composables/useSonareDemoAudio';
import { type DemoLocale, localized, type SonareDemoDef } from '@/demos/types';
import DemoControls from '../DemoControls.vue';
import DemoFrame from '../DemoFrame.vue';

const props = defineProps<{ def: SonareDemoDef; active: boolean }>();

const { locale } = useI18n();
const { ensureWasm, loadClip, play, playingId, progress } = useSonareDemoAudio();

const loc = computed<DemoLocale>(() => locale.value);
const title = computed(() => localized(props.def.title, loc.value));
const caption = computed(() => localized(props.def.caption, loc.value));

const canvas = ref<HTMLCanvasElement | null>(null);
const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle');
const errorMsg = ref('');
const isPlaying = computed(() => playingId.value === props.def.id);

// ---- reader-adjustable parameters ------------------------------------------
type ParamValue = number | string | boolean;
const values = reactive<Record<string, ParamValue>>({});
for (const p of props.def.params ?? []) values[p.key] = p.default;

function onParams(next: Record<string, ParamValue>): void {
  Object.assign(values, next);
}

/** Whether to clean the raw pitch track (median filter + octave correction). */
const smooth = computed<boolean>(() => values.smooth !== false);
const clipName = computed(() => (props.def.source.kind === 'clip' ? props.def.source.clip : ''));

// ---- presentation state ----------------------------------------------------
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
function noteName(midi: number): string {
  const m = Math.round(midi);
  return `${NOTE_NAMES[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`;
}
const medianNote = ref('');
const currentNote = ref('');

const tone = computed(() => {
  if (status.value === 'error') return 'error' as const;
  if (status.value === 'loading') return 'loading' as const;
  if (isPlaying.value) return 'playing' as const;
  if (status.value === 'ready') return 'ready' as const;
  return 'idle' as const;
});
const stateLabel = computed(() => {
  if (status.value === 'loading') return 'TRACKING';
  if (status.value === 'error') return 'ERROR';
  if (isPlaying.value) return currentNote.value ? `♪ ${currentNote.value}` : '▸';
  if (status.value !== 'ready') return 'IDLE';
  return medianNote.value ? `MEDIAN ${medianNote.value}` : 'PITCH';
});

// ---- pitch data ------------------------------------------------------------
const HOP = 512;
const FFT = 2048;
let times: Float32Array = new Float32Array(0); // frame centre times, seconds
let midi: Float32Array = new Float32Array(0); // displayed pitch per frame (NaN = unvoiced)
let loMidi = 48;
let hiMidi = 84;
let duration = 0;
let clip: { samples: Float32Array; sampleRate: number } | null = null;
const reveal = ref(0); // 0..1 contour draw-in

type WasmModule = Awaited<ReturnType<typeof ensureWasm>>;

/** Convert one Hz reading to a fractional MIDI note (NaN when unvoiced). */
function hzToMidi(hz: number): number {
  return hz > 0 ? 69 + 12 * Math.log2(hz / 440) : Number.NaN;
}

/**
 * Clean the raw pitch track: snap each frame to within a tritone of its predecessor
 * (kills octave jumps at attacks), then apply a 5-wide median filter over voiced frames.
 */
function cleanTrack(raw: Float32Array): Float32Array {
  const out = Float32Array.from(raw);
  let prev = Number.NaN;
  for (let i = 0; i < out.length; i++) {
    if (Number.isNaN(out[i])) continue;
    if (!Number.isNaN(prev)) {
      while (out[i] - prev > 6) out[i] -= 12;
      while (prev - out[i] > 6) out[i] += 12;
    }
    prev = out[i];
  }
  const med = Float32Array.from(out);
  for (let i = 0; i < out.length; i++) {
    if (Number.isNaN(out[i])) continue;
    const win: number[] = [];
    for (let k = -2; k <= 2; k++) {
      const j = i + k;
      if (j >= 0 && j < out.length && !Number.isNaN(out[j])) win.push(out[j]);
    }
    win.sort((a, b) => a - b);
    med[i] = win[Math.floor(win.length / 2)];
  }
  return med;
}

/** Run the pitch tracker and prepare the displayed contour + axis range. */
function track(wasm: WasmModule, samples: Float32Array, sr: number): void {
  const r = wasm.pitchYin(samples, sr, FFT, HOP);
  const f0: Float32Array = r.f0;
  const vp: Float32Array = r.voicedProb;
  const n = f0.length;
  times = new Float32Array(n);
  const raw = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    times[i] = (i * HOP) / sr;
    const voiced = f0[i] > 0 && (!vp || vp[i] > 0.3);
    raw[i] = voiced ? hzToMidi(f0[i]) : Number.NaN;
  }
  midi = smooth.value ? cleanTrack(raw) : raw;

  // Axis range from the 5th..95th percentile of voiced pitch, padded ±2 semitones,
  // so a stray octave error does not flatten the whole contour.
  const voicedSorted = Array.from(midi)
    .filter((m) => !Number.isNaN(m))
    .sort((a, b) => a - b);
  if (voicedSorted.length > 0) {
    const lo = voicedSorted[Math.floor(voicedSorted.length * 0.05)];
    const hi = voicedSorted[Math.floor(voicedSorted.length * 0.95)];
    loMidi = Math.floor(lo - 2);
    hiMidi = Math.ceil(hi + 2);
    if (hiMidi - loMidi < 7) hiMidi = loMidi + 7; // keep at least a fifth of headroom
    medianNote.value = noteName(voicedSorted[Math.floor(voicedSorted.length / 2)]);
  } else {
    medianNote.value = '';
  }
}

async function compute(): Promise<void> {
  try {
    if (status.value === 'idle') status.value = 'loading';
    const wasm = await ensureWasm();
    if (!clip) {
      clip = await loadClip(clipName.value);
      duration = clip.samples.length / clip.sampleRate;
    }
    track(wasm, clip.samples, clip.sampleRate);
    status.value = 'ready';
    if (reveal.value < 1) startReveal();
    else paint();
  } catch (e) {
    status.value = 'error';
    errorMsg.value = e instanceof Error ? e.message : String(e);
  }
}

// ---- animation -------------------------------------------------------------
let revealRaf = 0;
function startReveal(): void {
  if (revealRaf) return;
  const step = () => {
    reveal.value = Math.min(1, reveal.value + 0.05);
    paint();
    revealRaf = reveal.value < 1 ? requestAnimationFrame(step) : 0;
  };
  revealRaf = requestAnimationFrame(step);
}

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
    currentNote.value = '';
    paint();
  }
});

function midiToY(m: number, h: number): number {
  const pad = 14;
  const f = (m - loMidi) / (hiMidi - loMidi || 1);
  return h - pad - f * (h - pad * 2);
}

function paint(): void {
  const el = canvas.value;
  if (!el) return;
  const w = el.clientWidth;
  const h = el.clientHeight;
  if (w === 0 || h === 0) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (el.width !== Math.round(w * dpr) || el.height !== Math.round(h * dpr)) {
    el.width = Math.round(w * dpr);
    el.height = Math.round(h * dpr);
  }
  const ctx = el.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const padX = 16;
  const innerW = w - padX * 2;
  const playT = isPlaying.value ? progress.value * duration : -1;
  const xAt = (t: number) => padX + (t / (duration || 1)) * innerW;

  // Faint octave guide lines (each C within range).
  ctx.lineWidth = 1;
  for (let m = Math.ceil(loMidi / 12) * 12; m <= hiMidi; m += 12) {
    const y = midiToY(m, h);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
    ctx.beginPath();
    ctx.moveTo(padX, y);
    ctx.lineTo(w - padX, y);
    ctx.stroke();
  }

  // The contour. Drawn in two passes: dim for the whole line, bright for the part the
  // playhead has already swept, so playback visibly fills the melody in.
  const drawPass = (bright: boolean) => {
    ctx.strokeStyle = bright ? 'rgba(94, 234, 212, 0.95)' : 'rgba(148, 163, 184, 0.5)';
    ctx.lineWidth = bright ? 2.4 : 1.6;
    ctx.shadowColor = bright ? 'rgba(45, 212, 191, 0.8)' : 'transparent';
    ctx.shadowBlur = bright ? 8 : 0;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    let pen = false;
    ctx.beginPath();
    const cut = padX + innerW * reveal.value; // contour draws in left→right
    for (let i = 0; i < midi.length; i++) {
      if (Number.isNaN(midi[i])) {
        pen = false;
        continue;
      }
      const x = xAt(times[i]);
      if (x > cut) break;
      if (bright && (playT < 0 || times[i] > playT)) {
        pen = false;
        continue;
      }
      const y = midiToY(midi[i], h);
      if (!pen) {
        ctx.moveTo(x, y);
        pen = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  };
  drawPass(false);
  if (playT >= 0) drawPass(true);
  ctx.shadowBlur = 0;

  // Playhead dot riding the contour at the current pitch.
  if (playT >= 0 && midi.length > 0) {
    let idx = Math.round((playT / (duration || 1)) * (midi.length - 1));
    idx = Math.max(0, Math.min(midi.length - 1, idx));
    // Nudge to the nearest voiced frame for a stable dot.
    let probe = idx;
    for (let k = 0; k < 4 && Number.isNaN(midi[probe]); k++) probe = Math.max(0, probe - 1);
    if (!Number.isNaN(midi[probe])) {
      const x = xAt(playT);
      const y = midiToY(midi[probe], h);
      currentNote.value = noteName(midi[probe]);
      ctx.fillStyle = '#5eead4';
      ctx.shadowColor = 'rgba(45, 212, 191, 0.95)';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(x, y, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    } else {
      currentNote.value = '';
    }
  }
}

async function onPlay(): Promise<void> {
  if (!clip) await compute();
  if (clip) await play(props.def.id, clip);
}

let pending = 0;
function scheduleCompute(): void {
  if (pending) return;
  pending = requestAnimationFrame(() => {
    pending = 0;
    compute();
  });
}

watch(smooth, () => {
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
    eyebrow="PITCH · MELODY CONTOUR"
    :title="title"
    :caption="caption"
    :state="stateLabel"
    :tone="tone"
    :playing="isPlaying"
    :progress="progress"
    :disabled="status === 'loading'"
    :error="status === 'error' ? errorMsg : null"
    loading-label="TRACKING…"
    :show-playhead="isPlaying"
    axis-freq="NOTE"
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
        @update:model-value="onParams"
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
