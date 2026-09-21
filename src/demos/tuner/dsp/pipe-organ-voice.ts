/**
 * Flue (labial) organ-pipe core — the self-oscillating church-organ family.
 * Faithful port of libsonare's `src/midi/synth/pipe_organ_voice.{h,cpp}`
 * (Fletcher & Rossing; Fabre & Hirschberg lumped jet model).
 *
 * Each rank is an independent jet pipe: a bore delay line (the travelling-wave
 * air column) beside a short jet delay line (the jet's convection time), driven
 * by a cubic jet table whose inverting small-signal slope, with the bore
 * reflection, forms the oscillator and whose clamp bounds the limit cycle. One
 * note-on sounds a whole registration (the drawn ranks summed); `rankCount == 0`
 * plays a single implicit 8' rank built from the flat patch fields. The shared
 * wind supply (tremulant / wind sag) is a host-side pitch/level modulation and
 * is not part of this core; a steady note renders with `pitchRatio == 1`.
 */
import { DelayLine } from './frac-delay';
import { VoiceRandomSequence } from './voice-random';

const TWO_PI = 2 * Math.PI;

/** Maximum ranks (pipes) one key sounds at once. */
export const MAX_PIPE_RANKS = 8;

/** Lowest fundamental the pipe delay line is sized for (the 16' octave). */
const PIPE_MIN_FUNDAMENTAL_HZ = 16;

// Mouth-pressure calibration (shared with the flute jet): the exposed band
// lands the jet in its self-oscillating region.
const BREATH_BASE = 0.8;
const BREATH_SPAN = 0.35;

// Jet delay / bore-line ratio: ~0.5 drives an open pipe's fundamental.
const JET_RATIO_OPEN = 0.5;

// Reflection coefficients (the two feedback taps), clamped below runaway.
const REFLECT_MAX = 0.62;

// Open-end reflection lowpass corner as a MULTIPLE of the sounding f0.
const REFLECT_CORNER_BASE = 1.6;
const REFLECT_CORNER_SPAN = 3.4;

// Pitch correction: trims the loop delay so the jet+bore lock lands on pitch.
const PITCH_CORRECT_OPEN = 1.0012;

// In-loop DC-blocker corner (~10 Hz).
const DC_CORNER_HZ = 10;

// Even-harmonic pump (open pipe); a stopped rank keeps only a trace.
const EVEN_PUMP_GAIN = 0.62;
const EVEN_PUMP_STOPPED = 0.08;
const EVEN_PUMP_DC_HZ = 30;

// Reed (lingual) voicing: a harder, more asymmetric jet drive.
const REED_ASYM = 0.55;
const REED_DRIVE = 0.5;

// Mouth/radiation high-shelf corner (Hz) and lift.
const RADIATION_CORNER_HZ = 800;
const RADIATION_LIFT = 2.5;

// Treble regulation (rank-level keytrack) around the C4 reference.
const KEYTRACK_REF_NOTE = 60;
const KEYTRACK_SLOPE = 1;
// Bass-side regulation of the high mutations (footage > 4).
const TIERCE_BASS_SLOPE = 6;

// Chiff onset burst depth and band (a multiple of the KEY's f0, capped).
const CHIFF_GAIN = 0.15;
const CHIFF_CORNER_MULT = 3;
const CHIFF_CORNER_MAX_HZ = 3000;
// Bore pre-fill: an f0 sine seed so the jet locks promptly.
const BORE_PREFILL = 0.3;

// Speech swell: a pipe settles its speech over ~this many fundamental periods,
// growing per octave below the reference so the bass pipes bloom in last.
const SPEAK_PERIODS = 40;
const SPEAK_BASS_PER_OCT = 1;
const SPEAK_REF_HZ = 261.63;
// Foot-pressure rise floor: keeps the jet self-oscillating from sample one.
const FOOT_PRESSURE_FLOOR = 0.55;
// Speech-time clamps and the upperwork floor (fraction of the key's swell).
const SPEAK_MIN_MS = 160;
const SPEAK_MAX_MS = 1300;
const SPEAK_UPPERWORK_FLOOR = 0.25;

