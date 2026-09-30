import type { RealtimeVoiceChangerConfigInput, RealtimeVoiceChangerPodConfig, VoicePresetId } from './public_types';
/**
 * Zero-copy realtime buffer pair for {@link RealtimeVoiceChanger} mono
 * processing. The `input` / `output` `Float32Array`s are typed-memory views
 * onto the WASM heap — write samples into `input`, call `process()`, then
 * read from `output`. The views are owned by the {@link RealtimeVoiceChanger}
 * and remain valid until `delete()` is called on it.
 */
export interface RealtimeVoiceChangerMonoBuffer {
    input: Float32Array;
    output: Float32Array;
    process: () => void;
}
/**
 * Zero-copy realtime buffer pair for {@link RealtimeVoiceChanger} interleaved
 * multi-channel processing. Layout is L0,R0,L1,R1,... for stereo. The views
 * are owned by the {@link RealtimeVoiceChanger}.
 */
export interface RealtimeVoiceChangerInterleavedBuffer {
    input: Float32Array;
    output: Float32Array;
    channels: number;
    process: () => void;
}
/**
 * Zero-copy realtime buffer for {@link RealtimeVoiceChanger} planar stereo
 * processing. Each entry in `channels` is a heap-backed `Float32Array` for one
 * channel (matching AudioWorklet's native layout). Process happens in place:
 * write samples into each channel view, call `process()`, then read back from
 * the same views.
 */
export interface RealtimeVoiceChangerPlanarBuffer {
    channels: Float32Array[];
    process: () => void;
}
export declare class RealtimeVoiceChanger {
    private changer;
    private released;
    /**
     * Creates a voice changer. Supplying `sampleRate` prepares it immediately,
     * matching the Node and Python constructors; omitting it preserves the
     * explicit {@link prepare} lifecycle for callers that configure later.
     */
    constructor(config?: RealtimeVoiceChangerConfigInput | RealtimeVoiceChangerPodConfig, sampleRate?: number, maxBlockSize?: number, channels?: number);
    prepare(sampleRate: number, maxBlockSize?: number, channels?: number): void;
    reset(): void;
    setConfig(config: RealtimeVoiceChangerConfigInput | RealtimeVoiceChangerPodConfig): void;
    /**
     * Apply a flat, pre-normalized config without JSON serialization. Intended
     * for AudioWorklet control messages whose sender prepared the POD on the
     * main thread.
     */
    setPodConfig(config: RealtimeVoiceChangerPodConfig): void;
    configJson(): string;
    latencySamples(): number;
    /**
     * Channel-blocks in which the chain discarded its own state because a
     * non-finite value had reached it.
     *
     * Advisory telemetry, and the only thing that separates a degraded stream
     * from a clean one. Every stage of this chain leaves an in-domain finite
     * value where a non-finite one was — the input scrub and the
     * inter-sample-peak limiter substitute silence, the sample-domain limiter
     * folds an infinity onto its ceiling — so the output stays finite, in range
     * and free of any error while carrying samples unrelated to the input. A
     * non-zero count is what says the samples in between were not computed from
     * what you supplied.
     *
     * Monotonic for the lifetime of the instance. The unit is one processed
     * block, never a channel, so a stereo block that discards on both channels
     * adds one and the number does not depend on a dimension you did not choose.
     *
     * @example
     * ```ts
     * changer.processInterleaved(block, 2);
     * if (changer.nonFiniteDiscardCount() > 0) {
     *   // the audio just produced is not a function of `block`
     * }
     * ```
     */
    nonFiniteDiscardCount(): number;
    /**
     * Monotonically increases whenever {@link prepare} can replace the native
     * scratch buffers. Cached WASM heap views must be reacquired after it changes.
     */
    bufferGeneration(): number;
    processMono(samples: Float32Array): Float32Array;
    processMonoInto(samples: Float32Array, output: Float32Array): void;
    processInterleaved(samples: Float32Array, channels: number): Float32Array;
    processInterleavedInto(samples: Float32Array, channels: number, output: Float32Array): void;
    /**
     * Acquire a typed-memory view onto the WASM heap for mono input.
     *
     * Write your input samples into the returned `Float32Array` directly (e.g.
     * via `input.set(source)`); no copy crosses the JS↔C++ bridge until
     * {@link processPreparedMono} is called. The view is owned by this
     * RealtimeVoiceChanger and becomes invalid after {@link delete}; it may
     * also be invalidated if you later call this method with a larger
     * `numSamples` value (the underlying buffer may be reallocated).
     */
    getMonoInputBuffer(numSamples: number): Float32Array;
    /** Mono output view counterpart to {@link getMonoInputBuffer}. */
    getMonoOutputBuffer(numSamples: number): Float32Array;
    /**
     * Process the previously-acquired mono input buffer in place. The output
     * appears in the buffer returned by {@link getMonoOutputBuffer}. No JS↔C++
     * sample-level crossings happen on this call — it just hands control to
     * the underlying DSP on already-on-heap data.
     */
    processPreparedMono(numSamples: number): void;
    /** Interleaved input view (layout L0,R0,L1,R1,...). */
    getInterleavedInputBuffer(numFrames: number, numChannels: number): Float32Array;
    /** Interleaved output view counterpart. */
    getInterleavedOutputBuffer(numFrames: number, numChannels: number): Float32Array;
    /**
     * Process the previously-acquired interleaved buffer in place. Output
     * appears in the buffer returned by {@link getInterleavedOutputBuffer}.
     */
    processPreparedInterleaved(numFrames: number, numChannels: number): void;
    /**
     * Planar-channel input/output view (one Float32Array per channel). Matches
     * AudioWorklet's native layout; processing happens in place.
     */
    getPlanarChannelBuffer(channel: number, numFrames: number): Float32Array;
    /**
     * Process the previously-acquired planar channel buffers in place. Each
     * channel must have been obtained from {@link getPlanarChannelBuffer}
     * with the same `numFrames`. Output replaces input in the same buffers.
     */
    processPreparedPlanar(numFrames: number): void;
    /**
     * Convenience factory for the mono zero-copy path: returns the input/output
     * heap views plus a `process()` thunk wired to the same `numSamples`. The
     * views are reused across calls and become invalid after {@link delete}.
     */
    createRealtimeMonoBuffer(numSamples: number): RealtimeVoiceChangerMonoBuffer;
    /** Same as {@link createRealtimeMonoBuffer} but for interleaved I/O. */
    createRealtimeInterleavedBuffer(numFrames: number, numChannels: number): RealtimeVoiceChangerInterleavedBuffer;
    /**
     * Convenience factory for the planar zero-copy path. Acquires one
     * heap-backed Float32Array per channel and returns a `process()` thunk
     * wired to the same `numFrames`. Buffers are reused across calls and
     * become invalid after {@link delete}.
     */
    createRealtimePlanarBuffer(numFrames: number, numChannels: number): RealtimeVoiceChangerPlanarBuffer;
    /** Releases the native handle. Idempotent, as the Node facade is. */
    delete(): void;
    /** Alias for {@link delete}, provided for cross-binding (Node) compatibility. */
    destroy(): void;
}
export declare function realtimeVoiceChangerPresetNames(): VoicePresetId[];
export declare function realtimeVoiceChangerPresetJson(name: VoicePresetId): string;
export declare function validateRealtimeVoiceChangerPresetJson(json: string): {
    ok: boolean;
    normalizedJson?: string;
    error?: string;
};
