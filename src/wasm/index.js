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
// ============================================================================
// Public Types
// ============================================================================
/**
 * Pitch class enum (C=0, C#=1, ..., B=11)
 */
export const PitchClass = {
    C: 0,
    Cs: 1,
    D: 2,
    Ds: 3,
    E: 4,
    F: 5,
    Fs: 6,
    G: 7,
    Gs: 8,
    A: 9,
    As: 10,
    B: 11,
};
/**
 * Musical mode
 */
export const Mode = {
    Major: 0,
    Minor: 1,
};
/**
 * Chord quality
 */
export const ChordQuality = {
    Major: 0,
    Minor: 1,
    Diminished: 2,
    Augmented: 3,
    Dominant7: 4,
    Major7: 5,
    Minor7: 6,
    Sus2: 7,
    Sus4: 8,
};
/**
 * Section type
 */
export const SectionType = {
    Intro: 0,
    Verse: 1,
    PreChorus: 2,
    Chorus: 3,
    Bridge: 4,
    Instrumental: 5,
    Outro: 6,
};
// ============================================================================
// Module State
// ============================================================================
let module = null;
let initPromise = null;
// ============================================================================
// Initialization
// ============================================================================
/**
 * Initialize the WASM module.
 * Must be called before using any analysis functions.
 *
 * @param options - Optional module configuration
 * @returns Promise that resolves when initialization is complete
 */
export async function init(options) {
    if (module) {
        return;
    }
    if (initPromise) {
        return initPromise;
    }
    initPromise = (async () => {
        const createModule = (await import('./sonare.js')).default;
        module = await createModule(options);
    })();
    return initPromise;
}
/**
 * Check if the module is initialized.
 */
export function isInitialized() {
    return module !== null;
}
/**
 * Get the library version.
 */
export function version() {
    if (!module) {
        throw new Error('Module not initialized. Call init() first.');
    }
    return module.version();
}
// ============================================================================
// Quick API (High-level Analysis)
// ============================================================================
/**
 * Detect BPM from audio samples.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz
 * @returns Detected BPM
 */
export function detectBpm(samples, sampleRate) {
    if (!module) {
        throw new Error('Module not initialized. Call init() first.');
    }
    return module.detectBpm(samples, sampleRate);
}
/**
 * Detect musical key from audio samples.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz
 * @returns Detected key
 */
export function detectKey(samples, sampleRate) {
    if (!module) {
        throw new Error('Module not initialized. Call init() first.');
    }
    const result = module.detectKey(samples, sampleRate);
    return {
        root: result.root,
        mode: result.mode,
        confidence: result.confidence,
        name: result.name,
        shortName: result.shortName,
    };
}
/**
 * Detect onset times from audio samples.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz
 * @returns Array of onset times in seconds
 */
export function detectOnsets(samples, sampleRate) {
    if (!module) {
        throw new Error('Module not initialized. Call init() first.');
    }
    return module.detectOnsets(samples, sampleRate);
}
/**
 * Detect beat times from audio samples.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz
 * @returns Array of beat times in seconds
 */
export function detectBeats(samples, sampleRate) {
    if (!module) {
        throw new Error('Module not initialized. Call init() first.');
    }
    return module.detectBeats(samples, sampleRate);
}
// Helper to convert WASM result to typed result
function convertAnalysisResult(wasm) {
    return {
        bpm: wasm.bpm,
        bpmConfidence: wasm.bpmConfidence,
        key: {
            root: wasm.key.root,
            mode: wasm.key.mode,
            confidence: wasm.key.confidence,
            name: wasm.key.name,
            shortName: wasm.key.shortName,
        },
        timeSignature: wasm.timeSignature,
        beats: wasm.beats,
        chords: wasm.chords.map((c) => ({
            root: c.root,
            quality: c.quality,
            start: c.start,
            end: c.end,
            confidence: c.confidence,
            name: c.name,
        })),
        sections: wasm.sections.map((s) => ({
            type: s.type,
            start: s.start,
            end: s.end,
            energyLevel: s.energyLevel,
            confidence: s.confidence,
            name: s.name,
        })),
        timbre: wasm.timbre,
        dynamics: wasm.dynamics,
        rhythm: wasm.rhythm,
        form: wasm.form,
    };
}
/**
 * Perform complete music analysis.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz
 * @returns Complete analysis result
 */
