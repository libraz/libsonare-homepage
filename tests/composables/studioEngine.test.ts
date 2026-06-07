import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultPattern, STUDIO_TRACKS } from '@/components/studio/studioCopy';

const BUCKET_COUNT = 24;

const wasmMock = vi.hoisted(() => {
  class ProjectMock {
    static instances: ProjectMock[] = [];
    static midiNoteOn = vi.fn((...args: unknown[]) => ({ kind: 'on', args }));
    static midiNoteOff = vi.fn((...args: unknown[]) => ({ kind: 'off', args }));
    deleted = false;
    bounces: Array<{ instruments: unknown; options: any }> = [];
    setSampleRate = vi.fn();
    setTempoSegments = vi.fn();
    setTrackMidiDestination = vi.fn();
    setMidiEvents = vi.fn();
    addMidiClip = vi.fn(() => ({ trackId: 1, clipId: 2 }));
    bounceWithSynthInstrument = vi.fn((instruments: unknown, options: any) => {
      this.bounces.push({ instruments, options });
      const frames = options.totalFrames ?? 64;
      return new Float32Array(frames * 2);
    });
    delete = vi.fn(() => {
      this.deleted = true;
    });
    constructor() {
      ProjectMock.instances.push(this);
    }
  }
  return {
    Project: ProjectMock,
    init: vi.fn(async () => undefined),
    version: vi.fn(() => '1.3.1-test'),
    waveformPeaks: vi.fn((_samples: Float32Array, channels: number, _opts: unknown) => ({
      min: new Float32Array(channels * BUCKET_COUNT),
      max: new Float32Array(channels * BUCKET_COUNT),
      channels,
      bucketCount: BUCKET_COUNT,
      samplesPerBucket: 64,
    })),
  };
});

vi.mock('@/wasm/index.js', () => wasmMock);

class AudioContextMock {
  static instances: AudioContextMock[] = [];
  state = 'suspended';
  currentTime = 0;
  destination = {};
  resume = vi.fn(async () => {
    this.state = 'running';
  });
  close = vi.fn(async () => {
    this.state = 'closed';
  });
  createGain() {
    return { gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() };
  }
  createAnalyser() {
    return {
      fftSize: 512,
      connect: vi.fn(),
      disconnect: vi.fn(),
      getFloatTimeDomainData: vi.fn(),
    };
  }
  createBuffer(_channels: number, length: number) {
    return { length, getChannelData: () => new Float32Array(length) };
  }
  createBufferSource() {
    return {
      buffer: null,
      loop: false,
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
  }
  constructor() {
    AudioContextMock.instances.push(this);
  }
}

describe('useStudioEngine', () => {
  let originalAudioContext: typeof globalThis.AudioContext;

  beforeEach(() => {
    vi.clearAllMocks();
    wasmMock.Project.instances.length = 0;
    AudioContextMock.instances.length = 0;
    originalAudioContext = globalThis.AudioContext;
    // @ts-expect-error focused test mock
    globalThis.AudioContext = AudioContextMock;
  });

  afterEach(() => {
    globalThis.AudioContext = originalAudioContext;
  });

  async function loadEngine() {
    const { useStudioEngine } = await import('@/composables/useStudioEngine');
    return useStudioEngine();
  }

  it('boots the WASM module and audio graph', async () => {
    const engine = await loadEngine();
    const ok = await engine.start();
    expect(ok).toBe(true);
    expect(wasmMock.init).toHaveBeenCalledTimes(1);
    expect(engine.ready.value).toBe(true);
    expect(engine.libVersion.value).toBe('1.3.1-test');
  });

  it('bounces one Project per track and sizes stem views by report.bucketCount', async () => {
    const engine = await loadEngine();
    await engine.start();

    const pattern = defaultPattern();
    pattern[0][0][0] = true; // one active step on the lead track
    engine.rebuild(pattern, 120);

    // One Project per track, each disposed.
    expect(wasmMock.Project.instances).toHaveLength(STUDIO_TRACKS.length);
    for (const project of wasmMock.Project.instances) expect(project.deleted).toBe(true);

    // Loop bounce passes the libsonare instrument list + exact-length options.
    const firstBounce = wasmMock.Project.instances[0].bounces[0];
    expect(firstBounce.instruments).toEqual([
      { preset: STUDIO_TRACKS[0].preset, destinationId: STUDIO_TRACKS[0].destination },
    ]);
    expect(firstBounce.options).toMatchObject({ numChannels: 2, sampleRate: 48000 });
    expect(firstBounce.options.totalFrames).toBeGreaterThan(0);

    // The active step produced MIDI note events through the static factory.
    expect(wasmMock.Project.midiNoteOn).toHaveBeenCalled();
    expect(wasmMock.Project.midiNoteOff).toHaveBeenCalled();

    // Stem views are sliced to the report's bucketCount (not a hand-derived length).
    expect(wasmMock.waveformPeaks).toHaveBeenCalledTimes(STUDIO_TRACKS.length);
    expect(engine.stemViews.value).toHaveLength(STUDIO_TRACKS.length);
    for (const view of engine.stemViews.value) {
      expect(view.min).toHaveLength(BUCKET_COUNT);
      expect(view.max).toHaveLength(BUCKET_COUNT);
    }
  });

  it('exports a WAV blob, skipping muted tracks and auto-deriving the tail length', async () => {
    const engine = await loadEngine();
    await engine.start();
    engine.setTrackMute(1, true);

    const blob = engine.exportWav(defaultPattern(), 120);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob?.type).toBe('audio/wav');

    // Export bounces the non-muted tracks only, without a fixed totalFrames.
    const exportBounces = wasmMock.Project.instances.flatMap((p) => p.bounces);
    expect(exportBounces.length).toBe(STUDIO_TRACKS.length - 1);
    for (const bounce of exportBounces) {
      expect(bounce.options).toEqual({ numChannels: 2, sampleRate: 48000 });
      expect(bounce.options.totalFrames).toBeUndefined();
    }
  });
});
