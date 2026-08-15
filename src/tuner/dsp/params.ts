/**
 * Physical-model patch parameters, mirrored 1:1 from libsonare's per-model
 * `*PatchParams` structs. These interfaces ARE the exported JSON schema: a tuned
 * patch serializes to exactly these fields so a maintainer can transcribe it
 * back into `gm_fallback_map.cpp` / `synth_presets.cpp`. Field defaults match the
 * C++ struct member initializers so a "reset" reproduces the engine's built-in
 * default voice — the same point the parity harness validates against the core.
 */
import type { BodyType } from './body-resonator';
import { type BowedStringPatchParams, defaultBowedParams } from './bowed-voice';
import { type BrassPatchParams, defaultBrassParams } from './brass-voice';
import { defaultFluteParams, type FlutePatchParams } from './flute-voice';
import { defaultFreeReedParams, type FreeReedPatchParams } from './free-reed-voice';
import type { KsPatchParams } from './ks-voice';
import type { ModalMode, ModalPatchParams } from './modal-voice';
import { defaultPercussionParams, type PercussionPatchParams } from './percussion-voice';
import { defaultPianoParams, type PianoPatchParams } from './piano-voice';
import { defaultPipeOrganParams, type PipeOrganPatchParams } from './pipe-organ-voice';
import { defaultPluckedParams, type PluckedStringPatchParams } from './plucked-string-voice';
import { defaultReedParams, type ReedPatchParams } from './reed-voice';
import { defaultVocalParams, type VocalPatchParams } from './vocal-voice';

/** The physically-modeled engines (the subset of the synth's engine modes that
 *  this tuner covers; the rest are subtractive / FM / additive). */
export type PhysicalEngineMode =
  | 'karplus-strong'
  | 'modal'
  | 'percussion'
  | 'piano'
  | 'pipe-organ'
  | 'bowed-string'
  | 'reed'
  | 'brass'
  | 'flute'
  | 'plucked-string'
  | 'vocal'
  | 'free-reed';

/** Instrument-family grouping for the model picker. */
export type EngineFamily = 'string' | 'mallet' | 'keyboard' | 'wind' | 'percussion' | 'vocal';

/** Static per-engine metadata driving the model picker and default spec. */
export interface EngineInfo {
  mode: PhysicalEngineMode;
  label: string;
  family: EngineFamily;
  /** Short exciter/resonator description for the 3D rack. */
  blurb: string;
  defaultBody: BodyType;
  defaultBodyMix: number;
  defaultGain: number;
}

/** The physical models, in picker order, grouped by family. */
export const ENGINE_INFO: Record<PhysicalEngineMode, EngineInfo> = {
  'karplus-strong': {
    mode: 'karplus-strong',
    label: 'Karplus-Strong',
    family: 'string',
    blurb: 'Plucked string — a damped delay loop.',
    defaultBody: 'none',
    defaultBodyMix: 0,
    defaultGain: 0.8,
  },
  'bowed-string': {
    mode: 'bowed-string',
    label: 'Bowed String',
    family: 'string',
    blurb: 'Friction-excited waveguide + corpus.',
    defaultBody: 'violin',
    defaultBodyMix: 0.25,
    defaultGain: 0.7,
  },
  piano: {
    mode: 'piano',
    label: 'Piano',
    family: 'keyboard',
    blurb: 'Stiff strings, felt hammer, soundboard.',
    defaultBody: 'none',
    defaultBodyMix: 0,
    defaultGain: 0.8,
  },
  modal: {
    mode: 'modal',
    label: 'Modal Mallet',
    family: 'mallet',
    blurb: 'Struck bar/bell — a resonator bank.',
    defaultBody: 'none',
    defaultBodyMix: 0,
    defaultGain: 0.7,
  },
  percussion: {
    mode: 'percussion',
    label: 'Percussion',
    family: 'percussion',
    blurb: 'Membrane modes + noise + shell.',
    defaultBody: 'none',
    defaultBodyMix: 0,
    defaultGain: 0.8,
  },
  'pipe-organ': {
    mode: 'pipe-organ',
    label: 'Pipe Organ',
    family: 'wind',
    blurb: 'Self-oscillating flue pipe, multi-rank.',
    defaultBody: 'none',
    defaultBodyMix: 0,
    defaultGain: 0.7,
  },
  reed: {
    mode: 'reed',
    label: 'Reed',
    family: 'wind',
    blurb: 'Single-reed valve on a bore.',
    defaultBody: 'none',
    defaultBodyMix: 0,
    defaultGain: 0.7,
  },
  brass: {
    mode: 'brass',
    label: 'Brass',
    family: 'wind',
    blurb: 'Lip-reed valve on a flaring bore.',
    defaultBody: 'brass-bell',
    defaultBodyMix: 0.2,
    defaultGain: 0.7,
  },
  flute: {
    mode: 'flute',
    label: 'Flute',
    family: 'wind',
    blurb: 'Air jet across an embouchure hole.',
    defaultBody: 'none',
    defaultBodyMix: 0,
    defaultGain: 0.7,
  },
  'plucked-string': {
    mode: 'plucked-string',
    label: 'Plucked String',
    family: 'string',
    blurb: 'Buzzing-bridge string — harp / koto / sitar.',
    defaultBody: 'guitar',
    defaultBodyMix: 0.25,
    defaultGain: 0.8,
  },
  vocal: {
    mode: 'vocal',
    label: 'Vocal',
    family: 'vocal',
    blurb: 'Glottal source through a formant bank.',
    defaultBody: 'none',
    defaultBodyMix: 0,
    defaultGain: 0.7,
  },
  'free-reed': {
    mode: 'free-reed',
    label: 'Free Reed',
    family: 'wind',
    blurb: 'Driven free-reed tongue — accordion / harmonica.',
    defaultBody: 'none',
    defaultBodyMix: 0,
    defaultGain: 0.7,
  },
};

