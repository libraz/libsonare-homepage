import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import * as wasm from '@/wasm/index.js';

function sine(frequency: number, sampleRate: number, length: number): Float32Array {
  const samples = new Float32Array(length);
  for (let i = 0; i < samples.length; i++) {
    samples[i] = Math.sin((2 * Math.PI * frequency * i) / sampleRate);
  }
  return samples;
}

function rms(samples: Float32Array): number {
  let sum = 0;
  for (const sample of samples) sum += sample * sample;
  return Math.sqrt(sum / samples.length);
}

describe('mastering reference resampling', () => {
  beforeAll(async () => {
    await wasm.init({ wasmBinary: readFileSync(join(process.cwd(), 'src/wasm/sonare.wasm')) });
  }, 30_000);

  it('rejects content above the target Nyquist while preserving an in-band tone', () => {
    const sourceRate = 48_000;
    const targetRate = 16_000;
    const inputLength = sourceRate;
    const highFrequency = wasm.resample(
      sine(12_000, sourceRate, inputLength),
      sourceRate,
      targetRate,
    );
    const inBand = wasm.resample(sine(3_000, sourceRate, inputLength), sourceRate, targetRate);

    // Ignore the short filter warm-up at the start of each output.
    expect(rms(highFrequency.subarray(256))).toBeLessThan(0.02);
    expect(rms(inBand.subarray(256))).toBeGreaterThan(0.6);
    expect(inBand).toHaveLength(inputLength / 3);
  });
});
