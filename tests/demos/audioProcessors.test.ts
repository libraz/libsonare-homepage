import { describe, expect, it, vi } from 'vitest';
import {
  averagedSpectrum,
  hexA,
  mulberry32,
  peakEnvelope,
  peakNormalize,
  type StftProvider,
  shelfFilter,
} from '@/demos/audio/processors';

describe('demo audio processors', () => {
  it('normalizes peak amplitude in place', () => {
    const samples = new Float32Array([0.1, -0.5, 0.25]);
    const out = peakNormalize(samples, 0.8);

    expect(out).toBe(samples);
    expect(Math.max(...Array.from(out, Math.abs))).toBeCloseTo(0.8, 5);
  });

  it('returns a new finite buffer for shelf filtering', () => {
    const samples = new Float32Array(128);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.sin(i / 8) * 0.25;

    const out = shelfFilter(samples, 44_100, 'high', 800, 3);

    expect(out).not.toBe(samples);
    expect(out).toHaveLength(samples.length);
    expect(Array.from(out).every(Number.isFinite)).toBe(true);
  });
});

describe('peakEnvelope', () => {
  const samples = new Float32Array([0.1, -0.4, 0.2, 0.8, -0.2, 0.1]);

  it('fills per-column peaks normalized to the loudest column', () => {
    const out = new Float32Array(3);

    peakEnvelope(samples, out);

    // Columns cover [0,2) [2,4) [4,6): peaks 0.4, 0.8, 0.2 → normalized by 0.8.
    expect(Array.from(out)).toEqual([0.5, 1, 0.25]);
  });

  it('keeps raw peaks on a shared clamped scale when a scale is passed', () => {
    const out = new Float32Array(3);

    peakEnvelope(samples, out, 2);

    // 0.4/0.8/0.2 × 2 = 0.8/1.6/0.4, each clamped to 1.
    expect(out[0]).toBeCloseTo(0.8, 6);
    expect(out[1]).toBe(1);
    expect(out[2]).toBeCloseTo(0.4, 6);
  });

  it('never leaves an empty column when the input is shorter than the output', () => {
    const out = new Float32Array(4);

    peakEnvelope(new Float32Array([0.5, -1]), out);

    // Every column resolves to a real sample rather than a zero gap.
    expect(Array.from(out).every((v) => v > 0)).toBe(true);
  });
});

describe('averagedSpectrum', () => {
  function fakeWasm(): StftProvider {
    return {
      // Two frames × four bins: per-bin time averages are 1.5, 1.5, 0.75, 0.375.
      stft: vi.fn(() => ({
        nBins: 4,
        nFrames: 2,
        magnitude: new Float32Array([1, 2, 2, 1, 0.5, 1, 0.25, 0.5]),
      })),
    };
  }

  it('averages over time and returns the peak linear magnitude', () => {
    const wasm = fakeWasm();
    const out = new Float32Array(5);

    const peak = averagedSpectrum(wasm, new Float32Array(8), 44_100, out, 4000, 1);

    expect(wasm.stft).toHaveBeenCalledWith(new Float32Array(8), 44_100, 2048, 512);
    expect(peak).toBeCloseTo(1.5, 5);
    expect(Array.from(out).every(Number.isFinite)).toBe(true);
  });

  it('normalizes the peak bin to 1 when handed the shared 1/peak scale', () => {
    const wasm = fakeWasm();
    const out = new Float32Array(5);

    const peak = averagedSpectrum(wasm, new Float32Array(8), 44_100, out, 4000, 1);
    averagedSpectrum(wasm, new Float32Array(8), 44_100, out, 4000, 1 / peak);

    // Column 0 maps to bin 0 (the peak); (peak × 1/peak)^0.6 = 1.
    expect(out[0]).toBeCloseTo(1, 5);
  });
});

describe('mulberry32', () => {
  it('is deterministic for a given seed', () => {
    const a = mulberry32(0x1234);
    const b = mulberry32(0x1234);
    const seqA = [a(), a(), a(), a()];
    const seqB = [b(), b(), b(), b()];

    expect(seqA).toEqual(seqB);
    expect(seqA.every((v) => v >= 0 && v < 1)).toBe(true);
  });

  it('diverges for different seeds', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);

    expect(a()).not.toEqual(b());
  });
});

describe('hexA', () => {
  it('expands a #rrggbb colour into rgba() with the given alpha', () => {
    expect(hexA('#2dd4bf', 0.5)).toBe('rgba(45, 212, 191, 0.5)');
    expect(hexA('#000000', 1)).toBe('rgba(0, 0, 0, 1)');
  });
});
