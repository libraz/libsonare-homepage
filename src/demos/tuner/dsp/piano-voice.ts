/**
 * Extended-waveguide acoustic-piano core — the data-free grand sketch. Faithful
 * port of libsonare's `src/midi/synth/piano_voice.{h,cpp}` and the shared
 * radiation stages in `src/midi/synth/piano_resonance.cpp` (Bensa et al. 2003;
 * Bank & Valimaki; Jaffe & Smith).
 *
 * Four elements separate "piano" from "guitar/organ", and all four are here:
 * stiff-string dispersion (a first-order allpass cascade solved per note from
 * the keyboard-graded inharmonicity B, with the exact phase delay compensated
 * in the loop length), a dynamic nonlinear felt hammer (F = k*x^p with
 * hysteretic loss, integrated per sample against the string at the strike
 * point), coupled micro-detuned unison strings sharing a bridge (the prompt /
 * aftersound double decay), and a soundboard radiation stage (per-voice
 * highpass + bridge-hill emphasis, plus the instrument-wide modal board, its
 * case/rim late field and the sustain-air texture).
 *
 * Two members of the reference voice are left out because they contribute
 * nothing at the pitches this port is used at: the modal top-octave bank, which
 * only takes over above MIDI note 92, and every stage the reference ships at a
 * zero coefficient (the soundboard's frame bank, the case network's in-loop
 * diffuser, the undamped-treble sympathetic population).
 *
 * `PianoSoundboard` and `PianoResonanceBank` are host-owned and instrument-wide
 * in the C++ engine (one board / sympathetic bank shared by all voices); they
 * are exported here so a single-note render can compose the same output chain:
 * `PIANO_DIRECT_GAIN * dry + board.process(dry) + bank.process(board.lastDiffused(), open)`,
 * with `board.strike(voice.caseStrike())` / `board.strikeBoard(voice.boardStrike())`
 * called once per note-on.
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
/** ln(1000): the exponent that takes a per-sample factor to a t60. */
const LN_1000 = 6.907755279;

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
/** How much stiffer the felt's loading curve is than its unloading curve. */
const HAMMER_HYSTERESIS = 0.229431;
/** Felt-stiffness cutoff octaves per unit velocity above mf, per unit hammer dynamics. */
const HAMMER_DYN_BRIGHT_OCT = 1.5;
/**
 * Felt-stiffness lowpass on the injected force, expressed as cycles of its
 * corner per hammer contact: what a lossy contact passes is set by how long it
 * lasts, so the register grading comes out of the contact solver rather than
 * being written down twice.
 */
const FELT_CUTOFF_CONTACT_CYCLES = 4.615;
const FELT_CUTOFF_VEL_OCT = 0;
/** Semitones the patch's reference contact time takes to double down the keyboard. */
const CONTACT_KEYTRACK_SEMIS = 42;
/** Hammer-contact floor in fundamental periods, anchored at C4 and graded per octave. */
const CONTACT_PERIODS_AT_C4 = 0.18;
const CONTACT_PERIODS_PER_OCT = 0.5;
const CONTACT_PERIODS_MAX = 2;
/**
 * Ceiling on one blow's contact, in fundamental periods, and never below the
 * floor above: the string's own reflection returns while the felt is still
 * loaded and decides when the hammer leaves, so in the treble the two meet.
 * Without it a soft treble blow's free bounce dwells for nearly four periods,
 * which puts the force pulse's first null below the fundamental.
 */
const CONTACT_PERIODS_PER_BLOW_MAX = 1;
/**
 * What the voice puts out, scaling the injected force and the noise/knock
 * paths together so the balance between them does not move with it. The chain
 * is built from physical calibration alone, none of whose steps knows what the
 * result should measure; unnormalized it sits 16 dB under the rest of the bank.
 */
const OUTPUT_LEVEL = 5.7;
/** Where the aftersound taper starts and stops, in octaves above C4... */
const TREBLE_DECAY_KNEE_OCT = 1.25;
const TREBLE_DECAY_FLOOR_OCT = 3;
/** ...and halvings of the aftersound stage per octave in between. */
const TREBLE_DECAY_OCT = 1.4;
/** Register profile (Gaussian width and centre in octaves from C4) of the prompt-vs-aftersound contrast. */
const TWO_STAGE_WIDTH_OCT = 2;
const TWO_STAGE_CENTER_OCT = 2.4;
/** Treble taper cap (octaves above C4) on the darkening keytrack. */
const TREBLE_TAPER_OCT_CAP = 1.5;
/** Treble loop darkening (effective-brightness drop per octave above C4). */
const TREBLE_BRIGHT_PER_OCT = 0.06;
/** Effective-brightness drop per octave below C4 (wound-string mid-partial damping). */
const BASS_DARK_PER_OCT = 0.06;
/** String-to-string inharmonicity spread inside a unison (fractional allpass jitter). */
const UNISON_STIFF_JITTER = 0.02;
/** Uneven unison strike: keeps unison beats as shallow ripple, seeds the aftersound. */
const UNISON_STRIKE_UNEVEN = 0.15;
/** Uneven bridge coupling across the unison (Weinreich): lets the aftersound radiate. */
const UNISON_RAD_SPREAD = 0.5;
/** Felt impact noise: level, exponential decay time, and hard stop of the burst. */
const STRIKE_NOISE_GAIN = 0.75;
const STRIKE_NOISE_TAU_MS = 8;
const STRIKE_NOISE_MAX_MS = 30;
/** The impact noise radiates darker than the string pulse (fraction of the felt cutoff). */
const STRIKE_NOISE_CUTOFF_SCALE = 0.487539;
/** Halvings of the noise cutoff per octave below C4. */
const NOISE_CUTOFF_BASS_OCT = 0;
/** Third noise pole above the main cutoff: passband kept, cliff past it. */
const NOISE_STEEP_RATIO = 4;
/**
 * Lower bound on a one-pole smoothing coefficient. A coefficient of exactly
 * zero never charges, so the pole needs a floor, and the floor must sit far
 * below any corner the voice can ask for or it silently replaces the requested
 * frequency with itself (at 48 kHz this one is 0.076 Hz).
 */