// Output trim: frequency-compensated toward a flat target peak.
const OUTPUT_TARGET_PEAK = 0.32;
const PEAK_BASE = 4;
const PEAK_TILT = -0.05;
const PEAK_REF_HZ = 261.63;

// Per-pipe tuning error (cents, peak), tapered toward the treble.
const PIPE_DETUNE_CENTS = 4;
const DETUNE_TAPER_REF_HZ = 261.63;

// Jet turbulence: the continuous wind hiss around the speaking partials.
const JET_TURBULENCE = 0.035;
const TURB_CORNER_MULT = 4;
const TURB_CORNER_MAX_HZ = 3000;

// Post-loop tone corner as a multiple of the pipe's sounding f0.
const TONE_CORNER_MULT = 7.3;
const RAD_TONE_SPAN = 1;
const TONE_TREBLE_TAPER = 0.35;

// Determinism: chiff / turbulence draw bases; a per-rank high-bit offset.
const CHIFF_INDEX_BASE = 1n << 24n;
const TURB_INDEX_BASE = 1n << 32n;
const RANK_NOISE_SHIFT = 48n;

/** One rank in a registration (1:1 with C++ `PipeOrganRank`). */
export interface PipeOrganRank {
  /** Pitch multiplier (footage): the rank sounds note f0 * footageMult. */
  footageMult: number;
  /** Stopped (gedackt/bourdon) pipe: hollow, fundamental-dominant voicing. */
  stopped: boolean;
  /** Reflection-filter openness in [0,1] (this rank's voicing brightness). */
  brightness: number;
  /** Rank mix level in [0,1] (balance within the stop). */
  level: number;
  /** Reed (lingual) character in [0,1]: 0 = flue, >0 = brassy lingual buzz. */
  reed: number;
  /** Mouth/radiation correction in [0,1] (post-loop high-shelf lift). */
  radiation: number;
}

/** Pipe-organ section of a patch (1:1 with C++ `PipeOrganPatchParams`). */
export interface PipeOrganPatchParams {
  /** Stopped pipe for the single implicit rank (used when rankCount == 0). */
  stopped: boolean;
  /** Reflection-filter openness in [0,1] for the single implicit rank. */
  brightness: number;
  /** Bore purity (seconds at A4): a longer nominal ring is a purer bore. */
  toneDecayS: number;
  /** Mouth pressure / jet drive in [0,1]. */
  breath: number;
  /** Onset speech transient (chiff) amount in [0,1]. */
  chiff: number;
  /** Chiff decay time constant (ms). */
  chiffMs: number;
  /** Breath fall at note-off (seconds): the wind stops, the bore rings down. */
  releaseDampS: number;
  /** Reed character in [0,1] for the single implicit rank. */
  reed: number;
  /** Mouth/radiation correction in [0,1] for the single implicit rank. */
  radiation: number;
  /** Treble regulation (rank-level keytrack) in [0,1]; 0 is a bypass. */
  keytrack: number;
  /** Registration size (0 = a single implicit 8' rank). */
  rankCount: number;
  /** The drawn ranks (footage / pipe type / voicing / balance per pipe). */
  ranks: PipeOrganRank[];
  /** Tremulant rate in Hz (0 = off) — read by the host wind supply. */
  tremulantRateHz: number;
  /** Tremulant depth in [0,1] — read by the host wind supply. */
  tremulantDepth: number;
  /** Wind sag in [0,1] — read by the host wind supply. */
  windSag: number;
  /** Swell-box depth in [0,1] — read by the host into a bus filter. */
  swell: number;
}

/** One default rank (the C++ `PipeOrganRank` struct defaults). */
export function defaultPipeOrganRank(): PipeOrganRank {
  return { footageMult: 1, stopped: false, brightness: 0.5, level: 1, reed: 0, radiation: 0 };
}

