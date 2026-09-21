import type { TempogramMode } from './public_types';
import type { WasmCyclicTempogramResult, WasmFrameResult, WasmTempogramResult, WasmTrimResult } from './sonare.js';
export declare function tone(request?: ToneRequest): Float32Array;
export declare function tone(frequency?: number, sampleRate?: number, duration?: number, phase?: number, amplitude?: number): Float32Array;
export declare function chirp(request?: ChirpRequest): Float32Array;
export declare function chirp(fmin?: number, fmax?: number, sampleRate?: number, duration?: number, linear?: boolean): Float32Array;
export declare function clicks(request: ClicksRequest): Float32Array;
export declare function clicks(times: Float32Array, sampleRate?: number, length?: number, frequency?: number, clickDuration?: number): Float32Array;
export interface DbConversionRequest {
    values: Float32Array;
    ref?: number;
    amin?: number;
    topDb?: number;
}
export interface SilenceRequest {
    samples: Float32Array;
    topDb?: number;
    frameLength?: number;
    hopLength?: number;
}
/** Canonical request form for the common-silence union of several signals. */
export interface SplitSilenceCommonRequest {
    signals: Float32Array[];
    topDb?: number;
    frameLength?: number;
    hopLength?: number;
}
export interface FrameSignalRequest {
    samples: Float32Array;
    frameLength: number;
    hopLength: number;
}
export interface ToneRequest {
    frequency?: number;
    sampleRate?: number;
    duration?: number;
    phase?: number;
    amplitude?: number;
}
export interface ChirpRequest {
    fmin?: number;
    fmax?: number;
    sampleRate?: number;
    duration?: number;
    linear?: boolean;
}
export interface ClicksRequest {
    times: Float32Array;
    sampleRate?: number;
    length?: number;
    frequency?: number;
    clickDuration?: number;
}
/** Canonical request form for pre/de-emphasis filters. */
export interface EmphasisRequest {
    samples: Float32Array;
    coef?: number;
    zi?: number;
}
/** Canonical request form for centering or extending a vector. */
export interface PadCenterRequest {
    values: Float32Array;
    targetSize: number;
    padValue?: number;
}
/** Canonical request form for resizing a vector. */
export interface FixLengthRequest {
    values: Float32Array;
    targetSize: number;
    padValue?: number;
}
/** Canonical request form for bounding a frame-index vector. */
export interface FixFramesRequest {
    frames: Int32Array;
    xMin?: number;
    xMax?: number;
    pad?: boolean;
}
export interface OnsetBacktrackRequest {
    events: Int32Array;
    energy: Float32Array;
}
/** Canonical request form for peak selection. */
export interface PeakPickRequest {
    values: Float32Array;
    preMax: number;
    postMax: number;
    preAvg: number;
    postAvg: number;
    delta: number;
    wait: number;
}
/** Canonical request form for vector normalization. */
export interface VectorNormalizeRequest {
    values: Float32Array;
    normType?: number;
    threshold?: number;
}
/** Canonical request form for tonal centroid projection. */
export interface TonnetzRequest {
    chromagram: Float32Array;
    nChroma: number;
    nFrames: number;
}
export interface PcenRequest {
    values: Float32Array;
    nBins: number;
    nFrames: number;
    sampleRate?: number;
    hopLength?: number;
    timeConstant?: number;
    gain?: number;
    bias?: number;
    power?: number;
    eps?: number;
    /** @deprecated Put PCEN fields directly on the request object. */
    options?: Record<string, number>;
}
export interface TempogramRequest {
    onsetEnvelope: Float32Array;
    sampleRate?: number;
    hopLength?: number;
    winLength?: number;
    mode?: TempogramMode;
    center?: boolean;
    norm?: boolean;
}
export interface CyclicTempogramRequest {
    onsetEnvelope: Float32Array;
    sampleRate?: number;
    hopLength?: number;
    winLength?: number;
    bpmMin?: number;
    nBins?: number;
}
export interface PlpRequest {
    onsetEnvelope: Float32Array;
    sampleRate?: number;
    hopLength?: number;
    tempoMin?: number;
    tempoMax?: number;
    winLength?: number;
}
/**
 * Convert frequency in Hz to Mel scale.
 *
 * A total function, matching the C ABI and librosa: a non-finite `hz`
 * propagates rather than throwing, and a magnitude past the 32-bit float range
 * saturates to an infinity the same way the C conversion does. Out-of-audio
 * frequencies are not refused either — the mapping is defined over the whole
 * real line.
 *
 * @param hz - Frequency in Hz
 * @returns Mel frequency
 */
export declare function hzToMel(hz: number): number;
/**
 * Convert Mel scale to frequency in Hz. Total over the same domain as
 * {@link hzToMel}.
 *
 * @param mel - Mel frequency
 * @returns Frequency in Hz
 */
export declare function melToHz(mel: number): number;
/**
 * Convert frequency in Hz to MIDI note number.
 *
 * Total, like {@link hzToMel}. A non-positive `hz` returns `-Infinity`, the log2
 * limit, and {@link midiToHz} maps that back to 0. A NaN propagates, which is
 * what makes a default `pitchPyin` track — whose unvoiced frames are NaN — safe
 * to map through.
 *
 * @param hz - Frequency in Hz
 * @returns MIDI note number (A4 = 440 Hz = 69)
 */
export declare function hzToMidi(hz: number): number;
/**
 * Convert MIDI note number to frequency in Hz. Total, like {@link hzToMel};
 * `-Infinity` bottoms out at 0 rather than propagating its sign.
 *
 * @param midi - MIDI note number
 * @returns Frequency in Hz
 */
