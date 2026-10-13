// @vitest-environment node
import { describe, expect, it } from 'vitest';
import * as wasm from '@/wasm/index.js';

/**
 * The player folds channels and converts the measured tuning through the
 * engine. These hold the engine to what the page used to compute itself.
 */
describe('engine folding and tuning reference', () => {
  it('folds stereo to (L + R) / 2 and an unmodelled layout to the plain mean', async () => {
    await wasm.init();
    const [stereo] = wasm.downmix([new Float32Array([1, 0]), new Float32Array([0, 1])], 0);
    expect(Array.from(stereo)).toEqual([0.5, 0.5]);

    const [three] = wasm.downmix(
      [new Float32Array([1]), new Float32Array([0.5]), new Float32Array([-0.5])],
      0,
    );
    expect(three[0]).toBeCloseTo(1 / 3, 6);

    const mono = new Float32Array([0.25, -0.5]);
    expect(Array.from(wasm.downmix([mono], 0)[0])).toEqual(Array.from(mono));
  });

  it('turns a semitone offset into the A4 reference the stream analyzer takes', async () => {
    await wasm.init();
    expect(wasm.tuningToReferenceHz(0)).toBe(440);
    expect(wasm.tuningToReferenceHz(0.13)).toBeCloseTo(440 * 2 ** (0.13 / 12), 4);
    expect(wasm.tuningToReferenceHz(-0.45)).toBeCloseTo(440 * 2 ** (-0.45 / 12), 4);
  });
});
