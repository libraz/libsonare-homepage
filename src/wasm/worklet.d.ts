import { WasmExternalMidiEvent, WasmEngineTransportState, WasmEngineTempoSegment, WasmEngineTimeSignatureSegment, WasmEngineParameterInfo, WasmEngineAutomationPoint, WasmEngineMarker, WasmEngineMetronomeConfig, WasmEngineGraphSpec, WasmEngineClip, WasmClipPageRequest, WasmEngineCaptureStatus, WasmEngineProcessWithMonitorResult, WasmEngineBounceOptions, WasmEngineBounceResult, WasmEngineFreezeOptions, WasmEngineFreezeResult, WasmEngineTelemetry, WasmEngineMeterTelemetry, WasmEngineMeterTelemetryWide, WasmEngineScopeTelemetry, SonareModule } from './sonare.js';

declare const SYNTH_ENGINE_MODES: readonly ["default", "subtractive", "fm", "karplus-strong", "modal", "additive", "percussion", "piano", "pipe-organ", "bowed-string", "reed", "brass", "flute", "plucked-string", "vocal", "free-reed"];
declare const SYNTH_OSC_WAVEFORMS: readonly ["default", "sine", "saw", "square", "triangle", "noise"];
declare const SYNTH_FILTER_MODELS: readonly ["default", "svf", "moog-ladder", "diode-ladder", "sallen-key"];
declare const SYNTH_FILTER_OUTPUTS: readonly ["default", "lowpass", "bandpass", "highpass"];
declare const SYNTH_BODY_TYPES: readonly ["default", "none", "guitar", "violin", "wood-tube", "brass-bell", "vocal"];
declare const SYNTH_MOD_SOURCES: readonly ["none", "amp-env", "filter-env", "lfo1", "lfo2", "velocity", "key-track", "mod-wheel", "random"];
declare const SYNTH_MOD_DESTINATIONS: readonly ["none", "pitch-cents", "cutoff-cents", "amp-gain", "pan-units"];
/** NativeSynth engine selector ({@link SynthPatch}; `'default'` keeps the base patch's). */
type SynthEngineMode = (typeof SYNTH_ENGINE_MODES)[number];
/** NativeSynth oscillator waveform (`'default'` keeps the base patch's). */
type SynthOscWaveform = (typeof SYNTH_OSC_WAVEFORMS)[number];
/** NativeSynth filter model — the character core (`'default'` keeps the base patch's). */
type SynthFilterModel = (typeof SYNTH_FILTER_MODELS)[number];
/** NativeSynth filter output (SVF only; `'default'` keeps the base patch's). */
type SynthFilterOutput = (typeof SYNTH_FILTER_OUTPUTS)[number];
/** NativeSynth body/formant resonance voicing (`'default'` keeps the base patch's). */
type SynthBodyType = (typeof SYNTH_BODY_TYPES)[number];
/** {@link SynthPatch} mod-matrix source. */
type SynthModSource = (typeof SYNTH_MOD_SOURCES)[number];
/** {@link SynthPatch} mod-matrix destination. */
type SynthModDestination = (typeof SYNTH_MOD_DESTINATIONS)[number];
/** One {@link SynthPatch} mod-matrix routing (name or C ordinal per field). */
interface SynthModRouting {
    source: SynthModSource | number;
    destination: SynthModDestination | number;
    /** Destination units at full source deflection. */
    depth: number;
}
/**
 * Versioned NativeSynth patch for {@link Project.bounceWithSynthInstrument}
 * and {@link RealtimeEngine.setSynthInstrument}.
 *
 * The patch starts from a BASE — the named `preset` (see
 * {@link synthPresetNames}; a `"va:"` routing prefix is accepted) or, when
 * `preset` is omitted, the default subtractive patch. Every numeric field then
 * uses "0 / omit => keep the base value" (non-zero values override, clamped to
 * their audible ranges) and the enum fields reserve `'default'` as keep. The
 * frozen C ABI has no per-field presence bits, so explicit zero numeric
 * overrides (for example `ampSustain: 0`) cannot be represented; they keep the
 * base value. A non-empty `modRoutings` REPLACES the base mod matrix.
 *
 * Mode-specific deep parameters (FM operator stacks, modal mode tables,
 * drawbar registrations, kit pieces, piano strings) travel inside the named
 * presets; the patch exposes the wrapper sections every engine shares.
 */
interface SynthPatch {
    /**
     * Optional binding convenience for JS realtime/offline helpers. It is not
     * part of the NativeSynth patch itself; Python uses explicit
     * `(destination_id, patch)` bindings instead. Defaults to `0`.
     */
    destinationId?: number;
    /** Resolve MIDI channels from incoming GM bank/program changes; defaults to false. */
    useGmPrograms?: boolean;
    /** Base preset name (see {@link synthPresetNames}); omit for the init patch. */
    preset?: string;
    engineMode?: SynthEngineMode | number;
    waveform?: SynthOscWaveform | number;
    /** Detuned-stack width [1, 7]. */
    unison?: number;
    detuneCents?: number;
    /** Per-voice slow pitch drift depth (cents). */
    driftCents?: number;
    /** Pre-filter drive [0, 1]. */
    drive?: number;
    filterModel?: SynthFilterModel | number;
    filterOutput?: SynthFilterOutput | number;
    cutoffHz?: number;
    resonanceQ?: number;
    /** Cutoff keyboard tracking [0, 1]. */
    keyTrack?: number;
    envToCutoffCents?: number;
    velToCutoffCents?: number;
    ampAttackMs?: number;
    ampDecayMs?: number;
    /** 0 / omit keeps the base value; explicit zero sustain is not representable. */
    ampSustain?: number;
    ampReleaseMs?: number;
    filterAttackMs?: number;
    filterDecayMs?: number;
    /** 0 / omit keeps the base value; explicit zero sustain is not representable. */
    filterSustain?: number;
    filterReleaseMs?: number;
    lfoRateHz?: number;
    lfoToPitchCents?: number;
    lfo2RateHz?: number;
    glideMs?: number;
    body?: SynthBodyType | number;
    /** Body resonance mix [0, 1]. */
    bodyMix?: number;
    /** Seeded per-voice pan scatter [0, 1]. */
    stereoSpread?: number;
    /** Mod matrix (at most 8 routings; REPLACES the base matrix when non-empty). */
    modRoutings?: SynthModRouting[];
    /** Master output gain (linear). */
    gain?: number;
    /** Max simultaneous voices [1, 64]. */
    polyphony?: number;
    /** Gain-neutral bus saturation [0, 1]. */
    busDrive?: number;
}
type ProjectMidiCcBindingKind = 0 | 1 | 2 | 3;
/** MIDI CC <-> automation binding descriptor used by CC learn/conversion helpers. */
interface ProjectMidiCcBinding {
    ccNumber: number;
    /** MIDI channel 0..15, or 255 for any channel. */
    channel: number;
    /** 0 = 7-bit CC, 1 = 14-bit CC, 2 = RPN, 3 = NRPN. */
    kind: ProjectMidiCcBindingKind;
    ccLsbNumber?: number;
    selectorMsb?: number;
    selectorLsb?: number;
    paramId: number;
    minValue: number;
    maxValue: number;
}

type PanMode = 'balance' | 'pan' | 'stereoPan' | 'stereo-pan' | 'dualPan' | 'dual-pan' | number;
/**
 * Interpolation curve for scheduled automation events
 * (see {@link Mixer.scheduleInsertAutomation}).
 */
type AutomationCurve = 'linear' | 'exponential' | 'hold' | 's-curve';
/**
 * Pan law applied when computing left/right gains from a pan position
 * (see {@link Mixer.setPanLaw}). On mono strips it changes the centre gain;
 * on stereo Balance strips it changes only the far-channel taper, while centre
 * remains unity. Maps to the underlying integer code.
 */
type PanLaw = 'const3dB' | 'const4.5dB' | 'const6dB' | 'linear0dB';
/** Accepted pan-law name aliases for mixer and realtime-engine inputs. */
type PanLawName = PanLaw | 'const-3db' | '-3db' | 'const-4.5db' | '-4.5db' | 'const-6db' | '-6db' | 'linear-0db' | 'linear' | '0db';
/** Pan-law name or raw C ABI ordinal. */
type PanLawInput = PanLawName | number;
/** Pre/post-fader send timing (see {@link Mixer.addSend}). */
type SendTiming = 'preFader' | 'postFader';

/**
 * Equalizer band type (string union mirroring `sonare::mastering::eq::EqBandType`).
 */
type EqBandType = 'Peak' | 'LowShelf' | 'HighShelf' | 'LowPass' | 'HighPass' | 'BandPass' | 'Notch' | 'TiltShelf' | 'FlatTilt';
/** Biquad coefficient design mode. */
type EqCoeffMode = 'Rbj' | 'Vicanek';
/** Stereo placement for an EQ band. */
type EqStereoPlacement = 'Stereo' | 'Left' | 'Right' | 'Mid' | 'Side';
/** Per-band phase behaviour. */
type EqBandPhase = 'Inherit' | 'ZeroLatency' | 'NaturalPhase' | 'LinearPhase';
/**
 * Equalizer band configuration accepted by {@link StreamingEqualizer.setBand}.
 *
 * All fields are optional; omitted values fall back to the C++ band defaults
 * (Peak, 1000 Hz, 0 dB gain, Butterworth Q, disabled).
 */
interface EqBand {
    type?: EqBandType;
    frequencyHz?: number;
    gainDb?: number;
    q?: number;
    enabled?: boolean;
    coeffMode?: EqCoeffMode;
    slopeDbOct?: number;
    placement?: EqStereoPlacement;
    phase?: EqBandPhase;
    soloed?: boolean;
    bypassed?: boolean;
    proportionalQ?: boolean;
    proportionalQStrength?: number;
    dynamic?: boolean;
    thresholdDb?: number;
    autoThreshold?: boolean;
    ratio?: number;
    rangeDb?: number;
    attackMs?: number;
    releaseMs?: number;
    lookaheadMs?: number;
    externalSidechain?: boolean;
    sidechainFreqHz?: number;
    sidechainQ?: number;
}
type VoicePresetId = 'neutral-monitor' | 'bright-idol' | 'soft-whisper' | 'deep-narrator' | 'robot-mascot' | 'dark-villain';
type VoicePresetCategory = 'monitor' | 'bright' | 'soft' | 'deep' | 'robot' | 'dark' | 'custom';
interface RealtimeVoiceChangerPresetMetadata {
    schemaVersion: 1;
    id: string;
    name: string;
    description?: string;
    category: VoicePresetCategory;
}
type RealtimeVoiceChangerPreset = (RealtimeVoiceChangerPresetMetadata & {
    dsp: Record<string, unknown>;
    macros?: never;
}) | (RealtimeVoiceChangerPresetMetadata & {
    macros: Record<string, number>;
    dsp?: never;
});
type RealtimeVoiceChangerConfigInput = VoicePresetId | RealtimeVoiceChangerPreset;
/**
 * Flat (POD) realtime voice-changer configuration. Keys are camelCase to match
 * the Node addon getter, so a preset config reads identically across both JS
 * surfaces (the underlying C ABI / Python POD uses the snake_case equivalents).
 */
interface RealtimeVoiceChangerPodConfig {
    inputGainDb: number;
    outputGainDb: number;
    wetMix: number;
    retuneSemitones: number;
    retuneMix: number;
    retuneGrainSize: number;
    formantFactor: number;
    formantAmount: number;
    formantBody: number;
    formantBrightness: number;
    formantNasal: number;
    eqHighpassHz: number;
    eqBodyDb: number;
    eqPresenceDb: number;
    eqAirDb: number;
    gateThresholdDb: number;
    gateAttackMs: number;
    gateReleaseMs: number;
    gateRangeDb: number;
    compressorThresholdDb: number;
    compressorRatio: number;
    compressorAttackMs: number;
    compressorReleaseMs: number;
    compressorMakeupGainDb: number;
    deesserFrequencyHz: number;
    deesserThresholdDb: number;
    deesserRatio: number;
    deesserRangeDb: number;
    reverbMix: number;
    reverbTimeMs: number;
    reverbDamping: number;
    reverbSeed: number;
    limiterCeilingDb: number;
    limiterReleaseMs: number;
    /** Non-zero enables the 4x-oversampled inter-sample-peak limiter (default enabled). */
    limiterEnableIspLimiter: boolean;
    /** True-peak ceiling in dBTP applied by the ISP limiter (default -1.0). */
    limiterIspCeilingDbtp: number;
}

