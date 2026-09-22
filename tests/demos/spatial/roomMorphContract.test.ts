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
  });
});
