/**
 * Lightweight audio helpers used by inline demos. These are intentionally small
 * and dependency-free so OSS consumers can lift them into their own examples.
 */

export function peakNormalize(samples: Float32Array, target: number): Float32Array {
  let max = 1e-6;
  for (let i = 0; i < samples.length; i++) {
    const amplitude = Math.abs(samples[i]);
    if (amplitude > max) max = amplitude;
  }
  const gain = target / max;
  for (let i = 0; i < samples.length; i++) samples[i] *= gain;
  return samples;
}

/**
 * Apply one RBJ shelving biquad and return a fresh buffer. Slope S is fixed at 1,
 * which is the broad shelf shape a tilt EQ wants.
 */
export function shelfFilter(
  samples: Float32Array,
  sampleRate: number,
  kind: 'low' | 'high',
  f0: number,
  gainDb: number,
): Float32Array {
  const a = 10 ** (gainDb / 40);
  const w0 = (2 * Math.PI * f0) / sampleRate;
  const cw = Math.cos(w0);
  const sw = Math.sin(w0);
  const sqrtA = Math.sqrt(a);
  const alpha = (sw / 2) * Math.SQRT2;
  const twoSqrtAAlpha = 2 * sqrtA * alpha;
  let b0: number;
  let b1: number;
  let b2: number;
  let a0: number;
  let a1: number;
  let a2: number;

  if (kind === 'low') {
    b0 = a * (a + 1 - (a - 1) * cw + twoSqrtAAlpha);
    b1 = 2 * a * (a - 1 - (a + 1) * cw);
    b2 = a * (a + 1 - (a - 1) * cw - twoSqrtAAlpha);
    a0 = a + 1 + (a - 1) * cw + twoSqrtAAlpha;
    a1 = -2 * (a - 1 + (a + 1) * cw);
    a2 = a + 1 + (a - 1) * cw - twoSqrtAAlpha;
  } else {
    b0 = a * (a + 1 + (a - 1) * cw + twoSqrtAAlpha);
    b1 = -2 * a * (a - 1 + (a + 1) * cw);
    b2 = a * (a + 1 + (a - 1) * cw - twoSqrtAAlpha);
    a0 = a + 1 - (a - 1) * cw + twoSqrtAAlpha;
    a1 = 2 * (a - 1 - (a + 1) * cw);
    a2 = a + 1 - (a - 1) * cw - twoSqrtAAlpha;
  }

  const nb0 = b0 / a0;
  const nb1 = b1 / a0;
  const nb2 = b2 / a0;
  const na1 = a1 / a0;
  const na2 = a2 / a0;
  const out = new Float32Array(samples.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;

  for (let i = 0; i < samples.length; i++) {
    const x0 = samples[i];
    const y0 = nb0 * x0 + nb1 * x1 + nb2 * x2 - na1 * y1 - na2 * y2;
    out[i] = y0;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
  }

  return out;
}

/**
 * Fill `out` with the per-column absolute-peak envelope of `samples`.
 *
 * Each output column spans an equal slice of the input and takes that slice's
 * loudest absolute sample. With no `scale`, the envelope is normalized so the
 * loudest column reads 1. Pass an explicit `scale` — columns are then clamped to
 * 1 — to keep several envelopes on one shared amplitude axis (e.g. comparing a
 * mix bus against its stems).
 */
export function peakEnvelope(samples: Float32Array, out: Float32Array, scale?: number): void {
  const n = samples.length;
  const cols = out.length;
  let max = 1e-6;
  for (let c = 0; c < cols; c++) {
    const start = Math.floor((c / cols) * n);
    const end = Math.max(start + 1, Math.floor(((c + 1) / cols) * n));
    let peak = 0;
    for (let i = start; i < end && i < n; i++) {
      const a = Math.abs(samples[i]);
      if (a > peak) peak = a;
    }
    out[c] = peak;
    if (peak > max) max = peak;
  }
  if (scale === undefined) {
    for (let c = 0; c < cols; c++) out[c] /= max;
  } else {
    for (let c = 0; c < cols; c++) out[c] = Math.min(1, out[c] * scale);
  }
}

/** Perceptual compression applied to averaged spectra so quiet detail stays legible. */
export const SPECTRUM_COMPRESSION = 0.6;

/** Minimal view of the WASM `stft` binding the spectral demos rely on. */
export interface StftProvider {
  stft(
    samples: Float32Array,
    sampleRate: number,
    nFft: number,
    hopLength: number,
  ): { nBins: number; nFrames: number; magnitude: ArrayLike<number> };
}

/**
 * Average an STFT magnitude over time, resample it to `out.length` columns on a
 * linear 0..`maxHz` axis, and store it compressed by {@link SPECTRUM_COMPRESSION}
 * for legibility. `scale` is applied before compression so several spectra can
 * share one amplitude axis. Returns the peak linear (pre-scale) magnitude, which
 * callers use to derive that shared scale.
 */
export function averagedSpectrum(
  wasm: StftProvider,
  samples: Float32Array,
  sampleRate: number,
  out: Float32Array,
  maxHz: number,
  scale: number,
): number {
  const nFft = 2048;
  const cols = out.length;
  const { nBins, nFrames, magnitude } = wasm.stft(samples, sampleRate, nFft, 512);
  const binHz = sampleRate / nFft;
  const avg = new Float32Array(nBins);
  let max = 1e-6;
  for (let b = 0; b < nBins; b++) {
    let s = 0;
    for (let fr = 0; fr < nFrames; fr++) s += magnitude[b * nFrames + fr];
    avg[b] = s / nFrames;
    if (avg[b] > max) max = avg[b];
  }
  for (let c = 0; c < cols; c++) {
    const hz = (c / (cols - 1)) * maxHz;
    const bin = hz / binHz;
    const b0 = Math.floor(bin);
    const frac = bin - b0;
    const v = b0 + 1 < nBins ? avg[b0] * (1 - frac) + avg[b0 + 1] * frac : (avg[b0] ?? 0);
    out[c] = (v * scale) ** SPECTRUM_COMPRESSION;
  }
  return max;
}

/**
 * Deterministic 32-bit PRNG (mulberry32). Seeded so demo-injected noise or
 * artifacts are identical on every render.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Append an alpha channel to a `#rrggbb` colour, returning an `rgba()` string. */
export function hexA(hex: string, alpha: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** A time signature's beat count, note-value denominator, and derived durations. */
export interface TempoGrid {
  /** Beats in one bar (the time-signature numerator). */
  beatsPerBar: number;
  /** Note value that gets one beat (the time-signature denominator). */
  denominator: number;
  /** Time-signature label, e.g. `"6/8"`. */
  label: string;
  /** Seconds per beat — a note of value 1/denominator. */
  secPerBeat: number;
  /** Seconds per bar. */
  secPerBar: number;
  /** Seconds per quarter note — the unit MIDI ticks (PPQ) divide. */
  secPerQuarter: number;
}

/** Time signatures the tempo-grid demo offers, keyed by its `beats` select value. */
const TIME_SIGNATURES: Record<string, { beatsPerBar: number; denominator: number }> = {
  '3': { beatsPerBar: 3, denominator: 4 }, // 3/4
  '4': { beatsPerBar: 4, denominator: 4 }, // 4/4
  '6': { beatsPerBar: 6, denominator: 8 }, // 6/8 — six eighth-note beats
};

/**
 * Derive a bar/beat grid from a tempo and a time-signature selection.
 *
 * BPM counts quarter notes, so a beat's duration scales with the denominator: an
 * eighth-note beat (6/8) is half a quarter-note beat (4/4). Ticks stay tied to the
 * quarter note (PPQ), independent of the denominator.
 */
export function tempoGrid(bpm: number, beats: string | number): TempoGrid {
  const sig = TIME_SIGNATURES[String(beats)] ?? {
    beatsPerBar: Number(beats) || 4,
    denominator: 4,
  };
  const secPerQuarter = 60 / bpm;
  const secPerBeat = secPerQuarter * (4 / sig.denominator);
  return {
    beatsPerBar: sig.beatsPerBar,
    denominator: sig.denominator,
    label: `${sig.beatsPerBar}/${sig.denominator}`,
    secPerBeat,
    secPerBar: secPerBeat * sig.beatsPerBar,
    secPerQuarter,
  };
}
