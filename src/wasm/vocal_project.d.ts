import type { ProjectVocalEditApplyRequest, ProjectVocalEditApplyResult, ProjectVocalEditDependency, ProjectVocalOriginalSource, ProjectVocalRehydrateItem } from './public_types_vocal_project';
/** The embind Project object is deliberately structural here. */
export interface VocalProjectNative {
    applyVocalEdit: (request: unknown) => unknown;
    getVocalEditDependencies: () => unknown;
    rehydrateVocalEdits: (originals: unknown, cancel?: unknown) => unknown;
}
/** Apply a complete committed vocal render to a native Project object. */
export declare function projectApplyVocalEdit(native: VocalProjectNative, request: ProjectVocalEditApplyRequest): ProjectVocalEditApplyResult;
/** Return copied vocal sidecar dependencies in native storage order. */
export declare function projectGetVocalEditDependencies(native: VocalProjectNative): ProjectVocalEditDependency[];
/**
 * Rehydrate unresolved vocal PCM without creating a Project history entry.
 * Any truthy return from `cancel` cancels the call.
 */
export declare function projectRehydrateVocalEdits(native: VocalProjectNative, originals: readonly ProjectVocalOriginalSource[], cancel?: () => boolean): ProjectVocalRehydrateItem[];
