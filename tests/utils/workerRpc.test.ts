import { describe, expect, it, vi } from 'vitest';
import {
  createWorkerRpc,
  WorkerJobCancelled,
  WorkerJobSuperseded,
  type WorkerLike,
} from '@/utils/workerRpc';

type Request = { id: number; type: 'work'; n: number } | { id: number; type: 'cancel' };
type Reply =
  | { id: number; type: 'progress'; value: number }
  | { id: number; type: 'done'; value: number }
  | { id: number; type: 'other' }
  | { id: number; type: 'error'; error: string }
  | { id: number; type: 'cancelled' };

class FakeWorker implements WorkerLike {
  posted: Array<{ message: { id: number; type: string }; transfer?: Transferable[] }> = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  terminate = vi.fn();
  postMessage(message: unknown, transfer?: Transferable[]) {
    this.posted.push({ message: message as { id: number; type: string }, transfer });
  }
  reply(data: Reply) {
    this.onmessage?.({ data } as MessageEvent);
  }
  crash(message: string) {
    this.onerror?.({ message, error: null } as unknown as ErrorEvent);
  }
}

function setup(latestOnly = false) {
  const workers: FakeWorker[] = [];
  const rpc = createWorkerRpc<Request, Reply>({
    name: 'Test',
    latestOnly,
    create: () => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker;
    },
  });
  const pickDone = (message: Reply) => (message.type === 'done' ? message.value : undefined);
  return { rpc, workers, pickDone };
}

describe('createWorkerRpc', () => {
  it('creates the Worker on the first job, streams progress and resolves through pick', async () => {
    const { rpc, workers, pickDone } = setup();
    expect(workers).toHaveLength(0);
    const buffer = new ArrayBuffer(8);
    const progress: number[] = [];
    const settled: string[] = [];
    const job = rpc.run(
      { type: 'work', n: 1 },
      {
        transfer: [buffer],
        onProgress: (message) => progress.push(message.value),
        settle: (message) => settled.push(message.type),
        pick: pickDone,
      },
    );
    const [worker] = workers;
    const { message, transfer } = worker.posted[0];
    expect(message).toEqual({ type: 'work', n: 1, id: message.id });
    expect(transfer).toEqual([buffer]);
    worker.reply({ id: message.id, type: 'progress', value: 0.5 });
    worker.reply({ id: message.id + 99, type: 'done', value: 7 });
    worker.reply({ id: message.id, type: 'done', value: 42 });
    await expect(job.result).resolves.toBe(42);
    expect(progress).toEqual([0.5]);
    expect(settled).toEqual(['done']);
  });

  it('rejects on an error, a cancellation or an unexpected final reply, settling each', async () => {
    const { rpc, workers, pickDone } = setup();
    const settle = vi.fn();
    const failing = rpc.run({ type: 'work', n: 1 }, { settle, pick: pickDone });
    const cancelled = rpc.run({ type: 'work', n: 2 }, { settle, pick: pickDone });
    const odd = rpc.run({ type: 'work', n: 3 }, { settle, pick: pickDone });
    const [worker] = workers;
    const [a, b, c] = worker.posted.map((p) => p.message.id);

    cancelled.cancel();
    expect(worker.posted[3].message).toEqual({ type: 'cancel', id: b });
    worker.reply({ id: a, type: 'error', error: 'boom' });
    worker.reply({ id: b, type: 'cancelled' });
    worker.reply({ id: c, type: 'other' });

    await expect(failing.result).rejects.toThrow('boom');
    await expect(cancelled.result).rejects.toBeInstanceOf(WorkerJobCancelled);
    await expect(odd.result).rejects.toThrow('unexpected other reply');
    expect(settle).toHaveBeenCalledTimes(3);
  });

  it('fails every job in flight when the Worker crashes and starts a fresh one next time', async () => {
    const { rpc, workers, pickDone } = setup();
    const first = rpc.run({ type: 'work', n: 1 }, { pick: pickDone });
    const second = rpc.run({ type: 'work', n: 2 }, { pick: pickDone });
    workers[0].crash('out of memory');
    await expect(first.result).rejects.toThrow('Test worker failed: out of memory');
    await expect(second.result).rejects.toThrow('out of memory');
    expect(workers[0].terminate).toHaveBeenCalledOnce();

    const third = rpc.run({ type: 'work', n: 3 }, { pick: pickDone });
    expect(workers).toHaveLength(2);
    workers[1].reply({ id: workers[1].posted[0].message.id, type: 'done', value: 3 });
    await expect(third.result).resolves.toBe(3);
  });

  it('drops a Worker whose postMessage throws and starts a fresh one next time', async () => {
    const { rpc, workers, pickDone } = setup();
    const waiting = rpc.run({ type: 'work', n: 1 }, { pick: pickDone });
    workers[0].postMessage = () => {
      throw new Error('could not clone');
    };
    const failed = rpc.run({ type: 'work', n: 2 }, { pick: pickDone });
    await expect(failed.result).rejects.toThrow('could not clone');
    await expect(waiting.result).rejects.toThrow('could not clone');
    expect(workers[0].terminate).toHaveBeenCalledOnce();

    const next = rpc.run({ type: 'work', n: 3 }, { pick: pickDone });
    expect(workers).toHaveLength(2);
    workers[1].reply({ id: workers[1].posted[0].message.id, type: 'done', value: 3 });
    await expect(next.result).resolves.toBe(3);
  });

  it('rejects jobs in flight on dispose and every job after it', async () => {
    const { rpc, workers, pickDone } = setup();
    const job = rpc.run({ type: 'work', n: 1 }, { pick: pickDone });
    rpc.dispose();
    await expect(job.result).rejects.toThrow('Test worker disposed');
    expect(workers[0].terminate).toHaveBeenCalledOnce();
    await expect(rpc.run({ type: 'work', n: 2 }, { pick: pickDone }).result).rejects.toThrow(
      'Test worker disposed',
    );
    expect(workers).toHaveLength(1);
  });

  it('keeps only the newest job with latestOnly and ignores the late reply of the old one', async () => {
    const { rpc, workers, pickDone } = setup(true);
    const old = rpc.run({ type: 'work', n: 1 }, { pick: pickDone });
    const fresh = rpc.run({ type: 'work', n: 2 }, { pick: pickDone });
    await expect(old.result).rejects.toBeInstanceOf(WorkerJobSuperseded);
    const [worker] = workers;
    const [oldId, freshId] = worker.posted.map((p) => p.message.id);
    worker.reply({ id: oldId, type: 'done', value: 1 });
    worker.reply({ id: freshId, type: 'done', value: 2 });
    await expect(fresh.result).resolves.toBe(2);
  });
});
