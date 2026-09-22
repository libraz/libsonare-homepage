// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { STEP_COUNT } from '@/demos/step-bass/stepBassPatch';
import {
  encodeKnobsQuery,
  encodePatternQuery,
  FACTORY_PATTERNS,
  parseKnobsQuery,
  parsePatternQuery,
  randomise,
  STEP_NOTE_MAX,
  STEP_NOTE_MIN,
} from '@/demos/step-bass/stepBassPatterns';
import type { Knobs, Pattern, Step } from '@/demos/step-bass/stepBassTypes';

/** A slide is meaningful only when the next step (wrapping) speaks a note. */
function slidesAreValid(steps: Step[]): boolean {
  return steps.every((step, i) => {
    if (!step.slide) return true;
    const next = steps[(i + 1) % steps.length];
    return next.gate === 'note';
  });
}

/** Deterministic RNG for seeded, reproducible generator runs (mulberry32). */
function seededRng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('factory patterns', () => {
  it('has eight patterns', () => {
    expect(FACTORY_PATTERNS).toHaveLength(8);
  });

  it.each(FACTORY_PATTERNS)(
    '$name has $pattern.steps.length steps, valid notes, valid slides',
    (fp) => {
      expect(fp.pattern.steps).toHaveLength(STEP_COUNT);
      const noteSteps = fp.pattern.steps.filter((s) => s.gate === 'note');
      expect(noteSteps.length).toBeGreaterThanOrEqual(1);
      for (const step of noteSteps) {
        expect(step.note).toBeGreaterThanOrEqual(STEP_NOTE_MIN);
        expect(step.note).toBeLessThanOrEqual(STEP_NOTE_MAX);
      }
      expect(slidesAreValid(fp.pattern.steps)).toBe(true);
    },
  );

  it('has genuinely different characters, not eight variations of one', () => {
    const densities = FACTORY_PATTERNS.map(
      (fp) => fp.pattern.steps.filter((s) => s.gate === 'note').length,
    );
    const accents = FACTORY_PATTERNS.map((fp) => fp.pattern.steps.filter((s) => s.accent).length);
    const slides = FACTORY_PATTERNS.map((fp) => fp.pattern.steps.filter((s) => s.slide).length);
    // Densities span a wide range rather than clustering on one value.
    expect(Math.max(...densities) - Math.min(...densities)).toBeGreaterThanOrEqual(8);
    expect(new Set(accents).size).toBeGreaterThan(1);
    expect(new Set(slides).size).toBeGreaterThan(1);
    // Every pattern carries its own fader gain.
    expect(new Set(FACTORY_PATTERNS.map((fp) => fp.faderDb)).size).toBe(8);
  });

  it('has unique ids and names', () => {
    expect(new Set(FACTORY_PATTERNS.map((fp) => fp.id)).size).toBe(8);
    expect(new Set(FACTORY_PATTERNS.map((fp) => fp.name)).size).toBe(8);
  });
});

describe('randomise', () => {
  const seeds = Array.from({ length: 200 }, (_, i) => i + 1);
  const runs = seeds.map((seed) => randomise(36 + (seed % 12), seededRng(seed)));

  it('produces exactly STEP_COUNT steps every run', () => {
    for (const pattern of runs) expect(pattern.steps).toHaveLength(STEP_COUNT);
  });

  it('stays in minor pentatonic degrees on the root for every note step', () => {
    const intervals = new Set([0, 3, 5, 7, 10]);
    for (const pattern of runs) {
      const rootPc = ((pattern.root % 12) + 12) % 12;
      for (const step of pattern.steps) {
        if (step.gate !== 'note') continue;
        expect(step.note).toBeGreaterThanOrEqual(STEP_NOTE_MIN);
        expect(step.note).toBeLessThanOrEqual(STEP_NOTE_MAX);
        const pc = ((step.note % 12) + 12) % 12;
        const interval = (((pc - rootPc) % 12) + 12) % 12;
        expect(intervals.has(interval)).toBe(true);
      }
    }
  });

  it('forces beats 1 and 3 (steps 0 and 8) to the root', () => {
    for (const pattern of runs) {
      expect(pattern.steps[0].gate).toBe('note');
      expect(pattern.steps[0].note).toBe(pattern.root);
      expect(pattern.steps[8].gate).toBe('note');
      expect(pattern.steps[8].note).toBe(pattern.root);
    }
  });

  it('places slides only between two steps that both speak notes', () => {
    for (const pattern of runs) expect(slidesAreValid(pattern.steps)).toBe(true);
  });

  it('weights accents toward the beat across the sample', () => {
    const onBeat = { accented: 0, total: 0 };
    const offBeat = { accented: 0, total: 0 };
    for (const pattern of runs) {
      pattern.steps.forEach((step, i) => {
        if (step.gate !== 'note') return;
        const bucket = i % 4 === 0 ? onBeat : offBeat;
        bucket.total += 1;
        if (step.accent) bucket.accented += 1;
      });
    }
    const onBeatRate = onBeat.accented / onBeat.total;
    const offBeatRate = offBeat.accented / offBeat.total;
    expect(onBeatRate).toBeGreaterThan(offBeatRate);
  });

  it('is reproducible from the same seed', () => {
    const a = randomise(40, seededRng(7));
    const b = randomise(40, seededRng(7));
    expect(a).toEqual(b);
  });
});

