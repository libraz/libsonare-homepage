import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const wasmMock = vi.hoisted(() => {
  const acoustic = (isBlind: boolean) => ({
    rt60: 0.6,
    edt: 0.5,
    c50: 4,
    c80: 6,
    d50: 0.7,
    rt60Bands: new Float32Array([0.5, 0.55, 0.6, 0.62, 0.58, 0.5]),
    edtBands: new Float32Array(6),
    c50Bands: new Float32Array(6),
    c80Bands: new Float32Array(6),
    confidence: 0.8,
    isBlind,
  });
  const room = (degenerate = false) =>
    degenerate
      ? {
          volume: 0,
          length: 0,
          width: 0,
          height: 0,
          drrDb: 0,
          confidence: 0,
          absorptionBands: new Float32Array(6),
          rt60Bands: new Float32Array(6),
        }
      : {
          volume: 60,
          length: 5,
          width: 4,
          height: 3,
          drrDb: 6,
          confidence: 0.7,
          absorptionBands: new Float32Array([0.1, 0.12, 0.15, 0.18, 0.2, 0.22]),
          rt60Bands: new Float32Array([0.5, 0.55, 0.6, 0.62, 0.58, 0.5]),
        };
  // A wide room with a very negative DRR so the estimated source lands far from the
  // listener — far enough that the raw shell point falls outside the room walls.
  const farRoom = () => ({
    volume: 300,
    length: 6,
    width: 4,
    height: 3,
    drrDb: -30,
    confidence: 0.7,
    absorptionBands: new Float32Array([0.1, 0.12, 0.15, 0.18, 0.2, 0.22]),
    rt60Bands: new Float32Array([0.5, 0.55, 0.6, 0.62, 0.58, 0.5]),
  });
  return {
    degenerate: { value: false },
    farSource: { value: false },
    rirError: { value: false },
    init: vi.fn(async () => undefined),
    version: vi.fn(() => '1.3.1-test'),
    estimateRoom: vi.fn(() =>
      wasmMock.farSource.value ? farRoom() : room(wasmMock.degenerate.value),
    ),
    analyzeImpulseResponse: vi.fn(() => acoustic(false)),
    detectAcoustic: vi.fn(() => acoustic(true)),
    synthesizeRir: vi.fn(() => ({
      rir: wasmMock.rirError.value ? new Float32Array(0) : new Float32Array([1, 0.5, 0.25, 0.1]),
      sampleRate: 48000,
      hasError: wasmMock.rirError.value,
    })),
    roomMorph: vi.fn((samples: Float32Array) => new Float32Array(samples)),
  };
});

vi.mock('@/wasm/index.js', () => wasmMock);

const geometry = {
  lengthM: 6,
  widthM: 4,
  heightM: 3,
  absorption: 0.2,
  sourceX: 1,
  sourceY: 1,
  sourceZ: 1.4,
  listenerX: 3,
  listenerY: 2,
  listenerZ: 1.5,
};

