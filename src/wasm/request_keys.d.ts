/**
 * The keys one request-object entry point accepts. `nested` names an options
 * object forwarded to native code, whose own keys are refused too; `hints`
 * names an object whose keys the native layer already validates, used only to
 * point a misplaced key at its field.
 */
export interface RequestShape {
    readonly keys: readonly string[];
    readonly nested?: Readonly<Record<string, readonly string[]>>;
    readonly hints?: Readonly<Record<string, readonly string[]>>;
}
/** Request shape of every entry point that takes a request object, by entry-point name. */
export declare const REQUEST_SHAPES: Readonly<Record<string, RequestShape>>;
/** Option fields {@link analyzeWithProgress} reads from the request itself as well as from `options`. */
export declare const MUSIC_ANALYZE_OPTION_KEYS: readonly string[];
