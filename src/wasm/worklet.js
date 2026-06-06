// src/module_state.ts
var wasmModule = null;
function setSonareModule(module2) {
  wasmModule = module2;
}
function getSonareModule() {
  if (!wasmModule) {
    throw new Error("Module not initialized. Call init() first.");
  }
  return wasmModule;
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
  return timing === "preFader" || timing === 0 ? 0 : 1;
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

// src/realtime_engine.ts
var EXPECTED_ENGINE_ABI_VERSION = 3;
function engineCapabilities() {
  const abiVersion = getSonareModule().engineAbiVersion();
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
  nativeExt() {
    return this.native;
  }
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
  setBuiltinInstrument(config = {}, destinationId = config.destinationId ?? 0) {
    this.nativeExt().setBuiltinInstrument(destinationId, config);
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
    this.nativeExt().setSynthInstrument(destinationId, patch);
  }
  /**
   * Load (parse) SoundFont 2 bytes into the engine so SF2 instruments can be
   * bound with {@link setSf2Instrument}. The host fetches the `.sf2` and
   * passes the raw bytes; they are copied into linear memory for the call and
   * not referenced afterwards. Replaces any previously loaded SoundFont.
   */
  loadSoundFont(data) {
    this.nativeExt().loadSoundFont(data);
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
    this.nativeExt().setSf2Instrument(destinationId, config);
  }
  clearMidiInstrument(destinationId = 0) {
    this.nativeExt().clearMidiInstrument(destinationId);
  }
  midiInstrumentCount() {
    return this.nativeExt().midiInstrumentCount();
  }
  /**
   * Bind a live MIDI CC to an engine automation parameter. The MIDI event still
   * reaches the destination instrument; when bound, its 7-bit value is also
   * mapped into [minValue, maxValue] for `paramId`.
   */
  bindMidiCc(channel, controller, paramId, options = {}) {
    this.nativeExt().bindMidiCc(
      channel,
      controller,
      paramId,
      options.minValue ?? 0,
      options.maxValue ?? 1
    );
  }
  clearMidiCcBindings() {
    this.nativeExt().clearMidiCcBindings();
  }
  midiCcBindingCount() {
    return this.nativeExt().midiCcBindingCount();
  }
  /** Install/replace a live non-destructive MIDI-FX insert for one destination. */
  setMidiFx(destinationId, configJson) {
    this.nativeExt().setMidiFx(destinationId, configJson);
  }
  clearMidiFx(destinationId = 0) {
    this.nativeExt().clearMidiFx(destinationId);
  }
  /** Enable the engine-owned live MIDI input source for a destination. */
  setMidiInputSource(destinationId = 0) {
    this.nativeExt().setMidiInputSource(destinationId);
  }
  clearMidiInputSource() {
    this.nativeExt().clearMidiInputSource();
  }
  midiInputPendingCount() {
    return this.nativeExt().midiInputPendingCount();
  }
  pushMidiInputNoteOn(group, channel, note, velocity, portTimeSamples = 0) {
    this.nativeExt().pushMidiInputNoteOn(group, channel, note, velocity, portTimeSamples);
  }
  pushMidiInputNoteOff(group, channel, note, velocity = 0, portTimeSamples = 0) {
    this.nativeExt().pushMidiInputNoteOff(group, channel, note, velocity, portTimeSamples);
  }
  pushMidiInputCc(group, channel, controller, value, portTimeSamples = 0) {
    this.nativeExt().pushMidiInputCc(group, channel, controller, value, portTimeSamples);
  }
  pushMidiNoteOn(destinationId, group, channel, note, velocity, renderFrame = -1) {
    this.nativeExt().pushMidiNoteOn(destinationId, group, channel, note, velocity, renderFrame);
  }
  pushMidiNoteOff(destinationId, group, channel, note, velocity = 0, renderFrame = -1) {
    this.nativeExt().pushMidiNoteOff(destinationId, group, channel, note, velocity, renderFrame);
  }
  /**
   * Queue an immediate (live) MIDI control change to a MIDI destination
   * (engine kMidiCcImmediate). `group`/`channel` are 0..15; `controller`/`value`
   * are 7-bit (0..127). `renderFrame` is the frame to fire at, or -1 for
   * immediate. Mirrors the Node/Python/C-ABI `pushMidiCc`.
   */
  pushMidiCc(destinationId, group, channel, controller, value, renderFrame = -1) {
    this.nativeExt().pushMidiCc(destinationId, group, channel, controller, value, renderFrame);
  }
  /**
   * Queue a MIDI panic (all-notes-off) releasing every sounding note at
   * `renderFrame` (-1 = immediate). Mirrors the C-ABI `pushMidiPanic`.
   */
  pushMidiPanic(renderFrame = -1) {
    this.nativeExt().pushMidiPanic(renderFrame);
  }
  /**
   * Remove all registered parameters (and their automation lanes). Control-thread
   * only; not realtime-safe. Mirrors the C-ABI `clearParameters`.
   */
  clearParameters() {
    this.nativeExt().clearParameters();
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
  createClipPageProvider(numChannels, numSamples, pageFrames) {
    const id = this.nativeExt().createClipPageProvider(numChannels, numSamples, pageFrames);
    return new ClipPageProvider(this, id);
  }
  supplyClipPage(providerId, pageIndex, channels) {
    this.nativeExt().supplyClipPage(providerId, pageIndex, channels);
  }
  clearClipPage(providerId, pageIndex) {
    this.nativeExt().clearClipPage(providerId, pageIndex);
  }
  destroyClipPageProvider(providerId) {
    this.nativeExt().destroyClipPageProvider(providerId);
  }
  popClipPageRequest() {
    return this.nativeExt().popClipPageRequest();
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

// src/worklet.ts
var SONARE_METER_RING_HEADER_INTS = 4;
var SONARE_METER_RING_RECORD_FLOATS = 7;
var SONARE_SPECTRUM_RING_HEADER_INTS = 5;
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
  SonareEngineCommandType2[SonareEngineCommandType2["SetParam"] = 0] = "SetParam";
  SonareEngineCommandType2[SonareEngineCommandType2["SetParamSmoothed"] = 1] = "SetParamSmoothed";
  SonareEngineCommandType2[SonareEngineCommandType2["TransportPlay"] = 2] = "TransportPlay";
  SonareEngineCommandType2[SonareEngineCommandType2["TransportStop"] = 3] = "TransportStop";
  SonareEngineCommandType2[SonareEngineCommandType2["TransportSeekSample"] = 4] = "TransportSeekSample";
  SonareEngineCommandType2[SonareEngineCommandType2["TransportSeekPpq"] = 5] = "TransportSeekPpq";
  SonareEngineCommandType2[SonareEngineCommandType2["SetTempoMap"] = 6] = "SetTempoMap";
  SonareEngineCommandType2[SonareEngineCommandType2["SetLoop"] = 7] = "SetLoop";
  SonareEngineCommandType2[SonareEngineCommandType2["SwapGraph"] = 8] = "SwapGraph";
  SonareEngineCommandType2[SonareEngineCommandType2["SwapAutomation"] = 9] = "SwapAutomation";
  SonareEngineCommandType2[SonareEngineCommandType2["SetSoloMute"] = 10] = "SetSoloMute";
  SonareEngineCommandType2[SonareEngineCommandType2["AddClip"] = 11] = "AddClip";
  SonareEngineCommandType2[SonareEngineCommandType2["RemoveClip"] = 12] = "RemoveClip";
  SonareEngineCommandType2[SonareEngineCommandType2["ArmRecord"] = 13] = "ArmRecord";
  SonareEngineCommandType2[SonareEngineCommandType2["Punch"] = 14] = "Punch";
  SonareEngineCommandType2[SonareEngineCommandType2["SetMetronome"] = 15] = "SetMetronome";
  SonareEngineCommandType2[SonareEngineCommandType2["SetMarker"] = 16] = "SetMarker";
  SonareEngineCommandType2[SonareEngineCommandType2["SeekMarker"] = 17] = "SeekMarker";
  return SonareEngineCommandType2;
})(SonareEngineCommandType || {});
var SonareEngineTelemetryType = /* @__PURE__ */ ((SonareEngineTelemetryType2) => {
  SonareEngineTelemetryType2[SonareEngineTelemetryType2["ProcessBlock"] = 0] = "ProcessBlock";
  SonareEngineTelemetryType2[SonareEngineTelemetryType2["Error"] = 1] = "Error";
  return SonareEngineTelemetryType2;
})(SonareEngineTelemetryType || {});
var SonareEngineTelemetryError = /* @__PURE__ */ ((SonareEngineTelemetryError2) => {
  SonareEngineTelemetryError2[SonareEngineTelemetryError2["None"] = 0] = "None";
  SonareEngineTelemetryError2[SonareEngineTelemetryError2["CommandQueueOverflow"] = 1] = "CommandQueueOverflow";
  SonareEngineTelemetryError2[SonareEngineTelemetryError2["PendingCommandOverflow"] = 2] = "PendingCommandOverflow";
  SonareEngineTelemetryError2[SonareEngineTelemetryError2["BoundaryOverflow"] = 3] = "BoundaryOverflow";
  SonareEngineTelemetryError2[SonareEngineTelemetryError2["TelemetryOverflow"] = 4] = "TelemetryOverflow";
  SonareEngineTelemetryError2[SonareEngineTelemetryError2["CaptureOverflow"] = 5] = "CaptureOverflow";
  SonareEngineTelemetryError2[SonareEngineTelemetryError2["MaxBlockExceeded"] = 6] = "MaxBlockExceeded";
  SonareEngineTelemetryError2[SonareEngineTelemetryError2["UnknownTarget"] = 7] = "UnknownTarget";
  SonareEngineTelemetryError2[SonareEngineTelemetryError2["NonRealtimeSafeParameter"] = 8] = "NonRealtimeSafeParameter";
  SonareEngineTelemetryError2[SonareEngineTelemetryError2["NotPrepared"] = 9] = "NotPrepared";
  SonareEngineTelemetryError2[SonareEngineTelemetryError2["NonQueueableCommand"] = 10] = "NonQueueableCommand";
  SonareEngineTelemetryError2[SonareEngineTelemetryError2["AutomationBindTargetOverflow"] = 11] = "AutomationBindTargetOverflow";
  SonareEngineTelemetryError2[SonareEngineTelemetryError2["StaleAutomationLanes"] = 12] = "StaleAutomationLanes";
  SonareEngineTelemetryError2[SonareEngineTelemetryError2["SmoothedParameterCapacity"] = 13] = "SmoothedParameterCapacity";
  return SonareEngineTelemetryError2;
})(SonareEngineTelemetryError || {});
var DEFAULT_METRONOME_CONFIG = {
  beatGain: 0.35,
  accentGain: 0.7,
  clickSamples: 96
};
function resolveMetronomeConfig(config) {
  return {
    beatGain: config.beatGain ?? DEFAULT_METRONOME_CONFIG.beatGain,
    accentGain: config.accentGain ?? DEFAULT_METRONOME_CONFIG.accentGain,
    clickSamples: config.clickSamples ?? DEFAULT_METRONOME_CONFIG.clickSamples
  };
}
function toDb(value) {
  return value > 0 ? 20 * Math.log10(value) : Number.NEGATIVE_INFINITY;
}
function isRecord(value) {
  return typeof value === "object" && value !== null;
}
function isWorkletMessage(value) {
  if (!isRecord(value) || typeof value.type !== "string") {
    return false;
  }
  return value.type === "scheduleInsertAutomation" || value.type === "setMeterInterval" || value.type === "destroy";
}
function isEngineCommandRecord(value) {
  return isRecord(value) && typeof value.type === "number";
}
function isEngineSyncMessage(value) {
  if (!isRecord(value) || typeof value.type !== "string") {
    return false;
  }
  return value.type === "syncClips" || value.type === "syncMarkers" || value.type === "syncMetronome" || value.type === "syncAutomation";
}
function isRealtimeVoiceChangerMessage(value) {
  if (!isRecord(value) || typeof value.type !== "string") {
    return false;
  }
  return value.type === "setConfig" || value.type === "reset" || value.type === "destroy";
}
function isEngineTelemetryRecord(value) {
  return isRecord(value) && typeof value.type === "number" && typeof value.error === "number" && typeof value.renderFrame === "number" && typeof value.timelineSample === "number" && typeof value.audibleTimelineSample === "number" && typeof value.graphLatencySamplesQ8 === "number" && typeof value.value === "number";
}
function isMeterSnapshot(value) {
  return isRecord(value) && value.type === "meter" && typeof value.frame === "number" && typeof value.peakDbL === "number" && typeof value.peakDbR === "number" && typeof value.rmsDbL === "number" && typeof value.rmsDbR === "number" && typeof value.correlation === "number";
}
function sonareMeterRingBufferByteLength(capacity) {
  const clampedCapacity = Math.max(1, Math.floor(capacity));
  return SONARE_METER_RING_HEADER_INTS * Int32Array.BYTES_PER_ELEMENT + clampedCapacity * SONARE_METER_RING_RECORD_FLOATS * Float32Array.BYTES_PER_ELEMENT;
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
  const nextReadIndex = Math.max(0, Math.min(readIndex, writeIndex));
  const firstReadable = Math.max(nextReadIndex, writeIndex - ring.capacity);
  const meters = [];
  for (let index = firstReadable; index < writeIndex; index++) {
    const offset = index % ring.capacity * SONARE_METER_RING_RECORD_FLOATS;
    meters.push({
      type: "meter",
      frame: decodeFrame(ring.records[offset], ring.records[offset + 6]),
      peakDbL: ring.records[offset + 1],
      peakDbR: ring.records[offset + 2],
      rmsDbL: ring.records[offset + 3],
      rmsDbR: ring.records[offset + 4],
      correlation: ring.records[offset + 5]
    });
  }
  return { nextReadIndex: writeIndex, meters };
}
function sonareSpectrumRingBufferByteLength(capacity, bands = 16) {
  const clampedCapacity = Math.max(1, Math.floor(capacity));
  const clampedBands = Math.max(1, Math.floor(bands));
  return SONARE_SPECTRUM_RING_HEADER_INTS * Int32Array.BYTES_PER_ELEMENT + clampedCapacity * (3 + clampedBands) * Float32Array.BYTES_PER_ELEMENT;
}
function createSonareSpectrumRingBuffer(capacity = 128, bands = 16) {
  const clampedCapacity = Math.max(1, Math.floor(capacity));
  const clampedBands = Math.max(1, Math.floor(bands));
  const sharedBuffer = new SharedArrayBuffer(
    sonareSpectrumRingBufferByteLength(clampedCapacity, clampedBands)
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
    bands: ring.bands
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
    const offset = index % ring.capacity * recordFloats;
    const values = new Float32Array(bands);
    values.set(ring.records.subarray(offset + 3, offset + 3 + bands));
    spectra.push({
      type: "spectrum",
      frame: decodeFrame(ring.records[offset], ring.records[offset + 1]),
      bands: values
    });
  }
  return { nextReadIndex: writeIndex, spectra };
}
function sonareEngineCommandRingBufferByteLength(capacity) {
  const clampedCapacity = Math.max(1, Math.floor(capacity));
  return SONARE_ENGINE_RING_HEADER_INTS * Int32Array.BYTES_PER_ELEMENT + clampedCapacity * SONARE_ENGINE_COMMAND_RECORD_BYTES;
}
function sonareEngineTelemetryRingBufferByteLength(capacity) {
  const clampedCapacity = Math.max(1, Math.floor(capacity));
  return SONARE_ENGINE_RING_HEADER_INTS * Int32Array.BYTES_PER_ELEMENT + clampedCapacity * SONARE_ENGINE_TELEMETRY_RECORD_BYTES;
}
function createSonareEngineCommandRingBuffer(capacity = 128) {
  const clampedCapacity = Math.max(1, Math.floor(capacity));
  const sharedBuffer = new SharedArrayBuffer(
    sonareEngineCommandRingBufferByteLength(clampedCapacity)
  );
  const ring = engineRingFromSharedBuffer(
    sharedBuffer,
    SONARE_ENGINE_COMMAND_RECORD_BYTES,
    clampedCapacity
  );
  return { sharedBuffer, header: ring.header, view: ring.view, capacity: ring.capacity };
}
function createSonareEngineTelemetryRingBuffer(capacity = 128) {
  const clampedCapacity = Math.max(1, Math.floor(capacity));
  const sharedBuffer = new SharedArrayBuffer(
    sonareEngineTelemetryRingBufferByteLength(clampedCapacity)
  );
  const ring = engineRingFromSharedBuffer(
    sharedBuffer,
    SONARE_ENGINE_TELEMETRY_RECORD_BYTES,
    clampedCapacity
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
    command
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
    recordOffset(readIndex, ring.capacity, SONARE_ENGINE_COMMAND_RECORD_BYTES)
  );
  Atomics.store(ring.header, 1, readIndex + 1);
  return command;
}
function writeSonareEngineTelemetryRingBuffer(ring, telemetry) {
  const writeIndex = Atomics.load(ring.header, 0);
  writeEngineTelemetryRecord(
    ring.view,
    recordOffset(writeIndex, ring.capacity, SONARE_ENGINE_TELEMETRY_RECORD_BYTES),
    telemetry
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
        recordOffset(index, ring.capacity, SONARE_ENGINE_TELEMETRY_RECORD_BYTES)
      )
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
    throw new Error("meterSharedBuffer is too small for the requested ring capacity.");
  }
  Atomics.store(header, 1, capacity);
  Atomics.store(header, 2, SONARE_METER_RING_RECORD_FLOATS);
  return {
    header,
    records: new Float32Array(
      sharedBuffer,
      headerBytes,
      capacity * SONARE_METER_RING_RECORD_FLOATS
    ),
    capacity
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
    throw new Error("spectrumSharedBuffer is too small for the requested ring capacity.");
  }
  Atomics.store(header, 1, capacity);
  Atomics.store(header, 2, recordFloats);
  Atomics.store(header, 3, bands);
  return {
    header,
    records: new Float32Array(sharedBuffer, headerBytes, capacity * recordFloats),
    capacity,
    bands,
    recordFloats
  };
}
function engineRingFromSharedBuffer(sharedBuffer, recordBytes, fallbackCapacity) {
  const headerBytes = SONARE_ENGINE_RING_HEADER_INTS * Int32Array.BYTES_PER_ELEMENT;
  const header = new Int32Array(sharedBuffer, 0, SONARE_ENGINE_RING_HEADER_INTS);
  const existingCapacity = Atomics.load(header, 2);
  const capacity = Math.max(1, Math.floor(existingCapacity || fallbackCapacity || 1));
  const minBytes = headerBytes + capacity * recordBytes;
  if (sharedBuffer.byteLength < minBytes) {
    throw new Error("engine SharedArrayBuffer is too small for the requested ring capacity.");
  }
  Atomics.store(header, 2, capacity);
  Atomics.store(header, 3, recordBytes);
  return {
    header,
    view: new DataView(sharedBuffer, headerBytes, capacity * recordBytes),
    capacity
  };
}
function recordOffset(index, capacity, recordBytes) {
  return index % capacity * recordBytes;
}
function toBigInt64(value, fallback) {
  if (typeof value === "bigint") {
    return value;
  }
  if (typeof value === "number") {
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
    argInt: Number(view.getBigInt64(offset + 24, true))
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
    value: view.getUint32(offset + 36, true)
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
    value: telemetry.value
  };
}
function meterFromEngine(meter) {
  return {
    type: "meter",
    frame: meter.renderFrame,
    peakDbL: meter.peakDbL,
    peakDbR: meter.peakDbR,
    rmsDbL: meter.rmsDbL,
    rmsDbR: meter.rmsDbR,
    correlation: meter.correlation
  };
}
function magnitudeToDb(value) {
  return value > 1e-12 ? 20 * Math.log10(value) : -120;
}
var SonareWorkletProcessor = class {
  constructor(options, transport) {
    this.closed = false;
    this.processedFrames = 0;
    this.lastMeterFrame = 0;
    this.lastSpectrumFrame = 0;
    if (!options.sceneJson) {
      throw new Error("sceneJson is required.");
    }
    this.sampleRate = options.sampleRate ?? 48e3;
    this.blockSize = options.blockSize ?? 128;
    this.meterIntervalFrames = Math.max(0, Math.floor(options.meterIntervalFrames ?? 2048));
    this.spectrumIntervalFrames = Math.max(0, Math.floor(options.spectrumIntervalFrames ?? 0));
    this.transport = transport;
    this.meterIntervalFrames = Math.max(0, Math.floor(options.meterIntervalFrames ?? 2048));
    this.meterRing = options.meterSharedBuffer ? meterRingFromSharedBuffer(options.meterSharedBuffer, options.meterRingCapacity) : void 0;
    this.spectrumRing = options.spectrumSharedBuffer ? spectrumRingFromSharedBuffer(
      options.spectrumSharedBuffer,
      options.spectrumRingCapacity,
      options.spectrumBands
    ) : void 0;
    const spectrumBandCount = this.spectrumRing?.bands ?? Math.max(1, options.spectrumBands ?? 16);
    this.spectrumBands = new Float32Array(spectrumBandCount);
    this.mixer = Mixer.fromSceneJson(options.sceneJson, this.sampleRate, this.blockSize);
    this.mixer.compile();
    const sceneStripCount = this.mixer.stripCount();
    const stripCount = options.stripCount ?? sceneStripCount;
    if (stripCount !== sceneStripCount) {
      throw new Error("stripCount must match the scene strip count.");
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
      this.realtime.outRight.subarray(0, usable)
    );
    this.publishSpectrum(
      this.realtime.outLeft.subarray(0, usable),
      this.realtime.outRight.subarray(0, usable)
    );
    return true;
  }
  receiveMessage(message) {
    if (this.closed) {
      return;
    }
    if (message.type === "destroy") {
      this.destroy();
      return;
    }
    if (message.type === "setMeterInterval") {
      this.meterIntervalFrames = Math.max(0, Math.floor(message.frames));
      return;
    }
    if (message.type === "scheduleInsertAutomation") {
      this.mixer.scheduleInsertAutomation(
        message.stripIndex,
        message.insertIndex,
        message.paramId,
        message.samplePos ?? this.processedFrames,
        message.value,
        message.curve ?? "linear"
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
      type: "meter",
      frame: this.processedFrames,
      peakDbL: toDb(peakL),
      peakDbR: toDb(peakR),
      rmsDbL: toDb(rmsL),
      rmsDbR: toDb(rmsR),
      correlation: denominator > 0 ? sumLR / denominator : 0
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
    const offset = writeIndex % ring.capacity * SONARE_METER_RING_RECORD_FLOATS;
    ring.records[offset] = encodeFrameLo(meter.frame);
    ring.records[offset + 1] = meter.peakDbL;
    ring.records[offset + 2] = meter.peakDbR;
    ring.records[offset + 3] = meter.rmsDbL;
    ring.records[offset + 4] = meter.rmsDbR;
    ring.records[offset + 5] = meter.correlation;
    ring.records[offset + 6] = encodeFrameHi(meter.frame);
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
      type: "spectrum",
      frame: this.processedFrames,
      bands: new Float32Array(this.spectrumBands)
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
        const phase = -2 * Math.PI * bin * i / n;
        real += sample * Math.cos(phase);
        imag += sample * Math.sin(phase);
      }
      this.spectrumBands[band] = magnitudeToDb(2 * Math.hypot(real, imag) / n);
    }
  }
  writeSpectrumRing(frame, bands) {
    const ring = this.spectrumRing;
    if (!ring) {
      return;
    }
    const writeIndex = Atomics.load(ring.header, 0);
    const offset = writeIndex % ring.capacity * ring.recordFloats;
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
    this.sampleRate = options.sampleRate ?? 48e3;
    this.blockSize = options.blockSize ?? 128;
    this.channelCount = Math.max(1, Math.floor(options.channelCount ?? 2));
    this.runtimeTarget = options.runtimeTarget ?? "embind";
    if (this.runtimeTarget === "sonare-rt") {
      throw new Error(
        'sonare-rt runtime is provided by the dedicated Emscripten AudioWorklet module; use SonareRealtimeEngineNode.create({ runtimeTarget: "sonare-rt", moduleUrl: ... }) to load it.'
      );
    }
    this.transport = transport;
    this.meterIntervalFrames = Math.max(0, Math.floor(options.meterIntervalFrames ?? 2048));
    this.commandRing = options.commandSharedBuffer ? this.commandRingFromSharedBuffer(options.commandSharedBuffer, options.commandRingCapacity) : void 0;
    this.telemetryRing = options.telemetrySharedBuffer ? this.telemetryRingFromSharedBuffer(
      options.telemetrySharedBuffer,
      options.telemetryRingCapacity
    ) : void 0;
    this.meterRing = options.meterSharedBuffer ? meterRingFromSharedBuffer(options.meterSharedBuffer, options.meterRingCapacity) : void 0;
    this.engine = new RealtimeEngine(this.sampleRate, this.blockSize);
    this.engine.prepareChannels(this.channelCount, this.blockSize);
    this.channelBuffers = new Array(this.channelCount);
    for (let ch = 0; ch < this.channelCount; ch++) {
      this.channelBuffers[ch] = this.engine.getChannelBuffer(ch, this.blockSize);
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
          `SonareRealtimeEngineWorkletProcessor: requested ${usableFrames} frames exceeds pre-allocated capacity ${this.blockSize}; clamping.`
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
      case "syncClips":
        this.engine.setClips(message.clips);
        break;
      case "syncMarkers":
        this.engine.setMarkers(message.markers);
        break;
      case "syncMetronome":
        this.metronomeConfig = resolveMetronomeConfig(message.config);
        this.engine.setMetronome(message.config);
        break;
      case "syncAutomation":
        this.engine.setAutomationLane(message.paramId, message.points);
        break;
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
          sampleTime
        );
        break;
      case 1 /* SetParamSmoothed */:
        this.engine.setParameterSmoothed(
          Math.trunc(Number(command.targetId ?? 0)),
          Number(command.argFloat ?? 0),
          sampleTime
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
          command.targetId !== 0
        );
        break;
      case 13 /* ArmRecord */:
        this.engine.armCapture(Boolean(command.argInt));
        break;
      case 14 /* Punch */:
        this.engine.setCapturePunch(
          Number(command.argInt ?? 0),
          Math.max(0, Math.round(Number(command.argFloat ?? 0))),
          true
        );
        break;
      case 15 /* SetMetronome */:
        this.engine.setMetronome({
          enabled: Boolean(command.argInt),
          beatGain: this.metronomeConfig.beatGain,
          accentGain: this.metronomeConfig.accentGain,
          clickSamples: this.metronomeConfig.clickSamples
        });
        break;
      case 17 /* SeekMarker */:
        this.engine.seekMarker(Math.trunc(Number(command.targetId ?? 0)), sampleTime);
        break;
      default:
        this.publishTelemetryRecord({
          type: 1 /* Error */,
          error: 7 /* UnknownTarget */,
          renderFrame: 0,
          timelineSample: 0,
          audibleTimelineSample: 0,
          graphLatencySamplesQ8: 0,
          value: Number(command.type)
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
  publishMeters() {
    if (this.meterIntervalFrames <= 0 || !this.transport && !this.meterRing) {
      return;
    }
    for (const item of this.engine.drainMeterTelemetry(64)) {
      const meter = meterFromEngine(item);
      if (meter.frame - this.lastMeterFrame < this.meterIntervalFrames) {
        continue;
      }
      this.lastMeterFrame = meter.frame;
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
    const offset = writeIndex % ring.capacity * SONARE_METER_RING_RECORD_FLOATS;
    ring.records[offset] = encodeFrameLo(meter.frame);
    ring.records[offset + 1] = meter.peakDbL;
    ring.records[offset + 2] = meter.peakDbR;
    ring.records[offset + 3] = meter.rmsDbL;
    ring.records[offset + 4] = meter.rmsDbR;
    ring.records[offset + 5] = meter.correlation;
    ring.records[offset + 6] = encodeFrameHi(meter.frame);
    Atomics.store(ring.header, 0, writeIndex + 1);
  }
  commandRingFromSharedBuffer(sharedBuffer, fallbackCapacity) {
    const ring = engineRingFromSharedBuffer(
      sharedBuffer,
      SONARE_ENGINE_COMMAND_RECORD_BYTES,
      fallbackCapacity
    );
    return { sharedBuffer, header: ring.header, view: ring.view, capacity: ring.capacity };
  }
  telemetryRingFromSharedBuffer(sharedBuffer, fallbackCapacity) {
    const ring = engineRingFromSharedBuffer(
      sharedBuffer,
      SONARE_ENGINE_TELEMETRY_RECORD_BYTES,
      fallbackCapacity
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
    this.commandRing = options.commandSharedBuffer ? this.commandRingFromSharedBuffer(options.commandSharedBuffer, options.commandRingCapacity) : void 0;
    this.telemetryRing = options.telemetrySharedBuffer ? this.telemetryRingFromSharedBuffer(
      options.telemetrySharedBuffer,
      options.telemetryRingCapacity
    ) : void 0;
    this.engine = this.module._sonare_rt_engine_create();
    if (this.engine <= 0) {
      throw new Error("failed to create sonare-rt engine");
    }
    if (this.module._sonare_rt_engine_prepare(
      this.engine,
      this.sampleRate,
      this.blockSize,
      1024,
      1024
    ) !== 1) {
      this.module._sonare_rt_engine_destroy(this.engine);
      throw new Error("failed to prepare sonare-rt engine");
    }
    this.channelPointerTable = this.module._malloc(
      this.channelCount * Uint32Array.BYTES_PER_ELEMENT
    );
    this.channelBuffers = [];
    for (let ch = 0; ch < this.channelCount; ch++) {
      this.channelBuffers.push(
        this.module._malloc(this.blockSize * Float32Array.BYTES_PER_ELEMENT)
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
      frames
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
      case "syncMetronome":
        this.metronomeConfig = resolveMetronomeConfig(message.config);
        this.module._sonare_rt_engine_set_metronome_enabled(
          this.engine,
          message.config.enabled ? 1 : 0,
          this.metronomeConfig.beatGain,
          this.metronomeConfig.accentGain,
          this.metronomeConfig.clickSamples
        );
        break;
      case "syncClips":
      case "syncMarkers":
      case "syncAutomation":
        if (this.telemetryRing) {
          writeSonareEngineTelemetryRingBuffer(this.telemetryRing, {
            type: 1 /* Error */,
            error: 7 /* UnknownTarget */,
            renderFrame: 0,
            timelineSample: 0,
            audibleTimelineSample: 0,
            graphLatencySamplesQ8: 0,
            value: 0
          });
        }
        break;
    }
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
            value: Number(command.type)
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
          sampleTime
        );
        break;
      case 5 /* TransportSeekPpq */:
        this.module._sonare_rt_engine_seek_ppq(
          this.engine,
          Number(command.argFloat ?? 0),
          sampleTime
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
          command.targetId ? 1 : 0
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
          1
        );
        break;
      case 15 /* SetMetronome */:
        this.module._sonare_rt_engine_set_metronome_enabled(
          this.engine,
          command.argInt ? 1 : 0,
          this.metronomeConfig.beatGain,
          this.metronomeConfig.accentGain,
          this.metronomeConfig.clickSamples
        );
        break;
      case 17 /* SeekMarker */:
        this.module._sonare_rt_engine_seek_marker(
          this.engine,
          Math.trunc(command.targetId ?? 0),
          sampleTime
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
            value: Number(command.type)
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
        64
      );
      return;
    }
    const count = this.module._sonare_rt_engine_drain_telemetry(
      this.engine,
      this.telemetryIntsPtr,
      this.telemetryFramesPtr,
      64
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
        value: ints[intBase + i * 4 + 3]
      });
    }
  }
  commandRingFromSharedBuffer(sharedBuffer, fallbackCapacity) {
    const ring = engineRingFromSharedBuffer(
      sharedBuffer,
      SONARE_ENGINE_COMMAND_RECORD_BYTES,
      fallbackCapacity
    );
    return { sharedBuffer, header: ring.header, view: ring.view, capacity: ring.capacity };
  }
  telemetryRingFromSharedBuffer(sharedBuffer, fallbackCapacity) {
    const ring = engineRingFromSharedBuffer(
      sharedBuffer,
      SONARE_ENGINE_TELEMETRY_RECORD_BYTES,
      fallbackCapacity
    );
    return { sharedBuffer, header: ring.header, view: ring.view, capacity: ring.capacity };
  }
};
var SonareRealtimeEngineNode = class _SonareRealtimeEngineNode {
  constructor(node, capabilities, commandRing, telemetryRing, meterRing) {
    this.telemetryReadIndex = 0;
    this.meterReadIndex = 0;
    this.telemetryListeners = /* @__PURE__ */ new Set();
    this.meterListeners = /* @__PURE__ */ new Set();
    this.destroyed = false;
    this.node = node;
    this.capabilities = capabilities;
    this.commandRing = commandRing;
    this.telemetryRing = telemetryRing;
    this.meterRing = meterRing;
    this.ready = new Promise((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectReady = reject;
    });
    if (capabilities.runtimeTarget !== "sonare-rt") {
      this.resolveReady();
    }
    this.node.port.onmessage = (event) => {
      if (isEngineTelemetryRecord(event.data)) {
        this.emitTelemetry(event.data);
      } else if (isMeterSnapshot(event.data)) {
        this.emitMeter(event.data);
      } else if (isRecord(event.data) && event.data.type === "ready") {
        this.resolveReady();
      } else if (isRecord(event.data) && event.data.type === "error") {
        this.rejectReady(new Error(String(event.data.message ?? "AudioWorklet error")));
      }
    };
  }
  static async create(context, options = {}) {
    const runtimeTarget = options.runtimeTarget ?? "embind";
    const processorName = options.processorName ?? "sonare-realtime-engine-processor";
    const moduleUrl = options.moduleUrl;
    if (moduleUrl && context.audioWorklet?.addModule) {
      await context.audioWorklet.addModule(moduleUrl);
    }
    const detectedCapabilities = options.engineAbiVersion !== void 0 ? {
      engineAbiVersion: options.engineAbiVersion,
      expectedEngineAbiVersion: options.expectedEngineAbiVersion ?? options.engineAbiVersion,
      abiCompatible: options.engineAbiVersion === (options.expectedEngineAbiVersion ?? options.engineAbiVersion)
    } : runtimeTarget === "embind" ? engineCapabilities() : void 0;
    if (options.requireAbiCompatible !== false && detectedCapabilities?.abiCompatible === false) {
      throw new Error(
        `Engine ABI mismatch: wasm=${detectedCapabilities.engineAbiVersion}, expected=${detectedCapabilities.expectedEngineAbiVersion}`
      );
    }
    const sharedArrayBuffer = typeof globalThis.SharedArrayBuffer === "function";
    const atomics = typeof globalThis.Atomics === "object";
    const audioWorklet = typeof AudioWorkletNode !== "undefined" || !!options.nodeFactory;
    const degradedReason = options.mode !== "postMessage" && (!sharedArrayBuffer || !atomics) ? "SharedArrayBuffer or Atomics unavailable; using postMessage transport." : void 0;
    const mode = options.mode === "postMessage" || !sharedArrayBuffer || !atomics ? "postMessage" : "sab";
    if (options.mode === "sab" && mode !== "sab") {
      throw new Error(
        "SharedArrayBuffer mode requested but SharedArrayBuffer/Atomics are unavailable."
      );
    }
    const commandRing = mode === "sab" ? createSonareEngineCommandRingBuffer(options.commandRingCapacity ?? 128) : void 0;
    const telemetryRing = mode === "sab" ? createSonareEngineTelemetryRingBuffer(options.telemetryRingCapacity ?? 128) : void 0;
    const meterRing = mode === "sab" && runtimeTarget === "embind" ? createSonareMeterRingBuffer(options.meterRingCapacity ?? 128) : void 0;
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
      meterRingCapacity: meterRing?.capacity
    };
    const factory = options.nodeFactory ?? ((ctx, name, nodeOptions) => new AudioWorkletNode(ctx, name, nodeOptions));
    const node = factory(context, processorName, {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [channelCount],
      processorOptions
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
        degradedReason
      },
      commandRing,
      telemetryRing,
      meterRing
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
      argInt: timelineSample
    });
  }
  seekPpq(ppq, sampleTime = -1) {
    return this.sendCommand({
      type: 5 /* TransportSeekPpq */,
      sampleTime,
      argFloat: ppq
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
  destroy() {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.node.port.postMessage({ type: 3 /* TransportStop */, sampleTime: -1 });
    this.node.disconnect();
    this.telemetryListeners.clear();
    this.meterListeners.clear();
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
};
var SonareEngine = class _SonareEngine {
  constructor(context, realtimeNode, offlineEngine, sampleRate, offlineBlockSize, offlineChannelCount) {
    this.automationLanes = /* @__PURE__ */ new Map();
    this.clips = /* @__PURE__ */ new Map();
    this.markers = /* @__PURE__ */ new Map();
    this.nextClipId = 1;
    this.nextMarkerId = 1;
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
      play: (sampleTime = -1) => this.realtimeNode.play(sampleTime),
      stop: (sampleTime = -1) => this.realtimeNode.stop(sampleTime),
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
      setLoop: (startPpq, endPpq, enabled = true) => this.setLoop(startPpq, endPpq, enabled)
    };
  }
  static async create(context, options = {}) {
    const sampleRate = options.sampleRate ?? context.sampleRate;
    const blockSize = options.offlineBlockSize ?? options.blockSize ?? 128;
    const channelCount = Math.max(
      1,
      Math.floor(options.offlineChannelCount ?? options.channelCount ?? 2)
    );
    const realtimeNode = await SonareRealtimeEngineNode.create(context, options);
    const offlineEngine = options.offlineEngine ?? new RealtimeEngine(sampleRate, blockSize);
    return new _SonareEngine(
      context,
      realtimeNode,
      offlineEngine,
      sampleRate,
      blockSize,
      channelCount
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
    this.offlineEngine.setTempo(bpm);
    this.realtimeNode.sendCommand({
      type: 6 /* SetTempoMap */,
      sampleTime: -1,
      argFloat: bpm
    });
  }
  setLoop(startPpq, endPpq, enabled = true) {
    this.offlineEngine.setLoop(startPpq, endPpq, enabled);
    return this.realtimeNode.sendCommand({
      type: 7 /* SetLoop */,
      targetId: enabled ? 1 : 0,
      sampleTime: -1,
      argFloat: startPpq,
      argInt: Math.round(endPpq * 1e6)
    });
  }
  setParam(nodeId, param, value) {
    const paramId = this.resolveParamId(nodeId, param);
    this.offlineEngine.setParameter(paramId, value);
    return this.realtimeNode.sendCommand({
      type: 0 /* SetParam */,
      targetId: paramId,
      sampleTime: -1,
      argFloat: value
    });
  }
  scheduleParam(nodeId, param, ppq, value, curve = "linear") {
    const paramId = this.resolveParamId(nodeId, param);
    const lane = this.automationLanes.get(paramId) ?? [];
    lane.push({ ppq, value, curveToNext: this.curveCode(curve) });
    lane.sort((a, b) => a.ppq - b.ppq);
    this.automationLanes.set(paramId, lane);
    this.offlineEngine.setAutomationLane(paramId, lane);
    this.postSync({ type: "syncAutomation", paramId, points: lane });
  }
  addAutomationPoint(laneId, ppq, value, curve = "linear") {
    this.scheduleParam("", laneId, ppq, value, curve);
  }
  listParameters() {
    const parameters = [];
    for (let index = 0; index < this.offlineEngine.parameterCount(); index++) {
      parameters.push(this.offlineEngine.parameterInfoByIndex(index));
    }
    return parameters;
  }
  setSoloMute(target, solo, mute) {
    void target;
    void solo;
    void mute;
    throw new Error(
      "SonareEngine.setSoloMute is not supported: solo/mute is a Mixer feature; use Mixer.setSoloed(stripIndex, ...) / Mixer.setMuted(stripIndex, ...) instead."
    );
  }
  addClip(trackId, buffer, startPpq, opts = {}) {
    const id = opts.id ?? this.nextClipId++;
    const clip = {
      ...opts,
      id,
      channels: buffer,
      startPpq
    };
    this.clips.set(id, clip);
    this.syncClips();
    void trackId;
    return id;
  }
  removeClip(clipId) {
    this.clips.delete(clipId);
    this.syncClips();
  }
  armRecord(trackId, enabled) {
    this.offlineEngine.armCapture(enabled);
    return this.realtimeNode.sendCommand({
      type: 13 /* ArmRecord */,
      targetId: this.resolveTargetId(trackId),
      sampleTime: -1,
      argInt: enabled ? 1 : 0
    });
  }
  punch(inPpq, outPpq) {
    const inSample = this.ppqToApproxSample(inPpq);
    const outSample = this.ppqToApproxSample(outPpq);
    this.offlineEngine.setCapturePunch(inSample, outSample, true);
    return this.realtimeNode.sendCommand({
      type: 14 /* Punch */,
      sampleTime: -1,
      argInt: inSample,
      argFloat: outSample
    });
  }
  setMetronome(opts) {
    this.offlineEngine.setMetronome(opts);
    this.postSync({ type: "syncMetronome", config: opts });
    this.realtimeNode.sendCommand({
      type: 15 /* SetMetronome */,
      sampleTime: -1,
      argInt: opts.enabled ? 1 : 0
    });
  }
  addMarker(ppq, name = "") {
    const id = this.nextMarkerId++;
    this.markers.set(id, { id, ppq, name });
    this.syncMarkers();
    return id;
  }
  seekMarker(markerId) {
    this.offlineEngine.seekMarker(markerId);
    return this.realtimeNode.sendCommand({
      type: 17 /* SeekMarker */,
      targetId: markerId,
      sampleTime: -1
    });
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
  onTelemetry(callback) {
    return this.realtimeNode.onTelemetry(callback);
  }
  pollTelemetry() {
    return this.realtimeNode.pollTelemetry();
  }
  pollMeters() {
    return this.realtimeNode.pollMeters();
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
  syncClips() {
    const clips = Array.from(this.clips.values());
    this.offlineEngine.setClips(clips);
    this.postSync({ type: "syncClips", clips });
  }
  syncMarkers() {
    const markers = Array.from(this.markers.values()).sort((a, b) => a.ppq - b.ppq);
    this.offlineEngine.setMarkers(markers);
    this.postSync({ type: "syncMarkers", markers });
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
    if (typeof param === "number") {
      return param;
    }
    const byName = this.listParameters().find((info) => info.name === param);
    if (byName) {
      return byName.id;
    }
    return this.resolveTargetId(param || nodeId);
  }
  resolveTargetId(target) {
    if (typeof target === "number") {
      return target;
    }
    const parsed = Number.parseInt(target, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  curveCode(curve) {
    if (typeof curve === "number") {
      return curve;
    }
    return curve === "exponential" ? 1 : 0;
  }
  ppqToApproxSample(ppq) {
    return Math.max(0, Math.round(ppq * 60 / 120 * this.sampleRate));
  }
};
var _SonareRealtimeVoiceChangerWorkletProcessor = class _SonareRealtimeVoiceChangerWorkletProcessor {
  constructor(options = {}) {
    this.destroyed = false;
    this.sampleRate = options.sampleRate ?? 48e3;
    this.blockSize = options.blockSize ?? 128;
    this.channelCount = Math.max(1, Math.floor(options.channelCount ?? 1));
    this.changer = new RealtimeVoiceChanger(options.preset ?? "neutral-monitor");
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
    if (message.type === "setConfig") {
      this.changer.setConfig(message.preset);
    } else if (message.type === "reset") {
      this.changer.reset();
    } else if (message.type === "destroy") {
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
        this.monoOutput.subarray(0, frames2)
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
        `SonareRealtimeVoiceChangerWorkletProcessor: requested ${frames} mono frames exceeds pre-allocated capacity ${capacity}; clamping. Increase blockSize at construction time to avoid this.`
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
        `SonareRealtimeVoiceChangerWorkletProcessor: requested ${frames}x${channels} planar frames exceeds pre-allocated capacity ${capacity}; clamping. Increase blockSize or channelCount at construction time to avoid this.`
      );
    }
    return capacity;
  }
};
_SonareRealtimeVoiceChangerWorkletProcessor.warnedMonoOverflow = false;
_SonareRealtimeVoiceChangerWorkletProcessor.warnedInterleavedOverflow = false;
var SonareRealtimeVoiceChangerWorkletProcessor = _SonareRealtimeVoiceChangerWorkletProcessor;
function registerSonareWorkletProcessor(name = "sonare-worklet-processor") {
  const scope = globalThis;
  if (!scope.AudioWorkletProcessor || !scope.registerProcessor) {
    throw new Error("AudioWorkletProcessor is not available in this context.");
  }
  const Base = scope.AudioWorkletProcessor;
  class RegisteredSonareWorkletProcessor extends Base {
    constructor(options) {
      super();
      const port = this.port;
      this.bridge = new SonareWorkletProcessor(options?.processorOptions ?? { sceneJson: "" }, {
        postMessage: (message) => port?.postMessage?.(message)
      });
      const onMessage = (event) => {
        if (isWorkletMessage(event.data)) {
          this.bridge.receiveMessage(event.data);
        }
      };
      if (port?.addEventListener) {
        port.addEventListener("message", onMessage);
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
function registerSonareRealtimeVoiceChangerWorkletProcessor(name = "sonare-realtime-voice-changer-processor") {
  const scope = globalThis;
  if (!scope.AudioWorkletProcessor || !scope.registerProcessor) {
    throw new Error("AudioWorkletProcessor is not available in this context.");
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
        port.addEventListener("message", onMessage);
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
function registerSonareRealtimeEngineWorkletProcessor(name = "sonare-realtime-engine-processor") {
  const scope = globalThis;
  if (!scope.AudioWorkletProcessor || !scope.registerProcessor) {
    throw new Error("AudioWorkletProcessor is not available in this context.");
  }
  const Base = scope.AudioWorkletProcessor;
  class RegisteredSonareRealtimeEngineWorkletProcessor extends Base {
    constructor(options) {
      super();
      const port = this.port;
      const processorOptions = options?.processorOptions ?? {};
      if (processorOptions.runtimeTarget === "sonare-rt") {
        void this.initializeSonareRt(processorOptions, port);
      } else {
        this.bridge = new SonareRealtimeEngineWorkletProcessor(processorOptions, {
          postMessage: (message) => port?.postMessage?.(message),
          onMeter: (meter) => port?.postMessage?.(meter)
        });
      }
      const onMessage = (event) => {
        if (isEngineCommandRecord(event.data)) {
          this.bridge?.receiveCommand(event.data);
          this.rtBridge?.receiveCommand(event.data);
        } else if (isEngineSyncMessage(event.data)) {
          this.bridge?.receiveSync(event.data);
          this.rtBridge?.receiveSync(event.data);
        }
      };
      if (port?.addEventListener) {
        port.addEventListener("message", onMessage);
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
    async initializeSonareRt(options, port) {
      try {
        if (!options.rtModuleUrl) {
          throw new Error("rtModuleUrl is required for sonare-rt AudioWorklet runtime.");
        }
        const rtModuleUrl = options.rtModuleUrl;
        const memory = new WebAssembly.Memory({ initial: 1024, maximum: 1024, shared: true });
        const globalFactory = globalThis.SonareRtModuleFactory;
        const moduleFactory = globalFactory ? { default: globalFactory } : await import(rtModuleUrl);
        const module2 = await moduleFactory.default({
          wasmMemory: memory,
          wasmBinary: options.rtWasmBinary,
          locateFile: (path) => rtModuleUrl.replace(/[^/]*$/, path)
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
          telemetryRingCapacity: options.telemetryRingCapacity
        });
        port?.postMessage?.({ type: "ready", runtimeTarget: "sonare-rt" });
      } catch (error) {
        port?.postMessage?.({
          type: "error",
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }
  scope.registerProcessor(name, RegisteredSonareRealtimeEngineWorkletProcessor);
}
export {
  SONARE_ENGINE_COMMAND_RECORD_BYTES,
  SONARE_ENGINE_RING_HEADER_INTS,
  SONARE_ENGINE_TELEMETRY_RECORD_BYTES,
  SONARE_METER_RING_HEADER_INTS,
  SONARE_METER_RING_RECORD_FLOATS,
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
  createSonareEngineCommandRingBuffer,
  createSonareEngineTelemetryRingBuffer,
  createSonareMeterRingBuffer,
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
  readSonareSpectrumRingBuffer,
  registerSonareRealtimeEngineWorkletProcessor,
  registerSonareRealtimeVoiceChangerWorkletProcessor,
  registerSonareWorkletProcessor,
  sonareEngineCommandRingBufferByteLength,
  sonareEngineTelemetryRingBufferByteLength,
  sonareMeterRingBufferByteLength,
  sonareSpectrumRingBufferByteLength,
  writeSonareEngineTelemetryRingBuffer
};
