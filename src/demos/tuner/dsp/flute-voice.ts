/**
 * Air-jet (flue / edge-tone) flute core — the concert-flute / piccolo / recorder
 * / pan-flute / shakuhachi / whistle family. Faithful port of libsonare's
 * `src/midi/synth/flute_voice.{h,cpp}` (McIntyre, Schumacher & Woodhouse 1983;
 * Verge/Fabre/Hirschberg lumped jet model; Cook/Scavone STK Flute).
 *
 * A turbulent air jet blown across a sharp edge drives an open-open pipe. The jet
 * is the nonlinear exciter (a cubic jet table on a short convection-delay line),
 * the bore is the linear resonator (a travelling-wave delay line with a one-pole
 * radiation-loss lowpass and an in-loop DC blocker). It is the RATIO of the jet
 * delay to the bore delay that selects the register the pipe speaks in (the seat
 * of overblowing). An asymmetric jet offset and an even-harmonic pump voice the
 * octave-rich open-flue-pipe spectrum.
 *
 * The optional advanced-physics gates (overblow, jet-turbulence shaping, edge
 * hysteresis, discrete vortex) all render inert at zero — the plain linear jet
 * model is recovered.
 */
import { DelayLine } from './frac-delay';
import { VoiceRandomSequence } from './voice-random';

const TWO_PI = 2 * Math.PI;

/** Lowest fundamental the bore delay line is sized for (bass-flute range). */
const FLUTE_MIN_FUNDAMENTAL_HZ = 40;
/** Open-pipe loop length in fundamental periods. */
const FLUTE_BORE_LENGTH_PERIODS = 1;

// Mouth-pressure calibration: breath = base + span*level lands the jet in its
// oscillating band. Loudness comes from the voice amp VCA, not the breath.
const BREATH_BASE = 0.8;
const BREATH_SPAN = 0.35;

// Jet delay / bore ratio band (the register colour); the first register lives
// around [0.38, 0.62].
const JET_RATIO_MIN = 0.38;
const JET_RATIO_MAX = 0.62;

// Reflection coefficients clamped below the runaway region.
const REFLECT_MAX = 0.62;

// Open-end reflection lowpass: brightness maps to the one-pole pole.
const BELL_POLE_BASE = 0.8;
const BELL_POLE_SPAN = 0.3;

// Bore loss from damping (a mild reflection trim on top of the reflections).
const LOSS_SPAN = 0.18;

// Pitch correction: the jet+bore lock lands a touch sharp of the naive loop.
const PITCH_CORRECT = 1.0104;

// Live-control smoothing time (ms).
const CONTROL_SMOOTH_MS = 8;

// Jet turbulence depth (light seeded multiplicative jitter on the breath).
const BREATH_NOISE_DEPTH = 0.1;

// Onset chiff depth and the seeded burst pre-filled into the bore.
const CHIFF_DEPTH = 0.5;
const BORE_PREFILL = 0.05;

// In-loop DC-blocker corner (~10 Hz).
const DC_CORNER_HZ = 10;

// Vibrato depth mapping: full depth is ~30 cents of pitch and a touch of level.
const VIB_PITCH_CENTS = 30;
const VIB_AMP = 0.06;

// Output trim: the driven jet loop settles with a raw bore peak that grows a
// little with pitch, so the output scale is frequency-compensated.
const OUTPUT_TARGET_PEAK = 0.5;
const PEAK_BASE = 4;
const PEAK_TILT = -0.65;
const PEAK_REF_HZ = 261.63;

// Jet offset (asymmetry): seeds the even harmonics a symmetric odd cubic lacks.
const JET_ASYM = 0.5;

// Even-harmonic pump: how hard the rectified bore feedback (its 2f0 content) is
// injected back into the bore, and the DC-follower corner that isolates the AC.
const EVEN_PUMP_GAIN = 0.6;
const EVEN_PUMP_DC_HZ = 30;

/** Per-span delay-buffer capacity (samples): 1 period at the lowest fundamental. */
export function fluteBufferCapacity(sampleRate: number): number {
  const sr = sampleRate > 0 ? sampleRate : 48000;
  return Math.trunc((FLUTE_BORE_LENGTH_PERIODS * sr) / FLUTE_MIN_FUNDAMENTAL_HZ) + 8;
}

