import type { EngineCaptureStatus, EngineMarker, EngineTrackLane, RealtimeEngine } from '../index';
import type { SonareEngineSyncCaptureMessage, SonareEngineTransportFacade } from './messages';
/** Capture configuration options accepted by the engine's `configureCapture`. */
export interface CaptureOptions {
    bufferFrames: number;
    channels?: number;
    source?: EngineCaptureStatus['source'];
    recordOffsetSamples?: number;
    inputMonitor?: {
        enabled: boolean;
        gain?: number;
    };
}
/**
 * Normalizes capture options into the resolved config carried by the
 * `syncCapture` message, applying defaults and refusing a non-integer count.
 *
 * @param options Raw capture options.
 * @param defaultChannels Channel count to use when `options.channels` is unset.
 * @throws RangeError if a frame count, channel count or offset is not an integer.
 */
export declare function buildCaptureConfig(options: CaptureOptions, defaultChannels: number): Omit<SonareEngineSyncCaptureMessage, 'type'>;
/**
 * Collaborator surface the transport facade needs from the owning engine: the
 * realtime node (sample-accurate command transport), the offline engine it
 * mirrors, and the tempo/loop setters plus playing-state bookkeeping.
 */
export interface EngineTransportContext {
    readonly sampleRate: number;
    realtimeNode: {
        play(sampleTime?: number): boolean;
        stop(sampleTime?: number): boolean;
        seekPpq(ppq: number, sampleTime?: number): boolean;
        seekSample(timelineSample: number, sampleTime?: number): boolean;
    };
    offlineEngine: RealtimeEngine;
    flushOfflineMirror(): void;
    setTransportPlaying(playing: boolean): void;
    flushPendingInstrumentSync(): void;
    setTempo(bpm: number): void;
    setTempoSegments(segments: readonly {
        startPpq: number;
        bpm: number;
    }[]): void;
    setLoop(startPpq: number, endPpq: number, enabled?: boolean): boolean;
}
/** Builds the public transport facade that fans control to both engines. */
export declare function buildTransportFacade(ctx: EngineTransportContext): SonareEngineTransportFacade;
/**
 * Validates and normalizes an append-only mixer-lane declaration.
 *
 * Lane indices are append-only: the new list must start with the already
 * declared lane ids in their current order and may only append new track ids.
 * Returns the normalized lane entries (numbers coerced to descriptors) and the
 * resulting ordered id list.
 *
 * @throws if any track id is invalid, ids are duplicated, or the existing lane
 *   order is not preserved.
 */
export declare function normalizeTrackLanes(existing: readonly number[], lanes: ReadonlyArray<number | EngineTrackLane>): {
    entries: EngineTrackLane[];
    ids: number[];
};
/**
 * Resolves a marker set, assigning fresh ids to entries without one and
 * validating explicit ids (positive, unique).
 *
 * @param markers The marker list to resolve.
 * @param nextMarkerId The id counter to draw fresh ids from.
 * @returns The resolved markers and the advanced id counter.
 * @throws on a non-finite ppq, an invalid id, or a duplicate id.
 */
export declare function resolveMarkerSet(markers: ReadonlyArray<{
    ppq: number;
    name?: string;
    id?: number;
}>, nextMarkerId: number): {
    resolved: EngineMarker[];
    nextMarkerId: number;
};
