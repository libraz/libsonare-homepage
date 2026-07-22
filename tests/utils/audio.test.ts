import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AudioInputBudgetError,
  amplitudeToDb,
  calculateCorrelation,
  calculatePeakRms,
  decodeAudioFile,
  downloadJson,
  downsampleWaveform,
  encodeWavStereo,
  formatDb,
  formatDuration,
  formatSampleRate,
  mixToMono,
} from '@/utils/audio';

function audioBuffer(channels: Float32Array[], sampleRate = 48_000): AudioBuffer {
  return {
    length: channels[0]?.length ?? 0,
    duration: (channels[0]?.length ?? 0) / sampleRate,
    sampleRate,
    numberOfChannels: channels.length,
    getChannelData: (channel: number) => channels[channel],
  } as AudioBuffer;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('decodeAudioFile', () => {
  it('decodes stereo files into copied left/right channel buffers', async () => {
    const sourceLeft = new Float32Array([0.1, 0.2]);
    const sourceRight = new Float32Array([-0.1, -0.2]);
    const context = {
      decodeAudioData: vi.fn(async () => audioBuffer([sourceLeft, sourceRight], 44_100)),
    } as unknown as AudioContext;
    const file = new File(['audio'], 'song.wav', { type: 'audio/wav' });
    Object.defineProperty(file, 'arrayBuffer', {
      configurable: true,
      value: vi.fn(async () => new ArrayBuffer(4)),
    });

    const decoded = await decodeAudioFile(file, context);

    expect(context.decodeAudioData).toHaveBeenCalledWith(expect.any(ArrayBuffer));
    expect(decoded).toMatchObject({
      fileName: 'song.wav',
      sampleRate: 44_100,
      duration: 2 / 44_100,
      channels: 2,
    });
    expect(decoded.left).toEqual(sourceLeft);
    expect(decoded.right).toEqual(sourceRight);
    expect(decoded.left).not.toBe(sourceLeft);
    expect(decoded.right).not.toBe(sourceRight);
  });

  it('duplicates mono input into the right channel for stereo downstream code', async () => {
    const mono = new Float32Array([0.3, -0.4]);
    const context = {
      decodeAudioData: vi.fn(async () => audioBuffer([mono])),
    } as unknown as AudioContext;
    const file = new File(['audio'], 'mono.wav');
    Object.defineProperty(file, 'arrayBuffer', {
      configurable: true,
      value: vi.fn(async () => new ArrayBuffer(4)),
    });

    const decoded = await decodeAudioFile(file, context);

    expect(decoded.channels).toBe(1);
    expect(decoded.left).toEqual(mono);
    expect(decoded.right).toEqual(mono);
    expect(decoded.right).not.toBe(mono);
  });

  it('rejects encoded files over budget before allocating an ArrayBuffer', async () => {
    const context = { decodeAudioData: vi.fn() } as unknown as AudioContext;
    const file = new File(['oversized'], 'large.wav');
    const arrayBuffer = vi.fn(async () => new ArrayBuffer(4));
    Object.defineProperties(file, {
      size: { configurable: true, value: 1024 },
      arrayBuffer: { configurable: true, value: arrayBuffer },
    });

    await expect(decodeAudioFile(file, context, { maxFileBytes: 100 })).rejects.toMatchObject({
      code: 'file-size',
    });
    expect(arrayBuffer).not.toHaveBeenCalled();
  });

  it('rejects decoded duration, frame, and channel budgets before copying PCM', async () => {
    const file = new File(['audio'], 'large-pcm.wav');
    Object.defineProperty(file, 'arrayBuffer', {
      configurable: true,
      value: vi.fn(async () => new ArrayBuffer(4)),
    });
    const tooLong = audioBuffer([new Float32Array(100)], 10);
    const context = {
      decodeAudioData: vi.fn(async () => tooLong),
    } as unknown as AudioContext;

    await expect(decodeAudioFile(file, context, { maxDurationSeconds: 5 })).rejects.toBeInstanceOf(
      AudioInputBudgetError,
    );
    await expect(decodeAudioFile(file, context, { maxFrames: 50 })).rejects.toMatchObject({
      code: 'frames',
    });

    const manyChannels = audioBuffer(Array.from({ length: 4 }, () => new Float32Array(2)));
    (context.decodeAudioData as ReturnType<typeof vi.fn>).mockResolvedValue(manyChannels);
    await expect(decodeAudioFile(file, context, { maxChannels: 2 })).rejects.toMatchObject({
      code: 'channels',
    });
  });
});

describe('amplitudeToDb', () => {
  it('maps unity amplitude to 0 dB', () => {
    expect(amplitudeToDb(1)).toBeCloseTo(0, 6);
  });
  it('maps half amplitude to ~-6.02 dB', () => {
    expect(amplitudeToDb(0.5)).toBeCloseTo(-6.0206, 3);
  });
  it('floors non-positive amplitude at -120 dB', () => {
    expect(amplitudeToDb(0)).toBe(-120);
    expect(amplitudeToDb(-0.5)).toBe(-120);
  });
});

describe('mixToMono', () => {
  it('averages the two channels sample-by-sample', () => {
    const left = new Float32Array([1, 0, -1, 0.5]);
    const right = new Float32Array([1, 1, 1, -0.5]);
    const mono = mixToMono(left, right);
    expect(Array.from(mono)).toEqual([1, 0.5, 0, 0]);
  });
  it('clamps to the shorter channel length', () => {
    expect(mixToMono(new Float32Array([1, 1, 1]), new Float32Array([1])).length).toBe(1);
  });
});

describe('calculatePeakRms', () => {
  it('reports 0 dB peak for a full-scale signal', () => {
    const sig = new Float32Array([1, -1, 1, -1]);
    const { peakDb, rmsDb } = calculatePeakRms(sig, sig);
    expect(peakDb).toBeCloseTo(0, 6);
    expect(rmsDb).toBeCloseTo(0, 6);
  });
  it('reports lower RMS than peak for a sparse signal', () => {
    const left = new Float32Array([1, 0, 0, 0]);
    const { peakDb, rmsDb } = calculatePeakRms(left, left);
    expect(peakDb).toBeCloseTo(0, 6);
    expect(rmsDb).toBeLessThan(peakDb);
  });
});

describe('calculateCorrelation', () => {
  it('returns +1 for identical channels', () => {
    const sig = new Float32Array([0.2, -0.4, 0.6, -0.1]);
    expect(calculateCorrelation(sig, sig)).toBeCloseTo(1, 6);
  });
  it('returns -1 for inverted channels', () => {
    const left = new Float32Array([0.2, -0.4, 0.6, -0.1]);
    const right = left.map((v) => -v);
    expect(calculateCorrelation(left, right)).toBeCloseTo(-1, 6);
  });
  it('returns 0 for a silent channel', () => {
    expect(calculateCorrelation(new Float32Array([0, 0, 0]), new Float32Array([1, 1, 1]))).toBe(0);
  });
});

describe('downsampleWaveform', () => {
  it('returns at most targetPoints peaks', () => {
    const n = 10_000;
    const left = new Float32Array(n).map((_, i) => Math.sin(i / 50));
    const peaks = downsampleWaveform(left, left, 200);
    expect(peaks.length).toBeLessThanOrEqual(200);
    expect(peaks.length).toBeGreaterThan(0);
  });
  it('returns empty for empty input', () => {
    expect(downsampleWaveform(new Float32Array(0), new Float32Array(0))).toEqual([]);
  });
  it('tracks min<=max within each peak', () => {
    const left = new Float32Array([1, -1, 0.5, -0.5, 0.25, -0.25]);
    const peaks = downsampleWaveform(left, left, 2);
    for (const p of peaks) expect(p.min).toBeLessThanOrEqual(p.max);
  });
  it('uses the shorter channel and folds remaining samples into the final block', () => {
    const peaks = downsampleWaveform(
      new Float32Array([1, -1, 0.5, -0.5, 0.25]),
      new Float32Array([1, -1, 0.5]),
      2,
    );

    expect(peaks).toHaveLength(2);
    expect(peaks[0]).toMatchObject({ min: 1, max: 1, rms: 1 });
    expect(peaks[1].min).toBe(-1);
    expect(peaks[1].max).toBe(0.5);
    expect(peaks[1].rms).toBeCloseTo(Math.sqrt((1 + 0.25) / 2), 6);
  });
});

describe('formatters', () => {
  it('formatDuration zero-pads seconds', () => {
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(Infinity)).toBe('--:--');
  });
  it('formatSampleRate uses kHz', () => {
    expect(formatSampleRate(48000)).toBe('48 kHz');
    expect(formatSampleRate(44100)).toBe('44.1 kHz');
    expect(formatSampleRate(0)).toBe('-');
  });
  it('formatDb appends unit and guards non-finite', () => {
    expect(formatDb(-6.02)).toBe('-6.0 dB');
    expect(formatDb(NaN)).toBe('-');
  });
});

