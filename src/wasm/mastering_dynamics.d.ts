import type { ValidateOptions } from './validation';
/** Compressor sidechain detector mode. */
export type CompressorDetector = 'peak' | 'rms' | 'log_rms';
/** Options for `masteringDynamicsCompressor`. */
export interface CompressorOptions extends ValidateOptions {
    thresholdDb?: number;
    ratio?: number;
    attackMs?: number;
    releaseMs?: number;
    kneeDb?: number;
    makeupGainDb?: number;
    autoMakeup?: boolean;
    detector?: CompressorDetector | number;
    sidechainHpfEnabled?: boolean;
    sidechainHpfHz?: number;
    pdrTimeMs?: number;
    pdrReleaseScale?: number;
}
/** Canonical request form for the offline compressor. */
export interface MasteringDynamicsCompressorRequest extends CompressorOptions {
    samples: Float32Array;
    sampleRate: number;
}
/** Options for `masteringDynamicsGate`. */
export interface GateOptions extends ValidateOptions {
    thresholdDb?: number;
    attackMs?: number;
    releaseMs?: number;
    rangeDb?: number;
    holdMs?: number;
    closeThresholdDb?: number;
    keyHpfHz?: number;
}
/** Canonical request form for the offline gate. */
export interface MasteringDynamicsGateRequest extends GateOptions {
    samples: Float32Array;
    sampleRate: number;
}
/** Options for `masteringDynamicsTransientShaper`. */
export interface TransientShaperOptions extends ValidateOptions {
    attackGainDb?: number;
    sustainGainDb?: number;
    fastAttackMs?: number;
    fastReleaseMs?: number;
    slowAttackMs?: number;
    slowReleaseMs?: number;
    sensitivity?: number;
    maxGainDb?: number;
    gainSmoothingMs?: number;
    lookaheadMs?: number;
}
/** Canonical request form for the offline transient shaper. */
export interface MasteringDynamicsTransientShaperRequest extends TransientShaperOptions {
    samples: Float32Array;
    sampleRate: number;
}
/**
 * Result envelope returned by offline mastering dynamics processors.
 *
 * Named for what it is rather than for the module it lives in. {@link
 * DynamicsResult} is the *analysis* shape on every binding, so having that one
 * identifier mean two disjoint field lists across the Node and WASM packages
 * made a shared TypeScript module type-check against one and fail against the
 * other — with the identifier resolving either way, so only the member list
 * gave it away.
 */
export interface DynamicsProcessorResult {
    samples: Float32Array;
    latencySamples: number;
}
/** Offline feed-forward compressor (soft knee, optional auto-makeup / sidechain HPF). */
export declare function masteringDynamicsCompressor(request: MasteringDynamicsCompressorRequest): DynamicsProcessorResult;
export declare function masteringDynamicsCompressor(samples: Float32Array, sampleRate: number, options?: CompressorOptions): DynamicsProcessorResult;
/** Offline noise gate (hysteresis, hold, optional key HPF). */
export declare function masteringDynamicsGate(request: MasteringDynamicsGateRequest): DynamicsProcessorResult;
export declare function masteringDynamicsGate(samples: Float32Array, sampleRate: number, options?: GateOptions): DynamicsProcessorResult;
/** Offline transient shaper (envelope-difference attack/sustain control). */
export declare function masteringDynamicsTransientShaper(request: MasteringDynamicsTransientShaperRequest): DynamicsProcessorResult;
export declare function masteringDynamicsTransientShaper(samples: Float32Array, sampleRate: number, options?: TransientShaperOptions): DynamicsProcessorResult;
