import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BAR_PPQ, defaultPattern, STUDIO_TRACKS } from '@/components/studio/studioCopy';

const BUCKET_COUNT = 24;

const wasmMock = vi.hoisted(() => {
  class ProjectMock {
    static instances: ProjectMock[] = [];
    static midiNoteOn = vi.fn((...args: unknown[]) => ({ kind: 'on', args }));
    static midiNoteOff = vi.fn((...args: unknown[]) => ({ kind: 'off', args }));
    static midiProgram = vi.fn((...args: unknown[]) => ({ kind: 'program', args }));
    deleted = false;
    bounces: Array<{ instruments: unknown; options: any }> = [];
    setSampleRate = vi.fn();
    setTempoSegments = vi.fn();
    setTrackMidiDestination = vi.fn();
    setMidiEvents = vi.fn();
    addMidiClip = vi.fn(() => ({ trackId: 1, clipId: 2 }));
    exportSmf = vi.fn(() => new Uint8Array([0x4d, 0x54, 0x68, 0x64]));
    bounceWithSynthInstrument = vi.fn((instruments: unknown, options: any) => {
      this.bounces.push({ instruments, options });
      const frames = options.totalFrames ?? 64;
      // A constant non-zero stem makes gain handling observable in the WAV.
      return new Float32Array(frames * 2).fill(0.5);
    });
    delete = vi.fn(() => {
      this.deleted = true;
    });
    constructor() {
      ProjectMock.instances.push(this);
    }
  }
  class RealtimeEngineMock {
    static instances: RealtimeEngineMock[] = [];
    destroy = vi.fn();
    constructor(
      public sampleRate: number,
      public blockSize: number,
    ) {
      RealtimeEngineMock.instances.push(this);
    }
  }
  return {
    Project: ProjectMock,
    RealtimeEngine: RealtimeEngineMock,
    init: vi.fn(async () => undefined),
    version: vi.fn(() => '1.3.3-test'),
    engineAbiVersion: vi.fn(() => 3),
    EXPECTED_ENGINE_ABI_VERSION: 3,
    waveformPeaks: vi.fn((_samples: Float32Array, channels: number, _opts: unknown) => ({
      min: new Float32Array(channels * BUCKET_COUNT),
      max: new Float32Array(channels * BUCKET_COUNT),
      channels,
      bucketCount: BUCKET_COUNT,
      samplesPerBucket: 64,
    })),
  };
});

const facadeMock = vi.hoisted(() => {
  const state: { meterCb: ((meter: Record<string, number>) => void) | null } = { meterCb: null };
  const facade = {
    node: { connect: vi.fn(), disconnect: vi.fn() },
    transport: {
      play: vi.fn(() => true),
      stop: vi.fn(() => true),
      seekPpq: vi.fn(() => true),
      setLoop: vi.fn(() => true),
    },
    setTempoSegments: vi.fn(),
    setTrackLanes: vi.fn(),
    setSynthInstrument: vi.fn(),
    setMidiClips: vi.fn(),
    setStripGain: vi.fn(() => true),
    setSoloMute: vi.fn(() => true),
    pushMidiNoteOn: vi.fn(),
    pushMidiNoteOff: vi.fn(),
    pushMidiPanic: vi.fn(),
    onMeter: vi.fn((cb: (meter: Record<string, number>) => void) => {
      state.meterCb = cb;
      return () => undefined;
    }),
    destroy: vi.fn(),
  };
  return {
    facade,
    state,
    create: vi.fn(async () => facade),
  };
});

vi.mock('@/wasm/index.js', () => wasmMock);
vi.mock('@/wasm/worklet.js', () => ({ SonareEngine: { create: facadeMock.create } }));

class AudioContextMock {
  static instances: AudioContextMock[] = [];
  state = 'suspended';
  currentTime = 0;
  sampleRate = 48000;
  destination = {};
  resume = vi.fn(async () => {
    this.state = 'running';
  });
  close = vi.fn(async () => {
    this.state = 'closed';
  });
  constructor() {
    AudioContextMock.instances.push(this);
  }
}

