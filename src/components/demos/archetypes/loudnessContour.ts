/**
 * Time base of a BS.1770 loudness series, and the resampling that places it on a
 * clip's timeline.
 *
 * `momentaryLufs` / `shortTermLufs` return one value per completed analysis block, not
 * one value per unit of clip time: block `i` covers `[i * hop, i * hop + window]` and is
 * emitted only once that window is full. So the series starts one window into the clip
 * (a 3 s short-term window leaves the first three seconds unmeasured), and the last
 * value ends at the clip's end. Spreading the values evenly over the whole duration
 * instead would slide every reading towards the start of the clip.
 *
 * The hop is fixed at 100 ms by ITU-R BS.1770-4 Annex 2 — 75% overlap over the 400 ms
 * momentary block, and the same 100 ms step for the short-term block. The window
 * lengths are the EBU R128 integration times, which libsonare uses as its `LufsConfig`
 * defaults (`momentary_duration_sec` 0.400, `short_term_duration_sec` 3.0).
 */

/** Step between consecutive loudness blocks, in seconds. */
export const LOUDNESS_HOP_SEC = 0.1;
/** Momentary integration window, in seconds. */
export const MOMENTARY_WINDOW_SEC = 0.4;
/** Short-term integration window, in seconds. */
export const SHORT_TERM_WINDOW_SEC = 3;

export interface LoudnessContour {
  /** One LUFS value per column; columns without a measurement carry `floorLufs`. */
  values: Float32Array;
  /**
   * First column backed by a measurement. Equal to `cols` when the clip is shorter
   * than the window, in which case no block completed and nothing was measured.
   */
  start: number;
}

/**
 * Resample a loudness series onto `cols` evenly spaced columns of a clip's timeline.
 *
 * Column `c` is time `t = c / (cols - 1) * durationSec`, which maps back to the
 * fractional series index `(t - windowSec) / LOUDNESS_HOP_SEC`; neighbouring values are
 * interpolated. Times before the first completed window have no reading and are filled
 * with `floorLufs` so a caller can skip them.
 *
 * @param series Loudness values as returned by `momentaryLufs` / `shortTermLufs`.
 * @param durationSec Clip duration in seconds.
 * @param windowSec Integration window the series was measured with.
 * @param cols Number of columns to produce.
 * @param floorLufs Value for columns with no measurement, and for non-finite readings
 *                  (a silent block meters as -inf).
 */
export function loudnessContourColumns(
  series: ArrayLike<number>,
  durationSec: number,
  windowSec: number,
  cols: number,
  floorLufs: number,
): LoudnessContour {
  const values = new Float32Array(cols).fill(floorLufs);
  const n = series.length;
  let start = cols;
  if (n === 0 || cols <= 0 || !(durationSec > 0)) return { values, start };

  for (let c = 0; c < cols; c++) {
    const t = cols === 1 ? durationSec : (c / (cols - 1)) * durationSec;
    const pos = (t - windowSec) / LOUDNESS_HOP_SEC;
    if (pos < 0) continue;
    if (start === cols) start = c;
    const i0 = Math.min(n - 1, Math.floor(pos));
    const frac = pos - i0;
    const v = i0 + 1 < n ? series[i0] * (1 - frac) + series[i0 + 1] * frac : series[i0];
    values[c] = Number.isFinite(v) ? v : floorLufs;
  }
  return { values, start };
}
