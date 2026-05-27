import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAudioAnalysis } from '@/composables/useAudioAnalysis';

const wasm = vi.hoisted(() => ({
  init: vi.fn(),
  version: vi.fn(() => 'test-wasm'),
  analyzeWithProgress: vi.fn(),
  detectBpm: vi.fn(),
  detectBeats: vi.fn(),
}));

vi.mock('@/wasm/index.js', () => wasm);

function makeAudioBuffer(channels: Float32Array[], sampleRate = 48000): AudioBuffer {
  return {
    numberOfChannels: channels.length,
    length: channels[0]?.length ?? 0,
    duration: (channels[0]?.length ?? 0) / sampleRate,
    sampleRate,
    getChannelData: (channel: number) => channels[channel],
  } as unknown as AudioBuffer;
}

const analysisResult = {
  bpm: 122,
  bpmConfidence: 0.9,
  key: { root: 0, mode: 1, confidence: 0.8, name: 'C major', shortName: 'C' },
  beats: [{ time: 0, strength: 1 }],
  chords: [],
  sections: [],
  timbre: { brightness: 0.5, warmth: 0.4, density: 0.3, roughness: 0.2, complexity: 0.1 },
  dynamics: { dynamicRangeDb: 8, loudnessRangeDb: 5, crestFactor: 3, isCompressed: false },
  timeSignature: { numerator: 4, denominator: 4, confidence: 0.7 },
  rhythm: { syncopation: 0.2, grooveType: 'straight', patternRegularity: 0.9 },
  form: 'A',
};

describe('useAudioAnalysis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    wasm.init.mockResolvedValue(undefined);
    wasm.version.mockReturnValue('test-wasm');
    wasm.analyzeWithProgress.mockImplementation((_samples, _sampleRate, onProgress) => {
      onProgress(0.25, 'FFT');
      onProgress(0.75, 'Music analysis');
      return analysisResult;
    });
    wasm.detectBpm.mockReturnValue(122);
    wasm.detectBeats.mockReturnValue(new Float32Array([0, 0.5, 1]));
  });

  it('initializes wasm once, exposes version and analyzes mono audio with progress state', async () => {
    const analysis = useAudioAnalysis();
    const buffer = makeAudioBuffer([new Float32Array([0, 1, -1, 0.5])]);

    await analysis.initWasm();
    await analysis.initWasm();
    expect(wasm.init).toHaveBeenCalledTimes(1);
    expect(analysis.isInitialized.value).toBe(true);
    expect(analysis.getVersion()).toBe('test-wasm');

    const result = await analysis.analyze(buffer);
    expect(result).toBe(analysisResult);
    expect(analysis.result.value).toBe(analysisResult);
    expect(analysis.isAnalyzing.value).toBe(false);
    expect(analysis.progress.value).toBe(1);
    expect(analysis.progressStage.value).toBe('Complete');
    expect(wasm.analyzeWithProgress).toHaveBeenCalledWith(
      buffer.getChannelData(0),
      48000,
      expect.any(Function),
    );
  });

  it('mixes multi-channel buffers before calling wasm feature helpers', async () => {
    const analysis = useAudioAnalysis();
    const buffer = makeAudioBuffer(
      [new Float32Array([1, -1, 0.5]), new Float32Array([-1, 1, 0.25])],
      44100,
    );

    await expect(analysis.detectBpm(buffer)).resolves.toBe(122);
    expect(wasm.detectBpm).toHaveBeenCalledWith(new Float32Array([0, 0, 0.375]), 44100);

    await expect(analysis.detectBeats(buffer)).resolves.toEqual(new Float32Array([0, 0.5, 1]));
    expect(wasm.detectBeats).toHaveBeenCalledWith(new Float32Array([0, 0, 0.375]), 44100);
  });

  it('records initialization and analysis failures', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const initError = new Error('init failed');
      wasm.init.mockRejectedValueOnce(initError);

      const failedInit = useAudioAnalysis();
      await expect(failedInit.initWasm()).rejects.toThrow('init failed');
      expect(failedInit.error.value).toBe('Failed to initialize audio analysis module');

      wasm.init.mockResolvedValue(undefined);
      wasm.analyzeWithProgress.mockImplementationOnce(() => {
        throw new Error('analysis failed');
      });

      const failedAnalysis = useAudioAnalysis();
      await expect(
        failedAnalysis.analyze(makeAudioBuffer([new Float32Array([1])])),
      ).rejects.toThrow('analysis failed');
      expect(failedAnalysis.error.value).toBe('Analysis failed');
      expect(failedAnalysis.isAnalyzing.value).toBe(false);
      expect(failedAnalysis.progress.value).toBe(1);
      expect(failedAnalysis.progressStage.value).toBe('Complete');
    } finally {
      consoleError.mockRestore();
    }
  });
});
