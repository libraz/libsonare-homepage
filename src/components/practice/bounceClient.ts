/**
 * Main-thread client for the Piano Practice bounce worker.
 *
 * Wraps the worker in a promise-per-request API with id correlation, and turns a
 * parsed movement into the flat, transferable payload the worker expects. Keeping
 * the payload builder pure makes the serialization independently testable.
 */
import type { BounceRequest, BounceResponse } from './bounce.worker';
import type { ParsedMidi } from './midiSmf';

/** Everything the bounce depends on besides the chart itself. */
export interface BounceParams {
  source: 'sf2' | 'synth';
  sf2Url: string;
  synthPreset: string;
  sampleRate: number;
  speed: number;
  tailSec: number;
}

/** Flatten a parsed movement into the serializable worker payload (minus the id). */
export function buildBouncePayload(
  midi: ParsedMidi,
  params: BounceParams,
): Omit<BounceRequest, 'id'> {
  return {
    source: params.source,
    sf2Url: params.sf2Url,
    synthPreset: params.synthPreset,
    sampleRate: params.sampleRate,
    speed: params.speed,
    tailSec: params.tailSec,
    durationSec: midi.durationSec,
    durationBeats: midi.durationBeats,
    tempoSegments: midi.tempoSegments.map((s) => ({ startBeat: s.startBeat, bpm: s.bpm })),
    notes: midi.notes.map((n) => ({
      midi: n.midi,
      velocity: n.velocity,
      startBeat: n.startBeat,
      endBeat: n.endBeat,
    })),
  };
}

export interface BounceResult {
  pcm: Float32Array;
  version: string;
}

export interface BounceClient {
  bounce(payload: Omit<BounceRequest, 'id'>): Promise<BounceResult>;
  dispose(): void;
}

/** Create a bounce client backed by a single dedicated worker. */
export function createBounceClient(): BounceClient {
  const worker = new Worker(new URL('./bounce.worker.ts', import.meta.url), { type: 'module' });
  let nextId = 0;
  const pending = new Map<
    number,
    { resolve: (r: BounceResult) => void; reject: (e: Error) => void }
  >();

  worker.onmessage = (event: MessageEvent<BounceResponse>) => {
    const res = event.data;
    const entry = pending.get(res.id);
    if (!entry) return;
    pending.delete(res.id);
    if ('error' in res) entry.reject(new Error(res.error));
    else entry.resolve({ pcm: res.pcm, version: res.version });
  };
  worker.onerror = (event) => {
    // A worker crash would otherwise leave every request hanging forever.
    const err = new Error(event.message || 'Bounce worker error');
    for (const entry of pending.values()) entry.reject(err);
    pending.clear();
  };

  return {
    bounce(payload) {
      const id = ++nextId;
      return new Promise<BounceResult>((resolve, reject) => {
        pending.set(id, { resolve, reject });
        worker.postMessage({ id, ...payload } satisfies BounceRequest);
      });
    },
    dispose() {
      for (const entry of pending.values()) entry.reject(new Error('Bounce worker disposed'));
      pending.clear();
      worker.terminate();
    },
  };
}
