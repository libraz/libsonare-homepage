// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import * as wasm from '@/wasm/index.js';

/**
 * The analysis pages say `chordFunctionalAnalysis` labels line up with
 * `detectChords` one for one only under the same options, while chords inside
 * `analyze` carry their own Roman numeral relative to the result key. This
 * holds those sentences to the engine.
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

  let tunedChords: ReturnType<typeof wasm.detectChords>;
  let tunedRoman: ReturnType<typeof wasm.chordFunctionalAnalysis>;
  let bareRoman: ReturnType<typeof wasm.chordFunctionalAnalysis>;
  let analyzed: ReturnType<typeof wasm.analyze>;

  beforeAll(async () => {
    await wasm.init();
    tunedChords = wasm.detectChords({ samples, sampleRate: SAMPLE_RATE, ...options });
    tunedRoman = wasm.chordFunctionalAnalysis({ samples, sampleRate: SAMPLE_RATE, ...options });
    bareRoman = wasm.chordFunctionalAnalysis({ samples, sampleRate: SAMPLE_RATE, ...key });
    analyzed = wasm.analyze(samples, SAMPLE_RATE);
  }, 30_000);

  it('labels detectChords one for one under the same options', () => {
    expect(tunedRoman).toHaveLength(tunedChords.chords.length);
    // A chord rooted on the tonic reads as a I-family label.
    expect(tunedChords.chords.some(({ root }) => root === 0)).toBe(true);
    tunedChords.chords.forEach((chord, i) => {
      if (chord.root === 0) expect(tunedRoman[i]).toMatch(/^I(?![IV])/);
    });
  });

  it('gives a list of another length under other options', () => {
    expect(bareRoman.length).not.toBe(tunedRoman.length);
  });

  it('attaches Roman numerals to the chords returned by analyze', () => {
    expect(analyzed.key).toMatchObject({ root: 0, mode: 0 });
    expect(analyzed.chords).toContainEqual(expect.objectContaining({ root: 0, romanNumeral: 'I' }));
    expect(analyzed.chords).toContainEqual(expect.objectContaining({ root: 7, romanNumeral: 'V' }));
    expect(analyzed.chords).toContainEqual(
      expect.objectContaining({ root: 9, romanNumeral: 'vi' }),
    );
    expect(analyzed.chords.length).toBeGreaterThan(0);
    const named = analyzed.chords.filter(({ name }) => name !== 'N.C.');
    expect(named.length).toBeGreaterThan(0);
    for (const { romanNumeral } of named) {
      expect(romanNumeral).not.toBe('');
    }
    for (const { romanNumeral } of analyzed.chords.filter(({ name }) => name === 'N.C.')) {
      expect(romanNumeral).toBe('');
    }
  });
});
