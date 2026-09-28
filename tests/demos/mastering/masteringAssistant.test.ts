import { describe, expect, it } from 'vitest';
import {
  applyMasteringAssistantSettings,
  assistantParamsFromSuggestions,
} from '@/demos/mastering/masteringAssistant';
import { defaultModuleSettings } from '@/demos/mastering/useMastering';

describe('mastering assistant helpers', () => {
  it('extracts chain params from assistant suggestions', () => {
    expect(
      assistantParamsFromSuggestions({
        chainConfig: {
          params: {
            'loudness.targetLufs': -13,
          },
        },
      }),
    ).toMatchObject({ 'loudness.targetLufs': -13 });
  });

  it('applies bounded assistant params and ceiling guard', () => {
    const currentSettings = defaultModuleSettings();
    const result = applyMasteringAssistantSettings({
      currentSettings,
      params: {
        'eq.tilt.tiltDb': 99,
        'dynamics.compressor.ratio': 0,
        'loudness.targetLufs': -30,
        genreCandidates: [{ name: 'hip hop' }],
      },
      insightPreview: [{ ceilingRisk: true, safeCeilingDb: -1.2 }],
    });

    expect(result.applied).toBe(true);
    expect(result.moduleSettings.tiltDb).toBe(12);
    expect(result.moduleSettings.compressorRatio).toBe(1);
    expect(result.moduleSettings.limiterCeilingDb).toBe(-1.2);
    expect(result).not.toHaveProperty('selectedPlatform');
    expect(result).not.toHaveProperty('customLufs');
    expect(result).not.toHaveProperty('selectedPreset');
    expect(result.activeModule).toBe('limiter');
  });

  it('does not loosen a tighter user-selected limiter ceiling', () => {
    const currentSettings = { ...defaultModuleSettings(), limiterCeilingDb: -2 };
    const result = applyMasteringAssistantSettings({
      currentSettings,
      params: {
        'maximizer.truePeakLimiter.ceilingDb': -1,
        'loudness.ceilingDb': -1,
      },
      insightPreview: [],
    });

    expect(result.moduleSettings.limiterCeilingDb).toBe(-2);
  });

  it('returns unchanged settings when there is nothing to apply', () => {
    const currentSettings = defaultModuleSettings();

    expect(
      applyMasteringAssistantSettings({
        currentSettings,
        params: null,
        insightPreview: [],
      }),
    ).toEqual({ applied: false, moduleSettings: currentSettings });
  });
});