type EngineClip = WasmEngineClip;
type ClipPageRequest = WasmClipPageRequest;
type EngineParameterInfo = WasmEngineParameterInfo;
type EngineAutomationPoint = WasmEngineAutomationPoint;
type EngineMarker = WasmEngineMarker;
type EngineMetronomeConfig = WasmEngineMetronomeConfig;
type EngineGraphSpec = WasmEngineGraphSpec;
type EngineCaptureStatus = WasmEngineCaptureStatus;
type EngineCaptureSource = EngineCaptureStatus['source'] | number;
type EngineBounceOptions = WasmEngineBounceOptions;
type EngineBounceResult = WasmEngineBounceResult;
type EngineFreezeOptions = WasmEngineFreezeOptions;
type EngineFreezeResult = WasmEngineFreezeResult;
type EngineTelemetry = WasmEngineTelemetry;
type EngineMeterTelemetry = WasmEngineMeterTelemetry;
type EngineMeterTelemetryWide = WasmEngineMeterTelemetryWide;
type EngineScopeTelemetry = WasmEngineScopeTelemetry;
type EngineTransportState = WasmEngineTransportState;
type EngineTempoSegment = WasmEngineTempoSegment;
type EngineTimeSignatureSegment = WasmEngineTimeSignatureSegment;
interface EngineTrackSend {
    busId: number;
    levelDb?: number;
    enabled?: boolean;
    /**
     * Pre/post-fader tap point. Defaults to post-fader when omitted, matching the
     * historical lane-send behavior and the scene-JSON default.
     */
    sendTiming?: SendTiming | number;
}
interface EngineTrackLane {
    trackId: number;
    sends?: EngineTrackSend[];
    /**
     * Bus the lane's post-fader output sums into instead of the master mix
     * (group/folder routing); 0 or absent keeps the lane on the master mix.
     */
    outputBusId?: number;
    /**
     * Input channel layout of the source feeding this lane (`SonareChannelLayout`:
     * 0 mono, 1 stereo, 2 5.1, 3 7.1). Absent defaults to stereo. Stored but inert
     * until the surround DSP path lands.
     */
    sourceChannelLayout?: number;
}
/** Per-track cue/monitor tap mode: off, pre-fader listen, or after-fader listen. */
type EngineTrackMonitorMode = 'off' | 'pfl' | 'afl' | 0 | 1 | 2;
interface EngineBus {
    busId: number;
    gainDb?: number;
    /**
     * Channel layout of the bus (`SonareChannelLayout`: 0 mono, 1 stereo, 2 5.1,
     * 3 7.1). A surround layout makes this a surround group bus: lanes routed to
     * it are surround-panned and it sums into the master plane-by-plane. Defaults
     * to stereo.
     */
    channelLayout?: number;
}
interface EngineMidiEvent {
    renderFrame: number;
    word0?: number;
    word1?: number;
    word2?: number;
    word3?: number;
    wordCount?: number;
    group?: number;
    sysexHandle?: number;
    data0?: number;
    data1?: number;
}
interface EngineMidiClipSchedule {
    id?: number;
    trackId?: number;
    destinationId?: number;
    startSample?: number;
    startPpq?: number;
    lengthSamples?: number;
    loop?: boolean;
    loopLengthSamples?: number;
    events: EngineMidiEvent[];
}
/** Options for {@link RealtimeEngine.bindMidiCc}. All fields are optional. */
interface MidiCcBindOptions {
    /** Lower end of the mapped parameter range. Default `0`. */
    minValue?: number;
    /** Upper end of the mapped parameter range. Default `1`. */
    maxValue?: number;
}
declare class RealtimeEngine {
    private native;
    constructor(sampleRate?: number, maxBlockSize?: number, commandCapacity?: number, telemetryCapacity?: number, maxChannels?: number);
    prepare(sampleRate: number, maxBlockSize: number, commandCapacity?: number, telemetryCapacity?: number, maxChannels?: number): void;
    /** Queue a sample-accurate parameter change (engine kSetParam). */
    setParameter(paramId: number, value: number, renderFrame?: number): void;
    /** Queue a smoothed parameter change (engine kSetParamSmoothed). */
    setParameterSmoothed(paramId: number, value: number, renderFrame?: number): void;
    /**
     * Set the default ramp time (ms) for engine-level smoothed parameters —
     * fader/pan glides, insert-parameter automation, and MIDI-CC mappings. The
     * default is 20 ms; pass `0` for instant (un-ramped) changes.
     */
    setParamSmoothingMs(smoothingMs: number): void;
    setSoloMute(laneIndex: number, solo: boolean, mute: boolean, renderFrame?: number): void;
    /** Queue a per-track PFL/AFL monitor tap mode change. */
    setTrackMonitorMode(laneIndex: number, mode: EngineTrackMonitorMode, renderFrame?: number): void;
    setMidiClips(clips: readonly EngineMidiClipSchedule[]): void;
    setBuiltinInstrument(config?: {
        destinationId?: number;
    } & Record<string, unknown>, destinationId?: number): void;
    /**
     * Bind the patch-driven NativeSynth to a realtime MIDI destination. `patch`
     * is a {@link SynthPatch} or a preset-name string (`'saw-lead'` /
     * `'va:saw-lead'`; see {@link synthPresetNames}), resolving exactly like
     * {@link Project.bounceWithSynthInstrument}. Live note/CC commands and
     * scheduled MIDI clips routed to that destination render through the synth.
     * Unknown preset names throw. An object patch's `destinationId` is a JS
     * binding convenience, not part of the NativeSynth patch itself.
     */
    setSynthInstrument(patch?: SynthPatch | string, destinationId?: number): void;
    /**
     * Load (parse) SoundFont 2 bytes into the engine so SF2 instruments can be
     * bound with {@link setSf2Instrument}. The host fetches the `.sf2` and
     * passes the raw bytes; they are copied into linear memory for the call and
     * not referenced afterwards. Replaces any previously loaded SoundFont.
     */
    loadSoundFont(data: Uint8Array): void;
    /**
     * Bind a GS-compatible SoundFont player to a realtime MIDI destination, fed
     * by the engine's loaded SoundFont ({@link loadSoundFont}). Live note/CC
     * commands and scheduled MIDI clips routed to that destination render
     * through the player (16 MIDI channels, channel 10 drums, GS NRPN part
     * edits, GS/GM SysEx resets). Without a loaded SoundFont — or for programs
     * the SoundFont does not cover — notes play through the built-in
     * synthesizer GM fallback bank (the data-free floor).
     */
    setSf2Instrument(config?: {
        destinationId?: number;
        gain?: number;
        polyphony?: number;
        preferModelForModeledFamilies?: boolean;
    }, destinationId?: number): void;
    clearMidiInstrument(destinationId?: number): void;
    midiInstrumentCount(): number;
    /**
     * Bind a live MIDI CC to an engine automation parameter. The MIDI event still
     * reaches the destination instrument; when bound, its 7-bit value is also
     * mapped into [minValue, maxValue] for `paramId`.
     */
    bindMidiCc(channel: number, controller: number, paramId: number, options?: MidiCcBindOptions): void;
    /** Bind a 7/14-bit CC, RPN, or NRPN descriptor to a live parameter. */
    bindMidiCcBinding(binding: ProjectMidiCcBinding): void;
    clearMidiCcBindings(): void;
    midiCcBindingCount(): number;
    /** Install/replace a live non-destructive MIDI-FX insert for one destination. */
    setMidiFx(destinationId: number, configJson: string): void;
    clearMidiFx(destinationId?: number): void;
    /** Enable the engine-owned live MIDI input source for a destination. */
    setMidiInputSource(destinationId?: number): void;
    clearMidiInputSource(): void;
    midiInputPendingCount(): number;
    /**
     * Route a destination's (track lane's) MIDI to the external output queue
     * instead of the internal instrument rack, so the track plays an external
     * device. Clearing it restores internal-synth playback.
     */
    setMidiDestinationExternal(destinationId: number, external: boolean): void;
    /**
     * Enable/disable forwarding MIDI clock + transport (start/continue/stop) to
     * the external output queue so external gear tracks the transport tempo.
     */
    setExternalMidiClockEnabled(enabled: boolean): void;
    /** Count of external-MIDI events dropped because the output queue was full. */
    externalMidiDroppedCount(): number;
    externalMidiPendingCount(): number;
    /**
     * Drain queued external-MIDI events, already lowered to MIDI 1.0 byte
     * messages ready to write to a Web MIDI output port. Call once per audio
     * block / animation frame. `maxRecords` caps the number of output events
     * returned — the shared unit across every surface. Events past the cap stay
     * queued for the next call (lossless); call again to drain the rest.
     */
    drainExternalMidi(maxRecords?: number): WasmExternalMidiEvent[];
    /** Scalar, allocation-free external-MIDI drain for AudioWorklet SAB output. */
    popExternalMidiToScratch(): boolean;
    externalMidiScratchDestinationId(): number;
    externalMidiScratchRenderFrame(): number;
    externalMidiScratchByteWord(): number;
    externalMidiScratchByteCount(): number;
    consumeExternalMidiScratch(): void;
    pushMidiInputNoteOn(group: number, channel: number, note: number, velocity: number, portTimeSamples?: number): void;
    pushMidiInputNoteOff(group: number, channel: number, note: number, velocity?: number, portTimeSamples?: number): void;
    pushMidiInputCc(group: number, channel: number, controller: number, value: number, portTimeSamples?: number): void;
    pushMidiNoteOn(destinationId: number, group: number, channel: number, note: number, velocity: number, renderFrame?: number): void;
    pushMidiNoteOff(destinationId: number, group: number, channel: number, note: number, velocity?: number, renderFrame?: number): void;
    /**
     * Queue an immediate (live) MIDI control change to a MIDI destination
     * (engine kMidiCcImmediate). `group`/`channel` are 0..15; `controller`/`value`
     * are 7-bit (0..127). `renderFrame` is the frame to fire at, or -1 for
     * immediate. Mirrors the Node/Python/C-ABI `pushMidiCc`.
     */
    pushMidiCc(destinationId: number, group: number, channel: number, controller: number, value: number, renderFrame?: number): void;
    /** Queue one immediate MIDI 1.0 channel-voice UMP word for a destination. */
    pushMidiUmp(destinationId: number, word0: number, renderFrame?: number): void;
    /**
     * Queue an immediate (live) MIDI SysEx frame to a MIDI destination. `data` is
     * the full message including the leading 0xF0 and trailing 0xF7 (1..512
     * bytes). `renderFrame` is the frame to fire at, or -1 for immediate. Mirrors
     * the Node/Python/C-ABI `pushMidiSysex`.
     */
    pushMidiSysex(destinationId: number, data: Uint8Array, renderFrame?: number): void;
    /**
     * Queue a MIDI panic (all-notes-off) releasing every sounding note at
     * `renderFrame` (-1 = immediate). Mirrors the C-ABI `pushMidiPanic`.
     */
    pushMidiPanic(renderFrame?: number): void;
    /**
     * Remove all registered parameters (and their automation lanes). Control-thread
     * only; not realtime-safe. Mirrors the C-ABI `clearParameters`.
     */
    clearParameters(): void;
    /** Read back the current transport state snapshot. */
    getTransportState(): EngineTransportState;
    play(renderFrame?: number): void;
    stop(renderFrame?: number): void;
    seekSample(timelineSample: number, renderFrame?: number): void;
    /**
     * Snaps every in-flight parameter ramp (engine-level smoothed params, mixer
     * lane fader/pan/gate, bus gains) to its target value. Offline renders call
     * this after a priming process() block so the first audible block renders at
     * settled values instead of ramping in from defaults.
     */
    settleParameters(): void;
    /** Drains queued commands on an offline/control-only engine immediately. */
    flushControlCommands(): void;
    seekPpq(ppq: number, renderFrame?: number): void;
    /** Set a finite tempo in the range (0, 100000] BPM. */
    setTempo(bpm: number): void;
    setTempoSegments(segments: readonly EngineTempoSegment[]): void;
    setTimeSignature(numerator: number, denominator: number): void;
    setTimeSignatureSegments(segments: readonly EngineTimeSignatureSegment[]): void;
    sampleAtPpq(ppq: number): number;
    setLoop(startPpq: number, endPpq: number, enabled?: boolean): void;
    addParameter(info: EngineParameterInfo): void;
    parameterCount(): number;
    parameterInfoByIndex(index: number): EngineParameterInfo;
    parameterInfo(id: number): EngineParameterInfo;
    setAutomationLane(paramId: number, points: EngineAutomationPoint[]): void;
    automationLaneCount(): number;
    setMarkers(markers: EngineMarker[]): void;
    markerCount(): number;
    markerByIndex(index: number): EngineMarker;
    marker(id: number): EngineMarker;
    seekMarker(markerId: number, renderFrame?: number): void;
    setLoopFromMarkers(startMarkerId: number, endMarkerId: number): void;
    /** Set a metronome config; click lengths are limited to one second. */
    setMetronome(config: EngineMetronomeConfig): void;
    metronome(): Required<EngineMetronomeConfig>;
    countInEndSample(startSample: number, bars: number): number;
    setGraph(spec: EngineGraphSpec): void;
    graphNodeCount(): number;
    graphConnectionCount(): number;
    setClips(clips: EngineClip[]): void;
    /**
     * Returns the PCM generated for a tempo-sync clip by the control-thread
     * setter, or `null` when the clip did not require a tempo-sync bake.
     */
    prebakedClipChannels(clipId: number): Float32Array[] | null;
    clipCount(): number;
    setTrackLanes(lanes: Array<number | EngineTrackLane>): void;
    /**
     * Keys one insert of a lane strip from another lane's post-strip audio
     * (ducking/sidechainRouter inserts). sourceTrackId 0 removes the binding.
     */
    setLaneSidechain(trackId: number, insertIndex: number, sourceTrackId: number): void;
    setTrackBuses(buses: EngineBus[]): void;
    setBusStripJson(busId: number, sceneJson: string): void;
    setTrackStripJson(trackId: number, sceneJson: string): void;
    setTrackStripEqBand(trackId: number, bandIndex: number, band: EqBand | string): void;
    setTrackStripEqBandJson(trackId: number, bandIndex: number, bandJson: string): void;
    setTrackStripInsertBypassed(trackId: number, insertIndex: number, bypassed: boolean, resetOnBypass?: boolean): void;
    setMasterStripJson(sceneJson: string): void;
    setMasterStripEqBand(bandIndex: number, band: EqBand | string): void;
    setMasterStripEqBandJson(bandIndex: number, bandJson: string): void;
    setMasterStripInsertBypassed(insertIndex: number, bypassed: boolean, resetOnBypass?: boolean): void;
    /**
     * Changes one track-strip insert parameter in realtime, addressed by the
     * processor's JSON-key parameter name (see {@link masteringInsertParamInfo}).
     * Applied at the next block head via the engine command queue; safe during
     * playback. Throws if the track, insert, or name is unknown, the param is not
     * realtime-safe, or the command queue is full.
     */
    setTrackStripInsertParamByName(trackId: number, insertIndex: number, paramName: string, value: number): void;
    /** Master-strip counterpart of {@link setTrackStripInsertParamByName}. */
    setMasterStripInsertParamByName(insertIndex: number, paramName: string, value: number): void;
    /** Bus-strip counterpart of {@link setTrackStripInsertParamByName}. */
    setBusStripInsertParamByName(busId: number, insertIndex: number, paramName: string, value: number): void;
    /** Bus-strip counterpart of {@link setTrackStripInsertBypassed}. */
    setBusStripInsertBypassed(busId: number, insertIndex: number, bypassed: boolean, resetOnBypass?: boolean): void;
    /**
     * Resolves a track-lane insert parameter (by its JSON-key name) to the
     * reserved automation id usable with `setAutomationLane` / `setParameter`.
     * Returns `-1` when the track, insert, or name is unknown. (The Python binding
     * raises a `SonareError` for an unknown id where Node/WASM return the `-1`
     * sentinel.)
     */
    resolveTrackInsertAutomationId(trackId: number, insertIndex: number, paramName: string): number;
    resolveMasterInsertAutomationId(insertIndex: number, paramName: string): number;
    resolveBusInsertAutomationId(busId: number, insertIndex: number, paramName: string): number;
    /** Sets a track lane strip's pan position in realtime (glitch-free). */
    setTrackStripPan(trackId: number, pan: number): void;
    /** Sets a track lane strip's pan law in realtime. */
    setTrackStripPanLaw(trackId: number, panLaw: PanLawInput): void;
    /** Sets a track lane strip's pan mode in realtime. */
    setTrackStripPanMode(trackId: number, panMode: PanMode | number): void;
    /** Sets a track lane strip's dual-pan left/right positions in realtime. */
    setTrackStripDualPan(trackId: number, leftPan: number, rightPan: number): void;
    /**
     * Sets a track lane strip's inter-channel alignment delay (whole samples).
     * Adjusts strip latency, so PDC and reported graph latency are refreshed.
     */
    setTrackStripChannelDelaySamples(trackId: number, delaySamples: number): void;
    createClipPageProvider(numChannels: number, numSamples: number, pageFrames: number): ClipPageProvider;
    supplyClipPage(providerId: number, pageIndex: number, channels: Float32Array[]): void;
    clearClipPage(providerId: number, pageIndex: number): void;
    destroyClipPageProvider(providerId: number): void;
    popClipPageRequest(): ClipPageRequest | null;
    /**
     * Moves one native request into the binding's persistent scalar scratch.
     * This avoids creating an embind JS object in AudioWorklet process().
     */
    popClipPageRequestToScratch(): boolean;
    clipPageRequestScratchClipId(): number;
    clipPageRequestScratchSample(): number;
    /** Cumulative page misses dropped because the native bounded request queue was full. */
    clipPageRequestOverflowCount(): number;
    setCaptureBuffer(numChannels: number, capacityFrames: number): void;
    armCapture(armed?: boolean): void;
    setCapturePunch(startSample: number, endSample: number, enabled?: boolean): void;
    setCaptureSource(source: EngineCaptureSource): void;
    /** Positive values delay capture relative to the punch window. */
    setRecordOffsetSamples(offsetSamples: number): void;
    setInputMonitor(enabled: boolean, gain?: number): void;
    resetCapture(): void;
    captureStatus(): EngineCaptureStatus;
    capturedAudio(): Float32Array[];
    /**
     * Renders in place, adding engine output to `channels`. Zero each plane first
     * when it contains no upstream input.
     */
    process(channels: Float32Array[]): Float32Array[];
    /**
     * Allocates persistent per-channel WASM-heap scratch for the zero-copy
     * `getChannelBuffer` / `processPrepared` realtime path. Call once (off the
     * audio thread) before driving `processPrepared` from an AudioWorklet so the
     * render callback never allocates on the C++/JS heap.
     */
    prepareChannels(numChannels: number, maxFrames: number): void;
    /**
     * Returns a Float32Array view onto the persistent WASM-heap scratch for one
     * channel (valid for up to `numFrames`). Fill it, call `processPrepared`, then
     * read the same view back. Re-acquire after WASM memory growth.
     */
    getChannelBuffer(channel: number, numFrames: number): Float32Array;
    /**
     * Runs the engine in place over the prepared per-channel scratch buffers.
     * Zero each active span first when it contains no upstream input.
     * Allocation-free: safe to call on the AudioWorklet render thread after
     * `prepareChannels`.
     */
    processPrepared(numFrames: number): void;
    processWithMonitor(channels: Float32Array[]): WasmEngineProcessWithMonitorResult;
    renderOffline(channels: Float32Array[], blockSize?: number): Float32Array[];
    bounceOffline(options: EngineBounceOptions): EngineBounceResult;
    freezeOffline(options: EngineFreezeOptions): EngineFreezeResult;
    drainTelemetry(maxRecords?: number): EngineTelemetry[];
    popTelemetryToScratch(): boolean;
    telemetryScratchType(): number;
    telemetryScratchError(): number;
    telemetryScratchRenderFrame(): number;
    telemetryScratchTimelineSample(): number;
    telemetryScratchAudibleTimelineSample(): number;
    telemetryScratchGraphLatencySamplesQ8(): number;
    telemetryScratchValue(): number;
    popMeterTelemetryToScratch(): boolean;
    meterScratchTargetId(): number;
    meterScratchRenderFrame(): number;
    meterScratchValue(field: number): number;
    drainMeterTelemetry(maxRecords?: number): EngineMeterTelemetry[];
    /**
     * Drains pending meter telemetry as per-plane (wide) records for a surround
     * target. Use this for a surround mix target; {@link drainMeterTelemetry}
     * stays the stereo fast path. The two share one queue — call only one per
     * target. The live AudioWorklet path owns the queue via the stereo drain, so
     * this wide drain is for an offline (non-worklet) engine instance; per-plane
     * surround meters are not delivered over the live worklet meter ring.
     */
    drainMeterTelemetryWide(maxRecords?: number): EngineMeterTelemetryWide[];
    /**
     * Enables per-target spectrum + vectorscope capture. @param intervalFrames is
     * the minimum render-frame gap between snapshots (0 disables). @param bandCount
     * is the FFT band resolution (1..64); changing it re-prepares the tap. Returns
     * the band count actually applied.
     */
    configureScopeTelemetry(intervalFrames: number, bandCount: number): number;
    /** Drains pending spectrum + vectorscope snapshots (per mix target). */
    drainScopeTelemetry(maxRecords?: number): EngineScopeTelemetry[];
    popScopeTelemetryToScratch(): boolean;
    scopeScratchTargetId(): number;
    scopeScratchRenderFrame(): number;
    scopeScratchBandCount(): number;
    scopeScratchBand(index: number): number;
    scopeScratchPointCount(): number;
    scopeScratchPointLeft(index: number): number;
    scopeScratchPointRight(index: number): number;
    destroy(): void;
}
declare class ClipPageProvider {
    private readonly engine;
    readonly id: number;
    private disposed;
    constructor(engine: RealtimeEngine, id: number);
    supply(pageIndex: number, channels: Float32Array[]): void;
    clear(pageIndex: number): void;
    destroy(): void;
}

