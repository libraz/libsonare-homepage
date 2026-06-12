<script setup lang="ts">
/**
 * `lane-mixer` archetype: the realtime engine's per-track lane mixer, offline.
 *
 * Three looping MIDI clips (lead / bass / drums) are scheduled with
 * `setMidiClips`, each routed to its own NativeSynth destination through a lane
 * declared by `setTrackLanes`. The reader's faders go through the per-track
 * strip setters and the mutes through `setSoloMute` — then the engine renders
 * one loop with `renderOffline`. Each band below is one lane's *audible*
 * contribution (rendered with every other lane muted), so fader and mute moves
 * change exactly the band they should. Pressing play auditions the master mix.
 */
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useSonareDemoAudio } from '@/composables/useSonareDemoAudio';
import { type DemoLocale, localized, type SonareDemoDef } from '@/demos/types';
import DemoControls from '../DemoControls.vue';
import DemoFrame from '../DemoFrame.vue';

const props = defineProps<{ def: SonareDemoDef; active: boolean }>();

const { locale } = useI18n();
const { ensureWasm, play, playingId, progress } = useSonareDemoAudio();

const loc = computed<DemoLocale>(() => (locale.value.startsWith('ja') ? 'ja' : 'en'));
const title = computed(() => localized(props.def.title, loc.value));
const caption = computed(() => localized(props.def.caption, loc.value));

const canvas = ref<HTMLCanvasElement | null>(null);
const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle');
const errorMsg = ref('');
const isPlaying = computed(() => playingId.value === props.def.id);

// ---- reader-adjustable parameters -----------------------------------------
type ParamValue = number | string | boolean;
const values = reactive<Record<string, ParamValue>>({});
for (const p of props.def.params ?? []) values[p.key] = p.default;

function onParams(next: Record<string, ParamValue>): void {
  Object.assign(values, next);
}

const faderDb = computed<number[]>(() => [
  Number(values.leadDb ?? 0),
  Number(values.bassDb ?? 0),
  Number(values.drumsDb ?? 0),
]);
const muted = computed<boolean[]>(() => [
  Boolean(values.muteLead),
  Boolean(values.muteBass),
  Boolean(values.muteDrums),
]);

// ---- presentation state ----------------------------------------------------
const tone = computed(() => {
  if (status.value === 'error') return 'error' as const;
  if (status.value === 'loading') return 'loading' as const;
  if (isPlaying.value) return 'playing' as const;
  if (status.value === 'ready') return 'ready' as const;
  return 'idle' as const;
});
const stateLabel = computed(() => {
  if (status.value === 'loading') return 'RENDERING';
  if (status.value === 'error') return 'ERROR';
  if (isPlaying.value) return `▸ ${Math.round(progress.value * 100)}%`;
  if (status.value === 'ready') return '3 LANES · 120 BPM';
  return 'IDLE';
});

// ---- engine session ---------------------------------------------------------
const SR = 44100;
const BPM = 120;
const BAR_PPQ = 4;
const BAR_FRAMES = Math.round((SR * BAR_PPQ * 60) / BPM);
const ENV_COLS = 160;
const LANES = ['LEAD', 'BASS', 'DRUMS'] as const;
const LANE_HUES = ['167, 139, 250', '34, 211, 238', '245, 158, 11'] as const; // violet / cyan / amber
const MASTER_HUE = '45, 212, 191'; // teal

// UMP MIDI 1.0 channel-voice words (group 0, channel 0).
const noteOn = (note: number, vel: number) =>
  ((0x2 << 28) | (0x9 << 20) | ((note & 0x7f) << 8) | (vel & 0x7f)) >>> 0;
const noteOff = (note: number) => ((0x2 << 28) | (0x8 << 20) | ((note & 0x7f) << 8)) >>> 0;

