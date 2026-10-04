import { describe, expect, it } from 'vitest';
import {
  addTrack,
  createMixingState,
  MAX_TOTAL_TRACK_SECONDS,
  plateDecayFromSeconds,
  setChannelDelay,
} from '@/demos/mixing/mixingState';
import {
  audioBudget,
  automationValueAt,
  FADER_MAX_DB,
  FADER_MIN_DB,
  faderDbAt,
  faderPosition,
  formatFader,
  formatPan,
  holdChannelDelays,
  isDiscreteParam,
  MASTER_METER_TARGET,
  meterSources,
  pendingDelayIds,
  plateSecondsFromDecay,
  rebuiltTrackIds,
} from '@/demos/mixing/mixingUi';
import { applyMixMeter, silentFrame, trackWindow } from '@/demos/mixing/useMixingMetering';
import type { EngineOp } from '@/utils/engineApply';

function threeTracks() {
  let s = createMixingState();
  s = addTrack(s, 'a', 10);
  s = addTrack(s, 'b', 20);
  return addTrack(s, 'c', 30);
}

describe('fader taper', () => {
  it('puts 0 dB at three quarters of the throw and spans the full range', () => {
    expect(faderPosition(0)).toBeCloseTo(0.75, 9);
    expect(faderPosition(FADER_MIN_DB)).toBe(0);
    expect(faderPosition(FADER_MAX_DB)).toBe(1);
    expect(faderPosition(-200)).toBe(0);
    expect(faderPosition(40)).toBe(1);
  });

  it('is monotonic and round-trips', () => {
    let last = -1;
    for (let db = FADER_MIN_DB; db <= FADER_MAX_DB; db += 0.5) {
      const p = faderPosition(db);
      expect(p).toBeGreaterThan(last);
      last = p;
      expect(faderDbAt(p)).toBeCloseTo(db, 6);
    }
  });

  it('reads the bottom of the throw as minus infinity', () => {
    expect(formatFader(FADER_MIN_DB)).toBe('−∞');
    expect(formatFader(-6)).toBe('−6.0');
    expect(formatFader(3)).toBe('+3.0');
  });
});

describe('automation readout', () => {
  const points = [
    { id: 'a', timeSec: 1, value: 0, curve: 'linear' as const },
    { id: 'b', timeSec: 3, value: 10, curve: 'hold' as const },
    { id: 'c', timeSec: 5, value: -10, curve: 's-curve' as const },
    { id: 'd', timeSec: 7, value: 10, curve: 'linear' as const },
  ];

  it('holds the ends and interpolates each curve shape', () => {
    expect(automationValueAt([], 2, 4)).toBe(4);
    expect(automationValueAt(points, 0, 99)).toBe(0);
    expect(automationValueAt(points, 2, 99)).toBe(5);
    expect(automationValueAt(points, 4, 99)).toBe(10);
    expect(automationValueAt(points, 6, 99)).toBeCloseTo(0, 9);
    expect(automationValueAt(points, 9, 99)).toBe(10);
  });
});

describe('channel delay hold', () => {
  it('keeps the engine delay of existing tracks and passes new tracks through', () => {
    const applied = threeTracks();
    const edited = setChannelDelay(setChannelDelay(applied, 1, 2), 3, 4);
    const added = addTrack(edited, 'd', 5);
    const withNew = setChannelDelay(added, 4, 3);
    const held = holdChannelDelays(withNew, applied);
    expect(held.tracks.map((t) => t.channelDelayMs)).toEqual([0, 0, 0, 3]);
    expect(pendingDelayIds(withNew, applied)).toEqual(new Set([1, 3]));
    expect(holdChannelDelays(applied, applied)).toBe(applied);
    expect(pendingDelayIds(withNew, null).size).toBe(0);
  });
});

describe('rebuilt strips', () => {
  it('reports strip ops on tracks that already existed', () => {
    const prev = threeTracks();
    const ops: EngineOp[] = [
      { type: 'strip', strip: { kind: 'track', trackId: 2 }, spec: { inserts: [] } },
      { type: 'strip', strip: { kind: 'track', trackId: 9 }, spec: { inserts: [] } },
      { type: 'strip', strip: { kind: 'master' }, spec: { inserts: [] } },
      { type: 'fader', target: 1, db: 0 },
    ];
    expect(rebuiltTrackIds(ops, prev)).toEqual(new Set([2]));
  });

  it('knows which gate parameters only construction takes', () => {
    expect(isDiscreteParam('dynamics.gate', 'holdMs')).toBe(true);
    expect(isDiscreteParam('dynamics.gate', 'thresholdDb')).toBe(false);
    expect(isDiscreteParam('dynamics.compressor', 'ratio')).toBe(false);
  });
});

