// @vitest-environment node
import { describe, expect, it } from 'vitest';
import efxBindings from '@/demos/gs-module/data/efx-bindings.json';
import {
  EFX_BINDING_COUNTS,
  GS_EFX_TYPES,
  type GsBindingForm,
  slotBinding,
} from '@/demos/gs-module/gsEfx';
import { GS_BINDING_REASONS, GS_EFX_PARAMS, GS_EFX_STAGES } from '@/demos/gs-module/gsNames';

const BINDING_FORMS: readonly GsBindingForm[] = [
  'stage',
  'state',
  'unmapped',
  'builder',
  'unreadable',
];
const KNOWN_TYPES = new Set(GS_EFX_TYPES.map((entry) => entry.key));

/** Distinct `stage` keys carried by the raw data file. */
const RAW_STAGES = [
  ...new Set(
    efxBindings.rows
      .filter((row): row is typeof row & { stage: string } => 'stage' in row)
      .map((row) => row.stage),
  ),
];

/** Distinct key leaves the raw data file's `stage` rows carry. */
const RAW_LEAVES = [
  ...new Set(
    efxBindings.rows
      .filter((row): row is typeof row & { key: string } => 'key' in row)
      .map((row) => (row.key.includes('.') ? row.key.split('.').pop()! : row.key)),
  ),
];

/** Distinct `state`/`unmapped` reasons the raw data file carries. */
/**
 * Every form but `stage` carries its reason as prose, and every one of them
 * reaches the panel. Collecting all four rather than the two the data happens
 * to use today is what makes the translation gate catch a form the engine
 * starts using later, instead of letting English through on a Japanese page.
 */
const REASON_FORMS = ['state', 'unmapped', 'builder', 'unreadable'] as const;

const RAW_REASONS = [
  ...new Set(
    efxBindings.rows.flatMap((row) => {
      const carried = row as Partial<Record<(typeof REASON_FORMS)[number], string>>;
      const reason = REASON_FORMS.map((form) => carried[form]).find((value) => value !== undefined);
      return reason ? [reason] : [];
    }),
  ),
];

describe('efx-bindings.json rows', () => {
  it('carries exactly one form per row', () => {
    for (const row of efxBindings.rows) {
      const present = BINDING_FORMS.filter((form) => form in row);
      expect(present).toHaveLength(1);
    }
  });

  it('joins onto a known effect type, or onto one through its alias', () => {
    const unknownTypes = new Set(
      efxBindings.rows.map((row) => row.type).filter((type) => !KNOWN_TYPES.has(type)),
    );
    // One effect is printed under two type numbers and the two sides file it
    // under different ones, so the join resolves an alias. Pinning the set
    // here means a regenerated tree that orphans a further type fails loudly.
    expect(unknownTypes).toEqual(new Set(['02 0C']));
  });

  it('gives the aliased type its slots instead of leaving them unnamed', () => {
    const aliased = GS_EFX_TYPES.find((entry) => entry.key === '03 00');
    expect(aliased, 'the aliased type is measured under the other spelling').toBeDefined();
    expect(aliased?.slots.filter((slot) => slot.binding !== null).length).toBeGreaterThan(0);
    expect(slotBinding('03 00', 0)).toEqual(slotBinding('02 0C', 0));
  });

  it('matches the counts the data file states for itself', () => {
    const counted: Record<string, number> = {};
    for (const row of efxBindings.rows) {
      const form = BINDING_FORMS.find((candidate) => candidate in row);
      if (form) counted[form] = (counted[form] ?? 0) + 1;
    }
    for (const form of BINDING_FORMS) {
      expect(counted[form] ?? 0).toBe(EFX_BINDING_COUNTS[form]);
    }
  });
});

describe('GsEfxType.realised', () => {
  it('is false for the parallel-2, formant and binaural types', () => {
    const allUnmappedTypes = [
      '01 03',
      '01 70',
      '01 71',
      '11 00',
      '11 01',
      '11 02',
      '11 03',
      '11 04',
      '11 05',
      '11 06',
      '11 07',
      '11 08',
    ];
    for (const key of allUnmappedTypes) {
      const entry = GS_EFX_TYPES.find((candidate) => candidate.key === key);
      expect(entry).toBeDefined();
      expect(entry?.realised).toBe(false);
    }
  });

  it('is true for an ordinary adjustable type', () => {
    const eq = GS_EFX_TYPES.find((candidate) => candidate.key === '01 00');
    expect(eq).toBeDefined();
    expect(eq?.realised).toBe(true);
  });

  it('is true for a type with no adjudicated slots at all', () => {
    const thru = GS_EFX_TYPES.find((candidate) => candidate.key === '00 00');
    expect(thru).toBeDefined();
    expect(thru?.slots.every((slot) => slot.binding === null)).toBe(true);
    expect(thru?.realised).toBe(true);
  });
});

describe('GS_EFX_STAGES', () => {
  it('names every stage the data carries', () => {
    expect(RAW_STAGES.length).toBeGreaterThan(0);
    for (const stage of RAW_STAGES) {
      expect(GS_EFX_STAGES[stage]).toBeDefined();
      expect(GS_EFX_STAGES[stage].en.length).toBeGreaterThan(0);
      expect(GS_EFX_STAGES[stage].ja.length).toBeGreaterThan(0);
    }
  });
});

describe('GS_EFX_PARAMS', () => {
  it('resolves every non-band-pattern leaf the data carries to something other than the raw key', () => {
    const bandGain = /^band\d+GainDb$/;
    for (const leaf of RAW_LEAVES) {
      if (bandGain.test(leaf)) continue;
      expect(GS_EFX_PARAMS[leaf], `leaf ${leaf} has no entry`).toBeDefined();
    }
  });
});

describe('GS_BINDING_REASONS', () => {
  it('has a Japanese entry for every distinct reason the data carries', () => {
    expect(RAW_REASONS.length).toBeGreaterThan(0);
    for (const reason of RAW_REASONS) {
      expect(GS_BINDING_REASONS[reason], `reason not translated: ${reason}`).toBeDefined();
      expect(GS_BINDING_REASONS[reason]).not.toBe(reason);
    }
  });
});
