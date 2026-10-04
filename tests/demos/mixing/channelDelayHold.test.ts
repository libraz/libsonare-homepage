// @vitest-environment node
/**
 * The page holds a channel-delay edit made while playing and applies it once
 * the transport stops. This pins that the stopped-transport path is exact: a
 * live facade that played the old delay, stopped, took the diff and played
 * again renders the new state sample for sample as the export Worker's fresh
 * raw engine does.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { MixAudioTransfer } from '@/demos/mixing/mixing.worker';
import { buildFull, diff, MIX_TEMPO_BPM, type MixAudio } from '@/demos/mixing/mixingEngine';
import {
  addTrack,
  createMixingState,
  type MixingState,
  setChannelDelay,
  setFader,
  setPan,
} from '@/demos/mixing/mixingState';
import { holdChannelDelays } from '@/demos/mixing/mixingUi';
import { applyOps, createFacadeTarget } from '@/utils/engineApply';
import {
  createFacadeLoopback,
  type FacadeLoopback,
  loadIndexModule,
  maxAbsDiff,
  noise,
  RENDER_QUANTUM,
  rms,
  sine,
} from '../../wasm/support/engineHarness';

const SR = 48_000;
const SOURCE_SEC = 0.5;

let renderMixExport: typeof import('@/demos/mixing/mixing.worker').renderMixExport;

beforeAll(async () => {
  // The worker module installs its message handler on `self` when imported.
  Object.defineProperty(globalThis, 'self', { configurable: true, value: { postMessage() {} } });
  ({ renderMixExport } = await import('@/demos/mixing/mixing.worker'));
});

const facades: FacadeLoopback[] = [];
afterEach(() => {
  for (const f of facades.splice(0)) f.dispose();
});

function audio(): Map<number, MixAudio> {
  return new Map([
    [
      1,
      { channels: [noise(SOURCE_SEC, 1, SR, 0.4), noise(SOURCE_SEC, 2, SR, 0.4)], sampleRate: SR },
    ],
    [
      2,
      {
        channels: [sine(110, SOURCE_SEC, SR, 0.4), sine(165, SOURCE_SEC, SR, 0.4)],
        sampleRate: SR,
      },
    ],
  ]);
}

function twoTracks(): MixingState {
  let s = createMixingState();
  s = addTrack(s, 'noise', SOURCE_SEC);
  s = addTrack(s, 'tone', SOURCE_SEC);
  s = setPan(s, 1, -0.4);
  s = setFader(s, 2, -3);
  return s;
}

describe('channel delay held until the transport stops', () => {
  it('a delay applied while stopped renders exactly as a freshly built export', async () => {
    const wasm = await loadIndexModule();
    const registry = audio();
    const before = twoTracks();
    const after = setChannelDelay(setChannelDelay(before, 1, 1.5), 2, 0.4);

    // While playing, the page keeps the old delays on the engine.
    expect(holdChannelDelays(after, before).tracks.map((t) => t.channelDelayMs)).toEqual([0, 0]);

    const f = await createFacadeLoopback({ sampleRate: SR });
    facades.push(f);
    f.engine.transport.setTempo(MIX_TEMPO_BPM);
    const target = createFacadeTarget(f.engine);
    applyOps(target, buildFull(before, registry));
    f.flush();

    // Play the old delays for a while, then stop and let the strips drain.
    f.engine.transport.play();
    f.render(RENDER_QUANTUM * 60);
    f.engine.transport.stop();
    f.render(RENDER_QUANTUM * 40);

    // Stopped: the held edit goes out as the page's diff, then playback restarts from zero.
    const edit = diff(before, after, registry);
    expect(edit.filter((op) => op.type === 'stripScalars')).toHaveLength(2);
    applyOps(target, edit);
    f.engine.transport.seekSeconds(0);
    f.flush();
    f.render(RENDER_QUANTUM);
    f.processor.engine.settleParameters();
    f.engine.transport.play();

    const transfers: MixAudioTransfer[] = [...audio()].map(([trackId, entry]) => ({
      trackId,
      ...entry,
    }));
    const exported = renderMixExport(wasm, after, transfers, SR, { dither: 0 });
    const frames = exported.left.length;
    const live = f.render(Math.ceil(frames / RENDER_QUANTUM) * RENDER_QUANTUM);
    expect(f.syncErrors).toEqual([]);

    expect(rms(exported.left)).toBeGreaterThan(1e-2);
    const diffL = maxAbsDiff(live.left.subarray(0, frames), exported.left);
    const diffR = maxAbsDiff(live.right.subarray(0, frames), exported.right);
    expect(Math.max(diffL, diffR)).toBeLessThanOrEqual(1e-7);
  });
});
