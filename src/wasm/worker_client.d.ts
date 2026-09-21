import { ErrorCode } from './errors';
import type { MasterAudioRequest, MasterAudioStereoRequest } from './mastering_chain';
import type { DetectChordsRequest, DetectKeyRequest, MusicAnalyzeRequest, SamplesRequest } from './quick_analysis';
type WorkerRequest<T> = Omit<T, 'onProgress'>;
/** Progress relayed from the Worker at the core's native progress boundaries. */
export interface OfflineWorkerProgress {
    progress: number;
    stage: string;
}
/** Per-call behaviour for a one-shot operation. */
export interface OfflineWorkerCallOptions {
    /**
     * Preserve the caller's input arrays by copying them before dispatch.
     *
     * The default is `false`: `Float32Array` buffers are transferred to the
     * Worker and become detached on the calling thread, avoiding a second copy.
     */
    copy?: boolean;
    /** Receives native progress boundaries for analysis and mastering calls. */
    onProgress?: (update: OfflineWorkerProgress) => void;
}
/** Options used to create an {@link OfflineWorkerClient}. */
export interface OfflineWorkerClientOptions {
    /** Reuse a Worker owned by the host instead of creating one. */
    worker?: OfflineWorker;
    /** URL of the Worker entry; defaults to the adjacent published `worker.js`. */
    workerUrl?: string | URL;
    /** Test/host hook for creating a dedicated Worker. */
    workerFactory?: (url: URL) => OfflineWorker;
    /** Terminate a supplied Worker when {@link OfflineWorkerClient.dispose} runs. */
    terminateWorkerOnDispose?: boolean;
}
/** Browser Worker or Node `worker_threads.Worker` used by the client. */
export interface OfflineWorker {
    postMessage(message: unknown, transfer?: Transferable[]): void;
    terminate(): unknown;
    addEventListener?(type: string, listener: EventListener): void;
    removeEventListener?(type: string, listener: EventListener): void;
    on?(type: 'message' | 'error', listener: (...args: unknown[]) => void): unknown;
    off?(type: 'message' | 'error', listener: (...args: unknown[]) => void): unknown;
}
/**
 * A cancellable promise returned by an {@link OfflineWorkerClient} call.
 *
 * It is Promise-like, so `await client.analyze(...)` works. Call `cancel()` to
 * request cancellation at the next native progress boundary. In browsers this
 * uses a `SharedArrayBuffer` flag, which requires cross-origin isolation for
 * prompt cancellation while synchronous WASM is running. The worker forwards
 * that flag through the same native cancellation callback used by synchronous
 * one-shot requests.
 */
export declare class OfflineWorkerTask<T> implements PromiseLike<T> {
    readonly result: Promise<T>;
    private readonly cancelRequest;
    constructor(result: Promise<T>, cancelRequest: () => void);
    cancel(): void;
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null): Promise<TResult1 | TResult2>;
    catch<TResult = never>(onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null): Promise<T | TResult>;
    finally(onfinally?: (() => void) | null): Promise<T>;
}
/**
 * Owns a dedicated Worker for value-based offline analysis and mastering.
 *
 * `Project`, `Mixer`, and realtime APIs are intentionally absent: their native
 * handles are local to one JavaScript realm and cannot be transferred safely.
 */
export declare class OfflineWorkerClient {
    private readonly worker;
    private readonly ownsWorker;
    private readonly pending;
    private nextId;
    private closed;
    private usesEventTarget;
    constructor(options?: OfflineWorkerClientOptions);
    /** Dispatch full music analysis to the Worker. */
    analyze(request: WorkerRequest<MusicAnalyzeRequest>, options?: OfflineWorkerCallOptions): OfflineWorkerTask<ReturnType<typeof import('./quick_analysis').analyze>>;
    /** Dispatch BPM detection to the Worker. */
    detectBpm(request: SamplesRequest, options?: OfflineWorkerCallOptions): OfflineWorkerTask<number>;
    /** Dispatch key detection to the Worker. */
    detectKey(request: DetectKeyRequest, options?: OfflineWorkerCallOptions): OfflineWorkerTask<ReturnType<typeof import('./quick_analysis').detectKey>>;
    /** Dispatch chord detection to the Worker. */
    detectChords(request: DetectChordsRequest, options?: OfflineWorkerCallOptions): OfflineWorkerTask<ReturnType<typeof import('./quick_analysis').detectChords>>;
    /** Dispatch mono preset mastering to the Worker. */
    masterAudio(request: WorkerRequest<MasterAudioRequest>, options?: OfflineWorkerCallOptions): OfflineWorkerTask<ReturnType<typeof import('./mastering_chain').masterAudio>>;
    /** Dispatch stereo preset mastering to the Worker. */
    masterAudioStereo(request: WorkerRequest<MasterAudioStereoRequest>, options?: OfflineWorkerCallOptions): OfflineWorkerTask<ReturnType<typeof import('./mastering_chain').masterAudioStereo>>;
    /** Stop accepting calls, reject outstanding work, and release the Worker if owned. */
    dispose(): void;
    private call;
    private readonly onMessage;
    private readonly onError;
    private readonly onNodeMessage;
    private readonly onNodeError;
}
export { ErrorCode };
