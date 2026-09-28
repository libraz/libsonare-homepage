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
export declare function setSonareModule(module: SonareModule): void;
export declare function getSonareModule(): SonareModule;
