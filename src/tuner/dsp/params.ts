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

/** Per-field range/label overrides for the generic spec builder. */
const PARAM_OVERRIDES: Record<string, Partial<ParamSpec>> = {
  strings: { label: 'Unison strings', min: 1, max: 3, step: 1 },
  numModes: { label: 'Modes', min: 0, max: 8, step: 1 },
  rankCount: { label: 'Ranks', min: 0, max: 8, step: 1 },
  shellNumModes: { label: 'Shell modes', min: 0, max: 4, step: 1 },
  hammerExponent: { label: 'Hammer felt', min: 1, max: 5, step: 0.1 },
  detuneCents: { label: 'Detune', min: 0, max: 30, step: 0.1, unit: '¢' },
  jetRatio: { label: 'Jet ratio', min: 0.05, max: 0.95, step: 0.01 },
  cutoffHz: { label: 'Cutoff', min: 20, max: 20000, step: 10, unit: 'Hz' },
  baseFreqHz: { label: 'Base freq', min: 0, max: 2000, step: 1, unit: 'Hz' },
  exclusiveClass: { label: 'Excl. class', min: 0, max: 16, step: 1 },
  footageMult: { label: 'Footage', min: 0.25, max: 8, step: 0.25 },
  vowel: { label: 'Vowel', min: 0, max: 4, step: 1 },
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

/** Default range/unit for a scalar field from suffix heuristics. */
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
 * number becomes a knob (range from {@link PARAM_OVERRIDES} or suffix
 * heuristics), every boolean a toggle. Non-scalar fields (mode/rank tables) are
 * skipped — they get dedicated editors. Iteration order follows the struct field
 * order, so the knobs read like the C++ `*PatchParams`.
 */
export function paramSpecsFor(params: Record<string, unknown>): ParamSpec[] {
  const specs: ParamSpec[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'boolean') {
      const o = PARAM_OVERRIDES[key] ?? {};
      specs.push({ key, label: o.label ?? humanizeKey(key), min: 0, max: 1, step: 1, bool: true });
    } else if (typeof value === 'number') {
      const base = heuristicSpec(key);
      const o = PARAM_OVERRIDES[key] ?? {};
      specs.push({ key, label: o.label ?? humanizeKey(key), ...base, ...o });
    }
  }
  return specs;
}

/** UI descriptors for the KS scalar params (extensions grouped after basics). */
export const KS_PARAM_SPECS: ParamSpec[] = [
  { key: 'brightness', label: 'Brightness', min: 0, max: 1, step: 0.01 },
  { key: 'decayS', label: 'Decay', min: 0.05, max: 12, step: 0.05, unit: 's' },
  { key: 'decayStretch', label: 'Decay stretch', min: 0, max: 1, step: 0.01 },
  { key: 'pickPosition', label: 'Pick position', min: 0, max: 0.5, step: 0.005 },
  { key: 'excBrightness', label: 'Exc brightness', min: 0, max: 1, step: 0.01 },
  { key: 'velToBrightness', label: 'Vel → bright', min: 0, max: 1, step: 0.01 },
  { key: 'releaseDampS', label: 'Release damp', min: 0.01, max: 1, step: 0.01, unit: 's' },
  { key: 'slap', label: 'Fret slap', min: 0, max: 1, step: 0.01 },
  { key: 'polarization', label: 'Polarization', min: 0, max: 1, step: 0.01 },
  { key: 'bodyCoupling', label: 'Bridge couple', min: 0, max: 1, step: 0.01 },
  { key: 'pluckStyle', label: 'Pluck style', min: 0, max: 1, step: 0.01 },
  { key: 'nail', label: 'Nail', min: 0, max: 1, step: 0.01 },
  { key: 'pickupPos', label: 'Pickup pos', min: 0, max: 0.5, step: 0.005 },
  { key: 'dispersion', label: 'Dispersion', min: 0, max: 1, step: 0.01 },
  { key: 'tensionMod', label: 'Tension mod', min: 0, max: 1, step: 0.01 },
  { key: 'octaveMix', label: "Octave 4'", min: 0, max: 1, step: 0.01 },
  { key: 'keyoffNoise', label: 'Key-off noise', min: 0, max: 1, step: 0.01 },
];

/** UI descriptors for the modal scalar params (mode table edited separately). */
export const MODAL_PARAM_SPECS: ParamSpec[] = [
  { key: 'decayS', label: 'Decay', min: 0.01, max: 12, step: 0.05, unit: 's' },
  { key: 'decayStretch', label: 'Decay stretch', min: 0, max: 1, step: 0.01 },
  { key: 'strikeBrightness', label: 'Mallet hardness', min: 0, max: 1, step: 0.01 },
  { key: 'velToBrightness', label: 'Vel → hardness', min: 0, max: 1, step: 0.01 },
  { key: 'releaseDampS', label: 'Release damp', min: 0.01, max: 2, step: 0.01, unit: 's' },
];

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
