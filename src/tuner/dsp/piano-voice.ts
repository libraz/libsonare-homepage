/**
 * Extended-waveguide acoustic-piano core — the data-free grand sketch. Faithful
 * port of libsonare's `src/midi/synth/piano_voice.{h,cpp}` (Bensa et al. 2003;
 * Bank & Valimaki; Jaffe & Smith).
 *
 * Four elements separate "piano" from "guitar/organ", and all four are here:
 * stiff-string dispersion (a first-order allpass cascade solved per note from
 * the keyboard-graded inharmonicity B, with the exact phase delay compensated
 * in the loop length), a dynamic nonlinear felt hammer (F = k*x^p with
 * hysteretic loss, integrated per sample against the string at the strike
 * point), coupled micro-detuned unison strings sharing a bridge (the prompt /
 * aftersound double decay), and a soundboard radiation stage (per-voice
 * highpass + bridge-hill emphasis, plus the instrument-wide modal board).
 *
 * `PianoSoundboard` and `PianoResonanceBank` are host-owned and instrument-wide
 * in the C++ engine (one board / sympathetic bank shared by all voices); they
 * are exported here so a single-note render can compose the same output chain:
 * `PIANO_DIRECT_GAIN * dry + board.process(dry) + bank.process(board.lastDiffused(), open)`.
 */
import {
  AllpassStage,
  allpassPhaseDelay,
  dispersionAllpassA,
  onepolePhaseDelay,
} from './dispersion';
import { DelayLine } from './frac-delay';
import { VoiceRandomSequence } from './voice-random';

const TWO_PI = 2 * Math.PI;

export const MAX_PIANO_STRINGS = 3;
/**
 * Share of the raw string signal the host keeps in the mix; the rest reaches
 * the listener through the soundboard's phase-diffusing radiation path.
 */
export const PIANO_DIRECT_GAIN = 0.3;
export const PIANO_DISPERSION_STAGES = 4;
/** Lowest fundamental the piano string loops are sized for (A0 = 27.5 Hz). */
export const PIANO_MIN_FUNDAMENTAL_HZ = 26;

/** Mezzo-forte reference velocity (0..1) the felt-hammer laws are anchored at. */
const HAMMER_MF_VEL = 0.6;
/** Felt-stiffness cutoff octaves per unit velocity above mf, per unit hammer dynamics. */
const HAMMER_DYN_BRIGHT_OCT = 1.5;
/** Hammer-contact floor in fundamental periods, anchored at C4 and graded per octave. */
const CONTACT_PERIODS_AT_C4 = 0.503038;
const CONTACT_PERIODS_PER_OCT = 0.613525;
const CONTACT_PERIODS_MAX = 2;
/** Treble decay taper (halvings of the aftersound stage per octave above C4). */
const TREBLE_DECAY_OCT = 1.94164;
/** Register profile (Gaussian width in octaves from C4) of the prompt-vs-aftersound contrast. */
const TWO_STAGE_WIDTH_OCT = 0.616718;
/** Treble taper cap (octaves above C4) on the decay/darkening keytracks. */
const TREBLE_TAPER_OCT_CAP = 1.5;
/** Treble loop darkening (effective-brightness drop per octave above C4). */
const TREBLE_BRIGHT_PER_OCT = 0.06;
/** Effective-brightness drop per octave below C4 (wound-string mid-partial damping). */
const BASS_DARK_PER_OCT = 0.15;
/** String-to-string inharmonicity spread inside a unison (fractional allpass jitter). */
const UNISON_STIFF_JITTER = 0.05;
/** Uneven unison strike: keeps unison beats as shallow ripple, seeds the aftersound. */
const UNISON_STRIKE_UNEVEN = 0.15;
/** Uneven bridge coupling across the unison (Weinreich): lets the aftersound radiate. */
const UNISON_RAD_SPREAD = 0.6;
/** Felt impact noise: level, exponential decay time, and hard stop of the burst. */
const STRIKE_NOISE_GAIN = 0.6;
const STRIKE_NOISE_TAU_MS = 8;
const STRIKE_NOISE_MAX_MS = 30;
/** The impact noise radiates darker than the string pulse (fraction of the felt cutoff). */
const STRIKE_NOISE_CUTOFF_SCALE = 0.487539;
/** Halvings of the noise cutoff per octave below C4. */
const NOISE_CUTOFF_BASS_OCT = 0.5;
/** Third noise pole above the main cutoff: passband kept, cliff past it. */
const NOISE_STEEP_RATIO = 4;
/** Finite hammer-head footprint caps the pulse content near this harmonic of f0. */
const HAMMER_WIDTH_HARMONICS = 2.69125;
/** Share of the impact noise injected into the strings (seeds the high partials). */
const STRIKE_NOISE_INJECT = 0.298027;
/** The injection tapers above C4 (halvings per octave)... */
const INJECT_TREBLE_TAPER_OCT = 0.654102;
/** ...and grows below C4 (doublings per octave). */
const INJECT_BASS_BOOST_OCT = 1.23607;
/** The impact-noise level also tapers above C4. */
const NOISE_TREBLE_TAPER_OCT = 1.08754;
/** Hammer-knock radiation relative to the string injection. */
const KNOCK_GAIN = 2.6;
/** The knock radiates only the impact thud: a fixed low band regardless of the note. */
const KNOCK_THUD_HZ = 350;
/** Halvings of the thud frequency per octave below C4. */
const KNOCK_THUD_BASS_OCT = 0.7;
/** Radiation bloom: one-pole ring-up time constant at C4 (ms) and its keytrack. */
const BLOOM_TAU_MS_C4 = 4.6604;
const BLOOM_TAU_OCT = 0.9;
/** String yield under the blow (fraction of hammer speed the strike point recedes at). */
const STRING_YIELD = 0.8;
/** Register level compensation on the injected force (dB/octave from C4, clamped ±1.25 oct). */
const INJ_TILT_DB_OCT = 3.5;
const YIELD_TREBLE_OCT = 2;
const KNOCK_BASS_BOOST_OCT = 1.3;
/** The knock shrinks above C4: the treble hammer's thud is far below the tone. */
const KNOCK_TREBLE_TAPER_OCT = 2;
/** Hammer-width harmonic cap keytrack (signed doublings per octave each side of C4). */
const WIDTH_BASS_OCT = -1.96668;
const WIDTH_TREBLE_OCT = 0.81966;
/** Strike-point keytrack (doublings per octave below C4) on the patch fraction. */
const STRIKE_POS_BASS_OCT = 0.556;
/** Soundboard radiation highpass: the board radiates poorly below its first modes. */
const RADIATION_HP_HZ = 95;
const RADIATION_HP_Q = 0.6;
/** Bridge-hill radiation emphasis (RBJ peaking): the 1-2 kHz bridge/board mobility peak. */
const BRIDGE_HILL_HZ = 1485.15;
const BRIDGE_HILL_GAIN_DB = 9.91486;
const BRIDGE_HILL_Q = 2.40983;
/** Ring capacity for the strike-position comb on the hammer force. */
const HAMMER_COMB_CAPACITY = 2048;