interface OpfsClipPageProviderOptions {
    path: string;
    numChannels: number;
    numSamples: number;
    pageFrames: number;
    dataOffsetBytes?: number;
    worker?: Worker;
    terminateWorkerOnClose?: boolean;
    /** Internal bridge hook used to mirror a supplied page into an AudioWorklet. */
    onPageSupplied?: (pageIndex: number, channels: Float32Array[]) => void;
    /** Internal bridge hook used to mirror an eviction into an AudioWorklet. */
    onPageCleared?: (pageIndex: number) => void;
    /** Internal bridge hook called after the local provider is destroyed. */
    onClose?: () => void;
}
interface OpfsClipPageProviderBinding {
    provider: ClipPageProvider;
    supplyPage(pageIndex: number): Promise<boolean>;
    supplyRequest(request: ClipPageRequest): Promise<boolean>;
    /** Evict one resident page from every configured consumer. */
    clearPage?(pageIndex: number): void;
    close(): void;
}

/**
 * Minimal engine surface the streamer drives. {@link RealtimeEngine} satisfies
 * this structurally; tests can supply a lightweight stand-in.
 */
interface ClipPageStreamerEngine {
    /** Drain one pending audio-thread page-miss request, or `null` when empty. */
    popClipPageRequest(): ClipPageStreamerRequest | null;
}
/**
 * A page miss reported by either a direct engine (`sample`) or the worklet
 * bridge (`pageIndex`). Exactly one position form is required.
 */
interface ClipPageStreamerRequest {
    clipId: number;
    sample?: number;
    pageIndex?: number;
}
/** A paged clip the streamer keeps fed from its backing store. */
interface ClipPageStreamSource {
    /** Clip schedule id passed to `setClips` (matches {@link ClipPageRequest.clipId}). */
    clipId: number;
    /** OPFS-backed page provider binding for this clip. */
    binding: OpfsClipPageProviderBinding;
    /** Page size in frames (must equal the provider's `pageFrames`). */
    pageFrames: number;
    /** Total sample count of the clip source. */
    numSamples: number;
}
interface ClipPageStreamerOptions {
    /**
     * Pages to prefetch ahead of the page a miss was reported for. Larger values
     * hide fetch latency at the cost of more resident memory. Default 2.
     */
    readAheadPages?: number;
    /**
     * Pages to retain behind the playback frontier before eviction, so a small
     * backward seek does not immediately miss. Default 1.
     */
    retainBehindPages?: number;
    /**
     * Upper bound on requests drained per {@link ClipPageStreamer.pump} call, so a
     * burst of misses cannot spin unbounded. Default 256.
     */
    maxRequestsPerPump?: number;
}
/**
 * Keeps OPFS-paged clips fed within a bounded sliding window around the live
 * playback position, so a multitrack arrangement never holds its full PCM in
 * WASM memory.
 *
 * The audio thread reports a page miss whenever the {@link ClipPlayer} reads a
 * sample whose page is not resident. {@link pump} drains those requests, fetches
 * the missing page plus a read-ahead window from each clip's backing store, and
 * evicts pages that fall outside the window via the provider's `clear`. The
 * resident set per clip is therefore bounded to
 * `retainBehindPages + readAheadPages + 1` pages regardless of clip length.
 *
 * Call {@link pump} on a cadence that keeps up with playback — typically once
 * per animation frame or per worklet control tick on the main/control thread
 * (never the audio thread; fetches are asynchronous).
 */
