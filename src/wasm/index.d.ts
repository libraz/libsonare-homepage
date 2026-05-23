/**
 * Pitch class enum (C=0, C#=1, ..., B=11)
 */
declare const PitchClass: {
    readonly C: 0;
    readonly Cs: 1;
    readonly D: 2;
    readonly Ds: 3;
    readonly E: 4;
    readonly F: 5;
    readonly Fs: 6;
    readonly G: 7;
    readonly Gs: 8;
    readonly A: 9;
    readonly As: 10;
    readonly B: 11;
};
type PitchClass = (typeof PitchClass)[keyof typeof PitchClass];
/**
 * Musical mode
 */
declare const Mode: {
    readonly Major: 0;
    readonly Minor: 1;
};
type Mode = (typeof Mode)[keyof typeof Mode];
/**
 * Chord quality
 */
declare const ChordQuality: {
    readonly Major: 0;
    readonly Minor: 1;
    readonly Diminished: 2;
    readonly Augmented: 3;
    readonly Dominant7: 4;
    readonly Major7: 5;
    readonly Minor7: 6;
    readonly Sus2: 7;
    readonly Sus4: 8;
};
type ChordQuality = (typeof ChordQuality)[keyof typeof ChordQuality];
/**
 * Section type
 */
declare const SectionType: {
    readonly Intro: 0;
    readonly Verse: 1;
    readonly PreChorus: 2;
    readonly Chorus: 3;
    readonly Bridge: 4;
    readonly Instrumental: 5;
    readonly Outro: 6;
};
type SectionType = (typeof SectionType)[keyof typeof SectionType];
/**
 * Detected musical key
 */
interface Key {
    root: PitchClass;
    mode: Mode;
    confidence: number;
    name: string;
    shortName: string;
}
/**
 * Detected beat
 */
interface Beat {
    time: number;
    strength: number;
}
/**
 * Detected chord
 */
interface Chord {
    root: PitchClass;
    quality: ChordQuality;
    start: number;
    end: number;
    confidence: number;
    name: string;
}
/**
 * Detected section
 */
interface Section {
    type: SectionType;
    start: number;
    end: number;
    energyLevel: number;
    confidence: number;
    name: string;
}
/**
 * Timbre characteristics
 */
interface Timbre {
    brightness: number;
    warmth: number;
    density: number;
    roughness: number;
    complexity: number;
}
/**
 * Dynamics characteristics
 */
interface Dynamics {
    dynamicRangeDb: number;
    loudnessRangeDb: number;
    crestFactor: number;
    isCompressed: boolean;
}
/**
 * Time signature
 */
interface TimeSignature {
    numerator: number;
    denominator: number;
    confidence: number;
}
/**
 * Rhythm features
 */
interface RhythmFeatures {
    syncopation: number;
    grooveType: string;
    patternRegularity: number;
}
/**
 * Complete analysis result
 */
interface AnalysisResult {
    bpm: number;
    bpmConfidence: number;
    key: Key;
    timeSignature: TimeSignature;
    beatTimes: Float32Array;
    beats: Beat[];
    chords: Chord[];
    sections: Section[];
    timbre: Timbre;
    dynamics: Dynamics;
    rhythm: RhythmFeatures;
    form: string;
}
/**
 * HPSS (Harmonic-Percussive Source Separation) result
 */
interface HpssResult {
    harmonic: Float32Array;
    percussive: Float32Array;
    sampleRate: number;
}
/**
 * Mastering loudness/true-peak processing result
 */
