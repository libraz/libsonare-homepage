import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildSynthProcessorSource,
  SYNTH_CHANNEL,
  SYNTH_DESTINATION,
  SYNTH_GROUP,
  useSynthEngine,
} from '@/composables/useSynthEngine';

const source = buildSynthProcessorSource('/wasm/sonare.js');

describe('buildSynthProcessorSource', () => {
  it('static-imports the emscripten factory from the given url', () => {
    expect(source).toContain("import createModule from '/wasm/sonare.js';");
  });

  it('constructs and prepares the native RealtimeEngine', () => {
    expect(source).toContain('this.engine = new mod.RealtimeEngine(sampleRate, BLOCK, 1024, 1024)');
    expect(source).toContain('this.engine.prepareChannels(CHANNELS, BLOCK)');
    expect(source).toContain('this.engine.getChannelBuffer(ch, BLOCK)');
  });

  it('binds the patch-driven synth with the native (destination, patch) arg order', () => {
    expect(source).toContain('this.engine.setSynthInstrument(DEST, this.pendingPatch)');
    expect(source).toContain('this.engine.setSynthInstrument(DEST, msg.patch)');
    expect(source).toContain('this.engine.setMidiInputSource(DEST)');
  });

  it('forwards MIDI commands through the native input queue', () => {
    expect(source).toContain(
      'this.engine.pushMidiInputNoteOn(GROUP, CHANNEL, msg.note, msg.velocity, 0)',
    );
    expect(source).toContain('this.engine.pushMidiInputNoteOff(GROUP, CHANNEL, msg.note, 0, 0)');
    expect(source).toContain(
      'this.engine.pushMidiInputCc(GROUP, CHANNEL, msg.controller, msg.value, 0)',
    );
    expect(source).toContain('this.engine.pushMidiPanic(-1)');
  });

  it('renders via processPrepared and re-acquires heap views after memory growth', () => {
    expect(source).toContain('this.engine.processPrepared(frames)');
    // The detached-buffer guard re-fetches channel views inside process().
    expect(source).toContain('(this.channelBuffers[0]?.byteLength ?? 0) === 0');
  });

  it('guards against builds without the realtime engine and reports readiness/errors', () => {
    expect(source).toContain(
      "throw new Error('RealtimeEngine is not available in this WASM build')",
    );
    expect(source).toContain("this.port.postMessage({ type: 'ready' })");
    expect(source).toContain("this.port.postMessage({ type: 'error', error: String(err) })");
  });

  it('registers the synth processor and inlines the shared destination constants', () => {
    expect(source).toContain("registerProcessor('libsonare-synth', LibsonareSynthProcessor)");
    expect(source).toContain(`const DEST = ${SYNTH_DESTINATION};`);
    expect(source).toContain(`const GROUP = ${SYNTH_GROUP};`);
    expect(source).toContain(`const CHANNEL = ${SYNTH_CHANNEL};`);
  });
});

class AnalyserMock {
  fftSize = 0;
  smoothingTimeConstant = 0;
  connect = vi.fn();
  disconnect = vi.fn();
}

class AudioContextMock {
  static instances: AudioContextMock[] = [];
  state = 'suspended';
  destination = {};
  onstatechange: (() => void) | null = null;
  audioWorklet = { addModule: vi.fn(async () => undefined) };
  createAnalyser = vi.fn(() => new AnalyserMock());
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

class AudioWorkletNodeMock {
  static instances: AudioWorkletNodeMock[] = [];
  port: {
    onmessage: ((e: { data: unknown }) => void) | null;
    postMessage: ReturnType<typeof vi.fn>;
  } = { onmessage: null, postMessage: vi.fn() };
  connect = vi.fn();
  disconnect = vi.fn();
  constructor() {
    AudioWorkletNodeMock.instances.push(this);
  }
}

/** Flush the queued microtasks so an un-awaited start() reaches its next await. */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve));
}

describe('useSynthEngine lifecycle', () => {
  let originalAudioContext: typeof globalThis.AudioContext;
  let originalWorkletNode: typeof globalThis.AudioWorkletNode;
  let originalFetch: typeof globalThis.fetch;
  let originalCreateObjectURL: typeof URL.createObjectURL;
  let originalRevokeObjectURL: typeof URL.revokeObjectURL;
  let revokeSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    AudioContextMock.instances.length = 0;
    AudioWorkletNodeMock.instances.length = 0;
    originalAudioContext = globalThis.AudioContext;
    originalWorkletNode = globalThis.AudioWorkletNode;
    originalFetch = globalThis.fetch;
    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;
    revokeSpy = vi.fn();
    // @ts-expect-error focused test mock
    globalThis.AudioContext = AudioContextMock;
    // @ts-expect-error focused test mock
    globalThis.AudioWorkletNode = AudioWorkletNodeMock;
    globalThis.fetch = vi.fn(async () => ({
      arrayBuffer: async () => new ArrayBuffer(8),
    })) as unknown as typeof fetch;
    URL.createObjectURL = vi.fn(() => 'blob:mock-synth-module');
    URL.revokeObjectURL = revokeSpy as unknown as typeof URL.revokeObjectURL;
  });

  afterEach(() => {
    globalThis.AudioContext = originalAudioContext;
    globalThis.AudioWorkletNode = originalWorkletNode;
    globalThis.fetch = originalFetch;
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it('resolves start() once the worklet posts ready', async () => {
    const engine = useSynthEngine('/wasm/sonare.js', '/wasm/sonare.wasm');
    const startPromise = engine.start('e-piano');
    await flush();
    const node = AudioWorkletNodeMock.instances.at(-1);
    expect(node).toBeDefined();
    node?.port.onmessage?.({ data: { type: 'ready' } });

    expect(await startPromise).toBe(true);
    expect(engine.ready.value).toBe(true);
    expect(engine.starting.value).toBe(false);
  });

  it('settles a pending start() when disposed before the worklet is ready', async () => {
    const engine = useSynthEngine('/wasm/sonare.js', '/wasm/sonare.wasm');
    const startPromise = engine.start('e-piano');
    // start() is now parked on the ready wait; 'ready' never arrives.
    await flush();
    expect(AudioWorkletNodeMock.instances).toHaveLength(1);

    const disposePromise = engine.dispose();
    // dispose() must settle the ready wait so start() returns instead of hanging.
    expect(await startPromise).toBe(false);
    await disposePromise;
    expect(engine.ready.value).toBe(false);
    expect(engine.starting.value).toBe(false);
  });

  it('does not hang when start() runs after a dispose and can be re-armed', async () => {
    const engine = useSynthEngine('/wasm/sonare.js', '/wasm/sonare.wasm');
    await engine.dispose();

    const startPromise = engine.start('e-piano');
    await flush();
    const node = AudioWorkletNodeMock.instances.at(-1);
    node?.port.onmessage?.({ data: { type: 'ready' } });

    expect(await startPromise).toBe(true);
    expect(engine.ready.value).toBe(true);
  });

  it('revokes the blob worklet URL on dispose', async () => {
    const engine = useSynthEngine('/wasm/sonare.js', '/wasm/sonare.wasm');
    const startPromise = engine.start('e-piano');
    await flush();
    AudioWorkletNodeMock.instances.at(-1)?.port.onmessage?.({ data: { type: 'ready' } });
    await startPromise;

    await engine.dispose();
    expect(revokeSpy).toHaveBeenCalledWith('blob:mock-synth-module');
    expect(AudioContextMock.instances[0].close).toHaveBeenCalled();
  });
});
