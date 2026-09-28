import type {
  MasteringChainConfig,
  MasteringChainStereoResult,
  MasteringResult,
  StreamingPlatform,
} from '@/wasm/index';

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
      referenceSampleRate?: number;
      targetLufs: number;
      ceilingDb: number;
      lookaheadMs: number;
    }
  | {
      type: 'sourceAnalyze';
      id: number;
      left: Float32Array;
      right: Float32Array;
      sampleRate: number;
      platforms: StreamingPlatform[];
      preset?: string;
    }
  | {
      type: 'referenceAnalyze';
      id: number;
      sourceLeft: Float32Array;
      sourceRight: Float32Array;
      referenceLeft: Float32Array;
      referenceRight: Float32Array;
      sampleRate: number;
      referenceSampleRate?: number;
    };

type WasmModule = {
  init: () => Promise<void>;
  resample: (samples: Float32Array, srcSr: number, targetSr: number) => Float32Array;
  lufsInterleaved: (
    samples: Float32Array,
    channels: number,
    sampleRate: number,
  ) => { integratedLufs: number };
  masteringChainStereoWithProgress: (
    left: Float32Array,
    right: Float32Array,
    sampleRate: number,
    config: MasteringChainConfig,
    onProgress: (progress: number, stage: string) => void,
  ) => MasteringChainStereoResult;
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
  masteringAudioProfileStereo: (request: {
    left: Float32Array;
    right: Float32Array;
    sampleRate: number;
  }) => string;
  masteringAssistantSuggestStereo: (request: {
    left: Float32Array;
    right: Float32Array;
    sampleRate: number;
    params?: Record<string, number | boolean | string>;
  }) => string;
  masteringStreamingPreviewStereo: (request: {
    left: Float32Array;
    right: Float32Array;
    sampleRate: number;
    platforms: StreamingPlatform[];
  }) => string;
};

