import type { Mode, ScaleName } from './public_types_music.js';
/**
 * The 12-bit scale mask of a mode, in the layout `scaleQuantizeMidi` and the
 * pitch correctors read: bit `i` is the semitone `i` above the root.
 *
 * The mask is relative to the root, so it is the same for every `root`, which
 * is still validated. `mode` is a church-mode name (`'major'`, `'minor'`,
 * `'dorian'`, `'phrygian'`, `'lydian'`, `'mixolydian'`, `'locrian'`) or the
 * `Mode` ordinal `detectKey` reports; minor is the natural minor.
 *
 * @example
 * scaleMaskForMode(0, 'major'); // 0b101010110101
 */
export declare function scaleMaskForMode(root: number, mode: ScaleName | Mode): number;
/**
 * Snap a MIDI value to the nearest pitch class enabled by `modeMask`.
 *
 * `modeMask` is a 12-bit mask. For natural C major use `0b101010110101`.
 * `referenceMidi` defaults to A4 (69) when passed as 0.
 */
export declare function scaleQuantizeMidi(root: number, modeMask: number, midi: number, referenceMidi?: number): number;
export declare function scaleCorrectionSemitones(root: number, modeMask: number, midi: number, referenceMidi?: number): number;
export declare function scalePitchClassEnabled(root: number, modeMask: number, pitchClass: number): boolean;