describe('meter targets', () => {
  it('maps master, lanes in declaration order and both buses', () => {
    const sources = meterSources([7, 3]);
    expect(sources.get(MASTER_METER_TARGET)).toEqual({ kind: 'master' });
    expect(sources.get(1)).toEqual({ kind: 'track', trackId: 7 });
    expect(sources.get(2)).toEqual({ kind: 'track', trackId: 3 });
    expect(sources.get(33)).toEqual({ kind: 'bus', bus: 'reverb' });
    expect(sources.get(34)).toEqual({ kind: 'bus', bus: 'delay' });
  });

  it('folds a snapshot into the strip it belongs to', () => {
    const snapshot = {
      targetId: 2,
      peakDbL: -6,
      peakDbR: -7,
      rmsDbL: -18,
      rmsDbR: -19,
      correlation: 0.8,
      truePeakDbL: -5,
      truePeakDbR: -4,
      momentaryLufs: -14,
      shortTermLufs: -15,
      integratedLufs: -16,
      gainReductionDb: -3.5,
      inputPeakDbL: -2,
      inputPeakDbR: -3,
    } as unknown as Parameters<typeof applyMixMeter>[1];
    const frame = applyMixMeter(silentFrame(), snapshot, [5, 9]);
    expect(frame.tracks[9]).toEqual({
      inputPeakDb: [-2, -3],
      peakDb: [-6, -7],
      rmsDb: [-18, -19],
      grDb: -3.5,
      correlation: 0.8,
    });
    const master = applyMixMeter(frame, { ...snapshot, targetId: 0 }, [5, 9]).master;
    expect(master.truePeakDb).toBe(-4);
    expect(master.integratedLufs).toBe(-16);
    // A quieter interval leaves the held true peak where it was.
    const quiet = {
      ...snapshot,
      targetId: 0,
      truePeakDbL: -30,
      truePeakDbR: -31,
      peakDbL: -32,
      peakDbR: -33,
    };
    const held = applyMixMeter({ ...frame, master }, quiet, [5, 9]).master;
    expect(held.truePeakDb).toBe(-4);
    expect(held.peakDb).toEqual([-32, -33]);
    expect(applyMixMeter(frame, { ...snapshot, targetId: 20 }, [5, 9])).toBe(frame);
  });

  it('reads the selected track source window at the playhead, honouring the clip', () => {
    const left = Float32Array.from({ length: 100 }, (_, i) => i);
    const right = Float32Array.from({ length: 100 }, (_, i) => i + 2);
    let s = createMixingState();
    s = addTrack(s, 'a', 1);
    const track = {
      ...s.tracks[0],
      clip: { ...s.tracks[0].clip, startSec: 0.1, trimStartSec: 0.2 },
    };
    const window = trackWindow({ channels: [left, right], sampleRate: 100 }, track, 0.5, 4);
    // Playhead 0.5 s on the timeline is source 0.6 s: samples 56..59.
    expect(Array.from(window ?? [])).toEqual([57, 58, 59, 60]);
    const early = trackWindow({ channels: [left, right], sampleRate: 100 }, track, 0.12, 4);
    expect(Array.from(early ?? [])).toEqual([0, 0, 21, 22]);
    const lent = { channels: [new Float32Array(new ArrayBuffer(0))], sampleRate: 100 };
    expect(trackWindow(lent, track, 0.5, 4)).toBeNull();
  });
});

describe('export, budget and readouts', () => {
  it('reports the remaining audio budget and what a free slot can take', () => {
    expect(audioBudget([])).toEqual({
      usedSec: 0,
      remainingSec: MAX_TOTAL_TRACK_SECONDS,
      perFreeSlotSec: MAX_TOTAL_TRACK_SECONDS / 8,
    });
    const summary = audioBudget(threeTracks().tracks);
    expect(summary.remainingSec).toBe(MAX_TOTAL_TRACK_SECONDS - 60);
    expect(summary.perFreeSlotSec).toBeCloseTo((MAX_TOTAL_TRACK_SECONDS - 60) / 5, 9);
  });

  it('inverts the plate decay model', () => {
    for (const seconds of [0.4, 1, 2.2, 6]) {
      expect(plateSecondsFromDecay(plateDecayFromSeconds(seconds))).toBeCloseTo(seconds, 6);
    }
  });

  it('prints pan as a console does', () => {
    expect(formatPan(0)).toBe('C');
    expect(formatPan(-0.3)).toBe('L30');
    expect(formatPan(1)).toBe('R100');
  });
});
