import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, ref } from 'vue';
import { useAudioPlayer } from '@/composables/useAudioPlayer';
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

describe('useWaveform edge cases', () => {
  const disconnect = vi.fn();

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    disconnect.mockReset();
  });

  function mountWaveform(canvas: HTMLCanvasElement) {
    let waveform!: ReturnType<typeof useWaveform>;
    const wrapper = mount(
      defineComponent({
        setup() {
          waveform = useWaveform(ref(canvas), {
            barWidth: 2,
            barGap: 1,
            barColor: 'bar',
            progressColor: 'progress',
            backgroundColor: 'bg',
          });
          return () => null;
        },
      }),
    );
    return { wrapper, waveform };
  }

  it('keeps non-zero waveform peaks when the canvas needs more bars than samples', () => {
    const ctx = {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      roundRect: vi.fn(),
      fill: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      scale: vi.fn(),
    };
    const canvas = {
      width: 60,
      height: 24,
      getContext: vi.fn(() => ctx),
      getBoundingClientRect: () => ({ width: 60, height: 24 }),
    } as unknown as HTMLCanvasElement;
    vi.stubGlobal(
      'ResizeObserver',
      vi.fn().mockImplementation(function (callback: ResizeObserverCallback) {
        return {
          observe: vi.fn(() => callback([], {} as ResizeObserver)),
          disconnect,
        };
      }),
    );

    const { wrapper, waveform } = mountWaveform(canvas);
    try {
      waveform.setAudioBuffer(audioBuffer([new Float32Array([0, 0.25, -0.5, 1])]));

      expect(waveform.waveformData.value).toHaveLength(20);
      expect(Math.max(...waveform.waveformData.value)).toBe(1);
      expect(waveform.waveformData.value.some((value) => value > 0)).toBe(true);
      expect(ctx.roundRect).toHaveBeenCalled();
    } finally {
      wrapper.unmount();
    }
    expect(disconnect).toHaveBeenCalled();
  });

  it('accepts reactive colors and draws beat markers after progress updates', () => {
    const fills: string[] = [];
    const strokes: string[] = [];
    const ctx = {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      fillRect: vi.fn(function (this: { fillStyle: string }) {
        fills.push(this.fillStyle);
      }),
      beginPath: vi.fn(),
      roundRect: vi.fn(),
      fill: vi.fn(function (this: { fillStyle: string }) {
        fills.push(this.fillStyle);
      }),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(function (this: { strokeStyle: string }) {
        strokes.push(this.strokeStyle);
      }),
      scale: vi.fn(),
    };
    const canvas = {
      width: 12,
      height: 12,
      getContext: vi.fn(() => ctx),
      getBoundingClientRect: () => ({ width: 12, height: 12 }),
    } as unknown as HTMLCanvasElement;
    vi.stubGlobal(
      'ResizeObserver',
      vi.fn().mockImplementation(function (callback: ResizeObserverCallback) {
        return {
          observe: vi.fn(() => callback([], {} as ResizeObserver)),
          disconnect,
        };
      }),
    );

    const barColor = ref('bar-a');
    const progressColor = ref('progress-a');
    const backgroundColor = ref('bg-a');
    let waveform!: ReturnType<typeof useWaveform>;
    const wrapper = mount(
      defineComponent({
        setup() {
          waveform = useWaveform(ref(canvas), {
            barWidth: 2,
            barGap: 1,
            barColor,
            progressColor,
            backgroundColor,
          });
          return () => null;
        },
      }),
    );

    try {
      waveform.setAudioBuffer(audioBuffer([new Float32Array([0.1, 0.2, 0.3, 0.4])]));
      barColor.value = 'bar-b';
      progressColor.value = 'progress-b';
      backgroundColor.value = 'bg-b';
      waveform.setProgress(0.5);
      waveform.setBeats([0.25, 0.75], 1);
      waveform.draw();

      expect(fills).toEqual(expect.arrayContaining(['bg-b', 'progress-b', 'bar-b']));
      expect(strokes).toContain('rgba(236, 72, 153, 0.5)');
    } finally {
      wrapper.unmount();
    }
  });

  it('draws in logical pixels on a HiDPI display without double-applying the device pixel ratio', () => {
    const fillRect = vi.fn();
    const roundRect = vi.fn();
    const scale = vi.fn();
    const ctx = {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      fillRect,
      beginPath: vi.fn(),
      roundRect,
      fill: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      scale,
    };
    // Backing store starts at logical size; handleResize rescales it to physical
    // pixels (rect * dpr) and scales the context by dpr.
    const canvas = {
      width: 60,
      height: 24,
      getContext: vi.fn(() => ctx),
      getBoundingClientRect: () => ({ width: 60, height: 24 }),
    } as unknown as HTMLCanvasElement;
    vi.stubGlobal('devicePixelRatio', 2);
    vi.stubGlobal(
      'ResizeObserver',
      vi.fn().mockImplementation(function (callback: ResizeObserverCallback) {
        return {
          observe: vi.fn(() => callback([], {} as ResizeObserver)),
          disconnect,
        };
      }),
    );

    const { wrapper, waveform } = mountWaveform(canvas);
    try {
      waveform.setAudioBuffer(audioBuffer([new Float32Array([0.1, 0.2, 0.3, 0.4])]));

      // Backing store sized to physical pixels, context scaled by dpr once.
      expect(canvas.width).toBe(120);
      expect(canvas.height).toBe(48);
      expect(scale).toHaveBeenCalledWith(2, 2);

      // Bar count and background fill use logical (CSS) pixels, not physical —
      // 60 / (barWidth + barGap) = 20, and the clear covers 60x24, not 120x48.
      expect(waveform.waveformData.value).toHaveLength(20);
      expect(fillRect).toHaveBeenCalledWith(0, 0, 60, 24);
    } finally {
      wrapper.unmount();
    }
  });
});

