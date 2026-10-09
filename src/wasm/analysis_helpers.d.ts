import type { AnalysisResult, ChordAnalysisResult, ChordDetectionOptions, KeyCandidate, KeyDetectionOptions, KeyMode } from './public_types.js';
import type { WasmAnalysisResult, WasmChordAnalysisResult, WasmKeyCandidateResult } from './sonare.js';
/** Name of a key-mode ordinal as the module reports it. */
export declare function keyModeName(ordinal: number): KeyMode;
export declare function convertKeyCandidate(wasm: WasmKeyCandidateResult): KeyCandidate;
/** Ordinal of a key mode given by name or ordinal; anything else is refused. */
export declare function keyModeOrdinal(mode: unknown): number;
export declare function keyModeValues(modes: KeyDetectionOptions['modes'] | undefined): number[];
export declare function keyProfileValue(profile: KeyDetectionOptions['profile'] | undefined): number;
export declare function convertChordAnalysisResult(wasm: WasmChordAnalysisResult): ChordAnalysisResult;
export declare function chordChromaMethodValue(method: ChordDetectionOptions['chromaMethod']): number;
export declare function convertAnalysisResult(wasm: WasmAnalysisResult): AnalysisResult;
