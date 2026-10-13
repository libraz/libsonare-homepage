/**
 * Whether a processor can construct its bridge in its own constructor: the
 * module is initialized in this realm and no host-provided init is pending.
 */
export declare function isEmbindReady(): boolean;
/**
 * Initializes the WASM module inside an AudioWorkletGlobalScope, where `init()`
 * cannot fetch. Waits for the host's `globalThis.SonareEmbindInitPromise` when
 * one is set, then, if the module is still not initialized, builds it from
 * `globalThis.SonareEmbindModuleFactory` and `wasmBinary`. Shared by every
 * worklet processor so they accept the same recipe.
 *
 * @param wasmBinary - Compiled module bytes posted through `processorOptions`
 */
export declare function initializeEmbindInWorklet(wasmBinary?: ArrayBuffer | Uint8Array): Promise<void>;
