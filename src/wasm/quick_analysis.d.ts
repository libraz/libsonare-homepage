import type { AcousticOptions, AcousticResult, AnalysisResult, AnalyzeBpmOptions, AnalyzeDynamicsOptions, AnalyzeRhythmOptions, AnalyzeTimbreOptions, ChordAnalysisResult, ChordDetectionOptions, Key, KeyCandidate, KeyDetectionOptions, MeterEstimate, RirResult, RirSynthOptions, RoomEstimateOptions, RoomEstimateResult, RoomMorphOptions, RoomMorphResult } from './public_types';
import { Mode, PitchClass } from './public_types';
import type { ProgressCallback } from './sonare.js';
import type { ValidateOptions } from './validation';
type GuardedOptions = ValidateOptions;
/** Canonical request form for one-shot analysis functions. */
export interface SamplesRequest extends GuardedOptions {
    samples: Float32Array;
    sampleRate?: number;
}
/** Peak-picking configuration for {@link detectOnsets}. */
export interface OnsetDetectOptions {
    nFft?: number;
    hopLength?: number;
    threshold?: number;
    preMax?: number;
    postMax?: number;
    preAvg?: number;
    postAvg?: number;
    delta?: number;
    wait?: number;
    backtrack?: boolean;
    backtrackRange?: number;
}
export interface DetectOnsetsRequest extends SamplesRequest, OnsetDetectOptions {
}
/** Canonical request form for key detection functions. */
export interface DetectKeyRequest extends KeyDetectionOptions, SamplesRequest {
}
/** Canonical request form for analysis with synchronous progress reporting. */
export interface AnalyzeWithProgressRequest extends SamplesRequest {
    onProgress?: ProgressCallback;
    cancel?: () => boolean;
}
/** Canonical request form for chord detection. */
export interface DetectChordsRequest extends ChordDetectionOptions, SamplesRequest {
}
/** Canonical request form for functional chord analysis. */
export interface ChordFunctionalAnalysisRequest extends DetectChordsRequest {
    keyRoot: PitchClass;
    /** Musical mode; defaults to {@link Mode.Major}. */
    keyMode?: Mode;
}
/** Canonical request form for impulse-response analysis. */
export interface AnalyzeImpulseResponseRequest extends SamplesRequest {
    nOctaveBands?: number;
    minDecayDb?: number;
}
/** Canonical request form for acoustic analysis. */
export interface DetectAcousticRequest extends AcousticOptions, SamplesRequest {
}
/** Canonical request form for equivalent-room estimation. */
export interface EstimateRoomRequest extends RoomEstimateOptions, SamplesRequest {
}
/** Canonical request form for room-reverb morphing. */
export interface RoomMorphRequest extends RoomMorphOptions, GuardedOptions {
    samples: Float32Array;
    sampleRate: number;
}
/** Canonical request forms for detailed music-analysis APIs. */
export interface AnalyzeBpmRequest extends AnalyzeBpmOptions, SamplesRequest {
}
export interface AnalyzeRhythmRequest extends AnalyzeRhythmOptions, SamplesRequest {
}
export interface AnalyzeDynamicsRequest extends AnalyzeDynamicsOptions, SamplesRequest {
}
export interface AnalyzeTimbreRequest extends AnalyzeTimbreOptions, SamplesRequest {
}
/**
 * Detect BPM from audio samples.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @returns Detected BPM
 */
export declare function detectBpm(request: SamplesRequest): number;
export declare function detectBpm(samples: Float32Array, sampleRate?: number, options?: GuardedOptions): number;
/**
 * Detect musical key from audio samples.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @returns Detected key
 */
export declare function detectKey(request: DetectKeyRequest): Key;
export declare function detectKey(samples: Float32Array, sampleRate?: number, options?: KeyDetectionOptions): Key;
export declare function detectKeyCandidates(request: DetectKeyRequest): KeyCandidate[];
export declare function detectKeyCandidates(samples: Float32Array, sampleRate?: number, options?: KeyDetectionOptions): KeyCandidate[];
/**
 * Detect onset times from audio samples.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @returns Array of onset times in seconds
 */
export declare function detectOnsets(request: DetectOnsetsRequest): Float32Array;
export declare function detectOnsets(samples: Float32Array, sampleRate?: number, options?: OnsetDetectOptions & GuardedOptions): Float32Array;
/**
 * Detect beat times from audio samples.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @returns Array of beat times in seconds
 */
export declare function detectBeats(request: SamplesRequest): Float32Array;
export declare function detectBeats(samples: Float32Array, sampleRate?: number, options?: GuardedOptions): Float32Array;
/**
 * Detect downbeat times from audio samples.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @returns Array of downbeat times in seconds
 */
