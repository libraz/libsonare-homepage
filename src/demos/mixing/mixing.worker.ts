/**
 * The /mixing Worker: export bounce, mix-assistant analysis, A/B loudness
 * measurement and the final meters, off the main thread. Track PCM arrives transferred (the page holds no
 * copy meanwhile) and goes back transferred in every terminal message, whether
 * the job finished, failed or was cancelled.
 *
 * The bounce builds a raw `RealtimeEngine` with the same ops the live facade
 * gets, so the export is the preview. Both engine calls are synchronous, so a
 * cancel takes effect at the next stage boundary.
 */

import { type MixSuggestion, mapMixSuggestion } from '@/demos/mixing/mixAssistantMap';
import { buildFull, exportFrames, MIX_TEMPO_BPM, type MixAudio } from '@/demos/mixing/mixingEngine';
import { clipPlayedSec, type MixingState } from '@/demos/mixing/mixingState';
import type { WavBounceOptions } from '@/utils/audio';
import { applyOps, createRawTarget } from '@/utils/engineApply';

type Wasm = typeof import('@/wasm/index.js');

/** Seconds of each track the assistant analyses, from the clip's start in the source. */
export const ASSISTANT_MAX_SECONDS = 60;
/** AudioWorklet render quantum; the export renders in the same blocks as the live engine. */
const RENDER_QUANTUM = 128;
// The engine rejects assistant input past 64 Mi Float32 samples in total (common.h).
const ASSISTANT_FLOAT_BUDGET = 64 * 1024 * 1024;

/** One track's audio as it crosses the Worker boundary. */
export interface MixAudioTransfer extends MixAudio {
  trackId: number;
}

export interface MixBounceResult {
  left: Float32Array;
  right: Float32Array;
  sampleRate: number;
  integratedLufs: number;
  loudnessRange: number;
  maxMomentaryLufs: number;
  maxShortTermLufs: number;
  truePeakDb: number;
}

export interface MixSuggestResult {
  suggestion: MixSuggestion;
  /** Seconds of each track that were analysed. */
  analyzedSec: number;
}

/** Integrated loudness of the A and B mixes over the measured window. */
export interface MixMatchResult {
  aLufs: number;
  bLufs: number;
}

export type MixWorkerStage = 'loading' | 'building' | 'rendering' | 'measuring' | 'analyzing';

export type MixWorkerRequest =
  | {
      type: 'bounce';
      id: number;
      state: MixingState;
      audio: MixAudioTransfer[];
      sampleRate: number;
      options: WavBounceOptions;
    }
  | {
      type: 'suggest';
      id: number;
      state: MixingState;
      audio: MixAudioTransfer[];
      sampleRate: number;
    }
  | {
      type: 'measureAB';
      id: number;
      stateA: MixingState;
      stateB: MixingState;
      audio: MixAudioTransfer[];
      sampleRate: number;
      windowSec: number;
    }
  | { type: 'cancel'; id: number };

export type MixWorkerResponse =
  | { type: 'progress'; id: number; progress: number; stage: MixWorkerStage }
  | { type: 'bounced'; id: number; result: MixBounceResult; audio: MixAudioTransfer[] }
  | { type: 'suggested'; id: number; result: MixSuggestResult; audio: MixAudioTransfer[] }
  | { type: 'measured'; id: number; result: MixMatchResult; audio: MixAudioTransfer[] }
  | { type: 'cancelled'; id: number; audio: MixAudioTransfer[] }
  | { type: 'error'; id: number; error: string; audio: MixAudioTransfer[] };

class Cancelled extends Error {}

function registry(audio: readonly MixAudioTransfer[]): Map<number, MixAudio> {
  return new Map(
    audio.map(({ trackId, channels, sampleRate }) => [trackId, { channels, sampleRate }]),
  );
}

/**
 * Builds `state` on a raw engine and bounces it to interleaved stereo, at most
 * `maxFrames` long; `checkpoint` runs between stages.
 */
