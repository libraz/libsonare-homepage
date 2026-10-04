import { createWorkerRpc, type WorkerLike } from '@/utils/workerRpc';
import type { TranscribeRequest, TranscribeResponse } from './transcribe.worker';
import type { TranscriptionRender } from './transcribePipeline';

export interface TranscribeWorkerClientOptions {
  createWorker?: () => WorkerLike;
}

export interface TranscribeWorkerClient {
  render(samples: Float32Array, sampleRate: number): Promise<TranscriptionRender>;
  dispose(): void;
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
  const rpc = createWorkerRpc<TranscribeRequest, TranscribeResponse>({
    name: 'Transcribe',
    latestOnly: true,
    create:
      options.createWorker ??
      (() => new Worker(new URL('./transcribe.worker.ts', import.meta.url), { type: 'module' })),
  });

  return {
    render(samples, sampleRate) {
      const copy = new Float32Array(samples);
      return rpc.run(
        { samples: copy, sampleRate },
        {
          transfer: [copy.buffer],
          pick: (message) =>
            message.type === 'done'
              ? {
                  events: message.events,
                  notes: message.notes,
                  noteCount: message.noteCount,
                  tempoBpm: message.tempoBpm,
                  sampleRate: message.sampleRate,
                  sourceDurationSec: message.sourceDurationSec,
                  pianoDurationSec: message.pianoDurationSec,
                  piano: message.piano,
                }
              : undefined,
        },
      ).result;
    },

    dispose() {
      rpc.dispose();
    },
  };
}
