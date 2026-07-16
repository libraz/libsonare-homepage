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
  if (!Number.isInteger(sampleRate) || sampleRate < 8e3 || sampleRate > 384e3) {
    throw new RangeError(`${fnName}: sampleRate out of supported range [8000, 384000]`);
  }
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
function hpss(samples, sampleRate = 22050, kernelHarmonic = 31, kernelPercussive = 31) {
  return requireModule().hpss(samples, sampleRate, kernelHarmonic, kernelPercussive);
}
function harmonic(samples, sampleRate, options = {}) {
  assertSamples("harmonic", samples, options.validate !== false);
  return requireModule().harmonic(samples, sampleRate);
}
function percussive(samples, sampleRate, options = {}) {
  assertSamples("percussive", samples, options.validate !== false);
  return requireModule().percussive(samples, sampleRate);
}
function timeStretch(samples, sampleRate, rate, options = {}) {
  assertSamples("timeStretch", samples, options.validate !== false);
  return requireModule().timeStretch(samples, sampleRate, rate);
}
function pitchShift(samples, sampleRate, semitones, options = {}) {
  assertSamples("pitchShift", samples, options.validate !== false);
  return requireModule().pitchShift(samples, sampleRate, semitones);
}
function pitchCorrectToMidi(samples, sampleRate = 22050, currentMidi = 69, targetMidi = 69, options = {}) {
  assertSamples("pitchCorrectToMidi", samples, options.validate !== false);
  return requireModule().pitchCorrectToMidi(samples, sampleRate, currentMidi, targetMidi);
}
function pitchCorrectToMidiTimevarying(samples, f0Hz, targetMidi, sampleRate = 22050, hopLength = 512, voiced, voicedProb, options = {}) {
  assertSamples("pitchCorrectToMidiTimevarying", samples, options.validate !== false);
  if (voiced && voiced.length !== f0Hz.length) {
    throw new RangeError("pitchCorrectToMidiTimevarying: voiced length must match f0Hz length");
  }
  if (voicedProb && voicedProb.length !== f0Hz.length) {
    throw new RangeError("pitchCorrectToMidiTimevarying: voicedProb length must match f0Hz length");
  }
  const voicedF32 = voiced ? Float32Array.from(voiced) : void 0;
  return requireModule().pitchCorrectToMidiTimevarying(
    samples,
    sampleRate,
    f0Hz,
    targetMidi,
    hopLength,
    voicedF32,
    voicedProb
  );
}
function pitchCorrectTimevarying(samples, f0Hz, sampleRate = 22050, hopLength = 512, options = {}) {
  assertSamples("pitchCorrectTimevarying", samples, options.validate !== false);
  if (options.voiced && options.voiced.length !== f0Hz.length) {
    throw new RangeError("pitchCorrectTimevarying: voiced length must match f0Hz length");
  }
  if (options.voicedProb && options.voicedProb.length !== f0Hz.length) {
    throw new RangeError("pitchCorrectTimevarying: voicedProb length must match f0Hz length");
  }
  const nativeOptions = {
    ...options,
    voiced: options.voiced ? Float32Array.from(options.voiced) : void 0
  };
  return requireModule().pitchCorrectTimevarying(
    samples,
    sampleRate,
    f0Hz,
    hopLength,
    nativeOptions
  );
}
function noteStretch(samples, sampleRate = 22050, options = {}) {
  assertSamples("noteStretch", samples, options.validate !== false);
  return requireModule().noteStretch(
    samples,
    sampleRate,
    options.onsetSample ?? 0,
    options.offsetSample ?? 0,
    options.stretchRatio ?? 1
  );
}
function normalize(samples, sampleRate, targetDb = 0, options = {}) {
  assertSamples("normalize", samples, options.validate !== false);
  return requireModule().normalize(samples, sampleRate, targetDb);
}
function spectralEdit(samples, sampleRate, ops = [], options = {}) {
  assertSamples("spectralEdit", samples, options.validate !== false);
  assertSampleRate("spectralEdit", sampleRate);
  return requireModule().spectralEdit(samples, sampleRate, ops, options);
}

// src/codes.ts
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
function panModeCode(panMode) {
  if (typeof panMode === "number") {
    return panMode;
  }
  switch (panMode) {
    case "stereoPan":
    case "stereo-pan":
      return 1;
    case "dualPan":
    case "dual-pan":
      return 2;
    default:
      return 0;
  }
}
function meterTapCode(tap) {
  return tap === "preFader" || tap === 0 ? 0 : 1;
}
function sendTimingCode(timing) {
  if (typeof timing === "number") {
    return timing;
  }
  return timing === "preFader" ? 1 : 0;
}