// The WASM `.d.ts` re-exports `RealtimeEngine` under an opaque alias, so the
// slice of its API used here is typed locally.
interface MidiEventLike {
  renderFrame: number;
  word0: number;
}
interface EngineLike {
  setTempoSegments(segments: Array<{ startPpq: number; bpm: number }>): void;
  setLoop(startPpq: number, endPpq: number, enabled: boolean): boolean;
  setTrackLanes(lanes: number[]): void;
  setSynthInstrument(patch: string | Record<string, unknown>, destinationId: number): void;
  setMidiClips(clips: Array<Record<string, unknown>>): void;
  setTrackStripJson(trackId: number, sceneJson: string): void;
  setSoloMute(laneIndex: number, solo: boolean, mute: boolean, renderFrame: number): void;
  renderOffline(channels: Float32Array[], blockSize?: number): Float32Array[];
  destroy(): void;
}

let engine: EngineLike | null = null;
/** In-flight boot, so concurrent compute() calls share one native engine. */
let enginePromise: Promise<EngineLike> | null = null;
/** Set on unmount; an engine that finishes booting afterwards is destroyed. */
let disposed = false;

/** One quarter note of the one-bar loop, in samples. */
const Q = BAR_FRAMES / 4;

function stepEvents(notes: Array<[beat: number, note: number, gate?: number]>): MidiEventLike[] {
  return notes
    .flatMap(([beat, note, gate = 0.45]) => [
      { renderFrame: Math.round(beat * Q), word0: noteOn(note, 100) },
      { renderFrame: Math.min(BAR_FRAMES - 1, Math.round((beat + gate) * Q)), word0: noteOff(note) },
    ])
    .sort((a, b) => a.renderFrame - b.renderFrame);
}

function midiClip(trackId: number, events: MidiEventLike[]): Record<string, unknown> {
  return {
    id: trackId,
    trackId,
    destinationId: trackId, // instrument output routes to the lane whose track id matches
    startSample: 0,
    startPpq: 0,
    lengthSamples: BAR_FRAMES,
    loop: true,
    loopLengthSamples: BAR_FRAMES,
    events,
  };
}

function ensureEngine(): Promise<EngineLike> {
  enginePromise ??= (async () => {
    const wasm = await ensureWasm();
    const Engine = (wasm as unknown as { RealtimeEngine: new (sr: number, block: number) => EngineLike })
      .RealtimeEngine;
    const e = new Engine(SR, 128);
    if (disposed) {
      e.destroy();
      throw new Error('demo unmounted during engine boot');
    }
    e.setTempoSegments([{ startPpq: 0, bpm: BPM }]);
    e.setLoop(0, BAR_PPQ, true);
    e.setTrackLanes([1, 2, 3]);
    e.setSynthInstrument('saw-lead', 1);
    e.setSynthInstrument('sub-bass', 2);
    e.setSynthInstrument('drum-kit', 3);
    e.setMidiClips([
      midiClip(1, stepEvents([[0, 72], [1, 76], [2, 79], [3, 76]])),
      midiClip(2, stepEvents([[0, 45, 0.9], [2, 43, 0.9]])),
      midiClip(3, stepEvents([[0, 36, 0.2], [1, 38, 0.2], [2, 36, 0.2], [2.5, 36, 0.2], [3, 38, 0.2]])),
    ]);
    engine = e;
    return e;
  })();
  return enginePromise;
}

// ---- render + analysis -----------------------------------------------------
const laneEnvs = [new Float32Array(ENV_COLS), new Float32Array(ENV_COLS), new Float32Array(ENV_COLS)];
const masterEnv = new Float32Array(ENV_COLS);
const dispLaneEnvs = laneEnvs.map((env) => new Float32Array(env.length));
const dispMasterEnv = new Float32Array(ENV_COLS);

let lastAudio: { samples: Float32Array; sampleRate: number } | null = null;

/** Reused stereo render target — zeroed before each pass instead of reallocated. */
const renderChannels = [new Float32Array(BAR_FRAMES), new Float32Array(BAR_FRAMES)];

