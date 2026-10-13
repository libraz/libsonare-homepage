// @vitest-environment node
/**
 * A surround source reaches the console as the engine's BS.775 stereo fold, so
 * what sits only in the centre or the surrounds is still heard; taking the
 * first two planes would drop it.
 */
import { describe, expect, it } from 'vitest';
import { foldToStereo } from '@/utils/audio';
import { loadIndexModule, rms, sine } from '../../wasm/support/engineHarness';

const SR = 48_000;

describe('surround sources fold to stereo', () => {
  it('keeps a centre-only 5.1 voice at −3 dB on both sides', async () => {
    const wasm = await loadIndexModule();
    const silent = () => new Float32Array(SR / 4);
    const centre = sine(440, 0.25, SR, 0.5);
    const [left, right] = foldToStereo(wasm, [
      silent(),
      silent(),
      centre,
      silent(),
      silent(),
      silent(),
    ]);
    for (const side of [left, right]) {
      expect(20 * Math.log10(rms(side) / rms(centre))).toBeCloseTo(-3, 1);
    }
  });

  it('spreads an unmodelled channel count as its mono fold', async () => {
    const wasm = await loadIndexModule();
    const tone = sine(220, 0.25, SR, 0.3);
    const [left, right] = foldToStereo(wasm, [tone, tone.slice(), tone.slice()]);
    expect(rms(left)).toBeGreaterThan(0.1);
    expect(Array.from(right)).toEqual(Array.from(left));
  });

  it('doubles a mono plane into two separate buffers', async () => {
    const wasm = await loadIndexModule();
    const tone = sine(220, 0.1, SR, 0.3);
    const [left, right] = foldToStereo(wasm, [tone]);
    expect(right).not.toBe(left);
    expect(Array.from(right)).toEqual(Array.from(tone));
  });
});
