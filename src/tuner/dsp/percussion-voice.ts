/**
 * Membrane-modal + filtered-noise percussion core — the data-free drum family.
 * Faithful port of libsonare's `src/midi/synth/percussion_voice.{h,cpp}`
 * (Rossing, Cook).
 *
 * Two summed layers per kit piece: a small modal bank at the circular-membrane
 * (Rayleigh) ratios with a descending pitch envelope and a strike-point
 * weighting (J_m(alpha_mn * r) * cos(m * theta) at the strike), plus a seeded
 * noise burst through a dedicated TPT SVF band. On top ride the optional
 * layers: a fixed shell-resonance bank, the snare wire rattle, the nonlinear
 * cymbal shimmer, and the PhISEM stochastic particle model (shakers/scrapers).
 * Every optional layer renders inert at zero — the dry membrane is recovered.
 */
import { BodyResonator } from './body-resonator';
import { VoiceRandomSequence } from './voice-random';

export const MAX_PERCUSSION_MODES = 6;
export const MAX_SHELL_MODES = 4;

const TWO_PI = 2 * Math.PI;
// Per-layer noise draws live in disjoint index ranges so the streams stay
// decorrelated while remaining counter-based (bit-identical bounces).
const NOISE_INDEX_BASE = 2 ** 20;
const WIRE_INDEX_BASE = 2 ** 24;
const SHIMMER_INDEX_BASE = 2 ** 28;
const PHISEM_PROB_INDEX_BASE = 2 ** 30;
const PHISEM_NOISE_INDEX_BASE = 2 ** 31;
/** Random bead collisions per bean per unit shake energy per second. */
const PHISEM_COLLISION_RATE = 100;

/** Noise-layer filter tap (1:1 with C++ `SynthFilterOutput`). */
export type PercussionNoiseOutput = 'lowpass' | 'bandpass' | 'highpass';

/** Percussion section of a patch (1:1 with C++ `PercussionPatchParams`). */
export interface PercussionPatchParams {
  /** GM kit mode: note-on resolves the struck note through the GM drum map. */
  gmKit: boolean;
  /** GM exclusive/mute group (0 = none); resolved per note in kit playback. */
  exclusiveClass: number;
  // --- membrane/tone layer ---
  numModes: number;
  /** Mode ratios to the base frequency (circular membrane Rayleigh set). */
  modeRatios: number[];
  /** Fundamental t60 (seconds) of the tone layer. */
  modeDecayS: number;
  /** Tone layer mix gain. */
  toneGain: number;
  /** Base frequency override in Hz (0 = the struck key's frequency). */
  baseFreqHz: number;
  /** Strike pitch overshoot: tone starts (1 + pitchDrop) x base and falls back. */
  pitchDrop: number;
  pitchDropMs: number;
  // --- strike point (membrane excitation weighting) ---
  /** Normalized strike radius, 0 = membrane centre .. 1 = rim. */
  strikeR: number;
  /** Strike angle (radians); orients the m >= 1 degenerate sin/cos pair. */
  strikeTheta: number;
  /** Per-mode angular order m (nodal diameters), parallel to modeRatios. */
  modeM: number[];
  /** Per-mode Bessel zero alpha_mn (strike-shape argument scale). */
  modeAlpha: number[];
  // --- noise layer ---
  noiseGain: number;
  noiseDecayMs: number;
  noiseCutoffHz: number;
  noiseQ: number;
  noiseOutput: PercussionNoiseOutput;
  // --- shell resonance ---
  /** Mix of the drum-shell resonance over the summed tone+noise hit (0 = bypass). */
  shellMix: number;
  shellNumModes: number;
  /** Shell mode centres in Hz (0 = track the struck key). */
  shellFreqHz: number[];
  shellT60S: number[];
  shellWeight: number[];
  // --- snare wire rattle ---
  /** Wire-against-head buzz amount (0 = off, no rattle). */
  wireBuzz: number;
  /** Membrane level at which the wires start contacting the head. */
  wireThreshold: number;
  /** Cutoff of the high-pass through which the rattle is voiced. */
  wireCutoffHz: number;
  // --- nonlinear shimmer (cymbal/gong) ---
  /** Membrane-energy-pumped high shimmer wash (0 = off). */
  shimmer: number;
  /** Buildup time of the wash (follower lag delaying the shimmer onset). */
  shimmerAttackMs: number;
  /** High-pass cutoff of the shimmer band. */
  shimmerCutoffHz: number;
  // --- stochastic particle excitation (PhISEM: shakers / scrapers) ---
  /** Effective particle (bean) count driving the collision rate (0 = off). */
  phisemBeans: number;
  /** System-energy decay of one shake gesture (ms). */
  phisemEnergyMs: number;
  /** Per-collision sound decay (ms): the grain length of one bead click. */
  phisemSoundMs: number;
  /** Gourd/shell resonance centre (Hz; 0 = raw particle noise). */
  phisemResHz: number;
  /** Resonance Q (cabasa weak .. maraca / jingle stronger). */
  phisemResQ: number;
  /** Scrape ridge rate (Hz; 0 = pure random shaker). */
  phisemScrapeHz: number;
  /** Resonance pitch glide (cuica): starts at resHz * (1 + glide), eases back. */
  phisemPitchGlide: number;
}

