// src/codes.ts
function automationCurveCode(curve) {
  switch (curve) {
    case 'linear':
      return 0;
    case 'exponential':
      return 1;
    case 'hold':
      return 2;
    case 's-curve':
      return 3;
    default:
      throw new Error(`Invalid automation curve: ${curve}`);
  }
}
function panLawCode(panLaw) {
  if (typeof panLaw === 'number') {
    return panLaw;
  }
  switch (panLaw) {
    case 'const4.5dB':
      return 1;
    case 'const6dB':
      return 2;
    case 'linear0dB':
      return 3;
    default:
      return 0;
  }
}
function panModeCode(panMode) {
  if (typeof panMode === 'number') {
    return panMode;
  }
  switch (panMode) {
    case 'stereoPan':
    case 'stereo-pan':
      return 1;
    case 'dualPan':
    case 'dual-pan':
      return 2;
    default:
      return 0;
  }
}
function meterTapCode(tap) {
  return tap === 'preFader' || tap === 0 ? 0 : 1;
}
function sendTimingCode(timing) {
  if (typeof timing === 'number') {
    return timing;
  }
  return timing === 'preFader' ? 1 : 0;
}

// src/errors.ts
var SonareError = class extends Error {
  constructor(code, codeName, message) {
    super(message);
    this.name = 'SonareError';
    this.code = code;
    this.codeName = codeName;
  }
};

