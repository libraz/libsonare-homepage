// @vitest-environment node
import { describe, expect, it } from 'vitest';
import * as wasm from '@/wasm/index.js';

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

const curveCache = new Map<number, number[]>();

function curve(bpm: number): number[] {
  const cached = curveCache.get(bpm);
  if (cached) return cached;

  const decoded = Array.from(
    wasm.analyze(clicks(bpm, 16), SAMPLE_RATE, { computeTempoCurve: true, adaptiveTempo: true })
      .beatLocalBpm,
  );
  curveCache.set(bpm, decoded);
  return decoded;
}

describe('beatLocalBpm resolution', () => {
  it('reports finite positive values within about 1.5% of a steady tempo', async () => {
    await wasm.init();
    for (const bpm of [110, 120, 128]) {
      const values = curve(bpm);
      expect(values.length, `${bpm} BPM curve`).toBeGreaterThan(0);
      for (const value of values) {
        expect(Number.isFinite(value), `${bpm} BPM value`).toBe(true);
        expect(value, `${bpm} BPM value`).toBeGreaterThan(0);
        expect(Math.abs(value / bpm - 1), `${bpm} BPM read as ${value}`).toBeLessThan(0.015);
      }
    }
  }, 60_000);

  it('retains distinct values for neighbouring tempos', async () => {
    await wasm.init();
    const tempos = [110, 112, 114, 116, 118, 120, 122, 124, 126, 128];
    const values = tempos.map((bpm) => curve(bpm)[4].toFixed(3));
    expect(new Set(values).size).toBeGreaterThan(8);
  }, 60_000);
});