describe('pattern URL round-trip', () => {
  it('round-trips a pattern using ties, rests, accents and slides', () => {
    const steps: Step[] = [
      { gate: 'note', note: 36, accent: true, slide: false },
      { gate: 'tie', note: 0, accent: false, slide: false },
      { gate: 'rest', note: 0, accent: false, slide: false },
      { gate: 'note', note: 43, accent: false, slide: true },
      { gate: 'note', note: 45, accent: true, slide: false },
      { gate: 'rest', note: 0, accent: false, slide: false },
      { gate: 'note', note: 38, accent: false, slide: false },
      { gate: 'tie', note: 0, accent: false, slide: false },
      { gate: 'note', note: 36, accent: false, slide: false },
      { gate: 'rest', note: 0, accent: false, slide: false },
      { gate: 'note', note: 60, accent: true, slide: false },
      { gate: 'note', note: 24, accent: false, slide: false },
      { gate: 'rest', note: 0, accent: false, slide: false },
      { gate: 'note', note: 41, accent: false, slide: true },
      { gate: 'note', note: 43, accent: false, slide: false },
      { gate: 'rest', note: 0, accent: false, slide: false },
    ];
    const pattern: Pattern = { steps, root: 36 };
    const query = encodePatternQuery(pattern);
    const parsed = parsePatternQuery(query);
    expect(parsed).not.toBeNull();
    expect(parsed?.steps).toEqual(steps);
  });

  it.each(FACTORY_PATTERNS)('round-trips the $name factory pattern', (fp) => {
    const parsed = parsePatternQuery(encodePatternQuery(fp.pattern));
    expect(parsed?.steps).toEqual(
      fp.pattern.steps.map((s) => (s.gate === 'note' ? s : { ...s, note: 0 })),
    );
  });

  it('rejects the wrong token count', () => {
    expect(parsePatternQuery(Array(15).fill('-').join('.'))).toBeNull();
    expect(parsePatternQuery(Array(17).fill('-').join('.'))).toBeNull();
  });

  it('rejects a bad note name', () => {
    const tokens = Array(STEP_COUNT).fill('-');
    tokens[0] = 'h2'; // 'h' is not a note letter
    expect(parsePatternQuery(tokens.join('.'))).toBeNull();
  });

  it('rejects an out-of-range octave', () => {
    const tokens = Array(STEP_COUNT).fill('-');
    tokens[0] = 'c9'; // resolves to MIDI 120, outside 24..60
    expect(parsePatternQuery(tokens.join('.'))).toBeNull();
  });
});

describe('knob URL round-trip', () => {
  const knobs: Knobs = {
    waveform: 'square',
    tuningCents: 450,
    cutoffHz: 5010,
    resonancePct: 0.5,
    envModCents: 1200,
    decayMs: 1100,
    accent: 0.25,
    faderDb: -15,
  };

  it('round-trips knob positions within quantization tolerance', () => {
    const query = encodeKnobsQuery(knobs);
    const parsed = parseKnobsQuery(query);
    expect(parsed).not.toBeNull();
    expect(parsed?.waveform).toBe(knobs.waveform);
    expect(parsed?.tuningCents).toBeCloseTo(knobs.tuningCents, 0);
    expect(parsed?.cutoffHz).toBeCloseTo(knobs.cutoffHz, 0);
    expect(parsed?.resonancePct).toBeCloseTo(knobs.resonancePct, 3);
    expect(parsed?.envModCents).toBeCloseTo(knobs.envModCents, 0);
    expect(parsed?.decayMs).toBeCloseTo(knobs.decayMs, 0);
    expect(parsed?.accent).toBeCloseTo(knobs.accent, 3);
    expect(parsed?.faderDb).toBeCloseTo(knobs.faderDb, 1);
  });

  it('encodes exactly 8 dot-separated integers', () => {
    const query = encodeKnobsQuery(knobs);
    const tokens = query.split('.');
    expect(tokens).toHaveLength(8);
    for (const t of tokens) expect(t).toMatch(/^\d+$/);
  });

  it('rejects the wrong token count', () => {
    expect(parseKnobsQuery(Array(7).fill('0').join('.'))).toBeNull();
    expect(parseKnobsQuery(Array(9).fill('0').join('.'))).toBeNull();
  });

  it('rejects an out-of-range knob integer', () => {
    const tokens = ['0', '500', '500', '500', '500', '500', '500', '1001'];
    expect(parseKnobsQuery(tokens.join('.'))).toBeNull();
  });

  it('rejects a non-integer token', () => {
    const tokens = ['0', '500', '500', '500', '500', '500', '500', 'abc'];
    expect(parseKnobsQuery(tokens.join('.'))).toBeNull();
  });
});
