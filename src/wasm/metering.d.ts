import type { ValidateOptions } from './validation';
/** One contiguous run of clipped samples reported by `meteringDetectClipping`. */
export interface ClippingRegion {
    startSample: number;
    endSample: number;
    length: number;
    peak: number;
}
/** Aggregated clipping report. */
export interface ClippingReport {
    clippedSamples: number;
    clippingRatio: number;
    maxClippedPeak: number;
    regions: ClippingRegion[];
}
/** Sliding-window dynamic range report. */
export interface DynamicRangeReport {
    dynamicRangeDb: number;
    lowPercentileDb: number;
    highPercentileDb: number;
    windowRmsDb: Float32Array;
}
/** Options for {@link meteringDetectClipping}. All fields are optional. */
export interface MeteringDetectClippingOptions extends ValidateOptions {
    /** Linear absolute threshold. Default 0.999. */
    threshold?: number;
    /** Minimum run length to report. Default 1. */
    minRegionSamples?: number;
}
/** Options for {@link meteringDynamicRange}. All fields are optional. */
export interface MeteringDynamicRangeOptions extends ValidateOptions {
    /** Window length in seconds (0 = library default, 3 s). Default 0. */
    windowSec?: number;
    /** Hop length in seconds (0 = library default, 1 s). Default 0. */
    hopSec?: number;
    /** Low percentile in [0,1] (negative = library default, 0.10). Default -1. */
    lowPercentile?: number;
    /** High percentile in [0,1] (negative = library default, 0.95). Default -1. */
    highPercentile?: number;
}
/** Canonical request form for single-channel meter readings. */
export interface MeteringSamplesRequest extends ValidateOptions {
    samples: Float32Array;
    sampleRate?: number;
}
/** Canonical request form for true-peak analysis. */
export interface MeteringTruePeakRequest extends MeteringSamplesRequest {
    oversampleFactor?: number;
}
/** Canonical request form for clipping analysis. */
export interface MeteringDetectClippingRequest extends MeteringDetectClippingOptions {
    samples: Float32Array;
    sampleRate?: number;
}
/** Canonical request form for dynamic-range analysis. */
export interface MeteringDynamicRangeRequest extends MeteringDynamicRangeOptions {
    samples: Float32Array;
    sampleRate?: number;
}
export declare function meteringPeakDb(request: MeteringSamplesRequest): number;
export declare function meteringPeakDb(samples: Float32Array, sampleRate?: number, options?: ValidateOptions): number;
export declare function meteringRmsDb(request: MeteringSamplesRequest): number;
export declare function meteringRmsDb(samples: Float32Array, sampleRate?: number, options?: ValidateOptions): number;
export interface MeteringSilenceRatioRequest extends MeteringSamplesRequest {
    thresholdDb?: number;
    frameLength?: number;
    hopLength?: number;
}
export declare function meteringSilenceRatio(request: MeteringSilenceRatioRequest): number;
export declare function meteringSilenceRatio(samples: Float32Array, sampleRate?: number, thresholdDb?: number, frameLength?: number, hopLength?: number, options?: ValidateOptions): number;
export declare function meteringCrestFactorDb(request: MeteringSamplesRequest): number;
export declare function meteringCrestFactorDb(samples: Float32Array, sampleRate?: number, options?: ValidateOptions): number;
/**
 * Crest factor in dB across both channels of a stereo pair.
 *
 * Takes the peak across both channels and the RMS over both together. An
 * out-of-phase pair cancels in the `0.5 * (left + right)` downmix
 * {@link meteringCrestFactorDb} would need, which understates its RMS and so
 * overstates the crest factor.
 */
export declare function meteringCrestFactorDbStereo(request: MeteringStereoRequest): number;
export declare function meteringDcOffset(request: MeteringSamplesRequest): number;
export declare function meteringDcOffset(samples: Float32Array, sampleRate?: number, options?: ValidateOptions): number;
/**
 * Inter-sample (true) peak in dBFS. `oversampleFactor` must be a power of two
 * in [1, 16]; pass 0 to use the library default (4).
 */
export declare function meteringTruePeakDb(request: MeteringTruePeakRequest): number;
export declare function meteringTruePeakDb(samples: Float32Array, sampleRate?: number, oversampleFactor?: number, options?: ValidateOptions): number;
/**
 * Detect contiguous runs of clipped samples.
 *
 * @param threshold Linear absolute threshold (default 0.999).
 * @param minRegionSamples Minimum run length to report (default 1).
 */
export declare function meteringDetectClipping(request: MeteringDetectClippingRequest): ClippingReport;
export declare function meteringDetectClipping(samples: Float32Array, sampleRate?: number, options?: MeteringDetectClippingOptions): ClippingReport;
/**
 * Sliding-window dynamic range for mono audio. Pass 0 for window/hop to use the library
 * default (window=3 s, hop=1 s). The percentiles use a NEGATIVE sentinel for
 * "use the library default" (low=0.10, high=0.95) because 0 is a literal 0th
 * percentile; omitted percentiles therefore default to -1.
 */
