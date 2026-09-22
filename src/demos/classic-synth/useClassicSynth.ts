/**
 * The one store behind every chapter: it owns the patch, renders a phrase
 * through it offline, plays the result and hands it out as a file.
 *
 * Rendering is offline rather than live, and that is the point of the page. A
 * chapter asks a reader to hear one axis — four filter models on the same note,
 * a routing added and removed — and a comparison is only honest when the two
 * renders differ in nothing else. `bounceWithSynthInstrument` is deterministic
 * for a fixed project, options and patch, so the second render of a variant is
 * the first one again.
 *
 * Renders are cached by patch and phrase for that reason too: clicking back and
 * forth between two variants is the listening method the chapters are built
 * around, and it should not cost a bounce each time.
 */
import { onBeforeUnmount, reactive, ref, shallowRef } from 'vue';
import { useAudioExport } from '@/composables/useAudioExport';
import { bootWasm, type SonareWasmModule } from '@/composables/useWasmBoot';
import { type ClassicPatch, defaultPatch, type Phrase, toSynthPatch } from './classicSynthState';

const SAMPLE_RATE = 44_100;
const TEMPO_BPM = 120;
/** Stereo, because `stereoSpread` is one of the axes a chapter covers. */
const CHANNELS = 2;

/** Renders past this many are dropped oldest-first. */
const CACHE_LIMIT = 48;

export type RenderStatus = 'idle' | 'rendering' | 'ready' | 'error';

/** One finished render, interleaved as the engine returned it. */
export interface Rendered {
  interleaved: Float32Array;
  frames: number;
  sampleRate: number;
  channels: number;
}

/** The slice of `Project` this demo uses. */
interface SynthProject {
  setSampleRate(rate: number): void;
  setTempoSegments(segments: readonly { startPpq: number; bpm: number }[]): void;
  addMidiClip(startPpq: number, lengthPpq: number): { clipId: number };
  setMidiEvents(clipId: number, events: readonly unknown[]): void;
  bounceWithSynthInstrument(
    instrument: unknown,
    options: { numChannels: number; sampleRate: number; totalFrames: number },
  ): Float32Array;
  exportSmf(): Uint8Array<ArrayBuffer>;
  delete(): void;
}

interface SynthProjectStatics {
  new (): SynthProject;
  midiNoteOn(beat: number, group: number, channel: number, note: number, velocity: number): unknown;
  midiNoteOff(
    beat: number,
    group: number,
    channel: number,
    note: number,
    velocity: number,
  ): unknown;
  midiCc(beat: number, group: number, channel: number, controller: number, value: number): unknown;
  midiChannelPressure(beat: number, group: number, channel: number, pressure: number): unknown;
  midiPitchBend(beat: number, group: number, channel: number, bend: number): unknown;
}

/** Steps a controller ramp is drawn with. Fine enough that a sweep is not a staircase. */
const RAMP_STEPS = 48;

/** Pitch bend travels on the wire as a 14-bit unsigned value centred here. */
const BEND_CENTRE = 8192;
const BEND_MAX = 16_383;

/** A phrase's -1..1 bend, as the integer the event factory requires. */
function bendValue(deflection: number): number {
  const raw = Math.round(BEND_CENTRE + deflection * (BEND_CENTRE - 1));
  return Math.min(BEND_MAX, Math.max(0, raw));
}

/**
 * Turn a phrase into MIDI events, sorted so a note-off at a beat is realized
 * before a note-on at the same beat — otherwise a repeated note silences itself.
 */
export function phraseEvents(Project: SynthProjectStatics, phrase: Phrase): unknown[] {
  const tagged: { at: number; order: number; event: unknown }[] = [];
  const push = (at: number, order: number, event: unknown) => tagged.push({ at, order, event });

  for (const control of phrase.controls ?? []) {
    for (let step = 0; step <= RAMP_STEPS; step++) {
      const t = step / RAMP_STEPS;
      const at = control.beat + control.beats * t;
      const value = control.from + (control.to - control.from) * t;
      if (control.controller === 'pressure') {
        push(at, -1, Project.midiChannelPressure(at, 0, 0, Math.round(value)));
      } else if (control.controller === 'bend') {
        push(at, -1, Project.midiPitchBend(at, 0, 0, bendValue(value)));
      } else {
        push(at, -1, Project.midiCc(at, 0, 0, control.controller, Math.round(value)));
      }
    }
  }

  for (const note of phrase.notes) {
    const off = note.beat + note.beats;
    push(off, 0, Project.midiNoteOff(off, 0, 0, note.note, 0));
    push(note.beat, 1, Project.midiNoteOn(note.beat, 0, 0, note.note, note.velocity));
  }

  tagged.sort((a, b) => a.at - b.at || a.order - b.order);
  return tagged.map((entry) => entry.event);
}

