/**
 * Bowed-string (friction-excited) core — the violin / viola / cello / contrabass
 * family. Faithful port of libsonare's `src/midi/synth/bowed_string_voice.{h,cpp}`
 * (McIntyre, Schumacher & Woodhouse 1983; Smith's digital-waveguide bowed string).
 *
 * A Smith single-junction digital waveguide: the string is split at the bow
 * contact point into two travelling-wave delay lines (`neck` = bow->nut and
 * `bridge` = bow->bridge) coupled by a nonlinear scattering junction — a
 * memoryless "bow table" that maps the differential velocity (bow minus string)
 * to a friction coefficient. That one stick-slip nonlinearity produces the
 * Helmholtz sawtooth motion and sustains the tone as long as the bow keeps
 * moving. The optional extensions (elasto-plastic friction, sympathetic
 * resonance, second polarization) all render inert at zero — the plain
 * waveguide is recovered.
 */
import { DelayLine } from './frac-delay';
import { VoiceRandomSequence } from './voice-random';

const PI = Math.PI;
const TWO_PI = 2 * Math.PI;
const BOWED_MIN_FUNDAMENTAL_HZ = 20;

// Bow-velocity calibration: the differential-velocity input the bow table sees
// is a small quantity. maxVelocity = base + span*speed.
const BOW_VELOCITY_BASE = 0.03;
const BOW_VELOCITY_SPAN = 0.14;

// Rosin texture depth: a light seeded jitter on the bow velocity.
const ROSIN_DEPTH = 0.15;

// Live-control smoothing time (ms).
const CONTROL_SMOOTH_MS = 8;

// Bow-table friction-curve slope from bow force (slope in [1,5], harder force ->
// lower slope -> wider sticking region).
const BOW_SLOPE_MAX = 5;
const BOW_SLOPE_SPAN = 4;

// --- elasto-plastic friction calibration (only when params.elastoPlastic) ---
const EP_STRIBECK_BASE = 0.02;
const EP_STRIBECK_SPAN = 0.1;
const EP_Z_MAX = 0.25;
const EP_BREAKAWAY_FRAC = 0.15;
const EP_LOAD_TIME_MS = 0.15;
const EP_ZSS_FLOOR = 0.1;
const EP_HYST_OFFSET = 0.6;

// --- sympathetic open-string resonance (only when params.sympathetic > 0) ---
const SYMPATHETIC_MODES = 8;
const SYMPATHETIC_NOTES = [28, 35, 42, 49, 55, 62, 69, 76];
const SYMPATHETIC_RING_S = 1.2;
const SYMPATHETIC_OUT_GAIN = 0.1;

// --- second (horizontal) polarization (only when params.polarization > 0) ---
const POL_DETUNE_CENTS = 7;
const POL_LOSS = 0.93;
const POL_LP_POLE = 0.35;
const POL_DRIVE = 0.35;
const POL_COUPLE_MAX = 0.2;
const POL_RADIATION = 0.25;

/** Bowed-string section of a patch (1:1 with C++ `BowedStringPatchParams`). */
export interface BowedStringPatchParams {
  /** Bow contact point as a fraction of the string length from the bridge (0..0.5). */
  bowPosition: number;
  /** Bow force / downward pressure in [0,1] (friction-curve slope). */
  bowForce: number;
  /** Bow speed in [0,1] (dynamic level). */
  bowSpeed: number;
  /** Note velocity -> bow speed in [0,1]. */
  velToSpeed: number;
  /** Bridge reflection-filter openness in [0,1] (loop lowpass). */
  brightness: number;
  /** String damping in [0,1] (bridge loop loss). */
  damping: number;
  /** Bow acceleration on note-on (ms). */
  attackMs: number;
  /** Bow deceleration on note-off (ms). */
  releaseMs: number;
  /** Rosin texture in [0,1] (deterministic bow-velocity noise). */
  rosin: number;
  /** Elasto-plastic bow friction (single-bristle hysteresis); off by default. */
  elastoPlastic: boolean;
  /** Stribeck velocity scale in [0,1] (only when elastoPlastic). */
  stribeck: number;
  /** Sympathetic (open-string) resonance in [0,1]; 0 = off. */
  sympathetic: number;
  /** Second-polarization coupling in [0,1]; 0 = off. */
  polarization: number;
}

