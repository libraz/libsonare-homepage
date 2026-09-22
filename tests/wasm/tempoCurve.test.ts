// @vitest-environment node
import { describe, expect, it } from 'vitest';
import * as wasm from '@/wasm/index.js';

/**
 * The type reference says `beatLocalBpm` is decoded on a tempo grid about 3%
 * apart, so a steady track reads near its tempo rather than on it. This holds
 * that sentence to the engine.
 */

const SAMPLE_RATE = 22_050;

/** A steady click track: one short decaying burst per beat. */
function clicks(bpm: number, seconds: number): Float32Array {
  const samples = new Float32Array(SAMPLE_RATE * seconds);
  for (let t = 0.5; t < seconds - 0.1; t += 60 / bpm) {
    const start = Math.floor(t * SAMPLE_RATE);
    for (let k = 0; k < 400; k++)
      samples[start + k] += Math.sin(k * 0.3) * Math.exp(-k / 120) * 0.7;
  }
  return samples;
}

function curve(bpm: number): number[] {
  return Array.from(
    wasm.analyze(clicks(bpm, 16), SAMPLE_RATE, { computeTempoCurve: true, adaptiveTempo: true })
      .beatLocalBpm,
  );
}

describe('beatLocalBpm resolution', () => {
  it('reads a steady track as one grid value within about 1.5% of its tempo', async () => {
    await wasm.init();
    for (const bpm of [110, 120, 128]) {
      const values = new Set(curve(bpm).map((v) => v.toFixed(3)));
      expect(values.size, `${bpm} BPM`).toBe(1);
      const value = Number([...values][0]);
      expect(Math.abs(value / bpm - 1), `${bpm} BPM read as ${value}`).toBeLessThan(0.016);
    }
  }, 60_000);

  it('collapses neighbouring tempos onto steps about 3% apart', async () => {
    await wasm.init();
    const steps = [
      ...new Set([110, 112, 114, 116, 118, 120, 122, 124, 126, 128].map((bpm) => curve(bpm)[4])),
    ].sort((a, b) => a - b);
    expect(steps.length).toBeLessThan(8);
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i] / steps[i - 1] - 1).toBeGreaterThan(0.025);
    }
  }, 60_000);
});
