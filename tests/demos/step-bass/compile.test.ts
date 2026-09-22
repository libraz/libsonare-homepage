import { describe, expect, it } from 'vitest';
import { accentMemories, compile, LOOP_PPQ, STEP_PPQ } from '@/demos/step-bass/stepBassCompile';
import {
  ACCENT_DECAY_MS,
  accentBrightnessCents,
  accentMemory,
  accentVelocity,
  resonanceQ,
  SLIDE_GLIDE_MS,
  SLIDE_LEAD_FRAMES,
  STEP_BASS_BASE_PATCH,
  STEP_BASS_DEFAULT_KNOBS,
  STEP_COUNT,
  STEP_VELOCITY,
} from '@/demos/step-bass/stepBassPatch';
import type {
  CompiledLanePoint,
  CompiledMidiEvent,
  CompiledPattern,
  Knobs,
  LaneParam,
  Pattern,
  Step,
} from '@/demos/step-bass/stepBassTypes';

const SAMPLE_RATE = 48_000;
const BPM = 120;
/** Low A and the fifth above it: two pitches a slide can be heard between. */
const LOW = 45;
const HIGH = 52;

function patternOf(steps: Partial<Step>[]): Pattern {
  const filled: Step[] = [];
  for (let i = 0; i < STEP_COUNT; i++) {
    filled.push({ gate: 'rest', note: LOW, accent: false, slide: false, ...(steps[i] ?? {}) });
  }
  return { steps: filled, root: LOW };
}

function knobsOf(overrides: Partial<Knobs> = {}): Knobs {
  return { ...STEP_BASS_DEFAULT_KNOBS, ...overrides };
}

const framesPerPpq = (bpm: number) => (SAMPLE_RATE * 60) / bpm;
const stepFrameAt = (index: number, bpm = BPM) => Math.round(framesPerPpq(bpm) * index * STEP_PPQ);

const isNoteOn = (event: CompiledMidiEvent) => ((event.word0 >>> 20) & 0xf) === 0x9;
const noteOf = (event: CompiledMidiEvent) => (event.word0 >>> 8) & 0x7f;
const velocityOf = (event: CompiledMidiEvent) => event.word0 & 0x7f;

function laneOf(compiled: CompiledPattern, param: LaneParam): CompiledLanePoint[] {
  const lane = compiled.lanes.find((candidate) => candidate.param === param);
  if (!lane) throw new Error(`the compiled pattern carries no ${param} lane`);
  return lane.points;
}

/** The held value at an instant: the last breakpoint at or before it. */
function laneValueAt(points: CompiledLanePoint[], ppq: number): number {
  let value = points[0].value;
  for (const point of points) {
    if (point.ppq > ppq) break;
    value = point.value;
  }
  return value;
}

