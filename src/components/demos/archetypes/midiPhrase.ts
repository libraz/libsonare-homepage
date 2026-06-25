/**
 * The shared three-voice MIDI phrase behind the `piano-roll` and `score` demos.
 *
 * Both demos render the SAME notes — one as a DAW grid, one as a grand-staff
 * engraving — so the phrase lives here once and is imported by both. It is a
 * two-bar phrase in C major over a I–vi–IV–V bass: a melody, a broken-chord
 * accompaniment, and the chord roots. The accompaniment is voiced to stay in a
 * clean treble range (C4–D5) so it notates without a thicket of ledger lines.
 *
 * Each voice's notes are contiguous (no gaps), so a note's start beat is just the
 * running sum of the durations before it.
 */

/** Total length of the phrase in quarter-note beats (two 4/4 bars). */
export const PHRASE_BEATS = 8;
/** Beats per bar (4/4). */
export const PHRASE_BEATS_PER_BAR = 4;

/** Voice color hues (`r, g, b` triplets) shared with the piano-roll lanes. */
export const MELODY_HUE = '45, 212, 191'; // teal   — the lead line
export const ARP_HUE = '167, 139, 250'; //   violet — the broken-chord accompaniment
export const BASS_HUE = '34, 211, 238'; //   cyan   — the bass

/** How a voice is engraved on the grand staff. */
export interface PhraseVoice {
  role: 'melody' | 'arp' | 'bass';
  /** Staff the voice is written on. */
  clef: 'treble' | 'bass';
  /** Stem direction when sharing a staff with another voice (`auto` when alone). */
  stem: 'up' | 'down' | 'auto';
  hue: string;
  /** MIDI velocity for every note in the voice. */
  velocity: number;
  /** Notes as `[midiNote, durationBeats]`, laid end to end from beat 0. */
  notes: Array<[number, number]>;
}

export const PHRASE_VOICES: PhraseVoice[] = [
  {
    // Melody — a quarter-note line over the progression, the loudest voice.
    role: 'melody',
    clef: 'treble',
    stem: 'up',
    hue: MELODY_HUE,
    velocity: 108,
    notes: [
      [79, 1], [76, 1], [81, 1], [77, 1], // G5 E5 A5 F5
      [79, 1], [76, 1], [77, 1], [72, 1], // G5 E5 F5 C5
    ],
  },
  {
    // Accompaniment — eighth-note broken chords: C, Am, F, G (two beats each),
    // kept within C4–D5 so it reads cleanly as the treble staff's lower voice.
    role: 'arp',
    clef: 'treble',
    stem: 'down',
    hue: ARP_HUE,
    velocity: 74,
    notes: [
      [60, 0.5], [64, 0.5], [67, 0.5], [64, 0.5], // C : C4 E4 G4 E4
      [60, 0.5], [64, 0.5], [69, 0.5], [64, 0.5], // Am: C4 E4 A4 E4
      [65, 0.5], [69, 0.5], [72, 0.5], [69, 0.5], // F : F4 A4 C5 A4
      [67, 0.5], [71, 0.5], [74, 0.5], [71, 0.5], // G : G4 B4 D5 B4
    ],
  },
  {
    // Bass — the chord roots, one per half bar.
    role: 'bass',
    clef: 'bass',
    stem: 'auto',
    hue: BASS_HUE,
    velocity: 84,
    notes: [
      [48, 2], [45, 2], [53, 2], [55, 2], // C3 A2 F3 G3
    ],
  },
];

const PITCH_CLASS = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];

/** MIDI note number → VexFlow key, e.g. 60 → `c/4` (middle C). */
export function midiToVexKey(midi: number): string {
  const pc = PITCH_CLASS[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${pc}/${octave}`;
}

/** Duration in beats → VexFlow duration code (quarter = 1; a trailing `d` dots it). */
export function durationCode(durBeat: number): string {
  switch (durBeat) {
    case 4: return 'w';
    case 3: return 'hd';
    case 2: return 'h';
    case 1.5: return 'qd';
    case 1: return 'q';
    case 0.75: return '8d';
    case 0.5: return '8';
    case 0.25: return '16';
    default: return 'q';
  }
}

/** One scheduled note resolved to an absolute start beat. */
export interface TimedNote {
  midi: number;
  startBeat: number;
  durBeat: number;
  velocity: number;
}

/** Resolve a voice's contiguous notes to absolute start beats. */
export function timedNotes(voice: PhraseVoice): TimedNote[] {
  let beat = 0;
  return voice.notes.map(([midi, durBeat]) => {
    const note: TimedNote = { midi, startBeat: beat, durBeat, velocity: voice.velocity };
    beat += durBeat;
    return note;
  });
}
