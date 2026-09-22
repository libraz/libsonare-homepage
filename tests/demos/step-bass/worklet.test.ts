import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInThisContext } from 'node:vm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyCompiled } from '@/demos/step-bass/stepBassApply';
import {
  MASTER_FADER_PARAM_ID,
  STEP_BASS_ARTICULATION,
  STEP_BASS_BASE_PATCH,
  STEP_BASS_CHANNEL,
  STEP_BASS_TRACK_ID,
} from '@/demos/step-bass/stepBassPatch';
import {
  buildStepBassProcessorSource,
  METER_BLOCK_INTERVAL,
  STEP_BASS_PROCESSOR,
} from '@/demos/step-bass/stepBassProcessor';
import type { CompiledPattern } from '@/demos/step-bass/stepBassTypes';
import { useStepBassEngine } from '@/demos/step-bass/useStepBassEngine';
import { masterLimiterStripJson } from '@/utils/masterLimiter';
import { noteOffWord, noteOnWord } from '@/utils/ump';

const SAMPLE_RATE = 48_000;
const BLOCK = 128;
const BPM = 120;
/** One bar of four quarters at 120 BPM. */
const LOOP_FRAMES = 96_000;
/** Sixteen steps fill the bar. */
const STEP_FRAMES = LOOP_FRAMES / 16;
const DESTINATION = 0;
/** Automation ids the fake engine hands out, keyed by parameter name. */
const PARAM_IDS: Record<string, number> = {
  cutoffHz: 10,
  resonanceQ: 11,
  envToCutoffCents: 12,
  pitchOffsetCents: 13,
  glideMs: 20,
  filterDecayMs: 21,
  velToCutoffCents: 22,
};

function compiledFixture(): CompiledPattern {
  return {
    sampleRate: SAMPLE_RATE,
    bpm: BPM,
    patch: { ...STEP_BASS_BASE_PATCH },
    articulation: 'mono-legato',
    clip: {
      id: 1,
      trackId: STEP_BASS_TRACK_ID,
      destinationId: DESTINATION,
      startSample: 0,
      startPpq: 0,
      lengthSamples: LOOP_FRAMES,
      events: [
        { renderFrame: 0, word0: noteOnWord(45, 64) },
        { renderFrame: STEP_FRAMES - 1, word0: noteOffWord(45) },
        { renderFrame: STEP_FRAMES * 8, word0: noteOnWord(52, 127) },
        { renderFrame: LOOP_FRAMES - 1, word0: noteOffWord(52) },
      ],
    },
    loop: { startPpq: 0, endPpq: 4 },
    lanes: [
      { param: 'glideMs', points: [{ ppq: 0, value: 0 }] },
      { param: 'filterDecayMs', points: [{ ppq: 0, value: 300 }] },
    ],
    knobs: {
      cutoffHz: 700,
      resonanceQ: 6.4,
      envToCutoffCents: 2400,
      pitchOffsetCents: 0,
      faderDb: 24,
    },
    masterStripJson: masterLimiterStripJson(),
  };
}

const source = buildStepBassProcessorSource('/wasm/sonare.js');

// ------------------------------------------------------------------ source

describe('buildStepBassProcessorSource', () => {
  it('embeds the shared apply function verbatim, so live and export are one path', () => {
    expect(source).toContain(applyCompiled.toString());
    expect(source).toContain("applyCompiled(this.engine, compiled, 'native')");
  });

  it('static-imports the emscripten factory and registers the processor', () => {
    expect(source).toContain("import createModule from '/wasm/sonare.js';");
    expect(source).toContain(`registerProcessor('${STEP_BASS_PROCESSOR}'`);
    expect(source).toContain('new mod.RealtimeEngine(sampleRate, BLOCK, 1024, 1024)');
  });

  it('renders no audio between binding an instrument and asking for articulation', () => {
    // Binding resets the destination to poly, so a block rendered in that gap
    // is the block where the slide silently stopped working.
    const binds = [...source.matchAll(/setSynthInstrument/g)].map((m) => m.index ?? -1);
    expect(binds.length).toBeGreaterThan(0);
    for (const at of binds) {
      const articulation = source.indexOf('setArticulation', at);
      expect(articulation).toBeGreaterThan(at);
      expect(source.slice(at, articulation)).not.toContain('processPrepared');
    }
  });

  it('handles every command the message union declares', () => {
    const types = readFileSync(resolve('src/demos/step-bass/stepBassTypes.ts'), 'utf8');
    const start = types.indexOf('export type StepBassCommand =');
    expect(start).toBeGreaterThan(-1);
    const union = types.slice(start, types.indexOf('\n\n', start));
    const commands = [...union.matchAll(/\btype:\s*'([a-z]+)'/g)].map((m) => m[1]);
    // A union that stopped parsing would let this pass on an empty list.
    expect(new Set(commands).size).toBe(commands.length);
    expect(commands.length).toBeGreaterThanOrEqual(8);
    expect(commands).not.toContain('meter');
    for (const command of commands) {
      expect(source).toContain(`case '${command}':`);
    }
  });
});

