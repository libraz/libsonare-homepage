/**
 * Input conversion the effect families share.
 */
import type { VoicedFlags } from './public_types';
export declare function toVoicedFloat32(fnName: string, voiced: VoicedFlags): Float32Array;
export declare function assertPitchTrackLengths(fnName: string, f0Hz: Float32Array, voiced?: VoicedFlags | null, voicedProb?: Float32Array | null): void;
