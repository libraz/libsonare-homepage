import { describe, expect, it } from 'vitest';
import { defaultModuleSettings } from '@/composables/useMastering';
import {
  MASTERING_METER_TARGETS,
  MASTERING_MODULE_GUIDE_SLUGS,
  MASTERING_MODULES,
  MASTERING_PARAMETER_GUIDE_SLUGS,
  MASTERING_PLATFORMS,
  MASTERING_PRESETS,
  moduleControlsFor,
} from '@/utils/masteringUi';

describe('mastering UI definitions', () => {
  it('keeps preset and platform identifiers unique with expected defaults', () => {
    expect(new Set(MASTERING_PRESETS.map((preset) => preset.id)).size).toBe(
      MASTERING_PRESETS.length,
    );
    expect(MASTERING_PRESETS.map((preset) => preset.id)).toEqual([
      'pop',
      'edm',
      'acoustic',
      'hiphop',
      'aiMusic',
      'speech',
    ]);

    expect(new Set(MASTERING_PLATFORMS.map((platform) => platform.id)).size).toBe(
      MASTERING_PLATFORMS.length,
    );
    expect(MASTERING_PLATFORMS).toEqual(
      expect.arrayContaining([
        { id: 'spotify', lufs: -14 },
        { id: 'youtube', lufs: -14 },
        { id: 'apple', lufs: -16 },
        { id: 'tiktok', lufs: -16 },
        { id: 'custom', lufs: -14 },
      ]),
    );
  });

  it('maps every module to a guide slug and exposes valid controls', () => {
    const defaultSettings = defaultModuleSettings();
    for (const moduleId of MASTERING_MODULES) {
      expect(MASTERING_MODULE_GUIDE_SLUGS[moduleId], moduleId).toBeTruthy();
      for (const control of moduleControlsFor(moduleId)) {
        expect(control.key in defaultSettings, `${moduleId}:${control.key}`).toBe(true);
        expect(control.min, control.key).toBeLessThan(control.max);
        expect(control.step, control.key).toBeGreaterThan(0);
        expect(MASTERING_PARAMETER_GUIDE_SLUGS[control.key], control.key).toBeTruthy();
      }
    }
  });

  it('returns expected control groups per module and no controls for non-editable modules', () => {
    expect(moduleControlsFor('input').map((control) => control.key)).toEqual(['inputGainDb']);
    expect(moduleControlsFor('repair').map((control) => control.key)).toEqual([
      'denoiseAmount',
      'declickAmount',
      'dereverbAmount',
    ]);
    expect(moduleControlsFor('dynamics').map((control) => control.key)).toEqual([
      'compressorThresholdDb',
      'compressorRatio',
      'compressorAttackMs',
      'compressorReleaseMs',
      'deesserAmount',
      'transientAttackDb',
    ]);
    expect(moduleControlsFor('multiband').map((control) => control.key)).toEqual([
      'multibandLowAmount',
      'multibandMidAmount',
      'multibandHighAmount',
    ]);
    expect(moduleControlsFor('exciter').map((control) => control.key)).toEqual([
      'tapeDriveDb',
      'tapeSaturation',
      'exciterAmount',
      'airBandAmount',
    ]);
    expect(moduleControlsFor('stereo').map((control) => control.key)).toEqual([
      'stereoWidth',
      'monoMakerAmount',
    ]);
    expect(moduleControlsFor('limiter').map((control) => control.key)).toEqual([
      'limiterCeilingDb',
      'limiterLookaheadMs',
    ]);
    expect(moduleControlsFor('loudness')).toEqual([]);
    expect(moduleControlsFor('output')).toEqual([]);
    expect(moduleControlsFor('missing')).toEqual([]);
  });

  it('keeps meter target modules valid', () => {
    for (const [meterId, moduleId] of Object.entries(MASTERING_METER_TARGETS)) {
      expect(['lufs', 'peak', 'crest', 'correlation']).toContain(meterId);
      expect(MASTERING_MODULES).toContain(moduleId);
    }
  });
});
