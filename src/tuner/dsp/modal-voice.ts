/**
 * Modal-resonator-bank core — the mallet / bell / glass family. Faithful port
 * of libsonare's `src/midi/synth/modal_voice.{h,cpp}` (Adrien 1991; Essl & Cook
 * banded waveguides).
 *
 * A struck bar/bell is a sum of exponentially decaying sinusoidal modes; the
 * realism is all in the mode-ratio data. Each mode is a two-pole resonator
 * (y = a1*y1 + a2*y2) excited by a single strike impulse, weighted by a
 * velocity-driven mallet-hardness curve with per-mode decay scaling.
 */
import { VoiceRandomSequence } from './voice-random';

export const MAX_MODAL_MODES = 8;
const TWO_PI = 2 * Math.PI;

/** One resonator mode of a modal patch (1:1 with C++ `ModalMode`). */
export interface ModalMode {
  /** Frequency ratio to the played note (mode 0 is usually 1). */
  ratio: number;
  /** Excitation weight before the mallet-hardness curve. */
  gain: number;
  /** t60 multiplier for this mode (< 1 = dies faster than the fundamental). */
  decayScale: number;
}

/** Modal section of a patch (1:1 with C++ `ModalPatchParams`). */
export interface ModalPatchParams {
  numModes: number;
  modes: ModalMode[];
  /** Fundamental t60 at A4 in seconds. */
  decayS: number;
  /** t60 scales by 2^(stretch * octaves below A4). */
  decayStretch: number;
  /** Mallet hardness at full velocity in [0,1]. */
  strikeBrightness: number;
  /** Velocity -> hardness amount in [0,1]. */
  velToBrightness: number;
  /** Damped t60 in seconds applied at note-off. */
  releaseDampS: number;
}

function noteToHz(note: number): number {
  return 440 * 2 ** (((note & 0x7f) - 69) / 12);
}

/** Per-sample decay radius reaching -60 dB after `t60S`. */
function radiusFor(sampleRate: number, t60S: number): number {
  return Math.exp(-6.907755279 / (sampleRate * Math.max(0.01, t60S)));
}

interface ModeState {
  omega: number;
  r: number;
  gain: number;
  a1: number;
  a2: number;
  y1: number;
  y2: number;
}

function emptyMode(): ModeState {
  return { omega: 0, r: 0, gain: 0, a1: 0, a2: 0, y1: 0, y2: 0 };
}

export class ModalVoiceCore {
  private modes: ModeState[] = Array.from({ length: MAX_MODAL_MODES }, emptyMode);
  private numModes = 0;
  private sampleRate = 48000;
  private cachedRatio = 0;
  private releaseR = 1;
  private excite = false;

  start(
    params: ModalPatchParams,
    sampleRate: number,
    note: number,
    velocity: number,
    seed: bigint,
  ): void {
    this.sampleRate = sampleRate > 0 ? sampleRate : 48000;
    const f0 = noteToHz(note);

    const vel01 = (velocity & 0x7f) / 127;
    const velAmount = clamp(params.velToBrightness, 0, 1);
    const hardness = clamp(params.strikeBrightness, 0, 1) * (1 - velAmount + velAmount * vel01);

    const stretch = clamp(params.decayStretch, 0, 1);
    const octavesBelowA4 = (69 - (note & 0x7f)) / 12;
    const t60 = Math.max(0.01, params.decayS) * 2 ** (stretch * octavesBelowA4);

    const scatter = new VoiceRandomSequence(seed);
    this.numModes = Math.min(Math.max(params.numModes, 0), MAX_MODAL_MODES);
    const nyquistLimit = 0.45 * this.sampleRate;
    for (let k = 0; k < this.numModes; ++k) {
      const src = params.modes[k];
      const mode = this.modes[k];
      const freq = f0 * Math.max(0.01, src.ratio);
      mode.y1 = 0;
      mode.y2 = 0;
      if (freq >= nyquistLimit) {
        mode.omega = 0;
        mode.r = 0;
        mode.gain = 0;
        continue;
      }
      mode.omega = (TWO_PI * freq) / this.sampleRate;
      mode.r = radiusFor(this.sampleRate, t60 * Math.max(0.01, src.decayScale));
      const mallet = Math.exp(-(1 - hardness) * 1.5 * k);
      const jitter = 1 + 0.1 * scatter.bipolarAt(k);
      mode.gain = Math.max(0, src.gain) * mallet * jitter * Math.sin(mode.omega);
    }
    for (let k = this.numModes; k < MAX_MODAL_MODES; ++k) this.modes[k] = emptyMode();

    this.releaseR = radiusFor(this.sampleRate, Math.max(0.01, params.releaseDampS));
    this.cachedRatio = 0;
    this.excite = true;
  }

  private refreshCoefficients(pitchRatio: number): void {
    this.cachedRatio = pitchRatio;
    for (let k = 0; k < this.numModes; ++k) {
      const mode = this.modes[k];
      if (mode.gain === 0 && mode.r === 0) continue;
      const w = Math.min(mode.omega * pitchRatio, 0.95 * Math.PI);
      mode.a1 = 2 * mode.r * Math.cos(w);
      mode.a2 = -mode.r * mode.r;
    }
  }

  render(pitchRatio: number): number {
    if (this.numModes <= 0) return 0;
    if (pitchRatio !== this.cachedRatio) this.refreshCoefficients(pitchRatio);
    const x = this.excite ? 1 : 0;
    this.excite = false;
    let mix = 0;
    for (let k = 0; k < this.numModes; ++k) {
      const mode = this.modes[k];
      const y = mode.a1 * mode.y1 + mode.a2 * mode.y2 + mode.gain * x;
      mode.y2 = mode.y1;
      mode.y1 = y;
      mix += y;
    }
    return mix;
  }

  release(): void {
    for (let k = 0; k < this.numModes; ++k) {
      const mode = this.modes[k];
      if (mode.r > this.releaseR) mode.r = this.releaseR;
    }
    this.cachedRatio = 0;
  }

  kill(): void {
    for (const mode of this.modes) {
      mode.y1 = 0;
      mode.y2 = 0;
      mode.gain = 0;
    }
    this.excite = false;
    this.numModes = 0;
  }
}

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}
