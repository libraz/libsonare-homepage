import type { WorkletInput, WorkletOutput } from './audio_types.js';
import type { SonareStreamAnalyzerMessage, SonareStreamAnalyzerWorkletProcessorOptions, WorkletPort } from './messages.js';
/** Default and minimum mono samples per posted chunk. */
export declare const STREAM_ANALYZER_DEFAULT_CHUNK_FRAMES = 4096;
/** Resolves the `chunkFrames` option shared by the processor and the node. */
export declare function resolveStreamAnalyzerChunkFrames(chunkFrames: number | undefined): number;
/**
 * Audio-thread tap for `SonareStreamAnalyzerNode`: averages the input channels
 * to mono, fills a preallocated chunk and transfers it to the main thread once
 * full. The analyzer itself never runs here.
 *
 * Buffers come from a fixed pool the main thread refills through `recycle`
 * messages. When the pool is empty the chunk being filled is dropped rather than
 * allocated, and the next posted chunk reports the discontinuity.
 */
export declare class SonareStreamAnalyzerWorkletProcessor {
    private readonly port?;
    private readonly chunkFrames;
    private readonly pool;
    private poolCount;
    private current;
    private fill;
    private chunkStart;
    private discontinuity;
    private destroyed;
    private readonly chunkMessage;
    private readonly transferList;
    constructor(options?: SonareStreamAnalyzerWorkletProcessorOptions, port?: WorkletPort | undefined);
    /** Handles a control message; runs between render quanta. */
    receiveMessage(message: SonareStreamAnalyzerMessage): void;
    process(inputs: WorkletInput, _outputs: WorkletOutput): boolean;
    private completeChunk;
    private takeBuffer;
    private recycle;
}
/**
 * Registers {@link SonareStreamAnalyzerWorkletProcessor} under `name`. Call it
 * from an AudioWorklet module; the processor needs no WASM in that realm.
 */
export declare function registerSonareStreamAnalyzerWorkletProcessor(name?: string): void;