function totalFrames(phrase: Phrase): number {
  return Math.round((SAMPLE_RATE * phrase.beats * 60) / TEMPO_BPM);
}

/** Render one phrase through one patch. Deterministic for a fixed pair. */
export function renderPhrase(
  wasm: SonareWasmModule,
  patch: ClassicPatch,
  phrase: Phrase,
): Rendered {
  const Project = (wasm as unknown as { Project: SynthProjectStatics }).Project;
  const project = new Project();
  try {
    project.setSampleRate(SAMPLE_RATE);
    project.setTempoSegments([{ startPpq: 0, bpm: TEMPO_BPM }]);
    const { clipId } = project.addMidiClip(0, phrase.beats);
    project.setMidiEvents(clipId, phraseEvents(Project, phrase));
    const frames = totalFrames(phrase);
    const interleaved = project.bounceWithSynthInstrument(toSynthPatch(patch), {
      numChannels: CHANNELS,
      sampleRate: SAMPLE_RATE,
      totalFrames: frames,
    });
    return { interleaved, frames, sampleRate: SAMPLE_RATE, channels: CHANNELS };
  } finally {
    project.delete();
  }
}

/** The Standard MIDI File a phrase alone makes — the notes, without the patch. */
export function phraseSmf(wasm: SonareWasmModule, phrase: Phrase): Uint8Array<ArrayBuffer> {
  const Project = (wasm as unknown as { Project: SynthProjectStatics }).Project;
  const project = new Project();
  try {
    project.setTempoSegments([{ startPpq: 0, bpm: TEMPO_BPM }]);
    const { clipId } = project.addMidiClip(0, phrase.beats);
    project.setMidiEvents(clipId, phraseEvents(Project, phrase));
    return project.exportSmf();
  } finally {
    project.delete();
  }
}

/**
 * A cache key for a render. The patch is spelled out field by field in a fixed
 * order rather than passed through `JSON.stringify`, so two patches that differ
 * only in key order are one entry.
 */
export function renderKey(patch: ClassicPatch, phrase: Phrase): string {
  const fields = Object.keys(patch)
    .filter((key) => key !== 'modRoutings')
    .sort()
    .map((key) => `${key}=${(patch as Record<string, unknown>)[key]}`);
  const routings = patch.modRoutings
    .map((routing) => `${routing.source}>${routing.destination}@${routing.depth}`)
    .join('+');
  return `${phrase.id}|${fields.join(',')}|${routings}`;
}

