/**
 * Type contracts for inline documentation demos.
 *
 * A demo is referenced from markdown as `<SonareDemo id="..." />`. The id resolves
 * to a {@link SonareDemoDef} in the registry. One dispatcher component renders the
 * appropriate archetype; markdown never imports a component directly.
 *
 * Visual styling of archetypes is owned by the design layer; this file fixes only
 * the data/behavior contract every archetype shares.
 */

/** A short piece of text available in both supported locales. */
export interface I18nText {
  en: string;
  ja: string;
}

/** Supported UI locales. Mirrors VitePress's `en` / `ja` locale keys. */
export type DemoLocale = 'en' | 'ja';

/**
 * The interaction shape of a demo. Each archetype maps to one archetype component.
 * - `transform`   — source → WASM transform → spectral/2D visualization (STFT, mel, chroma, MFCC)
 * - `detector`    — source → analysis → annotated overlay on a waveform (BPM, key, chord, onset, sections)
 * - `ab-process`  — clip → single processor with params → A/B audition + before/after
 * - `meters`      — source → metering readouts (LUFS, true-peak, dynamic range, phase scope)
 * - `param-sweep` — slider → immediate audio + figure (pitch shift, time stretch, formant, EQ tilt)
 * - `synth`       — patch params → live audio + scope / envelope figure
 * - `signal`      — generate a test signal (tone/sweep/noise) and observe it; no clip required
 * - `room`        — simple geometry → RIR synthesis → audition
 * - `contour`     — clip → pitch tracking → melody f0 contour line over time
 * - `lane-mixer`  — MIDI clips → realtime-engine lane mixer (faders/mutes) → per-lane envelopes + audition
 * - `spectral-edit` — clip + injected artifact → region `spectralEdit` → A/B audition + before/after spectrum
 */
export type DemoArchetype =
  | 'transform'
  | 'detector'
  | 'ab-process'
  | 'meters'
  | 'param-sweep'
  | 'synth'
  | 'signal'
  | 'room'
  | 'contour'
  | 'lane-mixer'
  | 'spectral-edit';

/** Waveform shapes that can be generated in-browser without WASM (cheap test signals). */
export type GeneratedSignal = 'sine' | 'saw' | 'square' | 'triangle' | 'sweep' | 'noise';

/**
 * Where a demo gets its audio.
 * - `generate` — synthesized in-browser at runtime (deterministic, no asset).
 * - `clip`     — a pre-rendered asset under `src/public/demo-clips/`, keyed by name.
 */
export type DemoSource =
  | {
      kind: 'generate';
      signal: GeneratedSignal;
      /** Fundamental / start frequency in Hz (start frequency for `sweep`). */
      freq?: number;
      /** End frequency in Hz for `sweep`. */
      freqEnd?: number;
      /** Duration in seconds. Default 2. */
      duration?: number;
      /** Sample rate in Hz. Default 44100. */
      sampleRate?: number;
      /** Linear amplitude 0..1. Default 0.6. */
      gain?: number;
    }
  | {
      kind: 'clip';
      /** Asset key, e.g. `band` resolves to `/demo-clips/band.*`. */
      clip: string;
    };

/** A user-adjustable control surfaced by an archetype. */
export interface ParamDef {
  /** Stable key used to read the value in the archetype. */
  key: string;
  label: I18nText;
  kind: 'range' | 'select' | 'toggle';
  /** Default value (number for range, string for select, boolean for toggle). */
  default: number | string | boolean;
  /** range only */
  min?: number;
  /** range only */
  max?: number;
  /** range only */
  step?: number;
  /** Unit suffix shown next to a range value, e.g. `dB`, `st`, `%`. */
  unit?: I18nText | string;
  /** select only */
  options?: Array<{ value: string; label: I18nText }>;
}

/** How an archetype renders its primary visualization. */
export type VizKind =
  | 'waveform'
  | 'spectrogram'
  | 'chroma'
  | 'meters'
  | 'scope'
  | 'heatmap'
  | 'overlay';

/** A single demo definition. The `id` is the stable handle used from markdown. */
export interface SonareDemoDef {
  /** Stable id, kebab-case. Referenced as `<SonareDemo id="stft-basics" />`. */
  id: string;
  archetype: DemoArchetype;
  source: DemoSource;
  title: I18nText;
  /** Optional one-line caption shown under the widget. */
  caption?: I18nText;
  /** Controls surfaced to the reader. */
  params?: ParamDef[];
  /** Primary visualization for this demo. */
  viz?: VizKind;
  /** Archetype-specific configuration (processor name, detector kind, mel bins, …). */
  config?: Record<string, unknown>;
}

/** Pick the string for a locale, falling back to English. */
export function localized(text: I18nText | undefined, locale: DemoLocale): string {
  if (!text) return '';
  return locale === 'ja' ? text.ja || text.en : text.en;
}
