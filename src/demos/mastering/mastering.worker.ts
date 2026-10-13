/**
 * The /mastering Worker: repair detection and preprocess, loudness fit, export
 * bounce, the lane loudness the A/B match needs, the assistant, reference
 * analysis and the platform preview, off the main thread. The clips a job needs arrive transferred (the page holds no copy
 * meanwhile) and go back transferred in every terminal message — finished,
 * failed or cancelled — together with any clip the job produced.
 *
 * Fit and export render the export variant of the project on a raw
 * `RealtimeEngine` with the same ops the live facade gets, so the export is
 * the preview. Engine calls are synchronous, so a cancel takes effect at the
 * next stage boundary.
 */

import {
  fitMasteringLoudness,
  interleave,
  type MasteringClip,
  measureLufs,
  prepareProgram,
  renderMasteringState,
} from '@/demos/mastering/masteringEngine';
import type { LoudnessFitResult } from '@/demos/mastering/masteringLoudnessFit';
import { fitMatchEqPeaks, type MatchEqFit } from '@/demos/mastering/masteringPresetMap';
import {
  type MasteringParams,
  type MasteringRepair,
  type MasteringRepairStage,
  type MasteringState,
  masteringMutators,
  unmappedChainParams,
} from '@/demos/mastering/masteringState';
import type { MasteringAssistantPreset } from '@/demos/mastering/useMastering';
import type { WavBounceOptions } from '@/utils/audio';
import type {
  MasteringAudioProfileDefects,
  MasteringRepairStage as MasteringRepairRequest,
  StreamingPlatform,
} from '@/wasm/index.js';

type Wasm = typeof import('@/wasm/index.js');

/** Clips a job can carry, by role. `master` is the last export render. */
export type MasteringAudioKey = 'source' | 'program' | 'reference' | 'master';
/** The clips crossing the Worker boundary for one job. */
export type MasteringAudioTransfer = Partial<Record<MasteringAudioKey, MasteringClip>>;

export type MasteringWorkerStage =
  | 'loading'
  | 'repairing'
  | 'fitting'
  | 'rendering'
  | 'measuring'
  | 'analyzing';

/** What `masteringRepairAnalyze` found in the source and which stages it recommends. */
export interface MasteringRepairDetection {
  /** Recommended stages with every setting, as the project state stores them. */
  recommended: Partial<Record<MasteringRepairStage, MasteringParams>>;
  /** The channels' defects, aggregated as the stereo profile aggregates them. */
  defects: MasteringAudioProfileDefects;
  /** False when clipping was found but a declip at its level would rewrite unclipped audio. */
  declipThresholdSafe: boolean;
}

export interface MasteringPrepareResult {
  /** Repair stages that ran, in chain order; empty when the program is the source. */
  stages: MasteringRepairStage[];
}

export interface MasteringExportResult {
  /** The fit run before the bounce, when the request asked to refit. */
  fit: LoudnessFitResult | null;
  integratedLufs: number;
  loudnessRange: number;
  maxMomentaryLufs: number;
  maxShortTermLufs: number;
  truePeakDb: number;
  /** Short-term (3 s) loudness series, one point per 100 ms block. */
  shortTermLufs: Float32Array;
}

/** Integrated loudness of the Before lane (the program) and the After lane (lane 1's output). */
export interface MasteringMeasureResult {
  programLufs: number;
  afterLufs: number;
}

export interface MasteringAssistantResult {
  profile: unknown;
  suggestions: unknown;
  /** Flat chain config from `masteringAssistantSuggestChainStereo`. */
  chainParams: Record<string, number | boolean>;
  /** Keys of `chainParams` the project state cannot carry. */
  unmapped: string[];
}

export interface MasteringReferenceResult {
  loudness: { sourceLufs: number; referenceLufs: number; gainToMatchDb: number };
  tonalBalance: unknown;
  monoCompatibility: unknown;
  matchEq: MatchEqFit;
}

export interface MasteringPlatformPreviewRow extends Record<string, unknown> {
  name: string;
  targetLufs?: number;
  ceilingDb?: number;
}

