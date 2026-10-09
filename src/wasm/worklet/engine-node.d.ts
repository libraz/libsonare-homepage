import type { EngineCaptureStatus, EngineTransportState } from '../index.js';
import type { SonareEngineClipPageRequestMessage, SonareEngineSyncErrorMessage, SonareRealtimeEngineNodeCapabilities, SonareRealtimeEngineNodeOptions, SonareWorkletExternalMidiEvent } from './messages.js';
import { type SonareClipPageRequestRingBuffer, type SonareEngineCommandRecord, type SonareEngineCommandRingBuffer, type SonareEngineTelemetryRecord, type SonareEngineTelemetryRingBuffer, type SonareExternalMidiRingBuffer, type SonareMeterRingBuffer, type SonareScopeRingBuffer, type SonareWorkletMeterSnapshot, type SonareWorkletScopeSnapshot } from './protocol.js';
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
    private insertGainReductionRequestId;
    private readonly insertGainReductionRequests;
    private resolveReady;
    private rejectReady;
    private readonly epoch;
    private constructor();
    /** Subscribes to control-plane sync rejections reported by the worklet. */
    onSyncError(listener: (message: SonareEngineSyncErrorMessage) => void): () => void;
    static create(context: BaseAudioContext, options?: SonareRealtimeEngineNodeOptions): Promise<SonareRealtimeEngineNode>;
    play(sampleTime?: number): boolean;
    /** Queues a reset of the master's integrated-loudness accumulator. */
    resetMasterLoudnessMeter(sampleTime?: number): boolean;
    /** Queues a reset of every mixer and effect processor to its prepared state. */
    resetProcessorState(sampleTime?: number): boolean;
    stop(sampleTime?: number): boolean;
    seekSample(timelineSample: number, sampleTime?: number): boolean;
    seekPpq(ppq: number, sampleTime?: number): boolean;
    /** Whether the node could queue one more well-formed command now; queues nothing. */
    hasCommandRoom(): boolean;
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
     * Subscribe to batches of external-MIDI events drained from the engine,
     * already lowered to MIDI 1.0 bytes for a Web MIDI output port. Each event
     * carries its absolute `renderFrame`; a batch is not a render block. With
     * postMessage transport a batch holds one block's events; with the SAB ring
     * it holds whatever accumulated since the previous poll (every 16 ms), which
     * may span many blocks. While subscribed, the poll consumes the ring, so a
     * manual {@link pollMidiOut} sees only what arrived since. Returns an
     * unsubscribe function.
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
    /**
     * Reads one target's per-insert gain reduction (dB, each <= 0, pre-to-post insert order)
     * from the worklet. Works in both ring and postMessage meter modes; rejects when the
     * target is invalid or mixing is not compiled in.
     */
    pollInsertGainReduction(targetId: number): Promise<number[]>;
    private emitScope;
    private sendCaptureRequest;
    private sendTransportRequest;
}
