/**
 * Main-thread client for the transcription worker. Only the newest request
 * matters: loading other audio supersedes the run still in flight.
 */
import { createWorkerRpc, type WorkerJob } from '@/utils/workerRpc';
import type {
  TranscribeNotes,
  TranscribeRequest,
  TranscribeWorkerReply,
} from './transcribe.worker';

export interface TranscribeRendered {
  piano: Float32Array;
  smf: Uint8Array;
  version: string;
}

export interface TranscribeClient {
  /** `onNotes` fires once the notes exist; the job resolves when the piano is rendered. */
  run(
    request: Omit<TranscribeRequest, 'id' | 'type'>,
    onNotes: (notes: TranscribeNotes) => void,
  ): WorkerJob<TranscribeRendered>;
  dispose(): void;
}

export function createTranscribeClient(): TranscribeClient {
  const rpc = createWorkerRpc<TranscribeRequest, TranscribeWorkerReply>({
    name: 'Transcription',
    latestOnly: true,
    create: () =>
      new Worker(new URL('./transcribe.worker.ts', import.meta.url), { type: 'module' }),
  });
  return {
    run(request, onNotes) {
      return rpc.run(
        { type: 'transcribe', ...request },
        {
          onProgress: (message) => onNotes(message),
          pick: (message) =>
            message.type === 'done'
              ? { piano: message.piano, smf: message.smf, version: message.version }
              : undefined,
        },
      );
    },
    dispose: () => rpc.dispose(),
  };
}
