/**
 * Fixed body/formant resonance bank — the cheap end of commuted synthesis
 * (Smith & Van Duyne). Faithful port of libsonare's
 * `src/midi/synth/body_resonator.h`: a handful of low-Q two-pole resonators
 * approximating an instrument body's dominant modes, mixed over the dry voice.
 * This is the shared resonator stage layered after any exciter core.
 */

export type BodyType = 'none' | 'guitar' | 'violin' | 'wood-tube' | 'brass-bell' | 'vocal';

const MAX_MODES = 16;
const TWO_PI = 6.28318530718;
/** ln(1000) / pi — seconds of t60 per (Q / Hz). */
const T60_SEC_PER_Q_HZ = 2.19848;

interface Spec {
  freqHz: number;
  t60S: number;
  weight: number;
}

interface ModeQ {
  freqHz: number;
  q: number;
  weight: number;
}

interface Mode {
  a1: number;
  a2: number;
  gain: number;
  y1: number;
  y2: number;
}

function qToT60(freqHz: number, q: number): number {
  return (T60_SEC_PER_Q_HZ * q) / freqHz;
}

// Violin corpus from measured mobility/radiativity surveys (Dünnwald, Jansson,
// Bissinger, Gough): A0 air, CBR, B1-/B1+ corpus modes, wood-mode cluster, and
// the broad 2.4/2.7 kHz "bridge hill".
const VIOLIN_BANK: ModeQ[] = [
  { freqHz: 275, q: 24, weight: 0.9 },
  { freqHz: 405, q: 20, weight: 0.5 },
  { freqHz: 460, q: 22, weight: 0.85 },
  { freqHz: 550, q: 22, weight: 1.0 },
  { freqHz: 700, q: 15, weight: 0.55 },
  { freqHz: 870, q: 14, weight: 0.45 },
  { freqHz: 1100, q: 13, weight: 0.5 },
  { freqHz: 1350, q: 12, weight: 0.4 },
  { freqHz: 1600, q: 12, weight: 0.45 },
  { freqHz: 1950, q: 11, weight: 0.4 },
  { freqHz: 2350, q: 6, weight: 0.75 },
  { freqHz: 2750, q: 6, weight: 0.55 },
  { freqHz: 3400, q: 8, weight: 0.28 },
  { freqHz: 4200, q: 8, weight: 0.16 },
];
const VIOLIN_LEVEL = 0.42;

export class BodyResonator {
  private modes: Mode[] = Array.from({ length: MAX_MODES }, () => ({
    a1: 0,
    a2: 0,
    gain: 0,
    y1: 0,
    y2: 0,
  }));
  private x1 = 0;
  private x2 = 0;
  private numModes = 0;
  private mix = 0;

  /** Configure the bank from an explicit mode list. */
  startSpecs(specs: Spec[], sampleRate: number, mix: number): void {
    const sr = sampleRate > 0 ? sampleRate : 48000;
    this.mix = clamp(mix, 0, 1);
    this.numModes = 0;
    if (this.mix <= 0 || specs.length === 0) return;
    const count = Math.min(specs.length, MAX_MODES);
    for (let k = 0; k < count; ++k) {
      const spec = specs[k];
      if (spec.freqHz <= 0 || spec.freqHz >= 0.45 * sr) continue;
      const mode = this.modes[this.numModes];
      const w = (TWO_PI * spec.freqHz) / sr;
      const r = Math.exp(-6.907755279 / (sr * spec.t60S));
      mode.a1 = 2 * r * Math.cos(w);
      mode.a2 = -r * r;
      const re = 1 - r * Math.cos(2 * w);
      const im = r * Math.sin(2 * w);
      mode.gain = (spec.weight * (1 - r) * Math.sqrt(re * re + im * im)) / (2 * Math.sin(w));
      mode.y1 = 0;
      mode.y2 = 0;
      ++this.numModes;
    }
    this.x1 = 0;
    this.x2 = 0;
  }

  /** Configure a named voicing. `noteHz` tracks the played note (wood-tube). */
  start(type: BodyType, sampleRate: number, noteHz: number, mix: number): void {
    if (type === 'none') {
      this.mix = clamp(mix, 0, 1);
      this.numModes = 0;
      return;
    }
    let specs: Spec[] = [];
    switch (type) {
      case 'guitar':
        specs = [
          { freqHz: 100, t60S: 0.12, weight: 1.0 },
          { freqHz: 200, t60S: 0.08, weight: 0.7 },
          { freqHz: 400, t60S: 0.06, weight: 0.5 },
          { freqHz: 550, t60S: 0.05, weight: 0.35 },
        ];
        break;
      case 'violin':
        specs = VIOLIN_BANK.map((m) => ({
          freqHz: m.freqHz,
          t60S: qToT60(m.freqHz, m.q),
          weight: m.weight * VIOLIN_LEVEL,
        }));
        break;
      case 'wood-tube': {
        const f = Math.max(20, noteHz);
        specs = [
          { freqHz: f, t60S: 0.08, weight: 1.2 },
          { freqHz: f * 4, t60S: 0.04, weight: 0.3 },
        ];
        break;
      }
      case 'brass-bell':
        specs = [
          { freqHz: 1200, t60S: 0.014, weight: 1.0 },
          { freqHz: 2400, t60S: 0.01, weight: 0.6 },
          { freqHz: 3400, t60S: 0.008, weight: 0.4 },
        ];
        break;
      case 'vocal':
        specs = [
          { freqHz: 700, t60S: 0.03, weight: 1.0 },
          { freqHz: 1080, t60S: 0.024, weight: 0.7 },
          { freqHz: 2650, t60S: 0.014, weight: 0.45 },
          { freqHz: 3500, t60S: 0.01, weight: 0.3 },
        ];
        break;
    }
    this.startSpecs(specs, sampleRate, mix);
  }

  active(): boolean {
    return this.numModes > 0;
  }

  /** One sample through the bank: dry + mixed body response. */
  process(x: number): number {
    const bpIn = x - this.x2;
    this.x2 = this.x1;
    this.x1 = x;
    let body = 0;
    for (let k = 0; k < this.numModes; ++k) {
      const mode = this.modes[k];
      const y = mode.a1 * mode.y1 + mode.a2 * mode.y2 + mode.gain * bpIn;
      mode.y2 = mode.y1;
      mode.y1 = y;
      body += y;
    }
    return x + this.mix * body;
  }

  reset(): void {
    for (const mode of this.modes) {
      mode.y1 = 0;
      mode.y2 = 0;
    }
    this.x1 = 0;
    this.x2 = 0;
    this.numModes = 0;
  }
}

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}