/** The C++ `PipeOrganPatchParams` struct defaults. */
export function defaultPipeOrganParams(): PipeOrganPatchParams {
  return {
    stopped: false,
    brightness: 0.5,
    toneDecayS: 4,
    breath: 0.35,
    chiff: 0.5,
    chiffMs: 18,
    releaseDampS: 0.08,
    reed: 0,
    radiation: 0,
    keytrack: 0,
    rankCount: 0,
    ranks: Array.from({ length: MAX_PIPE_RANKS }, defaultPipeOrganRank),
    tremulantRateHz: 0,
    tremulantDepth: 0,
    windSag: 0,
    swell: 0,
  };
}

/** Per-span delay-buffer capacity (samples): one bore or jet span. */
export function pipeOrganBufferCapacity(sampleRate: number): number {
  const sr = sampleRate > 0 ? sampleRate : 48000;
  return Math.trunc(sr / PIPE_MIN_FUNDAMENTAL_HZ) + 8;
}

function noteToHz(note: number): number {
  return 440 * 2 ** (((note & 0x7f) - 69) / 12);
}

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

/**
 * Deterministic per-pipe tuning error in [-1, 1]: keyed on (note, rank) only,
 * so the same pipe is always tuned the same way (uint32 hash as in C++).
 */
function pipeTuningError(note: number, rank: number): number {
  let h = (Math.imul(note, 2654435761) + Math.imul(rank, 40503)) >>> 0;
  h = (h ^ (h >>> 15)) >>> 0;
  h = Math.imul(h, 2246822519) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  return (h & 0xffffff) * (2 / 16777215) - 1;
}

/** One-pole ramp coefficient reaching ~95% of the target in `ms`. */
function rampCoeff(ms: number, sampleRate: number): number {
  const t = Math.max(0.5, ms) * 0.001 * sampleRate;
  return 1 - Math.exp(-3 / Math.max(1, t));
}

/**
 * The jet function: the S-shaped saturating transfer of the air jet deflecting
 * across the labium. The odd cubic's small-signal slope is inverting near zero
 * (the oscillator drive); `asym` seeds the even harmonics; the clamp bounds the
 * limit cycle.
 */
function jetTable(x: number, asym: number): number {
  const y = x * (x * x - 1) + asym * x * x;
  return y < -1 ? -1 : y > 1 ? 1 : y;
}

/** One flue pipe (one rank): a self-oscillating jet + bore waveguide. */
interface RankState {
  bore: DelayLine;
  jet: DelayLine;
  /** Last bore delay-line output (returns to the mouth next sample). */
  boreOut: number;
  /** Ideal loop period (samples) at pitchRatio == 1. */
  borePeriod: number;
  /** Loop delay NOT in the line (feedback register + loop-filter phase). */
  comp: number;
  /** Jet convection delay as a fraction of the bore LINE delay. */
  jetRatio: number;
  // Open-end reflection: one-pole loss lowpass, its state, loss gain, sign.
  lpAlpha: number;
  lpState: number;
  lossGain: number;
  /** Bore loss applied at note-off so the pipe stops speaking promptly. */
  releaseLoss: number;
  sign: number;
  // Jet / end reflection coefficients (the two feedback taps).
  jetReflection: number;
  endReflection: number;
  // Jet-table asymmetry and drive (reed pipes push both).
  jetAsym: number;
  jetDrive: number;
  // In-loop DC blocker on the jet output.
  dcX1: number;
  dcY1: number;
  dcR: number;
  // Even-harmonic pump (open pipe only; near-muted for stopped).
  evenGain: number;
  evenState: number;
  evenHpAlpha: number;
  /** Steady mouth pressure. */
  breath: number;
  // Per-rank speech swell (post-loop): ramps 0 -> 1 over the speak time.
  wind: number;
  speakCoeff: number;
  // Jet turbulence lowpass (the wind hiss around the speaking partials).
  turbAlpha: number;
  turbState: number;
  // Post-loop tone filter (two cascaded one-poles).
  toneAlpha: number;
  toneS1: number;
  toneS2: number;
  // Chiff onset burst (one-pole decay, band-limited noise).
  chiffLevel: number;
  chiffCoeff: number;
  chiffLpAlpha: number;
  chiffLpState: number;
  // Mouth/radiation high-shelf (post-loop, outside the feedback path).
  radGain: number;
  radAlpha: number;
  radState: number;
  /** Rank mix gain (level * chorus norm) and output trim. */
  mix: number;
  outputScale: number;
  noiseOffset: bigint;
}

