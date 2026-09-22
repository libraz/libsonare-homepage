/**
 * What is known about each insertion-effect type, joined from the four things
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
 * - The bindings file says which insert control a slot reaches, or the reason
 *   it reaches none, in the engine's own words.
 *
 * The four disagree in a way worth showing rather than reconciling. A slot the
 * archive has a conversion for but this build does not act on is the difference
 * between the hardware and the re-creation, stated exactly.
 */
import audibility from './data/efx-audibility.json';
import bindings from './data/efx-bindings.json';
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

/** How a bound slot reaches (or fails to reach) a control on an insert. */
export type GsBindingForm = 'stage' | 'state' | 'unmapped' | 'builder' | 'unreadable';

/** How one parameter slot binds to an insert's control surface. */
export interface GsEfxBinding {
  form: GsBindingForm;
  /** The insert the byte reaches, e.g. `effects.modulation.chorus`; null unless the form is `stage`. */
  stage: string | null;
  /** The parameter(s) on that insert; a row driving several keys lists them all. */
  keys: string[];
  /** The measured law, as the `class`/`table` pair, or null. */
  conversionClass: string | null;
  table: string | null;
  /** The engine's own wording for why the byte reaches nothing; null when the form is `stage`. */
  reason: string | null;
}

interface BindingRow {
  type: GsEfxTypeKey;
  slot: number;
  stage?: string;
  class?: string;
  table?: string;
  key?: string;
  keys?: string[];
  state?: string;
  unmapped?: string;
  builder?: string;
  unreadable?: string;
}

const BINDINGS_DATA = bindings as unknown as {
  _sources: Record<string, string>;
  what_this_is: string;
  slots_per_type: number;
  counts: Record<GsBindingForm, number>;
  rows: BindingRow[];
};

/** Counts for a summary line, carried by the data file rather than recomputed. */
export const EFX_BINDING_COUNTS: Record<GsBindingForm, number> = BINDINGS_DATA.counts;

const BINDING_FORMS: readonly GsBindingForm[] = [
  'stage',
  'state',
  'unmapped',
  'builder',
  'unreadable',
];

function parseBinding(row: BindingRow): GsEfxBinding {
  const form = BINDING_FORMS.find((candidate) => row[candidate] !== undefined);
  if (!form)
    throw new Error(`efx-bindings row for ${row.type}/${row.slot} carries no recognised form`);
  if (form === 'stage') {
    return {
      form,
      stage: row.stage ?? null,
      keys: row.keys ?? (row.key ? [row.key] : []),
      conversionClass: row.class ?? null,
      table: row.table ?? null,
      reason: null,
    };
  }
  return {
    form,
    stage: null,
    keys: [],
    conversionClass: null,
    table: null,
    reason: row[form] ?? null,
  };
}

const BINDINGS = new Map<string, GsEfxBinding>();
for (const row of BINDINGS_DATA.rows) BINDINGS.set(`${row.type}/${row.slot}`, parseBinding(row));

/**
 * The two sides spell one effect differently. The machine prints Rotary Multi
 * under two type numbers and the engine gives both one handler; the binding
 * tree files its slots under the number it treats as canonical, and the
 * conversion tables key the same effect by the other. Resolving it here lets
 * each file keep the spelling its own source uses.
 */
const BINDING_TYPE_ALIASES: Readonly<Record<string, GsEfxTypeKey>> = { '03 00': '02 0C' };

/** What a `(type, slot)` binds to, following the alias where the two disagree. */
export function slotBinding(type: GsEfxTypeKey, slot: number): GsEfxBinding | null {
  return BINDINGS.get(`${BINDING_TYPE_ALIASES[type] ?? type}/${slot}`) ?? null;
}

/** How one parameter slot behaves, from all sides. */
export interface GsEfxSlot {
  slot: number;
  /** This build's render changes when the byte changes. */
  live: boolean;
  /** The archive derived a physical conversion for this slot. */
  conversion: ConversionRow | null;
  /** What the byte binds to, or null when the slot is not printed on this type. */
  binding: GsEfxBinding | null;
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
  /**
   * False when the type has at least one bound slot and every bound slot is
   * `unmapped` — the whole type realises no chain at all, not just this slot.
   */
  realised: boolean;
}

function parseKey(key: GsEfxTypeKey): number {
  return Number.parseInt(key.replace(' ', ''), 16);
}

const CONVERSIONS = new Map<string, ConversionRow>();
for (const row of TABLES.map) CONVERSIONS.set(`${row.type}/${row.parameter}`, row);

export const GS_EFX_TYPES: readonly GsEfxType[] = AUDIBILITY.types.map((row) => {
  const live = new Set(row.live_slots);
  const slots: GsEfxSlot[] = Array.from({ length: TABLES.defaults.slots_per_type }, (_, slot) => ({
    slot,
    live: live.has(slot),
    conversion: CONVERSIONS.get(`${row.type}/${slot}`) ?? null,
    binding: slotBinding(row.type, slot),
  }));
  const bound = slots.filter((slot) => slot.binding !== null);
  return {
    key: row.type,
    type: parseKey(row.type),
    changesSignal: row.changes_signal,
    distance: row.distance,
    levelRatio: row.level_ratio,
    liveSlots: row.live_slots,
    slots,
    realised: bound.length === 0 || bound.some((slot) => slot.binding?.form !== 'unmapped'),
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
 * A slot the archive measured but this build does not act on — the one case
 * where the sources visibly disagree, which is information rather than a
 * defect in either. The inspector draws that per slot now, so this survives as
 * the way the disagreement is asserted rather than as something a panel calls.
 */
export function unusedConversions(entry: GsEfxType): GsEfxSlot[] {
  return entry.slots.filter((slot) => slot.conversion !== null && !slot.live);
}
