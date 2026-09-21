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

/** Create a bounce client backed by a lazily replaceable dedicated worker. */
export function createBounceClient(): BounceClient {
  let worker: Worker | null = null;
  let disposed = false;
  let nextId = 0;
  const pending = new Map<
    number,
    { resolve: (r: BounceResult) => void; reject: (e: Error) => void }
  >();

  function rejectPending(err: Error) {
    for (const entry of pending.values()) entry.reject(err);
    pending.clear();
  }

  function invalidateWorker(target: Worker, err: Error) {
    if (worker !== target) return;
    worker = null;
    target.onmessage = null;
    target.onerror = null;
    target.terminate();
    rejectPending(err);
  }

  function ensureWorker(): Worker {
    if (disposed) throw new Error('Bounce worker disposed');
    if (worker) return worker;
    const created = new Worker(new URL('./bounce.worker.ts', import.meta.url), { type: 'module' });
    worker = created;
    created.onmessage = (event: MessageEvent<BounceResponse>) => {
      if (worker !== created) return;
      const res = event.data;
      const entry = pending.get(res.id);
      if (!entry) return;
      pending.delete(res.id);
      if ('error' in res) entry.reject(new Error(res.error));
      else entry.resolve({ pcm: res.pcm, version: res.version });
    };
    created.onerror = (event) => {
      invalidateWorker(created, new Error(event.message || 'Bounce worker error'));
    };
    return created;
  }

  return {
    bounce(payload) {
      const id = ++nextId;
      return new Promise<BounceResult>((resolve, reject) => {
        let current: Worker;
        try {
          current = ensureWorker();
          pending.set(id, { resolve, reject });
          current.postMessage({ id, ...payload } satisfies BounceRequest);
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          if (worker) invalidateWorker(worker, err);
          else reject(err);
        }
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      const current = worker;
      worker = null;
      if (current) {
        current.onmessage = null;
        current.onerror = null;
        current.terminate();
      }
      rejectPending(new Error('Bounce worker disposed'));
    },
  };
}
