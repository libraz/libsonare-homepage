import type { MasteringChainConfig, MasteringChainResult, MasteringChainStereoResult, MasteringPreset } from './public_types';
import type { ProgressCallback } from './sonare.js';
import type { ValidateOptions } from './validation';
export type NormalizeMode = 'peak' | 'rms';
export interface NormalizeRequest extends ValidateOptions {
    samples: Float32Array;
    sampleRate?: number;
    targetDb?: number;
    mode?: NormalizeMode;
}
/**
 * Normalize audio to a target peak or RMS level.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param targetDb - Finite target at or below 0 dBFS (default: 0 dB = full scale).
 *   For `mode: 'peak'`, this is the peak target; for `mode: 'rms'`, this is the RMS target.
 * @param mode - Normalization mode: `'peak'` (default) or `'rms'`.
 * @returns Normalized audio
 */
export declare function normalize(request: NormalizeRequest): Float32Array;
export declare function normalize(samples: Float32Array, sampleRate: number, targetDb?: number, options?: ValidateOptions): Float32Array;
export declare function normalize(samples: Float32Array, sampleRate: number, targetDb?: number, mode?: NormalizeMode, options?: ValidateOptions): Float32Array;
export interface NormalizeStereoRequest extends ValidateOptions {
    left: Float32Array;
    right: Float32Array;
    sampleRate?: number;
    targetDb?: number;
    mode?: NormalizeMode;
}
/** A normalized channel pair and the gain both channels were moved by. */
export interface NormalizeStereoResult {
    left: Float32Array;
    right: Float32Array;
    /**
     * One figure rather than a pair: the gain is one decision shared by both
     * channels. Silence leaves the pair untouched and reports 0.
     */
    appliedGainDb: number;
}
/**
 * Normalize a stereo pair on a gain measured across both channels.
 *
 * Normalizing the two channels separately lifts the quieter one until the peaks
 * match, which changes the balance rather than the level. The level here is read
 * from the pair and the resulting gain goes to both channels, so the image is
 * preserved: for `mode: 'peak'` the louder channel reaches `targetDb` and the
 * other keeps its distance from it; for `mode: 'rms'` the quantity driven to
 * `targetDb` is the root mean square over both channels' samples together — the
 * quadratic mean of the per-channel figures, not their average — and the output
 * is hard-clipped to [-1, 1].
 *
 * @param request.left - Left channel samples (float32)
 * @param request.right - Right channel samples, same length as `left`
 * @param request.sampleRate - Sample rate in Hz (default: 22050)
 * @param request.targetDb - Finite target at or below 0 dBFS. Defaults to 0 for
 *   `mode: 'peak'` and -20 for `mode: 'rms'`, matching the library and the other
 *   language surfaces.
 * @param request.mode - `'peak'` (default) or `'rms'`
 * @returns The normalized pair and the shared gain in dB
 * @throws RangeError when the two channels differ in length
 *
 * @example
 * ```ts
 * const { left, right, appliedGainDb } = normalizeStereo({
 *   left: leftSamples,
 *   right: rightSamples,
 *   sampleRate: 44100,
 *   targetDb: -1,
 * });
 * ```
 */
export declare function normalizeStereo(request: NormalizeStereoRequest): NormalizeStereoResult;
export interface MasteringChainRequest {
    samples: Float32Array;
    sampleRate?: number;
    config?: MasteringChainConfig;
    onProgress?: ProgressCallback;
    cancel?: () => boolean;
}
export interface MasteringChainStereoRequest {
    left: Float32Array;
    right: Float32Array;
    sampleRate?: number;
    config?: MasteringChainConfig;
    onProgress?: ProgressCallback;
    cancel?: () => boolean;
}
/** Canonical request form for one-shot preset mastering. */
export interface MasterAudioRequest {
    samples: Float32Array;
    sampleRate?: number;
    preset?: MasteringPreset;
    overrides?: MasteringChainConfig;
    onProgress?: ProgressCallback;
    cancel?: () => boolean;
}
/** Canonical request form for one-shot stereo preset mastering. */
export interface MasterAudioStereoRequest {
    left: Float32Array;
    right: Float32Array;
    sampleRate?: number;
    preset?: MasteringPreset;
    overrides?: MasteringChainConfig;
    onProgress?: ProgressCallback;
    cancel?: () => boolean;
}
/**
 * Apply a configurable mastering chain in WASM.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param config - Chain stage configuration
 * @returns Processed audio, loudness metadata, and applied stage names
 */
export declare function masteringChain(request: MasteringChainRequest): MasteringChainResult;
export declare function masteringChain(samples: Float32Array, sampleRate?: number, config?: MasteringChainConfig, onProgress?: ProgressCallback): MasteringChainResult;
/**
 * Apply a configurable stereo mastering chain in WASM.
 *
 * @param left - Left channel samples
 * @param right - Right channel samples
 * @param sampleRate - Sample rate in Hz
 * @param config - Chain stage configuration
 * @returns Processed stereo audio, loudness metadata, and applied stage names
 */
