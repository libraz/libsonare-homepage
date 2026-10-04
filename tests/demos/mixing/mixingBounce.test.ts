// @vitest-environment node
/**
 * The Worker client wired to the real worker module through an in-process
 * Worker whose messages are structured-cloned with their transfer lists: the
 * page's PCM is detached (byteLength 0) while a job runs and is back in the
 * registry, intact, once the job settles, whichever way it settles.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { MixWorkerResponse } from '@/demos/mixing/mixing.worker';
import { createMixWorkerClient } from '@/demos/mixing/mixingBounce';
import type { MixAudio } from '@/demos/mixing/mixingEngine';
import { addTrack, createMixingState, type MixingState } from '@/demos/mixing/mixingState';
import { WorkerJobCancelled } from '@/utils/workerRpc';
import { noise, sine } from '../../wasm/support/engineHarness';

const SR = 48_000;

type Listener = (event: { data: unknown }) => void;

class LoopbackWorker {
  static current: LoopbackWorker | null = null;
  onmessage: Listener | null = null;
  onerror: unknown = null;
  terminated = false;

  constructor() {
    LoopbackWorker.current = this;
  }

  postMessage(message: unknown, transfer: Transferable[] = []) {
    const data = structuredClone(message, { transfer });
    queueMicrotask(() =>
      (self as unknown as { onmessage: (event: { data: unknown }) => void }).onmessage({ data }),
    );
  }

  terminate() {
    this.terminated = true;
  }
}

beforeAll(async () => {
  Object.defineProperty(globalThis, 'self', {
    configurable: true,
    value: {
      postMessage(message: MixWorkerResponse, options?: { transfer?: Transferable[] }) {
        const data = structuredClone(message, { transfer: options?.transfer ?? [] });
        const worker = LoopbackWorker.current;
        if (worker && !worker.terminated) worker.onmessage?.({ data });
      },
    },
  });
  vi.stubGlobal('Worker', LoopbackWorker);
  await import('@/demos/mixing/mixing.worker');
});

const clients: Array<ReturnType<typeof createMixWorkerClient>> = [];
afterEach(() => {
  for (const client of clients.splice(0)) client.dispose();
});

function client() {
  const created = createMixWorkerClient();
  clients.push(created);
  return created;
}

function project(): {
  state: MixingState;
  registry: Map<number, MixAudio>;
  copies: Float32Array[];
} {
  let state = createMixingState();
  state = addTrack(state, 'tone', 0.5);
  state = addTrack(state, 'noise', 0.5);
  const registry = new Map<number, MixAudio>([
    [1, { channels: [sine(330, 0.5, SR, 0.3), sine(331, 0.5, SR, 0.3)], sampleRate: SR }],
    [2, { channels: [noise(0.5, 4, SR, 0.2)], sampleRate: SR }],
    // Audio of a track that is not in the state stays with the page.
    [9, { channels: [sine(100, 0.1, SR)], sampleRate: SR }],
  ]);
  const copies = [...registry.values()].flatMap((entry) => entry.channels.map((c) => c.slice()));
  return { state, registry, copies };
}

const channelsOf = (registry: Map<number, MixAudio>) =>
  [...registry.values()].flatMap((entry) => entry.channels);

describe('mixing worker client', () => {
  it('detaches the PCM during a bounce and restores it after', async () => {
    const { state, registry, copies } = project();
    const onProgress = vi.fn();
    const job = client().bounce(state, registry, SR, { dither: 0 }, onProgress);

    expect(channelsOf(registry).map((c) => c.byteLength)).toEqual([0, 0, 0, 0.1 * SR * 4]);

    const result = await job.result;
    expect(result.left.length).toBeGreaterThan(0.5 * SR);
    expect(Number.isFinite(result.integratedLufs)).toBe(true);
    expect(onProgress).toHaveBeenCalledWith(expect.any(Number), 'rendering');
    const restored = channelsOf(registry);
    expect(restored.map((c) => c.byteLength)).toEqual(copies.map((c) => c.byteLength));
    restored.forEach((channel, i) => {
      expect(channel).toEqual(copies[i]);
    });
  });

  it('restores the PCM when the job is cancelled', async () => {
    const { state, registry, copies } = project();
    const job = client().bounce(state, registry, SR, { dither: 0 });
    job.cancel();
    await expect(job.result).rejects.toBeInstanceOf(WorkerJobCancelled);
    channelsOf(registry).forEach((channel, i) => {
      expect(channel).toEqual(copies[i]);
    });
  });

  it('restores the PCM when the job fails', async () => {
    const { state, registry, copies } = project();
    const broken: MixingState = {
      ...state,
      tracks: state.tracks.map((t) => ({ ...t, clip: { ...t.clip, trimStartSec: 9 } })),
    };
    await expect(client().bounce(broken, registry, SR, { dither: 0 }).result).rejects.toThrow(
      /offset/i,
    );
    channelsOf(registry).forEach((channel, i) => {
      expect(channel).toEqual(copies[i]);
    });
  });

  it('runs the assistant through the same transfer', async () => {
    const { state, registry, copies } = project();
    const job = client().suggest(state, registry, SR);
    expect(channelsOf(registry)[0].byteLength).toBe(0);
    const result = await job.result;
    expect(result.analyzedSec).toBe(60);
    channelsOf(registry).forEach((channel, i) => {
      expect(channel).toEqual(copies[i]);
    });
  });

  it('dispose terminates the worker and rejects what is in flight', async () => {
    const { state, registry } = project();
    const mixClient = createMixWorkerClient();
    const job = mixClient.bounce(state, registry, SR, { dither: 0 });
    mixClient.dispose();
    await expect(job.result).rejects.toThrow(/disposed/);
    expect(LoopbackWorker.current?.terminated).toBe(true);
  });
});
