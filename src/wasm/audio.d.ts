import type { VoiceChangeOptions } from './effects_mastering.js';
import type { ClippingReport, DynamicRangeReport, MeteringDetectClippingOptions, MeteringDynamicRangeOptions, SpectrumOptions, SpectrumReport } from './metering.js';
import type { AnalysisResult, ChordAnalysisResult, ChordDetectionOptions, ChromaResult, DetectKeyOptions, FunctionalChord, HpssResult, KeyCandidate, KeyDetection, KeyDetectionOptions, KeyMode, LufsResult, MasteringChainConfig, MasteringChainResult, MasteringOptions, MasteringPreset, MasteringResult, MasteringSoloProcessorParams, MelSpectrogramResult, MfccResult, Mode, NoteStretchOptions, PitchClass, PitchClassName, PitchResult, SoloProcessor, StftResult } from './public_types.js';
import type { MusicAnalyzeOptions } from './quick_analysis.js';
import type { ProgressCallback, WasmNnlsChromaResult } from './sonare.js';
import type { ValidateOptions } from './validation.js';
type BrowserDecodeContext = Pick<BaseAudioContext, 'decodeAudioData' | 'sampleRate'>;
export interface BrowserAudioDecodeOptions {
    /**
     * AudioContext/OfflineAudioContext used for browser codec fallback. Its
     * `sampleRate` becomes the returned Audio sample rate.
     */
    audioContext?: BrowserDecodeContext;
    /**
     * Factory used when `audioContext` is omitted. `targetSampleRate` is passed
     * through so browsers that honor AudioContextOptions decode directly at that
     * rate.
     */
    createAudioContext?: (options?: AudioContextOptions) => BrowserDecodeContext;
    /**
     * Requested fallback decode rate when this helper creates the context. If the
     * browser ignores it or a context is supplied, no extra resampling is applied.
     */
    targetSampleRate?: number;
}
/** Result of {@link decodeChannels}. */
export interface DecodedChannels {
    /** Sample rate of the decoded audio, in Hz. */
    sampleRate: number;
    /** One plane per source channel, in the source's own channel order. All the same length. */
    channels: Float32Array[];
}
/**
 * Speaker bed layout, mirroring the C enum `SonareChannelLayout`: `0` = mono,
 * `1` = stereo, `2` = 5.1 (L R C LFE Ls Rs), `3` = 7.1 (L R C LFE Ls Rs Lss Rss).
 */
export type ChannelLayout = 0 | 1 | 2 | 3;
/**
 * Decode audio bytes once and keep every source channel.
 *
 * {@link Audio.fromMemory} folds a multi-channel source to mono as it decodes;
 * this returns the planes instead. Same format set, size ceiling and
 * decoded-buffer contract as `Audio.fromMemory`. A 5.1 source arrives as
 * `L R C LFE Ls Rs`.
 *
 * @param bytes - Encoded audio bytes such as WAV or MP3.
 * @throws SonareError with `codeName: 'DecodeFailed'` for an empty decode or a
 *   non-finite sample, `'InvalidFormat'` for a declared rate outside the
 *   supported range, and `'InvalidParameter'` for empty input.
 *
 * @example
 * ```typescript
 * const { sampleRate, channels } = decodeChannels(bytes);
 * const stereo = channels.length > 2 ? downmix(channels, 1) : channels;
 * ```
 */
export declare function decodeChannels(bytes: Uint8Array): DecodedChannels;
/**
 * Downmix channels to a narrower layout with the ITU-R BS.775 rule.
 *
 * Center and surround enter the front pair at -3 dB and the LFE plane is
 * dropped; a stereo, 5.1 or 7.1 source folds to mono through the same matrix
 * the decoders use. The source layout is the one the channel count names
 * (1, 2, 6 or 8). Supported targets narrow the bed (7.1 to 5.1, 5.1 or 7.1 to
 * stereo, anything modelled to mono) or copy it. A channel count outside
 * 1/2/6/8 folds to mono (`0`) as the unweighted mean of its planes, as the
 * decoders do, and has no other target.
 *
 * @param channels - One `Float32Array` per channel, all of the same length.
 * @param targetLayout - `0` mono, `1` stereo, `2` 5.1, `3` 7.1.
 * @throws SonareError with `codeName: 'InvalidParameter'` for an upmix or an
 *   unknown layout.
 * @throws RangeError for no channels, or channels of differing length.
 * @returns One `Float32Array` per channel of the target layout.
 */