/** Default percussion params — matches the C++ struct member initializers. */
export function defaultPercussionParams(): PercussionPatchParams {
  return {
    gmKit: false,
    exclusiveClass: 0,
    numModes: 0,
    modeRatios: [1.0, 1.59, 2.14, 2.3, 2.65, 0],
    modeDecayS: 0.3,
    toneGain: 1,
    baseFreqHz: 0,
    pitchDrop: 0,
    pitchDropMs: 40,
    strikeR: 0,
    strikeTheta: 0,
    modeM: [0, 1, 2, 0, 3, 0],
    modeAlpha: [2.4048, 3.8317, 5.1356, 5.5201, 6.3802, 0],
    noiseGain: 0,
    noiseDecayMs: 150,
    noiseCutoffHz: 2500,
    noiseQ: 1,
    noiseOutput: 'bandpass',
    shellMix: 0,
    shellNumModes: 0,
    shellFreqHz: [0, 0, 0, 0],
    shellT60S: [0.08, 0.06, 0.05, 0.04],
    shellWeight: [1, 0.7, 0.5, 0.35],
    wireBuzz: 0,
    wireThreshold: 0.1,
    wireCutoffHz: 4000,
    shimmer: 0,
    shimmerAttackMs: 40,
    shimmerCutoffHz: 8000,
    phisemBeans: 0,
    phisemEnergyMs: 100,
    phisemSoundMs: 3,
    phisemResHz: 0,
    phisemResQ: 1,
    phisemScrapeHz: 0,
    phisemPitchGlide: 0,
  };
}

function noteToHz(note: number): number {
  return 440 * 2 ** (((note & 0x7f) - 69) / 12);
}

/** Per-sample decay radius reaching -60 dB after `t60S`. */
function radiusFor(sampleRate: number, t60S: number): number {
  return Math.exp(-6.907755279 / (sampleRate * Math.max(0.005, t60S)));
}

/**
 * Bessel function of the first kind J_m(x) via the ascending power series
 * (1:1 with C++ `bessel_j`): integer order, bounded arguments (|x| <~ 7),
 * evaluated only at note-on.
 */
function besselJ(m: number, x: number): number {
  const order = Math.abs(Math.trunc(m));
  const half = 0.5 * x;
  const halfSq = half * half;
  let term = 1;
  for (let i = 1; i <= order; ++i) term *= half / i;
  let sum = term;
  for (let k = 1; k <= 24; ++k) {
    term *= -halfSq / (k * (k + order));
    sum += term;
    if (Math.abs(term) < 1e-12 * Math.abs(sum)) break;
  }
  return sum;
}

/**
 * Topology-preserving-transform (zero-delay-feedback) state variable filter
 * with simultaneous LP/BP/HP outputs (1:1 with C++ `TptSvf`) — stable and
 * zipper-free under per-sample cutoff modulation (Zavalishin).
 */
class TptSvf {
  private sampleRate = 48000;
  private cutoffHz = 1000;
  private qValue = Math.SQRT1_2;
  private k = Math.SQRT2;
  private a1 = 0;
  private a2 = 0;
  private a3 = 0;
  private ic1 = 0;
  private ic2 = 0;

