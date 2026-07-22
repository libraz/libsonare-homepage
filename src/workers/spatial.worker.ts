/**
 * Spatial room scanner worker.
 *
 * Runs the libsonare room-acoustic pipeline off the main thread:
 *  - `estimateRoom(...)`     → equivalent shoebox geometry, volume, DRR, per-band absorption.
 *  - `analyzeImpulseResponse` / `detectAcoustic` → RT60/EDT/C50/C80/D50 + confidence.
 *  - `synthesizeRir(...)`    → for the built-in "known room" presets, so the demo can
 *                              estimate a room back from a deterministic RIR and compare
 *                              the estimate against the ground-truth geometry.
 *  - `roomMorph(...)`        → audition content through the estimated or selected room.
 *
 * Everything is dependency-free WASM running locally; no audio leaves the browser.
 */
import type { AcousticResult, RirResult, RoomEstimateResult } from '../wasm/index';

export interface RoomGeometry {
  lengthM: number;
  widthM: number;
  heightM: number;
  absorption: number;
  sourceX: number;
  sourceY: number;
  sourceZ: number;
  listenerX: number;
  listenerY: number;
  listenerZ: number;
}

/** Per-octave-band breakdown surfaced to the UI. */
export interface BandRow {
  freq: number;
  label: string;
  rt60: number;
  absorption: number;
}

export interface ScanResult {
  /** Equivalent-room estimate. */
  room: { length: number; width: number; height: number; volume: number };
  /** Estimated direct-to-reverberant ratio (dB). */
  drrDb: number;
  /** Overall heuristic confidence 0..1 (combined estimate + acoustic). */
  confidence: number;
  estimateConfidence: number;
  /** Whether the acoustic numbers came from blind estimation vs an isolated impulse. */
  isBlind: boolean;
  /** False when the recording yielded no usable room/decay evidence (degenerate estimate). */
  valid: boolean;
  /** Headline room-acoustic metrics. */
  acoustic: {
    rt60: number;
    edt: number;
    c50: number | null;
    c80: number | null;
    d50: number | null;
  };
  bands: BandRow[];
  /** Critical distance (m): where direct and reverberant energy are equal. */
  criticalDistance: number;
  /** Estimated source→listener distance (m), derived from DRR + critical distance. */
  sourceDistance: number;
  /** Listener placement used for the scene (room centre-ish if unknown). */
  listener: { x: number; y: number; z: number };
  /** A representative estimated source point on the distance shell. */
  source: { x: number; y: number; z: number };
  /** Independent source placement guaranteed to be valid for roomMorph DSP. */
  dspSource: { x: number; y: number; z: number };
  /** Ground-truth geometry + source, present only for built-in synthesized presets. */
  truth: {
    room: { length: number; width: number; height: number };
    source: { x: number; y: number; z: number };
    listener: { x: number; y: number; z: number };
  } | null;
  /** Synthesized room impulse response (preset rooms only) for convolution auralization. */
  rir?: Float32Array;
  rirSampleRate?: number;
}

type ScanRequest = {
  type: 'scan';
  id: number;
  samples: Float32Array;
  sampleRate: number;
  isIR: boolean;
};

type PresetRequest = {
  type: 'preset';
  id: number;
  sampleRate: number;
  geometry: RoomGeometry;
};

type MorphGeometry = Partial<RoomGeometry> & {
  lengthM: number;
  widthM: number;
  heightM: number;
  absorption?: number;
  ismOrder?: number;
  maxSeconds?: number;
  seed?: number;
};

type MorphRequest = {
  type: 'morph';
  id: number;
  left: Float32Array;
  right: Float32Array;
  sampleRate: number;
  geometry: MorphGeometry;
};

type WorkerRequest = ScanRequest | PresetRequest | MorphRequest;

