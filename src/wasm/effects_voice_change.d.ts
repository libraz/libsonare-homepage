import type { RealtimeVoiceChangerConfigInput } from './public_types.js';
import type { ValidateOptions } from './validation.js';
/** How `formantFactor` relates to the pitch shift in {@link voiceChange}. */
export type FormantMode = 'relative' | 'absolute';
/** Options for {@link voiceChange}. All fields are optional. */
export interface VoiceChangeOptions extends ValidateOptions {
    /** Pitch shift in semitones (negative = down). Default 0. */
    pitchSemitones?: number;
    /** Formant scale factor (>1 brightens, <1 darkens). Default 1. */
    formantFactor?: number;
    /**
     * How `formantFactor` relates to the pitch shift. Default `'relative'`.
     *
     * - `'relative'`: `formantFactor` is the warp applied after the pitch shift, so the
     *   formants end up at `formantFactor * 2^(pitchSemitones / 12)` of the input's.
     * - `'absolute'`: `formantFactor` is the formant shift relative to the input (1 keeps
     *   the formants where they were); the warp applied is
     *   `formantFactor / 2^(pitchSemitones / 12)`. A request whose warp falls outside
     *   [0.55, 1.65] throws a `RangeError` naming the reachable `formantFactor` range for
     *   the given `pitchSemitones`; it is never clamped.
     */
    formantMode?: FormantMode;
}
/** Canonical request form for one-shot voice changing. */
export interface VoiceChangeRequest extends VoiceChangeOptions {
    samples: Float32Array;
    sampleRate?: number;
}
/**
 * Apply a voice change by shifting pitch and formants independently.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz
 * @param options - Pitch/formant settings ({@link VoiceChangeOptions})
 * @returns Voice-changed audio
 */
export declare function voiceChange(request: VoiceChangeRequest): Float32Array;
export declare function voiceChange(samples: Float32Array, sampleRate?: number, options?: VoiceChangeOptions): Float32Array;
/** Options for the offline {@link voiceChangeRealtime} convenience wrapper. */
export interface VoiceChangeRealtimeOptions extends ValidateOptions {
    /** Channel count (1 = mono, 2 = interleaved stereo). */
    channels?: 1 | 2;
    /** @deprecated The shared C-ABI renderer uses a fixed cross-surface block size. */
    blockSize?: number;
}
/** Canonical request form for offline realtime voice changing. */
export interface VoiceChangeRealtimeRequest extends VoiceChangeRealtimeOptions {
    samples: Float32Array;
    sampleRate?: number;
    preset?: RealtimeVoiceChangerConfigInput;
}
/**
 * Applies the realtime voice-changer chain to a whole buffer in one call.
 *
 * Uses the shared C-ABI renderer, so Python, Node, and WASM use the same
 * fixed block size and latency compensation. For mono, `samples` is a plain
 * buffer; for stereo, it is interleaved (L0,R0,L1,R1,...).
 *
 * @param samples - Audio samples (mono, or interleaved stereo when channels=2)
 * @param sampleRate - Sample rate in Hz (default 48000, matching Python/Node)
 * @param preset - Voice-changer preset id or full config object
 * @param options - Channel count and block size ({@link VoiceChangeRealtimeOptions})
 * @returns The processed buffer (same layout/length as the input).
 */
export declare function voiceChangeRealtime(request: VoiceChangeRealtimeRequest): Float32Array;
export declare function voiceChangeRealtime(samples: Float32Array, sampleRate?: number, preset?: RealtimeVoiceChangerConfigInput, options?: VoiceChangeRealtimeOptions): Float32Array;
