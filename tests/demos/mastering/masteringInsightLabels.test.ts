import { describe, expect, it } from 'vitest';
import { enCopy, jaCopy } from '@/demos/mastering/masteringCopy';
import { assistantNoteText, unmappedLabels } from '@/demos/mastering/masteringInsightLabels';

describe('assistant wording', () => {
  it('words the engine notes it knows and keeps the rest', () => {
    expect(assistantNoteText('base preset: hipHop', enCopy)).toBe(
      'Starts from the Hip-Hop / R&B profile.',
    );
    expect(assistantNoteText('base preset: pop', jaCopy)).toBe(
      jaCopy.insights.notes.basePreset.replace('{preset}', jaCopy.presets.pop.name),
    );
    expect(
      assistantNoteText('target loudness and ceiling applied from AssistantConfig', enCopy),
    ).toBe(enCopy.insights.notes.assistantTarget);
    expect(assistantNoteText('speech preset enables de-esser and mono compatibility', jaCopy)).toBe(
      jaCopy.insights.notes.speechPreset,
    );
    expect(assistantNoteText('base preset: streaming', enCopy)).toBe('base preset: streaming');
    expect(assistantNoteText('Lift the air band', enCopy)).toBe('Lift the air band');
  });

  it('folds the loudness-stage extras into one label and names insert settings', () => {
    const keys = [
      'loudness.applyGainAtInputRate',
      'loudness.maxLimiterGainReductionDb',
      'loudness.releaseMs',
      'loudness.truePeakOversample',
      'saturation.tape.bias',
      'unknown.stage.knob',
    ];
    expect(unmappedLabels(keys, enCopy)).toEqual([
      enCopy.insights.unmappedLoudness,
      'Tape · Bias',
      'unknown.stage.knob',
    ]);
    const ja = unmappedLabels(keys, jaCopy);
    expect(ja[0]).toBe(jaCopy.insights.unmappedLoudness);
    expect(ja[1]).toBe(`${jaCopy.modules.tape} · ${jaCopy.params.bias}`);
    for (const label of [...unmappedLabels(keys.slice(0, 5), enCopy), ...ja.slice(0, 2)]) {
      expect(label).not.toMatch(/\w\.\w/);
    }
  });
});