export declare function midiToHz(midi: number): number;
/**
 * Convert frequency in Hz to note name.
 *
 * Every frequency with no note answers `"?"` rather than throwing: zero,
 * negative, past the representable MIDI range, and non-finite alike. A default
 * `pitchPyin` track fills unvoiced frames with NaN, so mapping one through this
 * yields `"?"` at those frames.
 *
 * @param hz - Frequency in Hz
 * @returns Note name (e.g., "A4", "C#5")
 */
export declare function hzToNote(hz: number): string;
/**
 * Convert note name to frequency in Hz.
 *
 * @param note - Note name (e.g., "A4", "C#5")
 * @returns Frequency in Hz
 */
export declare function noteToHz(note: string): number;
/**
 * Convert frame index to time in seconds.
 *
 * @param frames - Frame index
 * @param sr - Sample rate in Hz (default: 22050)
 * @param hopLength - Hop length in samples (default: 512)
 * @returns Time in seconds
 */
export declare function framesToTime(frames: number, sr?: number, hopLength?: number): number;
/**
 * Convert time in seconds to frame index.
 *
 * @param time - Time in seconds
 * @param sr - Sample rate in Hz (default: 22050)
 * @param hopLength - Hop length in samples (default: 512)
 * @returns Frame index
 */
export declare function timeToFrames(time: number, sr?: number, hopLength?: number): number;
export declare function framesToSamples(frames: number, hopLength?: number, nFft?: number): number;
export declare function samplesToFrames(samples: number, hopLength?: number, nFft?: number): number;
export declare function powerToDb(request: DbConversionRequest): Float32Array;
export declare function powerToDb(values: Float32Array, ref?: number, amin?: number, topDb?: number): Float32Array;
export declare function amplitudeToDb(request: DbConversionRequest): Float32Array;
export declare function amplitudeToDb(values: Float32Array, ref?: number, amin?: number, topDb?: number): Float32Array;
export declare function dbToPower(values: Float32Array, ref?: number): Float32Array;
export declare function dbToAmplitude(values: Float32Array, ref?: number): Float32Array;
export declare function preemphasis(request: EmphasisRequest): Float32Array;
export declare function preemphasis(samples: Float32Array, coef?: number, zi?: number): Float32Array;
export declare function deemphasis(request: EmphasisRequest): Float32Array;
export declare function deemphasis(samples: Float32Array, coef?: number, zi?: number): Float32Array;
export declare function trimSilence(request: SilenceRequest): WasmTrimResult;
export declare function trimSilence(samples: Float32Array, topDb?: number, frameLength?: number, hopLength?: number): WasmTrimResult;
export declare function splitSilence(request: SilenceRequest): Int32Array;
export declare function splitSilence(samples: Float32Array, topDb?: number, frameLength?: number, hopLength?: number): Int32Array;
/**
 * Lists the intervals where ANY of `signals` is sounding, so every gap
 * between them is silent in all of them -- what several takes of one part
 * share is their silence, not their sound.
 *
 * @returns The union of {@link splitSilence}'s per-signal intervals, merged
 *   where they touch. A single signal returns exactly what `splitSilence`
 *   does for it.
 */
export declare function splitSilenceCommon(request: SplitSilenceCommonRequest): Int32Array;
export declare function frameSignal(request: FrameSignalRequest): WasmFrameResult;
export declare function frameSignal(samples: Float32Array, frameLength: number, hopLength: number): WasmFrameResult;
export declare function padCenter(request: PadCenterRequest): Float32Array;
export declare function padCenter(values: Float32Array, targetSize: number, padValue?: number): Float32Array;
export declare function fixLength(request: FixLengthRequest): Float32Array;
export declare function fixLength(values: Float32Array, targetSize: number, padValue?: number): Float32Array;
export declare function fixFrames(request: FixFramesRequest): Int32Array;
export declare function fixFrames(frames: Int32Array, xMin?: number, xMax?: number, pad?: boolean): Int32Array;
export declare function onsetBacktrack(request: OnsetBacktrackRequest): Int32Array;
export declare function onsetBacktrack(events: Int32Array, energy: Float32Array): Int32Array;
export declare function peakPick(request: PeakPickRequest): Int32Array;
export declare function peakPick(values: Float32Array, preMax: number, postMax: number, preAvg: number, postAvg: number, delta: number, wait: number): Int32Array;
export declare function vectorNormalize(request: VectorNormalizeRequest): Float32Array;
export declare function vectorNormalize(values: Float32Array, normType?: number, threshold?: number): Float32Array;
export declare function pcen(request: PcenRequest): Float32Array;
export declare function pcen(values: Float32Array, nBins: number, nFrames: number, options?: Record<string, number>): Float32Array;
export declare function tonnetz(request: TonnetzRequest): Float32Array;
export declare function tonnetz(chromagram: Float32Array, nChroma: number, nFrames: number): Float32Array;
export declare function tempogram(request: TempogramRequest): WasmTempogramResult;
export declare function tempogram(onsetEnvelope: Float32Array, sampleRate?: number, hopLength?: number, winLength?: number, mode?: TempogramMode, center?: boolean, norm?: boolean): WasmTempogramResult;
export declare function cyclicTempogram(request: CyclicTempogramRequest): WasmCyclicTempogramResult;
export declare function cyclicTempogram(onsetEnvelope: Float32Array, sampleRate?: number, hopLength?: number, winLength?: number, bpmMin?: number, nBins?: number): WasmCyclicTempogramResult;
export declare function plp(request: PlpRequest): Float32Array;
export declare function plp(onsetEnvelope: Float32Array, sampleRate?: number, hopLength?: number, tempoMin?: number, tempoMax?: number, winLength?: number): Float32Array;
