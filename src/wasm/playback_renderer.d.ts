import type { PlaybackDiagnostics, PlaybackRendererConfig, PlaybackRendererOptions, RenderPlaybackRequest, RenderPlaybackResult } from './public_types_playback';
/**
 * An HRTF set (SHRF v1): the direct-sound impulse responses and inter-aural
 * time delays a headphones-target {@link PlaybackRenderer} convolves each
 * virtual speaker's signal with.
 *
 * This build embeds no HRTF data. The package ships the default set as the
 * asset `@libraz/libsonare/hrtf/default.shrf`; fetch or read it and pass the
 * bytes to {@link HrtfSet.fromBytes}. A renderer built from a set keeps its
 * own copy, so deleting the set right after construction is safe.
 *
 * @example
 * ```ts
 * const bytes = new Uint8Array(await (await fetch(hrtfUrl)).arrayBuffer());
 * const hrtf = HrtfSet.fromBytes(bytes);
 * const renderer = new PlaybackRenderer({ config: {}, hrtf, sampleRate: 48000 });
 * hrtf.delete();
 * ```
 */
export declare class HrtfSet {
    private native;
    private released;
    private constructor();
    /** Builds an HRTF set from SHRF v1 bytes; malformed data throws. */
    static fromBytes(bytes: Uint8Array): HrtfSet;
    /** Releases the native handle. Idempotent, as the Node facade is. */
    delete(): void;
    /** Alias for {@link delete}, provided for cross-binding (Node) compatibility. */
    destroy(): void;
}
/**
 * Renders decoded movie audio (mono / stereo / 5.1 / 7.1 PCM) to headphones
 * (binaural, head tracking, room model) or to stereo / 5.1 / 7.1 speakers
 * (upmix, loudness alignment, night-mode DRC, dialogue level, speaker
 * calibration, bass management).
 *
 * `config` follows `schemas/playback-renderer-config.schema.json`; see
 * {@link PlaybackRendererConfig}. A headphones target requires `hrtf`.
 *
 * `processPlanar` copies every plane through the embind boundary, so it suits
 * the main thread; like `processInterleaved`, a non-finite sample is replaced
 * with 0 and counted rather than refused. The AudioWorklet path is
 * `SonarePlaybackWorkletProcessor` in the worklet bundle.
 */
export declare class PlaybackRenderer {
    private native;
    private released;
    constructor(options: PlaybackRendererOptions);
    /**
     * Renders one planar block; every plane must carry the same frame count, at
     * most `maxBlockSize` (0 is a no-op). With a fixed input layout the plane
     * count must equal {@link inputChannels}; with `input.layout: "auto"` it
     * must be 1, 2, 6 or 8, and a change switches the input layout without
     * changing the latency. Non-finite input samples are replaced with 0 and
     * counted ({@link nonFiniteDiscardCount}).
     */
    processPlanar(planes: Float32Array[]): Float32Array[];
    /** Interleaved variant of {@link processPlanar}. Non-finite input samples are replaced with 0 and counted. */
    processInterleaved(samples: Float32Array, inChannels: number): Float32Array;
    /** Applies a complete configuration document; a changed prepare key throws. */
    setConfig(config: PlaybackRendererConfig | string): void;
    /** The current complete configuration document. */
    config(): PlaybackRendererConfig;
    /**
     * Publishes the listener head orientation in degrees: right-handed,
     * positive yaw turns the head right, positive pitch looks up, positive roll
     * lowers the right ear. Ignored by a speakers target; a non-finite angle is
     * ignored.
     */
    setHeadOrientation(yawDeg: number, pitchDeg?: number, rollDeg?: number): void;
    /**
     * Clears DSP state (filters, FIFOs, dynamics, convolution history, pending
     * input-layout drains). Configuration and head pose are kept. Call it after
     * a seek, from the thread that processes.
     */
    reset(): void;
    /**
     * Renderer latency in samples (headphones: near ear). Depends only on the
     * target, the sample rate and distance compensation, never on realtime keys
     * or the input layout.
     */
    latencySamples(): number;
    /**
     * Channel count of the active input layout. With `input.layout: "auto"`
     * this follows the channel count of the most recent non-empty process call
     * (2 before the first call).
     */
    inputChannels(): number;
    /** Channel count of the output target. */
    outputChannels(): number;
    /**
     * Inactive stages, per-stage latency, clamps, the active input layout, and
     * the layout-switch / truncated-drain counters, as a plain object.
     */
    diagnostics(): PlaybackDiagnostics;
    /** Non-finite input samples replaced with 0 since construction. */
    nonFiniteDiscardCount(): number;
    /** Releases the native handle. Idempotent, as the Node facade is. */
    delete(): void;
    /** Alias for {@link delete}, provided for cross-binding (Node) compatibility. */
    destroy(): void;
}
/**
 * Integrated-loudness meter for multichannel program material (BS.1770
 * channel weights by channel count: 1, 2, 6 or 8), for measuring
 * `loudness.program_lufs` ahead of a {@link PlaybackRenderer}.
 */
export declare class PlaybackLoudnessMeter {
    private native;
    private released;
    constructor(channels: number, sampleRate: number);
    /** Feeds interleaved frames of any length. */
    pushInterleaved(samples: Float32Array): void;
    /** Integrated loudness of everything pushed so far, in LUFS. */
    integratedLufs(): number;
    /** Releases the native handle. Idempotent, as the Node facade is. */
    delete(): void;
    /** Alias for {@link delete}, provided for cross-binding (Node) compatibility. */
    destroy(): void;
}
/**
 * Offline one-shot playback render: builds a renderer internally, feeds the
 * whole interleaved signal through it, and removes the renderer's own latency
 * so the output aligns with the input frame for frame.
 * An empty or non-finite `samples` is refused with an `InvalidParameter` error.
 */
export declare function renderPlayback(request: RenderPlaybackRequest): RenderPlaybackResult;