export declare function masteringChainStereo(request: MasteringChainStereoRequest): MasteringChainStereoResult;
export declare function masteringChainStereo(left: Float32Array, right: Float32Array, sampleRate?: number, config?: MasteringChainConfig, onProgress?: ProgressCallback): MasteringChainStereoResult;
/**
 * Apply a configurable mastering chain in WASM with progress reporting.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param config - Chain stage configuration
 * @param onProgress - Progress callback (progress: 0-1, stage: string)
 * @returns Processed audio, loudness metadata, and applied stage names
 */
export declare function masteringChainWithProgress(request: MasteringChainRequest & Required<Pick<MasteringChainRequest, 'onProgress'>>): MasteringChainResult;
export declare function masteringChainWithProgress(samples: Float32Array, sampleRate?: number, config?: MasteringChainConfig, onProgress?: ProgressCallback): MasteringChainResult;
/**
 * Apply a configurable stereo mastering chain in WASM with progress reporting.
 *
 * @param left - Left channel samples
 * @param right - Right channel samples
 * @param sampleRate - Sample rate in Hz
 * @param config - Chain stage configuration
 * @param onProgress - Progress callback (progress: 0-1, stage: string)
 * @returns Processed stereo audio, loudness metadata, and applied stage names
 */
export declare function masteringChainStereoWithProgress(request: MasteringChainStereoRequest & Required<Pick<MasteringChainStereoRequest, 'onProgress'>>): MasteringChainStereoResult;
export declare function masteringChainStereoWithProgress(left: Float32Array, right: Float32Array, sampleRate?: number, config?: MasteringChainConfig, onProgress?: ProgressCallback): MasteringChainStereoResult;
/**
 * List built-in mastering preset identifiers.
 *
 * @returns Preset names in display order (e.g. "pop", "edm", "aiMusic")
 */
export declare function masteringPresetNames(): MasteringPreset[];
/**
 * The flat `{key: number|boolean}` params of preset `preset`'s built-in chain
 * configuration, in the same key space {@link masteringAssistantSuggestChain}
 * returns. Passing this straight through as `overrides` to {@link masterAudio}
 * reproduces the preset unchanged, bit for bit in the C++ core.
 *
 * @param preset - Preset identifier from {@link masteringPresetNames}.
 * @throws For an unknown `preset`.
 */
export declare function masteringPresetParams(preset: MasteringPreset): Record<string, number | boolean>;
/**
 * List the delivery targets the mastering assistant accepts as `targetPlatform`.
 *
 * Read from the library rather than from a list kept here, so a target added in
 * the core is discoverable without a binding change.
 *
 * @returns Target names in index order (e.g. "streaming", "broadcast", "club")
 */
export declare function masteringPlatformNames(): string[];
/**
 * Apply a named mastering preset chain to mono audio.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param presetName - Preset identifier from {@link masteringPresetNames}
 * @param overrides - Optional nested {@link MasteringChainConfig} applied on top of the preset (e.g. `{ loudness: { targetLufs: -14 } }`). Pass `null` for preset defaults.
 * @param onProgress - Optional per-stage progress callback (progress: 0-1, stage: string).
 * @returns Processed audio, loudness metadata, and applied stage names
 */
export declare function masterAudio(request: MasterAudioRequest): MasteringChainResult;
export declare function masterAudio(samples: Float32Array, sampleRate?: number, presetName?: MasteringPreset, overrides?: MasteringChainConfig, onProgress?: ProgressCallback): MasteringChainResult;
/**
 * Apply a named mastering preset chain to stereo audio.
 *
 * @param left - Left channel samples
 * @param right - Right channel samples
 * @param sampleRate - Sample rate in Hz
 * @param presetName - Preset identifier from {@link masteringPresetNames}
 * @param overrides - Optional nested {@link MasteringChainConfig} applied on top of the preset (e.g. `{ loudness: { targetLufs: -14 } }`). Pass `null` for preset defaults.
 * @param onProgress - Optional per-stage progress callback (progress: 0-1, stage: string).
 * @returns Processed stereo audio, loudness metadata, and applied stage names
 */
export declare function masterAudioStereo(request: MasterAudioStereoRequest): MasteringChainStereoResult;
export declare function masterAudioStereo(left: Float32Array, right: Float32Array, sampleRate?: number, presetName?: MasteringPreset, overrides?: MasteringChainConfig, onProgress?: ProgressCallback): MasteringChainStereoResult;
/**
 * Mono `masterAudio` with per-stage progress reporting. `onProgress` is invoked
 * with `(progress, stage)` between each chain stage (progress is in [0,1]).
 */
export declare function masterAudioWithProgress(request: MasterAudioRequest & Required<Pick<MasterAudioRequest, 'onProgress'>>): MasteringChainResult;
export declare function masterAudioWithProgress(samples: Float32Array, sampleRate?: number, presetName?: MasteringPreset, overrides?: MasteringChainConfig | null, onProgress?: ProgressCallback): MasteringChainResult;
/**
 * Stereo `masterAudio` with per-stage progress reporting.
 */
export declare function masterAudioStereoWithProgress(request: MasterAudioStereoRequest & Required<Pick<MasterAudioStereoRequest, 'onProgress'>>): MasteringChainStereoResult;
export declare function masterAudioStereoWithProgress(left: Float32Array, right: Float32Array, sampleRate?: number, presetName?: MasteringPreset, overrides?: MasteringChainConfig | null, onProgress?: ProgressCallback): MasteringChainStereoResult;