export declare function downmix(channels: Float32Array[], targetLayout: ChannelLayout): Float32Array[];
/**
 * {@link decodeChannels} with the same browser codec fallback as
 * {@link Audio.fromMemoryWithBrowserFallback}: formats the native decoder does
 * not carry (AAC, OGG, FLAC) go through `decodeAudioData`, and every channel the
 * browser returns is kept.
 */
export declare function decodeChannelsWithBrowserFallback(bytes: Uint8Array, options?: BrowserAudioDecodeOptions): Promise<DecodedChannels>;
/**
 * Wrapper around audio data that exposes analysis and feature functions as
 * instance methods.
 *
 * Not every module-level function has a method here — `analyzeBpm`,
 * `analyzeRhythm`, `analyzeDynamics`, `analyzeTimbre`, `analyzeImpulseResponse`
 * and `detectAcoustic` are reachable as free functions only, and the Node
 * facade exposes them as methods as well. Where a method does exist on both, it
 * takes the same arguments.
 *
 * @example
 * ```typescript
 * import { init, Audio } from '@libraz/libsonare';
 *
 * await init();
 *
 * const audio = Audio.fromBuffer(samples, 44100);
 * console.log('BPM:', audio.detectBpm());
 * console.log('Key:', audio.detectKey().name);
 *
 * const mel = audio.melSpectrogram();
 * ```
 */
