import type { EngineBounceOptions, EngineBounceResult, EngineClip, EngineFreezeOptions, EngineFreezeResult, RealtimeEngine } from '../index.js';
import type { OpfsClipPageProviderBinding } from '../opfs_clip_pages.js';
import type { OwnerEpoch } from '../owner_epoch.js';
/** Request form of {@link SonareEngine.renderOffline}. */
export interface SonareRenderOfflineRequest {
    /** Length of the render in frames. */
    totalFrames: number;
    /**
     * Render block size. Defaults to the engine's offline block size and must not
     * exceed it; a larger value throws a `RangeError`.
     */
    blockSize?: number;
    /**
     * Whether this call ends the timeline. `true` (the default) releases every
     * sounding note and flushes the delay lines before returning. `false` renders
     * one chunk of a longer timeline; end it with {@link SonareEngine.finishOfflineRender}.
     * The transport position is restored when the timeline ends, not between chunks.
     */
    finalize?: boolean;
}
/** An OPFS-streamed clip's page bookkeeping, keyed by its page provider id. */
export interface OpfsExportSource {
    binding: OpfsClipPageProviderBinding;
    pageFrames: number;
    numSamples: number;
    /** Pages currently supplied to the mirror and the worklet. */
    residentPages: Set<number>;
}
/** Collaborator surface the offline export entry points need from the owning engine. */
export interface EngineExportContext {
    readonly offlineEngine: RealtimeEngine;
    readonly offlineBlockSize: number;
    readonly offlineChannelCount: number;
    readonly clips: ReadonlyMap<number, EngineClip>;
    readonly opfsSources: ReadonlyMap<number, OpfsExportSource>;
    /** `chunkOrigin` is the transport position the mirror returns to once a chunked render ends. */
    readonly session: {
        chunkOrigin: number | undefined;
    };
    /** Owning engine's epoch; a render that resumes after destroy stops. */
    readonly epoch: OwnerEpoch;
    flushOfflineMirror(): void;
    /** Replaces the facade clip store and the worklet's clips with the frozen clip. */
    commitFrozenClip(clip: EngineClip, previousClipIds: number[]): void;
}
export declare function renderOffline(ctx: EngineExportContext, request: number | SonareRenderOfflineRequest): Promise<Float32Array[]>;
export declare function finishOfflineRender(ctx: EngineExportContext): void;
export declare function bounceOffline(ctx: EngineExportContext, options: EngineBounceOptions): Promise<EngineBounceResult>;
export declare function freezeOffline(ctx: EngineExportContext, options: EngineFreezeOptions): Promise<EngineFreezeResult>;
