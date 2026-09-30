import { clamp } from '@/utils/scale';

export interface MasteringSignalStats {
  peakDb: number;
  rmsDb: number;
  crestDb: number;
  correlation: number;
}

export function analyzeMasteringSignal(
  left: Float32Array,
  right: Float32Array,
): MasteringSignalStats {
  let peak = 0;
  let sumSquares = 0;
  let sumLeftSquares = 0;
  let sumRightSquares = 0;
  let sumProduct = 0;
  let count = 0;

  // Keep every metric on the same full-resolution pass. Peak is a safety/readout
  // metric, and striding the energy terms can alias coherent material into silence.
  for (let i = 0; i < left.length; i++) {
    const leftSample = left[i];
    const rightSample = right[i] ?? leftSample;
    peak = Math.max(peak, Math.abs(leftSample), Math.abs(rightSample));
    sumSquares += (leftSample * leftSample + rightSample * rightSample) / 2;
    sumLeftSquares += leftSample * leftSample;
    sumRightSquares += rightSample * rightSample;
    sumProduct += leftSample * rightSample;
    count++;
  }

  const rms = Math.sqrt(sumSquares / Math.max(1, count));
  const peakDb = 20 * Math.log10(Math.max(peak, 0.000001));
  const rmsDb = 20 * Math.log10(Math.max(rms, 0.000001));
  const denominator = Math.sqrt(sumLeftSquares * sumRightSquares);
  const correlation = denominator > 0 ? sumProduct / denominator : 0;

  return {
    peakDb,
    rmsDb,
    crestDb: peakDb - rmsDb,
    correlation: clamp(correlation, -1, 1),
  };
}

export function normalizeRange(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  return clamp(((value - min) / (max - min)) * 100, 0, 100);
}
