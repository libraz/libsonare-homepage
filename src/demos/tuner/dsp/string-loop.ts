/**
 * One travelling-wave string loop: a fractional-delay line closed through a
 * one-pole loss lowpass. Faithful port of libsonare's
 * `src/midi/synth/string_loop.h`.
 *
 * A plucked instrument is rarely one loop — a guitar has its second
 * polarization, a harpsichord its 4' companion choir — and each is this same
 * skeleton at a different period, brightness and t60.
 *
 * What the loop deliberately does NOT own is anything that happens *inside* it
 * for one instrument only: the in-loop dispersion allpass, the fret-slap
 * limiter. Those live at the call site, which reads the delayed sample with
 * `advance()`, shapes it, and hands it back through `commit()`. A loop with
 * nothing to shape uses `process()`, which is the two in sequence.
 */
import { DelayLine } from './frac-delay';

const TWO_PI = 2 * Math.PI;

/** A pole this close to the unit circle already rings for minutes. */
const MAX_POLE = 0.995;

/**
 * Per-loop-traversal amplitude factor reaching -60 dB after `t60S`: the -60 dB
 * is spread across however many loop traversals fit in that time.
 */
export function stringLoopGainFor(periodSamples: number, sampleRate: number, t60S: number): number {
  const loopsToT60 = (sampleRate * Math.max(0.01, t60S)) / Math.max(1, periodSamples);
  return Math.exp(-6.907755279 / loopsToT60);
}

/** A solved one-pole loss filter: the feedback coefficient and the gain in front of it. */
export interface StringLoopFilter {
  a: number;
  g: number;
}

/**
 * The root of `a^2 + beta*a + 1 == 0` inside the unit circle. The two roots are
 * reciprocals, so one always is; a complex pair collapses to `-beta/2`.
 */
function stablePole(beta: number): number {
  const disc = beta * beta - 4;
  if (disc <= 0) {
    const collapsed = -0.5 * beta;
    return collapsed < -MAX_POLE ? -MAX_POLE : collapsed > MAX_POLE ? MAX_POLE : collapsed;
  }
  const root = Math.sqrt(disc);
  const hi = 0.5 * (-beta + root);
  const lo = 0.5 * (-beta - root);
  const pick = Math.abs(hi) < Math.abs(lo) ? hi : lo;
  return pick < -MAX_POLE ? -MAX_POLE : pick > MAX_POLE ? MAX_POLE : pick;
}

/**
 * `|H(w)|` of the loss one-pole `y += (1-a)(x-y)`, given `w` in radians per
 * sample. Written as `(1-a)^2 + 4a sin^2(w/2)` rather than the textbook
 * `1 - 2a cos w + a^2`, whose two terms near 2 cancel catastrophically at the
 * dark poles and low fundamentals this solver reaches.
 */
function onepoleMagnitude(a: number, omega: number): number {
  const halfSin = Math.sin(0.5 * omega);
  const poleGap = 1 - a;
  return poleGap / Math.sqrt(Math.max(1e-12, poleGap * poleGap + 4 * a * halfSin * halfSin));
}

/** Phase delay of the loss one-pole at `omega`, in samples. */
export function onepoleGroupDelaySamples(a: number, omega: number): number {
  return Math.atan2(a * Math.sin(omega), 1 - a * Math.cos(omega)) / Math.max(omega, 1e-6);
}

/**
 * Solves the loop's loss filter from what the string has to DO rather than from
 * a tone knob: `gFundamental` is the per-traversal gain the fundamental
 * (`omega0`, radians per sample) must keep, and `gReference` the smaller one the
 * partial at `omegaRef` keeps.
 *
 * Setting the response at two named frequencies is what makes a decay target
 * mean the same thing at every pitch. A one-pole picked for its DC gain is
 * already attenuating a treble fundamental on every traversal, which at over a
 * thousand traversals a second overwhelms whatever t60 was asked for.
 *
 * A single pole can only tilt so far, and an unreachable request costs the tilt,
 * never the note: the fundamental keeps the gain it asked for and the reference
 * partial lands wherever one pole could reach.
 */
