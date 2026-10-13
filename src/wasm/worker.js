var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};

// src/errors.ts
function isSonareError(value) {
  return value instanceof Error && value.name === "SonareError" && typeof value.code === "number";
}
var SonareError;
var init_errors = __esm({
  "src/errors.ts"() {
    "use strict";
    SonareError = class extends Error {
      constructor(code, codeName, message) {
        super(message);
        this.name = "SonareError";
        this.code = code;
        this.codeName = codeName;
      }
      /**
       * Brand-based `instanceof`: an error that carries the shape narrows here even
       * when it is not literally an instance of this class. That is not a
       * hypothetical — an error posted from the analysis worker arrives as a
       * structured clone with its prototype gone, which a prototype-based
       * `instanceof` would silently miss. Delegates to {@link isSonareError} so the
       * two never disagree.
       */
      static [Symbol.hasInstance](value) {
        return isSonareError(value);
      }
    };
  }
});

// src/abi.ts
var EXPECTED_ABI_VERSION;
var init_abi = __esm({
  "src/abi.ts"() {
    "use strict";
    EXPECTED_ABI_VERSION = 84083207;
  }
});

// src/module_state.ts
function nativeExceptionPtr(error) {
  if (typeof error === "number") {
    return error;
  }
  if (error !== null && typeof error === "object") {
    const ptr = error.excPtr;
    if (typeof ptr === "number") {
      return ptr;
    }
  }
  return null;
}
function makeSonareError(raw, thrown) {
  let code = 99 /* Unknown */;
  let codeName = "Unknown";
  let kind;
  let message = `libsonare native exception (${thrown})`;
  try {
    const info = raw.sonareExceptionInfo?.(thrown);
    if (info) {
      code = info.code ?? code;
      codeName = info.codeName ?? codeName;
      message = info.message || message;
      kind = info.kind;
    }
  } catch {
  } finally {
    try {
      raw.sonareReleaseException(thrown);
    } catch {
    }
  }
  if (kind === "TypeError") {
    return new TypeError(message);
  }
  if (kind === "RangeError") {
    return new RangeError(message);
  }
  return new SonareError(code, codeName, message);
}
function wrapModuleErrors(raw) {
  const cache = /* @__PURE__ */ new Map();
  const objectCache = /* @__PURE__ */ new WeakMap();
  const convert = (error) => {
    const ptr = nativeExceptionPtr(error);
    if (ptr !== null) {
      throw makeSonareError(raw, ptr);
    }
    if (error instanceof Error && EMBIND_DELETED_PATTERN.test(error.message)) {
      throw new SonareError(7 /* InvalidState */, "InvalidState", error.message);
    }
    throw error;
  };
  const wrapNativeObject = (value) => {
    if (value === null || typeof value !== "object") {
      return value;
    }
    if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer || value instanceof Promise) {
      return value;
    }
    const proto = Object.getPrototypeOf(value);
    if (Array.isArray(value) || proto === Object.prototype || proto === null) {
      return value;
    }
    const objectValue = value;
    const cached = objectCache.get(objectValue);
    if (cached) {
      return cached;
    }
    const methodCache = /* @__PURE__ */ new Map();
    const wrapped = new Proxy(objectValue, {
      get(target, prop, receiver) {
        const member = Reflect.get(target, prop, receiver);
        if (typeof member !== "function") {
          return member;
        }
        const cachedMethod = methodCache.get(prop);
        if (cachedMethod) {
          return cachedMethod;
        }
        const method = member;
        const wrappedMethod = (...args) => {
          try {
            return wrapNativeObject(Reflect.apply(method, target, args));
          } catch (error) {
            return convert(error);
          }
        };
        methodCache.set(prop, wrappedMethod);
        return wrappedMethod;
      }
    });
    objectCache.set(objectValue, wrapped);
    return wrapped;
  };
  const wrapFunction = (value) => {
    const fnCache = /* @__PURE__ */ new Map();
    return new Proxy(value, {
      get(target, prop, receiver) {
        const member = Reflect.get(target, prop, receiver);
        if (typeof member !== "function") {
          return member;
        }
        const cachedMember = fnCache.get(prop);
        if (cachedMember) {
          return cachedMember;
        }
        const fn = member;
        const wrappedMember = (...args) => {
          try {
            return wrapNativeObject(Reflect.apply(fn, target, args));
          } catch (error) {
            return convert(error);
          }
        };
        fnCache.set(prop, wrappedMember);
        return wrappedMember;
      },
      apply(t, thisArg, args) {
        try {
          return wrapNativeObject(Reflect.apply(t, thisArg, args));
        } catch (error) {
          return convert(error);
        }
      },
      construct(t, args, newTarget) {
        try {
          return wrapNativeObject(Reflect.construct(t, args, newTarget));
        } catch (error) {
          return convert(error);
        }
      }
    });
  };
  return new Proxy(raw, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== "function") {
        return value;
      }
      const cached = cache.get(prop);
      if (cached) {
        return cached;
      }
      const wrapped = wrapFunction(value);
      cache.set(prop, wrapped);
      return wrapped;
    }
  });
}
function notInitializedError() {
  return new SonareError(
    7 /* InvalidState */,
    "InvalidState",
    "Module not initialized. Call init() first."
  );
}
function hexAbi(version) {
  return `0x${(version >>> 0).toString(16).padStart(8, "0")}`;
}
function assertAbiCompatible(created) {
  const actual = typeof created.abiVersion === "function" ? created.abiVersion() : void 0;
  if (actual === EXPECTED_ABI_VERSION) {
    return;
  }
  throw new SonareError(
    10 /* AbiMismatch */,
    "AbiMismatch",
    `libsonare ABI mismatch: wasm module reports ${actual === void 0 ? "no ABI version" : hexAbi(actual)}, this package expects ${hexAbi(EXPECTED_ABI_VERSION)}. The JS glue and the .wasm binary come from different builds; check the wasmBinary, locateFile and moduleFactory options and any cached copy of sonare.wasm.`
  );
}
function assertSameInitOptions(first, next) {
  if (next === void 0) {
    return;
  }
  const a = first ?? {};
  const b = next;
  const keys = /* @__PURE__ */ new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (a[key] !== b[key]) {
      throw new SonareError(
        7 /* InvalidState */,
        "InvalidState",
        `init() options differ from the first call (${key}); options apply on the first call only.`
      );
    }
  }
}
function setSonareModule(module2) {
  wrappedModule = wrapModuleErrors(module2);
}
function getSonareModule() {
  if (!wrappedModule) {
    throw notInitializedError();
  }
  return wrappedModule;
}
var wrappedModule, EMBIND_DELETED_PATTERN;
var init_module_state = __esm({
  "src/module_state.ts"() {
    "use strict";
    init_abi();
    init_errors();
    wrappedModule = null;
    EMBIND_DELETED_PATTERN = / instance already deleted$|^Cannot pass deleted object as a pointer of type /;
  }
});

// src/codes.ts
function resolveOrdinalInRange(value, min, max, enumName) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) {
    throw new RangeError(`Invalid ${enumName}: ${String(value)}`);
  }
  return value;
}
function resolveEnumOrdinal(value, values, enumName) {
  if (typeof value === "number") {
    const ordinals = Object.values(values);
    const ordinal = resolveOrdinalInRange(
      value,
      Math.min(...ordinals),
      Math.max(...ordinals),
      enumName
    );
    if (!ordinals.includes(ordinal)) {
      throw new RangeError(`Invalid ${enumName}: ${String(value)}`);
    }
    return ordinal;
  }
  if (typeof value === "string") {
    const ordinal = values[value];
    if (ordinal !== void 0) {
      return ordinal;
    }
  }
  throw new RangeError(`Invalid ${enumName}: ${String(value)}`);
}
var AUTOMATION_CURVE_VALUES, PROJECT_AUTOMATION_CURVE_VALUES;
var init_codes = __esm({
  "src/codes.ts"() {
    "use strict";
    AUTOMATION_CURVE_VALUES = {
      linear: 0,
      exponential: 1,
      hold: 2,
      "s-curve": 3
    };
    PROJECT_AUTOMATION_CURVE_VALUES = {
      ...AUTOMATION_CURVE_VALUES,
      scurve: 3
    };
  }
});

