// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { bindingLabel, bindingLabels } from '@/demos/gs-module/gsBindingText';
import type { GsEfxBinding } from '@/demos/gs-module/gsEfx';

function stageBinding(overrides: Partial<GsEfxBinding> = {}): GsEfxBinding {
  return {
    form: 'translated',
    stage: 'eq.parametric',
    keys: ['band1.frequencyHz'],
    ordinal: 0,
    alternatives: [],
    conversionClass: 'freq',
    table: 'eq',
    via: null,
    range: null,
    law: 'freq.eq',
    basis: 'measured',
    designed: null,
    enables: null,
    printedName: 'Frequency',
    printedValues: null,
    printedMark: null,
    ...overrides,
  };
}

describe('bindingLabel', () => {
  it('labels a dotted band key with its band number and leaf name, in English', () => {
    const label = bindingLabel(stageBinding(), false);
    expect(label).toEqual({ stage: 'Parametric EQ', param: 'Band 1 · Frequency' });
  });

  it('labels the same key in Japanese', () => {
    const label = bindingLabel(stageBinding(), true);
    expect(label).toEqual({ stage: 'パラメトリックイコライザー', param: 'バンド 1 · 周波数' });
  });

  it('labels a concatenated graphic-EQ band key as Gain', () => {
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

  it('keeps an unrecognised leaf visible rather than throwing', () => {
    const label = bindingLabel(stageBinding({ keys: ['somethingNew'] }), false);
    expect(label?.param).toBe('somethingNew');
  });

  it('expands alternatives and ordinal targets in their data order', () => {
    const labels = bindingLabels(
      stageBinding({
        stage: 'effects.modulation.chorus',
        keys: ['rateHz'],
        ordinal: [0, 1],
        alternatives: [
          {
            stage: 'effects.modulation.flanger',
            keys: ['rateHz'],
            ordinal: 0,
            law: 'rate.wide',
          },
        ],
      }),
      false,
    );
    expect(labels).toEqual([
      { stage: 'Chorus', param: 'Rate' },
      { stage: 'Chorus 2', param: 'Rate' },
      { stage: 'Flanger', param: 'Rate' },
    ]);
  });

  it('returns no control target for an enables form', () => {
    expect(
      bindingLabel(
        stageBinding({
          form: 'enables',
          stage: null,
          keys: [],
          conversionClass: null,
          table: null,
          law: null,
          basis: 'invented',
          enables: {
            mode: 'stages',
            stages: [{ stage: 'dynamics.compressor', ordinal: 0 }],
            onStates: [1],
            basis: 'invented',
            replacedWhen: null,
          },
        }),
        false,
      ),
    ).toBeNull();
  });
});
