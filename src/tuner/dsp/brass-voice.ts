/**
 * Brass (lip-reed, breath-excited) waveguide core — the trumpet / trombone /
 * tuba / french-horn family. Faithful port of libsonare's
 * `src/midi/synth/brass_voice.{h,cpp}` (McIntyre, Schumacher & Woodhouse 1983;
 * Smith/Cook single-delay-line brass; STK Brass).
 *
 * A travelling-wave bore delay line closed through a bell loss lowpass, driven
 * at the mouthpiece by a RESONANT nonlinear lip valve: the pressure difference
 * across the lips rings a two-pole DC-zeroed bandpass (the buzzing mass-spring)
 * whose displacement modulates a reflection coefficient (clamped to [-1,1]) that
 * gates the mouth pressure into the bore. The negative coupling sign is the
 * outward-striking ("swinging-door") behaviour that locks the buzz to the
 * fundamental. The optional advanced physics (cuivré shock steepening, mute,
 * half-valve, 2-DOF dynamic lip) all render inert at zero — the plain linear
 * waveguide is recovered.
 */
import { DelayLine } from './frac-delay';
import { VoiceRandomSequence } from './voice-random';

const TWO_PI = 2 * Math.PI;
const BRASS_MIN_FUNDAMENTAL_HZ = 20;

// Mouth-pressure scale: the player's lung pressure entering the mouthpiece.
const MOUTH_SCALE = 1;
// Mouth-pressure calibration: the exposed breath range lands in the strong
// buzzing band. breath = base + span*level.
const BREATH_BASE = 0.72;
const BREATH_SPAN = 0.28;

// Lip valve calibration: coeff = clamp(offset - couple*displacement, -1, 1).
const LIP_OFFSET = -0.1;
const LIP_COUPLE = 4.5;
// Lip resonator constant-Q from lip_damping. Q = min + span*(1 - lip_damping).
const LIP_Q_MIN = 8;
const LIP_Q_SPAN = 22;
// Lip tension detunes the lip resonance a few percent around the note.
const LIP_TUNE_SPAN = 0.04; // f_lip = f0 * (1 + span*(tension - 0.5))
// An outward-striking lip oscillates just above its resonance, ~0.8% sharp;
// the loop delay is lengthened to bring it back onto pitch.
const PITCH_CORRECT = 1.0075;

// Bell reflection loss from damping (< 1 so the loop is stable).
const LOSS_BASE = 0.995;
const LOSS_SPAN = 0.08;
const LOSS_FLOOR = 0.85;
const LOSS_CEIL = 0.999;

// Bell loop-lowpass depth from brightness; the conical bias darkens further.
const BELL_POLE_SPAN = 0.7;
const CONICAL_DARKEN = 0.12;

// Live-control smoothing time (ms).
const CONTROL_SMOOTH_MS = 8;

// Breath turbulence depth (a light seeded jitter on the mouth pressure).
const BREATH_NOISE_DEPTH = 0.08;

// Onset chiff depth (the tonguing "speak" noise burst) and the seeded burst
// pre-filled into the bore so the note speaks promptly.
const CHIFF_DEPTH = 0.5;
const BORE_PREFILL = 0.03;

// In-loop DC-blocker corner (~10 Hz).
const DC_CORNER_HZ = 10;

// Output trim: the driven loop peak grows with the note, so the output scale is
// frequency-compensated. peak_raw ~= base + tilt*log2(f0/ref).
const OUTPUT_TARGET_PEAK = 0.6;
const PEAK_BASE = 2.33;
const PEAK_TILT = 0.93;
const PEAK_REF_HZ = 44;

// Cuivré dynamics gain (only when cuivreDynamics > 0).
const CUIVRE_DYN_GAIN = 1.8;

// Cuivré shock shaper (only when brassiness > 0).
const CUIVRE_DRIVE = 9;
const CUIVRE_ASYM = 0.5;
const CUIVRE_DRIVE_REF_HZ = 175;
const CUIVRE_DRIVE_RATIO_MAX = 2.3;
const CUIVRE_MIX_MAX = 0.85;