interface MasteringResult {
    samples: Float32Array;
    sampleRate: number;
    inputLufs: number;
    outputLufs: number;
    appliedGainDb: number;
    latencySamples?: number;
}
type MasteringProcessorParams = Record<string, number | boolean>;
interface MasteringChainConfig {
    repair?: {
        denoise?: boolean;
        nFft?: number;
        hopLength?: number;
        ddAlpha?: number;
        gainFloor?: number;
        declick?: {
            threshold?: number;
            neighborRatio?: number;
            maxClickSamples?: number;
            lpcOrder?: number;
            residualRatio?: number;
        };
        dereverb?: {
            threshold?: number;
            attenuation?: number;
            nFft?: number;
            hopLength?: number;
            t60Sec?: number;
            lateDelayMs?: number;
            overSubtraction?: number;
            spectralFloor?: number;
            wpeEnabled?: boolean;
            wpeIterations?: number;
            wpeTaps?: number;
            wpeStrength?: number;
        };
    };
    eq?: {
        tiltDb?: number;
        pivotHz?: number;
    };
    dynamics?: {
        compressor?: {
            thresholdDb?: number;
            ratio?: number;
            attackMs?: number;
            releaseMs?: number;
            kneeDb?: number;
            makeupGainDb?: number;
            autoMakeup?: boolean;
        };
        deesser?: {
            frequencyHz?: number;
            thresholdDb?: number;
            ratio?: number;
            attackMs?: number;
            releaseMs?: number;
            rangeDb?: number;
        };
        transientShaper?: {
            attackGainDb?: number;
            sustainGainDb?: number;
            fastAttackMs?: number;
            fastReleaseMs?: number;
            slowAttackMs?: number;
            slowReleaseMs?: number;
            sensitivity?: number;
            maxGainDb?: number;
            gainSmoothingMs?: number;
            lookaheadMs?: number;
        };
        multibandComp?: {
            lowCutoffHz?: number;
            highCutoffHz?: number;
            lowThresholdDb?: number;
            lowRatio?: number;
            lowAttackMs?: number;
            lowReleaseMs?: number;
            midThresholdDb?: number;
            midRatio?: number;
            midAttackMs?: number;
            midReleaseMs?: number;
            highThresholdDb?: number;
            highRatio?: number;
            highAttackMs?: number;
            highReleaseMs?: number;
        };
    };
    saturation?: {
        tape?: {
            driveDb?: number;
            saturation?: number;
            hysteresis?: number;
            outputGainDb?: number;
            speedIps?: number;
            headBumpDb?: number;
            bias?: number;
            gapLoss?: number;
        };
        exciter?: {
            frequencyHz?: number;
            driveDb?: number;
            amount?: number;
            q?: number;
            evenOddMix?: number;
        };
    };
    spectral?: {
        airBand?: {
            amount?: number;
            shelfFrequencyHz?: number;
            dynamicThresholdDb?: number;
            dynamicRangeDb?: number;
        };
    };
    stereo?: {
        imager?: {
            width?: number;
            outputGainDb?: number;
            decorrelationAmount?: number;
            preserveEnergy?: boolean;
        };
        monoMaker?: {
            amount?: number;
        };
    };
    maximizer?: {
        truePeakLimiter?: {
            ceilingDb?: number;
            lookaheadMs?: number;
            releaseMs?: number;
            oversampleFactor?: number;
            applyGainAtInputRate?: boolean;
        };
    };
    loudness?: {
        targetLufs?: number;
        ceilingDb?: number;
        truePeakOversample?: number;
    };
}
interface MasteringChainResult extends MasteringResult {
    stages: string[];
}
interface MasteringStereoChainResult {
    left: Float32Array;
    right: Float32Array;
    sampleRate: number;
    inputLufs: number;
    outputLufs: number;
    appliedGainDb: number;
    stages: string[];
    latencySamples?: number;
}
interface MasteringStereoResult {
    left: Float32Array;
    right: Float32Array;
    sampleRate: number;
    inputLufs: number;
    outputLufs: number;
    appliedGainDb: number;
    latencySamples: number;
}
/**
 * STFT (Short-Time Fourier Transform) result
 */
interface StftResult {
    nBins: number;
    nFrames: number;
    nFft: number;
    hopLength: number;
    sampleRate: number;
    magnitude: Float32Array;
    power: Float32Array;
}
/**
 * Mel spectrogram result
 */
interface MelSpectrogramResult {
    nMels: number;
    nFrames: number;
    sampleRate: number;
    hopLength: number;
    power: Float32Array;
    db: Float32Array;
}
/**
 * MFCC result
 */
interface MfccResult {
    nMfcc: number;
    nFrames: number;
    coefficients: Float32Array;
}
/**
 * Chroma features result
 */
interface ChromaResult {
    nChroma: number;
    nFrames: number;
    sampleRate: number;
    hopLength: number;
    features: Float32Array;
    meanEnergy: number[];
}
/**
 * Pitch detection result
 */
interface PitchResult {
    f0: Float32Array;
    voicedProb: Float32Array;
    voicedFlag: boolean[];
    nFrames: number;
    medianF0: number;
    meanF0: number;
}

/**
 * A detected chord change in the progression
 */
interface ChordChange {
    root: PitchClass;
    quality: ChordQuality;
    startTime: number;
    confidence: number;
}
/**
 * A chord detected at bar boundary (beat-synchronized)
 */
interface BarChord {
    barIndex: number;
    root: PitchClass;
    quality: ChordQuality;
    startTime: number;
    confidence: number;
}
/**
 * Pattern score for known chord progressions
 */
interface PatternScore {
    name: string;
    score: number;
}
/**
 * Progressive estimation results for BPM, Key, and Chord
 */
interface ProgressiveEstimate {
    bpm: number;
    bpmConfidence: number;
    bpmCandidateCount: number;
    key: PitchClass;
    keyMinor: boolean;
    keyConfidence: number;
    chordRoot: PitchClass;
    chordQuality: ChordQuality;
    chordConfidence: number;
    chordProgression: ChordChange[];
    barChordProgression: BarChord[];
    currentBar: number;
    barDuration: number;
    votedPattern: BarChord[];
    patternLength: number;
    detectedPatternName: string;
    detectedPatternScore: number;
    allPatternScores: PatternScore[];
    accumulatedSeconds: number;
    usedFrames: number;
    updated: boolean;
}
/**
 * Statistics and current state of the analyzer
 */
