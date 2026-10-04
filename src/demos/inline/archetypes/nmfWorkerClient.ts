import { createWorkerRpc, type WorkerLike } from '@/utils/workerRpc';
import type { NmfWorkerRequest, NmfWorkerResponse } from './nmf.worker';

export interface NmfWorkerClientOptions {
  createWorker?: () => WorkerLike;
}

export interface NmfWorkerClient {
  decompose(samples: Float32Array, sampleRate: number): Promise<Float32Array[]>;
  dispose(): void;
}

const COMPONENT_COUNT = 4;

function validateInput(samples: Float32Array, sampleRate: number): void {
  if (samples.length === 0) throw new Error('NMF source is empty');
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new Error(`NMF source has invalid sample rate: ${sampleRate}`);
  }
}

function validateOutput(components: Float32Array[], sourceLength: number): Float32Array[] {
  if (
    components.length !== COMPONENT_COUNT ||
    components.some(
      (component) =>
        !(component instanceof Float32Array) ||
        component.length !== sourceLength ||
        Array.from(component).some((sample) => !Number.isFinite(sample)),
    )
  ) {
    throw new Error('NMF worker returned an unexpected component shape');
  }
  return components;
}

/**
 * Lazily create one worker for a component lifecycle and cache all four
 * components for the source reference. The source is copied before its buffer
 * is transferred, so callers retain their original PCM for later playback and
 * for cache identity.
 */
export function createNmfWorkerClient(options: NmfWorkerClientOptions = {}): NmfWorkerClient {
  const rpc = createWorkerRpc<NmfWorkerRequest, NmfWorkerResponse>({
    name: 'NMF',
    latestOnly: true,
    create:
      options.createWorker ??
      (() => new Worker(new URL('./nmf.worker.ts', import.meta.url), { type: 'module' })),
  });
  let disposed = false;
  let cache: {
    samples: Float32Array;
    sampleRate: number;
    components: Float32Array[];
  } | null = null;
  let pending: {
    samples: Float32Array;
    sampleRate: number;
    promise: Promise<Float32Array[]>;
  } | null = null;

  return {
    decompose(samples, sampleRate) {
      if (disposed) return Promise.reject(new Error('NMF worker disposed'));
      try {
        validateInput(samples, sampleRate);
      } catch (error) {
        return Promise.reject(error instanceof Error ? error : new Error(String(error)));
      }

      if (cache?.samples === samples && cache.sampleRate === sampleRate) {
        return Promise.resolve(cache.components);
      }
      if (pending?.samples === samples && pending.sampleRate === sampleRate) {
        return pending.promise;
      }

      const copy = new Float32Array(samples);
      const promise = rpc
        .run(
          { type: 'decompose', samples: copy, sampleRate },
          {
            transfer: [copy.buffer],
            pick: (message) =>
              message.type === 'done'
                ? validateOutput(message.components, samples.length)
                : undefined,
          },
        )
        .result.then((components) => {
          cache = { samples, sampleRate, components };
          return components;
        });
      const current = { samples, sampleRate, promise };
      pending = current;
      const clear = () => {
        if (pending === current) pending = null;
      };
      promise.then(clear, clear);
      return promise;
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      rpc.dispose();
      cache = null;
      pending = null;
    },
  };
}
