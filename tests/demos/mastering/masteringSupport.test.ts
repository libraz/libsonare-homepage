import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { METER_FLOOR_DB } from '@/components/meters/meterBallistics';
import type { SonareMeterSnapshot } from '@/composables/useSonareEngine';
import type { MasteringExportResult } from '@/demos/mastering/mastering.worker';
import { createMasteringReport } from '@/demos/mastering/masteringReport';
import {
  defaultMasteringState,
  MASTERING_LEGACY_PRESET_STORAGE_KEY,
  MASTERING_STATE_STORAGE_KEY,
  masteringMutators,
  serializeMasteringState,
} from '@/demos/mastering/masteringState';
import {
  AFTER_METER_TARGET,
  applyMeterSnapshot,
  MASTER_METER_TARGET,
  programWindow,
  silentReading,
} from '@/demos/mastering/useMasteringMetering';
import {
  MASTERING_LEGACY_SESSION_KEY,
  MASTERING_SAVE_DELAY_MS,
  useMasteringSession,
} from '@/demos/mastering/useMasteringSession';

function meter(
  targetId: number,
  overrides: Partial<SonareMeterSnapshot> = {},
): SonareMeterSnapshot {
  return {
    type: 'meter',
    targetId,
    frame: 1024,
    peakDbL: -6,
    peakDbR: -7,
    rmsDbL: -18,
    rmsDbR: -19,
    correlation: 0.8,
    truePeakDbL: -0.9,
    truePeakDbR: -1.2,
    momentaryLufs: -12,
    shortTermLufs: -13,
    integratedLufs: -14,
    gainReductionDb: -3,
    inputPeakDbL: -10,
    inputPeakDbR: -11,
    ...overrides,
  } as SonareMeterSnapshot;
}

describe('useMasteringSession', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    sessionStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('coalesces saves within the delay into one write of the latest state', () => {
    const session = useMasteringSession();
    const setItem = vi.spyOn(localStorage, 'setItem');
    const first = defaultMasteringState();
    const second = masteringMutators.setMode(first, 'studio');
    session.save(first);
    session.save(second);
    expect(setItem).not.toHaveBeenCalled();
    vi.advanceTimersByTime(MASTERING_SAVE_DELAY_MS);
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem(MASTERING_STATE_STORAGE_KEY) ?? '{}').mode).toBe(
      'studio',
    );
    session.dispose();
  });

  it('writes a pending save on flush and drops it on dispose', () => {
    const session = useMasteringSession();
    session.save(masteringMutators.setMode(defaultMasteringState(), 'studio'));
    session.flush();
    expect(localStorage.getItem(MASTERING_STATE_STORAGE_KEY)).not.toBeNull();
    localStorage.clear();
    session.save(defaultMasteringState());
    session.dispose();
    vi.advanceTimersByTime(MASTERING_SAVE_DELAY_MS * 2);
    expect(localStorage.getItem(MASTERING_STATE_STORAGE_KEY)).toBeNull();
  });

  it('restores the saved project and discards the earlier sessionStorage session', () => {
    const saved = masteringMutators.setMacro(defaultMasteringState(), 'tone', 1.5);
    localStorage.setItem(MASTERING_STATE_STORAGE_KEY, serializeMasteringState(saved));
    sessionStorage.setItem(MASTERING_LEGACY_SESSION_KEY, '{"mode":"studio"}');
    const restored = useMasteringSession().restore();
    expect(restored?.notices).toEqual([]);
    expect(restored?.state.quick.macros.tone).toBe(1.5);
    expect(sessionStorage.getItem(MASTERING_LEGACY_SESSION_KEY)).toBeNull();
  });

  it('converts the earlier chain preset once and stores it in the current format', () => {
    localStorage.setItem(
      MASTERING_LEGACY_PRESET_STORAGE_KEY,
      JSON.stringify({
        selectedPreset: 'edm',
        selectedPlatform: 'apple',
        mode: 'studio',
        tone: 'loud',
      }),
    );
    const restored = useMasteringSession().restore();
    expect(restored?.state.quick.preset).toBe('edm');
    expect(restored?.state.quick.platform).toBe('apple');
    expect(restored?.state.mode).toBe('studio');
    expect(restored?.notices).toContain('tone');
    expect(localStorage.getItem(MASTERING_LEGACY_PRESET_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(MASTERING_STATE_STORAGE_KEY)).not.toBeNull();
  });

  it('reads corrupt storage as a default project with a notice, and nothing as nothing', () => {
    expect(useMasteringSession().restore()).toBeNull();
    localStorage.setItem(MASTERING_STATE_STORAGE_KEY, '{not json');
    const restored = useMasteringSession().restore();
    expect(restored?.notices).toEqual(['json']);
    expect(restored?.state).toEqual(defaultMasteringState());
  });
});