/** Air-jet flute section of a patch (1:1 with C++ `FlutePatchParams`). */
export interface FlutePatchParams {
  /** Steady mouth pressure in [0,1]: how hard the player blows. */
  breathPressure: number;
  /** Velocity -> breath pressure in [0,1]. */
  velToBreath: number;
  /** Jet delay / bore delay ratio in (0,1): the register the pipe speaks in. */
  jetRatio: number;
  /** Jet reflection coefficient in [0,1]: the jet drive strength (~0.5 stable). */
  jetReflection: number;
  /** Bore end reflection coefficient in [0,1] (~0.5 stable). */
  endReflection: number;
  /** Reflection-filter openness in [0,1] (1 = bright, 0 = dark/covered). */
  brightness: number;
  /** Bore damping in [0,1]: extra loss on the reflection. */
  damping: number;
  /** Breath rise on note-on (ms). */
  attackMs: number;
  /** Breath fall on note-off (ms). */
  releaseMs: number;
  /** Jet turbulence in [0,1]: the breathy air noise on the mouth pressure. */
  breathNoise: number;
  /** Onset speech transient (chiff) in [0,1]. */
  chiff: number;
  /** Chiff decay time constant (ms). */
  chiffMs: number;
  /** Vibrato rate (Hz) for the voice-local LFO. */
  vibratoRateHz: number;
  /** Vibrato depth in [0,1] (0 = no vibrato). */
  vibratoDepth: number;
  /** Overblow in [0,1]: drive the jet into the next register. 0 = off. */
  overblow: number;
  /** Jet turbulence shaping in [0,1]. 0 = off. */
  jetTurbulence: number;
  /** Edge hysteresis in [0,1]. 0 = off. */
  edgeHysteresis: number;
  /** Discrete-vortex source in [0,1]. 0 = off. */
  vortex: number;
}

/** The struct defaults of C++ `FlutePatchParams`, exactly. */
export function defaultFluteParams(): FlutePatchParams {
  return {
    breathPressure: 0.55,
    velToBreath: 0.5,
    jetRatio: 0.5,
    jetReflection: 0.5,
    endReflection: 0.5,
    brightness: 0.5,
    damping: 0.35,
    attackMs: 18,
    releaseMs: 90,
    breathNoise: 0.15,
    chiff: 0.4,
    chiffMs: 12,
    vibratoRateHz: 5,
    vibratoDepth: 0,
    overblow: 0,
    jetTurbulence: 0,
    edgeHysteresis: 0,
    vortex: 0,
  };
}

function noteToHz(note: number): number {
  return 440 * 2 ** (((note & 0x7f) - 69) / 12);
}

/** One-pole ramp coefficient reaching ~95% of the target in `ms`. */
function rampCoeff(ms: number, sampleRate: number): number {
  const t = Math.max(0.5, ms) * 0.001 * sampleRate;
  return 1 - Math.exp(-3 / Math.max(1, t));
}

/**
 * The jet function: the S-shaped saturating transfer of the air jet deflecting
 * across the labium (Fabre-Hirschberg lumped model / STK JetTable), with an
 * offset asymmetry (`JET_ASYM`) that seeds the even harmonics. The clamp bounds
 * the limit cycle.
 */
function jetTable(x: number): number {
  const y = x * (x * x - 1) + JET_ASYM * x * x;
  return y < -1 ? -1 : y > 1 ? 1 : y;
}

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

export class FluteVoiceCore {
  // Bore + jet delay lines: the travelling-wave air column and the jet
  // convection line.
  private bore: DelayLine;
  private jet: DelayLine;
  private boreSize = 0;
  private jetSize = 0;
  // Last bore delay-line output (the pressure returning to the mouth next sample).
  private boreOut = 0;

  // Tuning: the bore loop period, the delay not carried in the line, and the jet
  // delay as a fraction of the bore line delay.
  private borePeriod = 0;
  private comp = 1;
  private jetRatio = 0.4;

