var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};

// src/abi.ts
var EXPECTED_ABI_VERSION;
var init_abi = __esm({
  "src/abi.ts"() {
    "use strict";
    EXPECTED_ABI_VERSION = 84083207;
  }
});

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
function setSonareModule(module3) {
  wrappedModule = wrapModuleErrors(module3);
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
function assertFiniteScalar(fnName, value, argName) {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${fnName}: ${argName} must be a finite number`);
  }
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
function secondsToSampleCount(fnName, seconds, sampleRate, argName) {
  if (typeof seconds !== "number") {
    throw new TypeError(`${fnName}: ${argName} must be a number`);
  }
  assertFiniteScalar(fnName, seconds, argName);
  const samples = Math.round(seconds * sampleRate);
  if (!Number.isSafeInteger(samples)) {
    throw new RangeError(`${fnName}: ${argName} is out of range at ${sampleRate} Hz`);
  }
  return samples;
}
function resolveSampleBound(fnName, sampleValue, secValue, sampleRate, sampleName, secName, sign = "non-negative") {
  const hasSample = sampleValue !== void 0 && sampleValue !== null;
  const hasSec = secValue !== void 0 && secValue !== null;
  if (hasSample && hasSec) {
    throw new RangeError(`${fnName}: give ${sampleName} or ${secName}, not both`);
  }
  if (!hasSample && !hasSec) {
    return void 0;
  }
  const value = hasSec ? secondsToSampleCount(fnName, secValue, sampleRate, secName) : sampleValue;
  const name = hasSec ? secName : sampleName;
  if (typeof value !== "number" || !hasSec && !Number.isFinite(value)) {
    return value;
  }
  if (sign === "non-negative" && value < 0) {
    throw new RangeError(`${fnName}: ${name} must be non-negative`);
  }
  return value === 0 ? 0 : value;
}
function requestObject(fnName, value, argName = "samples", requestOnly = false) {
  if (typeof value !== "object" || value === null || Array.isArray(value) || ArrayBuffer.isView(value)) {
    if (requestOnly) {
      throw new TypeError(`${fnName}: request must be an object`);
    }
    assertAudioSamples(fnName, value, {}, argName);
  }
  return value;
}
var MIN_AUDIO_SAMPLE_RATE, MAX_AUDIO_SAMPLE_RATE;
var init_validation = __esm({
  "src/validation.ts"() {
    "use strict";
    MIN_AUDIO_SAMPLE_RATE = 8e3;
    MAX_AUDIO_SAMPLE_RATE = 384e3;
  }
});

// src/lifetime.ts
var symbolCtor = Symbol;
symbolCtor.dispose ?? (symbolCtor.dispose = /* @__PURE__ */ Symbol.for("Symbol.dispose"));

// src/index.ts
init_module_state();

// src/vocal_edit.ts
init_errors();
init_module_state();
init_validation();
var vocalErrorFields = [
  "reason",
  "field",
  "expected",
  "actual",
  "expectedText",
  "actualText"
];
var cachedModuleSource = null;
var cachedVocalModule = null;
function addVocalErrorDetail(error, detail) {
  if (error === null || typeof error !== "object") {
    return;
  }
  const candidate = error;
  if (candidate.name !== "SonareError" || typeof candidate.code !== "number") {
    return;
  }
  for (const field of vocalErrorFields) {
    Object.defineProperty(candidate, field, {
      configurable: true,
      enumerable: true,
      value: detail[field],
      writable: false
    });
  }
}
function module() {
  const source = getSonareModule();
  if (source === cachedModuleSource && cachedVocalModule !== null) {
    return cachedVocalModule;
  }
  const detailReader = source.vocalEditLastErrorDetail;
  if (typeof detailReader !== "function") {
    cachedModuleSource = source;
    cachedVocalModule = source;
    return source;
  }
  const functionCache = /* @__PURE__ */ new Map();
  const wrapped = new Proxy(source, {
    get(target, property, receiver) {
      const member = Reflect.get(target, property, receiver);
      if (property === "vocalEditLastErrorDetail" || typeof property !== "string" || !property.startsWith("vocalEdit") || typeof member !== "function") {
        return member;
      }
      const cached = functionCache.get(property);
      if (cached !== void 0) {
        return cached;
      }
      const wrappedMember = (...args) => {
        let beforeSequence;
        try {
          beforeSequence = detailReader.call(target).sequence;
        } catch {
        }
        try {
          return Reflect.apply(member, target, args);
        } catch (error) {
          if (beforeSequence !== void 0) {
            try {
              const detail = detailReader.call(target);
              if (detail.sequence !== beforeSequence) {
                addVocalErrorDetail(error, detail);
              }
            } catch {
            }
          }
          throw error;
        }
      };
      functionCache.set(property, wrappedMember);
      return wrappedMember;
    }
  });
  cachedModuleSource = source;
  cachedVocalModule = wrapped;
  return wrapped;
}
function requireHandle(handle, subject) {
  if (!Number.isSafeInteger(handle) || handle <= 0) {
    throw new SonareError(
      7 /* InvalidState */,
      "InvalidState",
      `${subject} has already been disposed`
    );
  }
}
function requireFinite(value, field) {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${field} must be finite`);
  }
  return value;
}
function requireSample(value, field) {
  requireFinite(value, field);
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${field} must be a non-negative safe integer`);
  }
  return value;
}
function requireUint32(value, field) {
  requireSample(value, field);
  if (value > 4294967295) {
    throw new RangeError(`${field} must fit uint32`);
  }
  return value;
}
function requireToken(value, field, fallback = "0") {
  const token = value ?? fallback;
  if (typeof token !== "string" || !/^(0|[1-9]\d*)$/.test(token)) {
    throw new RangeError(`${field} must be a canonical decimal uint64 string`);
  }
  if (token.length > 20 || token.length === 20 && token > "18446744073709551615") {
    throw new RangeError(`${field} must fit uint64`);
  }
  return token;
}
function resolveRevision(argument, fallback) {
  const value = typeof argument === "string" ? argument : argument?.expectedRevision;
  return requireToken(value, "expectedRevision", fallback);
}
function resolveRange(range, sampleRate, outputLengthSamples) {
  if (!range || typeof range !== "object") {
    throw new TypeError("range must be an object");
  }
  const fn = "VocalRenderSnapshot.render";
  const start = resolveSampleBound(
    fn,
    range.startSample,
    range.startSec,
    sampleRate,
    "range.startSample",
    "range.startSec"
  ) ?? 0;
  const end = resolveSampleBound(
    fn,
    range.endSample,
    range.endSec,
    sampleRate,
    "range.endSample",
    "range.endSec"
  ) ?? outputLengthSamples;
  const startSample = requireSample(start, "range.startSample");
  const endSample = requireSample(end, "range.endSample");
  if (endSample < startSample) {
    throw new RangeError("range.endSample must be >= startSample");
  }
  return { startSample, endSample };
}
function resolveOperationTimes(operations, sampleRate) {
  const fn = "VocalEditDraft.apply";
  return operations.map((operation, index) => {
    const at = `operations[${index}]`;
    if (operation?.kind === "setSourceSpan") {
      const { sourceStartSec, sourceEndSec, destinationStartSec, destinationLengthSec, ...rest } = operation;
      const bound = (sample, sec, sampleName, secName) => resolveSampleBound(fn, sample, sec, sampleRate, `${at}.${sampleName}`, `${at}.${secName}`);
      return {
        ...rest,
        sourceStartSample: bound(
          rest.sourceStartSample,
          sourceStartSec,
          "sourceStartSample",
          "sourceStartSec"
        ),
        sourceEndSample: bound(
          rest.sourceEndSample,
          sourceEndSec,
          "sourceEndSample",
          "sourceEndSec"
        ),
        destinationStartSample: bound(
          rest.destinationStartSample,
          destinationStartSec,
          "destinationStartSample",
          "destinationStartSec"
        ),
        destinationLengthSamples: bound(
          rest.destinationLengthSamples,
          destinationLengthSec,
          "destinationLengthSamples",
          "destinationLengthSec"
        )
      };
    }
    if (operation?.kind === "split") {
      const { sourceSec, ...rest } = operation;
      return {
        ...rest,
        sourceSample: resolveSampleBound(
          fn,
          rest.sourceSample,
          sourceSec,
          sampleRate,
          `${at}.sourceSample`,
          `${at}.sourceSec`
        )
      };
    }
    return operation;
  });
}
function copyToken(token) {
  return {
    sessionEpoch: requireToken(token.sessionEpoch, "sessionEpoch"),
    revision: requireToken(token.revision, "revision"),
    draftId: requireToken(token.draftId, "draftId"),
    generation: requireToken(token.generation, "generation"),
    requestId: requireToken(token.requestId, "requestId"),
    profileId: token.profileId
  };
}
function copyRange(range) {
  return { startSample: range.startSample, endSample: range.endSample };
}
function copyNotes(value) {
  const notes = Array.from(value.notes, (note) => ({
    ...note,
    amplitude: new Float32Array(note.amplitude),
    edit: {
      ...note.edit,
      pitch: {
        ...note.edit.pitch,
        target: note.edit.pitch.target.mode === "curve" ? {
          mode: "curve",
          points: note.edit.pitch.target.points.map((point) => ({ ...point }))
        } : { ...note.edit.pitch.target }
      },
      amplitudeEnvelope: Array.from(note.edit.amplitudeEnvelope),
      formant: { ...note.edit.formant }
    }
  }));
  return {
    notes,
    transitions: Array.from(value.transitions, (transition) => ({ ...transition }))
  };
}
function copyAnalysis(value) {
  return {
    frameOriginSample: value.frameOriginSample,
    samplesPerFrame: value.samplesPerFrame,
    frameLengthSamples: value.frameLengthSamples,
    f0Hz: new Float32Array(value.f0Hz),
    voiced: new Uint8Array(value.voiced),
    algorithmId: value.algorithmId,
    algorithmVersion: value.algorithmVersion,
    sourceLengthSamples: value.sourceLengthSamples,
    sampleRate: value.sampleRate,
    sourceSha256: value.sourceSha256,
    analysisSha256: value.analysisSha256,
    fminHz: value.fminHz,
    fmaxHz: value.fmaxHz,
    yinThreshold: value.yinThreshold,
    voicedThreshold: value.voicedThreshold,
    centered: value.centered,
    segmentationThresholdCents: value.segmentationThresholdCents,
    minNoteMs: value.minNoteMs,
    referenceHz: value.referenceHz
  };
}
function copyPitch(value) {
  return {
    sourceSamples: new Float64Array(value.sourceSamples),
    measuredMidi: new Float64Array(value.measuredMidi),
    targetMidi: new Float64Array(value.targetMidi),
    effectiveMidi: new Float64Array(value.effectiveMidi),
    voiced: new Uint8Array(value.voiced),
    hasTarget: new Uint8Array(value.hasTarget)
  };
}
function copyRender(value) {
  return {
    samples: new Float32Array(value.samples),
    startSample: value.startSample,
    token: copyToken(value.token),
    processedRanges: Array.from(value.processedRanges, copyRange),
    cacheHitUnits: requireToken(value.cacheHitUnits, "cacheHitUnits"),
    dryPassedFrames: requireToken(value.dryPassedFrames, "dryPassedFrames"),
    limitedCorrectionFrames: requireToken(value.limitedCorrectionFrames, "limitedCorrectionFrames")
  };
}
function validateSessionLimits(limits) {
  if (limits === void 0) {
    return;
  }
  if (limits.maxHistoryBytes !== void 0) {
    requireToken(limits.maxHistoryBytes, "limits.maxHistoryBytes");
  }
  if (limits.maxCacheBytes !== void 0) {
    requireToken(limits.maxCacheBytes, "limits.maxCacheBytes");
  }
}
function copyEditResult(value) {
  return {
    token: copyToken(value.token),
    dirtyRanges: Array.from(value.dirtyRanges, copyRange),
    idChanges: Array.from(value.idChanges, (change) => ({
      operationIndex: change.operationIndex,
      retiredId: change.retiredId,
      newIds: Array.from(change.newIds)
    }))
  };
}
function validateCreate(request) {
  if (!request || typeof request !== "object") {
    throw new TypeError("request must be an object");
  }
  assertAudioInput("createVocalEditSession", request.samples, request.sampleRate);
  if (request.outputLengthSamples !== void 0) {
    requireSample(request.outputLengthSamples, "outputLengthSamples");
  }
  validateSessionLimits(request.limits);
  if (request.analysis) {
    const analysis = request.analysis;
    if (analysis.algorithmId !== void 0) {
      if (typeof analysis.algorithmId !== "string") {
        throw new TypeError("analysis.algorithmId must be a string");
      }
      if (analysis.algorithmId.includes("\0")) {
        throw new RangeError("analysis.algorithmId must not contain NUL");
      }
    }
    requireFinite(analysis.frameOriginSample, "analysis.frameOriginSample");
    requireFinite(analysis.samplesPerFrame, "analysis.samplesPerFrame");
    if (analysis.samplesPerFrame <= 0) {
      throw new RangeError("analysis.samplesPerFrame must be positive");
    }
    requireSample(analysis.frameLengthSamples, "analysis.frameLengthSamples");
    if (analysis.frameLengthSamples === 0) {
      throw new RangeError("analysis.frameLengthSamples must be positive");
    }
    if (!(analysis.f0Hz instanceof Float32Array) || !(analysis.voiced instanceof Uint8Array)) {
      throw new TypeError("analysis arrays must be Float32Array and Uint8Array");
    }
    if (analysis.f0Hz.length !== analysis.voiced.length) {
      throw new RangeError("analysis arrays must have equal lengths");
    }
  }
}
function normalizeRequest(request, outputLengthSamples, sampleRate) {
  const range = request.range === void 0 ? { startSample: 0, endSample: requireSample(outputLengthSamples, "outputLengthSamples") } : resolveRange(
    request.range,
    sampleRate,
    requireSample(outputLengthSamples, "outputLengthSamples")
  );
  const requestId = requireToken(request.requestId, "requestId");
  return { range, requestId };
}
function vocalEditAvailable() {
  const raw = module();
  return typeof raw.vocalEditAvailable === "function" && raw.vocalEditAvailable() !== 0;
}
function createVocalEditSession(request) {
  validateCreate(request);
  if (!vocalEditAvailable()) {
    throw new SonareError(
      6 /* NotSupported */,
      "NotSupported",
      "vocal edit is unavailable in this WASM build"
    );
  }
  return new VocalEditSession(
    module().vocalEditSessionCreate(request.samples, request.sampleRate, request),
    request.sampleRate
  );
}
function restoreVocalEditSession(request) {
  requestObject("restoreVocalEditSession", request, "request", true);
  assertAudioInput("restoreVocalEditSession", request.samples, request.sampleRate);
  if (!(request.state instanceof Uint8Array)) {
    throw new TypeError("state must be a Uint8Array");
  }
  validateSessionLimits(request.limits);
  if (!vocalEditAvailable()) {
    throw new SonareError(
      6 /* NotSupported */,
      "NotSupported",
      "vocal edit is unavailable in this WASM build"
    );
  }
  return new VocalEditSession(
    module().vocalEditSessionRestore(request.samples, request.sampleRate, request.state, request),
    request.sampleRate
  );
}
var VocalEditSession = class {
  /** @internal Instances are created by {@link createVocalEditSession} and {@link restoreVocalEditSession}. */
  constructor(handle, sampleRate) {
    this.drafts = /* @__PURE__ */ new Set();
    this.disposed = false;
    requireHandle(handle, "session");
    this.handle = handle;
    this.sampleRate = sampleRate;
  }
  dispose() {
    if (this.disposed) {
      return;
    }
    for (const draft of this.drafts) {
      draft.dispose();
    }
    this.drafts.clear();
    module().vocalEditSessionDestroy(this.handle);
    this.handle = 0;
    this.disposed = true;
  }
  delete() {
    this.dispose();
  }
  destroy() {
    this.dispose();
  }
  /** Releases the handle through {@link dispose}, so the instance works with `using`. */
  [Symbol.dispose]() {
    this.dispose();
  }
  native() {
    if (this.disposed) {
      throw new SonareError(
        7 /* InvalidState */,
        "InvalidState",
        "session has already been disposed"
      );
    }
    requireHandle(this.handle, "session");
    return this.handle;
  }
  token() {
    return copyToken(module().vocalEditSessionToken(this.native()));
  }
  revision() {
    return this.token().revision;
  }
  notes() {
    return copyNotes(module().vocalEditSessionNotes(this.native()));
  }
  analysis() {
    return copyAnalysis(module().vocalEditSessionAnalysis(this.native()));
  }
  capabilities() {
    return { ...module().vocalEditSessionCapabilities(this.native()) };
  }
  outputLengthSamples() {
    return requireSample(
      module().vocalEditSessionOutputLength(this.native()),
      "outputLengthSamples"
    );
  }
  history() {
    const value = module().vocalEditSessionHistory(this.native());
    return { canUndo: value.canUndo === true, canRedo: value.canRedo === true };
  }
  beginEdit(options = {}) {
    const draft = new VocalEditDraft(
      module().vocalEditSessionBeginEdit(this.native(), resolveRevision(options, this.revision())),
      this,
      this.sampleRate
    );
    this.drafts.add(draft);
    return draft;
  }
  undo(options = {}) {
    return copyEditResult(
      module().vocalEditSessionApplyHistory(
        this.native(),
        resolveRevision(options, this.revision()),
        false
      )
    );
  }
  redo(options = {}) {
    return copyEditResult(
      module().vocalEditSessionApplyHistory(
        this.native(),
        resolveRevision(options, this.revision()),
        true
      )
    );
  }
  evaluatePitch(noteId) {
    return copyPitch(
      module().vocalEditEvaluatePitch(this.native(), requireUint32(noteId, "noteId"), false)
    );
  }
  sourceSampleToDestinationSample(noteId, sourceSample) {
    requireFinite(sourceSample, "sourceSample");
    return module().vocalEditMapCoordinate(
      this.native(),
      requireUint32(noteId, "noteId"),
      sourceSample,
      false,
      false
    );
  }
  destinationSampleToSourceSample(noteId, destinationSample) {
    requireFinite(destinationSample, "destinationSample");
    return module().vocalEditMapCoordinate(
      this.native(),
      requireUint32(noteId, "noteId"),
      destinationSample,
      false,
      true
    );
  }
  captureRenderSnapshot() {
    return new VocalRenderSnapshot(
      module().vocalEditCaptureSnapshot(this.native(), false),
      this.sampleRate
    );
  }
  exportState() {
    return new Uint8Array(module().vocalEditSessionExportState(this.native()));
  }
  /** @internal Used by the draft to remove itself from the owner set. */
  _forgetDraft(draft) {
    this.drafts.delete(draft);
  }
};
var VocalEditDraft = class {
  /** @internal Instances are created by {@link VocalEditSession.beginEdit}. */
  constructor(handle, owner, sampleRate) {
    this.disposed = false;
    requireHandle(handle, "draft");
    this.handle = handle;
    this.owner = owner;
    this.sampleRate = sampleRate;
  }
  native() {
    if (this.disposed) {
      throw new SonareError(
        7 /* InvalidState */,
        "InvalidState",
        "draft has already been disposed"
      );
    }
    requireHandle(this.handle, "draft");
    return this.handle;
  }
  token() {
    return copyToken(module().vocalEditDraftToken(this.native()));
  }
  notes() {
    return copyNotes(module().vocalEditDraftNotes(this.native()));
  }
  apply(request) {
    if (request.expectedGeneration === void 0) {
      throw new TypeError("expectedGeneration is required");
    }
    const generation = requireToken(request.expectedGeneration, "expectedGeneration");
    if (!Array.isArray(request.operations)) {
      throw new TypeError("operations must be an array");
    }
    return copyEditResult(
      module().vocalEditDraftApply(
        this.native(),
        generation,
        resolveOperationTimes(request.operations, this.sampleRate)
      )
    );
  }
  commit(options = {}) {
    const result = copyEditResult(
      module().vocalEditDraftCommit(this.native(), resolveRevision(options, this.owner.revision()))
    );
    this.dispose();
    return result;
  }
  cancel() {
    if (this.disposed) {
      return;
    }
    module().vocalEditDraftCancel(this.native());
    this.dispose();
  }
  evaluatePitch(noteId) {
    return copyPitch(
      module().vocalEditEvaluatePitch(this.native(), requireUint32(noteId, "noteId"), true)
    );
  }
  sourceSampleToDestinationSample(noteId, sourceSample) {
    requireFinite(sourceSample, "sourceSample");
    return module().vocalEditMapCoordinate(
      this.native(),
      requireUint32(noteId, "noteId"),
      sourceSample,
      true,
      false
    );
  }
  destinationSampleToSourceSample(noteId, destinationSample) {
    requireFinite(destinationSample, "destinationSample");
    return module().vocalEditMapCoordinate(
      this.native(),
      requireUint32(noteId, "noteId"),
      destinationSample,
      true,
      true
    );
  }
  captureRenderSnapshot() {
    return new VocalRenderSnapshot(
      module().vocalEditCaptureSnapshot(this.native(), true),
      this.sampleRate
    );
  }
  dispose() {
    if (this.disposed) {
      return;
    }
    module().vocalEditDraftDestroy(this.handle);
    this.handle = 0;
    this.disposed = true;
    this.owner._forgetDraft(this);
  }
  delete() {
    this.dispose();
  }
  destroy() {
    this.dispose();
  }
  /** Releases the handle through {@link dispose}, so the instance works with `using`. */
  [Symbol.dispose]() {
    this.dispose();
  }
};
var VocalRenderSnapshot = class {
  /** @internal Instances are created by a session or draft. */
  constructor(handle, sampleRate) {
    this.disposed = false;
    requireHandle(handle, "snapshot");
    this.handle = handle;
    this.sampleRate = sampleRate;
  }
  native() {
    if (this.disposed) {
      throw new SonareError(
        7 /* InvalidState */,
        "InvalidState",
        "snapshot has already been disposed"
      );
    }
    requireHandle(this.handle, "snapshot");
    return this.handle;
  }
  outputLengthSamples() {
    return requireSample(
      module().vocalEditSnapshotOutputLength(this.native()),
      "outputLengthSamples"
    );
  }
  render(request) {
    const handle = this.native();
    if (request.signal?.aborted) {
      throw new DOMException("The render was aborted", "AbortError");
    }
    const normalized = normalizeRequest(request, this.outputLengthSamples(), this.sampleRate);
    return copyRender(
      module().vocalEditSnapshotRender(
        handle,
        normalized.range.startSample,
        normalized.range.endSample,
        normalized.requestId
      )
    );
  }
  beginRenderJob(request) {
    const handle = this.native();
    if (request.signal?.aborted) {
      throw new DOMException("The render was aborted", "AbortError");
    }
    const normalized = normalizeRequest(request, this.outputLengthSamples(), this.sampleRate);
    return new VocalRenderJob(
      module().vocalEditRenderJobBegin(
        handle,
        normalized.range.startSample,
        normalized.range.endSample,
        normalized.requestId
      )
    );
  }
  /**
   * Render one native work unit per macrotask so `request.signal` can stop the
   * job between units. A cancelled job publishes no partial PCM.
   */
  renderAsync(request) {
    this.native();
    const signal = request.signal;
    if (signal?.aborted) {
      return Promise.reject(new DOMException("The render was aborted", "AbortError"));
    }
    const job = this.beginRenderJob(request);
    return (async () => {
      try {
        while (true) {
          if (signal?.aborted) {
            job.abort();
            throw new DOMException("The render was aborted", "AbortError");
          }
          if (job.next().complete) {
            return job.finalize();
          }
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      } catch (error) {
        job.abort();
        throw error;
      } finally {
        job.dispose();
      }
    })();
  }
  dispose() {
    if (this.disposed) {
      return;
    }
    module().vocalEditSnapshotDestroy(this.handle);
    this.handle = 0;
    this.disposed = true;
  }
  delete() {
    this.dispose();
  }
  destroy() {
    this.dispose();
  }
  /** Releases the handle through {@link dispose}, so the instance works with `using`. */
  [Symbol.dispose]() {
    this.dispose();
  }
};
var VocalRenderJob = class {
  /** @internal Instances are created by {@link VocalRenderSnapshot.beginRenderJob}. */
  constructor(handle) {
    this.disposed = false;
    requireHandle(handle, "render job");
    this.handle = handle;
  }
  native() {
    if (this.disposed) {
      throw new SonareError(
        7 /* InvalidState */,
        "InvalidState",
        "render job has already been disposed"
      );
    }
    requireHandle(this.handle, "render job");
    return this.handle;
  }
  next() {
    return { complete: module().vocalEditRenderJobNext(this.native()) };
  }
  finalize() {
    const result = copyRender(module().vocalEditRenderJobFinalize(this.native()));
    this.dispose();
    return result;
  }
  abort() {
    if (!this.disposed) {
      module().vocalEditRenderJobAbort(this.handle);
    }
  }
  dispose() {
    if (this.disposed) {
      return;
    }
    module().vocalEditRenderJobDestroy(this.handle);
    this.handle = 0;
    this.disposed = true;
  }
  delete() {
    this.dispose();
  }
  destroy() {
    this.dispose();
  }
  /** Releases the handle through {@link dispose}, so the instance works with `using`. */
  [Symbol.dispose]() {
    this.dispose();
  }
};

// src/vocal_edit_worker_protocol.ts
function compareUint64(a, b) {
  const left = a.replace(/^0+(?=\d)/, "");
  const right = b.replace(/^0+(?=\d)/, "");
  if (left.length !== right.length) {
    return left.length < right.length ? -1 : 1;
  }
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

// src/index.ts
var module2 = null;
var initPromise = null;
var firstInitOptions;
async function init(options) {
  if (module2) {
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
      module2 = created;
      setSonareModule(module2);
    } catch (error) {
      initPromise = null;
      firstInitOptions = void 0;
      throw error;
    }
  })();
  return initPromise;
}

// src/vocal_edit_worker.ts
var productionFactory = {
  create: createVocalEditSession,
  restore: restoreVocalEditSession
};
function errorPayload(error) {
  const candidate = error;
  return {
    name: candidate.name ?? "Error",
    message: candidate.message ?? String(error),
    ...candidate.code === void 0 ? {} : { code: candidate.code },
    ...candidate.codeName === void 0 ? {} : { codeName: candidate.codeName },
    ...candidate.reason === void 0 ? {} : { reason: candidate.reason },
    ...candidate.field === void 0 ? {} : { field: candidate.field },
    ...candidate.expected === void 0 ? {} : { expected: candidate.expected },
    ...candidate.actual === void 0 ? {} : { actual: candidate.actual },
    ...candidate.expectedText === void 0 ? {} : { expectedText: candidate.expectedText },
    ...candidate.actualText === void 0 ? {} : { actualText: candidate.actualText }
  };
}
function transferables(value) {
  const result = [];
  const seen = /* @__PURE__ */ new Set();
  const visit = (item) => {
    if (item === null || item === void 0 || typeof item !== "object") {
      return;
    }
    if (ArrayBuffer.isView(item)) {
      const buffer = item.buffer;
      if (buffer instanceof ArrayBuffer && !seen.has(buffer)) {
        seen.add(buffer);
        result.push(buffer);
      }
      return;
    }
    if (item instanceof ArrayBuffer) {
      if (!seen.has(item)) {
        seen.add(item);
        result.push(item);
      }
      return;
    }
    if (Array.isArray(item)) {
      item.forEach(visit);
      return;
    }
    Object.values(item).forEach(visit);
  };
  visit(value);
  return result;
}
function cancelledError() {
  const error = new Error("Vocal render cancelled");
  error.name = "AbortError";
  return error;
}
function isCancelled(active) {
  return active.cancelled || active.cancelBuffer !== void 0 && Atomics.load(new Int32Array(active.cancelBuffer), 0) !== 0;
}
function nextMacrotask() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
function resultToken(value, session) {
  const candidate = value;
  return candidate?.token ?? currentToken(session);
}
function currentToken(session) {
  return session.draft?.token() ?? session.value.token();
}
function postResult(endpoint2, id, sessionId, clientIntentSequence, result, token) {
  endpoint2.postMessage(
    {
      type: "sonare:vocal-result",
      id,
      sessionId,
      clientIntentSequence,
      result,
      ...token ? { token } : {}
    },
    transferables(result)
  );
}
function postError(endpoint2, id, sessionId, clientIntentSequence, error, token) {
  endpoint2.postMessage({
    type: "sonare:vocal-error",
    id,
    sessionId,
    clientIntentSequence,
    error: errorPayload(error),
    ...token ? { token } : {}
  });
}
function rejectQueuedCommands(endpoint2, session, error) {
  for (const queued of session.queue) {
    postError(
      endpoint2,
      queued.message.id,
      queued.message.sessionId,
      queued.message.clientIntentSequence,
      error,
      currentToken(session)
    );
  }
  session.queue = [];
}
function ensureSameEpoch(message, session) {
  if (message.baseToken && message.baseToken.sessionEpoch !== currentToken(session).sessionEpoch) {
    const error = new Error("The vocal edit request targets another session epoch");
    error.name = "StaleResultError";
    throw error;
  }
}
function draftRequired(session) {
  if (!session.draft) {
    throw new Error("No vocal edit draft is open");
  }
  return session.draft;
}
function readTarget(session, draft) {
  return draft === true ? draftRequired(session) : session.value;
}
async function runPreview(message, session, active, endpoint2) {
  const snapshot = session.draft ? session.draft.captureRenderSnapshot() : session.value.captureRenderSnapshot();
  let job;
  try {
    job = snapshot.beginRenderJob({ ...message.request, signal: void 0 });
    while (true) {
      if (isCancelled(active)) {
        job.abort();
        throw cancelledError();
      }
      const progress = job.next();
      endpoint2.postMessage({
        type: "sonare:vocal-progress",
        id: message.id,
        sessionId: message.sessionId,
        clientIntentSequence: message.clientIntentSequence,
        complete: progress.complete,
        token: currentToken(session)
      });
      if (progress.complete) {
        return job.finalize();
      }
      await nextMacrotask();
    }
  } finally {
    job?.dispose();
    snapshot.dispose();
  }
}
async function execute(command, session, endpoint2) {
  const message = command.message;
  const active = command.active;
  session.running = active;
  try {
    ensureSameEpoch(message, session);
    let result;
    if (message.type === "sonare:vocal-preview") {
      result = await runPreview(message, session, active, endpoint2);
    } else {
      const mutation = message.mutation;
      switch (mutation.kind) {
        case "beginEdit":
          if (session.draft) {
            throw new Error("A vocal edit draft is already open");
          }
          session.draft = session.value.beginEdit(mutation.expectedRevision);
          result = session.draft.token();
          break;
        case "apply":
          result = draftRequired(session).apply(mutation.request);
          break;
        case "commit":
          result = draftRequired(session).commit(mutation.expectedRevision);
          session.draft?.dispose();
          session.draft = void 0;
          break;
        case "cancel":
          draftRequired(session).cancel();
          session.draft?.dispose();
          session.draft = void 0;
          result = null;
          break;
        case "undo":
          if (session.draft) {
            throw new Error("Cancel or commit the vocal draft before undo");
          }
          result = session.value.undo(mutation.expectedRevision);
          break;
        case "redo":
          if (session.draft) {
            throw new Error("Cancel or commit the vocal draft before redo");
          }
          result = session.value.redo(mutation.expectedRevision);
          break;
        case "notes":
          result = session.draft ? session.draft.notes() : session.value.notes();
          break;
        case "analysis":
          result = session.value.analysis();
          break;
        case "capabilities":
          result = session.value.capabilities();
          break;
        case "exportState":
          if (session.draft) {
            throw new Error("Commit or cancel the vocal draft before export");
          }
          result = { data: session.value.exportState() };
          break;
        case "outputLength":
          result = session.value.outputLengthSamples();
          break;
        case "history":
          result = session.value.history();
          break;
        case "draftToken":
          result = draftRequired(session).token();
          break;
        case "evaluatePitch":
          result = readTarget(session, mutation.draft).evaluatePitch(mutation.noteId);
          break;
        case "mapCoordinate": {
          const target = readTarget(session, mutation.draft);
          result = mutation.inverse ? target.destinationSampleToSourceSample(mutation.noteId, mutation.sample) : target.sourceSampleToDestinationSample(mutation.noteId, mutation.sample);
          break;
        }
      }
    }
    if (message.type === "sonare:vocal-preview" && isCancelled(active)) {
      throw cancelledError();
    }
    postResult(
      endpoint2,
      message.id,
      message.sessionId,
      message.clientIntentSequence,
      result,
      resultToken(result, session)
    );
  } catch (error) {
    postError(
      endpoint2,
      message.id,
      message.sessionId,
      message.clientIntentSequence,
      error,
      currentToken(session)
    );
  } finally {
    session.running = void 0;
  }
}
async function drain(session, endpoint2) {
  if (session.draining) {
    return;
  }
  session.draining = true;
  try {
    while (session.queue.length !== 0 && !session.disposing) {
      const command = session.queue.shift();
      await execute(command, session, endpoint2);
    }
  } finally {
    session.draining = false;
  }
}
function queueCommand(endpoint2, sessions, message) {
  const session = sessions.get(message.sessionId);
  if (!session || session.disposing) {
    postError(
      endpoint2,
      message.id,
      message.sessionId,
      message.clientIntentSequence,
      new Error("Unknown vocal session")
    );
    return;
  }
  if (compareUint64(message.clientIntentSequence, session.latestIntent) <= 0) {
    const error = new Error("A stale vocal client intent was rejected");
    error.name = "StaleResultError";
    postError(
      endpoint2,
      message.id,
      message.sessionId,
      message.clientIntentSequence,
      error,
      currentToken(session)
    );
    return;
  }
  session.latestIntent = message.clientIntentSequence;
  if (message.type === "sonare:vocal-preview") {
    const stale = session.queue.filter(
      (command) => command.message.type === "sonare:vocal-preview"
    );
    session.queue = session.queue.filter(
      (command) => command.message.type !== "sonare:vocal-preview"
    );
    for (const command of stale) {
      postError(
        endpoint2,
        command.message.id,
        command.message.sessionId,
        command.message.clientIntentSequence,
        Object.assign(new Error("Preview superseded"), { name: "StaleResultError" }),
        currentToken(session)
      );
    }
  }
  session.queue.push({
    message,
    active: {
      id: message.id,
      cancelled: false,
      preview: message.type === "sonare:vocal-preview",
      cancelBuffer: message.cancelBuffer
    }
  });
  void drain(session, endpoint2);
}
var UINT64_MAX = "18446744073709551615";
var mutationKinds = /* @__PURE__ */ new Set([
  "beginEdit",
  "apply",
  "commit",
  "cancel",
  "undo",
  "redo",
  "notes",
  "analysis",
  "capabilities",
  "exportState",
  "outputLength",
  "history",
  "draftToken",
  "evaluatePitch",
  "mapCoordinate"
]);
function malformed(message) {
  return new TypeError(`malformed vocal Worker message: ${message}`);
}
function isRecord(value) {
  return value !== null && typeof value === "object";
}
function isDecimalUint64(value) {
  return typeof value === "string" && /^(0|[1-9]\d*)$/.test(value) && compareUint64(value, UINT64_MAX) <= 0;
}
function optionalDecimal(value, field) {
  if (value !== void 0 && !isDecimalUint64(value)) {
    throw malformed(`${field} must be a decimal uint64 string`);
  }
}
function replyId(data) {
  if (!isRecord(data) || data.type === "sonare:vocal-cancel") {
    return void 0;
  }
  return Number.isSafeInteger(data.id) && data.id > 0 ? data.id : void 0;
}
function validateRequest(data) {
  if (!isRecord(data)) {
    throw malformed("message must be an object");
  }
  if (!Number.isSafeInteger(data.id) || data.id <= 0) {
    throw malformed("id must be a positive safe integer");
  }
  if (typeof data.sessionId !== "string" || data.sessionId.length === 0) {
    throw malformed("sessionId must be a non-empty string");
  }
  if (!isDecimalUint64(data.clientIntentSequence)) {
    throw malformed("clientIntentSequence must be a decimal uint64 string");
  }
  if (data.cancelBuffer !== void 0 && !(typeof SharedArrayBuffer !== "undefined" && data.cancelBuffer instanceof SharedArrayBuffer && data.cancelBuffer.byteLength >= Int32Array.BYTES_PER_ELEMENT)) {
    throw malformed("cancelBuffer must be a SharedArrayBuffer");
  }
  if (data.baseToken !== void 0 && !(isRecord(data.baseToken) && isDecimalUint64(data.baseToken.sessionEpoch))) {
    throw malformed("baseToken must be a state token");
  }
  switch (data.type) {
    case "sonare:vocal-create": {
      const request = data.request;
      if (!isRecord(request) || request.kind !== "create" && request.kind !== "restore" || !isRecord(request.request)) {
        throw malformed("create request must name create or restore with a request object");
      }
      break;
    }
    case "sonare:vocal-mutate": {
      const mutation = data.mutation;
      if (!isRecord(mutation) || typeof mutation.kind !== "string" || !mutationKinds.has(mutation.kind)) {
        throw malformed("mutation.kind is not a vocal Worker mutation");
      }
      if (mutation.kind === "apply" && !isRecord(mutation.request)) {
        throw malformed("apply mutation must carry a request object");
      }
      if (mutation.kind === "commit" && !isDecimalUint64(mutation.expectedRevision)) {
        throw malformed("commit expectedRevision must be a decimal uint64 string");
      }
      optionalDecimal(mutation.expectedRevision, "expectedRevision");
      break;
    }
    case "sonare:vocal-preview":
      if (!isRecord(data.request)) {
        throw malformed("preview request must be an object");
      }
      break;
    case "sonare:vocal-dispose":
    case "sonare:vocal-cancel":
      break;
    default:
      throw malformed("unknown message type");
  }
  return data;
}
function installVocalEditWorkerEndpoint(endpoint2, dependencies = {}) {
  const sessions = /* @__PURE__ */ new Map();
  const creating = /* @__PURE__ */ new Map();
  const factory = dependencies.factory ?? productionFactory;
  const initialize = dependencies.initialize ?? init;
  const cancel = (message) => {
    const pendingCreate = creating.get(message.id);
    if (pendingCreate) {
      pendingCreate.cancelled = true;
      return;
    }
    const session = sessions.get(message.sessionId);
    if (!session) {
      return;
    }
    const running = session.running;
    if (running?.id === message.id && running.preview) {
      running.cancelled = true;
      return;
    }
    const queuedIndex = session.queue.findIndex(
      (command) => command.message.id === message.id && command.message.type === "sonare:vocal-preview"
    );
    if (queuedIndex >= 0) {
      const [queued] = session.queue.splice(queuedIndex, 1);
      postError(
        endpoint2,
        queued.message.id,
        queued.message.sessionId,
        queued.message.clientIntentSequence,
        cancelledError(),
        currentToken(session)
      );
    }
  };
  const create = async (message) => {
    const active = {
      id: message.id,
      cancelled: false,
      preview: false,
      cancelBuffer: message.cancelBuffer
    };
    creating.set(message.id, active);
    let value;
    try {
      await initialize();
      if (isCancelled(active)) {
        throw cancelledError();
      }
      if (sessions.has(message.sessionId)) {
        throw new Error("Vocal session id is already in use");
      }
      value = message.request.kind === "create" ? factory.create(message.request.request) : factory.restore(message.request.request);
      if (isCancelled(active)) {
        throw cancelledError();
      }
      const result = {
        sessionId: message.sessionId,
        token: value.token(),
        notes: value.notes(),
        analysis: value.analysis(),
        capabilities: value.capabilities()
      };
      sessions.set(message.sessionId, {
        value,
        latestIntent: message.clientIntentSequence,
        queue: [],
        running: void 0,
        draining: false,
        disposing: false
      });
      value = void 0;
      postResult(
        endpoint2,
        message.id,
        message.sessionId,
        message.clientIntentSequence,
        result,
        result.token
      );
    } catch (error) {
      value?.dispose();
      postError(endpoint2, message.id, message.sessionId, message.clientIntentSequence, error);
    } finally {
      creating.delete(message.id);
    }
  };
  const dispose = (message) => {
    const session = sessions.get(message.sessionId);
    if (!session) {
      postResult(endpoint2, message.id, message.sessionId, message.clientIntentSequence, null);
      return;
    }
    if (session.disposing) {
      void session.released?.then(
        () => postResult(endpoint2, message.id, message.sessionId, message.clientIntentSequence, null)
      );
      return;
    }
    session.disposing = true;
    const active = session.running;
    if (active) {
      active.cancelled = true;
    }
    rejectQueuedCommands(endpoint2, session, new Error("Vocal session disposed"));
    session.released = (async () => {
      while (session.draining) {
        await nextMacrotask();
      }
      session.draft?.dispose();
      session.value.dispose();
      sessions.delete(message.sessionId);
    })();
    void session.released.then(
      () => postResult(endpoint2, message.id, message.sessionId, message.clientIntentSequence, null)
    );
  };
  endpoint2.addEventListener("message", (event) => {
    const data = event.data;
    try {
      const message = validateRequest(data);
      switch (message.type) {
        case "sonare:vocal-cancel":
          cancel(message);
          return;
        case "sonare:vocal-create":
          void create(message);
          return;
        case "sonare:vocal-dispose":
          dispose(message);
          return;
        default:
          queueCommand(endpoint2, sessions, message);
      }
    } catch (error) {
      const id = replyId(data);
      if (id === void 0) {
        return;
      }
      const record = data;
      try {
        postError(
          endpoint2,
          id,
          typeof record.sessionId === "string" ? record.sessionId : "",
          isDecimalUint64(record.clientIntentSequence) ? record.clientIntentSequence : "0",
          error
        );
      } catch {
      }
    }
  });
}
function browserEndpoint() {
  const scope = globalThis;
  if (scope.document !== void 0 || !scope.postMessage || !scope.addEventListener) {
    return null;
  }
  return {
    postMessage: (message, transfer) => scope.postMessage?.(message, transfer),
    addEventListener: (type, listener) => scope.addEventListener?.(type, listener)
  };
}
var endpoint = browserEndpoint();
if (endpoint) {
  installVocalEditWorkerEndpoint(endpoint);
}
export {
  installVocalEditWorkerEndpoint
};