interface AnalyzerStats {
    totalFrames: number;
    totalSamples: number;
    durationSeconds: number;
    estimate: ProgressiveEstimate;
}
/**
 * Frame buffer with analysis results
 */
interface FrameBuffer {
    nFrames: number;
    timestamps: Float32Array;
    mel: Float32Array;
    chroma: Float32Array;
    onsetStrength: Float32Array;
    rmsEnergy: Float32Array;
    spectralCentroid: Float32Array;
    spectralFlatness: Float32Array;
    chordRoot: Int32Array;
    chordQuality: Int32Array;
    chordConfidence: Float32Array;
}
/**
 * Configuration for StreamAnalyzer
 */
interface StreamConfig {
    sampleRate: number;
    nFft?: number;
    hopLength?: number;
    nMels?: number;
    computeMel?: boolean;
    computeChroma?: boolean;
    computeOnset?: boolean;
    emitEveryNFrames?: number;
}

type ProgressCallback = (progress: number, stage: string) => void;
interface WasmTrimResult {
    audio: Float32Array;
    startSample: number;
    endSample: number;
}
interface WasmFrameResult {
    nFrames: number;
    frames: Float32Array;
}
interface WasmTempogramResult {
    nFrames: number;
    winLength: number;
    data: Float32Array;
}

/**
 * sonare - Audio Analysis Library
 *
 * @example
 * ```typescript
 * import { init, detectBpm, detectKey, analyze } from '@libraz/sonare';
 *
 * await init();
 *
 * // Detect BPM from audio samples
 * const bpm = detectBpm(samples, sampleRate);
 *
 * // Detect musical key
 * const key = detectKey(samples, sampleRate);
 *
 * // Full analysis
 * const result = analyze(samples, sampleRate);
 * ```
 */

/**
 * Initialize the WASM module.
 * Must be called before using any analysis functions.
 *
 * @param options - Optional module configuration
 * @returns Promise that resolves when initialization is complete
 */
declare function init(options?: {
    locateFile?: (path: string, prefix: string) => string;
}): Promise<void>;
/**
 * Check if the module is initialized.
 */
declare function isInitialized(): boolean;
/**
 * Get the library version.
 */
declare function version(): string;
/**
 * Detect BPM from audio samples.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz
 * @returns Detected BPM
 */
declare function detectBpm(samples: Float32Array, sampleRate: number): number;
/**
 * Detect musical key from audio samples.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz
 * @returns Detected key
 */
declare function detectKey(samples: Float32Array, sampleRate: number): Key;
/**
 * Detect onset times from audio samples.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz
 * @returns Array of onset times in seconds
 */
declare function detectOnsets(samples: Float32Array, sampleRate: number): Float32Array;
/**
 * Detect beat times from audio samples.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz
 * @returns Array of beat times in seconds
 */
declare function detectBeats(samples: Float32Array, sampleRate: number): Float32Array;
/**
 * Perform complete music analysis.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz
 * @returns Complete analysis result
 */
declare function analyze(samples: Float32Array, sampleRate: number): AnalysisResult;
/**
 * Perform complete music analysis with progress reporting.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz
 * @param onProgress - Progress callback (progress: 0-1, stage: string)
 * @returns Complete analysis result
 */
declare function analyzeWithProgress(samples: Float32Array, sampleRate: number, onProgress: ProgressCallback): AnalysisResult;
/**
 * Perform Harmonic-Percussive Source Separation (HPSS).
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz
 * @param kernelHarmonic - Horizontal median filter size for harmonic (default: 31)
 * @param kernelPercussive - Vertical median filter size for percussive (default: 31)
 * @returns Separated harmonic and percussive components
 */
declare function hpss(samples: Float32Array, sampleRate: number, kernelHarmonic?: number, kernelPercussive?: number): HpssResult;
/**
 * Extract harmonic component from audio.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz
 * @returns Harmonic component
 */
declare function harmonic(samples: Float32Array, sampleRate: number): Float32Array;
/**
 * Extract percussive component from audio.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz
 * @returns Percussive component
 */
declare function percussive(samples: Float32Array, sampleRate: number): Float32Array;
/**
 * Time-stretch audio without changing pitch.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz
 * @param rate - Time stretch rate (0.5 = double duration, 2.0 = half duration)
 * @returns Time-stretched audio
 */
declare function timeStretch(samples: Float32Array, sampleRate: number, rate: number): Float32Array;
/**
 * Pitch-shift audio without changing duration.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz
 * @param semitones - Pitch shift in semitones (+12 = one octave up, -12 = one octave down)
 * @returns Pitch-shifted audio
 */
declare function pitchShift(samples: Float32Array, sampleRate: number, semitones: number): Float32Array;
/**
 * Normalize audio to target peak level.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz
 * @param targetDb - Target peak level in dB (default: 0 dB = full scale)
 * @returns Normalized audio
 */
