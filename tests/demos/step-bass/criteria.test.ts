// @vitest-environment node
/**
 * What the instrument sounds like, measured rather than asserted from types.
 * Every number here comes from a headless `RealtimeEngine` turned by hand over
 * `processPrepared`, and every measurement is taken **after the master strip** —
 * the fader and its limiter — because that is the signal a visitor hears.
 *
 * Nothing in here may be fixed by moving a constant: the instrument's files are
 * owned elsewhere, so a number that misses its band is reported as measured.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { applyCompiled } from '@/demos/step-bass/stepBassApply';
import { accentMemories, compile, STEP_PPQ } from '@/demos/step-bass/stepBassCompile';
import {
  accentVelocity,
  DEFAULT_BPM,
  KNOB_RANGES,
  MASTER_FADER_PARAM_ID,
  RENDER_NOW,
  STEP_BASS_DEFAULT_KNOBS,
  STEP_BASS_TRACK_ID,
  STEP_COUNT,
} from '@/demos/step-bass/stepBassPatch';
import { FACTORY_PATTERNS } from '@/demos/step-bass/stepBassPatterns';
import type {
  CompiledPattern,
  Knobs,
  LiveParam,
  Pattern,
  ResolvedParamIds,
  Step,
  StepBassWaveform,
} from '@/demos/step-bass/stepBassTypes';
import { masterLimiterStripJson } from '@/utils/masterLimiter';
import * as wasm from '@/wasm/index.js';

const SAMPLE_RATE = 48_000;
const BLOCK = 128;

/** float32 carries about 5.96e-8 per ulp, so two renders within this are one signal. */
const UNCHANGED = 1e-7;

/** A setting quieter than this is a setting that does not sound. */
const AUDIBLE_FLOOR_DBFS = -40;

/** The pattern the instrument opens on. */
const OPENING_PATTERN = FACTORY_PATTERNS[0];

type Engine = InstanceType<typeof wasm.RealtimeEngine>;
type Stereo = [Float32Array, Float32Array];

function report(label: string, value: unknown): void {
  console.info(`  ${label}: ${typeof value === 'object' ? JSON.stringify(value) : value}`);
}

// ------------------------------------------------------------------ rendering

/** Called before each render block, with the frame the block starts at. */
type BlockHook = (engine: Engine, ids: ResolvedParamIds, frame: number) => void;

interface RenderOptions {
  hook?: BlockHook;
  /** Read engine state while the engine is still alive. */
  onFinish?: (engine: Engine, ids: ResolvedParamIds) => void;
}

/**
 * Apply a compiled pattern to a fresh engine, start the transport and turn it
 * for `loops` passes. `applyCompiled` deliberately leaves the transport alone,
 * so starting it is the caller's, exactly as it is in the live and export paths.
 */
function renderCompiled(
  compiled: CompiledPattern,
  loops: number,
  options: RenderOptions = {},
): Stereo {
  const engine = new wasm.RealtimeEngine(compiled.sampleRate, BLOCK, 1024, 1024);
  try {
    const ids = applyCompiled(engine, compiled, 'facade');
    engine.play(RENDER_NOW);
    const total = compiled.clip.lengthSamples * loops;
    const left = new Float32Array(total);
    const right = new Float32Array(total);
    let done = 0;
    while (done < total) {
      const n = Math.min(BLOCK, total - done);
      options.hook?.(engine, ids, done);
      const l = engine.getChannelBuffer(0, BLOCK);
      const r = engine.getChannelBuffer(1, BLOCK);
      l.fill(0, 0, n);
      r.fill(0, 0, n);
      engine.processPrepared(n);
      left.set(l.subarray(0, n), done);
      right.set(r.subarray(0, n), done);
      done += n;
    }
    options.onFinish?.(engine, ids);
    return [left, right];
  } finally {
    engine.destroy();
  }
}

function knobsWith(overrides: Partial<Knobs>): Knobs {
  return { ...STEP_BASS_DEFAULT_KNOBS, ...overrides };
}

function compileWith(
  pattern: Pattern,
  overrides: Partial<Knobs>,
  bpm = DEFAULT_BPM,
): CompiledPattern {
  return compile(pattern, knobsWith(overrides), SAMPLE_RATE, bpm);
}

function renderKnobs(
  pattern: Pattern,
  overrides: Partial<Knobs>,
  loops = 1,
  bpm = DEFAULT_BPM,
): Stereo {
  return renderCompiled(compileWith(pattern, overrides, bpm), loops);
}

// ------------------------------------------------------------- pattern edits

function withStep(pattern: Pattern, index: number, patch: Partial<Step>): Pattern {
  const steps = pattern.steps.map((step, i) => (i === index ? { ...step, ...patch } : { ...step }));
  return { ...pattern, steps };
}

function withoutAccents(pattern: Pattern): Pattern {
  return { ...pattern, steps: pattern.steps.map((step) => ({ ...step, accent: false })) };
}

function restStep(note: number): Step {
  return { gate: 'rest', note, accent: false, slide: false };
}