type WasmModule = {
  init: () => Promise<void>;
  estimateRoom: (
    samples: Float32Array,
    sampleRate?: number,
    options?: Record<string, unknown>,
  ) => RoomEstimateResult;
  analyzeImpulseResponse: (
    samples: Float32Array,
    sampleRate?: number,
    nOctaveBands?: number,
  ) => AcousticResult;
  detectAcoustic: (
    samples: Float32Array,
    sampleRate?: number,
    options?: { nOctaveBands?: number },
  ) => AcousticResult;
  synthesizeRir: (options?: Record<string, unknown>) => RirResult;
  roomMorph: (
    samples: Float32Array,
    sampleRate: number,
    options?: Record<string, unknown>,
  ) => Float32Array;
  version: () => string;
};

const N_BANDS = 6;

// Preset RIR length scales with the room's reverberation time so long-decay presets
// (hall, cathedral) audition their full tail instead of a hard truncation that cuts
// the decay short.
const RIR_TAIL_FACTOR = 1.2;
const RIR_MIN_SECONDS = 2.5;
const RIR_MAX_SECONDS = 12;

let wasmModule: WasmModule | null = null;

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  try {
    if (!wasmModule) {
      self.postMessage({ type: 'progress', id: request.id, stage: 'wasm', value: 0.1 });
      wasmModule = (await import('../wasm/index.js')) as unknown as WasmModule;
      await wasmModule.init();
    }

    if (request.type === 'morph') {
      const { id, left, right, sampleRate, geometry } = request;
      self.postMessage({ type: 'progress', id, stage: 'morph-left', value: 0.35 });
      const leftOut = morphChannel(left, sampleRate, geometry);
      self.postMessage({ type: 'progress', id, stage: 'morph-right', value: 0.7 });
      const rightOut = morphChannel(right, sampleRate, geometry);
      self.postMessage({ type: 'morphDone', id, left: leftOut, right: rightOut, sampleRate }, [
        leftOut.buffer,
        rightOut.buffer,
      ]);
      return;
    }

    if (request.type === 'preset') {
      const { geometry, sampleRate, id } = request;
      self.postMessage({ type: 'progress', id, stage: 'synthesize', value: 0.35 });
      const maxSeconds = clamp(
        sabineRt60(geometry) * RIR_TAIL_FACTOR,
        RIR_MIN_SECONDS,
        RIR_MAX_SECONDS,
      );
      const rir = wasmModule.synthesizeRir({
        lengthM: geometry.lengthM,
        widthM: geometry.widthM,
        heightM: geometry.heightM,
        absorption: geometry.absorption,
        sourceX: geometry.sourceX,
        sourceY: geometry.sourceY,
        sourceZ: geometry.sourceZ,
        listenerX: geometry.listenerX,
        listenerY: geometry.listenerY,
        listenerZ: geometry.listenerZ,
        ismOrder: 2,
        seed: 1337,
        maxSeconds,
        sampleRate,
      });
      if (rir.hasError || rir.rir.length === 0) {
        throw new Error('Invalid room geometry for synthesis');
      }
      self.postMessage({ type: 'progress', id, stage: 'estimate', value: 0.7 });
      const result = analyse(rir.rir, rir.sampleRate, true, geometry, (v) =>
        self.postMessage({ type: 'progress', id, stage: 'estimate', value: 0.7 + v * 0.3 }),
      );
      // Hand back the impulse response so the UI can auralize a demo clip through
      // this room with a WebAudio ConvolverNode (transfer the buffer, zero-copy).
      result.rir = rir.rir;
      result.rirSampleRate = rir.sampleRate;
      self.postMessage({ type: 'done', id, result }, [rir.rir.buffer]);
      return;
    }

    const { samples, sampleRate, isIR, id } = request;
    self.postMessage({ type: 'progress', id, stage: 'estimate', value: 0.45 });
    const result = analyse(samples, sampleRate, isIR, null, (v) =>
      self.postMessage({ type: 'progress', id, stage: 'estimate', value: 0.45 + v * 0.5 }),
    );
    self.postMessage({ type: 'done', id, result });
  } catch (error) {
    self.postMessage({
      type: 'error',
      id: request.id,
      message: error instanceof Error ? error.message : String(error),
    });
  }
};

