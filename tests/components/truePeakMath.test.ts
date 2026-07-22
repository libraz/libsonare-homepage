import { describe, expect, it } from 'vitest';
import { buildTruePeakSampleModel } from '@/components/demos/archetypes/truePeakMath';

describe('true peak demo sample model', () => {
  it.each([
    0.3, 0.4, 0.48,
  ])('normalizes the actual finite sample column at %s × Nyquist', (nyquistFraction) => {
    const model = buildTruePeakSampleModel(-0.3, nyquistFraction);
    const requestedPeak = 10 ** (-0.3 / 20);
    const measuredPeak = Math.max(...model.values.map((value) => Math.abs(value)));

    expect(model.samplePeak).toBeCloseTo(requestedPeak, 12);
    expect(measuredPeak).toBeCloseTo(requestedPeak, 12);
    expect(model.truePeakDb).toBeCloseTo(20 * Math.log10(model.continuousPeak), 12);
    expect(model.values).toHaveLength(model.phases.length);
  });

  it('does not invent an inter-sample overshoot when another visible sample hits the peak', () => {
    const model = buildTruePeakSampleModel(-0.3, 0.4);
    expect(model.truePeakDb).toBeCloseTo(-0.3, 10);
  });
});
