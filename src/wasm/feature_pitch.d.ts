import type { SpectralFrameRequest } from './feature_spectral';
import type { NoteSegment, PiptrackResult, PitchResult } from './public_types';
/**
 * Detect pitch using YIN algorithm.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param frameLength - Frame length (default: 2048)
 * @param hopLength - Hop length (default: 512)
 * @param fmin - Minimum frequency in Hz (default: 65)
 * @param fmax - Maximum frequency in Hz (default: 2093)
 * @param threshold - YIN threshold (default: 0.1)
 * @param fillNa - Retained for compatibility; YIN always returns a finite per-frame estimate.
 * @returns Pitch detection result
 */
export interface PitchYinRequest {
    samples: Float32Array;
    sampleRate?: number;
    frameLength?: number;
    hopLength?: number;
    fmin?: number;
    fmax?: number;
    threshold?: number;
    fillNa?: boolean;
}
export interface PiptrackRequest {
    samples: Float32Array;
    sampleRate?: number;
    nFft?: number;
    hopLength?: number;
    fmin?: number;
    fmax?: number;
    threshold?: number;
}
/** Per-bin spectral pitch candidates and peak magnitudes (librosa.piptrack). */
export declare function piptrack(request: PiptrackRequest): PiptrackResult;
export declare function piptrack(samples: Float32Array, sampleRate?: number, nFft?: number, hopLength?: number, fmin?: number, fmax?: number, threshold?: number): PiptrackResult;
export declare function pitchYin(request: PitchYinRequest): PitchResult;
export declare function pitchYin(samples: Float32Array, sampleRate?: number, frameLength?: number, hopLength?: number, fmin?: number, fmax?: number, threshold?: number, fillNa?: boolean): PitchResult;
/**
 * Detect pitch using pYIN algorithm (probabilistic YIN with HMM smoothing).
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param frameLength - Frame length (default: 2048)
 * @param hopLength - Hop length (default: 512)
 * @param fmin - Minimum frequency in Hz (default: 65)
 * @param fmax - Maximum frequency in Hz (default: 2093)
 * @param threshold - YIN threshold (default: 0.1)
 * @param fillNa - If true, return 0 for unvoiced f0 frames; otherwise keep NaN (default: false)
 * @returns Pitch detection result
 */
export interface PitchPyinRequest extends PitchYinRequest {
}
export declare function pitchPyin(request: PitchPyinRequest): PitchResult;
export declare function pitchPyin(samples: Float32Array, sampleRate?: number, frameLength?: number, hopLength?: number, fmin?: number, fmax?: number, threshold?: number, fillNa?: boolean): PitchResult;
/** Parameters for segmenting an F0 track into stable monophonic notes. */
export interface NoteSegmentsRequest {
    f0Hz: Float32Array;
    /**
     * Per-frame voicing values in `[0, 1]`; anything below `voicedThreshold` is
     * unvoiced.
     *
     * Pass {@link PitchResult.voicedFlag} converted to `0`/`1`. Do **not** pass
     * {@link pitchPyin}'s `voicedProb`: that value is the frame's voiced
     * observation mass and rises with F0 for a fixed `frameLength`, so a fixed
     * threshold silently returns no segments at all for low-register material
     * (a steady tone below roughly C5 never reaches 0.5).
     */
    voicedProb: Float32Array;
    frameRate: number;
    segmentationThresholdCents?: number;
    minNoteMs?: number;
    referenceHz?: number;
    /** Voicing threshold applied to `voicedProb`; defaults to `0.5`. */
    voicedThreshold?: number;
}
/**
 * Segment a caller-supplied monophonic F0 track into stable note regions.
 *
 * `f0Hz` and `voicedProb` must have the same non-zero length. Zero-Hz frames
 * and values below `voicedThreshold` (default `0.5`) are treated as unvoiced.
 */
export declare function noteSegments(request: NoteSegmentsRequest): NoteSegment[];
export interface PitchTuningRequest {
    frequencies: Float32Array;
    resolution?: number;
    binsPerOctave?: number;
}
export interface EstimateTuningRequest extends SpectralFrameRequest {
    resolution?: number;
    binsPerOctave?: number;
}
/**
 * Estimate the global tuning offset from a set of frequencies
 * (librosa.pitch_tuning). Returns a deviation in fractions of a bin.
 */
export declare function pitchTuning(request: PitchTuningRequest): number;
export declare function pitchTuning(frequencies: Float32Array, resolution?: number, binsPerOctave?: number): number;
/**
 * Estimate the tuning offset of an audio signal (librosa.estimate_tuning).
 */
export declare function estimateTuning(request: EstimateTuningRequest): number;
export declare function estimateTuning(samples: Float32Array, sampleRate?: number, nFft?: number, hopLength?: number, resolution?: number, binsPerOctave?: number): number;
