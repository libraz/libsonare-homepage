<script setup lang="ts">
/**
 * `lane-mixer` archetype: the realtime engine's per-track lane mixer, offline.
 *
 * Three looping MIDI clips (lead / bass / drums) are scheduled with
 * `setMidiClips`, each routed to its own NativeSynth destination through a lane
 * declared by `setTrackLanes`. The reader's faders go through the per-track
 * strip setters and the mutes through `setSoloMute` — then the engine renders
 * one loop with `renderOffline`, through the master strip's true-peak limiter.
 * Each band below is one lane's *audible* contribution (rendered with every
 * other lane muted), so fader and mute moves change exactly the band they
 * should. Pressing play auditions the master mix.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { peakEnvelope } from '@/demos/inline/audio/processors';
import { type I18nText, localized, type SonareDemoDef } from '@/demos/inline/types';
import { useSonareDemoAudio } from '@/demos/inline/useSonareDemoAudio';
import { prepareCanvas2D } from '@/utils/canvas';
import { useCanvasRedraw, useDemoChrome, useDemoParams } from '../composables';
import DemoControls from '../DemoControls.vue';
import DemoFrame from '../DemoFrame.vue';
import {
  applyLaneMixerControls,
  createLaneMixerEngine,
  createSharedBoot,
  LANE_MIXER_SAMPLE_RATE,
  type LaneMixerEngine,
  renderLaneMixerLoop,
} from './laneMixerSession';

const props = defineProps<{ def: SonareDemoDef; active: boolean }>();

const { ensureWasm, play, playingId, progress } = useSonareDemoAudio();

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
const stateLabel = computed(() => {
  if (status.value === 'loading') return 'RENDERING';
  if (status.value === 'error') return 'ERROR';
  if (isPlaying.value) return `▸ ${Math.round(progress.value * 100)}%`;
  if (status.value === 'ready') return '3 LANES · 120 BPM';
  return 'IDLE';
});

// ---- engine session ---------------------------------------------------------
const ENV_COLS = 160;
const LANES = ['LEAD', 'BASS', 'DRUMS'] as const;
const LANE_HUES = ['167, 139, 250', '34, 211, 238', '245, 158, 11'] as const; // violet / cyan / amber
const MASTER_HUE = '45, 212, 191'; // teal

// ---- lane-tag text ----------------------------------------------------
const TAG_MUTED: I18nText = { en: 'MUTED', ja: 'ミュート' };
const tagMutedText = computed<string>(() => localized(TAG_MUTED, loc.value));

let engine: LaneMixerEngine | null = null;
/** Set on unmount; an engine that finishes booting afterwards is destroyed. */
let disposed = false;

/** One native engine shared by concurrent compute() calls; a failed boot is retried. */
const boot = createSharedBoot(async () => {
  const wasm = await ensureWasm();
  const e = createLaneMixerEngine(wasm as unknown as Parameters<typeof createLaneMixerEngine>[0]);
  if (disposed) {
    e.destroy();
    throw new Error('demo unmounted during engine boot');
  }
  engine = e;
  return e;
});

// ---- render + analysis -----------------------------------------------------
const laneEnvs = [
  new Float32Array(ENV_COLS),
  new Float32Array(ENV_COLS),
  new Float32Array(ENV_COLS),
];
const masterEnv = new Float32Array(ENV_COLS);
const dispLaneEnvs = laneEnvs.map((env) => new Float32Array(env.length));
const dispMasterEnv = new Float32Array(ENV_COLS);

let lastAudio: { samples: Float32Array; sampleRate: number } | null = null;

async function compute(): Promise<void> {
  if (disposed) return;
  try {
    if (status.value === 'idle') status.value = 'loading';
    const e = await boot.ensure();
    if (disposed) return;

    applyLaneMixerControls(e, faderDb.value, muted.value);
    const master = renderLaneMixerLoop(e);
    lastAudio = { samples: master, sampleRate: LANE_MIXER_SAMPLE_RATE };

    // Per-lane contribution: render with every *other* lane muted. A lane the
    // reader muted stays muted, so its band goes flat — exactly what it plays.
    const lanePcm: Float32Array[] = [];
    for (let t = 0; t < 3; t++) {
      for (let o = 0; o < 3; o++) e.setSoloMute(o, false, o !== t || muted.value[o], -1);
      lanePcm.push(renderLaneMixerLoop(e));
    }
    for (let o = 0; o < 3; o++) e.setSoloMute(o, false, muted.value[o], -1);

    // One shared scale so the lane bands stay comparable to the master band.
    let peak = 1e-4;
    for (const s of master) peak = Math.max(peak, Math.abs(s));
    for (const pcm of lanePcm) for (const s of pcm) peak = Math.max(peak, Math.abs(s));
    const scale = 1 / peak;
    for (let t = 0; t < 3; t++) peakEnvelope(lanePcm[t], laneEnvs[t], scale);
    peakEnvelope(master, masterEnv, scale);

    status.value = 'ready';
    startMorph();
  } catch (e) {
    if (disposed) return; // teardown raced the boot; nothing to report
    fail(e);
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
  const frame = prepareCanvas2D(canvas.value);
  if (!frame) return;
  const { ctx, width: w, height: h } = frame;

  const padX = 16;
  const innerW = w - padX * 2;
  const rows = 4;
  const gap = 7;
  const rowH = (h - 22 - gap * (rows - 1)) / rows;

  const band = (env: Float32Array, top: number, rgb: string, label: string, dim: boolean) => {
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
    const tag = muted.value[t]
      ? `${LANES[t]} · ${tagMutedText.value}`
      : `${LANES[t]} ${faderDb.value[t]} dB`;
    band(dispLaneEnvs[t], 12 + t * (rowH + gap), LANE_HUES[t], tag, muted.value[t]);
  }
  band(dispMasterEnv, 12 + 3 * (rowH + gap), MASTER_HUE, 'MASTER', false);
}

/** Re-paint when the screen is first laid out and on every later resize. */
useCanvasRedraw(canvas, paint);

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
    if (status.value !== 'idle') scheduleCompute();
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
  boot.reset();
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
        :disabled="isPlaying || status === 'loading'"
        :model-value="values"
        :params="def.params ?? []"
        :locale="loc"
        @update:model-value="updateParams"
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
