// src/errors.ts
var ErrorCode = /* @__PURE__ */ ((ErrorCode2) => {
  ErrorCode2[ErrorCode2["Ok"] = 0] = "Ok";
  ErrorCode2[ErrorCode2["FileNotFound"] = 1] = "FileNotFound";
  ErrorCode2[ErrorCode2["InvalidFormat"] = 2] = "InvalidFormat";
  ErrorCode2[ErrorCode2["DecodeFailed"] = 3] = "DecodeFailed";
  ErrorCode2[ErrorCode2["InvalidParameter"] = 4] = "InvalidParameter";
  ErrorCode2[ErrorCode2["OutOfMemory"] = 5] = "OutOfMemory";
  ErrorCode2[ErrorCode2["NotSupported"] = 6] = "NotSupported";
  ErrorCode2[ErrorCode2["InvalidState"] = 7] = "InvalidState";
  ErrorCode2[ErrorCode2["Cancelled"] = 8] = "Cancelled";
  ErrorCode2[ErrorCode2["EncodeFailed"] = 9] = "EncodeFailed";
  ErrorCode2[ErrorCode2["Unknown"] = 99] = "Unknown";
  return ErrorCode2;
})(ErrorCode || {});
var SonareError = class extends Error {
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
function isSonareError(value) {
  return value instanceof Error && value.name === "SonareError" && typeof value.code === "number";
}

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
  } finally {
    try {
      raw.sonareReleaseException(thrown);
    } catch {
    }
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
function setSonareModule(module2) {
  wrappedModule = wrapModuleErrors(module2);
}
function getSonareModule() {
  if (!wrappedModule) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return wrappedModule;
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
var AUTOMATION_CURVE_VALUES = {
  linear: 0,
  exponential: 1,
  hold: 2,
  "s-curve": 3
};
var PROJECT_AUTOMATION_CURVE_VALUES = {
  ...AUTOMATION_CURVE_VALUES,
  scurve: 3
};
var PAN_LAW_VALUES = {
  const3db: 0,
  "const-3db": 0,
  "-3db": 0,
  "const4.5db": 1,
  "const-4.5db": 1,
  "-4.5db": 1,
  const6db: 2,
  "const-6db": 2,
  "-6db": 2,
  linear0db: 3,
  "linear-0db": 3,
  linear: 3,
  "0db": 3
};
var PAN_MODE_VALUES = {
  balance: 0,
  pan: 1,
  stereopan: 1,
  "stereo-pan": 1,
  dualpan: 2,
  "dual-pan": 2
};
var METER_TAP_VALUES = { preFader: 0, postFader: 1 };
var SEND_TIMING_VALUES = { postFader: 0, preFader: 1 };
var SIDECHAIN_SOURCE_KIND_VALUES = { track: 0, bus: 1 };
var TRACK_MONITOR_MODE_VALUES = { off: 0, pfl: 1, afl: 2 };
function automationCurveCode(curve) {
  return resolveEnumOrdinal(curve, AUTOMATION_CURVE_VALUES, "automation curve");
}
function projectAutomationCurveCode(curve) {
  return resolveEnumOrdinal(curve ?? "linear", PROJECT_AUTOMATION_CURVE_VALUES, "automation curve");
}
function panLawCode(panLaw) {
  const normalized = typeof panLaw === "string" ? panLaw.toLowerCase().replace(/_/g, "-") : panLaw;
  return resolveEnumOrdinal(normalized, PAN_LAW_VALUES, "pan law");
}
function panModeCode(panMode) {
  const normalized = typeof panMode === "string" ? panMode.replace(/_/g, "-").toLowerCase() : panMode;
  return resolveEnumOrdinal(normalized, PAN_MODE_VALUES, "pan mode");
}
function meterTapCode(tap) {
  return resolveEnumOrdinal(tap, METER_TAP_VALUES, "meter tap");
}
function sendTimingCode(timing) {
  return resolveEnumOrdinal(timing, SEND_TIMING_VALUES, "send timing");
}
function sidechainSourceKindCode(kind) {
  return resolveEnumOrdinal(kind, SIDECHAIN_SOURCE_KIND_VALUES, "sidechain source kind");
}
function trackMonitorModeCode(mode) {
  return resolveEnumOrdinal(mode, TRACK_MONITOR_MODE_VALUES, "track monitor mode");
}

// src/sample_bank.ts
var SampleBank = class {
  /** Create an empty bank. */
  constructor() {
    this.released = false;
    this.native = new (projectModule()).SampleBank();
    this.nativeId = this.native.id;
  }
  /**
   * Copy mono float frames into the bank and return the new sample's index,
   * which {@link SampleZoneDesc.sampleIndex} names. The frames are copied, so
   * the array may be reused afterwards.
   *
   * Loop points are clamped inside the sample and a loop mode whose loop
   * survives the clamp empty is dropped, so a malformed loop plays as an
   * unlooped sample rather than as a wrap over nothing. An empty array, and a
   * bank that would exceed 67,108,864 sample points, throw.
   *
   * A NaN or Inf frame, `fineTuneCents` or `sourceRate` throws too, and the
   * bank is left unchanged. Such a value is unattributable once stored: the
   * reader's interpolation spreads one bad frame across the whole sustain, and
   * a bad tuning offset renders the voice silent with no error raised.
   */
  addSample(data, desc = {}) {
    return this.native.addSample(data, desc);
  }
  /**
   * Append a key/velocity rectangle to a keymap set, creating any sets below
   * it. A patch names a set; the first zone in it covering a note is the one
   * that sounds.
   *
   * Every bound defaults on its own (see {@link SampleZoneDesc}), so an empty
   * rectangle is the whole keyboard at every velocity and narrowing one axis
   * leaves the other whole. A `sampleIndex` the bank does not have, an inverted
   * key or velocity range, and a `setIndex` at or above 4096 all throw.
   */
  addZone(zone = {}) {
    const { setIndex, ...rest } = zone;
    this.native.addZone(setIndex ?? 0, rest);
  }
  /** Samples added so far. */
  sampleCount() {
    return this.native.sampleCount();
  }
  /** Keymap sets the bank has (one past the highest index used). */
  setCount() {
    return this.native.setCount();
  }
  /** Release the underlying WASM object. Idempotent, as the Node facade is. */
  delete() {
    if (this.released) {
      return;
    }
    this.released = true;
    this.native.delete();
  }
  /** Alias for {@link SampleBank.delete}, provided for cross-binding (Node) compatibility. */
  destroy() {
    this.delete();
  }
};

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
function assertSamplesInWindow(fnName, samples, validate, windowStart, windowLength, argName = "samples") {
  assertNonEmptySamples(fnName, samples, argName);
  if (!validate) {
    return;
  }
  const start = Math.min(Math.max(Math.floor(windowStart), 0), samples.length);
  const stop = Math.min(start + Math.max(Math.ceil(windowLength), 0), samples.length);
  for (let i = start; i < stop; i++) {
    const v = samples[i];
    if (!Number.isFinite(v)) {
      throw new RangeError(`${fnName}: ${argName} contains NaN or Inf at index ${i}`);
    }
  }
}
function assertFiniteScalar(fnName, value, argName) {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${fnName}: ${argName} must be a finite number`);
  }
}
function assertVqtGamma(fnName, gamma) {
  if (gamma === Number.POSITIVE_INFINITY || gamma === Number.NEGATIVE_INFINITY) {
    throw new RangeError(`${fnName}: gamma must not be infinite`);
  }
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
function validateAudioBuffer(samples, sampleRate) {
  assertSamples("Audio.fromBuffer", samples, true);
  assertSampleRate("Audio.fromBuffer", sampleRate);
}
var C_INT_MIN = -2147483648;
var C_INT_MAX = 2147483647;
function assertInt32(fnName, value, argName) {
  if (!Number.isInteger(value) || value < C_INT_MIN || value > C_INT_MAX) {
    throw new SonareError(
      4 /* InvalidParameter */,
      "InvalidParameter",
      `${fnName}: ${argName} must be an integer within the signed 32-bit range`
    );
  }
}
function assertHpssKernels(fnName, kernelHarmonic, kernelPercussive) {
  assertInt32(fnName, kernelHarmonic, "kernelHarmonic");
  assertInt32(fnName, kernelPercussive, "kernelPercussive");
}
function assertIntegralField(fnName, value, argName) {
  if (!Number.isInteger(value)) {
    throw new SonareError(
      4 /* InvalidParameter */,
      "InvalidParameter",
      `${fnName}: ${argName} must be an integer`
    );
  }
}
function assertPercussiveSeparation(fnName, options) {
  const fields = ["nFft", "hopLength", "hpssKernelHarmonic", "hpssKernelPercussive"];
  for (const field of fields) {
    const value = options[field];
    if (value !== void 0) {
      assertIntegralField(fnName, value, field);
    }
  }
}
function assertNonNegativeInteger(fnName, value, argName) {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${fnName}: ${argName} must be a non-negative integer`);
  }
}
function assertPositiveInteger(fnName, value, argName) {
  if (!Number.isInteger(value)) {
    throw new RangeError(`${fnName}: ${argName} must be an integer`);
  }
  if (value <= 0 || value > C_INT_MAX) {
    throw new RangeError(`${fnName}: ${argName} must be a positive integer`);
  }
}
function assertIntegerValue(fnName, value, argName) {
  if (typeof value !== "number") {
    throw new TypeError(`${fnName}: ${argName} must be an integer`);
  }
  if (!Number.isInteger(value)) {
    throw new RangeError(`${fnName}: ${argName} must be an integer`);
  }
}
function assertEvenIntegerAtLeast(fnName, value, argName, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(`${fnName}: ${argName} must be an integer in [${min}, ${max}]`);
  }
  if (value % 2 !== 0) {
    throw new RangeError(`${fnName}: ${argName} must be an even integer`);
  }
}
function assertBoundedInteger(fnName, value, argName, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(`${fnName}: ${argName} must be an integer in [${min}, ${max}]`);
  }
}
function assertU7(fnName, value, argName) {
  if (!Number.isInteger(value) || value < 0 || value > 127) {
    throw new RangeError(`${fnName}: ${argName} must be an integer in [0, 127]`);
  }
  return value;
}
function assertNibble(fnName, value, argName) {
  if (!Number.isInteger(value) || value < 0 || value > 15) {
    throw new RangeError(`${fnName}: ${argName} must be an integer in [0, 15]`);
  }
  return value;
}
function assertU32(fnName, value, argName) {
  if (!Number.isInteger(value) || value < 0 || value > 4294967295) {
    throw new RangeError(`${fnName}: ${argName} must be an integer in [0, 4294967295]`);
  }
}
function toInt32Array(fnName, values, argName) {
  if (values instanceof Int32Array) {
    return values;
  }
  const out = new Int32Array(values.length);
  for (let i = 0; i < values.length; i++) {
    const element = values[i];
    if (typeof element !== "number") {
      throw new TypeError(`${fnName}: ${argName}[${i}] must be an integer`);
    }
    if (!Number.isInteger(element)) {
      throw new RangeError(`${fnName}: ${argName}[${i}] must be an integer`);
    }
    if (element < C_INT_MIN || element > C_INT_MAX) {
      throw new RangeError(
        `${fnName}: ${argName}[${i}] must be an integer in [${C_INT_MIN}, ${C_INT_MAX}]`
      );
    }
    out[i] = element;
  }
  return out;
}
function assertInterleavedSamples(fnName, samples, channels, validate) {
  assertSamples(fnName, samples, validate);
  assertPositiveInteger(fnName, channels, "channels");
  if (samples.length % channels !== 0) {
    throw new RangeError(`${fnName}: samples length must be a multiple of channels`);
  }
}

// src/project_internal.ts
function normalizeSynthInstrument(patch) {
  if (patch === null || typeof patch !== "object") {
    return patch;
  }
  const { sampleBank, ...rest } = patch;
  if (!sampleBank) {
    return rest;
  }
  if (!(sampleBank instanceof SampleBank)) {
    throw new TypeError("sampleBank must be a SampleBank instance");
  }
  if (sampleBank.released) {
    throw new TypeError("sampleBank is destroyed");
  }
  return { ...rest, sampleBankId: sampleBank.nativeId };
}
function projectModule() {
  const candidate = getSonareModule();
  if (typeof candidate.projectAbiVersion !== "function" || candidate.Project === void 0) {
    throw new Error("libsonare was built without arrangement (headless DAW) support");
  }
  return candidate;
}
function projectMidi1Event(fnName, ppq, group, status, channel, data1, data2 = 0) {
  if (!Number.isFinite(ppq) || ppq < 0) {
    throw new RangeError(`${fnName}: ppq must be a non-negative finite number`);
  }
  const g = assertNibble(fnName, group, "group");
  const ch = assertNibble(fnName, channel, "channel");
  const d1 = assertU7(fnName, data1, "data1");
  const d2 = assertU7(fnName, data2, "data2");
  const word = (2 << 28 | g << 24 | status << 20 | ch << 16 | d1 << 8 | d2) >>> 0;
  return { ppq, data0: word, data1: 0 };
}
function assertProjectMidiEvents(fnName, events) {
  if (!Array.isArray(events)) {
    throw new TypeError(`${fnName}: events must be an array`);
  }
  events.forEach((event, index) => {
    const prefix = `events[${index}]`;
    if (Array.isArray(event)) {
      if (event.length < 3) {
        throw new TypeError(`${fnName}: ${prefix} must contain [ppq, data0, data1]`);
      }
      if (!Number.isFinite(event[0]) || event[0] < 0) {
        throw new RangeError(`${fnName}: ${prefix}.ppq must be a non-negative finite number`);
      }
      assertU32(fnName, event[1], `${prefix}.data0`);
      assertU32(fnName, event[2], `${prefix}.data1`);
      return;
    }
    if (event === null || typeof event !== "object") {
      throw new TypeError(`${fnName}: ${prefix} must be a MIDI event object or tuple`);
    }
    if (!Number.isFinite(event.ppq) || event.ppq < 0) {
      throw new RangeError(`${fnName}: ${prefix}.ppq must be a non-negative finite number`);
    }
    assertU32(fnName, event.data0, `${prefix}.data0`);
    if (event.data1 !== void 0) {
      assertU32(fnName, event.data1, `${prefix}.data1`);
    }
  });
}
function projectTrackKindValue(kind) {
  return resolveEnumOrdinal(kind ?? "audio", { audio: 0, midi: 1, aux: 2 }, "project track kind");
}
function projectAutomationPointValue(point) {
  const curve = projectAutomationCurveCode(point.curve ?? point.curveToNext);
  return {
    ...point,
    curve,
    curveToNext: curve
  };
}
function projectAutomationTargetKindValue(kind) {
  return resolveEnumOrdinal(
    kind,
    { opaque: 0, "track-fader-db": 1, "track-pan": 2 },
    "project automation target kind"
  );
}
function projectWarpModeValue(mode) {
  return resolveEnumOrdinal(
    mode ?? "off",
    { off: 0, repitch: 1, "tempo-sync": 2, "time-stretch": 3 },
    "project warp mode"
  );
}
function projectLoopModeValue(mode) {
  return resolveEnumOrdinal(mode ?? "off", { off: 0, loop: 1 }, "project loop mode");
}

// src/align_take.ts
function alignTakeToReference(request) {
  assertSamples("alignTakeToReference", request.reference, true, "reference");
  assertSamples("alignTakeToReference", request.take, true, "take");
  assertSampleRate("alignTakeToReference", request.sampleRate);
  return projectModule().alignTakeToReference(
    request.reference,
    request.take,
    request.sampleRate,
    request
  );
}

// src/_effects_common.ts
function toVoicedFloat32(voiced) {
  const out = new Float32Array(voiced.length);
  for (let index = 0; index < voiced.length; index += 1) {
    out[index] = voiced[index] ? 1 : 0;
  }
  return out;
}

// src/effects_note_ops.ts
function requireModule() {
  return getSonareModule();
}
function assertNoteTrack(fnName, request) {
  assertSamples(fnName, request.samples, request.validate !== false);
  assertSampleRate(fnName, request.sampleRate);
  if (request.voiced && request.voiced.length !== request.f0Hz.length) {
    throw new RangeError(`${fnName}: voiced length must match f0Hz length`);
  }
  if (request.voicedProb && request.voicedProb.length !== request.f0Hz.length) {
    throw new RangeError(`${fnName}: voicedProb length must match f0Hz length`);
  }
  return request.voiced ? toVoicedFloat32(request.voiced) : void 0;
}
function noteStretch(samples, sampleRate = 22050, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  assertSamples("noteStretch", request.samples, request.validate !== false);
  return requireModule().noteStretch(
    request.samples,
    request.sampleRate ?? 22050,
    request.onsetSample ?? 0,
    request.offsetSample ?? request.samples.length,
    request.stretchRatio ?? 1
  );
}
function noteMove(samples, sampleRate = 22050, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  assertSamples("noteMove", request.samples, request.validate !== false);
  return requireModule().noteMove(
    request.samples,
    request.sampleRate ?? 22050,
    request.onsetSample ?? 0,
    request.offsetSample ?? request.samples.length,
    request.targetOnsetSample ?? 0
  );
}
function extractNotes(request) {
  const voicedF32 = assertNoteTrack("extractNotes", request);
  return requireModule().extractNotes(
    request.samples,
    request.sampleRate,
    request.f0Hz,
    request.voicedProb,
    voicedF32,
    request.frameRate,
    request
  );
}
function renderNotes(request) {
  assertSamples("renderNotes", request.samples, request.validate !== false);
  assertSampleRate("renderNotes", request.sampleRate);
  return requireModule().renderNotes(request.samples, request.sampleRate, request.notes, request);
}
function decomposeNotePitch(request) {
  return requireModule().decomposeNotePitch(
    request.f0Hz,
    request.frameRate,
    request.medianHz,
    request.vibratoCutoffHz ?? 0
  );
}
function splitNote(request) {
  const voicedF32 = assertNoteTrack("splitNote", request);
  return requireModule().splitNote(
    request.samples,
    request.sampleRate,
    request.f0Hz,
    request.voicedProb,
    voicedF32,
    request.frameRate,
    request.notes,
    request.index,
    request.frame,
    request
  );
}
function mergeNotes(request) {
  const voicedF32 = assertNoteTrack("mergeNotes", request);
  return requireModule().mergeNotes(
    request.samples,
    request.sampleRate,
    request.f0Hz,
    request.voicedProb,
    voicedF32,
    request.frameRate,
    request.notes,
    request.first,
    request.last,
    request
  );
}
function noteTargetsFromSmf(request) {
  const module2 = requireModule();
  if (typeof module2.noteTargetsFromSmf !== "function") {
    throw new Error("libsonare was built without arrangement support");
  }
  return module2.noteTargetsFromSmf(request.data, request.trackIndex ?? 0);
}
function assignNoteTargets(request) {
  return requireModule().assignNoteTargets(
    request.notes,
    request.sampleRate,
    request.targets,
    request
  );
}

// src/effects_percussive.ts
function requireModule2() {
  return getSonareModule();
}
function extractPercussiveEvents(request) {
  assertSamples("extractPercussiveEvents", request.samples, request.validate !== false);
  assertSampleRate("extractPercussiveEvents", request.sampleRate);
  assertPercussiveSeparation("extractPercussiveEvents", request);
  return requireModule2().extractPercussiveEvents(request.samples, request.sampleRate, request);
}
function renderPercussiveEvents(request) {
  assertSamples("renderPercussiveEvents", request.samples, request.validate !== false);
  assertSampleRate("renderPercussiveEvents", request.sampleRate);
  assertPercussiveSeparation("renderPercussiveEvents", request);
  return requireModule2().renderPercussiveEvents(
    request.samples,
    request.sampleRate,
    request.events,
    request
  );
}

// src/_fft_options.ts
function resolveFftOptions(fnName, nFft, hopLength) {
  const resolvedNFft = nFft === void 0 ? 2048 : nFft;
  const resolvedHopLength = hopLength === void 0 ? 512 : hopLength;
  assertIntegerValue(fnName, resolvedNFft, "nFft");
  assertEvenIntegerAtLeast(fnName, resolvedNFft, "nFft", 2, 2 ** 30);
  assertIntegerValue(fnName, resolvedHopLength, "hopLength");
  assertPositiveInteger(fnName, resolvedHopLength, "hopLength");
  return { nFft: resolvedNFft, hopLength: resolvedHopLength };
}

// src/effects_separation.ts
function requireModule3() {
  return getSonareModule();
}
function resolveHardMask(value, fnName) {
  if (value === void 0) {
    return false;
  }
  if (typeof value !== "boolean") {
    throw new TypeError(`${fnName}: hardMask must be a boolean`);
  }
  return value;
}
function hpss(samples, sampleRate = 22050, kernelHarmonic = 31, kernelPercussive = 31, nFft, hopLength, hardMask) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, kernelHarmonic, kernelPercussive, nFft, hopLength, hardMask } : samples;
  const fftOptions = resolveFftOptions("hpss", request.nFft, request.hopLength);
  const resolvedHardMask = resolveHardMask(request.hardMask, "hpss");
  const resolvedKernelHarmonic = request.kernelHarmonic ?? 31;
  const resolvedKernelPercussive = request.kernelPercussive ?? 31;
  assertHpssKernels("hpss", resolvedKernelHarmonic, resolvedKernelPercussive);
  return requireModule3().hpssEx(
    request.samples,
    request.sampleRate ?? 22050,
    resolvedKernelHarmonic,
    resolvedKernelPercussive,
    fftOptions.nFft,
    fftOptions.hopLength,
    resolvedHardMask
  );
}
function harmonic(samples, sampleRate = 22050, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  assertSamples("harmonic", request.samples, request.validate !== false);
  return requireModule3().harmonic(request.samples, request.sampleRate ?? 22050);
}
function percussive(samples, sampleRate = 22050, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  assertSamples("percussive", request.samples, request.validate !== false);
  return requireModule3().percussive(request.samples, request.sampleRate ?? 22050);
}

// src/effects_spectral.ts
function requireModule4() {
  return getSonareModule();
}
function spectralEdit(samples, sampleRate, ops = [], options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ops, ...options } : samples;
  assertSamples("spectralEdit", request.samples, request.validate !== false);
  assertSampleRate("spectralEdit", request.sampleRate);
  return requireModule4().spectralEdit(
    request.samples,
    request.sampleRate,
    request.ops ?? [],
    request
  );
}

// src/effects_timepitch.ts
function requireModule5() {
  return getSonareModule();
}
function timeStretch(samples, sampleRate, rate, nFftOrOptions, hopLength, options = {}) {
  if (nFftOrOptions !== void 0 && nFftOrOptions !== null && typeof nFftOrOptions !== "number" && typeof nFftOrOptions !== "object") {
    throw new TypeError("timeStretch: nFft must be an integer or options object");
  }
  if (nFftOrOptions === null) {
    throw new TypeError("timeStretch: nFft must be an integer or options object");
  }
  const positionalOptions = typeof nFftOrOptions === "object" && nFftOrOptions !== null ? nFftOrOptions : options;
  const positionalNFft = typeof nFftOrOptions === "number" ? nFftOrOptions : void 0;
  const request = samples instanceof Float32Array ? {
    samples,
    sampleRate,
    rate,
    nFft: positionalNFft,
    hopLength,
    ...positionalOptions
  } : samples;
  assertSamples("timeStretch", request.samples, request.validate !== false);
  assertFiniteScalar("timeStretch", request.rate, "rate");
  const fftOptions = resolveFftOptions("timeStretch", request.nFft, request.hopLength);
  return requireModule5().timeStretchEx(
    request.samples,
    request.sampleRate ?? 22050,
    request.rate,
    fftOptions.nFft,
    fftOptions.hopLength
  );
}
function pitchShift(samples, sampleRate, semitones, nFftOrOptions, hopLength, options = {}) {
  if (nFftOrOptions !== void 0 && nFftOrOptions !== null && typeof nFftOrOptions !== "number" && typeof nFftOrOptions !== "object") {
    throw new TypeError("pitchShift: nFft must be an integer or options object");
  }
  if (nFftOrOptions === null) {
    throw new TypeError("pitchShift: nFft must be an integer or options object");
  }
  const positionalOptions = typeof nFftOrOptions === "object" && nFftOrOptions !== null ? nFftOrOptions : options;
  const positionalNFft = typeof nFftOrOptions === "number" ? nFftOrOptions : void 0;
  const request = samples instanceof Float32Array ? {
    samples,
    sampleRate,
    semitones,
    nFft: positionalNFft,
    hopLength,
    ...positionalOptions
  } : samples;
  assertSamples("pitchShift", request.samples, request.validate !== false);
  assertFiniteScalar("pitchShift", request.semitones, "semitones");
  const fftOptions = resolveFftOptions("pitchShift", request.nFft, request.hopLength);
  return requireModule5().pitchShiftEx(
    request.samples,
    request.sampleRate ?? 22050,
    request.semitones,
    fftOptions.nFft,
    fftOptions.hopLength
  );
}
function pitchCorrectToMidi(samples, sampleRate = 22050, currentMidi = 69, targetMidi = 69, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, currentMidi, targetMidi, ...options } : samples;
  assertSamples("pitchCorrectToMidi", request.samples, request.validate !== false);
  return requireModule5().pitchCorrectToMidi(
    request.samples,
    request.sampleRate ?? 22050,
    request.currentMidi ?? 69,
    request.targetMidi ?? 69
  );
}
function pitchCorrectToMidiTimevarying(samples, f0Hz, targetMidi, sampleRate = 22050, hopLength = 512, voiced, voicedProb, options = {}) {
  const request = samples instanceof Float32Array ? {
    samples,
    f0Hz,
    targetMidi,
    sampleRate,
    hopLength,
    voiced,
    voicedProb,
    ...options
  } : samples;
  assertSamples("pitchCorrectToMidiTimevarying", request.samples, request.validate !== false);
  if (request.voiced && request.voiced.length !== request.f0Hz.length) {
    throw new RangeError("pitchCorrectToMidiTimevarying: voiced length must match f0Hz length");
  }
  if (request.voicedProb && request.voicedProb.length !== request.f0Hz.length) {
    throw new RangeError("pitchCorrectToMidiTimevarying: voicedProb length must match f0Hz length");
  }
  const voicedF32 = request.voiced ? toVoicedFloat32(request.voiced) : void 0;
  return requireModule5().pitchCorrectToMidiTimevarying(
    request.samples,
    request.sampleRate ?? 22050,
    request.f0Hz,
    request.targetMidi,
    request.hopLength ?? 512,
    voicedF32,
    request.voicedProb
  );
}
function pitchCorrectTimevarying(samples, f0Hz, sampleRate = 22050, hopLength = 512, options = {}) {
  const request = samples instanceof Float32Array ? { samples, f0Hz, sampleRate, hopLength, ...options } : samples;
  assertSamples("pitchCorrectTimevarying", request.samples, request.validate !== false);
  if (request.voiced && request.voiced.length !== request.f0Hz.length) {
    throw new RangeError("pitchCorrectTimevarying: voiced length must match f0Hz length");
  }
  if (request.voicedProb && request.voicedProb.length !== request.f0Hz.length) {
    throw new RangeError("pitchCorrectTimevarying: voicedProb length must match f0Hz length");
  }
  const nativeOptions = {
    ...request,
    voiced: request.voiced ? toVoicedFloat32(request.voiced) : void 0
  };
  return requireModule5().pitchCorrectTimevarying(
    request.samples,
    request.sampleRate ?? 22050,
    request.f0Hz,
    request.hopLength ?? 512,
    nativeOptions
  );
}

// src/effects_voice_change.ts
function requireModule6() {
  return getSonareModule();
}
function voiceChange(samples, sampleRate = 22050, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  assertSamples("voiceChange", request.samples, request.validate !== false);
  return requireModule6().voiceChange(
    request.samples,
    request.sampleRate ?? 22050,
    request.pitchSemitones ?? 0,
    request.formantFactor ?? 1
  );
}
function voiceChangeRealtime(samples, sampleRate = 48e3, preset = "neutral-monitor", options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, preset, ...options } : samples;
  assertSamples("voiceChangeRealtime", request.samples, request.validate !== false);
  const channels = request.channels ?? 1;
  if (channels !== 1 && channels !== 2) {
    throw new Error("voiceChangeRealtime: channels must be 1 or 2.");
  }
  if (channels === 2 && request.samples.length % 2 !== 0) {
    throw new Error("voiceChangeRealtime: stereo input length must be a multiple of 2.");
  }
  const presetConfig = request.preset ?? "neutral-monitor";
  return requireModule6().voiceChangeRealtime(
    request.samples,
    request.sampleRate ?? 48e3,
    typeof presetConfig === "string" ? presetConfig : JSON.stringify(presetConfig),
    channels
  );
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
function requireModule7() {
  return getSonareModule();
}
function resolveNormalizeMode(value, context = "normalize") {
  if (value === void 0) {
    return "peak";
  }
  if (typeof value !== "string") {
    throw new TypeError(`${context}: mode must be the string 'peak' or 'rms'`);
  }
  if (value !== "peak" && value !== "rms") {
    throw new RangeError(`${context}: mode must be the string 'peak' or 'rms'`);
  }
  return value;
}
function normalize(samples, sampleRate, targetDb = 0, modeOrOptions = "peak", options = {}) {
  if (modeOrOptions !== void 0 && modeOrOptions !== null && typeof modeOrOptions !== "string" && typeof modeOrOptions !== "object") {
    throw new TypeError("normalize: mode must be the string 'peak' or 'rms'");
  }
  if (modeOrOptions === null) {
    throw new TypeError("normalize: mode must be the string 'peak' or 'rms'");
  }
  const positionalOptions = typeof modeOrOptions === "object" && modeOrOptions !== null ? modeOrOptions : options;
  const positionalMode = typeof modeOrOptions === "string" ? modeOrOptions : void 0;
  const request = samples instanceof Float32Array ? { samples, sampleRate, targetDb, mode: positionalMode, ...positionalOptions } : samples;
  assertSamples("normalize", request.samples, request.validate !== false);
  const mode = resolveNormalizeMode(request.mode);
  return requireModule7().normalizeEx(
    request.samples,
    request.sampleRate ?? 22050,
    request.targetDb ?? 0,
    mode
  );
}
function normalizeStereo(request) {
  assertSamples("normalizeStereo", request.left, request.validate !== false);
  assertSamples("normalizeStereo", request.right, request.validate !== false);
  if (request.left.length !== request.right.length) {
    throw new RangeError("Stereo channel lengths must match.");
  }
  const mode = resolveNormalizeMode(request.mode, "normalizeStereo");
  const targetDb = request.targetDb ?? (mode === "rms" ? -20 : 0);
  return requireModule7().normalizeStereo(
    request.left,
    request.right,
    request.sampleRate ?? 22050,
    targetDb,
    mode
  );
}
function canonicalChainConfig(config) {
  return { __flatParams: flattenChainConfig(config) };
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
function masteringChain(samples, sampleRate = 22050, config = {}, onProgress) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, config, onProgress } : samples;
  if (request.onProgress || request.cancel) {
    return requireModule7().masteringChainWithProgress(
      request.samples,
      request.sampleRate ?? 22050,
      canonicalChainConfig(request.config ?? {}),
      request.onProgress ?? (() => {
      }),
      request.cancel ?? (() => false)
    );
  }
  return requireModule7().masteringChain(
    request.samples,
    request.sampleRate ?? 22050,
    canonicalChainConfig(request.config ?? {})
  );
}
function masteringChainStereo(left, right, sampleRate = 22050, config = {}, onProgress) {
  const request = left instanceof Float32Array ? { left, right, sampleRate, config, onProgress } : left;
  if (request.left.length !== request.right.length) {
    throw new Error("Stereo channel lengths must match.");
  }
  if (request.onProgress || request.cancel) {
    return requireModule7().masteringChainStereoWithProgress(
      request.left,
      request.right,
      request.sampleRate ?? 22050,
      canonicalChainConfig(request.config ?? {}),
      request.onProgress ?? (() => {
      }),
      request.cancel ?? (() => false)
    );
  }
  return requireModule7().masteringChainStereo(
    request.left,
    request.right,
    request.sampleRate ?? 22050,
    canonicalChainConfig(request.config ?? {})
  );
}
function masteringChainWithProgress(samples, sampleRate = 22050, config = {}, onProgress) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, config, onProgress } : samples;
  if (!request.onProgress) {
    throw new TypeError("masteringChainWithProgress: onProgress is required");
  }
  return requireModule7().masteringChainWithProgress(
    request.samples,
    request.sampleRate ?? 22050,
    canonicalChainConfig(request.config ?? {}),
    request.onProgress,
    request.cancel ?? (() => false)
  );
}
function masteringChainStereoWithProgress(left, right, sampleRate = 22050, config = {}, onProgress) {
  const request = left instanceof Float32Array ? { left, right, sampleRate, config, onProgress } : left;
  if (!request.onProgress) {
    throw new TypeError("masteringChainStereoWithProgress: onProgress is required");
  }
  if (request.left.length !== request.right.length) {
    throw new Error("Stereo channel lengths must match.");
  }
  return requireModule7().masteringChainStereoWithProgress(
    request.left,
    request.right,
    request.sampleRate ?? 22050,
    canonicalChainConfig(request.config ?? {}),
    request.onProgress,
    request.cancel ?? (() => false)
  );
}
function masteringPresetNames() {
  return Array.from(requireModule7().masteringPresetNames());
}
function masteringPresetParams(preset) {
  return requireModule7().masteringPresetParams(preset);
}
function masteringPlatformNames() {
  return Array.from(requireModule7().masteringPlatformNames());
}
function masterAudio(samples, sampleRate = 22050, presetName = "pop", overrides = {}, onProgress) {
  const request = masterAudioRequest(samples, sampleRate, presetName, overrides, onProgress);
  const flat = flattenChainConfig(request.overrides ?? {});
  if (request.onProgress || request.cancel) {
    return requireModule7().masterAudioWithProgress(
      request.preset ?? "pop",
      request.samples,
      request.sampleRate ?? 22050,
      flat,
      request.onProgress ?? (() => {
      }),
      request.cancel ?? (() => false)
    );
  }
  return requireModule7().masterAudio(
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
    return requireModule7().masterAudioStereoWithProgress(
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
  return requireModule7().masterAudioStereo(
    request.preset ?? "pop",
    request.left,
    request.right,
    request.sampleRate ?? 22050,
    flat
  );
}
function masterAudioWithProgress(samples, sampleRate = 22050, presetName = "pop", overrides = null, onProgress) {
  const request = masterAudioRequest(samples, sampleRate, presetName, overrides, onProgress);
  if (!request.onProgress) {
    throw new TypeError("masterAudioWithProgress: onProgress is required");
  }
  return requireModule7().masterAudioWithProgress(
    request.preset ?? "pop",
    request.samples,
    request.sampleRate ?? 22050,
    flattenChainConfig(request.overrides ?? {}),
    request.onProgress,
    request.cancel ?? (() => false)
  );
}
function masterAudioStereoWithProgress(left, right = void 0, sampleRate = 22050, presetName = "pop", overrides = null, onProgress) {
  const request = masterAudioStereoRequest(
    left,
    right,
    sampleRate,
    presetName,
    overrides,
    onProgress
  );
  if (!request.onProgress) {
    throw new TypeError("masterAudioStereoWithProgress: onProgress is required");
  }
  if (request.left.length !== request.right.length) {
    throw new Error("Stereo channel lengths must match.");
  }
  return requireModule7().masterAudioStereoWithProgress(
    request.preset ?? "pop",
    request.left,
    request.right,
    request.sampleRate ?? 22050,
    flattenChainConfig(request.overrides ?? {}),
    request.onProgress,
    request.cancel ?? (() => false)
  );
}

// src/mastering_core.ts
function requireModule8() {
  return getSonareModule();
}
function mastering(samples, sampleRate = 22050, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  return requireModule8().mastering(
    request.samples,
    request.sampleRate ?? 22050,
    request.targetLufs ?? -14,
    request.ceilingDb ?? -1,
    request.truePeakOversample ?? 4,
    request.releaseMs ?? 0,
    // 0 => library default (50 ms)
    request.applyGainAtInputRate ?? false
  );
}
function masteringProcessorNames() {
  return Array.from(requireModule8().masteringProcessorNames());
}
function masteringInsertNames() {
  return requireModule8().masteringInsertNames();
}
function masteringInsertParamNames(name) {
  return Array.from(requireModule8().masteringInsertParamNames(name));
}
function masteringInsertParamInfo(name) {
  const json = requireModule8().masteringInsertParamInfo(name);
  return JSON.parse(json);
}
function insertTimingParamsToJson(fnName, params) {
  const out = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "boolean") {
      out[key] = value;
      continue;
    }
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new SonareError(
        4 /* InvalidParameter */,
        "InvalidParameter",
        `${fnName}: params.${key} must be a finite number or boolean`
      );
    }
    out[key] = value;
  }
  return JSON.stringify(out);
}
function masteringInsertTiming(name, params, sampleRate) {
  const json = insertTimingParamsToJson("masteringInsertTiming", params);
  return requireModule8().masteringInsertTiming(name, json, sampleRate);
}
function masteringProcessorCatalog() {
  const json = requireModule8().masteringProcessorCatalog();
  return JSON.parse(json);
}
function masteringPairProcessorNames() {
  return Array.from(requireModule8().masteringPairProcessorNames());
}
function masteringPairAnalysisNames() {
  return Array.from(requireModule8().masteringPairAnalysisNames());
}
function masteringStereoAnalysisNames() {
  return Array.from(requireModule8().masteringStereoAnalysisNames());
}
function masteringProcess(processorName, samples, sampleRate = 22050, params = {}) {
  const request = typeof processorName === "string" ? { processorName, samples, sampleRate, params } : processorName;
  return requireModule8().masteringProcess(
    request.processorName,
    request.samples,
    request.sampleRate ?? 22050,
    request.params ?? {}
  );
}
function masteringProcessStereo(processorName, left, right, sampleRate = 22050, params = {}) {
  const request = typeof processorName === "string" ? {
    processorName,
    left,
    right,
    sampleRate,
    params
  } : processorName;
  if (request.left.length !== request.right.length) {
    throw new Error("Stereo channel lengths must match.");
  }
  return requireModule8().masteringProcessStereo(
    request.processorName,
    request.left,
    request.right,
    request.sampleRate ?? 22050,
    request.params ?? {}
  );
}
function masteringPairProcess(processorName, source, reference, sampleRate = 22050, params = {}) {
  const request = typeof processorName === "string" ? {
    processorName,
    source,
    reference,
    sampleRate,
    params
  } : processorName;
  return requireModule8().masteringPairProcess(
    request.processorName,
    request.source,
    request.reference,
    request.sampleRate ?? 22050,
    request.params ?? {}
  );
}
function masteringPairAnalyze(analysisName, source, reference, sampleRate = 22050, params = {}) {
  const request = typeof analysisName === "string" ? {
    analysisName,
    source,
    reference,
    sampleRate,
    params
  } : analysisName;
  return requireModule8().masteringPairAnalyze(
    request.analysisName,
    request.source,
    request.reference,
    request.sampleRate ?? 22050,
    request.params ?? {}
  );
}
function masteringAbMatchLoudness(request) {
  return requireModule8().masteringAbMatchLoudness(
    request.source,
    request.reference,
    request.sampleRate ?? 22050
  );
}
function masteringStereoAnalyze(analysisName, left, right, sampleRate = 22050, params = {}) {
  const request = typeof analysisName === "string" ? {
    analysisName,
    left,
    right,
    sampleRate,
    params
  } : analysisName;
  return requireModule8().masteringStereoAnalyze(
    request.analysisName,
    request.left,
    request.right,
    request.sampleRate ?? 22050,
    request.params ?? {}
  );
}
function masteringAssistantSuggest(samples, sampleRate = 22050, params = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, params } : samples;
  return requireModule8().masteringAssistantSuggest(
    request.samples,
    request.sampleRate ?? 22050,
    request.params ?? {}
  );
}
function masteringAssistantSuggestChain(request) {
  return requireModule8().masteringAssistantSuggestChain(
    request.samples,
    request.sampleRate ?? 22050,
    request.params ?? {}
  );
}
function masteringAudioProfile(samples, sampleRate = 22050, params = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, params } : samples;
  return requireModule8().masteringAudioProfile(
    request.samples,
    request.sampleRate ?? 22050,
    request.params ?? {}
  );
}
function masteringStreamingPreview(samples, sampleRate = 22050, platforms = []) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, platforms } : samples;
  return requireModule8().masteringStreamingPreview(
    request.samples,
    request.sampleRate ?? 22050,
    request.platforms ?? []
  );
}
function masteringAssistantSuggestStereo(request) {
  return requireModule8().masteringAssistantSuggestStereo(
    request.left,
    request.right,
    request.sampleRate ?? 22050,
    request.params ?? {}
  );
}
function masteringAssistantSuggestChainStereo(request) {
  return requireModule8().masteringAssistantSuggestChainStereo(
    request.left,
    request.right,
    request.sampleRate ?? 22050,
    request.params ?? {}
  );
}
function masteringAudioProfileStereo(request) {
  return requireModule8().masteringAudioProfileStereo(
    request.left,
    request.right,
    request.sampleRate ?? 22050,
    request.params ?? {}
  );
}
function masteringStreamingPreviewStereo(request) {
  return requireModule8().masteringStreamingPreviewStereo(
    request.left,
    request.right,
    request.sampleRate ?? 22050,
    request.platforms ?? []
  );
}

