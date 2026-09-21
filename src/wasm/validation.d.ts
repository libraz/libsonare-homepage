/**
 * Per-call validation options accepted by guarded wrappers. Empty-buffer
 * checks are always performed; pass `{ validate: false }` to opt out of the
 * O(n) NaN/Inf scan on hot paths.
 *
 * `{ validate: false }` only skips this JS-side pre-scan (which raises a
 * `RangeError` naming the exact offending index). It is NOT a way to push
 * non-finite samples into the core: the native layer always re-validates the
 * buffer — through `validate_offline_audio_input` for the offline-analysis
 * entry points, and through the computation's own per-sample guard where a call
 * takes no sample rate to validate against (the waveform bucket kernels) —
 * matching the C ABI / Node / Python surfaces, so an NaN/Inf buffer still
 * throws, just with a generic native message instead of the indexed JS one.
 */
export interface ValidateOptions {
    validate?: boolean;
}
/**
 * Offline-analysis sample-rate bounds, mirroring the C++ core limits
 * (`sonare::kMinAudioSampleRate` / `kMaxAudioSampleRate` in `core/audio.h`).
 * Every guarded WASM entry point rejects the same out-of-range rates the C ABI,
 * Node, and Python surfaces do.
 */
export declare const MIN_AUDIO_SAMPLE_RATE = 8000;
export declare const MAX_AUDIO_SAMPLE_RATE = 384000;
export declare function assertSamples(fnName: string, samples: ArrayLike<number>, validate: boolean, argName?: string): void;
/**
 * `assertSamples` restricted to the span a windowed entry point actually reads.
 *
 * The emptiness check still covers the whole buffer, and the reported index is
 * the absolute one, so the message keeps naming the sample the caller passed.
 * What narrows is the scan: a windowed call refuses a non-finite sample inside
 * its frame and is indifferent to one outside it, which is the contract the C
 * ABI states and the cost model it promises -- per call the scan is bounded by
 * the frame, not by the length of the buffer being polled.
 */
export declare function assertSamplesInWindow(fnName: string, samples: ArrayLike<number>, validate: boolean, windowStart: number, windowLength: number, argName?: string): void;
export declare function assertFiniteScalar(fnName: string, value: number, argName: string): void;
/**
 * A NaN gamma is the automatic-bandwidth sentinel the variable-Q transform
 * documents, alongside a negative value, so only an infinity is out of domain.
 */
export declare function assertVqtGamma(fnName: string, gamma: number): void;
export declare function assertSampleRate(fnName: string, sampleRate: number, argName?: string): void;
/** Validate and retain the public Audio.fromBuffer construction contract. */
export declare function validateAudioBuffer(samples: Float32Array, sampleRate: number): void;
/** Bounds of the native `int` every embind argument below is narrowed into. */
export declare const C_INT_MIN = -2147483648;
export declare const C_INT_MAX = 2147483647;
/**
 * Reject an argument embind's declared-`int` narrowing would wrap.
 *
 * A positional embind parameter declared `int` WRAPS rather than saturates, so
 * a kernel of `2 ** 32` arrives as 0 and `2 ** 32 + 1` as 1 — both values the
 * native guards accept, so the call succeeds having separated on a setting the
 * caller never asked for. (The options-object path narrows through
 * `checkedIntFromVal`, which refuses the same inputs in the module; this is the
 * positional path's equivalent.)
 *
 * Reported as the branded `SonareError` carrying `InvalidParameter` rather than
 * a `RangeError`, because the class follows what the rejection stands in for: a
 * `RangeError` is this surface refusing an argument on its own authority, while
 * this one pre-empts a native refusal the caller would have received under that
 * code had the narrowing not wrapped the value into the accepted domain first.
 * The agreement with the Node and Python surfaces is asserted by the Node
 * package's `tests/narrowing-code-parity.test.ts`, which drives one value
 * through all three — weakening this check turns that red.
 */
