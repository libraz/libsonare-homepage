/**
 * Frame-level spectral descriptors: the scalar shape measures taken per STFT
 * frame, and the zero-crossing counts beside them.
 */
import type { WasmMatrix2dResult } from './sonare.js';
/** Canonical request form for frame-based spectral feature extraction. */
export interface SpectralFrameRequest {
    samples: Float32Array;
    sampleRate?: number;
    nFft?: number;
    hopLength?: number;
}
export interface SpectralRolloffRequest extends SpectralFrameRequest {
    rollPercent?: number;
}
export interface ZeroCrossingRateRequest {
    samples: Float32Array;
    sampleRate?: number;
    frameLength?: number;
    hopLength?: number;
}
export interface SpectralContrastRequest extends SpectralFrameRequest {
    nBands?: number;
    fmin?: number;
    quantile?: number;
}
export interface PolyFeaturesRequest extends SpectralFrameRequest {
    order?: number;
}
export interface ZeroCrossingsRequest {
    samples: Float32Array;
    threshold?: number;
    refMagnitude?: boolean;
    pad?: boolean;
    zeroPos?: boolean;
}
/**
 * Compute spectral centroid (center of mass of spectrum).
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param nFft - FFT size (default: 2048)
 * @param hopLength - Hop length (default: 512)
 * @returns Spectral centroid in Hz for each frame
 */
export declare function spectralCentroid(request: SpectralFrameRequest): Float32Array;
export declare function spectralCentroid(samples: Float32Array, sampleRate?: number, nFft?: number, hopLength?: number): Float32Array;
/**
 * Compute spectral contrast (librosa.feature.spectral_contrast).
 *
 * @remarks
 * Band 0 spans `[0, fmin]`, so an `fmin` below one analysis bin
 * (`sampleRate / nFft`) leaves it empty after the band trim. Row 0 is still
 * finite, but comes from the other bands' extremes rather than from itself, and
 * is neither level-invariant nor confined to the band. Keep `fmin` at or above
 * one bin width for row 0 to mean anything — at the defaults (22050 Hz, 2048)
 * one bin is 10.8 Hz, so only a small `nFft` or a tiny `fmin` reaches this.
 *
 * @returns Matrix2d of shape (nBands + 1) x nFrames.
 */
export declare function spectralContrast(request: SpectralContrastRequest): WasmMatrix2dResult;
export declare function spectralContrast(samples: Float32Array, sampleRate?: number, nFft?: number, hopLength?: number, nBands?: number, fmin?: number, quantile?: number): WasmMatrix2dResult;
/**
 * Fit per-frame polynomial coefficients (librosa.feature.poly_features).
 *
 * @returns Matrix2d of shape (order + 1) x nFrames.
 */
export declare function polyFeatures(request: PolyFeaturesRequest): WasmMatrix2dResult;
export declare function polyFeatures(samples: Float32Array, sampleRate?: number, nFft?: number, hopLength?: number, order?: number): WasmMatrix2dResult;
/**
 * Locate zero-crossing indices of a signal (librosa.zero_crossings).
 */
export declare function zeroCrossings(request: ZeroCrossingsRequest): Int32Array;
export declare function zeroCrossings(samples: Float32Array, threshold?: number, refMagnitude?: boolean, pad?: boolean, zeroPos?: boolean): Int32Array;
/**
 * Compute spectral bandwidth.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param nFft - FFT size (default: 2048)
 * @param hopLength - Hop length (default: 512)
 * @returns Spectral bandwidth in Hz for each frame
 */
export declare function spectralBandwidth(request: SpectralFrameRequest & {
    p?: number;
}): Float32Array;
export declare function spectralBandwidth(samples: Float32Array, sampleRate?: number, nFft?: number, hopLength?: number, p?: number): Float32Array;
/**
 * Compute spectral rolloff frequency.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param nFft - FFT size (default: 2048)
 * @param hopLength - Hop length (default: 512)
 * @param rollPercent - Percentage threshold (default: 0.85)
 * @returns Rolloff frequency in Hz for each frame
 */
export declare function spectralRolloff(request: SpectralRolloffRequest): Float32Array;
export declare function spectralRolloff(samples: Float32Array, sampleRate?: number, nFft?: number, hopLength?: number, rollPercent?: number): Float32Array;
/**
 * Compute spectral flatness.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param nFft - FFT size (default: 2048)
 * @param hopLength - Hop length (default: 512)
 * @returns Spectral flatness for each frame (0 = tonal, 1 = noise-like)
 */
export declare function spectralFlatness(request: SpectralFrameRequest): Float32Array;
export declare function spectralFlatness(samples: Float32Array, sampleRate?: number, nFft?: number, hopLength?: number): Float32Array;
export declare function spectralFlux(request: SpectralFrameRequest & {
    lag?: number;
}): Float32Array;
export declare function spectralFlux(samples: Float32Array, sampleRate?: number, nFft?: number, hopLength?: number, lag?: number): Float32Array;
/**
 * Compute zero crossing rate.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param frameLength - Frame length (default: 2048)
 * @param hopLength - Hop length (default: 512)
 * @returns Zero crossing rate for each frame
 */
export declare function zeroCrossingRate(request: ZeroCrossingRateRequest): Float32Array;
export declare function zeroCrossingRate(samples: Float32Array, sampleRate?: number, frameLength?: number, hopLength?: number): Float32Array;
/**
 * Compute RMS energy.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param frameLength - Frame length (default: 2048)
 * @param hopLength - Hop length (default: 512)
 * @returns RMS energy for each frame
 */
export declare function rmsEnergy(request: ZeroCrossingRateRequest): Float32Array;
export declare function rmsEnergy(samples: Float32Array, sampleRate?: number, frameLength?: number, hopLength?: number): Float32Array;