// ------------------------------------------------------------- fake engine

class FakeEngine {
  calls: { method: string; args: unknown[] }[] = [];
  transport = { playing: false, samplePosition: 0 };
  private buffers: Float32Array[] = [];

  private record(method: string, ...args: unknown[]): void {
    this.calls.push({ method, args });
  }

  names(): string[] {
    return this.calls.map((c) => c.method);
  }

  argsOf(method: string): unknown[][] {
    return this.calls.filter((c) => c.method === method).map((c) => c.args);
  }

  prepareChannels(channels: number, frames: number) {
    this.record('prepareChannels', channels, frames);
    for (let ch = 0; ch < channels; ch++) this.buffers[ch] = new Float32Array(frames);
  }
  getChannelBuffer(channel: number, frames: number) {
    this.record('getChannelBuffer', channel, frames);
    this.buffers[channel] ??= new Float32Array(frames);
    return this.buffers[channel];
  }
  setMasterStripJson(json: string) {
    this.record('setMasterStripJson', json);
  }
  setTrackLanes(lanes: number[]) {
    this.record('setTrackLanes', lanes);
  }
  setSynthInstrument(a: unknown, b: unknown) {
    this.record('setSynthInstrument', a, b);
  }
  setArticulation(destination: number, channel: number, articulation: string) {
    this.record('setArticulation', destination, channel, articulation);
  }
  setTempoSegments(segments: unknown[]) {
    this.record('setTempoSegments', segments);
  }
  setMidiClips(clips: unknown[]) {
    this.record('setMidiClips', clips);
  }
  resolveInstrumentAutomationId(_destination: number, name: string) {
    this.record('resolveInstrumentAutomationId', name);
    return PARAM_IDS[name] ?? -1;
  }
  setAutomationLane(id: number, points: unknown[]) {
    this.record('setAutomationLane', id, points);
  }
  setParameterSmoothed(id: number, value: number) {
    this.record('setParameterSmoothed', id, value);
  }
  setLoop(startPpq: number, endPpq: number, enabled?: boolean) {
    this.record('setLoop', startPpq, endPpq, enabled);
  }
  pushMidiPanic(frame: number) {
    this.record('pushMidiPanic', frame);
  }
  play() {
    this.record('play');
    this.transport.playing = true;
  }
  stop() {
    this.record('stop');
    this.transport.playing = false;
  }
  seekPpq(ppq: number) {
    this.record('seekPpq', ppq);
  }
  getTransportState() {
    return { ...this.transport };
  }
  processPrepared(frames: number) {
    this.record('processPrepared', frames);
    for (const buffer of this.buffers) buffer.fill(0.5, 0, frames);
  }
}

interface FakePort {
  onmessage: ((e: { data: unknown }) => void) | null;
  postMessage(msg: unknown): void;
  sent: Record<string, unknown>[];
}

/**
 * Run the generated source and instantiate the processor it registers, with the
 * worklet globals supplied — so these tests exercise the audio thread's own
 * code rather than a paraphrase of it.
 */
async function bootProcessor(engine: FakeEngine, compiled: CompiledPattern) {
  const body = source.replace(/^import createModule from '[^']*';$/m, '');
  const registry: Record<string, new (options: unknown) => unknown> = {};
  class ProcessorBase {
    port: FakePort = {
      onmessage: null,
      sent: [],
      postMessage(msg: unknown) {
        this.sent.push(msg as Record<string, unknown>);
      },
    };
  }
  const globals = globalThis as unknown as Record<string, unknown>;
  globals.AudioWorkletProcessor = ProcessorBase;
  globals.registerProcessor = (name: string, cls: new (options: unknown) => unknown) => {
    registry[name] = cls;
  };
  globals.sampleRate = SAMPLE_RATE;
  globals.currentTime = 1.5;
  globals.createModule = async () => ({
    RealtimeEngine: function RealtimeEngine() {
      return engine;
    },
  });
  // The processor source is an ES module; wrapped in a function it runs here,
  // and the wrapper keeps its declarations out of the shared global scope.
  runInThisContext(`(function () {${body}\n})()`);

  const Processor = registry[STEP_BASS_PROCESSOR];
  expect(Processor).toBeDefined();
  const instance = new Processor({
    processorOptions: { wasmBinary: new ArrayBuffer(8), compiled },
  }) as ProcessorBase & { process(inputs: unknown, outputs: Float32Array[][]): boolean };
  for (let i = 0; i < 10; i++) await Promise.resolve();

  return {
    engine,
    port: instance.port,
    send: (message: unknown) => instance.port.onmessage?.({ data: message }),
    render: (blocks = 1) => {
      for (let i = 0; i < blocks; i++) {
        instance.process({}, [[new Float32Array(BLOCK), new Float32Array(BLOCK)]]);
      }
    },
  };
}

