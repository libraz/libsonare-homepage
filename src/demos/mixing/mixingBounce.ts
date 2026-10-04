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
import { createWorkerRpc, type DistributiveOmit, type WorkerJob } from '@/utils/workerRpc';

export type MixProgress = (progress: number, stage: MixWorkerStage) => void;

/** `result` settles after the audio is back in the registry; a cancel rejects with `WorkerJobCancelled`. */
export type MixJob<T> = WorkerJob<T>;

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

export function createMixWorkerClient(): MixWorkerClient {
  const rpc = createWorkerRpc<JobRequest, MixWorkerResponse>({
    create: () => new Worker(new URL('./mixing.worker.ts', import.meta.url), { type: 'module' }),
    name: 'Mix',
  });

  function run<T>(
    request: DistributiveOmit<JobRequest, 'id' | 'audio'>,
    registry: Map<number, MixAudio>,
    onProgress: MixProgress | undefined,
    pick: (message: MixWorkerResponse) => T | undefined,
  ): MixJob<T> {
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

    return rpc.run({ ...request, audio } as DistributiveOmit<JobRequest, 'id'>, {
      transfer,
      onProgress: (message) => onProgress?.(message.progress, message.stage),
      settle: (message) => {
        if (message.type === 'progress') return;
        for (const { trackId, channels, sampleRate } of message.audio) {
          registry.set(trackId, { channels, sampleRate });
        }
      },
      pick,
    });
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
    dispose: () => rpc.dispose(),
  };
}
