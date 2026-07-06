/**
 * Buzzing-bridge plucked-string core — the harp / koto / sitar / tanpura family.
 * Faithful port of libsonare's `src/midi/synth/plucked_string_voice.{h,cpp}`.
 *
 * A fractional-delay string loop closed through a one-pole loss lowpass (the same
 * travelling-wave skeleton as the Karplus-Strong core), plus a curved bridge: on
 * each loop the returning wave is passed through a soft one-sided limiter whose
 * threshold the string amplitude periodically grazes. That grazing sprays energy
 * into the high partials every period — the shimmering metallic buzz of the
 * Indian jawari / Japanese sawari. With `buzz` at zero the limiter is bypassed
 * and the core is a clean plucked string (harp / koto).
 */
import { DelayLine } from './frac-delay';
import { VoiceRandomSequence } from './voice-random';

const TWO_PI = 2 * Math.PI;
const PLUCKED_MIN_FUNDAMENTAL_HZ = 20;

/** Excitation noise draws far above the voice-level draw indices. */
const NOISE_INDEX_BASE = 1 << 16;

/** Bridge-limiter travel above the threshold (a little give before the string
 *  is fully pinned; a stronger jawari sits closer to the surface). */
const BUZZ_SPAN_BASE = 0.35;

/** Output trim bringing the raw string loop up to a musical voice level. */
const PLUCKED_OUTPUT_SCALE = 0.85;

/** Plucked-string section of a patch (1:1 with C++ `PluckedStringPatchParams`). */
export interface PluckedStringPatchParams {
  brightness: number;
  decayS: number;
  decayStretch: number;
  pickPosition: number;
  excBrightness: number;
  velToBrightness: number;
  releaseDampS: number;
  buzz: number;
}

/** Default plucked-string params — matches the C++ struct member initializers. */
export function defaultPluckedParams(): PluckedStringPatchParams {
  return {
    brightness: 0.7,
    decayS: 4.0,
    decayStretch: 0.5,
    pickPosition: 0.2,
    excBrightness: 0.85,
    velToBrightness: 0.6,
    releaseDampS: 0.12,
    buzz: 0.0,
  };
}

/** Per-line delay-buffer capacity (samples): one string span. */
export function pluckedStringBufferCapacity(sampleRate: number): number {
  const sr = sampleRate > 0 ? sampleRate : 48000;
  return Math.trunc(sr / PLUCKED_MIN_FUNDAMENTAL_HZ) + 8;
}

function noteToHz(note: number): number {
  return 440 * 2 ** (((note & 0x7f) - 69) / 12);
}

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

/** Per-loop-traversal amplitude factor reaching -60 dB after `t60S`. */
function loopGainFor(periodSamples: number, sampleRate: number, t60S: number): number {
  const loopsToT60 = (sampleRate * Math.max(0.01, t60S)) / Math.max(1, periodSamples);
  return Math.exp(-6.907755279 / loopsToT60);
}

export class PluckedStringVoiceCore {
  private buffer: DelayLine;

  private basePeriod = 0;
  private loopComp = 1;
  private loopAlpha = 1;
  private lpState = 0;
  private loopGain = 0;
  private releaseGain = 0;

  private buzzThreshold = 0;
  private buzzAmount = 0;

  // Excitation burst.
  private noise = new VoiceRandomSequence();
  private excTotal = 0;
  private excPos = 0;
  private pickDelay = 0;
  private excAlpha = 1;
  private excLp = 0;

  private outputScale = 1;

  constructor(sampleRate: number) {
    this.buffer = new DelayLine(pluckedStringBufferCapacity(sampleRate));
  }

