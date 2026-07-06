/**
 * Perceptual macro controls for the physical-model tuner.
 *
 * The deep `*PatchParams` fields are physically meaningful but hard to aim with:
 * you know the sound you want, not which of a dozen scalars gets you there. Each
 * macro is one intuitive axis ("brightness", "attack", "breathiness") that sweeps
 * a small, disjoint set of underlying params together along a fixed curve, so a
 * single slider moves the voice in a perceptually coherent direction.
 *
 * A macro owns its params exclusively within an engine (no two macros of the same
 * engine touch the same field), so the mapping is invertible: a macro's slider
 * position is always DERIVED from its primary (first) param. The params stay the
 * single source of truth — dragging the slider writes them, editing a param in
 * the advanced panel re-derives the slider. Macro values are normalized to [0,1].
 */
import type { PhysicalEngineMode } from './params';

/** One underlying param swept by a macro: `value = lerp(at0, at1, macro)`. */
export interface MacroParamMap {
  key: string;
  /** Param value when the macro is at 0 (`at0 > at1` inverts the axis). */
  at0: number;
  /** Param value when the macro is at 1. */
  at1: number;
}

/** A perceptual macro: an id plus the params it drives (first = primary). */
export interface MacroDef {
  id: string;
  params: MacroParamMap[];
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * The macro map for each engine. Ranges are chosen so a 0..1 sweep spans a
 * musically useful span of each field (see the per-model `default*Params` and the
 * voice-core field docs). Primary param first — it drives the slider readout.
 */
export const MACROS: Record<PhysicalEngineMode, MacroDef[]> = {
  'karplus-strong': [
    {
      id: 'tone',
      params: [
        { key: 'brightness', at0: 0.2, at1: 1 },
        { key: 'excBrightness', at0: 0.5, at1: 1 },
      ],
    },
    {
      id: 'sustain',
      params: [
        { key: 'decayS', at0: 0.3, at1: 8 },
        { key: 'decayStretch', at0: 0.2, at1: 0.7 },
      ],
    },
    { id: 'pluckPos', params: [{ key: 'pickPosition', at0: 0.02, at1: 0.4 }] },
    {
      id: 'bite',
      params: [
        { key: 'pluckStyle', at0: 0, at1: 1 },
        { key: 'slap', at0: 0, at1: 0.5 },
        { key: 'nail', at0: 0, at1: 0.6 },
      ],
    },
    {
      id: 'body',
      params: [
        { key: 'bodyCoupling', at0: 0, at1: 1 },
        { key: 'octaveMix', at0: 0, at1: 0.4 },
      ],
    },
  ],
  'bowed-string': [
    { id: 'pressure', params: [{ key: 'bowForce', at0: 0.15, at1: 0.85 }] },
    {
      id: 'tone',
      params: [
        { key: 'brightness', at0: 0.2, at1: 0.9 },
        { key: 'damping', at0: 0.7, at1: 0.2 },
      ],
    },
    { id: 'attack', params: [{ key: 'attackMs', at0: 220, at1: 10 }] },
    { id: 'bowPos', params: [{ key: 'bowPosition', at0: 0.05, at1: 0.3 }] },
    { id: 'rosin', params: [{ key: 'rosin', at0: 0, at1: 1 }] },
  ],
  piano: [
    { id: 'tone', params: [{ key: 'brightness', at0: 0.3, at1: 1 }] },
    {
      id: 'hammer',
      params: [
        { key: 'hammerExponent', at0: 3.5, at1: 1.5 },
        { key: 'hammerContactMs', at0: 3, at1: 0.6 },
      ],
    },
    {
      id: 'sustain',
      params: [
        { key: 'decaySlowS', at0: 4, at1: 16 },
        { key: 'decayFastS', at0: 1, at1: 5 },
      ],
    },
    { id: 'detune', params: [{ key: 'detuneCents', at0: 0, at1: 8 }] },
    { id: 'board', params: [{ key: 'soundboard', at0: 0, at1: 0.6 }] },
  ],
  modal: [
    { id: 'hardness', params: [{ key: 'strikeBrightness', at0: 0.2, at1: 1 }] },
    { id: 'sustain', params: [{ key: 'decayS', at0: 0.2, at1: 8 }] },
    { id: 'stretch', params: [{ key: 'decayStretch', at0: 0, at1: 1 }] },
  ],
  percussion: [
    { id: 'pitch', params: [{ key: 'baseFreqHz', at0: 40, at1: 400 }] },
    { id: 'decay', params: [{ key: 'modeDecayS', at0: 0.05, at1: 2 }] },
    { id: 'noise', params: [{ key: 'noiseGain', at0: 0, at1: 1 }] },
    { id: 'noiseTone', params: [{ key: 'noiseCutoffHz', at0: 500, at1: 8000 }] },
    { id: 'shell', params: [{ key: 'shellMix', at0: 0, at1: 0.8 }] },
  ],
  'pipe-organ': [
    { id: 'tone', params: [{ key: 'brightness', at0: 0.2, at1: 0.9 }] },
    { id: 'airflow', params: [{ key: 'breath', at0: 0.2, at1: 0.6 }] },
    { id: 'reed', params: [{ key: 'reed', at0: 0, at1: 1 }] },
    { id: 'chiff', params: [{ key: 'chiff', at0: 0, at1: 1 }] },
    {
      id: 'tremulant',
      params: [
        { key: 'tremulantDepth', at0: 0, at1: 0.6 },
        { key: 'tremulantRateHz', at0: 4.5, at1: 6 },
      ],
    },
  ],
  reed: [
    { id: 'breath', params: [{ key: 'breathPressure', at0: 0.3, at1: 0.9 }] },
    {
      id: 'tone',
      params: [
        { key: 'brightness', at0: 0.2, at1: 0.9 },
        { key: 'damping', at0: 0.7, at1: 0.2 },
      ],
    },
    { id: 'stiffness', params: [{ key: 'reedStiffness', at0: 0.2, at1: 0.9 }] },
    { id: 'breathiness', params: [{ key: 'breathNoise', at0: 0, at1: 0.4 }] },
    { id: 'chiff', params: [{ key: 'chiff', at0: 0, at1: 0.8 }] },
  ],
  brass: [
    { id: 'breath', params: [{ key: 'breathPressure', at0: 0.4, at1: 1 }] },
    {
      id: 'brilliance',
      params: [
        { key: 'brassiness', at0: 0, at1: 1 },
        { key: 'brightness', at0: 0.3, at1: 0.9 },
      ],
    },
    { id: 'lip', params: [{ key: 'lipTension', at0: 0.2, at1: 0.9 }] },
    { id: 'attack', params: [{ key: 'attackMs', at0: 120, at1: 10 }] },
    { id: 'mute', params: [{ key: 'mute', at0: 0, at1: 1 }] },
  ],
  flute: [
    { id: 'breath', params: [{ key: 'breathPressure', at0: 0.3, at1: 0.85 }] },
    {
      id: 'tone',
      params: [
        { key: 'brightness', at0: 0.2, at1: 0.9 },
        { key: 'damping', at0: 0.6, at1: 0.15 },
      ],
    },
    { id: 'breathiness', params: [{ key: 'breathNoise', at0: 0, at1: 0.4 }] },
    { id: 'jet', params: [{ key: 'jetRatio', at0: 0.3, at1: 0.7 }] },
    {
      id: 'vibrato',
      params: [
        { key: 'vibratoDepth', at0: 0, at1: 0.5 },
        { key: 'vibratoRateHz', at0: 4.5, at1: 6 },
      ],
    },
  ],
  'plucked-string': [
    {
      id: 'tone',
      params: [
        { key: 'brightness', at0: 0.2, at1: 1 },
        { key: 'excBrightness', at0: 0.5, at1: 1 },
      ],
    },
    {
      id: 'sustain',
      params: [
        { key: 'decayS', at0: 0.5, at1: 8 },
        { key: 'decayStretch', at0: 0.2, at1: 0.7 },
      ],
    },
    { id: 'pluckPos', params: [{ key: 'pickPosition', at0: 0.02, at1: 0.4 }] },
    { id: 'buzz', params: [{ key: 'buzz', at0: 0, at1: 1 }] },
  ],
  vocal: [
    { id: 'tone', params: [{ key: 'brightness', at0: 0.15, at1: 1 }] },
    { id: 'breathiness', params: [{ key: 'breathNoise', at0: 0, at1: 0.6 }] },
    { id: 'attack', params: [{ key: 'attackMs', at0: 200, at1: 8 }] },
    {
      id: 'vibrato',
      params: [
        { key: 'vibratoDepth', at0: 0, at1: 0.7 },
        { key: 'vibratoRateHz', at0: 4.5, at1: 6.5 },
      ],
    },
  ],
  'free-reed': [
    { id: 'breath', params: [{ key: 'breathPressure', at0: 0.3, at1: 0.95 }] },
    { id: 'tone', params: [{ key: 'brightness', at0: 0.2, at1: 0.95 }] },
    { id: 'stiffness', params: [{ key: 'reedStiffness', at0: 0.2, at1: 0.9 }] },
    { id: 'detune', params: [{ key: 'detune', at0: 0, at1: 1 }] },
    { id: 'breathiness', params: [{ key: 'breathNoise', at0: 0, at1: 0.3 }] },
  ],
};

/** Macro list for an engine (empty for engines with no macro map). */
export function macrosFor(mode: PhysicalEngineMode): MacroDef[] {
  return MACROS[mode] ?? [];
}

/**
 * The param patch for setting `def` to `value` (0..1): every mapped field placed
 * on its curve. Returned as a plain object to merge into the active params.
 */
export function applyMacro(def: MacroDef, value: number): Record<string, number> {
  const t = clamp01(value);
  const patch: Record<string, number> = {};
  for (const p of def.params) patch[p.key] = lerp(p.at0, p.at1, t);
  return patch;
}

/**
 * Derive a macro's slider position (0..1) from the current params, using its
 * primary field. `at0 === at1` (a degenerate map) yields 0.
 */
export function deriveMacroValue(params: Record<string, unknown>, def: MacroDef): number {
  const primary = def.params[0];
  if (!primary || primary.at0 === primary.at1) return 0;
  const raw = Number(params[primary.key] ?? primary.at0);
  return clamp01((raw - primary.at0) / (primary.at1 - primary.at0));
}
