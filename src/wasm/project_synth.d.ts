import type { SynthEnumTables, SynthPatch } from './instrument_types';
/**
 * Runtime ABI version of the flat project POD layout exposed by this WASM
 * build. Equals {@link EXPECTED_PROJECT_ABI_VERSION} when the arrangement
 * subsystem is compiled in. Mirrors the C-ABI `sonare_project_abi_version`.
 */
export declare function projectAbiVersion(): number;
/**
 * NativeSynth preset catalog names (`'sine'`, `'saw-lead'`, `'e-piano'`,
 * `'drum-kit'`, ...). Use these to discover valid {@link SynthPatch} preset
 * names instead of hardcoding magic strings.
 */
export declare function synthPresetNames(): string[];
/**
 * Controller-profile preset names (`'gm'`, `'breath'`, `'breath-aftertouch'`,
 * `'mpe'`). These are the names {@link RealtimeEngine.setControllerProfile}
 * accepts; an unknown one throws rather than resolving to a default.
 */
export declare function controllerProfileNames(): string[];
/**
 * Fetch a named catalog preset as a {@link SynthPatch} (the preset name plus
 * the wrapper-section values), so hosts can inspect a preset and tweak fields
 * before binding it. A `"va:"` routing prefix is accepted; unknown names
 * throw.
 */
export declare function synthPresetPatch(name: string): SynthPatch;
export declare function synthEnumTables(): SynthEnumTables;
export declare function synthPatchRoundTripForTest(patch: SynthPatch): SynthPatch;
