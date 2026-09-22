/**
 * What the module is currently set to, and the MIDI that puts a player into
 * that state.
 *
 * Every panel reads and writes this one shape, so the SysEx view, the render
 * and the shareable URL are all describing the same thing rather than three
 * parallel accounts of it.
 *
 * Two rules the rest of the demo depends on:
 *
 * - Power-on values come from the address table, never from a literal here. A
 *   control that starts where the engine starts cannot drift from it.
 * - Only settings that differ from power-on are emitted. The frame list is
 *   shown to the reader, so a list of forty writes that change nothing would
 *   bury the one that matters.
 */
import type { SmfEvent } from '@/utils/gsSysex';
import efxTables from './data/efx-tables.json';
import {
  addressRow,
  gsWrite,
  gsWriteEfxParameter,
  gsWriteEfxType,
  gsWritePart,
  partBlock,
  resetDefault,
  resolveAddress,
} from './gsAddress';

/** Slots the insertion-effect parameter block carries, whatever the type. */
export const EFX_SLOTS = addressRow('kEfxParameter', 'global').size;

/** MIDI channel the GS rhythm part listens to, zero-based. */
export const RHYTHM_CHANNEL = 9;

export interface GsPartState {
  /** Zero-based MIDI channel. The rhythm part is {@link RHYTHM_CHANNEL}. */
  channel: number;
  program: number;
  /** Bank Select MSB, which in GS picks the variation. */
  bankMsb: number;
  level: number;
  pan: number;
  reverbSend: number;
  chorusSend: number;
  /** Whether this part is routed through the shared insertion effect. */
  efxAssigned: boolean;
}

export interface GsEfxState {
  /** Two type bytes packed as MSB << 8 | LSB. Zero is Thru. */
  type: number;
  /** One byte per slot, as many as {@link EFX_SLOTS}. */
  params: number[];
}

export interface GsModuleState {
  parts: GsPartState[];
  efx: GsEfxState;
  masterVolume: number;
}

/** Power-on bytes per effect type, keyed the way the derivation file keys them. */
const EFX_DEFAULTS = (efxTables as { defaults: { by_type: Record<string, number[]> } }).defaults
  .by_type;

/** The derivation file spells a type as two hex bytes; the state carries a number. */
export function efxTypeKey(type: number): string {
  return `${((type >> 8) & 0x7f).toString(16).toUpperCase().padStart(2, '0')} ${(type & 0x7f)
    .toString(16)
    .toUpperCase()
    .padStart(2, '0')}`;
}

/** The twenty bytes a type powers up holding, or zeros for a type with none recorded. */
export function efxTypeDefaults(type: number): number[] {
  const recorded = EFX_DEFAULTS[efxTypeKey(type)];
  return recorded ? recorded.slice(0, EFX_SLOTS) : new Array(EFX_SLOTS).fill(0);
}

/** The power-on value of a per-part parameter on one channel. */
function partDefault(param: string, channel: number): number {
  const row = addressRow(param, 'part');
  return resetDefault(row, resolveAddress(row, partBlock(channel)));
}

export function defaultPartState(channel: number): GsPartState {
  return {
    channel,
    program: 0,
    bankMsb: 0,
    level: partDefault('kPartLevel', channel),
    pan: partDefault('kPartPanpot', channel),
    reverbSend: partDefault('kPartReverbSend', channel),
    chorusSend: partDefault('kPartChorusSend', channel),
    // The assign address holds an effect unit number, so zero is "no unit".
    efxAssigned: partDefault('kPartEfxAssign', channel) !== 0,
  };
}

export function defaultEfxState(): GsEfxState {
  return { type: 0, params: efxTypeDefaults(0) };
}

/**
 * Switch the effect type, taking the new type's power-on bytes with it.
 *
 * Carrying the old type's slot values across would be wrong twice over: the
 * player overwrites the block on a type change, so the state would no longer
 * describe the player, and the setup would then write those stale bytes back
 * over the defaults the type just loaded.
 */
export function withEfxType(efx: GsEfxState, type: number): GsEfxState {
  return type === efx.type ? efx : { type, params: efxTypeDefaults(type) };
}

export function defaultModuleState(): GsModuleState {
  return {
    parts: Array.from({ length: 16 }, (_, channel) => defaultPartState(channel)),
    efx: defaultEfxState(),
    masterVolume: addressRow('kMasterVolume', 'global').def,
  };
}

/** Per-part settings that ride a DT1 frame, paired with their address name. */
const PART_PARAMS: { key: keyof GsPartState; param: string }[] = [
  { key: 'level', param: 'kPartLevel' },
  { key: 'pan', param: 'kPartPanpot' },
  { key: 'reverbSend', param: 'kPartReverbSend' },
  { key: 'chorusSend', param: 'kPartChorusSend' },
];

/**
 * The SysEx and channel messages that move a freshly reset player into `state`,
 * skipping everything already at its power-on value.
 *
 * Order is deliberate and load-bearing: the effect type goes out before its
 * slots. Selecting a type overwrites the whole parameter block with that
 * type's own power-on bytes, so a slot written first is wiped — measured as
 * bit-identical to never having written it.
 */
export function setupEvents(state: GsModuleState, beat = 0): SmfEvent[] {
  const events: SmfEvent[] = [];
  const push = (sysex: number[]) => events.push({ beat, sysex });

  if (state.masterVolume !== addressRow('kMasterVolume', 'global').def) {
    push(gsWrite('kMasterVolume', state.masterVolume));
  }

  if (state.efx.type !== 0) {
    push(gsWriteEfxType(state.efx.type));
    const typeDefaults = efxTypeDefaults(state.efx.type);
    state.efx.params.forEach((value, slot) => {
      if (value !== typeDefaults[slot]) push(gsWriteEfxParameter(slot, value));
    });
  }

  for (const part of state.parts) {
    const base = defaultPartState(part.channel);
    if (part.bankMsb !== base.bankMsb) {
      events.push({ beat, bytes: [0xb0 | part.channel, 0x00, part.bankMsb] });
    }
    if (part.program !== base.program) {
      events.push({ beat, bytes: [0xc0 | part.channel, part.program] });
    }
    for (const { key, param } of PART_PARAMS) {
      if (part[key] !== base[key]) push(gsWritePart(param, part.channel, part[key] as number));
    }
    if (part.efxAssigned !== base.efxAssigned) {
      push(gsWritePart('kPartEfxAssign', part.channel, part.efxAssigned ? 1 : 0));
    }
  }

  return events;
}

/** Whether anything about a part has moved off its power-on state. */
export function partIsEdited(part: GsPartState): boolean {
  const base = defaultPartState(part.channel);
  return (Object.keys(base) as (keyof GsPartState)[]).some((key) => part[key] !== base[key]);
}
