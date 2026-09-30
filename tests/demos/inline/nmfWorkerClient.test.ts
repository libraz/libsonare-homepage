// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import {
  decomposeNmf,
  NMF_COMPONENT_COUNT,
  NMF_HOP_LENGTH,
  NMF_ITERATIONS,
  NMF_N_FFT,
  type NmfWorkerRequest,
  type NmfWorkerResponse,
} from '@/demos/inline/archetypes/nmf.worker';
import {
  createNmfWorkerClient,
  type NmfWorkerLike,
} from '@/demos/inline/archetypes/nmfWorkerClient';

function components(length: number): Float32Array[] {
  return Array.from({ length: NMF_COMPONENT_COUNT }, (_, component) =>
    Float32Array.from({ length }, (_, sample) => component + sample / 10),
  );
}

class MockWorker implements NmfWorkerLike {
  readonly messages: NmfWorkerRequest[] = [];
  readonly transfers: Transferable[][] = [];
  onmessage: ((event: MessageEvent<NmfWorkerResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  terminated = false;

  postMessage(message: NmfWorkerRequest, transfer?: Transferable[]): void {
    this.messages.push(message);
    this.transfers.push(transfer ?? []);
  }

  terminate(): void {
    this.terminated = true;
  }

  respondDone(output = components(this.messages[0]?.samples.length ?? 0)): void {
    const request = this.messages.at(-1)!;
    this.onmessage?.({
      data: {
        type: 'done',
        id: request.id,
        components: output,
        sampleRate: request.sampleRate,
      },
    } as MessageEvent<NmfWorkerResponse>);
  }
}

describe('NMF worker adapter', () => {
  it('passes the fixed four-component NMF settings to WASM', async () => {
    const source = Float32Array.from([0.1, -0.2, 0.3]);
    const output = components(source.length);
    const decomposeStems = vi.fn(() => ({
      components: output,
      w: new Float32Array(),
      h: new Float32Array(),
      sampleRate: 44_100,
    }));
    const wasm = { init: vi.fn(), decomposeStems } as unknown as Parameters<typeof decomposeNmf>[1];

    const response = await decomposeNmf(
      { type: 'decompose', id: 7, samples: source, sampleRate: 44_100 },
      wasm,
    );

    expect(decomposeStems).toHaveBeenCalledWith({
      samples: source,
      sampleRate: 44_100,
      nComponents: NMF_COMPONENT_COUNT,
      nFft: NMF_N_FFT,
      hopLength: NMF_HOP_LENGTH,
      nIter: NMF_ITERATIONS,
    });
    expect(response).toEqual({
      type: 'done',
      id: 7,
      components: output,
      sampleRate: 44_100,
    });
  });
});

describe('NMF worker client', () => {
  it('copies the source before transfer and reuses all cached components', async () => {
    const source = Float32Array.from([0.1, -0.2, 0.3]);
    const worker = new MockWorker();
    const client = createNmfWorkerClient({ createWorker: () => worker });

    const pending = client.decompose(source, 44_100);
    expect(worker.messages).toHaveLength(1);
    expect(worker.messages[0]!.samples).not.toBe(source);
    expect(worker.messages[0]!.samples).toEqual(source);
    expect(worker.transfers[0]).toEqual([worker.messages[0]!.samples.buffer]);
    expect(source).toEqual(Float32Array.from([0.1, -0.2, 0.3]));

    worker.respondDone();
    const first = await pending;
    const cached = await client.decompose(source, 44_100);

    expect(cached).toBe(first);
    expect(worker.messages).toHaveLength(1);
    client.dispose();
  });

  it('deduplicates a pending request for the same source', async () => {
    const source = Float32Array.from([0.1, 0.2]);
    const worker = new MockWorker();
    const client = createNmfWorkerClient({ createWorker: () => worker });

    const first = client.decompose(source, 44_100);
    const second = client.decompose(source, 44_100);
    expect(second).toBe(first);
    worker.respondDone();
    await expect(first).resolves.toHaveLength(NMF_COMPONENT_COUNT);
    client.dispose();
  });

  it('rejects an in-flight request and terminates on disposal', async () => {
    const source = Float32Array.from([0.1, 0.2]);
    const worker = new MockWorker();
    const client = createNmfWorkerClient({ createWorker: () => worker });

    const pending = client.decompose(source, 44_100);
    client.dispose();

    await expect(pending).rejects.toThrow('NMF worker disposed');
    expect(worker.terminated).toBe(true);
  });

  it('rejects and invalidates the worker when it reports a boot error', async () => {
    const worker = new MockWorker();
    const client = createNmfWorkerClient({ createWorker: () => worker });

    const pending = client.decompose(Float32Array.from([0.1, 0.2]), 44_100);
    worker.onerror?.({
      error: new Error('WASM boot failed'),
      message: 'WASM boot failed',
    } as ErrorEvent);

    await expect(pending).rejects.toThrow('WASM boot failed');
    expect(worker.terminated).toBe(true);
    client.dispose();
  });

  it('rejects a superseded source and ignores its stale result', async () => {
    const firstSource = Float32Array.from([0.1, 0.2]);
    const secondSource = Float32Array.from([0.3, 0.4]);
    const worker = new MockWorker();
    const client = createNmfWorkerClient({ createWorker: () => worker });

    const first = client.decompose(firstSource, 44_100);
    const firstRejection = expect(first).rejects.toThrow('NMF request superseded');
    const second = client.decompose(secondSource, 44_100);
    await firstRejection;

    worker.onmessage?.({
      data: {
        type: 'done',
        id: 1,
        components: components(firstSource.length),
        sampleRate: 44_100,
      },
    } as MessageEvent<NmfWorkerResponse>);
    expect(worker.messages).toHaveLength(2);
    worker.respondDone(components(secondSource.length));
    await expect(second).resolves.toHaveLength(NMF_COMPONENT_COUNT);
    client.dispose();
  });
});