export function solveStringLoopFilter(
  omega0: number,
  omegaRef: number,
  gFundamental: number,
  gReference: number,
): StringLoopFilter {
  /** The loop's peak response (at DC, for a lowpass pole) must stay under one. */
  const MAX_LOOP_GAIN = 0.9999;
  /**
   * How many times longer than the fundamental the frequencies under it may
   * ring. A string has no mode down there, but a lowpass in the loop peaks at
   * DC, so the gain that holds the fundamental's t60 always leaves something
   * beneath it ringing longer.
   */
  const MAX_SUB_FUNDAMENTAL_RING = 8;

  const g0 = gFundamental < 0 ? 0 : gFundamental > MAX_LOOP_GAIN ? MAX_LOOP_GAIN : gFundamental;
  const ratio = gReference > 0 ? g0 / gReference : 1;
  const c1 = Math.cos(omega0);

  if (!(ratio > 1.000001)) {
    // The two targets agree: no tilt to build, so the pole is transparent.
    return { a: 0, g: g0 };
  }

  const r2 = ratio * ratio;
  // |H(w0)|/|H(w_ref)| == ratio reduces to a^2 + beta*a + 1 == 0, whose two
  // roots are reciprocals — the stable one is the root inside the unit circle.
  let a = stablePole((-2 * (Math.cos(omegaRef) - r2 * c1)) / (1 - r2));

  // The darkest pole the compensation can still pay for, from the same
  // quadratic — the response the fundamental needs bounds |H(w0)| from below.
  const gMax = Math.min(MAX_LOOP_GAIN, g0 ** (1 / MAX_SUB_FUNDAMENTAL_RING));
  const magFloor = gMax > 0 ? g0 / gMax : 1;
  if (magFloor < 0.999999) {
    const m2 = magFloor * magFloor;
    a = Math.min(a, stablePole((-2 * (1 - m2 * c1)) / (1 - m2)));
  } else {
    // A decay already at the loop's ceiling leaves nothing to compensate with,
    // so the only pole that keeps the fundamental's gain is no pole at all.
    a = Math.min(a, 0);
  }

  // Scale the pole back up so the fundamental keeps exactly the gain it was
  // asked for; without this the pole's own attenuation at w0 is an unaccounted
  // second decay.
  const g = Math.min(MAX_LOOP_GAIN, g0 / Math.max(1e-6, onepoleMagnitude(a, omega0)));
  return { a, g };
}

/**
 * One string loop: a circular delay line read at a fractional offset and closed
 * through a one-pole loss filter and a per-traversal gain.
 */
export class StringLoop {
  /** Delay line. The C++ core carves a span out of a per-voice slab instead. */
  readonly line: DelayLine;

  /** Ideal loop period in samples at `ratio == 1`. */
  period = 0;
  /**
   * Loop delay NOT in the delay line: the one-sample feedback path plus the loss
   * filter's phase delay at the fundamental. A call site with an in-loop allpass
   * adds its phase delay here after `configureFilter()`.
   */
  loopComp = 1;

  /** Loss lowpass `y += alpha * (x - y)`, and its state. */
  alpha = 1;
  lpState = 0;

  /**
   * Per-traversal amplitude factor for the sounding t60, and the one `release()`
   * re-targets it to (the damper).
   */
  gain = 0;
  releaseGain = 0;

  /** Whether the loop is engaged for the current note. */
  private engaged = false;

  constructor(capacity: number) {
    this.line = new DelayLine(capacity);
  }

  /** Active circular span in samples, or 0 while the loop is disengaged. */
  get size(): number {
    return this.engaged ? this.line.size : 0;
  }

  /**
   * Sets the loop up from an already-solved loss filter: `a` is the one-pole's
   * feedback coefficient (the filter is `y += (1-a)(x-y)`, so `a == 0` is
   * transparent and larger `a` is darker) and `g` the per-traversal gain in
   * front of it.
   */
  configureFilter(periodSamples: number, a: number, g: number, releaseG: number): void {
    this.period = periodSamples;
    this.alpha = 1 - a;
    this.lpState = 0;
    this.loopComp = 1 + onepoleGroupDelaySamples(a, TWO_PI / periodSamples);
    this.gain = g;
    this.releaseGain = releaseG;
    this.engaged = true;
    this.line.prime(Math.trunc(periodSamples * 1.3) + 8);
  }

  /**
   * Leaves the loop silent and skipped: a call site gates on its own mix level,
   * and a disengaged loop must not carry state from the last note.
   */
  disable(): void {
    this.engaged = false;
    this.lpState = 0;
    this.gain = 0;
  }

  /**
   * Writes `input` into the line and reads the delayed sample back. `ratio` is
   * the per-sample pitch factor (bend / vibrato / tension), 1 = on pitch; it
   * scales the frequency, so it divides the delay. The returned value is the
   * string's output BEFORE the loss filter — shape it if the instrument shapes
   * it, then hand it to `commit()`.
   */
  advance(input: number, ratio: number): number {
    const span = this.line.size;
    const raw = this.period / ratio - this.loopComp;
    const hi = span - 4;
    const delay = raw < 1 ? 1 : raw > hi ? hi : raw;
    return this.line.processFractional(Math.trunc(delay * 256), input);
  }

  /** Closes the loop: the (possibly shaped) delayed sample enters the loss filter. */
  commit(shaped: number): void {
    this.lpState += this.alpha * (shaped - this.lpState);
  }

  /** `advance()` then `commit()`, for a loop with nothing shaped inside it. */
  process(input: number, ratio: number): number {
    const out = this.advance(input, ratio);
    this.commit(out);
    return out;
  }

  /** The feedback term to add into the next sample's loop input. */
  feedback(): number {
    return this.gain * this.lpState;
  }

  /**
   * Note-off: re-target the decay to the damped t60. Never lengthens a decay
   * that is already shorter than the damper's.
   */
  release(): void {
    this.gain = Math.min(this.gain, this.releaseGain);
  }

  /** Immediate silence. */
  kill(): void {
    this.gain = 0;
    this.lpState = 0;
  }
}
