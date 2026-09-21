/**
 * Snap a MIDI value to the nearest pitch class enabled by `modeMask`.
 *
 * `modeMask` is a 12-bit mask. For natural C major use `0b101010110101`.
 * `referenceMidi` defaults to A4 (69) when passed as 0.
 */
export declare function scaleQuantizeMidi(root: number, modeMask: number, midi: number, referenceMidi?: number): number;
export declare function scaleCorrectionSemitones(root: number, modeMask: number, midi: number, referenceMidi?: number): number;
export declare function scalePitchClassEnabled(root: number, modeMask: number, pitchClass: number): boolean;