describe('step bass processor', () => {
  it('boots by applying the pattern and reports ready', async () => {
    const engine = new FakeEngine();
    const handle = await bootProcessor(engine, compiledFixture());

    expect(handle.port.sent.map((m) => m.type)).toContain('ready');
    const names = engine.names();
    expect(names.indexOf('setMasterStripJson')).toBeLessThan(names.indexOf('setSynthInstrument'));
    expect(names).toContain('setMidiClips');
    expect(names).toContain('setLoop');
    // The transport runs the loop, and a boot opens stopped.
    expect(names.indexOf('play')).toBeLessThan(names.lastIndexOf('stop'));
    expect(engine.transport.playing).toBe(false);
  });

  it('binds the instrument in the native argument order and re-asks for the slur', async () => {
    const engine = new FakeEngine();
    await bootProcessor(engine, compiledFixture());

    const [destination, patch] = engine.argsOf('setSynthInstrument')[0];
    expect(destination).toBe(DESTINATION);
    expect(patch).toMatchObject({ waveform: 'saw', filterModel: 'diode-ladder' });

    const names = engine.names();
    const bind = names.indexOf('setSynthInstrument');
    expect(names[bind + 1]).toBe('setArticulation');
    expect(engine.argsOf('setArticulation')[0]).toEqual([
      DESTINATION,
      STEP_BASS_CHANNEL,
      STEP_BASS_ARTICULATION,
    ]);
  });

  it('applies a knob on arrival rather than queueing it to a step boundary', async () => {
    const engine = new FakeEngine();
    const handle = await bootProcessor(engine, compiledFixture());
    engine.calls.length = 0;

    handle.send({ type: 'param', param: 'cutoffHz', value: 1200 });
    handle.send({ type: 'fader', faderDb: 18 });
    expect(engine.argsOf('setParameterSmoothed')).toEqual([
      [PARAM_IDS.cutoffHz, 1200],
      [MASTER_FADER_PARAM_ID, 18],
    ]);
  });

  it('re-sends lanes and clips without waiting for a boundary', async () => {
    const engine = new FakeEngine();
    const handle = await bootProcessor(engine, compiledFixture());
    engine.calls.length = 0;

    handle.send({
      type: 'lanes',
      lanes: [{ param: 'filterDecayMs', points: [{ ppq: 0, value: 800 }] }],
    });
    expect(engine.argsOf('setAutomationLane')[0][0]).toBe(PARAM_IDS.filterDecayMs);

    const clip = compiledFixture().clip;
    handle.send({ type: 'clip', clip });
    expect(engine.argsOf('setMidiClips')[0][0]).toEqual([clip]);
  });

  it('changes tempo by re-mapping the clip and seeking to keep the phase', async () => {
    const engine = new FakeEngine();
    const handle = await bootProcessor(engine, compiledFixture());
    engine.calls.length = 0;

    const clip = compiledFixture().clip;
    handle.send({ type: 'tempo', bpm: 160, clip, seekPpq: 1.5 });
    expect(engine.argsOf('setTempoSegments')[0][0]).toEqual([{ startPpq: 0, bpm: 160 }]);
    expect(engine.argsOf('seekPpq')[0]).toEqual([1.5]);
  });

  it('stops the transport with a panic and a rewind', async () => {
    const engine = new FakeEngine();
    const handle = await bootProcessor(engine, compiledFixture());
    engine.calls.length = 0;

    handle.send({ type: 'transport', action: 'play' });
    expect(engine.transport.playing).toBe(true);
    handle.send({ type: 'transport', action: 'stop' });
    expect(engine.names()).toEqual(['play', 'stop', 'pushMidiPanic', 'seekPpq']);
    expect(engine.argsOf('pushMidiPanic')[0]).toEqual([-1]);
  });

  it('defers a waveform change to a step boundary that speaks a note', async () => {
    const engine = new FakeEngine();
    const handle = await bootProcessor(engine, compiledFixture());
    handle.send({ type: 'transport', action: 'play' });
    engine.transport = { playing: true, samplePosition: 20_000 };
    engine.calls.length = 0;

    const patch = { ...STEP_BASS_BASE_PATCH, waveform: 'square' };
    handle.send({ type: 'waveform', patch });
    // Arrival alone must not rebind: that would cut the sounding note.
    expect(engine.names()).not.toContain('setSynthInstrument');

    // Mid-step, with the next note-on still half a bar away.
    handle.render();
    expect(engine.names()).not.toContain('setSynthInstrument');

    // The block that reaches the note-on at step 8 is where it rebinds.
    engine.calls.length = 0;
    engine.transport.samplePosition = STEP_FRAMES * 8 - 8;
    handle.render();
    const names = engine.names();
    const bind = names.indexOf('setSynthInstrument');
    expect(bind).toBeGreaterThan(-1);
    expect(engine.argsOf('setSynthInstrument')[0]).toEqual([DESTINATION, patch]);
    expect(names[bind + 1]).toBe('setArticulation');
    // ...and ahead of the block, so that note already speaks in the new shape.
    expect(names.indexOf('processPrepared')).toBeGreaterThan(bind);

    // One rebind only: the next boundary must not apply it again.
    engine.calls.length = 0;
    engine.transport.samplePosition = LOOP_FRAMES - 8;
    handle.render();
    expect(engine.names()).not.toContain('setSynthInstrument');
  });

  it('rebinds immediately while the transport is stopped', async () => {
    const engine = new FakeEngine();
    const handle = await bootProcessor(engine, compiledFixture());
    engine.calls.length = 0;

    handle.send({ type: 'waveform', patch: { ...STEP_BASS_BASE_PATCH, waveform: 'square' } });
    handle.render();
    expect(engine.names()).toContain('setSynthInstrument');
  });

  it('stamps the meter with the transport position and the worklet clock', async () => {
    const engine = new FakeEngine();
    const handle = await bootProcessor(engine, compiledFixture());
    engine.transport = { playing: true, samplePosition: 4096 };
    handle.port.sent.length = 0;

    handle.render(METER_BLOCK_INTERVAL - 1);
    expect(handle.port.sent).toHaveLength(0);
    handle.render();

    const meter = handle.port.sent.at(-1) as Record<string, unknown>;
    expect(meter.type).toBe('meter');
    expect(meter.samplePosition).toBe(4096);
    expect(meter.playing).toBe(true);
    expect(meter.currentTime).toBe(1.5);
    expect(meter.peak).toBeCloseTo(0.5, 6);
    // Gain reduction is absent from the engine's telemetry; nothing claims it.
    expect(Object.keys(meter)).not.toContain('gainReductionDb');
  });
});

