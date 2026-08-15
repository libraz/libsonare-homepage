import { describe, expect, it } from 'vitest';
import {
  LOUDNESS_HOP_SEC,
  loudnessContourColumns,
  MOMENTARY_WINDOW_SEC,
  SHORT_TERM_WINDOW_SEC,
} from '@/components/demos/archetypes/loudnessContour';

const FLOOR = -40;
const COLS = 240;

/** Series length a meter emits for a clip, in the sample domain the engine works in. */
function blockCount(durationSec: number, windowSec: number, sampleRate = 32000) {
  const total = Math.round(durationSec * sampleRate);
  const window = Math.round(windowSec * sampleRate);
  const hop = Math.round(LOUDNESS_HOP_SEC * sampleRate);
  if (total < window) return 0;
  return Math.floor((total - window) / hop) + 1;
}

function ramp(n: number) {
  return Float32Array.from({ length: n }, (_, i) => -30 + i);
}

describe('loudnessContourColumns', () => {
  // Counts match what libsonare 1.7.0 returns for the `band` demo clip (4.6 s @ 32 kHz):
  // 43 momentary values and 17 short-term values.
  it('matches the block counts the engine emits', () => {
    expect(blockCount(4.6, MOMENTARY_WINDOW_SEC)).toBe(43);
    expect(blockCount(4.6, SHORT_TERM_WINDOW_SEC)).toBe(17);
  });

  it('starts the contour one window into the clip, not at t = 0', () => {
    const duration = 4.6;
    const shortTerm = loudnessContourColumns(
      ramp(blockCount(duration, SHORT_TERM_WINDOW_SEC)),
      duration,
      SHORT_TERM_WINDOW_SEC,
      COLS,
      FLOOR,
    );
    // 3 s of a 4.6 s clip is unmeasured, so roughly the first two thirds of the axis.
    const startTime = (shortTerm.start / (COLS - 1)) * duration;
    expect(startTime).toBeGreaterThanOrEqual(SHORT_TERM_WINDOW_SEC);
    expect(startTime - SHORT_TERM_WINDOW_SEC).toBeLessThan(duration / (COLS - 1));
    expect(shortTerm.values[shortTerm.start - 1]).toBe(FLOOR);

    const momentary = loudnessContourColumns(
      ramp(blockCount(duration, MOMENTARY_WINDOW_SEC)),
      duration,
      MOMENTARY_WINDOW_SEC,
      COLS,
      FLOOR,
    );
    expect((momentary.start / (COLS - 1)) * duration).toBeGreaterThanOrEqual(MOMENTARY_WINDOW_SEC);
    expect(momentary.start).toBeLessThan(shortTerm.start);
  });

  it('places each value at the end of the window it was measured over', () => {
    const duration = 5;
    const n = blockCount(duration, SHORT_TERM_WINDOW_SEC);
    const series = ramp(n);
    const { values } = loudnessContourColumns(series, duration, SHORT_TERM_WINDOW_SEC, COLS, FLOOR);

    for (const i of [0, 5, n - 1]) {
      // First column at or after the block's end time; column spacing is well under
      // one hop, so the interpolated value is within a fraction of a series step.
      const t = i * LOUDNESS_HOP_SEC + SHORT_TERM_WINDOW_SEC;
      const col = Math.ceil((t / duration) * (COLS - 1));
      expect(values[col]).toBeCloseTo(series[i], 0);
    }

    // Stretching the series linearly across the whole clip — the mapping this helper
    // replaces — would read a much later block at the same column.
    const midCol = Math.ceil((3.5 / duration) * (COLS - 1));
    const stretched = series[Math.round((midCol / (COLS - 1)) * (n - 1))];
    expect(values[midCol]).toBeCloseTo(series[5], 0);
    expect(Math.abs(values[midCol] - stretched)).toBeGreaterThan(5);
  });

  it('reports no measurement when the clip is shorter than the window', () => {
    const contour = loudnessContourColumns(
      new Float32Array(0),
      2,
      SHORT_TERM_WINDOW_SEC,
      COLS,
      FLOOR,
    );
    expect(contour.start).toBe(COLS);
    expect([...contour.values].every((v) => v === FLOOR)).toBe(true);
  });

  it('holds the last value through the final column', () => {
    const duration = 4.6;
    const n = blockCount(duration, MOMENTARY_WINDOW_SEC);
    const series = ramp(n);
    const { values } = loudnessContourColumns(series, duration, MOMENTARY_WINDOW_SEC, COLS, FLOOR);
    expect(values[COLS - 1]).toBeCloseTo(series[n - 1], 1);
  });
});
