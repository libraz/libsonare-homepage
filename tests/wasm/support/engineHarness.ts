/**
 * Node-side harness for tests that drive the realtime engine the way the
 * browser does, without an AudioContext.
 *
 * - `createProcessorLoop` runs the real `SonareRealtimeEngineWorkletProcessor`
 *   from `worklet.js` against a stub transport and calls `process()` in
 *   128-frame quanta, as the audio thread would.
 * - `createFacadeLoopback` builds the real `SonareEngine` facade with a fake
 *   AudioWorkletNode whose port is wired to the processor wrapper that
 *   `registerSonareRealtimeEngineWorkletProcessor` registers, so message
 *   dispatch, initialisation and the ready handshake are the shipped code, not
 *   a re-implementation. Messages are structured-cloned (transfer lists
 *   honoured) and delivered asynchronously, and every queued message is
 *   delivered before each rendered quantum so renders are deterministic.
 * - `createRawEngine` is the plain `RealtimeEngine` from `index.js` that the
 *   export Worker uses.
 *
 * `worklet.js` and `index.js` each own a separate WASM module instance.
 */

/** Render quantum of an AudioWorklet. */
export const RENDER_QUANTUM = 128;
/** Sample rate the harness defaults to. */
export const DEFAULT_SAMPLE_RATE = 48_000;
/** Lane meter target id for a lane index (declaration order). */
export const laneMeterTarget = (laneIndex: number): number => laneIndex + 1;
/** Bus meter target id for a bus index (declaration order). */
export const busMeterTarget = (busIndex: number): number => 33 + busIndex;
/** Master meter target id. */
export const MASTER_METER_TARGET = 0;

/** Meter record the processor posts in postMessage mode. */
export interface MeterSnapshot {
  type: 'meter';
  targetId: number;
  frame: number;
  peakDbL: number;
  peakDbR: number;
  rmsDbL: number;
  rmsDbR: number;
  correlation: number;
  truePeakDbL: number;
  truePeakDbR: number;
  momentaryLufs: number;
  shortTermLufs: number;
  integratedLufs: number;
  gainReductionDb: number;
  inputPeakDbL: number;
  inputPeakDbR: number;
}

/** Stereo render result. */
export interface StereoBuffer {
  left: Float32Array;
  right: Float32Array;
}

// The worklet entry's d.ts re-exports sub-modules that may be absent from the
// copy, so the harness types the modules it touches structurally.
type AnyEngine = any;

interface WorkletModule {
  init: () => Promise<unknown>;
  SonareEngine: {
    create: (context: unknown, options: Record<string, unknown>) => Promise<AnyEngine>;
  };
  SonareRealtimeEngineWorkletProcessor: new (
    options: Record<string, unknown>,
    transport: WorkletTransport,
  ) => ProcessorInstance;
  registerSonareRealtimeEngineWorkletProcessor: (name?: string) => void;
  RealtimeEngine: new (sampleRate?: number, blockSize?: number) => AnyEngine;
}

interface ProcessorInstance {
  engine: AnyEngine;
  process: (inputs: Float32Array[][], outputs: Float32Array[][]) => boolean;
  receiveCommand: (command: unknown) => void;
  receiveSync: (message: unknown) => void;
  destroy?: () => void;
}

interface WorkletTransport {
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
  onMeter?: (meter: MeterSnapshot) => void;
}

let workletModulePromise: Promise<WorkletModule> | undefined;
let indexModulePromise: Promise<any> | undefined;

/** Imports and initialises `worklet.js` once per test file. */
export function loadWorkletModule(): Promise<WorkletModule> {
  workletModulePromise ??= (async () => {
    const mod = (await import('@/wasm/worklet.js')) as unknown as WorkletModule;
    await mod.init();
    return mod;
  })();
  return workletModulePromise;
}

/** Imports and initialises `index.js` once per test file. */
export function loadIndexModule(): Promise<any> {
  indexModulePromise ??= (async () => {
    const mod = await import('@/wasm/index.js');
    await mod.init();
    return mod;
  })();
  return indexModulePromise;
}

function renderBlocks(
  frames: number,
  processBlock: (outputs: Float32Array[][]) => void,
  beforeBlock?: () => void,
  afterBlock?: () => void,
): StereoBuffer {
  if (!Number.isSafeInteger(frames) || frames <= 0 || frames % RENDER_QUANTUM !== 0) {
    throw new RangeError(`frames must be a positive multiple of ${RENDER_QUANTUM}, got ${frames}`);
  }
  const left = new Float32Array(frames);
  const right = new Float32Array(frames);
  const outL = new Float32Array(RENDER_QUANTUM);
  const outR = new Float32Array(RENDER_QUANTUM);
  for (let offset = 0; offset < frames; offset += RENDER_QUANTUM) {
    beforeBlock?.();
    outL.fill(0);
    outR.fill(0);
    processBlock([[outL, outR]]);
    left.set(outL, offset);
    right.set(outR, offset);
    afterBlock?.();
  }
  return { left, right };
}

