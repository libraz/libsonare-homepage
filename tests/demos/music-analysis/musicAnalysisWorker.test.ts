import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const wasmMock = vi.hoisted(() => ({
  init: vi.fn(async () => undefined),
  version: vi.fn(() => '1.2.3-test'),
  resample: vi.fn((samples: Float32Array, sourceRate: number, targetRate: number) => {
    const targetLength = Math.max(1, Math.round((samples.length / sourceRate) * targetRate));
    return new Float32Array(targetLength);
  }),
  analyzeWithProgress: vi.fn(
    (
      _samples: Float32Array,
      _sampleRate: number,
      onProgress: (progress: number, stage: string) => void,
    ) => {
      onProgress(0.5, 'analysis half');
      return {
        bpm: 123,
        bpmConfidence: 0.8,
        key: { name: 'A minor', confidence: 0.7 },
        timeSignature: { numerator: 3, denominator: 4 },
        beatTimes: new Float32Array([0, 0.5, 1]),
        chords: [{ name: 'Am', start: 0, end: 1, confidence: 0.9 }],
        dynamics: { dynamicRangeDb: 8, crestFactor: 10 },
        timbre: { brightness: 0.4, warmth: 0.6 },
      };
    },
  ),
  detectKeyCandidates: vi.fn(() => [
    { key: { name: 'A minor', confidence: 0.7 }, correlation: 0.9 },
    { key: { name: 'C major', confidence: 0.5 }, correlation: 0.6 },
  ]),
  detectDownbeats: vi.fn(() => new Float32Array([0, 2])),
  analyzeSections: vi.fn(() => [
    { name: 'Intro', start: 0, end: 1, confidence: 0.8, energyLevel: 0.4 },
  ]),
  analyzeMelody: vi.fn(() => ({
    pitchRangeOctaves: 1.2,
    pitchStability: 0.8,
    meanFrequency: 440,
    vibratoRate: 5,
    points: [
      { time: 0, frequency: 0, confidence: 1 },
      { time: 0.1, frequency: 440, confidence: 0.9 },
      { time: 0.2, frequency: 441, confidence: 0.1 },
    ],
  })),
  lufs: vi.fn(() => ({
    integratedLufs: -14,
    momentaryLufs: -15,
    shortTermLufs: -16,
    loudnessRange: 4,
  })),
  lufsInterleaved: vi.fn(() => ({
    integratedLufs: -12,
    momentaryLufs: -13,
    shortTermLufs: -14,
    loudnessRange: 5,
  })),
  lufsSeriesInterleaved: vi.fn(() => ({
    momentary: new Float32Array([-17, -12]),
    shortTerm: new Float32Array([-15]),
  })),
  momentaryLufs: vi.fn(() => new Float32Array([Number.NaN, -15, -13, -14])),
  shortTermLufs: vi.fn(() => new Float32Array([-16, -15])),
  chroma: vi.fn(() => ({
    nChroma: 12,
    nFrames: 2,
    sampleRate: 48_000,
    hopLength: 1024,
    features: new Float32Array(24).fill(0.5),
    meanEnergy: [],
  })),
  melSpectrogram: vi.fn(() => ({
    nMels: 96,
    nFrames: 2,
    sampleRate: 48_000,
    hopLength: 1024,
    power: new Float32Array(192).fill(1),
    db: new Float32Array(192).fill(-20),
  })),
  cqt: vi.fn(() => ({
    nBins: 72,
    nFrames: 2,
    hopLength: 1024,
    sampleRate: 48_000,
    magnitude: new Float32Array(144).fill(0.25),
    frequencies: new Float32Array(72),
  })),
  meteringTruePeakDb: vi.fn(() => -1.2),
  meteringDcOffset: vi.fn(() => 0.001),
  meteringDetectClipping: vi.fn(() => ({
    clippedSamples: 0,
    clippingRatio: 0,
    maxClippedPeak: 0,
    regions: [],
  })),
  meteringStereoWidth: vi.fn(() => 0.6),
  meteringStereoCorrelation: vi.fn(() => 0.8),
  meteringVectorscope: vi.fn(() => ({
    mid: new Float32Array([0.5, 0.4, 0.3]),
    side: new Float32Array([0.1, 0.2, 0.1]),
  })),
}));

vi.mock('@/wasm/index.js', () => wasmMock);

