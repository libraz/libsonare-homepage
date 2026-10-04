/**
 * Main-thread client for the music-analysis worker.
 *
 * The analysis is one synchronous WASM call the worker cannot interrupt, so
 * stopping a running analysis means `dispose()`; callers create a new client for
 * the next one.
 */
import { createWorkerRpc } from '@/utils/workerRpc';
import type {
  AnalyzeRequest,
  MusicAnalysisWorkerReply,
  MusicAnalysisWorkerResult,
} from './music-analysis.worker';

export interface MusicAnalysisClient {
  /** Runs one analysis; `transfer` lists the buffers handed to the worker. */
  analyze(
    request: Omit<AnalyzeRequest, 'id' | 'type'>,
    transfer: Transferable[],
    onProgress: (progress: number, stage: string) => void,
  ): Promise<MusicAnalysisWorkerResult>;
  dispose(): void;
}

export function createMusicAnalysisClient(): MusicAnalysisClient {
  const rpc = createWorkerRpc<AnalyzeRequest, MusicAnalysisWorkerReply>({
    name: 'Music analysis',
    create: () =>
      new Worker(new URL('./music-analysis.worker.ts', import.meta.url), { type: 'module' }),
  });
  return {
    analyze(request, transfer, onProgress) {
      return rpc.run(
        { type: 'analyze', ...request },
        {
          transfer,
          onProgress: (message) => onProgress(message.progress, message.stage),
          pick: (message) => (message.type === 'done' ? message.result : undefined),
        },
      ).result;
    },
    dispose: () => rpc.dispose(),
  };
}