function morphChannel(
  samples: Float32Array,
  sampleRate: number,
  geometry: MorphRequest['geometry'],
): Float32Array {
  const wasm = wasmModule;
  if (!wasm) throw new Error('WASM not initialized');
  return wasm.roomMorph(samples, sampleRate, {
    lengthM: geometry.lengthM,
    widthM: geometry.widthM,
    heightM: geometry.heightM,
    absorption: geometry.absorption ?? 0.18,
    sourceX: geometry.sourceX,
    sourceY: geometry.sourceY,
    sourceZ: geometry.sourceZ,
    listenerX: geometry.listenerX,
    listenerY: geometry.listenerY,
    listenerZ: geometry.listenerZ,
    ismOrder: geometry.ismOrder ?? 2,
    maxSeconds: geometry.maxSeconds ?? 2.5,
    wet: 0.42,
    sourceTailSuppression: 0.18,
    seed: geometry.seed ?? 2026,
  });
}

function analyse(
  samples: Float32Array,
  sampleRate: number,
  isIR: boolean,
  truthGeometry: RoomGeometry | null,
  onProgress?: (value: number) => void,
): ScanResult {
  const wasm = wasmModule;
  if (!wasm) throw new Error('WASM not initialized');

  const estimate = wasm.estimateRoom(samples, sampleRate, { nOctaveBands: N_BANDS });
  onProgress?.(0.5);
  const acoustic = isIR
    ? wasm.analyzeImpulseResponse(samples, sampleRate, N_BANDS)
    : wasm.detectAcoustic(samples, sampleRate, { nOctaveBands: N_BANDS });
  onProgress?.(1);

  // A blind estimate of ordinary audio can come back degenerate (no usable decay):
  // zero/NaN dimensions and zero confidence. Flag it so the UI shows guidance
  // instead of rendering a broken (NaN-geometry) scene.
  const valid =
    Number.isFinite(estimate.length) &&
    estimate.length > 0.1 &&
    Number.isFinite(estimate.width) &&
    estimate.width > 0.1 &&
    Number.isFinite(estimate.height) &&
    estimate.height > 0.1 &&
    Number.isFinite(estimate.volume) &&
    estimate.volume > 0.5;

  const volume =
    estimate.volume > 0 ? estimate.volume : estimate.length * estimate.width * estimate.height;
  const rt60 = acoustic.rt60 > 0 ? acoustic.rt60 : meanPositive(estimate.rt60Bands) || 0.4;

  // Critical distance r_c = 0.057 * sqrt(V / RT60) (omnidirectional source, Q = 1).
  const criticalDistance = 0.057 * Math.sqrt(Math.max(volume, 0.5) / Math.max(rt60, 0.05));

  // DRR (dB, power) maps to distance: DRR = (r_c / r)^2 → r = r_c * 10^(-DRR/20).
  const diagonal = Math.hypot(estimate.length, estimate.width, estimate.height);
  const drrDb = Number.isFinite(estimate.drrDb) ? estimate.drrDb : 0;
  const rawDistance = criticalDistance * 10 ** (-drrDb / 20);
  const sourceDistance = clamp(
    Number.isFinite(rawDistance) ? rawDistance : criticalDistance,
    0.35,
    Math.max(0.5, diagonal * 0.92),
  );

  // Listener: a sensible interior measurement point. Use truth listener for presets.
  const listener = truthGeometry
    ? { x: truthGeometry.listenerX, y: truthGeometry.listenerY, z: truthGeometry.listenerZ }
    : { x: estimate.length * 0.62, y: estimate.width * 0.5, z: 1.5 };

  // Representative source point: a fixed bearing at exactly sourceDistance from the
  // listener, so the marker always sits on the drawn distance shell. (A single channel
  // reveals distance, not bearing — the UI shows a full shell.) The point is left
  // unclamped: clamping it back inside the room would pull it off the shell radius,
  // which is what the scene actually visualizes.
  const bearing = Math.PI * 0.78;
  const elevation = -0.12;
  const source = {
    x: listener.x + sourceDistance * Math.cos(elevation) * Math.cos(bearing),
    y: listener.y + sourceDistance * Math.cos(elevation) * Math.sin(bearing),
    z: listener.z + sourceDistance * Math.sin(elevation),
  };
  const dspSource = {
    x: clamp(source.x, 0.05, Math.max(0.05, estimate.length - 0.05)),
    y: clamp(source.y, 0.05, Math.max(0.05, estimate.width - 0.05)),
    z: clamp(source.z, 0.05, Math.max(0.05, estimate.height - 0.05)),
  };

  const estimateConfidence = clamp(estimate.confidence, 0, 1);
  const acousticConfidence = clamp(acoustic.confidence, 0, 1);
  const confidence = clamp((estimateConfidence + acousticConfidence) / 2, 0, 1);

  return {
    room: {
      length: estimate.length,
      width: estimate.width,
      height: estimate.height,
      volume,
    },
    drrDb,
    confidence,
    estimateConfidence,
    isBlind: acoustic.isBlind,
    valid,
    acoustic: {
      rt60,
      edt: acoustic.edt,
      c50: finiteOrNull(acoustic.c50),
      c80: finiteOrNull(acoustic.c80),
      d50: finiteOrNull(acoustic.d50),
    },
    bands: buildBands(estimate.rt60Bands, estimate.absorptionBands),
    criticalDistance,
    sourceDistance,
    listener,
    source,
    dspSource,
    truth: truthGeometry
      ? {
          room: {
            length: truthGeometry.lengthM,
            width: truthGeometry.widthM,
            height: truthGeometry.heightM,
          },
          source: { x: truthGeometry.sourceX, y: truthGeometry.sourceY, z: truthGeometry.sourceZ },
          listener: {
            x: truthGeometry.listenerX,
            y: truthGeometry.listenerY,
            z: truthGeometry.listenerZ,
          },
        }
      : null,
  };
}

