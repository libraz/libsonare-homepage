// src/errors.ts
var SonareError = class extends Error {
  constructor(code, codeName, message) {
    super(message);
    this.name = "SonareError";
    this.code = code;
    this.codeName = codeName;
  }
};

// src/module_state.ts
var wrappedModule = null;
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
  let message = `libsonare native exception (${thrown})`;
  try {
    const info = raw.sonareExceptionInfo?.(thrown);
    if (info) {
      code = info.code ?? code;
      codeName = info.codeName ?? codeName;
      message = info.message || message;
    }
  } catch {
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
    throw error;
  };
  const wrapNativeObject = (value) => {
    if (value === null || typeof value !== "object") {
      return value;
    }
    if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer || value instanceof Promise) {
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
function setSonareModule(module2) {
  wrappedModule = wrapModuleErrors(module2);
}
function getSonareModule() {
  if (!wrappedModule) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return wrappedModule;
}

// src/validation.ts
var MIN_AUDIO_SAMPLE_RATE = 8e3;
var MAX_AUDIO_SAMPLE_RATE = 384e3;
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
function assertSampleRate(fnName, sampleRate) {
  if (!Number.isInteger(sampleRate) || sampleRate < MIN_AUDIO_SAMPLE_RATE || sampleRate > MAX_AUDIO_SAMPLE_RATE) {
    throw new RangeError(
      `${fnName}: sampleRate out of supported range [${MIN_AUDIO_SAMPLE_RATE}, ${MAX_AUDIO_SAMPLE_RATE}]`
    );
  }
}

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
    throw new Error("Stereo channel lengths must match.");
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

// src/public_types_music.ts
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

// src/analysis_helpers.ts
var PITCH_CLASS_NAMES = [
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
function pitchClassName(value) {
  return PITCH_CLASS_NAMES[value] ?? "C";
}
var KEY_MODE_VALUES = {
  major: Mode.Major,
  minor: Mode.Minor,
  dorian: Mode.Dorian,
  phrygian: Mode.Phrygian,
  lydian: Mode.Lydian,
  mixolydian: Mode.Mixolydian,
  locrian: Mode.Locrian
};
var KEY_PROFILE_VALUES = {
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
      confidence: c.confidence,
      name: c.name
    }))
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
      mode: wasm.key.mode,
      confidence: wasm.key.confidence,
      name: wasm.key.name,
      shortName: wasm.key.shortName
    },
    timeSignature: wasm.timeSignature,
    timeSignatureCandidates: wasm.timeSignatureCandidates,
    beatTimes,
    beats: wasm.beats,
    chords: wasm.chords.map((c) => ({
      root: c.root,
      bass: c.bass,
      rootName: pitchClassName(c.root),
      bassName: pitchClassName(c.bass),
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
    melody: wasm.melody,
    form: wasm.form
  };
}

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
    request.genreHint ?? ""
  );
  return {
    root: result.root,
    mode: result.mode,
    confidence: result.confidence,
    name: result.name,
    shortName: result.shortName
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
    chordChromaMethodValue(request.chromaMethod ?? "stft")
  );
  return convertChordAnalysisResult(result);
}
function analyzeWithProgress(samples, sampleRate = 22050, onProgress) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, onProgress } : samples;
  validateAnalysisInput(
    "analyzeWithProgress",
    request.samples,
    request.sampleRate ?? 22050,
    request
  );
  const result = requireModule2().analyzeWithProgress(
    request.samples,
    request.sampleRate ?? 22050,
    request.onProgress ?? (() => {
    }),
    request.cancel ?? (() => false)
  );
  return convertAnalysisResult(result);
}

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
      const createModule = options?.moduleFactory ?? (await import("./sonare.js")).default;
      module = await createModule(options);
      setSonareModule(module);
    } catch (error) {
      initPromise = null;
      throw error;
    }
  })();
  return initPromise;
}

// src/worker.ts
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
  const run = async (message) => {
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
            onProgress
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
            onProgress
          });
          break;
        case "masterAudioStereo":
          result = masterAudioStereo({
            ...message.request,
            onProgress
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
    }
  };
  endpoint2.addEventListener("message", (event) => {
    const message = event.data;
    if (message.type === "sonare:offline-cancel") {
      cancelled.add(message.id);
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
