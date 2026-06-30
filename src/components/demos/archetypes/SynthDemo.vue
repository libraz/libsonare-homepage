<script setup lang="ts">
/**
 * `synth` archetype: the built-in synthesizer renders one note, offline.
 *
 * A tiny one-note MIDI project is bounced to mono PCM through the engine's
 * subtractive synth, then drawn as a DAW-style peak waveform. The outline *is*
 * the note's amplitude envelope, so the effect of the patch is immediate: raise
 * the attack and the note fades in more slowly, lower the cutoff and the inner
 * texture darkens, change the waveform and the timbre changes. An optional LFO
 * routed to amplitude makes the envelope ripple (tremolo). Pressing play auditions
 * the exact buffer on screen — no clip, no external asset.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useSonareDemoAudio } from '@/composables/useSonareDemoAudio';
import { type GeneratedSignal, type SonareDemoDef } from '@/demos/types';
import { prepareCanvas2D } from '../canvas';
import { useDemoChrome, useDemoParams } from '../composables';
import DemoControls from '../DemoControls.vue';
import DemoFrame from '../DemoFrame.vue';

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

const waveform = computed<GeneratedSignal>(() => (values.waveform as GeneratedSignal) ?? 'saw');
const cutoff = computed<number>(() => Number(values.cutoff ?? 2200));
const attack = computed<number>(() => Number(values.attack ?? 8));
// Optional patch controls. Each falls back to the value the original `synth-note`
// patch hardcoded, so a demo that omits the param renders exactly as before. The
// engine reads `0` / `'default'` as "keep the base value", so the range minimums
// below stay strictly positive and the filter selector passes real model names.
const decay = computed<number>(() => Number(values.decay ?? 140));
const sustain = computed<number>(() => Number(values.sustain ?? 0.75));
const release = computed<number>(() => Number(values.release ?? 280));
const resonance = computed<number>(() => Number(values.resonance ?? 0.9));
const filterModel = computed<string>(() => String(values.filterModel ?? 'svf'));
// Optional tremolo: an LFO routed to amplitude. Depth 0 (the default) adds no
// routing, so demos that omit these params render exactly as before.
const lfoRate = computed<number>(() => Number(values.lfoRate ?? 0));
const lfoDepth = computed<number>(() => Number(values.lfoDepth ?? 0));
// Optional preset audition: when set, the patch is built from the named preset so
// each engine's true character comes through, ignoring the subtractive-only sliders.
const preset = computed<string>(() => String(values.preset ?? ''));
const eyebrow = computed(() => (preset.value ? 'SYNTH · PRESET' : 'SYNTH · SUBTRACTIVE'));

// ---- presentation state ----------------------------------------------------
const stateLabel = computed(() => {
  if (status.value === 'loading') return 'RENDERING';
  if (status.value === 'error') return 'ERROR';
  if (isPlaying.value) return `▸ ${Math.round(progress.value * 100)}%`;
  if (status.value === 'ready')
    return preset.value ? preset.value.toUpperCase() : `${cutoff.value} Hz`;
  return 'IDLE';
});

// ---- render + analysis -----------------------------------------------------
const SR = 44100;
const NOTE = 57; // MIDI A3 ≈ 220 Hz — same register as the signal demo
const NOTE_HZ = 220;
const ENV_COLS = 180; // amplitude-envelope columns (window > one period → smooth)
const SCOPE_N = 480; // zoomed-scope points
const SCOPE_CYCLES = 5; // cycles shown in the zoomed scope

// Top panel: amplitude envelope (shows attack/release). Bottom panel: a zoomed
// scope of the sustain (shows oscillator shape + how the cutoff rounds it off).
const dispEnv = new Float32Array(ENV_COLS);
const targetEnv = new Float32Array(ENV_COLS);
const dispScope = new Float32Array(SCOPE_N);
const targetScope = new Float32Array(SCOPE_N);

let lastAudio: { samples: Float32Array; sampleRate: number } | null = null;

type WasmModule = Awaited<ReturnType<typeof ensureWasm>>;

// The WASM `.d.ts` re-exports `Project` under an opaque alias, so the slice of
// its API used for offline render is typed locally.
interface ProjectMidiEvent {
  __brand?: 'midi';
}
interface ProjectLike {
  setSampleRate(sr: number): void;
  addMidiClip(startPpq: number, lengthPpq: number): { trackId: number; clipId: number };
  setMidiEvents(clipId: number, events: ProjectMidiEvent[]): void;
  bounceWithSynthInstrument(
    instrument: Record<string, unknown>,
    options: { numChannels: number; sampleRate: number; totalFrames: number },
  ): Float32Array;
  delete(): void;
}
interface ProjectCtor {
  new (): ProjectLike;
  midiNoteOn(
    ppq: number,
    group: number,
    channel: number,
    note: number,
    velocity: number,
  ): ProjectMidiEvent;
  midiNoteOff(
    ppq: number,
    group: number,
    channel: number,
    note: number,
    velocity?: number,
  ): ProjectMidiEvent;
}

/** Bounce one note through the built-in subtractive synth to mono PCM. */
function renderNote(wasm: WasmModule): Float32Array {
  const Project = (wasm as unknown as { Project: ProjectCtor }).Project;
  const project = new Project();
  try {
    project.setSampleRate(SR);
    const { clipId } = project.addMidiClip(0, 480);
    project.setMidiEvents(clipId, [
      Project.midiNoteOn(0, 0, 0, NOTE, 100),
      Project.midiNoteOff(480, 0, 0, NOTE, 0),
    ]);
    // Preset mode: take the named preset's full patch verbatim (just trim the gain)
    // so each engine's real timbre is auditioned, not a subtractive override of it.
    if (preset.value) {
      const presetPatch = (
        wasm as unknown as { synthPresetPatch: (name: string) => Record<string, unknown> }
      ).synthPresetPatch(preset.value);
      return project.bounceWithSynthInstrument(
        { ...presetPatch, gain: 0.5 },
        { numChannels: 1, sampleRate: SR, totalFrames: Math.round(SR * 1.3) },
      );
    }
    const patch: Record<string, unknown> = {
      engineMode: 'subtractive',
      waveform: waveform.value,
      filterModel: filterModel.value,
      cutoffHz: cutoff.value,
      resonanceQ: resonance.value,
      ampAttackMs: attack.value,
      ampDecayMs: decay.value,
      ampSustain: sustain.value,
      ampReleaseMs: release.value,
      gain: 0.5,
    };
    // Route LFO 1 to amplitude for tremolo. A non-empty mod matrix replaces the
    // base preset's, which is what we want — one clean, visible routing.
    if (lfoDepth.value > 0) {
      patch.lfoRateHz = lfoRate.value;
      patch.modRoutings = [{ source: 'lfo1', destination: 'amp-gain', depth: lfoDepth.value }];
    }
    return project.bounceWithSynthInstrument(patch, {
      numChannels: 1,
      sampleRate: SR,
      totalFrames: Math.round(SR * 1.3),
    });
  } finally {
    project.delete();
  }
}