export declare function assertInt32(fnName: string, value: number, argName: string): void;
/**
 * Check both HPSS kernels before embind narrows them.
 *
 * Parity, positivity and the ceiling stay the core's to enforce, and it names
 * the median filter that rejected the value. What cannot be deferred is the
 * narrowing itself: a wrapped kernel arrives as a legal one and separates on it.
 *
 * These two arrive POSITIONALLY, so they never pass through the options-bag
 * reader and inherit none of its checks. That is what separates this from
 * {@link assertPercussiveSeparation}, which duplicates a reader check to improve
 * a message; here there is no reader to duplicate.
 */
export declare function assertHpssKernels(fnName: string, kernelHarmonic: number, kernelPercussive: number): void;
/**
 * Percussive-event separation fields, as the request objects carry them.
 */
export interface PercussiveSeparationFields {
    nFft?: number;
    hopLength?: number;
    hpssKernelHarmonic?: number;
    hpssKernelPercussive?: number;
}
/**
 * Check the percussive-event separation's framing and kernels for integrality.
 *
 * All four fields reach the module through one options-bag reader, which now
 * refuses a fractional value itself, so this is the diagnostic rather than the
 * guarantee: it fires first and names the function, where the reader can only
 * name the field. Both reject the same set, so they cannot disagree about an
 * input — only about how the message reads. Do not narrow this to fields the
 * reader misses; there are none, and a check scoped to a gap that no longer
 * exists is how a stale justification outlives its divergence.
 *
 * The fields are iterated rather than named at each call site so a new one is
 * visible here. Absence means the default, so an omitted field is not resolved.
 */
export declare function assertPercussiveSeparation(fnName: string, options: PercussiveSeparationFields): void;
export declare function assertNonNegativeInteger(fnName: string, value: number, argName: string): void;
/** Integer strictly greater than zero, up to the native `int` ceiling. */
export declare function assertPositiveInteger(fnName: string, value: number, argName: string): void;
/**
 * Split "not an integer" into the two mistakes it can be: `TypeError` when the
 * value is not a `number` at all, `RangeError` when it is a number but not
 * integral -- the right-type, wrong-domain half of the same message.
 *
 * `Number.isInteger` alone answers both, which is why a single check reads as
 * sufficient; what it cannot do is say which one happened, and a caller can act
 * only on the mistake they made. The classes are the contract on this surface,
 * so a sibling argument in the same call must not report a fraction differently
 * from this one.
 */
export declare function assertIntegerValue(fnName: string, value: unknown, argName: string): asserts value is number;
/** Even integer in `[min, max]`, for an FFT-style size where only parity matters. */
export declare function assertEvenIntegerAtLeast(fnName: string, value: number, argName: string, min: number, max: number): void;
/** General integer-in-`[min, max]` check, for a bound {@link assertU7}/{@link assertNibble} don't cover. */
export declare function assertBoundedInteger(fnName: string, value: number, argName: string, min: number, max: number): void;
export declare function assertU7(fnName: string, value: number, argName: string): number;
export declare function assertNibble(fnName: string, value: number, argName: string): number;
export declare function assertU32(fnName: string, value: number, argName: string): void;
/**
 * Convert a caller-supplied index array to `Int32Array`, refusing any element
 * the conversion would change rather than folding it.
 *
 * `Int32Array.from(values, Math.trunc)` turns the sample index `1000.7` into
 * `1000` and `2 ** 31` into `-2 ** 31`. The C ABI takes `const int*`, so both
 * arrive as values nothing downstream can separate from ones the caller chose.
 * An `Int32Array` is returned as-is: its elements are already exact.
 */
export declare function toInt32Array(fnName: string, values: Int32Array | ArrayLike<number>, argName: string): Int32Array;
export declare function assertInterleavedSamples(fnName: string, samples: ArrayLike<number>, channels: number, validate: boolean): void;
