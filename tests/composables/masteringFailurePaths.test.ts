import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type DecodedMasteringAudio, useMastering } from '@/composables/useMastering';

const wasm = vi.hoisted(() => ({
  init: vi.fn(),
  lufs: vi.fn(),
  masteringAudioProfile: vi.fn(),
  masteringAssistantSuggest: vi.fn(),
  masteringStreamingPreview: vi.fn(),
}));

vi.mock('@/wasm/index.js', () => wasm);

function audioBuffer(channels: Float32Array[], sampleRate = 48_000): AudioBuffer {
  return {
    length: channels[0]?.length ?? 0,
    duration: (channels[0]?.length ?? 0) / sampleRate,
    sampleRate,
    numberOfChannels: channels.length,
    getChannelData: (channel: number) => channels[channel],
  } as AudioBuffer;
}

class MasteringAudioContextMock {
  static nextDecodeError: Error | null = null;
  static instances: MasteringAudioContextMock[] = [];
  sampleRate = 48_000;
  close = vi.fn();

  constructor() {
    MasteringAudioContextMock.instances.push(this);
  }

  async decodeAudioData(_buffer: ArrayBuffer) {
    if (MasteringAudioContextMock.nextDecodeError) {
      throw MasteringAudioContextMock.nextDecodeError;
    }
    return audioBuffer([new Float32Array([0.5, -0.5, 0.25])], this.sampleRate);
  }
}

type WorkerMessageListener = (event: MessageEvent) => void;
type WorkerErrorListener = (event: ErrorEvent) => void;

class ErrorWorkerMock {
  static messages: unknown[] = [];
  private messageListeners = new Set<WorkerMessageListener>();
  private errorListeners = new Set<WorkerErrorListener>();
  terminated = false;

  addEventListener(
    type: 'message' | 'error',
    listener: WorkerMessageListener | WorkerErrorListener,
  ) {
    if (type === 'message') this.messageListeners.add(listener as WorkerMessageListener);
    else this.errorListeners.add(listener as WorkerErrorListener);
  }

  removeEventListener(
    type: 'message' | 'error',
    listener: WorkerMessageListener | WorkerErrorListener,
  ) {
    if (type === 'message') this.messageListeners.delete(listener as WorkerMessageListener);
    else this.errorListeners.delete(listener as WorkerErrorListener);
  }

  postMessage(message: any) {
    ErrorWorkerMock.messages.push(message);
    for (const listener of this.messageListeners) {
      listener({
        data: { type: 'progress', id: message.id, progress: 0.4, stage: 'Halfway' },
      } as MessageEvent);
      listener({
        data: { type: 'error', id: message.id, error: 'worker render failed' },
      } as MessageEvent);
    }
  }

  terminate() {
    this.terminated = true;
  }
}

describe('useMastering failure paths and report parsing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    MasteringAudioContextMock.nextDecodeError = null;
    MasteringAudioContextMock.instances = [];
    ErrorWorkerMock.messages = [];
    vi.stubGlobal('AudioContext', MasteringAudioContextMock);
    vi.stubGlobal('Worker', ErrorWorkerMock);
    wasm.init.mockResolvedValue(undefined);
    wasm.lufs.mockReturnValue({ integratedLufs: -16.25 });
    wasm.masteringAudioProfile.mockReturnValue('{"duration":12}');
    wasm.masteringAssistantSuggest.mockReturnValue('not-json');
    wasm.masteringStreamingPreview.mockReturnValue('{"platforms":[{"name":"A"}]}');
  });

  it('loads mono files into dual-channel mastering audio and clears previous renders', async () => {
    const mastering = useMastering();
    mastering.rendered.value = {
      left: new Float32Array([0]),
      right: new Float32Array([0]),
      sampleRate: 48_000,
      inputLufs: -20,
      outputLufs: -14,
      appliedGainDb: 6,
      stages: [],
    };

    const file = new File(['audio'], 'mono.wav', { type: 'audio/wav' });
    Object.defineProperty(file, 'arrayBuffer', {
      configurable: true,
      value: vi.fn(async () => new ArrayBuffer(8)),
    });
    const decoded = await mastering.loadFile(file);

    expect(decoded).toMatchObject({
      fileName: 'mono.wav',
      channels: 1,
      sampleRate: 48_000,
    });
    expect(decoded.left).toEqual(new Float32Array([0.5, -0.5, 0.25]));
    expect(decoded.right).toEqual(decoded.left);
    expect(mastering.rendered.value).toBeNull();
    expect(mastering.isLoading.value).toBe(false);
    expect(mastering.error.value).toBeNull();
  });

  it('records decode and worker failures while resetting busy flags', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      MasteringAudioContextMock.nextDecodeError = new Error('decode failed');
      const failedLoad = useMastering();
      const badFile = new File(['bad'], 'bad.wav');
      Object.defineProperty(badFile, 'arrayBuffer', {
        configurable: true,
        value: vi.fn(async () => new ArrayBuffer(4)),
      });

      await expect(failedLoad.loadFile(badFile)).rejects.toThrow('decode failed');
      expect(failedLoad.error.value).toBe('Failed to decode audio file');
      expect(failedLoad.isLoading.value).toBe(false);

      MasteringAudioContextMock.nextDecodeError = null;
      const failedRender = useMastering();
      const okFile = new File(['ok'], 'ok.wav');
      Object.defineProperty(okFile, 'arrayBuffer', {
        configurable: true,
        value: vi.fn(async () => new ArrayBuffer(4)),
      });
      await failedRender.loadFile(okFile);

      await expect(
        failedRender.render({
          preset: 'pop',
          targetLufs: -14,
          tuning: { tone: 50, width: 50, dynamics: 50 },
        }),
      ).rejects.toThrow('worker render failed');
      expect(failedRender.error.value).toBe('Mastering render failed');
      expect(failedRender.isRendering.value).toBe(false);
      expect(failedRender.renderProgress.value).toBe(0.4);
      expect(failedRender.renderStage.value).toBe('Halfway');
      expect(failedRender.rendered.value).toBeNull();
    } finally {
      consoleError.mockRestore();
    }
  });

  it('mixes stereo to mono for lufs and preserves invalid json reports as raw text', async () => {
    const mastering = useMastering();
    const audio: DecodedMasteringAudio = {
      fileName: 'source.wav',
      sampleRate: 44_100,
      duration: 1,
      channels: 2,
      left: new Float32Array([1, -1, 0.5]),
      right: new Float32Array([-1, 1, 0.25]),
    };
    mastering.source.value = audio;

    await expect(mastering.measureIntegratedLufs(audio)).resolves.toBe(-16.25);
    expect(wasm.lufs).toHaveBeenCalledWith(new Float32Array([0, 0, 0.375]), 44_100);

    const report = await mastering.analyzeSource([
      { name: 'Service', targetLufs: -14, ceilingDb: -1 },
    ]);
    expect(report.profile).toEqual({ duration: 12 });
    expect(report.suggestions).toBe('not-json');
    expect(report.streamingPreview).toEqual({ platforms: [{ name: 'A' }] });
    expect(wasm.masteringStreamingPreview).toHaveBeenCalledWith(
      new Float32Array([0, 0, 0.375]),
      44_100,
      [{ name: 'Service', targetLufs: -14, ceilingDb: -1 }],
    );
  });

  it('throws analysis errors before wasm calls when no source is loaded', async () => {
    const mastering = useMastering();
    await expect(mastering.analyzeSource([])).rejects.toThrow('No audio loaded');
    expect(wasm.init).not.toHaveBeenCalled();
  });
});
