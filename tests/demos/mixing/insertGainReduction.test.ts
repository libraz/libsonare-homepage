// @vitest-environment node
/**
 * Per-insert gain reduction from the facade's meter snapshots lands on the
 * insert index the mixing engine maps each slot to: driving one dynamics slot
 * moves only its own entry.
 */
import { afterEach, describe, expect, it } from 'vitest';
import type { MixAudio } from '@/demos/mixing/mixingEngine';
import {
  buildFull,
  MASTER_SLOT_INDEX,
  MIX_TEMPO_BPM,
  TRACK_SLOT_INDEX,
} from '@/demos/mixing/mixingEngine';
import {
  addTrack,
  createMixingState,
  MASTER_SLOTS,
  type MasterSlotName,
  type MixingState,
  setMasterSlotBypass,
  setMasterSlotParam,
  setSlotBypass,
  setSlotParam,
  TRACK_SLOTS,
  type TrackSlotName,
} from '@/demos/mixing/mixingState';
import { DYNAMICS_SLOTS } from '@/demos/mixing/mixingUi';
import { applyOps, createFacadeTarget } from '@/utils/engineApply';
import {
  createFacadeLoopback,
  type FacadeLoopback,
  laneMeterTarget,
  MASTER_METER_TARGET,
  noise,
  RENDER_QUANTUM,
} from '../../wasm/support/engineHarness';

const SR = 48_000;
const SOURCE_SEC = 1;
const FRAMES = 40 * RENDER_QUANTUM;
/** A reduction under this is no reduction (dB). */
const MIN_GR_DB = -0.1;

const facades: FacadeLoopback[] = [];
afterEach(() => {
  for (const f of facades.splice(0)) f.dispose();
});

const registry = (): Map<number, MixAudio> =>
  new Map([
    [
      1,
      { channels: [noise(SOURCE_SEC, 1, SR, 0.5), noise(SOURCE_SEC, 2, SR, 0.5)], sampleRate: SR },
    ],
  ]);

/** Renders `state` and returns the last insert array reported for `targetId`. */
async function insertGr(state: MixingState, targetId: number): Promise<readonly number[]> {
  const f = await createFacadeLoopback({ sampleRate: SR, meterIntervalFrames: 512 });
  facades.push(f);
  f.engine.transport.setTempo(MIX_TEMPO_BPM);
  applyOps(createFacadeTarget(f.engine), buildFull(state, registry(), SR));
  f.flush();
  f.engine.transport.play();
  f.render(FRAMES);
  expect(f.syncErrors).toEqual([]);
  const last = f.meters.filter((m) => m.targetId === targetId && m.insertGainReductionDb).at(-1);
  return last?.insertGainReductionDb ?? [];
}

function driven(slot: TrackSlotName): MixingState {
  let s = addTrack(createMixingState(), 'noise', SOURCE_SEC);
  s = setSlotBypass(s, 1, slot, false);
  const params: Record<string, [string, number][]> = {
    gate: [['thresholdDb', -6]],
    comp: [
      ['thresholdDb', -40],
      ['ratio', 8],
    ],
    deess: [
      ['thresholdDb', -40],
      ['ratio', 8],
    ],
    duck: [['thresholdDb', -40]],
  };
  for (const [name, value] of params[slot] ?? []) s = setSlotParam(s, 1, slot, name, value);
  return s;
}

describe('per-insert gain reduction', () => {
  it('lays the track slots out in insert order', () => {
    expect(TRACK_SLOTS.map((s) => TRACK_SLOT_INDEX[s])).toEqual(TRACK_SLOTS.map((_, i) => i));
    expect(MASTER_SLOTS.map((s) => MASTER_SLOT_INDEX[s])).toEqual(MASTER_SLOTS.map((_, i) => i));
  });

  it.each(TRACK_SLOTS)('track slot %s', async (slot) => {
    const gr = await insertGr(driven(slot), laneMeterTarget(0));
    TRACK_SLOTS.forEach((other, i) => {
      const reduced = (gr[i] ?? 0) < MIN_GR_DB;
      expect(reduced, `${slot} drives index ${i} (${other})`).toBe(
        other === slot && (DYNAMICS_SLOTS as readonly string[]).includes(slot),
      );
    });
  });

  it.each(MASTER_SLOTS)('master slot %s', async (slot) => {
    let s = addTrack(createMixingState(), 'noise', SOURCE_SEC);
    s = setMasterSlotBypass(s, slot, false);
    s =
      slot === 'glue'
        ? setMasterSlotParam(setMasterSlotParam(s, 'glue', 'thresholdDb', -40), 'glue', 'ratio', 8)
        : setMasterSlotParam(s, 'limiter', 'ceilingDb', -20);
    const gr = await insertGr(s, MASTER_METER_TARGET);
    MASTER_SLOTS.forEach((other: MasterSlotName, i) => {
      expect((gr[i] ?? 0) < MIN_GR_DB, `${slot} drives ${other}`).toBe(other === slot);
    });
  });
});