// src/mixer.ts
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
    const module2 = getSonareModule();
    return new _Mixer(module2.createMixerFromSceneJson(json, sampleRate, blockSize));
  }
  /** Rebuild and compile the routing graph from the current scene topology. */
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
  constructor(config = "neutral-monitor") {
    const module2 = getSonareModule();
    this.changer = module2.createRealtimeVoiceChanger(config);
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
  configJson() {
    return this.changer.configJson();
  }
  latencySamples() {
    return this.changer.latencySamples();
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
    const reacquireIfDetached = () => {
      if (input.byteLength === 0 || output.byteLength === 0) {
        input = this.getMonoInputBuffer(numSamples);
        output = this.getMonoOutputBuffer(numSamples);
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
    const reacquireIfDetached = () => {
      if (input.byteLength === 0 || output.byteLength === 0) {
        input = this.getInterleavedInputBuffer(numFrames, numChannels);
        output = this.getInterleavedOutputBuffer(numFrames, numChannels);
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
    const acquire = () => {
      channels = [];
      for (let ch = 0; ch < numChannels; ch++) {
        channels.push(this.getPlanarChannelBuffer(ch, numFrames));
      }
    };
    acquire();
    const reacquireIfDetached = () => {
      if ((channels[0]?.byteLength ?? 0) === 0) {
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
    this.chain = module2.createStreamingMasteringChain(config);
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

// src/effects_voice_change.ts
function requireModule2() {
  return getSonareModule();
}
function voiceChange(samples, sampleRate = 22050, options = {}) {
  assertSamples("voiceChange", samples, options.validate !== false);
  return requireModule2().voiceChange(
    samples,
    sampleRate,
    options.pitchSemitones ?? 0,
    options.formantFactor ?? 1
  );
}
function latencyCompensatedVoiceChange(changer, samples, channels, blockFrames) {
  const latencyFrames = Math.max(0, changer.latencySamples());
  if (channels === 1) {
    const total = samples.length + latencyFrames;
    const input2 = new Float32Array(total);
    input2.set(samples);
    const processed2 = new Float32Array(total);
    for (let offset = 0; offset < total; offset += blockFrames) {
      const block = input2.subarray(offset, Math.min(offset + blockFrames, total));
      processed2.set(changer.processMono(block), offset);
    }
    return processed2.slice(latencyFrames, latencyFrames + samples.length);
  }
  const frames = samples.length / 2;
  const totalFrames = frames + latencyFrames;
  const input = new Float32Array(totalFrames * 2);
  input.set(samples);
  const processed = new Float32Array(totalFrames * 2);
  const frameStride = blockFrames * 2;
  for (let offset = 0; offset < input.length; offset += frameStride) {
    const block = input.subarray(offset, Math.min(offset + frameStride, input.length));
    processed.set(changer.processInterleaved(block, 2), offset);
  }
  const start = latencyFrames * 2;
  return processed.slice(start, start + samples.length);
}
function voiceChangeRealtime(samples, sampleRate = 48e3, preset = "neutral-monitor", options = {}) {
  assertSamples("voiceChangeRealtime", samples, options.validate !== false);
  const channels = options.channels ?? 1;
  if (channels !== 1 && channels !== 2) {
    throw new Error("voiceChangeRealtime: channels must be 1 or 2.");
  }
  if (channels === 2 && samples.length % 2 !== 0) {
    throw new Error("voiceChangeRealtime: stereo input length must be a multiple of 2.");
  }
  const blockSize = Math.max(1, Math.floor(options.blockSize ?? 512));
  const changer = new RealtimeVoiceChanger(preset);
  try {
    changer.prepare(sampleRate, blockSize, channels);
    return latencyCompensatedVoiceChange(changer, samples, channels, blockSize);
  } finally {
    changer.delete();
  }
}

// src/mastering_chain.ts
function requireModule3() {
  return getSonareModule();
}
function masteringChain(samples, sampleRate = 22050, config) {
  return requireModule3().masteringChain(samples, sampleRate, config);
}
function masteringChainStereo(left, right, sampleRate = 22050, config) {
  if (left.length !== right.length) {
    throw new Error("Stereo channel lengths must match.");
  }
  return requireModule3().masteringChainStereo(
    left,
    right,
    sampleRate,
    config
  );
}
function masteringChainWithProgress(samples, sampleRate = 22050, config, onProgress) {
  return requireModule3().masteringChainWithProgress(
    samples,
    sampleRate,
    config,
    onProgress
  );
}
function masteringChainStereoWithProgress(left, right, sampleRate = 22050, config, onProgress) {
  if (left.length !== right.length) {
    throw new Error("Stereo channel lengths must match.");
  }
  return requireModule3().masteringChainStereoWithProgress(
    left,
    right,
    sampleRate,
    config,
    onProgress
  );
}
function masteringPresetNames() {
  return Array.from(requireModule3().masteringPresetNames());
}
function masterAudio(samples, sampleRate = 22050, presetName = "pop", overrides = {}) {
  return requireModule3().masterAudio(presetName, samples, sampleRate, overrides);
}
function masterAudioStereo(left, right, sampleRate = 22050, presetName = "pop", overrides = {}) {
  if (left.length !== right.length) {
    throw new Error("Stereo channel lengths must match.");
  }
  return requireModule3().masterAudioStereo(presetName, left, right, sampleRate, overrides);
}
function masterAudioWithProgress(samples, sampleRate = 22050, presetName, onProgress, overrides = null) {
  return requireModule3().masterAudioWithProgress(
    presetName,
    samples,
    sampleRate,
    overrides,
    onProgress
  );
}
function masterAudioStereoWithProgress(left, right, sampleRate = 22050, presetName, onProgress, overrides = null) {
  if (left.length !== right.length) {
    throw new Error("Stereo channel lengths must match.");
  }
  return requireModule3().masterAudioStereoWithProgress(
    presetName,
    left,
    right,
    sampleRate,
    overrides,
    onProgress
  );
}

// src/mastering_core.ts
function requireModule4() {
  return getSonareModule();
}
function mastering(samples, sampleRate = 22050, options = {}) {
  return requireModule4().mastering(
    samples,
    sampleRate,
    options.targetLufs ?? -14,
    options.ceilingDb ?? -1,
    options.truePeakOversample ?? 4,
    options.releaseMs ?? 0,
    // 0 => library default (50 ms)
    options.applyGainAtInputRate ?? false
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
  return requireModule4().masteringProcess(processorName, samples, sampleRate, params);
}
function masteringProcessStereo(processorName, left, right, sampleRate = 22050, params = {}) {
  if (left.length !== right.length) {
    throw new Error("Stereo channel lengths must match.");
  }
  return requireModule4().masteringProcessStereo(processorName, left, right, sampleRate, params);
}
function masteringPairProcess(processorName, source, reference, sampleRate = 22050, params = {}) {
  return requireModule4().masteringPairProcess(processorName, source, reference, sampleRate, params);
}
function masteringPairAnalyze(analysisName, source, reference, sampleRate = 22050, params = {}) {
  return requireModule4().masteringPairAnalyze(analysisName, source, reference, sampleRate, params);
}
function masteringStereoAnalyze(analysisName, left, right, sampleRate = 22050, params = {}) {
  return requireModule4().masteringStereoAnalyze(analysisName, left, right, sampleRate, params);
}
function masteringAssistantSuggest(samples, sampleRate = 22050, params = {}) {
  return requireModule4().masteringAssistantSuggest(samples, sampleRate, params);
}
function masteringAudioProfile(samples, sampleRate = 22050, params = {}) {
  return requireModule4().masteringAudioProfile(samples, sampleRate, params);
}
function masteringStreamingPreview(samples, sampleRate = 22050, platforms = []) {
  return requireModule4().masteringStreamingPreview(samples, sampleRate, platforms);
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
  assertSamples("masteringDynamicsCompressor", samples, options.validate !== false);
  const detector = typeof options.detector === "string" ? COMPRESSOR_DETECTOR_MAP[options.detector] : options.detector;
  const opts = { ...options };
  if (detector !== void 0) {
    opts.detector = detector;
  }
  return requireModule5().masteringDynamicsCompressor(samples, sampleRate, opts);
}
function masteringDynamicsGate(samples, sampleRate, options = {}) {
  assertSamples("masteringDynamicsGate", samples, options.validate !== false);
  return requireModule5().masteringDynamicsGate(samples, sampleRate, options);
}
function masteringDynamicsTransientShaper(samples, sampleRate, options = {}) {
  assertSamples("masteringDynamicsTransientShaper", samples, options.validate !== false);
  return requireModule5().masteringDynamicsTransientShaper(samples, sampleRate, options);
}

// src/mastering_repair.ts
function requireModule6() {
  return getSonareModule();
}
function masteringRepairDeclick(samples, sampleRate, options = {}) {
  return requireModule6().masteringRepairDeclick(samples, sampleRate, options);
}
function masteringRepairDenoiseClassical(samples, sampleRate, options = {}) {
  return requireModule6().masteringRepairDenoiseClassical(samples, sampleRate, options);
}
function masteringRepairDeclip(samples, sampleRate, options = {}) {
  return requireModule6().masteringRepairDeclip(samples, sampleRate, options);
}
function masteringRepairDecrackle(samples, sampleRate, options = {}) {
  return requireModule6().masteringRepairDecrackle(samples, sampleRate, options);
}
function masteringRepairDehum(samples, sampleRate, options = {}) {
  return requireModule6().masteringRepairDehum(samples, sampleRate, options);
}
function masteringRepairDereverbClassical(samples, sampleRate, options = {}) {
  return requireModule6().masteringRepairDereverbClassical(samples, sampleRate, options);
}
function masteringRepairTrimSilence(samples, sampleRate, options = {}) {
  return requireModule6().masteringRepairTrimSilence(samples, sampleRate, options);
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
  if (leftChannels.length === 0 || leftChannels.length !== rightChannels.length) {
    throw new Error("leftChannels and rightChannels must have the same non-zero length.");
  }
  return requireModule7().mixStereo(
    leftChannels,
    rightChannels,
    sampleRate,
    options
  );
}

// src/feature_core.ts
function requireModule8() {
  return getSonareModule();
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
  return requireModule8().powerToDb(values, ref, amin, topDb);
}
function amplitudeToDb(values, ref = 1, amin = 1e-5, topDb = 80) {
  return requireModule8().amplitudeToDb(values, ref, amin, topDb);
}
function dbToPower(values, ref = 1) {
  return requireModule8().dbToPower(values, ref);
}
function dbToAmplitude(values, ref = 1) {
  return requireModule8().dbToAmplitude(values, ref);
}
function preemphasis(samples, coef = 0.97, zi) {
  return requireModule8().preemphasis(samples, coef, zi ?? null);
}
function deemphasis(samples, coef = 0.97, zi) {
  return requireModule8().deemphasis(samples, coef, zi ?? null);
}
function trimSilence(samples, topDb = 60, frameLength = 2048, hopLength = 512) {
  return requireModule8().trimSilence(samples, topDb, frameLength, hopLength);
}
function splitSilence(samples, topDb = 60, frameLength = 2048, hopLength = 512) {
  return requireModule8().splitSilence(samples, topDb, frameLength, hopLength);
}
function frameSignal(samples, frameLength, hopLength) {
  return requireModule8().frameSignal(samples, frameLength, hopLength);
}
function padCenter(values, targetSize, padValue = 0) {
  return requireModule8().padCenter(values, targetSize, padValue);
}
function fixLength(values, targetSize, padValue = 0) {
  return requireModule8().fixLength(values, targetSize, padValue);
}
function fixFrames(frames, xMin = 0, xMax = -1, pad = true) {
  return requireModule8().fixFrames(frames, xMin, xMax, pad);
}
function peakPick(values, preMax, postMax, preAvg, postAvg, delta, wait) {
  return requireModule8().peakPick(values, preMax, postMax, preAvg, postAvg, delta, wait);
}
function vectorNormalize(values, normType = 0, threshold = 0) {
  return requireModule8().vectorNormalize(values, normType, threshold);
}
function pcen(values, nBins, nFrames, options = {}) {
  return requireModule8().pcen(values, nBins, nFrames, options);
}
function tonnetz(chromagram, nChroma, nFrames) {
  return requireModule8().tonnetz(chromagram, nChroma, nFrames);
}
function tempogram(onsetEnvelope2, sampleRate = 22050, hopLength = 512, winLength = 384, mode = "autocorrelation") {
  return requireModule8().tempogram(onsetEnvelope2, sampleRate, hopLength, winLength, mode);
}
function cyclicTempogram(onsetEnvelope2, sampleRate = 22050, hopLength = 512, winLength = 384, bpmMin = 60, nBins = 60) {
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
  validateMusicSamples("nnlsChroma", samples, sampleRate, options);
  return requireModule9().nnlsChroma(samples, sampleRate);
}
function cqt(samples, sampleRate = 22050, hopLength = 512, fmin = 32.70319566257483, nBins = 84, binsPerOctave = 12, options = {}) {
  validateMusicSamples("cqt", samples, sampleRate, options);
  validatePositiveIntegers("cqt", { hopLength, nBins, binsPerOctave });
  validateFrequencyBounds("cqt", fmin);
  return requireModule9().cqt(samples, sampleRate, hopLength, fmin, nBins, binsPerOctave);
}
function pseudoCqt(samples, sampleRate = 22050, hopLength = 512, fmin = 32.70319566257483, nBins = 84, binsPerOctave = 12, options = {}) {
  validateMusicSamples("pseudoCqt", samples, sampleRate, options);
  validatePositiveIntegers("pseudoCqt", { hopLength, nBins, binsPerOctave });
  validateFrequencyBounds("pseudoCqt", fmin);
  return requireModule9().pseudoCqt(samples, sampleRate, hopLength, fmin, nBins, binsPerOctave);
}
function hybridCqt(samples, sampleRate = 22050, hopLength = 512, fmin = 32.70319566257483, nBins = 84, binsPerOctave = 12, options = {}) {
  validateMusicSamples("hybridCqt", samples, sampleRate, options);
  validatePositiveIntegers("hybridCqt", { hopLength, nBins, binsPerOctave });
  validateFrequencyBounds("hybridCqt", fmin);
  return requireModule9().hybridCqt(samples, sampleRate, hopLength, fmin, nBins, binsPerOctave);
}
function vqt(samples, sampleRate = 22050, hopLength = 512, fmin = 32.70319566257483, nBins = 84, binsPerOctave = 12, gamma = 0, options = {}) {
  validateMusicSamples("vqt", samples, sampleRate, options);
  validatePositiveIntegers("vqt", { hopLength, nBins, binsPerOctave });
  validateFrequencyBounds("vqt", fmin);
  assertFiniteScalar("vqt", gamma, "gamma");
  if (gamma < 0) {
    throw new RangeError("vqt: gamma must be non-negative");
  }
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
function cqtToAudio(magnitude, nBins, nFrames, sampleRate = 22050, hopLength = 512, fmin = 32.70319566257483, binsPerOctave = 12, nIter = 32, options = {}) {
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
function vqtToAudio(magnitude, nBins, nFrames, sampleRate = 22050, hopLength = 512, fmin = 32.70319566257483, binsPerOctave = 12, gamma = 0, nIter = 32, options = {}) {
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
  if (gamma < 0) {
    throw new RangeError("vqtToAudio: gamma must be non-negative");
  }
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
  validateMusicSamples("analyzeSections", samples, sampleRate, options);
  validatePositiveIntegers("analyzeSections", {
    nFft: options.nFft ?? 2048,
    hopLength: options.hopLength ?? 512
  });
  assertFiniteScalar("analyzeSections", options.minSectionSec ?? 4, "minSectionSec");
  if ((options.minSectionSec ?? 4) <= 0) {
    throw new RangeError("analyzeSections: minSectionSec must be positive");
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
  validateMusicSamples("analyzeMelody", samples, sampleRate, options);
  const fmin = options.fmin ?? 65;
  const fmax = options.fmax ?? 2093;
  validateFrequencyBounds("analyzeMelody", fmin, fmax);
  if (fmin <= 0) {
    throw new RangeError("analyzeMelody: fmin must be positive");
  }
  validatePositiveIntegers("analyzeMelody", {
    frameLength: options.frameLength ?? 2048,
    hopLength: options.hopLength ?? 256
  });
  const threshold = options.threshold ?? 0.1;
  assertFiniteScalar("analyzeMelody", threshold, "threshold");
  if (threshold <= 0) {
    throw new RangeError("analyzeMelody: threshold must be positive");
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
  validateMusicSamples("onsetEnvelope", samples, sampleRate, options);
  validatePositiveIntegers("onsetEnvelope", { nFft, hopLength, nMels });
  return requireModule9().onsetEnvelope(samples, sampleRate, nFft, hopLength, nMels);
}
function onsetStrengthMulti(samples, sampleRate = 22050, nFft = 2048, hopLength = 512, nMels = 128, nBands = 3, options = {}) {
  validateMusicSamples("onsetStrengthMulti", samples, sampleRate, options);
  validatePositiveIntegers("onsetStrengthMulti", { nFft, hopLength, nMels, nBands });
  return requireModule9().onsetStrengthMulti(samples, sampleRate, nFft, hopLength, nMels, nBands);
}
function fourierTempogram(onsetEnvelope2, sampleRate = 22050, hopLength = 512, winLength = 384, options = {}) {
  assertSampleRate("fourierTempogram", sampleRate);
  assertSamples("fourierTempogram", onsetEnvelope2, options.validate !== false, "onsetEnvelope");
  validatePositiveIntegers("fourierTempogram", { hopLength, winLength });
  return requireModule9().fourierTempogram(onsetEnvelope2, sampleRate, hopLength, winLength);
}
function tempogramRatio(tempogramData, winLength = 384, sampleRate = 22050, hopLength = 512, factors, options = {}) {
  assertSampleRate("tempogramRatio", sampleRate);
  assertSamples("tempogramRatio", tempogramData, options.validate !== false, "tempogramData");
  validatePositiveIntegers("tempogramRatio", { winLength, hopLength });
  return requireModule9().tempogramRatio(tempogramData, winLength, sampleRate, hopLength, factors);
}
function lufs(samples, sampleRate = 22050, options = {}) {
  assertSampleRate("lufs", sampleRate);
  assertSamples("lufs", samples, options.validate !== false);
  return requireModule9().lufs(samples, sampleRate);
}
function momentaryLufs(samples, sampleRate = 22050, options = {}) {
  assertSampleRate("momentaryLufs", sampleRate);
  assertSamples("momentaryLufs", samples, options.validate !== false);
  return requireModule9().momentaryLufs(samples, sampleRate);
}
function shortTermLufs(samples, sampleRate = 22050, options = {}) {
  assertSampleRate("shortTermLufs", sampleRate);
  assertSamples("shortTermLufs", samples, options.validate !== false);
  return requireModule9().shortTermLufs(samples, sampleRate);
}

// src/feature_pitch.ts
function requireModule10() {
  return getSonareModule();
}
function pitchYin(samples, sampleRate = 22050, frameLength = 2048, hopLength = 512, fmin = 65, fmax = 2093, threshold = 0.3, fillNa = false) {
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
function pitchPyin(samples, sampleRate = 22050, frameLength = 2048, hopLength = 512, fmin = 65, fmax = 2093, threshold = 0.3, fillNa = false) {
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

// src/feature_resample.ts
function requireModule11() {
  return getSonareModule();
}
function resample(samples, srcSr, targetSr) {
  return requireModule11().resample(samples, srcSr, targetSr);
}

// src/feature_spectral.ts
function requireModule12() {
  return getSonareModule();
}
function spectralCentroid(samples, sampleRate = 22050, nFft = 2048, hopLength = 512) {
  return requireModule12().spectralCentroid(samples, sampleRate, nFft, hopLength);
}
function spectralContrast(samples, sampleRate = 22050, nFft = 2048, hopLength = 512, nBands = 6, fmin = 200, quantile = 0.02) {
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
  return requireModule12().polyFeatures(samples, sampleRate, nFft, hopLength, order);
}
function zeroCrossings(samples, threshold = 1e-10, refMagnitude = false, pad = true, zeroPos = true) {
  return requireModule12().zeroCrossings(samples, threshold, refMagnitude, pad, zeroPos);
}
function pitchTuning(frequencies, resolution = 0.01, binsPerOctave = 12) {
  return requireModule12().pitchTuning(frequencies, resolution, binsPerOctave);
}
function estimateTuning(samples, sampleRate = 22050, nFft = 2048, hopLength = 512, resolution = 0.01, binsPerOctave = 12) {
  return requireModule12().estimateTuning(
    samples,
    sampleRate,
    nFft,
    hopLength,
    resolution,
    binsPerOctave
  );
}
function decompose(s, nFeatures, nFrames, nComponents, nIter = 50, beta = 2) {
  return requireModule12().decompose(s, nFeatures, nFrames, nComponents, nIter, beta);
}
function decomposeWithInit(s, nFeatures, nFrames, nComponents, nIter = 50, beta = 2, init2 = "random") {
  return requireModule12().decomposeWithInit(s, nFeatures, nFrames, nComponents, nIter, beta, init2);
}
function nnFilter(s, nFeatures, nFrames, aggregate = "mean", k = 7, width = 1) {
  return requireModule12().nnFilter(s, nFeatures, nFrames, aggregate, k, width);
}
function remix(samples, intervals, sampleRate = 22050, alignZeros = false) {
  const intervalsI32 = intervals instanceof Int32Array ? intervals : Int32Array.from(intervals, (v) => Math.trunc(v));
  return requireModule12().remix(samples, intervalsI32, sampleRate, alignZeros);
}
function phaseVocoder(samples, rate, sampleRate = 22050, nFft = 2048, hopLength = 512) {
  return requireModule12().phaseVocoder(samples, sampleRate, rate, nFft, hopLength);
}
function hpssWithResidual(samples, sampleRate = 22050, kernelHarmonic = 31, kernelPercussive = 31) {
  return requireModule12().hpssWithResidual(samples, sampleRate, kernelHarmonic, kernelPercussive);
}
function lufsInterleaved(samples, channels, sampleRate = 22050, options = {}) {
  assertSampleRate("lufsInterleaved", sampleRate);
  assertInterleavedSamples("lufsInterleaved", samples, channels, options.validate !== false);
  return requireModule12().lufsInterleaved(samples, channels, sampleRate);
}
function ebur128LoudnessRange(samples, sampleRate = 22050) {
  return requireModule12().ebur128LoudnessRange(samples, sampleRate);
}
function spectralBandwidth(samples, sampleRate = 22050, nFft = 2048, hopLength = 512) {
  return requireModule12().spectralBandwidth(samples, sampleRate, nFft, hopLength);
}
function spectralRolloff(samples, sampleRate = 22050, nFft = 2048, hopLength = 512, rollPercent = 0.85) {
  return requireModule12().spectralRolloff(samples, sampleRate, nFft, hopLength, rollPercent);
}
function spectralFlatness(samples, sampleRate = 22050, nFft = 2048, hopLength = 512) {
  return requireModule12().spectralFlatness(samples, sampleRate, nFft, hopLength);
}
function zeroCrossingRate(samples, sampleRate = 22050, frameLength = 2048, hopLength = 512) {
  return requireModule12().zeroCrossingRate(samples, sampleRate, frameLength, hopLength);
}
function rmsEnergy(samples, sampleRate = 22050, frameLength = 2048, hopLength = 512) {
  return requireModule12().rmsEnergy(samples, sampleRate, frameLength, hopLength);
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
function trim(samples, sampleRate, thresholdDb = -60, options = {}) {
  validateSpectrogramSamples("trim", samples, sampleRate, options);
  assertFiniteScalar("trim", thresholdDb, "thresholdDb");
  return requireModule13().trim(samples, sampleRate, thresholdDb);
}
function stft(samples, sampleRate = 22050, nFft = 2048, hopLength = 512, options = {}) {
  validateSpectrogramSamples("stft", samples, sampleRate, options);
  validatePositiveIntegers2("stft", { nFft, hopLength });
  return requireModule13().stft(samples, sampleRate, nFft, hopLength);
}
function stftDb(samples, sampleRate = 22050, nFft = 2048, hopLength = 512, options = {}) {
  validateSpectrogramSamples("stftDb", samples, sampleRate, options);
  validatePositiveIntegers2("stftDb", { nFft, hopLength });
  return requireModule13().stftDb(samples, sampleRate, nFft, hopLength);
}
function chromaCens(samples, sampleRate = 22050, hopLength = 512, nChroma = 12, options = {}) {
  validateSpectrogramSamples("chromaCens", samples, sampleRate, options);
  validatePositiveIntegers2("chromaCens", { hopLength, nChroma });
  return requireModule13().chromaCens(samples, sampleRate, hopLength, nChroma);
}
function chromaCqt(samples, sampleRate = 22050, hopLength = 512, nChroma = 12, options = {}) {
  validateSpectrogramSamples("chromaCqt", samples, sampleRate, options);
  validatePositiveIntegers2("chromaCqt", { hopLength, nChroma });
  return requireModule13().chromaCqt(samples, sampleRate, hopLength, nChroma);
}
function bassChroma(samples, sampleRate = 22050, hopLength = 512, nChroma = 12, options = {}) {
  validateSpectrogramSamples("bassChroma", samples, sampleRate, options);
  validatePositiveIntegers2("bassChroma", { hopLength, nChroma });
  return requireModule13().bassChroma(samples, sampleRate, hopLength, nChroma);
}
function melSpectrogram(samples, sampleRate = 22050, nFft = 2048, hopLength = 512, nMels = 128, fmin = 0, fmax = 0, htk = false, options = {}) {
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
function melToStft(melPower, nMels, nFrames, sampleRate = 22050, nFft = 2048, fmin = 0, fmax = 0, htk = false, options = {}) {
  assertSampleRate("melToStft", sampleRate);
  validateMatrix("melToStft", melPower, nMels, nFrames, "melPower", "nMels", options);
  validatePositiveIntegers2("melToStft", { nFft });
  validateMelFrequencyRange("melToStft", fmin, fmax, sampleRate);
  return requireModule13().melToStft(melPower, nMels, nFrames, sampleRate, nFft, fmin, fmax, htk);
}
function melToAudio(melPower, nMels, nFrames, sampleRate = 22050, nFft = 2048, hopLength = 512, fmin = 0, fmax = 0, nIter = 32, htk = false, options = {}) {
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
function mfccToMel(mfccCoefficients, nMfcc, nFrames, nMels = 128, options = {}) {
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
  return requireModule13().mfccToMel(mfccCoefficients, nMfcc, nFrames, nMels);
}
function mfccToAudio(mfccCoefficients, nMfcc, nFrames, nMels = 128, sampleRate = 22050, nFft = 2048, hopLength = 512, fmin = 0, fmax = 0, nIter = 32, htk = false, options = {}) {
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
    htk
  );
}
function chroma(samples, sampleRate = 22050, nFft = 2048, hopLength = 512, options = {}) {
  validateSpectrogramSamples("chroma", samples, sampleRate, options);
  validatePositiveIntegers2("chroma", { nFft, hopLength });
  return requireModule13().chroma(samples, sampleRate, nFft, hopLength);
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
  validateAnalysisInput("detectBpm", samples, sampleRate, options);
  return requireModule14().detectBpm(samples, sampleRate);
}
function detectKey(samples, sampleRate = 22050, options = {}) {
  validateAnalysisInput("detectKey", samples, sampleRate, options);
  const result = requireModule14()._detectKeyWithOptions(
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
function detectKeyCandidates(samples, sampleRate = 22050, options = {}) {
  validateAnalysisInput("detectKeyCandidates", samples, sampleRate, options);
  const candidates = requireModule14()._detectKeyCandidates(
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
  return Array.from(candidates, convertKeyCandidate);
}
function detectOnsets(samples, sampleRate = 22050, options = {}) {
  validateAnalysisInput("detectOnsets", samples, sampleRate, options);
  return requireModule14().detectOnsets(samples, sampleRate);
}
function detectBeats(samples, sampleRate = 22050, options = {}) {
  validateAnalysisInput("detectBeats", samples, sampleRate, options);
  return requireModule14().detectBeats(samples, sampleRate);
}
function detectDownbeats(samples, sampleRate = 22050, options = {}) {
  validateAnalysisInput("detectDownbeats", samples, sampleRate, options);
  return requireModule14().detectDownbeats(samples, sampleRate);
}
function detectChords(samples, sampleRate = 22050, options = {}) {
  validateAnalysisInput("detectChords", samples, sampleRate, options);
  const result = requireModule14().detectChords(
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
function chordFunctionalAnalysis(samples, keyRoot, keyMode, sampleRate = 22050, options = {}) {
  validateAnalysisInput("chordFunctionalAnalysis", samples, sampleRate, options);
  return requireModule14().chordFunctionalAnalysis(
    samples,
    keyRoot,
    keyMode,
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
    options.detectInversions ?? false,
    chordChromaMethodValue(options.chromaMethod ?? "stft")
  );
}
function analyze(samples, sampleRate = 22050, options = {}) {
  validateAnalysisInput("analyze", samples, sampleRate, options);
  const result = requireModule14().analyze(samples, sampleRate);
  return convertAnalysisResult(result);
}
function analyzeImpulseResponse(samples, sampleRate = 48e3, nOctaveBands = 6) {
  validateAnalysisInput("analyzeImpulseResponse", samples, sampleRate);
  const result = requireModule14().analyzeImpulseResponse(
    samples,
    sampleRate,
    nOctaveBands
  );
  return result;
}
function detectAcoustic(samples, sampleRate = 48e3, options = {}) {
  validateAnalysisInput("detectAcoustic", samples, sampleRate);
  const result = requireModule14().detectAcoustic(
    samples,
    sampleRate,
    options.nOctaveBands ?? 6,
    options.nThirdOctaveSubbands ?? 24,
    options.minDecayDb ?? 30,
    options.noiseFloorMarginDb ?? 10
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
  validateAnalysisInput("estimateRoom", samples, sampleRate);
  return module2.estimateRoom(samples, sampleRate, options);
}
function roomMorph(samples, sampleRate, options = {}) {
  const module2 = requireModule14();
  if (typeof module2.roomMorph !== "function") {
    throw new Error("libsonare was built without acoustic-simulation support");
  }
  validateAnalysisInput("roomMorph", samples, sampleRate);
  return module2.roomMorph(samples, sampleRate, options);
}
function analyzeWithProgress(samples, sampleRate = 22050, onProgress) {
  validateAnalysisInput("analyzeWithProgress", samples, sampleRate);
  const result = requireModule14().analyzeWithProgress(samples, sampleRate, onProgress);
  return convertAnalysisResult(result);
}
function analyzeBpm(samples, sampleRate = 22050, options = {}) {
  validateAnalysisInput("analyzeBpm", samples, sampleRate, options);
  assertNonNegativeInteger("analyzeBpm", options.maxCandidates ?? 5, "maxCandidates");
  return requireModule14().analyzeBpm(
    samples,
    sampleRate,
    options.bpmMin ?? 30,
    options.bpmMax ?? 300,
    options.startBpm ?? 120,
    options.nFft ?? 2048,
    options.hopLength ?? 512,
    options.maxCandidates ?? 5
  );
}
function analyzeRhythm(samples, sampleRate = 22050, options = {}) {
  validateAnalysisInput("analyzeRhythm", samples, sampleRate, options);
  return requireModule14().analyzeRhythm(
    samples,
    sampleRate,
    options.bpmMin ?? 60,
    options.bpmMax ?? 200,
    options.startBpm ?? 120,
    options.nFft ?? 2048,
    options.hopLength ?? 512
  );
}
function analyzeDynamics(samples, sampleRate = 22050, options = {}) {
  validateAnalysisInput("analyzeDynamics", samples, sampleRate, options);
  return requireModule14().analyzeDynamics(
    samples,
    sampleRate,
    options.windowSec ?? 0.4,
    options.hopLength ?? 512,
    options.compressionThreshold ?? 6
  );
}
function analyzeTimbre(samples, sampleRate = 22050, options = {}) {
  validateAnalysisInput("analyzeTimbre", samples, sampleRate, options);
  return requireModule14().analyzeTimbre(
    samples,
    sampleRate,
    options.nFft ?? 2048,
    options.hopLength ?? 512,
    options.nMels ?? 128,
    options.nMfcc ?? 13,
    options.windowSec ?? 0.5
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
    return new _Audio(samples, sampleRate);
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
  voiceChange(options = {}) {
    return voiceChange(this._samples, this._sampleRate, options);
  }
  normalize(targetDb = 0) {
    return normalize(this._samples, this._sampleRate, targetDb);
  }
  mastering(options = {}) {
    return mastering(this._samples, this._sampleRate, options);
  }
  masteringChain(config) {
    return masteringChain(this._samples, this._sampleRate, config);
  }
  masterAudio(presetName = "pop", overrides = null) {
    return masterAudio(this._samples, this._sampleRate, presetName, overrides ?? {});
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
  pitchYin(frameLength = 2048, hopLength = 512, fmin = 65, fmax = 2093, threshold = 0.3, fillNa = false) {
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
  pitchPyin(frameLength = 2048, hopLength = 512, fmin = 65, fmax = 2093, threshold = 0.3, fillNa = false) {
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
  return new Worker(URL.createObjectURL(blob));
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
      const page = Math.floor(request.sample / state.source.pageFrames);
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
        state.source.binding.provider.clear(page);
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
              state.source.binding.provider.clear(pageIndex);
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
      state.source.binding.provider.clear(page);
    }
    state.resident.clear();
  }
};
async function attachOpfsClipStream(streamer, engine, options) {
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
function requireModule15() {
  return getSonareModule();
}
function meteringPeakDb(samples, sampleRate = 22050, options = {}) {
  assertSamples("meteringPeakDb", samples, options.validate !== false);
  return requireModule15().meteringPeakDb(samples, sampleRate);
}
function meteringRmsDb(samples, sampleRate = 22050, options = {}) {
  assertSamples("meteringRmsDb", samples, options.validate !== false);
  return requireModule15().meteringRmsDb(samples, sampleRate);
}
function meteringCrestFactorDb(samples, sampleRate = 22050, options = {}) {
  assertSamples("meteringCrestFactorDb", samples, options.validate !== false);
  return requireModule15().meteringCrestFactorDb(samples, sampleRate);
}
function meteringDcOffset(samples, sampleRate = 22050, options = {}) {
  assertSamples("meteringDcOffset", samples, options.validate !== false);
  return requireModule15().meteringDcOffset(samples, sampleRate);
}
function meteringTruePeakDb(samples, sampleRate = 22050, oversampleFactor = 4, options = {}) {
  assertSamples("meteringTruePeakDb", samples, options.validate !== false);
  const factor = oversampleFactor === 0 ? 4 : oversampleFactor;
  if (factor < 1 || factor > 16 || (factor & factor - 1) !== 0) {
    throw new RangeError(
      "meteringTruePeakDb: oversampleFactor must be 0 or a power of two from 1 to 16"
    );
  }
  return requireModule15().meteringTruePeakDb(samples, sampleRate, oversampleFactor);
}
function meteringDetectClipping(samples, sampleRate = 22050, options = {}) {
  assertSamples("meteringDetectClipping", samples, options.validate !== false);
  return requireModule15().meteringDetectClipping(
    samples,
    sampleRate,
    options.threshold ?? 0.999,
    options.minRegionSamples ?? 1
  );
}
function meteringDynamicRange(samples, sampleRate = 22050, options = {}) {
  assertSamples("meteringDynamicRange", samples, options.validate !== false);
  return requireModule15().meteringDynamicRange(
    samples,
    sampleRate,
    options.windowSec ?? 0,
    options.hopSec ?? 0,
    options.lowPercentile ?? -1,
    options.highPercentile ?? -1
  );
}
function meteringStereoCorrelation(left, right, sampleRate = 22050, options = {}) {
  const validate = options.validate !== false;
  assertSamples("meteringStereoCorrelation", left, validate, "left");
  assertSamples("meteringStereoCorrelation", right, validate, "right");
  return requireModule15().meteringStereoCorrelation(left, right, sampleRate);
}
function meteringStereoWidth(left, right, sampleRate = 22050, options = {}) {
  const validate = options.validate !== false;
  assertSamples("meteringStereoWidth", left, validate, "left");
  assertSamples("meteringStereoWidth", right, validate, "right");
  return requireModule15().meteringStereoWidth(left, right, sampleRate);
}
function meteringVectorscope(left, right, sampleRate = 22050, options = {}) {
  const validate = options.validate !== false;
  assertSamples("meteringVectorscope", left, validate, "left");
  assertSamples("meteringVectorscope", right, validate, "right");
  return requireModule15().meteringVectorscope(left, right, sampleRate);
}
function meteringVectorscopeDecimated(left, right, sampleRate = 22050, maxPoints = 0, options = {}) {
  const validate = options.validate !== false;
  assertSamples("meteringVectorscopeDecimated", left, validate, "left");
  assertSamples("meteringVectorscopeDecimated", right, validate, "right");
  return requireModule15().meteringVectorscopeDecimated(left, right, sampleRate, maxPoints);
}
function meteringPhaseScope(left, right, sampleRate = 22050, options = {}) {
  const validate = options.validate !== false;
  assertSamples("meteringPhaseScope", left, validate, "left");
  assertSamples("meteringPhaseScope", right, validate, "right");
  return requireModule15().meteringPhaseScope(left, right, sampleRate);
}
function meteringPhaseScopeDecimated(left, right, sampleRate = 22050, maxPoints = 0, options = {}) {
  const validate = options.validate !== false;
  assertSamples("meteringPhaseScopeDecimated", left, validate, "left");
  assertSamples("meteringPhaseScopeDecimated", right, validate, "right");
  return requireModule15().meteringPhaseScopeDecimated(left, right, sampleRate, maxPoints);
}
function meteringSpectrum(samples, sampleRate = 22050, options) {
  const validate = options?.validate !== false;
  assertSamples("meteringSpectrum", samples, validate);
  return requireModule15().meteringSpectrum(samples, sampleRate, options ?? {});
}
function meteringSpectrumFrame(samples, sampleRate = 22050, frameOffset = 0, options) {
  const validate = options?.validate !== false;
  assertSamples("meteringSpectrumFrame", samples, validate);
  return requireModule15().meteringSpectrumFrame(samples, sampleRate, frameOffset, options ?? {});
}
function waveformPeaks(samples, channels, options = {}) {
  assertSamples("waveformPeaks", samples, options.validate !== false);
  if (channels <= 0 || samples.length % channels !== 0) {
    throw new RangeError("waveformPeaks: samples length must be a multiple of channels");
  }
  const samplesPerBucket = options.samplesPerBucket ?? 512;
  if (samplesPerBucket <= 0) {
    throw new RangeError("waveformPeaks: samplesPerBucket must be > 0");
  }
  return requireModule15().waveformPeaks(samples, channels, samplesPerBucket);
}
function waveformPeakPyramid(samples, channels, options = {}) {
  assertSamples("waveformPeakPyramid", samples, options.validate !== false);
  if (channels <= 0 || samples.length % channels !== 0) {
    throw new RangeError("waveformPeakPyramid: samples length must be a multiple of channels");
  }
  const levels = options.samplesPerBucketLevels ?? [512, 1024, 2048, 4096];
  if (levels.length === 0 || levels.some((level) => level <= 0)) {
    throw new RangeError("waveformPeakPyramid: samplesPerBucketLevels must be non-empty and > 0");
  }
  return requireModule15().waveformPeakPyramid(samples, channels, levels);
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
  if (kind === void 0 || kind === "audio") {
    return 0;
  }
  if (kind === "midi") {
    return 1;
  }
  if (kind === "aux") {
    return 2;
  }
  return kind;
}
function projectWarpModeValue(mode) {
  if (mode === void 0 || mode === "off") {
    return 0;
  }
  if (mode === "repitch") {
    return 1;
  }
  if (mode === "tempo-sync") {
    return 2;
  }
  return mode;
}
function projectLoopModeValue(mode) {
  if (mode === void 0 || mode === "off") {
    return 0;
  }
  if (mode === "loop") {
    return 1;
  }
  return mode;
}

// src/project_class.ts
var Project = class _Project {
  constructor() {
    this.native = new (projectModule()).Project();
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
   * Routes through an undoable edit command.
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
  /** Replace a MIDI clip's entire event list. */
  setMidiEvents(clipId, events) {
    assertProjectMidiEvents("Project.setMidiEvents", events);
    this.native.setMidiEvents(clipId, events);
  }
  /** Import an in-memory SMF buffer; returns the first added clip id. */
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
  /** Destructively bake a MIDI-FX chain into a clip's stored MIDI events. */
  bakeMidiFx(clipId, configJson) {
    this.native.bakeMidiFx(clipId, configJson);
  }
  /** Backward alias for {@link bakeMidiFx}. */
  setMidiFx(clipId, configJson) {
    this.bakeMidiFx(clipId, configJson);
  }
  /**
   * Pre-flight check for hanging / unmatched notes in a MIDI clip: reports
   * whether every note-on has a matching note-off (FIFO per channel+note).
   * Useful before bouncing to catch a stuck note. Throws if `clipId` is unknown
   * or not a MIDI clip.
   */
  validateMidiNotes(clipId) {
    return this.native.validateMidiNotes(clipId);
  }
  /** Detect tempo from a mono buffer and install it; returns the primary BPM. */
  autoTempo(audio, sampleRate) {
    return this.native.autoTempo(audio, sampleRate);
  }
  /** Snap a PPQ coordinate to the nearest beat of the project grid. */
  snapToGrid(ppq, strength = 1) {
    return this.native.snapToGrid(ppq, strength);
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
   * an array of either; each object entry may carry a `destinationId` binding
   * convenience (default 0), which is not part of the NativeSynth patch itself.
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
  /** Append an automation lane to a track; returns the lane index (undoable). */
  addAutomationLane(trackId, desc) {
    return this.native.addAutomationLane(trackId, {
      targetParamId: desc.targetParamId,
      points: desc.points
    });
  }
  /** Replace an existing automation lane in place (undoable). */
  editAutomationLane(trackId, laneIndex, desc) {
    this.native.editAutomationLane(trackId, laneIndex, {
      targetParamId: desc.targetParamId,
      points: desc.points
    });
  }
  /** Remove an automation lane from a track (undoable). */
  removeAutomationLane(trackId, laneIndex) {
    this.native.removeAutomationLane(trackId, laneIndex);
  }
  /** Replace the project's key annotation stream (undoable). */
  annotateKeys(keys) {
    this.native.annotateKeys(keys);
  }
  /** Replace the project's chord-symbol annotation stream (undoable). */
  annotateChords(chords) {
    this.native.annotateChords(chords);
  }
  /** Add or update an opaque assist sidecar by module id + target scope (undoable). */
  setAssistSidecar(moduleId, schemaVersion, targetTrackId, regionStartPpq, regionEndPpq, payload) {
    this.native.setAssistSidecar(
      moduleId,
      schemaVersion,
      targetTrackId,
      regionStartPpq,
      regionEndPpq,
      payload
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
  constructor(sampleRate = 48e3, maxBlockSize = 128, commandCapacity = 1024, telemetryCapacity = 1024) {
    const module2 = getSonareModule();
    const capabilities = engineCapabilities();
    if (!capabilities.abiCompatible) {
      throw new Error(
        `Engine ABI mismatch: wasm=${capabilities.engineAbiVersion}, expected=${capabilities.expectedEngineAbiVersion}`
      );
    }
    this.native = new module2.RealtimeEngine(
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
  seekPpq(ppq, renderFrame = -1) {
    this.native.seekPpq(ppq, renderFrame);
  }
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
      config.window ?? defaults.window,
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
   * Flush the final partial frame with zero-padding.
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
    notify();
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
      const velocity = word1 >>> 25 & 127;
      if (velocity === 0) {
        engine.pushMidiInputNoteOff(group, channel, data1, 0, portTimeSamples);
      } else {
        engine.pushMidiInputNoteOn(group, channel, data1, velocity, portTimeSamples);
      }
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
  ChordQuality,
  ClipPageStreamer,
  EXPECTED_ENGINE_ABI_VERSION,
  EXPECTED_PROJECT_ABI_VERSION,
  ErrorCode,
  KeyProfile,
  MarkerKind,
  Mixer,
  Mode,
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
  chordFunctionalAnalysis,
  chroma,
  chromaCens,
  chromaCqt,
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
  masteringAudioProfile,
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
  melSpectrogram,
  melToAudio,
  melToHz,
  melToStft,
  meteringCrestFactorDb,
  meteringDcOffset,
  meteringDetectClipping,
  meteringDynamicRange,
  meteringPeakDb,
  meteringPhaseScope,
  meteringPhaseScopeDecimated,
  meteringRmsDb,
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
  noteStretch,
  noteToHz,
  onsetEnvelope,
  onsetStrengthMulti,
  opfsClipPageWorkerSource,
  padCenter,
  pcen,
  peakPick,
  percussive,
  phaseVocoder,
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
  remix,
  resample,
  rmsEnergy,
  roomMorph,
  samplesToFrames,
  scaleCorrectionSemitones,
  scalePitchClassEnabled,
  scaleQuantizeMidi,
  shortTermLufs,
  spectralBandwidth,
  spectralCentroid,
  spectralContrast,
  spectralEdit,
  spectralFlatness,
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
