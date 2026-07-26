/**
 * Geometry and series helpers shared by the doc figures.
 *
 * Everything here is deterministic: figures are static illustrations that must
 * render identically on the server and the client, so any "noise" is built from
 * fixed trigonometric sums rather than a random source. Values are tuned for
 * legibility at figure scale — they illustrate the relationships the prose
 * describes rather than standing in for a measurement.
 */

export type Scale = (value: number) => number;

/** Linear mapping from a data range onto a pixel range. */
export function linScale(d0: number, d1: number, r0: number, r1: number): Scale {
  const span = d1 - d0 || 1;
  return (v) => r0 + ((v - d0) / span) * (r1 - r0);
}

/** Log10 mapping, for frequency axes. Domain values must be positive. */
export function logScale(d0: number, d1: number, r0: number, r1: number): Scale {
  const l0 = Math.log10(d0);
  const span = Math.log10(d1) - l0 || 1;
  return (v) => r0 + ((Math.log10(Math.max(v, 1e-9)) - l0) / span) * (r1 - r0);
}

export type Pt = [number, number];

/** Round to 2 decimals so path strings stay short and diff-stable. */
function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Polyline through pixel points. */
export function path(points: Pt[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${r2(p[0])} ${r2(p[1])}`).join(' ');
}

/** Closed area between a polyline and a horizontal baseline. */
export function areaPath(points: Pt[], baselineY: number): string {
  if (points.length === 0) return '';
  const first = points[0];
  const last = points[points.length - 1];
  return `${path(points)} L ${r2(last[0])} ${r2(baselineY)} L ${r2(first[0])} ${r2(baselineY)} Z`;
}

/** Sample fn over n evenly spaced steps of [a, b]. */
export function sample(a: number, b: number, n: number, fn: (t: number) => number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = a + ((b - a) * i) / n;
    out.push([t, fn(t)]);
  }
  return out;
}

/**
 * Deterministic band-limited wobble in [-1, 1], used wherever a figure needs
 * something that reads as "measured" without being random.
 */
export function wobble(t: number, seed = 0): number {
  return (
    0.55 * Math.sin(t * 6.283 + seed) +
    0.28 * Math.sin(t * 15.7 + seed * 2.3) +
    0.17 * Math.sin(t * 37.1 + seed * 4.1)
  );
}

// --- Frequency ---------------------------------------------------------

/** Slaney/HTK-style mel warp, the shape mel filterbanks are spaced on. */
export function hzToMel(hz: number): number {
  return 2595 * Math.log10(1 + hz / 700);
}

export function melToHz(mel: number): number {
  return 700 * (10 ** (mel / 2595) - 1);
}

export interface Triangle {
  lo: number;
  center: number;
  hi: number;
}

/**
 * Triangular mel filter edges in Hz: n filters spaced evenly on the mel scale,
 * which is what makes them narrow at the bottom and wide at the top.
 */
export function melTriangles(n: number, fmin: number, fmax: number): Triangle[] {
  const m0 = hzToMel(fmin);
  const m1 = hzToMel(fmax);
  const edges: number[] = [];
  for (let i = 0; i < n + 2; i++) edges.push(melToHz(m0 + ((m1 - m0) * i) / (n + 1)));
  const out: Triangle[] = [];
  for (let i = 0; i < n; i++) out.push({ lo: edges[i], center: edges[i + 1], hi: edges[i + 2] });
  return out;
}

// --- Room decay --------------------------------------------------------

/**
 * Energy decay curve in dB against time, as the Schroeder integral of a
 * reverberant tail would produce: a steep early-reflection knee, a straight
 * reverberant slope set by `rt60`, then a flattening into the noise floor.
 */
export function energyDecay(
  rt60: number,
  noiseFloorDb: number,
  earlyDropDb = 4,
  knee = 0.02,
): Scale {
  const slope = -60 / rt60; // dB per second over the reverberant region
  return (t) => {
    // Early part falls faster than the reverberant slope (direct + early reflections).
    const early = t < knee ? (-earlyDropDb * t) / knee : -earlyDropDb;
    const late = t < knee ? 0 : slope * (t - knee);
    const ideal = early + late;
    // Energy sums with the noise floor rather than crossing it.
    return 10 * Math.log10(10 ** (ideal / 10) + 10 ** (noiseFloorDb / 10));
  };
}

/**
 * Squared impulse response for the clarity figure: a direct-sound spike, a set
 * of discrete early reflections, and an exponentially decaying diffuse tail.
 */
export function impulseEnergy(rt60: number): Scale {
  const reflections = [
    { t: 0.009, a: 0.62 },
    { t: 0.017, a: 0.44 },
    { t: 0.026, a: 0.5 },
    { t: 0.038, a: 0.31 },
    { t: 0.047, a: 0.36 },
    { t: 0.061, a: 0.24 },
    { t: 0.074, a: 0.2 },
    { t: 0.091, a: 0.15 },
  ];
  const tail = (t: number) => 0.42 * 10 ** ((-60 * t) / rt60 / 20);
  return (t) => {
    let v = tail(t) * (0.55 + 0.45 * Math.abs(wobble(t * 9, 1.7)));
    if (t < 0.0035) v = Math.max(v, 1 - t / 0.0035);
    for (const r of reflections) {
      const d = Math.abs(t - r.t);
      if (d < 0.0045) v = Math.max(v, r.a * (1 - d / 0.0045));
    }
    return Math.min(1, v);
  };
}

// --- Loudness ---------------------------------------------------------

/**
 * Per-block short-term loudness for a track with a quiet intro, a body, and a
 * silent tail — the shape that makes the two BS.1770 gates visible.
 */
export function loudnessBlocks(count: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    let db: number;
    if (t < 0.08)
      db = -78; // silent lead-in, below the absolute gate
    else if (t < 0.22)
      db = -31 + 5 * wobble(t * 3, 0.6); // quiet intro
    else if (t > 0.94)
      db = -75; // silent tail
    else db = -13.4 + 2.6 * wobble(t * 4.5, 2.1); // body
    out.push(db);
  }
  return out;
}

/** Energy mean of block loudnesses above a gate, in LUFS. */
export function gatedMean(blocks: number[], gateDb: number): number {
  const kept = blocks.filter((b) => b > gateDb);
  if (kept.length === 0) return Number.NEGATIVE_INFINITY;
  const mean = kept.reduce((s, b) => s + 10 ** (b / 10), 0) / kept.length;
  return 10 * Math.log10(mean);
}

// --- Crest factor -----------------------------------------------------

/**
 * A waveform envelope with `transientGain` controlling how far peaks rise above
 * the sustained bed — the single knob that moves crest factor.
 */
export function crestWave(n: number, transientGain: number, bed: number): Pt[] {
  const hits = [0.08, 0.2, 0.31, 0.43, 0.52, 0.64, 0.73, 0.85, 0.93];
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    let env = bed * (0.86 + 0.14 * wobble(t * 5, 3.3));
    for (const h of hits) {
      const d = t - h;
      if (d >= -0.004 && d < 0.05) {
        const shape = d < 0 ? 1 + d / 0.004 : Math.exp(-d / 0.014);
        env = Math.max(env, bed + (transientGain - bed) * shape);
      }
    }
    out.push([t, Math.min(1, env)]);
  }
  return out;
}

/** Peak and RMS of an envelope, in dB relative to full scale. */
export function crestStats(wave: Pt[]): { peakDb: number; rmsDb: number; crestDb: number } {
  let peak = 0;
  let sumSq = 0;
  for (const [, v] of wave) {
    peak = Math.max(peak, v);
    sumSq += v * v;
  }
  const rms = Math.sqrt(sumSq / wave.length) * Math.SQRT1_2;
  const peakDb = 20 * Math.log10(peak);
  const rmsDb = 20 * Math.log10(rms);
  return { peakDb, rmsDb, crestDb: peakDb - rmsDb };
}

// --- Structure --------------------------------------------------------

/**
 * A self-similarity matrix for a track whose sections are given as fractional
 * boundaries with a label id: cells are bright where two frames belong to
 * repeats of the same section.
 */
export function similarityMatrix(
  size: number,
  sections: { end: number; id: number }[],
): number[][] {
  const idAt = (i: number) => {
    const t = i / (size - 1);
    for (const s of sections) if (t <= s.end) return s.id;
    return sections[sections.length - 1].id;
  };
  const grid: number[][] = [];
  for (let y = 0; y < size; y++) {
    const row: number[] = [];
    for (let x = 0; x < size; x++) {
      const same = idAt(x) === idAt(y);
      const diag = Math.exp(-Math.abs(x - y) / (size * 0.06));
      const base = same ? 0.62 : 0.14;
      const texture = 0.09 * wobble((x * 7.3 + y * 3.1) / size, 5.5);
      row.push(Math.min(1, Math.max(0, base + 0.35 * diag + texture)));
    }
    grid.push(row);
  }
  return grid;
}

/**
 * Foote novelty: correlate a checkerboard kernel along the matrix diagonal.
 * The kernel rewards self-similar blocks before and after a frame and punishes
 * similarity across it, so it peaks exactly where one section gives way to the
 * next — which is the claim the figure makes about the curve.
 */
export function noveltyCurve(grid: number[][], radius?: number): number[] {
  const n = grid.length;
  const L = radius ?? Math.max(2, Math.round(n * 0.12));
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let a = -L; a < L; a++) {
      for (let b = -L; b < L; b++) {
        const ya = i + a;
        const xb = i + b;
        if (ya < 0 || ya >= n || xb < 0 || xb >= n) continue;
        // Same side of the boundary → +1, opposite sides → −1.
        const sign = a < 0 === b < 0 ? 1 : -1;
        sum += sign * grid[ya][xb];
      }
    }
    out.push(Math.max(0, sum));
  }
  const max = Math.max(...out, 1e-6);
  return out.map((v) => v / max);
}
