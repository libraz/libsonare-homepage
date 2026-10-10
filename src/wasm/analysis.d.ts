/**
 * Analysis and feature-extraction entry point for the smaller WASM binary.
 *
 * This entry intentionally omits mastering, mixing, realtime engines, Project,
 * and other native-handle APIs. Import the package root when those surfaces are
 * required.
 */
import './lifetime.js';
import type { SonareCapabilities } from './public_types.js';
import type { SonareModule } from './sonare.js';
export { EXPECTED_ABI_VERSION } from './abi.js';
export { ErrorCode, isSonareError, SonareError } from './errors.js';
export * from './feature_core.js';
export type * from './feature_decompose.js';
export { segmentAgglomerative, segmentCrossSimilarity, segmentLagToRecurrence, segmentPathEnhance, segmentRecurrenceMatrix, segmentRecurrenceToLag, segmentSubsegment, } from './feature_decompose.js';
export type * from './feature_inverse.js';
export { griffinLim, melToAudio, melToStft, mfccToAudio, mfccToMel } from './feature_inverse.js';
export type * from './feature_loudness.js';
export { ebur128LoudnessRange, lufsInterleaved, lufsSeriesInterleaved, } from './feature_loudness.js';
export * from './feature_music.js';
export * from './feature_pitch.js';
export type * from './feature_resample.js';
export type * from './feature_spectral.js';
export { polyFeatures, rmsEnergy, spectralBandwidth, spectralCentroid, spectralContrast, spectralFlatness, spectralFlux, spectralRolloff, zeroCrossingRate, zeroCrossings, } from './feature_spectral.js';
export type * from './feature_spectrogram.js';
export { bassChroma, chroma, chromaCens, chromaCqt, melDelta, melSpectrogram, mfcc, reassignedSpectrogram, stft, stftDb, } from './feature_spectrogram.js';
export * from './metering.js';
export * from './public_types.js';
export type { AnalyzeBpmRequest, AnalyzeDynamicsRequest, AnalyzeImpulseResponseRequest, AnalyzeRhythmRequest, AnalyzeTimbreRequest, AnalyzeWithProgressRequest, BpmAnalysisResult, BpmCandidate, ChordFunctionalAnalysisRequest, DetectAcousticRequest, DetectChordsRequest, DetectKeyCandidatesRequest, DetectKeyRequest, DynamicsAnalysisResult, DynamicsResult, EstimateMeterRequest, MusicAnalyzeOptions, MusicAnalyzeRequest, RhythmAnalysisResult, SamplesRequest, TimbreAnalysisResult, TimbreFrame, } from './quick_analysis.js';
export { analyze, analyzeBpm, analyzeDynamics, analyzeImpulseResponse, analyzeRhythm, analyzeTimbre, analyzeWithProgress, chordFunctionalAnalysis, detectAcoustic, detectBeats, detectBpm, detectChords, detectDownbeats, detectKey, detectKeyCandidates, detectOnsets, estimateMeter, hasFfmpegSupport, } from './quick_analysis.js';
/** Initialize the analysis-only WASM module. */
export declare function init(options?: {
    locateFile?: (path: string, prefix: string) => string;
    wasmBinary?: ArrayBuffer | Uint8Array;
    moduleFactory?: (options?: {
        locateFile?: (path: string, prefix: string) => string;
        wasmBinary?: ArrayBuffer | Uint8Array;
    }) => Promise<SonareModule>;
}): Promise<void>;
/** Whether this analysis entry has loaded its WASM module. */
export declare function isInitialized(): boolean;
/** Version reported by the loaded analysis WASM module. */
export declare function version(): string;
/** Build capabilities for the loaded analysis-only module. */
export declare function capabilities(): SonareCapabilities;
/** Packed C-ABI version for compatibility checks. */
export declare function abiVersion(): number;
/** Realtime command-queue ABI version shared with the full entry. */
export declare function engineAbiVersion(): number;
/** Voice-changer ABI version retained for cross-entry compatibility checks. */
export declare function voiceChangerAbiVersion(): number;
