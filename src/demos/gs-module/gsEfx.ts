/**
 * The GS insertion-effect data joined for the inspector.
 *
 * The archive measures conversion laws; the binding tree names the control a
 * printed byte reaches. A row is translated when it uses a measured class and
 * table, designed when it carries a carried or invented law, and enables when
 * it switches stages. The generated data keeps those three forms explicit so
 * the panel does not infer a meaning from a missing field.
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

export interface ConversionRow {
  type: GsEfxTypeKey;
  parameter: number;
  conversion_class: string;
  table: string;
  rests_on: string;
  inference_state: string;
  approximate: boolean;
  unit_specific: boolean;
  source?: string;
  printed_values?: string;
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
/** The derivation's statement of what it cannot see. */
export const EFX_ARCHIVE_LIMITS = TABLES.what_this_cannot_see;

/** The three forms in the 1.8 binding schema. */
export type GsBindingForm = 'translated' | 'designed' | 'enables';
export type GsBindingBasis = 'measured' | 'carried' | 'invented';
export type GsOrdinal = number | readonly number[];

interface RawDesigned {
  basis: 'carried' | 'invented';
  law: string;
  from?: string;
  replaced_when?: Record<string, unknown>;
}

/** One stage the byte may switch on, with the same-stage ordinal retained. */
export interface GsEnableStage {
  stage: string;
  ordinal: number;
}

/** A byte's stage switch, either a list of on states or a state selector. */
export interface GsEfxEnables {
  mode: 'stages' | 'select';
  stages: readonly GsEnableStage[];
  onStates: readonly number[];
  basis: 'invented';
  replacedWhen: Record<string, unknown> | null;
}

/** A secondary target selected by an enables row, such as chorus or flanger. */
export interface GsEfxAlternative {
  stage: string;
  keys: readonly string[];
  ordinal: GsOrdinal;
  /** Designed rows may use a stage-specific law for this target. */
  law: string | null;
}

/** One concrete target after expanding a row's ordinal list. */
export interface GsEfxTarget {
  stage: string;
  keys: readonly string[];
  ordinal: number;
  law: string | null;
  basis: GsBindingBasis;
}

/** How one printed parameter slot binds to the modern insert chain. */
export interface GsEfxBinding {
  /** The explicit schema form. */
  form: GsBindingForm;
  /** The primary insert target; null for an enables row. */
  stage: string | null;
  /** The primary insert control(s). */
  keys: readonly string[];
  /** The primary same-stage ordinal, or all ordinals the slot reaches. */
  ordinal: GsOrdinal;
  /** Alternative stage targets selected by the same type's enables row. */
  alternatives: readonly GsEfxAlternative[];
  /** Measured class/table for translated rows, null for designed/enables. */
  conversionClass: string | null;
  table: string | null;
  via: string | null;
  range: readonly [number, number] | null;
  /** The effective law id: `class.table` or the designed law id. */
  law: string | null;
  /** Where that law came from. */
  basis: GsBindingBasis | null;
  designed: RawDesigned | null;
  enables: GsEfxEnables | null;
  printedName: string | null;
  printedValues: string | null;
  printedMark: '+' | '#' | null;
}

interface RawAlternative {
  stage: string;
  key?: string;
  keys?: string[];
  ordinal?: GsOrdinal;
  law?: string;
}

interface RawEnableStage {
  stage: string;
  ordinal?: number;
}

interface BindingRow {
  type: GsEfxTypeKey;
  slot: number;
  form?: GsBindingForm;
  stage?: string;
  class?: string;
  table?: string;
  key?: string;
  keys?: string[];
  via?: string;
  range?: [number, number];
  printed_values?: string;
  printed_mark?: '+' | '#';
  printed_name?: string;
  ordinal?: GsOrdinal;
  alternatives?: RawAlternative[];
  designed?: RawDesigned;
  enables?: {
    stages?: RawEnableStage[];
    select?: RawEnableStage[];
    on_states?: number[];
    basis?: 'invented';
    replaced_when?: Record<string, unknown>;
  };
}

const BINDINGS_DATA = bindings as unknown as {
  _sources: Record<string, string>;
  what_this_is: string;
  slots_per_type: number;
  counts: Record<GsBindingForm, number>;
  rows: BindingRow[];
};

/** Counts for the summary line, carried by the generated data. */
export const EFX_BINDING_COUNTS: Record<GsBindingForm, number> = BINDINGS_DATA.counts;

function rowForm(row: BindingRow): GsBindingForm {
  if (row.form) return row.form;
  if (row.enables !== undefined) return 'enables';
  if (row.designed !== undefined) return 'designed';
  return 'translated';
}

