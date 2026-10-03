// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import {
  busMeterTarget,
  createFacadeLoopback,
  createProcessorLoop,
  DEFAULT_SAMPLE_RATE,
  distinctFramesByTarget,
  type FacadeLoopback,
  fromDb,
  laneMeterTarget,
  MASTER_METER_TARGET,
  noise,
  type ProcessorLoop,
  peak,
  quantumFrames,
  rms,
  sine,
} from './support/engineHarness';

const SR = DEFAULT_SAMPLE_RATE;
const REVERB_BUS = 1;

describe('engineHarness', () => {
  let loop: ProcessorLoop | undefined;
  let facade: FacadeLoopback | undefined;

  afterEach(() => {
    loop?.dispose();
    facade?.dispose();
    loop = undefined;
    facade = undefined;
  });

  it('processor at meterIntervalFrames 1024 publishes >= 20 distinct frames per second for every target', async () => {
    loop = await createProcessorLoop({ meterIntervalFrames: 1024 });
    const { engine } = loop;
    engine.setTrackBuses([{ busId: REVERB_BUS }]);
    engine.setTrackLanes([
      { trackId: 1, sends: [{ busId: REVERB_BUS, levelDb: -6 }] },
      { trackId: 2 },
    ]);
    engine.setClips([
      { trackId: 1, channels: [sine(220, 1.2, SR, 0.4), sine(220, 1.2, SR, 0.4)], startPpq: 0 },
      { trackId: 2, channels: [noise(1.2, 7, SR, 0.2), noise(1.2, 8, SR, 0.2)], startPpq: 0 },
    ]);
    engine.play();

    loop.render(SR);

    const frames = distinctFramesByTarget(loop.meters);
    const targets = [
      MASTER_METER_TARGET,
      laneMeterTarget(0),
      laneMeterTarget(1),
      busMeterTarget(0),
    ];
    for (const target of targets) {
      expect(frames.get(target) ?? 0, `target ${target}`).toBeGreaterThanOrEqual(20);
    }
    // Cadence is the interval, not every block: 48000 / 1024 = 46.9.
    expect(frames.get(MASTER_METER_TARGET)).toBeLessThanOrEqual(48);
  });

  it('processor output is the clip that was scheduled', async () => {
    loop = await createProcessorLoop();
    loop.engine.setTrackLanes([{ trackId: 1 }]);
    loop.engine.setClips([
      { trackId: 1, channels: [sine(440, 0.5, SR, 0.5), sine(440, 0.5, SR, 0.5)], startPpq: 0 },
    ]);
    loop.engine.play();

    const out = loop.render(quantumFrames(0.4));

    // Unity fader at centre pan: whatever the pan law, a 0.5 sine lands between -3 dB and 0 dB of itself.
    expect(peak(out.left)).toBeGreaterThan(0.5 * fromDb(-3.1));
    expect(peak(out.left)).toBeLessThanOrEqual(0.5 + 1e-6);
  });

  it('facade loopback becomes ready and renders a clip', async () => {
    facade = await createFacadeLoopback();
    const { engine } = facade;
    engine.setTrackLanes([{ trackId: 1 }]);
    engine.addClip(1, [sine(330, 1, SR, 0.5), sine(330, 1, SR, 0.5)], 0);
    engine.transport.play();

    const out = facade.render(quantumFrames(0.4));

    expect(facade.syncErrors).toEqual([]);
    expect(rms(out.left, 4800)).toBeGreaterThan(0.1);
    expect(rms(out.right, 4800)).toBeGreaterThan(0.1);
    expect(facade.meters.some((m) => m.targetId === MASTER_METER_TARGET)).toBe(true);
  });
});
