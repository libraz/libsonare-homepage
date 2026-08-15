import { describe, expect, it } from 'vitest';
import {
  ATTACK_MAX_MS,
  ATTACK_MIN_MS,
  buildSynthPatch,
  controlsFromPreset,
  hzToNorm,
  logKnobHz,
  msLabel,
  type SynthTweakKey,
} from '@/components/synth/synthPatchState';

describe('synth patch state helpers', () => {
  it('maps logarithmic knobs in both directions', () => {
    const norm = hzToNorm(100, 10, 1000);

    expect(norm).toBeCloseTo(0.5);
    expect(logKnobHz(norm, 10, 1000)).toBe(100);
  });

  it('formats millisecond labels', () => {
    expect(msLabel(250)).toBe('250 ms');
    expect(msLabel(1500)).toBe('1.5 s');
  });

  it('derives controls and reset values from a preset patch', () => {
    const { controls, baseValues } = controlsFromPreset({
      waveform: 'saw',
      filterModel: 'svf',
      cutoffHz: 400,
      ampAttackMs: ATTACK_MIN_MS,
      ampReleaseMs: ATTACK_MAX_MS,
      resonanceQ: 99,
      stereoSpread: 2,
    });

    expect(controls.waveform).toBe('saw');
    expect(controls.filterModel).toBe('svf');
    expect(controls.resonanceQ).toBe(12);
    expect(controls.stereoSpread).toBe(1);
    expect(baseValues.cutoffNorm).toBe(controls.cutoffNorm);
  });

  it('returns only dirty overrides when building a patch', () => {
    const controls = controlsFromPreset({ waveform: 'sine', cutoffHz: 1000 }).controls;
    const dirty = new Set<SynthTweakKey>(['waveform', 'cutoffHz']);

    expect(buildSynthPatch('warm-pad', new Set(), controls)).toBe('warm-pad');
    expect(buildSynthPatch('warm-pad', dirty, { ...controls, waveform: 'square' })).toMatchObject({
      preset: 'warm-pad',
      waveform: 'square',
      cutoffHz: expect.any(Number),
    });
  });

  it('emits zero-valued overrides so a centered width reaches the engine', () => {
    const controls = controlsFromPreset({ stereoSpread: 0.6, glideMs: 120 }).controls;
    const dirty = new Set<SynthTweakKey>(['stereoSpread', 'glideMs']);

    const patch = buildSynthPatch('warm-pad', dirty, {
      ...controls,
      stereoSpread: 0,
      glideMs: 0,
    });

    expect(patch).toMatchObject({ preset: 'warm-pad', stereoSpread: 0, glideMs: 0 });
    expect(Object.hasOwn(patch as object, 'stereoSpread')).toBe(true);
    expect(Object.hasOwn(patch as object, 'glideMs')).toBe(true);
  });

  it('keeps an untouched zero-valued control out of the patch', () => {
    const controls = controlsFromPreset({ stereoSpread: 0, glideMs: 0 }).controls;

    expect(buildSynthPatch('warm-pad', new Set(['glideMs']), controls)).not.toHaveProperty(
      'stereoSpread',
    );
  });
});