describe('the clip a pattern compiles to', () => {
  it('releases the sounding note before striking the one that shares its frame', () => {
    const compiled = compile(
      patternOf([
        { gate: 'note', note: LOW },
        { gate: 'note', note: HIGH },
      ]),
      knobsOf(),
      SAMPLE_RATE,
      BPM,
    );
    const boundary = stepFrameAt(1);
    const atBoundary = compiled.clip.events.filter((event) => event.renderFrame === boundary);

    expect(atBoundary).toHaveLength(2);
    expect(isNoteOn(atBoundary[0])).toBe(false);
    expect(noteOf(atBoundary[0])).toBe(LOW);
    expect(isNoteOn(atBoundary[1])).toBe(true);
    expect(noteOf(atBoundary[1])).toBe(HIGH);
  });

  it('never strikes before releasing anywhere in a pattern that is all notes', () => {
    const compiled = compile(
      patternOf(Array.from({ length: STEP_COUNT }, () => ({ gate: 'note' as const }))),
      knobsOf(),
      SAMPLE_RATE,
      BPM,
    );
    const events = compiled.clip.events;
    for (let i = 1; i < events.length; i++) {
      expect(events[i].renderFrame).toBeGreaterThanOrEqual(events[i - 1].renderFrame);
      if (events[i].renderFrame !== events[i - 1].renderFrame) continue;
      expect(isNoteOn(events[i - 1])).toBe(false);
      expect(isNoteOn(events[i])).toBe(true);
    }
    // Every event lands inside the loop, since one past the end never fires.
    for (const event of events) {
      expect(event.renderFrame).toBeLessThan(compiled.clip.lengthSamples);
    }
  });

  it('lets a tie hold the sounding note instead of speaking a new one', () => {
    const tied = compile(
      patternOf([{ gate: 'note', note: LOW }, { gate: 'tie' }, { gate: 'tie' }]),
      knobsOf(),
      SAMPLE_RATE,
      BPM,
    );
    const restruck = compile(
      patternOf([
        { gate: 'note', note: LOW },
        { gate: 'note', note: LOW },
        { gate: 'note', note: LOW },
      ]),
      knobsOf(),
      SAMPLE_RATE,
      BPM,
    );

    expect(tied.clip.events.filter(isNoteOn)).toHaveLength(1);
    expect(restruck.clip.events.filter(isNoteOn)).toHaveLength(3);
    // One note, spanning all three steps, released where the fourth begins.
    expect(tied.clip.events).toHaveLength(2);
    expect(tied.clip.events[0].renderFrame).toBe(0);
    expect(tied.clip.events[1].renderFrame).toBe(stepFrameAt(3));
  });

  it('carries the accent as note-on velocity and leaves the rest at the base', () => {
    const knobs = knobsOf({ accent: 1 });
    const pattern = patternOf([
      { gate: 'note', note: LOW, accent: true },
      { gate: 'note', note: HIGH },
    ]);
    const compiled = compile(pattern, knobs, SAMPLE_RATE, BPM);
    const strikes = compiled.clip.events.filter(isNoteOn);
    const memories = accentMemories(pattern.steps, BPM);

    expect(velocityOf(strikes[0])).toBe(accentVelocity(1, memories[0]));
    expect(velocityOf(strikes[0])).toBeGreaterThan(STEP_VELOCITY);
    expect(velocityOf(strikes[1])).toBe(STEP_VELOCITY);
  });

  it('leaves every step at the base velocity when the accent knob is at zero', () => {
    const compiled = compile(
      patternOf([
        { gate: 'note', note: LOW, accent: true },
        { gate: 'note', note: HIGH },
      ]),
      knobsOf({ accent: 0 }),
      SAMPLE_RATE,
      BPM,
    );
    for (const strike of compiled.clip.events.filter(isNoteOn)) {
      expect(velocityOf(strike)).toBe(STEP_VELOCITY);
    }
  });
});

