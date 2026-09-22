/**
 * The one patch every chapter of the page edits, and the table that describes
 * its fields.
 *
 * The patch is held **fully resolved**: every field carries a real number the
 * engine will use, never a "keep whatever the preset had" sentinel. The engine
 * makes that possible — `synthPresetPatch(name)` hands back a preset with all of
 * its fields filled in — and it is what lets a chapter say "this is the cutoff"
 * and be believed. A patch half made of absent keys can only be explained by
 * describing the thing it inherits from.
 *
 * `CLASSIC_PARAMS` is the single description of every editable field: its range,
 * its unit and whether its knob should travel logarithmically. The panel, the
 * playground and the URL state all read it, so a field is added in one place.
 */
import type { SynthModRouting, SynthPatch } from '@/wasm/index';

/** How a value is spelled next to its control. */
export type ParamUnit = 'hz' | 'ms' | 'cents' | 'ratio' | 'count';

/** Which section of the voice a field belongs to. */
export type ParamGroup = 'osc' | 'filter' | 'amp' | 'filter-env' | 'lfo' | 'body' | 'out';

export type NumericParamKey =
  | 'unison'
  | 'detuneCents'
  | 'driftCents'
  | 'drive'
  | 'cutoffHz'
  | 'resonanceQ'
  | 'hpCutoffHz'
  | 'keyTrack'
  | 'envToCutoffCents'
  | 'velToCutoffCents'
  | 'ampAttackMs'
  | 'ampDecayMs'
  | 'ampSustain'
  | 'ampReleaseMs'
  | 'filterAttackMs'
  | 'filterDecayMs'
  | 'filterSustain'
  | 'filterReleaseMs'
  | 'lfoRateHz'
  | 'lfoToPitchCents'
  | 'lfo2RateHz'
  | 'glideMs'
  | 'bodyMix'
  | 'stereoSpread'
  | 'gain'
  | 'busDrive';

export interface NumericParam {
  key: NumericParamKey;
  group: ParamGroup;
  min: number;
  max: number;
  /** Smallest step the control offers, in the field's own unit. */
  step: number;
  unit: ParamUnit;
  /**
   * True where the useful range spans decades and a linear knob would spend
   * most of its travel in the top octave. `min` must then be above zero.
   */
  log?: true;
}

/**
 * Every editable field, in the order a voice reaches them: oscillator, filter,
 * the two envelopes, the LFOs, the body, the output.
 *
 * The ranges are the ones the controls offer, not the engine's own clamps. The
 * engine clamps a patch to what is audible on its side regardless, so a range
 * here is a statement about what is worth reaching by hand.
 */
