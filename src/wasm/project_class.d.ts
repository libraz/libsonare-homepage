import type { BuiltinSynthBinding, Sf2InstrumentConfig, Sf2ProgramStatus, SynthPatch } from './instrument_types';
import type { ExternalSeparatedStemImportRequest, ExternalSeparatedStemImportResult, MidiCcLearnOptions, ProjectAssistSidecar, ProjectAssistSidecarInput, ProjectAutomationLaneDesc, ProjectAutomationPoint, ProjectBounceOptions, ProjectChordSymbol, ProjectClip, ProjectClipCompSegment, ProjectClipDesc, ProjectClipFade, ProjectClipTake, ProjectCompileResult, ProjectDeserializeResult, ProjectKeySegment, ProjectLoopMode, ProjectLoopRecordingDesc, ProjectLoopRecordingResult, ProjectMarker, ProjectMidiCcBinding, ProjectMidiClipResult, ProjectMidiEvent, ProjectMidiFxBakeRequest, ProjectMidiFxBakeResult, ProjectMidiFxPreviewRequest, ProjectMidiRouteConfig, ProjectMidiRouteResult, ProjectNotePairValidation, ProjectSource, ProjectTempoCandidate, ProjectTempoOptions, ProjectTempoSegment, ProjectTimeSignatureSegment, ProjectTrack, ProjectTrackDesc, ProjectTrackKind, ProjectTranscribeRequest, ProjectWarpMapDesc, ProjectWarpMode } from './project_types';
/**
 * Headless DAW project (control-thread-only arrangement model).
 *
 * Wraps the embind `Project` class over the C-ABI keystone
 * `sonare_c_project.{h,cpp}`. Construct an empty project with `new Project()`,
 * or deserialize one with {@link Project.fromJson}; serialize back with
 * {@link toJson}; compile to a renderable timeline with {@link compile}; render
 * offline to interleaved float audio with {@link bounce}. The edit and MIDI
 * methods mirror the Node/Python project bindings.
 *
 * Call {@link delete} (or use a `try/finally`) to release the underlying WASM
 * object — the embind handle is not garbage-collected automatically.
 *
 * @example
 * ```typescript
 * const project = new Project();
 * try {
 *   project.setSampleRate(48000);
 *   const json = project.toJson();
 *   const restored = Project.fromJson(json);
 *   restored.delete();
 * } finally {
 *   project.delete();
 * }
 * ```
 */
