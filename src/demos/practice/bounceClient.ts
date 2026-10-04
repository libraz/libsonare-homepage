/**
 * Main-thread client for the Piano Practice bounce worker.
 *
 * Wraps the worker in a promise-per-request API, and turns a
 * parsed movement into the flat, transferable payload the worker expects. Keeping
 * the payload builder pure makes the serialization independently testable.
 */
import { createWorkerRpc } from '@/utils/workerRpc';
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
  const rpc = createWorkerRpc<BounceRequest, BounceResponse>({
    name: 'Bounce',
    create: () => new Worker(new URL('./bounce.worker.ts', import.meta.url), { type: 'module' }),
  });
  return {
    bounce(payload) {
      return rpc.run(payload, {
        pick: (message) =>
          message.type === 'done' ? { pcm: message.pcm, version: message.version } : undefined,
      }).result;
    },
    dispose: () => rpc.dispose(),
  };
}
