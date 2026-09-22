/**
 * The eight factory patterns, the pentatonic-rule generator, and the URL
 * codec for the pattern a visitor is editing and the knob positions.
 *
 * Encoding is lossy on purpose: `Step.note` is meaningless when `gate` isn't
 * `'note'`, so a tie or rest round-trips with `note: 0` regardless of what it
 * held before encoding.
 */

import { KNOB_RANGES, STEP_COUNT } from '@/demos/step-bass/stepBassPatch';
import type { Knobs, Pattern, Step, StepBassWaveform } from '@/demos/step-bass/stepBassTypes';

/** `Step.note` domain: MIDI 24 (C1) to 60 (C4). */
export const STEP_NOTE_MIN = 24;
export const STEP_NOTE_MAX = 60;

/** Root a parsed all-rest/all-tie pattern falls back to (C2). */
const FALLBACK_ROOT = 36;

// ------------------------------------------------------------- note tokens

const PITCH_CLASS_NAMES = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];
const NOTE_LETTER_PC: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
const NOTE_TOKEN = /^([a-g]#?)(\d+)(a)?(s)?$/;

function encodeNote(note: number): string {
  const pc = PITCH_CLASS_NAMES[((note % 12) + 12) % 12];
  const octave = Math.floor(note / 12) - 1;
  return `${pc}${octave}`;
}

function decodeNote(name: string, octaveDigits: string): number | null {
  const pc = NOTE_LETTER_PC[name[0]];
  if (pc === undefined) return null;
  const sharp = name.length > 1 ? 1 : 0;
  return (Number(octaveDigits) + 1) * 12 + pc + sharp;
}

function encodeStep(step: Step): string {
  if (step.gate === 'rest') return '-';
  if (step.gate === 'tie') return 't';
  return `${encodeNote(step.note)}${step.accent ? 'a' : ''}${step.slide ? 's' : ''}`;
}

function decodeStep(token: string): Step | null {
  if (token === '-') return { gate: 'rest', note: 0, accent: false, slide: false };
  if (token === 't') return { gate: 'tie', note: 0, accent: false, slide: false };
  const match = token.match(NOTE_TOKEN);
  if (!match) return null;
  const note = decodeNote(match[1], match[2]);
  if (note === null || note < STEP_NOTE_MIN || note > STEP_NOTE_MAX) return null;
  return { gate: 'note', note, accent: match[3] === 'a', slide: match[4] === 's' };
}

/** `?p=`: sixteen step tokens joined by `.`. */
export function encodePatternQuery(pattern: Pattern): string {
  return pattern.steps.map(encodeStep).join('.');
}

/** Returns `null` on anything that doesn't parse — the page opens on the default instrument instead. */
export function parsePatternQuery(query: string): Pattern | null {
  const tokens = query.split('.');
  if (tokens.length !== STEP_COUNT) return null;
  const steps: Step[] = [];
  for (const token of tokens) {
    const step = decodeStep(token);
    if (!step) return null;
    steps.push(step);
  }
  const rootStep = steps.find((s) => s.gate === 'note');
  return { steps, root: rootStep ? rootStep.note : FALLBACK_ROOT };
}

// ------------------------------------------------------------- knob tokens

const WAVEFORM_CODES: Record<StepBassWaveform, number> = { saw: 0, square: 1 };
const WAVEFORM_BY_CODE: StepBassWaveform[] = ['saw', 'square'];

function scale(value: number, min: number, max: number): number {
  return Math.round(((value - min) / (max - min)) * 1000);
}

function unscale(units: number, min: number, max: number): number {
  return min + (units / 1000) * (max - min);
}

/** `?k=`: waveform (0/1) then the seven panel knobs scaled 0..1000, joined by `.`. */
export function encodeKnobsQuery(knobs: Knobs): string {
  const r = KNOB_RANGES;
  return [
    WAVEFORM_CODES[knobs.waveform],
    scale(knobs.tuningCents, r.tuningCents.min, r.tuningCents.max),
    scale(knobs.cutoffHz, r.cutoffHz.min, r.cutoffHz.max),
    scale(knobs.resonancePct, r.resonancePct.min, r.resonancePct.max),
    scale(knobs.envModCents, r.envModCents.min, r.envModCents.max),
    scale(knobs.decayMs, r.decayMs.min, r.decayMs.max),
    scale(knobs.accent, r.accent.min, r.accent.max),
    scale(knobs.faderDb, r.faderDb.min, r.faderDb.max),
  ].join('.');
}

/** Returns `null` on a bad token count, a non-integer token, or an out-of-range value. */
export function parseKnobsQuery(query: string): Knobs | null {
  const tokens = query.split('.');
  if (tokens.length !== 8 || !tokens.every((t) => /^\d+$/.test(t))) return null;
  const [wf, tuning, cutoff, resonance, envMod, decay, accent, fader] = tokens.map(Number);
  if (wf !== 0 && wf !== 1) return null;
  const scaled = [tuning, cutoff, resonance, envMod, decay, accent, fader];
  if (scaled.some((v) => v < 0 || v > 1000)) return null;
  const r = KNOB_RANGES;
  return {
    waveform: WAVEFORM_BY_CODE[wf],
    tuningCents: unscale(tuning, r.tuningCents.min, r.tuningCents.max),
    cutoffHz: unscale(cutoff, r.cutoffHz.min, r.cutoffHz.max),
    resonancePct: unscale(resonance, r.resonancePct.min, r.resonancePct.max),
    envModCents: unscale(envMod, r.envModCents.min, r.envModCents.max),
    decayMs: unscale(decay, r.decayMs.min, r.decayMs.max),
    accent: unscale(accent, r.accent.min, r.accent.max),
    faderDb: unscale(fader, r.faderDb.min, r.faderDb.max),
  };
}

// ---------------------------------------------------------- factory patterns

export interface FactoryPattern {
  id: string;
  name: string;
  pattern: Pattern;
  /** This pattern's own gain staging; copied into the working knobs on selection. */
  faderDb: number;
}

function note(pitch: number, accent = false, slide = false): Step {
  return { gate: 'note', note: pitch, accent, slide };
}

function tie(root: number): Step {
  return { gate: 'tie', note: root, accent: false, slide: false };
}

function rest(root: number): Step {
  return { gate: 'rest', note: root, accent: false, slide: false };
}

const ROOT_WALK_ROOT = 36;
const OCTAVE_JUMP_ROOT = 33;
const THIRDS_ROLL_ROOT = 38;
const SPARSE_SWING_ROOT = 41;
const RUNNER_ROOT = 36;
const LOW_PULSE_ROOT = 28;
const SKITTER_ROOT = 43;
const LONG_STRIDE_ROOT = 31;

export const FACTORY_PATTERNS: FactoryPattern[] = [
  {
    id: 'root-walk',
    name: 'Root Walk',
    faderDb: 24,
    pattern: {
      root: ROOT_WALK_ROOT,
      steps: [
        note(36, true),
        rest(36),
        note(38),
        rest(36),
        note(36),
        note(41),
        rest(36),
        rest(36),
        note(36, true),
        rest(36),
        note(38),
        rest(36),
        note(43),
        rest(36),
        note(41),
        rest(36),
      ],
    },
  },
  {
    id: 'octave-jump',
    name: 'Octave Jump',
    faderDb: 22,
    pattern: {
      root: OCTAVE_JUMP_ROOT,
      steps: [
        note(33),
        rest(33),
        note(45, true),
        rest(33),
        note(33),
        note(45),
        rest(33),
        rest(33),
        note(33),
        note(45, false, true),
        note(45),
        rest(33),
        note(33, true),
        rest(33),
        note(45),
        rest(33),
      ],
    },
  },
  {
    id: 'thirds-roll',
    name: 'Thirds Roll',
    faderDb: 19,
    pattern: {
      root: THIRDS_ROLL_ROOT,
      steps: [
        note(38),
        note(41, true),
        note(43, false, true),
        note(41),
        rest(38),
        note(38),
        note(41),
        rest(38),
        note(38),
        note(43, true),
        note(41, false, true),
        note(38),
        rest(38),
        note(41),
        note(43),
        rest(38),
      ],
    },
  },
  {
    id: 'sparse-swing',
    name: 'Sparse Swing',
    faderDb: 27,
    pattern: {
      root: SPARSE_SWING_ROOT,
      steps: [
        note(41),
        tie(41),
        tie(41),
        rest(41),
        rest(41),
        note(43, true),
        tie(43),
        rest(41),
        note(41),
        tie(41),
        rest(41),
        rest(41),
        note(38, true),
        tie(38),
        tie(38),
        rest(41),
      ],
    },
  },
  {
    id: 'runner',
    name: 'Runner',
    faderDb: 16,
    pattern: {
      root: RUNNER_ROOT,
      steps: [
        note(36, true),
        note(38, false, true),
        note(41, false, true),
        note(43),
        note(45, true),
        note(43, false, true),
        note(41),
        note(38),
        note(36, true),
        note(38, false, true),
        note(41, false, true),
        note(43),
        note(45, true),
        note(48, false, true),
        note(45),
        note(41),
      ],
    },
  },
  {
    id: 'low-pulse',
    name: 'Low Pulse',
    faderDb: 26,
    pattern: {
      root: LOW_PULSE_ROOT,
      steps: [
        note(28, true),
        rest(28),
        note(28),
        rest(28),
        note(31, false, true),
        note(28),
        rest(28),
        rest(28),
        note(28),
        rest(28),
        rest(28),
        rest(28),
        note(31, true),
        rest(28),
        rest(28),
        rest(28),
      ],
    },
  },
  {
    id: 'skitter',
    name: 'Skitter',
    faderDb: 21,
    pattern: {
      root: SKITTER_ROOT,
      steps: [
        rest(43),
        note(43, false, true),
        note(45, false, true),
        note(43),
        rest(43),
        rest(43),
        note(41, true),
        rest(43),
        rest(43),
        note(43, false, true),
        note(45),
        rest(43),
        note(43, true),
        note(45, false, true),
        note(43),
        rest(43),
      ],
    },
  },
  {
    id: 'long-stride',
    name: 'Long Stride',
    faderDb: 23,
    pattern: {
      root: LONG_STRIDE_ROOT,
      steps: [
        note(31),
        rest(31),
        note(55, true),
        rest(31),
        note(31, false, true),
        note(38),
        rest(31),
        note(50, true),
        rest(31),
        note(31),
        rest(31),
        note(53, false, true),
        note(43, true),
        rest(31),
        note(31, false, true),
        note(36),
      ],
    },
  },
];

// ------------------------------------------------------------------ randomise

/** Minor pentatonic scale degrees, in semitones from the root's pitch class. */
const PENTATONIC_INTERVALS = [0, 3, 5, 7, 10];

function pentatonicPool(root: number): number[] {
  const rootPc = ((root % 12) + 12) % 12;
  const allowed = new Set(PENTATONIC_INTERVALS.map((i) => (rootPc + i) % 12));
  const pool: number[] = [];
  for (let n = STEP_NOTE_MIN; n <= STEP_NOTE_MAX; n++) {
    if (allowed.has(((n % 12) + 12) % 12)) pool.push(n);
  }
  return pool;
}

/** Transposes `root` by octaves until it sits inside the step note range. */
function anchorNote(root: number): number {
  let n = root;
  while (n < STEP_NOTE_MIN) n += 12;
  while (n > STEP_NOTE_MAX) n -= 12;
  return n;
}

/** Accent probability: higher on the quarter-note beats (steps 0, 4, 8, 12). */
function accentWeight(i: number): number {
  return i % 4 === 0 ? 0.55 : 0.15;
}

/**
 * Rule-bound random pattern: minor pentatonic on `root`, beats 1 and 3 forced
 * to the root, slides only between two note steps, accents weighted to the
 * beat. `rng` is a caller-supplied `() => number` in `[0, 1)` so a seed
 * reproduces the same pattern.
 */
export function randomise(root: number, rng: () => number): Pattern {
  const pool = pentatonicPool(root);
  const anchor = anchorNote(root);
  const steps: Step[] = [];

  for (let i = 0; i < STEP_COUNT; i++) {
    if (i === 0 || i === 8) {
      steps.push(note(anchor, rng() < accentWeight(i)));
      continue;
    }
    const roll = rng();
    const prevSounding = steps[i - 1].gate !== 'rest';
    if (roll < 0.55) {
      const pitch = pool[Math.floor(rng() * pool.length)];
      steps.push(note(pitch, rng() < accentWeight(i)));
    } else if (roll < 0.7 && prevSounding) {
      steps.push(tie(anchor));
    } else {
      steps.push(rest(anchor));
    }
  }

  // Second pass: a slide only ever lands between two steps that both speak notes.
  for (let i = 0; i < STEP_COUNT; i++) {
    if (steps[i].gate !== 'note') continue;
    const next = steps[(i + 1) % STEP_COUNT];
    if (next.gate === 'note' && rng() < 0.25) steps[i] = { ...steps[i], slide: true };
  }

  return { steps, root: anchor };
}