  prepare(sampleRate: number): void {
    this.sampleRate = sampleRate > 0 ? sampleRate : 48000;
    this.set(this.cutoffHz, this.qValue);
    this.reset();
  }

  /** Set cutoff (Hz, clamped to [10, 0.49 * sr]) and Q (clamped to [0.5, 100]). */
  set(cutoffHz: number, q: number): void {
    this.cutoffHz = clamp(cutoffHz, 10, 0.49 * this.sampleRate);
    this.qValue = clamp(q, 0.5, 100);
    const g = Math.tan((Math.PI * this.cutoffHz) / this.sampleRate);
    this.k = 1 / this.qValue;
    this.a1 = 1 / (1 + g * (g + this.k));
    this.a2 = g * this.a1;
    this.a3 = g * this.a2;
  }

  reset(): void {
    this.ic1 = 0;
    this.ic2 = 0;
  }

  /** Advance one sample; returns the simultaneous LP/BP/HP outputs. */
  process(x: number): { lp: number; bp: number; hp: number } {
    const v3 = x - this.ic2;
    const v1 = this.a1 * this.ic1 + this.a2 * v3;
    const v2 = this.ic2 + this.a2 * this.ic1 + this.a3 * v3;
    this.ic1 = 2 * v1 - this.ic1;
    this.ic2 = 2 * v2 - this.ic2;
    return { lp: v2, bp: v1, hp: x - this.k * v1 - v2 };
  }
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

export class PercussionVoiceCore {
  private modes: ModeState[] = Array.from({ length: MAX_PERCUSSION_MODES }, emptyMode);
  private numModes = 0;
  private toneGain = 1;
  // Descending pitch envelope: ratio = 1 + dropState (one-pole decay).
  private dropState = 0;
  private dropCoeff = 0;
  private cachedRatio = 0;
  private excite = false;

  private noise = new VoiceRandomSequence();
  private noiseIndex = 0;
  private noiseLevel = 0;
  private noiseCoeff = 0;
  private noiseFilter = new TptSvf();
  private noiseOutput: PercussionNoiseOutput = 'bandpass';

  private shell = new BodyResonator();

  // Snare wire rattle: gated, velocity-scaled high-passed noise driven by the
  // membrane displacement crossing wireThreshold.
  private wireBuzz = 0;
  private wireThreshold = 0.1;
  private wireVel01 = 0;
  private wireIndex = 0;
  private wireFilter = new TptSvf();

  // Nonlinear cymbal shimmer: a high-passed wash whose level follows the
  // membrane energy (tone^2) through a slow attack, so it swells after the
  // strike. One-way pump => stable.
  private shimmer = 0;
  private shimmerEnv = 0;
  private shimmerAttackCoeff = 0;
  private shimmerIndex = 0;
  private shimmerFilter = new TptSvf();

  // Stochastic particle excitation (PhISEM: shakers / scrapers). A single
  // noise source scaled by an energy that each bead/ridge collision bumps,
  // with the system energy decaying over the shake, optionally through a
  // gourd/shell resonance (with a cuica pitch glide).
  private phisemBeans = 0;
  private phisemShakeEnergy = 0;
  private phisemSysDecay = 0;
  private phisemSoundLevel = 0;
  private phisemSoundDecay = 0;
  private phisemRate = 0;
  private phisemScrapePhase = 0;
  private phisemScrapeInc = 0;
  private phisemResHz = 0;
  private phisemResQ = 1;
  private phisemGlideState = 0;
  private phisemGlideCoeff = 0;
  private phisemSr = 48000;
  private phisemProbIndex = 0;
  private phisemNoiseIndex = 0;
  private phisemFilter = new TptSvf();

  constructor(sampleRate: number) {
    this.phisemSr = sampleRate > 0 ? sampleRate : 48000;
  }

