import type { MixOptions, MixResult } from './public_types';
export declare function mixingScenePresetNames(): string[];
/**
 * Get a built-in mixing scene preset serialized as JSON. This is the canonical
 * name shared with the Node and Python bindings; the returned JSON loads
 * directly into a {@link Mixer} via {@link Mixer.fromSceneJson}.
 *
 * @param presetName - Preset name (see {@link mixingScenePresetNames})
 * @returns Scene JSON string
 */
export declare function mixingScenePresetJson(presetName: string): string;
/** Inputs for the one-shot {@link mixStereo} facade. */
export interface MixStereoRequest extends MixOptions {
    leftChannels: Float32Array[];
    rightChannels: Float32Array[];
    sampleRate?: number;
}
/**
 * One-shot stereo mix of multiple strips through the routing graph + master bus.
 *
 * Each returned per-strip meter reflects only this single one-shot block. The
 * LUFS fields (`momentaryLufs`, `shortTermLufs`, `integratedLufs`) are
 * integrators whose windows that block does not fill, so they read the -120 dB
 * floor sentinel; drive a streaming {@link Mixer} block-by-block if you need
 * meaningful loudness.
 *
 * The true-peak fields are not integrators and need no streaming: each is a
 * max-hold over the block just processed and is valid from the first one,
 * flooring only on silence. This facade mixes the whole input as a single block,
 * which is the whole-signal case, so the block-edge under-read documented on
 * `MixMeterSnapshot.truePeakDbL` does not apply to the reading here.
 *
 * @param leftChannels - Per-strip left input buffers (all the same length)
 * @param rightChannels - Per-strip right input buffers (all the same length)
 * @param sampleRate - Sample rate in Hz
 * @param options - Per-strip mix options (trim, fader, pan, width, mute)
 */
export declare function mixStereo(request: MixStereoRequest): MixResult;
export declare function mixStereo(leftChannels: Float32Array[], rightChannels: Float32Array[], sampleRate?: number, options?: MixOptions): MixResult;
