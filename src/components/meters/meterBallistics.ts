/**
 * @file Meter ballistics and scale mapping shared by the meter components.
 *
 * Everything here is pure: a meter feeds timestamped readings in and gets the
 * displayed state back, so the timing is testable without a clock. Ballistics
 * follow the digital peak-meter convention: instant attack, a 1.5 s peak hold,
 * then a 20 dB/s fall. RMS is displayed as received.
 */

/** Seconds a peak-hold tick stays put before it starts to fall. */
export const PEAK_HOLD_SECONDS = 1.5;
/** Fall rate of both the bar and the released hold tick. */
export const PEAK_FALL_DB_PER_SECOND = 20;
/** A true peak above this latches the clip indicator until it is cleared. */
export const CLIP_THRESHOLD_DBTP = -0.1;
/** Lowest level a meter represents; silence and non-finite readings land here. */
export const METER_FLOOR_DB = -120;

/** Displayed state of one ballistic channel. */
export interface PeakBallistics {
  /** Bar level in dB. */
  levelDb: number;
  /** Peak-hold tick in dB; never below {@link levelDb}. */
  holdDb: number;
  /** Time (s) at which the hold tick is released. */
  holdUntil: number;
  /** Time (s) of the previous step, or null before the first reading. */
  lastTime: number | null;
}

/** A channel at rest on the given floor. */
export function createPeakBallistics(floorDb = METER_FLOOR_DB): PeakBallistics {
  return { levelDb: floorDb, holdDb: floorDb, holdUntil: 0, lastTime: null };
}

/** A finite reading clamped to the floor; NaN and -Infinity read as the floor. */
export function sanitizeDb(valueDb: number, floorDb = METER_FLOOR_DB): number {
  return Number.isFinite(valueDb) ? Math.max(floorDb, valueDb) : floorDb;
}

/**
 * Advance one channel to `timeSec` with a new reading.
 *
 * @param state Previous state; not mutated.
 * @param inputDb Latest reading in dB (NaN / -Infinity read as the floor).
 * @param timeSec Timestamp of the reading in seconds; steps backwards in time count as zero.
 * @param floorDb Floor of the channel (0 for a gain-reduction depth).
 * @returns The next displayed state.
 */
export function stepPeakBallistics(
  state: PeakBallistics,
  inputDb: number,
  timeSec: number,
  floorDb = METER_FLOOR_DB,
): PeakBallistics {
  const input = sanitizeDb(inputDb, floorDb);
  const dt = state.lastTime === null ? 0 : Math.max(0, timeSec - state.lastTime);
  const levelDb = Math.max(input, state.levelDb - PEAK_FALL_DB_PER_SECOND * dt, floorDb);

  let holdDb = state.holdDb;
  let holdUntil = state.holdUntil;
  if (input >= holdDb) {
    holdDb = input;
    holdUntil = timeSec + PEAK_HOLD_SECONDS;
  } else if (timeSec > holdUntil) {
    // Only the part of this step past the release point counts as falling time.
    const fallFrom = state.lastTime === null ? holdUntil : Math.max(state.lastTime, holdUntil);
    holdDb -= PEAK_FALL_DB_PER_SECOND * Math.max(0, timeSec - fallFrom);
  }
  holdDb = Math.max(holdDb, levelDb);
  return { levelDb, holdDb, holdUntil, lastTime: timeSec };
}

/** True while the displayed state still differs from a resting reading of `inputDb`. */
export function isPeakBallisticsMoving(
  state: PeakBallistics,
  inputDb: number,
  floorDb = METER_FLOOR_DB,
): boolean {
  const input = sanitizeDb(inputDb, floorDb);
  return state.levelDb > input || state.holdDb > state.levelDb;
}

/**
 * Clip latch: once a true peak exceeds {@link CLIP_THRESHOLD_DBTP} it stays set
 * until the caller clears it. NaN never latches; +Infinity does.
 */
export function latchClip(latched: boolean, truePeakDb: number): boolean {
  return latched || truePeakDb > CLIP_THRESHOLD_DBTP;
}

/** Position of `valueDb` on a linear dB scale, clamped to [0, 1]. */
export function dbToFraction(valueDb: number, minDb: number, maxDb: number): number {
  if (!Number.isFinite(valueDb)) return valueDb === Number.POSITIVE_INFINITY ? 1 : 0;
  const span = maxDb - minDb;
  if (span <= 0) return 0;
  return Math.min(1, Math.max(0, (valueDb - minDb) / span));
}

/** Tick values for a dB scale: `stepDb` apart, aligned to 0, inside [minDb, maxDb]. */
export function dbScaleTicks(minDb: number, maxDb: number, stepDb: number): number[] {
  const ticks: number[] = [];
  for (let v = Math.ceil(minDb / stepDb) * stepDb; v <= maxDb + 1e-9; v += stepDb) {
    ticks.push(Math.round(v * 1000) / 1000);
  }
  return ticks;
}

/** Loudness meter scale: absolute LUFS, or EBU +9 (relative LU around -23 LUFS). */
export type LoudnessScale = 'absolute' | 'ebu9';

/** EBU R128 reference: 0 LU on a relative scale. */
export const EBU_REFERENCE_LUFS = -23;

/** Range, unit and ticks of a loudness scale, all in absolute LUFS. */
export interface LoudnessScaleSpec {
  minLufs: number;
  maxLufs: number;
  unit: 'LUFS' | 'LU';
  ticks: Array<{ lufs: number; label: string }>;
}

/**
 * Describe a loudness scale. `absolute` spans -40..0 LUFS; `ebu9` spans
 * -41..-14 LUFS labelled -18..+9 LU (EBU Tech 3341).
 */
export function loudnessScaleSpec(scale: LoudnessScale): LoudnessScaleSpec {
  if (scale === 'ebu9') {
    const ticks = dbScaleTicks(-18, 9, 3).map((lu) => ({
      lufs: EBU_REFERENCE_LUFS + lu,
      label: lu > 0 ? `+${lu}` : String(lu),
    }));
    return { minLufs: EBU_REFERENCE_LUFS - 18, maxLufs: EBU_REFERENCE_LUFS + 9, unit: 'LU', ticks };
  }
  const ticks = dbScaleTicks(-40, 0, 5).map((lufs) => ({ lufs, label: String(lufs) }));
  return { minLufs: -40, maxLufs: 0, unit: 'LUFS', ticks };
}

/** A loudness value in the scale's own unit (LUFS, or LU relative to -23 LUFS). */
export function lufsInScale(lufs: number, scale: LoudnessScale): number {
  return scale === 'ebu9' ? lufs - EBU_REFERENCE_LUFS : lufs;
}

/** One-decimal readout; NaN and ±Infinity read as an em dash. */
export function formatMeterValue(value: number, signed = false): string {
  if (!Number.isFinite(value)) return '—';
  const text = value.toFixed(1);
  if (text === '-0.0') return '0.0';
  return signed && value > 0 ? `+${text}` : text;
}
