<script setup lang="ts">
/**
 * `instrument-audition` archetype: audition the data-free fallback for a chosen
 * variant, offline, and draw it as an amplitude envelope plus a zoomed scope.
 *
 * Two modes, selected by `def.config.mode`:
 * - `gm-program` — bounce one note through a GM program with NO SoundFont loaded,
 *   so the note plays the NativeSynth GM fallback voice for that program. Used to
 *   audition the General MIDI Sound-Effects family (programs 120-127), which the
 *   current build renders as one shared generic placeholder voice.
 * - `gs-efx` — render a short held chord through the GS-compatible SF2 player
 *   (again with no SoundFont, so the fallback synth sounds), pushing a raw GS
 *   insertion-effect (EFX) SysEx so the reader can A/B the dry tone against each
 *   effect. The effects are libsonare's own DSP, selected via the GS EFX
 *   type-numbering model.
 *
 * Every rendered buffer is peak-normalized so the A/B is about timbral character,
 * not loudness. Pressing play auditions the exact buffer on screen.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useSonareDemoAudio } from '@/composables/useSonareDemoAudio';
import { type SonareDemoDef } from '@/demos/types';
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

// ---- mode + reader-adjustable parameter -------------------------------------
const mode = computed<string>(() => String((props.def.config?.mode as string) ?? 'gm-program'));
const { values, updateParams } = useDemoParams(props.def);
// Both modes expose a single `variant` select. gm-program: a GM program number.
// gs-efx: a GS EFX type number (0 = dry / Thru).
const variant = computed<number>(() => Number(values.variant ?? 0));
const variantLabel = computed<string>(() => {
  const opt = (props.def.params?.[0]?.options ?? []).find((o) => Number(o.value) === variant.value);
  const text = opt?.label;
  if (!text) return String(variant.value);
  return (text[loc.value] ?? text.en ?? String(variant.value)).toUpperCase();
});

const eyebrow = computed(() => (mode.value === 'gs-efx' ? 'GS · EFX' : 'GM · FALLBACK'));
const stateLabel = computed(() => {
  if (status.value === 'loading') return 'RENDERING';
  if (status.value === 'error') return 'ERROR';
  if (isPlaying.value) return `▸ ${Math.round(progress.value * 100)}%`;
  if (status.value === 'ready') return variantLabel.value;
  return 'IDLE';
});

// ---- render targets --------------------------------------------------------
const SR = 44100;
const ENV_COLS = 180;
const SCOPE_N = 480;
const SCOPE_CYCLES = 5;
const SCOPE_HZ = 196; // nominal pitch used only to size the zoomed scope window

const dispEnv = new Float32Array(ENV_COLS);
const targetEnv = new Float32Array(ENV_COLS);
const dispScope = new Float32Array(SCOPE_N);
const targetScope = new Float32Array(SCOPE_N);

let lastAudio: { samples: Float32Array; sampleRate: number } | null = null;

type WasmModule = Awaited<ReturnType<typeof ensureWasm>>;

// The WASM `.d.ts` re-exports the classes under opaque aliases; the slices used
// here are typed locally.
interface MidiEvent {
  __brand?: 'midi';
}
interface ProjectLike {
  setSampleRate(sr: number): void;
  addMidiClip(startPpq: number, lengthPpq: number): { trackId: number; clipId: number };
  setMidiEvents(clipId: number, events: MidiEvent[]): void;
  bounceWithSf2Instrument(
    instrument: Record<string, unknown>,
    options: { numChannels: number; sampleRate: number; totalFrames: number },
  ): Float32Array;
  delete(): void;
}
interface ProjectCtor {
  new (): ProjectLike;
  midiProgram(ppq: number, group: number, channel: number, program: number): MidiEvent;
  midiNoteOn(
    ppq: number,
    group: number,
    channel: number,
    note: number,
    velocity: number,
  ): MidiEvent;
  midiNoteOff(
    ppq: number,
    group: number,
    channel: number,
    note: number,
    velocity?: number,
  ): MidiEvent;
}
interface EngineLike {
  setSf2Instrument(config: Record<string, unknown>, destinationId: number): void;
  pushMidiSysex(destinationId: number, data: Uint8Array, renderFrame?: number): void;
  pushMidiNoteOn(
    destinationId: number,
    group: number,
    channel: number,
    note: number,
    velocity: number,
    renderFrame?: number,
  ): void;
  pushMidiNoteOff(
    destinationId: number,
    group: number,
    channel: number,
    note: number,
    velocity?: number,
    renderFrame?: number,
  ): void;
  process(channels: Float32Array[]): Float32Array[];
  destroy(): void;
}
interface EngineCtor {
  new (sampleRate: number, maxBlockSize: number): EngineLike;
}

// ---- GS SysEx helpers (Roland DT1 frames) ----------------------------------
/** Wrap an address+data run in a Roland DT1 SysEx frame with its checksum. */
function dt1(addrData: number[]): Uint8Array {
  let sum = 0;
  for (const b of addrData) sum = (sum + b) & 0x7f;
  return Uint8Array.from([0xf0, 0x41, 0x10, 0x42, 0x12, ...addrData, (128 - sum) & 0x7f, 0xf7]);
}
/** Select the shared GS insertion-effect type (14-bit, MSB<<8|LSB) at 40 03 00. */
function efxTypeSysex(type: number): Uint8Array {
  return dt1([0x40, 0x03, 0x00, (type >> 8) & 0x7f, type & 0x7f]);
}
/** Route a part (channel) through the insertion effect via the 40 4x 22 switch. */
function efxPartOnSysex(channel: number): Uint8Array {
  const block = channel === 9 ? 0 : channel + 1;
  return dt1([0x40, 0x40 | block, 0x22, 1]);
}