/** Piano section of a patch (1:1 with C++ `PianoPatchParams`). */
export interface PianoPatchParams {
  /** Coupled unison strings per note (clamped to [1, MAX_PIANO_STRINGS]). */
  strings: number;
  /** Full micro-detune spread between the outer unison strings (cents). */
  detuneCents: number;
  /** Prompt-sound (coupled) t60 at A4 in seconds. */
  decayFastS: number;
  /** Aftersound (residual) t60 at A4 in seconds. */
  decaySlowS: number;
  /** t60 scales by 2^(stretch * octaves below A4). */
  decayStretch: number;
  /** Loop-lowpass openness in [0,1] (frequency-dependent string damping). */
  brightness: number;
  /** Dispersion amount in [0,1]: scales the keyboard-graded stiffness stretch. */
  dispersion: number;
  /** Hammer strike point as a fraction of the string period in [0, 0.5]. */
  strikePosition: number;
  /** Felt compression exponent p in F = K*y^p. */
  hammerExponent: number;
  /** Hammer-felt contact time at A4 / mezzo-forte (ms). */
  hammerContactMs: number;
  /** Extra velocity-dependent felt compression in [0,1] (0 = intrinsic Hertz law only). */
  hammerDynamics: number;
  /** Soundboard resonator mix in [0,1]. */
  soundboard: number;
  /** Damped t60 in seconds applied at note-off (the damper falling back). */
  releaseDampS: number;
}

/** The C++ `PianoPatchParams` default member initializers. */
export function defaultPianoParams(): PianoPatchParams {
  return {
    strings: 3,
    detuneCents: 1.6,
    decayFastS: 3.0,
    decaySlowS: 12.0,
    decayStretch: 0.7,
    brightness: 0.75,
    dispersion: 1.0,
    strikePosition: 0.085,
    hammerExponent: 2.5,
    hammerContactMs: 1.2,
    hammerDynamics: 0.0,
    soundboard: 0.25,
    releaseDampS: 0.1,
  };
}

/** Per-string delay capacity (samples) for `sampleRate`. */
export function pianoStringCapacity(sampleRate: number): number {
  const sr = sampleRate > 0 ? sampleRate : 48000;
  return Math.trunc(sr / PIANO_MIN_FUNDAMENTAL_HZ) + 8;
}

/**
 * Physically-graded stiff-string inharmonicity coefficient B for a MIDI note:
 * partial n lands at f_n = n*f0*sqrt(1 + B*n^2), rising ~threefold per octave
 * (Fletcher/Conklin) with a small deep-bass floor.
 */
export function pianoInharmonicityB(note: number): number {
  const n = note & 0x7f;
  const bAtA4 = 7e-4;
  const betaPerSemitone = 0.091575; // ln(3) / 12
  return Math.max(bAtA4 * Math.exp(betaPerSemitone * (n - 69)), 2e-5);
}

/**
 * Number of coupled unison strings a real grand strings a note with: a single
 * wound string in the deep bass, a wound bichord through the bass-tenor
 * region, and a plain trichord from the tenor break up.
 */
export function pianoUnisonStrings(note: number): number {
  const n = note & 0x7f;
  if (n <= 29) return 1;
  if (n <= 47) return 2;
  return 3;
}

/**
 * Railsback stretch (cents) added to the equal-tempered pitch: sharp in the
 * treble, flat in the bass, zero at the A4 anchor — the perceptual completion
 * of the stiff-string inharmonicity.
 */
export function pianoStretchCents(note: number): number {
  const x = ((note & 0x7f) - 69) / 39;
  return clamp(14 * x * x * x, -22, 22);
}

function noteToHz(note: number): number {
  return 440 * 2 ** (((note & 0x7f) - 69) / 12);
}

/** Per-loop-traversal amplitude factor reaching -60 dB after `t60S`. */
function loopGainFor(periodSamples: number, sampleRate: number, t60S: number): number {
  const loopsToT60 = (sampleRate * Math.max(0.01, t60S)) / Math.max(1, periodSamples);
  return Math.exp(-6.907755279 / loopsToT60);
}

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

interface PianoString {
  line: DelayLine;
  basePeriod: number;
  /** Loop delay not in the line (fb + lowpass + allpass cascade). */
  comp: number;
  /** Uneven hammer energy across the unison. */
  strikeWeight: number;
  /** Uneven bridge coupling across the unison. */
  radiateWeight: number;
  lpState: number;
  ap: AllpassStage[];
  gSlow: number;
  gFast: number;
}

/**
 * Per-voice piano string/hammer state. `render` returns the per-voice radiated
 * sample (radiation highpass + bridge hill applied); the host-side board mix
 * is composed with `PianoSoundboard` / `PianoResonanceBank`.
 */
export class PianoVoiceCore {
  private strings: PianoString[];
  private numStrings = 0;
  private loopAlpha = 1;
  private bridge = 0;
  /** Damper loop-gain cap installed by release(). */
  private releaseGain = 0;

