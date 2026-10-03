import type { EngineMarker, RealtimeEngine } from '../index';
import type { SonareEngineSyncMessage } from './messages';
import { type SonareEngineCommandRecord } from './protocol';
/**
 * Collaborator surface the marker helpers need from the owning
 * {@link SonareEngine}: the marker store and id counter, the offline engine they
 * mirror into, the sync poster, the realtime command sender, and the loop setter.
 */
export interface EngineMarkerContext {
    readonly offlineEngine: RealtimeEngine;
    readonly markers: Map<number, EngineMarker>;
    getNextMarkerId(): number;
    setNextMarkerId(value: number): void;
    postSync(message: SonareEngineSyncMessage): void;
    sendCommand(command: SonareEngineCommandRecord): boolean;
    setLoop(startPpq: number, endPpq: number, enabled: boolean): boolean;
}
export declare function addMarker(ctx: EngineMarkerContext, ppq: number, name?: string): number;
/**
 * Replaces the whole marker set in one call.
 *
 * Entries without an `id` are assigned fresh ids; entries carrying an `id`
 * keep it (ids must be positive and unique within the list). Returns the
 * resolved markers in the order given, so a caller can map its own marker
 * identities to the engine ids used by `seekMarker`/`setLoopFromMarkers`.
 *
 * @param markers The full marker list (an empty list clears all markers).
 * @returns The markers with their resolved engine ids.
 */
export declare function setMarkers(ctx: EngineMarkerContext, markers: ReadonlyArray<{
    ppq: number;
    name?: string;
    id?: number;
}>): EngineMarker[];
export declare function markerCount(ctx: EngineMarkerContext): number;
export declare function markerByIndex(ctx: EngineMarkerContext, index: number): EngineMarker;
export declare function marker(ctx: EngineMarkerContext, markerId: number): EngineMarker;
export declare function seekMarker(ctx: EngineMarkerContext, markerId: number): boolean;
export declare function setLoopFromMarkers(ctx: EngineMarkerContext, startMarkerId: number, endMarkerId: number): boolean;
