import type { EngineClip, EngineMidiClipSchedule, RealtimeEngine } from '../index.js';
import type { ClipPageProvider } from '../realtime_engine.js';
import type { SonareEngineSyncMessage } from './messages.js';
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
    /**
     * The OPFS stream (primed through the worklet's pull bridge) whose provider
     * `clip` schedules, or undefined; throws when the clip id is not the stream's.
     */
    workletClipStream(clip: EngineClip): {
        clipId: number;
        streamKey: number;
    } | undefined;
    /** True while an OPFS stream owns the worklet provider slot of `clipId`. */
    hasClipStream(clipId: number): boolean;
}
export declare function addClip(ctx: EngineClipContext, trackId: string | number, buffer: Float32Array[] | ClipPageProvider, startPpq: number, opts?: Partial<Omit<EngineClip, 'channels' | 'pageProvider' | 'startPpq'>>): number;
export declare function removeClip(ctx: EngineClipContext, clipId: number): void;
/** Replaces the whole clip store with one clip and syncs the worklet, dropping every previous id. */
export declare function replaceClips(ctx: EngineClipContext, clip: EngineClip, previousClipIds: readonly number[]): void;
export declare function setMidiClips(ctx: EngineClipContext, clips: readonly EngineMidiClipSchedule[]): void;
