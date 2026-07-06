import { describe, expect, it } from 'vitest';
import { COMPARE_FRAMES, COMPARE_SR } from '@/components/tuner/tunerReference';
import {
  type AutofitResult,
  fitDimensions,
  OracleTooShortError,
  prepareOracle,
  runAutofit,
} from '@/tuner/dsp/autofit';
import { buildDefaultSpec, renderNoteOffline } from '@/tuner/dsp/engine';

const OPTS = { maxGen: 18, wallClockMs: 60000, rngSeed: 0x1234abcd };

async function drain(
  gen: AsyncGenerator<unknown, AutofitResult, void>,
): Promise<{ result: AutofitResult; steps: number }> {
  let steps = 0;
  for (;;) {
    const s = await gen.next();
    if (s.done) return { result: s.value, steps };
    ++steps;
  }
}

describe('fitDimensions', () => {
  it('varies core scalars and freezes toggles / structural / unobservable keys', () => {
    const keys = fitDimensions(buildDefaultSpec('karplus-strong')).map((d) => d.key);
    expect(keys).toContain('brightness');
    expect(keys).toContain('decayS');
    expect(keys).toContain('pickPosition');
    // Frozen: fixed-velocity/no-release unobservable + boolean topology.
    expect(keys).not.toContain('velToBrightness');
    expect(keys).not.toContain('releaseDampS');
    expect(keys).not.toContain('keyoffNoise');
    expect(keys).not.toContain('sympathetic');
  });

  it('freezes structural / mapping integers on percussion', () => {
    const keys = fitDimensions(buildDefaultSpec('percussion')).map((d) => d.key);
    for (const k of ['numModes', 'shellNumModes', 'gmKit', 'exclusiveClass', 'noiseOutput']) {
      expect(keys).not.toContain(k);
    }
    expect(keys).toContain('modeDecayS');
  });
});

describe('prepareOracle', () => {
  it('rejects a too-short / silent buffer', () => {
    expect(() => prepareOracle(new Float32Array(2048), COMPARE_SR)).toThrow(OracleTooShortError);
  });

  it('trims leading silence to note-on and peak-normalizes', () => {
    const raw = new Float32Array(COMPARE_SR);
    for (let i = 20000; i < COMPARE_SR; ++i) raw[i] = 0.3 * Math.sin(i * 0.05);
    const out = prepareOracle(raw, COMPARE_SR);
    // Leading silence dropped (minus the small attack back-off).
    expect(out.length).toBeLessThan(raw.length - 19000);
    let peak = 0;
    for (const v of out) peak = Math.max(peak, Math.abs(v));
    expect(peak).toBeCloseTo(0.9, 2);
  });
});

describe('runAutofit self-recovery', () => {
  it('recovers a perturbed KS voice from its own render', async () => {
    const note = 57;
    const velocity = 100;
    // Build a target by perturbing four core KS params, then render it.
    const target = buildDefaultSpec('karplus-strong');
    target.ks.brightness = 0.3;
    target.ks.decayS = 1.5;
    target.ks.pickPosition = 0.35;
    target.ks.excBrightness = 0.5;
    const oracleRaw = renderNoteOffline(target, note, velocity, COMPARE_SR, COMPARE_FRAMES);
    const oracle = prepareOracle(oracleRaw, COMPARE_SR);

    const start = buildDefaultSpec('karplus-strong');
    const { result } = await drain(
      runAutofit(start, oracle, note, velocity, COMPARE_SR, COMPARE_FRAMES, OPTS),
    );

    // The target is reachable, so the fit should land very close.
    expect(result.specSimPct).toBeGreaterThan(90);
    expect(result.bestLoss).toBeLessThan(0.06);
    expect(result.dims).toBeGreaterThan(3);
  }, 30000);
});