// src/module_state.ts
var wrappedModule = null;
function nativeExceptionPtr(error) {
  if (typeof error === 'number') {
    return error;
  }
  if (error !== null && typeof error === 'object') {
    const ptr = error.excPtr;
    if (typeof ptr === 'number') {
      return ptr;
    }
  }
  return null;
}
function makeSonareError(raw, thrown) {
  let code = 99 /* Unknown */;
  let codeName = 'Unknown';
  let message = `libsonare native exception (${thrown})`;
  try {
    const info = raw.sonareExceptionInfo?.(thrown);
    if (info) {
      code = info.code ?? code;
      codeName = info.codeName ?? codeName;
      message = info.message || message;
    }
  } catch {}
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
    if (value === null || typeof value !== 'object') {
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
        if (typeof member !== 'function') {
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
      },
    });
    objectCache.set(objectValue, wrapped);
    return wrapped;
  };
  const wrapFunction = (value) => {
    const fnCache = /* @__PURE__ */ new Map();
    return new Proxy(value, {
      get(target, prop, receiver) {
        const member = Reflect.get(target, prop, receiver);
        if (typeof member !== 'function') {
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
      },
    });
  };
  return new Proxy(raw, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== 'function') {
        return value;
      }
      const cached = cache.get(prop);
      if (cached) {
        return cached;
      }
      const wrapped = wrapFunction(value);
      cache.set(prop, wrapped);
      return wrapped;
    },
  });
}
function setSonareModule(module2) {
  wrappedModule = wrapModuleErrors(module2);
}
function getSonareModule() {
  if (!wrappedModule) {
    throw new Error('Module not initialized. Call init() first.');
  }
  return wrappedModule;
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
      throw new Error('leftChannels and rightChannels must have the same length.');
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
      throw new Error('leftChannels and rightChannels must have the same length.');
    }
    if (outLeft.length !== outRight.length) {
      throw new Error('outLeft and outRight must have the same length.');
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
      },
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
  scheduleInsertAutomation(stripIndex, insertIndex, paramId, samplePos, value, curve = 'linear') {
    this.mixer.scheduleInsertAutomation(
      stripIndex,
      insertIndex,
      paramId,
      samplePos,
      value,
      automationCurveCode(curve),
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
  addBus(id, role = 'aux') {
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
  addSend(stripIndex, id, destinationBusId, sendDb = 0, timing = 'postFader') {
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
  meterTap(stripIndex, tap = 'postFader') {
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
  scheduleFaderAutomation(stripIndex, samplePos, faderDb, curve = 'linear') {
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
  schedulePanAutomation(stripIndex, samplePos, pan, curve = 'linear') {
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
  scheduleWidthAutomation(stripIndex, samplePos, width, curve = 'linear') {
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
  scheduleSendAutomation(stripIndex, sendIndex, samplePos, db, curve = 'linear') {
    this.mixer.scheduleSendAutomation(
      stripIndex,
      sendIndex,
      samplePos,
      db,
      automationCurveCode(curve),
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
   * Maximum processor tail length (samples) in the compiled mixer graph. Lazily
   * compiles the routing graph if the topology is dirty.
   */
  tailSamples() {
    return this.mixer.tailSamples();
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
  constructor(config = 'neutral-monitor') {
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
      },
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
      },
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
      },
    };
  }
  delete() {
    this.changer.delete();
  }
};

// src/realtime_engine.ts
var EXPECTED_ENGINE_ABI_VERSION = 3;
function engineCapabilities() {
  const abiVersion = getSonareModule().engineAbiVersion();
  const sharedArrayBuffer = typeof globalThis.SharedArrayBuffer === 'function';
  const atomics = typeof globalThis.Atomics === 'object';
  const audioWorklet =
    typeof AudioWorkletNode !== 'undefined' ||
    typeof globalThis.AudioWorkletProcessor !== 'undefined';
  return {
    engineAbiVersion: abiVersion,
    expectedEngineAbiVersion: EXPECTED_ENGINE_ABI_VERSION,
    abiCompatible: abiVersion === EXPECTED_ENGINE_ABI_VERSION,
    sharedArrayBuffer,
    atomics,
    audioWorklet,
    mode: sharedArrayBuffer && atomics ? 'sab' : 'postMessage',
  };
}
var RealtimeEngine = class {
  constructor(
    sampleRate = 48e3,
    maxBlockSize = 128,
    commandCapacity = 1024,
    telemetryCapacity = 1024,
  ) {
    const module2 = getSonareModule();
    const capabilities = engineCapabilities();
    if (!capabilities.abiCompatible) {
      throw new Error(
        `Engine ABI mismatch: wasm=${capabilities.engineAbiVersion}, expected=${capabilities.expectedEngineAbiVersion}`,
      );
    }
    this.native = new module2.RealtimeEngine(
      sampleRate,
      maxBlockSize,
      commandCapacity,
      telemetryCapacity,
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
  setSynthInstrument(
    patch = {},
    destinationId = (typeof patch === 'object' ? patch.destinationId : void 0) ?? 0,
  ) {
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
      options.maxValue ?? 1,
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
        pageProvider:
          typeof clip.pageProvider === 'object' && clip.pageProvider !== null
            ? clip.pageProvider.id
            : clip.pageProvider,
      })),
    );
  }
  clipCount() {
    return this.native.clipCount();
  }
  setTrackLanes(lanes) {
    this.native.setTrackLanes(
      lanes.map((lane) => {
        if (typeof lane === 'number') {
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
            sendTiming: send.sendTiming === void 0 ? 0 : sendTimingCode(send.sendTiming),
          })),
        };
      }),
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
      const message = error instanceof Error ? error.message : 'invalid bus strip JSON';
      throw new SonareError(2 /* InvalidFormat */, 'InvalidFormat', message);
    }
    this.native.setBusStripJson(busId, sceneJson);
  }
  setTrackStripJson(trackId, sceneJson) {
    try {
      JSON.parse(sceneJson);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'invalid track strip JSON';
      throw new SonareError(2 /* InvalidFormat */, 'InvalidFormat', message);
    }
    this.native.setTrackStripJson(trackId, sceneJson);
  }
  setTrackStripEqBand(trackId, bandIndex, band) {
    this.native.setTrackStripEqBandJson(
      trackId,
      bandIndex,
      typeof band === 'string' ? band : JSON.stringify(band),
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
      const message = error instanceof Error ? error.message : 'invalid master strip JSON';
      throw new SonareError(2 /* InvalidFormat */, 'InvalidFormat', message);
    }
    this.native.setMasterStripJson(sceneJson);
  }
  setMasterStripEqBand(bandIndex, band) {
    this.native.setMasterStripEqBandJson(
      bandIndex,
      typeof band === 'string' ? band : JSON.stringify(band),
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
      throw new Error('ClipPageProvider is destroyed');
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
      const createModule = options?.moduleFactory ?? (await import('./sonare.js')).default;
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

// src/worklet/protocol.ts
var ENGINE_MIXER_TARGET_BASE = 1297612800;
var ENGINE_MIXER_PARAM_FADER_DB = 1;
var ENGINE_MIXER_PARAM_PAN = 2;
function engineMixerLaneTarget(laneIndex, paramKind) {
  return ENGINE_MIXER_TARGET_BASE | ((laneIndex & 255) << 8) | (paramKind & 255);
}
function engineMixerBusTarget(busIndex, paramKind) {
  return ENGINE_MIXER_TARGET_BASE | (((254 - busIndex) & 255) << 8) | (paramKind & 255);
}
function engineMixerMasterTarget(paramKind) {
  return ENGINE_MIXER_TARGET_BASE | (255 << 8) | (paramKind & 255);
}
var SONARE_METER_RING_HEADER_INTS = 4;
var SONARE_METER_RING_RECORD_FLOATS = 14;
var SONARE_SPECTRUM_RING_HEADER_INTS = 5;
var SONARE_SCOPE_RING_HEADER_INTS = 6;
var SONARE_SCOPE_RING_RECORD_PREFIX_FLOATS = 5;
var SONARE_FRAME_LANE_BASE = 16777216;
function encodeFrameLo(frame) {
  const f = Math.max(0, Math.floor(frame));
  return f % SONARE_FRAME_LANE_BASE;
}
function encodeFrameHi(frame) {
  const f = Math.max(0, Math.floor(frame));
  return Math.floor(f / SONARE_FRAME_LANE_BASE);
}
function decodeFrame(lo, hi) {
  return hi * SONARE_FRAME_LANE_BASE + lo;
}
var SONARE_ENGINE_RING_HEADER_INTS = 5;
var SONARE_ENGINE_COMMAND_RECORD_BYTES = 32;
var SONARE_ENGINE_TELEMETRY_RECORD_BYTES = 48;
var SonareEngineCommandType = /* @__PURE__ */ ((SonareEngineCommandType2) => {
  SonareEngineCommandType2[(SonareEngineCommandType2['SetParam'] = 0)] = 'SetParam';
  SonareEngineCommandType2[(SonareEngineCommandType2['SetParamSmoothed'] = 1)] = 'SetParamSmoothed';
  SonareEngineCommandType2[(SonareEngineCommandType2['TransportPlay'] = 2)] = 'TransportPlay';
  SonareEngineCommandType2[(SonareEngineCommandType2['TransportStop'] = 3)] = 'TransportStop';
  SonareEngineCommandType2[(SonareEngineCommandType2['TransportSeekSample'] = 4)] =
    'TransportSeekSample';
  SonareEngineCommandType2[(SonareEngineCommandType2['TransportSeekPpq'] = 5)] = 'TransportSeekPpq';
  SonareEngineCommandType2[(SonareEngineCommandType2['SetTempoMap'] = 6)] = 'SetTempoMap';
  SonareEngineCommandType2[(SonareEngineCommandType2['SetLoop'] = 7)] = 'SetLoop';
  SonareEngineCommandType2[(SonareEngineCommandType2['SwapGraph'] = 8)] = 'SwapGraph';
  SonareEngineCommandType2[(SonareEngineCommandType2['SwapAutomation'] = 9)] = 'SwapAutomation';
  SonareEngineCommandType2[(SonareEngineCommandType2['SetSoloMute'] = 10)] = 'SetSoloMute';
  SonareEngineCommandType2[(SonareEngineCommandType2['AddClip'] = 11)] = 'AddClip';
  SonareEngineCommandType2[(SonareEngineCommandType2['RemoveClip'] = 12)] = 'RemoveClip';
  SonareEngineCommandType2[(SonareEngineCommandType2['ArmRecord'] = 13)] = 'ArmRecord';
  SonareEngineCommandType2[(SonareEngineCommandType2['Punch'] = 14)] = 'Punch';
  SonareEngineCommandType2[(SonareEngineCommandType2['SetMetronome'] = 15)] = 'SetMetronome';
  SonareEngineCommandType2[(SonareEngineCommandType2['SetMarker'] = 16)] = 'SetMarker';
  SonareEngineCommandType2[(SonareEngineCommandType2['SeekMarker'] = 17)] = 'SeekMarker';
  return SonareEngineCommandType2;
})(SonareEngineCommandType || {});
var SonareEngineTelemetryType = /* @__PURE__ */ ((SonareEngineTelemetryType2) => {
  SonareEngineTelemetryType2[(SonareEngineTelemetryType2['ProcessBlock'] = 0)] = 'ProcessBlock';
  SonareEngineTelemetryType2[(SonareEngineTelemetryType2['Error'] = 1)] = 'Error';
  return SonareEngineTelemetryType2;
})(SonareEngineTelemetryType || {});
var SonareEngineTelemetryError = /* @__PURE__ */ ((SonareEngineTelemetryError2) => {
  SonareEngineTelemetryError2[(SonareEngineTelemetryError2['None'] = 0)] = 'None';
  SonareEngineTelemetryError2[(SonareEngineTelemetryError2['CommandQueueOverflow'] = 1)] =
    'CommandQueueOverflow';
  SonareEngineTelemetryError2[(SonareEngineTelemetryError2['PendingCommandOverflow'] = 2)] =
    'PendingCommandOverflow';
  SonareEngineTelemetryError2[(SonareEngineTelemetryError2['BoundaryOverflow'] = 3)] =
    'BoundaryOverflow';
  SonareEngineTelemetryError2[(SonareEngineTelemetryError2['TelemetryOverflow'] = 4)] =
    'TelemetryOverflow';
  SonareEngineTelemetryError2[(SonareEngineTelemetryError2['CaptureOverflow'] = 5)] =
    'CaptureOverflow';
  SonareEngineTelemetryError2[(SonareEngineTelemetryError2['MaxBlockExceeded'] = 6)] =
    'MaxBlockExceeded';
  SonareEngineTelemetryError2[(SonareEngineTelemetryError2['UnknownTarget'] = 7)] = 'UnknownTarget';
  SonareEngineTelemetryError2[(SonareEngineTelemetryError2['NonRealtimeSafeParameter'] = 8)] =
    'NonRealtimeSafeParameter';
  SonareEngineTelemetryError2[(SonareEngineTelemetryError2['NotPrepared'] = 9)] = 'NotPrepared';
  SonareEngineTelemetryError2[(SonareEngineTelemetryError2['NonQueueableCommand'] = 10)] =
    'NonQueueableCommand';
  SonareEngineTelemetryError2[(SonareEngineTelemetryError2['AutomationBindTargetOverflow'] = 11)] =
    'AutomationBindTargetOverflow';
  SonareEngineTelemetryError2[(SonareEngineTelemetryError2['StaleAutomationLanes'] = 12)] =
    'StaleAutomationLanes';
  SonareEngineTelemetryError2[(SonareEngineTelemetryError2['SmoothedParameterCapacity'] = 13)] =
    'SmoothedParameterCapacity';
  return SonareEngineTelemetryError2;
})(SonareEngineTelemetryError || {});
function toDb(value) {
  return value > 0 ? 20 * Math.log10(value) : Number.NEGATIVE_INFINITY;
}
function isRecord(value) {
  return typeof value === 'object' && value !== null;
}
function sonareMeterRingBufferByteLength(capacity) {
  const clampedCapacity = Math.max(1, Math.floor(capacity));
  return (
    SONARE_METER_RING_HEADER_INTS * Int32Array.BYTES_PER_ELEMENT +
    clampedCapacity * SONARE_METER_RING_RECORD_FLOATS * Float32Array.BYTES_PER_ELEMENT
  );
}
function createSonareMeterRingBuffer(capacity = 128) {
  const clampedCapacity = Math.max(1, Math.floor(capacity));
  const sharedBuffer = new SharedArrayBuffer(sonareMeterRingBufferByteLength(clampedCapacity));
  const ring = meterRingFromSharedBuffer(sharedBuffer, clampedCapacity);
  Atomics.store(ring.header, 0, 0);
  Atomics.store(ring.header, 1, clampedCapacity);
  Atomics.store(ring.header, 2, SONARE_METER_RING_RECORD_FLOATS);
  Atomics.store(ring.header, 3, 0);
  return { sharedBuffer, header: ring.header, records: ring.records, capacity: ring.capacity };
}
function readSonareMeterRingBuffer(ring, readIndex = 0) {
  const writeIndex = Atomics.load(ring.header, 0);
  const recordFloats = Atomics.load(ring.header, 2) || SONARE_METER_RING_RECORD_FLOATS;
  const nextReadIndex = Math.max(0, Math.min(readIndex, writeIndex));
  const firstReadable = Math.max(nextReadIndex, writeIndex - ring.capacity);
  const meters = [];
  for (let index = firstReadable; index < writeIndex; index++) {
    const offset = (index % ring.capacity) * recordFloats;
    meters.push({
      type: 'meter',
      frame: decodeFrame(ring.records[offset], ring.records[offset + 1]),
      targetId: ring.records[offset + 2],
      peakDbL: ring.records[offset + 3],
      peakDbR: ring.records[offset + 4],
      rmsDbL: ring.records[offset + 5],
      rmsDbR: ring.records[offset + 6],
      correlation: ring.records[offset + 7],
      truePeakDbL: ring.records[offset + 8],
      truePeakDbR: ring.records[offset + 9],
      momentaryLufs: ring.records[offset + 10],
      shortTermLufs: ring.records[offset + 11],
      integratedLufs: ring.records[offset + 12],
      gainReductionDb: ring.records[offset + 13],
    });
  }
  return { nextReadIndex: writeIndex, meters };
}
function sonareSpectrumRingBufferByteLength(capacity, bands = 16) {
  const clampedCapacity = Math.max(1, Math.floor(capacity));
  const clampedBands = Math.max(1, Math.floor(bands));
  return (
    SONARE_SPECTRUM_RING_HEADER_INTS * Int32Array.BYTES_PER_ELEMENT +
    clampedCapacity * (3 + clampedBands) * Float32Array.BYTES_PER_ELEMENT
  );
}
function createSonareSpectrumRingBuffer(capacity = 128, bands = 16) {
  const clampedCapacity = Math.max(1, Math.floor(capacity));
  const clampedBands = Math.max(1, Math.floor(bands));
  const sharedBuffer = new SharedArrayBuffer(
    sonareSpectrumRingBufferByteLength(clampedCapacity, clampedBands),
  );
  const ring = spectrumRingFromSharedBuffer(sharedBuffer, clampedCapacity, clampedBands);
  Atomics.store(ring.header, 0, 0);
  Atomics.store(ring.header, 1, clampedCapacity);
  Atomics.store(ring.header, 2, ring.recordFloats);
  Atomics.store(ring.header, 3, clampedBands);
  Atomics.store(ring.header, 4, 0);
  return {
    sharedBuffer,
    header: ring.header,
    records: ring.records,
    capacity: ring.capacity,
    bands: ring.bands,
  };
}
function readSonareSpectrumRingBuffer(ring, readIndex = 0) {
  const writeIndex = Atomics.load(ring.header, 0);
  const recordFloats = Atomics.load(ring.header, 2) || 3 + ring.bands;
  const bands = Atomics.load(ring.header, 3) || ring.bands;
  const nextReadIndex = Math.max(0, Math.min(readIndex, writeIndex));
  const firstReadable = Math.max(nextReadIndex, writeIndex - ring.capacity);
  const spectra = [];
  for (let index = firstReadable; index < writeIndex; index++) {
    const offset = (index % ring.capacity) * recordFloats;
    const values = new Float32Array(bands);
    values.set(ring.records.subarray(offset + 3, offset + 3 + bands));
    spectra.push({
      type: 'spectrum',
      frame: decodeFrame(ring.records[offset], ring.records[offset + 1]),
      bands: values,
    });
  }
  return { nextReadIndex: writeIndex, spectra };
}
function sonareScopeRingRecordFloats(bands, maxPoints) {
  return SONARE_SCOPE_RING_RECORD_PREFIX_FLOATS + bands + 2 * maxPoints;
}
function sonareScopeRingBufferByteLength(capacity, bands = 48, maxPoints = 32) {
  const clampedCapacity = Math.max(1, Math.floor(capacity));
  const clampedBands = Math.max(1, Math.floor(bands));
  const clampedPoints = Math.max(0, Math.floor(maxPoints));
  return (
    SONARE_SCOPE_RING_HEADER_INTS * Int32Array.BYTES_PER_ELEMENT +
    clampedCapacity *
      sonareScopeRingRecordFloats(clampedBands, clampedPoints) *
      Float32Array.BYTES_PER_ELEMENT
  );
}
function createSonareScopeRingBuffer(capacity = 64, bands = 48, maxPoints = 32) {
  const clampedCapacity = Math.max(1, Math.floor(capacity));
  const clampedBands = Math.max(1, Math.floor(bands));
  const clampedPoints = Math.max(0, Math.floor(maxPoints));
  const sharedBuffer = new SharedArrayBuffer(
    sonareScopeRingBufferByteLength(clampedCapacity, clampedBands, clampedPoints),
  );
  const ring = scopeRingFromSharedBuffer(
    sharedBuffer,
    clampedCapacity,
    clampedBands,
    clampedPoints,
  );
  Atomics.store(ring.header, 0, 0);
  Atomics.store(ring.header, 1, clampedCapacity);
  Atomics.store(ring.header, 2, ring.recordFloats);
  Atomics.store(ring.header, 3, clampedBands);
  Atomics.store(ring.header, 4, clampedPoints);
  Atomics.store(ring.header, 5, 0);
  return {
    sharedBuffer,
    header: ring.header,
    records: ring.records,
    capacity: ring.capacity,
    bands: ring.bands,
    maxPoints: ring.maxPoints,
  };
}
function readSonareScopeRingBuffer(ring, readIndex = 0) {
  const writeIndex = Atomics.load(ring.header, 0);
  const bands = Atomics.load(ring.header, 3) || ring.bands;
  const maxPoints = Atomics.load(ring.header, 4);
  const recordFloats =
    Atomics.load(ring.header, 2) || sonareScopeRingRecordFloats(bands, maxPoints);
  const nextReadIndex = Math.max(0, Math.min(readIndex, writeIndex));
  const firstReadable = Math.max(nextReadIndex, writeIndex - ring.capacity);
  const scopes = [];
  for (let index = firstReadable; index < writeIndex; index++) {
    const offset = (index % ring.capacity) * recordFloats;
    const bandCount = Math.min(bands, Math.max(0, ring.records[offset + 3]));
    const pointCount = Math.min(maxPoints, Math.max(0, ring.records[offset + 4]));
    const bandsView = new Float32Array(bandCount);
    bandsView.set(
      ring.records.subarray(
        offset + SONARE_SCOPE_RING_RECORD_PREFIX_FLOATS,
        offset + SONARE_SCOPE_RING_RECORD_PREFIX_FLOATS + bandCount,
      ),
    );
    const pointsBase = offset + SONARE_SCOPE_RING_RECORD_PREFIX_FLOATS + bands;
    const pointsView = new Float32Array(pointCount * 2);
    pointsView.set(ring.records.subarray(pointsBase, pointsBase + pointCount * 2));
    scopes.push({
      type: 'scope',
      frame: decodeFrame(ring.records[offset], ring.records[offset + 1]),
      targetId: ring.records[offset + 2],
      bands: bandsView,
      points: pointsView,
    });
  }
  return { nextReadIndex: writeIndex, scopes };
}
function scopeRingFromSharedBuffer(
  sharedBuffer,
  fallbackCapacity,
  fallbackBands,
  fallbackMaxPoints,
) {
  const headerBytes = SONARE_SCOPE_RING_HEADER_INTS * Int32Array.BYTES_PER_ELEMENT;
  const header = new Int32Array(sharedBuffer, 0, SONARE_SCOPE_RING_HEADER_INTS);
  const existingCapacity = Atomics.load(header, 1);
  const existingBands = Atomics.load(header, 3);
  const existingMaxPoints = Atomics.load(header, 4);
  const capacity = Math.max(1, Math.floor(existingCapacity || fallbackCapacity || 1));
  const bands = Math.max(1, Math.floor(existingBands || fallbackBands || 48));
  const maxPoints = Math.max(0, Math.floor(existingMaxPoints || (fallbackMaxPoints ?? 32)));
  const recordFloats = sonareScopeRingRecordFloats(bands, maxPoints);
  const minBytes = sonareScopeRingBufferByteLength(capacity, bands, maxPoints);
  if (sharedBuffer.byteLength < minBytes) {
    throw new Error('scopeSharedBuffer is too small for the requested ring capacity.');
  }
  Atomics.store(header, 1, capacity);
  Atomics.store(header, 2, recordFloats);
  Atomics.store(header, 3, bands);
  Atomics.store(header, 4, maxPoints);
  return {
    header,
    records: new Float32Array(sharedBuffer, headerBytes, capacity * recordFloats),
    capacity,
    bands,
    maxPoints,
    recordFloats,
  };
}
function sonareEngineCommandRingBufferByteLength(capacity) {
  const clampedCapacity = Math.max(1, Math.floor(capacity));
  return (
    SONARE_ENGINE_RING_HEADER_INTS * Int32Array.BYTES_PER_ELEMENT +
    clampedCapacity * SONARE_ENGINE_COMMAND_RECORD_BYTES
  );
}
function sonareEngineTelemetryRingBufferByteLength(capacity) {
  const clampedCapacity = Math.max(1, Math.floor(capacity));
  return (
    SONARE_ENGINE_RING_HEADER_INTS * Int32Array.BYTES_PER_ELEMENT +
    clampedCapacity * SONARE_ENGINE_TELEMETRY_RECORD_BYTES
  );
}
function createSonareEngineCommandRingBuffer(capacity = 128) {
  const clampedCapacity = Math.max(1, Math.floor(capacity));
  const sharedBuffer = new SharedArrayBuffer(
    sonareEngineCommandRingBufferByteLength(clampedCapacity),
  );
  const ring = engineRingFromSharedBuffer(
    sharedBuffer,
    SONARE_ENGINE_COMMAND_RECORD_BYTES,
    clampedCapacity,
  );
  return { sharedBuffer, header: ring.header, view: ring.view, capacity: ring.capacity };
}
function createSonareEngineTelemetryRingBuffer(capacity = 128) {
  const clampedCapacity = Math.max(1, Math.floor(capacity));
  const sharedBuffer = new SharedArrayBuffer(
    sonareEngineTelemetryRingBufferByteLength(clampedCapacity),
  );
  const ring = engineRingFromSharedBuffer(
    sharedBuffer,
    SONARE_ENGINE_TELEMETRY_RECORD_BYTES,
    clampedCapacity,
  );
  return { sharedBuffer, header: ring.header, view: ring.view, capacity: ring.capacity };
}
function pushSonareEngineCommandRingBuffer(ring, command) {
  const writeIndex = Atomics.load(ring.header, 0);
  const readIndex = Atomics.load(ring.header, 1);
  if (writeIndex - readIndex >= ring.capacity) {
    Atomics.add(ring.header, 4, 1);
    return false;
  }
  writeEngineCommandRecord(
    ring.view,
    recordOffset(writeIndex, ring.capacity, SONARE_ENGINE_COMMAND_RECORD_BYTES),
    command,
  );
  Atomics.store(ring.header, 0, writeIndex + 1);
  return true;
}
function popSonareEngineCommandRingBuffer(ring) {
  const readIndex = Atomics.load(ring.header, 1);
  const writeIndex = Atomics.load(ring.header, 0);
  if (readIndex >= writeIndex) {
    return null;
  }
  const command = readEngineCommandRecord(
    ring.view,
    recordOffset(readIndex, ring.capacity, SONARE_ENGINE_COMMAND_RECORD_BYTES),
  );
  Atomics.store(ring.header, 1, readIndex + 1);
  return command;
}
function writeSonareEngineTelemetryRingBuffer(ring, telemetry) {
  const writeIndex = Atomics.load(ring.header, 0);
  writeEngineTelemetryRecord(
    ring.view,
    recordOffset(writeIndex, ring.capacity, SONARE_ENGINE_TELEMETRY_RECORD_BYTES),
    telemetry,
  );
  Atomics.store(ring.header, 0, writeIndex + 1);
  if (writeIndex + 1 > ring.capacity) {
    Atomics.store(ring.header, 4, writeIndex + 1 - ring.capacity);
  }
}
function readSonareEngineTelemetryRingBuffer(ring, readIndex = 0) {
  const writeIndex = Atomics.load(ring.header, 0);
  const nextReadIndex = Math.max(0, Math.min(readIndex, writeIndex));
  const firstReadable = Math.max(nextReadIndex, writeIndex - ring.capacity);
  const telemetry = [];
  for (let index = firstReadable; index < writeIndex; index++) {
    telemetry.push(
      readEngineTelemetryRecord(
        ring.view,
        recordOffset(index, ring.capacity, SONARE_ENGINE_TELEMETRY_RECORD_BYTES),
      ),
    );
  }
  return { nextReadIndex: writeIndex, telemetry };
}
function meterRingFromSharedBuffer(sharedBuffer, fallbackCapacity) {
  const headerBytes = SONARE_METER_RING_HEADER_INTS * Int32Array.BYTES_PER_ELEMENT;
  const header = new Int32Array(sharedBuffer, 0, SONARE_METER_RING_HEADER_INTS);
  const existingCapacity = Atomics.load(header, 1);
  const capacity = Math.max(1, Math.floor(existingCapacity || fallbackCapacity || 1));
  const minBytes = sonareMeterRingBufferByteLength(capacity);
  if (sharedBuffer.byteLength < minBytes) {
    throw new Error('meterSharedBuffer is too small for the requested ring capacity.');
  }
  Atomics.store(header, 1, capacity);
  Atomics.store(header, 2, SONARE_METER_RING_RECORD_FLOATS);
  return {
    header,
    records: new Float32Array(
      sharedBuffer,
      headerBytes,
      capacity * SONARE_METER_RING_RECORD_FLOATS,
    ),
    capacity,
  };
}
function spectrumRingFromSharedBuffer(sharedBuffer, fallbackCapacity, fallbackBands) {
  const headerBytes = SONARE_SPECTRUM_RING_HEADER_INTS * Int32Array.BYTES_PER_ELEMENT;
  const header = new Int32Array(sharedBuffer, 0, SONARE_SPECTRUM_RING_HEADER_INTS);
  const existingCapacity = Atomics.load(header, 1);
  const existingBands = Atomics.load(header, 3);
  const capacity = Math.max(1, Math.floor(existingCapacity || fallbackCapacity || 1));
  const bands = Math.max(1, Math.floor(existingBands || fallbackBands || 16));
  const recordFloats = 3 + bands;
  const minBytes = sonareSpectrumRingBufferByteLength(capacity, bands);
  if (sharedBuffer.byteLength < minBytes) {
    throw new Error('spectrumSharedBuffer is too small for the requested ring capacity.');
  }
  Atomics.store(header, 1, capacity);
  Atomics.store(header, 2, recordFloats);
  Atomics.store(header, 3, bands);
  return {
    header,
    records: new Float32Array(sharedBuffer, headerBytes, capacity * recordFloats),
    capacity,
    bands,
    recordFloats,
  };
}
function engineRingFromSharedBuffer(sharedBuffer, recordBytes, fallbackCapacity) {
  const headerBytes = SONARE_ENGINE_RING_HEADER_INTS * Int32Array.BYTES_PER_ELEMENT;
  const header = new Int32Array(sharedBuffer, 0, SONARE_ENGINE_RING_HEADER_INTS);
  const existingCapacity = Atomics.load(header, 2);
  const capacity = Math.max(1, Math.floor(existingCapacity || fallbackCapacity || 1));
  const minBytes = headerBytes + capacity * recordBytes;
  if (sharedBuffer.byteLength < minBytes) {
    throw new Error('engine SharedArrayBuffer is too small for the requested ring capacity.');
  }
  Atomics.store(header, 2, capacity);
  Atomics.store(header, 3, recordBytes);
  return {
    header,
    view: new DataView(sharedBuffer, headerBytes, capacity * recordBytes),
    capacity,
  };
}
function recordOffset(index, capacity, recordBytes) {
  return (index % capacity) * recordBytes;
}
function toBigInt64(value, fallback) {
  if (typeof value === 'bigint') {
    return value;
  }
  if (typeof value === 'number') {
    return BigInt(Math.trunc(value));
  }
  return fallback;
}
function writeEngineCommandRecord(view, offset, command) {
  view.setUint32(offset, command.type, true);
  view.setUint32(offset + 4, command.targetId ?? 0, true);
  view.setBigInt64(offset + 8, toBigInt64(command.sampleTime, -1n), true);
  view.setFloat64(offset + 16, command.argFloat ?? 0, true);
  view.setBigInt64(offset + 24, toBigInt64(command.argInt, 0n), true);
}
function readEngineCommandRecord(view, offset) {
  return {
    type: view.getUint32(offset, true),
    targetId: view.getUint32(offset + 4, true),
    sampleTime: Number(view.getBigInt64(offset + 8, true)),
    argFloat: view.getFloat64(offset + 16, true),
    argInt: Number(view.getBigInt64(offset + 24, true)),
  };
}
function writeEngineTelemetryRecord(view, offset, telemetry) {
  view.setUint32(offset, telemetry.type, true);
  view.setUint32(offset + 4, telemetry.error, true);
  view.setBigInt64(offset + 8, BigInt(Math.trunc(telemetry.renderFrame)), true);
  view.setBigInt64(offset + 16, BigInt(Math.trunc(telemetry.timelineSample)), true);
  view.setBigInt64(offset + 24, BigInt(Math.trunc(telemetry.audibleTimelineSample)), true);
  view.setInt32(offset + 32, telemetry.graphLatencySamplesQ8, true);
  view.setUint32(offset + 36, telemetry.value, true);
  view.setBigInt64(offset + 40, 0n, true);
}
function readEngineTelemetryRecord(view, offset) {
  return {
    type: view.getUint32(offset, true),
    error: view.getUint32(offset + 4, true),
    renderFrame: Number(view.getBigInt64(offset + 8, true)),
    timelineSample: Number(view.getBigInt64(offset + 16, true)),
    audibleTimelineSample: Number(view.getBigInt64(offset + 24, true)),
    graphLatencySamplesQ8: view.getInt32(offset + 32, true),
    value: view.getUint32(offset + 36, true),
  };
}
function telemetryFromEngine(telemetry) {
  return {
    type: telemetry.type,
    error: telemetry.error,
    renderFrame: telemetry.renderFrame,
    timelineSample: telemetry.timelineSample,
    audibleTimelineSample: telemetry.audibleTimelineSample,
    graphLatencySamplesQ8: telemetry.graphLatencySamplesQ8,
    value: telemetry.value,
  };
}
function meterFromEngine(meter) {
  return {
    type: 'meter',
    targetId: meter.targetId,
    frame: meter.renderFrame,
    peakDbL: meter.peakDbL,
    peakDbR: meter.peakDbR,
    rmsDbL: meter.rmsDbL,
    rmsDbR: meter.rmsDbR,
    correlation: meter.correlation,
    truePeakDbL: meter.truePeakDbL,
    truePeakDbR: meter.truePeakDbR,
    momentaryLufs: meter.momentaryLufs,
    shortTermLufs: meter.shortTermLufs,
    integratedLufs: meter.integratedLufs,
    gainReductionDb: meter.gainReductionDb,
  };
}
function magnitudeToDb(value) {
  return value > 1e-12 ? 20 * Math.log10(value) : -120;
}

// src/worklet/guards.ts
function isWorkletMessage(value) {
  if (!isRecord(value) || typeof value.type !== 'string') {
    return false;
  }
  return (
    value.type === 'scheduleInsertAutomation' ||
    value.type === 'setMeterInterval' ||
    value.type === 'destroy'
  );
}
function isEngineCommandRecord(value) {
  return isRecord(value) && typeof value.type === 'number';
}
function isEngineSyncMessage(value) {
  if (!isRecord(value) || typeof value.type !== 'string') {
    return false;
  }
  return (
    value.type === 'syncClips' ||
    value.type === 'syncClipsDelta' ||
    value.type === 'syncMidiClips' ||
    value.type === 'syncMarkers' ||
    value.type === 'syncMetronome' ||
    value.type === 'syncAutomation' ||
    value.type === 'syncTempo' ||
    value.type === 'syncMixer' ||
    value.type === 'syncCapture' ||
    value.type === 'syncTrackStripEqBand' ||
    value.type === 'syncMasterStripEqBand' ||
    value.type === 'syncTrackStripInsertBypassed' ||
    value.type === 'syncMasterStripInsertBypassed' ||
    value.type === 'syncTrackStripInsertParamByName' ||
    value.type === 'syncMasterStripInsertParamByName' ||
    value.type === 'syncTrackStripPan' ||
    value.type === 'syncTrackStripPanLaw' ||
    value.type === 'syncTrackStripPanMode' ||
    value.type === 'syncTrackStripDualPan' ||
    value.type === 'syncTrackStripChannelDelaySamples' ||
    value.type === 'syncBuiltinInstrument' ||
    value.type === 'syncSynthInstrument' ||
    value.type === 'syncSf2Instrument' ||
    value.type === 'syncLoadSoundFont' ||
    value.type === 'syncMidiNoteOn' ||
    value.type === 'syncMidiNoteOff' ||
    value.type === 'syncMidiCc' ||
    value.type === 'syncMidiPanic'
  );
}
function isEngineCaptureRequestMessage(value) {
  return (
    isRecord(value) &&
    value.type === 'captureRequest' &&
    typeof value.requestId === 'number' &&
    (value.op === 'status' || value.op === 'read' || value.op === 'reset')
  );
}
function isEngineCaptureResponseMessage(value) {
  return (
    isRecord(value) &&
    value.type === 'captureResponse' &&
    typeof value.requestId === 'number' &&
    typeof value.ok === 'boolean'
  );
}
function isEngineTransportRequestMessage(value) {
  return (
    isRecord(value) &&
    value.type === 'transportRequest' &&
    typeof value.requestId === 'number' &&
    value.op === 'state'
  );
}
function isEngineTransportResponseMessage(value) {
  return (
    isRecord(value) &&
    value.type === 'transportResponse' &&
    typeof value.requestId === 'number' &&
    typeof value.ok === 'boolean'
  );
}
function isRealtimeVoiceChangerMessage(value) {
  if (!isRecord(value) || typeof value.type !== 'string') {
    return false;
  }
  return value.type === 'setConfig' || value.type === 'reset' || value.type === 'destroy';
}
function isEngineTelemetryRecord(value) {
  return (
    isRecord(value) &&
    typeof value.type === 'number' &&
    typeof value.error === 'number' &&
    typeof value.renderFrame === 'number' &&
    typeof value.timelineSample === 'number' &&
    typeof value.audibleTimelineSample === 'number' &&
    typeof value.graphLatencySamplesQ8 === 'number' &&
    typeof value.value === 'number'
  );
}
function isMeterSnapshot(value) {
  return (
    isRecord(value) &&
    value.type === 'meter' &&
    typeof value.frame === 'number' &&
    typeof value.peakDbL === 'number' &&
    typeof value.peakDbR === 'number' &&
    typeof value.rmsDbL === 'number' &&
    typeof value.rmsDbR === 'number' &&
    typeof value.correlation === 'number' &&
    (typeof value.targetId === 'number' || value.targetId === void 0)
  );
}

// src/worklet/messages.ts
var DEFAULT_METRONOME_CONFIG = {
  beatGain: 0.35,
  accentGain: 0.7,
  clickSamples: 96,
};
function resolveMetronomeConfig(config) {
  return {
    beatGain: config.beatGain ?? DEFAULT_METRONOME_CONFIG.beatGain,
    accentGain: config.accentGain ?? DEFAULT_METRONOME_CONFIG.accentGain,
    clickSamples: config.clickSamples ?? DEFAULT_METRONOME_CONFIG.clickSamples,
  };
}

// src/worklet.ts
var SonareWorkletProcessor = class {
  constructor(options, transport) {
    this.closed = false;
    this.processedFrames = 0;
    this.lastMeterFrame = 0;
    this.lastSpectrumFrame = 0;
    if (!options.sceneJson) {
      throw new Error('sceneJson is required.');
    }
    this.sampleRate = options.sampleRate ?? 48e3;
    this.blockSize = options.blockSize ?? 128;
    this.meterIntervalFrames = Math.max(0, Math.floor(options.meterIntervalFrames ?? 2048));
    this.spectrumIntervalFrames = Math.max(0, Math.floor(options.spectrumIntervalFrames ?? 0));
    this.transport = transport;
    this.meterIntervalFrames = Math.max(0, Math.floor(options.meterIntervalFrames ?? 2048));
    this.meterRing = options.meterSharedBuffer
      ? meterRingFromSharedBuffer(options.meterSharedBuffer, options.meterRingCapacity)
      : void 0;
    this.spectrumRing = options.spectrumSharedBuffer
      ? spectrumRingFromSharedBuffer(
          options.spectrumSharedBuffer,
          options.spectrumRingCapacity,
          options.spectrumBands,
        )
      : void 0;
    const spectrumBandCount = this.spectrumRing?.bands ?? Math.max(1, options.spectrumBands ?? 16);
    this.spectrumBands = new Float32Array(spectrumBandCount);
    this.mixer = Mixer.fromSceneJson(options.sceneJson, this.sampleRate, this.blockSize);
    this.mixer.compile();
    const sceneStripCount = this.mixer.stripCount();
    const stripCount = options.stripCount ?? sceneStripCount;
    if (stripCount !== sceneStripCount) {
      throw new Error('stripCount must match the scene strip count.');
    }
    this.realtime = this.mixer.createRealtimeBuffer();
  }
  process(inputs, outputs) {
    if (this.closed) {
      return false;
    }
    const output = outputs[0];
    const leftOut = output?.[0];
    const rightOut = output?.[1];
    if (!leftOut) {
      return true;
    }
    const frames = leftOut.length;
    const usable = Math.min(frames, this.blockSize);
    for (let strip = 0; strip < this.realtime.leftInputs.length; strip++) {
      const input = inputs[strip];
      const left = input?.[0];
      const right = input?.[1];
      const leftTarget = this.realtime.leftInputs[strip];
      const rightTarget = this.realtime.rightInputs[strip];
      if (left && left.length >= usable) {
        leftTarget.set(left.subarray(0, usable));
        if (right && right.length >= usable) {
          rightTarget.set(right.subarray(0, usable));
        } else {
          rightTarget.set(left.subarray(0, usable));
        }
      } else {
        leftTarget.fill(0);
        rightTarget.fill(0);
      }
    }
    this.realtime.process(usable);
    if (usable === frames) {
      leftOut.set(this.realtime.outLeft.subarray(0, usable));
      if (rightOut) {
        rightOut.set(this.realtime.outRight.subarray(0, usable));
      }
    } else {
      leftOut.fill(0);
      leftOut.set(this.realtime.outLeft.subarray(0, usable));
      if (rightOut) {
        rightOut.fill(0);
        rightOut.set(this.realtime.outRight.subarray(0, usable));
      }
    }
    this.processedFrames += usable;
    this.publishMeter(
      this.realtime.outLeft.subarray(0, usable),
      this.realtime.outRight.subarray(0, usable),
    );
    this.publishSpectrum(
      this.realtime.outLeft.subarray(0, usable),
      this.realtime.outRight.subarray(0, usable),
    );
    return true;
  }
  receiveMessage(message) {
    if (this.closed) {
      return;
    }
    if (message.type === 'destroy') {
      this.destroy();
      return;
    }
    if (message.type === 'setMeterInterval') {
      this.meterIntervalFrames = Math.max(0, Math.floor(message.frames));
      return;
    }
    if (message.type === 'scheduleInsertAutomation') {
      this.mixer.scheduleInsertAutomation(
        message.stripIndex,
        message.insertIndex,
        message.paramId,
        message.samplePos ?? this.processedFrames,
        message.value,
        message.curve ?? 'linear',
      );
    }
  }
  destroy() {
    if (!this.closed) {
      this.mixer.delete();
      this.closed = true;
    }
  }
  publishMeter(left, right) {
    if (!this.transport || this.meterIntervalFrames <= 0) {
      return;
    }
    if (this.processedFrames - this.lastMeterFrame < this.meterIntervalFrames) {
      return;
    }
    this.lastMeterFrame = this.processedFrames;
    let peakL = 0;
    let peakR = 0;
    let sumL = 0;
    let sumR = 0;
    let sumLR = 0;
    for (let i = 0; i < left.length; i++) {
      const l = left[i] ?? 0;
      const r = right[i] ?? 0;
      const absL = Math.abs(l);
      const absR = Math.abs(r);
      if (absL > peakL) {
        peakL = absL;
      }
      if (absR > peakR) {
        peakR = absR;
      }
      sumL += l * l;
      sumR += r * r;
      sumLR += l * r;
    }
    const rmsL = Math.sqrt(sumL / Math.max(1, left.length));
    const rmsR = Math.sqrt(sumR / Math.max(1, right.length));
    const denominator = Math.sqrt(sumL * sumR);
    const meter = {
      type: 'meter',
      targetId: 0,
      frame: this.processedFrames,
      peakDbL: toDb(peakL),
      peakDbR: toDb(peakR),
      rmsDbL: toDb(rmsL),
      rmsDbR: toDb(rmsR),
      correlation: denominator > 0 ? sumLR / denominator : 0,
      truePeakDbL: toDb(peakL),
      truePeakDbR: toDb(peakR),
      momentaryLufs: Number.NaN,
      shortTermLufs: Number.NaN,
      integratedLufs: Number.NaN,
      gainReductionDb: Number.NaN,
    };
    this.transport.onMeter?.(meter);
    if (this.meterRing) {
      this.writeMeterRing(meter);
    } else {
      this.transport.postMessage?.(meter);
    }
  }
  writeMeterRing(meter) {
    const ring = this.meterRing;
    if (!ring) {
      return;
    }
    const writeIndex = Atomics.load(ring.header, 0);
    const offset = (writeIndex % ring.capacity) * SONARE_METER_RING_RECORD_FLOATS;
    ring.records[offset] = encodeFrameLo(meter.frame);
    ring.records[offset + 1] = encodeFrameHi(meter.frame);
    ring.records[offset + 2] = meter.targetId;
    ring.records[offset + 3] = meter.peakDbL;
    ring.records[offset + 4] = meter.peakDbR;
    ring.records[offset + 5] = meter.rmsDbL;
    ring.records[offset + 6] = meter.rmsDbR;
    ring.records[offset + 7] = meter.correlation;
    ring.records[offset + 8] = meter.truePeakDbL;
    ring.records[offset + 9] = meter.truePeakDbR;
    ring.records[offset + 10] = meter.momentaryLufs;
    ring.records[offset + 11] = meter.shortTermLufs;
    ring.records[offset + 12] = meter.integratedLufs;
    ring.records[offset + 13] = meter.gainReductionDb;
    Atomics.store(ring.header, 0, writeIndex + 1);
  }
  publishSpectrum(left, right) {
    if (this.spectrumIntervalFrames <= 0) {
      return;
    }
    if (this.processedFrames - this.lastSpectrumFrame < this.spectrumIntervalFrames) {
      return;
    }
    this.lastSpectrumFrame = this.processedFrames;
    this.computeSpectrum(left, right);
    if (this.spectrumRing) {
      this.writeSpectrumRing(this.processedFrames, this.spectrumBands);
      return;
    }
    const spectrum = {
      type: 'spectrum',
      frame: this.processedFrames,
      bands: new Float32Array(this.spectrumBands),
    };
    this.transport?.onSpectrum?.(spectrum);
    this.transport?.postMessage?.(spectrum);
  }
  computeSpectrum(left, right) {
    const n = Math.max(1, Math.min(left.length, right.length));
    const maxBand = Math.floor(n / 2);
    for (let band = 0; band < this.spectrumBands.length; band++) {
      if (band >= maxBand) {
        this.spectrumBands[band] = magnitudeToDb(0);
        continue;
      }
      const bin = band + 1;
      let real = 0;
      let imag = 0;
      for (let i = 0; i < n; i++) {
        const sample = 0.5 * ((left[i] ?? 0) + (right[i] ?? 0));
        const phase = (-2 * Math.PI * bin * i) / n;
        real += sample * Math.cos(phase);
        imag += sample * Math.sin(phase);
      }
      this.spectrumBands[band] = magnitudeToDb((2 * Math.hypot(real, imag)) / n);
    }
  }
  writeSpectrumRing(frame, bands) {
    const ring = this.spectrumRing;
    if (!ring) {
      return;
    }
    const writeIndex = Atomics.load(ring.header, 0);
    const offset = (writeIndex % ring.capacity) * ring.recordFloats;
    ring.records[offset] = encodeFrameLo(frame);
    ring.records[offset + 1] = encodeFrameHi(frame);
    ring.records[offset + 2] = bands.length;
    ring.records.set(bands.subarray(0, ring.bands), offset + 3);
    Atomics.store(ring.header, 0, writeIndex + 1);
  }
};
var _SonareRealtimeEngineWorkletProcessor = class _SonareRealtimeEngineWorkletProcessor {
  constructor(options = {}, transport) {
    this.closed = false;
    this.lastMeterFrame = Number.NEGATIVE_INFINITY;
    // Latest metronome gains/click length pushed via 'syncMetronome'. The
    // SetMetronome command only toggles enabled state; the config arrives here.
    this.metronomeConfig = { ...DEFAULT_METRONOME_CONFIG };
    this.liveClips = /* @__PURE__ */ new Map();
    this.sampleRate = options.sampleRate ?? 48e3;
    this.blockSize = options.blockSize ?? 128;
    this.channelCount = Math.max(1, Math.floor(options.channelCount ?? 2));
    this.runtimeTarget = options.runtimeTarget ?? 'embind';
    if (this.runtimeTarget === 'sonare-rt') {
      throw new Error(
        'sonare-rt runtime is provided by the dedicated Emscripten AudioWorklet module; use SonareRealtimeEngineNode.create({ runtimeTarget: "sonare-rt", moduleUrl: ... }) to load it.',
      );
    }
    this.transport = transport;
    this.meterIntervalFrames = Math.max(0, Math.floor(options.meterIntervalFrames ?? 2048));
    this.commandRing = options.commandSharedBuffer
      ? this.commandRingFromSharedBuffer(options.commandSharedBuffer, options.commandRingCapacity)
      : void 0;
    this.telemetryRing = options.telemetrySharedBuffer
      ? this.telemetryRingFromSharedBuffer(
          options.telemetrySharedBuffer,
          options.telemetryRingCapacity,
        )
      : void 0;
    this.meterRing = options.meterSharedBuffer
      ? meterRingFromSharedBuffer(options.meterSharedBuffer, options.meterRingCapacity)
      : void 0;
    this.scopeRing = options.scopeSharedBuffer
      ? scopeRingFromSharedBuffer(
          options.scopeSharedBuffer,
          options.scopeRingCapacity,
          options.scopeBands,
        )
      : void 0;
    this.engine = new RealtimeEngine(this.sampleRate, this.blockSize);
    this.engine.prepareChannels(this.channelCount, this.blockSize);
    this.channelBuffers = new Array(this.channelCount);
    for (let ch = 0; ch < this.channelCount; ch++) {
      this.channelBuffers[ch] = this.engine.getChannelBuffer(ch, this.blockSize);
    }
    if (this.scopeRing) {
      const interval = Math.max(1, Math.floor(options.scopeIntervalFrames ?? this.blockSize));
      this.engine.configureScopeTelemetry(interval, this.scopeRing.bands);
    }
  }
  process(inputs, outputs) {
    if (this.closed) {
      return false;
    }
    const output = outputs[0];
    const firstOutput = output?.[0];
    if (!firstOutput) {
      return true;
    }
    const frames = firstOutput.length;
    if (frames > this.blockSize) {
      for (const channel of output ?? []) {
        channel.fill(0);
      }
      this.publishTelemetry();
      return true;
    }
    this.drainCommands();
    let usableFrames = frames;
    if (usableFrames > this.blockSize) {
      if (!_SonareRealtimeEngineWorkletProcessor.warnedChannelScratchOverflow) {
        _SonareRealtimeEngineWorkletProcessor.warnedChannelScratchOverflow = true;
        console.warn(
          `SonareRealtimeEngineWorkletProcessor: requested ${usableFrames} frames exceeds pre-allocated capacity ${this.blockSize}; clamping.`,
        );
      }
      usableFrames = this.blockSize;
    }
    if ((this.channelBuffers[0]?.byteLength ?? 0) === 0) {
      this.reacquireChannelBuffers();
    }
    const input = inputs[0];
    for (let ch = 0; ch < this.channelCount; ch++) {
      const dst = this.channelBuffers[ch];
      const source = input?.[ch];
      if (source && source.length === usableFrames) {
        dst.set(source.subarray(0, usableFrames));
      } else {
        dst.fill(0, 0, usableFrames);
      }
    }
    this.engine.processPrepared(usableFrames);
    for (let ch = 0; ch < output.length; ch++) {
      const target = output[ch];
      const source = this.channelBuffers[ch] ?? this.channelBuffers[0];
      if (source) {
        target.set(source.subarray(0, Math.min(target.length, usableFrames)));
        if (target.length > usableFrames) {
          target.fill(0, usableFrames);
        }
      } else {
        target.fill(0);
      }
    }
    this.publishTelemetry();
    this.publishMeters();
    this.publishScope();
    return true;
  }
  reacquireChannelBuffers() {
    for (let ch = 0; ch < this.channelCount; ch++) {
      this.channelBuffers[ch] = this.engine.getChannelBuffer(ch, this.blockSize);
    }
  }
  receiveCommand(command) {
    if (!this.closed) {
      this.applyCommand(command);
    }
  }
  // Applies an out-of-band control-plane sync message. Runs on the AudioWorklet
  // global scope but OUTSIDE process() (the message-port callback), so the
  // bulk/allocating engine setters (setClips/setMarkers) are safe here — they
  // never run on the realtime render path. This is the audio-thread equivalent
  // of the engine's control-thread RtPublisher setters.
  receiveSync(message) {
    if (this.closed) {
      return;
    }
    switch (message.type) {
      case 'syncClips':
        this.liveClips.clear();
        for (const clip of message.clips) {
          if (clip.id !== void 0) {
            this.liveClips.set(clip.id, clip);
          }
        }
        this.engine.setClips(message.clips);
        break;
      case 'syncClipsDelta':
        for (const clipId of message.removeIds) {
          this.liveClips.delete(clipId);
        }
        for (const clip of message.upserts) {
          if (clip.id !== void 0) {
            this.liveClips.set(clip.id, clip);
          }
        }
        this.engine.setClips(Array.from(this.liveClips.values()));
        break;
      case 'syncMidiClips':
        this.engine.setMidiClips(message.clips);
        break;
      case 'syncMarkers':
        this.engine.setMarkers(message.markers);
        break;
      case 'syncMetronome':
        this.metronomeConfig = resolveMetronomeConfig(message.config);
        this.engine.setMetronome(message.config);
        break;
      case 'syncAutomation':
        this.engine.setAutomationLane(message.paramId, message.points);
        break;
      case 'syncTempo':
        if (message.tempoSegments) {
          this.engine.setTempoSegments(message.tempoSegments);
        } else {
          this.engine.setTempo(message.bpm);
        }
        if (message.timeSignatureSegments) {
          this.engine.setTimeSignatureSegments(message.timeSignatureSegments);
        } else {
          this.engine.setTimeSignature(
            message.timeSignature.numerator,
            message.timeSignature.denominator,
          );
        }
        break;
      case 'syncMixer':
        if (message.buses) {
          this.engine.setTrackBuses(message.buses);
        }
        this.engine.setTrackLanes(message.lanes);
        for (const strip of message.trackStrips ?? []) {
          this.engine.setTrackStripJson(strip.trackId, strip.sceneJson);
        }
        for (const strip of message.busStrips ?? []) {
          this.engine.setBusStripJson(strip.busId, strip.sceneJson);
        }
        if (message.masterStripJson) {
          this.engine.setMasterStripJson(message.masterStripJson);
        }
        for (const binding of message.laneSidechains ?? []) {
          this.engine.setLaneSidechain(binding.trackId, binding.insertIndex, binding.sourceTrackId);
        }
        break;
      case 'syncCapture':
        this.engine.setCaptureBuffer(message.channels, message.bufferFrames);
        this.engine.setCaptureSource(message.source);
        this.engine.setRecordOffsetSamples(message.recordOffsetSamples);
        this.engine.setInputMonitor(message.inputMonitor.enabled, message.inputMonitor.gain);
        break;
      case 'syncTrackStripEqBand':
        this.engine.setTrackStripEqBandJson(message.trackId, message.bandIndex, message.bandJson);
        break;
      case 'syncMasterStripEqBand':
        this.engine.setMasterStripEqBandJson(message.bandIndex, message.bandJson);
        break;
      case 'syncTrackStripInsertBypassed':
        this.engine.setTrackStripInsertBypassed(
          message.trackId,
          message.insertIndex,
          message.bypassed,
          message.resetOnBypass,
        );
        break;
      case 'syncMasterStripInsertBypassed':
        this.engine.setMasterStripInsertBypassed(
          message.insertIndex,
          message.bypassed,
          message.resetOnBypass,
        );
        break;
      case 'syncTrackStripInsertParamByName':
        this.engine.setTrackStripInsertParamByName(
          message.trackId,
          message.insertIndex,
          message.paramName,
          message.value,
        );
        break;
      case 'syncMasterStripInsertParamByName':
        this.engine.setMasterStripInsertParamByName(
          message.insertIndex,
          message.paramName,
          message.value,
        );
        break;
      case 'syncTrackStripPan':
        this.engine.setTrackStripPan(message.trackId, message.pan);
        break;
      case 'syncTrackStripPanLaw':
        this.engine.setTrackStripPanLaw(message.trackId, message.panLaw);
        break;
      case 'syncTrackStripPanMode':
        this.engine.setTrackStripPanMode(message.trackId, message.panMode);
        break;
      case 'syncTrackStripDualPan':
        this.engine.setTrackStripDualPan(message.trackId, message.leftPan, message.rightPan);
        break;
      case 'syncTrackStripChannelDelaySamples':
        this.engine.setTrackStripChannelDelaySamples(message.trackId, message.delaySamples);
        break;
      case 'syncBuiltinInstrument':
        this.engine.setBuiltinInstrument(message.config, message.destinationId);
        break;
      case 'syncSynthInstrument':
        this.engine.setSynthInstrument(message.patch, message.destinationId);
        break;
      case 'syncLoadSoundFont':
        this.engine.loadSoundFont(message.data);
        break;
      case 'syncSf2Instrument':
        this.engine.setSf2Instrument(message.config, message.destinationId);
        break;
      case 'syncMidiNoteOn':
        this.engine.pushMidiNoteOn(
          message.destinationId,
          message.group,
          message.channel,
          message.note,
          message.velocity,
          message.renderFrame,
        );
        break;
      case 'syncMidiNoteOff':
        this.engine.pushMidiNoteOff(
          message.destinationId,
          message.group,
          message.channel,
          message.note,
          message.velocity,
          message.renderFrame,
        );
        break;
      case 'syncMidiCc':
        this.engine.pushMidiCc(
          message.destinationId,
          message.group,
          message.channel,
          message.controller,
          message.value,
          message.renderFrame,
        );
        break;
      case 'syncMidiPanic':
        this.engine.pushMidiPanic(message.renderFrame);
        break;
    }
  }
  receiveCaptureRequest(message) {
    if (this.closed) {
      return;
    }
    try {
      if (message.op === 'status') {
        const status = this.engine.captureStatus();
        this.transport?.postMessage?.({
          type: 'captureResponse',
          requestId: message.requestId,
          ok: true,
          status: {
            capturedFrames: status.capturedFrames,
            overflowCount: status.overflowCount,
            armed: status.armed,
            punchEnabled: status.punchEnabled,
            source: status.source,
            recordOffsetSamples: status.recordOffsetSamples,
          },
        });
        return;
      }
      if (message.op === 'read') {
        const captured = this.engine.capturedAudio();
        const channels = [];
        for (let ch = 0; ch < captured.length; ch++) {
          const source = captured[ch];
          const copy = [];
          for (let i = 0; i < source.length; i++) {
            copy.push(Number(source[i]));
          }
          channels.push(copy);
        }
        this.transport?.postMessage?.({
          type: 'captureResponse',
          requestId: message.requestId,
          ok: true,
          channels,
        });
        return;
      }
      this.engine.resetCapture();
      this.transport?.postMessage?.({
        type: 'captureResponse',
        requestId: message.requestId,
        ok: true,
      });
    } catch (error) {
      this.transport?.postMessage?.({
        type: 'captureResponse',
        requestId: message.requestId,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  receiveTransportRequest(message) {
    if (this.closed) {
      return;
    }
    try {
      this.transport?.postMessage?.({
        type: 'transportResponse',
        requestId: message.requestId,
        ok: true,
        state: this.engine.getTransportState(),
      });
    } catch (error) {
      this.transport?.postMessage?.({
        type: 'transportResponse',
        requestId: message.requestId,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  destroy() {
    if (!this.closed) {
      this.engine.destroy();
      this.closed = true;
    }
  }
  drainCommands() {
    if (!this.commandRing) {
      return;
    }
    for (let i = 0; i < 64; i++) {
      const command = popSonareEngineCommandRingBuffer(this.commandRing);
      if (!command) {
        return;
      }
      this.applyCommand(command);
    }
  }
  applyCommand(command) {
    const sampleTime = Number(command.sampleTime ?? -1);
    switch (command.type) {
      case 0 /* SetParam */:
        this.engine.setParameter(
          Math.trunc(Number(command.targetId ?? 0)),
          Number(command.argFloat ?? 0),
          sampleTime,
        );
        break;
      case 1 /* SetParamSmoothed */:
        this.engine.setParameterSmoothed(
          Math.trunc(Number(command.targetId ?? 0)),
          Number(command.argFloat ?? 0),
          sampleTime,
        );
        break;
      case 2 /* TransportPlay */:
        this.engine.play(sampleTime);
        break;
      case 3 /* TransportStop */:
        this.engine.stop(sampleTime);
        break;
      case 4 /* TransportSeekSample */:
        this.engine.seekSample(Number(command.argInt ?? 0), sampleTime);
        break;
      case 5 /* TransportSeekPpq */:
        this.engine.seekPpq(Number(command.argFloat ?? 0), sampleTime);
        break;
      case 6 /* SetTempoMap */:
        this.engine.setTempo(Number(command.argFloat ?? 120));
        break;
      case 7 /* SetLoop */:
        this.engine.setLoop(
          Number(command.argFloat ?? 0),
          Number(command.argInt ?? 0) / 1e6,
          command.targetId !== 0,
        );
        break;
      case 13 /* ArmRecord */:
        this.engine.armCapture(Boolean(command.argInt));
        break;
      case 14 /* Punch */:
        this.engine.setCapturePunch(
          Number(command.argInt ?? 0),
          Math.max(0, Math.round(Number(command.argFloat ?? 0))),
          true,
        );
        break;
      case 15 /* SetMetronome */:
        this.engine.setMetronome({
          enabled: Boolean(command.argInt),
          beatGain: this.metronomeConfig.beatGain,
          accentGain: this.metronomeConfig.accentGain,
          clickSamples: this.metronomeConfig.clickSamples,
        });
        break;
      case 17 /* SeekMarker */:
        this.engine.seekMarker(Math.trunc(Number(command.targetId ?? 0)), sampleTime);
        break;
      case 10 /* SetSoloMute */:
        this.engine.setSoloMute(
          Math.trunc(Number(command.targetId ?? 0)),
          Boolean((Number(command.argInt ?? 0) & 2) !== 0),
          Boolean((Number(command.argInt ?? 0) & 1) !== 0),
          sampleTime,
        );
        break;
      default:
        this.publishTelemetryRecord({
          type: 1 /* Error */,
          error: 7 /* UnknownTarget */,
          renderFrame: 0,
          timelineSample: 0,
          audibleTimelineSample: 0,
          graphLatencySamplesQ8: 0,
          value: Number(command.type),
        });
        break;
    }
  }
  publishTelemetry() {
    for (const item of this.engine.drainTelemetry(64)) {
      this.publishTelemetryRecord(telemetryFromEngine(item));
    }
  }
  publishTelemetryRecord(record) {
    if (this.telemetryRing) {
      writeSonareEngineTelemetryRingBuffer(this.telemetryRing, record);
      return;
    }
    this.transport?.postMessage?.(record);
  }
  // Drains the engine meter telemetry queue into the stereo meter ring / transport.
  //
  // Shared-queue contract: `drainMeterTelemetry` and `drainMeterTelemetryWide`
  // pop the SAME single-consumer telemetry queue, so exactly ONE of them may run
  // per engine. The live worklet path owns the queue via the stereo drain below;
  // the worklet meter ring (SONARE_METER_RING_RECORD_FLOATS) is a fixed stereo
  // layout carrying planes 0/1 plus the correlation/LUFS summary. Per-plane
  // surround meters are NOT delivered over the live worklet ring — a host that
  // needs them must use the offline `drainMeterTelemetryWide()` API on a
  // non-worklet engine instance (do not also call it on a worklet-driven engine,
  // or the two drains will starve each other).
  publishMeters() {
    if (this.meterIntervalFrames <= 0 || (!this.transport && !this.meterRing)) {
      return;
    }
    for (const item of this.engine.drainMeterTelemetry(64)) {
      const meter = meterFromEngine(item);
      if (
        meter.frame !== this.lastMeterFrame &&
        meter.frame - this.lastMeterFrame < this.meterIntervalFrames
      ) {
        continue;
      }
      if (meter.frame !== this.lastMeterFrame) {
        this.lastMeterFrame = meter.frame;
      }
      if (this.meterRing) {
        this.writeMeterRing(meter);
      } else {
        this.transport?.onMeter?.(meter);
        this.transport?.postMessage?.(meter);
      }
    }
  }
  writeMeterRing(meter) {
    const ring = this.meterRing;
    if (!ring) {
      return;
    }
    const writeIndex = Atomics.load(ring.header, 0);
    const offset = (writeIndex % ring.capacity) * SONARE_METER_RING_RECORD_FLOATS;
    ring.records[offset] = encodeFrameLo(meter.frame);
    ring.records[offset + 1] = encodeFrameHi(meter.frame);
    ring.records[offset + 2] = meter.targetId;
    ring.records[offset + 3] = meter.peakDbL;
    ring.records[offset + 4] = meter.peakDbR;
    ring.records[offset + 5] = meter.rmsDbL;
    ring.records[offset + 6] = meter.rmsDbR;
    ring.records[offset + 7] = meter.correlation;
    ring.records[offset + 8] = meter.truePeakDbL;
    ring.records[offset + 9] = meter.truePeakDbR;
    ring.records[offset + 10] = meter.momentaryLufs;
    ring.records[offset + 11] = meter.shortTermLufs;
    ring.records[offset + 12] = meter.integratedLufs;
    ring.records[offset + 13] = meter.gainReductionDb;
    Atomics.store(ring.header, 0, writeIndex + 1);
  }
  // Drains the engine's scope producer (FFT spectrum + goniometer points) into
  // the lock-free SAB scope ring. Only the embind runtime publishes scope
  // telemetry; the sonare-rt runtime owns its own transport. No allocation on
  // the render path: records are written field-by-field into the ring.
  publishScope() {
    const ring = this.scopeRing;
    if (!ring) {
      return;
    }
    for (const item of this.engine.drainScopeTelemetry(64)) {
      this.writeScopeRing(ring, item);
    }
  }
  writeScopeRing(ring, record) {
    const writeIndex = Atomics.load(ring.header, 0);
    const base = (writeIndex % ring.capacity) * ring.recordFloats;
    ring.records[base] = encodeFrameLo(record.renderFrame);
    ring.records[base + 1] = encodeFrameHi(record.renderFrame);
    ring.records[base + 2] = record.targetId;
    const bandCount = Math.min(ring.bands, record.bands.length);
    ring.records[base + 3] = bandCount;
    const pointCount = Math.min(ring.maxPoints, record.points.length);
    ring.records[base + 4] = pointCount;
    const bandsBase = base + SONARE_SCOPE_RING_RECORD_PREFIX_FLOATS;
    for (let i = 0; i < bandCount; i++) {
      ring.records[bandsBase + i] = record.bands[i];
    }
    const pointsBase = bandsBase + ring.bands;
    for (let i = 0; i < pointCount; i++) {
      const point = record.points[i];
      ring.records[pointsBase + 2 * i] = point.left;
      ring.records[pointsBase + 2 * i + 1] = point.right;
    }
    Atomics.store(ring.header, 0, writeIndex + 1);
  }
  commandRingFromSharedBuffer(sharedBuffer, fallbackCapacity) {
    const ring = engineRingFromSharedBuffer(
      sharedBuffer,
      SONARE_ENGINE_COMMAND_RECORD_BYTES,
      fallbackCapacity,
    );
    return { sharedBuffer, header: ring.header, view: ring.view, capacity: ring.capacity };
  }
  telemetryRingFromSharedBuffer(sharedBuffer, fallbackCapacity) {
    const ring = engineRingFromSharedBuffer(
      sharedBuffer,
      SONARE_ENGINE_TELEMETRY_RECORD_BYTES,
      fallbackCapacity,
    );
    return { sharedBuffer, header: ring.header, view: ring.view, capacity: ring.capacity };
  }
};
_SonareRealtimeEngineWorkletProcessor.warnedChannelScratchOverflow = false;
var SonareRealtimeEngineWorkletProcessor = _SonareRealtimeEngineWorkletProcessor;
var SonareRtRealtimeEngineRuntime = class {
  constructor(options) {
    this.metronomeConfig = { ...DEFAULT_METRONOME_CONFIG };
    this.closed = false;
    this.module = options.module;
    this.memory = options.memory;
    this.sampleRate = options.sampleRate ?? 48e3;
    this.blockSize = options.blockSize ?? 128;
    this.channelCount = Math.max(1, Math.floor(options.channelCount ?? 2));
    this.commandRing = options.commandSharedBuffer
      ? this.commandRingFromSharedBuffer(options.commandSharedBuffer, options.commandRingCapacity)
      : void 0;
    this.telemetryRing = options.telemetrySharedBuffer
      ? this.telemetryRingFromSharedBuffer(
          options.telemetrySharedBuffer,
          options.telemetryRingCapacity,
        )
      : void 0;
    this.engine = this.module._sonare_rt_engine_create();
    if (this.engine <= 0) {
      throw new Error('failed to create sonare-rt engine');
    }
    if (
      this.module._sonare_rt_engine_prepare(
        this.engine,
        this.sampleRate,
        this.blockSize,
        1024,
        1024,
      ) !== 1
    ) {
      this.module._sonare_rt_engine_destroy(this.engine);
      throw new Error('failed to prepare sonare-rt engine');
    }
    this.channelPointerTable = this.module._malloc(
      this.channelCount * Uint32Array.BYTES_PER_ELEMENT,
    );
    this.channelBuffers = [];
    for (let ch = 0; ch < this.channelCount; ch++) {
      this.channelBuffers.push(
        this.module._malloc(this.blockSize * Float32Array.BYTES_PER_ELEMENT),
      );
    }
    this.telemetryIntsPtr = this.module._malloc(64 * 4 * Int32Array.BYTES_PER_ELEMENT);
    this.telemetryFramesPtr = this.module._malloc(64 * 3 * Float64Array.BYTES_PER_ELEMENT);
    this.writeChannelPointers();
  }
  process(inputs, outputs) {
    if (this.closed) {
      return false;
    }
    const output = outputs[0];
    const firstOutput = output?.[0];
    if (!firstOutput) {
      return true;
    }
    const frames = firstOutput.length;
    if (frames > this.blockSize) {
      for (const channel of output) {
        channel.fill(0);
      }
      return true;
    }
    this.drainCommands();
    const heap = new Float32Array(this.memory.buffer);
    const input = inputs[0];
    for (let ch = 0; ch < this.channelCount; ch++) {
      const ptr = this.channelBuffers[ch] ?? this.channelBuffers[0];
      const offset = ptr >> 2;
      const source = input?.[ch];
      if (source && source.length === frames) {
        heap.set(source, offset);
      } else {
        heap.fill(0, offset, offset + frames);
      }
    }
    this.module._sonare_rt_engine_process(
      this.engine,
      this.channelPointerTable,
      this.channelCount,
      frames,
    );
    for (let ch = 0; ch < output.length; ch++) {
      const target = output[ch];
      const ptr = this.channelBuffers[ch] ?? this.channelBuffers[0];
      target.set(heap.subarray(ptr >> 2, (ptr >> 2) + target.length));
    }
    this.publishTelemetry();
    return true;
  }
  receiveCommand(command) {
    if (!this.closed) {
      this.applyCommand(command);
    }
  }
  // Out-of-band control sync for the sonare-rt runtime. The sonare-rt C ABI
  // (src/wasm/rt_bindings.cpp) exposes set_metronome_enabled and seek_marker but
  // NOT set_clips / set_markers, so clip/marker mutations cannot be applied to a
  // live sonare-rt engine. We honor the metronome config and surface a clear
  // telemetry error for the unsupported clip/marker paths instead of silently
  // dropping them. The default 'embind' runtime wires all three fully.
  receiveSync(message) {
    if (this.closed) {
      return;
    }
    switch (message.type) {
      case 'syncMetronome':
        this.metronomeConfig = resolveMetronomeConfig(message.config);
        this.module._sonare_rt_engine_set_metronome_enabled(
          this.engine,
          message.config.enabled ? 1 : 0,
          this.metronomeConfig.beatGain,
          this.metronomeConfig.accentGain,
          this.metronomeConfig.clickSamples,
        );
        break;
      case 'syncTempo':
        this.module._sonare_rt_engine_set_tempo(this.engine, message.bpm);
        break;
      case 'syncClips':
      case 'syncClipsDelta':
      case 'syncMidiClips':
      case 'syncMarkers':
      case 'syncAutomation':
      case 'syncMixer':
      case 'syncCapture':
      case 'syncTrackStripEqBand':
      case 'syncMasterStripEqBand':
      case 'syncTrackStripInsertBypassed':
      case 'syncMasterStripInsertBypassed':
      case 'syncBuiltinInstrument':
      case 'syncSynthInstrument':
      case 'syncSf2Instrument':
      case 'syncLoadSoundFont':
      case 'syncMidiNoteOn':
      case 'syncMidiNoteOff':
      case 'syncMidiCc':
      case 'syncMidiPanic':
        if (this.telemetryRing) {
          writeSonareEngineTelemetryRingBuffer(this.telemetryRing, {
            type: 1 /* Error */,
            error: 7 /* UnknownTarget */,
            renderFrame: 0,
            timelineSample: 0,
            audibleTimelineSample: 0,
            graphLatencySamplesQ8: 0,
            value: 0,
          });
        }
        break;
    }
  }
  receiveCaptureRequest(message, port) {
    if (this.closed) {
      return;
    }
    port?.postMessage?.({
      type: 'captureResponse',
      requestId: message.requestId,
      ok: false,
      error: 'Capture read-back is not supported by the sonare-rt runtime.',
    });
  }
  receiveTransportRequest(message, port) {
    if (this.closed) {
      return;
    }
    port?.postMessage?.({
      type: 'transportResponse',
      requestId: message.requestId,
      ok: false,
      error: 'Transport state read-back is not supported by the sonare-rt runtime.',
    });
  }
  destroy() {
    if (this.closed) {
      return;
    }
    this.module._free(this.telemetryFramesPtr);
    this.module._free(this.telemetryIntsPtr);
    for (const ptr of this.channelBuffers) {
      this.module._free(ptr);
    }
    this.module._free(this.channelPointerTable);
    this.module._sonare_rt_engine_destroy(this.engine);
    this.closed = true;
  }
  writeChannelPointers() {
    const pointers = new Uint32Array(this.memory.buffer);
    const offset = this.channelPointerTable >> 2;
    for (let ch = 0; ch < this.channelBuffers.length; ch++) {
      pointers[offset + ch] = this.channelBuffers[ch];
    }
  }
  drainCommands() {
    if (!this.commandRing) {
      return;
    }
    for (let i = 0; i < 64; i++) {
      const command = popSonareEngineCommandRingBuffer(this.commandRing);
      if (!command) {
        return;
      }
      this.applyCommand(command);
    }
  }
  applyCommand(command) {
    const sampleTime = toBigInt64(command.sampleTime, -1n);
    switch (command.type) {
      case 0 /* SetParam */:
      case 1 /* SetParamSmoothed */:
        if (this.telemetryRing) {
          writeSonareEngineTelemetryRingBuffer(this.telemetryRing, {
            type: 1 /* Error */,
            error: 7 /* UnknownTarget */,
            renderFrame: 0,
            timelineSample: 0,
            audibleTimelineSample: 0,
            graphLatencySamplesQ8: 0,
            value: Number(command.type),
          });
        }
        break;
      case 2 /* TransportPlay */:
        this.module._sonare_rt_engine_play(this.engine, sampleTime);
        break;
      case 3 /* TransportStop */:
        this.module._sonare_rt_engine_stop(this.engine, sampleTime);
        break;
      case 4 /* TransportSeekSample */:
        this.module._sonare_rt_engine_seek_sample(
          this.engine,
          toBigInt64(command.argInt, 0n),
          sampleTime,
        );
        break;
      case 5 /* TransportSeekPpq */:
        this.module._sonare_rt_engine_seek_ppq(
          this.engine,
          Number(command.argFloat ?? 0),
          sampleTime,
        );
        break;
      case 6 /* SetTempoMap */:
        this.module._sonare_rt_engine_set_tempo(this.engine, Number(command.argFloat ?? 120));
        break;
      case 7 /* SetLoop */:
        this.module._sonare_rt_engine_set_loop(
          this.engine,
          Number(command.argFloat ?? 0),
          Number(command.argInt ?? 0) / 1e6,
          command.targetId ? 1 : 0,
        );
        break;
      case 13 /* ArmRecord */:
        this.module._sonare_rt_engine_set_capture_armed(this.engine, command.argInt ? 1 : 0);
        break;
      case 14 /* Punch */:
        this.module._sonare_rt_engine_set_capture_punch(
          this.engine,
          toBigInt64(command.argInt, 0n),
          BigInt(Math.max(0, Math.round(Number(command.argFloat ?? 0)))),
          1,
        );
        break;
      case 15 /* SetMetronome */:
        this.module._sonare_rt_engine_set_metronome_enabled(
          this.engine,
          command.argInt ? 1 : 0,
          this.metronomeConfig.beatGain,
          this.metronomeConfig.accentGain,
          this.metronomeConfig.clickSamples,
        );
        break;
      case 17 /* SeekMarker */:
        this.module._sonare_rt_engine_seek_marker(
          this.engine,
          Math.trunc(command.targetId ?? 0),
          sampleTime,
        );
        break;
      default:
        if (this.telemetryRing) {
          writeSonareEngineTelemetryRingBuffer(this.telemetryRing, {
            type: 1 /* Error */,
            error: 7 /* UnknownTarget */,
            renderFrame: 0,
            timelineSample: 0,
            audibleTimelineSample: 0,
            graphLatencySamplesQ8: 0,
            value: Number(command.type),
          });
        }
        break;
    }
  }
  publishTelemetry() {
    if (!this.telemetryRing) {
      this.module._sonare_rt_engine_drain_telemetry(
        this.engine,
        this.telemetryIntsPtr,
        this.telemetryFramesPtr,
        64,
      );
      return;
    }
    const count = this.module._sonare_rt_engine_drain_telemetry(
      this.engine,
      this.telemetryIntsPtr,
      this.telemetryFramesPtr,
      64,
    );
    const ints = new Int32Array(this.memory.buffer);
    const frames = new Float64Array(this.memory.buffer);
    const intBase = this.telemetryIntsPtr >> 2;
    const frameBase = this.telemetryFramesPtr >> 3;
    for (let i = 0; i < count; i++) {
      writeSonareEngineTelemetryRingBuffer(this.telemetryRing, {
        type: ints[intBase + i * 4],
        error: ints[intBase + i * 4 + 1],
        renderFrame: frames[frameBase + i * 3],
        timelineSample: frames[frameBase + i * 3 + 1],
        audibleTimelineSample: frames[frameBase + i * 3 + 2],
        graphLatencySamplesQ8: ints[intBase + i * 4 + 2],
        value: ints[intBase + i * 4 + 3],
      });
    }
  }
  commandRingFromSharedBuffer(sharedBuffer, fallbackCapacity) {
    const ring = engineRingFromSharedBuffer(
      sharedBuffer,
      SONARE_ENGINE_COMMAND_RECORD_BYTES,
      fallbackCapacity,
    );
    return { sharedBuffer, header: ring.header, view: ring.view, capacity: ring.capacity };
  }
  telemetryRingFromSharedBuffer(sharedBuffer, fallbackCapacity) {
    const ring = engineRingFromSharedBuffer(
      sharedBuffer,
      SONARE_ENGINE_TELEMETRY_RECORD_BYTES,
      fallbackCapacity,
    );
    return { sharedBuffer, header: ring.header, view: ring.view, capacity: ring.capacity };
  }
};
var SonareRealtimeEngineNode = class _SonareRealtimeEngineNode {
  constructor(node, capabilities, commandRing, telemetryRing, meterRing, scopeRing) {
    this.telemetryReadIndex = 0;
    this.meterReadIndex = 0;
    this.scopeReadIndex = 0;
    this.telemetryListeners = /* @__PURE__ */ new Set();
    this.meterListeners = /* @__PURE__ */ new Set();
    this.scopeListeners = /* @__PURE__ */ new Set();
    this.captureRequestId = 1;
    this.captureRequests = /* @__PURE__ */ new Map();
    this.transportRequestId = 1;
    this.transportRequests = /* @__PURE__ */ new Map();
    this.destroyed = false;
    this.node = node;
    this.capabilities = capabilities;
    this.commandRing = commandRing;
    this.telemetryRing = telemetryRing;
    this.meterRing = meterRing;
    this.scopeRing = scopeRing;
    this.ready = new Promise((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectReady = reject;
    });
    if (!capabilities.readyMessage) {
      this.resolveReady();
    }
    this.node.port.onmessage = (event) => {
      if (isEngineCaptureResponseMessage(event.data)) {
        const pending = this.captureRequests.get(event.data.requestId);
        if (pending) {
          this.captureRequests.delete(event.data.requestId);
          if (event.data.ok) {
            pending.resolve(event.data);
          } else {
            pending.reject(new Error(event.data.error ?? 'Capture request failed'));
          }
        }
      } else if (isEngineTransportResponseMessage(event.data)) {
        const pending = this.transportRequests.get(event.data.requestId);
        if (pending) {
          this.transportRequests.delete(event.data.requestId);
          if (event.data.ok) {
            pending.resolve(event.data);
          } else {
            pending.reject(new Error(event.data.error ?? 'Transport request failed'));
          }
        }
      } else if (isEngineTelemetryRecord(event.data)) {
        this.emitTelemetry(event.data);
      } else if (isMeterSnapshot(event.data)) {
        this.emitMeter(event.data);
      } else if (isRecord(event.data) && event.data.type === 'ready') {
        this.resolveReady();
      } else if (isRecord(event.data) && event.data.type === 'error') {
        this.rejectReady(new Error(String(event.data.message ?? 'AudioWorklet error')));
      }
    };
  }
  static async create(context, options = {}) {
    const runtimeTarget = options.runtimeTarget ?? 'embind';
    const processorName = options.processorName ?? 'sonare-realtime-engine-processor';
    const moduleUrl = options.moduleUrl;
    if (moduleUrl && context.audioWorklet?.addModule) {
      await context.audioWorklet.addModule(moduleUrl);
    }
    const detectedCapabilities =
      options.engineAbiVersion !== void 0
        ? {
            engineAbiVersion: options.engineAbiVersion,
            expectedEngineAbiVersion: options.expectedEngineAbiVersion ?? options.engineAbiVersion,
            abiCompatible:
              options.engineAbiVersion ===
              (options.expectedEngineAbiVersion ?? options.engineAbiVersion),
          }
        : runtimeTarget === 'embind'
          ? engineCapabilities()
          : void 0;
    if (options.requireAbiCompatible !== false && detectedCapabilities?.abiCompatible === false) {
      throw new Error(
        `Engine ABI mismatch: wasm=${detectedCapabilities.engineAbiVersion}, expected=${detectedCapabilities.expectedEngineAbiVersion}`,
      );
    }
    const sharedArrayBuffer = typeof globalThis.SharedArrayBuffer === 'function';
    const atomics = typeof globalThis.Atomics === 'object';
    const audioWorklet = typeof AudioWorkletNode !== 'undefined' || !!options.nodeFactory;
    const degradedReason =
      options.mode !== 'postMessage' && (!sharedArrayBuffer || !atomics)
        ? 'SharedArrayBuffer or Atomics unavailable; using postMessage transport.'
        : void 0;
    const mode =
      options.mode === 'postMessage' || !sharedArrayBuffer || !atomics ? 'postMessage' : 'sab';
    if (options.mode === 'sab' && mode !== 'sab') {
      throw new Error(
        'SharedArrayBuffer mode requested but SharedArrayBuffer/Atomics are unavailable.',
      );
    }
    const commandRing =
      mode === 'sab'
        ? createSonareEngineCommandRingBuffer(options.commandRingCapacity ?? 128)
        : void 0;
    const telemetryRing =
      mode === 'sab'
        ? createSonareEngineTelemetryRingBuffer(options.telemetryRingCapacity ?? 128)
        : void 0;
    const meterRing =
      mode === 'sab' && runtimeTarget === 'embind'
        ? createSonareMeterRingBuffer(options.meterRingCapacity ?? 128)
        : void 0;
    const scopeIntervalFrames = Math.max(0, Math.floor(options.scopeIntervalFrames ?? 0));
    const scopeRing =
      mode === 'sab' && runtimeTarget === 'embind' && scopeIntervalFrames > 0
        ? createSonareScopeRingBuffer(options.scopeRingCapacity ?? 64, options.scopeBands ?? 48)
        : void 0;
    const channelCount = Math.max(1, Math.floor(options.channelCount ?? 2));
    const processorOptions = {
      runtimeTarget,
      rtModuleUrl: options.rtModuleUrl,
      rtWasmBinary: options.rtWasmBinary,
      sampleRate: options.sampleRate ?? context.sampleRate,
      blockSize: options.blockSize,
      channelCount,
      commandSharedBuffer: commandRing?.sharedBuffer,
      commandRingCapacity: commandRing?.capacity,
      telemetrySharedBuffer: telemetryRing?.sharedBuffer,
      telemetryRingCapacity: telemetryRing?.capacity,
      meterSharedBuffer: meterRing?.sharedBuffer,
      meterRingCapacity: meterRing?.capacity,
      scopeSharedBuffer: scopeRing?.sharedBuffer,
      scopeRingCapacity: scopeRing?.capacity,
      scopeBands: scopeRing?.bands,
      scopeIntervalFrames: scopeRing ? scopeIntervalFrames : void 0,
      wasmBinary: options.wasmBinary,
      initialSyncMessages: options.initialSyncMessages,
      initialCommands: options.initialCommands,
    };
    const factory =
      options.nodeFactory ??
      ((ctx, name, nodeOptions) => new AudioWorkletNode(ctx, name, nodeOptions));
    const node = factory(context, processorName, {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [channelCount],
      processorOptions,
    });
    return new _SonareRealtimeEngineNode(
      node,
      {
        mode,
        runtimeTarget,
        sharedArrayBuffer,
        atomics,
        audioWorklet,
        engineAbiVersion: detectedCapabilities?.engineAbiVersion,
        expectedEngineAbiVersion: detectedCapabilities?.expectedEngineAbiVersion,
        abiCompatible: detectedCapabilities?.abiCompatible,
        degradedReason,
        readyMessage:
          runtimeTarget === 'sonare-rt' ||
          (runtimeTarget === 'embind' && moduleUrl !== void 0 && !options.nodeFactory),
      },
      commandRing,
      telemetryRing,
      meterRing,
      scopeRing,
    );
  }
  play(sampleTime = -1) {
    return this.sendCommand({ type: 2 /* TransportPlay */, sampleTime });
  }
  stop(sampleTime = -1) {
    return this.sendCommand({ type: 3 /* TransportStop */, sampleTime });
  }
  seekSample(timelineSample, sampleTime = -1) {
    return this.sendCommand({
      type: 4 /* TransportSeekSample */,
      sampleTime,
      argInt: timelineSample,
    });
  }
  seekPpq(ppq, sampleTime = -1) {
    return this.sendCommand({
      type: 5 /* TransportSeekPpq */,
      sampleTime,
      argFloat: ppq,
    });
  }
  sendCommand(command) {
    if (this.destroyed) {
      return false;
    }
    if (this.commandRing) {
      return pushSonareEngineCommandRingBuffer(this.commandRing, command);
    }
    this.node.port.postMessage(command);
    return true;
  }
  requestCaptureStatus() {
    return this.sendCaptureRequest('status').then((response) => {
      if (!response.status) {
        throw new Error('Capture status response is missing status.');
      }
      return response.status;
    });
  }
  requestCapturedAudio() {
    return this.sendCaptureRequest('read').then((response) =>
      (response.channels ?? []).map((channel) =>
        channel instanceof Float32Array ? channel : new Float32Array(channel),
      ),
    );
  }
  requestCaptureReset() {
    return this.sendCaptureRequest('reset').then(() => void 0);
  }
  requestTransportState() {
    return this.sendTransportRequest().then((response) => {
      if (!response.state) {
        throw new Error('Transport state response is missing state.');
      }
      return response.state;
    });
  }
  pollTelemetry() {
    if (!this.telemetryRing) {
      return [];
    }
    const read = readSonareEngineTelemetryRingBuffer(this.telemetryRing, this.telemetryReadIndex);
    this.telemetryReadIndex = read.nextReadIndex;
    for (const telemetry of read.telemetry) {
      this.emitTelemetry(telemetry);
    }
    return read.telemetry;
  }
  // Drains any meters published into the SAB meter ring (embind SAB mode) and
  // forwards them to onMeter listeners. In postMessage mode meters arrive via
  // node.port.onmessage instead, so this is a no-op then.
  pollMeters() {
    if (!this.meterRing) {
      return [];
    }
    const read = readSonareMeterRingBuffer(this.meterRing, this.meterReadIndex);
    this.meterReadIndex = read.nextReadIndex;
    for (const meter of read.meters) {
      this.emitMeter(meter);
    }
    return read.meters;
  }
  // Drains scope telemetry (FFT spectrum + goniometer points) published into the
  // SAB scope ring and forwards each record to onScope listeners. A no-op unless
  // the node was created with scopeIntervalFrames > 0 (embind SAB mode).
  pollScope() {
    if (!this.scopeRing) {
      return [];
    }
    const read = readSonareScopeRingBuffer(this.scopeRing, this.scopeReadIndex);
    this.scopeReadIndex = read.nextReadIndex;
    for (const scope of read.scopes) {
      this.emitScope(scope);
    }
    return read.scopes;
  }
  onTelemetry(callback) {
    this.telemetryListeners.add(callback);
    return () => {
      this.telemetryListeners.delete(callback);
    };
  }
  onMeter(callback) {
    this.meterListeners.add(callback);
    return () => {
      this.meterListeners.delete(callback);
    };
  }
  onScope(callback) {
    this.scopeListeners.add(callback);
    return () => {
      this.scopeListeners.delete(callback);
    };
  }
  destroy() {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.node.port.postMessage({ type: 3 /* TransportStop */, sampleTime: -1 });
    this.node.disconnect();
    for (const pending of this.captureRequests.values()) {
      pending.reject(new Error('Realtime engine node is destroyed.'));
    }
    this.captureRequests.clear();
    for (const pending of this.transportRequests.values()) {
      pending.reject(new Error('Realtime engine node is destroyed.'));
    }
    this.transportRequests.clear();
    this.telemetryListeners.clear();
    this.meterListeners.clear();
    this.scopeListeners.clear();
  }
  emitTelemetry(telemetry) {
    for (const listener of this.telemetryListeners) {
      listener(telemetry);
    }
  }
  emitMeter(meter) {
    for (const listener of this.meterListeners) {
      listener(meter);
    }
  }
  emitScope(scope) {
    for (const listener of this.scopeListeners) {
      listener(scope);
    }
  }
  sendCaptureRequest(op) {
    if (this.destroyed) {
      return Promise.reject(new Error('Realtime engine node is destroyed.'));
    }
    const requestId = this.captureRequestId++;
    const promise = new Promise((resolve, reject) => {
      this.captureRequests.set(requestId, { resolve, reject });
    });
    this.node.port.postMessage({ type: 'captureRequest', requestId, op });
    return promise;
  }
  sendTransportRequest() {
    if (this.destroyed) {
      return Promise.reject(new Error('Realtime engine node is destroyed.'));
    }
    const requestId = this.transportRequestId++;
    const promise = new Promise((resolve, reject) => {
      this.transportRequests.set(requestId, { resolve, reject });
    });
    this.node.port.postMessage({ type: 'transportRequest', requestId, op: 'state' });
    return promise;
  }
};
var SonareEngine = class _SonareEngine {
  constructor(
    context,
    realtimeNode,
    offlineEngine,
    sampleRate,
    offlineBlockSize,
    offlineChannelCount,
  ) {
    this.automationLanes = /* @__PURE__ */ new Map();
    this.clips = /* @__PURE__ */ new Map();
    this.midiClips = /* @__PURE__ */ new Map();
    this.markers = /* @__PURE__ */ new Map();
    this.trackLaneIds = [];
    this.trackSends = /* @__PURE__ */ new Map();
    this.trackOutputBus = /* @__PURE__ */ new Map();
    this.laneSidechains = /* @__PURE__ */ new Map();
    this.buses = [];
    this.trackStripJson = /* @__PURE__ */ new Map();
    this.busStripJson = /* @__PURE__ */ new Map();
    this.tempoBpm = 120;
    this.timeSignature = { numerator: 4, denominator: 4 };
    this.tempoSegments = [{ startPpq: 0, bpm: 120 }];
    this.timeSignatureSegments = [{ startPpq: 0, numerator: 4, denominator: 4 }];
    this.nextClipId = 1;
    this.nextMarkerId = 1;
    this.transportPlaying = false;
    this.pendingInstrumentSync = [];
    this.destroyed = false;
    this.context = context;
    this.realtimeNode = realtimeNode;
    this.offlineEngine = offlineEngine;
    this.node = realtimeNode.node;
    this.capabilities = realtimeNode.capabilities;
    this.sampleRate = sampleRate;
    this.offlineBlockSize = offlineBlockSize;
    this.offlineChannelCount = offlineChannelCount;
    this.transport = {
      play: (sampleTime = -1) => {
        const ok = this.realtimeNode.play(sampleTime);
        if (ok) {
          this.transportPlaying = true;
        }
        return ok;
      },
      stop: (sampleTime = -1) => {
        const ok = this.realtimeNode.stop(sampleTime);
        if (ok) {
          this.transportPlaying = false;
          this.flushPendingInstrumentSync();
        }
        return ok;
      },
      seekPpq: (ppq, sampleTime = -1) => {
        this.offlineEngine.seekPpq(ppq, sampleTime);
        return this.realtimeNode.seekPpq(ppq, sampleTime);
      },
      seekSeconds: (seconds, sampleTime = -1) => {
        const timelineSample = Math.max(0, Math.round(seconds * this.sampleRate));
        this.offlineEngine.seekSample(timelineSample, sampleTime);
        return this.realtimeNode.seekSample(timelineSample, sampleTime);
      },
      setTempo: (bpm) => this.setTempo(bpm),
      setTempoSegments: (segments) => this.setTempoSegments(segments),
      setLoop: (startPpq, endPpq, enabled = true) => this.setLoop(startPpq, endPpq, enabled),
    };
  }
  static async create(context, options = {}) {
    const sampleRate = options.sampleRate ?? context.sampleRate;
    const blockSize = options.offlineBlockSize ?? options.blockSize ?? 128;
    const channelCount = Math.max(
      1,
      Math.floor(options.offlineChannelCount ?? options.channelCount ?? 2),
    );
    const realtimeNode = await SonareRealtimeEngineNode.create(context, options);
    const offlineEngine = options.offlineEngine ?? new RealtimeEngine(sampleRate, blockSize);
    return new _SonareEngine(
      context,
      realtimeNode,
      offlineEngine,
      sampleRate,
      blockSize,
      channelCount,
    );
  }
  async suspend() {
    if (this.destroyed) {
      return;
    }
    await this.context.suspend?.();
  }
  async resume() {
    if (this.destroyed) {
      return;
    }
    await this.context.resume?.();
  }
  setTempo(bpm) {
    this.tempoBpm = bpm;
    this.tempoSegments = [{ startPpq: 0, bpm }];
    this.offlineEngine.setTempo(bpm);
    this.postTempoSync();
    this.realtimeNode.sendCommand({
      type: 6 /* SetTempoMap */,
      sampleTime: -1,
      argFloat: bpm,
    });
  }
  setTempoSegments(segments) {
    this.tempoSegments = segments.map((segment) => ({ ...segment }));
    this.tempoBpm = this.tempoSegments[0]?.bpm ?? this.tempoBpm;
    this.offlineEngine.setTempoSegments(this.tempoSegments);
    this.postTempoSync();
  }
  setTimeSignature(numerator, denominator) {
    this.timeSignature = { numerator, denominator };
    this.timeSignatureSegments = [{ startPpq: 0, numerator, denominator }];
    this.offlineEngine.setTimeSignature(numerator, denominator);
    this.postTempoSync();
  }
  setTimeSignatureSegments(segments) {
    this.timeSignatureSegments = segments.map((segment) => ({ ...segment }));
    const first = this.timeSignatureSegments[0];
    if (first) {
      this.timeSignature = { numerator: first.numerator, denominator: first.denominator };
    }
    this.offlineEngine.setTimeSignatureSegments(this.timeSignatureSegments);
    this.postTempoSync();
  }
  setLoop(startPpq, endPpq, enabled = true) {
    this.offlineEngine.setLoop(startPpq, endPpq, enabled);
    return this.realtimeNode.sendCommand({
      type: 7 /* SetLoop */,
      targetId: enabled ? 1 : 0,
      sampleTime: -1,
      argFloat: startPpq,
      argInt: Math.round(endPpq * 1e6),
    });
  }
  countInEndSample(startSample, bars) {
    return this.offlineEngine.countInEndSample(startSample, bars);
  }
  async getTransportState() {
    const state = await this.realtimeNode.requestTransportState();
    this.latestTransportState = state;
    return state;
  }
  cachedTransportState() {
    return this.latestTransportState;
  }
  setParam(nodeId, param, value) {
    const paramId = this.resolveParamId(nodeId, param);
    this.offlineEngine.setParameter(paramId, value);
    return this.realtimeNode.sendCommand({
      type: 0 /* SetParam */,
      targetId: paramId,
      sampleTime: -1,
      argFloat: value,
    });
  }
  scheduleParam(nodeId, param, ppq, value, curve = 'linear') {
    const paramId = this.resolveParamId(nodeId, param);
    const lane = this.automationLanes.get(paramId) ?? [];
    lane.push({ ppq, value, curveToNext: this.curveCode(curve) });
    lane.sort((a, b) => a.ppq - b.ppq);
    this.automationLanes.set(paramId, lane);
    this.offlineEngine.setAutomationLane(paramId, lane);
    this.postSync({ type: 'syncAutomation', paramId, points: lane });
  }
  addAutomationPoint(laneId, ppq, value, curve = 'linear') {
    this.scheduleParam('', laneId, ppq, value, curve);
  }
  /**
   * Replaces the automation lane for `paramId` with the given breakpoints.
   *
   * Unlike scheduleParam (which appends a single point), this sets the whole
   * lane at once; an empty array clears the lane. The points are defensively
   * copied and sorted by ppq before being mirrored to the offline engine and
   * the live worklet engine.
   *
   * @param paramId Automation target id (registered parameter or a reserved
   *   engine mixer target from automationParamId/busAutomationParamId).
   * @param points Lane breakpoints; order does not matter.
   */
  setAutomationLane(paramId, points) {
    const sorted = points.map((point) => ({ ...point })).sort((a, b) => a.ppq - b.ppq);
    if (sorted.length === 0) {
      this.automationLanes.delete(paramId);
    } else {
      this.automationLanes.set(paramId, sorted);
    }
    this.offlineEngine.setAutomationLane(paramId, sorted);
    this.postSync({ type: 'syncAutomation', paramId, points: sorted });
  }
  /**
   * Returns the automation target id for a mixer strip parameter.
   *
   * The id addresses the engine's reserved mixer namespace, so it can be fed
   * straight to setAutomationLane to automate a fader or pan without
   * registering a parameter.
   *
   * @param target Track id (declares a mixer lane on first use) or 'master'.
   * @param kind Strip parameter to address.
   * @returns Reserved engine parameter id for the strip parameter.
   */
  automationParamId(target, kind) {
    const paramKind = kind === 'pan' ? ENGINE_MIXER_PARAM_PAN : ENGINE_MIXER_PARAM_FADER_DB;
    if (target === 'master') {
      return engineMixerMasterTarget(paramKind);
    }
    return engineMixerLaneTarget(this.ensureTrackLane(target), paramKind);
  }
  /**
   * Returns the automation target id for a bus fader.
   *
   * @param busId Bus id (declares the mixer bus on first use).
   * @returns Reserved engine parameter id for the bus fader gain (dB).
   */
  busAutomationParamId(busId) {
    return engineMixerBusTarget(this.ensureBus(busId), ENGINE_MIXER_PARAM_FADER_DB);
  }
  /**
   * Returns the number of automation lanes installed on the engine, including
   * lanes whose breakpoint list is currently empty.
   *
   * @returns Engine-side automation lane count.
   */
  automationLaneCount() {
    return this.offlineEngine.automationLaneCount();
  }
  listParameters() {
    const parameters = [];
    for (let index = 0; index < this.offlineEngine.parameterCount(); index++) {
      parameters.push(this.offlineEngine.parameterInfoByIndex(index));
    }
    return parameters;
  }
  setSoloMute(target, solo, mute) {
    const laneIndex = this.ensureTrackLane(target);
    this.offlineEngine.setSoloMute(laneIndex, solo, mute);
    return this.realtimeNode.sendCommand({
      type: 10 /* SetSoloMute */,
      targetId: laneIndex,
      sampleTime: -1,
      argInt: (mute ? 1 : 0) | (solo ? 2 : 0),
    });
  }
  setStripGain(target, db) {
    if (target === 'master') {
      const paramId2 = engineMixerMasterTarget(ENGINE_MIXER_PARAM_FADER_DB);
      this.offlineEngine.setParameter(paramId2, db);
      return this.realtimeNode.sendCommand({
        type: 1 /* SetParamSmoothed */,
        targetId: paramId2,
        sampleTime: -1,
        argFloat: db,
      });
    }
    const laneIndex = this.ensureTrackLane(target);
    const paramId = engineMixerLaneTarget(laneIndex, ENGINE_MIXER_PARAM_FADER_DB);
    this.offlineEngine.setParameter(paramId, db);
    return this.realtimeNode.sendCommand({
      type: 1 /* SetParamSmoothed */,
      targetId: paramId,
      sampleTime: -1,
      argFloat: db,
    });
  }
  setStripPan(target, pan) {
    if (target === 'master') {
      const paramId2 = engineMixerMasterTarget(ENGINE_MIXER_PARAM_PAN);
      this.offlineEngine.setParameter(paramId2, pan);
      return this.realtimeNode.sendCommand({
        type: 1 /* SetParamSmoothed */,
        targetId: paramId2,
        sampleTime: -1,
        argFloat: pan,
      });
    }
    const laneIndex = this.ensureTrackLane(target);
    const paramId = engineMixerLaneTarget(laneIndex, ENGINE_MIXER_PARAM_PAN);
    this.offlineEngine.setParameter(paramId, pan);
    return this.realtimeNode.sendCommand({
      type: 1 /* SetParamSmoothed */,
      targetId: paramId,
      sampleTime: -1,
      argFloat: pan,
    });
  }
  /**
   * Declares the mixer track lanes in an explicit order.
   *
   * Lane indices are append-only: once a track id occupies a lane, its index
   * stays fixed for the engine's lifetime. The given list must therefore start
   * with the already-declared lane ids in their current order and may only
   * append new track ids after them. Entries carrying `sends` replace that
   * track's send list; entries without `sends` leave existing sends untouched.
   *
   * @param lanes Track ids or lane descriptors in the desired lane order.
   */
  setTrackLanes(lanes) {
    const entries = lanes.map((lane) => (typeof lane === 'number' ? { trackId: lane } : lane));
    const ids = [];
    for (const entry of entries) {
      if (!Number.isInteger(entry.trackId) || entry.trackId <= 0) {
        throw new Error(`Invalid track id for mixer lane: ${String(entry.trackId)}`);
      }
      ids.push(entry.trackId);
    }
    if (new Set(ids).size !== ids.length) {
      throw new Error('Duplicate track id in mixer lane list');
    }
    for (let index = 0; index < this.trackLaneIds.length; index++) {
      if (ids[index] !== this.trackLaneIds[index]) {
        throw new Error(
          'Mixer lanes are append-only: keep existing lanes in order and only append new track ids',
        );
      }
    }
    for (const entry of entries) {
      if (entry.sends) {
        this.trackSends.set(
          entry.trackId,
          entry.sends.map((send) => ({ ...send })),
        );
      }
      if (entry.outputBusId !== void 0) {
        if (entry.outputBusId === 0) {
          this.trackOutputBus.delete(entry.trackId);
        } else {
          this.trackOutputBus.set(entry.trackId, entry.outputBusId);
        }
      }
    }
    this.trackLaneIds.splice(0, this.trackLaneIds.length, ...ids);
    this.syncMixer();
  }
  /**
   * Routes a track lane's post-fader output into a declared bus instead of
   * the master mix (group/folder routing); busId 0 restores the master mix.
   */
  setTrackOutputBus(target, busId) {
    const laneIndex = this.ensureTrackLane(target);
    const trackId = this.trackLaneIds[laneIndex];
    if (busId === 0) {
      this.trackOutputBus.delete(trackId);
    } else {
      this.trackOutputBus.set(trackId, busId);
    }
    this.syncMixer();
  }
  /**
   * Keys one insert of a lane strip from another lane's post-strip pre-fader
   * audio (ducking/sidechainRouter inserts). sourceTarget null removes the
   * binding.
   */
  setLaneSidechain(target, insertIndex, sourceTarget) {
    const laneIndex = this.ensureTrackLane(target);
    const trackId = this.trackLaneIds[laneIndex];
    const key = `${trackId}:${insertIndex}`;
    let sourceTrackId = 0;
    if (sourceTarget !== null) {
      const sourceIndex = this.ensureTrackLane(sourceTarget);
      sourceTrackId = this.trackLaneIds[sourceIndex];
    }
    if (sourceTrackId === 0) {
      this.laneSidechains.delete(key);
    } else {
      this.laneSidechains.set(key, { trackId, insertIndex, sourceTrackId });
    }
    this.offlineEngine.setLaneSidechain(trackId, insertIndex, sourceTrackId);
    this.postSync({
      type: 'syncMixer',
      lanes: this.mixerLanes(),
      laneSidechains: [{ trackId, insertIndex, sourceTrackId }],
    });
  }
  setSends(target, sends) {
    const laneIndex = this.ensureTrackLane(target);
    const trackId = this.trackLaneIds[laneIndex];
    this.trackSends.set(
      trackId,
      sends.map((send) => ({ ...send })),
    );
    this.syncMixer();
  }
  setTrackBuses(buses) {
    this.buses.splice(0, this.buses.length, ...buses.map((bus) => ({ ...bus })));
    this.syncMixer();
  }
  setBusGain(busId, db) {
    const busIndex = this.ensureBus(busId);
    this.buses[busIndex] = { ...this.buses[busIndex], busId, gainDb: db };
    this.offlineEngine.setTrackBuses(this.buses);
    const paramId = engineMixerBusTarget(busIndex, ENGINE_MIXER_PARAM_FADER_DB);
    this.offlineEngine.setParameter(paramId, db);
    return this.realtimeNode.sendCommand({
      type: 1 /* SetParamSmoothed */,
      targetId: paramId,
      sampleTime: -1,
      argFloat: db,
    });
  }
  setTrackStripJson(target, sceneJson) {
    const laneIndex = this.ensureTrackLane(target);
    const trackId = this.trackLaneIds[laneIndex];
    this.offlineEngine.setTrackStripJson(trackId, sceneJson);
    this.trackStripJson.set(trackId, sceneJson);
    this.syncMixer();
  }
  setTrackStripEqBand(target, bandIndex, band) {
    const laneIndex = this.ensureTrackLane(target);
    const trackId = this.trackLaneIds[laneIndex];
    const bandJson = typeof band === 'string' ? band : JSON.stringify(band);
    this.offlineEngine.setTrackStripEqBandJson(trackId, bandIndex, bandJson);
    this.postSync({ type: 'syncTrackStripEqBand', trackId, bandIndex, bandJson });
  }
  setTrackStripInsertBypassed(target, insertIndex, bypassed, resetOnBypass = false) {
    const laneIndex = this.ensureTrackLane(target);
    const trackId = this.trackLaneIds[laneIndex];
    this.offlineEngine.setTrackStripInsertBypassed(trackId, insertIndex, bypassed, resetOnBypass);
    this.postSync({
      type: 'syncTrackStripInsertBypassed',
      trackId,
      insertIndex,
      bypassed,
      resetOnBypass,
    });
  }
  setTrackStripInsertParamByName(target, insertIndex, paramName, value) {
    const laneIndex = this.ensureTrackLane(target);
    const trackId = this.trackLaneIds[laneIndex];
    this.offlineEngine.setTrackStripInsertParamByName(trackId, insertIndex, paramName, value);
    this.postSync({
      type: 'syncTrackStripInsertParamByName',
      trackId,
      insertIndex,
      paramName,
      value,
    });
  }
  setTrackStripPan(target, pan) {
    const trackId = this.trackLaneIds[this.ensureTrackLane(target)];
    this.offlineEngine.setTrackStripPan(trackId, pan);
    this.postSync({ type: 'syncTrackStripPan', trackId, pan });
  }
  setTrackStripPanLaw(target, panLaw) {
    const trackId = this.trackLaneIds[this.ensureTrackLane(target)];
    const code = panLawCode(panLaw);
    this.offlineEngine.setTrackStripPanLaw(trackId, code);
    this.postSync({ type: 'syncTrackStripPanLaw', trackId, panLaw: code });
  }
  setTrackStripPanMode(target, panMode) {
    const trackId = this.trackLaneIds[this.ensureTrackLane(target)];
    const code = panModeCode(panMode);
    this.offlineEngine.setTrackStripPanMode(trackId, code);
    this.postSync({ type: 'syncTrackStripPanMode', trackId, panMode: code });
  }
  setTrackStripDualPan(target, leftPan, rightPan) {
    const trackId = this.trackLaneIds[this.ensureTrackLane(target)];
    this.offlineEngine.setTrackStripDualPan(trackId, leftPan, rightPan);
    this.postSync({ type: 'syncTrackStripDualPan', trackId, leftPan, rightPan });
  }
  setTrackStripChannelDelaySamples(target, delaySamples) {
    const trackId = this.trackLaneIds[this.ensureTrackLane(target)];
    this.offlineEngine.setTrackStripChannelDelaySamples(trackId, delaySamples);
    this.postSync({ type: 'syncTrackStripChannelDelaySamples', trackId, delaySamples });
  }
  setStripEq(target, bandIndex, band) {
    if (target === 'master') {
      this.setMasterStripEqBand(bandIndex, band);
      return;
    }
    this.setTrackStripEqBand(target, bandIndex, band);
  }
  setStripInsertBypassed(target, insertIndex, bypassed, resetOnBypass = false) {
    if (target === 'master') {
      this.setMasterStripInsertBypassed(insertIndex, bypassed, resetOnBypass);
      return;
    }
    this.setTrackStripInsertBypassed(target, insertIndex, bypassed, resetOnBypass);
  }
  setStripInserts(target, sceneJson) {
    if (target === 'master') {
      this.setMasterStripJson(sceneJson);
      return;
    }
    this.setTrackStripJson(target, sceneJson);
  }
  setBusStripJson(busId, sceneJson) {
    this.ensureBus(busId);
    this.offlineEngine.setBusStripJson(busId, sceneJson);
    this.busStripJson.set(busId, sceneJson);
    this.syncMixer();
  }
  setMasterStripJson(sceneJson) {
    this.offlineEngine.setMasterStripJson(sceneJson);
    this.masterStripJson = sceneJson;
    this.syncMixer();
  }
  setMasterStripEqBand(bandIndex, band) {
    const bandJson = typeof band === 'string' ? band : JSON.stringify(band);
    this.offlineEngine.setMasterStripEqBandJson(bandIndex, bandJson);
    this.postSync({ type: 'syncMasterStripEqBand', bandIndex, bandJson });
  }
  setMasterStripInsertBypassed(insertIndex, bypassed, resetOnBypass = false) {
    this.offlineEngine.setMasterStripInsertBypassed(insertIndex, bypassed, resetOnBypass);
    this.postSync({
      type: 'syncMasterStripInsertBypassed',
      insertIndex,
      bypassed,
      resetOnBypass,
    });
  }
  setMasterStripInsertParamByName(insertIndex, paramName, value) {
    this.offlineEngine.setMasterStripInsertParamByName(insertIndex, paramName, value);
    this.postSync({
      type: 'syncMasterStripInsertParamByName',
      insertIndex,
      paramName,
      value,
    });
  }
  setStripInsertParamByName(target, insertIndex, paramName, value) {
    if (target === 'master') {
      this.setMasterStripInsertParamByName(insertIndex, paramName, value);
      return;
    }
    this.setTrackStripInsertParamByName(target, insertIndex, paramName, value);
  }
  setMasterChain(sceneJson) {
    this.setMasterStripJson(sceneJson);
  }
  addClip(trackId, buffer, startPpq, opts = {}) {
    const id = opts.id ?? this.nextClipId++;
    const clip = {
      ...opts,
      id,
      channels: buffer,
      startPpq,
      trackId: this.resolveTargetId(trackId),
    };
    this.ensureTrackLane(trackId);
    this.clips.set(id, clip);
    this.syncClipsDelta([clip], []);
    return id;
  }
  removeClip(clipId) {
    this.clips.delete(clipId);
    this.syncClipsDelta([], [clipId]);
  }
  setMidiClips(clips) {
    this.midiClips.clear();
    for (const clip of clips) {
      const id = clip.id ?? this.nextClipId++;
      this.midiClips.set(id, { ...clip, id, events: clip.events.map((event) => ({ ...event })) });
    }
    this.syncMidiClips();
  }
  setBuiltinInstrument(trackId, config = {}) {
    const destinationId = this.resolveTargetId(trackId);
    this.offlineEngine.setBuiltinInstrument(config, destinationId);
    this.postInstrumentSync({ type: 'syncBuiltinInstrument', destinationId, config });
  }
  setSynthInstrument(trackId, patch = {}) {
    const destinationId = this.resolveTargetId(trackId);
    this.offlineEngine.setSynthInstrument(patch, destinationId);
    this.postInstrumentSync({ type: 'syncSynthInstrument', destinationId, patch });
  }
  loadSoundFont(data) {
    this.offlineEngine.loadSoundFont(data);
    this.postInstrumentSync({ type: 'syncLoadSoundFont', data });
  }
  setSf2Instrument(trackId, config = {}) {
    const destinationId = this.resolveTargetId(trackId);
    this.offlineEngine.setSf2Instrument(config, destinationId);
    this.postInstrumentSync({ type: 'syncSf2Instrument', destinationId, config });
  }
  pushMidiNoteOn(trackId, group, channel, note, velocity, renderFrame = -1) {
    const destinationId = this.resolveTargetId(trackId);
    this.offlineEngine.pushMidiNoteOn(destinationId, group, channel, note, velocity, renderFrame);
    this.postSync({
      type: 'syncMidiNoteOn',
      destinationId,
      group,
      channel,
      note,
      velocity,
      renderFrame,
    });
  }
  pushMidiNoteOff(trackId, group, channel, note, velocity = 0, renderFrame = -1) {
    const destinationId = this.resolveTargetId(trackId);
    this.offlineEngine.pushMidiNoteOff(destinationId, group, channel, note, velocity, renderFrame);
    this.postSync({
      type: 'syncMidiNoteOff',
      destinationId,
      group,
      channel,
      note,
      velocity,
      renderFrame,
    });
  }
  pushMidiCc(trackId, group, channel, controller, value, renderFrame = -1) {
    const destinationId = this.resolveTargetId(trackId);
    this.offlineEngine.pushMidiCc(destinationId, group, channel, controller, value, renderFrame);
    this.postSync({
      type: 'syncMidiCc',
      destinationId,
      group,
      channel,
      controller,
      value,
      renderFrame,
    });
  }
  pushMidiPanic(renderFrame = -1) {
    this.offlineEngine.pushMidiPanic(renderFrame);
    this.postSync({ type: 'syncMidiPanic', renderFrame });
  }
  configureCapture(options) {
    const bufferFrames = Math.trunc(options.bufferFrames);
    const channels = Math.trunc(options.channels ?? this.offlineChannelCount);
    const source = options.source ?? 'output';
    const recordOffsetSamples = Math.trunc(options.recordOffsetSamples ?? 0);
    const inputMonitor = {
      enabled: Boolean(options.inputMonitor?.enabled),
      gain: options.inputMonitor?.gain ?? 1,
    };
    this.offlineEngine.setCaptureBuffer(channels, bufferFrames);
    this.offlineEngine.setCaptureSource(source);
    this.offlineEngine.setRecordOffsetSamples(recordOffsetSamples);
    this.offlineEngine.setInputMonitor(inputMonitor.enabled, inputMonitor.gain);
    this.captureConfig = { bufferFrames, channels, source, recordOffsetSamples, inputMonitor };
    this.postSync({ type: 'syncCapture', ...this.captureConfig });
  }
  armRecord(trackId, enabled) {
    if (enabled && !this.captureConfig) {
      throw new Error('Capture buffer is not configured');
    }
    this.offlineEngine.armCapture(enabled);
    return this.realtimeNode.sendCommand({
      type: 13 /* ArmRecord */,
      targetId: this.resolveTargetId(trackId),
      sampleTime: -1,
      argInt: enabled ? 1 : 0,
    });
  }
  punch(inPpq, outPpq) {
    const inSample = this.offlineEngine.sampleAtPpq(inPpq);
    const outSample = this.offlineEngine.sampleAtPpq(outPpq);
    this.offlineEngine.setCapturePunch(inSample, outSample, true);
    return this.realtimeNode.sendCommand({
      type: 14 /* Punch */,
      sampleTime: -1,
      argInt: inSample,
      argFloat: outSample,
    });
  }
  captureStatus() {
    return this.realtimeNode.requestCaptureStatus();
  }
  capturedAudio() {
    return this.realtimeNode.requestCapturedAudio();
  }
  async resetCapture() {
    this.offlineEngine.resetCapture();
    await this.realtimeNode.requestCaptureReset();
  }
  setMetronome(opts) {
    this.offlineEngine.setMetronome(opts);
    this.postSync({ type: 'syncMetronome', config: opts });
    this.realtimeNode.sendCommand({
      type: 15 /* SetMetronome */,
      sampleTime: -1,
      argInt: opts.enabled ? 1 : 0,
    });
  }
  addMarker(ppq, name = '') {
    const id = this.nextMarkerId++;
    this.markers.set(id, { id, ppq, name });
    this.syncMarkers();
    return id;
  }
  /**
   * Replaces the whole marker set in one call.
   *
   * Entries without an `id` are assigned fresh ids; entries carrying an `id`
   * keep it (ids must be positive and unique within the list). Returns the
   * resolved markers in the order given, so a caller can map its own marker
   * identities to the engine ids used by `seekMarker`/`setLoopFromMarkers`.
   *
   * @param markers The full marker list (an empty list clears all markers).
   * @returns The markers with their resolved engine ids.
   */
  setMarkers(markers) {
    const resolved = [];
    const seen = /* @__PURE__ */ new Set();
    for (const marker of markers) {
      if (!Number.isFinite(marker.ppq)) {
        throw new Error(`Invalid marker ppq: ${String(marker.ppq)}`);
      }
      if (marker.id !== void 0) {
        if (!Number.isInteger(marker.id) || marker.id <= 0) {
          throw new Error(`Invalid marker id: ${String(marker.id)}`);
        }
        if (seen.has(marker.id)) {
          throw new Error(`Duplicate marker id: ${marker.id}`);
        }
      }
      const id = marker.id ?? this.nextMarkerId++;
      seen.add(id);
      if (id >= this.nextMarkerId) {
        this.nextMarkerId = id + 1;
      }
      resolved.push({ id, ppq: marker.ppq, name: marker.name ?? '' });
    }
    this.markers.clear();
    for (const marker of resolved) {
      this.markers.set(marker.id, marker);
    }
    this.syncMarkers();
    return resolved.map((marker) => ({ ...marker }));
  }
  markerCount() {
    return this.offlineEngine.markerCount();
  }
  markerByIndex(index) {
    return this.offlineEngine.markerByIndex(index);
  }
  marker(markerId) {
    return this.offlineEngine.marker(markerId);
  }
  seekMarker(markerId) {
    this.offlineEngine.seekMarker(markerId);
    return this.realtimeNode.sendCommand({
      type: 17 /* SeekMarker */,
      targetId: markerId,
      sampleTime: -1,
    });
  }
  setLoopFromMarkers(startMarkerId, endMarkerId) {
    this.offlineEngine.setLoopFromMarkers(startMarkerId, endMarkerId);
    const start = this.offlineEngine.marker(startMarkerId);
    const end = this.offlineEngine.marker(endMarkerId);
    return this.setLoop(start.ppq, end.ppq, true);
  }
  async renderOffline(totalFrames) {
    const frames = Math.max(0, Math.floor(totalFrames));
    const inputs = [];
    for (let ch = 0; ch < this.offlineChannelCount; ch++) {
      inputs.push(new Float32Array(frames));
    }
    return this.offlineEngine.renderOffline(inputs, this.offlineBlockSize);
  }
  onMeter(callback) {
    return this.realtimeNode.onMeter(callback);
  }
  onScope(callback) {
    return this.realtimeNode.onScope(callback);
  }
  onTelemetry(callback) {
    return this.realtimeNode.onTelemetry(callback);
  }
  pollTelemetry() {
    return this.realtimeNode.pollTelemetry();
  }
  pollMeters() {
    return this.realtimeNode.pollMeters();
  }
  pollScope() {
    return this.realtimeNode.pollScope();
  }
  destroy() {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.transport.stop();
    this.realtimeNode.pollTelemetry();
    this.realtimeNode.destroy();
    this.offlineEngine.destroy();
  }
  syncClipsDelta(upserts, removeIds) {
    const clips = Array.from(this.clips.values());
    this.offlineEngine.setClips(clips);
    this.postSync({
      type: 'syncClipsDelta',
      upserts,
      removeIds,
    });
  }
  syncMidiClips() {
    const clips = Array.from(this.midiClips.values());
    this.offlineEngine.setMidiClips(clips);
    this.postSync({ type: 'syncMidiClips', clips });
  }
  mixerLanes() {
    return this.trackLaneIds.map((trackId) => {
      const sends = this.trackSends.get(trackId);
      const outputBusId = this.trackOutputBus.get(trackId);
      return {
        trackId,
        ...(sends && sends.length > 0 ? { sends: sends.map((send) => ({ ...send })) } : {}),
        ...(outputBusId !== void 0 ? { outputBusId } : {}),
      };
    });
  }
  syncMixer() {
    const lanes = this.mixerLanes();
    const buses = this.buses.map((bus) => ({ ...bus }));
    this.offlineEngine.setTrackBuses(buses);
    if (lanes.length > 0) {
      this.offlineEngine.setTrackLanes(lanes);
    }
    const trackStrips = Array.from(this.trackStripJson, ([trackId, sceneJson]) => ({
      trackId,
      sceneJson,
    }));
    const busStrips = Array.from(this.busStripJson, ([busId, sceneJson]) => ({
      busId,
      sceneJson,
    }));
    this.postSync({
      type: 'syncMixer',
      lanes,
      buses,
      trackStrips,
      laneSidechains: Array.from(this.laneSidechains.values()),
      busStrips,
      masterStripJson: this.masterStripJson,
    });
  }
  syncMarkers() {
    const markers = Array.from(this.markers.values()).sort((a, b) => a.ppq - b.ppq);
    this.offlineEngine.setMarkers(markers);
    this.postSync({ type: 'syncMarkers', markers });
  }
  postInstrumentSync(message) {
    if (this.destroyed) {
      return;
    }
    if (this.transportPlaying) {
      this.pendingInstrumentSync.push(message);
      return;
    }
    this.postSync(message);
  }
  flushPendingInstrumentSync() {
    if (this.destroyed || this.pendingInstrumentSync.length === 0) {
      return;
    }
    const pending = this.pendingInstrumentSync.splice(0);
    for (const message of pending) {
      this.postSync(message);
    }
  }
  postTempoSync() {
    this.postSync({
      type: 'syncTempo',
      bpm: this.tempoBpm,
      timeSignature: { ...this.timeSignature },
      tempoSegments: this.tempoSegments.map((segment) => ({ ...segment })),
      timeSignatureSegments: this.timeSignatureSegments.map((segment) => ({ ...segment })),
    });
  }
  // Posts an out-of-band control-sync message to the worklet engine processor.
  // Sync messages use a string `type` so the worklet's message handler routes
  // them to receiveSync() (numeric `type` is reserved for SonareEngineCommandRecord).
  postSync(message) {
    if (this.destroyed) {
      return;
    }
    this.realtimeNode.node.port.postMessage(message);
  }
  resolveParamId(nodeId, param) {
    if (typeof param === 'number') {
      return param;
    }
    const byName = this.listParameters().find((info) => info.name === param);
    if (byName) {
      return byName.id;
    }
    return this.resolveTargetId(param || nodeId);
  }
  resolveTargetId(target) {
    if (typeof target === 'number') {
      return target;
    }
    const parsed = Number.parseInt(target, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  ensureTrackLane(target) {
    const trackId = this.resolveTargetId(target);
    if (!Number.isInteger(trackId) || trackId <= 0) {
      throw new Error(`Invalid track id for mixer lane: ${String(target)}`);
    }
    const existing = this.trackLaneIds.indexOf(trackId);
    if (existing >= 0) {
      return existing;
    }
    this.trackLaneIds.push(trackId);
    this.syncMixer();
    return this.trackLaneIds.length - 1;
  }
  ensureBus(busId) {
    const resolved = Math.trunc(busId);
    if (!Number.isInteger(resolved) || resolved <= 0) {
      throw new Error(`Invalid bus id for mixer bus: ${String(busId)}`);
    }
    const existing = this.buses.findIndex((bus) => bus.busId === resolved);
    if (existing >= 0) {
      return existing;
    }
    this.buses.push({ busId: resolved });
    this.syncMixer();
    return this.buses.length - 1;
  }
  curveCode(curve) {
    if (typeof curve === 'number') {
      return curve;
    }
    return curve === 'exponential' ? 1 : 0;
  }
};
var _SonareRealtimeVoiceChangerWorkletProcessor = class _SonareRealtimeVoiceChangerWorkletProcessor {
  constructor(options = {}) {
    this.destroyed = false;
    this.sampleRate = options.sampleRate ?? 48e3;
    this.blockSize = options.blockSize ?? 128;
    this.channelCount = Math.max(1, Math.floor(options.channelCount ?? 1));
    this.changer = new RealtimeVoiceChanger(options.preset ?? 'neutral-monitor');
    this.changer.prepare(this.sampleRate, this.blockSize, this.channelCount);
    this.monoInput = this.changer.getMonoInputBuffer(this.blockSize);
    this.monoOutput = this.changer.getMonoOutputBuffer(this.blockSize);
    this.planarChannels = [];
    if (this.channelCount > 1) {
      for (let ch = 0; ch < this.channelCount; ch++) {
        this.planarChannels.push(this.changer.getPlanarChannelBuffer(ch, this.blockSize));
      }
    }
  }
  /**
   * Handles a control-plane message from the main thread. Runs on the
   * AudioWorklet global scope but OUTSIDE of `process()` (i.e. outside the
   * realtime audio callback), so it is safe to perform JSON parsing and
   * DSP coefficient recomputation here. `setConfig` MUST NOT be deferred
   * into `process()` because that would block the audio thread for longer
   * than one render quantum (e.g. 128 samples / 44.1 kHz = ~2.9 ms).
   */
  receiveMessage(message) {
    if (this.destroyed) {
      return;
    }
    if (message.type === 'setConfig') {
      this.changer.setConfig(message.preset);
    } else if (message.type === 'reset') {
      this.changer.reset();
    } else if (message.type === 'destroy') {
      this.destroy();
    }
  }
  process(inputs, outputs) {
    const output = outputs[0];
    if (this.destroyed || !output || output.length === 0) {
      return !this.destroyed;
    }
    if (this.monoInput.byteLength === 0) {
      this.reacquireBuffers();
    }
    const input = inputs[0];
    const requestedFrames = output[0]?.length ?? 0;
    const requestedChannels = Math.min(this.channelCount, output.length);
    if (requestedFrames === 0 || requestedChannels === 0) {
      return true;
    }
    if (requestedChannels === 1) {
      const frames2 = this.ensureMonoCapacity(requestedFrames);
      const source = input?.[0];
      if (source) {
        this.monoInput.set(source.subarray(0, frames2));
      } else {
        this.monoInput.fill(0, 0, frames2);
      }
      this.changer.processMonoInto(
        this.monoInput.subarray(0, frames2),
        this.monoOutput.subarray(0, frames2),
      );
      output[0].set(this.monoOutput.subarray(0, frames2));
      return true;
    }
    const frames = this.ensureInterleavedCapacity(requestedFrames, requestedChannels);
    const channels = requestedChannels;
    for (let ch = 0; ch < channels; ch++) {
      const src = input?.[ch];
      const dst = this.planarChannels[ch];
      if (!dst) {
        continue;
      }
      if (src) {
        dst.set(src.subarray(0, frames));
      } else {
        dst.fill(0, 0, frames);
      }
    }
    this.changer.processPreparedPlanar(frames);
    for (let ch = 0; ch < channels; ch++) {
      const src = this.planarChannels[ch];
      if (src) {
        output[ch].set(src.subarray(0, frames));
      }
    }
    return true;
  }
  destroy() {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.changer.delete();
  }
  // Re-acquires the cached WASM-heap views after a memory-growth detachment.
  // The underlying C++ vectors are pre-warmed (ensure_*_capacity ran at prepare
  // time), so getMono*/getPlanar* return fresh views onto the SAME storage
  // without reallocating it.
  reacquireBuffers() {
    this.monoInput = this.changer.getMonoInputBuffer(this.blockSize);
    this.monoOutput = this.changer.getMonoOutputBuffer(this.blockSize);
    if (this.channelCount > 1) {
      for (let ch = 0; ch < this.channelCount; ch++) {
        this.planarChannels[ch] = this.changer.getPlanarChannelBuffer(ch, this.blockSize);
      }
    }
  }
  /**
   * Returns the number of frames we can actually process given the
   * pre-allocated capacity. If the host requests more frames than the
   * worst-case block size declared at construction time, we clamp to the
   * available capacity and warn once — we MUST NOT reallocate on the
   * realtime audio thread.
   */
  ensureMonoCapacity(frames) {
    const capacity = this.monoInput.length;
    if (frames <= capacity) {
      return frames;
    }
    if (!_SonareRealtimeVoiceChangerWorkletProcessor.warnedMonoOverflow) {
      _SonareRealtimeVoiceChangerWorkletProcessor.warnedMonoOverflow = true;
      console.warn(
        `SonareRealtimeVoiceChangerWorkletProcessor: requested ${frames} mono frames exceeds pre-allocated capacity ${capacity}; clamping. Increase blockSize at construction time to avoid this.`,
      );
    }
    return capacity;
  }
  /**
   * Same contract as ensureMonoCapacity but for the planar per-channel
   * scratch. Returns the number of frames that fit in the available capacity.
   */
  ensureInterleavedCapacity(frames, channels) {
    const capacity = this.planarChannels[0]?.length ?? 0;
    if (frames <= capacity) {
      return frames;
    }
    if (!_SonareRealtimeVoiceChangerWorkletProcessor.warnedInterleavedOverflow) {
      _SonareRealtimeVoiceChangerWorkletProcessor.warnedInterleavedOverflow = true;
      console.warn(
        `SonareRealtimeVoiceChangerWorkletProcessor: requested ${frames}x${channels} planar frames exceeds pre-allocated capacity ${capacity}; clamping. Increase blockSize or channelCount at construction time to avoid this.`,
      );
    }
    return capacity;
  }
};
_SonareRealtimeVoiceChangerWorkletProcessor.warnedMonoOverflow = false;
_SonareRealtimeVoiceChangerWorkletProcessor.warnedInterleavedOverflow = false;
var SonareRealtimeVoiceChangerWorkletProcessor = _SonareRealtimeVoiceChangerWorkletProcessor;
function registerSonareWorkletProcessor(name = 'sonare-worklet-processor') {
  const scope = globalThis;
  if (!scope.AudioWorkletProcessor || !scope.registerProcessor) {
    throw new Error('AudioWorkletProcessor is not available in this context.');
  }
  const Base = scope.AudioWorkletProcessor;
  class RegisteredSonareWorkletProcessor extends Base {
    constructor(options) {
      super();
      const port = this.port;
      this.bridge = new SonareWorkletProcessor(options?.processorOptions ?? { sceneJson: '' }, {
        postMessage: (message) => port?.postMessage?.(message),
      });
      const onMessage = (event) => {
        if (isWorkletMessage(event.data)) {
          this.bridge.receiveMessage(event.data);
        }
      };
      if (port?.addEventListener) {
        port.addEventListener('message', onMessage);
        port.start?.();
      } else if (port) {
        port.onmessage = onMessage;
      }
    }
    process(inputs, outputs) {
      return this.bridge.process(inputs, outputs);
    }
  }
  scope.registerProcessor(name, RegisteredSonareWorkletProcessor);
}
function registerSonareRealtimeVoiceChangerWorkletProcessor(
  name = 'sonare-realtime-voice-changer-processor',
) {
  const scope = globalThis;
  if (!scope.AudioWorkletProcessor || !scope.registerProcessor) {
    throw new Error('AudioWorkletProcessor is not available in this context.');
  }
  const Base = scope.AudioWorkletProcessor;
  class RegisteredSonareRealtimeVoiceChangerWorkletProcessor extends Base {
    constructor(options) {
      super();
      const port = this.port;
      this.bridge = new SonareRealtimeVoiceChangerWorkletProcessor(options?.processorOptions ?? {});
      const onMessage = (event) => {
        if (isRealtimeVoiceChangerMessage(event.data)) {
          this.bridge.receiveMessage(event.data);
        }
      };
      if (port?.addEventListener) {
        port.addEventListener('message', onMessage);
        port.start?.();
      } else if (port) {
        port.onmessage = onMessage;
      }
    }
    process(inputs, outputs) {
      return this.bridge.process(inputs, outputs);
    }
  }
  scope.registerProcessor(name, RegisteredSonareRealtimeVoiceChangerWorkletProcessor);
}
function registerSonareRealtimeEngineWorkletProcessor(name = 'sonare-realtime-engine-processor') {
  const scope = globalThis;
  if (!scope.AudioWorkletProcessor || !scope.registerProcessor) {
    throw new Error('AudioWorkletProcessor is not available in this context.');
  }
  const Base = scope.AudioWorkletProcessor;
  class RegisteredSonareRealtimeEngineWorkletProcessor extends Base {
    constructor(options) {
      super();
      this.pendingMessages = [];
      const port = this.port;
      const processorOptions = options?.processorOptions ?? {};
      if (processorOptions.runtimeTarget === 'sonare-rt') {
        void this.initializeSonareRt(processorOptions, port);
      } else {
        void this.initializeEmbind(processorOptions, port);
      }
      const onMessage = (event) => {
        if (!this.bridge && !this.rtBridge) {
          if (this.pendingMessages.length < 1024) {
            this.pendingMessages.push(event.data);
          }
          return;
        }
        if (isEngineCommandRecord(event.data)) {
          this.bridge?.receiveCommand(event.data);
          this.rtBridge?.receiveCommand(event.data);
        } else if (isEngineSyncMessage(event.data)) {
          this.bridge?.receiveSync(event.data);
          this.rtBridge?.receiveSync(event.data);
        } else if (isEngineCaptureRequestMessage(event.data)) {
          this.bridge?.receiveCaptureRequest(event.data);
          this.rtBridge?.receiveCaptureRequest(event.data, port);
        } else if (isEngineTransportRequestMessage(event.data)) {
          this.bridge?.receiveTransportRequest(event.data);
          this.rtBridge?.receiveTransportRequest(event.data, port);
        }
      };
      if (port?.addEventListener) {
        port.addEventListener('message', onMessage);
        port.start?.();
      } else if (port) {
        port.onmessage = onMessage;
      }
    }
    process(inputs, outputs) {
      if (this.rtBridge) {
        return this.rtBridge.process(inputs, outputs);
      }
      if (this.bridge) {
        return this.bridge.process(inputs, outputs);
      }
      const output = outputs[0];
      for (const channel of output ?? []) {
        channel.fill(0);
      }
      return true;
    }
    replayPendingMessages(port) {
      const messages = this.pendingMessages.splice(0);
      for (const data of messages) {
        if (isEngineCommandRecord(data)) {
          this.bridge?.receiveCommand(data);
          this.rtBridge?.receiveCommand(data);
        } else if (isEngineSyncMessage(data)) {
          this.bridge?.receiveSync(data);
          this.rtBridge?.receiveSync(data);
        } else if (isEngineCaptureRequestMessage(data)) {
          this.bridge?.receiveCaptureRequest(data);
          this.rtBridge?.receiveCaptureRequest(data, port);
        } else if (isEngineTransportRequestMessage(data)) {
          this.bridge?.receiveTransportRequest(data);
          this.rtBridge?.receiveTransportRequest(data, port);
        }
      }
    }
    async initializeEmbind(options, port) {
      try {
        const initPromise2 = globalThis.SonareEmbindInitPromise;
        if (initPromise2) {
          await initPromise2;
        }
        if (!isInitialized()) {
          const moduleFactory = globalThis.SonareEmbindModuleFactory;
          if (!moduleFactory) {
            throw new Error('embind realtime engine module is not initialized.');
          }
          await init({
            locateFile: (path) => path,
            wasmBinary: options.wasmBinary,
            moduleFactory,
          });
        }
        this.bridge = new SonareRealtimeEngineWorkletProcessor(options, {
          postMessage: (message) => port?.postMessage?.(message),
          onMeter: (meter) => port?.postMessage?.(meter),
        });
        for (const message of options.initialSyncMessages ?? []) {
          this.bridge.receiveSync(message);
        }
        for (const command of options.initialCommands ?? []) {
          this.bridge.receiveCommand(command);
        }
        this.replayPendingMessages(port);
        port?.postMessage?.({ type: 'ready', runtimeTarget: 'embind' });
      } catch (error) {
        port?.postMessage?.({
          type: 'error',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
    async initializeSonareRt(options, port) {
      try {
        if (!options.rtModuleUrl) {
          throw new Error('rtModuleUrl is required for sonare-rt AudioWorklet runtime.');
        }
        const rtModuleUrl = options.rtModuleUrl;
        const memory = new WebAssembly.Memory({ initial: 1024, maximum: 1024, shared: true });
        const globalFactory = globalThis.SonareRtModuleFactory;
        const moduleFactory = globalFactory
          ? { default: globalFactory }
          : await import(rtModuleUrl);
        const module2 = await moduleFactory.default({
          wasmMemory: memory,
          wasmBinary: options.rtWasmBinary,
          locateFile: (path) => rtModuleUrl.replace(/[^/]*$/, path),
        });
        this.rtBridge = new SonareRtRealtimeEngineRuntime({
          module: module2,
          memory,
          sampleRate: options.sampleRate,
          blockSize: options.blockSize,
          channelCount: options.channelCount,
          commandSharedBuffer: options.commandSharedBuffer,
          commandRingCapacity: options.commandRingCapacity,
          telemetrySharedBuffer: options.telemetrySharedBuffer,
          telemetryRingCapacity: options.telemetryRingCapacity,
        });
        this.replayPendingMessages(port);
        port?.postMessage?.({ type: 'ready', runtimeTarget: 'sonare-rt' });
      } catch (error) {
        port?.postMessage?.({
          type: 'error',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
  scope.registerProcessor(name, RegisteredSonareRealtimeEngineWorkletProcessor);
}

export {
  createSonareEngineCommandRingBuffer,
  createSonareEngineTelemetryRingBuffer,
  createSonareMeterRingBuffer,
  createSonareScopeRingBuffer,
  createSonareSpectrumRingBuffer,
  decodeFrame,
  encodeFrameHi,
  encodeFrameLo,
  init,
  isInitialized,
  popSonareEngineCommandRingBuffer,
  pushSonareEngineCommandRingBuffer,
  readSonareEngineTelemetryRingBuffer,
  readSonareMeterRingBuffer,
  readSonareScopeRingBuffer,
  readSonareSpectrumRingBuffer,
  registerSonareRealtimeEngineWorkletProcessor,
  registerSonareRealtimeVoiceChangerWorkletProcessor,
  registerSonareWorkletProcessor,
  SONARE_ENGINE_COMMAND_RECORD_BYTES,
  SONARE_ENGINE_RING_HEADER_INTS,
  SONARE_ENGINE_TELEMETRY_RECORD_BYTES,
  SONARE_METER_RING_HEADER_INTS,
  SONARE_METER_RING_RECORD_FLOATS,
  SONARE_SCOPE_RING_HEADER_INTS,
  SONARE_SPECTRUM_RING_HEADER_INTS,
  SonareEngine,
  SonareEngineCommandType,
  SonareEngineTelemetryError,
  SonareEngineTelemetryType,
  SonareRealtimeEngineNode,
  SonareRealtimeEngineWorkletProcessor,
  SonareRealtimeVoiceChangerWorkletProcessor,
  SonareRtRealtimeEngineRuntime,
  SonareWorkletProcessor,
  sonareEngineCommandRingBufferByteLength,
  sonareEngineTelemetryRingBufferByteLength,
  sonareMeterRingBufferByteLength,
  sonareScopeRingBufferByteLength,
  sonareSpectrumRingBufferByteLength,
  writeSonareEngineTelemetryRingBuffer,
};
