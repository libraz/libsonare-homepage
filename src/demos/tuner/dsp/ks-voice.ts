/**
 * Extended Karplus-Strong plucked-string core — the guitar / harp / banjo /
 * harpsichord family. Faithful port of libsonare's
 * `src/midi/synth/ks_voice.{h,cpp}` (Karplus & Strong 1983; Jaffe & Smith 1983).
 *
 * A fractional-delay loop closed through a one-pole loss lowpass, with the
 * Jaffe-Smith extensions: exact phase-delay tuning, decay stretching, a
 * pick-position comb, a velocity-driven excitation lowpass, and note-off
 * damping. The optional extensions (polarization, bridge coupling, pluck
 * doublet, magnetic pickup, dispersion, tension modulation, octave-up 4' line,
 * touched node, hand mute, key-off noise) all render inert at zero — the plain
 * string is recovered.
 *
 * The loss filter is designed from what the string has to DO — its fundamental's
 * t60 and the ring left at a fixed quote frequency — rather than from the
 * brightness knob, which is consulted only where the quote sits at or below the
 * fundamental and there is no tilt to describe.
 */
import { AllpassStage, allpassPhaseDelay, dispersionAllpassA } from './dispersion';
import {
  onepoleGroupDelaySamples,
  StringLoop,
  solveStringLoopFilter,
  stringLoopGainFor,
} from './string-loop';
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

/** Second (horizontal) polarization detune, and the fret-gap reflection. */
const KS_POL_DETUNE_CENTS = 11;
const KS_REFLECT = 0.06;
/** What fraction of the played plane's decay targets the horizontal one keeps. */
const KS_POL_T60_FRACTION = 0.55;
/** How much darker the horizontal plane's pole is where the tone knob sets it. */
const KS_POL_TONE_DARKEN = 0.12;

/**
 * How long the partial at `KS_HF_QUOTE_HZ` rings, in seconds; 0 keeps the pole
 * the tone knob implies. A pole taken from a tone knob is charged once per
 * traversal, so its tilt scales with the note's own pitch and a bass string
 * keeps partials a wound string has lost. Stated as a t60 rather than as a
 * multiple of the fundamental's, which would inherit `decayStretch`.
 */
const KS_HF_T60_S = 0.07;
/**
 * Where that decay is quoted. A fixed frequency, because a target quoted at the
 * octave is unreachable in the bass: two frequencies a third of a percent of the
 * sample rate apart barely differ to a one-pole.
 */
const KS_HF_QUOTE_HZ = 4000;
/**
 * How many times faster the partial at `muteHarmonic` decays than the
 * fundamental, when a hand is on the strings.
 */
const KS_MUTE_DECAY_RATIO = 3.8;

/** KS section of a patch (1:1 with C++ `KsPatchParams`). */
export interface KsPatchParams {
  brightness: number;
  decayS: number;
  decayStretch: number;
  pickPosition: number;
  excBrightness: number;
  velToBrightness: number;
  releaseDampS: number;
  muteHarmonic: number;
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
  harmonicNode: number;
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
  /** The played string (the vertical plane the pluck grips). */
  private string: StringLoop;
  /** Second (horizontal) polarization: a detuned loop sharing the pluck. */
  private pol: StringLoop;
  /** Octave-up 4' companion line (the harpsichord 4' register). */
  private oct: StringLoop;

  private dispA = 0;
  private dispStages: AllpassStage[] = [new AllpassStage(), new AllpassStage()];
  private slapThreshold = 0;

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
    this.string = new StringLoop(cap);
    this.pol = new StringLoop(cap);
    this.oct = new StringLoop(cap);
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
    const basePeriod = sr / f0;

    // A finger at 1/N forces a node, so the string sounds in N segments and
    // every loop below shortens with it. The pluck still grips the full string,
    // which is why the excitation keeps the open-string period.
    const node = Math.floor(clamp(params.harmonicNode, 0, 8));
    const loopPeriod = node >= 2 ? basePeriod / node : basePeriod;

    // Decay: t60 stretched per octave below A4 (low strings ring longer).
    const stretch = clamp(params.decayStretch, 0, 1);
    const octavesBelowA4 = (69 - (note & 0x7f)) / 12;
    const t60 = Math.max(0.05, params.decayS) * 2 ** (stretch * octavesBelowA4);
    const dampedT60 = Math.max(0.01, params.releaseDampS);

