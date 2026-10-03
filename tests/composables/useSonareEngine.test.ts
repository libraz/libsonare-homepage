// @vitest-environment node
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope } from 'vue';
import {
  DEFAULT_METER_INTERVAL_FRAMES,
  type SonareMeterSnapshot,
  useSonareEngine,
} from '@/composables/useSonareEngine';
import {
  DEFAULT_SAMPLE_RATE,
  distinctFramesByTarget,
  laneMeterTarget,
  loadIndexModule,
  loadWorkletModule,
  MASTER_METER_TARGET,
  type MeterSnapshot,
  quantumFrames,
  RENDER_QUANTUM,
  sine,
} from '../wasm/support/engineHarness';

const SR = DEFAULT_SAMPLE_RATE;

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  readonly sampleRate = SR;
  readonly currentTime = 0;
  state: 'suspended' | 'running' | 'closed' = 'suspended';
  readonly destination = { kind: 'destination' };
  readonly audioWorklet = { addModule: vi.fn(async (_url: string) => {}) };
  readonly close = vi.fn(async () => {
    this.state = 'closed';
  });
  readonly resume = vi.fn(async () => {
    if (this.state !== 'closed') this.state = 'running';
  });
  readonly suspend = vi.fn(async () => {
    this.state = 'suspended';
  });
  constructor() {
    FakeAudioContext.instances.push(this);
  }
}

type Listener = (event: { data: unknown }) => void;

/** One end of an in-process MessageChannel with structured clone and microtask delivery. */
class LoopbackPort {
  peer!: LoopbackPort;
  onmessage: Listener | null = null;
  closed = false;
  private readonly listeners = new Set<Listener>();
  private readonly inbox: unknown[] = [];

  postMessage(message: unknown, transfer?: Transferable[] | StructuredSerializeOptions): void {
    if (this.closed) return;
    const list = Array.isArray(transfer) ? transfer : (transfer?.transfer ?? []);
    this.peer.inbox.push(structuredClone(message, { transfer: list }));
    queueMicrotask(() => this.peer.drain());
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
  }

  drain(): number {
    let delivered = 0;
    while (this.inbox.length > 0 && !this.closed) {
      const event = { data: this.inbox.shift() };
      this.onmessage?.(event);
      for (const listener of this.listeners) listener(event);
      delivered += 1;
    }
    return delivered;
  }
}

interface RegisteredProcessor {
  process: (inputs: Float32Array[][], outputs: Float32Array[][]) => boolean;
}
type RegisteredClass = new (options: {
  processorOptions?: Record<string, unknown>;
}) => RegisteredProcessor;

let Registered: RegisteredClass;
let nextPort: LoopbackPort | undefined;

/** Captures the processor wrapper class the shipped register function builds. */
async function captureRegisteredClass(): Promise<RegisteredClass> {
  const mod = await loadWorkletModule();
  const scope = globalThis as Record<string, unknown>;
  let captured: RegisteredClass | undefined;
  scope.AudioWorkletProcessor = class {
    readonly port = nextPort;
  };
  scope.registerProcessor = (_name: string, ctor: RegisteredClass) => {
    captured = ctor;
  };
  try {
    mod.registerSonareRealtimeEngineWorkletProcessor();
  } finally {
    delete scope.AudioWorkletProcessor;
    delete scope.registerProcessor;
  }
  if (!captured) throw new Error('processor class was not registered');
  return captured;
}

