import type { EngineCaptureStatus, RealtimeEngine } from '../index.js';
import { type EngineCommitContext } from './engine-commit.js';
import type { SonareRealtimeEngineNode } from './engine-node.js';
import { type CaptureOptions } from './engine-offline.js';
import type { SonareEngineSyncCaptureMessage, SonareEngineSyncMessage } from './messages.js';
type CaptureConfig = Omit<SonareEngineSyncCaptureMessage, 'type'>;
/**
 * Collaborator surface the capture/record/punch setters need from the owning
 * {@link SonareEngine}: the offline engine they mirror into, the realtime node
 * they command and query, the channel count, the out-of-band sync poster, the
 * capture-config accessor, and the target-id resolver.
 */
export interface EngineCaptureContext extends EngineCommitContext {
    readonly offlineEngine: RealtimeEngine;
    readonly realtimeNode: SonareRealtimeEngineNode;
    readonly offlineChannelCount: number;
    postSync(message: SonareEngineSyncMessage): void;
    getCaptureConfig(): CaptureConfig | undefined;
    setCaptureConfig(config: CaptureConfig): void;
}
export declare function configureCapture(ctx: EngineCaptureContext, options: CaptureOptions): void;
export declare function armRecord(ctx: EngineCaptureContext, trackId: string | number, enabled: boolean): boolean;
export declare function punch(ctx: EngineCaptureContext, inPpq: number, outPpq: number): boolean;
export declare function captureStatus(ctx: EngineCaptureContext): Promise<EngineCaptureStatus>;
export declare function capturedAudio(ctx: EngineCaptureContext): Promise<Float32Array[]>;
export declare function resetCapture(ctx: EngineCaptureContext): Promise<void>;
export {};
