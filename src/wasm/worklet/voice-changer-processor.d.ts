import { type WorkletInput, type WorkletOutput } from './audio_types.js';
import type { SonareRealtimeVoiceChangerMessage, SonareRealtimeVoiceChangerWorkletProcessorOptions } from './messages.js';
export declare class SonareRealtimeVoiceChangerWorkletProcessor {
    private static warnedMonoOverflow;
    private static warnedInterleavedOverflow;
    private changer;
    private readonly sampleRate;
    private readonly blockSize;
    private readonly channelCount;
    private monoInput;
    private monoOutput;
    private bufferGeneration;
    private planarChannels;
    private readonly monoPlane;
    private destroyed;
    constructor(options?: SonareRealtimeVoiceChangerWorkletProcessorOptions);
    /**
     * Handles a control-plane message from the main thread. AudioWorklet port
     * handlers run on the same audio rendering thread as `process()`: this path
     * therefore accepts only a pre-normalized POD and never parses JSON.
     */
    receiveMessage(message: SonareRealtimeVoiceChangerMessage): void;
    process(inputs: WorkletInput, outputs: WorkletOutput): boolean;
    destroy(): void;
    private reacquireBuffers;
    /**
     * Returns the number of frames we can actually process given the
     * pre-allocated capacity. If the host requests more frames than the
     * worst-case block size declared at construction time, we clamp to the
     * available capacity and warn once — we MUST NOT reallocate on the
     * realtime audio thread.
     */
    private ensureMonoCapacity;
    /**
     * Same contract as ensureMonoCapacity but for the planar per-channel
     * scratch. Returns the number of frames that fit in the available capacity.
     */
    private ensureInterleavedCapacity;
}
export declare function registerSonareRealtimeVoiceChangerWorkletProcessor(name?: string): void;