  // Dynamic felt hammer: a unit mass on a nonlinear spring (F = k*x^p with a
  // hysteretic loss term) integrated per sample against the string's motion at
  // the strike point.
  private hammerAmp = 0;
  private hamOn = false;
  private hamTtl = 0;
  private hamY = 0;
  private hamV = 0;
  private hamK = 0;
  private hamP = 2.5;
  private hamMu = 0;
  private hamForceNorm = 0;
  private hamExit = -1;
  private ys = 0;
  private ysAdm = 0;
  private lastForce = 0;
  private combDelay = 0;
  private combIdx = 0;
  private combTail = 0;
  private combHist = new Float32Array(HAMMER_COMB_CAPACITY);
  /** Strike-position comb history for the injected scrub noise. */
  private noiseHist = new Float32Array(HAMMER_COMB_CAPACITY);
  private knockGain = 0.6;
  private knockLp = 0;
  private knockLp2 = 0;
  private knockLp3 = 0;
  private knockLp3A = 0;
  private knockLpA = 0;
  private bloom = 1;
  private bloomA = 1;
  private excAlpha = 1;
  private excLp = 0;
  private excLp2 = 0;

  // Soundboard radiation highpass (biquad, b2 == b0).
  private hpB0 = 1;
  private hpB1 = 0;
  private hpA1 = 0;
  private hpA2 = 0;
  private hpX1 = 0;
  private hpX2 = 0;
  private hpY1 = 0;
  private hpY2 = 0;

  // Bridge-hill radiation emphasis (peaking biquad).
  private bhB0 = 1;
  private bhB1 = 0;
  private bhB2 = 0;
  private bhA1 = 0;
  private bhA2 = 0;
  private bhX1 = 0;
  private bhX2 = 0;
  private bhY1 = 0;
  private bhY2 = 0;

  // Felt impact noise (broadband thump radiated with the knock at strike).
  private noisePos = 0;
  private noiseSamples = 0;
  private noiseEnv = 0;
  private noiseDecay = 0;
  private noiseAlpha = 1;
  private noiseInject = 0;
  private noiseLp = 0;
  private noiseLp2 = 0;
  private noiseLp3 = 0;
  private noiseAlpha3 = 1;
  private noiseLow = 0;
  private noiseHpA = 0;
  private noiseRng = 1;

  constructor(sampleRate: number) {
    const cap = pianoStringCapacity(sampleRate);
    this.strings = Array.from({ length: MAX_PIANO_STRINGS }, () => ({
      line: new DelayLine(cap),
      basePeriod: 0,
      comp: 1,
      strikeWeight: 1,
      radiateWeight: 1,
      lpState: 0,
      ap: Array.from({ length: PIANO_DISPERSION_STAGES }, () => new AllpassStage()),
      gSlow: 0,
      gFast: 0,
    }));
  }