export declare class Audio {
    private _samples;
    private _sampleRate;
    private constructor();
    /**
     * Create an Audio instance from raw sample data.
     *
     * @param samples - Mono float samples.
     * @param sampleRate - Sample rate in Hz (default `48000`, matching the
     *   Node/Python surfaces).
     */
    static fromBuffer(samples: Float32Array, sampleRate?: number): Audio;
    /**
     * Create an Audio instance by decoding audio bytes in memory.
     *
     * @param bytes - Encoded audio bytes such as WAV or MP3.
     */
    static fromMemory(bytes: Uint8Array): Audio;
    /**
     * Decode audio bytes with the native WASM decoder first, then fall back to the
     * browser codec stack (`AudioContext.decodeAudioData`) for formats such as
     * AAC, OGG, and FLAC when available. Browser-decoded multi-channel audio is
     * folded to mono with {@link downmix}, the rule the native decoder applies, so
     * a file folds to the same samples whichever decoder ran.
     */
    static fromMemoryWithBrowserFallback(bytes: Uint8Array, options?: BrowserAudioDecodeOptions): Promise<Audio>;
    /**
     * A copy of the raw audio samples. Mirrors Node's `getData()` contract: the
     * returned array is independent of the Audio's internal buffer, so mutating
     * it (or transferring it to a Worker) does not affect subsequent facade
     * calls, which all read the internal snapshot directly.
     */
    get data(): Float32Array;
    /** Number of samples. */
    get length(): number;
    /** Sample rate in Hz. */
    get sampleRate(): number;
    /** Duration in seconds. */
    get duration(): number;
    detectBpm(): number;
    detectKey(options?: DetectKeyOptions): KeyDetection;
    detectKeyCandidates(options?: KeyDetectionOptions): KeyCandidate[];
    detectOnsets(): Float32Array;
    detectBeats(): Float32Array;
    detectDownbeats(): Float32Array;
    detectChords(options?: ChordDetectionOptions): ChordAnalysisResult;
    chordFunctionalAnalysis(keyRoot: PitchClass | PitchClassName, keyMode: Mode | KeyMode, options?: ChordDetectionOptions): FunctionalChord[];
    /**
     * Full music analysis of the held buffer.
     *
     * Takes the same option bag as the module-level {@link analyze} and as the
     * Node facade's `Audio.analyze`; this method used to drop it, so the same
     * call was tunable on one binding and fixed at the defaults on the other.
     */
    analyze(options?: MusicAnalyzeOptions): AnalysisResult;
    analyzeWithProgress(onProgress: ProgressCallback): AnalysisResult;
    hpss(kernelHarmonic?: number, kernelPercussive?: number): HpssResult;
    harmonic(): Float32Array;
    percussive(): Float32Array;
    timeStretch(rate: number): Float32Array;
    pitchShift(semitones: number): Float32Array;
    pitchCorrectToMidi(currentMidi?: number, targetMidi?: number): Float32Array;
    noteStretch(options?: NoteStretchOptions): Float32Array;
    noteMove(options?: import('./public_types.js').NoteMoveOptions): Float32Array;
    voiceChange(options?: VoiceChangeOptions): Float32Array;
    normalize(targetDb?: number): Float32Array;
    mastering(options?: MasteringOptions): MasteringResult;
    masteringChain(config?: MasteringChainConfig, onProgress?: ProgressCallback): MasteringChainResult;
    masterAudio(presetName?: MasteringPreset, overrides?: MasteringChainConfig | null, onProgress?: ProgressCallback): MasteringChainResult;
    masteringProcess(processorName: SoloProcessor, params?: MasteringSoloProcessorParams): MasteringResult;
    trim(thresholdDb?: number): Float32Array;
    stft(nFft?: number, hopLength?: number): StftResult;
    stftDb(nFft?: number, hopLength?: number): {
        nBins: number;
        nFrames: number;
        db: Float32Array;
    };
    melSpectrogram(nFft?: number, hopLength?: number, nMels?: number, fmin?: number, fmax?: number, htk?: boolean): MelSpectrogramResult;
    mfcc(nFft?: number, hopLength?: number, nMels?: number, nMfcc?: number, fmin?: number, fmax?: number, htk?: boolean): MfccResult;
    chroma(nFft?: number, hopLength?: number): ChromaResult;
    nnlsChroma(): WasmNnlsChromaResult;
    onsetEnvelope(nFft?: number, hopLength?: number, nMels?: number): Float32Array;
    lufs(): LufsResult;
    momentaryLufs(): Float32Array;
    shortTermLufs(): Float32Array;
    spectralCentroid(nFft?: number, hopLength?: number): Float32Array;
    spectralBandwidth(nFft?: number, hopLength?: number): Float32Array;
    spectralRolloff(nFft?: number, hopLength?: number, rollPercent?: number): Float32Array;
    spectralFlatness(nFft?: number, hopLength?: number): Float32Array;
    zeroCrossingRate(frameLength?: number, hopLength?: number): Float32Array;
    rmsEnergy(frameLength?: number, hopLength?: number): Float32Array;
    pitchYin(frameLength?: number, hopLength?: number, fmin?: number, fmax?: number, threshold?: number, fillNa?: boolean): PitchResult;
    pitchPyin(frameLength?: number, hopLength?: number, fmin?: number, fmax?: number, threshold?: number, fillNa?: boolean): PitchResult;
    resample(targetSr: number): Float32Array;
    peakDb(): number;
    rmsDb(): number;
    dcOffset(): number;
    crestFactorDb(): number;
    silenceRatio(thresholdDb?: number, frameLength?: number, hopLength?: number): number;
    /**
     * Inter-sample (true) peak in dBFS. `oversampleFactor` must be a power of two
     * in [1, 16]; pass 0 to use the library default (4).
     */
    truePeakDb(oversampleFactor?: number): number;
    detectClipping(options?: MeteringDetectClippingOptions): ClippingReport;
    dynamicRange(options?: MeteringDynamicRangeOptions): DynamicRangeReport;
    spectrum(options?: SpectrumOptions & ValidateOptions): SpectrumReport;
    /**
     * True single-frame magnitude / power / dB spectrum starting at `frameOffset`.
     * See {@link meteringSpectrumFrame} for the frame-validation contract.
     */
    spectrumFrame(frameOffset?: number, options?: SpectrumOptions & ValidateOptions): SpectrumReport;
    ebur128LoudnessRange(): number;
    /** No-op: Audio holds no native handle, so `using` works the same as on the other surfaces. */
    [Symbol.dispose](): void;
}
export {};
