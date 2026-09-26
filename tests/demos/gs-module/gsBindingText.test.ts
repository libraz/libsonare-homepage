// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { bindingLabel, bindingReason } from '@/demos/gs-module/gsBindingText';
import type { GsEfxBinding } from '@/demos/gs-module/gsEfx';

function stageBinding(overrides: Partial<GsEfxBinding> = {}): GsEfxBinding {
  return {
    form: 'stage',
    stage: 'eq.parametric',
    keys: ['band1.frequencyHz'],
    conversionClass: 'freq',
    table: 'eq',
    reason: null,
    ...overrides,
  };
}

function reasonBinding(reason: string, form: GsEfxBinding['form'] = 'state'): GsEfxBinding {
  return { form, stage: null, keys: [], conversionClass: null, table: null, reason };
}

describe('bindingLabel', () => {
  it('labels a dotted band key with its band number and leaf name, in English', () => {
    const label = bindingLabel(stageBinding({ keys: ['band1.frequencyHz'] }), false);
    expect(label).toEqual({ stage: 'Parametric EQ', param: 'Band 1 · Frequency' });
  });

  it('labels the same key in Japanese', () => {
    const label = bindingLabel(stageBinding({ keys: ['band1.frequencyHz'] }), true);
    expect(label).toEqual({ stage: 'パラメトリックイコライザー', param: 'バンド 1 · 周波数' });
  });

  it('labels a concatenated graphic-EQ band key as Gain, without spelling it out separately', () => {
    const label = bindingLabel(
      stageBinding({ stage: 'eq.graphic', keys: ['band11GainDb'] }),
      false,
    );
    expect(label).toEqual({ stage: 'Graphic EQ', param: 'Band 11 · Gain' });
  });

  it('does not renumber the band index the key carries', () => {
    const label = bindingLabel(stageBinding({ keys: ['band2.q'] }), false);
    expect(label?.param).toBe('Band 2 · Q');
    const highBand = bindingLabel(
      stageBinding({ stage: 'eq.graphic', keys: ['band26GainDb'] }),
      false,
    );
    expect(highBand?.param).toBe('Band 26 · Gain');
  });

  it('labels a plain, unbanded key by itself', () => {
    const label = bindingLabel(stageBinding({ stage: 'utility.gain', keys: ['levelDb'] }), false);
    expect(label).toEqual({ stage: 'Output Gain', param: 'Level' });
  });

  it('joins several keys with a slash', () => {
    const label = bindingLabel(
      stageBinding({ keys: ['band1.frequencyHz', 'band1.gainDb'] }),
      false,
    );
    expect(label?.param).toBe('Band 1 · Frequency / Band 1 · Gain');
  });

  it('falls back to the raw key for an unrecognised leaf rather than throwing', () => {
    const label = bindingLabel(stageBinding({ keys: ['somethingNew'] }), false);
    expect(label?.param).toBe('somethingNew');
  });

  it('returns null for every non-stage form', () => {
    for (const form of ['state', 'unmapped', 'builder', 'unreadable'] as const) {
      expect(bindingLabel(reasonBinding('a reason', form), false)).toBeNull();
    }
  });
});

describe('bindingReason', () => {
  it('returns null for a stage binding', () => {
    expect(bindingReason(stageBinding(), false)).toBeNull();
    expect(bindingReason(stageBinding(), true)).toBeNull();
  });

  it('returns the engine wording in English', () => {
    expect(bindingReason(reasonBinding('the limiter insert has no ratio'), false)).toBe(
      'the limiter insert has no ratio',
    );
  });

  it('translates a known reason to Japanese', () => {
    expect(bindingReason(reasonBinding('the limiter insert has no ratio'), true)).toBe(
      'リミッターインサートにレシオはない',
    );
  });

  it('falls back to the English wording for a reason with no Japanese entry', () => {
    expect(bindingReason(reasonBinding('a reason nobody has translated yet'), true)).toBe(
      'a reason nobody has translated yet',
    );
  });
});