function emptyRank(capacity: number): RankState {
  return {
    bore: new DelayLine(capacity),
    jet: new DelayLine(capacity),
    boreOut: 0,
    borePeriod: 0,
    comp: 1,
    jetRatio: JET_RATIO_OPEN,
    lpAlpha: 1,
    lpState: 0,
    lossGain: 1,
    releaseLoss: 0,
    sign: 1,
    jetReflection: 0.5,
    endReflection: 0.5,
    jetAsym: 0.5,
    jetDrive: 1,
    dcX1: 0,
    dcY1: 0,
    dcR: 0,
    evenGain: 0,
    evenState: 0,
    evenHpAlpha: 0,
    breath: 0,
    wind: 0,
    speakCoeff: 0,
    turbAlpha: 1,
    turbState: 0,
    toneAlpha: 1,
    toneS1: 0,
    toneS2: 0,
    chiffLevel: 0,
    chiffCoeff: 0,
    chiffLpAlpha: 1,
    chiffLpState: 0,
    radGain: 0,
    radAlpha: 0,
    radState: 0,
    mix: 0,
    outputScale: 1,
    noiseOffset: 0n,
  };
}

export class PipeOrganVoiceCore {
  private readonly spanCapacity: number;
  private readonly ranks: RankState[];
  private rankCount = 0;

  // Breath contour shared by every rank (the wind gate).
  private breathLevel = 0;
  private attackCoeff = 0;
  private releaseCoeff = 0;
  private releasing = false;

  // Determinism: one seeded stream, drawn per rank at a high-bit offset.
  private noise = new VoiceRandomSequence();
  private driveIndex = 0;

  constructor(sampleRate: number) {
    this.spanCapacity = pipeOrganBufferCapacity(sampleRate);
    this.ranks = Array.from({ length: MAX_PIPE_RANKS }, () => emptyRank(this.spanCapacity));
  }