export declare function detectDownbeats(request: SamplesRequest): Float32Array;
export declare function detectDownbeats(samples: Float32Array, sampleRate?: number, options?: GuardedOptions): Float32Array;
/**
 * Detect chords from audio samples.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param options - Optional chord detection settings
 * @returns Detected chord segments
 */
export declare function detectChords(request: DetectChordsRequest): ChordAnalysisResult;
export declare function detectChords(samples: Float32Array, sampleRate?: number, options?: ChordDetectionOptions): ChordAnalysisResult;
/**
 * Functional (Roman-numeral) harmonic analysis of the detected chord
 * progression, relative to the given key. Mirrors the C-ABI
 * `sonare_chord_functional_analysis` and the Node/Python `chordFunctionalAnalysis`.
 *
 * @returns One Roman-numeral label (e.g. "I", "IV", "V", "vi") per detected chord
 */
export declare function chordFunctionalAnalysis(request: ChordFunctionalAnalysisRequest): string[];
export declare function chordFunctionalAnalysis(samples: Float32Array, keyRoot: PitchClass, keyMode?: Mode, sampleRate?: number, options?: ChordDetectionOptions): string[];
/**
 * Options for {@link analyze}. Every field is optional and falls back to the
 * core default when omitted.
 */
export interface MusicAnalyzeOptions {
    nFft?: number;
    hopLength?: number;
    bpmMin?: number;
    bpmMax?: number;
    startBpm?: number;
    useTriadsOnly?: boolean;
    useHpss?: boolean;
    chromaHighpassHz?: number;
    useBassWeighted?: boolean;
    chromaHopMultiplier?: number;
    useChordHmm?: boolean;
    useChordKeyContext?: boolean;
    chordHmmBeamWidth?: number;
    detectChordInversions?: boolean;
    /**
     * Track a locally updated tempo prior during beat tracking (default: false).
     */
    adaptiveTempo?: boolean;
    /**
     * Length of the local tempo context in beats (default: 8). Must be positive.
     */
    tempoUpdateIntervalBeats?: number;
    /**
     * Decode a per-beat local tempo curve into
     * {@link AnalysisResult.beatLocalBpm} (default: false).
     *
     * @remarks
     * Off by default because it is an extra output rather than a better analysis:
     * nothing else in the result changes, and a caller that does not read the
     * curve would pay a decode over the beat grid for nothing.
     *
     * The curve describes the beat grid it was decoded from, and beat tracking
     * holds a fixed tempo prior unless {@link MusicAnalyzeOptions.adaptiveTempo}
     * is also set, so measuring a tempo that moves needs both.
     */
    computeTempoCurve?: boolean;
    /**
     * Meter numerators the estimator scores (default: `[3, 4, 6]`).
     *
     * @remarks
     * Adding a numerator widens the search; it does not force the result. The
     * list must hold between 1 and 16 entries, each in `[2, 32]`.
     */
    meterCandidateNumerators?: number[];
    /**
     * Beat unit reported for the detected meter (default: 4). Must be a power of
     * two in `[1, 32]`. The estimator still reports 8 on its own when it resolves
     * a compound meter, so this is the unit for everything else.
     */
    meterDenominator?: number;
}
export interface MusicAnalyzeRequest extends SamplesRequest, MusicAnalyzeOptions {
}
/**
 * Perform complete music analysis.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @returns Complete analysis result
 *
 * @remarks
 * This call is synchronous and blocks until analysis completes. Unlike the
 * Node binding (which offers `analyzeAsync` on a libuv worker thread), the
 * WASM build runs on a single thread, so there is no non-blocking variant —
 * the DSP pipeline always runs to completion on the calling thread. To keep
 * the UI responsive for long inputs, drive this from a Web Worker and use
 * {@link analyzeWithProgress} to report progress.
 */
export declare function analyze(request: MusicAnalyzeRequest): AnalysisResult;
export declare function analyze(samples: Float32Array, sampleRate?: number, options?: GuardedOptions & MusicAnalyzeOptions): AnalysisResult;
/**
 * Canonical request form for {@link estimateMeter}.
 *
 * @remarks
 * Every scoring field is optional and falls back to the core default when
 * omitted; the core validates them and rejects a value it cannot answer rather
 * than substituting one.
 */