const ONE_POLE_ALPHA_FLOOR = 1e-5;
/** Finite hammer-head footprint caps the pulse content near this harmonic of f0. */
const HAMMER_WIDTH_HARMONICS = 2.69125;
/** Share of the impact noise injected into the strings (seeds the high partials). */
const STRIKE_NOISE_INJECT = 0.298027;
/** Share of the strike noise that reaches the air directly, past the knock's thud filter. */
const STRIKE_NOISE_DIRECT = 0.6;
/** The injection tapers above C4 (halvings per octave)... */
const INJECT_TREBLE_TAPER_OCT = 0.654102;
/** ...and grows below C4 (doublings per octave). */
const INJECT_BASS_BOOST_OCT = 1.23607;
/** The impact-noise level also tapers above C4. */
const NOISE_TREBLE_TAPER_OCT = 0.435016;
/** Hammer-knock radiation relative to the string injection... */
const KNOCK_GAIN = 1.6;
/** ...and the extra velocity exponent it carries on top of the blow force. */
const KNOCK_VEL_EXP = 0.4;
/** The knock radiates only the impact thud: a fixed low band regardless of the note. */
const KNOCK_THUD_HZ = 1400;
/** Halvings of the thud frequency per octave below C4. */
const KNOCK_THUD_BASS_OCT = 0;
/** How much of the knock is taken from the blow itself rather than from the injected wave. */
const KNOCK_UNCOMBED = 1;
/** Radiation bloom: one-pole ring-up time constant at C4 (ms) and its keytrack. */
const BLOOM_TAU_MS_C4 = 4.6604;
const BLOOM_TAU_OCT = 0.9;
/** String yield under the blow (fraction of hammer speed the strike point recedes at). */
const STRING_YIELD = 1.28;
/** How far the strike point may be driven aside, as a fraction of this blow's peak compression. */
const YIELD_EXCURSION_CAP = 0.7;
/** Register level compensation on the injected force (dB/octave from C4) and its span. */
const INJ_TILT_DB_OCT = 1.5;
const INJ_TILT_OCT_SPAN = 1.25;
const YIELD_TREBLE_OCT = 2;
/** How the knock grows into the bass, and shrinks above C4 (doublings per octave). */
const KNOCK_BASS_BOOST_OCT = 0.3;
const KNOCK_TREBLE_TAPER_OCT = 1.4;
/** Size of the blow handed to the shared board's case network at note-on... */
const CASE_STRIKE_GAIN = 0.02;
/** ...and the same blow into the board bank, which answers over a far shorter span. */
const BOARD_STRIKE_GAIN = 0.12;
/** How the board's share of that blow grows into the treble (doublings per octave). */
const BOARD_STRIKE_TREBLE_OCT = 1;
/** Hammer-width harmonic cap keytrack (signed doublings per octave each side of C4). */
const WIDTH_BASS_OCT = 0.3;
const WIDTH_TREBLE_OCT = 0.81966;
/**
 * Strike-point keytrack on the patch fraction, as doublings across the WHOLE
 * bottom of the keyboard: a grand's strike ratio travels from about a twelfth
 * of the speaking length in the middle to an eighth in the bass.
 */
const STRIKE_POS_BASS_OCT = 0.18;
/**
 * Longitudinal string modes ("phantom partials"): the first mode's frequency at
 * C4, its climb per octave (set by the scale length, not by f0), the bank's
 * level and treble taper, the first mode's ring-down, and the corner where the
 * slope operator driving it stops differentiating.
 */
const LONGITUDINAL_MODES = 5;
const LONG_FIRST_HZ_C4 = 4900;
const LONG_FIRST_OCT = 0.6;
const LONG_LEVEL = 500;
const LONG_TREBLE_TAPER_OCT = 1.5;
const LONG_T60_S = 0.35;
const LONG_DRIVE_HP_HZ = 4000;
/**
 * Soundboard radiation highpass: the board radiates poorly below its first
 * modes, and the measured transition is about 24 dB/octave, so it is a
 * fourth-order Butterworth rather than one section with a voiced Q. The section
 * Qs are 1/(2 cos(pi/8)) and 1/(2 cos(3pi/8)), fixed by the order.
 */
const RADIATION_HP_HZ = 60.8;
const RADIATION_HP_SECTION_Q = [0.5411961, 1.30656296];
/** Bridge-hill radiation emphasis (RBJ peaking): the 1-2 kHz bridge/board mobility peak. */
const BRIDGE_HILL_HZ = 1856.4375;
const BRIDGE_HILL_GAIN_DB = 15.863776;
const BRIDGE_HILL_Q = 2.40983;
/**
 * How far up the partial series the prompt-decay drain reaches, in multiples of
 * the fundamental. The drain models the vertical polarization losing its energy
 * into the bridge, which is a property of the bridge admittance around the
 * first few partials; applied broadband it drains everything above them too.
 */
const TWO_STAGE_DRAIN_PARTIALS = 4;
/**
 * The drain's second band, quoted in absolute frequency because a bridge does
 * not know which note is driving it: a one-pole at a fixed corner, added back
 * at a weight divided by the note's own fundamental (the drain acts once per
 * traversal while the target is quoted per second), and bounded as a share of
 * the gap between the two loop gains.
 */
const BRIDGE_HF_DRAIN = 6;
const BRIDGE_HF_HZ = 1600;
const BRIDGE_HF_REF_HZ = 261.6256;
const BRIDGE_HF_DRAIN_MAX = 0.5;
/**
 * Traversal-rate normalization of the loop lowpass. The filter runs once per
 * round trip, so a fixed coefficient costs a given absolute frequency a fixed
 * loss per traversal and a note an octave up pays it twice as often; scaling
 * the coefficient back by the traversal rate makes the loop's high-frequency
 * loss a function of absolute frequency alone. The reference frequency is the
 * note left untouched, and sits at the bottom of the keyboard.
 */
const LOOP_DAMP_RATE_NORM = 1;
const LOOP_DAMP_REF_HZ = 27.5;
/**
 * How much longer the damper takes on a quiet string, per unit of MIDI velocity
 * below the anchor: damper felt loses energy in proportion to how far the
 * string drives it, so a string the felt meets gently is damped gently.
 */
const DAMPER_VEL_SLOPE = 0.0083;
const DAMPER_VEL_ANCHOR = 120;
const DAMPER_VEL_SCALE_MAX = 4;
/** Where the dispersion cascade stops fitting the waveguide loop, and where it is gone. */
const DISPERSION_FADE_NOTE_LO = 98;
const DISPERSION_FADE_NOTE_HI = 108;
/** Stiff-string inharmonicity B: two branches meeting at the bass break. */
const INHARM_BREAK_NOTE = 36;
const INHARM_B_AT_A4 = 7.718e-4;
const INHARM_TREBLE_BETA = 0.086636;
const INHARM_BASS_BETA = 0.064666;
/** Railsback stretch: two power-law branches about the A4 anchor. */
const STRETCH_BASS_CENTS = 2.1333;
const STRETCH_BASS_POWER = 1.0756;
const STRETCH_TREBLE_CENTS = 0.501;
const STRETCH_TREBLE_POWER = 4.0427;
/** Keyboard bounds the two curves are fitted over; outside them the edge value is held. */
const LOWEST_PIANO_NOTE = 12;
const HIGHEST_PIANO_NOTE = 108;
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
 * partial n lands at f_n = n*f0*sqrt(1 + B*n^2). Fitted to a measured
 * concert-grand corpus, so B has a minimum near C2 rather than at the bottom of
 * the keyboard — below the bass break it climbs back, because a wound bass
 * string is a heavy core on a scale too short to keep it flexible.
 */
