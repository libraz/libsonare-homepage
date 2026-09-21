import type { AnalyzeSectionsOptions, BoundaryOptions, BoundaryResult, CqtResult, LufsResult, MelodyResult, OnsetStrengthMultiResult, Section } from './public_types';
import type { WasmFourierTempogramResult, WasmNnlsChromaResult } from './sonare.js';
import type { ValidateOptions } from './validation';
type GuardedOptions = ValidateOptions;
type AnalyzeSectionsGuardedOptions = AnalyzeSectionsOptions & ValidateOptions;
type BoundaryGuardedOptions = BoundaryOptions & ValidateOptions;
type MelodyGuardedOptions = MelodyOptions & ValidateOptions;
/** Canonical request form shared by the Constant-Q transform variants. */
export interface CqtRequest extends GuardedOptions {
    samples: Float32Array;
    sampleRate?: number;
    hopLength?: number;
    fmin?: number;
    nBins?: number;
    binsPerOctave?: number;
}
/** Canonical request form for {@link vqt}. */
export interface VqtRequest extends CqtRequest {
    gamma?: number;
}
export interface OnsetEnvelopeRequest extends GuardedOptions {
    samples: Float32Array;
    sampleRate?: number;
    nFft?: number;
    hopLength?: number;
    nMels?: number;
}
export interface OnsetStrengthMultiRequest extends OnsetEnvelopeRequest {
    nBands?: number;
}
export interface FourierTempogramRequest extends GuardedOptions {
    onsetEnvelope: Float32Array;
    sampleRate?: number;
    hopLength?: number;
    winLength?: number;
    center?: boolean;
    norm?: boolean;
}
export interface TempogramRatioRequest extends GuardedOptions {
    tempogramData: Float32Array;
    winLength?: number;
    sampleRate?: number;
    hopLength?: number;
    factors?: Float32Array | number[];
}
export interface CqtToAudioRequest extends GuardedOptions {
    magnitude: Float32Array;
    nBins: number;
    nFrames: number;
    sampleRate?: number;
    hopLength?: number;
    fmin?: number;
    binsPerOctave?: number;
    nIter?: number;
}
export interface VqtToAudioRequest extends CqtToAudioRequest {
    gamma?: number;
}
export interface AnalyzeSectionsRequest extends AnalyzeSectionsGuardedOptions {
    samples: Float32Array;
    sampleRate?: number;
}
/** Canonical (and only) call form for {@link detectBoundaries}. */
export interface DetectBoundariesRequest extends BoundaryGuardedOptions {
    samples: Float32Array;
    sampleRate?: number;
}
export interface AnalyzeMelodyRequest extends MelodyGuardedOptions {
    samples: Float32Array;
    sampleRate?: number;
}
export interface LufsRequest extends ValidateOptions {
    samples: Float32Array;
    sampleRate?: number;
}
export interface NnlsChromaRequest extends GuardedOptions {
    samples: Float32Array;
    sampleRate?: number;
    enableStftBlend?: boolean;
    stftBlendWeight?: number;
    stftBlendNFft?: number;
    hopLength?: number;
}
/**
 * Compute NNLS (non-negative least squares) chromagram.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @returns NNLS chroma result
 */
export declare function nnlsChroma(request: NnlsChromaRequest): WasmNnlsChromaResult;
export declare function nnlsChroma(samples: Float32Array, sampleRate?: number, options?: Omit<NnlsChromaRequest, 'samples' | 'sampleRate'>): WasmNnlsChromaResult;
/**
 * Compute the Constant-Q Transform magnitude.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param hopLength - Hop length (default: 512)
 * @param fmin - Minimum frequency in Hz (default: 32.70319566257483, C1)
 * @param nBins - Number of frequency bins (default: 84)
 * @param binsPerOctave - Bins per octave (default: 12)
 * @returns CQT magnitude result
 */
export declare function cqt(request: CqtRequest): CqtResult;
export declare function cqt(samples: Float32Array, sampleRate?: number, hopLength?: number, fmin?: number, nBins?: number, binsPerOctave?: number, options?: GuardedOptions): CqtResult;
/**
 * Compute the pseudo Constant-Q Transform magnitude.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param hopLength - Hop length (default: 512)
 * @param fmin - Minimum frequency in Hz (default: 32.70319566257483, C1)
 * @param nBins - Number of frequency bins (default: 84)
 * @param binsPerOctave - Bins per octave (default: 12)
 * @returns CQT magnitude result
 */
