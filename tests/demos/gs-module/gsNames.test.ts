// @vitest-environment node
import { describe, expect, it } from 'vitest';
import efxTables from '@/demos/gs-module/data/efx-tables.json';
import {
  GM_FAMILY_COUNT,
  GM_FAMILY_NAMES_JA,
  GM_PROGRAM_COUNT,
  GM_PROGRAM_NAMES_JA,
  GS_EFX_TYPES,
  GS_EFX_TYPES_UNNAMED,
  gmFamilyOf,
} from '@/demos/gs-module/gsNames';
import {
  drumKitsOf,
  gmFamilyNamesOf,
  gmProgramsOf,
  variationsOf,
} from '@/demos/gs-module/useGsModule';
import { MODEL_DESIGNATION, rhythmSetLabel } from '@/utils/modelNames';
import * as wasm from '@/wasm/index.js';

const EFX_TYPE_KEYS = Object.keys(
  (efxTables as { defaults: { by_type: Record<string, unknown> } }).defaults.by_type,
);

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

  it('keeps every effect label to an effect name', () => {
    for (const key of Object.keys(GS_EFX_TYPES)) {
      expect(GS_EFX_TYPES[key].en).not.toMatch(MODEL_DESIGNATION);
      expect(GS_EFX_TYPES[key].ja).not.toMatch(MODEL_DESIGNATION);
    }
  });
});

describe('the Japanese tables', () => {
  it('cover every program and every family', () => {
    expect(GM_PROGRAM_NAMES_JA).toHaveLength(GM_PROGRAM_COUNT);
    expect(GM_FAMILY_NAMES_JA).toHaveLength(GM_FAMILY_COUNT);
  });

  it('leave no entry blank', () => {
    for (const name of [...GM_PROGRAM_NAMES_JA, ...GM_FAMILY_NAMES_JA]) {
      expect(name.length).toBeGreaterThan(0);
    }
  });

  it('keep every label to a sound name', () => {
    for (const name of [...GM_PROGRAM_NAMES_JA, ...GM_FAMILY_NAMES_JA]) {
      expect(name).not.toMatch(MODEL_DESIGNATION);
    }
  });
});

describe('gmFamilyOf', () => {
  it('puts eight consecutive programs in each family, in order', () => {
    for (let program = 0; program < GM_PROGRAM_COUNT; program++) {
      expect(gmFamilyOf(program)).toBe(Math.floor(program / 8));
    }
    expect(gmFamilyOf(GM_PROGRAM_COUNT - 1)).toBe(GM_FAMILY_COUNT - 1);
  });

  it('throws outside the program range', () => {
    expect(() => gmFamilyOf(-1)).toThrow(RangeError);
    expect(() => gmFamilyOf(GM_PROGRAM_COUNT)).toThrow(RangeError);
  });
});

describe('the engine supplies the English names', () => {
  it('names all 128 programs, in program order', async () => {
    await wasm.init();
    const programs = gmProgramsOf(wasm);
    expect(programs).toHaveLength(GM_PROGRAM_COUNT);
    expect(programs.map((entry) => entry.program)).toEqual(
      Array.from({ length: GM_PROGRAM_COUNT }, (_, i) => i),
    );
    for (const entry of programs) expect(entry.name.length).toBeGreaterThan(0);
  });

  it('names all 16 families', async () => {
    await wasm.init();
    const families = gmFamilyNamesOf(wasm);
    expect(families).toHaveLength(GM_FAMILY_COUNT);
    for (const name of families) expect(name.length).toBeGreaterThan(0);
  });

  it('agrees with gmFamilyOf about which family a program is in', async () => {
    await wasm.init();
    for (const entry of gmProgramsOf(wasm)) {
      expect(entry.family).toBe(gmFamilyOf(entry.program));
    }
  });
});

describe('rhythmSetLabel', () => {
  it('leaves a set named for its sound alone', () => {
    expect(rhythmSetLabel(0, 'Standard')).toBe('Standard');
    expect(rhythmSetLabel(9, 'Hip Hop')).toBe('Hip Hop');
    expect(rhythmSetLabel(58, 'Rhythm FX 2')).toBe('Rhythm FX 2');
  });

  it('falls back to the slot number for a designation it has no kind for', () => {
    expect(rhythmSetLabel(64, 'XZ-12')).toBe('Set 64');
  });

  it('shows no model designation for any set this build defines', async () => {
    await wasm.init();
    const kits = drumKitsOf(wasm);
    expect(kits.length).toBeGreaterThan(0);
    for (const kit of kits) {
      expect(kit.name).not.toMatch(MODEL_DESIGNATION);
      expect(kit.name.length).toBeGreaterThan(0);
    }
  });

  it('keeps one distinct label per set, so no two are confusable', async () => {
    await wasm.init();
    const names = drumKitsOf(wasm).map((kit) => kit.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('variationsOf', () => {
  it('never offers the capital tone as a variation of itself', async () => {
    await wasm.init();
    for (const program of [0, 24, 48, 127]) {
      expect(variationsOf(wasm, program)).not.toContain(0);
    }
  });

  it('finds at least one program with a variation voiced apart', async () => {
    await wasm.init();
    const withVariations = Array.from({ length: GM_PROGRAM_COUNT }, (_, p) => p).filter(
      (program) => variationsOf(wasm, program).length > 0,
    );
    expect(withVariations.length).toBeGreaterThan(0);
  });

  it('lists only banks the engine calls voiced apart', async () => {
    await wasm.init();
    for (const program of [0, 4, 16, 40]) {
      for (const bank of variationsOf(wasm, program)) {
        expect(wasm.synthGsVariationIsVoicedApart(bank, program)).toBe(true);
      }
    }
  });
});