function bounceInterleaved(
  wasm: Wasm,
  state: MixingState,
  audio: readonly MixAudioTransfer[],
  sampleRate: number,
  options: WavBounceOptions,
  maxFrames: number,
  checkpoint: (stage: MixWorkerStage, progress: number) => void,
): Float32Array {
  checkpoint('building', 0.1);
  const engine = new wasm.RealtimeEngine(sampleRate, RENDER_QUANTUM);
  try {
    engine.setTempo(MIX_TEMPO_BPM);
    applyOps(createRawTarget(engine), buildFull(state, registry(audio), sampleRate));
    const totalFrames = Math.min(maxFrames, exportFrames(state, sampleRate, engine));
    checkpoint('rendering', 0.2);
    engine.play();
    // The bounce settles parameter ramps without advancing processor state.
    return engine.bounceOffline({
      totalFrames,
      blockSize: RENDER_QUANTUM,
      numChannels: 2,
      dither: options.dither,
      ...(options.dither === 0 ? {} : { ditherBits: options.ditherBits }),
    }).interleaved;
  } finally {
    engine.destroy();
  }
}

/** Renders `state` the way the export does; `checkpoint` runs between stages. */
export function renderMixExport(
  wasm: Wasm,
  state: MixingState,
  audio: readonly MixAudioTransfer[],
  sampleRate: number,
  options: WavBounceOptions,
  checkpoint: (stage: MixWorkerStage, progress: number) => void = () => {},
): MixBounceResult {
  const interleaved = bounceInterleaved(
    wasm,
    state,
    audio,
    sampleRate,
    options,
    Number.POSITIVE_INFINITY,
    checkpoint,
  );
  checkpoint('measuring', 0.85);
  const frames = interleaved.length / 2;
  const left = new Float32Array(frames);
  const right = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    left[i] = interleaved[2 * i];
    right[i] = interleaved[2 * i + 1];
  }
  const loudness = wasm.lufsInterleaved(interleaved, 2, sampleRate);
  return {
    left,
    right,
    sampleRate,
    integratedLufs: loudness.integratedLufs,
    loudnessRange: loudness.loudnessRange,
    maxMomentaryLufs: loudness.maxMomentaryLufs,
    maxShortTermLufs: loudness.maxShortTermLufs,
    truePeakDb: Math.max(
      wasm.meteringTruePeakDb(left, sampleRate, 4),
      wasm.meteringTruePeakDb(right, sampleRate, 4),
    ),
  };
}

/**
 * Integrated loudness of the A and B mixes, each rendered undithered from the
 * arrangement start for `windowSec`: what a listener hears switching between them.
 */
export function measureAB(
  wasm: Wasm,
  stateA: MixingState,
  stateB: MixingState,
  audio: readonly MixAudioTransfer[],
  sampleRate: number,
  windowSec: number,
  checkpoint: (stage: MixWorkerStage, progress: number) => void = () => {},
): MixMatchResult {
  const maxFrames = Math.ceil(windowSec * sampleRate);
  const lufsOf = (state: MixingState, from: number, to: number) => {
    const interleaved = bounceInterleaved(
      wasm,
      state,
      audio,
      sampleRate,
      { dither: 0 },
      maxFrames,
      (stage, progress) => checkpoint(stage, from + progress * (to - from)),
    );
    return wasm.lufsInterleaved(interleaved, 2, sampleRate).integratedLufs;
  };
  const aLufs = lufsOf(stateA, 0, 0.5);
  return { aLufs, bLufs: lufsOf(stateB, 0.5, 1) };
}

/**
 * Seconds of each track to analyse: {@link ASSISTANT_MAX_SECONDS}, shortened
 * when that much of every track would exceed the engine's input budget.
 */
export function assistantWindowSec(audio: readonly MixAudioTransfer[], sampleRate: number): number {
  const channels = audio.reduce((sum, track) => sum + track.channels.length, 0);
  if (channels === 0) return ASSISTANT_MAX_SECONDS;
  return Math.min(
    ASSISTANT_MAX_SECONDS,
    Math.floor(ASSISTANT_FLOAT_BUDGET / (channels * sampleRate)),
  );
}