  start(
    params: PercussionPatchParams,
    sampleRate: number,
    note: number,
    velocity: number,
    seed: bigint,
  ): void {
    const sr = sampleRate > 0 ? sampleRate : 48000;
    this.noise = new VoiceRandomSequence(seed);
    this.noiseIndex = 0;

    const baseHz = params.baseFreqHz > 0 ? params.baseFreqHz : noteToHz(note);
    const vel01 = (velocity & 0x7f) / 127;

    // Membrane modes: harder hits excite the upper ring modes a bit more.
    this.numModes = clampInt(params.numModes, 0, MAX_PERCUSSION_MODES);
    this.toneGain = Math.max(0, params.toneGain);
    const nyquistLimit = 0.45 * sr;
    for (let k = 0; k < this.numModes; ++k) {
      const ratio = params.modeRatios[k];
      const freq = baseHz * Math.max(0.01, ratio);
      if (ratio <= 0 || freq >= nyquistLimit) {
        this.modes[k] = emptyMode();
        continue;
      }
      const mode = this.modes[k];
      mode.y1 = 0;
      mode.y2 = 0;
      mode.omega = (TWO_PI * freq) / sr;
      // Upper membrane modes die faster than the fundamental (1/ratio scaling).
      mode.r = radiusFor(sr, Math.max(0.005, params.modeDecayS) / Math.max(1, ratio));
      const strike = k === 0 ? 1 : (0.4 + 0.4 * vel01) / (k + 1);
      // Strike-point weighting: each membrane mode is excited by the value of
      // its shape J_m(alpha_mn * r) * cos(m * theta) at the strike. A centre
      // hit (strikeR == 0) is the legacy uniform excitation.
      let strikePos = 1;
      if (params.strikeR > 0) {
        const m = Math.trunc(params.modeM[k]);
        const arg = params.modeAlpha[k] * params.strikeR;
        strikePos = Math.abs(besselJ(m, arg) * Math.cos(m * params.strikeTheta));
      }
      mode.gain = strike * Math.sin(mode.omega) * strikePos;
    }
    for (let k = this.numModes; k < MAX_PERCUSSION_MODES; ++k) this.modes[k] = emptyMode();

    // Descending pitch envelope.
    this.dropState = Math.max(0, params.pitchDrop);
    this.dropCoeff = Math.exp(-1 / (Math.max(1, params.pitchDropMs) * 0.001 * sr));
    this.cachedRatio = 0;
    this.excite = this.numModes > 0;

    // Noise layer.
    this.noiseLevel = Math.max(0, params.noiseGain) * (0.6 + 0.4 * vel01);
    this.noiseCoeff = Math.exp(-1 / (Math.max(1, params.noiseDecayMs) * 0.001 * sr));
    this.noiseOutput = params.noiseOutput;
    this.noiseFilter.prepare(sr);
    this.noiseFilter.set(params.noiseCutoffHz, Math.max(0.5, params.noiseQ));
    this.noiseFilter.reset();

    // Shell resonance: the summed hit rings through the drum body. A
    // note-tracked 0 Hz spec is taken to mean "track the struck key" so one
    // tom patch voices every tom size.
    const shellCount = clampInt(params.shellNumModes, 0, MAX_SHELL_MODES);
    const shellSpecs: { freqHz: number; t60S: number; weight: number }[] = [];
    for (let k = 0; k < shellCount; ++k) {
      const specHz = params.shellFreqHz[k];
      shellSpecs.push({
        freqHz: specHz > 0 ? specHz : baseHz,
        t60S: Math.max(0.005, params.shellT60S[k]),
        weight: params.shellWeight[k],
      });
    }
    this.shell.startSpecs(shellSpecs, sr, params.shellMix);

    // Snare wire rattle: gated noise driven by the membrane crossing the wire
    // contact threshold. Voiced through a dedicated high-pass.
    this.wireBuzz = Math.max(0, params.wireBuzz);
    this.wireThreshold = Math.max(0, params.wireThreshold);
    this.wireVel01 = vel01;
    this.wireIndex = 0;
    this.wireFilter.prepare(sr);
    this.wireFilter.set(params.wireCutoffHz, 0.9);
    this.wireFilter.reset();

    // Nonlinear cymbal shimmer: the membrane energy pumps a high shimmer band
    // through a slow attack follower (the buildup lag).
    this.shimmer = Math.max(0, params.shimmer);
    this.shimmerEnv = 0;
    this.shimmerAttackCoeff = 1 - Math.exp(-1 / (Math.max(1, params.shimmerAttackMs) * 0.001 * sr));
    this.shimmerIndex = 0;
    this.shimmerFilter.prepare(sr);
    this.shimmerFilter.set(params.shimmerCutoffHz, 0.7);
    this.shimmerFilter.reset();

    // Stochastic particle excitation (PhISEM). Off when beans == 0
    // (bit-identical — no draws, no state advance).
    this.phisemBeans = Math.max(0, params.phisemBeans);
    this.phisemSr = sr;
    this.phisemProbIndex = 0;
    this.phisemNoiseIndex = 0;
    this.phisemSoundLevel = 0;
    this.phisemScrapePhase = 0;
    this.phisemGlideState = 0;
    if (this.phisemBeans > 0) {
      // A shake gesture: the system energy is set by the strike and dies over
      // phisemEnergyMs; each collision bumps the sounding energy, which decays
      // over the short grain time phisemSoundMs.
      this.phisemShakeEnergy = 0.3 + 0.7 * vel01;
      this.phisemSysDecay = Math.exp(-1 / (Math.max(1, params.phisemEnergyMs) * 0.001 * sr));
      this.phisemSoundDecay = Math.exp(-1 / (Math.max(0.2, params.phisemSoundMs) * 0.001 * sr));
      this.phisemRate = PHISEM_COLLISION_RATE / sr;
      this.phisemScrapeInc = params.phisemScrapeHz > 0 ? params.phisemScrapeHz / sr : 0;
      this.phisemResHz = params.phisemResHz;
      this.phisemResQ = Math.max(0.5, params.phisemResQ);
      this.phisemGlideState = params.phisemPitchGlide;
      this.phisemGlideCoeff = Math.exp(-1 / (Math.max(1, params.phisemEnergyMs) * 0.001 * sr));
      this.phisemFilter.prepare(sr);
      if (this.phisemResHz > 0) {
        const c = this.phisemResHz * (1 + this.phisemGlideState);
        this.phisemFilter.set(clamp(c, 20, 0.45 * sr), this.phisemResQ);
      }
      this.phisemFilter.reset();
    }
  }

