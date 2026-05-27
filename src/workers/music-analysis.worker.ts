import type {
  AnalysisResult,
  Chord,
  CqtResult,
  KeyCandidate,
  LufsResult,
  MelodyResult,
  MelSpectrogramResult,
  Section,
} from '../wasm/index';

type AnalyzeRequest = {
  type: 'analyze';
  id: number;
  samples: Float32Array;
  sampleRate: number;
};

type WorkerRequest =
  | AnalyzeRequest
  | {
      type: 'cancel';
      id: number;
    };

type WasmModule = {
  init: () => Promise<void>;
  analyzeWithProgress: (
    samples: Float32Array,
    sampleRate: number,
    onProgress: (progress: number, stage: string) => void,
  ) => AnalysisResult;
  detectKeyCandidates: (
    samples: Float32Array,
    sampleRate: number,
    options?: Record<string, unknown>,
  ) => KeyCandidate[];
  detectDownbeats: (samples: Float32Array, sampleRate: number) => Float32Array;
  analyzeSections: (samples: Float32Array, sampleRate: number) => Section[];
  analyzeMelody: (samples: Float32Array, sampleRate: number) => MelodyResult;
  melSpectrogram: (
    samples: Float32Array,
    sampleRate: number,
    nFft?: number,
    hopLength?: number,
    nMels?: number,
  ) => MelSpectrogramResult;
  cqt: (
    samples: Float32Array,
    sampleRate?: number,
    hopLength?: number,
    fmin?: number,
    nBins?: number,
    binsPerOctave?: number,
  ) => CqtResult;
  chroma: (
    samples: Float32Array,
    sampleRate: number,
    nFft?: number,
    hopLength?: number,
  ) => {
    nChroma: number;
    nFrames: number;
    sampleRate: number;
    hopLength: number;
    features: Float32Array;
    meanEnergy: number[];
  };
  lufs: (samples: Float32Array, sampleRate?: number) => LufsResult;
  momentaryLufs: (samples: Float32Array, sampleRate?: number) => Float32Array;
  shortTermLufs: (samples: Float32Array, sampleRate?: number) => Float32Array;
  version: () => string;
};

export interface MusicAnalysisWorkerResult {
  version: string;
  duration: number;
  sampleRate: number;
  analysisSampleRate: number;
  summary: {
    bpm: number;
    bpmConfidence: number;
    keyName: string;
    keyConfidence: number;
    timeSignature: string;
    integratedLufs: number;
    loudnessRange: number;
    dynamicRangeDb: number;
    crestFactor: number;
    brightness: number;
    warmth: number;
  };
  keyCandidates: Array<{
    name: string;
    confidence: number;
    correlation: number;
  }>;
  sections: Array<{
    name: string;
    start: number;
    end: number;
    confidence: number;
    energyLevel: number;
  }>;
  chords: Array<{
    name: string;
    start: number;
    end: number;
    confidence: number;
  }>;
  beats: number[];
  downbeats: number[];
  melody: {
    pitchRangeOctaves: number;
    pitchStability: number;
    meanFrequency: number;
    vibratoRate: number;
    points: Array<{
      time: number;
      frequency: number;
      confidence: number;
    }>;
  };
  heatmaps: {
    chroma: HeatmapPayload;
    mel: HeatmapPayload;
    cqt: HeatmapPayload;
  };
  loudness: {
    momentary: Array<{ time: number; value: number }>;
    shortTerm: Array<{ time: number; value: number }>;
  };
}

interface HeatmapPayload {
  rows: number;
  columns: number;
  min: number;
  max: number;
  values: Float32Array;
}

let wasmModule: WasmModule | null = null;
let cancelledId: number | null = null;

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;

  if (request.type === 'cancel') {
    cancelledId = request.id;
    return;
  }
  if (request.type !== 'analyze') return;

  try {
    cancelledId = null;
    postProgress(request.id, 0.02, 'Preparing audio');

    if (!wasmModule) {
      postProgress(request.id, 0.06, 'Loading libsonare WASM');
      wasmModule = (await import('../wasm/index.js')) as WasmModule;
      await wasmModule.init();
    }

    ensureNotCancelled(request.id);
    const result = runAnalysis(request);
    ensureNotCancelled(request.id);

    self.postMessage(
      {
        type: 'done',
        id: request.id,
        result,
      },
      [
        result.heatmaps.chroma.values.buffer,
        result.heatmaps.mel.values.buffer,
        result.heatmaps.cqt.values.buffer,
      ],
    );
  } catch (error) {
    if (error instanceof CancelledError) {
      self.postMessage({ type: 'cancelled', id: request.id });
      return;
    }
    self.postMessage({
      type: 'error',
      id: request.id,
      error: error instanceof Error ? error.message : String(error),
      recoverable: true,
    });
  }
};

