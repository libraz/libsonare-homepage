import { describe, expect, it } from 'vitest';
import { encodeWav, encodeWavInterleaved, type WavFormat } from '@/utils/audio';

/*
 * Parameter model: format {pcm16, pcm24, float32} x channels {1, 2} x
 * length in frames {0, odd (3), even (4)}. 18 combinations, small enough to
 * run as the full product rather than a pairwise subset.
 */
const FORMATS: WavFormat[] = ['pcm16', 'pcm24', 'float32'];
const CHANNELS = [1, 2];
const FRAMES = [0, 3, 4];
const BYTES: Record<WavFormat, number> = { pcm16: 2, pcm24: 3, float32: 4 };
// Edge values cycled through the samples: both rails, beyond them, NaN, zero, a rounding case.
const PATTERN = [1, -1, 2, -2, Number.NaN, 0, 0.5, -0.5];

function tag(view: DataView, at: number): string {
  return String.fromCharCode(...[0, 1, 2, 3].map((i) => view.getUint8(at + i)));
}

function readPcm(view: DataView, offset: number, format: WavFormat): number {
  if (format === 'pcm16') return view.getInt16(offset, true);
  if (format === 'float32') return view.getFloat32(offset, true);
  const raw =
    view.getUint8(offset) | (view.getUint8(offset + 1) << 8) | (view.getUint8(offset + 2) << 16);
  return raw & 0x800000 ? raw - 0x1000000 : raw;
}

function expected(value: number, format: WavFormat): number {
  if (format === 'float32') return Math.fround(value);
  if (Number.isNaN(value)) return 0;
  const scale = format === 'pcm16' ? 0x8000 : 0x800000;
  return Math.max(-scale, Math.min(scale - 1, Math.round(value * scale)));
}

describe('encodeWavInterleaved', () => {
  for (const format of FORMATS) {
    for (const channels of CHANNELS) {
      for (const frames of FRAMES) {
        it(`${format} x ${channels}ch x ${frames} frames`, () => {
          const samples = new Float32Array(frames * channels).map(
            (_, i) => PATTERN[i % PATTERN.length],
          );
          const buffer = encodeWavInterleaved(samples, 48_000, channels, format);
          const view = new DataView(buffer);
          const bytes = BYTES[format];
          const isFloat = format === 'float32';
          const headerSize = isFloat ? 58 : 44;
          const dataSize = samples.length * bytes;

          expect(tag(view, 0)).toBe('RIFF');
          expect(view.getUint32(4, true)).toBe(buffer.byteLength - 8);
          expect(tag(view, 8)).toBe('WAVE');
          expect(tag(view, 12)).toBe('fmt ');
          expect(view.getUint32(16, true)).toBe(isFloat ? 18 : 16);
          expect(view.getUint16(20, true)).toBe(isFloat ? 3 : 1);
          expect(view.getUint16(22, true)).toBe(channels);
          expect(view.getUint32(24, true)).toBe(48_000);
          expect(view.getUint32(28, true)).toBe(48_000 * channels * bytes);
          expect(view.getUint16(32, true)).toBe(channels * bytes);
          expect(view.getUint16(34, true)).toBe(bytes * 8);
          if (isFloat) {
            expect(view.getUint16(36, true)).toBe(0);
            expect(tag(view, 38)).toBe('fact');
            expect(view.getUint32(42, true)).toBe(4);
            expect(view.getUint32(46, true)).toBe(frames);
          }
          expect(tag(view, headerSize - 8)).toBe('data');
          expect(view.getUint32(headerSize - 4, true)).toBe(dataSize);
          // Odd-sized data is padded to a word boundary, outside the data chunk size.
          expect(buffer.byteLength).toBe(headerSize + dataSize + (dataSize % 2));

          for (let i = 0; i < samples.length; i++) {
            const got = readPcm(view, headerSize + i * bytes, format);
            expect(got).toBe(expected(samples[i], format));
          }
        });
      }
    }
  }

  it('pins the clipping edges of each PCM depth', () => {
    const edges = new Float32Array([1, -1, 1.5, -1.5]);
    const v16 = new DataView(encodeWavInterleaved(edges, 8000, 1, 'pcm16'));
    expect([44, 46, 48, 50].map((o) => v16.getInt16(o, true))).toEqual([
      32767, -32768, 32767, -32768,
    ]);
    const v24 = new DataView(encodeWavInterleaved(edges, 8000, 1, 'pcm24'));
    expect([44, 47, 50, 53].map((o) => readPcm(v24, o, 'pcm24'))).toEqual([
      8388607, -8388608, 8388607, -8388608,
    ]);
  });

  it('keeps float32 samples unclipped', () => {
    const view = new DataView(encodeWavInterleaved(new Float32Array([2, -3]), 8000, 1, 'float32'));
    expect(view.getFloat32(58, true)).toBe(2);
    expect(view.getFloat32(62, true)).toBe(-3);
  });

  it('defaults to 16-bit PCM', () => {
    const samples = new Float32Array([0.25, -0.25]);
    expect(encodeWavInterleaved(samples, 8000, 1)).toEqual(
      encodeWavInterleaved(samples, 8000, 1, 'pcm16'),
    );
  });
});

describe('encodeWav format', () => {
  it('forwards the format for planar input', () => {
    const buffer = encodeWav([new Float32Array([0.5]), new Float32Array([-0.5])], 44_100, 'pcm24');
    const view = new DataView(buffer);
    expect(view.getUint16(34, true)).toBe(24);
    expect(readPcm(view, 44, 'pcm24')).toBe(0x400000);
    expect(readPcm(view, 47, 'pcm24')).toBe(-0x400000);
  });
});
