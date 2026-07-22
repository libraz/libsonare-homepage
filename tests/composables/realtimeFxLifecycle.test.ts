import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRealtimeFx } from '@/composables/useRealtimeFx';

// Drives the real useRealtimeFx.start() over minimal Web Audio stubs so the
// readiness handoff and error surfacing are exercised end to end (the component
// tests mock the composable and cannot reach this flow).

interface FakeNode {
  port: {
    onmessage: ((e: { data: unknown }) => void) | null;
    postMessage: ReturnType<typeof vi.fn>;
  };
  onprocessorerror: (() => void) | null;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}

let createdNodes: FakeNode[] = [];
let getUserMedia: ReturnType<typeof vi.fn>;

class FakeAudioContext {
  sampleRate = 48_000;
  baseLatency = 0.01;
  state = 'running';
  destination = {};
  audioWorklet = { addModule: vi.fn(async () => undefined) };
  resume = vi.fn(async () => undefined);
  close = vi.fn(async () => undefined);
  createGain() {
    return { gain: { value: 0 }, connect: vi.fn(), disconnect: vi.fn() };
  }
  createMediaStreamSource() {
    return { connect: vi.fn(), disconnect: vi.fn() };
  }
}

class FakeAudioWorkletNode {
  port = { onmessage: null as FakeNode['port']['onmessage'], postMessage: vi.fn() };
  onprocessorerror: (() => void) | null = null;
  connect = vi.fn();
  disconnect = vi.fn();
  constructor() {
    createdNodes.push(this as unknown as FakeNode);
  }
}

function installMocks() {
  createdNodes = [];
  getUserMedia = vi.fn(async () => ({ getTracks: () => [] }));
  vi.stubGlobal('AudioContext', FakeAudioContext);
  vi.stubGlobal('AudioWorkletNode', FakeAudioWorkletNode);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ arrayBuffer: async () => new ArrayBuffer(8) })),
  );
  Object.defineProperty(globalThis.navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia },
  });
}

function makeFx() {
  return useRealtimeFx('/wasm/sonare.js', '/wasm/sonare.wasm');
}

describe('useRealtimeFx lifecycle', () => {
  beforeEach(() => installMocks());
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('keeps ready false until the worklet posts its ready message', async () => {
    const fx = makeFx();
    const ok = await fx.start();
    expect(ok).toBe(true);
    // The node is wired but the native engine is still initializing.
    expect(fx.ready.value).toBe(false);

    const node = createdNodes.at(-1)!;
    node.port.onmessage?.({ data: { type: 'ready', latencySamples: 480 } });
    expect(fx.ready.value).toBe(true);
    expect(fx.latencyMs.value).toBeGreaterThan(0);

    await fx.dispose();
  });

  it('clears readiness and surfaces an engine-error on a worklet error message', async () => {
    const fx = makeFx();
    await fx.start();
    const node = createdNodes.at(-1)!;
    node.port.onmessage?.({ data: { type: 'ready', latencySamples: 0 } });
    expect(fx.ready.value).toBe(true);

    node.port.onmessage?.({ data: { type: 'error', error: 'native boom' } });
    expect(fx.ready.value).toBe(false);
    expect(fx.error.value).toBe('engine-error');

    await fx.dispose();
  });

  it('resets ready and monitoring state when the processor errors', async () => {
    const fx = makeFx();
    await fx.start();
    const node = createdNodes.at(-1)!;
    node.port.onmessage?.({ data: { type: 'ready', latencySamples: 0 } });
    fx.monitoring.value = true;

    node.onprocessorerror?.();
    expect(fx.ready.value).toBe(false);
    expect(fx.monitoring.value).toBe(false);
    expect(fx.error.value).toBe('engine-error');

    await fx.dispose();
  });

  it('maps a mic-permission denial to a localizable code, not a raw message', async () => {
    getUserMedia.mockRejectedValueOnce(
      Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' }),
    );
    const fx = makeFx();
    expect(await fx.start()).toBe(false);
    expect(fx.error.value).toBe('mic-denied');
    expect(fx.ready.value).toBe(false);
  });

  it('falls back to a generic start-failed code for unexpected errors', async () => {
    getUserMedia.mockRejectedValueOnce(new Error('boom'));
    const fx = makeFx();
    expect(await fx.start()).toBe(false);
    expect(fx.error.value).toBe('start-failed');
  });

  it('reports no-mic-api when the browser lacks getUserMedia', async () => {
    Object.defineProperty(globalThis.navigator, 'mediaDevices', {
      configurable: true,
      value: {},
    });
    const fx = makeFx();
    expect(await fx.start()).toBe(false);
    expect(fx.error.value).toBe('no-mic-api');
  });
});