export declare class Project {
    private native;
    constructor();
    /** Create a new empty project. */
    static create(): Project;
    /** Pack a MIDI 1.0 note-on event accepted by {@link setMidiEvents}. */
    static midiNoteOn(ppq: number, group: number, channel: number, note: number, velocity: number): ProjectMidiEvent;
    /** Pack a MIDI 1.0 note-off event accepted by {@link setMidiEvents}. */
    static midiNoteOff(ppq: number, group: number, channel: number, note: number, velocity?: number): ProjectMidiEvent;
    /** Pack a MIDI 1.0 control-change event. */
    static midiCc(ppq: number, group: number, channel: number, controller: number, value: number): ProjectMidiEvent;
    /** Pack a MIDI 1.0 poly-pressure event. */
    static midiPolyPressure(ppq: number, group: number, channel: number, note: number, pressure: number): ProjectMidiEvent;
    /** Pack a MIDI 1.0 program-change event. */
    static midiProgram(ppq: number, group: number, channel: number, program: number): ProjectMidiEvent;
    /** Return the General MIDI instrument name for `program`, or `null` when out of range. */
    static gmInstrumentName(program: number): string | null;
    /** Return the General MIDI program number for a canonical instrument name, or `-1`. */
    static gmProgramForName(name: string): number;
    /** Return the General MIDI family name for `family`, or `null` when out of range. */
    static gmFamilyName(family: number): string | null;
    /** Return the first General MIDI program number in `family`, or `-1`. */
    static gmFamilyFirstProgram(family: number): number;
    /** Return the GM2 bank/program instrument variation name, or `null` when unavailable. */
    static gm2InstrumentName(bankLsb: number, program: number): string | null;
    /** Return the General MIDI drum name for `note`, or `null` when out of range. */
    static gmDrumName(note: number): string | null;
    /** Return the General MIDI drum note for a canonical drum name, or `-1`. */
    static gmDrumNoteForName(name: string): number;
    /** Return the GM2 drum-set name for `bankLsb`, or `null` when unavailable. */
    static gm2DrumSetName(bankLsb: number): string | null;
    /** Return the GM2 drum name for `bankLsb`/`note`, or `null` when unavailable. */
    static gm2DrumName(bankLsb: number, note: number): string | null;
    /** Return the MIDI CC name for `controller`, or `null` when out of range. */
    static midiCcName(controller: number): string | null;
    /** Return the MIDI CC number for a canonical controller name, or `-1`. */
    static midiCcIndexForName(name: string): number;
    /** Return the MIDI 2.0 per-note controller name for `index`, or `null`. */
    static perNoteControllerName(index: number): string | null;
    /** Expand bank-select + program-change into MIDI events accepted by {@link setMidiEvents}. */
    static midiBankProgram(ppq: number, group: number, channel: number, bankMsb: number, bankLsb: number, program: number): ProjectMidiEvent[];
    /** Route MIDI events through the native MidiRouter filter/remap/thru logic. */
    static midiRouteEvents(events: ReadonlyArray<ProjectMidiEvent>, config?: ProjectMidiRouteConfig): ProjectMidiRouteResult;
    /** Run native MIDI learn over an event stream; returns `null` when nothing is learned. */
    static midiCcLearn(events: ReadonlyArray<ProjectMidiEvent>, paramId: number, options?: MidiCcLearnOptions): ProjectMidiCcBinding | null;
    /** Convert one CC event to an automation breakpoint using native CcMap. */
    static midiCcToBreakpoint(bindings: ReadonlyArray<ProjectMidiCcBinding>, event: ProjectMidiEvent): ProjectAutomationPoint | null;
    /** Convert one automation value back to a CC UMP event using native CcMap. */
    static midiParamToCc(bindings: ReadonlyArray<ProjectMidiCcBinding>, paramId: number, unitValue: number, group: number, ppq?: number): ProjectMidiEvent | null;
    /** Pack a MIDI 1.0 channel-pressure event. */
    static midiChannelPressure(ppq: number, group: number, channel: number, pressure: number): ProjectMidiEvent;
    /** Pack a MIDI 1.0 pitch-bend event (`bend` is unsigned 14-bit, center = 8192). */
    static midiPitchBend(ppq: number, group: number, channel: number, bend: number): ProjectMidiEvent;
    /**
     * Deserialize project JSON into a new {@link Project}. Throws if the JSON is
     * malformed, surfacing the joined diagnostic messages.
     */
    static fromJson(json: string): Project;
    /**
     * Deserialize project JSON and return native warning diagnostics emitted on
     * successful loads, such as dangling source references preserved for repair.
     */
    static fromJsonWithDiagnostics(json: string): ProjectDeserializeResult;
    /** Serialize the project (+ MIDI content) to deterministic JSON. */
    toJson(): string;
    /**
     * Set the project sample rate in Hz. Must be in `[8000, 384000]`; anything
     * outside that range throws. Applied through the edit history, so it is
     * undoable.
     */
    setSampleRate(sampleRate: number): void;
    /** Add a track and return its allocated stable id. */
    addTrack(desc?: ProjectTrackDesc): number;
    /** Add an audio or MIDI clip and return its allocated clip id. */
    addClip(desc: ProjectClipDesc): number;
    /** Import host-separated PCM through the normal audio-track/clip path. */
    importExternalStems(request: ExternalSeparatedStemImportRequest): ExternalSeparatedStemImportResult;
    /** Split captured loop-recording audio into takes and add one clip. */
    addLoopRecordingTakes(desc: ProjectLoopRecordingDesc): ProjectLoopRecordingResult;
    /** Create a MIDI track + clip; returns `{ trackId, clipId }`. */
    addMidiClip(startPpq: number, lengthPpq: number): ProjectMidiClipResult;
    /** Split a clip at `splitPpq` and return the new clip id. */
    splitClip(clipId: number, splitPpq: number): number;
    /** Trim a clip's start / length in PPQ. */
    trimClip(clipId: number, newStartPpq: number, newLengthPpq: number): void;
    /** Move a clip to `newStartPpq` and optionally another track. */
    moveClip(clipId: number, newStartPpq: number, newTrackId?: number): void;
    /** Change a track kind via an undoable edit. */
    setTrackKind(trackId: number, kind: ProjectTrackKind): void;
    /** Set a clip's warp reference id (0 clears it). */
    setClipWarpRef(clipId: number, warpRefId: number): void;
    /** Set a clip's warp playback mode. */
    setClipWarpMode(clipId: number, mode: ProjectWarpMode): void;
    /** Add or replace a first-class warp map referenced by clip warp ids. */
    setWarpMap(map: ProjectWarpMapDesc): void;
    /** Remove a first-class warp map by id. */
    removeWarpMap(warpRefId: number): void;
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
    setTrackMidiDestination(trackId: number, destinationId: number): void;
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
    setTrackGain(trackId: number, gain: number): void;
    /** Set a track's mute flag via an undoable edit (a muted track is silent). */
    setTrackMute(trackId: number, mute: boolean): void;
    /** Set a track's solo flag via an undoable edit (when any track is soloed, only soloed tracks sound). */
    setTrackSolo(trackId: number, solo: boolean): void;
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
    setTrackPan(trackId: number, pan: number): void;
    /** Undo the most recent edit. */
    undo(): void;
    /** Redo the most recently undone edit. */
    redo(): void;
    /** Clear the undo/redo history without changing the current project state. */
    clearHistory(): void;
    /** Cap the undo history depth (clamped to >= 1); evicts oldest entries beyond the cap. */
    setMaxUndoDepth(depth: number): void;
    /** Set the combined undo/redo history byte cap. Zero disables retention. */
    setMaxHistoryBytes(bytes: number): void;
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
    setMidiEvents(clipId: number, events: ReadonlyArray<ProjectMidiEvent | readonly [number, number, number]>): void;
    /**
     * Import an in-memory SMF buffer; returns the first added clip id.
     * Malformed or partially truncated tracks are rejected instead of installing
     * a silently shortened clip.
     */
    importSmf(data: Uint8Array): number;
    /**
     * Export the project's tempo map + MIDI clips to an SMF byte buffer.
     *
     * @remarks
     * The buffer owns a plain `ArrayBuffer`, which is what the `Blob` / `File`
     * constructors accept — so `new Blob([project.exportSmf()])` compiles without
     * a copy through `new Uint8Array(...)` first.
     */
    exportSmf(): Uint8Array<ArrayBuffer>;
    /**
     * Import a MIDI 2.0 Clip File (`SMF2CLIP`); returns the first added clip id.
     * Unlike {@link importSmf}, MIDI 2.0 channel-voice messages (16-bit velocity,
     * 32-bit CC, per-note / registered controllers, bank-valid Program Change)
     * survive without loss.
     */
    importClipFile(data: Uint8Array): number;
    /**
     * Export the project's tempo map + MIDI clips to a MIDI 2.0 Clip File
     * (`SMF2CLIP`) byte buffer. MIDI 2.0-only events are written without loss —
     * prefer this over {@link exportSmf} when MIDI 2.0 fidelity matters.
     *
     * @remarks
     * As with {@link exportSmf}, the buffer owns a plain `ArrayBuffer` and goes
     * straight into a `Blob`.
     */
    exportClipFile(): Uint8Array<ArrayBuffer>;
    /**
     * Set a MIDI clip's channel-0 program / bank at source PPQ 0. `bank` defaults
     * to `-1` (no Bank Select emitted), matching `setProgramOnChannel` and the
     * Node/Python surfaces; pass `>= 0` to emit a Bank Select.
     */
    setProgram(clipId: number, program: number, bank?: number): void;
    /** Set a MIDI clip's program / bank for one UMP group and channel. */
    setProgramOnChannel(clipId: number, group: number, channel: number, program: number, bank?: number): void;
    /**
     * Destructively bake a MIDI-FX chain into all stored events. Large clips are
     * drained without truncation; failure leaves the original clip unchanged.
     */
    bakeMidiFx(clipId: number, configJson: string): void;
    /**
     * Request form. Setting `withSourceIndex` also returns per-event provenance,
     * so a selection or an editorial annotation can be carried across the bake.
     */
    bakeMidiFx(request: ProjectMidiFxBakeRequest): ProjectMidiFxBakeResult;
    /**
     * Count the events {@link bakeMidiFx} would produce for this clip and
     * configuration, without mutating the project. The transform is
     * deterministic, so the count matches what the bake goes on to produce.
     */
    previewMidiFxCount(request: ProjectMidiFxPreviewRequest): number;
    /** Backward alias for {@link bakeMidiFx}. */
    setMidiFx(clipId: number, configJson: string): void;
    /**
     * Pre-flight check for hanging / unmatched notes in a MIDI clip: reports
     * whether every note-on in the exported half-open playback window has a
     * matching note-off (FIFO per group+channel+note). Useful before bouncing to
     * catch a stuck note. Throws if `clipId` is unknown or not a MIDI clip.
     */
    validateMidiNotes(clipId: number): ProjectNotePairValidation;
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
    transcribeToClip(request: ProjectTranscribeRequest): number;
    /** Return ranked tempo-octave and detected-meter candidates without editing. */
    analyzeTempo(audio: Float32Array, sampleRate: number, options?: ProjectTempoOptions): ProjectTempoCandidate[];
    /**
     * Detect and install a ranked tempo candidate; optionally apply detected meter.
     *
     * @remarks
     * `candidateIndex` indexes the ranking {@link analyzeTempo} produced, so pair
     * the two on the same `options`. Read the installed map back with
     * {@link tempoSegmentCount} and {@link tempoSegmentByIndex}.
     */
    autoTempo(audio: Float32Array, sampleRate: number, candidateIndex?: number, applyTimeSignatures?: boolean, options?: ProjectTempoOptions): number;
    /** Snap to a bar (`division=0`), beat (`1`), or beat subdivision (`2+`). */
    snapToGrid(ppq: number, strength?: number, division?: number): number;
    /** Compile the project into a renderable timeline, surfacing diagnostics. */
    compile(): ProjectCompileResult;
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
    bounce(options?: ProjectBounceOptions): Float32Array;
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
    bounceWithBuiltinInstrument(instrument?: BuiltinSynthBinding | ReadonlyArray<BuiltinSynthBinding>, options?: ProjectBounceOptions): Float32Array;
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
    bounceWithSynthInstrument(instrument?: SynthPatch | string | ReadonlyArray<SynthPatch | string>, options?: ProjectBounceOptions): Float32Array;
    /**
     * Load (parse) SoundFont 2 bytes into the project: presets / instruments /
     * sample headers plus the sample PCM decoded to a float pool. The host
     * fetches the `.sf2` and passes the raw bytes; they are copied into linear
     * memory for the call and not referenced afterwards. Replaces any previously
     * loaded SoundFont; throws on malformed input (the previous SoundFont is
     * kept).
     */
    loadSoundFont(data: Uint8Array): void;
    /** Release the project's loaded SoundFont (no-op when none is loaded). */
    clearSoundFont(): void;
    /** Number of presets in the loaded SoundFont (0 when none is loaded). */
    soundFontPresetCount(): number;
    /**
     * Enumerate every (channel, bank, program) combination the arrangement plays
     * a note through, in first-use order, reporting whether each resolves in the
     * loaded SoundFont (`'sf2'`, GS variation/drum fallbacks included) or would
     * fall back to the built-in synth (`'synth'`). Without a loaded SoundFont
     * every entry is a synth fallback.
     */
    soundFontManifest(): Sf2ProgramStatus[];
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
    bounceWithSf2Instrument(instrument?: Sf2InstrumentConfig | ReadonlyArray<Sf2InstrumentConfig>, options?: ProjectBounceOptions): Float32Array;
    /** Remove a clip (undoable). */
    removeClip(clipId: number): void;
    /** Set a clip's linear playback gain (>= 0; undoable). */
    setClipGain(clipId: number, gain: number): void;
    /** Set a clip's fade-in / fade-out regions (undoable). */
    setClipFade(clipId: number, fadeIn?: ProjectClipFade, fadeOut?: ProjectClipFade): void;
    /** Audio source ids that need decoded PCM after deserialization. */
    unresolvedAudioSourceIds(): number[];
    /** Register decoded interleaved PCM for an existing audio source (undoable). */
    setSourceAudio(sourceId: number, audio: Float32Array, channels: number, sampleRate: number): void;
    /** Replace an audio source's metadata strings as one undoable edit. */
    setAudioSourceMetadata(sourceId: number, contentHash: string, externalStemRole: string): void;
    /** Replace a clip's take list and active take id (undoable). */
    setClipTakes(clipId: number, takes: ReadonlyArray<ProjectClipTake>, activeTakeId?: number): void;
    /** Replace a clip's comp segments (undoable). */
    setClipCompSegments(clipId: number, segments: ReadonlyArray<ProjectClipCompSegment>): void;
    /**
     * Set a clip's loop mode + loop length in PPQ (undoable). `loopCrossfadePpq`
     * is an optional equal-power crossfade at the loop seam (PPQ, finite and >= 0;
     * 0 = hard loop); the engine clamps it to the clip's pre-roll and half the loop.
     */
    setClipLoop(clipId: number, loopMode: ProjectLoopMode, loopLengthPpq?: number, loopCrossfadePpq?: number): void;
    /** Rebind a clip to a different (already-registered) source (undoable). */
    setClipSource(clipId: number, sourceId: number): void;
    /** Duplicate a clip at `newStartPpq` (same track); returns the new clip id. */
    duplicateClip(clipId: number, newStartPpq: number): number;
    /** Remove a track and its clips (undoable). */
    removeTrack(trackId: number): void;
    /** Rename a track (undoable). */
    renameTrack(trackId: number, name: string): void;
    /** Set a track's mixer-strip binding + output target (undoable; omit / '' clears). */
    setTrackRoute(trackId: number, channelStripRef?: string, outputTarget?: string): void;
    /** Append an automation lane; returns its stable target parameter id (undoable). */
    addAutomationLane(trackId: number, desc: ProjectAutomationLaneDesc): number;
    /** Replace the lane identified by its stable target parameter id (undoable). */
    editAutomationLane(trackId: number, targetParamId: number, desc: ProjectAutomationLaneDesc): void;
    /** Remove the lane identified by its stable target parameter id (undoable). */
    removeAutomationLane(trackId: number, targetParamId: number): void;
    /** Replace the project's key annotation stream (undoable). */
    annotateKeys(keys: ReadonlyArray<ProjectKeySegment>): void;
    /** Replace the project's chord-symbol annotation stream (undoable). */
    annotateChords(chords: ReadonlyArray<ProjectChordSymbol>): void;
    /**
     * Add or update an opaque assist sidecar via an undoable edit.
     *
     * The descriptor form is the canonical API and matches the Node binding;
     * the positional form remains available for compatibility with the original
     * WASM facade.
     */
    setAssistSidecar(sidecar: ProjectAssistSidecarInput): void;
    setAssistSidecar(moduleId: string, schemaVersion: number, targetTrackId: number, regionStartPpq: number, regionEndPpq: number, payload: Uint8Array): void;
    /** Number of assist sidecars currently stored on the project. */
    assistSidecarCount(): number;
    /** Read one assist sidecar by stable project order. */
    getAssistSidecar(index: number): ProjectAssistSidecar;
    /** Read every stored assist sidecar in the same order as the index getter. */
    assistSidecars(): ProjectAssistSidecar[];
    /** Set the project's clip-overlap policy (SonareProjectOverlapPolicy ordinal). */
    setOverlapPolicy(policy: number): void;
    /** Read the project's clip-overlap policy (SonareProjectOverlapPolicy ordinal). */
    getOverlapPolicy(): number;
    /** Read the project sample rate in Hz. */
    getSampleRate(): number;
    /** Replace the project's mixer scene from a scene JSON string. */
    setMixerSceneJson(sceneJson: string): void;
    /**
     * Add or replace a marker. Pass `markerId` 0 to allocate a new id; returns the
     * stable marker id (the allocated id when 0 was passed).
     */
    setMarker(markerId: number, ppq: number, name: string): number;
    /**
     * Add or replace a marker from a full {@link ProjectMarker}, including its
     * {@link MarkerKind} and (for key signatures) the key. Pass `id` 0 to allocate
     * a new id; returns the stable marker id.
     */
    setMarkerEx(marker: ProjectMarker): number;
    /** Read a project marker by index (0-based, in stored order). */
    markerByIndex(index: number): ProjectMarker;
    /** Read a stored project track by 0-based index. */
    trackByIndex(index: number): ProjectTrack;
    /** Read a stored project clip by 0-based index. */
    clipByIndex(index: number): ProjectClip;
    /** Read a stored project source by 0-based index. */
    sourceByIndex(index: number): ProjectSource;
    /** Number of markers in the project. */
    markerCount(): number;
    /** Number of tracks in the project. */
    trackCount(): number;
    /** Number of clips in the project. */
    clipCount(): number;
    /** Number of audio sources registered on the project. */
    sourceCount(): number;
    /** Number of tempo-map segments on the project. */
    tempoSegmentCount(): number;
    /**
     * Reads a tempo segment by index, in stored order.
     *
     * @param index - Zero-based index below {@link tempoSegmentCount}
     * @returns The segment, in the shape {@link setTempoSegments} accepts
     * @throws When the index is at or past the count
     */
    tempoSegmentByIndex(index: number): ProjectTempoSegment;
    /**
     * Reads a time-signature segment by index, in stored order.
     *
     * @param index - Zero-based index below {@link timeSignatureCount}
     * @returns The segment, in the shape {@link setTimeSignatures} accepts
     * @throws When the index is at or past the count
     */
    timeSignatureByIndex(index: number): ProjectTimeSignatureSegment;
    /** Number of time-signature segments on the project. */
    timeSignatureCount(): number;
    /** Replace the project's tempo map with the given segments. */
    setTempoSegments(segments: ReadonlyArray<ProjectTempoSegment>): void;
    /** Replace the project's time-signature map with the given segments. */
    setTimeSignatures(segments: ReadonlyArray<ProjectTimeSignatureSegment>): void;
    /**
     * Compile diagnostics produced by the most recent bounce on this project
     * (e.g. MIDI clips rendering silently without a bound instrument). On a
     * project no bounce has ever run on, the result is empty in full:
     * `hasTimeline` is `false` and `diagnostics` is empty. A failed bounce is
     * distinguishable from that state, because a bounce only loses its timeline
     * through an error diagnostic and so always reports at least one.
     */
    lastBounceCompileResult(): ProjectCompileResult;
    /** Release the underlying WASM object. Safe to call only once. */
    delete(): void;
    /** Alias for {@link delete}, provided for cross-binding (Node) compatibility. */
    destroy(): void;
}