function buildBands(rt60Bands: Float32Array, absorptionBands: Float32Array): BandRow[] {
  const count = Math.max(rt60Bands.length, absorptionBands.length, 0);
  const rows: BandRow[] = [];
  for (let i = 0; i < count; i++) {
    const freq = 125 * 2 ** i;
    rows.push({
      freq,
      label: freq >= 1000 ? `${(freq / 1000).toFixed(freq % 1000 === 0 ? 0 : 1)}k` : `${freq}`,
      rt60: rt60Bands[i] ?? 0,
      absorption: absorptionBands[i] ?? 0,
    });
  }
  return rows;
}

function meanPositive(values: Float32Array): number {
  let sum = 0;
  let n = 0;
  for (const v of values) {
    if (v > 0) {
      sum += v;
      n++;
    }
  }
  return n ? sum / n : 0;
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}

function finiteOrNull(value: number): number | null {
  return Number.isFinite(value) ? value : null;
}

/**
 * Sabine reverberation-time estimate (s) from shoebox geometry. Used only to size the
 * synthesized preset RIR so its full decay tail is captured (not for the reported RT60,
 * which comes from the acoustic analysis of the synthesized impulse).
 */
function sabineRt60(geometry: RoomGeometry): number {
  const { lengthM, widthM, heightM } = geometry;
  const volume = lengthM * widthM * heightM;
  const surface = 2 * (lengthM * widthM + lengthM * heightM + widthM * heightM);
  const absorption = Math.max(geometry.absorption, 0.01);
  if (surface <= 0) return RIR_MIN_SECONDS;
  return (0.161 * volume) / (surface * absorption);
}