export function analyze(samples, sampleRate) {
    if (!module) {
        throw new Error('Module not initialized. Call init() first.');
    }
    const result = module.analyze(samples, sampleRate);
    return convertAnalysisResult(result);
}
/**
 * Perform complete music analysis with progress reporting.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz
 * @param onProgress - Progress callback (progress: 0-1, stage: string)
 * @returns Complete analysis result
 */
export function analyzeWithProgress(samples, sampleRate, onProgress) {
    if (!module) {
        throw new Error('Module not initialized. Call init() first.');
    }
    const result = module.analyzeWithProgress(samples, sampleRate, onProgress);
    return convertAnalysisResult(result);
}
// ============================================================================
// Effects
// ============================================================================
/**
 * Perform Harmonic-Percussive Source Separation (HPSS).
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz
 * @param kernelHarmonic - Horizontal median filter size for harmonic (default: 31)
 * @param kernelPercussive - Vertical median filter size for percussive (default: 31)
 * @returns Separated harmonic and percussive components
 */
export function hpss(samples, sampleRate, kernelHarmonic = 31, kernelPercussive = 31) {
    if (!module) {
        throw new Error('Module not initialized. Call init() first.');
    }
    return module.hpss(samples, sampleRate, kernelHarmonic, kernelPercussive);
}
/**
 * Extract harmonic component from audio.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz
 * @returns Harmonic component
 */
export function harmonic(samples, sampleRate) {
    if (!module) {
        throw new Error('Module not initialized. Call init() first.');
    }
    return module.harmonic(samples, sampleRate);
}
/**
 * Extract percussive component from audio.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz
 * @returns Percussive component
 */
export function percussive(samples, sampleRate) {
    if (!module) {
        throw new Error('Module not initialized. Call init() first.');
    }
    return module.percussive(samples, sampleRate);
}
/**
 * Time-stretch audio without changing pitch.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz
 * @param rate - Time stretch rate (0.5 = double duration, 2.0 = half duration)
 * @returns Time-stretched audio
 */
export function timeStretch(samples, sampleRate, rate) {
    if (!module) {
        throw new Error('Module not initialized. Call init() first.');
    }
    return module.timeStretch(samples, sampleRate, rate);
}
/**
 * Pitch-shift audio without changing duration.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz
 * @param semitones - Pitch shift in semitones (+12 = one octave up, -12 = one octave down)
 * @returns Pitch-shifted audio
 */
export function pitchShift(samples, sampleRate, semitones) {
    if (!module) {
        throw new Error('Module not initialized. Call init() first.');
    }
    return module.pitchShift(samples, sampleRate, semitones);
}
/**
 * Normalize audio to target peak level.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz
 * @param targetDb - Target peak level in dB (default: 0 dB = full scale)
 * @returns Normalized audio
 */
export function normalize(samples, sampleRate, targetDb = 0.0) {
    if (!module) {
        throw new Error('Module not initialized. Call init() first.');
    }
    return module.normalize(samples, sampleRate, targetDb);
}
/**
 * Trim silence from beginning and end of audio.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz
 * @param thresholdDb - Silence threshold in dB (default: -60 dB)
 * @returns Trimmed audio
 */
export function trim(samples, sampleRate, thresholdDb = -60.0) {
    if (!module) {
        throw new Error('Module not initialized. Call init() first.');
    }
    return module.trim(samples, sampleRate, thresholdDb);
}
// ============================================================================
// Features - Spectrogram
// ============================================================================
/**
 * Compute Short-Time Fourier Transform (STFT).
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz
 * @param nFft - FFT size (default: 2048)
 * @param hopLength - Hop length (default: 512)
 * @returns STFT result with magnitude and power spectrograms
 */
export function stft(samples, sampleRate, nFft = 2048, hopLength = 512) {
    if (!module) {
        throw new Error('Module not initialized. Call init() first.');
    }
    return module.stft(samples, sampleRate, nFft, hopLength);
}
/**
 * Compute STFT and return magnitude in decibels.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz
 * @param nFft - FFT size (default: 2048)
 * @param hopLength - Hop length (default: 512)
 * @returns STFT result with dB values
 */
