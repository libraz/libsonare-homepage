import { describe, expect, it } from 'vitest';
import { MASTERING_NON_RT_PARAMS } from '@/demos/mastering/masteringEngine';
import { MASTERING_INSERT_LAYOUT } from '@/demos/mastering/masteringState';
import {
  formatNumber,
  formatParam,
  MASTERING_FIXED_SLOTS,
  MASTERING_MODULE_GUIDES,
  MASTERING_PLATFORMS,
  MASTERING_PRESET_TARGETS,
  MASTERING_PRESETS,
  MASTERING_SLOT_CONTROLS,
  MASTERING_VENUES,
} from '@/demos/mastering/masteringUi';

describe('mastering UI definitions', () => {
  it('keeps the Quick axes unique, with a recommended target per genre', () => {
    expect(MASTERING_PRESETS.map((preset) => preset.id)).toEqual([
      'pop',
      'edm',
      'acoustic',
      'liveSmall',
      'liveLarge',
      'hiphop',
      'aiMusic',
      'speech',
    ]);
    expect(MASTERING_VENUES.map((venue) => venue.id)).toEqual([
      'studio',
      'livehouseSmall',
      'livehouseLarge',
    ]);
    expect(new Set(MASTERING_PLATFORMS.map((platform) => platform.id)).size).toBe(
      MASTERING_PLATFORMS.length,
    );
    for (const preset of MASTERING_PRESETS) {
      expect(MASTERING_PRESET_TARGETS[preset.id], preset.id).toBeLessThan(0);
    }
    expect(MASTERING_PRESET_TARGETS.liveLarge).toBeLessThan(MASTERING_PRESET_TARGETS.pop);
  });

  it('exposes only parameters the slot carries, and never the tape bias', () => {
    for (const entry of MASTERING_INSERT_LAYOUT) {
      const groups = MASTERING_SLOT_CONTROLS[entry.id];
      const names = groups.flatMap((group) => group.params.map((spec) => spec.name));
      expect(new Set(names).size, entry.id).toBe(names.length);
      for (const spec of groups.flatMap((group) => group.params)) {
        const value = entry.params[spec.name];
        expect(value, `${entry.id}.${spec.name}`).not.toBeUndefined();
        if ('toggle' in spec) {
          expect(typeof value).toBe('boolean');
        } else {
          expect(typeof value).toBe('number');
          expect(spec.min).toBeLessThan(spec.max);
          expect(spec.step).toBeGreaterThan(0);
          // The layout default sits inside the control range, so a reset is reachable.
          expect(value as number, `${entry.id}.${spec.name} default`).toBeGreaterThanOrEqual(
            spec.min,
          );
          expect(value as number, `${entry.id}.${spec.name} default`).toBeLessThanOrEqual(spec.max);
          if (spec.scale === 'log') expect(spec.min).toBeGreaterThan(0);
        }
      }
    }
    const tape = MASTERING_SLOT_CONTROLS.tape.flatMap((group) =>
      group.params.map((spec) => spec.name),
    );
    expect(tape).not.toContain('bias');
    expect(MASTERING_SLOT_CONTROLS.drive).toEqual([]);
    expect(MASTERING_FIXED_SLOTS).toEqual(['drive']);
  });

  it('puts the multiband crossovers, which rebuild the inserts, in their own group', () => {
    const crossover = MASTERING_SLOT_CONTROLS.multiband.find(
      (group) => group.group === 'crossover',
    );
    expect(crossover?.params.map((spec) => spec.name)).toEqual(['cutoff0Hz', 'cutoff1Hz']);
    for (const spec of crossover?.params ?? []) {
      expect(MASTERING_NON_RT_PARAMS['multiband.compressor']).toContain(spec.name);
    }
  });

  it('links every module to a guide', () => {
    for (const entry of MASTERING_INSERT_LAYOUT) {
      expect(MASTERING_MODULE_GUIDES[entry.id]).toMatch(/^mastering\/[a-z-]+(#[a-z-]+)?$/);
    }
    expect(MASTERING_MODULE_GUIDES.repair).toBe('mastering/repair');
    expect(MASTERING_MODULE_GUIDES.eq).toBe('mastering/tone-air');
  });

  it('formats readouts with a true minus sign and a dash for non-finite values', () => {
    expect(formatNumber(-14.04, 1)).toBe('−14.0');
    expect(formatNumber(2.5, 1, true)).toBe('+2.5');
    expect(formatNumber(-0.01, 1)).toBe('0.0');
    expect(formatNumber(Number.NaN)).toBe('—');
    expect(formatNumber(Number.NEGATIVE_INFINITY)).toBe('—');
    expect(formatParam(1234.4, 1)).toBe('1234');
    expect(formatParam(0.256, 0.01)).toBe('0.26');
    expect(formatParam(-1.25, 0.05)).toBe('−1.25');
  });
});
