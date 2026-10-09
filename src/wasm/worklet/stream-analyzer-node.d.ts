import type { AnalyzerStats, FrameBuffer } from '../index.js';
import type { SonareStreamAnalyzerNodeOptions } from './messages.js';
/**
 * Streams analysis of an audio graph branch. The AudioWorklet side only
 * downmixes to mono and forwards chunks; the `StreamAnalyzer` runs on the main
 * thread inside this object, so analysis competes with other main-thread work
 * and lags the audio by about one chunk.
 *
 * The node is a sink with one input and no output: connect a source to
 * {@link SonareStreamAnalyzerNode.node}. Audio lost between the processor and
 * the analyzer (a dropped chunk or a processor restart) resets the analyzer's
 * sample offset instead of splicing the streams together.
 *
 * @example
 * ```ts
 * await init();
 * await context.audioWorklet.addModule(processorUrl); // calls registerSonareStreamAnalyzerWorkletProcessor()
 * const analyzer = await SonareStreamAnalyzerNode.create(context, { config: { nMels: 64 } });
 * source.connect(analyzer.node);
 * const stop = analyzer.onFrames((frames) => draw(frames.mel, frames.nFrames));
 * ```
 */
export declare class SonareStreamAnalyzerNode {
    readonly node: AudioWorkletNode;
    readonly ready: Promise<void>;
    private readonly analyzer;
    private readonly frameListeners;
    private readonly statsListeners;
    private expectedSample;
    private lastFrameCount;
    private resolveReady;
    private rejectReady;
    private destroyed;
    private constructor();
    static create(context: BaseAudioContext, options?: SonareStreamAnalyzerNodeOptions): Promise<SonareStreamAnalyzerNode>;
    /** Subscribes to analysis frames, delivered in the analyzer's `readFrames` format. */
    onFrames(callback: (frames: FrameBuffer) => void): () => void;
    /**
     * Subscribes to analyzer statistics, delivered when the key or tempo estimate
     * was re-estimated (`estimate.updated`).
     */
    onStats(callback: (stats: AnalyzerStats) => void): () => void;
    destroy(): void;
    private consume;
}