export interface EstimateMeterRequest {
    /** Beat positions in seconds, non-decreasing. */
    beatTimes: ArrayLike<number>;
    /**
     * Per-beat accent value, the same length as {@link beatTimes}.
     *
     * @remarks
     * `AnalysisResult.beatObservations.onsetStrength` is the intended source —
     * it is the windowed value the library's own downbeat pass scores.
     * `beats[].strength` also works but is a single unwindowed envelope frame.
     * Neither needs pre-scaling: the series is divided by its own maximum before
     * scoring, so only the accent contrast within it is read.
     *
     * A series assembled by hand from {@link onsetEnvelope} — one frame read at
     * each beat time — is neither of those, and it carries a sample-rate
     * dependence neither of them has: a hop counted in samples frames a different
     * amount of time at each rate, so one waveform sampled at 32000, 44100 and
     * 48000 Hz has produced three different winning numerators off beat times
     * identical to the sample. Widening the read to a window around the beat does
     * not remove it. A browser decodes at the output device's rate, so that is a
     * different answer per visitor for the same clip.
     */
    beatStrengths: ArrayLike<number>;
    /**
     * Meter numerators to score (default: `[3, 4, 6]`).
     *
     * @remarks
     * Adding a numerator widens the search; it does not force the result. The
     * list must hold between 1 and 16 entries, each in `[2, 32]`.
     */
    candidateNumerators?: number[];
    /**
     * Beat unit reported for the detected meter (default: 4). Must be a power of
     * two in `[1, 32]`.
     *
     * @remarks
     * Reported as requested: whether a beat divides into three is measured from
     * energy *between* the beats, which per-beat accents do not carry, so a
     * compound meter is not resolvable here. A six accented 3+3 comes back with
     * this denominator and `grouping === [3, 3]`.
     */
    denominator?: number;
    /** Weight of the downbeat accent term (default: 1). */
    downbeatWeight?: number;
    /** Weight of the measure-periodicity term (default: 0.5). */
    measureWeight?: number;
    /** Weight of the subdivision term (default: 0.15). */
    subdivisionWeight?: number;
    /**
     * Score ratio above which a compound meter is preferred (default: 0.85).
     *
     * @remarks
     * Only consulted when there is a subdivision to measure, so it has no effect
     * here — this entry point scores per-beat accents alone.
     */
    compoundSubdivisionThreshold?: number;
}
/**
 * Estimate meter over a caller-supplied beat series.
 *
 * @param request - Beat series plus optional scoring configuration
 * @returns The selected signature, its downbeat phase and grouping, and the
 *   scored candidates
 *
 * @remarks
 * Scores only the per-beat strengths, so no audio and no frame-level onset
 * envelope is needed: an arbitrary span of an existing analysis can be scored
 * without re-running it. Pass `beatObservations.onsetStrength` rather than
 * `beats[].strength` — see {@link EstimateMeterRequest.beatStrengths}.
 *
 * The result carries `grouping` alongside the numerator: how the bar divides
 * into accent groups of two and three beats, so a seven comes back as `[3, 2,
 * 2]` or `[2, 2, 3]` rather than as a bare seven.
 *
 * Check `searched` before reading anything as a detection: a series too short
 * to score any candidate reports a fixed fallback instead, and `candidateScores`
 * grows with the square root of how many beats were scored, so scores from
 * spans of different lengths are not directly comparable.
 */
export declare function estimateMeter(request: EstimateMeterRequest): MeterEstimate;
export declare function analyzeImpulseResponse(request: AnalyzeImpulseResponseRequest): AcousticResult;
export declare function analyzeImpulseResponse(samples: Float32Array, sampleRate?: number, nOctaveBands?: number, minDecayDb?: number): AcousticResult;
export declare function detectAcoustic(request: DetectAcousticRequest): AcousticResult;
export declare function detectAcoustic(samples: Float32Array, sampleRate?: number, options?: AcousticOptions): AcousticResult;
/**
 * Synthesize a room impulse response from shoebox geometry. `hasError` is true
 * when the source/listener falls outside the room (the RIR is then empty).
 */
export declare function synthesizeRir(options?: RirSynthOptions): RirResult;
/**
 * Estimate an equivalent room (volume/dimensions/absorption/DRR) from a
 * recording or impulse response.
 */
export declare function estimateRoom(request: EstimateRoomRequest): RoomEstimateResult;
export declare function estimateRoom(samples: Float32Array, sampleRate?: number, options?: RoomEstimateOptions): RoomEstimateResult;
/**
 * Morph a recording's reverberation toward a target room (creative FX, not
 * dereverberation).
 *
 * Returns the morphed samples in `audio` (input length plus the target room's
 * reverb tail) alongside the target-room synthesis's own `diagnostics`, which
 * report a room other than the one requested — see {@link RoomMorphResult}.
 */
export declare function roomMorph(request: RoomMorphRequest): RoomMorphResult;
export declare function roomMorph(samples: Float32Array, sampleRate: number, options?: RoomMorphOptions): RoomMorphResult;
/**
 * Perform complete music analysis with progress reporting.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param onProgress - Progress callback (progress: 0-1, stage: string)
 * @returns Complete analysis result
 */