describe('useAudioPlayer edge cases', () => {
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

  class PlayerAudioContextMock {
    static instances: PlayerAudioContextMock[] = [];
    sampleRate = 44_100;
    currentTime = 0;
    state = 'running';
    destination = { id: 'destination' };
    sources: SourceNodeMock[] = [];
    decodedBuffers: ArrayBuffer[] = [];
    audioWorklet = {
      addModule: vi.fn(async () => undefined),
    };
    resume = vi.fn(async () => undefined);
    close = vi.fn(async () => undefined);

    constructor() {
      PlayerAudioContextMock.instances.push(this);
    }

    async decodeAudioData(buffer: ArrayBuffer) {
      this.decodedBuffers.push(buffer);
      return audioBuffer([new Float32Array([0, 1, 0, -1])], this.sampleRate);
    }

    createBufferSource() {
      const source = new SourceNodeMock();
      this.sources.push(source);
      return source;
    }
  }

  class PlayerWorkletNodeMock {
    static instances: PlayerWorkletNodeMock[] = [];
    port = {
      messages: [] as unknown[],
      onmessage: null as ((event: MessageEvent) => void) | null,
      postMessage: vi.fn((message: unknown) => {
        this.port.messages.push(message);
      }),
    };
    connectedTo: unknown = null;
    disconnected = false;

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
  }

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    PlayerAudioContextMock.instances = [];
    PlayerWorkletNodeMock.instances = [];
  });

  function mountPlayer() {
    let player!: ReturnType<typeof useAudioPlayer>;
    const wrapper = mount(
      defineComponent({
        setup() {
          player = useAudioPlayer();
          return () => null;
        },
      }),
    );
    return { wrapper, player };
  }

  it('loads File objects, resets state on natural playback end and closes context on unmount', async () => {
    vi.stubGlobal('AudioContext', PlayerAudioContextMock);
    vi.stubGlobal('AudioWorkletNode', PlayerWorkletNodeMock);
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn(() => 1),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    const { wrapper, player } = mountPlayer();
    const file = new File([new Uint8Array([1, 2, 3])], 'demo.wav', { type: 'audio/wav' });
    Object.defineProperty(file, 'arrayBuffer', {
      configurable: true,
      value: vi.fn(async () => new Uint8Array([1, 2, 3]).buffer),
    });
    await player.loadAudio(file);
    const context = PlayerAudioContextMock.instances[0];

    expect(context.decodedBuffers[0].byteLength).toBe(3);
    expect(player.duration.value).toBe(4 / 44_100);

    await player.play();
    const source = context.sources[0];
    expect(player.isPlaying.value).toBe(true);

    source.onended?.();
    expect(player.isPlaying.value).toBe(false);
    expect(player.isPaused.value).toBe(false);
    expect(player.currentTime.value).toBe(0);
    expect(player.progress.value).toBe(0);
    expect(source.disconnected).toBe(true);

    wrapper.unmount();
    expect(context.close).toHaveBeenCalled();
  });

  it('falls back to direct destination playback when AudioWorklet setup fails', async () => {
    vi.stubGlobal('AudioContext', PlayerAudioContextMock);
    vi.stubGlobal('AudioWorkletNode', PlayerWorkletNodeMock);
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn(() => 1),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const { wrapper, player } = mountPlayer();
    await player.loadAudioFromArrayBuffer(new ArrayBuffer(4));
    const context = PlayerAudioContextMock.instances[0];
    context.audioWorklet.addModule.mockRejectedValueOnce(new Error('worklet unavailable'));

    player.setProcessCallback(vi.fn());
    await player.play(0.1);

    expect(context.audioWorklet.addModule).toHaveBeenCalledWith('/audio-stream-processor.js');
    expect(PlayerWorkletNodeMock.instances).toHaveLength(0);
    expect(context.sources[0].connectedTo).toEqual(context.destination);
    expect(warn).toHaveBeenCalled();

    wrapper.unmount();
    error.mockRestore();
    warn.mockRestore();
  });

  it('ignores a stale ended event from a previous source after a new source starts', async () => {
    vi.stubGlobal('AudioContext', PlayerAudioContextMock);
    vi.stubGlobal('AudioWorkletNode', PlayerWorkletNodeMock);
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn(() => 1),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    const { wrapper, player } = mountPlayer();
    await player.loadAudioFromArrayBuffer(new ArrayBuffer(4));
    const context = PlayerAudioContextMock.instances[0];

    await player.play();
    const sourceA = context.sources[0];

    // Simulate a seek/rewind: a new source B replaces A while playback continues.
    await player.play();
    const sourceB = context.sources[1];
    expect(sourceB).not.toBe(sourceA);
    expect(player.isPlaying.value).toBe(true);

    // The old source's 'ended' event fires late, after B is already the current
    // source. It must not tear down B (disconnect/null, reset time).
    sourceA.onended?.();

    expect(player.isPlaying.value).toBe(true);
    expect(sourceB.disconnected).toBe(false);
    expect(player.currentTime.value).toBe(0);

    // The current source's own 'ended' event still resets playback.
    sourceB.onended?.();
    expect(player.isPlaying.value).toBe(false);
    expect(sourceB.disconnected).toBe(true);

    wrapper.unmount();
  });

  it('shares worklet initialization and lets only the latest concurrent play create a source', async () => {
    vi.stubGlobal('AudioContext', PlayerAudioContextMock);
    vi.stubGlobal('AudioWorkletNode', PlayerWorkletNodeMock);
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn(() => 1),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    const { wrapper, player } = mountPlayer();
    await player.loadAudioFromArrayBuffer(new ArrayBuffer(4));
    const context = PlayerAudioContextMock.instances[0];
    let finishModule!: () => void;
    context.audioWorklet.addModule.mockImplementation(
      () => new Promise<void>((resolve) => (finishModule = resolve)),
    );
    player.setProcessCallback(vi.fn());

    const first = player.play();
    const second = player.play(0.00001);
    finishModule();
    await Promise.all([first, second]);

    expect(context.audioWorklet.addModule).toHaveBeenCalledTimes(1);
    expect(context.sources).toHaveLength(1);
    expect(context.sources[0].started).toEqual([[0, 0.00001]]);
    expect(PlayerWorkletNodeMock.instances).toHaveLength(1);
    expect(player.isPlaying.value).toBe(true);
    wrapper.unmount();
  });

  it('does not start a source after stop cancels pending worklet initialization', async () => {
    vi.stubGlobal('AudioContext', PlayerAudioContextMock);
    vi.stubGlobal('AudioWorkletNode', PlayerWorkletNodeMock);
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn(() => 1),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    const { wrapper, player } = mountPlayer();
    await player.loadAudioFromArrayBuffer(new ArrayBuffer(4));
    const context = PlayerAudioContextMock.instances[0];
    let finishModule!: () => void;
    context.audioWorklet.addModule.mockImplementation(
      () => new Promise<void>((resolve) => (finishModule = resolve)),
    );
    player.setProcessCallback(vi.fn());

    const pending = player.play();
    player.stop();
    finishModule();
    await pending;

    expect(context.sources).toHaveLength(0);
    expect(player.isPlaying.value).toBe(false);
    wrapper.unmount();
  });
});
