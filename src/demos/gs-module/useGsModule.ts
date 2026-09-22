/**
 * The one store behind every panel of the GS module demo.
 *
 * Rendering is offline throughout. The live engine has no program change, so a
 * patch browser cannot be driven by it at all, and SysEx only reaches a project
 * through an imported file — `setMidiEvents` drops it. So each audition
 * assembles a Standard MIDI File, imports it and bounces.
 *
 * A dropped file is imported untouched beside the setup rather than merged into
 * it. Imports append, and tick-zero SysEx from any track is realized before
 * tick-zero notes from any track, so the file keeps whatever GS setup it
 * carries and the panels layer on top without the demo having to parse a byte
 * of it.
 */
import { computed, onBeforeUnmount, onMounted, reactive, ref, shallowRef } from 'vue';
import { bootWasm, type SonareWasmModule } from '@/composables/useWasmBoot';
import { buildSmf, noteEvents, type SmfEvent } from '@/utils/gsSysex';
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
  seconds: number,
): Float32Array {
  const Project = (wasm as unknown as { Project: new () => GsProject }).Project;
  const project = new Project();
  try {
    project.setSampleRate(SAMPLE_RATE);
    for (const file of files) project.importSmf(file);
    return project.bounceWithSf2Instrument(
      {},
      { numChannels: 1, sampleRate: SAMPLE_RATE, totalFrames: Math.round(SAMPLE_RATE * seconds) },
    );
  } finally {
    project.delete();
  }
}

/** One GS rhythm set the build defines, as the engine reports it. */
export interface GsDrumKit {
  program: number;
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
    kits.push({ program, name, voicedApart: wasm.synthGsDrumKitIsVoicedApart(program) === true });
  }
  return kits;
}

/** The slice of `Project` this demo uses. */
interface GsProject {
  setSampleRate(rate: number): void;
  importSmf(data: Uint8Array): number;
  bounceWithSf2Instrument(
    instrument: Record<string, never>,
    options: { numChannels: number; sampleRate: number; totalFrames: number },
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

  let audio: AudioContext | null = null;
  let playing: AudioBufferSourceNode | null = null;
  let disposed = false;
  /** Renders are serialized; a newer request supersedes one still in flight. */
  let generation = 0;

  const selectedPart = computed<GsPartState>(() => state.parts[selectedChannel.value]);
  /** The frames the current state would send, for the SysEx view. */
  const frames = computed(() => setupEvents(state as GsModuleState));

  function stop() {
    playing?.stop();
    playing = null;
  }

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
      const files = droppedFile.value
        ? [setup, droppedFile.value.bytes]
        : [auditionSmf(state as GsModuleState, selectedChannel.value)];
      const buffer = bounceFiles(wasm, files, AUDITION_SECONDS);
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
    if (!buffer || disposed) return;
    audio ??= new AudioContext({ sampleRate: SAMPLE_RATE });
    // A context created before a gesture starts suspended, and a suspended
    // context plays nothing while reporting success.
    if (audio.state === 'suspended') await audio.resume();
    if (disposed) return;
    stop();
    const target = audio.createBuffer(1, buffer.length, SAMPLE_RATE);
    target.copyToChannel(buffer, 0);
    const source = audio.createBufferSource();
    source.buffer = target;
    source.connect(audio.destination);
    source.onended = () => {
      if (playing === source) playing = null;
    };
    source.start();
    playing = source;
  }

  /** Any edit invalidates the render, so the next play is of what is on screen. */
  function invalidate() {
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
    drumKits,
    render,
    play,
    stop,
    invalidate,
    reset,
  };
}
