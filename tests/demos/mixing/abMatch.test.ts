// @vitest-environment node
/**
 * A/B loudness matching: the pure gain rule, the Worker's offline measurement
 * against the real engine, and the export staying independent of the match.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { abMatchGains } from '@/demos/mixing/mixAssistantMap';
import type { MixAudioTransfer } from '@/demos/mixing/mixing.worker';
import { addTrack, createMixingState, setMasterFader } from '@/demos/mixing/mixingState';
import { loadIndexModule, noise, sine } from '../../wasm/support/engineHarness';

const SR = 48_000;
const WINDOW_SEC = 2;

let worker: typeof import('@/demos/mixing/mixing.worker');
let wasm: Awaited<ReturnType<typeof loadIndexModule>>;

beforeAll(async () => {
  Object.defineProperty(globalThis, 'self', { configurable: true, value: { postMessage() {} } });
  worker = await import('@/demos/mixing/mixing.worker');
  wasm = await loadIndexModule();
});

function project() {
  let a = createMixingState();
  a = addTrack(a, 'tone', 3);
  a = addTrack(a, 'noise', 3);
  const audio: MixAudioTransfer[] = [
    { trackId: 1, channels: [sine(220, 3, SR, 0.4), sine(220, 3, SR, 0.4)], sampleRate: SR },
    { trackId: 2, channels: [noise(3, 5, SR, 0.2)], sampleRate: SR },
  ];
  return { a, b: setMasterFader(a, -6), audio };
}

describe('abMatchGains', () => {
  it('lowers A when A is louder', () => {
    expect(abMatchGains(-26.1, -30.4).aDb).toBeCloseTo(-4.3, 6);
    expect(abMatchGains(-26.1, -30.4).bDb).toBe(0);
  });

  it('lowers B when B is louder', () => {
    const gains = abMatchGains(-30, -24);
    expect(gains.aDb).toBe(0);
    expect(gains.bDb).toBeCloseTo(-6, 6);
  });

  it('leaves equal loudness untouched', () => {
    expect(abMatchGains(-23, -23)).toEqual({ aDb: 0, bDb: 0 });
  });

  it('applies no gain to a non-finite loudness', () => {
    for (const [a, b] of [
      [Number.NEGATIVE_INFINITY, -20],
      [-20, Number.NaN],
      [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY],
    ]) {
      expect(abMatchGains(a, b)).toEqual({ aDb: 0, bDb: 0 });
    }
  });
});

describe('measureAB', () => {
  it('matches A and B within 0.1 LU after the gains, with both gains at or below 0 dB', () => {
    const { a, b, audio } = project();
    const { aLufs, bLufs } = worker.measureAB(wasm, a, b, audio, SR, WINDOW_SEC);
    expect(bLufs).toBeLessThan(aLufs);

    const { aDb, bDb } = abMatchGains(aLufs, bLufs);
    expect(aDb).toBeLessThanOrEqual(0);
    expect(bDb).toBeLessThanOrEqual(0);
    const gap = Math.abs(aLufs + aDb - (bLufs + bDb));
    expect(gap).toBeLessThanOrEqual(0.1);
  });

  it('leaves the export render of a state unchanged', () => {
    const { a, b, audio } = project();
    const options = { dither: 0 } as const;
    const before = worker.renderMixExport(wasm, a, audio, SR, options);
    worker.measureAB(wasm, a, b, audio, SR, WINDOW_SEC);
    const after = worker.renderMixExport(wasm, a, audio, SR, options);

    expect(after.left).toEqual(before.left);
    expect(after.right).toEqual(before.right);
    expect(after.integratedLufs).toBe(before.integratedLufs);
    // The gain lives on the monitor, never in the state the export builds from.
    expect(JSON.stringify(a)).not.toMatch(/monitor/i);
  });
});