declare function normalize(samples: Float32Array, sampleRate: number, targetDb?: number): Float32Array;
/**
 * Apply mastering loudness normalization with a true-peak ceiling.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz
 * @param targetLufs - Target integrated LUFS (default: -14)
 * @param ceilingDb - True/sample peak ceiling in dBFS (default: -1)
 * @param truePeakOversample - Oversampling factor used for peak estimation
 * @returns Processed audio and loudness metadata
 */
declare function mastering(samples: Float32Array, sampleRate: number, targetLufs?: number, ceilingDb?: number, truePeakOversample?: number): MasteringResult;
declare function masteringProcessorNames(): string[];
declare function masteringPairProcessorNames(): string[];
declare function masteringPairAnalysisNames(): string[];
declare function masteringStereoAnalysisNames(): string[];
declare function masteringProcess(processorName: string, samples: Float32Array, sampleRate: number, params?: MasteringProcessorParams): MasteringResult;
declare function masteringProcessStereo(processorName: string, left: Float32Array, right: Float32Array, sampleRate: number, params?: MasteringProcessorParams): MasteringStereoResult;
declare function masteringPairProcess(processorName: string, source: Float32Array, reference: Float32Array, sampleRate: number, params?: MasteringProcessorParams): MasteringResult;
declare function masteringPairAnalyze(analysisName: string, source: Float32Array, reference: Float32Array, sampleRate: number, params?: MasteringProcessorParams): string;
declare function masteringStereoAnalyze(analysisName: string, left: Float32Array, right: Float32Array, sampleRate: number, params?: MasteringProcessorParams): string;
/**
 * Apply a configurable mastering chain in WASM.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz
 * @param config - Chain stage configuration
 * @returns Processed audio, loudness metadata, and applied stage names
 */
declare function masteringChain(samples: Float32Array, sampleRate: number, config: MasteringChainConfig): MasteringChainResult;
/**
 * Apply a configurable stereo mastering chain in WASM.
 *
 * @param left - Left channel samples
 * @param right - Right channel samples
 * @param sampleRate - Sample rate in Hz
 * @param config - Chain stage configuration
 * @returns Processed stereo audio, loudness metadata, and applied stage names
 */
declare function masteringChainStereo(left: Float32Array, right: Float32Array, sampleRate: number, config: MasteringChainConfig): MasteringStereoChainResult;
/**
 * Apply a configurable mastering chain in WASM with progress reporting.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz
 * @param config - Chain stage configuration
 * @param onProgress - Progress callback (progress: 0-1, stage: string)
 * @returns Processed audio, loudness metadata, and applied stage names
 */
declare function masteringChainWithProgress(samples: Float32Array, sampleRate: number, config: MasteringChainConfig, onProgress: ProgressCallback): MasteringChainResult;
/**
 * Apply a configurable stereo mastering chain in WASM with progress reporting.
 *
 * @param left - Left channel samples
 * @param right - Right channel samples
 * @param sampleRate - Sample rate in Hz
 * @param config - Chain stage configuration
 * @param onProgress - Progress callback (progress: 0-1, stage: string)
 * @returns Processed stereo audio, loudness metadata, and applied stage names
 */
declare function masteringChainStereoWithProgress(left: Float32Array, right: Float32Array, sampleRate: number, config: MasteringChainConfig, onProgress: ProgressCallback): MasteringStereoChainResult;
/**
 * List built-in mastering preset identifiers.
 *
 * @returns Preset names in display order (e.g. "pop", "edm", "aiMusic")
 */
declare function masteringPresetNames(): string[];
/**
 * Apply a named mastering preset chain to mono audio.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz
 * @param presetName - Preset identifier from {@link masteringPresetNames}
 * @param overrides - Optional flat overrides (dot-notation, e.g. `'loudness.targetLufs'`) applied on top of the preset. Pass `null` for preset defaults.
 * @returns Processed audio, loudness metadata, and applied stage names
 */
declare function masterAudio(samples: Float32Array, sampleRate: number, presetName: string, overrides?: Record<string, number | boolean> | null): MasteringChainResult;
/**
 * Apply a named mastering preset chain to stereo audio.
 *
 * @param left - Left channel samples
 * @param right - Right channel samples
 * @param sampleRate - Sample rate in Hz
 * @param presetName - Preset identifier from {@link masteringPresetNames}
 * @param overrides - Optional flat overrides (dot-notation, e.g. `'loudness.targetLufs'`) applied on top of the preset. Pass `null` for preset defaults.
 * @returns Processed stereo audio, loudness metadata, and applied stage names
 */