export function stftDb(samples, sampleRate, nFft = 2048, hopLength = 512) {
    if (!module) {
        throw new Error('Module not initialized. Call init() first.');
    }
    return module.stftDb(samples, sampleRate, nFft, hopLength);
}
// ============================================================================
// Features - Mel Spectrogram
// ============================================================================
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
export function melSpectrogram(samples, sampleRate, nFft = 2048, hopLength = 512, nMels = 128) {
    if (!module) {
        throw new Error('Module not initialized. Call init() first.');
    }
    return module.melSpectrogram(samples, sampleRate, nFft, hopLength, nMels);
}
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
export function mfcc(samples, sampleRate, nFft = 2048, hopLength = 512, nMels = 128, nMfcc = 13) {
    if (!module) {
        throw new Error('Module not initialized. Call init() first.');
    }
    return module.mfcc(samples, sampleRate, nFft, hopLength, nMels, nMfcc);
}
// ============================================================================
// Features - Chroma
// ============================================================================
/**
 * Compute chromagram (pitch class distribution).
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz
 * @param nFft - FFT size (default: 2048)
 * @param hopLength - Hop length (default: 512)
 * @returns Chroma features result
 */
export function chroma(samples, sampleRate, nFft = 2048, hopLength = 512) {
    if (!module) {
        throw new Error('Module not initialized. Call init() first.');
    }
    return module.chroma(samples, sampleRate, nFft, hopLength);
}
// ============================================================================
// Features - Spectral
// ============================================================================
/**
 * Compute spectral centroid (center of mass of spectrum).
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz
 * @param nFft - FFT size (default: 2048)
 * @param hopLength - Hop length (default: 512)
 * @returns Spectral centroid in Hz for each frame
 */
export function spectralCentroid(samples, sampleRate, nFft = 2048, hopLength = 512) {
    if (!module) {
        throw new Error('Module not initialized. Call init() first.');
    }
    return module.spectralCentroid(samples, sampleRate, nFft, hopLength);
}
/**
 * Compute spectral bandwidth.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz
 * @param nFft - FFT size (default: 2048)
 * @param hopLength - Hop length (default: 512)
 * @returns Spectral bandwidth in Hz for each frame
 */
export function spectralBandwidth(samples, sampleRate, nFft = 2048, hopLength = 512) {
    if (!module) {
        throw new Error('Module not initialized. Call init() first.');
    }
    return module.spectralBandwidth(samples, sampleRate, nFft, hopLength);
}
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
export function spectralRolloff(samples, sampleRate, nFft = 2048, hopLength = 512, rollPercent = 0.85) {
    if (!module) {
        throw new Error('Module not initialized. Call init() first.');
    }
    return module.spectralRolloff(samples, sampleRate, nFft, hopLength, rollPercent);
}
/**
 * Compute spectral flatness.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz
 * @param nFft - FFT size (default: 2048)
 * @param hopLength - Hop length (default: 512)
 * @returns Spectral flatness for each frame (0 = tonal, 1 = noise-like)
 */
export function spectralFlatness(samples, sampleRate, nFft = 2048, hopLength = 512) {
    if (!module) {
        throw new Error('Module not initialized. Call init() first.');
    }
    return module.spectralFlatness(samples, sampleRate, nFft, hopLength);
}
/**
 * Compute zero crossing rate.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz
 * @param frameLength - Frame length (default: 2048)
 * @param hopLength - Hop length (default: 512)
 * @returns Zero crossing rate for each frame
 */
export function zeroCrossingRate(samples, sampleRate, frameLength = 2048, hopLength = 512) {
    if (!module) {
        throw new Error('Module not initialized. Call init() first.');
    }
    return module.zeroCrossingRate(samples, sampleRate, frameLength, hopLength);
}
/**
 * Compute RMS energy.
 *
 * @param samples - Audio samples (mono, float32)
 * @param sampleRate - Sample rate in Hz
 * @param frameLength - Frame length (default: 2048)
 * @param hopLength - Hop length (default: 512)
 * @returns RMS energy for each frame
 */
