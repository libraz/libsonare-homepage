import { type WorkletInput, type WorkletOutput } from './audio_types';
import { type SonareEngineCaptureRequestMessage, type SonareEngineSyncMessage, type SonareEngineTransportRequestMessage, type SonareRealtimeEngineWorkletProcessorOptions, type WorkletTransport } from './messages';
import { type SonareEngineCommandRecord } from './protocol';
/**
 * AudioWorklet-style bridge for the DAW realtime engine facade.
 *
 * Backed by the `sonare.wasm` embind facade.
 */
export declare class SonareRealtimeEngineWorkletProcessor {
    private static warnedChannelScratchOverflow;
    readonly sampleRate: number;
    readonly blockSize: number;
    readonly channelCount: number;
    private engine;
    private closed;
    private commandRing?;
    private telemetryRing?;
    private meterRing?;
    private scopeRing?;
    private clipPageRequestRing?;
    private externalMidiRing?;
    private transport?;
    private meterIntervalFrames;
    private lastMeterFrame;
    private scopeIntervalFrames;
    private scopeEnabled;
    private scopeBands;
    private metronomeConfig;
    private channelBuffers;
    private monitorBuffers;
    private readonly cueOutput;
    private readonly liveClips;
    private readonly pagedClipProviders;
    private readonly pagedClipPageFrames;
    private readonly pendingPagedClips;
    private readonly clipPageRequestClipIds;
    private readonly clipPageRequestPageIndices;
    private clipPageRequestOverflowReported;
    constructor(options?: SonareRealtimeEngineWorkletProcessorOptions, transport?: WorkletTransport);
    process(inputs: WorkletInput, outputs: WorkletOutput): boolean;
    private reacquireChannelBuffers;
    private reacquireMonitorBuffers;
    receiveCommand(command: SonareEngineCommandRecord): void;
    receiveSync(message: SonareEngineSyncMessage): void;
    private applySync;
    receiveCaptureRequest(message: SonareEngineCaptureRequestMessage): void;
    receiveTransportRequest(message: SonareEngineTransportRequestMessage): void;
    destroy(): void;
    private drainCommands;
    private safeApplyCommand;
    private applyCommand;
    private publishTelemetry;
    private writeTelemetryScratch;
    private publishTelemetryRecord;
    private publishMeters;
    private writeMeterScratch;
    private publishScope;
    private postScopeScratch;
    private writeScopeScratch;
    private publishExternalMidi;
    /**
     * Forward a bounded batch of native page misses to the main thread. This
     * deliberately runs after audio rendering: a cache miss is silence for this
     * block, and OPFS I/O must never delay `process()`.
     */
    private publishClipPageRequests;
    private removePagedClipProvider;
    private clearPagedClipProviders;
    private commandRingFromSharedBuffer;
    private telemetryRingFromSharedBuffer;
}
