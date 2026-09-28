import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const wasmMock = vi.hoisted(() => ({
  init: vi.fn(async () => undefined),
  resample: vi.fn((samples: Float32Array, srcSr: number, targetSr: number) => {
    const outputLength = Math.max(1, Math.round(samples.length * (targetSr / srcSr)));
    const output = new Float32Array(outputLength);
    for (let i = 0; i < output.length; i++) {
      output[i] = samples[Math.min(Math.floor(i * (srcSr / targetSr)), samples.length - 1)] ?? 0;
    }
    return output;
  }),
  lufsInterleaved: vi.fn(),
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
  masteringPairAnalyze: vi.fn(() => '{"bands":[]}'),
  masteringStereoAnalyze: vi.fn(() => '{"correlation":0,"width":1,"likelyMonoCompatible":true}'),
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
    await import('@/demos/mastering/mastering.worker.ts');
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
        referenceSampleRate: 44_100,
        targetLufs: -14,
        ceilingDb: -1,
        lookaheadMs: 4,
      },
    });

    expect(wasmMock.masteringPairProcess).toHaveBeenCalledTimes(2);
    expect(wasmMock.resample).not.toHaveBeenCalled();
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

  it('resamples both reference channels in the worker at the source rate', async () => {
    await (self as any).onmessage({
      data: {
        type: 'referenceMatch',
        id: 12,
        left: new Float32Array([0.1, 0.2, 0.3, 0.4]),
        right: new Float32Array([0.4, 0.3, 0.2, 0.1]),
        referenceLeft: new Float32Array([7, 8, 9, 10]),
        referenceRight: new Float32Array([10, 9, 8, 7]),
        sampleRate: 16_000,
        referenceSampleRate: 48_000,
        targetLufs: -14,
        ceilingDb: -1,
        lookaheadMs: 4,
      },
    });

    expect(wasmMock.resample).toHaveBeenNthCalledWith(
      1,
      new Float32Array([7, 8, 9, 10]),
      48_000,
      16_000,
    );
    expect(wasmMock.resample).toHaveBeenNthCalledWith(
      2,
      new Float32Array([10, 9, 8, 7]),
      48_000,
      16_000,
    );
    expect(wasmMock.masteringPairProcess.mock.calls[0][2]).toEqual(new Float32Array([7]));
    expect(wasmMock.masteringPairProcess.mock.calls[1][2]).toEqual(new Float32Array([10]));
  });

  it('keeps reference analysis at the source rate after stereo resampling', async () => {
    wasmMock.lufsInterleaved
      .mockReturnValueOnce({ integratedLufs: -18 })
      .mockReturnValueOnce({ integratedLufs: -12 });

    await (self as any).onmessage({
      data: {
        type: 'referenceAnalyze',
        id: 14,
        sourceLeft: new Float32Array([0.1, 0.2, 0.3, 0.4]),
        sourceRight: new Float32Array([0.4, 0.3, 0.2, 0.1]),
        referenceLeft: new Float32Array([1, 2]),
        referenceRight: new Float32Array([2, 1]),
        sampleRate: 48_000,
        referenceSampleRate: 24_000,
      },
    });

    expect(wasmMock.resample).toHaveBeenNthCalledWith(1, new Float32Array([1, 2]), 24_000, 48_000);
    expect(wasmMock.resample).toHaveBeenNthCalledWith(2, new Float32Array([2, 1]), 24_000, 48_000);
    expect(wasmMock.lufsInterleaved).toHaveBeenNthCalledWith(
      1,
      expect.any(Float32Array),
      2,
      48_000,
    );
    expect(wasmMock.lufsInterleaved).toHaveBeenNthCalledWith(
      2,
      expect.any(Float32Array),
      2,
      48_000,
    );
    expect(wasmMock.masteringPairAnalyze.mock.calls[0][0]).toBe('match.tonalBalance');
    expect(wasmMock.masteringPairAnalyze.mock.calls[0][3]).toBe(48_000);
    expect(wasmMock.masteringStereoAnalyze.mock.calls[0][3]).toBe(48_000);
  });

  it('reports stereo loudness delta for anti-phase reference material', async () => {
    wasmMock.lufsInterleaved
      .mockReturnValueOnce({ integratedLufs: -18 })
      .mockReturnValueOnce({ integratedLufs: -12 });

    const sourceLeft = new Float32Array([1, -1, 1, -1]);
    const sourceRight = new Float32Array([-1, 1, -1, 1]);
    const referenceLeft = new Float32Array([0.5, 0, 0.5, 0]);
    const referenceRight = new Float32Array([0, 0.5, 0, 0.5]);

    await (self as any).onmessage({
      data: {
        type: 'referenceAnalyze',
        id: 13,
        sourceLeft,
        sourceRight,
        referenceLeft,
        referenceRight,
        sampleRate: 48_000,
        referenceSampleRate: 48_000,
      },
    });

    expect(wasmMock.lufsInterleaved).toHaveBeenNthCalledWith(
      1,
      new Float32Array([1, -1, -1, 1, 1, -1, -1, 1]),
      2,
      48_000,
    );
    expect(wasmMock.lufsInterleaved).toHaveBeenNthCalledWith(
      2,
      new Float32Array([0.5, 0, 0, 0.5, 0.5, 0, 0, 0.5]),
      2,
      48_000,
    );
    expect(wasmMock.resample).not.toHaveBeenCalled();
    expect(wasmMock.masteringPairAnalyze).toHaveBeenCalledWith(
      'match.tonalBalance',
      expect.any(Float32Array),
      expect.any(Float32Array),
      48_000,
    );
    const tonalCall = wasmMock.masteringPairAnalyze.mock.calls.find(
      (call) => call[0] === 'match.tonalBalance',
    );
    expect(tonalCall?.[1]).toEqual(sourceLeft);
    expect(Array.from(tonalCall?.[1] as Float32Array).some((sample) => sample !== 0)).toBe(true);
    // The reference pair is not severely cancelling, so its ordinary average
    // remains the tonal comparison signal.
    expect(tonalCall?.[2]).toEqual(new Float32Array([0.25, 0.25, 0.25, 0.25]));
    expect(wasmMock.masteringPairAnalyze).not.toHaveBeenCalledWith(
      'match.referenceLoudness',
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
    const result = (posted.at(-1)!.message as any).result;
    expect(result.loudness).toEqual({
      sourceLufs: -18,
      referenceLufs: -12,
      gainToMatchDb: 6,
    });
  });

  it.each([
    [-Infinity, -12],
    [-18, -Infinity],
    [-Infinity, -Infinity],
  ])('keeps the reference gain finite when LUFS is silent (%s, %s)', async (source, reference) => {
    wasmMock.lufsInterleaved
      .mockReturnValueOnce({ integratedLufs: source })
      .mockReturnValueOnce({ integratedLufs: reference });

    await (self as any).onmessage({
      data: {
        type: 'referenceAnalyze',
        id: 15,
        sourceLeft: new Float32Array([0, 0]),
        sourceRight: new Float32Array([0, 0]),
        referenceLeft: new Float32Array([0.2, 0.2]),
        referenceRight: new Float32Array([0.2, 0.2]),
        sampleRate: 48_000,
      },
    });

    const result = (posted.at(-1)!.message as any).result;
    expect(result.loudness).toEqual({
      sourceLufs: source,
      referenceLufs: reference,
      gainToMatchDb: 0,
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

  it('passes the selected assistant preset through the stereo request', async () => {
    const left = new Float32Array([0.2, -0.2]);
    const right = new Float32Array([0.1, 0.1]);

    await (self as any).onmessage({
      data: {
        type: 'sourceAnalyze',
        id: 23,
        left,
        right,
        sampleRate: 48_000,
        platforms: [{ name: 'Spotify', targetLufs: -14, ceilingDb: -1 }],
        preset: 'hipHop',
      },
    });

    expect(wasmMock.masteringAssistantSuggestStereo).toHaveBeenCalledWith({
      left,
      right,
      sampleRate: 48_000,
      params: { preset: 'hipHop' },
    });
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
