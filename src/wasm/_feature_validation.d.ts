/**
 * Input checks the spectrogram and inverse-transform entries share.
 */
import type { ValidateOptions } from './validation';
export type GuardedOptions = ValidateOptions;
export declare function validatePositiveIntegers(fnName: string, values: Record<string, number>): void;
export declare function validateMelFrequencyRange(fnName: string, fmin: number, fmax: number, sampleRate: number): void;
