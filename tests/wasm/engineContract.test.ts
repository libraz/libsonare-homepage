// @vitest-environment node
/**
 * Engine contract the mastering and mixing demos are built on. Every item is
 * measured by rendering through the real worklet processor or the real
 * `SonareEngine` facade, never read off the type declarations, so a WASM
 * refresh that changes the behaviour turns the matching item red.
 *
 * Set ENGINE_CONTRACT_VERBOSE=1 to print the measured values.
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  busMeterTarget,
  createFacadeLoopback,
  createProcessorLoop,
  DEFAULT_SAMPLE_RATE,
  distinctFramesByTarget,
  type FacadeLoopback,
  laneMeterTarget,
  loadIndexModule,
  MASTER_METER_TARGET,
  type MeterSnapshot,
  noise,
  type ProcessorLoop,
  peak,
  quantumFrames,
  rms,
  sine,
  toDb,
} from './support/engineHarness';

const SR = DEFAULT_SAMPLE_RATE;
const BUS = 1;

const VERBOSE = Boolean(
  (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env
    .ENGINE_CONTRACT_VERBOSE,
);

function report(label: string, values: Record<string, unknown>): void {
  if (VERBOSE) {
    console.info(`[engineContract] ${label} ${JSON.stringify(values)}`);
  }
}

function stereo(channel: Float32Array): Float32Array[] {
  return [channel, channel.slice()];
}

function trackStrip(id: number, inserts: unknown[], extra: Record<string, unknown> = {}): string {
  return JSON.stringify({ version: 1, strips: [{ id: String(id), ...extra, inserts }] });
}

function busStrip(id: number, inserts: unknown[]): string {
  return JSON.stringify({ version: 1, buses: [{ id: String(id), inserts }] });
}

function masterStrip(inserts: unknown[]): string {
  return JSON.stringify({ version: 1, strips: [{ id: 'master', inserts }] });
}

const hardCompressor = {
  slot: 'pre',
  processor: 'dynamics.compressor',
  params: { thresholdDb: -30, ratio: 8, attackMs: 1, releaseMs: 50, makeupGainDb: 0 },
};

function recordsAfter(
  meters: readonly MeterSnapshot[],
  target: number,
  fromFrame: number,
): MeterSnapshot[] {
  return meters.filter((m) => m.targetId === target && m.frame >= fromFrame);
}

function minOf(values: number[]): number {
  return values.reduce((a, b) => Math.min(a, b), Number.POSITIVE_INFINITY);
}

function maxOf(values: number[]): number {
  return values.reduce((a, b) => Math.max(a, b), Number.NEGATIVE_INFINITY);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? Number.NaN;
}

function mid(left: Float32Array, right: Float32Array): Float32Array {
  const out = new Float32Array(left.length);
  for (let i = 0; i < left.length; i++) out[i] = 0.5 * (left[i] + right[i]);
  return out;
}

const facades: FacadeLoopback[] = [];
const loops: ProcessorLoop[] = [];

async function facade(meterIntervalFrames?: number): Promise<FacadeLoopback> {
  const created = await createFacadeLoopback({ meterIntervalFrames });
  facades.push(created);
  return created;
}

async function processorLoop(meterIntervalFrames?: number): Promise<ProcessorLoop> {
  const created = await createProcessorLoop({ meterIntervalFrames });
  loops.push(created);
  return created;
}

afterEach(() => {
  for (const f of facades.splice(0)) f.dispose();
  for (const l of loops.splice(0)) l.dispose();
});

describe('E1 lane, bus and master meters carry gain reduction and input peak', () => {
  it('reports GR on a driven lane/bus/master compressor and the pre-trim input peak', async () => {
    const f = await facade(1024);
    const { engine } = f;
    const clipLevel = 0.9;
    engine.setTrackBuses([{ busId: BUS }]);
    // Lane 1: driven compressor. Lane 2: plain, routed into the bus, so the bus input is lane 2's output.
    engine.setTrackLanes([{ trackId: 1 }, { trackId: 2, outputBusId: BUS }]);
    engine.setTrackStripJson(1, trackStrip(1, [hardCompressor]));
    engine.setBusStripJson(BUS, busStrip(BUS, [hardCompressor]));
    engine.setMasterStripJson(masterStrip([{ ...hardCompressor, slot: 'post' }]));
    engine.addClip(1, stereo(sine(220, 1.2, SR, clipLevel)), 0);
    engine.addClip(2, stereo(sine(330, 1.2, SR, 0.5)), 0);
    engine.transport.play();

    f.render(quantumFrames(1));

    const settled = Math.round(0.3 * SR);
    const lane = recordsAfter(f.meters, laneMeterTarget(0), settled);
    const lane2 = recordsAfter(f.meters, laneMeterTarget(1), settled);
    const bus = recordsAfter(f.meters, busMeterTarget(0), settled);
    const master = recordsAfter(f.meters, MASTER_METER_TARGET, settled);
    expect(lane.length).toBeGreaterThan(0);
    expect(bus.length).toBeGreaterThan(0);
    expect(master.length).toBeGreaterThan(0);

    const laneGr = minOf(lane.map((m) => m.gainReductionDb));
    const busGr = minOf(bus.map((m) => m.gainReductionDb));
    const masterGr = minOf(master.map((m) => m.gainReductionDb));
    const laneInL = maxOf(lane.map((m) => m.inputPeakDbL));
    const laneInR = maxOf(lane.map((m) => m.inputPeakDbR));
    const busInL = maxOf(bus.map((m) => m.inputPeakDbL));
    const lane2OutL = maxOf(lane2.map((m) => m.peakDbL));
    report('E1', {
      laneGr,
      busGr,
      masterGr,
      laneInL,
      laneInR,
      busInL,
      lane2OutL,
      clipDb: toDb(clipLevel),
    });

    expect(laneGr).toBeLessThan(-1);
    expect(busGr).toBeLessThan(-1);
    expect(masterGr).toBeLessThan(-1);
    // GR is a reduction: never positive.
    for (const m of [...lane, ...bus, ...master]) expect(m.gainReductionDb).toBeLessThanOrEqual(0);
    // Lane input peak is measured before trim and inserts: the clip's own level.
    expect(Math.abs(laneInL - toDb(clipLevel))).toBeLessThan(0.3);
    expect(Math.abs(laneInR - toDb(clipLevel))).toBeLessThan(0.3);
    // Bus input peak is what lane 2 delivers into it, before the bus compressor.
    expect(Math.abs(busInL - lane2OutL)).toBeLessThan(0.5);
  });
});

describe('E2 limiter ceiling is live by name; non-rtSafe by-name writes are refused', () => {
  const limiter = (ceilingDb: number) => ({
    slot: 'pre',
    processor: 'maximizer.truePeakLimiter',
    params: { ceilingDb, releaseMs: 50 },
  });

  it('a lane truePeakLimiter follows ceilingDb set by name after construction (processor)', async () => {
    const loop = await processorLoop();
    const { engine } = loop;
    engine.setTrackLanes([{ trackId: 1 }]);
    engine.setTrackStripJson(1, trackStrip(1, [limiter(-1)]));
    engine.setClips([{ trackId: 1, channels: stereo(sine(220, 2, SR, 0.95)), startPpq: 0 }]);
    engine.play();
    const before = loop.render(quantumFrames(0.5));
    engine.setTrackStripInsertParamByName(1, 0, 'ceilingDb', -6);
    const after = loop.render(quantumFrames(0.8));

    const peakBefore = toDb(peak(before.left, quantumFrames(0.2)));
    const peakAfter = toDb(peak(after.left, quantumFrames(0.3)));
    report('E2 lane ceiling', { peakBefore, peakAfter });
    expect(Math.abs(peakBefore - -1)).toBeLessThan(0.1);
    expect(Math.abs(peakAfter - -6)).toBeLessThan(0.1);
  });

  it('a master truePeakLimiter follows ceilingDb set by name through the facade', async () => {
    const f = await facade();
    const { engine } = f;
    engine.setTrackLanes([{ trackId: 1 }]);
    engine.setMasterStripJson(masterStrip([{ ...limiter(-1), slot: 'post' }]));
    engine.addClip(1, stereo(sine(220, 2, SR, 0.95)), 0);
    engine.transport.play();
    f.render(quantumFrames(0.5));
    engine.setMasterStripInsertParamByName(0, 'ceilingDb', -6);
    const after = f.render(quantumFrames(0.8));

    const peakAfter = toDb(peak(after.left, quantumFrames(0.3)));
    report('E2 master ceiling (facade)', { peakAfter, syncErrors: f.syncErrors });
    expect(Math.abs(peakAfter - -6)).toBeLessThan(0.1);
  });

  it('a non-rtSafe parameter by name throws and has no automation id (processor engine)', async () => {
    const loop = await processorLoop();
    const { engine } = loop;
    engine.setTrackLanes([{ trackId: 1 }]);
    engine.setTrackStripJson(
      1,
      trackStrip(1, [{ slot: 'pre', processor: 'multiband.compressor', params: {} }, limiter(-1)]),
    );

    expect(() => engine.setTrackStripInsertParamByName(1, 0, 'cutoff0Hz', 300)).toThrow();
    expect(() => engine.setTrackStripInsertParamByName(1, 1, 'lookaheadMs', 3)).toThrow();
    expect(engine.resolveTrackInsertAutomationId(1, 0, 'cutoff0Hz')).toBe(-1);
    expect(engine.resolveTrackInsertAutomationId(1, 1, 'lookaheadMs')).toBe(-1);
    // The rtSafe neighbours resolve, so -1 above is about rtSafe, not a bad address.
    expect(engine.resolveTrackInsertAutomationId(1, 0, 'band0.thresholdDb')).not.toBe(-1);
    expect(engine.resolveTrackInsertAutomationId(1, 1, 'ceilingDb')).not.toBe(-1);
  });

  it('a non-rtSafe parameter by name throws and has no automation id (facade)', async () => {
    const f = await facade();
    const { engine } = f;
    engine.setTrackLanes([{ trackId: 1 }]);
    engine.setTrackStripJson(
      1,
      trackStrip(1, [{ slot: 'pre', processor: 'multiband.compressor', params: {} }, limiter(-1)]),
    );
    f.flush();

    let threw = false;
    try {
      engine.setTrackStripInsertParamByName(1, 0, 'cutoff0Hz', 300);
    } catch {
      threw = true;
    }
    f.flush();
    report('E2 facade non-rtSafe', { threw, syncErrors: f.syncErrors });
    expect(threw).toBe(true);
    expect(engine.resolveTrackInsertAutomationId(1, 0, 'cutoff0Hz')).toBe(-1);
    expect(engine.resolveTrackInsertAutomationId(1, 1, 'ceilingDb')).not.toBe(-1);
  });
});

describe('E3 SonareEngine.create forwards meterIntervalFrames to the processor', () => {
  async function masterFramesPerSecond(meterIntervalFrames?: number) {
    const f = await facade(meterIntervalFrames);
    f.engine.setTrackLanes([{ trackId: 1 }]);
    f.engine.addClip(1, stereo(sine(440, 1.2, SR, 0.3)), 0);
    f.engine.transport.play();
    f.render(quantumFrames(1));
    return {
      processorOption: f.processorOptions.meterIntervalFrames,
      frames: distinctFramesByTarget(f.meters).get(MASTER_METER_TARGET) ?? 0,
      laneFrames: distinctFramesByTarget(f.meters).get(laneMeterTarget(0)) ?? 0,
    };
  }

  it('1024 doubles the cadence of the 2048 default', async () => {
    const fast = await masterFramesPerSecond(1024);
    const standard = await masterFramesPerSecond(undefined);
    report('E3', { fast, standard });
    expect(fast.processorOption).toBe(1024);
    // 48000 / 1024 = 46.9 per second; 48000 / 2048 = 23.4.
    expect(fast.frames).toBeGreaterThanOrEqual(40);
    expect(fast.laneFrames).toBeGreaterThanOrEqual(40);
    expect(standard.frames).toBeLessThanOrEqual(25);
  });
});

describe('E4 facade strip JSON follows the native insert-retention rule', () => {
  const reverb = {
    slot: 'pre',
    processor: 'effects.reverb.plate',
    params: { decaySec: 2.5, dryWet: 1 },
  };
  const gain = (levelDb: number) => ({
    slot: 'pre',
    processor: 'utility.gain',
    params: { levelDb },
  });
  const lead = 0.55;
  const tailStart = quantumFrames(0.05);
  const tailFrames = quantumFrames(0.6);

  /** Renders a noise burst into a reverb, applies `edit` mid-tail, returns the tail after the edit. */
  async function tailAfter(edit?: (engine: FacadeLoopback['engine']) => void) {
    const f = await facade();
    const { engine } = f;
    engine.setTrackLanes([{ trackId: 1 }]);
    engine.setTrackStripJson(1, trackStrip(1, [reverb, gain(0)], { width: 1 }));
    engine.addClip(1, stereo(noise(0.3, 11, SR, 0.4)), 0);
    engine.transport.play();
    f.render(quantumFrames(lead));
    edit?.(engine);
    const out = f.render(tailFrames);
    return { out, mid: mid(out.left, out.right), syncErrors: f.syncErrors };
  }

  it('a width-only change keeps the reverb tail', async () => {
    const control = await tailAfter();
    const edited = await tailAfter((engine) => {
      engine.setTrackStripJson(1, trackStrip(1, [reverb, gain(0)], { width: 0.5 }));
    });
    // Width scales the side signal; the mid carries the tail unchanged.
    const controlRms = rms(control.mid, tailStart);
    const editedRms = rms(edited.mid, tailStart);
    report('E4 width', { controlRms, editedRms, ratio: editedRms / controlRms });
    expect(controlRms).toBeGreaterThan(1e-3);
    expect(Math.abs(editedRms / controlRms - 1)).toBeLessThan(0.01);
  });

  // Pin: the native rule compares the whole insert list, so editing any one insert rebuilds
  // them all. Strip JSON is therefore reserved for discrete edits; if this flips, a
  // per-insert rebuild has landed and the discrete edits stop costing the other inserts.
  it('changing one insert rebuilds every insert on the strip', async () => {
    const control = await tailAfter();
    // Only the downstream stateless gain changes, yet the upstream reverb loses its tail.
    const gainEdited = await tailAfter((engine) => {
      engine.setTrackStripJson(1, trackStrip(1, [reverb, gain(-6)], { width: 1 }));
    });
    const controlRms = rms(control.mid, tailStart);
    const gainRatio = rms(gainEdited.mid, tailStart) / controlRms;
    report('E4 per-insert', { controlRms, gainRatio });
    expect(controlRms).toBeGreaterThan(1e-3);
    expect(gainRatio, 'reverb tail after editing only the downstream gain').toBeLessThan(0.01);
  });
});