let wasmModule: WasmModule | null = null;

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;

  try {
    postProgress(request.id, 0.04, 'Preparing audio buffers');

    if (!wasmModule) {
      postProgress(request.id, 0.12, 'Loading libsonare WASM');
      wasmModule = (await import('@/wasm/index.js')) as WasmModule;
      await wasmModule.init();
    }

    if (request.type === 'referenceAnalyze') {
      const result = analyzeReference(request);
      self.postMessage({ type: 'analysisDone', id: request.id, result });
      return;
    }

    if (request.type === 'sourceAnalyze') {
      // Only the profile's `loudness` block is measured from the two channels:
      // BS.1770 channel-summed integrated LUFS and LRA, the larger of the two
      // channel true peaks, and a crest factor across both channels. Passing a
      // 0.5*(L+R) downmix to the mono entry points instead reads roughly 6 dB
      // low on decorrelated material and cancels outright out of phase.
      //
      // The spectral, dynamics and tempo fields describe shape and timing
      // rather than absolute level, so the engine still measures those on the
      // downmix and they stay comparable with the mono entry point field for
      // field.
      postProgress(request.id, 0.3, 'Profiling source');
      const profile = parseJson(
        wasmModule.masteringAudioProfileStereo({
          left: request.left,
          right: request.right,
          sampleRate: request.sampleRate,
        }),
      );
      postProgress(request.id, 0.6, 'Building suggestions');
      const suggestions = parseJson(
        wasmModule.masteringAssistantSuggestStereo({
          left: request.left,
          right: request.right,
          sampleRate: request.sampleRate,
          ...(request.preset ? { params: { preset: request.preset } } : {}),
        }),
      );
      postProgress(request.id, 0.85, 'Previewing streaming delivery');
      const streamingPreview = buildStreamingPreview(request);
      self.postMessage({
        type: 'sourceAnalysisDone',
        id: request.id,
        result: { profile, suggestions, streamingPreview },
      });
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

/**
 * Per-platform delivery estimate, measured by the engine on the stereo pair.
 *
 * The engine returns the measured figures and the verdict (normalization gain
 * and ceiling risk) but identifies each row only by platform name. Echo the
 * requested platform spec back onto its row so consumers never have to look a
 * platform's target/ceiling back up by name.
 */
function buildStreamingPreview(request: Extract<WorkerRequest, { type: 'sourceAnalyze' }>) {
  if (!wasmModule) throw new Error('WASM module is not initialized');
  const preview = parseJson(
    wasmModule.masteringStreamingPreviewStereo({
      left: request.left,
      right: request.right,
      sampleRate: request.sampleRate,
      platforms: request.platforms,
    }),
  ) as { platforms?: unknown };

  const specs = new Map(request.platforms.map((platform) => [platform.name, platform]));
  const rows = Array.isArray(preview?.platforms) ? preview.platforms : [];
  return {
    platforms: rows.map((entry) => {
      const row = entry as Record<string, unknown>;
      const spec = typeof row.name === 'string' ? specs.get(row.name) : undefined;
      return spec ? { ...row, targetLufs: spec.targetLufs, ceilingDb: spec.ceilingDb } : { ...row };
    }),
  };
}

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
  const reference = resampleReference(request);
  const sourceMono = mixToMono(request.sourceLeft, request.sourceRight);
  const referenceMono = mixToMono(reference.left, reference.right);
  const pairLength = Math.min(sourceMono.length, referenceMono.length);
  if (pairLength <= 0) throw new Error('Reference analysis requires non-empty audio');

  const sourcePair = sourceMono.slice(0, pairLength);
  const referencePair = referenceMono.slice(0, pairLength);
  const sourceLufs = wasmModule.lufsInterleaved(
    interleaveStereo(request.sourceLeft, request.sourceRight),
    2,
    request.sampleRate,
  );
  const referenceLufs = wasmModule.lufsInterleaved(
    interleaveStereo(reference.left, reference.right),
    2,
    request.sampleRate,
  );
  const loudness = {
    sourceLufs: sourceLufs.integratedLufs,
    referenceLufs: referenceLufs.integratedLufs,
    gainToMatchDb:
      Number.isFinite(sourceLufs.integratedLufs) && Number.isFinite(referenceLufs.integratedLufs)
        ? referenceLufs.integratedLufs - sourceLufs.integratedLufs
        : 0,
  };

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
  const referenceStereoLength = Math.min(reference.left.length, reference.right.length);
  const monoCompatibility = parseJson(
    wasmModule.masteringStereoAnalyze(
      'stereo.monoCompatCheck',
      reference.left.slice(0, referenceStereoLength),
      reference.right.slice(0, referenceStereoLength),
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

function applyOutputSafety(result: MasteringChainStereoResult, ceilingDb: number) {
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

  const reference = resampleReference(request);

  // The match-EQ curve is derived by comparing the full source and reference
  // spectra, so each side keeps its own length — never truncate the source to
  // the (often shorter) reference, which would clip the tail of the master.
  postProgress(request.id, 0.3, 'match.applyMatchEq left');
  const leftResult = wasmModule.masteringPairProcess(
    'match.applyMatchEq',
    request.left,
    reference.left,
    request.sampleRate,
    { maxGainDb: 6, smoothingBins: 5 },
  );

  postProgress(request.id, 0.5, 'match.applyMatchEq right');
  const rightResult = wasmModule.masteringPairProcess(
    'match.applyMatchEq',
    request.right,
    reference.right,
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
  };
}

function postProgress(id: number, progress: number, stage: string) {
  self.postMessage({ type: 'progress', id, progress, stage });
}

function resampleReference(
  request: Pick<
    Extract<WorkerRequest, { type: 'referenceAnalyze' | 'referenceMatch' }>,
    'referenceLeft' | 'referenceRight' | 'sampleRate' | 'referenceSampleRate'
  >,
): { left: Float32Array; right: Float32Array } {
  const referenceSampleRate = request.referenceSampleRate ?? request.sampleRate;
  if (referenceSampleRate === request.sampleRate) {
    return { left: request.referenceLeft, right: request.referenceRight };
  }
  if (!wasmModule) throw new Error('WASM module is not initialized');
  const resample = (samples: Float32Array) =>
    samples.length === 0
      ? new Float32Array()
      : wasmModule!.resample(samples, referenceSampleRate, request.sampleRate);
  return {
    left: resample(request.referenceLeft),
    right: resample(request.referenceRight),
  };
}

function interleaveStereo(left: Float32Array, right: Float32Array): Float32Array {
  const length = Math.min(left.length, right.length);
  const samples = new Float32Array(length * 2);
  for (let i = 0; i < length; i++) {
    samples[i * 2] = left[i];
    samples[i * 2 + 1] = right[i];
  }
  return samples;
}

/**
 * The two-input `match.*` analyses are mono-only, so they take a downmix. Keep
 * a coherent average, but preserve a usable tonal signal when stereo phase
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
    const stronger = leftEnergy >= rightEnergy ? left : right;
    return stronger.slice(0, length);
  }
  return mono;
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}
