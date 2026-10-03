import type { EngineClip, EngineMidiClipSchedule, RealtimeEngine } from '../index';
import type { ClipPageProvider } from '../realtime_engine';
import type { SonareEngineSyncMessage } from './messages';
/**
 * Collaborator surface the audio/MIDI clip scheduling helpers need from the
 * owning {@link SonareEngine}: the clip stores they mutate, the offline engine
 * they mirror into, the sync poster, and the clip-id allocator / lane resolvers.
 */
export interface EngineClipContext {
    readonly offlineEngine: RealtimeEngine;
    readonly clips: Map<number, EngineClip>;
    readonly midiClips: Map<number, EngineMidiClipSchedule>;
    allocateClipId(): number;
    postSync(message: SonareEngineSyncMessage, transfer?: Transferable[]): void;
    resolveTargetId(target: string | number): number;
    ensureTrackLane(target: string | number): number;
    /** Commits a provider already primed through the worklet's OPFS pull bridge. */
    commitWorkletClipPageProvider(clip: EngineClip): boolean;
}
export declare function addClip(ctx: EngineClipContext, trackId: string | number, buffer: Float32Array[] | ClipPageProvider, startPpq: number, opts?: Partial<Omit<EngineClip, 'channels' | 'pageProvider' | 'startPpq'>>): number;
export declare function removeClip(ctx: EngineClipContext, clipId: number): void;
export declare function setMidiClips(ctx: EngineClipContext, clips: readonly EngineMidiClipSchedule[]): void;