declare function masterAudioStereo(left: Float32Array, right: Float32Array, sampleRate: number, presetName: string, overrides?: Record<string, number | boolean> | null): MasteringStereoChainResult;
/**
 * Block-by-block streaming variant of {@link masteringChain}.
 *
 * Maintains processor state across {@link processMono}/{@link processStereo}
 * calls. Only ProcessorBase-backed stages are supported. Configurations that
 * enable `repair.denoise` or `loudness` throw at construction.
 *
 * Call {@link delete} (or use a `try/finally`) to release the underlying WASM
 * object — the embind handle is not garbage-collected automatically.
 *
 * @example
 * ```typescript
 * const chain = new StreamingMasteringChain({ eq: { tiltDb: 1.0 } });
 * try {
 *   chain.prepare(44100, 512, 1);
 *   const out = chain.processMono(blockSamples);
 * } finally {
 *   chain.delete();
 * }
 * ```
 */
declare class StreamingMasteringChain {
    private chain;
    constructor(config: MasteringChainConfig);
    /**
     * Initialize processors for the given sample rate and block layout.
     *
     * @param sampleRate - Sample rate in Hz
     * @param maxBlockSize - Maximum block size per process call
     * @param numChannels - 1 (mono) or 2 (stereo)
     */
    prepare(sampleRate: number, maxBlockSize: number, numChannels: number): void;
    /**
     * Process one mono block, returning the processed samples (same length).
     */
    processMono(samples: Float32Array): Float32Array;
    /**
     * Process one stereo block, returning the processed channels.
     */
    processStereo(left: Float32Array, right: Float32Array): {
        left: Float32Array;
        right: Float32Array;
    };
    /** Reset all processor state without rebuilding. */
    reset(): void;
    /** Total reported latency in samples across all active processors. */
    latencySamples(): number;
    /** Ordered stage names that will run (e.g. `"eq.tilt"`). */
    stageNames(): string[];
    /** Release the underlying WASM object. Safe to call only once. */
    delete(): void;
}
/**
 * Trim silence from beginning and end of audio.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz
 * @param thresholdDb - Silence threshold in dB (default: -60 dB)
 * @returns Trimmed audio
 */
declare function trim(samples: Float32Array, sampleRate: number, thresholdDb?: number): Float32Array;
/**
 * Compute Short-Time Fourier Transform (STFT).
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz
 * @param nFft - FFT size (default: 2048)
 * @param hopLength - Hop length (default: 512)
 * @returns STFT result with magnitude and power spectrograms
 */
declare function stft(samples: Float32Array, sampleRate: number, nFft?: number, hopLength?: number): StftResult;
/**
 * Compute STFT and return magnitude in decibels.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz
 * @param nFft - FFT size (default: 2048)
 * @param hopLength - Hop length (default: 512)
 * @returns STFT result with dB values
 */
declare function stftDb(samples: Float32Array, sampleRate: number, nFft?: number, hopLength?: number): {
    nBins: number;
    nFrames: number;
    db: Float32Array;
};
/**
 * Compute Mel spectrogram.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz
 * @param nFft - FFT size (default: 2048)
 * @param hopLength - Hop length (default: 512)
 * @param nMels - Number of Mel bands (default: 128)
 * @returns Mel spectrogram result
 */
declare function melSpectrogram(samples: Float32Array, sampleRate: number, nFft?: number, hopLength?: number, nMels?: number): MelSpectrogramResult;
/**
 * Compute MFCC (Mel-Frequency Cepstral Coefficients).
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz
 * @param nFft - FFT size (default: 2048)
 * @param hopLength - Hop length (default: 512)
 * @param nMels - Number of Mel bands (default: 128)
 * @param nMfcc - Number of MFCC coefficients (default: 13)
 * @returns MFCC result
 */
declare function mfcc(samples: Float32Array, sampleRate: number, nFft?: number, hopLength?: number, nMels?: number, nMfcc?: number): MfccResult;
/**
 * Compute chromagram (pitch class distribution).
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz
 * @param nFft - FFT size (default: 2048)
 * @param hopLength - Hop length (default: 512)
 * @returns Chroma features result
 */
declare function chroma(samples: Float32Array, sampleRate: number, nFft?: number, hopLength?: number): ChromaResult;
/**
 * Compute spectral centroid (center of mass of spectrum).
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz
 * @param nFft - FFT size (default: 2048)
 * @param hopLength - Hop length (default: 512)
 * @returns Spectral centroid in Hz for each frame
 */
declare function spectralCentroid(samples: Float32Array, sampleRate: number, nFft?: number, hopLength?: number): Float32Array;
/**
 * Compute spectral bandwidth.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz
 * @param nFft - FFT size (default: 2048)
 * @param hopLength - Hop length (default: 512)
 * @returns Spectral bandwidth in Hz for each frame
 */
declare function spectralBandwidth(samples: Float32Array, sampleRate: number, nFft?: number, hopLength?: number): Float32Array;
/**
 * Compute spectral rolloff frequency.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz
 * @param nFft - FFT size (default: 2048)
 * @param hopLength - Hop length (default: 512)
 * @param rollPercent - Percentage threshold (default: 0.85)
 * @returns Rolloff frequency in Hz for each frame
 */
