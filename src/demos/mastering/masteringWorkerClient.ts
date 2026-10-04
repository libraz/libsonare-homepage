/**
 * Typed client for the /mastering Worker. A job transfers the clips it needs
 * from the page's audio registry into the Worker, so while it runs those
 * arrays are detached (byteLength 0) and the page must not edit; when the job
 * settles, however it settles, the returned clips — and any the job produced
 * (the repaired program, the conformed reference, the rendered master) — are
 * put back into the same registry.
 */

import type {
  MasteringAssistantResult,
  MasteringAudioKey,
  MasteringAudioTransfer,
  MasteringExportResult,
  MasteringMeasureResult,
  MasteringPlatformPreviewRow,
  MasteringPrepareResult,
  MasteringReferenceResult,
  MasteringWorkerRequest,
  MasteringWorkerResponse,
  MasteringWorkerStage,
} from '@/demos/mastering/mastering.worker';
import type { MasteringClip } from '@/demos/mastering/masteringEngine';
import type { LoudnessFitResult } from '@/demos/mastering/masteringLoudnessFit';
import type { MasteringRepair, MasteringState } from '@/demos/mastering/masteringState';
import type { MasteringAssistantPreset } from '@/demos/mastering/useMastering';
import type { WavBounceOptions } from '@/utils/audio';
import { createWorkerRpc, type DistributiveOmit, type WorkerJob } from '@/utils/workerRpc';
import type { StreamingPlatform } from '@/wasm/index.js';

/** The page's clips by role; the only place PCM lives on the main thread. */
export type MasteringAudioRegistry = Map<MasteringAudioKey, MasteringClip>;

export type MasteringProgress = (progress: number, stage: MasteringWorkerStage) => void;

/** `result` settles after the audio is back in the registry; a cancel rejects with `WorkerJobCancelled`. */
export type MasteringJob<T> = WorkerJob<T>;

export interface MasteringWorkerClient {
  /** Runs the repair stages over `source`; the registry gains `program`. */
  prepare(
    registry: MasteringAudioRegistry,
    repair: MasteringRepair,
    onProgress?: MasteringProgress,
  ): MasteringJob<MasteringPrepareResult>;
  /** Fits the drive slot to the target; write the result back with `applyLoudnessFit`. */
  fit(
    registry: MasteringAudioRegistry,
    state: MasteringState,
    onProgress?: MasteringProgress,
  ): MasteringJob<LoudnessFitResult>;
  /** Loudness of the program and of `state` rendered over it; the program clip comes back measured. */
  measure(
    registry: MasteringAudioRegistry,
    state: MasteringState,
    onProgress?: MasteringProgress,
  ): MasteringJob<MasteringMeasureResult>;
  /** Renders the export (refitting first when `refit`); the registry gains `master`. */
  bounce(
    registry: MasteringAudioRegistry,
    state: MasteringState,
    options: WavBounceOptions,
    refit: boolean,
    onProgress?: MasteringProgress,
  ): MasteringJob<MasteringExportResult>;
  /** Profile and chain suggestion of the program. */
  assist(
    registry: MasteringAudioRegistry,
    preset?: MasteringAssistantPreset,
    onProgress?: MasteringProgress,
  ): MasteringJob<MasteringAssistantResult>;
  /** Conforms `reference` to the program rate and compares the two. */
  analyzeReference(
    registry: MasteringAudioRegistry,
    onProgress?: MasteringProgress,
  ): MasteringJob<MasteringReferenceResult>;
  /** Delivery estimate of the rendered `master` per platform. */
  previewPlatforms(
    registry: MasteringAudioRegistry,
    platforms: StreamingPlatform[],
    onProgress?: MasteringProgress,
  ): MasteringJob<MasteringPlatformPreviewRow[]>;
  /** Terminates the Worker; a running job rejects and its transferred audio is lost. */
  dispose(): void;
}

type JobRequest = Exclude<MasteringWorkerRequest, { type: 'cancel' }>;

function transferList(audio: MasteringAudioTransfer): Transferable[] {
  const buffers = new Set<ArrayBufferLike>(
    Object.values(audio).flatMap((clip) => (clip ? [clip.left.buffer, clip.right.buffer] : [])),
  );
  return [...buffers] as Transferable[];
}

export function createMasteringWorkerClient(): MasteringWorkerClient {
  const rpc = createWorkerRpc<JobRequest, MasteringWorkerResponse>({
    create: () => new Worker(new URL('./mastering.worker.ts', import.meta.url), { type: 'module' }),
    name: 'Mastering',
  });

  function run<T>(
    request: DistributiveOmit<JobRequest, 'id' | 'audio'>,
    registry: MasteringAudioRegistry,
    keys: readonly MasteringAudioKey[],
    onProgress: MasteringProgress | undefined,
    pick: (message: MasteringWorkerResponse) => T | undefined,
  ): MasteringJob<T> {
    const audio: MasteringAudioTransfer = {};
    for (const key of keys) {
      const clip = registry.get(key);
      if (clip) audio[key] = clip;
    }
    return rpc.run({ ...request, audio } as DistributiveOmit<JobRequest, 'id'>, {
      transfer: transferList(audio),
      onProgress: (message) => onProgress?.(message.progress, message.stage),
      settle: (message) => {
        if (message.type === 'progress') return;
        for (const [key, clip] of Object.entries(message.audio) as [
          MasteringAudioKey,
          MasteringClip,
        ][]) {
          registry.set(key, clip);
        }
      },
      pick,
    });
  }

  return {
    prepare: (registry, repair, onProgress) =>
      run({ type: 'prepare', repair }, registry, ['source'], onProgress, (message) =>
        message.type === 'prepared' ? message.result : undefined,
      ),
    fit: (registry, state, onProgress) =>
      run({ type: 'fit', state }, registry, ['program'], onProgress, (message) =>
        message.type === 'fitted' ? message.result : undefined,
      ),
    measure: (registry, state, onProgress) =>
      run({ type: 'measure', state }, registry, ['program'], onProgress, (message) =>
        message.type === 'measured' ? message.result : undefined,
      ),
    bounce: (registry, state, options, refit, onProgress) =>
      run(
        { type: 'export', state, options, refit },
        registry,
        ['program'],
        onProgress,
        (message) => (message.type === 'exported' ? message.result : undefined),
      ),
    assist: (registry, preset, onProgress) =>
      run(
        { type: 'assistant', ...(preset ? { preset } : {}) },
        registry,
        ['program'],
        onProgress,
        (message) => (message.type === 'assisted' ? message.result : undefined),
      ),
    analyzeReference: (registry, onProgress) =>
      run({ type: 'reference' }, registry, ['program', 'reference'], onProgress, (message) =>
        message.type === 'referenced' ? message.result : undefined,
      ),
    previewPlatforms: (registry, platforms, onProgress) =>
      run({ type: 'platformPreview', platforms }, registry, ['master'], onProgress, (message) =>
        message.type === 'previewed' ? message.result : undefined,
      ),
    dispose: () => rpc.dispose(),
  };
}
