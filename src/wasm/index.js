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
function assertFiniteScalar(fnName, value, argName) {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${fnName}: ${argName} must be a finite number`);
  }
}
function assertSampleRate(fnName, sampleRate) {
  if (!Number.isInteger(sampleRate) || sampleRate < MIN_AUDIO_SAMPLE_RATE || sampleRate > MAX_AUDIO_SAMPLE_RATE) {
    throw new RangeError(
      `${fnName}: sampleRate out of supported range [${MIN_AUDIO_SAMPLE_RATE}, ${MAX_AUDIO_SAMPLE_RATE}]`
    );
  }
}
function validateAudioBuffer(samples, sampleRate) {
  assertSamples("Audio.fromBuffer", samples, true);
  assertSampleRate("Audio.fromBuffer", sampleRate);
}
function assertNonNegativeInteger(fnName, value, argName) {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${fnName}: ${argName} must be a non-negative integer`);
  }
}
function assertPositiveInteger(fnName, value, argName) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${fnName}: ${argName} must be a positive integer`);
  }
}
function assertInterleavedSamples(fnName, samples, channels, validate) {
  assertSamples(fnName, samples, validate);
  assertPositiveInteger(fnName, channels, "channels");
  if (samples.length % channels !== 0) {
    throw new RangeError(`${fnName}: samples length must be a multiple of channels`);
  }
}

// src/effects_transform.ts
function requireModule() {
  return getSonareModule();
}
function toVoicedFloat32(voiced) {
  const out = new Float32Array(voiced.length);
  for (let index = 0; index < voiced.length; index += 1) {
    out[index] = voiced[index] ? 1 : 0;
  }
  return out;
}
function resolveEffectFftOptions(fnName, nFft, hopLength) {
  const resolvedNFft = nFft === void 0 ? 2048 : nFft;
  const resolvedHopLength = hopLength === void 0 ? 512 : hopLength;
  if (typeof resolvedNFft !== "number" || !Number.isInteger(resolvedNFft)) {
    throw new TypeError(`${fnName}: nFft must be an integer`);
  }
  if (resolvedNFft < 2 || resolvedNFft > 2 ** 30) {
    throw new RangeError(`${fnName}: nFft must be an even power of two >= 2`);
  }
  if ((resolvedNFft & resolvedNFft - 1) !== 0) {
    throw new RangeError(`${fnName}: nFft must be an even power of two >= 2`);
  }
  if (typeof resolvedHopLength !== "number" || !Number.isInteger(resolvedHopLength)) {
    throw new TypeError(`${fnName}: hopLength must be an integer`);
  }
  if (resolvedHopLength <= 0 || resolvedHopLength > 2 ** 31 - 1) {
    throw new RangeError(`${fnName}: hopLength must be a positive integer`);
  }
  return { nFft: resolvedNFft, hopLength: resolvedHopLength };
}
function resolveNormalizeMode(value) {
  if (value === void 0) {
    return "peak";
  }
  if (typeof value !== "string") {
    throw new TypeError("normalize: mode must be the string 'peak' or 'rms'");
  }
  if (value !== "peak" && value !== "rms") {
    throw new RangeError("normalize: mode must be the string 'peak' or 'rms'");
  }
  return value;
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
  const fftOptions = resolveEffectFftOptions("hpss", request.nFft, request.hopLength);
  const resolvedHardMask = resolveHardMask(request.hardMask, "hpss");
  return requireModule().hpssEx(
    request.samples,
    request.sampleRate ?? 22050,
    request.kernelHarmonic ?? 31,
    request.kernelPercussive ?? 31,
    fftOptions.nFft,
    fftOptions.hopLength,
    resolvedHardMask
  );
}
function harmonic(samples, sampleRate = 22050, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  assertSamples("harmonic", request.samples, request.validate !== false);
  return requireModule().harmonic(request.samples, request.sampleRate ?? 22050);
}
function percussive(samples, sampleRate = 22050, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  assertSamples("percussive", request.samples, request.validate !== false);
  return requireModule().percussive(request.samples, request.sampleRate ?? 22050);
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
  const fftOptions = resolveEffectFftOptions("timeStretch", request.nFft, request.hopLength);
  return requireModule().timeStretchEx(
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
  const fftOptions = resolveEffectFftOptions("pitchShift", request.nFft, request.hopLength);
  return requireModule().pitchShiftEx(
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
  return requireModule().pitchCorrectToMidi(
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
  return requireModule().pitchCorrectToMidiTimevarying(
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
  return requireModule().pitchCorrectTimevarying(
    request.samples,
    request.sampleRate ?? 22050,
    request.f0Hz,
    request.hopLength ?? 512,
    nativeOptions
  );
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
  return requireModule().normalizeEx(
    request.samples,
    request.sampleRate ?? 22050,
    request.targetDb ?? 0,
    mode
  );
}
function spectralEdit(samples, sampleRate, ops = [], options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ops, ...options } : samples;
  assertSamples("spectralEdit", request.samples, request.validate !== false);
  assertSampleRate("spectralEdit", request.sampleRate);
  return requireModule().spectralEdit(
    request.samples,
    request.sampleRate,
    request.ops ?? [],
    request
  );
}

// src/effects_voice_change.ts
function requireModule2() {
  return getSonareModule();
}
function voiceChange(samples, sampleRate = 22050, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  assertSamples("voiceChange", request.samples, request.validate !== false);
  return requireModule2().voiceChange(
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
  return requireModule2().voiceChangeRealtime(
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
function requireModule3() {
  return getSonareModule();
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
    return requireModule3().masteringChainWithProgress(
      request.samples,
      request.sampleRate ?? 22050,
      canonicalChainConfig(request.config ?? {}),
      request.onProgress ?? (() => {
      }),
      request.cancel ?? (() => false)
    );
  }
  return requireModule3().masteringChain(
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
    return requireModule3().masteringChainStereoWithProgress(
      request.left,
      request.right,
      request.sampleRate ?? 22050,
      canonicalChainConfig(request.config ?? {}),
      request.onProgress ?? (() => {
      }),
      request.cancel ?? (() => false)
    );
  }
  return requireModule3().masteringChainStereo(
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
  return requireModule3().masteringChainWithProgress(
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
  return requireModule3().masteringChainStereoWithProgress(
    request.left,
    request.right,
    request.sampleRate ?? 22050,
    canonicalChainConfig(request.config ?? {}),
    request.onProgress,
    request.cancel ?? (() => false)
  );
}
function masteringPresetNames() {
  return Array.from(requireModule3().masteringPresetNames());
}
function masterAudio(samples, sampleRate = 22050, presetName = "pop", overrides = {}, onProgress) {
  const request = masterAudioRequest(samples, sampleRate, presetName, overrides, onProgress);
  const flat = flattenChainConfig(request.overrides ?? {});
  if (request.onProgress || request.cancel) {
    return requireModule3().masterAudioWithProgress(
      request.preset ?? "pop",
      request.samples,
      request.sampleRate ?? 22050,
      flat,
      request.onProgress ?? (() => {
      }),
      request.cancel ?? (() => false)
    );
  }
  return requireModule3().masterAudio(
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
    return requireModule3().masterAudioStereoWithProgress(
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
  return requireModule3().masterAudioStereo(
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
  return requireModule3().masterAudioWithProgress(
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
  return requireModule3().masterAudioStereoWithProgress(
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
function requireModule4() {
  return getSonareModule();
}
function mastering(samples, sampleRate = 22050, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  return requireModule4().mastering(
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
  return Array.from(requireModule4().masteringProcessorNames());
}
function masteringInsertNames() {
  return requireModule4().masteringInsertNames();
}
function masteringInsertParamNames(name) {
  return Array.from(
    requireModule4().masteringInsertParamNames(name)
  );
}
function masteringInsertParamInfo(name) {
  const json = requireModule4().masteringInsertParamInfo(name);
  return JSON.parse(json);
}
function masteringProcessorCatalog() {
  const json = requireModule4().masteringProcessorCatalog();
  return JSON.parse(json);
}
function masteringPairProcessorNames() {
  return Array.from(requireModule4().masteringPairProcessorNames());
}
function masteringPairAnalysisNames() {
  return Array.from(requireModule4().masteringPairAnalysisNames());
}
function masteringStereoAnalysisNames() {
  return Array.from(requireModule4().masteringStereoAnalysisNames());
}
function masteringProcess(processorName, samples, sampleRate = 22050, params = {}) {
  const request = typeof processorName === "string" ? { processorName, samples, sampleRate, params } : processorName;
  return requireModule4().masteringProcess(
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
  return requireModule4().masteringProcessStereo(
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
  return requireModule4().masteringPairProcess(
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
  return requireModule4().masteringPairAnalyze(
    request.analysisName,
    request.source,
    request.reference,
    request.sampleRate ?? 22050,
    request.params ?? {}
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
  return requireModule4().masteringStereoAnalyze(
    request.analysisName,
    request.left,
    request.right,
    request.sampleRate ?? 22050,
    request.params ?? {}
  );
}
function masteringAssistantSuggest(samples, sampleRate = 22050, params = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, params } : samples;
  return requireModule4().masteringAssistantSuggest(
    request.samples,
    request.sampleRate ?? 22050,
    request.params ?? {}
  );
}
function masteringAudioProfile(samples, sampleRate = 22050, params = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, params } : samples;
  return requireModule4().masteringAudioProfile(
    request.samples,
    request.sampleRate ?? 22050,
    request.params ?? {}
  );
}
function masteringStreamingPreview(samples, sampleRate = 22050, platforms = []) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, platforms } : samples;
  return requireModule4().masteringStreamingPreview(
    request.samples,
    request.sampleRate ?? 22050,
    request.platforms ?? []
  );
}
function masteringAssistantSuggestStereo(request) {
  return requireModule4().masteringAssistantSuggestStereo(
    request.left,
    request.right,
    request.sampleRate ?? 22050,
    request.params ?? {}
  );
}
function masteringAudioProfileStereo(request) {
  return requireModule4().masteringAudioProfileStereo(
    request.left,
    request.right,
    request.sampleRate ?? 22050,
    request.params ?? {}
  );
}
function masteringStreamingPreviewStereo(request) {
  return requireModule4().masteringStreamingPreviewStereo(
    request.left,
    request.right,
    request.sampleRate ?? 22050,
    request.platforms ?? []
  );
}

// src/mastering_dynamics.ts
function requireModule5() {
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
  return requireModule5().masteringDynamicsCompressor(request.samples, request.sampleRate, opts);
}
function masteringDynamicsGate(samples, sampleRate, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  assertSamples("masteringDynamicsGate", request.samples, request.validate !== false);
  return requireModule5().masteringDynamicsGate(request.samples, request.sampleRate, request);
}
function masteringDynamicsTransientShaper(samples, sampleRate, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  assertSamples("masteringDynamicsTransientShaper", request.samples, request.validate !== false);
  return requireModule5().masteringDynamicsTransientShaper(
    request.samples,
    request.sampleRate,
    request
  );
}

// src/mastering_repair.ts
function requireModule6() {
  return getSonareModule();
}
function masteringRepairDeclick(samples, sampleRate, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  return requireModule6().masteringRepairDeclick(request.samples, request.sampleRate, request);
}
function masteringRepairDenoiseClassical(samples, sampleRate, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  return requireModule6().masteringRepairDenoiseClassical(
    request.samples,
    request.sampleRate,
    request
  );
}
function masteringRepairDeclip(samples, sampleRate, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  return requireModule6().masteringRepairDeclip(request.samples, request.sampleRate, request);
}
function masteringRepairDecrackle(samples, sampleRate, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  return requireModule6().masteringRepairDecrackle(request.samples, request.sampleRate, request);
}
function masteringRepairDehum(samples, sampleRate, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  return requireModule6().masteringRepairDehum(request.samples, request.sampleRate, request);
}
function masteringRepairDereverbClassical(samples, sampleRate, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  return requireModule6().masteringRepairDereverbClassical(
    request.samples,
    request.sampleRate,
    request
  );
}
function masteringRepairTrimSilence(samples, sampleRate, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  return requireModule6().masteringRepairTrimSilence(request.samples, request.sampleRate, request);
}

// src/mixing_oneshot.ts
function requireModule7() {
  return getSonareModule();
}
function mixingScenePresetNames() {
  return Array.from(requireModule7().mixingScenePresetNames());
}
function mixingScenePresetJson(presetName) {
  return requireModule7().mixingScenePresetJson(presetName);
}
function mixStereo(leftChannels, rightChannels, sampleRate = 48e3, options = {}) {
  const request = Array.isArray(leftChannels) ? { leftChannels, rightChannels: rightChannels ?? [], sampleRate, ...options } : leftChannels;
  if (request.leftChannels.length === 0 || request.leftChannels.length !== request.rightChannels.length) {
    throw new Error("leftChannels and rightChannels must have the same non-zero length.");
  }
  return requireModule7().mixStereo(
    request.leftChannels,
    request.rightChannels,
    request.sampleRate ?? 48e3,
    request
  );
}

// src/feature_core.ts
function requireModule8() {
  return getSonareModule();
}
function tone(frequency = 440, sampleRate = 22050, duration = 1, phase = 0, amplitude = 1) {
  const request = typeof frequency === "number" ? { frequency, sampleRate, duration, phase, amplitude } : frequency;
  return requireModule8().tone(
    request.frequency ?? 440,
    request.sampleRate ?? 22050,
    request.duration ?? 1,
    request.phase ?? 0,
    request.amplitude ?? 1
  );
}
function chirp(fmin = 440, fmax = 880, sampleRate = 22050, duration = 1, linear = true) {
  const request = typeof fmin === "number" ? { fmin, fmax, sampleRate, duration, linear } : fmin;
  return requireModule8().chirp(
    request.fmin ?? 440,
    request.fmax ?? 880,
    request.sampleRate ?? 22050,
    request.duration ?? 1,
    request.linear ?? true
  );
}
function clicks(times, sampleRate = 22050, length = 0, frequency = 1e3, clickDuration = 0.1) {
  const request = times instanceof Float32Array ? { times, sampleRate, length, frequency, clickDuration } : times;
  return requireModule8().clicks(
    request.times,
    request.sampleRate ?? 22050,
    request.length ?? 0,
    request.frequency ?? 1e3,
    request.clickDuration ?? 0.1
  );
}
function hzToMel(hz) {
  return requireModule8().hzToMel(hz);
}
function melToHz(mel) {
  return requireModule8().melToHz(mel);
}
function hzToMidi(hz) {
  return requireModule8().hzToMidi(hz);
}
function midiToHz(midi) {
  return requireModule8().midiToHz(midi);
}
function hzToNote(hz) {
  return requireModule8().hzToNote(hz);
}
function noteToHz(note) {
  return requireModule8().noteToHz(note);
}
function framesToTime(frames, sr = 22050, hopLength = 512) {
  return requireModule8().framesToTime(frames, sr, hopLength);
}
function timeToFrames(time, sr = 22050, hopLength = 512) {
  return requireModule8().timeToFrames(time, sr, hopLength);
}
function framesToSamples(frames, hopLength = 512, nFft = 0) {
  return requireModule8().framesToSamples(frames, hopLength, nFft);
}
function samplesToFrames(samples, hopLength = 512, nFft = 0) {
  return requireModule8().samplesToFrames(samples, hopLength, nFft);
}
function powerToDb(values, ref = 1, amin = 1e-10, topDb = 80) {
  if (!(values instanceof Float32Array)) {
    return powerToDb(values.values, values.ref, values.amin, values.topDb);
  }
  return requireModule8().powerToDb(values, ref, amin, topDb);
}
function amplitudeToDb(values, ref = 1, amin = 1e-5, topDb = 80) {
  if (!(values instanceof Float32Array)) {
    return amplitudeToDb(values.values, values.ref, values.amin, values.topDb);
  }
  return requireModule8().amplitudeToDb(values, ref, amin, topDb);
}
function dbToPower(values, ref = 1) {
  return requireModule8().dbToPower(values, ref);
}
function dbToAmplitude(values, ref = 1) {
  return requireModule8().dbToAmplitude(values, ref);
}
function preemphasis(samples, coef = 0.97, zi) {
  if (!(samples instanceof Float32Array)) {
    return preemphasis(samples.samples, samples.coef, samples.zi);
  }
  return requireModule8().preemphasis(samples, coef, zi ?? null);
}
function deemphasis(samples, coef = 0.97, zi) {
  if (!(samples instanceof Float32Array)) {
    return deemphasis(samples.samples, samples.coef, samples.zi);
  }
  return requireModule8().deemphasis(samples, coef, zi ?? null);
}
function trimSilence(samples, topDb = 60, frameLength = 2048, hopLength = 512) {
  if (!(samples instanceof Float32Array)) {
    return trimSilence(samples.samples, samples.topDb, samples.frameLength, samples.hopLength);
  }
  return requireModule8().trimSilence(samples, topDb, frameLength, hopLength);
}
function splitSilence(samples, topDb = 60, frameLength = 2048, hopLength = 512) {
  if (!(samples instanceof Float32Array)) {
    return splitSilence(samples.samples, samples.topDb, samples.frameLength, samples.hopLength);
  }
  return requireModule8().splitSilence(samples, topDb, frameLength, hopLength);
}
function frameSignal(samples, frameLength, hopLength) {
  if (!(samples instanceof Float32Array)) {
    return frameSignal(samples.samples, samples.frameLength, samples.hopLength);
  }
  return requireModule8().frameSignal(samples, frameLength, hopLength);
}
function padCenter(values, targetSize, padValue = 0) {
  if (!(values instanceof Float32Array)) {
    return padCenter(values.values, values.targetSize, values.padValue);
  }
  return requireModule8().padCenter(values, targetSize, padValue);
}
function fixLength(values, targetSize, padValue = 0) {
  if (!(values instanceof Float32Array)) {
    return fixLength(values.values, values.targetSize, values.padValue);
  }
  return requireModule8().fixLength(values, targetSize, padValue);
}
function fixFrames(frames, xMin = 0, xMax = -1, pad = true) {
  if (!(frames instanceof Int32Array)) {
    return fixFrames(frames.frames, frames.xMin, frames.xMax, frames.pad);
  }
  return requireModule8().fixFrames(frames, xMin, xMax, pad);
}
function onsetBacktrack(events, energy) {
  if (!(events instanceof Int32Array)) {
    return onsetBacktrack(events.events, events.energy);
  }
  return requireModule8().onsetBacktrack(events, energy);
}
function peakPick(values, preMax, postMax, preAvg, postAvg, delta, wait) {
  if (!(values instanceof Float32Array)) {
    const r = values;
    return peakPick(r.values, r.preMax, r.postMax, r.preAvg, r.postAvg, r.delta, r.wait);
  }
  return requireModule8().peakPick(
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
  return requireModule8().vectorNormalize(values, normType, threshold);
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
  return requireModule8().pcen(values, nBins, nFrames, options);
}
function tonnetz(chromagram, nChroma, nFrames) {
  if (!(chromagram instanceof Float32Array)) {
    return tonnetz(chromagram.chromagram, chromagram.nChroma, chromagram.nFrames);
  }
  return requireModule8().tonnetz(chromagram, nChroma, nFrames);
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
  return requireModule8().tempogram(
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
  return requireModule8().cyclicTempogram(
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
  return requireModule8().plp(onsetEnvelope2, sampleRate, hopLength, tempoMin, tempoMax, winLength);
}

// src/feature_music.ts
function requireModule9() {
  return getSonareModule();
}
function validateMusicSamples(fnName, samples, sampleRate, options = {}) {
  assertSampleRate(fnName, sampleRate);
  assertSamples(fnName, samples, options.validate !== false);
}
function validatePositiveIntegers(fnName, values) {
  for (const [name, value] of Object.entries(values)) {
    assertPositiveInteger(fnName, value, name);
  }
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
  return requireModule9().nnlsChromaEx(
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
  return requireModule9().cqt(samples, sampleRate, hopLength, fmin, nBins, binsPerOctave);
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
  return requireModule9().pseudoCqt(samples, sampleRate, hopLength, fmin, nBins, binsPerOctave);
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
  return requireModule9().hybridCqt(samples, sampleRate, hopLength, fmin, nBins, binsPerOctave);
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
  assertFiniteScalar("vqt", gamma, "gamma");
  return requireModule9().vqt(samples, sampleRate, hopLength, fmin, nBins, binsPerOctave, gamma);
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
  return requireModule9().cqtToAudio(
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
  assertFiniteScalar("vqtToAudio", gamma, "gamma");
  return requireModule9().vqtToAudio(
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
  const sections = requireModule9().analyzeSections(
    samples,
    sampleRate,
    options.nFft ?? 2048,
    options.hopLength ?? 512,
    options.minSectionSec ?? 4
  );
  return Array.from(sections, (s) => ({ ...s, type: s.type }));
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
  return requireModule9().analyzeMelody(
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
  validatePositiveIntegers("onsetEnvelope", { nFft, hopLength, nMels });
  return requireModule9().onsetEnvelope(samples, sampleRate, nFft, hopLength, nMels);
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
  validatePositiveIntegers("onsetStrengthMulti", { nFft, hopLength, nMels, nBands });
  return requireModule9().onsetStrengthMulti(samples, sampleRate, nFft, hopLength, nMels, nBands);
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
  return requireModule9().fourierTempogram(
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
  return requireModule9().tempogramRatio(tempogramData, winLength, sampleRate, hopLength, factors);
}
function lufs(samples, sampleRate = 22050, options = {}) {
  if (!(samples instanceof Float32Array)) {
    const r = samples;
    return lufs(r.samples, r.sampleRate, r);
  }
  assertSampleRate("lufs", sampleRate);
  assertSamples("lufs", samples, options.validate !== false);
  return requireModule9().lufs(samples, sampleRate);
}
function momentaryLufs(samples, sampleRate = 22050, options = {}) {
  if (!(samples instanceof Float32Array)) {
    const r = samples;
    return momentaryLufs(r.samples, r.sampleRate, r);
  }
  assertSampleRate("momentaryLufs", sampleRate);
  assertSamples("momentaryLufs", samples, options.validate !== false);
  return requireModule9().momentaryLufs(samples, sampleRate);
}
function shortTermLufs(samples, sampleRate = 22050, options = {}) {
  if (!(samples instanceof Float32Array)) {
    const r = samples;
    return shortTermLufs(r.samples, r.sampleRate, r);
  }
  assertSampleRate("shortTermLufs", sampleRate);
  assertSamples("shortTermLufs", samples, options.validate !== false);
  return requireModule9().shortTermLufs(samples, sampleRate);
}

// src/feature_pitch.ts
function requireModule10() {
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
  return requireModule10().piptrack(samples, sampleRate, nFft, hopLength, fmin, fmax, threshold);
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
  return requireModule10().pitchYin(
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
  return requireModule10().pitchPyin(
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
  return requireModule10().noteSegments(request.f0Hz, request.voicedProb, request.frameRate, {
    segmentationThresholdCents: request.segmentationThresholdCents,
    minNoteMs: request.minNoteMs,
    referenceHz: request.referenceHz
  });
}

// src/feature_resample.ts
function requireModule11() {
  return getSonareModule();
}
function resample(samples, srcSr, targetSr) {
  if (!(samples instanceof Float32Array)) {
    return resample(samples.samples, samples.srcSr, samples.targetSr);
  }
  return requireModule11().resample(samples, srcSr, targetSr);
}

// src/feature_spectral.ts
function requireModule12() {
  return getSonareModule();
}
function resolveEffectFftOptions2(fnName, nFft, hopLength) {
  const resolvedNFft = nFft === void 0 ? 2048 : nFft;
  const resolvedHopLength = hopLength === void 0 ? 512 : hopLength;
  if (typeof resolvedNFft !== "number" || !Number.isInteger(resolvedNFft)) {
    throw new TypeError(`${fnName}: nFft must be an integer`);
  }
  if (resolvedNFft < 2 || resolvedNFft > 2 ** 30) {
    throw new RangeError(`${fnName}: nFft must be an even power of two >= 2`);
  }
  if ((resolvedNFft & resolvedNFft - 1) !== 0) {
    throw new RangeError(`${fnName}: nFft must be an even power of two >= 2`);
  }
  if (typeof resolvedHopLength !== "number" || !Number.isInteger(resolvedHopLength)) {
    throw new TypeError(`${fnName}: hopLength must be an integer`);
  }
  if (resolvedHopLength <= 0 || resolvedHopLength > 2 ** 31 - 1) {
    throw new RangeError(`${fnName}: hopLength must be a positive integer`);
  }
  return { nFft: resolvedNFft, hopLength: resolvedHopLength };
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
function spectralCentroid(samples, sampleRate = 22050, nFft = 2048, hopLength = 512) {
  if (!(samples instanceof Float32Array)) {
    return spectralCentroid(samples.samples, samples.sampleRate, samples.nFft, samples.hopLength);
  }
  return requireModule12().spectralCentroid(samples, sampleRate, nFft, hopLength);
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
  return requireModule12().spectralContrast(
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
  return requireModule12().polyFeatures(samples, sampleRate, nFft, hopLength, order);
}
function zeroCrossings(samples, threshold = 1e-10, refMagnitude = false, pad = true, zeroPos = true) {
  if (!(samples instanceof Float32Array)) {
    const r = samples;
    return zeroCrossings(r.samples, r.threshold, r.refMagnitude, r.pad, r.zeroPos);
  }
  return requireModule12().zeroCrossings(samples, threshold, refMagnitude, pad, zeroPos);
}
function pitchTuning(frequencies, resolution = 0.01, binsPerOctave = 12) {
  if (!(frequencies instanceof Float32Array)) {
    const r = frequencies;
    return pitchTuning(r.frequencies, r.resolution, r.binsPerOctave);
  }
  return requireModule12().pitchTuning(frequencies, resolution, binsPerOctave);
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
  return requireModule12().estimateTuning(
    samples,
    sampleRate,
    nFft,
    hopLength,
    resolution,
    binsPerOctave
  );
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
  return requireModule12().decompose(s, nFeatures, nFrames, nComponents, nIter, beta);
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
  return requireModule12().decomposeWithInit(s, nFeatures, nFrames, nComponents, nIter, beta, init2);
}
function nnFilter(s, nFeatures = 0, nFrames = 0, aggregate = "mean", k = 7, width = 1) {
  if (!(s instanceof Float32Array)) {
    const r = s;
    return nnFilter(r.s, r.nFeatures, r.nFrames, r.aggregate, r.k, r.width);
  }
  return requireModule12().nnFilter(s, nFeatures, nFrames, aggregate, k, width);
}
function remix(samples, intervals, sampleRate = 22050, alignZeros = false) {
  if (!(samples instanceof Float32Array)) {
    const r = samples;
    return remix(r.samples, r.intervals, r.sampleRate, r.alignZeros);
  }
  const intervalsI32 = intervals instanceof Int32Array ? intervals : Int32Array.from(intervals, (v) => Math.trunc(v));
  return requireModule12().remix(samples, intervalsI32, sampleRate, alignZeros);
}
function phaseVocoder(samples, sampleRate = 22050, rate = 1, nFft = 2048, hopLength = 512) {
  if (!(samples instanceof Float32Array)) {
    const r = samples;
    return phaseVocoder(r.samples, r.sampleRate ?? 22050, r.rate, r.nFft, r.hopLength);
  }
  return requireModule12().phaseVocoder(samples, sampleRate, rate, nFft, hopLength);
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
  const fftOptions = resolveEffectFftOptions2("hpssWithResidual", nFft, hopLength);
  const resolvedHardMask = resolveHardMask2("hpssWithResidual", hardMask);
  return requireModule12().hpssWithResidualEx(
    samples,
    sampleRate,
    kernelHarmonic,
    kernelPercussive,
    fftOptions.nFft,
    fftOptions.hopLength,
    resolvedHardMask
  );
}
function lufsInterleaved(samples, channels = 0, sampleRate = 22050, options = {}) {
  if (!(samples instanceof Float32Array)) {
    const r = samples;
    return lufsInterleaved(r.samples, r.channels, r.sampleRate, r);
  }
  assertSampleRate("lufsInterleaved", sampleRate);
  assertInterleavedSamples("lufsInterleaved", samples, channels, options.validate !== false);
  return requireModule12().lufsInterleaved(samples, channels, sampleRate);
}
function ebur128LoudnessRange(samples, sampleRate = 22050) {
  if (!(samples instanceof Float32Array)) {
    return ebur128LoudnessRange(samples.samples, samples.sampleRate);
  }
  return requireModule12().ebur128LoudnessRange(samples, sampleRate);
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
  return requireModule12().spectralBandwidth(samples, sampleRate, nFft, hopLength, p);
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
  return requireModule12().spectralRolloff(samples, sampleRate, nFft, hopLength, rollPercent);
}
function spectralFlatness(samples, sampleRate = 22050, nFft = 2048, hopLength = 512) {
  if (!(samples instanceof Float32Array)) {
    return spectralFlatness(samples.samples, samples.sampleRate, samples.nFft, samples.hopLength);
  }
  return requireModule12().spectralFlatness(samples, sampleRate, nFft, hopLength);
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
  return requireModule12().spectralFlux(samples, sampleRate, nFft, hopLength, lag);
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
  return requireModule12().zeroCrossingRate(samples, sampleRate, frameLength, hopLength);
}
function rmsEnergy(samples, sampleRate = 22050, frameLength = 2048, hopLength = 512) {
  if (!(samples instanceof Float32Array)) {
    return rmsEnergy(samples.samples, samples.sampleRate, samples.frameLength, samples.hopLength);
  }
  return requireModule12().rmsEnergy(samples, sampleRate, frameLength, hopLength);
}
function segmentCrossSimilarity(request) {
  validateSegmentMatrix("segmentCrossSimilarity", request.x, request.xRows, request.xCols, "x");
  validateSegmentMatrix("segmentCrossSimilarity", request.y, request.yRows, request.yCols, "y");
  if (request.xRows !== request.yRows) {
    throw new RangeError("segmentCrossSimilarity: feature dimensions must match");
  }
  assertNonNegativeInteger("segmentCrossSimilarity", request.k ?? 0, "k");
  return requireModule12().segmentCrossSimilarity(
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
  return requireModule12().segmentRecurrenceMatrix(
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
  return requireModule12().segmentRecurrenceToLag(
    request.recurrence,
    request.n,
    request.pad ?? false
  );
}
function segmentLagToRecurrence(request) {
  validateSegmentMatrix("segmentLagToRecurrence", request.lag, request.rows, request.lags, "lag");
  return requireModule12().segmentLagToRecurrence(request.lag, request.rows, request.lags);
}
function segmentSubsegment(request) {
  validateSegmentMatrix("segmentSubsegment", request.data, request.rows, request.cols, "data");
  assertPositiveInteger("segmentSubsegment", request.nSegments ?? 4, "nSegments");
  return requireModule12().segmentSubsegment(
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
  return requireModule12().segmentAgglomerative(
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
  return requireModule12().segmentPathEnhance(
    request.recurrence,
    request.n,
    request.win,
    request.maxRatio ?? 2,
    request.minRatio ?? 0,
    request.nFilters ?? 7
  );
}

// src/feature_spectrogram.ts
function requireModule13() {
  return getSonareModule();
}
function validateSpectrogramSamples(fnName, samples, sampleRate, options = {}) {
  assertSampleRate(fnName, sampleRate);
  assertSamples(fnName, samples, options.validate !== false);
}
function validatePositiveIntegers2(fnName, values) {
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
function validateMatrix(fnName, data, rows, frames, dataName, rowName, options = {}) {
  validatePositiveIntegers2(fnName, { [rowName]: rows, nFrames: frames });
  assertSamples(fnName, data, options.validate !== false, dataName);
  const expectedLength = rows * frames;
  if (!Number.isSafeInteger(expectedLength) || data.length !== expectedLength) {
    throw new RangeError(`${fnName}: ${dataName} length must equal ${rowName} * nFrames`);
  }
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
  return requireModule13().trimEx(
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
  validatePositiveIntegers2("stft", { nFft, hopLength });
  return requireModule13().stft(samples, sampleRate, nFft, hopLength);
}
function stftDb(samples, sampleRate = 22050, nFft = 2048, hopLength = 512, options = {}) {
  if (!(samples instanceof Float32Array)) {
    const request = samples;
    return stftDb(request.samples, request.sampleRate, request.nFft, request.hopLength, request);
  }
  validateSpectrogramSamples("stftDb", samples, sampleRate, options);
  validatePositiveIntegers2("stftDb", { nFft, hopLength });
  return requireModule13().stftDb(samples, sampleRate, nFft, hopLength);
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
  validatePositiveIntegers2("chromaCens", { hopLength, nChroma, binsPerOctave });
  if (binsPerOctave % nChroma !== 0) {
    throw new RangeError("chromaCens: binsPerOctave must be a multiple of nChroma");
  }
  return requireModule13().chromaCens(samples, sampleRate, hopLength, nChroma, binsPerOctave);
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
  validatePositiveIntegers2("chromaCqt", { hopLength, nChroma, binsPerOctave });
  if (binsPerOctave % nChroma !== 0) {
    throw new RangeError("chromaCqt: binsPerOctave must be a multiple of nChroma");
  }
  return requireModule13().chromaCqt(samples, sampleRate, hopLength, nChroma, binsPerOctave);
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
  validatePositiveIntegers2("bassChroma", { hopLength, nChroma });
  return requireModule13().bassChroma(samples, sampleRate, hopLength, nChroma);
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
  validatePositiveIntegers2("melSpectrogram", { nFft, hopLength, nMels });
  validateMelFrequencyRange("melSpectrogram", fmin, fmax, sampleRate);
  return requireModule13().melSpectrogram(
    samples,
    sampleRate,
    nFft,
    hopLength,
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
  validatePositiveIntegers2("mfcc", { nFft, hopLength, nMels, nMfcc });
  validateMelFrequencyRange("mfcc", fmin, fmax, sampleRate);
  return requireModule13().mfcc(
    samples,
    sampleRate,
    nFft,
    hopLength,
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
  return requireModule13().melDelta(
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
  return requireModule13().reassignedSpectrogram(
    samples,
    sampleRate,
    nFft,
    hopLength,
    refPower,
    fillNan
  );
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
  validatePositiveIntegers2("melToStft", { nFft });
  validateMelFrequencyRange("melToStft", fmin, fmax, sampleRate);
  return requireModule13().melToStft(melPower, nMels, nFrames, sampleRate, nFft, fmin, fmax, htk);
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
  validatePositiveIntegers2("melToAudio", { nFft, hopLength, nIter });
  validateMelFrequencyRange("melToAudio", fmin, fmax, sampleRate);
  return requireModule13().melToAudio(
    melPower,
    nMels,
    nFrames,
    sampleRate,
    nFft,
    hopLength,
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
  validatePositiveIntegers2("griffinLim", { nFft, hopLength, nIter });
  return requireModule13().griffinLim(
    magnitude,
    nBins,
    nFrames,
    sampleRate,
    nFft,
    hopLength,
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
  validatePositiveIntegers2("mfccToMel", { nMels });
  return requireModule13().mfccToMel(mfccCoefficients, nMfcc, nFrames, nMels, lifter);
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
  validatePositiveIntegers2("mfccToAudio", { nMels, nFft, hopLength, nIter });
  validateMelFrequencyRange("mfccToAudio", fmin, fmax, sampleRate);
  return requireModule13().mfccToAudio(
    mfccCoefficients,
    nMfcc,
    nFrames,
    nMels,
    sampleRate,
    nFft,
    hopLength,
    fmin,
    fmax,
    nIter,
    htk,
    lifter
  );
}
function chroma(samples, sampleRate = 22050, nFft = 2048, hopLength = 512, options = {}) {
  if (!(samples instanceof Float32Array)) {
    const request = samples;
    return chroma(request.samples, request.sampleRate, request.nFft, request.hopLength, request);
  }
  validateSpectrogramSamples("chroma", samples, sampleRate, options);
  validatePositiveIntegers2("chroma", { nFft, hopLength });
  return requireModule13().chroma(samples, sampleRate, nFft, hopLength);
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
var TRACK_MONITOR_MODE_VALUES = { off: 0, pfl: 1, afl: 2 };
function automationCurveCode(curve) {
  return resolveEnumOrdinal(curve, AUTOMATION_CURVE_VALUES, "automation curve");
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
function trackMonitorModeCode(mode) {
  return resolveEnumOrdinal(mode, TRACK_MONITOR_MODE_VALUES, "track monitor mode");
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
function requireModule14() {
  return getSonareModule();
}
function validateAnalysisInput(fnName, samples, sampleRate, options = {}) {
  assertSampleRate(fnName, sampleRate);
  assertSamples(fnName, samples, options.validate !== false);
}
function detectBpm(samples, sampleRate = 22050, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  validateAnalysisInput("detectBpm", request.samples, request.sampleRate ?? 22050, request);
  return requireModule14().detectBpm(request.samples, request.sampleRate ?? 22050);
}
function detectKey(samples, sampleRate = 22050, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  validateAnalysisInput("detectKey", request.samples, request.sampleRate ?? 22050, request);
  const result = requireModule14()._detectKeyWithOptions(
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
  const candidates = requireModule14()._detectKeyCandidates(
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
  return requireModule14().detectOnsets(request.samples, request.sampleRate ?? 22050, request);
}
function detectBeats(samples, sampleRate = 22050, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  validateAnalysisInput("detectBeats", request.samples, request.sampleRate ?? 22050, request);
  return requireModule14().detectBeats(request.samples, request.sampleRate ?? 22050);
}
function detectDownbeats(samples, sampleRate = 22050, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  validateAnalysisInput("detectDownbeats", request.samples, request.sampleRate ?? 22050, request);
  return requireModule14().detectDownbeats(request.samples, request.sampleRate ?? 22050);
}
function detectChords(samples, sampleRate = 22050, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  validateAnalysisInput("detectChords", request.samples, request.sampleRate ?? 22050, request);
  const result = requireModule14().detectChords(
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
function chordFunctionalAnalysis(samples, keyRoot, keyMode, sampleRate = 22050, options = {}) {
  const request = samples instanceof Float32Array ? { samples, keyRoot, keyMode, sampleRate, ...options } : samples;
  validateAnalysisInput(
    "chordFunctionalAnalysis",
    request.samples,
    request.sampleRate ?? 22050,
    request
  );
  return requireModule14().chordFunctionalAnalysis(
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
    chordChromaMethodValue(request.chromaMethod ?? "stft")
  );
}
function analyze(samples, sampleRate = 22050, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  validateAnalysisInput("analyze", request.samples, request.sampleRate ?? 22050, request);
  const result = requireModule14().analyze(request.samples, request.sampleRate ?? 22050, request);
  return convertAnalysisResult(result);
}
function analyzeImpulseResponse(samples, sampleRate = 48e3, nOctaveBands = 6, minDecayDb) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, nOctaveBands, minDecayDb } : samples;
  if (request.minDecayDb === null) {
    throw new TypeError("analyzeImpulseResponse: minDecayDb must be a finite number");
  }
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
  const result = requireModule14().analyzeImpulseResponseEx(
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
  const result = requireModule14().detectAcoustic(
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
  const module2 = requireModule14();
  if (typeof module2.synthesizeRir !== "function") {
    throw new Error("libsonare was built without acoustic-simulation support");
  }
  return module2.synthesizeRir(options);
}
function estimateRoom(samples, sampleRate = 48e3, options = {}) {
  const module2 = requireModule14();
  if (typeof module2.estimateRoom !== "function") {
    throw new Error("libsonare was built without acoustic-simulation support");
  }
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  validateAnalysisInput("estimateRoom", request.samples, request.sampleRate ?? 48e3, request);
  return module2.estimateRoom(request.samples, request.sampleRate ?? 48e3, request);
}
function roomMorph(samples, sampleRate, options = {}) {
  const module2 = requireModule14();
  if (typeof module2.roomMorph !== "function") {
    throw new Error("libsonare was built without acoustic-simulation support");
  }
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  validateAnalysisInput("roomMorph", request.samples, request.sampleRate, request);
  return module2.roomMorph(request.samples, request.sampleRate, request);
}
function analyzeWithProgress(samples, sampleRate = 22050, onProgress) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, onProgress } : samples;
  validateAnalysisInput(
    "analyzeWithProgress",
    request.samples,
    request.sampleRate ?? 22050,
    request
  );
  const result = requireModule14().analyzeWithProgress(
    request.samples,
    request.sampleRate ?? 22050,
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
  return requireModule14().analyzeBpm(
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
  return requireModule14().analyzeRhythm(
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
  return requireModule14().analyzeDynamics(
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
  return requireModule14().analyzeTimbre(
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
  return requireModule14().hasFfmpegSupport();
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
  const { stream: providedStream, stopTracksOnClose = true, ...constraints } = options;
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

// src/metering.ts
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
function requireModule15() {
  return getSonareModule();
}
function meteringPeakDb(samples, sampleRate = 22050, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  assertSamples("meteringPeakDb", request.samples, request.validate !== false);
  return requireModule15().meteringPeakDb(request.samples, request.sampleRate ?? 22050);
}
function meteringRmsDb(samples, sampleRate = 22050, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  assertSamples("meteringRmsDb", request.samples, request.validate !== false);
  return requireModule15().meteringRmsDb(request.samples, request.sampleRate ?? 22050);
}
function meteringSilenceRatio(samples, sampleRate = 22050, thresholdDb = -45, frameLength = 1024, hopLength = 256, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, thresholdDb, frameLength, hopLength, ...options } : samples;
  assertSamples("meteringSilenceRatio", request.samples, request.validate !== false);
  return requireModule15().meteringSilenceRatio(
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
  return requireModule15().meteringCrestFactorDb(request.samples, request.sampleRate ?? 22050);
}
function meteringCrestFactorDbStereo(request) {
  assertSamples("meteringCrestFactorDbStereo", request.left, request.validate !== false);
  assertSamples("meteringCrestFactorDbStereo", request.right, request.validate !== false);
  return requireModule15().meteringCrestFactorDbStereo(
    request.left,
    request.right,
    request.sampleRate ?? 22050
  );
}
function meteringDcOffset(samples, sampleRate = 22050, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  assertSamples("meteringDcOffset", request.samples, request.validate !== false);
  return requireModule15().meteringDcOffset(request.samples, request.sampleRate ?? 22050);
}
function meteringTruePeakDb(samples, sampleRate = 22050, oversampleFactor = 4, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, oversampleFactor, ...options } : samples;
  assertSamples("meteringTruePeakDb", request.samples, request.validate !== false);
  const factor = request.oversampleFactor ?? 4;
  assertOversampleFactor("meteringTruePeakDb", factor);
  return requireModule15().meteringTruePeakDb(request.samples, request.sampleRate ?? 22050, factor);
}
function meteringDetectClipping(samples, sampleRate = 22050, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  assertSamples("meteringDetectClipping", request.samples, request.validate !== false);
  const minRegionSamples = request.minRegionSamples ?? 1;
  if (!Number.isInteger(minRegionSamples) || minRegionSamples < 0) {
    throw new RangeError("meteringDetectClipping: minRegionSamples must be a non-negative integer");
  }
  return requireModule15().meteringDetectClipping(
    request.samples,
    request.sampleRate ?? 22050,
    request.threshold ?? 0.999,
    minRegionSamples
  );
}
function meteringDynamicRange(samples, sampleRate = 22050, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  assertSamples("meteringDynamicRange", request.samples, request.validate !== false);
  return requireModule15().meteringDynamicRange(
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
  return requireModule15().meteringStereoCorrelation(
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
  return requireModule15().meteringStereoWidth(
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
  return requireModule15().meteringVectorscopeDecimated(
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
  return requireModule15().meteringVectorscopeDecimated(
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
  return requireModule15().meteringPhaseScopeDecimated(
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
  return requireModule15().meteringPhaseScopeDecimated(
    request.left,
    request.right,
    request.sampleRate ?? 22050,
    request.maxPoints ?? 0
  );
}
function meteringSpectrum(samples, sampleRate = 22050, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, ...options } : samples;
  assertSamples("meteringSpectrum", request.samples, request.validate !== false);
  return requireModule15().meteringSpectrum(request.samples, request.sampleRate ?? 22050, request);
}
function meteringSpectrumFrame(samples, sampleRate = 22050, frameOffset = 0, options = {}) {
  const request = samples instanceof Float32Array ? { samples, sampleRate, frameOffset, ...options } : samples;
  assertSamples("meteringSpectrumFrame", request.samples, request.validate !== false);
  return requireModule15().meteringSpectrumFrame(
    request.samples,
    request.sampleRate ?? 22050,
    request.frameOffset ?? 0,
    request
  );
}
function waveformPeaks(samples, channels, options = {}) {
  const request = samples instanceof Float32Array ? { samples, channels, ...options } : samples;
  assertSamples("waveformPeaks", request.samples, request.validate !== false);
  if (request.channels <= 0 || request.samples.length % request.channels !== 0) {
    throw new RangeError("waveformPeaks: samples length must be a multiple of channels");
  }
  const samplesPerBucket = request.samplesPerBucket ?? 512;
  if (samplesPerBucket <= 0) {
    throw new RangeError("waveformPeaks: samplesPerBucket must be > 0");
  }
  return requireModule15().waveformPeaks(request.samples, request.channels, samplesPerBucket);
}
function waveformPeakPyramid(samples, channels, options = {}) {
  const request = samples instanceof Float32Array ? { samples, channels, ...options } : samples;
  assertSamples("waveformPeakPyramid", request.samples, request.validate !== false);
  if (request.channels <= 0 || request.samples.length % request.channels !== 0) {
    throw new RangeError("waveformPeakPyramid: samples length must be a multiple of channels");
  }
  const levels = request.samplesPerBucketLevels ?? [512, 1024, 2048, 4096];
  if (levels.length === 0 || levels.some((level) => level <= 0)) {
    throw new RangeError("waveformPeakPyramid: samplesPerBucketLevels must be non-empty and > 0");
  }
  return requireModule15().waveformPeakPyramid(request.samples, request.channels, levels);
}

// src/project_internal.ts
function projectModule() {
  const candidate = getSonareModule();
  if (typeof candidate.projectAbiVersion !== "function" || candidate.Project === void 0) {
    throw new Error("libsonare was built without arrangement (headless DAW) support");
  }
  return candidate;
}
function assertProjectU7(fnName, value, argName) {
  if (!Number.isInteger(value) || value < 0 || value > 127) {
    throw new RangeError(`${fnName}: ${argName} must be an integer in [0, 127]`);
  }
  return value;
}
function assertProjectNibble(fnName, value, argName) {
  if (!Number.isInteger(value) || value < 0 || value > 15) {
    throw new RangeError(`${fnName}: ${argName} must be an integer in [0, 15]`);
  }
  return value;
}
function projectMidi1Event(fnName, ppq, group, status, channel, data1, data2 = 0) {
  if (!Number.isFinite(ppq) || ppq < 0) {
    throw new RangeError(`${fnName}: ppq must be a non-negative finite number`);
  }
  const g = assertProjectNibble(fnName, group, "group");
  const ch = assertProjectNibble(fnName, channel, "channel");
  const d1 = assertProjectU7(fnName, data1, "data1");
  const d2 = assertProjectU7(fnName, data2, "data2");
  const word = (2 << 28 | g << 24 | status << 20 | ch << 16 | d1 << 8 | d2) >>> 0;
  return { ppq, data0: word, data1: 0 };
}
function assertProjectU32(fnName, value, argName) {
  if (!Number.isInteger(value) || value < 0 || value > 4294967295) {
    throw new RangeError(`${fnName}: ${argName} must be an integer in [0, 4294967295]`);
  }
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
      assertProjectU32(fnName, event[1], `${prefix}.data0`);
      assertProjectU32(fnName, event[2], `${prefix}.data1`);
      return;
    }
    if (event === null || typeof event !== "object") {
      throw new TypeError(`${fnName}: ${prefix} must be a MIDI event object or tuple`);
    }
    if (!Number.isFinite(event.ppq) || event.ppq < 0) {
      throw new RangeError(`${fnName}: ${prefix}.ppq must be a non-negative finite number`);
    }
    assertProjectU32(fnName, event.data0, `${prefix}.data0`);
    if (event.data1 !== void 0) {
      assertProjectU32(fnName, event.data1, `${prefix}.data1`);
    }
  });
}
function projectTrackKindValue(kind) {
  return resolveEnumOrdinal(kind ?? "audio", { audio: 0, midi: 1, aux: 2 }, "project track kind");
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
    { off: 0, repitch: 1, "tempo-sync": 2 },
    "project warp mode"
  );
}
function projectLoopModeValue(mode) {
  return resolveEnumOrdinal(mode ?? "off", { off: 0, loop: 1 }, "project loop mode");
}

// src/project_class.ts
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
    if (!Number.isInteger(bend) || bend < 0 || bend > 16383) {
      throw new RangeError("Project.midiPitchBend: bend must be an integer in [0, 16383]");
    }
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
  /** Set the project sample rate in Hz. Must be > 0. */
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
  /** Set a track's linear playback gain (1.0 = unity; >= 0) via an undoable edit. */
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
  /** Set a track's stereo balance in [-1, +1] (0 = center) via an undoable edit. */
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
  /** Replace a MIDI clip's entire event list. */
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
  /** Export the project's tempo map + MIDI clips to an SMF byte buffer. */
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
  /**
   * Destructively bake a MIDI-FX chain into all stored events. Large clips are
   * drained without truncation; failure leaves the original clip unchanged.
   */
  bakeMidiFx(clipId, configJson) {
    this.native.bakeMidiFx(clipId, configJson);
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
  /** Return ranked tempo-octave and detected-meter candidates without editing. */
  analyzeTempo(audio, sampleRate) {
    return this.native.analyzeTempo(audio, sampleRate);
  }
  /** Detect and install a ranked tempo candidate; optionally apply detected meter. */
  autoTempo(audio, sampleRate, candidateIndex = 0, applyTimeSignatures = false) {
    return this.native.autoTempo(audio, sampleRate, candidateIndex, applyTimeSignatures);
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
   * patch-driven NativeSynth — the full synthesizer (subtractive / FM /
   * Karplus-Strong / modal / additive / percussion / extended-waveguide-piano
   * engines plus the realism layer). Pass a {@link SynthPatch}, a preset-name
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
   */
  bounceWithSynthInstrument(instrument = {}, options = {}) {
    return this.native.bounceWithSynthInstrument(instrument, options);
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
    const nativeDesc = { ...desc };
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
    const nativeDesc = { ...desc };
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
   * (e.g. MIDI clips rendering silently without a bound instrument). When no
   * bounce has run, the result is empty with `hasTimeline` set.
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
function synthPresetPatch(name) {
  return { ...projectModule().synthPresetPatch(name) };
}
function synthEnumTables() {
  return projectModule()._synthEnumTables();
}

// src/project_types.ts
var EXPECTED_PROJECT_ABI_VERSION = 1;
var MarkerKind = {
  marker: 0,
  text: 1,
  lyric: 2,
  cuePoint: 3,
  keySignature: 4
};
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
  "free-reed"
];
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
  "random"
];
var SYNTH_MOD_DESTINATIONS = [
  "none",
  "pitch-cents",
  "cutoff-cents",
  "amp-gain",
  "pan-units"
];
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
var RealtimeEngine = class {
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
   */
  setSynthInstrument(patch = {}, destinationId = (typeof patch === "object" ? patch.destinationId : void 0) ?? 0) {
    this.native.setSynthInstrument(destinationId, patch);
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
    return this.native.externalMidiScratchRenderFrame();
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
  setTrackLanes(lanes) {
    this.native.setTrackLanes(
      lanes.map((lane) => {
        if (typeof lane === "number") {
          return { trackId: lane };
        }
        if (!lane.sends) {
          return lane;
        }
        return {
          ...lane,
          sends: lane.sends.map((send) => ({
            ...send,
            // Post-fader (0) is the default for an omitted sendTiming.
            sendTiming: send.sendTiming === void 0 ? 0 : sendTimingCode(send.sendTiming)
          }))
        };
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
    this.native.setTrackBuses(buses);
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
   * processor's JSON-key parameter name (see {@link masteringInsertParamInfo}).
   * Applied at the next block head via the engine command queue; safe during
   * playback. Throws if the track, insert, or name is unknown, the param is not
   * realtime-safe, or the command queue is full.
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
  destroy() {
    this.native.delete();
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
   * @param samples - Audio samples (mono, float32)
   */
  process(samples) {
    this.analyzer.process(samples);
  }
  /**
   * Process audio samples with a contiguous explicit sample offset. A gap,
   * seek, or switch from `process()` requires `reset()` first.
   *
   * @param samples - Audio samples (mono, float32)
   * @param sampleOffset - Cumulative sample count at start of this chunk
   */
  processWithOffset(samples, sampleOffset) {
    this.analyzer.processWithOffset(samples, sampleOffset);
  }
  /**
   * Drain any high-rate resampler tail, then zero-pad the final partial frame.
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
  /** Release the underlying WASM object. Safe to call only once. */
  delete() {
    this.analyzer.delete();
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
   * Stored on the scene; inert until the surround DSP path applies it.
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
      this.changer.prepare(sampleRate, maxBlockSize, channels);
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
  /** Release the underlying WASM object. Safe to call only once. */
  delete() {
    this.chain.delete();
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
function assertNibble(fnName, value, field) {
  if (!Number.isInteger(value) || value < 0 || value > 15) {
    throw new RangeError(`${fnName}: ${field} must be an integer in [0, 15]`);
  }
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
  Audio,
  AutomationTargetKind,
  BUILTIN_SYNTH_WAVEFORMS,
  ChordQuality,
  ClipPageProvider,
  ClipPageStreamer,
  EXPECTED_ENGINE_ABI_VERSION,
  EXPECTED_PROJECT_ABI_VERSION,
  ErrorCode,
  KeyProfile,
  MarkerKind,
  Mixer,
  Mode,
  OfflineWorkerClient,
  OfflineWorkerTask,
  PROJECT_AUTOMATION_TARGET_OPAQUE,
  PROJECT_AUTOMATION_TARGET_TRACK_FADER_DB,
  PROJECT_AUTOMATION_TARGET_TRACK_PAN,
  PitchClass as Pitch,
  PitchClass,
  Project,
  RealtimeEngine,
  RealtimeVoiceChanger,
  SYNTH_BODY_TYPES,
  SYNTH_ENGINE_MODES,
  SYNTH_FILTER_MODELS,
  SYNTH_FILTER_OUTPUTS,
  SYNTH_MOD_DESTINATIONS,
  SYNTH_MOD_SOURCES,
  SYNTH_OSC_WAVEFORMS,
  SectionType,
  SonareError,
  StreamAnalyzer,
  StreamingEqualizer,
  StreamingMasteringChain,
  StreamingRetune,
  abiVersion,
  amplitudeToDb,
  analyze,
  analyzeBpm,
  analyzeDynamics,
  analyzeImpulseResponse,
  analyzeMelody,
  analyzeRhythm,
  analyzeSections,
  analyzeTimbre,
  analyzeWithProgress,
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
  cqt,
  cqtToAudio,
  createOpfsClipPageProvider,
  createOpfsClipPageWorker,
  cyclicTempogram,
  dbToAmplitude,
  dbToPower,
  decompose,
  decomposeWithInit,
  deemphasis,
  detectAcoustic,
  detectBeats,
  detectBpm,
  detectChords,
  detectDownbeats,
  detectKey,
  detectKeyCandidates,
  detectOnsets,
  ebur128LoudnessRange,
  engineAbiVersion,
  engineCapabilities,
  estimateRoom,
  estimateTuning,
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
  masterAudio,
  masterAudioStereo,
  masterAudioStereoWithProgress,
  masterAudioWithProgress,
  mastering,
  masteringAssistantSuggest,
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
  masteringPairAnalysisNames,
  masteringPairAnalyze,
  masteringPairProcess,
  masteringPairProcessorNames,
  masteringPresetNames,
  masteringProcess,
  masteringProcessStereo,
  masteringProcessorCatalog,
  masteringProcessorNames,
  masteringRepairDeclick,
  masteringRepairDeclip,
  masteringRepairDecrackle,
  masteringRepairDehum,
  masteringRepairDenoiseClassical,
  masteringRepairDereverbClassical,
  masteringRepairTrimSilence,
  masteringStereoAnalysisNames,
  masteringStereoAnalyze,
  masteringStreamingPreview,
  masteringStreamingPreviewStereo,
  melDelta,
  melSpectrogram,
  melToAudio,
  melToHz,
  melToStft,
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
  mixStereo,
  mixingScenePresetJson,
  mixingScenePresetNames,
  momentaryLufs,
  nnFilter,
  nnlsChroma,
  normalize,
  noteMove,
  noteSegments,
  noteStretch,
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
  splitSilence,
  stft,
  stftDb,
  streamAnalyzerConfigDefaults,
  synthEnumTables,
  synthPresetNames,
  synthPresetPatch,
  synthesizeRir,
  tempogram,
  tempogramRatio,
  timeStretch,
  timeToFrames,
  tone,
  tonnetz,
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