export declare function analyzeWithProgress(request: AnalyzeWithProgressRequest): AnalysisResult;
export declare function analyzeWithProgress(samples: Float32Array, sampleRate: number | undefined, onProgress: ProgressCallback): AnalysisResult;
export interface BpmCandidate {
    bpm: number;
    confidence: number;
}
export interface BpmAnalysisResult {
    bpm: number;
    confidence: number;
    candidates: BpmCandidate[];
    autocorrelation: Float32Array;
    tempogram: Float32Array;
}
export interface RhythmAnalysisResult {
    timeSignature: {
        numerator: number;
        denominator: number;
        confidence: number;
    };
    syncopation: number;
    grooveType: string;
    patternRegularity: number;
    tempoStability: number;
    /**
     * The beat tracker's own tempo, refined from the local beat period. It is a
     * third figure rather than either tempo entry point's: measured against
     * synthesized click trains it differs from both at every sample rate, and
     * lands closer to the known tempo than either. Analysed at the sample rate
     * you pass, so `nFft` and `hopLength` are in samples of your buffer.
     */
    bpm: number;
    beatIntervals: Float32Array;
}
/**
 * Dynamics metrics returned by {@link analyzeDynamics}.
 *
 * The Node package declares the same shape under the same name; the two are
 * pinned to one field list by `tests/conformance/shared_type_shapes.json`.
 */
export interface DynamicsResult {
    dynamicRangeDb: number;
    peakDb: number;
    rmsDb: number;
    crestFactor: number;
    loudnessRangeDb: number;
    isCompressed: boolean;
    /** Loudness curve timestamps (seconds), parallel to {@link loudnessRmsDb}. */
    loudnessTimes: Float32Array;
    /** Loudness curve RMS values (dB), parallel to {@link loudnessTimes}. */
    loudnessRmsDb: Float32Array;
}
/**
 * @deprecated Use {@link DynamicsResult}. Retained so code written against the
 * WASM-only spelling keeps compiling; the Node package exports the same alias.
 */
export type DynamicsAnalysisResult = DynamicsResult;
/** Timbre metrics for one analysis window. Entries are ordered by time in `timbreOverTime`. */
export interface TimbreFrame {
    brightness: number;
    warmth: number;
    density: number;
    roughness: number;
    complexity: number;
}
export interface TimbreAnalysisResult extends TimbreFrame {
    spectralCentroid: Float32Array;
    spectralFlatness: Float32Array;
    spectralRolloff: Float32Array;
    /** Time-varying timbre metrics, one entry per analysis window. */
    timbreOverTime: TimbreFrame[];
}
/**
 * Detailed BPM analysis (BPM, confidence, alternate candidates, autocorrelation,
 * tempogram). Matches the Node `analyzeBpm` / Python `analyze_bpm` surface.
 */
export declare function analyzeBpm(request: AnalyzeBpmRequest): BpmAnalysisResult;
export declare function analyzeBpm(samples: Float32Array, sampleRate?: number, options?: AnalyzeBpmOptions): BpmAnalysisResult;
/**
 * Detailed rhythm analysis (time signature, groove, syncopation, beat intervals).
 */
export declare function analyzeRhythm(request: AnalyzeRhythmRequest): RhythmAnalysisResult;
export declare function analyzeRhythm(samples: Float32Array, sampleRate?: number, options?: AnalyzeRhythmOptions): RhythmAnalysisResult;
/**
 * Dynamics analysis (RMS, peak, crest factor, LRA, loudness curve).
 */
export declare function analyzeDynamics(request: AnalyzeDynamicsRequest): DynamicsResult;
export declare function analyzeDynamics(samples: Float32Array, sampleRate?: number, options?: AnalyzeDynamicsOptions): DynamicsResult;
/**
 * Timbre analysis (brightness/warmth/density/roughness/complexity plus spectral
 * features and per-window timbre frames).
 */
export declare function analyzeTimbre(request: AnalyzeTimbreRequest): TimbreAnalysisResult;
export declare function analyzeTimbre(samples: Float32Array, sampleRate?: number, options?: AnalyzeTimbreOptions): TimbreAnalysisResult;
/**
 * Whether this WASM build was compiled with FFmpeg support. Mirrors Node /
 * Python `hasFfmpegSupport`. In the published WASM binding this currently
 * always returns `false` (FFmpeg is not bundled into the .wasm), but the API
 * exists so caller code can branch on capabilities portably.
 */
export declare function hasFfmpegSupport(): boolean;
export {};
