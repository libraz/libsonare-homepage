/**
 * Oracle auto-fit: a gradient-free search over an engine's `*PatchParams` box
 * that approximates an imported target sound (the "oracle"). Renders are
 * bit-deterministic for a given `(spec, note, velocity)` — `renderNoteOffline`
 * always seeds the voice with `voiceIndex=0, age=0`, so the only "noise" is the
 * oracle-vs-model excitation mismatch, which the seed-robust spectral/RMS
 * envelope metrics already absorb (no per-eval averaging needed).
 *
 * The optimizer is Differential Evolution (DE/best/1/bin) in normalized box
 * coordinates: a small population gives global coverage of a rugged, coupled,
 * multimodal loss surface; bounds are trivial (reflection); and the
 * per-generation structure maps onto progress, cancellation and live preview.
 * Pure TS with no DOM/Vue — runnable in a Worker and in Node tests.
 */
import { correlation, rmsEnvelope, spectralEnvelope } from './compareMetrics';
import { type ModelSpec, renderNoteOffline } from './engine';
import { paramSpecsFor } from './params';

/** A scalar parameter the optimizer may vary, with its box bounds + detent. */
export interface FitDim {
  key: string;
  min: number;
  max: number;
  step: number;
}

export interface AutofitOptions {
  /** Hard cap on generations. */
  maxGen: number;
  /** Wall-clock cap in milliseconds (checked per generation). */
  wallClockMs: number;
  /** PRNG seed — a fixed value makes a run reproducible/testable. */
  rngSeed: number;
}

export const DEFAULT_AUTOFIT_OPTIONS: AutofitOptions = {
  maxGen: 40,
  wallClockMs: 30000,
  rngSeed: 0x9e3779b9,
};

export interface AutofitProgress {
  gen: number;
  evals: number;
  /** Monotone 0..1 fraction of the budget consumed. */
  progress: number;
  bestLoss: number;
  specSimPct: number;
  rmsErrorPct: number;
  /** The best spec so far, for live preview (already gain-folded). */
  bestSpec: ModelSpec;
}

export interface AutofitResult {
  bestSpec: ModelSpec;
  bestLoss: number;
  specSimPct: number;
  rmsErrorPct: number;
  evals: number;
  elapsedMs: number;
  /** True when the search converged before hitting the budget. */
  converged: boolean;
  /** Number of parameters that were varied. */
  dims: number;
}

/**
 * Params kept fixed during a fit: boolean toggles (flipping topology makes the
 * surface discontinuous — the user sets these by intent), structural/mapping
 * integers that gate tables the optimizer can't co-edit, and dimensions the
 * single-note fixed-velocity render can't observe (`velToBrightness`,
 * `keyoffNoise`, `releaseDampS` — the fit never releases the note).
 */
const FROZEN_KEYS = new Set<string>([
  'numModes',
  'rankCount',
  'shellNumModes',
  'strings',
  'exclusiveClass',
  'gmKit',
  'noiseOutput',
  'vowel',
  'velToBrightness',
  'velToBreath',
  'keyoffNoise',
  'releaseDampS',
]);

/** The scalar dimensions the optimizer varies for a spec's active engine. */
export function fitDimensions(spec: ModelSpec): FitDim[] {
  const specs = paramSpecsFor(activeParamsOf(spec));
  const out: FitDim[] = [];
  for (const ps of specs) {
    if (ps.bool || FROZEN_KEYS.has(ps.key)) continue;
    if (ps.max <= ps.min) continue;
    out.push({ key: ps.key, min: ps.min, max: ps.max, step: ps.step });
  }
  return out;
}

