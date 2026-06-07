import { ProgressCallback, WasmNnlsChromaResult, WasmFourierTempogramResult, WasmCyclicTempogramResult, WasmFrameResult, WasmTempogramResult, WasmTrimResult, WasmDecomposeResult, WasmHpssWithResidualResult, WasmLufsResult, WasmMatrix2dResult, WasmEngineAutomationPoint, WasmEngineBounceOptions, WasmEngineBounceResult, WasmEngineCaptureStatus, WasmEngineClip, WasmEngineFreezeOptions, WasmEngineFreezeResult, WasmEngineGraphSpec, WasmEngineMarker, WasmEngineMeterTelemetry, WasmEngineMetronomeConfig, WasmEngineParameterInfo, WasmEngineTelemetry, WasmEngineTransportState, WasmClipPageRequest, WasmEngineProcessWithMonitorResult } from './sonare.js';

/**
 * Per-call validation options accepted by guarded wrappers. Empty-buffer
 * checks are always performed; pass `{ validate: false }` to opt out of the
 * O(n) NaN/Inf scan on hot paths.
 */
interface ValidateOptions {
    validate?: boolean;
}

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
type SoloProcessor = 'dynamics.brickwallLimiter' | 'dynamics.compressor' | 'dynamics.deesser' | 'dynamics.expander' | 'dynamics.gate' | 'dynamics.limiter' | 'dynamics.parallelComp' | 'dynamics.sidechainRouter' | 'dynamics.duckingProcessor' | 'dynamics.transientShaper' | 'dynamics.upwardCompressor' | 'dynamics.upwardExpander' | 'dynamics.vocalRider' | 'eq.apiStyle' | 'eq.bandPass' | 'eq.cutFilter' | 'eq.dynamic' | 'eq.equalizer' | 'eq.graphic' | 'eq.linearPhase' | 'eq.midSide' | 'eq.minimumPhase' | 'eq.parametric' | 'eq.pultec' | 'eq.shelving' | 'eq.tilt' | 'final.bitDepth' | 'final.dither' | 'final.outputChain' | 'maximizer.adaptiveRelease' | 'maximizer.loudnessOptimize' | 'maximizer.maximizer' | 'maximizer.softKneeMax' | 'maximizer.truePeakLimiter' | 'multiband.compressor' | 'multiband.dynamicEq' | 'multiband.expander' | 'multiband.imager' | 'multiband.limiter' | 'multiband.saturation' | 'repair.declick' | 'repair.declip' | 'repair.decrackle' | 'repair.dehum' | 'repair.denoiseClassical' | 'repair.dereverbClassical' | 'repair.trimSilence' | 'saturation.bitcrusher' | 'saturation.exciter' | 'saturation.hardClipper' | 'saturation.multibandExciter' | 'saturation.ampSim' | 'saturation.softClipper' | 'saturation.tape' | 'saturation.transformer' | 'saturation.tube' | 'saturation.waveshaper' | 'spectral.airBand' | 'spectral.lowEndFocus' | 'spectral.presenceEnhancer' | 'spectral.spectralShaper' | 'stereo.autoPan' | 'stereo.haasEnhancer' | 'stereo.imager' | 'stereo.monoMaker' | 'stereo.phaseAlign' | 'stereo.stereoBalance';
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
interface KeyDetectionOptions extends ValidateOptions {
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
interface ChordDetectionOptions extends ValidateOptions {
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
/** Options for `detectAcoustic`. All fields are optional. */
interface AcousticOptions extends ValidateOptions {
    /** Number of octave bands. Default 6. */
    nOctaveBands?: number;
    /** Number of 1/3-octave sub-bands. Default 24. */
    nThirdOctaveSubbands?: number;
    /** Minimum decay range (dB) for a valid RT60 fit. Default 30. */
    minDecayDb?: number;
    /** Margin (dB) above the noise floor for the decay fit. Default 10. */
    noiseFloorMarginDb?: number;
}
/** Options for `analyzeBpm`. All fields are optional. */
interface AnalyzeBpmOptions extends ValidateOptions {
    /** Lowest BPM to consider. Default 30. */
    bpmMin?: number;
    /** Highest BPM to consider. Default 300. */
    bpmMax?: number;
    /** Tempo prior the tracker is biased toward. Default 120. */
    startBpm?: number;
    /** FFT size for the onset envelope. Default 2048. */
    nFft?: number;
    /** Hop length for the onset envelope. Default 512. */
    hopLength?: number;
    /** Number of tempo candidates to return. Default 5. */
    maxCandidates?: number;
}
/** Options for `analyzeRhythm`. All fields are optional. */
interface AnalyzeRhythmOptions extends ValidateOptions {
    /** Lowest BPM to consider. Default 60. */
    bpmMin?: number;
    /** Highest BPM to consider. Default 200. */
    bpmMax?: number;
    /** Tempo prior the tracker is biased toward. Default 120. */
    startBpm?: number;
    /** FFT size for the onset envelope. Default 2048. */
    nFft?: number;
    /** Hop length for the onset envelope. Default 512. */
    hopLength?: number;
}
/** Options for `analyzeDynamics`. All fields are optional. */
interface AnalyzeDynamicsOptions extends ValidateOptions {
    /** Loudness-curve window length in seconds. Default 0.4. */
    windowSec?: number;
    /** Hop length for the loudness curve. Default 512. */
    hopLength?: number;
    /** Crest-factor (dB) below which the signal is flagged as compressed. Default 6. */
    compressionThreshold?: number;
}
/** Options for `analyzeTimbre`. All fields are optional. */
interface AnalyzeTimbreOptions extends ValidateOptions {
    /** FFT size. Default 2048. */
    nFft?: number;
    /** Hop length. Default 512. */
    hopLength?: number;
    /** Number of Mel bands. Default 128. */
    nMels?: number;
    /** Number of MFCCs. Default 13. */
    nMfcc?: number;
    /** Per-window analysis length in seconds. Default 0.5. */
    windowSec?: number;
}
/** Options for `analyzeSections`. All fields are optional. */
interface AnalyzeSectionsOptions {
    /** FFT size. Default 2048. */
    nFft?: number;
    /** Hop length. Default 512. */
    hopLength?: number;
    /** Minimum section duration in seconds. Default 4. */
    minSectionSec?: number;
}
/** Options for `mastering`. All fields are optional. */
interface MasteringOptions {
    /** Target integrated LUFS. Default -14. */
    targetLufs?: number;
    /** True/sample peak ceiling in dBFS. Default -1. */
    ceilingDb?: number;
    /** Oversampling factor used for peak estimation. Default 4. */
    truePeakOversample?: number;
}
/** Options for `noteStretch`. All fields are optional. */
interface NoteStretchOptions {
    /** Note onset position in samples (selects the region). Default 0. */
    onsetSample?: number;
    /** Note offset position in samples (selects the region). Default 0. */
    offsetSample?: number;
    /** Stretch ratio (0.5 = double duration, 2.0 = half duration). Default 1. */
    stretchRatio?: number;
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
 * Multi-band onset strength matrix result.
 */
interface OnsetStrengthMultiResult {
    nBands: number;
    nFrames: number;
    data: Float32Array;
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
    peakDb: number;
    rmsDb: number;
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
    tempoStability: number;
    timeSignature: TimeSignature;
}
/**
 * Melody contour from the unified analysis (pitch trajectory + summary stats).
 */
interface MelodyContour {
    pitchRangeOctaves: number;
    pitchStability: number;
    meanFrequency: number;
    vibratoRate: number;
    pitches: MelodyPoint[];
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
    melody: MelodyContour;
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
/** Shoebox geometry + placement shared by RIR synthesis and the room morph. */
interface RoomGeometryOptions {
    lengthM?: number;
    widthM?: number;
    heightM?: number;
    /** Uniform wall absorption, clamped to [0, 0.999] (the back-compat scalar). */
    absorption?: number;
    /**
     * Optional per-octave-band wall absorption (125/250/500/1k/2k/4k.. Hz). When
     * provided it overrides `absorption` unless `materialPreset` is set.
     */
    bandAbsorption?: Float32Array | number[];
    /** Optional per-band wall scattering; missing bands default to 0. */
    bandScattering?: Float32Array | number[];
    /**
     * Named wall-material preset (0 none; 1 concrete, 2 wood, 3 curtain,
     * 4 carpet, 5 glass). A non-zero preset wins over `bandAbsorption`/`absorption`.
     */
    materialPreset?: number;
    sourceX?: number;
    sourceY?: number;
    sourceZ?: number;
    listenerX?: number;
    listenerY?: number;
    listenerZ?: number;
    ismOrder?: number;
    seed?: number;
    maxSeconds?: number;
}
interface RirSynthOptions extends RoomGeometryOptions {
    sampleRate?: number;
    /** Use the Eyring statistical late-tail model (default true); false = Sabine. */
    preferEyring?: boolean;
    /** Early/late crossover in ms (0 = auto, ~sqrt(V) ms). */
    mixingTimeMs?: number;
    /** Equal-power crossfade width around the mixing time in ms (0 = default). */
    crossfadeMs?: number;
}
interface RirResult {
    rir: Float32Array;
    sampleRate: number;
    hasError: boolean;
}
interface RoomEstimateOptions {
    aspectHintLw?: number;
    aspectHintLh?: number;
    referenceAbsorption?: number;
    preferEyring?: boolean;
    nOctaveBands?: number;
    /** Analyzer routing: 0 = auto, 1 = blind, 2 = impulse-response. */
    mode?: number;
    /** Analyzer decay-fit span in dB (0 = library default). */
    minDecayDb?: number;
    /** Analyzer noise-floor margin in dB (0 = library default). */
    noiseFloorMarginDb?: number;
}
interface RoomEstimateResult {
    volume: number;
    length: number;
    width: number;
    height: number;
    drrDb: number;
    confidence: number;
    absorptionBands: Float32Array;
    rt60Bands: Float32Array;
}
interface RoomMorphOptions extends RoomGeometryOptions {
    wet?: number;
    sourceTailSuppression?: number;
    /**
     * Use the Eyring statistical late-tail model for the target room (default
     * true); false = Sabine. Matches {@link RirSynthOptions.preferEyring}.
     */
    preferEyring?: boolean;
    /** Early/late crossover in ms (0 = auto, ~sqrt(V) ms). */
    mixingTimeMs?: number;
    /** Equal-power crossfade width around the mixing time in ms (0 = default). */
    crossfadeMs?: number;
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
/**
 * Configuration for the block-by-block {@link StreamingMasteringChain}.
 *
 * Extends {@link MasteringChainConfig} with optional precomputed loudness
 * parameters. The streaming chain cannot measure whole-signal integrated LUFS,
 * so an enabled `loudness` stage normally throws at construction. To let a
 * preset's streaming preview match its offline render, the caller may
 * precompute the loudness normalization gain offline (e.g.
 * `targetLufs - measuredIntegratedLufs`) and supply it here.
 */
interface StreamingMasteringChainConfig extends MasteringChainConfig {
    /**
     * Precomputed static loudness gain in dB. When omitted (the default), an
     * enabled `loudness` stage still throws. When provided and `loudness.enabled`
     * is set, the chain applies this fixed gain per block before the loudness
     * stage's true-peak limiter instead of throwing.
     */
    loudnessStaticGainDb?: number;
    /**
     * Offline-measured true-peak (dBFS) of the source the static gain was
     * computed for. When provided, the static gain is clamped to
     * `loudness.ceilingDb - loudnessStaticGainPeakDb` so the streaming preview
     * does not drive the loudness limiter harder than the offline chain. When
     * omitted (the default) the static gain is applied verbatim.
     */
    loudnessStaticGainPeakDb?: number;
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
    /** Non-zero enables the 4x-oversampled inter-sample-peak limiter (default enabled). */
    limiter_enable_isp_limiter: boolean;
    /** True-peak ceiling in dBTP applied by the ISP limiter (default -1.0). */
    limiter_isp_ceiling_dbtp: number;
}
/** Options for {@link StreamingEqualizer.match}. */
interface EqMatchOptions {
    sampleRate?: number;
    maxBands?: number;
}

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
declare function harmonic(samples: Float32Array, sampleRate: number, options?: ValidateOptions): Float32Array;
/**
 * Extract percussive component from audio.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz
 * @returns Percussive component
 */
declare function percussive(samples: Float32Array, sampleRate: number, options?: ValidateOptions): Float32Array;
/**
 * Time-stretch audio without changing pitch.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz
 * @param rate - Time stretch rate (0.5 = double duration, 2.0 = half duration)
 * @returns Time-stretched audio
 */
declare function timeStretch(samples: Float32Array, sampleRate: number, rate: number, options?: ValidateOptions): Float32Array;
/**
 * Pitch-shift audio without changing duration.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz
 * @param semitones - Pitch shift in semitones (+12 = one octave up, -12 = one octave down)
 * @returns Pitch-shifted audio
 */
declare function pitchShift(samples: Float32Array, sampleRate: number, semitones: number, options?: ValidateOptions): Float32Array;
/**
 * Pitch-correct audio from a current MIDI note to a target MIDI note.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz
 * @param currentMidi - Detected/current MIDI note number
 * @param targetMidi - Desired MIDI note number
 * @returns Pitch-corrected audio
 */
declare function pitchCorrectToMidi(samples: Float32Array, sampleRate?: number, currentMidi?: number, targetMidi?: number, options?: ValidateOptions): Float32Array;
/**
 * Contour-following ("time-varying") pitch correction toward a MIDI target.
 *
 * Unlike {@link pitchCorrectToMidi} (a single constant transpose), this follows
 * the caller-supplied per-frame `f0Hz` contour and retunes every voiced frame
 * toward `targetMidi`, so vibrato/drift in the source is tracked rather than
 * flattened. `voiced` (non-zero = voiced) and `voicedProb` ([0,1]) are optional;
 * omitting them treats every frame as voiced.
 *
 * @param samples - Audio samples (mono, float32)
 * @param f0Hz - Per-frame measured F0 in Hz (one entry per analysis frame)
 * @param targetMidi - Desired MIDI note number
 * @param sampleRate - Sample rate in Hz
 * @param hopLength - F0 hop in samples (frame i covers sample i*hopLength)
 * @param voiced - Optional per-frame voiced flags (non-zero = voiced)
 * @param voicedProb - Optional per-frame voicing probability in [0, 1]
 * @returns Pitch-corrected audio
 */
declare function pitchCorrectToMidiTimevarying(samples: Float32Array, f0Hz: Float32Array, targetMidi: number, sampleRate?: number, hopLength?: number, voiced?: Int32Array, voicedProb?: Float32Array, options?: ValidateOptions): Float32Array;
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
declare function noteStretch(samples: Float32Array, sampleRate?: number, options?: NoteStretchOptions & ValidateOptions): Float32Array;
/** Options for {@link voiceChange}. All fields are optional. */
interface VoiceChangeOptions extends ValidateOptions {
    /** Pitch shift in semitones (negative = down). Default 0. */
    pitchSemitones?: number;
    /** Formant scale factor (>1 brightens, <1 darkens). Default 1. */
    formantFactor?: number;
}
/**
 * Apply a voice change by shifting pitch and formants independently.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz
 * @param options - Pitch/formant settings ({@link VoiceChangeOptions})
 * @returns Voice-changed audio
 */
declare function voiceChange(samples: Float32Array, sampleRate?: number, options?: VoiceChangeOptions): Float32Array;
/** Options for the offline {@link voiceChangeRealtime} convenience wrapper. */
interface VoiceChangeRealtimeOptions extends ValidateOptions {
    sampleRate?: number;
    /** Voice-changer preset id or full config object. */
    preset?: RealtimeVoiceChangerConfigInput;
    /** Channel count (1 = mono, 2 = interleaved stereo). */
    channels?: 1 | 2;
    /** Block size for the internal render loop (default 512). */
    blockSize?: number;
}
/**
 * Applies the realtime voice-changer chain to a whole buffer in one call.
 *
 * Constructs and prepares a {@link RealtimeVoiceChanger}, runs the block loop
 * for the caller, then disposes it — matching the Python `voice_change_realtime`
 * and Node `voiceChangeRealtime` convenience wrappers. For mono, `samples` is a
 * plain mono buffer; for stereo, `samples` is interleaved (L0,R0,L1,R1,...).
 *
 * @returns The processed buffer (same layout/length as the input).
 */
declare function voiceChangeRealtime(samples: Float32Array, options?: VoiceChangeRealtimeOptions): Float32Array;
/**
 * Normalize audio to target peak level.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz
 * @param targetDb - Target peak level in dB (default: 0 dB = full scale)
 * @returns Normalized audio
 */
declare function normalize(samples: Float32Array, sampleRate: number, targetDb?: number, options?: ValidateOptions): Float32Array;
/**
 * Apply mastering loudness normalization with a true-peak ceiling.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param options - Loudness/ceiling settings ({@link MasteringOptions})
 * @returns Processed audio and loudness metadata
 */
declare function mastering(samples: Float32Array, sampleRate?: number, options?: MasteringOptions): MasteringResult;
declare function masteringProcessorNames(): SoloProcessor[];
/**
 * Names of the insert processors the mastering chain can instantiate by name
 * (`mastering::api::insert_factory_names`). Mirrors the C-ABI
 * `sonare_mastering_insert_names` (which joins this list) as a `string[]`.
 */
declare function masteringInsertNames(): string[];
/**
 * Returns the camelCase parameter names a given insert / FX processor reads, for
 * tooling/validation. Any key NOT in this list is silently ignored by the
 * processor (and would be reported via {@link Mixer.sceneWarnings} when a scene
 * carrying it is loaded). Band/sub-band processors enumerate their indexed
 * `band{i}.<field>` keys. Returns an empty array for an unknown name (or one
 * whose insert needs an unavailable build feature, e.g. FX).
 *
 * @param name - Insert processor name (see {@link masteringInsertNames}).
 */
declare function masteringInsertParamNames(name: string): string[];
declare function masteringPairProcessorNames(): PairProcessor[];
declare function masteringPairAnalysisNames(): PairAnalysis[];
declare function masteringStereoAnalysisNames(): StereoAnalysis[];
declare function masteringProcess(processorName: SoloProcessor, samples: Float32Array, sampleRate?: number, params?: MasteringProcessorParams): MasteringResult;
declare function masteringProcessStereo(processorName: SoloProcessor, left: Float32Array, right: Float32Array, sampleRate?: number, params?: MasteringProcessorParams): MasteringStereoResult;
/**
 * Apply a two-input `match.*` processor. `source` and `reference` may have
 * independent lengths — the match primitives consume each buffer at its own
 * length.
 */
declare function masteringPairProcess(processorName: PairProcessor, source: Float32Array, reference: Float32Array, sampleRate?: number, params?: MasteringProcessorParams): MasteringResult;
/**
 * Analyze a `source` against a `reference` with a two-input analysis. The two
 * buffers may have independent lengths.
 */
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
declare function masterAudio(samples: Float32Array, sampleRate?: number, presetName?: MasteringPreset, overrides?: Record<string, number | boolean>): MasteringChainResult;
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
declare function masterAudioStereo(left: Float32Array, right: Float32Array, sampleRate?: number, presetName?: MasteringPreset, overrides?: Record<string, number | boolean>): MasteringStereoChainResult;
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
/**
 * One-shot stereo mix of multiple strips through the routing graph + master bus.
 *
 * Each returned per-strip meter reflects only this single one-shot block. The
 * integrating-meter fields (`momentaryLufs`, `shortTermLufs`, `integratedLufs`
 * and the true-peak fields) require sustained streaming to populate; on a short
 * one-shot mix they read the -120 dB floor sentinel. Drive a streaming
 * {@link Mixer} block-by-block if you need meaningful loudness/true-peak
 * readings.
 *
 * @param leftChannels - Per-strip left input buffers (all the same length)
 * @param rightChannels - Per-strip right input buffers (all the same length)
 * @param sampleRate - Sample rate in Hz
 * @param options - Per-strip mix options (trim, fader, pan, width, mute)
 */
declare function mixStereo(leftChannels: Float32Array[], rightChannels: Float32Array[], sampleRate?: number, options?: MixOptions): MixResult;

type BrowserDecodeContext = Pick<BaseAudioContext, 'decodeAudioData' | 'sampleRate'>;
interface BrowserAudioDecodeOptions {
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
 * Wrapper around audio data that exposes all analysis and feature functions as instance methods.
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
declare class Audio {
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
    chordFunctionalAnalysis(keyRoot: PitchClass, keyMode: Mode, options?: ChordDetectionOptions): string[];
    analyze(): AnalysisResult;
    analyzeWithProgress(onProgress: ProgressCallback): AnalysisResult;
    hpss(kernelHarmonic?: number, kernelPercussive?: number): HpssResult;
    harmonic(): Float32Array;
    percussive(): Float32Array;
    timeStretch(rate: number): Float32Array;
    pitchShift(semitones: number): Float32Array;
    pitchCorrectToMidi(currentMidi?: number, targetMidi?: number): Float32Array;
    noteStretch(options?: NoteStretchOptions): Float32Array;
    voiceChange(options?: VoiceChangeOptions): Float32Array;
    normalize(targetDb?: number): Float32Array;
    mastering(options?: MasteringOptions): MasteringResult;
    masteringChain(config: MasteringChainConfig): MasteringChainResult;
    masterAudio(presetName?: MasteringPreset, overrides?: Record<string, number | boolean> | null): MasteringChainResult;
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
}

/**
 * Numeric error codes carried by a {@link SonareError}. Mirrors the C ABI
 * `SonareError` enum (and the Node / Python surfaces), so the same failure
 * reports the same numeric code on every binding.
 */
declare enum ErrorCode {
    Ok = 0,
    FileNotFound = 1,
    InvalidFormat = 2,
    DecodeFailed = 3,
    InvalidParameter = 4,
    OutOfMemory = 5,
    NotSupported = 6,
    InvalidState = 7,
    Unknown = 99
}
/**
 * Error thrown by libsonare on a native (C++) failure. Carries a numeric
 * {@link ErrorCode} `code` plus its canonical `codeName`, so callers can branch
 * on the cause instead of matching message text.
 */
declare class SonareError extends Error {
    /** Numeric error code, equal to an {@link ErrorCode} value. */
    readonly code: number;
    /** Canonical name of `code`, e.g. `'InvalidParameter'`. */
    readonly codeName: string;
    constructor(code: number, codeName: string, message: string);
}
/** Type guard: whether a caught value is a libsonare {@link SonareError}. */
declare function isSonareError(value: unknown): value is SonareError;

type GuardedOptions$2 = ValidateOptions;
type AnalyzeSectionsGuardedOptions = AnalyzeSectionsOptions & ValidateOptions;
type MelodyGuardedOptions = MelodyOptions & ValidateOptions;
/**
 * Compute NNLS (non-negative least squares) chromagram.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @returns NNLS chroma result
 */
declare function nnlsChroma(samples: Float32Array, sampleRate?: number, options?: GuardedOptions$2): WasmNnlsChromaResult;
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
declare function cqt(samples: Float32Array, sampleRate?: number, hopLength?: number, fmin?: number, nBins?: number, binsPerOctave?: number, options?: GuardedOptions$2): CqtResult;
/**
 * Compute the pseudo Constant-Q Transform magnitude.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param hopLength - Hop length (default: 512)
 * @param fmin - Minimum frequency in Hz (default: 32.70319566257483, C1)
 * @param nBins - Number of frequency bins (default: 84)
 * @param binsPerOctave - Bins per octave (default: 12)
 * @returns CQT magnitude result
 */
declare function pseudoCqt(samples: Float32Array, sampleRate?: number, hopLength?: number, fmin?: number, nBins?: number, binsPerOctave?: number, options?: GuardedOptions$2): CqtResult;
/**
 * Compute the hybrid Constant-Q Transform magnitude.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param hopLength - Hop length (default: 512)
 * @param fmin - Minimum frequency in Hz (default: 32.70319566257483, C1)
 * @param nBins - Number of frequency bins (default: 84)
 * @param binsPerOctave - Bins per octave (default: 12)
 * @returns CQT magnitude result
 */
declare function hybridCqt(samples: Float32Array, sampleRate?: number, hopLength?: number, fmin?: number, nBins?: number, binsPerOctave?: number, options?: GuardedOptions$2): CqtResult;
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
declare function vqt(samples: Float32Array, sampleRate?: number, hopLength?: number, fmin?: number, nBins?: number, binsPerOctave?: number, gamma?: number, options?: GuardedOptions$2): CqtResult;
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
declare function analyzeSections(samples: Float32Array, sampleRate?: number, options?: AnalyzeSectionsGuardedOptions): Section[];
/** Options for {@link analyzeMelody}. All fields are optional. */
interface MelodyOptions {
    /** Lowest f0 (Hz) the tracker will consider. Default 65 (≈ C2). */
    fmin?: number;
    /** Highest f0 (Hz) the tracker will consider. Default 2093 (≈ C7). */
    fmax?: number;
    /** Analysis frame length in samples. Default 2048. */
    frameLength?: number;
    /** Hop length between frames in samples. Default 256. */
    hopLength?: number;
    /** Voicing confidence threshold in [0,1]; frames below are unvoiced. Default 0.1. */
    threshold?: number;
    /**
     * Use the pYIN tracker (Viterbi-smoothed) instead of plain per-frame YIN.
     * Produces a less octave-jumpy contour. Defaults to `false`.
     */
    usePyin?: boolean;
    /**
     * When {@link usePyin} is `true`, reflect-pad by `frameLength / 2` so frame
     * `i` is centered at `i * hopLength` (matches `librosa.pyin(center=True)`).
     * Ignored by the plain-YIN path. Defaults to `true`.
     */
    center?: boolean;
}
/**
 * Extract the melody contour from monophonic audio via YIN (or pYIN).
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param options - Tracker + tuning options ({@link MelodyOptions})
 * @returns Melody contour with per-frame pitch points and summary stats
 */
declare function analyzeMelody(samples: Float32Array, sampleRate?: number, options?: MelodyGuardedOptions): MelodyResult;
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
declare function onsetEnvelope(samples: Float32Array, sampleRate?: number, nFft?: number, hopLength?: number, nMels?: number, options?: GuardedOptions$2): Float32Array;
/**
 * Compute multi-band onset strength envelopes.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param nFft - FFT size (default: 2048)
 * @param hopLength - Hop length (default: 512)
 * @param nMels - Number of Mel bands (default: 128)
 * @param nBands - Number of onset bands (default: 3)
 * @returns Multi-band onset matrix
 */
declare function onsetStrengthMulti(samples: Float32Array, sampleRate?: number, nFft?: number, hopLength?: number, nMels?: number, nBands?: number, options?: GuardedOptions$2): OnsetStrengthMultiResult;
/**
 * Compute the Fourier tempogram from an onset envelope.
 *
 * @param onsetEnvelope - Onset strength envelope (float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param hopLength - Hop length (default: 512)
 * @param winLength - Window length in frames (default: 384)
 * @returns Fourier tempogram result
 */
declare function fourierTempogram(onsetEnvelope: Float32Array, sampleRate?: number, hopLength?: number, winLength?: number, options?: GuardedOptions$2): WasmFourierTempogramResult;
/**
 * Compute tempogram ratio features.
 *
 * @param tempogramData - Tempogram data (float32)
 * @param winLength - Window length in frames (default: 384)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param hopLength - Hop length (default: 512)
 * @returns Tempogram ratio features
 */
declare function tempogramRatio(tempogramData: Float32Array, winLength?: number, sampleRate?: number, hopLength?: number, options?: GuardedOptions$2): Float32Array;
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
 * Resample audio to a different sample rate.
 *
 * @param samples - Audio samples (mono, float32)
 * @param srcSr - Source sample rate in Hz
 * @param targetSr - Target sample rate in Hz
 * @returns Resampled audio
 */
declare function resample(samples: Float32Array, srcSr: number, targetSr: number): Float32Array;

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
 * Non-negative matrix factorisation with a selectable initialiser
 * (librosa.decompose.decompose, `init`). Identical to {@link decompose} but
 * exposes the initialisation strategy: `'random'` (default, deterministic seed)
 * or `'nndsvd'` (SVD-based warm start, which tends to converge in fewer
 * iterations). Returns the W and H factors.
 */
declare function decomposeWithInit(s: Float32Array, nFeatures: number, nFrames: number, nComponents: number, nIter?: number, beta?: number, init?: 'random' | 'nndsvd'): WasmDecomposeResult;
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
declare function lufsInterleaved(samples: Float32Array, channels: number, sampleRate?: number, options?: ValidateOptions): WasmLufsResult;
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

type GuardedOptions$1 = ValidateOptions;
/**
 * Trim silence from beginning and end of audio.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz
 * @param thresholdDb - Silence threshold in dB (default: -60 dB)
 * @returns Trimmed audio
 */
declare function trim(samples: Float32Array, sampleRate: number, thresholdDb?: number, options?: GuardedOptions$1): Float32Array;
/**
 * Compute Short-Time Fourier Transform (STFT).
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param nFft - FFT size (default: 2048)
 * @param hopLength - Hop length (default: 512)
 * @returns STFT result with magnitude and power spectrograms
 */
declare function stft(samples: Float32Array, sampleRate?: number, nFft?: number, hopLength?: number, options?: GuardedOptions$1): StftResult;
/**
 * Compute STFT and return magnitude in decibels.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param nFft - FFT size (default: 2048)
 * @param hopLength - Hop length (default: 512)
 * @returns STFT result with dB values
 */
declare function stftDb(samples: Float32Array, sampleRate?: number, nFft?: number, hopLength?: number, options?: GuardedOptions$1): {
    nBins: number;
    nFrames: number;
    db: Float32Array;
};
/**
 * Compute Chroma Energy Normalized Statistics.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param hopLength - Hop length (default: 512)
 * @param nChroma - Number of chroma bins (default: 12)
 * @returns Chroma result
 */
declare function chromaCens(samples: Float32Array, sampleRate?: number, hopLength?: number, nChroma?: number, options?: GuardedOptions$1): ChromaResult;
/**
 * Compute low-frequency bass chroma.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param hopLength - Hop length (default: 512)
 * @param nChroma - Number of chroma bins (default: 12)
 * @returns Chroma result
 */
declare function bassChroma(samples: Float32Array, sampleRate?: number, hopLength?: number, nChroma?: number, options?: GuardedOptions$1): ChromaResult;
/**
 * Compute Mel spectrogram.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param nFft - FFT size (default: 2048)
 * @param hopLength - Hop length (default: 512)
 * @param nMels - Number of Mel bands (default: 128)
 * @param fmin - Minimum Mel frequency in Hz (default: 0 = librosa default).
 *   Set with `fmax` to round-trip with `melToStft` / `melToAudio`.
 * @param fmax - Maximum Mel frequency in Hz (default: 0 = sampleRate / 2)
 * @param htk - Use the HTK Mel formula instead of Slaney (default: false)
 * @returns Mel spectrogram result
 */
declare function melSpectrogram(samples: Float32Array, sampleRate?: number, nFft?: number, hopLength?: number, nMels?: number, fmin?: number, fmax?: number, htk?: boolean, options?: GuardedOptions$1): MelSpectrogramResult;
/**
 * Compute MFCC (Mel-Frequency Cepstral Coefficients).
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param nFft - FFT size (default: 2048)
 * @param hopLength - Hop length (default: 512)
 * @param nMels - Number of Mel bands (default: 128)
 * @param nMfcc - Number of MFCC coefficients (default: 20)
 * @param fmin - Minimum Mel frequency in Hz (default: 0 = librosa default)
 * @param fmax - Maximum Mel frequency in Hz (default: 0 = sampleRate / 2)
 * @param htk - Use the HTK Mel formula instead of Slaney (default: false)
 * @returns MFCC result
 */
declare function mfcc(samples: Float32Array, sampleRate?: number, nFft?: number, hopLength?: number, nMels?: number, nMfcc?: number, fmin?: number, fmax?: number, htk?: boolean, options?: GuardedOptions$1): MfccResult;
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
 * @param htk - Use the HTK Mel formula instead of Slaney (default: false)
 * @returns STFT power spectrogram result
 */
declare function melToStft(melPower: Float32Array, nMels: number, nFrames: number, sampleRate?: number, nFft?: number, fmin?: number, fmax?: number, htk?: boolean, options?: GuardedOptions$1): StftPowerResult;
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
 * @param htk - Use the HTK Mel formula instead of Slaney (default: false)
 * @returns Reconstructed audio samples (mono, float32)
 */
declare function melToAudio(melPower: Float32Array, nMels: number, nFrames: number, sampleRate?: number, nFft?: number, hopLength?: number, fmin?: number, fmax?: number, nIter?: number, htk?: boolean, options?: GuardedOptions$1): Float32Array;
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
declare function mfccToMel(mfccCoefficients: Float32Array, nMfcc: number, nFrames: number, nMels?: number, options?: GuardedOptions$1): MelPowerResult;
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
 * @param htk - Use the HTK Mel formula instead of Slaney (default: false)
 * @returns Reconstructed audio samples (mono, float32)
 */
declare function mfccToAudio(mfccCoefficients: Float32Array, nMfcc: number, nFrames: number, nMels?: number, sampleRate?: number, nFft?: number, hopLength?: number, fmin?: number, fmax?: number, nIter?: number, htk?: boolean, options?: GuardedOptions$1): Float32Array;
/**
 * Compute chromagram (pitch class distribution).
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @param nFft - FFT size (default: 2048)
 * @param hopLength - Hop length (default: 512)
 * @returns Chroma features result
 */
declare function chroma(samples: Float32Array, sampleRate?: number, nFft?: number, hopLength?: number, options?: GuardedOptions$1): ChromaResult;

interface SonareRtModule {
  _malloc(size: number): number;
  _free(ptr: number): void;
  _sonare_rt_engine_abi_version(): number;
  _sonare_rt_engine_create(): number;
  _sonare_rt_engine_destroy(engine: number): void;
  _sonare_rt_engine_prepare(
    engine: number,
    sampleRate: number,
    maxBlockSize: number,
    commandCapacity: number,
    telemetryCapacity: number,
  ): number;
  _sonare_rt_engine_play(engine: number, renderFrame: bigint): number;
  _sonare_rt_engine_stop(engine: number, renderFrame: bigint): number;
  _sonare_rt_engine_seek_sample(
    engine: number,
    timelineSample: bigint,
    renderFrame: bigint,
  ): number;
  _sonare_rt_engine_seek_ppq(engine: number, ppq: number, renderFrame: bigint): number;
  _sonare_rt_engine_set_tempo(engine: number, bpm: number): number;
  _sonare_rt_engine_set_loop(
    engine: number,
    startPpq: number,
    endPpq: number,
    enabled: number,
  ): number;
  _sonare_rt_engine_seek_marker(engine: number, markerId: number, renderFrame: bigint): number;
  _sonare_rt_engine_set_metronome_enabled(
    engine: number,
    enabled: number,
    beatGain: number,
    accentGain: number,
    clickSamples: number,
  ): number;
  _sonare_rt_engine_set_capture_armed(engine: number, armed: number): number;
  _sonare_rt_engine_set_capture_punch(
    engine: number,
    startSample: bigint,
    endSample: bigint,
    enabled: number,
  ): number;
  _sonare_rt_engine_process(
    engine: number,
    channelsPtr: number,
    numChannels: number,
    numFrames: number,
  ): void;
  _sonare_rt_engine_drain_telemetry(
    engine: number,
    typesErrorsValuesPtr: number,
    frameValuesPtr: number,
    maxRecords: number,
  ): number;
}

interface SonareWorkletProcessorOptions {
    sceneJson: string;
    sampleRate?: number;
    blockSize?: number;
    stripCount?: number;
    meterIntervalFrames?: number;
    meterSharedBuffer?: SharedArrayBuffer;
    meterRingCapacity?: number;
    spectrumIntervalFrames?: number;
    spectrumBands?: number;
    spectrumSharedBuffer?: SharedArrayBuffer;
    spectrumRingCapacity?: number;
}
interface SonareRealtimeEngineWorkletProcessorOptions {
    runtimeTarget?: 'embind' | 'sonare-rt';
    rtModuleUrl?: string;
    rtWasmBinary?: ArrayBuffer | Uint8Array;
    sampleRate?: number;
    blockSize?: number;
    channelCount?: number;
    meterIntervalFrames?: number;
    commandSharedBuffer?: SharedArrayBuffer;
    commandRingCapacity?: number;
    telemetrySharedBuffer?: SharedArrayBuffer;
    telemetryRingCapacity?: number;
    meterSharedBuffer?: SharedArrayBuffer;
    meterRingCapacity?: number;
}
interface SonareRealtimeVoiceChangerWorkletProcessorOptions {
    preset?: RealtimeVoiceChangerConfigInput;
    sampleRate?: number;
    blockSize?: number;
    channelCount?: number;
}
interface SonareRealtimeVoiceChangerSetConfigMessage {
    type: 'setConfig';
    preset: RealtimeVoiceChangerConfigInput;
}
interface SonareRealtimeVoiceChangerResetMessage {
    type: 'reset';
}
interface SonareRealtimeVoiceChangerDestroyMessage {
    type: 'destroy';
}
type SonareRealtimeVoiceChangerMessage = SonareRealtimeVoiceChangerSetConfigMessage | SonareRealtimeVoiceChangerResetMessage | SonareRealtimeVoiceChangerDestroyMessage;
interface SonareRealtimeEngineNodeCapabilities {
    mode: 'sab' | 'postMessage';
    runtimeTarget: 'embind' | 'sonare-rt';
    sharedArrayBuffer: boolean;
    atomics: boolean;
    audioWorklet: boolean;
    engineAbiVersion?: number;
    expectedEngineAbiVersion?: number;
    abiCompatible?: boolean;
    degradedReason?: string;
}
interface SonareRealtimeEngineNodeOptions extends SonareRealtimeEngineWorkletProcessorOptions {
    processorName?: string;
    moduleUrl?: string | URL;
    rtModuleUrl?: string;
    mode?: 'auto' | 'sab' | 'postMessage';
    engineAbiVersion?: number;
    expectedEngineAbiVersion?: number;
    requireAbiCompatible?: boolean;
    nodeFactory?: (context: BaseAudioContext, processorName: string, options: AudioWorkletNodeOptions) => AudioWorkletNode;
}
interface SonareRtRealtimeEngineRuntimeOptions {
    module: SonareRtModule;
    memory: WebAssembly.Memory;
    sampleRate?: number;
    blockSize?: number;
    channelCount?: number;
    commandSharedBuffer?: SharedArrayBuffer;
    commandRingCapacity?: number;
    telemetrySharedBuffer?: SharedArrayBuffer;
    telemetryRingCapacity?: number;
}
interface SonareEngineOptions extends SonareRealtimeEngineNodeOptions {
    offlineEngine?: RealtimeEngine;
    offlineBlockSize?: number;
    offlineChannelCount?: number;
}
interface SonareEngineTransportFacade {
    play(sampleTime?: number): boolean;
    stop(sampleTime?: number): boolean;
    seekPpq(ppq: number, sampleTime?: number): boolean;
    seekSeconds(seconds: number, sampleTime?: number): boolean;
    setTempo(bpm: number): void;
    setLoop(startPpq: number, endPpq: number, enabled?: boolean): boolean;
}
type WorkletInput = readonly (readonly Float32Array[])[];
type WorkletOutput = Float32Array[][];
interface SonareWorkletScheduleInsertAutomationMessage {
    type: 'scheduleInsertAutomation';
    stripIndex: number;
    insertIndex: number;
    paramId: number;
    value: number;
    samplePos?: number;
    curve?: AutomationCurve;
}
interface SonareWorkletSetMeterIntervalMessage {
    type: 'setMeterInterval';
    frames: number;
}
interface SonareWorkletDestroyMessage {
    type: 'destroy';
}
type SonareWorkletMessage = SonareWorkletScheduleInsertAutomationMessage | SonareWorkletSetMeterIntervalMessage | SonareWorkletDestroyMessage;
interface SonareWorkletMeterSnapshot {
    type: 'meter';
    frame: number;
    peakDbL: number;
    peakDbR: number;
    rmsDbL: number;
    rmsDbR: number;
    correlation: number;
}
interface SonareWorkletSpectrumSnapshot {
    type: 'spectrum';
    frame: number;
    bands: Float32Array;
}
type SonareWorkletTransportMessage = SonareWorkletMeterSnapshot | SonareWorkletSpectrumSnapshot | SonareEngineTelemetryRecord;
declare const SONARE_METER_RING_HEADER_INTS = 4;
declare const SONARE_METER_RING_RECORD_FLOATS = 7;
declare const SONARE_SPECTRUM_RING_HEADER_INTS = 5;
/** Low 24 bits of a frame index (exact in Float32). */
declare function encodeFrameLo(frame: number): number;
/** High bits of a frame index above 2^24 (exact in Float32 up to ~2^48). */
declare function encodeFrameHi(frame: number): number;
/** Reconstruct a frame index from its low/high Float32 lanes. */
declare function decodeFrame(lo: number, hi: number): number;
declare const SONARE_ENGINE_RING_HEADER_INTS = 5;
declare const SONARE_ENGINE_COMMAND_RECORD_BYTES = 32;
declare const SONARE_ENGINE_TELEMETRY_RECORD_BYTES = 48;
declare enum SonareEngineCommandType {
    SetParam = 0,
    SetParamSmoothed = 1,
    TransportPlay = 2,
    TransportStop = 3,
    TransportSeekSample = 4,
    TransportSeekPpq = 5,
    SetTempoMap = 6,
    SetLoop = 7,
    SwapGraph = 8,
    SwapAutomation = 9,
    SetSoloMute = 10,
    AddClip = 11,
    RemoveClip = 12,
    ArmRecord = 13,
    Punch = 14,
    SetMetronome = 15,
    SetMarker = 16,
    SeekMarker = 17
}
declare enum SonareEngineTelemetryType {
    ProcessBlock = 0,
    Error = 1
}
declare enum SonareEngineTelemetryError {
    None = 0,
    CommandQueueOverflow = 1,
    PendingCommandOverflow = 2,
    BoundaryOverflow = 3,
    TelemetryOverflow = 4,
    CaptureOverflow = 5,
    MaxBlockExceeded = 6,
    UnknownTarget = 7,
    NonRealtimeSafeParameter = 8,
    NotPrepared = 9,
    NonQueueableCommand = 10,
    AutomationBindTargetOverflow = 11,
    StaleAutomationLanes = 12,
    SmoothedParameterCapacity = 13
}
interface WorkletTransport {
    postMessage?: (message: SonareWorkletTransportMessage) => void;
    onMeter?: (meter: SonareWorkletMeterSnapshot) => void;
    onSpectrum?: (spectrum: SonareWorkletSpectrumSnapshot) => void;
}
interface SonareMeterRingBuffer {
    sharedBuffer: SharedArrayBuffer;
    header: Int32Array;
    records: Float32Array;
    capacity: number;
}
interface SonareMeterRingReadResult {
    nextReadIndex: number;
    meters: SonareWorkletMeterSnapshot[];
}
interface SonareSpectrumRingBuffer {
    sharedBuffer: SharedArrayBuffer;
    header: Int32Array;
    records: Float32Array;
    capacity: number;
    bands: number;
}
interface SonareSpectrumRingReadResult {
    nextReadIndex: number;
    spectra: SonareWorkletSpectrumSnapshot[];
}
interface SonareEngineCommandRecord {
    type: SonareEngineCommandType | number;
    targetId?: number;
    sampleTime?: number | bigint;
    argFloat?: number;
    argInt?: number | bigint;
}
interface SonareEngineSyncClipsMessage {
    type: 'syncClips';
    clips: EngineClip[];
}
interface SonareEngineSyncMarkersMessage {
    type: 'syncMarkers';
    markers: EngineMarker[];
}
interface SonareEngineSyncMetronomeMessage {
    type: 'syncMetronome';
    config: EngineMetronomeConfig;
}
interface SonareEngineSyncAutomationMessage {
    type: 'syncAutomation';
    paramId: number;
    points: EngineAutomationPoint[];
}
type SonareEngineSyncMessage = SonareEngineSyncClipsMessage | SonareEngineSyncMarkersMessage | SonareEngineSyncMetronomeMessage | SonareEngineSyncAutomationMessage;
interface SonareEngineTelemetryRecord {
    type: SonareEngineTelemetryType | number;
    error: SonareEngineTelemetryError | number;
    renderFrame: number;
    timelineSample: number;
    audibleTimelineSample: number;
    graphLatencySamplesQ8: number;
    value: number;
}
interface SonareEngineCommandRingBuffer {
    sharedBuffer: SharedArrayBuffer;
    header: Int32Array;
    view: DataView;
    capacity: number;
}
interface SonareEngineTelemetryRingBuffer {
    sharedBuffer: SharedArrayBuffer;
    header: Int32Array;
    view: DataView;
    capacity: number;
}
interface SonareEngineTelemetryRingReadResult {
    nextReadIndex: number;
    telemetry: SonareEngineTelemetryRecord[];
}
declare function sonareMeterRingBufferByteLength(capacity: number): number;
declare function createSonareMeterRingBuffer(capacity?: number): SonareMeterRingBuffer;
declare function readSonareMeterRingBuffer(ring: SonareMeterRingBuffer, readIndex?: number): SonareMeterRingReadResult;
declare function sonareSpectrumRingBufferByteLength(capacity: number, bands?: number): number;
declare function createSonareSpectrumRingBuffer(capacity?: number, bands?: number): SonareSpectrumRingBuffer;
declare function readSonareSpectrumRingBuffer(ring: SonareSpectrumRingBuffer, readIndex?: number): SonareSpectrumRingReadResult;
declare function sonareEngineCommandRingBufferByteLength(capacity: number): number;
declare function sonareEngineTelemetryRingBufferByteLength(capacity: number): number;
declare function createSonareEngineCommandRingBuffer(capacity?: number): SonareEngineCommandRingBuffer;
declare function createSonareEngineTelemetryRingBuffer(capacity?: number): SonareEngineTelemetryRingBuffer;
declare function pushSonareEngineCommandRingBuffer(ring: SonareEngineCommandRingBuffer, command: SonareEngineCommandRecord): boolean;
declare function popSonareEngineCommandRingBuffer(ring: SonareEngineCommandRingBuffer): SonareEngineCommandRecord | null;
declare function writeSonareEngineTelemetryRingBuffer(ring: SonareEngineTelemetryRingBuffer, telemetry: SonareEngineTelemetryRecord): void;
declare function readSonareEngineTelemetryRingBuffer(ring: SonareEngineTelemetryRingBuffer, readIndex?: number): SonareEngineTelemetryRingReadResult;
/**
 * AudioWorklet-style mixer bridge backed by the package's single `sonare.wasm`.
 *
 * The WASM module must already be initialized via `init()` before constructing
 * this bridge. Each AudioWorklet input is treated as one stereo strip:
 * `inputs[strip][0]` is left and `inputs[strip][1]` is right. Missing channels
 * are replaced with preallocated silence.
 */
declare class SonareWorkletProcessor {
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
/**
 * AudioWorklet-style bridge for the DAW realtime engine facade.
 *
 * The default mode uses the existing `sonare.wasm` embind facade. The
 * `sonare-rt` target is exposed as a selectable runtime target for hosts that
 * load the dedicated Emscripten AudioWorklet module.
 */
declare class SonareRealtimeEngineWorkletProcessor {
    private static warnedChannelScratchOverflow;
    readonly sampleRate: number;
    readonly blockSize: number;
    readonly channelCount: number;
    readonly runtimeTarget: 'embind' | 'sonare-rt';
    private engine;
    private closed;
    private commandRing?;
    private telemetryRing?;
    private meterRing?;
    private transport?;
    private meterIntervalFrames;
    private lastMeterFrame;
    private metronomeConfig;
    private channelBuffers;
    constructor(options?: SonareRealtimeEngineWorkletProcessorOptions, transport?: WorkletTransport);
    process(inputs: WorkletInput, outputs: WorkletOutput): boolean;
    private reacquireChannelBuffers;
    receiveCommand(command: SonareEngineCommandRecord): void;
    receiveSync(message: SonareEngineSyncMessage): void;
    destroy(): void;
    private drainCommands;
    private applyCommand;
    private publishTelemetry;
    private publishTelemetryRecord;
    private publishMeters;
    private writeMeterRing;
    private commandRingFromSharedBuffer;
    private telemetryRingFromSharedBuffer;
}
declare class SonareRtRealtimeEngineRuntime {
    readonly sampleRate: number;
    readonly blockSize: number;
    readonly channelCount: number;
    private readonly module;
    private readonly memory;
    private readonly engine;
    private readonly channelPointerTable;
    private readonly channelBuffers;
    private readonly telemetryIntsPtr;
    private readonly telemetryFramesPtr;
    private readonly commandRing?;
    private readonly telemetryRing?;
    private metronomeConfig;
    private closed;
    constructor(options: SonareRtRealtimeEngineRuntimeOptions);
    process(inputs: WorkletInput, outputs: WorkletOutput): boolean;
    receiveCommand(command: SonareEngineCommandRecord): void;
    receiveSync(message: SonareEngineSyncMessage): void;
    destroy(): void;
    private writeChannelPointers;
    private drainCommands;
    private applyCommand;
    private publishTelemetry;
    private commandRingFromSharedBuffer;
    private telemetryRingFromSharedBuffer;
}
declare class SonareRealtimeEngineNode {
    readonly node: AudioWorkletNode;
    readonly capabilities: SonareRealtimeEngineNodeCapabilities;
    readonly commandRing?: SonareEngineCommandRingBuffer;
    readonly telemetryRing?: SonareEngineTelemetryRingBuffer;
    readonly meterRing?: SonareMeterRingBuffer;
    readonly ready: Promise<void>;
    private telemetryReadIndex;
    private meterReadIndex;
    private telemetryListeners;
    private meterListeners;
    private resolveReady;
    private rejectReady;
    private destroyed;
    private constructor();
    static create(context: BaseAudioContext, options?: SonareRealtimeEngineNodeOptions): Promise<SonareRealtimeEngineNode>;
    play(sampleTime?: number): boolean;
    stop(sampleTime?: number): boolean;
    seekSample(timelineSample: number, sampleTime?: number): boolean;
    seekPpq(ppq: number, sampleTime?: number): boolean;
    sendCommand(command: SonareEngineCommandRecord): boolean;
    pollTelemetry(): SonareEngineTelemetryRecord[];
    pollMeters(): SonareWorkletMeterSnapshot[];
    onTelemetry(callback: (telemetry: SonareEngineTelemetryRecord) => void): () => void;
    onMeter(callback: (meter: SonareWorkletMeterSnapshot) => void): () => void;
    destroy(): void;
    private emitTelemetry;
    private emitMeter;
}
declare class SonareEngine {
    readonly node: AudioWorkletNode;
    readonly capabilities: SonareRealtimeEngineNodeCapabilities;
    readonly transport: SonareEngineTransportFacade;
    private readonly realtimeNode;
    private readonly offlineEngine;
    private readonly context;
    private readonly sampleRate;
    private readonly offlineBlockSize;
    private readonly offlineChannelCount;
    private readonly automationLanes;
    private readonly clips;
    private readonly markers;
    private nextClipId;
    private nextMarkerId;
    private destroyed;
    private constructor();
    static create(context: BaseAudioContext, options?: SonareEngineOptions): Promise<SonareEngine>;
    suspend(): Promise<void>;
    resume(): Promise<void>;
    setTempo(bpm: number): void;
    setLoop(startPpq: number, endPpq: number, enabled?: boolean): boolean;
    setParam(nodeId: string, param: string | number, value: number): boolean;
    scheduleParam(nodeId: string, param: string | number, ppq: number, value: number, curve?: number | 'linear' | 'exponential'): void;
    addAutomationPoint(laneId: string | number, ppq: number, value: number, curve?: number | 'linear' | 'exponential'): void;
    listParameters(): EngineParameterInfo[];
    setSoloMute(target: string | number, solo: boolean, mute: boolean): boolean;
    addClip(trackId: string | number, buffer: Float32Array[], startPpq: number, opts?: Partial<Omit<EngineClip, 'channels' | 'startPpq'>>): number;
    removeClip(clipId: number): void;
    armRecord(trackId: string | number, enabled: boolean): boolean;
    punch(inPpq: number, outPpq: number): boolean;
    setMetronome(opts: EngineMetronomeConfig): void;
    addMarker(ppq: number, name?: string): number;
    seekMarker(markerId: number): boolean;
    renderOffline(totalFrames: number): Promise<Float32Array[]>;
    onMeter(callback: (meter: SonareWorkletMeterSnapshot) => void): () => void;
    onTelemetry(callback: (telemetry: SonareEngineTelemetryRecord) => void): () => void;
    pollTelemetry(): SonareEngineTelemetryRecord[];
    pollMeters(): SonareWorkletMeterSnapshot[];
    destroy(): void;
    private syncClips;
    private syncMarkers;
    private postSync;
    private resolveParamId;
    private resolveTargetId;
    private curveCode;
    private ppqToApproxSample;
}
declare class SonareRealtimeVoiceChangerWorkletProcessor {
    private static warnedMonoOverflow;
    private static warnedInterleavedOverflow;
    private changer;
    private readonly sampleRate;
    private readonly blockSize;
    private readonly channelCount;
    private monoInput;
    private monoOutput;
    private planarChannels;
    private destroyed;
    constructor(options?: SonareRealtimeVoiceChangerWorkletProcessorOptions);
    /**
     * Handles a control-plane message from the main thread. Runs on the
     * AudioWorklet global scope but OUTSIDE of `process()` (i.e. outside the
     * realtime audio callback), so it is safe to perform JSON parsing and
     * DSP coefficient recomputation here. `setConfig` MUST NOT be deferred
     * into `process()` because that would block the audio thread for longer
     * than one render quantum (e.g. 128 samples / 44.1 kHz = ~2.9 ms).
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
declare function registerSonareWorkletProcessor(name?: string): void;
declare function registerSonareRealtimeVoiceChangerWorkletProcessor(name?: string): void;
declare function registerSonareRealtimeEngineWorkletProcessor(name?: string): void;

interface BindMicrophoneInputOptions extends MediaStreamConstraints {
    stream?: MediaStream;
    stopTracksOnClose?: boolean;
}
interface MicrophoneInputBinding {
    stream: MediaStream;
    source: MediaStreamAudioSourceNode;
    close(): void;
}
declare function bindMicrophoneInput(context: AudioContext, engine: SonareRealtimeEngineNode | AudioWorkletNode, options?: BindMicrophoneInputOptions): Promise<MicrophoneInputBinding>;

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
/** Options for {@link meteringDetectClipping}. All fields are optional. */
interface MeteringDetectClippingOptions extends ValidateOptions {
    /** Linear absolute threshold. Default 0.999. */
    threshold?: number;
    /** Minimum run length to report. Default 1. */
    minRegionSamples?: number;
}
/** Options for {@link meteringDynamicRange}. All fields are optional. */
interface MeteringDynamicRangeOptions extends ValidateOptions {
    /** Window length in seconds (0 = library default, 3 s). Default 0. */
    windowSec?: number;
    /** Hop length in seconds (0 = library default, 1 s). Default 0. */
    hopSec?: number;
    /** Low percentile in [0,1] (negative = library default, 0.10). Default -1. */
    lowPercentile?: number;
    /** High percentile in [0,1] (negative = library default, 0.95). Default -1. */
    highPercentile?: number;
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
declare function meteringDetectClipping(samples: Float32Array, sampleRate?: number, options?: MeteringDetectClippingOptions): ClippingReport;
/**
 * Sliding-window dynamic range. Pass 0 for window/hop to use the library
 * default (window=3 s, hop=1 s). The percentiles use a NEGATIVE sentinel for
 * "use the library default" (low=0.10, high=0.95) because 0 is a literal 0th
 * percentile; omitted percentiles therefore default to -1.
 */
declare function meteringDynamicRange(samples: Float32Array, sampleRate?: number, options?: MeteringDynamicRangeOptions): DynamicRangeReport;
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
/** Options for {@link waveformPeaks}. All fields are optional. */
interface WaveformPeaksOptions extends ValidateOptions {
    /** Bucket width in frames. Default 512. */
    samplesPerBucket?: number;
}
/** Options for {@link waveformPeakPyramid}. All fields are optional. */
interface WaveformPeakPyramidOptions extends ValidateOptions {
    /** Bucket widths in frames, one per zoom level. Default [512, 1024, 2048, 4096]. */
    samplesPerBucketLevels?: number[];
}
/** Per-channel min/max waveform buckets. Arrays are channel-major. */
interface WaveformPeaksReport {
    min: Float32Array;
    max: Float32Array;
    channels: number;
    bucketCount: number;
    samplesPerBucket: number;
}
/** Pearson correlation in [-1, 1] between two equal-length channels. */
declare function meteringStereoCorrelation(left: Float32Array, right: Float32Array, sampleRate?: number, options?: ValidateOptions): number;
/**
 * Side / mid energy ratio, clamped to `[0, 2]`: 0 = pure mono, ~1 = wide
 * stereo, 2 = fully decorrelated / out-of-phase.
 */
declare function meteringStereoWidth(left: Float32Array, right: Float32Array, sampleRate?: number, options?: ValidateOptions): number;
/** Per-sample mid/side point series (one entry per input frame). */
declare function meteringVectorscope(left: Float32Array, right: Float32Array, sampleRate?: number, options?: ValidateOptions): VectorscopeReport;
/**
 * Display-sized mid/side vectorscope. Like {@link meteringVectorscope} but the
 * point series is deterministically decimated to at most `maxPoints` points
 * (`0`, or a value `>= length`, yields one point per input sample). Mirrors the
 * Node/Python decimated vectorscope.
 */
declare function meteringVectorscopeDecimated(left: Float32Array, right: Float32Array, sampleRate?: number, maxPoints?: number, options?: ValidateOptions): VectorscopeReport;
/** Phase-scope point series plus summary stats. */
declare function meteringPhaseScope(left: Float32Array, right: Float32Array, sampleRate?: number, options?: ValidateOptions): PhaseScopeReport;
/**
 * Display-sized phase scope. Like {@link meteringPhaseScope} but the point
 * series is deterministically decimated to at most `maxPoints` points (`0`, or
 * a value `>= length`, yields one point per input sample). The summary stats are
 * always computed over the full-resolution signal. Mirrors the Node/Python
 * decimated phase scope.
 */
declare function meteringPhaseScopeDecimated(left: Float32Array, right: Float32Array, sampleRate?: number, maxPoints?: number, options?: ValidateOptions): PhaseScopeReport;
/**
 * Welch-averaged magnitude / power / dB spectrum over the WHOLE signal (split
 * into Hann-windowed, 50%-overlapping `nFft`-length frames whose power spectra
 * are averaged). For a true single-frame snapshot, use
 * {@link meteringSpectrumFrame}.
 */
declare function meteringSpectrum(samples: Float32Array, sampleRate?: number, options?: SpectrumOptions & ValidateOptions): SpectrumReport;
/**
 * True single-frame magnitude / power / dB spectrum (one Hann-windowed
 * `nFft`-length FFT), for spectrum-analyzer "moment" snapshots that must not be
 * time-averaged like {@link meteringSpectrum}. The analysis frame spans
 * `[frameOffset, frameOffset + nFft)`; samples past the end are zero-padded.
 */
declare function meteringSpectrumFrame(samples: Float32Array, sampleRate?: number, frameOffset?: number, options?: SpectrumOptions & ValidateOptions): SpectrumReport;
/** Compute per-channel min/max waveform buckets from interleaved audio. */
declare function waveformPeaks(samples: Float32Array, channels: number, options?: WaveformPeaksOptions): WaveformPeaksReport;
/** Compute waveform peak buckets for several zoom levels. */
declare function waveformPeakPyramid(samples: Float32Array, channels: number, options?: WaveformPeakPyramidOptions): WaveformPeaksReport[];

/**
 * Expected project ABI version. Mirrors `SONARE_PROJECT_ABI_VERSION` in
 * `src/sonare_c_project.h`; checked against {@link projectAbiVersion} to detect
 * a WASM build whose flat project POD layout has drifted from this wrapper.
 */
declare const EXPECTED_PROJECT_ABI_VERSION = 1;
/** Render options for {@link Project.bounce}. All fields are optional. */
interface ProjectBounceOptions {
    /** Render length in frames at the output sample rate. */
    totalFrames?: number;
    /** Render block size; <= 0 uses the engine default (128). */
    blockSize?: number;
    /** Output channel count; <= 0 uses the default (2). */
    numChannels?: number;
    /** Output sample rate; <= 0 uses the project sample rate. */
    sampleRate?: number;
    /** Host-instrument PDC (latency) fed to the compiler. */
    instrumentLatencySamples?: number;
}
/** Oscillator waveform for the built-in synth. */
type BuiltinSynthWaveform = 'sine' | 'saw' | 'sawtooth' | 'square' | 'triangle' | 0 | 1 | 2 | 3;
/**
 * Built-in synth patch + MIDI routing for
 * {@link Project.bounceWithBuiltinInstrument}. Every field is optional; a
 * non-positive (or omitted) numeric field falls back to the C-ABI default
 * (gain 0.2, attack 5ms, decay 60ms, sustain 0.7, release 120ms, 16 voices),
 * so `{}` is a usable default sine patch.
 */
interface BuiltinSynthBinding {
    /** MIDI destination id this patch answers to (default 0; see {@link Project.setTrackMidiDestination}). */
    destinationId?: number;
    /** Oscillator waveform (default `'sine'`). */
    waveform?: BuiltinSynthWaveform;
    /** Master output gain, linear (0 => 0.2). */
    gain?: number;
    /** ADSR attack in ms (0 => 5). */
    attackMs?: number;
    /** ADSR decay in ms (0 => 60). */
    decayMs?: number;
    /** ADSR sustain level [0,1] (0 => 0.7). */
    sustain?: number;
    /** ADSR release in ms (0 => 120). */
    releaseMs?: number;
    /** Max simultaneous voices (0 => 16, clamped to [1, 64]). */
    polyphony?: number;
}
/**
 * Cross-binding alias of {@link BuiltinSynthBinding}. The same built-in-synth
 * patch concept is named `BuiltinSynthConfig` in the Python binding; this alias
 * lets portable code use that shared name on the WASM surface too.
 */
type BuiltinSynthConfig = BuiltinSynthBinding;
/**
 * SoundFont (SF2) player patch + MIDI routing for
 * {@link Project.bounceWithSf2Instrument}. Every field is optional; a
 * non-positive (or omitted) numeric field falls back to the C-ABI default
 * (gain 0.5, 48 voices), so `{}` is a usable default patch.
 */
interface Sf2InstrumentConfig {
    /** MIDI destination id this player answers to (default 0; see {@link Project.setTrackMidiDestination}). */
    destinationId?: number;
    /** Master output gain, linear (0 => 0.5). */
    gain?: number;
    /** Max simultaneous voices (0 => 48, clamped to [1, 64]). */
    polyphony?: number;
}
/** Source backend a resolved MIDI program renders through. */
type SourceBackend = 'sf2' | 'synth';
/**
 * One {@link Project.soundFontManifest} entry: a (channel, bank, program)
 * combination the arrangement plays, with the backend it resolves to.
 */
interface Sf2ProgramStatus {
    /** MIDI channel (0-15). */
    channel: number;
    /** Effective SF2 bank (drum channels report 128). */
    bank: number;
    /** Program number (0-127). */
    program: number;
    /** `'sf2'` when the loaded SoundFont covers the program, else `'synth'`. */
    backend: SourceBackend;
    /** Resolved SF2 preset name (GS fallback included); empty for `'synth'`. */
    presetName: string;
}
declare const SYNTH_ENGINE_MODES: readonly ["default", "subtractive", "fm", "karplus-strong", "modal", "additive", "percussion", "piano"];
declare const SYNTH_OSC_WAVEFORMS: readonly ["default", "sine", "saw", "square", "triangle", "noise"];
declare const SYNTH_FILTER_MODELS: readonly ["default", "svf", "moog-ladder", "diode-ladder", "sallen-key"];
declare const SYNTH_FILTER_OUTPUTS: readonly ["default", "lowpass", "bandpass", "highpass"];
declare const SYNTH_BODY_TYPES: readonly ["default", "none", "guitar", "violin", "wood-tube"];
declare const SYNTH_MOD_SOURCES: readonly ["none", "amp-env", "filter-env", "lfo1", "lfo2", "velocity", "key-track", "mod-wheel", "random"];
declare const SYNTH_MOD_DESTINATIONS: readonly ["none", "pitch-cents", "cutoff-cents", "amp-gain", "pan-units"];
interface SynthEnumTables {
    engineModes: string[];
    waveforms: string[];
    filterModels: string[];
    filterOutputs: string[];
    bodyTypes: string[];
    modSources: string[];
    modDestinations: string[];
}
/** NativeSynth engine selector ({@link SynthPatch}; `'default'` keeps the base patch's). */
type SynthEngineMode = (typeof SYNTH_ENGINE_MODES)[number];
/** NativeSynth oscillator waveform (`'default'` keeps the base patch's). */
type SynthOscWaveform = (typeof SYNTH_OSC_WAVEFORMS)[number];
/** NativeSynth filter model — the character core (`'default'` keeps the base patch's). */
type SynthFilterModel = (typeof SYNTH_FILTER_MODELS)[number];
/** NativeSynth filter output (SVF only; `'default'` keeps the base patch's). */
type SynthFilterOutput = (typeof SYNTH_FILTER_OUTPUTS)[number];
/** NativeSynth body/formant resonance voicing (`'default'` keeps the base patch's). */
type SynthBodyType = (typeof SYNTH_BODY_TYPES)[number];
/** {@link SynthPatch} mod-matrix source. */
type SynthModSource = (typeof SYNTH_MOD_SOURCES)[number];
/** {@link SynthPatch} mod-matrix destination. */
type SynthModDestination = (typeof SYNTH_MOD_DESTINATIONS)[number];
/** One {@link SynthPatch} mod-matrix routing (name or C ordinal per field). */
interface SynthModRouting {
    source: SynthModSource | number;
    destination: SynthModDestination | number;
    /** Destination units at full source deflection. */
    depth: number;
}
/**
 * Versioned NativeSynth patch for {@link Project.bounceWithSynthInstrument}
 * and {@link RealtimeEngine.setSynthInstrument}.
 *
 * The patch starts from a BASE — the named `preset` (see
 * {@link synthPresetNames}; a `"va:"` routing prefix is accepted) or, when
 * `preset` is omitted, the default subtractive patch. Every numeric field then
 * uses "0 / omit => keep the base value" (non-zero values override, clamped to
 * their audible ranges) and the enum fields reserve `'default'` as keep. The
 * frozen C ABI has no per-field presence bits, so explicit zero numeric
 * overrides (for example `ampSustain: 0`) cannot be represented; they keep the
 * base value. A non-empty `modRoutings` REPLACES the base mod matrix.
 *
 * Mode-specific deep parameters (FM operator stacks, modal mode tables,
 * drawbar registrations, kit pieces, piano strings) travel inside the named
 * presets; the patch exposes the wrapper sections every engine shares.
 */
interface SynthPatch {
    /**
     * Optional binding convenience for JS realtime/offline helpers. It is not
     * part of the NativeSynth patch itself; Python uses explicit
     * `(destination_id, patch)` bindings instead. Defaults to `0`.
     */
    destinationId?: number;
    /** Base preset name (see {@link synthPresetNames}); omit for the init patch. */
    preset?: string;
    engineMode?: SynthEngineMode | number;
    waveform?: SynthOscWaveform | number;
    /** Detuned-stack width [1, 7]. */
    unison?: number;
    detuneCents?: number;
    /** Per-voice slow pitch drift depth (cents). */
    driftCents?: number;
    /** Pre-filter drive [0, 1]. */
    drive?: number;
    filterModel?: SynthFilterModel | number;
    filterOutput?: SynthFilterOutput | number;
    cutoffHz?: number;
    resonanceQ?: number;
    /** Cutoff keyboard tracking [0, 1]. */
    keyTrack?: number;
    envToCutoffCents?: number;
    velToCutoffCents?: number;
    ampAttackMs?: number;
    ampDecayMs?: number;
    /** 0 / omit keeps the base value; explicit zero sustain is not representable. */
    ampSustain?: number;
    ampReleaseMs?: number;
    filterAttackMs?: number;
    filterDecayMs?: number;
    /** 0 / omit keeps the base value; explicit zero sustain is not representable. */
    filterSustain?: number;
    filterReleaseMs?: number;
    lfoRateHz?: number;
    lfoToPitchCents?: number;
    lfo2RateHz?: number;
    glideMs?: number;
    body?: SynthBodyType | number;
    /** Body resonance mix [0, 1]. */
    bodyMix?: number;
    /** Seeded per-voice pan scatter [0, 1]. */
    stereoSpread?: number;
    /** Mod matrix (at most 8 routings; REPLACES the base matrix when non-empty). */
    modRoutings?: SynthModRouting[];
    /** Master output gain (linear). */
    gain?: number;
    /** Max simultaneous voices [1, 64]. */
    polyphony?: number;
    /** Gain-neutral bus saturation [0, 1]. */
    busDrive?: number;
}
/** Clip fade-curve for {@link Project.setClipFade}. */
type ProjectFadeCurve = 'linear' | 'equal-power' | 'equal_power' | 'equalPower' | 'exponential' | 'logarithmic' | 0 | 1 | 2 | 3;
/** One clip fade region for {@link Project.setClipFade}. */
interface ProjectClipFade {
    /** Fade length in PPQ (>= 0; 0 = no fade). */
    lengthPpq?: number;
    /** Fade curve (default `'linear'`). */
    curve?: ProjectFadeCurve;
}
/** One alternate take for {@link Project.setClipTakes}. */
interface ProjectClipTake {
    id: number;
    sourceId?: number;
    sourceOffsetPpq?: number;
    name?: string;
}
/** One comp segment for {@link Project.setClipCompSegments}. */
interface ProjectClipCompSegment {
    startPpq: number;
    endPpq: number;
    takeId?: number;
}
/** Descriptor for {@link Project.addLoopRecordingTakes}. */
interface ProjectLoopRecordingDesc {
    trackId: number;
    startPpq?: number;
    loopLengthPpq: number;
    audio: Float32Array;
    audioChannels?: number;
    audioSampleRate?: number;
}
/** Result returned by {@link Project.addLoopRecordingTakes}. */
interface ProjectLoopRecordingResult {
    clipId: number;
    takeCount: number;
}
/** Clip loop mode for {@link Project.setClipLoop}. */
type ProjectLoopMode = 'off' | 'loop' | 0 | 1;
type ProjectWarpMode = 'off' | 'repitch' | 'tempo-sync' | 0 | 1 | 2;
/** Automation breakpoint interpolation for {@link ProjectAutomationPoint}. */
type ProjectAutomationCurve = 'linear' | 'exponential' | 'hold' | 'scurve' | 0 | 1 | 2 | 3;
/** One automation breakpoint accepted by the automation-lane edit ops. */
interface ProjectAutomationPoint {
    /** Breakpoint position in PPQ. */
    ppq: number;
    /** Breakpoint value. */
    value: number;
    /** Curve to the next breakpoint (default `'linear'`). */
    curve?: ProjectAutomationCurve;
}
/** Automation-lane descriptor for {@link Project.addAutomationLane}. */
interface ProjectAutomationLaneDesc {
    /** Host-defined id of the parameter the lane drives. */
    targetParamId: number;
    /** Breakpoints (stored verbatim). */
    points: ReadonlyArray<ProjectAutomationPoint>;
}
/** One tempo segment for {@link Project.setTempoSegments}. */
interface ProjectTempoSegment {
    /** Segment start in PPQ. */
    startPpq: number;
    /** Tempo in beats per minute at the segment start. */
    bpm: number;
    /** Derived segment start in samples. Accepted for compatibility, ignored on input. */
    startSample?: number;
    /** Optional ramp end tempo in BPM (0 = constant tempo over the segment). */
    endBpm?: number;
}
/** One time-signature segment for {@link Project.setTimeSignatures}. */
interface ProjectTimeSignatureSegment {
    /** Segment start in PPQ. */
    startPpq: number;
    /** Beats per bar (time-signature numerator). */
    numerator: number;
    /** Beat unit (time-signature denominator, e.g. 4 or 8). */
    denominator: number;
}
/** Key segment for {@link Project.annotateKeys}. */
interface ProjectKeySegment {
    startPpq: number;
    endPpq: number;
    /** Tonic pitch class 0..11 (C=0) or 255 for unknown. */
    tonicPc?: number;
    /** KeyMode ordinal (0 unknown, 1 major, 2 minor, 3 dorian, ...). */
    mode?: number;
}
/** Chord symbol for {@link Project.annotateChords}. */
interface ProjectChordSymbol {
    startPpq: number;
    endPpq: number;
    /** Root pitch class 0..11 (C=0) or 255 for unknown. */
    rootPc?: number;
    /** ChordQuality ordinal (0 unknown, 1 major, 2 minor, ...). */
    quality?: number;
    /** Extension semitone offsets (up to 8). */
    extensions?: ReadonlyArray<number>;
    /** Slash-bass pitch class 0..11 or 255 for none. */
    slashBassPc?: number;
    /** Optional roman-numeral label. */
    romanNumeral?: string;
    /** True at a modulation boundary. */
    modulationBoundary?: boolean;
}
/** Assist sidecar snapshot returned by {@link Project.getAssistSidecar}. */
interface ProjectAssistSidecar {
    moduleId: string;
    schemaVersion: number;
    targetTrackId: number;
    regionStartPpq: number;
    regionEndPpq: number;
    payload: Uint8Array;
}
/** Track kind for {@link Project.addTrack}. */
type ProjectTrackKind = 'audio' | 'midi' | 'aux' | 0 | 1 | 2;
/** Descriptor for {@link Project.addTrack}. */
interface ProjectTrackDesc {
    kind?: ProjectTrackKind;
    name?: string;
}
interface ProjectWarpAnchor {
    warpSample: number;
    sourceSample: number;
}
interface ProjectWarpMapDesc {
    id: number;
    name?: string;
    anchors: ProjectWarpAnchor[];
}
/** Descriptor for {@link Project.addClip}. */
interface ProjectClipDesc {
    trackId: number;
    isMidi?: boolean;
    startPpq?: number;
    lengthPpq: number;
    sourceOffsetPpq?: number;
    gain?: number;
    audio?: Float32Array;
    audioChannels?: number;
    audioSampleRate?: number;
    sourceUri?: string;
}
/** Result returned by {@link Project.addMidiClip}. */
interface ProjectMidiClipResult {
    trackId: number;
    clipId: number;
}
/** Flat MIDI event accepted by {@link Project.setMidiEvents}. */
interface ProjectMidiEvent {
    ppq: number;
    data0: number;
    data1?: number;
}
/** Options for {@link Project.midiRouteEvents}. `null`/omitted filter fields mean any/no remap. */
interface ProjectMidiRouteConfig {
    filterGroup?: number | null;
    filterChannel?: number | null;
    remapChannel?: number | null;
    thru?: boolean;
}
/** Result of {@link Project.midiRouteEvents}. */
interface ProjectMidiRouteResult {
    events: ProjectMidiEvent[];
    overflowed: boolean;
    overflowCount: number;
}
type ProjectMidiCcBindingKind = 0 | 1 | 2 | 3;
/** Options for {@link Project.midiCcLearn}. All fields are optional. */
interface MidiCcLearnOptions {
    /** Lower end of the mapped parameter range. Default `0`. */
    minValue?: number;
    /** Upper end of the mapped parameter range. Default `1`. */
    maxValue?: number;
    /** Minimum normalized CC movement required to learn a binding. Default `0`. */
    minMovement?: number;
}
/** MIDI CC <-> automation binding descriptor used by CC learn/conversion helpers. */
interface ProjectMidiCcBinding {
    ccNumber: number;
    /** MIDI channel 0..15, or 255 for any channel. */
    channel: number;
    /** 0 = 7-bit CC, 1 = 14-bit CC, 2 = RPN, 3 = NRPN. */
    kind: ProjectMidiCcBindingKind;
    ccLsbNumber?: number;
    selectorMsb?: number;
    selectorLsb?: number;
    paramId: number;
    minValue: number;
    maxValue: number;
}
/** Result of {@link Project.validateMidiNotes}. */
interface ProjectNotePairValidation {
    /** True when every note-on has a matching note-off (and vice versa). */
    ok: boolean;
    /** Count of note-ons that never received a matching note-off. */
    unmatchedNoteOns: number;
    /** Count of note-offs with no preceding matching note-on. */
    unmatchedNoteOffs: number;
}
/** One compile diagnostic (mirrors SonareProjectDiagnostic). */
interface ProjectDiagnostic {
    code: number;
    /** 0 = error, 1 = warning. */
    severity: number;
    /** Affected clip / track / source id (0 = n/a). */
    targetId: number;
    /** Human-readable message for this diagnostic. */
    message: string;
}
/** Diagnostics summary returned by {@link Project.compile}. */
interface ProjectCompileResult {
    /** Number of diagnostics surfaced by the compile. Kept for backward compatibility. */
    diagnosticCount: number;
    /** True when compilation produced a renderable timeline (no error diagnostics). */
    hasTimeline: boolean;
    /** Newline-joined human-readable detail of every diagnostic. */
    messages: string;
    diagnostics: ProjectDiagnostic[];
}
interface ProjectDeserializeResult {
    project: Project;
    diagnostics: string;
}
/**
 * Runtime ABI version of the flat project POD layout exposed by this WASM
 * build. Equals {@link EXPECTED_PROJECT_ABI_VERSION} when the arrangement
 * subsystem is compiled in. Mirrors the C-ABI `sonare_project_abi_version`.
 */
declare function projectAbiVersion(): number;
/**
 * NativeSynth preset catalog names (`'sine'`, `'saw-lead'`, `'e-piano'`,
 * `'drum-kit'`, ...). Use these to discover valid {@link SynthPatch} preset
 * names instead of hardcoding magic strings.
 */
declare function synthPresetNames(): string[];
/**
 * Fetch a named catalog preset as a {@link SynthPatch} (the preset name plus
 * the wrapper-section values), so hosts can inspect a preset and tweak fields
 * before binding it. A `"va:"` routing prefix is accepted; unknown names
 * throw.
 */
declare function synthPresetPatch(name: string): SynthPatch;
declare function synthEnumTables(): SynthEnumTables;
/**
 * Headless DAW project (control-thread-only arrangement model).
 *
 * Wraps the embind `Project` class over the C-ABI keystone
 * `sonare_c_project.{h,cpp}`. Construct an empty project with `new Project()`,
 * or deserialize one with {@link Project.fromJson}; serialize back with
 * {@link toJson}; compile to a renderable timeline with {@link compile}; render
 * offline to interleaved float audio with {@link bounce}. The edit and MIDI
 * methods mirror the Node/Python project bindings.
 *
 * Call {@link delete} (or use a `try/finally`) to release the underlying WASM
 * object — the embind handle is not garbage-collected automatically.
 *
 * @example
 * ```typescript
 * const project = new Project();
 * try {
 *   project.setSampleRate(48000);
 *   const json = project.toJson();
 *   const restored = Project.fromJson(json);
 *   restored.delete();
 * } finally {
 *   project.delete();
 * }
 * ```
 */
declare class Project {
    private native;
    constructor();
    /** Pack a MIDI 1.0 note-on event accepted by {@link setMidiEvents}. */
    static midiNoteOn(ppq: number, group: number, channel: number, note: number, velocity: number): ProjectMidiEvent;
    /** Pack a MIDI 1.0 note-off event accepted by {@link setMidiEvents}. */
    static midiNoteOff(ppq: number, group: number, channel: number, note: number, velocity?: number): ProjectMidiEvent;
    /** Pack a MIDI 1.0 control-change event. */
    static midiCc(ppq: number, group: number, channel: number, controller: number, value: number): ProjectMidiEvent;
    /** Pack a MIDI 1.0 poly-pressure event. */
    static midiPolyPressure(ppq: number, group: number, channel: number, note: number, pressure: number): ProjectMidiEvent;
    /** Pack a MIDI 1.0 program-change event. */
    static midiProgram(ppq: number, group: number, channel: number, program: number): ProjectMidiEvent;
    /** Return the General MIDI instrument name for `program`, or `null` when out of range. */
    static gmInstrumentName(program: number): string | null;
    /** Return the General MIDI program number for a canonical instrument name, or `-1`. */
    static gmProgramForName(name: string): number;
    /** Return the General MIDI family name for `family`, or `null` when out of range. */
    static gmFamilyName(family: number): string | null;
    /** Return the first General MIDI program number in `family`, or `-1`. */
    static gmFamilyFirstProgram(family: number): number;
    /** Return the GM2 bank/program instrument variation name, or `null` when unavailable. */
    static gm2InstrumentName(bankLsb: number, program: number): string | null;
    /** Return the General MIDI drum name for `note`, or `null` when out of range. */
    static gmDrumName(note: number): string | null;
    /** Return the General MIDI drum note for a canonical drum name, or `-1`. */
    static gmDrumNoteForName(name: string): number;
    /** Return the GM2 drum-set name for `bankLsb`, or `null` when unavailable. */
    static gm2DrumSetName(bankLsb: number): string | null;
    /** Return the GM2 drum name for `bankLsb`/`note`, or `null` when unavailable. */
    static gm2DrumName(bankLsb: number, note: number): string | null;
    /** Return the MIDI CC name for `controller`, or `null` when out of range. */
    static midiCcName(controller: number): string | null;
    /** Return the MIDI CC number for a canonical controller name, or `-1`. */
    static midiCcIndexForName(name: string): number;
    /** Return the MIDI 2.0 per-note controller name for `index`, or `null`. */
    static perNoteControllerName(index: number): string | null;
    /** Expand bank-select + program-change into MIDI events accepted by {@link setMidiEvents}. */
    static midiBankProgram(ppq: number, group: number, channel: number, bankMsb: number, bankLsb: number, program: number): ProjectMidiEvent[];
    /** Route MIDI events through the native MidiRouter filter/remap/thru logic. */
    static midiRouteEvents(events: ReadonlyArray<ProjectMidiEvent>, config?: ProjectMidiRouteConfig): ProjectMidiRouteResult;
    /** Run native MIDI learn over an event stream; returns `null` when nothing is learned. */
    static midiCcLearn(events: ReadonlyArray<ProjectMidiEvent>, paramId: number, options?: MidiCcLearnOptions): ProjectMidiCcBinding | null;
    /** Convert one CC event to an automation breakpoint using native CcMap. */
    static midiCcToBreakpoint(bindings: ReadonlyArray<ProjectMidiCcBinding>, event: ProjectMidiEvent): ProjectAutomationPoint | null;
    /** Convert one automation value back to a CC UMP event using native CcMap. */
    static midiParamToCc(bindings: ReadonlyArray<ProjectMidiCcBinding>, paramId: number, unitValue: number, group: number, ppq?: number): ProjectMidiEvent | null;
    /** Pack a MIDI 1.0 channel-pressure event. */
    static midiChannelPressure(ppq: number, group: number, channel: number, pressure: number): ProjectMidiEvent;
    /** Pack a MIDI 1.0 pitch-bend event (`bend` is unsigned 14-bit, center = 8192). */
    static midiPitchBend(ppq: number, group: number, channel: number, bend: number): ProjectMidiEvent;
    /**
     * Deserialize project JSON into a new {@link Project}. Throws if the JSON is
     * malformed, surfacing the joined diagnostic messages.
     */
    static fromJson(json: string): Project;
    /**
     * Deserialize project JSON and return native warning diagnostics emitted on
     * successful loads, such as dangling source references preserved for repair.
     */
    static fromJsonWithDiagnostics(json: string): ProjectDeserializeResult;
    /** Serialize the project (+ MIDI content) to deterministic JSON. */
    toJson(): string;
    /** Set the project sample rate in Hz. Must be > 0. */
    setSampleRate(sampleRate: number): void;
    /** Add a track and return its allocated stable id. */
    addTrack(desc?: ProjectTrackDesc): number;
    /** Add an audio or MIDI clip and return its allocated clip id. */
    addClip(desc: ProjectClipDesc): number;
    /** Split captured loop-recording audio into takes and add one clip. */
    addLoopRecordingTakes(desc: ProjectLoopRecordingDesc): ProjectLoopRecordingResult;
    /** Create a MIDI track + clip; returns `{ trackId, clipId }`. */
    addMidiClip(startPpq: number, lengthPpq: number): ProjectMidiClipResult;
    /** Split a clip at `splitPpq` and return the new clip id. */
    splitClip(clipId: number, splitPpq: number): number;
    /** Trim a clip's start / length in PPQ. */
    trimClip(clipId: number, newStartPpq: number, newLengthPpq: number): void;
    /** Move a clip to `newStartPpq` and optionally another track. */
    moveClip(clipId: number, newStartPpq: number, newTrackId?: number): void;
    /** Change a track kind via an undoable edit. */
    setTrackKind(trackId: number, kind: ProjectTrackKind): void;
    /** Set a clip's warp reference id (0 clears it). */
    setClipWarpRef(clipId: number, warpRefId: number): void;
    /** Set a clip's warp playback mode. */
    setClipWarpMode(clipId: number, mode: ProjectWarpMode): void;
    /** Add or replace a first-class warp map referenced by clip warp ids. */
    setWarpMap(map: ProjectWarpMapDesc): void;
    /** Remove a first-class warp map by id. */
    removeWarpMap(warpRefId: number): void;
    /**
     * Route a track's MIDI to host-instrument `destinationId` (0 = default). The
     * compiler stamps every MIDI clip on the track with this id so the engine
     * dispatches its events to the instrument registered for that destination.
     * Routes through an undoable edit command.
     */
    setTrackMidiDestination(trackId: number, destinationId: number): void;
    /** Undo the most recent edit. */
    undo(): void;
    /** Redo the most recently undone edit. */
    redo(): void;
    /** Replace a MIDI clip's entire event list. */
    setMidiEvents(clipId: number, events: ReadonlyArray<ProjectMidiEvent | readonly [number, number, number]>): void;
    /** Import an in-memory SMF buffer; returns the first added clip id. */
    importSmf(data: Uint8Array): number;
    /** Export the project's tempo map + MIDI clips to an SMF byte buffer. */
    exportSmf(): Uint8Array;
    /**
     * Import a MIDI 2.0 Clip File (`SMF2CLIP`); returns the first added clip id.
     * Unlike {@link importSmf}, MIDI 2.0 channel-voice messages (16-bit velocity,
     * 32-bit CC, per-note / registered controllers, bank-valid Program Change)
     * survive without loss.
     */
    importClipFile(data: Uint8Array): number;
    /**
     * Export the project's tempo map + MIDI clips to a MIDI 2.0 Clip File
     * (`SMF2CLIP`) byte buffer. MIDI 2.0-only events are written without loss —
     * prefer this over {@link exportSmf} when MIDI 2.0 fidelity matters.
     */
    exportClipFile(): Uint8Array;
    /**
     * Set a MIDI clip's channel-0 program / bank at source PPQ 0. `bank` defaults
     * to `-1` (no Bank Select emitted), matching `setProgramOnChannel` and the
     * Node/Python surfaces; pass `>= 0` to emit a Bank Select.
     */
    setProgram(clipId: number, program: number, bank?: number): void;
    /** Set a MIDI clip's program / bank for one UMP group and channel. */
    setProgramOnChannel(clipId: number, group: number, channel: number, program: number, bank?: number): void;
    /** Destructively bake a MIDI-FX chain into a clip's stored MIDI events. */
    bakeMidiFx(clipId: number, configJson: string): void;
    /** Backward alias for {@link bakeMidiFx}. */
    setMidiFx(clipId: number, configJson: string): void;
    /**
     * Pre-flight check for hanging / unmatched notes in a MIDI clip: reports
     * whether every note-on has a matching note-off (FIFO per channel+note).
     * Useful before bouncing to catch a stuck note. Throws if `clipId` is unknown
     * or not a MIDI clip.
     */
    validateMidiNotes(clipId: number): ProjectNotePairValidation;
    /** Detect tempo from a mono buffer and install it; returns the primary BPM. */
    autoTempo(audio: Float32Array, sampleRate: number): number;
    /** Snap a PPQ coordinate to the nearest beat of the project grid. */
    snapToGrid(ppq: number, strength?: number): number;
    /** Compile the project into a renderable timeline, surfacing diagnostics. */
    compile(): ProjectCompileResult;
    /**
     * Compile + render the project offline to interleaved float audio. MIDI
     * tracks render silently here (no instrument is bound) — use
     * {@link bounceWithBuiltinInstrument} to make MIDI audible.
     *
     * When `totalFrames` is omitted (or `<= 0`) the render length is auto-derived
     * from the arrangement, so a project with content renders without computing a
     * frame count; an empty project yields an empty buffer.
     *
     * @example
     * ```typescript
     * const audio = project.bounce({ numChannels: 2 });
     * ```
     */
    bounce(options?: ProjectBounceOptions): Float32Array;
    /**
     * Compile + render the project offline, routing MIDI tracks through the
     * built-in oscillator synth so a MIDI-only arrangement bounces to audible
     * audio. Pass a {@link BuiltinSynthBinding} (or an array of them) to choose
     * the patch and MIDI destination; omit it (or pass `{}`) for one
     * default-destination sine patch. An explicitly empty array `[]` (or
     * `undefined` / `null`) produces zero bindings, so MIDI tracks render silently.
     *
     * Like {@link bounce}, omitting `totalFrames` auto-derives the render length
     * from the arrangement plus the synth's release tail.
     *
     * @example
     * ```typescript
     * // MIDI-only project -> non-silent stereo audio.
     * const audio = project.bounceWithBuiltinInstrument(
     *   { waveform: 'saw' },
     *   { numChannels: 2 },
     * );
     * ```
     */
    bounceWithBuiltinInstrument(instrument?: BuiltinSynthBinding | ReadonlyArray<BuiltinSynthBinding>, options?: ProjectBounceOptions): Float32Array;
    /**
     * Compile + render the project offline, routing MIDI tracks through the
     * patch-driven NativeSynth — the full synthesizer (subtractive / FM /
     * Karplus-Strong / modal / additive / percussion / extended-waveguide-piano
     * engines plus the realism layer). Pass a {@link SynthPatch}, a preset-name
     * string (`'saw-lead'` / `'va:saw-lead'`; see {@link synthPresetNames}), or
     * an array of either; each object entry may carry a `destinationId` binding
     * convenience (default 0), which is not part of the NativeSynth patch itself.
     * An explicitly empty array (or `undefined` / `null`) produces zero bindings.
     * Unknown preset names throw. Deterministic for a fixed project + options +
     * patch.
     */
    bounceWithSynthInstrument(instrument?: SynthPatch | string | ReadonlyArray<SynthPatch | string>, options?: ProjectBounceOptions): Float32Array;
    /**
     * Load (parse) SoundFont 2 bytes into the project: presets / instruments /
     * sample headers plus the sample PCM decoded to a float pool. The host
     * fetches the `.sf2` and passes the raw bytes; they are copied into linear
     * memory for the call and not referenced afterwards. Replaces any previously
     * loaded SoundFont; throws on malformed input (the previous SoundFont is
     * kept).
     */
    loadSoundFont(data: Uint8Array): void;
    /** Release the project's loaded SoundFont (no-op when none is loaded). */
    clearSoundFont(): void;
    /** Number of presets in the loaded SoundFont (0 when none is loaded). */
    soundFontPresetCount(): number;
    /**
     * Enumerate every (channel, bank, program) combination the arrangement plays
     * a note through, in first-use order, reporting whether each resolves in the
     * loaded SoundFont (`'sf2'`, GS variation/drum fallbacks included) or would
     * fall back to the built-in synth (`'synth'`). Without a loaded SoundFont
     * every entry is a synth fallback.
     */
    soundFontManifest(): Sf2ProgramStatus[];
    /**
     * Like {@link bounceWithBuiltinInstrument}, but each bound destination
     * renders through a GS-compatible SoundFont player fed by the project's
     * loaded SoundFont ({@link loadSoundFont}): 16 MIDI channels per player,
     * channel 10 drums via bank 128, GS NRPN part edits and GS/GM SysEx resets
     * honored. Programs the SoundFont does not cover — including bouncing with
     * no SoundFont loaded at all — play through the built-in synthesizer GM
     * fallback bank (the data-free floor; see {@link soundFontManifest} for the
     * per-program backend). An explicitly empty array `[]` (or `undefined` /
     * `null`) produces zero bindings, so MIDI tracks render silently.
     */
    bounceWithSf2Instrument(instrument?: Sf2InstrumentConfig | ReadonlyArray<Sf2InstrumentConfig>, options?: ProjectBounceOptions): Float32Array;
    /** Remove a clip (undoable). */
    removeClip(clipId: number): void;
    /** Set a clip's linear playback gain (>= 0; undoable). */
    setClipGain(clipId: number, gain: number): void;
    /** Set a clip's fade-in / fade-out regions (undoable). */
    setClipFade(clipId: number, fadeIn?: ProjectClipFade, fadeOut?: ProjectClipFade): void;
    /** Replace a clip's take list and active take id (undoable). */
    setClipTakes(clipId: number, takes: ReadonlyArray<ProjectClipTake>, activeTakeId?: number): void;
    /** Replace a clip's comp segments (undoable). */
    setClipCompSegments(clipId: number, segments: ReadonlyArray<ProjectClipCompSegment>): void;
    /** Set a clip's loop mode + loop length in PPQ (undoable). */
    setClipLoop(clipId: number, loopMode: ProjectLoopMode, loopLengthPpq?: number): void;
    /** Rebind a clip to a different (already-registered) source (undoable). */
    setClipSource(clipId: number, sourceId: number): void;
    /** Duplicate a clip at `newStartPpq` (same track); returns the new clip id. */
    duplicateClip(clipId: number, newStartPpq: number): number;
    /** Remove a track and its clips (undoable). */
    removeTrack(trackId: number): void;
    /** Rename a track (undoable). */
    renameTrack(trackId: number, name: string): void;
    /** Set a track's mixer-strip binding + output target (undoable; omit / '' clears). */
    setTrackRoute(trackId: number, channelStripRef?: string, outputTarget?: string): void;
    /** Append an automation lane to a track; returns the lane index (undoable). */
    addAutomationLane(trackId: number, desc: ProjectAutomationLaneDesc): number;
    /** Replace an existing automation lane in place (undoable). */
    editAutomationLane(trackId: number, laneIndex: number, desc: ProjectAutomationLaneDesc): void;
    /** Remove an automation lane from a track (undoable). */
    removeAutomationLane(trackId: number, laneIndex: number): void;
    /** Replace the project's key annotation stream (undoable). */
    annotateKeys(keys: ReadonlyArray<ProjectKeySegment>): void;
    /** Replace the project's chord-symbol annotation stream (undoable). */
    annotateChords(chords: ReadonlyArray<ProjectChordSymbol>): void;
    /** Add or update an opaque assist sidecar by module id + target scope (undoable). */
    setAssistSidecar(moduleId: string, schemaVersion: number, targetTrackId: number, regionStartPpq: number, regionEndPpq: number, payload: Uint8Array): void;
    /** Number of assist sidecars currently stored on the project. */
    assistSidecarCount(): number;
    /** Read one assist sidecar by stable project order. */
    getAssistSidecar(index: number): ProjectAssistSidecar;
    /** Set the project's clip-overlap policy (SonareProjectOverlapPolicy ordinal). */
    setOverlapPolicy(policy: number): void;
    /** Read the project's clip-overlap policy (SonareProjectOverlapPolicy ordinal). */
    getOverlapPolicy(): number;
    /** Read the project sample rate in Hz. */
    getSampleRate(): number;
    /** Replace the project's mixer scene from a scene JSON string. */
    setMixerSceneJson(sceneJson: string): void;
    /**
     * Add or replace a marker. Pass `markerId` 0 to allocate a new id; returns the
     * stable marker id (the allocated id when 0 was passed).
     */
    setMarker(markerId: number, ppq: number, name: string): number;
    /** Number of tracks in the project. */
    trackCount(): number;
    /** Number of audio sources registered on the project. */
    sourceCount(): number;
    /** Number of tempo-map segments on the project. */
    tempoSegmentCount(): number;
    /** Number of time-signature segments on the project. */
    timeSignatureCount(): number;
    /** Replace the project's tempo map with the given segments. */
    setTempoSegments(segments: ReadonlyArray<ProjectTempoSegment>): void;
    /** Replace the project's time-signature map with the given segments. */
    setTimeSignatures(segments: ReadonlyArray<ProjectTimeSignatureSegment>): void;
    /**
     * Compile diagnostics produced by the most recent bounce on this project
     * (e.g. MIDI clips rendering silently without a bound instrument). When no
     * bounce has run, the result is empty with `hasTimeline` set.
     */
    lastBounceCompileResult(): ProjectCompileResult;
    /** Release the underlying WASM object. Safe to call only once. */
    delete(): void;
    /** Alias for {@link delete}, provided for cross-binding (Node) compatibility. */
    destroy(): void;
}

type EngineClip = WasmEngineClip;
type ClipPageRequest = WasmClipPageRequest;
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
declare const EXPECTED_ENGINE_ABI_VERSION = 3;
/** Options for {@link RealtimeEngine.bindMidiCc}. All fields are optional. */
interface MidiCcBindOptions {
    /** Lower end of the mapped parameter range. Default `0`. */
    minValue?: number;
    /** Upper end of the mapped parameter range. Default `1`. */
    maxValue?: number;
}
interface EngineCapabilities {
    engineAbiVersion: number;
    expectedEngineAbiVersion: number;
    abiCompatible: boolean;
    sharedArrayBuffer: boolean;
    atomics: boolean;
    audioWorklet: boolean;
    mode: 'sab' | 'postMessage';
}
declare function engineCapabilities(): EngineCapabilities;
declare class RealtimeEngine {
    private native;
    private nativeExt;
    constructor(sampleRate?: number, maxBlockSize?: number, commandCapacity?: number, telemetryCapacity?: number);
    prepare(sampleRate: number, maxBlockSize: number, commandCapacity?: number, telemetryCapacity?: number): void;
    /** Queue a sample-accurate parameter change (engine kSetParam). */
    setParameter(paramId: number, value: number, renderFrame?: number): void;
    /** Queue a smoothed parameter change (engine kSetParamSmoothed). */
    setParameterSmoothed(paramId: number, value: number, renderFrame?: number): void;
    setBuiltinInstrument(config?: {
        destinationId?: number;
    } & Record<string, unknown>, destinationId?: number): void;
    /**
     * Bind the patch-driven NativeSynth to a realtime MIDI destination. `patch`
     * is a {@link SynthPatch} or a preset-name string (`'saw-lead'` /
     * `'va:saw-lead'`; see {@link synthPresetNames}), resolving exactly like
     * {@link Project.bounceWithSynthInstrument}. Live note/CC commands and
     * scheduled MIDI clips routed to that destination render through the synth.
     * Unknown preset names throw. An object patch's `destinationId` is a JS
     * binding convenience, not part of the NativeSynth patch itself.
     */
    setSynthInstrument(patch?: SynthPatch | string, destinationId?: number): void;
    /**
     * Load (parse) SoundFont 2 bytes into the engine so SF2 instruments can be
     * bound with {@link setSf2Instrument}. The host fetches the `.sf2` and
     * passes the raw bytes; they are copied into linear memory for the call and
     * not referenced afterwards. Replaces any previously loaded SoundFont.
     */
    loadSoundFont(data: Uint8Array): void;
    /**
     * Bind a GS-compatible SoundFont player to a realtime MIDI destination, fed
     * by the engine's loaded SoundFont ({@link loadSoundFont}). Live note/CC
     * commands and scheduled MIDI clips routed to that destination render
     * through the player (16 MIDI channels, channel 10 drums, GS NRPN part
     * edits, GS/GM SysEx resets). Without a loaded SoundFont — or for programs
     * the SoundFont does not cover — notes play through the built-in
     * synthesizer GM fallback bank (the data-free floor).
     */
    setSf2Instrument(config?: {
        destinationId?: number;
        gain?: number;
        polyphony?: number;
    }, destinationId?: number): void;
    clearMidiInstrument(destinationId?: number): void;
    midiInstrumentCount(): number;
    /**
     * Bind a live MIDI CC to an engine automation parameter. The MIDI event still
     * reaches the destination instrument; when bound, its 7-bit value is also
     * mapped into [minValue, maxValue] for `paramId`.
     */
    bindMidiCc(channel: number, controller: number, paramId: number, options?: MidiCcBindOptions): void;
    clearMidiCcBindings(): void;
    midiCcBindingCount(): number;
    /** Install/replace a live non-destructive MIDI-FX insert for one destination. */
    setMidiFx(destinationId: number, configJson: string): void;
    clearMidiFx(destinationId?: number): void;
    /** Enable the engine-owned live MIDI input source for a destination. */
    setMidiInputSource(destinationId?: number): void;
    clearMidiInputSource(): void;
    midiInputPendingCount(): number;
    pushMidiInputNoteOn(group: number, channel: number, note: number, velocity: number, portTimeSamples?: number): void;
    pushMidiInputNoteOff(group: number, channel: number, note: number, velocity?: number, portTimeSamples?: number): void;
    pushMidiInputCc(group: number, channel: number, controller: number, value: number, portTimeSamples?: number): void;
    pushMidiNoteOn(destinationId: number, group: number, channel: number, note: number, velocity: number, renderFrame?: number): void;
    pushMidiNoteOff(destinationId: number, group: number, channel: number, note: number, velocity?: number, renderFrame?: number): void;
    /**
     * Queue an immediate (live) MIDI control change to a MIDI destination
     * (engine kMidiCcImmediate). `group`/`channel` are 0..15; `controller`/`value`
     * are 7-bit (0..127). `renderFrame` is the frame to fire at, or -1 for
     * immediate. Mirrors the Node/Python/C-ABI `pushMidiCc`.
     */
    pushMidiCc(destinationId: number, group: number, channel: number, controller: number, value: number, renderFrame?: number): void;
    /**
     * Queue a MIDI panic (all-notes-off) releasing every sounding note at
     * `renderFrame` (-1 = immediate). Mirrors the C-ABI `pushMidiPanic`.
     */
    pushMidiPanic(renderFrame?: number): void;
    /**
     * Remove all registered parameters (and their automation lanes). Control-thread
     * only; not realtime-safe. Mirrors the C-ABI `clearParameters`.
     */
    clearParameters(): void;
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
    createClipPageProvider(numChannels: number, numSamples: number, pageFrames: number): ClipPageProvider;
    supplyClipPage(providerId: number, pageIndex: number, channels: Float32Array[]): void;
    clearClipPage(providerId: number, pageIndex: number): void;
    destroyClipPageProvider(providerId: number): void;
    popClipPageRequest(): ClipPageRequest | null;
    setCaptureBuffer(numChannels: number, capacityFrames: number): void;
    armCapture(armed?: boolean): void;
    setCapturePunch(startSample: number, endSample: number, enabled?: boolean): void;
    setCaptureSource(source: EngineCaptureStatus['source']): void;
    setRecordOffsetSamples(offsetSamples: number): void;
    setInputMonitor(enabled: boolean, gain?: number): void;
    resetCapture(): void;
    captureStatus(): EngineCaptureStatus;
    capturedAudio(): Float32Array[];
    process(channels: Float32Array[]): Float32Array[];
    /**
     * Allocates persistent per-channel WASM-heap scratch for the zero-copy
     * `getChannelBuffer` / `processPrepared` realtime path. Call once (off the
     * audio thread) before driving `processPrepared` from an AudioWorklet so the
     * render callback never allocates on the C++/JS heap.
     */
    prepareChannels(numChannels: number, maxFrames: number): void;
    /**
     * Returns a Float32Array view onto the persistent WASM-heap scratch for one
     * channel (valid for up to `numFrames`). Fill it, call `processPrepared`, then
     * read the same view back. Re-acquire after WASM memory growth.
     */
    getChannelBuffer(channel: number, numFrames: number): Float32Array;
    /**
     * Runs the engine in place over the prepared per-channel scratch buffers.
     * Allocation-free: safe to call on the AudioWorklet render thread after
     * `prepareChannels`.
     */
    processPrepared(numFrames: number): void;
    processWithMonitor(channels: Float32Array[]): WasmEngineProcessWithMonitorResult;
    renderOffline(channels: Float32Array[], blockSize?: number): Float32Array[];
    bounceOffline(options: EngineBounceOptions): EngineBounceResult;
    freezeOffline(options: EngineFreezeOptions): EngineFreezeResult;
    drainTelemetry(maxRecords?: number): EngineTelemetry[];
    drainMeterTelemetry(maxRecords?: number): EngineMeterTelemetry[];
    destroy(): void;
}
declare class ClipPageProvider {
    private readonly engine;
    readonly id: number;
    private disposed;
    constructor(engine: RealtimeEngine, id: number);
    supply(pageIndex: number, channels: Float32Array[]): void;
    clear(pageIndex: number): void;
    destroy(): void;
}

interface OpfsClipPageProviderOptions {
    path: string;
    numChannels: number;
    numSamples: number;
    pageFrames: number;
    dataOffsetBytes?: number;
    worker?: Worker;
    terminateWorkerOnClose?: boolean;
}
interface OpfsClipPageProviderBinding {
    provider: ClipPageProvider;
    supplyPage(pageIndex: number): Promise<boolean>;
    supplyRequest(request: ClipPageRequest): Promise<boolean>;
    close(): void;
}
declare const opfsClipPageWorkerSource = "\nself.onmessage = async (event) => {\n  const message = event.data;\n  if (!message || message.type !== 'sonare:read-clip-page') return;\n  const { requestId, path, pageIndex, numChannels, numSamples, pageFrames, dataOffsetBytes = 0 } = message;\n  try {\n    if (pageIndex < 0) {\n      self.postMessage({ type: 'sonare:clip-page', requestId, pageIndex, ok: false });\n      return;\n    }\n    const startFrame = pageIndex * pageFrames;\n    if (startFrame >= numSamples) {\n      self.postMessage({ type: 'sonare:clip-page', requestId, pageIndex, ok: false });\n      return;\n    }\n    const root = await self.navigator.storage.getDirectory();\n    let dir = root;\n    const parts = String(path).split('/').filter(Boolean);\n    for (let i = 0; i < parts.length - 1; ++i) {\n      dir = await dir.getDirectoryHandle(parts[i]);\n    }\n    const fileHandle = await dir.getFileHandle(parts[parts.length - 1]);\n    const access = await fileHandle.createSyncAccessHandle();\n    try {\n      const frames = Math.min(pageFrames, numSamples - startFrame);\n      const frameBytes = numChannels * 4;\n      const bytes = new Uint8Array(frames * frameBytes);\n      let bytesReadTotal = 0;\n      const readOffset = dataOffsetBytes + startFrame * frameBytes;\n      while (bytesReadTotal < bytes.byteLength) {\n        const bytesRead = access.read(bytes.subarray(bytesReadTotal), {\n          at: readOffset + bytesReadTotal,\n        });\n        if (bytesRead <= 0) {\n          break;\n        }\n        bytesReadTotal += bytesRead;\n      }\n      if (bytesReadTotal !== bytes.byteLength || bytesReadTotal % frameBytes !== 0) {\n        self.postMessage({ type: 'sonare:clip-page', requestId, pageIndex, ok: false });\n        return;\n      }\n      const framesRead = bytesReadTotal / frameBytes;\n      const view = new DataView(bytes.buffer, 0, framesRead * frameBytes);\n      const channelBuffers = Array.from({ length: numChannels }, () => new ArrayBuffer(framesRead * 4));\n      for (let ch = 0; ch < numChannels; ++ch) {\n        const channel = new Float32Array(channelBuffers[ch]);\n        for (let frame = 0; frame < framesRead; ++frame) {\n          channel[frame] = view.getFloat32((frame * numChannels + ch) * 4, true);\n        }\n      }\n      self.postMessage(\n        { type: 'sonare:clip-page', requestId, pageIndex, ok: true, frames: framesRead, channelBuffers },\n        channelBuffers,\n      );\n    } finally {\n      access.close();\n    }\n  } catch (error) {\n    self.postMessage({\n      type: 'sonare:clip-page',\n      requestId,\n      pageIndex,\n      ok: false,\n      error: error instanceof Error ? error.message : String(error),\n    });\n  }\n};\n";
declare function createOpfsClipPageWorker(): Worker;
declare function createOpfsClipPageProvider(engine: RealtimeEngine, options: OpfsClipPageProviderOptions): OpfsClipPageProviderBinding;

type GuardedOptions = ValidateOptions;
/**
 * Detect BPM from audio samples.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @returns Detected BPM
 */
declare function detectBpm(samples: Float32Array, sampleRate?: number, options?: GuardedOptions): number;
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
declare function detectOnsets(samples: Float32Array, sampleRate?: number, options?: GuardedOptions): Float32Array;
/**
 * Detect beat times from audio samples.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @returns Array of beat times in seconds
 */
declare function detectBeats(samples: Float32Array, sampleRate?: number, options?: GuardedOptions): Float32Array;
/**
 * Detect downbeat times from audio samples.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @returns Array of downbeat times in seconds
 */
declare function detectDownbeats(samples: Float32Array, sampleRate?: number, options?: GuardedOptions): Float32Array;
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
 * Functional (Roman-numeral) harmonic analysis of the detected chord
 * progression, relative to the given key. Mirrors the C-ABI
 * `sonare_chord_functional_analysis` and the Node/Python `chordFunctionalAnalysis`.
 *
 * @returns One Roman-numeral label (e.g. "I", "IV", "V", "vi") per detected chord
 */
declare function chordFunctionalAnalysis(samples: Float32Array, keyRoot: PitchClass, keyMode: Mode, sampleRate?: number, options?: ChordDetectionOptions): string[];
/**
 * Perform complete music analysis.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz (default: 22050)
 * @returns Complete analysis result
 *
 * @remarks
 * This call is synchronous and blocks until analysis completes. Unlike the
 * Node binding (which offers `analyzeAsync` on a libuv worker thread), the
 * WASM build runs on a single thread, so there is no non-blocking variant —
 * the DSP pipeline always runs to completion on the calling thread. To keep
 * the UI responsive for long inputs, drive this from a Web Worker and use
 * {@link analyzeWithProgress} to report progress.
 */
declare function analyze(samples: Float32Array, sampleRate?: number, options?: GuardedOptions): AnalysisResult;
declare function analyzeImpulseResponse(samples: Float32Array, sampleRate?: number, nOctaveBands?: number): AcousticResult;
declare function detectAcoustic(samples: Float32Array, sampleRate?: number, options?: AcousticOptions): AcousticResult;
/**
 * Synthesize a room impulse response from shoebox geometry. `hasError` is true
 * when the source/listener falls outside the room (the RIR is then empty).
 */
declare function synthesizeRir(options?: RirSynthOptions): RirResult;
/**
 * Estimate an equivalent room (volume/dimensions/absorption/DRR) from a
 * recording or impulse response.
 */
declare function estimateRoom(samples: Float32Array, sampleRate?: number, options?: RoomEstimateOptions): RoomEstimateResult;
/**
 * Morph a recording's reverberation toward a target room (creative FX, not
 * dereverberation). Returns the morphed samples (input length plus the target
 * room's reverb tail).
 */
declare function roomMorph(samples: Float32Array, sampleRate: number, options?: RoomMorphOptions): Float32Array;
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
declare function analyzeBpm(samples: Float32Array, sampleRate?: number, options?: AnalyzeBpmOptions): BpmAnalysisResult;
/**
 * Detailed rhythm analysis (time signature, groove, syncopation, beat intervals).
 */
declare function analyzeRhythm(samples: Float32Array, sampleRate?: number, options?: AnalyzeRhythmOptions): RhythmAnalysisResult;
/**
 * Dynamics analysis (RMS, peak, crest factor, LRA, loudness curve).
 */
declare function analyzeDynamics(samples: Float32Array, sampleRate?: number, options?: AnalyzeDynamicsOptions): DynamicsAnalysisResult;
/**
 * Timbre analysis (brightness/warmth/density/roughness/complexity plus spectral
 * features and per-window timbre frames).
 */
declare function analyzeTimbre(samples: Float32Array, sampleRate?: number, options?: AnalyzeTimbreOptions): TimbreAnalysisResult;
/**
 * Whether this WASM build was compiled with FFmpeg support. Mirrors Node /
 * Python `hasFfmpegSupport`. In the published WASM binding this currently
 * always returns `false` (FFmpeg is not bundled into the .wasm), but the API
 * exists so caller code can branch on capabilities portably.
 */
declare function hasFfmpegSupport(): boolean;

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
    /** Number of mel bands; flat `mel` is `[nFrames * nMels]` row-major. */
    nMels: number;
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
 * Quantization ranges for the uint8/int16 bandwidth-reduction read paths
 * (`StreamAnalyzer.readFramesU8` / `readFramesI16`). Omitted fields fall back to
 * the library defaults shown below; widen any range whose source values exceed
 * the defaults, otherwise a louder/quieter stream saturates to the endpoints.
 */
interface StreamQuantizeConfig {
    /** dB floor for mel quantization (default -80). */
    melDbMin?: number;
    /** dB ceiling for mel quantization (default 0). */
    melDbMax?: number;
    /** Max expected onset strength (default 50). */
    onsetMax?: number;
    /** Max expected RMS energy (default 1). */
    rmsMax?: number;
    /** Max expected spectral centroid in Hz (default 11025). */
    centroidMax?: number;
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
 *
 * Omitted values are read from the native StreamConfig defaults via
 * streamAnalyzerConfigDefault(), keeping the WASM wrapper in sync with core.
 */
interface StreamConfig {
    /** Sample rate in Hz. Optional for parity with the Node/Python bindings. */
    sampleRate?: number;
    nFft?: number;
    hopLength?: number;
    nMels?: number;
    fmin?: number;
    fmax?: number;
    tuningRefHz?: number;
    /** Unsupported: no read path surfaces per-frame magnitude spectra. */
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
type StreamConfigDefaults = Required<StreamConfig>;

declare function streamAnalyzerConfigDefaults(): StreamConfigDefaults;
/**
 * Real-time streaming audio analyzer.
 *
 * @example
 * ```typescript
 * import { init, StreamAnalyzer } from '@libraz/libsonare';
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
    constructor(config?: StreamConfig);
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
     * Flush the final partial frame with zero-padding.
     */
    finalize(): void;
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
     * Read frames as uint8-quantized arrays.
     *
     * @param maxFrames - Maximum number of frames to read
     * @param quantizeConfig - Optional quantization ranges; widen these for a
     *   stream louder or quieter than the defaults (omitted keeps the defaults)
     */
    readFramesU8(maxFrames: number, quantizeConfig?: StreamQuantizeConfig): StreamFramesU8;
    /**
     * Read frames as int16-quantized arrays.
     *
     * @param maxFrames - Maximum number of frames to read
     * @param quantizeConfig - Optional quantization ranges; widen these for a
     *   stream louder or quieter than the defaults (omitted keeps the defaults)
     */
    readFramesI16(maxFrames: number, quantizeConfig?: StreamQuantizeConfig): StreamFramesI16;
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
    /** Release the underlying WASM object. Safe to call only once. */
    delete(): void;
    /** Alias for {@link delete}, kept for backward compatibility (historical name). */
    dispose(): void;
}

interface MixerRealtimeBuffer {
    leftInputs: Float32Array[];
    rightInputs: Float32Array[];
    outLeft: Float32Array;
    outRight: Float32Array;
    process: (numSamples?: number) => void;
}
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
     * Non-fatal warnings captured when this mixer was built from scene JSON: one
     * entry per channel-strip insert that was handed param keys it does not read
     * (a likely typo, or a key meant for a different processor). The scene still
     * loaded; these keys simply took no effect. Empty when every key was consumed.
     * Use {@link masteringInsertParamNames} to discover the keys an insert accepts.
     */
    sceneWarnings(): string[];
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
    /** Set an existing VCA group's gain in dB. */
    setVcaGroupGainDb(id: string, gainDb: number): void;
    /** Remove a VCA group by id. */
    removeVcaGroup(id: string): void;
    /** Number of VCA groups in the mixer topology. */
    vcaGroupCount(): number;
    /** Set the strip's input trim in dB. */
    setInputTrimDb(stripIndex: number, db: number): void;
    /** Set the strip's fader level in dB. */
    setFaderDb(stripIndex: number, db: number): void;
    /**
     * Set the strip's pan position.
     *
     * @param stripIndex - Strip index in `[0, stripCount())`
     * @param pan - Pan position in `[-1, 1]`
     * @param panMode - Optional pan mode. When omitted the strip's current pan
     *   mode is kept (passes `SONARE_PAN_MODE_KEEP`), so a plain pan nudge does
     *   not reset a scene-defined `'stereoPan'` / `'dualPan'` mode back to
     *   balance. Pass `'balance'` (or `0`) explicitly to force balance mode.
     */
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
    addSend(stripIndex: number, id: string, destinationBusId: string, sendDb?: number, timing?: SendTiming | number): number;
    /** Set the send level (in dB) for an existing send by index. */
    setSendDb(stripIndex: number, sendIndex: number, sendDb: number): void;
    /**
     * Remove an existing send from a strip by index.
     *
     * Sends are addressed in add order. After removal, sends with a higher index
     * than `sendIndex` shift down by one. Recompile (or process) before reading
     * results so the routing graph rebuilds.
     *
     * @param stripIndex - Strip index in `[0, stripCount())`
     * @param sendIndex - Send index in add order
     */
    removeSend(stripIndex: number, sendIndex: number): void;
    /**
     * Read a strip's meter snapshot at the given tap point.
     *
     * @param stripIndex - Strip index in `[0, stripCount())`
     * @param tap - `'preFader'` or `'postFader'` (default: `'postFader'`)
     */
    meterTap(stripIndex: number, tap?: MeterTap): MixMeterSnapshot;
    /**
     * Read a strip's meter snapshot.
     *
     * With no `tap` argument this reads the strip's own (post-fader) meter,
     * matching the Node/Python tap-less `stripMeter` contract. Pass an optional
     * `tap` (`'preFader'` / `'postFader'`) to read the tap-selectable snapshot
     * instead — the same backing call as {@link meterTap}.
     *
     * @param stripIndex - Strip index in `[0, stripCount())`
     * @param tap - Optional tap point (`'preFader'` / `'postFader'`); when omitted
     *   the tap-less post-fader strip meter is read.
     */
    stripMeter(stripIndex: number, tap?: MeterTap | number): MixMeterSnapshot;
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
    /**
     * Maximum processor tail length (samples) in the compiled mixer graph. Lazily
     * compiles the routing graph if the topology is dirty.
     */
    tailSamples(): number;
    /**
     * Drain delayed / tail audio by processing a zero-input block of `numSamples`
     * frames after the host stops feeding strip inputs. Returns the mixed stereo
     * master (`left`, `right`, `sampleRate`).
     */
    drainTailStereo(numSamples: number): MixerProcessResult;
    /** Release the underlying WASM object. Safe to call only once. */
    delete(): void;
    /** Alias for {@link delete}, provided for cross-binding (Node) compatibility. */
    destroy(): void;
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

type EqPhaseMode = 'zero' | 'zero-latency' | 'zero_latency' | 'natural' | 'natural-phase' | 'natural_phase' | 'linear' | 'linear-phase' | 'linear_phase' | number;
/**
 * Block-by-block streaming variant of {@link masteringChain}.
 *
 * Maintains processor state across {@link processMono}/{@link processStereo}
 * calls. Only ProcessorBase-backed stages are supported. Configurations that
 * enable `repair.denoise` throw at construction. An enabled `loudness` stage
 * also throws unless {@link StreamingMasteringChainConfig.loudnessStaticGainDb}
 * supplies a precomputed normalization gain.
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
    constructor(config: StreamingMasteringChainConfig);
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
     * Set the global phase mode: `'zero'` | `'natural'` | `'linear'` or 1/2/3.
     */
    setPhaseMode(mode: EqPhaseMode): void;
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

type MidiInputState = 'connected' | 'disconnected';
interface MidiPortLike {
    id: string;
    name?: string | null;
    manufacturer?: string | null;
    state?: MidiInputState;
}
interface MidiMessageEventLike {
    data: ArrayLike<number>;
    timeStamp?: number;
    receivedTime?: number;
    target?: MidiPortLike;
    currentTarget?: MidiPortLike;
}
interface MidiInputLike extends MidiPortLike {
    type?: 'input';
    onmidimessage: ((event: MidiMessageEventLike) => void) | null;
    addEventListener?: (type: 'midimessage', listener: (event: MidiMessageEventLike) => void) => void;
    removeEventListener?: (type: 'midimessage', listener: (event: MidiMessageEventLike) => void) => void;
}
interface MidiConnectionEventLike {
    port?: MidiPortLike | null;
}
interface MidiAccessLike {
    inputs: Map<string, MidiInputLike> | Iterable<[string, MidiInputLike]>;
    onstatechange: ((event: MidiConnectionEventLike) => void) | null;
    addEventListener?: (type: 'statechange', listener: (event: MidiConnectionEventLike) => void) => void;
    removeEventListener?: (type: 'statechange', listener: (event: MidiConnectionEventLike) => void) => void;
}
interface WebMidiCcBinding {
    channel: number;
    controller: number;
    paramId: number;
    options?: MidiCcBindOptions;
}
interface WebMidiInputInfo {
    id: string;
    name: string;
    manufacturer: string;
    state: MidiInputState;
}
interface BindWebMidiOptions {
    /** Realtime-engine MIDI destination receiving the live input source. Default `0`. */
    destinationId?: number;
    /** UMP group used for MIDI 1.0 channel voice events. Default `0`. */
    group?: number;
    /** Restrict binding to specific Web MIDI input ids. Omit or empty = all connected inputs. */
    inputIds?: readonly string[];
    /** Request SysEx-capable access from the browser. Default `false`. */
    sysex?: boolean;
    /** Request software ports from the browser where supported. Default `true`. */
    software?: boolean;
    /** Bind CC-to-parameter mappings before ports are connected. */
    ccBindings?: readonly WebMidiCcBinding[];
    /** Convert a Web MIDI event timestamp to engine port-time samples. */
    timestampToSamples?: (eventTimeMs: number) => number;
    /** Observe hot-plug updates after the helper rebinds matching inputs. */
    onInputsChanged?: (inputs: WebMidiInputInfo[]) => void;
}
interface WebMidiBinding {
    access: MidiAccessLike;
    inputs(): WebMidiInputInfo[];
    close(): void;
}
declare function isWebMidiAvailable(): boolean;
declare function bindWebMidi(engine: RealtimeEngine, options?: BindWebMidiOptions): Promise<WebMidiBinding>;

/**
 * sonare - Audio Analysis Library
 *
 * @example
 * ```typescript
 * import { init, detectBpm, detectKey, analyze } from '@libraz/libsonare';
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

/** Row-major 2-D matrix as a flat buffer plus its dimensions. */
type Matrix2dResult = WasmMatrix2dResult;
/** NMF factor matrices { w, h } from {@link decompose}. */
type DecomposeResult = WasmDecomposeResult;
/** Harmonic / percussive / residual signals from {@link hpssWithResidual}. */
type HpssWithResidualResult = WasmHpssWithResidualResult;
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

export { type EngineClip as $, type AcousticOptions as A, type BarChord as B, type Chord as C, type CompressorDetector as D, type CompressorOptions as E, type CqtResult as F, type DeclickOptions as G, type DeclipOptions as H, type DecomposeResult as I, type DecrackleMode as J, type DecrackleOptions as K, type DehumOptions as L, type DenoiseClassicalMode as M, type DenoiseClassicalNoiseEstimator as N, type DenoiseClassicalOptions as O, type DereverbClassicalOptions as P, type DynamicRangeReport as Q, type Dynamics as R, type DynamicsAnalysisResult as S, SONARE_ENGINE_COMMAND_RECORD_BYTES, SONARE_ENGINE_RING_HEADER_INTS, SONARE_ENGINE_TELEMETRY_RECORD_BYTES, SONARE_METER_RING_HEADER_INTS, SONARE_METER_RING_RECORD_FLOATS, SONARE_SPECTRUM_RING_HEADER_INTS, SonareEngine, type SonareEngineCommandRecord, type SonareEngineCommandRingBuffer, SonareEngineCommandType, type SonareEngineOptions, type SonareEngineSyncAutomationMessage, type SonareEngineSyncClipsMessage, type SonareEngineSyncMarkersMessage, type SonareEngineSyncMessage, type SonareEngineSyncMetronomeMessage, SonareEngineTelemetryError, type SonareEngineTelemetryRecord, type SonareEngineTelemetryRingBuffer, type SonareEngineTelemetryRingReadResult, SonareEngineTelemetryType, type SonareEngineTransportFacade, type SonareMeterRingBuffer, type SonareMeterRingReadResult, SonareRealtimeEngineNode, type SonareRealtimeEngineNodeCapabilities, type SonareRealtimeEngineNodeOptions, SonareRealtimeEngineWorkletProcessor, type SonareRealtimeEngineWorkletProcessorOptions, type SonareRealtimeVoiceChangerDestroyMessage, type SonareRealtimeVoiceChangerMessage, type SonareRealtimeVoiceChangerResetMessage, type SonareRealtimeVoiceChangerSetConfigMessage, SonareRealtimeVoiceChangerWorkletProcessor, type SonareRealtimeVoiceChangerWorkletProcessorOptions, SonareRtRealtimeEngineRuntime, type SonareRtRealtimeEngineRuntimeOptions, type SonareSpectrumRingBuffer, type SonareSpectrumRingReadResult, type SonareWorkletDestroyMessage, type SonareWorkletMessage, type SonareWorkletMeterSnapshot, SonareWorkletProcessor, type SonareWorkletProcessorOptions, type SonareWorkletScheduleInsertAutomationMessage, type SonareWorkletSetMeterIntervalMessage, type SonareWorkletSpectrumSnapshot, type SonareWorkletTransportMessage, type DynamicsResult as T, EXPECTED_ENGINE_ABI_VERSION as U, EXPECTED_PROJECT_ABI_VERSION as V, type EngineAutomationPoint as W, type EngineBounceOptions as X, type EngineBounceResult as Y, type EngineCapabilities as Z, type EngineCaptureStatus as _, type AcousticResult as a, type PatternScore as a$, type EngineFreezeOptions as a0, type EngineFreezeResult as a1, type EngineGraphSpec as a2, type EngineMarker as a3, type EngineMeterTelemetry as a4, type EngineMetronomeConfig as a5, type EngineParameterInfo as a6, type EngineTelemetry as a7, type EngineTransportState as a8, type EqBand as a9, type Matrix2dResult as aA, type MelPowerResult as aB, type MelSpectrogramResult as aC, type MelodyOptions as aD, type MelodyPoint as aE, type MelodyResult as aF, type MeterTap as aG, type MeteringDetectClippingOptions as aH, type MeteringDynamicRangeOptions as aI, type MfccResult as aJ, type MicrophoneInputBinding as aK, type MidiCcBindOptions as aL, type MidiCcLearnOptions as aM, type MixMeterSnapshot as aN, type MixOptions as aO, type MixResult as aP, Mixer as aQ, type MixerProcessResult as aR, type MixerRealtimeBuffer as aS, Mode as aT, type NoteStretchOptions as aU, type OpfsClipPageProviderBinding as aV, type OpfsClipPageProviderOptions as aW, type PairAnalysis as aX, type PairProcessor as aY, type PanLaw as aZ, type PanMode as a_, type EqBandPhase as aa, type EqBandType as ab, type EqCoeffMode as ac, type EqMatchOptions as ad, type EqSpectrumSnapshot as ae, type EqStereoPlacement as af, ErrorCode as ag, type FrameBuffer as ah, type GateOptions as ai, type GoniometerPoint as aj, type HpssResult as ak, type HpssWithResidualResult as al, type Key as am, type KeyCandidate as an, type KeyDetectionOptions as ao, KeyProfile as ap, type KeyProfileName as aq, type LufsResult as ar, type MasteringChainConfig as as, type MasteringChainResult as at, type MasteringOptions as au, type MasteringPreset as av, type MasteringProcessorParams as aw, type MasteringResult as ax, type MasteringStereoChainResult as ay, type MasteringStereoResult as az, type AnalysisResult as b, StreamAnalyzer as b$, type PhaseScopeReport as b0, PitchClass as b1, type PitchResult as b2, type ProgressiveEstimate as b3, Project as b4, type ProjectAssistSidecar as b5, type ProjectAutomationCurve as b6, type ProjectAutomationLaneDesc as b7, type ProjectAutomationPoint as b8, type ProjectBounceOptions as b9, type RhythmFeatures as bA, type RirResult as bB, type RirSynthOptions as bC, type RoomEstimateOptions as bD, type RoomEstimateResult as bE, type RoomGeometryOptions as bF, type RoomMorphOptions as bG, SYNTH_BODY_TYPES as bH, SYNTH_ENGINE_MODES as bI, SYNTH_FILTER_MODELS as bJ, SYNTH_FILTER_OUTPUTS as bK, SYNTH_MOD_DESTINATIONS as bL, SYNTH_MOD_SOURCES as bM, SYNTH_OSC_WAVEFORMS as bN, type Section as bO, SectionType as bP, type SendTiming as bQ, type Sf2InstrumentConfig as bR, type Sf2ProgramStatus as bS, type SoloProcessor as bT, SonareError as bU, type SourceBackend as bV, type SpectrumOptions as bW, type SpectrumReport as bX, type StereoAnalysis as bY, type StftPowerResult as bZ, type StftResult as b_, type ProjectChordSymbol as ba, type ProjectClipCompSegment as bb, type ProjectClipDesc as bc, type ProjectClipFade as bd, type ProjectClipTake as be, type ProjectCompileResult as bf, type ProjectFadeCurve as bg, type ProjectKeySegment as bh, type ProjectLoopMode as bi, type ProjectLoopRecordingDesc as bj, type ProjectLoopRecordingResult as bk, type ProjectMidiClipResult as bl, type ProjectMidiEvent as bm, type ProjectNotePairValidation as bn, type ProjectTrackDesc as bo, type ProjectTrackKind as bp, type ProjectWarpAnchor as bq, type ProjectWarpMapDesc as br, RealtimeEngine as bs, RealtimeVoiceChanger as bt, type RealtimeVoiceChangerConfigInput as bu, type RealtimeVoiceChangerInterleavedBuffer as bv, type RealtimeVoiceChangerMonoBuffer as bw, type RealtimeVoiceChangerPlanarBuffer as bx, type RealtimeVoiceChangerPodConfig as by, type RhythmAnalysisResult as bz, type AnalyzeBpmOptions as c, decompose as c$, type StreamConfig as c0, type StreamConfigDefaults as c1, type StreamFramesI16 as c2, type StreamFramesU8 as c3, type StreamQuantizeConfig as c4, StreamingEqualizer as c5, type StreamingEqualizerConfig as c6, StreamingMasteringChain as c7, type StreamingMasteringChainConfig as c8, type StreamingPlatform as c9, type WaveformPeaksOptions as cA, type WaveformPeaksReport as cB, type WebMidiBinding as cC, type WebMidiCcBinding as cD, type WebMidiInputInfo as cE, amplitudeToDb as cF, analyze as cG, analyzeBpm as cH, analyzeDynamics as cI, analyzeImpulseResponse as cJ, analyzeMelody as cK, analyzeRhythm as cL, analyzeSections as cM, analyzeTimbre as cN, analyzeWithProgress as cO, bassChroma as cP, bindMicrophoneInput as cQ, bindWebMidi as cR, chordFunctionalAnalysis as cS, chroma as cT, chromaCens as cU, cqt as cV, createOpfsClipPageProvider as cW, createOpfsClipPageWorker as cX, cyclicTempogram as cY, dbToAmplitude as cZ, dbToPower as c_, StreamingRetune as ca, type StreamingRetuneConfig as cb, type SynthBodyType as cc, type SynthEngineMode as cd, type SynthEnumTables as ce, type SynthFilterModel as cf, type SynthFilterOutput as cg, type SynthModDestination as ch, type SynthModRouting as ci, type SynthModSource as cj, type SynthOscWaveform as ck, type SynthPatch as cl, type TempogramMode as cm, type Timbre as cn, type TimbreAnalysisResult as co, type TimbreFrame as cp, type TimeSignature as cq, type TransientShaperOptions as cr, createSonareEngineCommandRingBuffer, createSonareEngineTelemetryRingBuffer, createSonareMeterRingBuffer, createSonareSpectrumRingBuffer, type TrimSilenceMode as cs, type TrimSilenceOptions as ct, type ValidateOptions as cu, type VectorscopeReport as cv, type VoiceChangeOptions as cw, type VoiceChangeRealtimeOptions as cx, type VoicePresetId as cy, type WaveformPeakPyramidOptions as cz, type AnalyzeDynamicsOptions as d, masteringRepairDereverbClassical as d$, decomposeWithInit as d0, deemphasis as d1, detectAcoustic as d2, detectBeats as d3, detectBpm as d4, detectChords as d5, detectDownbeats as d6, detectKey as d7, detectKeyCandidates as d8, detectOnsets as d9, masterAudioStereoWithProgress as dA, masterAudioWithProgress as dB, mastering as dC, masteringAssistantSuggest as dD, masteringAudioProfile as dE, masteringChain as dF, masteringChainStereo as dG, masteringChainStereoWithProgress as dH, masteringChainWithProgress as dI, masteringDynamicsCompressor as dJ, masteringDynamicsGate as dK, masteringDynamicsTransientShaper as dL, masteringInsertNames as dM, masteringInsertParamNames as dN, masteringPairAnalysisNames as dO, masteringPairAnalyze as dP, masteringPairProcess as dQ, masteringPairProcessorNames as dR, masteringPresetNames as dS, masteringProcess as dT, masteringProcessStereo as dU, masteringProcessorNames as dV, masteringRepairDeclick as dW, masteringRepairDeclip as dX, masteringRepairDecrackle as dY, masteringRepairDehum as dZ, masteringRepairDenoiseClassical as d_, ebur128LoudnessRange as da, engineAbiVersion as db, engineCapabilities as dc, estimateRoom as dd, estimateTuning as de, decodeFrame, fixFrames as df, fixLength as dg, fourierTempogram as dh, frameSignal as di, framesToSamples as dj, framesToTime as dk, harmonic as dl, hasFfmpegSupport as dm, hpss as dn, hpssWithResidual as dp, hybridCqt as dq, hzToMel as dr, hzToMidi as ds, hzToNote as dt, isSonareError as du, isWebMidiAvailable as dv, lufs as dw, lufsInterleaved as dx, masterAudio as dy, masterAudioStereo as dz, type AnalyzeRhythmOptions as e, samplesToFrames as e$, masteringRepairTrimSilence as e0, masteringStereoAnalysisNames as e1, masteringStereoAnalyze as e2, masteringStreamingPreview as e3, melSpectrogram as e4, melToAudio as e5, melToHz as e6, melToStft as e7, meteringCrestFactorDb as e8, meteringDcOffset as e9, onsetEnvelope as eA, onsetStrengthMulti as eB, opfsClipPageWorkerSource as eC, padCenter as eD, pcen as eE, peakPick as eF, percussive as eG, phaseVocoder as eH, pitchCorrectToMidi as eI, pitchCorrectToMidiTimevarying as eJ, pitchPyin as eK, pitchShift as eL, pitchTuning as eM, pitchYin as eN, plp as eO, polyFeatures as eP, powerToDb as eQ, preemphasis as eR, projectAbiVersion as eS, pseudoCqt as eT, realtimeVoiceChangerPresetConfig as eU, realtimeVoiceChangerPresetJson as eV, realtimeVoiceChangerPresetNames as eW, remix as eX, resample as eY, rmsEnergy as eZ, roomMorph as e_, meteringDetectClipping as ea, meteringDynamicRange as eb, meteringPeakDb as ec, meteringPhaseScope as ed, meteringPhaseScopeDecimated as ee, meteringRmsDb as ef, meteringSpectrum as eg, meteringSpectrumFrame as eh, meteringStereoCorrelation as ei, meteringStereoWidth as ej, meteringTruePeakDb as ek, meteringVectorscope as el, meteringVectorscopeDecimated as em, mfcc as en, encodeFrameHi, encodeFrameLo, mfccToAudio as eo, mfccToMel as ep, midiToHz as eq, mixStereo as er, mixingScenePresetJson as es, mixingScenePresetNames as et, momentaryLufs as eu, nnFilter as ev, nnlsChroma as ew, normalize as ex, noteStretch as ey, noteToHz as ez, type AnalyzeSectionsOptions as f, scaleCorrectionSemitones as f0, scalePitchClassEnabled as f1, scaleQuantizeMidi as f2, shortTermLufs as f3, spectralBandwidth as f4, spectralCentroid as f5, spectralContrast as f6, spectralFlatness as f7, spectralRolloff as f8, splitSilence as f9, stft as fa, stftDb as fb, streamAnalyzerConfigDefaults as fc, synthEnumTables as fd, synthPresetNames as fe, synthPresetPatch as ff, synthesizeRir as fg, tempogram as fh, tempogramRatio as fi, timeStretch as fj, timeToFrames as fk, tonnetz as fl, trim as fm, trimSilence as fn, validateRealtimeVoiceChangerPresetJson as fo, vectorNormalize as fp, version as fq, voiceChange as fr, voiceChangeRealtime as fs, voiceChangerAbiVersion as ft, voiceCharacterPresetId as fu, vqt as fv, waveformPeakPyramid as fw, waveformPeaks as fx, zeroCrossingRate as fy, zeroCrossings as fz, type AnalyzeTimbreOptions as g, type AnalyzerStats as h, Audio as i, init, isInitialized, type AutomationCurve as j, type Beat as k, type BindMicrophoneInputOptions as l, type BindWebMidiOptions as m, type BpmAnalysisResult as n, type BpmCandidate as o, type BrowserAudioDecodeOptions as p, popSonareEngineCommandRingBuffer, pushSonareEngineCommandRingBuffer, type BuiltinSynthBinding as q, type BuiltinSynthConfig as r, readSonareEngineTelemetryRingBuffer, readSonareMeterRingBuffer, readSonareSpectrumRingBuffer, registerSonareRealtimeEngineWorkletProcessor, registerSonareRealtimeVoiceChangerWorkletProcessor, registerSonareWorkletProcessor, type BuiltinSynthWaveform as s, sonareEngineCommandRingBufferByteLength, sonareEngineTelemetryRingBufferByteLength, sonareMeterRingBufferByteLength, sonareSpectrumRingBufferByteLength, type ChordAnalysisResult as t, type ChordChange as u, type ChordDetectionOptions as v, ChordQuality as w, writeSonareEngineTelemetryRingBuffer, type ChromaResult as x, type ClippingRegion as y, type ClippingReport as z };
