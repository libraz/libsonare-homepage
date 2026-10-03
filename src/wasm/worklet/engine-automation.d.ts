import type { EngineAutomationPoint, RealtimeEngine } from '../index';
import type { SonareEngineSyncMessage } from './messages';
/**
 * Collaborator surface the automation-lane helpers need from the owning
 * {@link SonareEngine}: the lane store they mutate, the offline engine they
 * mirror into, the sync poster, and the parameter-id resolver.
 */
export interface EngineAutomationContext {
    readonly offlineEngine: RealtimeEngine;
    readonly automationLanes: Map<number, EngineAutomationPoint[]>;
    postSync(message: SonareEngineSyncMessage): void;
    resolveParamId(nodeId: string, param: string | number): number;
}
export declare function scheduleParam(ctx: EngineAutomationContext, nodeId: string, param: string | number, ppq: number, value: number, curve?: number | 'linear' | 'exponential'): void;
export declare function addAutomationPoint(ctx: EngineAutomationContext, laneId: string | number, ppq: number, value: number, curve?: number | 'linear' | 'exponential'): void;
/**
 * Replaces the automation lane for `paramId` with the given breakpoints.
 *
 * Unlike scheduleParam (which appends a single point), this sets the whole
 * lane at once; an empty array clears the lane. The points are defensively
 * copied and sorted by ppq before being mirrored to the offline engine and
 * the live worklet engine.
 *
 * @param paramId Automation target id (registered parameter or a reserved
 *   engine mixer target from automationParamId/busAutomationParamId).
 * @param points Lane breakpoints; order does not matter.
 */
export declare function setAutomationLane(ctx: EngineAutomationContext, paramId: number, points: ReadonlyArray<EngineAutomationPoint>): void;
