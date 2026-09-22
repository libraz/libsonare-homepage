import { describe, expect, it } from 'vitest';
import efxTables from '@/demos/gs-module/data/efx-tables.json';
import {
  GM_FAMILIES,
  GM_PROGRAMS,
  GS_EFX_TYPES,
  GS_EFX_TYPES_UNNAMED,
  gmFamilyOf,
} from '@/demos/gs-module/gsNames';

const EFX_TYPE_KEYS = Object.keys(
  (efxTables as { defaults: { by_type: Record<string, unknown> } }).defaults.by_type,
);

/**
 * A model designation — a short letter cluster bound to a number — names the
 * hardware these conventions came from, and no label here may carry one. The
 * check is structural rather than a list of names, since the list would spell
 * out exactly what it excludes.
 */
const MODEL_DESIGNATION =
  /\b[A-Za-z]{2,5}-\d{2,5}[A-Za-z]{0,3}\b|\b[A-Za-z]{2,5}\d{3,5}[A-Za-z]{0,3}\b/;

describe('GS_EFX_TYPES', () => {
  it('names every key the data file declares, and no others', () => {
    expect(new Set(Object.keys(GS_EFX_TYPES))).toEqual(new Set(EFX_TYPE_KEYS));
  });

  it('records no unnamed keys, since every key above was confirmed', () => {
    expect(GS_EFX_TYPES_UNNAMED).toEqual([]);
  });

  it('gives every named type non-empty en and ja names', () => {
    for (const key of EFX_TYPE_KEYS) {
      expect(GS_EFX_TYPES[key].en.length).toBeGreaterThan(0);
      expect(GS_EFX_TYPES[key].ja.length).toBeGreaterThan(0);
    }
  });
});

describe('GM_PROGRAMS', () => {
  it('has exactly 128 entries', () => {
    expect(GM_PROGRAMS).toHaveLength(128);
  });

  it('gives every program non-empty en and ja names', () => {
    for (const program of GM_PROGRAMS) {
      expect(program.en.length).toBeGreaterThan(0);
      expect(program.ja.length).toBeGreaterThan(0);
    }
  });

  it('starts with Acoustic Grand Piano', () => {
    expect(GM_PROGRAMS[0].en).toBe('Acoustic Grand Piano');
  });
});

describe('GM_FAMILIES', () => {
  it('has exactly 16 entries', () => {
    expect(GM_FAMILIES).toHaveLength(16);
  });

  it('exactly partitions 0..127 with no gap or overlap', () => {
    const covered = new Array(128).fill(0);
    for (const family of GM_FAMILIES) {
      for (let program = family.first; program <= family.last; program++) {
        covered[program]++;
      }
    }
    expect(covered.every((count) => count === 1)).toBe(true);
  });

  it('starts at 0 and ends at 127, sorted and contiguous', () => {
    const sorted = [...GM_FAMILIES].sort((a, b) => a.first - b.first);
    expect(sorted[0].first).toBe(0);
    expect(sorted[sorted.length - 1].last).toBe(127);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].first).toBe(sorted[i - 1].last + 1);
    }
  });
});

describe('gmFamilyOf', () => {
  it('returns the right family at each family boundary', () => {
    for (const family of GM_FAMILIES) {
      expect(gmFamilyOf(family.first)).toEqual(family.name);
      expect(gmFamilyOf(family.last)).toEqual(family.name);
    }
  });

  it('throws outside the 0..127 range', () => {
    expect(() => gmFamilyOf(-1)).toThrow(RangeError);
    expect(() => gmFamilyOf(128)).toThrow(RangeError);
  });
});

describe('no model designations', () => {
  function assertClean(name: { en: string; ja: string }) {
    expect(name.en).not.toMatch(MODEL_DESIGNATION);
    expect(name.ja).not.toMatch(MODEL_DESIGNATION);
  }

  it('keeps GM_PROGRAMS to sound names', () => {
    for (const program of GM_PROGRAMS) assertClean(program);
  });

  it('keeps GM_FAMILIES to family names', () => {
    for (const family of GM_FAMILIES) assertClean(family.name);
  });

  it('keeps GS_EFX_TYPES to effect names', () => {
    for (const key of Object.keys(GS_EFX_TYPES)) assertClean(GS_EFX_TYPES[key]);
  });
});