describe('E5 lane sends tap pre- or post-fader', () => {
  async function busLevel(sendTiming: 'preFader' | 'postFader', faderDb: number) {
    const f = await facade(1024);
    const { engine } = f;
    engine.setTrackBuses([{ busId: BUS }]);
    engine.setTrackLanes([{ trackId: 1, sends: [{ busId: BUS, levelDb: 0, sendTiming }] }]);
    engine.addClip(1, stereo(sine(220, 1.2, SR, 0.5)), 0);
    engine.setStripGain(1, faderDb);
    engine.transport.play();
    f.render(quantumFrames(0.8));
    const records = recordsAfter(f.meters, busMeterTarget(0), Math.round(0.3 * SR));
    return median(records.map((m) => m.rmsDbL));
  }

  it('preFader ignores the lane fader; postFader follows it', async () => {
    const pre0 = await busLevel('preFader', 0);
    const preDown = await busLevel('preFader', -60);
    const post0 = await busLevel('postFader', 0);
    const postDown = await busLevel('postFader', -60);
    report('E5', { pre0, preDown, post0, postDown });
    expect(pre0).toBeGreaterThan(-30);
    expect(Math.abs(preDown - pre0)).toBeLessThan(0.5);
    expect(post0 - postDown).toBeGreaterThan(50);
  });
});