describe('mastering meter telemetry', () => {
  it('starts at the floor', () => {
    const reading = silentReading();
    expect(reading.peakDb).toEqual([METER_FLOOR_DB, METER_FLOOR_DB]);
    expect(reading.grDb).toBe(0);
    expect(reading.integratedLufs).toBe(Number.NEGATIVE_INFINITY);
  });

  it('reads levels, true peak and loudness from the master and GR and input from lane 1', () => {
    let reading = applyMeterSnapshot(silentReading(), meter(MASTER_METER_TARGET));
    expect(reading.peakDb).toEqual([-6, -7]);
    expect(reading.rmsDb).toEqual([-18, -19]);
    expect(reading.truePeakDb).toBe(-0.9);
    expect([reading.momentaryLufs, reading.shortTermLufs, reading.integratedLufs]).toEqual([
      -12, -13, -14,
    ]);
    // The master's own GR and input are not the chain's.
    expect(reading.grDb).toBe(0);
    expect(reading.inputPeakDb).toEqual([METER_FLOOR_DB, METER_FLOOR_DB]);

    reading = applyMeterSnapshot(reading, meter(AFTER_METER_TARGET, { gainReductionDb: -4.5 }));
    expect(reading.grDb).toBe(-4.5);
    expect(reading.inputPeakDb).toEqual([-10, -11]);
    expect(reading.peakDb).toEqual([-6, -7]);

    const unchanged = applyMeterSnapshot(reading, meter(2, { peakDbL: 0 }));
    expect(unchanged).toBe(reading);
  });

  it('keeps the last per-insert gain reduction when a snapshot omits it', () => {
    let reading = applyMeterSnapshot(
      silentReading(),
      meter(AFTER_METER_TARGET, { insertGainReductionDb: [0, -2, -5] }),
    );
    expect(reading.insertGrDb).toEqual([0, -2, -5]);
    reading = applyMeterSnapshot(reading, meter(AFTER_METER_TARGET, { gainReductionDb: -1 }));
    expect(reading.grDb).toBe(-1);
    expect(reading.insertGrDb).toEqual([0, -2, -5]);
    reading = applyMeterSnapshot(reading, meter(MASTER_METER_TARGET));
    expect(reading.insertGrDb).toEqual([0, -2, -5]);
    expect(silentReading().insertGrDb).toEqual([]);
  });

  it('holds the true-peak maximum, never below a sample peak, until reset', () => {
    let reading = applyMeterSnapshot(silentReading(), meter(MASTER_METER_TARGET));
    expect(reading.truePeakDb).toBe(-0.9);
    // A quieter interval does not pull the held maximum down.
    reading = applyMeterSnapshot(
      reading,
      meter(MASTER_METER_TARGET, {
        peakDbL: -20,
        peakDbR: -21,
        truePeakDbL: -17,
        truePeakDbR: -18,
      }),
    );
    expect(reading.peakDb).toEqual([-20, -21]);
    expect(reading.truePeakDb).toBe(-0.9);
    // A streaming true peak a little under the sample peak reads as the sample peak.
    reading = applyMeterSnapshot(
      silentReading(),
      meter(MASTER_METER_TARGET, {
        peakDbL: -3,
        peakDbR: -3.2,
        truePeakDbL: -3.05,
        truePeakDbR: -3.3,
      }),
    );
    expect(reading.truePeakDb).toBe(-3);
    // Non-finite telemetry is ignored rather than poisoning the hold.
    reading = applyMeterSnapshot(
      reading,
      meter(MASTER_METER_TARGET, {
        peakDbL: Number.NaN,
        peakDbR: Number.NaN,
        truePeakDbL: Number.NaN,
        truePeakDbR: Number.NaN,
      }),
    );
    expect(reading.truePeakDb).toBe(-3);
    // Lane telemetry never moves the master's true peak.
    expect(
      applyMeterSnapshot(reading, meter(AFTER_METER_TARGET, { truePeakDbL: 3 })).truePeakDb,
    ).toBe(-3);
    expect(silentReading().truePeakDb).toBe(METER_FLOOR_DB);
  });

  it('never reports a positive gain reduction', () => {
    const reading = applyMeterSnapshot(
      silentReading(),
      meter(AFTER_METER_TARGET, { gainReductionDb: 0.2 }),
    );
    expect(reading.grDb).toBe(0);
  });

  it('takes the mid of the program window ending at the playhead, zero-padded at the edges', () => {
    const left = Float32Array.from([1, 2, 3, 4]);
    const right = Float32Array.from([3, 2, 1, 0]);
    const clip = { left, right, sampleRate: 4, integratedLufs: -20 };
    expect(Array.from(programWindow(clip, 1, 4) ?? [])).toEqual([2, 2, 2, 2]);
    expect(Array.from(programWindow(clip, 0.5, 4) ?? [])).toEqual([0, 0, 2, 2]);
    expect(programWindow(undefined, 0)).toBeNull();
    const detached = { ...clip, left: new Float32Array(0), right: new Float32Array(0) };
    expect(programWindow(detached, 0)).toBeNull();
  });
});

describe('mastering export report', () => {
  it('records the state rendered and the figures it measured', () => {
    const state = masteringMutators.applyLoudnessFit(defaultMasteringState(), {
      targetLufs: -14,
      driveDb: 3.456,
      measuredLufs: -14.1,
      residualLu: 0.1,
      bounces: 2,
      limited: false,
    });
    const result: MasteringExportResult = {
      fit: null,
      integratedLufs: -14.123,
      loudnessRange: 5.55,
      maxMomentaryLufs: -9.5,
      maxShortTermLufs: -11.2,
      truePeakDb: -1.04,
      shortTermLufs: new Float32Array(4),
    };
    const report = createMasteringReport({
      state,
      source: { fileName: 'mix.wav', sampleRate: 48000, duration: 12.3456, channels: 2 },
      render: {
        result,
        format: 'float32',
        dither: 'tpdf',
        at: 0,
        url: 'blob:x',
        fileName: 'mix-master.wav',
      },
    });
    expect(report.output).toEqual({
      fileName: 'mix-master.wav',
      format: 'float32',
      dither: 'none',
    });
    expect(report.measured).toEqual({
      integratedLufs: -14.12,
      loudnessRangeLu: 5.55,
      truePeakDbtp: -1.04,
      plrDb: 13.08,
      maxMomentaryLufs: -9.5,
      maxShortTermLufs: -11.2,
    });
    expect(report.loudnessFit).toEqual({ driveDb: 3.46, residualLu: 0.1, limited: false });
    expect(report.source?.durationSec).toBe(12.346);
    expect(report.target.integratedLufs).toBe(-14);
    expect(report.project.inserts).toHaveLength(13);
  });
});