function isMeter(message: unknown): message is MeterSnapshot {
  return (
    typeof message === 'object' &&
    message !== null &&
    (message as { type?: unknown }).type === 'meter'
  );
}

function isNumericTelemetry(message: unknown): boolean {
  return (
    typeof message === 'object' &&
    message !== null &&
    typeof (message as { type?: unknown }).type === 'number'
  );
}

// ---------------------------------------------------------------------------
// (a) Processor loop

export interface ProcessorLoopOptions {
  sampleRate?: number;
  /** Forwarded to the processor; omitted means the processor default. */
  meterIntervalFrames?: number;
  channelCount?: number;
  /** Extra processor options merged last. */
  processorOptions?: Record<string, unknown>;
}

export interface ProcessorLoop {
  processor: ProcessorInstance;
  /** The processor's own `RealtimeEngine` (worklet module instance). */
  engine: AnyEngine;
  sampleRate: number;
  /** Meter snapshots received through `transport.onMeter`, in arrival order. */
  meters: MeterSnapshot[];
  /** Per-block telemetry records (numeric `type`). */
  telemetry: unknown[];
  /** Every other posted message (sync errors, clip-page requests, ...). */
  messages: unknown[];
  /** Calls `process()` in 128-frame quanta and returns the output. */
  render: (frames: number) => StereoBuffer;
  dispose: () => void;
}

/** Runs the real engine worklet processor with a stub transport. */
export async function createProcessorLoop(opts: ProcessorLoopOptions = {}): Promise<ProcessorLoop> {
  const mod = await loadWorkletModule();
  const sampleRate = opts.sampleRate ?? DEFAULT_SAMPLE_RATE;
  const meters: MeterSnapshot[] = [];
  const telemetry: unknown[] = [];
  const messages: unknown[] = [];
  const transport: WorkletTransport = {
    postMessage: (message) => {
      if (isMeter(message)) meters.push(message);
      else if (isNumericTelemetry(message)) telemetry.push(message);
      else messages.push(message);
    },
    onMeter: (meter) => {
      meters.push(meter);
    },
  };
  const options: Record<string, unknown> = {
    sampleRate,
    blockSize: RENDER_QUANTUM,
    channelCount: opts.channelCount ?? 2,
    ...(opts.meterIntervalFrames === undefined
      ? {}
      : { meterIntervalFrames: opts.meterIntervalFrames }),
    ...opts.processorOptions,
  };
  const processor = new mod.SonareRealtimeEngineWorkletProcessor(options, transport);
  return {
    processor,
    engine: processor.engine,
    sampleRate,
    meters,
    telemetry,
    messages,
    render: (frames) => renderBlocks(frames, (outputs) => processor.process([[]], outputs)),
    dispose: () => {
      processor.receiveSync({ type: 'destroy' });
    },
  };
}

// ---------------------------------------------------------------------------
// (b) Facade loopback

interface FakeMessageEvent {
  data: unknown;
}

type Listener = (event: FakeMessageEvent) => void;

/**
 * One end of an in-process MessageChannel: structured clone with transfer,
 * asynchronous delivery (a microtask, so a handler installed right after the
 * sender returns still receives the message), plus a synchronous `drain()`.
 */
class LoopbackPort {
  peer!: LoopbackPort;
  onmessage: Listener | null = null;
  private readonly listeners = new Set<Listener>();
  private readonly inbox: unknown[] = [];
  private scheduled = false;
  closed = false;

  postMessage(message: unknown, transfer?: Transferable[] | StructuredSerializeOptions): void {
    if (this.closed) return;
    const transferList = Array.isArray(transfer) ? transfer : (transfer?.transfer ?? []);
    const cloned = structuredClone(message, { transfer: transferList as Transferable[] });
    this.peer.enqueue(cloned);
  }

  addEventListener(type: string, listener: Listener): void {
    if (type === 'message') this.listeners.add(listener);
  }

  removeEventListener(type: string, listener: Listener): void {
    if (type === 'message') this.listeners.delete(listener);
  }

  start(): void {}

  close(): void {
    this.closed = true;
    this.inbox.length = 0;
  }

  private enqueue(message: unknown): void {
    if (this.closed) return;
    this.inbox.push(message);
    if (!this.scheduled) {
      this.scheduled = true;
      queueMicrotask(() => {
        this.scheduled = false;
        this.drain();
      });
    }
  }

  /** Delivers every queued message now; returns how many were delivered. */
  drain(): number {
    let delivered = 0;
    while (this.inbox.length > 0 && !this.closed) {
      const data = this.inbox.shift();
      const event = { data };
      this.onmessage?.(event);
      for (const listener of this.listeners) listener(event);
      delivered += 1;
    }
    return delivered;
  }
}