function runAnalysis(request: AnalyzeRequest): MusicAnalysisWorkerResult {
  if (!wasmModule) throw new Error('WASM module is not initialized');
  const sourceSamples = request.samples;
  const sourceSampleRate = request.sampleRate;
  const duration = sourceSamples.length / sourceSampleRate;
  const prepared = prepareSamplesForAnalysis(sourceSamples, sourceSampleRate);
  const samples = prepared.samples;
  const sampleRate = prepared.sampleRate;
  const spectralHop = duration > 240 ? 2048 : 1024;

  if (prepared.resampled) {
    postProgress(request.id, 0.08, 'Optimizing long file');
  }

  postProgress(request.id, 0.1, 'Running musical analysis');
  const analysis = wasmModule.analyzeWithProgress(samples, sampleRate, (progress, stage) => {
    postProgress(request.id, 0.1 + progress * 0.22, stage);
  });

  ensureNotCancelled(request.id);
  postProgress(request.id, 0.35, 'Finding alternate keys');
  const keyCandidates = wasmModule
    .detectKeyCandidates(samples, sampleRate, {
      useHpss: true,
      loudnessWeighted: true,
      modes: 'all',
    })
    .slice(0, 8);

  ensureNotCancelled(request.id);
  postProgress(request.id, 0.42, 'Detecting downbeats and sections');
  const downbeats = Array.from(wasmModule.detectDownbeats(samples, sampleRate));
  const sections = wasmModule.analyzeSections(samples, sampleRate);

  ensureNotCancelled(request.id);
  postProgress(request.id, 0.5, 'Tracing melody');
  const melody = wasmModule.analyzeMelody(samples, sampleRate);

  ensureNotCancelled(request.id);
  postProgress(request.id, 0.58, 'Measuring loudness');
  const loudness = wasmModule.lufs(samples, sampleRate);
  const momentary = wasmModule.momentaryLufs(samples, sampleRate);
  const shortTerm = wasmModule.shortTermLufs(samples, sampleRate);

  ensureNotCancelled(request.id);
  postProgress(request.id, 0.68, 'Computing chroma');
  const chroma = wasmModule.chroma(samples, sampleRate, 4096, spectralHop);

  ensureNotCancelled(request.id);
  postProgress(request.id, 0.78, 'Computing mel spectrogram');
  const mel = wasmModule.melSpectrogram(samples, sampleRate, 2048, spectralHop, 96);

  ensureNotCancelled(request.id);
  postProgress(request.id, 0.88, 'Computing CQT');
  const cqt = wasmModule.cqt(samples, sampleRate, spectralHop, undefined, 72, 12);

  postProgress(request.id, 0.96, 'Finalizing report');
  return {
    version: wasmModule.version(),
    duration,
    sampleRate: sourceSampleRate,
    analysisSampleRate: sampleRate,
    summary: {
      bpm: analysis.bpm,
      bpmConfidence: analysis.bpmConfidence,
      keyName: analysis.key?.name || '-',
      keyConfidence: analysis.key?.confidence ?? 0,
      timeSignature: `${analysis.timeSignature?.numerator || 4}/${analysis.timeSignature?.denominator || 4}`,
      integratedLufs: loudness.integratedLufs,
      loudnessRange: loudness.loudnessRange,
      dynamicRangeDb: analysis.dynamics?.dynamicRangeDb ?? 0,
      crestFactor: analysis.dynamics?.crestFactor ?? 0,
      brightness: analysis.timbre?.brightness ?? 0,
      warmth: analysis.timbre?.warmth ?? 0,
    },
    keyCandidates: keyCandidates.map((candidate) => ({
      name: candidate.key.name,
      confidence: candidate.key.confidence,
      correlation: candidate.correlation,
    })),
    sections: sections.map(serializeSection),
    chords: analysis.chords.map(serializeChord).slice(0, 400),
    beats: Array.from(analysis.beatTimes || []).slice(0, 1200),
    downbeats: downbeats.slice(0, 600),
    melody: {
      pitchRangeOctaves: melody.pitchRangeOctaves,
      pitchStability: melody.pitchStability,
      meanFrequency: melody.meanFrequency,
      vibratoRate: melody.vibratoRate,
      points: downsampleMelody(melody, 900),
    },
    heatmaps: {
      chroma: downsampleMatrix(chroma.features, chroma.nChroma, chroma.nFrames, 12, 420),
      mel: downsampleMatrix(mel.db, mel.nMels, mel.nFrames, 96, 420),
      cqt: downsampleMatrix(cqt.magnitude, cqt.nBins, cqt.nFrames, 72, 420),
    },
    loudness: {
      momentary: downsampleSeries(momentary, duration, 420),
      shortTerm: downsampleSeries(shortTerm, duration, 420),
    },
  };
}