/** Engines in picker/display order. */
export const ENGINE_ORDER: PhysicalEngineMode[] = [
  'karplus-strong',
  'plucked-string',
  'bowed-string',
  'piano',
  'modal',
  'percussion',
  'pipe-organ',
  'reed',
  'free-reed',
  'brass',
  'flute',
  'vocal',
];

/** Default KS params — matches `KsPatchParams` member initializers. */
export function defaultKsParams(): KsPatchParams {
  return {
    brightness: 0.6,
    decayS: 3.0,
    decayStretch: 0.5,
    pickPosition: 0.18,
    excBrightness: 0.85,
    velToBrightness: 0.6,
    releaseDampS: 0.08,
    slap: 0,
    polarization: 0,
    bodyCoupling: 0,
    pluckStyle: 0,
    nail: 0,
    sympathetic: false,
    pickupPos: 0,
    dispersion: 0,
    tensionMod: 0,
    octaveMix: 0,
    keyoffNoise: 0,
  };
}

function modalMode(ratio: number, gain: number, decayScale: number): ModalMode {
  return { ratio, gain, decayScale };
}

/**
 * Default modal params. The C++ `ModalPatchParams` default has `numModes = 0`
 * (a silent bank until a voicing is loaded); this factory seeds the same
 * inharmonic glockenspiel bar table the core's mallet presets use so the default
 * audibly rings, while keeping the scalar defaults 1:1 with the struct.
 */
export function defaultModalParams(): ModalPatchParams {
  return {
    numModes: 4,
    modes: [
      modalMode(1.0, 1.0, 1.0),
      modalMode(2.756, 0.6, 0.7),
      modalMode(5.404, 0.4, 0.5),
      modalMode(8.933, 0.25, 0.35),
      modalMode(1, 0, 1),
      modalMode(1, 0, 1),
      modalMode(1, 0, 1),
      modalMode(1, 0, 1),
    ],
    decayS: 2.0,
    decayStretch: 0.3,
    strikeBrightness: 0.7,
    velToBrightness: 0.6,
    releaseDampS: 0.15,
  };
}

/** Numeric parameter descriptor for the tuning UI (range + step + label). */
export interface ParamSpec {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  unit?: string;
  /** Rendered as an on/off toggle rather than a knob. */
  bool?: boolean;
}

/** One full turn, the span of the radian-valued strike angle. */
const TWO_PI = Math.round(2 * Math.PI * 10000) / 10000;

