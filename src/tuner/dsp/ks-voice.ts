/**
 * Extended Karplus-Strong plucked-string core — the guitar / harp / banjo /
 * harpsichord family. Faithful port of libsonare's
 * `src/midi/synth/ks_voice.{h,cpp}` (Karplus & Strong 1983; Jaffe & Smith 1983).
 *
 * A fractional-delay loop closed through a one-pole loop lowpass, with the
 * Jaffe-Smith extensions: exact phase-delay tuning, decay stretching, a
 * pick-position comb, a velocity-driven excitation lowpass, and note-off
 * damping. The optional extensions (polarization, bridge coupling, pluck
 * doublet, magnetic pickup, dispersion, tension modulation, octave-up 4' line,
 * key-off noise) all render inert at zero — the plain string is recovered.
 */
import { AllpassStage, allpassPhaseDelay, dispersionAllpassA } from './dispersion';
import { DelayLine } from './frac-delay';
import { VoiceRandomSequence } from './voice-random';

const TWO_PI = 2 * Math.PI;
const KS_MIN_FUNDAMENTAL_HZ = 20;
const KS_DISPERSION_STAGES = 2;

const KS_TENSION_CENTS_AT_FULL = 55;
const KS_TENSION_MAX_CENTS = 65;
const KS_TENSION_RELAX_MS = 45;
const NOISE_INDEX_BASE = 1 << 16;
const KEYOFF_NOISE_INDEX_BASE = 1 << 20;
const KS_KEYOFF_MS = 18;
const KS_KEYOFF_CUTOFF_HZ = 2200;

/** KS section of a patch (1:1 with C++ `KsPatchParams`). */
export interface KsPatchParams {
  brightness: number;
  decayS: number;
  decayStretch: number;
  pickPosition: number;
  excBrightness: number;
  velToBrightness: number;
  releaseDampS: number;
  slap: number;
  polarization: number;
  bodyCoupling: number;
  pluckStyle: number;
  nail: number;
  sympathetic: boolean;
  pickupPos: number;
  dispersion: number;
  tensionMod: number;
  octaveMix: number;
  keyoffNoise: number;
}

/** Per-LINE delay-buffer capacity (samples): one string polarization span. */
export function ksBufferCapacity(sampleRate: number): number {
  const sr = sampleRate > 0 ? sampleRate : 48000;
  return Math.trunc(sr / KS_MIN_FUNDAMENTAL_HZ) + 8;
}

function noteToHz(note: number): number {
  return 440 * 2 ** (((note & 0x7f) - 69) / 12);
}

/** Per-loop-traversal amplitude factor reaching -60 dB after `t60S`. */
function loopGainFor(periodSamples: number, sampleRate: number, t60S: number): number {
  const loopsToT60 = (sampleRate * Math.max(0.01, t60S)) / Math.max(1, periodSamples);
  return Math.exp(-6.907755279 / loopsToT60);
}

/** Steel-string inharmonicity coefficient B(note). */
function ksSteelInharmonicityB(note: number): number {
  const n = note & 0x7f;
  const bAtA4 = 1.2e-4;
  const betaPerSemitone = 0.0578;
  return Math.max(1e-5, bAtA4 * Math.exp(betaPerSemitone * (n - 69)));
}

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

export class KsVoiceCore {
  private buffer: DelayLine;
  private polLine: DelayLine;
  private octLine: DelayLine;

  private basePeriod = 0;
  private loopComp = 1;
  private loopAlpha = 1;
  private lpState = 0;
  private dispA = 0;
  private dispStages: AllpassStage[] = [new AllpassStage(), new AllpassStage()];
  private loopGain = 0;
  private releaseGain = 0;
  private slapThreshold = 0;

  // Second (horizontal) polarization.
  private polSize = 0;
  private polPeriod = 0;
  private polLoopComp = 1;
  private polLoopAlpha = 1;
  private polLpState = 0;
  private polLoopGain = 0;
  private polReleaseGain = 0;
  private polCouple = 0;
  private polExc = 0;
  private coupleGain = 0;

  // Excitation burst.
  private noise = new VoiceRandomSequence();
  private excTotal = 0;
  private excPos = 0;
  private pickDelay = 0;
  private excAlpha = 1;
  private excLp1 = 0;
  private excLp2 = 0;
  private pluckStyle = 0;
  private pluckContact = 0;

  // Magnetic pickup.
  private pickupDepth = 0;
  private pickupDelayQ8 = 0;
  private pickupMag = 0;

  // Tension modulation.
  private tensionRatioPeak = 0;
  private tensionEnv = 0;
  private tensionDecayCoeff = 0;

