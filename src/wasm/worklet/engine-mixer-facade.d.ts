import type { EngineBus, EngineTrackLane, EngineTrackSend, RealtimeEngine, SidechainSourceKind } from '../index';
import type { SonareEngineSyncMessage } from './messages';
/** A latest by-name insert value retained across a later topology replay. */
export interface InsertParamOverride {
    target: StripJsonTarget;
    insertIndex: number;
    paramName: string;
    value: number;
}
export type InsertParamOverrideMap = Map<string, InsertParamOverride>;
/**
 * Collaborator surface the mixer/routing setters need from the owning
 * {@link SonareEngine}: the offline engine they mirror writes into, the mutable
 * routing stores (held by reference), the out-of-band sync poster, and the
 * lane/bus declaration and mixer-sync helpers.
 */
export interface EngineMixerContext {
    readonly offlineEngine: RealtimeEngine;
    readonly trackLaneIds: number[];
    readonly trackSends: Map<number, EngineTrackSend[]>;
    readonly trackOutputBus: Map<number, number>;
    readonly trackSourceChannelLayout: Map<number, number>;
    readonly laneSidechains: Map<string, {
        trackId: number;
        insertIndex: number;
        sourceTrackId: number;
    }>;
    readonly busSidechains: Map<string, {
        busId: number;
        insertIndex: number;
        sourceKind: number;
        sourceId: number;
    }>;
    readonly masterSidechains: Map<number, {
        insertIndex: number;
        sourceKind: number;
        sourceId: number;
    }>;
    readonly buses: EngineBus[];
    readonly trackStripJson: Map<number, string>;
    readonly busStripJson: Map<number, string>;
    readonly insertParamOverrides: InsertParamOverrideMap;
    clearInsertAutomationLanes(target: StripJsonTarget, forgetResolvedIds?: boolean): void;
    flushOfflineMirror(): void;
    postSync(message: SonareEngineSyncMessage): void;
    ensureTrackLane(target: string | number): number;
    ensureBus(busId: number): number;
    mixerLanes(): EngineTrackLane[];
    syncMixer(insertBaseResets?: StripJsonTarget[], oneShotInsertParamOverrides?: InsertParamOverride[]): void;
    sendSmoothedParam(paramId: number, value: number): boolean;
    getMasterStripJson(): string | undefined;
    cacheMasterStripJson(sceneJson: string): void;
}
/** Addresses one strip's cached scene JSON, the state a syncMixer re-post replays. */
export type StripJsonTarget = {
    kind: 'track';
    trackId: number;
} | {
    kind: 'bus';
    busId: number;
} | {
    kind: 'master';
};
/**
 * Returns the insert identity used to decide whether native state can stay
 * alive across a strip-scene update. Scalar strip fields are intentionally
 * excluded. Track and master inserts use the native pre-then-post indexing;
 * buses retain their scene order.
 */
export declare function decodedInsertSignature(sceneJson: string, target: StripJsonTarget): string;
/** Builds one-shot restores for manual insert edits before their bookkeeping is forgotten. */
export declare function constructionInsertOverrides(engine: RealtimeEngine, target: StripJsonTarget, overrides: InsertParamOverrideMap): InsertParamOverride[];
/** Applies construction restores to the control-side mirror before posting them. */
export declare function applyConstructionInsertOverrides(engine: RealtimeEngine, overrides: readonly InsertParamOverride[]): void;
/** Clears the native manual parameter bases for one strip after a replacement. */
export declare function clearInsertParameterBases(engine: RealtimeEngine, target: StripJsonTarget): void;
/** An empty construction scene used only within an explicit strip replacement. */
export declare function emptyStripJson(target: StripJsonTarget): string;
/** Drop bindings whose insert was removed by an explicit scene replacement. */
export declare function pruneStripSidechains(ctx: EngineMixerContext, target: StripJsonTarget, sceneJson: string): void;
export declare function hasInsertParamOverrides(overrides: InsertParamOverrideMap, target: StripJsonTarget): boolean;
/** Apply and validate one candidate scene without rebuilding it through an empty scene. */
export declare function applyFullStripJson(engine: RealtimeEngine, target: StripJsonTarget, sceneJson: string): void;
/** Builds a collision-safe key for one target/insert/parameter tuple. */
export declare function insertParamOverrideKey(override: InsertParamOverride): string;
/** Removes all retained insert values for one strip after a full scene replacement. */
export declare function clearInsertParamOverrides(overrides: InsertParamOverrideMap, target: StripJsonTarget): void;
/** Reads a strip's cached scene JSON; undefined when none was ever set. */
export declare function cachedStripJson(ctx: EngineMixerContext, target: StripJsonTarget): string | undefined;
/** Replaces a strip's cached scene JSON without syncing it. */
export declare function cacheStripJson(ctx: EngineMixerContext, target: StripJsonTarget, sceneJson: string): void;
/** Builds the engine's track-lane descriptors from the current routing stores. */
export declare function mixerLanes(ctx: EngineMixerContext): EngineTrackLane[];
/**
 * Mirrors the current mixer routing into the offline engine and posts the full
 * mixer-sync message (lanes, buses, strip JSON, sidechains) to the worklet.
 */