/** The C++ struct's default member initializers, verbatim. */
export function defaultBowedParams(): BowedStringPatchParams {
  return {
    bowPosition: 0.13,
    bowForce: 0.5,
    bowSpeed: 0.5,
    velToSpeed: 0.6,
    brightness: 0.5,
    damping: 0.4,
    attackMs: 60,
    releaseMs: 120,
    rosin: 0,
    elastoPlastic: false,
    stribeck: 0.5,
    sympathetic: 0,
    polarization: 0,
  };
}

/** Per-line delay-buffer capacity (samples): one string period at the lowest fundamental. */
export function bowedBufferCapacity(sampleRate: number): number {
  const sr = sampleRate > 0 ? sampleRate : 48000;
  return Math.trunc(sr / BOWED_MIN_FUNDAMENTAL_HZ) + 8;
}

function noteToHz(note: number): number {
  return 440 * 2 ** (((note & 0x7f) - 69) / 12);
}

/** One-pole ramp coefficient reaching ~95% of the target in `ms`. */
function rampCoeff(ms: number, sampleRate: number): number {
  const t = Math.max(0.5, ms) * 0.001 * sampleRate;
  return 1 - Math.exp(-3 / Math.max(1, t));
}

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

interface SympatheticMode {
  a1: number;
  a2: number;
  gain: number;
  y1: number;
  y2: number;
}

function emptySympatheticMode(): SympatheticMode {
  return { a1: 0, a2: 0, gain: 0, y1: 0, y2: 0 };
}

export class BowedStringVoiceCore {
  private neck: DelayLine;
  private bridge: DelayLine;
  private pol: DelayLine;
  private neckSize = 0;
  private bridgeSize = 0;
  private neckOut = 0;
  private bridgeOut = 0;

  // Tuning.
  private basePeriod = 0;
  private beta = 0.13;
  private comp = 2;

  // Bridge reflection.
  private lpAlpha = 1;
  private lpState = 0;
  private lossGain = 0.95;

  // Bow table.
  private bowSlope = 3;
  private bowOffset = 0;

  // Bow velocity contour.
  private maxBowVelocity = 0.1;
  private bowLevel = 0;
  private attackCoeff = 0;
  private releaseCoeff = 0;
  private releasing = false;

  // Live-control smoothing.
  private baseBowVelocity = 0.1;
  private bowSpeedTarget = 0.1;
  private slopeTarget = 3;
  private betaTarget = 0.13;
  private ctrlCoeff = 1;

  // Output trim.
  private outputScale = 1.2;

  // Rosin texture.
  private rosinLevel = 0;
  private noise = new VoiceRandomSequence();
  private driveIndex = 0;

  // Elasto-plastic friction.
  private elastoPlastic = false;
  private bristleZ = 0;
  private epStribeckV = 0.1;
  private epLoadRate = 0;
  private epZBa = 0;
  private epZMax = 0;

  // Sympathetic bank.
  private sympathetic: SympatheticMode[] = Array.from(
    { length: SYMPATHETIC_MODES },
    emptySympatheticMode,
  );
  private sympatheticMix = 0;

  // Second (horizontal) polarization.
  private polSize = 0;
  private polOut = 0;
  private polPeriod = 0;
  private polLpState = 0;
  private polLpAlpha = 1;
  private polLoss = 0.95;
  private polCouple = 0;
  private polDrive = 0;

  constructor(sampleRate: number) {
    const cap = bowedBufferCapacity(sampleRate);
    this.neck = new DelayLine(cap);
    this.bridge = new DelayLine(cap);
    this.pol = new DelayLine(cap);
  }