    // Loop lowpass: brightness -> feedback coefficient a (y += (1-a)(x-y)).
    const toneA = (1 - clamp(params.brightness, 0, 1)) * 0.7;
    const fixedQuoteW = (TWO_PI * KS_HF_QUOTE_HZ) / sr;
    const mute = clamp(params.muteHarmonic, 0, 16);

    // Set one loop up from its two decay targets: its fundamental's t60 and the
    // ring left at the quote frequency. A quote at or below the fundamental has
    // no tilt to describe, and there the tone-derived pole stands.
    const voiceLoop = (
      loop: StringLoop,
      period: number,
      t60S: number,
      hfT60S: number,
      toneAOffset = 0,
    ): number => {
      let a = Math.min(0.97, toneA + toneAOffset);
      let g = stringLoopGainFor(period, sr, t60S);
      let releaseG = stringLoopGainFor(period, sr, dampedT60);
      const w0 = TWO_PI / period;
      // A hand mute is measured against the note and the open string against the
      // room: a palm damps a mode by how far it moves under it, so both where
      // the break falls and how deep it is scale with the string, while a wire's
      // own losses and the air's are a property of the frequency.
      const quoteW = mute > 0 ? Math.min(mute * w0, 0.9 * Math.PI) : fixedQuoteW;
      const quoteT60 = mute > 0 ? t60S / KS_MUTE_DECAY_RATIO : hfT60S;
      if (KS_HF_T60_S > 0 && quoteW > w0 * 1.5) {
        const solved = solveStringLoopFilter(
          w0,
          quoteW,
          g,
          stringLoopGainFor(period, sr, quoteT60),
        );
        // The damper is broadband, so its gain takes the compensation the
        // fundamental's did; otherwise the pole is counted into it twice.
        releaseG = Math.min(0.9999, releaseG * (g > 0 ? solved.g / g : 1));
        a = solved.a;
        g = solved.g;
      }
      loop.configureFilter(period, a, g, releaseG);
      return a;
    };

    // The played string. `configureFilter()` tunes it by compensating the EXACT
    // phase delay of the loop filter at the fundamental (not just its DC group
    // delay) plus the one-sample feedback path.
    const a = voiceLoop(this.string, loopPeriod, t60, KS_HF_T60_S);

    // Stiff-string dispersion (steel strings). 0 disables the allpass cascade so
    // the loop stays a harmonic string.
    const omega = TWO_PI / loopPeriod;
    const tauLp = onepoleGroupDelaySamples(a, omega);
    this.dispA = 0;
    for (const s of this.dispStages) s.reset();
    const dispersion = clamp(params.dispersion, 0, 1);
    if (dispersion > 0) {
      const bCoeff = dispersion * ksSteelInharmonicityB(note);
      const phaseBudget = loopPeriod - 4 - tauLp;
      this.dispA = dispersionAllpassA(bCoeff, omega, a, KS_DISPERSION_STAGES, phaseBudget);
      if (this.dispA !== 0) {
        this.string.loopComp += KS_DISPERSION_STAGES * allpassPhaseDelay(this.dispA, omega);
        for (const s of this.dispStages) s.a = this.dispA;
      }
    }

    const slap = clamp(params.slap, 0, 1);
    this.slapThreshold = slap > 0 ? 0.55 - 0.35 * slap : 0;

    this.excTotal = Math.max(8, Math.trunc(basePeriod));
    this.excPos = 0;
    this.pickDelay = Math.trunc(clamp(params.pickPosition, 0, 0.5) * basePeriod + 0.5);
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
      const offset = clamp((1 - pickup) * loopPeriod, 4, loopPeriod);
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