export function useClassicSynth() {
  const patch = reactive<ClassicPatch>(defaultPatch());
  const status = ref<RenderStatus>('idle');
  const error = shallowRef<unknown>(null);
  /** Which variant is sounding, so a chapter can light the button that plays. */
  const playingKey = ref<string | null>(null);
  /** Names of the presets the page offers, filled on boot. */
  const presetNames = shallowRef<string[]>([]);

  const { encodeWav } = useAudioExport();

  const cache = new Map<string, Rendered>();
  let audio: AudioContext | null = null;
  let source: AudioBufferSourceNode | null = null;
  let disposed = false;
  /** Renders are serialized; a newer request supersedes one still in flight. */
  let generation = 0;

  function stop() {
    source?.stop();
    source = null;
    playingKey.value = null;
  }

  /**
   * Render a patch/phrase pair, reusing a cached result. Yields to the event
   * loop before bouncing so the click that asked for it can paint first — a
   * bounce blocks the main thread, and a button that never shows it was pressed
   * reads as a broken page.
   */
  async function render(variant: ClassicPatch, phrase: Phrase): Promise<Rendered | null> {
    const key = renderKey(variant, phrase);
    const hit = cache.get(key);
    if (hit) return hit;

    const mine = ++generation;
    status.value = 'rendering';
    error.value = null;
    try {
      const wasm = await bootWasm();
      if (disposed || mine !== generation) return null;
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (disposed || mine !== generation) return null;
      const rendered = renderPhrase(wasm, variant, phrase);
      if (disposed || mine !== generation) return null;
      if (cache.size >= CACHE_LIMIT) {
        const oldest = cache.keys().next();
        if (!oldest.done) cache.delete(oldest.value);
      }
      cache.set(key, rendered);
      status.value = 'ready';
      return rendered;
    } catch (cause) {
      if (disposed || mine !== generation) return null;
      error.value = cause;
      status.value = 'error';
      return null;
    }
  }

  /** Render if needed, then play. Passing a patch plays a variant of the shared one. */
  async function play(phrase: Phrase, variant: ClassicPatch = patch as ClassicPatch) {
    const key = renderKey(variant, phrase);
    const rendered = await render(variant, phrase);
    if (!rendered || disposed) return;
    audio ??= new AudioContext({ sampleRate: SAMPLE_RATE });
    // A context created before a gesture starts suspended, and a suspended
    // context plays nothing while reporting success.
    if (audio.state === 'suspended') await audio.resume();
    if (disposed) return;
    stop();
    const target = audio.createBuffer(rendered.channels, rendered.frames, rendered.sampleRate);
    for (let channel = 0; channel < rendered.channels; channel++) {
      const plane = target.getChannelData(channel);
      for (let frame = 0; frame < rendered.frames; frame++) {
        plane[frame] = rendered.interleaved[frame * rendered.channels + channel];
      }
    }
    const node = audio.createBufferSource();
    node.buffer = target;
    node.connect(audio.destination);
    node.onended = () => {
      if (source === node) {
        source = null;
        playingKey.value = null;
      }
    };
    node.start();
    source = node;
    playingKey.value = key;
  }

  /** The current patch through a phrase, as a 16-bit WAV. */
  async function exportWav(phrase: Phrase): Promise<Blob | null> {
    const rendered = await render(patch as ClassicPatch, phrase);
    if (!rendered) return null;
    return encodeWav(rendered.interleaved, rendered.sampleRate, rendered.channels);
  }

  /** The phrase's notes as a Standard MIDI File, so it can be played elsewhere. */
  async function exportMidi(phrase: Phrase): Promise<Blob | null> {
    try {
      const wasm = await bootWasm();
      if (disposed) return null;
      return new Blob([phraseSmf(wasm, phrase)], { type: 'audio/midi' });
    } catch (cause) {
      error.value = cause;
      status.value = 'error';
      return null;
    }
  }

  function load(next: ClassicPatch) {
    Object.assign(patch, next);
    patch.modRoutings = next.modRoutings.map((routing) => ({ ...routing }));
  }

  function reset() {
    load(defaultPatch());
  }

  void bootWasm()
    .then((wasm) => {
      if (disposed) return;
      presetNames.value = subtractivePresets(wasm);
    })
    .catch((cause) => {
      if (!disposed) error.value = cause;
    });

  onBeforeUnmount(() => {
    disposed = true;
    stop();
    void audio?.close();
    audio = null;
    cache.clear();
  });

  return {
    patch,
    status,
    error,
    playingKey,
    presetNames,
    render,
    play,
    stop,
    exportWav,
    exportMidi,
    load,
    reset,
  };
}

/**
 * The preset names whose resolved patch runs the subtractive engine.
 *
 * The page is about that engine's architecture, and every control on screen
 * belongs to it. A preset built on one of the physical models would load with
 * most of the panel meaning nothing, so it is not offered here.
 */
export function subtractivePresets(wasm: SonareWasmModule): string[] {
  const names = (wasm as unknown as { synthPresetNames(): string[] }).synthPresetNames();
  const presetPatch = (
    wasm as unknown as { synthPresetPatch(name: string): { engineMode?: string } }
  ).synthPresetPatch;
  return names.filter((name) => presetPatch(name).engineMode === 'subtractive');
}
