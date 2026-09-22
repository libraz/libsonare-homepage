/**
 * The instrument's fixed constants: the base patch every pattern starts from,
 * the accent model, and the panel knob ranges. Everything downstream imports
 * these rather than restating them, so a number exists here once.
 */

import type { Knobs, StepBassWaveform } from '@/demos/step-bass/stepBassTypes';
import type { SynthPatch } from '@/wasm/index';

/** Steps in one bar of the sequencer. */
export const STEP_COUNT = 16;

/** Engine track lane and MIDI destination; raw-engine lane ids are 1-based. */
export const STEP_BASS_TRACK_ID = 1;
/** MIDI channel the articulation and the clip events use. */
export const STEP_BASS_CHANNEL = 0;

/**
 * Render-frame argument meaning "at the start of the next block". The JS facade
 * defaults it; the native embind object does not, and omitting it there throws
 * while converting `undefined` to a BigInt.
 */
export const RENDER_NOW = -1;

/**
 * Every field carries a real value: the engine reads an absent field as "keep
 * the base", so a sentinel here would silently become whatever the preset had.
 */
export const STEP_BASS_BASE_PATCH: SynthPatch = {
  engineMode: 'subtractive',
  waveform: 'saw',
  unison: 1,
  detuneCents: 0,
  driftCents: 0,
  drive: 0,
  filterModel: 'diode-ladder',
  filterOutput: 'lowpass',
  cutoffHz: 700,
  resonanceQ: 6.4,
  hpCutoffHz: 0,
  keyTrack: 0,
  envToCutoffCents: 2400,
  velToCutoffCents: 0,
  ampAttackMs: 3,
  ampDecayMs: 2000,
  ampSustain: 1,
  ampReleaseMs: 12,
  filterAttackMs: 0,
  filterDecayMs: 300,
  filterSustain: 0,
  filterReleaseMs: 12,
  lfoRateHz: 5,
  lfoToPitchCents: 0,
  lfo2RateHz: 1,
  glideMs: 0,
  pitchOffsetCents: 0,
  body: 'none',
  bodyMix: 0,
  stereoSpread: 0,
  gain: 0.9,
  busDrive: 0,
  polyphony: 1,
  sampleHoldHz: 0,
  bitDepth: 0,
  // A patch that names routings replaces the base set, so the one routing the
  // accent needs is fixed here. Its depth is not on the panel.
  modRoutings: [{ source: 'velocity', destination: 'amp-gain', depth: 1.5 }],
};

/** Amp envelope is a gate, so the note length alone shapes it. */
export const STEP_BASS_ARTICULATION = 'mono-legato';

// ---------------------------------------------------------------- resonance

/** `resonanceQ` at panel zero. */
export const RESONANCE_Q_MIN = 0.5;
/** `resonanceQ` travel from panel zero to full. */
export const RESONANCE_Q_SPAN = 11.5;

/** Panel travel (0..1) to the engine's `resonanceQ`. */
export function resonanceQ(pct: number): number {
  return RESONANCE_Q_MIN + RESONANCE_Q_SPAN * pct;
}

/** `resonanceQ` back to panel travel; the accent cutoff lift scales with it. */
export function resonanceNorm(q: number): number {
  return (q - RESONANCE_Q_MIN) / RESONANCE_Q_SPAN;
}

// ------------------------------------------------------------------ accent

/** Velocity of a step without accent. */
export const STEP_VELOCITY = 64;
/** Velocity the first accent of a run asks for. */
export const ACCENT_VELOCITY_FIRST = 110;
/** Velocity a run of accents reaches once its memory is saturated. */
export const ACCENT_VELOCITY_SATURATED = 127;
/** Accent memory saturates here; beyond it a run of accents stops building. */
export const ACCENT_MEMORY_CAP = 3;
/** Filter decay an accented step forces, ignoring the DECAY knob. */
export const ACCENT_DECAY_MS = 80;
/**
 * Time constant of the accent memory. At 120 BPM a sixteenth is 125 ms, so the
 * memory is all but spent between steps and only becomes audible above roughly
 * 160 BPM.
 */
export const ACCENT_MEMORY_TAU_MS = 47;

