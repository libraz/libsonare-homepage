import type { AnalyzerStats, FrameBuffer, StreamConfig, StreamConfigDefaults, StreamFramesI16, StreamFramesU8, StreamQuantizeConfig } from './stream_types';
export declare function streamAnalyzerConfigDefaults(): StreamConfigDefaults;
/**
 * Real-time streaming audio analyzer.
 *
 * @example
 * ```typescript
 * import { init, StreamAnalyzer } from '@libraz/libsonare';
 *
 * await init();
 *
 * const analyzer = new StreamAnalyzer({ sampleRate: 44100 });
 *
 * // In audio processing callback
 * analyzer.process(samples);
 *
 * // Get current analysis state
 * const stats = analyzer.stats();
 * console.log('BPM:', stats.estimate.bpm);
 * console.log('Key:', stats.estimate.key);
 * console.log('Chord progression:', stats.estimate.chordProgression);
 * ```
 *
 * The native analyzer supports one serialized producer (`process`,
 * `processWithOffset`, or `finalize`) concurrently with one serialized consumer
 * (`availableFrames`, a `readFrames*` method, `stats`, `frameCount`, or
 * `currentTime`) when a threaded WASM host shares the native instance.
 * Publication is allocation-free release/acquire. `reset`, setters, and
 * deletion require both roles to be stopped. A full pending ring drops the
 * newly produced output frame while analysis totals keep advancing. Ordinary
 * browser builds remain single-threaded unless the host explicitly provisions
 * shared-memory worker support.
 */
export declare class StreamAnalyzer {
    private analyzer;
    /**
     * Create a new StreamAnalyzer.
     *
     * @param config - Configuration options
     */
    constructor(config?: StreamConfig);
    /**
     * Process audio samples.
     *
     * Feeding a finalized analyzer is an invalid-state error; call `reset()`
     * first to start a new stream.
     *
     * @param samples - Audio samples (mono, float32)
     */
    process(samples: Float32Array): void;
    /**
     * Process audio samples with a contiguous explicit sample offset. A gap,
     * seek, or switch from `process()` requires `reset()` first, as does feeding
     * a finalized analyzer.
     *
     * @param samples - Audio samples (mono, float32)
     * @param sampleOffset - Cumulative sample count at start of this chunk
     */
    processWithOffset(samples: Float32Array, sampleOffset: number): void;
    /**
     * Drain any high-rate resampler tail, then zero-pad the final partial frame.
     *
     * Repeating a successful call is a no-op, and a call that fails leaves the
     * stream un-finalized so a retry resumes from the same point. Call `reset()`
     * before reusing the analyzer for another stream: more audio fed to a
     * finalized analyzer is rejected rather than silently analyzed without the
     * overlap context the finalized tail consumed.
     */
    finalize(): void;
    /**
     * Get the number of frames available to read.
     */
    availableFrames(): number;
    /**
     * Read processed frames as Structure of Arrays.
     *
     * @param maxFrames - Maximum number of frames to read
     * @returns Frame buffer with analysis results
     */
    readFrames(maxFrames: number): FrameBuffer;
    /**
     * Read frames as uint8-quantized arrays.
     *
     * @param maxFrames - Maximum number of frames to read
     * @param quantizeConfig - Optional quantization ranges; widen these for a
     *   stream louder or quieter than the defaults (omitted keeps the defaults)
     */
    readFramesU8(maxFrames: number, quantizeConfig?: StreamQuantizeConfig): StreamFramesU8;
    /**
     * Read frames as int16-quantized arrays.
     *
     * @param maxFrames - Maximum number of frames to read
     * @param quantizeConfig - Optional quantization ranges; widen these for a
     *   stream louder or quieter than the defaults (omitted keeps the defaults)
     */
    readFramesI16(maxFrames: number, quantizeConfig?: StreamQuantizeConfig): StreamFramesI16;
    /**
     * Reset the analyzer state.
     *
     * @param baseSampleOffset - Starting sample offset (default 0)
     */
    reset(baseSampleOffset?: number): void;
    /**
     * Get current statistics and progressive estimates.
     *
     * @returns Analyzer statistics including BPM, key, and chord progression
     */
    stats(): AnalyzerStats;
    /**
     * Get total frames processed.
     */
    frameCount(): number;
    /**
     * Get current time position in seconds.
     */
    currentTime(): number;
    /**
     * Get the sample rate.
     */
    sampleRate(): number;
    /**
     * Set the expected total duration for pattern lock timing.
     *
     * @param durationSeconds - Total duration in seconds
     */
    setExpectedDuration(durationSeconds: number): void;
    /**
     * Set normalization gain for loud/compressed audio.
     *
     * Throws for a value outside 0.01..100 rather than clamping into it. The
     * usual recipe (`gain = targetLevel / measuredLevel`) can land outside that
     * range for a buffer that is not in the conventional ±1 float domain — an
     * integer-scaled one asks for about 3e-4 — and no getter exposes the
     * effective gain, so a clamped request would leave the analysis far off
     * target undetectably. Convert such a buffer before feeding it instead.
     *
     * @param gain - Gain factor to apply (e.g., 0.5 for -6dB reduction, range
     *   0.01..100)
     */
    setNormalizationGain(gain: number): void;
    /**
     * Set tuning reference frequency for non-standard tuning.
     *
     * Throws for a value outside 220..880 Hz rather than clamping into it, so
     * this and `tuningRefHz` at create time accept exactly the same range.
     *
     * @param refHz - Reference frequency for A4 (default 440 Hz, range 220..880)
     * @example
     * // If audio is 1 semitone sharp (A4 = 466.16 Hz)
     * analyzer.setTuningRefHz(466.16);
     * // If audio is 1 semitone flat (A4 = 415.30 Hz)
     * analyzer.setTuningRefHz(415.30);
     */
    setTuningRefHz(refHz: number): void;
    /** Release the underlying WASM object. Safe to call only once. */
    delete(): void;
    /** Alias for {@link delete}, provided for cross-binding (Node) compatibility. */
    destroy(): void;
    /** Alias for {@link delete}, kept for backward compatibility (historical name). */
    dispose(): void;
}