  start(
    params: PianoPatchParams,
    sampleRate: number,
    note: number,
    velocity: number,
    seed: bigint,
  ): void {
    const sr = sampleRate > 0 ? sampleRate : 48000;
    // Stretch tuning widens the octaves so the inharmonic partials lock the
    // way a tuned grand's do (sharp treble, flat bass; A4 anchored).
    const f0 = noteToHz(note) * 2 ** (pianoStretchCents(note) / 1200);
    const period = sr / f0;
    const w0 = TWO_PI / period;
    const jitter = new VoiceRandomSequence(seed);

    // Loop lowpass (frequency-dependent damping), closing toward the treble
    // and into the wound bass as well.
    const octavesAboveC4 = Math.min(Math.max(0, ((note & 0x7f) - 60) / 12), TREBLE_TAPER_OCT_CAP);
    const octavesBelowC4 = Math.max(0, -((note & 0x7f) - 60) / 12);
    const brightEff = clamp(
      clamp(params.brightness, 0, 1) -
        TREBLE_BRIGHT_PER_OCT * octavesAboveC4 -
        BASS_DARK_PER_OCT * octavesBelowC4,
      0.05,
      1,
    );
    const lpA = (1 - brightEff) * 0.6;
    this.loopAlpha = 1 - lpA;
    const tauLp = onepolePhaseDelay(lpA, w0);

    // Stiffness dispersion: the per-note inharmonicity B drives the allpass
    // cascade; the patch dispersion knob scales B (0 = harmonic string).
    const dispersion = clamp(params.dispersion, 0, 1);
    const bCoeff = pianoInharmonicityB(note) * dispersion;
    const phaseBudget = period - 4 - tauLp;
    const apA = dispersionAllpassA(bCoeff, w0, lpA, PIANO_DISPERSION_STAGES, phaseBudget);

    // Two-stage decay rates (stretched down the keyboard). The treble taper
    // shortens only the aftersound; the prompt stage blends toward the
    // aftersound rate away from the trichord mid-range.
    const stretch = clamp(params.decayStretch, 0, 1);
    const octavesBelowA4 = (69 - (note & 0x7f)) / 12;
    const bassScale = 2 ** (stretch * octavesBelowA4);
    const slowScale = bassScale * 2 ** (-TREBLE_DECAY_OCT * octavesAboveC4);
    const t60Slow = Math.max(0.05, Math.max(params.decayFastS, params.decaySlowS) * slowScale);
    const octFromC4Signed = ((note & 0x7f) - 60) / 12;
    const contrast = Math.exp(
      -(octFromC4Signed * octFromC4Signed) / (TWO_STAGE_WIDTH_OCT * TWO_STAGE_WIDTH_OCT),
    );
    const invFastFull = 1 / Math.max(0.05, params.decayFastS * bassScale);
    const invSlow = 1 / t60Slow;
    const t60Fast = Math.min(
      t60Slow,
      1 / (invSlow + contrast * Math.max(0, invFastFull - invSlow)),
    );

    // The patch string count is the treble voicing; the real grand strings the
    // bass with fewer (a single wound string has no unison aftersound).
    this.numStrings = clamp(
      Math.min(params.strings, pianoUnisonStrings(note)),
      1,
      MAX_PIANO_STRINGS,
    );
    const spread = Math.max(0, params.detuneCents);
    // Uneven strike energy across the unison (seeded ramp, mean-normalized so
    // the note level is independent of the string count).
    const strikeW: number[] = [];
    let strikeMean = 0;
    for (let i = 0; i < this.numStrings; ++i) {
      let w = 1;
      if (this.numStrings > 1) {
        w -= (UNISON_STRIKE_UNEVEN * i) / (this.numStrings - 1);
        w *= 1 + 0.1 * jitter.bipolarAt(16 + i);
      }
      strikeW.push(Math.max(w, 0.1));
      strikeMean += strikeW[i];
    }
    strikeMean /= this.numStrings;
    for (let i = 0; i < this.numStrings; ++i) {
      const s = this.strings[i];
      // Micro-detune: symmetric spread plus seeded jitter.
      let offset = 0;
      if (this.numStrings > 1) {
        offset = spread * (i / (this.numStrings - 1) - 0.5);
        offset *= 1 + 0.2 * jitter.bipolarAt(i);
      }
      const detuneRatio = 2 ** (offset / 1200);
      s.basePeriod = period / detuneRatio;
      s.strikeWeight = strikeW[i] / strikeMean;
      // Uneven bridge coupling (seeded ramp, mean 1): lets the antisymmetric
      // (aftersound) mode radiate at the weight-difference level.
      s.radiateWeight = 1;
      if (this.numStrings > 1) {
        s.radiateWeight +=
          UNISON_RAD_SPREAD *
          (i / (this.numStrings - 1) - 0.5) *
          (1 + 0.3 * jitter.bipolarAt(40 + i));
      }
      // Per-string stiffness spread: decoheres the partial-by-partial unison
      // beat rates (the compensation below keeps the fundamental tuning exact).
      const apAJit = clamp(apA * (1 + UNISON_STIFF_JITTER * jitter.bipolarAt(24 + i)), -0.998, 0);
      for (const stage of s.ap) {
        stage.a = apAJit;
        stage.reset();
      }
      s.lpState = 0;
      const tauAp = allpassPhaseDelay(apAJit, w0);
      s.comp = 1 + tauLp + PIANO_DISPERSION_STAGES * tauAp;
      // Compensate the loop lowpass's own loss at the fundamental so the patch
      // t60s stay the fundamental's decay; the darkened loop then only
      // shortens the upper partials.
      const lpH1Gain =
        (1 - lpA) / Math.sqrt(Math.max(1e-9, 1 - 2 * lpA * Math.cos(w0) + lpA * lpA));
      const lpComp = Math.min(1 / Math.max(1e-3, lpH1Gain), 1 / 0.9);
      s.gSlow = Math.min(0.99997, loopGainFor(s.basePeriod, sr, t60Slow) * lpComp);
      s.gFast = Math.min(s.gSlow, loopGainFor(s.basePeriod, sr, t60Fast) * lpComp);
      s.line.prime(Math.min(s.line.capacity, Math.trunc(s.basePeriod * 1.3) + 8));
    }
    this.bridge = 0;
    // Damper keytrack: heavier felt on the wound bass strings and a shorter
    // stop toward the treble, flat across the C3-C4 anchor with smoothstep
    // bends into both registers (no audible register step).
    const anchorLowNote = 48; // C3
    const anchorHighNote = 60; // C4
    const bassSpan = 20;
    const trebleSpan = 10;
    const bassGain = 0.4;
    const trebleGain = -0.45;
    const noteF = note & 0x7f;
    let damperKeytrack = 1;
    if (noteF < anchorLowNote) {
      const x = clamp((anchorLowNote - noteF) / bassSpan, 0, 1);
      damperKeytrack += bassGain * x * x * (3 - 2 * x);
    } else if (noteF > anchorHighNote) {
      const x = clamp((noteF - anchorHighNote) / trebleSpan, 0, 1);
      damperKeytrack += trebleGain * x * x * (3 - 2 * x);
    }
    this.releaseGain = loopGainFor(
      period,
      sr,
      Math.max(0.01, params.releaseDampS * damperKeytrack),
    );

    // Dynamic felt hammer (F = k*x^p with hysteretic loss). The felt stiffness
    // k is calibrated so a mezzo-forte blow lands the reference contact time
    // for the register; the Hertz velocity laws, the treble's full-period
    // dwell and the bass re-contact chatter all emerge from the interaction.
    const vel01 = Math.max((velocity & 0x7f) / 127, 0.02);
    const p = clamp(params.hammerExponent, 1.5, 4);
    const ampExp = (2 * p) / (p + 1);
    const dyn = clamp(params.hammerDynamics, 0, 1);
    // Reference contact time for the register (mf): the patch contact scaled
    // by register, floored in fundamental periods (treble dwell ~ a period).
    let contactMs = clamp(params.hammerContactMs, 0.2, 10) * 2 ** (-((note & 0x7f) - 69) / 13.1212);
    const octavesFromC4 = ((note & 0x7f) - 60) / 12;
    const contactFloorPeriods = clamp(
      CONTACT_PERIODS_AT_C4 + CONTACT_PERIODS_PER_OCT * octavesFromC4,
      0,
      CONTACT_PERIODS_MAX,
    );
    contactMs = Math.max(contactMs, (contactFloorPeriods * 1000 * period) / sr);
    const tauMf = Math.max(8, contactMs * 0.001 * sr);
    // Free bounce of a unit mass on F = k*x^p from unit velocity lasts
    // c(p) * k^(-1/(p+1)) samples; c(p) fitted over p in [1.5, 4].
    const cP = 3.28 - 0.066 * p;
    this.hamP = p;
    this.hamK = (cP / tauMf) ** (p + 1);
    // Felt hysteresis: loading is stiffer than unloading, which skews the
    // force pulse forward and bleeds energy so the hammer leaves cleanly.
    this.hamMu = 0.229431;
    this.hamY = 0;
    // Hammer speed normalized at the mezzo-forte reference; hammerDynamics
    // widens the pp<->ff speed spread around that pivot.
    this.hamV = (vel01 / HAMMER_MF_VEL) ** (1 + 0.6 * dyn);
    this.hamOn = true;
    this.hamTtl = Math.trunc(3 * tauMf); // shank check truncates a riding hammer
    // Peak force of that mf bounce (unit mass): normalize the injection so the
    // mf level matches the classic voicing, with the velocity level curve
    // (~ v^(2p/(p+1))) emerging from the dynamics.
    const xMaxMf = ((0.5 * (p + 1)) / this.hamK) ** (1 / (p + 1));
    const fPeakMf = this.hamK * xMaxMf ** p;
    this.hammerAmp = 0.9 * vel01 ** ampExp;
    const mfLevel = 0.9 * HAMMER_MF_VEL ** ampExp;
    this.hamForceNorm = fPeakMf > 1e-12 ? mfLevel / fPeakMf : 0;
    this.hamForceNorm *= 2 ** ((INJ_TILT_DB_OCT * clamp(octavesFromC4, -1.25, 1.25)) / 6.0206);
    // String yield under the blow: the strike point recedes with a velocity
    // proportional to the net force through the string's wave admittance; the
    // inverted near-end reflection recompresses the felt and the measured
    // multi-hump piano force curve emerges.
    const yieldKt = STRING_YIELD * 2 ** (-YIELD_TREBLE_OCT * Math.max(0, octavesFromC4));
    this.ysAdm = 0.5 * yieldKt * xMaxMf;
    this.ys = 0;
    this.lastForce = 0;
    this.hamExit = -xMaxMf;
    // The strike point moves out toward 1/8 of the speaking length on the
    // bass strings (mid/treble sits nearer 1/12).
    const strikePos =
      clamp(params.strikePosition, 0, 0.5) *
      2 ** (STRIKE_POS_BASS_OCT * Math.max(0, -octavesFromC4));
    this.combDelay = Math.trunc(Math.min(strikePos, 0.5) * period + 0.5);
    this.combDelay = Math.min(this.combDelay, HAMMER_COMB_CAPACITY - 1);
    this.combIdx = 0;
    this.combTail = 0;
    this.combHist.fill(0);
    this.noiseHist.fill(0);
    // Felt stiffening: compressed felt (hard strike) passes far more of the
    // pulse's top end — a velocity-driven one-pole on the injected force. The
    // dynamics-gated brightening also scales the footprint cap.
    const dynBright = 2 ** (HAMMER_DYN_BRIGHT_OCT * dyn * (vel01 - HAMMER_MF_VEL));
    const excCutoff = 800 * 2 ** (3 * vel01) * dynBright;
    const widthHarm =
      HAMMER_WIDTH_HARMONICS *
      2 **
        (WIDTH_BASS_OCT * Math.max(0, -octavesFromC4) +
          WIDTH_TREBLE_OCT * Math.max(0, octavesFromC4));
    const widthCutoff = Math.min(excCutoff, widthHarm * f0 * dynBright);
    this.excAlpha = clamp(1 - Math.exp((-TWO_PI * widthCutoff) / sr), 0.01, 1);
    // The noise cutoff keytracks down into the bass: the massive deep-felt
    // bass hammer's scrub spectrum is far darker than the treble hammer's.
    const noiseCutoff =
      STRIKE_NOISE_CUTOFF_SCALE *
      excCutoff *
      2 ** (-NOISE_CUTOFF_BASS_OCT * Math.max(0, -octavesFromC4));
    this.noiseAlpha = clamp(1 - Math.exp((-TWO_PI * noiseCutoff) / sr), 0.01, 1);
    this.noiseAlpha3 = clamp(
      1 - Math.exp((-TWO_PI * NOISE_STEEP_RATIO * noiseCutoff) / sr),
      0.01,
      1,
    );
    this.excLp = 0;
    this.excLp2 = 0;

    // Felt impact noise: a short broadband burst radiated with the knock. It
    // is part of the same blow — it rides the injection tilt and the
    // dynamics-gated felt compression.
    this.noiseEnv =
      STRIKE_NOISE_GAIN *
      this.hammerAmp *
      dynBright *
      2 **
        (-NOISE_TREBLE_TAPER_OCT * Math.max(0, octavesFromC4) +
          (INJ_TILT_DB_OCT * clamp(octavesFromC4, -1.25, 1.25)) / 6.0206);
    this.knockGain =
      KNOCK_GAIN *
      2 **
        (KNOCK_BASS_BOOST_OCT * Math.max(0, -octavesFromC4) -
          KNOCK_TREBLE_TAPER_OCT * Math.max(0, octavesFromC4));
    this.knockLp = 0;
    this.knockLp2 = 0;
    this.knockLp3 = 0;
    // The thud deepens and slows into the bass: the massive bass hammer rocks
    // the whole board over ~10 ms.
    const thudHz = KNOCK_THUD_HZ * 2 ** (-KNOCK_THUD_BASS_OCT * Math.max(0, -octavesFromC4));
    this.knockLpA = clamp(1 - Math.exp((-TWO_PI * thudHz) / sr), 0, 1);
    this.knockLp3A = clamp(1 - Math.exp((-TWO_PI * NOISE_STEEP_RATIO * thudHz) / sr), 0, 1);
    this.bloom = 0;
    const bloomTauS = BLOOM_TAU_MS_C4 * 0.001 * 2 ** (-BLOOM_TAU_OCT * octavesFromC4);
    this.bloomA = clamp(1 - Math.exp(-1 / (bloomTauS * sr)), 1e-4, 1);
    this.noiseDecay = Math.exp(-1000 / (STRIKE_NOISE_TAU_MS * sr));
    this.noiseSamples = Math.trunc(STRIKE_NOISE_MAX_MS * 0.001 * sr);
    this.noisePos = 0;
    this.noiseLp = 0;
    this.noiseLp2 = 0;
    this.noiseLp3 = 0;
    this.noiseLow = 0;
    // The string-injected share is highpassed above the fundamental: a
    // random-phase component on h1 vector-cancels against the coherent pulse.
    this.noiseHpA = clamp(1 - Math.exp((-TWO_PI * 1.2 * f0) / sr), 0, 1);
    this.noiseRng = (Number((seed ^ (seed >> 32n) ^ 0x9e3779b9n) & 0xffffffffn) | 1) >>> 0;
    // Below C4 the injection grows: the bass hammer's felt scrub and re-strike
    // chatter seed the dense partial cloud a wound string radiates.
    this.noiseInject =
      STRIKE_NOISE_INJECT *
      2 **
        (-INJECT_TREBLE_TAPER_OCT * Math.max(0, octavesFromC4) +
          INJECT_BASS_BOOST_OCT * Math.max(0, -octavesFromC4));

    // Radiation highpass coefficients (RBJ biquad) and state.
    {
      const w = (TWO_PI * RADIATION_HP_HZ) / sr;
      const cw = Math.cos(w);
      const alpha = Math.sin(w) / (2 * RADIATION_HP_Q);
      const a0 = 1 + alpha;
      this.hpB0 = ((1 + cw) * 0.5) / a0;
      this.hpB1 = -(1 + cw) / a0;
      this.hpA1 = (-2 * cw) / a0;
      this.hpA2 = (1 - alpha) / a0;
      this.hpX1 = 0;
      this.hpX2 = 0;
      this.hpY1 = 0;
      this.hpY2 = 0;
    }

    // Bridge-hill emphasis coefficients (RBJ peaking) and state.
    {
      const bigA = 10 ** (BRIDGE_HILL_GAIN_DB / 40);
      const w = (TWO_PI * BRIDGE_HILL_HZ) / sr;
      const cw = Math.cos(w);
      const alpha = Math.sin(w) / (2 * BRIDGE_HILL_Q);
      const a0 = 1 + alpha / bigA;
      this.bhB0 = (1 + alpha * bigA) / a0;
      this.bhB1 = (-2 * cw) / a0;
      this.bhB2 = (1 - alpha * bigA) / a0;
      this.bhA1 = (-2 * cw) / a0;
      this.bhA2 = (1 - alpha / bigA) / a0;
      this.bhX1 = 0;
      this.bhX2 = 0;
      this.bhY1 = 0;
      this.bhY2 = 0;
    }
  }