describe('music analysis worker protocol', () => {
  let originalSelf: typeof globalThis.self;
  let posted: Array<{ message: unknown; transfer?: Transferable[] }>;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    posted = [];
    originalSelf = globalThis.self;
    Object.defineProperty(globalThis, 'self', {
      configurable: true,
      value: {
        postMessage: vi.fn((message: unknown, transfer?: Transferable[]) => {
          posted.push({ message, transfer });
        }),
      },
    });
    await import('@/demos/music-analysis/music-analysis.worker.ts');
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'self', {
      configurable: true,
      value: originalSelf,
    });
  });

  it('analyzes audio and serializes report, heatmaps and loudness series', async () => {
    const samples = new Float32Array(48_000);

    await (self as any).onmessage({
      data: {
        type: 'analyze',
        id: 1,
        samples,
        sampleRate: 48_000,
      },
    });

    expect(wasmMock.init).toHaveBeenCalledTimes(1);
    expect(wasmMock.resample).not.toHaveBeenCalled();
    expect(wasmMock.lufs).toHaveBeenCalledWith(samples, 48_000);
    expect(wasmMock.momentaryLufs).toHaveBeenCalledWith(samples, 48_000);
    expect(wasmMock.shortTermLufs).toHaveBeenCalledWith(samples, 48_000);
    expect(wasmMock.lufsSeriesInterleaved).not.toHaveBeenCalled();
    expect(wasmMock.detectKeyCandidates).toHaveBeenCalledWith(samples, 48_000, {
      useHpss: true,
      loudnessWeighted: true,
      modes: 'all',
    });
    expect(wasmMock.cqt).toHaveBeenCalledWith(samples, 48_000, 1024, undefined, 72, 12);

    const messageTypes = posted.map((entry) => (entry.message as any).type);
    expect(messageTypes[0]).toBe('progress');
    expect(messageTypes).toContain('done');

    const done = posted.at(-1)!;
    expect(done.message).toMatchObject({
      type: 'done',
      id: 1,
      result: {
        version: '1.2.3-test',
        duration: 1,
        sampleRate: 48_000,
        summary: {
          bpm: 123,
          bpmConfidence: 0.8,
          keyName: 'A minor',
          keyConfidence: 0.7,
          timeSignature: '3/4',
          integratedLufs: -14,
          loudnessRange: 4,
          dynamicRangeDb: 8,
          crestFactor: 10,
          brightness: 0.4,
          warmth: 0.6,
        },
        keyCandidates: [
          { name: 'A minor', confidence: 0.7, correlation: 0.9 },
          { name: 'C major', confidence: 0.5, correlation: 0.6 },
        ],
        sections: [{ name: 'Intro', start: 0, end: 1, confidence: 0.8, energyLevel: 0.4 }],
        chords: [{ name: 'Am', start: 0, end: 1, confidence: 0.9 }],
        beats: [0, 0.5, 1],
        downbeats: [0, 2],
        melody: {
          pitchRangeOctaves: 1.2,
          pitchStability: 0.8,
          meanFrequency: 440,
          vibratoRate: 5,
          points: [{ time: 0.1, frequency: 440, confidence: 0.9 }],
        },
      },
    });

    const result = (done.message as any).result;
    expect(result.heatmaps.chroma).toMatchObject({ rows: 12, columns: 2, min: 0.5, max: 0.5 });
    expect(result.heatmaps.mel).toMatchObject({ rows: 96, columns: 2, min: -20, max: -20 });
    expect(result.heatmaps.cqt).toMatchObject({ rows: 72, columns: 2, min: 0.25, max: 0.25 });
    expect(result.loudness.momentary.map((point: { time: number }) => point.time)).toHaveLength(4);
    for (const [index, expected] of [0.4, 0.5, 0.6, 0.7].entries()) {
      expect(result.loudness.momentary[index].time).toBeCloseTo(expected, 10);
    }
    expect(Number.isNaN(result.loudness.momentary[0].value)).toBe(true);
    expect(
      result.loudness.momentary.slice(1).map((point: { value: number }) => point.value),
    ).toEqual([-15, -13, -14]);
    expect(done.transfer).toEqual([
      result.heatmaps.chroma.values.buffer,
      result.heatmaps.mel.values.buffer,
      result.heatmaps.cqt.values.buffer,
    ]);
  });

  it('posts cancelled when a matching cancel arrives during analysis', async () => {
    wasmMock.analyzeWithProgress.mockImplementationOnce((_samples, _sampleRate, onProgress) => {
      onProgress(0.1, 'before cancel');
      void (self as any).onmessage({ data: { type: 'cancel', id: 2 } });
      return {
        bpm: 100,
        bpmConfidence: 0.5,
        key: { name: 'C major', confidence: 0.5 },
        timeSignature: { numerator: 4, denominator: 4 },
        beatTimes: new Float32Array(0),
        chords: [],
        dynamics: {},
        timbre: {},
      };
    });

    await (self as any).onmessage({
      data: {
        type: 'analyze',
        id: 2,
        samples: new Float32Array(128),
        sampleRate: 48_000,
      },
    });

    expect(posted.at(-1)?.message).toEqual({ type: 'cancelled', id: 2 });
  });

  it('downsamples long high-rate files before running expensive analysis stages', async () => {
    const sourceRate = 24_000;
    const samples = new Float32Array(sourceRate * 121);

    await (self as any).onmessage({
      data: {
        type: 'analyze',
        id: 4,
        samples,
        sampleRate: sourceRate,
      },
    });

    const analyzedSamples = wasmMock.analyzeWithProgress.mock.calls[0][0] as Float32Array;
    expect(wasmMock.resample).toHaveBeenCalledTimes(1);
    expect(wasmMock.resample.mock.calls[0][0]).toBe(samples);
    expect(wasmMock.resample.mock.calls[0][1]).toBe(sourceRate);
    expect(wasmMock.resample.mock.calls[0][2]).toBe(22_050);
    expect(analyzedSamples.length).toBe(22_050 * 121);
    expect(wasmMock.analyzeWithProgress).toHaveBeenCalledWith(
      analyzedSamples,
      22_050,
      expect.any(Function),
    );
    expect(wasmMock.chroma).toHaveBeenCalledWith(analyzedSamples, 22_050, 4096, 1024);

    const done = posted.at(-1)!.message as any;
    expect(done.result).toMatchObject({
      duration: 121,
      sampleRate: sourceRate,
      analysisSampleRate: 22_050,
    });
  }, 30_000);

  it('the shipped WASM resampler rejects content above the target Nyquist', async () => {
    const realSonare = await vi.importActual<typeof import('@/wasm/sonare.js')>('@/wasm/sonare.js');
    const realModule = await realSonare.default({
      locateFile: () => join(process.cwd(), 'src/wasm/sonare.wasm'),
      wasmBinary: readFileSync(join(process.cwd(), 'src/wasm/sonare.wasm')),
    });

    const sourceRate = 48_000;
    const analysisRate = 22_050;
    const durationSeconds = 2;
    const sampleCount = sourceRate * durationSeconds;
    const makeTone = (frequency: number) => {
      const samples = new Float32Array(sampleCount);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = 0.5 * Math.sin((2 * Math.PI * frequency * i) / sourceRate);
      }
      return samples;
    };
    const highTone = makeTone(16_000);
    const inBandTone = makeTone(8_000);

    const analyzed = [
      realModule.resample(highTone, sourceRate, analysisRate),
      realModule.resample(inBandTone, sourceRate, analysisRate),
    ];
    expect(analyzed[0]).toHaveLength(analysisRate * durationSeconds);
    expect(analyzed[1]).toHaveLength(analysisRate * durationSeconds);

    const rms = (samples: Float32Array) => {
      const start = Math.round(0.25 * analysisRate);
      const end = samples.length - start;
      let sumSquares = 0;
      for (let i = start; i < end; i++) sumSquares += samples[i] ** 2;
      return Math.sqrt(sumSquares / (end - start));
    };
    // 16 kHz is above the 11.025 kHz Nyquist limit after conversion and
    // must not fold into the analysis band. 8 kHz is an in-band control.
    expect(rms(analyzed[0])).toBeLessThan(0.01);
    expect(rms(analyzed[1])).toBeGreaterThan(0.2);
  }, 30_000);

  it('posts recoverable errors when analysis throws', async () => {
    wasmMock.analyzeWithProgress.mockImplementationOnce(() => {
      throw new Error('analysis failed');
    });

    await (self as any).onmessage({
      data: {
        type: 'analyze',
        id: 3,
        samples: new Float32Array(128),
        sampleRate: 48_000,
      },
    });

    expect(posted.at(-1)?.message).toEqual({
      type: 'error',
      id: 3,
      error: 'analysis failed',
      recoverable: true,
    });
  });

  it('posts recoverable errors when wasm initialization fails', async () => {
    wasmMock.init.mockRejectedValueOnce(new Error('init failed'));

    await (self as any).onmessage({
      data: {
        type: 'analyze',
        id: 5,
        samples: new Float32Array(128),
        sampleRate: 48_000,
      },
    });

    expect(posted.at(-1)?.message).toEqual({
      type: 'error',
      id: 5,
      error: 'init failed',
      recoverable: true,
    });
  });

  it('meters full-resolution stereo channels without destructive downmix cancellation', async () => {
    const left = new Float32Array([1, 0.5, 0, -0.25]);
    const right = new Float32Array([-1, -0.5, 0, 0.25]);
    wasmMock.meteringTruePeakDb.mockReturnValueOnce(-3).mockReturnValueOnce(-0.2);
    wasmMock.meteringDcOffset.mockReturnValueOnce(0.001).mockReturnValueOnce(-0.02);
    wasmMock.meteringDetectClipping
      .mockReturnValueOnce({
        clippedSamples: 1,
        clippingRatio: 0.25,
        maxClippedPeak: 1.01,
        regions: [{}],
      })
      .mockReturnValueOnce({
        clippedSamples: 2,
        clippingRatio: 0.5,
        maxClippedPeak: 1.08,
        regions: [{}, {}],
      });

    await (self as any).onmessage({
      data: { type: 'analyze', id: 7, sourceLeft: left, sourceRight: right, sampleRate: 48_000 },
    });

    const interleaved = wasmMock.lufsInterleaved.mock.calls.at(-1)?.[0] as Float32Array;
    expect(Array.from(interleaved)).toEqual([1, -1, 0.5, -0.5, 0, 0, -0.25, 0.25]);
    expect(wasmMock.lufsInterleaved).toHaveBeenCalledWith(interleaved, 2, 48_000);
    expect(wasmMock.lufsSeriesInterleaved).toHaveBeenCalledWith(interleaved, 2, 48_000);
    expect(wasmMock.lufsSeriesInterleaved.mock.calls.at(-1)?.[0]).toBe(interleaved);
    expect(wasmMock.momentaryLufs).not.toHaveBeenCalled();
    expect(wasmMock.shortTermLufs).not.toHaveBeenCalled();
    expect((posted.at(-1)!.message as any).result).toMatchObject({
      summary: { integratedLufs: -12, loudnessRange: 5 },
      metering: {
        truePeakDb: -0.2,
        dcOffset: -0.02,
        clipping: {
          clippedSamples: 3,
          clippingRatio: 0.375,
          maxClippedPeak: 1.08,
          regions: 3,
        },
        stereo: { available: true },
      },
    });
    const loudness = (posted.at(-1)!.message as any).result.loudness;
    expect(loudness.momentary.map((point: { value: number }) => point.value)).toEqual([-17, -12]);
    expect(loudness.shortTerm.map((point: { value: number }) => point.value)).toEqual([-15]);
  });

  it('anchors mono loudness blocks and keeps real bucket midpoints when downsampling', async () => {
    const sampleRate = 48_000;
    const samples = new Float32Array(sampleRate * 90);
    const momentary = Float32Array.from({ length: 840 }, (_, index) => index);
    const shortTerm = Float32Array.from({ length: 840 }, (_, index) => 1_000 + index);
    wasmMock.momentaryLufs.mockReturnValueOnce(momentary);
    wasmMock.shortTermLufs.mockReturnValueOnce(shortTerm);

    await (self as any).onmessage({
      data: { type: 'analyze', id: 8, samples, sampleRate },
    });

    const loudness = (posted.at(-1)!.message as any).result.loudness;
    expect(loudness.momentary).toHaveLength(420);
    expect(loudness.momentary[0]).toMatchObject({ time: 0.45, value: 0.5 });
    expect(loudness.momentary.at(-1)).toMatchObject({ value: 838.5 });
    expect(loudness.momentary.at(-1).time).toBeCloseTo(84.25, 10);
    expect(loudness.shortTerm[0]).toMatchObject({ time: 3.05, value: 1_000.5 });
    expect(loudness.shortTerm.at(-1)).toMatchObject({ value: 1_838.5 });
    expect(loudness.shortTerm.at(-1).time).toBeCloseTo(86.85, 10);
    expect(loudness.shortTerm[0].time - loudness.momentary[0].time).toBeCloseTo(2.6, 10);
  }, 30_000);

  it('anchors stereo loudness series at their complete-window origins', async () => {
    const sampleRate = 48_000;
    const left = new Float32Array(sampleRate * 5);
    const right = new Float32Array(sampleRate * 5);
    wasmMock.lufsSeriesInterleaved.mockReturnValueOnce({
      momentary: new Float32Array([10, 11, 12]),
      shortTerm: new Float32Array([20, 21, 22]),
    });

    await (self as any).onmessage({
      data: { type: 'analyze', id: 9, sourceLeft: left, sourceRight: right, sampleRate },
    });

    const loudness = (posted.at(-1)!.message as any).result.loudness;
    expect(loudness.momentary.map((point: { value: number }) => point.value)).toEqual([10, 11, 12]);
    expect(loudness.shortTerm.map((point: { value: number }) => point.value)).toEqual([20, 21, 22]);
    expect(loudness.momentary.map((point: { time: number }) => point.time)).toEqual([
      expect.closeTo(0.4, 10),
      expect.closeTo(0.5, 10),
      expect.closeTo(0.6, 10),
    ]);
    expect(loudness.shortTerm.map((point: { time: number }) => point.time)).toEqual([
      expect.closeTo(3, 10),
      expect.closeTo(3.1, 10),
      expect.closeTo(3.2, 10),
    ]);
    expect(loudness.shortTerm[0].time - loudness.momentary[0].time).toBeCloseTo(2.6, 10);
  });

  it('ignores unknown worker messages without posting responses', async () => {
    await (self as any).onmessage({
      data: {
        type: 'noop',
        id: 6,
      },
    });

    expect(posted).toEqual([]);
  });
});