export type MasteringWorkerRequest =
  | { type: 'detectRepair'; id: number; audio: MasteringAudioTransfer }
  | { type: 'prepare'; id: number; audio: MasteringAudioTransfer; repair: MasteringRepair }
  | { type: 'fit'; id: number; audio: MasteringAudioTransfer; state: MasteringState }
  | { type: 'measure'; id: number; audio: MasteringAudioTransfer; state: MasteringState }
  | {
      type: 'export';
      id: number;
      audio: MasteringAudioTransfer;
      state: MasteringState;
      options: WavBounceOptions;
      /** Fit the drive first and render with it (the state's fit is stale). */
      refit: boolean;
    }
  | {
      type: 'assistant';
      id: number;
      audio: MasteringAudioTransfer;
      preset?: MasteringAssistantPreset;
    }
  | { type: 'reference'; id: number; audio: MasteringAudioTransfer }
  | {
      type: 'platformPreview';
      id: number;
      audio: MasteringAudioTransfer;
      platforms: StreamingPlatform[];
    }
  | { type: 'cancel'; id: number };

type JobRequest = Exclude<MasteringWorkerRequest, { type: 'cancel' }>;

export type MasteringWorkerResponse =
  | { type: 'progress'; id: number; progress: number; stage: MasteringWorkerStage }
  | {
      type: 'repairDetected';
      id: number;
      result: MasteringRepairDetection;
      audio: MasteringAudioTransfer;
    }
  | { type: 'prepared'; id: number; result: MasteringPrepareResult; audio: MasteringAudioTransfer }
  | { type: 'fitted'; id: number; result: LoudnessFitResult; audio: MasteringAudioTransfer }
  | { type: 'measured'; id: number; result: MasteringMeasureResult; audio: MasteringAudioTransfer }
  | { type: 'exported'; id: number; result: MasteringExportResult; audio: MasteringAudioTransfer }
  | {
      type: 'assisted';
      id: number;
      result: MasteringAssistantResult;
      audio: MasteringAudioTransfer;
    }
  | {
      type: 'referenced';
      id: number;
      result: MasteringReferenceResult;
      audio: MasteringAudioTransfer;
    }
  | {
      type: 'previewed';
      id: number;
      result: MasteringPlatformPreviewRow[];
      audio: MasteringAudioTransfer;
    }
  | { type: 'cancelled'; id: number; audio: MasteringAudioTransfer }
  | { type: 'error'; id: number; error: string; audio: MasteringAudioTransfer };

/** Called between stages; throws to stop the job. */
export type MasteringCheckpoint = (
  stage: MasteringWorkerStage,
  progress: number,
) => void | Promise<void>;

/** Checkpoints the loudness fit before each of its bounces. */
function fitCheckpoint(checkpoint: MasteringCheckpoint) {
  return (index: number) => checkpoint('fitting', 0.1 + 0.25 * index);
}

function requireClip(audio: MasteringAudioTransfer, key: MasteringAudioKey): MasteringClip {
  const clip = audio[key];
  if (!clip) throw new Error(`the ${key} audio is not loaded`);
  return clip;
}

/** Renders the export with dither and measures it; refits first when asked. */
export async function exportMaster(
  wasm: Wasm,
  state: MasteringState,
  program: MasteringClip,
  options: WavBounceOptions,
  refit: boolean,
  checkpoint: MasteringCheckpoint = () => {},
): Promise<{ result: MasteringExportResult; master: MasteringClip }> {
  const fit = refit
    ? await fitMasteringLoudness(wasm, state, program, fitCheckpoint(checkpoint))
    : null;
  const rendered = fit ? masteringMutators.applyLoudnessFit(state, fit) : state;
  await checkpoint('rendering', 0.85);
  const master = renderMasteringState(wasm, rendered, program, options);
  await checkpoint('measuring', 0.92);
  const interleaved = interleave(master.left, master.right);
  const loudness = wasm.lufsInterleaved(interleaved, 2, master.sampleRate);
  const series = wasm.lufsSeriesInterleaved(interleaved, 2, master.sampleRate);
  return {
    result: {
      fit,
      integratedLufs: loudness.integratedLufs,
      loudnessRange: loudness.loudnessRange,
      maxMomentaryLufs: loudness.maxMomentaryLufs,
      maxShortTermLufs: loudness.maxShortTermLufs,
      truePeakDb: Math.max(
        wasm.meteringTruePeakDb(master.left, master.sampleRate, 4),
        wasm.meteringTruePeakDb(master.right, master.sampleRate, 4),
      ),
      shortTermLufs: series.shortTerm,
    },
    master: { ...master, integratedLufs: loudness.integratedLufs },
  };
}

