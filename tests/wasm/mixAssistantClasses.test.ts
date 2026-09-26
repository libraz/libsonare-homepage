// @vitest-environment node
import { describe, expect, it } from 'vitest';
import * as wasm from '@/wasm/index.js';

/**
 * Render sustained synth parts and a drum groove with the engine's own
 * synthesizer, then check the source classes described by the mixing assistant.
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

let renderedStems: ReturnType<typeof stems> | undefined;
function getStems() {
  if (!renderedStems) renderedStems = stems();
  return renderedStems;
}

describe('mixing assistant source classes', () => {
  it('leaves unnamed sustained parts unknown and classifies the rendered drum groove', async () => {
    await wasm.init();
    const rendered = getStems();
    const result = wasm.suggestMixScene({
      sampleRate: SAMPLE_RATE,
      tracks: Object.entries(rendered).map(([id, audio]) => ({ id, ...audio })),
    });
    const byId = Object.fromEntries(result.tracks.map((track) => [track.stripId, track]));

    for (const id of ['pad', 'lead', 'choir']) {
      expect(byId[id].source, id).toBe('unknown');
      expect(byId[id].sourceConfidence, id).toBe(0);
    }
    expect(byId.drums.source).toBe('tom');
    expect(byId.drums.sourceConfidence).toBeGreaterThan(0);
    expect(byId.drums.sourceConfidence).toBeLessThan(GATE);
  }, 60_000);

  it('uses a compatible track name to classify an otherwise unknown part', async () => {
    await wasm.init();
    const { pad } = getStems();
    const result = wasm.suggestMixScene({
      sampleRate: SAMPLE_RATE,
      tracks: [{ id: 'pad', name: 'keys', ...pad }],
    });
    expect(result.tracks[0].source).toBe('keys');
    expect(result.tracks[0].sourceConfidence).toBeGreaterThanOrEqual(GATE);
  }, 60_000);
});
