/**
 * Source decomposition and self-similarity segmentation: NMF factorisation and
 * the masks built over it, and the recurrence structure of a track.
 */
import type { SegmentMatrix } from './public_types';
import type { WasmDecomposeResult, WasmHpssWithResidualResult, WasmMatrix2dResult } from './sonare.js';
export interface DecomposeRequest {
    s: Float32Array;
    nFeatures: number;
    nFrames: number;
    nComponents: number;
    nIter?: number;
    beta?: number;
}
export interface DecomposeWithInitRequest extends DecomposeRequest {
    init?: 'random' | 'nndsvd';
}
export interface NnFilterRequest {
    s: Float32Array;
    nFeatures: number;
    nFrames: number;
    aggregate?: string;
    k?: number;
    width?: number;
}
export interface SegmentCrossSimilarityRequest {
    x: Float32Array;
    xRows: number;
    xCols: number;
    y: Float32Array;
    yRows: number;
    yCols: number;
    k?: number;
    metric?: 'cosine' | 'euclidean';
    mode?: 'connectivity' | 'affinity';
}
export interface SegmentRecurrenceMatrixRequest {
    data: Float32Array;
    rows: number;
    cols: number;
    k?: number;
    width?: number;
    sym?: boolean;
    metric?: 'cosine' | 'euclidean';
    mode?: 'connectivity' | 'affinity';
}
export interface SegmentRecurrenceToLagRequest {
    recurrence: Float32Array;
    n: number;
    pad?: boolean;
}
export interface SegmentLagToRecurrenceRequest {
    lag: Float32Array;
    rows: number;
    lags: number;
}
export interface SegmentSubsegmentRequest {
    data: Float32Array;
    rows: number;
    cols: number;
    boundaries: Int32Array;
    nSegments?: number;
}
export interface SegmentAgglomerativeRequest {
    data: Float32Array;
    rows: number;
    cols: number;
    k: number;
    linkage?: 'average' | 'single' | 'complete' | 'ward';
}
export interface SegmentPathEnhanceRequest {
    recurrence: Float32Array;
    n: number;
    win: number;
    maxRatio?: number;
    minRatio?: number;
    nFilters?: number;
}
export interface RemixRequest {
    samples: Float32Array;
    intervals: Int32Array | ArrayLike<number>;
    sampleRate?: number;
    alignZeros?: boolean;
}
export interface HpssWithResidualRequest {
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
/**
 * Non-negative matrix factorisation of a flattened [nFeatures x nFrames]
 * spectrogram (librosa.decompose.decompose). Returns the W and H factors.
 */
export declare function decompose(request: DecomposeRequest): WasmDecomposeResult;
export declare function decompose(s: Float32Array, nFeatures: number, nFrames: number, nComponents: number, nIter?: number, beta?: number): WasmDecomposeResult;
/**
 * Non-negative matrix factorisation with a selectable initialiser
 * (librosa.decompose.decompose, `init`). Identical to {@link decompose} but
 * exposes the initialisation strategy: `'random'` (default, deterministic seed)
 * or `'nndsvd'` (SVD-based warm start, which tends to converge in fewer
 * iterations). Returns the W and H factors.
 */
export declare function decomposeWithInit(request: DecomposeWithInitRequest): WasmDecomposeResult;
export declare function decomposeWithInit(s: Float32Array, nFeatures: number, nFrames: number, nComponents: number, nIter?: number, beta?: number, init?: 'random' | 'nndsvd'): WasmDecomposeResult;
/** Options for {@link decomposeStems}. */
export interface DecomposeStemsRequest {
    samples: Float32Array;
    sampleRate: number;
    /** Number of NMF components (default 4). */
    nComponents?: number;
    /** STFT size (default 2048). */
    nFft?: number;
    /** STFT hop (default 512). */
    hopLength?: number;
    /** NMF multiplicative-update iterations (default 100). */
    nIter?: number;
    /** Beta divergence: 2 = Frobenius (default), 1 = Kullback-Leibler. */
    beta?: number;
    /** NMF initialisation (default `'random'`). */
    init?: 'random' | 'nndsvd';
    /**
     * Soft-mask exponent (default 1). 1 keeps the magnitude ratio; 2 is the
     * Wiener-style power ratio, which separates harder at the cost of more
     * artefacts on overlapping partials. Must be >= 1.
     */
    maskPower?: number;
}
/** One time-domain signal per NMF component, plus the factorisation. */
export interface DecomposeStemsResult {
    /** Component signals, each the length of the input. */
    components: Float32Array[];
    /** Component matrix [nBins x nComponents], row-major. */
    w: Float32Array;
    /** Activation matrix [nComponents x nFrames], row-major. */
    h: Float32Array;
    sampleRate: number;
}
/**
 * NMF separation that **carries the original phase**, so each component is
 * directly listenable.
 *
 * {@link decompose} returns the W/H factors of a magnitude spectrogram, which
 * have no phase; reconstructing from them needs a phase estimator
 * ({@link griffinLim}), and an estimated phase does not hold up as a stem. This
 * instead builds a per-component soft mask from the factorisation and applies
 * it to the original complex spectrogram. The masks sum to one wherever the
 * model has energy and the inverse STFT is linear, so the components sum back
 * to the input.
 */
export declare function decomposeStems(request: DecomposeStemsRequest): DecomposeStemsResult;
/** Request form of {@link decomposeStemsLinked}. */
export interface DecomposeStemsLinkedRequest {
    /** At least one channel; all the same length. */
    channels: Float32Array[];
    sampleRate?: number;
    /** Number of NMF components (default 4). */
    nComponents?: number;
    /** STFT size (default 2048). */
    nFft?: number;
    /** STFT hop (default 512). */
    hopLength?: number;
    /** NMF multiplicative-update iterations (default 100). */
    nIter?: number;
    /** Beta divergence: 2 = Frobenius (default), 1 = Kullback-Leibler. */
    beta?: number;
    /** NMF initialisation (default `'random'`). */
    init?: 'random' | 'nndsvd';
    /** Soft-mask exponent (default 1); see {@link DecomposeStemsRequest.maskPower}. */
    maskPower?: number;
}
/** One time-domain signal per (component, channel), plus the factorisation. */
export interface DecomposeStemsLinkedResult {
    /**
     * Component signals: `components[k][c]` is component `k`'s signal on
     * channel `c`, each the length of the input.
     */
    components: Float32Array[][];
    /** Component matrix [nBins x nComponents], row-major. */
    w: Float32Array;
    /** Activation matrix [nComponents x nFrames], row-major. */
    h: Float32Array;
    sampleRate: number;
}
/**
 * Multi-channel form of {@link decomposeStems}: one NMF model and one soft
 * mask shared across every channel, built from the channels' averaged
 * magnitude spectrogram and applied UNCHANGED to each channel's own complex
 * spectrum, so no interchannel level or phase difference moves. A single
 * channel reproduces {@link decomposeStems} bit for bit.
 *
 * @throws On a null/empty channel set, mismatched channel lengths, a channel
 *   count above the core's ceiling, or an invalid option.
 */
export declare function decomposeStemsLinked(request: DecomposeStemsLinkedRequest): DecomposeStemsLinkedResult;
/**
 * Nearest-neighbour filtering of a flattened [nFeatures x nFrames] spectrogram
 * (librosa.decompose.nn_filter).
 */
export declare function nnFilter(request: NnFilterRequest): WasmMatrix2dResult;
export declare function nnFilter(s: Float32Array, nFeatures: number, nFrames: number, aggregate?: string, k?: number, width?: number): WasmMatrix2dResult;
/**
 * Reorder/concatenate a signal by interval slices (librosa.effects.remix).
 *
 * With `alignZeros` the boundaries snap to the signal's zero-crossings. That is
 * a per-signal decision, so calling this per channel snaps each channel to a
 * different frame and drifts a stereo take apart; resolve one cut set with
 * {@link remixAlignedIntervals} and apply it to every channel instead.
 *
 * @param intervals - Flat (start, end) sample pairs (even length).
 */
export declare function remix(request: RemixRequest): Float32Array;
export declare function remix(samples: Float32Array, intervals: Int32Array | ArrayLike<number>, sampleRate?: number, alignZeros?: boolean): Float32Array;
/**
 * Resolve the cut points {@link remix} would use, without cutting.
 *
 * Returns a flat `Int32Array` of one clamped `(start, end)` pair per input
 * interval. With `alignZeros` each boundary snaps to the nearest zero-crossing,
 * with two guards that stop a slice from vanishing: a signal with no sign
 * change at all (silence, a DC offset, any constant) is not snapped, and a
 * slice that had content but collapses to empty after snapping keeps its
 * unsnapped boundaries.
 *
 * Use this to cut a multichannel take on one common frame set: resolve once
 * from one channel, then slice every channel with the returned pairs.
 *
 * @param intervals - Flat (start, end) sample pairs (even length).
 */
export declare function remixAlignedIntervals(request: RemixRequest): Int32Array;
export declare function remixAlignedIntervals(samples: Float32Array, intervals: Int32Array | ArrayLike<number>, sampleRate?: number, alignZeros?: boolean): Int32Array;
/**
 * HPSS into harmonic / percussive / residual signals.
 *
 * The three outputs always add back up to the input. `residual` is silent under
 * the default soft mask, whose two masks sum to one, so `harmonic` and
 * `percussive` already carry everything; it is returned anyway so the result
 * shape does not change with the mask. Pass `hardMask: true` for a residual that
 * holds signal — its thresholded masks leave the band where neither component
 * dominates, measured at 3 % of the input energy on a voice-plus-kick signal.
 *
 * @example
 * ```ts
 * const soft = hpssWithResidual({ samples, sampleRate });
 * // soft.residual is silence
 * const hard = hpssWithResidual({ samples, sampleRate, hardMask: true });
 * // hard.residual carries what neither component claimed
 * ```
 *
 * @throws SonareError (`InvalidParameter`) on a kernel that is not an integer
 *   within the signed 32-bit range, or one the core rejects as even,
 *   non-positive or above its ceiling
 */
export declare function hpssWithResidual(request: HpssWithResidualRequest): WasmHpssWithResidualResult;
export declare function hpssWithResidual(samples: Float32Array, sampleRate?: number, kernelHarmonic?: number, kernelPercussive?: number, nFft?: number, hopLength?: number, hardMask?: boolean): WasmHpssWithResidualResult;
/** Column-wise cross-similarity (librosa.segment.cross_similarity). */
export declare function segmentCrossSimilarity(request: SegmentCrossSimilarityRequest): SegmentMatrix;
/** Self-similarity recurrence matrix (librosa.segment.recurrence_matrix). */
export declare function segmentRecurrenceMatrix(request: SegmentRecurrenceMatrixRequest): SegmentMatrix;
/** Convert an `n × n` recurrence matrix to a lag matrix. */
export declare function segmentRecurrenceToLag(request: SegmentRecurrenceToLagRequest): SegmentMatrix;
/** Convert a lag matrix back to an `n × n` recurrence matrix. */
export declare function segmentLagToRecurrence(request: SegmentLagToRecurrenceRequest): SegmentMatrix;
/** Refine frame boundaries by clustering within each parent segment. */
export declare function segmentSubsegment(request: SegmentSubsegmentRequest): Int32Array;
/** Cluster feature columns and return one label per column. */
export declare function segmentAgglomerative(request: SegmentAgglomerativeRequest): Int32Array;
/** Enhance diagonal paths in an `n × n` recurrence matrix. */
export declare function segmentPathEnhance(request: SegmentPathEnhanceRequest): SegmentMatrix;
