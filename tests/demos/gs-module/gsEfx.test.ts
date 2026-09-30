import { describe, expect, it } from 'vitest';
import {
  EFX_ARCHIVE_LIMITS,
  EFX_MEASURED_AGAINST,
  efxStanding,
  efxStandingCounts,
  efxType,
  GS_EFX_TYPES,
  unusedConversions,
} from '@/demos/gs-module/gsEfx';
import { EFX_SLOTS } from '@/demos/gs-module/gsState';

describe('the joined effect table', () => {
  it('carries every type the derivation file measured defaults for', () => {
    expect(GS_EFX_TYPES.length).toBeGreaterThan(1);
    expect(new Set(GS_EFX_TYPES.map((entry) => entry.key)).size).toBe(GS_EFX_TYPES.length);
  });

  it('gives every type the same number of slots as the address block', () => {
    for (const entry of GS_EFX_TYPES) expect(entry.slots).toHaveLength(EFX_SLOTS);
  });

  it('agrees with itself about which slots are live', () => {
    for (const entry of GS_EFX_TYPES) {
      const fromSlots = entry.slots.filter((slot) => slot.live).map((slot) => slot.slot);
      expect(fromSlots).toEqual(entry.liveSlots);
    }
  });

  it('finds Thru, and finds it unchanged', () => {
    const thru = efxType(0);
    expect(thru).not.toBeNull();
    expect(thru?.changesSignal).toBe(false);
    expect(thru?.distance).toBe(0);
  });

  it('returns null for a type number the build does not define', () => {
    expect(efxType(0x7f7f)).toBeNull();
  });
});

describe('efxStanding', () => {
  it('calls a type adjustable exactly when a slot moves the render', () => {
    for (const entry of GS_EFX_TYPES) {
      expect(efxStanding(entry) === 'adjustable').toBe(entry.liveSlots.length > 0);
    }
  });

  it('separates a fixed effect from an inert one by whether it changes the signal', () => {
    for (const entry of GS_EFX_TYPES.filter((e) => e.liveSlots.length === 0)) {
      expect(efxStanding(entry)).toBe(entry.changesSignal ? 'fixed' : 'inert');
    }
  });

  it('counts every type exactly once', () => {
    const counts = efxStandingCounts();
    expect(counts.adjustable + counts.fixed + counts.inert).toBe(GS_EFX_TYPES.length);
  });

  it('matches the current render-probe standing counts', () => {
    const counts = efxStandingCounts();
    expect(counts).toEqual({ adjustable: 64, fixed: 0, inert: 1 });
  });
});

describe('unusedConversions', () => {
  it('lists only slots the archive measured and this build leaves alone', () => {
    for (const entry of GS_EFX_TYPES) {
      for (const slot of unusedConversions(entry)) {
        expect(slot.conversion).not.toBeNull();
        expect(slot.live).toBe(false);
      }
    }
  });

  it('finds at least one, since that disagreement is what the panel exists to show', () => {
    expect(GS_EFX_TYPES.some((entry) => unusedConversions(entry).length > 0)).toBe(true);
  });
});

describe('provenance', () => {
  it('names the engine build the measurements were taken against', () => {
    expect(EFX_MEASURED_AGAINST.md5).toMatch(/^[0-9a-f]{32}$/);
    expect(EFX_MEASURED_AGAINST.version).not.toBe('');
  });

  it('keeps the derivation’s own statement of its limits', () => {
    expect(EFX_ARCHIVE_LIMITS.length).toBeGreaterThan(0);
    for (const limit of EFX_ARCHIVE_LIMITS) expect(typeof limit).toBe('string');
  });
});