function allRest(note: number): Pattern {
  return { root: note, steps: Array.from({ length: STEP_COUNT }, () => restStep(note)) };
}

// ------------------------------------------------------------- measurements

function maxDiff(a: Float32Array, b: Float32Array): number {
  let worst = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const d = Math.abs(a[i] - b[i]);
    if (d > worst) worst = d;
  }
  return worst;
}

function stereoMaxDiff(a: Stereo, b: Stereo): number {
  return Math.max(maxDiff(a[0], b[0]), maxDiff(a[1], b[1]));
}

/** Larger of the two channels' magnitude, sample by sample. */
function mono(channels: Stereo): Float32Array {
  const [left, right] = channels;
  const out = new Float32Array(left.length);
  for (let i = 0; i < left.length; i++) out[i] = Math.max(Math.abs(left[i]), Math.abs(right[i]));
  return out;
}

function peakOf(channels: Stereo): number {
  let peak = 0;
  for (const channel of channels) {
    for (let i = 0; i < channel.length; i++) {
      const v = Math.abs(channel[i]);
      if (v > peak) peak = v;
    }
  }
  return peak;
}

function dbfs(amplitude: number): number {
  return amplitude > 0 ? 20 * Math.log10(amplitude) : Number.NEGATIVE_INFINITY;
}

function peakDbfs(channels: Stereo): number {
  return dbfs(peakOf(channels));
}

function interleave(channels: Stereo): Float32Array {
  const [left, right] = channels;
  const out = new Float32Array(left.length * 2);
  for (let i = 0; i < left.length; i++) {
    out[i * 2] = left[i];
    out[i * 2 + 1] = right[i];
  }
  return out;
}

function integratedLufs(channels: Stereo): number {
  return wasm.lufsInterleaved(interleave(channels), 2, SAMPLE_RATE).integratedLufs;
}

/** Peak magnitude over `[from, to)`. */
function peakBetween(signal: Float32Array, from: number, to: number): number {
  let peak = 0;
  for (let i = Math.max(0, from); i < Math.min(signal.length, to); i++) {
    if (signal[i] > peak) peak = signal[i];
  }
  return peak;
}

/**
 * Master strip carrying the designed fader and no limiter, so the difference
 * between the two renders is the limiter's own gain reduction and nothing else.
 */
function faderOnlyStripJson(faderDb: number): string {
  return JSON.stringify({ strips: [{ id: 'master', faderDb, inserts: [] }] });
}

/**
 * How many frames `delayed` lags `reference` by, as the lag in `[0, maxLag]`
 * with the highest normalised cross-correlation. A limiter changes level and
 * not phase, so its own latency shows up here and nothing else does.
 */
function alignmentLag(reference: Float32Array, delayed: Float32Array, maxLag: number): number {
  const span = Math.min(reference.length - maxLag, delayed.length - maxLag, SAMPLE_RATE);
  let bestLag = 0;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (let lag = 0; lag <= maxLag; lag++) {
    let dot = 0;
    let energy = 0;
    for (let i = 0; i < span; i++) {
      dot += reference[i] * delayed[i + lag];
      energy += delayed[i + lag] * delayed[i + lag];
    }
    const score = energy > 0 ? dot / Math.sqrt(energy) : 0;
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }
  return bestLag;
}

/**
 * Peak gain reduction in dB: the limited and unlimited renders compared block
 * by block over 10 ms envelopes. The limiter's reduction is not readable from
 * the engine's meter telemetry, so it is taken as the difference of two renders
 * — with the limiter's own latency taken out first, or a transient would be
 * compared against a different part of itself.
 */
function gainReductionDb(limited: Stereo, unlimited: Stereo): { reductionDb: number; lag: number } {
  const lag = alignmentLag(unlimited[0], limited[0], 256);
  const limitedEnv = mono(limited);
  const unlimitedEnv = mono(unlimited);
  const blockFrames = Math.round(SAMPLE_RATE * 0.01);
  // Below this the block is the tail of a release, where a ratio is noise.
  const floor = 10 ** (-60 / 20);
  let worst = 0;
  for (let start = 0; start + blockFrames + lag <= limitedEnv.length; start += blockFrames) {
    const lim = peakBetween(limitedEnv, start + lag, start + lag + blockFrames);
    const raw = peakBetween(unlimitedEnv, start, start + blockFrames);
    if (raw < floor || lim <= 0) continue;
    const reduction = 20 * Math.log10(raw / lim);
    if (reduction > worst) worst = reduction;
  }
  return { reductionDb: worst, lag };
}

/** Share of the spectrum's power above `splitHz`, over a slice of one channel. */
function highBandRatio(signal: Float32Array, splitHz: number, nFft = 1024): number {
  const spectrum = wasm.meteringSpectrum(signal, SAMPLE_RATE, { nFft });
  let high = 0;
  let total = 0;
  for (let i = 1; i < spectrum.frequencies.length; i++) {
    const power = spectrum.power[i];
    total += power;
    if (spectrum.frequencies[i] >= splitHz) high += power;
  }
  return total > 0 ? high / total : 0;
}

