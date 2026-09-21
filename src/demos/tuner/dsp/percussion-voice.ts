/**
 * Membrane-modal + filtered-noise percussion core — the data-free drum family.
 * Faithful port of libsonare's `src/midi/synth/percussion_voice.{h,cpp}`
 * (Rossing, Cook).
 *
 * Two summed layers per kit piece: a small modal bank at the circular-membrane
 * (Rayleigh) ratios with a descending pitch envelope and a strike-point
 * weighting (J_m(alpha_mn * r) * cos(m * theta) at the strike), plus a seeded
 * noise burst through a dedicated TPT SVF band. On top ride the optional
 * layers: the clap burst train, the radiated upper bound over every noise
 * stream, a fixed shell-resonance bank, the snare wire rattle, the nonlinear
 * cymbal shimmer, the dense inharmonic FDN plate, and the PhISEM stochastic
 * particle model (shakers/scrapers). Every optional layer renders inert at
 * zero — the dry membrane is recovered.
 *
 * The direct contact radiation sits outside `render()` in `nextContact()`,
 * exactly as the C++ core has it: the contact reaches the listener without
 * passing through the voice's drive, filter or amplitude envelope, and each of
 * those three swallows it.
 */
import { BodyResonator } from './body-resonator';
import { FdnPlate } from './fdn-plate';
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
/**
 * Shake energy at zero velocity, as a fraction of its energy at full. The
 * energy scales both how loud a collision is and how often one happens, so it
 * reaches the output twice and reaches it on top of the velocity response the
 * voice already has. Held high enough that what velocity still carries here is
 * the collision rate, which is a shaker's own cue and not a level.
 */
const PHISEM_VELOCITY_FLOOR = 0.9;
/** Butterworth Q (1 / sqrt(2)), the resonance of every band-bounding stage. */
const INV_SQRT2 = Math.SQRT1_2;

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
  /**
   * Share of the tone layer that radiates straight to the listener. The rest
   * still drives the plate at full strength, so lowering this moves the modal
   * field later without making it quieter. 1 = every mode radiates directly,
   * which is what a piece with no plate keeps.
   */
  toneDirect: number;
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
  // --- burst train (hand clap) ---
  /**
   * Retriggers of the noise VCA after the strike (0 = off, bit-identical). A
   * clap is one noise source whose gate is reopened several times over the
   * first tens of milliseconds, and the smear that makes is not reachable from
   * a single exponential at any decay.
   */
  noiseBurstCount: number;
  /** Spacing between those retriggers (ms). */
  noiseBurstIntervalMs: number;
  /**
   * Decay of ONE retriggered burst (ms), short against `noiseDecayMs`. The two
   * run at once and mean different things — this is the slap, and
   * `noiseDecayMs` is the tail that carries on underneath the train.
   */
  noiseBurstDecayMs: number;
  // --- radiated upper bound ---
  /**
   * Upper bound (Hz) on every noise stream the struck head or plate radiates —
   * the burst, the wire rattle and the shimmer wash. 0 = unbounded. It is a
   * bound only while it sits above the corner it bounds; below it the two stop
   * composing and start squeezing.
   */
  noiseAirHz: number;
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
  // --- direct contact radiation ---
  /**
   * Level of the contact transient radiated straight from the strike, without
   * passing through any resonator (0 = off). Every other layer is a resonator
   * or a filtered burst excited at t = 0 and each needs time to speak, so the
   * model's first milliseconds would otherwise hold the tone bank and nothing
   * else. Parallel to the modal radiation rather than in front of it: the
   * strike is already the plate's excitation.
   */
  contact: number;
  /**
   * Contact time (ms). The pulse is one period of a sine over this length — the
   * derivative of a raised-cosine contact force — so its energy peaks at
   * 1 / contactMs and a harder, shorter contact is brighter. The voice's own
   * amplitude attack has to be able to pass it, so this and the amp attack are
   * one decision.
   */
  contactMs: number;
  // --- dense inharmonic plate (cymbals, gongs, bells) ---
  /**
   * Level of the plate resonator over the dry hit (0 = off). The strike — tone,
   * noise burst, rattle and wash together — is fed through a feedback delay
   * network that rings at thousands of inharmonic partials. A level rather than
   * a blend because the dry hit is the other half of the sound: metal reads as
   * metal by being dense *and* noisy at once, and the plate supplies only the
   * density.
   */
  plateGain: number;
  /** Reverberation time of the plate at the bottom of its band. */
  plateT60S: number;
  /**
   * Reverberation time at Nyquist as a fraction of `plateT60S`. A cymbal holds
   * its top far longer than a drum head does; at 1 the top is undamped.
   */
  plateHfRatio: number;
  /**
   * Lowest partial the network places (Hz). It scales every delay line, so it
   * sets the plate's size — and with it how far apart the partials sit.
   */
  plateLowHz: number;
  /**
   * Top of the band the plate responds in at all (Hz; 0 = up to Nyquist).
   * `plateHfRatio` does not stand in for it — that says how fast the top dies
   * once it is ringing, not whether it rings.
   */
  plateAirHz: number;
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
  /**
   * Body resonance centre (Hz; 0 = off): the gourd, shell or frame the
   * collisions happen inside. Separate from the band above because a real
   * shaker radiates two of them at once and they are octaves apart.
   */
  phisemBodyHz: number;
  /**
   * Q of the body resonance, per pole pair. Two identical pairs are cascaded,
   * because the measured peak is far narrower than one of them.
   */
  phisemBodyQ: number;
  /**
   * Level of the body against the direct band, as a fraction of the raw
   * collision amplitude. 0 = off.
   */
  phisemBodyGain: number;
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
    toneDirect: 1,
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
    noiseBurstCount: 0,
    noiseBurstIntervalMs: 10,
    noiseBurstDecayMs: 6,
    noiseAirHz: 0,
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
    contact: 0,
    contactMs: 0.3,
    plateGain: 0,
    plateT60S: 2,
    plateHfRatio: 0.6,
    plateLowHz: 180,
    plateAirHz: 0,
    phisemBeans: 0,
    phisemEnergyMs: 100,
    phisemSoundMs: 3,
    phisemResHz: 0,
    phisemResQ: 1,
    phisemBodyHz: 0,
    phisemBodyQ: 4,
    phisemBodyGain: 0,
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
 *
 * Exported because the host voice chain the parity harness mirrors runs its
 * patch filter stage through the same primitive (`SynthFilter` in `kSvf`
 * mode), and a second transcription of it would be a second source of truth.
 */