  // Octave-up 4' companion line.
  private octSize = 0;
  private octPeriod = 0;
  private octLoopComp = 1;
  private octLoopAlpha = 1;
  private octLpState = 0;
  private octLoopGain = 0;
  private octReleaseGain = 0;
  private octCouple = 0;
  private octExc = 0;

  // Key-off / damper noise burst.
  private keyoffAmount = 0;
  private keyoffPos = 0;
  private keyoffLen = 0;
  private keyoffLp = 0;
  private keyoffAlpha = 1;
  private keyoffDecay = 0;
  private keyoffEnv = 0;

  constructor(sampleRate: number) {
    const cap = ksBufferCapacity(sampleRate);
    this.buffer = new DelayLine(cap);
    this.polLine = new DelayLine(cap);
    this.octLine = new DelayLine(cap);
  }

  start(
    params: KsPatchParams,
    sampleRate: number,
    note: number,
    velocity: number,
    seed: bigint,
  ): void {
    const sr = sampleRate > 0 ? sampleRate : 48000;
    this.noise = new VoiceRandomSequence(seed);

    const f0 = noteToHz(note);
    this.basePeriod = sr / f0;

    const a = (1 - clamp(params.brightness, 0, 1)) * 0.7;
    this.loopAlpha = 1 - a;
    this.lpState = 0;
    const omega = TWO_PI / this.basePeriod;
    const tauLp = Math.atan2(a * Math.sin(omega), 1 - a * Math.cos(omega)) / Math.max(omega, 1e-6);
    this.loopComp = 1 + tauLp;

    this.dispA = 0;
    for (const s of this.dispStages) s.reset();
    const dispersion = clamp(params.dispersion, 0, 1);
    if (dispersion > 0) {
      const bCoeff = dispersion * ksSteelInharmonicityB(note);
      const phaseBudget = this.basePeriod - 4 - tauLp;
      this.dispA = dispersionAllpassA(bCoeff, omega, a, KS_DISPERSION_STAGES, phaseBudget);
      if (this.dispA !== 0) {
        this.loopComp += KS_DISPERSION_STAGES * allpassPhaseDelay(this.dispA, omega);
        for (const s of this.dispStages) s.a = this.dispA;
      }
    }

    const stretch = clamp(params.decayStretch, 0, 1);
    const octavesBelowA4 = (69 - (note & 0x7f)) / 12;
    const t60 = Math.max(0.05, params.decayS) * 2 ** (stretch * octavesBelowA4);
    this.loopGain = loopGainFor(this.basePeriod, sr, t60);
    this.releaseGain = loopGainFor(this.basePeriod, sr, Math.max(0.01, params.releaseDampS));

    const slap = clamp(params.slap, 0, 1);
    this.slapThreshold = slap > 0 ? 0.55 - 0.35 * slap : 0;

    this.excTotal = Math.max(8, Math.trunc(this.basePeriod));
    this.excPos = 0;
    this.pickDelay = Math.trunc(clamp(params.pickPosition, 0, 0.5) * this.basePeriod + 0.5);
    const vel01 = (velocity & 0x7f) / 127;
    const velAmount = clamp(params.velToBrightness, 0, 1);
    const bright = clamp(params.excBrightness, 0, 1) * (1 - velAmount + velAmount * vel01);
    const excCutoff = 300 * 2 ** (5.3 * bright);
    this.excAlpha = clamp(1 - Math.exp((-6.28318530718 * excCutoff) / sr), 0.01, 1);
    this.excLp1 = 0;
    this.excLp2 = 0;

    this.pluckStyle = clamp(params.pluckStyle, 0, 1);
    if (this.pluckStyle > 0) {
      const nail = clamp(params.nail, 0, 1);
      const frac = 0.9 - 0.75 * nail;
      this.pluckContact = Math.max(4, Math.trunc(frac * this.excTotal));
    } else {
      this.pluckContact = 0;
    }

    const pickup = clamp(params.pickupPos, 0, 0.5);
    if (pickup > 0) {
      const offset = clamp((1 - pickup) * this.basePeriod, 4, this.basePeriod);
      this.pickupDelayQ8 = Math.trunc(offset * 256);
      this.pickupDepth = 0.85;
      this.pickupMag = 0.18;
    } else {
      this.pickupDelayQ8 = 0;
      this.pickupDepth = 0;
      this.pickupMag = 0;
    }

    const tension = clamp(params.tensionMod, 0, 1);
    if (tension > 0) {
      const riseCents = Math.min(KS_TENSION_MAX_CENTS, tension * vel01 * KS_TENSION_CENTS_AT_FULL);
      this.tensionRatioPeak = 2 ** (riseCents / 1200) - 1;
      this.tensionEnv = 1;
      this.tensionDecayCoeff = Math.exp(-1 / Math.max(1, KS_TENSION_RELAX_MS * 0.001 * sr));
    } else {
      this.tensionRatioPeak = 0;
      this.tensionEnv = 0;
      this.tensionDecayCoeff = 0;
    }

    const size = Math.min(this.buffer.capacity, Math.trunc(this.basePeriod * 1.3) + 8);
    this.buffer.prime(size);

    const polarization = clamp(params.polarization, 0, 1);
    this.polLpState = 0;
    if (polarization > 0) {
      const kPolDetuneCents = 11;
      this.polPeriod = this.basePeriod / 2 ** (kPolDetuneCents / 1200);
      const a2 = Math.min(0.97, a + 0.12);
      this.polLoopAlpha = 1 - a2;
      const omega2 = TWO_PI / this.polPeriod;
      const tau2 =
        Math.atan2(a2 * Math.sin(omega2), 1 - a2 * Math.cos(omega2)) / Math.max(omega2, 1e-6);
      this.polLoopComp = 1 + tau2;
      this.polLoopGain = loopGainFor(this.polPeriod, sr, 0.55 * t60);
      this.polReleaseGain = this.releaseGain;
      this.polExc = 0.6;
      this.polCouple = polarization;
      this.polSize = Math.min(this.polLine.capacity, Math.trunc(this.polPeriod * 1.3) + 8);
      this.polLine.prime(this.polSize);

      const bc = clamp(params.bodyCoupling, 0, 1);
      if (bc > 0) {
        const kLambdaMax = 0.999;
        const mean = 0.5 * (this.loopGain + this.polLoopGain);
        const halfDiff = 0.5 * (this.loopGain - this.polLoopGain);
        const room = kLambdaMax - mean;
        let epsMax = 0;
        if (room > 0) {
          const r2 = room * room - halfDiff * halfDiff;
          if (r2 > 0) epsMax = Math.sqrt(r2);
        }
        this.coupleGain = bc * epsMax;
      } else {
        this.coupleGain = 0;
      }
    } else {
      this.polCouple = 0;
      this.polLoopGain = 0;
      this.coupleGain = 0;
    }

    const octaveMix = clamp(params.octaveMix, 0, 1);
    this.octLpState = 0;
    if (octaveMix > 0) {
      this.octPeriod = 0.5 * this.basePeriod;
      this.octLoopAlpha = this.loopAlpha;
      const omegaO = TWO_PI / this.octPeriod;
      const tauO =
        Math.atan2(a * Math.sin(omegaO), 1 - a * Math.cos(omegaO)) / Math.max(omegaO, 1e-6);
      this.octLoopComp = 1 + tauO;
      this.octLoopGain = loopGainFor(this.octPeriod, sr, t60);
      this.octReleaseGain = loopGainFor(this.octPeriod, sr, Math.max(0.01, params.releaseDampS));
      this.octExc = 0.7;
      this.octCouple = octaveMix;
      this.octSize = Math.min(this.octLine.capacity, Math.trunc(this.octPeriod * 1.3) + 8);
      this.octLine.prime(this.octSize);
    } else {
      this.octCouple = 0;
      this.octLoopGain = 0;
      this.octSize = 0;
    }

    this.keyoffAmount = clamp(params.keyoffNoise, 0, 1);
    this.keyoffLen = Math.max(1, Math.trunc(KS_KEYOFF_MS * 0.001 * sr));
    this.keyoffPos = this.keyoffLen;
    this.keyoffLp = 0;
    this.keyoffEnv = 0;
    this.keyoffAlpha = clamp(1 - Math.exp((-TWO_PI * KS_KEYOFF_CUTOFF_HZ) / sr), 0.01, 1);
    this.keyoffDecay = Math.exp(-4 / this.keyoffLen);
  }

