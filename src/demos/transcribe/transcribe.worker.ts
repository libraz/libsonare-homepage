/**
 * Transcription worker: one request turns audio into notes, then plays those
 * notes back through the built-in acoustic piano.
 *
 * The notes go back as a `progress` reply as soon as `transcribe` returns, so
 * the roll redraws while the piano is still rendering. The final reply carries
 * the piano, loudness-matched to the source so an A/B switch compares content
 * rather than level, and the notes as a Standard MIDI File.
 */
import type { TranscribeOptions } from '@/wasm/index.js';
import type { TranscribedEvent } from './transcribedNotes';

/** Built-in NativeSynth preset the notes are rendered through. */
export const PIANO_PRESET = 'acoustic-piano';
/** Release tail rendered past the source's end, in seconds. */
const TAIL_SEC = 1.5;
const PEAK_CEILING = 0.95;

export interface TranscribeRequest {
  id: number;
  type: 'transcribe';
  samples: Float32Array;
  sampleRate: number;
  options: TranscribeOptions;
  /** Grid tempo from an earlier run on the same audio; omitted on the first, which detects it. */
  tempoBpm?: number;
}

export interface TranscribeNotes {
  events: TranscribedEvent[];
  tempoBpm: number;
  tuning: number;
  elapsedMs: number;
}

export type TranscribeWorkerReply =
  | ({ id: number; type: 'progress' } & TranscribeNotes)
  | { id: number; type: 'done'; piano: Float32Array; smf: Uint8Array; version: string }
  | { id: number; type: 'error'; error: string };

type Wasm = typeof import('@/wasm/index.js');
let wasm: Wasm | null = null;

async function ensureWasm(): Promise<Wasm> {
  if (!wasm) {
    const module = await import('@/wasm/index.js');
    await module.init();
    wasm = module;
  }
  return wasm;
}

function rms(samples: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / Math.max(1, samples.length));
}

async function run(request: TranscribeRequest): Promise<void> {
  const engine = await ensureWasm();
  const started = performance.now();
  const result = engine.transcribe({
    samples: request.samples,
    sampleRate: request.sampleRate,
    tempoBpm: request.tempoBpm,
    ...request.options,
  });
  // Embind hands back plain objects; copy into clone-safe literals.
  const events = result.events.map((event) => ({
    ppq: event.ppq,
    data0: event.data0,
    data1: event.data1 ?? 0,
  }));
  self.postMessage({
    id: request.id,
    type: 'progress',
    events,
    tempoBpm: result.tempoBpm,
    tuning: result.tuning,
    elapsedMs: performance.now() - started,
  } satisfies TranscribeWorkerReply);

  const project = new engine.Project();
  try {
    project.setSampleRate(request.sampleRate);
    project.setTempoSegments([{ startPpq: 0, bpm: result.tempoBpm }]);
    const lengthSec = request.samples.length / request.sampleRate;
    const { clipId } = project.addMidiClip(0, (lengthSec * result.tempoBpm) / 60 + 1);
    project.setMidiEvents(clipId, events);
    const totalFrames = Math.round(request.samples.length + TAIL_SEC * request.sampleRate);
    const raw = project.bounceWithSynthInstrument(PIANO_PRESET, {
      numChannels: 1,
      sampleRate: request.sampleRate,
      totalFrames,
    });
    let peak = 1e-9;
    for (let i = 0; i < raw.length; i++) peak = Math.max(peak, Math.abs(raw[i]));
    const level = rms(raw);
    const gain = level > 1e-9 ? Math.min(rms(request.samples) / level, PEAK_CEILING / peak) : 0;
    const piano = new Float32Array(raw.length);
    for (let i = 0; i < raw.length; i++) piano[i] = raw[i] * gain;
    const smf = project.exportSmf();
    self.postMessage(
      {
        id: request.id,
        type: 'done',
        piano,
        smf,
        version: engine.version(),
      } satisfies TranscribeWorkerReply,
      { transfer: [piano.buffer, smf.buffer] },
    );
  } finally {
    project.delete();
  }
}

self.onmessage = async (event: MessageEvent<TranscribeRequest>) => {
  const request = event.data;
  if (request.type !== 'transcribe') return;
  try {
    await run(request);
  } catch (error) {
    self.postMessage({
      id: request.id,
      type: 'error',
      error: error instanceof Error ? error.message : String(error),
    } satisfies TranscribeWorkerReply);
  }
};