export declare function meteringDynamicRange(request: MeteringDynamicRangeRequest): DynamicRangeReport;
export declare function meteringDynamicRange(samples: Float32Array, sampleRate?: number, options?: MeteringDynamicRangeOptions): DynamicRangeReport;
/** Mid/side vectorscope point series for a (left, right) stereo pair. */
export interface VectorscopeReport {
    mid: Float32Array;
    side: Float32Array;
}
/** Phase-scope (Lissajous) point series plus summary stats. */
export interface PhaseScopeReport {
    mid: Float32Array;
    side: Float32Array;
    radius: Float32Array;
    angleRad: Float32Array;
    correlation: number;
    averageAbsAngleRad: number;
    maxRadius: number;
}
/** Options for `meteringSpectrum`. */
export interface SpectrumOptions {
    /** FFT size. Pass 0 / omit for the library default (2048). */
    nFft?: number;
    /** Apply fractional-octave smoothing to magnitude. */
    applyOctaveSmoothing?: boolean;
    /** Smoothing fraction (e.g. 3 = 1/3-octave). 0 / omit = library default (3). */
    octaveFraction?: number;
    /** Linear reference for the dB conversion. 0 / omit = 1.0. */
    dbRef?: number;
    /** Linear floor used to avoid log(0). 0 / omit = library default. */
    dbAmin?: number;
}
/** Single-frame magnitude / power / dB spectrum returned by `meteringSpectrum`. */
export interface SpectrumReport {
    frequencies: Float32Array;
    magnitude: Float32Array;
    power: Float32Array;
    db: Float32Array;
    nFft: number;
    sampleRate: number;
}
/** Options for {@link waveformPeaks}. All fields are optional. */
export interface WaveformPeaksOptions extends ValidateOptions {
    /** Bucket width in frames. Default 512. */
    samplesPerBucket?: number;
}
/** Options for {@link waveformPeakPyramid}. All fields are optional. */
export interface WaveformPeakPyramidOptions extends ValidateOptions {
    /** Bucket widths in frames, one per zoom level. Default [512, 1024, 2048, 4096]. */
    samplesPerBucketLevels?: number[];
}
/** Canonical request form for stereo meter readings. */
export interface MeteringStereoRequest extends ValidateOptions {
    left: Float32Array;
    right: Float32Array;
    sampleRate?: number;
}
/** Canonical request form for display-decimated stereo scopes. */
export interface MeteringStereoDecimatedRequest extends MeteringStereoRequest {
    maxPoints?: number;
}
/** Options for the scope functions (mirrors the Node `ScopeOptions`). */
export interface ScopeOptions extends ValidateOptions {
    /**
     * Upper bound on the returned point count. Omit / `0` (or a value `>= length`)
     * yields one point per input sample; otherwise the point cloud is
     * deterministically decimated to at most `maxPoints` points for display.
     */
    maxPoints?: number;
}
/** Canonical request form for whole-signal spectrum analysis. */
export interface MeteringSpectrumRequest extends SpectrumOptions, ValidateOptions {
    samples: Float32Array;
    sampleRate?: number;
}
/** Canonical request form for a single spectrum frame. */
export interface MeteringSpectrumFrameRequest extends MeteringSpectrumRequest {
    frameOffset?: number;
}
/** Canonical request form for waveform bucket generation. */
export interface WaveformPeaksRequest extends WaveformPeaksOptions {
    samples: Float32Array;
    channels: number;
}
/** Canonical request form for multi-resolution waveform bucket generation. */
export interface WaveformPeakPyramidRequest extends WaveformPeakPyramidOptions {
    samples: Float32Array;
    channels: number;
}
/** Per-channel min/max waveform buckets. Arrays are channel-major. */
export interface WaveformPeaksReport {
    min: Float32Array;
    max: Float32Array;
    channels: number;
    bucketCount: number;
    samplesPerBucket: number;
}
/** Uncentered correlation (cosine similarity) in [-1, 1] between equal-length channels. */
export declare function meteringStereoCorrelation(request: MeteringStereoRequest): number;
export declare function meteringStereoCorrelation(left: Float32Array, right: Float32Array, sampleRate?: number, options?: ValidateOptions): number;
/**
 * Stereo width as `sqrt(side_energy / mid_energy)` in `[0, +Infinity)`: the
 * side/mid RMS *amplitude* ratio, not the energy ratio. 0 = pure mono, ~1 =
 * wide stereo, larger = increasingly decorrelated / out-of-phase. The value is
 * unbounded and returns `Infinity` when the mid channel is silent (a
 * mono-collapsed / fully out-of-phase signal).
 *
 * Convert to dB with `20 * Math.log10(value)`; `10 * Math.log10` would
 * understate the true energy ratio by half.
 */
