/**
 * Keybed proportions shared by every on-screen piano in the demos.
 *
 * Taken from an acoustic piano (white key 23.5 × 150 mm, black key about
 * 13.7 × 95 mm) with the white key shortened for a screen. A keyboard sizes its
 * white keys inside [whiteMinPx, whiteMaxPx] and derives every other dimension
 * from the white-key width, so two demos never disagree on what a key looks like.
 */
export const KEY_GEOMETRY = {
  /** Narrowest white key that stays playable by touch. */
  whiteMinPx: 20,
  /** Widest white key; wider keybeds read as stretched. */
  whiteMaxPx: 34,
  /** White-key length over its width. */
  whiteAspect: 4.2,
  /** Black-key width over the white-key width. */
  blackWidthRatio: 0.58,
  /** Black-key length over the white-key length. */
  blackLengthRatio: 0.63,
} as const;

/** White-key width for `whiteCount` keys in `availablePx`, clamped to the shared range. */
export function whiteKeyWidth(availablePx: number, whiteCount: number): number {
  const fit = whiteCount > 0 ? availablePx / whiteCount : KEY_GEOMETRY.whiteMaxPx;
  return Math.min(KEY_GEOMETRY.whiteMaxPx, Math.max(KEY_GEOMETRY.whiteMinPx, fit));
}

/** The geometry as CSS custom properties, for a keyboard laid out in CSS. */
export const KEY_GEOMETRY_STYLE = {
  '--key-white-min': `${KEY_GEOMETRY.whiteMinPx}px`,
  '--key-white-max': `${KEY_GEOMETRY.whiteMaxPx}px`,
  '--key-white-aspect': String(KEY_GEOMETRY.whiteAspect),
  '--key-black-width': String(KEY_GEOMETRY.blackWidthRatio),
  '--key-black-length': String(KEY_GEOMETRY.blackLengthRatio),
} as const;
