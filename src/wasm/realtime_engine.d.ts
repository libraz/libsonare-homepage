import type { Articulation, ControllerBinding, MpeDimension, NoteTracking, ProjectMidiCcBinding, SynthPatch } from './project';
import type { EqBand, PanLawInput, PanMode, SendTiming, SidechainSourceKind, UmpWords } from './public_types';
import type { WasmClipPageRequest, WasmEngineAutomationPoint, WasmEngineBounceOptions, WasmEngineBounceResult, WasmEngineCaptureStatus, WasmEngineClip, WasmEngineFreezeOptions, WasmEngineFreezeResult, WasmEngineGraphSpec, WasmEngineMarker, WasmEngineMeterTelemetry, WasmEngineMeterTelemetryWide, WasmEngineMetronomeConfig, WasmEngineParameterInfo, WasmEngineProcessWithMonitorResult, WasmEngineScopeTelemetry, WasmEngineTelemetry, WasmEngineTempoSegment, WasmEngineTimeSignatureSegment, WasmEngineTransportState, WasmExternalMidiEvent } from './sonare.js';
export type ExternalMidiEvent = WasmExternalMidiEvent;
export type EngineClip = WasmEngineClip;
export type ClipPageRequest = WasmClipPageRequest;
export type EngineParameterInfo = WasmEngineParameterInfo;
export type EngineAutomationPoint = WasmEngineAutomationPoint;
export type EngineMarker = WasmEngineMarker;
export type EngineMetronomeConfig = WasmEngineMetronomeConfig;
export type EngineGraphSpec = WasmEngineGraphSpec;
export type EngineCaptureStatus = WasmEngineCaptureStatus;
export type EngineCaptureSource = EngineCaptureStatus['source'] | number;
export type EngineBounceOptions = WasmEngineBounceOptions;
export type EngineBounceResult = WasmEngineBounceResult;
export type EngineFreezeOptions = WasmEngineFreezeOptions;
export type EngineFreezeResult = WasmEngineFreezeResult;
export type EngineTelemetry = WasmEngineTelemetry;
export type EngineMeterTelemetry = WasmEngineMeterTelemetry;
export type EngineMeterTelemetryWide = WasmEngineMeterTelemetryWide;
export type EngineScopeTelemetry = WasmEngineScopeTelemetry;
export type EngineTransportState = WasmEngineTransportState;
export type EngineTempoSegment = WasmEngineTempoSegment;
export type EngineTimeSignatureSegment = WasmEngineTimeSignatureSegment;
export interface EngineTrackSend {
    busId: number;
    levelDb?: number;
    enabled?: boolean;
    /**
     * Pre/post-fader tap point. Defaults to post-fader when omitted, matching the
     * historical lane-send behavior and the scene-JSON default.
     */
    sendTiming?: SendTiming | number;
}
export interface EngineTrackLane {
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
export type EngineTrackMonitorMode = 'off' | 'pfl' | 'afl' | 0 | 1 | 2;
/** Short alias for {@link EngineTrackMonitorMode}. */
export type TrackMonitorMode = EngineTrackMonitorMode;
export interface EngineBus {
    busId: number;
    gainDb?: number;
    /**
     * Channel layout of the bus (`SonareChannelLayout`: 0 mono, 1 stereo, 2 5.1,
     * 3 7.1). A surround layout makes this a surround group bus: lanes routed to
     * it are surround-panned and it sums into the master plane-by-plane. Defaults
     * to stereo.
     */
    channelLayout?: number;
    /**
     * Bus this bus's output sums into instead of the master mix (bus-to-bus
     * routing); 0 or absent keeps it on the master mix.
     */
    outputBusId?: number;
    /**
     * Sends to other buses, in the same shape as a track lane's sends. A
     * pre-fader send taps before `gainDb`, a post-fader one after it.
     */
    sends?: EngineTrackSend[];
}
export interface EngineMidiEvent {
    /** Absolute render frame for this event. Default `0`. */
    renderFrame?: number;
    word0?: number;
    word1?: number;
    word2?: number;
    word3?: number;
    wordCount?: number;
    /**
     * Redundant with `word0`, which already carries the UMP group in bits 24..27.
     * The engine reads the group from `word0` — the form that reaches a device or
     * a file — so packing it there is sufficient and a value here that contradicts
     * `word0` is ignored. Must still be in `[0, 15]`; anything else is rejected as
     * a malformed event. Default `0`.
     *
     * Utility (`word0` type nibble `0x0`) and UMP Stream (`0xF`) messages have no
     * group field — those bits are Reserved and `form`/`status` respectively — so
     * they always read as group `0` and packing a group into them has no effect.
     */
    group?: number;
    sysexHandle?: number;
    data0?: number;
    data1?: number;
}
export interface EngineMidiClipSchedule {
    id?: number;
    trackId?: number;
    destinationId?: number;
    startSample?: number;
    startPpq?: number;
    lengthSamples?: number;
    loop?: boolean;
    loopLengthSamples?: number;
    events: EngineMidiEvent[];
    /**
     * Linear gain applied to the destination instrument's rendered audio while
     * this clip is the most recently started active clip on it. Absent defaults
     * to `1` (unity).
     */
    gain?: number;
    /**
     * Linear fade lengths over the clip's full length (not per internal loop
     * repeat). Absent defaults to `0` (no fade). `fadeOutSamples` above `0` is
     * rejected when `lengthSamples` is absent or `<= 0` (open-ended): an
     * open-ended clip has no end to fade out towards.
     */
    fadeInSamples?: number;
    fadeOutSamples?: number;
}
export declare const EXPECTED_ENGINE_ABI_VERSION = 3;
/** Options for {@link RealtimeEngine.bindMidiCc}. All fields are optional. */
export interface MidiCcBindOptions {
    /** Lower end of the mapped parameter range. Default `0`. */
    minValue?: number;
    /** Upper end of the mapped parameter range. Default `1`. */
    maxValue?: number;
}
/** Request form of {@link RealtimeEngine.renderOffline}. */
export interface RenderOfflineRequest {
    /** One buffer per output plane; their common length is the render span. */
    channels: Float32Array[];
    /** Render block size. Default `128`. */
    blockSize?: number;
    /**
     * Whether this call ends the timeline. `true` (the default, and what a
     * one-shot bounce wants) releases every sounding note and flushes the PDC /
     * alignment delay lines before returning. `false` renders one CHUNK of a
     * longer timeline: a note held across the chunk boundary keeps sounding into
     * the next call and the delay lines carry their history over, so consecutive
     * chunks concatenate to exactly what one continuous render of the same span
     * produces. Call {@link RealtimeEngine.finishOfflineRender} once after the
     * last chunk.
     *
     * Sample-exact concatenation requires every chunk to use the same `blockSize`
     * and a frame count that is a whole number of blocks: each call restarts the
     * block grid at its own frame 0 and renders a short final block for the
     * remainder, and the clip / automation / MIDI-clip snapshots are frozen once
     * per block, so a chunk that ends mid-block shifts every later block
     * boundary. Audio stays continuous either way; only bit-identity is lost.
     */
    finalize?: boolean;
}
export interface EngineCapabilities {
    engineAbiVersion: number;
    expectedEngineAbiVersion: number;
    abiCompatible: boolean;
    sharedArrayBuffer: boolean;
    atomics: boolean;
    audioWorklet: boolean;
    mode: 'sab' | 'postMessage';
}
export declare function engineCapabilities(): EngineCapabilities;
export declare class RealtimeEngine {
    private native;
    private released;
    constructor(sampleRate?: number, maxBlockSize?: number, commandCapacity?: number, telemetryCapacity?: number, maxChannels?: number);
    /**
     * Size the engine's queues and scratch for a sample rate and block size.
     *
     * `commandCapacity` must not exceed 65536 and `telemetryCapacity` must not
     * exceed 16384; a larger value throws and leaves the engine untouched. The
     * telemetry number is not a queue depth paid for one-for-one: the engine
     * reserves that many meter records per metered lane, so its memory cost is
     * far larger than the number given here.
     */
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
     *
     * An `engineMode: 'sample'` patch also carries the {@link SampleBank} its
     * keymap names. The synth takes a share of the bank, so it may be released
     * right after this call; a sample patch bound without one renders silence.
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
        clearBankRig?: boolean;
        gsEfxRealization?: 'modern' | 'classic';
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
    /**
     * Replace a destination instrument's controller profile with a named preset
     * (see {@link controllerProfileNames}). Installing a profile drops every
     * channel's accumulated axis values: the new bindings say nothing about what
     * the old ones had reached. An unknown name throws, and so does a destination
     * with no instrument or one whose instrument holds no profile.
     */
    setControllerProfile(destinationId: number, presetName: string): void;
    /** Add one {@link ControllerBinding} on top of the destination's current profile. */
    bindController(destinationId: number, binding: ControllerBinding): void;
    /**
     * Drop every binding of the destination's controller profile. The instrument
     * keeps a profile; it resolves nothing until something is bound again.
     */
    clearControllerBindings(destinationId: number): void;
    controllerBindingCount(destinationId: number): number;
    /**
     * Whether note-on velocity is expression for this instrument. No fixed
     * default is possible — a wind controller ships sending breath-derived
     * velocity on one model and a constant on the next — so each preset states it
     * and a host building its own profile sets it. When false the synth takes
     * every note at full scale and the bound axes carry the dynamics alone.
     */
    setControllerVelocityMeaningful(destinationId: number, meaningful: boolean): void;
    controllerVelocityMeaningful(destinationId: number): boolean;
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
    setControllerNoteTracking(destinationId: number, dimension: MpeDimension | number, tracking: NoteTracking | number): void;
    /**
     * Read back {@link setControllerNoteTracking} for one dimension, as the
     * canonical name.
     */
    controllerNoteTracking(destinationId: number, dimension: MpeDimension | number): NoteTracking | number;
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
    setArticulation(destinationId: number, channel: number, articulation: Articulation | number): void;
    /**
     * Read back {@link setArticulation} as the canonical name. An ordinal this
     * build cannot spell is handed back as the number, the way every other enum
     * leaves this surface.
     */
    articulation(destinationId: number, channel: number): Articulation | number;
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
    legatoFallbackCount(destinationId: number): number;
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
     *
     * One queued record lowers to at most 4 MIDI 1.0 messages (a MIDI 2.0
     * registered or assignable controller becomes CC 101/100 or 99/98 plus Data
     * Entry 6/38), so a positive `maxRecords` below 4 could never consume a record
     * and is rejected with an `InvalidParameter` `SonareError` instead of
     * returning nothing forever.
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
    /**
     * Push a live MIDI pitch bend to the engine-owned MIDI input source.
     *
     * `bend14` is unsigned 14-bit with centre 8192 (0..16383) — the dimension is
     * not 7-bit, so a value past 16383 is refused rather than narrowed. The input
     * source must be enabled with {@link setMidiInputSource} first.
     */
    pushMidiInputPitchBend(group: number, channel: number, bend14: number, portTimeSamples?: number): void;
    /**
     * Push a live MIDI channel pressure to the engine-owned MIDI input source.
     * `pressure` is 7-bit (0..127). Under MPE this is the member channel's
     * per-note pressure.
     */
    pushMidiInputChannelPressure(group: number, channel: number, pressure: number, portTimeSamples?: number): void;
    /**
     * Push a live MIDI polyphonic key pressure to the engine-owned MIDI input
     * source. `note` and `pressure` are 7-bit (0..127).
     */
    pushMidiInputPolyPressure(group: number, channel: number, note: number, pressure: number, portTimeSamples?: number): void;
    pushMidiNoteOn(destinationId: number, group: number, channel: number, note: number, velocity: number, renderFrame?: number): void;
    pushMidiNoteOff(destinationId: number, group: number, channel: number, note: number, velocity?: number, renderFrame?: number): void;
    /**
     * Queue an immediate (live) MIDI control change to a MIDI destination
     * (engine kMidiCcImmediate). `group`/`channel` are 0..15; `controller`/`value`
     * are 7-bit (0..127). `renderFrame` is the frame to fire at, or -1 for
     * immediate. Mirrors the Node/Python/C-ABI `pushMidiCc`.
     */
    pushMidiCc(destinationId: number, group: number, channel: number, controller: number, value: number, renderFrame?: number): void;
    /**
     * Queue an immediate (live) MIDI pitch bend to a MIDI destination. `bend14`
     * is unsigned 14-bit with centre 8192 (0..16383); `renderFrame` is the frame
     * to fire at, or -1 for immediate. Mirrors the Node/Python/C-ABI
     * `pushMidiPitchBend`.
     */
    pushMidiPitchBend(destinationId: number, group: number, channel: number, bend14: number, renderFrame?: number): void;
    /**
     * Queue an immediate (live) MIDI channel pressure to a MIDI destination.
     * `pressure` is 7-bit (0..127); `renderFrame` is the frame to fire at, or -1
     * for immediate. Mirrors the Node/Python/C-ABI `pushMidiChannelPressure`.
     */
    pushMidiChannelPressure(destinationId: number, group: number, channel: number, pressure: number, renderFrame?: number): void;
    /**
     * Queue an immediate (live) MIDI polyphonic key pressure to a MIDI
     * destination. `note` and `pressure` are 7-bit (0..127); `renderFrame` is the
     * frame to fire at, or -1 for immediate. Mirrors the Node/Python/C-ABI
     * `pushMidiPolyPressure`.
     */
    pushMidiPolyPressure(destinationId: number, group: number, channel: number, note: number, pressure: number, renderFrame?: number): void;
    /**
     * Queue an immediate (live) raw UMP message to a MIDI destination. `words` is
     * 1 to 4 words, most significant first, and its length must match the message
     * type of `words[0]`. MIDI 2.0 channel-voice messages (MT 0x4) arrive at full
     * width; SysEx7 / data messages (MT 0x3 / 0x5) are refused, use
     * {@link pushMidiSysex}. Throws when the slot ring or command queue is full
     * (retry after a process block). `renderFrame` is the render-frame time to
     * apply, or -1 for immediate. A bare number is accepted as a one-word
     * message.
     */
    pushMidiUmp(destinationId: number, words: UmpWords | number, renderFrame?: number): void;
    /**
     * Push one raw UMP message (1 to 4 words) to the engine-owned MIDI input
     * source. The message rules match {@link pushMidiUmp}. `portTimeSamples` is
     * the port timestamp in samples.
     */
    pushMidiInputUmp(words: UmpWords, portTimeSamples?: number): void;
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
    /** Snap only insert automation slots after structural replay. */
    settleInsertParameters(): void;
    /** Drains queued commands on an offline/control-only engine immediately. */
    flushControlCommands(): void;
    /** Applies commands already due on a control-only mirror, retaining future commands. */
    applyCommandsDueNowPreservingFuture(): void;
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
    parameterInfoByIndex(index: number): Required<EngineParameterInfo>;
    parameterInfo(id: number): Required<EngineParameterInfo>;
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
    /**
     * Normalizes each send's pre/post tap point to the integer the native layer
     * reads (defaults to post-fader when omitted). Shared by track lanes and
     * buses, which carry the same send shape.
     */
    private static normalizeSends;
    setTrackLanes(lanes: Array<number | EngineTrackLane>): void;
    /**
     * Keys one insert of a lane strip from another lane's post-strip audio
     * (ducking/sidechainRouter inserts). sourceTrackId 0 removes the binding.
     */
    setLaneSidechain(trackId: number, insertIndex: number, sourceTrackId: number): void;
    setTrackBuses(buses: EngineBus[]): void;
    /**
     * Keys one insert of a bus strip from a track lane or another bus
     * (ducking/sidechainRouter inserts). `sourceId` 0 removes the binding.
     */
    setBusSidechain(busId: number, insertIndex: number, sourceKind: SidechainSourceKind | number, sourceId: number): void;
    /**
     * Keys one insert of the master strip from a track lane or a bus. Same
     * source rules as {@link setBusSidechain}.
     */
    setMasterSidechain(insertIndex: number, sourceKind: SidechainSourceKind | number, sourceId: number): void;
    setBusStripJson(busId: number, sceneJson: string): void;
    setTrackStripJson(trackId: number, sceneJson: string): void;
    setTrackStripEqBand(trackId: number, bandIndex: number, band: EqBand | string): void;
    setTrackStripEqBandJson(trackId: number, bandIndex: number, bandJson: string): void;
    setTrackStripInsertBypassed(trackId: number, insertIndex: number, bypassed: boolean, resetOnBypass?: boolean): void;
    /** Bus-strip counterpart of {@link setTrackStripEqBand}. */
    setBusStripEqBand(busId: number, bandIndex: number, band: EqBand | string): void;
    setBusStripEqBandJson(busId: number, bandIndex: number, bandJson: string): void;
    setMasterStripJson(sceneJson: string): void;
    setMasterStripEqBand(bandIndex: number, band: EqBand | string): void;
    setMasterStripEqBandJson(bandIndex: number, bandJson: string): void;
    setMasterStripInsertBypassed(insertIndex: number, bypassed: boolean, resetOnBypass?: boolean): void;
    /**
     * Changes one track-strip insert parameter in realtime, addressed by the
     * processor's JSON-key parameter name — one of the entries
     * {@link masteringInsertParamInfo} reports with a non-null `id`; a
     * construction-only entry (`id` null) takes effect only when the insert is
     * built. Applied at the next block head via the engine command queue; safe
     * during playback. Throws if the track, insert, or name is unknown, the
     * param is not realtime-safe, or the command queue is full.
     */
    setTrackStripInsertParamByName(trackId: number, insertIndex: number, paramName: string, value: number): void;
    /** Apply a live insert edit on this engine's owning thread without draining its command queue. */
    applyTrackStripInsertParamByNameNow(trackId: number, insertIndex: number, paramName: string, value: number): boolean;
    /** Restore a retained insert value exactly after a strip scene is replayed. */
    restoreTrackStripInsertParamByName(trackId: number, insertIndex: number, paramName: string, value: number): void;
    /** Master-strip counterpart of {@link setTrackStripInsertParamByName}. */
    setMasterStripInsertParamByName(insertIndex: number, paramName: string, value: number): void;
    applyMasterStripInsertParamByNameNow(insertIndex: number, paramName: string, value: number): boolean;
    restoreMasterStripInsertParamByName(insertIndex: number, paramName: string, value: number): void;
    /** Bus-strip counterpart of {@link setTrackStripInsertParamByName}. */
    setBusStripInsertParamByName(busId: number, insertIndex: number, paramName: string, value: number): void;
    applyBusStripInsertParamByNameNow(busId: number, insertIndex: number, paramName: string, value: number): boolean;
    restoreBusStripInsertParamByName(busId: number, insertIndex: number, paramName: string, value: number): void;
    /**
     * Forgets the remembered manual insert-parameter values of one track strip
     * and discards its queued insert edits. Call before {@link setTrackStripJson}
     * replaces the strip when its old values must not carry over; the setter
     * never does this itself, since a queued edit may already target the new chain.
     */
    clearTrackInsertParameterBases(trackId: number): void;
    clearBusInsertParameterBases(busId: number): void;
    clearMasterInsertParameterBases(): void;
    /** Bus-strip counterpart of {@link setTrackStripInsertBypassed}. */
    setBusStripInsertBypassed(busId: number, insertIndex: number, bypassed: boolean, resetOnBypass?: boolean): void;
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
    resolveTrackInsertAutomationId(trackId: number, insertIndex: number, paramName: string): number;
    resolveMasterInsertAutomationId(insertIndex: number, paramName: string): number;
    resolveBusInsertAutomationId(busId: number, insertIndex: number, paramName: string): number;
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
    resolveInstrumentAutomationId(destinationId: number, paramName: string): number;
    /** Sets a track lane strip's pan position in realtime (glitch-free). */
    setTrackStripPan(trackId: number, pan: number): void;
    /** Sets a track lane strip's pan law in realtime. */
    setTrackStripPanLaw(trackId: number, panLaw: PanLawInput): void;
    /** Sets a track lane strip's pan mode in realtime. */
    setTrackStripPanMode(trackId: number, panMode: PanMode | number): void;
    /** Sets a track lane strip's dual-pan left/right positions in realtime. */
    setTrackStripDualPan(trackId: number, leftPan: number, rightPan: number): void;
    /**
     * Sets a bus strip's output pan position in realtime (glitch-free). Throws
     * for an unknown bus or one wider than stereo.
     */
    setBusStripPan(busId: number, pan: number): void;
    /** Sets a bus strip's pan law in realtime. */
    setBusStripPanLaw(busId: number, panLaw: PanLawInput): void;
    /** Sets a bus strip's pan mode in realtime. */
    setBusStripPanMode(busId: number, panMode: PanMode | number): void;
    /** Sets a bus strip's dual-pan left/right positions in realtime. */
    setBusStripDualPan(busId: number, leftPan: number, rightPan: number): void;
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
    /** Cumulative warp-stretch requests dropped because the native queue was full. */
    warpStretchOverflowCount(): number;
    /**
     * Sets the number of concurrent time-stretch voices. `voices` must be an
     * integer in `[0, 64]`; a non-integer, negative, or larger value throws and
     * leaves the capacity unchanged. Default is 8. Capacity 0 disables
     * time-stretch, so every warped clip plays resampled instead and none of
     * that counts toward {@link warpStretchOverflowCount}. A change applied
     * while the engine is running restarts the splice state of any clip
     * stretching through a voice at that moment. Control-thread only.
     */
    setWarpVoiceCapacity(voices: number): void;
    /** Reads the current time-stretch voice capacity (default 8). */
    warpVoiceCapacity(): number;
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
    setClipPagePrefetchFrames(frames: number): void;
    /** Current clip-page look-ahead window in timeline frames. */
    clipPagePrefetchFrames(): number;
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
    /**
     * Allocates the cue-bus counterpart of {@link prepareChannels}. Needed only
     * when PFL/AFL monitoring must reach a separate output: `processPrepared`
     * folds the cue bus into the program output, while
     * {@link processPreparedWithMonitor} keeps the two apart. Call once, off the
     * audio thread, with at least as many channels as `prepareChannels` got.
     */
    prepareMonitorChannels(numChannels: number, maxFrames: number): void;
    /**
     * Returns a Float32Array view onto the persistent cue-bus scratch for one
     * channel (valid for up to `numFrames`). Read it after
     * {@link processPreparedWithMonitor}. Re-acquire after WASM memory growth.
     */
    getMonitorChannelBuffer(channel: number, numFrames: number): Float32Array;
    /**
     * Runs the engine in place over the prepared scratch, writing the cue bus to
     * the monitor scratch instead of folding it into the program output.
     * Allocation-free: safe on the AudioWorklet render thread after
     * `prepareChannels` and `prepareMonitorChannels`.
     */
    processPreparedWithMonitor(numFrames: number): void;
    processWithMonitor(channels: Float32Array[]): WasmEngineProcessWithMonitorResult;
    /**
     * Render `channels` offline from the current transport position. Requesting
     * more planes than `prepare` reserved throws an `InvalidParameter`
     * `SonareError` rather than returning silence that reads as a finished render.
     *
     * Set `finalize: false` to render one chunk of a longer timeline; see
     * {@link RenderOfflineRequest.finalize} and {@link finishOfflineRender}.
     */
    renderOffline(request: RenderOfflineRequest): Float32Array[];
    renderOffline(channels: Float32Array[], blockSize?: number): Float32Array[];
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
    finishOfflineRender(): void;
    /**
     * Bounce the timeline to an interleaved buffer. `numChannels` above the
     * prepared channel count throws an `InvalidParameter` `SonareError`.
     */
    bounceOffline(options: EngineBounceOptions): EngineBounceResult;
    /**
     * Freeze the current graph to audio. `numChannels` above the prepared channel
     * count throws an `InvalidParameter` `SonareError`.
     */
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
    /** Release the underlying WASM object. Idempotent, as the Node facade is. */
    destroy(): void;
    /** Alias for {@link destroy}, matching embind's own release method name. */
    delete(): void;
}
export declare class ClipPageProvider {
    private readonly engine;
    readonly id: number;
    private disposed;
    constructor(engine: RealtimeEngine, id: number);
    supply(pageIndex: number, channels: Float32Array[]): void;
    clear(pageIndex: number): void;
    destroy(): void;
}