export function rmsEnergy(samples, sampleRate, frameLength = 2048, hopLength = 512) {
    if (!module) {
        throw new Error('Module not initialized. Call init() first.');
    }
    return module.rmsEnergy(samples, sampleRate, frameLength, hopLength);
}
// ============================================================================
// Features - Pitch
// ============================================================================
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
export function pitchYin(samples, sampleRate, frameLength = 2048, hopLength = 512, fmin = 65.0, fmax = 2093.0, threshold = 0.3) {
    if (!module) {
        throw new Error('Module not initialized. Call init() first.');
    }
    return module.pitchYin(samples, sampleRate, frameLength, hopLength, fmin, fmax, threshold);
}
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
export function pitchPyin(samples, sampleRate, frameLength = 2048, hopLength = 512, fmin = 65.0, fmax = 2093.0, threshold = 0.3) {
    if (!module) {
        throw new Error('Module not initialized. Call init() first.');
    }
    return module.pitchPyin(samples, sampleRate, frameLength, hopLength, fmin, fmax, threshold);
}
// ============================================================================
// Core - Unit Conversion
// ============================================================================
/**
 * Convert frequency in Hz to Mel scale.
 *
 * @param hz - Frequency in Hz
 * @returns Mel frequency
 */
export function hzToMel(hz) {
    if (!module) {
        throw new Error('Module not initialized. Call init() first.');
    }
    return module.hzToMel(hz);
}
/**
 * Convert Mel scale to frequency in Hz.
 *
 * @param mel - Mel frequency
 * @returns Frequency in Hz
 */
export function melToHz(mel) {
    if (!module) {
        throw new Error('Module not initialized. Call init() first.');
    }
    return module.melToHz(mel);
}
/**
 * Convert frequency in Hz to MIDI note number.
 *
 * @param hz - Frequency in Hz
 * @returns MIDI note number (A4 = 440 Hz = 69)
 */
export function hzToMidi(hz) {
    if (!module) {
        throw new Error('Module not initialized. Call init() first.');
    }
    return module.hzToMidi(hz);
}
/**
 * Convert MIDI note number to frequency in Hz.
 *
 * @param midi - MIDI note number
 * @returns Frequency in Hz
 */
export function midiToHz(midi) {
    if (!module) {
        throw new Error('Module not initialized. Call init() first.');
    }
    return module.midiToHz(midi);
}
/**
 * Convert frequency in Hz to note name.
 *
 * @param hz - Frequency in Hz
 * @returns Note name (e.g., "A4", "C#5")
 */
export function hzToNote(hz) {
    if (!module) {
        throw new Error('Module not initialized. Call init() first.');
    }
    return module.hzToNote(hz);
}
/**
 * Convert note name to frequency in Hz.
 *
 * @param note - Note name (e.g., "A4", "C#5")
 * @returns Frequency in Hz
 */
export function noteToHz(note) {
    if (!module) {
        throw new Error('Module not initialized. Call init() first.');
    }
    return module.noteToHz(note);
}
/**
 * Convert frame index to time in seconds.
 *
 * @param frames - Frame index
 * @param sr - Sample rate in Hz
 * @param hopLength - Hop length in samples
 * @returns Time in seconds
 */
export function framesToTime(frames, sr, hopLength) {
    if (!module) {
        throw new Error('Module not initialized. Call init() first.');
    }
    return module.framesToTime(frames, sr, hopLength);
}
/**
 * Convert time in seconds to frame index.
 *
 * @param time - Time in seconds
 * @param sr - Sample rate in Hz
 * @param hopLength - Hop length in samples
 * @returns Frame index
 */
export function timeToFrames(time, sr, hopLength) {
    if (!module) {
        throw new Error('Module not initialized. Call init() first.');
    }
    return module.timeToFrames(time, sr, hopLength);
}
// ============================================================================
// Core - Resample
// ============================================================================
/**
 * Resample audio to a different sample rate.
 *
 * @param samples - Audio samples (mono, float32)
 * @param srcSr - Source sample rate in Hz
 * @param targetSr - Target sample rate in Hz
 * @returns Resampled audio
 */
