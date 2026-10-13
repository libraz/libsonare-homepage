// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  diffNotes,
  eventsToNotes,
  MATCH_ONSET_SEC,
  maxPolyphony,
  pitchSpan,
  type RollNote,
} from '@/demos/transcribe/transcribedNotes';
import { noteOffWord, noteOnWord } from '@/utils/ump';

const on = (ppq: number, note: number, velocity = 80) => ({
  ppq,
  data0: noteOnWord(note, velocity),
  data1: 0,
});
const off = (ppq: number, note: number) => ({ ppq, data0: noteOffWord(note), data1: 0 });
const note = (pitch: number, startSec: number, endSec = startSec + 0.2): RollNote => ({
  pitch,
  velocity: 64,
  startSec,
  endSec,
});

describe('eventsToNotes', () => {
  it('converts quarter-note positions to seconds at the grid tempo', () => {
    const notes = eventsToNotes([on(0, 60), on(1, 64), off(2, 60), off(2, 64)], 120);
    expect(notes).toEqual([
      { pitch: 60, velocity: 80, startSec: 0, endSec: 1 },
      { pitch: 64, velocity: 80, startSec: 0.5, endSec: 1 },
    ]);
  });

  it('closes a repeated pitch before reopening it at the same tick', () => {
    const notes = eventsToNotes([on(0, 60), off(1, 60), on(1, 60, 50), off(2, 60)], 60);
    expect(notes.map((n) => [n.startSec, n.endSec, n.velocity])).toEqual([
      [0, 1, 80],
      [1, 2, 50],
    ]);
  });
});

describe('diffNotes', () => {
  it('marks everything unchanged on the first run', () => {
    const diff = diffNotes(null, [note(60, 0), note(64, 0)]);
    expect(diff.kept).toBe(2);
    expect(diff.added).toBe(0);
    expect(diff.removed).toEqual([]);
  });

  it('pairs a note on the same pitch within the onset window and tags the rest', () => {
    const previous = [note(60, 0), note(64, 1), note(67, 2)];
    const current = [
      note(60, MATCH_ONSET_SEC * 0.5),
      note(64, 1 + MATCH_ONSET_SEC * 2),
      note(72, 3),
    ];
    const diff = diffNotes(previous, current);
    expect(diff.current.map((n) => n.change)).toEqual(['kept', 'added', 'added']);
    expect(diff.removed.map((n) => n.pitch)).toEqual([64, 67]);
    expect(diff.kept).toBe(1);
    expect(diff.added).toBe(2);
  });

  it('pairs each previous note at most once, nearest first', () => {
    const previous = [note(60, 1)];
    const current = [note(60, 1.03), note(60, 1.01)];
    const diff = diffNotes(previous, current);
    expect(diff.current.map((n) => n.change)).toEqual(['kept', 'added']);
    expect(diff.removed).toEqual([]);
  });

  it('does not pair across pitches', () => {
    const diff = diffNotes([note(60, 0)], [note(61, 0)]);
    expect(diff.added).toBe(1);
    expect(diff.removed).toHaveLength(1);
  });
});

describe('roll helpers', () => {
  it('counts the most notes sounding at once, with a touching end and start not overlapping', () => {
    expect(maxPolyphony([note(60, 0, 1), note(64, 0.5, 1.5), note(67, 1, 2)])).toBe(2);
    expect(maxPolyphony([])).toBe(0);
  });

  it('pads the pitch span and keeps it at least two octaves', () => {
    expect(pitchSpan([note(60, 0)])).toEqual({ low: 48, high: 72 });
    expect(pitchSpan([note(30, 0), note(90, 0)])).toEqual({ low: 28, high: 92 });
  });
});
