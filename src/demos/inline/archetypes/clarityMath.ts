/**
 * Early/late energy split of an impulse response at a movable boundary.
 *
 * Integration follows `analyzeImpulseResponse`: both windows are measured from the
 * direct-sound peak, early is `[peak, peak + boundary)` and late is everything
 * after. At 50 and 80 ms this reproduces the engine's C50 and C80.
 */
import { shoeboxSabineSec, synthesizeShoeboxRir } from './roomRir';

type WasmModule = typeof import('@/wasm/index');

/** Room presets the demo offers: shoebox size in metres and uniform absorption. */
export type ClarityRoom = 'small' | 'medium' | 'hall';
export const CLARITY_ROOMS: Record<ClarityRoom, { size: number; absorption: number }> = {
  small: { size: 5, absorption: 0.3 },
  medium: { size: 9, absorption: 0.15 },
  hall: { size: 15, absorption: 0.08 },
};

/** Synthesize a preset room's IR, long enough to hold its decay past the noise floor. */
export function renderClarityRoom(
  wasm: WasmModule,
  room: ClarityRoom,
): { rir: Float32Array; sampleRate: number } {
  const { size, absorption } = CLARITY_ROOMS[room];
  const maxSec = Math.max(1, shoeboxSabineSec(size, absorption) * 1.3) + 0.25;
  return synthesizeShoeboxRir(wasm, size, absorption, maxSec);
}

/** Index of the direct sound: the largest-magnitude sample. */
export function directSoundIndex(rir: Float32Array): number {
  let peak = 0;
  let index = 0;
  for (let i = 0; i < rir.length; i++) {
    const v = Math.abs(rir[i]);
    if (v > peak) {
      peak = v;
      index = i;
    }
  }
  return index;
}

export interface EnergySplit {
  early: number;
  late: number;
  /** 10·log10(early / late), the C-value at this boundary. */
  clarityDb: number;
  /** early / (early + late), the D-value at this boundary. */
  earlyFraction: number;
}

/** Split the squared IR at `boundaryMs` after the direct sound. */
export function splitEnergy(
  rir: Float32Array,
  sampleRate: number,
  boundaryMs: number,
): EnergySplit {
  const d = directSoundIndex(rir);
  const b = d + Math.round((boundaryMs / 1000) * sampleRate);
  let early = 0;
  let late = 0;
  for (let i = d; i < rir.length; i++) {
    const e = rir[i] * rir[i];
    if (i < b) early += e;
    else late += e;
  }
  return {
    early,
    late,
    clarityDb: 10 * Math.log10(Math.max(1e-20, early) / Math.max(1e-20, late)),
    earlyFraction: early / Math.max(1e-20, early + late),
  };
}

/**
 * Energy per `binMs` bin from the direct sound to `spanMs` after it, in dB below
 * the strongest bin (floored at `floorDb`).
 */
export function energyBinsDb(
  rir: Float32Array,
  sampleRate: number,
  binMs: number,
  spanMs: number,
  floorDb = -60,
): Float32Array {
  const d = directSoundIndex(rir);
  const bin = Math.max(1, Math.round((binMs / 1000) * sampleRate));
  const count = Math.ceil(spanMs / binMs);
  const energy = new Float32Array(count);
  let max = 1e-20;
  for (let k = 0; k < count; k++) {
    let acc = 0;
    for (let i = d + k * bin; i < d + (k + 1) * bin && i < rir.length; i++) acc += rir[i] * rir[i];
    energy[k] = acc;
    max = Math.max(max, acc);
  }
  const out = new Float32Array(count);
  for (let k = 0; k < count; k++) {
    out[k] = Math.max(floorDb, 10 * Math.log10(Math.max(1e-20, energy[k]) / max));
  }
  return out;
}
