/**
 * Spectrogram and chroma representations, and the silence trim that shares
 * their input checks.
 */
import type { GuardedOptions } from './_feature_validation';
import type { ChromaResult, MelSpectrogramResult, MfccResult, ReassignedSpectrogramResult, StftResult } from './public_types';
/** Canonical request form for basic frame-based spectrogram features. */
export interface SpectrogramRequest extends GuardedOptions {
    samples: Float32Array;
    sampleRate?: number;
    nFft?: number;
    hopLength?: number;
}
/**
 * Options for the constant-Q chroma variants.
 *
 * Carries no `nFft`: these are built on a constant-Q transform, which resolves
 * frequency through per-bin filter lengths rather than a framed FFT, so there
 * is no FFT size to set. Use `chroma` for the STFT-framed chromagram.
 */
export interface ChromaSpectrogramRequest extends GuardedOptions {
    samples: Float32Array;
    sampleRate?: number;
    hopLength?: number;
    nChroma?: number;
    binsPerOctave?: number;
}
/**
 * Options for the bass-focused chroma.
 *
 * Unlike {@link ChromaSpectrogramRequest} this carries no `binsPerOctave`: the
 * bass chroma fixes its bin count and its lowest frequency together, so the
 * resolution is not independently settable through this entry point.
 */
export interface BassChromaSpectrogramRequest extends GuardedOptions {
    samples: Float32Array;
    sampleRate?: number;
    hopLength?: number;
    nChroma?: number;
}
export interface MelSpectrogramRequest extends SpectrogramRequest {
    nMels?: number;
    fmin?: number;
    fmax?: number;
    htk?: boolean;
}
export interface MfccRequest extends MelSpectrogramRequest {
    nMfcc?: number;
    lifter?: number;
}
export interface MelDeltaRequest extends GuardedOptions {
    features: Float32Array;
    nFeatures: number;
    nFrames: number;
    width?: number;
}
export interface ReassignedSpectrogramRequest extends SpectrogramRequest {
    refPower?: number;
    fillNan?: boolean;
}
export interface TrimRequest extends GuardedOptions {
    samples: Float32Array;
    sampleRate: number;
    thresholdDb?: number;
    frameLength?: number;
    hopLength?: number;
}
/**
 * Trim silence from beginning and end of audio.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz
 * @param thresholdDb - Silence threshold in dB (default: -60 dB)
 * @returns Trimmed audio
 */
export declare function trim(request: TrimRequest): Float32Array;
export declare function trim(samples: Float32Array, sampleRate: number, thresholdDb?: number, options?: GuardedOptions): Float32Array;
export declare function trim(samples: Float32Array, sampleRate: number, thresholdDb?: number, frameLength?: number, hopLength?: number, options?: GuardedOptions): Float32Array;
/**
 * Compute Short-Time Fourier Transform (STFT).
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param nFft - FFT size (default: 2048)
 * @param hopLength - Hop length (default: 512)
 * @returns STFT result with magnitude and power spectrograms
 */
export declare function stft(request: SpectrogramRequest): StftResult;
export declare function stft(samples: Float32Array, sampleRate?: number, nFft?: number, hopLength?: number, options?: GuardedOptions): StftResult;
/**
 * Compute STFT and return magnitude in decibels.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param nFft - FFT size (default: 2048)
 * @param hopLength - Hop length (default: 512)
 * @returns STFT result with dB values
 */
export declare function stftDb(request: SpectrogramRequest): {
    nBins: number;
    nFrames: number;
    db: Float32Array;
};
export declare function stftDb(samples: Float32Array, sampleRate?: number, nFft?: number, hopLength?: number, options?: GuardedOptions): {
    nBins: number;
    nFrames: number;
    db: Float32Array;
};
/**
 * Compute Chroma Energy Normalized Statistics.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param hopLength - Hop length (default: 512)
 * @param nChroma - Number of chroma bins (default: 12)
 * @returns Chroma result
 */
export declare function chromaCens(request: ChromaSpectrogramRequest): ChromaResult;
export declare function chromaCens(samples: Float32Array, sampleRate?: number, hopLength?: number, nChroma?: number, binsPerOctave?: number, options?: GuardedOptions): ChromaResult;
/**
 * Compute a constant-Q chromagram (librosa.feature.chroma_cqt).
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param hopLength - Hop length (default: 512)
 * @param nChroma - Number of chroma bins (default: 12)
 * @returns Chroma result
 */