const CENTROID_FFT = 2048;
const CENTROID_HOP = 256;
/** Frames this far under the loudest one carry a centroid of noise, not of tone. */
const BRIGHTNESS_GATE_DB = -40;
/** The brightness peak belongs to the strike, so it is looked for near the onset. */
const BRIGHTNESS_PEAK_WINDOW_MS = 120;

/** Per-frame RMS on the same centred framing the spectral features use. */
function frameRms(signal: Float32Array, frames: number): Float32Array {
  const out = new Float32Array(frames);
  const half = CENTROID_FFT / 2;
  for (let f = 0; f < frames; f++) {
    const centre = f * CENTROID_HOP;
    let sum = 0;
    let count = 0;
    for (let i = Math.max(0, centre - half); i < Math.min(signal.length, centre + half); i++) {
      sum += signal[i] * signal[i];
      count++;
    }
    out[f] = count > 0 ? Math.sqrt(sum / count) : 0;
  }
  return out;
}

interface BrightnessFall {
  peakHz: number;
  floorHz: number;
  fallMs: number;
}

/**
 * The brightness envelope, read as spectral centroid per frame and gated by
 * level so the near-silent tail does not supply the floor, plus how long the
 * centroid takes to fall from its peak to halfway down to that floor.
 */
function brightnessFall(signal: Float32Array): BrightnessFall {
  const centroid = wasm.spectralCentroid(signal, SAMPLE_RATE, CENTROID_FFT, CENTROID_HOP);
  const rms = frameRms(signal, centroid.length);
  let loudest = 0;
  for (let i = 0; i < rms.length; i++) loudest = Math.max(loudest, rms[i]);
  const gate = loudest * 10 ** (BRIGHTNESS_GATE_DB / 20);
  const audible = (i: number) => rms[i] >= gate;

  const peakWindow = Math.ceil((SAMPLE_RATE * BRIGHTNESS_PEAK_WINDOW_MS) / 1000 / CENTROID_HOP);
  let peakIndex = -1;
  for (let i = 0; i <= Math.min(peakWindow, centroid.length - 1); i++) {
    if (audible(i) && (peakIndex < 0 || centroid[i] > centroid[peakIndex])) peakIndex = i;
  }
  if (peakIndex < 0) return { peakHz: 0, floorHz: 0, fallMs: 0 };

  let floorHz = centroid[peakIndex];
  for (let i = peakIndex + 1; i < centroid.length; i++) {
    if (audible(i)) floorHz = Math.min(floorHz, centroid[i]);
  }
  const halfway = (centroid[peakIndex] + floorHz) / 2;
  const frameMs = (CENTROID_HOP * 1000) / SAMPLE_RATE;
  for (let i = peakIndex + 1; i < centroid.length; i++) {
    if (audible(i) && centroid[i] <= halfway) {
      return { peakHz: centroid[peakIndex], floorHz, fallMs: (i - peakIndex) * frameMs };
    }
  }
  return {
    peakHz: centroid[peakIndex],
    floorHz,
    fallMs: (centroid.length - 1 - peakIndex) * frameMs,
  };
}

