/**
 * Loudness fit: finds the level of the drive slot (the `utility.gain` just
 * before the limiter) that brings the master to its target. Only that slot
 * moves, so the drive into the dynamics stages ahead of it never changes.
 *
 * 1. Bounce with the limiter bypassed and drive 0; drive = target − measured.
 * 2. Bounce with the limiter as set; error e = target − measured.
 * 3. If |e| > 0.3 LU, drive += e and bounce once more.
 *
 * At most three bounces. A residual beyond 0.5 LU means the limiter cannot
 * reach the target at this ceiling, and the fit reports it as limited. The
 * bounce itself is injected, so this orchestration is testable without audio.
 */

/** Bounces at most this many times per fit. */
export const LOUDNESS_FIT_MAX_BOUNCES = 3;
/** A residual above this after bounce 2 triggers bounce 3. */
export const LOUDNESS_FIT_REFIT_LU = 0.3;
/** A final residual above this is reported as limited. */
export const LOUDNESS_FIT_LIMITED_LU = 0.5;

/** One bounce the fit asks for. */
export interface LoudnessFitBounceRequest {
  driveDb: number;
  /** Bypass the limiter for this bounce (only the first one). */
  limiterBypassed: boolean;
}

/** Renders the master as requested and returns its integrated loudness (LUFS). */
export type LoudnessFitBounce = (request: LoudnessFitBounceRequest) => number | Promise<number>;

export interface LoudnessFitOptions {
  targetLufs: number;
  /** Renders and measures; a rejection (e.g. a cancel) stops the fit. */
  bounce: LoudnessFitBounce;
}

export interface LoudnessFitResult {
  targetLufs: number;
  driveDb: number;
  measuredLufs: number;
  /** `targetLufs - measuredLufs` of the last bounce. */
  residualLu: number;
  bounces: number;
  limited: boolean;
}

/** Runs the fit; rejects when the program is silent (no loudness to fit). */
export async function fitLoudness(options: LoudnessFitOptions): Promise<LoudnessFitResult> {
  const { targetLufs, bounce } = options;
  let bounces = 0;
  const measure = async (request: LoudnessFitBounceRequest) => {
    const lufs = await bounce(request);
    bounces += 1;
    return lufs;
  };

  const open = await measure({ driveDb: 0, limiterBypassed: true });
  if (!Number.isFinite(open))
    throw new RangeError('the program is silent; there is no loudness to fit');
  let driveDb = targetLufs - open;
  let measuredLufs = await measure({ driveDb, limiterBypassed: false });
  if (
    Math.abs(targetLufs - measuredLufs) > LOUDNESS_FIT_REFIT_LU &&
    bounces < LOUDNESS_FIT_MAX_BOUNCES
  ) {
    driveDb += targetLufs - measuredLufs;
    measuredLufs = await measure({ driveDb, limiterBypassed: false });
  }
  const residualLu = targetLufs - measuredLufs;
  return {
    targetLufs,
    driveDb,
    measuredLufs,
    residualLu,
    bounces,
    limited: !(Math.abs(residualLu) <= LOUDNESS_FIT_LIMITED_LU),
  };
}
