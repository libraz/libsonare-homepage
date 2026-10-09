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
    EXPECTED_ABI_VERSION = 67305991;
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
  if (!Number.isInteger(sampleRate)) {
    throw new RangeError(`${fnName}: ${argName} must be an integer`);
  }
  if (sampleRate < MIN_AUDIO_SAMPLE_RATE || sampleRate > MAX_AUDIO_SAMPLE_RATE) {
    throw new RangeError(
      `${fnName}: ${argName} out of supported range [${MIN_AUDIO_SAMPLE_RATE}, ${MAX_AUDIO_SAMPLE_RATE}]`
    );
  }
}
var MIN_AUDIO_SAMPLE_RATE, MAX_AUDIO_SAMPLE_RATE;
var init_validation = __esm({
  "src/validation.ts"() {
    "use strict";
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
var PITCH_CLASS_NAMES, KEY_MODE_NAMES, KEY_MODE_VALUES, KEY_PROFILE_VALUES;
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
      } else if (value !== null && typeof value === "object") {
        walk(value, path);
      } else if (value !== void 0) {
        throw new TypeError(`Mastering override '${path}' must be a number or boolean.`);
      }
    }
  };
  walk(config, "");
  return out;
}
var init_chain_config = __esm({
  "src/_chain_config.ts"() {
    "use strict";
  }
});

// src/mastering_chain.ts
function requireModule() {
  return getSonareModule();
}
function masterAudioRequest(requestOrSamples, sampleRate, preset, overrides, onProgress) {
  if (requestOrSamples instanceof Float32Array) {
    return {
      samples: requestOrSamples,
      sampleRate,
      preset,
      overrides: overrides ?? {},
      onProgress
    };
  }
  return requestOrSamples;
}
function masterAudioStereoRequest(requestOrLeft, right, sampleRate, preset, overrides, onProgress) {
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
  return requestOrLeft;
}
function masterAudio(samples, sampleRate = 22050, presetName = "pop", overrides = {}, onProgress) {
  const request = masterAudioRequest(samples, sampleRate, presetName, overrides, onProgress);
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
    left,
    right,
    sampleRate,
    presetName,
    overrides,
    onProgress
  );
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
  }
});

// src/quick_analysis.ts
function requireModule2() {
  return getSonareModule();
}
function validateAnalysisInput(fnName, samples, sampleRate, options = {}) {
  assertSampleRate(fnName, sampleRate);
  assertSamples(fnName, samples, options.validate !== false);
}
function detectBpm(samples, sampleRate = 22050, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  validateAnalysisInput("detectBpm", request.samples, request.sampleRate ?? 22050, request);
  return requireModule2().detectBpm(request.samples, request.sampleRate ?? 22050);
}
function detectKey(samples, sampleRate = 22050, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  validateAnalysisInput("detectKey", request.samples, request.sampleRate ?? 22050, request);
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
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  validateAnalysisInput("detectChords", request.samples, request.sampleRate ?? 22050, request);
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
    request.keyRoot ?? PitchClass.C,
    request.keyMode ?? Mode.Major,
    request.detectInversions ?? false,
    chordChromaMethodValue(request.chromaMethod ?? "stft"),
    request.tuning ?? 0
  );
  return convertChordAnalysisResult(result);
}
function analyzeWithProgress(samples, sampleRate = 22050, onProgress, options) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, onProgress, options } : samples;
  validateAnalysisInput(
    "analyzeWithProgress",
    request.samples,
    request.sampleRate ?? 22050,
    request
  );
  const result = requireModule2().analyzeWithProgress(
    request.samples,
    request.sampleRate ?? 22050,
    request.options ?? {},
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
