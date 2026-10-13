// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  changedSettings,
  DEFAULT_SETTINGS,
  type DetectorMode,
  type DetectorSettings,
  formatDivision,
  formatKnob,
  isDefault,
  KNOB_RANGES,
  MIN_NOTE_MS_DEFAULT,
  MONO_ONLY,
  POLY_ONLY,
  readBy,
  reattackOptionValue,
  toTranscribeOptions,
  withMode,
} from '@/demos/transcribe/detectorSettings';

const POLY_FIELDS = ['maxPolyphony', 'minFramePeakRatio', 'minRidgePeakRatio', 'reattackRatio'];

// Pairwise over mode × tuning × re-strike stop × shortest-note setting.
const CASES: Array<[DetectorMode, boolean, 'off' | 'on', 'modeDefault' | 'custom']> = [
  ['mono', true, 'off', 'modeDefault'],
  ['poly', false, 'off', 'custom'],
  ['mono', false, 'on', 'modeDefault'],
  ['mono', true, 'on', 'custom'],
  ['poly', false, 'off', 'modeDefault'],
  ['poly', true, 'off', 'modeDefault'],
  ['poly', true, 'on', 'modeDefault'],
];

describe('toTranscribeOptions', () => {
  it.each(CASES)(
    'mode %s, auto tuning %s, re-strike %s, shortest note %s',
    (mode, auto, reattack, minNote) => {
      const settings: DetectorSettings = {
        ...withMode({ ...DEFAULT_SETTINGS }, mode),
        autoTuning: auto,
        reattackRatio: reattack === 'off' ? KNOB_RANGES.reattackRatio.min : 3.5,
      };
      if (minNote === 'custom') settings.minNoteMs = 125;
      const options = toTranscribeOptions(settings);

      expect(options.polyphonic).toBe(mode === 'poly');
      expect(options.referenceHz).toBe(auto ? 'auto' : 440);
      expect(options.minNoteMs).toBe(minNote === 'custom' ? 125 : MIN_NOTE_MS_DEFAULT[mode]);
      // Each path gets only the fields it reads; the engine refuses the poly limits on mono.
      for (const field of POLY_FIELDS) expect(field in options).toBe(mode === 'poly');
      expect('segmentationThresholdCents' in options).toBe(mode === 'mono');
      if (mode === 'poly') expect(options.reattackRatio).toBe(reattack === 'off' ? 0 : 3.5);
    },
  );
});

describe('detector settings', () => {
  it('reads the re-strike knob bottom stop as off', () => {
    expect(reattackOptionValue(KNOB_RANGES.reattackRatio.min)).toBe(0);
    expect(reattackOptionValue(1.1)).toBe(1.1);
  });

  it('carries the shortest note across a path switch only when it was left at the default', () => {
    const poly = { ...DEFAULT_SETTINGS };
    expect(withMode(poly, 'mono').minNoteMs).toBe(MIN_NOTE_MS_DEFAULT.mono);
    expect(withMode({ ...poly, minNoteMs: 90 }, 'mono').minNoteMs).toBe(90);
    expect(withMode(withMode(poly, 'mono'), 'poly').minNoteMs).toBe(MIN_NOTE_MS_DEFAULT.poly);
  });

  it('treats the defaults of either path as default', () => {
    expect(isDefault({ ...DEFAULT_SETTINGS })).toBe(true);
    expect(isDefault(withMode({ ...DEFAULT_SETTINGS }, 'mono'))).toBe(true);
    expect(isDefault({ ...DEFAULT_SETTINGS, framePeakRatio: 0.3 })).toBe(false);
  });

  it('keeps every default inside its knob range, and no knob on both paths only', () => {
    for (const [key, range] of Object.entries(KNOB_RANGES)) {
      const value = DEFAULT_SETTINGS[key as keyof typeof KNOB_RANGES];
      expect(value, key).toBeGreaterThanOrEqual(range.min);
      expect(value, key).toBeLessThanOrEqual(range.max);
    }
    expect(MONO_ONLY.filter((key) => POLY_ONLY.includes(key))).toEqual([]);
  });
});

describe('run-to-run changes', () => {
  it('lists what moved, in panel order', () => {
    const before = { ...DEFAULT_SETTINGS };
    const after = { ...before, autoTuning: true, framePeakRatio: 0.3, minNoteMs: 80 };
    expect(changedSettings(before, after)).toEqual(['minNoteMs', 'autoTuning', 'framePeakRatio']);
    expect(changedSettings(before, { ...before })).toEqual([]);
  });

  it('leaves out a knob the newer run does not read', () => {
    const before = { ...DEFAULT_SETTINGS };
    expect(changedSettings(before, { ...before, splitCents: 20 })).toEqual([]);
    const mono = withMode({ ...before }, 'mono');
    expect(changedSettings(mono, { ...mono, maxPolyphony: 2 })).toEqual([]);
    expect(changedSettings(before, withMode({ ...before, maxPolyphony: 2 }, 'mono'))).toEqual([
      'mode',
      'minNoteMs',
    ]);
  });

  it('prints knob values with their units and the re-strike off stop', () => {
    expect(formatKnob('minNoteMs', 60, 'off')).toBe('60 ms');
    expect(formatKnob('velocityFloorDb', -48, 'off')).toBe('-48 dB');
    expect(formatKnob('framePeakRatio', 0.2, 'off')).toBe('0.20');
    expect(formatKnob('reattackRatio', KNOB_RANGES.reattackRatio.min, 'off')).toBe('off');
    expect(formatKnob('reattackRatio', 2, 'off')).toBe('× 2.0');
  });
});

describe('note-value floor', () => {
  it('sends minNoteDivision in place of minNoteMs, never both', () => {
    for (const mode of ['poly', 'mono'] as const) {
      const options = toTranscribeOptions({
        ...withMode({ ...DEFAULT_SETTINGS }, mode),
        minNoteDivision: 16,
      });
      expect(options.minNoteDivision).toBe(16);
      expect('minNoteMs' in options).toBe(false);
    }
    const off = toTranscribeOptions({ ...DEFAULT_SETTINGS });
    expect('minNoteDivision' in off).toBe(false);
    expect(off.minNoteMs).toBe(DEFAULT_SETTINGS.minNoteMs);
  });

  it('leaves the millisecond knob unread while a note value is set', () => {
    const byValue = { ...DEFAULT_SETTINGS, minNoteDivision: 8 as const };
    expect(readBy('minNoteMs', byValue)).toBe(false);
    expect(readBy('minNoteMs', DEFAULT_SETTINGS)).toBe(true);
    expect(changedSettings(byValue, { ...byValue, minNoteMs: 200 })).toEqual([]);
    expect(changedSettings(DEFAULT_SETTINGS, byValue)).toEqual(['minNoteDivision']);
  });

  it('prints a note value, and off at 0', () => {
    expect(formatDivision(16, 'off')).toBe('1/16');
    expect(formatDivision(0, 'off')).toBe('off');
    expect(isDefault({ ...DEFAULT_SETTINGS, minNoteDivision: 32 })).toBe(false);
  });
});
