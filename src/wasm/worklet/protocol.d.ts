import type { EngineMeterTelemetry, EngineTelemetry } from '../index';
export declare const ENGINE_MIXER_PARAM_FADER_DB = 1;
export declare const ENGINE_MIXER_PARAM_PAN = 2;
export declare function engineMixerLaneTarget(laneIndex: number, paramKind: number): number;
export declare function engineMixerBusTarget(busIndex: number, paramKind: number): number;
export declare function engineMixerMasterTarget(paramKind: number): number;
export interface SonareWorkletMeterSnapshot {
    type: 'meter';
    targetId: number;
    frame: number;
    peakDbL: number;
    peakDbR: number;
    rmsDbL: number;
    rmsDbR: number;
    correlation: number;
    /**
     * Left-channel inter-sample (true) peak in dB, from the ITU-R BS.1770-4
     * polyphase reconstruction at 4x. A streaming measurement, and the render
     * quantum makes that visible here: the centered reconstruction stencil needs a
     * few future samples a realtime path does not have, so each block's last
     * samples read marginally low (about 0.1 dB across 64..8192-sample blocks on a
     * near-Nyquist tone, always under-reading). Use `meteringTruePeakDb` over the
     * whole signal for an exact dBTP number.
     */
    truePeakDbL: number;
    /** Right-channel inter-sample (true) peak in dB. See {@link truePeakDbL}. */
    truePeakDbR: number;
    momentaryLufs: number;
    shortTermLufs: number;
    integratedLufs: number;
    gainReductionDb: number;
    /** Maximum pre-trim input peak for the left channel, in dBFS. */
    inputPeakDbL: number;
    /** Maximum pre-trim input peak for the right channel, in dBFS. */
    inputPeakDbR: number;
}
export interface SonareWorkletSpectrumSnapshot {
    type: 'spectrum';
    frame: number;
    bands: Float32Array;
}
export declare const SONARE_METER_RING_HEADER_INTS = 4;
export declare const SONARE_METER_RING_RECORD_FLOATS = 16;
export declare const SONARE_SPECTRUM_RING_HEADER_INTS = 5;
export declare const SONARE_SCOPE_RING_HEADER_INTS = 6;
export declare const SONARE_SCOPE_RING_RECORD_PREFIX_FLOATS = 5;
/** Scope band and goniometer point counts used when a caller supplies none. */
export declare const SONARE_SCOPE_DEFAULT_BANDS = 48;
export declare const SONARE_SCOPE_DEFAULT_MAX_POINTS = 32;
/** Low 24 bits of a frame index (exact in Float32). */
export declare function encodeFrameLo(frame: number): number;
/** High bits of a frame index above 2^24 (exact in Float32 up to ~2^48). */
export declare function encodeFrameHi(frame: number): number;
/** Reconstruct a frame index from its low/high Float32 lanes. */
export declare function decodeFrame(lo: number, hi: number): number;
export declare const SONARE_ENGINE_RING_HEADER_INTS = 5;
export declare const SONARE_ENGINE_COMMAND_RECORD_BYTES = 32;
export declare const SONARE_ENGINE_TELEMETRY_RECORD_BYTES = 48;
export declare const SONARE_CLIP_PAGE_REQUEST_RING_HEADER_INTS = 5;
export declare const SONARE_CLIP_PAGE_REQUEST_RING_RECORD_UINT32S = 2;
export declare const SONARE_EXTERNAL_MIDI_RING_HEADER_INTS = 5;
export declare const SONARE_EXTERNAL_MIDI_RING_RECORD_UINT32S = 4;
export declare enum SonareEngineCommandType {
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
    SetTrackMonitorMode = 26,
    ResetMasterLoudnessMeter = 28
}
export declare enum SonareEngineTelemetryType {
    ProcessBlock = 0,
    Error = 1
}
export declare enum SonareEngineTelemetryError {
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
    MaxChannelsExceeded = 20,
    ParameterBaseOverflow = 21
}
export interface SonareMeterRingBuffer {
    sharedBuffer: SharedArrayBuffer;
    header: Int32Array;
    records: Float32Array;
    capacity: number;
}
export interface SonareMeterRingReadResult {
    nextReadIndex: number;
    meters: SonareWorkletMeterSnapshot[];
}
export interface SonareSpectrumRingBuffer {
    sharedBuffer: SharedArrayBuffer;
    header: Int32Array;
    records: Float32Array;
    capacity: number;
    bands: number;
}
export interface SonareSpectrumRingReadResult {
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
export interface SonareWorkletScopeSnapshot {
    type: 'scope';
    targetId: number;
    frame: number;
    /** Linear-band magnitudes in dB (length = the configured band count). */
    bands: Float32Array;
    /** Interleaved stereo goniometer points: [l0, r0, l1, r1, ...]. */
    points: Float32Array;
}
export interface SonareScopeRingBuffer {
    sharedBuffer: SharedArrayBuffer;
    header: Int32Array;
    records: Float32Array;
    capacity: number;
    bands: number;
    maxPoints: number;
}
export interface SonareScopeRingReadResult {
    nextReadIndex: number;
    scopes: SonareWorkletScopeSnapshot[];
}
export interface SonareExternalMidiRingEvent {
    destinationId: number;
    renderFrame: number;
    byteWord: number;
    byteCount: number;
}
export interface SonareExternalMidiRingBuffer {
    sharedBuffer: SharedArrayBuffer;
    header: Int32Array;
    records: Uint32Array;
    capacity: number;
}
export interface SharedExternalMidiRingWriter {
    header: Int32Array;
    records: Uint32Array;
    capacity: number;
}
export interface SonareExternalMidiRingReadResult {
    events: SonareExternalMidiRingEvent[];
    dropped: number;
}
export interface SharedScopeRingWriter {
    header: Int32Array;
    records: Float32Array;
    capacity: number;
    bands: number;
    maxPoints: number;
    recordFloats: number;
}
export interface SonareEngineCommandRecord {
    type: SonareEngineCommandType | number;
    targetId?: number;
    sampleTime?: number | bigint;
    argFloat?: number;
    argInt?: number | bigint;
}
export interface SonareEngineTelemetryRecord {
    type: SonareEngineTelemetryType | number;
    error: SonareEngineTelemetryError | number;
    renderFrame: number;
    timelineSample: number;
    audibleTimelineSample: number;
    graphLatencySamplesQ8: number;
    value: number;
}
export interface SonareEngineCommandRingBuffer {
    sharedBuffer: SharedArrayBuffer;
    header: Int32Array;
    view: DataView;
    capacity: number;
}
export interface SonareEngineTelemetryRingBuffer {
    sharedBuffer: SharedArrayBuffer;
    header: Int32Array;
    view: DataView;
    capacity: number;
}
export interface SonareEngineTelemetryRingReadResult {
    nextReadIndex: number;
    telemetry: SonareEngineTelemetryRecord[];
}
export interface SonareClipPageRequest {
    clipId: number;
    pageIndex: number;
}
export interface SonareClipPageRequestRingBuffer {
    sharedBuffer: SharedArrayBuffer;
    header: Int32Array;
    records: Uint32Array;
    capacity: number;
}
export interface SharedClipPageRequestRingWriter {
    header: Int32Array;
    records: Uint32Array;
    capacity: number;
}
export interface SonareClipPageRequestRingReadResult {
    requests: SonareClipPageRequest[];
    /** Cumulative uint32 drop count for native and SAB-ring overflows. */
    dropped: number;
}
export interface SharedMeterRingWriter {
    header: Int32Array;
    records: Float32Array;
    capacity: number;
}
export interface SharedSpectrumRingWriter {
    header: Int32Array;
    records: Float32Array;
    capacity: number;
    bands: number;
    recordFloats: number;
}
/**
 * Shared finite dB floor (`sonare::constants::kFloorDb`). Every level-in-dB
 * field on a worklet snapshot bottoms out here rather than at `-Infinity`.
 */
export declare const SONARE_FLOOR_DB = -120;
/**
 * Magnitude to dB with the shared finite floor.
 *
 * `-Infinity` is not a usable value for a meter reading: it propagates NaN
 * through the usual `(db + 60) / 60 * height` bar geometry, serializes to
 * `null` through `JSON.stringify`, and poisons `Math.min`/`Math.max`
 * aggregation. The native meters have always floored at `kFloorDb`, so a
 * producer emitting `-Infinity` also made the two worklets disagree about
 * silence.
 */
export declare function toDb(value: number): number;
export declare function isRecord(value: unknown): value is Record<string, unknown>;
export declare function sonareMeterRingBufferByteLength(capacity: number): number;
export declare function createSonareMeterRingBuffer(capacity?: number): SonareMeterRingBuffer;
export declare function readSonareMeterRingBuffer(ring: SonareMeterRingBuffer, readIndex?: number): SonareMeterRingReadResult;
export declare function sonareSpectrumRingBufferByteLength(capacity: number, bands?: number): number;
export declare function createSonareSpectrumRingBuffer(capacity?: number, bands?: number): SonareSpectrumRingBuffer;
export declare function readSonareSpectrumRingBuffer(ring: SonareSpectrumRingBuffer, readIndex?: number): SonareSpectrumRingReadResult;
export declare function sonareScopeRingRecordFloats(bands: number, maxPoints: number): number;
export declare function sonareScopeRingBufferByteLength(capacity: number, bands?: number, maxPoints?: number): number;
export declare function createSonareScopeRingBuffer(capacity?: number, bands?: number, maxPoints?: number): SonareScopeRingBuffer;
export declare function readSonareScopeRingBuffer(ring: SonareScopeRingBuffer, readIndex?: number): SonareScopeRingReadResult;
export declare function scopeRingFromSharedBuffer(sharedBuffer: SharedArrayBuffer, fallbackCapacity?: number, fallbackBands?: number, fallbackMaxPoints?: number): SharedScopeRingWriter;
export declare function sonareEngineCommandRingBufferByteLength(capacity: number): number;
export declare function sonareEngineTelemetryRingBufferByteLength(capacity: number): number;
export declare function sonareClipPageRequestRingBufferByteLength(capacity: number): number;
export declare function sonareExternalMidiRingBufferByteLength(capacity: number): number;
export declare function externalMidiRingFromSharedBuffer(sharedBuffer: SharedArrayBuffer, fallbackCapacity?: number): SharedExternalMidiRingWriter;
export declare function createSonareExternalMidiRingBuffer(capacity?: number): SonareExternalMidiRingBuffer;
/** Write one lowered MIDI-1 event without allocations from the audio worklet. */
export declare function pushSonareExternalMidiRingBuffer(ring: SharedExternalMidiRingWriter, destinationId: number, renderFrame: number, byteWord: number, byteCount: number): boolean;
/** Main-thread drain. It is intentionally the only place MIDI byte arrays are built. */
export declare function readSonareExternalMidiRingBuffer(ring: SonareExternalMidiRingBuffer): SonareExternalMidiRingReadResult;
export declare function createSonareClipPageRequestRingBuffer(capacity?: number): SonareClipPageRequestRingBuffer;
/**
 * Writes one request without allocating. Invalid uint32 coordinates and a full
 * ring are counted as drops so the main thread can surface a bounded-loss
 * diagnostic without receiving a worklet postMessage.
 */
export declare function pushSonareClipPageRequestRingBuffer(ring: SharedClipPageRequestRingWriter, clipId: number, pageIndex: number): boolean;
/** Drains the SPSC request ring on the main thread. Object creation is here, never in process(). */
export declare function readSonareClipPageRequestRingBuffer(ring: SonareClipPageRequestRingBuffer): SonareClipPageRequestRingReadResult;
export declare function createSonareEngineCommandRingBuffer(capacity?: number): SonareEngineCommandRingBuffer;
export declare function createSonareEngineTelemetryRingBuffer(capacity?: number): SonareEngineTelemetryRingBuffer;
export declare function pushSonareEngineCommandRingBuffer(ring: SonareEngineCommandRingBuffer, command: SonareEngineCommandRecord): boolean;
export declare function popSonareEngineCommandRingBuffer(ring: SonareEngineCommandRingBuffer): SonareEngineCommandRecord | null;
export declare function writeSonareEngineTelemetryRingBuffer(ring: SonareEngineTelemetryRingBuffer, telemetry: SonareEngineTelemetryRecord): void;
export declare function readSonareEngineTelemetryRingBuffer(ring: SonareEngineTelemetryRingBuffer, readIndex?: number): SonareEngineTelemetryRingReadResult;
export declare function meterRingFromSharedBuffer(sharedBuffer: SharedArrayBuffer, fallbackCapacity?: number): SharedMeterRingWriter;
export declare function spectrumRingFromSharedBuffer(sharedBuffer: SharedArrayBuffer, fallbackCapacity?: number, fallbackBands?: number): SharedSpectrumRingWriter;
export declare function engineRingFromSharedBuffer(sharedBuffer: SharedArrayBuffer, recordBytes: number, fallbackCapacity?: number): {
    header: Int32Array;
    view: DataView;
    capacity: number;
};
export declare function clipPageRequestRingFromSharedBuffer(sharedBuffer: SharedArrayBuffer, fallbackCapacity?: number): SharedClipPageRequestRingWriter;
/**
 * The domain of a uint32 record slot: no fraction, no sign, no overflow.
 *
 * `setUint32` folds anything outside it into a legal value, so a negative id
 * becomes a large one and 2**32 becomes 0. An absent value is out of domain;
 * a slot with a default resolves it before asking.
 */
export declare function isUint32Slot(value: number | undefined): boolean;
/** Store a signed 64-bit safe integer as two 32-bit words without BigInt. */
export declare function writeInt64Words(view: DataView, offset: number, value: number): void;
/** Reconstruct a signed 64-bit safe integer stored by {@link writeInt64Words}. */
export declare function readInt64Words(view: DataView, offset: number): number;
export declare function telemetryFromEngine(telemetry: EngineTelemetry): SonareEngineTelemetryRecord;
export declare function meterFromEngine(meter: EngineMeterTelemetry): SonareWorkletMeterSnapshot;
export declare function magnitudeToDb(value: number): number;