describe('what a slide does and does not reach', () => {
  const slideKnobs = knobsOf();

  it('holds the note past the next strike only when that step speaks a note', () => {
    const intoNote = compile(
      patternOf([
        { gate: 'note', note: LOW, slide: true },
        { gate: 'note', note: HIGH },
      ]),
      slideKnobs,
      SAMPLE_RATE,
      BPM,
    );
    const intoRest = compile(
      patternOf([{ gate: 'note', note: LOW, slide: true }, { gate: 'rest' }]),
      slideKnobs,
      SAMPLE_RATE,
      BPM,
    );
    const intoTie = compile(
      patternOf([{ gate: 'note', note: LOW, slide: true }, { gate: 'tie' }, { gate: 'rest' }]),
      slideKnobs,
      SAMPLE_RATE,
      BPM,
    );

    const boundary = stepFrameAt(1);
    const releaseIn = (compiled: CompiledPattern) =>
      compiled.clip.events.filter((event) => !isNoteOn(event))[0].renderFrame;

    // Overlapping the strike is what gives the slur two notes to join.
    expect(releaseIn(intoNote)).toBeGreaterThan(boundary);
    // Neither of the others glides, so neither overlaps or raises the lane.
    expect(releaseIn(intoRest)).toBe(boundary);
    expect(releaseIn(intoTie)).toBe(stepFrameAt(2));
    for (const compiled of [intoRest, intoTie]) {
      for (const point of laneOf(compiled, 'glideMs')) expect(point.value).toBe(0);
    }
    expect(laneOf(intoNote, 'glideMs').some((point) => point.value === SLIDE_GLIDE_MS)).toBe(true);
  });

  it('raises the glide as a step function, a block ahead of the strike it serves', () => {
    const compiled = compile(
      patternOf([
        { gate: 'note', note: LOW },
        { gate: 'rest' },
        { gate: 'note', note: LOW },
        { gate: 'note', note: LOW, slide: true },
        { gate: 'note', note: HIGH },
      ]),
      knobsOf(),
      SAMPLE_RATE,
      BPM,
    );
    const points = laneOf(compiled, 'glideMs');

    // Two breakpoints per held value, rising in time, is the only shape the
    // engine holds flat; one point per value ramps the whole way instead.
    expect(points.length % 2).toBe(0);
    for (let i = 0; i < points.length; i += 2) {
      expect(points[i].value).toBe(points[i + 1].value);
      expect(points[i + 1].ppq).toBeGreaterThan(points[i].ppq);
      if (i + 2 < points.length) {
        expect(points[i + 2].ppq).toBeGreaterThan(points[i + 1].ppq);
        expect(points[i + 2].value).not.toBe(points[i].value);
      }
    }
    expect(points[points.length - 1].ppq).toBeLessThan(LOOP_PPQ);

    const strikePpq = 4 * STEP_PPQ;
    const rise = points.find((point) => point.value === SLIDE_GLIDE_MS);
    if (!rise) throw new Error('the glide never rises');
    const leadFrames = (strikePpq - rise.ppq) * framesPerPpq(BPM);
    expect(leadFrames).toBeGreaterThanOrEqual(SLIDE_LEAD_FRAMES - 1e-6);
    // Still standing when the strike latches it, and down again before the next.
    expect(laneValueAt(points, strikePpq)).toBe(SLIDE_GLIDE_MS);
    expect(laneValueAt(points, 0)).toBe(0);
    expect(laneValueAt(points, 5 * STEP_PPQ)).toBe(0);
  });

  it('gives the last step pitch alone, releasing one frame before the wrap', () => {
    const steps: Partial<Step>[] = [{ gate: 'note', note: LOW }];
    steps[STEP_COUNT - 1] = { gate: 'note', note: HIGH, slide: true };
    const compiled = compile(patternOf(steps), knobsOf(), SAMPLE_RATE, BPM);
    const releases = compiled.clip.events.filter((event) => !isNoteOn(event));
    const last = releases[releases.length - 1];

    // Nothing past the loop end fires and the wrap releases the voice anyway,
    // so the glide lane alone carries the last step into the first.
    expect(last.renderFrame).toBe(compiled.clip.lengthSamples - 1);
    expect(laneValueAt(laneOf(compiled, 'glideMs'), 0)).toBe(SLIDE_GLIDE_MS);
  });
});