/** Mean spectral centroid over a slice, in Hz. */
function meanCentroidHz(signal: Float32Array): number {
  const centroid = wasm.spectralCentroid(signal, SAMPLE_RATE, CENTROID_FFT, CENTROID_HOP);
  let sum = 0;
  for (let i = 0; i < centroid.length; i++) sum += centroid[i];
  return centroid.length > 0 ? sum / centroid.length : 0;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

beforeAll(async () => {
  await wasm.init();
}, 120_000);

// ------------------------------------------------------- no silent setting

interface SweepFixture {
  model: Record<string, (string | number)[]>;
  modelHash: string;
  strength: number;
  seed: number;
  pairCoverage: number;
  columns: string[];
  rows: (string | number)[][];
}

const sweep: SweepFixture = JSON.parse(
  readFileSync(resolve('tests/demos/step-bass/fixtures/sweep.json'), 'utf8'),
);

/** Key-sorted JSON, so the hash depends on the model and not on its spelling. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.keys(value as object)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`,
      );
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

interface SweepRow {
  waveform: StepBassWaveform;
  tuningCents: number;
  cutoffHz: number;
  resonancePct: number;
  envModCents: number;
  decayMs: number;
  accent: number;
}

const sweepRows: SweepRow[] = sweep.rows.map(
  (row) =>
    Object.fromEntries(sweep.columns.map((name, i) => [name, row[i]])) as unknown as SweepRow,
);

describe('every setting a visitor can reach still makes a sound', () => {
  it('holds the sweep model the rows were generated from', () => {
    expect(createHash('sha256').update(stableStringify(sweep.model)).digest('hex')).toBe(
      sweep.modelHash,
    );
    expect(sweep.columns).toEqual(Object.keys(sweep.model));
    expect(sweep.rows.every((row) => row.length === sweep.columns.length)).toBe(true);
  });

  it('renders every pairwise row above the audible floor', () => {
    const peaks = sweepRows.map((row) => {
      const channels = renderKnobs(OPENING_PATTERN.pattern, row, 1);
      return { row, peak: peakDbfs(channels) };
    });
    for (const { row, peak } of peaks) {
      report(
        `${row.waveform} tune ${row.tuningCents} cutoff ${row.cutoffHz} res ${row.resonancePct} env ${row.envModCents} decay ${row.decayMs} accent ${row.accent} — peak dBFS`,
        peak,
      );
    }
    const values = peaks.map((entry) => entry.peak);
    report('sweep peak dBFS min / max', [Math.min(...values), Math.max(...values)]);

    const silent = peaks
      .filter((entry) => entry.peak <= AUDIBLE_FLOOR_DBFS)
      .map((entry) => ({ ...entry.row, peakDbfs: entry.peak }));
    expect(silent).toEqual([]);
  }, 600_000);

  it('leaves out only the two axes whose quiet end is the design, and measures both', () => {
    // The master fader's floor: an output control is supposed to reach silence,
    // so sweeping it would only prove that turning the volume down works.
    const fadedOut = renderKnobs(OPENING_PATTERN.pattern, { faderDb: KNOB_RANGES.faderDb.min }, 1);
    const fadedOutDb = peakDbfs(fadedOut);
    report('master fader at its floor — peak dBFS', fadedOutDb);
    expect(fadedOutDb).toBeLessThan(AUDIBLE_FLOOR_DBFS);

    // A pattern of nothing but rests: silence is the correct rendering of it,
    // and it doubles as the proof that the filter does not sing on its own.
    const noNotes = renderKnobs(allRest(OPENING_PATTERN.pattern.root), { resonancePct: 1 }, 1);
    const noNotesDb = peakDbfs(noNotes);
    report('all-rest pattern at full resonance — peak dBFS', noNotesDb);
    expect(noNotesDb).toBeLessThan(-60);
  }, 120_000);
});

// ------------------------------------------------------- no inert control

interface ControlCase {
  control: string;
  a: () => CompiledPattern;
  b: () => CompiledPattern;
}

const basePattern = OPENING_PATTERN.pattern;
/** A step that speaks a note and is followed by another, so a slide can land. */
const SLIDE_STEP = 4;
/** A step that speaks a note without an accent, for the per-step edits. */
const PLAIN_STEP = 2;

const controlCases: ControlCase[] = [
  {
    control: 'WAVEFORM',
    a: () => compileWith(basePattern, { waveform: 'saw' }),
    b: () => compileWith(basePattern, { waveform: 'square' }),
  },
  {
    control: 'TUNING',
    a: () => compileWith(basePattern, { tuningCents: -900 }),
    b: () => compileWith(basePattern, { tuningCents: 900 }),
  },
  {
    control: 'CUTOFF',
    a: () => compileWith(basePattern, { cutoffHz: 200 }),
    b: () => compileWith(basePattern, { cutoffHz: 6000 }),
  },
  {
    control: 'RESONANCE',
    a: () => compileWith(basePattern, { resonancePct: 0 }),
    b: () => compileWith(basePattern, { resonancePct: 1 }),
  },
  {
    control: 'ENV MOD',
    a: () => compileWith(basePattern, { envModCents: 0 }),
    b: () => compileWith(basePattern, { envModCents: 4800 }),
  },
  {
    // An accented step forces its own filter decay, so the knob is measured on
    // a pattern where no step overrides it.
    control: 'DECAY',
    a: () => compileWith(withoutAccents(basePattern), { decayMs: 200 }),
    b: () => compileWith(withoutAccents(basePattern), { decayMs: 2000 }),
  },
  {
    control: 'ACCENT',
    a: () => compileWith(basePattern, { accent: 0 }),
    b: () => compileWith(basePattern, { accent: 1 }),
  },
  {
    control: 'VOLUME',
    a: () => compileWith(basePattern, { faderDb: -6 }),
    b: () => compileWith(basePattern, { faderDb: 6 }),
  },
  {
    control: 'TEMPO',
    a: () => compileWith(basePattern, {}, 90),
    b: () => compileWith(basePattern, {}, 160),
  },
  {
    control: 'step note',
    a: () => compileWith(withStep(basePattern, PLAIN_STEP, { note: 38 }), {}),
    b: () => compileWith(withStep(basePattern, PLAIN_STEP, { note: 45 }), {}),
  },
  {
    control: 'step gate',
    a: () => compileWith(withStep(basePattern, PLAIN_STEP, { gate: 'note' }), {}),
    b: () => compileWith(withStep(basePattern, PLAIN_STEP, { gate: 'rest' }), {}),
  },
  {
    control: 'step accent',
    a: () => compileWith(withStep(basePattern, PLAIN_STEP, { accent: false }), {}),
    b: () => compileWith(withStep(basePattern, PLAIN_STEP, { accent: true }), {}),
  },
  {
    control: 'step slide',
    a: () => compileWith(withStep(basePattern, SLIDE_STEP, { slide: false }), {}),
    b: () => compileWith(withStep(basePattern, SLIDE_STEP, { slide: true }), {}),
  },
];

describe('no control on the panel leaves the output unchanged', () => {
  it('starts from a pattern that exercises every per-step edit', () => {
    const accented = basePattern.steps.filter((step) => step.accent && step.gate === 'note');
    expect(accented).toHaveLength(2);
    expect(basePattern.steps[PLAIN_STEP].gate).toBe('note');
    expect(basePattern.steps[PLAIN_STEP].accent).toBe(false);
    expect(basePattern.steps[SLIDE_STEP].gate).toBe('note');
    expect(basePattern.steps[SLIDE_STEP + 1].gate).toBe('note');
  });

  it.each(controlCases)(
    '$control changes the render',
    ({ control, a, b }) => {
      const worst = stereoMaxDiff(renderCompiled(a(), 1), renderCompiled(b(), 1));
      report(`${control} — maxdiff between its two values`, worst);
      expect(worst).toBeGreaterThan(UNCHANGED);
    },
    300_000,
  );
});

// ----------------------------------------------------------------- level

describe('output level sits where a mix expects it', () => {
  it('plays the opening pattern between -16 and -12 LUFS over two loops', () => {
    const lufs = integratedLufs(renderKnobs(OPENING_PATTERN.pattern, {}, 2));
    report(`${OPENING_PATTERN.id} — integrated LUFS`, lufs);
    expect(lufs).toBeGreaterThanOrEqual(-16);
    expect(lufs).toBeLessThanOrEqual(-12);
  }, 300_000);

  it('keeps every other factory pattern above -20 LUFS', () => {
    const measured = FACTORY_PATTERNS.slice(1).map((factory) => ({
      id: factory.id,
      lufs: integratedLufs(renderKnobs(factory.pattern, { faderDb: factory.faderDb }, 2)),
    }));
    for (const entry of measured) report(`${entry.id} — integrated LUFS`, entry.lufs);
    expect(measured.filter((entry) => entry.lufs <= -20)).toEqual([]);
  }, 600_000);

  it('never asks the limiter for more than 6 dB of gain reduction', () => {
    const measured = FACTORY_PATTERNS.map((factory) => {
      const knobs = knobsWith({ faderDb: factory.faderDb });
      const limited = compile(factory.pattern, knobs, SAMPLE_RATE, DEFAULT_BPM);
      const unlimited: CompiledPattern = {
        ...limited,
        masterStripJson: faderOnlyStripJson(factory.faderDb),
      };
      // The designed strip is the fader plus its limiter; the comparison render
      // keeps the fader and drops the limiter, so the gap is the limiter alone.
      expect(limited.masterStripJson).toBe(masterLimiterStripJson(factory.faderDb));
      return {
        id: factory.id,
        ...gainReductionDb(renderCompiled(limited, 2), renderCompiled(unlimited, 2)),
      };
    });
    for (const entry of measured) {
      report(
        `${entry.id} — peak gain reduction dB (limiter latency ${entry.lag} frames)`,
        entry.reductionDb,
      );
    }
    report(
      'peak gain reduction dB, worst pattern',
      Math.max(...measured.map((e) => e.reductionDb)),
    );
    expect(measured.filter((entry) => entry.reductionDb > 6)).toEqual([]);
  }, 900_000);
});

// --------------------------------------------------- knobs under a note

/** A block boundary inside the opening pattern's first note, which runs one step. */
const MID_NOTE_FRAME = 3072;

interface LiveKnobCase {
  control: string;
  param: LiveParam | 'faderDb';
  value: number;
}

const liveKnobCases: LiveKnobCase[] = [
  { control: 'CUTOFF', param: 'cutoffHz', value: 4000 },
  { control: 'RESONANCE', param: 'resonanceQ', value: 11.5 },
  { control: 'ENV MOD', param: 'envToCutoffCents', value: 4800 },
  { control: 'TUNING', param: 'pitchOffsetCents', value: 700 },
  { control: 'VOLUME', param: 'faderDb', value: 12 },
];

describe('a knob turned under a sounding note reaches that note', () => {
  it.each(liveKnobCases)(
    '$control moves the note already playing',
    ({ control, param, value }) => {
      const compiled = compileWith(basePattern, {});
      expect(compiled.clip.events[0].renderFrame).toBe(0);
      expect(MID_NOTE_FRAME).toBeLessThan(compiled.clip.events[1].renderFrame);

      let resolvedId: number | undefined;
      const untouched = renderCompiled(compiled, 1);
      const turned = renderCompiled(compiled, 1, {
        hook: (engine, ids, frame) => {
          if (frame !== MID_NOTE_FRAME) return;
          // The reserved master-fader id is addressed directly; the instrument's
          // own parameters are resolved per engine instance.
          resolvedId = param === 'faderDb' ? MASTER_FADER_PARAM_ID : ids[param];
          expect(resolvedId).toBeDefined();
          engine.setParameterSmoothed(resolvedId as number, value);
        },
      });

      const worst = stereoMaxDiff(untouched, turned);
      report(`${control} turned mid-note — maxdiff`, worst);
      expect(resolvedId).toBeDefined();
      expect(worst).toBeGreaterThan(UNCHANGED);
    },
    300_000,
  );
});

// ----------------------------------------------------------------- slide

const SLIDE_FROM_NOTE = 48;
const SLIDE_TO_NOTE = 60;

function slidePattern(): Pattern {
  const steps = Array.from({ length: STEP_COUNT }, () => restStep(SLIDE_FROM_NOTE));
  steps[0] = { gate: 'note', note: SLIDE_FROM_NOTE, accent: false, slide: true };
  steps[1] = { gate: 'note', note: SLIDE_TO_NOTE, accent: false, slide: false };
  return { root: SLIDE_FROM_NOTE, steps };
}

describe('a slide glides into the next note without restriking it', () => {
  const compiled = () => compileWith(slidePattern(), {});
  const onsetFrame = () => Math.round(((SAMPLE_RATE * 60) / DEFAULT_BPM) * STEP_PPQ);

  it('holds the amplitude envelope across the note-on', () => {
    const channels = renderCompiled(compiled(), 1);
    const signal = mono(channels);
    const onset = onsetFrame();
    // One period of the outgoing pitch, so the envelope is a peak over a whole
    // cycle rather than a sample that happened to land on a zero crossing.
    const periodFrames = Math.ceil(SAMPLE_RATE / wasm.midiToHz(SLIDE_FROM_NOTE));
    const ms = (value: number) => Math.round((SAMPLE_RATE * value) / 1000);

    const preceding = peakBetween(signal, onset - ms(10), onset);
    let dip = Number.POSITIVE_INFINITY;
    for (let i = onset - ms(10); i <= onset + ms(8); i++) {
      dip = Math.min(dip, peakBetween(signal, i, i + periodFrames));
    }
    const ratio = dip / preceding;
    report('envelope before the note-on / lowest envelope across it', [preceding, dip]);
    report('slide envelope ratio across the note-on', ratio);
    expect(ratio).toBeGreaterThanOrEqual(0.8);
  }, 300_000);

  it('lands the fundamental between the two pitches 30 ms in', () => {
    const channels = renderCompiled(compiled(), 1);
    const onset = onsetFrame();
    const at = onset + Math.round(SAMPLE_RATE * 0.03);
    const window = channels[0].slice(at - 1024, at + 1024);
    const yin = wasm.pitchYin(window, SAMPLE_RATE, 2048, 512, 100, 600);
    const f0 = median(Array.from(yin.f0).filter((value) => Number.isFinite(value) && value > 0));

    const fromHz = wasm.midiToHz(SLIDE_FROM_NOTE);
    const toHz = wasm.midiToHz(SLIDE_TO_NOTE);
    report('slide endpoints Hz / fundamental 30 ms in', [fromHz, toHz, f0]);
    expect(f0).toBeGreaterThan(fromHz);
    expect(f0).toBeLessThan(toHz);
  }, 300_000);

  it('never falls back off the slurred articulation', () => {
    let fallbacks = -1;
    renderCompiled(compiled(), 1, {
      onFinish: (engine) => {
        fallbacks = engine.legatoFallbackCount(STEP_BASS_TRACK_ID);
      },
    });
    report('legato fallbacks over the slide', fallbacks);
    expect(fallbacks).toBe(0);
  }, 300_000);
});

// ---------------------------------------------------------------- accent

/**
 * The step the accent is measured on. Not the first: a step's lane values have
 * to stand a block before the note-on that latches them, and at the top of the
 * loop there is no earlier place to put them.
 */
const ACCENT_STEP = 2;

/** One note held to the end of the loop, so the brightness envelope has room to fall. */
function heldNotePattern(accent: boolean): Pattern {
  const note = 48;
  const steps: Step[] = Array.from({ length: STEP_COUNT }, () => ({
    gate: 'tie' as const,
    note,
    accent: false,
    slide: false,
  }));
  steps[0] = restStep(note);
  steps[1] = restStep(note);
  steps[ACCENT_STEP] = { gate: 'note', note, accent, slide: false };
  return { root: note, steps };
}

/** The strike, in frames from the top of the loop. */
const ACCENT_ONSET_FRAME = Math.round(((SAMPLE_RATE * 60) / DEFAULT_BPM) * STEP_PPQ * ACCENT_STEP);

/** From the strike onward, so the rests before it never enter a measurement. */
function fromAccentOnset(channels: Stereo): Stereo {
  return [channels[0].subarray(ACCENT_ONSET_FRAME), channels[1].subarray(ACCENT_ONSET_FRAME)];
}

describe('an accent is audible on level, on brightness and on how fast it closes', () => {
  // The DECAY knob at its maximum: at its minimum the accent's own forced decay
  // is the same length the knob already asks for, and the two cannot be told
  // apart. Every other knob is where the instrument opens.
  const knobs = { decayMs: KNOB_RANGES.decayMs.max };
  let plain: Stereo;
  let accented: Stereo;

  beforeAll(() => {
    plain = fromAccentOnset(renderKnobs(heldNotePattern(false), knobs, 1));
    accented = fromAccentOnset(renderKnobs(heldNotePattern(true), knobs, 1));
  }, 300_000);

  it('strikes louder', () => {
    const plainDb = peakDbfs(plain);
    const accentedDb = peakDbfs(accented);
    report('peak dBFS unaccented / accented', [plainDb, accentedDb]);
    report('accent peak delta dB', accentedDb - plainDb);
    expect(accentedDb - plainDb).toBeGreaterThan(0.5);
  });

  it('opens the filter further', () => {
    // The cutoff lift lands at the strike and the accent's own forced decay
    // takes it away again, so the brightness is read over the attack rather
    // than over a window long enough for the two to cancel.
    const attack = (channels: Stereo, ms: number) =>
      channels[0].slice(0, Math.round((SAMPLE_RATE * ms) / 1000));
    for (const ms of [5, 10, 25, 50]) {
      report(`high-band power share over ${ms} ms, unaccented / accented`, [
        highBandRatio(attack(plain, ms), 1000, 256),
        highBandRatio(attack(accented, ms), 1000, 256),
      ]);
    }
    const plainRatio = highBandRatio(attack(plain, 25), 1000);
    const accentedRatio = highBandRatio(attack(accented, 25), 1000);
    report('attack high-band power share unaccented / accented', [plainRatio, accentedRatio]);
    report('accent high-band ratio factor', accentedRatio / plainRatio);
    expect(accentedRatio).toBeGreaterThan(plainRatio * 1.1);
  });

  it('closes the filter sooner', () => {
    const plainFall = brightnessFall(plain[0]);
    const accentedFall = brightnessFall(accented[0]);
    report('brightness peak / floor Hz unaccented', [plainFall.peakHz, plainFall.floorHz]);
    report('brightness peak / floor Hz accented', [accentedFall.peakHz, accentedFall.floorHz]);
    report('brightness half-fall ms unaccented / accented', [
      plainFall.fallMs,
      accentedFall.fallMs,
    ]);
    report('accent half-fall delta ms', plainFall.fallMs - accentedFall.fallMs);
    expect(plainFall.fallMs - accentedFall.fallMs).toBeGreaterThan(20);
  });
});

describe('which way the velocity-to-cutoff amount moves a note', () => {
  /**
   * The accent's brightness is this parameter and nothing else, so which way it
   * moves the filter — and at which velocities it has any leverage — is what
   * decides whether an accent comes out brighter or duller than a plain step.
   * It is referenced to velocity 127: positive darkens, and the further under
   * 127 a note is struck the harder it bites.
   */
  it('reads the parameter against the velocity the step is struck at', () => {
    const measured: Record<string, unknown>[] = [];
    // A lone accent in the lap, so the memory it carries is one strike's worth.
    const memory = accentMemories(heldNotePattern(true).steps, DEFAULT_BPM)[ACCENT_STEP];
    for (const accent of [0, 0.5, 0.75, 1]) {
      const struckAt = accentVelocity(accent, memory);
      const at = (cents: number): CompiledPattern => {
        const compiled = compileWith(heldNotePattern(true), {
          decayMs: KNOB_RANGES.decayMs.max,
          accent,
        });
        return { ...compiled, patch: { ...compiled.patch, velToCutoffCents: cents } };
      };
      const reference = fromAccentOnset(renderCompiled(at(0), 1));
      for (const cents of [-4800, 1200, 4800]) {
        const channels = fromAccentOnset(renderCompiled(at(cents), 1));
        measured.push({
          velocity: struckAt,
          cents,
          peakCentroidHz: brightnessFall(channels[0]).peakHz,
          maxdiffAgainstZero: stereoMaxDiff(reference, channels),
        });
      }
      measured.push({
        velocity: struckAt,
        cents: 0,
        peakCentroidHz: brightnessFall(reference[0]).peakHz,
        maxdiffAgainstZero: 0,
      });
    }
    for (const entry of measured) {
      report(
        `velocity ${entry.velocity}, velToCutoffCents ${entry.cents} — peak centroid Hz / maxdiff against 0`,
        [entry.peakCentroidHz, entry.maxdiffAgainstZero],
      );
    }
    expect(measured.every((entry) => Number.isFinite(entry.peakCentroidHz as number))).toBe(true);
  }, 600_000);
});

// ------------------------------------------------------------ loop stability

/** Block length of the envelope two laps are compared on. */
const ENVELOPE_BLOCK_MS = 10;

/**
 * The 10 ms RMS envelope of both channels together. Two laps are compared on
 * this rather than sample by sample: the oscillator's phase free-runs across the
 * wrap and nothing in the engine returns it at note-on, so no two laps are ever
 * bit-identical however settled the pattern is.
 */
function rmsEnvelope(channels: Stereo): Float32Array {
  const blockFrames = Math.round((SAMPLE_RATE * ENVELOPE_BLOCK_MS) / 1000);
  const blocks = Math.floor(channels[0].length / blockFrames);
  const out = new Float32Array(blocks);
  for (let b = 0; b < blocks; b++) {
    let sum = 0;
    for (let i = b * blockFrames; i < (b + 1) * blockFrames; i++) {
      sum += channels[0][i] * channels[0][i] + channels[1][i] * channels[1][i];
    }
    out[b] = Math.sqrt(sum / (blockFrames * 2));
  }
  return out;
}

/** Largest gap between two envelopes, as a share of the louder one's peak. */
function envelopeDistance(a: Float32Array, b: Float32Array): number {
  let worst = 0;
  let peak = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    worst = Math.max(worst, Math.abs(a[i] - b[i]));
    peak = Math.max(peak, a[i], b[i]);
  }
  return peak > 0 ? worst / peak : 0;
}