export class TptSvf {
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
  private toneDirect = 1;
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

  // Burst train: a second envelope over the SAME noise source and the same
  // band, summed with the tail before the filter — one source and one filter,
  // as the circuit has. Retriggering the tail envelope instead would restart
  // the tail as well and lose what runs on under the train.
  private noisePeak = 0;
  private burstLevel = 0;
  private burstCoeff = 0;
  private burstRemaining = 0;
  private burstPeriod = 0;
  private burstCountdown = 0;

  // Radiated upper bound (noiseAirHz). One low-pass per stream rather than one
  // over their sum: the filter is linear, so the two are the same signal, but
  // bounding each stream where it is summed leaves the accumulation order
  // untouched and makes the disabled state bit-identical to the voicing that
  // predates the field.
  private noiseAirHz = 0;
  private noiseAir = new TptSvf();
  private wireAir = new TptSvf();
  private shimmerAir = new TptSvf();

  private shell = new BodyResonator();

  // Direct contact radiation: one period of a sine over the contact time,
  // counted out in samples so the shape costs a sine per sample for a few dozen
  // samples and nothing at all thereafter.
  private contact = 0;
  private contactI = 0;
  private contactLen = 0;

  // Dense inharmonic plate, driven by the summed strike.
  private plateGain = 0;
  private plate = new FdnPlate();

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
  private phisemBodyGain = 0;
  private phisemGlideState = 0;
  private phisemGlideCoeff = 0;
  private phisemSr = 48000;
  private phisemProbIndex = 0;
  private phisemNoiseIndex = 0;
  private phisemFilter = new TptSvf();
  private phisemBody = new TptSvf();
  private phisemBody2 = new TptSvf();

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

