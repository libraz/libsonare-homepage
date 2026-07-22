import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { defineComponent, nextTick, ref } from 'vue';
import { useAudioPlayer } from '@/composables/useAudioPlayer';
import { useMasteringInsights } from '@/composables/useMasteringInsights';
import { useMasteringModeUrlSync } from '@/composables/useMasteringModeUrlSync';
import { useRealtimeFx } from '@/composables/useRealtimeFx';
import { useRealtimeMixer } from '@/composables/useRealtimeMixer';
import { useWaveform } from '@/composables/useWaveform';

function audioBuffer(channels: Float32Array[], sampleRate = 48_000): AudioBuffer {
  return {
    length: channels[0]?.length ?? 0,
    duration: (channels[0]?.length ?? 0) / sampleRate,
    sampleRate,
    numberOfChannels: channels.length,
    getChannelData: (channel: number) => channels[channel],
  } as AudioBuffer;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useMasteringInsights', () => {
  it('formats profile, suggestions and streaming preview rows', async () => {
    const source = ref({ left: new Float32Array([0]), right: new Float32Array([0]) });
    const mastering = {
      source,
      analyzeSource: vi.fn(async () => ({
        profile: {
          durationSec: 125,
          bpm: 119.94,
          loudness: {
            integratedLufs: -14.123,
            lraLu: 4.2,
            truePeakDb: -1.2,
            crestFactorDb: 9.4,
          },
        },
        suggestions: { explanation: ['Trim low end', 12, 'Limit true peak', 'Add air'] },
        streamingPreview: {
          platforms: [
            { name: 'Spotify', normalizationGainDb: -1.5, ceilingRisk: false },
            { name: 123, normalizationGainDb: 'bad', ceilingRisk: true },
          ],
        },
      })),
    } as any;

    const insights = useMasteringInsights(mastering);
    await insights.analyzeSourceInsights();

    expect(mastering.analyzeSource).toHaveBeenCalledWith([
      { name: 'Spotify', targetLufs: -14, ceilingDb: -1 },
      { name: 'YouTube', targetLufs: -14, ceilingDb: -1 },
      { name: 'Apple Music', targetLufs: -16, ceilingDb: -1 },
      { name: 'Podcast', targetLufs: -16, ceilingDb: -1 },
    ]);
    expect(insights.isAnalyzingInsights.value).toBe(false);
    expect(insights.insightProfileItems.value).toEqual([
      { label: 'Duration', value: '2:05' },
      { label: 'BPM', value: '119.9' },
      { label: 'Integrated LUFS', value: '-14.1 LUFS' },
      { label: 'Loudness range', value: '4.2 LU' },
      { label: 'True peak', value: '-1.2 dBTP' },
      { label: 'Crest factor', value: '9.4 dB' },
    ]);
    expect(insights.insightSuggestions.value).toEqual([
      'Trim low end',
      'Limit true peak',
      'Add air',
    ]);
    expect(insights.insightPreview.value).toEqual([
      {
        name: 'Spotify',
        normalizationGainDb: -1.5,
        ceilingRisk: false,
        safeCeilingDb: 0.5,
        currentCeilingDb: Number.NaN,
      },
      {
        name: '-',
        normalizationGainDb: Number.NaN,
        ceilingRisk: true,
        safeCeilingDb: Number.NaN,
        currentCeilingDb: Number.NaN,
      },
    ]);

    insights.resetInsights();
    expect(insights.insightReport.value).toBeNull();
    expect(insights.isAnalyzingInsights.value).toBe(false);
  });

  it('recomputes ceiling risk from the current limiter ceiling', async () => {
    const source = ref({ left: new Float32Array([0]), right: new Float32Array([0]) });
    const currentCeilingDb = ref(-1);
    const mastering = {
      source,
      analyzeSource: vi.fn(async () => ({
        profile: {},
        suggestions: { explanation: [] },
        streamingPreview: {
          platforms: [{ name: 'YouTube', normalizationGainDb: 1.2, ceilingRisk: true }],
        },
      })),
    } as any;

    const insights = useMasteringInsights(mastering, currentCeilingDb);
    await insights.analyzeSourceInsights();

    expect(insights.insightPreview.value[0]).toMatchObject({
      ceilingRisk: true,
      safeCeilingDb: -2.2,
      currentCeilingDb: -1,
    });

    currentCeilingDb.value = -2.5;
    expect(insights.insightPreview.value[0]).toMatchObject({
      ceilingRisk: false,
      safeCeilingDb: -2.2,
      currentCeilingDb: -2.5,
    });
  });

  it('ignores missing sources and stale async insight results', async () => {
    const first = deferred<any>();
    const second = deferred<any>();
    const mastering = {
      source: ref(null),
      analyzeSource: vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise),
    } as any;
    const insights = useMasteringInsights(mastering);

    await insights.analyzeSourceInsights();
    expect(mastering.analyzeSource).not.toHaveBeenCalled();

    mastering.source.value = { left: new Float32Array([0]), right: new Float32Array([0]) };
    const firstRun = insights.analyzeSourceInsights();
    const secondRun = insights.analyzeSourceInsights();
    first.resolve({
      profile: { source: 'old' },
      suggestions: { explanation: ['old'] },
      streamingPreview: { platforms: [] },
    });
    await firstRun;
    expect(insights.isAnalyzingInsights.value).toBe(true);

    second.resolve({
      profile: { source: 'new' },
      suggestions: { explanation: ['new'] },
      streamingPreview: { platforms: [] },
    });
    await secondRun;
    expect(insights.insightProfileItems.value[0]).toEqual({ label: 'Duration', value: '-' });
    expect(insights.isAnalyzingInsights.value).toBe(false);
  });
});

