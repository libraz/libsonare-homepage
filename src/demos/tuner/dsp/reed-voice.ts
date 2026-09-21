/**
 * Reed-woodwind (breath-excited) core — the clarinet / saxophone / oboe /
 * bassoon family. Faithful port of libsonare's `src/midi/synth/reed_voice.{h,cpp}`
 * (McIntyre, Schumacher & Woodhouse 1983; Smith's digital-waveguide single-reed,
 * the model STK's Clarinet implements).
 *
 * A travelling-wave delay line (the bore) closed through a bell reflection loop
 * (one-pole loss lowpass, loss gain and a topology sign) and driven at the
 * mouthpiece by a memoryless nonlinear reed table. The bore topology is the
 * whole timbre: a cylinder (clarinet) is a negative-feedback comb of half the
 * period (odd harmonics), a cone (sax / oboe / bassoon) a positive-feedback comb
 * of the full period (full harmonic series). The optional advanced-physics
 * extensions (dynamic mass-spring reed, register vent, growl, cone growth,
 * tonehole scattering) all render inert at their zero/false defaults — the plain
 * memoryless waveguide is recovered.
 */
import { DelayLine } from './frac-delay';
import { VoiceRandomSequence } from './voice-random';

const TWO_PI = 2 * Math.PI;

/** Lowest fundamental the bore delay line is sized for. */
const REED_MIN_FUNDAMENTAL_HZ = 20;

// Mouth-pressure calibration: a reed self-oscillates only inside a narrow
// pressure band, strongest right at the beating threshold. The exposed knob
// range maps into that strong band ([~0.88, ~0.99]); the knobs colour the tone,
// they do not gate it. breath = base + span * level.
const BREATH_BASE = 0.82;
const BREATH_SPAN = 0.08;

// Reed table from the stiffness / opening knobs (STK Clarinet: offset ~0.7 rest
// opening, slope ~-0.3 stiffness). offset = min + span*(1 - opening);
// slope = -(base + span*stiffness).
const REED_OFFSET_MIN = 0.68;
const REED_OFFSET_SPAN = 0.04;
const REED_SLOPE_BASE = 0.25;
const REED_SLOPE_SPAN = 0.05;

// Bell reflection loss from damping (< 1 so the loop is stable).
const LOSS_BASE = 0.99;
const LOSS_SPAN = 0.09;
const LOSS_FLOOR = 0.8;
const LOSS_CEIL = 0.999;

// Bell loop-lowpass depth: brightness maps to the one-pole pole.
const BELL_POLE_SPAN = 0.7;

// Live-control smoothing time (ms) for breath / brightness ramps.
const CONTROL_SMOOTH_MS = 8;

// Breath turbulence depth (a light seeded jitter on the mouth pressure).
const BREATH_NOISE_DEPTH = 0.08;

// Onset chiff depth and the level of the seeded burst pre-filled into the bore.
const CHIFF_DEPTH = 0.5;
const BORE_PREFILL = 0.02;

// In-loop sub-fundamental highpass: a pitch-tracking corner (a fraction of f0)
// with a floor, so nothing below the fundamental resonates in the cone's
// positive-feedback comb without detuning the tone.
const HP_CORNER_FRAC_F0 = 0.06;
const HP_CORNER_FLOOR_HZ = 10;
// Fraction of the highpass phase lead folded into the loop-delay compensation.
const HP_COMP_SCALE = 0.5;

// Output trim bringing a forte note into the other engines' range.
const OUTPUT_SCALE = 0.9;

// --- 4a dynamic (mass-spring) reed (only when dynamicReed) ---
const REED_RES_BASE_HZ = 1500;
const REED_RES_SPAN_HZ = 2000;
const REED_RES_R = 0.985;
const REED_COUPLE = 0.15;

// --- 4b register vent (only when registerVent > 0) ---
const REG_VENT_CORNER_HZ = 700;
const REG_VENT_MAX = 0.7;

// --- 4c growl (only when growl > 0) ---
const GROWL_RATE_HZ = 28;
const GROWL_DEPTH_MAX = 0.5;

// --- 4d growth cone (only when conical && coneGrowth > 0) ---
const CONE_THROAT_MULT = 1.6;
const CONE_GROWTH_GAIN = 1.4;

// --- 4e tonehole scattering (only when tonehole > 0) ---
const TONEHOLE_FRAC_CYLINDER = 0.5;
const TONEHOLE_FRAC_CONE = 0.25;
const TONEHOLE_GAIN_MAX = 0.5;

