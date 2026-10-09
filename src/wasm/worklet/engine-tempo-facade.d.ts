import type { EngineTempoSegment, EngineTimeSignatureSegment, EngineTransportState, RealtimeEngine } from '../index.js';
import { type EngineCommitContext } from './engine-commit.js';
import type { SonareRealtimeEngineNode } from './engine-node.js';
import type { SonareEngineSyncMessage } from './messages.js';
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
export interface EngineTempoContext extends EngineCommitContext {
    readonly offlineEngine: RealtimeEngine;
    readonly realtimeNode: SonareRealtimeEngineNode;
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
