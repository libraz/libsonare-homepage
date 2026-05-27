// Value-to-axis mapping helpers shared by the demo visualisations. Kept pure and
// dependency-free so they can be unit tested and reused across components.

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Linear amplitude from a dB value. Unclamped (positive dB returns > 1). */
export function dbToLinear(db: number): number {
  return 10 ** (db / 20);
}

/**
 * Map a value within [min, max] to a 0–100 axis where `min` sits at the bottom
 * (100%) and `max` at the top (0%) — the convention SVG charts use. Out-of-range
 * values clamp to 0/100; a zero-width range maps everything to the top.
 */
export function invertedRangeToPercent(value: number, min: number, max: number): number {
  const ratio = (value - min) / (max - min || 1);
  return clamp((1 - ratio) * 100, 0, 100);
}

/**
 * Bar-meter fill height (%) for a linear amplitude, mapping `floorDb`..0 dB onto
 * `minPercent`..100. Amplitudes at/above unity peg at 100%.
 */
export function meterFillPercent(amplitude: number, floorDb = -60, minPercent = 2): number {
  const db = amplitude > 0 ? 20 * Math.log10(amplitude) : floorDb;
  const pct = ((db - floorDb) / (0 - floorDb)) * 100;
  return clamp(pct, minPercent, 100);
}

/**
 * Peak-hold meter decay: snap up instantly when `value` exceeds the held peak,
 * otherwise let the hold fall by `decay` (per update) but never below the live
 * value. `decay` is a 0–1 retention factor (0.92 ≈ a slow visible fall-off).
 */
export function decayPeakHold(hold: number, value: number, decay = 0.92): number {
  if (value >= hold) return value;
  return Math.max(value, hold * decay);
}

export interface TimeSeriesPoint {
  time: number;
  value: number;
}

/**
 * Build an SVG polyline path from time-series points, normalising x by `duration`
 * (→ 0–100) and y via `yFn`. Non-finite values break the line into segments
 * (so silence/NaN gaps render as gaps, not interpolated drops to the floor).
 */
export function buildTimeSeriesPath(
  series: TimeSeriesPoint[],
  duration: number,
  yFn: (value: number) => number,
): string {
  const span = duration || 1;
  let path = '';
  let drawing = false;
  for (const point of series) {
    if (!Number.isFinite(point.value)) {
      drawing = false;
      continue;
    }
    const x = clamp((point.time / span) * 100, 0, 100);
    const y = yFn(point.value);
    path += `${drawing ? 'L' : 'M'} ${x.toFixed(2)},${y.toFixed(2)} `;
    drawing = true;
  }
  return path.trim();
}
