import type { ProjectAutomationCurve } from './project_types';
import type { AutomationCurve, MeterTap, PanLawInput, PanMode, SendTiming } from './public_types';
/** Resolve a numeric ordinal in an inclusive range without coercion. */
export declare function resolveOrdinalInRange(value: unknown, min: number, max: number, enumName: string): number;
/** Resolve a public enum spelling or ordinal without permitting unknown values. */
export declare function resolveEnumOrdinal(value: unknown, values: Readonly<Record<string, number>>, enumName: string): number;
/**
 * Automation curve spellings and their `SonareAutomationCurve` ordinals.
 *
 * Single source of truth for the vocabulary: {@link AutomationCurve} and
 * {@link ProjectAutomationCurve} are derived from these keys, so a spelling
 * cannot be documented without resolving, or resolve without being documented.
 */
export declare const AUTOMATION_CURVE_VALUES: {
    readonly linear: 0;
    readonly exponential: 1;
    readonly hold: 2;
    readonly 's-curve': 3;
};
/**
 * The Project facade additionally accepts the legacy `'scurve'` spelling for
 * compatibility with project data written before `'s-curve'` was canonical.
 * The Node package declares the same pair of tables, so a breakpoint accepted
 * by one facade resolves to the same ordinal on the other.
 */
export declare const PROJECT_AUTOMATION_CURVE_VALUES: {
    readonly scurve: 3;
    readonly linear: 0;
    readonly exponential: 1;
    readonly hold: 2;
    readonly 's-curve': 3;
};
export declare function automationCurveCode(curve: AutomationCurve): number;
/** Resolve a Project automation breakpoint curve, legacy spellings included. */
export declare function projectAutomationCurveCode(curve: ProjectAutomationCurve | undefined): number;
export declare function panLawCode(panLaw: PanLawInput): number;
export declare function panModeCode(panMode: PanMode | number): number;
export declare function meterTapCode(tap: MeterTap | number): number;
export declare function sendTimingCode(timing: SendTiming | number): number;
/** Resolve a per-track PFL/AFL monitor mode to its C-ABI ordinal. */
export declare function trackMonitorModeCode(mode: unknown): number;