/** Small deterministic PRNG (mulberry32) — reproducible runs. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The active engine's deep-params object (the optimizer's mutation target). */
function activeParamsOf(spec: ModelSpec): Record<string, unknown> {
  switch (spec.engineMode) {
    case 'karplus-strong':
      return spec.ks as unknown as Record<string, unknown>;
    case 'modal':
      return spec.modal as unknown as Record<string, unknown>;
    case 'bowed-string':
      return spec.bowed as unknown as Record<string, unknown>;
    case 'reed':
      return spec.reed as unknown as Record<string, unknown>;
    case 'brass':
      return spec.brass as unknown as Record<string, unknown>;
    case 'flute':
      return spec.flute as unknown as Record<string, unknown>;
    case 'piano':
      return spec.piano as unknown as Record<string, unknown>;
    case 'pipe-organ':
      return spec.pipeOrgan as unknown as Record<string, unknown>;
    case 'percussion':
      return spec.percussion as unknown as Record<string, unknown>;
    case 'plucked-string':
      return spec.pluckedString as unknown as Record<string, unknown>;
    case 'vocal':
      return spec.vocal as unknown as Record<string, unknown>;
    case 'free-reed':
      return spec.freeReed as unknown as Record<string, unknown>;
  }
}

function cloneSpec(spec: ModelSpec): ModelSpec {
  return JSON.parse(JSON.stringify(spec));
}

/** Root-mean-square of a slice. */
function rms(buf: Float32Array, from = 0, to = buf.length): number {
  let s = 0;
  const n = Math.max(0, to - from);
  if (n === 0) return 0;
  for (let i = from; i < to; ++i) s += buf[i] * buf[i];
  return Math.sqrt(s / n);
}

/** Thrown when the oracle is too short/quiet to fit against. */
export class OracleTooShortError extends Error {
  constructor() {
    super('oracle too short');
    this.name = 'OracleTooShortError';
  }
}

/**
 * Trim leading silence and peak-normalize an imported oracle buffer so it aligns
 * at note-on (frame 0) like the model renders and carries a comparable level.
 */
export function prepareOracle(raw: Float32Array, sampleRate: number): Float32Array {
  let peak = 0;
  for (let i = 0; i < raw.length; ++i) {
    const a = Math.abs(raw[i]);
    if (a > peak) peak = a;
  }
  if (peak < 1e-4) throw new OracleTooShortError();
  // Onset: first sample above -34 dBFS of peak, backed off a hair for the attack.
  const thresh = 0.02 * peak;
  let onset = 0;
  for (let i = 0; i < raw.length; ++i) {
    if (Math.abs(raw[i]) > thresh) {
      onset = Math.max(0, i - 128);
      break;
    }
  }
  const trimmed = raw.subarray(onset);
  if (trimmed.length < 0.35 * sampleRate) throw new OracleTooShortError();
  const out = new Float32Array(trimmed.length);
  const norm = 0.9 / peak;
  for (let i = 0; i < trimmed.length; ++i) out[i] = trimmed[i] * norm;
  return out;
}

/** Precomputed oracle features (built once, reused every evaluation). */
interface OracleFeatures {
  fitLen: number;
  from: number;
  lateFrom: number; // -1 when the oracle is too short for a late window
  specEarly: number[];
  specLate: number[] | null;
  rmsEnv: number[];
  rmsFull: number;
}

function oracleFeatures(oracle: Float32Array, frames: number, sampleRate: number): OracleFeatures {
  const fitLen = Math.min(oracle.length, frames);
  const from = Math.min(Math.floor(sampleRate * 0.06), Math.max(0, fitLen - 16384));
  const hasLate = fitLen >= 0.9 * sampleRate;
  const lateFrom = hasLate ? fitLen - 16384 : -1;
  const slice = oracle.subarray(0, fitLen);
  return {
    fitLen,
    from,
    lateFrom,
    specEarly: spectralEnvelope(oracle, from, sampleRate),
    specLate: hasLate ? spectralEnvelope(oracle, lateFrom, sampleRate) : null,
    rmsEnv: rmsEnvelope(slice, 512),
    rmsFull: rms(slice),
  };
}

/** Relative L2 error of two RMS envelopes (identical formula to computeMetrics). */
function rmsEnvError(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let errSq = 0;
  let refSq = 0;
  for (let i = 0; i < n; ++i) {
    const d = a[i] - b[i];
    errSq += d * d;
    refSq += b[i] * b[i];
  }
  return refSq > 0 ? Math.min(1.5, Math.sqrt(errSq / refSq)) : 1.5;
}