/** Reed-woodwind section of a patch (1:1 with C++ `ReedPatchParams`). */
export interface ReedPatchParams {
  /** Steady mouth pressure in [0,1]: how hard the player blows. */
  breathPressure: number;
  /** Note velocity -> breath pressure in [0,1]. */
  velToBreath: number;
  /** Reed stiffness in [0,1] (the reed-table slope). */
  reedStiffness: number;
  /** Reed rest opening in [0,1] (the reed-table offset). */
  reedOpening: number;
  /** Conical bore: false = cylinder (clarinet, odd harmonics); true = cone. */
  conical: boolean;
  /** Bell reflection-filter openness in [0,1] (the loop lowpass). */
  brightness: number;
  /** Bore damping in [0,1] (the bell loop loss). */
  damping: number;
  /** Breath rise on note-on (ms). */
  attackMs: number;
  /** Breath fall on note-off (ms). */
  releaseMs: number;
  /** Breath turbulence in [0,1] (deterministic mouth-pressure noise). */
  breathNoise: number;
  /** Onset speech transient (chiff) in [0,1]. */
  chiff: number;
  /** Chiff decay time constant (ms). */
  chiffMs: number;

  // --- off-by-default advanced physics (gated) ---
  /** Dynamic (mass-spring) reed: biases the memoryless table's operating point. */
  dynamicReed: boolean;
  /** Reed natural frequency in [0,1] (only when dynamicReed). */
  reedResonance: number;
  /** Register vent in [0,1]: damps the fundamental toward the register break. */
  registerVent: number;
  /** Growl in [0,1]: a sub-audio breath modulation. */
  growl: number;
  /** Growth cone in [0,1] (conical bores only): the truncated-cone throat term. */
  coneGrowth: number;
  /** Tonehole / register key in [0,1]: an in-bore scattering junction. */
  tonehole: number;
}

/** The struct's default member initializers, 1:1 with `ReedPatchParams`. */
export function defaultReedParams(): ReedPatchParams {
  return {
    breathPressure: 0.6,
    velToBreath: 0.6,
    reedStiffness: 0.5,
    reedOpening: 0.5,
    conical: false,
    brightness: 0.5,
    damping: 0.4,
    attackMs: 40,
    releaseMs: 80,
    breathNoise: 0.12,
    chiff: 0.4,
    chiffMs: 12,
    dynamicReed: false,
    reedResonance: 0.5,
    registerVent: 0,
    growl: 0,
    coneGrowth: 0,
    tonehole: 0,
  };
}