/** A node factory wiring the facade's node port to the real registered processor. */
function createRig(onCreate?: () => void) {
  const nodePort = new LoopbackPort();
  const processorPort = new LoopbackPort();
  nodePort.peer = processorPort;
  processorPort.peer = nodePort;
  const node = {
    port: nodePort,
    numberOfInputs: 1,
    numberOfOutputs: 1,
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
  const rig = {
    node,
    processorOptions: null as Record<string, unknown> | null,
    wrapper: null as RegisteredProcessor | null,
    nodeFactory: ((
      _ctx: unknown,
      _name: string,
      options: { processorOptions?: Record<string, unknown> },
    ) => {
      rig.processorOptions = { ...(options.processorOptions ?? {}) };
      nextPort = processorPort;
      try {
        rig.wrapper = new Registered(options);
      } finally {
        nextPort = undefined;
      }
      onCreate?.();
      return node;
    }) as never,
    flush() {
      for (let guard = 0; guard < 10_000; guard++) {
        if (processorPort.drain() + nodePort.drain() === 0) return;
      }
      throw new Error('loopback did not settle');
    },
    render(frames: number) {
      const outL = new Float32Array(RENDER_QUANTUM);
      const outR = new Float32Array(RENDER_QUANTUM);
      for (let offset = 0; offset < frames; offset += RENDER_QUANTUM) {
        rig.flush();
        rig.wrapper?.process([[]], [[outL, outR]]);
        rig.flush();
      }
    },
  };
  return rig;
}

const frameCallbacks = new Map<number, FrameRequestCallback>();
let nextFrameId = 1;
function runAnimationFrames(): void {
  const callbacks = [...frameCallbacks.values()];
  frameCallbacks.clear();
  for (const callback of callbacks) callback(0);
}

describe('useSonareEngine', () => {
  let mirrorDestroy: ReturnType<typeof vi.spyOn>;
  let facadeDestroy: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    Registered = await captureRegisteredClass();
    await loadIndexModule();
  });

  beforeEach(async () => {
    FakeAudioContext.instances = [];
    frameCallbacks.clear();
    vi.stubGlobal('AudioContext', FakeAudioContext);
    // The site is not cross-origin isolated, so browsers expose no SharedArrayBuffer.
    vi.stubGlobal('SharedArrayBuffer', undefined);
    vi.stubGlobal('location', { href: 'http://localhost/' });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ arrayBuffer: async () => new ArrayBuffer(0) })),
    );
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      const id = nextFrameId++;
      frameCallbacks.set(id, callback);
      return id;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      frameCallbacks.delete(id);
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const index = await loadIndexModule();
    const worklet = await loadWorkletModule();
    mirrorDestroy = vi.spyOn(index.RealtimeEngine.prototype, 'destroy');
    facadeDestroy = vi.spyOn(
      (worklet.SonareEngine as unknown as { prototype: { destroy: () => void } }).prototype,
      'destroy',
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('starts, loads the worklet module and forwards meterIntervalFrames 1024', async () => {
    const rig = createRig();
    const sonare = useSonareEngine({ nodeFactory: rig.nodeFactory });

    const [first, second] = await Promise.all([sonare.start(), sonare.start()]);

    expect(first).toBe(true);
    expect(second).toBe(true);
    expect(await sonare.start()).toBe(true);
    expect(FakeAudioContext.instances).toHaveLength(1);
    const ctx = FakeAudioContext.instances[0];
    expect(ctx.audioWorklet.addModule).toHaveBeenCalledWith('blob:test');
    expect(DEFAULT_METER_INTERVAL_FRAMES).toBe(1024);
    expect(rig.processorOptions?.meterIntervalFrames).toBe(1024);
    expect(sonare.engine.value?.capabilities.mode).toBe('postMessage');
    expect(rig.node.connect).toHaveBeenCalledWith(ctx.destination);
    expect(ctx.resume).toHaveBeenCalled();
    expect(sonare.ready.value).toBe(true);
    expect(sonare.error.value).toBeNull();
    expect(sonare.engine.value).not.toBeNull();
    expect(sonare.offlineEngine.value).not.toBeNull();
    expect(sonare.outputNode.value).toBe(rig.node);
    await sonare.dispose();
  });

  it('delivers master and lane meters to onMeter subscribers', async () => {
    const rig = createRig();
    const sonare = useSonareEngine({ nodeFactory: rig.nodeFactory });
    const received: SonareMeterSnapshot[] = [];
    const unsubscribe = sonare.onMeter((meter) => received.push(meter));
    expect(await sonare.start()).toBe(true);
    const engine = sonare.engine.value!;
    engine.setTrackLanes([{ trackId: 1 }, { trackId: 2 }]);
    engine.addClip(1, [sine(220, 1.2, SR, 0.4), sine(220, 1.2, SR, 0.4)], 0);
    engine.addClip(2, [sine(330, 1.2, SR, 0.3), sine(330, 1.2, SR, 0.3)], 0);
    sonare.play();
    expect(sonare.playing.value).toBe(true);

    rig.render(SR);

    const frames = distinctFramesByTarget(received as MeterSnapshot[]);
    for (const target of [MASTER_METER_TARGET, laneMeterTarget(0), laneMeterTarget(1)]) {
      expect(frames.get(target) ?? 0, `target ${target}`).toBeGreaterThanOrEqual(20);
    }
    const lane = received.filter((m) => m.targetId === laneMeterTarget(0)).at(-1)!;
    expect(lane.peakDbL).toBeGreaterThan(-20);

    unsubscribe();
    const count = received.length;
    rig.render(quantumFrames(0.1));
    expect(received.length).toBe(count);
    await sonare.dispose();
  });

  it('advances position from block telemetry once per animation frame', async () => {
    const rig = createRig();
    const sonare = useSonareEngine({ nodeFactory: rig.nodeFactory });
    expect(await sonare.start()).toBe(true);
    sonare.engine.value!.setTrackLanes([{ trackId: 1 }]);
    sonare.play();

    const frames = quantumFrames(0.5);
    rig.render(frames);
    expect(sonare.position.value).toBe(0);
    expect(frameCallbacks.size).toBe(1);

    runAnimationFrames();
    expect(sonare.position.value).toBeGreaterThan(0.45);
    expect(sonare.position.value).toBeLessThanOrEqual(frames / SR);

    sonare.seek(2);
    expect(sonare.position.value).toBe(2);
    sonare.stop();
    expect(sonare.playing.value).toBe(false);
    await sonare.dispose();
  });

  it('dispose destroys the engine and mirror, closes the context and revokes the blob URL', async () => {
    const rig = createRig();
    const sonare = useSonareEngine({ nodeFactory: rig.nodeFactory });
    expect(await sonare.start()).toBe(true);
    sonare.play();
    const ctx = FakeAudioContext.instances[0];

    await sonare.dispose();

    expect(facadeDestroy).toHaveBeenCalledTimes(1);
    expect(mirrorDestroy).toHaveBeenCalledTimes(1);
    expect(rig.node.disconnect).toHaveBeenCalled();
    expect(ctx.close).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');
    expect(sonare.engine.value).toBeNull();
    expect(sonare.offlineEngine.value).toBeNull();
    expect(sonare.context.value).toBeNull();
    expect(sonare.playing.value).toBe(false);
    expect(sonare.ready.value).toBe(false);
    expect(await sonare.start()).toBe(false);
  });

  it('dispose while the engine is being created leaves nothing alive', async () => {
    let sonare: ReturnType<typeof useSonareEngine> | undefined;
    let disposing: Promise<void> | undefined;
    const rig = createRig(() => {
      disposing = sonare!.dispose();
    });
    sonare = useSonareEngine({ nodeFactory: rig.nodeFactory });

    const started = await sonare.start();
    await disposing;

    expect(started).toBe(false);
    expect(facadeDestroy).toHaveBeenCalledTimes(1);
    expect(mirrorDestroy).toHaveBeenCalledTimes(1);
    expect(rig.node.disconnect).toHaveBeenCalled();
    expect(FakeAudioContext.instances[0].close).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');
    expect(sonare.engine.value).toBeNull();
    expect(sonare.context.value).toBeNull();
    expect(sonare.error.value).toBeNull();
  });

  it('dispose before the WASM import settles never builds a context', async () => {
    const rig = createRig();
    const sonare = useSonareEngine({ nodeFactory: rig.nodeFactory });

    const started = sonare.start();
    await sonare.dispose();

    expect(await started).toBe(false);
    expect(FakeAudioContext.instances).toHaveLength(0);
    expect(rig.wrapper).toBeNull();
  });

  it('disposes with its effect scope', async () => {
    const rig = createRig();
    const scope = effectScope();
    const sonare = scope.run(() => useSonareEngine({ nodeFactory: rig.nodeFactory }))!;
    expect(await sonare.start()).toBe(true);

    scope.stop();
    await vi.waitFor(() => expect(FakeAudioContext.instances[0].close).toHaveBeenCalled());

    expect(facadeDestroy).toHaveBeenCalledTimes(1);
    expect(sonare.engine.value).toBeNull();
  });
});
