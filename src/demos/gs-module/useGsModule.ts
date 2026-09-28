/**
 * The one store behind every panel of the GS module demo.
 *
 * Rendering is offline throughout. The live engine accepts raw MIDI UMP, but
 * has no dedicated patch selector. SysEx only reaches a project through an
 * imported file — `setMidiEvents` drops it. So each audition assembles a
 * Standard MIDI File, imports it and bounces.
 *
 * A dropped file is imported untouched beside the setup rather than merged into
 * it. Imports append, and tick-zero SysEx from any track is realized before
 * tick-zero notes from any track, so the file keeps whatever GS setup it
 * carries and the panels layer on top without the demo having to parse a byte
 * of it.
 */
import { computed, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue';
import { bootWasm, type SonareWasmModule } from '@/composables/useWasmBoot';
import { downsampleWaveform, type WaveformPeak } from '@/utils/audio';
import { buildSmf, noteEvents, type SmfEvent } from '@/utils/gsSysex';
import { rhythmSetLabel } from '@/utils/modelNames';
import { GM_FAMILY_SIZE, GM_PROGRAM_COUNT, gmFamilyOf } from './gsNames';
import { type GsParamMeta, paramMetaOf } from './gsParamMeta';
import {
  defaultModuleState,
  type GsModuleState,
  type GsPartState,
  RHYTHM_CHANNEL,
  setupEvents,
} from './gsState';

const SAMPLE_RATE = 44100;
/** Quarter notes at the default 120 BPM, so one beat is half a second. */
const AUDITION_BEATS = 4;
const AUDITION_SECONDS = 3;
/** How much of the render a meter reads at once — a peak, not an instant sample. */
const METER_WINDOW_SECONDS = 0.02;
/** Points the waveform is reduced to; more than the scope has pixels buys nothing. */
const SCOPE_POINTS = 900;

/** A sustained triad, voiced low enough to show what a filter or drive is doing. */
const AUDITION_CHORD = [52, 55, 59, 64];
/** One bar of kick, snare and closed hat, for auditioning a drum kit. */
const AUDITION_DRUMS: { note: number; beat: number }[] = [
  { note: 36, beat: 0 },
  { note: 42, beat: 0.5 },
  { note: 38, beat: 1 },
  { note: 42, beat: 1.5 },
  { note: 36, beat: 2 },
  { note: 42, beat: 2.5 },
  { note: 38, beat: 3 },
  { note: 42, beat: 3.5 },
];

export type GsRenderStatus = 'idle' | 'rendering' | 'ready' | 'error';

export class EmptyMidiError extends Error {
  constructor() {
    super('The MIDI file contains no playable notes.');
    this.name = 'EmptyMidiError';
  }
}

/** The notes one part plays when auditioned on its own. */
export function auditionPhrase(channel: number): SmfEvent[] {
  if (channel === RHYTHM_CHANNEL) {
    return AUDITION_DRUMS.flatMap(({ note, beat }) =>
      noteEvents(channel, note, 112, beat, beat + 0.25),
    );
  }
  return AUDITION_CHORD.flatMap((note, index) =>
    noteEvents(channel, note, 100, index * 0.12, AUDITION_BEATS - 0.5),
  );
}

/** The whole file an audition renders: the setup, then the phrase. */
export function auditionSmf(state: GsModuleState, channel: number): Uint8Array {
  return buildSmf([...setupEvents(state), ...auditionPhrase(channel)], AUDITION_BEATS + 1);
}

/**
 * Bounce one or more files together with no SoundFont loaded, so every note
 * plays a fallback voice and the demo ships no sample data.
 */
export function bounceFiles(
  wasm: SonareWasmModule,
  files: readonly Uint8Array[],
  seconds?: number,
): Float32Array {
  const Project = (wasm as unknown as { Project: new () => GsProject }).Project;
  const project = new Project();
  try {
    project.setSampleRate(SAMPLE_RATE);
    for (const file of files) project.importSmf(file);
    const options: { numChannels: number; sampleRate: number; totalFrames?: number } = {
      numChannels: 1,
      sampleRate: SAMPLE_RATE,
    };
    if (seconds !== undefined) options.totalFrames = Math.round(SAMPLE_RATE * seconds);
    const audio = project.bounceWithSf2Instrument({}, options);
    if (audio.length === 0) throw new EmptyMidiError();
    return audio;
  } finally {
    project.delete();
  }
}

/** One GS rhythm set the build defines. */
export interface GsDrumKit {
  program: number;
  /** The label to show — see {@link rhythmSetLabel}, which most names pass through. */
  name: string;
  /**
   * False where the build names the set but voices it as Standard. The query
   * is three-state and `null` means no set at that program at all, so the
   * caller has to test for the set before testing this.
   */
  voicedApart: boolean;
}

/** Every rhythm set the build defines, asked for rather than hardcoded. */
export function drumKitsOf(wasm: SonareWasmModule): GsDrumKit[] {
  const kits: GsDrumKit[] = [];
  for (let program = 0; program < 128; program++) {
    const name = wasm.synthGsDrumKitName(program);
    if (name === null) continue;
    kits.push({
      program,
      name: rhythmSetLabel(program, name),
      voicedApart: wasm.synthGsDrumKitIsVoicedApart(program) === true,
    });
  }
  return kits;
}

/** One GM program, named by the engine rather than by a table beside it. */
export interface GmProgram {
  program: number;
  family: number;
  name: string;
}

/** The whole GM sound set with the engine's own spellings. */
export function gmProgramsOf(wasm: SonareWasmModule): GmProgram[] {
  const Project = (wasm as unknown as { Project: GsProjectStatics }).Project;
  return Array.from({ length: GM_PROGRAM_COUNT }, (_, program) => ({
    program,
    family: gmFamilyOf(program),
    name: Project.gmInstrumentName(program) ?? '',
  }));
}

/** The sixteen family names, in family order. */
export function gmFamilyNamesOf(wasm: SonareWasmModule): string[] {
  const Project = (wasm as unknown as { Project: GsProjectStatics }).Project;
  return Array.from(
    { length: GM_PROGRAM_COUNT / GM_FAMILY_SIZE },
    (_, family) => Project.gmFamilyName(family) ?? '',
  );
}

/**
 * Bank Select values that give `program` a variation this build voices apart
 * from its capital tone.
 *
 * The query answers for every bank, so a `false` means the bank resolves back
 * to the capital rather than that the bank is unknown — which is what GS does
 * with a variation a module never had. Only the ones that differ are listed,
 * because a variation that sounds identical is not a choice a reader can hear.
 */
export function variationsOf(wasm: SonareWasmModule, program: number): number[] {
  const banks: number[] = [];
  for (let bank = 1; bank < 128; bank++) {
    if (wasm.synthGsVariationIsVoicedApart(bank, program) === true) banks.push(bank);
  }
  return banks;
}

/**
 * Peak of the render around one moment, which is what a meter shows. A single
 * sample would read as silence every time the waveform crosses zero.
 */
export function peakAround(buffer: Float32Array, seconds: number): number {
  const centre = Math.round(seconds * SAMPLE_RATE);
  const half = Math.round((METER_WINDOW_SECONDS * SAMPLE_RATE) / 2);
  const from = Math.max(0, centre - half);
  const to = Math.min(buffer.length, centre + half);
  let peak = 0;
  for (let i = from; i < to; i++) peak = Math.max(peak, Math.abs(buffer[i]));
  return peak;
}

/** The static half of `Project` this demo uses. */
interface GsProjectStatics {
  gmInstrumentName(program: number): string | null;
  gmFamilyName(family: number): string | null;
}

/** The slice of `Project` this demo uses. */
interface GsProject {
  setSampleRate(rate: number): void;
  importSmf(data: Uint8Array): number;
  bounceWithSf2Instrument(
    instrument: Record<string, never>,
    options: { numChannels: number; sampleRate: number; totalFrames?: number },
  ): Float32Array;
  delete(): void;
}

export function useGsModule() {
  const state = reactive<GsModuleState>(defaultModuleState());
  /** Which part the panels are editing and auditioning. */
  const selectedChannel = ref(0);
  /** A dropped file, kept as bytes and imported beside the setup. */
  const droppedFile = shallowRef<{ name: string; bytes: Uint8Array } | null>(null);

  const status = ref<GsRenderStatus>('idle');
  const error = shallowRef<unknown>(null);
  const rendered = shallowRef<Float32Array | null>(null);
  /** Filled on the first boot; empty until then, which the kit browser shows. */
  const drumKits = shallowRef<GsDrumKit[]>([]);
  const gmPrograms = shallowRef<GmProgram[]>([]);
  const gmFamilyNames = shallowRef<string[]>([]);
  /** Bank values that give the selected part's program a distinct variation. */
  const variations = shallowRef<number[]>([]);
  /** Unit and range for every control an effect slot can reach, from the engine. */
  const paramMeta = shallowRef<Map<string, GsParamMeta>>(new Map());

  /** True while a buffer is on the output, for the transport. */
  const isPlaying = ref(false);
  /** How far through the render playback is, 0 to 1. */
  const playhead = ref(0);
  /**
   * Which part the buffer on the output is playing, or null when that cannot
   * be said. An audition plays the selected part alone, so its strip can be
   * metered; a dropped file is never parsed, so no strip can be.
   */
  const playingChannel = ref<number | null>(null);
  const playingPeak = ref(0);

  let audio: AudioContext | null = null;
  let playing: AudioBufferSourceNode | null = null;
  let startedAt = 0;
  let frame = 0;
  let disposed = false;
  /** Renders are serialized; a newer request supersedes one still in flight. */
  let generation = 0;

  const selectedPart = computed<GsPartState>(() => state.parts[selectedChannel.value]);
  /** The frames the current state would send, for the SysEx view. */
  const frames = computed(() => setupEvents(state as GsModuleState));
  /** The render as a waveform for the scope, rebuilt only when a render lands. */
  const waveform = computed<WaveformPeak[]>(() =>
    rendered.value ? downsampleWaveform(rendered.value, rendered.value, SCOPE_POINTS) : [],
  );
  /** What each strip's meter reads, indexed by channel. */
  const activity = computed<number[]>(() => {
    const levels = new Array<number>(state.parts.length).fill(0);
    if (playingChannel.value !== null) levels[playingChannel.value] = playingPeak.value;
    return levels;
  });

  function stop() {
    playing?.stop();
    playing = null;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    isPlaying.value = false;
    playhead.value = 0;
    playingChannel.value = null;
    playingPeak.value = 0;
  }

  /** Follow the output: the playhead for the scope, the peak for the meter. */
  function follow() {
    frame = 0;
    if (!playing || !audio) return;
    const buffer = rendered.value;
    if (!buffer) return;
    const elapsed = audio.currentTime - startedAt;
    playhead.value = Math.min(1, Math.max(0, elapsed / (buffer.length / SAMPLE_RATE)));
    playingPeak.value = peakAround(buffer, elapsed);
    frame = requestAnimationFrame(follow);
  }

  /** The variation list follows the selected part's program, not the state. */
  function refreshVariations(wasm: SonareWasmModule) {
    variations.value = variationsOf(wasm, selectedPart.value.program);
  }

  watch(
    () => [selectedChannel.value, selectedPart.value.program] as const,
    () => {
      void bootWasm().then((wasm) => {
        if (!disposed) refreshVariations(wasm);
      });
    },
  );

  /**
   * Boot far enough to fill the lists the panels read, without rendering. The
   * kit browser has nothing to show until the engine has been asked what sets
   * this build defines, and that should not wait for the first play.
   */
  async function prepare() {
    try {
      const wasm = await bootWasm();
      if (disposed) return;
      drumKits.value = drumKitsOf(wasm);
      gmPrograms.value = gmProgramsOf(wasm);
      gmFamilyNames.value = gmFamilyNamesOf(wasm);
      paramMeta.value = paramMetaOf(wasm);
      refreshVariations(wasm);
    } catch (cause) {
      if (disposed) return;
      error.value = cause;
      status.value = 'error';
    }
  }

  onMounted(() => void prepare());

  async function render(): Promise<Float32Array | null> {
    const mine = ++generation;
    status.value = 'rendering';
    error.value = null;
    try {
      const wasm = await bootWasm();
      if (disposed || mine !== generation) return null;
      const setup = buildSmf(setupEvents(state as GsModuleState), 0.01);
      const imported = droppedFile.value;
      const files = imported
        ? [setup, imported.bytes]
        : [auditionSmf(state as GsModuleState, selectedChannel.value)];
      const buffer = imported
        ? bounceFiles(wasm, files)
        : bounceFiles(wasm, files, AUDITION_SECONDS);
      if (disposed || mine !== generation) return null;
      rendered.value = buffer;
      status.value = 'ready';
      return buffer;
    } catch (cause) {
      if (disposed || mine !== generation) return null;
      error.value = cause;
      status.value = 'error';
      return null;
    }
  }

  /** Render if needed, then play the buffer on screen. */
  async function play() {
    const buffer = rendered.value ?? (await render());
    if (!buffer?.length || disposed) return;
    audio ??= new AudioContext({ sampleRate: SAMPLE_RATE });
    // A context created before a gesture starts suspended, and a suspended
    // context plays nothing while reporting success.
    if (audio.state === 'suspended') await audio.resume();
    if (disposed) return;
    stop();
    const target = audio.createBuffer(1, buffer.length, SAMPLE_RATE);
    target.getChannelData(0).set(buffer);
    const source = audio.createBufferSource();
    source.buffer = target;
    source.connect(audio.destination);
    source.onended = () => {
      if (playing === source) stop();
    };
    source.start();
    playing = source;
    isPlaying.value = true;
    playingChannel.value = droppedFile.value ? null : selectedChannel.value;
    startedAt = audio.currentTime;
    follow();
  }

  /**
   * Any edit invalidates the render, so the next play is of what is on screen.
   * Playback stops with it: the buffer on the output was bounced from the state
   * before the edit, and letting it run would leave a sound on the speakers the
   * panels no longer describe.
   */
  function invalidate() {
    stop();
    rendered.value = null;
    if (status.value === 'ready') status.value = 'idle';
  }

  function reset() {
    Object.assign(state, defaultModuleState());
    droppedFile.value = null;
    invalidate();
  }

  onBeforeUnmount(() => {
    disposed = true;
    stop();
    void audio?.close();
    audio = null;
  });

  return {
    state,
    selectedChannel,
    selectedPart,
    droppedFile,
    frames,
    status,
    error,
    rendered,
    waveform,
    activity,
    isPlaying,
    playhead,
    drumKits,
    gmPrograms,
    gmFamilyNames,
    variations,
    paramMeta,
    render,
    play,
    stop,
    invalidate,
    reset,
  };
}