  start(
    params: BowedStringPatchParams,
    sampleRate: number,
    note: number,
    velocity: number,
    seed: bigint,
  ): void {
    const sr = sampleRate > 0 ? sampleRate : 48000;
    this.noise = new VoiceRandomSequence(seed);
    this.driveIndex = 0;
    this.releasing = false;
    this.bowLevel = 0;
    this.lpState = 0;
    this.neckOut = 0;
    this.bridgeOut = 0;

    const f0 = noteToHz(note);
    this.basePeriod = sr / Math.max(1, f0);
    this.beta = clamp(params.bowPosition, 0.02, 0.5);
    this.betaTarget = this.beta;

    const vel01 = (velocity & 0x7f) / 127;
    // Bow speed = the dynamic level: patch speed blended with struck velocity.
    const velToSpeed = clamp(params.velToSpeed, 0, 1);
    const speed = clamp((1 - velToSpeed) * params.bowSpeed + velToSpeed * vel01, 0, 1);
    this.baseBowVelocity = BOW_VELOCITY_BASE + BOW_VELOCITY_SPAN * speed;
    this.maxBowVelocity = this.baseBowVelocity;
    this.bowSpeedTarget = this.baseBowVelocity;

    // Bow force -> friction-curve slope.
    const force = clamp(params.bowForce, 0, 1);
    this.bowSlope = BOW_SLOPE_MAX - BOW_SLOPE_SPAN * force;
    this.slopeTarget = this.bowSlope;
    this.bowOffset = 0;

    this.ctrlCoeff = rampCoeff(CONTROL_SMOOTH_MS, sr);

    // Bridge loop lowpass: brightness -> pole a (y += (1-a)(x - y)).
    const a = (1 - clamp(params.brightness, 0, 1)) * 0.7;
    this.lpAlpha = 1 - a;
    // String damping -> bridge loss gain (< 1 so the loop is stable).
    this.lossGain = clamp(0.99 - 0.09 * clamp(params.damping, 0, 1), 0.8, 0.999);

    // Tuning compensation: two feedback registers (~2 samples) plus the bridge
    // lowpass's phase delay at the fundamental.
    const omega = TWO_PI / Math.max(1, this.basePeriod);
    const tauLp = Math.atan2(a * Math.sin(omega), 1 - a * Math.cos(omega)) / Math.max(omega, 1e-6);
    this.comp = 2 + tauLp;

    // Circular spans sized for the whole period (plus bend-down and stencil margin).
    const eff = Math.max(2, this.basePeriod - this.comp);
    const fullSpan = Math.trunc(eff * 1.3) + 8;
    this.neckSize = Math.min(this.neck.capacity, Math.max(16, fullSpan));
    this.bridgeSize = Math.min(this.bridge.capacity, Math.max(16, fullSpan));
    this.neck.prime(this.neckSize);
    this.bridge.prime(this.bridgeSize);

    // Bow velocity contour.
    this.attackCoeff = rampCoeff(params.attackMs, sr);
    this.releaseCoeff = rampCoeff(params.releaseMs, sr);

    this.rosinLevel = clamp(params.rosin, 0, 1) * ROSIN_DEPTH;

    // Elasto-plastic friction (off by default -> render keeps the static-table branch).
    this.elastoPlastic = params.elastoPlastic;
    this.bristleZ = 0;
    if (this.elastoPlastic) {
      const stribeck01 = clamp(params.stribeck, 0, 1);
      this.epStribeckV = EP_STRIBECK_BASE + EP_STRIBECK_SPAN * stribeck01;
      this.epZMax = EP_Z_MAX;
      this.epZBa = EP_BREAKAWAY_FRAC * EP_Z_MAX;
      this.epLoadRate = rampCoeff(EP_LOAD_TIME_MS, sr);
    }

    // Sympathetic open-string bank (off by default -> render skips it entirely).
    const sympathetic = clamp(params.sympathetic, 0, 1);
    this.sympatheticMix = sympathetic > 0 ? SYMPATHETIC_OUT_GAIN * sympathetic : 0;
    if (this.sympatheticMix > 0) {
      const srf = sr;
      const r = Math.exp(-6.907755279 / (srf * SYMPATHETIC_RING_S));
      for (let i = 0; i < SYMPATHETIC_MODES; ++i) {
        const m = this.sympathetic[i];
        const freq = noteToHz(SYMPATHETIC_NOTES[i]);
        m.y1 = 0;
        m.y2 = 0;
        if (freq >= 0.45 * srf) {
          m.a1 = 0;
          m.a2 = 0;
          m.gain = 0;
          continue;
        }
        const w = (TWO_PI * freq) / srf;
        m.a1 = 2 * r * Math.cos(w);
        m.a2 = -r * r;
        m.gain = 1 - r; // unity-peak (cancels the high-Q resonant boost)
      }
    }

    // Second (horizontal) polarization (off by default -> render skips it).
    const polarization = clamp(params.polarization, 0, 1);
    this.polCouple = polarization > 0 ? POL_COUPLE_MAX * polarization : 0;
    this.polOut = 0;
    this.polLpState = 0;
    if (this.polCouple > 0) {
      this.polPeriod = this.basePeriod * 2 ** (POL_DETUNE_CENTS / 1200);
      this.polLpAlpha = 1 - POL_LP_POLE;
      this.polLoss = POL_LOSS;
      this.polDrive = POL_DRIVE;
      this.polSize = this.neckSize; // sized for a full detuned period
      this.pol.prime(this.polSize);
    }
  }