export function resample(samples, srcSr, targetSr) {
    if (!module) {
        throw new Error('Module not initialized. Call init() first.');
    }
    return module.resample(samples, srcSr, targetSr);
}
// ============================================================================
// StreamAnalyzer Class
// ============================================================================
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
export class StreamAnalyzer {
    /**
     * Create a new StreamAnalyzer.
     *
     * @param config - Configuration options
     */
    constructor(config) {
        if (!module) {
            throw new Error('Module not initialized. Call init() first.');
        }
        this.analyzer = new module.StreamAnalyzer(config.sampleRate, config.nFft ?? 2048, config.hopLength ?? 512, config.nMels ?? 128, config.computeMel ?? true, config.computeChroma ?? true, config.computeOnset ?? true, config.emitEveryNFrames ?? 1);
    }
    /**
     * Process audio samples.
     *
     * @param samples - Audio samples (mono, float32)
     */
    process(samples) {
        this.analyzer.process(samples);
    }
    /**
     * Process audio samples with explicit sample offset.
     *
     * @param samples - Audio samples (mono, float32)
     * @param sampleOffset - Cumulative sample count at start of this chunk
     */
    processWithOffset(samples, sampleOffset) {
        this.analyzer.processWithOffset(samples, sampleOffset);
    }
    /**
     * Get the number of frames available to read.
     */
    availableFrames() {
        return this.analyzer.availableFrames();
    }
    /**
     * Read processed frames as Structure of Arrays.
     *
     * @param maxFrames - Maximum number of frames to read
     * @returns Frame buffer with analysis results
     */
    readFrames(maxFrames) {
        return this.analyzer.readFramesSoa(maxFrames);
    }
    /**
     * Reset the analyzer state.
     *
     * @param baseSampleOffset - Starting sample offset (default 0)
     */
    reset(baseSampleOffset = 0) {
        this.analyzer.reset(baseSampleOffset);
    }
    /**
     * Get current statistics and progressive estimates.
     *
     * @returns Analyzer statistics including BPM, key, and chord progression
     */
    stats() {
        const s = this.analyzer.stats();
        return {
            totalFrames: s.totalFrames,
            totalSamples: s.totalSamples,
            durationSeconds: s.durationSeconds,
            estimate: {
                bpm: s.estimate.bpm,
                bpmConfidence: s.estimate.bpmConfidence,
                bpmCandidateCount: s.estimate.bpmCandidateCount,
                key: s.estimate.key,
                keyMinor: s.estimate.keyMinor,
                keyConfidence: s.estimate.keyConfidence,
                chordRoot: s.estimate.chordRoot,
                chordQuality: s.estimate.chordQuality,
                chordConfidence: s.estimate.chordConfidence,
                chordProgression: s.estimate.chordProgression.map((c) => ({
                    root: c.root,
                    quality: c.quality,
                    startTime: c.startTime,
                    confidence: c.confidence,
                })),
                barChordProgression: s.estimate.barChordProgression.map((c) => ({
                    barIndex: c.barIndex,
                    root: c.root,
                    quality: c.quality,
                    startTime: c.startTime,
                    confidence: c.confidence,
                })),
                currentBar: s.estimate.currentBar,
                barDuration: s.estimate.barDuration,
                votedPattern: (s.estimate.votedPattern || []).map((c) => ({
                    barIndex: c.barIndex,
                    root: c.root,
                    quality: c.quality,
                    startTime: c.startTime,
                    confidence: c.confidence,
                })),
                patternLength: s.estimate.patternLength,
                detectedPatternName: s.estimate.detectedPatternName || '',
                detectedPatternScore: s.estimate.detectedPatternScore || 0,
                allPatternScores: (s.estimate.allPatternScores || []).map((p) => ({
                    name: p.name,
                    score: p.score,
                })),
                accumulatedSeconds: s.estimate.accumulatedSeconds,
                usedFrames: s.estimate.usedFrames,
                updated: s.estimate.updated,
            },
        };
    }
    /**
     * Get total frames processed.
     */
    frameCount() {
        return this.analyzer.frameCount();
    }
    /**
     * Get current time position in seconds.
     */
    currentTime() {
        return this.analyzer.currentTime();
    }
    /**
     * Get the sample rate.
     */
    sampleRate() {
        return this.analyzer.sampleRate();
    }
    /**
     * Set the expected total duration for pattern lock timing.
     *
     * @param durationSeconds - Total duration in seconds
     */
    setExpectedDuration(durationSeconds) {
        this.analyzer.setExpectedDuration(durationSeconds);
    }
    /**
     * Set normalization gain for loud/compressed audio.
     *
     * @param gain - Gain factor to apply (e.g., 0.5 for -6dB reduction)
     */
    setNormalizationGain(gain) {
        this.analyzer.setNormalizationGain(gain);
    }
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
    setTuningRefHz(refHz) {
        this.analyzer.setTuningRefHz(refHz);
    }
    /**
     * Release resources. Call when done using the analyzer.
     */
    dispose() {
        this.analyzer.delete();
    }
}
// ============================================================================
// Re-exports
// ============================================================================
export { PitchClass as Pitch };
