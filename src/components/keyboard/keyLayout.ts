/**
 * One playable key in the demo keyboard: its semitone offset above the lowest
 * C of the active octave range and whether it is a black (accidental) key.
 */
export interface KeyDef {
  /** Semitone offset above the range's base C. */
  semitone: number;
  /** True for sharp/flat keys (rendered as raised black keys). */
  black: boolean;
  /** Computer-keyboard character mapped to this key, if any. */
  pc?: string;
}

/**
 * Two-octave keyboard layout (C..B over two octaves) with the standard
 * tracker/DAW computer-keyboard mapping over the lower octave-and-a-bit.
 */
export const KEY_LAYOUT: KeyDef[] = [
  { semitone: 0, black: false, pc: 'a' },
  { semitone: 1, black: true, pc: 'w' },
  { semitone: 2, black: false, pc: 's' },
  { semitone: 3, black: true, pc: 'e' },
  { semitone: 4, black: false, pc: 'd' },
  { semitone: 5, black: false, pc: 'f' },
  { semitone: 6, black: true, pc: 't' },
  { semitone: 7, black: false, pc: 'g' },
  { semitone: 8, black: true, pc: 'y' },
  { semitone: 9, black: false, pc: 'h' },
  { semitone: 10, black: true, pc: 'u' },
  { semitone: 11, black: false, pc: 'j' },
  { semitone: 12, black: false, pc: 'k' },
  { semitone: 13, black: true },
  { semitone: 14, black: false },
  { semitone: 15, black: true },
  { semitone: 16, black: false },
  { semitone: 17, black: false },
  { semitone: 18, black: true },
  { semitone: 19, black: false },
  { semitone: 20, black: true },
  { semitone: 21, black: false },
  { semitone: 22, black: true },
  { semitone: 23, black: false },
];