function prepareSamplesForAnalysis(samples: Float32Array, sampleRate: number) {
  const duration = samples.length / sampleRate;
  const targetSampleRate = duration > 120 && sampleRate > 22_050 ? 22_050 : sampleRate;
  if (targetSampleRate === sampleRate) {
    return { samples, sampleRate, resampled: false };
  }

  return {
    samples: downsampleLinear(samples, sampleRate, targetSampleRate),
    sampleRate: targetSampleRate,
    resampled: true,
  };
}

function downsampleLinear(
  samples: Float32Array,
  sourceRate: number,
  targetRate: number,
): Float32Array {
  const targetLength = Math.max(1, Math.round((samples.length / sourceRate) * targetRate));
  const output = new Float32Array(targetLength);
  const ratio = sourceRate / targetRate;

  for (let i = 0; i < targetLength; i++) {
    const sourceIndex = i * ratio;
    const left = Math.floor(sourceIndex);
    const right = Math.min(samples.length - 1, left + 1);
    const mix = sourceIndex - left;
    output[i] = samples[left] * (1 - mix) + samples[right] * mix;
  }

  return output;
}

function serializeSection(section: Section) {
  return {
    name: section.name,
    start: section.start,
    end: section.end,
    confidence: section.confidence,
    energyLevel: section.energyLevel,
  };
}

function serializeChord(chord: Chord) {
  return {
    name: chord.name,
    start: chord.start,
    end: chord.end,
    confidence: chord.confidence,
  };
}

function downsampleMelody(result: MelodyResult, targetPoints: number) {
  const points = result.points.filter((point) => point.frequency > 0 && point.confidence > 0.15);
  if (points.length <= targetPoints) return points;
  const step = Math.ceil(points.length / targetPoints);
  const output = [];
  for (let i = 0; i < points.length; i += step) {
    const point = points[i];
    output.push({
      time: point.time,
      frequency: point.frequency,
      confidence: point.confidence,
    });
  }
  return output;
}

function downsampleSeries(values: Float32Array, duration: number, targetPoints: number) {
  if (values.length <= targetPoints) {
    return Array.from(values, (value, index) => ({
      time: duration * (index / Math.max(1, values.length - 1)),
      value,
    }));
  }

  const block = Math.ceil(values.length / targetPoints);
  const output: Array<{ time: number; value: number }> = [];
  for (let start = 0; start < values.length; start += block) {
    const end = Math.min(values.length, start + block);
    let sum = 0;
    let count = 0;
    for (let i = start; i < end; i++) {
      if (Number.isFinite(values[i])) {
        sum += values[i];
        count++;
      }
    }
    output.push({
      time: duration * (start / Math.max(1, values.length - 1)),
      value: count ? sum / count : Number.NaN,
    });
  }
  return output;
}

function downsampleMatrix(
  values: Float32Array,
  rows: number,
  columns: number,
  targetRows: number,
  targetColumns: number,
): HeatmapPayload {
  const outRows = Math.min(rows, targetRows);
  const outColumns = Math.min(columns, targetColumns);
  const output = new Float32Array(outRows * outColumns);
  const rowScale = rows / outRows;
  const columnScale = columns / outColumns;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (let r = 0; r < outRows; r++) {
    const sourceR0 = Math.floor(r * rowScale);
    const sourceR1 = Math.min(rows, Math.max(sourceR0 + 1, Math.floor((r + 1) * rowScale)));
    for (let c = 0; c < outColumns; c++) {
      const sourceC0 = Math.floor(c * columnScale);
      const sourceC1 = Math.min(columns, Math.max(sourceC0 + 1, Math.floor((c + 1) * columnScale)));
      let sum = 0;
      let count = 0;
      for (let sr = sourceR0; sr < sourceR1; sr++) {
        for (let sc = sourceC0; sc < sourceC1; sc++) {
          const value = values[sr * columns + sc];
          if (Number.isFinite(value)) {
            sum += value;
            count++;
          }
        }
      }
      const averaged = count ? sum / count : 0;
      output[r * outColumns + c] = averaged;
      if (averaged < min) min = averaged;
      if (averaged > max) max = averaged;
    }
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    min = 0;
    max = 1;
  }

  return {
    rows: outRows,
    columns: outColumns,
    min,
    max,
    values: output,
  };
}

function postProgress(id: number, progress: number, stage: string) {
  self.postMessage({ type: 'progress', id, progress, stage });
}

function ensureNotCancelled(id: number) {
  if (cancelledId === id) throw new CancelledError();
}

class CancelledError extends Error {}
