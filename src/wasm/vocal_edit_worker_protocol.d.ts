import type { VocalAnalysis, VocalApplyRequest, VocalCapabilities, VocalCreateRequest, VocalEditResult, VocalHistoryState, VocalNotesResult, VocalPitchEvaluation, VocalRenderRequest, VocalRenderResult, VocalRestoreRequest, VocalStateBytes, VocalStateToken, VocalUint64 } from './public_types_vocal_edit.js';
export type VocalWorkerMutation = {
    kind: 'beginEdit';
    expectedRevision?: VocalUint64;
} | {
    kind: 'apply';
    request: VocalApplyRequest;
} | {
    kind: 'commit';
    expectedRevision: VocalUint64;
} | {
    kind: 'cancel';
} | {
    kind: 'undo';
    expectedRevision?: VocalUint64;
} | {
    kind: 'redo';
    expectedRevision?: VocalUint64;
} | {
    kind: 'notes';
} | {
    kind: 'analysis';
} | {
    kind: 'capabilities';
} | {
    kind: 'exportState';
} | {
    kind: 'outputLength';
} | {
    kind: 'history';
} | {
    kind: 'draftToken';
} | {
    kind: 'evaluatePitch';
    noteId: number;
    draft?: boolean;
} | {
    kind: 'mapCoordinate';
    noteId: number;
    sample: number;
    /** `false` maps source to destination; `true` maps destination to source. */
    inverse: boolean;
    draft?: boolean;
};
export type VocalWorkerCreateRequest = {
    kind: 'create';
    request: VocalCreateRequest;
} | {
    kind: 'restore';
    request: VocalRestoreRequest;
};
export interface VocalWorkerCreateMessage {
    type: 'sonare:vocal-create';
    id: number;
    sessionId: string;
    clientIntentSequence: VocalUint64;
    request: VocalWorkerCreateRequest;
    cancelBuffer?: SharedArrayBuffer;
}
export interface VocalWorkerMutateMessage {
    type: 'sonare:vocal-mutate';
    id: number;
    sessionId: string;
    clientIntentSequence: VocalUint64;
    baseToken?: VocalStateToken;
    mutation: VocalWorkerMutation;
    cancelBuffer?: SharedArrayBuffer;
}
export interface VocalWorkerPreviewMessage {
    type: 'sonare:vocal-preview';
    id: number;
    sessionId: string;
    clientIntentSequence: VocalUint64;
    baseToken?: VocalStateToken;
    request: VocalRenderRequest;
    cancelBuffer?: SharedArrayBuffer;
}
export interface VocalWorkerDisposeMessage {
    type: 'sonare:vocal-dispose';
    id: number;
    sessionId: string;
    clientIntentSequence: VocalUint64;
}
export interface VocalWorkerCancelMessage {
    type: 'sonare:vocal-cancel';
    id: number;
    sessionId: string;
    clientIntentSequence: VocalUint64;
}
export type VocalWorkerRequestMessage = VocalWorkerCreateMessage | VocalWorkerMutateMessage | VocalWorkerPreviewMessage | VocalWorkerDisposeMessage | VocalWorkerCancelMessage;
export interface VocalWorkerCreateResult {
    sessionId: string;
    token: VocalStateToken;
    notes: VocalNotesResult;
    analysis: VocalAnalysis;
    capabilities: VocalCapabilities;
}
export interface VocalWorkerResponseBase {
    id: number;
    sessionId: string;
    clientIntentSequence: VocalUint64;
    token?: VocalStateToken;
}
export type VocalWorkerResult = VocalWorkerCreateResult | VocalEditResult | VocalNotesResult | VocalAnalysis | VocalCapabilities | VocalStateBytes | VocalRenderResult | VocalStateToken | VocalHistoryState | VocalPitchEvaluation | number | null;
export interface VocalWorkerResultMessage extends VocalWorkerResponseBase {
    type: 'sonare:vocal-result';
    result: VocalWorkerResult;
}
export interface VocalWorkerProgressMessage extends VocalWorkerResponseBase {
    type: 'sonare:vocal-progress';
    complete: boolean;
}
export interface VocalWorkerErrorMessage extends VocalWorkerResponseBase {
    type: 'sonare:vocal-error';
    error: {
        name: string;
        message: string;
        code?: number;
        codeName?: string;
        reason?: number;
        field?: string;
        expected?: VocalUint64;
        actual?: VocalUint64;
        expectedText?: string;
        actualText?: string;
    };
}
export type VocalWorkerResponseMessage = VocalWorkerResultMessage | VocalWorkerProgressMessage | VocalWorkerErrorMessage;
export declare function tokenEquals(a: VocalStateToken | undefined, b: VocalStateToken | undefined): boolean;
/** Compare the mutable session state portion of a token.
 *
 * Render results add request/profile metadata to the state token. That
 * metadata identifies the render artifact, so it must not make a snapshot's
 * state appear different from the session state used to create it.
 */
export declare function stateTokenEquals(a: VocalStateToken | undefined, b: VocalStateToken | undefined): boolean;
/** Decimal sequence comparison without converting a uint64 to Number. */
export declare function compareUint64(a: VocalUint64, b: VocalUint64): number;