  start(
    params: PipeOrganPatchParams,
    sampleRate: number,
    note: number,
    velocity: number,
    seed: bigint,
  ): void {
    const sr = sampleRate > 0 ? sampleRate : 48000;
    this.noise = new VoiceRandomSequence(seed);
    this.driveIndex = 0;
    this.releasing = false;
    this.breathLevel = 0;

    // Resolve the registration: an explicit rank list, or a single implicit 8'
    // rank built from the flat {stopped, brightness}.
    const implicit: PipeOrganRank = {
      footageMult: 1,
      stopped: params.stopped,
      brightness: params.brightness,
      level: 1,
      reed: params.reed,
      radiation: params.radiation,
    };
    let ranks: PipeOrganRank[] = [implicit];
    let count = 1;
    if (params.rankCount > 0) {
      ranks = params.ranks;
      count = Math.min(params.rankCount, MAX_PIPE_RANKS);
    }
    this.rankCount = count;

    // Chorus normalisation: decorrelated pipes add in power.
    let power = 0;
    for (let r = 0; r < count; ++r) {
      const lvl = clamp(ranks[r].level, 0, 1);
      power += lvl * lvl;
    }
    const norm = 1 / Math.sqrt(Math.max(1e-6, power));

    const baseF0 = noteToHz(note);
    // Treble regulation: octaves the played note sits above/below the C4
    // reference; combined per rank with the rank's footage below.
    const keytrack = clamp(params.keytrack, 0, 1);
    const octavesAbove = Math.max(0, ((note & 0x7f) - KEYTRACK_REF_NOTE) / 12);
    const octavesBelow = Math.max(0, (KEYTRACK_REF_NOTE - (note & 0x7f)) / 12);
    const vel01 = (velocity & 0x7f) / 127;
    // Mouth pressure: the patch breath sets the dynamic, velocity opens it a touch.
    const level = clamp(0.7 * clamp(params.breath, 0, 1) + 0.3 * vel01, 0, 1);
    const mouth = BREATH_BASE + BREATH_SPAN * level;

    // Wind gate contour: a quick speak on, a ring-down on release.
    this.attackCoeff = rampCoeff(8, sr);
    this.releaseCoeff = rampCoeff(Math.max(0.01, params.releaseDampS) * 1000, sr);

    // Bore purity: toneDecayS maps to the bore loss.
    const purity = clamp(params.toneDecayS / 8, 0, 1);
    const lossGain = clamp(0.945 + 0.05 * purity, 0.5, 0.998);

    const dcR = 1 - (TWO_PI * DC_CORNER_HZ) / sr;
    const evenHp = clamp(1 - Math.exp((-TWO_PI * EVEN_PUMP_DC_HZ) / sr), 0, 1);

    for (let r = 0; r < count; ++r) {
      const pipe = this.ranks[r];
      pipe.noiseOffset = BigInt(r) << RANK_NOISE_SHIFT;
      pipe.mix = clamp(ranks[r].level, 0, 1) * norm;

      const stopped = ranks[r].stopped;
      const footage = ranks[r].footageMult > 0.01 ? ranks[r].footageMult : 1;
      const f0 = baseF0 * footage;

      // Treble regulation: thin the upperwork (footage > 1) toward the treble;
      // keytrack == 0 is a bit-identical bypass.
      if (keytrack > 0) {
        const footageOctaves = Math.max(0, Math.log2(Math.max(0.01, footage)));
        pipe.mix /= 1 + KEYTRACK_SLOPE * keytrack * octavesAbove * footageOctaves;
        // Bass regulation: high mutations are treble colour only.
        if (footage > 4.01) {
          pipe.mix /= 1 + TIERCE_BASS_SLOPE * keytrack * octavesBelow;
        }
      }
      const period = sr / Math.max(1, f0);
      // Every rank is a positive-feedback open jet pipe; a STOPPED rank is that
      // open pipe voiced hollow (even pump muted, reflection darkened).
      // Per-pipe tuning error: a few cents, fixed per (rank, note).
      const detuneSpan = PIPE_DETUNE_CENTS / (1 + Math.max(0, Math.log2(f0 / DETUNE_TAPER_REF_HZ)));
      const detune = 2 ** ((detuneSpan * pipeTuningError(note, r)) / 1200);
      pipe.borePeriod = (period * PITCH_CORRECT_OPEN) / detune;
      pipe.sign = 1;
      pipe.jetRatio = JET_RATIO_OPEN;

      // Reed voicing: drive the jet harder and more asymmetrically.
      const reed = clamp(ranks[r].reed, 0, 1);
      pipe.jetAsym = 0.5 + REED_ASYM * reed;
      pipe.jetDrive = 1 + REED_DRIVE * reed;
      pipe.jetReflection = Math.min(0.5 + 0.12 * reed, REFLECT_MAX);
      pipe.endReflection = 0.5;
      pipe.lossGain = lossGain;
      // Note-off bore loss: -60 dB in releaseDampS so the pipe stops promptly.
      const relT60 = Math.max(0.02, params.releaseDampS);
      const loopsToT60 = (sr * relT60) / Math.max(1, period);
      pipe.releaseLoss = Math.min(lossGain, Math.exp(-6.907755279 / Math.max(1, loopsToT60)));

      // Open-end reflection lowpass: corner tracks the pitch so the harmonic
      // damping is consistent across the whole compass.
      let bright = clamp(ranks[r].brightness + 0.3 * reed, 0, 1);
      if (stopped) bright = Math.min(bright, 0.35);
      const corner = (REFLECT_CORNER_BASE + REFLECT_CORNER_SPAN * bright) * f0;
      const alpha = clamp(1 - Math.exp((-TWO_PI * corner) / sr), 0.05, 1);
      const a = 1 - alpha;
      pipe.lpAlpha = alpha;
      pipe.lpState = 0;

      pipe.dcX1 = 0;
      pipe.dcY1 = 0;
      pipe.dcR = dcR;
      pipe.boreOut = 0;

      // Even-harmonic pump: the octave-rich open flue colour.
      pipe.evenGain = stopped ? EVEN_PUMP_STOPPED : EVEN_PUMP_GAIN;
      pipe.evenState = 0;
      pipe.evenHpAlpha = evenHp;

      // Tuning compensation at the SOUNDING fundamental: one feedback register,
      // the reflection lowpass's phase delay, and the DC blocker's phase LEAD.
      const omega = (TWO_PI * f0) / sr;
      const tauLp =
        Math.atan2(a * Math.sin(omega), 1 - a * Math.cos(omega)) / Math.max(omega, 1e-6);
      const phaseDc =
        Math.atan2(Math.sin(omega), 1 - Math.cos(omega)) -
        Math.atan2(dcR * Math.sin(omega), 1 - dcR * Math.cos(omega));
      const tauDc = phaseDc / Math.max(omega, 1e-6);
      pipe.comp = 1 + tauLp - tauDc;

      pipe.breath = mouth;

      // Chiff onset burst (post-loop): noise band-limited around the pipe's
      // speaking partials.
      pipe.chiffLevel = clamp(params.chiff, 0, 1) * CHIFF_GAIN;
      pipe.chiffCoeff = Math.exp(-1 / Math.max(1, Math.max(0.5, params.chiffMs) * 0.001 * sr));
      const chiffCorner = Math.min(CHIFF_CORNER_MULT * baseF0, CHIFF_CORNER_MAX_HZ);
      pipe.chiffLpAlpha = clamp(1 - Math.exp((-TWO_PI * chiffCorner) / sr), 0.01, 1);
      pipe.chiffLpState = 0;
      // Keep the burst's energy roughly constant as the band narrows.
      pipe.chiffLevel *= Math.sqrt((2 - pipe.chiffLpAlpha) / pipe.chiffLpAlpha);

      // Mouth/radiation high-shelf (post-loop, outside the loop).
      const radiation = clamp(ranks[r].radiation, 0, 1);
      pipe.radGain = radiation * RADIATION_LIFT;
      pipe.radAlpha = clamp(1 - Math.exp((-TWO_PI * RADIATION_CORNER_HZ) / sr), 0, 1);
      pipe.radState = 0;

      // Output trim (frequency-compensated toward a flat target peak).
      const peakEst = clamp(
        PEAK_BASE + PEAK_TILT * Math.log2(Math.max(1, f0) / PEAK_REF_HZ),
        0.8,
        6,
      );
      pipe.outputScale = OUTPUT_TARGET_PEAK / peakEst;

      // Circular spans: the loop period plus bend-down headroom and the
      // interpolator stencil margin. The jet span reuses the same size.
      const eff = Math.max(2, pipe.borePeriod - pipe.comp);
      const span = Math.min(this.spanCapacity, Math.max(16, Math.trunc(eff * 1.15) + 8));
      pipe.bore.prime(span);
      pipe.jet.prime(span);

      // Jet turbulence band: the wind hiss around this pipe's speaking partials.
      const turbCorner = Math.min(TURB_CORNER_MULT * f0, TURB_CORNER_MAX_HZ);
      pipe.turbAlpha = clamp(1 - Math.exp((-TWO_PI * turbCorner) / sr), 0.01, 1);
      pipe.turbState = 0;

      // Post-loop tone filter: this pipe radiates a fairly pure tone; the top
      // octaves are the upperwork's job.
      const toneMult = TONE_CORNER_MULT / (1 + TONE_TREBLE_TAPER * octavesAbove);
      pipe.toneAlpha = clamp(
        1 - Math.exp((-TWO_PI * toneMult * (1 + RAD_TONE_SPAN * radiation) * f0) / sr),
        0.01,
        1,
      );
      pipe.toneS1 = 0;
      pipe.toneS2 = 0;

      // Speech swell: this rank blooms in over its own speak time, floored at a
      // fraction of the key's swell so the mutations never land as a bare click.
      const periodMs = (1000 * period) / sr;
      const rankPeriods =
        SPEAK_PERIODS *
        (1 + SPEAK_BASS_PER_OCT * Math.max(0, Math.log2(SPEAK_REF_HZ / Math.max(1, f0))));
      const notePeriods =
        SPEAK_PERIODS *
        (1 + SPEAK_BASS_PER_OCT * Math.max(0, Math.log2(SPEAK_REF_HZ / Math.max(1, baseF0))));
      const noteSpeakMs = clamp(
        (notePeriods * 1000) / Math.max(1, baseF0),
        SPEAK_MIN_MS,
        SPEAK_MAX_MS,
      );
      const speakMs = Math.max(
        clamp(rankPeriods * periodMs, SPEAK_MIN_MS, SPEAK_MAX_MS),
        SPEAK_UPPERWORK_FLOOR * noteSpeakMs,
      );
      pipe.speakCoeff = rampCoeff(speakMs, sr);
      pipe.wind = 0;

      // Pre-fill the bore with a low-level f0 sine seed so the jet locks
      // promptly, each pipe at its own fixed phase (the jet span starts
      // silent). Pushing `span` samples through the primed line reproduces the
      // C++ raw-buffer fill and leaves the write head back at zero.
      const pf = BORE_PREFILL * mouth;
      const w = TWO_PI / Math.max(2, pipe.borePeriod);
      const phase = Math.PI * pipeTuningError(note, r + 8);
      for (let i = 0; i < span; ++i) {
        pipe.bore.processFractional(256, pf * Math.sin(w * i + phase));
      }
    }
    this.driveIndex = pipeOrganBufferCapacity(sr);
  }

