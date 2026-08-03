/**
 * Internal structured-clone protocol for the offline Web Worker bridge.
 *
 * Keep this deliberately limited to one-shot operations. Embind handles own
 * native resources and cannot safely cross a worker boundary.
 */
type OfflineWorkerOperation = 'analyze' | 'detectBpm' | 'detectKey' | 'detectChords' | 'masterAudio' | 'masterAudioStereo';
interface OfflineWorkerRunMessage {
    type: 'sonare:offline-run';
    id: number;
    operation: OfflineWorkerOperation;
    request: Record<string, unknown>;
    /** A shared flag lets cancellation reach synchronous WASM progress callbacks. */
    cancelBuffer?: SharedArrayBuffer;
}
interface OfflineWorkerCancelMessage {
    type: 'sonare:offline-cancel';
    id: number;
}
type OfflineWorkerRequestMessage = OfflineWorkerRunMessage | OfflineWorkerCancelMessage;
interface OfflineWorkerProgressMessage {
    type: 'sonare:offline-progress';
    id: number;
    progress: number;
    stage: string;
}
interface OfflineWorkerResultMessage {
    type: 'sonare:offline-result';
    id: number;
    result: unknown;
}
interface OfflineWorkerErrorMessage {
    type: 'sonare:offline-error';
    id: number;
    error: {
        name: string;
        message: string;
        code?: number;
        codeName?: string;
    };
}
type OfflineWorkerResponseMessage = OfflineWorkerProgressMessage | OfflineWorkerResultMessage | OfflineWorkerErrorMessage;

/**
 * Offline one-shot operations hosted inside a dedicated Web Worker.
 *
 * Only value-based calls are exposed here: analysis and preset mastering. Do
 * not add `Project`, `Mixer`, or realtime handles. Their native lifetime is
 * bound to one JavaScript realm, so moving them across a Worker boundary would
 * make ownership and `delete()` semantics unsound.
 */

/** Minimal endpoint shared by browser Workers and the Node worker-thread test bridge. */
interface OfflineWorkerEndpoint {
    postMessage(message: OfflineWorkerResponseMessage, transfer?: Transferable[]): void;
    addEventListener(type: 'message', listener: (event: MessageEvent<OfflineWorkerRequestMessage>) => void): void;
}
/**
 * Install the protocol on an endpoint. This export is intentionally useful to
 * the Node `worker_threads` test adapter; browsers install it automatically
 * when this module is loaded as a Worker entry point.
 */
declare function installOfflineWorkerEndpoint(endpoint: OfflineWorkerEndpoint): void;

export { type OfflineWorkerEndpoint, type OfflineWorkerOperation, installOfflineWorkerEndpoint };
