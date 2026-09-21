import { type OpfsClipPageProviderBinding, type OpfsClipPageProviderOptions } from './opfs_clip_pages';
import type { ClipPageProvider, RealtimeEngine } from './realtime_engine';
/**
 * Minimal engine surface the streamer drives. {@link RealtimeEngine} satisfies
 * this structurally; tests can supply a lightweight stand-in.
 */
export interface ClipPageStreamerEngine {
    /** Drain one pending audio-thread page-miss request, or `null` when empty. */
    popClipPageRequest(): ClipPageStreamerRequest | null;
}
/**
 * A page miss reported by either a direct engine (`sample`) or the worklet
 * bridge (`pageIndex`). Exactly one position form is required.
 */
export interface ClipPageStreamerRequest {
    clipId: number;
    sample?: number;
    pageIndex?: number;
}
/** A paged clip the streamer keeps fed from its backing store. */
export interface ClipPageStreamSource {
    /** Clip schedule id passed to `setClips` (matches {@link ClipPageRequest.clipId}). */
    clipId: number;
    /** OPFS-backed page provider binding for this clip. */
    binding: OpfsClipPageProviderBinding;
    /** Page size in frames (must equal the provider's `pageFrames`). */
    pageFrames: number;
    /** Total sample count of the clip source. */
    numSamples: number;
}
export interface ClipPageStreamerOptions {
    /**
     * Pages to prefetch ahead of the page a miss was reported for. Larger values
     * hide fetch latency at the cost of more resident memory. Default 2.
     */
    readAheadPages?: number;
    /**
     * Pages to retain behind the playback frontier before eviction, so a small
     * backward seek does not immediately miss. Default 1.
     */
    retainBehindPages?: number;
    /**
     * Upper bound on requests drained per {@link ClipPageStreamer.pump} call, so a
     * burst of misses cannot spin unbounded. Default 256.
     */
    maxRequestsPerPump?: number;
}
/**
 * Keeps OPFS-paged clips fed within a bounded sliding window around the live
 * playback position, so a multitrack arrangement never holds its full PCM in
 * WASM memory.
 *
 * The audio thread reports a page miss whenever the {@link ClipPlayer} reads a
 * sample whose page is not resident. {@link pump} drains those requests, fetches
 * the missing page plus a read-ahead window from each clip's backing store, and
 * evicts pages that fall outside the window via the provider's `clear`. The
 * resident set per clip is therefore bounded to
 * `retainBehindPages + readAheadPages + 1` pages regardless of clip length.
 *
 * Call {@link pump} on a cadence that keeps up with playback — typically once
 * per animation frame or per worklet control tick on the main/control thread
 * (never the audio thread; fetches are asynchronous).
 */
export declare class ClipPageStreamer {
    private readonly engine;
    private readonly readAheadPages;
    private readonly retainBehindPages;
    private readonly maxRequestsPerPump;
    private readonly sources;
    private closed;
    constructor(engine: ClipPageStreamerEngine, options?: ClipPageStreamerOptions);
    /**
     * Register a paged clip. Pages already supplied to the provider before
     * registration (for example a primed first page) should be passed in
     * `initialResidentPages` so they participate in eviction.
     */
    addSource(source: ClipPageStreamSource, initialResidentPages?: Iterable<number>): void;
    /** Stop tracking a clip. Does not close its binding (the caller owns that). */
    removeSource(clipId: number): void;
    /**
     * Explicitly start a new playback generation after a host seek/loop. Resident
     * pages are evicted and any older in-flight fetch is cleared when it settles.
     * The next miss establishes the new bounded window.
     */
    resetSource(clipId: number): void;
    /**
     * Drain pending page-miss requests, fetch the missing pages plus their
     * read-ahead window, and evict out-of-window pages. Resolves once this round's
     * fetches settle. Concurrent fetches are serialized inside each binding.
     */
    pump(): Promise<void>;
    /** Close every registered clip's binding and stop tracking. */
    close(): void;
    private serviceFrontier;
    private resetState;
    private clearPage;
}
export interface OpfsClipStreamOptions extends OpfsClipPageProviderOptions {
    /** Clip schedule id used in `setClips` (matches the page-miss request clipId). */
    clipId: number;
    /**
     * Leading pages fetched synchronously before returning, so playback can start
     * without an immediate miss. Default 1.
     */
    primePages?: number;
}
export interface OpfsClipStream {
    binding: OpfsClipPageProviderBinding;
    /** Pass as `addClip`'s buffer argument to schedule the streaming clip. */
    provider: ClipPageProvider;
}
/** Structural seam implemented by the AudioWorklet-backed `SonareEngine`. */
export interface WorkletOpfsClipStreamHost {
    attachOpfsClipStream(options: OpfsClipStreamOptions): Promise<OpfsClipStream>;
}
/**
 * One-call wiring of an OPFS-backed streaming clip: creates the page provider,
 * primes the leading pages, and registers it with `streamer` so later misses are
 * serviced within the bounded window. Returns the binding (for `close`) and the
 * provider to schedule via `addClip(trackId, provider, startPpq, { id: clipId })`.
 *
 * @param streamer Shared streamer pumped on the control thread.
 * @param engine Engine the provider is created on (the same one `streamer` drives).
 * @param options Provider options plus `clipId` and optional `primePages`.
 */
export declare function attachOpfsClipStream(streamer: ClipPageStreamer, engine: RealtimeEngine, options: OpfsClipStreamOptions): Promise<OpfsClipStream>;
/**
 * Worklet overload: delegates to `SonareEngine.attachOpfsClipStream`, which
 * creates the remote provider and drives this same sliding-window policy from
 * worklet page-miss messages.
 */
export declare function attachOpfsClipStream(engine: WorkletOpfsClipStreamHost, options: OpfsClipStreamOptions): Promise<OpfsClipStream>;
