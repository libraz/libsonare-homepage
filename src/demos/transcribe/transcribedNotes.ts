/**
 * Notes as the roll draws them, read from the engine's event list, and the
 * comparison of one transcription against the one before it.
 */

/** One `transcribe` event: a UMP MIDI 1.0 word at a quarter-note position. */
export interface TranscribedEvent {
  ppq: number;
  data0: number;
  data1: number;
}

export interface RollNote {
  pitch: number;
  velocity: number;
  startSec: number;
  endSec: number;
}

export type NoteChange = 'kept' | 'added' | 'removed';

export interface NoteDiff {
  /** Current notes, each tagged `kept` or `added`. */
  current: Array<RollNote & { change: Exclude<NoteChange, 'removed'> }>;
  /** Notes of the previous run that no current note matches. */
  removed: RollNote[];
  kept: number;
  added: number;
}

/** Onset distance at which two runs' notes on one pitch count as the same note. */
export const MATCH_ONSET_SEC = 0.04;

/**
 * Pair note-ons with note-offs. The engine orders a note-off before a note-on
 * sharing its tick, so a repeated pitch closes before it reopens.
 */
export function eventsToNotes(events: readonly TranscribedEvent[], tempoBpm: number): RollNote[] {
  const secPerQuarter = 60 / tempoBpm;
  const open = new Map<number, { velocity: number; start: number }>();
  const notes: RollNote[] = [];
  for (const event of events) {
    const status = (event.data0 >>> 20) & 0xf;
    const pitch = (event.data0 >>> 8) & 0x7f;
    const velocity = event.data0 & 0x7f;
    if (status === 0x9 && velocity > 0) {
      open.set(pitch, { velocity, start: event.ppq });
    } else if (status === 0x8 || status === 0x9) {
      const on = open.get(pitch);
      if (!on) continue;
      open.delete(pitch);
      notes.push({
        pitch,
        velocity: on.velocity,
        startSec: on.start * secPerQuarter,
        endSec: event.ppq * secPerQuarter,
      });
    }
  }
  return notes.sort((a, b) => a.startSec - b.startSec || a.pitch - b.pitch);
}

/**
 * Tag every current note against the previous run: a note on the same pitch
 * starting within {@link MATCH_ONSET_SEC} is the same note; the nearest wins and
 * each previous note pairs once.
 */
export function diffNotes(
  previous: readonly RollNote[] | null,
  current: readonly RollNote[],
): NoteDiff {
  if (!previous) {
    return {
      current: current.map((note) => ({ ...note, change: 'kept' as const })),
      removed: [],
      kept: current.length,
      added: 0,
    };
  }
  const byPitch = new Map<number, number[]>();
  previous.forEach((note, index) => {
    const list = byPitch.get(note.pitch);
    if (list) list.push(index);
    else byPitch.set(note.pitch, [index]);
  });
  const used = new Uint8Array(previous.length);
  let kept = 0;
  const tagged = current.map((note) => {
    let best = -1;
    let bestDistance = MATCH_ONSET_SEC;
    for (const index of byPitch.get(note.pitch) ?? []) {
      if (used[index]) continue;
      const distance = Math.abs(previous[index].startSec - note.startSec);
      if (distance <= bestDistance) {
        best = index;
        bestDistance = distance;
      }
    }
    if (best < 0) return { ...note, change: 'added' as const };
    used[best] = 1;
    kept++;
    return { ...note, change: 'kept' as const };
  });
  const removed = previous.filter((_, index) => !used[index]);
  return { current: tagged, removed, kept, added: current.length - kept };
}

/** Most notes sounding at once. */
export function maxPolyphony(notes: readonly RollNote[]): number {
  const edges: Array<[number, number]> = [];
  for (const note of notes) edges.push([note.startSec, 1], [note.endSec, -1]);
  edges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let depth = 0;
  let peak = 0;
  for (const [, step] of edges) {
    depth += step;
    if (depth > peak) peak = depth;
  }
  return peak;
}

/** Pitch span the roll shows: the notes plus a margin, at least two octaves. */
export function pitchSpan(notes: readonly RollNote[]): { low: number; high: number } {
  if (notes.length === 0) return { low: 48, high: 72 };
  let low = 127;
  let high = 0;
  for (const note of notes) {
    if (note.pitch < low) low = note.pitch;
    if (note.pitch > high) high = note.pitch;
  }
  low -= 2;
  high += 2;
  const short = 24 - (high - low);
  if (short > 0) {
    low -= Math.floor(short / 2);
    high += Math.ceil(short / 2);
  }
  return { low: Math.max(0, low), high: Math.min(127, high) };
}