describe('spatial worker protocol', () => {
  let originalSelf: typeof globalThis.self;
  let posted: Array<{ message: any; transfer?: Transferable[] }>;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    wasmMock.degenerate.value = false;
    wasmMock.farSource.value = false;
    wasmMock.rirError.value = false;
    posted = [];
    originalSelf = globalThis.self;
    Object.defineProperty(globalThis, 'self', {
      configurable: true,
      value: {
        postMessage: vi.fn((message: unknown, transfer?: Transferable[]) => {
          posted.push({ message, transfer });
        }),
      },
    });
    await import('@/workers/spatial.worker.ts');
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'self', {
      configurable: true,
      value: originalSelf,
    });
  });

  const send = (data: unknown) => (self as any).onmessage({ data });
  const done = () => posted.find((p) => p.message?.type === 'done');

  it('blind-scans ordinary audio via detectAcoustic with an options object', async () => {
    const samples = new Float32Array([0.2, -0.1, 0.05, -0.02]);
    await send({ type: 'scan', id: 1, samples, sampleRate: 48000, isIR: false });

    // Locks the call shape: detectAcoustic takes AcousticOptions, not a bare number.
    expect(wasmMock.estimateRoom).toHaveBeenCalledWith(samples, 48000, { nOctaveBands: 6 });
    expect(wasmMock.detectAcoustic).toHaveBeenCalledWith(samples, 48000, { nOctaveBands: 6 });
    expect(wasmMock.analyzeImpulseResponse).not.toHaveBeenCalled();

    const result = done()!.message.result;
    expect(result.valid).toBe(true);
    expect(result.isBlind).toBe(true);
    expect(result.room).toMatchObject({ length: 5, width: 4, height: 3, volume: 60 });
    expect(result.acoustic).toMatchObject({ edt: 0.5, c50: 4, c80: 6, d50: 0.7 });
    expect(result.bands).toHaveLength(6);
    expect(result.truth).toBeNull();
  });

  it('uses positional analyzeImpulseResponse for isolated impulse responses', async () => {
    const samples = new Float32Array([1, 0.5, 0.25]);
    await send({ type: 'scan', id: 2, samples, sampleRate: 48000, isIR: true });

    expect(wasmMock.analyzeImpulseResponse).toHaveBeenCalledWith(samples, 48000, 6);
    expect(wasmMock.detectAcoustic).not.toHaveBeenCalled();
    expect(done()!.message.result.isBlind).toBe(false);
  });

  it('flags degenerate blind estimates as invalid', async () => {
    wasmMock.degenerate.value = true;
    await send({
      type: 'scan',
      id: 3,
      samples: new Float32Array(4),
      sampleRate: 48000,
      isIR: false,
    });
    expect(done()!.message.result.valid).toBe(false);
  });

  it('synthesizes a preset room, compares against truth, and transfers the RIR', async () => {
    await send({ type: 'preset', id: 4, sampleRate: 48000, geometry });

    expect(wasmMock.synthesizeRir).toHaveBeenCalledWith(
      expect.objectContaining({
        lengthM: 6,
        widthM: 4,
        heightM: 3,
        absorption: 0.2,
        ismOrder: 2,
        seed: 1337,
        maxSeconds: 2.5,
        sampleRate: 48000,
      }),
    );

    const message = done()!.message;
    expect(message.result.truth).toMatchObject({
      room: { length: 6, width: 4, height: 3 },
      source: { x: 1, y: 1, z: 1.4 },
    });
    expect(message.result.rir).toBeInstanceOf(Float32Array);
    expect(message.result.rirSampleRate).toBe(48000);
    // RIR buffer is handed back zero-copy.
    expect(done()!.transfer).toEqual([message.result.rir.buffer]);
  });

  it('keeps the estimated source marker on the distance shell, even outside the room', async () => {
    wasmMock.farSource.value = true;
    await send({
      type: 'scan',
      id: 40,
      samples: new Float32Array([0.2, -0.1, 0.05]),
      sampleRate: 48000,
      isIR: false,
    });

    const { source, listener, sourceDistance } = done()!.message.result;
    const dist = Math.hypot(source.x - listener.x, source.y - listener.y, source.z - listener.z);
    // The marker sits exactly on the drawn shell (radius === sourceDistance), not clamped
    // back onto a room wall (which would shorten the radius and float it off the shell).
    expect(dist).toBeCloseTo(sourceDistance, 6);
    // This geometry drives the point past a wall — proving it is intentionally unclamped.
    expect(source.x).toBeLessThan(0);
  });

  it('sizes preset RIRs by reverberation time so long-decay rooms are not truncated', async () => {
    // A small, damped room: Sabine RT60 is short, so the RIR stays at the floor length.
    const smallRoom = { ...geometry, lengthM: 4, widthM: 3, heightM: 2.5, absorption: 0.32 };
    await send({ type: 'preset', id: 41, sampleRate: 48000, geometry: smallRoom });
    const smallMax = wasmMock.synthesizeRir.mock.calls.at(-1)![0].maxSeconds as number;

    // A cavernous, reflective room (cathedral scale): RT60 ≈ 9.5 s, so the RIR is far
    // longer than the old hardcoded 2.5 s cap.
    const bigRoom = { ...geometry, lengthM: 34, widthM: 20, heightM: 24, absorption: 0.07 };
    await send({ type: 'preset', id: 42, sampleRate: 48000, geometry: bigRoom });
    const bigMax = wasmMock.synthesizeRir.mock.calls.at(-1)![0].maxSeconds as number;

    expect(smallMax).toBe(2.5);
    expect(bigMax).toBeGreaterThan(8);
    expect(bigMax).toBeGreaterThan(smallMax);
  });

  it('reports an error for an un-synthesizable preset geometry', async () => {
    wasmMock.rirError.value = true;
    await send({ type: 'preset', id: 5, sampleRate: 48000, geometry });

    expect(done()).toBeUndefined();
    const err = posted.find((p) => p.message?.type === 'error')!;
    expect(err.message).toMatchObject({ id: 5, message: 'Invalid room geometry for synthesis' });
  });

  it('morphs both channels and transfers the rendered buffers', async () => {
    const left = new Float32Array([0.1, 0.2]);
    const right = new Float32Array([0.3, 0.4]);
    await send({ type: 'morph', id: 6, left, right, sampleRate: 48000, geometry });

    expect(wasmMock.roomMorph).toHaveBeenCalledTimes(2);
    expect(wasmMock.roomMorph).toHaveBeenCalledWith(
      left,
      48000,
      expect.objectContaining({ wet: 0.42, ismOrder: 2 }),
    );
    const morph = posted.find((p) => p.message?.type === 'morphDone')!;
    expect(morph.message.left).toBeInstanceOf(Float32Array);
    expect(morph.message.right).toBeInstanceOf(Float32Array);
    expect(morph.transfer).toEqual([morph.message.left.buffer, morph.message.right.buffer]);
  });

  it('initializes the WASM module exactly once across requests', async () => {
    await send({
      type: 'scan',
      id: 7,
      samples: new Float32Array(4),
      sampleRate: 48000,
      isIR: false,
    });
    await send({
      type: 'scan',
      id: 8,
      samples: new Float32Array(4),
      sampleRate: 48000,
      isIR: false,
    });
    expect(wasmMock.init).toHaveBeenCalledTimes(1);
  });
});
