import { describe, expect, it } from 'vitest';
import { buildBouncePayload } from '@/components/practice/bounceClient';
import type { ParsedMidi } from '@/components/practice/midiSmf';

const midi = {
  notes: [
    { midi: 60, velocity: 100, startSec: 0, endSec: 0.5, startBeat: 0, endBeat: 1 },
    { midi: 64, velocity: 80, startSec: 0.5, endSec: 1, startBeat: 1, endBeat: 2 },
  ],
  tempoSegments: [{ startBeat: 0, bpm: 120 }],
  durationSec: 1,
  durationBeats: 2,
} as unknown as ParsedMidi;

describe('buildBouncePayload', () => {
  it('flattens a movement into a serializable, transferable-friendly worker payload', () => {
    const payload = buildBouncePayload(midi, {
      source: 'synth',
      sf2Url: '/sf2/acoustic-grand.sf2',
      synthPreset: 'acoustic-piano',
      sampleRate: 44_100,
      speed: 0.75,
      tailSec: 1.6,
    });
    expect(payload.source).toBe('synth');
    expect(payload.speed).toBe(0.75);
    expect(payload.durationBeats).toBe(2);
    // Only the beat-timed fields the worker needs are carried over per note.
    expect(payload.notes).toEqual([
      { midi: 60, velocity: 100, startBeat: 0, endBeat: 1 },
      { midi: 64, velocity: 80, startBeat: 1, endBeat: 2 },
    ]);
    expect(payload.tempoSegments).toEqual([{ startBeat: 0, bpm: 120 }]);
    // The payload is a fresh structure — mutating it must not touch the source midi.
    payload.notes[0].midi = 0;
    expect(midi.notes[0].midi).toBe(60);
  });
});
