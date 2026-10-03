import type { EngineParameterInfo, EngineTempoSegment, EngineTimeSignatureSegment, EngineTrackLane, EngineTrackSend } from '../index';
import type { SonareEngineSyncTempoMessage } from './messages';
/**
 * Builds the ordered mixer-lane descriptors for a sync message.
 *
 * Each declared track id is paired with its current send list and output bus
 * (both omitted when absent) and source channel layout, defensively copying the
 * send entries.
 *
 * @param trackLaneIds Lane order (track ids) declared on the engine.
 * @param trackSends Per-track send lists.
 * @param trackOutputBus Per-track output bus routing.
 * @param trackSourceChannelLayout Per-track source channel layouts.
 * @returns Lane descriptors in lane order.
 */
export declare function buildMixerLanes(trackLaneIds: readonly number[], trackSends: ReadonlyMap<number, EngineTrackSend[]>, trackOutputBus: ReadonlyMap<number, number>, trackSourceChannelLayout: ReadonlyMap<number, number>): EngineTrackLane[];
/**
 * Builds the out-of-band tempo/time-signature sync message, deep-copying the
 * tempo and time-signature segments so the consumer cannot alias engine state.
 */
export declare function buildTempoSync(tempoBpm: number, timeSignature: {
    numerator: number;
    denominator: number;
}, tempoSegments: readonly EngineTempoSegment[], timeSignatureSegments: readonly EngineTimeSignatureSegment[]): SonareEngineSyncTempoMessage;
/**
 * Resolves a target id given as a number, or as a string naming one.
 *
 * Both spellings reach one refusal. Reading the string with `Number.parseInt`
 * stops at the first non-digit, so `"3.5"` resolves to `3` and `"5abc"` to `5`,
 * and an unparseable name resolves to `0` -- all ids the caller never named.
 * `0` is a legal destination, so the native check these feed cannot tell the
 * substitution from a deliberate choice and never reports one.
 */
export declare function resolveTargetId(target: string | number): number;
/** Resolves a registered parameter name or passes through a numeric id. */
export declare function resolveParamId(parameters: readonly EngineParameterInfo[], nodeId: string, param: string | number): number;
/** Encodes an automation curve descriptor to the engine's numeric curve code. */
export declare function curveCode(curve: number | 'linear' | 'exponential'): number;
