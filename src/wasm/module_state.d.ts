import { SonareError } from './errors.js';
import type { SonareModule } from './sonare.js';
/**
 * Recover the native exception-object pointer from a value thrown across the
 * WASM boundary. emscripten surfaces a C++ throw in two shapes depending on the
 * toolchain/exception mode:
 *   - a raw pointer number (older / classic surfacing), or
 *   - a `CppException` object exposing the pointer as `excPtr` (emscripten with
 *     `-fexceptions`).
 * Returns null when the thrown value is neither (a genuine JS error), so the
 * caller rethrows it unchanged.
 */
export declare function nativeExceptionPtr(error: unknown): number | null;
/** Error thrown when a facade function runs before `init()` resolved. */
export declare function notInitializedError(): SonareError;
/**
 * Throw an {@link ErrorCode.AbiMismatch} error unless the freshly created native
 * module reports the C-ABI version this package's TypeScript was built against.
 * A mismatch means the JS glue and the `.wasm` come from different builds, which
 * the `wasmBinary`, `locateFile` and `moduleFactory` options or a stale cache
 * can produce; running on would misread native structs.
 */
export declare function assertAbiCompatible(created: SonareModule): void;
/**
 * Throw when a later `init(options)` call passes options that differ (shallow,
 * functions by reference) from the first call's. No options always passes.
 */
export declare function assertSameInitOptions(first: object | undefined, next: object | undefined): void;
export declare function setSonareModule(module: SonareModule): void;
export declare function getSonareModule(): SonareModule;