// src/request_keys.ts
var keysOf, AlignTakeToReferenceRequestKeys, DbConversionRequestKeys, MusicAnalyzeRequestKeys, AnalyzeBpmRequestKeys, AnalyzeDynamicsRequestKeys, AnalyzeImpulseResponseRequestKeys, AnalyzeMelodyRequestKeys, AnalyzePolyphonicRequestKeys, AnalyzeRhythmRequestKeys, AnalyzeSectionsRequestKeys, AnalyzeTimbreRequestKeys, AnalyzeWithProgressRequestKeys, MusicAnalyzeOptionsKeys, AssignNoteTargetsRequestKeys, AutoTuneRequestKeys, AutoTuneKeyKeys, BassChromaSpectrogramRequestKeys, ChirpRequestKeys, ChordFunctionalAnalysisRequestKeys, Anon19Keys, SpectrogramRequestKeys, ChromaSpectrogramRequestKeys, ClicksRequestKeys, CqtRequestKeys, CqtToAudioRequestKeys, VocalCreateRequestKeys, VocalSessionLimitsKeys, VocalAnalysisInputKeys, CyclicTempogramRequestKeys, DecomposeRequestKeys, DecomposeNotePitchRequestKeys, DecomposeStemsRequestKeys, DecomposeStemsLinkedRequestKeys, DecomposeWithInitRequestKeys, EmphasisRequestKeys, DetectAcousticRequestKeys, SamplesRequestKeys, DetectBoundariesRequestKeys, DetectChordsRequestKeys, DetectKeyRequestKeys, DetectKeyCandidatesRequestKeys, DetectOnsetsRequestKeys, Ebur128LoudnessRangeRequestKeys, EstimateMeterRequestKeys, EstimateRoomRequestKeys, EstimateTuningRequestKeys, ExtractNotesRequestKeys, ExtractPercussiveEventsRequestKeys, FixFramesRequestKeys, FixLengthRequestKeys, FourierTempogramRequestKeys, FrameSignalRequestKeys, GriffinLimRequestKeys, HarmonicRequestKeys, HpssRequestKeys, HpssWithResidualRequestKeys, LufsRequestKeys, LufsInterleavedRequestKeys, LufsSeriesInterleavedRequestKeys, MasterAudioRequestKeys, MasteringChainConfigKeys, MasterAudioStereoRequestKeys, MasteringRequestKeys, MasteringAbMatchLoudnessRequestKeys, MasteringAbMatchLoudnessStereoRequestKeys, MasteringAssistantParamsRequestKeys, MasteringAssistantStereoParamsRequestKeys, MasteringSamplesParamsRequestKeys, MasteringStereoParamsRequestKeys, MasteringChainRequestKeys, MasteringChainStereoRequestKeys, MasteringDynamicsCompressorRequestKeys, MasteringDynamicsGateRequestKeys, MasteringDynamicsTransientShaperRequestKeys, Anon74Keys, MasteringPairProcessRequestKeys, MasteringPairProcessStereoRequestKeys, MasteringProcessRequestKeys, MasteringProcessStereoRequestKeys, MasteringRepairAnalyzeRequestKeys, MasteringRepairApplyRequestKeys, MasteringRepairDeclickRequestKeys, MasteringRepairDeclickStereoRequestKeys, MasteringRepairDeclipRequestKeys, MasteringRepairDeclipStereoRequestKeys, MasteringRepairDecrackleRequestKeys, MasteringRepairDecrackleStereoRequestKeys, MasteringRepairDehumRequestKeys, MasteringRepairDehumStereoRequestKeys, MasteringRepairDenoiseClassicalRequestKeys, MasteringRepairDenoiseClassicalLinkedRequestKeys, MasteringRepairDenoiseClassicalStereoRequestKeys, MasteringRepairDereverbClassicalRequestKeys, MasteringRepairDereverbClassicalLinkedRequestKeys, MasteringRepairDereverbClassicalStereoRequestKeys, MasteringRepairDetectClicksRequestKeys, MasteringRepairDetectClippingRequestKeys, MasteringRepairDetectCrackleRequestKeys, MasteringRepairDetectHumRequestKeys, MasteringRepairDetectNoiseFloorRequestKeys, MasteringRepairDetectReverbRequestKeys, MasteringRepairDetectTrimRangeRequestKeys, MasteringRepairDetectTrimRangeStereoRequestKeys, MasteringRepairTrimSilenceRequestKeys, MasteringRepairTrimSilenceStereoRequestKeys, Anon105Keys, MasteringStreamingPreviewRequestKeys, MasteringStreamingPreviewStereoRequestKeys, MelDeltaRequestKeys, MelSpectrogramRequestKeys, MergeNotesRequestKeys, MeteringSamplesRequestKeys, MeteringStereoRequestKeys, MeteringDetectClippingRequestKeys, MeteringDynamicRangeRequestKeys, MeteringStereoDecimatedRequestKeys, MeteringSilenceRatioRequestKeys, MeteringSpectrumRequestKeys, MeteringSpectrumFrameRequestKeys, MeteringTruePeakRequestKeys, MfccRequestKeys, MixStereoRequestKeys, NnFilterRequestKeys, NnlsChromaRequestKeys, NormalizeRequestKeys, NormalizeStereoRequestKeys, NoteMoveRequestKeys, NoteSegmentsRequestKeys, NoteStretchRequestKeys, NoteTargetsFromSmfRequestKeys, OnsetBacktrackRequestKeys, OnsetEnvelopeRequestKeys, OnsetStrengthMultiRequestKeys, PadCenterRequestKeys, PcenRequestKeys, PeakPickRequestKeys, PercussiveRequestKeys, PhaseVocoderRequestKeys, PiptrackRequestKeys, PitchCorrectTimevaryingRequestKeys, PitchCorrectToMidiRequestKeys, PitchCorrectToMidiTimevaryingRequestKeys, PitchPyinRequestKeys, PitchShiftRequestKeys, PitchTuningRequestKeys, PitchYinRequestKeys, PlpRequestKeys, PolyFeaturesRequestKeys, ReassignedSpectrogramRequestKeys, RemixRequestKeys, RenderNotesRequestKeys, RenderPercussiveEventsRequestKeys, RenderPlaybackRequestKeys, PlaybackRendererConfigKeys, ResampleRequestKeys, VocalRestoreRequestKeys, ZeroCrossingRateRequestKeys, RoomGeometryFromEstimateRequestKeys, RoomPlacementKeys, RoomMorphRequestKeys, RoomMorphStereoRequestKeys, SegmentAgglomerativeRequestKeys, SegmentCrossSimilarityRequestKeys, SegmentLagToRecurrenceRequestKeys, SegmentPathEnhanceRequestKeys, SegmentRecurrenceMatrixRequestKeys, SegmentRecurrenceToLagRequestKeys, SegmentSubsegmentRequestKeys, Anon168Keys, SpectralFrameRequestKeys, SpectralContrastRequestKeys, SpectralEditRequestKeys, Anon172Keys, SpectralRolloffRequestKeys, SplitNoteRequestKeys, SilenceRequestKeys, SplitSilenceCommonRequestKeys, StreamingLoudnessGainRequestKeys, StreamingLoudnessGainStereoRequestKeys, SuggestMixSceneRequestKeys, MixAssistantOptionsKeys, RirSynthOptionsKeys, TempogramRequestKeys, TempogramRatioRequestKeys, TimeStretchRequestKeys, ToneRequestKeys, TonnetzRequestKeys, TranscribeRequestKeys, TrimRequestKeys, VectorNormalizeRequestKeys, VoiceChangeRequestKeys, VoiceChangeRealtimeRequestKeys, VqtRequestKeys, VqtToAudioRequestKeys, WaveformPeakPyramidRequestKeys, WaveformPeaksRequestKeys, ZeroCrossingsRequestKeys, REQUEST_SHAPES, MUSIC_ANALYZE_OPTION_KEYS;
var init_request_keys = __esm({
  "src/request_keys.ts"() {
    "use strict";
    keysOf = () => (keys) => keys;
    AlignTakeToReferenceRequestKeys = keysOf()([
      "reference",
      "take",
      "sampleRate",
      "takeSampleRate",
      "hopLength",
      "binsPerOctave"
    ]);
    DbConversionRequestKeys = keysOf()(["values", "ref", "amin", "topDb"]);
    MusicAnalyzeRequestKeys = keysOf()([
      "samples",
      "sampleRate",
      "validate",
      "nFft",
      "hopLength",
      "bpmMin",
      "bpmMax",
      "startBpm",
      "useTriadsOnly",
      "useHpss",
      "chromaHighpassHz",
      "useBassWeighted",
      "chromaHopMultiplier",
      "useChordHmm",
      "useChordKeyContext",
      "chordHmmBeamWidth",
      "detectChordInversions",
      "adaptiveTempo",
      "tempoUpdateIntervalBeats",
      "computeTempoCurve",
      "meterCandidateNumerators",
      "meterDenominator",
      "tuning"
    ]);
    AnalyzeBpmRequestKeys = keysOf()([
      "bpmMin",
      "bpmMax",
      "startBpm",
      "nFft",
      "hopLength",
      "maxCandidates",
      "validate",
      "samples",
      "sampleRate"
    ]);
    AnalyzeDynamicsRequestKeys = keysOf()([
      "windowSec",
      "hopLength",
      "compressionThreshold",
      "validate",
      "samples",
      "sampleRate"
    ]);
    AnalyzeImpulseResponseRequestKeys = keysOf()([
      "nOctaveBands",
      "minDecayDb",
      "samples",
      "sampleRate",
      "validate"
    ]);
    AnalyzeMelodyRequestKeys = keysOf()([
      "samples",
      "sampleRate",
      "fmin",
      "fmax",
      "frameLength",
      "hopLength",
      "threshold",
      "usePyin",
      "center",
      "validate"
    ]);
    AnalyzePolyphonicRequestKeys = keysOf()([
      "samples",
      "sampleRate",
      "nFft",
      "hopLength",
      "winLength",
      "centRefHz",
      "centsPerBin",
      "centMaxHz",
      "tonalityOff",
      "salienceHarmonics",
      "f0MinHz",
      "f0MaxHz",
      "salienceAlphaHz",
      "salienceBetaHz",
      "salienceInharmonicity",
      "maxPolyphony",
      "minFramePeakRatio",
      "minSeparationCents",
      "subtractionFactor",
      "maxJumpCents",
      "minRidgePeakRatio",
      "minRidgeDurationMs",
      "reattackRatio",
      "maskHarmonics",
      "claimLobes",
      "inharmonicity",
      "estimateInharmonicity",
      "inharmonicityMinPartials",
      "inharmonicityMaxResidualBins",
      "inharmonicityMaxStretch",
      "windowFrames",
      "minPartialSeparation",
      "maxFitResidual",
      "maxWeightModulus",
      "maxRefineHz",
      "f0ToleranceCents",
      "segmentationThresholdCents",
      "minNoteMs",
      "referenceHz",
      "validate"
    ]);
    AnalyzeRhythmRequestKeys = keysOf()([
      "bpmMin",
      "bpmMax",
      "startBpm",
      "nFft",
      "hopLength",
      "validate",
      "samples",
      "sampleRate"
    ]);
    AnalyzeSectionsRequestKeys = keysOf()([
      "samples",
      "sampleRate",
      "nFft",
      "hopLength",
      "minSectionSec",
      "validate"
    ]);
    AnalyzeTimbreRequestKeys = keysOf()([
      "nFft",
      "hopLength",
      "nMels",
      "nMfcc",
      "windowSec",
      "validate",
      "samples",
      "sampleRate"
    ]);
    AnalyzeWithProgressRequestKeys = keysOf()([
      "onProgress",
      "cancel",
      "options",
      "samples",
      "sampleRate",
      "validate",
      "nFft",
      "hopLength",
      "bpmMin",
      "bpmMax",
      "startBpm",
      "useTriadsOnly",
      "useHpss",
      "chromaHighpassHz",
      "useBassWeighted",
      "chromaHopMultiplier",
      "useChordHmm",
      "useChordKeyContext",
      "chordHmmBeamWidth",
      "detectChordInversions",
      "adaptiveTempo",
      "tempoUpdateIntervalBeats",
      "computeTempoCurve",
      "meterCandidateNumerators",
      "meterDenominator",
      "tuning"
    ]);
    MusicAnalyzeOptionsKeys = keysOf()([
      "nFft",
      "hopLength",
      "bpmMin",
      "bpmMax",
      "startBpm",
      "useTriadsOnly",
      "useHpss",
      "chromaHighpassHz",
      "useBassWeighted",
      "chromaHopMultiplier",
      "useChordHmm",
      "useChordKeyContext",
      "chordHmmBeamWidth",
      "detectChordInversions",
      "adaptiveTempo",
      "tempoUpdateIntervalBeats",
      "computeTempoCurve",
      "meterCandidateNumerators",
      "meterDenominator",
      "tuning"
    ]);
    AssignNoteTargetsRequestKeys = keysOf()([
      "notes",
      "sampleRate",
      "targets",
      "unmatchedPolicy",
      "minOverlapRatio",
      "maxCorrectionSemitones"
    ]);
    AutoTuneRequestKeys = keysOf()([
      "samples",
      "sampleRate",
      "key",
      "strength",
      "retuneSpeedMs",
      "vibratoThresholdCents",
      "maxCorrectionSemitones",
      "referenceMidi",
      "validate"
    ]);
    AutoTuneKeyKeys = keysOf()(["root", "mode"]);
    BassChromaSpectrogramRequestKeys = keysOf()([
      "samples",
      "sampleRate",
      "hopLength",
      "nChroma",
      "validate"
    ]);
    ChirpRequestKeys = keysOf()([
      "fmin",
      "fmax",
      "sampleRate",
      "duration",
      "linear"
    ]);
    ChordFunctionalAnalysisRequestKeys = keysOf()([
      "keyRoot",
      "keyMode",
      "minDuration",
      "smoothingWindow",
      "threshold",
      "useTriadsOnly",
      "nFft",
      "hopLength",
      "useBeatSync",
      "useHmm",
      "hmmBeamWidth",
      "useKeyContext",
      "detectInversions",
      "chromaMethod",
      "tuning",
      "validate",
      "samples",
      "sampleRate"
    ]);
    Anon19Keys = keysOf()(["chords", "key"]);
    SpectrogramRequestKeys = keysOf()([
      "samples",
      "sampleRate",
      "nFft",
      "hopLength",
      "validate"
    ]);
    ChromaSpectrogramRequestKeys = keysOf()([
      "samples",
      "sampleRate",
      "hopLength",
      "nChroma",
      "binsPerOctave",
      "validate"
    ]);
    ClicksRequestKeys = keysOf()([
      "times",
      "sampleRate",
      "length",
      "frequency",
      "clickDuration"
    ]);
    CqtRequestKeys = keysOf()([
      "samples",
      "sampleRate",
      "hopLength",
      "fmin",
      "nBins",
      "binsPerOctave",
      "validate"
    ]);
    CqtToAudioRequestKeys = keysOf()([
      "magnitude",
      "nBins",
      "nFrames",
      "sampleRate",
      "hopLength",
      "fmin",
      "binsPerOctave",
      "nIter",
      "validate"
    ]);
    VocalCreateRequestKeys = keysOf()([
      "samples",
      "sampleRate",
      "outputLengthSamples",
      "edgeFadeMs",
      "vibratoCutoffHz",
      "segmentationThresholdCents",
      "minNoteMs",
      "frameLengthSamples",
      "hopLengthSamples",
      "fminHz",
      "fmaxHz",
      "yinThreshold",
      "voicedThreshold",
      "centered",
      "referenceHz",
      "limits",
      "analysis"
    ]);
    VocalSessionLimitsKeys = keysOf()([
      "maxHistoryBytes",
      "maxCacheBytes",
      "maxUndoDepth",
      "maxRenderJobs"
    ]);
    VocalAnalysisInputKeys = keysOf()([
      "frameOriginSample",
      "samplesPerFrame",
      "frameLengthSamples",
      "f0Hz",
      "voiced",
      "algorithmId",
      "algorithmVersion",
      "fminHz",
      "fmaxHz",
      "yinThreshold",
      "voicedThreshold",
      "centered",
      "segmentationThresholdCents",
      "minNoteMs",
      "referenceHz"
    ]);
    CyclicTempogramRequestKeys = keysOf()([
      "onsetEnvelope",
      "sampleRate",
      "hopLength",
      "winLength",
      "bpmMin",
      "nBins"
    ]);
    DecomposeRequestKeys = keysOf()([
      "s",
      "nFeatures",
      "nFrames",
      "nComponents",
      "nIter",
      "beta"
    ]);
    DecomposeNotePitchRequestKeys = keysOf()([
      "f0Hz",
      "voiced",
      "frameRate",
      "medianHz",
      "vibratoCutoffHz"
    ]);
    DecomposeStemsRequestKeys = keysOf()([
      "samples",
      "sampleRate",
      "nComponents",
      "nFft",
      "hopLength",
      "nIter",
      "beta",
      "init",
      "maskPower"
    ]);
    DecomposeStemsLinkedRequestKeys = keysOf()([
      "channels",
      "sampleRate",
      "nComponents",
      "nFft",
      "hopLength",
      "nIter",
      "beta",
      "init",
      "maskPower"
    ]);
    DecomposeWithInitRequestKeys = keysOf()([
      "init",
      "s",
      "nFeatures",
      "nFrames",
      "nComponents",
      "nIter",
      "beta"
    ]);
    EmphasisRequestKeys = keysOf()(["samples", "coef", "zi"]);
    DetectAcousticRequestKeys = keysOf()([
      "nOctaveBands",
      "nThirdOctaveSubbands",
      "minDecayDb",
      "noiseFloorMarginDb",
      "validate",
      "samples",
      "sampleRate"
    ]);
    SamplesRequestKeys = keysOf()(["samples", "sampleRate", "validate"]);
    DetectBoundariesRequestKeys = keysOf()([
      "samples",
      "sampleRate",
      "nFft",
      "hopLength",
      "kernelSize",
      "threshold",
      "absoluteThreshold",
      "nMfcc",
      "nChroma",
      "peakDistance",
      "referenceWindow",
      "useMfcc",
      "useChroma",
      "validate"
    ]);
    DetectChordsRequestKeys = keysOf()([
      "minDuration",
      "smoothingWindow",
      "threshold",
      "useTriadsOnly",
      "nFft",
      "hopLength",
      "useBeatSync",
      "useHmm",
      "hmmBeamWidth",
      "useKeyContext",
      "keyRoot",
      "keyMode",
      "detectInversions",
      "chromaMethod",
      "tuning",
      "validate",
      "samples",
      "sampleRate"
    ]);
    DetectKeyRequestKeys = keysOf()([
      "tuning",
      "nFft",
      "hopLength",
      "useHpss",
      "loudnessWeighted",
      "highPassHz",
      "modes",
      "profile",
      "genreHint",
      "validate",
      "samples",
      "sampleRate"
    ]);
    DetectKeyCandidatesRequestKeys = keysOf()([
      "nFft",
      "hopLength",
      "useHpss",
      "loudnessWeighted",
      "highPassHz",
      "modes",
      "profile",
      "genreHint",
      "validate",
      "samples",
      "sampleRate"
    ]);
    DetectOnsetsRequestKeys = keysOf()([
      "samples",
      "sampleRate",
      "validate",
      "nFft",
      "hopLength",
      "threshold",
      "preMax",
      "postMax",
      "preAvg",
      "postAvg",
      "delta",
      "wait",
      "backtrack",
      "backtrackRange"
    ]);
    Ebur128LoudnessRangeRequestKeys = keysOf()([
      "samples",
      "sampleRate",
      "validate"
    ]);
    EstimateMeterRequestKeys = keysOf()([
      "beatTimes",
      "beatStrengths",
      "candidateNumerators",
      "denominator",
      "downbeatWeight",
      "measureWeight",
      "subdivisionWeight",
      "compoundSubdivisionThreshold"
    ]);
    EstimateRoomRequestKeys = keysOf()([
      "aspectHintLw",
      "aspectHintLh",
      "referenceAbsorption",
      "preferEyring",
      "nOctaveBands",
      "mode",
      "minDecayDb",
      "noiseFloorMarginDb",
      "samples",
      "sampleRate",
      "validate"
    ]);
    EstimateTuningRequestKeys = keysOf()([
      "resolution",
      "binsPerOctave",
      "samples",
      "sampleRate",
      "nFft",
      "hopLength"
    ]);
    ExtractNotesRequestKeys = keysOf()([
      "samples",
      "sampleRate",
      "f0Hz",
      "frameRate",
      "voiced",
      "voicedProb",
      "segmentationThresholdCents",
      "minNoteMs",
      "referenceHz",
      "voicedThreshold",
      "validate"
    ]);
    ExtractPercussiveEventsRequestKeys = keysOf()([
      "samples",
      "sampleRate",
      "onsetWait",
      "onsetDelta",
      "maxEventMs",
      "minPercussiveRatio",
      "nFft",
      "hopLength",
      "hpssKernelHarmonic",
      "hpssKernelPercussive",
      "validate"
    ]);
    FixFramesRequestKeys = keysOf()(["frames", "xMin", "xMax", "pad"]);
    FixLengthRequestKeys = keysOf()(["values", "targetSize", "padValue"]);
    FourierTempogramRequestKeys = keysOf()([
      "onsetEnvelope",
      "sampleRate",
      "hopLength",
      "winLength",
      "center",
      "norm",
      "validate"
    ]);
    FrameSignalRequestKeys = keysOf()([
      "samples",
      "frameLength",
      "hopLength"
    ]);
    GriffinLimRequestKeys = keysOf()([
      "magnitude",
      "nBins",
      "nFrames",
      "sampleRate",
      "nFft",
      "hopLength",
      "nIter",
      "momentum",
      "validate"
    ]);
    HarmonicRequestKeys = keysOf()(["samples", "sampleRate", "validate"]);
    HpssRequestKeys = keysOf()([
      "samples",
      "sampleRate",
      "kernelHarmonic",
      "kernelPercussive",
      "nFft",
      "hopLength",
      "hardMask"
    ]);
    HpssWithResidualRequestKeys = keysOf()([
      "samples",
      "sampleRate",
      "kernelHarmonic",
      "kernelPercussive",
      "nFft",
      "hopLength",
      "hardMask"
    ]);
    LufsRequestKeys = keysOf()(["samples", "sampleRate", "validate"]);
    LufsInterleavedRequestKeys = keysOf()([
      "samples",
      "channels",
      "sampleRate",
      "validate"
    ]);
    LufsSeriesInterleavedRequestKeys = keysOf()([
      "samples",
      "channels",
      "sampleRate",
      "validate"
    ]);
    MasterAudioRequestKeys = keysOf()([
      "samples",
      "sampleRate",
      "preset",
      "overrides",
      "onProgress",
      "cancel"
    ]);
    MasteringChainConfigKeys = keysOf()([
      "repair",
      "eq",
      "dynamics",
      "saturation",
      "spectral",
      "stereo",
      "maximizer",
      "loudness"
    ]);
    MasterAudioStereoRequestKeys = keysOf()([
      "left",
      "right",
      "sampleRate",
      "preset",
      "overrides",
      "onProgress",
      "cancel"
    ]);
    MasteringRequestKeys = keysOf()([
      "samples",
      "sampleRate",
      "targetLufs",
      "ceilingDb",
      "truePeakOversample",
      "releaseMs",
      "applyGainAtInputRate"
    ]);
    MasteringAbMatchLoudnessRequestKeys = keysOf()([
      "source",
      "reference",
      "sampleRate",
      "referenceSampleRate"
    ]);
    MasteringAbMatchLoudnessStereoRequestKeys = keysOf()([
      "sourceLeft",
      "sourceRight",
      "referenceLeft",
      "referenceRight",
      "sampleRate",
      "referenceSampleRate"
    ]);
    MasteringAssistantParamsRequestKeys = keysOf()([
      "samples",
      "sampleRate",
      "params"
    ]);
    MasteringAssistantStereoParamsRequestKeys = keysOf()([
      "left",
      "right",
      "sampleRate",
      "params"
    ]);
    MasteringSamplesParamsRequestKeys = keysOf()([
      "samples",
      "sampleRate",
      "params"
    ]);
    MasteringStereoParamsRequestKeys = keysOf()([
      "left",
      "right",
      "sampleRate",
      "params"
    ]);
    MasteringChainRequestKeys = keysOf()([
      "samples",
      "sampleRate",
      "config",
      "onProgress",
      "cancel"
    ]);
    MasteringChainStereoRequestKeys = keysOf()([
      "left",
      "right",
      "sampleRate",
      "config",
      "onProgress",
      "cancel"
    ]);
    MasteringDynamicsCompressorRequestKeys = keysOf()([
      "samples",
      "sampleRate",
      "thresholdDb",
      "ratio",
      "attackMs",
      "releaseMs",
      "kneeDb",
      "makeupGainDb",
      "autoMakeup",
      "detector",
      "sidechainHpfEnabled",
      "sidechainHpfHz",
      "pdrTimeMs",
      "pdrReleaseScale",
      "validate"
    ]);
    MasteringDynamicsGateRequestKeys = keysOf()([
      "samples",
      "sampleRate",
      "thresholdDb",
      "attackMs",
      "releaseMs",
      "rangeDb",
      "holdMs",
      "closeThresholdDb",
      "keyHpfHz",
      "validate"
    ]);
    MasteringDynamicsTransientShaperRequestKeys = keysOf()([
      "samples",
      "sampleRate",
      "attackGainDb",
      "sustainGainDb",
      "fastAttackMs",
      "fastReleaseMs",
      "slowAttackMs",
      "slowReleaseMs",
      "sensitivity",
      "maxGainDb",
      "gainSmoothingMs",
      "lookaheadMs",
      "validate"
    ]);
    Anon74Keys = keysOf()([
      "analysisName",
      "source",
      "reference",
      "sampleRate",
      "referenceSampleRate",
      "params"
    ]);
    MasteringPairProcessRequestKeys = keysOf()([
      "processorName",
      "source",
      "reference",
      "sampleRate",
      "referenceSampleRate",
      "params"
    ]);
    MasteringPairProcessStereoRequestKeys = keysOf()([
      "processorName",
      "sourceLeft",
      "sourceRight",
      "referenceLeft",
      "referenceRight",
      "sampleRate",
      "referenceSampleRate",
      "params"
    ]);
    MasteringProcessRequestKeys = keysOf()([
      "processorName",
      "samples",
      "sampleRate",
      "params"
    ]);
    MasteringProcessStereoRequestKeys = keysOf()([
      "processorName",
      "left",
      "right",
      "sampleRate",
      "params"
    ]);
    MasteringRepairAnalyzeRequestKeys = keysOf()([
      "channels",
      "sampleRate",
      "preferStreamingSafe"
    ]);
    MasteringRepairApplyRequestKeys = keysOf()([
      "channels",
      "sampleRate",
      "stages",
      "onProgress",
      "cancel"
    ]);
    MasteringRepairDeclickRequestKeys = keysOf()([
      "samples",
      "sampleRate",
      "threshold",
      "neighborRatio",
      "maxClickSamples",
      "lpcOrder",
      "residualRatio"
    ]);
    MasteringRepairDeclickStereoRequestKeys = keysOf()([
      "left",
      "right",
      "sampleRate",
      "threshold",
      "neighborRatio",
      "maxClickSamples",
      "lpcOrder",
      "residualRatio"
    ]);
    MasteringRepairDeclipRequestKeys = keysOf()([
      "samples",
      "sampleRate",
      "clipThreshold",
      "lpcOrder",
      "iterations",
      "lpcBlend"
    ]);
    MasteringRepairDeclipStereoRequestKeys = keysOf()([
      "left",
      "right",
      "sampleRate",
      "clipThreshold",
      "lpcOrder",
      "iterations",
      "lpcBlend"
    ]);
    MasteringRepairDecrackleRequestKeys = keysOf()([
      "samples",
      "sampleRate",
      "threshold",
      "mode",
      "levels"
    ]);
    MasteringRepairDecrackleStereoRequestKeys = keysOf()([
      "left",
      "right",
      "sampleRate",
      "threshold",
      "mode",
      "levels"
    ]);
    MasteringRepairDehumRequestKeys = keysOf()([
      "samples",
      "sampleRate",
      "fundamentalHz",
      "harmonics",
      "q",
      "adaptive",
      "searchRangeHz",
      "adaptation",
      "frameSize",
      "pllBandwidth",
      "mode"
    ]);
    MasteringRepairDehumStereoRequestKeys = keysOf()([
      "left",
      "right",
      "sampleRate",
      "fundamentalHz",
      "harmonics",
      "q",
      "adaptive",
      "searchRangeHz",
      "adaptation",
      "frameSize",
      "pllBandwidth",
      "mode"
    ]);
    MasteringRepairDenoiseClassicalRequestKeys = keysOf()(
      [
        "samples",
        "sampleRate",
        "mode",
        "noiseEstimator",
        "nFft",
        "hopLength",
        "ddAlpha",
        "reductionDb",
        "overSubtraction",
        "spectralFloor",
        "noiseEstimationQuantile",
        "speechPresenceGain",
        "gainSmoothing"
      ]
    );
    MasteringRepairDenoiseClassicalLinkedRequestKeys = keysOf()([
      "channels",
      "sampleRate",
      "mode",
      "noiseEstimator",
      "nFft",
      "hopLength",
      "ddAlpha",
      "reductionDb",
      "overSubtraction",
      "spectralFloor",
      "noiseEstimationQuantile",
      "speechPresenceGain",
      "gainSmoothing"
    ]);
    MasteringRepairDenoiseClassicalStereoRequestKeys = keysOf()([
      "left",
      "right",
      "sampleRate",
      "mode",
      "noiseEstimator",
      "nFft",
      "hopLength",
      "ddAlpha",
      "reductionDb",
      "overSubtraction",
      "spectralFloor",
      "noiseEstimationQuantile",
      "speechPresenceGain",
      "gainSmoothing"
    ]);
    MasteringRepairDereverbClassicalRequestKeys = keysOf()([
      "samples",
      "sampleRate",
      "threshold",
      "attenuation",
      "nFft",
      "hopLength",
      "t60Sec",
      "lateDelayMs",
      "overSubtraction",
      "spectralFloor",
      "wpeEnabled",
      "wpeIterations",
      "wpeTaps",
      "wpeStrength"
    ]);
    MasteringRepairDereverbClassicalLinkedRequestKeys = keysOf()([
      "channels",
      "sampleRate",
      "threshold",
      "attenuation",
      "nFft",
      "hopLength",
      "t60Sec",
      "lateDelayMs",
      "overSubtraction",
      "spectralFloor",
      "wpeEnabled",
      "wpeIterations",
      "wpeTaps",
      "wpeStrength"
    ]);
    MasteringRepairDereverbClassicalStereoRequestKeys = keysOf()([
      "left",
      "right",
      "sampleRate",
      "threshold",
      "attenuation",
      "nFft",
      "hopLength",
      "t60Sec",
      "lateDelayMs",
      "overSubtraction",
      "spectralFloor",
      "wpeEnabled",
      "wpeIterations",
      "wpeTaps",
      "wpeStrength"
    ]);
    MasteringRepairDetectClicksRequestKeys = keysOf()([
      "samples",
      "sampleRate",
      "threshold",
      "neighborRatio",
      "maxClickSamples",
      "lpcOrder",
      "residualRatio"
    ]);
    MasteringRepairDetectClippingRequestKeys = keysOf()([
      "samples",
      "sampleRate",
      "clipThreshold",
      "lpcOrder",
      "iterations",
      "lpcBlend"
    ]);
    MasteringRepairDetectCrackleRequestKeys = keysOf()([
      "samples",
      "sampleRate",
      "threshold",
      "mode",
      "levels"
    ]);
    MasteringRepairDetectHumRequestKeys = keysOf()([
      "samples",
      "sampleRate",
      "fundamentalHz",
      "harmonics",
      "q",
      "adaptive",
      "searchRangeHz",
      "adaptation",
      "frameSize",
      "pllBandwidth",
      "mode"
    ]);
    MasteringRepairDetectNoiseFloorRequestKeys = keysOf()(
      [
        "samples",
        "sampleRate",
        "mode",
        "noiseEstimator",
        "nFft",
        "hopLength",
        "ddAlpha",
        "reductionDb",
        "overSubtraction",
        "spectralFloor",
        "noiseEstimationQuantile",
        "speechPresenceGain",
        "gainSmoothing"
      ]
    );
    MasteringRepairDetectReverbRequestKeys = keysOf()([
      "samples",
      "sampleRate",
      "threshold",
      "attenuation",
      "nFft",
      "hopLength",
      "t60Sec",
      "lateDelayMs",
      "overSubtraction",
      "spectralFloor",
      "wpeEnabled",
      "wpeIterations",
      "wpeTaps",
      "wpeStrength"
    ]);
    MasteringRepairDetectTrimRangeRequestKeys = keysOf()([
      "samples",
      "sampleRate",
      "threshold",
      "paddingSamples",
      "paddingSec",
      "mode",
      "gateLufs",
      "windowMs"
    ]);
    MasteringRepairDetectTrimRangeStereoRequestKeys = keysOf()([
      "left",
      "right",
      "sampleRate",
      "threshold",
      "paddingSamples",
      "paddingSec",
      "mode",
      "gateLufs",
      "windowMs"
    ]);
    MasteringRepairTrimSilenceRequestKeys = keysOf()([
      "samples",
      "sampleRate",
      "threshold",
      "paddingSamples",
      "paddingSec",
      "mode",
      "gateLufs",
      "windowMs"
    ]);
    MasteringRepairTrimSilenceStereoRequestKeys = keysOf()([
      "left",
      "right",
      "sampleRate",
      "threshold",
      "paddingSamples",
      "paddingSec",
      "mode",
      "gateLufs",
      "windowMs"
    ]);
    Anon105Keys = keysOf()([
      "analysisName",
      "left",
      "right",
      "sampleRate",
      "params"
    ]);
    MasteringStreamingPreviewRequestKeys = keysOf()([
      "samples",
      "sampleRate",
      "platforms"
    ]);
    MasteringStreamingPreviewStereoRequestKeys = keysOf()(
      ["left", "right", "sampleRate", "platforms"]
    );
    MelDeltaRequestKeys = keysOf()([
      "features",
      "nFeatures",
      "nFrames",
      "width",
      "validate"
    ]);
    MelSpectrogramRequestKeys = keysOf()([
      "nMels",
      "fmin",
      "fmax",
      "htk",
      "samples",
      "sampleRate",
      "nFft",
      "hopLength",
      "validate"
    ]);
    MergeNotesRequestKeys = keysOf()([
      "first",
      "last",
      "samples",
      "sampleRate",
      "f0Hz",
      "frameRate",
      "voiced",
      "voicedProb",
      "notes",
      "segmentationThresholdCents",
      "minNoteMs",
      "referenceHz",
      "voicedThreshold",
      "validate"
    ]);
    MeteringSamplesRequestKeys = keysOf()([
      "samples",
      "sampleRate",
      "validate"
    ]);
    MeteringStereoRequestKeys = keysOf()([
      "left",
      "right",
      "sampleRate",
      "validate"
    ]);
    MeteringDetectClippingRequestKeys = keysOf()([
      "samples",
      "sampleRate",
      "threshold",
      "minRegionSamples",
      "validate"
    ]);
    MeteringDynamicRangeRequestKeys = keysOf()([
      "samples",
      "sampleRate",
      "windowSec",
      "hopSec",
      "lowPercentile",
      "highPercentile",
      "validate"
    ]);
    MeteringStereoDecimatedRequestKeys = keysOf()([
      "maxPoints",
      "left",
      "right",
      "sampleRate",
      "validate"
    ]);
    MeteringSilenceRatioRequestKeys = keysOf()([
      "thresholdDb",
      "frameLength",
      "hopLength",
      "samples",
      "sampleRate",
      "validate"
    ]);
    MeteringSpectrumRequestKeys = keysOf()([
      "samples",
      "sampleRate",
      "nFft",
      "applyOctaveSmoothing",
      "octaveFraction",
      "dbRef",
      "dbAmin",
      "validate"
    ]);
    MeteringSpectrumFrameRequestKeys = keysOf()([
      "frameOffset",
      "samples",
      "sampleRate",
      "nFft",
      "applyOctaveSmoothing",
      "octaveFraction",
      "dbRef",
      "dbAmin",
      "validate"
    ]);
    MeteringTruePeakRequestKeys = keysOf()([
      "oversampleFactor",
      "samples",
      "sampleRate",
      "validate"
    ]);
    MfccRequestKeys = keysOf()([
      "nMfcc",
      "lifter",
      "nMels",
      "fmin",
      "fmax",
      "htk",
      "samples",
      "sampleRate",
      "nFft",
      "hopLength",
      "validate"
    ]);
    MixStereoRequestKeys = keysOf()([
      "leftChannels",
      "rightChannels",
      "sampleRate",
      "inputTrimDb",
      "faderDb",
      "pan",
      "panMode",
      "width",
      "muted"
    ]);
    NnFilterRequestKeys = keysOf()([
      "s",
      "nFeatures",
      "nFrames",
      "aggregate",
      "k",
      "width"
    ]);
    NnlsChromaRequestKeys = keysOf()([
      "samples",
      "sampleRate",
      "enableStftBlend",
      "stftBlendWeight",
      "stftBlendNFft",
      "hopLength",
      "validate"
    ]);
    NormalizeRequestKeys = keysOf()([
      "samples",
      "sampleRate",
      "targetDb",
      "mode",
      "validate"
    ]);
    NormalizeStereoRequestKeys = keysOf()([
      "left",
      "right",
      "sampleRate",
      "targetDb",
      "mode",
      "validate"
    ]);
    NoteMoveRequestKeys = keysOf()([
      "samples",
      "sampleRate",
      "onsetSample",
      "onsetSec",
      "offsetSample",
      "offsetSec",
      "targetOnsetSample",
      "targetOnsetSec",
      "validate"
    ]);
    NoteSegmentsRequestKeys = keysOf()([
      "f0Hz",
      "voicedProb",
      "frameRate",
      "segmentationThresholdCents",
      "minNoteMs",
      "referenceHz",
      "voicedThreshold"
    ]);
    NoteStretchRequestKeys = keysOf()([
      "samples",
      "sampleRate",
      "onsetSample",
      "onsetSec",
      "offsetSample",
      "offsetSec",
      "stretchRatio",
      "validate"
    ]);
    NoteTargetsFromSmfRequestKeys = keysOf()(["data", "trackIndex"]);
    OnsetBacktrackRequestKeys = keysOf()(["events", "energy"]);
    OnsetEnvelopeRequestKeys = keysOf()([
      "samples",
      "sampleRate",
      "nFft",
      "hopLength",
      "nMels",
      "validate"
    ]);
    OnsetStrengthMultiRequestKeys = keysOf()([
      "nBands",
      "samples",
      "sampleRate",
      "nFft",
      "hopLength",
      "nMels",
      "validate"
    ]);
    PadCenterRequestKeys = keysOf()(["values", "targetSize", "padValue"]);
    PcenRequestKeys = keysOf()([
      "values",
      "nBins",
      "nFrames",
      "sampleRate",
      "hopLength",
      "timeConstant",
      "gain",
      "bias",
      "power",
      "eps",
      "options"
    ]);
    PeakPickRequestKeys = keysOf()([
      "values",
      "preMax",
      "postMax",
      "preAvg",
      "postAvg",
      "delta",
      "wait"
    ]);
    PercussiveRequestKeys = keysOf()(["samples", "sampleRate", "validate"]);
    PhaseVocoderRequestKeys = keysOf()([
      "rate",
      "samples",
      "sampleRate",
      "nFft",
      "hopLength"
    ]);
    PiptrackRequestKeys = keysOf()([
      "samples",
      "sampleRate",
      "nFft",
      "hopLength",
      "fmin",
      "fmax",
      "threshold"
    ]);
    PitchCorrectTimevaryingRequestKeys = keysOf()([
      "samples",
      "f0Hz",
      "sampleRate",
      "hopLength",
      "mode",
      "targetMidi",
      "scaleRoot",
      "scaleModeMask",
      "referenceMidi",
      "retuneAmount",
      "maxCorrectionSemitones",
      "retuneSpeedMs",
      "vibratoThresholdCents",
      "voiced",
      "voicedProb",
      "validate"
    ]);
    PitchCorrectToMidiRequestKeys = keysOf()([
      "samples",
      "sampleRate",
      "currentMidi",
      "targetMidi",
      "validate"
    ]);
    PitchCorrectToMidiTimevaryingRequestKeys = keysOf()([
      "samples",
      "f0Hz",
      "targetMidi",
      "sampleRate",
      "hopLength",
      "voiced",
      "voicedProb",
      "validate"
    ]);
    PitchPyinRequestKeys = keysOf()([
      "samples",
      "sampleRate",
      "frameLength",
      "hopLength",
      "fmin",
      "fmax",
      "threshold",
      "fillNa"
    ]);
    PitchShiftRequestKeys = keysOf()([
      "samples",
      "sampleRate",
      "semitones",
      "nFft",
      "hopLength",
      "validate"
    ]);
    PitchTuningRequestKeys = keysOf()([
      "frequencies",
      "resolution",
      "binsPerOctave"
    ]);
    PitchYinRequestKeys = keysOf()([
      "samples",
      "sampleRate",
      "frameLength",
      "hopLength",
      "fmin",
      "fmax",
      "threshold",
      "fillNa"
    ]);
    PlpRequestKeys = keysOf()([
      "onsetEnvelope",
      "sampleRate",
      "hopLength",
      "tempoMin",
      "tempoMax",
      "winLength"
    ]);
    PolyFeaturesRequestKeys = keysOf()([
      "order",
      "samples",
      "sampleRate",
      "nFft",
      "hopLength"
    ]);
    ReassignedSpectrogramRequestKeys = keysOf()([
      "refPower",
      "fillNan",
      "samples",
      "sampleRate",
      "nFft",
      "hopLength",
      "validate"
    ]);
    RemixRequestKeys = keysOf()([
      "samples",
      "intervals",
      "sampleRate",
      "alignZeros"
    ]);
    RenderNotesRequestKeys = keysOf()([
      "samples",
      "sampleRate",
      "notes",
      "fadeMs",
      "f0Hz",
      "voiced",
      "frameRate",
      "vibratoCutoffHz",
      "validate"
    ]);
    RenderPercussiveEventsRequestKeys = keysOf()([
      "samples",
      "sampleRate",
      "events",
      "fadeMs",
      "nFft",
      "hopLength",
      "hpssKernelHarmonic",
      "hpssKernelPercussive",
      "validate"
    ]);
    RenderPlaybackRequestKeys = keysOf()([
      "samples",
      "channels",
      "sampleRate",
      "config",
      "hrtf"
    ]);
    PlaybackRendererConfigKeys = keysOf()([
      "input",
      "target",
      "lfe_mix_db",
      "upmix",
      "dialogue_level_db",
      "loudness",
      "night_mode",
      "room",
      "head_tracking",
      "output_limiter"
    ]);
    ResampleRequestKeys = keysOf()(["samples", "srcSr", "targetSr"]);
    VocalRestoreRequestKeys = keysOf()([
      "samples",
      "sampleRate",
      "state",
      "limits"
    ]);
    ZeroCrossingRateRequestKeys = keysOf()([
      "samples",
      "sampleRate",
      "frameLength",
      "hopLength"
    ]);
    RoomGeometryFromEstimateRequestKeys = keysOf()([
      "estimate",
      "source",
      "listener"
    ]);
    RoomPlacementKeys = keysOf()(["x", "y", "z"]);
    RoomMorphRequestKeys = keysOf()([
      "samples",
      "sampleRate",
      "wet",
      "sourceTailSuppression",
      "preferEyring",
      "mixingTimeMs",
      "crossfadeMs",
      "lengthM",
      "widthM",
      "heightM",
      "absorption",
      "bandAbsorption",
      "bandScattering",
      "materialPreset",
      "sourceX",
      "sourceY",
      "sourceZ",
      "listenerX",
      "listenerY",
      "listenerZ",
      "ismOrder",
      "seed",
      "maxSeconds",
      "airAbsorptionEnabled",
      "airTemperatureC",
      "airHumidityPercent",
      "validate"
    ]);
    RoomMorphStereoRequestKeys = keysOf()([
      "left",
      "right",
      "sampleRate",
      "receiverSpacingM",
      "wet",
      "sourceTailSuppression",
      "preferEyring",
      "mixingTimeMs",
      "crossfadeMs",
      "lengthM",
      "widthM",
      "heightM",
      "absorption",
      "bandAbsorption",
      "bandScattering",
      "materialPreset",
      "sourceX",
      "sourceY",
      "sourceZ",
      "listenerX",
      "listenerY",
      "listenerZ",
      "ismOrder",
      "seed",
      "maxSeconds",
      "airAbsorptionEnabled",
      "airTemperatureC",
      "airHumidityPercent",
      "validate"
    ]);
    SegmentAgglomerativeRequestKeys = keysOf()([
      "data",
      "rows",
      "cols",
      "k",
      "linkage"
    ]);
    SegmentCrossSimilarityRequestKeys = keysOf()([
      "x",
      "xRows",
      "xCols",
      "y",
      "yRows",
      "yCols",
      "k",
      "metric",
      "mode"
    ]);
    SegmentLagToRecurrenceRequestKeys = keysOf()([
      "lag",
      "rows",
      "lags"
    ]);
    SegmentPathEnhanceRequestKeys = keysOf()([
      "recurrence",
      "n",
      "win",
      "maxRatio",
      "minRatio",
      "nFilters"
    ]);
    SegmentRecurrenceMatrixRequestKeys = keysOf()([
      "data",
      "rows",
      "cols",
      "k",
      "width",
      "sym",
      "metric",
      "mode"
    ]);
    SegmentRecurrenceToLagRequestKeys = keysOf()([
      "recurrence",
      "n",
      "pad"
    ]);
    SegmentSubsegmentRequestKeys = keysOf()([
      "data",
      "rows",
      "cols",
      "boundaries",
      "nSegments"
    ]);
    Anon168Keys = keysOf()([
      "samples",
      "sampleRate",
      "nFft",
      "hopLength",
      "p"
    ]);
    SpectralFrameRequestKeys = keysOf()([
      "samples",
      "sampleRate",
      "nFft",
      "hopLength"
    ]);
    SpectralContrastRequestKeys = keysOf()([
      "nBands",
      "fmin",
      "quantile",
      "samples",
      "sampleRate",
      "nFft",
      "hopLength"
    ]);
    SpectralEditRequestKeys = keysOf()([
      "samples",
      "sampleRate",
      "ops",
      "nFft",
      "hopLength",
      "window",
      "healRadiusFrames",
      "validate"
    ]);
    Anon172Keys = keysOf()([
      "samples",
      "sampleRate",
      "nFft",
      "hopLength",
      "lag"
    ]);
    SpectralRolloffRequestKeys = keysOf()([
      "rollPercent",
      "samples",
      "sampleRate",
      "nFft",
      "hopLength"
    ]);
    SplitNoteRequestKeys = keysOf()([
      "index",
      "frame",
      "samples",
      "sampleRate",
      "f0Hz",
      "frameRate",
      "voiced",
      "voicedProb",
      "notes",
      "segmentationThresholdCents",
      "minNoteMs",
      "referenceHz",
      "voicedThreshold",
      "validate"
    ]);
    SilenceRequestKeys = keysOf()([
      "samples",
      "topDb",
      "frameLength",
      "hopLength"
    ]);
    SplitSilenceCommonRequestKeys = keysOf()([
      "signals",
      "topDb",
      "frameLength",
      "hopLength"
    ]);
    StreamingLoudnessGainRequestKeys = keysOf()([
      "samples",
      "sampleRate",
      "config"
    ]);
    StreamingLoudnessGainStereoRequestKeys = keysOf()([
      "left",
      "right",
      "sampleRate",
      "config"
    ]);
    SuggestMixSceneRequestKeys = keysOf()([
      "tracks",
      "sampleRate",
      "options"
    ]);
    MixAssistantOptionsKeys = keysOf()([
      "targetTrackLufs",
      "suggestionStrength",
      "eqMaxCutDb",
      "mixBusHeadroomDbtp",
      "tempoBpm",
      "enableStructure",
      "enableGain",
      "enableBalance",
      "enableEq",
      "enableDynamics",
      "enableImage",
      "enableHighPass",
      "nFft",
      "hopLength"
    ]);
    RirSynthOptionsKeys = keysOf()([
      "sampleRate",
      "preferEyring",
      "mixingTimeMs",
      "crossfadeMs",
      "lengthM",
      "widthM",
      "heightM",
      "absorption",
      "bandAbsorption",
      "bandScattering",
      "materialPreset",
      "sourceX",
      "sourceY",
      "sourceZ",
      "listenerX",
      "listenerY",
      "listenerZ",
      "ismOrder",
      "seed",
      "maxSeconds",
      "airAbsorptionEnabled",
      "airTemperatureC",
      "airHumidityPercent"
    ]);
    TempogramRequestKeys = keysOf()([
      "onsetEnvelope",
      "sampleRate",
      "hopLength",
      "winLength",
      "mode",
      "center",
      "norm"
    ]);
    TempogramRatioRequestKeys = keysOf()([
      "tempogramData",
      "winLength",
      "sampleRate",
      "hopLength",
      "factors",
      "validate"
    ]);
    TimeStretchRequestKeys = keysOf()([
      "samples",
      "sampleRate",
      "rate",
      "nFft",
      "hopLength",
      "validate"
    ]);
    ToneRequestKeys = keysOf()([
      "frequency",
      "sampleRate",
      "duration",
      "phase",
      "amplitude"
    ]);
    TonnetzRequestKeys = keysOf()(["chromagram", "nChroma", "nFrames"]);
    TranscribeRequestKeys = keysOf()([
      "samples",
      "sampleRate",
      "tempoBpm",
      "polyphonic",
      "referenceHz",
      "fmin",
      "fmax",
      "minNoteMs",
      "minNoteDivision",
      "segmentationThresholdCents",
      "velocityFloorDb",
      "fixedVelocity",
      "maxPolyphony",
      "minFramePeakRatio",
      "minRidgePeakRatio",
      "reattackRatio",
      "group",
      "channel"
    ]);
    TrimRequestKeys = keysOf()([
      "samples",
      "sampleRate",
      "thresholdDb",
      "frameLength",
      "hopLength",
      "validate"
    ]);
    VectorNormalizeRequestKeys = keysOf()([
      "values",
      "normType",
      "threshold"
    ]);
    VoiceChangeRequestKeys = keysOf()([
      "samples",
      "sampleRate",
      "pitchSemitones",
      "formantFactor",
      "formantMode",
      "validate"
    ]);
    VoiceChangeRealtimeRequestKeys = keysOf()([
      "samples",
      "sampleRate",
      "preset",
      "channels",
      "blockSize",
      "validate"
    ]);
    VqtRequestKeys = keysOf()([
      "gamma",
      "samples",
      "sampleRate",
      "hopLength",
      "fmin",
      "nBins",
      "binsPerOctave",
      "validate"
    ]);
    VqtToAudioRequestKeys = keysOf()([
      "gamma",
      "magnitude",
      "nBins",
      "nFrames",
      "sampleRate",
      "hopLength",
      "fmin",
      "binsPerOctave",
      "nIter",
      "validate"
    ]);
    WaveformPeakPyramidRequestKeys = keysOf()([
      "samples",
      "channels",
      "samplesPerBucketLevels",
      "validate"
    ]);
    WaveformPeaksRequestKeys = keysOf()([
      "samples",
      "channels",
      "samplesPerBucket",
      "validate"
    ]);
    ZeroCrossingsRequestKeys = keysOf()([
      "samples",
      "threshold",
      "refMagnitude",
      "pad",
      "zeroPos"
    ]);
    REQUEST_SHAPES = {
      alignTakeToReference: { keys: AlignTakeToReferenceRequestKeys },
      amplitudeToDb: { keys: DbConversionRequestKeys },
      analyze: { keys: MusicAnalyzeRequestKeys },
      analyzeBpm: { keys: AnalyzeBpmRequestKeys },
      analyzeDynamics: { keys: AnalyzeDynamicsRequestKeys },
      analyzeImpulseResponse: { keys: AnalyzeImpulseResponseRequestKeys },
      analyzeMelody: { keys: AnalyzeMelodyRequestKeys },
      analyzePolyphonic: { keys: AnalyzePolyphonicRequestKeys },
      analyzeRhythm: { keys: AnalyzeRhythmRequestKeys },
      analyzeSections: { keys: AnalyzeSectionsRequestKeys },
      analyzeTimbre: { keys: AnalyzeTimbreRequestKeys },
      analyzeWithProgress: {
        keys: AnalyzeWithProgressRequestKeys,
        nested: { options: MusicAnalyzeOptionsKeys }
      },
      assignNoteTargets: { keys: AssignNoteTargetsRequestKeys },
      autoTune: { keys: AutoTuneRequestKeys, hints: { key: AutoTuneKeyKeys } },
      bassChroma: { keys: BassChromaSpectrogramRequestKeys },
      chirp: { keys: ChirpRequestKeys },
      chordFunctionalAnalysis: { keys: ChordFunctionalAnalysisRequestKeys },
      chordFunctions: { keys: Anon19Keys },
      chroma: { keys: SpectrogramRequestKeys },
      chromaCens: { keys: ChromaSpectrogramRequestKeys },
      chromaCqt: { keys: ChromaSpectrogramRequestKeys },
      clicks: { keys: ClicksRequestKeys },
      cqt: { keys: CqtRequestKeys },
      cqtToAudio: { keys: CqtToAudioRequestKeys },
      createVocalEditSession: {
        keys: VocalCreateRequestKeys,
        nested: { limits: VocalSessionLimitsKeys },
        hints: { analysis: VocalAnalysisInputKeys }
      },
      cyclicTempogram: { keys: CyclicTempogramRequestKeys },
      decompose: { keys: DecomposeRequestKeys },
      decomposeNotePitch: { keys: DecomposeNotePitchRequestKeys },
      decomposeStems: { keys: DecomposeStemsRequestKeys },
      decomposeStemsLinked: { keys: DecomposeStemsLinkedRequestKeys },
      decomposeWithInit: { keys: DecomposeWithInitRequestKeys },
      deemphasis: { keys: EmphasisRequestKeys },
      detectAcoustic: { keys: DetectAcousticRequestKeys },
      detectBeats: { keys: SamplesRequestKeys },
      detectBoundaries: { keys: DetectBoundariesRequestKeys },
      detectBpm: { keys: SamplesRequestKeys },
      detectChords: { keys: DetectChordsRequestKeys },
      detectDownbeats: { keys: SamplesRequestKeys },
      detectKey: { keys: DetectKeyRequestKeys },
      detectKeyCandidates: { keys: DetectKeyCandidatesRequestKeys },
      detectOnsets: { keys: DetectOnsetsRequestKeys },
      ebur128LoudnessRange: { keys: Ebur128LoudnessRangeRequestKeys },
      estimateMeter: { keys: EstimateMeterRequestKeys },
      estimateRoom: { keys: EstimateRoomRequestKeys },
      estimateTuning: { keys: EstimateTuningRequestKeys },
      extractNotes: { keys: ExtractNotesRequestKeys },
      extractPercussiveEvents: { keys: ExtractPercussiveEventsRequestKeys },
      fixFrames: { keys: FixFramesRequestKeys },
      fixLength: { keys: FixLengthRequestKeys },
      fourierTempogram: { keys: FourierTempogramRequestKeys },
      frameSignal: { keys: FrameSignalRequestKeys },
      griffinLim: { keys: GriffinLimRequestKeys },
      harmonic: { keys: HarmonicRequestKeys },
      hpss: { keys: HpssRequestKeys },
      hpssWithResidual: { keys: HpssWithResidualRequestKeys },
      hybridCqt: { keys: CqtRequestKeys },
      lufs: { keys: LufsRequestKeys },
      lufsInterleaved: { keys: LufsInterleavedRequestKeys },
      lufsSeriesInterleaved: { keys: LufsSeriesInterleavedRequestKeys },
      masterAudio: { keys: MasterAudioRequestKeys, hints: { overrides: MasteringChainConfigKeys } },
      masterAudioStereo: {
        keys: MasterAudioStereoRequestKeys,
        hints: { overrides: MasteringChainConfigKeys }
      },
      masterAudioStereoWithProgress: {
        keys: MasterAudioStereoRequestKeys,
        hints: { overrides: MasteringChainConfigKeys }
      },
      masterAudioWithProgress: {
        keys: MasterAudioRequestKeys,
        hints: { overrides: MasteringChainConfigKeys }
      },
      mastering: { keys: MasteringRequestKeys },
      masteringAbMatchLoudness: { keys: MasteringAbMatchLoudnessRequestKeys },
      masteringAbMatchLoudnessStereo: { keys: MasteringAbMatchLoudnessStereoRequestKeys },
      masteringAssistantSuggest: { keys: MasteringAssistantParamsRequestKeys },
      masteringAssistantSuggestChain: { keys: MasteringAssistantParamsRequestKeys },
      masteringAssistantSuggestChainStereo: { keys: MasteringAssistantStereoParamsRequestKeys },
      masteringAssistantSuggestStereo: { keys: MasteringAssistantStereoParamsRequestKeys },
      masteringAudioProfile: { keys: MasteringSamplesParamsRequestKeys },
      masteringAudioProfileStereo: { keys: MasteringStereoParamsRequestKeys },
      masteringChain: { keys: MasteringChainRequestKeys, hints: { config: MasteringChainConfigKeys } },
      masteringChainStereo: {
        keys: MasteringChainStereoRequestKeys,
        hints: { config: MasteringChainConfigKeys }
      },
      masteringChainStereoWithProgress: {
        keys: MasteringChainStereoRequestKeys,
        hints: { config: MasteringChainConfigKeys }
      },
      masteringChainWithProgress: {
        keys: MasteringChainRequestKeys,
        hints: { config: MasteringChainConfigKeys }
      },
      masteringDynamicsCompressor: { keys: MasteringDynamicsCompressorRequestKeys },
      masteringDynamicsGate: { keys: MasteringDynamicsGateRequestKeys },
      masteringDynamicsTransientShaper: { keys: MasteringDynamicsTransientShaperRequestKeys },
      masteringPairAnalyze: { keys: Anon74Keys },
      masteringPairProcess: { keys: MasteringPairProcessRequestKeys },
      masteringPairProcessStereo: { keys: MasteringPairProcessStereoRequestKeys },
      masteringProcess: { keys: MasteringProcessRequestKeys },
      masteringProcessStereo: { keys: MasteringProcessStereoRequestKeys },
      masteringRepairAnalyze: { keys: MasteringRepairAnalyzeRequestKeys },
      masteringRepairApply: { keys: MasteringRepairApplyRequestKeys },
      masteringRepairDeclick: { keys: MasteringRepairDeclickRequestKeys },
      masteringRepairDeclickStereo: { keys: MasteringRepairDeclickStereoRequestKeys },
      masteringRepairDeclip: { keys: MasteringRepairDeclipRequestKeys },
      masteringRepairDeclipStereo: { keys: MasteringRepairDeclipStereoRequestKeys },
      masteringRepairDecrackle: { keys: MasteringRepairDecrackleRequestKeys },
      masteringRepairDecrackleStereo: { keys: MasteringRepairDecrackleStereoRequestKeys },
      masteringRepairDehum: { keys: MasteringRepairDehumRequestKeys },
      masteringRepairDehumStereo: { keys: MasteringRepairDehumStereoRequestKeys },
      masteringRepairDenoiseClassical: { keys: MasteringRepairDenoiseClassicalRequestKeys },
      masteringRepairDenoiseClassicalLinked: { keys: MasteringRepairDenoiseClassicalLinkedRequestKeys },
      masteringRepairDenoiseClassicalStereo: { keys: MasteringRepairDenoiseClassicalStereoRequestKeys },
      masteringRepairDereverbClassical: { keys: MasteringRepairDereverbClassicalRequestKeys },
      masteringRepairDereverbClassicalLinked: {
        keys: MasteringRepairDereverbClassicalLinkedRequestKeys
      },
      masteringRepairDereverbClassicalStereo: {
        keys: MasteringRepairDereverbClassicalStereoRequestKeys
      },
      masteringRepairDetectClicks: { keys: MasteringRepairDetectClicksRequestKeys },
      masteringRepairDetectClipping: { keys: MasteringRepairDetectClippingRequestKeys },
      masteringRepairDetectCrackle: { keys: MasteringRepairDetectCrackleRequestKeys },
      masteringRepairDetectHum: { keys: MasteringRepairDetectHumRequestKeys },
      masteringRepairDetectNoiseFloor: { keys: MasteringRepairDetectNoiseFloorRequestKeys },
      masteringRepairDetectReverb: { keys: MasteringRepairDetectReverbRequestKeys },
      masteringRepairDetectTrimRange: { keys: MasteringRepairDetectTrimRangeRequestKeys },
      masteringRepairDetectTrimRangeStereo: { keys: MasteringRepairDetectTrimRangeStereoRequestKeys },
      masteringRepairTrimSilence: { keys: MasteringRepairTrimSilenceRequestKeys },
      masteringRepairTrimSilenceStereo: { keys: MasteringRepairTrimSilenceStereoRequestKeys },
      masteringStereoAnalyze: { keys: Anon105Keys },
      masteringStreamingPreview: { keys: MasteringStreamingPreviewRequestKeys },
      masteringStreamingPreviewStereo: { keys: MasteringStreamingPreviewStereoRequestKeys },
      melDelta: { keys: MelDeltaRequestKeys },
      melSpectrogram: { keys: MelSpectrogramRequestKeys },
      mergeNotes: { keys: MergeNotesRequestKeys },
      meteringCrestFactorDb: { keys: MeteringSamplesRequestKeys },
      meteringCrestFactorDbStereo: { keys: MeteringStereoRequestKeys },
      meteringDcOffset: { keys: MeteringSamplesRequestKeys },
      meteringDetectClipping: { keys: MeteringDetectClippingRequestKeys },
      meteringDynamicRange: { keys: MeteringDynamicRangeRequestKeys },
      meteringPeakDb: { keys: MeteringSamplesRequestKeys },
      meteringPhaseScope: { keys: MeteringStereoDecimatedRequestKeys },
      meteringPhaseScopeDecimated: { keys: MeteringStereoDecimatedRequestKeys },
      meteringRmsDb: { keys: MeteringSamplesRequestKeys },
      meteringSilenceRatio: { keys: MeteringSilenceRatioRequestKeys },
      meteringSpectrum: { keys: MeteringSpectrumRequestKeys },
      meteringSpectrumFrame: { keys: MeteringSpectrumFrameRequestKeys },
      meteringStereoCorrelation: { keys: MeteringStereoRequestKeys },
      meteringStereoWidth: { keys: MeteringStereoRequestKeys },
      meteringTruePeakDb: { keys: MeteringTruePeakRequestKeys },
      meteringVectorscope: { keys: MeteringStereoDecimatedRequestKeys },
      meteringVectorscopeDecimated: { keys: MeteringStereoDecimatedRequestKeys },
      mfcc: { keys: MfccRequestKeys },
      mixStereo: { keys: MixStereoRequestKeys },
      momentaryLufs: { keys: LufsRequestKeys },
      nnFilter: { keys: NnFilterRequestKeys },
      nnlsChroma: { keys: NnlsChromaRequestKeys },
      normalize: { keys: NormalizeRequestKeys },
      normalizeStereo: { keys: NormalizeStereoRequestKeys },
      noteMove: { keys: NoteMoveRequestKeys },
      noteSegments: { keys: NoteSegmentsRequestKeys },
      noteStretch: { keys: NoteStretchRequestKeys },
      noteTargetsFromSmf: { keys: NoteTargetsFromSmfRequestKeys },
      onsetBacktrack: { keys: OnsetBacktrackRequestKeys },
      onsetEnvelope: { keys: OnsetEnvelopeRequestKeys },
      onsetStrengthMulti: { keys: OnsetStrengthMultiRequestKeys },
      padCenter: { keys: PadCenterRequestKeys },
      pcen: { keys: PcenRequestKeys },
      peakPick: { keys: PeakPickRequestKeys },
      percussive: { keys: PercussiveRequestKeys },
      phaseVocoder: { keys: PhaseVocoderRequestKeys },
      piptrack: { keys: PiptrackRequestKeys },
      pitchCorrectTimevarying: { keys: PitchCorrectTimevaryingRequestKeys },
      pitchCorrectToMidi: { keys: PitchCorrectToMidiRequestKeys },
      pitchCorrectToMidiTimevarying: { keys: PitchCorrectToMidiTimevaryingRequestKeys },
      pitchPyin: { keys: PitchPyinRequestKeys },
      pitchShift: { keys: PitchShiftRequestKeys },
      pitchTuning: { keys: PitchTuningRequestKeys },
      pitchYin: { keys: PitchYinRequestKeys },
      plp: { keys: PlpRequestKeys },
      polyFeatures: { keys: PolyFeaturesRequestKeys },
      powerToDb: { keys: DbConversionRequestKeys },
      preemphasis: { keys: EmphasisRequestKeys },
      pseudoCqt: { keys: CqtRequestKeys },
      reassignedSpectrogram: { keys: ReassignedSpectrogramRequestKeys },
      remix: { keys: RemixRequestKeys },
      remixAlignedIntervals: { keys: RemixRequestKeys },
      renderNotes: { keys: RenderNotesRequestKeys },
      renderPercussiveEvents: { keys: RenderPercussiveEventsRequestKeys },
      renderPlayback: {
        keys: RenderPlaybackRequestKeys,
        nested: { config: PlaybackRendererConfigKeys }
      },
      resample: { keys: ResampleRequestKeys },
      restoreVocalEditSession: {
        keys: VocalRestoreRequestKeys,
        nested: { limits: VocalSessionLimitsKeys }
      },
      rmsEnergy: { keys: ZeroCrossingRateRequestKeys },
      roomGeometryFromEstimate: {
        keys: RoomGeometryFromEstimateRequestKeys,
        hints: { source: RoomPlacementKeys, listener: RoomPlacementKeys }
      },
      roomMorph: { keys: RoomMorphRequestKeys },
      roomMorphStereo: { keys: RoomMorphStereoRequestKeys },
      segmentAgglomerative: { keys: SegmentAgglomerativeRequestKeys },
      segmentCrossSimilarity: { keys: SegmentCrossSimilarityRequestKeys },
      segmentLagToRecurrence: { keys: SegmentLagToRecurrenceRequestKeys },
      segmentPathEnhance: { keys: SegmentPathEnhanceRequestKeys },
      segmentRecurrenceMatrix: { keys: SegmentRecurrenceMatrixRequestKeys },
      segmentRecurrenceToLag: { keys: SegmentRecurrenceToLagRequestKeys },
      segmentSubsegment: { keys: SegmentSubsegmentRequestKeys },
      shortTermLufs: { keys: LufsRequestKeys },
      spectralBandwidth: { keys: Anon168Keys },
      spectralCentroid: { keys: SpectralFrameRequestKeys },
      spectralContrast: { keys: SpectralContrastRequestKeys },
      spectralEdit: { keys: SpectralEditRequestKeys },
      spectralFlatness: { keys: SpectralFrameRequestKeys },
      spectralFlux: { keys: Anon172Keys },
      spectralRolloff: { keys: SpectralRolloffRequestKeys },
      splitNote: { keys: SplitNoteRequestKeys },
      splitSilence: { keys: SilenceRequestKeys },
      splitSilenceCommon: { keys: SplitSilenceCommonRequestKeys },
      splitSilenceCommonWithReport: { keys: SplitSilenceCommonRequestKeys },
      stft: { keys: SpectrogramRequestKeys },
      stftDb: { keys: SpectrogramRequestKeys },
      streamingLoudnessGain: {
        keys: StreamingLoudnessGainRequestKeys,
        hints: { config: MasteringChainConfigKeys }
      },
      streamingLoudnessGainStereo: {
        keys: StreamingLoudnessGainStereoRequestKeys,
        hints: { config: MasteringChainConfigKeys }
      },
      suggestMixScene: {
        keys: SuggestMixSceneRequestKeys,
        hints: { options: MixAssistantOptionsKeys }
      },
      suggestMixSceneJson: {
        keys: SuggestMixSceneRequestKeys,
        hints: { options: MixAssistantOptionsKeys }
      },
      synthesizeRir: { keys: RirSynthOptionsKeys },
      tempogram: { keys: TempogramRequestKeys },
      tempogramRatio: { keys: TempogramRatioRequestKeys },
      timeStretch: { keys: TimeStretchRequestKeys },
      tone: { keys: ToneRequestKeys },
      tonnetz: { keys: TonnetzRequestKeys },
      transcribe: { keys: TranscribeRequestKeys },
      trim: { keys: TrimRequestKeys },
      trimSilence: { keys: SilenceRequestKeys },
      vectorNormalize: { keys: VectorNormalizeRequestKeys },
      voiceChange: { keys: VoiceChangeRequestKeys },
      voiceChangeRealtime: { keys: VoiceChangeRealtimeRequestKeys },
      vqt: { keys: VqtRequestKeys },
      vqtToAudio: { keys: VqtToAudioRequestKeys },
      waveformPeakPyramid: { keys: WaveformPeakPyramidRequestKeys },
      waveformPeaks: { keys: WaveformPeaksRequestKeys },
      zeroCrossingRate: { keys: ZeroCrossingRateRequestKeys },
      zeroCrossings: { keys: ZeroCrossingsRequestKeys }
    };
    MUSIC_ANALYZE_OPTION_KEYS = MusicAnalyzeOptionsKeys;
  }
});