  render(pitchRatio: number): number {
    if (this.numStrings <= 0) return 0;

    // Dynamic hammer: integrate the felt mass against the string's arrival at
    // the strike point, then comb the force by the strike position and pass
    // the velocity-driven felt-stiffness lowpass.
    let exc = 0;
    let knock = 0;
    let thudIn = 0;
    let force = 0;
    let x = 0;
    if (this.hamOn) {
      // String surface velocity at the strike point: the string recedes under
      // the net force through its wave admittance. Tension bounds the
      // excursion — the strike point is a sprung wave port, not a free
      // particle.
      const ysVel = this.ysAdm * this.lastForce;
      this.ys = Math.min(this.ys + ysVel, this.hamExit * -0.7);
      x = this.hamY - this.ys;
      if (x > 0) {
        const xdot = this.hamV - ysVel;
        force = this.hamK * x ** this.hamP * (1 + this.hamMu * xdot);
        force = Math.max(force, 0);
        this.hamV -= force;
      }
      this.hamY += this.hamV;
      if ((x <= 0 && this.hamV < 0 && this.hamY - this.ys < this.hamExit) || --this.hamTtl <= 0) {
        this.hamOn = false; // thrown clear (or shank recovery timeout)
        this.combTail = this.combDelay;
      }
    }
    if (this.hamOn || this.combTail > 0) {
      if (!this.hamOn) --this.combTail;
      const tap =
        this.combHist[
          (this.combIdx - this.combDelay + HAMMER_COMB_CAPACITY) % HAMMER_COMB_CAPACITY
        ];
      this.combHist[this.combIdx] = force;
      this.combIdx = (this.combIdx + 1) % HAMMER_COMB_CAPACITY;
      const combed = this.hamForceNorm * (force - tap);
      // Two-pole felt lowpass: the footprint is a spatial window over the
      // string, whose transmission falls ~12 dB/oct past the cap.
      this.excLp += this.excAlpha * (combed - this.excLp);
      this.excLp2 += this.excAlpha * (this.excLp - this.excLp2);
      exc = this.excLp2 / this.numStrings;
      thudIn = this.excLp2;
      this.lastForce = force;
    }
    if (this.noisePos < this.noiseSamples) {
      ++this.noisePos;
      this.noiseRng = (Math.imul(this.noiseRng, 1664525) + 1013904223) >>> 0;
      const white = (this.noiseRng >>> 8) * (1 / 8388608) - 1;
      // Two-pole felt-noise lowpass plus a steep third pole; the noise
      // radiates only through the knock's thud filter below (a felt hammer
      // puts almost nothing above a few kHz into the air).
      this.noiseLp += this.noiseAlpha * (white - this.noiseLp);
      this.noiseLp2 += this.noiseAlpha * (this.noiseLp - this.noiseLp2);
      this.noiseLp3 += this.noiseAlpha3 * (this.noiseLp2 - this.noiseLp3);
      const noise = this.noiseEnv * this.noiseLp3;
      this.noiseEnv *= this.noiseDecay;
      thudIn += noise;
      this.noiseLow += this.noiseHpA * (noise - this.noiseLow);
      // The scrub noise is generated at the strike point, so it sees the same
      // near-end reflection as the force pulse: comb it by the strike
      // position through its own history.
      const scrub = this.noiseInject * (noise - this.noiseLow);
      const widx = (this.noisePos - 1) % HAMMER_COMB_CAPACITY;
      this.noiseHist[widx] = scrub;
      const tapI = this.noisePos - 1 - this.combDelay;
      const tap = tapI >= 0 ? this.noiseHist[tapI % HAMMER_COMB_CAPACITY] : 0;
      exc += (scrub - tap) / this.numStrings;
    }
    // Three-pole thud filter: the knock is a low-frequency body event.
    this.knockLp += this.knockLpA * (thudIn - this.knockLp);
    this.knockLp2 += this.knockLpA * (this.knockLp - this.knockLp2);
    this.knockLp3 += this.knockLp3A * (this.knockLp2 - this.knockLp3);
    knock += this.knockGain * this.knockLp3;

    const ratio = pitchRatio > 0.01 ? pitchRatio : 0.01;
    let sum = 0;
    let lpSum = 0;
    for (let i = 0; i < this.numStrings; ++i) {
      const s = this.strings[i];
      if (s.line.size < 8) continue;
      // Coupled two-stage decay: the coherent (bridge) component recirculates
      // at the fast prompt rate, the residual at the slow aftersound rate.
      const fb = s.gSlow * s.lpState - (s.gSlow - s.gFast) * this.bridge;
      const delay = clamp(s.basePeriod / ratio - s.comp, 1, s.line.size - 4);
      const out = s.line.processFractional(Math.trunc(delay * 256), exc * s.strikeWeight + fb);
      // Dispersion allpass cascade then the loop lowpass.
      let v = out;
      for (const stage of s.ap) v = stage.process(v);
      s.lpState += this.loopAlpha * (v - s.lpState);
      lpSum += s.lpState;
      sum += out * s.radiateWeight;
    }
    this.bridge = lpSum / this.numStrings;
    // Board ring-up: the tone swells while the impact thud leads.
    this.bloom += this.bloomA * (1 - this.bloom);
    sum = sum * this.bloom + knock;
    // Soundboard radiation: the board barely radiates the lowest partials.
    const y =
      this.hpB0 * sum +
      this.hpB1 * this.hpX1 +
      this.hpB0 * this.hpX2 -
      this.hpA1 * this.hpY1 -
      this.hpA2 * this.hpY2;
    this.hpX2 = this.hpX1;
    this.hpX1 = sum;
    this.hpY2 = this.hpY1;
    this.hpY1 = y;
    // Bridge hill: the fixed-band mobility peak lifts whatever partials land
    // near it (bass crown, mid presence, treble body).
    const z =
      this.bhB0 * y +
      this.bhB1 * this.bhX1 +
      this.bhB2 * this.bhX2 -
      this.bhA1 * this.bhY1 -
      this.bhA2 * this.bhY2;
    this.bhX2 = this.bhX1;
    this.bhX1 = y;
    this.bhY2 = this.bhY1;
    this.bhY1 = z;
    return z;
  }