declare function spectralRolloff(samples: Float32Array, sampleRate: number, nFft?: number, hopLength?: number, rollPercent?: number): Float32Array;
/**
 * Compute spectral flatness.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz
 * @param nFft - FFT size (default: 2048)
 * @param hopLength - Hop length (default: 512)
 * @returns Spectral flatness for each frame (0 = tonal, 1 = noise-like)
 */
declare function spectralFlatness(samples: Float32Array, sampleRate: number, nFft?: number, hopLength?: number): Float32Array;
/**
 * Compute zero crossing rate.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz
 * @param frameLength - Frame length (default: 2048)
 * @param hopLength - Hop length (default: 512)
 * @returns Zero crossing rate for each frame
 */
declare function zeroCrossingRate(samples: Float32Array, sampleRate: number, frameLength?: number, hopLength?: number): Float32Array;
/**
 * Compute RMS energy.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz
 * @param frameLength - Frame length (default: 2048)
 * @param hopLength - Hop length (default: 512)
 * @returns RMS energy for each frame
 */
declare function rmsEnergy(samples: Float32Array, sampleRate: number, frameLength?: number, hopLength?: number): Float32Array;
/**
 * Detect pitch using YIN algorithm.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz
 * @param frameLength - Frame length (default: 2048)
 * @param hopLength - Hop length (default: 512)
 * @param fmin - Minimum frequency in Hz (default: 65)
 * @param fmax - Maximum frequency in Hz (default: 2093)
 * @param threshold - YIN threshold (default: 0.3)
 * @returns Pitch detection result
 */
declare function pitchYin(samples: Float32Array, sampleRate: number, frameLength?: number, hopLength?: number, fmin?: number, fmax?: number, threshold?: number): PitchResult;
/**
 * Detect pitch using pYIN algorithm (probabilistic YIN with HMM smoothing).
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz
 * @param frameLength - Frame length (default: 2048)
 * @param hopLength - Hop length (default: 512)
 * @param fmin - Minimum frequency in Hz (default: 65)
 * @param fmax - Maximum frequency in Hz (default: 2093)
 * @param threshold - YIN threshold (default: 0.3)
 * @returns Pitch detection result
 */
declare function pitchPyin(samples: Float32Array, sampleRate: number, frameLength?: number, hopLength?: number, fmin?: number, fmax?: number, threshold?: number): PitchResult;
/**
 * Convert frequency in Hz to Mel scale.
 *
 * @param hz - Frequency in Hz
 * @returns Mel frequency
 */
declare function hzToMel(hz: number): number;
/**
 * Convert Mel scale to frequency in Hz.
 *
 * @param mel - Mel frequency
 * @returns Frequency in Hz
 */
declare function melToHz(mel: number): number;
/**
 * Convert frequency in Hz to MIDI note number.
 *
 * @param hz - Frequency in Hz
 * @returns MIDI note number (A4 = 440 Hz = 69)
 */
declare function hzToMidi(hz: number): number;
/**
 * Convert MIDI note number to frequency in Hz.
 *
 * @param midi - MIDI note number
 * @returns Frequency in Hz
 */
declare function midiToHz(midi: number): number;
/**
 * Convert frequency in Hz to note name.
 *
 * @param hz - Frequency in Hz
 * @returns Note name (e.g., "A4", "C#5")
 */
declare function hzToNote(hz: number): string;
/**
 * Convert note name to frequency in Hz.
 *
 * @param note - Note name (e.g., "A4", "C#5")
 * @returns Frequency in Hz
 */
declare function noteToHz(note: string): number;
/**
 * Convert frame index to time in seconds.
 *
 * @param frames - Frame index
 * @param sr - Sample rate in Hz
 * @param hopLength - Hop length in samples
 * @returns Time in seconds
 */
declare function framesToTime(frames: number, sr: number, hopLength: number): number;
/**
 * Convert time in seconds to frame index.
 *
 * @param time - Time in seconds
 * @param sr - Sample rate in Hz
 * @param hopLength - Hop length in samples
 * @returns Frame index
 */