  // Open-end reflection: one-pole loss lowpass, a loss gain, and the two
  // feedback taps (jet / end reflection).
  private lpAlpha = 1;
  private lpState = 0;
  private lossGain = 1;
  private jetReflection = 0.5;
  private endReflection = 0.5;
  // In-loop DC blocker on the jet output.
  private dcX1 = 0;
  private dcY1 = 0;
  private dcR = 0;

  // Even-harmonic pump (the octave-dominant open-flue-pipe colour).
  private evenGain = 0;
  private evenState = 0;
  private evenHpAlpha = 0;

  // Breath contour: a one-pole ramp of the mouth pressure toward the target.
  private breathTarget = 0.55;
  private breathLevel = 0;
  private attackCoeff = 0;
  private releaseCoeff = 0;
  private releasing = false;

  // Live-control smoothing (initialised equal to the note-on values).
  private ctrlCoeff = 1;
  private breathCtrlTarget = 0.55;
  private lpAlphaTarget = 1;

  // Jet turbulence (deterministic multiplicative mouth-pressure noise).
  private breathNoise = 0;

  // Onset chiff (one-pole decaying noise burst).
  private chiffLevel = 0;
  private chiffCoeff = 0;

  // Voice-local vibrato LFO. depth == 0 -> skipped.
  private vibDepth = 0;
  private vibDepthTarget = 0;
  private vibPhase = 0;
  private vibInc = 0;

  // Output trim bringing the raw bore pressure up to a musical voice level.
  private outputScale = 1;

  private noise = new VoiceRandomSequence();
  private driveIndex = 0;

  // Off-by-default advanced physics (skipped entirely when off).
  private overblow = 0;
  private jetTurb = 0;
  private jetTurbState = 0;
  private edgeHyst = 0;
  private edgeHystState = 0;
  private vortex = 0;

  constructor(sampleRate: number) {
    const cap = fluteBufferCapacity(sampleRate);
    this.bore = new DelayLine(cap);
    this.jet = new DelayLine(cap);
  }