  render(pitchRatio: number): number {
    if (this.neckSize < 8 || this.bridgeSize < 8) return 0;
    const ratio = pitchRatio > 0.01 ? pitchRatio : 0.01;

    // Live control: ramp the bow speed / force / position toward their targets.
    this.maxBowVelocity += this.ctrlCoeff * (this.bowSpeedTarget - this.maxBowVelocity);
    this.bowSlope += this.ctrlCoeff * (this.slopeTarget - this.bowSlope);
    this.beta += this.ctrlCoeff * (this.betaTarget - this.beta);

    // Bow velocity: ramp toward the target (1 while bowing, 0 once lifted).
    const target = this.releasing ? 0 : 1;
    const coeff = this.releasing ? this.releaseCoeff : this.attackCoeff;
    this.bowLevel += coeff * (target - this.bowLevel);
    let bowV = this.maxBowVelocity * this.bowLevel;
    if (this.rosinLevel > 0) {
      bowV += this.maxBowVelocity * this.rosinLevel * this.noise.bipolarAt(this.driveIndex);
    }

    // Reflections from the previous delay-line outputs.
    this.lpState += this.lpAlpha * (this.bridgeOut - this.lpState);
    const bridgeRefl = -this.lossGain * this.lpState;
    const nutRefl = -this.neckOut;

    // String velocity at the bow point.
    const stringPrimary = bridgeRefl + nutRefl;
    let stringV = stringPrimary;
    if (this.polCouple > 0) stringV += this.polCouple * this.polOut;
    const dv = bowV - stringV;

    // Bow friction: the velocity the bow injects equally into both delay lines.
    let vInj: number;
    if (this.elastoPlastic) {
      const dvEp = this.polCouple > 0 ? bowV - stringPrimary : dv;
      vInj = this.elastoPlasticInjection(dvEp);
    } else {
      // Bow table (memoryless friction curve): coeff = 1/(|slope*dv|+0.75)^4 clamped to 1.
      const s = this.bowSlope * dv + this.bowOffset;
      const base = Math.abs(s) + 0.75;
      const base2 = base * base;
      let bowCoeff = 1 / (base2 * base2);
      if (bowCoeff > 1) bowCoeff = 1;
      vInj = dv * bowCoeff;
    }

    // Split the (compensated) period between the two lines and read/write them.
    const eff = Math.max(2, this.basePeriod / ratio - this.comp);
    const neckDelay = clamp((1 - this.beta) * eff, 1, this.neckSize - 4);
    const bridgeDelay = clamp(this.beta * eff, 1, this.bridgeSize - 4);

    // Cross-couple at the junction: each line receives the OTHER side's
    // reflection plus the shared bow injection.
    this.neckOut = this.neck.processFractional(Math.trunc(neckDelay * 256), bridgeRefl + vInj);
    this.bridgeOut = this.bridge.processFractional(Math.trunc(bridgeDelay * 256), nutRefl + vInj);
    ++this.driveIndex;

    // Output is the string velocity at the bridge (what drives the body).
    let dry = this.outputScale * this.bridgeOut;
    if (this.polCouple > 0) {
      this.polLpState += this.polLpAlpha * (this.polOut - this.polLpState);
      const polRefl = -this.polLoss * this.polLpState;
      const polDelay = clamp(this.polPeriod / ratio - this.comp, 1, this.polSize - 4);
      this.polOut = this.pol.processFractional(
        Math.trunc(polDelay * 256),
        polRefl + this.polDrive * vInj,
      );
      dry += this.outputScale * POL_RADIATION * this.polOut;
    }
    // Sympathetic open-string halo (one-way, so it cannot destabilise the loop).
    if (this.sympatheticMix > 0) return dry + this.sympatheticMix * this.sympatheticProcess(dry);
    return dry;
  }

