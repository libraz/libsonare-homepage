// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import * as wasm from '@/wasm/index.js';

/**
 * The analysis pages say `chordFunctionalAnalysis` labels line up with
 * `detectChords` one for one only under the same options, and not with the
 * chords inside `analyze`. This holds those sentences to the engine.
 */

const SAMPLE_RATE = 22_050;
// I–V–vi–IV–ii–V7 in C, two passes, two seconds a chord.
const LOOP = [
  [60, 64, 67],
  [67, 71, 74],
  [69, 72, 76],
  [65, 69, 72],
  [62, 65, 69],
  [67, 71, 74, 77],
];

function progression(): Float32Array {
  const chordFrames = SAMPLE_RATE * 2;
  const chords = LOOP.length * 2;
  const out = new Float32Array(chordFrames * chords);
  for (let c = 0; c < chords; c++) {
    const notes = LOOP[c % LOOP.length];
    for (const midi of [...notes, notes[0] - 12]) {
      const hz = 440 * 2 ** ((midi - 69) / 12);
      for (let i = 0; i < chordFrames; i++) {
        const t = i / SAMPLE_RATE;
        let v = 0;
        for (let h = 1; h <= 4; h++) v += Math.sin(2 * Math.PI * hz * h * t) / h;
        out[c * chordFrames + i] += v * Math.exp(-t * 1.5) * 0.12;
      }
    }
  }
  return out;
}

describe('chordFunctionalAnalysis alignment', () => {
  const samples = progression();
  const key = { keyRoot: 0, keyMode: 0 } as const;
  const options = {
    useTriadsOnly: false,
    useHmm: true,
    useKeyContext: true,
    chromaMethod: 'nnls',
    ...key,
  } as const;

  beforeAll(async () => {
    await wasm.init();
  });

  it('labels detectChords one for one under the same options', () => {
    const { chords } = wasm.detectChords({ samples, sampleRate: SAMPLE_RATE, ...options });
    const roman = wasm.chordFunctionalAnalysis({ samples, sampleRate: SAMPLE_RATE, ...options });
    expect(roman).toHaveLength(chords.length);
    // A chord rooted on the tonic reads as a I-family label.
    chords.forEach((chord, i) => {
      if (chord.root === 0) expect(roman[i]).toMatch(/^I(?![IV])/);
    });
  });

  it('gives a list of another length under other options', () => {
    const bare = wasm.chordFunctionalAnalysis({ samples, sampleRate: SAMPLE_RATE, ...key });
    const tuned = wasm.chordFunctionalAnalysis({ samples, sampleRate: SAMPLE_RATE, ...options });
    expect(bare.length).not.toBe(tuned.length);
  });

  it('does not line up with the chords inside analyze', () => {
    const roman = wasm.chordFunctionalAnalysis({ samples, sampleRate: SAMPLE_RATE, ...key });
    expect(wasm.analyze(samples, SAMPLE_RATE).chords.length).not.toBe(roman.length);
  });
});
