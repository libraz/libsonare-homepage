import { type OpfsClipStreamOptions } from '../clip_page_streamer';
import type { EngineAutomationPoint, EngineBus, EngineCaptureStatus, EngineClip, EngineMarker, EngineMetronomeConfig, EngineMidiClipSchedule, EngineParameterInfo, EngineTempoSegment, EngineTimeSignatureSegment, EngineTrackLane, EngineTrackMonitorMode, EngineTrackSend, EngineTransportState, EqBand, MidiCcBindOptions, PanLaw, PanMode, SidechainSourceKind } from '../index';
import { type OpfsClipPageProviderBinding } from '../opfs_clip_pages';
import type { ClipPageProvider } from '../realtime_engine';
import { type CaptureOptions } from './engine-offline';
import type { SonareEngineOptions } from './engine-options';
import type { SonareEngineTransportFacade, SonareRealtimeEngineNodeCapabilities, SonareWorkletExternalMidiEvent } from './messages';
import { type SonareEngineTelemetryRecord, type SonareWorkletMeterSnapshot, type SonareWorkletScopeSnapshot } from './protocol';
export declare class SonareEngine {
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
    private readonly insertAutomationIdsByTarget;
    private readonly clips;
    private readonly midiClips;
    private readonly markers;
    private readonly trackLaneIds;
    private readonly trackSends;
    private readonly trackOutputBus;
    private readonly trackSourceChannelLayout;
    private readonly laneSidechains;
    private readonly busSidechains;
    private readonly masterSidechains;
    private readonly buses;
    private readonly trackStripJson;
    private readonly busStripJson;
    private readonly insertParamOverrides;
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
    /**
     * A loop wrap, seek or stop sends note-offs plus CC64=0, CC121, CC123 and a
     * centred pitch bend on every channel played since the last reset, so
     * controller values set before a loop region are not restored at the wrap.
     */
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
     * The returned id uses the track's current positional lane selector. When
     * setTrackLanes successfully changes lane order or membership, the engine
     * remaps already queued and published track automation by track id, but it
     * cannot update a numeric id retained by the caller. Re-resolve every track
     * insert id after such a topology change before passing it to
     * setAutomationLane. Use setTrackStripInsertParamByName when the operation
     * needs a stable track identity. Master and bus insert ids are separate and
     * are not invalidated by track-lane changes.
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
     * Resolves a hosted instrument's continuous parameter to its reserved
     * instrument-automation id, so an instrument parameter follows a breakpoint
     * lane at audio-block precision like a strip insert. Bind the instrument
     * (`setSynthInstrument`) before resolving.
     *
     * @param destinationId MIDI destination the instrument is bound to.
     * @param paramName Instrument JSON-key parameter name (e.g. `cutoffHz`).
     * @returns Reserved instrument-automation id, or -1 when destination/key unknown.
     */
    resolveInstrumentAutomationId(destinationId: number, paramName: string): number;
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
    /** Resets the master's integrated loudness accumulator in both engine mirrors. */
    resetMasterLoudnessMeter(renderFrame?: number): boolean;
    /**
     * Declares the mixer track lanes in an explicit order.
     *
     * A successful call may reorder existing track ids, remove track ids, or add
     * new ones. Existing queued and published track automation follows the track
     * id, while numeric track-insert automation ids retained by the caller do
     * not; re-resolve those ids after every topology change. Entries carrying
     * `sends` replace that track's send list; entries without `sends` leave
     * existing sends untouched.
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
    /**
     * Bus-strip counterpart of {@link setStripInsertBypassed}. A bus is addressed
     * by its numeric id, which the `target` of the track/master form cannot
     * express, so it is its own method exactly like
     * {@link setBusStripInsertParamByName}. Bypassing keeps the insert's internal
     * state (reverb tail, compressor envelope) unless `resetOnBypass` is set;
     * re-posting the bus scene JSON, the only workaround before this existed,
     * rebuilds the chain and loses it.
     */
    setBusStripInsertBypassed(busId: number, insertIndex: number, bypassed: boolean, resetOnBypass?: boolean): void;
    /** Bus-strip counterpart of {@link setTrackStripEqBand}. */
    setBusStripEqBand(busId: number, bandIndex: number, band: EqBand | string): void;
    /** Bus-strip counterpart of {@link setTrackStripPan}; refused on a surround bus. */
    setBusStripPan(busId: number, pan: number): void;
    setBusStripPanLaw(busId: number, panLaw: PanLaw | number): void;
    setBusStripPanMode(busId: number, panMode: PanMode | number): void;
    setBusStripDualPan(busId: number, leftPan: number, rightPan: number): void;
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
    /**
     * Sets the clip-page look-ahead window in timeline frames on both the worklet
     * engine and this thread's offline engine.
     *
     * The audio thread reports the pages it is *about to* read that are not
     * resident yet, so the sliding-window streamer can service them before the
     * playhead reaches them. Without look-ahead a page miss is only reported
     * after the read already produced silence, which costs one block of silence
     * at every page boundary that was not primed.
     *
     * Defaults to half a second at the engine's sample rate. `0` disables it.
     * Safe to call during playback.
     */
    setClipPagePrefetchFrames(frames: number): void;
    /**
     * Sets the number of concurrent time-stretch voices on both this thread's
     * offline engine and the live worklet engine. `voices` must be an integer
     * in `[0, 64]`; a non-integer, negative, or larger value throws and leaves
     * the capacity unchanged on both engines. Default is 8. Capacity 0 disables
     * time-stretch, so every warped clip plays resampled instead. A change
     * applied while the engine is running restarts the splice state of any clip
     * stretching through a voice at that moment.
     */
    setWarpVoiceCapacity(voices: number): void;
    /** Reads the current time-stretch voice capacity (default 8). */
    warpVoiceCapacity(): number;
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
        clearBankRig?: boolean;
        gsEfxRealization?: 'modern' | 'classic';
    }): void;
    /**
     * Route a track's MIDI to the external output (drained via {@link onMidiOut})
     * instead of an internal instrument, so the track plays an external device.
     * Pass `external=false` to restore internal-synth playback. The change takes
     * effect at the next processed block; switching a destination's route first
     * releases its notes and resets its controllers through the old route, and
     * drops its pending MIDI-FX events.
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
    pushMidiPitchBend(trackId: string | number, group: number, channel: number, bend14: number, renderFrame?: number): void;
    pushMidiChannelPressure(trackId: string | number, group: number, channel: number, pressure: number, renderFrame?: number): void;
    pushMidiPolyPressure(trackId: string | number, group: number, channel: number, note: number, pressure: number, renderFrame?: number): void;
    pushMidiUmp(trackId: string | number, word0: number, renderFrame?: number): void;
    pushMidiSysex(trackId: string | number, data: Uint8Array, renderFrame?: number): void;
    bindMidiCc(channel: number, controller: number, paramId: number, options?: MidiCcBindOptions): void;
    setMidiInputSource(destinationId?: number): void;
    clearMidiInputSource(): void;
    pushMidiInputNoteOn(group: number, channel: number, note: number, velocity: number, portTimeSamples?: number): void;
    pushMidiInputNoteOff(group: number, channel: number, note: number, velocity?: number, portTimeSamples?: number): void;
    pushMidiInputCc(group: number, channel: number, controller: number, value: number, portTimeSamples?: number): void;
    pushMidiInputPitchBend(group: number, channel: number, bend14: number, portTimeSamples?: number): void;
    pushMidiInputChannelPressure(group: number, channel: number, pressure: number, portTimeSamples?: number): void;
    pushMidiInputPolyPressure(group: number, channel: number, note: number, pressure: number, portTimeSamples?: number): void;
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
    private insertAutomationTargetKey;
    private rememberInsertAutomationId;
    private clearInsertAutomationLanes;
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