declare class ClipPageStreamer {
    private readonly engine;
    private readonly readAheadPages;
    private readonly retainBehindPages;
    private readonly maxRequestsPerPump;
    private readonly sources;
    private closed;
    constructor(engine: ClipPageStreamerEngine, options?: ClipPageStreamerOptions);
    /**
     * Register a paged clip. Pages already supplied to the provider before
     * registration (for example a primed first page) should be passed in
     * `initialResidentPages` so they participate in eviction.
     */
    addSource(source: ClipPageStreamSource, initialResidentPages?: Iterable<number>): void;
    /** Stop tracking a clip. Does not close its binding (the caller owns that). */
    removeSource(clipId: number): void;
    /**
     * Explicitly start a new playback generation after a host seek/loop. Resident
     * pages are evicted and any older in-flight fetch is cleared when it settles.
     * The next miss establishes the new bounded window.
     */
    resetSource(clipId: number): void;
    /**
     * Drain pending page-miss requests, fetch the missing pages plus their
     * read-ahead window, and evict out-of-window pages. Resolves once this round's
     * fetches settle. Concurrent fetches are serialized inside each binding.
     */
    pump(): Promise<void>;
    /** Close every registered clip's binding and stop tracking. */
    close(): void;
    private serviceFrontier;
    private resetState;
    private clearPage;
}
interface OpfsClipStreamOptions extends OpfsClipPageProviderOptions {
    /** Clip schedule id used in `setClips` (matches the page-miss request clipId). */
    clipId: number;
    /**
     * Leading pages fetched synchronously before returning, so playback can start
     * without an immediate miss. Default 1.
     */
    primePages?: number;
}
interface OpfsClipStream {
    binding: OpfsClipPageProviderBinding;
    /** Pass as `addClip`'s buffer argument to schedule the streaming clip. */
    provider: ClipPageProvider;
}
/** Structural seam implemented by the AudioWorklet-backed `SonareEngine`. */
interface WorkletOpfsClipStreamHost {
    attachOpfsClipStream(options: OpfsClipStreamOptions): Promise<OpfsClipStream>;
}
/**
 * One-call wiring of an OPFS-backed streaming clip: creates the page provider,
 * primes the leading pages, and registers it with `streamer` so later misses are
 * serviced within the bounded window. Returns the binding (for `close`) and the
 * provider to schedule via `addClip(trackId, provider, startPpq, { id: clipId })`.
 *
 * @param streamer Shared streamer pumped on the control thread.
 * @param engine Engine the provider is created on (the same one `streamer` drives).
 * @param options Provider options plus `clipId` and optional `primePages`.
 */
declare function attachOpfsClipStream(streamer: ClipPageStreamer, engine: RealtimeEngine, options: OpfsClipStreamOptions): Promise<OpfsClipStream>;
/**
 * Worklet overload: delegates to `SonareEngine.attachOpfsClipStream`, which
 * creates the remote provider and drives this same sliding-window policy from
 * worklet page-miss messages.
 */
declare function attachOpfsClipStream(engine: WorkletOpfsClipStreamHost, options: OpfsClipStreamOptions): Promise<OpfsClipStream>;

/**
 * sonare - Audio Analysis Library
 *
 * @example
 * ```typescript
 * import { init, detectBpm, detectKey, analyze } from '@libraz/libsonare';
 *
 * await init();
 *
 * // Detect BPM from audio samples
 * const bpm = detectBpm(samples, sampleRate);
 *
 * // Detect musical key
 * const key = detectKey(samples, sampleRate);
 *
 * // Full analysis
 * const result = analyze(samples, sampleRate);
 * ```
 */

/**
 * Initialize the WASM module.
 * Must be called before using any analysis functions.
 *
 * @param options - Optional module configuration
 * @returns Promise that resolves when initialization is complete
 */
declare function init(options?: {
    locateFile?: (path: string, prefix: string) => string;
    wasmBinary?: ArrayBuffer | Uint8Array;
    moduleFactory?: (options?: {
        locateFile?: (path: string, prefix: string) => string;
        wasmBinary?: ArrayBuffer | Uint8Array;
    }) => Promise<SonareModule>;
}): Promise<void>;
/**
 * Check if the module is initialized.
 */
declare function isInitialized(): boolean;

interface SonareWorkletMeterSnapshot {
    type: 'meter';
    targetId: number;
    frame: number;
    peakDbL: number;
    peakDbR: number;
    rmsDbL: number;
    rmsDbR: number;
    correlation: number;
    truePeakDbL: number;
    truePeakDbR: number;
    momentaryLufs: number;
    shortTermLufs: number;
    integratedLufs: number;
    gainReductionDb: number;
}
interface SonareWorkletSpectrumSnapshot {
    type: 'spectrum';
    frame: number;
    bands: Float32Array;
}
declare const SONARE_METER_RING_HEADER_INTS = 4;
declare const SONARE_METER_RING_RECORD_FLOATS = 14;
declare const SONARE_SPECTRUM_RING_HEADER_INTS = 5;
declare const SONARE_SCOPE_RING_HEADER_INTS = 6;
/** Low 24 bits of a frame index (exact in Float32). */
declare function encodeFrameLo(frame: number): number;
/** High bits of a frame index above 2^24 (exact in Float32 up to ~2^48). */
declare function encodeFrameHi(frame: number): number;
/** Reconstruct a frame index from its low/high Float32 lanes. */
declare function decodeFrame(lo: number, hi: number): number;
declare const SONARE_ENGINE_RING_HEADER_INTS = 5;
declare const SONARE_ENGINE_COMMAND_RECORD_BYTES = 32;
declare const SONARE_ENGINE_TELEMETRY_RECORD_BYTES = 48;
declare const SONARE_CLIP_PAGE_REQUEST_RING_HEADER_INTS = 5;
declare const SONARE_CLIP_PAGE_REQUEST_RING_RECORD_UINT32S = 2;
declare const SONARE_EXTERNAL_MIDI_RING_HEADER_INTS = 5;
declare const SONARE_EXTERNAL_MIDI_RING_RECORD_UINT32S = 4;
declare enum SonareEngineCommandType {
    SetParam = 0,
    SetParamSmoothed = 1,
    TransportPlay = 2,
    TransportStop = 3,
    TransportSeekSample = 4,
    TransportSeekPpq = 5,
    SetTempoMap = 6,
    SetLoop = 7,
    SwapGraph = 8,
    SwapAutomation = 9,
    SetSoloMute = 10,
    AddClip = 11,
    RemoveClip = 12,
    ArmRecord = 13,
    Punch = 14,
    SetMetronome = 15,
    SetMarker = 16,
    SeekMarker = 17,
    SetTrackMonitorMode = 26
}
declare enum SonareEngineTelemetryType {
    ProcessBlock = 0,
    Error = 1
}
declare enum SonareEngineTelemetryError {
    None = 0,
    CommandQueueOverflow = 1,
    PendingCommandOverflow = 2,
    BoundaryOverflow = 3,
    TelemetryOverflow = 4,
    CaptureOverflow = 5,
    MaxBlockExceeded = 6,
    UnknownTarget = 7,
    NonRealtimeSafeParameter = 8,
    NotPrepared = 9,
    NonQueueableCommand = 10,
    AutomationBindTargetOverflow = 11,
    StaleAutomationLanes = 12,
    SmoothedParameterCapacity = 13,
    CommandBacklogDeferred = 14,
    ClipPageUnderrun = 15,
    InsertAutomationOverflow = 16,
    MidiClockOverflow = 17,
    MetronomeOverflow = 18,
    InvalidCommand = 19,
    MaxChannelsExceeded = 20
}
interface SonareMeterRingBuffer {
    sharedBuffer: SharedArrayBuffer;
    header: Int32Array;
    records: Float32Array;
    capacity: number;
}
interface SonareMeterRingReadResult {
    nextReadIndex: number;
    meters: SonareWorkletMeterSnapshot[];
}
interface SonareSpectrumRingBuffer {
    sharedBuffer: SharedArrayBuffer;
    header: Int32Array;
    records: Float32Array;
    capacity: number;
    bands: number;
}
interface SonareSpectrumRingReadResult {
    nextReadIndex: number;
    spectra: SonareWorkletSpectrumSnapshot[];
}
/**
 * A single target-addressed scope record drained from the realtime engine's
 * scope ring: an FFT magnitude spectrum plus a decimated goniometer/vectorscope
 * point cloud. Unlike {@link SonareWorkletSpectrumSnapshot} (the legacy
 * coarse-DFT meter spectrum), this carries a `targetId` (master/lane/bus) and a
 * stereo point cloud, mirroring the engine's `ScopeTelemetryRecord`.
 */
interface SonareWorkletScopeSnapshot {
    type: 'scope';
    targetId: number;
    frame: number;
    /** Linear-band magnitudes in dB (length = the configured band count). */
    bands: Float32Array;
    /** Interleaved stereo goniometer points: [l0, r0, l1, r1, ...]. */
    points: Float32Array;
}
interface SonareScopeRingBuffer {
    sharedBuffer: SharedArrayBuffer;
    header: Int32Array;
    records: Float32Array;
    capacity: number;
    bands: number;
    maxPoints: number;
}
interface SonareScopeRingReadResult {
    nextReadIndex: number;
    scopes: SonareWorkletScopeSnapshot[];
}
interface SonareExternalMidiRingEvent {
    destinationId: number;
    renderFrame: number;
    byteWord: number;
    byteCount: number;
}
interface SonareExternalMidiRingBuffer {
    sharedBuffer: SharedArrayBuffer;
    header: Int32Array;
    records: Uint32Array;
    capacity: number;
}
interface SharedExternalMidiRingWriter {
    header: Int32Array;
    records: Uint32Array;
    capacity: number;
}
interface SonareExternalMidiRingReadResult {
    events: SonareExternalMidiRingEvent[];
    dropped: number;
}
interface SonareEngineCommandRecord {
    type: SonareEngineCommandType | number;
    targetId?: number;
    sampleTime?: number | bigint;
    argFloat?: number;
    argInt?: number | bigint;
}
interface SonareEngineTelemetryRecord {
    type: SonareEngineTelemetryType | number;
    error: SonareEngineTelemetryError | number;
    renderFrame: number;
    timelineSample: number;
    audibleTimelineSample: number;
    graphLatencySamplesQ8: number;
    value: number;
}
interface SonareEngineCommandRingBuffer {
    sharedBuffer: SharedArrayBuffer;
    header: Int32Array;
    view: DataView;
    capacity: number;
}
interface SonareEngineTelemetryRingBuffer {
    sharedBuffer: SharedArrayBuffer;
    header: Int32Array;
    view: DataView;
    capacity: number;
}
interface SonareEngineTelemetryRingReadResult {
    nextReadIndex: number;
    telemetry: SonareEngineTelemetryRecord[];
}
interface SonareClipPageRequest {
    clipId: number;
    pageIndex: number;
}
interface SonareClipPageRequestRingBuffer {
    sharedBuffer: SharedArrayBuffer;
    header: Int32Array;
    records: Uint32Array;
    capacity: number;
}
interface SharedClipPageRequestRingWriter {
    header: Int32Array;
    records: Uint32Array;
    capacity: number;
}
interface SonareClipPageRequestRingReadResult {
    requests: SonareClipPageRequest[];
    /** Cumulative uint32 drop count for native and SAB-ring overflows. */
    dropped: number;
}
declare function sonareMeterRingBufferByteLength(capacity: number): number;
declare function createSonareMeterRingBuffer(capacity?: number): SonareMeterRingBuffer;
declare function readSonareMeterRingBuffer(ring: SonareMeterRingBuffer, readIndex?: number): SonareMeterRingReadResult;
declare function sonareSpectrumRingBufferByteLength(capacity: number, bands?: number): number;
declare function createSonareSpectrumRingBuffer(capacity?: number, bands?: number): SonareSpectrumRingBuffer;
declare function readSonareSpectrumRingBuffer(ring: SonareSpectrumRingBuffer, readIndex?: number): SonareSpectrumRingReadResult;
declare function sonareScopeRingBufferByteLength(capacity: number, bands?: number, maxPoints?: number): number;
declare function createSonareScopeRingBuffer(capacity?: number, bands?: number, maxPoints?: number): SonareScopeRingBuffer;
declare function readSonareScopeRingBuffer(ring: SonareScopeRingBuffer, readIndex?: number): SonareScopeRingReadResult;
declare function sonareEngineCommandRingBufferByteLength(capacity: number): number;
declare function sonareEngineTelemetryRingBufferByteLength(capacity: number): number;
declare function sonareClipPageRequestRingBufferByteLength(capacity: number): number;
declare function sonareExternalMidiRingBufferByteLength(capacity: number): number;
declare function createSonareExternalMidiRingBuffer(capacity?: number): SonareExternalMidiRingBuffer;
/** Write one lowered MIDI-1 event without allocations from the audio worklet. */
declare function pushSonareExternalMidiRingBuffer(ring: SharedExternalMidiRingWriter, destinationId: number, renderFrame: number, byteWord: number, byteCount: number): boolean;
/** Main-thread drain. It is intentionally the only place MIDI byte arrays are built. */
declare function readSonareExternalMidiRingBuffer(ring: SonareExternalMidiRingBuffer): SonareExternalMidiRingReadResult;
declare function createSonareClipPageRequestRingBuffer(capacity?: number): SonareClipPageRequestRingBuffer;
/**
 * Writes one request without allocating. Invalid uint32 coordinates and a full
 * ring are counted as drops so the main thread can surface a bounded-loss
 * diagnostic without receiving a worklet postMessage.
 */