// src/validation.ts
function assertNonEmptySamples(fnName, samples, argName = "samples") {
  if (samples.length === 0) {
    throw new RangeError(`${fnName}: ${argName} must not be empty`);
  }
}
function assertFiniteSamples(fnName, samples, validate, argName = "samples") {
  if (!validate) {
    return;
  }
  for (let i = 0; i < samples.length; i++) {
    const v = samples[i];
    if (!Number.isFinite(v)) {
      throw new RangeError(`${fnName}: ${argName} contains NaN or Inf at index ${i}`);
    }
  }
}
function assertSamples(fnName, samples, validate, argName = "samples") {
  assertNonEmptySamples(fnName, samples, argName);
  assertFiniteSamples(fnName, samples, validate, argName);
}
function assertSampleRate(fnName, sampleRate, argName = "sampleRate") {
  if (typeof sampleRate !== "number") {
    throw new TypeError(`${fnName}: ${argName} must be a number`);
  }
  if (!Number.isInteger(sampleRate)) {
    throw new RangeError(`${fnName}: ${argName} must be an integer`);
  }
  if (sampleRate < MIN_AUDIO_SAMPLE_RATE || sampleRate > MAX_AUDIO_SAMPLE_RATE) {
    throw new RangeError(
      `${fnName}: ${argName} out of supported range [${MIN_AUDIO_SAMPLE_RATE}, ${MAX_AUDIO_SAMPLE_RATE}]`
    );
  }
}
function assertAudioInput(fnName, samples, sampleRate, options = {}, argName = "samples") {
  assertFloat32Array(fnName, samples, argName);
  assertSampleRate(fnName, sampleRate);
  assertSamples(fnName, samples, options.validate !== false, argName);
}
function assertAudioSamples(fnName, samples, options = {}, argName = "samples") {
  assertFloat32Array(fnName, samples, argName);
  assertSamples(fnName, samples, options.validate !== false, argName);
}
function assertFloat32Array(fnName, value, argName) {
  if (!(value instanceof Float32Array)) {
    throw new TypeError(`${fnName}: ${argName} must be a Float32Array`);
  }
}
function assertString(fnName, value, argName) {
  if (typeof value !== "string") {
    throw new TypeError(`${fnName}: ${argName} must be a string`);
  }
}
function assertKnownRequestKeys(fnName, request) {
  const shape = REQUEST_SHAPES[fnName];
  if (shape === void 0) {
    throw new Error(`${fnName}: no request shape is declared`);
  }
  for (const key of Object.keys(request)) {
    if (shape.keys.includes(key)) {
      continue;
    }
    const owner = Object.entries({ ...shape.nested, ...shape.hints }).find(
      ([, keys]) => keys.includes(key)
    );
    const hint = owner === void 0 ? "" : ` ('${key}' belongs under '${owner[0]}')`;
    throw new TypeError(`${fnName}: unknown request key '${key}'${hint}`);
  }
  for (const [field, keys] of Object.entries(shape.nested ?? {})) {
    const value = request[field];
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      continue;
    }
    for (const key of Object.keys(value)) {
      if (!keys.includes(key)) {
        throw new TypeError(`${fnName}: unknown option '${key}' in '${field}'`);
      }
    }
  }
}
function optionsBag(fnName, options) {
  const shape = REQUEST_SHAPES[fnName];
  if (shape === void 0) {
    throw new Error(`${fnName}: no request shape is declared`);
  }
  for (const key of Object.keys(options ?? {})) {
    if (!shape.keys.includes(key)) {
      throw new TypeError(`${fnName}: unknown option '${key}'`);
    }
  }
  return options;
}
function requestObject(fnName, value, argName = "samples", requestOnly = false) {
  if (typeof value !== "object" || value === null || Array.isArray(value) || ArrayBuffer.isView(value)) {
    if (requestOnly) {
      throw new TypeError(`${fnName}: request must be an object`);
    }
    assertAudioSamples(fnName, value, {}, argName);
    return value;
  }
  assertKnownRequestKeys(fnName, value);
  return value;
}
var MIN_AUDIO_SAMPLE_RATE, MAX_AUDIO_SAMPLE_RATE;
var init_validation = __esm({
  "src/validation.ts"() {
    "use strict";
    init_request_keys();
    MIN_AUDIO_SAMPLE_RATE = 8e3;
    MAX_AUDIO_SAMPLE_RATE = 384e3;
  }
});

