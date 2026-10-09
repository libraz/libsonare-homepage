import { type WorkletInput, type WorkletOutput } from './audio_types.js';
import { type SonareEngineCaptureRequestMessage, type SonareEngineInsertGainReductionRequestMessage, type SonareEngineSyncMessage, type SonareEngineTransportRequestMessage, type SonareRealtimeEngineWorkletProcessorOptions, type WorkletTransport } from './messages.js';
import { type SonareEngineCommandRecord } from './protocol.js';
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
    private readonly lastMeterFrameBySlot;
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
    private readonly postedClipPageRequestClipIds;
    private readonly postedClipPageRequestPageIndices;
    private postedClipPageRequestCount;
    private clipPageRequestFrameClock;
    private lastClipPageRequestPostFrame;
    private readonly clipPageRepostFrames;
    private readonly clipPageRequestPayloadEntries;
    private readonly clipPageRequestPayloadArrays;
    private readonly clipPageRequestMessage;
    private readonly clipPageRequestMessageWithDropped;
    constructor(options?: SonareRealtimeEngineWorkletProcessorOptions, transport?: WorkletTransport);
    process(inputs: WorkletInput, outputs: WorkletOutput): boolean;
    private reacquireChannelBuffers;
    private reacquireMonitorBuffers;
    receiveCommand(command: SonareEngineCommandRecord): void;
    receiveSync(message: SonareEngineSyncMessage): void;
    private applySync;
    receiveCaptureRequest(message: SonareEngineCaptureRequestMessage): void;
    receiveTransportRequest(message: SonareEngineTransportRequestMessage): void;
    receiveInsertGainReductionRequest(message: SonareEngineInsertGainReductionRequestMessage): void;
    destroy(): void;
    private drainCommands;
    private safeApplyCommand;
    private applyCommand;
    private publishTelemetry;
    private writeTelemetryScratch;
    private publishTelemetryRecord;
    private publishMeters;
    private meterDue;
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
    /**
     * Applies a clip delta one clip at a time, so clips it does not name keep
     * their storage instead of being copied again. A refusal part-way restores
     * the published set from the live mirror and rethrows.
     */
    private applyClipDelta;
    /** The provider of `clipId` when `streamKey` names its owner, else undefined. */
    private ownedPagedClipProvider;
    private removePagedClipProvider;
    private clearPagedClipProviders;
    private commandRingFromSharedBuffer;
    private telemetryRingFromSharedBuffer;
}