declare function pushSonareClipPageRequestRingBuffer(ring: SharedClipPageRequestRingWriter, clipId: number, pageIndex: number): boolean;
/** Drains the SPSC request ring on the main thread. Object creation is here, never in process(). */
declare function readSonareClipPageRequestRingBuffer(ring: SonareClipPageRequestRingBuffer): SonareClipPageRequestRingReadResult;
declare function createSonareEngineCommandRingBuffer(capacity?: number): SonareEngineCommandRingBuffer;
declare function createSonareEngineTelemetryRingBuffer(capacity?: number): SonareEngineTelemetryRingBuffer;
declare function pushSonareEngineCommandRingBuffer(ring: SonareEngineCommandRingBuffer, command: SonareEngineCommandRecord): boolean;
declare function popSonareEngineCommandRingBuffer(ring: SonareEngineCommandRingBuffer): SonareEngineCommandRecord | null;
declare function writeSonareEngineTelemetryRingBuffer(ring: SonareEngineTelemetryRingBuffer, telemetry: SonareEngineTelemetryRecord): void;
declare function readSonareEngineTelemetryRingBuffer(ring: SonareEngineTelemetryRingBuffer, readIndex?: number): SonareEngineTelemetryRingReadResult;

interface SonareWorkletProcessorOptions {
    sceneJson: string;
    sampleRate?: number;
    blockSize?: number;
    stripCount?: number;
    meterIntervalFrames?: number;
    meterSharedBuffer?: SharedArrayBuffer;
    meterRingCapacity?: number;
    spectrumIntervalFrames?: number;
    spectrumBands?: number;
    spectrumSharedBuffer?: SharedArrayBuffer;
    spectrumRingCapacity?: number;
}
interface SonareRealtimeEngineWorkletProcessorOptions {
    wasmBinary?: ArrayBuffer | Uint8Array;
    initialSyncMessages?: SonareEngineSyncMessage[];
    initialCommands?: SonareEngineCommandRecord[];
    sampleRate?: number;
    blockSize?: number;
    channelCount?: number;
    meterIntervalFrames?: number;
    commandSharedBuffer?: SharedArrayBuffer;
    commandRingCapacity?: number;
    telemetrySharedBuffer?: SharedArrayBuffer;
    telemetryRingCapacity?: number;
    meterSharedBuffer?: SharedArrayBuffer;
    meterRingCapacity?: number;
    scopeIntervalFrames?: number;
    scopeBands?: number;
    scopeSharedBuffer?: SharedArrayBuffer;
    scopeRingCapacity?: number;
    /**
     * Lock-free SPSC queue for clip-page cache misses. Supplying this is required
     * for realtime-safe OPFS streaming: it avoids both embind object creation and
     * postMessage structured cloning from AudioWorklet process().
     */
    clipPageRequestSharedBuffer?: SharedArrayBuffer;
    clipPageRequestRingCapacity?: number;
    /** Lock-free worklet-to-main-thread MIDI-1 output ring. */
    externalMidiSharedBuffer?: SharedArrayBuffer;
    externalMidiRingCapacity?: number;
}
interface SonareRealtimeVoiceChangerWorkletProcessorOptions {
    preset?: RealtimeVoiceChangerConfigInput;
    sampleRate?: number;
    blockSize?: number;
    channelCount?: number;
}
interface SonareRealtimeVoiceChangerSetConfigMessage {
    type: 'setConfig';
    /** Pre-normalized by the main thread; never JSON parsed in the worklet. */
    config: RealtimeVoiceChangerPodConfig;
}
interface SonareRealtimeVoiceChangerResetMessage {
    type: 'reset';
}
interface SonareRealtimeVoiceChangerDestroyMessage {
    type: 'destroy';
}
type SonareRealtimeVoiceChangerMessage = SonareRealtimeVoiceChangerSetConfigMessage | SonareRealtimeVoiceChangerResetMessage | SonareRealtimeVoiceChangerDestroyMessage;
interface SonareRealtimeEngineNodeCapabilities {
    mode: 'sab' | 'postMessage';
    runtimeTarget: 'embind';
    sharedArrayBuffer: boolean;
    atomics: boolean;
    audioWorklet: boolean;
    /** True only when clip-page misses use the bounded SAB ring. */
    clipPageRequestsRealtimeSafe: boolean;
    /** True when external MIDI uses the SAB output ring rather than postMessage. */
    externalMidiRealtimeSafe: boolean;
    engineAbiVersion?: number;
    expectedEngineAbiVersion?: number;
    abiCompatible?: boolean;
    degradedReason?: string;
    readyMessage?: boolean;
}
interface SonareRealtimeEngineNodeOptions extends SonareRealtimeEngineWorkletProcessorOptions {
    processorName?: string;
    moduleUrl?: string | URL;
    mode?: 'auto' | 'sab' | 'postMessage';
    engineAbiVersion?: number;
    expectedEngineAbiVersion?: number;
    requireAbiCompatible?: boolean;
    nodeFactory?: (context: BaseAudioContext, processorName: string, options: AudioWorkletNodeOptions) => AudioWorkletNode;
}
interface SonareEngineTransportFacade {
    play(sampleTime?: number): boolean;
    stop(sampleTime?: number): boolean;
    seekPpq(ppq: number, sampleTime?: number): boolean;
    seekSeconds(seconds: number, sampleTime?: number): boolean;
    setTempo(bpm: number): void;
    setTempoSegments(segments: readonly EngineTempoSegment[]): void;
    setLoop(startPpq: number, endPpq: number, enabled?: boolean): boolean;
}
interface SonareWorkletScheduleInsertAutomationMessage {
    type: 'scheduleInsertAutomation';
    stripIndex: number;
    insertIndex: number;
    paramId: number;
    value: number;
    samplePos?: number;
    curve?: AutomationCurve;
}
interface SonareWorkletSetMeterIntervalMessage {
    type: 'setMeterInterval';
    frames: number;
}
interface SonareWorkletDestroyMessage {
    type: 'destroy';
}
type SonareWorkletMessage = SonareWorkletScheduleInsertAutomationMessage | SonareWorkletSetMeterIntervalMessage | SonareWorkletDestroyMessage;
/** One external-MIDI event delivered to the main thread, lowered to MIDI 1.0
 * bytes ready for a Web MIDI output port. */
interface SonareWorkletExternalMidiEvent {
    /** Originating track lane, or 0xFFFFFFFF for transport/clock bytes. */
    destinationId: number;
    /** Sample position within the producing block. */
    renderFrame: number;
    /** MIDI 1.0 status + data bytes (1..3 entries). */
    bytes: number[];
}
/** Batch of external-MIDI events posted from the worklet once per render block. */
interface SonareWorkletExternalMidiMessage {
    type: 'externalMidi';
    events: SonareWorkletExternalMidiEvent[];
}
/** A control-plane sync message that the worklet rejected without crashing. */
interface SonareEngineSyncErrorMessage {
    type: 'syncError';
    syncType: SonareEngineSyncMessage['type'];
    message: string;
}
type SonareWorkletTransportMessage = SonareWorkletMeterSnapshot | SonareWorkletSpectrumSnapshot | SonareWorkletExternalMidiMessage | SonareEngineClipPageRequestMessage | SonareEngineTelemetryRecord;
interface WorkletTransport {
    postMessage?: (message: SonareWorkletTransportMessage | SonareEngineCaptureResponseMessageInternal | SonareEngineTransportResponseMessage | SonareEngineSyncErrorMessage, transfer?: Transferable[]) => void;
    onMeter?: (meter: SonareWorkletMeterSnapshot) => void;
    onSpectrum?: (spectrum: SonareWorkletSpectrumSnapshot) => void;
}
interface SonareEngineSyncClipsMessage {
    type: 'syncClips';
    clips: EngineClip[];
}
interface SonareEngineSyncClipsDeltaMessage {
    type: 'syncClipsDelta';
    upserts: EngineClip[];
    removeIds: number[];
}
/** Begins a paged, pre-baked clip transfer. PCM pages follow in FIFO order. */
interface SonareEngineSyncClipPageProviderMessage {
    type: 'syncClipPageProvider';
    clipId: number;
    /** Omitted when an OPFS stream is primed before its clip is scheduled. */
    clip?: EngineClip;
    numChannels: number;
    numSamples: number;
    pageFrames: number;
}
/** Supplies one bounded PCM page for a pending pre-baked clip transfer. */
interface SonareEngineSyncClipPageMessage {
    type: 'syncClipPage';
    clipId: number;
    pageIndex: number;
    channels: Float32Array[];
}
/** Evicts one page after the main-thread sliding window advances. */
interface SonareEngineSyncClipPageClearMessage {
    type: 'syncClipPageClear';
    clipId: number;
    pageIndex: number;
}
/** Releases a provider whose clip was removed or whose stream was closed. */
interface SonareEngineSyncClipPageDestroyMessage {
    type: 'syncClipPageDestroy';
    clipId: number;
}
/** Makes a fully supplied paged clip visible to the audio engine. */
interface SonareEngineSyncClipPageCommitMessage {
    type: 'syncClipPageCommit';
    clipId: number;
    /**
     * Clip schedule to publish with a provider that was primed before its
     * schedule was known. The original pre-baked push path supplies it on the
     * provider message instead.
     */
    clip?: EngineClip;
}
/**
 * A bounded batch of page misses emitted by the AudioWorklet. The main thread
 * resolves these from OPFS and responds with `syncClipPage`; a missing page is
 * silent until that response arrives.
 */