  private sourceAt(k: number): number {
    const nz = this.noise.bipolarAt(NOISE_INDEX_BASE + k);
    if (this.pluckStyle <= 0) return nz;
    let pluck = 0;
    if (k < this.pluckContact) {
      const win = 0.5 * (1 - Math.cos((TWO_PI * (k + 1)) / (this.pluckContact + 1)));
      pluck = k < this.pluckContact >> 1 ? win : -win;
    }
    return nz + this.pluckStyle * (pluck - nz);
  }

  render(pitchRatio: number): number {
    if (this.buffer.size < 8) return 0;

    let exc = 0;
    if (this.excPos < this.excTotal + this.pickDelay) {
      let burst = this.excPos < this.excTotal ? this.sourceAt(this.excPos) : 0;
      if (this.pickDelay > 0 && this.excPos >= this.pickDelay) {
        burst -= this.sourceAt(this.excPos - this.pickDelay);
      }
      ++this.excPos;
      this.excLp1 += this.excAlpha * (burst - this.excLp1);
      this.excLp2 += this.excAlpha * (this.excLp1 - this.excLp2);
      exc = 0.7 * this.excLp2;
    }

    let ratio = pitchRatio > 0.01 ? pitchRatio : 0.01;
    if (this.tensionRatioPeak !== 0 && this.tensionEnv > 1e-4) {
      ratio *= 1 + this.tensionRatioPeak * this.tensionEnv;
      this.tensionEnv *= this.tensionDecayCoeff;
    }
    const delay = clamp(this.basePeriod / ratio - this.loopComp, 1, this.buffer.size - 4);
    const delayQ8 = Math.trunc(delay * 256);

    let fb = this.loopGain * this.lpState;
    if (this.coupleGain !== 0) fb += this.coupleGain * this.polLpState;
    let loopIn = exc + fb;
    if (this.slapThreshold > 0) {
      const kReflect = 0.06;
      const th = this.slapThreshold;
      if (loopIn > th) loopIn = th + (loopIn - th) * kReflect;
      else if (loopIn < -th) loopIn = -th + (loopIn + th) * kReflect;
    }

    let pickupTap = 0;
    if (this.pickupDepth !== 0) {
      pickupTap = this.buffer.readFractional(this.pickupDelayQ8);
    }

    const out = this.buffer.processFractional(delayQ8, loopIn);
    let shaped = out;
    if (this.dispA !== 0) {
      for (const stage of this.dispStages) shaped = stage.process(shaped);
    }
    this.lpState += this.loopAlpha * (shaped - this.lpState);

    let result: number;
    if (this.polCouple > 0) {
      const polDelay = clamp(this.polPeriod / ratio - this.polLoopComp, 1, this.polSize - 4);
      const polDelayQ8 = Math.trunc(polDelay * 256);
      let polIn = this.polExc * exc + this.polLoopGain * this.polLpState;
      if (this.coupleGain !== 0) polIn += this.coupleGain * this.lpState;
      const polOut = this.polLine.processFractional(polDelayQ8, polIn);
      this.polLpState += this.polLoopAlpha * (polOut - this.polLpState);
      result = out + this.polCouple * polOut;
    } else {
      result = out;
    }

    if (this.octCouple > 0) {
      const octDelay = clamp(this.octPeriod / ratio - this.octLoopComp, 1, this.octSize - 4);
      const octDelayQ8 = Math.trunc(octDelay * 256);
      const octIn = this.octExc * exc + this.octLoopGain * this.octLpState;
      const octOut = this.octLine.processFractional(octDelayQ8, octIn);
      this.octLpState += this.octLoopAlpha * (octOut - this.octLpState);
      result += this.octCouple * octOut;
    }

    if (this.keyoffPos < this.keyoffLen) {
      const nz = this.noise.bipolarAt(KEYOFF_NOISE_INDEX_BASE + this.keyoffPos);
      this.keyoffLp += this.keyoffAlpha * (nz - this.keyoffLp);
      result += this.keyoffAmount * this.keyoffEnv * this.keyoffLp;
      this.keyoffEnv *= this.keyoffDecay;
      ++this.keyoffPos;
    }

    if (this.pickupDepth !== 0) {
      let y = result - this.pickupDepth * pickupTap;
      y += this.pickupMag * y * y;
      result = y;
    }
    return result;
  }

  release(): void {
    this.loopGain = Math.min(this.loopGain, this.releaseGain);
    if (this.polCouple > 0) this.polLoopGain = Math.min(this.polLoopGain, this.polReleaseGain);
    if (this.octCouple > 0) this.octLoopGain = Math.min(this.octLoopGain, this.octReleaseGain);
    if (this.keyoffAmount > 0) {
      this.keyoffPos = 0;
      this.keyoffLp = 0;
      this.keyoffEnv = 1;
    }
  }

  kill(): void {
    this.excPos = this.excTotal;
    this.loopGain = 0;
    this.lpState = 0;
    this.polLoopGain = 0;
    this.polLpState = 0;
    this.octLoopGain = 0;
    this.octLpState = 0;
    this.keyoffPos = this.keyoffLen;
  }
}
