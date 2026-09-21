import type { AnalysisResult, ChordAnalysisResult, ChordDetectionOptions, KeyCandidate, KeyDetectionOptions } from './public_types';
import type { WasmAnalysisResult, WasmChordAnalysisResult, WasmKeyCandidateResult } from './sonare.js';
export declare function convertKeyCandidate(wasm: WasmKeyCandidateResult): KeyCandidate;
export declare function keyModeValues(modes: KeyDetectionOptions['modes'] | undefined): number[];
export declare function keyProfileValue(profile: KeyDetectionOptions['profile'] | undefined): number;
export declare function convertChordAnalysisResult(wasm: WasmChordAnalysisResult): ChordAnalysisResult;
export declare function chordChromaMethodValue(method: ChordDetectionOptions['chromaMethod']): number;
export declare function convertAnalysisResult(wasm: WasmAnalysisResult): AnalysisResult;
