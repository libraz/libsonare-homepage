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
  Minor: 1,
  Dorian: 2,
  Phrygian: 3,
  Lydian: 4,
  Mixolydian: 5,
  Locrian: 6
};
var KeyProfile = {
  KrumhanslSchmuckler: 0,
  Temperley: 1,
  Shaath: 2,
  FaraldoEDMT: 3,
  FaraldoEDMA: 4,
  FaraldoEDMM: 5,
  BellmanBudge: 6
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
  Sus4: 8,
  Unknown: 9,
  Add9: 10,
  MinorAdd9: 11,
  Dim7: 12,
  HalfDim7: 13,
  Major9: 14,
  Dominant9: 15,
  Sus2Add4: 16
};
var SectionType = {
  Intro: 0,
  Verse: 1,
  PreChorus: 2,
  Chorus: 3,
  Bridge: 4,
  Instrumental: 5,
  Outro: 6,
  Unknown: 7
};

// src/index.ts
var EXPECTED_ENGINE_ABI_VERSION = 2;
function automationCurveCode(curve) {
  switch (curve) {
    case "linear":
      return 0;
    case "exponential":
      return 1;
    case "hold":
      return 2;
    case "s-curve":
      return 3;
    default:
      throw new Error(`Invalid automation curve: ${curve}`);
  }
}
function panLawCode(panLaw) {
  if (typeof panLaw === "number") {
    return panLaw;
  }
  switch (panLaw) {
    case "const4.5dB":
      return 1;
    case "const6dB":
      return 2;
    case "linear0dB":
      return 3;
    default:
      return 0;
  }
}
function meterTapCode(tap) {
  return tap === "preFader" || tap === 0 ? 0 : 1;
}
function sendTimingCode(timing) {
  return timing === "preFader" || timing === 0 ? 0 : 1;
}
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
function engineAbiVersion() {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.engineAbiVersion();
}
function engineCapabilities() {
  const abiVersion = engineAbiVersion();
  const sharedArrayBuffer = typeof globalThis.SharedArrayBuffer === "function";
  const atomics = typeof globalThis.Atomics === "object";
  const audioWorklet = typeof AudioWorkletNode !== "undefined" || typeof globalThis.AudioWorkletProcessor !== "undefined";
  return {
    engineAbiVersion: abiVersion,
    expectedEngineAbiVersion: EXPECTED_ENGINE_ABI_VERSION,
    abiCompatible: abiVersion === EXPECTED_ENGINE_ABI_VERSION,
    sharedArrayBuffer,
    atomics,
    audioWorklet,
    mode: sharedArrayBuffer && atomics ? "sab" : "postMessage"
  };
}
var RealtimeEngine = class {
  constructor(sampleRate = 48e3, maxBlockSize = 128, commandCapacity = 1024, telemetryCapacity = 1024) {
    if (!module) {
      throw new Error("Module not initialized. Call init() first.");
    }
    const capabilities = engineCapabilities();
    if (!capabilities.abiCompatible) {
      throw new Error(
        `Engine ABI mismatch: wasm=${capabilities.engineAbiVersion}, expected=${capabilities.expectedEngineAbiVersion}`
      );
    }
    this.native = new module.RealtimeEngine(
      sampleRate,
      maxBlockSize,
      commandCapacity,
      telemetryCapacity
    );
  }
  prepare(sampleRate, maxBlockSize, commandCapacity = 1024, telemetryCapacity = 1024) {
    this.native.prepare(sampleRate, maxBlockSize, commandCapacity, telemetryCapacity);
  }
  /** Queue a sample-accurate parameter change (engine kSetParam). */
  setParameter(paramId, value, renderFrame = -1) {
    this.native.setParameter(paramId, value, renderFrame);
  }
  /** Queue a smoothed parameter change (engine kSetParamSmoothed). */
  setParameterSmoothed(paramId, value, renderFrame = -1) {
    this.native.setParameterSmoothed(paramId, value, renderFrame);
  }
  /** Read back the current transport state snapshot. */
  getTransportState() {
    return this.native.getTransportState();
  }
  play(renderFrame = -1) {
    this.native.play(renderFrame);
  }
  stop(renderFrame = -1) {
    this.native.stop(renderFrame);
  }
  seekSample(timelineSample, renderFrame = -1) {
    this.native.seekSample(timelineSample, renderFrame);
  }
  seekPpq(ppq, renderFrame = -1) {
    this.native.seekPpq(ppq, renderFrame);
  }
  setTempo(bpm) {
    this.native.setTempo(bpm);
  }
  setTimeSignature(numerator, denominator) {
    this.native.setTimeSignature(numerator, denominator);
  }
  setLoop(startPpq, endPpq, enabled = true) {
    this.native.setLoop(startPpq, endPpq, enabled);
  }
  addParameter(info) {
    this.native.addParameter(info);
  }
  parameterCount() {
    return this.native.parameterCount();
  }
  parameterInfoByIndex(index) {
    return this.native.parameterInfoByIndex(index);
  }
  parameterInfo(id) {
    return this.native.parameterInfo(id);
  }
  setAutomationLane(paramId, points) {
    this.native.setAutomationLane(paramId, points);
  }
  automationLaneCount() {
    return this.native.automationLaneCount();
  }
  setMarkers(markers) {
    this.native.setMarkers(markers);
  }
  markerCount() {
    return this.native.markerCount();
  }
  markerByIndex(index) {
    return this.native.markerByIndex(index);
  }
  marker(id) {
    return this.native.marker(id);
  }
  seekMarker(markerId, renderFrame = -1) {
    this.native.seekMarker(markerId, renderFrame);
  }
  setLoopFromMarkers(startMarkerId, endMarkerId) {
    this.native.setLoopFromMarkers(startMarkerId, endMarkerId);
  }
  setMetronome(config) {
    this.native.setMetronome(config);
  }
  metronome() {
    return this.native.metronome();
  }
  countInEndSample(startSample, bars) {
    return Number(this.native.countInEndSample(startSample, bars));
  }
  setGraph(spec) {
    this.native.setGraph(spec);
  }
  graphNodeCount() {
    return this.native.graphNodeCount();
  }
  graphConnectionCount() {
    return this.native.graphConnectionCount();
  }
  setClips(clips) {
    this.native.setClips(clips);
  }
  clipCount() {
    return this.native.clipCount();
  }
  setCaptureBuffer(numChannels, capacityFrames) {
    this.native.setCaptureBuffer(numChannels, capacityFrames);
  }
  armCapture(armed = true) {
    this.native.armCapture(armed);
  }
  setCapturePunch(startSample, endSample, enabled = true) {
    this.native.setCapturePunch(startSample, endSample, enabled);
  }
  resetCapture() {
    this.native.resetCapture();
  }
  captureStatus() {
    return this.native.captureStatus();
  }
  capturedAudio() {
    return this.native.capturedAudio();
  }
  process(channels) {
    return this.native.process(channels);
  }
  processWithMonitor(channels) {
    return this.native.processWithMonitor(channels);
  }
  renderOffline(channels, blockSize = 128) {
    return this.native.renderOffline(channels, blockSize);
  }
  bounceOffline(options) {
    return this.native.bounceOffline(options);
  }
  freezeOffline(options) {
    return this.native.freezeOffline(options);
  }
  drainTelemetry(maxRecords = 1024) {
    return this.native.drainTelemetry(maxRecords);
  }
  drainMeterTelemetry(maxRecords = 1024) {
    return this.native.drainMeterTelemetry(maxRecords);
  }
  destroy() {
    this.native.delete();
  }
};
function detectBpm(samples, sampleRate) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.detectBpm(samples, sampleRate);
}
function detectKey(samples, sampleRate, options = {}) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  const result = module._detectKeyWithOptions(
    samples,
    sampleRate,
    options.nFft ?? 4096,
    options.hopLength ?? 512,
    options.useHpss ?? false,
    options.loudnessWeighted ?? false,
    options.highPassHz ?? 0,
    keyModeValues(options.modes),
    keyProfileValue(options.profile),
    options.genreHint ?? ""
  );
  return {
    root: result.root,
    mode: result.mode,
    confidence: result.confidence,
    name: result.name,
    shortName: result.shortName
  };
}
function convertKeyCandidate(wasm) {
  return {
    key: {
      root: wasm.key.root,
      mode: wasm.key.mode,
      confidence: wasm.key.confidence,
      name: wasm.key.name,
      shortName: wasm.key.shortName
    },
    correlation: wasm.correlation
  };
}
function keyModeValues(modes) {
  if (!modes) {
    return [];
  }
  if (modes === "major-minor") {
    return [Mode.Major, Mode.Minor];
  }
  if (modes === "all" || modes === "modal") {
    return [
      Mode.Major,
      Mode.Minor,
      Mode.Dorian,
      Mode.Phrygian,
      Mode.Lydian,
      Mode.Mixolydian,
      Mode.Locrian
    ];
  }
  const names = {
    major: Mode.Major,
    minor: Mode.Minor,
    dorian: Mode.Dorian,
    phrygian: Mode.Phrygian,
    lydian: Mode.Lydian,
    mixolydian: Mode.Mixolydian,
    locrian: Mode.Locrian
  };
  return modes.map((mode) => typeof mode === "number" ? mode : names[mode]);
}
function keyProfileValue(profile) {
  if (profile === void 0) {
    return -1;
  }
  if (typeof profile === "number") {
    return profile;
  }
  const names = {
    ks: KeyProfile.KrumhanslSchmuckler,
    krumhansl: KeyProfile.KrumhanslSchmuckler,
    temperley: KeyProfile.Temperley,
    shaath: KeyProfile.Shaath,
    keyfinder: KeyProfile.Shaath,
    "faraldo-edmt": KeyProfile.FaraldoEDMT,
    edmt: KeyProfile.FaraldoEDMT,
    "faraldo-edma": KeyProfile.FaraldoEDMA,
    edma: KeyProfile.FaraldoEDMA,
    "faraldo-edmm": KeyProfile.FaraldoEDMM,
    edmm: KeyProfile.FaraldoEDMM,
    "bellman-budge": KeyProfile.BellmanBudge,
    bellman: KeyProfile.BellmanBudge
  };
  return names[profile];
}
function detectKeyCandidates(samples, sampleRate, options = {}) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module._detectKeyCandidates(
    samples,
    sampleRate,
    options.nFft ?? 4096,
    options.hopLength ?? 512,
    options.useHpss ?? false,
    options.loudnessWeighted ?? false,
    options.highPassHz ?? 0,
    keyModeValues(options.modes),
    keyProfileValue(options.profile),
    options.genreHint ?? ""
  ).map(convertKeyCandidate);
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
function detectDownbeats(samples, sampleRate) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.detectDownbeats(samples, sampleRate);
}
function convertChordAnalysisResult(wasm) {
  return {
    chords: wasm.chords.map((c) => ({
      root: c.root,
      bass: c.bass,
      quality: c.quality,
      start: c.start,
      end: c.end,
      confidence: c.confidence,
      name: c.name
    }))
  };
}
function detectChords(samples, sampleRate, options = {}) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  const result = module.detectChords(
    samples,
    sampleRate,
    options.minDuration ?? 0.3,
    options.smoothingWindow ?? 2,
    options.threshold ?? 0.5,
    options.useTriadsOnly ?? false,
    options.nFft ?? 2048,
    options.hopLength ?? 512,
    options.useBeatSync ?? true,
    options.useHmm ?? false,
    options.hmmBeamWidth ?? 24,
    options.useKeyContext ?? false,
    options.keyRoot ?? PitchClass.C,
    options.keyMode ?? Mode.Major,
    options.detectInversions ?? false,
    chordChromaMethodValue(options.chromaMethod ?? "stft")
  );
  return convertChordAnalysisResult(result);
}
function chordChromaMethodValue(method) {
  if (method === "stft") {
    return 0;
  }
  if (method === "nnls") {
    return 1;
  }
  throw new Error(`Invalid chord chroma method: ${method}`);
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
      bass: c.bass,
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
function analyzeImpulseResponse(samples, sampleRate, nOctaveBands = 6) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  const result = module.analyzeImpulseResponse(
    samples,
    sampleRate,
    nOctaveBands
  );
  return result;
}
function detectAcoustic(samples, sampleRate, nOctaveBands = 6, nThirdOctaveSubbands = 24, minDecayDb = 30, noiseFloorMarginDb = 10) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  const result = module.detectAcoustic(
    samples,
    sampleRate,
    nOctaveBands,
    nThirdOctaveSubbands,
    minDecayDb,
    noiseFloorMarginDb
  );
  return result;
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
function pitchCorrectToMidi(samples, sampleRate, currentMidi, targetMidi) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.pitchCorrectToMidi(samples, sampleRate, currentMidi, targetMidi);
}
function noteStretch(samples, sampleRate, onsetSample, offsetSample, stretchRatio) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.noteStretch(samples, sampleRate, onsetSample, offsetSample, stretchRatio);
}
function voiceChange(samples, sampleRate, pitchSemitones, formantFactor) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.voiceChange(samples, sampleRate, pitchSemitones, formantFactor);
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
function masteringAssistantSuggest(samples, sampleRate, params = {}) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.masteringAssistantSuggest(samples, sampleRate, params);
}
function masteringAudioProfile(samples, sampleRate, params = {}) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.masteringAudioProfile(samples, sampleRate, params);
}
function masteringStreamingPreview(samples, sampleRate, platforms = []) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.masteringStreamingPreview(samples, sampleRate, platforms);
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
function mixingScenePresetNames() {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.mixingScenePresetNames();
}
function mixingScenePresetJson(preset) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.mixingScenePresetJson(preset);
}
function mixStereo(leftChannels, rightChannels, sampleRate = 48e3, options = {}) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  if (leftChannels.length === 0 || leftChannels.length !== rightChannels.length) {
    throw new Error("leftChannels and rightChannels must have the same non-zero length.");
  }
  return module.mixStereo(
    leftChannels,
    rightChannels,
    sampleRate,
    options
  );
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
var StreamingEqualizer = class {
  constructor(config = {}) {
    if (!module) {
      throw new Error("Module not initialized. Call init() first.");
    }
    this.eq = module.createEqualizer(config);
  }
  /**
   * Configure the band at `index` (0..23). Omitted fields use C++ defaults.
   */
  setBand(index, band) {
    this.eq.setBand(index, band);
  }
  /** Disable and reset every band. */
  clear() {
    this.eq.clear();
  }
  /**
   * Set the global phase mode: 1=ZeroLatency, 2=NaturalPhase, 3=LinearPhase.
   */
  setPhaseMode(mode) {
    this.eq.setPhaseMode(mode);
  }
  /** Enable or disable output auto-gain compensation. */
  setAutoGain(enabled) {
    this.eq.setAutoGain(enabled);
  }
  /** Set all-band EQ gain scale as a 0.0..2.0 multiplier. */
  setGainScale(scale) {
    this.eq.setGainScale(scale);
  }
  /** Set post-EQ output gain in dB. */
  setOutputGainDb(gainDb) {
    this.eq.setOutputGainDb(gainDb);
  }
  /** Set post-EQ stereo balance in -1.0..1.0; mono input ignores pan. */
  setOutputPan(pan) {
    this.eq.setOutputPan(pan);
  }
  /**
   * Provide a mono external sidechain key for dynamic bands that opt into
   * `external_sidechain`. The samples are copied into an owned buffer.
   */
  setSidechainMono(samples) {
    this.eq.setSidechainMono(samples);
  }
  /**
   * Provide a stereo external sidechain key. Both channels must match length.
   */
  setSidechainStereo(left, right) {
    if (left.length !== right.length) {
      throw new Error("Sidechain channel lengths must match.");
    }
    this.eq.setSidechainStereo(left, right);
  }
  /** Release any borrowed external sidechain buffers. */
  clearSidechain() {
    this.eq.clearSidechain();
  }
  /** Auto-gain applied on the most recent block, in dB. */
  lastAutoGainDb() {
    return this.eq.lastAutoGainDb();
  }
  /** Reported processing latency in samples (non-zero for linear-phase bands). */
  latencySamples() {
    return this.eq.latencySamples();
  }
  /**
   * Process one mono block, returning the equalized samples (same length).
   */
  processMono(samples) {
    return this.eq.processMono(samples);
  }
  /**
   * Process one stereo block, returning the equalized channels.
   */
  processStereo(left, right) {
    if (left.length !== right.length) {
      throw new Error("Stereo channel lengths must match.");
    }
    return this.eq.processStereo(left, right);
  }
  /**
   * Read the latest pre/post spectrum snapshot for metering. `seq` increments
   * each time a new snapshot is published.
   */
  spectrum() {
    return this.eq.spectrum();
  }
  /**
   * Configure bands so the source spectrum matches the reference spectrum.
   *
   * @param source - Source audio (mono samples)
   * @param reference - Reference audio (mono samples)
   * @param options - `sampleRate` (default 48000) and `maxBands` (default 8)
   */
  match(source, reference, options = {}) {
    this.eq.match(source, reference, options);
  }
  /** Release the underlying WASM object. Safe to call only once. */
  delete() {
    this.eq.delete();
  }
};
var StreamingRetune = class {
  constructor(config = {}) {
    if (!module) {
      throw new Error("Module not initialized. Call init() first.");
    }
    this.retune = module.createStreamingRetune(config);
  }
  /**
   * Allocate and initialize native state for the given sample rate and maximum
   * process block size.
   */
  prepare(sampleRate, maxBlockSize) {
    this.retune.prepare(sampleRate, maxBlockSize);
  }
  /** Reset delay, grain, and overlap-add state without changing config. */
  reset() {
    this.retune.reset();
  }
  /**
   * Update retune settings. Changing `grainSize` takes effect after the next
   * {@link prepare} call.
   */
  setConfig(config) {
    this.retune.setConfig(config);
  }
  /** Current native config. */
  config() {
    return this.retune.config();
  }
  /** Resolved grain size in samples after {@link prepare}. */
  grainSize() {
    return this.retune.grainSize();
  }
  /** Process one mono block, returning the shifted samples (same length). */
  processMono(samples) {
    return this.retune.processMono(samples);
  }
  /** Release the underlying WASM object. Safe to call only once. */
  delete() {
    this.retune.delete();
  }
};
function mixerScenePresetJson(preset) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.mixerPresetJson(preset);
}
var Mixer = class _Mixer {
  constructor(mixer) {
    this.mixer = mixer;
  }
  /**
   * Build a mixer from a scene JSON string.
   *
   * @param json - Scene JSON (strips, buses, sends, connections, inserts)
   * @param sampleRate - Sample rate in Hz (default: 48000)
   * @param blockSize - Maximum block size per {@link processStereo} call (default: 512)
   */
  static fromSceneJson(json, sampleRate = 48e3, blockSize = 512) {
    if (!module) {
      throw new Error("Module not initialized. Call init() first.");
    }
    return new _Mixer(module.createMixerFromSceneJson(json, sampleRate, blockSize));
  }
  /** Rebuild and compile the routing graph from the current scene topology. */
  compile() {
    this.mixer.compile();
  }
  /**
   * Mix one block of per-strip stereo audio into the stereo master.
   *
   * @param leftChannels - `leftChannels[i]` is the left channel of strip `i`
   * @param rightChannels - `rightChannels[i]` is the right channel of strip `i`
   * @returns Mixed stereo master (`left`, `right`, `sampleRate`)
   */
  processStereo(leftChannels, rightChannels) {
    if (leftChannels.length !== rightChannels.length) {
      throw new Error("leftChannels and rightChannels must have the same length.");
    }
    return this.mixer.processStereo(leftChannels, rightChannels);
  }
  /**
   * Mix one block into caller-owned output arrays.
   *
   * This avoids allocating the result object and result `Float32Array`s. It is
   * intended for realtime bridges such as AudioWorklet; the input channel count
   * must match the scene strip count and all arrays must have the same length.
   */
  processStereoInto(leftChannels, rightChannels, outLeft, outRight) {
    if (leftChannels.length !== rightChannels.length) {
      throw new Error("leftChannels and rightChannels must have the same length.");
    }
    if (outLeft.length !== outRight.length) {
      throw new Error("outLeft and outRight must have the same length.");
    }
    this.mixer.processStereoInto(leftChannels, rightChannels, outLeft, outRight);
  }
  /**
   * Create reusable WASM-heap input/output views for realtime-style processing.
   *
   * Fill `leftInputs[i]` / `rightInputs[i]`, call `process()`, then read
   * `outLeft` / `outRight`. The views are owned by this mixer and become invalid
   * after {@link delete}.
   */
  createRealtimeBuffer() {
    const stripCount = this.stripCount();
    const leftInputs = [];
    const rightInputs = [];
    for (let index = 0; index < stripCount; index++) {
      leftInputs.push(this.mixer.inputLeftView(index));
      rightInputs.push(this.mixer.inputRightView(index));
    }
    const outLeft = this.mixer.outputLeftView();
    const outRight = this.mixer.outputRightView();
    return {
      leftInputs,
      rightInputs,
      outLeft,
      outRight,
      process: (numSamples = outLeft.length) => this.mixer.processPreparedStereo(numSamples)
    };
  }
  /** Number of strips in the mixer (e.g. strips loaded from the scene). */
  stripCount() {
    return this.mixer.stripCount();
  }
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
  scheduleInsertAutomation(stripIndex, insertIndex, paramId, samplePos, value, curve = "linear") {
    this.mixer.scheduleInsertAutomation(
      stripIndex,
      insertIndex,
      paramId,
      samplePos,
      value,
      automationCurveCode(curve)
    );
  }
  /**
   * Resolve a strip's index in `[0, stripCount())` from its scene id, or `null`
   * when no strip with that id exists (matches the Node binding's `number | null`).
   */
  stripById(id) {
    const index = this.mixer.stripById(id);
    return index < 0 ? null : index;
  }
  /**
   * Add a bus to the mixer topology. `role` is one of `'master'`, `'aux'`, or
   * `'submix'` (defaults to `'aux'`). Marks the routing graph dirty; call
   * {@link compile} (or {@link processStereo}) to rebuild.
   */
  addBus(id, role = "aux") {
    this.mixer.addBus(id, role);
  }
  /** Remove a bus by id. Marks the routing graph dirty. */
  removeBus(id) {
    this.mixer.removeBus(id);
  }
  /** Number of buses in the mixer topology. */
  busCount() {
    return this.mixer.busCount();
  }
  /**
   * Add a VCA group with the given gain offset (dB). `members` is a list of
   * strip ids governed by the group (may be empty).
   */
  addVcaGroup(id, gainDb = 0, members = []) {
    this.mixer.addVcaGroup(id, gainDb, members);
  }
  /** Remove a VCA group by id. */
  removeVcaGroup(id) {
    this.mixer.removeVcaGroup(id);
  }
  /** Number of VCA groups in the mixer topology. */
  vcaGroupCount() {
    return this.mixer.vcaGroupCount();
  }
  /**
   * Set a strip's solo state. Takes effect on the next process without a
   * graph recompile.
   */
  setSoloed(stripIndex, soloed) {
    this.mixer.setSoloed(stripIndex, soloed);
  }
  /**
   * Mark a strip solo-safe so it is never implied-muted by another strip's
   * solo. Takes effect on the next process without a graph recompile.
   */
  setSoloSafe(stripIndex, soloSafe) {
    this.mixer.setSoloSafe(stripIndex, soloSafe);
  }
  /** Invert the polarity of the left and/or right channel of a strip. */
  setPolarityInvert(stripIndex, invertLeft, invertRight) {
    this.mixer.setPolarityInvert(stripIndex, invertLeft, invertRight);
  }
  /** Set the strip's pan law. */
  setPanLaw(stripIndex, panLaw) {
    this.mixer.setPanLaw(stripIndex, panLawCode(panLaw));
  }
  /**
   * Set a per-strip channel delay in samples. This changes the strip's reported
   * latency; recompile to re-run latency compensation.
   */
  setChannelDelaySamples(stripIndex, delaySamples) {
    this.mixer.setChannelDelaySamples(stripIndex, delaySamples);
  }
  /** Set the strip's live VCA gain offset in dB (not persisted to the scene). */
  setVcaOffsetDb(stripIndex, offsetDb) {
    this.mixer.setVcaOffsetDb(stripIndex, offsetDb);
  }
  /** Set independent left/right pan positions (dual-pan mode). */
  setDualPan(stripIndex, leftPan, rightPan) {
    this.mixer.setDualPan(stripIndex, leftPan, rightPan);
  }
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
  addSend(stripIndex, id, destinationBusId, sendDb, timing = "postFader") {
    return this.mixer.addSend(stripIndex, id, destinationBusId, sendDb, sendTimingCode(timing));
  }
  /** Set the send level (in dB) for an existing send by index. */
  setSendDb(stripIndex, sendIndex, sendDb) {
    this.mixer.setSendDb(stripIndex, sendIndex, sendDb);
  }
  /**
   * Read a strip's meter snapshot at the given tap point.
   *
   * @param stripIndex - Strip index in `[0, stripCount())`
   * @param tap - `'preFader'` or `'postFader'` (default: `'postFader'`)
   */
  meterTap(stripIndex, tap = "postFader") {
    return this.mixer.meterTap(stripIndex, meterTapCode(tap));
  }
  /**
   * Read a strip's meter snapshot. Alias of {@link meterTap}, provided for
   * cross-binding (Node/Python) parity.
   *
   * @param stripIndex - Strip index in `[0, stripCount())`
   * @param tap - `'preFader'` or `'postFader'` (default: `'postFader'`)
   */
  stripMeter(stripIndex, tap = "postFader") {
    return this.mixer.stripMeter(stripIndex, meterTapCode(tap));
  }
  /**
   * Schedule sample-accurate fader automation on a strip.
   *
   * @param stripIndex - Strip index in `[0, stripCount())`
   * @param samplePos - Absolute samples from the start of processing
   * @param faderDb - Target fader level in dB
   * @param curve - Interpolation curve (default: `'linear'`)
   */
  scheduleFaderAutomation(stripIndex, samplePos, faderDb, curve = "linear") {
    this.mixer.scheduleFaderAutomation(stripIndex, samplePos, faderDb, automationCurveCode(curve));
  }
  /**
   * Schedule sample-accurate pan automation on a strip.
   *
   * @param stripIndex - Strip index in `[0, stripCount())`
   * @param samplePos - Absolute samples from the start of processing
   * @param pan - Target pan position
   * @param curve - Interpolation curve (default: `'linear'`)
   */
  schedulePanAutomation(stripIndex, samplePos, pan, curve = "linear") {
    this.mixer.schedulePanAutomation(stripIndex, samplePos, pan, automationCurveCode(curve));
  }
  /**
   * Schedule sample-accurate width automation on a strip.
   *
   * @param stripIndex - Strip index in `[0, stripCount())`
   * @param samplePos - Absolute samples from the start of processing
   * @param width - Target stereo width
   * @param curve - Interpolation curve (default: `'linear'`)
   */
  scheduleWidthAutomation(stripIndex, samplePos, width, curve = "linear") {
    this.mixer.scheduleWidthAutomation(stripIndex, samplePos, width, automationCurveCode(curve));
  }
  /**
   * Schedule sample-accurate send-level automation on a strip's send.
   *
   * @param stripIndex - Strip index in `[0, stripCount())`
   * @param sendIndex - Send index in the strip's add order
   * @param samplePos - Absolute samples from the start of processing
   * @param db - Target send level in dB
   * @param curve - Interpolation curve (default: `'linear'`)
   */
  scheduleSendAutomation(stripIndex, sendIndex, samplePos, db, curve = "linear") {
    this.mixer.scheduleSendAutomation(
      stripIndex,
      sendIndex,
      samplePos,
      db,
      automationCurveCode(curve)
    );
  }
  /**
   * Read up to `maxPoints` of a strip's most recent goniometer samples
   * (oldest to newest).
   */
  readGoniometerLatest(stripIndex, maxPoints) {
    return this.mixer.readGoniometerLatest(stripIndex, maxPoints);
  }
  /** Serialize the current scene (strips, buses, sends, connections) to JSON. */
  toSceneJson() {
    return this.mixer.toSceneJson();
  }
  /** Release the underlying WASM object. Safe to call only once. */
  delete() {
    this.mixer.delete();
  }
  /** Alias for {@link delete}, provided for cross-binding (Node) compatibility. */
  destroy() {
    this.delete();
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
function melToStft(melPower, nMels, nFrames, sampleRate, nFft = 2048, hopLength = 512, fmin = 0, fmax = 0) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.melToStft(melPower, nMels, nFrames, sampleRate, nFft, hopLength, fmin, fmax);
}
function melToAudio(melPower, nMels, nFrames, sampleRate, nFft = 2048, hopLength = 512, nIter = 32, fmin = 0, fmax = 0) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.melToAudio(
    melPower,
    nMels,
    nFrames,
    sampleRate,
    nFft,
    hopLength,
    nIter,
    fmin,
    fmax
  );
}
function mfccToMel(mfccCoefficients, nMfcc, nFrames, nMels = 128) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.mfccToMel(mfccCoefficients, nMfcc, nFrames, nMels);
}
function mfccToAudio(mfccCoefficients, nMfcc, nFrames, nMels, sampleRate, nFft = 2048, hopLength = 512, nIter = 32, fmin = 0, fmax = 0) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.mfccToAudio(
    mfccCoefficients,
    nMfcc,
    nFrames,
    nMels,
    sampleRate,
    nFft,
    hopLength,
    nIter,
    fmin,
    fmax
  );
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
function tempogram(onsetEnvelope2, sampleRate, hopLength = 512, winLength = 384, mode = "autocorrelation") {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.tempogram(onsetEnvelope2, sampleRate, hopLength, winLength, mode);
}
function cyclicTempogram(onsetEnvelope2, sampleRate, hopLength = 512, winLength = 384, bpmMin = 60, nBins = 60) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.cyclicTempogram(onsetEnvelope2, sampleRate, hopLength, winLength, bpmMin, nBins);
}
function plp(onsetEnvelope2, sampleRate, hopLength = 512, tempoMin = 30, tempoMax = 300, winLength = 384) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.plp(onsetEnvelope2, sampleRate, hopLength, tempoMin, tempoMax, winLength);
}
function nnlsChroma(samples, sampleRate = 22050) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.nnlsChroma(samples, sampleRate);
}
function cqt(samples, sampleRate = 22050, hopLength = 512, fmin = 32.70319566257483, nBins = 84, binsPerOctave = 12) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.cqt(samples, sampleRate, hopLength, fmin, nBins, binsPerOctave);
}
function vqt(samples, sampleRate = 22050, hopLength = 512, fmin = 32.70319566257483, nBins = 84, binsPerOctave = 12, gamma = 0) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.vqt(samples, sampleRate, hopLength, fmin, nBins, binsPerOctave, gamma);
}
function analyzeSections(samples, sampleRate = 22050, nFft = 2048, hopLength = 512, minSectionSec = 8) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.analyzeSections(samples, sampleRate, nFft, hopLength, minSectionSec).map((s) => ({ ...s, type: s.type }));
}
function analyzeMelody(samples, sampleRate = 22050, fmin = 65, fmax = 2093, frameLength = 2048, hopLength = 512, threshold = 0.1) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.analyzeMelody(samples, sampleRate, fmin, fmax, frameLength, hopLength, threshold);
}
function onsetEnvelope(samples, sampleRate = 22050, nFft = 2048, hopLength = 512, nMels = 128) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.onsetEnvelope(samples, sampleRate, nFft, hopLength, nMels);
}
function fourierTempogram(onsetEnvelope2, sampleRate = 22050, hopLength = 512, winLength = 384) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.fourierTempogram(onsetEnvelope2, sampleRate, hopLength, winLength);
}
function tempogramRatio(tempogramData, winLength = 384, sampleRate = 22050, hopLength = 512) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.tempogramRatio(tempogramData, winLength, sampleRate, hopLength);
}
function lufs(samples, sampleRate = 22050) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.lufs(samples, sampleRate);
}
function momentaryLufs(samples, sampleRate = 22050) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.momentaryLufs(samples, sampleRate);
}
function shortTermLufs(samples, sampleRate = 22050) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.shortTermLufs(samples, sampleRate);
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
  detectKey(options = {}) {
    return detectKey(this._samples, this._sampleRate, options);
  }
  detectKeyCandidates(options = {}) {
    return detectKeyCandidates(this._samples, this._sampleRate, options);
  }
  detectOnsets() {
    return detectOnsets(this._samples, this._sampleRate);
  }
  detectBeats() {
    return detectBeats(this._samples, this._sampleRate);
  }
  detectDownbeats() {
    return detectDownbeats(this._samples, this._sampleRate);
  }
  detectChords(options = {}) {
    return detectChords(this._samples, this._sampleRate, options);
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
  pitchCorrectToMidi(currentMidi, targetMidi) {
    return pitchCorrectToMidi(this._samples, this._sampleRate, currentMidi, targetMidi);
  }
  noteStretch(onsetSample, offsetSample, stretchRatio) {
    return noteStretch(this._samples, this._sampleRate, onsetSample, offsetSample, stretchRatio);
  }
  voiceChange(pitchSemitones, formantFactor) {
    return voiceChange(this._samples, this._sampleRate, pitchSemitones, formantFactor);
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
  nnlsChroma() {
    return nnlsChroma(this._samples, this._sampleRate);
  }
  onsetEnvelope(nFft = 2048, hopLength = 512, nMels = 128) {
    return onsetEnvelope(this._samples, this._sampleRate, nFft, hopLength, nMels);
  }
  lufs() {
    return lufs(this._samples, this._sampleRate);
  }
  momentaryLufs() {
    return momentaryLufs(this._samples, this._sampleRate);
  }
  shortTermLufs() {
    return shortTermLufs(this._samples, this._sampleRate);
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
    const wasmModule = module;
    const args = [
      config.sampleRate,
      config.nFft ?? 2048,
      config.hopLength ?? 512,
      config.nMels ?? 128,
      config.fmin ?? 0,
      config.fmax ?? 0,
      config.tuningRefHz ?? 440,
      config.computeMagnitude ?? true,
      config.computeMel ?? true,
      config.computeChroma ?? true,
      config.computeOnset ?? true,
      config.computeSpectral ?? true,
      config.emitEveryNFrames ?? 1,
      config.magnitudeDownsample ?? 1,
      config.keyUpdateIntervalSec ?? 5,
      config.bpmUpdateIntervalSec ?? 10,
      config.window ?? 0,
      config.outputFormat ?? 0
    ];
    const isArityError = (error) => {
      const message = String(error?.message ?? error);
      return message.includes("invalid number of parameters");
    };
    const createLegacy = () => {
      const LegacyStreamAnalyzer = wasmModule.StreamAnalyzer;
      return new LegacyStreamAnalyzer(
        args[0],
        args[1],
        args[2],
        args[3],
        args[8],
        args[9],
        args[10],
        args[12]
      );
    };
    const hasExtendedConfig = config.fmin !== void 0 || config.fmax !== void 0 || config.tuningRefHz !== void 0 || config.computeMagnitude !== void 0 || config.computeSpectral !== void 0 || config.magnitudeDownsample !== void 0 || config.keyUpdateIntervalSec !== void 0 || config.bpmUpdateIntervalSec !== void 0 || config.window !== void 0 || config.outputFormat !== void 0;
    if (hasExtendedConfig) {
      try {
        this.analyzer = new wasmModule.StreamAnalyzer(...args);
      } catch (error) {
        if (!isArityError(error)) {
          throw error;
        }
        this.analyzer = createLegacy();
      }
    } else {
      try {
        this.analyzer = createLegacy();
      } catch (error) {
        if (!isArityError(error)) {
          throw error;
        }
        this.analyzer = new wasmModule.StreamAnalyzer(...args);
      }
    }
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
  readFramesU8(maxFrames) {
    return this.analyzer.readFramesU8(maxFrames);
  }
  readFramesI16(maxFrames) {
    return this.analyzer.readFramesI16(maxFrames);
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
        chordStartTime: s.estimate.chordStartTime,
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
  EXPECTED_ENGINE_ABI_VERSION,
  KeyProfile,
  Mixer,
  Mode,
  PitchClass as Pitch,
  PitchClass,
  RealtimeEngine,
  SectionType,
  StreamAnalyzer,
  StreamingEqualizer,
  StreamingMasteringChain,
  StreamingRetune,
  amplitudeToDb,
  analyze,
  analyzeImpulseResponse,
  analyzeMelody,
  analyzeSections,
  analyzeWithProgress,
  chroma,
  cqt,
  cyclicTempogram,
  dbToAmplitude,
  dbToPower,
  deemphasis,
  detectAcoustic,
  detectBeats,
  detectBpm,
  detectChords,
  detectDownbeats,
  detectKey,
  detectKeyCandidates,
  detectOnsets,
  engineAbiVersion,
  engineCapabilities,
  fixFrames,
  fixLength,
  fourierTempogram,
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
  lufs,
  masterAudio,
  masterAudioStereo,
  mastering,
  masteringAssistantSuggest,
  masteringAudioProfile,
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
  masteringStreamingPreview,
  melSpectrogram,
  melToAudio,
  melToHz,
  melToStft,
  mfcc,
  mfccToAudio,
  mfccToMel,
  midiToHz,
  mixStereo,
  mixerScenePresetJson,
  mixingScenePresetJson,
  mixingScenePresetNames,
  momentaryLufs,
  nnlsChroma,
  normalize,
  noteStretch,
  noteToHz,
  onsetEnvelope,
  padCenter,
  pcen,
  peakPick,
  percussive,
  pitchCorrectToMidi,
  pitchPyin,
  pitchShift,
  pitchYin,
  plp,
  powerToDb,
  preemphasis,
  resample,
  rmsEnergy,
  samplesToFrames,
  shortTermLufs,
  spectralBandwidth,
  spectralCentroid,
  spectralFlatness,
  spectralRolloff,
  splitSilence,
  stft,
  stftDb,
  tempogram,
  tempogramRatio,
  timeStretch,
  timeToFrames,
  tonnetz,
  trim,
  trimSilence,
  vectorNormalize,
  version,
  voiceChange,
  vqt,
  zeroCrossingRate
};
