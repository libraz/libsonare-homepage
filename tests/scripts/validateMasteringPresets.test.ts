import { describe, expect, it, vi } from 'vitest';
import {
  assertFinite,
  buildConfig,
  length,
  makeReferenceMix,
  makeSyntheticMix,
  maxAbs,
  sampleRate,
  validateMasteringPresets,
} from '../../scripts/validate-mastering-presets.mjs';

const config = buildConfig({
  targetLufs: -14,
  tiltDb: 0.25,
  ratio: 2,
  air: 0.2,
  width: 1.05,
});

function validOutput(
  overrides: Partial<{
    left: Float32Array;
    right: Float32Array;
    inputLufs: number;
    outputLufs: number;
    appliedGainDb: number;
    stages: string[];
  }> = {},
) {
  return {
    left: new Float32Array(length).fill(0.2),
    right: new Float32Array(length).fill(-0.18),
    inputLufs: -18,
    outputLufs: -14.2,
    appliedGainDb: 3.8,
    stages: ['eq.tilt', 'maximizer.truePeakLimiter'],
    ...overrides,
  };
}

describe('validate-mastering-presets script helpers', () => {
  it('builds mastering configs with optional repair and expected processor settings', () => {
    expect(config).toMatchObject({
      eq: { tiltDb: 0.25, pivotHz: 1000 },
      dynamics: { compressor: { ratio: 2, autoMakeup: true } },
      spectral: { airBand: { amount: 0.2 } },
      stereo: { imager: { width: 1.05, preserveEnergy: true } },
      loudness: { targetLufs: -14, truePeakOversample: 4 },
    });
    expect(config.repair).toBeUndefined();

    expect(
      buildConfig({
        targetLufs: -16,
        tiltDb: 0,
        ratio: 3,
        air: 0.1,
        width: 0.9,
        denoise: true,
      }).repair,
    ).toEqual({ denoise: true, gainFloor: 0.1 });
  });

  it('creates deterministic stereo source and reference mixes with finite bounded samples', () => {
    const source = makeSyntheticMix();
    const reference = makeReferenceMix();

    expect(source.left.length).toBe(sampleRate * 2);
    expect(source.right.length).toBe(length);
    expect(reference.left.length).toBe(length);
    expect(maxAbs(source.left)).toBeGreaterThan(0);
    expect(maxAbs(source.left)).toBeLessThan(1);
    expect(maxAbs(reference.right)).toBeGreaterThan(0);
    expect(Number.isFinite(source.left[1234])).toBe(true);
  });

  it('returns no failures and emits progress logs for valid API results', async () => {
    const log = vi.fn();
    const api = {
      init: vi.fn().mockResolvedValue(undefined),
      version: vi.fn(() => 'test-version'),
      masteringChainStereo: vi.fn(() => validOutput()),
      masteringPairAnalyze: vi.fn(() => 'reference report'),
    };

    await expect(
      validateMasteringPresets({
        api,
        presetEntries: [['unit', config]],
        log,
      }),
    ).resolves.toEqual([]);

    expect(api.init).toHaveBeenCalledOnce();
    expect(api.masteringChainStereo).toHaveBeenCalledWith(
      expect.any(Float32Array),
      expect.any(Float32Array),
      sampleRate,
      config,
    );
    expect(api.masteringPairAnalyze).toHaveBeenCalledWith(
      'match.referenceLoudness',
      expect.any(Float32Array),
      expect.any(Float32Array),
      sampleRate,
      {},
    );
    expect(log).toHaveBeenCalledWith('libsonare test-version');
    expect(log).toHaveBeenCalledWith(expect.stringContaining('unit: -14.20 LUFS'));
    expect(log).toHaveBeenCalledWith('reference analysis: ok');
  });

  it('collects validation failures for invalid mastering outputs and reference analysis', async () => {
    const api = {
      init: vi.fn().mockResolvedValue(undefined),
      version: vi.fn(() => 'test-version'),
      masteringChainStereo: vi
        .fn()
        .mockReturnValueOnce(validOutput({ inputLufs: -18, outputLufs: -25 }))
        .mockReturnValueOnce(validOutput({ stages: [] }))
        .mockReturnValueOnce(validOutput({ left: new Float32Array([0.1]) }))
        .mockReturnValueOnce(validOutput({ left: new Float32Array(length).fill(1.2) })),
      masteringPairAnalyze: vi.fn(() => ''),
    };

    await expect(
      validateMasteringPresets({
        api,
        presetEntries: [
          ['lufs', config],
          ['stages', config],
          ['length', config],
          ['peak', config],
        ],
      }),
    ).resolves.toEqual([
      'lufs: output LUFS -25.00 fell below floor -18.50 (input -18.00, target -14)',
      'stages: no mastering stages were applied',
      `length: unexpected output length 1/${length}`,
      'peak: invalid peak 1.2000000476837158',
      'reference analysis: empty pair analysis report',
    ]);
  });

  it('allows denoise presets to land below target within the headroom shortfall', async () => {
    // loudness.optimize cannot boost past the true-peak ceiling, so denoise
    // presets may fall short of the target after the repair removes loudness.
    const denoiseConfig = buildConfig({
      targetLufs: -14,
      tiltDb: 0,
      ratio: 2,
      air: 0.2,
      width: 1,
      denoise: true,
    });
    const api = {
      init: vi.fn().mockResolvedValue(undefined),
      version: vi.fn(() => 'test-version'),
      masteringChainStereo: vi.fn(() =>
        validOutput({
          inputLufs: -15.5,
          outputLufs: -18.9,
          stages: ['repair.denoise', 'loudness.optimize'],
        }),
      ),
      masteringPairAnalyze: vi.fn(() => 'report'),
    };

    await expect(
      validateMasteringPresets({ api, presetEntries: [['aiMusic', denoiseConfig]] }),
    ).resolves.toEqual([]);
  });

  it('throws helpful errors for non-finite scalar values', () => {
    expect(() => assertFinite('value', Number.NaN)).toThrow('value is not finite');
    expect(() => assertFinite('value', Number.POSITIVE_INFINITY)).toThrow('value is not finite');
    expect(() => assertFinite('value', 1)).not.toThrow();
  });
});
