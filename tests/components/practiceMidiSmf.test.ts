import { describe, expect, it } from 'vitest';
import { MidiParseError, parseMidi } from '@/components/practice/midiSmf';

/** MIDI variable-length quantity encoding. */
function vlq(value: number): number[] {
  const out = [value & 0x7f];
  let v = value >> 7;
  while (v > 0) {
    out.unshift((v & 0x7f) | 0x80);
    v >>= 7;
  }
  return out;
}

/** Wrap a track body in an MThd + MTrk container (format 0, 480 ppq). */
function smf(trackBody: number[]): Uint8Array {
  const header = [
    0x4d,
    0x54,
    0x68,
    0x64, // 'MThd'
    0x00,
    0x00,
    0x00,
    0x06, // length 6
    0x00,
    0x00, // format 0
    0x00,
    0x01, // 1 track
    0x01,
    0xe0, // division 480
  ];
  const len = trackBody.length;
  const track = [
    0x4d,
    0x54,
    0x72,
    0x6b, // 'MTrk'
    (len >> 24) & 0xff,
    (len >> 16) & 0xff,
    (len >> 8) & 0xff,
    len & 0xff,
    ...trackBody,
  ];
  return new Uint8Array([...header, ...track]);
}

// One note (C4, 1 beat long) followed by a single 90 BPM tempo event at beat 2 —
// i.e. the tempo map does NOT start at tick 0. 90 BPM = 666667 µs/quarter = 0x0A2C2B.
const trackBody = [
  ...vlq(0),
  0x90,
  0x3c,
  0x64, // note-on C4 vel 100 @ tick 0
  ...vlq(480),
  0x80,
  0x3c,
  0x00, // note-off @ tick 480
  ...vlq(480),
  0xff,
  0x51,
  0x03,
  0x0a,
  0x2c,
  0x2b, // tempo 90 BPM @ tick 960 (beat 2)
  ...vlq(0),
  0xff,
  0x2f,
  0x00, // end of track
];

describe('midiSmf parser', () => {
  it('parses a single-track file into notes and a tempo map', () => {
    const parsed = parseMidi(smf(trackBody));
    expect(parsed.notes).toHaveLength(1);
    expect(parsed.notes[0].midi).toBe(60);
    expect(parsed.notes[0].velocity).toBe(100);
    expect(parsed.ticksPerBeat).toBe(480);
    expect(parsed.durationSec).toBeGreaterThan(0);
  });

  it('does not inject a phantom 120 BPM segment for a non-zero-start tempo map (L-17)', () => {
    const parsed = parseMidi(smf(trackBody));
    // Only the real 90 BPM event should survive — no leaked implicit-120 head.
    expect(parsed.tempoSegments).toHaveLength(1);
    expect(parsed.tempoSegments[0].startBeat).toBe(2);
    expect(parsed.tempoSegments[0].bpm).toBeCloseTo(90, 1);
  });

  it('throws MidiParseError (not a raw RangeError) on a truncated file (L-19)', () => {
    const full = smf(trackBody);
    // Cut into the middle of the track so a multi-byte read runs off the end.
    const truncated = full.slice(0, full.length - 3);
    expect(() => parseMidi(truncated)).toThrow(MidiParseError);
    // A stub too short even for the header is rejected the same way.
    expect(() => parseMidi(full.slice(0, 10))).toThrow(MidiParseError);
  });

  it('rejects a non-MIDI blob with MidiParseError', () => {
    expect(() =>
      parseMidi(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14])),
    ).toThrow(MidiParseError);
  });
});