/** Runs the mix assistant over the played part of each loaded track and maps the result. */
export function suggestMix(
  wasm: Wasm,
  state: MixingState,
  audio: readonly MixAudioTransfer[],
  sampleRate: number,
  checkpoint: (stage: MixWorkerStage, progress: number) => void = () => {},
): MixSuggestResult {
  const windowSec = assistantWindowSec(audio, sampleRate);
  const sources = registry(audio);
  const tracks = state.tracks.flatMap((track) => {
    const source = sources.get(track.id);
    if (!source) return [];
    const start = Math.round(track.clip.trimStartSec * source.sampleRate);
    const end = start + Math.round(Math.min(windowSec, clipPlayedSec(track)) * source.sampleRate);
    const [left, right] = source.channels.map((channel) => channel.subarray(start, end));
    return [{ id: String(track.id), name: track.name, left, ...(right ? { right } : {}) }];
  });
  checkpoint('analyzing', 0.1);
  const result = wasm.suggestMixScene({ tracks, sampleRate });
  checkpoint('analyzing', 0.9);
  return {
    suggestion: mapMixSuggestion(result, state, (processor) =>
      wasm.masteringInsertParamInfo(processor),
    ),
    analyzedSec: windowSec,
  };
}

// ---------------------------------------------------------------------------
// Message loop

let wasmModule: Promise<Wasm> | null = null;
const cancelled = new Set<number>();

function loadWasm(): Promise<Wasm> {
  wasmModule ??= import('@/wasm/index.js').then(async (wasm) => {
    await wasm.init();
    return wasm;
  });
  return wasmModule;
}

function transferList(
  audio: readonly MixAudioTransfer[],
  extra: Float32Array[] = [],
): Transferable[] {
  const buffers = new Set<ArrayBufferLike>(
    [...audio.flatMap((track) => track.channels), ...extra].map((channel) => channel.buffer),
  );
  return [...buffers] as Transferable[];
}

function post(message: MixWorkerResponse, transfer: Transferable[] = []): void {
  self.postMessage(message, { transfer });
}

/** Lets a queued cancel message run, then honours it. */
async function checkpointAsync(id: number, stage: MixWorkerStage, progress: number): Promise<void> {
  post({ type: 'progress', id, progress, stage });
  await new Promise((resolve) => setTimeout(resolve, 0));
  if (cancelled.has(id)) throw new Cancelled();
}

function syncCheckpoint(id: number) {
  return (stage: MixWorkerStage, progress: number) => {
    post({ type: 'progress', id, progress, stage });
    if (cancelled.has(id)) throw new Cancelled();
  };
}

async function handle(request: Exclude<MixWorkerRequest, { type: 'cancel' }>): Promise<void> {
  const { id, audio } = request;
  try {
    await checkpointAsync(id, 'loading', 0.02);
    const wasm = await loadWasm();
    await checkpointAsync(id, 'building', 0.05);
    if (request.type === 'bounce') {
      const result = renderMixExport(
        wasm,
        request.state,
        audio,
        request.sampleRate,
        request.options,
        syncCheckpoint(id),
      );
      await checkpointAsync(id, 'measuring', 0.98);
      post(
        { type: 'bounced', id, result, audio },
        transferList(audio, [result.left, result.right]),
      );
    } else if (request.type === 'measureAB') {
      const result = measureAB(
        wasm,
        request.stateA,
        request.stateB,
        audio,
        request.sampleRate,
        request.windowSec,
        syncCheckpoint(id),
      );
      await checkpointAsync(id, 'measuring', 0.98);
      post({ type: 'measured', id, result, audio }, transferList(audio));
    } else {
      const result = suggestMix(wasm, request.state, audio, request.sampleRate, syncCheckpoint(id));
      await checkpointAsync(id, 'analyzing', 0.98);
      post({ type: 'suggested', id, result, audio }, transferList(audio));
    }
  } catch (error) {
    if (error instanceof Cancelled) {
      post({ type: 'cancelled', id, audio }, transferList(audio));
    } else {
      const message = error instanceof Error ? error.message : String(error);
      post({ type: 'error', id, error: message, audio }, transferList(audio));
    }
  } finally {
    cancelled.delete(id);
  }
}

self.onmessage = (event: MessageEvent<MixWorkerRequest>) => {
  const request = event.data;
  if (request.type === 'cancel') {
    cancelled.add(request.id);
    return;
  }
  void handle(request);
};