interface EvalResult {
  loss: number;
  gain: number;
  /** Spectral-envelope correlation (→ specSimPct, like computeMetrics). */
  specCorr: number;
  /** Relative RMS-envelope L2 error (→ rmsErrorPct/100, capped at 1.5). */
  rmsTerm: number;
}

/** Gain-invariant spectral+RMS loss of a spec against the oracle features. */
function evalLoss(
  spec: ModelSpec,
  f: OracleFeatures,
  note: number,
  velocity: number,
  sampleRate: number,
): EvalResult {
  const buf = renderNoteOffline(spec, note, velocity, sampleRate, f.fitLen);
  const bufRms = rms(buf);
  const gain = Math.min(1e3, Math.max(1e-3, f.rmsFull / Math.max(bufRms, 1e-6)));
  // Correlation is gain-invariant; the render is only scaled for the RMS term.
  let specCorr = correlation(spectralEnvelope(buf, f.from, sampleRate), f.specEarly);
  if (f.specLate && f.lateFrom >= 0) {
    const late = correlation(spectralEnvelope(buf, f.lateFrom, sampleRate), f.specLate);
    specCorr = 0.5 * (specCorr + late);
  }
  const scaled = new Float32Array(buf.length);
  for (let i = 0; i < buf.length; ++i) scaled[i] = buf[i] * gain;
  const rmsTerm = rmsEnvError(rmsEnvelope(scaled, 512), f.rmsEnv);
  const loss = 0.65 * (1 - specCorr) + 0.35 * rmsTerm;
  return { loss, gain, specCorr, rmsTerm };
}

function specSimOf(specCorr: number): number {
  return Math.max(0, Math.min(100, specCorr * 100));
}