// -------------------------------------------------------------- composable

class AnalyserMock {
  fftSize = 0;
  smoothingTimeConstant = 0;
  connect = vi.fn();
  disconnect = vi.fn();
}

class AudioContextMock {
  static instances: AudioContextMock[] = [];
  state = 'suspended';
  sampleRate = SAMPLE_RATE;
  currentTime = 2;
  outputLatency = 0.01;
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
  onprocessorerror: (() => void) | null = null;
  connect = vi.fn();
  disconnect = vi.fn();
  constructor(
    _ctx: unknown,
    readonly name: string,
    readonly options: { processorOptions?: Record<string, unknown> },
  ) {
    AudioWorkletNodeMock.instances.push(this);
  }
}

/** Drain the microtask queue so an un-awaited start() reaches its next await. */
async function flush(): Promise<void> {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

describe('useStepBassEngine lifecycle', () => {
  let originalAudioContext: typeof globalThis.AudioContext;
  let originalWorkletNode: typeof globalThis.AudioWorkletNode;
  let originalFetch: typeof globalThis.fetch;
  let originalCreateObjectURL: typeof URL.createObjectURL;
  let originalRevokeObjectURL: typeof URL.revokeObjectURL;
  let originalRaf: typeof globalThis.requestAnimationFrame;
  let revokeSpy: ReturnType<typeof vi.fn>;
  let rafSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    AudioContextMock.instances.length = 0;
    AudioWorkletNodeMock.instances.length = 0;
    originalAudioContext = globalThis.AudioContext;
    originalWorkletNode = globalThis.AudioWorkletNode;
    originalFetch = globalThis.fetch;
    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;
    originalRaf = globalThis.requestAnimationFrame;
    revokeSpy = vi.fn();
    rafSpy = vi.fn(() => 0);
    // @ts-expect-error focused test mock
    globalThis.AudioContext = AudioContextMock;
    // @ts-expect-error focused test mock
    globalThis.AudioWorkletNode = AudioWorkletNodeMock;
    globalThis.fetch = vi.fn(async () => ({
      arrayBuffer: async () => new ArrayBuffer(8),
    })) as unknown as typeof fetch;
    URL.createObjectURL = vi.fn(() => 'blob:mock-step-bass-module');
    URL.revokeObjectURL = revokeSpy as unknown as typeof URL.revokeObjectURL;
    globalThis.requestAnimationFrame = rafSpy as unknown as typeof requestAnimationFrame;
  });

  afterEach(() => {
    globalThis.AudioContext = originalAudioContext;
    globalThis.AudioWorkletNode = originalWorkletNode;
    globalThis.fetch = originalFetch;
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    globalThis.requestAnimationFrame = originalRaf;
    vi.useRealTimers();
  });

  async function boot() {
    const engine = useStepBassEngine('/wasm/sonare.js', '/wasm/sonare.wasm');
    const startPromise = engine.start(compiledFixture());
    await flush();
    const node = AudioWorkletNodeMock.instances.at(-1);
    node?.port.onmessage?.({ data: { type: 'ready' } });
    expect(await startPromise).toBe(true);
    return { engine, node };
  }

  it('hands the compiled pattern to the processor at construction', async () => {
    const { engine, node } = await boot();
    expect(node?.name).toBe(STEP_BASS_PROCESSOR);
    expect(node?.options.processorOptions?.compiled).toMatchObject({ bpm: BPM });
    expect(engine.ready.value).toBe(true);
    expect(engine.analyser.value).not.toBeNull();
    await engine.dispose();
  });

  it('extrapolates the playhead from the meter stamp instead of asking the engine', async () => {
    const { engine, node } = await boot();
    const ctx = AudioContextMock.instances.at(-1);
    if (ctx) ctx.currentTime = 3;
    node?.port.onmessage?.({
      data: { type: 'meter', peak: 0.4, samplePosition: 4800, playing: true, currentTime: 2.5 },
    });

    expect(engine.meter.value.samplePosition).toBe(4800);
    // 3 - 2.5 - 0.01 s of output latency, at 48 kHz.
    expect(engine.playheadSamples()).toBeCloseTo(4800 + 0.49 * SAMPLE_RATE, 3);
    await engine.dispose();
  });

  it('leaves no listener and no timer behind, and boots again afterwards', async () => {
    const { engine, node } = await boot();
    const ctx = AudioContextMock.instances.at(-1);

    await engine.dispose();
    expect(node?.port.onmessage).toBeNull();
    expect(node?.onprocessorerror).toBeNull();
    expect(ctx?.onstatechange).toBeNull();
    expect(ctx?.close).toHaveBeenCalled();
    expect(revokeSpy).toHaveBeenCalledWith('blob:mock-step-bass-module');
    expect(engine.ready.value).toBe(false);
    expect(engine.running.value).toBe(false);
    expect(engine.meter.value.samplePosition).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    expect(rafSpy).not.toHaveBeenCalled();

    const second = engine.start(compiledFixture());
    await flush();
    AudioWorkletNodeMock.instances.at(-1)?.port.onmessage?.({ data: { type: 'ready' } });
    expect(await second).toBe(true);
    expect(AudioContextMock.instances).toHaveLength(2);
    await engine.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('settles a pending start() when disposed before the worklet is ready', async () => {
    const engine = useStepBassEngine('/wasm/sonare.js', '/wasm/sonare.wasm');
    const startPromise = engine.start(compiledFixture());
    await flush();
    expect(AudioWorkletNodeMock.instances).toHaveLength(1);

    const disposePromise = engine.dispose();
    expect(await startPromise).toBe(false);
    await disposePromise;
    expect(engine.ready.value).toBe(false);
    expect(engine.starting.value).toBe(false);
  });

  it('sends one command per panel change', async () => {
    const { engine, node } = await boot();
    node?.port.postMessage.mockClear();

    engine.setParam('cutoffHz', 900);
    engine.setFader(12);
    engine.setLanes([{ param: 'filterDecayMs', points: [{ ppq: 0, value: 500 }] }]);
    engine.setWaveform({ ...STEP_BASS_BASE_PATCH, waveform: 'square' });
    engine.play();
    engine.stop();

    const sent = node?.port.postMessage.mock.calls.map((c) => c[0].type) ?? [];
    expect(sent).toEqual(['param', 'fader', 'lanes', 'waveform', 'transport', 'transport']);
    await engine.dispose();
  });
});