    // Burst train. The retriggers reopen the gate to the level the strike
    // itself opened it to, velocity scaling included, so a soft clap stays a
    // soft clap.
    this.noisePeak = this.noiseLevel;
    this.burstLevel = 0;
    this.burstRemaining = this.noisePeak > 0 ? Math.max(0, Math.trunc(params.noiseBurstCount)) : 0;
    this.burstPeriod = Math.max(
      1,
      Math.round(Math.max(0.1, params.noiseBurstIntervalMs) * 0.001 * sr),
    );
    this.burstCountdown = this.burstPeriod;
    this.burstCoeff = Math.exp(-1 / (Math.max(1, params.noiseBurstDecayMs) * 0.001 * sr));

    // Radiated upper bound over every noise stream. Butterworth Q, because this
    // is a ceiling and a resonant one would put back a peak of its own.
    this.noiseAirHz = params.noiseAirHz > 0 ? Math.min(params.noiseAirHz, 0.45 * sr) : 0;
    if (this.noiseAirHz > 0) {
      for (const air of [this.noiseAir, this.wireAir, this.shimmerAir]) {
        air.prepare(sr);
        air.set(this.noiseAirHz, INV_SQRT2);
        air.reset();
      }
    }

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

    // Dense inharmonic plate. Off when the gain is zero (no delay lines
    // cleared, no state advanced, bit-identical to the voicing that predates
    // the field).
    this.plateGain = Math.max(0, params.plateGain);
    // The split is between two radiation paths, so with no plate there is no
    // second path and the field is inert. Left live it would be a second name
    // for toneGain on every membrane piece, and a fit handed two knobs for one
    // quantity trades them against each other.
    this.toneDirect = this.plateGain > 0 ? params.toneDirect : 1;
    if (this.plateGain > 0) {
      this.plate.start(
        sr,
        params.plateLowHz,
        params.plateT60S,
        params.plateHfRatio,
        params.plateAirHz,
      );
    } else {
      this.plate.reset();
    }