interface SonareEngineClipPageRequestMessage {
    type: 'clipPageRequest';
    requests: Array<{
        clipId: number;
        pageIndex: number;
    }>;
    /** Number of misses dropped because a bounded native or SAB request queue was full. */
    dropped?: number;
}
interface SonareEngineSyncMidiClipsMessage {
    type: 'syncMidiClips';
    clips: EngineMidiClipSchedule[];
}
interface SonareEngineSyncMarkersMessage {
    type: 'syncMarkers';
    markers: EngineMarker[];
}
interface SonareEngineSyncMetronomeMessage {
    type: 'syncMetronome';
    config: EngineMetronomeConfig;
}
interface SonareEngineSyncAutomationMessage {
    type: 'syncAutomation';
    paramId: number;
    points: EngineAutomationPoint[];
}
/** Replaces the live engine's registered custom-parameter set. */
interface SonareEngineSyncParametersMessage {
    type: 'syncParameters';
    parameters: EngineParameterInfo[];
}
interface SonareEngineSyncTempoMessage {
    type: 'syncTempo';
    bpm: number;
    timeSignature: {
        numerator: number;
        denominator: number;
    };
    tempoSegments?: EngineTempoSegment[];
    timeSignatureSegments?: EngineTimeSignatureSegment[];
}
interface SonareEngineSyncMixerMessage {
    type: 'syncMixer';
    lanes: EngineTrackLane[];
    buses?: EngineBus[];
    trackStrips?: Array<{
        trackId: number;
        sceneJson: string;
    }>;
    busStrips?: Array<{
        busId: number;
        sceneJson: string;
    }>;
    masterStripJson?: string;
    /** Lane insert sidechain bindings (replayed after lanes/strips). */
    laneSidechains?: Array<{
        trackId: number;
        insertIndex: number;
        sourceTrackId: number;
    }>;
}
interface SonareEngineSyncCaptureMessage {
    type: 'syncCapture';
    bufferFrames: number;
    channels: number;
    source: EngineCaptureStatus['source'];
    recordOffsetSamples: number;
    inputMonitor: {
        enabled: boolean;
        gain: number;
    };
}
interface SonareEngineSyncTrackStripEqBandMessage {
    type: 'syncTrackStripEqBand';
    trackId: number;
    bandIndex: number;
    bandJson: string;
}
interface SonareEngineSyncMasterStripEqBandMessage {
    type: 'syncMasterStripEqBand';
    bandIndex: number;
    bandJson: string;
}
interface SonareEngineSyncTrackStripInsertBypassedMessage {
    type: 'syncTrackStripInsertBypassed';
    trackId: number;
    insertIndex: number;
    bypassed: boolean;
    resetOnBypass: boolean;
}
interface SonareEngineSyncMasterStripInsertBypassedMessage {
    type: 'syncMasterStripInsertBypassed';
    insertIndex: number;
    bypassed: boolean;
    resetOnBypass: boolean;
}
interface SonareEngineSyncTrackStripInsertParamByNameMessage {
    type: 'syncTrackStripInsertParamByName';
    trackId: number;
    insertIndex: number;
    paramName: string;
    value: number;
}
interface SonareEngineSyncMasterStripInsertParamByNameMessage {
    type: 'syncMasterStripInsertParamByName';
    insertIndex: number;
    paramName: string;
    value: number;
}
interface SonareEngineSyncBusStripInsertParamByNameMessage {
    type: 'syncBusStripInsertParamByName';
    busId: number;
    insertIndex: number;
    paramName: string;
    value: number;
}
interface SonareEngineSyncTrackStripPanMessage {
    type: 'syncTrackStripPan';
    trackId: number;
    pan: number;
}
interface SonareEngineSyncTrackStripPanLawMessage {
    type: 'syncTrackStripPanLaw';
    trackId: number;
    panLaw: number;
}
interface SonareEngineSyncTrackStripPanModeMessage {
    type: 'syncTrackStripPanMode';
    trackId: number;
    panMode: number;
}
interface SonareEngineSyncTrackStripDualPanMessage {
    type: 'syncTrackStripDualPan';
    trackId: number;
    leftPan: number;
    rightPan: number;
}
interface SonareEngineSyncTrackStripChannelDelaySamplesMessage {
    type: 'syncTrackStripChannelDelaySamples';
    trackId: number;
    delaySamples: number;
}
interface SonareEngineSyncBuiltinInstrumentMessage {
    type: 'syncBuiltinInstrument';
    destinationId: number;
    config: {
        destinationId?: number;
    } & Record<string, unknown>;
}
interface SonareEngineSyncSynthInstrumentMessage {
    type: 'syncSynthInstrument';
    destinationId: number;
    patch: Record<string, unknown> | string;
}
interface SonareEngineSyncSf2InstrumentMessage {
    type: 'syncSf2Instrument';
    destinationId: number;
    config: {
        destinationId?: number;
        gain?: number;
        polyphony?: number;
        preferModelForModeledFamilies?: boolean;
    };
}
interface SonareEngineSyncLoadSoundFontMessage {
    type: 'syncLoadSoundFont';
    data: Uint8Array;
}
interface SonareEngineSyncMidiFxMessage {
    type: 'syncMidiFx' | 'syncClearMidiFx';
    destinationId: number;
    /** Engine MIDI-FX config JSON; present for 'syncMidiFx', absent for a clear. */
    configJson?: string;
}
interface SonareEngineSyncMidiNoteMessage {
    type: 'syncMidiNoteOn' | 'syncMidiNoteOff';
    destinationId: number;
    group: number;
    channel: number;
    note: number;
    velocity: number;
    renderFrame: number;
}
interface SonareEngineSyncMidiCcMessage {
    type: 'syncMidiCc';
    destinationId: number;
    group: number;
    channel: number;
    controller: number;
    value: number;
    renderFrame: number;
}
interface SonareEngineSyncMidiUmpMessage {
    type: 'syncMidiUmp';
    destinationId: number;
    word0: number;
    renderFrame: number;
}
interface SonareEngineSyncMidiSysexMessage {
    type: 'syncMidiSysex';
    destinationId: number;
    data: Uint8Array;
    renderFrame: number;
}
interface SonareEngineSyncMidiPanicMessage {
    type: 'syncMidiPanic';
    renderFrame: number;
}
interface SonareEngineSyncMidiDestinationExternalMessage {
    type: 'syncMidiDestinationExternal';
    destinationId: number;
    external: boolean;
}
interface SonareEngineSyncExternalMidiClockMessage {
    type: 'syncExternalMidiClock';
    enabled: boolean;
}
interface SonareEngineSyncMidiInputSourceMessage {
    type: 'syncMidiInputSource' | 'syncClearMidiInputSource';
    destinationId?: number;
}
interface SonareEngineSyncMidiCcBindingMessage {
    type: 'syncMidiCcBinding';
    channel: number;
    controller: number;
    paramId: number;
    minValue: number;
    maxValue: number;
}
interface SonareEngineSyncMidiInputEventMessage {
    type: 'syncMidiInputNoteOn' | 'syncMidiInputNoteOff' | 'syncMidiInputCc';
    group: number;
    channel: number;
    data0: number;
    data1: number;
    portTimeSamples: number;
}
/** Releases the realtime engine and all worklet-owned clip buffers. */
interface SonareEngineDestroyMessage {
    type: 'destroy';
}
type SonareEngineSyncMessage = SonareEngineSyncClipsMessage | SonareEngineSyncClipsDeltaMessage | SonareEngineSyncClipPageProviderMessage | SonareEngineSyncClipPageMessage | SonareEngineSyncClipPageClearMessage | SonareEngineSyncClipPageCommitMessage | SonareEngineSyncClipPageDestroyMessage | SonareEngineSyncMidiClipsMessage | SonareEngineSyncMarkersMessage | SonareEngineSyncMetronomeMessage | SonareEngineSyncAutomationMessage | SonareEngineSyncParametersMessage | SonareEngineSyncTempoMessage | SonareEngineSyncMixerMessage | SonareEngineSyncCaptureMessage | SonareEngineSyncTrackStripEqBandMessage | SonareEngineSyncMasterStripEqBandMessage | SonareEngineSyncTrackStripInsertBypassedMessage | SonareEngineSyncMasterStripInsertBypassedMessage | SonareEngineSyncTrackStripInsertParamByNameMessage | SonareEngineSyncMasterStripInsertParamByNameMessage | SonareEngineSyncBusStripInsertParamByNameMessage | SonareEngineSyncTrackStripPanMessage | SonareEngineSyncTrackStripPanLawMessage | SonareEngineSyncTrackStripPanModeMessage | SonareEngineSyncTrackStripDualPanMessage | SonareEngineSyncTrackStripChannelDelaySamplesMessage | SonareEngineSyncBuiltinInstrumentMessage | SonareEngineSyncSynthInstrumentMessage | SonareEngineSyncSf2InstrumentMessage | SonareEngineSyncLoadSoundFontMessage | SonareEngineSyncMidiFxMessage | SonareEngineSyncMidiNoteMessage | SonareEngineSyncMidiCcMessage | SonareEngineSyncMidiUmpMessage | SonareEngineSyncMidiSysexMessage | SonareEngineSyncMidiPanicMessage | SonareEngineSyncMidiDestinationExternalMessage | SonareEngineSyncExternalMidiClockMessage | SonareEngineSyncMidiInputSourceMessage | SonareEngineSyncMidiCcBindingMessage | SonareEngineSyncMidiInputEventMessage | SonareEngineDestroyMessage;
interface SonareEngineCaptureRequestMessage {
    type: 'captureRequest';
    requestId: number;
    op: 'status' | 'read' | 'reset';
}
/**
 * Public capture response shape retained for source compatibility.
 *
 * The worklet wire protocol is stricter than this legacy structural type; use
 * `SonareEngineCaptureResponseMessageInternal` inside the implementation.
 */
interface SonareEngineCaptureResponseMessage {
    type: 'captureResponse';
    requestId: number;
    ok: boolean;
    status?: EngineCaptureStatus;
    channels?: Float32Array[] | number[][];
    error?: string;
}
interface SonareEngineCaptureStatusResponseMessageInternal {
    type: 'captureResponse';
    requestId: number;
    ok: true;
    status: EngineCaptureStatus;
}
interface SonareEngineCaptureReadResponseMessageInternal {
    type: 'captureResponse';
    requestId: number;
    ok: true;
    channels: Float32Array[];
}
interface SonareEngineCaptureResetResponseMessageInternal {
    type: 'captureResponse';
    requestId: number;
    ok: true;
}
interface SonareEngineCaptureErrorResponseMessageInternal {
    type: 'captureResponse';
    requestId: number;
    ok: false;
    error: string;
}
/** Strict wire response type used only by the worklet implementation. */
type SonareEngineCaptureResponseMessageInternal = SonareEngineCaptureStatusResponseMessageInternal | SonareEngineCaptureReadResponseMessageInternal | SonareEngineCaptureResetResponseMessageInternal | SonareEngineCaptureErrorResponseMessageInternal;
interface SonareEngineTransportRequestMessage {
    type: 'transportRequest';
    requestId: number;
    op: 'state';
}
interface SonareEngineTransportResponseMessage {
    type: 'transportResponse';
    requestId: number;
    ok: boolean;
    state?: EngineTransportState;
    error?: string;
}

/** Capture configuration options accepted by the engine's `configureCapture`. */
interface CaptureOptions {
    bufferFrames: number;
    channels?: number;
    source?: EngineCaptureStatus['source'];
    recordOffsetSamples?: number;
    inputMonitor?: {
        enabled: boolean;
        gain?: number;
    };
}

interface SonareEngineOptions extends SonareRealtimeEngineNodeOptions {
    offlineEngine?: RealtimeEngine;
    offlineBlockSize?: number;
    offlineChannelCount?: number;
}

