import type { RenderNote } from '@/demos/spatial/renderNotes';
import type { ScanResult, WorkerRequest } from '@/demos/spatial/spatial.worker';
import { createWorkerRpc, type WorkerRpc } from '@/utils/workerRpc';

/** Replies `spatial.worker.ts` sends; errors carry `error: string` per the shared protocol. */
export type SpatialReply =
  | { type: 'progress'; id: number; stage: string; value: number }
  | { type: 'done'; id: number; result: ScanResult }
  | {
      type: 'morphDone';
      id: number;
      left: Float32Array;
      right: Float32Array;
      sampleRate: number;
      notes: RenderNote[];
    }
  | { type: 'error'; id: number; error: string };

/** One Worker running `spatial.worker.ts`; each composable owns its own. */
export function createSpatialRpc(
  options: { latestOnly?: boolean } = {},
): WorkerRpc<WorkerRequest, SpatialReply> {
  return createWorkerRpc<WorkerRequest, SpatialReply>({
    create: () => new Worker(new URL('./spatial.worker.ts', import.meta.url), { type: 'module' }),
    name: 'spatial',
    latestOnly: options.latestOnly,
  });
}