describe('the accent memory across the wrap', () => {
  /** Run the memory forward from a cold start, keeping each lap's values. */
  function freeRun(steps: Step[], bpm: number, laps: number): number[][] {
    const secondsPerPpq = 60 / bpm;
    const out: number[][] = [];
    let memory = 0;
    let lastPpq: number | null = null;
    for (let lap = 0; lap < laps; lap++) {
      const values = new Array<number>(STEP_COUNT).fill(0);
      for (let i = 0; i < STEP_COUNT; i++) {
        if (!steps[i].accent || steps[i].gate !== 'note') continue;
        const ppq = lap * LOOP_PPQ + i * STEP_PPQ;
        const elapsed =
          lastPpq === null ? Number.POSITIVE_INFINITY : (ppq - lastPpq) * secondsPerPpq;
        memory = accentMemory(memory, elapsed);
        values[i] = memory;
        lastPpq = ppq;
      }
      out.push(values);
    }
    return out;
  }

  it('emits the velocities the memory settles on, not the ones a cold lap gives', () => {
    // Accents on adjacent steps at the top of the tempo range: the only place
    // the memory has anything left when the next accent arrives. At 120 BPM a
    // sixteenth spends it almost entirely, and every lap reads the same either way.
    const bpm = 200;
    const knobs = knobsOf({ accent: 1, resonancePct: 1 });
    const pattern = patternOf(
      Array.from({ length: STEP_COUNT }, () => ({ gate: 'note' as const, accent: true })),
    );
    const asVelocity = (memories: number[]) =>
      memories.map((memory) => accentVelocity(knobs.accent, memory));

    // Fifty laps of the recurrence, run here rather than by the compiler, so the
    // steady state is arrived at independently of the loop under test.
    const laps = freeRun(pattern.steps, bpm, 50);
    const settled = asVelocity(laps[49]);
    expect(asVelocity(laps[48])).toEqual(settled);

    const emitted = compile(pattern, knobs, SAMPLE_RATE, bpm)
      .clip.events.filter(isNoteOn)
      .map(velocityOf);
    expect(emitted).toEqual(settled);

    // And the settled vector is not the one a scan that never looped produces,
    // so the equality above cannot be met by dropping the convergence.
    const onePass = asVelocity(accentMemories(pattern.steps, bpm, 1));
    expect(onePass).not.toEqual(settled);
    expect(onePass[0]).toBeLessThan(settled[0]);
    // A run of accents builds towards, and stops at, the saturated velocity.
    expect(Math.max(...emitted)).toBeLessThanOrEqual(127);
  });

  it('forces the filter decay short on an accented step and leaves the knob elsewhere', () => {
    const knobs = knobsOf({ decayMs: 1200 });
    const compiled = compile(
      patternOf([
        { gate: 'note', note: LOW, accent: true },
        { gate: 'note', note: LOW },
      ]),
      knobs,
      SAMPLE_RATE,
      BPM,
    );
    const points = laneOf(compiled, 'filterDecayMs');
    expect(laneValueAt(points, 0)).toBe(ACCENT_DECAY_MS);
    expect(laneValueAt(points, STEP_PPQ)).toBe(knobs.decayMs);
  });

  it('builds no memory at all when no step is accented', () => {
    const unaccented = patternOf([{ gate: 'note', note: LOW }]);
    const compiled = compile(unaccented, knobsOf({ accent: 1 }), SAMPLE_RATE, BPM);
    expect(accentMemories(unaccented.steps, BPM).every((memory) => memory === 0)).toBe(true);
    for (const strike of compiled.clip.events.filter(isNoteOn)) {
      expect(velocityOf(strike)).toBe(STEP_VELOCITY);
    }
  });

  it('settles from a cut-short scan to the same memory a full scan reaches', () => {
    const bpm = 200;
    const pattern = patternOf(
      Array.from({ length: STEP_COUNT }, () => ({ gate: 'note' as const, accent: true })),
    );
    const onePass = accentMemories(pattern.steps, bpm, 1);
    const settled = accentMemories(pattern.steps, bpm);

    // One pass starts the lap cold, so the opening accents are under-fed; the
    // scan the compiler runs carries the previous lap's memory into them.
    expect(onePass[0]).toBeLessThan(settled[0]);
    expect(onePass[STEP_COUNT - 1]).toBeCloseTo(settled[STEP_COUNT - 1], 9);
  });
});

describe('what a tempo change moves', () => {
  const pattern = patternOf([
    { gate: 'note', note: LOW },
    { gate: 'tie' },
    { gate: 'note', note: HIGH, slide: true },
    { gate: 'note', note: LOW },
    { gate: 'rest' },
    { gate: 'note', note: HIGH },
  ]);

  it('rescales the frames and nothing the pattern says musically', () => {
    const knobs = knobsOf();
    const slow = compile(pattern, knobs, SAMPLE_RATE, 90);
    const fast = compile(pattern, knobs, SAMPLE_RATE, 160);
    const ratio = 90 / 160;

    expect(fast.clip.lengthSamples).toBeLessThan(slow.clip.lengthSamples);
    expect(fast.clip.lengthSamples / slow.clip.lengthSamples).toBeCloseTo(ratio, 4);
    expect(fast.clip.events.map((event) => event.word0)).toEqual(
      slow.clip.events.map((event) => event.word0),
    );
    for (const [i, event] of fast.clip.events.entries()) {
      expect(event.renderFrame).toBeCloseTo(slow.clip.events[i].renderFrame * ratio, -1);
    }

    // The bar is still a bar, the patch is still the patch, and each step still
    // carries the same lane values — only the frame mapping moved.
    expect(fast.loop).toEqual(slow.loop);
    expect(fast.patch).toEqual(slow.patch);
    expect(fast.knobs).toEqual(slow.knobs);
    expect(fast.masterStripJson).toBe(slow.masterStripJson);
    for (const param of ['glideMs', 'filterDecayMs'] as const) {
      const at = (compiled: CompiledPattern, i: number) =>
        laneValueAt(laneOf(compiled, param), i * STEP_PPQ);
      for (let i = 0; i < STEP_COUNT; i++) expect(at(fast, i)).toBe(at(slow, i));
    }
  });
});

