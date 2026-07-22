import { describe, expect, it } from 'vitest';
import {
  buildKeyboard,
  isBlackKey,
  keyCenterRatio,
  keyWidthRatio,
} from '@/components/practice/keyboard';

describe('practice keyboard geometry', () => {
  it('classifies accidental pitch classes as black keys', () => {
    // C D E F G A B are white; C# D# F# G# A# are black.
    expect([60, 62, 64, 65, 67, 69, 71].map(isBlackKey)).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
      false,
    ]);
    expect([61, 63, 66, 68, 70].map(isBlackKey)).toEqual([true, true, true, true, true]);
    // Negative MIDI numbers wrap correctly (C#-ish at -11).
    expect(isBlackKey(-11)).toBe(true);
    expect(isBlackKey(-12)).toBe(false);
  });

  it('snaps a range to whole octaves (C..B) around the notes', () => {
    const layout = buildKeyboard(60, 71);
    expect(layout.lowMidi).toBe(60); // C4
    expect(layout.highMidi).toBe(71); // B4
    expect(layout.keys).toHaveLength(12);
    expect(layout.whiteKeys).toHaveLength(7);
    expect(layout.blackKeys).toHaveLength(5);
    expect(layout.whiteCount).toBe(7);
  });

  it('expands a partial range outward to the enclosing octave boundaries', () => {
    // 62..69 must still snap down to C4 and up to B4.
    const layout = buildKeyboard(62, 69);
    expect(layout.lowMidi).toBe(60);
    expect(layout.highMidi).toBe(71);
    // A range spanning two octaves gives 14 white keys.
    const two = buildKeyboard(59, 60);
    expect(two.lowMidi).toBe(48);
    expect(two.highMidi).toBe(71);
    expect(two.whiteCount).toBe(14);
  });

  it('places white-key centers at column midpoints and black keys on the boundary', () => {
    const layout = buildKeyboard(60, 71);
    const c4 = layout.keys.find((k) => k.midi === 60)!; // whiteIndex 0
    const cs4 = layout.keys.find((k) => k.midi === 61)!; // black after C
    const b4 = layout.keys.find((k) => k.midi === 71)!; // whiteIndex 6
    expect(keyCenterRatio(c4, layout.whiteCount)).toBeCloseTo(0.5 / 7);
    expect(keyCenterRatio(b4, layout.whiteCount)).toBeCloseTo(6.5 / 7);
    // A black key straddles the boundary after its preceding white key.
    expect(keyCenterRatio(cs4, layout.whiteCount)).toBeCloseTo(1 / 7);
  });

  it('sizes white lanes wider than black lanes, scaled to the white count', () => {
    const layout = buildKeyboard(60, 71);
    const c4 = layout.keys.find((k) => k.midi === 60)!;
    const cs4 = layout.keys.find((k) => k.midi === 61)!;
    expect(keyWidthRatio(c4, layout.whiteCount)).toBeCloseTo(0.92 / 7);
    expect(keyWidthRatio(cs4, layout.whiteCount)).toBeCloseTo(0.62 / 7);
  });
});
