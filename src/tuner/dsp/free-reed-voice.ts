/**
 * Free-reed core — the accordion / harmonica / bandoneon / reed-organ family
 * (GM 20-23). Faithful port of libsonare's `src/midi/synth/free_reed_voice.{h,cpp}`.
 *
 * A free reed is a thin metal tongue swinging freely through a close-fitting slot
 * under bellows pressure; unlike the beating reed of a clarinet it has no coupled
 * air column, so its pitch is set by the tongue itself. The model is a driven
 * tongue oscillator (not a bore waveguide): a phase accumulator at the note
 * fundamental, an asymmetric soft nonlinearity shaping it into the buzzy harmonic
 * spectrum, and a fixed body lowpass (reed-plate / cavity radiation). Two slightly
 * detuned tongues give the shimmering "musette" beating of an accordion. The
 * source is feed-forward (no acoustic loop), so the model owns no delay slab.
 */
import { VoiceRandomSequence } from './voice-random';

const TWO_PI = 2 * Math.PI;

// Musette detune span (cents) between the two tongues: detune 0 collapses to a
// single tongue (the second oscillator is skipped entirely).
const DETUNE_MIN_CENTS = 3;
const DETUNE_SPAN_CENTS = 12;

// Tongue nonlinearity calibration: asymmetry from reedStiffness skews the
// waveform (the even-harmonic free-reed bias); drive pushes the saturator toward
// its knee for the buzzy odd-harmonic edge.
const ASYM_BASE = 0.15;
const ASYM_SPAN = 0.45;
const DRIVE_BASE = 1.2;
const DRIVE_STIFF_SPAN = 2.4;
const DRIVE_BREATH_SPAN = 1.2;

// Body/radiation one-pole corner (Hz): brightness sweeps the reed-plate / cavity
// roll-off log-linearly from a mellow reed organ to a bright buzzy harmonica.
const BODY_MIN_HZ = 600;
const BODY_MAX_HZ = 9000;

// Leakage air hiss depth at breathNoise = 1 (added before the body lowpass).
const BREATH_NOISE_DEPTH = 0.12;

// Output trim: the saturated tongue sits near +/-1, so the bellows drive level
// maps a forte note into the other engines' range.
const OUTPUT_MIN = 0.3;
const OUTPUT_SPAN = 0.5;

/** Free-reed section of a patch (1:1 with C++ `FreeReedPatchParams`). */
export interface FreeReedPatchParams {
  brightness: number;
  reedStiffness: number;
  breathPressure: number;
  velToBreath: number;
  detune: number;
  attackMs: number;
  releaseMs: number;
  breathNoise: number;
}

