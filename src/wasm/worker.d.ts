/**
 * Offline one-shot operations hosted inside a dedicated Web Worker.
 *
 * Only value-based calls are exposed here: analysis and preset mastering. Do
 * not add `Project`, `Mixer`, or realtime handles. Their native lifetime is
 * bound to one JavaScript realm, so moving them across a Worker boundary would
 * make ownership and `delete()` semantics unsound.
 */
import type { OfflineWorkerRequestMessage, OfflineWorkerResponseMessage } from './worker_protocol';
export type { OfflineWorkerOperation } from './worker_protocol';
/** Minimal endpoint shared by browser Workers and the Node worker-thread test bridge. */
export interface OfflineWorkerEndpoint {
    postMessage(message: OfflineWorkerResponseMessage, transfer?: Transferable[]): void;
    addEventListener(type: 'message', listener: (event: MessageEvent<OfflineWorkerRequestMessage>) => void): void;
}
/**
 * Install the protocol on an endpoint. This export is intentionally useful to
 * the Node `worker_threads` test adapter; browsers install it automatically
 * when this module is loaded as a Worker entry point.
 */
export declare function installOfflineWorkerEndpoint(endpoint: OfflineWorkerEndpoint): void;