  /**
   * Renders one sample; `pitchRatio` is the common per-sample pitch factor
   * (multiplied with the internal descending pitch envelope).
   */
  render(pitchRatio: number): number {
    let mix = 0;

    if (this.numModes > 0) {
      // Tone layer with the descending strike pitch folded into the ratio.
      const ratio = pitchRatio * (1 + this.dropState);
      if (this.dropState > 0) {
        this.dropState *= this.dropCoeff;
        if (this.dropState < 1e-3) this.dropState = 0;
      }
      if (ratio !== this.cachedRatio) {
        this.cachedRatio = ratio;
        for (let k = 0; k < this.numModes; ++k) {
          const mode = this.modes[k];
          if (mode.gain === 0 && mode.r === 0) continue;
          const w = Math.min(mode.omega * ratio, 0.95 * Math.PI);
          mode.a1 = 2 * mode.r * Math.cos(w);
          mode.a2 = -mode.r * mode.r;
        }
      }
      const x = this.excite ? 1 : 0;
      this.excite = false;
      let tone = 0;
      for (let k = 0; k < this.numModes; ++k) {
        const mode = this.modes[k];
        const y = mode.a1 * mode.y1 + mode.a2 * mode.y2 + mode.gain * x;
        mode.y2 = mode.y1;
        mode.y1 = y;
        tone += y;
      }
      mix += this.toneGain * tone;

      // Snare wire rattle: while the membrane swing exceeds the contact
      // threshold the wires buzz against the bottom head. The gate scales with
      // how far the head is over threshold and with strike velocity, so harder
      // hits rattle louder and (because the membrane stays over threshold
      // longer) longer.
      if (this.wireBuzz > 0) {
        const contact = Math.abs(tone) - this.wireThreshold;
        const gate = contact > 0 ? Math.min(contact * 8, 1) : 0;
        const n =
          this.noise.bipolarAt(WIRE_INDEX_BASE + this.wireIndex++) *
          gate *
          this.wireVel01 *
          this.wireBuzz;
        mix += this.wireFilter.process(n).hp;
      }

      // Nonlinear shimmer: the quadratic membrane energy (tone^2) drives a
      // high shimmer band through a slow-attack follower, so the wash swells
      // after the strike and rides the inharmonic ring. One-way, so stable.
      if (this.shimmer > 0) {
        this.shimmerEnv += (tone * tone - this.shimmerEnv) * this.shimmerAttackCoeff;
        const n = this.noise.bipolarAt(SHIMMER_INDEX_BASE + this.shimmerIndex++);
        mix += this.shimmerFilter.process(n * this.shimmerEnv * this.shimmer).hp;
      }
    }

    if (this.noiseLevel > 1e-5) {
      const burst = this.noise.bipolarAt(NOISE_INDEX_BASE + this.noiseIndex++) * this.noiseLevel;
      this.noiseLevel *= this.noiseCoeff;
      const out = this.noiseFilter.process(burst);
      if (this.noiseOutput === 'highpass') mix += out.hp;
      else if (this.noiseOutput === 'lowpass') mix += out.lp;
      else mix += out.bp;
    }

    // Stochastic particle excitation (PhISEM). The shake energy decays over
    // the gesture; bead/ridge collisions bump the sounding energy that scales
    // a single noise source, optionally rung through a gourd resonance (cuica
    // glides it).
    if (this.phisemBeans > 0) {
      this.phisemShakeEnergy *= this.phisemSysDecay;
      let collide = false;
      // Scrape (guiro/cuica): a ridge passes under the scraper each period.
      if (this.phisemScrapeInc > 0) {
        this.phisemScrapePhase += this.phisemScrapeInc;
        if (this.phisemScrapePhase >= 1) {
          this.phisemScrapePhase -= 1;
          collide = true;
        }
      }
      // Random bead collisions on top; the rate falls as the shake dies out.
      const p = this.phisemBeans * this.phisemShakeEnergy * this.phisemRate;
      if (this.noise.unipolarAt(PHISEM_PROB_INDEX_BASE + this.phisemProbIndex++) < p) {
        collide = true;
      }
      if (collide) {
        this.phisemSoundLevel = Math.min(this.phisemSoundLevel + this.phisemShakeEnergy * 0.6, 4);
      }
      let particle =
        this.noise.bipolarAt(PHISEM_NOISE_INDEX_BASE + this.phisemNoiseIndex++) *
        this.phisemSoundLevel;
      this.phisemSoundLevel *= this.phisemSoundDecay;
      if (this.phisemResHz > 0) {
        // Cuica pitch glide: ease the resonance centre back to resHz.
        if (this.phisemGlideState !== 0) {
          this.phisemGlideState *= this.phisemGlideCoeff;
          if (Math.abs(this.phisemGlideState) < 1e-3) this.phisemGlideState = 0;
          const c = this.phisemResHz * (1 + this.phisemGlideState);
          this.phisemFilter.set(clamp(c, 20, 0.45 * this.phisemSr), this.phisemResQ);
        }
        particle = this.phisemFilter.process(particle).bp;
      }
      mix += particle;
    }

    if (this.shell.active()) mix = this.shell.process(mix);

    return mix;
  }

  /**
   * Kit pieces play one-shot in the host (the patch's one_shot flag), so
   * note-off never chokes a strike; the C++ core has no release path either.
   */
  release(): void {}

  /** Immediate silence. */
  kill(): void {
    for (const mode of this.modes) {
      mode.y1 = 0;
      mode.y2 = 0;
      mode.gain = 0;
    }
    this.numModes = 0;
    this.noiseLevel = 0;
    this.excite = false;
    this.shell.reset();
    this.wireBuzz = 0;
    this.wireFilter.reset();
    this.shimmer = 0;
    this.shimmerEnv = 0;
    this.shimmerFilter.reset();
    this.phisemBeans = 0;
    this.phisemShakeEnergy = 0;
    this.phisemSoundLevel = 0;
    this.phisemFilter.reset();
  }
}

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

function clampInt(x: number, lo: number, hi: number): number {
  const t = Math.trunc(x);
  return t < lo ? lo : t > hi ? hi : t;
}
