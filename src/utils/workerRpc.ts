/**
 * Request/response jobs over one dedicated Worker, shared by every demo that
 * offloads work. The Worker is created on the first job and again after it
 * crashes. Each request carries an `id`; the Worker answers with messages that
 * carry the same `id` and a `type`:
 *
 * - `progress`: zero or more, passed to `onProgress`;
 * - `error` with `error: string`: rejects the job;
 * - `cancelled`: rejects with {@link WorkerJobCancelled};
 * - anything else is final and resolves through the job's `pick`.
 *
 * `cancel()` posts `{ type: 'cancel', id }`; the Worker decides whether to stop.
 * With `latestOnly`, starting a job rejects the one still in flight with
 * {@link WorkerJobSuperseded} and drops its late reply.
 */

/** The part of `Worker` the RPC uses; tests pass a fake. */
export interface WorkerLike {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  terminate(): void;
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
}

/** Every Worker reply names the job it answers. */
export interface WorkerReply {
  id: number;
  type: string;
}

/** The Worker stopped the job after a `cancel()`. */
export class WorkerJobCancelled extends Error {
  constructor() {
    super('Worker job cancelled');
    this.name = 'WorkerJobCancelled';
  }
}

/** A newer job replaced this one before it finished (`latestOnly`). */
export class WorkerJobSuperseded extends Error {
  constructor() {
    super('Worker job superseded');
    this.name = 'WorkerJobSuperseded';
  }
}

export interface WorkerJob<T> {
  result: Promise<T>;
  /** Asks the Worker to stop; the job then rejects with {@link WorkerJobCancelled}. */
  cancel(): void;
}

export interface WorkerRunOptions<Reply extends WorkerReply, T> {
  transfer?: Transferable[];
  onProgress?: (message: Extract<Reply, { type: 'progress' }>) => void;
  /** Runs on every final reply before it is resolved, e.g. to take back lent buffers. */
  settle?: (message: Reply) => void;
  /** The job's value from a final reply; `undefined` rejects as an unexpected reply. */
  pick: (message: Reply) => T | undefined;
}

export interface WorkerRpcOptions {
  /** Creates the Worker, e.g. `() => new Worker(new URL('./x.worker.ts', import.meta.url), { type: 'module' })`. */
  create: () => WorkerLike;
  /** Names the Worker in error messages. */
  name: string;
  /** Keep only the newest job in flight. */
  latestOnly?: boolean;
}

export interface WorkerRpc<Request extends { id: number }, Reply extends WorkerReply> {
  run<T>(
    request: DistributiveOmit<Request, 'id'>,
    options: WorkerRunOptions<Reply, T>,
  ): WorkerJob<T>;
  /** Terminates the Worker; jobs in flight reject and later `run` calls reject at once. */
  dispose(): void;
}

export type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

interface Pending {
  onReply(message: WorkerReply): void;
  reject(reason: unknown): void;
}

export function createWorkerRpc<Request extends { id: number }, Reply extends WorkerReply>(
  options: WorkerRpcOptions,
): WorkerRpc<Request, Reply> {
  let worker: WorkerLike | null = null;
  let disposed = false;
  let nextId = 0;
  const pending = new Map<number, Pending>();

  function failAll(reason: unknown): void {
    const jobs = [...pending.values()];
    pending.clear();
    for (const job of jobs) job.reject(reason);
  }

  function ensureWorker(): WorkerLike {
    if (worker) return worker;
    const created = options.create();
    worker = created;
    created.onmessage = (event) => {
      if (worker !== created) return;
      const message = event.data as Reply;
      pending.get(message.id)?.onReply(message);
    };
    created.onerror = (event) => {
      invalidate(
        created,
        event.error ?? new Error(`${options.name} worker failed: ${event.message}`),
      );
    };
    return created;
  }

  /** A crashed Worker keeps no state worth reusing; the next job starts a fresh one. */
  function invalidate(target: WorkerLike, reason: unknown): void {
    if (worker !== target) return;
    worker = null;
    target.onmessage = null;
    target.onerror = null;
    target.terminate();
    failAll(reason);
  }

  function run<T>(
    request: DistributiveOmit<Request, 'id'>,
    job: WorkerRunOptions<Reply, T>,
  ): WorkerJob<T> {
    const id = ++nextId;
    if (disposed) {
      return {
        result: Promise.reject(new Error(`${options.name} worker disposed`)),
        cancel: () => {},
      };
    }
    if (options.latestOnly) {
      for (const [otherId, other] of [...pending]) {
        pending.delete(otherId);
        other.reject(new WorkerJobSuperseded());
      }
    }
    const result = new Promise<T>((resolve, reject) => {
      pending.set(id, {
        reject,
        onReply(message: Reply) {
          if (message.type === 'progress') {
            job.onProgress?.(message as Extract<Reply, { type: 'progress' }>);
            return;
          }
          pending.delete(id);
          job.settle?.(message);
          if (message.type === 'error') {
            reject(new Error((message as unknown as { error: string }).error));
            return;
          }
          if (message.type === 'cancelled') {
            reject(new WorkerJobCancelled());
            return;
          }
          const value = job.pick(message);
          if (value === undefined) reject(new Error(`unexpected ${message.type} reply`));
          else resolve(value);
        },
      });
      let target: WorkerLike | null = null;
      try {
        target = ensureWorker();
        target.postMessage({ ...request, id }, job.transfer ?? []);
      } catch (error) {
        // Failing to create or post leaves the Worker unusable; every job on it fails.
        if (target) invalidate(target, error);
        else {
          pending.delete(id);
          reject(error);
        }
      }
    });
    return {
      result,
      cancel: () => {
        if (pending.has(id)) worker?.postMessage({ type: 'cancel', id });
      },
    };
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    const current = worker;
    worker = null;
    if (current) {
      current.onmessage = null;
      current.onerror = null;
      // Terminating fires no message or error event, so jobs in flight settle here.
      current.terminate();
    }
    failAll(new Error(`${options.name} worker disposed`));
  }

  return { run, dispose };
}