export declare function syncMixer(ctx: EngineMixerContext, busesAlreadyApplied?: boolean, insertBaseResets?: StripJsonTarget[], oneShotInsertParamOverrides?: InsertParamOverride[]): void;
/**
 * Reapplies retained by-name values after native topology setters clear their
 * smoother slots. This runs once per mixer sync, never once per knob tick.
 */
export declare function replayInsertParamOverrides(ctx: EngineMixerContext, lanes?: EngineTrackLane[], buses?: EngineBus[]): void;
/**
 * Declares the mixer track lanes in an explicit order.
 *
 * Lane indices are append-only: once a track id occupies a lane, its index
 * stays fixed for the engine's lifetime. The given list must therefore start
 * with the already-declared lane ids in their current order and may only
 * append new track ids after them. Entries carrying `sends` replace that
 * track's send list; entries without `sends` leave existing sends untouched.
 * The same omission rule preserves an existing source channel layout.
 *
 * @param lanes Track ids or lane descriptors in the desired lane order.
 */
export declare function setTrackLanes(ctx: EngineMixerContext, lanes: ReadonlyArray<number | EngineTrackLane>): void;
/** Ensures a lane exists, committing it only after native routing accepts it. */
export declare function ensureTrackLane(ctx: EngineMixerContext, target: string | number): number;
/**
 * Routes a track lane's post-fader output into a declared bus instead of
 * the master mix (group/folder routing); busId 0 restores the master mix.
 */
export declare function setTrackOutputBus(ctx: EngineMixerContext, target: string | number, busId: number): void;
/**
 * Keys one insert of a lane strip from another lane's post-strip pre-fader
 * audio (ducking/sidechainRouter inserts). sourceTarget null removes the
 * binding.
 */
export declare function setLaneSidechain(ctx: EngineMixerContext, target: string | number, insertIndex: number, sourceTarget: string | number | null): void;
/**
 * Keys one insert of a bus strip from a track lane or another bus
 * (ducking/sidechainRouter inserts). `sourceId` 0 removes the binding. The
 * binding is cached for resync only once the engine has accepted it.
 */
export declare function setBusSidechain(ctx: EngineMixerContext, busId: number, insertIndex: number, kind: SidechainSourceKind | number, sourceId: number): void;
/**
 * Keys one insert of the master strip from a track lane or a bus. Same source
 * rules as {@link setBusSidechain}.
 */
export declare function setMasterSidechain(ctx: EngineMixerContext, insertIndex: number, kind: SidechainSourceKind | number, sourceId: number): void;
export declare function setSends(ctx: EngineMixerContext, target: string | number, sends: EngineTrackSend[]): void;
export declare function setTrackBuses(ctx: EngineMixerContext, buses: EngineBus[]): void;
export declare function setBusGain(ctx: EngineMixerContext, busId: number, db: number): boolean;
/** Control-side state a strip-scene replacement reads and updates. */
export interface StripSceneContext {
    readonly offlineEngine: RealtimeEngine;
    readonly insertParamOverrides: InsertParamOverrideMap;
    clearInsertAutomationLanes(target: StripJsonTarget): void;
}
/**
 * Applies a strip scene to the offline mirror and returns what the realtime
 * sync must repeat: the targets whose manual insert bases it clears and the
 * construction values it restores. A changed insert chain forgets manual edits;
 * an equal chain with manual edits restores each edited parameter's
 * construction value. Native state of equal inserts is kept either way.
 */
export declare function replaceStripScene(ctx: StripSceneContext, target: StripJsonTarget, previousJson: string | undefined, sceneJson: string): {
    insertBaseResets: StripJsonTarget[];
    constructionOverrides: InsertParamOverride[];
};
export declare function setBusStripJson(ctx: EngineMixerContext, busId: number, sceneJson: string): void;
/** Applies a master strip scene while retaining native state for equal inserts. */
export declare function setMasterStripJson(ctx: EngineMixerContext, sceneJson: string): void;
