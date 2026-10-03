// @vitest-environment node
/**
 * The true peak the /mastering meters show is never below the sample peak
 * they show: measured on the real worklet facade playing the mastering
 * project, then folded through the page's own telemetry mapping.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { buildFull, type MasteringClip } from '@/demos/mastering/masteringEngine';
import {
  defaultMasteringState,
  type MasteringLane,
  masteringMutators as m,
} from '@/demos/mastering/masteringState';
import {
  applyMeterSnapshot,
  MASTER_METER_TARGET,
  silentReading,
} from '@/demos/mastering/useMasteringMetering';
import { applyOps, createFacadeTarget } from '@/utils/engineApply';
import { createFacadeLoopback, type FacadeLoopback, noise } from '../../wasm/support/engineHarness';

const SR = 48_000;
const SECONDS = 2;
/** The engine's streaming true peak may read this much low at a block edge. */
const STREAMING_TOLERANCE_DB = 0.1;

const facades: FacadeLoopback[] = [];
afterEach(() => {
  for (const f of facades.splice(0)) f.dispose();
});

/** Bursty program: loud kicks over quiet noise, so interval peaks swing widely. */
function program(): MasteringClip {
  const n = SECONDS * SR;
  const hissL = noise(SECONDS, 11, SR, 0.02);
  const hissR = noise(SECONDS, 12, SR, 0.02);
  const left = new Float32Array(n);
  const right = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const kick = 0.8 * Math.sin(2 * Math.PI * 60 * t) * Math.exp(-(t % 0.5) * 30);
    left[i] = kick + hissL[i];
    right[i] = 0.9 * kick + hissR[i];
  }
  return { left, right, sampleRate: SR, integratedLufs: Number.NaN };
}

describe('master true peak against sample peak', () => {
  for (const lane of ['after', 'before'] as MasteringLane[]) {
    it(`holds on the ${lane} lane`, async () => {
      const f = await createFacadeLoopback({ sampleRate: SR, meterIntervalFrames: 1024 });
      facades.push(f);
      f.engine.setTempo(60);
      const state = m.setMonitorLane(defaultMasteringState(), lane);
      applyOps(
        createFacadeTarget(f.engine),
        buildFull(state, { program: program(), reference: null }),
      );
      f.engine.transport.play();
      f.render(SECONDS * SR);

      const master = f.meters.filter((meter) => meter.targetId === MASTER_METER_TARGET);
      expect(master.length).toBeGreaterThan(40);
      let reading = silentReading();
      let maxSamplePeak = Number.NEGATIVE_INFINITY;
      for (const meter of master) {
        const samplePeak = Math.max(meter.peakDbL, meter.peakDbR);
        const truePeak = Math.max(meter.truePeakDbL, meter.truePeakDbR);
        // Engine telemetry: each interval's true peak covers its sample peak.
        expect(truePeak).toBeGreaterThanOrEqual(samplePeak - STREAMING_TOLERANCE_DB);
        reading = applyMeterSnapshot(reading, meter);
        maxSamplePeak = Math.max(maxSamplePeak, samplePeak);
        // What the page shows: the held true peak against the held sample peak.
        expect(reading.truePeakDb).toBeGreaterThanOrEqual(maxSamplePeak);
      }
      expect(maxSamplePeak).toBeGreaterThan(-12);
      // The interval readings swing far below the peak, which a held maximum must not follow.
      const quietest = Math.min(
        ...master.map((meter) => Math.max(meter.truePeakDbL, meter.truePeakDbR)),
      );
      expect(quietest).toBeLessThan(maxSamplePeak - 10);
    });
  }
});