// src/mastering_dynamics.ts
function requireModule9() {
  return getSonareModule();
}
var COMPRESSOR_DETECTOR_MAP = {
  peak: 0,
  rms: 1,
  log_rms: 2
};
function masteringDynamicsCompressor(samples, sampleRate, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  assertSamples("masteringDynamicsCompressor", request.samples, request.validate !== false);
  const detector = typeof request.detector === "string" ? COMPRESSOR_DETECTOR_MAP[request.detector] : request.detector;
  const opts = Object.assign(
    Object.create(Object.getPrototypeOf(request)),
    request
  );
  if (detector !== void 0) {
    opts.detector = detector;
  }
  return requireModule9().masteringDynamicsCompressor(request.samples, request.sampleRate, opts);
}
function masteringDynamicsGate(samples, sampleRate, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  assertSamples("masteringDynamicsGate", request.samples, request.validate !== false);
  return requireModule9().masteringDynamicsGate(request.samples, request.sampleRate, request);
}
function masteringDynamicsTransientShaper(samples, sampleRate, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  assertSamples("masteringDynamicsTransientShaper", request.samples, request.validate !== false);
  return requireModule9().masteringDynamicsTransientShaper(
    request.samples,
    request.sampleRate,
    request
  );
}

// src/mixing_oneshot.ts
function requireModule10() {
  return getSonareModule();
}
function mixingScenePresetNames() {
  return Array.from(requireModule10().mixingScenePresetNames());
}
function mixingScenePresetJson(presetName) {
  return requireModule10().mixingScenePresetJson(presetName);
}
function mixStereo(leftChannels, rightChannels, sampleRate = 48e3, options = {}) {
  const request = Array.isArray(leftChannels) ? { leftChannels, rightChannels: rightChannels ?? [], sampleRate, ...options } : leftChannels;
  if (request.leftChannels.length === 0 || request.leftChannels.length !== request.rightChannels.length) {
    throw new Error("leftChannels and rightChannels must have the same non-zero length.");
  }
  return requireModule10().mixStereo(
    request.leftChannels,
    request.rightChannels,
    request.sampleRate ?? 48e3,
    request
  );
}

// src/repair_dereverb.ts
function requireModule11() {
  return getSonareModule();
}
function masteringRepairDereverbClassical(samples, sampleRate, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  return requireModule11().masteringRepairDereverbClassical(
    request.samples,
    request.sampleRate,
    request
  );
}
function masteringRepairDereverbClassicalStereo(left, right, sampleRate, config = {}) {
  const request = left instanceof Float32Array ? { left, right, sampleRate, ...config } : left;
  const { left: leftSamples, right: rightSamples, sampleRate: rate, ...options } = request;
  return requireModule11().masteringRepairDereverbClassicalStereo(
    leftSamples,
    rightSamples,
    rate ?? 22050,
    options
  );
}
function masteringRepairDereverbClassicalLinked(channels, sampleRate, config = {}) {
  const request = Array.isArray(channels) ? { channels, sampleRate, ...config } : channels;
  const { channels: input, sampleRate: rate, ...options } = request;
  return requireModule11().masteringRepairDereverbClassicalLinked(input, rate ?? 22050, options);
}
function masteringRepairDereverbConfigForRoom(estimate, config = {}) {
  const request = "estimate" in estimate ? estimate : { estimate, ...config };
  return requireModule11().masteringRepairDereverbConfigForRoom(request.estimate, request);
}
function masteringRepairDetectReverb(samples, sampleRate, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  return requireModule11().masteringRepairDetectReverb(request.samples, request.sampleRate, request);
}

// src/repair_impulsive.ts
function requireModule12() {
  return getSonareModule();
}
function masteringRepairDeclickStereo(left, right, sampleRate, config = {}) {
  const request = left instanceof Float32Array ? { left, right, sampleRate, ...config } : left;
  const { left: leftSamples, right: rightSamples, sampleRate: rate, ...options } = request;
  return requireModule12().masteringRepairDeclickStereo(
    leftSamples,
    rightSamples,
    rate ?? 22050,
    options
  );
}
function masteringRepairDeclick(samples, sampleRate, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  return requireModule12().masteringRepairDeclick(request.samples, request.sampleRate, request);
}
function masteringRepairDeclip(samples, sampleRate, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  return requireModule12().masteringRepairDeclip(request.samples, request.sampleRate, request);
}
function masteringRepairDeclipStereo(left, right, sampleRate, config = {}) {
  const request = left instanceof Float32Array ? { left, right, sampleRate, ...config } : left;
  const { left: leftSamples, right: rightSamples, sampleRate: rate, ...options } = request;
  return requireModule12().masteringRepairDeclipStereo(
    leftSamples,
    rightSamples,
    rate ?? 22050,
    options
  );
}
function masteringRepairDecrackle(samples, sampleRate, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  return requireModule12().masteringRepairDecrackle(request.samples, request.sampleRate, request);
}
function masteringRepairDecrackleStereo(left, right, sampleRate, config = {}) {
  const request = left instanceof Float32Array ? { left, right, sampleRate, ...config } : left;
  const { left: leftSamples, right: rightSamples, sampleRate: rate, ...options } = request;
  return requireModule12().masteringRepairDecrackleStereo(
    leftSamples,
    rightSamples,
    rate ?? 22050,
    options
  );
}
function masteringRepairDetectClicks(samples, sampleRate, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  return requireModule12().masteringRepairDetectClicks(request.samples, request.sampleRate, request);
}
function masteringRepairDetectClipping(samples, sampleRate, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  return requireModule12().masteringRepairDetectClipping(
    request.samples,
    request.sampleRate,
    request
  );
}
function masteringRepairDetectCrackle(samples, sampleRate, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  return requireModule12().masteringRepairDetectCrackle(request.samples, request.sampleRate, request);
}

// src/repair_noise.ts
function requireModule13() {
  return getSonareModule();
}
function masteringRepairDenoiseClassical(samples, sampleRate, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  return requireModule13().masteringRepairDenoiseClassical(
    request.samples,
    request.sampleRate,
    request
  );
}
function masteringRepairDenoiseClassicalStereo(left, right, sampleRate, config = {}) {
  const request = left instanceof Float32Array ? { left, right, sampleRate, ...config } : left;
  const { left: leftSamples, right: rightSamples, sampleRate: rate, ...options } = request;
  return requireModule13().masteringRepairDenoiseClassicalStereo(
    leftSamples,
    rightSamples,
    rate ?? 22050,
    options
  );
}
function masteringRepairDenoiseClassicalLinked(channels, sampleRate, config = {}) {
  const request = Array.isArray(channels) ? { channels, sampleRate, ...config } : channels;
  const { channels: input, sampleRate: rate, ...options } = request;
  return requireModule13().masteringRepairDenoiseClassicalLinked(input, rate ?? 22050, options);
}
function masteringRepairDehum(samples, sampleRate, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  return requireModule13().masteringRepairDehum(request.samples, request.sampleRate, request);
}
function masteringRepairDehumStereo(left, right, sampleRate, config = {}) {
  const request = left instanceof Float32Array ? { left, right, sampleRate, ...config } : left;
  const { left: leftSamples, right: rightSamples, sampleRate: rate, ...options } = request;
  return requireModule13().masteringRepairDehumStereo(
    leftSamples,
    rightSamples,
    rate ?? 22050,
    options
  );
}
function masteringRepairDetectNoiseFloor(samples, sampleRate, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  return requireModule13().masteringRepairDetectNoiseFloor(
    request.samples,
    request.sampleRate,
    request
  );
}
function masteringRepairNoiseBandBins(nFft, sampleRate) {
  const request = typeof nFft === "object" && nFft !== null ? nFft : { nFft, sampleRate };
  return requireModule13().masteringRepairNoiseBandBins(
    request.nFft ?? 1024,
    request.sampleRate ?? 22050
  );
}
function masteringRepairDetectHum(samples, sampleRate, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  return requireModule13().masteringRepairDetectHum(request.samples, request.sampleRate, request);
}

// src/repair_trim.ts
function requireModule14() {
  return getSonareModule();
}
function masteringRepairTrimSilence(samples, sampleRate, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  return requireModule14().masteringRepairTrimSilence(request.samples, request.sampleRate, request);
}
function masteringRepairTrimSilenceStereo(left, right, sampleRate, config = {}) {
  const request = left instanceof Float32Array ? { left, right, sampleRate, ...config } : left;
  const { left: leftSamples, right: rightSamples, sampleRate: rate, ...options } = request;
  return requireModule14().masteringRepairTrimSilenceStereo(
    leftSamples,
    rightSamples,
    rate ?? 22050,
    options
  );
}
function masteringRepairDetectTrimRange(samples, sampleRate, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  return requireModule14().masteringRepairDetectTrimRange(
    request.samples,
    request.sampleRate,
    request
  );
}
function masteringRepairDetectTrimRangeStereo(left, right, sampleRate, config = {}) {
  const request = left instanceof Float32Array ? { left, right, sampleRate, ...config } : left;
  const { left: leftSamples, right: rightSamples, sampleRate: rate, ...options } = request;
  return requireModule14().masteringRepairDetectTrimRangeStereo(
    leftSamples,
    rightSamples,
    rate ?? 22050,
    options
  );
}

// src/feature_core.ts
function requireModule15() {
  return getSonareModule();
}
function tone(frequency = 440, sampleRate = 22050, duration = 1, phase = 0, amplitude = 1) {
  const request = typeof frequency === "number" ? { frequency, sampleRate, duration, phase, amplitude } : frequency;
  return requireModule15().tone(
    request.frequency ?? 440,
    request.sampleRate ?? 22050,
    request.duration ?? 1,
    request.phase ?? 0,
    request.amplitude ?? 1
  );
}
function chirp(fmin = 440, fmax = 880, sampleRate = 22050, duration = 1, linear = true) {
  const request = typeof fmin === "number" ? { fmin, fmax, sampleRate, duration, linear } : fmin;
  return requireModule15().chirp(
    request.fmin ?? 440,
    request.fmax ?? 880,
    request.sampleRate ?? 22050,
    request.duration ?? 1,
    request.linear ?? true
  );
}
function clicks(times, sampleRate = 22050, length = 0, frequency = 1e3, clickDuration = 0.1) {
  const request = times instanceof Float32Array ? { times, sampleRate, length, frequency, clickDuration } : times;
  return requireModule15().clicks(
    request.times,
    request.sampleRate ?? 22050,
    request.length ?? 0,
    request.frequency ?? 1e3,
    request.clickDuration ?? 0.1
  );
}
function hzToMel(hz) {
  return requireModule15().hzToMel(hz);
}
function melToHz(mel) {
  return requireModule15().melToHz(mel);
}
function hzToMidi(hz) {
  return requireModule15().hzToMidi(hz);
}
function midiToHz(midi) {
  return requireModule15().midiToHz(midi);
}
function hzToNote(hz) {
  return requireModule15().hzToNote(hz);
}
function noteToHz(note) {
  return requireModule15().noteToHz(note);
}
function framesToTime(frames, sr = 22050, hopLength = 512) {
  return requireModule15().framesToTime(frames, sr, hopLength);
}
function timeToFrames(time, sr = 22050, hopLength = 512) {
  return requireModule15().timeToFrames(time, sr, hopLength);
}
function framesToSamples(frames, hopLength = 512, nFft = 0) {
  return requireModule15().framesToSamples(frames, hopLength, nFft);
}
function samplesToFrames(samples, hopLength = 512, nFft = 0) {
  return requireModule15().samplesToFrames(samples, hopLength, nFft);
}
function powerToDb(values, ref = 1, amin = 1e-10, topDb = 80) {
  if (!(values instanceof Float32Array)) {
    return powerToDb(values.values, values.ref, values.amin, values.topDb);
  }
  return requireModule15().powerToDb(values, ref, amin, topDb);
}
function amplitudeToDb(values, ref = 1, amin = 1e-5, topDb = 80) {
  if (!(values instanceof Float32Array)) {
    return amplitudeToDb(values.values, values.ref, values.amin, values.topDb);
  }
  return requireModule15().amplitudeToDb(values, ref, amin, topDb);
}
function dbToPower(values, ref = 1) {
  return requireModule15().dbToPower(values, ref);
}
function dbToAmplitude(values, ref = 1) {
  return requireModule15().dbToAmplitude(values, ref);
}
function preemphasis(samples, coef = 0.97, zi) {
  if (!(samples instanceof Float32Array)) {
    return preemphasis(samples.samples, samples.coef, samples.zi);
  }
  return requireModule15().preemphasis(samples, coef, zi ?? null);
}
function deemphasis(samples, coef = 0.97, zi) {
  if (!(samples instanceof Float32Array)) {
    return deemphasis(samples.samples, samples.coef, samples.zi);
  }
  return requireModule15().deemphasis(samples, coef, zi ?? null);
}
function trimSilence(samples, topDb = 60, frameLength = 2048, hopLength = 512) {
  if (!(samples instanceof Float32Array)) {
    return trimSilence(samples.samples, samples.topDb, samples.frameLength, samples.hopLength);
  }
  return requireModule15().trimSilence(samples, topDb, frameLength, hopLength);
}
function splitSilence(samples, topDb = 60, frameLength = 2048, hopLength = 512) {
  if (!(samples instanceof Float32Array)) {
    return splitSilence(samples.samples, samples.topDb, samples.frameLength, samples.hopLength);
  }
  return requireModule15().splitSilence(samples, topDb, frameLength, hopLength);
}
function splitSilenceCommon(request) {
  return requireModule15().splitSilenceCommon(
    request.signals,
    request.topDb ?? 60,
    request.frameLength ?? 2048,
    request.hopLength ?? 512
  );
}
function splitSilenceCommonWithReport(request) {
  return requireModule15().splitSilenceCommonWithReport(
    request.signals,
    request.topDb ?? 60,
    request.frameLength ?? 2048,
    request.hopLength ?? 512
  );
}
function frameSignal(samples, frameLength, hopLength) {
  if (!(samples instanceof Float32Array)) {
    return frameSignal(samples.samples, samples.frameLength, samples.hopLength);
  }
  return requireModule15().frameSignal(samples, frameLength, hopLength);
}
function padCenter(values, targetSize, padValue = 0) {
  if (!(values instanceof Float32Array)) {
    return padCenter(values.values, values.targetSize, values.padValue);
  }
  return requireModule15().padCenter(values, targetSize, padValue);
}
function fixLength(values, targetSize, padValue = 0) {
  if (!(values instanceof Float32Array)) {
    return fixLength(values.values, values.targetSize, values.padValue);
  }
  return requireModule15().fixLength(values, targetSize, padValue);
}
function fixFrames(frames, xMin = 0, xMax = -1, pad = true) {
  if (!(frames instanceof Int32Array)) {
    return fixFrames(frames.frames, frames.xMin, frames.xMax, frames.pad);
  }
  return requireModule15().fixFrames(frames, xMin, xMax, pad);
}
function onsetBacktrack(events, energy) {
  if (!(events instanceof Int32Array)) {
    return onsetBacktrack(events.events, events.energy);
  }
  return requireModule15().onsetBacktrack(events, energy);
}
function peakPick(values, preMax, postMax, preAvg, postAvg, delta, wait) {
  if (!(values instanceof Float32Array)) {
    const r = values;
    return peakPick(r.values, r.preMax, r.postMax, r.preAvg, r.postAvg, r.delta, r.wait);
  }
  return requireModule15().peakPick(
    values,
    preMax,
    postMax,
    preAvg,
    postAvg,
    delta,
    wait
  );
}
function vectorNormalize(values, normType = 0, threshold = 0) {
  if (!(values instanceof Float32Array)) {
    return vectorNormalize(values.values, values.normType, values.threshold);
  }
  return requireModule15().vectorNormalize(values, normType, threshold);
}
function pcen(values, nBins = 0, nFrames = 0, options = {}) {
  if (!(values instanceof Float32Array)) {
    const r = values;
    const {
      values: requestValues,
      nBins: requestBins,
      nFrames: requestFrames,
      options: legacyOptions,
      ...flatOptions
    } = r;
    return pcen(requestValues, requestBins, requestFrames, {
      ...legacyOptions,
      ...flatOptions
    });
  }
  return requireModule15().pcen(values, nBins, nFrames, options);
}
function tonnetz(chromagram, nChroma, nFrames) {
  if (!(chromagram instanceof Float32Array)) {
    return tonnetz(chromagram.chromagram, chromagram.nChroma, chromagram.nFrames);
  }
  return requireModule15().tonnetz(chromagram, nChroma, nFrames);
}
function tempogram(onsetEnvelope2, sampleRate = 22050, hopLength = 512, winLength = 384, mode = "autocorrelation", center = true, norm = true) {
  if (!(onsetEnvelope2 instanceof Float32Array)) {
    const r = onsetEnvelope2;
    return tempogram(
      r.onsetEnvelope,
      r.sampleRate,
      r.hopLength,
      r.winLength,
      r.mode,
      r.center,
      r.norm
    );
  }
  return requireModule15().tempogram(
    onsetEnvelope2,
    sampleRate,
    hopLength,
    winLength,
    mode,
    center,
    norm
  );
}
function cyclicTempogram(onsetEnvelope2, sampleRate = 22050, hopLength = 512, winLength = 384, bpmMin = 60, nBins = 60) {
  if (!(onsetEnvelope2 instanceof Float32Array)) {
    const r = onsetEnvelope2;
    return cyclicTempogram(
      r.onsetEnvelope,
      r.sampleRate,
      r.hopLength,
      r.winLength,
      r.bpmMin,
      r.nBins
    );
  }
  return requireModule15().cyclicTempogram(
    onsetEnvelope2,
    sampleRate,
    hopLength,
    winLength,
    bpmMin,
    nBins
  );
}
function plp(onsetEnvelope2, sampleRate = 22050, hopLength = 512, tempoMin = 30, tempoMax = 300, winLength = 384) {
  if (!(onsetEnvelope2 instanceof Float32Array)) {
    const r = onsetEnvelope2;
    return plp(r.onsetEnvelope, r.sampleRate, r.hopLength, r.tempoMin, r.tempoMax, r.winLength);
  }
  return requireModule15().plp(onsetEnvelope2, sampleRate, hopLength, tempoMin, tempoMax, winLength);
}

// src/feature_decompose.ts
function requireModule16() {
  return getSonareModule();
}
function resolveHardMask2(fnName, value) {
  if (value === void 0) {
    return false;
  }
  if (typeof value !== "boolean") {
    throw new TypeError(`${fnName}: hardMask must be a boolean`);
  }
  return value;
}
function validateSegmentMatrix(fnName, data, rows, cols, dataName) {
  assertPositiveInteger(fnName, rows, "rows");
  assertPositiveInteger(fnName, cols, "cols");
  assertSamples(fnName, data, true, dataName);
  const expected = rows * cols;
  if (!Number.isSafeInteger(expected) || data.length !== expected) {
    throw new RangeError(`${fnName}: ${dataName} length must equal rows * cols`);
  }
}
function decompose(s, nFeatures = 0, nFrames = 0, nComponents = 0, nIter = 50, beta = 2) {
  if (!(s instanceof Float32Array)) {
    const request = s;
    return decompose(
      request.s,
      request.nFeatures,
      request.nFrames,
      request.nComponents,
      request.nIter,
      request.beta
    );
  }
  return requireModule16().decompose(s, nFeatures, nFrames, nComponents, nIter, beta);
}
function decomposeWithInit(s, nFeatures = 0, nFrames = 0, nComponents = 0, nIter = 50, beta = 2, init2 = "random") {
  if (!(s instanceof Float32Array)) {
    const request = s;
    return decomposeWithInit(
      request.s,
      request.nFeatures,
      request.nFrames,
      request.nComponents,
      request.nIter,
      request.beta,
      request.init
    );
  }
  return requireModule16().decomposeWithInit(s, nFeatures, nFrames, nComponents, nIter, beta, init2);
}
function decomposeStems(request) {
  return requireModule16().decomposeStems(request.samples, request.sampleRate, {
    nComponents: request.nComponents,
    nFft: request.nFft,
    hopLength: request.hopLength,
    nIter: request.nIter,
    beta: request.beta,
    init: request.init,
    maskPower: request.maskPower
  });
}
function decomposeStemsLinked(request) {
  return requireModule16().decomposeStemsLinked(request.channels, request.sampleRate ?? 22050, {
    nComponents: request.nComponents,
    nFft: request.nFft,
    hopLength: request.hopLength,
    nIter: request.nIter,
    beta: request.beta,
    init: request.init,
    maskPower: request.maskPower
  });
}
function nnFilter(s, nFeatures = 0, nFrames = 0, aggregate = "mean", k = 7, width = 1) {
  if (!(s instanceof Float32Array)) {
    const r = s;
    return nnFilter(r.s, r.nFeatures, r.nFrames, r.aggregate, r.k, r.width);
  }
  return requireModule16().nnFilter(s, nFeatures, nFrames, aggregate, k, width);
}
function remix(samples, intervals, sampleRate = 22050, alignZeros = false) {
  if (!(samples instanceof Float32Array)) {
    const r = samples;
    return remix(r.samples, r.intervals, r.sampleRate, r.alignZeros);
  }
  const intervalsI32 = toInt32Array("remix", intervals, "intervals");
  return requireModule16().remix(samples, intervalsI32, sampleRate, alignZeros);
}
function remixAlignedIntervals(samples, intervals, sampleRate = 22050, alignZeros = true) {
  if (!(samples instanceof Float32Array)) {
    const r = samples;
    return remixAlignedIntervals(r.samples, r.intervals, r.sampleRate, r.alignZeros ?? true);
  }
  const intervalsI32 = toInt32Array(
    "remixAlignedIntervals",
    intervals,
    "intervals"
  );
  return requireModule16().remixAlignedIntervals(samples, intervalsI32, sampleRate, alignZeros);
}
function hpssWithResidual(samples, sampleRate = 22050, kernelHarmonic = 31, kernelPercussive = 31, nFft, hopLength, hardMask) {
  if (!(samples instanceof Float32Array)) {
    const r = samples;
    return hpssWithResidual(
      r.samples,
      r.sampleRate,
      r.kernelHarmonic,
      r.kernelPercussive,
      r.nFft,
      r.hopLength,
      r.hardMask
    );
  }
  const fftOptions = resolveFftOptions("hpssWithResidual", nFft, hopLength);
  const resolvedHardMask = resolveHardMask2("hpssWithResidual", hardMask);
  assertHpssKernels("hpssWithResidual", kernelHarmonic, kernelPercussive);
  return requireModule16().hpssWithResidualEx(
    samples,
    sampleRate,
    kernelHarmonic,
    kernelPercussive,
    fftOptions.nFft,
    fftOptions.hopLength,
    resolvedHardMask
  );
}
function segmentCrossSimilarity(request) {
  validateSegmentMatrix("segmentCrossSimilarity", request.x, request.xRows, request.xCols, "x");
  validateSegmentMatrix("segmentCrossSimilarity", request.y, request.yRows, request.yCols, "y");
  if (request.xRows !== request.yRows) {
    throw new RangeError("segmentCrossSimilarity: feature dimensions must match");
  }
  assertNonNegativeInteger("segmentCrossSimilarity", request.k ?? 0, "k");
  return requireModule16().segmentCrossSimilarity(
    request.x,
    request.xRows,
    request.xCols,
    request.y,
    request.yRows,
    request.yCols,
    request.k ?? 0,
    request.metric ?? "cosine",
    request.mode ?? "connectivity"
  );
}
function segmentRecurrenceMatrix(request) {
  validateSegmentMatrix(
    "segmentRecurrenceMatrix",
    request.data,
    request.rows,
    request.cols,
    "data"
  );
  assertNonNegativeInteger("segmentRecurrenceMatrix", request.k ?? 0, "k");
  assertNonNegativeInteger("segmentRecurrenceMatrix", request.width ?? 1, "width");
  return requireModule16().segmentRecurrenceMatrix(
    request.data,
    request.rows,
    request.cols,
    request.k ?? 0,
    request.width ?? 1,
    request.sym ?? false,
    request.metric ?? "euclidean",
    request.mode ?? "connectivity"
  );
}
function segmentRecurrenceToLag(request) {
  validateSegmentMatrix(
    "segmentRecurrenceToLag",
    request.recurrence,
    request.n,
    request.n,
    "recurrence"
  );
  return requireModule16().segmentRecurrenceToLag(
    request.recurrence,
    request.n,
    request.pad ?? false
  );
}
function segmentLagToRecurrence(request) {
  validateSegmentMatrix("segmentLagToRecurrence", request.lag, request.rows, request.lags, "lag");
  return requireModule16().segmentLagToRecurrence(request.lag, request.rows, request.lags);
}
function segmentSubsegment(request) {
  validateSegmentMatrix("segmentSubsegment", request.data, request.rows, request.cols, "data");
  assertPositiveInteger("segmentSubsegment", request.nSegments ?? 4, "nSegments");
  return requireModule16().segmentSubsegment(
    request.data,
    request.rows,
    request.cols,
    request.boundaries,
    request.nSegments ?? 4
  );
}
function segmentAgglomerative(request) {
  validateSegmentMatrix("segmentAgglomerative", request.data, request.rows, request.cols, "data");
  assertPositiveInteger("segmentAgglomerative", request.k, "k");
  return requireModule16().segmentAgglomerative(
    request.data,
    request.rows,
    request.cols,
    request.k,
    request.linkage ?? "average"
  );
}
function segmentPathEnhance(request) {
  validateSegmentMatrix(
    "segmentPathEnhance",
    request.recurrence,
    request.n,
    request.n,
    "recurrence"
  );
  assertPositiveInteger("segmentPathEnhance", request.win, "win");
  assertPositiveInteger("segmentPathEnhance", request.maxRatio ?? 2, "maxRatio");
  assertNonNegativeInteger("segmentPathEnhance", request.minRatio ?? 0, "minRatio");
  assertPositiveInteger("segmentPathEnhance", request.nFilters ?? 7, "nFilters");
  return requireModule16().segmentPathEnhance(
    request.recurrence,
    request.n,
    request.win,
    request.maxRatio ?? 2,
    request.minRatio ?? 0,
    request.nFilters ?? 7
  );
}

// src/_feature_validation.ts
function validatePositiveIntegers(fnName, values) {
  for (const [name, value] of Object.entries(values)) {
    assertPositiveInteger(fnName, value, name);
  }
}
function validateMelFrequencyRange(fnName, fmin, fmax, sampleRate) {
  assertFiniteScalar(fnName, fmin, "fmin");
  assertFiniteScalar(fnName, fmax, "fmax");
  if (fmin < 0) {
    throw new RangeError(`${fnName}: fmin must be non-negative`);
  }
  if (fmax < 0) {
    throw new RangeError(`${fnName}: fmax must be non-negative`);
  }
  const effectiveFmax = fmax === 0 ? sampleRate / 2 : fmax;
  if (effectiveFmax <= fmin) {
    throw new RangeError(`${fnName}: fmax must be greater than fmin`);
  }
}

// src/feature_inverse.ts
function requireModule17() {
  return getSonareModule();
}
function validateMatrix(fnName, data, rows, frames, dataName, rowName, options = {}) {
  validatePositiveIntegers(fnName, { [rowName]: rows, nFrames: frames });
  assertSamples(fnName, data, options.validate !== false, dataName);
  const expectedLength = rows * frames;
  if (!Number.isSafeInteger(expectedLength) || data.length !== expectedLength) {
    throw new RangeError(`${fnName}: ${dataName} length must equal ${rowName} * nFrames`);
  }
}
function melToStft(melPower, nMels = 0, nFrames = 0, sampleRate = 22050, nFft = 2048, fmin = 0, fmax = 0, htk = false, options = {}) {
  if (!(melPower instanceof Float32Array)) {
    const request = melPower;
    return melToStft(
      request.melPower,
      request.nMels,
      request.nFrames,
      request.sampleRate,
      request.nFft,
      request.fmin,
      request.fmax,
      request.htk,
      request
    );
  }
  assertSampleRate("melToStft", sampleRate);
  validateMatrix("melToStft", melPower, nMels, nFrames, "melPower", "nMels", options);
  validatePositiveIntegers("melToStft", { nFft });
  validateMelFrequencyRange("melToStft", fmin, fmax, sampleRate);
  return requireModule17().melToStft(melPower, nMels, nFrames, sampleRate, nFft, fmin, fmax, htk);
}
function melToAudio(melPower, nMels = 0, nFrames = 0, sampleRate = 22050, nFft = 2048, hopLength = 512, fmin = 0, fmax = 0, nIter = 32, htk = false, options = {}) {
  if (!(melPower instanceof Float32Array)) {
    const request = melPower;
    return melToAudio(
      request.melPower,
      request.nMels,
      request.nFrames,
      request.sampleRate,
      request.nFft,
      request.hopLength,
      request.fmin,
      request.fmax,
      request.nIter,
      request.htk,
      request
    );
  }
  assertSampleRate("melToAudio", sampleRate);
  validateMatrix("melToAudio", melPower, nMels, nFrames, "melPower", "nMels", options);
  const fft = resolveFftOptions("melToAudio", nFft, hopLength);
  validatePositiveIntegers("melToAudio", { nIter });
  validateMelFrequencyRange("melToAudio", fmin, fmax, sampleRate);
  return requireModule17().melToAudio(
    melPower,
    nMels,
    nFrames,
    sampleRate,
    fft.nFft,
    fft.hopLength,
    fmin,
    fmax,
    nIter,
    htk
  );
}
function griffinLim(magnitude, nBins = 0, nFrames = 0, sampleRate = 22050, nFft = 2048, hopLength = 512, nIter = 32, momentum = 0.99, options = {}) {
  if (!(magnitude instanceof Float32Array)) {
    const request = magnitude;
    return griffinLim(
      request.magnitude,
      request.nBins,
      request.nFrames,
      request.sampleRate,
      request.nFft,
      request.hopLength,
      request.nIter,
      request.momentum,
      request
    );
  }
  assertSampleRate("griffinLim", sampleRate);
  validateMatrix("griffinLim", magnitude, nBins, nFrames, "magnitude", "nBins", options);
  const fft = resolveFftOptions("griffinLim", nFft, hopLength);
  validatePositiveIntegers("griffinLim", { nIter });
  return requireModule17().griffinLim(
    magnitude,
    nBins,
    nFrames,
    sampleRate,
    fft.nFft,
    fft.hopLength,
    nIter,
    momentum
  );
}
function mfccToMel(mfccCoefficients, nMfcc = 0, nFrames = 0, nMels = 128, lifter = 0, options = {}) {
  if (!(mfccCoefficients instanceof Float32Array)) {
    const request = mfccCoefficients;
    return mfccToMel(
      request.mfccCoefficients,
      request.nMfcc,
      request.nFrames,
      request.nMels,
      request.lifter,
      request
    );
  }
  validateMatrix(
    "mfccToMel",
    mfccCoefficients,
    nMfcc,
    nFrames,
    "mfccCoefficients",
    "nMfcc",
    options
  );
  validatePositiveIntegers("mfccToMel", { nMels });
  return requireModule17().mfccToMel(mfccCoefficients, nMfcc, nFrames, nMels, lifter);
}
function mfccToAudio(mfccCoefficients, nMfcc = 0, nFrames = 0, nMels = 128, sampleRate = 22050, nFft = 2048, hopLength = 512, fmin = 0, fmax = 0, nIter = 32, htk = false, lifter = 0, options = {}) {
  if (!(mfccCoefficients instanceof Float32Array)) {
    const request = mfccCoefficients;
    return mfccToAudio(
      request.mfccCoefficients,
      request.nMfcc,
      request.nFrames,
      request.nMels,
      request.sampleRate,
      request.nFft,
      request.hopLength,
      request.fmin,
      request.fmax,
      request.nIter,
      request.htk,
      request.lifter,
      request
    );
  }
  assertSampleRate("mfccToAudio", sampleRate);
  validateMatrix(
    "mfccToAudio",
    mfccCoefficients,
    nMfcc,
    nFrames,
    "mfccCoefficients",
    "nMfcc",
    options
  );
  const fft = resolveFftOptions("mfccToAudio", nFft, hopLength);
  validatePositiveIntegers("mfccToAudio", { nMels, nIter });
  validateMelFrequencyRange("mfccToAudio", fmin, fmax, sampleRate);
  return requireModule17().mfccToAudio(
    mfccCoefficients,
    nMfcc,
    nFrames,
    nMels,
    sampleRate,
    fft.nFft,
    fft.hopLength,
    fmin,
    fmax,
    nIter,
    htk,
    lifter
  );
}
function phaseVocoder(samples, sampleRate = 22050, rate = 1, nFft = 2048, hopLength = 512) {
  if (!(samples instanceof Float32Array)) {
    const r = samples;
    return phaseVocoder(r.samples, r.sampleRate ?? 22050, r.rate, r.nFft, r.hopLength);
  }
  assertFiniteScalar("phaseVocoder", rate, "rate");
  return requireModule17().phaseVocoder(samples, sampleRate, rate, nFft, hopLength);
}