export function pianoInharmonicityB(note: number): number {
  const n = clamp(note & 0x7f, LOWEST_PIANO_NOTE, HIGHEST_PIANO_NOTE);
  // Plain-wire branch: B grows steadily toward the top of the keyboard.
  const treble = INHARM_B_AT_A4 * Math.exp(INHARM_TREBLE_BETA * (n - 69));
  if (n >= INHARM_BREAK_NOTE) return treble;
  // Wound-string branch, anchored on the plain-wire value at the break so the
  // two meet without a step.
  const atBreak = INHARM_B_AT_A4 * Math.exp(INHARM_TREBLE_BETA * (INHARM_BREAK_NOTE - 69));
  return atBreak * Math.exp(INHARM_BASS_BETA * (INHARM_BREAK_NOTE - n));
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
 * of the stiff-string inharmonicity. Strongly asymmetric (about ten cents flat
 * at A0 against fifty sharp at C8), so it is two power-law branches rather than
 * one odd function about the anchor.
 */
export function pianoStretchCents(note: number): number {
  const n = clamp(note & 0x7f, LOWEST_PIANO_NOTE, HIGHEST_PIANO_NOTE);
  const octaves = (n - 69) / 12;
  if (octaves > 0) return STRETCH_TREBLE_CENTS * octaves ** STRETCH_TREBLE_POWER;
  if (octaves < 0) return -STRETCH_BASS_CENTS * (-octaves) ** STRETCH_BASS_POWER;
  return 0;
}

function noteToHz(note: number): number {
  return 440 * 2 ** (((note & 0x7f) - 69) / 12);
}

/** Per-loop-traversal amplitude factor reaching -60 dB after `t60S`. */
function loopGainFor(periodSamples: number, sampleRate: number, t60S: number): number {
  const loopsToT60 = (sampleRate * Math.max(0.01, t60S)) / Math.max(1, periodSamples);
  return Math.exp(-LN_1000 / loopsToT60);
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
  /**
   * The bridge signal the prompt-decay drain actually subtracts, the one-pole
   * that band-limits it, and the fixed-corner upper band added back on top.
   */
  private bridgeDrain = 0;
  private drainLpA = 1;
  private bridgeHfLp = 0;
  private drainHfA = 0;
  private drainHiW = 0;
  private drainOut = 0;
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
  private ysLimit = 0;
  private lastForce = 0;
  private combDelay = 0;
  private combIdx = 0;
  private combTail = 0;
  private combHist = new Float32Array(HAMMER_COMB_CAPACITY);
  /** Strike-position comb history for the injected scrub noise. */
  private noiseHist = new Float32Array(HAMMER_COMB_CAPACITY);
  private knockGain = 0.6;
  private caseStrikeAmount = 0;
  private boardStrikeAmount = 0;
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
  /** The blow as the body feels it: the same felt-softened force, never combed. */
  private bodyLp = 0;
  private bodyLp2 = 0;

  // Longitudinal string modes ("phantom partials"): transverse motion stretches
  // the string, and the tension change it makes — quadratic in the transverse
  // displacement — launches waves at the longitudinal speed. They are the
  // metallic growl that tells the ear a low note came from a piano.
  private longModes = makeModes(LONGITUDINAL_MODES);
  private longLevel = 0;
  private longPrev = 0;
  private longHpA = 1;
  private longX1 = 0;
  private longX2 = 0;

  // Soundboard radiation highpass: two biquad sections (b2 == b0 in each)
  // forming a fourth-order Butterworth.
  private hp = Array.from({ length: RADIATION_HP_SECTION_Q.length }, () => ({
    b0: 1,
    b1: 0,
    a1: 0,
    a2: 0,
    x1: 0,
    x2: 0,
    y1: 0,
    y2: 0,
  }));

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
    const noteF = note & 0x7f;

    // Two-stage decay rates (stretched down the keyboard). The stretch
    // lengthens the bass and does nothing above A4; the aftersound taper rides
    // its own octave axis, whose knee sits an octave above the loop darkening's
    // cap.
    const stretch = clamp(params.decayStretch, 0, 1);
    const octavesBelowA4 = Math.max(0, (69 - noteF) / 12);
    const bassScale = 2 ** (stretch * octavesBelowA4);
    const decayKneeOct = TREBLE_DECAY_KNEE_OCT;
    const decayFloorOct = Math.max(decayKneeOct, TREBLE_DECAY_FLOOR_OCT);
    const decayTaperOct = clamp((noteF - 60) / 12, decayKneeOct, decayFloorOct) - decayKneeOct;
    const slowScale = bassScale * 2 ** (-TREBLE_DECAY_OCT * decayTaperOct);
    const t60Slow = Math.max(0.05, Math.max(params.decayFastS, params.decaySlowS) * slowScale);

    // Loop lowpass (frequency-dependent damping), closing toward the treble
    // and into the wound bass as well.
    const octavesAboveC4 = Math.min(Math.max(0, (noteF - 60) / 12), TREBLE_TAPER_OCT_CAP);
    const octavesBelowC4 = Math.max(0, -(noteF - 60) / 12);
    const brightEff = clamp(
      clamp(params.brightness, 0, 1) -
        TREBLE_BRIGHT_PER_OCT * octavesAboveC4 -
        BASS_DARK_PER_OCT * octavesBelowC4,
      0.05,
      1,
    );
    // The loop lowpass runs once per round trip, so the damping a listener
    // hears is proportional to f0 unless the coefficient is scaled back by the
    // traversal rate.
    const rateNorm = (LOOP_DAMP_REF_HZ / Math.max(f0, 1)) ** clamp(LOOP_DAMP_RATE_NORM, 0, 1);
    const lpA = clamp((1 - brightEff) * 0.6 * rateNorm, 0, 0.95);
    this.loopAlpha = 1 - lpA;
    const tauLp = onepolePhaseDelay(lpA, w0);

    // Stiffness dispersion: the per-note inharmonicity B drives the allpass
    // cascade; the patch dispersion knob scales B (0 = harmonic string). Faded
    // out smoothly where the cascade no longer fits the loop.
    const fadeLo = DISPERSION_FADE_NOTE_LO;
    const fadeHi = Math.max(fadeLo + 1, DISPERSION_FADE_NOTE_HI);
    const fadeX = clamp((noteF - fadeLo) / (fadeHi - fadeLo), 0, 1);
    const dispersion = clamp(params.dispersion, 0, 1) * (1 - fadeX * fadeX * (3 - 2 * fadeX));
    const bCoeff = pianoInharmonicityB(note) * dispersion;
    const phaseBudget = period - 4 - tauLp;
    const apA = dispersionAllpassA(bCoeff, w0, lpA, PIANO_DISPERSION_STAGES, phaseBudget);

    // The prompt stage blends toward the aftersound rate away from the register
    // where the polarization/unison coupling drains the bridge fastest.
    const octFromC4Signed = (noteF - 60) / 12;
    const contrastX = octFromC4Signed - TWO_STAGE_CENTER_OCT;
    const contrast = Math.exp(
      -(contrastX * contrastX) / (TWO_STAGE_WIDTH_OCT * TWO_STAGE_WIDTH_OCT),
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
    this.bridgeDrain = 0;
    // Corner of the drain's band limit, as a multiple of this note's own
    // fundamental so the mechanism keeps the same reach in partials at every
    // pitch; a corner at or above Nyquist leaves the filter the identity.
    const drainPartials = Math.max(0, TWO_STAGE_DRAIN_PARTIALS);
    const drainCorner = drainPartials * f0;
    this.drainLpA =
      drainPartials <= 0 || drainCorner >= 0.5 * sr
        ? 1
        : 1 - Math.exp((-TWO_PI * drainCorner) / sr);
    // Upper band: a fixed corner, so the drain is a shelf in absolute frequency
    // rather than in this note's partials, at a weight divided by the note's
    // own fundamental so what it costs per second is the same at every pitch.
    const hfCorner = clamp(BRIDGE_HF_HZ, 20, 0.45 * sr);
    this.drainHfA = 1 - Math.exp((-TWO_PI * hfCorner) / sr);
    this.drainHiW =
      (Math.max(0, BRIDGE_HF_DRAIN) * Math.max(BRIDGE_HF_REF_HZ, 1)) / Math.max(f0, 1);
    if (this.drainHiW > 0) {
      // Bound it where the quantity has meaning: the drain is a multiple of the
      // gap between the two loop gains, taken over the widest string so no
      // member of the unison can exceed the ceiling on its own.
      let widest = 0;
      for (let i = 0; i < this.numStrings; ++i) {
        widest = Math.max(widest, this.strings[i].gSlow - this.strings[i].gFast);
      }
      if (widest > 1e-9) {
        this.drainHiW = Math.min(
          this.drainHiW,
          (Math.max(0, BRIDGE_HF_DRAIN_MAX) * this.strings[0].gSlow) / widest,
        );
      }
    }
    this.bridgeHfLp = 0;
    this.drainOut = 0;
    // Damper keytrack: heavier felt on the wound bass strings and a shorter
    // stop toward the treble, flat across the C3-C4 anchor with smoothstep
    // bends into both registers (no audible register step).
    const anchorLowNote = 48; // C3
    const anchorHighNote = 60; // C4
    const bassSpan = 20;
    const trebleSpan = 10;
    const bassGain = 0.4;
    const trebleGain = -0.45;
    let damperKeytrack = 1;
    if (noteF < anchorLowNote) {
      const x = clamp((anchorLowNote - noteF) / bassSpan, 0, 1);
      damperKeytrack += bassGain * x * x * (3 - 2 * x);
    } else if (noteF > anchorHighNote) {
      const x = clamp((noteF - anchorHighNote) / trebleSpan, 0, 1);
      damperKeytrack += trebleGain * x * x * (3 - 2 * x);
    }
    // Felt loss falls off with how hard the string drives it, so a soft note is
    // damped softly.
    const damperVelScale = Math.min(
      DAMPER_VEL_SCALE_MAX,
      Math.exp(DAMPER_VEL_SLOPE * (DAMPER_VEL_ANCHOR - (velocity & 0x7f))),
    );
    const releaseT60 = Math.max(0.01, params.releaseDampS * damperKeytrack * damperVelScale);
    this.releaseGain = loopGainFor(period, sr, releaseT60);

    // Dynamic felt hammer (F = k*x^p with hysteretic loss). The felt stiffness
    // k is calibrated so a mezzo-forte blow lands the reference contact time
    // for the register; the Hertz velocity laws, the treble's full-period
    // dwell and the bass re-contact chatter all emerge from the interaction.
    const vel01 = Math.max((velocity & 0x7f) / 127, 0.02);
    const p = clamp(params.hammerExponent, 1.5, 4);
    const ampExp = (2 * p) / (p + 1);
    const dyn = clamp(params.hammerDynamics, 0, 1);
    // Reference contact time for the register (mf): the patch contact scaled
    // by register, floored in fundamental periods.
    let contactMs =
      clamp(params.hammerContactMs, 0.2, 10) *
      2 ** (-(noteF - 69) / Math.max(1, CONTACT_KEYTRACK_SEMIS));
    const octavesFromC4 = (noteF - 60) / 12;
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
    // Felt hysteresis: loading is stiffer than unloading, which skews the
    // force pulse forward and bleeds energy so the hammer leaves cleanly.
    this.hamMu = HAMMER_HYSTERESIS;
    this.hamY = 0;
    // Hammer speed normalized at the mezzo-forte reference; hammerDynamics
    // widens the pp<->ff speed spread around that pivot.
    this.hamV = (vel01 / HAMMER_MF_VEL) ** (1 + 0.6 * dyn);
    this.hamOn = true;
    this.hamTtl = Math.trunc(3 * tauMf); // shank check truncates a riding hammer
    // Calibrated mezzo-forte stiffness and the bounce it makes (unit mass).
    // Both are the reference the injection normalizes against, so the velocity
    // level curve (~ v^(2p/(p+1))) comes out of the dynamics rather than out of
    // the normalization.
    this.hamK = (cP / tauMf) ** (p + 1);
    const xMaxMf = ((0.5 * (p + 1)) / this.hamK) ** (1 / (p + 1));
    const fPeakMf = this.hamK * xMaxMf ** p;
    // This blow's free-bounce contact, and the ceiling the string's reflection
    // puts on it. Duration goes as k^(-1/(p+1)), so holding it to the ceiling
    // costs that ratio raised to p+1 in stiffness; only hamK moves.
    const tauBlow = tauMf * Math.max(this.hamV, 1e-4) ** (-(p - 1) / (p + 1));
    const dwellCap = Math.max(CONTACT_PERIODS_PER_BLOW_MAX, contactFloorPeriods) * period;
    this.hamK *= Math.max(1, tauBlow / Math.max(dwellCap, 1e-6)) ** (p + 1);
    // Level reference: velocity-scaled for the noise/knock paths; the injection
    // normalizes to the mf level.
    this.hammerAmp = OUTPUT_LEVEL * vel01 ** ampExp;
    const mfLevel = OUTPUT_LEVEL * HAMMER_MF_VEL ** ampExp;
    this.hamForceNorm = fPeakMf > 1e-12 ? mfLevel / fPeakMf : 0;
    const tiltSpan = Math.max(0, INJ_TILT_OCT_SPAN);
    this.hamForceNorm *=
      2 ** ((INJ_TILT_DB_OCT * clamp(octavesFromC4, -tiltSpan, tiltSpan)) / 6.0206);
    // String yield under the blow: the strike point recedes with a velocity
    // proportional to the net force through the string's wave admittance; the
    // inverted near-end reflection recompresses the felt and the measured
    // multi-hump piano force curve emerges. The admittance is the string's, so
    // it does not depend on the blow; the excursion it may reach does, and
    // follows this blow's own peak felt compression.
    const yieldKt = STRING_YIELD * 2 ** (-YIELD_TREBLE_OCT * Math.max(0, octavesFromC4));
    const xMaxUnit = ((0.5 * (p + 1)) / this.hamK) ** (1 / (p + 1));
    const xMaxV = xMaxUnit * Math.max(this.hamV, 1e-4) ** (2 / (p + 1));
    this.ysAdm = 0.5 * yieldKt * xMaxMf;
    this.ysLimit = YIELD_EXCURSION_CAP * xMaxV;
    this.ys = 0;
    this.lastForce = 0;
    this.hamExit = -xMaxV;
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
    // pulse's top end. The corner is quoted as cycles per hammer contact, so
    // the register grading comes out of the contact solver above; the
    // dynamics-gated brightening also scales the footprint cap.
    const dynBright = 2 ** (HAMMER_DYN_BRIGHT_OCT * dyn * (vel01 - HAMMER_MF_VEL));
    const excCutoff =
      (FELT_CUTOFF_CONTACT_CYCLES / Math.max(1e-4, contactMs * 0.001)) *
      2 ** (FELT_CUTOFF_VEL_OCT * vel01) *
      dynBright;
    const widthHarm =
      HAMMER_WIDTH_HARMONICS *
      2 **
        (WIDTH_BASS_OCT * Math.max(0, -octavesFromC4) +
          WIDTH_TREBLE_OCT * Math.max(0, octavesFromC4));
    const widthCutoff = Math.min(excCutoff, widthHarm * f0 * dynBright);
    this.excAlpha = clamp(1 - Math.exp((-TWO_PI * widthCutoff) / sr), ONE_POLE_ALPHA_FLOOR, 1);
    const noiseCutoff =
      STRIKE_NOISE_CUTOFF_SCALE *
      excCutoff *
      2 ** (-NOISE_CUTOFF_BASS_OCT * Math.max(0, -octavesFromC4));
    this.noiseAlpha = clamp(1 - Math.exp((-TWO_PI * noiseCutoff) / sr), ONE_POLE_ALPHA_FLOOR, 1);
    this.noiseAlpha3 = clamp(
      1 - Math.exp((-TWO_PI * NOISE_STEEP_RATIO * noiseCutoff) / sr),
      ONE_POLE_ALPHA_FLOOR,
      1,
    );
    this.excLp = 0;
    this.excLp2 = 0;
    this.bodyLp = 0;
    this.bodyLp2 = 0;

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
      Math.max(vel01, 1e-4) ** KNOCK_VEL_EXP *
      2 **
        (KNOCK_BASS_BOOST_OCT * Math.max(0, -octavesFromC4) -
          KNOCK_TREBLE_TAPER_OCT * Math.max(0, octavesFromC4));
    // The same blow, told to the structure instead of to the listener: it
    // carries the knock's whole velocity law and none of the register grading,
    // because what the plate and the rim receive is a force impulse whose size
    // is the blow. Quoted against mezzo-forte, like the injection's own
    // normalization.
    const blowNorm = mfLevel > 0 ? this.hammerAmp / mfLevel : 0;
    const blowVel = Math.max(vel01, 1e-4) ** KNOCK_VEL_EXP;
    this.caseStrikeAmount = CASE_STRIKE_GAIN * blowNorm * blowVel;
    this.boardStrikeAmount =
      BOARD_STRIKE_GAIN *
      blowNorm *
      blowVel *
      2 ** (BOARD_STRIKE_TREBLE_OCT * Math.max(0, octavesFromC4));
    this.knockLp = 0;
    this.knockLp2 = 0;
    this.knockLp3 = 0;
    const thudHz = KNOCK_THUD_HZ * 2 ** (-KNOCK_THUD_BASS_OCT * Math.max(0, -octavesFromC4));
    this.knockLpA = clamp(1 - Math.exp((-TWO_PI * thudHz) / sr), 0, 1);
    this.knockLp3A = clamp(1 - Math.exp((-TWO_PI * NOISE_STEEP_RATIO * thudHz) / sr), 0, 1);
    this.bloom = 0;
    const bloomTauS = BLOOM_TAU_MS_C4 * 0.001 * 2 ** (-BLOOM_TAU_OCT * octavesFromC4);
    this.bloomA = clamp(1 - Math.exp(-1 / (bloomTauS * sr)), 1e-4, 1);
    // Longitudinal mode bank. The drive carries a DC/Nyquist zero (see render),
    // so each mode is exactly peak-normalized off the bandpass residue the way
    // the soundboard's are.
    this.longLevel = LONG_LEVEL * 2 ** (-LONG_TREBLE_TAPER_OCT * Math.max(0, octavesFromC4));
    const longF1 = LONG_FIRST_HZ_C4 * 2 ** (LONG_FIRST_OCT * octavesFromC4);
    this.longPrev = 0;
    this.longHpA = clamp(1 - Math.exp((-TWO_PI * LONG_DRIVE_HP_HZ) / sr), 0, 1);
    this.longX1 = 0;
    this.longX2 = 0;
    for (let i = 0; i < LONGITUDINAL_MODES; ++i) {
      const m = this.longModes[i];
      m.a1 = 0;
      m.a2 = 0;
      m.gain = 0;
      m.y1 = 0;
      m.y2 = 0;
      const f = longF1 * (i + 1);
      if (this.longLevel <= 0 || f >= 0.45 * sr) continue;
      const w = (TWO_PI * f) / sr;
      // The higher modes are lossier, as they are on the transverse side.
      const t60 = Math.max(0.01, LONG_T60_S / (i + 1));
      const r = Math.exp(-LN_1000 / (sr * t60));
      m.a1 = 2 * r * Math.cos(w);
      m.a2 = -r * r;
      const dRe = 1 - m.a1 * Math.cos(w) - m.a2 * Math.cos(2 * w);
      const dIm = m.a1 * Math.sin(w) + m.a2 * Math.sin(2 * w);
      const dMag = Math.sqrt(dRe * dRe + dIm * dIm);
      // Peak-normalized, then rolled off along the series: the higher
      // longitudinal modes are both less excited and lossier.
      m.gain = dMag / Math.max(2 * Math.sin(w), 1e-6) / (i + 1);
    }
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

    // Radiation highpass coefficients (cascaded RBJ highpasses) and state.
    {
      const w = (TWO_PI * RADIATION_HP_HZ) / sr;
      const cw = Math.cos(w);
      const sw = Math.sin(w);
      for (let i = 0; i < this.hp.length; ++i) {
        const s = this.hp[i];
        const alpha = sw / (2 * RADIATION_HP_SECTION_Q[i]);
        const a0 = 1 + alpha;
        s.b0 = ((1 + cw) * 0.5) / a0;
        s.b1 = -(1 + cw) / a0;
        s.a1 = (-2 * cw) / a0;
        s.a2 = (1 - alpha) / a0;
        s.x1 = 0;
        s.x2 = 0;
        s.y1 = 0;
        s.y2 = 0;
      }
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

  /**
   * What this note's blow puts into the instrument's structure, as set by the
   * last start(). The host hands it to the shared `PianoSoundboard` rather than
   * mixing it into this voice's output, because a case network is struck once
   * per blow and not driven by the note.
   */
  caseStrike(): number {
    return this.caseStrikeAmount;
  }

  /**
   * The same blow into the board bank instead, which answers it over a fraction
   * of a second where the case network answers over four.
   */
  boardStrike(): number {
    return this.boardStrikeAmount;
  }

  render(pitchRatio: number): number {
    if (this.numStrings <= 0) return 0;

    // Dynamic hammer: integrate the felt mass against the string's arrival at
    // the strike point, then comb the force by the strike position and pass
    // the velocity-driven felt-stiffness lowpass.
    let exc = 0;
    let knock = 0;
    let thudIn = 0;
    let noiseDirect = 0;
    let force = 0;
    if (this.hamOn) {
      // String surface velocity at the strike point: the string recedes under
      // the net force through its wave admittance. Tension bounds the
      // excursion — the strike point is a sprung wave port, not a free
      // particle — and the bound scales with this blow's peak compression.
      const ysVel = this.ysAdm * this.lastForce;
      this.ys = Math.min(this.ys + ysVel, this.ysLimit);
      const x = this.hamY - this.ys;
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
      // The body's copy of the same blow, softened by the same felt but never
      // combed: the knock is a structure-borne path that reaches the board
      // without passing through the string, so it cannot carry the string's
      // near-end reflection.
      const raw = this.hamForceNorm * force;
      this.bodyLp += this.excAlpha * (raw - this.bodyLp);
      this.bodyLp2 += this.excAlpha * (this.bodyLp - this.bodyLp2);
      thudIn = this.excLp2 + KNOCK_UNCOMBED * (this.bodyLp2 - this.excLp2);
      this.lastForce = force;
    }
    if (this.noisePos < this.noiseSamples) {
      ++this.noisePos;
      this.noiseRng = (Math.imul(this.noiseRng, 1664525) + 1013904223) >>> 0;
      const white = (this.noiseRng >>> 8) * (1 / 8388608) - 1;
      // Two-pole felt-noise lowpass plus a steep third pole; most of the noise
      // radiates through the knock's thud filter below.
      this.noiseLp += this.noiseAlpha * (white - this.noiseLp);
      this.noiseLp2 += this.noiseAlpha * (this.noiseLp - this.noiseLp2);
      this.noiseLp3 += this.noiseAlpha3 * (this.noiseLp2 - this.noiseLp3);
      const noise = this.noiseEnv * this.noiseLp3;
      this.noiseEnv *= this.noiseDecay;
      thudIn += noise;
      // The direct path is tapped two poles in, not three: the third pole
      // belongs to the contact footprint, which is what the STRING is injected
      // through, and the air does not hear the strike through that window.
      noiseDirect = this.noiseEnv * this.noiseLp2;
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
    knock += this.knockGain * this.knockLp3 + STRIKE_NOISE_DIRECT * noiseDirect;

    const ratio = pitchRatio > 0.01 ? pitchRatio : 0.01;
    let sum = 0;
    let lpSum = 0;
    for (let i = 0; i < this.numStrings; ++i) {
      const s = this.strings[i];
      if (s.line.size < 8) continue;
      // Coupled two-stage decay: the coherent (bridge) component recirculates
      // at the fast prompt rate, the residual at the slow aftersound rate.
      const fb = s.gSlow * s.lpState - (s.gSlow - s.gFast) * this.drainOut;
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
    // Band-limited copy for the drain only; `bridge` itself stays broadband.
    // Written as a lag off the input so the transparent coefficient is exactly
    // `bridge` rather than one last bit away from it inside a feedback loop.
    this.bridgeDrain = this.bridge - (1 - this.drainLpA) * (this.bridge - this.bridgeDrain);
    // The upper band, added back at its own weight: a zero weight leaves
    // `drainOut` exactly the band-limited drain.
    this.bridgeHfLp += this.drainHfA * (this.bridge - this.bridgeHfLp);
    this.drainOut = this.bridgeDrain + this.drainHiW * (this.bridge - this.bridgeHfLp);
    // Board ring-up: the tone swells while the impact thud leads.
    this.bloom += this.bloomA * (1 - this.bloom);
    // Longitudinal modes, driven by the tension the transverse motion itself
    // makes. Squaring the string sum IS the tension term, so the v^2 amplitude
    // law and the doubled decay rate come out of it; the tension follows the
    // string's SLOPE, so the drive is differenced before it is squared, and the
    // two-sample difference after it puts a zero at DC and at Nyquist.
    let longitudinal = 0;
    if (this.longLevel > 0) {
      this.longPrev += this.longHpA * (sum - this.longPrev);
      const d = sum - this.longPrev;
      const t = d * d;
      const bp = t - this.longX2;
      this.longX2 = this.longX1;
      this.longX1 = t;
      for (const m of this.longModes) {
        const y = m.gain * bp + m.a1 * m.y1 + m.a2 * m.y2;
        m.y2 = m.y1;
        m.y1 = y;
        longitudinal += y;
      }
      longitudinal *= this.longLevel;
    }
    sum = sum * this.bloom + knock + longitudinal;
    // Soundboard radiation: the board barely radiates the lowest partials.
    let y = sum;
    for (const s of this.hp) {
      const input = y;
      y = s.b0 * input + s.b1 * s.x1 + s.b0 * s.x2 - s.a1 * s.y1 - s.a2 * s.y2;
      s.x2 = s.x1;
      s.x1 = input;
      s.y2 = s.y1;
      s.y1 = y;
    }
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
    this.bodyLp = 0;
    this.bodyLp2 = 0;
    this.longLevel = 0;
    this.longPrev = 0;
    this.longX1 = 0;
    this.longX2 = 0;
    for (const m of this.longModes) {
      m.a1 = 0;
      m.a2 = 0;
      m.gain = 0;
      m.y1 = 0;
      m.y2 = 0;
    }
    for (const s of this.strings) {
      s.lpState = 0;
      s.gSlow = 0;
      s.gFast = 0;
    }
    this.bridge = 0;
  }
}

/**
 * Sympathetic bank size. Two populations share it and only one answers to the
 * pedal: a grand's dampers stop partway up the treble, so the strings above
 * that point ring at all times. That top population ships at a zero level, so
 * every slot here is the damped register the pedal lifts.
 */
const RESONANCE_MODES = 44;
/** Fundamentals spread E1..E6 every 4 semitones, then their 2nd and 3rd partials. */
const SYMP_FUNDAMENTALS = 16;
const SYMP_PARTIALS = 3;
/** Resonator decay of the bank's fundamentals, and how the partials shorten it. */
const SYMP_RING_T60_S = 0.6;
const SYMP_PARTIAL_DAMP = 0.5;
/** Tilt down the partial series, and the weak coupling the bank returns at. */
const SYMP_PARTIAL_TILT = 0.7;
const SYMP_COUPLING = 0.06;
/** Bridge admittance: the heavier the string, the less of the bridge's motion it takes. */
const SYMP_BASS_TAPER_OCT = 1;
const SYMP_TAPER_ANCHOR_HZ = 261.6256;
/**
 * The dampers only rest on the speaking lengths: the duplex/aliquot segments
 * and the undamped top octaves keep a faint shimmer ringing with the pedal up.
 */
const DUPLEX_FLOOR = 0.3;

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
 * Pedal-gated sympathetic resonance: a bank of string-mode resonators driven by
 * the bridge/voice mix while the dampers are lifted (Lehtonen, Penttinen,
 * Rauhala & Valimaki 2007). Instrument-wide in the host — one bank fed the
 * summed dry mix; for a single-note render it is fed the one voice.
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
    for (const m of this.modes) {
      m.a1 = 0;
      m.a2 = 0;
      m.gain = 0;
      m.y1 = 0;
      m.y2 = 0;
    }
    // The partials are the mechanism, not a refinement of it: a pedalled bass
    // note is heard lighting up the upper half of the keyboard, and what sounds
    // up there is the treble strings' upper partials, not their fundamentals.
    // The pitches carry the same Railsback stretch and stiff-string placement
    // the played strings do, because they ARE played strings.
    const ring = Math.max(0.05, SYMP_RING_T60_S);
    const tilt = Math.max(0, SYMP_PARTIAL_TILT);
    const pdamp = Math.max(0, SYMP_PARTIAL_DAMP);
    let n = 0;
    for (let k = 1; k <= SYMP_PARTIALS && n < RESONANCE_MODES; ++k) {
      for (let i = 0; i < SYMP_FUNDAMENTALS && n < RESONANCE_MODES; ++i) {
        const note = 28 + 4 * i;
        const b = pianoInharmonicityB(note);
        const base = noteToHz(note) * 2 ** (pianoStretchCents(note) / 1200);
        const f = base * k * Math.sqrt(1 + b * k * k);
        if (f >= 0.45 * sr) continue;
        // A string's upper partials shed energy faster than its fundamental.
        const t60 = Math.max(0.02, ring * k ** -pdamp);
        const w = (TWO_PI * f) / sr;
        const r = Math.exp(-LN_1000 / (sr * t60));
        const m = this.modes[n++];
        m.a1 = 2 * r * Math.cos(w);
        m.a2 = -r * r;
        // Unity-peak normalization (the (1-r) factor cancels the high-Q
        // resonant boost) so the bank is a weak coupling, not a runaway
        // bandpass on the played note, then tilt the series down.
        m.gain = (1 - r) * k ** -tilt;
        const octavesBelow = Math.max(0, Math.log2(Math.max(SYMP_TAPER_ANCHOR_HZ, 1) / f));
        m.gain *= 2 ** (-SYMP_BASS_TAPER_OCT * octavesBelow);
      }
    }
    this.gate = 0;
    // Damper-open envelope: ~10 ms to lift, ~60 ms to fall.
    this.gateOpenCoeff = 1 - Math.exp(-1 / (0.01 * sr));
    this.gateCloseCoeff = 1 - Math.exp(-1 / (0.06 * sr));
    // Extra ring-out applied while the dampers are falling (~0.15 s t60).
    this.ringout = Math.exp(-LN_1000 / (sr * 0.15));
    // Weak sympathetic coupling (the played string still dominates).
    this.outGain = Math.max(0, SYMP_COUPLING);
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
    const target = damperOpen ? 1 : DUPLEX_FLOOR;
    this.gate += (damperOpen ? this.gateOpenCoeff : this.gateCloseCoeff) * (target - this.gate);
    const x = this.gate * bridgeIn;
    let sum = 0;
    for (const m of this.modes) {
      const y = m.a1 * m.y1 + m.a2 * m.y2 + m.gain * x;
      m.y2 = m.y1;
      m.y1 = y;
      sum += y;
    }
    // As the dampers fall back the pedal-lifted strings stop ringing quickly
    // (down to the duplex floor, whose faint ring stays).
    if (!damperOpen && this.gate < 0.5 && this.gate > 1.2 * DUPLEX_FLOOR) {
      for (const m of this.modes) {
        m.y1 *= this.ringout;
        m.y2 *= this.ringout;
      }
    }
    return this.outGain * sum;
  }
}

const SOUNDBOARD_MODES = 40;
/** Band the board's modes are log-spread over. */
const BOARD_F_LOW = 92;
const BOARD_F_HIGH = 5400;
/** Damping rises with frequency: low body modes ring, high modes are broad and brief. */
const BOARD_T60_BASE = 0.4;
const BOARD_T60_SLOPE = 2;
const BOARD_T60_MAX = 1;
const DIFFUSER_CAPACITY = 2048;
/** Schroeder allpass coefficient of the two phase diffusers. */
const DIFFUSER_G = 0.22;
/** One-pole spread on a blow into the board bank, so it is a contact and not a sample. */
const BOARD_STRIKE_SPREAD_MS = 10;
/**
 * Case and rim: the dense late field, which a bank of resonators is not. A
 * feedback delay network's modal density in modes per hertz is its total delay
 * in seconds, so the measured 0.28 resonances per hertz IS 0.28 seconds of
 * delay spread over the lines, and the measured thirty decibels of peak-to-
 * floor is a modal overlap near 0.15, which at that density is a t60 of about
 * four seconds. The network runs at an eighth of the host rate, which buys the
 * same total delay for an eighth of the buffer; the two-pole filter that
 * band-limits the drive is also the anti-alias filter, which is why its corner
 * is clamped to a tenth of the internal rate.
 */
const CASE_LINES = 8;
const CASE_DECIM = 8;
const CASE_CAPACITY = 2048;
const CASE_LEVEL = 2.857143;
const CASE_T60_S = 4.2;
const CASE_DAMP_HZ = 2200;
const CASE_IN_HZ = 80;
const CASE_DELAYS_6K = [131, 149, 173, 197, 223, 241, 269, 293];
const CASE_IN_SIGN = [1, -1, 1, 1, -1, -1, 1, -1];
/**
 * Sustain air: level-tracked bandpassed noise. Real piano sustain is not a bare
 * line spectrum — string/board sizzle and the undamped-segment wash fill the
 * space between the partials. Deterministic seed, so renders stay bit-stable.
 */
const AIR_GAIN = 0.01;
const AIR_ATTACK_MS = 30;
const AIR_RELEASE_MS = 200;
const AIR_HP_HZ = 500;
const AIR_LP_HZ = 2800;

/**
 * Shared modal soundboard: one fixed bank of second-order resonators spread
 * across the board's radiating range with frequency-graded damping and a
 * low-mid radiation envelope, a feedback delay network standing in for the case
 * and rim's dense late field, and a sustain-air texture, all behind two
 * Schroeder allpass phase diffusers. Instrument-wide in the host (one board per
 * grand); for a single-note render it is driven by the one voice. Returns the
 * phase-diffused complement of the host's direct share plus the mix-scaled
 * modal colour and late field.
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
  /** A blow waiting to be handed to the board bank, and the one-pole spreading it. */
  private boardStrikePending = 0;
  private boardStrikeLp = 0;
  private boardStrikeA = 1;
  // Case network state (delay pool, per-line damping/feedback, decimation).
  private caseBuf = new Float32Array(CASE_CAPACITY);
  private caseOff = new Int32Array(CASE_LINES);
  private caseLen = new Int32Array(CASE_LINES);
  private caseIdx = new Int32Array(CASE_LINES);
  private caseG = new Float32Array(CASE_LINES);
  private caseLp = new Float32Array(CASE_LINES);
  private caseScaled = new Float32Array(CASE_LINES);
  private caseLpA = 1;
  private caseInA = 1;
  private caseIn1 = 0;
  private caseIn2 = 0;
  private caseStrikePending = 0;
  private casePhase = 0;
  private caseHold = 0;
  private caseOutLp = 0;
  private caseOutA = 1;
  // Sustain-air state (level follower, noise generator, band filters).
  private airEnv = 0;
  private airLp = 0;
  private airLp2 = 0;
  private airHp = 0;
  private airAttack = 0;
  private airRelease = 0;
  private airLpA = 0;
  private airHpA = 0;
  private airRng = 0x9e3779b9;

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
    for (let i = 0; i < SOUNDBOARD_MODES; ++i) {
      const m = this.modes[i];
      const u = i / (SOUNDBOARD_MODES - 1);
      const h = Math.imul(i + 1, 2654435761) >>> 0;
      const jit = (((h >>> 9) & 0xffff) / 65535 - 0.5) * 0.08;
      const f = BOARD_F_LOW * (BOARD_F_HIGH / BOARD_F_LOW) ** u * (1 + jit);
      if (f >= 0.45 * sr) {
        m.a1 = 0;
        m.a2 = 0;
        m.gain = 0;
        m.y1 = 0;
        m.y2 = 0;
        continue;
      }
      const w = (TWO_PI * f) / sr;
      const t60 = clamp(BOARD_T60_BASE * (BOARD_F_LOW / f) ** BOARD_T60_SLOPE, 0.04, BOARD_T60_MAX);
      const r = Math.exp(-LN_1000 / (sr * t60));
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
    // Case network, at its own decimated rate. Lengths scale with that rate so
    // the network's modal density is a property of time and not of the host's
    // rate, and the whole set is scaled down together if it will not fit the
    // pool — which costs density rather than truncating one line into a
    // different network.
    const srCase = sr / CASE_DECIM;
    const rate = srCase / 6000;
    let total = 0;
    for (const d6 of CASE_DELAYS_6K) total += Math.max(2, Math.round(d6 * rate));
    const fit = total > CASE_CAPACITY ? CASE_CAPACITY / total : 1;
    let off = 0;
    for (let i = 0; i < CASE_LINES; ++i) {
      const len = Math.max(2, Math.round(CASE_DELAYS_6K[i] * fit * rate));
      this.caseOff[i] = off;
      this.caseLen[i] = len;
      this.caseIdx[i] = 0;
      off += len;
      // Per-line feedback for a common t60: a long line is traversed fewer
      // times a second, so it must lose less each time for the network to decay
      // at one rate rather than eight.
      this.caseG[i] = Math.min(
        0.9999,
        Math.exp((-LN_1000 * len) / (srCase * Math.max(0.05, CASE_T60_S))),
      );
      this.caseLp[i] = 0;
    }
    this.caseBuf.fill(0);
    // In-loop damping is quoted against the network's own rate, since that is
    // what its one-poles run at.
    this.caseLpA = 1 - Math.exp((-TWO_PI * clamp(CASE_DAMP_HZ, 100, 0.45 * srCase)) / srCase);
    // The drive filter runs at the HOST rate — it is the anti-alias filter, so
    // it has to act before the decimation and not after it.
    this.caseInA = 1 - Math.exp((-TWO_PI * clamp(CASE_IN_HZ, 20, 0.1 * srCase)) / sr);
    this.caseIn1 = 0;
    this.caseIn2 = 0;
    this.caseStrikePending = 0;
    this.casePhase = 0;
    this.caseHold = 0;
    this.caseOutLp = 0;
    // Smooths the held sample, well above the band the drive filter passes.
    this.caseOutA = 1 - Math.exp((-TWO_PI * Math.min(800, 0.45 * sr)) / sr);
    this.boardStrikePending = 0;
    this.boardStrikeLp = 0;
    this.boardStrikeA = clamp(
      1 - Math.exp(-1000 / (Math.max(0.01, BOARD_STRIKE_SPREAD_MS) * sr)),
      0,
      1,
    );
    this.in1 = 0;
    this.in2 = 0;
    this.airEnv = 0;
    this.airLp = 0;
    this.airLp2 = 0;
    this.airHp = 0;
    this.airRng = 0x9e3779b9;
    this.airAttack = 1 - Math.exp(-1 / (Math.max(AIR_ATTACK_MS, 0.1) * 0.001 * sr));
    this.airRelease = 1 - Math.exp(-1 / (Math.max(AIR_RELEASE_MS, 0.1) * 0.001 * sr));
    this.airLpA = 1 - Math.exp((-TWO_PI * Math.min(AIR_LP_HZ, 0.45 * sr)) / sr);
    this.airHpA = 1 - Math.exp((-TWO_PI * AIR_HP_HZ) / sr);
  }

  /** Clears the resonator, diffuser, case-network and air state. */
  reset(): void {
    for (const m of this.modes) {
      m.y1 = 0;
      m.y2 = 0;
    }
    for (let d = 0; d < 2; ++d) {
      this.diffBuf[d].fill(0);
      this.diffIdx[d] = 0;
    }
    this.boardStrikePending = 0;
    this.boardStrikeLp = 0;
    this.caseStrikePending = 0;
    this.caseBuf.fill(0);
    this.caseIdx.fill(0);
    // The per-line damping poles hold energy the delay lines do not; zeroing
    // the buffers alone leaves it to be re-injected on the next traversal.
    this.caseLp.fill(0);
    this.caseIn1 = 0;
    this.caseIn2 = 0;
    this.casePhase = 0;
    this.caseHold = 0;
    this.caseOutLp = 0;
    this.in1 = 0;
    this.in2 = 0;
    this.airEnv = 0;
    this.airLp = 0;
    this.airLp2 = 0;
    this.airHp = 0;
    this.airRng = 0x9e3779b9;
  }

  /**
   * A blow's worth of energy into the case network, from a note that has just
   * started. Accumulated and spent at the network's own decimated rate, so
   * several notes struck in one host block each contribute.
   */
  strike(amount: number): void {
    this.caseStrikePending += amount;
  }

  /**
   * The same blow into the board bank instead of the case network, spent on the
   * next sample rather than at the decimated tick: the rim rings out in a
   * fraction of a second and the low field it feeds rings for four, and one
   * injection point cannot be both.
   */
  strikeBoard(amount: number): void {
    this.boardStrikePending += amount;
  }

  /**
   * Radiates one summed input sample: the phase-diffused complement of the
   * host's direct share plus the (mix-scaled) modal colour and late field, plus
   * the sustain-air texture.
   */
  process(input: number): number {
    let d = input;
    for (let st = 0; st < 2; ++st) {
      const len = this.diffLen[st];
      if (len === 0) break;
      const buf = this.diffBuf[st];
      const idx = this.diffIdx[st];
      const v = d + DIFFUSER_G * buf[idx];
      const y = buf[idx] - DIFFUSER_G * v;
      buf[idx] = v;
      this.diffIdx[st] = idx + 1 < len ? idx + 1 : 0;
      d = y;
    }
    const bp = d - this.in2;
    this.in2 = this.in1;
    this.in1 = d;
    let sum = 0;
    let boardIn = bp;
    if (this.boardStrikePending !== 0 || this.boardStrikeLp !== 0) {
      this.boardStrikeLp += this.boardStrikeA * (this.boardStrikePending - this.boardStrikeLp);
      this.boardStrikePending = 0;
      boardIn += this.boardStrikeLp;
    }
    for (const m of this.modes) {
      const y = m.a1 * m.y1 + m.a2 * m.y2 + m.gain * boardIn;
      m.y2 = m.y1;
      m.y1 = y;
      sum += y;
    }
    // Case and rim network, off the same bandpass residue the bank uses so both
    // sit on one normalization, then band-limited to the range this member
    // radiates in. Both drive poles have unity gain at DC, so inside the band
    // the network is fed exactly what the bank is.
    this.caseIn1 += this.caseInA * (bp - this.caseIn1);
    this.caseIn2 += this.caseInA * (this.caseIn1 - this.caseIn2);
    if (this.casePhase === 0) {
      // The blow enters here rather than through the two poles above: that
      // filter is how a string's sustained bridge force couples into a
      // structure of this mass, and a hammer landing is not that transfer.
      let drive = this.caseIn2;
      if (this.caseStrikePending !== 0) {
        drive += this.caseStrikePending;
        this.caseStrikePending = 0;
      }
      let outSum = 0;
      let mixSum = 0;
      for (let i = 0; i < CASE_LINES; ++i) {
        const tap = this.caseBuf[this.caseOff[i] + this.caseIdx[i]];
        outSum += CASE_IN_SIGN[i] * tap;
        // Damp, then attenuate, and only then mix: the matrix has to act on the
        // vector that is actually fed back, or the network's decay stops being
        // the per-line gain it was designed from.
        this.caseLp[i] += this.caseLpA * (tap - this.caseLp[i]);
        this.caseScaled[i] = this.caseG[i] * this.caseLp[i];
        mixSum += this.caseScaled[i];
      }
      // Householder: y = x - (2/N) * sum(x). Orthogonal, so the matrix is
      // lossless and the decay is entirely the per-line gain and damping.
      const mix = (2 / CASE_LINES) * mixSum;
      for (let i = 0; i < CASE_LINES; ++i) {
        this.caseBuf[this.caseOff[i] + this.caseIdx[i]] =
          this.caseScaled[i] - mix + CASE_IN_SIGN[i] * drive;
        this.caseIdx[i] = this.caseIdx[i] + 1 < this.caseLen[i] ? this.caseIdx[i] + 1 : 0;
      }
      // The output tap sums the lines back with the same signs, so what the
      // injection decorrelated is recombined rather than left half cancelled.
      this.caseHold = outSum;
    }
    this.casePhase = this.casePhase + 1 < CASE_DECIM ? this.casePhase + 1 : 0;
    // Smooth the held sample rather than radiating its steps.
    this.caseOutLp += this.caseOutA * (this.caseHold - this.caseOutLp);
    const late = this.caseOutLp * CASE_LEVEL;
    const mag = d >= 0 ? d : -d;
    this.airEnv += (mag > this.airEnv ? this.airAttack : this.airRelease) * (mag - this.airEnv);
    this.airRng = (Math.imul(this.airRng, 1664525) + 1013904223) >>> 0;
    const white = (this.airRng >>> 8) * (1 / 8388608) - 1;
    this.airLp += this.airLpA * (white - this.airLp);
    this.airLp2 += this.airLpA * (this.airLp - this.airLp2);
    this.airHp += this.airHpA * (this.airLp2 - this.airHp);
    const air = AIR_GAIN * this.airEnv * (this.airLp2 - this.airHp);
    // The late field goes through the return level with the bank: a patch that
    // sets the soundboard mix to zero is asking for no body, and the case is a
    // share of the board's colour rather than an absolute level.
    return (1 - PIANO_DIRECT_GAIN) * d + this.outGain * (sum + late) + air;
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
