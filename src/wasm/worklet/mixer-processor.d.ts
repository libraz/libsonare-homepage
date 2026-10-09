import type { WorkletInput, WorkletOutput } from './audio_types.js';
import type { SonareWorkletMessage, SonareWorkletProcessorOptions, WorkletTransport } from './messages.js';
/**
 * AudioWorklet-style mixer bridge backed by the package's single `sonare.wasm`.
 *
 * The WASM module must already be initialized via `init()` before constructing
 * this bridge. Each AudioWorklet input is treated as one stereo strip:
 * `inputs[strip][0]` is left and `inputs[strip][1]` is right. Missing channels
 * are replaced with preallocated silence.
 */
export declare class SonareWorkletProcessor {
    readonly sampleRate: number;
    readonly blockSize: number;
    private mixer;
    private realtime;
    private closed;
    private processedFrames;
    private lastMeterFrame;
    private meterIntervalFrames;
    private spectrumIntervalFrames;
    private lastSpectrumFrame;
    private transport?;
    private meterRing?;
    /**
     * Reused meter record, so a publish writes fields instead of allocating one.
     *
     * `targetId` is always the master and the four LUFS / gain-reduction fields
     * are always unavailable here — the mixer worklet does not run the
     * K-weighting filters or the engine's pre-trim input tap — so finite floor
     * values are set once rather than per interval.
     */
    private readonly meterScratch;
    private spectrumRing?;
    private spectrumBands;
    constructor(options: SonareWorkletProcessorOptions, transport?: WorkletTransport);
    process(inputs: WorkletInput, outputs: WorkletOutput): boolean;
    receiveMessage(message: SonareWorkletMessage): void;
    destroy(): void;
    private publishMeter;
    private writeMeterRing;
    private publishSpectrum;
    private computeSpectrum;
    private writeSpectrumRing;
}
export declare function registerSonareWorkletProcessor(name?: string): void;
