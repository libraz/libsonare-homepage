/**
 * Offline audio-bounce worker for the Piano Practice demo.
 *
 * Rendering a whole movement through the libsonare Project (SoundFont player or
 * built-in synth) is a single, multi-second synchronous WASM call plus a
 * full-buffer peak scan. Running it on the main thread froze the page on every
 * movement load, tempo change, and instrument switch, so it is offloaded here:
 * the caller posts the serialized chart, the worker bounces and peak-normalizes
 * it, and the normalized mono PCM is transferred back.
 *
 * The SoundFont is fetched and cached inside the worker so its bytes never have
 * to cross the message boundary (which would detach the cached buffer).
 */

/** Note timed in quarter-note beats, as consumed by the Project MIDI clip. */
export interface BounceNote {
  midi: number;
  velocity: number;
  startBeat: number;
  endBeat: number;
}

/** Tempo-map segment in quarter-note (ppq) units. */
export interface BounceTempoSegment {
  startBeat: number;
  bpm: number;
}

export interface BounceRequest {
  id: number;
  /** `sf2` renders the sampled SoundFont; `synth` the built-in NativeSynth. */
  source: 'sf2' | 'synth';
  /** Fetched (and cached) inside the worker when `source === 'sf2'`. */
  sf2Url: string;
  /** NativeSynth catalog preset for the built-in voice. */
  synthPreset: string;
  sampleRate: number;
  /** Practice speed multiplier applied to every tempo segment. */
  speed: number;
  /** Release tail captured past the last note-off (seconds). */
  tailSec: number;
  durationSec: number;
  durationBeats: number;
  tempoSegments: BounceTempoSegment[];
  notes: BounceNote[];
}

export type BounceResponse =
  | { id: number; pcm: Float32Array; version: string }
  | { id: number; error: string };

interface ProjectLike {
  setSampleRate(sr: number): void;
  setTempoSegments(segments: Array<{ startPpq: number; bpm: number }>): void;
  loadSoundFont(data: Uint8Array): void;
  addMidiClip(startPpq: number, lengthPpq: number): { clipId: number };
  setMidiEvents(clipId: number, events: unknown[]): void;
  bounceWithSf2Instrument(
    instrument: Record<string, unknown>,
    options: { numChannels: number; sampleRate: number; totalFrames: number },
  ): Float32Array;
  bounceWithSynthInstrument(
    instrument: string,
    options: { numChannels: number; sampleRate: number; totalFrames: number },
  ): Float32Array;
  delete(): void;
}
interface ProjectCtor {
  new (): ProjectLike;
  midiNoteOn(ppq: number, group: number, channel: number, note: number, velocity: number): unknown;
  midiNoteOff(
    ppq: number,
    group: number,
    channel: number,
    note: number,
    velocity?: number,
  ): unknown;
}
type WasmModule = {
  init: () => Promise<void>;
  version?: () => string;
  Project: ProjectCtor;
};

let wasmModule: WasmModule | null = null;
let sf2Bytes: Uint8Array | null = null;

async function ensureWasm(): Promise<WasmModule> {
  if (!wasmModule) {
    wasmModule = (await import('../../wasm/index.js')) as unknown as WasmModule;
    await wasmModule.init();
  }
  return wasmModule;
}

async function ensureSf2(url: string): Promise<Uint8Array> {
  if (sf2Bytes) return sf2Bytes;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`SF2 fetch failed (${res.status})`);
  sf2Bytes = new Uint8Array(await res.arrayBuffer());
  return sf2Bytes;
}

/** Bounce one chart to normalized mono PCM at the requested practice speed. */
async function bounce(req: BounceRequest): Promise<{ pcm: Float32Array; version: string }> {
  const wasm = await ensureWasm();
  const Project = wasm.Project;
  const project = new Project();
  try {
    // The built-in synth needs no SoundFont; it synthesizes every note.
    if (req.source === 'sf2') project.loadSoundFont(await ensureSf2(req.sf2Url));
    project.setSampleRate(req.sampleRate);
    // Scale every tempo segment by the practice speed; pitch is unaffected.
    project.setTempoSegments(
      req.tempoSegments.map((s) => ({ startPpq: s.startBeat, bpm: s.bpm * req.speed })),
    );
    const { clipId } = project.addMidiClip(0, req.durationBeats);

    const tagged: Array<{ at: number; key: number; ev: unknown }> = [];
    for (const n of req.notes) {
      tagged.push({
        at: n.startBeat,
        key: 1,
        ev: Project.midiNoteOn(n.startBeat, 0, 0, n.midi, n.velocity),
      });
      tagged.push({ at: n.endBeat, key: 0, ev: Project.midiNoteOff(n.endBeat, 0, 0, n.midi, 0) });
    }
    tagged.sort((a, b) => a.at - b.at || a.key - b.key);
    project.setMidiEvents(
      clipId,
      tagged.map((t) => t.ev),
    );

    const lengthSec = req.durationSec / req.speed + req.tailSec;
    const totalFrames = Math.round(req.sampleRate * lengthSec);
    const options = { numChannels: 1, sampleRate: req.sampleRate, totalFrames };
    const raw =
      req.source === 'sf2'
        ? project.bounceWithSf2Instrument({ destinationId: 0, gain: 1 }, options)
        : project.bounceWithSynthInstrument(req.synthPreset, options);

    // The SoundFont renders at a low absolute level; normalize to a fixed headroom.
    let peak = 1e-6;
    for (let i = 0; i < raw.length; i++) peak = Math.max(peak, Math.abs(raw[i]));
    const gain = 0.9 / peak;
    // Copy into a fresh buffer so the returned PCM owns transferable memory that
    // is independent of the WASM heap view `raw` points at.
    const pcm = new Float32Array(raw.length);
    for (let i = 0; i < raw.length; i++) pcm[i] = raw[i] * gain;

    return { pcm, version: wasm.version?.() ?? '' };
  } finally {
    project.delete();
  }
}

self.onmessage = async (event: MessageEvent<BounceRequest>) => {
  const req = event.data;
  try {
    const { pcm, version } = await bounce(req);
    self.postMessage({ id: req.id, pcm, version } satisfies BounceResponse, [pcm.buffer]);
  } catch (error) {
    self.postMessage({
      id: req.id,
      error: error instanceof Error ? error.message : String(error),
    } satisfies BounceResponse);
  }
};