/** Derive the amplitude envelope and a zoomed sustain scope from the PCM. */
function fillTargets(pcm: Float32Array): void {
  const n = pcm.length;
  let peak = 1e-6;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(pcm[i]));
  const scale = 1 / peak;

  // Envelope: peak magnitude per column (window spans >1 period → no moiré).
  for (let c = 0; c < ENV_COLS; c++) {
    const a = Math.floor((c / ENV_COLS) * n);
    const b = Math.min(n, Math.floor(((c + 1) / ENV_COLS) * n));
    let m = 0;
    for (let i = a; i < b; i++) m = Math.max(m, Math.abs(pcm[i]));
    targetEnv[c] = m * scale;
  }

  // Scope: a few cycles from the sustain region, normalized locally so the
  // oscillator shape fills the panel regardless of the cutoff's level cut.
  const period = SR / NOTE_HZ;
  const span = Math.min(n - 1, Math.round(period * SCOPE_CYCLES));
  const start = Math.min(n - span - 1, Math.floor(n * 0.42));
  let lp = 1e-6;
  for (let i = start; i < start + span; i++) lp = Math.max(lp, Math.abs(pcm[i]));
  const ls = 1 / lp;
  for (let i = 0; i < SCOPE_N; i++) {
    const idx = start + Math.floor((i / (SCOPE_N - 1)) * span);
    targetScope[i] = Math.max(-1, Math.min(1, pcm[idx] * ls));
  }
}

async function compute(): Promise<void> {
  try {
    if (status.value === 'idle') status.value = 'loading';
    const wasm = await ensureWasm();
    const pcm = renderNote(wasm);
    lastAudio = { samples: pcm, sampleRate: SR };
    fillTargets(pcm);
    status.value = 'ready';
    startMorph();
  } catch (e) {
    fail(e);
  }
}

// ---- morph + paint loop ----------------------------------------------------
let rafId = 0;

