import { describe, expect, it } from 'vitest';
import {
  calculateNormalizationGain,
  mixToMono,
  splitMelBands,
  tuningReference,
} from '@/demos/analyzer/audioAnalyzerProcessing';

function mockAudioBuffer(channels: Float32Array[]): AudioBuffer {
  return {
    length: channels[0]?.length ?? 0,
    numberOfChannels: channels.length,
    getChannelData: (channel: number) => channels[channel],
  } as AudioBuffer;
}

describe('audio analyzer processing helpers', () => {
  it('calculates normalization gain only for loud buffers', () => {
    expect(calculateNormalizationGain(mockAudioBuffer([new Float32Array([0.1, -0.4])]))).toBe(1);
    expect(calculateNormalizationGain(mockAudioBuffer([new Float32Array([1])]))).toBe(0.5);
  });

  it('mixes stereo and multichannel audio to mono', () => {
    expect(
      Array.from(mixToMono(mockAudioBuffer([new Float32Array([1, 0]), new Float32Array([0, 1])]))),
    ).toEqual([0.5, 0.5]);

    expect(
      mixToMono(
        mockAudioBuffer([new Float32Array([1]), new Float32Array([0.5]), new Float32Array([-0.5])]),
      )[0],
    ).toBeCloseTo(1 / 3);
  });

  it('splits mel power into low and high RMS bands', () => {
    // Row-major [nMels x nFrames]: each pair is one mel band across the two frames.
    const bands = splitMelBands({
      nMels: 8,
      nFrames: 2,
      power: new Float32Array([1, 9, 1, 9, 0, 0, 0, 0, 4, 16, 4, 16, 4, 16, 4, 16]),
    });

    expect(Array.from(bands.low)).toEqual([1, 3]);
    expect(Array.from(bands.high)).toEqual([2, 4]);
  });
});

describe('tuningReference', () => {
  it('turns a semitone offset into the A4 reference and whole cents', () => {
    expect(tuningReference(0)).toEqual({ refHz: 440, cents: 0 });
    const sharp = tuningReference(0.13);
    expect(sharp.cents).toBe(13);
    expect(sharp.refHz).toBeCloseTo(440 * 2 ** (0.13 / 12), 9);
    expect(tuningReference(-0.45).cents).toBe(-45);
  });

  it('falls back to concert pitch for an offset that is not a number', () => {
    expect(tuningReference(Number.NaN)).toEqual({ refHz: 440, cents: 0 });
  });
});
