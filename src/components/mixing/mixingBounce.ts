import type { MixingWorkerMessage } from '@/components/mixing/mixingTypes';
import type { MixingBounceResult, MixingTrackRenderState } from '@/workers/mixing.worker';

interface BounceRequest {
  sampleRate: number;
  masterFaderDb: number;
  tracks: MixingTrackRenderState[];
  reverb: { enabled: boolean; decaySec: number; preDelayMs: number };
  vcaGroups: Array<{ id: string; gainDb: number }>;
  onProgress: (progress: number, stage: string) => void;
}

export function createMixBounceController() {
  let worker: Worker | null = null;
  let requestId = 0;

  function dispose() {
    worker?.terminate();
    worker = null;
  }

  async function bounce(request: BounceRequest): Promise<MixingBounceResult> {
    if (!worker) {
      worker = new Worker(new URL('../../workers/mixing.worker.ts', import.meta.url), {
        type: 'module',
      });
    }

    const id = ++requestId;
    const transfer = request.tracks.flatMap((track) => [track.left.buffer, track.right.buffer]);

    return new Promise<MixingBounceResult>((resolve, reject) => {
      const onMessage = (event: MessageEvent<MixingWorkerMessage>) => {
        const message = event.data;
        if (message.id !== id) return;

        if (message.type === 'progress') {
          request.onProgress(message.progress, message.stage);
          return;
        }

        worker?.removeEventListener('message', onMessage);
        worker?.removeEventListener('error', onError);

        if (message.type === 'done') resolve(message.result);
        else reject(new Error(message.error));
      };

      const onError = (event: ErrorEvent) => {
        worker?.removeEventListener('message', onMessage);
        worker?.removeEventListener('error', onError);
        reject(event.error || new Error(event.message));
      };

      worker!.addEventListener('message', onMessage);
      worker!.addEventListener('error', onError);
      worker!.postMessage(
        {
          type: 'mixBounce',
          id,
          sampleRate: request.sampleRate,
          masterFaderDb: request.masterFaderDb,
          tracks: request.tracks,
          reverb: request.reverb,
          vcaGroups: request.vcaGroups,
        },
        transfer,
      );
    });
  }

  return { bounce, dispose };
}
