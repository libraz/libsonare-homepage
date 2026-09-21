/**
 * Resample audio to a different sample rate.
 *
 * @param samples - Audio samples (mono, float32)
 * @param srcSr - Source sample rate in Hz
 * @param targetSr - Target sample rate in Hz
 * @returns Resampled audio
 */
export interface ResampleRequest {
    samples: Float32Array;
    srcSr: number;
    targetSr: number;
}
export declare function resample(request: ResampleRequest): Float32Array;
export declare function resample(samples: Float32Array, srcSr: number, targetSr: number): Float32Array;