function createLoopbackChannel(): { port1: LoopbackPort; port2: LoopbackPort } {
  const port1 = new LoopbackPort();
  const port2 = new LoopbackPort();
  port1.peer = port2;
  port2.peer = port1;
  return { port1, port2 };
}

interface RegisteredProcessor {
  bridge?: ProcessorInstance;
  process: (inputs: Float32Array[][], outputs: Float32Array[][]) => boolean;
}

type RegisteredProcessorClass = new (options: {
  processorOptions?: Record<string, unknown>;
}) => RegisteredProcessor;

let registeredClass: RegisteredProcessorClass | undefined;
let nextProcessorPort: LoopbackPort | undefined;

/**
 * Captures the class `registerSonareRealtimeEngineWorkletProcessor` hands to
 * `registerProcessor`, with a base class whose `port` is the loopback end.
 */
function registeredProcessorClass(mod: WorkletModule): RegisteredProcessorClass {
  if (registeredClass) return registeredClass;
  const scope = globalThis as Record<string, unknown>;
  const previousBase = scope.AudioWorkletProcessor;
  const previousRegister = scope.registerProcessor;
  class LoopbackAudioWorkletProcessor {
    readonly port: LoopbackPort | undefined = nextProcessorPort;
  }
  scope.AudioWorkletProcessor = LoopbackAudioWorkletProcessor;
  scope.registerProcessor = (_name: string, ctor: RegisteredProcessorClass) => {
    registeredClass = ctor;
  };
  try {
    mod.registerSonareRealtimeEngineWorkletProcessor();
  } finally {
    if (previousBase === undefined) delete scope.AudioWorkletProcessor;
    else scope.AudioWorkletProcessor = previousBase;
    if (previousRegister === undefined) delete scope.registerProcessor;
    else scope.registerProcessor = previousRegister;
  }
  if (!registeredClass)
    throw new Error('registerSonareRealtimeEngineWorkletProcessor did not register a class');
  return registeredClass;
}

export interface FacadeLoopbackOptions {
  sampleRate?: number;
  /** Passed to `SonareEngine.create` as-is; the harness never rewrites it. */
  meterIntervalFrames?: number;
  /** Extra `SonareEngine.create` options merged last (e.g. `offlineEngine`). */
  engineOptions?: Record<string, unknown>;
}

export interface FacadeLoopback {
  /** The real `SonareEngine` facade. */
  engine: AnyEngine;
  /** The processor bridge behind the registered wrapper. */
  processor: ProcessorInstance;
  sampleRate: number;
  /** `processorOptions` exactly as the facade handed them to the node factory. */
  processorOptions: Record<string, unknown>;
  /** Meter snapshots received through `engine.onMeter`. */
  meters: MeterSnapshot[];
  /** Sync errors the worklet reported back. */
  syncErrors: unknown[];
  /** Delivers queued messages in both directions until both queues are empty. */
  flush: () => void;
  /** Renders through the registered processor in 128-frame quanta. */
  render: (frames: number) => StereoBuffer;
  dispose: () => void;
}

/**
 * Builds `SonareEngine` on a fake context whose node factory wires the node
 * port to the real registered processor wrapper. Resolves once the facade is
 * ready (the wrapper posted `{type: 'ready'}`).
 */
export async function createFacadeLoopback(
  opts: FacadeLoopbackOptions = {},
): Promise<FacadeLoopback> {
  const mod = await loadWorkletModule();
  const Registered = registeredProcessorClass(mod);
  const sampleRate = opts.sampleRate ?? DEFAULT_SAMPLE_RATE;
  const { port1: nodePort, port2: processorPort } = createLoopbackChannel();
  let wrapper: RegisteredProcessor | undefined;
  let processorOptions: Record<string, unknown> = {};
  const fakeContext = {
    sampleRate,
    currentTime: 0,
    state: 'running',
    destination: {},
    suspend: async () => {},
    resume: async () => {},
  };
  const nodeFactory = (
    _ctx: unknown,
    _name: string,
    nodeOptions: { processorOptions?: Record<string, unknown> },
  ) => {
    processorOptions = { ...(nodeOptions.processorOptions ?? {}) };
    nextProcessorPort = processorPort;
    try {
      wrapper = new Registered(nodeOptions);
    } finally {
      nextProcessorPort = undefined;
    }
    return {
      port: nodePort,
      context: fakeContext,
      numberOfInputs: 1,
      numberOfOutputs: 1,
      connect: () => {},
      disconnect: () => {},
    };
  };
  const engine = await mod.SonareEngine.create(fakeContext, {
    sampleRate,
    mode: 'postMessage',
    nodeFactory,
    ...(opts.meterIntervalFrames === undefined
      ? {}
      : { meterIntervalFrames: opts.meterIntervalFrames }),
    ...opts.engineOptions,
  });
  const registered = wrapper;
  if (!registered?.bridge) throw new Error('facade resolved without a processor bridge');
  const meters: MeterSnapshot[] = [];
  engine.onMeter((meter: MeterSnapshot) => {
    meters.push(meter);
  });
  const syncErrors: unknown[] = [];
  engine.realtimeNode?.onSyncError?.((message: unknown) => {
    syncErrors.push(message);
  });
  const flush = () => {
    for (let guard = 0; guard < 10_000; guard++) {
      const delivered = processorPort.drain() + nodePort.drain();
      if (delivered === 0) return;
    }
    throw new Error('loopback flush did not settle');
  };
  return {
    engine,
    processor: registered.bridge,
    sampleRate,
    processorOptions,
    meters,
    syncErrors,
    flush,
    render: (frames) =>
      renderBlocks(frames, (outputs) => registered.process([[]], outputs), flush, flush),
    dispose: () => {
      engine.destroy();
      flush();
      nodePort.close();
      processorPort.close();
    },
  };
}

