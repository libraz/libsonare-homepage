import type { SonareEngineCaptureRequestMessage, SonareEngineCaptureResponseMessageInternal, SonareEngineClipPageRequestMessage, SonareEngineInsertGainReductionRequestMessage, SonareEngineInsertGainReductionResponseMessage, SonareEngineSyncMessage, SonareEngineTransportRequestMessage, SonareEngineTransportResponseMessage, SonarePlaybackMessage, SonareRealtimeVoiceChangerMessage, SonareWorkletExternalMidiMessage, SonareWorkletMessage } from './messages';
import { type SonareEngineCommandRecord, type SonareEngineTelemetryRecord, type SonareWorkletMeterSnapshot, type SonareWorkletScopeSnapshot } from './protocol';
export declare function isWorkletMessage(value: unknown): value is SonareWorkletMessage;
export declare function isEngineCommandRecord(value: unknown): value is SonareEngineCommandRecord;
/**
 * Every discriminant the worklet accepts on the control plane, derived from the
 * `SonareEngineSyncMessage` union rather than restated as literals.
 *
 * The `Record<SonareEngineSyncMessage['type'], true>` annotation rejects a
 * missing key and the object literal's excess-property check rejects a stale
 * one, so a union member that never reaches this table is a compile error
 * instead of a message the port drops in silence.
 */
export declare const ENGINE_SYNC_MESSAGE_TYPES: Record<SonareEngineSyncMessage['type'], true>;
export declare function isEngineSyncMessage(value: unknown): value is SonareEngineSyncMessage;
export declare function isEngineCaptureRequestMessage(value: unknown): value is SonareEngineCaptureRequestMessage;
/** Return a request ID even when the response payload itself is malformed. */
export declare function engineCaptureResponseRequestId(value: unknown): number | undefined;
export declare function isEngineCaptureResponseMessage(value: unknown): value is SonareEngineCaptureResponseMessageInternal;
/**
 * Check that a strict success response belongs to the requested operation.
 * Failure responses are operation-independent and are therefore valid for
 * every pending request (the node rejects them after this check).
 */
export declare function isEngineCaptureResponseForOperation(response: SonareEngineCaptureResponseMessageInternal, op: SonareEngineCaptureRequestMessage['op']): boolean;
export declare function isEngineTransportRequestMessage(value: unknown): value is SonareEngineTransportRequestMessage;
export declare function isEngineTransportResponseMessage(value: unknown): value is SonareEngineTransportResponseMessage;
export declare function isEngineInsertGainReductionRequestMessage(value: unknown): value is SonareEngineInsertGainReductionRequestMessage;
export declare function isEngineInsertGainReductionResponseMessage(value: unknown): value is SonareEngineInsertGainReductionResponseMessage;
export declare function isRealtimeVoiceChangerMessage(value: unknown): value is SonareRealtimeVoiceChangerMessage;
export declare function isPlaybackMessage(value: unknown): value is SonarePlaybackMessage;
export declare function isEngineTelemetryRecord(value: unknown): value is SonareEngineTelemetryRecord;
export declare function isExternalMidiBatchMessage(value: unknown): value is SonareWorkletExternalMidiMessage;
export declare function isClipPageRequestMessage(value: unknown): value is SonareEngineClipPageRequestMessage;
export declare function isMeterSnapshot(value: unknown): value is SonareWorkletMeterSnapshot;
export declare const SONARE_SCOPE_MAX_BANDS = 64;
export declare const SONARE_SCOPE_MAX_POINTS = 32;
/** Validates the bounded postMessage representation of a scope snapshot. */
export declare function isScopeSnapshot(value: unknown): value is SonareWorkletScopeSnapshot;
/**
 * Resolves an integer option, refusing anything the field's own domain cannot
 * hold instead of rounding it into range.
 *
 * Rounding hands the caller a working object configured with a value they never
 * asked for, and nothing downstream can tell that apart from the value they
 * meant. A ceiling, where one exists, stays with the layer that owns it.
 */
export declare function requireIntegerOption(value: number | undefined, fallback: number, name: string, minimum: number): number;
/** Resolves scope bands and applies the native tap's fixed 64-band ceiling. */
export declare function resolveScopeBandCount(value: number | undefined, fallback?: number): number;
/** As {@link requireIntegerOption}, for a field whose domain admits either sign. */
export declare function requireInteger(value: number | undefined, fallback: number, name: string): number;
/** Resolves the channel count every worklet entry point accepts on its options. */
export declare function requireChannelCount(channelCount: number | undefined, fallback: number): number;