/** A lap of a render, by index. */
function lapOf(channels: Stereo, loopFrames: number, index: number): Stereo {
  return [
    channels[0].subarray(index * loopFrames, (index + 1) * loopFrames),
    channels[1].subarray(index * loopFrames, (index + 1) * loopFrames),
  ];
}

/** RMS of a whole lap, both channels: the level the loop holds, without its phase. */
function lapRms(channels: Stereo): number {
  let sum = 0;
  for (let i = 0; i < channels[0].length; i++) {
    sum += channels[0][i] * channels[0][i] + channels[1][i] * channels[1][i];
  }
  return Math.sqrt(sum / (channels[0].length * 2));
}

/** Lap-to-lap drift in level a settled loop stays inside. */
const LAP_LEVEL_TOLERANCE = 0.02;

describe('the loop settles', () => {
  it('keeps playing at the same level lap after lap', () => {
    const compiled = compileWith(basePattern, {});
    const loopFrames = compiled.clip.lengthSamples;
    const channels = renderCompiled(compiled, 4);
    const lap = (index: number) => lapOf(channels, loopFrames, index);

    const levels = [0, 1, 2, 3].map((i) => lapRms(lap(i)));
    for (let i = 0; i < 4; i++)
      report(`lap ${i + 1} peak dBFS / lap RMS`, [peakDbfs(lap(i)), levels[i]]);
    const envelopes = [0, 1, 2, 3].map((i) => rmsEnvelope(lap(i)));
    // Reported, not gated: the free-running oscillator gives every strike a
    // different phase, so the attack energy inside a 10 ms block moves by
    // several dB between laps however settled the pattern is.
    report('envelope distance laps 1-2 / 2-3 / 3-4', [
      envelopeDistance(envelopes[0], envelopes[1]),
      envelopeDistance(envelopes[1], envelopes[2]),
      envelopeDistance(envelopes[2], envelopes[3]),
    ]);
    report('sample maxdiff between the third and fourth laps', stereoMaxDiff(lap(2), lap(3)));

    const drift = Math.abs(levels[3] - levels[2]) / levels[2];
    report('lap level drift, third lap to fourth', drift);
    expect(drift).toBeLessThan(LAP_LEVEL_TOLERANCE);
  }, 600_000);
});

