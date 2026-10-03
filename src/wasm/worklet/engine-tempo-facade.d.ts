import type { EngineTempoSegment, EngineTimeSignatureSegment, EngineTransportState, RealtimeEngine } from '../index';
import type { SonareRealtimeEngineNode } from './engine-node';
import type { SonareEngineSyncMessage } from './messages';
import { SonareEngineCommandType } from './protocol';
interface TimeSignature {
    numerator: number;
    denominator: number;
}
/**
 * Collaborator surface the tempo / time-signature / loop / transport helpers
 * need from the owning {@link SonareEngine}: the offline engine they mirror
 * into, the realtime node they command and query, the out-of-band sync poster,
 * and getters/setters for the tempo-map and cached-transport state the engine
 * holds (so the helpers mutate it by reference).
 */
export interface EngineTempoContext {
    readonly offlineEngine: RealtimeEngine;
    readonly realtimeNode: SonareRealtimeEngineNode;
    sendCommand(command: {
        type: SonareEngineCommandType;
        targetId?: number;
        sampleTime?: number;
        argFloat?: number;
        argInt?: number;
    }): boolean;
    postSync(message: SonareEngineSyncMessage): void;
    getTempoBpm(): number;
    setTempoBpm(bpm: number): void;
    getTimeSignature(): TimeSignature;
    setTimeSignature(signature: TimeSignature): void;
    getTempoSegments(): EngineTempoSegment[];
    setTempoSegments(segments: EngineTempoSegment[]): void;
    getTimeSignatureSegments(): EngineTimeSignatureSegment[];
    setTimeSignatureSegments(segments: EngineTimeSignatureSegment[]): void;
    setLatestTransportState(state: EngineTransportState): void;
    getLatestTransportState(): EngineTransportState | undefined;
}
export declare function postTempoSync(ctx: EngineTempoContext): void;
export declare function setTempo(ctx: EngineTempoContext, bpm: number): void;
export declare function setTempoSegments(ctx: EngineTempoContext, segments: readonly EngineTempoSegment[]): void;
export declare function setTimeSignature(ctx: EngineTempoContext, numerator: number, denominator: number): void;
export declare function setTimeSignatureSegments(ctx: EngineTempoContext, segments: readonly EngineTimeSignatureSegment[]): void;
export declare function setLoop(ctx: EngineTempoContext, startPpq: number, endPpq: number, enabled?: boolean): boolean;
export declare function countInEndSample(ctx: EngineTempoContext, startSample: number, bars: number): number;
export declare function getTransportState(ctx: EngineTempoContext): Promise<EngineTransportState>;
export declare function cachedTransportState(ctx: EngineTempoContext): EngineTransportState | undefined;
export {};
