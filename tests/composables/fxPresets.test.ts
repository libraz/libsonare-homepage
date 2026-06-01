import { describe, expect, it, vi } from 'vitest';

vi.mock('vitepress', () => ({ useData: () => ({ lang: { value: 'en' } }) }));

import {
  isVoicePresetId,
  VOICE_PRESET_MACROS,
  VOICE_PRESET_ORDER,
} from '@/composables/useRealtimeFx';
import type { VoicePresetId } from '@/wasm/index';

const ids: VoicePresetId[] = [
  'neutral-monitor',
  'bright-idol',
  'soft-whisper',
  'deep-narrator',
  'robot-mascot',
  'dark-villain',
];

describe('VOICE_PRESET_MACROS', () => {
  it('defines macros for every preset in display order', () => {
    expect(VOICE_PRESET_ORDER).toEqual(ids);
    for (const id of ids) expect(VOICE_PRESET_MACROS[id]).toBeDefined();
  });

  it('keeps every macro within the native chain ranges', () => {
    for (const id of ids) {
      const m = VOICE_PRESET_MACROS[id];
      expect(m.pitchSemitones).toBeGreaterThanOrEqual(-12);
      expect(m.pitchSemitones).toBeLessThanOrEqual(12);
      // formant.factor is clamped to 0.55..1.65 by the native voice changer.
      expect(m.formant).toBeGreaterThanOrEqual(0.55);
      expect(m.formant).toBeLessThanOrEqual(1.65);
      expect(m.brightness).toBeGreaterThanOrEqual(-1);
      expect(m.brightness).toBeLessThanOrEqual(1);
      expect(m.wet).toBeGreaterThanOrEqual(0);
      expect(m.wet).toBeLessThanOrEqual(1);
    }
  });

  it('neutral-monitor is an unpitched, unity-formant baseline', () => {
    expect(VOICE_PRESET_MACROS['neutral-monitor'].pitchSemitones).toBe(0);
    expect(VOICE_PRESET_MACROS['neutral-monitor'].formant).toBe(1);
  });

  it('deep-narrator pitches down while robot-mascot pitches up', () => {
    expect(VOICE_PRESET_MACROS['deep-narrator'].pitchSemitones).toBeLessThan(0);
    expect(VOICE_PRESET_MACROS['robot-mascot'].pitchSemitones).toBeGreaterThan(0);
  });

  it('dark-villain is darker than bright-idol', () => {
    expect(VOICE_PRESET_MACROS['dark-villain'].brightness).toBeLessThan(
      VOICE_PRESET_MACROS['bright-idol'].brightness,
    );
  });
});

describe('isVoicePresetId', () => {
  it('accepts every defined preset id', () => {
    for (const id of ids) expect(isVoicePresetId(id)).toBe(true);
  });

  it('rejects unknown strings and non-strings', () => {
    expect(isVoicePresetId('chorus')).toBe(false);
    expect(isVoicePresetId('natural')).toBe(false);
    expect(isVoicePresetId('')).toBe(false);
    expect(isVoicePresetId(null)).toBe(false);
    expect(isVoicePresetId(undefined)).toBe(false);
    expect(isVoicePresetId(3)).toBe(false);
  });

  it('does not treat inherited Object properties as preset ids', () => {
    expect(isVoicePresetId('toString')).toBe(false);
    expect(isVoicePresetId('constructor')).toBe(false);
  });
});