function rmsErrOf(rmsTerm: number): number {
  return Math.min(999, rmsTerm * 100);
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/** Fold a normalized vector back into a spec (denormalize + optional quantize). */
function applyVector(spec: ModelSpec, dims: FitDim[], x: number[], quantize: boolean): ModelSpec {
  const next = cloneSpec(spec);
  const params = activeParamsOf(next);
  for (let j = 0; j < dims.length; ++j) {
    const d = dims[j];
    let v = d.min + clamp01(x[j]) * (d.max - d.min);
    if (quantize && d.step > 0) v = d.min + Math.round((v - d.min) / d.step) * d.step;
    params[d.key] = Math.min(d.max, Math.max(d.min, v));
  }
  return next;
}

function normalizeSpec(spec: ModelSpec, dims: FitDim[]): number[] {
  const params = activeParamsOf(spec);
  return dims.map((d) => {
    const raw = Number(params[d.key] ?? d.min);
    return clamp01((raw - d.min) / (d.max - d.min));
  });
}

/**
 * Run the fit. Yields once per generation (progress + best-so-far for live
 * preview) and returns the final result. The oracle must already be prepared
 * (trimmed + normalized) via {@link prepareOracle}.
 */
export async function* runAutofit(
  startSpec: ModelSpec,
  oracle: Float32Array,
  note: number,
  velocity: number,
  sampleRate: number,
  frames: number,
  opts: AutofitOptions,
): AsyncGenerator<AutofitProgress, AutofitResult, void> {
  const t0 = Date.now();
  const dims = fitDimensions(startSpec);
  const f = oracleFeatures(oracle, frames, sampleRate);
  const d = dims.length;

  const finalize = (
    spec: ModelSpec,
    r: EvalResult,
    converged: boolean,
    evals: number,
  ): AutofitResult => {
    const applied = cloneSpec(spec);
    applied.gain = Math.min(1.5, Math.max(0, applied.gain * r.gain));
    return {
      bestSpec: applied,
      bestLoss: r.loss,
      specSimPct: specSimOf(r.specCorr),
      rmsErrorPct: rmsErrOf(r.rmsTerm),
      evals,
      elapsedMs: Date.now() - t0,
      converged,
      dims: d,
    };
  };

  // Nothing tunable (e.g. a bool-only engine): return the start unchanged.
  if (d === 0) {
    const start = evalLoss(startSpec, f, note, velocity, sampleRate);
    return finalize(startSpec, start, true, 1);
  }

  const rng = mulberry32(opts.rngSeed);
  const NP = Math.max(12, Math.min(24, 2 * d));
  const CR = 0.9;

  // Population: user's start, engine default-ish (the start again as a safe
  // second anchor), then a Latin-hypercube spread so the box is covered.
  const pop: number[][] = [];
  pop.push(normalizeSpec(startSpec, dims));
  pop.push(normalizeSpec(startSpec, dims).map((v) => clamp01(v + (rng() - 0.5) * 0.1)));
  for (let i = 2; i < NP; ++i) {
    pop.push(dims.map((_, j) => clamp01((j + rng()) / d + (rng() - 0.5) * 0.2)));
  }

  let evals = 0;
  const fit: number[] = [];
  const results: EvalResult[] = [];
  for (let i = 0; i < NP; ++i) {
    const r = evalLoss(applyVector(startSpec, dims, pop[i], false), f, note, velocity, sampleRate);
    fit.push(r.loss);
    results.push(r);
    ++evals;
  }
  let best = 0;
  for (let i = 1; i < NP; ++i) if (fit[i] < fit[best]) best = i;

  const lossHistory: number[] = [];
  let converged = false;

  for (let gen = 1; gen <= opts.maxGen; ++gen) {
    for (let i = 0; i < NP; ++i) {
      // DE/best/1: mutate around the incumbent best with a random difference.
      let r1 = i;
      let r2 = i;
      while (r1 === i) r1 = Math.floor(rng() * NP);
      while (r2 === i || r2 === r1) r2 = Math.floor(rng() * NP);
      const F = 0.5 + 0.3 * rng();
      const jrand = Math.floor(rng() * d);
      const trial = new Array<number>(d);
      for (let j = 0; j < d; ++j) {
        let v = pop[i][j];
        if (rng() < CR || j === jrand) {
          v = pop[best][j] + F * (pop[r1][j] - pop[r2][j]);
          // Reflection repair into [0,1].
          if (v < 0) v = -v;
          else if (v > 1) v = 2 - v;
          v = clamp01(v);
        }
        trial[j] = v;
      }
      const r = evalLoss(applyVector(startSpec, dims, trial, false), f, note, velocity, sampleRate);
      ++evals;
      if (r.loss < fit[i]) {
        pop[i] = trial;
        fit[i] = r.loss;
        results[i] = r;
        if (r.loss < fit[best]) best = i;
      }
    }

    const bestLoss = fit[best];
    const br = results[best];
    const previewSpec = cloneSpec(applyVector(startSpec, dims, pop[best], false));
    previewSpec.gain = Math.min(1.5, Math.max(0, previewSpec.gain * br.gain));
    const progress = Math.max(gen / opts.maxGen, (Date.now() - t0) / opts.wallClockMs);
    yield {
      gen,
      evals,
      progress: Math.min(1, progress),
      bestLoss,
      specSimPct: specSimOf(br.specCorr),
      rmsErrorPct: rmsErrOf(br.rmsTerm),
      bestSpec: previewSpec,
    };

    // Early stop: <0.5% relative improvement over the last 8 generations.
    lossHistory.push(bestLoss);
    if (lossHistory.length > 8) {
      const past = lossHistory[lossHistory.length - 9];
      if (past > 0 && (past - bestLoss) / past < 0.005) {
        converged = true;
        break;
      }
    }
    if (Date.now() - t0 >= opts.wallClockMs) break;
    // Let the worker flush the progress post before the next generation.
    await Promise.resolve();
  }

  // Quantize the winner to legal detents, re-evaluate, and fold in the gain.
  const quantized = applyVector(startSpec, dims, pop[best], true);
  const finalEval = evalLoss(quantized, f, note, velocity, sampleRate);
  ++evals;
  return finalize(quantized, finalEval, converged, evals);
}