function renderLoop(e: EngineLike): Float32Array {
  for (const ch of renderChannels) ch.fill(0);
  const out = e.renderOffline(renderChannels);
  // Downmix to mono — the shared demo audio path plays mono PCM.
  const mono = new Float32Array(BAR_FRAMES);
  for (const ch of out) for (let i = 0; i < BAR_FRAMES; i++) mono[i] += ch[i] / out.length;
  return mono;
}

function fillEnvelope(pcm: Float32Array, target: Float32Array, scale: number): void {
  const n = pcm.length;
  for (let c = 0; c < ENV_COLS; c++) {
    const a = Math.floor((c / ENV_COLS) * n);
    const b = Math.min(n, Math.floor(((c + 1) / ENV_COLS) * n));
    let m = 0;
    for (let i = a; i < b; i++) m = Math.max(m, Math.abs(pcm[i]));
    target[c] = Math.min(1, m * scale);
  }
}

async function compute(): Promise<void> {
  if (disposed) return;
  try {
    if (status.value === 'idle') status.value = 'loading';
    const e = await ensureEngine();
    if (disposed) return;

    // Apply the reader's faders + mutes — these are the engine's own controls.
    const ids = ['lead', 'bass', 'drums'];
    for (let t = 0; t < 3; t++) {
      e.setTrackStripJson(t + 1, JSON.stringify({ strips: [{ id: ids[t], gainDb: faderDb.value[t] }] }));
      e.setSoloMute(t, false, muted.value[t], -1);
    }
    const master = renderLoop(e);
    lastAudio = { samples: master, sampleRate: SR };

    // Per-lane contribution: render with every *other* lane muted. A lane the
    // reader muted stays muted, so its band goes flat — exactly what it plays.
    const lanePcm: Float32Array[] = [];
    for (let t = 0; t < 3; t++) {
      for (let o = 0; o < 3; o++) e.setSoloMute(o, false, o !== t || muted.value[o], -1);
      lanePcm.push(renderLoop(e));
    }
    for (let o = 0; o < 3; o++) e.setSoloMute(o, false, muted.value[o], -1);

    // One shared scale so the lane bands stay comparable to the master band.
    let peak = 1e-4;
    for (const s of master) peak = Math.max(peak, Math.abs(s));
    for (const pcm of lanePcm) for (const s of pcm) peak = Math.max(peak, Math.abs(s));
    const scale = 1 / peak;
    for (let t = 0; t < 3; t++) fillEnvelope(lanePcm[t], laneEnvs[t], scale);
    fillEnvelope(master, masterEnv, scale);

    status.value = 'ready';
    startMorph();
  } catch (e) {
    if (disposed) return; // teardown raced the boot; nothing to report
    status.value = 'error';
    errorMsg.value = e instanceof Error ? e.message : String(e);
  }
}

// ---- morph + paint loop ----------------------------------------------------
let rafId = 0;
const reducedMotion =
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function startMorph(): void {
  if (reducedMotion) {
    for (let t = 0; t < 3; t++) dispLaneEnvs[t].set(laneEnvs[t]);
    dispMasterEnv.set(masterEnv);
    paint();
    return;
  }
  if (rafId) return;
  const step = () => {
    let delta = 0;
    const morph = (disp: Float32Array, target: Float32Array) => {
      for (let c = 0; c < disp.length; c++) {
        const d = target[c] - disp[c];
        disp[c] += d * 0.26;
        delta = Math.max(delta, Math.abs(d));
      }
    };
    for (let t = 0; t < 3; t++) morph(dispLaneEnvs[t], laneEnvs[t]);
    morph(dispMasterEnv, masterEnv);
    paint();
    if (delta > 0.002) {
      rafId = requestAnimationFrame(step);
    } else {
      for (let t = 0; t < 3; t++) dispLaneEnvs[t].set(laneEnvs[t]);
      dispMasterEnv.set(masterEnv);
      paint();
      rafId = 0;
    }
  };
  rafId = requestAnimationFrame(step);
}

