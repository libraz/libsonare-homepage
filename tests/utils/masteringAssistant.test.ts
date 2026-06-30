import { describe, expect, it } from 'vitest';
import { defaultModuleSettings } from '@/composables/useMastering';
import {
  applyMasteringAssistantSettings,
  assistantParamsFromSuggestions,
  normalizeAssistantPreset,
} from '@/utils/masteringAssistant';
import { MASTERING_PRESETS } from '@/utils/masteringUi';

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

  it('normalizes preset candidate names', () => {
    expect(normalizeAssistantPreset('live small', MASTERING_PRESETS)).toBe('liveSmall');
    expect(normalizeAssistantPreset('unknown', MASTERING_PRESETS)).toBeNull();
  });

  it('applies bounded assistant params and ceiling guard', () => {
    const currentSettings = defaultModuleSettings();
    const result = applyMasteringAssistantSettings({
      currentSettings,
      presets: MASTERING_PRESETS,
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
    expect(result.selectedPlatform).toBe('custom');
    expect(result.customLufs).toBe(-24);
    expect(result.selectedPreset).toBe('hiphop');
    expect(result.activeModule).toBe('limiter');
  });

  it('returns unchanged settings when there is nothing to apply', () => {
    const currentSettings = defaultModuleSettings();

    expect(
      applyMasteringAssistantSettings({
        currentSettings,
        presets: MASTERING_PRESETS,
        params: null,
        insightPreview: [],
      }),
    ).toEqual({ applied: false, moduleSettings: currentSettings });
  });
});