  start(
    params: PluckedStringPatchParams,
    sampleRate: number,
    note: number,
    velocity: number,
    seed: bigint,
  ): void {
    const sr = sampleRate > 0 ? sampleRate : 48000;
    this.noise = new VoiceRandomSequence(seed);

    const f0 = noteToHz(note);
    this.basePeriod = sr / f0;

    // Loop lowpass: brightness -> feedback coefficient a (y += (1-a)(x-y)).
    const a = (1 - clamp(params.brightness, 0, 1)) * 0.7;
    this.loopAlpha = 1 - a;
    this.lpState = 0;
    const omega = TWO_PI / this.basePeriod;
    const tauLp = Math.atan2(a * Math.sin(omega), 1 - a * Math.cos(omega)) / Math.max(omega, 1e-6);
    this.loopComp = 1 + tauLp;

    // Decay: t60 stretched per octave below A4 (low strings ring longer).
    const stretch = clamp(params.decayStretch, 0, 1);
    const octavesBelowA4 = (69 - (note & 0x7f)) / 12;
    const t60 = Math.max(0.05, params.decayS) * 2 ** (stretch * octavesBelowA4);
    this.loopGain = loopGainFor(this.basePeriod, sr, t60);
    this.releaseGain = loopGainFor(this.basePeriod, sr, Math.max(0.01, params.releaseDampS));

    // Buzzing bridge: a stronger jawari sits the threshold lower into the swing.
    // 0 disables the limiter so the render path is the plain plucked string.
    this.buzzAmount = clamp(params.buzz, 0, 1);
    this.buzzThreshold = this.buzzAmount > 0 ? 0.6 - 0.4 * this.buzzAmount : 0;

    // Excitation: one period of seeded noise through the pick-position comb and
    // the velocity-driven dynamic-level lowpass.
    this.excTotal = Math.max(8, Math.trunc(this.basePeriod));
    this.excPos = 0;
    this.pickDelay = Math.trunc(clamp(params.pickPosition, 0, 0.5) * this.basePeriod + 0.5);
    const vel01 = (velocity & 0x7f) / 127;
    const velAmount = clamp(params.velToBrightness, 0, 1);
    const bright = clamp(params.excBrightness, 0, 1) * (1 - velAmount + velAmount * vel01);
    const excCutoff = 300 * 2 ** (5.3 * bright);
    this.excAlpha = clamp(1 - Math.exp((-TWO_PI * excCutoff) / sr), 0.01, 1);
    this.excLp = 0;

    this.outputScale = PLUCKED_OUTPUT_SCALE;

    const size = Math.min(this.buffer.capacity, Math.trunc(this.basePeriod * 1.3) + 8);
    this.buffer.prime(size);
  }

  render(pitchRatio: number): number {
    if (this.buffer.size < 8) return 0;

    let exc = 0;
    if (this.excPos < this.excTotal + this.pickDelay) {
      let burst =
        this.excPos < this.excTotal ? this.noise.bipolarAt(NOISE_INDEX_BASE + this.excPos) : 0;
      if (this.pickDelay > 0 && this.excPos >= this.pickDelay) {
        burst -= this.noise.bipolarAt(NOISE_INDEX_BASE + (this.excPos - this.pickDelay));
      }
      ++this.excPos;
      this.excLp += this.excAlpha * (burst - this.excLp);
      exc = 0.7 * this.excLp;
    }

    const ratio = pitchRatio > 0.01 ? pitchRatio : 0.01;
    const delay = clamp(this.basePeriod / ratio - this.loopComp, 1, this.buffer.size - 4);
    const delayQ8 = Math.trunc(delay * 256);

    let loopIn = exc + this.loopGain * this.lpState;
    if (this.buzzThreshold > 0 && loopIn > this.buzzThreshold) {
      // Curved bridge: displacement toward the surface is softly limited once it
      // grazes the threshold, spraying energy into the high partials each period.
      const over = loopIn - this.buzzThreshold;
      const span = BUZZ_SPAN_BASE * (1 - 0.5 * this.buzzAmount);
      loopIn = this.buzzThreshold + (span * over) / (span + over);
    }

    const out = this.buffer.processFractional(delayQ8, loopIn);
    this.lpState += this.loopAlpha * (out - this.lpState);
    return out * this.outputScale;
  }

  release(): void {
    this.loopGain = Math.min(this.loopGain, this.releaseGain);
  }

  kill(): void {
    this.excPos = this.excTotal + this.pickDelay;
    this.loopGain = 0;
    this.lpState = 0;
    this.excLp = 0;
  }
}
