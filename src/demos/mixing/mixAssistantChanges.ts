/**
 * What a {@link MixPatch} changes relative to the current mix, as structured
 * items the assistant panel renders through its own copy. A field the patch
 * leaves at the value the mix already has produces no item.
 */
import {
  type AuxBusName,
  type MixingState,
  type MixPatch,
  SEND_OFF_DB,
} from '@/demos/mixing/mixingState';
import { DYNAMICS_SLOTS, type DynamicsSlot } from '@/demos/mixing/mixingUi';
import type { EqBandType } from '@/wasm/index.js';

export type MixChange =
  | { kind: 'trim'; trackId: number; deltaDb: number }
  | { kind: 'fader'; trackId: number; deltaDb: number }
  | { kind: 'pan'; trackId: number; pan: number }
  | { kind: 'width'; trackId: number; width: number }
  | {
      kind: 'dynamics';
      trackId: number;
      slot: DynamicsSlot;
      thresholdDb: number | undefined;
      ratio: number | undefined;
    }
  | {
      kind: 'eq';
      trackId: number;
      band: number;
      type: EqBandType;
      frequencyHz: number;
      gainDb: number;
    }
  | { kind: 'send'; trackId: number; bus: AuxBusName; levelDb: number }
  | { kind: 'master'; deltaDb: number };

/** Differences below these round to nothing in the readouts. */
const DB_EPS = 0.05;
const UNIT_EPS = 0.005;

const differs = (a: number, b: number, eps: number): boolean => Math.abs(a - b) >= eps;

/** Changes `patch` makes to `state`, per track in track order, then the master fader. */
export function describeMixChanges(patch: MixPatch, state: MixingState): MixChange[] {
  const items: MixChange[] = [];
  for (const track of state.tracks) {
    const p = patch.tracks[track.id];
    if (!p) continue;
    const trackId = track.id;

    const trim = p.slots?.trim?.params?.levelDb;
    if (trim !== undefined && differs(trim, track.slots.trim.params.levelDb, DB_EPS)) {
      items.push({ kind: 'trim', trackId, deltaDb: trim - track.slots.trim.params.levelDb });
    }
    if (p.faderDb !== undefined && differs(p.faderDb, track.faderDb, DB_EPS)) {
      items.push({ kind: 'fader', trackId, deltaDb: p.faderDb - track.faderDb });
    }
    if (p.pan !== undefined && differs(p.pan, track.pan, UNIT_EPS)) {
      items.push({ kind: 'pan', trackId, pan: p.pan });
    }
    const width = p.slots?.width?.params?.width;
    if (width !== undefined && differs(width, track.slots.width.params.width, UNIT_EPS)) {
      items.push({ kind: 'width', trackId, width });
    }

    for (const slot of DYNAMICS_SLOTS) {
      const next = p.slots?.[slot];
      if (next?.bypassed !== false) continue;
      const current = track.slots[slot];
      const params = { ...current.params, ...next.params };
      const moved =
        current.bypassed ||
        differs(params.thresholdDb, current.params.thresholdDb, DB_EPS) ||
        differs(params.ratio ?? 0, current.params.ratio ?? 0, DB_EPS);
      if (moved) {
        items.push({
          kind: 'dynamics',
          trackId,
          slot,
          thresholdDb: params.thresholdDb,
          ratio: params.ratio,
        });
      }
    }

    for (const [key, band] of Object.entries(p.eq ?? {})) {
      const index = Number(key);
      const current = track.eq[index];
      if (!band?.enabled) continue;
      const same =
        current?.enabled &&
        current.type === band.type &&
        !differs(current.frequencyHz, band.frequencyHz, 1) &&
        !differs(current.gainDb, band.gainDb, DB_EPS);
      if (!same) {
        items.push({
          kind: 'eq',
          trackId,
          band: index,
          type: band.type,
          frequencyHz: band.frequencyHz,
          gainDb: band.gainDb,
        });
      }
    }

    for (const [bus, send] of Object.entries(p.sends ?? {}) as Array<
      [AuxBusName, NonNullable<typeof p.sends>[AuxBusName]]
    >) {
      if (!send) continue;
      const current = track.sends[bus].levelDb;
      const bothOff = send.levelDb <= SEND_OFF_DB && current <= SEND_OFF_DB;
      if (!bothOff && differs(send.levelDb, current, DB_EPS)) {
        items.push({ kind: 'send', trackId, bus, levelDb: send.levelDb });
      }
    }
  }
  if (
    patch.masterFaderDb !== undefined &&
    differs(patch.masterFaderDb, state.master.faderDb, DB_EPS)
  ) {
    items.push({ kind: 'master', deltaDb: patch.masterFaderDb - state.master.faderDb });
  }
  return items;
}
