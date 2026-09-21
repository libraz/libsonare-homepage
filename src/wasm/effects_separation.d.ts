/**
 * Harmonic/percussive separation: the masked split and the two shortcuts
 * that return a single component.
 */
import type { HpssResult } from './public_types';
import type { ValidateOptions } from './validation';
/** Canonical request form for HPSS. */
export interface HpssRequest {
    samples: Float32Array;
    sampleRate?: number;
    /**
     * Horizontal median filter size, in STFT frames: a positive odd integer at
     * most 524287. Default 31. The ceiling is 524288 and an even kernel is
     * refused, so 524287 is the largest legal value.
     */
    kernelHarmonic?: number;
    /** Vertical median filter size, in STFT bins, under the same rule. Default 31. */
    kernelPercussive?: number;
    nFft?: number;
    hopLength?: number;
    hardMask?: boolean;
}
export interface HarmonicRequest extends ValidateOptions {
    samples: Float32Array;
    sampleRate?: number;
}
export interface PercussiveRequest extends ValidateOptions {
    samples: Float32Array;
    sampleRate?: number;
}
/**
 * Perform Harmonic-Percussive Source Separation (HPSS).
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param kernelHarmonic - Horizontal median filter size in STFT frames; a
 *   positive odd integer at most 524287 (default: 31)
 * @param kernelPercussive - Vertical median filter size in STFT bins, under the
 *   same rule (default: 31)
 * @returns Separated harmonic and percussive components
 * @throws SonareError (`InvalidParameter`) on a kernel that is not an integer
 *   within the signed 32-bit range, or one the core rejects as even,
 *   non-positive or above its ceiling
 */
export declare function hpss(request: HpssRequest): HpssResult;
export declare function hpss(samples: Float32Array, sampleRate?: number, kernelHarmonic?: number, kernelPercussive?: number, nFft?: number, hopLength?: number, hardMask?: boolean): HpssResult;
/**
 * Extract harmonic component from audio.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz
 * @returns Harmonic component
 */
export declare function harmonic(request: HarmonicRequest): Float32Array;
export declare function harmonic(samples: Float32Array, sampleRate?: number, options?: ValidateOptions): Float32Array;
/**
 * Extract percussive component from audio.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz
 * @returns Percussive component
 */
export declare function percussive(request: PercussiveRequest): Float32Array;
export declare function percussive(samples: Float32Array, sampleRate?: number, options?: ValidateOptions): Float32Array;