// src/feature_loudness.ts
function requireModule18() {
  return getSonareModule();
}
function lufsInterleaved(samples, channels = 0, sampleRate = 22050, options = {}) {
  if (!(samples instanceof Float32Array)) {
    const r = samples;
    return lufsInterleaved(r.samples, r.channels, r.sampleRate, r);
  }
  assertSampleRate("lufsInterleaved", sampleRate);
  assertInterleavedSamples("lufsInterleaved", samples, channels, options.validate !== false);
  return requireModule18().lufsInterleaved(samples, channels, sampleRate);
}
function lufsSeriesInterleaved(samples, channels = 0, sampleRate = 22050, options = {}) {
  if (!(samples instanceof Float32Array)) {
    const r = samples;
    return lufsSeriesInterleaved(r.samples, r.channels, r.sampleRate, r);
  }
  assertSampleRate("lufsSeriesInterleaved", sampleRate);
  assertInterleavedSamples("lufsSeriesInterleaved", samples, channels, options.validate !== false);
  return requireModule18().lufsSeriesInterleaved(samples, channels, sampleRate);
}
function ebur128LoudnessRange(samples, sampleRate = 22050) {
  if (!(samples instanceof Float32Array)) {
    return ebur128LoudnessRange(samples.samples, samples.sampleRate);
  }
  return requireModule18().ebur128LoudnessRange(samples, sampleRate);
}

// src/feature_music.ts
function requireModule19() {
  return getSonareModule();
}
function validateMusicSamples(fnName, samples, sampleRate, options = {}) {
  assertSampleRate(fnName, sampleRate);
  assertSamples(fnName, samples, options.validate !== false);
}
function validateFrequencyBounds(fnName, fmin, fmax) {
  assertFiniteScalar(fnName, fmin, "fmin");
  if (fmin < 0) {
    throw new RangeError(`${fnName}: fmin must be non-negative`);
  }
  if (fmax !== void 0) {
    assertFiniteScalar(fnName, fmax, "fmax");
    if (fmax <= fmin) {
      throw new RangeError(`${fnName}: fmax must be greater than fmin`);
    }
  }
}
function nnlsChroma(samples, sampleRate = 22050, options = {}) {
  if (!(samples instanceof Float32Array)) {
    return nnlsChroma(samples.samples, samples.sampleRate, samples);
  }
  validateMusicSamples("nnlsChroma", samples, sampleRate, options);
  const hopLength = options.hopLength === void 0 ? 512 : options.hopLength;
  assertPositiveInteger("nnlsChroma", hopLength, "hopLength");
  if (hopLength > 2 ** 31 - 1) {
    throw new RangeError("nnlsChroma: hopLength must fit in a signed 32-bit integer");
  }
  return requireModule19().nnlsChromaEx(
    samples,
    sampleRate,
    options.enableStftBlend ?? true,
    options.stftBlendWeight ?? 0.55,
    options.stftBlendNFft ?? 4096,
    hopLength
  );
}
function cqt(samples, sampleRate = 22050, hopLength = 512, fmin = 32.70319566257483, nBins = 84, binsPerOctave = 12, options = {}) {
  if (!(samples instanceof Float32Array)) {
    const request = samples;
    return cqt(
      request.samples,
      request.sampleRate,
      request.hopLength,
      request.fmin,
      request.nBins,
      request.binsPerOctave,
      request
    );
  }
  validateMusicSamples("cqt", samples, sampleRate, options);
  validatePositiveIntegers("cqt", { hopLength, nBins, binsPerOctave });
  validateFrequencyBounds("cqt", fmin);
  return requireModule19().cqt(samples, sampleRate, hopLength, fmin, nBins, binsPerOctave);
}
function pseudoCqt(samples, sampleRate = 22050, hopLength = 512, fmin = 32.70319566257483, nBins = 84, binsPerOctave = 12, options = {}) {
  if (!(samples instanceof Float32Array)) {
    const request = samples;
    return pseudoCqt(
      request.samples,
      request.sampleRate,
      request.hopLength,
      request.fmin,
      request.nBins,
      request.binsPerOctave,
      request
    );
  }
  validateMusicSamples("pseudoCqt", samples, sampleRate, options);
  validatePositiveIntegers("pseudoCqt", { hopLength, nBins, binsPerOctave });
  validateFrequencyBounds("pseudoCqt", fmin);
  return requireModule19().pseudoCqt(samples, sampleRate, hopLength, fmin, nBins, binsPerOctave);
}
function hybridCqt(samples, sampleRate = 22050, hopLength = 512, fmin = 32.70319566257483, nBins = 84, binsPerOctave = 12, options = {}) {
  if (!(samples instanceof Float32Array)) {
    const request = samples;
    return hybridCqt(
      request.samples,
      request.sampleRate,
      request.hopLength,
      request.fmin,
      request.nBins,
      request.binsPerOctave,
      request
    );
  }
  validateMusicSamples("hybridCqt", samples, sampleRate, options);
  validatePositiveIntegers("hybridCqt", { hopLength, nBins, binsPerOctave });
  validateFrequencyBounds("hybridCqt", fmin);
  return requireModule19().hybridCqt(samples, sampleRate, hopLength, fmin, nBins, binsPerOctave);
}
function vqt(samples, sampleRate = 22050, hopLength = 512, fmin = 32.70319566257483, nBins = 84, binsPerOctave = 12, gamma = -1, options = {}) {
  if (!(samples instanceof Float32Array)) {
    const request = samples;
    return vqt(
      request.samples,
      request.sampleRate,
      request.hopLength,
      request.fmin,
      request.nBins,
      request.binsPerOctave,
      request.gamma,
      request
    );
  }
  validateMusicSamples("vqt", samples, sampleRate, options);
  validatePositiveIntegers("vqt", { hopLength, nBins, binsPerOctave });
  validateFrequencyBounds("vqt", fmin);
  assertVqtGamma("vqt", gamma);
  return requireModule19().vqt(samples, sampleRate, hopLength, fmin, nBins, binsPerOctave, gamma);
}
function validateCqtInverse(fnName, magnitude, nBins, nFrames, sampleRate, hopLength, fmin, binsPerOctave, nIter, options) {
  assertSampleRate(fnName, sampleRate);
  validatePositiveIntegers(fnName, { nBins, nFrames, hopLength, binsPerOctave, nIter });
  if (nIter > 256) {
    throw new RangeError(`${fnName}: nIter must be at most 256`);
  }
  validateFrequencyBounds(fnName, fmin);
  if (fmin === 0) {
    throw new RangeError(`${fnName}: fmin must be positive`);
  }
  if (magnitude.length !== nBins * nFrames) {
    throw new RangeError(`${fnName}: magnitude length must equal nBins * nFrames`);
  }
  assertSamples(fnName, magnitude, options.validate !== false);
}
function cqtToAudio(magnitude, nBins = 0, nFrames = 0, sampleRate = 22050, hopLength = 512, fmin = 32.70319566257483, binsPerOctave = 12, nIter = 32, options = {}) {
  if (!(magnitude instanceof Float32Array)) {
    const request = magnitude;
    return cqtToAudio(
      request.magnitude,
      request.nBins,
      request.nFrames,
      request.sampleRate,
      request.hopLength,
      request.fmin,
      request.binsPerOctave,
      request.nIter,
      request
    );
  }
  validateCqtInverse(
    "cqtToAudio",
    magnitude,
    nBins,
    nFrames,
    sampleRate,
    hopLength,
    fmin,
    binsPerOctave,
    nIter,
    options
  );
  return requireModule19().cqtToAudio(
    magnitude,
    nBins,
    nFrames,
    sampleRate,
    hopLength,
    fmin,
    binsPerOctave,
    nIter
  );
}
function vqtToAudio(magnitude, nBins = 0, nFrames = 0, sampleRate = 22050, hopLength = 512, fmin = 32.70319566257483, binsPerOctave = 12, gamma = -1, nIter = 32, options = {}) {
  if (!(magnitude instanceof Float32Array)) {
    const request = magnitude;
    return vqtToAudio(
      request.magnitude,
      request.nBins,
      request.nFrames,
      request.sampleRate,
      request.hopLength,
      request.fmin,
      request.binsPerOctave,
      request.gamma,
      request.nIter,
      request
    );
  }
  validateCqtInverse(
    "vqtToAudio",
    magnitude,
    nBins,
    nFrames,
    sampleRate,
    hopLength,
    fmin,
    binsPerOctave,
    nIter,
    options
  );
  assertVqtGamma("vqtToAudio", gamma);
  return requireModule19().vqtToAudio(
    magnitude,
    nBins,
    nFrames,
    sampleRate,
    hopLength,
    fmin,
    binsPerOctave,
    gamma,
    nIter
  );
}
function analyzeSections(samples, sampleRate = 22050, options = {}) {
  if (!(samples instanceof Float32Array)) {
    const r = samples;
    return analyzeSections(r.samples, r.sampleRate, r);
  }
  validateMusicSamples("analyzeSections", samples, sampleRate, options);
  validatePositiveIntegers("analyzeSections", {
    nFft: options.nFft ?? 2048,
    hopLength: options.hopLength ?? 512
  });
  assertFiniteScalar("analyzeSections", options.minSectionSec ?? 4, "minSectionSec");
  if ((options.minSectionSec ?? 4) < 0) {
    throw new RangeError("analyzeSections: minSectionSec must be non-negative");
  }
  const sections = requireModule19().analyzeSections(
    samples,
    sampleRate,
    options.nFft ?? 2048,
    options.hopLength ?? 512,
    options.minSectionSec ?? 4
  );
  return Array.from(sections, (s) => ({ ...s, type: s.type }));
}
function detectBoundaries(request) {
  const { samples, sampleRate = 22050 } = request;
  validateMusicSamples("detectBoundaries", samples, sampleRate, request);
  const sizes = {};
  for (const name of ["nFft", "hopLength", "kernelSize", "nMfcc", "nChroma"]) {
    const value = request[name];
    if (value != null) {
      sizes[name] = value;
    }
  }
  validatePositiveIntegers("detectBoundaries", sizes);
  for (const name of ["threshold", "absoluteThreshold", "peakDistance"]) {
    const value = request[name];
    if (value == null) {
      continue;
    }
    assertFiniteScalar("detectBoundaries", value, name);
    if (value < 0) {
      throw new RangeError(`detectBoundaries: ${name} must be non-negative`);
    }
  }
  if (request.useMfcc === false && request.useChroma === false) {
    throw new SonareError(
      4 /* InvalidParameter */,
      "InvalidParameter",
      "detectBoundaries: require useMfcc or useChroma"
    );
  }
  const result = requireModule19().detectBoundaries(samples, sampleRate, request);
  return {
    boundaries: Array.from(result.boundaries, (b) => ({
      time: b.time,
      frame: b.frame,
      strength: b.strength
    })),
    noveltyCurve: result.noveltyCurve,
    noveltyPeak: result.noveltyPeak,
    sampleRate: result.sampleRate,
    hopLength: result.hopLength,
    nFrames: result.nFrames,
    frameStride: result.frameStride
  };
}
function analyzeMelody(samples, sampleRate = 22050, options = {}) {
  if (!(samples instanceof Float32Array)) {
    const r = samples;
    return analyzeMelody(r.samples, r.sampleRate, r);
  }
  validateMusicSamples("analyzeMelody", samples, sampleRate, options);
  const fmin = options.fmin ?? 65;
  const fmax = options.fmax ?? 2093;
  validateFrequencyBounds("analyzeMelody", fmin, fmax);
  if (fmin <= 0) {
    throw new SonareError(
      4 /* InvalidParameter */,
      "InvalidParameter",
      "analyzeMelody: fmin must be positive"
    );
  }
  validatePositiveIntegers("analyzeMelody", {
    frameLength: options.frameLength ?? 2048,
    hopLength: options.hopLength ?? 256
  });
  const threshold = options.threshold ?? 0.1;
  assertFiniteScalar("analyzeMelody", threshold, "threshold");
  if (threshold <= 0) {
    throw new SonareError(
      4 /* InvalidParameter */,
      "InvalidParameter",
      "analyzeMelody: threshold must be positive"
    );
  }
  return requireModule19().analyzeMelody(
    samples,
    sampleRate,
    options.fmin ?? 65,
    options.fmax ?? 2093,
    options.frameLength ?? 2048,
    options.hopLength ?? 256,
    options.threshold ?? 0.1,
    options.usePyin ?? false,
    options.center ?? true
  );
}
function onsetEnvelope(samples, sampleRate = 22050, nFft = 2048, hopLength = 512, nMels = 128, options = {}) {
  if (!(samples instanceof Float32Array)) {
    const request = samples;
    return onsetEnvelope(
      request.samples,
      request.sampleRate,
      request.nFft,
      request.hopLength,
      request.nMels,
      request
    );
  }
  validateMusicSamples("onsetEnvelope", samples, sampleRate, options);
  const fft = resolveFftOptions("onsetEnvelope", nFft, hopLength);
  validatePositiveIntegers("onsetEnvelope", { nMels });
  return requireModule19().onsetEnvelope(samples, sampleRate, fft.nFft, fft.hopLength, nMels);
}
function onsetStrengthMulti(samples, sampleRate = 22050, nFft = 2048, hopLength = 512, nMels = 128, nBands = 3, options = {}) {
  if (!(samples instanceof Float32Array)) {
    const request = samples;
    return onsetStrengthMulti(
      request.samples,
      request.sampleRate,
      request.nFft,
      request.hopLength,
      request.nMels,
      request.nBands,
      request
    );
  }
  validateMusicSamples("onsetStrengthMulti", samples, sampleRate, options);
  const fft = resolveFftOptions("onsetStrengthMulti", nFft, hopLength);
  validatePositiveIntegers("onsetStrengthMulti", { nMels, nBands });
  return requireModule19().onsetStrengthMulti(
    samples,
    sampleRate,
    fft.nFft,
    fft.hopLength,
    nMels,
    nBands
  );
}
function fourierTempogram(onsetEnvelope2, sampleRate = 22050, hopLength = 512, winLength = 384, center = true, norm = true, options = {}) {
  if (!(onsetEnvelope2 instanceof Float32Array)) {
    const request = onsetEnvelope2;
    return fourierTempogram(
      request.onsetEnvelope,
      request.sampleRate,
      request.hopLength,
      request.winLength,
      request.center,
      request.norm,
      request
    );
  }
  assertSampleRate("fourierTempogram", sampleRate);
  assertSamples("fourierTempogram", onsetEnvelope2, options.validate !== false, "onsetEnvelope");
  validatePositiveIntegers("fourierTempogram", { hopLength, winLength });
  return requireModule19().fourierTempogram(
    onsetEnvelope2,
    sampleRate,
    hopLength,
    winLength,
    center,
    norm
  );
}
function tempogramRatio(tempogramData, winLength = 384, sampleRate = 22050, hopLength = 512, factors, options = {}) {
  if (!(tempogramData instanceof Float32Array)) {
    const request = tempogramData;
    return tempogramRatio(
      request.tempogramData,
      request.winLength,
      request.sampleRate,
      request.hopLength,
      request.factors,
      request
    );
  }
  assertSampleRate("tempogramRatio", sampleRate);
  assertSamples("tempogramRatio", tempogramData, options.validate !== false, "tempogramData");
  validatePositiveIntegers("tempogramRatio", { winLength, hopLength });
  return requireModule19().tempogramRatio(tempogramData, winLength, sampleRate, hopLength, factors);
}
function lufs(samples, sampleRate = 22050, options = {}) {
  if (!(samples instanceof Float32Array)) {
    const r = samples;
    return lufs(r.samples, r.sampleRate, r);
  }
  assertSampleRate("lufs", sampleRate);
  assertSamples("lufs", samples, options.validate !== false);
  return requireModule19().lufs(samples, sampleRate);
}
function momentaryLufs(samples, sampleRate = 22050, options = {}) {
  if (!(samples instanceof Float32Array)) {
    const r = samples;
    return momentaryLufs(r.samples, r.sampleRate, r);
  }
  assertSampleRate("momentaryLufs", sampleRate);
  assertSamples("momentaryLufs", samples, options.validate !== false);
  return requireModule19().momentaryLufs(samples, sampleRate);
}
function shortTermLufs(samples, sampleRate = 22050, options = {}) {
  if (!(samples instanceof Float32Array)) {
    const r = samples;
    return shortTermLufs(r.samples, r.sampleRate, r);
  }
  assertSampleRate("shortTermLufs", sampleRate);
  assertSamples("shortTermLufs", samples, options.validate !== false);
  return requireModule19().shortTermLufs(samples, sampleRate);
}

// src/feature_pitch.ts
function requireModule20() {
  return getSonareModule();
}
function piptrack(samples, sampleRate = 22050, nFft = 2048, hopLength = 512, fmin = 150, fmax = 4e3, threshold = 0.1) {
  if (!(samples instanceof Float32Array)) {
    const request = samples;
    return piptrack(
      request.samples,
      request.sampleRate,
      request.nFft,
      request.hopLength,
      request.fmin,
      request.fmax,
      request.threshold
    );
  }
  return requireModule20().piptrack(samples, sampleRate, nFft, hopLength, fmin, fmax, threshold);
}
function pitchYin(samples, sampleRate = 22050, frameLength = 2048, hopLength = 512, fmin = 65, fmax = 2093, threshold = 0.1, fillNa = false) {
  if (!(samples instanceof Float32Array)) {
    const request = samples;
    return pitchYin(
      request.samples,
      request.sampleRate,
      request.frameLength,
      request.hopLength,
      request.fmin,
      request.fmax,
      request.threshold,
      request.fillNa
    );
  }
  return requireModule20().pitchYin(
    samples,
    sampleRate,
    frameLength,
    hopLength,
    fmin,
    fmax,
    threshold,
    fillNa
  );
}
function pitchPyin(samples, sampleRate = 22050, frameLength = 2048, hopLength = 512, fmin = 65, fmax = 2093, threshold = 0.1, fillNa = false) {
  if (!(samples instanceof Float32Array)) {
    const request = samples;
    return pitchPyin(
      request.samples,
      request.sampleRate,
      request.frameLength,
      request.hopLength,
      request.fmin,
      request.fmax,
      request.threshold,
      request.fillNa
    );
  }
  return requireModule20().pitchPyin(
    samples,
    sampleRate,
    frameLength,
    hopLength,
    fmin,
    fmax,
    threshold,
    fillNa
  );
}
function noteSegments(request) {
  return requireModule20().noteSegments(request.f0Hz, request.voicedProb, request.frameRate, {
    segmentationThresholdCents: request.segmentationThresholdCents,
    minNoteMs: request.minNoteMs,
    referenceHz: request.referenceHz,
    voicedThreshold: request.voicedThreshold
  });
}
function pitchTuning(frequencies, resolution = 0.01, binsPerOctave = 12) {
  if (!(frequencies instanceof Float32Array)) {
    const r = frequencies;
    return pitchTuning(r.frequencies, r.resolution, r.binsPerOctave);
  }
  return requireModule20().pitchTuning(frequencies, resolution, binsPerOctave);
}
function estimateTuning(samples, sampleRate = 22050, nFft = 2048, hopLength = 512, resolution = 0.01, binsPerOctave = 12) {
  if (!(samples instanceof Float32Array)) {
    const r = samples;
    return estimateTuning(
      r.samples,
      r.sampleRate,
      r.nFft,
      r.hopLength,
      r.resolution,
      r.binsPerOctave
    );
  }
  return requireModule20().estimateTuning(
    samples,
    sampleRate,
    nFft,
    hopLength,
    resolution,
    binsPerOctave
  );
}

// src/feature_resample.ts
function requireModule21() {
  return getSonareModule();
}
function resample(samples, srcSr, targetSr) {
  if (!(samples instanceof Float32Array)) {
    return resample(samples.samples, samples.srcSr, samples.targetSr);
  }
  return requireModule21().resample(samples, srcSr, targetSr);
}

// src/feature_spectral.ts
function requireModule22() {
  return getSonareModule();
}
function spectralCentroid(samples, sampleRate = 22050, nFft = 2048, hopLength = 512) {
  if (!(samples instanceof Float32Array)) {
    return spectralCentroid(samples.samples, samples.sampleRate, samples.nFft, samples.hopLength);
  }
  return requireModule22().spectralCentroid(samples, sampleRate, nFft, hopLength);
}
function spectralContrast(samples, sampleRate = 22050, nFft = 2048, hopLength = 512, nBands = 6, fmin = 200, quantile = 0.02) {
  if (!(samples instanceof Float32Array)) {
    const r = samples;
    return spectralContrast(
      r.samples,
      r.sampleRate,
      r.nFft,
      r.hopLength,
      r.nBands,
      r.fmin,
      r.quantile
    );
  }
  return requireModule22().spectralContrast(
    samples,
    sampleRate,
    nFft,
    hopLength,
    nBands,
    fmin,
    quantile
  );
}
function polyFeatures(samples, sampleRate = 22050, nFft = 2048, hopLength = 512, order = 1) {
  if (!(samples instanceof Float32Array)) {
    const r = samples;
    return polyFeatures(r.samples, r.sampleRate, r.nFft, r.hopLength, r.order);
  }
  return requireModule22().polyFeatures(samples, sampleRate, nFft, hopLength, order);
}
function zeroCrossings(samples, threshold = 1e-10, refMagnitude = false, pad = true, zeroPos = true) {
  if (!(samples instanceof Float32Array)) {
    const r = samples;
    return zeroCrossings(r.samples, r.threshold, r.refMagnitude, r.pad, r.zeroPos);
  }
  return requireModule22().zeroCrossings(samples, threshold, refMagnitude, pad, zeroPos);
}
function spectralBandwidth(samples, sampleRate = 22050, nFft = 2048, hopLength = 512, p = 2) {
  if (!(samples instanceof Float32Array)) {
    return spectralBandwidth(
      samples.samples,
      samples.sampleRate,
      samples.nFft,
      samples.hopLength,
      samples.p
    );
  }
  return requireModule22().spectralBandwidth(samples, sampleRate, nFft, hopLength, p);
}
function spectralRolloff(samples, sampleRate = 22050, nFft = 2048, hopLength = 512, rollPercent = 0.85) {
  if (!(samples instanceof Float32Array)) {
    return spectralRolloff(
      samples.samples,
      samples.sampleRate,
      samples.nFft,
      samples.hopLength,
      samples.rollPercent
    );
  }
  return requireModule22().spectralRolloff(samples, sampleRate, nFft, hopLength, rollPercent);
}
function spectralFlatness(samples, sampleRate = 22050, nFft = 2048, hopLength = 512) {
  if (!(samples instanceof Float32Array)) {
    return spectralFlatness(samples.samples, samples.sampleRate, samples.nFft, samples.hopLength);
  }
  return requireModule22().spectralFlatness(samples, sampleRate, nFft, hopLength);
}
function spectralFlux(samples, sampleRate = 22050, nFft = 2048, hopLength = 512, lag = 1) {
  if (!(samples instanceof Float32Array)) {
    return spectralFlux(
      samples.samples,
      samples.sampleRate,
      samples.nFft,
      samples.hopLength,
      samples.lag
    );
  }
  return requireModule22().spectralFlux(samples, sampleRate, nFft, hopLength, lag);
}
function zeroCrossingRate(samples, sampleRate = 22050, frameLength = 2048, hopLength = 512) {
  if (!(samples instanceof Float32Array)) {
    return zeroCrossingRate(
      samples.samples,
      samples.sampleRate,
      samples.frameLength,
      samples.hopLength
    );
  }
  return requireModule22().zeroCrossingRate(samples, sampleRate, frameLength, hopLength);
}
function rmsEnergy(samples, sampleRate = 22050, frameLength = 2048, hopLength = 512) {
  if (!(samples instanceof Float32Array)) {
    return rmsEnergy(samples.samples, samples.sampleRate, samples.frameLength, samples.hopLength);
  }
  return requireModule22().rmsEnergy(samples, sampleRate, frameLength, hopLength);
}

// src/feature_spectrogram.ts
function requireModule23() {
  return getSonareModule();
}
function validateSpectrogramSamples(fnName, samples, sampleRate, options = {}) {
  assertSampleRate(fnName, sampleRate);
  assertSamples(fnName, samples, options.validate !== false);
}
function trim(samples, sampleRate = 22050, thresholdDb = -60, frameLengthOrOptions, hopLength, options = {}) {
  if (!(samples instanceof Float32Array)) {
    const r = samples;
    return trim(r.samples, r.sampleRate, r.thresholdDb, r.frameLength, r.hopLength, r);
  }
  if (frameLengthOrOptions === null) {
    throw new TypeError("trim: frameLength must be an integer or options object");
  }
  if (frameLengthOrOptions !== void 0 && typeof frameLengthOrOptions !== "number" && typeof frameLengthOrOptions !== "object") {
    throw new TypeError("trim: frameLength must be an integer or options object");
  }
  const positionalOptions = typeof frameLengthOrOptions === "object" && frameLengthOrOptions !== null ? frameLengthOrOptions : options;
  const positionalFrameLength = typeof frameLengthOrOptions === "number" ? frameLengthOrOptions : void 0;
  const resolvedFrameLength = positionalFrameLength ?? 2048;
  const resolvedHopLength = hopLength === void 0 ? 512 : hopLength;
  validateSpectrogramSamples("trim", samples, sampleRate, positionalOptions);
  assertFiniteScalar("trim", thresholdDb, "thresholdDb");
  assertPositiveInteger("trim", resolvedFrameLength, "frameLength");
  assertPositiveInteger("trim", resolvedHopLength, "hopLength");
  if (resolvedFrameLength > 2 ** 31 - 1 || resolvedHopLength > 2 ** 31 - 1) {
    throw new RangeError("trim: frameLength and hopLength must fit in a signed 32-bit integer");
  }
  return requireModule23().trimEx(
    samples,
    sampleRate,
    thresholdDb,
    resolvedFrameLength,
    resolvedHopLength
  );
}
function stft(samples, sampleRate = 22050, nFft = 2048, hopLength = 512, options = {}) {
  if (!(samples instanceof Float32Array)) {
    const request = samples;
    return stft(request.samples, request.sampleRate, request.nFft, request.hopLength, request);
  }
  validateSpectrogramSamples("stft", samples, sampleRate, options);
  const fft = resolveFftOptions("stft", nFft, hopLength);
  return requireModule23().stft(samples, sampleRate, fft.nFft, fft.hopLength);
}
function stftDb(samples, sampleRate = 22050, nFft = 2048, hopLength = 512, options = {}) {
  if (!(samples instanceof Float32Array)) {
    const request = samples;
    return stftDb(request.samples, request.sampleRate, request.nFft, request.hopLength, request);
  }
  validateSpectrogramSamples("stftDb", samples, sampleRate, options);
  const fft = resolveFftOptions("stftDb", nFft, hopLength);
  return requireModule23().stftDb(samples, sampleRate, fft.nFft, fft.hopLength);
}
function chromaCens(samples, sampleRate = 22050, hopLength = 512, nChroma = 12, binsPerOctave = 36, options = {}) {
  if (!(samples instanceof Float32Array)) {
    const request = samples;
    return chromaCens(
      request.samples,
      request.sampleRate,
      request.hopLength,
      request.nChroma,
      request.binsPerOctave,
      request
    );
  }
  validateSpectrogramSamples("chromaCens", samples, sampleRate, options);
  validatePositiveIntegers("chromaCens", { hopLength, nChroma, binsPerOctave });
  if (binsPerOctave % nChroma !== 0) {
    throw new RangeError("chromaCens: binsPerOctave must be a multiple of nChroma");
  }
  return requireModule23().chromaCens(samples, sampleRate, hopLength, nChroma, binsPerOctave);
}
function chromaCqt(samples, sampleRate = 22050, hopLength = 512, nChroma = 12, binsPerOctave = 36, options = {}) {
  if (!(samples instanceof Float32Array)) {
    const request = samples;
    return chromaCqt(
      request.samples,
      request.sampleRate,
      request.hopLength,
      request.nChroma,
      request.binsPerOctave,
      request
    );
  }
  validateSpectrogramSamples("chromaCqt", samples, sampleRate, options);
  validatePositiveIntegers("chromaCqt", { hopLength, nChroma, binsPerOctave });
  if (binsPerOctave % nChroma !== 0) {
    throw new RangeError("chromaCqt: binsPerOctave must be a multiple of nChroma");
  }
  return requireModule23().chromaCqt(samples, sampleRate, hopLength, nChroma, binsPerOctave);
}
function bassChroma(samples, sampleRate = 22050, hopLength = 512, nChroma = 12, options = {}) {
  if (!(samples instanceof Float32Array)) {
    const request = samples;
    return bassChroma(
      request.samples,
      request.sampleRate,
      request.hopLength,
      request.nChroma,
      request
    );
  }
  validateSpectrogramSamples("bassChroma", samples, sampleRate, options);
  validatePositiveIntegers("bassChroma", { hopLength, nChroma });
  return requireModule23().bassChroma(samples, sampleRate, hopLength, nChroma);
}
function melSpectrogram(samples, sampleRate = 22050, nFft = 2048, hopLength = 512, nMels = 128, fmin = 0, fmax = 0, htk = false, options = {}) {
  if (!(samples instanceof Float32Array)) {
    const request = samples;
    return melSpectrogram(
      request.samples,
      request.sampleRate,
      request.nFft,
      request.hopLength,
      request.nMels,
      request.fmin,
      request.fmax,
      request.htk,
      request
    );
  }
  validateSpectrogramSamples("melSpectrogram", samples, sampleRate, options);
  const fft = resolveFftOptions("melSpectrogram", nFft, hopLength);
  validatePositiveIntegers("melSpectrogram", { nMels });
  validateMelFrequencyRange("melSpectrogram", fmin, fmax, sampleRate);
  return requireModule23().melSpectrogram(
    samples,
    sampleRate,
    fft.nFft,
    fft.hopLength,
    nMels,
    fmin,
    fmax,
    htk
  );
}
function mfcc(samples, sampleRate = 22050, nFft = 2048, hopLength = 512, nMels = 128, nMfcc = 20, fmin = 0, fmax = 0, htk = false, lifter = 0, options = {}) {
  if (!(samples instanceof Float32Array)) {
    const request = samples;
    return mfcc(
      request.samples,
      request.sampleRate,
      request.nFft,
      request.hopLength,
      request.nMels,
      request.nMfcc,
      request.fmin,
      request.fmax,
      request.htk,
      request.lifter,
      request
    );
  }
  validateSpectrogramSamples("mfcc", samples, sampleRate, options);
  const fft = resolveFftOptions("mfcc", nFft, hopLength);
  validatePositiveIntegers("mfcc", { nMels, nMfcc });
  validateMelFrequencyRange("mfcc", fmin, fmax, sampleRate);
  return requireModule23().mfcc(
    samples,
    sampleRate,
    fft.nFft,
    fft.hopLength,
    nMels,
    nMfcc,
    fmin,
    fmax,
    htk,
    lifter
  );
}
function melDelta(features, nFeatures, nFrames, width = 9) {
  const request = features instanceof Float32Array ? { features, nFeatures: nFeatures ?? 0, nFrames: nFrames ?? 0, width } : features;
  assertPositiveInteger("melDelta", request.nFeatures, "nFeatures");
  assertPositiveInteger("melDelta", request.nFrames, "nFrames");
  assertPositiveInteger("melDelta", request.width ?? 9, "width");
  if ((request.width ?? 9) < 3 || (request.width ?? 9) % 2 === 0) {
    throw new RangeError("melDelta: width must be an odd integer of at least 3");
  }
  if (request.features.length !== request.nFeatures * request.nFrames) {
    throw new RangeError("melDelta: feature matrix length must equal nFeatures * nFrames");
  }
  return requireModule23().melDelta(
    request.features,
    request.nFeatures,
    request.nFrames,
    request.width ?? 9
  );
}
function reassignedSpectrogram(samples, sampleRate = 22050, nFft = 2048, hopLength = 512, refPower = 1e-6, fillNan = false) {
  if (!(samples instanceof Float32Array)) {
    const request = samples;
    return reassignedSpectrogram(
      request.samples,
      request.sampleRate,
      request.nFft,
      request.hopLength,
      request.refPower,
      request.fillNan
    );
  }
  assertSamples("reassignedSpectrogram", samples, true);
  assertSampleRate("reassignedSpectrogram", sampleRate);
  assertPositiveInteger("reassignedSpectrogram", nFft, "nFft");
  assertPositiveInteger("reassignedSpectrogram", hopLength, "hopLength");
  assertFiniteScalar("reassignedSpectrogram", refPower, "refPower");
  if (refPower < 0) {
    throw new RangeError("reassignedSpectrogram: refPower must be non-negative");
  }
  return requireModule23().reassignedSpectrogram(
    samples,
    sampleRate,
    nFft,
    hopLength,
    refPower,
    fillNan
  );
}
function chroma(samples, sampleRate = 22050, nFft = 2048, hopLength = 512, options = {}) {
  if (!(samples instanceof Float32Array)) {
    const request = samples;
    return chroma(request.samples, request.sampleRate, request.nFft, request.hopLength, request);
  }
  validateSpectrogramSamples("chroma", samples, sampleRate, options);
  const fft = resolveFftOptions("chroma", nFft, hopLength);
  return requireModule23().chroma(samples, sampleRate, fft.nFft, fft.hopLength);
}

