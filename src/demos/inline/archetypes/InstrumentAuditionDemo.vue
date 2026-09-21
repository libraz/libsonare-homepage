<script setup lang="ts">
/**
 * `instrument-audition` archetype: audition the data-free fallback for a chosen
 * variant, offline, and draw it as an amplitude envelope plus a zoomed scope.
 *
 * Four modes, selected by `def.config.mode`:
 * - `gm-program` — bounce one note through a GM program with NO SoundFont loaded,
 *   so the note plays the NativeSynth GM fallback voice for that program. Used to
 *   audition the General MIDI Sound-Effects family (programs 120-127), which the
 *   current build renders as one shared generic placeholder voice.
 * - `gs-variation` — bounce one note through a GS variation of the capital tone
 *   `def.config.program`. The variant is the Bank Select MSB (CC#0); the LSB
 *   (CC#32) is left at 0 because in GS it selects the tone map, not the
 *   variation. A variation the fallback does not voice apart sounds its capital.
 * - `gs-drum-kit` — bounce a fixed one-bar drum pattern on MIDI channel 10, with
 *   the variant sent as the rhythm part's Program Change to select a GS drum kit.
 *   Kits the fallback leaves unvoiced (SFX, program 56) play the Standard kit.
 * - `gs-efx` — bounce a short held chord through the GS-compatible SF2 player
 *   (again with no SoundFont, so the fallback synth sounds), with a raw GS
 *   insertion-effect (EFX) SysEx selecting the effect so the reader can A/B the
 *   dry tone against each one. The effects are libsonare's own DSP, selected via
 *   the GS EFX type-numbering model.
 *
 * All four bounce offline. EFX state is reachable only through SysEx, and a clip
 * built with `setMidiEvents` cannot hold any — the payloads sit beside the event
 * list behind a handle `ProjectMidiEvent` does not carry. `importSmf` is the way
 * in: SysEx that arrives with the file survives, and the bounce realizes it. So
 * `gs-efx` assembles a one-track SMF instead of an event list, and every mode
 * shares one render path.
 *
 * Every rendered buffer is peak-normalized so the A/B is about timbral character,
 * not loudness. Pressing play auditions the exact buffer on screen.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { type SonareDemoDef } from '@/demos/inline/types';
import { useSonareDemoAudio } from '@/demos/inline/useSonareDemoAudio';
import { prepareCanvas2D } from '@/utils/canvas';
import { useCanvasRedraw, useDemoChrome, useDemoParams } from '../composables';
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
// gs-variation only: the capital tone (GM program) the variation hangs under.
const program = computed<number>(() => Number(props.def.config?.program ?? 0));
const { values, updateParams } = useDemoParams(props.def);
// Every mode exposes a single `variant` select. gm-program: a GM program number.
// gs-variation: a Bank Select MSB (0 = capital tone). gs-drum-kit: the rhythm
// part's program number. gs-efx: a GS EFX type number (0 = dry / Thru).
const variant = computed<number>(() => Number(values.variant ?? 0));
const variantLabel = computed<string>(() => {
  const opt = (props.def.params?.[0]?.options ?? []).find((o) => Number(o.value) === variant.value);
  const text = opt?.label;
  if (!text) return String(variant.value);
  return (text[loc.value] ?? text.en ?? String(variant.value)).toUpperCase();
});

const EYEBROWS: Record<string, string> = {
  'gm-program': 'GM · FALLBACK',
  'gs-variation': 'GS · VARIATION',
  'gs-drum-kit': 'GS · DRUM KIT',
  'gs-efx': 'GS · EFX',
};
const eyebrow = computed(() => EYEBROWS[mode.value] ?? EYEBROWS['gm-program']);
const stateLabel = computed(() => {
  if (status.value === 'loading') return 'RENDERING';
  if (status.value === 'error') return 'ERROR';
  if (isPlaying.value) return `▸ ${Math.round(progress.value * 100)}%`;
  if (status.value === 'ready') return variantLabel.value;
  return 'IDLE';
});

// ---- render targets --------------------------------------------------------
const SR = 44100;
/** Ticks per quarter note in the SMF the EFX mode assembles. */
const SMF_PPQN = 480;
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
  importSmf(data: Uint8Array): number;
  bounceWithSf2Instrument(
    instrument: Record<string, unknown>,
    options: { numChannels: number; sampleRate: number; totalFrames: number },
  ): Float32Array;
  delete(): void;
}
interface ProjectCtor {
  new (): ProjectLike;
  midiProgram(ppq: number, group: number, channel: number, program: number): MidiEvent;
  midiBankProgram(
    ppq: number,
    group: number,
    channel: number,
    bankMsb: number,
    bankLsb: number,
    program: number,
  ): MidiEvent[];
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
// ---- GS SysEx helpers (Roland DT1 frames) ----------------------------------
/** Wrap an address+data run in a Roland DT1 SysEx body with its checksum. */
function dt1(addrData: number[]): number[] {
  let sum = 0;
  for (const b of addrData) sum = (sum + b) & 0x7f;
  return [0x41, 0x10, 0x42, 0x12, ...addrData, (128 - sum) & 0x7f, 0xf7];
}
/** Select the shared GS insertion-effect type (14-bit, MSB<<8|LSB) at 40 03 00. */
function efxTypeSysex(type: number): number[] {
  return dt1([0x40, 0x03, 0x00, (type >> 8) & 0x7f, type & 0x7f]);
}
/** Route a part (channel) through the insertion effect via the 40 4x 22 switch. */
function efxPartOnSysex(channel: number): number[] {
  const block = channel === 9 ? 0 : channel + 1;
  return dt1([0x40, 0x40 | block, 0x22, 1]);
}

// ---- minimal SMF writer ----------------------------------------------------
// Only `importSmf` carries SysEx into a project, so the EFX mode needs a file
// rather than an event list. One format-0 track is all that takes.
/** MIDI variable-length quantity. */
function vlq(value: number): number[] {
  const out = [value & 0x7f];
  let rest = value >>> 7;
  while (rest > 0) {
    out.unshift((rest & 0x7f) | 0x80);
    rest >>>= 7;
  }
  return out;
}
/** Prefix a chunk body with its four-character id and big-endian length. */
function smfChunk(id: string, body: number[]): number[] {
  const n = body.length;
  return [
    ...[...id].map((c) => c.charCodeAt(0)),
    (n >>> 24) & 0xff,
    (n >>> 16) & 0xff,
    (n >>> 8) & 0xff,
    n & 0xff,
    ...body,
  ];
}
/**
 * Build a one-track SMF from events timed in quarter notes, so the caller keeps
 * the same beat units the `Project.midi*` packers use. `sysex` bodies exclude
 * the leading `0xF0`, which the writer supplies with the payload length.
 */
function buildSmf(
  events: ReadonlyArray<{ beat: number; bytes?: number[]; sysex?: number[] }>,
  endBeat: number,
): Uint8Array {
  const track: number[] = [];
  let lastTick = 0;
  const ordered = [...events].sort((a, b) => a.beat - b.beat);
  for (const ev of [...ordered, { beat: endBeat, bytes: [0xff, 0x2f, 0x00] }]) {
    const tick = Math.round(ev.beat * SMF_PPQN);
    const payload = ev.sysex ? [0xf0, ...vlq(ev.sysex.length), ...ev.sysex] : (ev.bytes ?? []);
    track.push(...vlq(tick - lastTick), ...payload);
    lastTick = tick;
  }
  return Uint8Array.from([
    ...smfChunk('MThd', [0, 0, 0, 1, (SMF_PPQN >> 8) & 0xff, SMF_PPQN & 0xff]),
    ...smfChunk('MTrk', track),
  ]);
}

// ---- renderers -------------------------------------------------------------
/**
 * Bounce a project offline with no SoundFont loaded, so every note plays the
 * fallback synth. `populate` fills it — an event list for the channel-message
 * modes, an imported SMF for the one that needs SysEx.
 *
 * `seconds` sizes the render including the release tail.
 */
function bounceProject(
  wasm: WasmModule,
  populate: (project: ProjectLike, Project: ProjectCtor) => void,
  seconds: number,
): Float32Array {
  const Project = (wasm as unknown as { Project: ProjectCtor }).Project;
  const project = new Project();
  try {
    project.setSampleRate(SR);
    populate(project, Project);
    return project.bounceWithSf2Instrument(
      {},
      { numChannels: 1, sampleRate: SR, totalFrames: Math.round(SR * seconds) },
    );
  } finally {
    project.delete();
  }
}

/**
 * Populate from a flat event list. Project MIDI positions are QUARTER NOTES
 * (floats), not PPQ ticks, so `beats` is the clip length in quarter notes at
 * the default 120 BPM (0.5 s each).
 */
function fromEvents(
  events: (Project: ProjectCtor) => MidiEvent[],
  beats: number,
): (project: ProjectLike, Project: ProjectCtor) => void {
  return (project, Project) => {
    const { clipId } = project.addMidiClip(0, beats);
    project.setMidiEvents(clipId, events(Project));
  };
}

/**
 * gm-program mode: bounce one note through a GM program. The clip is two beats
 * long and the note is released after one and a half — a 0.75 s note whose
 * release tail fits the 1.4 s render.
 */
function renderGmProgram(wasm: WasmModule, program: number): Float32Array {
  return bounceProject(
    wasm,
    fromEvents(
      (Project) => [
        Project.midiProgram(0, 0, 0, program),
        Project.midiNoteOn(0, 0, 0, 60, 112),
        Project.midiNoteOff(1.5, 0, 0, 60, 0),
      ],
      2,
    ),
    1.4,
  );
}

/**
 * gs-variation mode: the gm-program note, with the variation selected by Bank
 * Select MSB ahead of the capital tone's program. The LSB stays 0 — in GS it
 * picks the tone map (SC-55 / SC-88 / SC-88Pro), never the variation.
 */
function renderGsVariation(wasm: WasmModule, bankMsb: number, capital: number): Float32Array {
  return bounceProject(
    wasm,
    fromEvents(
      (Project) => [
        ...Project.midiBankProgram(0, 0, 0, bankMsb, 0, capital),
        Project.midiNoteOn(0, 0, 0, 60, 112),
        Project.midiNoteOff(1.5, 0, 0, 60, 0),
      ],
      2,
    ),
    1.4,
  );
}

/** One bar of eighth-note rock beat as [beat, GM drum note, velocity]. */
const DRUM_PATTERN: ReadonlyArray<readonly [number, number, number]> = [
  [0, 36, 112], // kick
  [0, 42, 90], // closed hat
  [0.5, 42, 70],
  [1, 38, 112], // snare
  [1, 42, 90],
  [1.5, 42, 70],
  [2, 36, 112],
  [2, 42, 90],
  [2.5, 36, 100],
  [2.5, 42, 70],
  [3, 38, 112],
  [3, 42, 90],
  [3.5, 46, 90], // open hat
];
const DRUM_CHANNEL = 9; // MIDI channel 10, the GS rhythm part

/**
 * gs-drum-kit mode: play DRUM_PATTERN on the rhythm part, with the kit selected
 * by that part's Program Change. One bar is four beats (2 s); the render adds
 * the last hit's tail. Each strike gets a matching note-off a sixteenth later.
 */
function renderGsDrumKit(wasm: WasmModule, kitProgram: number): Float32Array {
  return bounceProject(
    wasm,
    fromEvents(
      (Project) => [
        Project.midiProgram(0, 0, DRUM_CHANNEL, kitProgram),
        ...DRUM_PATTERN.flatMap(([beat, note, velocity]) => [
          Project.midiNoteOn(beat, 0, DRUM_CHANNEL, note, velocity),
          Project.midiNoteOff(beat + 0.25, 0, DRUM_CHANNEL, note, 0),
        ]),
      ],
      4,
    ),
    2.3,
  );
}

/**
 * gs-efx mode: a held triad through one GS insertion effect. The effect is two
 * SysEx frames — the shared type select, then the part's EFX switch — and SysEx
 * only reaches a project through `importSmf`, so this mode assembles a file
 * where the others hand over an event list.
 */
const EFX_CHORD = [52, 55, 59]; // a sustained triad on the default piano fallback
function renderGsEfx(wasm: WasmModule, efxType: number): Float32Array {
  const events: { beat: number; bytes?: number[]; sysex?: number[] }[] = [];
  if (efxType > 0) {
    events.push({ beat: 0, sysex: efxTypeSysex(efxType) });
    events.push({ beat: 0, sysex: efxPartOnSysex(0) });
  }
  for (const n of EFX_CHORD) events.push({ beat: 0, bytes: [0x90, n, 112] });
  for (const n of EFX_CHORD) events.push({ beat: 2.3, bytes: [0x80, n, 0] });
  const smf = buildSmf(events, 3.4);
  return bounceProject(wasm, (project) => void project.importSmf(smf), 1.7);
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
  let pcm: Float32Array;
  switch (mode.value) {
    case 'gs-efx':
      pcm = renderGsEfx(wasm, variant.value);
      break;
    case 'gs-variation':
      pcm = renderGsVariation(wasm, variant.value, program.value);
      break;
    case 'gs-drum-kit':
      pcm = renderGsDrumKit(wasm, variant.value);
      break;
    default:
      pcm = renderGmProgram(wasm, variant.value);
  }
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

/** Re-paint when the screen is first laid out and on every later resize. */
useCanvasRedraw(canvas, paint);

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