describe('useMasteringModeUrlSync', () => {
  it('reads, writes, clears and responds to history mode changes', async () => {
    window.history.replaceState({}, '', '/mastering?mode=studio#demo');
    const mode = ref<'quick' | 'studio'>('quick');
    const sync = useMasteringModeUrlSync(mode);

    sync.applyModeFromUrl();
    expect(mode.value).toBe('studio');

    sync.replaceModeInUrl();
    expect(window.location.search).toBe('?mode=studio');

    sync.enableModeUrlSync();
    await nextTick();
    mode.value = 'quick';
    await nextTick();
    expect(window.location.search).toBe('');
    expect(window.location.hash).toBe('#demo');

    mode.value = 'studio';
    await nextTick();
    expect(window.location.search).toBe('?mode=studio');

    window.history.pushState({}, '', '/mastering');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(mode.value).toBe('quick');
    sync.disableModeUrlSync();

    mode.value = 'studio';
    await nextTick();
    expect(window.location.search).toBe('');
  });
});

describe('useWaveform', () => {
  it('extracts normalized waveform data, progress colors and beat markers', async () => {
    const calls: Array<{
      method: string;
      args: unknown[];
      fillStyle?: string;
      strokeStyle?: string;
    }> = [];
    const ctx = {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      fillRect: vi.fn(function (this: any, ...args: unknown[]) {
        calls.push({ method: 'fillRect', args, fillStyle: this.fillStyle });
      }),
      beginPath: vi.fn(() => calls.push({ method: 'beginPath', args: [] })),
      roundRect: vi.fn((...args: unknown[]) => calls.push({ method: 'roundRect', args })),
      fill: vi.fn(function (this: any) {
        calls.push({ method: 'fill', args: [], fillStyle: this.fillStyle });
      }),
      moveTo: vi.fn((...args: unknown[]) => calls.push({ method: 'moveTo', args })),
      lineTo: vi.fn((...args: unknown[]) => calls.push({ method: 'lineTo', args })),
      stroke: vi.fn(function (this: any) {
        calls.push({ method: 'stroke', args: [], strokeStyle: this.strokeStyle });
      }),
      scale: vi.fn(),
    };
    const canvas = {
      width: 40,
      height: 20,
      getContext: vi.fn(() => ctx),
      getBoundingClientRect: () => ({ width: 40, height: 20 }),
    } as unknown as HTMLCanvasElement;

    const ResizeObserverMock = vi.fn().mockImplementation(function (
      callback: ResizeObserverCallback,
    ) {
      return {
        observe: vi.fn(() => callback([], {} as ResizeObserver)),
        disconnect: vi.fn(),
      };
    });
    // @ts-expect-error jsdom ResizeObserver mock
    globalThis.ResizeObserver = ResizeObserverMock;

    let waveform!: ReturnType<typeof useWaveform>;
    const wrapper = mount(
      defineComponent({
        setup() {
          waveform = useWaveform(ref(canvas), {
            barWidth: 3,
            barGap: 1,
            barColor: 'bar',
            progressColor: 'progress',
            backgroundColor: 'bg',
          });
          return () => null;
        },
      }),
    );

    try {
      waveform.setAudioBuffer(
        audioBuffer([
          new Float32Array([0, 0.2, -0.4, 0.8, -1, 0.5, 0.25, -0.1]),
          new Float32Array([0, -0.2, 0.4, -0.8, 1, -0.5, -0.25, 0.1]),
        ]),
      );
      expect(waveform.waveformData.value).toHaveLength(10);
      expect(Math.max(...waveform.waveformData.value)).toBeGreaterThanOrEqual(0);

      waveform.setProgress(0.5);
      expect(waveform.progress.value).toBe(0.5);
      expect(calls.some((call) => call.method === 'fill' && call.fillStyle === 'progress')).toBe(
        true,
      );
      expect(calls.some((call) => call.method === 'fill' && call.fillStyle === 'bar')).toBe(true);

      waveform.setBeats(new Float32Array([0.25, 0.5]), 1);
      waveform.draw();
      expect(waveform.beatMarkers.value).toEqual([0.25, 0.5]);
      expect(
        calls.some(
          (call) => call.method === 'stroke' && call.strokeStyle === 'rgba(236, 72, 153, 0.5)',
        ),
      ).toBe(true);
    } finally {
      wrapper.unmount();
    }
  });
});