// Mute formant + scoop (only when mute > 0).
const MUTE_FORMANT_HZ = 1800;
const MUTE_FORMANT_R = 0.9;
const MUTE_FORMANT_GAIN = 3.5;
const MUTE_SCOOP = 0.45;
const MUTE_MIX_MAX = 0.9;

// Half-valve extra loss + loop detune (only when halfValve > 0).
const HALF_VALVE_LOSS_MAX = 0.05;
const HALF_VALVE_DETUNE = 0.006;

// Dynamic (2-DOF) lip second mode (only when dynamicLip > 0).
const LIP2_MULT = 2;
const LIP2_Q = 7;
const LIP2_COUPLE = 1.5;

// Divided-difference guard for the ADAA tanh shock front.
const ADAA_DIVISOR_EPSILON = 1e-5;

/** Brass (lip-reed) section of a patch (1:1 with C++ `BrassPatchParams`). */
export interface BrassPatchParams {
  /** Steady mouth pressure in [0,1]: how hard the player blows. */
  breathPressure: number;
  /** Note velocity -> breath pressure in [0,1]. */
  velToBreath: number;
  /** Lip tension in [0,1]: fine-tunes the lip resonance around the note. */
  lipTension: number;
  /** Lip damping in [0,1]: low = a tight bright buzz, high = a mellow tone. */
  lipDamping: number;
  /** Conical bore: false = cylindrical (bright), true = conical (dark). */
  conical: boolean;
  /** Bell reflection openness in [0,1]: the loop lowpass brightness. */
  brightness: number;
  /** Bore damping in [0,1]: the bell loop loss. */
  damping: number;
  /** Breath rise on note-on (ms). */
  attackMs: number;
  /** Breath fall on note-off (ms). */
  releaseMs: number;
  /** Breath turbulence in [0,1]: a subtle deterministic mouth-pressure noise. */
  breathNoise: number;
  /** Onset speech transient (chiff) in [0,1]. */
  chiff: number;
  /** Chiff decay time constant (ms). */
  chiffMs: number;
  /** Cuivré / brassiness in [0,1]: amplitude-dependent shock steepening. */
  brassiness: number;
  /** Cuivré dynamics in [0,1]: played dynamic scales the effective brassiness. */
  cuivreDynamics: number;
  /** Mute in [0,1]: a nasal muted-bell formant + scoop. */
  mute: number;
  /** Half-valve in [0,1]: extra in-loop loss + a small detune. */
  halfValve: number;
  /** Dynamic (2-DOF) lip in [0,1]: a second transverse lip mode. */
  dynamicLip: number;
}

/** Struct defaults matching C++ `BrassPatchParams`. */
export function defaultBrassParams(): BrassPatchParams {
  return {
    breathPressure: 0.7,
    velToBreath: 0.6,
    lipTension: 0.5,
    lipDamping: 0.5,
    conical: false,
    brightness: 0.5,
    damping: 0.4,
    attackMs: 25,
    releaseMs: 90,
    breathNoise: 0.1,
    chiff: 0.35,
    chiffMs: 10,
    brassiness: 0,
    cuivreDynamics: 0,
    mute: 0,
    halfValve: 0,
    dynamicLip: 0,
  };
}

