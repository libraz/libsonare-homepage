import type { VocalAnalysis, VocalApplyRequest, VocalCapabilities, VocalCreateRequest, VocalEditOperation, VocalEditResult, VocalErrorShape, VocalHistoryState, VocalJobProgress, VocalNotesResult, VocalPitchEvaluation, VocalRenderRequest, VocalRenderResult, VocalRestoreRequest, VocalStateToken, VocalUint64 } from './public_types_vocal_edit';
/** Native symbols registered by the full vocal-edit WASM binding. */
export interface VocalWasmExports {
    vocalEditApiVersion: () => number;
    vocalEditAvailable: () => number;
    vocalEditSessionCreate: (samples: Float32Array, sampleRate: number, options: unknown) => number;
    vocalEditSessionRestore: (samples: Float32Array, sampleRate: number, state: Uint8Array, options: unknown) => number;
    vocalEditSessionDestroy: (handle: number) => void;
    vocalEditSessionNotes: (handle: number) => VocalNotesResult;
    vocalEditDraftNotes: (handle: number) => VocalNotesResult;
    vocalEditSessionToken: (handle: number) => VocalStateToken;
    vocalEditDraftToken: (handle: number) => VocalStateToken;
    vocalEditSessionAnalysis: (handle: number) => VocalAnalysis;
    vocalEditSessionCapabilities: (handle: number) => VocalCapabilities;
    vocalEditSessionOutputLength: (handle: number) => number;
    vocalEditSessionHistory: (handle: number) => VocalHistoryState;
    vocalEditSessionBeginEdit: (handle: number, revision: VocalUint64) => number;
    vocalEditDraftApply: (handle: number, generation: VocalUint64, operations: readonly VocalEditOperation[]) => VocalEditResult;
    vocalEditDraftCommit: (handle: number, revision: VocalUint64) => VocalEditResult;
    vocalEditDraftCancel: (handle: number) => void;
    vocalEditDraftDestroy: (handle: number) => void;
    vocalEditSessionApplyHistory: (handle: number, revision: VocalUint64, redo: boolean) => VocalEditResult;
    vocalEditEvaluatePitch: (handle: number, noteId: number, draft: boolean) => VocalPitchEvaluation;
    vocalEditMapCoordinate: (handle: number, noteId: number, sample: number, draft: boolean, inverse: boolean) => number;
    vocalEditCaptureSnapshot: (handle: number, draft: boolean) => number;
    vocalEditSnapshotDestroy: (handle: number) => void;
    vocalEditSnapshotOutputLength: (handle: number) => number;
    vocalEditSnapshotRender: (handle: number, startSample: number, endSample: number, requestId: VocalUint64) => VocalRenderResult;
    vocalEditRenderJobBegin: (handle: number, startSample: number, endSample: number, requestId: VocalUint64) => number;
    vocalEditRenderJobNext: (handle: number) => boolean;
    vocalEditRenderJobFinalize: (handle: number) => VocalRenderResult;
    vocalEditRenderJobAbort: (handle: number) => void;
    vocalEditRenderJobDestroy: (handle: number) => void;
    vocalEditSessionExportState: (handle: number) => Uint8Array;
    vocalEditLastErrorDetail: () => VocalErrorShape & {
        readonly sequence: VocalUint64;
    };
}
type RevisionArgument = VocalUint64 | {
    expectedRevision?: VocalUint64;
};
/** Whether this build has the C vocal-edit surface linked. */
export declare function vocalEditAvailable(): boolean;
/** Version of the C vocal-edit ABI exposed by the loaded WASM module. */
export declare function vocalEditApiVersion(): number;
/** Analyse mono PCM, or adopt a host analysis, and open an editing session. */
export declare function createVocalEditSession(request: VocalCreateRequest): VocalEditSession;
/** Open a new session from an exported state blob and the same source PCM. */
export declare function restoreVocalEditSession(request: VocalRestoreRequest): VocalEditSession;
/** A vocal editing session. Disposing it also disposes every live draft it began. */
export declare class VocalEditSession {
    private handle;
    private readonly drafts;
    private disposed;
    /** @internal Instances are created by {@link createVocalEditSession} and {@link restoreVocalEditSession}. */
    constructor(handle: number);
    dispose(): void;
    delete(): void;
    destroy(): void;
    private native;
    token(): VocalStateToken;
    revision(): VocalUint64;
    notes(): VocalNotesResult;
    analysis(): VocalAnalysis;
    capabilities(): VocalCapabilities;
    outputLengthSamples(): number;
    history(): VocalHistoryState;
    beginEdit(options?: RevisionArgument): VocalEditDraft;
    undo(options?: RevisionArgument): VocalEditResult;
    redo(options?: RevisionArgument): VocalEditResult;
    evaluatePitch(noteId: number): VocalPitchEvaluation;
    sourceSampleToDestinationSample(noteId: number, sourceSample: number): number;
    destinationSampleToSourceSample(noteId: number, destinationSample: number): number;
    captureRenderSnapshot(): VocalRenderSnapshot;
    exportState(): Uint8Array;
    /** @internal Used by the draft to remove itself from the owner set. */
    _forgetDraft(draft: VocalEditDraft): void;
}
export declare class VocalEditDraft {
    private handle;
    private disposed;
    private readonly owner;
    /** @internal Instances are created by {@link VocalEditSession.beginEdit}. */
    constructor(handle: number, owner: VocalEditSession);
    private native;
    token(): VocalStateToken;
    notes(): VocalNotesResult;
    apply(request: VocalApplyRequest): VocalEditResult;
    commit(options?: RevisionArgument): VocalEditResult;
    cancel(): void;
    evaluatePitch(noteId: number): VocalPitchEvaluation;
    sourceSampleToDestinationSample(noteId: number, sourceSample: number): number;
    destinationSampleToSourceSample(noteId: number, destinationSample: number): number;
    captureRenderSnapshot(): VocalRenderSnapshot;
    dispose(): void;
    delete(): void;
    destroy(): void;
}
export declare class VocalRenderSnapshot {
    private handle;
    private disposed;
    /** @internal Instances are created by a session or draft. */
    constructor(handle: number);
    private native;
    outputLengthSamples(): number;
    render(request: VocalRenderRequest): VocalRenderResult;
    beginRenderJob(request: VocalRenderRequest): VocalRenderJob;
    /**
     * Render one native work unit per macrotask so `request.signal` can stop the
     * job between units. A cancelled job publishes no partial PCM.
     */
    renderAsync(request: VocalRenderRequest): Promise<VocalRenderResult>;
    dispose(): void;
    delete(): void;
    destroy(): void;
}
export declare class VocalRenderJob {
    private handle;
    private disposed;
    /** @internal Instances are created by {@link VocalRenderSnapshot.beginRenderJob}. */
    constructor(handle: number);
    private native;
    next(): VocalJobProgress;
    finalize(): VocalRenderResult;
    abort(): void;
    dispose(): void;
    delete(): void;
    destroy(): void;
}
export type { VocalAnalysis, VocalCapabilities, VocalCreateRequest, VocalEditResult, VocalHistory, } from './public_types_vocal_edit';