    // Direct contact radiation. Harder strikes press harder, so the level takes
    // the velocity; the contact time is the patch's.
    this.contact = Math.max(0, params.contact) * vel01;
    this.contactI = 0;
    this.contactLen = 0;
    if (this.contact > 0) {
      // One more sample than the period: the pulse spans [0, 1] inclusive, so
      // the period it voices is contactLen - 1 samples and the knob keeps its
      // unit.
      const period = Math.max(0.001, params.contactMs) * 0.001 * sr;
      this.contactLen = Math.max(2, 1 + Math.round(period));
    }

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
      this.phisemShakeEnergy = PHISEM_VELOCITY_FLOOR + (1 - PHISEM_VELOCITY_FLOOR) * vel01;
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
      this.phisemBodyGain = params.phisemBodyHz > 0 ? Math.max(0, params.phisemBodyGain) : 0;
      if (this.phisemBodyGain > 0) {
        const c = clamp(params.phisemBodyHz, 20, 0.45 * sr);
        const q = Math.max(0.5, params.phisemBodyQ);
        for (const pair of [this.phisemBody, this.phisemBody2]) {
          pair.prepare(sr);
          pair.set(c, q);
          pair.reset();
        }
      }
    }
  }

  /**
   * Renders one sample; `pitchRatio` is the common per-sample pitch factor
   * (multiplied with the internal descending pitch envelope).
   */
  render(pitchRatio: number): number {
    let mix = 0;
    // The share of the tone layer that reaches the plate without radiating
    // directly. Zero unless toneDirect is below one.
    let plateDrive = 0;

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
      // Split so the plate keeps the whole modal field while the direct path
      // takes only its share: what the plate re-radiates arrives a delay line
      // later, which is where the reference puts it.
      const voicedTone = this.toneGain * tone;
      mix += voicedTone * this.toneDirect;
      plateDrive = voicedTone * (1 - this.toneDirect);

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
        const wire = this.wireFilter.process(n).hp;
        mix += this.noiseAirHz > 0 ? this.wireAir.process(wire).lp : wire;
      }

      // Nonlinear shimmer: the quadratic membrane energy (tone^2) drives a
      // high shimmer band through a slow-attack follower, so the wash swells
      // after the strike and rides the inharmonic ring. One-way, so stable.
      if (this.shimmer > 0) {
        this.shimmerEnv += (tone * tone - this.shimmerEnv) * this.shimmerAttackCoeff;
        const n = this.noise.bipolarAt(SHIMMER_INDEX_BASE + this.shimmerIndex++);
        const wash = this.shimmerFilter.process(n * this.shimmerEnv * this.shimmer).hp;
        mix += this.noiseAirHz > 0 ? this.shimmerAir.process(wash).lp : wash;
      }
    }

    // Counted outside the level gate: the train has to keep its schedule across
    // the silence between a short burst and the next retrigger.
    if (this.burstRemaining > 0 && --this.burstCountdown <= 0) {
      this.burstLevel = this.noisePeak;
      this.burstCountdown = this.burstPeriod;
      --this.burstRemaining;
    }
    const noiseEnv = this.noiseLevel + this.burstLevel;
    if (noiseEnv > 1e-5) {
      const burst = this.noise.bipolarAt(NOISE_INDEX_BASE + this.noiseIndex++) * noiseEnv;
      this.noiseLevel *= this.noiseCoeff;
      this.burstLevel *= this.burstCoeff;
      const out = this.noiseFilter.process(burst);
      let voiced = 0;
      if (this.noiseOutput === 'highpass') voiced = out.hp;
      else if (this.noiseOutput === 'lowpass') voiced = out.lp;
      else voiced = out.bp;
      mix += this.noiseAirHz > 0 ? this.noiseAir.process(voiced).lp : voiced;
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
      const raw =
        this.noise.bipolarAt(PHISEM_NOISE_INDEX_BASE + this.phisemNoiseIndex++) *
        this.phisemSoundLevel;
      this.phisemSoundLevel *= this.phisemSoundDecay;
      let particle = raw;
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
      // The body is driven by the collisions themselves, not by the band above
      // it: the two are parallel radiation paths from one excitation, and
      // cascading them would leave the gourd with nothing left to resonate.
      if (this.phisemBodyGain > 0) {
        const b = this.phisemBody.process(raw).bp;
        mix += this.phisemBody2.process(b).bp * this.phisemBodyGain;
      }
    }

    // Dense inharmonic plate: the whole strike drives the network, because what
    // sets a plate ringing is the hit and not one layer of it. Added over the
    // dry hit rather than blended with it — the strike is the noisy half of the
    // sound and the plate is the dense half, and metal needs both.
    if (this.plateGain > 0) {
      const strike = mix + plateDrive;
      mix += this.plateGain * this.plate.process(strike);
    }

    if (this.shell.active()) mix = this.shell.process(mix);

    return mix;
  }

  /**
   * The direct contact radiation for this sample, taken out of `render()`
   * rather than summed into it: it reaches the listener without passing through
   * the voice's drive, filter or amplitude envelope, and each of those three
   * swallows it. Call once per sample, alongside `render()`.
   */
  nextContact(): number {
    if (this.contactI >= this.contactLen) return 0;
    // Spanning [0, 1] inclusive, so the pulse both starts and ends on a zero.
    // Dividing by the length instead leaves the last sample short of the period
    // and the step it ends on is a click with energy to Nyquist.
    const p = this.contactI++ / (this.contactLen - 1);
    return this.contact * Math.sin(TWO_PI * p);
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
    this.noisePeak = 0;
    this.burstLevel = 0;
    this.burstRemaining = 0;
    this.excite = false;
    this.noiseAirHz = 0;
    this.noiseAir.reset();
    this.wireAir.reset();
    this.shimmerAir.reset();
    this.shell.reset();
    this.plateGain = 0;
    this.plate.reset();
    this.toneDirect = 1;
    this.contact = 0;
    this.contactLen = 0;
    this.contactI = 0;
    this.wireBuzz = 0;
    this.wireFilter.reset();
    this.shimmer = 0;
    this.shimmerEnv = 0;
    this.shimmerFilter.reset();
    this.phisemBeans = 0;
    this.phisemShakeEnergy = 0;
    this.phisemSoundLevel = 0;
    this.phisemFilter.reset();
    this.phisemBodyGain = 0;
    this.phisemBody.reset();
    this.phisemBody2.reset();
  }
}

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

function clampInt(x: number, lo: number, hi: number): number {
  const t = Math.trunc(x);
  return t < lo ? lo : t > hi ? hi : t;
}