  /** Note-off: the damper caps both decay stages at releaseDampS. */
  release(): void {
    for (let i = 0; i < this.numStrings; ++i) {
      const s = this.strings[i];
      s.gSlow = Math.min(s.gSlow, this.releaseGain);
      s.gFast = Math.min(s.gFast, this.releaseGain);
    }
  }

  /** Immediate silence. */
  kill(): void {
    this.numStrings = 0;
    this.hammerAmp = 0;
    this.hamOn = false;
    this.noisePos = 0;
    this.noiseSamples = 0;
    this.noiseEnv = 0;
    this.noiseLp = 0;
    this.noiseLp2 = 0;
    this.noiseLp3 = 0;
    for (const s of this.strings) {
      s.lpState = 0;
      s.gSlow = 0;
      s.gFast = 0;
    }
    this.bridge = 0;
  }
}

const RESONANCE_MODES = 16;

interface ResonatorMode {
  a1: number;
  a2: number;
  gain: number;
  y1: number;
  y2: number;
}

function makeModes(count: number): ResonatorMode[] {
  return Array.from({ length: count }, () => ({ a1: 0, a2: 0, gain: 0, y1: 0, y2: 0 }));
}

/**
 * Pedal-gated sympathetic resonance: a small bank of string-mode resonators
 * driven by the bridge/voice mix while the dampers are lifted (Lehtonen,
 * Penttinen, Rauhala & Valimaki 2007). Instrument-wide in the host — one bank
 * fed the summed dry mix; for a single-note render it is fed the one voice.
 */