declare function timeToFrames(time: number, sr: number, hopLength: number): number;
declare function framesToSamples(frames: number, hopLength?: number, nFft?: number): number;
declare function samplesToFrames(samples: number, hopLength?: number, nFft?: number): number;
declare function powerToDb(values: Float32Array, ref?: number, amin?: number, topDb?: number): Float32Array;
declare function amplitudeToDb(values: Float32Array, ref?: number, amin?: number, topDb?: number): Float32Array;
declare function dbToPower(values: Float32Array, ref?: number): Float32Array;
declare function dbToAmplitude(values: Float32Array, ref?: number): Float32Array;
declare function preemphasis(samples: Float32Array, coef?: number, zi?: number): Float32Array;
declare function deemphasis(samples: Float32Array, coef?: number, zi?: number): Float32Array;
declare function trimSilence(samples: Float32Array, topDb?: number, frameLength?: number, hopLength?: number): WasmTrimResult;
declare function splitSilence(samples: Float32Array, topDb?: number, frameLength?: number, hopLength?: number): Int32Array;
declare function frameSignal(samples: Float32Array, frameLength: number, hopLength: number): WasmFrameResult;
declare function padCenter(values: Float32Array, size: number, padValue?: number): Float32Array;
declare function fixLength(values: Float32Array, size: number, padValue?: number): Float32Array;
declare function fixFrames(frames: Int32Array, xMin?: number, xMax?: number, pad?: boolean): Int32Array;
declare function peakPick(values: Float32Array, preMax: number, postMax: number, preAvg: number, postAvg: number, delta: number, wait: number): Int32Array;
declare function vectorNormalize(values: Float32Array, normType?: number, threshold?: number): Float32Array;
declare function pcen(values: Float32Array, nBins: number, nFrames: number, options?: Record<string, number>): Float32Array;
declare function tonnetz(chromagram: Float32Array, nChroma: number, nFrames: number): Float32Array;
declare function tempogram(onsetEnvelope: Float32Array, sampleRate: number, hopLength?: number, winLength?: number): WasmTempogramResult;
declare function plp(onsetEnvelope: Float32Array, sampleRate: number, hopLength?: number, tempoMin?: number, tempoMax?: number, winLength?: number): Float32Array;
/**
 * Resample audio to a different sample rate.
 *
 * @param samples - Audio samples (mono, float32)
 * @param srcSr - Source sample rate in Hz
 * @param targetSr - Target sample rate in Hz
 * @returns Resampled audio
 */
declare function resample(samples: Float32Array, srcSr: number, targetSr: number): Float32Array;
/**
 * Wrapper around audio data that exposes all analysis and feature functions as instance methods.
 *
 * @example
 * ```typescript
 * import { init, Audio } from '@libraz/sonare';
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
declare class Audio {
    private _samples;
    private _sampleRate;
    private constructor();
    /** Create an Audio instance from raw sample data. */
    static fromBuffer(samples: Float32Array, sampleRate: number): Audio;
    /** The raw audio samples. */
    get data(): Float32Array;
    /** Number of samples. */
    get length(): number;
    /** Sample rate in Hz. */
    get sampleRate(): number;
    /** Duration in seconds. */
    get duration(): number;
    detectBpm(): number;
    detectKey(): Key;
    detectOnsets(): Float32Array;
    detectBeats(): Float32Array;
    analyze(): AnalysisResult;
    analyzeWithProgress(onProgress: ProgressCallback): AnalysisResult;
    hpss(kernelHarmonic?: number, kernelPercussive?: number): HpssResult;
    harmonic(): Float32Array;
    percussive(): Float32Array;
    timeStretch(rate: number): Float32Array;
    pitchShift(semitones: number): Float32Array;
    normalize(targetDb?: number): Float32Array;
    mastering(targetLufs?: number, ceilingDb?: number, truePeakOversample?: number): MasteringResult;
    masteringChain(config: MasteringChainConfig): MasteringChainResult;
    masterAudio(presetName: string, overrides?: Record<string, number | boolean> | null): MasteringChainResult;
    masteringProcess(processorName: string, params?: MasteringProcessorParams): MasteringResult;
    trim(thresholdDb?: number): Float32Array;
    stft(nFft?: number, hopLength?: number): StftResult;
    stftDb(nFft?: number, hopLength?: number): {
        nBins: number;
        nFrames: number;
        db: Float32Array;
    };
    melSpectrogram(nFft?: number, hopLength?: number, nMels?: number): MelSpectrogramResult;
    mfcc(nFft?: number, hopLength?: number, nMels?: number, nMfcc?: number): MfccResult;
    chroma(nFft?: number, hopLength?: number): ChromaResult;
    spectralCentroid(nFft?: number, hopLength?: number): Float32Array;
    spectralBandwidth(nFft?: number, hopLength?: number): Float32Array;
    spectralRolloff(nFft?: number, hopLength?: number, rollPercent?: number): Float32Array;
    spectralFlatness(nFft?: number, hopLength?: number): Float32Array;
    zeroCrossingRate(frameLength?: number, hopLength?: number): Float32Array;
    rmsEnergy(frameLength?: number, hopLength?: number): Float32Array;
    pitchYin(frameLength?: number, hopLength?: number, fmin?: number, fmax?: number, threshold?: number): PitchResult;
    pitchPyin(frameLength?: number, hopLength?: number, fmin?: number, fmax?: number, threshold?: number): PitchResult;
    resample(targetSr: number): Float32Array;
}
/**
 * Real-time streaming audio analyzer.
 *
 * @example
 * ```typescript
 * import { init, StreamAnalyzer } from '@libraz/sonare';
 *
 * await init();
 *
 * const analyzer = new StreamAnalyzer({ sampleRate: 44100 });
 *
 * // In audio processing callback
 * analyzer.process(samples);
 *
 * // Get current analysis state
 * const stats = analyzer.stats();
 * console.log('BPM:', stats.estimate.bpm);
 * console.log('Key:', stats.estimate.key);
 * console.log('Chord progression:', stats.estimate.chordProgression);
 * ```
 */
