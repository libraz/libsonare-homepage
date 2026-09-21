/**
 * Time and pitch transforms over a whole buffer: stretching, shifting, and
 * correction onto a target pitch.
 */
import type { PitchCorrectOptions, VoicedFlags } from './public_types';
import type { ValidateOptions } from './validation';
export interface TimeStretchRequest extends ValidateOptions {
    samples: Float32Array;
    sampleRate?: number;
    rate: number;
    nFft?: number;
    hopLength?: number;
}
export interface PitchShiftRequest extends ValidateOptions {
    samples: Float32Array;
    sampleRate?: number;
    semitones: number;
    nFft?: number;
    hopLength?: number;
}
export interface PitchCorrectToMidiRequest extends ValidateOptions {
    samples: Float32Array;
    sampleRate?: number;
    currentMidi?: number;
    targetMidi?: number;
}
export interface PitchCorrectToMidiTimevaryingRequest extends ValidateOptions {
    samples: Float32Array;
    f0Hz: Float32Array;
    targetMidi: number;
    sampleRate?: number;
    hopLength?: number;
    voiced?: VoicedFlags;
    voicedProb?: Float32Array;
}
export interface PitchCorrectTimevaryingRequest extends PitchCorrectOptions {
    samples: Float32Array;
    f0Hz: Float32Array;
    sampleRate?: number;
    hopLength?: number;
}
/**
 * Time-stretch audio without changing pitch.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param rate - Time stretch rate (0.5 = double duration, 2.0 = half duration)
 * @param nFft - FFT size: an even integer >= 2 (default 2048)
 * @param hopLength - Hop in samples, in `(0, nFft / 2]` (default 512), so
 *   frames overlap by at least half a window
 * @returns Time-stretched audio
 */
export declare function timeStretch(request: TimeStretchRequest): Float32Array;
export declare function timeStretch(samples: Float32Array, sampleRate: number, rate: number, options?: ValidateOptions): Float32Array;
export declare function timeStretch(samples: Float32Array, sampleRate: number, rate: number, nFft?: number, hopLength?: number, options?: ValidateOptions): Float32Array;
/**
 * Pitch-shift audio without changing duration.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param semitones - Pitch shift in semitones (+12 = one octave up, -12 = one octave down)
 * @param nFft - FFT size: an even integer >= 2 (default 2048)
 * @param hopLength - Hop in samples, in `(0, nFft / 2]` (default 512), so
 *   frames overlap by at least half a window
 * @returns Pitch-shifted audio
 */
export declare function pitchShift(request: PitchShiftRequest): Float32Array;
export declare function pitchShift(samples: Float32Array, sampleRate: number, semitones: number, options?: ValidateOptions): Float32Array;
export declare function pitchShift(samples: Float32Array, sampleRate: number, semitones: number, nFft?: number, hopLength?: number, options?: ValidateOptions): Float32Array;
/**
 * Pitch-correct audio from a current MIDI note to a target MIDI note.
 *
 * Applies one constant, immediate transpose with no retune glide and preserves
 * the input buffer length. The whole interval is applied however large it is:
 * both endpoints are validated to [0, 127], so a two-octave move such as
 * C3 -> C5 transposes by the full 24 semitones. Use
 * {@link pitchCorrectToMidiTimevarying} for a caller-supplied pitch contour.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz
 * @param currentMidi - Detected/current MIDI note number
 * @param targetMidi - Desired MIDI note number
 * @returns Pitch-corrected audio
 */
export declare function pitchCorrectToMidi(request: PitchCorrectToMidiRequest): Float32Array;
export declare function pitchCorrectToMidi(samples: Float32Array, sampleRate?: number, currentMidi?: number, targetMidi?: number, options?: ValidateOptions): Float32Array;
/**
 * Contour-following ("time-varying") pitch correction toward a MIDI target.
 *
 * Unlike {@link pitchCorrectToMidi} (a single constant transpose), this follows
 * the caller-supplied per-frame `f0Hz` contour and retunes every voiced frame
 * toward `targetMidi`, so vibrato/drift in the source is tracked rather than
 * flattened. `voiced` (truthy = voiced) and `voicedProb` ([0,1]) are optional;
 * omitting them treats every frame as voiced. An `f0Hz` NaN is accepted only
 * when the corresponding `voiced` entry is falsy, matching pYIN output. The
 * `voicedFlag` / `voicedProb` arrays of a {@link PitchResult} can be passed
 * through directly.
 *
 * @param samples - Audio samples (mono, float32)
 * @param f0Hz - Per-frame measured F0 in Hz (one entry per analysis frame)
 * @param targetMidi - Desired MIDI note number
 * @param sampleRate - Sample rate in Hz
 * @param hopLength - F0 hop in samples (frame i covers sample i*hopLength)
 * @param voiced - Optional per-frame voiced flags (truthy = voiced)
 * @param voicedProb - Optional per-frame voicing probability in [0, 1]
 * @returns Pitch-corrected audio
 */
export declare function pitchCorrectToMidiTimevarying(request: PitchCorrectToMidiTimevaryingRequest): Float32Array;
export declare function pitchCorrectToMidiTimevarying(samples: Float32Array, f0Hz: Float32Array, targetMidi: number, sampleRate?: number, hopLength?: number, voiced?: VoicedFlags, voicedProb?: Float32Array, options?: ValidateOptions): Float32Array;
/**
 * Contour-following pitch correction toward a fixed MIDI note OR a musical
 * scale, with tunable retune strength and vibrato preservation.
 *
 * Generalises {@link pitchCorrectToMidiTimevarying}: the same caller-supplied
 * per-frame `f0Hz` contour drives correction, but `options.mode` selects between
 * a fixed-MIDI target (`'midi'`, default) and scale quantisation (`'scale'`),
 * and the retune knobs shape natural-vs-robotic correction. An `f0Hz` NaN is
 * accepted only for a frame marked unvoiced.
 *
 * @param samples - Audio samples (mono, float32)
 * @param f0Hz - Per-frame measured F0 in Hz (one entry per analysis frame)
 * @param sampleRate - Sample rate in Hz
 * @param hopLength - F0 hop in samples (frame i covers sample i*hopLength)
 * @param options - Target mode + retune knobs + optional voiced/voicedProb arrays
 * @returns Pitch-corrected audio
 */
export declare function pitchCorrectTimevarying(request: PitchCorrectTimevaryingRequest): Float32Array;
export declare function pitchCorrectTimevarying(samples: Float32Array, f0Hz: Float32Array, sampleRate?: number, hopLength?: number, options?: PitchCorrectOptions): Float32Array;
