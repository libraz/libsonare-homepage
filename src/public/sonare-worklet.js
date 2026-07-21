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

// src/worklet/engine-sync.ts
function buildMixerLanes(trackLaneIds, trackSends, trackOutputBus) {
  return trackLaneIds.map((trackId) => {
    const sends = trackSends.get(trackId);
    const outputBusId = trackOutputBus.get(trackId);
    return {
      trackId,
      ...sends && sends.length > 0 ? { sends: sends.map((send) => ({ ...send })) } : {},
      ...outputBusId !== void 0 ? { outputBusId } : {}
    };
  });
}
function buildTempoSync(tempoBpm, timeSignature, tempoSegments, timeSignatureSegments) {
  return {
    type: "syncTempo",
    bpm: tempoBpm,
    timeSignature: { ...timeSignature },
    tempoSegments: tempoSegments.map((segment) => ({ ...segment })),
    timeSignatureSegments: timeSignatureSegments.map((segment) => ({ ...segment }))
  };
}
function resolveTargetId(target) {
  if (typeof target === "number") {
    return target;
  }
  const parsed = Number.parseInt(target, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}
function resolveParamId(parameters, nodeId, param) {
  if (typeof param === "number") {
    return param;
  }
  const byName = parameters.find((info) => info.name === param);
  if (byName) {
    return byName.id;
  }
  return resolveTargetId(param || nodeId);
}
function curveCode(curve) {
  if (typeof curve === "number") {
    return curve;
  }
  return curve === "exponential" ? 1 : 0;
}

// src/worklet/engine-automation.ts
function scheduleParam(ctx, nodeId, param, ppq, value, curve = "linear") {
  const paramId = ctx.resolveParamId(nodeId, param);
  const lane = ctx.automationLanes.get(paramId) ?? [];
  lane.push({ ppq, value, curveToNext: curveCode(curve) });
  lane.sort((a, b) => a.ppq - b.ppq);
  ctx.automationLanes.set(paramId, lane);
  ctx.offlineEngine.setAutomationLane(paramId, lane);
  ctx.postSync({ type: "syncAutomation", paramId, points: lane });
}
function addAutomationPoint(ctx, laneId, ppq, value, curve = "linear") {
  scheduleParam(ctx, "", laneId, ppq, value, curve);
}
function setAutomationLane(ctx, paramId, points) {
  const sorted = points.map((point) => ({ ...point })).sort((a, b) => a.ppq - b.ppq);
  if (sorted.length === 0) {
    ctx.automationLanes.delete(paramId);
  } else {
    ctx.automationLanes.set(paramId, sorted);
  }
  ctx.offlineEngine.setAutomationLane(paramId, sorted);
  ctx.postSync({ type: "syncAutomation", paramId, points: sorted });
}

// src/worklet/engine-offline.ts
function buildCaptureConfig(options, defaultChannels) {
  return {
    bufferFrames: Math.trunc(options.bufferFrames),
    channels: Math.trunc(options.channels ?? defaultChannels),
    source: options.source ?? "output",
    recordOffsetSamples: Math.trunc(options.recordOffsetSamples ?? 0),
    inputMonitor: {
      enabled: Boolean(options.inputMonitor?.enabled),
      gain: options.inputMonitor?.gain ?? 1
    }
  };
}
function buildTransportFacade(ctx) {
  return {
    play: (sampleTime = -1) => {
      const ok = ctx.realtimeNode.play(sampleTime);
      if (ok) {
        ctx.setTransportPlaying(true);
      }
      return ok;
    },
    stop: (sampleTime = -1) => {
      const ok = ctx.realtimeNode.stop(sampleTime);
      if (ok) {
        ctx.setTransportPlaying(false);
        ctx.flushPendingInstrumentSync();
      }
      return ok;
    },
    seekPpq: (ppq, sampleTime = -1) => {
      ctx.offlineEngine.seekPpq(ppq, sampleTime);
      return ctx.realtimeNode.seekPpq(ppq, sampleTime);
    },
    seekSeconds: (seconds, sampleTime = -1) => {
      const timelineSample = Math.max(0, Math.round(seconds * ctx.sampleRate));
      ctx.offlineEngine.seekSample(timelineSample, sampleTime);
      return ctx.realtimeNode.seekSample(timelineSample, sampleTime);
    },
    setTempo: (bpm) => ctx.setTempo(bpm),
    setTempoSegments: (segments) => ctx.setTempoSegments(segments),
    setLoop: (startPpq, endPpq, enabled = true) => ctx.setLoop(startPpq, endPpq, enabled)
  };
}
function normalizeTrackLanes(existing, lanes) {
  const entries = lanes.map((lane) => typeof lane === "number" ? { trackId: lane } : lane);
  const ids = [];
  for (const entry of entries) {
    if (!Number.isInteger(entry.trackId) || entry.trackId <= 0) {
      throw new Error(`Invalid track id for mixer lane: ${String(entry.trackId)}`);
    }
    ids.push(entry.trackId);
  }
  if (new Set(ids).size !== ids.length) {
    throw new Error("Duplicate track id in mixer lane list");
  }
  for (let index = 0; index < existing.length; index++) {
    if (ids[index] !== existing[index]) {
      throw new Error(
        "Mixer lanes are append-only: keep existing lanes in order and only append new track ids"
      );
    }
  }
  return { entries, ids };
}
function resolveMarkerSet(markers, nextMarkerId) {
  const resolved = [];
  const seen = /* @__PURE__ */ new Set();
  let counter = nextMarkerId;
  for (const marker2 of markers) {
    if (!Number.isFinite(marker2.ppq)) {
      throw new Error(`Invalid marker ppq: ${String(marker2.ppq)}`);
    }
    if (marker2.id !== void 0) {
      if (!Number.isInteger(marker2.id) || marker2.id <= 0) {
        throw new Error(`Invalid marker id: ${String(marker2.id)}`);
      }
      if (seen.has(marker2.id)) {
        throw new Error(`Duplicate marker id: ${marker2.id}`);
      }
    }
    const id = marker2.id ?? counter++;
    seen.add(id);
    if (id >= counter) {
      counter = id + 1;
    }
    resolved.push({ id, ppq: marker2.ppq, name: marker2.name ?? "" });
  }
  return { resolved, nextMarkerId: counter };
}

// src/worklet/protocol.ts
var ENGINE_MIXER_TARGET_BASE = 1297612800;
var ENGINE_MIXER_PARAM_FADER_DB = 1;
var ENGINE_MIXER_PARAM_PAN = 2;
function engineMixerLaneTarget(laneIndex, paramKind) {
  return ENGINE_MIXER_TARGET_BASE | (laneIndex & 255) << 8 | paramKind & 255;
}
function engineMixerBusTarget(busIndex, paramKind) {
  return ENGINE_MIXER_TARGET_BASE | (254 - busIndex & 255) << 8 | paramKind & 255;
}
function engineMixerMasterTarget(paramKind) {
  return ENGINE_MIXER_TARGET_BASE | 255 << 8 | paramKind & 255;
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
  SonareEngineTelemetryError2[SonareEngineTelemetryError2["CommandBacklogDeferred"] = 14] = "CommandBacklogDeferred";
  SonareEngineTelemetryError2[SonareEngineTelemetryError2["ClipPageUnderrun"] = 15] = "ClipPageUnderrun";
  SonareEngineTelemetryError2[SonareEngineTelemetryError2["InsertAutomationOverflow"] = 16] = "InsertAutomationOverflow";
  return SonareEngineTelemetryError2;
})(SonareEngineTelemetryError || {});
function toDb(value) {
  return value > 0 ? 20 * Math.log10(value) : Number.NEGATIVE_INFINITY;
}
function isRecord(value) {
  return typeof value === "object" && value !== null;
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
  const recordFloats = Atomics.load(ring.header, 2) || SONARE_METER_RING_RECORD_FLOATS;
  const nextReadIndex = Math.max(0, Math.min(readIndex, writeIndex));
  const firstReadable = Math.max(nextReadIndex, writeIndex - ring.capacity);
  const meters = [];
  for (let index = firstReadable; index < writeIndex; index++) {
    const offset = index % ring.capacity * recordFloats;
    meters.push({
      type: "meter",
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
      gainReductionDb: ring.records[offset + 13]
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
function sonareScopeRingRecordFloats(bands, maxPoints) {
  return SONARE_SCOPE_RING_RECORD_PREFIX_FLOATS + bands + 2 * maxPoints;
}
function sonareScopeRingBufferByteLength(capacity, bands = 48, maxPoints = 32) {
  const clampedCapacity = Math.max(1, Math.floor(capacity));
  const clampedBands = Math.max(1, Math.floor(bands));
  const clampedPoints = Math.max(0, Math.floor(maxPoints));
  return SONARE_SCOPE_RING_HEADER_INTS * Int32Array.BYTES_PER_ELEMENT + clampedCapacity * sonareScopeRingRecordFloats(clampedBands, clampedPoints) * Float32Array.BYTES_PER_ELEMENT;
}
function createSonareScopeRingBuffer(capacity = 64, bands = 48, maxPoints = 32) {
  const clampedCapacity = Math.max(1, Math.floor(capacity));
  const clampedBands = Math.max(1, Math.floor(bands));
  const clampedPoints = Math.max(0, Math.floor(maxPoints));
  const sharedBuffer = new SharedArrayBuffer(
    sonareScopeRingBufferByteLength(clampedCapacity, clampedBands, clampedPoints)
  );
  const ring = scopeRingFromSharedBuffer(
    sharedBuffer,
    clampedCapacity,
    clampedBands,
    clampedPoints
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
    maxPoints: ring.maxPoints
  };
}
function readSonareScopeRingBuffer(ring, readIndex = 0) {
  const writeIndex = Atomics.load(ring.header, 0);
  const bands = Atomics.load(ring.header, 3) || ring.bands;
  const maxPoints = Atomics.load(ring.header, 4);
  const recordFloats = Atomics.load(ring.header, 2) || sonareScopeRingRecordFloats(bands, maxPoints);
  const nextReadIndex = Math.max(0, Math.min(readIndex, writeIndex));
  const firstReadable = Math.max(nextReadIndex, writeIndex - ring.capacity);
  const scopes = [];
  for (let index = firstReadable; index < writeIndex; index++) {
    const offset = index % ring.capacity * recordFloats;
    const bandCount = Math.min(bands, Math.max(0, ring.records[offset + 3]));
    const pointCount = Math.min(maxPoints, Math.max(0, ring.records[offset + 4]));
    const bandsView = new Float32Array(bandCount);
    bandsView.set(
      ring.records.subarray(
        offset + SONARE_SCOPE_RING_RECORD_PREFIX_FLOATS,
        offset + SONARE_SCOPE_RING_RECORD_PREFIX_FLOATS + bandCount
      )
    );
    const pointsBase = offset + SONARE_SCOPE_RING_RECORD_PREFIX_FLOATS + bands;
    const pointsView = new Float32Array(pointCount * 2);
    pointsView.set(ring.records.subarray(pointsBase, pointsBase + pointCount * 2));
    scopes.push({
      type: "scope",
      frame: decodeFrame(ring.records[offset], ring.records[offset + 1]),
      targetId: ring.records[offset + 2],
      bands: bandsView,
      points: pointsView
    });
  }
  return { nextReadIndex: writeIndex, scopes };
}
function scopeRingFromSharedBuffer(sharedBuffer, fallbackCapacity, fallbackBands, fallbackMaxPoints) {
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
    throw new Error("scopeSharedBuffer is too small for the requested ring capacity.");
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
    recordFloats
  };
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
    gainReductionDb: meter.gainReductionDb
  };
}
function magnitudeToDb(value) {
  return value > 1e-12 ? 20 * Math.log10(value) : -120;
}

// src/worklet/engine-capture-facade.ts
function configureCapture(ctx, options) {
  const config = buildCaptureConfig(options, ctx.offlineChannelCount);
  ctx.offlineEngine.setCaptureBuffer(config.channels, config.bufferFrames);
  ctx.offlineEngine.setCaptureSource(config.source);
  ctx.offlineEngine.setRecordOffsetSamples(config.recordOffsetSamples);
  ctx.offlineEngine.setInputMonitor(config.inputMonitor.enabled, config.inputMonitor.gain);
  ctx.setCaptureConfig(config);
  ctx.postSync({ type: "syncCapture", ...config });
}
function armRecord(ctx, trackId, enabled) {
  if (enabled && !ctx.getCaptureConfig()) {
    throw new Error("Capture buffer is not configured");
  }
  ctx.offlineEngine.armCapture(enabled);
  return ctx.realtimeNode.sendCommand({
    type: 13 /* ArmRecord */,
    targetId: ctx.resolveTargetId(trackId),
    sampleTime: -1,
    argInt: enabled ? 1 : 0
  });
}
function punch(ctx, inPpq, outPpq) {
  const inSample = ctx.offlineEngine.sampleAtPpq(inPpq);
  const outSample = ctx.offlineEngine.sampleAtPpq(outPpq);
  ctx.offlineEngine.setCapturePunch(inSample, outSample, true);
  return ctx.realtimeNode.sendCommand({
    type: 14 /* Punch */,
    sampleTime: -1,
    argInt: inSample,
    argFloat: outSample
  });
}
function captureStatus(ctx) {
  return ctx.realtimeNode.requestCaptureStatus();
}
function capturedAudio(ctx) {
  return ctx.realtimeNode.requestCapturedAudio();
}
async function resetCapture(ctx) {
  ctx.offlineEngine.resetCapture();
  await ctx.realtimeNode.requestCaptureReset();
}

// src/worklet/engine-clips.ts
var PREBAKED_CLIP_PAGE_THRESHOLD = 16384;
var PREBAKED_CLIP_PAGE_FRAMES = 4096;
function addClip(ctx, trackId, buffer, startPpq, opts = {}) {
  const id = opts.id ?? ctx.allocateClipId();
  const clip = {
    ...opts,
    id,
    channels: buffer,
    startPpq,
    trackId: ctx.resolveTargetId(trackId)
  };
  ctx.ensureTrackLane(trackId);
  ctx.clips.set(id, clip);
  syncClipsDelta(ctx, [clip], []);
  return id;
}
function removeClip(ctx, clipId) {
  ctx.clips.delete(clipId);
  syncClipsDelta(ctx, [], [clipId]);
}
function setMidiClips(ctx, clips) {
  ctx.midiClips.clear();
  for (const clip of clips) {
    const id = clip.id ?? ctx.allocateClipId();
    ctx.midiClips.set(id, { ...clip, id, events: clip.events.map((event) => ({ ...event })) });
  }
  syncMidiClips(ctx);
}
function syncClipsDelta(ctx, upserts, removeIds) {
  const clips = Array.from(ctx.clips.values());
  ctx.offlineEngine.setClips(clips);
  const preparedById = /* @__PURE__ */ new Map();
  for (const clip of clips) {
    if (clip.id === void 0) {
      continue;
    }
    const bakedChannels = ctx.offlineEngine.prebakedClipChannels(clip.id);
    preparedById.set(
      clip.id,
      bakedChannels === null ? clip : {
        ...clip,
        channels: bakedChannels,
        clipOffsetSamples: 0,
        lengthSamples: bakedChannels[0]?.length ?? 0,
        loop: false,
        warpMode: "off",
        warpAnchors: void 0
      }
    );
  }
  const inlineUpserts = [];
  for (const clip of upserts) {
    const prepared = clip.id === void 0 ? clip : preparedById.get(clip.id) ?? clip;
    const channels = prepared.channels;
    if (prepared.id === void 0 || prepared.warpMode !== "off" || !channels || channels.length === 0 || channels[0].length <= PREBAKED_CLIP_PAGE_THRESHOLD) {
      inlineUpserts.push(prepared);
      continue;
    }
    const numSamples = channels[0].length;
    ctx.postSync({
      type: "syncClipPageProvider",
      clipId: prepared.id,
      clip: { ...prepared, channels: void 0, pageProvider: void 0 },
      numChannels: channels.length,
      numSamples,
      pageFrames: PREBAKED_CLIP_PAGE_FRAMES
    });
    for (let start = 0, pageIndex = 0; start < numSamples; start += PREBAKED_CLIP_PAGE_FRAMES, pageIndex++) {
      const page = channels.map(
        (channel) => channel.slice(start, start + PREBAKED_CLIP_PAGE_FRAMES)
      );
      ctx.postSync(
        { type: "syncClipPage", clipId: prepared.id, pageIndex, channels: page },
        page.map((channel) => channel.buffer)
      );
    }
    ctx.postSync({ type: "syncClipPageCommit", clipId: prepared.id });
  }
  ctx.postSync({
    type: "syncClipsDelta",
    upserts: inlineUpserts,
    removeIds
  });
}
function syncMidiClips(ctx) {
  const clips = Array.from(ctx.midiClips.values());
  ctx.offlineEngine.setMidiClips(clips);
  ctx.postSync({ type: "syncMidiClips", clips });
}

// src/worklet/engine-markers.ts
function addMarker(ctx, ppq, name = "") {
  const id = ctx.getNextMarkerId();
  ctx.setNextMarkerId(id + 1);
  ctx.markers.set(id, { id, ppq, name });
  syncMarkers(ctx);
  return id;
}
function setMarkers(ctx, markers) {
  const { resolved, nextMarkerId } = resolveMarkerSet(markers, ctx.getNextMarkerId());
  ctx.setNextMarkerId(nextMarkerId);
  ctx.markers.clear();
  for (const marker2 of resolved) {
    ctx.markers.set(marker2.id, marker2);
  }
  syncMarkers(ctx);
  return resolved.map((marker2) => ({ ...marker2 }));
}
function markerCount(ctx) {
  return ctx.offlineEngine.markerCount();
}
function markerByIndex(ctx, index) {
  return ctx.offlineEngine.markerByIndex(index);
}
function marker(ctx, markerId) {
  return ctx.offlineEngine.marker(markerId);
}
function seekMarker(ctx, markerId) {
  ctx.offlineEngine.seekMarker(markerId);
  return ctx.sendCommand({
    type: 17 /* SeekMarker */,
    targetId: markerId,
    sampleTime: -1
  });
}
function setLoopFromMarkers(ctx, startMarkerId, endMarkerId) {
  ctx.offlineEngine.setLoopFromMarkers(startMarkerId, endMarkerId);
  const start = ctx.offlineEngine.marker(startMarkerId);
  const end = ctx.offlineEngine.marker(endMarkerId);
  return ctx.setLoop(start.ppq, end.ppq, true);
}
function syncMarkers(ctx) {
  const markers = Array.from(ctx.markers.values()).sort((a, b) => a.ppq - b.ppq);
  ctx.offlineEngine.setMarkers(markers);
  ctx.postSync({ type: "syncMarkers", markers });
}

// src/worklet/engine-mixer-facade.ts
function mixerLanes(ctx) {
  return buildMixerLanes(ctx.trackLaneIds, ctx.trackSends, ctx.trackOutputBus);
}
function syncMixer(ctx) {
  const lanes = mixerLanes(ctx);
  const buses = ctx.buses.map((bus) => ({ ...bus }));
  ctx.offlineEngine.setTrackBuses(buses);
  if (lanes.length > 0) {
    ctx.offlineEngine.setTrackLanes(lanes);
  }
  const trackStrips = Array.from(ctx.trackStripJson, ([trackId, sceneJson]) => ({
    trackId,
    sceneJson
  }));
  const busStrips = Array.from(ctx.busStripJson, ([busId, sceneJson]) => ({
    busId,
    sceneJson
  }));
  ctx.postSync({
    type: "syncMixer",
    lanes,
    buses,
    trackStrips,
    laneSidechains: Array.from(ctx.laneSidechains.values()),
    busStrips,
    masterStripJson: ctx.getMasterStripJson()
  });
}
function setTrackLanes(ctx, lanes) {
  const { entries, ids } = normalizeTrackLanes(ctx.trackLaneIds, lanes);
  for (const entry of entries) {
    if (entry.sends) {
      ctx.trackSends.set(
        entry.trackId,
        entry.sends.map((send) => ({ ...send }))
      );
    }
    if (entry.outputBusId !== void 0) {
      if (entry.outputBusId === 0) {
        ctx.trackOutputBus.delete(entry.trackId);
      } else {
        ctx.trackOutputBus.set(entry.trackId, entry.outputBusId);
      }
    }
  }
  ctx.trackLaneIds.splice(0, ctx.trackLaneIds.length, ...ids);
  ctx.syncMixer();
}
function setTrackOutputBus(ctx, target, busId) {
  const laneIndex = ctx.ensureTrackLane(target);
  const trackId = ctx.trackLaneIds[laneIndex];
  if (busId === 0) {
    ctx.trackOutputBus.delete(trackId);
  } else {
    ctx.trackOutputBus.set(trackId, busId);
  }
  ctx.syncMixer();
}
function setLaneSidechain(ctx, target, insertIndex, sourceTarget) {
  const laneIndex = ctx.ensureTrackLane(target);
  const trackId = ctx.trackLaneIds[laneIndex];
  const key = `${trackId}:${insertIndex}`;
  let sourceTrackId = 0;
  if (sourceTarget !== null) {
    const sourceIndex = ctx.ensureTrackLane(sourceTarget);
    sourceTrackId = ctx.trackLaneIds[sourceIndex];
  }
  if (sourceTrackId === 0) {
    ctx.laneSidechains.delete(key);
  } else {
    ctx.laneSidechains.set(key, { trackId, insertIndex, sourceTrackId });
  }
  ctx.offlineEngine.setLaneSidechain(trackId, insertIndex, sourceTrackId);
  ctx.postSync({
    type: "syncMixer",
    lanes: ctx.mixerLanes(),
    laneSidechains: [{ trackId, insertIndex, sourceTrackId }]
  });
}
function setSends(ctx, target, sends) {
  const laneIndex = ctx.ensureTrackLane(target);
  const trackId = ctx.trackLaneIds[laneIndex];
  ctx.trackSends.set(
    trackId,
    sends.map((send) => ({ ...send }))
  );
  ctx.syncMixer();
}
function setTrackBuses(ctx, buses) {
  ctx.buses.splice(0, ctx.buses.length, ...buses.map((bus) => ({ ...bus })));
  ctx.syncMixer();
}
function setBusGain(ctx, busId, db) {
  const busIndex = ctx.ensureBus(busId);
  ctx.buses[busIndex] = { ...ctx.buses[busIndex], busId, gainDb: db };
  ctx.offlineEngine.setTrackBuses(ctx.buses);
  return ctx.sendSmoothedParam(engineMixerBusTarget(busIndex, ENGINE_MIXER_PARAM_FADER_DB), db);
}
function setBusStripJson(ctx, busId, sceneJson) {
  ctx.ensureBus(busId);
  ctx.offlineEngine.setBusStripJson(busId, sceneJson);
  ctx.busStripJson.set(busId, sceneJson);
  ctx.syncMixer();
}

// src/worklet/guards.ts
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
  return value.type === "syncClips" || value.type === "syncClipsDelta" || value.type === "syncClipPageProvider" || value.type === "syncClipPage" || value.type === "syncClipPageCommit" || value.type === "syncMidiClips" || value.type === "syncMarkers" || value.type === "syncMetronome" || value.type === "syncAutomation" || value.type === "syncTempo" || value.type === "syncMixer" || value.type === "syncCapture" || value.type === "syncTrackStripEqBand" || value.type === "syncMasterStripEqBand" || value.type === "syncTrackStripInsertBypassed" || value.type === "syncMasterStripInsertBypassed" || value.type === "syncTrackStripInsertParamByName" || value.type === "syncMasterStripInsertParamByName" || value.type === "syncBusStripInsertParamByName" || value.type === "syncTrackStripPan" || value.type === "syncTrackStripPanLaw" || value.type === "syncTrackStripPanMode" || value.type === "syncTrackStripDualPan" || value.type === "syncTrackStripChannelDelaySamples" || value.type === "syncBuiltinInstrument" || value.type === "syncSynthInstrument" || value.type === "syncSf2Instrument" || value.type === "syncLoadSoundFont" || value.type === "syncMidiFx" || value.type === "syncClearMidiFx" || value.type === "syncMidiNoteOn" || value.type === "syncMidiNoteOff" || value.type === "syncMidiCc" || value.type === "syncMidiSysex" || value.type === "syncMidiPanic" || value.type === "syncMidiDestinationExternal" || value.type === "syncExternalMidiClock";
}
function isEngineCaptureRequestMessage(value) {
  return isRecord(value) && value.type === "captureRequest" && typeof value.requestId === "number" && (value.op === "status" || value.op === "read" || value.op === "reset");
}
function isEngineCaptureResponseMessage(value) {
  return isRecord(value) && value.type === "captureResponse" && typeof value.requestId === "number" && typeof value.ok === "boolean";
}
function isEngineTransportRequestMessage(value) {
  return isRecord(value) && value.type === "transportRequest" && typeof value.requestId === "number" && value.op === "state";
}
function isEngineTransportResponseMessage(value) {
  return isRecord(value) && value.type === "transportResponse" && typeof value.requestId === "number" && typeof value.ok === "boolean";
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
function isExternalMidiBatchMessage(value) {
  return isRecord(value) && value.type === "externalMidi" && Array.isArray(value.events);
}
function isMeterSnapshot(value) {
  return isRecord(value) && value.type === "meter" && typeof value.frame === "number" && typeof value.peakDbL === "number" && typeof value.peakDbR === "number" && typeof value.rmsDbL === "number" && typeof value.rmsDbR === "number" && typeof value.correlation === "number" && (typeof value.targetId === "number" || value.targetId === void 0);
}

// src/worklet/engine-node.ts
var SonareRealtimeEngineNode = class _SonareRealtimeEngineNode {
  constructor(node, capabilities, commandRing, telemetryRing, meterRing, scopeRing) {
    this.telemetryReadIndex = 0;
    this.meterReadIndex = 0;
    this.scopeReadIndex = 0;
    this.telemetryListeners = /* @__PURE__ */ new Set();
    this.meterListeners = /* @__PURE__ */ new Set();
    this.scopeListeners = /* @__PURE__ */ new Set();
    this.midiOutListeners = /* @__PURE__ */ new Set();
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
            pending.reject(new Error(event.data.error ?? "Capture request failed"));
          }
        }
      } else if (isEngineTransportResponseMessage(event.data)) {
        const pending = this.transportRequests.get(event.data.requestId);
        if (pending) {
          this.transportRequests.delete(event.data.requestId);
          if (event.data.ok) {
            pending.resolve(event.data);
          } else {
            pending.reject(new Error(event.data.error ?? "Transport request failed"));
          }
        }
      } else if (isEngineTelemetryRecord(event.data)) {
        this.emitTelemetry(event.data);
      } else if (isMeterSnapshot(event.data)) {
        this.emitMeter(event.data);
      } else if (isExternalMidiBatchMessage(event.data)) {
        this.emitMidiOut(event.data.events);
      } else if (isRecord(event.data) && event.data.type === "ready") {
        this.resolveReady();
      } else if (isRecord(event.data) && event.data.type === "error") {
        this.rejectReady(new Error(String(event.data.message ?? "AudioWorklet error")));
      }
    };
  }
  static async create(context, options = {}) {
    const processorName = options.processorName ?? "sonare-realtime-engine-processor";
    const moduleUrl = options.moduleUrl;
    if (moduleUrl && context.audioWorklet?.addModule) {
      await context.audioWorklet.addModule(moduleUrl);
    }
    const detectedCapabilities = options.engineAbiVersion !== void 0 ? {
      engineAbiVersion: options.engineAbiVersion,
      expectedEngineAbiVersion: options.expectedEngineAbiVersion ?? options.engineAbiVersion,
      abiCompatible: options.engineAbiVersion === (options.expectedEngineAbiVersion ?? options.engineAbiVersion)
    } : engineCapabilities();
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
    const meterRing = mode === "sab" ? createSonareMeterRingBuffer(options.meterRingCapacity ?? 128) : void 0;
    const scopeIntervalFrames = Math.max(0, Math.floor(options.scopeIntervalFrames ?? 0));
    const scopeRing = mode === "sab" && scopeIntervalFrames > 0 ? createSonareScopeRingBuffer(options.scopeRingCapacity ?? 64, options.scopeBands ?? 48) : void 0;
    const channelCount = Math.max(1, Math.floor(options.channelCount ?? 2));
    const processorOptions = {
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
      initialCommands: options.initialCommands
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
        runtimeTarget: "embind",
        sharedArrayBuffer,
        atomics,
        audioWorklet,
        engineAbiVersion: detectedCapabilities?.engineAbiVersion,
        expectedEngineAbiVersion: detectedCapabilities?.expectedEngineAbiVersion,
        abiCompatible: detectedCapabilities?.abiCompatible,
        degradedReason,
        readyMessage: moduleUrl !== void 0 && !options.nodeFactory
      },
      commandRing,
      telemetryRing,
      meterRing,
      scopeRing
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
  requestCaptureStatus() {
    return this.sendCaptureRequest("status").then((response) => {
      if (!response.status) {
        throw new Error("Capture status response is missing status.");
      }
      return response.status;
    });
  }
  requestCapturedAudio() {
    return this.sendCaptureRequest("read").then(
      (response) => (response.channels ?? []).map(
        (channel) => channel instanceof Float32Array ? channel : new Float32Array(channel)
      )
    );
  }
  requestCaptureReset() {
    return this.sendCaptureRequest("reset").then(() => void 0);
  }
  requestTransportState() {
    return this.sendTransportRequest().then((response) => {
      if (!response.state) {
        throw new Error("Transport state response is missing state.");
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
  /**
   * Subscribe to external-MIDI batches drained from the engine (one call per
   * render block that produced events), already lowered to MIDI 1.0 bytes for a
   * Web MIDI output port. Returns an unsubscribe function.
   */
  onMidiOut(callback) {
    this.midiOutListeners.add(callback);
    return () => {
      this.midiOutListeners.delete(callback);
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
      pending.reject(new Error("Realtime engine node is destroyed."));
    }
    this.captureRequests.clear();
    for (const pending of this.transportRequests.values()) {
      pending.reject(new Error("Realtime engine node is destroyed."));
    }
    this.transportRequests.clear();
    this.telemetryListeners.clear();
    this.meterListeners.clear();
    this.scopeListeners.clear();
    this.midiOutListeners.clear();
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
  emitMidiOut(events) {
    for (const listener of this.midiOutListeners) {
      listener(events);
    }
  }
  emitScope(scope) {
    for (const listener of this.scopeListeners) {
      listener(scope);
    }
  }
  sendCaptureRequest(op) {
    if (this.destroyed) {
      return Promise.reject(new Error("Realtime engine node is destroyed."));
    }
    const requestId = this.captureRequestId++;
    const promise = new Promise((resolve, reject) => {
      this.captureRequests.set(requestId, { resolve, reject });
    });
    this.node.port.postMessage({ type: "captureRequest", requestId, op });
    return promise;
  }
  sendTransportRequest() {
    if (this.destroyed) {
      return Promise.reject(new Error("Realtime engine node is destroyed."));
    }
    const requestId = this.transportRequestId++;
    const promise = new Promise((resolve, reject) => {
      this.transportRequests.set(requestId, { resolve, reject });
    });
    this.node.port.postMessage({ type: "transportRequest", requestId, op: "state" });
    return promise;
  }
};

// src/worklet/engine-parameter-facade.ts
function setParam(ctx, nodeId, param, value) {
  const paramId = ctx.resolveParamId(nodeId, param);
  ctx.offlineEngine.setParameter(paramId, value);
  return ctx.realtimeNode.sendCommand({
    type: 0 /* SetParam */,
    targetId: paramId,
    sampleTime: -1,
    argFloat: value
  });
}
function setSoloMute(ctx, target, solo, mute) {
  const laneIndex = ctx.ensureTrackLane(target);
  ctx.offlineEngine.setSoloMute(laneIndex, solo, mute);
  return ctx.realtimeNode.sendCommand({
    type: 10 /* SetSoloMute */,
    targetId: laneIndex,
    sampleTime: -1,
    argInt: (mute ? 1 : 0) | (solo ? 2 : 0)
  });
}
function automationParamId(ctx, target, kind) {
  const paramKind = kind === "pan" ? ENGINE_MIXER_PARAM_PAN : ENGINE_MIXER_PARAM_FADER_DB;
  if (target === "master") {
    return engineMixerMasterTarget(paramKind);
  }
  return engineMixerLaneTarget(ctx.ensureTrackLane(target), paramKind);
}
function busAutomationParamId(ctx, busId) {
  return engineMixerBusTarget(ctx.ensureBus(busId), ENGINE_MIXER_PARAM_FADER_DB);
}
function resolveTrackInsertAutomationId(ctx, target, insertIndex, paramName) {
  const laneIndex = ctx.ensureTrackLane(target);
  return ctx.offlineEngine.resolveTrackInsertAutomationId(
    ctx.trackLaneIds[laneIndex],
    insertIndex,
    paramName
  );
}
function resolveMasterInsertAutomationId(ctx, insertIndex, paramName) {
  return ctx.offlineEngine.resolveMasterInsertAutomationId(insertIndex, paramName);
}
function resolveBusInsertAutomationId(ctx, busId, insertIndex, paramName) {
  ctx.ensureBus(busId);
  return ctx.offlineEngine.resolveBusInsertAutomationId(busId, insertIndex, paramName);
}
function automationLaneCount(ctx) {
  return ctx.offlineEngine.automationLaneCount();
}
function listParameters(ctx) {
  const parameters = [];
  for (let index = 0; index < ctx.offlineEngine.parameterCount(); index++) {
    parameters.push(ctx.offlineEngine.parameterInfoByIndex(index));
  }
  return parameters;
}

// src/worklet/engine-strips.ts
function trackIdFor(ctx, target) {
  return ctx.trackLaneIds[ctx.ensureTrackLane(target)];
}
function setTrackStripJson(ctx, trackId, sceneJson, trackStripJson) {
  ctx.offlineEngine.setTrackStripJson(trackId, sceneJson);
  trackStripJson.set(trackId, sceneJson);
}
function setTrackStripEqBand(ctx, target, bandIndex, band) {
  const trackId = trackIdFor(ctx, target);
  const bandJson = typeof band === "string" ? band : JSON.stringify(band);
  ctx.offlineEngine.setTrackStripEqBandJson(trackId, bandIndex, bandJson);
  ctx.postSync({ type: "syncTrackStripEqBand", trackId, bandIndex, bandJson });
}
function setTrackStripInsertBypassed(ctx, target, insertIndex, bypassed, resetOnBypass) {
  const trackId = trackIdFor(ctx, target);
  ctx.offlineEngine.setTrackStripInsertBypassed(trackId, insertIndex, bypassed, resetOnBypass);
  ctx.postSync({
    type: "syncTrackStripInsertBypassed",
    trackId,
    insertIndex,
    bypassed,
    resetOnBypass
  });
}
function setTrackStripInsertParamByName(ctx, target, insertIndex, paramName, value) {
  const trackId = trackIdFor(ctx, target);
  ctx.offlineEngine.setTrackStripInsertParamByName(trackId, insertIndex, paramName, value);
  ctx.postSync({ type: "syncTrackStripInsertParamByName", trackId, insertIndex, paramName, value });
}
function setTrackStripPan(ctx, target, pan) {
  const trackId = trackIdFor(ctx, target);
  ctx.offlineEngine.setTrackStripPan(trackId, pan);
  ctx.postSync({ type: "syncTrackStripPan", trackId, pan });
}
function setTrackStripPanLaw(ctx, target, panLaw) {
  const trackId = trackIdFor(ctx, target);
  const code = panLawCode(panLaw);
  ctx.offlineEngine.setTrackStripPanLaw(trackId, code);
  ctx.postSync({ type: "syncTrackStripPanLaw", trackId, panLaw: code });
}
function setTrackStripPanMode(ctx, target, panMode) {
  const trackId = trackIdFor(ctx, target);
  const code = panModeCode(panMode);
  ctx.offlineEngine.setTrackStripPanMode(trackId, code);
  ctx.postSync({ type: "syncTrackStripPanMode", trackId, panMode: code });
}
function setTrackStripDualPan(ctx, target, leftPan, rightPan) {
  const trackId = trackIdFor(ctx, target);
  ctx.offlineEngine.setTrackStripDualPan(trackId, leftPan, rightPan);
  ctx.postSync({ type: "syncTrackStripDualPan", trackId, leftPan, rightPan });
}
function setTrackStripChannelDelaySamples(ctx, target, delaySamples) {
  const trackId = trackIdFor(ctx, target);
  ctx.offlineEngine.setTrackStripChannelDelaySamples(trackId, delaySamples);
  ctx.postSync({ type: "syncTrackStripChannelDelaySamples", trackId, delaySamples });
}
function setMasterStripEqBand(ctx, bandIndex, band) {
  const bandJson = typeof band === "string" ? band : JSON.stringify(band);
  ctx.offlineEngine.setMasterStripEqBandJson(bandIndex, bandJson);
  ctx.postSync({ type: "syncMasterStripEqBand", bandIndex, bandJson });
}
function setMasterStripInsertBypassed(ctx, insertIndex, bypassed, resetOnBypass) {
  ctx.offlineEngine.setMasterStripInsertBypassed(insertIndex, bypassed, resetOnBypass);
  ctx.postSync({ type: "syncMasterStripInsertBypassed", insertIndex, bypassed, resetOnBypass });
}
function setMasterStripInsertParamByName(ctx, insertIndex, paramName, value) {
  ctx.offlineEngine.setMasterStripInsertParamByName(insertIndex, paramName, value);
  ctx.postSync({ type: "syncMasterStripInsertParamByName", insertIndex, paramName, value });
}
function setBusStripInsertParamByName(ctx, busId, insertIndex, paramName, value) {
  ctx.offlineEngine.setBusStripInsertParamByName(busId, insertIndex, paramName, value);
  ctx.postSync({ type: "syncBusStripInsertParamByName", busId, insertIndex, paramName, value });
}
function pushMidiNoteOn(ctx, trackId, group, channel, note, velocity, renderFrame) {
  const destinationId = ctx.resolveTargetId(trackId);
  ctx.offlineEngine.pushMidiNoteOn(destinationId, group, channel, note, velocity, renderFrame);
  ctx.postSync({
    type: "syncMidiNoteOn",
    destinationId,
    group,
    channel,
    note,
    velocity,
    renderFrame
  });
}
function pushMidiNoteOff(ctx, trackId, group, channel, note, velocity, renderFrame) {
  const destinationId = ctx.resolveTargetId(trackId);
  ctx.offlineEngine.pushMidiNoteOff(destinationId, group, channel, note, velocity, renderFrame);
  ctx.postSync({
    type: "syncMidiNoteOff",
    destinationId,
    group,
    channel,
    note,
    velocity,
    renderFrame
  });
}
function pushMidiCc(ctx, trackId, group, channel, controller, value, renderFrame) {
  const destinationId = ctx.resolveTargetId(trackId);
  ctx.offlineEngine.pushMidiCc(destinationId, group, channel, controller, value, renderFrame);
  ctx.postSync({
    type: "syncMidiCc",
    destinationId,
    group,
    channel,
    controller,
    value,
    renderFrame
  });
}
function setBuiltinInstrument(ctx, trackId, config) {
  const destinationId = ctx.resolveTargetId(trackId);
  ctx.offlineEngine.setBuiltinInstrument(config, destinationId);
  ctx.postInstrumentSync({ type: "syncBuiltinInstrument", destinationId, config });
}
function setSynthInstrument(ctx, trackId, patch) {
  const destinationId = ctx.resolveTargetId(trackId);
  ctx.offlineEngine.setSynthInstrument(patch, destinationId);
  ctx.postInstrumentSync({ type: "syncSynthInstrument", destinationId, patch });
}
function loadSoundFont(ctx, data) {
  ctx.offlineEngine.loadSoundFont(data);
  ctx.postInstrumentSync({ type: "syncLoadSoundFont", data });
}
function setSf2Instrument(ctx, trackId, config) {
  const destinationId = ctx.resolveTargetId(trackId);
  ctx.offlineEngine.setSf2Instrument(config, destinationId);
  ctx.postInstrumentSync({ type: "syncSf2Instrument", destinationId, config });
}
function setMidiDestinationExternal(ctx, trackId, external) {
  const destinationId = ctx.resolveTargetId(trackId);
  ctx.offlineEngine.setMidiDestinationExternal(destinationId, external);
  ctx.postSync({ type: "syncMidiDestinationExternal", destinationId, external });
}
function setExternalMidiClockEnabled(ctx, enabled) {
  ctx.offlineEngine.setExternalMidiClockEnabled(enabled);
  ctx.postSync({ type: "syncExternalMidiClock", enabled });
}
function setMidiFx(ctx, trackId, configJson) {
  const destinationId = ctx.resolveTargetId(trackId);
  ctx.offlineEngine.setMidiFx(destinationId, configJson);
  ctx.postInstrumentSync({ type: "syncMidiFx", destinationId, configJson });
}
function clearMidiFx(ctx, trackId) {
  const destinationId = ctx.resolveTargetId(trackId);
  ctx.offlineEngine.clearMidiFx(destinationId);
  ctx.postInstrumentSync({ type: "syncClearMidiFx", destinationId });
}
function pushMidiSysex(ctx, trackId, data, renderFrame) {
  const destinationId = ctx.resolveTargetId(trackId);
  ctx.offlineEngine.pushMidiSysex(destinationId, data, renderFrame);
  ctx.postSync({ type: "syncMidiSysex", destinationId, data, renderFrame });
}

// src/worklet/engine-tempo-facade.ts
function postTempoSync(ctx) {
  ctx.postSync(
    buildTempoSync(
      ctx.getTempoBpm(),
      ctx.getTimeSignature(),
      ctx.getTempoSegments(),
      ctx.getTimeSignatureSegments()
    )
  );
}
function setTempo(ctx, bpm) {
  ctx.setTempoBpm(bpm);
  ctx.setTempoSegments([{ startPpq: 0, bpm }]);
  ctx.offlineEngine.setTempo(bpm);
  postTempoSync(ctx);
  ctx.realtimeNode.sendCommand({
    type: 6 /* SetTempoMap */,
    sampleTime: -1,
    argFloat: bpm
  });
}
function setTempoSegments(ctx, segments) {
  const copied = segments.map((segment) => ({ ...segment }));
  ctx.setTempoSegments(copied);
  ctx.setTempoBpm(copied[0]?.bpm ?? ctx.getTempoBpm());
  ctx.offlineEngine.setTempoSegments(copied);
  postTempoSync(ctx);
}
function setTimeSignature(ctx, numerator, denominator) {
  ctx.setTimeSignature({ numerator, denominator });
  ctx.setTimeSignatureSegments([{ startPpq: 0, numerator, denominator }]);
  ctx.offlineEngine.setTimeSignature(numerator, denominator);
  postTempoSync(ctx);
}
function setTimeSignatureSegments(ctx, segments) {
  const copied = segments.map((segment) => ({ ...segment }));
  ctx.setTimeSignatureSegments(copied);
  const first = copied[0];
  if (first) {
    ctx.setTimeSignature({ numerator: first.numerator, denominator: first.denominator });
  }
  ctx.offlineEngine.setTimeSignatureSegments(copied);
  postTempoSync(ctx);
}
function setLoop(ctx, startPpq, endPpq, enabled = true) {
  ctx.offlineEngine.setLoop(startPpq, endPpq, enabled);
  return ctx.realtimeNode.sendCommand({
    type: 7 /* SetLoop */,
    targetId: enabled ? 1 : 0,
    sampleTime: -1,
    argFloat: startPpq,
    argInt: Math.round(endPpq * 1e6)
  });
}
function countInEndSample(ctx, startSample, bars) {
  return ctx.offlineEngine.countInEndSample(startSample, bars);
}
async function getTransportState(ctx) {
  const state = await ctx.realtimeNode.requestTransportState();
  ctx.setLatestTransportState(state);
  return state;
}
function cachedTransportState(ctx) {
  return ctx.getLatestTransportState();
}

// src/worklet/engine.ts
var SonareEngine = class _SonareEngine {
  constructor(context, realtimeNode, offlineEngine, sampleRate, offlineBlockSize, offlineChannelCount) {
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
    this.timeSignatureSegments = [
      { startPpq: 0, numerator: 4, denominator: 4 }
    ];
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
    this.transport = buildTransportFacade({
      sampleRate: this.sampleRate,
      realtimeNode: this.realtimeNode,
      offlineEngine: this.offlineEngine,
      setTransportPlaying: (playing) => {
        this.transportPlaying = playing;
      },
      flushPendingInstrumentSync: () => this.flushPendingInstrumentSync(),
      setTempo: (bpm) => this.setTempo(bpm),
      setTempoSegments: (segments) => this.setTempoSegments(segments),
      setLoop: (startPpq, endPpq, enabled) => this.setLoop(startPpq, endPpq, enabled)
    });
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
    setTempo(this.tempoContext, bpm);
  }
  setTempoSegments(segments) {
    setTempoSegments(this.tempoContext, segments);
  }
  setTimeSignature(numerator, denominator) {
    setTimeSignature(this.tempoContext, numerator, denominator);
  }
  setTimeSignatureSegments(segments) {
    setTimeSignatureSegments(this.tempoContext, segments);
  }
  setLoop(startPpq, endPpq, enabled = true) {
    return setLoop(this.tempoContext, startPpq, endPpq, enabled);
  }
  countInEndSample(startSample, bars) {
    return countInEndSample(this.tempoContext, startSample, bars);
  }
  getTransportState() {
    return getTransportState(this.tempoContext);
  }
  cachedTransportState() {
    return cachedTransportState(this.tempoContext);
  }
  setParam(nodeId, param, value) {
    return setParam(this.parameterContext, nodeId, param, value);
  }
  scheduleParam(nodeId, param, ppq, value, curve = "linear") {
    scheduleParam(this.automationContext, nodeId, param, ppq, value, curve);
  }
  addAutomationPoint(laneId, ppq, value, curve = "linear") {
    addAutomationPoint(this.automationContext, laneId, ppq, value, curve);
  }
  /**
   * Replaces the automation lane for `paramId` with the given breakpoints. An
   * empty array clears the lane; the points are defensively copied and sorted
   * by ppq before mirroring to the offline and live worklet engines.
   */
  setAutomationLane(paramId, points) {
    setAutomationLane(this.automationContext, paramId, points);
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
    return automationParamId(this.parameterContext, target, kind);
  }
  /**
   * Returns the automation target id for a bus fader.
   *
   * @param busId Bus id (declares the mixer bus on first use).
   * @returns Reserved engine parameter id for the bus fader gain (dB).
   */
  busAutomationParamId(busId) {
    return busAutomationParamId(this.parameterContext, busId);
  }
  /**
   * Resolves a track-lane insert parameter (JSON-key name) to the reserved
   * insert-automation id fed straight to setAutomationLane. Declares the track's
   * mixer lane first (like automationParamId) so the offline engine resolves the
   * same strip selector the realtime engine uses.
   *
   * @param target Track id (declares a mixer lane on first use).
   * @param insertIndex Index into the strip's combined insert sequence.
   * @param paramName Processor JSON-key parameter name.
   * @returns Reserved insert-automation id, or -1 when strip/insert/key unknown.
   */
  resolveTrackInsertAutomationId(target, insertIndex, paramName) {
    return resolveTrackInsertAutomationId(
      this.parameterContext,
      target,
      insertIndex,
      paramName
    );
  }
  /**
   * Resolves a master-strip insert parameter to its reserved insert-automation
   * id.
   *
   * @param insertIndex Index into the master strip's insert sequence.
   * @param paramName Processor JSON-key parameter name.
   * @returns Reserved insert-automation id, or -1 when insert/key unknown.
   */
  resolveMasterInsertAutomationId(insertIndex, paramName) {
    return resolveMasterInsertAutomationId(this.parameterContext, insertIndex, paramName);
  }
  /**
   * Resolves a bus-strip insert parameter to its reserved insert-automation id.
   * Declares the mixer bus first so the offline engine resolves the same bus
   * selector.
   *
   * @param busId Bus id (declares the mixer bus on first use).
   * @param insertIndex Index into the bus strip's insert sequence.
   * @param paramName Processor JSON-key parameter name.
   * @returns Reserved insert-automation id, or -1 when bus/insert/key unknown.
   */
  resolveBusInsertAutomationId(busId, insertIndex, paramName) {
    return resolveBusInsertAutomationId(
      this.parameterContext,
      busId,
      insertIndex,
      paramName
    );
  }
  /**
   * Returns the number of automation lanes installed on the engine, including
   * lanes whose breakpoint list is currently empty.
   *
   * @returns Engine-side automation lane count.
   */
  automationLaneCount() {
    return automationLaneCount(this.parameterContext);
  }
  listParameters() {
    return listParameters(this.parameterContext);
  }
  setSoloMute(target, solo, mute) {
    return setSoloMute(this.parameterContext, target, solo, mute);
  }
  setStripGain(target, db) {
    return this.sendSmoothedParam(this.stripParamId(target, ENGINE_MIXER_PARAM_FADER_DB), db);
  }
  setStripPan(target, pan) {
    return this.sendSmoothedParam(this.stripParamId(target, ENGINE_MIXER_PARAM_PAN), pan);
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
    setTrackLanes(this.mixerContext, lanes);
  }
  /**
   * Routes a track lane's post-fader output into a declared bus instead of
   * the master mix (group/folder routing); busId 0 restores the master mix.
   */
  setTrackOutputBus(target, busId) {
    setTrackOutputBus(this.mixerContext, target, busId);
  }
  /**
   * Keys one insert of a lane strip from another lane's post-strip pre-fader
   * audio (ducking/sidechainRouter inserts). sourceTarget null removes the
   * binding.
   */
  setLaneSidechain(target, insertIndex, sourceTarget) {
    setLaneSidechain(this.mixerContext, target, insertIndex, sourceTarget);
  }
  setSends(target, sends) {
    setSends(this.mixerContext, target, sends);
  }
  setTrackBuses(buses) {
    setTrackBuses(this.mixerContext, buses);
  }
  setBusGain(busId, db) {
    return setBusGain(this.mixerContext, busId, db);
  }
  setTrackStripJson(target, sceneJson) {
    const laneIndex = this.ensureTrackLane(target);
    const trackId = this.trackLaneIds[laneIndex];
    setTrackStripJson(this.stripContext, trackId, sceneJson, this.trackStripJson);
    this.syncMixer();
  }
  setTrackStripEqBand(target, bandIndex, band) {
    setTrackStripEqBand(this.stripContext, target, bandIndex, band);
  }
  setTrackStripInsertBypassed(target, insertIndex, bypassed, resetOnBypass = false) {
    setTrackStripInsertBypassed(
      this.stripContext,
      target,
      insertIndex,
      bypassed,
      resetOnBypass
    );
  }
  setTrackStripInsertParamByName(target, insertIndex, paramName, value) {
    setTrackStripInsertParamByName(this.stripContext, target, insertIndex, paramName, value);
  }
  setTrackStripPan(target, pan) {
    setTrackStripPan(this.stripContext, target, pan);
  }
  setTrackStripPanLaw(target, panLaw) {
    setTrackStripPanLaw(this.stripContext, target, panLaw);
  }
  setTrackStripPanMode(target, panMode) {
    setTrackStripPanMode(this.stripContext, target, panMode);
  }
  setTrackStripDualPan(target, leftPan, rightPan) {
    setTrackStripDualPan(this.stripContext, target, leftPan, rightPan);
  }
  setTrackStripChannelDelaySamples(target, delaySamples) {
    setTrackStripChannelDelaySamples(this.stripContext, target, delaySamples);
  }
  setStripEq(target, bandIndex, band) {
    if (target === "master") {
      this.setMasterStripEqBand(bandIndex, band);
      return;
    }
    this.setTrackStripEqBand(target, bandIndex, band);
  }
  setStripInsertBypassed(target, insertIndex, bypassed, resetOnBypass = false) {
    if (target === "master") {
      this.setMasterStripInsertBypassed(insertIndex, bypassed, resetOnBypass);
      return;
    }
    this.setTrackStripInsertBypassed(target, insertIndex, bypassed, resetOnBypass);
  }
  setStripInserts(target, sceneJson) {
    if (target === "master") {
      this.setMasterStripJson(sceneJson);
      return;
    }
    this.setTrackStripJson(target, sceneJson);
  }
  setBusStripJson(busId, sceneJson) {
    setBusStripJson(this.mixerContext, busId, sceneJson);
  }
  setMasterStripJson(sceneJson) {
    this.offlineEngine.setMasterStripJson(sceneJson);
    this.masterStripJson = sceneJson;
    this.syncMixer();
  }
  setMasterStripEqBand(bandIndex, band) {
    setMasterStripEqBand(this.stripContext, bandIndex, band);
  }
  setMasterStripInsertBypassed(insertIndex, bypassed, resetOnBypass = false) {
    setMasterStripInsertBypassed(this.stripContext, insertIndex, bypassed, resetOnBypass);
  }
  setMasterStripInsertParamByName(insertIndex, paramName, value) {
    setMasterStripInsertParamByName(this.stripContext, insertIndex, paramName, value);
  }
  setBusStripInsertParamByName(busId, insertIndex, paramName, value) {
    this.ensureBus(busId);
    setBusStripInsertParamByName(this.stripContext, busId, insertIndex, paramName, value);
  }
  setStripInsertParamByName(target, insertIndex, paramName, value) {
    if (target === "master") {
      this.setMasterStripInsertParamByName(insertIndex, paramName, value);
      return;
    }
    this.setTrackStripInsertParamByName(target, insertIndex, paramName, value);
  }
  setMasterChain(sceneJson) {
    this.setMasterStripJson(sceneJson);
  }
  addClip(trackId, buffer, startPpq, opts = {}) {
    return addClip(this.clipContext, trackId, buffer, startPpq, opts);
  }
  removeClip(clipId) {
    removeClip(this.clipContext, clipId);
  }
  setMidiClips(schedules) {
    setMidiClips(this.clipContext, schedules);
  }
  setBuiltinInstrument(trackId, config = {}) {
    setBuiltinInstrument(this.stripContext, trackId, config);
  }
  setSynthInstrument(trackId, patch = {}) {
    setSynthInstrument(this.stripContext, trackId, patch);
  }
  loadSoundFont(data) {
    loadSoundFont(this.stripContext, data);
  }
  setSf2Instrument(trackId, config = {}) {
    setSf2Instrument(this.stripContext, trackId, config);
  }
  /**
   * Route a track's MIDI to the external output (drained via {@link onMidiOut})
   * instead of an internal instrument, so the track plays an external device.
   * Pass `external=false` to restore internal-synth playback.
   */
  setMidiDestinationExternal(trackId, external) {
    setMidiDestinationExternal(this.stripContext, trackId, external);
  }
  /**
   * Enable/disable forwarding MIDI clock + transport (start/continue/stop) to
   * the external output so external gear tracks the transport tempo. The bytes
   * arrive through {@link onMidiOut} tagged with the transport destination.
   */
  setExternalMidiClockEnabled(enabled) {
    setExternalMidiClockEnabled(this.stripContext, enabled);
  }
  /**
   * Install or replace a live, non-destructive MIDI-FX insert for one
   * destination. The insert transforms the destination's MIDI before
   * synthesis (transpose, quantize, velocity shaping, humanize, harmonize,
   * arpeggiate) without rewriting any stored notes, so it can be bypassed by
   * {@link clearMidiFx}. The config JSON is the flat object the engine's
   * MIDI-FX accepts (the same schema as the offline `Project.bakeMidiFx`).
   */
  setMidiFx(trackId, configJson) {
    setMidiFx(this.stripContext, trackId, configJson);
  }
  /** Remove the live MIDI-FX insert from one destination (a no-op when none). */
  clearMidiFx(trackId) {
    clearMidiFx(this.stripContext, trackId);
  }
  pushMidiNoteOn(trackId, group, channel, note, velocity, renderFrame = -1) {
    pushMidiNoteOn(this.stripContext, trackId, group, channel, note, velocity, renderFrame);
  }
  pushMidiNoteOff(trackId, group, channel, note, velocity = 0, renderFrame = -1) {
    pushMidiNoteOff(this.stripContext, trackId, group, channel, note, velocity, renderFrame);
  }
  pushMidiCc(trackId, group, channel, controller, value, renderFrame = -1) {
    pushMidiCc(this.stripContext, trackId, group, channel, controller, value, renderFrame);
  }
  pushMidiSysex(trackId, data, renderFrame = -1) {
    pushMidiSysex(this.stripContext, trackId, data, renderFrame);
  }
  pushMidiPanic(renderFrame = -1) {
    this.offlineEngine.pushMidiPanic(renderFrame);
    this.postSync({ type: "syncMidiPanic", renderFrame });
  }
  configureCapture(options) {
    configureCapture(this.captureContext, options);
  }
  armRecord(trackId, enabled) {
    return armRecord(this.captureContext, trackId, enabled);
  }
  punch(inPpq, outPpq) {
    return punch(this.captureContext, inPpq, outPpq);
  }
  captureStatus() {
    return captureStatus(this.captureContext);
  }
  capturedAudio() {
    return capturedAudio(this.captureContext);
  }
  async resetCapture() {
    return resetCapture(this.captureContext);
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
    return addMarker(this.markerContext, ppq, name);
  }
  /**
   * Replaces the whole marker set in one call. Entries without an `id` are
   * assigned fresh ids; entries carrying an `id` keep it. Returns the resolved
   * markers in the order given.
   */
  setMarkers(entries) {
    return setMarkers(this.markerContext, entries);
  }
  markerCount() {
    return markerCount(this.markerContext);
  }
  markerByIndex(index) {
    return markerByIndex(this.markerContext, index);
  }
  marker(markerId) {
    return marker(this.markerContext, markerId);
  }
  seekMarker(markerId) {
    return seekMarker(this.markerContext, markerId);
  }
  setLoopFromMarkers(startMarkerId, endMarkerId) {
    return setLoopFromMarkers(this.markerContext, startMarkerId, endMarkerId);
  }
  async renderOffline(totalFrames) {
    const frames = Math.max(0, Math.floor(totalFrames));
    const inputs = [];
    for (let ch = 0; ch < this.offlineChannelCount; ch++) {
      inputs.push(new Float32Array(frames));
    }
    return this.offlineEngine.renderOffline(inputs, this.offlineBlockSize);
  }
  /**
   * Subscribe to external-MIDI batches (already lowered to MIDI 1.0 bytes) for
   * delivery to Web MIDI output ports. Fires once per render block that
   * produced events. Returns an unsubscribe function.
   */
  onMidiOut(callback) {
    return this.realtimeNode.onMidiOut(callback);
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
  mixerLanes() {
    return mixerLanes(this.mixerContext);
  }
  syncMixer() {
    syncMixer(this.mixerContext);
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
  // Posts an out-of-band control-sync message to the worklet engine processor.
  // Sync messages use a string `type` so the worklet's message handler routes
  // them to receiveSync() (numeric `type` is reserved for SonareEngineCommandRecord).
  postSync(message, transfer) {
    if (this.destroyed) {
      return;
    }
    if (transfer && transfer.length > 0) {
      this.realtimeNode.node.port.postMessage(message, transfer);
    } else {
      this.realtimeNode.node.port.postMessage(message);
    }
  }
  // Collaborator surface handed to the mixer/routing free functions so they can
  // mutate the routing stores (held by reference), mirror into the offline
  // engine, post mixer-sync messages, and declare lanes/buses without a
  // back-reference to the whole engine.
  get mixerContext() {
    return {
      offlineEngine: this.offlineEngine,
      trackLaneIds: this.trackLaneIds,
      trackSends: this.trackSends,
      trackOutputBus: this.trackOutputBus,
      laneSidechains: this.laneSidechains,
      buses: this.buses,
      trackStripJson: this.trackStripJson,
      busStripJson: this.busStripJson,
      postSync: (message) => this.postSync(message),
      ensureTrackLane: (target) => this.ensureTrackLane(target),
      ensureBus: (busId) => this.ensureBus(busId),
      mixerLanes: () => this.mixerLanes(),
      syncMixer: () => this.syncMixer(),
      sendSmoothedParam: (paramId, value) => this.sendSmoothedParam(paramId, value),
      getMasterStripJson: () => this.masterStripJson
    };
  }
  // Collaborator surface handed to the strip/pan/EQ/insert/MIDI free functions
  // so they can mirror into the offline engine, post sync messages, and resolve
  // lanes without each holding a back-reference to the whole engine.
  get stripContext() {
    return {
      offlineEngine: this.offlineEngine,
      trackLaneIds: this.trackLaneIds,
      postSync: (message) => this.postSync(message),
      postInstrumentSync: (message) => this.postInstrumentSync(message),
      ensureTrackLane: (target) => this.ensureTrackLane(target),
      resolveTargetId: (target) => this.resolveTargetId(target)
    };
  }
  // Collaborator surface handed to the automation-lane free functions so they
  // can mutate the lane store, mirror into the offline engine, and post
  // automation-sync messages without holding a back-reference.
  get automationContext() {
    return {
      offlineEngine: this.offlineEngine,
      automationLanes: this.automationLanes,
      postSync: (message) => this.postSync(message),
      resolveParamId: (nodeId, param) => this.resolveParamId(nodeId, param)
    };
  }
  // Collaborator surface handed to the capture/record/punch free functions so
  // they can mirror into and query the offline engine, command the realtime
  // node, and read/write the capture config without a back-reference.
  get captureContext() {
    return {
      offlineEngine: this.offlineEngine,
      realtimeNode: this.realtimeNode,
      offlineChannelCount: this.offlineChannelCount,
      postSync: (message) => this.postSync(message),
      getCaptureConfig: () => this.captureConfig,
      setCaptureConfig: (config) => {
        this.captureConfig = config;
      },
      resolveTargetId: (target) => this.resolveTargetId(target)
    };
  }
  // Collaborator surface handed to the parameter / automation-id resolution
  // free functions so they can mirror into and query the offline engine,
  // command the realtime node, and declare lanes/buses without holding a
  // back-reference to the whole engine.
  get parameterContext() {
    return {
      offlineEngine: this.offlineEngine,
      realtimeNode: this.realtimeNode,
      trackLaneIds: this.trackLaneIds,
      resolveParamId: (nodeId, param) => this.resolveParamId(nodeId, param),
      ensureTrackLane: (target) => this.ensureTrackLane(target),
      ensureBus: (busId) => this.ensureBus(busId)
    };
  }
  // Collaborator surface handed to the tempo / time-signature free functions so
  // they can mirror into the offline engine, command the realtime node, post
  // tempo-sync messages, and mutate the engine's tempo-map state by reference.
  get tempoContext() {
    return {
      offlineEngine: this.offlineEngine,
      realtimeNode: this.realtimeNode,
      postSync: (message) => this.postSync(message),
      getTempoBpm: () => this.tempoBpm,
      setTempoBpm: (bpm) => {
        this.tempoBpm = bpm;
      },
      getTimeSignature: () => this.timeSignature,
      setTimeSignature: (signature) => {
        this.timeSignature = signature;
      },
      getTempoSegments: () => this.tempoSegments,
      setTempoSegments: (segments) => {
        this.tempoSegments = segments;
      },
      getTimeSignatureSegments: () => this.timeSignatureSegments,
      setTimeSignatureSegments: (segments) => {
        this.timeSignatureSegments = segments;
      },
      setLatestTransportState: (state) => {
        this.latestTransportState = state;
      },
      getLatestTransportState: () => this.latestTransportState
    };
  }
  // Collaborator surface handed to the audio/MIDI clip scheduling free
  // functions so they can mutate the clip stores, mirror into the offline
  // engine, and post clip-sync messages without holding a back-reference.
  get clipContext() {
    return {
      offlineEngine: this.offlineEngine,
      clips: this.clips,
      midiClips: this.midiClips,
      allocateClipId: () => this.nextClipId++,
      postSync: (message, transfer) => this.postSync(message, transfer),
      ensureTrackLane: (target) => this.ensureTrackLane(target),
      resolveTargetId: (target) => this.resolveTargetId(target)
    };
  }
  // Collaborator surface handed to the marker free functions so they can mutate
  // the marker store and id counter, mirror into the offline engine, post
  // marker-sync messages, and drive transport without a back-reference.
  get markerContext() {
    return {
      offlineEngine: this.offlineEngine,
      markers: this.markers,
      getNextMarkerId: () => this.nextMarkerId,
      setNextMarkerId: (value) => {
        this.nextMarkerId = value;
      },
      postSync: (message) => this.postSync(message),
      sendCommand: (command) => this.realtimeNode.sendCommand(command),
      setLoop: (startPpq, endPpq, enabled) => this.setLoop(startPpq, endPpq, enabled)
    };
  }
  // Resolves the reserved mixer parameter id for a fader/pan target, declaring a
  // track lane on first use; 'master' addresses the master strip namespace.
  stripParamId(target, paramKind) {
    if (target === "master") {
      return engineMixerMasterTarget(paramKind);
    }
    return engineMixerLaneTarget(this.ensureTrackLane(target), paramKind);
  }
  // Mirrors a smoothed parameter into the offline engine and pushes a
  // sample-accurate smoothed-param command to the realtime runtime.
  sendSmoothedParam(paramId, value) {
    this.offlineEngine.setParameter(paramId, value);
    return this.realtimeNode.sendCommand({
      type: 1 /* SetParamSmoothed */,
      targetId: paramId,
      sampleTime: -1,
      argFloat: value
    });
  }
  resolveParamId(nodeId, param) {
    return resolveParamId(this.listParameters(), nodeId, param);
  }
  resolveTargetId(target) {
    return resolveTargetId(target);
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
};

// src/worklet/messages.ts
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

// src/worklet/engine-processor.ts
var _SonareRealtimeEngineWorkletProcessor = class _SonareRealtimeEngineWorkletProcessor {
  constructor(options = {}, transport) {
    this.closed = false;
    this.lastMeterFrame = Number.NEGATIVE_INFINITY;
    // Latest metronome gains/click length pushed via 'syncMetronome'. The
    // SetMetronome command only toggles enabled state; the config arrives here.
    this.metronomeConfig = { ...DEFAULT_METRONOME_CONFIG };
    this.liveClips = /* @__PURE__ */ new Map();
    this.pagedClipProviders = /* @__PURE__ */ new Map();
    this.pendingPagedClips = /* @__PURE__ */ new Map();
    this.sampleRate = options.sampleRate ?? 48e3;
    this.blockSize = options.blockSize ?? 128;
    this.channelCount = Math.max(1, Math.floor(options.channelCount ?? 2));
    this.transport = transport;
    this.meterIntervalFrames = Math.max(0, Math.floor(options.meterIntervalFrames ?? 2048));
    this.commandRing = options.commandSharedBuffer ? this.commandRingFromSharedBuffer(options.commandSharedBuffer, options.commandRingCapacity) : void 0;
    this.telemetryRing = options.telemetrySharedBuffer ? this.telemetryRingFromSharedBuffer(
      options.telemetrySharedBuffer,
      options.telemetryRingCapacity
    ) : void 0;
    this.meterRing = options.meterSharedBuffer ? meterRingFromSharedBuffer(options.meterSharedBuffer, options.meterRingCapacity) : void 0;
    this.scopeRing = options.scopeSharedBuffer ? scopeRingFromSharedBuffer(
      options.scopeSharedBuffer,
      options.scopeRingCapacity,
      options.scopeBands
    ) : void 0;
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
    this.publishScope();
    this.publishExternalMidi();
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
  // Applies an out-of-band control-plane sync message on the AudioWorklet
  // thread. These handlers must remain bounded: expensive clip transforms are
  // performed on the main-thread mirror, and long pre-baked PCM arrives in
  // small pages before the final lightweight clip schedule is committed.
  receiveSync(message) {
    if (this.closed) {
      return;
    }
    switch (message.type) {
      case "syncClips":
        this.liveClips.clear();
        for (const clip of message.clips) {
          if (clip.id !== void 0) {
            this.liveClips.set(clip.id, clip);
          }
        }
        this.engine.setClips(message.clips);
        break;
      case "syncClipsDelta":
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
      case "syncClipPageProvider": {
        const provider = this.engine.createClipPageProvider(
          message.numChannels,
          message.numSamples,
          message.pageFrames
        );
        this.pagedClipProviders.set(message.clipId, provider.id);
        this.pendingPagedClips.set(message.clipId, message.clip);
        break;
      }
      case "syncClipPage": {
        const providerId = this.pagedClipProviders.get(message.clipId);
        if (providerId !== void 0) {
          this.engine.supplyClipPage(providerId, message.pageIndex, message.channels);
        }
        break;
      }
      case "syncClipPageCommit": {
        const providerId = this.pagedClipProviders.get(message.clipId);
        const clip = this.pendingPagedClips.get(message.clipId);
        if (providerId !== void 0 && clip) {
          this.liveClips.set(message.clipId, { ...clip, pageProvider: providerId });
          this.pendingPagedClips.delete(message.clipId);
          this.engine.setClips(Array.from(this.liveClips.values()));
        }
        break;
      }
      case "syncMidiClips":
        this.engine.setMidiClips(message.clips);
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
      case "syncTempo":
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
            message.timeSignature.denominator
          );
        }
        break;
      case "syncMixer":
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
      case "syncCapture":
        this.engine.setCaptureBuffer(message.channels, message.bufferFrames);
        this.engine.setCaptureSource(message.source);
        this.engine.setRecordOffsetSamples(message.recordOffsetSamples);
        this.engine.setInputMonitor(message.inputMonitor.enabled, message.inputMonitor.gain);
        break;
      case "syncTrackStripEqBand":
        this.engine.setTrackStripEqBandJson(message.trackId, message.bandIndex, message.bandJson);
        break;
      case "syncMasterStripEqBand":
        this.engine.setMasterStripEqBandJson(message.bandIndex, message.bandJson);
        break;
      case "syncTrackStripInsertBypassed":
        this.engine.setTrackStripInsertBypassed(
          message.trackId,
          message.insertIndex,
          message.bypassed,
          message.resetOnBypass
        );
        break;
      case "syncMasterStripInsertBypassed":
        this.engine.setMasterStripInsertBypassed(
          message.insertIndex,
          message.bypassed,
          message.resetOnBypass
        );
        break;
      case "syncTrackStripInsertParamByName":
        this.engine.setTrackStripInsertParamByName(
          message.trackId,
          message.insertIndex,
          message.paramName,
          message.value
        );
        break;
      case "syncMasterStripInsertParamByName":
        this.engine.setMasterStripInsertParamByName(
          message.insertIndex,
          message.paramName,
          message.value
        );
        break;
      case "syncBusStripInsertParamByName":
        this.engine.setBusStripInsertParamByName(
          message.busId,
          message.insertIndex,
          message.paramName,
          message.value
        );
        break;
      case "syncTrackStripPan":
        this.engine.setTrackStripPan(message.trackId, message.pan);
        break;
      case "syncTrackStripPanLaw":
        this.engine.setTrackStripPanLaw(message.trackId, message.panLaw);
        break;
      case "syncTrackStripPanMode":
        this.engine.setTrackStripPanMode(message.trackId, message.panMode);
        break;
      case "syncTrackStripDualPan":
        this.engine.setTrackStripDualPan(message.trackId, message.leftPan, message.rightPan);
        break;
      case "syncTrackStripChannelDelaySamples":
        this.engine.setTrackStripChannelDelaySamples(message.trackId, message.delaySamples);
        break;
      case "syncBuiltinInstrument":
        this.engine.setBuiltinInstrument(message.config, message.destinationId);
        break;
      case "syncSynthInstrument":
        this.engine.setSynthInstrument(message.patch, message.destinationId);
        break;
      case "syncLoadSoundFont":
        this.engine.loadSoundFont(message.data);
        break;
      case "syncSf2Instrument":
        this.engine.setSf2Instrument(message.config, message.destinationId);
        break;
      case "syncMidiFx":
        this.engine.setMidiFx(message.destinationId, message.configJson ?? "");
        break;
      case "syncClearMidiFx":
        this.engine.clearMidiFx(message.destinationId);
        break;
      case "syncMidiNoteOn":
        this.engine.pushMidiNoteOn(
          message.destinationId,
          message.group,
          message.channel,
          message.note,
          message.velocity,
          message.renderFrame
        );
        break;
      case "syncMidiNoteOff":
        this.engine.pushMidiNoteOff(
          message.destinationId,
          message.group,
          message.channel,
          message.note,
          message.velocity,
          message.renderFrame
        );
        break;
      case "syncMidiCc":
        this.engine.pushMidiCc(
          message.destinationId,
          message.group,
          message.channel,
          message.controller,
          message.value,
          message.renderFrame
        );
        break;
      case "syncMidiSysex":
        this.engine.pushMidiSysex(message.destinationId, message.data, message.renderFrame);
        break;
      case "syncMidiPanic":
        this.engine.pushMidiPanic(message.renderFrame);
        break;
      case "syncMidiDestinationExternal":
        this.engine.setMidiDestinationExternal(message.destinationId, message.external);
        break;
      case "syncExternalMidiClock":
        this.engine.setExternalMidiClockEnabled(message.enabled);
        break;
    }
  }
  receiveCaptureRequest(message) {
    if (this.closed) {
      return;
    }
    try {
      if (message.op === "status") {
        const status = this.engine.captureStatus();
        this.transport?.postMessage?.({
          type: "captureResponse",
          requestId: message.requestId,
          ok: true,
          status: {
            capturedFrames: status.capturedFrames,
            overflowCount: status.overflowCount,
            armed: status.armed,
            punchEnabled: status.punchEnabled,
            source: status.source,
            recordOffsetSamples: status.recordOffsetSamples
          }
        });
        return;
      }
      if (message.op === "read") {
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
          type: "captureResponse",
          requestId: message.requestId,
          ok: true,
          channels
        });
        return;
      }
      this.engine.resetCapture();
      this.transport?.postMessage?.({
        type: "captureResponse",
        requestId: message.requestId,
        ok: true
      });
    } catch (error) {
      this.transport?.postMessage?.({
        type: "captureResponse",
        requestId: message.requestId,
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  receiveTransportRequest(message) {
    if (this.closed) {
      return;
    }
    try {
      this.transport?.postMessage?.({
        type: "transportResponse",
        requestId: message.requestId,
        ok: true,
        state: this.engine.getTransportState()
      });
    } catch (error) {
      this.transport?.postMessage?.({
        type: "transportResponse",
        requestId: message.requestId,
        ok: false,
        error: error instanceof Error ? error.message : String(error)
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
      case 10 /* SetSoloMute */:
        this.engine.setSoloMute(
          Math.trunc(Number(command.targetId ?? 0)),
          Boolean((Number(command.argInt ?? 0) & 2) !== 0),
          Boolean((Number(command.argInt ?? 0) & 1) !== 0),
          sampleTime
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
    if (this.meterIntervalFrames <= 0 || !this.transport && !this.meterRing) {
      return;
    }
    for (const item of this.engine.drainMeterTelemetry(64)) {
      const meter = meterFromEngine(item);
      if (meter.frame !== this.lastMeterFrame && meter.frame - this.lastMeterFrame < this.meterIntervalFrames) {
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
    const offset = writeIndex % ring.capacity * SONARE_METER_RING_RECORD_FLOATS;
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
  // the lock-free SAB scope ring. No allocation on the render path: records are
  // written field-by-field into the ring.
  publishScope() {
    const ring = this.scopeRing;
    if (!ring) {
      return;
    }
    for (const item of this.engine.drainScopeTelemetry(64)) {
      this.writeScopeRing(ring, item);
    }
  }
  // Drains queued external-MIDI events (already lowered to MIDI 1.0 bytes) and
  // forwards them to the main thread for delivery to Web MIDI output ports.
  // One batch per render block; skipped entirely when nothing is queued, so an
  // all-internal project never allocates or posts here.
  publishExternalMidi() {
    if (!this.transport?.postMessage) {
      return;
    }
    const events = this.engine.drainExternalMidi(256);
    if (events.length === 0) {
      return;
    }
    this.transport.postMessage({ type: "externalMidi", events });
  }
  writeScopeRing(ring, record) {
    const writeIndex = Atomics.load(ring.header, 0);
    const base = writeIndex % ring.capacity * ring.recordFloats;
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

// src/worklet/engine-register.ts
function registerSonareRealtimeEngineWorkletProcessor(name = "sonare-realtime-engine-processor") {
  const scope = globalThis;
  if (!scope.AudioWorkletProcessor || !scope.registerProcessor) {
    throw new Error("AudioWorkletProcessor is not available in this context.");
  }
  const Base = scope.AudioWorkletProcessor;
  class RegisteredSonareRealtimeEngineWorkletProcessor extends Base {
    constructor(options) {
      super();
      this.pendingMessages = [];
      const port = this.port;
      const processorOptions = options?.processorOptions ?? {};
      void this.initializeEmbind(processorOptions, port);
      const onMessage = (event) => {
        if (!this.bridge) {
          if (this.pendingMessages.length < 1024) {
            this.pendingMessages.push(event.data);
          }
          return;
        }
        if (isEngineCommandRecord(event.data)) {
          this.bridge.receiveCommand(event.data);
        } else if (isEngineSyncMessage(event.data)) {
          this.bridge.receiveSync(event.data);
        } else if (isEngineCaptureRequestMessage(event.data)) {
          this.bridge.receiveCaptureRequest(event.data);
        } else if (isEngineTransportRequestMessage(event.data)) {
          this.bridge.receiveTransportRequest(event.data);
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
      if (this.bridge) {
        return this.bridge.process(inputs, outputs);
      }
      const output = outputs[0];
      for (const channel of output ?? []) {
        channel.fill(0);
      }
      return true;
    }
    replayPendingMessages() {
      const messages = this.pendingMessages.splice(0);
      for (const data of messages) {
        if (isEngineCommandRecord(data)) {
          this.bridge?.receiveCommand(data);
        } else if (isEngineSyncMessage(data)) {
          this.bridge?.receiveSync(data);
        } else if (isEngineCaptureRequestMessage(data)) {
          this.bridge?.receiveCaptureRequest(data);
        } else if (isEngineTransportRequestMessage(data)) {
          this.bridge?.receiveTransportRequest(data);
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
            throw new Error("embind realtime engine module is not initialized.");
          }
          await init({
            locateFile: (path) => path,
            wasmBinary: options.wasmBinary,
            moduleFactory
          });
        }
        this.bridge = new SonareRealtimeEngineWorkletProcessor(options, {
          postMessage: (message) => port?.postMessage?.(message),
          onMeter: (meter) => port?.postMessage?.(meter)
        });
        for (const message of options.initialSyncMessages ?? []) {
          this.bridge.receiveSync(message);
        }
        for (const command of options.initialCommands ?? []) {
          this.bridge.receiveCommand(command);
        }
        this.replayPendingMessages();
        port?.postMessage?.({ type: "ready", runtimeTarget: "embind" });
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

// src/worklet/mixer-processor.ts
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
      gainReductionDb: Number.NaN
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

// src/worklet/voice-changer-processor.ts
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
export {
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
  SonareWorkletProcessor,
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
  sonareEngineCommandRingBufferByteLength,
  sonareEngineTelemetryRingBufferByteLength,
  sonareMeterRingBufferByteLength,
  sonareScopeRingBufferByteLength,
  sonareSpectrumRingBufferByteLength,
  writeSonareEngineTelemetryRingBuffer
};