// src/metering.ts
var DEFAULT_SPECTRUM_N_FFT = 2048;
function assertOversampleFactor(fnName, factor) {
  const normalized = factor === 0 ? 4 : factor;
  if (!Number.isInteger(normalized) || normalized < 1 || normalized > 16 || (normalized & normalized - 1) !== 0) {
    throw new SonareError(
      4 /* InvalidParameter */,
      "InvalidParameter",
      `${fnName}: oversampleFactor must be 0 or a power of two from 1 to 16`
    );
  }
}
function requireModule24() {
  return getSonareModule();
}
function meteringPeakDb(samples, sampleRate = 22050, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  assertSamples("meteringPeakDb", request.samples, request.validate !== false);
  return requireModule24().meteringPeakDb(request.samples, request.sampleRate ?? 22050);
}
function meteringRmsDb(samples, sampleRate = 22050, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  assertSamples("meteringRmsDb", request.samples, request.validate !== false);
  return requireModule24().meteringRmsDb(request.samples, request.sampleRate ?? 22050);
}
function meteringSilenceRatio(samples, sampleRate = 22050, thresholdDb = -45, frameLength = 1024, hopLength = 256, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, thresholdDb, frameLength, hopLength, ...options } : samples;
  assertSamples("meteringSilenceRatio", request.samples, request.validate !== false);
  return requireModule24().meteringSilenceRatio(
    request.samples,
    request.sampleRate ?? 22050,
    request.thresholdDb ?? -45,
    request.frameLength ?? 1024,
    request.hopLength ?? 256
  );
}
function meteringCrestFactorDb(samples, sampleRate = 22050, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  assertSamples("meteringCrestFactorDb", request.samples, request.validate !== false);
  return requireModule24().meteringCrestFactorDb(request.samples, request.sampleRate ?? 22050);
}
function meteringCrestFactorDbStereo(request) {
  assertSamples("meteringCrestFactorDbStereo", request.left, request.validate !== false);
  assertSamples("meteringCrestFactorDbStereo", request.right, request.validate !== false);
  return requireModule24().meteringCrestFactorDbStereo(
    request.left,
    request.right,
    request.sampleRate ?? 22050
  );
}
function meteringDcOffset(samples, sampleRate = 22050, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  assertSamples("meteringDcOffset", request.samples, request.validate !== false);
  return requireModule24().meteringDcOffset(request.samples, request.sampleRate ?? 22050);
}
function meteringTruePeakDb(samples, sampleRate = 22050, oversampleFactor = 4, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, oversampleFactor, ...options } : samples;
  assertSamples("meteringTruePeakDb", request.samples, request.validate !== false);
  const factor = request.oversampleFactor ?? 4;
  assertOversampleFactor("meteringTruePeakDb", factor);
  return requireModule24().meteringTruePeakDb(request.samples, request.sampleRate ?? 22050, factor);
}
function meteringDetectClipping(samples, sampleRate = 22050, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  assertSamples("meteringDetectClipping", request.samples, request.validate !== false);
  const minRegionSamples = request.minRegionSamples ?? 1;
  assertNonNegativeInteger("meteringDetectClipping", minRegionSamples, "minRegionSamples");
  return requireModule24().meteringDetectClipping(
    request.samples,
    request.sampleRate ?? 22050,
    request.threshold ?? 0.999,
    minRegionSamples
  );
}
function meteringDynamicRange(samples, sampleRate = 22050, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  assertSamples("meteringDynamicRange", request.samples, request.validate !== false);
  return requireModule24().meteringDynamicRange(
    request.samples,
    request.sampleRate ?? 22050,
    request.windowSec ?? 0,
    request.hopSec ?? 0,
    request.lowPercentile ?? -1,
    request.highPercentile ?? -1
  );
}
function meteringStereoCorrelation(left, right, sampleRate = 22050, options = {}) {
  const request = left instanceof Float32Array ? { left, right, sampleRate, ...options } : left;
  const validate = request.validate !== false;
  assertSamples("meteringStereoCorrelation", request.left, validate, "left");
  assertSamples("meteringStereoCorrelation", request.right, validate, "right");
  return requireModule24().meteringStereoCorrelation(
    request.left,
    request.right,
    request.sampleRate ?? 22050
  );
}
function meteringStereoWidth(left, right, sampleRate = 22050, options = {}) {
  const request = left instanceof Float32Array ? { left, right, sampleRate, ...options } : left;
  const validate = request.validate !== false;
  assertSamples("meteringStereoWidth", request.left, validate, "left");
  assertSamples("meteringStereoWidth", request.right, validate, "right");
  return requireModule24().meteringStereoWidth(
    request.left,
    request.right,
    request.sampleRate ?? 22050
  );
}
function meteringVectorscope(left, right, sampleRate = 22050, options = {}) {
  const request = left instanceof Float32Array ? { left, right, sampleRate, ...options } : left;
  const validate = request.validate !== false;
  assertSamples("meteringVectorscope", request.left, validate, "left");
  assertSamples("meteringVectorscope", request.right, validate, "right");
  return requireModule24().meteringVectorscopeDecimated(
    request.left,
    request.right,
    request.sampleRate ?? 22050,
    request.maxPoints ?? 0
  );
}
function meteringVectorscopeDecimated(left, right, sampleRate = 22050, maxPoints = 0, options = {}) {
  const request = left instanceof Float32Array ? { left, right, sampleRate, maxPoints, ...options } : left;
  const validate = request.validate !== false;
  assertSamples("meteringVectorscopeDecimated", request.left, validate, "left");
  assertSamples("meteringVectorscopeDecimated", request.right, validate, "right");
  return requireModule24().meteringVectorscopeDecimated(
    request.left,
    request.right,
    request.sampleRate ?? 22050,
    request.maxPoints ?? 0
  );
}
function meteringPhaseScope(left, right, sampleRate = 22050, options = {}) {
  const request = left instanceof Float32Array ? { left, right, sampleRate, ...options } : left;
  const validate = request.validate !== false;
  assertSamples("meteringPhaseScope", request.left, validate, "left");
  assertSamples("meteringPhaseScope", request.right, validate, "right");
  return requireModule24().meteringPhaseScopeDecimated(
    request.left,
    request.right,
    request.sampleRate ?? 22050,
    request.maxPoints ?? 0
  );
}
function meteringPhaseScopeDecimated(left, right, sampleRate = 22050, maxPoints = 0, options = {}) {
  const request = left instanceof Float32Array ? { left, right, sampleRate, maxPoints, ...options } : left;
  const validate = request.validate !== false;
  assertSamples("meteringPhaseScopeDecimated", request.left, validate, "left");
  assertSamples("meteringPhaseScopeDecimated", request.right, validate, "right");
  return requireModule24().meteringPhaseScopeDecimated(
    request.left,
    request.right,
    request.sampleRate ?? 22050,
    request.maxPoints ?? 0
  );
}
function meteringSpectrum(samples, sampleRate = 22050, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  assertSamples("meteringSpectrum", request.samples, request.validate !== false);
  return requireModule24().meteringSpectrum(request.samples, request.sampleRate ?? 22050, request);
}
function meteringSpectrumFrame(samples, sampleRate = 22050, frameOffset = 0, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, frameOffset, ...options } : samples;
  const nFft = request.nFft ?? 0;
  assertSamplesInWindow(
    "meteringSpectrumFrame",
    request.samples,
    request.validate !== false,
    request.frameOffset ?? 0,
    nFft > 0 ? nFft : DEFAULT_SPECTRUM_N_FFT
  );
  return requireModule24().meteringSpectrumFrame(
    request.samples,
    request.sampleRate ?? 22050,
    request.frameOffset ?? 0,
    request
  );
}
function waveformPeaks(samples, channels, options = {}) {
  const request = samples instanceof Float32Array ? { samples, channels, ...options } : samples;
  assertInterleavedSamples(
    "waveformPeaks",
    request.samples,
    request.channels,
    request.validate !== false
  );
  const samplesPerBucket = request.samplesPerBucket ?? 512;
  assertPositiveInteger("waveformPeaks", samplesPerBucket, "samplesPerBucket");
  return requireModule24().waveformPeaks(request.samples, request.channels, samplesPerBucket);
}
function waveformPeakPyramid(samples, channels, options = {}) {
  const request = samples instanceof Float32Array ? { samples, channels, ...options } : samples;
  assertInterleavedSamples(
    "waveformPeakPyramid",
    request.samples,
    request.channels,
    request.validate !== false
  );
  const levels = request.samplesPerBucketLevels ?? [512, 1024, 2048, 4096];
  if (levels.length === 0) {
    throw new RangeError("waveformPeakPyramid: samplesPerBucketLevels must not be empty");
  }
  levels.forEach((level, index) => {
    assertPositiveInteger("waveformPeakPyramid", level, `samplesPerBucketLevels[${index}]`);
  });
  return requireModule24().waveformPeakPyramid(request.samples, request.channels, levels);
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
  Sus2Add4: 16,
  Major6: 17,
  Minor6: 18,
  MinorMajor7: 19,
  Dominant7Sus4: 20,
  Dominant11: 21,
  Dominant13: 22,
  Dominant7Flat9: 23,
  Dominant7Sharp9: 24
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
      duration: c.end - c.start,
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
    form: wasm.form
  };
}

