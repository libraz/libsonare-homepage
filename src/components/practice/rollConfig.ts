/**
 * Shared geometry + timing constants for the Piano Practice roll.
 *
 * Both the 2D structure canvas (PianoPracticeDemo) and the WebGL effect overlay
 * (PracticeRollFx) derive their coordinates from these, so the falling bars and
 * the glowing sparks/beams land on exactly the same strike line.
 */

/** How far into the future (seconds) the roll shows above the strike line. */
export const LOOKAHEAD_SEC = 2.4;
/**
 * Count-in: the playhead starts this far in the past so the roll begins
 * completely empty and the notes scroll in from the very top. It must exceed
 * {@link LOOKAHEAD_SEC} so even the first note sits above the visible area at
 * the start (the difference is the empty "get ready" beat before it enters).
 */
export const LEAD_IN_SEC = 3.2;
/** Strike line position, as a fraction of the roll height. */
export const HIT_RATIO = 0.85;
/** Falling-bar width as a fraction of its key lane (slimmer than the key). */
export const NOTE_WIDTH = 0.66;
/** Lifetime of a landing spark burst (seconds). */
export const SPARK_SEC = 0.5;
/** Sparks emitted per landed note. */
export const SPARKS = 6;
/** Strike-flash / ring lifetime once a note lands (seconds). */
export const FLASH_SEC = 0.18;
/** Height of the upward light beam over a struck key (pixels). */
export const BEAM_PX = 72;

/**
 * Deterministic pseudo-random in [0, 1). Seeding spark trajectories by note +
 * index (rather than Math.random) keeps each burst identical across repaints,
 * so seeking or pausing on a landed note shows a stable picture.
 */
export function rand2(seed: number, k: number): number {
  let x = (seed * 374761393 + k * 668265263) >>> 0;
  x = ((x ^ (x >>> 13)) * 1274126177) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

/**
 * Pitch → RGB (0..1) along the keyboard: deep violet (low) → blue (high),
 * matching the 2D bars' `noteHsl` ramp. Returns a reusable tuple target.
 */
export function pitchRgb(pitchNorm: number, isDark: boolean, out: [number, number, number]): void {
  const h = (262 - pitchNorm * 66) / 360;
  const s = isDark ? 0.78 : 0.66;
  const l = isDark ? 0.62 : 0.52;
  hslToRgb(h, s, l, out);
}

function hue2(p: number, q: number, t: number): number {
  let tt = t;
  if (tt < 0) tt += 1;
  if (tt > 1) tt -= 1;
  if (tt < 1 / 6) return p + (q - p) * 6 * tt;
  if (tt < 1 / 2) return q;
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
  return p;
}

/** Standard HSL→RGB (all components 0..1), writing into `out`. */
export function hslToRgb(h: number, s: number, l: number, out: [number, number, number]): void {
  if (s === 0) {
    out[0] = out[1] = out[2] = l;
    return;
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  out[0] = hue2(p, q, h + 1 / 3);
  out[1] = hue2(p, q, h);
  out[2] = hue2(p, q, h - 1 / 3);
}
