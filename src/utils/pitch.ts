/**
 * Musical pitch naming shared by the keyboard, roll and analyzer demos.
 *
 * `NOTE_NAMES` is the 12-entry chromatic pitch-class table (index = MIDI note
 * mod 12); `formatNoteName` turns a MIDI note number into its name + octave.
 * Not `utils/scale.ts` — that module maps values onto an axis scale, not
 * pitch classes onto note names.
 */

/** The 12 pitch-class names, indexed by MIDI note number mod 12. */
export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** Formats a MIDI note number as name + octave (MIDI 60 = C4). */
export function formatNoteName(note: number): string {
  return `${NOTE_NAMES[((note % 12) + 12) % 12]}${Math.floor(note / 12) - 1}`;
}