// ---------------------------------------------------------------------------
// (c) Raw engine

/** Plain `RealtimeEngine` from `index.js` (the export Worker's engine). */
export async function createRawEngine(sampleRate = DEFAULT_SAMPLE_RATE): Promise<AnyEngine> {
  const mod = await loadIndexModule();
  return new mod.RealtimeEngine(sampleRate, RENDER_QUANTUM);
}

// ---------------------------------------------------------------------------
// (d) Signal helpers

/** Sine tone of `seconds` length at `amplitude` (linear). */
export function sine(
  frequencyHz: number,
  seconds: number,
  sampleRate = DEFAULT_SAMPLE_RATE,
  amplitude = 0.5,
): Float32Array {
  const out = new Float32Array(Math.round(seconds * sampleRate));
  for (let i = 0; i < out.length; i++) {
    out[i] = amplitude * Math.sin((2 * Math.PI * frequencyHz * i) / sampleRate);
  }
  return out;
}

/** Uniform white noise in `[-amplitude, amplitude]` from a seeded mulberry32 generator. */
export function noise(
  seconds: number,
  seed: number,
  sampleRate = DEFAULT_SAMPLE_RATE,
  amplitude = 0.5,
): Float32Array {
  const out = new Float32Array(Math.round(seconds * sampleRate));
  let state = seed >>> 0;
  for (let i = 0; i < out.length; i++) {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const unit = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    out[i] = amplitude * (unit * 2 - 1);
  }
  return out;
}

/** RMS over `[start, end)` (defaults to the whole signal). */
export function rms(signal: Float32Array, start = 0, end = signal.length): number {
  const from = Math.max(0, start);
  const to = Math.min(signal.length, end);
  if (to <= from) return 0;
  let sum = 0;
  for (let i = from; i < to; i++) sum += signal[i] * signal[i];
  return Math.sqrt(sum / (to - from));
}

/** Absolute sample peak over `[start, end)`. */
export function peak(signal: Float32Array, start = 0, end = signal.length): number {
  let max = 0;
  for (let i = Math.max(0, start); i < Math.min(signal.length, end); i++) {
    const v = Math.abs(signal[i]);
    if (v > max) max = v;
  }
  return max;
}

/** Largest absolute sample difference; lengths must match. */
export function maxAbsDiff(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) throw new RangeError(`length mismatch: ${a.length} vs ${b.length}`);
  let max = 0;
  for (let i = 0; i < a.length; i++) {
    const d = Math.abs(a[i] - b[i]);
    if (d > max) max = d;
  }
  return max;
}

/** Frame count for `seconds`, rounded to whole render quanta. */
export function quantumFrames(seconds: number, sampleRate = DEFAULT_SAMPLE_RATE): number {
  return Math.max(1, Math.round((seconds * sampleRate) / RENDER_QUANTUM)) * RENDER_QUANTUM;
}

/** Linear amplitude to dB (floored at -240 dB for silence). */
export function toDb(linear: number): number {
  return linear > 0 ? 20 * Math.log10(linear) : -240;
}

/** dB to linear amplitude. */
export function fromDb(db: number): number {
  return 10 ** (db / 20);
}

/** Distinct meter frames per target id. */
export function distinctFramesByTarget(meters: readonly MeterSnapshot[]): Map<number, number> {
  const frames = new Map<number, Set<number>>();
  for (const meter of meters) {
    let set = frames.get(meter.targetId);
    if (!set) {
      set = new Set();
      frames.set(meter.targetId, set);
    }
    set.add(meter.frame);
  }
  return new Map([...frames].map(([target, set]) => [target, set.size]));
}