/**
 * Per-field range/label overrides for the generic spec builder.
 *
 * A field belongs here whenever its C++ clamp disagrees with what
 * {@link heuristicSpec} would derive from the name — otherwise the knob either
 * has inert travel above/below the clamp, or its step cannot land on the
 * engine's default value. Ranges mirror `sanitize_patch()` in
 * `native_synth_patch.cpp` (the clamp every patch passes through), tightened to
 * the voice core's own clamp where the core is stricter, and each step divides
 * the field's default so a reset is representable.
 */
const PARAM_OVERRIDES: Record<string, Partial<ParamSpec>> = {
  strings: { label: 'Unison strings', min: 1, max: 3, step: 1 },
  // kMaxModalModes = 8; percussion caps lower (see ENGINE_PARAM_OVERRIDES).
  numModes: { label: 'Modes', min: 0, max: 8, step: 1 },
  rankCount: { label: 'Ranks', min: 0, max: 8, step: 1 },
  shellNumModes: { label: 'Shell modes', min: 0, max: 4, step: 1 },
  hammerExponent: { label: 'Hammer felt', min: 1.5, max: 4, step: 0.05 },
  hammerContactMs: { min: 0.2, max: 10, step: 0.05, unit: 'ms' },
  decaySlowS: { min: 0.05, max: 120, step: 0.1, unit: 's' },
  // Bore purity saturates at 8 s (`purity = clamp(tone_decay_s / 8, 0, 1)`).
  toneDecayS: { min: 0.05, max: 8, step: 0.05, unit: 's' },
  releaseDampS: { min: 0.01, max: 10, step: 0.01, unit: 's' },
  // Pipe-organ chiff reaches down to 0.5 ms (see ENGINE_PARAM_OVERRIDES).
  chiffMs: { min: 1, max: 500, step: 0.5, unit: 'ms' },
  detuneCents: { label: 'Detune', min: 0, max: 30, step: 0.1, unit: '¢' },
  // The flute core clamps the jet to the first-register band; outside it the
  // patch-level clamp of [0.1, 0.9] is never heard.
  jetRatio: { label: 'Jet ratio', min: 0.38, max: 0.62, step: 0.005 },
  cutoffHz: { label: 'Cutoff', min: 20, max: 20000, step: 10, unit: 'Hz' },
  baseFreqHz: { label: 'Base freq', min: 0, max: 20000, step: 1, unit: 'Hz' },
  pitchDrop: { min: 0, max: 8, step: 0.01 },
  // Declared in radians; a full turn covers every orientation of the m>=1 modes.
  strikeTheta: { label: 'Strike angle', min: 0, max: TWO_PI, step: 0.01, unit: 'rad' },
  // The gain-like percussion layers are not normalized to 1: the drum seeds and
  // the perceptual macros both write well above it.
  toneGain: { min: 0, max: 4, step: 0.01 },
  noiseGain: { min: 0, max: 4, step: 0.01 },
  noiseQ: { min: 0.5, max: 30, step: 0.1 },
  wireBuzz: { min: 0, max: 4, step: 0.01 },
  wireThreshold: { min: 0, max: 4, step: 0.01 },
  shimmer: { min: 0, max: 16, step: 0.05 },
  phisemBeans: { min: 0, max: 256, step: 1 },
  // Negative glide starts the resonance below its centre and rises to it.
  phisemPitchGlide: { min: -0.95, max: 8, step: 0.01 },
  phisemSoundMs: { min: 0.2, max: 200, step: 0.1, unit: 'ms' },
  // 0 = off for both PhISEM frequencies, so neither may start at the generic
  // 20 Hz floor. The scrape ridge rate is a collision rate rather than a pitch,
  // so it keeps 1 Hz resolution instead of spanning the full 20 kHz clamp.
  phisemResHz: { min: 0, max: 20000, step: 10, unit: 'Hz' },
  phisemResQ: { min: 0.5, max: 30, step: 0.1 },
  phisemScrapeHz: { min: 0, max: 2000, step: 1, unit: 'Hz' },
  exclusiveClass: { label: 'Excl. class', min: 0, max: 16, step: 1 },
  footageMult: { label: 'Footage', min: 0.25, max: 8, step: 0.25 },
  vowel: { label: 'Vowel', min: 0, max: 4, step: 1 },
};