export const CLASSIC_PARAMS: readonly NumericParam[] = [
  { key: 'unison', group: 'osc', min: 1, max: 7, step: 1, unit: 'count' },
  { key: 'detuneCents', group: 'osc', min: 0, max: 50, step: 1, unit: 'cents' },
  { key: 'driftCents', group: 'osc', min: 0, max: 30, step: 1, unit: 'cents' },
  { key: 'drive', group: 'osc', min: 0, max: 1, step: 0.01, unit: 'ratio' },

  { key: 'cutoffHz', group: 'filter', min: 40, max: 18_000, step: 1, unit: 'hz', log: true },
  { key: 'resonanceQ', group: 'filter', min: 0.5, max: 12, step: 0.01, unit: 'ratio' },
  { key: 'hpCutoffHz', group: 'filter', min: 0, max: 2_000, step: 1, unit: 'hz' },
  { key: 'keyTrack', group: 'filter', min: 0, max: 1, step: 0.01, unit: 'ratio' },
  { key: 'envToCutoffCents', group: 'filter', min: -4800, max: 4800, step: 10, unit: 'cents' },
  { key: 'velToCutoffCents', group: 'filter', min: -4800, max: 4800, step: 10, unit: 'cents' },

  { key: 'ampAttackMs', group: 'amp', min: 0, max: 4_000, step: 1, unit: 'ms' },
  { key: 'ampDecayMs', group: 'amp', min: 1, max: 4_000, step: 1, unit: 'ms' },
  { key: 'ampSustain', group: 'amp', min: 0, max: 1, step: 0.01, unit: 'ratio' },
  { key: 'ampReleaseMs', group: 'amp', min: 1, max: 6_000, step: 1, unit: 'ms' },

  { key: 'filterAttackMs', group: 'filter-env', min: 0, max: 4_000, step: 1, unit: 'ms' },
  { key: 'filterDecayMs', group: 'filter-env', min: 1, max: 4_000, step: 1, unit: 'ms' },
  { key: 'filterSustain', group: 'filter-env', min: 0, max: 1, step: 0.01, unit: 'ratio' },
  { key: 'filterReleaseMs', group: 'filter-env', min: 1, max: 6_000, step: 1, unit: 'ms' },

  { key: 'lfoRateHz', group: 'lfo', min: 0.05, max: 20, step: 0.05, unit: 'hz', log: true },
  { key: 'lfoToPitchCents', group: 'lfo', min: 0, max: 200, step: 1, unit: 'cents' },
  { key: 'lfo2RateHz', group: 'lfo', min: 0.05, max: 20, step: 0.05, unit: 'hz', log: true },

  { key: 'bodyMix', group: 'body', min: 0, max: 1, step: 0.01, unit: 'ratio' },

  { key: 'glideMs', group: 'out', min: 0, max: 400, step: 1, unit: 'ms' },
  { key: 'stereoSpread', group: 'out', min: 0, max: 1, step: 0.01, unit: 'ratio' },
  { key: 'gain', group: 'out', min: 0, max: 1, step: 0.01, unit: 'ratio' },
  { key: 'busDrive', group: 'out', min: 0, max: 1, step: 0.01, unit: 'ratio' },
];

const PARAM_BY_KEY = new Map(CLASSIC_PARAMS.map((param) => [param.key, param]));

export function paramOf(key: NumericParamKey): NumericParam {
  const param = PARAM_BY_KEY.get(key);
  if (!param) throw new Error(`Unknown patch parameter: ${key}`);
  return param;
}

/** The enum fields the page lets a reader change. */
export type WaveformName = 'sine' | 'saw' | 'square' | 'triangle' | 'noise';
export type FilterModelName = 'svf' | 'moog-ladder' | 'diode-ladder' | 'sallen-key';
export type FilterOutputName = 'lowpass' | 'bandpass' | 'highpass';
export type BodyName = 'none' | 'guitar' | 'violin' | 'wood-tube' | 'brass-bell' | 'vocal';

/**
 * `'default'` is left out of every list on purpose. It means "keep the base
 * patch's value", which has nothing to select here: the patch on screen has no
 * base to fall back to.
 */
export const WAVEFORMS: readonly WaveformName[] = ['sine', 'saw', 'square', 'triangle', 'noise'];
export const FILTER_MODELS: readonly FilterModelName[] = [
  'svf',
  'moog-ladder',
  'diode-ladder',
  'sallen-key',
];
export const FILTER_OUTPUTS: readonly FilterOutputName[] = ['lowpass', 'bandpass', 'highpass'];
export const BODIES: readonly BodyName[] = [
  'none',
  'guitar',
  'violin',
  'wood-tube',
  'brass-bell',
  'vocal',
];

/**
 * Only the state-variable filter has a choice of output. The three ladder
 * models answer to `filterOutput` with a render identical to their lowpass, so
 * the control is disabled rather than offered and ignored.
 */
export function offersFilterOutput(model: FilterModelName): boolean {
  return model === 'svf';
}

/**
 * The mod matrix holds at most eight routings. The cap is the engine's, and the
 * matrix UI enforces it rather than letting a ninth be drawn and then vanish.
 */
export const MAX_MOD_ROUTINGS = 8;