  release(): void {
    this.releasing = true;
  }

  kill(): void {
    this.bowLevel = 0;
    this.lpState = 0;
    this.neckOut = 0;
    this.bridgeOut = 0;
    this.bristleZ = 0;
    this.polOut = 0;
    this.polLpState = 0;
    for (const m of this.sympathetic) {
      m.y1 = 0;
      m.y2 = 0;
    }
    this.releasing = true;
  }

  private sympatheticProcess(x: number): number {
    let sum = 0;
    for (const m of this.sympathetic) {
      const y = m.a1 * m.y1 + m.a2 * m.y2 + m.gain * x;
      m.y2 = m.y1;
      m.y1 = y;
      sum += y;
    }
    return sum;
  }

  private elastoPlasticInjection(dv: number): number {
    // Single-bristle elasto-plastic friction: the bristle deflection z is the
    // friction memory that makes the stick->slip transition hysteretic.
    const v = dv;

    // Stribeck steady bristle: full grip near v=0, decaying to a small floor.
    const ratio = v / this.epStribeckV;
    const g = Math.exp(-ratio * ratio); // 1 at v=0, ->0 as |v| grows
    const zSs = (EP_ZSS_FLOOR + (1 - EP_ZSS_FLOOR) * g) * this.epZMax;
    const zSsSigned = v >= 0 ? zSs : -zSs;

    // Adhesion (plastic) fraction alpha in [0,1]: 0 while the bristle is below
    // breakaway, rising to 1 as |z| approaches the steady deflection. Zero
    // whenever z and v disagree in sign (the bristle is unloading) — hysteresis.
    let alpha = 0;
    const az = Math.abs(this.bristleZ);
    if (v >= 0 === this.bristleZ >= 0 && az > this.epZBa) {
      if (az < zSs) {
        const x = (az - this.epZBa) / Math.max(zSs - this.epZBa, 1e-6);
        alpha = 0.5 * (1 - Math.cos(PI * x)); // smooth 0 -> 1
      } else {
        alpha = 1;
      }
    }

    // Bristle evolution (forward Euler): dz = rate*v*(1 - alpha*z/z_ss).
    const dz = this.epLoadRate * v * (1 - (alpha * this.bristleZ) / zSsSigned);
    this.bristleZ = clamp(this.bristleZ + dz, -this.epZMax, this.epZMax);

    // Feed the SHARP static bow table, offset by the bristle deflection: the
    // table still switches abruptly (Helmholtz survives) but breaks away and
    // re-grips at different relative velocities — the hysteresis loop.
    const s = this.bowSlope * (dv - EP_HYST_OFFSET * this.bristleZ) + this.bowOffset;
    const base = Math.abs(s) + 0.75;
    const base2 = base * base;
    let bowCoeff = 1 / (base2 * base2);
    if (bowCoeff > 1) bowCoeff = 1;
    return dv * bowCoeff;
  }
}
