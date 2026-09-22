/**
 * The GS parameter address space, read from the table the engine generates.
 *
 * Every panel in this demo writes the same way: name a parameter, say which
 * part it is for, give a value. Which address that lands on, what range it
 * accepts, what it powers up holding and whether the engine does anything with
 * it are all answers the table already has, so no panel carries an address
 * literal and none of them can drift from the engine independently.
 */
import { dt1 } from '@/utils/gsSysex';
import table from './data/address-table.json';

/** What the player promises for an address. */
export type GsLevel = 'AUDIBLE' | 'STATE' | 'ACCEPT' | 'IGNORE';

export interface GsAddressRow {
  /** The address as three spaced hex bytes, with variable nibbles at zero. */
  address: string;
  addr: number;
  /** Bits the part, drum map or effect unit number fills in. */
  mask: number;
  /** The enumerator name the engine gives this parameter. */
  param: string;
  level: GsLevel;
  /** Consecutive one-byte parameters of the same kind, or a multi-byte value. */
  size: number;
  lo: number;
  hi: number;
  /** Power-on value, for the row's own address. */
  def: number;
  /** Addresses under this row whose power-on value differs, keyed by address. */
  reset_not_def: Record<string, number>;
  /** Why the row declines the parameter. Present exactly when level is IGNORE. */
  why: string | null;
}

export interface GsAddressTable {
  rows: GsAddressRow[];
  undefined_ranges: { from: string; to: string; lo_addr: number; hi_addr: number; why: string }[];
}

const DATA = table as unknown as GsAddressTable;

export const GS_ADDRESS_ROWS: readonly GsAddressRow[] = DATA.rows;
export const GS_UNDEFINED_RANGES = DATA.undefined_ranges;

const BY_PARAM = new Map<string, GsAddressRow[]>();
for (const row of DATA.rows) {
  const rows = BY_PARAM.get(row.param);
  if (rows) rows.push(row);
  else BY_PARAM.set(row.param, [row]);
}

/**
 * The part block a MIDI channel addresses.
 *
 * GS numbers the blocks so that block 0 is the rhythm part — channel 10 in
 * one-based MIDI, index 9 here — and channels 1 to 9 shift up one to make room
 * for it. Channels 11 upward are not shifted, because the room has already been
 * made. Adding one to every non-drum channel is the obvious wrong answer: it
 * runs channel 16 off the end of the nibble and onto the next parameter.
 */
export function partBlock(channel: number): number {
  if (channel < 0 || channel > 15) throw new RangeError(`channel out of range: ${channel}`);
  if (channel === 9) return 0;
  return channel < 9 ? channel + 1 : channel;
}

/** The inverse of {@link partBlock}. */
export function blockChannel(block: number): number {
  if (block < 0 || block > 15) throw new RangeError(`block out of range: ${block}`);
  if (block === 0) return 9;
  return block <= 9 ? block - 1 : block;
}

/** Contiguous runs of set bits in a mask, most significant first. */
function maskRuns(mask: number): { shift: number; width: number }[] {
  const runs: { shift: number; width: number }[] = [];
  let bit = 0;
  while (bit < 24) {
    if ((mask >> bit) & 1) {
      let width = 0;
      while (((mask >> (bit + width)) & 1) === 1) width++;
      runs.unshift({ shift: bit, width });
      bit += width;
    } else {
      bit++;
    }
  }
  return runs;
}

/**
 * The single row for a parameter name. Two rows share a name where the same
 * parameter exists per-part and globally, so those callers pass `scope`.
 */
export function addressRow(param: string, scope: 'global' | 'part' = 'global'): GsAddressRow {
  const rows = BY_PARAM.get(param);
  if (!rows) throw new Error(`No GS address named ${param}`);
  const wanted = rows.filter((row) => (scope === 'part' ? row.mask !== 0 : row.mask === 0));
  if (wanted.length !== 1) {
    throw new Error(`${param} has ${wanted.length} ${scope} rows, expected exactly one`);
  }
  return wanted[0];
}

/** Fill a row's variable nibbles, most significant field first. */
export function resolveAddress(row: GsAddressRow, ...fields: number[]): number {
  const runs = maskRuns(row.mask);
  if (runs.length !== fields.length) {
    throw new Error(`${row.param} takes ${runs.length} index fields, got ${fields.length}`);
  }
  let addr = row.addr;
  runs.forEach((run, index) => {
    const value = fields[index];
    const limit = (1 << run.width) - 1;
    if (value < 0 || value > limit) {
      throw new RangeError(`${row.param} index ${index} out of range: ${value}`);
    }
    addr |= value << run.shift;
  });
  return addr;
}

/** An address as the three bytes a DT1 frame carries. */
export function addressBytes(addr: number): number[] {
  return [(addr >> 16) & 0x7f, (addr >> 8) & 0x7f, addr & 0x7f];
}

/** Format an address the way the table spells it, for display. */
export function spellAddress(addr: number): string {
  return addressBytes(addr)
    .map((byte) => byte.toString(16).toUpperCase().padStart(2, '0'))
    .join(' ');
}

/**
 * What an address holds at power-on. The table records the exception map on the
 * row rather than repeating the row per part, because only a handful of
 * parameters differ by part.
 */
export function resetDefault(row: GsAddressRow, addr: number): number {
  return row.reset_not_def[spellAddress(addr)] ?? row.def;
}

/**
 * A DT1 frame writing one value, with the value clamped into the row's declared
 * range. Out-of-range is ignored by the receiver rather than clamped there, so
 * clamping here is the difference between a control that saturates and one that
 * silently stops responding past its end.
 */
export function gsWrite(
  param: string,
  value: number,
  options: { scope?: 'global' | 'part'; fields?: number[] } = {},
): number[] {
  const row = addressRow(param, options.scope ?? (options.fields?.length ? 'part' : 'global'));
  const addr = resolveAddress(row, ...(options.fields ?? []));
  const clamped = Math.min(row.hi, Math.max(row.lo, Math.round(value)));
  return dt1([...addressBytes(addr), clamped]);
}

/** A DT1 frame writing one part's parameter, addressed by MIDI channel. */
export function gsWritePart(param: string, channel: number, value: number): number[] {
  return gsWrite(param, value, { scope: 'part', fields: [partBlock(channel)] });
}

/**
 * The shared insertion effect's type, which is two bytes at one address rather
 * than one byte like every other control here.
 */
export function gsWriteEfxType(type: number): number[] {
  const row = addressRow('kEfxType', 'global');
  return dt1([...addressBytes(row.addr), (type >> 8) & 0x7f, type & 0x7f]);
}

/** One of the twenty insertion-effect parameter slots. */
export function gsWriteEfxParameter(slot: number, value: number): number[] {
  const row = addressRow('kEfxParameter', 'global');
  if (slot < 0 || slot >= row.size) {
    throw new RangeError(`effect parameter slot out of range: ${slot}`);
  }
  const clamped = Math.min(row.hi, Math.max(row.lo, Math.round(value)));
  return dt1([...addressBytes(row.addr + slot), clamped]);
}