/**
 * Every modulation source the engine offers. `'none'` is not among them: a
 * routing from nowhere is accepted silently and does nothing, so the matrix
 * never lets one be made.
 */
export const MOD_SOURCES = [
  'amp-env',
  'filter-env',
  'lfo1',
  'lfo2',
  'velocity',
  'key-track',
  'mod-wheel',
  'random',
  'breath',
  'aftertouch',
  'expression-cc',
  'pitch-bend',
] as const;
export type ModSourceName = (typeof MOD_SOURCES)[number];

export type ModDestinationName =
  | 'pitch-cents'
  | 'cutoff-cents'
  | 'amp-gain'
  | 'pan-units'
  | 'resonance-q'
  | 'vibrato-depth-cents'
  | 'filter-env-depth'
  | 'lfo1-rate-scale';

/** A field of the patch a destination needs set before it can do anything. */
export type ModRequirement = 'filter-env' | 'lfo1-audible';

export interface ModDestination {
  key: ModDestinationName;
  /** Depth at full source deflection, in the destination's own unit. */
  min: number;
  max: number;
  step: number;
  unit: ParamUnit;
  /** What else must be true for the routing to be heard at all. */
  requires?: ModRequirement;
}

/**
 * The destinations this engine's subtractive voice can actually reach, with the
 * depth range each one is useful over.
 *
 * The ranges are measured, not inferred from the unit. Three of them would be
 * unusable if a slider assumed its name: `pan-units` needs about a thousand to
 * reach a hard pan, so a ±1 control moves the image by a tenth of a percent;
 * `amp-gain` stops changing past about three; `filter-env-depth` past about
 * two.
 *
 * Four further destinations exist and are not here. `excitation-force`,
 * `excitation-position` and `excitation-brightness` reach a physical model's
 * exciter, and `spectrum-morph` travels between two spectral tables — this
 * voice has neither, and every routing into them renders bit-identical to no
 * routing at all. Offering a control that provably cannot move the sound is
 * worse than leaving it out, so the chapter says why instead.
 */
export const MOD_DESTINATIONS: readonly ModDestination[] = [
  { key: 'pitch-cents', min: -2400, max: 2400, step: 10, unit: 'cents' },
  { key: 'cutoff-cents', min: -4800, max: 4800, step: 10, unit: 'cents' },
  { key: 'amp-gain', min: -3, max: 3, step: 0.05, unit: 'ratio' },
  { key: 'pan-units', min: -1000, max: 1000, step: 10, unit: 'ratio' },
  { key: 'resonance-q', min: -8, max: 8, step: 0.1, unit: 'ratio' },
  { key: 'vibrato-depth-cents', min: 0, max: 1200, step: 10, unit: 'cents' },
  { key: 'filter-env-depth', min: -2, max: 2, step: 0.05, unit: 'ratio', requires: 'filter-env' },
  { key: 'lfo1-rate-scale', min: -4, max: 4, step: 0.1, unit: 'ratio', requires: 'lfo1-audible' },
];

export function destinationOf(key: ModDestinationName): ModDestination {
  const destination = MOD_DESTINATIONS.find((candidate) => candidate.key === key);
  if (!destination) throw new Error(`Unknown modulation destination: ${key}`);
  return destination;
}

/** The page's own patch: the wrapper sections, fully resolved, nothing optional. */
export type ClassicPatch = Record<NumericParamKey, number> & {
  waveform: WaveformName;
  filterModel: FilterModelName;
  filterOutput: FilterOutputName;
  body: BodyName;
  modRoutings: SynthModRouting[];
};

/**
 * A plain saw through an open filter — the patch a reader should meet first,
 * because every later chapter is a thing done to it.
 */
