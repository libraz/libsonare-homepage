import type {
  MasteringChainConfig,
  MasteringResult,
  MasteringStereoChainResult,
} from '../wasm/index';

type WorkerRequest =
  | {
      type: 'render';
      id: number;
      left: Float32Array;
      right: Float32Array;
      sampleRate: number;
      config: MasteringChainConfig;
    }
  | {
      type: 'referenceMatch';
      id: number;
      left: Float32Array;
      right: Float32Array;
      referenceLeft: Float32Array;
      referenceRight: Float32Array;
      sampleRate: number;
      targetLufs: number;
      ceilingDb: number;
      lookaheadMs: number;
    }
  | {
      type: 'referenceAnalyze';
      id: number;
      sourceLeft: Float32Array;
      sourceRight: Float32Array;
      referenceLeft: Float32Array;
      referenceRight: Float32Array;
      sampleRate: number;
    };

type WasmModule = {
  init: () => Promise<void>;
  masteringChainStereoWithProgress: (
    left: Float32Array,
    right: Float32Array,
    sampleRate: number,
    config: MasteringChainConfig,
    onProgress: (progress: number, stage: string) => void,
  ) => MasteringStereoChainResult;
  masteringPairProcess: (
    processorName: string,
    source: Float32Array,
    reference: Float32Array,
    sampleRate: number,
    params?: Record<string, number | boolean>,
  ) => MasteringResult;
  masteringPairAnalyze: (
    analysisName: string,
    source: Float32Array,
    reference: Float32Array,
    sampleRate: number,
    params?: Record<string, number | boolean>,
  ) => string;
  masteringStereoAnalyze: (
    analysisName: string,
    left: Float32Array,
    right: Float32Array,
    sampleRate: number,
    params?: Record<string, number | boolean>,
  ) => string;
};