export class PianoResonanceBank {
  private modes = makeModes(RESONANCE_MODES);
  private gate = 0;
  private gateOpenCoeff = 1;
  private gateCloseCoeff = 1;
  private ringout = 1;
  private outGain = 0;

  /** Tunes the mode bank for `sampleRate` and clears the state. */
  prepare(sampleRate: number): void {
    const sr = sampleRate > 0 ? sampleRate : 48000;
    // A reduced set of string modes spread E1..E6 (every 4 semitones) — the
    // bass-to-mid register where undamped sympathetic resonance is strongest.
    for (let i = 0; i < RESONANCE_MODES; ++i) {
      const m = this.modes[i];
      const note = 28 + 4 * i;
      const f = noteToHz(note);
      if (f >= 0.45 * sr) {
        m.a1 = 0;
        m.a2 = 0;
        m.gain = 0;
        m.y1 = 0;
        m.y2 = 0;
        continue;
      }
      const w = (TWO_PI * f) / sr;
      const r = Math.exp(-6.907755279 / (sr * 0.6)); // ~0.6 s ring t60
      m.a1 = 2 * r * Math.cos(w);
      m.a2 = -r * r;
      // Unity-peak normalization so the bank is a weak coupling, not a
      // runaway bandpass on the played note.
      m.gain = 1 - r;
      m.y1 = 0;
      m.y2 = 0;
    }
    this.gate = 0;
    // Damper-open envelope: ~10 ms to lift, ~60 ms to fall.
    this.gateOpenCoeff = 1 - Math.exp(-1 / (0.01 * sr));
    this.gateCloseCoeff = 1 - Math.exp(-1 / (0.06 * sr));
    // Extra ring-out applied while the dampers are falling (~0.15 s t60).
    this.ringout = Math.exp(-6.907755279 / (sr * 0.15));
    // Weak sympathetic coupling (the played string still dominates).
    this.outGain = 0.06;
  }

  /** Clears the resonator state and the damper gate. */
  reset(): void {
    for (const m of this.modes) {
      m.y1 = 0;
      m.y2 = 0;
    }
    this.gate = 0;
  }

  /**
   * Adds the sympathetic resonance for one input sample. `damperOpen`
   * (sustain pedal down) gates the excitation through a smoothed envelope.
   */
  process(bridgeIn: number, damperOpen: boolean): number {
    // The dampers only rest on the speaking lengths: the duplex/aliquot
    // segments and the undamped top octaves keep a faint shimmer ringing even
    // with the pedal up.
    const duplexFloor = 0.3;
    const target = damperOpen ? 1 : duplexFloor;
    this.gate += (damperOpen ? this.gateOpenCoeff : this.gateCloseCoeff) * (target - this.gate);
    const x = this.gate * bridgeIn;
    let sum = 0;
    for (const m of this.modes) {
      const y = m.a1 * m.y1 + m.a2 * m.y2 + m.gain * x;
      m.y2 = m.y1;
      m.y1 = y;
      sum += y;
    }
    // As the dampers fall back the pedal-lifted strings stop ringing quickly.
    if (!damperOpen && this.gate < 0.5 && this.gate > 1.2 * duplexFloor) {
      for (const m of this.modes) {
        m.y1 *= this.ringout;
        m.y2 *= this.ringout;
      }
    }
    return this.outGain * sum;
  }
}

