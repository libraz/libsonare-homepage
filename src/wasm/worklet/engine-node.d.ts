import type { EngineCaptureStatus, EngineTransportState } from '../index';
import type { SonareEngineClipPageRequestMessage, SonareEngineSyncErrorMessage, SonareRealtimeEngineNodeCapabilities, SonareRealtimeEngineNodeOptions, SonareWorkletExternalMidiEvent } from './messages';
import { type SonareClipPageRequestRingBuffer, type SonareEngineCommandRecord, type SonareEngineCommandRingBuffer, type SonareEngineTelemetryRecord, type SonareEngineTelemetryRingBuffer, type SonareExternalMidiRingBuffer, type SonareMeterRingBuffer, type SonareScopeRingBuffer, type SonareWorkletMeterSnapshot, type SonareWorkletScopeSnapshot } from './protocol';
export declare class SonareRealtimeEngineNode {
    readonly node: AudioWorkletNode;
    readonly capabilities: SonareRealtimeEngineNodeCapabilities;
    readonly commandRing?: SonareEngineCommandRingBuffer;
    readonly telemetryRing?: SonareEngineTelemetryRingBuffer;
    readonly meterRing?: SonareMeterRingBuffer;
    readonly scopeRing?: SonareScopeRingBuffer;
    readonly clipPageRequestRing?: SonareClipPageRequestRingBuffer;
    readonly externalMidiRing?: SonareExternalMidiRingBuffer;
    readonly ready: Promise<void>;
    private telemetryReadIndex;
    private meterReadIndex;
    private scopeReadIndex;
    private clipPageRequestDroppedRead;
    private ringPollTimer;
    private telemetryListeners;
    private meterListeners;
    private scopeListeners;
    private midiOutListeners;
    private clipPageRequestListeners;
    private syncErrorListeners;
    private captureRequestId;
    private readonly captureRequests;
    private transportRequestId;
    private readonly transportRequests;
    private resolveReady;
    private rejectReady;
    private destroyed;
    private constructor();
    /** Subscribes to control-plane sync rejections reported by the worklet. */
    onSyncError(listener: (message: SonareEngineSyncErrorMessage) => void): () => void;
    static create(context: BaseAudioContext, options?: SonareRealtimeEngineNodeOptions): Promise<SonareRealtimeEngineNode>;
    play(sampleTime?: number): boolean;
    /** Queues a reset of the master's integrated-loudness accumulator. */
    resetMasterLoudnessMeter(sampleTime?: number): boolean;
    stop(sampleTime?: number): boolean;
    seekSample(timelineSample: number, sampleTime?: number): boolean;
    seekPpq(ppq: number, sampleTime?: number): boolean;
    sendCommand(command: SonareEngineCommandRecord): boolean;
    requestCaptureStatus(): Promise<EngineCaptureStatus>;
    requestCapturedAudio(): Promise<Float32Array[]>;
    requestCaptureReset(): Promise<void>;
    requestTransportState(): Promise<EngineTransportState>;
    pollTelemetry(): SonareEngineTelemetryRecord[];
    pollMeters(): SonareWorkletMeterSnapshot[];
    pollScope(): SonareWorkletScopeSnapshot[];
    /** Drain lowered MIDI-1 records from the SAB ring on the main thread. */
    pollMidiOut(): SonareWorkletExternalMidiEvent[];
    /**
     * Drains bounded paged-clip misses from the SAB ring and forwards one batch
     * to subscribers. In postMessage mode the legacy handler remains available,
     * but that degraded path is not realtime-safe for OPFS streaming.
     */
    pollClipPageRequests(): SonareEngineClipPageRequestMessage | undefined;
    onTelemetry(callback: (telemetry: SonareEngineTelemetryRecord) => void): () => void;
    onMeter(callback: (meter: SonareWorkletMeterSnapshot) => void): () => void;
    onScope(callback: (scope: SonareWorkletScopeSnapshot) => void): () => void;
    /**
     * Subscribe to external-MIDI batches drained from the engine (one call per
     * render block that produced events), already lowered to MIDI 1.0 bytes for a
     * Web MIDI output port. Returns an unsubscribe function.
     */
    onMidiOut(callback: (events: SonareWorkletExternalMidiEvent[]) => void): () => void;
    /**
     * Subscribe to bounded batches of paged-clip misses from the worklet. The
     * callback runs on the main thread and may initiate asynchronous OPFS I/O.
     */
    onClipPageRequests(callback: (message: SonareEngineClipPageRequestMessage) => void): () => void;
    destroy(): void;
    private emitTelemetry;
    private startRingPolling;
    private stopRingPollingIfUnused;
    private emitMeter;
    private emitMidiOut;
    private emitClipPageRequests;
    private emitScope;
    private sendCaptureRequest;
    private sendTransportRequest;
}
