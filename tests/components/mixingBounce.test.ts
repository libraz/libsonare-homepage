import { describe, expect, it, vi } from 'vitest';
import { createMixBounceController } from '@/components/mixing/mixingBounce';

class MockWorker {
  static instances: MockWorker[] = [];
  listeners = {
    message: new Set<(event: MessageEvent) => void>(),
    error: new Set<(event: ErrorEvent) => void>(),
  };
  messages: Array<{ message: unknown; transfer?: Transferable[] }> = [];
  terminated = false;

  constructor(
    public url: URL,
    public options: WorkerOptions,
  ) {
    MockWorker.instances.push(this);
  }

  addEventListener(
    type: 'message' | 'error',
    listener: ((event: MessageEvent) => void) | ((event: ErrorEvent) => void),
  ) {
    this.listeners[type].add(listener as never);
  }

  removeEventListener(
    type: 'message' | 'error',
    listener: ((event: MessageEvent) => void) | ((event: ErrorEvent) => void),
  ) {
    this.listeners[type].delete(listener as never);
  }

  postMessage(message: unknown, transfer?: Transferable[]) {
    this.messages.push({ message, transfer });
  }

  terminate() {
    this.terminated = true;
  }

  emitMessage(data: unknown) {
    for (const listener of this.listeners.message) listener({ data } as MessageEvent);
  }

  emitError(message: string, error = new Error(message)) {
    for (const listener of this.listeners.error) listener({ message, error } as ErrorEvent);
  }
}

function makeRequest(overrides = {}) {
  const left = new Float32Array([0.1, 0.2]);
  const right = new Float32Array([0.2, 0.1]);
  return {
    sampleRate: 48_000,
    masterFaderDb: -1,
    tracks: [
      {
        id: 'track-1',
        name: 'Track 1',
        left,
        right,
        offsetSeconds: 0,
        inputTrimDb: 0,
        faderDb: 0,
        pan: 0,
        width: 1,
        muted: false,
        soloed: false,
        polarityLeft: false,
        polarityRight: false,
      },
    ],
    reverb: { enabled: false, decaySec: 2.2, preDelayMs: 20 },
    vcaGroups: [{ id: 'A', gainDb: 0 }],
    onProgress: vi.fn(),
    ...overrides,
  };
}

describe('createMixBounceController', () => {
  it('posts mix bounce requests with transfer buffers and resolves done messages', async () => {
    const originalWorker = globalThis.Worker;
    // @ts-expect-error focused Worker mock
    globalThis.Worker = MockWorker;
    MockWorker.instances = [];

    try {
      const controller = createMixBounceController();
      const request = makeRequest();
      const promise = controller.bounce(request);
      const worker = MockWorker.instances[0];

      expect(worker.options).toEqual({ type: 'module' });
      expect(worker.messages).toHaveLength(1);
      expect(worker.messages[0].message).toMatchObject({
        type: 'mixBounce',
        id: 1,
        sampleRate: 48_000,
        masterFaderDb: -1,
        reverb: request.reverb,
        vcaGroups: request.vcaGroups,
      });
      expect(worker.messages[0].transfer).toEqual([
        request.tracks[0].left.buffer,
        request.tracks[0].right.buffer,
      ]);

      worker.emitMessage({ type: 'progress', id: 999, progress: 0.1, stage: 'ignored' });
      expect(request.onProgress).not.toHaveBeenCalled();

      worker.emitMessage({ type: 'progress', id: 1, progress: 0.5, stage: 'Running mixer' });
      expect(request.onProgress).toHaveBeenCalledWith(0.5, 'Running mixer');

      const result = {
        left: new Float32Array([0.1]),
        right: new Float32Array([0.1]),
        sampleRate: 48_000,
        duration: 1 / 48_000,
        meters: [],
        stripMeters: [],
        sceneJson: '{}',
        peakDb: -6,
        rmsDb: -12,
        integratedLufs: -14,
        truePeakDb: -5,
        correlation: 1,
      };
      worker.emitMessage({ type: 'done', id: 1, result });
      await expect(promise).resolves.toBe(result);
      expect(worker.listeners.message.size).toBe(0);
      expect(worker.listeners.error.size).toBe(0);

      controller.dispose();
      expect(worker.terminated).toBe(true);
    } finally {
      globalThis.Worker = originalWorker;
    }
  });

  it('rejects worker error messages and reuses the worker for later requests', async () => {
    const originalWorker = globalThis.Worker;
    // @ts-expect-error focused Worker mock
    globalThis.Worker = MockWorker;
    MockWorker.instances = [];

    try {
      const controller = createMixBounceController();
      const first = controller.bounce(makeRequest());
      const worker = MockWorker.instances[0];
      worker.emitMessage({ type: 'error', id: 1, error: 'mix failed' });
      await expect(first).rejects.toThrow('mix failed');

      const second = controller.bounce(makeRequest());
      expect(MockWorker.instances).toHaveLength(1);
      expect(worker.messages.at(-1)?.message).toMatchObject({ id: 2 });
      worker.emitError('worker crashed');
      await expect(second).rejects.toThrow('worker crashed');

      controller.dispose();
    } finally {
      globalThis.Worker = originalWorker;
    }
  });

  it('creates a fresh worker after dispose and supports empty transfer lists', async () => {
    const originalWorker = globalThis.Worker;
    // @ts-expect-error focused Worker mock
    globalThis.Worker = MockWorker;
    MockWorker.instances = [];

    try {
      const controller = createMixBounceController();
      const first = controller.bounce(makeRequest({ tracks: [] }));
      const firstWorker = MockWorker.instances[0];
      expect(firstWorker.messages[0].transfer).toEqual([]);
      firstWorker.emitMessage({
        type: 'done',
        id: 1,
        result: {
          left: new Float32Array(),
          right: new Float32Array(),
          sampleRate: 48_000,
          duration: 0,
          meters: [],
          stripMeters: [],
          sceneJson: '{}',
          peakDb: -120,
          rmsDb: -120,
          integratedLufs: -70,
          truePeakDb: -120,
          correlation: 0,
        },
      });
      await expect(first).resolves.toMatchObject({ duration: 0 });

      controller.dispose();
      expect(firstWorker.terminated).toBe(true);

      const second = controller.bounce(makeRequest());
      expect(MockWorker.instances).toHaveLength(2);
      expect(MockWorker.instances[1]).not.toBe(firstWorker);
      MockWorker.instances[1].emitMessage({
        type: 'error',
        id: 2,
        error: 'second failed',
      });
      await expect(second).rejects.toThrow('second failed');
      controller.dispose();
    } finally {
      globalThis.Worker = originalWorker;
    }
  });
});