declare class SonareEngine {
    readonly node: AudioWorkletNode;
    readonly capabilities: SonareRealtimeEngineNodeCapabilities;
    readonly transport: SonareEngineTransportFacade;
    private readonly realtimeNode;
    private readonly offlineEngine;
    private readonly context;
    private readonly sampleRate;
    private readonly offlineBlockSize;
    private readonly offlineChannelCount;
    private readonly automationLanes;
    private readonly clips;
    private readonly midiClips;
    private readonly markers;
    private readonly trackLaneIds;
    private readonly trackSends;
    private readonly trackOutputBus;
    private readonly laneSidechains;
    private readonly buses;
    private readonly trackStripJson;
    private readonly busStripJson;
    private masterStripJson;
    private captureConfig;
    private tempoBpm;
    private timeSignature;
    private tempoSegments;
    private timeSignatureSegments;
    private latestTransportState;
    private nextClipId;
    private nextMarkerId;
    private transportPlaying;
    private readonly pendingInstrumentSync;
    private readonly workletClipPageRequests;
    private readonly workletPageProviderClipIds;
    private workletClipStreamer;
    private workletClipPump;
    private workletClipPagePollTimer;
    private unsubscribeWorkletClipRequests;
    private destroyed;
    private constructor();
    static create(context: BaseAudioContext, options?: SonareEngineOptions): Promise<SonareEngine>;
    suspend(): Promise<void>;
    resume(): Promise<void>;
    setTempo(bpm: number): void;
    setTempoSegments(segments: readonly EngineTempoSegment[]): void;
    setTimeSignature(numerator: number, denominator: number): void;
    setTimeSignatureSegments(segments: readonly EngineTimeSignatureSegment[]): void;
    setLoop(startPpq: number, endPpq: number, enabled?: boolean): boolean;
    countInEndSample(startSample: number, bars: number): number;
    getTransportState(): Promise<EngineTransportState>;
    cachedTransportState(): EngineTransportState | undefined;
    setParam(nodeId: string, param: string | number, value: number): boolean;
    scheduleParam(nodeId: string, param: string | number, ppq: number, value: number, curve?: number | 'linear' | 'exponential'): void;
    addAutomationPoint(laneId: string | number, ppq: number, value: number, curve?: number | 'linear' | 'exponential'): void;
    /**
     * Replaces the automation lane for `paramId` with the given breakpoints. An
     * empty array clears the lane; the points are defensively copied and sorted
     * by ppq before mirroring to the offline and live worklet engines.
     */
    setAutomationLane(paramId: number, points: ReadonlyArray<EngineAutomationPoint>): void;
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
    automationParamId(target: string | number, kind: 'faderDb' | 'pan'): number;
    /**
     * Returns the automation target id for a bus fader.
     *
     * @param busId Bus id (declares the mixer bus on first use).
     * @returns Reserved engine parameter id for the bus fader gain (dB).
     */
    busAutomationParamId(busId: number): number;
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
    resolveTrackInsertAutomationId(target: string | number, insertIndex: number, paramName: string): number;
    /**
     * Resolves a master-strip insert parameter to its reserved insert-automation
     * id.
     *
     * @param insertIndex Index into the master strip's insert sequence.
     * @param paramName Processor JSON-key parameter name.
     * @returns Reserved insert-automation id, or -1 when insert/key unknown.
     */
    resolveMasterInsertAutomationId(insertIndex: number, paramName: string): number;
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
    resolveBusInsertAutomationId(busId: number, insertIndex: number, paramName: string): number;
    /**
     * Returns the number of automation lanes installed on the engine, including
     * lanes whose breakpoint list is currently empty.
     *
     * @returns Engine-side automation lane count.
     */
    automationLaneCount(): number;
    listParameters(): EngineParameterInfo[];
    /** Registers a custom parameter on the offline mirror and worklet engine. */
    addParameter(info: EngineParameterInfo): void;
    /** Clears custom parameters and their automation lanes on both engines. */
    clearParameters(): void;
    setSoloMute(target: string | number, solo: boolean, mute: boolean): boolean;
    /** Queues a per-track PFL/AFL monitor tap mode change. */
    setTrackMonitorMode(target: string | number, mode: EngineTrackMonitorMode, renderFrame?: number): boolean;
    setStripGain(target: string | number, db: number): boolean;
    setStripPan(target: string | number, pan: number): boolean;
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
    setTrackLanes(lanes: ReadonlyArray<number | EngineTrackLane>): void;
    /**
     * Routes a track lane's post-fader output into a declared bus instead of
     * the master mix (group/folder routing); busId 0 restores the master mix.
     */
    setTrackOutputBus(target: string | number, busId: number): void;
    /**
     * Keys one insert of a lane strip from another lane's post-strip pre-fader
     * audio (ducking/sidechainRouter inserts). sourceTarget null removes the
     * binding.
     */
    setLaneSidechain(target: string | number, insertIndex: number, sourceTarget: string | number | null): void;
    setSends(target: string | number, sends: EngineTrackSend[]): void;
    setTrackBuses(buses: EngineBus[]): void;
    setBusGain(busId: number, db: number): boolean;
    setTrackStripJson(target: string | number, sceneJson: string): void;
    setTrackStripEqBand(target: string | number, bandIndex: number, band: EqBand | string): void;
    setTrackStripInsertBypassed(target: string | number, insertIndex: number, bypassed: boolean, resetOnBypass?: boolean): void;
    setTrackStripInsertParamByName(target: string | number, insertIndex: number, paramName: string, value: number): void;
    setTrackStripPan(target: string | number, pan: number): void;
    setTrackStripPanLaw(target: string | number, panLaw: PanLaw | number): void;
    setTrackStripPanMode(target: string | number, panMode: PanMode | number): void;
    setTrackStripDualPan(target: string | number, leftPan: number, rightPan: number): void;
    setTrackStripChannelDelaySamples(target: string | number, delaySamples: number): void;
    setStripEq(target: string | number, bandIndex: number, band: EqBand | string): void;
    setStripInsertBypassed(target: string | number, insertIndex: number, bypassed: boolean, resetOnBypass?: boolean): void;
    setStripInserts(target: string | number, sceneJson: string): void;
    setBusStripJson(busId: number, sceneJson: string): void;
    setMasterStripJson(sceneJson: string): void;
    setMasterStripEqBand(bandIndex: number, band: EqBand | string): void;
    setMasterStripInsertBypassed(insertIndex: number, bypassed: boolean, resetOnBypass?: boolean): void;
    setMasterStripInsertParamByName(insertIndex: number, paramName: string, value: number): void;
    setBusStripInsertParamByName(busId: number, insertIndex: number, paramName: string, value: number): void;
    setStripInsertParamByName(target: string | number, insertIndex: number, paramName: string, value: number): void;
    setMasterChain(sceneJson: string): void;
    /**
     * Creates and primes an OPFS-backed page provider for this live worklet
     * engine. Pass the returned `provider` to {@link addClip} in place of a
     * `Float32Array[]`; the `clipId` in `options` must equal that clip's explicit
     * `opts.id`. Subsequent cache misses are fetched on the main thread and
     * supplied back to the worklet through its bounded pull protocol.
     */
    attachOpfsClipStream(options: OpfsClipStreamOptions): Promise<{
        binding: OpfsClipPageProviderBinding;
        provider: ClipPageProvider;
    }>;
    addClip(trackId: string | number, buffer: Float32Array[] | ClipPageProvider, startPpq: number, opts?: Partial<Omit<EngineClip, 'channels' | 'pageProvider' | 'startPpq'>>): number;
    removeClip(clipId: number): void;
    setMidiClips(schedules: readonly EngineMidiClipSchedule[]): void;
    setBuiltinInstrument(trackId: string | number, config?: {
        destinationId?: number;
    } & Record<string, unknown>): void;
    setSynthInstrument(trackId: string | number, patch?: Record<string, unknown> | string): void;
    loadSoundFont(data: Uint8Array): void;
    setSf2Instrument(trackId: string | number, config?: {
        destinationId?: number;
        gain?: number;
        polyphony?: number;
        preferModelForModeledFamilies?: boolean;
    }): void;
    /**
     * Route a track's MIDI to the external output (drained via {@link onMidiOut})
     * instead of an internal instrument, so the track plays an external device.
     * Pass `external=false` to restore internal-synth playback.
     */
    setMidiDestinationExternal(trackId: string | number, external: boolean): void;
    /**
     * Enable/disable forwarding MIDI clock + transport (start/continue/stop) to
     * the external output so external gear tracks the transport tempo. The bytes
     * arrive through {@link onMidiOut} tagged with the transport destination.
     */
    setExternalMidiClockEnabled(enabled: boolean): void;
    /**
     * Install or replace a live, non-destructive MIDI-FX insert for one
     * destination. The insert transforms the destination's MIDI before
     * synthesis (transpose, quantize, velocity shaping, humanize, harmonize,
     * arpeggiate) without rewriting any stored notes, so it can be bypassed by
     * {@link clearMidiFx}. The config JSON is the flat object the engine's
     * MIDI-FX accepts (the same schema as the offline `Project.bakeMidiFx`).
     */
    setMidiFx(trackId: string | number, configJson: string): void;
    /** Remove the live MIDI-FX insert from one destination (a no-op when none). */
    clearMidiFx(trackId: string | number): void;
    pushMidiNoteOn(trackId: string | number, group: number, channel: number, note: number, velocity: number, renderFrame?: number): void;
    pushMidiNoteOff(trackId: string | number, group: number, channel: number, note: number, velocity?: number, renderFrame?: number): void;
    pushMidiCc(trackId: string | number, group: number, channel: number, controller: number, value: number, renderFrame?: number): void;
    pushMidiUmp(trackId: string | number, word0: number, renderFrame?: number): void;
    pushMidiSysex(trackId: string | number, data: Uint8Array, renderFrame?: number): void;
    bindMidiCc(channel: number, controller: number, paramId: number, options?: MidiCcBindOptions): void;
    setMidiInputSource(destinationId?: number): void;
    clearMidiInputSource(): void;
    pushMidiInputNoteOn(group: number, channel: number, note: number, velocity: number, portTimeSamples?: number): void;
    pushMidiInputNoteOff(group: number, channel: number, note: number, velocity?: number, portTimeSamples?: number): void;
    pushMidiInputCc(group: number, channel: number, controller: number, value: number, portTimeSamples?: number): void;
    pushMidiPanic(renderFrame?: number): void;
    configureCapture(options: CaptureOptions): void;
    /**
     * Arms the engine-global capture path. `trackId` is retained for source
     * compatibility and must be `0`; per-track capture is not implemented.
     */
    armRecord(trackId: string | number, enabled: boolean): boolean;
    punch(inPpq: number, outPpq: number): boolean;
    captureStatus(): Promise<EngineCaptureStatus>;
    capturedAudio(): Promise<Float32Array[]>;
    resetCapture(): Promise<void>;
    setMetronome(opts: EngineMetronomeConfig): void;
    addMarker(ppq: number, name?: string): number;
    /**
     * Replaces the whole marker set in one call. Entries without an `id` are
     * assigned fresh ids; entries carrying an `id` keep it. Returns the resolved
     * markers in the order given.
     */
    setMarkers(entries: ReadonlyArray<{
        ppq: number;
        name?: string;
        id?: number;
    }>): EngineMarker[];
    markerCount(): number;
    markerByIndex(index: number): EngineMarker;
    marker(markerId: number): EngineMarker;
    seekMarker(markerId: number): boolean;
    setLoopFromMarkers(startMarkerId: number, endMarkerId: number): boolean;
    renderOffline(totalFrames: number): Promise<Float32Array[]>;
    /**
     * Subscribe to external-MIDI batches (already lowered to MIDI 1.0 bytes) for
     * delivery to Web MIDI output ports. Fires once per render block that
     * produced events. Returns an unsubscribe function.
     */
    onMidiOut(callback: (events: SonareWorkletExternalMidiEvent[]) => void): () => void;
    onMeter(callback: (meter: SonareWorkletMeterSnapshot) => void): () => void;
    onScope(callback: (scope: SonareWorkletScopeSnapshot) => void): () => void;
    onTelemetry(callback: (telemetry: SonareEngineTelemetryRecord) => void): () => void;
    pollTelemetry(): SonareEngineTelemetryRecord[];
    pollMeters(): SonareWorkletMeterSnapshot[];
    pollScope(): SonareWorkletScopeSnapshot[];
    destroy(): void;
    private ensureWorkletClipStreamer;
    /**
     * SAB requests have no postMessage wake-up by design. Polling on the main
     * thread is therefore intentionally outside the audio callback; 8 ms keeps
     * the bounded OPFS prefetch frontier responsive without adding worklet GC.
     */
    private startWorkletClipPagePolling;
    private pumpWorkletClipPages;
    private enqueueWorkletClipPageRequest;
    private popWorkletClipPageRequest;
    private commitWorkletClipPageProvider;
    private mixerLanes;
    private syncMixer;
    private postInstrumentSync;
    private flushPendingInstrumentSync;
    private postSync;
    private flushOfflineMirror;
    private sendMirroredCommand;
    private get mixerContext();
    private get stripContext();
    private get automationContext();
    private get captureContext();
    private get parameterContext();
    private get tempoContext();
    private get clipContext();
    private get markerContext();
    private stripParamId;
    private sendSmoothedParam;
    private resolveParamId;
    private syncParameters;
    private resolveTargetId;
    private ensureTrackLane;
    private ensureBus;
}

