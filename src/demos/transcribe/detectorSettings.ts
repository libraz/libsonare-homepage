/**
 * The detector controls the page offers, and how they become `transcribe`
 * options.
 *
 * Every knob maps to one {@link TranscribeOptions} field, with the engine's own
 * default and a range inside the field's domain. Each path is sent only the
 * fields it reads: the engine refuses the polyphonic limits on the single-line
 * path, and the pitch split, measured, changes nothing on the polyphonic one.
 */
import type { TranscribeOptions } from '@/wasm/index.js';

export type DetectorMode = 'poly' | 'mono';

export interface DetectorSettings {
  mode: DetectorMode;
  /** `minNoteMs`; not read while {@link minNoteDivision} is set. */
  minNoteMs: number;
  /** `minNoteDivision` as `1/n` at the run's tempo; 0 leaves the floor to `minNoteMs`. */
  minNoteDivision: NoteDivision;
  /** `segmentationThresholdCents` (single line only). */
  splitCents: number;
  /** `velocityFloorDb`. */
  velocityFloorDb: number;
  /** `referenceHz: 'auto'` when true, 440 otherwise. */
  autoTuning: boolean;
  /** `maxPolyphony` (polyphonic only). */
  maxPolyphony: number;
  /** `minFramePeakRatio` (polyphonic only). */
  framePeakRatio: number;
  /** `minRidgePeakRatio` (polyphonic only). */
  ridgePeakRatio: number;
  /** `reattackRatio` (polyphonic only); 0 turns the split off. */
  reattackRatio: number;
}

export type KnobKey = Exclude<keyof DetectorSettings, 'mode' | 'autoTuning' | 'minNoteDivision'>;

/**
 * Note values offered as the shortest-note floor. The engine refuses
 * `minNoteDivision` together with `minNoteMs`, so 0 means "use the knob".
 */
export const NOTE_DIVISIONS = [0, 8, 16, 32] as const;
export type NoteDivision = (typeof NOTE_DIVISIONS)[number];

export interface KnobRange {
  min: number;
  max: number;
  step: number;
}

/**
 * Shortest-note start per path. The single line keeps the engine's 30 ms; the
 * polyphonic path starts at 120 ms, not the engine's 60: on rendered piano it
 * raised note F1 on every piece measured (SF2 mean 0.56 -> 0.62, built-in piano
 * 0.70 -> 0.72), trading recall for precision.
 */
export const MIN_NOTE_MS_DEFAULT: Record<DetectorMode, number> = { poly: 120, mono: 30 };

export const DEFAULT_SETTINGS: Readonly<DetectorSettings> = Object.freeze({
  mode: 'poly',
  minNoteMs: MIN_NOTE_MS_DEFAULT.poly,
  minNoteDivision: 0,
  splitCents: 50,
  velocityFloorDb: -48,
  autoTuning: false,
  maxPolyphony: 10,
  framePeakRatio: 0.2,
  ridgePeakRatio: 0.1,
  reattackRatio: 2,
});

export const KNOB_RANGES: Readonly<Record<KnobKey, KnobRange>> = Object.freeze({
  minNoteMs: { min: 10, max: 400, step: 5 },
  splitCents: { min: 10, max: 200, step: 5 },
  velocityFloorDb: { min: -90, max: -12, step: 1 },
  maxPolyphony: { min: 1, max: 16, step: 1 },
  framePeakRatio: { min: 0, max: 0.8, step: 0.01 },
  ridgePeakRatio: { min: 0, max: 0.6, step: 0.01 },
  // 0 is "off"; any other value must be above 1.
  reattackRatio: { min: 1, max: 6, step: 0.1 },
});

/** Knobs that only the polyphonic path reads. */
export const POLY_ONLY: readonly KnobKey[] = [
  'maxPolyphony',
  'framePeakRatio',
  'ridgePeakRatio',
  'reattackRatio',
];

/** Knobs that only the single-line path reads. */
export const MONO_ONLY: readonly KnobKey[] = ['splitCents'];

/** The reattack knob's bottom stop reads as "off" rather than as ratio 1. */
export function reattackOptionValue(knob: number): number {
  return knob <= KNOB_RANGES.reattackRatio.min ? 0 : knob;
}

/**
 * Switch path, carrying the shortest-note length along only when it was left
 * at the old path's default, so a deliberate setting survives the switch.
 */
export function withMode(settings: DetectorSettings, mode: DetectorMode): DetectorSettings {
  if (settings.mode === mode) return settings;
  const minNoteMs =
    settings.minNoteMs === MIN_NOTE_MS_DEFAULT[settings.mode]
      ? MIN_NOTE_MS_DEFAULT[mode]
      : settings.minNoteMs;
  return { ...settings, mode, minNoteMs };
}

export function toTranscribeOptions(settings: DetectorSettings): TranscribeOptions {
  const options: TranscribeOptions = {
    polyphonic: settings.mode === 'poly',
    velocityFloorDb: settings.velocityFloorDb,
    referenceHz: settings.autoTuning ? 'auto' : 440,
  };
  if (settings.minNoteDivision > 0) options.minNoteDivision = settings.minNoteDivision;
  else options.minNoteMs = settings.minNoteMs;
  if (settings.mode === 'mono') {
    options.segmentationThresholdCents = settings.splitCents;
  } else {
    options.maxPolyphony = settings.maxPolyphony;
    options.minFramePeakRatio = settings.framePeakRatio;
    options.minRidgePeakRatio = settings.ridgePeakRatio;
    options.reattackRatio = reattackOptionValue(settings.reattackRatio);
  }
  return options;
}

export function isDefault(settings: DetectorSettings): boolean {
  const base = withMode({ ...DEFAULT_SETTINGS }, settings.mode);
  return (Object.keys(base) as (keyof DetectorSettings)[]).every(
    (key) => base[key] === settings[key],
  );
}

/** A knob's value as the panel prints it; `off` labels the re-strike's bottom stop. */
export function formatKnob(key: KnobKey, value: number, off: string): string {
  switch (key) {
    case 'minNoteMs':
      return `${Math.round(value)} ms`;
    case 'splitCents':
      return `${Math.round(value)} ct`;
    case 'velocityFloorDb':
      return `${Math.round(value)} dB`;
    case 'maxPolyphony':
      return String(Math.round(value));
    case 'framePeakRatio':
    case 'ridgePeakRatio':
      return value.toFixed(2);
    case 'reattackRatio':
      return reattackOptionValue(value) === 0 ? off : `× ${value.toFixed(1)}`;
  }
}

/** A note-value floor as the panel prints it; `off` labels 0. */
export function formatDivision(division: NoteDivision, off: string): string {
  return division > 0 ? `1/${division}` : off;
}

/** Whether a run with these settings reads `key`. */
export function readBy(key: keyof DetectorSettings, settings: DetectorSettings): boolean {
  if (key === 'minNoteMs' && settings.minNoteDivision > 0) return false;
  const knob = key as KnobKey;
  return settings.mode === 'poly' ? !MONO_ONLY.includes(knob) : !POLY_ONLY.includes(knob);
}

/**
 * The settings that differ between two runs, in panel order. A knob the newer
 * run's path does not read is left out: changing it changed nothing.
 */
export function changedSettings(
  before: DetectorSettings,
  after: DetectorSettings,
): (keyof DetectorSettings)[] {
  return (Object.keys(DEFAULT_SETTINGS) as (keyof DetectorSettings)[]).filter(
    (key) => before[key] !== after[key] && readBy(key, after),
  );
}