  start(
    params: FlutePatchParams,
    sampleRate: number,
    note: number,
    velocity: number,
    seed: bigint,
  ): void {
    const sr = sampleRate > 0 ? sampleRate : 48000;
    this.noise = new VoiceRandomSequence(seed);
    this.driveIndex = 0;
    this.releasing = false;
    this.breathLevel = 0;
    this.lpState = 0;
    this.boreOut = 0;
    this.dcX1 = 0;
    this.dcY1 = 0;
    this.vibPhase = 0;

    const f0 = noteToHz(note);
    // Open at both ends: a positive-feedback comb of one full period (the full
    // harmonic series). The jet buzzes the fundamental and drives every harmonic.
    const period = (FLUTE_BORE_LENGTH_PERIODS * sr) / Math.max(1, f0);
    this.borePeriod = period * PITCH_CORRECT;
    this.jetRatio = clamp(params.jetRatio, JET_RATIO_MIN, JET_RATIO_MAX);

    const vel01 = (velocity & 0x7f) / 127;
    const velToBreath = clamp(params.velToBreath, 0, 1);
    const level = clamp((1 - velToBreath) * params.breathPressure + velToBreath * vel01, 0, 1);
    this.breathTarget = BREATH_BASE + BREATH_SPAN * level;
    this.breathCtrlTarget = this.breathTarget;
    this.ctrlCoeff = rampCoeff(CONTROL_SMOOTH_MS, sr);

    this.jetReflection = Math.min(clamp(params.jetReflection, 0, 1), REFLECT_MAX);
    this.endReflection = Math.min(clamp(params.endReflection, 0, 1), REFLECT_MAX);

    // Open-end reflection lowpass: brightness -> pole a (a smaller pole is
    // brighter).
    const a = clamp(BELL_POLE_BASE - BELL_POLE_SPAN * clamp(params.brightness, 0, 1), 0, 0.95);
    this.lpAlpha = 1 - a;
    this.lpAlphaTarget = this.lpAlpha;
    this.lossGain = clamp(1 - LOSS_SPAN * clamp(params.damping, 0, 1), 0.5, 1);

    // In-loop DC blocker pole (on the jet output).
    this.dcR = 1 - (TWO_PI * DC_CORNER_HZ) / sr;

    // Even-harmonic pump.
    this.evenGain = EVEN_PUMP_GAIN;
    this.evenState = 0;
    this.evenHpAlpha = clamp(1 - Math.exp((-TWO_PI * EVEN_PUMP_DC_HZ) / sr), 0, 1);

    // Tuning compensation: one feedback register plus the reflection lowpass's
    // phase delay at f0.
    const omega = (TWO_PI * f0) / sr;
    const tauLp = Math.atan2(a * Math.sin(omega), 1 - a * Math.cos(omega)) / Math.max(omega, 1e-6);
    this.comp = 1 + tauLp;

    // Circular spans sized for the whole loop period plus headroom.
    const eff = Math.max(2, this.borePeriod - this.comp);
    const span = Math.min(this.bore.capacity, Math.max(16, Math.trunc(eff * 1.15) + 8));
    this.boreSize = span;
    this.jetSize = span;
    this.bore.prime(span);
    this.jet.prime(span);

    // Contour + textures.
    this.attackCoeff = rampCoeff(params.attackMs, sr);
    this.releaseCoeff = rampCoeff(params.releaseMs, sr);
    this.breathNoise = clamp(params.breathNoise, 0, 1) * BREATH_NOISE_DEPTH;
    this.chiffLevel = clamp(params.chiff, 0, 1) * CHIFF_DEPTH;
    this.chiffCoeff = rampCoeff(params.chiffMs, sr);

    // Voice-local vibrato LFO.
    this.vibDepth = clamp(params.vibratoDepth, 0, 1);
    this.vibDepthTarget = this.vibDepth;
    const vibRate = clamp(params.vibratoRateHz, 0.1, 12);
    this.vibInc = (TWO_PI * vibRate) / sr;

    const peakEst = clamp(PEAK_BASE + PEAK_TILT * Math.log2(Math.max(1, f0) / PEAK_REF_HZ), 0.8, 5);
    this.outputScale = OUTPUT_TARGET_PEAK / peakEst;

    // Prompt speech: pre-fill the bore with a low-level seeded noise burst so the
    // jet has an f0 component to lock onto. Filling via `processFractional` leaves
    // the write head back at 0 (a full wrap), reproducing the C++ prefill state;
    // the jet span starts silent (primed to zero).
    const prefill = BORE_PREFILL * this.breathTarget;
    for (let i = 0; i < this.boreSize; ++i) {
      this.bore.processFractional(256, prefill * this.noise.bipolarAt(i));
    }
    this.driveIndex = this.boreSize;

    // Off-by-default advanced physics.
    this.overblow = clamp(params.overblow, 0, 1);
    this.jetTurb = clamp(params.jetTurbulence, 0, 1);
    this.jetTurbState = 0;
    this.edgeHyst = clamp(params.edgeHysteresis, 0, 1);
    this.edgeHystState = 0;
    this.vortex = clamp(params.vortex, 0, 1);
  }

