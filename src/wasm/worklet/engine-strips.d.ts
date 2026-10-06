import type { EqBand, PanLawInput, PanMode, RealtimeEngine, UmpWords } from '../index';
import type { SurroundPan } from '../public_types';
import type { InsertParamOverrideMap } from './engine-mixer-facade';
import { type InsertParamOverride, type StripJsonTarget } from './engine-mixer-facade';
import type { SonareEngineInstrumentSyncMessage, SonareEngineSyncMessage } from './messages';
/**
 * Collaborator surface the strip/pan/EQ/insert/instrument/MIDI setters need from
 * the owning {@link SonareEngine}: the offline engine they mirror writes into,
 * the out-of-band sync posters, and the lane-resolution helpers.
 */
export interface EngineStripContext {
    readonly offlineEngine: RealtimeEngine;
    readonly trackLaneIds: number[];
    postSync(message: SonareEngineSyncMessage): void;
    postInstrumentSync(message: SonareEngineInstrumentSyncMessage): void;
    ensureTrackLane(target: string | number): number;
    resolveTargetId(target: string | number): number;
    readStripJson(target: StripJsonTarget): string | undefined;
    writeStripJson(target: StripJsonTarget, sceneJson: string): void;
    readonly insertParamOverrides: InsertParamOverrideMap;
    clearInsertAutomationLanes(target: StripJsonTarget): void;
}
export declare function setTrackStripJson(ctx: EngineStripContext, trackId: number, sceneJson: string, trackStripJson: Map<number, string>): {
    insertBaseResets: StripJsonTarget[];
    constructionOverrides: InsertParamOverride[];
};
export declare function setTrackStripEqBand(ctx: EngineStripContext, target: string | number, bandIndex: number, band: EqBand | string): void;
export declare function setTrackStripInsertBypassed(ctx: EngineStripContext, target: string | number, insertIndex: number, bypassed: boolean, resetOnBypass: boolean): void;
export declare function setTrackStripInsertParamByName(ctx: EngineStripContext, target: string | number, insertIndex: number, paramName: string, value: number): void;
export declare function setTrackStripPan(ctx: EngineStripContext, target: string | number, pan: number): void;
export declare function setTrackStripPanLaw(ctx: EngineStripContext, target: string | number, panLaw: PanLawInput): void;
export declare function setTrackStripPanMode(ctx: EngineStripContext, target: string | number, panMode: PanMode | number): void;
export declare function setTrackStripDualPan(ctx: EngineStripContext, target: string | number, leftPan: number, rightPan: number): void;
export declare function setTrackStripSurroundPan(ctx: EngineStripContext, target: string | number, pan: SurroundPan): void;
export declare function setTrackStripChannelDelaySamples(ctx: EngineStripContext, target: string | number, delaySamples: number): void;
/**
 * Records a master fader or pan value the parameter path applied, so a master
 * strip re-post does not reset it; a track lane keeps these outside its strip.
 */
export declare function cacheMasterStripScalar(ctx: EngineStripContext, field: 'faderDb' | 'pan', value: number): void;
export declare function setMasterStripEqBand(ctx: EngineStripContext, bandIndex: number, band: EqBand | string): void;
export declare function setMasterStripInsertBypassed(ctx: EngineStripContext, insertIndex: number, bypassed: boolean, resetOnBypass: boolean): void;
export declare function setMasterStripInsertParamByName(ctx: EngineStripContext, insertIndex: number, paramName: string, value: number): void;
export declare function setBusStripInsertParamByName(ctx: EngineStripContext, busId: number, insertIndex: number, paramName: string, value: number): void;
export declare function setBusStripInsertBypassed(ctx: EngineStripContext, busId: number, insertIndex: number, bypassed: boolean, resetOnBypass: boolean): void;
export declare function setBusStripEqBand(ctx: EngineStripContext, busId: number, bandIndex: number, band: EqBand | string): void;
export declare function setBusStripPan(ctx: EngineStripContext, busId: number, pan: number): void;
export declare function setBusStripPanLaw(ctx: EngineStripContext, busId: number, panLaw: PanLawInput): void;
export declare function setBusStripPanMode(ctx: EngineStripContext, busId: number, panMode: PanMode | number): void;
export declare function setBusStripDualPan(ctx: EngineStripContext, busId: number, leftPan: number, rightPan: number): void;
export declare function pushMidiNoteOn(ctx: EngineStripContext, trackId: string | number, group: number, channel: number, note: number, velocity: number, renderFrame: number): void;
export declare function pushMidiNoteOff(ctx: EngineStripContext, trackId: string | number, group: number, channel: number, note: number, velocity: number, renderFrame: number): void;
export declare function pushMidiCc(ctx: EngineStripContext, trackId: string | number, group: number, channel: number, controller: number, value: number, renderFrame: number): void;
export declare function pushMidiPitchBend(ctx: EngineStripContext, trackId: string | number, group: number, channel: number, bend14: number, renderFrame: number): void;
export declare function pushMidiChannelPressure(ctx: EngineStripContext, trackId: string | number, group: number, channel: number, pressure: number, renderFrame: number): void;
export declare function pushMidiPolyPressure(ctx: EngineStripContext, trackId: string | number, group: number, channel: number, note: number, pressure: number, renderFrame: number): void;
export declare function pushMidiUmp(ctx: EngineStripContext, trackId: string | number, word0: number | UmpWords, renderFrame: number): void;
export declare function setBuiltinInstrument(ctx: EngineStripContext, trackId: string | number, config: {
    destinationId?: number;
} & Record<string, unknown>): void;
export declare function setSynthInstrument(ctx: EngineStripContext, trackId: string | number, patch: Record<string, unknown> | string): void;
export declare function loadSoundFont(ctx: EngineStripContext, data: Uint8Array): void;
export declare function setSf2Instrument(ctx: EngineStripContext, trackId: string | number, config: {
    destinationId?: number;
    gain?: number;
    polyphony?: number;
    preferModelForModeledFamilies?: boolean;
    clearBankRig?: boolean;
    gsEfxRealization?: 'modern' | 'classic';
}): void;
export declare function setMidiDestinationExternal(ctx: EngineStripContext, trackId: string | number, external: boolean): void;
export declare function setExternalMidiClockEnabled(ctx: EngineStripContext, enabled: boolean): void;
export declare function setMidiFx(ctx: EngineStripContext, trackId: string | number, configJson: string): void;
export declare function clearMidiFx(ctx: EngineStripContext, trackId: string | number): void;
export declare function pushMidiSysex(ctx: EngineStripContext, trackId: string | number, data: Uint8Array, renderFrame: number): void;
export declare function pushMidiPanic(ctx: EngineStripContext, renderFrame: number): void;
