/**
 * Source-filter vocal core — the choir / voice family (GM 52-54).
 * Faithful port of libsonare's `src/midi/synth/vocal_voice.{h,cpp}`.
 *
 * Two stages: a GLOTTAL SOURCE (a band-limited sawtooth at the note fundamental
 * shaped by a one-pole spectral tilt, plus aspiration noise), feeding a FORMANT
 * BANK of parallel resonant bandpass biquads tuned to a vowel's F1..F5. The vowel
 * selector picks the formant table; brightness tilts the source and opens the
 * upper formants. A voice-local vibrato modulates the source pitch. No delay
 * line is needed (source-filter is feed-forward).
 */
import { VoiceRandomSequence } from './voice-random';

const TWO_PI = 2 * Math.PI;

/** Formant bank size (F1..F5). */
const VOCAL_FORMANTS = 5;

/** One vowel formant: centre frequency, level relative to F1, and bandwidth. */
interface VowelFormant {
  freqHz: number;
  ampDb: number;
  bwHz: number;
}

// Bass-voice vowel formant tables (F1..F5), indexed by the vowel selector
// (0 = /a/, 1 = /e/, 2 = /i/, 3 = /o/, 4 = /u/), from the classic sung-bass
// measurements used by the Csound FOF vowel corpus.
const VOWEL_TABLE: VowelFormant[][] = [
  // /a/
  [
    { freqHz: 600, ampDb: 0, bwHz: 60 },
    { freqHz: 1040, ampDb: -7, bwHz: 70 },
    { freqHz: 2250, ampDb: -9, bwHz: 110 },
    { freqHz: 2450, ampDb: -9, bwHz: 120 },
    { freqHz: 2750, ampDb: -20, bwHz: 130 },
  ],
  // /e/
  [
    { freqHz: 400, ampDb: 0, bwHz: 40 },
    { freqHz: 1620, ampDb: -12, bwHz: 80 },
    { freqHz: 2400, ampDb: -9, bwHz: 100 },
    { freqHz: 2800, ampDb: -12, bwHz: 120 },
    { freqHz: 3100, ampDb: -18, bwHz: 120 },
  ],
  // /i/
  [
    { freqHz: 250, ampDb: 0, bwHz: 60 },
    { freqHz: 1750, ampDb: -30, bwHz: 90 },
    { freqHz: 2600, ampDb: -16, bwHz: 100 },
    { freqHz: 3050, ampDb: -22, bwHz: 120 },
    { freqHz: 3340, ampDb: -28, bwHz: 120 },
  ],
  // /o/
  [
    { freqHz: 400, ampDb: 0, bwHz: 40 },
    { freqHz: 750, ampDb: -11, bwHz: 80 },
    { freqHz: 2400, ampDb: -21, bwHz: 100 },
    { freqHz: 2600, ampDb: -20, bwHz: 120 },
    { freqHz: 2900, ampDb: -40, bwHz: 120 },
  ],
  // /u/
  [
    { freqHz: 350, ampDb: 0, bwHz: 40 },
    { freqHz: 600, ampDb: -20, bwHz: 60 },
    { freqHz: 2400, ampDb: -32, bwHz: 100 },
    { freqHz: 2675, ampDb: -28, bwHz: 120 },
    { freqHz: 2950, ampDb: -36, bwHz: 120 },
  ],
];

// Glottal-source tilt corner (Hz): brightness slides the corner up so a forward,
// ringing voice keeps more source harmonics for the upper formants.
const TILT_CORNER_BASE_HZ = 350;
const TILT_CORNER_OCT_SPAN = 3;

// Brightness also opens the upper formants (dB), scaled to 0 at F1 so the vowel
// identity carried by F1/F2 is untouched.
const BRIGHT_FORMANT_SPAN_DB = 12;

// Aspiration depth at breathNoise == 1 (mixed before the formant bank so the
// breath is vowel-coloured like real aspiration).
const BREATH_DEPTH = 0.25;

// Vibrato depth scale: depth 1 modulates the pitch by about +/-50 cents.
const VIBRATO_MAX_FRAC = 0.03;

// Output trim and velocity-to-level floor.
const OUTPUT_SCALE = 2.0;
const VEL_FLOOR = 0.4;

/** Vocal section of a patch (1:1 with C++ `VocalPatchParams`). */
export interface VocalPatchParams {
  /** 0=/a/ 1=/e/ 2=/i/ 3=/o/ 4=/u/ — chooses the formant table. */
  vowel: number;
  brightness: number;
  breathNoise: number;
  vibratoRateHz: number;
  vibratoDepth: number;
  attackMs: number;
  releaseMs: number;
}

/** Default vocal params — matches the C++ struct member initializers. */
export function defaultVocalParams(): VocalPatchParams {
  return {
    vowel: 0,
    brightness: 0.5,
    breathNoise: 0.1,
    vibratoRateHz: 5.5,
    vibratoDepth: 0.3,
    attackMs: 30,
    releaseMs: 120,
  };
}

function noteToHz(note: number): number {
  return 440 * 2 ** (((note & 0x7f) - 69) / 12);
}

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

/** One-pole ramp coefficient reaching ~95% of the target in `ms`. */
function rampCoeff(ms: number, sampleRate: number): number {
  const t = Math.max(0.5, ms) * 0.001 * sampleRate;
  return 1 - Math.exp(-3 / Math.max(1, t));
}

export class VocalVoiceCore {
  // Glottal source.
  private phase = 0;
  private phaseInc = 0;
  private tiltState = 0;
  private tiltAlpha = 1;

