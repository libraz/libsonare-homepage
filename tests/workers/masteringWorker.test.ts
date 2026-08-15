import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const wasmMock = vi.hoisted(() => ({
  init: vi.fn(async () => undefined),
  masteringChainStereoWithProgress: vi.fn(
    (
      left: Float32Array,
      right: Float32Array,
      sampleRate: number,
      _config: unknown,
      onProgress: (progress: number, stage: string) => void,
    ) => {
      onProgress(0.5, 'halfway');
      return {
        left,
        right,
        sampleRate,
        inputLufs: -18,
        outputLufs: -14,
        appliedGainDb: 4,
        stages: ['eq.tilt'],
        latencySamples: 32,
      };
    },
  ),
  masteringPairProcess: vi.fn(
    (
      _processorName: string,
      source: Float32Array,
      _reference: Float32Array,
      sampleRate: number,
    ) => ({
      samples: new Float32Array(source),
      sampleRate,
      inputLufs: -20,
      outputLufs: -15,
      appliedGainDb: 0,
    }),
  ),
  // The stereo entry points measure the pair itself, so the `loudness` block
  // already reports the delivered programme (6 dB above its own downmix here).
  masteringAudioProfileStereo: vi.fn(
    () =>
      '{"durationSec":8,"loudness":{"crestFactorDb":9.4,"integratedLufs":-11.07,"lraLu":4.5,"truePeakDb":-0.6}}',
  ),
  masteringAssistantSuggestStereo: vi.fn(() => '{"explanation":["Trim low end"]}'),
  masteringStreamingPreviewStereo: vi.fn(
    (request: { platforms: Array<{ name: string; targetLufs: number; ceilingDb: number }> }) =>
      JSON.stringify({
        platforms: request.platforms.map((platform) => {
          const normalizationGainDb = platform.targetLufs - -11.07;
          return {
            name: platform.name,
            integratedLufs: -11.07,
            truePeakDb: -0.6,
            normalizationGainDb,
            ceilingRisk: -0.6 + normalizationGainDb > platform.ceilingDb,
          };
        }),
      }),
  ),
}));

vi.mock('@/wasm/index.js', () => wasmMock);

