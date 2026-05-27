import { describe, expect, it } from 'vitest';
import {
  buildTimeSeriesPath,
  clamp,
  dbToLinear,
  decayPeakHold,
  invertedRangeToPercent,
  meterFillPercent,
} from '@/utils/scale';

describe('clamp', () => {
  it('bounds within range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });
});

describe('dbToLinear', () => {
  it('maps 0 dB to unity', () => {
    expect(dbToLinear(0)).toBeCloseTo(1, 6);
  });
  it('maps -6 dB to ~0.5', () => {
    expect(dbToLinear(-6.0206)).toBeCloseTo(0.5, 4);
  });
  it('allows gain above unity for positive dB', () => {
    expect(dbToLinear(6.0206)).toBeCloseTo(2, 3);
  });
});

describe('invertedRangeToPercent', () => {
  it('puts min at the bottom (100%) and max at the top (0%)', () => {
    expect(invertedRangeToPercent(-40, -40, 0)).toBe(100);
    expect(invertedRangeToPercent(0, -40, 0)).toBe(0);
    expect(invertedRangeToPercent(-20, -40, 0)).toBe(50);
  });
  it('clamps out-of-range values', () => {
    expect(invertedRangeToPercent(10, -40, 0)).toBe(0);
    expect(invertedRangeToPercent(-99, -40, 0)).toBe(100);
  });
  it('reproduces the legacy loudnessY mapping', () => {
    const legacy = (value: number) => {
      const clamped = Math.max(-40, Math.min(0, value));
      return (1 - (clamped - -40) / (0 - -40)) * 100;
    };
    for (const v of [-50, -40, -33.3, -12, 0, 5]) {
      expect(invertedRangeToPercent(v, -40, 0)).toBeCloseTo(legacy(v), 6);
    }
  });
  it('handles a zero-width range without dividing by zero', () => {
    expect(Number.isFinite(invertedRangeToPercent(5, 3, 3))).toBe(true);
  });
});

describe('meterFillPercent', () => {
  it('pegs unity amplitude at 100%', () => {
    expect(meterFillPercent(1)).toBe(100);
  });
  it('puts the floor at the minimum height', () => {
    expect(meterFillPercent(0)).toBe(2);
  });
  it('maps -30 dB to the midpoint of a -60 dB scale', () => {
    expect(meterFillPercent(10 ** (-30 / 20))).toBeCloseTo(50, 4);
  });
});

describe('decayPeakHold', () => {
  it('snaps up instantly when the value exceeds the hold', () => {
    expect(decayPeakHold(0.3, 0.8)).toBe(0.8);
    expect(decayPeakHold(0, 0.5)).toBe(0.5);
  });
  it('decays the hold toward the live value when it falls', () => {
    expect(decayPeakHold(1, 0, 0.92)).toBeCloseTo(0.92, 6);
    expect(decayPeakHold(0.5, 0.1, 0.9)).toBeCloseTo(0.45, 6);
  });
  it('never decays below the current value', () => {
    expect(decayPeakHold(0.5, 0.48, 0.9)).toBe(0.48);
  });
  it('holds steady when value equals the hold', () => {
    expect(decayPeakHold(0.7, 0.7)).toBe(0.7);
  });
});

describe('buildTimeSeriesPath', () => {
  const identityY = (v: number) => v;
  it('emits M then L commands and normalises x by duration', () => {
    const path = buildTimeSeriesPath(
      [
        { time: 0, value: 10 },
        { time: 5, value: 20 },
        { time: 10, value: 30 },
      ],
      10,
      identityY,
    );
    expect(path).toBe('M 0.00,10.00 L 50.00,20.00 L 100.00,30.00');
  });
  it('breaks the line on non-finite values', () => {
    const path = buildTimeSeriesPath(
      [
        { time: 0, value: 1 },
        { time: 5, value: NaN },
        { time: 10, value: 3 },
      ],
      10,
      identityY,
    );
    // After the gap the next point must start a new sub-path with M, not L.
    expect(path).toBe('M 0.00,1.00 M 100.00,3.00');
  });
  it('returns empty string for empty input', () => {
    expect(buildTimeSeriesPath([], 10, identityY)).toBe('');
  });
});
