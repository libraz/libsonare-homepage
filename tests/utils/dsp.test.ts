import { describe, expect, it } from 'vitest';
import { advancePhase, hannWindow, olaNormalize, reverbStep, ringModulate } from '@/utils/dsp';

describe('hannWindow', () => {
  it('starts and ends at zero', () => {
    const w = hannWindow(1024);
    expect(w[0]).toBeCloseTo(0, 6);
    expect(w[w.length - 1]).toBeCloseTo(0, 6);
  });
  it('peaks at 1.0 in the centre', () => {
    const w = hannWindow(1025); // odd length has an exact centre sample
    expect(w[512]).toBeCloseTo(1, 6);
  });
  it('satisfies the COLA constraint at 50% overlap (interior window-sum ~1)', () => {
    const FRAME = 4096;
    const HOP = 2048;
    const w = hannWindow(FRAME);
    const acc = new Float64Array(FRAME * 3);
    for (let start = 0; start < FRAME * 2; start += HOP) {
      for (let i = 0; i < FRAME; i++) acc[start + i] += w[i];
    }
    // Interior region (away from ramp-up/down edges) should sum to a constant ~1.
    for (let i = FRAME; i < FRAME * 2; i++) {
      expect(acc[i]).toBeCloseTo(1, 2);
    }
  });
});

describe('olaNormalize', () => {
  it('divides accumulator by window sum', () => {
    expect(olaNormalize(2, 4)).toBe(0.5);
  });
  it('returns 0 when the window sum is below threshold', () => {
    expect(olaNormalize(5, 1e-9)).toBe(0);
  });
});

describe('ringModulate', () => {
  it('passes the dry sample through at amount 0', () => {
    expect(ringModulate(0.7, -1, 0)).toBeCloseTo(0.7, 6);
  });
  it('fully modulates by the carrier at amount 1', () => {
    expect(ringModulate(0.7, -1, 1)).toBeCloseTo(-0.7, 6);
  });
});

describe('advancePhase', () => {
  it('advances by the per-sample increment', () => {
    expect(advancePhase(0, 55, 48000)).toBeCloseTo((2 * Math.PI * 55) / 48000, 9);
  });
  it('wraps past 2π', () => {
    const next = advancePhase(Math.PI * 2 - 1e-9, 55, 48000);
    expect(next).toBeLessThan(Math.PI * 2);
    expect(next).toBeGreaterThanOrEqual(0);
  });
});

describe('reverbStep', () => {
  it('is dry (output equals input) at amount 0', () => {
    const { state, output } = reverbStep(0, 0.5, 0);
    expect(output).toBeCloseTo(0.5, 6);
    expect(state).toBe(0);
  });
  it('stays bounded under sustained input (no blow-up)', () => {
    let state = 0;
    let last = 0;
    for (let i = 0; i < 5000; i++) {
      const r = reverbStep(state, 0.5, 0.8);
      state = r.state;
      last = r.output;
    }
    expect(Number.isFinite(last)).toBe(true);
    expect(Math.abs(last)).toBeLessThan(5);
  });
});
