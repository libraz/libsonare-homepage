/**
 * Shared key geometry for the Piano Practice demo.
 *
 * The falling-note canvas and the on-screen keyboard must line up pixel for
 * pixel, so both derive every horizontal coordinate from the SAME layout: white
 * keys are equal-width columns across the full range, and black keys straddle
 * the boundary after their preceding white key (60% of a column wide). Returning
 * ratios (0..1 of the inner width) lets each surface multiply by its own width.
 */

/** Pitch classes that render as black (accidental) keys. */
const BLACK_PCS = new Set([1, 3, 6, 8, 10]);

export function isBlackKey(midi: number): boolean {
  return BLACK_PCS.has(((midi % 12) + 12) % 12);
}

export interface KeyGeom {
  midi: number;
  black: boolean;
  /** Index among white keys (a black key shares its preceding white's index). */
  whiteIndex: number;
}

export interface KeyboardLayout {
  keys: KeyGeom[];
  whiteKeys: KeyGeom[];
  blackKeys: KeyGeom[];
  whiteCount: number;
  lowMidi: number;
  highMidi: number;
}

/**
 * Expand a MIDI range to whole octaves (C..B) and lay out its keys.
 *
 * @param lowestMidi Lowest note that must be visible.
 * @param highestMidi Highest note that must be visible.
 */
export function buildKeyboard(lowestMidi: number, highestMidi: number): KeyboardLayout {
  // Snap to the C at or below the low note and the B at or above the high note,
  // so the keyboard always begins and ends on a natural octave boundary.
  const lowMidi = Math.floor(lowestMidi / 12) * 12;
  const highMidi = Math.floor(highestMidi / 12) * 12 + 11;

  const keys: KeyGeom[] = [];
  let whiteIndex = -1;
  for (let midi = lowMidi; midi <= highMidi; midi++) {
    const black = isBlackKey(midi);
    if (!black) whiteIndex += 1;
    keys.push({ midi, black, whiteIndex });
  }

  return {
    keys,
    whiteKeys: keys.filter((k) => !k.black),
    blackKeys: keys.filter((k) => k.black),
    whiteCount: whiteIndex + 1,
    lowMidi,
    highMidi,
  };
}

/** Horizontal center of a key as a 0..1 ratio of the inner width. */
export function keyCenterRatio(key: KeyGeom, whiteCount: number): number {
  return key.black ? (key.whiteIndex + 1) / whiteCount : (key.whiteIndex + 0.5) / whiteCount;
}

/** Width of a key (or its falling-note lane) as a 0..1 ratio of the inner width. */
export function keyWidthRatio(key: KeyGeom, whiteCount: number): number {
  return (key.black ? 0.62 : 0.92) / whiteCount;
}
