// @vitest-environment node
/**
 * The reference analysis hands the engine a reference at its own rate
 * (`referenceSampleRate`) instead of resampling it first. Pinned against the
 * page's earlier path, a reference resampled onto the program's rate before
 * the same analyses: the readings agree.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import type { MasteringClip } from '@/demos/mastering/masteringEngine';
import { loadIndexModule, noise } from '../../wasm/support/engineHarness';

type Wasm = Awaited<ReturnType<typeof loadIndexModule>>;
type WorkerModule = typeof import('@/demos/mastering/mastering.worker');

const SECONDS = 4;

/** Kick, two tones and hiss, brighter on the right: a reference with a tonal tilt to find. */
function clip(rate: number, seed: number, bright: number): MasteringClip {
  const n = SECONDS * rate;
  const hiss = noise(SECONDS, seed, rate, 0.04);
  const left = new Float32Array(n);
  const right = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const kick = Math.sin(2 * Math.PI * 55 * t) * Math.exp(-(t % 0.5) * 10);
    const tone = 0.12 * Math.sin(2 * Math.PI * 330 * t) + bright * Math.sin(2 * Math.PI * 6000 * t);
    left[i] = 0.35 * kick + tone + hiss[i];
    right[i] = 0.3 * kick + tone + 1.5 * hiss[i];
  }
  return { left, right, sampleRate: rate, integratedLufs: Number.NaN };
}

describe('reference analysis at the reference rate', () => {
  let wasm: Wasm;
  let analyzeReference: WorkerModule['analyzeReference'];
  let measureReference: WorkerModule['measureReference'];
  beforeAll(async () => {
    wasm = await loadIndexModule();
    // The Worker module installs its message loop on `self` when imported.
    Object.defineProperty(globalThis, 'self', { configurable: true, value: {} });
    ({ analyzeReference, measureReference } = await import('@/demos/mastering/mastering.worker'));
  }, 30_000);

  it('reads like a reference resampled onto the program rate first', () => {
    const program = clip(48_000, 3, 0.02);
    const native = measureReference(wasm, clip(44_100, 9, 0.08));
    const resampled = measureReference(wasm, {
      ...native,
      left: wasm.resample(native.left, 44_100, 48_000),
      right: wasm.resample(native.right, 44_100, 48_000),
      sampleRate: 48_000,
    });
    const a = analyzeReference(wasm, program, native);
    const b = analyzeReference(wasm, program, resampled);

    expect(a.loudness.referenceLufs).toBeCloseTo(b.loudness.referenceLufs, 1);
    const bands = (r: typeof a) =>
      (r.tonalBalance as { bands: { deviationDb: number }[] }).bands.map((x) => x.deviationDb);
    const deviations = bands(a).map((value, i) => Math.abs(value - bands(b)[i]));
    expect(bands(a).length).toBeGreaterThan(3);
    expect(Math.max(...deviations)).toBeLessThan(0.25);
    for (const [i, band] of a.matchEq.bands.entries()) {
      const other = b.matchEq.bands[i];
      expect(Math.abs(Math.log2(band.frequencyHz / other.frequencyHz))).toBeLessThan(0.1);
      expect(band.gainDb).toBeCloseTo(other.gainDb, 0);
    }
    // The reference's 6 kHz lift reads as the program falling short there.
    expect(Math.min(...bands(a))).toBeLessThan(-1);
  });
});