    // Second (horizontal) polarization: a second loop detuned a few cents sharp,
    // more damped and decaying faster than the primary, so the two planes beat
    // and the faster line dies first (two-stage decay).
    const polarization = clamp(params.polarization, 0, 1);
    if (polarization > 0) {
      const polPeriod = loopPeriod / 2 ** (KS_POL_DETUNE_CENTS / 1200);
      // The horizontal plane takes the same fraction off both its targets.
      voiceLoop(
        this.pol,
        polPeriod,
        KS_POL_T60_FRACTION * t60,
        KS_POL_T60_FRACTION * KS_HF_T60_S,
        KS_POL_TONE_DARKEN,
      );
      // The damper grips both planes at once, so the horizontal one is released
      // at the played string's damped gain rather than at one solved for its own
      // (slightly shorter) period.
      this.pol.releaseGain = this.string.releaseGain;
      this.polExc = 0.6;
      this.polCouple = polarization;

      const bc = clamp(params.bodyCoupling, 0, 1);
      if (bc > 0) {
        const kLambdaMax = 0.999;
        // What a traversal actually keeps, which is the decay target rather than
        // the gain sitting in front of the solved pole: the solver scales that
        // gain up by exactly the pole's own loss at the fundamental, so reading
        // it here reports a loop hotter than it is and the bridge silently shuts.
        const g1 = stringLoopGainFor(loopPeriod, sr, t60);
        const g2 = stringLoopGainFor(polPeriod, sr, KS_POL_T60_FRACTION * t60);
        const mean = 0.5 * (g1 + g2);
        const halfDiff = 0.5 * (g1 - g2);
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
      this.pol.disable();
      this.polCouple = 0;
      this.coupleGain = 0;
    }

    const octaveMix = clamp(params.octaveMix, 0, 1);
    if (octaveMix > 0) {
      // The same decay targets as the primary, solved at the octave-up period so
      // both the 4' pitch and its loss are right for the shorter string.
      voiceLoop(this.oct, 0.5 * loopPeriod, t60, KS_HF_T60_S);
      this.octExc = 0.7;
      this.octCouple = octaveMix;
    } else {
      this.oct.disable();
      this.octCouple = 0;
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
    if (this.string.size < 8) return 0;

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

    let fb = this.string.feedback();
    // Bridge coupling: the horizontal plane feeds a little energy back into the
    // vertical one (0 unless body_coupling engaged the 2x2 admittance).
    if (this.coupleGain !== 0) fb += this.coupleGain * this.pol.lpState;
    let loopIn = exc + fb;
    if (this.slapThreshold > 0) {
      // Fret contact: the string cannot swing past the fret gap. Over-travel is
      // hard-limited with only a sliver of give, so the clipped tops generate the
      // odd-harmonic buzz of the slap/pop attack.
      const th = this.slapThreshold;
      if (loopIn > th) loopIn = th + (loopIn - th) * KS_REFLECT;
      else if (loopIn < -th) loopIn = -th + (loopIn + th) * KS_REFLECT;
    }

    let pickupTap = 0;
    if (this.pickupDepth !== 0) {
      pickupTap = this.string.line.readFractional(this.pickupDelayQ8);
    }

    const out = this.string.advance(loopIn, ratio);
    // Stiff-string dispersion: an allpass cascade in the loop makes the highs
    // travel faster, stretching the partials sharp.
    let shaped = out;
    if (this.dispA !== 0) {
      for (const stage of this.dispStages) shaped = stage.process(shaped);
    }
    this.string.commit(shaped);

    let result: number;
    if (this.polCouple > 0) {
      let polIn = this.polExc * exc + this.pol.feedback();
      // Reciprocal bridge return: the vertical plane feeds the horizontal one.
      if (this.coupleGain !== 0) polIn += this.coupleGain * this.string.lpState;
      result = out + this.polCouple * this.pol.process(polIn, ratio);
    } else {
      result = out;
    }

    if (this.octCouple > 0) {
      const octIn = this.octExc * exc + this.oct.feedback();
      result += this.octCouple * this.oct.process(octIn, ratio);
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
    this.string.release();
    if (this.polCouple > 0) this.pol.release();
    if (this.octCouple > 0) this.oct.release();
    if (this.keyoffAmount > 0) {
      this.keyoffPos = 0;
      this.keyoffLp = 0;
      this.keyoffEnv = 1;
    }
  }

  kill(): void {
    this.excPos = this.excTotal;
    this.string.kill();
    this.pol.kill();
    this.oct.kill();
    this.keyoffPos = this.keyoffLen;
  }
}
