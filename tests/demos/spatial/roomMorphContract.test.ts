// @vitest-environment node
import { describe, expect, it } from 'vitest';
import * as wasm from '@/wasm/index.js';

/**
 * The worker protocol test runs against a mock, so a mock that encodes the wrong
 * return shape passes while the page is broken — which is how `roomMorph`'s result
 * object came to be posted as if it were the samples themselves, putting `undefined`
 * in the transfer list. These call the engine and pin the shape the worker unwraps.
 */

const SAMPLE_RATE = 48_000;

/** A short, decaying tone: enough excitation for a room to answer. */
function probe(seconds: number): Float32Array {
  const samples = new Float32Array(Math.round(SAMPLE_RATE * seconds));
  for (let i = 0; i < samples.length; i++) {
    samples[i] = Math.sin(i * 0.05) * 0.3 * Math.exp(-i / (SAMPLE_RATE * 0.2));
  }
  return samples;
}

const room = {
  lengthM: 6,
  widthM: 4,
  heightM: 2.8,
  absorption: 0.18,
  sourceX: 1,
  sourceY: 1,
  sourceZ: 1.2,
  listenerX: 3,
  listenerY: 2,
  listenerZ: 1.2,
  ismOrder: 2,
  wet: 0.42,
  sourceTailSuppression: 0.18,
  seed: 2026,
};

describe('roomMorph', () => {
  it('answers with a result object, not the samples', async () => {
    await wasm.init();
    const input = probe(0.5);
    const result = wasm.roomMorph(input, SAMPLE_RATE, { ...room, maxSeconds: 2.5 });

    expect(result).not.toBeInstanceOf(Float32Array);
    expect(result.audio).toBeInstanceOf(Float32Array);
    expect(result.audio.buffer).toBeInstanceOf(ArrayBuffer);
    expect(result.sampleRate).toBe(SAMPLE_RATE);
    expect(Array.isArray(result.diagnostics)).toBe(true);
  });

  it('appends the room tail, so the answer outlasts what went in', async () => {
    await wasm.init();
    const input = probe(0.5);
    const result = wasm.roomMorph(input, SAMPLE_RATE, { ...room, maxSeconds: 2.5 });
    expect(result.audio.length).toBeGreaterThan(input.length);
  });

  // Two cathedral-sized convolutions, one of them 11.4 s long: past the default
  // per-test budget whenever the machine is doing anything else.
  it('cuts the tail at maxSeconds and says so, which is why it tracks the room', async () => {
    await wasm.init();
    const input = probe(0.5);
    const cavern = {
      ...room,
      lengthM: 34,
      widthM: 20,
      heightM: 24,
      absorption: 0.07,
    };

    const short = wasm.roomMorph(input, SAMPLE_RATE, { ...cavern, maxSeconds: 2.5 });
    const long = wasm.roomMorph(input, SAMPLE_RATE, { ...cavern, maxSeconds: 11.4 });

    expect(long.audio.length).toBeGreaterThan(short.audio.length);
    expect(short.diagnostics.map((entry) => entry.code)).toContain('acoustic.rir_length_clamped');
  }, 30_000);
});

/** Normalized correlation of two signals from `from` on. */
function correlation(a: Float32Array, b: Float32Array, from: number): number {
  let ab = 0;
  let aa = 0;
  let bb = 0;
  for (let i = from; i < Math.min(a.length, b.length); i++) {
    ab += a[i] * b[i];
    aa += a[i] * a[i];
    bb += b[i] * b[i];
  }
  return ab / Math.sqrt(aa * bb);
}

/** A decaying broadband burst: a pure tone stays coherent across half a metre. */
function noiseBurst(seconds: number): Float32Array {
  const samples = new Float32Array(Math.round(SAMPLE_RATE * seconds));
  let state = 7;
  for (let i = 0; i < samples.length; i++) {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    samples[i] = ((state / 0x7fffffff) * 2 - 1) * 0.2 * Math.exp(-i / (SAMPLE_RATE * 0.05));
  }
  return samples;
}

/**
 * /spatial renders its morph with `roomMorphStereo`. Two mono morphs through one
 * geometry give both channels the same tail; two receivers give each its own.
 * The same input on both sides isolates that difference.
 */
describe('roomMorphStereo', () => {
  it('returns both channels, each with the room tail appended', async () => {
    await wasm.init();
    const input = probe(0.5);
    const result = wasm.roomMorphStereo({
      left: input,
      right: input,
      sampleRate: SAMPLE_RATE,
      ...room,
      maxSeconds: 2.5,
      receiverSpacingM: 0.5,
    });

    expect(result.left).toBeInstanceOf(Float32Array);
    expect(result.right).toHaveLength(result.left.length);
    expect(result.left.length).toBeGreaterThan(input.length);
    expect(result.sampleRate).toBe(SAMPLE_RATE);
    expect(Array.isArray(result.diagnostics)).toBe(true);
  });

  it('decorrelates the tail that the per-channel path copies to both sides', async () => {
    await wasm.init();
    const input = noiseBurst(0.5);
    const options = { ...room, maxSeconds: 2.5 };

    const perChannelLeft = wasm.roomMorph(input, SAMPLE_RATE, options).audio;
    const perChannelRight = wasm.roomMorph(input, SAMPLE_RATE, options).audio;
    const stereo = wasm.roomMorphStereo({
      left: input,
      right: input,
      sampleRate: SAMPLE_RATE,
      ...options,
      receiverSpacingM: 0.5,
    });

    // Measured: 1.000 per channel, 0.03 with two receivers.
    expect(correlation(perChannelLeft, perChannelRight, input.length)).toBeGreaterThan(0.9999);
    expect(Math.abs(correlation(stereo.left, stereo.right, input.length))).toBeLessThan(0.3);
  });
});