function stopMorph(): void {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
}

/** Draw the three lane bands plus the master band as filled peak envelopes. */
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
  const rows = 4;
  const gap = 7;
  const rowH = (h - 22 - gap * (rows - 1)) / rows;

  const band = (
    env: Float32Array,
    top: number,
    rgb: string,
    label: string,
    dim: boolean,
  ) => {
    const mid = top + rowH / 2 + 4;
    const amp = (rowH / 2 - 2) * 0.95;
    // Center line so a silent (muted) lane still reads as a lane.
    ctx.strokeStyle = `rgba(${rgb}, ${dim ? 0.12 : 0.2})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padX, mid + 0.5);
    ctx.lineTo(padX + innerW, mid + 0.5);
    ctx.stroke();

    const alpha = dim ? 0.16 : 0.78;
    const grad = ctx.createLinearGradient(0, mid - amp, 0, mid + amp);
    grad.addColorStop(0, `rgba(${rgb}, ${alpha})`);
    grad.addColorStop(0.5, `rgba(${rgb}, ${alpha * 0.4})`);
    grad.addColorStop(1, `rgba(${rgb}, ${alpha})`);
    ctx.beginPath();
    for (let c = 0; c < ENV_COLS; c++) {
      const x = padX + (c / (ENV_COLS - 1)) * innerW;
      ctx.lineTo(x, mid - env[c] * amp);
    }
    for (let c = ENV_COLS - 1; c >= 0; c--) {
      const x = padX + (c / (ENV_COLS - 1)) * innerW;
      ctx.lineTo(x, mid + env[c] * amp);
    }
    ctx.closePath();
    ctx.fillStyle = grad;
    if (!dim) {
      ctx.shadowColor = `rgba(${rgb}, 0.45)`;
      ctx.shadowBlur = 5;
    }
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.font = '9px "JetBrains Mono", ui-monospace, monospace';
    ctx.fillStyle = `rgba(${rgb}, ${dim ? 0.4 : 0.85})`;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText(label, padX, top - 1);
  };

  for (let t = 0; t < 3; t++) {
    const tag = muted.value[t] ? `${LANES[t]} · MUTED` : `${LANES[t]} ${faderDb.value[t]} dB`;
    band(dispLaneEnvs[t], 12 + t * (rowH + gap), LANE_HUES[t], tag, muted.value[t]);
  }
  band(dispMasterEnv, 12 + 3 * (rowH + gap), MASTER_HUE, 'MASTER', false);
}

// ---- audition --------------------------------------------------------------
async function onPlay(): Promise<void> {
  if (!lastAudio) await compute();
  if (lastAudio) await play(props.def.id, lastAudio);
}

// Coalesce rapid changes (slider drags) into one render per frame.
let pending = 0;
function scheduleCompute(): void {
  if (pending) return;
  pending = requestAnimationFrame(() => {
    pending = 0;
    compute();
  });
}

watch(
  () => [...faderDb.value, ...muted.value],
  () => {
    if (props.active) scheduleCompute();
  },
);

watch(
  () => props.active,
  (on) => {
    if (on && status.value === 'idle') compute();
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  disposed = true;
  stopMorph();
  if (pending) cancelAnimationFrame(pending);
  engine?.destroy();
  engine = null;
  enginePromise = null;
});
</script>

<template>
  <DemoFrame
    eyebrow="ENGINE · LANE MIXER"
    :title="title"
    :caption="caption"
    :state="stateLabel"
    :tone="tone"
    :playing="isPlaying"
    :progress="progress"
    :disabled="status === 'loading'"
    :error="status === 'error' ? errorMsg : null"
    loading-label="RENDERING…"
    :show-playhead="isPlaying"
    @toggle="onPlay"
  >
    <template #screen>
      <canvas ref="canvas" class="lm-canvas" />
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
.lm-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
</style>