describe('useRealtimeMixer', () => {
  class RealtimeMixerAudioContextMock {
    static instances: RealtimeMixerAudioContextMock[] = [];
    sampleRate: number;
    state = 'suspended';
    destination = {};
    closed = false;
    audioWorklet = {
      addModule: vi.fn(async (url: string) => {
        this.moduleUrls.push(url);
      }),
    };
    moduleUrls: string[] = [];
    resume = vi.fn(async () => {
      this.state = 'running';
    });
    close = vi.fn(async () => {
      this.closed = true;
    });

    constructor(options: { sampleRate: number }) {
      this.sampleRate = options.sampleRate;
      RealtimeMixerAudioContextMock.instances.push(this);
    }
  }

  class RealtimeMixerWorkletNodeMock {
    static instances: RealtimeMixerWorkletNodeMock[] = [];
    port = {
      onmessage: null as ((event: MessageEvent) => void) | null,
      messages: [] as unknown[],
      postMessage: vi.fn((message: unknown) => {
        this.port.messages.push(message);
      }),
    };
    connectedTo: unknown = null;
    disconnected = false;
    options: AudioWorkletNodeOptions;

    constructor(
      _ctx: AudioContext,
      public name: string,
      options: AudioWorkletNodeOptions,
    ) {
      this.options = options;
      RealtimeMixerWorkletNodeMock.instances.push(this);
    }

    connect(destination: unknown) {
      this.connectedTo = destination;
    }

    disconnect() {
      this.disconnected = true;
    }

    emit(data: unknown) {
      this.port.onmessage?.({ data } as MessageEvent);
    }
  }

  it('starts worklet playback, forwards controls, handles messages and disposes', async () => {
    const originalAudioContext = globalThis.AudioContext;
    const originalAudioWorkletNode = globalThis.AudioWorkletNode;
    const originalFetch = globalThis.fetch;
    // @ts-expect-error focused test mock
    globalThis.AudioContext = RealtimeMixerAudioContextMock;
    // @ts-expect-error focused test mock
    globalThis.AudioWorkletNode = RealtimeMixerWorkletNodeMock;
    globalThis.fetch = vi.fn(async () => ({
      arrayBuffer: async () => new ArrayBuffer(16),
    })) as any;

    try {
      const ended = vi.fn();
      const mixer = useRealtimeMixer('/wasm/sonare.js', '/wasm/sonare.wasm');
      const payload = {
        sceneJson: '{"version":1}',
        sampleRate: 44_100,
        masterGain: 0.8,
        startFrame: 128,
        totalFrames: 1024,
        strips: [
          { left: new Float32Array([0.1]), right: new Float32Array([0.1]), offsetFrames: 0 },
        ],
        gates: [true],
      };

      const startPromise = mixer.start(payload, ended);
      await vi.waitFor(() => {
        expect(RealtimeMixerWorkletNodeMock.instances.length).toBeGreaterThan(0);
      });
      const context = RealtimeMixerAudioContextMock.instances.at(-1)!;
      const node = RealtimeMixerWorkletNodeMock.instances.at(-1)!;

      expect(context.sampleRate).toBe(44_100);
      expect(context.resume).toHaveBeenCalled();
      expect(context.audioWorklet.addModule).toHaveBeenCalledWith('blob:test');
      expect(globalThis.fetch).toHaveBeenCalledWith('/wasm/sonare.wasm');
      expect(node.name).toBe('libsonare-rt-mixer');
      expect(node.options.processorOptions).toMatchObject({
        sceneJson: payload.sceneJson,
        sampleRate: 44_100,
        masterGain: 0.8,
        startFrame: 128,
        totalFrames: 1024,
        gates: [true],
      });

      node.emit({ type: 'ready' });
      await startPromise;
      expect(mixer.ready.value).toBe(true);
      expect(mixer.playing.value).toBe(true);
      expect(node.port.messages).toContainEqual({ type: 'play' });

      node.emit({ type: 'position', frame: 441 });
      expect(mixer.positionSec.value).toBeCloseTo(0.01, 6);

      mixer.seek(882);
      expect(mixer.positionSec.value).toBeCloseTo(0.02, 6);
      mixer.updateScene('{"updated":true}');
      mixer.updateGates([false]);
      mixer.updateMasterGain(0.5);
      mixer.stop();
      expect(node.port.messages).toEqual(
        expect.arrayContaining([
          { type: 'seek', frame: 882 },
          { type: 'scene', sceneJson: '{"updated":true}' },
          { type: 'gates', gates: [false] },
          { type: 'masterGain', value: 0.5 },
          { type: 'stop' },
        ]),
      );
      expect(mixer.playing.value).toBe(false);

      node.emit({ type: 'ended', frame: 1024 });
      expect(ended).toHaveBeenCalled();

      await mixer.dispose();
      expect(node.disconnected).toBe(true);
      expect(context.close).toHaveBeenCalled();
      expect(mixer.ready.value).toBe(false);
      expect(mixer.playing.value).toBe(false);
      expect(mixer.positionSec.value).toBe(0);
    } finally {
      globalThis.AudioContext = originalAudioContext;
      globalThis.AudioWorkletNode = originalAudioWorkletNode;
      globalThis.fetch = originalFetch;
    }
  });

  it('reuses realtime mixer contexts by sample rate and recreates them when rates change', async () => {
    const originalAudioContext = globalThis.AudioContext;
    const originalAudioWorkletNode = globalThis.AudioWorkletNode;
    const originalFetch = globalThis.fetch;
    RealtimeMixerAudioContextMock.instances = [];
    RealtimeMixerWorkletNodeMock.instances = [];
    // @ts-expect-error focused test mock
    globalThis.AudioContext = RealtimeMixerAudioContextMock;
    // @ts-expect-error focused test mock
    globalThis.AudioWorkletNode = RealtimeMixerWorkletNodeMock;
    globalThis.fetch = vi.fn(async () => ({
      arrayBuffer: async () => new ArrayBuffer(16),
    })) as any;

    const payload = {
      sceneJson: '{"version":1}',
      sampleRate: 48_000,
      masterGain: 1,
      startFrame: 0,
      totalFrames: 1024,
      strips: [{ left: new Float32Array([0.1]), right: new Float32Array([0.1]), offsetFrames: 0 }],
      gates: [true],
    };

    try {
      const mixer = useRealtimeMixer('/wasm/sonare.js', '/wasm/sonare.wasm');
      const firstStart = mixer.start(payload);
      await vi.waitFor(() => {
        expect(RealtimeMixerWorkletNodeMock.instances).toHaveLength(1);
      });
      const firstContext = RealtimeMixerAudioContextMock.instances[0];
      const firstNode = RealtimeMixerWorkletNodeMock.instances[0];
      firstNode.emit({ type: 'ready' });
      await firstStart;

      const secondStart = mixer.start({ ...payload, sceneJson: '{"version":2}' });
      await vi.waitFor(() => {
        expect(RealtimeMixerWorkletNodeMock.instances).toHaveLength(2);
      });
      RealtimeMixerWorkletNodeMock.instances[1].emit({ type: 'ready' });
      await secondStart;
      expect(RealtimeMixerAudioContextMock.instances).toHaveLength(1);
      expect(firstNode.disconnected).toBe(true);
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);

      const thirdStart = mixer.start({ ...payload, sampleRate: 44_100 });
      await vi.waitFor(() => {
        expect(RealtimeMixerWorkletNodeMock.instances).toHaveLength(3);
      });
      RealtimeMixerWorkletNodeMock.instances[2].emit({ type: 'ready' });
      await thirdStart;
      expect(RealtimeMixerAudioContextMock.instances).toHaveLength(2);
      expect(firstContext.close).toHaveBeenCalled();
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);

      await mixer.dispose();
    } finally {
      globalThis.AudioContext = originalAudioContext;
      globalThis.AudioWorkletNode = originalAudioWorkletNode;
      globalThis.fetch = originalFetch;
    }
  });

  it('rejects worklet initialization errors and pending starts cancelled by dispose', async () => {
    const originalAudioContext = globalThis.AudioContext;
    const originalAudioWorkletNode = globalThis.AudioWorkletNode;
    const originalFetch = globalThis.fetch;
    RealtimeMixerAudioContextMock.instances = [];
    RealtimeMixerWorkletNodeMock.instances = [];
    // @ts-expect-error focused test mock
    globalThis.AudioContext = RealtimeMixerAudioContextMock;
    // @ts-expect-error focused test mock
    globalThis.AudioWorkletNode = RealtimeMixerWorkletNodeMock;
    globalThis.fetch = vi.fn(async () => ({
      arrayBuffer: async () => new ArrayBuffer(16),
    })) as any;

    const payload = {
      sceneJson: '{"version":1}',
      sampleRate: 48_000,
      masterGain: 1,
      startFrame: 0,
      totalFrames: 1024,
      strips: [{ left: new Float32Array([0.1]), right: new Float32Array([0.1]), offsetFrames: 0 }],
      gates: [true],
    };

    try {
      const mixer = useRealtimeMixer('/wasm/sonare.js', '/wasm/sonare.wasm');
      const failedStart = mixer.start(payload);
      await vi.waitFor(() => {
        expect(RealtimeMixerWorkletNodeMock.instances).toHaveLength(1);
      });
      RealtimeMixerWorkletNodeMock.instances[0].emit({ type: 'error', error: 'worklet failed' });
      await expect(failedStart).rejects.toThrow('worklet failed');
      expect(mixer.error.value).toBe('worklet failed');
      expect(RealtimeMixerWorkletNodeMock.instances[0].disconnected).toBe(true);

      const pendingStart = mixer.start(payload);
      await vi.waitFor(() => {
        expect(RealtimeMixerWorkletNodeMock.instances).toHaveLength(2);
      });
      await mixer.dispose();
      await expect(pendingStart).rejects.toThrow('disposed');
      expect(RealtimeMixerWorkletNodeMock.instances[1].disconnected).toBe(true);
    } finally {
      globalThis.AudioContext = originalAudioContext;
      globalThis.AudioWorkletNode = originalAudioWorkletNode;
      globalThis.fetch = originalFetch;
    }
  });
});