/** Velocity a run of accents is heading for, given the memory it has built. */
function accentTargetVelocity(memory: number): number {
  const saturation = (Math.min(memory, ACCENT_MEMORY_CAP) - 1) / (ACCENT_MEMORY_CAP - 1);
  return ACCENT_VELOCITY_FIRST + (ACCENT_VELOCITY_SATURATED - ACCENT_VELOCITY_FIRST) * saturation;
}

/**
 * Note-on velocity of an accented step. The memory rides the velocity, so a
 * run of accents grows louder and brighter together, as the circuit does.
 */
export function accentVelocity(accent: number, memory: number): number {
  return Math.round(STEP_VELOCITY + (accentTargetVelocity(memory) - STEP_VELOCITY) * accent);
}

/**
 * `velToCutoffCents` at full accent and full resonance. The parameter is
 * referenced to velocity 127 — positive darkens, harder the further under it —
 * and 4800, where the filter starts eating level, takes a slide's envelope dip
 * under the ratio that tells a slur apart from a retrigger.
 */
export const ACCENT_BRIGHTNESS_CENTS = 3600;

/**
 * The whole patch's `velToCutoffCents`. Accented steps sit near 127 and keep the
 * resting cutoff; plain steps at {@link STEP_VELOCITY} sink below it, which is
 * what makes an accent the brighter of the two.
 */
export function accentBrightnessCents(accent: number, q: number): number {
  return ACCENT_BRIGHTNESS_CENTS * accent * resonanceNorm(q);
}

/** Accent memory after an accented step, `elapsedSeconds` since the previous one. */
export function accentMemory(previous: number, elapsedSeconds: number): number {
  return previous * Math.exp((-elapsedSeconds * 1000) / ACCENT_MEMORY_TAU_MS) + 1;
}

// -------------------------------------------------------------------- slide

/** Glide time a slide step raises `glideMs` to before the next note-on. */
export const SLIDE_GLIDE_MS = 60;
/**
 * The lane must reach its value before the note-on latches it, and the engine
 * samples lanes once per block, so a slide's glide is written at least this
 * many frames early.
 */
export const SLIDE_LEAD_FRAMES = 128;

// ------------------------------------------------------------------- output

/**
 * Reserved master-fader parameter id: `(1297612800 | (255 << 8) | 1) >>> 0`.
 * Moving it leaves the strip and its limiter in place, which re-sending the
 * strip scene would not.
 */
export const MASTER_FADER_PARAM_ID = 1297678081;

// ------------------------------------------------------------- knob ranges

export interface KnobRange {
  min: number;
  max: number;
}

/** Panel travel limits, in the units the panel shows. */
export const KNOB_RANGES = {
  tuningCents: { min: -900, max: 900 },
  cutoffHz: { min: 20, max: 10_000 },
  resonancePct: { min: 0, max: 1 },
  envModCents: { min: 0, max: 4800 },
  decayMs: { min: 200, max: 2000 },
  accent: { min: 0, max: 1 },
  faderDb: { min: -60, max: 30 },
} as const satisfies Record<string, KnobRange>;

/** Tempo range of the transport, in BPM. */
export const TEMPO_RANGE: KnobRange = { min: 60, max: 200 };
export const DEFAULT_BPM = 120;

/**
 * Knob positions the instrument opens at. The five patch-backed ones read the
 * base patch so the two cannot drift, and the fader sits where the gain staging
 * was measured. Accent opens below full for the same reason the others open
 * mid-travel: a knob that can only be turned down reads as a knob that does
 * nothing.
 */
export const STEP_BASS_DEFAULT_KNOBS: Knobs = {
  waveform: STEP_BASS_BASE_PATCH.waveform as StepBassWaveform,
  tuningCents: STEP_BASS_BASE_PATCH.pitchOffsetCents ?? 0,
  cutoffHz: STEP_BASS_BASE_PATCH.cutoffHz ?? 700,
  resonancePct: resonanceNorm(STEP_BASS_BASE_PATCH.resonanceQ ?? RESONANCE_Q_MIN),
  envModCents: STEP_BASS_BASE_PATCH.envToCutoffCents ?? 0,
  decayMs: STEP_BASS_BASE_PATCH.filterDecayMs ?? 300,
  accent: 0.75,
  faderDb: 24,
};
