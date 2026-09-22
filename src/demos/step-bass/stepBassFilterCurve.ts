/**
 * Computed magnitude response for the diode-ladder lowpass, on a log-frequency
 * axis for the panel's filter view. The engine exposes no API that returns its
 * own filter response, so this is a closed-form model — fit against a
 * rendered, FFT'd noise pass (`tests/demos/step-bass/filterCurve.test.ts`)
 * rather than trusted on shape alone.
 *
 * The panel's `resonanceQ` is not a textbook quality factor: the audible
 * corner and the resonance peak both move against it nonlinearly (the peak is
 * even negative — no peak at all, just more rolloff — at panel-minimum Q), so
 * the shape is carried as a small table of measured points rather than one
 * closed-form curve, and interpolated between them.
 */

export interface FilterCurvePoint {
  freqHz: number;
  db: number;
}

/** Plotted frequency axis. */
export const CURVE_MIN_HZ = 20;
export const CURVE_MAX_HZ = 20_000;
/** Curve resolution. */
export const CURVE_POINTS_PER_OCTAVE = 48;

/** Rolloff shape exponent, fit against a rendered noise pass. */
const ROLLOFF_SHAPE = 1.4;

/**
 * One measured point on the panel's resonance travel: `cutoffHz` scale to the
 * audible corner, the resonance peak's height above the passband (negative
 * where there is no peak), and its width in octaves.
 */
interface CurveNode {
  q: number;
  fcScale: number;
  peakGainDb: number;
  sigmaOctaves: number;
}

/** Fit to a rendered noise pass at each `q`; between points is linear interpolation, not a formula. */
const CURVE_NODES: readonly CurveNode[] = [
  { q: 0.5, fcScale: 0.1891, peakGainDb: -4, sigmaOctaves: 0.4 },
  { q: 2, fcScale: 0.2, peakGainDb: 5, sigmaOctaves: 0.3 },
  { q: 4, fcScale: 0.3031, peakGainDb: 5, sigmaOctaves: 1.6 },
  { q: 6, fcScale: 0.4456, peakGainDb: 5, sigmaOctaves: 0.2 },
  { q: 8, fcScale: 0.4456, peakGainDb: 6, sigmaOctaves: 0.2 },
  { q: 10, fcScale: 0.4456, peakGainDb: 7, sigmaOctaves: 0.2 },
  { q: 12, fcScale: 0.6168, peakGainDb: 8, sigmaOctaves: 0.2 },
];

/** Linear interpolation of the node table at `resonanceQ`, clamped to the panel range. */
function interpolateNodes(resonanceQ: number): Omit<CurveNode, 'q'> {
  const q = Math.min(Math.max(resonanceQ, CURVE_NODES[0].q), CURVE_NODES[CURVE_NODES.length - 1].q);
  let i = 0;
  while (i < CURVE_NODES.length - 2 && CURVE_NODES[i + 1].q < q) i++;
  const a = CURVE_NODES[i];
  const b = CURVE_NODES[i + 1];
  const t = (q - a.q) / (b.q - a.q);
  return {
    fcScale: a.fcScale + t * (b.fcScale - a.fcScale),
    peakGainDb: a.peakGainDb + t * (b.peakGainDb - a.peakGainDb),
    sigmaOctaves: a.sigmaOctaves + t * (b.sigmaOctaves - a.sigmaOctaves),
  };
}

/** Magnitude at one frequency, in dB relative to the passband. */
function magnitudeDb(freqHz: number, cutoffHz: number, resonanceQ: number): number {
  const { fcScale, peakGainDb, sigmaOctaves } = interpolateNodes(resonanceQ);
  const fc = cutoffHz * fcScale;
  const x = freqHz / fc;
  const base = -10 * Math.log10(1 + x ** (2 * ROLLOFF_SHAPE));
  const octavesFromCutoff = Math.log2(Math.max(x, 1e-6));
  const bump =
    peakGainDb *
    Math.exp(-(octavesFromCutoff * octavesFromCutoff) / (2 * sigmaOctaves * sigmaOctaves));
  return base + bump;
}

/** Magnitude response for the panel's solid curve, `CURVE_MIN_HZ`..`CURVE_MAX_HZ`. */
export function filterCurve(cutoffHz: number, resonanceQ: number): FilterCurvePoint[] {
  const octaves = Math.log2(CURVE_MAX_HZ / CURVE_MIN_HZ);
  const steps = Math.round(octaves * CURVE_POINTS_PER_OCTAVE);
  const points: FilterCurvePoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const freqHz = CURVE_MIN_HZ * 2 ** (i / CURVE_POINTS_PER_OCTAVE);
    points.push({ freqHz, db: magnitudeDb(freqHz, cutoffHz, resonanceQ) });
  }
  return points;
}

/** Cutoff the envelope opens to at full depth. */
export function envOpenCutoffHz(cutoffHz: number, envModCents: number): number {
  return cutoffHz * 2 ** (envModCents / 1200);
}

/** Overlaid dashed curve: the same shape, re-centered on the envelope-open cutoff. */
export function envFilterCurve(
  cutoffHz: number,
  resonanceQ: number,
  envModCents: number,
): FilterCurvePoint[] {
  return filterCurve(envOpenCutoffHz(cutoffHz, envModCents), resonanceQ);
}
