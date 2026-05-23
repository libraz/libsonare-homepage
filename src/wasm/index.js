// src/public_types.ts
var PitchClass = {
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
  B: 11
};
var Mode = {
  Major: 0,
  Minor: 1
};
var ChordQuality = {
  Major: 0,
  Minor: 1,
  Diminished: 2,
  Augmented: 3,
  Dominant7: 4,
  Major7: 5,
  Minor7: 6,
  Sus2: 7,
  Sus4: 8
};
var SectionType = {
  Intro: 0,
  Verse: 1,
  PreChorus: 2,
  Chorus: 3,
  Bridge: 4,
  Instrumental: 5,
  Outro: 6
};

// src/index.ts
var module = null;
var initPromise = null;
async function init(options) {
  if (module) {
    return;
  }
  if (initPromise) {
    return initPromise;
  }
  initPromise = (async () => {
    try {
      const createModule = (await import("./sonare.js")).default;
      module = await createModule(options);
    } catch (error) {
      initPromise = null;
      throw error;
    }
  })();
  return initPromise;
}
function isInitialized() {
  return module !== null;
}
function version() {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.version();
}
function detectBpm(samples, sampleRate) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.detectBpm(samples, sampleRate);
}
function detectKey(samples, sampleRate) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  const result = module.detectKey(samples, sampleRate);
  return {
    root: result.root,
    mode: result.mode,
    confidence: result.confidence,
    name: result.name,
    shortName: result.shortName
  };
}
function detectOnsets(samples, sampleRate) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.detectOnsets(samples, sampleRate);
}
function detectBeats(samples, sampleRate) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.detectBeats(samples, sampleRate);
}
function convertAnalysisResult(wasm) {
  const beatTimes = new Float32Array(wasm.beats.length);
  for (let i = 0; i < wasm.beats.length; i++) {
    beatTimes[i] = wasm.beats[i].time;
  }
  return {
    bpm: wasm.bpm,
    bpmConfidence: wasm.bpmConfidence,
    key: {
      root: wasm.key.root,
      mode: wasm.key.mode,
      confidence: wasm.key.confidence,
      name: wasm.key.name,
      shortName: wasm.key.shortName
    },
    timeSignature: wasm.timeSignature,
    beatTimes,
    beats: wasm.beats,
    chords: wasm.chords.map((c) => ({
      root: c.root,
      quality: c.quality,
      start: c.start,
      end: c.end,
      confidence: c.confidence,
      name: c.name
    })),
    sections: wasm.sections.map((s) => ({
      type: s.type,
      start: s.start,
      end: s.end,
      energyLevel: s.energyLevel,
      confidence: s.confidence,
      name: s.name
    })),
    timbre: wasm.timbre,
    dynamics: wasm.dynamics,
    rhythm: wasm.rhythm,
    form: wasm.form
  };
}
function analyze(samples, sampleRate) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  const result = module.analyze(samples, sampleRate);
  return convertAnalysisResult(result);
}
function analyzeWithProgress(samples, sampleRate, onProgress) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  const result = module.analyzeWithProgress(samples, sampleRate, onProgress);
  return convertAnalysisResult(result);
}
function hpss(samples, sampleRate, kernelHarmonic = 31, kernelPercussive = 31) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.hpss(samples, sampleRate, kernelHarmonic, kernelPercussive);
}
function harmonic(samples, sampleRate) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.harmonic(samples, sampleRate);
}
function percussive(samples, sampleRate) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.percussive(samples, sampleRate);
}
function timeStretch(samples, sampleRate, rate) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.timeStretch(samples, sampleRate, rate);
}
function pitchShift(samples, sampleRate, semitones) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.pitchShift(samples, sampleRate, semitones);
}
function normalize(samples, sampleRate, targetDb = 0) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.normalize(samples, sampleRate, targetDb);
}
function mastering(samples, sampleRate, targetLufs = -14, ceilingDb = -1, truePeakOversample = 4) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.mastering(samples, sampleRate, targetLufs, ceilingDb, truePeakOversample);
}
function masteringProcessorNames() {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.masteringProcessorNames();
}
function masteringPairProcessorNames() {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.masteringPairProcessorNames();
}
function masteringPairAnalysisNames() {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.masteringPairAnalysisNames();
}
function masteringStereoAnalysisNames() {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.masteringStereoAnalysisNames();
}
function masteringProcess(processorName, samples, sampleRate, params = {}) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.masteringProcess(processorName, samples, sampleRate, params);
}
function masteringProcessStereo(processorName, left, right, sampleRate, params = {}) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  if (left.length !== right.length) {
    throw new Error("Stereo channel lengths must match.");
  }
  return module.masteringProcessStereo(processorName, left, right, sampleRate, params);
}
function masteringPairProcess(processorName, source, reference, sampleRate, params = {}) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.masteringPairProcess(processorName, source, reference, sampleRate, params);
}
function masteringPairAnalyze(analysisName, source, reference, sampleRate, params = {}) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.masteringPairAnalyze(analysisName, source, reference, sampleRate, params);
}
function masteringStereoAnalyze(analysisName, left, right, sampleRate, params = {}) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.masteringStereoAnalyze(analysisName, left, right, sampleRate, params);
}
function masteringChain(samples, sampleRate, config) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.masteringChain(samples, sampleRate, config);
}
function masteringChainStereo(left, right, sampleRate, config) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  if (left.length !== right.length) {
    throw new Error("Stereo channel lengths must match.");
  }
  return module.masteringChainStereo(left, right, sampleRate, config);
}
function masteringChainWithProgress(samples, sampleRate, config, onProgress) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.masteringChainWithProgress(
    samples,
    sampleRate,
    config,
    onProgress
  );
}
function masteringChainStereoWithProgress(left, right, sampleRate, config, onProgress) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  if (left.length !== right.length) {
    throw new Error("Stereo channel lengths must match.");
  }
  return module.masteringChainStereoWithProgress(
    left,
    right,
    sampleRate,
    config,
    onProgress
  );
}
function masteringPresetNames() {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.masteringPresetNames();
}
function masterAudio(samples, sampleRate, presetName, overrides = null) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.masterAudio(presetName, samples, sampleRate, overrides);
}
function masterAudioStereo(left, right, sampleRate, presetName, overrides = null) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  if (left.length !== right.length) {
    throw new Error("Stereo channel lengths must match.");
  }
  return module.masterAudioStereo(presetName, left, right, sampleRate, overrides);
}
var StreamingMasteringChain = class {
  constructor(config) {
    if (!module) {
      throw new Error("Module not initialized. Call init() first.");
    }
    this.chain = module.createStreamingMasteringChain(config);
  }
  /**
   * Initialize processors for the given sample rate and block layout.
   *
   * @param sampleRate - Sample rate in Hz
   * @param maxBlockSize - Maximum block size per process call
   * @param numChannels - 1 (mono) or 2 (stereo)
   */
  prepare(sampleRate, maxBlockSize, numChannels) {
    this.chain.prepare(sampleRate, maxBlockSize, numChannels);
  }
  /**
   * Process one mono block, returning the processed samples (same length).
   */
  processMono(samples) {
    return this.chain.processMono(samples);
  }
  /**
   * Process one stereo block, returning the processed channels.
   */
  processStereo(left, right) {
    if (left.length !== right.length) {
      throw new Error("Stereo channel lengths must match.");
    }
    return this.chain.processStereo(left, right);
  }
  /** Reset all processor state without rebuilding. */
  reset() {
    this.chain.reset();
  }
  /** Total reported latency in samples across all active processors. */
  latencySamples() {
    return this.chain.latencySamples();
  }
  /** Ordered stage names that will run (e.g. `"eq.tilt"`). */
  stageNames() {
    return this.chain.stageNames();
  }
  /** Release the underlying WASM object. Safe to call only once. */
  delete() {
    this.chain.delete();
  }
};
function trim(samples, sampleRate, thresholdDb = -60) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.trim(samples, sampleRate, thresholdDb);
}
function stft(samples, sampleRate, nFft = 2048, hopLength = 512) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.stft(samples, sampleRate, nFft, hopLength);
}
function stftDb(samples, sampleRate, nFft = 2048, hopLength = 512) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.stftDb(samples, sampleRate, nFft, hopLength);
}
function melSpectrogram(samples, sampleRate, nFft = 2048, hopLength = 512, nMels = 128) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.melSpectrogram(samples, sampleRate, nFft, hopLength, nMels);
}
function mfcc(samples, sampleRate, nFft = 2048, hopLength = 512, nMels = 128, nMfcc = 13) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.mfcc(samples, sampleRate, nFft, hopLength, nMels, nMfcc);
}
function chroma(samples, sampleRate, nFft = 2048, hopLength = 512) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.chroma(samples, sampleRate, nFft, hopLength);
}
function spectralCentroid(samples, sampleRate, nFft = 2048, hopLength = 512) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.spectralCentroid(samples, sampleRate, nFft, hopLength);
}
function spectralBandwidth(samples, sampleRate, nFft = 2048, hopLength = 512) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.spectralBandwidth(samples, sampleRate, nFft, hopLength);
}
function spectralRolloff(samples, sampleRate, nFft = 2048, hopLength = 512, rollPercent = 0.85) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.spectralRolloff(samples, sampleRate, nFft, hopLength, rollPercent);
}
function spectralFlatness(samples, sampleRate, nFft = 2048, hopLength = 512) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.spectralFlatness(samples, sampleRate, nFft, hopLength);
}
function zeroCrossingRate(samples, sampleRate, frameLength = 2048, hopLength = 512) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.zeroCrossingRate(samples, sampleRate, frameLength, hopLength);
}
function rmsEnergy(samples, sampleRate, frameLength = 2048, hopLength = 512) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.rmsEnergy(samples, sampleRate, frameLength, hopLength);
}
function pitchYin(samples, sampleRate, frameLength = 2048, hopLength = 512, fmin = 65, fmax = 2093, threshold = 0.3) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.pitchYin(samples, sampleRate, frameLength, hopLength, fmin, fmax, threshold);
}
function pitchPyin(samples, sampleRate, frameLength = 2048, hopLength = 512, fmin = 65, fmax = 2093, threshold = 0.3) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.pitchPyin(samples, sampleRate, frameLength, hopLength, fmin, fmax, threshold);
}
function hzToMel(hz) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.hzToMel(hz);
}
function melToHz(mel) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.melToHz(mel);
}
function hzToMidi(hz) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.hzToMidi(hz);
}
function midiToHz(midi) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.midiToHz(midi);
}
function hzToNote(hz) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.hzToNote(hz);
}
function noteToHz(note) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.noteToHz(note);
}
function framesToTime(frames, sr, hopLength) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.framesToTime(frames, sr, hopLength);
}
function timeToFrames(time, sr, hopLength) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.timeToFrames(time, sr, hopLength);
}
function framesToSamples(frames, hopLength = 512, nFft = 0) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.framesToSamples(frames, hopLength, nFft);
}
function samplesToFrames(samples, hopLength = 512, nFft = 0) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.samplesToFrames(samples, hopLength, nFft);
}
function powerToDb(values, ref = 1, amin = 1e-10, topDb = 80) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.powerToDb(values, ref, amin, topDb);
}
function amplitudeToDb(values, ref = 1, amin = 1e-5, topDb = 80) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.amplitudeToDb(values, ref, amin, topDb);
}
function dbToPower(values, ref = 1) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.dbToPower(values, ref);
}
function dbToAmplitude(values, ref = 1) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.dbToAmplitude(values, ref);
}
function preemphasis(samples, coef = 0.97, zi) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.preemphasis(samples, coef, zi ?? null);
}
function deemphasis(samples, coef = 0.97, zi) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.deemphasis(samples, coef, zi ?? null);
}
function trimSilence(samples, topDb = 60, frameLength = 2048, hopLength = 512) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.trimSilence(samples, topDb, frameLength, hopLength);
}
function splitSilence(samples, topDb = 60, frameLength = 2048, hopLength = 512) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.splitSilence(samples, topDb, frameLength, hopLength);
}
function frameSignal(samples, frameLength, hopLength) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.frameSignal(samples, frameLength, hopLength);
}
function padCenter(values, size, padValue = 0) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.padCenter(values, size, padValue);
}
function fixLength(values, size, padValue = 0) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.fixLength(values, size, padValue);
}
function fixFrames(frames, xMin = 0, xMax = -1, pad = true) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.fixFrames(frames, xMin, xMax, pad);
}
function peakPick(values, preMax, postMax, preAvg, postAvg, delta, wait) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.peakPick(values, preMax, postMax, preAvg, postAvg, delta, wait);
}
function vectorNormalize(values, normType = 0, threshold = 1e-12) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.vectorNormalize(values, normType, threshold);
}
function pcen(values, nBins, nFrames, options = {}) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.pcen(values, nBins, nFrames, options);
}
function tonnetz(chromagram, nChroma, nFrames) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.tonnetz(chromagram, nChroma, nFrames);
}
function tempogram(onsetEnvelope, sampleRate, hopLength = 512, winLength = 384) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.tempogram(onsetEnvelope, sampleRate, hopLength, winLength);
}
function plp(onsetEnvelope, sampleRate, hopLength = 512, tempoMin = 30, tempoMax = 300, winLength = 384) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.plp(onsetEnvelope, sampleRate, hopLength, tempoMin, tempoMax, winLength);
}
function resample(samples, srcSr, targetSr) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.resample(samples, srcSr, targetSr);
}
var Audio = class _Audio {
  constructor(samples, sampleRate) {
    this._samples = samples;
    this._sampleRate = sampleRate;
  }
  /** Create an Audio instance from raw sample data. */
  static fromBuffer(samples, sampleRate) {
    return new _Audio(samples, sampleRate);
  }
  /** The raw audio samples. */
  get data() {
    return this._samples;
  }
  /** Number of samples. */
  get length() {
    return this._samples.length;
  }
  /** Sample rate in Hz. */
  get sampleRate() {
    return this._sampleRate;
  }
  /** Duration in seconds. */
  get duration() {
    return this._samples.length / this._sampleRate;
  }
  // -- Analysis --
  detectBpm() {
    return detectBpm(this._samples, this._sampleRate);
  }
  detectKey() {
    return detectKey(this._samples, this._sampleRate);
  }
  detectOnsets() {
    return detectOnsets(this._samples, this._sampleRate);
  }
  detectBeats() {
    return detectBeats(this._samples, this._sampleRate);
  }
  analyze() {
    return analyze(this._samples, this._sampleRate);
  }
  analyzeWithProgress(onProgress) {
    return analyzeWithProgress(this._samples, this._sampleRate, onProgress);
  }
  // -- Effects --
  hpss(kernelHarmonic = 31, kernelPercussive = 31) {
    return hpss(this._samples, this._sampleRate, kernelHarmonic, kernelPercussive);
  }
  harmonic() {
    return harmonic(this._samples, this._sampleRate);
  }
  percussive() {
    return percussive(this._samples, this._sampleRate);
  }
  timeStretch(rate) {
    return timeStretch(this._samples, this._sampleRate, rate);
  }
  pitchShift(semitones) {
    return pitchShift(this._samples, this._sampleRate, semitones);
  }
  normalize(targetDb = 0) {
    return normalize(this._samples, this._sampleRate, targetDb);
  }
  mastering(targetLufs = -14, ceilingDb = -1, truePeakOversample = 4) {
    return mastering(this._samples, this._sampleRate, targetLufs, ceilingDb, truePeakOversample);
  }
  masteringChain(config) {
    return masteringChain(this._samples, this._sampleRate, config);
  }
  masterAudio(presetName, overrides = null) {
    return masterAudio(this._samples, this._sampleRate, presetName, overrides);
  }
  masteringProcess(processorName, params = {}) {
    return masteringProcess(processorName, this._samples, this._sampleRate, params);
  }
  trim(thresholdDb = -60) {
    return trim(this._samples, this._sampleRate, thresholdDb);
  }
  // -- Features --
  stft(nFft = 2048, hopLength = 512) {
    return stft(this._samples, this._sampleRate, nFft, hopLength);
  }
  stftDb(nFft = 2048, hopLength = 512) {
    return stftDb(this._samples, this._sampleRate, nFft, hopLength);
  }
  melSpectrogram(nFft = 2048, hopLength = 512, nMels = 128) {
    return melSpectrogram(this._samples, this._sampleRate, nFft, hopLength, nMels);
  }
  mfcc(nFft = 2048, hopLength = 512, nMels = 128, nMfcc = 13) {
    return mfcc(this._samples, this._sampleRate, nFft, hopLength, nMels, nMfcc);
  }
  chroma(nFft = 2048, hopLength = 512) {
    return chroma(this._samples, this._sampleRate, nFft, hopLength);
  }
  spectralCentroid(nFft = 2048, hopLength = 512) {
    return spectralCentroid(this._samples, this._sampleRate, nFft, hopLength);
  }
  spectralBandwidth(nFft = 2048, hopLength = 512) {
    return spectralBandwidth(this._samples, this._sampleRate, nFft, hopLength);
  }
  spectralRolloff(nFft = 2048, hopLength = 512, rollPercent = 0.85) {
    return spectralRolloff(this._samples, this._sampleRate, nFft, hopLength, rollPercent);
  }
  spectralFlatness(nFft = 2048, hopLength = 512) {
    return spectralFlatness(this._samples, this._sampleRate, nFft, hopLength);
  }
  zeroCrossingRate(frameLength = 2048, hopLength = 512) {
    return zeroCrossingRate(this._samples, this._sampleRate, frameLength, hopLength);
  }
  rmsEnergy(frameLength = 2048, hopLength = 512) {
    return rmsEnergy(this._samples, this._sampleRate, frameLength, hopLength);
  }
  pitchYin(frameLength = 2048, hopLength = 512, fmin = 65, fmax = 2093, threshold = 0.3) {
    return pitchYin(this._samples, this._sampleRate, frameLength, hopLength, fmin, fmax, threshold);
  }
  pitchPyin(frameLength = 2048, hopLength = 512, fmin = 65, fmax = 2093, threshold = 0.3) {
    return pitchPyin(
      this._samples,
      this._sampleRate,
      frameLength,
      hopLength,
      fmin,
      fmax,
      threshold
    );
  }
  resample(targetSr) {
    return resample(this._samples, this._sampleRate, targetSr);
  }
};
var StreamAnalyzer = class {
  /**
   * Create a new StreamAnalyzer.
   *
   * @param config - Configuration options
   */
  constructor(config) {
    if (!module) {
      throw new Error("Module not initialized. Call init() first.");
    }
    this.analyzer = new module.StreamAnalyzer(
      config.sampleRate,
      config.nFft ?? 2048,
      config.hopLength ?? 512,
      config.nMels ?? 128,
      config.computeMel ?? true,
      config.computeChroma ?? true,
      config.computeOnset ?? true,
      config.emitEveryNFrames ?? 1
    );
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
          confidence: c.confidence
        })),
        barChordProgression: s.estimate.barChordProgression.map((c) => ({
          barIndex: c.barIndex,
          root: c.root,
          quality: c.quality,
          startTime: c.startTime,
          confidence: c.confidence
        })),
        currentBar: s.estimate.currentBar,
        barDuration: s.estimate.barDuration,
        votedPattern: (s.estimate.votedPattern || []).map((c) => ({
          barIndex: c.barIndex,
          root: c.root,
          quality: c.quality,
          startTime: c.startTime,
          confidence: c.confidence
        })),
        patternLength: s.estimate.patternLength,
        detectedPatternName: s.estimate.detectedPatternName || "",
        detectedPatternScore: s.estimate.detectedPatternScore || 0,
        allPatternScores: (s.estimate.allPatternScores || []).map((p) => ({
          name: p.name,
          score: p.score
        })),
        accumulatedSeconds: s.estimate.accumulatedSeconds,
        usedFrames: s.estimate.usedFrames,
        updated: s.estimate.updated
      }
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
};
export {
  Audio,
  ChordQuality,
  Mode,
  PitchClass as Pitch,
  PitchClass,
  SectionType,
  StreamAnalyzer,
  StreamingMasteringChain,
  amplitudeToDb,
  analyze,
  analyzeWithProgress,
  chroma,
  dbToAmplitude,
  dbToPower,
  deemphasis,
  detectBeats,
  detectBpm,
  detectKey,
  detectOnsets,
  fixFrames,
  fixLength,
  frameSignal,
  framesToSamples,
  framesToTime,
  harmonic,
  hpss,
  hzToMel,
  hzToMidi,
  hzToNote,
  init,
  isInitialized,
  masterAudio,
  masterAudioStereo,
  mastering,
  masteringChain,
  masteringChainStereo,
  masteringChainStereoWithProgress,
  masteringChainWithProgress,
  masteringPairAnalysisNames,
  masteringPairAnalyze,
  masteringPairProcess,
  masteringPairProcessorNames,
  masteringPresetNames,
  masteringProcess,
  masteringProcessStereo,
  masteringProcessorNames,
  masteringStereoAnalysisNames,
  masteringStereoAnalyze,
  melSpectrogram,
  melToHz,
  mfcc,
  midiToHz,
  normalize,
  noteToHz,
  padCenter,
  pcen,
  peakPick,
  percussive,
  pitchPyin,
  pitchShift,
  pitchYin,
  plp,
  powerToDb,
  preemphasis,
  resample,
  rmsEnergy,
  samplesToFrames,
  spectralBandwidth,
  spectralCentroid,
  spectralFlatness,
  spectralRolloff,
  splitSilence,
  stft,
  stftDb,
  tempogram,
  timeStretch,
  timeToFrames,
  tonnetz,
  trim,
  trimSilence,
  vectorNormalize,
  version,
  zeroCrossingRate
};