export function defaultPatch(): ClassicPatch {
  return {
    waveform: 'saw',
    unison: 1,
    detuneCents: 0,
    driftCents: 0,
    drive: 0,
    filterModel: 'svf',
    filterOutput: 'lowpass',
    cutoffHz: 18_000,
    resonanceQ: 0.707,
    hpCutoffHz: 0,
    keyTrack: 0,
    envToCutoffCents: 0,
    velToCutoffCents: 0,
    ampAttackMs: 5,
    ampDecayMs: 200,
    ampSustain: 0.8,
    ampReleaseMs: 200,
    filterAttackMs: 5,
    filterDecayMs: 200,
    filterSustain: 0.7,
    filterReleaseMs: 200,
    lfoRateHz: 5,
    lfoToPitchCents: 0,
    lfo2RateHz: 1,
    glideMs: 0,
    body: 'none',
    bodyMix: 0,
    stereoSpread: 0,
    gain: 0.5,
    busDrive: 0,
    modRoutings: [],
  };
}

/**
 * Why a routing into this destination would make no sound on the patch as it
 * stands, or null when nothing is in its way.
 *
 * Both answers are measured. `filter-env-depth` scales the filter envelope's
 * reach, so with `envToCutoffCents` at zero it scales zero. `lfo1-rate-scale`
 * changes how fast LFO1 runs, which is silent while LFO1 drives nothing — the
 * mod wheel also wakes it through the voice's built-in vibrato, so a reader
 * turning that will hear it despite the warning.
 */
export function unmetRequirement(
  patch: ClassicPatch,
  destination: ModDestination,
): ModRequirement | null {
  if (destination.requires === 'filter-env' && patch.envToCutoffCents === 0) return 'filter-env';
  if (destination.requires === 'lfo1-audible' && !lfo1Audible(patch)) return 'lfo1-audible';
  return null;
}

function lfo1Audible(patch: ClassicPatch): boolean {
  if (patch.lfoToPitchCents !== 0) return true;
  return patch.modRoutings.some(
    (routing) => routing.source === 'lfo1' && routing.destination !== 'lfo1-rate-scale',
  );
}

/**
 * Detuning spreads a stack apart, so with one voice in the stack there is
 * nothing to spread. Drift is per voice and does act at unison 1.
 */
export function detuneHasEffect(patch: ClassicPatch): boolean {
  return patch.unison >= 2;
}

function pickEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function clampToParam(value: unknown, key: NumericParamKey, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  const { min, max } = paramOf(key);
  return Math.min(max, Math.max(min, value));
}

/**
 * Read a resolved preset — what `synthPresetPatch(name)` returns — into the
 * page's own patch, clamped to the ranges the controls offer.
 *
 * Fields the page does not expose (the sample engine's, polyphony, the binding
 * conveniences) are dropped rather than carried invisibly, so what plays is what
 * is on screen.
 */
export function patchFromPreset(resolved: Partial<SynthPatch>): ClassicPatch {
  const base = defaultPatch();
  const patch: ClassicPatch = {
    ...base,
    waveform: pickEnum(resolved.waveform, WAVEFORMS, base.waveform),
    filterModel: pickEnum(resolved.filterModel, FILTER_MODELS, base.filterModel),
    filterOutput: pickEnum(resolved.filterOutput, FILTER_OUTPUTS, base.filterOutput),
    body: pickEnum(resolved.body, BODIES, base.body),
    modRoutings: (resolved.modRoutings ?? []).slice(0, MAX_MOD_ROUTINGS).map((routing) => ({
      source: routing.source,
      destination: routing.destination,
      depth: routing.depth,
    })),
  };
  for (const { key } of CLASSIC_PARAMS) {
    patch[key] = clampToParam(resolved[key], key, base[key]);
  }
  return patch;
}

/** Hand the patch to the engine. Every field is sent, because every field is real. */
export function toSynthPatch(patch: ClassicPatch): SynthPatch {
  const out: SynthPatch = {
    waveform: patch.waveform,
    filterModel: patch.filterModel,
    filterOutput: patch.filterOutput,
    body: patch.body,
    modRoutings: patch.modRoutings.map((routing) => ({ ...routing })),
  };
  for (const { key } of CLASSIC_PARAMS) {
    (out as Record<string, unknown>)[key] = patch[key];
  }
  return out;
}