  render(pitchRatio: number): number {
    if (this.rankCount <= 0) return 0;
    const ratio = pitchRatio > 0.01 ? pitchRatio : 0.01;

    // Shared wind gate: ramp to 1 while blowing, to 0 once released.
    const target = this.releasing ? 0 : 1;
    const coeff = this.releasing ? this.releaseCoeff : this.attackCoeff;
    this.breathLevel += coeff * (target - this.breathLevel);

    const idx = BigInt(this.driveIndex);
    let mix = 0;
    for (let r = 0; r < this.rankCount; ++r) {
      const pipe = this.ranks[r];
      if (pipe.bore.size < 8) continue;

      // Per-rank speech swell (post-loop level ramp toward 1).
      pipe.wind += pipe.speakCoeff * (1 - pipe.wind);

      const breath =
        pipe.breath *
        this.breathLevel *
        (FOOT_PRESSURE_FLOOR + (1 - FOOT_PRESSURE_FLOOR) * pipe.wind);

      // Open-end reflection from the previous bore output: one-pole loss
      // lowpass, sign-selected feedback (+ for the open topology).
      pipe.lpState += pipe.lpAlpha * (pipe.boreOut - pipe.lpState);
      const temp = pipe.sign * pipe.lossGain * pipe.lpState;

      // Jet drive: the pressure difference across the flue convects (jet delay)
      // and deflects across the labium (the cubic jet table); a continuous
      // turbulent hiss rides on the drive.
      pipe.turbState +=
        pipe.turbAlpha *
        (this.noise.bipolarAt(TURB_INDEX_BASE + pipe.noiseOffset + idx) - pipe.turbState);
      const pd = breath - pipe.jetReflection * temp + JET_TURBULENCE * breath * pipe.turbState;
      const boreDelay = clamp(pipe.borePeriod / ratio - pipe.comp, 1, pipe.bore.size - 4);
      const jetDelay = clamp(pipe.jetRatio * boreDelay, 1, pipe.jet.size - 4);
      const pdJ = pipe.jet.processFractional(Math.trunc(jetDelay * 256), pd);
      const jetOut = jetTable(pipe.jetDrive * pdJ, pipe.jetAsym);

      // DC-block the jet output, then drive the bore: jet flow plus the bore
      // end reflection.
      const jetDc = jetOut - pipe.dcX1 + pipe.dcR * pipe.dcY1;
      pipe.dcX1 = jetOut;
      pipe.dcY1 = jetDc;
      let into = jetDc + pipe.endReflection * temp;

      // Even-harmonic pump (open pipe): a half-wave rectified bore feedback
      // carries a 2*f0 component; strip its DC and inject the octave, gated by
      // the squared speech swell so the onset stays on the bore's own pitch.
      if (pipe.evenGain > 0) {
        const rect = temp > 0 ? temp : 0;
        pipe.evenState += pipe.evenHpAlpha * (rect - pipe.evenState);
        let pump = pipe.evenGain * pipe.wind * pipe.wind * (rect - pipe.evenState);
        pump = pump < -1.5 ? -1.5 : pump > 1.5 ? 1.5 : pump;
        into += pump;
      }

      pipe.boreOut = pipe.bore.processFractional(Math.trunc(boreDelay * 256), into);

      // Mouth/radiation high-shelf (radGain == 0 is a true bypass), then the
      // post-loop tone filter.
      let radiated = pipe.boreOut;
      if (pipe.radGain > 0) {
        pipe.radState += pipe.radAlpha * (radiated - pipe.radState);
        radiated += pipe.radGain * (radiated - pipe.radState);
      }
      pipe.toneS1 += pipe.toneAlpha * (radiated - pipe.toneS1);
      pipe.toneS2 += pipe.toneAlpha * (pipe.toneS1 - pipe.toneS2);
      radiated = pipe.toneS2;

      // Chiff: a decaying onset burst kept inside the pipe's speaking band.
      let chiff = 0;
      if (pipe.chiffLevel > 1e-5) {
        pipe.chiffLpState +=
          pipe.chiffLpAlpha *
          (this.noise.bipolarAt(CHIFF_INDEX_BASE + pipe.noiseOffset + idx) - pipe.chiffLpState);
        chiff = pipe.chiffLevel * this.breathLevel * pipe.chiffLpState;
        pipe.chiffLevel *= pipe.chiffCoeff;
      }

      // The chiff stays prompt while the pitched tone blooms in behind it; the
      // swell is squared for an S-shaped (soft-start) rise. The chiff shares the
      // pipe's calibrated output scale so it stays a subtle speech transient and
      // does not read as a percussive click ahead of the tone.
      const swell = pipe.wind * pipe.wind;
      mix += pipe.mix * pipe.outputScale * (swell * radiated + chiff);
    }
    ++this.driveIndex;
    return mix;
  }

  release(): void {
    this.releasing = true;
    // Cut the wind and damp each bore so it stops speaking promptly.
    for (let r = 0; r < this.rankCount; ++r) {
      const pipe = this.ranks[r];
      pipe.lossGain = Math.min(pipe.lossGain, pipe.releaseLoss);
    }
  }

  kill(): void {
    this.releasing = true;
    this.breathLevel = 0;
    for (let r = 0; r < this.rankCount; ++r) {
      const pipe = this.ranks[r];
      pipe.lpState = 0;
      pipe.boreOut = 0;
      pipe.dcX1 = 0;
      pipe.dcY1 = 0;
      pipe.chiffLevel = 0;
    }
  }
}