export declare function chromaCqt(request: ChromaSpectrogramRequest): ChromaResult;
export declare function chromaCqt(samples: Float32Array, sampleRate?: number, hopLength?: number, nChroma?: number, binsPerOctave?: number, options?: GuardedOptions): ChromaResult;
/**
 * Compute low-frequency bass chroma.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param hopLength - Hop length (default: 512)
 * @param nChroma - Number of chroma bins (default: 12)
 * @returns Chroma result
 */
export declare function bassChroma(request: BassChromaSpectrogramRequest): ChromaResult;
export declare function bassChroma(samples: Float32Array, sampleRate?: number, hopLength?: number, nChroma?: number, options?: GuardedOptions): ChromaResult;
/**
 * Compute Mel spectrogram.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param nFft - FFT size (default: 2048)
 * @param hopLength - Hop length (default: 512)
 * @param nMels - Number of Mel bands (default: 128)
 * @param fmin - Minimum Mel frequency in Hz (default: 0 = librosa default).
 *   Set with `fmax` to round-trip with `melToStft` / `melToAudio`.
 * @param fmax - Maximum Mel frequency in Hz (default: 0 = sampleRate / 2)
 * @param htk - Use the HTK Mel formula instead of Slaney (default: false)
 * @returns Mel spectrogram result
 */
export declare function melSpectrogram(request: MelSpectrogramRequest): MelSpectrogramResult;
export declare function melSpectrogram(samples: Float32Array, sampleRate?: number, nFft?: number, hopLength?: number, nMels?: number, fmin?: number, fmax?: number, htk?: boolean, options?: GuardedOptions): MelSpectrogramResult;
/**
 * Compute MFCC (Mel-Frequency Cepstral Coefficients).
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param nFft - FFT size (default: 2048)
 * @param hopLength - Hop length (default: 512)
 * @param nMels - Number of Mel bands (default: 128)
 * @param nMfcc - Number of MFCC coefficients (default: 20)
 * @param fmin - Minimum Mel frequency in Hz (default: 0 = librosa default)
 * @param fmax - Maximum Mel frequency in Hz (default: 0 = sampleRate / 2)
 * @param htk - Use the HTK Mel formula instead of Slaney (default: false)
 * @param lifter - Cepstral liftering coefficient (default: 0 = no liftering)
 * @returns MFCC result
 */
export declare function mfcc(request: MfccRequest): MfccResult;
export declare function mfcc(samples: Float32Array, sampleRate?: number, nFft?: number, hopLength?: number, nMels?: number, nMfcc?: number, fmin?: number, fmax?: number, htk?: boolean, lifter?: number, options?: GuardedOptions): MfccResult;
/** First-order regression delta of a row-major feature matrix. */
export declare function melDelta(request: MelDeltaRequest): Float32Array;
export declare function melDelta(features: Float32Array, nFeatures: number, nFrames: number, width?: number): Float32Array;
/** Auger-Flandrin reassigned spectrogram (row-major [nBins x nFrames] arrays). */
export declare function reassignedSpectrogram(request: ReassignedSpectrogramRequest): ReassignedSpectrogramResult;
export declare function reassignedSpectrogram(samples: Float32Array, sampleRate?: number, nFft?: number, hopLength?: number, refPower?: number, fillNan?: boolean): ReassignedSpectrogramResult;
/**
 * Compute STFT chromagram (librosa.feature.chroma_stft).
 *
 * The chroma filterbank uses a fixed tuning of 0 (concert A440). Unlike
 * librosa.feature.chroma_stft — which estimates tuning from the signal when none
 * is given — this does NOT auto-estimate and exposes no tuning argument, so
 * sharp/flat (non-A440) recordings smear across pitch classes. Estimate tuning
 * separately via {@link estimateTuning} if a non-A440 reference matters.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param nFft - FFT size (default: 2048)
 * @param hopLength - Hop length (default: 512)
 * @returns Chroma features result
 */
export declare function chroma(request: SpectrogramRequest): ChromaResult;
export declare function chroma(samples: Float32Array, sampleRate?: number, nFft?: number, hopLength?: number, options?: GuardedOptions): ChromaResult;