// --------------------------------------------------- lane values at the wrap

describe('what the first step inherits across the loop wrap', () => {
  /**
   * The first step's lane values sit at ppq 0, where no lead is possible — the
   * wrap has nowhere earlier to put them. This measures whether the first step
   * is therefore heard with the last step's lane value still standing. It is a
   * reading, not a gate: the number is reported whichever way it comes out.
   */
  it('measures the first step against a change confined to the last step', () => {
    const note = 36;
    const build = (lastAccent: boolean): Pattern => {
      const steps = Array.from({ length: STEP_COUNT }, () => restStep(note));
      steps[0] = { gate: 'note', note, accent: false, slide: false };
      steps[STEP_COUNT - 1] = { gate: 'note', note: 43, accent: lastAccent, slide: false };
      return { root: note, steps };
    };
    const knobs = { decayMs: KNOB_RANGES.decayMs.max, accent: KNOB_RANGES.accent.max };
    const compiledPlain = compileWith(build(false), knobs);
    const compiledAccented = compileWith(build(true), knobs);
    const loopFrames = compiledPlain.clip.lengthSamples;
    const stepFrames = Math.round(loopFrames / STEP_COUNT);

    const plain = renderCompiled(compiledPlain, 2);
    const accented = renderCompiled(compiledAccented, 2);
    // The second lap, so the measurement sees a wrap rather than a cold start.
    const firstStep = (channels: Stereo): Stereo => [
      channels[0].subarray(loopFrames, loopFrames + stepFrames),
      channels[1].subarray(loopFrames, loopFrames + stepFrames),
    ];
    const plainStep = firstStep(plain);
    const accentedStep = firstStep(accented);

    const plainHz = meanCentroidHz(plainStep[0]);
    const accentedHz = meanCentroidHz(accentedStep[0]);
    const worst = stereoMaxDiff(plainStep, accentedStep);
    report('first step mean centroid Hz, last step plain / accented', [plainHz, accentedHz]);
    report('first step centroid delta Hz across the wrap', accentedHz - plainHz);
    report('first step maxdiff across the wrap', worst);

    expect(Number.isFinite(plainHz)).toBe(true);
    expect(Number.isFinite(accentedHz)).toBe(true);
  }, 600_000);
});
