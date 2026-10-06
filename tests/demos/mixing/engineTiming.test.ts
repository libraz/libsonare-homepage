// @vitest-environment node
/**
 * Engine facts the mixing demo's timing and routing rest on: the channel delay
 * is counted in engine samples, the export length still covers a delayed send
 * tail, a sidechain cycle is refused by the engine, and lanes report on their
 * declaration-index meter target whatever order the keys put them in.
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildFull,
  exportFrames,
  type InsertTiming,
  MIX_TEMPO_BPM,
  type MixAudio,
} from '@/demos/mixing/mixingEngine';
import {
  addTrack,
  createMixingState,
  type MixingState,
  setChannelDelay,
  setDuckKey,
  setSend,
  setSlotBypass,
} from '@/demos/mixing/mixingState';
import { meterSources } from '@/demos/mixing/mixingUi';
import { applyOps, createFacadeTarget, createRawTarget } from '@/utils/engineApply';
import {
  createFacadeLoopback,
  createRawEngine,
  type FacadeLoopback,
  loadIndexModule,
  noise,
  RENDER_QUANTUM,
  rms,
  sine,
} from '../../wasm/support/engineHarness';

const SR = 48_000;
const SOURCE_SEC = 0.3;

const facades: FacadeLoopback[] = [];
afterEach(() => {
  for (const f of facades.splice(0)) f.dispose();
});

const stereo = (channel: Float32Array) => [channel, channel.slice()];

async function bounce(state: MixingState, audio: Map<number, MixAudio>, frames: number) {
  const raw = await createRawEngine(SR);
  try {
    raw.setTempo(MIX_TEMPO_BPM);
    applyOps(createRawTarget(raw), buildFull(state, audio, SR));
    raw.play();
    const { interleaved } = raw.bounceOffline({
      totalFrames: frames,
      blockSize: RENDER_QUANTUM,
      numChannels: 2,
      dither: 0,
    });
    return Float32Array.from({ length: frames }, (_, i) => interleaved[2 * i]);
  } finally {
    raw.destroy();
  }
}

async function facadeFor(state: MixingState, audio: Map<number, MixAudio>) {
  const f = await createFacadeLoopback({ sampleRate: SR, meterIntervalFrames: 512 });
  facades.push(f);
  f.engine.transport.setTempo(MIX_TEMPO_BPM);
  return { f, ops: buildFull(state, audio, SR), target: createFacadeTarget(f.engine) };
}

describe('channel delay basis', () => {
  it('counts engine samples for a source recorded at another rate', async () => {
    const audio = new Map([
      [1, { channels: stereo(noise(SOURCE_SEC, 1, 44_100, 0.4)), sampleRate: 44_100 }],
    ]);
    const base = addTrack(createMixingState(), 'a', SOURCE_SEC);
    const onset = (x: Float32Array) => x.findIndex((v) => Math.abs(v) > 1e-4);
    const plain = onset(await bounce(base, audio, 24_000));
    const delayed = onset(await bounce(setChannelDelay(base, 1, 10), audio, 24_000));
    expect(delayed - plain).toBe(Math.round(0.01 * SR));
  });
});

describe('export length', () => {
  it('covers the reverb tail of a delayed strip', async () => {
    const wasm = await loadIndexModule();
    const timing: InsertTiming = (processor, params, rate) =>
      wasm.masteringInsertTiming(processor, params, rate);
    const audio = new Map([
      [1, { channels: stereo(noise(SOURCE_SEC, 1, SR, 0.4)), sampleRate: SR }],
    ]);
    let state = setSend(addTrack(createMixingState(), 'a', SOURCE_SEC), 1, 'reverb', {
      levelDb: 0,
    });
    const without = exportFrames(state, SR, timing);
    state = setChannelDelay(state, 1, 50);
    const withDelay = exportFrames(state, SR, timing);
    expect(withDelay - without).toBe(Math.round(0.05 * SR));
    // The tail the delay pushes past the undelayed length is still audible.
    const out = await bounce(state, audio, withDelay);
    expect(rms(out, without, withDelay)).toBeGreaterThan(1e-5);
  });

  it('adds no latency for a keyed duck: reported graph latency stays zero', async () => {
    const audio = new Map([
      [1, { channels: stereo(noise(SOURCE_SEC, 1, SR, 0.4)), sampleRate: SR }],
      [2, { channels: stereo(noise(SOURCE_SEC, 2, SR, 0.4)), sampleRate: SR }],
    ]);
    let state = addTrack(addTrack(createMixingState(), 'a', SOURCE_SEC), 'b', SOURCE_SEC);
    state = setSlotBypass(state, 2, 'duck', false);
    const latency = async (s: MixingState) => {
      const { f, ops, target } = await facadeFor(s, audio);
      applyOps(target, ops);
      f.flush();
      f.engine.transport.play();
      f.render(RENDER_QUANTUM * 20);
      return f.processor.engine.telemetryScratchGraphLatencySamplesQ8();
    };
    expect(await latency(setDuckKey(state, 2, 1))).toBe(await latency(state));
  });
});

describe('sidechain cycles', () => {
  it('the engine refuses a binding that closes a cycle', async () => {
    const audio = new Map([
      [1, { channels: stereo(noise(SOURCE_SEC, 1, SR, 0.4)), sampleRate: SR }],
      [2, { channels: stereo(noise(SOURCE_SEC, 2, SR, 0.4)), sampleRate: SR }],
    ]);
    const base = addTrack(addTrack(createMixingState(), 'a', SOURCE_SEC), 'b', SOURCE_SEC);
    const chain = setDuckKey(base, 2, 1);
    const cyclic: MixingState = {
      ...chain,
      tracks: chain.tracks.map((t) => (t.id === 1 ? { ...t, duckKeyTrackId: 2 } : t)),
    };
    const ok = await facadeFor(chain, audio);
    applyOps(ok.target, ok.ops);
    ok.f.flush();
    expect(ok.f.syncErrors).toEqual([]);

    const bad = await facadeFor(cyclic, audio);
    expect(() => {
      applyOps(bad.target, bad.ops);
      bad.f.flush();
    }).toThrow();
  });
});

describe('lane meter targets', () => {
  it('stay on declaration order when a key is declared after its target', async () => {
    const levels = [0.5, 0.05, 0.2];
    const audio = new Map<number, MixAudio>(
      levels.map((amp, i) => [
        i + 1,
        { channels: stereo(sine(220 * (i + 1), 1, SR, amp)), sampleRate: SR },
      ]),
    );
    let base = createMixingState();
    for (const name of ['a', 'b', 'c']) base = addTrack(base, name, 1);
    const keyed = setDuckKey(base, 1, 2);
    const perTrack = async (state: MixingState) => {
      const { f, ops, target } = await facadeFor(state, audio);
      applyOps(target, ops);
      f.flush();
      f.engine.transport.play();
      f.render(RENDER_QUANTUM * 60);
      expect(f.syncErrors).toEqual([]);
      const sources = meterSources(state.tracks.map((t) => t.id));
      const peaks = new Map<number, number>();
      for (const m of f.meters) {
        const src = sources.get(m.targetId);
        if (src?.kind === 'track')
          peaks.set(src.trackId, Math.max(peaks.get(src.trackId) ?? -Infinity, m.peakDbL));
      }
      return peaks;
    };
    const plain = await perTrack(base);
    const withKey = await perTrack(keyed);
    expect(new Set([...plain.values()].map((v) => v.toFixed(1))).size).toBe(3);
    for (const id of [1, 2, 3]) expect(withKey.get(id)).toBeCloseTo(plain.get(id) as number, 1);
  });
});
