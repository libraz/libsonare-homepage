/**
 * Analysis and feature-extraction entry point for the smaller WASM binary.
 *
 * This entry intentionally omits mastering, mixing, realtime engines, Project,
 * and other native-handle APIs. Import the package root when those surfaces are
 * required.
 */
import type { SonareCapabilities } from './public_types';
import type { SonareModule } from './sonare.js';
export { ErrorCode, isSonareError, SonareError } from './errors';
export * from './feature_core';
export type * from './feature_decompose';
export { segmentAgglomerative, segmentCrossSimilarity, segmentLagToRecurrence, segmentPathEnhance, segmentRecurrenceMatrix, segmentRecurrenceToLag, segmentSubsegment, } from './feature_decompose';
export type * from './feature_inverse';
export { griffinLim, melToAudio, melToStft, mfccToAudio, mfccToMel } from './feature_inverse';
export type * from './feature_loudness';
export { ebur128LoudnessRange, lufsInterleaved, lufsSeriesInterleaved } from './feature_loudness';
export * from './feature_music';
export * from './feature_pitch';
export type * from './feature_resample';
export type * from './feature_spectral';
export { polyFeatures, rmsEnergy, spectralBandwidth, spectralCentroid, spectralContrast, spectralFlatness, spectralFlux, spectralRolloff, zeroCrossingRate, zeroCrossings, } from './feature_spectral';
export type * from './feature_spectrogram';
export { bassChroma, chroma, chromaCens, chromaCqt, melDelta, melSpectrogram, mfcc, reassignedSpectrogram, stft, stftDb, } from './feature_spectrogram';
export * from './metering';
export * from './public_types';
export type { AnalyzeBpmRequest, AnalyzeDynamicsRequest, AnalyzeImpulseResponseRequest, AnalyzeRhythmRequest, AnalyzeTimbreRequest, AnalyzeWithProgressRequest, BpmAnalysisResult, BpmCandidate, ChordFunctionalAnalysisRequest, DetectAcousticRequest, DetectChordsRequest, DetectKeyRequest, DynamicsAnalysisResult, DynamicsResult, EstimateMeterRequest, MusicAnalyzeOptions, MusicAnalyzeRequest, RhythmAnalysisResult, SamplesRequest, TimbreAnalysisResult, TimbreFrame, } from './quick_analysis';
export { analyze, analyzeBpm, analyzeDynamics, analyzeImpulseResponse, analyzeRhythm, analyzeTimbre, analyzeWithProgress, chordFunctionalAnalysis, detectAcoustic, detectBeats, detectBpm, detectChords, detectDownbeats, detectKey, detectKeyCandidates, detectOnsets, estimateMeter, hasFfmpegSupport, } from './quick_analysis';
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