export declare function meteringStereoWidth(request: MeteringStereoRequest): number;
export declare function meteringStereoWidth(left: Float32Array, right: Float32Array, sampleRate?: number, options?: ValidateOptions): number;
/**
 * Mid/side vectorscope point series. By default emits one point per input
 * sample; pass `maxPoints` to get a display-sized decimated point set (matching
 * the Node `meteringVectorscope` shape).
 */
export declare function meteringVectorscope(request: MeteringStereoDecimatedRequest): VectorscopeReport;
export declare function meteringVectorscope(left: Float32Array, right: Float32Array, sampleRate?: number, options?: ScopeOptions): VectorscopeReport;
/**
 * Display-sized mid/side vectorscope.
 *
 * @deprecated Pass `maxPoints` to {@link meteringVectorscope} instead; it now
 * folds `maxPoints` into the request, matching the Node surface. This alias is
 * kept for backward compatibility and simply delegates.
 */
export declare function meteringVectorscopeDecimated(request: MeteringStereoDecimatedRequest): VectorscopeReport;
export declare function meteringVectorscopeDecimated(left: Float32Array, right: Float32Array, sampleRate?: number, maxPoints?: number, options?: ValidateOptions): VectorscopeReport;
/**
 * Phase-scope point series plus summary stats. By default emits one point per
 * input sample; pass `maxPoints` to decimate the point cloud for display
 * (matching the Node `meteringPhaseScope` shape). The summary stats are always
 * computed over the full-resolution signal.
 */
export declare function meteringPhaseScope(request: MeteringStereoDecimatedRequest): PhaseScopeReport;
export declare function meteringPhaseScope(left: Float32Array, right: Float32Array, sampleRate?: number, options?: ScopeOptions): PhaseScopeReport;
/**
 * Display-sized phase scope.
 *
 * @deprecated Pass `maxPoints` to {@link meteringPhaseScope} instead; it now
 * folds `maxPoints` into the request, matching the Node surface. This alias is
 * kept for backward compatibility and simply delegates.
 */
export declare function meteringPhaseScopeDecimated(request: MeteringStereoDecimatedRequest): PhaseScopeReport;
export declare function meteringPhaseScopeDecimated(left: Float32Array, right: Float32Array, sampleRate?: number, maxPoints?: number, options?: ValidateOptions): PhaseScopeReport;
/**
 * Welch-averaged magnitude / power / dB spectrum over the WHOLE mono signal (split
 * into Hann-windowed, 50%-overlapping `nFft`-length frames whose power spectra
 * are averaged). For a true single-frame snapshot, use
 * {@link meteringSpectrumFrame}.
 */
export declare function meteringSpectrum(request: MeteringSpectrumRequest): SpectrumReport;
export declare function meteringSpectrum(samples: Float32Array, sampleRate?: number, options?: SpectrumOptions & ValidateOptions): SpectrumReport;
/**
 * True single-frame magnitude / power / dB spectrum (one Hann-windowed
 * `nFft`-length FFT), for spectrum-analyzer "moment" snapshots that must not be
 * time-averaged like {@link meteringSpectrum}. The analysis frame spans
 * `[frameOffset, frameOffset + nFft)`; samples past the end are zero-padded.
 *
 * The frame is also the only span validated: a non-finite sample inside it is
 * rejected, while one outside it neither reaches the FFT nor refuses the call.
 * The emptiness and `sampleRate` checks still cover the whole buffer. Cost per
 * call is therefore set by `nFft` rather than by the length of the buffer, so an
 * analyzer may poll a long recording frame by frame.
 */
export declare function meteringSpectrumFrame(request: MeteringSpectrumFrameRequest): SpectrumReport;
export declare function meteringSpectrumFrame(samples: Float32Array, sampleRate?: number, frameOffset?: number, options?: SpectrumOptions & ValidateOptions): SpectrumReport;
/**
 * Compute per-channel min/max waveform buckets from interleaved audio.
 *
 * A non-finite sample is rejected rather than skipped, and `{ validate: false }`
 * does not change that — it only skips the JS pre-scan that names the offending
 * index. A bucket whose samples are not finite has no min/max to report, and the
 * `0`/`0` it would otherwise carry is what a waveform display draws as silence.
 */
export declare function waveformPeaks(request: WaveformPeaksRequest): WaveformPeaksReport;
export declare function waveformPeaks(samples: Float32Array, channels: number, options?: WaveformPeaksOptions): WaveformPeaksReport;
/**
 * Compute waveform peak buckets for several zoom levels.
 *
 * Shares {@link waveformPeaks}' bucket kernel, so a non-finite sample is
 * rejected here on the same rule.
 */
export declare function waveformPeakPyramid(request: WaveformPeakPyramidRequest): WaveformPeaksReport[];
export declare function waveformPeakPyramid(samples: Float32Array, channels: number, options?: WaveformPeakPyramidOptions): WaveformPeaksReport[];
