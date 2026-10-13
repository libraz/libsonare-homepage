// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { decodeAudioFile } from '@/utils/audio';

function fileDecodingTo(channels: Float32Array[]): [File, AudioContext] {
  const buffer = {
    length: channels[0].length,
    duration: channels[0].length / 48_000,
    sampleRate: 48_000,
    numberOfChannels: channels.length,
    getChannelData: (c: number) => channels[c],
  } as AudioBuffer;
  const context = { decodeAudioData: vi.fn(async () => buffer) } as unknown as AudioContext;
  const file = new File(['audio'], 'bed.wav', { type: 'audio/wav' });
  Object.defineProperty(file, 'arrayBuffer', { value: async () => new ArrayBuffer(4) });
  return [file, context];
}

const silent = (n: number) => new Float32Array(n);

describe('decodeAudioFile on more than two channels', () => {
  it('keeps a 5.1 centre in both sides through the engine downmix', async () => {
    // Measured: a centre at 0.5 lands at 0.3536 (-3 dB) on L and R.
    const centre = new Float32Array(64).fill(0.5);
    const [file, context] = fileDecodingTo([
      silent(64),
      silent(64),
      centre,
      silent(64),
      silent(64),
      silent(64),
    ]);
    const decoded = await decodeAudioFile(file, context);
    expect(decoded.channels).toBe(6);
    expect(decoded.left[10]).toBeCloseTo(0.5 * Math.SQRT1_2, 6);
    expect(decoded.right[10]).toBeCloseTo(0.5 * Math.SQRT1_2, 6);
  });

  it('folds a layout the engine does not model to mono on both sides', async () => {
    const one = new Float32Array(32).fill(0.4);
    const [file, context] = fileDecodingTo([one, silent(32), silent(32), silent(32)]);
    const decoded = await decodeAudioFile(file, context);
    expect(decoded.left[3]).toBeGreaterThan(0);
    expect(Array.from(decoded.right)).toEqual(Array.from(decoded.left));
    expect(decoded.right).not.toBe(decoded.left);
  });
});