const SOUNDBOARD_MODES = 40;
const DIFFUSER_CAPACITY = 2048;

/**
 * Shared modal soundboard: one fixed bank of second-order resonators spread
 * across the board's radiating range with frequency-graded damping and a
 * low-mid radiation envelope, behind two Schroeder allpass phase diffusers.
 * Instrument-wide in the host (one board per grand); for a single-note render
 * it is driven by the one voice. Returns the phase-diffused complement of the
 * host's direct share plus the mix-scaled modal colour.
 */
export class PianoSoundboard {
  private modes = makeModes(SOUNDBOARD_MODES);
  private diffBuf: [Float32Array, Float32Array] = [
    new Float32Array(DIFFUSER_CAPACITY),
    new Float32Array(DIFFUSER_CAPACITY),
  ];
  private diffLen: [number, number] = [0, 0];
  private diffIdx: [number, number] = [0, 0];
  private in1 = 0;
  private in2 = 0;
  private outGain = 0;

  /** Tunes the mode bank for `sampleRate` at the patch soundboard `mix`. */
  prepare(sampleRate: number, mix: number): void {
    const sr = sampleRate > 0 ? sampleRate : 48000;
    this.outGain = clamp(mix, 0, 1);
    // Phase diffusers: two short Schroeder allpasses (flat magnitude) standing
    // in for the board's dense high-order mode lattice; incommensurate
    // lengths avoid a combined echo.
    const diffuserMs = [4.1, 9.7];
    for (let d = 0; d < 2; ++d) {
      this.diffLen[d] = clamp(Math.trunc(diffuserMs[d] * 0.001 * sr), 4, DIFFUSER_CAPACITY);
      this.diffBuf[d].fill(0);
      this.diffIdx[d] = 0;
    }
    // Modes log-spread across the soundboard's radiating band, with a
    // deterministic per-mode nudge breaking the geometric periodicity.
    const fLow = 92;
    const fHigh = 5400;
    for (let i = 0; i < SOUNDBOARD_MODES; ++i) {
      const m = this.modes[i];
      const u = i / (SOUNDBOARD_MODES - 1);
      const h = Math.imul(i + 1, 2654435761) >>> 0;
      const jit = (((h >>> 9) & 0xffff) / 65535 - 0.5) * 0.08;
      const f = fLow * (fHigh / fLow) ** u * (1 + jit);
      if (f >= 0.45 * sr) {
        m.a1 = 0;
        m.a2 = 0;
        m.gain = 0;
        m.y1 = 0;
        m.y2 = 0;
        continue;
      }
      const w = (TWO_PI * f) / sr;
      // Damping rises with frequency: the low body modes ring ~0.45 s, the
      // high modes are broad and brief.
      const t60 = clamp(0.6 * (fLow / f) ** 0.55, 0.04, 0.6);
      const r = Math.exp(-6.907755279 / (sr * t60));
      m.a1 = 2 * r * Math.cos(w);
      m.a2 = -r * r;
      // Radiation envelope: a low-mid tilt plus a broad bridge formant near
      // ~320 Hz, where a grand soundboard radiates most efficiently.
      const tilt = (320 / f) ** 0.35;
      const l = Math.log(f / 320);
      const formant = 1 + Math.exp((-l * l) / 0.9);
      // Bandpass residue (the process() zero at DC/Nyquist), exactly
      // peak-normalized so every mode's peak sits at the envelope level; the
      // residue is in quadrature with the dry path off-resonance, so it can
      // only add.
      const dRe = 1 - m.a1 * Math.cos(w) - m.a2 * Math.cos(2 * w);
      const dIm = m.a1 * Math.sin(w) + m.a2 * Math.sin(2 * w);
      const dMag = Math.sqrt(dRe * dRe + dIm * dIm);
      m.gain = (tilt * formant * dMag) / Math.max(2 * Math.sin(w), 1e-6);
      m.y1 = 0;
      m.y2 = 0;
    }
    this.in1 = 0;
    this.in2 = 0;
  }

  /** Clears the resonator and diffuser state. */
  reset(): void {
    for (const m of this.modes) {
      m.y1 = 0;
      m.y2 = 0;
    }
    for (let d = 0; d < 2; ++d) {
      this.diffBuf[d].fill(0);
      this.diffIdx[d] = 0;
    }
    this.in1 = 0;
    this.in2 = 0;
  }

  /**
   * Radiates one summed input sample: the phase-diffused complement of the
   * host's direct share plus the (mix-scaled) modal colour. The reference
   * core's sustain-air texture ships with a zero gain, so it is omitted here.
   */
  process(input: number): number {
    const diffuserG = 0.55;
    let d = input;
    for (let st = 0; st < 2; ++st) {
      const len = this.diffLen[st];
      if (len === 0) break;
      const buf = this.diffBuf[st];
      const idx = this.diffIdx[st];
      const v = d + diffuserG * buf[idx];
      const y = buf[idx] - diffuserG * v;
      buf[idx] = v;
      this.diffIdx[st] = idx + 1 < len ? idx + 1 : 0;
      d = y;
    }
    const bp = d - this.in2;
    this.in2 = this.in1;
    this.in1 = d;
    let sum = 0;
    for (const m of this.modes) {
      const y = m.a1 * m.y1 + m.a2 * m.y2 + m.gain * bp;
      m.y2 = m.y1;
      m.y1 = y;
      sum += y;
    }
    return (1 - PIANO_DIRECT_GAIN) * d + this.outGain * sum;
  }

  /**
   * The phase-diffused sample computed by the last process() call. Feed
   * resonance banks from this (not the raw dry) so their returns share the
   * radiated path's phase field.
   */
  lastDiffused(): number {
    return this.in1;
  }
}
