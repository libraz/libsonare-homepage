// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import { tuningReference } from '@/demos/analyzer/audioAnalyzerProcessing';
import * as wasm from '@/wasm/index.js';

/**
 * The chroma glossary says a recording off A440 degrades key and chord
 * readings, that `estimateTuning` measures the offset, and that the stream
 * analyzer is where the bindings take it back in. `/analyzer` does exactly
 * that on every load. This holds both to the engine.
 */

const SAMPLE_RATE = 22_050;
const C_MAJOR_LOOP = [
  [60, 64, 67],
  [67, 71, 74],
  [69, 72, 76],
  [65, 69, 72],
];

/** I–V–vi–IV in C, two seconds a chord, detuned by `cents`. */
function progression(cents: number): Float32Array {
  const chordFrames = SAMPLE_RATE * 2;
  const chords = C_MAJOR_LOOP.length * 4;
  const out = new Float32Array(chordFrames * chords);
  for (let c = 0; c < chords; c++) {
    const triad = C_MAJOR_LOOP[c % C_MAJOR_LOOP.length];
    for (const midi of [...triad, triad[0] - 12]) {
      const hz = 440 * 2 ** ((midi - 69) / 12 + cents / 1200);
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

function streamKey(samples: Float32Array, configure?: (a: wasm.StreamAnalyzer) => void) {
  const analyzer = new wasm.StreamAnalyzer({ sampleRate: SAMPLE_RATE, computeChroma: true });
  try {
    configure?.(analyzer);
    for (let i = 0; i < samples.length; i += 4096) {
      analyzer.process(samples.subarray(i, i + 4096));
      analyzer.readFrames(analyzer.availableFrames());
    }
    const { key, keyMinor } = analyzer.stats().estimate;
    return { key, keyMinor };
  } finally {
    analyzer.delete();
  }
}

describe('tuning reference', () => {
  const flat = progression(-45);
  let offset = 0;

  beforeAll(async () => {
    await wasm.init();
    offset = wasm.estimateTuning(flat, SAMPLE_RATE);
  });

  it('estimateTuning reads the offset to within two cents', () => {
    expect(Math.abs(tuningReference(offset).cents + 45)).toBeLessThanOrEqual(2);
  });

  it('a quarter-tone flat loop in C reads in another key at A440', () => {
    expect(streamKey(flat)).not.toEqual({ key: 0, keyMinor: false });
  });

  it('reads in C once the analyzer takes the estimated reference', () => {
    const { refHz } = tuningReference(offset);
    expect(streamKey(flat, (a) => a.setTuningRefHz(refHz))).toEqual({ key: 0, keyMinor: false });
  });

  it('keeps the reference across a reset, as a seek does', () => {
    const { refHz } = tuningReference(offset);
    const key = streamKey(flat, (a) => {
      a.setTuningRefHz(refHz);
      a.reset(0);
    });
    expect(key).toEqual({ key: 0, keyMinor: false });
  });
});
