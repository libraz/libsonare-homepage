import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  buildTruePeakAudio,
  buildTruePeakSampleModel,
  truePeakFrequencyHz,
} from '@/demos/inline/archetypes/truePeakMath';
import * as wasm from '@/wasm/index.js';

function peak(samples: Float32Array): number {
  let value = 0;
  for (const sample of samples) value = Math.max(value, Math.abs(sample));
  return value;
}

function estimateFrequency(samples: Float32Array, sampleRate: number): number {
  // The generated signal starts at a known phase, so adjacent positive-going
  // zero crossings provide an independent check of the slider-to-PCM path.
  const crossings: number[] = [];
  for (let i = 1; i < samples.length; i++) {
    if (samples[i - 1] <= 0 && samples[i] > 0) crossings.push(i);
  }
  const periods = crossings.slice(1).map((sample, index) => sample - crossings[index]!);
  const meanPeriod = periods.reduce((sum, value) => sum + value, 0) / periods.length;
  return sampleRate / meanPeriod;
}

beforeAll(async () => {
  await wasm.init({ wasmBinary: readFileSync(join(process.cwd(), 'src/wasm/sonare.wasm')) });
}, 30_000);

describe('true peak demo sample model', () => {
  it.each([0.3, 0.4, 0.48])(
    'normalizes the actual finite sample column at %s × Nyquist',
    (nyquistFraction) => {
      const model = buildTruePeakSampleModel(-0.3, nyquistFraction);
      const requestedPeak = 10 ** (-0.3 / 20);
      const measuredPeak = Math.max(...model.values.map((value) => Math.abs(value)));

      expect(model.samplePeak).toBeCloseTo(measuredPeak, 12);
      expect(measuredPeak).toBeLessThanOrEqual(requestedPeak + 1e-6);
      expect(model.truePeakDb).toBeCloseTo(20 * Math.log10(model.continuousPeak), 12);
      expect(model.values).toHaveLength(model.phases.length);
    },
  );

  it('does not invent an inter-sample overshoot when another visible sample hits the peak', () => {
    const model = buildTruePeakSampleModel(-0.3, 0.4);
    expect(model.truePeakDb).toBeCloseTo(-0.3, 10);
  });

  it('builds audition PCM at the selected Nyquist fraction and requested sample peak', () => {
    const low = buildTruePeakAudio(-0.3, 0.2);
    const high = buildTruePeakAudio(-0.3, 0.4);
    const requestedPeak = 10 ** (-0.3 / 20);

    expect(low.frequencyHz).toBeCloseTo(truePeakFrequencyHz(0.2, low.sampleRate), 12);
    expect(high.frequencyHz).toBeCloseTo(truePeakFrequencyHz(0.4, high.sampleRate), 12);
    expect(estimateFrequency(low.samples, low.sampleRate)).toBeCloseTo(low.frequencyHz, -1);
    expect(estimateFrequency(high.samples, high.sampleRate)).toBeCloseTo(high.frequencyHz, -1);
    expect(peak(low.samples)).toBeCloseTo(requestedPeak, 6);
    expect(peak(high.samples)).toBeCloseTo(requestedPeak, 6);
    expect(low.samples).not.toEqual(high.samples);
  });

  it('produces a measurable inter-sample overshoot for the selected finite PCM', () => {
    const audio = buildTruePeakAudio(-0.3, 0.3);
    const samplePeakDb = 20 * Math.log10(peak(audio.samples));
    const measuredTruePeakDb = wasm.meteringTruePeakDb(audio.samples, audio.sampleRate, 16);

    expect(samplePeakDb).toBeCloseTo(-0.3, 5);
    expect(measuredTruePeakDb).toBeGreaterThan(samplePeakDb + 0.02);
  });
});