// src/quick_analysis.ts
function requireModule25() {
  return getSonareModule();
}
function validateAnalysisInput(fnName, samples, sampleRate, options = {}) {
  assertSampleRate(fnName, sampleRate);
  assertSamples(fnName, samples, options.validate !== false);
}
function detectBpm(samples, sampleRate = 22050, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  validateAnalysisInput("detectBpm", request.samples, request.sampleRate ?? 22050, request);
  return requireModule25().detectBpm(request.samples, request.sampleRate ?? 22050);
}
function detectKey(samples, sampleRate = 22050, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  validateAnalysisInput("detectKey", request.samples, request.sampleRate ?? 22050, request);
  const result = requireModule25()._detectKeyWithOptions(
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
function detectKeyCandidates(samples, sampleRate = 22050, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  validateAnalysisInput(
    "detectKeyCandidates",
    request.samples,
    request.sampleRate ?? 22050,
    request
  );
  const candidates = requireModule25()._detectKeyCandidates(
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
  return Array.from(candidates, convertKeyCandidate);
}
function detectOnsets(samples, sampleRate = 22050, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  validateAnalysisInput("detectOnsets", request.samples, request.sampleRate ?? 22050, request);
  return requireModule25().detectOnsets(request.samples, request.sampleRate ?? 22050, request);
}
function detectBeats(samples, sampleRate = 22050, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  validateAnalysisInput("detectBeats", request.samples, request.sampleRate ?? 22050, request);
  return requireModule25().detectBeats(request.samples, request.sampleRate ?? 22050);
}
function detectDownbeats(samples, sampleRate = 22050, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  validateAnalysisInput("detectDownbeats", request.samples, request.sampleRate ?? 22050, request);
  return requireModule25().detectDownbeats(request.samples, request.sampleRate ?? 22050);
}
function detectChords(samples, sampleRate = 22050, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  validateAnalysisInput("detectChords", request.samples, request.sampleRate ?? 22050, request);
  const result = requireModule25().detectChords(
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
function chordFunctionalAnalysis(samples, keyRoot, keyMode, sampleRate = 22050, options = {}) {
  const request = samples instanceof Float32Array ? { samples, keyRoot, keyMode, sampleRate, ...options } : samples;
  validateAnalysisInput(
    "chordFunctionalAnalysis",
    request.samples,
    request.sampleRate ?? 22050,
    request
  );
  return requireModule25().chordFunctionalAnalysis(
    request.samples,
    request.keyRoot,
    request.keyMode ?? Mode.Major,
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
    request.detectInversions ?? false,
    chordChromaMethodValue(request.chromaMethod ?? "stft"),
    request.tuning ?? 0
  );
}
function analyze(samples, sampleRate = 22050, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  validateAnalysisInput("analyze", request.samples, request.sampleRate ?? 22050, request);
  const result = requireModule25().analyze(request.samples, request.sampleRate ?? 22050, request);
  return convertAnalysisResult(result);
}
function estimateMeter(request) {
  return requireModule25().estimateMeter(request.beatTimes, request.beatStrengths, request);
}
function analyzeImpulseResponse(samples, sampleRate = 48e3, nOctaveBands = 6, minDecayDb) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, nOctaveBands, minDecayDb } : samples;
  const resolvedMinDecayDb = request.minDecayDb === void 0 ? 30 : request.minDecayDb;
  assertFiniteScalar("analyzeImpulseResponse", resolvedMinDecayDb, "minDecayDb");
  if (resolvedMinDecayDb <= 0) {
    throw new RangeError("analyzeImpulseResponse: minDecayDb must be greater than zero");
  }
  validateAnalysisInput(
    "analyzeImpulseResponse",
    request.samples,
    request.sampleRate ?? 48e3,
    request
  );
  const result = requireModule25().analyzeImpulseResponseEx(
    request.samples,
    request.sampleRate ?? 48e3,
    request.nOctaveBands ?? 6,
    resolvedMinDecayDb
  );
  return result;
}
function detectAcoustic(samples, sampleRate = 48e3, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  validateAnalysisInput("detectAcoustic", request.samples, request.sampleRate ?? 48e3, request);
  const result = requireModule25().detectAcoustic(
    request.samples,
    request.sampleRate ?? 48e3,
    request.nOctaveBands ?? 6,
    request.nThirdOctaveSubbands ?? 24,
    request.minDecayDb ?? 30,
    request.noiseFloorMarginDb ?? 10
  );
  return result;
}
function synthesizeRir(options = {}) {
  const module2 = requireModule25();
  if (typeof module2.synthesizeRir !== "function") {
    throw new Error("libsonare was built without acoustic-simulation support");
  }
  return module2.synthesizeRir(options);
}
function estimateRoom(samples, sampleRate = 48e3, options = {}) {
  const module2 = requireModule25();
  if (typeof module2.estimateRoom !== "function") {
    throw new Error("libsonare was built without acoustic-simulation support");
  }
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  validateAnalysisInput("estimateRoom", request.samples, request.sampleRate ?? 48e3, request);
  return module2.estimateRoom(request.samples, request.sampleRate ?? 48e3, request);
}
function roomMorph(samples, sampleRate, options = {}) {
  const module2 = requireModule25();
  if (typeof module2.roomMorph !== "function") {
    throw new Error("libsonare was built without acoustic-simulation support");
  }
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  validateAnalysisInput("roomMorph", request.samples, request.sampleRate, request);
  return module2.roomMorph(request.samples, request.sampleRate, request);
}
function analyzeWithProgress(samples, sampleRate = 22050, onProgress, options) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, onProgress, options } : samples;
  validateAnalysisInput(
    "analyzeWithProgress",
    request.samples,
    request.sampleRate ?? 22050,
    request
  );
  const result = requireModule25().analyzeWithProgress(
    request.samples,
    request.sampleRate ?? 22050,
    request.options ?? {},
    request.onProgress ?? (() => {
    }),
    request.cancel ?? (() => false)
  );
  return convertAnalysisResult(result);
}
function analyzeBpm(samples, sampleRate = 22050, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  validateAnalysisInput("analyzeBpm", request.samples, request.sampleRate ?? 22050, request);
  assertNonNegativeInteger("analyzeBpm", request.maxCandidates ?? 5, "maxCandidates");
  return requireModule25().analyzeBpm(
    request.samples,
    request.sampleRate ?? 22050,
    request.bpmMin ?? 30,
    request.bpmMax ?? 300,
    request.startBpm ?? 120,
    request.nFft ?? 2048,
    request.hopLength ?? 512,
    request.maxCandidates ?? 5
  );
}
function analyzeRhythm(samples, sampleRate = 22050, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  validateAnalysisInput("analyzeRhythm", request.samples, request.sampleRate ?? 22050, request);
  return requireModule25().analyzeRhythm(
    request.samples,
    request.sampleRate ?? 22050,
    request.bpmMin ?? 60,
    request.bpmMax ?? 200,
    request.startBpm ?? 120,
    request.nFft ?? 2048,
    request.hopLength ?? 512
  );
}
function analyzeDynamics(samples, sampleRate = 22050, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  validateAnalysisInput("analyzeDynamics", request.samples, request.sampleRate ?? 22050, request);
  return requireModule25().analyzeDynamics(
    request.samples,
    request.sampleRate ?? 22050,
    request.windowSec ?? 0.4,
    request.hopLength ?? 512,
    request.compressionThreshold ?? 6
  );
}
function analyzeTimbre(samples, sampleRate = 22050, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  validateAnalysisInput("analyzeTimbre", request.samples, request.sampleRate ?? 22050, request);
  return requireModule25().analyzeTimbre(
    request.samples,
    request.sampleRate ?? 22050,
    request.nFft ?? 2048,
    request.hopLength ?? 512,
    request.nMels ?? 128,
    request.nMfcc ?? 13,
    request.windowSec ?? 0.5
  );
}
function hasFfmpegSupport() {
  return requireModule25().hasFfmpegSupport();
}

// src/audio.ts
function encodedBytesToArrayBuffer(bytes) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}
function getBrowserAudioContextFactory() {
  const root = globalThis;
  const Ctor = root.AudioContext ?? root.webkitAudioContext;
  return Ctor ? (options) => new Ctor(options) : void 0;
}
function audioBufferToMono(buffer) {
  const samples = new Float32Array(buffer.length);
  if (buffer.numberOfChannels <= 0) {
    return samples;
  }
  if (buffer.numberOfChannels === 1) {
    samples.set(buffer.getChannelData(0));
    return samples;
  }
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < buffer.length; i++) {
      samples[i] += data[i] / buffer.numberOfChannels;
    }
  }
  return samples;
}
async function closeCreatedContext(context) {
  const maybeClosable = context;
  if (maybeClosable.close) {
    await maybeClosable.close();
  }
}
var Audio = class _Audio {
  constructor(samples, sampleRate) {
    this._samples = samples;
    this._sampleRate = sampleRate;
  }
  /**
   * Create an Audio instance from raw sample data.
   *
   * @param samples - Mono float samples.
   * @param sampleRate - Sample rate in Hz (default `48000`, matching the
   *   Node/Python surfaces).
   */
  static fromBuffer(samples, sampleRate = 48e3) {
    validateAudioBuffer(samples, sampleRate);
    return new _Audio(samples.slice(), sampleRate);
  }
  /**
   * Create an Audio instance by decoding audio bytes in memory.
   *
   * @param bytes - Encoded audio bytes such as WAV or MP3.
   */
  static fromMemory(bytes) {
    const decoded = getSonareModule().audioFromMemory(bytes);
    return new _Audio(decoded.samples, decoded.sampleRate);
  }
  /**
   * Decode audio bytes with the native WASM decoder first, then fall back to the
   * browser codec stack (`AudioContext.decodeAudioData`) for formats such as
   * AAC, OGG, and FLAC when available. Browser-decoded multi-channel audio is
   * mixed down to mono to match the `Audio` wrapper contract.
   */
  static async fromMemoryWithBrowserFallback(bytes, options = {}) {
    try {
      return _Audio.fromMemory(bytes);
    } catch (nativeError) {
      let createdContext = false;
      const contextFactory = options.createAudioContext ?? getBrowserAudioContextFactory();
      const context = options.audioContext ?? contextFactory?.(
        options.targetSampleRate ? { sampleRate: options.targetSampleRate } : void 0
      );
      if (!context) {
        throw new Error(
          `Audio.fromMemory failed and browser decodeAudioData is unavailable: ${nativeError instanceof Error ? nativeError.message : String(nativeError)}`
        );
      }
      createdContext = !options.audioContext;
      try {
        const decoded = await context.decodeAudioData(encodedBytesToArrayBuffer(bytes));
        return new _Audio(audioBufferToMono(decoded), decoded.sampleRate || context.sampleRate);
      } catch (fallbackError) {
        throw new Error(
          `Audio.fromMemory failed and browser decodeAudioData fallback failed: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`
        );
      } finally {
        if (createdContext) {
          await closeCreatedContext(context);
        }
      }
    }
  }
  /**
   * A copy of the raw audio samples. Mirrors Node's `getData()` contract: the
   * returned array is independent of the Audio's internal buffer, so mutating
   * it (or transferring it to a Worker) does not affect subsequent facade
   * calls, which all read the internal snapshot directly.
   */
  get data() {
    return this._samples.slice();
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
  chordFunctionalAnalysis(keyRoot, keyMode, options = {}) {
    return chordFunctionalAnalysis(this._samples, keyRoot, keyMode, this._sampleRate, options);
  }
  /**
   * Full music analysis of the held buffer.
   *
   * Takes the same option bag as the module-level {@link analyze} and as the
   * Node facade's `Audio.analyze`; this method used to drop it, so the same
   * call was tunable on one binding and fixed at the defaults on the other.
   */
  analyze(options = {}) {
    return analyze(this._samples, this._sampleRate, options);
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
  pitchCorrectToMidi(currentMidi = 69, targetMidi = 69) {
    return pitchCorrectToMidi(this._samples, this._sampleRate, currentMidi, targetMidi);
  }
  noteStretch(options = {}) {
    return noteStretch(this._samples, this._sampleRate, options);
  }
  noteMove(options = {}) {
    return noteMove(this._samples, this._sampleRate, options);
  }
  voiceChange(options = {}) {
    return voiceChange(this._samples, this._sampleRate, options);
  }
  normalize(targetDb = 0) {
    return normalize(this._samples, this._sampleRate, targetDb);
  }
  mastering(options = {}) {
    return mastering(this._samples, this._sampleRate, options);
  }
  masteringChain(config = {}, onProgress) {
    return masteringChain({
      samples: this._samples,
      sampleRate: this._sampleRate,
      config,
      onProgress
    });
  }
  masterAudio(presetName = "pop", overrides = null, onProgress) {
    return masterAudio({
      samples: this._samples,
      sampleRate: this._sampleRate,
      preset: presetName,
      overrides: overrides ?? {},
      onProgress
    });
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
  melSpectrogram(nFft = 2048, hopLength = 512, nMels = 128, fmin = 0, fmax = 0, htk = false) {
    return melSpectrogram(this._samples, this._sampleRate, nFft, hopLength, nMels, fmin, fmax, htk);
  }
  mfcc(nFft = 2048, hopLength = 512, nMels = 128, nMfcc = 20, fmin = 0, fmax = 0, htk = false) {
    return mfcc(this._samples, this._sampleRate, nFft, hopLength, nMels, nMfcc, fmin, fmax, htk);
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
  pitchYin(frameLength = 2048, hopLength = 512, fmin = 65, fmax = 2093, threshold = 0.1, fillNa = false) {
    return pitchYin(
      this._samples,
      this._sampleRate,
      frameLength,
      hopLength,
      fmin,
      fmax,
      threshold,
      fillNa
    );
  }
  pitchPyin(frameLength = 2048, hopLength = 512, fmin = 65, fmax = 2093, threshold = 0.1, fillNa = false) {
    return pitchPyin(
      this._samples,
      this._sampleRate,
      frameLength,
      hopLength,
      fmin,
      fmax,
      threshold,
      fillNa
    );
  }
  resample(targetSr) {
    return resample(this._samples, this._sampleRate, targetSr);
  }
  // -- Metering --
  //
  // These delegate to the module-level buffer-form functions rather than a
  // native handle: WASM's Audio is a plain JS wrapper around a Float32Array,
  // not an embind class, so there is no cheaper path to reach the same
  // measurement. The methods exist for call-shape parity with Node/Python,
  // which do hold a native handle here.
  peakDb() {
    return meteringPeakDb(this._samples, this._sampleRate);
  }
  rmsDb() {
    return meteringRmsDb(this._samples, this._sampleRate);
  }
  dcOffset() {
    return meteringDcOffset(this._samples, this._sampleRate);
  }
  crestFactorDb() {
    return meteringCrestFactorDb(this._samples, this._sampleRate);
  }
  silenceRatio(thresholdDb = -45, frameLength = 1024, hopLength = 256) {
    return meteringSilenceRatio(
      this._samples,
      this._sampleRate,
      thresholdDb,
      frameLength,
      hopLength
    );
  }
  /**
   * Inter-sample (true) peak in dBFS. `oversampleFactor` must be a power of two
   * in [1, 16]; pass 0 to use the library default (4).
   */
  truePeakDb(oversampleFactor = 4) {
    return meteringTruePeakDb(this._samples, this._sampleRate, oversampleFactor);
  }
  detectClipping(options = {}) {
    return meteringDetectClipping(this._samples, this._sampleRate, options);
  }
  dynamicRange(options = {}) {
    return meteringDynamicRange(this._samples, this._sampleRate, options);
  }
  spectrum(options = {}) {
    return meteringSpectrum(this._samples, this._sampleRate, options);
  }
  /**
   * True single-frame magnitude / power / dB spectrum starting at `frameOffset`.
   * See {@link meteringSpectrumFrame} for the frame-validation contract.
   */
  spectrumFrame(frameOffset = 0, options = {}) {
    return meteringSpectrumFrame(this._samples, this._sampleRate, frameOffset, options);
  }
  ebur128LoudnessRange() {
    return ebur128LoudnessRange(this._samples, this._sampleRate);
  }
};

// src/opfs_clip_pages.ts
var opfsClipPageWorkerSource = `
const sonareClipPageReadQueues = new Map();

function sonareEnqueueClipPageRead(key, task) {
  const previous = sonareClipPageReadQueues.get(key) || Promise.resolve();
  const next = previous.catch(() => undefined).then(task);
  const queued = next.finally(() => {
    if (sonareClipPageReadQueues.get(key) === queued) {
      sonareClipPageReadQueues.delete(key);
    }
  });
  sonareClipPageReadQueues.set(key, queued);
  return next;
}

self.onmessage = async (event) => {
  const message = event.data;
  if (!message || message.type !== 'sonare:read-clip-page') return;
  const { requestId, path, pageIndex, numChannels, numSamples, pageFrames, dataOffsetBytes = 0 } = message;
  await sonareEnqueueClipPageRead(String(path), async () => {
  try {
    if (pageIndex < 0) {
      self.postMessage({ type: 'sonare:clip-page', requestId, pageIndex, ok: false });
      return;
    }
    const startFrame = pageIndex * pageFrames;
    if (startFrame >= numSamples) {
      self.postMessage({ type: 'sonare:clip-page', requestId, pageIndex, ok: false });
      return;
    }
    const root = await self.navigator.storage.getDirectory();
    let dir = root;
    const parts = String(path).split('/').filter(Boolean);
    for (let i = 0; i < parts.length - 1; ++i) {
      dir = await dir.getDirectoryHandle(parts[i]);
    }
    const fileHandle = await dir.getFileHandle(parts[parts.length - 1]);
    const access = await fileHandle.createSyncAccessHandle();
    try {
      const frames = Math.min(pageFrames, numSamples - startFrame);
      const frameBytes = numChannels * 4;
      const bytes = new Uint8Array(frames * frameBytes);
      let bytesReadTotal = 0;
      const readOffset = dataOffsetBytes + startFrame * frameBytes;
      while (bytesReadTotal < bytes.byteLength) {
        const bytesRead = access.read(bytes.subarray(bytesReadTotal), {
          at: readOffset + bytesReadTotal,
        });
        if (bytesRead <= 0) {
          break;
        }
        bytesReadTotal += bytesRead;
      }
      if (bytesReadTotal !== bytes.byteLength || bytesReadTotal % frameBytes !== 0) {
        self.postMessage({ type: 'sonare:clip-page', requestId, pageIndex, ok: false });
        return;
      }
      const framesRead = bytesReadTotal / frameBytes;
      const view = new DataView(bytes.buffer, 0, framesRead * frameBytes);
      const channelBuffers = Array.from({ length: numChannels }, () => new ArrayBuffer(framesRead * 4));
      for (let ch = 0; ch < numChannels; ++ch) {
        const channel = new Float32Array(channelBuffers[ch]);
        for (let frame = 0; frame < framesRead; ++frame) {
          channel[frame] = view.getFloat32((frame * numChannels + ch) * 4, true);
        }
      }
      self.postMessage(
        { type: 'sonare:clip-page', requestId, pageIndex, ok: true, frames: framesRead, channelBuffers },
        channelBuffers,
      );
    } finally {
      access.close();
    }
  } catch (error) {
    self.postMessage({
      type: 'sonare:clip-page',
      requestId,
      pageIndex,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  });
};
`;
function createOpfsClipPageWorker() {
  const blob = new Blob([opfsClipPageWorkerSource], { type: "text/javascript" });
  const url = URL.createObjectURL(blob);
  try {
    return new Worker(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}
function createOpfsClipPageProvider(engine, options) {
  if (options.numChannels <= 0 || options.numSamples <= 0 || options.pageFrames <= 0) {
    throw new Error("numChannels, numSamples, and pageFrames must be positive");
  }
  const provider = engine.createClipPageProvider(
    options.numChannels,
    options.numSamples,
    options.pageFrames
  );
  const worker = options.worker ?? createOpfsClipPageWorker();
  const ownsWorker = options.worker === void 0 || options.terminateWorkerOnClose === true;
  let nextRequestId = 1;
  let closed = false;
  let readQueue = Promise.resolve();
  const pending = /* @__PURE__ */ new Map();
  const onMessage = (event) => {
    const response = event.data;
    if (response?.type !== "sonare:clip-page") {
      return;
    }
    const entry = pending.get(response.requestId);
    if (!entry) {
      return;
    }
    pending.delete(response.requestId);
    if (!response.ok) {
      entry.resolve(false);
      return;
    }
    const channels = response.channels ?? response.channelBuffers?.map(
      (buffer) => new Float32Array(buffer, 0, response.frames ?? buffer.byteLength / 4)
    );
    if (!channels || channels.length === 0) {
      entry.resolve(false);
      return;
    }
    try {
      provider.supply(response.pageIndex, channels);
      options.onPageSupplied?.(response.pageIndex, channels);
    } catch {
      entry.resolve(false);
      return;
    }
    entry.resolve(true);
  };
  worker.addEventListener("message", onMessage);
  const supplyPage = (pageIndex) => {
    if (closed) {
      return Promise.reject(new Error("OpfsClipPageProvider is closed"));
    }
    const requestId = nextRequestId++;
    const promise = new Promise((resolve, reject) => {
      pending.set(requestId, { resolve, reject });
    });
    readQueue = readQueue.catch(() => void 0).then(() => {
      if (closed) {
        const entry = pending.get(requestId);
        pending.delete(requestId);
        entry?.reject(new Error("OpfsClipPageProvider is closed"));
        return;
      }
      worker.postMessage({
        type: "sonare:read-clip-page",
        requestId,
        path: options.path,
        pageIndex,
        numChannels: options.numChannels,
        numSamples: options.numSamples,
        pageFrames: options.pageFrames,
        dataOffsetBytes: options.dataOffsetBytes ?? 0
      });
      return promise.then(
        () => void 0,
        () => void 0
      );
    });
    readQueue.catch(() => {
    });
    return promise;
  };
  return {
    provider,
    supplyPage,
    supplyRequest(request) {
      return supplyPage(Math.floor(request.sample / options.pageFrames));
    },
    clearPage(pageIndex) {
      if (closed) {
        return;
      }
      provider.clear(pageIndex);
      options.onPageCleared?.(pageIndex);
    },
    close() {
      if (closed) {
        return;
      }
      closed = true;
      worker.removeEventListener("message", onMessage);
      for (const entry of pending.values()) {
        entry.reject(new Error("OpfsClipPageProvider is closed"));
      }
      pending.clear();
      provider.destroy();
      options.onClose?.();
      if (ownsWorker) {
        worker.terminate();
      }
    }
  };
}

// src/clip_page_streamer.ts
var ClipPageStreamer = class {
  constructor(engine, options = {}) {
    this.sources = /* @__PURE__ */ new Map();
    this.closed = false;
    this.engine = engine;
    this.readAheadPages = Math.max(0, Math.floor(options.readAheadPages ?? 2));
    this.retainBehindPages = Math.max(0, Math.floor(options.retainBehindPages ?? 1));
    this.maxRequestsPerPump = Math.max(1, Math.floor(options.maxRequestsPerPump ?? 256));
  }
  /**
   * Register a paged clip. Pages already supplied to the provider before
   * registration (for example a primed first page) should be passed in
   * `initialResidentPages` so they participate in eviction.
   */
  addSource(source, initialResidentPages = []) {
    if (source.pageFrames <= 0 || source.numSamples <= 0) {
      throw new Error("pageFrames and numSamples must be positive");
    }
    const lastPage = Math.ceil(source.numSamples / source.pageFrames) - 1;
    const previous = this.sources.get(source.clipId);
    if (previous) {
      this.resetState(previous);
    }
    this.sources.set(source.clipId, {
      source,
      lastPage,
      generation: 0,
      lastFrontier: null,
      resident: new Map(Array.from(initialResidentPages, (page) => [page, 0]))
    });
  }
  /** Stop tracking a clip. Does not close its binding (the caller owns that). */
  removeSource(clipId) {
    const state = this.sources.get(clipId);
    if (state) {
      this.resetState(state);
    }
    this.sources.delete(clipId);
  }
  /**
   * Explicitly start a new playback generation after a host seek/loop. Resident
   * pages are evicted and any older in-flight fetch is cleared when it settles.
   * The next miss establishes the new bounded window.
   */
  resetSource(clipId) {
    const state = this.sources.get(clipId);
    if (state) {
      this.resetState(state);
    }
  }
  /**
   * Drain pending page-miss requests, fetch the missing pages plus their
   * read-ahead window, and evict out-of-window pages. Resolves once this round's
   * fetches settle. Concurrent fetches are serialized inside each binding.
   */
  async pump() {
    if (this.closed) {
      return;
    }
    const frontiers = /* @__PURE__ */ new Map();
    for (let drained = 0; drained < this.maxRequestsPerPump; ++drained) {
      const request = this.engine.popClipPageRequest();
      if (!request) {
        break;
      }
      const state = this.sources.get(request.clipId);
      if (!state) {
        continue;
      }
      const page = request.pageIndex !== void 0 ? request.pageIndex : Math.floor((request.sample ?? Number.NaN) / state.source.pageFrames);
      if (!Number.isInteger(page) || page < 0 || page > state.lastPage) {
        continue;
      }
      frontiers.set(request.clipId, page);
    }
    const fetches = [];
    for (const [clipId, frontier] of frontiers) {
      const state = this.sources.get(clipId);
      if (!state) {
        continue;
      }
      fetches.push(...this.serviceFrontier(state, frontier));
    }
    await Promise.all(fetches);
  }
  /** Close every registered clip's binding and stop tracking. */
  close() {
    if (this.closed) {
      return;
    }
    this.closed = true;
    for (const state of this.sources.values()) {
      this.resetState(state);
      state.source.binding.close();
    }
    this.sources.clear();
  }
  serviceFrontier(state, frontier) {
    if (state.lastFrontier !== null && frontier < state.lastFrontier) {
      this.resetState(state);
    }
    state.lastFrontier = frontier;
    const generation = state.generation;
    const low = Math.max(0, frontier - this.retainBehindPages);
    const high = Math.min(state.lastPage, frontier + this.readAheadPages);
    for (const page of state.resident.keys()) {
      if (page < low || page > high) {
        this.clearPage(state, page);
        state.resident.delete(page);
      }
    }
    const fetches = [];
    for (let page = low; page <= high; ++page) {
      if (state.resident.get(page) === generation) {
        continue;
      }
      state.resident.set(page, generation);
      const pageIndex = page;
      fetches.push(
        state.source.binding.supplyPage(pageIndex).then(
          (ok) => {
            if (state.generation !== generation) {
              this.clearPage(state, pageIndex);
            } else if (!ok && state.resident.get(pageIndex) === generation) {
              state.resident.delete(pageIndex);
            }
            return ok;
          },
          (error) => {
            if (state.resident.get(pageIndex) === generation) {
              state.resident.delete(pageIndex);
            }
            throw error;
          }
        )
      );
    }
    return fetches;
  }
  resetState(state) {
    state.generation += 1;
    state.lastFrontier = null;
    for (const page of state.resident.keys()) {
      this.clearPage(state, page);
    }
    state.resident.clear();
  }
  clearPage(state, pageIndex) {
    if (state.source.binding.clearPage) {
      state.source.binding.clearPage(pageIndex);
    } else {
      state.source.binding.provider.clear(pageIndex);
    }
  }
};
async function attachOpfsClipStream(streamerOrEngine, engineOrOptions, maybeOptions) {
  if (!(streamerOrEngine instanceof ClipPageStreamer)) {
    return streamerOrEngine.attachOpfsClipStream(engineOrOptions);
  }
  const streamer = streamerOrEngine;
  const engine = engineOrOptions;
  const options = maybeOptions;
  if (!options) {
    throw new Error("attachOpfsClipStream requires options.");
  }
  const { clipId, primePages = 1, ...providerOptions } = options;
  const binding = createOpfsClipPageProvider(engine, providerOptions);
  const lastPage = Math.ceil(providerOptions.numSamples / providerOptions.pageFrames) - 1;
  const primed = [];
  for (let page = 0; page < primePages && page <= lastPage; ++page) {
    if (await binding.supplyPage(page)) {
      primed.push(page);
    }
  }
  streamer.addSource(
    {
      clipId,
      binding,
      pageFrames: providerOptions.pageFrames,
      numSamples: providerOptions.numSamples
    },
    primed
  );
  return { binding, provider: binding.provider };
}

// src/live_audio.ts
async function bindMicrophoneInput(context, engine, options = {}) {
  const { stream: providedStream, stopTracksOnClose: stopTracksOverride, ...constraints } = options;
  const ownsStream = providedStream === void 0;
  const stopTracksOnClose = stopTracksOverride ?? ownsStream;
  const stream = providedStream ?? await navigator.mediaDevices.getUserMedia({
    ...constraints,
    audio: constraints.audio ?? true,
    video: constraints.video ?? false
  });
  const source = context.createMediaStreamSource(stream);
  const node = "node" in engine ? engine.node : engine;
  source.connect(node);
  let closed = false;
  return {
    stream,
    source,
    ownsStream,
    close() {
      if (closed) {
        return;
      }
      closed = true;
      source.disconnect();
      if (stopTracksOnClose) {
        for (const track of stream.getAudioTracks()) {
          track.stop();
        }
      }
    }
  };
}

// src/mixing_assistant.ts
function requireModule26() {
  return getSonareModule();
}
function planarTracks(tracks) {
  if (!Array.isArray(tracks)) {
    throw new Error("tracks must be an array.");
  }
  const left = [];
  const right = [];
  const ids = [];
  const names = [];
  for (let index = 0; index < tracks.length; index++) {
    const track = tracks[index];
    if (track === null || typeof track !== "object") {
      throw new Error(`tracks[${index}] must be an object.`);
    }
    if (typeof track.id !== "string" || track.id.length === 0) {
      throw new Error(`tracks[${index}].id must be a non-empty string.`);
    }
    if (!(track.left instanceof Float32Array)) {
      throw new Error(`tracks[${index}].left must be a Float32Array.`);
    }
    if (track.right !== void 0 && !(track.right instanceof Float32Array)) {
      throw new Error(`tracks[${index}].right must be a Float32Array when present.`);
    }
    left.push(track.left);
    right.push(track.right ?? null);
    ids.push(track.id);
    names.push(track.name ?? null);
  }
  return { left, right, ids, names };
}
function suggestJson(fnName, request, sceneOnly) {
  assertSampleRate(fnName, request.sampleRate);
  const { left, right, ids, names } = planarTracks(request.tracks);
  const sampleRate = request.sampleRate;
  const params = request.options ?? {};
  const module2 = requireModule26();
  return sceneOnly ? module2.mixingAssistantSuggestSceneJson(left, right, ids, names, sampleRate, params) : module2.mixingAssistantSuggest(left, right, ids, names, sampleRate, params);
}
function suggestMixScene(request) {
  return JSON.parse(suggestJson("suggestMixScene", request, false));
}
function suggestMixSceneJson(request) {
  return suggestJson("suggestMixSceneJson", request, true);
}
function mixSourceClassNames() {
  return Array.from(requireModule26().mixingAssistantSourceClassNames());
}
function mixSourceClassFromName(name) {
  return requireModule26().mixingAssistantSourceClassFromName(name);
}

// src/polyphony.ts
var PolyphonicAnalysis = class {
  /** Analyses the request's audio. {@link analyzePolyphonic} is the same call. */
  constructor(request) {
    assertSamples("analyzePolyphonic", request.samples, request.validate !== false);
    assertSampleRate("analyzePolyphonic", request.sampleRate);
    const module2 = getSonareModule();
    this.native = module2.createPolyphonicAnalysis(
      request.samples,
      request.sampleRate,
      request
    );
  }
  handle() {
    if (this.native === null) {
      throw new SonareError(
        7 /* InvalidState */,
        "InvalidState",
        "PolyphonicAnalysis has been released"
      );
    }
    return this.native;
  }
  /** Number of notes, which is also the number of claim sets. */
  get noteCount() {
    return this.handle().noteCount;
  }
  /** Number of STFT frames the analysis ran over. */
  get frameCount() {
    return this.handle().frameCount;
  }
  /**
   * Every note, in the order their claim sets are held in — the same
   * {@link NoteObject} shape `extractNotes` returns, so a host that edits through
   * both doors sees one note.
   *
   * Each note carries its sample span, its frame span (in the analysis's own
   * framing), its median pitch, its steadiness, its per-frame `amplitude` and its
   * pending edit. The curves a note does not carry inline have their own accessors:
   * {@link noteF0}, {@link noteSalience}, and {@link noteEnvelope} for the points
   * last set through {@link setNoteEdit}. `amplitude` is {@link noteAmplitude}'s
   * curve, read once per note.
   */
  notes() {
    return this.handle().notes();
  }
  /**
   * Replaces one note's pending edit.
   *
   * The only thing a host writes. Everything else on a note is a measurement, and
   * the order is the pairing with the claim sets, so neither is settable.
   *
   * An omitted field is the identity, so `{}` restores the identity edit. The
   * envelope is `edit.amplitudeEnvelope`, which the handle copies, and its points
   * are per-frame linear gains over the note's span on top of `gainDb` — stretched
   * over whatever length the note renders at, so one entry is a constant gain and
   * the count need not match the note's frame count. Every value must be finite
   * and non-negative, which {@link render} is where it is checked, so one refusal
   * names one place.
   *
   * @param note - Index below {@link noteCount}
   * @throws {SonareError} `InvalidParameter` when `note` is out of range
   */
  setNoteEdit(note, edit) {
    this.handle().setNoteEdit(note, edit);
  }
  /**
   * Voices estimated per frame, before tracking dropped anything — one entry per
   * frame from frame 0.
   *
   * What the estimation saw rather than what survived: a frame reported as three
   * voices with two notes spanning it is the difference between the two stages,
   * which is the figure a host deciding what to edit wants.
   */
  polyphony() {
    return this.handle().polyphony();
  }
  /**
   * One note's F0 in Hz, per frame over its own span.
   *
   * `frameEnd - frameStart` entries, so the value at index `i` belongs to frame
   * `frameStart + i`. This is the curve the monophonic door makes a caller pass
   * back in; here the handle already holds it, so a curve edit needs nothing from
   * the caller.
   *
   * @throws {SonareError} `InvalidParameter` when `note` is out of range
   */
  noteF0(note) {
    return this.handle().noteF0(note);
  }
  /** One note's linear RMS, per frame over its own span. Indexed as {@link noteF0}. */
  noteAmplitude(note) {
    return this.handle().noteAmplitude(note);
  }
  /**
   * One note's salience, per frame over its own span. Indexed as {@link noteF0},
   * and the one curve here that is not the note's own: it is the tracked ridge's,
   * so a frame of the note the ridge does not reach reads 0.
   *
   * Salience is what the estimation scored the candidate at, so it says how well
   * the material supported this note rather than how loud the note is —
   * {@link noteAmplitude} is the loud.
   */
  noteSalience(note) {
    return this.handle().noteSalience(note);
  }
  /**
   * The stretch fitted for each note, one entry per note in {@link notes}' order.
   *
   * Empty when `estimateInharmonicity` was not set, so an empty array means the
   * fit was never asked for. A non-negative entry is a fitted stretch; **exactly
   * `-1` is the refusal**, and a refused note's claims were placed at the
   * `inharmonicity` the request declared instead.
   *
   * **`0` is a fitted result and means the harmonic series**, which is why the
   * refusal is reported at all: the declared stretch also defaults to 0, so the
   * effective value alone cannot separate a fit that reached the material from one
   * that did not. The fit refuses a chord at the default framing, so the
   * distinction is the usual case rather than an edge one.
   *
   * @example
   * ```typescript
   * const analysis = analyzePolyphonic({ samples, sampleRate, estimateInharmonicity: true });
   * const fitted = analysis.noteInharmonicity();
   * const reached = [...fitted].filter((stretch) => stretch >= 0).length;
   * ```
   */
  noteInharmonicity() {
    return this.handle().noteInharmonicity();
  }
  /**
   * One note's amplitude envelope points, as last set — the same array
   * `notes()[note].edit.amplitudeEnvelope` carries.
   *
   * Indexed from 0 rather than over the note's span: an envelope is a set of gain
   * points stretched over whatever length the note renders at, not a per-frame
   * signal. The only one of the four curves that is not a measurement, and empty on
   * a note carrying no envelope.
   */
  noteEnvelope(note) {
    return this.handle().noteEnvelope(note);
  }
  /**
   * Renders the analysis back to audio with whatever edits its notes carry, at the
   * source's length.
   *
   * Each note's claimed share is inverted, edited, and added to the residual — the
   * part of the input no note claimed. With every edit identity the result is the
   * analysis's own round trip, not the source bit for bit, the STFT round trip's
   * error being neither added to nor removed here.
   *
   * The render is additive per note with no cross-note term, so an unedited note's
   * contribution is identical between two renders. That is also the limit: a host
   * cannot tell from two renders whether a claim set divided the energy correctly.
   *
   * @throws {SonareError} `InvalidParameter` on an option or an edit field the
   *   renderer rejects — a non-positive stretch ratio, a negative or non-finite
   *   envelope point, or a vibrato or drift edit on a note carrying no usable
   *   pitch curve
   */
  render(options = {}) {
    return this.handle().render(options);
  }
  /**
   * Releases the underlying WASM object and everything it holds. A second call
   * throws `InvalidState` rather than freeing twice.
   */
  delete() {
    const native = this.handle();
    this.native = null;
    native.delete();
  }
  /** Alias for {@link delete}, provided for cross-binding (Node) compatibility. */
  destroy() {
    this.delete();
  }
};
function analyzePolyphonic(request) {
  return new PolyphonicAnalysis(request);
}

// src/instrument_types.ts
var BUILTIN_SYNTH_WAVEFORMS = ["sine", "saw", "sawtooth", "square", "triangle"];
var SYNTH_ENGINE_MODES = [
  "default",
  "subtractive",
  "fm",
  "karplus-strong",
  "modal",
  "additive",
  "percussion",
  "piano",
  "pipe-organ",
  "bowed-string",
  "reed",
  "brass",
  "flute",
  "plucked-string",
  "vocal",
  "free-reed",
  "harpsichord",
  "sample"
];
var SAMPLE_LOOP_MODES = ["default", "none", "continuous", "key-down"];
var SAMPLE_KEY_TRACKS = ["default", "on", "off"];
var SYNTH_RETRIGGERS = ["default", "free", "note"];
var SYNTH_OSC_WAVEFORMS = [
  "default",
  "sine",
  "saw",
  "square",
  "triangle",
  "noise"
];
var SYNTH_FILTER_MODELS = [
  "default",
  "svf",
  "moog-ladder",
  "diode-ladder",
  "sallen-key"
];
var SYNTH_FILTER_OUTPUTS = ["default", "lowpass", "bandpass", "highpass"];
var SYNTH_BODY_TYPES = [
  "default",
  "none",
  "guitar",
  "violin",
  "wood-tube",
  "brass-bell",
  "vocal"
];
var SYNTH_MOD_SOURCES = [
  "none",
  "amp-env",
  "filter-env",
  "lfo1",
  "lfo2",
  "velocity",
  "key-track",
  "mod-wheel",
  "random",
  "breath",
  "aftertouch",
  "expression-cc",
  "pitch-bend"
];
var SYNTH_MOD_DESTINATIONS = [
  "none",
  "pitch-cents",
  "cutoff-cents",
  "amp-gain",
  "pan-units",
  "resonance-q",
  "vibrato-depth-cents",
  "filter-env-depth",
  "lfo1-rate-scale",
  "excitation-force",
  "excitation-position",
  "excitation-brightness",
  "spectrum-morph"
];
var CONTROLLER_INPUTS = [
  "control-change",
  "channel-pressure",
  "poly-pressure",
  "pitch-bend",
  "velocity"
];
var CONTROLLER_AXES = [
  "none",
  "excitation",
  "position",
  "brightness",
  "morph",
  "loudness",
  "pitch-cents",
  "vibrato-depth"
];
var ARTICULATIONS = ["poly", "mono-retrigger", "mono-legato"];
var MPE_DIMENSIONS = ["bend", "pressure", "timbre"];
var NOTE_TRACKINGS = ["last", "lowest", "highest", "all"];

// src/project_class.ts
function normalizeMidiFxBakeRequest(clipIdOrRequest, configJson) {
  if (typeof clipIdOrRequest === "number") {
    return {
      clipId: clipIdOrRequest,
      configJson: configJson ?? "",
      withSourceIndex: false
    };
  }
  return {
    clipId: clipIdOrRequest.clipId,
    configJson: clipIdOrRequest.configJson,
    withSourceIndex: clipIdOrRequest.withSourceIndex ?? false
  };
}
function validateAssistSidecarUint32(value, field) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > 4294967295) {
    throw new RangeError(`Project.setAssistSidecar: ${field} must be a uint32`);
  }
  return value;
}
function validateAssistSidecarPpq(value, field) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new RangeError(
      `Project.setAssistSidecar: ${field} must be a finite, non-negative number`
    );
  }
  return value;
}
function validateAssistSidecarPayload(value) {
  if (!(value instanceof Uint8Array)) {
    throw new TypeError("Project.setAssistSidecar: payload must be a Uint8Array");
  }
  return value;
}
function validateAssistSidecarModuleId(value) {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError("Project.setAssistSidecar: moduleId must be a non-empty string");
  }
  return value;
}
var Project = class _Project {
  constructor() {
    this.native = new (projectModule()).Project();
  }
  /** Create a new empty project. */
  static create() {
    return new _Project();
  }
  /** Pack a MIDI 1.0 note-on event accepted by {@link setMidiEvents}. */
  static midiNoteOn(ppq, group, channel, note, velocity) {
    return projectMidi1Event("Project.midiNoteOn", ppq, group, 9, channel, note, velocity);
  }
  /** Pack a MIDI 1.0 note-off event accepted by {@link setMidiEvents}. */
  static midiNoteOff(ppq, group, channel, note, velocity = 0) {
    return projectMidi1Event("Project.midiNoteOff", ppq, group, 8, channel, note, velocity);
  }
  /** Pack a MIDI 1.0 control-change event. */
  static midiCc(ppq, group, channel, controller, value) {
    return projectMidi1Event("Project.midiCc", ppq, group, 11, channel, controller, value);
  }
  /** Pack a MIDI 1.0 poly-pressure event. */
  static midiPolyPressure(ppq, group, channel, note, pressure) {
    return projectMidi1Event("Project.midiPolyPressure", ppq, group, 10, channel, note, pressure);
  }
  /** Pack a MIDI 1.0 program-change event. */
  static midiProgram(ppq, group, channel, program) {
    return projectMidi1Event("Project.midiProgram", ppq, group, 12, channel, program, 0);
  }
  /** Return the General MIDI instrument name for `program`, or `null` when out of range. */
  static gmInstrumentName(program) {
    return projectModule().midiGmInstrumentName(program);
  }
  /** Return the General MIDI program number for a canonical instrument name, or `-1`. */
  static gmProgramForName(name) {
    return projectModule().midiGmProgramForName(name);
  }
  /** Return the General MIDI family name for `family`, or `null` when out of range. */
  static gmFamilyName(family) {
    return projectModule().midiGmFamilyName(family);
  }
  /** Return the first General MIDI program number in `family`, or `-1`. */
  static gmFamilyFirstProgram(family) {
    return projectModule().midiGmFamilyFirstProgram(family);
  }
  /** Return the GM2 bank/program instrument variation name, or `null` when unavailable. */
  static gm2InstrumentName(bankLsb, program) {
    return projectModule().midiGm2InstrumentName(bankLsb, program);
  }
  /** Return the General MIDI drum name for `note`, or `null` when out of range. */
  static gmDrumName(note) {
    return projectModule().midiGmDrumName(note);
  }
  /** Return the General MIDI drum note for a canonical drum name, or `-1`. */
  static gmDrumNoteForName(name) {
    return projectModule().midiGmDrumNoteForName(name);
  }
  /** Return the GM2 drum-set name for `bankLsb`, or `null` when unavailable. */
  static gm2DrumSetName(bankLsb) {
    return projectModule().midiGm2DrumSetName(bankLsb);
  }
  /** Return the GM2 drum name for `bankLsb`/`note`, or `null` when unavailable. */
  static gm2DrumName(bankLsb, note) {
    return projectModule().midiGm2DrumName(bankLsb, note);
  }
  /** Return the MIDI CC name for `controller`, or `null` when out of range. */
  static midiCcName(controller) {
    return projectModule().midiCcName(controller);
  }
  /** Return the MIDI CC number for a canonical controller name, or `-1`. */
  static midiCcIndexForName(name) {
    return projectModule().midiCcIndexForName(name);
  }
  /** Return the MIDI 2.0 per-note controller name for `index`, or `null`. */
  static perNoteControllerName(index) {
    return projectModule().midiPerNoteControllerName(index);
  }
  /** Expand bank-select + program-change into MIDI events accepted by {@link setMidiEvents}. */
  static midiBankProgram(ppq, group, channel, bankMsb, bankLsb, program) {
    return projectModule().midiBankProgram(ppq, group, channel, bankMsb, bankLsb, program);
  }
  /** Route MIDI events through the native MidiRouter filter/remap/thru logic. */
  static midiRouteEvents(events, config = {}) {
    return projectModule().midiRouteEvents(events, config);
  }
  /** Run native MIDI learn over an event stream; returns `null` when nothing is learned. */
  static midiCcLearn(events, paramId, options = {}) {
    return projectModule().midiCcLearn(
      events,
      paramId,
      options.minValue ?? 0,
      options.maxValue ?? 1,
      options.minMovement ?? 0
    );
  }
  /** Convert one CC event to an automation breakpoint using native CcMap. */
  static midiCcToBreakpoint(bindings, event) {
    return projectModule().midiCcToBreakpoint(bindings, event);
  }
  /** Convert one automation value back to a CC UMP event using native CcMap. */
  static midiParamToCc(bindings, paramId, unitValue, group, ppq = 0) {
    return projectModule().midiParamToCc(bindings, paramId, unitValue, group, ppq);
  }
  /** Pack a MIDI 1.0 channel-pressure event. */
  static midiChannelPressure(ppq, group, channel, pressure) {
    return projectMidi1Event("Project.midiChannelPressure", ppq, group, 13, channel, pressure, 0);
  }
  /** Pack a MIDI 1.0 pitch-bend event (`bend` is unsigned 14-bit, center = 8192). */
  static midiPitchBend(ppq, group, channel, bend) {
    assertBoundedInteger("Project.midiPitchBend", bend, "bend", 0, 16383);
    return projectMidi1Event(
      "Project.midiPitchBend",
      ppq,
      group,
      14,
      channel,
      bend & 127,
      bend >> 7
    );
  }
  /**
   * Deserialize project JSON into a new {@link Project}. Throws if the JSON is
   * malformed, surfacing the joined diagnostic messages.
   */
  static fromJson(json) {
    const project = new _Project();
    const restored = (() => {
      try {
        return projectModule().Project.fromJson(json);
      } catch (error) {
        project.native.delete();
        throw error;
      }
    })();
    project.native.delete();
    project.native = restored;
    return project;
  }
  /**
   * Deserialize project JSON and return native warning diagnostics emitted on
   * successful loads, such as dangling source references preserved for repair.
   */
  static fromJsonWithDiagnostics(json) {
    const project = new _Project();
    const restored = (() => {
      try {
        return projectModule().Project.fromJsonWithDiagnostics(json);
      } catch (error) {
        project.native.delete();
        throw error;
      }
    })();
    project.native.delete();
    project.native = restored.project;
    return { project, diagnostics: restored.diagnostics };
  }
  /** Serialize the project (+ MIDI content) to deterministic JSON. */
  toJson() {
    return this.native.toJson();
  }
  /**
   * Set the project sample rate in Hz. Must be in `[8000, 384000]`; anything
   * outside that range throws. Applied through the edit history, so it is
   * undoable.
   */
  setSampleRate(sampleRate) {
    this.native.setSampleRate(sampleRate);
  }
  /** Add a track and return its allocated stable id. */
  addTrack(desc = {}) {
    return this.native.addTrack({ ...desc, kind: projectTrackKindValue(desc.kind) });
  }
  /** Add an audio or MIDI clip and return its allocated clip id. */
  addClip(desc) {
    return this.native.addClip(desc);
  }
  /** Import host-separated PCM through the normal audio-track/clip path. */
  importExternalStems(request) {
    return this.native.importExternalStems({
      ...request,
      stems: request.stems.map((stem) => ({
        ...stem,
        layout: stem.layout === "mono" ? 1 : stem.layout === "stereo" ? 2 : stem.layout
      }))
    });
  }
  /** Split captured loop-recording audio into takes and add one clip. */
  addLoopRecordingTakes(desc) {
    return this.native.addLoopRecordingTakes(desc);
  }
  /** Create a MIDI track + clip; returns `{ trackId, clipId }`. */
  addMidiClip(startPpq, lengthPpq) {
    return this.native.addMidiClip(startPpq, lengthPpq);
  }
  /** Split a clip at `splitPpq` and return the new clip id. */
  splitClip(clipId, splitPpq) {
    return this.native.splitClip(clipId, splitPpq);
  }
  /** Trim a clip's start / length in PPQ. */
  trimClip(clipId, newStartPpq, newLengthPpq) {
    this.native.trimClip(clipId, newStartPpq, newLengthPpq);
  }
  /** Move a clip to `newStartPpq` and optionally another track. */
  moveClip(clipId, newStartPpq, newTrackId = 0) {
    this.native.moveClip(clipId, newStartPpq, newTrackId);
  }
  /** Change a track kind via an undoable edit. */
  setTrackKind(trackId, kind) {
    this.native.setTrackKind(trackId, projectTrackKindValue(kind));
  }
  /** Set a clip's warp reference id (0 clears it). */
  setClipWarpRef(clipId, warpRefId) {
    this.native.setClipWarpRef(clipId, warpRefId);
  }
  /** Set a clip's warp playback mode. */
  setClipWarpMode(clipId, mode) {
    this.native.setClipWarpMode(clipId, projectWarpModeValue(mode));
  }
  /** Add or replace a first-class warp map referenced by clip warp ids. */
  setWarpMap(map) {
    this.native.setWarpMap(map);
  }
  /** Remove a first-class warp map by id. */
  removeWarpMap(warpRefId) {
    this.native.removeWarpMap(warpRefId);
  }
  /**
   * Route a track's MIDI to host-instrument `destinationId` (0 = default). The
   * compiler stamps every MIDI clip on the track with this id so the engine
   * dispatches its events to the instrument registered for that destination.
   * Routes through an undoable edit command. Builtin, NativeSynth, and SF2
   * instruments retain source-track provenance inside a shared destination
   * voice pool. With only zero-latency instruments bound, live lanes and
   * channel-strip bounces remain aligned. Configure one live lane per source
   * track that needs strip processing.
   */
  setTrackMidiDestination(trackId, destinationId) {
    this.native.setTrackMidiDestination(trackId, destinationId);
  }
  /**
   * Set a track's linear playback gain (1.0 = unity; >= 0) via an undoable edit.
   *
   * The value reaches the track's audio and MIDI alike, but the stage it lands
   * on follows the track's channel strip. A strip bound by this track alone
   * (including one synthesized for an unbound track) carries the controls on its
   * own fader and panner. A strip several tracks share processes their sum and
   * carries none of them; each track applies its controls upstream instead — on
   * its own clip schedules for audio, on its track lane for MIDI.
   *
   * A MIDI track's gain/pan on a shared strip ride the track lane, which is fed
   * per source track only by an instrument that preserves source-track identity
   * (see {@link setTrackMidiDestination}). An opaque host-callback instrument, or
   * one reporting non-zero latency, renders one buffer per destination and has no
   * per-track stage on a shared strip, so its gain/pan do not reach the bounce
   * there; bind such an instrument to a track with an exclusive strip. Mute and
   * solo are unaffected: a silenced MIDI track schedules no events at all.
   */
  setTrackGain(trackId, gain) {
    this.native.setTrackGain(trackId, gain);
  }
  /** Set a track's mute flag via an undoable edit (a muted track is silent). */
  setTrackMute(trackId, mute) {
    this.native.setTrackMute(trackId, mute);
  }
  /** Set a track's solo flag via an undoable edit (when any track is soloed, only soloed tracks sound). */
  setTrackSolo(trackId, solo) {
    this.native.setTrackSolo(trackId, solo);
  }
  /**
   * Set a track's stereo balance in [-1, +1] (0 = center) via an undoable edit.
   *
   * See {@link setTrackGain} for which stage a track's controls land on. The pan
   * law that shapes the balance belongs to that stage: the strip's configured law
   * on a channel strip and on the clips of an audio track sharing a strip, and
   * the track lane's law for a MIDI track sharing a strip (the law of whatever
   * strip the host bound to that lane, or a linear balance when none is bound).
   * Every law is normalized so a centered track stays at unity and only the away
   * channel is attenuated, so the difference is a taper, not a level offset.
   */
  setTrackPan(trackId, pan) {
    this.native.setTrackPan(trackId, pan);
  }
  /** Undo the most recent edit. */
  undo() {
    this.native.undo();
  }
  /** Redo the most recently undone edit. */
  redo() {
    this.native.redo();
  }
  /** Clear the undo/redo history without changing the current project state. */
  clearHistory() {
    this.native.clearHistory();
  }
  /** Cap the undo history depth (clamped to >= 1); evicts oldest entries beyond the cap. */
  setMaxUndoDepth(depth) {
    if (!Number.isInteger(depth) || depth < 1) {
      throw new RangeError("Project.setMaxUndoDepth: depth must be an integer >= 1");
    }
    this.native.setMaxUndoDepth(depth);
  }
  /** Set the combined undo/redo history byte cap. Zero disables retention. */
  setMaxHistoryBytes(bytes) {
    if (typeof bytes !== "number") {
      throw new TypeError("Project.setMaxHistoryBytes: bytes must be a number");
    }
    if (!Number.isFinite(bytes) || !Number.isInteger(bytes) || bytes < 0 || bytes > 4294967295) {
      throw new RangeError(
        "Project.setMaxHistoryBytes: bytes must be a finite integer in the uint32 range"
      );
    }
    this.native.setMaxHistoryBytes(bytes);
  }
  /**
   * Replace a MIDI clip's entire event list.
   *
   * @remarks
   * Drops the clip's SysEx, which {@link importSmf} and {@link exportSmf} both
   * keep. A clip's SysEx payloads sit beside the event list and are reached by
   * a handle {@link ProjectMidiEvent} does not carry, so replacing the list
   * leaves nothing referring to them: a GS setup block that survives an import
   * and an export byte for byte is gone after one call here. Nothing reads the
   * handles back either, so a caller that must keep the setup edits the
   * exported file rather than the event list.
   */
  setMidiEvents(clipId, events) {
    assertProjectMidiEvents("Project.setMidiEvents", events);
    this.native.setMidiEvents(clipId, events);
  }
  /**
   * Import an in-memory SMF buffer; returns the first added clip id.
   * Malformed or partially truncated tracks are rejected instead of installing
   * a silently shortened clip.
   */
  importSmf(data) {
    return this.native.importSmf(data);
  }
  /**
   * Export the project's tempo map + MIDI clips to an SMF byte buffer.
   *
   * @remarks
   * The buffer owns a plain `ArrayBuffer`, which is what the `Blob` / `File`
   * constructors accept — so `new Blob([project.exportSmf()])` compiles without
   * a copy through `new Uint8Array(...)` first.
   */
  exportSmf() {
    return this.native.exportSmf();
  }
  /**
   * Import a MIDI 2.0 Clip File (`SMF2CLIP`); returns the first added clip id.
   * Unlike {@link importSmf}, MIDI 2.0 channel-voice messages (16-bit velocity,
   * 32-bit CC, per-note / registered controllers, bank-valid Program Change)
   * survive without loss.
   */
  importClipFile(data) {
    return this.native.importClipFile(data);
  }
  /**
   * Export the project's tempo map + MIDI clips to a MIDI 2.0 Clip File
   * (`SMF2CLIP`) byte buffer. MIDI 2.0-only events are written without loss —
   * prefer this over {@link exportSmf} when MIDI 2.0 fidelity matters.
   *
   * @remarks
   * As with {@link exportSmf}, the buffer owns a plain `ArrayBuffer` and goes
   * straight into a `Blob`.
   */
  exportClipFile() {
    return this.native.exportClipFile();
  }
  /**
   * Set a MIDI clip's channel-0 program / bank at source PPQ 0. `bank` defaults
   * to `-1` (no Bank Select emitted), matching `setProgramOnChannel` and the
   * Node/Python surfaces; pass `>= 0` to emit a Bank Select.
   */
  setProgram(clipId, program, bank = -1) {
    this.native.setProgram(clipId, program, bank);
  }
  /** Set a MIDI clip's program / bank for one UMP group and channel. */
  setProgramOnChannel(clipId, group, channel, program, bank = -1) {
    this.native.setProgramOnChannel(clipId, group, channel, program, bank);
  }
  bakeMidiFx(clipIdOrRequest, configJson) {
    const request = normalizeMidiFxBakeRequest(clipIdOrRequest, configJson);
    if (!request.withSourceIndex) {
      this.native.bakeMidiFx(request.clipId, request.configJson);
      return {};
    }
    return {
      sourceIndex: this.native.bakeMidiFxWithSourceIndex(request.clipId, request.configJson)
    };
  }
  /**
   * Count the events {@link bakeMidiFx} would produce for this clip and
   * configuration, without mutating the project. The transform is
   * deterministic, so the count matches what the bake goes on to produce.
   */
  previewMidiFxCount(request) {
    return this.native.previewMidiFxCount(request.clipId, request.configJson);
  }
  /** Backward alias for {@link bakeMidiFx}. */
  setMidiFx(clipId, configJson) {
    this.bakeMidiFx(clipId, configJson);
  }
  /**
   * Pre-flight check for hanging / unmatched notes in a MIDI clip: reports
   * whether every note-on in the exported half-open playback window has a
   * matching note-off (FIFO per group+channel+note). Useful before bouncing to
   * catch a stuck note. Throws if `clipId` is unknown or not a MIDI clip.
   */
  validateMidiNotes(clipId) {
    return this.native.validateMidiNotes(clipId);
  }
  /**
   * Transcribe mono audio straight into a MIDI clip's event list, **replacing**
   * whatever it held — exactly as {@link setMidiEvents} does.
   *
   * The PPQ grid is this project's own tempo map, which is why there is no
   * `tempoBpm` field: a project whose tempo was installed by {@link autoTempo}
   * transcribes onto that map rather than onto a second, separately detected
   * tempo. Use the standalone `transcribe` when you want events without a
   * project.
   *
   * Quantizing, tempo detection and key/chord annotation are not done here —
   * see `transcribe` for what each belongs to.
   *
   * @returns the number of notes written (half the events)
   * @throws {RangeError} on empty `samples`, a non-finite sample, or a
   *   `sampleRate` outside `[8000, 384000]`
   * @throws {SonareError} `InvalidParameter` when `clipId` is unknown or not a
   *   MIDI clip, or on an option outside its domain; `NotSupported` when the
   *   library was built without the pitch editor
   */
  transcribeToClip(request) {
    assertSamples("Project.transcribeToClip", request.samples, true);
    assertSampleRate("Project.transcribeToClip", request.sampleRate);
    return this.native.transcribeToClip(
      request.clipId,
      request.samples,
      request.sampleRate,
      request
    );
  }
  /** Return ranked tempo-octave and detected-meter candidates without editing. */
  analyzeTempo(audio, sampleRate, options) {
    return this.native.analyzeTempo(audio, sampleRate, options);
  }
  /**
   * Detect and install a ranked tempo candidate; optionally apply detected meter.
   *
   * @remarks
   * `candidateIndex` indexes the ranking {@link analyzeTempo} produced, so pair
   * the two on the same `options`. Read the installed map back with
   * {@link tempoSegmentCount} and {@link tempoSegmentByIndex}.
   */
  autoTempo(audio, sampleRate, candidateIndex = 0, applyTimeSignatures = false, options) {
    return this.native.autoTempo(audio, sampleRate, candidateIndex, applyTimeSignatures, options);
  }
  /** Snap to a bar (`division=0`), beat (`1`), or beat subdivision (`2+`). */
  snapToGrid(ppq, strength = 1, division = 1) {
    return this.native.snapToGrid(ppq, strength, division);
  }
  /** Compile the project into a renderable timeline, surfacing diagnostics. */
  compile() {
    return this.native.compile();
  }
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
  bounce(options = {}) {
    return this.native.bounce(options);
  }
  /**
   * Compile + render the project offline, routing MIDI tracks through the
   * built-in oscillator synth so a MIDI-only arrangement bounces to audible
   * audio. Pass a {@link BuiltinSynthBinding} (or an array of them) to choose
   * the patch and MIDI destination; omit it (or pass `{}`) for one
   * default-destination sine patch. Because the parameter defaults to `{}`,
   * omission and explicit `undefined` both create that one default binding.
   * Use an explicitly empty array `[]` (or runtime `null`) for zero bindings,
   * so MIDI tracks render silently.
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
  bounceWithBuiltinInstrument(instrument = {}, options = {}) {
    return this.native.bounceWithBuiltinInstrument(instrument, options);
  }
  /**
   * Compile + render the project offline, routing MIDI tracks through the
   * patch-driven NativeSynth — the full synthesizer (every
   * {@link SynthEngineMode} engine plus the realism layer; the modes are
   * enumerated by {@link SYNTH_ENGINE_MODES}). Pass a {@link SynthPatch}, a preset-name
   * string (`'saw-lead'` / `'va:saw-lead'`; see {@link synthPresetNames}), or
   * an array of either; each object entry may carry `destinationId` (default
   * 0) and `useGmPrograms` (default `false`) binding conveniences, neither of
   * which is part of the NativeSynth patch itself. When enabled, MIDI program
   * changes select the corresponding General MIDI voice while the patch remains
   * the fallback.
   * Because the parameter defaults to `{}`, omission and explicit `undefined`
   * both create one default binding. Use an explicitly empty array `[]` (or
   * runtime `null`) for zero bindings. Unknown preset names throw.
   * Deterministic for a fixed project + options + patch.
   *
   * An `engineMode: 'sample'` patch reads its PCM from the {@link SampleBank}
   * passed as `sampleBank`; the bank must still be alive when the bounce runs,
   * and one bound without a bank renders silence.
   */
  bounceWithSynthInstrument(instrument = {}, options = {}) {
    const normalized = Array.isArray(instrument) ? instrument.map((entry) => normalizeSynthInstrument(entry)) : normalizeSynthInstrument(instrument);
    return this.native.bounceWithSynthInstrument(normalized, options);
  }
  /**
   * Load (parse) SoundFont 2 bytes into the project: presets / instruments /
   * sample headers plus the sample PCM decoded to a float pool. The host
   * fetches the `.sf2` and passes the raw bytes; they are copied into linear
   * memory for the call and not referenced afterwards. Replaces any previously
   * loaded SoundFont; throws on malformed input (the previous SoundFont is
   * kept).
   */
  loadSoundFont(data) {
    this.native.loadSoundFont(data);
  }
  /** Release the project's loaded SoundFont (no-op when none is loaded). */
  clearSoundFont() {
    this.native.clearSoundFont();
  }
  /** Number of presets in the loaded SoundFont (0 when none is loaded). */
  soundFontPresetCount() {
    return this.native.soundFontPresetCount();
  }
  /**
   * Enumerate every (channel, bank, program) combination the arrangement plays
   * a note through, in first-use order, reporting whether each resolves in the
   * loaded SoundFont (`'sf2'`, GS variation/drum fallbacks included) or would
   * fall back to the built-in synth (`'synth'`). Without a loaded SoundFont
   * every entry is a synth fallback.
   */
  soundFontManifest() {
    return this.native.soundFontManifest();
  }
  /**
   * Like {@link bounceWithBuiltinInstrument}, but each bound destination
   * renders through a GS-compatible SoundFont player fed by the project's
   * loaded SoundFont ({@link loadSoundFont}): 16 MIDI channels per player,
   * channel 10 drums via bank 128, GS NRPN part edits and GS/GM SysEx resets
   * honored. Programs the SoundFont does not cover — including bouncing with
   * no SoundFont loaded at all — play through the built-in synthesizer GM
   * fallback bank (the data-free floor; see {@link soundFontManifest} for the
   * per-program backend). Because the parameter defaults to `{}`, omission and
   * explicit `undefined` both create one default binding. Use an explicitly
   * empty array `[]` (or runtime `null`) for zero bindings, so MIDI tracks
   * render silently.
   */
  bounceWithSf2Instrument(instrument = {}, options = {}) {
    return this.native.bounceWithSf2Instrument(instrument, options);
  }
  /** Remove a clip (undoable). */
  removeClip(clipId) {
    this.native.removeClip(clipId);
  }
  /** Set a clip's linear playback gain (>= 0; undoable). */
  setClipGain(clipId, gain) {
    this.native.setClipGain(clipId, gain);
  }
  /** Set a clip's fade-in / fade-out regions (undoable). */
  setClipFade(clipId, fadeIn = {}, fadeOut = {}) {
    this.native.setClipFade(clipId, fadeIn, fadeOut);
  }
  /** Audio source ids that need decoded PCM after deserialization. */
  unresolvedAudioSourceIds() {
    return this.native.unresolvedAudioSourceIds();
  }
  /** Register decoded interleaved PCM for an existing audio source (undoable). */
  setSourceAudio(sourceId, audio, channels, sampleRate) {
    this.native.setSourceAudio(sourceId, audio, channels, sampleRate);
  }
  /** Replace an audio source's metadata strings as one undoable edit. */
  setAudioSourceMetadata(sourceId, contentHash, externalStemRole) {
    this.native.setAudioSourceMetadata(sourceId, contentHash, externalStemRole);
  }
  /** Replace a clip's take list and active take id (undoable). */
  setClipTakes(clipId, takes, activeTakeId = 0) {
    this.native.setClipTakes(clipId, takes, activeTakeId);
  }
  /** Replace a clip's comp segments (undoable). */
  setClipCompSegments(clipId, segments) {
    this.native.setClipCompSegments(clipId, segments);
  }
  /**
   * Set a clip's loop mode + loop length in PPQ (undoable). `loopCrossfadePpq`
   * is an optional equal-power crossfade at the loop seam (PPQ, finite and >= 0;
   * 0 = hard loop); the engine clamps it to the clip's pre-roll and half the loop.
   */
  setClipLoop(clipId, loopMode, loopLengthPpq = 0, loopCrossfadePpq = 0) {
    this.native.setClipLoop(
      clipId,
      projectLoopModeValue(loopMode),
      loopLengthPpq,
      loopCrossfadePpq
    );
  }
  /** Rebind a clip to a different (already-registered) source (undoable). */
  setClipSource(clipId, sourceId) {
    this.native.setClipSource(clipId, sourceId);
  }
  /** Duplicate a clip at `newStartPpq` (same track); returns the new clip id. */
  duplicateClip(clipId, newStartPpq) {
    return this.native.duplicateClip(clipId, newStartPpq);
  }
  /** Remove a track and its clips (undoable). */
  removeTrack(trackId) {
    this.native.removeTrack(trackId);
  }
  /** Rename a track (undoable). */
  renameTrack(trackId, name) {
    this.native.renameTrack(trackId, name);
  }
  /** Set a track's mixer-strip binding + output target (undoable; omit / '' clears). */
  setTrackRoute(trackId, channelStripRef, outputTarget) {
    this.native.setTrackRoute(trackId, channelStripRef ?? "", outputTarget ?? "");
  }
  /** Append an automation lane; returns its stable target parameter id (undoable). */
  addAutomationLane(trackId, desc) {
    if (desc.targetParamId === 0) {
      throw new RangeError("project automation lane targetParamId must be non-zero");
    }
    const nativeDesc = {
      ...desc,
      points: desc.points.map(projectAutomationPointValue)
    };
    if (Object.keys(desc).includes("targetKind")) {
      nativeDesc.targetKind = projectAutomationTargetKindValue(
        desc.targetKind
      );
    }
    return this.native.addAutomationLane(trackId, nativeDesc);
  }
  /** Replace the lane identified by its stable target parameter id (undoable). */
  editAutomationLane(trackId, targetParamId, desc) {
    if (desc.targetParamId === 0) {
      throw new RangeError("project automation lane targetParamId must be non-zero");
    }
    const nativeDesc = {
      ...desc,
      points: desc.points.map(projectAutomationPointValue)
    };
    if (Object.keys(desc).includes("targetKind")) {
      nativeDesc.targetKind = projectAutomationTargetKindValue(
        desc.targetKind
      );
    }
    this.native.editAutomationLane(trackId, targetParamId, nativeDesc);
  }
  /** Remove the lane identified by its stable target parameter id (undoable). */
  removeAutomationLane(trackId, targetParamId) {
    this.native.removeAutomationLane(trackId, targetParamId);
  }
  /** Replace the project's key annotation stream (undoable). */
  annotateKeys(keys) {
    this.native.annotateKeys(keys);
  }
  /** Replace the project's chord-symbol annotation stream (undoable). */
  annotateChords(chords) {
    this.native.annotateChords(chords);
  }
  setAssistSidecar(sidecarOrModuleId, schemaVersion, targetTrackId, regionStartPpq, regionEndPpq, payload) {
    if (typeof sidecarOrModuleId === "string") {
      if (schemaVersion === void 0 || targetTrackId === void 0 || regionStartPpq === void 0 || regionEndPpq === void 0 || payload === void 0) {
        throw new TypeError("Project.setAssistSidecar: positional form requires six arguments");
      }
      this.native.setAssistSidecar(
        validateAssistSidecarModuleId(sidecarOrModuleId),
        validateAssistSidecarUint32(schemaVersion, "schemaVersion"),
        validateAssistSidecarUint32(targetTrackId, "targetTrackId"),
        validateAssistSidecarPpq(regionStartPpq, "regionStartPpq"),
        validateAssistSidecarPpq(regionEndPpq, "regionEndPpq"),
        validateAssistSidecarPayload(payload)
      );
      return;
    }
    if (sidecarOrModuleId === null || typeof sidecarOrModuleId !== "object" || Array.isArray(sidecarOrModuleId)) {
      throw new TypeError("Project.setAssistSidecar: expected a sidecar descriptor object");
    }
    const sidecar = sidecarOrModuleId;
    const moduleId = validateAssistSidecarModuleId(sidecar.moduleId);
    this.native.setAssistSidecar(
      moduleId,
      validateAssistSidecarUint32(sidecar.schemaVersion ?? 0, "schemaVersion"),
      validateAssistSidecarUint32(sidecar.targetTrackId ?? 0, "targetTrackId"),
      validateAssistSidecarPpq(sidecar.regionStartPpq ?? 0, "regionStartPpq"),
      validateAssistSidecarPpq(sidecar.regionEndPpq ?? 0, "regionEndPpq"),
      validateAssistSidecarPayload(sidecar.payload ?? new Uint8Array())
    );
  }
  /** Number of assist sidecars currently stored on the project. */
  assistSidecarCount() {
    return this.native.assistSidecarCount();
  }
  /** Read one assist sidecar by stable project order. */
  getAssistSidecar(index) {
    return this.native.getAssistSidecar(index);
  }
  /** Read every stored assist sidecar in the same order as the index getter. */
  assistSidecars() {
    const count = this.assistSidecarCount();
    return Array.from({ length: count }, (_, index) => this.getAssistSidecar(index));
  }
  /** Set the project's clip-overlap policy (SonareProjectOverlapPolicy ordinal). */
  setOverlapPolicy(policy) {
    this.native.setOverlapPolicy(policy);
  }
  /** Read the project's clip-overlap policy (SonareProjectOverlapPolicy ordinal). */
  getOverlapPolicy() {
    return this.native.getOverlapPolicy();
  }
  /** Read the project sample rate in Hz. */
  getSampleRate() {
    return this.native.getSampleRate();
  }
  /** Replace the project's mixer scene from a scene JSON string. */
  setMixerSceneJson(sceneJson) {
    this.native.setMixerSceneJson(sceneJson);
  }
  /**
   * Add or replace a marker. Pass `markerId` 0 to allocate a new id; returns the
   * stable marker id (the allocated id when 0 was passed).
   */
  setMarker(markerId, ppq, name) {
    return this.native.setMarker(markerId, ppq, name);
  }
  /**
   * Add or replace a marker from a full {@link ProjectMarker}, including its
   * {@link MarkerKind} and (for key signatures) the key. Pass `id` 0 to allocate
   * a new id; returns the stable marker id.
   */
  setMarkerEx(marker) {
    return this.native.setMarkerEx(marker);
  }
  /** Read a project marker by index (0-based, in stored order). */
  markerByIndex(index) {
    return this.native.markerByIndex(index);
  }
  /** Read a stored project track by 0-based index. */
  trackByIndex(index) {
    return this.native.trackByIndex(index);
  }
  /** Read a stored project clip by 0-based index. */
  clipByIndex(index) {
    return this.native.clipByIndex(index);
  }
  /** Read a stored project source by 0-based index. */
  sourceByIndex(index) {
    return this.native.sourceByIndex(index);
  }
  /** Number of markers in the project. */
  markerCount() {
    return this.native.markerCount();
  }
  /** Number of tracks in the project. */
  trackCount() {
    return this.native.trackCount();
  }
  /** Number of clips in the project. */
  clipCount() {
    return this.native.clipCount();
  }
  /** Number of audio sources registered on the project. */
  sourceCount() {
    return this.native.sourceCount();
  }
  /** Number of tempo-map segments on the project. */
  tempoSegmentCount() {
    return this.native.tempoSegmentCount();
  }
  /**
   * Reads a tempo segment by index, in stored order.
   *
   * @param index - Zero-based index below {@link tempoSegmentCount}
   * @returns The segment, in the shape {@link setTempoSegments} accepts
   * @throws When the index is at or past the count
   */
  tempoSegmentByIndex(index) {
    return this.native.tempoSegmentByIndex(index);
  }
  /**
   * Reads a time-signature segment by index, in stored order.
   *
   * @param index - Zero-based index below {@link timeSignatureCount}
   * @returns The segment, in the shape {@link setTimeSignatures} accepts
   * @throws When the index is at or past the count
   */
  timeSignatureByIndex(index) {
    return this.native.timeSignatureByIndex(index);
  }
  /** Number of time-signature segments on the project. */
  timeSignatureCount() {
    return this.native.timeSignatureCount();
  }
  /** Replace the project's tempo map with the given segments. */
  setTempoSegments(segments) {
    this.native.setTempoSegments(segments);
  }
  /** Replace the project's time-signature map with the given segments. */
  setTimeSignatures(segments) {
    this.native.setTimeSignatures(segments);
  }
  /**
   * Compile diagnostics produced by the most recent bounce on this project
   * (e.g. MIDI clips rendering silently without a bound instrument). On a
   * project no bounce has ever run on, the result is empty in full:
   * `hasTimeline` is `false` and `diagnostics` is empty. A failed bounce is
   * distinguishable from that state, because a bounce only loses its timeline
   * through an error diagnostic and so always reports at least one.
   */
  lastBounceCompileResult() {
    return this.native.lastBounceCompileResult();
  }
  /** Release the underlying WASM object. Safe to call only once. */
  delete() {
    this.native.delete();
  }
  /** Alias for {@link delete}, provided for cross-binding (Node) compatibility. */
  destroy() {
    this.delete();
  }
};

// src/project_synth.ts
function projectAbiVersion() {
  return projectModule().projectAbiVersion();
}
function synthPresetNames() {
  return Array.from(projectModule().synthPresetNames());
}
function synthGsDrumKitName(program) {
  return projectModule().synthGsDrumKitName(program);
}
function synthGsDrumKitIsVoicedApart(program) {
  const r = projectModule().synthGsDrumKitIsVoicedApart(program);
  return r < 0 ? null : r === 1;
}
function synthGsVariationIsVoicedApart(bank, program) {
  const r = projectModule().synthGsVariationIsVoicedApart(bank, program);
  return r < 0 ? null : r === 1;
}
function controllerProfileNames() {
  return Array.from(projectModule().controllerProfileNames());
}
function synthPresetPatch(name) {
  return { ...projectModule().synthPresetPatch(name) };
}
function synthEnumTables() {
  return projectModule()._synthEnumTables();
}

// src/project_types.ts
var EXPECTED_PROJECT_ABI_VERSION = 2;
var MarkerKind = {
  marker: 0,
  text: 1,
  lyric: 2,
  cuePoint: 3,
  keySignature: 4
};
var AutomationTargetKind = {
  opaque: 0,
  trackFaderDb: 1,
  trackPan: 2
};
var PROJECT_AUTOMATION_TARGET_OPAQUE = AutomationTargetKind.opaque;
var PROJECT_AUTOMATION_TARGET_TRACK_FADER_DB = AutomationTargetKind.trackFaderDb;
var PROJECT_AUTOMATION_TARGET_TRACK_PAN = AutomationTargetKind.trackPan;

// src/realtime_engine.ts
var EXPECTED_ENGINE_ABI_VERSION = 3;
function normalizeRenderOfflineRequest(channelsOrRequest, blockSize) {
  const request = Array.isArray(channelsOrRequest) ? { channels: channelsOrRequest, blockSize } : channelsOrRequest;
  return {
    channels: request.channels,
    blockSize: request.blockSize ?? 128,
    finalize: request.finalize ?? true
  };
}
function engineCapabilities() {
  const abiVersion2 = getSonareModule().engineAbiVersion();
  const sharedArrayBuffer = typeof globalThis.SharedArrayBuffer === "function";
  const atomics = typeof globalThis.Atomics === "object";
  const audioWorklet = typeof AudioWorkletNode !== "undefined" || typeof globalThis.AudioWorkletProcessor !== "undefined";
  return {
    engineAbiVersion: abiVersion2,
    expectedEngineAbiVersion: EXPECTED_ENGINE_ABI_VERSION,
    abiCompatible: abiVersion2 === EXPECTED_ENGINE_ABI_VERSION,
    sharedArrayBuffer,
    atomics,
    audioWorklet,
    mode: sharedArrayBuffer && atomics ? "sab" : "postMessage"
  };
}
var RealtimeEngine = class _RealtimeEngine {
  constructor(sampleRate = 48e3, maxBlockSize = 128, commandCapacity = 1024, telemetryCapacity = 1024, maxChannels = 64) {
    const module2 = getSonareModule();
    const capabilities2 = engineCapabilities();
    if (!capabilities2.abiCompatible) {
      throw new Error(
        `Engine ABI mismatch: wasm=${capabilities2.engineAbiVersion}, expected=${capabilities2.expectedEngineAbiVersion}`
      );
    }
    this.native = new module2.RealtimeEngine(
      sampleRate,
      maxBlockSize,
      commandCapacity,
      telemetryCapacity,
      maxChannels
    );
  }
  /**
   * Size the engine's queues and scratch for a sample rate and block size.
   *
   * `commandCapacity` must not exceed 65536 and `telemetryCapacity` must not
   * exceed 16384; a larger value throws and leaves the engine untouched. The
   * telemetry number is not a queue depth paid for one-for-one: the engine
   * reserves that many meter records per metered lane, so its memory cost is
   * far larger than the number given here.
   */
  prepare(sampleRate, maxBlockSize, commandCapacity = 1024, telemetryCapacity = 1024, maxChannels = 64) {
    this.native.prepareWithChannels(
      sampleRate,
      maxBlockSize,
      commandCapacity,
      telemetryCapacity,
      maxChannels
    );
  }
  /** Queue a sample-accurate parameter change (engine kSetParam). */
  setParameter(paramId, value, renderFrame = -1) {
    this.native.setParameter(paramId, value, renderFrame);
  }
  /** Queue a smoothed parameter change (engine kSetParamSmoothed). */
  setParameterSmoothed(paramId, value, renderFrame = -1) {
    this.native.setParameterSmoothed(paramId, value, renderFrame);
  }
  /**
   * Set the default ramp time (ms) for engine-level smoothed parameters —
   * fader/pan glides, insert-parameter automation, and MIDI-CC mappings. The
   * default is 20 ms; pass `0` for instant (un-ramped) changes.
   */
  setParamSmoothingMs(smoothingMs) {
    this.native.setParamSmoothingMs(smoothingMs);
  }
  setSoloMute(laneIndex, solo, mute, renderFrame = -1) {
    this.native.setSoloMute(laneIndex, solo, mute, renderFrame);
  }
  /** Queue a per-track PFL/AFL monitor tap mode change. */
  setTrackMonitorMode(laneIndex, mode, renderFrame = -1) {
    this.native.setTrackMonitorMode(laneIndex, trackMonitorModeCode(mode), renderFrame);
  }
  setMidiClips(clips) {
    this.native.setMidiClips(clips);
  }
  setBuiltinInstrument(config = {}, destinationId = config.destinationId ?? 0) {
    this.native.setBuiltinInstrument(destinationId, config);
  }
  /**
   * Bind the patch-driven NativeSynth to a realtime MIDI destination. `patch`
   * is a {@link SynthPatch} or a preset-name string (`'saw-lead'` /
   * `'va:saw-lead'`; see {@link synthPresetNames}), resolving exactly like
   * {@link Project.bounceWithSynthInstrument}. Live note/CC commands and
   * scheduled MIDI clips routed to that destination render through the synth.
   * Unknown preset names throw. An object patch's `destinationId` is a JS
   * binding convenience, not part of the NativeSynth patch itself.
   *
   * An `engineMode: 'sample'` patch also carries the {@link SampleBank} its
   * keymap names. The synth takes a share of the bank, so it may be released
   * right after this call; a sample patch bound without one renders silence.
   */
  setSynthInstrument(patch = {}, destinationId = (typeof patch === "object" ? patch.destinationId : void 0) ?? 0) {
    this.native.setSynthInstrument(destinationId, normalizeSynthInstrument(patch));
  }
  /**
   * Load (parse) SoundFont 2 bytes into the engine so SF2 instruments can be
   * bound with {@link setSf2Instrument}. The host fetches the `.sf2` and
   * passes the raw bytes; they are copied into linear memory for the call and
   * not referenced afterwards. Replaces any previously loaded SoundFont.
   */
  loadSoundFont(data) {
    this.native.loadSoundFont(data);
  }
  /**
   * Bind a GS-compatible SoundFont player to a realtime MIDI destination, fed
   * by the engine's loaded SoundFont ({@link loadSoundFont}). Live note/CC
   * commands and scheduled MIDI clips routed to that destination render
   * through the player (16 MIDI channels, channel 10 drums, GS NRPN part
   * edits, GS/GM SysEx resets). Without a loaded SoundFont — or for programs
   * the SoundFont does not cover — notes play through the built-in
   * synthesizer GM fallback bank (the data-free floor).
   */
  setSf2Instrument(config = {}, destinationId = config.destinationId ?? 0) {
    this.native.setSf2Instrument(destinationId, config);
  }
  clearMidiInstrument(destinationId = 0) {
    this.native.clearMidiInstrument(destinationId);
  }
  midiInstrumentCount() {
    return this.native.midiInstrumentCount();
  }
  /**
   * Bind a live MIDI CC to an engine automation parameter. The MIDI event still
   * reaches the destination instrument; when bound, its 7-bit value is also
   * mapped into [minValue, maxValue] for `paramId`.
   */
  bindMidiCc(channel, controller, paramId, options = {}) {
    this.native.bindMidiCc(
      channel,
      controller,
      paramId,
      options.minValue ?? 0,
      options.maxValue ?? 1
    );
  }
  /** Bind a 7/14-bit CC, RPN, or NRPN descriptor to a live parameter. */
  bindMidiCcBinding(binding) {
    this.native.bindMidiCcBinding(binding);
  }
  clearMidiCcBindings() {
    this.native.clearMidiCcBindings();
  }
  midiCcBindingCount() {
    return this.native.midiCcBindingCount();
  }
  /**
   * Replace a destination instrument's controller profile with a named preset
   * (see {@link controllerProfileNames}). Installing a profile drops every
   * channel's accumulated axis values: the new bindings say nothing about what
   * the old ones had reached. An unknown name throws, and so does a destination
   * with no instrument or one whose instrument holds no profile.
   */
  setControllerProfile(destinationId, presetName) {
    this.native.setControllerProfile(destinationId, presetName);
  }
  /** Add one {@link ControllerBinding} on top of the destination's current profile. */
  bindController(destinationId, binding) {
    this.native.bindController(destinationId, binding);
  }
  /**
   * Drop every binding of the destination's controller profile. The instrument
   * keeps a profile; it resolves nothing until something is bound again.
   */
  clearControllerBindings(destinationId) {
    this.native.clearControllerBindings(destinationId);
  }
  controllerBindingCount(destinationId) {
    return this.native.controllerBindingCount(destinationId);
  }
  /**
   * Whether note-on velocity is expression for this instrument. No fixed
   * default is possible — a wind controller ships sending breath-derived
   * velocity on one model and a constant on the next — so each preset states it
   * and a host building its own profile sets it. When false the synth takes
   * every note at full scale and the bound axes carry the dynamics alone.
   */
  setControllerVelocityMeaningful(destinationId, meaningful) {
    this.native.setControllerVelocityMeaningful(destinationId, meaningful);
  }
  controllerVelocityMeaningful(destinationId) {
    return this.native.controllerVelocityMeaningful(destinationId);
  }
  /**
   * Say which note a value addressed to a whole MIDI channel belongs to when
   * several are sounding on it, for one per-note dimension
   * ({@link MPE_DIMENSIONS}, {@link NOTE_TRACKINGS}).
   *
   * Set per dimension because the useful answers differ: pressure following the
   * newest note while bend reaches every one is a real configuration, not a
   * mistake. MPE poses this question and declines to answer it, so this is a
   * choice rather than a rule — and it is read only inside an MPE zone, and
   * only while more than one note is sounding on the channel, which an MPE
   * sender avoids by giving each note its own member channel.
   *
   * Both arguments are required and are a name or its ordinal; an unknown
   * spelling is refused rather than resolved to a default, as are a destination
   * with no instrument and one whose instrument holds no controller profile.
   */
  setControllerNoteTracking(destinationId, dimension, tracking) {
    this.native.setControllerNoteTracking(destinationId, dimension, tracking);
  }
  /**
   * Read back {@link setControllerNoteTracking} for one dimension, as the
   * canonical name.
   */
  controllerNoteTracking(destinationId, dimension) {
    return this.native.controllerNoteTracking(destinationId, dimension);
  }
  /**
   * Set how one MIDI channel (0–15) of a destination's instrument treats a
   * note-on while another note on that channel is still held: `'poly'` takes a
   * new voice each time, `'mono-retrigger'` stops and restarts the note (what
   * GS MONO MODE and CC126 mean), `'mono-legato'` carries the sounding voice
   * and only moves its pitch — a wind player's slur, which no MIDI message can
   * reach by design.
   *
   * `'mono-legato'` is a request, not a guarantee: an engine whose exciter is
   * spent at the onset — anything struck or plucked — and a target pitch below
   * what the engine's delay line can hold both fall back to an ordinary note,
   * which {@link legatoFallbackCount} counts. A channel outside [0,15] and an
   * articulation outside the enum are refused rather than clamped, and so is a
   * destination with no instrument or one whose instrument has no articulation
   * of its own.
   */
  setArticulation(destinationId, channel, articulation) {
    this.native.setArticulation(destinationId, channel, articulation);
  }
  /**
   * Read back {@link setArticulation} as the canonical name. An ordinal this
   * build cannot spell is handed back as the number, the way every other enum
   * leaves this surface.
   */
  articulation(destinationId, channel) {
    return this.native.articulation(destinationId, channel);
  }
  /**
   * How many times a legato continuation was asked for on this destination and
   * refused, so the note started a voice of its own instead. Counted rather
   * than inferred: a refusal sounds like an ordinary note, so nothing in the
   * audio separates "this engine declines legato" from "the mode was never
   * set". Saturates at 4294967295 rather than wrapping — matching the C ABI, so
   * the same phrase reports the same number on every surface — after which it
   * reads as "at least this many".
   *
   * Throws on a destination with no instrument, and on one whose instrument has
   * no articulation of its own — the same two refusals
   * {@link setArticulation} keeps apart. Reporting 0 for the second would read
   * as "every slur took", which is the reading this counter exists to prevent.
   */
  legatoFallbackCount(destinationId) {
    return this.native.legatoFallbackCount(destinationId);
  }
  /** Install/replace a live non-destructive MIDI-FX insert for one destination. */
  setMidiFx(destinationId, configJson) {
    this.native.setMidiFx(destinationId, configJson);
  }
  clearMidiFx(destinationId = 0) {
    this.native.clearMidiFx(destinationId);
  }
  /** Enable the engine-owned live MIDI input source for a destination. */
  setMidiInputSource(destinationId = 0) {
    this.native.setMidiInputSource(destinationId);
  }
  clearMidiInputSource() {
    this.native.clearMidiInputSource();
  }
  midiInputPendingCount() {
    return this.native.midiInputPendingCount();
  }
  /**
   * Route a destination's (track lane's) MIDI to the external output queue
   * instead of the internal instrument rack, so the track plays an external
   * device. Clearing it restores internal-synth playback.
   */
  setMidiDestinationExternal(destinationId, external) {
    this.native.setMidiDestinationExternal(destinationId, external);
  }
  /**
   * Enable/disable forwarding MIDI clock + transport (start/continue/stop) to
   * the external output queue so external gear tracks the transport tempo.
   */
  setExternalMidiClockEnabled(enabled) {
    this.native.setExternalMidiClockEnabled(enabled);
  }
  /** Count of external-MIDI events dropped because the output queue was full. */
  externalMidiDroppedCount() {
    return this.native.externalMidiDroppedCount();
  }
  externalMidiPendingCount() {
    return this.native.externalMidiPendingCount();
  }
  /**
   * Drain queued external-MIDI events, already lowered to MIDI 1.0 byte
   * messages ready to write to a Web MIDI output port. Call once per audio
   * block / animation frame. `maxRecords` caps the number of output events
   * returned — the shared unit across every surface. Events past the cap stay
   * queued for the next call (lossless); call again to drain the rest.
   *
   * One queued record lowers to at most 3 MIDI 1.0 messages, so a positive
   * `maxRecords` below 3 could never consume a record and is rejected with an
   * `InvalidParameter` `SonareError` instead of returning nothing forever.
   */
  drainExternalMidi(maxRecords = 1024) {
    return this.native.drainExternalMidi(maxRecords);
  }
  /** Scalar, allocation-free external-MIDI drain for AudioWorklet SAB output. */
  popExternalMidiToScratch() {
    return this.native.popExternalMidiToScratch();
  }
  externalMidiScratchDestinationId() {
    return this.native.externalMidiScratchDestinationId();
  }
  externalMidiScratchRenderFrame() {
    return Number(this.native.externalMidiScratchRenderFrame());
  }
  externalMidiScratchByteWord() {
    return this.native.externalMidiScratchByteWord();
  }
  externalMidiScratchByteCount() {
    return this.native.externalMidiScratchByteCount();
  }
  consumeExternalMidiScratch() {
    this.native.consumeExternalMidiScratch();
  }
  pushMidiInputNoteOn(group, channel, note, velocity, portTimeSamples = 0) {
    this.native.pushMidiInputNoteOn(group, channel, note, velocity, portTimeSamples);
  }
  pushMidiInputNoteOff(group, channel, note, velocity = 0, portTimeSamples = 0) {
    this.native.pushMidiInputNoteOff(group, channel, note, velocity, portTimeSamples);
  }
  pushMidiInputCc(group, channel, controller, value, portTimeSamples = 0) {
    this.native.pushMidiInputCc(group, channel, controller, value, portTimeSamples);
  }
  /**
   * Push a live MIDI pitch bend to the engine-owned MIDI input source.
   *
   * `bend14` is unsigned 14-bit with centre 8192 (0..16383) — the dimension is
   * not 7-bit, so a value past 16383 is refused rather than narrowed. The input
   * source must be enabled with {@link setMidiInputSource} first.
   */
  pushMidiInputPitchBend(group, channel, bend14, portTimeSamples = 0) {
    this.native.pushMidiInputPitchBend(group, channel, bend14, portTimeSamples);
  }
  /**
   * Push a live MIDI channel pressure to the engine-owned MIDI input source.
   * `pressure` is 7-bit (0..127). Under MPE this is the member channel's
   * per-note pressure.
   */
  pushMidiInputChannelPressure(group, channel, pressure, portTimeSamples = 0) {
    this.native.pushMidiInputChannelPressure(group, channel, pressure, portTimeSamples);
  }
  /**
   * Push a live MIDI polyphonic key pressure to the engine-owned MIDI input
   * source. `note` and `pressure` are 7-bit (0..127).
   */
  pushMidiInputPolyPressure(group, channel, note, pressure, portTimeSamples = 0) {
    this.native.pushMidiInputPolyPressure(group, channel, note, pressure, portTimeSamples);
  }
  pushMidiNoteOn(destinationId, group, channel, note, velocity, renderFrame = -1) {
    this.native.pushMidiNoteOn(destinationId, group, channel, note, velocity, renderFrame);
  }
  pushMidiNoteOff(destinationId, group, channel, note, velocity = 0, renderFrame = -1) {
    this.native.pushMidiNoteOff(destinationId, group, channel, note, velocity, renderFrame);
  }
  /**
   * Queue an immediate (live) MIDI control change to a MIDI destination
   * (engine kMidiCcImmediate). `group`/`channel` are 0..15; `controller`/`value`
   * are 7-bit (0..127). `renderFrame` is the frame to fire at, or -1 for
   * immediate. Mirrors the Node/Python/C-ABI `pushMidiCc`.
   */
  pushMidiCc(destinationId, group, channel, controller, value, renderFrame = -1) {
    this.native.pushMidiCc(destinationId, group, channel, controller, value, renderFrame);
  }
  /**
   * Queue an immediate (live) MIDI pitch bend to a MIDI destination. `bend14`
   * is unsigned 14-bit with centre 8192 (0..16383); `renderFrame` is the frame
   * to fire at, or -1 for immediate. Mirrors the Node/Python/C-ABI
   * `pushMidiPitchBend`.
   */
  pushMidiPitchBend(destinationId, group, channel, bend14, renderFrame = -1) {
    this.native.pushMidiPitchBend(destinationId, group, channel, bend14, renderFrame);
  }
  /**
   * Queue an immediate (live) MIDI channel pressure to a MIDI destination.
   * `pressure` is 7-bit (0..127); `renderFrame` is the frame to fire at, or -1
   * for immediate. Mirrors the Node/Python/C-ABI `pushMidiChannelPressure`.
   */
  pushMidiChannelPressure(destinationId, group, channel, pressure, renderFrame = -1) {
    this.native.pushMidiChannelPressure(destinationId, group, channel, pressure, renderFrame);
  }
  /**
   * Queue an immediate (live) MIDI polyphonic key pressure to a MIDI
   * destination. `note` and `pressure` are 7-bit (0..127); `renderFrame` is the
   * frame to fire at, or -1 for immediate. Mirrors the Node/Python/C-ABI
   * `pushMidiPolyPressure`.
   */
  pushMidiPolyPressure(destinationId, group, channel, note, pressure, renderFrame = -1) {
    this.native.pushMidiPolyPressure(destinationId, group, channel, note, pressure, renderFrame);
  }
  /** Queue one immediate MIDI 1.0 channel-voice UMP word for a destination. */
  pushMidiUmp(destinationId, word0, renderFrame = -1) {
    this.native.pushMidiUmp(destinationId, word0, renderFrame);
  }
  /**
   * Queue an immediate (live) MIDI SysEx frame to a MIDI destination. `data` is
   * the full message including the leading 0xF0 and trailing 0xF7 (1..512
   * bytes). `renderFrame` is the frame to fire at, or -1 for immediate. Mirrors
   * the Node/Python/C-ABI `pushMidiSysex`.
   */
  pushMidiSysex(destinationId, data, renderFrame = -1) {
    this.native.pushMidiSysex(destinationId, data, renderFrame);
  }
  /**
   * Queue a MIDI panic (all-notes-off) releasing every sounding note at
   * `renderFrame` (-1 = immediate). Mirrors the C-ABI `pushMidiPanic`.
   */
  pushMidiPanic(renderFrame = -1) {
    this.native.pushMidiPanic(renderFrame);
  }
  /**
   * Remove all registered parameters (and their automation lanes). Control-thread
   * only; not realtime-safe. Mirrors the C-ABI `clearParameters`.
   */
  clearParameters() {
    this.native.clearParameters();
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
  /**
   * Snaps every in-flight parameter ramp (engine-level smoothed params, mixer
   * lane fader/pan/gate, bus gains) to its target value. Offline renders call
   * this after a priming process() block so the first audible block renders at
   * settled values instead of ramping in from defaults.
   */
  settleParameters() {
    this.native.settleParameters();
  }
  /** Drains queued commands on an offline/control-only engine immediately. */
  flushControlCommands() {
    this.native.flushControlCommands();
  }
  seekPpq(ppq, renderFrame = -1) {
    this.native.seekPpq(ppq, renderFrame);
  }
  /** Set a finite tempo in the range (0, 100000] BPM. */
  setTempo(bpm) {
    this.native.setTempo(bpm);
  }
  setTempoSegments(segments) {
    this.native.setTempoSegments([...segments]);
  }
  setTimeSignature(numerator, denominator) {
    this.native.setTimeSignature(numerator, denominator);
  }
  setTimeSignatureSegments(segments) {
    this.native.setTimeSignatureSegments([...segments]);
  }
  sampleAtPpq(ppq) {
    return Number(this.native.sampleAtPpq(ppq));
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
  /** Set a metronome config; click lengths are limited to one second. */
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
    this.native.setClips(
      clips.map((clip) => ({
        ...clip,
        pageProvider: typeof clip.pageProvider === "object" && clip.pageProvider !== null ? clip.pageProvider.id : clip.pageProvider
      }))
    );
  }
  /**
   * Returns the PCM generated for a tempo-sync clip by the control-thread
   * setter, or `null` when the clip did not require a tempo-sync bake.
   */
  prebakedClipChannels(clipId) {
    return this.native.prebakedClipChannels(clipId);
  }
  clipCount() {
    return this.native.clipCount();
  }
  /**
   * Normalizes each send's pre/post tap point to the integer the native layer
   * reads (defaults to post-fader when omitted). Shared by track lanes and
   * buses, which carry the same send shape.
   */
  static normalizeSends(sends) {
    return sends.map((send) => ({
      ...send,
      // Post-fader (0) is the default for an omitted sendTiming.
      sendTiming: send.sendTiming === void 0 ? 0 : sendTimingCode(send.sendTiming)
    }));
  }
  setTrackLanes(lanes) {
    this.native.setTrackLanes(
      lanes.map((lane) => {
        if (typeof lane === "number") {
          return { trackId: lane };
        }
        if (!lane.sends) {
          return lane;
        }
        return { ...lane, sends: _RealtimeEngine.normalizeSends(lane.sends) };
      })
    );
  }
  /**
   * Keys one insert of a lane strip from another lane's post-strip audio
   * (ducking/sidechainRouter inserts). sourceTrackId 0 removes the binding.
   */
  setLaneSidechain(trackId, insertIndex, sourceTrackId) {
    this.native.setLaneSidechain(trackId, insertIndex, sourceTrackId);
  }
  setTrackBuses(buses) {
    this.native.setTrackBuses(
      Array.isArray(buses) ? buses.map(
        (bus) => bus.sends ? { ...bus, sends: _RealtimeEngine.normalizeSends(bus.sends) } : bus
      ) : buses
    );
  }
  /**
   * Keys one insert of a bus strip from a track lane or another bus
   * (ducking/sidechainRouter inserts). `sourceId` 0 removes the binding.
   */
  setBusSidechain(busId, insertIndex, sourceKind, sourceId) {
    this.native.setBusSidechain(busId, insertIndex, sidechainSourceKindCode(sourceKind), sourceId);
  }
  /**
   * Keys one insert of the master strip from a track lane or a bus. Same
   * source rules as {@link setBusSidechain}.
   */
  setMasterSidechain(insertIndex, sourceKind, sourceId) {
    this.native.setMasterSidechain(insertIndex, sidechainSourceKindCode(sourceKind), sourceId);
  }
  setBusStripJson(busId, sceneJson) {
    try {
      JSON.parse(sceneJson);
    } catch (error) {
      const message = error instanceof Error ? error.message : "invalid bus strip JSON";
      throw new SonareError(2 /* InvalidFormat */, "InvalidFormat", message);
    }
    this.native.setBusStripJson(busId, sceneJson);
  }
  setTrackStripJson(trackId, sceneJson) {
    try {
      JSON.parse(sceneJson);
    } catch (error) {
      const message = error instanceof Error ? error.message : "invalid track strip JSON";
      throw new SonareError(2 /* InvalidFormat */, "InvalidFormat", message);
    }
    this.native.setTrackStripJson(trackId, sceneJson);
  }
  setTrackStripEqBand(trackId, bandIndex, band) {
    this.native.setTrackStripEqBandJson(
      trackId,
      bandIndex,
      typeof band === "string" ? band : JSON.stringify(band)
    );
  }
  setTrackStripEqBandJson(trackId, bandIndex, bandJson) {
    this.native.setTrackStripEqBandJson(trackId, bandIndex, bandJson);
  }
  setTrackStripInsertBypassed(trackId, insertIndex, bypassed, resetOnBypass = false) {
    this.native.setTrackStripInsertBypassed(trackId, insertIndex, bypassed, resetOnBypass);
  }
  /** Bus-strip counterpart of {@link setTrackStripEqBand}. */
  setBusStripEqBand(busId, bandIndex, band) {
    this.native.setBusStripEqBandJson(
      busId,
      bandIndex,
      typeof band === "string" ? band : JSON.stringify(band)
    );
  }
  setBusStripEqBandJson(busId, bandIndex, bandJson) {
    this.native.setBusStripEqBandJson(busId, bandIndex, bandJson);
  }
  setMasterStripJson(sceneJson) {
    try {
      JSON.parse(sceneJson);
    } catch (error) {
      const message = error instanceof Error ? error.message : "invalid master strip JSON";
      throw new SonareError(2 /* InvalidFormat */, "InvalidFormat", message);
    }
    this.native.setMasterStripJson(sceneJson);
  }
  setMasterStripEqBand(bandIndex, band) {
    this.native.setMasterStripEqBandJson(
      bandIndex,
      typeof band === "string" ? band : JSON.stringify(band)
    );
  }
  setMasterStripEqBandJson(bandIndex, bandJson) {
    this.native.setMasterStripEqBandJson(bandIndex, bandJson);
  }
  setMasterStripInsertBypassed(insertIndex, bypassed, resetOnBypass = false) {
    this.native.setMasterStripInsertBypassed(insertIndex, bypassed, resetOnBypass);
  }
  /**
   * Changes one track-strip insert parameter in realtime, addressed by the
   * processor's JSON-key parameter name — one of the entries
   * {@link masteringInsertParamInfo} reports with a non-null `id`; a
   * construction-only entry (`id` null) takes effect only when the insert is
   * built. Applied at the next block head via the engine command queue; safe
   * during playback. Throws if the track, insert, or name is unknown, the
   * param is not realtime-safe, or the command queue is full.
   */
  setTrackStripInsertParamByName(trackId, insertIndex, paramName, value) {
    this.native.setTrackStripInsertParamByName(trackId, insertIndex, paramName, value);
  }
  /** Master-strip counterpart of {@link setTrackStripInsertParamByName}. */
  setMasterStripInsertParamByName(insertIndex, paramName, value) {
    this.native.setMasterStripInsertParamByName(insertIndex, paramName, value);
  }
  /** Bus-strip counterpart of {@link setTrackStripInsertParamByName}. */
  setBusStripInsertParamByName(busId, insertIndex, paramName, value) {
    this.native.setBusStripInsertParamByName(busId, insertIndex, paramName, value);
  }
  /** Bus-strip counterpart of {@link setTrackStripInsertBypassed}. */
  setBusStripInsertBypassed(busId, insertIndex, bypassed, resetOnBypass = false) {
    this.native.setBusStripInsertBypassed(busId, insertIndex, bypassed, resetOnBypass);
  }
  /**
   * Resolves a track-lane insert parameter (by its JSON-key name) to the
   * reserved automation id usable with `setAutomationLane` / `setParameter`.
   * Returns `-1` when the track, insert, or name is unknown. (The Python binding
   * raises a `SonareError` for an unknown id where Node/WASM return the `-1`
   * sentinel.)
   *
   * This trio is how a mastering processor gets time-varying automation: the
   * `eq.*`, `dynamics.*`, `saturation.*`, `spectral.*`, `stereo.*`,
   * `maximizer.*` and `multiband.*` processors are all available as strip
   * inserts, so placing one on a strip and resolving its parameter here drives
   * it at audio-block precision, live and offline alike. The whole-signal
   * stages of the offline mastering chain (`repair.*`, `loudness`, and the
   * match stages) have no insert form and no automation id: they buffer the
   * entire signal by construction and do not run on the realtime path.
   */
  resolveTrackInsertAutomationId(trackId, insertIndex, paramName) {
    return this.native.resolveTrackInsertAutomationId(trackId, insertIndex, paramName);
  }
  resolveMasterInsertAutomationId(insertIndex, paramName) {
    return this.native.resolveMasterInsertAutomationId(insertIndex, paramName);
  }
  resolveBusInsertAutomationId(busId, insertIndex, paramName) {
    return this.native.resolveBusInsertAutomationId(busId, insertIndex, paramName);
  }
  /**
   * Resolves a hosted instrument's continuous parameter (by its JSON-key name)
   * to the reserved automation id usable with `setAutomationLane` /
   * `setParameter`, so an instrument parameter is driven at audio-block
   * precision exactly like a strip insert. Returns `-1` when the destination
   * has no bound instrument, the instrument exposes no automatable parameters,
   * or the name is unknown.
   *
   * For the NativeSynth ({@link setSynthInstrument}) the names are the
   * continuous {@link SynthPatch} fields: `gain`, `busDrive`, `cutoffHz`,
   * `resonanceQ`, `drive`, `keyTrack`, `envToCutoffCents`, `velToCutoffCents`,
   * `ampAttackMs`, `ampDecayMs`, `ampSustain`, `ampReleaseMs`,
   * `filterAttackMs`, `filterDecayMs`, `filterSustain`, `filterReleaseMs`,
   * `lfoRateHz`, `lfoToPitchCents`, `lfo2RateHz`, `glideMs`, `bodyMix`,
   * `stereoSpread`, `detuneCents`, `driftCents`, `pitchOffsetCents`,
   * `hpCutoffHz`, `sampleHoldHz`, `bitDepth`.
   *
   * Structural fields (`preset`, `engineMode`, `waveform`, `filterModel`,
   * `unison`, `polyphony`, `body`, `modRoutings`) are not automatable and
   * return `-1`: they resize voice pools or swap DSP topology, which is not
   * audio-thread safe. Rebind the instrument with a new patch instead.
   *
   * `gain`, `busDrive`, `cutoffHz`, `resonanceQ`, `envToCutoffCents`,
   * `lfoToPitchCents` and `pitchOffsetCents` reach voices that are already
   * sounding from the next block; the rest are cached into per-voice state at
   * note-on and take effect from the next note, so a lane that moves one of
   * them under a held note looks inert until the next one speaks — that is the
   * behaviour, not a dropped write.
   *
   * The id survives an unbind/rebind of the same destination and applies
   * nothing while that destination is unbound.
   */
  resolveInstrumentAutomationId(destinationId, paramName) {
    return this.native.resolveInstrumentAutomationId(destinationId, paramName);
  }
  /** Sets a track lane strip's pan position in realtime (glitch-free). */
  setTrackStripPan(trackId, pan) {
    this.native.setTrackStripPan(trackId, pan);
  }
  /** Sets a track lane strip's pan law in realtime. */
  setTrackStripPanLaw(trackId, panLaw) {
    this.native.setTrackStripPanLaw(trackId, panLawCode(panLaw));
  }
  /** Sets a track lane strip's pan mode in realtime. */
  setTrackStripPanMode(trackId, panMode) {
    this.native.setTrackStripPanMode(trackId, panModeCode(panMode));
  }
  /** Sets a track lane strip's dual-pan left/right positions in realtime. */
  setTrackStripDualPan(trackId, leftPan, rightPan) {
    this.native.setTrackStripDualPan(trackId, leftPan, rightPan);
  }
  /**
   * Sets a bus strip's output pan position in realtime (glitch-free). Throws
   * for an unknown bus or one wider than stereo.
   */
  setBusStripPan(busId, pan) {
    this.native.setBusStripPan(busId, pan);
  }
  /** Sets a bus strip's pan law in realtime. */
  setBusStripPanLaw(busId, panLaw) {
    this.native.setBusStripPanLaw(busId, panLawCode(panLaw));
  }
  /** Sets a bus strip's pan mode in realtime. */
  setBusStripPanMode(busId, panMode) {
    this.native.setBusStripPanMode(busId, panModeCode(panMode));
  }
  /** Sets a bus strip's dual-pan left/right positions in realtime. */
  setBusStripDualPan(busId, leftPan, rightPan) {
    this.native.setBusStripDualPan(busId, leftPan, rightPan);
  }
  /**
   * Sets a track lane strip's inter-channel alignment delay (whole samples).
   * Adjusts strip latency, so PDC and reported graph latency are refreshed.
   */
  setTrackStripChannelDelaySamples(trackId, delaySamples) {
    this.native.setTrackStripChannelDelaySamples(trackId, delaySamples);
  }
  createClipPageProvider(numChannels, numSamples, pageFrames) {
    const id = this.native.createClipPageProvider(numChannels, numSamples, pageFrames);
    return new ClipPageProvider(this, id);
  }
  supplyClipPage(providerId, pageIndex, channels) {
    this.native.supplyClipPage(providerId, pageIndex, channels);
  }
  clearClipPage(providerId, pageIndex) {
    this.native.clearClipPage(providerId, pageIndex);
  }
  destroyClipPageProvider(providerId) {
    this.native.destroyClipPageProvider(providerId);
  }
  popClipPageRequest() {
    return this.native.popClipPageRequest();
  }
  /**
   * Moves one native request into the binding's persistent scalar scratch.
   * This avoids creating an embind JS object in AudioWorklet process().
   */
  popClipPageRequestToScratch() {
    return this.native.popClipPageRequestToScratch();
  }
  clipPageRequestScratchClipId() {
    return this.native.clipPageRequestScratchClipId();
  }
  clipPageRequestScratchSample() {
    return this.native.clipPageRequestScratchSample();
  }
  /** Cumulative page misses dropped because the native bounded request queue was full. */
  clipPageRequestOverflowCount() {
    return this.native.clipPageRequestOverflowCount();
  }
  /** Cumulative warp-stretch requests dropped because the native queue was full. */
  warpStretchOverflowCount() {
    return this.native.warpStretchOverflowCount();
  }
  /**
   * Sets the number of concurrent time-stretch voices. `voices` must be an
   * integer in `[0, 64]`; a non-integer, negative, or larger value throws and
   * leaves the capacity unchanged. Default is 8. Capacity 0 disables
   * time-stretch, so every warped clip plays resampled instead and none of
   * that counts toward {@link warpStretchOverflowCount}. A change applied
   * while the engine is running restarts the splice state of any clip
   * stretching through a voice at that moment. Control-thread only.
   */
  setWarpVoiceCapacity(voices) {
    this.native.setWarpVoiceCapacity(voices);
  }
  /** Reads the current time-stretch voice capacity (default 8). */
  warpVoiceCapacity() {
    return this.native.warpVoiceCapacity();
  }
  /**
   * Sets the clip-page look-ahead window in timeline frames.
   *
   * The player reports the pages it is *about to* read that are not resident
   * yet, so a streaming host can service them before the audio thread reaches
   * them. Without look-ahead a page miss is only reported after the read
   * already produced silence, which costs one block of silence at every page
   * boundary the host has not primed — the reason a sliding-window streamer
   * cannot keep a live playhead fed from miss reports alone.
   *
   * Look-ahead requests drain through the same `popClipPageRequest` queue and
   * are queued *after* the block's genuine misses, so a host that keeps only
   * the newest request per clip (as {@link ClipPageStreamer} does) tracks the
   * look-ahead frontier.
   *
   * `prepare` defaults this to half a second at the engine's sample rate. `0`
   * disables the look-ahead. A clip whose pages are all resident produces no
   * requests at all, with or without look-ahead. Safe to call during playback.
   */
  setClipPagePrefetchFrames(frames) {
    this.native.setClipPagePrefetchFrames(frames);
  }
  /** Current clip-page look-ahead window in timeline frames. */
  clipPagePrefetchFrames() {
    return this.native.clipPagePrefetchFrames();
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
  setCaptureSource(source) {
    this.native.setCaptureSource(source);
  }
  /** Positive values delay capture relative to the punch window. */
  setRecordOffsetSamples(offsetSamples) {
    this.native.setRecordOffsetSamples(offsetSamples);
  }
  setInputMonitor(enabled, gain = 1) {
    this.native.setInputMonitor(enabled, gain);
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
  /**
   * Renders in place, adding engine output to `channels`. Zero each plane first
   * when it contains no upstream input.
   */
  process(channels) {
    return this.native.process(channels);
  }
  /**
   * Allocates persistent per-channel WASM-heap scratch for the zero-copy
   * `getChannelBuffer` / `processPrepared` realtime path. Call once (off the
   * audio thread) before driving `processPrepared` from an AudioWorklet so the
   * render callback never allocates on the C++/JS heap.
   */
  prepareChannels(numChannels, maxFrames) {
    this.native.prepareChannels(numChannels, maxFrames);
  }
  /**
   * Returns a Float32Array view onto the persistent WASM-heap scratch for one
   * channel (valid for up to `numFrames`). Fill it, call `processPrepared`, then
   * read the same view back. Re-acquire after WASM memory growth.
   */
  getChannelBuffer(channel, numFrames) {
    return this.native.getChannelBuffer(channel, numFrames);
  }
  /**
   * Runs the engine in place over the prepared per-channel scratch buffers.
   * Zero each active span first when it contains no upstream input.
   * Allocation-free: safe to call on the AudioWorklet render thread after
   * `prepareChannels`.
   */
  processPrepared(numFrames) {
    this.native.processPrepared(numFrames);
  }
  /**
   * Allocates the cue-bus counterpart of {@link prepareChannels}. Needed only
   * when PFL/AFL monitoring must reach a separate output: `processPrepared`
   * folds the cue bus into the program output, while
   * {@link processPreparedWithMonitor} keeps the two apart. Call once, off the
   * audio thread, with at least as many channels as `prepareChannels` got.
   */
  prepareMonitorChannels(numChannels, maxFrames) {
    this.native.prepareMonitorChannels(numChannels, maxFrames);
  }
  /**
   * Returns a Float32Array view onto the persistent cue-bus scratch for one
   * channel (valid for up to `numFrames`). Read it after
   * {@link processPreparedWithMonitor}. Re-acquire after WASM memory growth.
   */
  getMonitorChannelBuffer(channel, numFrames) {
    return this.native.getMonitorChannelBuffer(channel, numFrames);
  }
  /**
   * Runs the engine in place over the prepared scratch, writing the cue bus to
   * the monitor scratch instead of folding it into the program output.
   * Allocation-free: safe on the AudioWorklet render thread after
   * `prepareChannels` and `prepareMonitorChannels`.
   */
  processPreparedWithMonitor(numFrames) {
    this.native.processPreparedWithMonitor(numFrames);
  }
  processWithMonitor(channels) {
    return this.native.processWithMonitor(channels);
  }
  renderOffline(channelsOrRequest, blockSize = 128) {
    const request = normalizeRenderOfflineRequest(channelsOrRequest, blockSize);
    return this.native.renderOffline(request.channels, request.blockSize, request.finalize);
  }
  /**
   * End a chunked offline render: release every note the sequencer still holds
   * and flush the PDC / alignment delay lines. Required after
   * `renderOffline({ finalize: false })`; the finalizing form does it itself.
   *
   * Skipping it leaves every note still sounding at the last chunk held. On an
   * engine-internal instrument the tail simply never releases; on a destination
   * marked external ({@link RealtimeEngine.setMidiDestinationExternal}) the
   * note-ons already left through the external MIDI queue, so the note-offs
   * emitted here are the only ones the receiving device will get and the notes
   * otherwise hang outside the engine.
   */
  finishOfflineRender() {
    this.native.finishOfflineRender();
  }
  /**
   * Bounce the timeline to an interleaved buffer. `numChannels` above the
   * prepared channel count throws an `InvalidParameter` `SonareError`.
   */
  bounceOffline(options) {
    return this.native.bounceOffline(options);
  }
  /**
   * Freeze the current graph to audio. `numChannels` above the prepared channel
   * count throws an `InvalidParameter` `SonareError`.
   */
  freezeOffline(options) {
    return this.native.freezeOffline(options);
  }
  drainTelemetry(maxRecords = 1024) {
    return this.native.drainTelemetry(maxRecords);
  }
  popTelemetryToScratch() {
    return this.native.popTelemetryToScratch();
  }
  telemetryScratchType() {
    return this.native.telemetryScratchType();
  }
  telemetryScratchError() {
    return this.native.telemetryScratchError();
  }
  telemetryScratchRenderFrame() {
    return Number(this.native.telemetryScratchRenderFrame());
  }
  telemetryScratchTimelineSample() {
    return Number(this.native.telemetryScratchTimelineSample());
  }
  telemetryScratchAudibleTimelineSample() {
    return Number(this.native.telemetryScratchAudibleTimelineSample());
  }
  telemetryScratchGraphLatencySamplesQ8() {
    return this.native.telemetryScratchGraphLatencySamplesQ8();
  }
  telemetryScratchValue() {
    return this.native.telemetryScratchValue();
  }
  popMeterTelemetryToScratch() {
    return this.native.popMeterTelemetryToScratch();
  }
  meterScratchTargetId() {
    return this.native.meterScratchTargetId();
  }
  meterScratchRenderFrame() {
    return Number(this.native.meterScratchRenderFrame());
  }
  meterScratchValue(field) {
    return this.native.meterScratchValue(field);
  }
  drainMeterTelemetry(maxRecords = 1024) {
    return this.native.drainMeterTelemetry(maxRecords);
  }
  /**
   * Drains pending meter telemetry as per-plane (wide) records for a surround
   * target. Use this for a surround mix target; {@link drainMeterTelemetry}
   * stays the stereo fast path. The two share one queue — call only one per
   * target. The live AudioWorklet path owns the queue via the stereo drain, so
   * this wide drain is for an offline (non-worklet) engine instance; per-plane
   * surround meters are not delivered over the live worklet meter ring.
   */
  drainMeterTelemetryWide(maxRecords = 1024) {
    return this.native.drainMeterTelemetryWide(maxRecords);
  }
  /**
   * Enables per-target spectrum + vectorscope capture. @param intervalFrames is
   * the minimum render-frame gap between snapshots (0 disables). @param bandCount
   * is the FFT band resolution (1..64); changing it re-prepares the tap. Returns
   * the band count actually applied.
   */
  configureScopeTelemetry(intervalFrames, bandCount) {
    return this.native.configureScopeTelemetry(intervalFrames, bandCount);
  }
  /** Drains pending spectrum + vectorscope snapshots (per mix target). */
  drainScopeTelemetry(maxRecords = 1024) {
    return this.native.drainScopeTelemetry(maxRecords);
  }
  popScopeTelemetryToScratch() {
    return this.native.popScopeTelemetryToScratch();
  }
  scopeScratchTargetId() {
    return this.native.scopeScratchTargetId();
  }
  scopeScratchRenderFrame() {
    return Number(this.native.scopeScratchRenderFrame());
  }
  scopeScratchBandCount() {
    return this.native.scopeScratchBandCount();
  }
  scopeScratchBand(index) {
    return this.native.scopeScratchBand(index);
  }
  scopeScratchPointCount() {
    return this.native.scopeScratchPointCount();
  }
  scopeScratchPointLeft(index) {
    return this.native.scopeScratchPointLeft(index);
  }
  scopeScratchPointRight(index) {
    return this.native.scopeScratchPointRight(index);
  }
  /** Release the underlying WASM object. Safe to call only once. */
  destroy() {
    this.native.delete();
  }
  /** Alias for {@link destroy}, matching embind's own release method name. */
  delete() {
    this.destroy();
  }
};
var ClipPageProvider = class {
  constructor(engine, id) {
    this.engine = engine;
    this.id = id;
    this.disposed = false;
  }
  supply(pageIndex, channels) {
    if (this.disposed) {
      throw new Error("ClipPageProvider is destroyed");
    }
    this.engine.supplyClipPage(this.id, pageIndex, channels);
  }
  clear(pageIndex) {
    if (this.disposed) {
      return;
    }
    this.engine.clearClipPage(this.id, pageIndex);
  }
  destroy() {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.engine.destroyClipPageProvider(this.id);
  }
};

// src/scale.ts
function scaleQuantizeMidi(root, modeMask, midi, referenceMidi = 0) {
  assertFiniteScalar("scaleQuantizeMidi", midi, "midi");
  assertFiniteScalar("scaleQuantizeMidi", referenceMidi, "referenceMidi");
  return getSonareModule().scaleQuantizeMidi(root, modeMask, midi, referenceMidi);
}
function scaleCorrectionSemitones(root, modeMask, midi, referenceMidi = 0) {
  assertFiniteScalar("scaleCorrectionSemitones", midi, "midi");
  assertFiniteScalar("scaleCorrectionSemitones", referenceMidi, "referenceMidi");
  return getSonareModule().scaleCorrectionSemitones(root, modeMask, midi, referenceMidi);
}
function scalePitchClassEnabled(root, modeMask, pitchClass) {
  return getSonareModule().scalePitchClassEnabled(root, modeMask, pitchClass);
}

// src/stream_analyzer.ts
function streamAnalyzerConfigDefaults() {
  return getSonareModule().streamAnalyzerConfigDefault();
}
var StreamAnalyzer = class {
  /**
   * Create a new StreamAnalyzer.
   *
   * @param config - Configuration options
   */
  constructor(config = {}) {
    if (config.computeMagnitude) {
      throw new Error(
        "computeMagnitude is not supported because magnitude frames are not exposed by StreamAnalyzer read paths."
      );
    }
    if (config.outputFormat !== void 0 && (typeof config.outputFormat !== "number" || !Number.isFinite(config.outputFormat) || !Number.isInteger(config.outputFormat) || config.outputFormat !== 0)) {
      throw new TypeError("outputFormat must be the integer 0 (Float32)");
    }
    const window = config.window === void 0 ? void 0 : resolveOrdinalInRange(config.window, 0, 3, "stream analyzer window");
    const module2 = getSonareModule();
    const defaults = streamAnalyzerConfigDefaults();
    this.analyzer = new module2.StreamAnalyzer(
      config.sampleRate ?? defaults.sampleRate,
      config.nFft ?? defaults.nFft,
      config.hopLength ?? defaults.hopLength,
      config.nMels ?? defaults.nMels,
      config.fmin ?? defaults.fmin,
      config.fmax ?? defaults.fmax,
      config.tuningRefHz ?? defaults.tuningRefHz,
      config.computeMagnitude ?? defaults.computeMagnitude,
      config.computeMel ?? defaults.computeMel,
      config.computeChroma ?? defaults.computeChroma,
      config.computeOnset ?? defaults.computeOnset,
      config.computeSpectral ?? defaults.computeSpectral,
      config.emitEveryNFrames ?? defaults.emitEveryNFrames,
      config.magnitudeDownsample ?? defaults.magnitudeDownsample,
      config.maxPendingFrames ?? defaults.maxPendingFrames,
      config.maxProgressionEntries ?? defaults.maxProgressionEntries,
      config.keyUpdateIntervalSec ?? defaults.keyUpdateIntervalSec,
      config.bpmUpdateIntervalSec ?? defaults.bpmUpdateIntervalSec,
      window ?? defaults.window,
      config.outputFormat ?? defaults.outputFormat
    );
  }
  /**
   * Process audio samples.
   *
   * Feeding a finalized analyzer is an invalid-state error; call `reset()`
   * first to start a new stream.
   *
   * @param samples - Audio samples (mono, float32)
   */
  process(samples) {
    this.analyzer.process(samples);
  }
  /**
   * Process audio samples with a contiguous explicit sample offset. A gap,
   * seek, or switch from `process()` requires `reset()` first, as does feeding
   * a finalized analyzer.
   *
   * @param samples - Audio samples (mono, float32)
   * @param sampleOffset - Cumulative sample count at start of this chunk
   */
  processWithOffset(samples, sampleOffset) {
    this.analyzer.processWithOffset(samples, sampleOffset);
  }
  /**
   * Drain any high-rate resampler tail, then zero-pad the final partial frame.
   *
   * Repeating a successful call is a no-op, and a call that fails leaves the
   * stream un-finalized so a retry resumes from the same point. Call `reset()`
   * before reusing the analyzer for another stream: more audio fed to a
   * finalized analyzer is rejected rather than silently analyzed without the
   * overlap context the finalized tail consumed.
   */
  finalize() {
    this.analyzer.finalize();
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
   * Read frames as uint8-quantized arrays.
   *
   * @param maxFrames - Maximum number of frames to read
   * @param quantizeConfig - Optional quantization ranges; widen these for a
   *   stream louder or quieter than the defaults (omitted keeps the defaults)
   */
  readFramesU8(maxFrames, quantizeConfig) {
    return this.analyzer.readFramesU8(maxFrames, quantizeConfig);
  }
  /**
   * Read frames as int16-quantized arrays.
   *
   * @param maxFrames - Maximum number of frames to read
   * @param quantizeConfig - Optional quantization ranges; widen these for a
   *   stream louder or quieter than the defaults (omitted keeps the defaults)
   */
  readFramesI16(maxFrames, quantizeConfig) {
    return this.analyzer.readFramesI16(maxFrames, quantizeConfig);
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
      pendingFrames: s.pendingFrames,
      droppedOutputFrames: s.droppedOutputFrames,
      droppedChordProgressionEntries: s.droppedChordProgressionEntries,
      droppedBarProgressionEntries: s.droppedBarProgressionEntries,
      nonFiniteDiscardBlocks: s.nonFiniteDiscardBlocks,
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
   * Throws for a value outside 0.01..100 rather than clamping into it. The
   * usual recipe (`gain = targetLevel / measuredLevel`) can land outside that
   * range for a buffer that is not in the conventional ±1 float domain — an
   * integer-scaled one asks for about 3e-4 — and no getter exposes the
   * effective gain, so a clamped request would leave the analysis far off
   * target undetectably. Convert such a buffer before feeding it instead.
   *
   * @param gain - Gain factor to apply (e.g., 0.5 for -6dB reduction, range
   *   0.01..100)
   */
  setNormalizationGain(gain) {
    this.analyzer.setNormalizationGain(gain);
  }
  /**
   * Set tuning reference frequency for non-standard tuning.
   *
   * Throws for a value outside 220..880 Hz rather than clamping into it, so
   * this and `tuningRefHz` at create time accept exactly the same range.
   *
   * @param refHz - Reference frequency for A4 (default 440 Hz, range 220..880)
   * @example
   * // If audio is 1 semitone sharp (A4 = 466.16 Hz)
   * analyzer.setTuningRefHz(466.16);
   * // If audio is 1 semitone flat (A4 = 415.30 Hz)
   * analyzer.setTuningRefHz(415.30);
   */
  setTuningRefHz(refHz) {
    this.analyzer.setTuningRefHz(refHz);
  }
  /** Release the underlying WASM object. Safe to call only once. */
  delete() {
    this.analyzer.delete();
  }
  /** Alias for {@link delete}, provided for cross-binding (Node) compatibility. */
  destroy() {
    this.delete();
  }
  /** Alias for {@link delete}, kept for backward compatibility (historical name). */
  dispose() {
    this.delete();
  }
};

// src/mixer.ts
var Mixer = class _Mixer {
  constructor(mixer, blockSize) {
    this.mixer = mixer;
    this.blockSize = blockSize;
  }
  /**
   * Build a mixer from a scene JSON string.
   *
   * A strip's meters are sized when the strip is built, so this is where their
   * configuration is chosen: an optional `metering` object on the strip
   * (`enabled` / `lufs` / `truePeak` / `truePeakOversample`) selects it, and
   * leaving it out keeps the full default (LUFS + true peak at 4x, about 1.4 MB
   * per strip at 48 kHz). `{"enabled": false}` drops both meters for a strip
   * whose snapshots are never read.
   *
   * @param json - Scene JSON (strips, buses, sends, connections, inserts)
   * @param sampleRate - Sample rate in Hz (default: 48000)
   * @param blockSize - Maximum block size per {@link processStereo} call (default: 512)
   */
  static fromSceneJson(json, sampleRate = 48e3, blockSize = 512) {
    const module2 = getSonareModule();
    return new _Mixer(module2.createMixerFromSceneJson(json, sampleRate, blockSize), blockSize);
  }
  /**
   * Rebuild and compile the routing graph without resetting its absolute
   * automation sample position or queued strip automation.
   */
  compile() {
    this.mixer.compile();
  }
  /**
   * Non-fatal warnings captured when this mixer was built from scene JSON: one
   * entry per channel-strip insert that was handed param keys it does not read
   * (a likely typo, or a key meant for a different processor). The scene still
   * loaded; these keys simply took no effect. Empty when every key was consumed.
   * Use {@link masteringInsertParamNames} to discover the keys an insert accepts.
   */
  sceneWarnings() {
    return this.mixer.sceneWarnings();
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
    let leftInputs = [];
    let rightInputs = [];
    let outLeft = this.mixer.outputLeftView();
    let outRight = this.mixer.outputRightView();
    const acquire = () => {
      leftInputs = [];
      rightInputs = [];
      for (let index = 0; index < stripCount; index++) {
        leftInputs.push(this.mixer.inputLeftView(index));
        rightInputs.push(this.mixer.inputRightView(index));
      }
      outLeft = this.mixer.outputLeftView();
      outRight = this.mixer.outputRightView();
    };
    acquire();
    const reacquireIfDetached = () => {
      if (outLeft.byteLength === 0 || (leftInputs[0]?.byteLength ?? 1) === 0) {
        acquire();
      }
    };
    return {
      get leftInputs() {
        reacquireIfDetached();
        return leftInputs;
      },
      get rightInputs() {
        reacquireIfDetached();
        return rightInputs;
      },
      get outLeft() {
        reacquireIfDetached();
        return outLeft;
      },
      get outRight() {
        reacquireIfDetached();
        return outRight;
      },
      process: (numSamples = outLeft.length) => {
        reacquireIfDetached();
        this.mixer.processPreparedStereo(numSamples);
      }
    };
  }
  /**
   * Turn the master-output meter on or off.
   *
   * While on, every {@link MixerRealtimeBuffer.process} call meters the stereo
   * master it just produced, so a caller reads {@link meterSnapshot} instead of
   * copying the output and measuring it again. `truePeakDb*` is an inter-sample
   * peak taken after oversampling (ITU-R BS.1770-4 Annex 2 requires at least
   * 4x), which is a different and higher quantity than the sample peak.
   *
   * Enabling resets the meter, so a reading never mixes in audio from a period
   * when metering was off.
   *
   * @param enabled - Whether to meter the master output.
   * @param truePeakOversample - 0 (= 4x) or a power of two in [1, 16].
   */
  configureMeter(enabled, truePeakOversample = 4) {
    this.mixer.configureMeter(enabled, truePeakOversample);
  }
  /**
   * Latest master-output meter reading, describing the most recently metered
   * block. All dB fields are finite and floored at -120.
   *
   * @throws When the meter has never been enabled.
   */
  meterSnapshot() {
    return this.mixer.meterSnapshot();
  }
  /**
   * Latch the latest meter reading into the mixer's internal scratch so
   * {@link meterScratchValue} can read it back one number at a time.
   *
   * This is the allocation-free form of {@link meterSnapshot}, for an audio
   * render callback that must not create a JS object per interval. It returns
   * `false` instead of throwing when the meter has never been enabled.
   *
   * @returns Whether a reading was latched.
   */
  latchMeterSnapshot() {
    return this.mixer.latchMeterSnapshot();
  }
  /**
   * Read one field of the snapshot latched by {@link latchMeterSnapshot}.
   *
   * @param field - `0` peakDbL, `1` peakDbR, `2` rmsDbL, `3` rmsDbR,
   *   `4` correlation, `5` truePeakDbL, `6` truePeakDbR. Any other index
   *   reads `0`.
   */
  meterScratchValue(field) {
    return this.mixer.meterScratchValue(field);
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
   * Add a channel strip to the mixer topology. `metering` configures the strip's
   * pre/post taps; omitting it keeps the full default (LUFS + true peak at 4x,
   * about 1.4 MB per strip at 48 kHz). Marks the routing graph dirty; call
   * {@link compile} (or {@link processStereo}) to rebuild.
   *
   * @throws If the id is already taken, or `truePeakOversample` is outside `[0, 16]`
   */
  addStrip(id, metering = {}) {
    this.mixer.addStrip(id, metering);
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
  /** Set an existing VCA group's gain in dB. */
  setVcaGroupGainDb(id, gainDb) {
    this.mixer.setVcaGroupGainDb(id, gainDb);
  }
  /** Replace an existing VCA group's strip membership. */
  setVcaGroupMembers(id, members) {
    this.mixer.setVcaGroupMembers(id, members);
  }
  /** Remove a VCA group by id. */
  removeVcaGroup(id) {
    this.mixer.removeVcaGroup(id);
  }
  /** Number of VCA groups in the mixer topology. */
  vcaGroupCount() {
    return this.mixer.vcaGroupCount();
  }
  /** Set the strip's input trim in dB. */
  setInputTrimDb(stripIndex, db) {
    this.mixer.setInputTrimDb(stripIndex, db);
  }
  /** Set the strip's fader level in dB. */
  setFaderDb(stripIndex, db) {
    this.mixer.setFaderDb(stripIndex, db);
  }
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
  setPan(stripIndex, pan, panMode) {
    const mode = panMode === void 0 ? -1 : panModeCode(panMode);
    this.mixer.setPan(stripIndex, pan, mode);
  }
  /** Set the strip's stereo width. */
  setWidth(stripIndex, width) {
    this.mixer.setWidth(stripIndex, width);
  }
  /**
   * Snap the strip's input-trim, fader, pan and width smoothers to the values
   * already set on it, so the next processed block opens at those values
   * instead of gliding to them over the smoothing window (~5 ms).
   *
   * Call it after configuring a strip and before rendering a finite buffer: a
   * strip is smoothed for a live fader, and an offline render that does not
   * settle carries that glide as a level and image sweep across the head of
   * its output. Unlike a reset it clears nothing — automation, meters and
   * insert state are untouched.
   *
   * @param stripIndex - Strip index in `[0, stripCount())`
   *
   * @example
   * ```typescript
   * mixer.setFaderDb(0, -3);
   * mixer.setPan(0, 0.3);
   * mixer.settle(0);
   * const { left, right } = mixer.processStereo([dryLeft], [dryRight]);
   * ```
   */
  settle(stripIndex) {
    this.mixer.settle(stripIndex);
  }
  /** Set the strip's mute state. */
  setMuted(stripIndex, muted) {
    this.mixer.setMuted(stripIndex, muted);
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
  /** Set the strip's pan law (a {@link PanLawName} alias or raw C ABI ordinal). */
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
   * Set the strip's surround pan position, used when it feeds a >2-channel bus.
   *
   * Applied when the engine's track mixer renders this strip's lane into a
   * destination with more than two channels. This stereo-only mixer's own
   * block entry points ignore it.
   */
  setSurroundPan(stripIndex, pan) {
    this.mixer.setSurroundPan(stripIndex, pan);
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
  addSend(stripIndex, id, destinationBusId, sendDb = 0, timing = "postFader") {
    return this.mixer.addSend(stripIndex, id, destinationBusId, sendDb, sendTimingCode(timing));
  }
  /** Set the send level (in dB) for an existing send by index. */
  setSendDb(stripIndex, sendIndex, sendDb) {
    this.mixer.setSendDb(stripIndex, sendIndex, sendDb);
  }
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
  removeSend(stripIndex, sendIndex) {
    this.mixer.removeSend(stripIndex, sendIndex);
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
  stripMeter(stripIndex, tap) {
    if (tap === void 0) {
      return this.mixer.stripMeter(stripIndex);
    }
    return this.mixer.meterTap(stripIndex, meterTapCode(tap));
  }
  /** Read the post-insert meter for a compiled bus, including master. */
  busMeter(busId) {
    return this.mixer.busMeter(busId);
  }
  /**
   * Number of blocks in which the strip discarded recursive state because a
   * non-finite value had reached it.
   *
   * Advisory telemetry, and the only thing that separates a degraded strip
   * from a clean one. A discard returns the affected state to its
   * post-reset value, so the strip recovers in silence and the output stays
   * finite and in range while carrying samples unrelated to the input;
   * nothing else reports that this happened.
   *
   * The count covers the strip's own state, its EQ, every insert it owns and
   * both of its meters. None of those is separately addressable here, so a
   * discard inside one is observable only through this number -- and a
   * meter that loses its loudness window then reports the floor, which is
   * exactly what a genuinely silent strip reports, so nothing else
   * distinguishes the two.
   *
   * A meter's own discard lags by one block: it checks its loudness state at
   * the top of a block, before consuming that block's samples, so the block
   * that corrupts it is not the block the count moves on -- read this again
   * after one more block has processed. The EQ and inserts have no such lag;
   * they discard at the end of their own process, in the same block that
   * carried the poison.
   *
   * Cumulative since the strip was created and never cleared, so two
   * readings bracket a span of audio. The unit is one processed block, never
   * a channel, so a stereo block that discards on both channels adds one and
   * the number does not depend on a dimension the caller did not choose.
   *
   * @param stripIndex - Strip index in `[0, stripCount())`
   */
  stripNonFiniteDiscardCount(stripIndex) {
    return this.mixer.stripNonFiniteDiscardCount(stripIndex);
  }
  /**
   * Number of blocks in which a bus discarded recursive state because a
   * non-finite value had reached it. Same contract as
   * {@link stripNonFiniteDiscardCount}, for a bus: covers every insert the
   * bus owns and its meter, neither separately addressable, so a discard
   * inside one is observable only here. Cumulative across graph recompiles
   * -- the count lives with the bus, not the compiled node, so an unrelated
   * edit elsewhere in the mixer does not reset it.
   *
   * A bus's DSP record is created by the first {@link compile}. Throws for a
   * bus that has been declared with {@link addBus} but never compiled --
   * reading zero there would read as clean, and it is not. Also throws for
   * an unknown bus id.
   *
   * @param busId - Bus id, as passed to {@link addBus} or declared in scene JSON
   */
  busNonFiniteDiscardCount(busId) {
    return this.mixer.busNonFiniteDiscardCount(busId);
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
   *
   * `maxPoints` must be a finite non-negative integer; anything else throws an
   * `InvalidParameter` error. It is a request rather than an allocation size —
   * a value beyond the strip's goniometer ring simply returns every point the
   * ring holds.
   */
  readGoniometerLatest(stripIndex, maxPoints) {
    return this.mixer.readGoniometerLatest(stripIndex, maxPoints);
  }
  /** Serialize the current scene (strips, buses, sends, connections) to JSON. */
  toSceneJson() {
    return this.mixer.toSceneJson();
  }
  /**
   * Longest audible serial processor-tail path to the master, in samples. Lazily
   * compiles the routing graph if the topology is dirty.
   */
  tailSamples() {
    return this.mixer.tailSamples();
  }
  /**
   * Reported latency (samples) of the compiled mixer graph, for aligning
   * dry/wet material. Lazily compiles the routing graph if the topology is dirty.
   */
  latencySamples() {
    return this.mixer.latencySamples();
  }
  /**
   * Drain delayed / tail audio by processing a zero-input block of `numSamples`
   * frames after the host stops feeding strip inputs. Returns the mixed stereo
   * master (`left`, `right`, `sampleRate`).
   */
  drainTailStereo(numSamples) {
    if (!Number.isSafeInteger(numSamples) || numSamples <= 0 || numSamples > this.blockSize) {
      throw new RangeError(
        `Mixer.drainTailStereo: numSamples must be an integer in [1, ${this.blockSize}]`
      );
    }
    return this.mixer.drainTailStereo(numSamples);
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

// src/realtime_voice_changer.ts
var RealtimeVoiceChanger = class {
  /**
   * Creates a voice changer. Supplying `sampleRate` prepares it immediately,
   * matching the Node and Python constructors; omitting it preserves the
   * explicit {@link prepare} lifecycle for callers that configure later.
   */
  constructor(config = "neutral-monitor", sampleRate, maxBlockSize = 128, channels = 1) {
    const module2 = getSonareModule();
    this.changer = module2.createRealtimeVoiceChanger(config);
    if (sampleRate !== void 0) {
      let prepared = false;
      try {
        this.changer.prepare(sampleRate, maxBlockSize, channels);
        prepared = true;
      } finally {
        if (!prepared) {
          this.changer.delete();
        }
      }
    }
  }
  prepare(sampleRate, maxBlockSize = 128, channels = 1) {
    this.changer.prepare(sampleRate, maxBlockSize, channels);
  }
  reset() {
    this.changer.reset();
  }
  setConfig(config) {
    this.changer.setConfig(config);
  }
  /**
   * Apply a flat, pre-normalized config without JSON serialization. Intended
   * for AudioWorklet control messages whose sender prepared the POD on the
   * main thread.
   */
  setPodConfig(config) {
    this.changer.setPodConfig(config);
  }
  configJson() {
    return this.changer.configJson();
  }
  latencySamples() {
    return this.changer.latencySamples();
  }
  /**
   * Channel-blocks in which the chain discarded its own state because a
   * non-finite value had reached it.
   *
   * Advisory telemetry, and the only thing that separates a degraded stream
   * from a clean one. Every stage of this chain leaves an in-domain finite
   * value where a non-finite one was — the input scrub and the
   * inter-sample-peak limiter substitute silence, the sample-domain limiter
   * folds an infinity onto its ceiling — so the output stays finite, in range
   * and free of any error while carrying samples unrelated to the input. A
   * non-zero count is what says the samples in between were not computed from
   * what you supplied.
   *
   * Monotonic for the lifetime of the instance. The unit is one processed
   * block, never a channel, so a stereo block that discards on both channels
   * adds one and the number does not depend on a dimension you did not choose.
   *
   * @example
   * ```ts
   * changer.processInterleaved(block, 2);
   * if (changer.nonFiniteDiscardCount() > 0) {
   *   // the audio just produced is not a function of `block`
   * }
   * ```
   */
  nonFiniteDiscardCount() {
    return this.changer.nonFiniteDiscardCount();
  }
  /**
   * Monotonically increases whenever {@link prepare} can replace the native
   * scratch buffers. Cached WASM heap views must be reacquired after it changes.
   */
  bufferGeneration() {
    return this.changer.bufferGeneration();
  }
  processMono(samples) {
    return this.changer.processMono(samples);
  }
  processMonoInto(samples, output) {
    this.changer.processMonoInto(samples, output);
  }
  processInterleaved(samples, channels) {
    return this.changer.processInterleaved(samples, channels);
  }
  processInterleavedInto(samples, channels, output) {
    this.changer.processInterleavedInto(samples, channels, output);
  }
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
  getMonoInputBuffer(numSamples) {
    return this.changer.getMonoInputBuffer(numSamples);
  }
  /** Mono output view counterpart to {@link getMonoInputBuffer}. */
  getMonoOutputBuffer(numSamples) {
    return this.changer.getMonoOutputBuffer(numSamples);
  }
  /**
   * Process the previously-acquired mono input buffer in place. The output
   * appears in the buffer returned by {@link getMonoOutputBuffer}. No JS↔C++
   * sample-level crossings happen on this call — it just hands control to
   * the underlying DSP on already-on-heap data.
   */
  processPreparedMono(numSamples) {
    this.changer.processPreparedMono(numSamples);
  }
  /** Interleaved input view (layout L0,R0,L1,R1,...). */
  getInterleavedInputBuffer(numFrames, numChannels) {
    return this.changer.getInterleavedInputBuffer(numFrames, numChannels);
  }
  /** Interleaved output view counterpart. */
  getInterleavedOutputBuffer(numFrames, numChannels) {
    return this.changer.getInterleavedOutputBuffer(numFrames, numChannels);
  }
  /**
   * Process the previously-acquired interleaved buffer in place. Output
   * appears in the buffer returned by {@link getInterleavedOutputBuffer}.
   */
  processPreparedInterleaved(numFrames, numChannels) {
    this.changer.processPreparedInterleaved(numFrames, numChannels);
  }
  /**
   * Planar-channel input/output view (one Float32Array per channel). Matches
   * AudioWorklet's native layout; processing happens in place.
   */
  getPlanarChannelBuffer(channel, numFrames) {
    return this.changer.getPlanarChannelBuffer(channel, numFrames);
  }
  /**
   * Process the previously-acquired planar channel buffers in place. Each
   * channel must have been obtained from {@link getPlanarChannelBuffer}
   * with the same `numFrames`. Output replaces input in the same buffers.
   */
  processPreparedPlanar(numFrames) {
    this.changer.processPreparedPlanar(numFrames);
  }
  /**
   * Convenience factory for the mono zero-copy path: returns the input/output
   * heap views plus a `process()` thunk wired to the same `numSamples`. The
   * views are reused across calls and become invalid after {@link delete}.
   */
  createRealtimeMonoBuffer(numSamples) {
    let input = this.getMonoInputBuffer(numSamples);
    let output = this.getMonoOutputBuffer(numSamples);
    let generation = this.bufferGeneration();
    const reacquireIfDetached = () => {
      if (generation !== this.bufferGeneration() || input.byteLength === 0 || output.byteLength === 0) {
        input = this.getMonoInputBuffer(numSamples);
        output = this.getMonoOutputBuffer(numSamples);
        generation = this.bufferGeneration();
      }
    };
    return {
      get input() {
        reacquireIfDetached();
        return input;
      },
      get output() {
        reacquireIfDetached();
        return output;
      },
      process: () => {
        reacquireIfDetached();
        this.processPreparedMono(numSamples);
      }
    };
  }
  /** Same as {@link createRealtimeMonoBuffer} but for interleaved I/O. */
  createRealtimeInterleavedBuffer(numFrames, numChannels) {
    let input = this.getInterleavedInputBuffer(numFrames, numChannels);
    let output = this.getInterleavedOutputBuffer(numFrames, numChannels);
    let generation = this.bufferGeneration();
    const reacquireIfDetached = () => {
      if (generation !== this.bufferGeneration() || input.byteLength === 0 || output.byteLength === 0) {
        input = this.getInterleavedInputBuffer(numFrames, numChannels);
        output = this.getInterleavedOutputBuffer(numFrames, numChannels);
        generation = this.bufferGeneration();
      }
    };
    return {
      get input() {
        reacquireIfDetached();
        return input;
      },
      get output() {
        reacquireIfDetached();
        return output;
      },
      channels: numChannels,
      process: () => {
        reacquireIfDetached();
        this.processPreparedInterleaved(numFrames, numChannels);
      }
    };
  }
  /**
   * Convenience factory for the planar zero-copy path. Acquires one
   * heap-backed Float32Array per channel and returns a `process()` thunk
   * wired to the same `numFrames`. Buffers are reused across calls and
   * become invalid after {@link delete}.
   */
  createRealtimePlanarBuffer(numFrames, numChannels) {
    let channels = [];
    let generation = this.bufferGeneration();
    const acquire = () => {
      channels = [];
      for (let ch = 0; ch < numChannels; ch++) {
        channels.push(this.getPlanarChannelBuffer(ch, numFrames));
      }
      generation = this.bufferGeneration();
    };
    acquire();
    const reacquireIfDetached = () => {
      if (generation !== this.bufferGeneration() || (channels[0]?.byteLength ?? 0) === 0) {
        acquire();
      }
    };
    return {
      get channels() {
        reacquireIfDetached();
        return channels;
      },
      process: () => {
        reacquireIfDetached();
        this.processPreparedPlanar(numFrames);
      }
    };
  }
  delete() {
    this.changer.delete();
  }
  /** Alias for {@link delete}, provided for cross-binding (Node) compatibility. */
  destroy() {
    this.delete();
  }
};
function realtimeVoiceChangerPresetNames() {
  return Array.from(getSonareModule().realtimeVoiceChangerPresetNames());
}
function realtimeVoiceChangerPresetJson(name) {
  return getSonareModule().realtimeVoiceChangerPresetJson(name);
}
function validateRealtimeVoiceChangerPresetJson(json) {
  return getSonareModule().validateRealtimeVoiceChangerPresetJson(json);
}

// src/streaming_processors.ts
var EQ_PLACEMENTS = {
  stereo: 0,
  left: 1,
  right: 2,
  mid: 3,
  side: 4
};
var EQ_PHASE_MODES = {
  zero: 1,
  "zero-latency": 1,
  zero_latency: 1,
  natural: 2,
  "natural-phase": 2,
  natural_phase: 2,
  linear: 3,
  "linear-phase": 3,
  linear_phase: 3
};
var StreamingMasteringChain = class {
  constructor(config) {
    const module2 = getSonareModule();
    const { loudnessStaticGainDb, loudnessStaticGainPeakDb, ...chainConfig } = config;
    this.chain = module2.createStreamingMasteringChain({
      __flatParams: flattenChainConfig(chainConfig),
      loudnessStaticGainDb,
      loudnessStaticGainPeakDb
    });
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
  /**
   * Emit delayed audio and finite processor tails after the final mono block.
   * Call until this returns an empty array. The initial `latencySamples()`
   * samples of the concatenated stream are delayed and should be discarded for
   * time-aligned output.
   */
  flushMono() {
    return this.chain.flushMono();
  }
  /** Stereo counterpart of {@link flushMono}. */
  flushStereo() {
    return this.chain.flushStereo();
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
  /**
   * Samples a stage replaced with a finite in-domain one, keeping the output
   * finite and in range.
   *
   * A non-finite sample supplied by the caller is rejected before any stage
   * runs, so a replacement is always of a value a stage itself produced.
   *
   * Only the true-peak limiters replace anything, so with the maximizer's
   * limiter and the loudness stage both disabled a zero here means no stage was
   * able to replace anything rather than that nothing needed replacing.
   *
   * Cumulative over every block since {@link prepare}, and aggregated over the
   * stages and channels, so it identifies neither which block nor which stage.
   * Read it per block and compare against the previous reading to localize one.
   *
   * {@link prepare} rebuilds the stages and so clears it; {@link reset} does
   * not, because it drops processor state without rebuilding.
   *
   * @example
   * ```typescript
   * chain.processMono(block);
   * if (chain.nonFiniteSubstitutionCount() > previous) {
   *   // the block just produced is not derived from `block` everywhere
   * }
   * ```
   */
  nonFiniteSubstitutionCount() {
    return this.chain.nonFiniteSubstitutionCount();
  }
  /**
   * Processing calls in which a stage discarded its own recursive state
   * because a non-finite value had reached it.
   *
   * The companion to {@link nonFiniteSubstitutionCount}, and not the same
   * measurement -- a caller who assumes they are will read one and think
   * they have the other. That one counts SAMPLES a stage replaced and so
   * sums across stages; a discard is a whole stage returning to its
   * post-reset value and is counted once per call however many stages did
   * it. A stage may run more than once per call, which is why this is a
   * delta over the call and never a sum.
   *
   * Non-finite input is rejected before any stage runs, so what a stage
   * discards is always state it produced itself -- a finite sample large
   * enough to overflow inside a filter, most often. Unlike the substitution
   * count every stage can contribute, so a zero here means no stage
   * discarded rather than that none could.
   *
   * Both {@link processMono}/{@link processStereo} and
   * {@link flushMono}/{@link flushStereo} count, since a flush drives the
   * same stages. {@link prepare} rebuilds the stages and so clears it (as it
   * does {@link nonFiniteSubstitutionCount}, so the two counters on one
   * handle share an epoch); {@link reset} does not, because it drops
   * processor state without rebuilding.
   */
  nonFiniteDiscardCount() {
    return this.chain.nonFiniteDiscardCount();
  }
  /** Release the underlying WASM object. Safe to call only once. */
  delete() {
    this.chain.delete();
  }
  /** Alias for {@link delete}, provided for cross-binding (Node) compatibility. */
  destroy() {
    this.delete();
  }
};
var StreamingEqualizer = class {
  constructor(config = {}) {
    const module2 = getSonareModule();
    this.eq = module2.createEqualizer(config);
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
   * Set the global phase mode: `'zero'` | `'natural'` | `'linear'` or 1/2/3.
   */
  setPhaseMode(mode) {
    const value = typeof mode === "number" ? mode : EQ_PHASE_MODES[mode.toLowerCase()];
    if (value === void 0) {
      throw new Error(`unknown EQ phase mode: ${mode}`);
    }
    this.eq.setPhaseMode(value);
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
   * Number of blocks in which the EQ discarded recursive state because a
   * non-finite value had reached it.
   *
   * Advisory telemetry, and the only thing that separates a degraded EQ from
   * a clean one. A discard returns the affected filter cells to their
   * post-reset value, so the EQ recovers in silence and the output stays
   * finite and in range while carrying samples unrelated to the input;
   * nothing else reports that this happened.
   *
   * The count covers every IIR plane the band layout uses -- stereo, per
   * channel, and mid/side -- together with the automatic output gain and the
   * detector state the dynamic bands drive. Linear-phase bands are not
   * included and have nothing to include: an FIR keeps no recursive state,
   * so a non-finite sample leaves its history on its own.
   *
   * Unlike a mixer strip's meters, nothing here lags: this EQ has no meter of
   * its own, so a discard is always attributed to the block that carried it.
   *
   * Cumulative since this handle was created and never cleared, so two
   * readings bracket a span of audio. The unit is one processed block, never
   * a channel or a plane.
   */
  nonFiniteDiscardCount() {
    return this.eq.nonFiniteDiscardCount();
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
   * The composite magnitude of the bands, in dB, at each requested frequency —
   * the curve to draw over {@link spectrum}.
   *
   * Built from the same coefficient design, tilt expansion and cut-slope
   * cascade the audio path uses, so it states what the equalizer does rather
   * than what its settings look like, and it carries the output gain, the gain
   * scale and whatever each dynamic band is applying at the moment of the call.
   * Disabled, bypassed and — when anything is soloed — unsoloed bands drop out,
   * and a soloed band is drawn as the band pass it is heard as.
   *
   * `placement` selects which signal path the curve is for. A band placed on
   * `'Stereo'` is on every path; one placed elsewhere appears only on its own,
   * a mid band having no per-channel magnitude to fold into a left or right
   * curve. Frequencies are clamped to [0 Hz, Nyquist].
   *
   * @example
   * ```ts
   * const freqs = new Float32Array([100, 1000, 10000]);
   * const db = eq.magnitudeResponse(freqs);
   * ```
   */
  magnitudeResponse(frequenciesHz, placement = "Stereo") {
    const value = EQ_PLACEMENTS[placement.toLowerCase()];
    if (value === void 0) {
      throw new Error(`unknown EQ band placement: ${placement}`);
    }
    return this.eq.magnitudeResponse(value, frequenciesHz);
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
  /** Alias for {@link delete}, provided for cross-binding (Node) compatibility. */
  destroy() {
    this.delete();
  }
};
var StreamingRetune = class {
  constructor(config = {}) {
    const module2 = getSonareModule();
    this.retune = module2.createStreamingRetune(config);
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
   * Update the live controls; omitted keys keep their current value. Changing
   * `grainSize` takes effect after the next {@link prepare} call, and an
   * omitted `grainSize` keeps whatever was last requested — including the `0`
   * sentinel, so a re-{@link prepare} at another sample rate re-derives it.
   */
  setConfig(config) {
    this.retune.setConfig(config);
  }
  /** The currently applied controls, with `grainSize` as the effective one. */
  config() {
    return this.retune.config();
  }
  /** Resolved grain size in samples after {@link prepare}. */
  grainSize() {
    return this.retune.grainSize();
  }
  /** Fixed overlap-add latency in samples (one grain); 0 before prepare. */
  latencySamples() {
    return this.retune.latencySamples();
  }
  /** Process one mono block, returning the shifted samples (same length). */
  processMono(samples) {
    return this.retune.processMono(samples);
  }
  /** Release the underlying WASM object. Safe to call only once. */
  delete() {
    this.retune.delete();
  }
  /** Alias for {@link delete}, provided for cross-binding (Node) compatibility. */
  destroy() {
    this.delete();
  }
};

// src/transcribe.ts
function transcribe(request) {
  assertSamples("transcribe", request.samples, true);
  assertSampleRate("transcribe", request.sampleRate);
  return projectModule().transcribe(
    request.samples,
    request.sampleRate,
    request.tempoBpm,
    request
  );
}

// src/web_midi.ts
function isWebMidiAvailable() {
  return typeof globalThis.navigator?.requestMIDIAccess === "function";
}
async function bindWebMidi(engine, options = {}) {
  const navigatorWithMidi = globalThis.navigator;
  if (typeof navigatorWithMidi?.requestMIDIAccess !== "function") {
    throw new Error("Web MIDI is not available in this environment");
  }
  const group = options.group ?? 0;
  assertNibble("bindWebMidi", group, "group");
  const destinationId = options.destinationId ?? 0;
  const selectedIds = new Set(options.inputIds ?? []);
  const access = await navigatorWithMidi.requestMIDIAccess({
    sysex: options.sysex ?? false,
    software: options.software ?? true
  });
  for (const binding of options.ccBindings ?? []) {
    engine.bindMidiCc(binding.channel, binding.controller, binding.paramId, binding.options);
  }
  engine.setMidiInputSource(destinationId);
  const bound = /* @__PURE__ */ new Map();
  let closed = false;
  const shouldBind = (input) => input.state !== "disconnected" && (selectedIds.size === 0 || selectedIds.has(input.id));
  const snapshotInputs = () => Array.from(iterInputs(access), ([id, input]) => ({
    id,
    name: input.name ?? "",
    manufacturer: input.manufacturer ?? "",
    state: input.state ?? "connected"
  }));
  const notify = () => options.onInputsChanged?.(snapshotInputs());
  const bindInput = (input) => {
    if (bound.has(input.id) || !shouldBind(input)) {
      return;
    }
    const entry = {
      input,
      listener: (event) => {
        entry.runningStatus = dispatchMidiMessage(
          engine,
          event,
          group,
          entry.runningStatus,
          options.timestampToSamples
        );
      },
      runningStatus: 0
    };
    const listener = entry.listener;
    if (input.addEventListener) {
      input.addEventListener("midimessage", listener);
    } else {
      input.onmidimessage = listener;
    }
    bound.set(input.id, entry);
  };
  const unbindInput = (input) => {
    const entry = bound.get(input.id);
    if (!entry) {
      return;
    }
    if (entry.input.removeEventListener) {
      entry.input.removeEventListener("midimessage", entry.listener);
    } else if (entry.input.onmidimessage === entry.listener) {
      entry.input.onmidimessage = null;
    }
    bound.delete(input.id);
  };
  const refreshInputs = () => {
    for (const [, entry] of bound) {
      if (!shouldBind(entry.input)) {
        unbindInput(entry.input);
      }
    }
    for (const [, input] of iterInputs(access)) {
      bindInput(input);
    }
  };
  const stateListener = (event) => {
    if (closed) {
      return;
    }
    if (event.port && "onmidimessage" in event.port) {
      const input = event.port;
      if (shouldBind(input)) {
        bindInput(input);
      } else {
        unbindInput(input);
      }
    } else {
      refreshInputs();
    }
    notify();
  };
  refreshInputs();
  notify();
  if (access.addEventListener) {
    access.addEventListener("statechange", stateListener);
  } else {
    access.onstatechange = stateListener;
  }
  return {
    access,
    inputs: snapshotInputs,
    close() {
      closed = true;
      if (access.removeEventListener) {
        access.removeEventListener("statechange", stateListener);
      } else if (access.onstatechange === stateListener) {
        access.onstatechange = null;
      }
      for (const [, entry] of Array.from(bound)) {
        unbindInput(entry.input);
      }
      engine.clearMidiInputSource();
    }
  };
}
function dispatchMidiMessage(engine, event, group, runningStatus, timestampToSamples) {
  const data = event.data;
  if (data.length === 0) {
    return 0;
  }
  const first = data[0];
  if (first > 255) {
    dispatchUmpMessage(
      engine,
      data,
      timestampToSamples?.(event.receivedTime ?? event.timeStamp ?? 0) ?? 0
    );
    return 0;
  }
  let offset = 0;
  let status = first & 255;
  if (status < 128) {
    if (runningStatus === 0) {
      return 0;
    }
    status = runningStatus;
  } else {
    offset = 1;
  }
  const message = status & 240;
  const channel = status & 15;
  if (message < 128 || message > 224) {
    return status >= 248 ? runningStatus : 0;
  }
  const a = readU7(data, offset);
  const b = readU7(data, offset + 1);
  if (a < 0 || b < 0) {
    return status;
  }
  const portTimeSamples = timestampToSamples ? timestampToSamples(event.receivedTime ?? event.timeStamp ?? 0) : 0;
  if (message === 128) {
    engine.pushMidiInputNoteOff(group, channel, a, b, portTimeSamples);
  } else if (message === 144) {
    if (b === 0) {
      engine.pushMidiInputNoteOff(group, channel, a, 0, portTimeSamples);
    } else {
      engine.pushMidiInputNoteOn(group, channel, a, b, portTimeSamples);
    }
  } else if (message === 176 && b >= 0) {
    engine.pushMidiInputCc(group, channel, a, b, portTimeSamples);
  }
  return status;
}
function dispatchUmpMessage(engine, words, portTimeSamples) {
  const word0 = words[0] >>> 0;
  const messageType = word0 >>> 28;
  const group = word0 >>> 24 & 15;
  if (messageType === 2) {
    const status = word0 >>> 16 & 255;
    const message = status & 240;
    const channel = status & 15;
    const a = word0 >>> 8 & 127;
    const b = word0 & 127;
    if (message === 128) {
      engine.pushMidiInputNoteOff(group, channel, a, b, portTimeSamples);
    } else if (message === 144) {
      if (b === 0) {
        engine.pushMidiInputNoteOff(group, channel, a, 0, portTimeSamples);
      } else {
        engine.pushMidiInputNoteOn(group, channel, a, b, portTimeSamples);
      }
    } else if (message === 176) {
      engine.pushMidiInputCc(group, channel, a, b, portTimeSamples);
    }
    return;
  }
  if (messageType === 4 && words.length >= 2) {
    const status = word0 >>> 20 & 15;
    const channel = word0 >>> 16 & 15;
    const data1 = word0 >>> 8 & 127;
    const word1 = words[1] >>> 0;
    if (status === 8) {
      engine.pushMidiInputNoteOff(group, channel, data1, word1 >>> 25 & 127, portTimeSamples);
    } else if (status === 9) {
      const velocity = Math.max(1, word1 >>> 25 & 127);
      engine.pushMidiInputNoteOn(group, channel, data1, velocity, portTimeSamples);
    } else if (status === 11) {
      engine.pushMidiInputCc(group, channel, data1, word1 >>> 25 & 127, portTimeSamples);
    }
  }
}
function readU7(data, index) {
  if (index >= data.length) {
    return -1;
  }
  const value = data[index];
  if (!Number.isInteger(value) || value < 0 || value > 127) {
    return -1;
  }
  return value;
}
function iterInputs(access) {
  return access.inputs instanceof Map ? access.inputs.entries() : access.inputs;
}

// src/worker_client.ts
var OfflineWorkerTask = class {
  constructor(result, cancelRequest) {
    this.result = result;
    this.cancelRequest = cancelRequest;
  }
  cancel() {
    this.cancelRequest();
  }
  // biome-ignore lint/suspicious/noThenProperty: this intentionally implements PromiseLike so callers can await a task and cancel it.
  then(onfulfilled, onrejected) {
    return this.result.then(onfulfilled, onrejected);
  }
  catch(onrejected) {
    return this.result.catch(onrejected);
  }
  finally(onfinally) {
    return this.result.finally(onfinally);
  }
};
function cloneForWorker(value, copy, transfers, transferred = /* @__PURE__ */ new Set()) {
  if (value instanceof Float32Array) {
    const samples = copy ? value.slice() : value;
    const buffer = samples.buffer;
    if (!(buffer instanceof ArrayBuffer)) {
      throw new TypeError(
        "OfflineWorkerClient only transfers Float32Array values backed by ArrayBuffer"
      );
    }
    if (!transferred.has(buffer)) {
      transferred.add(buffer);
      transfers.push(buffer);
    }
    return samples;
  }
  if (Array.isArray(value)) {
    return value.map((item) => cloneForWorker(item, copy, transfers, transferred));
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        cloneForWorker(item, copy, transfers, transferred)
      ])
    );
  }
  return value;
}
function cancellationFlag() {
  if (typeof SharedArrayBuffer === "undefined") {
    return void 0;
  }
  return new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT));
}
function workerError(message) {
  if (message.error.code !== void 0) {
    return new SonareError(
      message.error.code,
      message.error.codeName ?? "Unknown",
      message.error.message
    );
  }
  const error = new Error(message.error.message);
  error.name = message.error.name;
  return error;
}
var OfflineWorkerClient = class {
  constructor(options = {}) {
    this.pending = /* @__PURE__ */ new Map();
    this.nextId = 1;
    this.closed = false;
    this.usesEventTarget = false;
    this.onMessage = (event) => {
      const message = event.data;
      const pending = this.pending.get(message.id);
      if (!pending) {
        return;
      }
      if (message.type === "sonare:offline-progress") {
        pending.onProgress?.({ progress: message.progress, stage: message.stage });
        return;
      }
      this.pending.delete(message.id);
      if (message.type === "sonare:offline-result") {
        pending.resolve(message.result);
        return;
      }
      pending.reject(workerError(message));
    };
    this.onError = (event) => {
      const error = new Error(event.message || "Offline Worker failed");
      for (const { reject } of this.pending.values()) {
        reject(error);
      }
      this.pending.clear();
    };
    this.onNodeMessage = (data) => {
      this.onMessage({ data });
    };
    this.onNodeError = (error) => {
      this.onError(
        error instanceof Error ? { message: error.message } : { message: String(error) }
      );
    };
    this.ownsWorker = options.worker === void 0 || options.terminateWorkerOnDispose === true;
    if (options.worker) {
      this.worker = options.worker;
    } else {
      if (!options.workerFactory && typeof Worker === "undefined") {
        throw new Error("OfflineWorkerClient requires a browser Worker implementation");
      }
      const url = options.workerUrl === void 0 ? new URL("./worker.js", import.meta.url) : new URL(options.workerUrl, import.meta.url);
      this.worker = options.workerFactory?.(url) ?? new Worker(url, { type: "module", name: "sonare-offline" });
    }
    if (this.worker.addEventListener) {
      this.usesEventTarget = true;
      this.worker.addEventListener("message", this.onMessage);
      this.worker.addEventListener("error", this.onError);
    } else if (this.worker.on) {
      this.worker.on("message", this.onNodeMessage);
      this.worker.on("error", this.onNodeError);
    } else {
      throw new TypeError("OfflineWorkerClient requires Worker event listeners");
    }
  }
  /** Dispatch full music analysis to the Worker. */
  analyze(request, options) {
    return this.call("analyze", request, options);
  }
  /** Dispatch BPM detection to the Worker. */
  detectBpm(request, options) {
    return this.call("detectBpm", request, options);
  }
  /** Dispatch key detection to the Worker. */
  detectKey(request, options) {
    return this.call("detectKey", request, options);
  }
  /** Dispatch chord detection to the Worker. */
  detectChords(request, options) {
    return this.call("detectChords", request, options);
  }
  /** Dispatch mono preset mastering to the Worker. */
  masterAudio(request, options) {
    return this.call("masterAudio", request, options);
  }
  /** Dispatch stereo preset mastering to the Worker. */
  masterAudioStereo(request, options) {
    return this.call("masterAudioStereo", request, options);
  }
  /** Stop accepting calls, reject outstanding work, and release the Worker if owned. */
  dispose() {
    if (this.closed) {
      return;
    }
    this.closed = true;
    if (this.usesEventTarget) {
      this.worker.removeEventListener?.("message", this.onMessage);
      this.worker.removeEventListener?.("error", this.onError);
    } else {
      this.worker.off?.("message", this.onNodeMessage);
      this.worker.off?.("error", this.onNodeError);
    }
    for (const { reject } of this.pending.values()) {
      reject(new Error("OfflineWorkerClient was disposed"));
    }
    this.pending.clear();
    if (this.ownsWorker) {
      this.worker.terminate();
    }
  }
  call(operation, request, options = {}) {
    if (this.closed) {
      throw new Error("OfflineWorkerClient was disposed");
    }
    const id = this.nextId++;
    const transfers = [];
    const preparedRequest = cloneForWorker(request, options.copy === true, transfers);
    const cancelFlag = cancellationFlag();
    const result = new Promise((resolve, reject) => {
      this.pending.set(id, {
        resolve: (value) => resolve(value),
        reject,
        onProgress: options.onProgress,
        cancelFlag
      });
    });
    this.worker.postMessage(
      {
        type: "sonare:offline-run",
        id,
        operation,
        request: preparedRequest,
        ...cancelFlag ? { cancelBuffer: cancelFlag.buffer } : {}
      },
      transfers
    );
    return new OfflineWorkerTask(result, () => {
      if (!this.pending.has(id)) {
        return;
      }
      if (cancelFlag) {
        Atomics.store(cancelFlag, 0, 1);
      }
      this.worker.postMessage({ type: "sonare:offline-cancel", id });
    });
  }
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
function isInitialized() {
  return module !== null;
}
function version() {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.version();
}
function capabilities() {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.capabilities();
}
function capabilityCatalog() {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return JSON.parse(module.capabilityCatalog());
}
function abiVersion() {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.abiVersion();
}
function engineAbiVersion() {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.engineAbiVersion();
}
function voiceChangerAbiVersion() {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.voiceChangerAbiVersion();
}
var VOICE_PRESET_ORDINALS = [
  "neutral-monitor",
  "bright-idol",
  "soft-whisper",
  "deep-narrator",
  "robot-mascot",
  "dark-villain"
];
function resolveVoicePresetOrdinal(preset) {
  if (typeof preset === "number") {
    if (!Number.isSafeInteger(preset) || preset < 0 || preset >= VOICE_PRESET_ORDINALS.length) {
      throw new RangeError(`Unknown voice-character preset ordinal: ${String(preset)}`);
    }
    return preset;
  }
  const ordinal = VOICE_PRESET_ORDINALS.indexOf(preset);
  if (ordinal < 0) {
    throw new Error(`Unknown voice character preset: ${preset}`);
  }
  return ordinal;
}
function voiceCharacterPresetId(preset) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  if (typeof preset === "number" && (!Number.isSafeInteger(preset) || preset < 0 || preset >= VOICE_PRESET_ORDINALS.length)) {
    return null;
  }
  return module.voiceCharacterPresetId(resolveVoicePresetOrdinal(preset));
}
function realtimeVoiceChangerPresetConfig(preset) {
  if (!module) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return module.realtimeVoiceChangerPresetConfig(resolveVoicePresetOrdinal(preset));
}
export {
  ARTICULATIONS,
  Audio,
  AutomationTargetKind,
  BUILTIN_SYNTH_WAVEFORMS,
  CONTROLLER_AXES,
  CONTROLLER_INPUTS,
  ChordQuality,
  ClipPageProvider,
  ClipPageStreamer,
  EXPECTED_ENGINE_ABI_VERSION,
  EXPECTED_PROJECT_ABI_VERSION,
  ErrorCode,
  KeyProfile,
  MPE_DIMENSIONS,
  MarkerKind,
  Mixer,
  Mode,
  NOTE_TRACKINGS,
  OfflineWorkerClient,
  OfflineWorkerTask,
  PROJECT_AUTOMATION_TARGET_OPAQUE,
  PROJECT_AUTOMATION_TARGET_TRACK_FADER_DB,
  PROJECT_AUTOMATION_TARGET_TRACK_PAN,
  PitchClass as Pitch,
  PitchClass,
  PolyphonicAnalysis,
  Project,
  RealtimeEngine,
  RealtimeVoiceChanger,
  SAMPLE_KEY_TRACKS,
  SAMPLE_LOOP_MODES,
  SYNTH_BODY_TYPES,
  SYNTH_ENGINE_MODES,
  SYNTH_FILTER_MODELS,
  SYNTH_FILTER_OUTPUTS,
  SYNTH_MOD_DESTINATIONS,
  SYNTH_MOD_SOURCES,
  SYNTH_OSC_WAVEFORMS,
  SYNTH_RETRIGGERS,
  SampleBank,
  SectionType,
  SonareError,
  StreamAnalyzer,
  StreamingEqualizer,
  StreamingMasteringChain,
  StreamingRetune,
  abiVersion,
  alignTakeToReference,
  amplitudeToDb,
  analyze,
  analyzeBpm,
  analyzeDynamics,
  analyzeImpulseResponse,
  analyzeMelody,
  analyzePolyphonic,
  analyzeRhythm,
  analyzeSections,
  analyzeTimbre,
  analyzeWithProgress,
  assignNoteTargets,
  attachOpfsClipStream,
  bassChroma,
  bindMicrophoneInput,
  bindWebMidi,
  capabilities,
  capabilityCatalog,
  chirp,
  chordFunctionalAnalysis,
  chroma,
  chromaCens,
  chromaCqt,
  clicks,
  controllerProfileNames,
  cqt,
  cqtToAudio,
  createOpfsClipPageProvider,
  createOpfsClipPageWorker,
  cyclicTempogram,
  dbToAmplitude,
  dbToPower,
  decompose,
  decomposeNotePitch,
  decomposeStems,
  decomposeStemsLinked,
  decomposeWithInit,
  deemphasis,
  detectAcoustic,
  detectBeats,
  detectBoundaries,
  detectBpm,
  detectChords,
  detectDownbeats,
  detectKey,
  detectKeyCandidates,
  detectOnsets,
  ebur128LoudnessRange,
  engineAbiVersion,
  engineCapabilities,
  estimateMeter,
  estimateRoom,
  estimateTuning,
  extractNotes,
  extractPercussiveEvents,
  fixFrames,
  fixLength,
  fourierTempogram,
  frameSignal,
  framesToSamples,
  framesToTime,
  griffinLim,
  harmonic,
  hasFfmpegSupport,
  hpss,
  hpssWithResidual,
  hybridCqt,
  hzToMel,
  hzToMidi,
  hzToNote,
  init,
  isInitialized,
  isSonareError,
  isWebMidiAvailable,
  lufs,
  lufsInterleaved,
  lufsSeriesInterleaved,
  masterAudio,
  masterAudioStereo,
  masterAudioStereoWithProgress,
  masterAudioWithProgress,
  mastering,
  masteringAbMatchLoudness,
  masteringAssistantSuggest,
  masteringAssistantSuggestChain,
  masteringAssistantSuggestChainStereo,
  masteringAssistantSuggestStereo,
  masteringAudioProfile,
  masteringAudioProfileStereo,
  masteringChain,
  masteringChainStereo,
  masteringChainStereoWithProgress,
  masteringChainWithProgress,
  masteringDynamicsCompressor,
  masteringDynamicsGate,
  masteringDynamicsTransientShaper,
  masteringInsertNames,
  masteringInsertParamInfo,
  masteringInsertParamNames,
  masteringInsertTiming,
  masteringPairAnalysisNames,
  masteringPairAnalyze,
  masteringPairProcess,
  masteringPairProcessorNames,
  masteringPlatformNames,
  masteringPresetNames,
  masteringPresetParams,
  masteringProcess,
  masteringProcessStereo,
  masteringProcessorCatalog,
  masteringProcessorNames,
  masteringRepairDeclick,
  masteringRepairDeclickStereo,
  masteringRepairDeclip,
  masteringRepairDeclipStereo,
  masteringRepairDecrackle,
  masteringRepairDecrackleStereo,
  masteringRepairDehum,
  masteringRepairDehumStereo,
  masteringRepairDenoiseClassical,
  masteringRepairDenoiseClassicalLinked,
  masteringRepairDenoiseClassicalStereo,
  masteringRepairDereverbClassical,
  masteringRepairDereverbClassicalLinked,
  masteringRepairDereverbClassicalStereo,
  masteringRepairDereverbConfigForRoom,
  masteringRepairDetectClicks,
  masteringRepairDetectClipping,
  masteringRepairDetectCrackle,
  masteringRepairDetectHum,
  masteringRepairDetectNoiseFloor,
  masteringRepairDetectReverb,
  masteringRepairDetectTrimRange,
  masteringRepairDetectTrimRangeStereo,
  masteringRepairNoiseBandBins,
  masteringRepairTrimSilence,
  masteringRepairTrimSilenceStereo,
  masteringStereoAnalysisNames,
  masteringStereoAnalyze,
  masteringStreamingPreview,
  masteringStreamingPreviewStereo,
  melDelta,
  melSpectrogram,
  melToAudio,
  melToHz,
  melToStft,
  mergeNotes,
  meteringCrestFactorDb,
  meteringCrestFactorDbStereo,
  meteringDcOffset,
  meteringDetectClipping,
  meteringDynamicRange,
  meteringPeakDb,
  meteringPhaseScope,
  meteringPhaseScopeDecimated,
  meteringRmsDb,
  meteringSilenceRatio,
  meteringSpectrum,
  meteringSpectrumFrame,
  meteringStereoCorrelation,
  meteringStereoWidth,
  meteringTruePeakDb,
  meteringVectorscope,
  meteringVectorscopeDecimated,
  mfcc,
  mfccToAudio,
  mfccToMel,
  midiToHz,
  mixSourceClassFromName,
  mixSourceClassNames,
  mixStereo,
  mixingScenePresetJson,
  mixingScenePresetNames,
  momentaryLufs,
  nnFilter,
  nnlsChroma,
  normalize,
  normalizeStereo,
  noteMove,
  noteSegments,
  noteStretch,
  noteTargetsFromSmf,
  noteToHz,
  onsetBacktrack,
  onsetEnvelope,
  onsetStrengthMulti,
  opfsClipPageWorkerSource,
  padCenter,
  pcen,
  peakPick,
  percussive,
  phaseVocoder,
  piptrack,
  pitchCorrectTimevarying,
  pitchCorrectToMidi,
  pitchCorrectToMidiTimevarying,
  pitchPyin,
  pitchShift,
  pitchTuning,
  pitchYin,
  plp,
  polyFeatures,
  powerToDb,
  preemphasis,
  projectAbiVersion,
  pseudoCqt,
  realtimeVoiceChangerPresetConfig,
  realtimeVoiceChangerPresetJson,
  realtimeVoiceChangerPresetNames,
  reassignedSpectrogram,
  remix,
  remixAlignedIntervals,
  renderNotes,
  renderPercussiveEvents,
  resample,
  rmsEnergy,
  roomMorph,
  samplesToFrames,
  scaleCorrectionSemitones,
  scalePitchClassEnabled,
  scaleQuantizeMidi,
  segmentAgglomerative,
  segmentCrossSimilarity,
  segmentLagToRecurrence,
  segmentPathEnhance,
  segmentRecurrenceMatrix,
  segmentRecurrenceToLag,
  segmentSubsegment,
  shortTermLufs,
  spectralBandwidth,
  spectralCentroid,
  spectralContrast,
  spectralEdit,
  spectralFlatness,
  spectralFlux,
  spectralRolloff,
  splitNote,
  splitSilence,
  splitSilenceCommon,
  splitSilenceCommonWithReport,
  stft,
  stftDb,
  streamAnalyzerConfigDefaults,
  suggestMixScene,
  suggestMixSceneJson,
  synthEnumTables,
  synthGsDrumKitIsVoicedApart,
  synthGsDrumKitName,
  synthGsVariationIsVoicedApart,
  synthPresetNames,
  synthPresetPatch,
  synthesizeRir,
  tempogram,
  tempogramRatio,
  timeStretch,
  timeToFrames,
  tone,
  tonnetz,
  transcribe,
  trim,
  trimSilence,
  validateRealtimeVoiceChangerPresetJson,
  vectorNormalize,
  version,
  voiceChange,
  voiceChangeRealtime,
  voiceChangerAbiVersion,
  voiceCharacterPresetId,
  vqt,
  vqtToAudio,
  waveformPeakPyramid,
  waveformPeaks,
  zeroCrossingRate,
  zeroCrossings
};