  render(pitchRatio: number): number {
    if (this.boreSize < 8) return 0;
    let ratio = pitchRatio > 0.01 ? pitchRatio : 0.01;

    // Live control: ramp the steady breath / brightness / vibrato depth toward
    // their targets (no zipper).
    this.breathTarget += this.ctrlCoeff * (this.breathCtrlTarget - this.breathTarget);
    this.lpAlpha += this.ctrlCoeff * (this.lpAlphaTarget - this.lpAlpha);
    this.vibDepth += this.ctrlCoeff * (this.vibDepthTarget - this.vibDepth);

    // Mouth-pressure contour: ramp toward the target, then add turbulence and the
    // onset chiff.
    const target = this.releasing ? 0 : 1;
    const coeff = this.releasing ? this.releaseCoeff : this.attackCoeff;
    this.breathLevel += coeff * (target - this.breathLevel);
    let breath = this.breathTarget * this.breathLevel;

    // Voice-local vibrato: skipped at zero depth (bit-identical).
    let vibGain = 1;
    if (this.vibDepth > 1e-4) {
      const v = Math.sin(this.vibPhase);
      this.vibPhase += this.vibInc;
      if (this.vibPhase >= TWO_PI) this.vibPhase -= TWO_PI;
      ratio *= 2 ** ((VIB_PITCH_CENTS * this.vibDepth * v) / 1200);
      vibGain = 1 + VIB_AMP * this.vibDepth * v;
    }

    if (this.breathNoise > 0) {
      let n = this.noise.bipolarAt(this.driveIndex);
      // Amplitude-dependent, one-pole-shaped jet turbulence (gated).
      if (this.jetTurb > 0) {
        this.jetTurbState += 0.3 * (n - this.jetTurbState);
        n =
          (1 - this.jetTurb) * n +
          this.jetTurb * (this.jetTurbState + n) * (0.5 + 0.5 * this.breathLevel);
      }
      breath += breath * this.breathNoise * n;
    }
    if (this.chiffLevel > 1e-4) {
      breath += this.chiffLevel * this.breathTarget * this.noise.bipolarAt(this.driveIndex + 1);
      this.chiffLevel -= this.chiffCoeff * this.chiffLevel;
    }

    // Effective jet gain. Overblow / edge hysteresis (gated): bias the jet gain
    // by the breath level / direction. Skipped when off (bit-identical).
    let jetRef = this.jetReflection;
    if (this.overblow > 0) {
      jetRef *= 1 + 0.5 * this.overblow * Math.max(0, this.breathLevel - 0.5);
    }
    if (this.edgeHyst > 0) {
      this.edgeHystState += 0.001 * (this.breathLevel - this.edgeHystState);
      jetRef *= 1 + 0.2 * this.edgeHyst * (this.edgeHystState - 0.5);
    }

    // Open-pipe reflection from the previous bore output: one-pole loss lowpass,
    // POSITIVE feedback. The returning pressure drives the jet and re-enters the
    // bore directly.
    this.lpState += this.lpAlpha * (this.boreOut - this.lpState);
    const temp = this.lossGain * this.lpState;

    // Jet drive: the pressure difference across the flue convects (jet delay) and
    // deflects across the labium (the cubic jet table).
    let pd = breath - jetRef * temp;
    if (this.vortex > 0) {
      pd +=
        this.vortex *
        0.3 *
        this.breathLevel *
        this.breathLevel *
        this.noise.bipolarAt(this.driveIndex + 2);
    }
    const boreDelay = clamp(this.borePeriod / ratio - this.comp, 1, this.boreSize - 4);
    const jetDelay = clamp(this.jetRatio * boreDelay, 1, this.jetSize - 4);
    const pdJ = this.jet.processFractional(Math.trunc(jetDelay * 256), pd);
    const jetOut = jetTable(pdJ);

    // DC-block the jet output, then drive the bore: jet flow plus the bore end
    // reflection.
    const jetDc = jetOut - this.dcX1 + this.dcR * this.dcY1;
    this.dcX1 = jetOut;
    this.dcY1 = jetDc;
    let intoBore = jetDc + this.endReflection * temp;

    // Even-harmonic pump: a half-wave rectified bore feedback carries a strong
    // 2f0 component. Strip its DC (a slow follower) and inject the 2f0 content
    // into the bore; bound it so the whole loop stays BIBO-stable.
    const rect = temp > 0 ? temp : 0;
    this.evenState += this.evenHpAlpha * (rect - this.evenState);
    let pump = this.evenGain * (rect - this.evenState);
    pump = pump < -1.5 ? -1.5 : pump > 1.5 ? 1.5 : pump;
    intoBore += pump;
    this.boreOut = this.bore.processFractional(Math.trunc(boreDelay * 256), intoBore);
    ++this.driveIndex;

    return this.outputScale * vibGain * this.boreOut;
  }

  /** Note-off: stop blowing (ramp the breath to zero); the bore rings down. */
  release(): void {
    this.releasing = true;
  }

  /** Immediate silence. */
  kill(): void {
    this.breathLevel = 0;
    this.lpState = 0;
    this.boreOut = 0;
    this.dcX1 = 0;
    this.dcY1 = 0;
    this.chiffLevel = 0;
    this.jetTurbState = 0;
    this.releasing = true;
  }
}
