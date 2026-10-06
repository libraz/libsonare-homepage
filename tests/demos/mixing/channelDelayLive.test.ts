// @vitest-environment node
/**
 * A channel delay changed on a playing facade delays only its own strip: the
 * other lanes render sample for sample as they do without the edit, and the
 * edited strip lands where a freshly built engine puts it.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { buildFull, diff, MIX_TEMPO_BPM, type MixAudio } from '@/demos/mixing/mixingEngine';
import {
  addTrack,
  createMixingState,
  type MixingState,
  moveClip,
  setChannelDelay,
  setFader,
  setMute,
  setPan,
} from '@/demos/mixing/mixingState';
import { applyOps, createFacadeTarget } from '@/utils/engineApply';
import {
  createFacadeLoopback,
  type FacadeLoopback,
  maxAbsDiff,
  noise,
  RENDER_QUANTUM,
  rms,
  type StereoBuffer,
  sine,
} from '../../wasm/support/engineHarness';

const SR = 48_000;
const SOURCE_SEC = 0.5;
const DELAY_MS = 1.5;
const DELAY_SAMPLES = Math.round((DELAY_MS * SR) / 1000);
const PLAY_QUANTA = 40;
const AFTER_QUANTA = 100;
/** Frames after the edit that a parameter change may take to settle. */
const SETTLE_FRAMES = 2048;
const EDIT_FRAME = PLAY_QUANTA * RENDER_QUANTUM;
const TOTAL_FRAMES = (PLAY_QUANTA + AFTER_QUANTA) * RENDER_QUANTUM;

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
  return setFader(s, 2, -3);
}

/** Plays `from` for a while, switches to `to` mid-play, and returns the whole render. */
async function renderSwitch(from: MixingState, to: MixingState): Promise<StereoBuffer> {
  const registry = audio();
  const f = await createFacadeLoopback({ sampleRate: SR });
  facades.push(f);
  f.engine.transport.setTempo(MIX_TEMPO_BPM);
  const target = createFacadeTarget(f.engine);
  applyOps(target, buildFull(from, registry, SR));
  f.flush();
  f.engine.transport.play();
  const head = f.render(EDIT_FRAME);
  applyOps(target, diff(from, to, registry, SR));
  const tail = f.render(TOTAL_FRAMES - EDIT_FRAME);
  expect(f.syncErrors).toEqual([]);
  const left = new Float32Array(TOTAL_FRAMES);
  const right = new Float32Array(TOTAL_FRAMES);
  left.set(head.left);
  left.set(tail.left, EDIT_FRAME);
  right.set(head.right);
  right.set(tail.right, EDIT_FRAME);
  return { left, right };
}

/** `to` rendered from a fresh build, without any mid-play switch. */
const renderFresh = (to: MixingState) => renderSwitch(to, to);

describe('channel delay changed while playing', () => {
  it('leaves the other lanes untouched', async () => {
    // The edited strip's clip starts after the window, so only the other lane is audible.
    const base = moveClip(twoTracks(), 1, 1);
    const edited = setChannelDelay(base, 1, DELAY_MS);
    const control = await renderSwitch(base, base);
    const live = await renderSwitch(base, edited);
    expect(rms(control.left, 0, TOTAL_FRAMES)).toBeGreaterThan(1e-2);
    expect(maxAbsDiff(live.left, control.left)).toBeLessThanOrEqual(1e-7);
    expect(maxAbsDiff(live.right, control.right)).toBeLessThanOrEqual(1e-7);
  });

  it('delays its own strip to where a fresh build puts it', async () => {
    const base = setMute(twoTracks(), 2, true);
    const edited = setChannelDelay(base, 1, DELAY_MS);
    const control = await renderSwitch(base, base);
    const live = await renderSwitch(base, edited);
    const fresh = await renderFresh(edited);
    const from = EDIT_FRAME + SETTLE_FRAMES;

    // The edit moved the strip, and the move is the delay: live[n] tracks control[n - delay].
    expect(maxAbsDiff(live.left.subarray(from), control.left.subarray(from))).toBeGreaterThan(0.05);
    const shifted = control.left.subarray(from - DELAY_SAMPLES, TOTAL_FRAMES - DELAY_SAMPLES);
    expect(maxAbsDiff(live.left.subarray(from), shifted)).toBeLessThanOrEqual(1e-7);

    expect(maxAbsDiff(live.left.subarray(from), fresh.left.subarray(from))).toBeLessThanOrEqual(
      1e-7,
    );
    expect(maxAbsDiff(live.right.subarray(from), fresh.right.subarray(from))).toBeLessThanOrEqual(
      1e-7,
    );
  });
});
