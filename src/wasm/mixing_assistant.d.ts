import type { MixAssistantOptions, MixAssistantResult, MixAssistantTrack } from './public_types';
/** Inputs for the {@link suggestMixScene} / {@link suggestMixSceneJson} facades. */
export interface SuggestMixSceneRequest {
    /** Tracks to mix, in the order their profiles are reported. */
    tracks: MixAssistantTrack[];
    /**
     * Shared sample rate in Hz for every track. Required: every band edge,
     * high-pass corner, sibilance band and alignment lag is derived from it, so a
     * guessed rate would silently misread 44.1 kHz material by 8.8% and report
     * `channelDelaySamples` and `durationSec` wrong with it.
     */
    sampleRate: number;
    /** Assistant tunables; every field falls back to the core default. */
    options?: MixAssistantOptions;
}
/**
 * Analyze a set of tracks and suggest a mixer scene.
 *
 * Offline only: the pipeline runs an STFT per track and evaluates every track
 * pair, so it is measured in milliseconds per track and must never be called
 * from an audio callback.
 *
 * The assistant suggests, it does not apply. Nothing is processed and no audio
 * is returned; realizing the suggestion means handing the scene to
 * {@link Mixer.fromSceneJson} as an explicit second step, for which
 * {@link suggestMixSceneJson} returns the scene already serialized.
 *
 * Degenerate input is not an error: no tracks, all-silent tracks or tracks too
 * short to measure yield an empty scene and an empty `explanation`.
 *
 * @param request - Tracks, shared sample rate and assistant options
 * @returns The suggested scene, per-track profiles, cross-track measurements
 *   and the explanation behind each change
 */
export declare function suggestMixScene(request: SuggestMixSceneRequest): MixAssistantResult;
/**
 * Suggest a mixer scene and return only the scene, as JSON.
 *
 * The same analysis as {@link suggestMixScene}, serialized in the schema
 * {@link Mixer.fromSceneJson} reads, so a caller that only wants to apply the
 * suggestion neither digs the scene out of the fuller result nor re-serializes
 * it.
 *
 * @param request - Tracks, shared sample rate and assistant options
 * @returns Scene JSON string
 */
export declare function suggestMixSceneJson(request: SuggestMixSceneRequest): string;
/**
 * Source-class identifiers the assistant can report, in enum order.
 *
 * The index of a name in this list is the value
 * {@link mixSourceClassFromName} resolves it to.
 */
export declare function mixSourceClassNames(): string[];
/**
 * Resolve a source-class identifier to its index in {@link mixSourceClassNames}.
 *
 * @param name - Source-class identifier, e.g. `"kick"`
 * @returns The index, or -1 when the name is unknown
 */
export declare function mixSourceClassFromName(name: string): number;