  // Formant bank (Direct Form II transposed; a1/a2 stored negated).
  private numFormants = 0;
  private b0 = new Float64Array(VOCAL_FORMANTS);
  private b2 = new Float64Array(VOCAL_FORMANTS);
  private a1 = new Float64Array(VOCAL_FORMANTS);
  private a2 = new Float64Array(VOCAL_FORMANTS);
  private fgain = new Float64Array(VOCAL_FORMANTS);
  private z1 = new Float64Array(VOCAL_FORMANTS);
  private z2 = new Float64Array(VOCAL_FORMANTS);

  // Level contour.
  private levelTarget = 1;
  private level = 0;
  private attackCoeff = 0;
  private releaseCoeff = 0;
  private releasing = false;

  // Voice-local vibrato.
  private vibDepth = 0;
  private vibPhase = 0;
  private vibInc = 0;

  // Aspiration noise.
  private breath = 0;
  private noise = new VoiceRandomSequence();
  private driveIndex = 0;

  private outputScale = 1;

  start(
    params: VocalPatchParams,
    sampleRate: number,
    note: number,
    velocity: number,
    seed: bigint,
  ): void {
    const sr = sampleRate > 0 ? sampleRate : 48000;
    this.noise = new VoiceRandomSequence(seed);
    this.driveIndex = 0;

    // Glottal source pitch.
    const baseFreq = noteToHz(note);
    this.phase = 0;
    this.phaseInc = baseFreq / sr;

    // Source tilt.
    const bright = clamp(params.brightness, 0, 1);
    const corner = Math.min(TILT_CORNER_BASE_HZ * 2 ** (TILT_CORNER_OCT_SPAN * bright), 0.45 * sr);
    this.tiltAlpha = 1 - Math.exp((-TWO_PI * corner) / sr);
    this.tiltState = 0;

    // Formant bank: RBJ constant-0dB-peak bandpass biquads at the vowel's F1..F5.
    const vowel = params.vowel >= 0 && params.vowel < 5 ? params.vowel : 0;
    this.numFormants = VOCAL_FORMANTS;
    for (let i = 0; i < VOCAL_FORMANTS; ++i) {
      const fm = VOWEL_TABLE[vowel][i];
      const f = Math.min(fm.freqHz, 0.45 * sr);
      const q = f / Math.max(1, fm.bwHz);
      const w = (TWO_PI * f) / sr;
      const alpha = Math.sin(w) / (2 * q);
      const a0 = 1 + alpha;
      this.b0[i] = alpha / a0;
      this.b2[i] = -this.b0[i];
      this.a1[i] = (2 * Math.cos(w)) / a0;
      this.a2[i] = -(1 - alpha) / a0;
      const openDb = (bright - 0.5) * BRIGHT_FORMANT_SPAN_DB * (i / (VOCAL_FORMANTS - 1));
      this.fgain[i] = 10 ** ((fm.ampDb + openDb) / 20);
      this.z1[i] = 0;
      this.z2[i] = 0;
    }

    // Aspiration and vibrato.
    this.breath = clamp(params.breathNoise, 0, 1) * BREATH_DEPTH;
    this.vibDepth = clamp(params.vibratoDepth, 0, 1) * VIBRATO_MAX_FRAC;
    this.vibPhase = 0;
    this.vibInc = this.vibDepth > 0 ? (TWO_PI * Math.max(0.1, params.vibratoRateHz)) / sr : 0;

    // Level contour.
    this.level = 0;
    this.levelTarget = 1;
    this.releasing = false;
    this.attackCoeff = rampCoeff(params.attackMs, sr);
    this.releaseCoeff = rampCoeff(params.releaseMs, sr);

    const vel01 = (velocity & 0x7f) / 127;
    this.outputScale = OUTPUT_SCALE * (VEL_FLOOR + (1 - VEL_FLOOR) * vel01);
  }

  render(pitchRatio: number): number {
    const ratio = pitchRatio > 0.01 ? pitchRatio : 0.01;

    const coeff = this.releasing ? this.releaseCoeff : this.attackCoeff;
    this.level += coeff * (this.levelTarget - this.level);

    let vib = 1;
    if (this.vibDepth > 0) {
      vib = 1 + this.vibDepth * Math.sin(this.vibPhase);
      this.vibPhase += this.vibInc;
      if (this.vibPhase >= TWO_PI) this.vibPhase -= TWO_PI;
    }

    let inc = this.phaseInc * ratio * vib;
    if (inc > 0.45) inc = 0.45;
    this.phase += inc;
    this.phase -= Math.floor(this.phase);
    const saw = 2 * this.phase - 1;
    this.tiltState += this.tiltAlpha * (saw - this.tiltState);
    let exc = this.tiltState;
    if (this.breath > 0) exc += this.breath * this.noise.bipolarAt(this.driveIndex);
    ++this.driveIndex;

    let sum = 0;
    for (let i = 0; i < this.numFormants; ++i) {
      const y = this.b0[i] * exc + this.z1[i];
      this.z1[i] = this.a1[i] * y + this.z2[i];
      this.z2[i] = this.b2[i] * exc + this.a2[i] * y;
      sum += this.fgain[i] * y;
    }

    return sum * this.level * this.outputScale;
  }

  release(): void {
    this.releasing = true;
    this.levelTarget = 0;
  }

  kill(): void {
    this.level = 0;
    this.levelTarget = 0;
    this.releasing = true;
    this.phase = 0;
    this.tiltState = 0;
    this.vibPhase = 0;
    for (let i = 0; i < VOCAL_FORMANTS; ++i) {
      this.z1[i] = 0;
      this.z2[i] = 0;
    }
  }
}