declare class StreamAnalyzer {
    private analyzer;
    /**
     * Create a new StreamAnalyzer.
     *
     * @param config - Configuration options
     */
    constructor(config: StreamConfig);
    /**
     * Process audio samples.
     *
     * @param samples - Audio samples (mono, float32)
     */
    process(samples: Float32Array): void;
    /**
     * Process audio samples with explicit sample offset.
     *
     * @param samples - Audio samples (mono, float32)
     * @param sampleOffset - Cumulative sample count at start of this chunk
     */
    processWithOffset(samples: Float32Array, sampleOffset: number): void;
    /**
     * Get the number of frames available to read.
     */
    availableFrames(): number;
    /**
     * Read processed frames as Structure of Arrays.
     *
     * @param maxFrames - Maximum number of frames to read
     * @returns Frame buffer with analysis results
     */
    readFrames(maxFrames: number): FrameBuffer;
    /**
     * Reset the analyzer state.
     *
     * @param baseSampleOffset - Starting sample offset (default 0)
     */
    reset(baseSampleOffset?: number): void;
    /**
     * Get current statistics and progressive estimates.
     *
     * @returns Analyzer statistics including BPM, key, and chord progression
     */
    stats(): AnalyzerStats;
    /**
     * Get total frames processed.
     */
    frameCount(): number;
    /**
     * Get current time position in seconds.
     */
    currentTime(): number;
    /**
     * Get the sample rate.
     */
    sampleRate(): number;
    /**
     * Set the expected total duration for pattern lock timing.
     *
     * @param durationSeconds - Total duration in seconds
     */
    setExpectedDuration(durationSeconds: number): void;
    /**
     * Set normalization gain for loud/compressed audio.
     *
     * @param gain - Gain factor to apply (e.g., 0.5 for -6dB reduction)
     */
    setNormalizationGain(gain: number): void;
    /**
     * Set tuning reference frequency for non-standard tuning.
     *
     * @param refHz - Reference frequency for A4 (default 440 Hz)
     * @example
     * // If audio is 1 semitone sharp (A4 = 466.16 Hz)
     * analyzer.setTuningRefHz(466.16);
     * // If audio is 1 semitone flat (A4 = 415.30 Hz)
     * analyzer.setTuningRefHz(415.30);
     */
    setTuningRefHz(refHz: number): void;
    /**
     * Release resources. Call when done using the analyzer.
     */
    dispose(): void;
}

export { type AnalysisResult, type AnalyzerStats, Audio, type BarChord, type Beat, type Chord, type ChordChange, ChordQuality, type ChromaResult, type Dynamics, type FrameBuffer, type HpssResult, type Key, type MasteringChainConfig, type MasteringChainResult, type MasteringProcessorParams, type MasteringResult, type MasteringStereoChainResult, type MasteringStereoResult, type MelSpectrogramResult, type MfccResult, Mode, type PatternScore, PitchClass as Pitch, PitchClass, type PitchResult, type ProgressCallback, type ProgressiveEstimate, type RhythmFeatures, type Section, SectionType, type StftResult, StreamAnalyzer, type StreamConfig, StreamingMasteringChain, type Timbre, type TimeSignature, amplitudeToDb, analyze, analyzeWithProgress, chroma, dbToAmplitude, dbToPower, deemphasis, detectBeats, detectBpm, detectKey, detectOnsets, fixFrames, fixLength, frameSignal, framesToSamples, framesToTime, harmonic, hpss, hzToMel, hzToMidi, hzToNote, init, isInitialized, masterAudio, masterAudioStereo, mastering, masteringChain, masteringChainStereo, masteringChainStereoWithProgress, masteringChainWithProgress, masteringPairAnalysisNames, masteringPairAnalyze, masteringPairProcess, masteringPairProcessorNames, masteringPresetNames, masteringProcess, masteringProcessStereo, masteringProcessorNames, masteringStereoAnalysisNames, masteringStereoAnalyze, melSpectrogram, melToHz, mfcc, midiToHz, normalize, noteToHz, padCenter, pcen, peakPick, percussive, pitchPyin, pitchShift, pitchYin, plp, powerToDb, preemphasis, resample, rmsEnergy, samplesToFrames, spectralBandwidth, spectralCentroid, spectralFlatness, spectralRolloff, splitSilence, stft, stftDb, tempogram, timeStretch, timeToFrames, tonnetz, trim, trimSilence, vectorNormalize, version, zeroCrossingRate };
