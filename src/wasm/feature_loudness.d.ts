/**
 * Programme loudness over interleaved audio, as the broadcast standards define
 * it.
 */
import type { WasmLufsResult, WasmLufsSeriesResult } from './sonare.js';
import type { ValidateOptions } from './validation';
export interface LufsInterleavedRequest extends ValidateOptions {
    samples: Float32Array;
    channels: number;
    sampleRate?: number;
}
export interface LufsSeriesInterleavedRequest extends ValidateOptions {
    samples: Float32Array;
    channels: number;
    sampleRate?: number;
}
export interface Ebur128LoudnessRangeRequest extends ValidateOptions {
    samples: Float32Array;
    sampleRate?: number;
}
/**
 * Channel-weighted multichannel integrated loudness + LRA (ITU-R BS.1770 /
 * EBU R128) from an interleaved buffer of `frames * channels` samples. The
 * per-channel frame count is derived from the buffer length and `channels`.
 *
 * Pass the buffer's actual `sampleRate`: the default (22050) is non-standard for
 * audio, and K-weighting is sample-rate dependent, so a wrong rate yields wrong
 * loudness.
 */
export declare function lufsInterleaved(request: LufsInterleavedRequest): WasmLufsResult;
export declare function lufsInterleaved(samples: Float32Array, channels: number, sampleRate?: number, options?: ValidateOptions): WasmLufsResult;
/**
 * Per-block momentary (400 ms) and short-term (3 s) LUFS series for an
 * interleaved buffer of `frames * channels` samples, measured with ITU-R
 * BS.1770-4 channel summing. The per-channel frame count is derived from the
 * buffer length and `channels`.
 *
 * This is not recoverable from `momentaryLufs` / `shortTermLufs`: those measure
 * one channel each, and the standard sums the K-weighted per-channel block
 * energies rather than mixing per-channel loudness in dB. Both series come out
 * of one K-weighting pass. For `channels === 1` they match the mono meters
 * element for element.
 *
 * Pass the buffer's actual `sampleRate`: the default (22050) is non-standard for
 * audio, and K-weighting is sample-rate dependent, so a wrong rate yields wrong
 * loudness.
 *
 * @example
 * ```ts
 * const { momentary, shortTerm } = lufsSeriesInterleaved({
 *   samples: interleavedStereo,
 *   channels: 2,
 *   sampleRate: 48000,
 * });
 * ```
 */
export declare function lufsSeriesInterleaved(request: LufsSeriesInterleavedRequest): WasmLufsSeriesResult;
export declare function lufsSeriesInterleaved(samples: Float32Array, channels: number, sampleRate?: number, options?: ValidateOptions): WasmLufsSeriesResult;
/**
 * Standards-compliant EBU R128 loudness range (LRA) in LU. Pass the buffer's
 * actual `sampleRate`: the default (22050) is non-standard and K-weighting is
 * sample-rate dependent.
 */
export declare function ebur128LoudnessRange(request: Ebur128LoudnessRangeRequest): number;
export declare function ebur128LoudnessRange(samples: Float32Array, sampleRate?: number): number;