function startMorph(): void {
  if (rafId) return;
  const step = () => {
    let delta = 0;
    for (let c = 0; c < ENV_COLS; c++) {
      const d = targetEnv[c] - dispEnv[c];
      dispEnv[c] += d * 0.24;
      delta = Math.max(delta, Math.abs(d));
    }
    for (let i = 0; i < SCOPE_N; i++) {
      const d = targetScope[i] - dispScope[i];
      dispScope[i] += d * 0.24;
      delta = Math.max(delta, Math.abs(d));
    }
    paint();
    if (delta > 0.002) {
      rafId = requestAnimationFrame(step);
    } else {
      dispEnv.set(targetEnv);
      dispScope.set(targetScope);
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

/** Draw the rendered note as a filled peak waveform (its amplitude envelope). */
function paint(): void {
  const frame = prepareCanvas2D(canvas.value);
  if (!frame) return;
  const { ctx, width: w, height: h } = frame;

  const padX = 16;
  const innerW = w - padX * 2;
  const envTop = 14;
  const envBot = h * 0.5;
  const envMid = (envTop + envBot) / 2;
  const envAmp = ((envBot - envTop) / 2) * 0.92;
  const scopeTop = h * 0.57;
  const scopeBot = h - 16;
  const scopeMid = (scopeTop + scopeBot) / 2;
  const scopeAmp = ((scopeBot - scopeTop) / 2) * 0.9;

  // --- top: amplitude envelope (symmetric fill) ---
  const grad = ctx.createLinearGradient(0, envTop, 0, envBot);
  grad.addColorStop(0, 'rgba(45, 212, 191, 0.8)');
  grad.addColorStop(0.5, 'rgba(45, 212, 191, 0.3)');
  grad.addColorStop(1, 'rgba(45, 212, 191, 0.8)');
  ctx.beginPath();
  for (let c = 0; c < ENV_COLS; c++) {
    const x = padX + (c / (ENV_COLS - 1)) * innerW;
    ctx.lineTo(x, envMid - dispEnv[c] * envAmp);
  }
  for (let c = ENV_COLS - 1; c >= 0; c--) {
    const x = padX + (c / (ENV_COLS - 1)) * innerW;
    ctx.lineTo(x, envMid + dispEnv[c] * envAmp);
  }
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.shadowColor = 'rgba(45, 212, 191, 0.5)';
  ctx.shadowBlur = 6;
  ctx.fill();
  ctx.shadowBlur = 0;

  // --- bottom: zoomed scope of the sustain (oscillator shape) ---
  ctx.strokeStyle = 'rgba(186, 230, 224, 0.16)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padX, scopeMid + 0.5);
  ctx.lineTo(padX + innerW, scopeMid + 0.5);
  ctx.stroke();

  ctx.strokeStyle = '#2dd4bf';
  ctx.lineWidth = 1.8;
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(45, 212, 191, 0.6)';
  ctx.shadowBlur = 6;
  ctx.beginPath();
  for (let i = 0; i < SCOPE_N; i++) {
    const x = padX + (i / (SCOPE_N - 1)) * innerW;
    const y = scopeMid - dispScope[i] * scopeAmp;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Labels.
  ctx.font = '9px "JetBrains Mono", ui-monospace, monospace';
  ctx.fillStyle = 'rgba(186, 230, 224, 0.5)';
  ctx.textBaseline = 'top';
  ctx.fillText('ENVELOPE', padX, envTop - 2);
  ctx.fillText('WAVE ×5', padX, scopeTop - 2);
  ctx.textAlign = 'right';
  ctx.fillText('TIME →', padX + innerW, envBot - 11);
  ctx.textAlign = 'left';
}

// ---- audition --------------------------------------------------------------
async function onPlay(): Promise<void> {
  if (!lastAudio) {
    const wasm = await ensureWasm();
    const pcm = renderNote(wasm);
    lastAudio = { samples: pcm, sampleRate: SR };
  }
  await play(props.def.id, lastAudio);
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
  () => [
    waveform.value,
    cutoff.value,
    attack.value,
    decay.value,
    sustain.value,
    release.value,
    resonance.value,
    filterModel.value,
    lfoRate.value,
    lfoDepth.value,
    preset.value,
  ],
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
  stopMorph();
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
    :show-playhead="isPlaying"
    @toggle="onPlay"
  >
    <template #screen>
      <canvas ref="canvas" class="sy-canvas" />
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
.sy-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
</style>
