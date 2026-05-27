import { describe, expect, it, vi } from 'vitest';

vi.mock('vitepress', () => ({ useData: () => ({ lang: { value: 'en' } }) }));

import { FX_PRESETS, isPresetId, type PresetId } from '@/composables/useRealtimeFx';

const ids: PresetId[] = ['natural', 'low', 'bright', 'robot', 'room', 'hall'];

describe('FX_PRESETS', () => {
  it('defines every preset id', () => {
    for (const id of ids) expect(FX_PRESETS[id]).toBeDefined();
  });

  it('keeps every parameter within its valid range', () => {
    for (const id of ids) {
      const p = FX_PRESETS[id];
      expect(p.pitchSemitones).toBeGreaterThanOrEqual(-12);
      expect(p.pitchSemitones).toBeLessThanOrEqual(12);
      expect(p.formant).toBeGreaterThan(0);
      expect(p.formant).toBeLessThanOrEqual(2);
      expect(p.wet).toBeGreaterThanOrEqual(0);
      expect(p.wet).toBeLessThanOrEqual(1);
      expect(p.robot).toBeGreaterThanOrEqual(0);
      expect(p.robot).toBeLessThanOrEqual(1);
      expect(p.reverb).toBeGreaterThanOrEqual(0);
      expect(p.reverb).toBeLessThanOrEqual(1);
      expect(p.outputGain).toBeGreaterThan(0);
      expect(p.outputGain).toBeLessThanOrEqual(1);
    }
  });

  it('natural preset is an unpitched, low-effect baseline', () => {
    expect(FX_PRESETS.natural.pitchSemitones).toBe(0);
    expect(FX_PRESETS.natural.formant).toBe(1);
    expect(FX_PRESETS.natural.robot).toBe(0);
  });

  it('robot preset engages ring modulation', () => {
    expect(FX_PRESETS.robot.robot).toBeGreaterThan(0.5);
  });

  it('hall preset has more reverb than room', () => {
    expect(FX_PRESETS.hall.reverb).toBeGreaterThan(FX_PRESETS.room.reverb);
  });
});

describe('isPresetId', () => {
  it('accepts every defined preset id', () => {
    for (const id of ids) expect(isPresetId(id)).toBe(true);
  });

  it('rejects unknown strings and non-strings', () => {
    expect(isPresetId('chorus')).toBe(false);
    expect(isPresetId('')).toBe(false);
    expect(isPresetId(null)).toBe(false);
    expect(isPresetId(undefined)).toBe(false);
    expect(isPresetId(3)).toBe(false);
  });

  it('does not treat inherited Object properties as preset ids', () => {
    expect(isPresetId('toString')).toBe(false);
    expect(isPresetId('constructor')).toBe(false);
  });
});