describe('useStudioEngine', () => {
  let originalAudioContext: typeof globalThis.AudioContext;
  let originalFetch: typeof globalThis.fetch;
  let originalCreateObjectURL: typeof URL.createObjectURL;

  beforeEach(() => {
    vi.clearAllMocks();
    wasmMock.Project.instances.length = 0;
    wasmMock.RealtimeEngine.instances.length = 0;
    AudioContextMock.instances.length = 0;
    originalAudioContext = globalThis.AudioContext;
    originalFetch = globalThis.fetch;
    originalCreateObjectURL = URL.createObjectURL;
    // @ts-expect-error focused test mock
    globalThis.AudioContext = AudioContextMock;
    globalThis.fetch = vi.fn(async () => ({
      arrayBuffer: async () => new ArrayBuffer(8),
    })) as unknown as typeof fetch;
    URL.createObjectURL = vi.fn(() => 'blob:mock-worklet-module');
  });

  afterEach(() => {
    globalThis.AudioContext = originalAudioContext;
    globalThis.fetch = originalFetch;
    URL.createObjectURL = originalCreateObjectURL;
  });

  async function loadEngine() {
    const { useStudioEngine } = await import('@/composables/useStudioEngine');
    return useStudioEngine('/wasm/sonare.js', '/wasm/sonare.wasm');
  }

  it('boots the WASM module and the engine worklet facade', async () => {
    const engine = await loadEngine();
    const ok = await engine.start();
    expect(ok).toBe(true);
    expect(wasmMock.init).toHaveBeenCalledTimes(1);
    expect(engine.ready.value).toBe(true);
    expect(engine.libVersion.value).toBe('1.3.3-test');

    // The facade is created against the page AudioContext with the engine ABI
    // sourced from the already-initialized index.js module.
    expect(facadeMock.create).toHaveBeenCalledTimes(1);
    const [, options] = facadeMock.create.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(options.engineAbiVersion).toBe(3);
    expect(options.expectedEngineAbiVersion).toBe(3);
    expect(options.offlineEngine).toBeInstanceOf(wasmMock.RealtimeEngine);

    // Lanes are declared 1-based and each track binds its synth preset.
    expect(facadeMock.facade.setTrackLanes).toHaveBeenCalledWith([1, 2, 3]);
    for (let i = 0; i < STUDIO_TRACKS.length; i++) {
      expect(facadeMock.facade.setSynthInstrument).toHaveBeenCalledWith(
        i + 1,
        STUDIO_TRACKS[i].preset,
      );
    }
    expect(facadeMock.facade.transport.setLoop).toHaveBeenCalledWith(0, BAR_PPQ, true);
    expect(facadeMock.facade.node.connect).toHaveBeenCalled();
  });

  it('compiles the pattern into looping MIDI clips and refreshes stem views', async () => {
    const engine = await loadEngine();
    await engine.start();

    const pattern = defaultPattern();
    pattern[0][0][0] = true; // one active step on the lead track
    engine.rebuild(pattern, 120);

    // The schedule is replaced in place; clip destination ids equal track ids.
    expect(facadeMock.facade.setMidiClips).toHaveBeenCalled();
    const clips = facadeMock.facade.setMidiClips.mock.lastCall?.[0] as Array<
      Record<string, unknown>
    >;
    expect(clips.length).toBeGreaterThan(0);
    for (const clip of clips) {
      expect(clip.destinationId).toBe(clip.trackId);
      expect(clip.loop).toBe(true);
      expect(clip.loopLengthSamples).toBe(clip.lengthSamples);
      const events = clip.events as Array<{ renderFrame: number; word0: number }>;
      expect(events.length).toBeGreaterThan(0);
      for (const event of events) {
        expect(event.renderFrame).toBeGreaterThanOrEqual(0);
        expect(event.renderFrame).toBeLessThan(clip.lengthSamples as number);
      }
    }

    // Stem views stay offline display renders: one Project per track, disposed.
    expect(wasmMock.Project.instances).toHaveLength(STUDIO_TRACKS.length);
    for (const project of wasmMock.Project.instances) expect(project.deleted).toBe(true);
    expect(wasmMock.waveformPeaks).toHaveBeenCalledTimes(STUDIO_TRACKS.length);
    expect(engine.stemViews.value).toHaveLength(STUDIO_TRACKS.length);
    for (const view of engine.stemViews.value) {
      expect(view.min).toHaveLength(BUCKET_COUNT);
      expect(view.max).toHaveLength(BUCKET_COUNT);
    }
  });

  it('routes faders, mutes, and auditions through the engine facade', async () => {
    const engine = await loadEngine();
    await engine.start();

    engine.setTrackGain(0, 0.5);
    expect(facadeMock.facade.setStripGain).toHaveBeenCalledWith(1, 20 * Math.log10(0.5));

    engine.setMasterGain(1);
    expect(facadeMock.facade.setStripGain).toHaveBeenCalledWith('master', 0);

    engine.setTrackMute(2, true);
    expect(facadeMock.facade.setSoloMute).toHaveBeenCalledWith(3, false, true);

    engine.audition(1, 0);
    expect(facadeMock.facade.pushMidiNoteOn).toHaveBeenCalledWith(
      2,
      0,
      0,
      STUDIO_TRACKS[1].rows[0].note,
      STUDIO_TRACKS[1].velocity,
    );
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

  it('exports a Standard MIDI File on GM channels, skipping muted tracks', async () => {
    const engine = await loadEngine();
    await engine.start();
    engine.setTrackMute(1, true);

    const blob = engine.exportMidi(defaultPattern(), 120);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob?.type).toBe('audio/midi');

    // A single Project carries one MIDI clip per non-muted track, then the
    // native SMF writer serializes it and the project is disposed.
    expect(wasmMock.Project.instances).toHaveLength(1);
    const project = wasmMock.Project.instances[0];
    expect(project.addMidiClip).toHaveBeenCalledTimes(STUDIO_TRACKS.length - 1);
    expect(project.setMidiEvents).toHaveBeenCalledTimes(STUDIO_TRACKS.length - 1);
    expect(project.exportSmf).toHaveBeenCalledTimes(1);
    expect(project.deleted).toBe(true);

    // Pitched tracks get a GM program change; drums ride channel 9 bare.
    expect(wasmMock.Project.midiProgram).toHaveBeenCalledWith(0, 0, 0, 81);
    expect(wasmMock.Project.midiProgram).not.toHaveBeenCalledWith(0, 0, 9, expect.anything());
    const channels = new Set(wasmMock.Project.midiNoteOn.mock.calls.map((call) => call[2]));
    expect(channels).toEqual(new Set([0, 9]));
  });

  it('applies the master fader to the WAV bounce', async () => {
    const engine = await loadEngine();
    await engine.start();
    for (let i = 0; i < STUDIO_TRACKS.length; i++) engine.setTrackGain(i, 1);
    engine.setMasterGain(0.5);

    const blob = engine.exportWav(defaultPattern(), 120);
    expect(blob).toBeInstanceOf(Blob);
    const view = new DataView(await (blob as Blob).arrayBuffer());
    // Stems are a constant 0.5 per track; 3 tracks × unity faders × 0.5 master.
    const expected = Math.trunc(0.5 * 3 * 0.5 * 0x7fff);
    expect(view.getInt16(44, true)).toBe(expected);
  });

  it('clears every meter on stop', async () => {
    const rafQueue: FrameRequestCallback[] = [];
    const rafSpy = vi
      .spyOn(globalThis, 'requestAnimationFrame')
      .mockImplementation((cb: FrameRequestCallback) => {
        rafQueue.push(cb);
        return rafQueue.length;
      });
    const cafSpy = vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => undefined);
    try {
      const engine = await loadEngine();
      await engine.start();
      engine.play();
      // Engine telemetry arrives, then the next UI frame surfaces it.
      facadeMock.state.meterCb?.({ targetId: 0, peakDbL: 0, peakDbR: 0 });
      facadeMock.state.meterCb?.({ targetId: 1, peakDbL: -6, peakDbR: -6 });
      rafQueue.splice(0).forEach((cb) => {
        cb(0);
      });
      expect(engine.masterLevel.value).toBeGreaterThan(0);
      expect(engine.levels.value[0]).toBeGreaterThan(0);

      engine.stop();
      expect(engine.masterLevel.value).toBe(0);
      expect(engine.levels.value.every((level) => level === 0)).toBe(true);
      expect(engine.position.value).toBe(0);
    } finally {
      rafSpy.mockRestore();
      cafSpy.mockRestore();
    }
  });

  it('tears down the facade, meters, and audio context on dispose', async () => {
    const engine = await loadEngine();
    await engine.start();
    await engine.dispose();

    expect(facadeMock.facade.destroy).toHaveBeenCalledTimes(1);
    expect(AudioContextMock.instances[0].close).toHaveBeenCalled();
    expect(engine.ready.value).toBe(false);
  });

  it('cancels an in-flight start when disposed mid-boot', async () => {
    facadeMock.create.mockImplementationOnce(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return facadeMock.facade;
    });
    const engine = await loadEngine();
    const startPromise = engine.start();
    // Let start() progress into the awaited SonareEngine.create call.
    await new Promise((resolve) => setTimeout(resolve, 1));
    const disposePromise = engine.dispose();

    expect(await startPromise).toBe(false);
    await disposePromise;
    expect(engine.ready.value).toBe(false);
    // The late-arriving facade is destroyed, never connected, and the
    // AudioContext does not survive the teardown.
    expect(facadeMock.facade.destroy).toHaveBeenCalled();
    expect(facadeMock.facade.node.connect).not.toHaveBeenCalled();
    for (const ctx of AudioContextMock.instances) expect(ctx.close).toHaveBeenCalled();
  });
});
