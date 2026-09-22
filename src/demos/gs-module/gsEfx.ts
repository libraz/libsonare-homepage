/**
 * What is known about each insertion-effect type, joined from the three things
 * that know different parts of it.
 *
 * - The address table says what the parameter block is, per block rather than
 *   per slot: twenty bytes at one address, all of them AUDIBLE as a group.
 * - The derivation file says which (type, slot) pairs a hardware measurement
 *   archive found a conversion for, and carries each entry's provenance. That
 *   describes the unit it measured, not this build.
 * - The audibility file says what this build actually does, found by rendering:
 *   whether a type moves the signal at its power-on bytes, and which of its
 *   slots move it at all.
 *
 * The three disagree in a way worth showing rather than reconciling. A slot the
 * archive has a conversion for but this build does not act on is the difference
 * between the hardware and the re-creation, stated exactly.
 */
import audibility from './data/efx-audibility.json';
import tables from './data/efx-tables.json';

/** Two type bytes as the data files spell them, e.g. `"01 10"`. */
export type GsEfxTypeKey = string;

interface AudibilityRow {
  type: GsEfxTypeKey;
  changes_signal: boolean;
  distance: number;
  level_ratio: number;
  live_slots: number[];
}

interface ConversionRow {
  type: GsEfxTypeKey;
  parameter: number;
  conversion_class: string;
  table: string;
  rests_on: string;
  inference_state: string;
  approximate: boolean;
  unit_specific: boolean;
}

const AUDIBILITY = audibility as unknown as {
  measured_against: { version: string; md5: string; buildDate: string };
  probe: Record<string, unknown>;
  types: AudibilityRow[];
};

const TABLES = tables as unknown as {
  what_this_is: string;
  what_this_cannot_see: string[];
  classes: Record<string, { read_by: string; tables: Record<string, unknown> }>;
  defaults: { types: number; slots_per_type: number; by_type: Record<string, number[]> };
  map: ConversionRow[];
};

/** The engine build the audibility figures were measured against. */
export const EFX_MEASURED_AGAINST = AUDIBILITY.measured_against;
/** The derivation's own statement of what it cannot see. Shown, not hidden. */
export const EFX_ARCHIVE_LIMITS = TABLES.what_this_cannot_see;

/** How one parameter slot behaves, from both sides. */
export interface GsEfxSlot {
  slot: number;
  /** This build's render changes when the byte changes. */
  live: boolean;
  /** The archive derived a physical conversion for this slot. */
  conversion: ConversionRow | null;
}

export interface GsEfxType {
  key: GsEfxTypeKey;
  /** Packed as MSB << 8 | LSB. */
  type: number;
  /** The render differs from Thru at this type's power-on bytes. */
  changesSignal: boolean;
  /** RMS distance from Thru after peak-normalizing both. */
  distance: number;
  /** RMS relative to Thru, which is where a type's loudness change shows. */
  levelRatio: number;
  slots: GsEfxSlot[];
  /** Slots whose byte moves the render. */
  liveSlots: number[];
}

function parseKey(key: GsEfxTypeKey): number {
  return Number.parseInt(key.replace(' ', ''), 16);
}

const CONVERSIONS = new Map<string, ConversionRow>();
for (const row of TABLES.map) CONVERSIONS.set(`${row.type}/${row.parameter}`, row);

export const GS_EFX_TYPES: readonly GsEfxType[] = AUDIBILITY.types.map((row) => {
  const live = new Set(row.live_slots);
  return {
    key: row.type,
    type: parseKey(row.type),
    changesSignal: row.changes_signal,
    distance: row.distance,
    levelRatio: row.level_ratio,
    liveSlots: row.live_slots,
    slots: Array.from({ length: TABLES.defaults.slots_per_type }, (_, slot) => ({
      slot,
      live: live.has(slot),
      conversion: CONVERSIONS.get(`${row.type}/${slot}`) ?? null,
    })),
  };
});

const BY_TYPE = new Map(GS_EFX_TYPES.map((entry) => [entry.type, entry]));

export function efxType(type: number): GsEfxType | null {
  return BY_TYPE.get(type) ?? null;
}

/**
 * How a type stands in this build, as one of three answers a panel can label.
 *
 * `inert` is not a synonym for "no effect implemented": the measurement cannot
 * see why, only that neither the type's own bytes nor any of its twenty slots
 * move the render here.
 */
export type GsEfxStanding = 'adjustable' | 'fixed' | 'inert';

export function efxStanding(entry: GsEfxType): GsEfxStanding {
  if (entry.liveSlots.length > 0) return 'adjustable';
  return entry.changesSignal ? 'fixed' : 'inert';
}

/** Counts for a summary line, computed rather than written down. */
export function efxStandingCounts(): Record<GsEfxStanding, number> {
  const counts: Record<GsEfxStanding, number> = { adjustable: 0, fixed: 0, inert: 0 };
  for (const entry of GS_EFX_TYPES) counts[efxStanding(entry)] += 1;
  return counts;
}

/**
 * A slot the archive measured but this build does not act on. Worth naming
 * because it is the one case where the two sources visibly disagree, and the
 * disagreement is information rather than a defect in either.
 */
export function unusedConversions(entry: GsEfxType): GsEfxSlot[] {
  return entry.slots.filter((slot) => slot.conversion !== null && !slot.live);
}
