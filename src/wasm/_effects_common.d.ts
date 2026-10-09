/**
 * Input conversion the effect families share.
 */
import type { VoicedFlags } from './public_types.js';
export declare function toVoicedFloat32(fnName: string, voiced: VoicedFlags): Float32Array;
export declare function assertPitchTrackLengths(fnName: string, f0Hz: Float32Array, voiced?: VoicedFlags | null, voicedProb?: Float32Array | null): void;
/** The time fields a note or event entry may spell in samples or in seconds. */
interface TimedEntry {
    onsetSample?: number;
    onsetSec?: number;
    offsetSample?: number;
    offsetSec?: number;
    edit?: {
        timeOffsetSamples?: number;
        timeOffsetSec?: number;
    };
}
/**
 * Resolve the time fields of a note or event set into the samples the core
 * reads. A bound or offset may be spelled in samples or in seconds (rounded to
 * the nearest sample at `sampleRate`), one spelling each. `spans` is false for
 * entries identified by frame bounds, which carry no sample span.
 */
export declare function resolveEntryTimes<T extends TimedEntry>(fnName: string, entries: readonly T[], arrayName: string, sampleRate: number, spans: boolean): T[];
export {};