describe('the compiled form as data', () => {
  const pattern = patternOf([
    { gate: 'note', note: LOW, accent: true },
    { gate: 'tie' },
    { gate: 'note', note: HIGH, slide: true },
    { gate: 'note', note: LOW },
    { gate: 'rest' },
    { gate: 'note', note: HIGH, accent: true, slide: true },
    { gate: 'note', note: LOW },
  ]);
  const knobs = knobsOf({ cutoffHz: 420, resonancePct: 0.8, envModCents: 3600, tuningCents: -200 });

  it('gives the same structure every time it is asked', () => {
    expect(compile(pattern, knobs, SAMPLE_RATE, BPM)).toEqual(
      compile(pattern, knobs, SAMPLE_RATE, BPM),
    );
  });

  it('leaves its arguments and the shared base patch untouched', () => {
    const before = structuredClone(pattern);
    const knobsBefore = structuredClone(knobs);
    const compiled = compile(pattern, knobs, SAMPLE_RATE, BPM);

    expect(pattern).toEqual(before);
    expect(knobs).toEqual(knobsBefore);
    expect(STEP_BASS_BASE_PATCH.cutoffHz).toBe(700);
    expect(compiled.patch.modRoutings).not.toBe(STEP_BASS_BASE_PATCH.modRoutings);
    expect(compiled.patch.modRoutings).toEqual(STEP_BASS_BASE_PATCH.modRoutings);
  });

  it('writes the knob positions into the patch and the engine-unit copy alike', () => {
    const compiled = compile(pattern, knobs, SAMPLE_RATE, BPM);
    expect(compiled.patch.cutoffHz).toBe(knobs.cutoffHz);
    expect(compiled.patch.resonanceQ).toBe(resonanceQ(knobs.resonancePct));
    expect(compiled.patch.envToCutoffCents).toBe(knobs.envModCents);
    expect(compiled.patch.pitchOffsetCents).toBe(knobs.tuningCents);
    expect(compiled.patch.waveform).toBe(knobs.waveform);
    expect(compiled.knobs).toEqual({
      cutoffHz: knobs.cutoffHz,
      resonanceQ: resonanceQ(knobs.resonancePct),
      envToCutoffCents: knobs.envModCents,
      pitchOffsetCents: knobs.tuningCents,
      faderDb: knobs.faderDb,
    });
    expect(compiled.sampleRate).toBe(SAMPLE_RATE);
    expect(compiled.bpm).toBe(BPM);
    expect(compiled.articulation).toBe('mono-legato');
    expect(compiled.lanes.map((lane) => lane.param)).toEqual(['glideMs', 'filterDecayMs']);
  });

  it('writes the accent brightness into the patch rather than into a lane', () => {
    const q = resonanceQ(knobs.resonancePct);
    const compiled = compile(pattern, knobs, SAMPLE_RATE, BPM);
    expect(compiled.patch.velToCutoffCents).toBe(accentBrightnessCents(knobs.accent, q));
    expect(compiled.patch.velToCutoffCents).toBeGreaterThan(0);

    // The parameter is referenced to velocity 127, so what it does is sink the
    // plain steps under the accented ones; at accent zero there is nothing to
    // separate and the two sit on the same cutoff again.
    const silentAccent = compile(pattern, { ...knobs, accent: 0 }, SAMPLE_RATE, BPM);
    expect(silentAccent.patch.velToCutoffCents).toBe(0);

    const noResonance = compile(pattern, { ...knobs, resonancePct: 0 }, SAMPLE_RATE, BPM);
    expect(noResonance.patch.velToCutoffCents).toBe(0);
  });
});
