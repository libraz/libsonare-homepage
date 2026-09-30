import type { TranscribeRequest, TranscribeResponse } from './transcribe.worker';
import type { TranscriptionRender } from './transcribePipeline';

/** Small worker surface used by the client and by its lifecycle tests. */
export interface TranscribeWorkerLike {
  onmessage: ((event: MessageEvent<TranscribeResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(message: TranscribeRequest, transfer?: Transferable[]): void;
  terminate(): void;
}

export interface TranscribeWorkerClientOptions {
  createWorker?: () => TranscribeWorkerLike;
}

export interface TranscribeWorkerClient {
  render(samples: Float32Array, sampleRate: number): Promise<TranscriptionRender>;
  dispose(): void;
}

class TranscribeSupersededError extends Error {
  constructor() {
    super('Transcription request superseded');
    this.name = 'TranscribeSupersededError';
  }
}

function workerError(event: ErrorEvent): Error {
  return event.error instanceof Error
    ? event.error
    : new Error(event.message || 'Transcribe worker error');
}

/**
 * Promise-based worker client with one active render at a time.
 *
 * A new render supersedes the previous one. Terminating the client rejects the
 * pending promise so an unmounted component cannot leave an unresolved await.
 */
export function createTranscribeWorkerClient(
  options: TranscribeWorkerClientOptions = {},
): TranscribeWorkerClient {
  let worker: TranscribeWorkerLike | null = null;
  let disposed = false;
  let nextId = 0;
  let latestId = 0;
  let pending: {
    id: number;
    resolve: (result: TranscriptionRender) => void;
    reject: (error: Error) => void;
  } | null = null;

  const makeWorker =
    options.createWorker ??
    (() => new Worker(new URL('./transcribe.worker.ts', import.meta.url), { type: 'module' }));

  function rejectPending(error: Error): void {
    const current = pending;
    pending = null;
    current?.reject(error);
  }

  function invalidate(target: TranscribeWorkerLike, error: Error): void {
    if (worker !== target) return;
    worker = null;
    target.onmessage = null;
    target.onerror = null;
    target.terminate();
    rejectPending(error);
  }

  function ensureWorker(): TranscribeWorkerLike {
    if (disposed) throw new Error('Transcribe worker disposed');
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
      current.resolve({
        events: message.events,
        notes: message.notes,
        noteCount: message.noteCount,
        tempoBpm: message.tempoBpm,
        sampleRate: message.sampleRate,
        sourceDurationSec: message.sourceDurationSec,
        pianoDurationSec: message.pianoDurationSec,
        piano: message.piano,
      });
    };
    created.onerror = (event) => invalidate(created, workerError(event));
    return created;
  }

  return {
    render(samples, sampleRate) {
      if (disposed) return Promise.reject(new Error('Transcribe worker disposed'));
      const id = ++nextId;
      latestId = id;
      rejectPending(new TranscribeSupersededError());
      const copy = new Float32Array(samples);

      return new Promise<TranscriptionRender>((resolve, reject) => {
        pending = { id, resolve, reject };
        try {
          ensureWorker().postMessage({ id, samples: copy, sampleRate }, [copy.buffer]);
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          if (worker) invalidate(worker, err);
          else {
            pending = null;
            reject(err);
          }
        }
      });
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
      rejectPending(new Error('Transcribe worker disposed'));
    },
  };
}