let wasmModule: WasmModule | null = null;

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;

  try {
    postProgress(request.id, 0.04, 'Preparing audio buffers');

    if (!wasmModule) {
      postProgress(request.id, 0.12, 'Loading libsonare WASM');
      wasmModule = (await import('../wasm/index.js')) as WasmModule;
      await wasmModule.init();
    }

    if (request.type === 'referenceAnalyze') {
      const result = analyzeReference(request);
      self.postMessage({ type: 'analysisDone', id: request.id, result });
      return;
    }

    const result =
      request.type === 'render' ? renderMasteringChain(request) : renderReferenceMatch(request);
    applyOutputSafety(
      result,
      request.type === 'render' ? ceilingFromConfig(request.config) : request.ceilingDb,
    );

    postProgress(request.id, 0.94, 'Finalizing render');
    self.postMessage(
      {
        type: 'done',
        id: request.id,
        result: {
          left: result.left,
          right: result.right,
          sampleRate: result.sampleRate,
          inputLufs: result.inputLufs,
          outputLufs: result.outputLufs,
          appliedGainDb: result.appliedGainDb,
          stages: result.stages || [],
          latencySamples: result.latencySamples,
        },
      },
      [result.left.buffer, result.right.buffer],
    );
  } catch (error) {
    self.postMessage({
      type: 'error',
      id: request.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

function renderMasteringChain(request: Extract<WorkerRequest, { type: 'render' }>) {
  if (!wasmModule) throw new Error('WASM module is not initialized');
  postProgress(request.id, 0.24, 'Running mastering chain');
  return wasmModule.masteringChainStereoWithProgress(
    request.left,
    request.right,
    request.sampleRate,
    request.config,
    (progress, stage) => {
      postProgress(request.id, 0.24 + progress * 0.7, stage);
    },
  );
}

function analyzeReference(request: Extract<WorkerRequest, { type: 'referenceAnalyze' }>) {
  if (!wasmModule) throw new Error('WASM module is not initialized');

  postProgress(request.id, 0.24, 'Analyzing reference loudness');
  const sourceMono = mixToMono(request.sourceLeft, request.sourceRight);
  const referenceMono = mixToMono(request.referenceLeft, request.referenceRight);
  const pairLength = Math.min(sourceMono.length, referenceMono.length);
  if (pairLength <= 0) throw new Error('Reference analysis requires non-empty audio');

  const sourcePair = sourceMono.slice(0, pairLength);
  const referencePair = referenceMono.slice(0, pairLength);
  const loudness = parseJson(
    wasmModule.masteringPairAnalyze(
      'match.referenceLoudness',
      sourcePair,
      referencePair,
      request.sampleRate,
    ),
  );

  postProgress(request.id, 0.5, 'Analyzing tonal balance');
  const tonalBalance = parseJson(
    wasmModule.masteringPairAnalyze(
      'match.tonalBalance',
      sourcePair,
      referencePair,
      request.sampleRate,
    ),
  );

  postProgress(request.id, 0.76, 'Checking mono compatibility');
  const referenceStereoLength = Math.min(
    request.referenceLeft.length,
    request.referenceRight.length,
  );
  const monoCompatibility = parseJson(
    wasmModule.masteringStereoAnalyze(
      'stereo.monoCompatCheck',
      request.referenceLeft.slice(0, referenceStereoLength),
      request.referenceRight.slice(0, referenceStereoLength),
      request.sampleRate,
      { correlationThreshold: 0 },
    ),
  );

  postProgress(request.id, 0.94, 'Finalizing reference analysis');
  return { loudness, tonalBalance, monoCompatibility };
}

function ceilingFromConfig(config: MasteringChainConfig): number {
  const loudnessCeiling = config.loudness?.ceilingDb;
  if (typeof loudnessCeiling === 'number' && Number.isFinite(loudnessCeiling)) {
    return loudnessCeiling;
  }
  const limiterCeiling = config.maximizer?.truePeakLimiter?.ceilingDb;
  if (typeof limiterCeiling === 'number' && Number.isFinite(limiterCeiling)) {
    return limiterCeiling;
  }
  return -1;
}

function applyOutputSafety(result: MasteringStereoChainResult, ceilingDb: number) {
  const ceiling = 10 ** (Math.min(ceilingDb, -0.1) / 20);
  let peak = 0;

  for (let i = 0; i < result.left.length; i++) {
    const left = Number.isFinite(result.left[i]) ? result.left[i] : 0;
    const right = Number.isFinite(result.right[i]) ? result.right[i] : 0;
    result.left[i] = left;
    result.right[i] = right;
    peak = Math.max(peak, Math.abs(left), Math.abs(right));
  }

  if (peak <= ceiling || peak <= 0) return;

  const gain = ceiling / peak;
  for (let i = 0; i < result.left.length; i++) {
    result.left[i] *= gain;
    result.right[i] *= gain;
  }

  const gainDb = 20 * Math.log10(gain);
  result.appliedGainDb += gainDb;
  result.outputLufs += gainDb;
}

function renderReferenceMatch(request: Extract<WorkerRequest, { type: 'referenceMatch' }>) {
  if (!wasmModule) throw new Error('WASM module is not initialized');

  // The match-EQ curve is derived by comparing the full source and reference
  // spectra, so each side keeps its own length — never truncate the source to
  // the (often shorter) reference, which would clip the tail of the master.
  postProgress(request.id, 0.3, 'match.applyMatchEq left');
  const leftResult = wasmModule.masteringPairProcess(
    'match.applyMatchEq',
    request.left,
    request.referenceLeft,
    request.sampleRate,
    { maxGainDb: 6, smoothingBins: 5 },
  );

  postProgress(request.id, 0.5, 'match.applyMatchEq right');
  const rightResult = wasmModule.masteringPairProcess(
    'match.applyMatchEq',
    request.right,
    request.referenceRight,
    request.sampleRate,
    { maxGainDb: 6, smoothingBins: 5 },
  );

  // Finish the master: normalize to the target loudness and tame true peaks so
  // the reference-matched output is delivery-ready instead of left at the raw
  // (un-normalized) source level.
  const normalized = wasmModule.masteringChainStereoWithProgress(
    leftResult.samples,
    rightResult.samples,
    request.sampleRate,
    {
      maximizer: {
        truePeakLimiter: {
          ceilingDb: request.ceilingDb,
          lookaheadMs: request.lookaheadMs,
          oversampleFactor: 4,
          applyGainAtInputRate: true,
        },
      },
      loudness: {
        targetLufs: request.targetLufs,
        ceilingDb: request.ceilingDb,
        truePeakOversample: 4,
      },
    },
    (progress, stage) => postProgress(request.id, 0.55 + progress * 0.35, stage),
  );

  return {
    left: normalized.left,
    right: normalized.right,
    sampleRate: normalized.sampleRate,
    inputLufs: normalized.inputLufs,
    outputLufs: normalized.outputLufs,
    appliedGainDb: normalized.appliedGainDb,
    stages: ['match.applyMatchEq', ...normalized.stages],
    latencySamples: normalized.latencySamples,
  };
}

function postProgress(id: number, progress: number, stage: string) {
  self.postMessage({ type: 'progress', id, progress, stage });
}

function mixToMono(left: Float32Array, right: Float32Array): Float32Array {
  const length = Math.min(left.length, right.length);
  const mono = new Float32Array(length);
  for (let i = 0; i < length; i++) mono[i] = (left[i] + right[i]) * 0.5;
  return mono;
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}
