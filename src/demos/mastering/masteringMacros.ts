/**
 * The Quick-mode fine-tune macros. Each macro is an operation on the same
 * project state Studio edits: it rewrites one or two insert parameters from
 * the genre preset's value, expressed as chain-config keys so the preset map
 * places them.
 *
 * | Macro    | Range         | Writes                                                         |
 * |----------|---------------|----------------------------------------------------------------|
 * | tone     | -3..+3        | `eq.tilt.tiltDb` = preset + tone                               |
 * | width    | 0.8..1.3      | `stereo.imager.width` = width                                  |
 * | dynamics | -1..+1        | compressor threshold = preset + 6·m, ratio = preset·(1−0.3·m) ≥ 1 |
 * | ceiling  | -3..-0.1 dBTP | `maximizer.truePeakLimiter.ceilingDb` = ceiling                |
 */

export type MasteringMacroId = 'tone' | 'width' | 'dynamics' | 'ceiling';

/** Current position of each macro. */
export interface MasteringMacros {
  tone: number;
  width: number;
  dynamics: number;
  ceiling: number;
}

export interface MasteringMacroRange {
  min: number;
  max: number;
  step: number;
}

export const MASTERING_MACROS: Readonly<Record<MasteringMacroId, MasteringMacroRange>> = {
  tone: { min: -3, max: 3, step: 0.1 },
  width: { min: 0.8, max: 1.3, step: 0.01 },
  dynamics: { min: -1, max: 1, step: 0.05 },
  ceiling: { min: -3, max: -0.1, step: 0.1 },
};

const TILT = 'eq.tilt.tiltDb';
const WIDTH = 'stereo.imager.width';
const THRESHOLD = 'dynamics.compressor.thresholdDb';
const RATIO = 'dynamics.compressor.ratio';
const CEILING = 'maximizer.truePeakLimiter.ceilingDb';

type ChainParams = Readonly<Record<string, number | boolean>>;

const num = (params: ChainParams, key: string, fallback: number): number => {
  const value = params[key];
  return typeof value === 'number' ? value : fallback;
};

const clampTo = (range: MasteringMacroRange, value: number) =>
  Math.min(range.max, Math.max(range.min, value));

/** Macro positions that leave the preset values untouched. */
export function neutralMacros(preset: ChainParams): MasteringMacros {
  return {
    tone: 0,
    width: clampTo(MASTERING_MACROS.width, num(preset, WIDTH, 1)),
    dynamics: 0,
    ceiling: clampTo(MASTERING_MACROS.ceiling, num(preset, CEILING, -1)),
  };
}

/**
 * Chain-config values the macros produce over the preset's `preset` values;
 * `only` limits the result to the keys one macro drives.
 */
export function macroChainParams(
  preset: ChainParams,
  macros: MasteringMacros,
  only?: MasteringMacroId,
): Record<string, number> {
  const out: Record<string, number> = {};
  const wants = (id: MasteringMacroId) => only === undefined || only === id;
  if (wants('tone')) out[TILT] = num(preset, TILT, 0) + macros.tone;
  if (wants('width')) out[WIDTH] = macros.width;
  if (wants('dynamics')) {
    out[THRESHOLD] = num(preset, THRESHOLD, -18) + 6 * macros.dynamics;
    out[RATIO] = Math.max(1, num(preset, RATIO, 2) * (1 - 0.3 * macros.dynamics));
  }
  if (wants('ceiling')) out[CEILING] = macros.ceiling;
  return out;
}