describe('useRealtimeFx', () => {
  class FxNodeMock {
    connectedTo: unknown[] = [];
    disconnected = false;

    connect(destination: unknown) {
      this.connectedTo.push(destination);
    }

    disconnect() {
      this.disconnected = true;
    }
  }

  class FxGainMock extends FxNodeMock {
    gain = { value: 1 };
  }

  class FxTrackMock {
    stop = vi.fn();
  }

  class FxMediaStreamMock {
    track = new FxTrackMock();
    getTracks = vi.fn(() => [this.track]);
  }

  class FxWorkletNodeMock extends FxNodeMock {
    static instances: FxWorkletNodeMock[] = [];
    port = {
      onmessage: null as ((event: MessageEvent) => void) | null,
      messages: [] as unknown[],
      postMessage: vi.fn((message: unknown) => {
        this.port.messages.push(message);
      }),
    };
    options: AudioWorkletNodeOptions;

    constructor(
      _ctx: AudioContext,
      public name: string,
      options: AudioWorkletNodeOptions,
    ) {
      super();
      this.options = options;
      FxWorkletNodeMock.instances.push(this);
    }

    emit(data: unknown) {
      this.port.onmessage?.({ data } as MessageEvent);
    }
  }

  class FxAudioContextMock {
    static instances: FxAudioContextMock[] = [];
    sampleRate = 48_000;
    baseLatency = 0.01;
    state = 'suspended';
    destination = { id: 'destination' };
    sourceNodes: FxNodeMock[] = [];
    gainNodes: FxGainMock[] = [];
    audioWorklet = {
      addModule: vi.fn(async (url: string) => {
        this.moduleUrls.push(url);
      }),
    };
    moduleUrls: string[] = [];
    resume = vi.fn(async () => {
      this.state = 'running';
    });
    close = vi.fn(async () => undefined);

    constructor(_options: AudioContextOptions) {
      FxAudioContextMock.instances.push(this);
    }

    createMediaStreamSource(_stream: MediaStream) {
      const node = new FxNodeMock();
      this.sourceNodes.push(node);
      return node;
    }

    createGain() {
      const gain = new FxGainMock();
      this.gainNodes.push(gain);
      return gain;
    }
  }

  function setNavigatorMediaDevices(value: unknown) {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value,
    });
  }

  it('starts microphone processing, toggles monitoring, posts params and disposes', async () => {
    const originalAudioContext = globalThis.AudioContext;
    const originalAudioWorkletNode = globalThis.AudioWorkletNode;
    const originalFetch = globalThis.fetch;
    const originalMediaDevices = navigator.mediaDevices;
    const stream = new FxMediaStreamMock();
    // @ts-expect-error focused test mock
    globalThis.AudioContext = FxAudioContextMock;
    // @ts-expect-error focused test mock
    globalThis.AudioWorkletNode = FxWorkletNodeMock;
    globalThis.fetch = vi.fn(async () => ({
      arrayBuffer: async () => new ArrayBuffer(32),
    })) as any;
    setNavigatorMediaDevices({
      getUserMedia: vi.fn(async () => stream),
    });

    try {
      const fx = useRealtimeFx('/wasm/sonare.js', '/wasm/sonare.wasm');
      const startPromise = fx.start();
      await vi.waitFor(() => expect(FxWorkletNodeMock.instances).toHaveLength(1));

      const context = FxAudioContextMock.instances.at(-1)!;
      const node = FxWorkletNodeMock.instances.at(-1)!;
      const silentGain = context.gainNodes.at(-1)!;

      expect(context.audioWorklet.addModule).toHaveBeenCalledWith('blob:test');
      expect(globalThis.fetch).toHaveBeenCalledWith('/wasm/sonare.wasm');
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      expect(node.name).toBe('libsonare-voice');
      expect(silentGain.gain.value).toBe(0);

      // The worklet now owns readiness: ready flips true only once the processor
      // posts 'ready' (init could still fail before then). Latency is derived
      // from the native chain's reported latency on the same message.
      node.emit({ type: 'ready', latencySamples: 2232 });
      await expect(startPromise).resolves.toBe(true);
      expect(fx.ready.value).toBe(true);
      expect(fx.latencyMs.value).toBe(
        Math.round((2232 / context.sampleRate + context.baseLatency) * 1000),
      );

      await expect(fx.start()).resolves.toBe(true);
      expect(FxAudioContextMock.instances).toHaveLength(1);
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);

      const params = {
        preset: 'robot-mascot',
        pitchSemitones: 7,
        formant: 1.3,
        brightness: 0.75,
        formantEngaged: false,
        wet: 1,
        outputGain: 0.85,
        bypass: false,
      } as const;
      fx.setParams(params);
      expect(node.port.messages).toContainEqual({ type: 'params', params });

      node.emit({ type: 'meter', inputPeak: 0.5, outputPeak: 0.25, inputRms: 0.2, outputRms: 0.1 });
      expect(fx.meter.value).toMatchObject({ inputPeak: 0.5, outputPeak: 0.25 });

      await expect(fx.toggleMonitor()).resolves.toBe(true);
      expect(context.resume).toHaveBeenCalled();
      expect(fx.monitoring.value).toBe(true);
      expect(node.port.messages).toContainEqual({ type: 'setEnabled', enabled: true });

      await expect(fx.toggleMonitor()).resolves.toBe(false);
      expect(fx.monitoring.value).toBe(false);
      expect(node.port.messages).toContainEqual({ type: 'setEnabled', enabled: false });

      // Worklet-reported faults surface as a localizable code, not the raw string.
      node.emit({ type: 'error', error: 'processor failed' });
      expect(fx.error.value).toBe('engine-error');

      await fx.dispose();
      expect(fx.ready.value).toBe(false);
      expect(fx.monitoring.value).toBe(false);
      expect(fx.meter.value).toEqual({ inputPeak: 0, outputPeak: 0, inputRms: 0, outputRms: 0 });
      expect(stream.track.stop).toHaveBeenCalled();
      expect(context.close).toHaveBeenCalled();
    } finally {
      globalThis.AudioContext = originalAudioContext;
      globalThis.AudioWorkletNode = originalAudioWorkletNode;
      globalThis.fetch = originalFetch;
      setNavigatorMediaDevices(originalMediaDevices);
    }
  });

  it('cleans up audio resources when realtime FX startup fails after context creation', async () => {
    const originalAudioContext = globalThis.AudioContext;
    const originalAudioWorkletNode = globalThis.AudioWorkletNode;
    const originalFetch = globalThis.fetch;
    const originalMediaDevices = navigator.mediaDevices;
    FxAudioContextMock.instances = [];
    FxWorkletNodeMock.instances = [];
    // @ts-expect-error focused test mock
    globalThis.AudioContext = FxAudioContextMock;
    // @ts-expect-error focused test mock
    globalThis.AudioWorkletNode = FxWorkletNodeMock;
    globalThis.fetch = vi.fn(async () => {
      throw new Error('wasm fetch failed');
    }) as any;
    setNavigatorMediaDevices({
      getUserMedia: vi.fn(async () => new FxMediaStreamMock()),
    });

    try {
      const fx = useRealtimeFx('/wasm/sonare.js', '/wasm/sonare.wasm');
      await expect(fx.start()).resolves.toBe(false);

      const context = FxAudioContextMock.instances.at(-1)!;
      // start() maps caught startup exceptions to a localizable error code
      // (raw messages are no longer surfaced); a wasm fetch failure → 'start-failed'.
      expect(fx.error.value).toBe('start-failed');
      expect(fx.ready.value).toBe(false);
      expect(fx.monitoring.value).toBe(false);
      expect(fx.latencyMs.value).toBe(0);
      expect(context.close).toHaveBeenCalled();
      expect(FxWorkletNodeMock.instances).toHaveLength(0);
    } finally {
      globalThis.AudioContext = originalAudioContext;
      globalThis.AudioWorkletNode = originalAudioWorkletNode;
      globalThis.fetch = originalFetch;
      setNavigatorMediaDevices(originalMediaDevices);
    }
  });

  it('reports start failure when microphone APIs are unavailable', async () => {
    const originalMediaDevices = navigator.mediaDevices;
    setNavigatorMediaDevices(undefined);
    try {
      const fx = useRealtimeFx('/wasm/sonare.js', '/wasm/sonare.wasm');
      await expect(fx.start()).resolves.toBe(false);
      expect(fx.error.value).toBe('no-mic-api');
      expect(fx.ready.value).toBe(false);
    } finally {
      setNavigatorMediaDevices(originalMediaDevices);
    }
  });
});

