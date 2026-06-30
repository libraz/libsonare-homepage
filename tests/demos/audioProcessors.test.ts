import { describe, expect, it } from 'vitest';
import { peakNormalize, shelfFilter } from '@/demos/audio/processors';

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
