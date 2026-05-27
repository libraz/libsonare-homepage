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

    const result =
      request.type === 'render' ? renderMasteringChain(request) : renderReferenceMatch(request);

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