export declare function pseudoCqt(request: CqtRequest): CqtResult;
export declare function pseudoCqt(samples: Float32Array, sampleRate?: number, hopLength?: number, fmin?: number, nBins?: number, binsPerOctave?: number, options?: GuardedOptions): CqtResult;
/**
 * Compute the hybrid Constant-Q Transform magnitude.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param hopLength - Hop length (default: 512)
 * @param fmin - Minimum frequency in Hz (default: 32.70319566257483, C1)
 * @param nBins - Number of frequency bins (default: 84)
 * @param binsPerOctave - Bins per octave (default: 12)
 * @returns CQT magnitude result
 */
export declare function hybridCqt(request: CqtRequest): CqtResult;
export declare function hybridCqt(samples: Float32Array, sampleRate?: number, hopLength?: number, fmin?: number, nBins?: number, binsPerOctave?: number, options?: GuardedOptions): CqtResult;
/**
 * Compute the Variable-Q Transform magnitude (gamma controls Q).
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param hopLength - Hop length (default: 512)
 * @param fmin - Minimum frequency in Hz (default: 32.70319566257483, C1)
 * @param nBins - Number of frequency bins (default: 84)
 * @param binsPerOctave - Bins per octave (default: 12)
 * @param gamma - Bandwidth offset; a negative value or NaN selects the automatic
 *   ERB-derived value, while 0 is equivalent to CQT (default: -1)
 * @returns VQT magnitude result (same shape as CQT)
 */
export declare function vqt(request: VqtRequest): CqtResult;
export declare function vqt(samples: Float32Array, sampleRate?: number, hopLength?: number, fmin?: number, nBins?: number, binsPerOctave?: number, gamma?: number, options?: GuardedOptions): CqtResult;
/** Reconstruct mono audio from row-major CQT magnitude via Griffin-Lim. */
export declare function cqtToAudio(request: CqtToAudioRequest): Float32Array;
export declare function cqtToAudio(magnitude: Float32Array, nBins: number, nFrames: number, sampleRate?: number, hopLength?: number, fmin?: number, binsPerOctave?: number, nIter?: number, options?: GuardedOptions): Float32Array;
/** Reconstruct mono audio from row-major VQT magnitude via Griffin-Lim. */
export declare function vqtToAudio(request: VqtToAudioRequest): Float32Array;
export declare function vqtToAudio(magnitude: Float32Array, nBins: number, nFrames: number, sampleRate?: number, hopLength?: number, fmin?: number, binsPerOctave?: number, gamma?: number, nIter?: number, options?: GuardedOptions): Float32Array;
/**
 * Detect song-structure sections (intro/verse/chorus/...).
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param nFft - FFT size (default: 2048)
 * @param hopLength - Hop length (default: 512)
 * @param minSectionSec - Minimum section duration in seconds (default: 4.0)
 * @returns Array of detected sections
 */
export declare function analyzeSections(request: AnalyzeSectionsRequest): Section[];
export declare function analyzeSections(samples: Float32Array, sampleRate?: number, options?: AnalyzeSectionsGuardedOptions): Section[];
/**
 * Detect structural boundaries and return the novelty curve behind them.
 *
 * This is the unlabelled layer {@link analyzeSections} is built on, not a
 * coarser view of its output: sections are labelled spans, these are the
 * transitions plus the continuous curve they were picked from, so a caller
 * applying its own threshold needs this and cannot derive it from a section
 * list.
 *
 * @param request - Samples, sample rate and {@link BoundaryOptions}
 * @returns The boundaries, the novelty curve, and the analysis grid they live on
 * @throws {@link SonareError} with `InvalidParameter` when both `useMfcc` and
 * `useChroma` are `false`: the two feature streams are combined frame-for-frame,
 * so with neither enabled there is nothing to combine.
 *
 * @example
 * ```ts
 * const { boundaries, noveltyCurve, noveltyPeak } = detectBoundaries({
 *   samples,
 *   sampleRate: 44100,
 *   absoluteThreshold: 0.01,
 * });
 * // `noveltyCurve` is scaled by its own maximum; recover the raw response with
 * // `noveltyCurve[i] * noveltyPeak`.
 * ```
 */
export declare function detectBoundaries(request: DetectBoundariesRequest): BoundaryResult;
/** Options for {@link analyzeMelody}. All fields are optional. */
export interface MelodyOptions {
    /** Lowest f0 (Hz) the tracker will consider. Default 65 (≈ C2). */
    fmin?: number;
    /** Highest f0 (Hz) the tracker will consider. Default 2093 (≈ C7). */
    fmax?: number;
    /** Analysis frame length in samples. Default 2048. */
    frameLength?: number;
    /** Hop length between frames in samples. Default 256. */
    hopLength?: number;
    /** Voicing confidence threshold in [0,1]; frames below are unvoiced. Default 0.1. */
    threshold?: number;
    /**
     * Use the pYIN tracker (Viterbi-smoothed) instead of plain per-frame YIN.
     * Produces a less octave-jumpy contour. Defaults to `false`.
     */
    usePyin?: boolean;
    /**
     * When {@link usePyin} is `true`, zero-pad by `frameLength / 2` so frame
     * `i` is centered at `i * hopLength` (matches `librosa.pyin(center=True)`).
     * Ignored by the plain-YIN path. Defaults to `true`.
     */
    center?: boolean;
}
/**
 * Extract the melody contour from monophonic audio via YIN (or pYIN).
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param options - Tracker + tuning options ({@link MelodyOptions})
 * @returns Melody contour with per-frame pitch points and summary stats
 */