/** Default free-reed params — matches the C++ struct member initializers. */
export function defaultFreeReedParams(): FreeReedPatchParams {
  return {
    brightness: 0.6,
    reedStiffness: 0.5,
    breathPressure: 0.7,
    velToBreath: 0.5,
    detune: 0.3,
    attackMs: 20,
    releaseMs: 80,
    breathNoise: 0.08,
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

export class FreeReedVoiceCore {
  // Two detuned tongue oscillators.
  private phaseA = 0;
  private phaseB = 0;
  private incA = 0;
  private incB = 0;
  private dual = false;

  // Tongue nonlinearity.
  private asymmetry = 0;
  private drive = 1;

  // Body lowpass.
  private bodyAlpha = 1;
  private bodyState = 0;

  // Bellows level contour.
  private levelTarget = 1;
  private level = 0;
  private attackCoeff = 0;
  private releaseCoeff = 0;
  private releasing = false;

  // Breath/air noise.
  private breathNoise = 0;
  private noise = new VoiceRandomSequence();
  private driveIndex = 1;

  private outputScale = 1;

  start(
    params: FreeReedPatchParams,
    sampleRate: number,
    note: number,
    velocity: number,
    seed: bigint,
  ): void {
    const sr = sampleRate > 0 ? sampleRate : 48000;
    this.noise = new VoiceRandomSequence(seed);
    this.driveIndex = 1;
    this.releasing = false;
    this.level = 0;
    this.levelTarget = 1;
    this.bodyState = 0;

    const baseFreq = noteToHz(note);
    this.incA = baseFreq / sr;

    // Musette pair: a second tongue a few cents sharp. detune == 0 keeps dual
    // false so the single-tongue path never touches the second oscillator.
    const detune = clamp(params.detune, 0, 1);
    this.dual = detune > 0;
    this.phaseA = 0;
    if (this.dual) {
      const cents = DETUNE_MIN_CENTS + DETUNE_SPAN_CENTS * detune;
      this.incB = this.incA * 2 ** (cents / 1200);
      // Decorrelate the pair's start (seeded, deterministic per voice).
      this.phaseB = this.noise.unipolarAt(0);
    } else {
      this.incB = 0;
      this.phaseB = 0;
    }

    // Bellows drive level: steady pressure blended with the struck velocity.
    const vel01 = (velocity & 0x7f) / 127;
    const velToBreath = clamp(params.velToBreath, 0, 1);
    const level = clamp((1 - velToBreath) * params.breathPressure + velToBreath * vel01, 0, 1);

    // Tongue nonlinearity.
    const stiffness = clamp(params.reedStiffness, 0, 1);
    this.asymmetry = ASYM_BASE + ASYM_SPAN * stiffness;
    this.drive = DRIVE_BASE + DRIVE_STIFF_SPAN * stiffness + DRIVE_BREATH_SPAN * level;

    // Body lowpass pole from brightness (log-swept corner, clamped under Nyquist).
    const brightness = clamp(params.brightness, 0, 1);
    const corner = Math.min(BODY_MIN_HZ * (BODY_MAX_HZ / BODY_MIN_HZ) ** brightness, 0.45 * sr);
    this.bodyAlpha = 1 - Math.exp((-TWO_PI * corner) / sr);

    // Contour + textures.
    this.attackCoeff = rampCoeff(params.attackMs, sr);
    this.releaseCoeff = rampCoeff(params.releaseMs, sr);
    this.breathNoise = clamp(params.breathNoise, 0, 1) * BREATH_NOISE_DEPTH;
    this.outputScale = OUTPUT_MIN + OUTPUT_SPAN * level;
  }

  render(pitchRatio: number): number {
    const ratio = pitchRatio > 0.01 ? pitchRatio : 0.01;

    const coeff = this.releasing ? this.releaseCoeff : this.attackCoeff;
    this.level += coeff * (this.levelTarget - this.level);

    // Tongue A: phase-accumulator saw shaped by the asymmetric saturator.
    this.phaseA += this.incA * ratio;
    this.phaseA -= Math.floor(this.phaseA);
    const sawA = 2 * this.phaseA - 1;
    const gainA = sawA >= 0 ? 1 + this.asymmetry : 1 - this.asymmetry;
    let tongue = Math.tanh(this.drive * gainA * sawA);

    // Tongue B (musette pair, gated).
    if (this.dual) {
      this.phaseB += this.incB * ratio;
      this.phaseB -= Math.floor(this.phaseB);
      const sawB = 2 * this.phaseB - 1;
      const gainB = sawB >= 0 ? 1 + this.asymmetry : 1 - this.asymmetry;
      tongue = 0.5 * (tongue + Math.tanh(this.drive * gainB * sawB));
    }

    // Leakage air hiss, before the body filter so it shares the radiation colour.
    if (this.breathNoise > 0) tongue += this.breathNoise * this.noise.bipolarAt(this.driveIndex);
    ++this.driveIndex;

    // Reed-plate / cavity radiation: one-pole roll-off.
    this.bodyState += this.bodyAlpha * (tongue - this.bodyState);

    return this.bodyState * this.level * this.outputScale;
  }

  release(): void {
    this.releasing = true;
    this.levelTarget = 0;
  }

  kill(): void {
    this.level = 0;
    this.levelTarget = 0;
    this.bodyState = 0;
    this.phaseA = 0;
    this.phaseB = 0;
    this.releasing = true;
  }
}
