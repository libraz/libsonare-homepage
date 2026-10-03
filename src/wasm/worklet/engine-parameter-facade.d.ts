import type { EngineAutomationPoint, EngineParameterInfo, EngineTrackMonitorMode, RealtimeEngine } from '../index';
import type { SonareEngineSyncMessage } from './messages';
import { SonareEngineCommandType } from './protocol';
/**
 * Collaborator surface the parameter / automation-id resolution helpers need
 * from the owning {@link SonareEngine}: the offline engine they mirror into and
 * query, the realtime node they command, the lane/bus declaration helpers, and
 * the declared track-lane id store used to resolve insert-automation ids.
 */
export interface EngineParameterContext {
    readonly offlineEngine: RealtimeEngine;
    sendCommand(command: {
        type: SonareEngineCommandType;
        targetId?: number;
        sampleTime?: number;
        argFloat?: number;
        argInt?: number;
    }): boolean;
    postSync(message: SonareEngineSyncMessage): void;
    readonly automationLanes: Map<number, EngineAutomationPoint[]>;
    readonly trackLaneIds: number[];
    resolveParamId(nodeId: string, param: string | number): number;
    ensureTrackLane(target: string | number): number;
    ensureBus(busId: number): number;
}
export declare function setParam(ctx: EngineParameterContext, nodeId: string, param: string | number, value: number): boolean;
export declare function setSoloMute(ctx: EngineParameterContext, target: string | number, solo: boolean, mute: boolean): boolean;
export declare function setTrackMonitorMode(ctx: EngineParameterContext, target: string | number, mode: EngineTrackMonitorMode, renderFrame?: number): boolean;
/**
 * Returns the automation target id for a mixer strip parameter.
 *
 * The id addresses the engine's reserved mixer namespace, so it can be fed
 * straight to setAutomationLane to automate a fader or pan without
 * registering a parameter.
 *
 * @param target Track id (declares a mixer lane on first use) or 'master'.
 * @param kind Strip parameter to address.
 * @returns Reserved engine parameter id for the strip parameter.
 */
export declare function automationParamId(ctx: EngineParameterContext, target: string | number, kind: 'faderDb' | 'pan'): number;
/**
 * Returns the automation target id for a bus fader.
 *
 * @param busId Bus id (declares the mixer bus on first use).
 * @returns Reserved engine parameter id for the bus fader gain (dB).
 */
export declare function busAutomationParamId(ctx: EngineParameterContext, busId: number): number;
/**
 * Resolves a track-lane insert parameter (JSON-key name) to the reserved
 * insert-automation id fed straight to setAutomationLane. Declares the track's
 * mixer lane first (like automationParamId) so the offline engine resolves the
 * same strip selector the realtime engine uses.
 *
 * @param target Track id (declares a mixer lane on first use).
 * @param insertIndex Index into the strip's combined insert sequence.
 * @param paramName Processor JSON-key parameter name.
 * @returns Reserved insert-automation id, or -1 when strip/insert/key unknown.
 */
export declare function resolveTrackInsertAutomationId(ctx: EngineParameterContext, target: string | number, insertIndex: number, paramName: string): number;
/**
 * Resolves a master-strip insert parameter to its reserved insert-automation
 * id.
 *
 * @param insertIndex Index into the master strip's insert sequence.
 * @param paramName Processor JSON-key parameter name.
 * @returns Reserved insert-automation id, or -1 when insert/key unknown.
 */
export declare function resolveMasterInsertAutomationId(ctx: EngineParameterContext, insertIndex: number, paramName: string): number;
/**
 * Resolves a bus-strip insert parameter to its reserved insert-automation id.
 * Declares the mixer bus first so the offline engine resolves the same bus
 * selector.
 *
 * @param busId Bus id (declares the mixer bus on first use).
 * @param insertIndex Index into the bus strip's insert sequence.
 * @param paramName Processor JSON-key parameter name.
 * @returns Reserved insert-automation id, or -1 when bus/insert/key unknown.
 */
export declare function resolveBusInsertAutomationId(ctx: EngineParameterContext, busId: number, insertIndex: number, paramName: string): number;
/**
 * Resolves a hosted instrument's continuous parameter to its reserved
 * instrument-automation id, so an instrument parameter is driven from a
 * breakpoint lane at audio-block precision like a strip insert.
 *
 * The instrument must already be bound on the offline engine for the
 * destination (the worklet mirrors every instrument sync onto it), otherwise
 * the resolve returns -1.
 *
 * @param destinationId MIDI destination the instrument is bound to.
 * @param paramName Instrument JSON-key parameter name (e.g. `cutoffHz`).
 * @returns Reserved instrument-automation id, or -1 when destination/key unknown.
 */
export declare function resolveInstrumentAutomationId(ctx: EngineParameterContext, destinationId: number, paramName: string): number;
/**
 * Returns the number of automation lanes installed on the engine, including
 * lanes whose breakpoint list is currently empty.
 *
 * @returns Engine-side automation lane count.
 */
export declare function automationLaneCount(ctx: EngineParameterContext): number;
export declare function listParameters(ctx: EngineParameterContext): EngineParameterInfo[];
/** Registers a parameter on both the offline mirror and live worklet engine. */
export declare function addParameter(ctx: EngineParameterContext, info: EngineParameterInfo): void;
/** Clears registered parameters and their automation lanes on both engines. */
export declare function clearParameters(ctx: EngineParameterContext): void;
