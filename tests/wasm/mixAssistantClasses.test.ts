// @vitest-environment node
import { describe, expect, it } from 'vitest';
import * as wasm from '@/wasm/index.js';

/**
 * The mixing-assistant page warns that sustained synthesized parts classify as
 * `vocal` and a whole-kit drum stem as `tom`, and that naming the track drops
 * the wrong class under the confidence gate. These render such stems with the
 * engine's own synthesizer and hold the warning to what the classifier does.
 */

const SAMPLE_RATE = 48_000;
const GATE = 0.5;

type Note = [beat: number, note: number, beats: number, velocity: number];

function stem(preset: string, notes: Note[]) {
  const project = new wasm.Project();
  try {
    project.setSampleRate(SAMPLE_RATE);
    project.setTempoSegments([{ startPpq: 0, bpm: 110 }]);
    const { clipId } = project.addMidiClip(0, 16);
    project.setMidiEvents(
      clipId,
      notes.flatMap(([beat, note, beats, velocity]) => [
        wasm.Project.midiNoteOn(beat, 0, 0, note, velocity),
        wasm.Project.midiNoteOff(beat + beats, 0, 0, note, 0),
      ]),
    );
    const interleaved = project.bounceWithSynthInstrument(preset, {
      numChannels: 2,
      sampleRate: SAMPLE_RATE,
    });
    const frames = interleaved.length / 2;
    const left = new Float32Array(frames);
    const right = new Float32Array(frames);
    for (let i = 0; i < frames; i++) {
      left[i] = interleaved[2 * i];
      right[i] = interleaved[2 * i + 1];
    }
    return { left, right };
  } finally {
    project.delete();
  }
}

const chords = [
  [60, 64, 67],
  [60, 64, 67],
  [65, 69, 72],
  [67, 71, 74],
];

function stems() {
  const groove: Note[] = [];
  for (let beat = 0; beat < 16; beat++) {
    groove.push(
      [beat, beat % 2 ? 38 : 36, 0.2, 115],
      [beat, 42, 0.2, 90],
      [beat + 0.5, 42, 0.2, 70],
    );
  }
  const melody = [72, 74, 76, 79, 76, 74, 72, 71];
  return {
    pad: stem(
      'warm-pad',
      chords.flatMap((chord, i) => chord.map((n): Note => [i * 4, n, 3.9, 80])),
    ),
    lead: stem(
      'saw-lead',
      Array.from({ length: 16 }, (_, i): Note => [i, melody[i % 8], 0.9, 100]),
    ),
    choir: stem(
      'choir-aah',
      [64, 65, 67, 69].map((n, i): Note => [i * 4, n, 3.5, 90]),
    ),
    drums: stem('drum-kit', groove),
  };
}

describe('mixing assistant source classes', () => {
  it('reads a synth pad and lead as vocal, as sure as a choir, and a whole kit as tom', async () => {
    await wasm.init();
    const rendered = stems();
    const result = wasm.suggestMixScene({
      sampleRate: SAMPLE_RATE,
      tracks: Object.entries(rendered).map(([id, audio]) => ({ id, ...audio })),
    });
    const byId = Object.fromEntries(result.tracks.map((track) => [track.stripId, track]));

    expect(byId.choir.source).toBe('vocal');
    for (const id of ['pad', 'lead']) {
      expect(byId[id].source, id).toBe('vocal');
      expect(byId[id].sourceConfidence, id).toBeGreaterThanOrEqual(GATE);
      expect(byId[id].sourceConfidence, id).toBeCloseTo(byId.choir.sourceConfidence, 2);
    }
    expect(byId.drums.source).toBe('tom');
  }, 60_000);

  it('drops the wrong class under the gate when the track is named for what it is', async () => {
    await wasm.init();
    const { pad } = stems();
    const result = wasm.suggestMixScene({
      sampleRate: SAMPLE_RATE,
      tracks: [{ id: 'pad', name: 'keys', ...pad }],
    });
    expect(result.tracks[0].source).toBe('vocal');
    expect(result.tracks[0].sourceConfidence).toBeLessThan(GATE);
  }, 60_000);
});
