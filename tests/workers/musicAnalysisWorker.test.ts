import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const wasmMock = vi.hoisted(() => ({
  init: vi.fn(async () => undefined),
  version: vi.fn(() => '1.2.3-test'),
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
    await import('@/workers/music-analysis.worker.ts');
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
    expect(result.loudness.momentary).toEqual([
      { time: 0, value: Number.NaN },
      { time: 1 / 3, value: -15 },
      { time: 2 / 3, value: -13 },
      { time: 1, value: -14 },
    ]);
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
    const samples = new Float32Array(48_000 * 121);

    await (self as any).onmessage({
      data: {
        type: 'analyze',
        id: 4,
        samples,
        sampleRate: 48_000,
      },
    });

    const analyzedSamples = wasmMock.analyzeWithProgress.mock.calls[0][0] as Float32Array;
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
      sampleRate: 48_000,
      analysisSampleRate: 22_050,
    });
  }, 15_000);

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