describe('useAudioPlayer', () => {
  class SourceNodeMock {
    buffer: AudioBuffer | null = null;
    onended: (() => void) | null = null;
    started: Array<[number, number?]> = [];
    stopped = false;
    disconnected = false;
    connectedTo: unknown = null;

    connect(destination: unknown) {
      this.connectedTo = destination;
    }

    disconnect() {
      this.disconnected = true;
    }

    start(when: number, offset?: number) {
      this.started.push([when, offset]);
    }

    stop() {
      this.stopped = true;
    }
  }

  class PlayerWorkletNodeMock {
    static instances: PlayerWorkletNodeMock[] = [];
    port = {
      onmessage: null as ((event: MessageEvent) => void) | null,
      messages: [] as unknown[],
      postMessage: vi.fn((message: unknown) => {
        this.port.messages.push(message);
      }),
    };
    disconnected = false;
    connectedTo: unknown = null;

    constructor(
      _ctx: AudioContext,
      public name: string,
    ) {
      PlayerWorkletNodeMock.instances.push(this);
    }

    connect(destination: unknown) {
      this.connectedTo = destination;
    }

    disconnect() {
      this.disconnected = true;
    }

    emit(data: unknown) {
      this.port.onmessage?.({ data } as MessageEvent);
    }
  }

  class PlayerAudioContextMock {
    static instances: PlayerAudioContextMock[] = [];
    sampleRate = 48_000;
    currentTime = 10;
    state = 'suspended';
    destination = {};
    sources: SourceNodeMock[] = [];
    audioWorklet = {
      addModule: vi.fn(async (_url: string) => undefined),
    };
    resume = vi.fn(async () => {
      this.state = 'running';
    });
    close = vi.fn(async () => undefined);

    constructor() {
      PlayerAudioContextMock.instances.push(this);
    }

    async decodeAudioData(_buffer: ArrayBuffer) {
      const samples = new Float32Array(this.sampleRate * 2);
      samples[0] = 0.5;
      samples[1] = -0.5;
      return audioBuffer([samples], this.sampleRate);
    }

    createBufferSource() {
      const source = new SourceNodeMock();
      this.sources.push(source);
      return source;
    }
  }

  it('loads, plays, pauses, seeks, resumes, stops and forwards worklet samples', async () => {
    const originalAudioContext = globalThis.AudioContext;
    const originalAudioWorkletNode = globalThis.AudioWorkletNode;
    const originalRaf = globalThis.requestAnimationFrame;
    const originalCancel = globalThis.cancelAnimationFrame;
    // @ts-expect-error focused test mock
    globalThis.AudioContext = PlayerAudioContextMock;
    // @ts-expect-error focused test mock
    globalThis.AudioWorkletNode = PlayerWorkletNodeMock;
    globalThis.requestAnimationFrame = vi.fn(() => 1) as any;
    globalThis.cancelAnimationFrame = vi.fn() as any;

    try {
      let player!: ReturnType<typeof useAudioPlayer>;
      const wrapper = mount(
        defineComponent({
          setup() {
            player = useAudioPlayer();
            return () => null;
          },
        }),
      );

      try {
        expect(player.progress.value).toBe(0);
        const buffer = await player.loadAudioFromArrayBuffer(new ArrayBuffer(8));
        const context = PlayerAudioContextMock.instances.at(-1)!;
        expect(player.audioBuffer.value).toMatchObject({
          length: buffer.length,
          duration: buffer.duration,
          sampleRate: buffer.sampleRate,
        });
        expect(player.duration.value).toBe(buffer.duration);
        expect(player.formatTime(125)).toBe('2:05');

        const samplesSeen: Array<{ samples: Float32Array; sampleOffset: number }> = [];
        player.setProcessCallback((samples, sampleOffset) => {
          samplesSeen.push({ samples, sampleOffset });
        });

        await player.play(0.25);
        const firstSource = context.sources.at(-1)!;
        const worklet = PlayerWorkletNodeMock.instances.at(-1)!;
        expect(context.resume).toHaveBeenCalled();
        expect(context.audioWorklet.addModule).toHaveBeenCalledWith('/audio-stream-processor.js');
        expect(firstSource.started).toEqual([[0, 0.25]]);
        expect(worklet.port.messages).toContainEqual({ type: 'reset', sampleOffset: 12_000 });
        expect(player.isPlaying.value).toBe(true);
        expect(player.isPaused.value).toBe(false);

        const workletSamples = new Float32Array([0.1, 0.2]);
        worklet.emit({ type: 'samples', samples: workletSamples, sampleOffset: 12_000 });
        expect(samplesSeen).toEqual([{ samples: workletSamples, sampleOffset: 12_000 }]);

        context.currentTime = 10.75;
        player.pause();
        expect(firstSource.stopped).toBe(true);
        expect(worklet.port.messages).toContainEqual({ type: 'stop' });
        expect(player.isPlaying.value).toBe(false);
        expect(player.isPaused.value).toBe(true);
        expect(player.currentTime.value).toBeCloseTo(0.25, 6);

        await player.resume();
        expect(player.isPlaying.value).toBe(true);
        expect(context.sources.at(-1)!.started[0][1]).toBeCloseTo(1, 6);

        player.stop();
        expect(player.isPlaying.value).toBe(false);
        expect(player.isPaused.value).toBe(false);
        expect(player.currentTime.value).toBe(0);

        player.seek(0.5);
        expect(player.isPaused.value).toBe(true);
        expect(player.currentTime.value).toBe(0.5);

        player.stop();

        wrapper.unmount();
        expect(context.close).toHaveBeenCalled();
      } finally {
        wrapper.unmount();
      }
    } finally {
      globalThis.AudioContext = originalAudioContext;
      globalThis.AudioWorkletNode = originalAudioWorkletNode;
      globalThis.requestAnimationFrame = originalRaf;
      globalThis.cancelAnimationFrame = originalCancel;
    }
  });
});