declare class SonareRealtimeEngineNode {
    readonly node: AudioWorkletNode;
    readonly capabilities: SonareRealtimeEngineNodeCapabilities;
    readonly commandRing?: SonareEngineCommandRingBuffer;
    readonly telemetryRing?: SonareEngineTelemetryRingBuffer;
    readonly meterRing?: SonareMeterRingBuffer;
    readonly scopeRing?: SonareScopeRingBuffer;
    readonly clipPageRequestRing?: SonareClipPageRequestRingBuffer;
    readonly externalMidiRing?: SonareExternalMidiRingBuffer;
    readonly ready: Promise<void>;
    private telemetryReadIndex;
    private meterReadIndex;
    private scopeReadIndex;
    private clipPageRequestDroppedRead;
    private ringPollTimer;
    private telemetryListeners;
    private meterListeners;
    private scopeListeners;
    private midiOutListeners;
    private clipPageRequestListeners;
    private syncErrorListeners;
    private captureRequestId;
    private readonly captureRequests;
    private transportRequestId;
    private readonly transportRequests;
    private resolveReady;
    private rejectReady;
    private destroyed;
    private constructor();
    /** Subscribes to control-plane sync rejections reported by the worklet. */
    onSyncError(listener: (message: SonareEngineSyncErrorMessage) => void): () => void;
    static create(context: BaseAudioContext, options?: SonareRealtimeEngineNodeOptions): Promise<SonareRealtimeEngineNode>;
    play(sampleTime?: number): boolean;
    stop(sampleTime?: number): boolean;
    seekSample(timelineSample: number, sampleTime?: number): boolean;
    seekPpq(ppq: number, sampleTime?: number): boolean;
    sendCommand(command: SonareEngineCommandRecord): boolean;
    requestCaptureStatus(): Promise<EngineCaptureStatus>;
    requestCapturedAudio(): Promise<Float32Array[]>;
    requestCaptureReset(): Promise<void>;
    requestTransportState(): Promise<EngineTransportState>;
    pollTelemetry(): SonareEngineTelemetryRecord[];
    pollMeters(): SonareWorkletMeterSnapshot[];
    pollScope(): SonareWorkletScopeSnapshot[];
    /** Drain lowered MIDI-1 records from the SAB ring on the main thread. */
    pollMidiOut(): SonareWorkletExternalMidiEvent[];
    /**
     * Drains bounded paged-clip misses from the SAB ring and forwards one batch
     * to subscribers. In postMessage mode the legacy handler remains available,
     * but that degraded path is not realtime-safe for OPFS streaming.
     */
    pollClipPageRequests(): SonareEngineClipPageRequestMessage | undefined;
    onTelemetry(callback: (telemetry: SonareEngineTelemetryRecord) => void): () => void;
    onMeter(callback: (meter: SonareWorkletMeterSnapshot) => void): () => void;
    onScope(callback: (scope: SonareWorkletScopeSnapshot) => void): () => void;
    /**
     * Subscribe to external-MIDI batches drained from the engine (one call per
     * render block that produced events), already lowered to MIDI 1.0 bytes for a
     * Web MIDI output port. Returns an unsubscribe function.
     */
    onMidiOut(callback: (events: SonareWorkletExternalMidiEvent[]) => void): () => void;
    /**
     * Subscribe to bounded batches of paged-clip misses from the worklet. The
     * callback runs on the main thread and may initiate asynchronous OPFS I/O.
     */
    onClipPageRequests(callback: (message: SonareEngineClipPageRequestMessage) => void): () => void;
    destroy(): void;
    private emitTelemetry;
    private startRingPolling;
    private stopRingPollingIfUnused;
    private emitMeter;
    private emitMidiOut;
    private emitClipPageRequests;
    private emitScope;
    private sendCaptureRequest;
    private sendTransportRequest;
}

type WorkletInput = readonly (readonly Float32Array[])[];
type WorkletOutput = Float32Array[][];

/**
 * AudioWorklet-style bridge for the DAW realtime engine facade.
 *
 * Backed by the `sonare.wasm` embind facade.
 */
declare class SonareRealtimeEngineWorkletProcessor {
    private static warnedChannelScratchOverflow;
    readonly sampleRate: number;
    readonly blockSize: number;
    readonly channelCount: number;
    private engine;
    private closed;
    private commandRing?;
    private telemetryRing?;
    private meterRing?;
    private scopeRing?;
    private clipPageRequestRing?;
    private externalMidiRing?;
    private transport?;
    private meterIntervalFrames;
    private lastMeterFrame;
    private metronomeConfig;
    private channelBuffers;
    private readonly liveClips;
    private readonly pagedClipProviders;
    private readonly pagedClipPageFrames;
    private readonly pendingPagedClips;
    private readonly clipPageRequestClipIds;
    private readonly clipPageRequestPageIndices;
    private clipPageRequestOverflowReported;
    constructor(options?: SonareRealtimeEngineWorkletProcessorOptions, transport?: WorkletTransport);
    process(inputs: WorkletInput, outputs: WorkletOutput): boolean;
    private reacquireChannelBuffers;
    receiveCommand(command: SonareEngineCommandRecord): void;
    receiveSync(message: SonareEngineSyncMessage): void;
    private applySync;
    receiveCaptureRequest(message: SonareEngineCaptureRequestMessage): void;
    receiveTransportRequest(message: SonareEngineTransportRequestMessage): void;
    destroy(): void;
    private drainCommands;
    private safeApplyCommand;
    private applyCommand;
    private publishTelemetry;
    private writeTelemetryScratch;
    private publishTelemetryRecord;
    private publishMeters;
    private writeMeterScratch;
    private writeMeterRing;
    private publishScope;
    private writeScopeScratch;
    private publishExternalMidi;
    /**
     * Forward a bounded batch of native page misses to the main thread. This
     * deliberately runs after audio rendering: a cache miss is silence for this
     * block, and OPFS I/O must never delay `process()`.
     */
    private publishClipPageRequests;
    private removePagedClipProvider;
    private clearPagedClipProviders;
    private commandRingFromSharedBuffer;
    private telemetryRingFromSharedBuffer;
}

declare function registerSonareRealtimeEngineWorkletProcessor(name?: string): void;

/**
 * AudioWorklet-style mixer bridge backed by the package's single `sonare.wasm`.
 *
 * The WASM module must already be initialized via `init()` before constructing
 * this bridge. Each AudioWorklet input is treated as one stereo strip:
 * `inputs[strip][0]` is left and `inputs[strip][1]` is right. Missing channels
 * are replaced with preallocated silence.
 */
declare class SonareWorkletProcessor {
    readonly sampleRate: number;
    readonly blockSize: number;
    private mixer;
    private realtime;
    private closed;
    private processedFrames;
    private lastMeterFrame;
    private meterIntervalFrames;
    private spectrumIntervalFrames;
    private lastSpectrumFrame;
    private transport?;
    private meterRing?;
    private spectrumRing?;
    private spectrumBands;
    constructor(options: SonareWorkletProcessorOptions, transport?: WorkletTransport);
    process(inputs: WorkletInput, outputs: WorkletOutput): boolean;
    receiveMessage(message: SonareWorkletMessage): void;
    destroy(): void;
    private publishMeter;
    private writeMeterRing;
    private publishSpectrum;
    private computeSpectrum;
    private writeSpectrumRing;
}
declare function registerSonareWorkletProcessor(name?: string): void;

declare class SonareRealtimeVoiceChangerWorkletProcessor {
    private static warnedMonoOverflow;
    private static warnedInterleavedOverflow;
    private changer;
    private readonly sampleRate;
    private readonly blockSize;
    private readonly channelCount;
    private monoInput;
    private monoOutput;
    private bufferGeneration;
    private planarChannels;
    private destroyed;
    constructor(options?: SonareRealtimeVoiceChangerWorkletProcessorOptions);
    /**
     * Handles a control-plane message from the main thread. AudioWorklet port
     * handlers run on the same audio rendering thread as `process()`: this path
     * therefore accepts only a pre-normalized POD and never parses JSON.
     */
    receiveMessage(message: SonareRealtimeVoiceChangerMessage): void;
    process(inputs: WorkletInput, outputs: WorkletOutput): boolean;
    destroy(): void;
    private reacquireBuffers;
    /**
     * Returns the number of frames we can actually process given the
     * pre-allocated capacity. If the host requests more frames than the
     * worst-case block size declared at construction time, we clamp to the
     * available capacity and warn once — we MUST NOT reallocate on the
     * realtime audio thread.
     */
    private ensureMonoCapacity;
    /**
     * Same contract as ensureMonoCapacity but for the planar per-channel
     * scratch. Returns the number of frames that fit in the available capacity.
     */
    private ensureInterleavedCapacity;
}
declare function registerSonareRealtimeVoiceChangerWorkletProcessor(name?: string): void;

export { type OpfsClipStream, type OpfsClipStreamOptions, SONARE_CLIP_PAGE_REQUEST_RING_HEADER_INTS, SONARE_CLIP_PAGE_REQUEST_RING_RECORD_UINT32S, SONARE_ENGINE_COMMAND_RECORD_BYTES, SONARE_ENGINE_RING_HEADER_INTS, SONARE_ENGINE_TELEMETRY_RECORD_BYTES, SONARE_EXTERNAL_MIDI_RING_HEADER_INTS, SONARE_EXTERNAL_MIDI_RING_RECORD_UINT32S, SONARE_METER_RING_HEADER_INTS, SONARE_METER_RING_RECORD_FLOATS, SONARE_SCOPE_RING_HEADER_INTS, SONARE_SPECTRUM_RING_HEADER_INTS, type SonareClipPageRequest, type SonareClipPageRequestRingBuffer, type SonareClipPageRequestRingReadResult, SonareEngine, type SonareEngineCaptureRequestMessage, type SonareEngineCaptureResponseMessage, type SonareEngineClipPageRequestMessage, type SonareEngineCommandRecord, type SonareEngineCommandRingBuffer, SonareEngineCommandType, type SonareEngineOptions, type SonareEngineSyncAutomationMessage, type SonareEngineSyncBuiltinInstrumentMessage, type SonareEngineSyncCaptureMessage, type SonareEngineSyncClipsDeltaMessage, type SonareEngineSyncClipsMessage, type SonareEngineSyncLoadSoundFontMessage, type SonareEngineSyncMarkersMessage, type SonareEngineSyncMasterStripEqBandMessage, type SonareEngineSyncMasterStripInsertBypassedMessage, type SonareEngineSyncMessage, type SonareEngineSyncMetronomeMessage, type SonareEngineSyncMidiCcMessage, type SonareEngineSyncMidiClipsMessage, type SonareEngineSyncMidiNoteMessage, type SonareEngineSyncMidiPanicMessage, type SonareEngineSyncMixerMessage, type SonareEngineSyncSf2InstrumentMessage, type SonareEngineSyncSynthInstrumentMessage, type SonareEngineSyncTempoMessage, type SonareEngineSyncTrackStripEqBandMessage, type SonareEngineSyncTrackStripInsertBypassedMessage, SonareEngineTelemetryError, type SonareEngineTelemetryRecord, type SonareEngineTelemetryRingBuffer, type SonareEngineTelemetryRingReadResult, SonareEngineTelemetryType, type SonareEngineTransportFacade, type SonareEngineTransportRequestMessage, type SonareEngineTransportResponseMessage, type SonareExternalMidiRingBuffer, type SonareExternalMidiRingReadResult, type SonareMeterRingBuffer, type SonareMeterRingReadResult, SonareRealtimeEngineNode, type SonareRealtimeEngineNodeCapabilities, type SonareRealtimeEngineNodeOptions, SonareRealtimeEngineWorkletProcessor, type SonareRealtimeEngineWorkletProcessorOptions, type SonareRealtimeVoiceChangerDestroyMessage, type SonareRealtimeVoiceChangerMessage, type SonareRealtimeVoiceChangerResetMessage, type SonareRealtimeVoiceChangerSetConfigMessage, SonareRealtimeVoiceChangerWorkletProcessor, type SonareRealtimeVoiceChangerWorkletProcessorOptions, type SonareScopeRingBuffer, type SonareScopeRingReadResult, type SonareSpectrumRingBuffer, type SonareSpectrumRingReadResult, type SonareWorkletDestroyMessage, type SonareWorkletMessage, type SonareWorkletMeterSnapshot, SonareWorkletProcessor, type SonareWorkletProcessorOptions, type SonareWorkletScheduleInsertAutomationMessage, type SonareWorkletScopeSnapshot, type SonareWorkletSetMeterIntervalMessage, type SonareWorkletSpectrumSnapshot, type SonareWorkletTransportMessage, attachOpfsClipStream, createSonareClipPageRequestRingBuffer, createSonareEngineCommandRingBuffer, createSonareEngineTelemetryRingBuffer, createSonareExternalMidiRingBuffer, createSonareMeterRingBuffer, createSonareScopeRingBuffer, createSonareSpectrumRingBuffer, decodeFrame, encodeFrameHi, encodeFrameLo, init, isInitialized, popSonareEngineCommandRingBuffer, pushSonareClipPageRequestRingBuffer, pushSonareEngineCommandRingBuffer, pushSonareExternalMidiRingBuffer, readSonareClipPageRequestRingBuffer, readSonareEngineTelemetryRingBuffer, readSonareExternalMidiRingBuffer, readSonareMeterRingBuffer, readSonareScopeRingBuffer, readSonareSpectrumRingBuffer, registerSonareRealtimeEngineWorkletProcessor, registerSonareRealtimeVoiceChangerWorkletProcessor, registerSonareWorkletProcessor, sonareClipPageRequestRingBufferByteLength, sonareEngineCommandRingBufferByteLength, sonareEngineTelemetryRingBufferByteLength, sonareExternalMidiRingBufferByteLength, sonareMeterRingBufferByteLength, sonareScopeRingBufferByteLength, sonareSpectrumRingBufferByteLength, writeSonareEngineTelemetryRingBuffer };
