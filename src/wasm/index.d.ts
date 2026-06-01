import { ProgressCallback, WasmNnlsChromaResult, WasmDecomposeResult, WasmEngineAutomationPoint, WasmEngineBounceOptions, WasmEngineBounceResult, WasmEngineCaptureStatus, WasmEngineClip, WasmEngineFreezeOptions, WasmEngineFreezeResult, WasmEngineGraphSpec, WasmEngineMarker, WasmEngineMeterTelemetry, WasmEngineMetronomeConfig, WasmEngineParameterInfo, WasmEngineTelemetry, WasmEngineTransportState, WasmHpssWithResidualResult, WasmMatrix2dResult, WasmEngineProcessWithMonitorResult, WasmCyclicTempogramResult, WasmFourierTempogramResult, WasmFrameResult, WasmLufsResult, WasmTempogramResult, WasmTrimResult } from './sonare.js';
export { ProgressCallback } from './sonare.js';

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
    readonly Dorian: 2;
    readonly Phrygian: 3;
    readonly Lydian: 4;
    readonly Mixolydian: 5;
    readonly Locrian: 6;
};
type Mode = (typeof Mode)[keyof typeof Mode];
type TempogramMode = 'autocorrelation' | 'auto' | 'ac' | 'cosine' | 0 | 1;
declare const KeyProfile: {
    readonly KrumhanslSchmuckler: 0;
    readonly Temperley: 1;
    readonly Shaath: 2;
    readonly FaraldoEDMT: 3;
    readonly FaraldoEDMA: 4;
    readonly FaraldoEDMM: 5;
    readonly BellmanBudge: 6;
};
type KeyProfile = (typeof KeyProfile)[keyof typeof KeyProfile];
type KeyProfileName = 'ks' | 'krumhansl' | 'temperley' | 'shaath' | 'keyfinder' | 'faraldo-edmt' | 'edmt' | 'faraldo-edma' | 'edma' | 'faraldo-edmm' | 'edmm' | 'bellman-budge' | 'bellman';
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
    readonly Unknown: 9;
    readonly Add9: 10;
    readonly MinorAdd9: 11;
    readonly Dim7: 12;
    readonly HalfDim7: 13;
    readonly Major9: 14;
    readonly Dominant9: 15;
    readonly Sus2Add4: 16;
};
type ChordQuality = (typeof ChordQuality)[keyof typeof ChordQuality];
type MasteringPreset = 'pop' | 'edm' | 'acoustic' | 'hipHop' | 'aiMusic' | 'speech' | 'streaming' | 'youtube' | 'broadcast' | 'podcast' | 'audiobook' | 'cinema' | 'jpop' | 'ambient' | 'lofi' | 'classical' | 'drumAndBass' | 'techno' | 'metal' | 'trap' | 'rnb' | 'jazz' | 'kpop' | 'trance' | 'gameOst';
interface StreamingPlatform {
    name: string;
    targetLufs: number;
    ceilingDb: number;
}
type SoloProcessor = 'dynamics.brickwallLimiter' | 'dynamics.compressor' | 'dynamics.deesser' | 'dynamics.expander' | 'dynamics.gate' | 'dynamics.limiter' | 'dynamics.parallelComp' | 'dynamics.sidechainRouter' | 'dynamics.duckingProcessor' | 'dynamics.transientShaper' | 'dynamics.upwardCompressor' | 'dynamics.upwardExpander' | 'dynamics.vocalRider' | 'eq.apiStyle' | 'eq.bandPass' | 'eq.cutFilter' | 'eq.dynamic' | 'eq.equalizer' | 'eq.graphic' | 'eq.linearPhase' | 'eq.midSide' | 'eq.minimumPhase' | 'eq.parametric' | 'eq.pultec' | 'eq.shelving' | 'eq.tilt' | 'final.bitDepth' | 'final.dither' | 'final.outputChain' | 'maximizer.adaptiveRelease' | 'maximizer.loudnessOptimize' | 'maximizer.maximizer' | 'maximizer.softKneeMax' | 'maximizer.truePeakLimiter' | 'multiband.compressor' | 'multiband.dynamicEq' | 'multiband.expander' | 'multiband.imager' | 'multiband.limiter' | 'multiband.saturation' | 'repair.declick' | 'repair.declip' | 'repair.decrackle' | 'repair.dehum' | 'repair.denoiseClassical' | 'repair.dereverbClassical' | 'repair.trimSilence' | 'saturation.bitcrusher' | 'saturation.exciter' | 'saturation.hardClipper' | 'saturation.multibandExciter' | 'saturation.softClipper' | 'saturation.tape' | 'saturation.transformer' | 'saturation.tube' | 'saturation.waveshaper' | 'spectral.airBand' | 'spectral.lowEndFocus' | 'spectral.presenceEnhancer' | 'spectral.spectralShaper' | 'stereo.autoPan' | 'stereo.haasEnhancer' | 'stereo.imager' | 'stereo.monoMaker' | 'stereo.phaseAlign' | 'stereo.stereoBalance';
type PairProcessor = 'match.applyMatchEq' | 'match.alignReferenceToSource' | 'match.abSwitch' | 'match.abCrossfade';
type PairAnalysis = 'match.referenceLoudness' | 'match.tonalBalance' | 'match.tonalBalanceLogBands' | 'match.matchEqCurve' | 'match.estimateReferenceDelaySamples';
type StereoAnalysis = 'stereo.monoCompatCheck' | 'stereo.monoCompatCheckLogBands';
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
    readonly Unknown: 7;
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
interface KeyDetectionOptions {
    nFft?: number;
    hopLength?: number;
    useHpss?: boolean;
    loudnessWeighted?: boolean;
    highPassHz?: number;
    modes?: Mode[] | ('major' | 'minor' | 'dorian' | 'phrygian' | 'lydian' | 'mixolydian' | 'locrian')[] | 'major-minor' | 'all' | 'modal';
    profile?: KeyProfile | KeyProfileName;
    genreHint?: 'auto' | 'edm' | 'electronic' | 'dance' | 'pop' | 'classical' | 'jazz' | string;
}
interface KeyCandidate {
    key: Key;
    correlation: number;
}
interface ChordDetectionOptions {
    minDuration?: number;
    smoothingWindow?: number;
    threshold?: number;
    useTriadsOnly?: boolean;
    nFft?: number;
    hopLength?: number;
    useBeatSync?: boolean;
    useHmm?: boolean;
    hmmBeamWidth?: number;
    useKeyContext?: boolean;
    keyRoot?: PitchClass;
    keyMode?: Mode;
    detectInversions?: boolean;
    chromaMethod?: 'stft' | 'nnls';
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
    bass: PitchClass;
    quality: ChordQuality;
    start: number;
    end: number;
    confidence: number;
    name: string;
}
interface ChordAnalysisResult {
    chords: Chord[];
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
 * A single melody contour point (mirrors the C `SonareMelodyPoint`).
 */
interface MelodyPoint {
    /** Frame time in seconds. */
    time: number;
    /** Estimated fundamental frequency in Hz (0 when unvoiced). */
    frequency: number;
    /** Voicing confidence in `[0, 1]`. */
    confidence: number;
}
/**
 * Melody analysis result (mirrors the C `SonareMelodyResult`).
 */
interface MelodyResult {
    points: MelodyPoint[];
    pitchRangeOctaves: number;
    pitchStability: number;
    meanFrequency: number;
    vibratoRate: number;
}
/**
 * Constant-Q / Variable-Q transform magnitude result (mirrors the C
 * `SonareCqtResult`).
 */
interface CqtResult {
    /** Number of frequency bins. */
    nBins: number;
    /** Number of time frames. */
    nFrames: number;
    /** Hop length in samples. */
    hopLength: number;
    /** Sample rate in Hz. */
    sampleRate: number;
    /** Row-major `[nBins x nFrames]` magnitude matrix. */
    magnitude: Float32Array;
    /** Center frequency (Hz) of each of the `nBins` bins. */
    frequencies: Float32Array;
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
 * Room acoustic parameters from an impulse response
 */
interface AcousticResult {
    rt60: number;
    edt: number;
    c50: number;
    c80: number;
    d50: number;
    rt60Bands: Float32Array;
    edtBands: Float32Array;
    c50Bands: Float32Array;
    c80Bands: Float32Array;
    confidence: number;
    isBlind: boolean;
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
type PanMode = 'balance' | 'stereoPan' | 'stereo-pan' | 'dualPan' | 'dual-pan' | number;
interface MixOptions {
    inputTrimDb?: number | number[];
    faderDb?: number | number[];
    pan?: number | number[];
    panMode?: PanMode | PanMode[];
    width?: number | number[];
    muted?: boolean | boolean[];
}
interface MixMeterSnapshot {
    peakDbL: number;
    peakDbR: number;
    rmsDbL: number;
    rmsDbR: number;
    correlation: number;
    monoCompatWidth: number;
    monoCompatPeak: number;
    monoCompatSideRms: number;
    likelyMonoCompatible: boolean;
    momentaryLufs: number;
    shortTermLufs: number;
    integratedLufs: number;
    gainReductionDb: number;
    truePeakDbL: number;
    truePeakDbR: number;
    maxTruePeakDb: number;
    seq: number;
}
interface MixResult {
    left: Float32Array;
    right: Float32Array;
    sampleRate: number;
    meters: MixMeterSnapshot[];
}
/** Mixed stereo master returned by {@link Mixer.processStereo}. */
interface MixerProcessResult {
    left: Float32Array;
    right: Float32Array;
    sampleRate: number;
}
/**
 * Interpolation curve for scheduled automation events
 * (see {@link Mixer.scheduleInsertAutomation}).
 */
type AutomationCurve = 'linear' | 'exponential' | 'hold' | 's-curve';
/**
 * Pan law applied when computing left/right gains from a pan position
 * (see {@link Mixer.setPanLaw}). Maps to the underlying integer code.
 */
type PanLaw = 'const3dB' | 'const4.5dB' | 'const6dB' | 'linear0dB';
/**
 * Meter tap point for reading a strip's meter snapshot
 * (see {@link Mixer.meterTap} and {@link Mixer.stripMeter}).
 */
type MeterTap = 'preFader' | 'postFader';
/** Pre/post-fader send timing (see {@link Mixer.addSend}). */
type SendTiming = 'preFader' | 'postFader';
/** A single goniometer (left/right) sample returned by {@link Mixer.readGoniometerLatest}. */
interface GoniometerPoint {
    left: number;
    right: number;
}
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
            bandpassQ?: number;
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
 * STFT power spectrogram result (from inverse Mel reconstruction)
 */
interface StftPowerResult {
    nBins: number;
    nFrames: number;
    power: Float32Array;
}
/**
 * Mel power spectrogram result (from inverse MFCC reconstruction)
 */
interface MelPowerResult {
    nMels: number;
    nFrames: number;
    power: Float32Array;
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
 * Loudness measurement result (EBU R128 / ITU-R BS.1770)
 */
interface LufsResult {
    integratedLufs: number;
    momentaryLufs: number;
    shortTermLufs: number;
    loudnessRange: number;
}
/**
 * Realtime equalizer spectrum snapshot.
 *
 * Mirrors the C++ `EqualizerSpectrumSnapshot`: `preLeft`/`preRight` and
 * `postLeft`/`postRight` are the pre- and post-EQ spectrum streams (trimmed to
 * their valid count). `bandGainDb` holds per-band applied gain (24 entries),
 * `profileDb` the smoothed magnitude profile (16 entries), `lastAutoGainDb`
 * the latest auto-gain compensation, and `seq` increments each time a new
 * snapshot is published.
 */
interface EqSpectrumSnapshot {
    preLeft: Float32Array;
    preRight: Float32Array;
    postLeft: Float32Array;
    postRight: Float32Array;
    bandGainDb: Float32Array;
    profileDb: Float32Array;
    lastAutoGainDb: number;
    seq: number;
}
/**
 * Equalizer band type (string union mirroring `sonare::mastering::eq::EqBandType`).
 */
type EqBandType = 'Peak' | 'LowShelf' | 'HighShelf' | 'LowPass' | 'HighPass' | 'BandPass' | 'Notch' | 'TiltShelf' | 'FlatTilt';
/** Biquad coefficient design mode. */
type EqCoeffMode = 'Rbj' | 'Vicanek';
/** Stereo placement for an EQ band. */
type EqStereoPlacement = 'Stereo' | 'Left' | 'Right' | 'Mid' | 'Side';
/** Per-band phase behaviour. */
type EqBandPhase = 'Inherit' | 'ZeroLatency' | 'NaturalPhase' | 'LinearPhase';
/**
 * Equalizer band configuration accepted by {@link StreamingEqualizer.setBand}.
 *
 * All fields are optional; omitted values fall back to the C++ band defaults
 * (Peak, 1000 Hz, 0 dB gain, Butterworth Q, disabled).
 */
interface EqBand {
    type?: EqBandType;
    frequencyHz?: number;
    gainDb?: number;
    q?: number;
    enabled?: boolean;
    coeffMode?: EqCoeffMode;
    slopeDbOct?: number;
    placement?: EqStereoPlacement;
    phase?: EqBandPhase;
    soloed?: boolean;
    bypassed?: boolean;
    proportionalQ?: boolean;
    proportionalQStrength?: number;
    dynamic?: boolean;
    thresholdDb?: number;
    autoThreshold?: boolean;
    ratio?: number;
    rangeDb?: number;
    attackMs?: number;
    releaseMs?: number;
    lookaheadMs?: number;
    externalSidechain?: boolean;
    sidechainFreqHz?: number;
    sidechainQ?: number;
}
/** Construction options for {@link StreamingEqualizer}. */
interface StreamingEqualizerConfig {
    sampleRate?: number;
    maxBlockSize?: number;
}
/** Configuration for {@link StreamingRetune}. */
interface StreamingRetuneConfig {
    /** Pitch shift in semitones, clamped by the native processor to +/-24. */
    semitones?: number;
    /** Wet/dry mix, clamped by the native processor to 0..1. */
    mix?: number;
    /** Grain size in samples. Use 0/omit to derive it from the sample rate. */
    grainSize?: number;
}
type VoicePresetId = 'neutral-monitor' | 'bright-idol' | 'soft-whisper' | 'deep-narrator' | 'robot-mascot' | 'dark-villain';
interface RealtimeVoiceChangerPreset {
    schemaVersion: 1;
    id?: string;
    name?: string;
    description?: string;
    macros?: Record<string, number>;
    dsp?: Record<string, unknown>;
}
type RealtimeVoiceChangerConfigInput = VoicePresetId | RealtimeVoiceChangerPreset;
/**
 * Flat (POD) realtime voice-changer configuration. Field names mirror the
 * C ABI `SonareRealtimeVoiceChangerConfig` / Python POD exactly (snake_case),
 * so a config can be round-tripped across bindings without renaming.
 */
interface RealtimeVoiceChangerPodConfig {
    input_gain_db: number;
    output_gain_db: number;
    wet_mix: number;
    retune_semitones: number;
    retune_mix: number;
    retune_grain_size: number;
    formant_factor: number;
    formant_amount: number;
    formant_body: number;
    formant_brightness: number;
    formant_nasal: number;
    eq_highpass_hz: number;
    eq_body_db: number;
    eq_presence_db: number;
    eq_air_db: number;
    gate_threshold_db: number;
    gate_attack_ms: number;
    gate_release_ms: number;
    gate_range_db: number;
    compressor_threshold_db: number;
    compressor_ratio: number;
    compressor_attack_ms: number;
    compressor_release_ms: number;
    compressor_makeup_gain_db: number;
    deesser_frequency_hz: number;
    deesser_threshold_db: number;
    deesser_ratio: number;
    deesser_range_db: number;
    reverb_mix: number;
    reverb_time_ms: number;
    reverb_damping: number;
    reverb_seed: number;
    limiter_ceiling_db: number;
    limiter_release_ms: number;
}
/** Options for {@link StreamingEqualizer.match}. */
interface EqMatchOptions {
    sampleRate?: number;
    maxBands?: number;
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
    chordStartTime: number;
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
interface StreamFramesU8 {
    nFrames: number;
    nMels: number;
    timestamps: Float32Array;
    mel: Uint8Array;
    chroma: Uint8Array;
    onsetStrength: Uint8Array;
    rmsEnergy: Uint8Array;
    spectralCentroid: Uint8Array;
    spectralFlatness: Uint8Array;
}
interface StreamFramesI16 {
    nFrames: number;
    nMels: number;
    timestamps: Float32Array;
    mel: Int16Array;
    chroma: Int16Array;
    onsetStrength: Int16Array;
    rmsEnergy: Int16Array;
    spectralCentroid: Int16Array;
    spectralFlatness: Int16Array;
}
/**
 * Configuration for StreamAnalyzer
 */
interface StreamConfig {
    sampleRate: number;
    nFft?: number;
    hopLength?: number;
    nMels?: number;
    fmin?: number;
    fmax?: number;
    tuningRefHz?: number;
    computeMagnitude?: boolean;
    computeMel?: boolean;
    computeChroma?: boolean;
    computeOnset?: boolean;
    computeSpectral?: boolean;
    emitEveryNFrames?: number;
    magnitudeDownsample?: number;
    keyUpdateIntervalSec?: number;
    bpmUpdateIntervalSec?: number;
    window?: number;
    outputFormat?: number;
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

type EngineClip = WasmEngineClip;
type EngineParameterInfo = WasmEngineParameterInfo;
type EngineAutomationPoint = WasmEngineAutomationPoint;
type EngineMarker = WasmEngineMarker;
type EngineMetronomeConfig = WasmEngineMetronomeConfig;
type EngineGraphSpec = WasmEngineGraphSpec;
type EngineCaptureStatus = WasmEngineCaptureStatus;
type EngineBounceOptions = WasmEngineBounceOptions;
type EngineBounceResult = WasmEngineBounceResult;
type EngineFreezeOptions = WasmEngineFreezeOptions;
type EngineFreezeResult = WasmEngineFreezeResult;
type EngineTelemetry = WasmEngineTelemetry;
type EngineMeterTelemetry = WasmEngineMeterTelemetry;
type EngineTransportState = WasmEngineTransportState;
/** Row-major 2-D matrix as a flat buffer plus its dimensions. */
type Matrix2dResult = WasmMatrix2dResult;
/** NMF factor matrices { w, h } from {@link decompose}. */
type DecomposeResult = WasmDecomposeResult;
/** Harmonic / percussive / residual signals from {@link hpssWithResidual}. */
type HpssWithResidualResult = WasmHpssWithResidualResult;
declare const EXPECTED_ENGINE_ABI_VERSION = 2;
interface EngineCapabilities {
    engineAbiVersion: number;
    expectedEngineAbiVersion: number;
    abiCompatible: boolean;
    sharedArrayBuffer: boolean;
    atomics: boolean;
    audioWorklet: boolean;
    mode: 'sab' | 'postMessage';
}
interface MixerRealtimeBuffer {
    leftInputs: Float32Array[];
    rightInputs: Float32Array[];
    outLeft: Float32Array;
    outRight: Float32Array;
    process: (numSamples?: number) => void;
}
/**
 * Zero-copy realtime buffer pair for {@link RealtimeVoiceChanger} mono
 * processing. The `input` / `output` `Float32Array`s are typed-memory views
 * onto the WASM heap — write samples into `input`, call `process()`, then
 * read from `output`. The views are owned by the {@link RealtimeVoiceChanger}
 * and remain valid until `delete()` is called on it.
 */
interface RealtimeVoiceChangerMonoBuffer {
    input: Float32Array;
    output: Float32Array;
    process: () => void;
}
/**
 * Zero-copy realtime buffer pair for {@link RealtimeVoiceChanger} interleaved
 * multi-channel processing. Layout is L0,R0,L1,R1,... for stereo. The views
 * are owned by the {@link RealtimeVoiceChanger}.
 */
interface RealtimeVoiceChangerInterleavedBuffer {
    input: Float32Array;
    output: Float32Array;
    channels: number;
    process: () => void;
}
/**
 * Zero-copy realtime buffer for {@link RealtimeVoiceChanger} planar stereo
 * processing. Each entry in `channels` is a heap-backed `Float32Array` for one
 * channel (matching AudioWorklet's native layout). Process happens in place:
 * write samples into each channel view, call `process()`, then read back from
 * the same views.
 */
interface RealtimeVoiceChangerPlanarBuffer {
    channels: Float32Array[];
    process: () => void;
}
/**
 * Per-call validation options accepted by guarded wrappers. Empty-buffer
 * checks are always performed; pass `{ validate: false }` to opt out of the
 * O(n) NaN/Inf scan on hot paths.
 */
interface ValidateOptions {
    validate?: boolean;
}
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
declare function engineAbiVersion(): number;
declare function voiceChangerAbiVersion(): number;
/**
 * Map a voice-character preset ordinal (or canonical id) to its canonical id
 * string (e.g. `'bright-idol'`). Returns `null` for an out-of-range ordinal.
 */
declare function voiceCharacterPresetId(preset: VoicePresetId | number): string | null;
/**
 * Return the canonical (normalized) flat POD config for a built-in voice
 * preset, skipping the JSON round-trip. Accepts a canonical preset id or its
 * integer ordinal. Returns `null` for an out-of-range ordinal.
 */
declare function realtimeVoiceChangerPresetConfig(preset: VoicePresetId | number): RealtimeVoiceChangerPodConfig | null;
declare function engineCapabilities(): EngineCapabilities;
declare class RealtimeEngine {
    private native;
    constructor(sampleRate?: number, maxBlockSize?: number, commandCapacity?: number, telemetryCapacity?: number);
    prepare(sampleRate: number, maxBlockSize: number, commandCapacity?: number, telemetryCapacity?: number): void;
    /** Queue a sample-accurate parameter change (engine kSetParam). */
    setParameter(paramId: number, value: number, renderFrame?: number): void;
    /** Queue a smoothed parameter change (engine kSetParamSmoothed). */
    setParameterSmoothed(paramId: number, value: number, renderFrame?: number): void;
    /** Read back the current transport state snapshot. */
    getTransportState(): EngineTransportState;
    play(renderFrame?: number): void;
    stop(renderFrame?: number): void;
    seekSample(timelineSample: number, renderFrame?: number): void;
    seekPpq(ppq: number, renderFrame?: number): void;
    setTempo(bpm: number): void;
    setTimeSignature(numerator: number, denominator: number): void;
    setLoop(startPpq: number, endPpq: number, enabled?: boolean): void;
    addParameter(info: EngineParameterInfo): void;
    parameterCount(): number;
    parameterInfoByIndex(index: number): EngineParameterInfo;
    parameterInfo(id: number): EngineParameterInfo;
    setAutomationLane(paramId: number, points: EngineAutomationPoint[]): void;
    automationLaneCount(): number;
    setMarkers(markers: EngineMarker[]): void;
    markerCount(): number;
    markerByIndex(index: number): EngineMarker;
    marker(id: number): EngineMarker;
    seekMarker(markerId: number, renderFrame?: number): void;
    setLoopFromMarkers(startMarkerId: number, endMarkerId: number): void;
    setMetronome(config: EngineMetronomeConfig): void;
    metronome(): Required<EngineMetronomeConfig>;
    countInEndSample(startSample: number, bars: number): number;
    setGraph(spec: EngineGraphSpec): void;
    graphNodeCount(): number;
    graphConnectionCount(): number;
    setClips(clips: EngineClip[]): void;
    clipCount(): number;
    setCaptureBuffer(numChannels: number, capacityFrames: number): void;
    armCapture(armed?: boolean): void;
    setCapturePunch(startSample: number, endSample: number, enabled?: boolean): void;
    resetCapture(): void;
    captureStatus(): EngineCaptureStatus;
    capturedAudio(): Float32Array[];
    process(channels: Float32Array[]): Float32Array[];
    processWithMonitor(channels: Float32Array[]): WasmEngineProcessWithMonitorResult;
    renderOffline(channels: Float32Array[], blockSize?: number): Float32Array[];
    bounceOffline(options: EngineBounceOptions): EngineBounceResult;
    freezeOffline(options: EngineFreezeOptions): EngineFreezeResult;
    drainTelemetry(maxRecords?: number): EngineTelemetry[];
    drainMeterTelemetry(maxRecords?: number): EngineMeterTelemetry[];
    destroy(): void;
}
/**
 * Detect BPM from audio samples.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @returns Detected BPM
 */
declare function detectBpm(samples: Float32Array, sampleRate?: number): number;
/**
 * Detect musical key from audio samples.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @returns Detected key
 */
declare function detectKey(samples: Float32Array, sampleRate?: number, options?: KeyDetectionOptions): Key;
declare function detectKeyCandidates(samples: Float32Array, sampleRate?: number, options?: KeyDetectionOptions): KeyCandidate[];
/**
 * Detect onset times from audio samples.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @returns Array of onset times in seconds
 */
declare function detectOnsets(samples: Float32Array, sampleRate?: number): Float32Array;
/**
 * Detect beat times from audio samples.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @returns Array of beat times in seconds
 */
declare function detectBeats(samples: Float32Array, sampleRate?: number): Float32Array;
/**
 * Detect downbeat times from audio samples.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @returns Array of downbeat times in seconds
 */
declare function detectDownbeats(samples: Float32Array, sampleRate?: number): Float32Array;
/**
 * Detect chords from audio samples.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param options - Optional chord detection settings
 * @returns Detected chord segments
 */
declare function detectChords(samples: Float32Array, sampleRate?: number, options?: ChordDetectionOptions): ChordAnalysisResult;
/**
 * Perform complete music analysis.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @returns Complete analysis result
 */
declare function analyze(samples: Float32Array, sampleRate?: number): AnalysisResult;
declare function analyzeImpulseResponse(samples: Float32Array, sampleRate?: number, nOctaveBands?: number): AcousticResult;
declare function detectAcoustic(samples: Float32Array, sampleRate?: number, nOctaveBands?: number, nThirdOctaveSubbands?: number, minDecayDb?: number, noiseFloorMarginDb?: number): AcousticResult;
/**
 * Perform complete music analysis with progress reporting.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param onProgress - Progress callback (progress: 0-1, stage: string)
 * @returns Complete analysis result
 */
declare function analyzeWithProgress(samples: Float32Array, sampleRate: number | undefined, onProgress: ProgressCallback): AnalysisResult;
interface BpmCandidate {
    bpm: number;
    confidence: number;
}
interface BpmAnalysisResult {
    bpm: number;
    confidence: number;
    candidates: BpmCandidate[];
    autocorrelation: Float32Array;
    tempogram: Float32Array;
}
interface RhythmAnalysisResult {
    timeSignature: {
        numerator: number;
        denominator: number;
        confidence: number;
    };
    syncopation: number;
    grooveType: string;
    patternRegularity: number;
    tempoStability: number;
    bpm: number;
    beatIntervals: Float32Array;
}
interface DynamicsAnalysisResult {
    dynamicRangeDb: number;
    peakDb: number;
    rmsDb: number;
    crestFactor: number;
    loudnessRangeDb: number;
    isCompressed: boolean;
    /** Loudness curve timestamps (seconds), parallel to {@link loudnessRmsDb}. */
    loudnessTimes: Float32Array;
    /** Loudness curve RMS values (dB), parallel to {@link loudnessTimes}. */
    loudnessRmsDb: Float32Array;
}
/** Timbre metrics for one analysis window. Entries are ordered by time in `timbreOverTime`. */
interface TimbreFrame {
    brightness: number;
    warmth: number;
    density: number;
    roughness: number;
    complexity: number;
}
interface TimbreAnalysisResult extends TimbreFrame {
    spectralCentroid: Float32Array;
    spectralFlatness: Float32Array;
    spectralRolloff: Float32Array;
    /** Time-varying timbre metrics, one entry per analysis window. */
    timbreOverTime: TimbreFrame[];
}
/**
 * Detailed BPM analysis (BPM, confidence, alternate candidates, autocorrelation,
 * tempogram). Matches the Node `analyzeBpm` / Python `analyze_bpm` surface.
 */
declare function analyzeBpm(samples: Float32Array, sampleRate?: number, bpmMin?: number, bpmMax?: number, startBpm?: number, nFft?: number, hopLength?: number, maxCandidates?: number): BpmAnalysisResult;
/**
 * Detailed rhythm analysis (time signature, groove, syncopation, beat intervals).
 */
declare function analyzeRhythm(samples: Float32Array, sampleRate?: number, bpmMin?: number, bpmMax?: number, startBpm?: number, nFft?: number, hopLength?: number): RhythmAnalysisResult;
/**
 * Dynamics analysis (RMS, peak, crest factor, LRA, loudness curve).
 */
declare function analyzeDynamics(samples: Float32Array, sampleRate?: number, windowSec?: number, hopLength?: number, compressionThreshold?: number): DynamicsAnalysisResult;
/**
 * Timbre analysis (brightness/warmth/density/roughness/complexity plus spectral
 * features and per-window timbre frames).
 */
declare function analyzeTimbre(samples: Float32Array, sampleRate?: number, nFft?: number, hopLength?: number, nMels?: number, nMfcc?: number, windowSec?: number): TimbreAnalysisResult;
/**
 * Whether this WASM build was compiled with FFmpeg support. Mirrors Node /
 * Python `hasFfmpegSupport`. In the published WASM binding this currently
 * always returns `false` (FFmpeg is not bundled into the .wasm), but the API
 * exists so caller code can branch on capabilities portably.
 */
declare function hasFfmpegSupport(): boolean;
/**
 * Perform Harmonic-Percussive Source Separation (HPSS).
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param kernelHarmonic - Horizontal median filter size for harmonic (default: 31)
 * @param kernelPercussive - Vertical median filter size for percussive (default: 31)
 * @returns Separated harmonic and percussive components
 */
declare function hpss(samples: Float32Array, sampleRate?: number, kernelHarmonic?: number, kernelPercussive?: number): HpssResult;
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
 * Pitch-correct audio from a current MIDI note to a target MIDI note.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz
 * @param currentMidi - Detected/current MIDI note number
 * @param targetMidi - Desired MIDI note number
 * @returns Pitch-corrected audio
 */
declare function pitchCorrectToMidi(samples: Float32Array, sampleRate?: number, currentMidi?: number, targetMidi?: number): Float32Array;
/**
 * Time-stretch a note region between two sample offsets without changing pitch.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz
 * @param onsetSample - Note onset position in samples
 * @param offsetSample - Note offset position in samples
 * @param stretchRatio - Stretch ratio (0.5 = double duration, 2.0 = half duration)
 * @returns Audio with the note region stretched
 */
declare function noteStretch(samples: Float32Array, sampleRate?: number, onsetSample?: number, offsetSample?: number, stretchRatio?: number): Float32Array;
/**
 * Apply a voice change by shifting pitch and formants independently.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz
 * @param pitchSemitones - Pitch shift in semitones
 * @param formantFactor - Formant scaling factor (1.0 = unchanged)
 * @returns Voice-changed audio
 */
declare function voiceChange(samples: Float32Array, sampleRate?: number, pitchSemitones?: number, formantFactor?: number, options?: ValidateOptions): Float32Array;
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
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param targetLufs - Target integrated LUFS (default: -14)
 * @param ceilingDb - True/sample peak ceiling in dBFS (default: -1)
 * @param truePeakOversample - Oversampling factor used for peak estimation
 * @returns Processed audio and loudness metadata
 */
declare function mastering(samples: Float32Array, sampleRate?: number, targetLufs?: number, ceilingDb?: number, truePeakOversample?: number): MasteringResult;
declare function masteringProcessorNames(): SoloProcessor[];
declare function masteringPairProcessorNames(): PairProcessor[];
declare function masteringPairAnalysisNames(): PairAnalysis[];
declare function masteringStereoAnalysisNames(): StereoAnalysis[];
declare function masteringProcess(processorName: SoloProcessor, samples: Float32Array, sampleRate?: number, params?: MasteringProcessorParams): MasteringResult;
declare function masteringProcessStereo(processorName: SoloProcessor, left: Float32Array, right: Float32Array, sampleRate?: number, params?: MasteringProcessorParams): MasteringStereoResult;
declare function masteringPairProcess(processorName: PairProcessor, source: Float32Array, reference: Float32Array, sampleRate?: number, params?: MasteringProcessorParams): MasteringResult;
declare function masteringPairAnalyze(analysisName: PairAnalysis, source: Float32Array, reference: Float32Array, sampleRate?: number, params?: MasteringProcessorParams): string;
declare function masteringStereoAnalyze(analysisName: StereoAnalysis, left: Float32Array, right: Float32Array, sampleRate?: number, params?: MasteringProcessorParams): string;
declare function masteringAssistantSuggest(samples: Float32Array, sampleRate?: number, params?: MasteringProcessorParams): string;
declare function masteringAudioProfile(samples: Float32Array, sampleRate?: number, params?: MasteringProcessorParams): string;
declare function masteringStreamingPreview(samples: Float32Array, sampleRate?: number, platforms?: StreamingPlatform[]): string;
/** Options for `masteringRepairDeclick`. */
interface DeclickOptions {
    threshold?: number;
    neighborRatio?: number;
    maxClickSamples?: number;
    lpcOrder?: number;
    residualRatio?: number;
}
/** Algorithms accepted by `masteringRepairDenoiseClassical`. */
type DenoiseClassicalMode = 'logMmse' | 'mmseStsa' | 'spectralSubtraction';
/** Noise PSD estimators accepted by `masteringRepairDenoiseClassical`. */
type DenoiseClassicalNoiseEstimator = 'quantile' | 'mcra' | 'imcra';
/** Options for `masteringRepairDenoiseClassical`. */
interface DenoiseClassicalOptions {
    mode?: DenoiseClassicalMode;
    noiseEstimator?: DenoiseClassicalNoiseEstimator;
    nFft?: number;
    hopLength?: number;
    ddAlpha?: number;
    gainFloor?: number;
    overSubtraction?: number;
    spectralFloor?: number;
    noiseEstimationQuantile?: number;
    speechPresenceGain?: boolean;
    gainSmoothing?: boolean;
}
/** Offline LPC-based declicker. */
declare function masteringRepairDeclick(samples: Float32Array, sampleRate: number, options?: DeclickOptions): Float32Array;
/** Offline STFT-domain classical denoiser (LogMMSE / MMSE-STSA / SpectralSubtraction). */
declare function masteringRepairDenoiseClassical(samples: Float32Array, sampleRate: number, options?: DenoiseClassicalOptions): Float32Array;
/** Options for `masteringRepairDeclip`. */
interface DeclipOptions {
    clipThreshold?: number;
    lpcOrder?: number;
    iterations?: number;
    lpcBlend?: number;
}
/** Algorithms accepted by `masteringRepairDecrackle`. */
type DecrackleMode = 'median' | 'waveletShrinkage';
/** Options for `masteringRepairDecrackle`. */
interface DecrackleOptions {
    threshold?: number;
    mode?: DecrackleMode;
    levels?: number;
}
/** Options for `masteringRepairDehum`. */
interface DehumOptions {
    fundamentalHz?: number;
    harmonics?: number;
    q?: number;
    adaptive?: boolean;
    searchRangeHz?: number;
    adaptation?: number;
    frameSize?: number;
    pllBandwidth?: number;
}
/** Options for `masteringRepairDereverbClassical`. */
interface DereverbClassicalOptions {
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
}
/** Trimming modes accepted by `masteringRepairTrimSilence`. */
type TrimSilenceMode = 'peak' | 'lufsGated';
/** Options for `masteringRepairTrimSilence`. */
interface TrimSilenceOptions {
    threshold?: number;
    paddingSamples?: number;
    mode?: TrimSilenceMode;
    gateLufs?: number;
    windowMs?: number;
}
/** Offline LPC-based declipper. */
declare function masteringRepairDeclip(samples: Float32Array, sampleRate: number, options?: DeclipOptions): Float32Array;
/** Offline crackle suppressor (median or wavelet-shrinkage). */
declare function masteringRepairDecrackle(samples: Float32Array, sampleRate: number, options?: DecrackleOptions): Float32Array;
/** Offline mains-hum remover. */
declare function masteringRepairDehum(samples: Float32Array, sampleRate: number, options?: DehumOptions): Float32Array;
/** Offline classical dereverberator (spectral subtraction + optional WPE). */
declare function masteringRepairDereverbClassical(samples: Float32Array, sampleRate: number, options?: DereverbClassicalOptions): Float32Array;
/** Offline silence trimmer (peak threshold or LUFS-gated). */
declare function masteringRepairTrimSilence(samples: Float32Array, sampleRate: number, options?: TrimSilenceOptions): Float32Array;
/** Compressor sidechain detector mode. */
type CompressorDetector = 'peak' | 'rms' | 'log_rms';
/** Options for `masteringDynamicsCompressor`. */
interface CompressorOptions extends ValidateOptions {
    thresholdDb?: number;
    ratio?: number;
    attackMs?: number;
    releaseMs?: number;
    kneeDb?: number;
    makeupGainDb?: number;
    autoMakeup?: boolean;
    detector?: CompressorDetector | number;
    sidechainHpfEnabled?: boolean;
    sidechainHpfHz?: number;
    pdrTimeMs?: number;
    pdrReleaseScale?: number;
}
/** Options for `masteringDynamicsGate`. */
interface GateOptions extends ValidateOptions {
    thresholdDb?: number;
    attackMs?: number;
    releaseMs?: number;
    rangeDb?: number;
    holdMs?: number;
    closeThresholdDb?: number;
    keyHpfHz?: number;
}
/** Options for `masteringDynamicsTransientShaper`. */
interface TransientShaperOptions extends ValidateOptions {
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
}
/** Result envelope returned by offline mastering dynamics processors. */
interface DynamicsResult {
    samples: Float32Array;
    latencySamples: number;
}
/** Offline feed-forward compressor (soft knee, optional auto-makeup / sidechain HPF). */
declare function masteringDynamicsCompressor(samples: Float32Array, sampleRate: number, options?: CompressorOptions): DynamicsResult;
/** Offline noise gate (hysteresis, hold, optional key HPF). */
declare function masteringDynamicsGate(samples: Float32Array, sampleRate: number, options?: GateOptions): DynamicsResult;
/** Offline transient shaper (envelope-difference attack/sustain control). */
declare function masteringDynamicsTransientShaper(samples: Float32Array, sampleRate: number, options?: TransientShaperOptions): DynamicsResult;
/**
 * Apply a configurable mastering chain in WASM.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param config - Chain stage configuration
 * @returns Processed audio, loudness metadata, and applied stage names
 */
declare function masteringChain(samples: Float32Array, sampleRate: number | undefined, config: MasteringChainConfig): MasteringChainResult;
/**
 * Apply a configurable stereo mastering chain in WASM.
 *
 * @param left - Left channel samples
 * @param right - Right channel samples
 * @param sampleRate - Sample rate in Hz
 * @param config - Chain stage configuration
 * @returns Processed stereo audio, loudness metadata, and applied stage names
 */
declare function masteringChainStereo(left: Float32Array, right: Float32Array, sampleRate: number | undefined, config: MasteringChainConfig): MasteringStereoChainResult;
/**
 * Apply a configurable mastering chain in WASM with progress reporting.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param config - Chain stage configuration
 * @param onProgress - Progress callback (progress: 0-1, stage: string)
 * @returns Processed audio, loudness metadata, and applied stage names
 */
declare function masteringChainWithProgress(samples: Float32Array, sampleRate: number | undefined, config: MasteringChainConfig, onProgress: ProgressCallback): MasteringChainResult;
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
declare function masteringChainStereoWithProgress(left: Float32Array, right: Float32Array, sampleRate: number | undefined, config: MasteringChainConfig, onProgress: ProgressCallback): MasteringStereoChainResult;
/**
 * List built-in mastering preset identifiers.
 *
 * @returns Preset names in display order (e.g. "pop", "edm", "aiMusic")
 */
declare function masteringPresetNames(): MasteringPreset[];
/**
 * Apply a named mastering preset chain to mono audio.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param presetName - Preset identifier from {@link masteringPresetNames}
 * @param overrides - Optional flat overrides (dot-notation, e.g. `'loudness.targetLufs'`) applied on top of the preset. Pass `null` for preset defaults.
 * @returns Processed audio, loudness metadata, and applied stage names
 */
declare function masterAudio(samples: Float32Array, sampleRate: number | undefined, presetName: MasteringPreset, overrides?: Record<string, number | boolean> | null): MasteringChainResult;
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
declare function masterAudioStereo(left: Float32Array, right: Float32Array, sampleRate: number | undefined, presetName: MasteringPreset, overrides?: Record<string, number | boolean> | null): MasteringStereoChainResult;
/**
 * Mono `masterAudio` with per-stage progress reporting. `onProgress` is invoked
 * with `(progress, stage)` between each chain stage (progress is in [0,1]).
 */
declare function masterAudioWithProgress(samples: Float32Array, sampleRate: number | undefined, presetName: MasteringPreset, onProgress: ProgressCallback, overrides?: Record<string, number | boolean> | null): MasteringChainResult;
/**
 * Stereo `masterAudio` with per-stage progress reporting.
 */
declare function masterAudioStereoWithProgress(left: Float32Array, right: Float32Array, sampleRate: number | undefined, presetName: MasteringPreset, onProgress: ProgressCallback, overrides?: Record<string, number | boolean> | null): MasteringStereoChainResult;
declare function mixingScenePresetNames(): string[];
/**
 * Get a built-in mixing scene preset serialized as JSON. This is the canonical
 * name shared with the Node and Python bindings; the returned JSON loads
 * directly into a {@link Mixer} via {@link Mixer.fromSceneJson}.
 *
 * @param presetName - Preset name (see {@link mixingScenePresetNames})
 * @returns Scene JSON string
 */
declare function mixingScenePresetJson(presetName: string): string;
declare function mixStereo(leftChannels: Float32Array[], rightChannels: Float32Array[], sampleRate?: number, options?: MixOptions): MixResult;
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
 * Block-by-block streaming equalizer wrapping the unified C++
 * `EqualizerProcessor` (up to 24 bands, RBJ/Vicanek biquads, dynamic EQ,
 * linear-phase FIR, mid/side processing, and auto-gain).
 *
 * State is maintained across {@link processMono}/{@link processStereo} calls.
 * Call {@link delete} (or use `try/finally`) to release the underlying WASM
 * object — the embind handle is not garbage-collected automatically.
 *
 * @example
 * ```typescript
 * const eq = new StreamingEqualizer({ sampleRate: 48000, maxBlockSize: 512 });
 * try {
 *   eq.setBand(0, { type: 'HighShelf', frequencyHz: 8000, gainDb: 6, enabled: true });
 *   const out = eq.processStereo(left, right);
 *   const snapshot = eq.spectrum();
 * } finally {
 *   eq.delete();
 * }
 * ```
 */
declare class StreamingEqualizer {
    private eq;
    constructor(config?: StreamingEqualizerConfig);
    /**
     * Configure the band at `index` (0..23). Omitted fields use C++ defaults.
     */
    setBand(index: number, band: EqBand): void;
    /** Disable and reset every band. */
    clear(): void;
    /**
     * Set the global phase mode: 1=ZeroLatency, 2=NaturalPhase, 3=LinearPhase.
     */
    setPhaseMode(mode: number): void;
    /** Enable or disable output auto-gain compensation. */
    setAutoGain(enabled: boolean): void;
    /** Set all-band EQ gain scale as a 0.0..2.0 multiplier. */
    setGainScale(scale: number): void;
    /** Set post-EQ output gain in dB. */
    setOutputGainDb(gainDb: number): void;
    /** Set post-EQ stereo balance in -1.0..1.0; mono input ignores pan. */
    setOutputPan(pan: number): void;
    /**
     * Provide a mono external sidechain key for dynamic bands that opt into
     * `external_sidechain`. The samples are copied into an owned buffer.
     */
    setSidechainMono(samples: Float32Array): void;
    /**
     * Provide a stereo external sidechain key. Both channels must match length.
     */
    setSidechainStereo(left: Float32Array, right: Float32Array): void;
    /** Release any borrowed external sidechain buffers. */
    clearSidechain(): void;
    /** Auto-gain applied on the most recent block, in dB. */
    lastAutoGainDb(): number;
    /** Reported processing latency in samples (non-zero for linear-phase bands). */
    latencySamples(): number;
    /**
     * Process one mono block, returning the equalized samples (same length).
     */
    processMono(samples: Float32Array): Float32Array;
    /**
     * Process one stereo block, returning the equalized channels.
     */
    processStereo(left: Float32Array, right: Float32Array): {
        left: Float32Array;
        right: Float32Array;
    };
    /**
     * Read the latest pre/post spectrum snapshot for metering. `seq` increments
     * each time a new snapshot is published.
     */
    spectrum(): EqSpectrumSnapshot;
    /**
     * Configure bands so the source spectrum matches the reference spectrum.
     *
     * @param source - Source audio (mono samples)
     * @param reference - Reference audio (mono samples)
     * @param options - `sampleRate` (default 48000) and `maxBands` (default 8)
     */
    match(source: Float32Array, reference: Float32Array, options?: EqMatchOptions): void;
    /** Release the underlying WASM object. Safe to call only once. */
    delete(): void;
}
/**
 * Block-by-block mono voice retune / pitch shifter.
 *
 * State is maintained across {@link processMono} calls. Call {@link prepare}
 * before processing, and call {@link delete} (or use `try/finally`) to release
 * the underlying WASM object.
 */
declare class StreamingRetune {
    private retune;
    constructor(config?: StreamingRetuneConfig);
    /**
     * Allocate and initialize native state for the given sample rate and maximum
     * process block size.
     */
    prepare(sampleRate: number, maxBlockSize: number): void;
    /** Reset delay, grain, and overlap-add state without changing config. */
    reset(): void;
    /**
     * Update retune settings. Changing `grainSize` takes effect after the next
     * {@link prepare} call.
     */
    setConfig(config: StreamingRetuneConfig): void;
    /** Current native config. */
    config(): Required<StreamingRetuneConfig>;
    /** Resolved grain size in samples after {@link prepare}. */
    grainSize(): number;
    /** Process one mono block, returning the shifted samples (same length). */
    processMono(samples: Float32Array): Float32Array;
    /** Release the underlying WASM object. Safe to call only once. */
    delete(): void;
}
declare class RealtimeVoiceChanger {
    private changer;
    constructor(config?: RealtimeVoiceChangerConfigInput);
    prepare(sampleRate: number, maxBlockSize?: number, channels?: number): void;
    reset(): void;
    setConfig(config: RealtimeVoiceChangerConfigInput): void;
    configJson(): string;
    latencySamples(): number;
    processMono(samples: Float32Array): Float32Array;
    processMonoInto(samples: Float32Array, output: Float32Array): void;
    processInterleaved(samples: Float32Array, channels: number): Float32Array;
    processInterleavedInto(samples: Float32Array, channels: number, output: Float32Array): void;
    /**
     * Acquire a typed-memory view onto the WASM heap for mono input.
     *
     * Write your input samples into the returned `Float32Array` directly (e.g.
     * via `input.set(source)`); no copy crosses the JS↔C++ bridge until
     * {@link processPreparedMono} is called. The view is owned by this
     * RealtimeVoiceChanger and becomes invalid after {@link delete}; it may
     * also be invalidated if you later call this method with a larger
     * `numSamples` value (the underlying buffer may be reallocated).
     */
    getMonoInputBuffer(numSamples: number): Float32Array;
    /** Mono output view counterpart to {@link getMonoInputBuffer}. */
    getMonoOutputBuffer(numSamples: number): Float32Array;
    /**
     * Process the previously-acquired mono input buffer in place. The output
     * appears in the buffer returned by {@link getMonoOutputBuffer}. No JS↔C++
     * sample-level crossings happen on this call — it just hands control to
     * the underlying DSP on already-on-heap data.
     */
    processPreparedMono(numSamples: number): void;
    /** Interleaved input view (layout L0,R0,L1,R1,...). */
    getInterleavedInputBuffer(numFrames: number, numChannels: number): Float32Array;
    /** Interleaved output view counterpart. */
    getInterleavedOutputBuffer(numFrames: number, numChannels: number): Float32Array;
    /**
     * Process the previously-acquired interleaved buffer in place. Output
     * appears in the buffer returned by {@link getInterleavedOutputBuffer}.
     */
    processPreparedInterleaved(numFrames: number, numChannels: number): void;
    /**
     * Planar-channel input/output view (one Float32Array per channel). Matches
     * AudioWorklet's native layout; processing happens in place.
     */
    getPlanarChannelBuffer(channel: number, numFrames: number): Float32Array;
    /**
     * Process the previously-acquired planar channel buffers in place. Each
     * channel must have been obtained from {@link getPlanarChannelBuffer}
     * with the same `numFrames`. Output replaces input in the same buffers.
     */
    processPreparedPlanar(numFrames: number): void;
    /**
     * Convenience factory for the mono zero-copy path: returns the input/output
     * heap views plus a `process()` thunk wired to the same `numSamples`. The
     * views are reused across calls and become invalid after {@link delete}.
     */
    createRealtimeMonoBuffer(numSamples: number): RealtimeVoiceChangerMonoBuffer;
    /** Same as {@link createRealtimeMonoBuffer} but for interleaved I/O. */
    createRealtimeInterleavedBuffer(numFrames: number, numChannels: number): RealtimeVoiceChangerInterleavedBuffer;
    /**
     * Convenience factory for the planar zero-copy path. Acquires one
     * heap-backed Float32Array per channel and returns a `process()` thunk
     * wired to the same `numFrames`. Buffers are reused across calls and
     * become invalid after {@link delete}.
     */
    createRealtimePlanarBuffer(numFrames: number, numChannels: number): RealtimeVoiceChangerPlanarBuffer;
    delete(): void;
}
declare function realtimeVoiceChangerPresetNames(): VoicePresetId[];
declare function realtimeVoiceChangerPresetJson(name: VoicePresetId): string;
declare function validateRealtimeVoiceChangerPresetJson(json: string): {
    ok: boolean;
    normalizedJson?: string;
    error?: string;
};
/**
 * Persistent, scene-based stereo mixer.
 *
 * Build one from a scene JSON string (e.g. {@link mixingScenePresetJson} or a
 * hand-authored scene), then feed per-strip stereo blocks through
 * {@link processStereo} to get the routed stereo master. Strips, sends, buses,
 * and inserts are described entirely by the scene; the routing graph is
 * compiled lazily on the first {@link processStereo} call (or eagerly via
 * {@link compile}).
 *
 * Call {@link delete} (or use a `try/finally`) to release the underlying WASM
 * object — the embind handle is not garbage-collected automatically.
 *
 * @example
 * ```typescript
 * const mixer = Mixer.fromSceneJson(mixingScenePresetJson('basicStereo'), 48000, 512);
 * try {
 *   const out = mixer.processStereo([stripL], [stripR]);
 * } finally {
 *   mixer.delete();
 * }
 * ```
 */
declare class Mixer {
    private mixer;
    private constructor();
    /**
     * Build a mixer from a scene JSON string.
     *
     * @param json - Scene JSON (strips, buses, sends, connections, inserts)
     * @param sampleRate - Sample rate in Hz (default: 48000)
     * @param blockSize - Maximum block size per {@link processStereo} call (default: 512)
     */
    static fromSceneJson(json: string, sampleRate?: number, blockSize?: number): Mixer;
    /** Rebuild and compile the routing graph from the current scene topology. */
    compile(): void;
    /**
     * Mix one block of per-strip stereo audio into the stereo master.
     *
     * @param leftChannels - `leftChannels[i]` is the left channel of strip `i`
     * @param rightChannels - `rightChannels[i]` is the right channel of strip `i`
     * @returns Mixed stereo master (`left`, `right`, `sampleRate`)
     */
    processStereo(leftChannels: Float32Array[], rightChannels: Float32Array[]): MixerProcessResult;
    /**
     * Mix one block into caller-owned output arrays.
     *
     * This avoids allocating the result object and result `Float32Array`s. It is
     * intended for realtime bridges such as AudioWorklet; the input channel count
     * must match the scene strip count and all arrays must have the same length.
     */
    processStereoInto(leftChannels: Float32Array[], rightChannels: Float32Array[], outLeft: Float32Array, outRight: Float32Array): void;
    /**
     * Create reusable WASM-heap input/output views for realtime-style processing.
     *
     * Fill `leftInputs[i]` / `rightInputs[i]`, call `process()`, then read
     * `outLeft` / `outRight`. The views are owned by this mixer and become invalid
     * after {@link delete}.
     */
    createRealtimeBuffer(): MixerRealtimeBuffer;
    /** Number of strips in the mixer (e.g. strips loaded from the scene). */
    stripCount(): number;
    /**
     * Schedule sample-accurate insert-parameter automation on a strip's insert.
     *
     * @param stripIndex - Strip index in `[0, stripCount())`
     * @param insertIndex - Index into the strip's combined insert sequence
     *   (`[pre-inserts... post-inserts...]`)
     * @param paramId - Processor-specific parameter id
     * @param samplePos - Absolute samples from the start of processing (the mixer
     *   advances an internal position from 0 on the first {@link processStereo}
     *   call; recompiling resets it to 0)
     * @param value - Target parameter value
     * @param curve - Interpolation curve (default: `'linear'`)
     * @throws If the strip index is out of range or the schedule call fails
     *   (unknown curve, out-of-range insert index, or full event lane)
     */
    scheduleInsertAutomation(stripIndex: number, insertIndex: number, paramId: number, samplePos: number, value: number, curve?: AutomationCurve): void;
    /**
     * Resolve a strip's index in `[0, stripCount())` from its scene id, or `null`
     * when no strip with that id exists (matches the Node binding's `number | null`).
     */
    stripById(id: string): number | null;
    /**
     * Add a bus to the mixer topology. `role` is one of `'master'`, `'aux'`, or
     * `'submix'` (defaults to `'aux'`). Marks the routing graph dirty; call
     * {@link compile} (or {@link processStereo}) to rebuild.
     */
    addBus(id: string, role?: string): void;
    /** Remove a bus by id. Marks the routing graph dirty. */
    removeBus(id: string): void;
    /** Number of buses in the mixer topology. */
    busCount(): number;
    /**
     * Add a VCA group with the given gain offset (dB). `members` is a list of
     * strip ids governed by the group (may be empty).
     */
    addVcaGroup(id: string, gainDb?: number, members?: string[]): void;
    /** Remove a VCA group by id. */
    removeVcaGroup(id: string): void;
    /** Number of VCA groups in the mixer topology. */
    vcaGroupCount(): number;
    /** Set the strip's input trim in dB. */
    setInputTrimDb(stripIndex: number, db: number): void;
    /** Set the strip's fader level in dB. */
    setFaderDb(stripIndex: number, db: number): void;
    /** Set the strip's pan position. */
    setPan(stripIndex: number, pan: number, panMode?: PanMode | number): void;
    /** Set the strip's stereo width. */
    setWidth(stripIndex: number, width: number): void;
    /** Set the strip's mute state. */
    setMuted(stripIndex: number, muted: boolean): void;
    /**
     * Set a strip's solo state. Takes effect on the next process without a
     * graph recompile.
     */
    setSoloed(stripIndex: number, soloed: boolean): void;
    /**
     * Mark a strip solo-safe so it is never implied-muted by another strip's
     * solo. Takes effect on the next process without a graph recompile.
     */
    setSoloSafe(stripIndex: number, soloSafe: boolean): void;
    /** Invert the polarity of the left and/or right channel of a strip. */
    setPolarityInvert(stripIndex: number, invertLeft: boolean, invertRight: boolean): void;
    /** Set the strip's pan law. */
    setPanLaw(stripIndex: number, panLaw: PanLaw | number): void;
    /**
     * Set a per-strip channel delay in samples. This changes the strip's reported
     * latency; recompile to re-run latency compensation.
     */
    setChannelDelaySamples(stripIndex: number, delaySamples: number): void;
    /** Set the strip's live VCA gain offset in dB (not persisted to the scene). */
    setVcaOffsetDb(stripIndex: number, offsetDb: number): void;
    /** Set independent left/right pan positions (dual-pan mode). */
    setDualPan(stripIndex: number, leftPan: number, rightPan: number): void;
    /**
     * Add a send to a strip after construction.
     *
     * @param stripIndex - Strip index in `[0, stripCount())`
     * @param id - Send id
     * @param destinationBusId - Destination bus id
     * @param sendDb - Initial send level in dB
     * @param timing - `'preFader'` or `'postFader'` (default: `'postFader'`)
     * @returns The new send's index
     */
    addSend(stripIndex: number, id: string, destinationBusId: string, sendDb: number, timing?: SendTiming | number): number;
    /** Set the send level (in dB) for an existing send by index. */
    setSendDb(stripIndex: number, sendIndex: number, sendDb: number): void;
    /**
     * Read a strip's meter snapshot at the given tap point.
     *
     * @param stripIndex - Strip index in `[0, stripCount())`
     * @param tap - `'preFader'` or `'postFader'` (default: `'postFader'`)
     */
    meterTap(stripIndex: number, tap?: MeterTap): MixMeterSnapshot;
    /**
     * Read a strip's meter snapshot. Alias of {@link meterTap}, provided for
     * cross-binding (Node/Python) parity.
     *
     * @param stripIndex - Strip index in `[0, stripCount())`
     * @param tap - `'preFader'` or `'postFader'` (default: `'postFader'`)
     */
    stripMeter(stripIndex: number, tap?: MeterTap): MixMeterSnapshot;
    /**
     * Schedule sample-accurate fader automation on a strip.
     *
     * @param stripIndex - Strip index in `[0, stripCount())`
     * @param samplePos - Absolute samples from the start of processing
     * @param faderDb - Target fader level in dB
     * @param curve - Interpolation curve (default: `'linear'`)
     */
    scheduleFaderAutomation(stripIndex: number, samplePos: number, faderDb: number, curve?: AutomationCurve): void;
    /**
     * Schedule sample-accurate pan automation on a strip.
     *
     * @param stripIndex - Strip index in `[0, stripCount())`
     * @param samplePos - Absolute samples from the start of processing
     * @param pan - Target pan position
     * @param curve - Interpolation curve (default: `'linear'`)
     */
    schedulePanAutomation(stripIndex: number, samplePos: number, pan: number, curve?: AutomationCurve): void;
    /**
     * Schedule sample-accurate width automation on a strip.
     *
     * @param stripIndex - Strip index in `[0, stripCount())`
     * @param samplePos - Absolute samples from the start of processing
     * @param width - Target stereo width
     * @param curve - Interpolation curve (default: `'linear'`)
     */
    scheduleWidthAutomation(stripIndex: number, samplePos: number, width: number, curve?: AutomationCurve): void;
    /**
     * Schedule sample-accurate send-level automation on a strip's send.
     *
     * @param stripIndex - Strip index in `[0, stripCount())`
     * @param sendIndex - Send index in the strip's add order
     * @param samplePos - Absolute samples from the start of processing
     * @param db - Target send level in dB
     * @param curve - Interpolation curve (default: `'linear'`)
     */
    scheduleSendAutomation(stripIndex: number, sendIndex: number, samplePos: number, db: number, curve?: AutomationCurve): void;
    /**
     * Read up to `maxPoints` of a strip's most recent goniometer samples
     * (oldest to newest).
     */
    readGoniometerLatest(stripIndex: number, maxPoints: number): GoniometerPoint[];
    /** Serialize the current scene (strips, buses, sends, connections) to JSON. */
    toSceneJson(): string;
    /** Release the underlying WASM object. Safe to call only once. */
    delete(): void;
    /** Alias for {@link delete}, provided for cross-binding (Node) compatibility. */
    destroy(): void;
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
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param nFft - FFT size (default: 2048)
 * @param hopLength - Hop length (default: 512)
 * @returns STFT result with magnitude and power spectrograms
 */
declare function stft(samples: Float32Array, sampleRate?: number, nFft?: number, hopLength?: number): StftResult;
/**
 * Compute STFT and return magnitude in decibels.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param nFft - FFT size (default: 2048)
 * @param hopLength - Hop length (default: 512)
 * @returns STFT result with dB values
 */
declare function stftDb(samples: Float32Array, sampleRate?: number, nFft?: number, hopLength?: number): {
    nBins: number;
    nFrames: number;
    db: Float32Array;
};
/**
 * Compute Mel spectrogram.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param nFft - FFT size (default: 2048)
 * @param hopLength - Hop length (default: 512)
 * @param nMels - Number of Mel bands (default: 128)
 * @returns Mel spectrogram result
 */
declare function melSpectrogram(samples: Float32Array, sampleRate?: number, nFft?: number, hopLength?: number, nMels?: number): MelSpectrogramResult;
/**
 * Compute MFCC (Mel-Frequency Cepstral Coefficients).
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param nFft - FFT size (default: 2048)
 * @param hopLength - Hop length (default: 512)
 * @param nMels - Number of Mel bands (default: 128)
 * @param nMfcc - Number of MFCC coefficients (default: 20)
 * @returns MFCC result
 */
declare function mfcc(samples: Float32Array, sampleRate?: number, nFft?: number, hopLength?: number, nMels?: number, nMfcc?: number): MfccResult;
/**
 * Approximate inverse of a Mel filterbank: Mel power spectrogram -> STFT power
 * spectrogram. Mirrors `feature::mel_to_stft`.
 *
 * @param melPower - Mel power spectrogram [nMels x nFrames] row-major
 * @param nMels - Number of Mel bands
 * @param nFrames - Number of time frames
 * @param sampleRate - Sample rate in Hz
 * @param nFft - FFT size (default: 2048)
 * @param fmin - Lower Mel band edge in Hz (default: 0)
 * @param fmax - Upper Mel band edge in Hz (default: sr/2 when 0)
 * @returns STFT power spectrogram result
 */
declare function melToStft(melPower: Float32Array, nMels: number, nFrames: number, sampleRate?: number, nFft?: number, fmin?: number, fmax?: number): StftPowerResult;
/**
 * Reconstruct audio from a Mel power spectrogram via Griffin-Lim. Mirrors
 * `feature::mel_to_audio`.
 *
 * @param melPower - Mel power spectrogram [nMels x nFrames] row-major
 * @param nMels - Number of Mel bands
 * @param nFrames - Number of time frames
 * @param sampleRate - Sample rate in Hz
 * @param nFft - FFT size (default: 2048)
 * @param hopLength - Hop length (default: 512)
 * @param fmin - Minimum Mel frequency in Hz (default: 0)
 * @param fmax - Maximum Mel frequency in Hz (default: 0 = sr/2)
 * @param nIter - Griffin-Lim iterations (default: 32)
 * @returns Reconstructed audio samples (mono, float32)
 */
declare function melToAudio(melPower: Float32Array, nMels: number, nFrames: number, sampleRate?: number, nFft?: number, hopLength?: number, fmin?: number, fmax?: number, nIter?: number): Float32Array;
/**
 * Invert MFCC coefficients back to a Mel power spectrogram. Mirrors
 * `feature::mfcc_to_mel`.
 *
 * @param mfccCoefficients - MFCC matrix [nMfcc x nFrames] row-major
 * @param nMfcc - Number of MFCC coefficients
 * @param nFrames - Number of time frames
 * @param nMels - Number of Mel bins to reconstruct (default: 128)
 * @returns Mel power spectrogram result
 */
declare function mfccToMel(mfccCoefficients: Float32Array, nMfcc: number, nFrames: number, nMels?: number): MelPowerResult;
/**
 * Reconstruct audio directly from MFCC coefficients via Griffin-Lim. Mirrors
 * `feature::mfcc_to_audio`.
 *
 * @param mfccCoefficients - MFCC matrix [nMfcc x nFrames] row-major
 * @param nMfcc - Number of MFCC coefficients
 * @param nFrames - Number of time frames
 * @param nMels - Number of Mel bins (default: 128)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param nFft - FFT size (default: 2048)
 * @param hopLength - Hop length (default: 512)
 * @param fmin - Minimum Mel frequency in Hz (default: 0)
 * @param fmax - Maximum Mel frequency in Hz (default: 0 = sr/2)
 * @param nIter - Griffin-Lim iterations (default: 32)
 * @returns Reconstructed audio samples (mono, float32)
 */
declare function mfccToAudio(mfccCoefficients: Float32Array, nMfcc: number, nFrames: number, nMels?: number, sampleRate?: number, nFft?: number, hopLength?: number, fmin?: number, fmax?: number, nIter?: number): Float32Array;
/**
 * Compute chromagram (pitch class distribution).
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param nFft - FFT size (default: 2048)
 * @param hopLength - Hop length (default: 512)
 * @returns Chroma features result
 */
declare function chroma(samples: Float32Array, sampleRate?: number, nFft?: number, hopLength?: number): ChromaResult;
/**
 * Compute spectral centroid (center of mass of spectrum).
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param nFft - FFT size (default: 2048)
 * @param hopLength - Hop length (default: 512)
 * @returns Spectral centroid in Hz for each frame
 */
declare function spectralCentroid(samples: Float32Array, sampleRate?: number, nFft?: number, hopLength?: number): Float32Array;
/**
 * Compute spectral contrast (librosa.feature.spectral_contrast).
 *
 * @returns Matrix2d of shape (nBands + 1) x nFrames.
 */
declare function spectralContrast(samples: Float32Array, sampleRate?: number, nFft?: number, hopLength?: number, nBands?: number, fmin?: number, quantile?: number): WasmMatrix2dResult;
/**
 * Fit per-frame polynomial coefficients (librosa.feature.poly_features).
 *
 * @returns Matrix2d of shape (order + 1) x nFrames.
 */
declare function polyFeatures(samples: Float32Array, sampleRate?: number, nFft?: number, hopLength?: number, order?: number): WasmMatrix2dResult;
/**
 * Locate zero-crossing indices of a signal (librosa.zero_crossings).
 */
declare function zeroCrossings(samples: Float32Array, threshold?: number, refMagnitude?: boolean, pad?: boolean, zeroPos?: boolean): Int32Array;
/**
 * Estimate the global tuning offset from a set of frequencies
 * (librosa.pitch_tuning). Returns a deviation in fractions of a bin.
 */
declare function pitchTuning(frequencies: Float32Array, resolution?: number, binsPerOctave?: number): number;
/**
 * Estimate the tuning offset of an audio signal (librosa.estimate_tuning).
 */
declare function estimateTuning(samples: Float32Array, sampleRate?: number, nFft?: number, hopLength?: number, resolution?: number, binsPerOctave?: number): number;
/**
 * Non-negative matrix factorisation of a flattened [nFeatures x nFrames]
 * spectrogram (librosa.decompose.decompose). Returns the W and H factors.
 */
declare function decompose(s: Float32Array, nFeatures: number, nFrames: number, nComponents: number, nIter?: number, beta?: number): WasmDecomposeResult;
/**
 * Nearest-neighbour filtering of a flattened [nFeatures x nFrames] spectrogram
 * (librosa.decompose.nn_filter).
 */
declare function nnFilter(s: Float32Array, nFeatures: number, nFrames: number, aggregate?: string, k?: number, width?: number): WasmMatrix2dResult;
/**
 * Reorder/concatenate a signal by interval slices (librosa.effects.remix).
 *
 * @param intervals - Flat (start, end) sample pairs (even length).
 */
declare function remix(samples: Float32Array, intervals: Int32Array | ArrayLike<number>, sampleRate?: number, alignZeros?: boolean): Float32Array;
/**
 * Phase-vocoder time-scale modification (rate > 1 faster, < 1 slower).
 */
declare function phaseVocoder(samples: Float32Array, rate: number, sampleRate?: number, nFft?: number, hopLength?: number): Float32Array;
/**
 * HPSS into harmonic / percussive / residual signals.
 */
declare function hpssWithResidual(samples: Float32Array, sampleRate?: number, kernelHarmonic?: number, kernelPercussive?: number): WasmHpssWithResidualResult;
/**
 * Channel-weighted multichannel integrated loudness + LRA (ITU-R BS.1770 /
 * EBU R128) from an interleaved buffer of `frames * channels` samples. The
 * per-channel frame count is derived from the buffer length and `channels`.
 */
declare function lufsInterleaved(samples: Float32Array, channels: number, sampleRate?: number): WasmLufsResult;
/**
 * Standards-compliant EBU R128 loudness range (LRA) in LU.
 */
declare function ebur128LoudnessRange(samples: Float32Array, sampleRate?: number): number;
/**
 * Compute spectral bandwidth.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param nFft - FFT size (default: 2048)
 * @param hopLength - Hop length (default: 512)
 * @returns Spectral bandwidth in Hz for each frame
 */
declare function spectralBandwidth(samples: Float32Array, sampleRate?: number, nFft?: number, hopLength?: number): Float32Array;
/**
 * Compute spectral rolloff frequency.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param nFft - FFT size (default: 2048)
 * @param hopLength - Hop length (default: 512)
 * @param rollPercent - Percentage threshold (default: 0.85)
 * @returns Rolloff frequency in Hz for each frame
 */
declare function spectralRolloff(samples: Float32Array, sampleRate?: number, nFft?: number, hopLength?: number, rollPercent?: number): Float32Array;
/**
 * Compute spectral flatness.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param nFft - FFT size (default: 2048)
 * @param hopLength - Hop length (default: 512)
 * @returns Spectral flatness for each frame (0 = tonal, 1 = noise-like)
 */
declare function spectralFlatness(samples: Float32Array, sampleRate?: number, nFft?: number, hopLength?: number): Float32Array;
/**
 * Compute zero crossing rate.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param frameLength - Frame length (default: 2048)
 * @param hopLength - Hop length (default: 512)
 * @returns Zero crossing rate for each frame
 */
declare function zeroCrossingRate(samples: Float32Array, sampleRate?: number, frameLength?: number, hopLength?: number): Float32Array;
/**
 * Compute RMS energy.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param frameLength - Frame length (default: 2048)
 * @param hopLength - Hop length (default: 512)
 * @returns RMS energy for each frame
 */
declare function rmsEnergy(samples: Float32Array, sampleRate?: number, frameLength?: number, hopLength?: number): Float32Array;
/**
 * Detect pitch using YIN algorithm.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param frameLength - Frame length (default: 2048)
 * @param hopLength - Hop length (default: 512)
 * @param fmin - Minimum frequency in Hz (default: 65)
 * @param fmax - Maximum frequency in Hz (default: 2093)
 * @param threshold - YIN threshold (default: 0.3)
 * @param fillNa - If true, return 0 for unvoiced f0 frames; otherwise keep NaN (default: false)
 * @returns Pitch detection result
 */
declare function pitchYin(samples: Float32Array, sampleRate?: number, frameLength?: number, hopLength?: number, fmin?: number, fmax?: number, threshold?: number, fillNa?: boolean): PitchResult;
/**
 * Detect pitch using pYIN algorithm (probabilistic YIN with HMM smoothing).
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param frameLength - Frame length (default: 2048)
 * @param hopLength - Hop length (default: 512)
 * @param fmin - Minimum frequency in Hz (default: 65)
 * @param fmax - Maximum frequency in Hz (default: 2093)
 * @param threshold - YIN threshold (default: 0.3)
 * @param fillNa - If true, return 0 for unvoiced f0 frames; otherwise keep NaN (default: false)
 * @returns Pitch detection result
 */
declare function pitchPyin(samples: Float32Array, sampleRate?: number, frameLength?: number, hopLength?: number, fmin?: number, fmax?: number, threshold?: number, fillNa?: boolean): PitchResult;
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
 * @param sr - Sample rate in Hz (default: 22050)
 * @param hopLength - Hop length in samples (default: 512)
 * @returns Time in seconds
 */
declare function framesToTime(frames: number, sr?: number, hopLength?: number): number;
/**
 * Convert time in seconds to frame index.
 *
 * @param time - Time in seconds
 * @param sr - Sample rate in Hz (default: 22050)
 * @param hopLength - Hop length in samples (default: 512)
 * @returns Frame index
 */
declare function timeToFrames(time: number, sr?: number, hopLength?: number): number;
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
declare function padCenter(values: Float32Array, targetSize: number, padValue?: number): Float32Array;
declare function fixLength(values: Float32Array, targetSize: number, padValue?: number): Float32Array;
declare function fixFrames(frames: Int32Array, xMin?: number, xMax?: number, pad?: boolean): Int32Array;
declare function peakPick(values: Float32Array, preMax: number, postMax: number, preAvg: number, postAvg: number, delta: number, wait: number): Int32Array;
declare function vectorNormalize(values: Float32Array, normType?: number, threshold?: number): Float32Array;
declare function pcen(values: Float32Array, nBins: number, nFrames: number, options?: Record<string, number>): Float32Array;
declare function tonnetz(chromagram: Float32Array, nChroma: number, nFrames: number): Float32Array;
declare function tempogram(onsetEnvelope: Float32Array, sampleRate?: number, hopLength?: number, winLength?: number, mode?: TempogramMode): WasmTempogramResult;
declare function cyclicTempogram(onsetEnvelope: Float32Array, sampleRate?: number, hopLength?: number, winLength?: number, bpmMin?: number, nBins?: number): WasmCyclicTempogramResult;
declare function plp(onsetEnvelope: Float32Array, sampleRate?: number, hopLength?: number, tempoMin?: number, tempoMax?: number, winLength?: number): Float32Array;
/**
 * Compute NNLS (non-negative least squares) chromagram.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @returns NNLS chroma result
 */
declare function nnlsChroma(samples: Float32Array, sampleRate?: number): WasmNnlsChromaResult;
/**
 * Compute the Constant-Q Transform magnitude.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param hopLength - Hop length (default: 512)
 * @param fmin - Minimum frequency in Hz (default: 32.70319566257483, C1)
 * @param nBins - Number of frequency bins (default: 84)
 * @param binsPerOctave - Bins per octave (default: 12)
 * @returns CQT magnitude result
 */
declare function cqt(samples: Float32Array, sampleRate?: number, hopLength?: number, fmin?: number, nBins?: number, binsPerOctave?: number): CqtResult;
/**
 * Compute the Variable-Q Transform magnitude (gamma controls Q).
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param hopLength - Hop length (default: 512)
 * @param fmin - Minimum frequency in Hz (default: 32.70319566257483, C1)
 * @param nBins - Number of frequency bins (default: 84)
 * @param binsPerOctave - Bins per octave (default: 12)
 * @param gamma - Bandwidth offset; 0 is equivalent to CQT (default: 0)
 * @returns VQT magnitude result (same shape as CQT)
 */
declare function vqt(samples: Float32Array, sampleRate?: number, hopLength?: number, fmin?: number, nBins?: number, binsPerOctave?: number, gamma?: number): CqtResult;
/**
 * Detect song-structure sections (intro/verse/chorus/...).
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param nFft - FFT size (default: 2048)
 * @param hopLength - Hop length (default: 512)
 * @param minSectionSec - Minimum section duration in seconds (default: 4.0)
 * @returns Array of detected sections
 */
declare function analyzeSections(samples: Float32Array, sampleRate?: number, nFft?: number, hopLength?: number, minSectionSec?: number): Section[];
/**
 * Extract the melody contour from monophonic audio via YIN.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param fmin - Minimum frequency in Hz (default: 65.0)
 * @param fmax - Maximum frequency in Hz (default: 2093.0)
 * @param frameLength - Frame length in samples (default: 2048)
 * @param hopLength - Hop length (default: 512)
 * @param threshold - YIN threshold; lower is stricter (default: 0.1)
 * @returns Melody contour with per-frame pitch points and summary stats
 */
declare function analyzeMelody(samples: Float32Array, sampleRate?: number, fmin?: number, fmax?: number, frameLength?: number, hopLength?: number, threshold?: number): MelodyResult;
/**
 * Compute the onset strength envelope.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param nFft - FFT size (default: 2048)
 * @param hopLength - Hop length (default: 512)
 * @param nMels - Number of Mel bands (default: 128)
 * @returns Onset envelope for each frame
 */
declare function onsetEnvelope(samples: Float32Array, sampleRate?: number, nFft?: number, hopLength?: number, nMels?: number): Float32Array;
/**
 * Compute the Fourier tempogram from an onset envelope.
 *
 * @param onsetEnvelope - Onset strength envelope (float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param hopLength - Hop length (default: 512)
 * @param winLength - Window length in frames (default: 384)
 * @returns Fourier tempogram result
 */
declare function fourierTempogram(onsetEnvelope: Float32Array, sampleRate?: number, hopLength?: number, winLength?: number): WasmFourierTempogramResult;
/**
 * Compute tempogram ratio features.
 *
 * @param tempogramData - Tempogram data (float32)
 * @param winLength - Window length in frames (default: 384)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param hopLength - Hop length (default: 512)
 * @returns Tempogram ratio features
 */
declare function tempogramRatio(tempogramData: Float32Array, winLength?: number, sampleRate?: number, hopLength?: number): Float32Array;
/**
 * Measure loudness (EBU R128 / ITU-R BS.1770).
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @returns Loudness measurement result
 */
declare function lufs(samples: Float32Array, sampleRate?: number, options?: ValidateOptions): LufsResult;
/**
 * Compute the momentary loudness (LUFS) over time.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @returns Momentary LUFS values over time
 */
declare function momentaryLufs(samples: Float32Array, sampleRate?: number, options?: ValidateOptions): Float32Array;
/**
 * Compute the short-term loudness (LUFS) over time.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @returns Short-term LUFS values over time
 */
declare function shortTermLufs(samples: Float32Array, sampleRate?: number, options?: ValidateOptions): Float32Array;
/** One contiguous run of clipped samples reported by `meteringDetectClipping`. */
interface ClippingRegion {
    startSample: number;
    endSample: number;
    length: number;
    peak: number;
}
/** Aggregated clipping report. */
interface ClippingReport {
    clippedSamples: number;
    clippingRatio: number;
    maxClippedPeak: number;
    regions: ClippingRegion[];
}
/** Sliding-window dynamic range report. */
interface DynamicRangeReport {
    dynamicRangeDb: number;
    lowPercentileDb: number;
    highPercentileDb: number;
    windowRmsDb: Float32Array;
}
declare function meteringPeakDb(samples: Float32Array, sampleRate?: number, options?: ValidateOptions): number;
declare function meteringRmsDb(samples: Float32Array, sampleRate?: number, options?: ValidateOptions): number;
declare function meteringCrestFactorDb(samples: Float32Array, sampleRate?: number, options?: ValidateOptions): number;
declare function meteringDcOffset(samples: Float32Array, sampleRate?: number, options?: ValidateOptions): number;
/**
 * Inter-sample (true) peak in dBFS. `oversampleFactor` must be a power of two
 * in [1, 16]; pass 0 to use the library default (4).
 */
declare function meteringTruePeakDb(samples: Float32Array, sampleRate?: number, oversampleFactor?: number, options?: ValidateOptions): number;
/**
 * Detect contiguous runs of clipped samples.
 *
 * @param threshold Linear absolute threshold (default 0.999).
 * @param minRegionSamples Minimum run length to report (default 1).
 */
declare function meteringDetectClipping(samples: Float32Array, sampleRate?: number, threshold?: number, minRegionSamples?: number, options?: ValidateOptions): ClippingReport;
/**
 * Sliding-window dynamic range. Pass 0 for any parameter to use the library
 * default (window=3 s, hop=1 s, low=0.10, high=0.95).
 */
declare function meteringDynamicRange(samples: Float32Array, sampleRate?: number, windowSec?: number, hopSec?: number, lowPercentile?: number, highPercentile?: number, options?: ValidateOptions): DynamicRangeReport;
/** Mid/side vectorscope point series for a (left, right) stereo pair. */
interface VectorscopeReport {
    mid: Float32Array;
    side: Float32Array;
}
/** Phase-scope (Lissajous) point series plus summary stats. */
interface PhaseScopeReport {
    mid: Float32Array;
    side: Float32Array;
    radius: Float32Array;
    angleRad: Float32Array;
    correlation: number;
    averageAbsAngleRad: number;
    maxRadius: number;
}
/** Options for `meteringSpectrum`. */
interface SpectrumOptions {
    /** FFT size. Pass 0 / omit for the library default (2048). */
    nFft?: number;
    /** Apply fractional-octave smoothing to magnitude. */
    applyOctaveSmoothing?: boolean;
    /** Smoothing fraction (e.g. 3 = 1/3-octave). 0 / omit = library default (3). */
    octaveFraction?: number;
    /** Linear reference for the dB conversion. 0 / omit = 1.0. */
    dbRef?: number;
    /** Linear floor used to avoid log(0). 0 / omit = library default. */
    dbAmin?: number;
}
/** Single-frame magnitude / power / dB spectrum returned by `meteringSpectrum`. */
interface SpectrumReport {
    frequencies: Float32Array;
    magnitude: Float32Array;
    power: Float32Array;
    db: Float32Array;
    nFft: number;
    sampleRate: number;
}
/** Pearson correlation in [-1, 1] between two equal-length channels. */
declare function meteringStereoCorrelation(left: Float32Array, right: Float32Array, sampleRate?: number, options?: ValidateOptions): number;
/** Side / mid energy ratio: 0 = pure mono, ~1 = wide stereo. */
declare function meteringStereoWidth(left: Float32Array, right: Float32Array, sampleRate?: number, options?: ValidateOptions): number;
/** Per-sample mid/side point series (one entry per input frame). */
declare function meteringVectorscope(left: Float32Array, right: Float32Array, sampleRate?: number, options?: ValidateOptions): VectorscopeReport;
/** Phase-scope point series plus summary stats. */
declare function meteringPhaseScope(left: Float32Array, right: Float32Array, sampleRate?: number, options?: ValidateOptions): PhaseScopeReport;
/** Single-frame spectrum view (uses the first `nFft` samples of `samples`). */
declare function meteringSpectrum(samples: Float32Array, sampleRate?: number, options?: SpectrumOptions & ValidateOptions): SpectrumReport;
/**
 * Snap a MIDI value to the nearest pitch class enabled by `modeMask`.
 *
 * `modeMask` is a 12-bit mask. For natural C major use `0b101010110101`.
 * `referenceMidi` defaults to A4 (69) when passed as 0.
 */
declare function scaleQuantizeMidi(root: number, modeMask: number, midi: number, referenceMidi?: number): number;
declare function scaleCorrectionSemitones(root: number, modeMask: number, midi: number, referenceMidi?: number): number;
declare function scalePitchClassEnabled(root: number, modeMask: number, pitchClass: number): boolean;
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
    detectKey(options?: KeyDetectionOptions): Key;
    detectKeyCandidates(options?: KeyDetectionOptions): KeyCandidate[];
    detectOnsets(): Float32Array;
    detectBeats(): Float32Array;
    detectDownbeats(): Float32Array;
    detectChords(options?: ChordDetectionOptions): ChordAnalysisResult;
    analyze(): AnalysisResult;
    analyzeWithProgress(onProgress: ProgressCallback): AnalysisResult;
    hpss(kernelHarmonic?: number, kernelPercussive?: number): HpssResult;
    harmonic(): Float32Array;
    percussive(): Float32Array;
    timeStretch(rate: number): Float32Array;
    pitchShift(semitones: number): Float32Array;
    pitchCorrectToMidi(currentMidi?: number, targetMidi?: number): Float32Array;
    noteStretch(onsetSample?: number, offsetSample?: number, stretchRatio?: number): Float32Array;
    voiceChange(pitchSemitones?: number, formantFactor?: number): Float32Array;
    normalize(targetDb?: number): Float32Array;
    mastering(targetLufs?: number, ceilingDb?: number, truePeakOversample?: number): MasteringResult;
    masteringChain(config: MasteringChainConfig): MasteringChainResult;
    masterAudio(presetName: MasteringPreset, overrides?: Record<string, number | boolean> | null): MasteringChainResult;
    masteringProcess(processorName: SoloProcessor, params?: MasteringProcessorParams): MasteringResult;
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
    readFramesU8(maxFrames: number): StreamFramesU8;
    readFramesI16(maxFrames: number): StreamFramesI16;
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

export { type AcousticResult, type AnalysisResult, type AnalyzerStats, Audio, type AutomationCurve, type BarChord, type Beat, type BpmAnalysisResult, type BpmCandidate, type Chord, type ChordAnalysisResult, type ChordChange, type ChordDetectionOptions, ChordQuality, type ChromaResult, type ClippingRegion, type ClippingReport, type CompressorDetector, type CompressorOptions, type CqtResult, type DeclickOptions, type DeclipOptions, type DecomposeResult, type DecrackleMode, type DecrackleOptions, type DehumOptions, type DenoiseClassicalMode, type DenoiseClassicalNoiseEstimator, type DenoiseClassicalOptions, type DereverbClassicalOptions, type DynamicRangeReport, type Dynamics, type DynamicsAnalysisResult, type DynamicsResult, EXPECTED_ENGINE_ABI_VERSION, type EngineAutomationPoint, type EngineBounceOptions, type EngineBounceResult, type EngineCapabilities, type EngineCaptureStatus, type EngineClip, type EngineFreezeOptions, type EngineFreezeResult, type EngineGraphSpec, type EngineMarker, type EngineMeterTelemetry, type EngineMetronomeConfig, type EngineParameterInfo, type EngineTelemetry, type EngineTransportState, type EqBand, type EqBandPhase, type EqBandType, type EqCoeffMode, type EqMatchOptions, type EqSpectrumSnapshot, type EqStereoPlacement, type FrameBuffer, type GateOptions, type GoniometerPoint, type HpssResult, type HpssWithResidualResult, type Key, type KeyCandidate, type KeyDetectionOptions, KeyProfile, type KeyProfileName, type LufsResult, type MasteringChainConfig, type MasteringChainResult, type MasteringPreset, type MasteringProcessorParams, type MasteringResult, type MasteringStereoChainResult, type MasteringStereoResult, type Matrix2dResult, type MelSpectrogramResult, type MelodyPoint, type MelodyResult, type MeterTap, type MfccResult, type MixMeterSnapshot, type MixOptions, type MixResult, Mixer, type MixerProcessResult, type MixerRealtimeBuffer, Mode, type PairAnalysis, type PairProcessor, type PanLaw, type PanMode, type PatternScore, type PhaseScopeReport, PitchClass as Pitch, PitchClass, type PitchResult, type ProgressiveEstimate, RealtimeEngine, RealtimeVoiceChanger, type RealtimeVoiceChangerConfigInput, type RealtimeVoiceChangerInterleavedBuffer, type RealtimeVoiceChangerMonoBuffer, type RealtimeVoiceChangerPlanarBuffer, type RhythmAnalysisResult, type RhythmFeatures, type Section, SectionType, type SendTiming, type SoloProcessor, type SpectrumOptions, type SpectrumReport, type StereoAnalysis, type StftResult, StreamAnalyzer, type StreamConfig, type StreamFramesI16, type StreamFramesU8, StreamingEqualizer, type StreamingEqualizerConfig, StreamingMasteringChain, type StreamingPlatform, StreamingRetune, type StreamingRetuneConfig, type Timbre, type TimbreAnalysisResult, type TimbreFrame, type TimeSignature, type TransientShaperOptions, type TrimSilenceMode, type TrimSilenceOptions, type ValidateOptions, type VectorscopeReport, type VoicePresetId, amplitudeToDb, analyze, analyzeBpm, analyzeDynamics, analyzeImpulseResponse, analyzeMelody, analyzeRhythm, analyzeSections, analyzeTimbre, analyzeWithProgress, chroma, cqt, cyclicTempogram, dbToAmplitude, dbToPower, decompose, deemphasis, detectAcoustic, detectBeats, detectBpm, detectChords, detectDownbeats, detectKey, detectKeyCandidates, detectOnsets, ebur128LoudnessRange, engineAbiVersion, engineCapabilities, estimateTuning, fixFrames, fixLength, fourierTempogram, frameSignal, framesToSamples, framesToTime, harmonic, hasFfmpegSupport, hpss, hpssWithResidual, hzToMel, hzToMidi, hzToNote, init, isInitialized, lufs, lufsInterleaved, masterAudio, masterAudioStereo, masterAudioStereoWithProgress, masterAudioWithProgress, mastering, masteringAssistantSuggest, masteringAudioProfile, masteringChain, masteringChainStereo, masteringChainStereoWithProgress, masteringChainWithProgress, masteringDynamicsCompressor, masteringDynamicsGate, masteringDynamicsTransientShaper, masteringPairAnalysisNames, masteringPairAnalyze, masteringPairProcess, masteringPairProcessorNames, masteringPresetNames, masteringProcess, masteringProcessStereo, masteringProcessorNames, masteringRepairDeclick, masteringRepairDeclip, masteringRepairDecrackle, masteringRepairDehum, masteringRepairDenoiseClassical, masteringRepairDereverbClassical, masteringRepairTrimSilence, masteringStereoAnalysisNames, masteringStereoAnalyze, masteringStreamingPreview, melSpectrogram, melToAudio, melToHz, melToStft, meteringCrestFactorDb, meteringDcOffset, meteringDetectClipping, meteringDynamicRange, meteringPeakDb, meteringPhaseScope, meteringRmsDb, meteringSpectrum, meteringStereoCorrelation, meteringStereoWidth, meteringTruePeakDb, meteringVectorscope, mfcc, mfccToAudio, mfccToMel, midiToHz, mixStereo, mixingScenePresetJson, mixingScenePresetNames, momentaryLufs, nnFilter, nnlsChroma, normalize, noteStretch, noteToHz, onsetEnvelope, padCenter, pcen, peakPick, percussive, phaseVocoder, pitchCorrectToMidi, pitchPyin, pitchShift, pitchTuning, pitchYin, plp, polyFeatures, powerToDb, preemphasis, realtimeVoiceChangerPresetConfig, realtimeVoiceChangerPresetJson, realtimeVoiceChangerPresetNames, remix, resample, rmsEnergy, samplesToFrames, scaleCorrectionSemitones, scalePitchClassEnabled, scaleQuantizeMidi, shortTermLufs, spectralBandwidth, spectralCentroid, spectralContrast, spectralFlatness, spectralRolloff, splitSilence, stft, stftDb, tempogram, tempogramRatio, timeStretch, timeToFrames, tonnetz, trim, trimSilence, validateRealtimeVoiceChangerPresetJson, vectorNormalize, version, voiceChange, voiceChangerAbiVersion, voiceCharacterPresetId, vqt, zeroCrossingRate, zeroCrossings };