// ---- renderers -------------------------------------------------------------
/** gm-program mode: bounce one note through a GM program, no SoundFont loaded. */
function renderGmProgram(wasm: WasmModule, program: number): Float32Array {
  const Project = (wasm as unknown as { Project: ProjectCtor }).Project;
  const project = new Project();
  try {
    project.setSampleRate(SR);
    const { clipId } = project.addMidiClip(0, 960);
    project.setMidiEvents(clipId, [
      Project.midiProgram(0, 0, 0, program),
      Project.midiNoteOn(0, 0, 0, 60, 112),
      Project.midiNoteOff(720, 0, 0, 60, 0),
    ]);
    return project.bounceWithSf2Instrument(
      {},
      { numChannels: 1, sampleRate: SR, totalFrames: Math.round(SR * 1.4) },
    );
  } finally {
    project.delete();
  }
}

/** gs-efx mode: render a held triad live, optionally through a GS EFX. */
function renderGsEfx(wasm: WasmModule, efxType: number): Float32Array {
  const Engine = (wasm as unknown as { RealtimeEngine: EngineCtor }).RealtimeEngine;
  const BLK = 128;
  const dest = 0;
  const chord = [52, 55, 59]; // a sustained triad on the default piano fallback
  const engine = new Engine(SR, BLK);
  try {
    engine.setSf2Instrument({}, dest);
    if (efxType > 0) {
      engine.pushMidiSysex(dest, efxTypeSysex(efxType));
      engine.pushMidiSysex(dest, efxPartOnSysex(0));
    }
    for (const n of chord) engine.pushMidiNoteOn(dest, 0, 0, n, 112);

    const total = Math.round(SR * 1.7);
    const releaseAt = Math.round(SR * 1.15);
    const out = new Float32Array(total);
    let w = 0;
    let released = false;
    while (w < total) {
      if (!released && w >= releaseAt) {
        for (const n of chord) engine.pushMidiNoteOff(dest, 0, 0, n, 0);
        released = true;
      }
      const rendered = engine.process([new Float32Array(BLK), new Float32Array(BLK)]);
      const l = rendered[0];
      const r = rendered[1] ?? rendered[0];
      const m = Math.min(BLK, total - w);
      for (let i = 0; i < m; i++) out[w + i] = (l[i] + r[i]) * 0.5;
      w += BLK;
    }
    return out;
  } finally {
    engine.destroy?.();
  }
}

/** Peak-normalize so the A/B compares character, not loudness. */
function normalize(pcm: Float32Array): Float32Array {
  let peak = 1e-6;
  for (let i = 0; i < pcm.length; i++) peak = Math.max(peak, Math.abs(pcm[i]));
  const scale = 0.9 / peak;
  for (let i = 0; i < pcm.length; i++) pcm[i] *= scale;
  return pcm;
}

function renderVariant(wasm: WasmModule): Float32Array {
  const pcm =
    mode.value === 'gs-efx'
      ? renderGsEfx(wasm, variant.value)
      : renderGmProgram(wasm, variant.value);
  return normalize(pcm);
}

// ---- envelope + scope (shared with the synth archetype) --------------------
function fillTargets(pcm: Float32Array): void {
  const n = pcm.length;
  let peak = 1e-6;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(pcm[i]));
  const scale = 1 / peak;
  for (let c = 0; c < ENV_COLS; c++) {
    const a = Math.floor((c / ENV_COLS) * n);
    const b = Math.min(n, Math.floor(((c + 1) / ENV_COLS) * n));
    let m = 0;
    for (let i = a; i < b; i++) m = Math.max(m, Math.abs(pcm[i]));
    targetEnv[c] = m * scale;
  }
  const period = SR / SCOPE_HZ;
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
    const pcm = renderVariant(wasm);
    lastAudio = { samples: pcm, sampleRate: SR };
    fillTargets(pcm);
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
    const pcm = renderVariant(wasm);
    lastAudio = { samples: pcm, sampleRate: SR };
  }
  await play(props.def.id, lastAudio);
}

let pending = 0;
function scheduleCompute(): void {
  if (pending) return;
  pending = requestAnimationFrame(() => {
    pending = 0;
    compute();
  });
}

watch(
  () => variant.value,
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
      <canvas ref="canvas" class="ia-canvas" />
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
.ia-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
</style>
