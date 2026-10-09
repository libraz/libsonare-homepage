import './lifetime.js';
import type { VocalAnalysis, VocalCapabilities, VocalCreateRequest, VocalEditOperation, VocalEditResult, VocalHistoryState, VocalNotesResult, VocalPitchEvaluation, VocalRestoreRequest, VocalStateBytes, VocalStateToken } from './public_types_vocal_edit.js';
import { type VocalRenderSnapshot } from './vocal_edit.js';
import { type VocalWorkerRequestMessage, type VocalWorkerResponseMessage } from './vocal_edit_worker_protocol.js';
export interface VocalEditWorkerEndpoint {
    postMessage(message: VocalWorkerResponseMessage, transfer?: Transferable[]): void;
    addEventListener(type: 'message', listener: (event: MessageEvent<VocalWorkerRequestMessage>) => void): void;
}
export interface VocalEditWorkerNativeDraft {
    token(): VocalStateToken;
    notes(): VocalNotesResult;
    apply(request: {
        expectedGeneration: string;
        operations: readonly VocalEditOperation[];
    }): VocalEditResult;
    commit(expectedRevision: string): VocalEditResult;
    cancel(): void;
    evaluatePitch(noteId: number): VocalPitchEvaluation;
    sourceSampleToDestinationSample(noteId: number, sourceSample: number): number;
    destinationSampleToSourceSample(noteId: number, destinationSample: number): number;
    captureRenderSnapshot(): VocalRenderSnapshot;
    exportState?(): VocalStateBytes;
    dispose(): void;
}
export interface VocalEditWorkerNativeSession {
    token(): VocalStateToken;
    notes(): VocalNotesResult;
    analysis(): VocalAnalysis;
    capabilities(): VocalCapabilities;
    beginEdit(expectedRevision?: string): VocalEditWorkerNativeDraft;
    undo(expectedRevision?: string): VocalEditResult;
    redo(expectedRevision?: string): VocalEditResult;
    outputLengthSamples(): number;
    history(): VocalHistoryState;
    evaluatePitch(noteId: number): VocalPitchEvaluation;
    sourceSampleToDestinationSample(noteId: number, sourceSample: number): number;
    destinationSampleToSourceSample(noteId: number, destinationSample: number): number;
    captureRenderSnapshot(): VocalRenderSnapshot;
    exportState(): Uint8Array;
    dispose(): void;
}
export interface VocalEditWorkerFactory {
    create(request: VocalCreateRequest): VocalEditWorkerNativeSession;
    restore(request: VocalRestoreRequest): VocalEditWorkerNativeSession;
}
export interface VocalEditWorkerDependencies {
    factory?: VocalEditWorkerFactory;
    initialize?: () => Promise<void>;
}
/** Install the dedicated vocal-edit protocol on a browser or Node endpoint. */
export declare function installVocalEditWorkerEndpoint(endpoint: VocalEditWorkerEndpoint, dependencies?: VocalEditWorkerDependencies): void;