/** Loudness of the program and of the export render of `state` over it. */
export async function measureLanes(
  wasm: Wasm,
  state: MasteringState,
  program: MasteringClip,
  checkpoint: MasteringCheckpoint = () => {},
): Promise<MasteringMeasureResult> {
  const programLufs = Number.isFinite(program.integratedLufs)
    ? program.integratedLufs
    : measureLufs(wasm, program.left, program.right, program.sampleRate);
  await checkpoint('rendering', 0.2);
  const render = renderMasteringState(wasm, state, program);
  await checkpoint('measuring', 0.9);
  return {
    programLufs,
    afterLufs: measureLufs(wasm, render.left, render.right, render.sampleRate),
  };
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/**
 * A recommended stage's settings as numbers and switches: an enum the engine
 * names by choice is stored as the choice's wire value, which it also takes.
 */
function repairParams(wasm: Wasm, recommended: MasteringRepairRequest): MasteringParams {
  const { stage, ...settings } = recommended;
  const catalog = wasm.capabilityCatalog();
  const processor = catalog.chain.stages.find((entry) => entry.prefix === `repair.${stage}`);
  const params = catalog.processors.find((entry) => entry.id === processor?.processor)?.params;
  const wireValue = (name: string, choice: string) =>
    Number(params?.find((p) => p.name === name)?.choices?.find((c) => c.name === choice)?.value);
  return Object.fromEntries(
    Object.entries(settings).map(([name, value]) => [
      name,
      typeof value === 'string' ? wireValue(name, value) : value,
    ]),
  );
}

/** The engine's repair measurement of the source and the stages it recommends. */
export function detectRepair(wasm: Wasm, source: MasteringClip): MasteringRepairDetection {
  const analysis = wasm.masteringRepairAnalyze({
    channels: [source.left, source.right],
    sampleRate: source.sampleRate,
  });
  return {
    recommended: Object.fromEntries(
      analysis.recommended.map((entry) => [entry.stage, repairParams(wasm, entry)]),
    ),
    defects: analysis.defects,
    declipThresholdSafe: analysis.declipThresholdSafe,
  };
}

/** Profile, suggestion and flat chain suggestion of the program. */
export function assistProgram(
  wasm: Wasm,
  program: MasteringClip,
  preset?: MasteringAssistantPreset,
): MasteringAssistantResult {
  const request = {
    left: program.left,
    right: program.right,
    sampleRate: program.sampleRate,
    ...(preset ? { params: { preset } } : {}),
  };
  const profile = parseJson(
    wasm.masteringAudioProfileStereo({
      left: program.left,
      right: program.right,
      sampleRate: program.sampleRate,
    }),
  );
  const suggestions = parseJson(wasm.masteringAssistantSuggestStereo(request));
  const chainParams = wasm.masteringAssistantSuggestChainStereo(request);
  return { profile, suggestions, chainParams, unmapped: unmappedChainParams(chainParams) };
}

/**
 * The two-input `match.*` analyses are mono-only, so they take a downmix. Keep
 * a coherent average, but fall back to the stronger channel when stereo phase
 * cancellation would otherwise turn the pair into silence.
 */
function mixToMono(left: Float32Array, right: Float32Array): Float32Array {
  const length = Math.min(left.length, right.length);
  const mono = new Float32Array(length);
  let monoEnergy = 0;
  let leftEnergy = 0;
  let rightEnergy = 0;
  for (let i = 0; i < length; i++) {
    const sample = (left[i] + right[i]) * 0.5;
    mono[i] = sample;
    monoEnergy += sample * sample;
    leftEnergy += left[i] * left[i];
    rightEnergy += right[i] * right[i];
  }
  const strongerEnergy = Math.max(leftEnergy, rightEnergy);
  if (strongerEnergy > 0 && monoEnergy < strongerEnergy * 0.0625) {
    return (leftEnergy >= rightEnergy ? left : right).slice(0, length);
  }
  return mono;
}

/** The reference with its loudness measured at its own rate. */
export function measureReference(wasm: Wasm, reference: MasteringClip): MasteringClip {
  return {
    ...reference,
    integratedLufs: measureLufs(wasm, reference.left, reference.right, reference.sampleRate),
  };
}

/**
 * Loudness, tonal balance, mono compatibility and the match-EQ fit of program
 * vs reference. The pair analyses take each track whole and at its own rate;
 * the engine brings the reference onto the program's rate.
 */
export function analyzeReference(
  wasm: Wasm,
  program: MasteringClip,
  reference: MasteringClip,
  onProgress: (progress: number) => void = () => {},
): MasteringReferenceResult {
  const source = mixToMono(program.left, program.right);
  const target = mixToMono(reference.left, reference.right);
  if (source.length === 0 || target.length === 0) {
    throw new Error('reference analysis requires non-empty audio');
  }
  const pair = (analysisName: 'match.tonalBalance' | 'match.matchEqCurve') =>
    parseJson(
      wasm.masteringPairAnalyze({
        analysisName,
        source,
        reference: target,
        sampleRate: program.sampleRate,
        referenceSampleRate: reference.sampleRate,
      }),
    );
  const sourceLufs = Number.isFinite(program.integratedLufs)
    ? program.integratedLufs
    : measureLufs(wasm, program.left, program.right, program.sampleRate);
  const referenceLufs = reference.integratedLufs;
  onProgress(0.4);
  const tonalBalance = pair('match.tonalBalance');
  onProgress(0.6);
  const curve = pair('match.matchEqCurve') as { frequencies: number[]; gainDb: number[] };
  onProgress(0.8);
  const stereoLength = Math.min(reference.left.length, reference.right.length);
  const monoCompatibility = parseJson(
    wasm.masteringStereoAnalyze(
      'stereo.monoCompatCheck',
      reference.left.subarray(0, stereoLength),
      reference.right.subarray(0, stereoLength),
      reference.sampleRate,
      { correlationThreshold: 0 },
    ),
  );
  return {
    loudness: {
      sourceLufs,
      referenceLufs,
      gainToMatchDb:
        Number.isFinite(sourceLufs) && Number.isFinite(referenceLufs)
          ? referenceLufs - sourceLufs
          : 0,
    },
    tonalBalance,
    monoCompatibility,
    matchEq: fitMatchEqPeaks(curve, program.sampleRate),
  };
}

/**
 * Per-platform delivery estimate of the rendered master. The engine identifies
 * each row by platform name only, so the requested target and ceiling are
 * echoed onto the row.
 */
export function previewPlatforms(
  wasm: Wasm,
  master: MasteringClip,
  platforms: StreamingPlatform[],
): MasteringPlatformPreviewRow[] {
  const preview = parseJson(
    wasm.masteringStreamingPreviewStereo({
      left: master.left,
      right: master.right,
      sampleRate: master.sampleRate,
      platforms,
    }),
  ) as { platforms?: unknown };
  const specs = new Map(platforms.map((platform) => [platform.name, platform]));
  const rows = Array.isArray(preview?.platforms) ? preview.platforms : [];
  return rows.map((entry) => {
    const row = entry as MasteringPlatformPreviewRow;
    const spec = specs.get(row.name);
    return spec ? { ...row, targetLufs: spec.targetLufs, ceilingDb: spec.ceilingDb } : { ...row };
  });
}

// ---------------------------------------------------------------------------
// Message loop

class Cancelled extends Error {}

let wasmModule: Promise<Wasm> | null = null;
const cancelled = new Set<number>();

function loadWasm(): Promise<Wasm> {
  wasmModule ??= import('@/wasm/index.js').then(async (wasm) => {
    await wasm.init();
    return wasm;
  });
  return wasmModule;
}

function transferList(audio: MasteringAudioTransfer): Transferable[] {
  const buffers = new Set<ArrayBufferLike>(
    Object.values(audio).flatMap((clip) => (clip ? [clip.left.buffer, clip.right.buffer] : [])),
  );
  return [...buffers] as Transferable[];
}

function post(message: MasteringWorkerResponse): void {
  const transfer = 'audio' in message ? transferList(message.audio) : [];
  self.postMessage(message, { transfer });
}

function checkpointFor(id: number): MasteringCheckpoint {
  return async (stage, progress) => {
    post({ type: 'progress', id, progress, stage });
    // Lets a queued cancel message run before the next synchronous engine call.
    await new Promise((resolve) => setTimeout(resolve, 0));
    if (cancelled.has(id)) throw new Cancelled();
  };
}

async function run(
  request: JobRequest,
  audio: MasteringAudioTransfer,
): Promise<MasteringWorkerResponse> {
  const { id } = request;
  const checkpoint = checkpointFor(id);
  await checkpoint('loading', 0.02);
  const wasm = await loadWasm();
  switch (request.type) {
    case 'detectRepair': {
      await checkpoint('analyzing', 0.1);
      const result = detectRepair(wasm, requireClip(audio, 'source'));
      return { type: 'repairDetected', id, result, audio };
    }
    case 'prepare': {
      await checkpoint('repairing', 0.05);
      const { program, stages } = prepareProgram(
        wasm,
        requireClip(audio, 'source'),
        request.repair,
        (p) => post({ type: 'progress', id, progress: 0.05 + p * 0.85, stage: 'repairing' }),
      );
      audio.program = program;
      return { type: 'prepared', id, result: { stages }, audio };
    }
    case 'fit': {
      const result = await fitMasteringLoudness(
        wasm,
        request.state,
        requireClip(audio, 'program'),
        fitCheckpoint(checkpoint),
      );
      return { type: 'fitted', id, result, audio };
    }
    case 'measure': {
      const program = requireClip(audio, 'program');
      const result = await measureLanes(wasm, request.state, program, checkpoint);
      audio.program = { ...program, integratedLufs: result.programLufs };
      return { type: 'measured', id, result, audio };
    }
    case 'export': {
      const { result, master } = await exportMaster(
        wasm,
        request.state,
        requireClip(audio, 'program'),
        request.options,
        request.refit,
        checkpoint,
      );
      audio.master = master;
      return { type: 'exported', id, result, audio };
    }
    case 'assistant': {
      await checkpoint('analyzing', 0.1);
      return {
        type: 'assisted',
        id,
        result: assistProgram(wasm, requireClip(audio, 'program'), request.preset),
        audio,
      };
    }
    case 'reference': {
      await checkpoint('analyzing', 0.1);
      const program = requireClip(audio, 'program');
      audio.reference = measureReference(wasm, requireClip(audio, 'reference'));
      await checkpoint('analyzing', 0.3);
      const result = analyzeReference(wasm, program, audio.reference, (p) =>
        post({ type: 'progress', id, progress: p, stage: 'analyzing' }),
      );
      return { type: 'referenced', id, result, audio };
    }
    case 'platformPreview': {
      await checkpoint('analyzing', 0.1);
      return {
        type: 'previewed',
        id,
        result: previewPlatforms(wasm, requireClip(audio, 'master'), request.platforms),
        audio,
      };
    }
  }
}

async function handle(request: JobRequest): Promise<void> {
  const audio = { ...request.audio };
  try {
    post(await run(request, audio));
  } catch (error) {
    if (error instanceof Cancelled) {
      post({ type: 'cancelled', id: request.id, audio });
    } else {
      const message = error instanceof Error ? error.message : String(error);
      post({ type: 'error', id: request.id, error: message, audio });
    }
  } finally {
    cancelled.delete(request.id);
  }
}

self.onmessage = (event: MessageEvent<MasteringWorkerRequest>) => {
  const request = event.data;
  if (request.type === 'cancel') {
    cancelled.add(request.id);
    return;
  }
  void handle(request);
};
