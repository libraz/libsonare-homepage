// @vitest-environment node
/**
 * The repair preprocess and the detect step, against the engine. The program
 * now comes from `masteringRepairApply`; it must render the samples the
 * repair-only chain call rendered for every preset that repairs. Detect must
 * find what a source carries, and applying its suggestion must remove it.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import {
  type MasteringClip,
  prepareProgram,
  repairStages,
} from '@/demos/mastering/masteringEngine';
import {
  defaultMasteringState,
  MASTERING_REPAIR_STAGES,
  type MasteringState,
  masteringMutators as m,
} from '@/demos/mastering/masteringState';
import { MASTERING_PRESETS, MASTERING_VENUES } from '@/demos/mastering/masteringUi';
import { channelPlanes, foldToStereo } from '@/utils/audio';
import { loadIndexModule, maxAbsDiff, noise } from '../../wasm/support/engineHarness';

type Wasm = Awaited<ReturnType<typeof loadIndexModule>>;
type WorkerModule = typeof import('@/demos/mastering/mastering.worker');

const SR = 44_100;
const SECONDS = 4;

let wasm: Wasm;
let detectRepair: WorkerModule['detectRepair'];

beforeAll(async () => {
  wasm = await loadIndexModule();
  // The Worker module installs its message loop on `self` when imported.
  Object.defineProperty(globalThis, 'self', { configurable: true, value: {} });
  ({ detectRepair } = await import('@/demos/mastering/mastering.worker'));
}, 30_000);

/**
 * Plucked notes over hiss; `defects` adds a 60 Hz hum series and sparse
 * clicks. The notes decay, as music does: a noise tracker reads a perfectly
 * steady sine as noise.
 */
function source(defects: boolean): MasteringClip {
  const n = SECONDS * SR;
  const hissL = noise(SECONDS, 3, SR, 0.01);
  const hissR = noise(SECONDS, 4, SR, 0.01);
  const left = new Float32Array(n);
  const right = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const note = Math.floor(t / 0.5);
    const music =
      0.3 * Math.sin(2 * Math.PI * (note % 2 ? 330 : 220) * t) * Math.exp(-(t - note * 0.5) * 6);
    let hum = 0;
    if (defects)
      for (let h = 1; h <= 4; h++) hum += (0.04 / h) * Math.sin(2 * Math.PI * 60 * h * t);
    left[i] = music + hum + hissL[i];
    right[i] = 0.9 * music + hum + hissR[i];
    if (defects && i % 9000 === 50) {
      left[i] += 0.7;
      right[i] -= 0.6;
    }
  }
  return { left, right, sampleRate: SR, integratedLufs: Number.NaN };
}

/** Energy at `hz` over the whole signal (Goertzel), in dB. */
function toneDb(x: Float32Array, hz: number): number {
  const w = (2 * Math.PI * hz) / SR;
  const c = 2 * Math.cos(w);
  let s1 = 0;
  let s2 = 0;
  for (const v of x) {
    const s0 = v + c * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  return 10 * Math.log10(s1 * s1 + s2 * s2 - c * s1 * s2);
}

function chainProgram(clip: MasteringClip, state: MasteringState) {
  const repair = Object.fromEntries(
    repairStages(state.repair).map(({ stage, ...params }) => [stage, { ...params, enabled: true }]),
  );
  return wasm.masteringChainStereoWithProgress(clip.left, clip.right, SR, { repair }, () => {});
}

describe('repair preprocess on masteringRepairApply', () => {
  it('renders what the repair-only chain call rendered, for every preset that repairs', () => {
    const clip = source(true);
    const states: [string, MasteringState][] = [];
    for (const { id: preset } of MASTERING_PRESETS) {
      for (const { id: venue } of MASTERING_VENUES) {
        const state = m.selectVenue(m.selectPreset(defaultMasteringState(), preset), venue);
        if (repairStages(state.repair).length > 0) states.push([`${preset}/${venue}`, state]);
      }
    }
    let every = defaultMasteringState();
    for (const stage of MASTERING_REPAIR_STAGES)
      every = m.setRepairStageEnabled(every, stage, true);
    states.push(['every stage at its defaults', every]);
    expect(states.length).toBeGreaterThan(3);

    for (const [name, state] of states) {
      const { program } = prepareProgram(wasm, clip, state.repair);
      const chain = chainProgram(clip, state);
      expect(maxAbsDiff(program.left, chain.left), name).toBeLessThanOrEqual(1e-7);
      expect(maxAbsDiff(program.right, chain.right), name).toBeLessThanOrEqual(1e-7);
    }
  }, 120_000);
});

describe('repair detect', () => {
  it('suggests nothing for a clean source', () => {
    const detection = detectRepair(wasm, source(false));
    expect(detection.recommended).toEqual({});
  }, 60_000);

  it('finds hum and clicks, and applying the suggestion removes them', () => {
    const clip = source(true);
    const detection = detectRepair(wasm, clip);
    expect(Object.keys(detection.recommended)).toEqual(
      expect.arrayContaining(['declick', 'dehum']),
    );
    expect(detection.defects.humFundamentalHz).toBeCloseTo(60, 0);
    for (const params of Object.values(detection.recommended)) {
      for (const value of Object.values(params)) expect(typeof value).not.toBe('string');
    }

    const state = m.applyRepairSuggestion(defaultMasteringState(), detection.recommended);
    const { program, stages } = prepareProgram(wasm, clip, state.repair);
    expect(stages).toEqual(expect.arrayContaining(['declick', 'dehum']));
    expect(toneDb(clip.left, 60) - toneDb(program.left, 60)).toBeGreaterThan(10);
    // The music itself is left in place.
    expect(Math.abs(toneDb(clip.left, 220) - toneDb(program.left, 220))).toBeLessThan(1);
    const peak = (x: Float32Array) => x.reduce((max, v) => Math.max(max, Math.abs(v)), 0);
    expect(peak(program.left)).toBeLessThan(peak(clip.left) - 0.3);
  }, 60_000);
});

describe('surround sources', () => {
  /** An AudioBuffer stand-in carrying `channels`. */
  const buffer = (channels: Float32Array[]) =>
    ({
      numberOfChannels: channels.length,
      getChannelData: (c: number) => channels[c],
    }) as unknown as AudioBuffer;

  it('fold a 5.1 bed through the engine matrix, so a centre-only voice reaches both sides', () => {
    const n = 4800;
    const centre = new Float32Array(n).map((_, i) => 0.5 * Math.sin((2 * Math.PI * 440 * i) / SR));
    const silent = () => new Float32Array(n);
    const [left, right] = foldToStereo(
      wasm,
      channelPlanes(buffer([silent(), silent(), centre, silent(), silent(), silent()])),
    );
    const gain = 10 ** (-3 / 20);
    expect(
      maxAbsDiff(
        left,
        centre.map((v) => v * gain),
      ),
    ).toBeLessThan(1e-3);
    expect(maxAbsDiff(right, left)).toBeLessThanOrEqual(1e-7);
  });

  it('keep a stereo file as it is and double a mono one', () => {
    const a = new Float32Array([0.1, 0.2]);
    const b = new Float32Array([0.3, 0.4]);
    expect(foldToStereo(wasm, channelPlanes(buffer([a, b])))).toEqual([a, b]);
    const [left, right] = foldToStereo(wasm, channelPlanes(buffer([a])));
    expect(right).toEqual(a);
    expect(right).not.toBe(left);
  });
});