describe('mastering worker protocol', () => {
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
    await import('@/workers/mastering.worker.ts');
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'self', {
      configurable: true,
      value: originalSelf,
    });
  });

  it('renders stereo mastering chains with progress and transferable output buffers', async () => {
    const left = new Float32Array([0.1, 0.2]);
    const right = new Float32Array([0.2, 0.1]);

    await (self as any).onmessage({
      data: {
        type: 'render',
        id: 1,
        left,
        right,
        sampleRate: 48_000,
        config: { eq: { tiltDb: 1 } },
      },
    });

    expect(wasmMock.init).toHaveBeenCalledTimes(1);
    expect(wasmMock.masteringChainStereoWithProgress).toHaveBeenCalledWith(
      left,
      right,
      48_000,
      { eq: { tiltDb: 1 } },
      expect.any(Function),
    );
    expect(posted.map((entry) => (entry.message as any).type)).toEqual([
      'progress',
      'progress',
      'progress',
      'progress',
      'progress',
      'done',
    ]);
    expect(posted[2].message).toMatchObject({
      type: 'progress',
      id: 1,
      progress: 0.24,
      stage: 'Running mastering chain',
    });
    expect(posted[3].message).toMatchObject({
      type: 'progress',
      id: 1,
      progress: 0.59,
      stage: 'halfway',
    });
    const done = posted.at(-1)!;
    expect(done.message).toMatchObject({
      type: 'done',
      id: 1,
      result: {
        sampleRate: 48_000,
        inputLufs: -18,
        outputLufs: -14,
        stages: ['eq.tilt'],
      },
    });
    expect(done.transfer).toEqual([left.buffer, right.buffer]);
  });

  it('attenuates rendered output that exceeds the requested ceiling', async () => {
    wasmMock.masteringChainStereoWithProgress.mockReturnValueOnce({
      left: new Float32Array([1.4, -0.5]),
      right: new Float32Array([0.25, -1.2]),
      sampleRate: 48_000,
      inputLufs: -18,
      outputLufs: -10,
      appliedGainDb: 8,
      stages: ['maximizer.truePeakLimiter'],
      latencySamples: 32,
    });

    await (self as any).onmessage({
      data: {
        type: 'render',
        id: 11,
        left: new Float32Array([0.1, 0.2]),
        right: new Float32Array([0.2, 0.1]),
        sampleRate: 48_000,
        config: { loudness: { targetLufs: -14, ceilingDb: -1, truePeakOversample: 4 } },
      },
    });

    const result = (posted.at(-1)!.message as any).result;
    const peak = Math.max(
      ...Array.from(result.left, Math.abs),
      ...Array.from(result.right, Math.abs),
    );
    expect(peak).toBeLessThanOrEqual(10 ** (-1 / 20) + 1e-6);
    expect(result.outputLufs).toBeLessThan(-10);
    expect(result.appliedGainDb).toBeLessThan(8);
  });

  it('renders reference matching without truncating sources and normalizes the matched output', async () => {
    await (self as any).onmessage({
      data: {
        type: 'referenceMatch',
        id: 2,
        left: new Float32Array([0.1, 0.2, 0.3]),
        right: new Float32Array([0.4, 0.5, 0.6]),
        referenceLeft: new Float32Array([7, 8]),
        referenceRight: new Float32Array([9, 10, 11, 12]),
        sampleRate: 44_100,
        targetLufs: -14,
        ceilingDb: -1,
        lookaheadMs: 4,
      },
    });

    expect(wasmMock.masteringPairProcess).toHaveBeenCalledTimes(2);
    expect(wasmMock.masteringPairProcess.mock.calls[0]).toEqual([
      'match.applyMatchEq',
      new Float32Array([0.1, 0.2, 0.3]),
      new Float32Array([7, 8]),
      44_100,
      { maxGainDb: 6, smoothingBins: 5 },
    ]);
    expect(wasmMock.masteringPairProcess.mock.calls[1][1]).toEqual(
      new Float32Array([0.4, 0.5, 0.6]),
    );
    expect(wasmMock.masteringChainStereoWithProgress).toHaveBeenCalledWith(
      new Float32Array([0.1, 0.2, 0.3]),
      new Float32Array([0.4, 0.5, 0.6]),
      44_100,
      {
        maximizer: {
          truePeakLimiter: {
            ceilingDb: -1,
            lookaheadMs: 4,
            oversampleFactor: 4,
            applyGainAtInputRate: true,
          },
        },
        loudness: {
          targetLufs: -14,
          ceilingDb: -1,
          truePeakOversample: 4,
        },
      },
      expect.any(Function),
    );
    expect(posted.at(-1)?.message).toMatchObject({
      type: 'done',
      id: 2,
      result: {
        inputLufs: -18,
        outputLufs: -14,
        appliedGainDb: 4,
        stages: ['match.applyMatchEq', 'eq.tilt'],
      },
    });
  });

  it('measures source loudness on the stereo pair, not on the mono downmix', async () => {
    const left = new Float32Array([0.2, -0.2]);
    const right = new Float32Array([0.1, 0.1]);
    const stereoRequest = { left, right, sampleRate: 48_000 };

    await (self as any).onmessage({
      data: {
        type: 'sourceAnalyze',
        id: 21,
        left,
        right,
        sampleRate: 48_000,
        platforms: [
          { name: 'Spotify', targetLufs: -14, ceilingDb: -1 },
          { name: 'Apple Music', targetLufs: -16, ceilingDb: -1 },
        ],
      },
    });

    // Every assistant entry point receives the two channels, never a downmix —
    // the worker must not reintroduce a mono-only path here.
    expect(wasmMock.masteringAudioProfileStereo).toHaveBeenCalledWith(stereoRequest);
    expect(wasmMock.masteringAssistantSuggestStereo).toHaveBeenCalledWith(stereoRequest);
    expect(wasmMock.masteringStreamingPreviewStereo).toHaveBeenCalledWith({
      ...stereoRequest,
      platforms: [
        { name: 'Spotify', targetLufs: -14, ceilingDb: -1 },
        { name: 'Apple Music', targetLufs: -16, ceilingDb: -1 },
      ],
    });

    const result = (posted.at(-1)!.message as any).result;
    // The profile's loudness block is the stereo measurement, so the panel reads
    // the delivered programme rather than a downmix ~6 dB below it.
    expect(result.profile.loudness).toEqual({
      crestFactorDb: 9.4,
      integratedLufs: -11.07,
      lraLu: 4.5,
      truePeakDb: -0.6,
    });
    // gain = target - stereo integrated; risk = normalized true peak over ceiling.
    expect(result.streamingPreview.platforms).toEqual([
      {
        name: 'Spotify',
        targetLufs: -14,
        ceilingDb: -1,
        integratedLufs: -11.07,
        truePeakDb: -0.6,
        normalizationGainDb: expect.closeTo(-2.93, 6),
        ceilingRisk: false,
      },
      {
        name: 'Apple Music',
        targetLufs: -16,
        ceilingDb: -1,
        integratedLufs: -11.07,
        truePeakDb: -0.6,
        normalizationGainDb: expect.closeTo(-4.93, 6),
        ceilingRisk: false,
      },
    ]);
  });

  it('flags ceiling risk when the platform gain pushes the stereo true peak over the ceiling', async () => {
    // A quiet programme takes a large positive normalization gain, which lifts
    // the stereo true peak past the platform ceiling.
    wasmMock.masteringStreamingPreviewStereo.mockReturnValueOnce(
      JSON.stringify({
        platforms: [
          {
            name: 'Spotify',
            integratedLufs: -20,
            truePeakDb: -0.6,
            normalizationGainDb: 6,
            ceilingRisk: true,
          },
        ],
      }),
    );

    await (self as any).onmessage({
      data: {
        type: 'sourceAnalyze',
        id: 22,
        left: new Float32Array([0.2, -0.2]),
        right: new Float32Array([0.1, 0.1]),
        sampleRate: 48_000,
        platforms: [{ name: 'Spotify', targetLufs: -14, ceilingDb: -1 }],
      },
    });

    const result = (posted.at(-1)!.message as any).result;
    expect(result.streamingPreview.platforms[0]).toMatchObject({
      normalizationGainDb: 6,
      ceilingRisk: true,
    });
  });

  it('posts recoverable error messages when wasm rendering fails', async () => {
    wasmMock.masteringChainStereoWithProgress.mockImplementationOnce(() => {
      throw new Error('render failed');
    });

    await (self as any).onmessage({
      data: {
        type: 'render',
        id: 3,
        left: new Float32Array([0]),
        right: new Float32Array([0]),
        sampleRate: 48_000,
        config: {},
      },
    });

    expect(posted.at(-1)?.message).toEqual({
      type: 'error',
      id: 3,
      error: 'render failed',
    });
  });
});
