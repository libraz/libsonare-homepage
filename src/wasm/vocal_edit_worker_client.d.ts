import type { VocalAnalysis, VocalApplyRequest, VocalCapabilities, VocalCreateRequest, VocalEditResult, VocalHistoryState, VocalNotesResult, VocalPitchEvaluation, VocalRenderRequest, VocalRenderResult, VocalRestoreRequest, VocalStateBytes, VocalStateToken, VocalUint64 } from './public_types_vocal_edit.js';
import { type VocalWorkerCreateResult, type VocalWorkerMutation } from './vocal_edit_worker_protocol.js';
/**
 * A browser Worker or a Node `worker_threads.Worker`. The transfer list is
 * `readonly unknown[]` because the DOM and Node `Transferable` unions are not
 * subsets of each other, so neither Worker type would otherwise be assignable.
 */
export interface VocalEditWorker {
    postMessage(message: unknown, transfer?: readonly unknown[]): void;
    terminate(): unknown;
    addEventListener?(type: string, listener: EventListener): void;
    removeEventListener?(type: string, listener: EventListener): void;
    on?(type: 'message' | 'error', listener: (...args: unknown[]) => void): unknown;
    off?(type: 'message' | 'error', listener: (...args: unknown[]) => void): unknown;
}
export interface VocalEditWorkerClientOptions {
    worker?: VocalEditWorker;
    workerUrl?: string | URL;
    workerFactory?: (url: URL) => VocalEditWorker;
    terminateWorkerOnDispose?: boolean;
}
/** Per-call transfer behaviour for a request that carries typed arrays. */
export interface VocalEditWorkerTransferOptions {
    /**
     * Preserve the caller's typed arrays by copying them before dispatch.
     *
     * The default is `false`: typed-array buffers are transferred to the Worker
     * and become detached on the calling thread, avoiding a second copy.
     */
    copy?: boolean;
}
export interface VocalEditWorkerCallOptions extends VocalEditWorkerTransferOptions {
    signal?: AbortSignal;
}
export declare class VocalEditWorkerStaleResultError extends Error {
    constructor(message?: string);
}
export declare class VocalEditWorkerTask<T> implements PromiseLike<T> {
    readonly result: Promise<T>;
    private readonly cancelRequest;
    constructor(result: Promise<T>, cancelRequest: () => void);
    cancel(): void;
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null): Promise<TResult1 | TResult2>;
    catch<TResult = never>(onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null): Promise<T | TResult>;
    finally(onfinally?: (() => void) | null): Promise<T>;
}
type RevisionArgument = VocalUint64 | {
    expectedRevision?: VocalUint64;
};
export declare class VocalEditWorkerClient {
    private readonly worker;
    private readonly ownsWorker;
    private readonly pending;
    private readonly latestIntent;
    private readonly sessions;
    private nextId;
    private nextSession;
    private closed;
    private usesEventTarget;
    constructor(options?: VocalEditWorkerClientOptions);
    create(request: VocalCreateRequest, options?: VocalEditWorkerCallOptions): VocalEditWorkerTask<VocalEditWorkerSession>;
    restore(request: VocalRestoreRequest, options?: VocalEditWorkerCallOptions): VocalEditWorkerTask<VocalEditWorkerSession>;
    private postDisposeMessage;
    private postCancelMessage;
    dispose(): void;
    /** @internal Called by VocalEditWorkerSession. */
    disposeSession(session: VocalEditWorkerSession): VocalEditWorkerTask<null>;
    /** @internal */
    callMutation<T>(session: VocalEditWorkerSession, mutation: VocalWorkerMutation, options?: VocalEditWorkerTransferOptions): VocalEditWorkerTask<T>;
    /** @internal */
    callPreview(session: VocalEditWorkerSession, request: VocalRenderRequest, options?: VocalEditWorkerTransferOptions): VocalEditWorkerTask<VocalRenderResult>;
    private intent;
    private openSession;
    private callCreate;
    private call;
    private readonly onMessage;
    private readonly onError;
    private readonly onNodeMessage;
    private readonly onNodeError;
}
/** Selects the open draft instead of the committed session for a read-only call. */
export interface VocalEditWorkerReadOptions {
    draft?: boolean;
}
export declare class VocalEditWorkerSession {
    readonly sessionId: string;
    private tokenValue;
    private disposed;
    readonly created: VocalWorkerCreateResult;
    private readonly client;
    /** @internal Created by VocalEditWorkerClient.create/restore. */
    constructor(client: VocalEditWorkerClient, sessionId: string, token: VocalStateToken, created: VocalWorkerCreateResult);
    currentToken(): VocalStateToken;
    updateToken(token: VocalStateToken): void;
    /** @internal The adopted token, readable after dispose for reply checks. */
    latestToken(): VocalStateToken;
    token(): VocalStateToken;
    /** The adopted revision; like {@link token}, it follows replies already received. */
    revision(): VocalUint64;
    notes(): VocalEditWorkerTask<VocalNotesResult>;
    analysis(): VocalEditWorkerTask<VocalAnalysis>;
    capabilities(): VocalEditWorkerTask<VocalCapabilities>;
    outputLengthSamples(): VocalEditWorkerTask<number>;
    history(): VocalEditWorkerTask<VocalHistoryState>;
    /** Token of the open draft; rejects when no draft is open. */
    draftToken(): VocalEditWorkerTask<VocalStateToken>;
    evaluatePitch(noteId: number, options?: VocalEditWorkerReadOptions): VocalEditWorkerTask<VocalPitchEvaluation>;
    sourceSampleToDestinationSample(noteId: number, sourceSample: number, options?: VocalEditWorkerReadOptions): VocalEditWorkerTask<number>;
    destinationSampleToSourceSample(noteId: number, destinationSample: number, options?: VocalEditWorkerReadOptions): VocalEditWorkerTask<number>;
    beginEdit(options?: RevisionArgument): VocalEditWorkerTask<VocalStateToken>;
    apply(request: VocalApplyRequest, options?: VocalEditWorkerTransferOptions): VocalEditWorkerTask<VocalEditResult>;
    commit(options?: RevisionArgument): VocalEditWorkerTask<VocalEditResult>;
    cancel(): VocalEditWorkerTask<null>;
    undo(options?: RevisionArgument): VocalEditWorkerTask<VocalEditResult>;
    redo(options?: RevisionArgument): VocalEditWorkerTask<VocalEditResult>;
    exportState(): VocalEditWorkerTask<VocalStateBytes>;
    preview(request: VocalRenderRequest, options?: VocalEditWorkerTransferOptions): VocalEditWorkerTask<VocalRenderResult>;
    /** Releases the Worker session and any open draft; later calls on it are rejected. */
    dispose(): VocalEditWorkerTask<null>;
    private requireAlive;
}
export {};
