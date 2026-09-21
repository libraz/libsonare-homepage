/**
 * Inverse transforms: reconstructing a linear spectrogram or audio from a mel
 * or MFCC representation, and the phase reconstruction they share.
 */
import type { GuardedOptions } from './_feature_validation';
import type { SpectralFrameRequest } from './feature_spectral';
import type { MelPowerResult, StftPowerResult } from './public_types';
export interface MfccToMelRequest extends GuardedOptions {
    mfccCoefficients: Float32Array;
    nMfcc: number;
    nFrames: number;
    nMels?: number;
    /** Lifter used by the forward MFCC transform; zero means no liftering. */
    lifter?: number;
}
/** Canonical request form for reconstruction from a Mel power spectrogram. */
export interface MelToStftRequest extends GuardedOptions {
    melPower: Float32Array;
    nMels: number;
    nFrames: number;
    sampleRate?: number;
    nFft?: number;
    fmin?: number;
    fmax?: number;
    htk?: boolean;
}
/** Canonical request form for Griffin-Lim reconstruction from Mel power. */
export interface MelToAudioRequest extends MelToStftRequest {
    hopLength?: number;
    nIter?: number;
}
export interface GriffinLimRequest extends GuardedOptions {
    magnitude: Float32Array;
    nBins: number;
    nFrames: number;
    sampleRate?: number;
    nFft?: number;
    hopLength?: number;
    nIter?: number;
    momentum?: number;
}
/** Canonical request form for Griffin-Lim reconstruction from MFCCs. */
export interface MfccToAudioRequest extends MfccToMelRequest {
    sampleRate?: number;
    nFft?: number;
    hopLength?: number;
    fmin?: number;
    fmax?: number;
    nIter?: number;
    htk?: boolean;
}
/**
 * Approximate inverse of a Mel filterbank: Mel power spectrogram -> STFT power
 * spectrogram. Mirrors `feature::mel_to_stft`.
 *
 * @param melPower - Mel power spectrogram [nMels x nFrames] row-major
 * @param nMels - Number of Mel bands
 * @param nFrames - Number of time frames
 * @param sampleRate - Sample rate in Hz
 * @param nFft - FFT size (default: 2048)
 * @param fmin - Lower Mel band edge in Hz (default: 0)
 * @param fmax - Upper Mel band edge in Hz (default: sr/2 when 0)
 * @param htk - Use the HTK Mel formula instead of Slaney (default: false)
 * @returns STFT power spectrogram result
 */
export declare function melToStft(request: MelToStftRequest): StftPowerResult;
export declare function melToStft(melPower: Float32Array, nMels: number, nFrames: number, sampleRate?: number, nFft?: number, fmin?: number, fmax?: number, htk?: boolean, options?: GuardedOptions): StftPowerResult;
/**
 * Reconstruct audio from a Mel power spectrogram via Griffin-Lim. Mirrors
 * `feature::mel_to_audio`.
 *
 * @param melPower - Mel power spectrogram [nMels x nFrames] row-major
 * @param nMels - Number of Mel bands
 * @param nFrames - Number of time frames
 * @param sampleRate - Sample rate in Hz
 * @param nFft - FFT size (default: 2048)
 * @param hopLength - Hop length (default: 512)
 * @param fmin - Minimum Mel frequency in Hz (default: 0)
 * @param fmax - Maximum Mel frequency in Hz (default: 0 = sr/2)
 * @param nIter - Griffin-Lim iterations (default: 32)
 * @param htk - Use the HTK Mel formula instead of Slaney (default: false)
 * @returns Reconstructed audio samples (mono, float32)
 */
export declare function melToAudio(request: MelToAudioRequest): Float32Array;
export declare function melToAudio(melPower: Float32Array, nMels: number, nFrames: number, sampleRate?: number, nFft?: number, hopLength?: number, fmin?: number, fmax?: number, nIter?: number, htk?: boolean, options?: GuardedOptions): Float32Array;
/** Reconstruct audio from an STFT magnitude matrix via Griffin-Lim. */
export declare function griffinLim(request: GriffinLimRequest): Float32Array;
export declare function griffinLim(magnitude: Float32Array, nBins: number, nFrames: number, sampleRate?: number, nFft?: number, hopLength?: number, nIter?: number, momentum?: number, options?: GuardedOptions): Float32Array;
/**
 * Invert MFCC coefficients back to a Mel power spectrogram. Mirrors
 * `feature::mfcc_to_mel`.
 *
 * @param mfccCoefficients - MFCC matrix [nMfcc x nFrames] row-major
 * @param nMfcc - Number of MFCC coefficients
 * @param nFrames - Number of time frames
 * @param nMels - Number of Mel bins to reconstruct (default: 128)
 * @returns Mel power spectrogram result
 */
export declare function mfccToMel(request: MfccToMelRequest): MelPowerResult;
export declare function mfccToMel(mfccCoefficients: Float32Array, nMfcc: number, nFrames: number, nMels?: number, lifter?: number, options?: GuardedOptions): MelPowerResult;
/**
 * Reconstruct audio directly from MFCC coefficients via Griffin-Lim. Mirrors
 * `feature::mfcc_to_audio`.
 *
 * @param mfccCoefficients - MFCC matrix [nMfcc x nFrames] row-major
 * @param nMfcc - Number of MFCC coefficients
 * @param nFrames - Number of time frames
 * @param nMels - Number of Mel bins (default: 128)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param nFft - FFT size (default: 2048)
 * @param hopLength - Hop length (default: 512)
 * @param fmin - Minimum Mel frequency in Hz (default: 0)
 * @param fmax - Maximum Mel frequency in Hz (default: 0 = sr/2)
 * @param nIter - Griffin-Lim iterations (default: 32)
 * @param htk - Use the HTK Mel formula instead of Slaney (default: false)
 * @returns Reconstructed audio samples (mono, float32)
 */
export declare function mfccToAudio(request: MfccToAudioRequest): Float32Array;
export declare function mfccToAudio(mfccCoefficients: Float32Array, nMfcc: number, nFrames: number, nMels?: number, sampleRate?: number, nFft?: number, hopLength?: number, fmin?: number, fmax?: number, nIter?: number, htk?: boolean, lifter?: number, options?: GuardedOptions): Float32Array;
export interface PhaseVocoderRequest extends SpectralFrameRequest {
    rate: number;
}
/**
 * Phase-vocoder time-scale modification (rate > 1 faster, < 1 slower).
 */
export declare function phaseVocoder(request: PhaseVocoderRequest): Float32Array;
export declare function phaseVocoder(samples: Float32Array, sampleRate: number, rate: number, nFft?: number, hopLength?: number): Float32Array;