/** Per-bore delay-buffer capacity (samples): a full period at the lowest note. */
export function brassBufferCapacity(sampleRate: number): number {
  const sr = sampleRate > 0 ? sampleRate : 48000;
  return Math.trunc(sr / BRASS_MIN_FUNDAMENTAL_HZ) + 8;
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

/** Antiderivative of tanh, F1(x) = ln(cosh(x)), in a numerically stable form. */
function tanhAntiderivative(x: number): number {
  const ax = Math.abs(x);
  return ax + Math.log1p(Math.exp(-2 * ax)) - Math.LN2;
}

/**
 * First-order antiderivative antialiasing of tanh, mirroring C++
 * `rt::Adaa1<rt::TanhNonlinearity>`. Antialiases the cuivré shock front so the
 * bloomed upper harmonics do not fold back in the high register.
 */
class Adaa1Tanh {
  private prevX = 0;
  private prevF1 = tanhAntiderivative(0);

  process(x: number): number {
    const f1x = tanhAntiderivative(x);
    const dx = x - this.prevX;
    const y =
      Math.abs(dx) > ADAA_DIVISOR_EPSILON
        ? (f1x - this.prevF1) / dx
        : Math.tanh(0.5 * (x + this.prevX));
    this.prevX = x;
    this.prevF1 = f1x;
    return y;
  }

  reset(x = 0): void {
    this.prevX = x;
    this.prevF1 = tanhAntiderivative(x);
  }
}

export class BrassVoiceCore {
  private bore: DelayLine;
  private boreSize = 0;
  private boreOut = 0;

  // Tuning.
  private borePeriod = 0;
  private comp = 1;
  private sign = 1;

  // Bell reflection loop lowpass + loss + in-loop DC blocker.
  private lpAlpha = 1;
  private lpState = 0;
  private lossGain = 0.95;
  private dcX1 = 0;
  private dcY1 = 0;
  private dcR = 0;

  // Lip valve (resonant DC-zeroed bandpass).
  private lipB0 = 0;
  private lipA1 = 0;
  private lipA2 = 0;
  private lipX1 = 0;
  private lipX2 = 0;
  private lipZ1 = 0;
  private lipZ2 = 0;
  private lipOffset = LIP_OFFSET;
  private lipCouple = LIP_COUPLE;
  private mouthScale = 1;

  // Breath contour.
  private breathTarget = 0.7;
  private breathLevel = 0;
  private attackCoeff = 0;
  private releaseCoeff = 0;
  private releasing = false;

  // Live-control smoothing.
  private ctrlCoeff = 1;
  private breathCtrlTarget = 0.7;
  private lpAlphaTarget = 1;

  // Breath turbulence + onset chiff.
  private breathNoise = 0;
  private chiffLevel = 0;
  private chiffCoeff = 0;

  private outputScale = 1;

  private noise = new VoiceRandomSequence();
  private driveIndex = 0;

  // 4a cuivré (inert when brassiness == 0).
  private brassiness = 0;
  private cuivreScale = 1;
  private cuivreInvScale = 1;
  private cuivreDrive = 0;
  private cuivreInvTanh = 1;
  private cuivreFcSq = 1;
  private cuivreDynamics = 0;
  private cuivreVel = 0;
  private cuivreSeat = 0;
  private cuivreAdaa = new Adaa1Tanh();

  // 4b mute (inert when mute == 0).
  private mute = 0;
  private mutePeakB0 = 0;
  private mutePeakA1 = 0;
  private mutePeakA2 = 0;
  private muteX1 = 0;
  private muteX2 = 0;
  private muteY1 = 0;
  private muteY2 = 0;

  // 4c half-valve (inert when halfValve == 0).
  private halfValve = 0;
  private halfValveLoss = 1;

  // 4d dynamic (2-DOF) lip (inert when dynamicLip == 0).
  private dynLip = 0;
  private lip2B0 = 0;
  private lip2A1 = 0;
  private lip2A2 = 0;
  private lip2X1 = 0;
  private lip2X2 = 0;
  private lip2Z1 = 0;
  private lip2Z2 = 0;
  private lip2Couple = 0;

  constructor(sampleRate: number) {
    this.bore = new DelayLine(brassBufferCapacity(sampleRate));
  }

  start(
    params: BrassPatchParams,
    sampleRate: number,
    note: number,
    velocity: number,
    seed: bigint,
  ): void {
    const sr = sampleRate > 0 ? sampleRate : 48000;
    const srf = sr;
    this.noise = new VoiceRandomSequence(seed);
    this.driveIndex = 0;
    this.releasing = false;
    this.breathLevel = 0;
    this.lpState = 0;
    this.boreOut = 0;
    this.dcX1 = 0;
    this.dcY1 = 0;
    this.lipX1 = 0;
    this.lipX2 = 0;
    this.lipZ1 = 0;
    this.lipZ2 = 0;

    const f0 = noteToHz(note);
    const period = srf / Math.max(1, f0);
    // Lengthen the loop a touch so the outward-striking sharpness lands on pitch.
    this.borePeriod = period * PITCH_CORRECT;
    this.sign = 1;

    const vel01 = (velocity & 0x7f) / 127;
    const velToBreath = clamp(params.velToBreath, 0, 1);
    const level = clamp((1 - velToBreath) * params.breathPressure + velToBreath * vel01, 0, 1);
    this.breathTarget = BREATH_BASE + BREATH_SPAN * level;
    this.breathCtrlTarget = this.breathTarget;
    this.ctrlCoeff = rampCoeff(CONTROL_SMOOTH_MS, sr);
    this.mouthScale = MOUTH_SCALE;

    // Lip resonator: a constant-Q DC-zeroed bandpass tuned to the note.
    const damp = clamp(params.lipDamping, 0, 1);
    const tension = clamp(params.lipTension, 0, 1);
    const fLip = Math.min(f0 * (1 + LIP_TUNE_SPAN * (tension - 0.5)), 0.45 * srf);
    const q = LIP_Q_MIN + LIP_Q_SPAN * (1 - damp);
    let lipR = Math.exp((-Math.PI * (fLip / q)) / srf);
    lipR = Math.min(lipR, 0.99995);
    const w = (TWO_PI * fLip) / srf;
    this.lipA1 = 2 * lipR * Math.cos(w);
    this.lipA2 = -lipR * lipR;
    this.lipB0 = 1 - lipR;
    this.lipOffset = LIP_OFFSET;
    this.lipCouple = LIP_COUPLE;

    // Bell loop lowpass from brightness; a conical brass reflects darker.
    let a = (1 - clamp(params.brightness, 0, 1)) * BELL_POLE_SPAN;
    if (params.conical) a = Math.min(a + CONICAL_DARKEN, 0.95);
    this.lpAlpha = 1 - a;
    this.lpAlphaTarget = this.lpAlpha;
    this.lossGain = clamp(
      LOSS_BASE - LOSS_SPAN * clamp(params.damping, 0, 1),
      LOSS_FLOOR,
      LOSS_CEIL,
    );

    // In-loop DC blocker pole.
    this.dcR = 1 - (TWO_PI * DC_CORNER_HZ) / sr;

    // Tuning compensation: one feedback register plus the bell lowpass phase.
    const omega = TWO_PI / Math.max(1, this.borePeriod);
    const tauLp = Math.atan2(a * Math.sin(omega), 1 - a * Math.cos(omega)) / Math.max(omega, 1e-6);
    this.comp = 1 + tauLp;

    const eff = Math.max(2, this.borePeriod - this.comp);
    const span = Math.trunc(eff * 1.3) + 8;
    const size = Math.min(this.bore.capacity, Math.max(16, span));
    this.bore.prime(size);
    this.boreSize = this.bore.size;

    this.attackCoeff = rampCoeff(params.attackMs, sr);
    this.releaseCoeff = rampCoeff(params.releaseMs, sr);
    this.breathNoise = clamp(params.breathNoise, 0, 1) * BREATH_NOISE_DEPTH;
    this.chiffLevel = clamp(params.chiff, 0, 1) * CHIFF_DEPTH;
    this.chiffCoeff = rampCoeff(params.chiffMs, sr);
    const peakEst = clamp(PEAK_BASE + PEAK_TILT * Math.log2(f0 / PEAK_REF_HZ), 1.5, 9);
    this.outputScale = OUTPUT_TARGET_PEAK / peakEst;

    // Prompt speech: pre-fill the bore with a low-level seeded noise burst so the
    // lip resonator has an f0 component to lock onto rather than swelling up from
    // silence (a bandpass resonator ignores the breath DC).
    const prefill = BORE_PREFILL * this.breathTarget;
    for (let i = 0; i < this.boreSize; ++i) {
      this.bore.processFractional(256, prefill * this.noise.bipolarAt(i));
    }
    this.driveIndex = this.boreSize;

    // --- off-by-default advanced physics (inert when zero). ---

    // 4a cuivré: a radiation-side level-preserving shock shaper.
    this.brassiness = clamp(params.brassiness, 0, 1);
    this.cuivreDynamics = clamp(params.cuivreDynamics, 0, 1);
    this.cuivreVel = vel01;
    this.cuivreSeat = level;
    this.cuivreScale = peakEst;
    this.cuivreInvScale = 1 / Math.max(0.5, peakEst);
    const cuivreFc = clamp(CUIVRE_DRIVE_REF_HZ / f0, 1, CUIVRE_DRIVE_RATIO_MAX);
    this.cuivreFcSq = cuivreFc * cuivreFc;
    this.cuivreDrive = (1 + CUIVRE_DRIVE * this.brassiness) * this.cuivreFcSq;
    this.cuivreInvTanh = 1 / Math.tanh(this.cuivreDrive);
    this.cuivreAdaa.reset(0);

    // 4b mute: a radiation-side resonant formant + scoop.
    this.mute = clamp(params.mute, 0, 1);
    this.muteX1 = 0;
    this.muteX2 = 0;
    this.muteY1 = 0;
    this.muteY2 = 0;
    if (this.mute > 0) {
      const fm = Math.min(MUTE_FORMANT_HZ, 0.45 * srf);
      const wm = (TWO_PI * fm) / srf;
      this.mutePeakA1 = 2 * MUTE_FORMANT_R * Math.cos(wm);
      this.mutePeakA2 = -MUTE_FORMANT_R * MUTE_FORMANT_R;
      this.mutePeakB0 = 1 - MUTE_FORMANT_R;
    }

    // 4c half-valve: extra in-loop loss and a small loop detune.
    this.halfValve = clamp(params.halfValve, 0, 1);
    this.halfValveLoss = 1 - HALF_VALVE_LOSS_MAX * this.halfValve;
    if (this.halfValve > 0) {
      this.borePeriod *= 1 + HALF_VALVE_DETUNE * this.halfValve;
    }

    // 4d dynamic (2-DOF) lip: a second, higher lip resonance.
    this.dynLip = clamp(params.dynamicLip, 0, 1);
    this.lip2X1 = 0;
    this.lip2X2 = 0;
    this.lip2Z1 = 0;
    this.lip2Z2 = 0;
    if (this.dynLip > 0) {
      const f2 = Math.min(fLip * LIP2_MULT, 0.45 * srf);
      let r2 = Math.exp((-Math.PI * (f2 / LIP2_Q)) / srf);
      r2 = Math.min(r2, 0.99995);
      const w2 = (TWO_PI * f2) / srf;
      this.lip2A1 = 2 * r2 * Math.cos(w2);
      this.lip2A2 = -r2 * r2;
      this.lip2B0 = 1 - r2;
      this.lip2Couple = LIP2_COUPLE * this.dynLip;
    }
  }

  private lipResonator(dp: number): number {
    const y = this.lipB0 * (dp - this.lipX2) + this.lipA1 * this.lipZ1 + this.lipA2 * this.lipZ2;
    this.lipX2 = this.lipX1;
    this.lipX1 = dp;
    this.lipZ2 = this.lipZ1;
    this.lipZ1 = y;
    return y;
  }

  private lipResonator2(dp: number): number {
    const y =
      this.lip2B0 * (dp - this.lip2X2) + this.lip2A1 * this.lip2Z1 + this.lip2A2 * this.lip2Z2;
    this.lip2X2 = this.lip2X1;
    this.lip2X1 = dp;
    this.lip2Z2 = this.lip2Z1;
    this.lip2Z1 = y;
    return y;
  }

  render(pitchRatio: number): number {
    if (this.boreSize < 8) return 0;
    const ratio = pitchRatio > 0.01 ? pitchRatio : 0.01;

    // Live control: ramp the steady breath / bell brightness toward their targets.
    this.breathTarget += this.ctrlCoeff * (this.breathCtrlTarget - this.breathTarget);
    this.lpAlpha += this.ctrlCoeff * (this.lpAlphaTarget - this.lpAlpha);

    // Mouth pressure contour: ramp toward the target, then add turbulence + chiff.
    const target = this.releasing ? 0 : 1;
    const coeff = this.releasing ? this.releaseCoeff : this.attackCoeff;
    this.breathLevel += coeff * (target - this.breathLevel);
    let breath = this.breathTarget * this.breathLevel;
    if (this.breathNoise > 0) {
      breath += breath * this.breathNoise * this.noise.bipolarAt(this.driveIndex);
    }
    if (this.chiffLevel > 1e-4) {
      breath += this.chiffLevel * this.breathTarget * this.noise.bipolarAt(this.driveIndex + 1);
      this.chiffLevel -= this.chiffCoeff * this.chiffLevel;
    }
    const mouth = this.mouthScale * breath;

    // Bell reflection from the previous bore output: one-pole loss lowpass.
    this.lpState += this.lpAlpha * (this.boreOut - this.lpState);
    let refl = this.sign * this.lossGain * this.lpState;
    if (this.halfValve > 0) refl *= this.halfValveLoss;

    // Lip valve (resonant, outward-striking): the pressure difference drives the
    // resonant lip, and its displacement modulates a reflection coefficient
    // (clamped to [-1,1]) that gates the mouth pressure into the bore.
    const dp = refl - mouth;
    const x = this.lipResonator(dp);
    let lipCoeff = this.lipOffset - this.lipCouple * x;
    if (this.dynLip > 0) lipCoeff -= this.lip2Couple * this.lipResonator2(dp);
    if (lipCoeff < -1) lipCoeff = -1;
    if (lipCoeff > 1) lipCoeff = 1;
    const inj = mouth + dp * lipCoeff;

    // DC-block the injection before the positive-feedback bore.
    const dc = inj - this.dcX1 + this.dcR * this.dcY1;
    this.dcX1 = inj;
    this.dcY1 = dc;

    // Advance the bore delay line: write the DC-blocked injection, read the
    // delayed pressure returning from the bell.
    const delay = clamp(this.borePeriod / ratio - this.comp, 1, this.boreSize - 4);
    this.boreOut = this.bore.processFractional(Math.trunc(delay * 256), dc);
    ++this.driveIndex;

    let outp = this.boreOut;

    // Cuivré (gated): amplitude-dependent nonlinear wave steepening, output-side
    // so it cannot destabilise the loop; ADAA-antialiased.
    if (this.brassiness > 0) {
      let bEff = this.brassiness;
      let drive = this.cuivreDrive;
      let invTanh = this.cuivreInvTanh;
      if (this.cuivreDynamics > 0) {
        const live = clamp(
          (this.breathTarget * this.breathLevel - BREATH_BASE) / BREATH_SPAN,
          0,
          1,
        );
        const dyn = clamp(
          this.cuivreVel * this.breathLevel + Math.max(0, live - this.cuivreSeat),
          0,
          1,
        );
        const shapedDyn = dyn * dyn;
        bEff = clamp(
          this.brassiness *
            (1 - this.cuivreDynamics + this.cuivreDynamics * CUIVRE_DYN_GAIN * shapedDyn),
          0,
          1,
        );
        drive = (1 + CUIVRE_DRIVE * bEff) * this.cuivreFcSq;
        invTanh = 1 / Math.tanh(drive);
      }
      const xn = outp * this.cuivreInvScale;
      const xa = xn + CUIVRE_ASYM * xn * Math.abs(xn);
      const shaped = this.cuivreAdaa.process(drive * xa) * invTanh * this.cuivreScale;
      outp += bEff * CUIVRE_MIX_MAX * (shaped - outp);
    }

    // Mute (gated): a resonant upper formant plus a scoop of the direct low-mid.
    if (this.mute > 0) {
      const peak =
        this.mutePeakB0 * (outp - this.muteX2) +
        this.mutePeakA1 * this.muteY1 +
        this.mutePeakA2 * this.muteY2;
      this.muteX2 = this.muteX1;
      this.muteX1 = outp;
      this.muteY2 = this.muteY1;
      this.muteY1 = peak;
      const muted = outp * (1 - MUTE_SCOOP) + peak * MUTE_FORMANT_GAIN;
      const wet = this.mute * MUTE_MIX_MAX;
      outp += wet * (muted - outp);
    }

    return this.outputScale * outp;
  }

  release(): void {
    this.releasing = true;
  }

  kill(): void {
    this.breathLevel = 0;
    this.lpState = 0;
    this.boreOut = 0;
    this.dcX1 = 0;
    this.dcY1 = 0;
    this.chiffLevel = 0;
    this.lipX1 = 0;
    this.lipX2 = 0;
    this.lipZ1 = 0;
    this.lipZ2 = 0;
    this.muteX1 = 0;
    this.muteX2 = 0;
    this.muteY1 = 0;
    this.muteY2 = 0;
    this.lip2X1 = 0;
    this.lip2X2 = 0;
    this.lip2Z1 = 0;
    this.lip2Z2 = 0;
    this.releasing = true;
  }
}