/**
 * Overrides that apply only within one engine, layered over
 * {@link PARAM_OVERRIDES}. Needed where two engines share a field name but the
 * cores clamp it differently, so a single name-keyed entry cannot be right for
 * both.
 */
const ENGINE_PARAM_OVERRIDES: Partial<
  Record<PhysicalEngineMode, Record<string, Partial<ParamSpec>>>
> = {
  // kMaxPercussionModes = 6 — modes 7-8 of the shared `numModes` entry are dead
  // on the membrane bank.
  percussion: { numModes: { max: 6 } },
  // The organ's chiff ramp is clamped to [0.5, 500] ms, the other winds to
  // [1, 500].
  'pipe-organ': { chiffMs: { min: 0.5 } },
};

/** Humanize a camelCase key into a UI label (`bowForce` -> `Bow force`). */
function humanizeKey(key: string): string {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/Hz\b/i, 'Hz')
    .replace(/Ms\b/i, 'ms')
    .replace(/\bS\b/, '')
    .toLowerCase()
    .trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Default range/unit for a scalar field from suffix heuristics. These are a
 * fallback for fields whose C++ clamp happens to match the family default —
 * anything that disagrees goes in {@link PARAM_OVERRIDES} rather than growing a
 * new suffix rule, since a name suffix cannot know a field's clamp.
 */
function heuristicSpec(key: string): Omit<ParamSpec, 'key' | 'label'> {
  if (key.endsWith('Ms')) return { min: 0, max: 2000, step: 1, unit: 'ms' };
  if (key.endsWith('Cents')) return { min: 0, max: 60, step: 0.1, unit: '¢' };
  if (key.endsWith('RateHz')) return { min: 0, max: 12, step: 0.1, unit: 'Hz' };
  if (key.endsWith('Hz')) return { min: 20, max: 20000, step: 10, unit: 'Hz' };
  if (key.endsWith('S')) return { min: 0.01, max: 12, step: 0.05, unit: 's' };
  if (/position|Position$/i.test(key) || key.endsWith('Pos'))
    return { min: 0, max: 0.5, step: 0.005 };
  return { min: 0, max: 1, step: 0.01 };
}

/**
 * Build the tuning-UI descriptors for a params object generically: every scalar
 * number becomes a knob (range from {@link PARAM_OVERRIDES}, narrowed by
 * {@link ENGINE_PARAM_OVERRIDES} when @p engine is given, else suffix
 * heuristics), every boolean a toggle. Non-scalar fields (mode/rank tables) are
 * skipped — they get dedicated editors. Iteration order follows the struct field
 * order, so the knobs read like the C++ `*PatchParams`.
 *
 * Pass @p engine wherever it is known: without it, a field whose clamp differs
 * per engine falls back to its widest entry.
 */
export function paramSpecsFor(
  params: Record<string, unknown>,
  engine?: PhysicalEngineMode,
): ParamSpec[] {
  const perEngine = engine ? (ENGINE_PARAM_OVERRIDES[engine] ?? {}) : {};
  const specs: ParamSpec[] = [];
  for (const [key, value] of Object.entries(params)) {
    const o = { ...PARAM_OVERRIDES[key], ...perEngine[key] };
    if (typeof value === 'boolean') {
      specs.push({ key, label: o.label ?? humanizeKey(key), min: 0, max: 1, step: 1, bool: true });
    } else if (typeof value === 'number') {
      const base = heuristicSpec(key);
      specs.push({ key, label: o.label ?? humanizeKey(key), ...base, ...o });
    }
  }
  return specs;
}

export type {
  BodyType,
  BowedStringPatchParams,
  BrassPatchParams,
  FlutePatchParams,
  FreeReedPatchParams,
  KsPatchParams,
  ModalMode,
  ModalPatchParams,
  PercussionPatchParams,
  PianoPatchParams,
  PipeOrganPatchParams,
  PluckedStringPatchParams,
  ReedPatchParams,
  VocalPatchParams,
};
export {
  defaultBowedParams,
  defaultBrassParams,
  defaultFluteParams,
  defaultFreeReedParams,
  defaultPercussionParams,
  defaultPianoParams,
  defaultPipeOrganParams,
  defaultPluckedParams,
  defaultReedParams,
  defaultVocalParams,
};
