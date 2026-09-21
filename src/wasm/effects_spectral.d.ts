/**
 * Region-based spectral editing: time x frequency rectangles applied over an
 * STFT and resynthesized.
 */
import type { SpectralEditOptions, SpectralRegionOp } from './public_types';
import type { ValidateOptions } from './validation';
export interface SpectralEditRequest extends SpectralEditOptions, ValidateOptions {
    samples: Float32Array;
    sampleRate: number;
    ops?: SpectralRegionOp[];
}
/**
 * Apply region-based spectral edits (gain/attenuate/mute/heal) to mono audio.
 *
 * Each op is a time x frequency rectangle applied in array order over a single
 * STFT buffer, so a later op observes the result of earlier ops. The output has
 * the same length and sample rate as the input; an empty `ops` list is an
 * identity transform (within the iSTFT's own tolerance).
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz
 * @param ops - Region edit ops applied in order ({@link SpectralRegionOp})
 * @param options - STFT + heal configuration ({@link SpectralEditOptions})
 * @returns Edited audio
 */
export declare function spectralEdit(request: SpectralEditRequest): Float32Array;
export declare function spectralEdit(samples: Float32Array, sampleRate: number, ops?: SpectralRegionOp[], options?: SpectralEditOptions & ValidateOptions): Float32Array;
