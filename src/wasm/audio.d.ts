import type { VoiceChangeOptions } from './effects_mastering';
import type { ClippingReport, DynamicRangeReport, MeteringDetectClippingOptions, MeteringDynamicRangeOptions, SpectrumOptions, SpectrumReport } from './metering';
import type { AnalysisResult, ChordAnalysisResult, ChordDetectionOptions, ChromaResult, HpssResult, Key, KeyCandidate, KeyDetectionOptions, LufsResult, MasteringChainConfig, MasteringChainResult, MasteringOptions, MasteringPreset, MasteringProcessorParams, MasteringResult, MelSpectrogramResult, MfccResult, Mode, NoteStretchOptions, PitchClass, PitchResult, SoloProcessor, StftResult } from './public_types';
import type { MusicAnalyzeOptions } from './quick_analysis';
import type { ProgressCallback, WasmNnlsChromaResult } from './sonare.js';
import type { ValidateOptions } from './validation';
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
     * mixed down to mono to match the `Audio` wrapper contract.
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
    detectKey(options?: KeyDetectionOptions): Key;
    detectKeyCandidates(options?: KeyDetectionOptions): KeyCandidate[];
    detectOnsets(): Float32Array;
    detectBeats(): Float32Array;
    detectDownbeats(): Float32Array;
    detectChords(options?: ChordDetectionOptions): ChordAnalysisResult;
    chordFunctionalAnalysis(keyRoot: PitchClass, keyMode: Mode, options?: ChordDetectionOptions): string[];
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
    masteringProcess(processorName: SoloProcessor, params?: MasteringProcessorParams): MasteringResult;
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
}
export {};