describe('E6 master integrated loudness can be reset through the facade', () => {
  it('after a reset, integrated LUFS reflects only the material that followed', async () => {
    const loudSeconds = 1.5;
    const gapSeconds = 0.6;
    const quietSeconds = 2.5;
    const total = loudSeconds + gapSeconds + quietSeconds;
    const clip = new Float32Array(Math.round(total * SR));
    clip.set(sine(1000, loudSeconds, SR, 0.8), 0);
    clip.set(sine(1000, quietSeconds, SR, 0.05), Math.round((loudSeconds + gapSeconds) * SR));

    async function run(reset: boolean) {
      const f = await facade(1024);
      f.engine.setTrackLanes([{ trackId: 1 }]);
      f.engine.addClip(1, stereo(clip), 0);
      f.engine.transport.play();
      f.render(quantumFrames(loudSeconds + gapSeconds));
      if (reset) f.engine.resetMasterLoudnessMeter();
      f.render(quantumFrames(quietSeconds));
      const master = f.meters.filter((m) => m.targetId === MASTER_METER_TARGET);
      const last = master[master.length - 1];
      const quietMomentary = median(
        recordsAfter(
          master,
          MASTER_METER_TARGET,
          Math.round((loudSeconds + gapSeconds + 0.6) * SR),
        ).map((m) => m.momentaryLufs),
      );
      return { integrated: last?.integratedLufs ?? Number.NaN, quietMomentary };
    }

    const control = await run(false);
    const withReset = await run(true);
    report('E6', { control, withReset });
    // Without a reset the loud part dominates (relative gate drops the quiet blocks).
    expect(control.integrated - withReset.integrated).toBeGreaterThan(10);
    // With it, integrated equals the steady quiet tone's loudness.
    expect(Math.abs(withReset.integrated - withReset.quietMomentary)).toBeLessThan(1);
  });
});

describe('pins', () => {
  it('multiband.compressor crossover cutoffs are construction-only (non-rtSafe)', async () => {
    const mod = await loadIndexModule();
    const info: Array<{ name: string; rtSafe: boolean; id: number | null }> =
      mod.masteringInsertParamInfo('multiband.compressor');
    const cutoffs = info.filter((p) => /^cutoff\d+Hz$/.test(p.name));
    expect(cutoffs.map((p) => p.name)).toContain('cutoff0Hz');
    expect(cutoffs.map((p) => p.name)).toContain('cutoff1Hz');
    for (const p of cutoffs) {
      expect(p.rtSafe, p.name).toBe(false);
      expect(p.id, p.name).toBeNull();
    }
    // The live surface the design uses stays rtSafe.
    for (const name of ['thresholdDb', 'ratio', 'attackMs', 'releaseMs', 'makeupGainDb']) {
      for (const band of [0, 1, 2]) {
        const entry = info.find((p) => p.name === `band${band}.${name}`);
        expect(entry?.rtSafe, `band${band}.${name}`).toBe(true);
      }
    }
  });
});
