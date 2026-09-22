/**
 * The engine-side safety limiter the live and offline demo mixes sit behind: a
 * true-peak limiter inserted on the realtime engine's master strip, so a mix
 * pushed past full scale from a demo's own controls is held at the ceiling by
 * the engine rather than clipped by the browser. Pass the JSON to
 * `RealtimeEngine.setMasterStripJson` (or the worklet facade's).
 */

/** Master-strip insert processor; realtime-insertable, 60 samples of latency. */
export const MASTER_LIMITER_PROCESSOR = 'maximizer.truePeakLimiter';
/** Output ceiling in dBTP. */
export const MASTER_LIMITER_CEILING_DB = -1;
/** The ceiling as a linear amplitude: the most a post-limiter sample can reach. */
export const MASTER_LIMITER_CEILING = 10 ** (MASTER_LIMITER_CEILING_DB / 20);

/**
 * Master strip scene with the limiter as its one post-fader insert.
 *
 * @param faderDb Master fader position, in dB (0 = unity).
 */
export function masterLimiterStripJson(faderDb = 0): string {
  return JSON.stringify({
    strips: [
      {
        id: 'master',
        faderDb,
        inserts: [
          {
            slot: 'post',
            processor: MASTER_LIMITER_PROCESSOR,
            params: { ceilingDb: MASTER_LIMITER_CEILING_DB },
          },
        ],
      },
    ],
  });
}