describe('encodeWavStereo', () => {
  it('writes a valid 44-byte RIFF/WAVE header', () => {
    const left = new Float32Array([0, 0.5, -0.5]);
    const buffer = encodeWavStereo(left, left, 48000);
    const view = new DataView(buffer);
    const tag = (off: number) =>
      String.fromCharCode(
        view.getUint8(off),
        view.getUint8(off + 1),
        view.getUint8(off + 2),
        view.getUint8(off + 3),
      );
    expect(tag(0)).toBe('RIFF');
    expect(tag(8)).toBe('WAVE');
    expect(tag(12)).toBe('fmt ');
    expect(tag(36)).toBe('data');
    expect(view.getUint16(22, true)).toBe(2); // stereo
    expect(view.getUint32(24, true)).toBe(48000); // sample rate
    expect(buffer.byteLength).toBe(44 + 3 * 4); // 3 frames * 2ch * 2 bytes
  });
  it('clips samples to signed 16-bit PCM and uses the shorter channel length', () => {
    const buffer = encodeWavStereo(
      new Float32Array([-2, -1, 0, 1, 2]),
      new Float32Array([2, 1, 0]),
      44_100,
    );
    const view = new DataView(buffer);

    expect(buffer.byteLength).toBe(44 + 3 * 4);
    expect(view.getInt16(44, true)).toBe(-32768);
    expect(view.getInt16(46, true)).toBe(32767);
    expect(view.getInt16(48, true)).toBe(-32768);
    expect(view.getInt16(50, true)).toBe(32767);
    expect(view.getInt16(52, true)).toBe(0);
    expect(view.getInt16(54, true)).toBe(0);
  });
});

describe('downloadJson', () => {
  it('creates a JSON blob URL, configures an anchor and returns the URL', () => {
    const originalCreateElement = document.createElement.bind(document);
    const anchor = {
      href: '',
      download: '',
      click: vi.fn(),
    } as unknown as HTMLAnchorElement;
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'a') return anchor;
      return originalCreateElement(tagName);
    });
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:json');

    expect(downloadJson('report.json', { ok: true, value: 2 })).toBe('blob:json');
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(anchor.href).toBe('blob:json');
    expect(anchor.download).toBe('report.json');
    expect(anchor.click).toHaveBeenCalled();
  });
});