/** One note of a chapter's phrase, positioned in beats at the project tempo. */
export interface PhraseNote {
  /** MIDI note number. */
  note: number;
  /** Onset, in quarter notes. */
  beat: number;
  /** Sounding length, in quarter notes. */
  beats: number;
  velocity: number;
}

/** One continuous-controller move inside a phrase. */
export interface PhraseControl {
  /** MIDI CC number, or `'pressure'` / `'bend'` for the two that are not CCs. */
  controller: number | 'pressure' | 'bend';
  /**
   * Value at the start of the ramp. CC and pressure are 0-127; bend is written
   * here as -1..1 around centre and converted to the wire's 14-bit range on the
   * way out, so a phrase reads as a musical gesture rather than as a number
   * near 8192.
   */
  from: number;
  to: number;
  beat: number;
  beats: number;
}

export interface Phrase {
  id: string;
  notes: PhraseNote[];
  controls?: PhraseControl[];
  /** Total render length in beats, including the room a release tail needs. */
  beats: number;
}

/** A single sustained low note: the phrase for anything about timbre. */
export const PHRASE_SUSTAIN: Phrase = {
  id: 'sustain',
  notes: [{ note: 45, beat: 0, beats: 2.5, velocity: 100 }],
  beats: 4,
};

/** Four short notes, so an attack and a release are heard as shapes, not as tone. */
export const PHRASE_STACCATO: Phrase = {
  id: 'staccato',
  notes: [0, 1, 2, 3].map((index) => ({
    note: [45, 52, 57, 60][index],
    beat: index * 0.75,
    beats: 0.35,
    velocity: 100,
  })),
  beats: 4.5,
};

/**
 * One long note under moving controllers: the only phrase in which a mod-matrix
 * routing from a gesture source has anything to follow.
 */
export const PHRASE_GESTURE: Phrase = {
  id: 'gesture',
  notes: [{ note: 45, beat: 0, beats: 5.5, velocity: 100 }],
  controls: [
    { controller: 1, from: 0, to: 127, beat: 0.25, beats: 5 },
    { controller: 2, from: 0, to: 127, beat: 0.25, beats: 5 },
    { controller: 11, from: 127, to: 20, beat: 0.25, beats: 5 },
    { controller: 'pressure', from: 0, to: 127, beat: 0.25, beats: 5 },
    { controller: 'bend', from: 0, to: 0.5, beat: 0.25, beats: 5 },
  ],
  beats: 7,
};

/** A chord spread over three octaves, for hearing width and drift. */
export const PHRASE_CHORD: Phrase = {
  id: 'chord',
  notes: [33, 45, 52, 57, 64, 69].map((note, index) => ({
    note,
    beat: index * 0.04,
    beats: 3,
    velocity: 96,
  })),
  beats: 5,
};

/** Notes across the keyboard, for hearing key tracking and velocity. */
export const PHRASE_RANGE: Phrase = {
  id: 'range',
  notes: [
    { note: 33, beat: 0, beats: 0.6, velocity: 40 },
    { note: 45, beat: 0.75, beats: 0.6, velocity: 80 },
    { note: 57, beat: 1.5, beats: 0.6, velocity: 110 },
    { note: 69, beat: 2.25, beats: 0.6, velocity: 127 },
  ],
  beats: 4.5,
};

export const PHRASES: readonly Phrase[] = [
  PHRASE_SUSTAIN,
  PHRASE_STACCATO,
  PHRASE_GESTURE,
  PHRASE_CHORD,
  PHRASE_RANGE,
];

export function phraseOf(id: string): Phrase {
  const phrase = PHRASES.find((candidate) => candidate.id === id);
  if (!phrase) throw new Error(`Unknown phrase: ${id}`);
  return phrase;
}
