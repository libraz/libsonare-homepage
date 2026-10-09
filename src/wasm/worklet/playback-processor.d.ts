import { type WorkletInput, type WorkletOutput } from './audio_types.js';
import type { SonarePlaybackDiagnosticsReplyMessage, SonarePlaybackMessage, SonarePlaybackNodeOptions, SonarePlaybackWorkletProcessorOptions, WorkletPort } from './messages.js';
/**
 * The playback renderer inside an AudioWorklet.
 *
 * `inputs[0].length` is the block's input channel count, so a
 * `MediaElementAudioSourceNode` whose channel count follows the media drives
 * `input.layout: "auto"` directly. A block with no input channels (no active
 * connection: paused, ended, loading) renders silence on the active layout. A
 * block whose channel count the renderer refuses renders silence the same way
 * and counts toward `unsupported_input_blocks`; either way the renderer
 * advances by the block, so the timeline never shifts. Nothing throws on the
 * audio thread.
 *
 * Every buffer is allocated in the constructor: `process()` copies into WASM
 * heap planes and allocates nothing.
 */
export declare class SonarePlaybackWorkletProcessor {
    private static warnedBlockOverflow;
    private readonly renderer;
    private readonly native;
    private readonly port?;
    private readonly maxBlockSize;
    private readonly outputChannels;
    private inputPlanes;
    private outputPlanes;
    private unsupportedInputBlocks;
    private destroyed;
    constructor(options?: SonarePlaybackWorkletProcessorOptions, port?: WorkletPort);
    /**
     * Handles a control-plane message. AudioWorklet port handlers run on the
     * rendering thread between `process()` calls, which is what makes `reset`
     * safe here. A refused message is answered with an `error` message.
     */
    receiveMessage(message: SonarePlaybackMessage): void;
    /** The renderer's diagnostics plus `unsupported_input_blocks`, as a plain object. */
    diagnostics(): SonarePlaybackDiagnosticsReplyMessage['diagnostics'];
    process(inputs: WorkletInput, outputs: WorkletOutput): boolean;
    destroy(): void;
    private acquirePlanes;
    private clampFrames;
}
export declare function registerSonarePlaybackWorkletProcessor(name?: string): void;
/**
 * Creates the AudioWorkletNode for a processor registered with
 * {@link registerSonarePlaybackWorkletProcessor}. The node's input follows its
 * source's channel count without any browser up/down mix
 * (`channelCountMode: "max"`, `channelInterpretation: "discrete"`), and its
 * output carries the target's channel count. The configuration is serialized
 * here, on the main thread.
 *
 * @example
 * ```ts
 * await context.audioWorklet.addModule(playbackWorkletUrl);
 * const hrtf = await (await fetch(hrtfUrl)).arrayBuffer();
 * const node = createSonarePlaybackNode(context, { config: {}, hrtf });
 * context.createMediaElementSource(video).connect(node).connect(context.destination);
 * video.addEventListener('seeking', () => node.port.postMessage({ type: 'reset' }));
 * ```
 */
export declare function createSonarePlaybackNode(context: BaseAudioContext, options?: SonarePlaybackNodeOptions): AudioWorkletNode;
