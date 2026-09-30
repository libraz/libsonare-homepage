import type { NmfWorkerRequest, NmfWorkerResponse } from './nmf.worker';

/** Small worker surface used by the client and its lifecycle tests. */
export interface NmfWorkerLike {
  onmessage: ((event: MessageEvent<NmfWorkerResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(message: NmfWorkerRequest, transfer?: Transferable[]): void;
  terminate(): void;
}

export interface NmfWorkerClientOptions {
  createWorker?: () => NmfWorkerLike;
}

export interface NmfWorkerClient {
  decompose(samples: Float32Array, sampleRate: number): Promise<Float32Array[]>;
  dispose(): void;
}

const COMPONENT_COUNT = 4;

class NmfSupersededError extends Error {
  constructor() {
    super('NMF request superseded');
    this.name = 'NmfSupersededError';
  }
}

function workerError(event: ErrorEvent): Error {
  return event.error instanceof Error
    ? event.error
    : new Error(event.message || 'NMF worker error');
}

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
  let worker: NmfWorkerLike | null = null;
  let disposed = false;
  let nextId = 0;
  let latestId = 0;
  let cache: {
    samples: Float32Array;
    sampleRate: number;
    components: Float32Array[];
  } | null = null;
  let pending: {
    id: number;
    samples: Float32Array;
    sampleRate: number;
    promise: Promise<Float32Array[]>;
    resolve: (components: Float32Array[]) => void;
    reject: (error: Error) => void;
  } | null = null;

  const makeWorker =
    options.createWorker ??
    (() => new Worker(new URL('./nmf.worker.ts', import.meta.url), { type: 'module' }));

  function rejectPending(error: Error): void {
    const current = pending;
    pending = null;
    current?.reject(error);
  }

  function invalidate(target: NmfWorkerLike, error: Error): void {
    if (worker !== target) return;
    worker = null;
    target.onmessage = null;
    target.onerror = null;
    target.terminate();
    rejectPending(error);
  }

  function ensureWorker(): NmfWorkerLike {
    if (disposed) throw new Error('NMF worker disposed');
    if (worker) return worker;
    const created = makeWorker();
    worker = created;
    created.onmessage = (event) => {
      if (worker !== created) return;
      const message = event.data;
      if (message.id !== latestId) return;
      const current = pending;
      if (!current || current.id !== message.id) return;
      pending = null;
      if (message.type === 'error') {
        current.reject(new Error(message.error));
        return;
      }
      try {
        const components = validateOutput(message.components, current.samples.length);
        cache = { samples: current.samples, sampleRate: current.sampleRate, components };
        current.resolve(components);
      } catch (error) {
        current.reject(error instanceof Error ? error : new Error(String(error)));
      }
    };
    created.onerror = (event) => invalidate(created, workerError(event));
    return created;
  }

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

      const id = ++nextId;
      latestId = id;
      rejectPending(new NmfSupersededError());
      let resolvePromise!: (components: Float32Array[]) => void;
      let rejectPromise!: (error: Error) => void;
      const promise = new Promise<Float32Array[]>((resolve, reject) => {
        resolvePromise = resolve;
        rejectPromise = reject;
      });
      const current = {
        id,
        samples,
        sampleRate,
        promise,
        resolve: resolvePromise,
        reject: rejectPromise,
      };
      pending = current;
      const copy = new Float32Array(samples);
      try {
        ensureWorker().postMessage({ type: 'decompose', id, samples: copy, sampleRate }, [
          copy.buffer,
        ]);
      } catch (error) {
        const cause = error instanceof Error ? error : new Error(String(error));
        if (worker) invalidate(worker, cause);
        else {
          pending = null;
          rejectPromise(cause);
        }
      }
      return promise;
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      latestId = ++nextId;
      const current = worker;
      worker = null;
      if (current) {
        current.onmessage = null;
        current.onerror = null;
        current.terminate();
      }
      rejectPending(new Error('NMF worker disposed'));
      cache = null;
    },
  };
}
