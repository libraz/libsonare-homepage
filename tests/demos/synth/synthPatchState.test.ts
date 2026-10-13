import { describe, expect, it } from 'vitest';
import {
  ATTACK_MAX_MS,
  ATTACK_MIN_MS,
  baseVoiceEngine,
  baseVoiceId,
  buildSynthPatch,
  controlsFromPreset,
  formatModelValue,
  groupModelFields,
  groupPresetsByEngine,
  hzToNorm,
  inertTweaks,
  logKnobHz,
  msLabel,
  type SynthTweakKey,
} from '@/demos/synth/synthPatchState';

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

describe('engine grouping', () => {
  const engines: Record<string, string> = {
    violin: 'bowed-string',
    saw: 'subtractive',
    cello: 'bowed-string',
    sine: 'subtractive',
    oddity: 'future-engine',
  };
  const engineOf = (name: string) => engines[name];

  it("orders groups by the engine's own mode order, each led by its base voice", () => {
    const groups = groupPresetsByEngine(['violin', 'saw', 'cello', 'sine'], engineOf, [
      'default',
      'subtractive',
      'fm',
      'bowed-string',
      'sample',
    ]);
    expect(groups).toEqual([
      { engine: 'subtractive', presets: ['base:subtractive', 'saw', 'sine'] },
      { engine: 'fm', presets: ['base:fm'] },
      { engine: 'bowed-string', presets: ['base:bowed-string', 'violin', 'cello'] },
    ]);
  });

  it('keeps an engine the order does not know, after the known ones', () => {
    const groups = groupPresetsByEngine(['oddity', 'saw'], engineOf, ['subtractive']);
    expect(groups.map((group) => group.engine)).toEqual(['subtractive', 'future-engine']);
  });
});

describe('base voices', () => {
  it('round-trips an engine through its program id', () => {
    expect(baseVoiceEngine(baseVoiceId('modal'))).toBe('modal');
    expect(baseVoiceEngine('e-piano')).toBeNull();
  });

  it('sends a base voice as an engine mode, with the touched fields and model keys', () => {
    const controls = controlsFromPreset({ cutoffHz: 1000 }).controls;
    expect(buildSynthPatch('base:fm', new Set(), controls)).toEqual({ engineMode: 'fm' });
    expect(
      buildSynthPatch('base:fm', new Set<SynthTweakKey>(['cutoffHz']), controls, { algorithm: 2 }),
    ).toEqual({ engineMode: 'fm', cutoffHz: 1000, engineParams: { algorithm: 2 } });
  });

  it('adds model keys to a named preset only once one is moved', () => {
    const controls = controlsFromPreset({}).controls;
    expect(buildSynthPatch('bell', new Set(), controls, {})).toBe('bell');
    expect(buildSynthPatch('bell', new Set(), controls, { decayS: 2 })).toEqual({
      preset: 'bell',
      engineParams: { decayS: 2 },
    });
  });
});

describe('model fields', () => {
  const field = (name: string, extra: object = {}) => ({
    name,
    type: 'number' as const,
    min: 0,
    max: 1,
    default: 0,
    unit: 'none' as const,
    ...extra,
  });

  it('splits a section into its top level, dotted and indexed sub-sections', () => {
    const groups = groupModelFields([
      field('algorithm', { integer: true, max: 5 }),
      field('ops0.ratio'),
      field('ops0.env.attackMs'),
      field('drawbars0'),
      field('drawbars1'),
      field('open', { min: undefined, max: undefined }),
      { name: 'stopped', type: 'boolean' as const, default: 0, unit: 'none' as const },
    ]);
    expect(groups.map((group) => [group.id, group.fields.map((f) => f.label)])).toEqual([
      ['', ['algorithm', 'stopped']],
      ['ops0', ['ratio', 'env.attackMs']],
      ['drawbars', ['0', '1']],
    ]);
  });

  it('reads a value in the unit the engine reports', () => {
    expect(formatModelValue(2.5, field('r', { unit: 'ratio' }))).toBe('×2.50');
    expect(formatModelValue(1500, field('t', { unit: 'ms' }))).toBe('1.5 s');
    expect(formatModelValue(-30, field('c', { unit: 'cents' }))).toBe('-30 ct');
    expect(formatModelValue(3.4, field('n', { integer: true }))).toBe('3');
  });
});

describe('inert tweaks', () => {
  it('leaves every control live on the subtractive engine, and on one not yet known', () => {
    expect(inertTweaks('subtractive').size).toBe(0);
    expect(inertTweaks('').size).toBe(0);
  });

  it('dims only the waveform on an engine without an oscillator', () => {
    expect([...inertTweaks('bowed-string')]).toEqual(['waveform']);
  });

  it('dims every per-voice control on the kit engine', () => {
    expect(inertTweaks('percussion').size).toBe(8);
  });
});
