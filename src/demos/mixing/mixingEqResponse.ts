/**
 * Strip EQ curves as the engine's equalizer computes them. One
 * `StreamingEqualizer` is reused for every strip: its bands are set, then its
 * magnitude response is read on a fixed log-spaced grid.
 */
import type { StripEqBand } from '@/demos/mixing/mixingState';
import type { StreamingEqualizer } from '@/wasm/index.js';

type Wasm = typeof import('@/wasm/index.js');

export interface EqCurvePoint {
  freqHz: number;
  db: number;
}

export interface EqResponder {
  /** Response of `bands` in dB at each grid frequency. */
  curve(bands: readonly StripEqBand[]): EqCurvePoint[];
  dispose(): void;
}

/** `points` frequencies spaced evenly in log between 20 Hz and 20 kHz. */
export function logFrequencyGrid(points: number): Float32Array {
  return new Float32Array(points).map((_, i) => 20 * 1000 ** (i / (points - 1)));
}

export function createEqResponder(wasm: Wasm, sampleRate: number, points = 160): EqResponder {
  const grid = logFrequencyGrid(points);
  let equalizer: StreamingEqualizer | null = new wasm.StreamingEqualizer({
    sampleRate,
    maxBlockSize: 128,
  });
  return {
    curve(bands) {
      if (!equalizer) return [];
      bands.forEach((band, index) => {
        equalizer?.setBand(index, { ...band });
      });
      const db = equalizer.magnitudeResponse(grid);
      return Array.from(grid, (freqHz, i) => ({ freqHz, db: db[i] }));
    },
    dispose() {
      equalizer?.delete();
      equalizer = null;
    },
  };
}