/** Per-bore delay-buffer capacity (samples): one full bore period. */
export function reedBufferCapacity(sampleRate: number): number {
  const sr = sampleRate > 0 ? sampleRate : 48000;
  return Math.trunc(sr / REED_MIN_FUNDAMENTAL_HZ) + 8;
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

export class ReedVoiceCore {
  private bore: DelayLine;

  // Tuning: the loop period (samples) and the delay not carried in the line.
  private borePeriod = 0;
  private comp = 1;
  // Feedback sign: -1 = cylinder (odd harmonics), +1 = cone (full harmonics).
  private sign = -1;
  // Last delay-line output (the pressure returning to the reed next sample).
  private boreOut = 0;

  // Bell reflection: one-pole loop lowpass, a loss gain, the topology sign.
  private lpAlpha = 1;
  private lpState = 0;
  private lossGain = 0.95;
  // In-loop DC blocker.
  private dcX1 = 0;
  private dcY1 = 0;
  private dcR = 0;

  // Reed table (memoryless valve): coeff = clamp(offset + slope*dp, -1, 1).
  private reedOffset = 0.7;
  private reedSlope = -0.3;

  // Breath contour.
  private breathTarget = 0.6;
  private breathLevel = 0;
  private attackCoeff = 0;
  private releaseCoeff = 0;
  private releasing = false;

  // Live-control smoothing (initialised equal to note-on so an untouched note
  // renders exactly as the plain model).
  private ctrlCoeff = 1;
  private breathCtrlTarget = 0.6;
  private lpAlphaTarget = 1;

  // Breath turbulence and onset chiff.
  private breathNoise = 0;
  private chiffLevel = 0;
  private chiffCoeff = 0;

  private outputScale = 1;

  private noise = new VoiceRandomSequence();
  private driveIndex = 0;

  // --- 4a dynamic (mass-spring) reed ---
  private reedDyn = false;
  private reedB0 = 0;
  private reedA1 = 0;
  private reedA2 = 0;
  private reedZ1 = 0;
  private reedZ2 = 0;
  private reedCouple = 0;

  // --- 4b register vent ---
  private regVent = 0;
  private regLpAlpha = 0;
  private regLpState = 0;

  // --- 4c growl ---
  private growlDepth = 0;
  private growlPhase = 0;
  private growlInc = 0;

  // --- 4d growth cone ---
  private throatGain = 0;
  private throatPole = 0;
  private throatState = 0;

  // --- 4e tonehole scattering ---
  private holeGain = 0;
  private holeDelaySamples = 0;
  private holeRefl = 0;

  constructor(sampleRate: number) {
    this.bore = new DelayLine(reedBufferCapacity(sampleRate));
  }

  start(
    params: ReedPatchParams,
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

    const f0 = noteToHz(note);
    const period = sr / Math.max(1, f0);
    // Bore topology: a cylinder is a negative-feedback comb of half the period
    // (odd harmonics); a cone a positive-feedback comb of the full period.
    if (params.conical) {
      this.borePeriod = period;
      this.sign = 1;
    } else {
      this.borePeriod = 0.5 * period;
      this.sign = -1;
    }

    const vel01 = (velocity & 0x7f) / 127;
    // Mouth pressure = the patch breath blended with velocity by velToBreath.
    const velToBreath = clamp(params.velToBreath, 0, 1);
    const level = clamp((1 - velToBreath) * params.breathPressure + velToBreath * vel01, 0, 1);
    this.breathTarget = BREATH_BASE + BREATH_SPAN * level;
    this.breathCtrlTarget = this.breathTarget;
    this.ctrlCoeff = rampCoeff(CONTROL_SMOOTH_MS, sr);

    // Reed table from stiffness / opening.
    const stiffness = clamp(params.reedStiffness, 0, 1);
    const opening = clamp(params.reedOpening, 0, 1);
    this.reedOffset = REED_OFFSET_MIN + REED_OFFSET_SPAN * (1 - opening);
    this.reedSlope = -(REED_SLOPE_BASE + REED_SLOPE_SPAN * stiffness);

    // Bell loop lowpass: brightness -> pole a (y += (1-a)(x - y)).
    const a = (1 - clamp(params.brightness, 0, 1)) * BELL_POLE_SPAN;
    this.lpAlpha = 1 - a;
    this.lpAlphaTarget = this.lpAlpha;
    this.lossGain = clamp(
      LOSS_BASE - LOSS_SPAN * clamp(params.damping, 0, 1),
      LOSS_FLOOR,
      LOSS_CEIL,
    );

    // In-loop sub-fundamental highpass pole: only the cone (positive feedback)
    // can rumble, so its corner tracks the pitch; the cylinder keeps the floor.
    const hpCorner = params.conical
      ? Math.max(HP_CORNER_FLOOR_HZ, HP_CORNER_FRAC_F0 * f0)
      : HP_CORNER_FLOOR_HZ;
    this.dcR = 1 - (TWO_PI * hpCorner) / sr;

    // Tuning compensation: the feedback register, the bell lowpass's phase delay
    // and the highpass's phase lead (opposite signs). Subtract comp from the loop.
    const omega = TWO_PI / Math.max(1, this.borePeriod);
    const tauLp = Math.atan2(a * Math.sin(omega), 1 - a * Math.cos(omega)) / Math.max(omega, 1e-6);
    const sw = Math.sin(omega);
    const cw = Math.cos(omega);
    const phaseHp = Math.atan2(sw, 1 - cw) - Math.atan2(this.dcR * sw, 1 - this.dcR * cw);
    const tauHp = phaseHp / Math.max(omega, 1e-6);
    this.comp = 1 + tauLp - HP_COMP_SCALE * tauHp;

    // Circular span sized for the whole loop period plus headroom.
    const eff = Math.max(2, this.borePeriod - this.comp);
    const span = Math.trunc(eff * 1.3) + 8;
    const boreSize = Math.min(this.bore.capacity, Math.max(16, span));
    this.bore.prime(boreSize);

    // Contour + textures.
    this.attackCoeff = rampCoeff(params.attackMs, sr);
    this.releaseCoeff = rampCoeff(params.releaseMs, sr);
    this.breathNoise = clamp(params.breathNoise, 0, 1) * BREATH_NOISE_DEPTH;
    this.chiffLevel = clamp(params.chiff, 0, 1) * CHIFF_DEPTH;
    this.chiffCoeff = rampCoeff(params.chiffMs, sr);
    this.outputScale = OUTPUT_SCALE;

    // Prompt speech: pre-fill the bore with a low-level seeded noise burst (the
    // Karplus-Strong trick). Writing bore_size samples around the primed line
    // leaves the write head back at 0, matching the C++ bore init.
    const prefill = BORE_PREFILL * this.breathTarget;
    for (let i = 0; i < boreSize; ++i) {
      this.bore.processFractional(256, prefill * this.noise.bipolarAt(i));
    }
    this.driveIndex = boreSize;

    // --- off-by-default advanced physics. When off, render() takes the
    // memoryless branch untouched. ---
    // 4a: dynamic (mass-spring) reed — a biquad bandpass tuned to the reed's
    // natural frequency, driven by the pressure difference, biasing the table.
    this.reedDyn = params.dynamicReed;
    this.reedZ1 = 0;
    this.reedZ2 = 0;
    if (this.reedDyn) {
      const res01 = clamp(params.reedResonance, 0, 1);
      let fReed = REED_RES_BASE_HZ + REED_RES_SPAN_HZ * res01;
      fReed = Math.min(fReed, 0.45 * sr);
      const w = (TWO_PI * fReed) / sr;
      this.reedA1 = 2 * REED_RES_R * Math.cos(w);
      this.reedA2 = -REED_RES_R * REED_RES_R;
      this.reedB0 = 1 - REED_RES_R;
      this.reedCouple = REED_COUPLE;
    }

    // 4b: register vent — a low-band follower subtracted from the reflection.
    this.regVent = clamp(params.registerVent, 0, 1) * REG_VENT_MAX;
    this.regLpState = 0;
    if (this.regVent > 0) {
      this.regLpAlpha = 1 - Math.exp((-TWO_PI * REG_VENT_CORNER_HZ) / sr);
    }

    // 4c: growl — a deterministic sub-audio LFO amplitude-modulating the breath.
    this.growlDepth = clamp(params.growl, 0, 1) * GROWL_DEPTH_MAX;
    this.growlPhase = 0;
    if (this.growlDepth > 0) {
      this.growlInc = (TWO_PI * GROWL_RATE_HZ) / sr;
    }

    // 4d: growth cone — the truncated-cone throat integrator (conical only).
    this.throatGain = 0;
    this.throatState = 0;
    if (params.conical) {
      const grow = clamp(params.coneGrowth, 0, 1);
      if (grow > 0) {
        this.throatGain = CONE_GROWTH_GAIN * grow;
        const corner = Math.min(CONE_THROAT_MULT * f0, 0.45 * sr);
        this.throatPole = Math.exp((-TWO_PI * corner) / sr);
      }
    }

    // 4e: tonehole scattering — an inline reflection tapped at the reed<->hole
    // round trip. The hole sits toneholeFrac of the way down the bore.
    this.holeGain = 0;
    this.holeDelaySamples = 0;
    this.holeRefl = 0;
    const hole = clamp(params.tonehole, 0, 1);
    if (hole > 0) {
      this.holeGain = TONEHOLE_GAIN_MAX * hole;
      const frac = params.conical ? TONEHOLE_FRAC_CONE : TONEHOLE_FRAC_CYLINDER;
      const roundTrip = Math.trunc(2 * frac * this.borePeriod);
      this.holeDelaySamples = clamp(roundTrip, 1, boreSize - 1);
    }
  }

  /**
   * Biquad bandpass reed resonator: a damped mass-spring reed driven by the
   * pressure difference, its output biasing the reed table's operating point.
   */
  private reedResonator(dp: number): number {
    const y = this.reedB0 * dp + this.reedA1 * this.reedZ1 + this.reedA2 * this.reedZ2;
    this.reedZ2 = this.reedZ1;
    this.reedZ1 = y;
    return y;
  }

  /** Renders one sample; `pitchRatio` is the per-sample pitch factor (1 = on pitch). */
  render(pitchRatio: number): number {
    if (this.bore.size < 8) return 0;
    const ratio = pitchRatio > 0.01 ? pitchRatio : 0.01;

    // Live control: ramp the steady breath / bell brightness toward their targets
    // (initialised equal at note-on, so an untouched note is unchanged).
    this.breathTarget += this.ctrlCoeff * (this.breathCtrlTarget - this.breathTarget);
    this.lpAlpha += this.ctrlCoeff * (this.lpAlphaTarget - this.lpAlpha);

    // Mouth pressure contour: ramp toward the target, then the steady breath plus
    // its turbulence.
    const target = this.releasing ? 0 : 1;
    const coeff = this.releasing ? this.releaseCoeff : this.attackCoeff;
    this.breathLevel += coeff * (target - this.breathLevel);
    let breath = this.breathTarget * this.breathLevel;
    if (this.breathNoise > 0) {
      breath += breath * this.breathNoise * this.noise.bipolarAt(this.driveIndex);
    }
    // Onset chiff: a short decaying noise burst, the reed's articulated "speak".
    if (this.chiffLevel > 1e-4) {
      breath += this.chiffLevel * this.breathTarget * this.noise.bipolarAt(this.driveIndex + 1);
      this.chiffLevel -= this.chiffCoeff * this.chiffLevel;
    }
    // Growl (gated): a sub-audio LFO amplitude-modulating the breath.
    if (this.growlDepth > 0) {
      breath *= 1 + this.growlDepth * Math.sin(this.growlPhase);
      this.growlPhase += this.growlInc;
      if (this.growlPhase >= TWO_PI) this.growlPhase -= TWO_PI;
    }

    // Bell reflection from the previous bore output: one-pole loss lowpass, the
    // loss gain and the topology sign, then the in-loop DC blocker.
    this.lpState += this.lpAlpha * (this.boreOut - this.lpState);
    let reflRaw = this.sign * this.lossGain * this.lpState;
    // Register vent (gated): subtract the tracked low band from the reflection.
    if (this.regVent > 0) {
      this.regLpState += this.regLpAlpha * (reflRaw - this.regLpState);
      reflRaw -= this.regVent * this.regLpState;
    }
    // Tonehole scattering (gated): fold in the reflection scattered off the open
    // side hole one round trip ago.
    if (this.holeDelaySamples > 0) reflRaw += this.holeRefl;
    const dc = reflRaw - this.dcX1 + this.dcR * this.dcY1;
    this.dcX1 = reflRaw;
    this.dcY1 = dc;
    const refl = dc;

    // Reed valve (memoryless reed table): coeff = clamp(offset + slope*dp, -1, 1).
    const dp = refl - breath;
    let reed = this.reedOffset + this.reedSlope * dp;
    // Dynamic (mass-spring) reed (gated): bias the sharp table by the resonator.
    if (this.reedDyn) reed += this.reedCouple * this.reedResonator(dp);
    if (reed > 1) reed = 1;
    if (reed < -1) reed = -1;
    const inj = breath + dp * reed;

    // Advance the bore delay line: write the reed injection, read the delayed
    // pressure returning from the bell.
    const delay = clamp(this.borePeriod / ratio - this.comp, 1, this.bore.size - 4);
    const delayQ8 = Math.trunc(delay * 256);
    this.boreOut = this.bore.processFractional(delayQ8, inj);
    ++this.driveIndex;

    // Tonehole scattering (gated): read the bore at the reed<->hole round trip
    // and store the open hole's inverting partial reflection for the next sample.
    // The write head has advanced past the injection, so the tap sits one sample
    // further behind than the round-trip delay.
    if (this.holeDelaySamples > 0) {
      this.holeRefl = -this.holeGain * this.bore.readFractional((this.holeDelaySamples + 1) * 256);
    }

    // Growth cone (gated, conical only): a stable leaky one-pole throat
    // integrator on the bore output, added back at radiation (not in the loop)
    // to bloom the fundamental and low partials the way a cone's low end does.
    if (this.throatGain > 0) {
      this.throatState += (1 - this.throatPole) * (this.boreOut - this.throatState);
      return this.outputScale * (this.boreOut + this.throatGain * this.throatState);
    }
    return this.outputScale * this.boreOut;
  }

  /** Note-off: tongue off (ramp the breath to zero); the bore rings down. */
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
    this.reedZ1 = 0;
    this.reedZ2 = 0;
    this.regLpState = 0;
    this.throatState = 0;
    this.holeRefl = 0;
    this.releasing = true;
  }
}
