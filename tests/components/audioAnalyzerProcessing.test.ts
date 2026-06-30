import { describe, expect, it } from 'vitest';
import {
  calculateNormalizationGain,
  mixToMono,
  splitMelBands,
} from '@/components/analyzer/audioAnalyzerProcessing';

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
    const bands = splitMelBands({
      nMels: 8,
      nFrames: 2,
      power: new Float32Array([1, 1, 0, 0, 4, 4, 4, 4, 9, 9, 0, 0, 16, 16, 16, 16]),
    });

    expect(Array.from(bands.low)).toEqual([1, 3]);
    expect(Array.from(bands.high)).toEqual([2, 4]);
  });
});
