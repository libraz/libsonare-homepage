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
  return {
    degenerate: { value: false },
    rirError: { value: false },
    init: vi.fn(async () => undefined),
    version: vi.fn(() => '1.3.1-test'),
    estimateRoom: vi.fn(() => room(wasmMock.degenerate.value)),
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