function keysOf(row: { key?: string; keys?: string[] }): string[] {
  return row.keys ?? (row.key === undefined ? [] : [row.key]);
}

function normalizeOrdinal(ordinal: GsOrdinal | undefined): number[] {
  const values = Array.isArray(ordinal) ? ordinal : [ordinal ?? 0];
  return values.filter((value): value is number => Number.isInteger(value));
}

function parseEnables(raw: BindingRow['enables']): GsEfxEnables | null {
  if (!raw) return null;
  const mode = raw.select !== undefined ? 'select' : 'stages';
  const stages = (raw[mode] ?? []).map((stage) => ({
    stage: stage.stage,
    ordinal: stage.ordinal ?? 0,
  }));
  return {
    mode,
    stages,
    onStates: raw.on_states ?? [],
    basis: 'invented',
    replacedWhen: raw.replaced_when ?? null,
  };
}

function parseAlternative(raw: RawAlternative): GsEfxAlternative {
  return {
    stage: raw.stage,
    keys: keysOf(raw),
    ordinal: raw.ordinal ?? 0,
    law: raw.law ?? null,
  };
}

function parseBinding(row: BindingRow): GsEfxBinding {
  const form = rowForm(row);
  const designed = row.designed ?? null;
  const enables = parseEnables(row.enables);
  const conversionClass = row.class ?? null;
  const table = row.table ?? null;
  const law =
    form === 'designed'
      ? (designed?.law ?? null)
      : form === 'translated' && conversionClass && table
        ? `${conversionClass}.${table}`
        : null;
  const basis: GsBindingBasis | null =
    form === 'translated'
      ? 'measured'
      : form === 'designed'
        ? (designed?.basis ?? null)
        : 'invented';
  return {
    form,
    stage: row.stage ?? null,
    keys: keysOf(row),
    ordinal: row.ordinal ?? 0,
    alternatives: (row.alternatives ?? []).map(parseAlternative),
    conversionClass,
    table,
    via: row.via ?? null,
    range: row.range ?? null,
    law,
    basis,
    designed,
    enables,
    printedName: row.printed_name ?? null,
    printedValues: row.printed_values ?? null,
    printedMark: row.printed_mark ?? null,
  };
}

const BINDINGS = new Map<string, GsEfxBinding>();
for (const row of BINDINGS_DATA.rows) BINDINGS.set(`${row.type}/${row.slot}`, parseBinding(row));

/** The canonical spelling of Rotary Multi in the binding tree. */
const BINDING_TYPE_ALIASES: Readonly<Record<string, GsEfxTypeKey>> = { '03 00': '02 0C' };

/** What a `(type, slot)` binds to, following the 03 00 → 02 0C alias. */
export function slotBinding(type: GsEfxTypeKey, slot: number): GsEfxBinding | null {
  return BINDINGS.get(`${BINDING_TYPE_ALIASES[type] ?? type}/${slot}`) ?? null;
}

/** Expand primary and alternative ordinal lists into displayable targets. */
export function bindingTargets(binding: GsEfxBinding): readonly GsEfxTarget[] {
  const targets: GsEfxTarget[] = [];
  if (binding.stage !== null) {
    for (const ordinal of normalizeOrdinal(binding.ordinal)) {
      targets.push({
        stage: binding.stage,
        keys: binding.keys,
        ordinal,
        law: binding.law,
        basis: binding.basis ?? 'measured',
      });
    }
  }
  for (const alternative of binding.alternatives ?? []) {
    for (const ordinal of normalizeOrdinal(alternative.ordinal)) {
      targets.push({
        stage: alternative.stage,
        keys: alternative.keys,
        ordinal,
        law: alternative.law ?? binding.law,
        basis: binding.basis ?? 'measured',
      });
    }
  }
  return targets;
}

/** How one parameter slot behaves, from the measured render and binding tree. */
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
  return {
    key: row.type,
    type: parseKey(row.type),
    changesSignal: row.changes_signal,
    distance: row.distance,
    levelRatio: row.level_ratio,
    liveSlots: row.live_slots,
    slots,
  };
});

const BY_TYPE = new Map(GS_EFX_TYPES.map((entry) => [entry.type, entry]));

export function efxType(type: number): GsEfxType | null {
  return BY_TYPE.get(type) ?? null;
}

/** How a type stands in this build, as measured by the audibility pass. */
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

/** A measured conversion the current build does not move. */
export function unusedConversions(entry: GsEfxType): GsEfxSlot[] {
  return entry.slots.filter((slot) => slot.conversion !== null && !slot.live);
}
