// @vitest-environment node
/**
 * The mix assistant's proposal on the fixed layout: a real `suggestMixScene`
 * run over synthetic kick, bass, hi-hat and vocal stems maps its live values
 * onto the slots, lists what it cannot map, and switching to the proposal is
 * setters only. Hand-built results cover the overflow and rejection paths.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { mapMixSuggestion } from '@/demos/mixing/mixAssistantMap';
import type { MixAudioTransfer, MixSuggestResult } from '@/demos/mixing/mixing.worker';
import { buildFull, diff } from '@/demos/mixing/mixingEngine';
import {
  addTrack,
  applyMixPatch,
  createMixingState,
  type MixingState,
  plateDecayFromSeconds,
  setDuckKey,
} from '@/demos/mixing/mixingState';
import { applyOps, createRawTarget } from '@/utils/engineApply';
import type { MixAssistantResult, MixSceneStrip } from '@/wasm/index.js';
import {
  createRawEngine,
  loadIndexModule,
  maxAbsDiff,
  RENDER_QUANTUM,
} from '../../wasm/support/engineHarness';

const SR = 48_000;
const SECONDS = 20;

function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  };
}

const frames = SECONDS * SR;

function kick(): Float32Array {
  const out = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    const t = (i % (SR / 2)) / SR;
    out[i] = 0.9 * Math.exp(-t * 12) * Math.sin(2 * Math.PI * (50 + 90 * Math.exp(-t * 30)) * t);
  }
  return out;
}

function bass(): Float32Array {
  const notes = [41.2, 41.2, 55, 49];
  const out = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    const t = i / SR;
    const f = notes[Math.floor(t) % 4];
    let v = 0;
    for (let h = 1; h <= 6; h++) v += Math.sin(2 * Math.PI * f * h * t) / h;
    out[i] = 0.35 * v * (0.6 + 0.4 * Math.exp(-(t % 0.5) * 4));
  }
  return out;
}

function hat(): Float32Array {
  const next = random(7);
  const out = new Float32Array(frames);
  let previous = 0;
  for (let i = 0; i < frames; i++) {
    const white = next();
    out[i] = 0.4 * (white - previous) * Math.exp(-((i % (SR / 4)) / SR) * 60);
    previous = white;
  }
  return out;
}

function vox(): Float32Array[] {
  const next = random(11);
  const notes = [220, 247, 262, 294];
  const left = new Float32Array(frames);
  const right = new Float32Array(frames);
  let phase = 0;
  for (let i = 0; i < frames; i++) {
    const t = i / SR;
    phase +=
      (2 *
        Math.PI *
        notes[Math.floor(t / 0.75) % 4] *
        (1 + 0.006 * Math.sin(2 * Math.PI * 5.5 * t))) /
      SR;
    let v = 0;
    for (let h = 1; h <= 10; h++) v += Math.sin(h * phase) * (h === 3 || h === 4 ? 0.8 : 1 / h);
    const sibilance = t % 3 > 2.9 ? 0.15 * next() : 0;
    left[i] = 0.18 * v * (t % 0.75 < 0.65 ? 1 : 0) + sibilance;
    right[i] = left[i] * 0.95 + 0.01 * next();
  }
  return [left, right];
}

let state: MixingState;
let audio: MixAudioTransfer[];
let suggested: MixSuggestResult;
let wasm: Awaited<ReturnType<typeof loadIndexModule>>;

beforeAll(async () => {
  Object.defineProperty(globalThis, 'self', { configurable: true, value: { postMessage() {} } });
  const { suggestMix } = await import('@/demos/mixing/mixing.worker');
  wasm = await loadIndexModule();
  state = createMixingState();
  for (const name of ['kick', 'bass', 'hat', 'vox']) state = addTrack(state, name, SECONDS);
  audio = [
    { trackId: 1, channels: [kick()], sampleRate: SR },
    { trackId: 2, channels: [bass()], sampleRate: SR },
    { trackId: 3, channels: [hat()], sampleRate: SR },
    { trackId: 4, channels: vox(), sampleRate: SR },
  ];
  suggested = suggestMix(wasm, state, audio, SR);
}, 120_000);

describe('mix assistant proposal on a real analysis', () => {
  it('lists what the fixed layout cannot take', () => {
    const { unapplied } = suggested.suggestion;
    expect(unapplied).toContainEqual({
      source: '4',
      name: 'dynamics.vocalRider',
      reason: 'noSlot',
    });
    expect(unapplied).toContainEqual({
      source: '1',
      name: 'dynamics.transientShaper',
      reason: 'noSlot',
    });
    expect(unapplied).toContainEqual({ source: 'drumBus', name: 'bus', reason: 'subgroupBus' });
    expect(unapplied).toContainEqual({
      source: 'drumBusVca',
      name: 'vcaGroup',
      reason: 'vcaGroup',
    });
  });

  it('maps live strip values onto the slots', () => {
    const scene = suggested.suggestion;
    const strip = (id: string) =>
      (wasmResult().scene.strips as MixSceneStrip[]).find((s) => s.id === id)!;
    const kickPatch = scene.patch.tracks[1];
    expect(kickPatch.faderDb).toBe(strip('1').faderDb);
    expect(kickPatch.slots?.trim).toEqual({
      bypassed: false,
      params: { levelDb: strip('1').inputTrimDb },
    });
    const comp = kickPatch.slots?.comp;
    expect(comp?.bypassed).toBe(false);
    expect(Object.keys(comp?.params ?? {}).sort()).toEqual([
      'attackMs',
      'autoMakeup',
      'kneeDb',
      'ratio',
      'releaseMs',
      'thresholdDb',
    ]);
    expect(comp?.params?.autoMakeup).toBe(1);
    // The kick's parametric peak lands in the first Peak slot.
    expect(kickPatch.eq?.[2]?.type).toBe('Peak');
    expect(kickPatch.eq?.[2]?.enabled).toBe(true);
  });

  it('follows aux buses through their return strips', () => {
    const { patch } = suggested.suggestion;
    expect(patch.tracks[4].sends?.reverb).toEqual({ levelDb: -10.5, timing: 'postFader' });
    expect(patch.tracks[4].sends?.delay).toEqual({ levelDb: -14, timing: 'postFader' });
    const plate = wasmResult().scene.strips.find((s) => s.id === 'reverbReturn')!.inserts[0].params
      .decaySec as number;
    expect(patch.buses?.reverb?.params?.decay).toBe(plateDecayFromSeconds(plate));
    expect(patch.buses?.reverb?.params?.dryWet).toBe(1);
    expect(patch.buses?.delay?.params).toMatchObject({ dryWet: 1, pingPong: 1 });
    const masterTrim = wasmResult().scene.buses.find((b) => b.role === 'master')!.inputTrimDb!;
    expect(patch.masterFaderDb).toBe(state.master.faderDb + masterTrim);
  });

  it('passes classification and the mix profile through', () => {
    const result = wasmResult();
    expect(suggested.suggestion.classification).toEqual(
      result.tracks.map((t) => ({
        trackId: Number(t.stripId),
        source: t.source,
        confidence: t.sourceConfidence,
        usable: t.usable,
      })),
    );
    expect(suggested.suggestion.mix).toEqual(result.mix);
    expect(suggested.analyzedSec).toBe(60);
  });

  it('switching to the proposal and back is setters only, and audible', async () => {
    const proposal = applyMixPatch(state, suggested.suggestion.patch);
    const there = diff(state, proposal, new Map(), SR);
    const back = diff(proposal, state, new Map(), SR);
    expect(there.length).toBeGreaterThan(0);
    for (const op of [...there, ...back]) expect(op.type).not.toBe('strip');

    const registry = new Map(audio.map(({ trackId, ...entry }) => [trackId, entry]));
    const render = async (built: MixingState, switchTo?: MixingState) => {
      const engine = await createRawEngine(SR);
      const target = createRawTarget(engine);
      applyOps(target, buildFull(built, registry, SR));
      if (switchTo) applyOps(target, diff(built, switchTo, registry, SR));
      engine.play();
      const out = engine.bounceOffline({
        totalFrames: RENDER_QUANTUM * 400,
        numChannels: 2,
        blockSize: RENDER_QUANTUM,
      }).interleaved;
      engine.destroy();
      return out;
    };
    const mine = await render(state);
    const switched = await render(state, proposal);
    const built = await render(proposal);
    expect(maxAbsDiff(mine, switched)).toBeGreaterThan(1e-3);
    // Switching by setters lands where building the proposal from scratch does.
    expect(maxAbsDiff(switched, built)).toBeGreaterThan(0);
    // A delay time set live glides to its target, so only the proposal without the delay bus
    // lands exactly where building it from scratch does.
    const { delay: _glides, ...buses } = suggested.suggestion.patch.buses ?? {};
    const noDelay = applyMixPatch(state, { ...suggested.suggestion.patch, buses });
    expect(maxAbsDiff(await render(state, noDelay), await render(noDelay))).toBeLessThanOrEqual(
      1e-7,
    );
  });
});

// The worker returns only the mapped suggestion; the raw result is recomputed here for comparison.
let cachedResult: MixAssistantResult | undefined;
function wasmResult(): MixAssistantResult {
  cachedResult ??= wasm.suggestMixScene({
    sampleRate: SR,
    tracks: audio.map(({ trackId, channels }) => ({
      id: String(trackId),
      name: state.tracks.find((t) => t.id === trackId)!.name,
      left: channels[0],
      ...(channels[1] ? { right: channels[1] } : {}),
    })),
  });
  return cachedResult!;
}

describe('mix assistant mapping edge cases', () => {
  function strip(overrides: Partial<MixSceneStrip>): MixSceneStrip {
    return {
      id: '1',
      inputTrimDb: 0,
      faderDb: 0,
      vcaOffsetDb: 0,
      pan: 0,
      width: 1,
      muted: false,
      soloed: false,
      soloSafe: false,
      panMode: 0,
      dualPanLeft: -1,
      dualPanRight: 1,
      polarityInvertLeft: false,
      polarityInvertRight: false,
      panLaw: 0,
      channelDelaySamples: 0,
      inserts: [],
      sends: [],
      ...overrides,
    };
  }

  function result(strips: MixSceneStrip[]): MixAssistantResult {
    return {
      scene: { version: 1, strips, buses: [], vcaGroups: [], connections: [] },
      tracks: [],
      mix: { trackCount: 1, bandDominance: [], alignment: [], crowdedBands: [], monoRisks: [] },
      explanation: [],
    };
  }

  const base = () => addTrack(createMixingState(), 'one', 10);
  const info = (processor: string) => wasm.masteringInsertParamInfo(processor);

  it('lists bands past the matching slots, params the layout lacks, and construction-only params', () => {
    const peak = (n: number, hz: number) => ({
      [`band${n}.enabled`]: true,
      [`band${n}.type`]: 0,
      [`band${n}.frequencyHz`]: hz,
      [`band${n}.gainDb`]: -3,
      [`band${n}.q`]: 2,
    });
    const mapped = mapMixSuggestion(
      result([
        strip({
          polarityInvertLeft: true,
          channelDelaySamples: 12,
          inserts: [
            {
              slot: 'pre',
              processor: 'eq.parametric',
              params: { ...peak(0, 200), ...peak(1, 900), ...peak(2, 3000) },
            },
            { slot: 'pre', processor: 'dynamics.gate', params: { thresholdDb: -45, holdMs: 30 } },
            { slot: 'pre', processor: 'dynamics.compressor', params: { ratio: 3, detector: 2 } },
            { slot: 'pre', processor: 'saturation.tape', params: {} },
          ],
        }),
        strip({ id: 'elsewhere' }),
      ]),
      base(),
      info,
    );
    expect(mapped.unapplied).toEqual([
      { source: '1', name: 'polarityInvertLeft', reason: 'noSlot' },
      { source: '1', name: 'channelDelaySamples', reason: 'noSlot' },
      { source: '1', name: 'eq.Peak@3000Hz', reason: 'eqBandsFull' },
      { source: '1', name: 'dynamics.gate.holdMs', reason: 'notRealtimeSafe' },
      { source: '1', name: 'dynamics.compressor.detector', reason: 'notInLayout' },
      { source: '1', name: 'saturation.tape', reason: 'noSlot' },
      { source: 'elsewhere', name: 'strip', reason: 'unknownStrip' },
    ]);
    const patch = mapped.patch.tracks[1];
    expect(patch.eq?.[2]).toEqual({
      type: 'Peak',
      frequencyHz: 200,
      gainDb: -3,
      q: 2,
      enabled: true,
    });
    expect(patch.eq?.[3]?.frequencyHz).toBe(900);
    expect(patch.slots?.gate).toEqual({ bypassed: false, params: { thresholdDb: -45 } });
    expect(patch.slots?.comp).toEqual({ bypassed: false, params: { ratio: 3 } });
  });

  it('keys the duck slot from a named track', () => {
    let s = base();
    s = addTrack(s, 'two', 10);
    const mapped = mapMixSuggestion(
      result([
        strip({
          id: '2',
          inserts: [
            {
              slot: 'pre',
              processor: 'dynamics.duckingProcessor',
              params: { thresholdDb: -30 },
              sidechainKey: '1',
            },
          ],
        }),
      ]),
      s,
      info,
    );
    expect(mapped.patch.tracks[2].duckKeyTrackId).toBe(1);
    expect(applyMixPatch(s, mapped.patch).tracks[1].slots.duck.params.thresholdDb).toBe(-30);
  });

  it('skips a key that would close a cycle, with the mix or within the proposal', () => {
    const ducked = (id: string, key: string) =>
      strip({
        id,
        inserts: [
          { slot: 'pre', processor: 'dynamics.duckingProcessor', params: {}, sidechainKey: key },
        ],
      });
    const two = addTrack(base(), 'two', 10);
    const label = 'dynamics.duckingProcessor.sidechainKey';

    const withMix = mapMixSuggestion(result([ducked('2', '1')]), setDuckKey(two, 1, 2), info);
    expect(withMix.patch.tracks[2].duckKeyTrackId).toBeUndefined();
    expect(withMix.unapplied.some((u) => u.name === label)).toBe(true);

    const within = mapMixSuggestion(result([ducked('1', '2'), ducked('2', '1')]), two, info);
    expect(within.patch.tracks[1].duckKeyTrackId).toBe(2);
    expect(within.patch.tracks[2].duckKeyTrackId).toBeUndefined();
    expect(() => applyMixPatch(two, within.patch)).not.toThrow();
  });
});