export declare function analyzeMelody(request: AnalyzeMelodyRequest): MelodyResult;
export declare function analyzeMelody(samples: Float32Array, sampleRate?: number, options?: MelodyGuardedOptions): MelodyResult;
/**
 * Compute the onset strength envelope.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param nFft - FFT size (default: 2048)
 * @param hopLength - Hop length (default: 512)
 * @param nMels - Number of Mel bands (default: 128)
 * @returns Onset envelope for each frame
 */
export declare function onsetEnvelope(request: OnsetEnvelopeRequest): Float32Array;
export declare function onsetEnvelope(samples: Float32Array, sampleRate?: number, nFft?: number, hopLength?: number, nMels?: number, options?: GuardedOptions): Float32Array;
/**
 * Compute multi-band onset strength envelopes.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param nFft - FFT size (default: 2048)
 * @param hopLength - Hop length (default: 512)
 * @param nMels - Number of Mel bands (default: 128)
 * @param nBands - Number of onset bands (default: 3)
 * @returns Multi-band onset matrix
 */
export declare function onsetStrengthMulti(request: OnsetStrengthMultiRequest): OnsetStrengthMultiResult;
export declare function onsetStrengthMulti(samples: Float32Array, sampleRate?: number, nFft?: number, hopLength?: number, nMels?: number, nBands?: number, options?: GuardedOptions): OnsetStrengthMultiResult;
/**
 * Compute the Fourier tempogram from an onset envelope.
 *
 * @param onsetEnvelope - Onset strength envelope (float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param hopLength - Hop length (default: 512)
 * @param winLength - Window length in frames (default: 384)
 * @returns Fourier tempogram result
 */
export declare function fourierTempogram(request: FourierTempogramRequest): WasmFourierTempogramResult;
export declare function fourierTempogram(onsetEnvelope: Float32Array, sampleRate?: number, hopLength?: number, winLength?: number, center?: boolean, norm?: boolean, options?: GuardedOptions): WasmFourierTempogramResult;
/**
 * Compute tempogram ratio features.
 *
 * @param tempogramData - Tempogram data (float32)
 * @param winLength - Window length in frames (default: 384)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param hopLength - Hop length (default: 512)
 * @param factors - Lag ratios to evaluate. When omitted or empty, the library
 *   default {0.5, 1, 2, 3, 4} is used.
 * @returns Tempogram ratio features (one value per factor)
 */
export declare function tempogramRatio(request: TempogramRatioRequest): Float32Array;
export declare function tempogramRatio(tempogramData: Float32Array, winLength?: number, sampleRate?: number, hopLength?: number, factors?: Float32Array | number[], options?: GuardedOptions): Float32Array;
/**
 * Measure loudness (EBU R128 / ITU-R BS.1770).
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz. The default (22050) is non-standard for
 *   audio; pass the buffer's actual rate, as K-weighting is sample-rate
 *   dependent and a wrong rate yields wrong loudness.
 * @returns Loudness measurement result
 */
export declare function lufs(request: LufsRequest): LufsResult;
export declare function lufs(samples: Float32Array, sampleRate?: number, options?: ValidateOptions): LufsResult;
/**
 * Compute the momentary loudness (LUFS) over time.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz. The default (22050) is non-standard and
 *   K-weighting is sample-rate dependent; pass the buffer's actual rate.
 * @returns Momentary LUFS values over time
 */
export declare function momentaryLufs(request: LufsRequest): Float32Array;
export declare function momentaryLufs(samples: Float32Array, sampleRate?: number, options?: ValidateOptions): Float32Array;
/**
 * Compute the short-term loudness (LUFS) over time.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz. The default (22050) is non-standard and
 *   K-weighting is sample-rate dependent; pass the buffer's actual rate.
 * @returns Short-term LUFS values over time
 */
export declare function shortTermLufs(request: LufsRequest): Float32Array;
export declare function shortTermLufs(samples: Float32Array, sampleRate?: number, options?: ValidateOptions): Float32Array;
export {};