// src/public_types_acoustic.ts
var init_public_types_acoustic = __esm({
  "src/public_types_acoustic.ts"() {
    "use strict";
  }
});

// src/public_types_mastering.ts
var init_public_types_mastering = __esm({
  "src/public_types_mastering.ts"() {
    "use strict";
  }
});

// src/public_types_mixing.ts
var init_public_types_mixing = __esm({
  "src/public_types_mixing.ts"() {
    "use strict";
  }
});

// src/public_types_music.ts
var PitchClass, Mode, KeyProfile;
var init_public_types_music = __esm({
  "src/public_types_music.ts"() {
    "use strict";
    PitchClass = {
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
    Mode = {
      Major: 0,
      Minor: 1,
      Dorian: 2,
      Phrygian: 3,
      Lydian: 4,
      Mixolydian: 5,
      Locrian: 6
    };
    KeyProfile = {
      KrumhanslSchmuckler: 0,
      Temperley: 1,
      Shaath: 2,
      FaraldoEDMT: 3,
      FaraldoEDMA: 4,
      FaraldoEDMM: 5,
      BellmanBudge: 6
    };
  }
});

// src/public_types_playback.ts
var init_public_types_playback = __esm({
  "src/public_types_playback.ts"() {
    "use strict";
  }
});

// src/public_types_realtime.ts
var init_public_types_realtime = __esm({
  "src/public_types_realtime.ts"() {
    "use strict";
  }
});

// src/public_types_repair.ts
var init_public_types_repair = __esm({
  "src/public_types_repair.ts"() {
    "use strict";
  }
});

// src/public_types_spectral.ts
var init_public_types_spectral = __esm({
  "src/public_types_spectral.ts"() {
    "use strict";
  }
});

// src/public_types.ts
var init_public_types = __esm({
  "src/public_types.ts"() {
    "use strict";
    init_public_types_acoustic();
    init_public_types_mastering();
    init_public_types_mixing();
    init_public_types_music();
    init_public_types_playback();
    init_public_types_realtime();
    init_public_types_repair();
    init_public_types_spectral();
  }
});

// src/analysis_helpers.ts
function pitchClassName(value) {
  return PITCH_CLASS_NAMES[value] ?? "C";
}
function keyModeName(ordinal) {
  const name = KEY_MODE_NAMES[ordinal];
  if (name === void 0) {
    throw new RangeError(`Invalid key mode: ${String(ordinal)}`);
  }
  return name;
}
function assertNameOrOrdinal(value, field, what) {
  if (typeof value !== "number" && typeof value !== "string") {
    throw new TypeError(`${field} must be ${what} name or ordinal`);
  }
}
function keyModeOrdinal(mode, field = "key mode") {
  assertNameOrOrdinal(mode, field, "a mode");
  return resolveEnumOrdinal(mode, KEY_MODE_VALUES, field);
}
function pitchClassOrdinal(root, field = "pitch class") {
  assertNameOrOrdinal(root, field, "a pitch class");
  return resolveEnumOrdinal(root, PITCH_CLASS_VALUES, field);
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
  return modes.map((mode) => resolveEnumOrdinal(mode, KEY_MODE_VALUES, "key mode"));
}
function keyProfileValue(profile) {
  if (profile === void 0) {
    return -1;
  }
  return resolveEnumOrdinal(profile, KEY_PROFILE_VALUES, "key profile");
}
function convertChordAnalysisResult(wasm) {
  return {
    chords: wasm.chords.map((c) => ({
      root: c.root,
      bass: c.bass,
      rootName: pitchClassName(c.root),
      bassName: pitchClassName(c.bass),
      quality: c.quality,
      start: c.start,
      end: c.end,
      duration: c.end - c.start,
      confidence: c.confidence,
      name: c.name
    })),
    tuning: wasm.tuning
  };
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
    bpmCandidates: wasm.bpmCandidates.map((candidate) => ({
      value: candidate.value,
      confidence: candidate.confidence,
      relation: candidate.relation
    })),
    key: {
      root: wasm.key.root,
      mode: keyModeName(wasm.key.mode),
      confidence: wasm.key.confidence,
      name: wasm.key.name,
      shortName: wasm.key.shortName
    },
    timeSignature: wasm.timeSignature,
    timeSignatureCandidates: wasm.timeSignatureCandidates,
    beatTimes,
    beats: wasm.beats,
    downbeatIndices: wasm.downbeatIndices,
    downbeatPhase: wasm.downbeatPhase,
    beatObservations: wasm.beatObservations,
    beatLocalBpm: wasm.beatLocalBpm,
    chords: wasm.chords.map((c) => ({
      root: c.root,
      bass: c.bass,
      rootName: pitchClassName(c.root),
      bassName: pitchClassName(c.bass),
      quality: c.quality,
      start: c.start,
      end: c.end,
      duration: c.end - c.start,
      confidence: c.confidence,
      name: c.name,
      romanNumeral: c.romanNumeral
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
    melody: wasm.melody,
    form: wasm.form,
    tuning: wasm.tuning
  };
}
var PITCH_CLASS_NAMES, KEY_MODE_NAMES, KEY_MODE_VALUES, KEY_PROFILE_VALUES, PITCH_CLASS_VALUES;
var init_analysis_helpers = __esm({
  "src/analysis_helpers.ts"() {
    "use strict";
    init_codes();
    init_public_types();
    PITCH_CLASS_NAMES = [
      "C",
      "C#",
      "D",
      "D#",
      "E",
      "F",
      "F#",
      "G",
      "G#",
      "A",
      "A#",
      "B"
    ];
    KEY_MODE_NAMES = [
      "major",
      "minor",
      "dorian",
      "phrygian",
      "lydian",
      "mixolydian",
      "locrian"
    ];
    KEY_MODE_VALUES = {
      major: Mode.Major,
      minor: Mode.Minor,
      dorian: Mode.Dorian,
      phrygian: Mode.Phrygian,
      lydian: Mode.Lydian,
      mixolydian: Mode.Mixolydian,
      locrian: Mode.Locrian
    };
    KEY_PROFILE_VALUES = {
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
    PITCH_CLASS_VALUES = Object.fromEntries(
      PITCH_CLASS_NAMES.map((name, ordinal) => [name, ordinal])
    );
  }
});

// src/_chain_config.ts
function flattenChainConfig(config) {
  const out = {};
  const walk = (node, prefix) => {
    for (const [key, value] of Object.entries(node)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (typeof value === "number" || typeof value === "boolean") {
        out[path] = value;
      } else if (typeof value === "string") {
        const resolved = getSonareModule().masteringEnumValue("", path, value);
        if (resolved === null) {
          throw new TypeError(notAValue(path));
        }
        out[path] = resolved;
      } else if (value !== null && typeof value === "object") {
        if (Array.isArray(value) && value.length === 0) {
          throw new TypeError(emptyList(path));
        }
        walk(value, path);
      } else if (value !== void 0) {
        throw new TypeError(notAValue(path));
      }
    }
  };
  walk(config, "");
  return out;
}
var emptyList, notAValue;
var init_chain_config = __esm({
  "src/_chain_config.ts"() {
    "use strict";
    init_module_state();
    emptyList = (path) => `Mastering override '${path}' is an empty list, which has no flat spelling.`;
    notAValue = (path) => `Mastering override '${path}' must be a number or boolean.`;
  }
});

// src/mastering_chain.ts
function requireModule() {
  return getSonareModule();
}
function masterAudioRequest(fnName, requestOrSamples, sampleRate, preset, overrides, onProgress) {
  if (requestOrSamples instanceof Float32Array) {
    return {
      samples: requestOrSamples,
      sampleRate,
      preset,
      overrides: overrides ?? {},
      onProgress
    };
  }
  return requestObject(fnName, requestOrSamples);
}
function masterAudioStereoRequest(fnName, requestOrLeft, right, sampleRate, preset, overrides, onProgress) {
  if (requestOrLeft instanceof Float32Array) {
    return {
      left: requestOrLeft,
      right,
      sampleRate,
      preset,
      overrides: overrides ?? {},
      onProgress
    };
  }
  return requestObject(fnName, requestOrLeft, "left");
}
function masterAudio(samples, sampleRate = 22050, presetName = "pop", overrides = {}, onProgress) {
  const request = masterAudioRequest(
    "masterAudio",
    samples,
    sampleRate,
    presetName,
    overrides,
    onProgress
  );
  assertString("masterAudio", request.preset ?? "pop", "preset");
  assertAudioInput("masterAudio", request.samples, request.sampleRate ?? 22050);
  const flat = flattenChainConfig(request.overrides ?? {});
  if (request.onProgress || request.cancel) {
    return requireModule().masterAudioWithProgress(
      request.preset ?? "pop",
      request.samples,
      request.sampleRate ?? 22050,
      flat,
      request.onProgress ?? (() => {
      }),
      request.cancel ?? (() => false)
    );
  }
  return requireModule().masterAudio(
    request.preset ?? "pop",
    request.samples,
    request.sampleRate ?? 22050,
    flat
  );
}
function masterAudioStereo(left, right = void 0, sampleRate = 22050, presetName = "pop", overrides = {}, onProgress) {
  const request = masterAudioStereoRequest(
    "masterAudioStereo",
    left,
    right,
    sampleRate,
    presetName,
    overrides,
    onProgress
  );
  assertString("masterAudioStereo", request.preset ?? "pop", "preset");
  assertAudioInput("masterAudioStereo", request.left, request.sampleRate ?? 22050, {}, "left");
  assertAudioInput("masterAudioStereo", request.right, request.sampleRate ?? 22050, {}, "right");
  const flat = flattenChainConfig(request.overrides ?? {});
  if (request.left.length !== request.right.length) {
    throw new RangeError("Stereo channel lengths must match.");
  }
  if (request.onProgress || request.cancel) {
    return requireModule().masterAudioStereoWithProgress(
      request.preset ?? "pop",
      request.left,
      request.right,
      request.sampleRate ?? 22050,
      flat,
      request.onProgress ?? (() => {
      }),
      request.cancel ?? (() => false)
    );
  }
  return requireModule().masterAudioStereo(
    request.preset ?? "pop",
    request.left,
    request.right,
    request.sampleRate ?? 22050,
    flat
  );
}
var init_mastering_chain = __esm({
  "src/mastering_chain.ts"() {
    "use strict";
    init_chain_config();
    init_module_state();
    init_validation();
  }
});

// src/quick_analysis.ts
function requireModule2() {
  return getSonareModule();
}
function detectBpm(samples, sampleRate = 22050, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...optionsBag("detectBpm", options) } : requestObject("detectBpm", samples);
  assertAudioInput("detectBpm", request.samples, request.sampleRate ?? 22050, request);
  return requireModule2().detectBpm(request.samples, request.sampleRate ?? 22050);
}
function detectKey(samples, sampleRate = 22050, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...optionsBag("detectKey", options) } : requestObject("detectKey", samples);
  assertAudioInput("detectKey", request.samples, request.sampleRate ?? 22050, request);
  const result = requireModule2()._detectKeyWithOptions(
    request.samples,
    request.sampleRate ?? 22050,
    request.nFft ?? 4096,
    request.hopLength ?? 512,
    request.useHpss ?? false,
    request.loudnessWeighted ?? false,
    request.highPassHz ?? 0,
    keyModeValues(request.modes),
    keyProfileValue(request.profile),
    request.genreHint ?? "",
    request.tuning ?? 0
  );
  return {
    root: result.root,
    mode: keyModeName(result.mode),
    confidence: result.confidence,
    name: result.name,
    shortName: result.shortName,
    tuning: result.tuning
  };
}
function detectChords(samples, sampleRate = 22050, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...optionsBag("detectChords", options) } : requestObject("detectChords", samples);
  assertAudioInput("detectChords", request.samples, request.sampleRate ?? 22050, request);
  const result = requireModule2().detectChords(
    request.samples,
    request.sampleRate ?? 22050,
    request.minDuration ?? 0.3,
    request.smoothingWindow ?? 2,
    request.threshold ?? 0.5,
    request.useTriadsOnly ?? false,
    request.nFft ?? 2048,
    request.hopLength ?? 512,
    request.useBeatSync ?? true,
    request.useHmm ?? false,
    request.hmmBeamWidth ?? 24,
    request.useKeyContext ?? false,
    pitchClassOrdinal(request.keyRoot ?? PitchClass.C, "keyRoot"),
    keyModeOrdinal(request.keyMode ?? Mode.Major, "keyMode"),
    request.detectInversions ?? false,
    chordChromaMethodValue(request.chromaMethod ?? "stft"),
    request.tuning ?? 0
  );
  return convertChordAnalysisResult(result);
}
function analyzeWithProgress(samples, sampleRate = 22050, onProgress, options) {
  const request = requestObject(
    "analyzeWithProgress",
    samples instanceof Float32Array ? { samples, sampleRate, onProgress, options } : samples
  );
  assertAudioInput("analyzeWithProgress", request.samples, request.sampleRate ?? 22050, request);
  const flat = {};
  for (const key of MUSIC_ANALYZE_OPTION_KEYS) {
    const value = request[key];
    if (value !== void 0) {
      flat[key] = value;
    }
  }
  const result = requireModule2().analyzeWithProgress(
    request.samples,
    request.sampleRate ?? 22050,
    { ...flat, ...request.options },
    request.onProgress ?? (() => {
    }),
    request.cancel ?? (() => false)
  );
  return convertAnalysisResult(result);
}
var init_quick_analysis = __esm({
  "src/quick_analysis.ts"() {
    "use strict";
    init_analysis_helpers();
    init_module_state();
    init_public_types();
    init_request_keys();
    init_validation();
  }
});

// src/lifetime.ts
var symbolCtor = Symbol;
symbolCtor.dispose ?? (symbolCtor.dispose = /* @__PURE__ */ Symbol.for("Symbol.dispose"));

// src/worker.ts
init_errors();

// src/index.ts
init_module_state();
var module = null;
var initPromise = null;
var firstInitOptions;
async function init(options) {
  if (module) {
    assertSameInitOptions(firstInitOptions, options);
    return;
  }
  if (initPromise) {
    assertSameInitOptions(firstInitOptions, options);
    return initPromise;
  }
  firstInitOptions = options && { ...options };
  initPromise = (async () => {
    try {
      const createModule = options?.moduleFactory ?? (await import("./sonare.js")).default;
      const created = await createModule(options);
      assertAbiCompatible(created);
      module = created;
      setSonareModule(module);
    } catch (error) {
      initPromise = null;
      firstInitOptions = void 0;
      throw error;
    }
  })();
  return initPromise;
}

// src/worker.ts
init_mastering_chain();
init_quick_analysis();
function transferableBuffers(value, seen = /* @__PURE__ */ new Set()) {
  const buffers = [];
  const seenBuffers = /* @__PURE__ */ new Set();
  const visit = (item) => {
    if (item === null || item === void 0 || typeof item !== "object") {
      return;
    }
    if (ArrayBuffer.isView(item)) {
      const buffer = item.buffer;
      if (buffer instanceof ArrayBuffer && !seenBuffers.has(buffer)) {
        seenBuffers.add(buffer);
        buffers.push(buffer);
      }
      return;
    }
    if (item instanceof ArrayBuffer) {
      if (!seenBuffers.has(item)) {
        seenBuffers.add(item);
        buffers.push(item);
      }
      return;
    }
    if (seen.has(item)) {
      return;
    }
    seen.add(item);
    if (Array.isArray(item)) {
      item.forEach(visit);
      return;
    }
    Object.values(item).forEach(visit);
  };
  visit(value);
  return buffers;
}
function errorMessage(error) {
  if (error instanceof SonareError) {
    return {
      name: error.name,
      message: error.message,
      code: error.code,
      codeName: error.codeName
    };
  }
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }
  return { name: "Error", message: String(error) };
}
function cancelledError() {
  return new SonareError(8 /* Cancelled */, "Cancelled", "Operation cancelled");
}
function installOfflineWorkerEndpoint(endpoint2) {
  const cancelled = /* @__PURE__ */ new Set();
  const inFlight = /* @__PURE__ */ new Set();
  const run = async (message) => {
    inFlight.add(message.id);
    const cancelFlag = message.cancelBuffer ? new Int32Array(message.cancelBuffer) : void 0;
    const isCancelled = () => cancelled.has(message.id) || cancelFlag !== void 0 && Atomics.load(cancelFlag, 0) !== 0;
    const onProgress = (progress, stage) => {
      endpoint2.postMessage({ type: "sonare:offline-progress", id: message.id, progress, stage });
      return isCancelled() ? false : void 0;
    };
    try {
      await init();
      if (isCancelled()) {
        throw cancelledError();
      }
      let result;
      switch (message.operation) {
        case "analyze":
          result = analyzeWithProgress({
            ...message.request,
            onProgress,
            cancel: isCancelled
          });
          break;
        case "detectBpm":
          result = detectBpm(message.request);
          break;
        case "detectKey":
          result = detectKey(message.request);
          break;
        case "detectChords":
          result = detectChords(message.request);
          break;
        case "masterAudio":
          result = masterAudio({
            ...message.request,
            onProgress,
            cancel: isCancelled
          });
          break;
        case "masterAudioStereo":
          result = masterAudioStereo({
            ...message.request,
            onProgress,
            cancel: isCancelled
          });
          break;
      }
      if (isCancelled()) {
        throw cancelledError();
      }
      endpoint2.postMessage(
        { type: "sonare:offline-result", id: message.id, result },
        transferableBuffers(result)
      );
    } catch (error) {
      endpoint2.postMessage({
        type: "sonare:offline-error",
        id: message.id,
        error: errorMessage(error)
      });
    } finally {
      cancelled.delete(message.id);
      inFlight.delete(message.id);
    }
  };
  endpoint2.addEventListener("message", (event) => {
    const message = event.data;
    if (message.type === "sonare:offline-cancel") {
      if (inFlight.has(message.id)) {
        cancelled.add(message.id);
      }
      return;
    }
    void run(message);
  });
}
function browserWorkerEndpoint() {
  const scope = globalThis;
  if (scope.document !== void 0 || !scope.postMessage || !scope.addEventListener) {
    return null;
  }
  return {
    postMessage: (message, transfer) => scope.postMessage?.(message, transfer),
    addEventListener: (type, listener) => scope.addEventListener?.(type, listener)
  };
}
var endpoint = browserWorkerEndpoint();
if (endpoint) {
  installOfflineWorkerEndpoint(endpoint);
}
export {
  installOfflineWorkerEndpoint
};
