/**
 * Typed client for the /mixing Worker. A job transfers the PCM of every loaded
 * track into the Worker, so while it runs the registry's arrays are detached
 * (byteLength 0) and the page must not edit; when the job settles, however it
 * settles, the returned arrays are put back into the same registry.
 */

import type {
  MixAudioTransfer,
  MixBounceResult,
  MixMatchResult,
  MixSuggestResult,
  MixWorkerRequest,
  MixWorkerResponse,
  MixWorkerStage,
} from '@/demos/mixing/mixing.worker';
import type { MixAudio } from '@/demos/mixing/mixingEngine';
import type { MixingState } from '@/demos/mixing/mixingState';
import type { WavBounceOptions } from '@/utils/audio';

/** Rejection reason of a job stopped by {@link MixJob.cancel}. */
export class MixJobCancelled extends Error {
  constructor() {
    super('Mix job cancelled');
    this.name = 'MixJobCancelled';
  }
}

export type MixProgress = (progress: number, stage: MixWorkerStage) => void;

export interface MixJob<T> {
  /** Settles after the audio is back in the registry. */
  result: Promise<T>;
  /** Asks the Worker to stop at its next stage boundary; the job then rejects with {@link MixJobCancelled}. */
  cancel(): void;
}

export interface MixWorkerClient {
  bounce(
    state: MixingState,
    audio: Map<number, MixAudio>,
    sampleRate: number,
    options: WavBounceOptions,
    onProgress?: MixProgress,
  ): MixJob<MixBounceResult>;
  suggest(
    state: MixingState,
    audio: Map<number, MixAudio>,
    sampleRate: number,
    onProgress?: MixProgress,
  ): MixJob<MixSuggestResult>;
  /** Renders both mixes over `windowSec` and measures their integrated loudness. */
  measureAB(
    stateA: MixingState,
    stateB: MixingState,
    audio: Map<number, MixAudio>,
    sampleRate: number,
    windowSec: number,
    onProgress?: MixProgress,
  ): MixJob<MixMatchResult>;
  /** Terminates the Worker; a running job rejects and its transferred audio is lost. */
  dispose(): void;
}

type JobRequest = Extract<MixWorkerRequest, { type: 'bounce' | 'suggest' | 'measureAB' }>;
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export function createMixWorkerClient(): MixWorkerClient {
  let worker: Worker | null = null;
  let requestId = 0;
  const pendingRejects = new Set<(reason: unknown) => void>();

  function ensureWorker(): Worker {
    worker ??= new Worker(new URL('./mixing.worker.ts', import.meta.url), { type: 'module' });
    return worker;
  }

  function run<T>(
    request: DistributiveOmit<JobRequest, 'id' | 'audio'>,
    registry: Map<number, MixAudio>,
    onProgress: MixProgress | undefined,
    pick: (message: MixWorkerResponse) => T | undefined,
  ): MixJob<T> {
    const id = ++requestId;
    const target = ensureWorker();
    const trackIds = new Set(
      (request.type === 'measureAB' ? request.stateA : request.state).tracks.map(
        (track) => track.id,
      ),
    );
    const audio: MixAudioTransfer[] = [...registry]
      .filter(([trackId]) => trackIds.has(trackId))
      .map(([trackId, entry]) => ({ trackId, ...entry }));
    const transfer = [
      ...new Set(audio.flatMap((track) => track.channels.map((channel) => channel.buffer))),
    ] as Transferable[];

    const result = new Promise<T>((resolve, reject) => {
      const settle = () => {
        target.removeEventListener('message', onMessage);
        target.removeEventListener('error', onError);
        pendingRejects.delete(reject);
      };
      const onMessage = (event: MessageEvent<MixWorkerResponse>) => {
        const message = event.data;
        if (message.id !== id) return;
        if (message.type === 'progress') {
          onProgress?.(message.progress, message.stage);
          return;
        }
        settle();
        for (const { trackId, channels, sampleRate } of message.audio) {
          registry.set(trackId, { channels, sampleRate });
        }
        const value = pick(message);
        if (value !== undefined) resolve(value);
        else if (message.type === 'cancelled') reject(new MixJobCancelled());
        else if (message.type === 'error') reject(new Error(message.error));
        else reject(new Error(`unexpected ${message.type} reply`));
      };
      const onError = (event: ErrorEvent) => {
        settle();
        reject(event.error ?? new Error(event.message));
      };
      pendingRejects.add(reject);
      target.addEventListener('message', onMessage);
      target.addEventListener('error', onError);
      target.postMessage({ ...request, id, audio } as MixWorkerRequest, transfer);
    });
    return {
      result,
      cancel: () => target.postMessage({ type: 'cancel', id } satisfies MixWorkerRequest),
    };
  }

  return {
    bounce: (state, audio, sampleRate, options, onProgress) =>
      run({ type: 'bounce', state, sampleRate, options }, audio, onProgress, (message) =>
        message.type === 'bounced' ? message.result : undefined,
      ),
    suggest: (state, audio, sampleRate, onProgress) =>
      run({ type: 'suggest', state, sampleRate }, audio, onProgress, (message) =>
        message.type === 'suggested' ? message.result : undefined,
      ),
    measureAB: (stateA, stateB, audio, sampleRate, windowSec, onProgress) =>
      run(
        { type: 'measureAB', stateA, stateB, sampleRate, windowSec },
        audio,
        onProgress,
        (message) => (message.type === 'measured' ? message.result : undefined),
      ),
    dispose() {
      // Terminating fires no message or error event, so in-flight jobs settle here.
      for (const reject of pendingRejects) reject(new Error('Mix worker disposed'));
      pendingRejects.clear();
      worker?.terminate();
      worker = null;
    },
  };
}
