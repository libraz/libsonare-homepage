/**
 * Seed-robust comparison metrics for the A/B tuner scope, ported from the
 * parity harness (`tests/tuner/parity.test.ts`). The physical-model cores are
 * noise/seed excited, so a raw sample-difference is meaningless; the honest
 * measures are the log spectral envelope and the RMS (energy) envelope, which
 * track the same "is this the same instrument" signal the parity tests assert.
 */

/** In-place iterative radix-2 FFT (re/im length must be a power of two). */
function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; ++i) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curRe = 1;
      let curIm = 0;
      for (let k = 0; k < len >> 1; ++k) {
        const uRe = re[i + k];
        const uIm = im[i + k];
        const vRe = re[i + k + (len >> 1)] * curRe - im[i + k + (len >> 1)] * curIm;
        const vIm = re[i + k + (len >> 1)] * curIm + im[i + k + (len >> 1)] * curRe;
        re[i + k] = uRe + vRe;
        im[i + k] = uIm + vIm;
        re[i + k + (len >> 1)] = uRe - vRe;
        im[i + k + (len >> 1)] = uIm - vIm;
        const nRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nRe;
      }
    }
  }
}

/**
 * Seed-robust log spectral envelope: Hann-windowed FFT of an N-sample segment,
 * magnitudes accumulated into log-spaced bands from 80 Hz to 16 kHz.
 */
export function spectralEnvelope(
  buf: Float32Array,
  from: number,
  sampleRate: number,
  n = 16384,
): number[] {
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  const avail = Math.min(n, buf.length - from);
  for (let i = 0; i < avail; ++i) {
    const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
    re[i] = buf[from + i] * w;
  }
  fft(re, im);
  const bands = 28;
  const fLo = 80;
  const fHi = 16000;
  const energy = new Float64Array(bands);
  const half = n >> 1;
  for (let k = 1; k < half; ++k) {
    const f = (k * sampleRate) / n;
    if (f < fLo || f > fHi) continue;
    const b = Math.min(bands - 1, Math.floor((bands * Math.log(f / fLo)) / Math.log(fHi / fLo)));
    energy[b] += Math.sqrt(re[k] * re[k] + im[k] * im[k]);
  }
  return Array.from(energy, (e) => Math.log(e + 1e-9));
}

/** Coarse RMS envelope (one value per `hop` samples). */
export function rmsEnvelope(buf: Float32Array, hop: number): number[] {
  const out: number[] = [];
  for (let i = 0; i + hop <= buf.length; i += hop) {
    let s = 0;
    for (let j = i; j < i + hop; ++j) s += buf[j] * buf[j];
    out.push(Math.sqrt(s / hop));
  }
  return out;
}

/** Pearson correlation of two vectors. */
export function correlation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  let ma = 0;
  let mb = 0;
  for (let i = 0; i < n; ++i) {
    ma += a[i];
    mb += b[i];
  }
  ma /= n;
  mb /= n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; ++i) {
    const xa = a[i] - ma;
    const xb = b[i] - mb;
    num += xa * xb;
    da += xa * xa;
    db += xb * xb;
  }
  return da > 0 && db > 0 ? num / Math.sqrt(da * db) : 0;
}

/** Per-column peak envelope (max abs per bucket) for waveform display. */
export function peakEnvelope(buf: Float32Array, columns: number): Float32Array {
  const out = new Float32Array(columns);
  if (buf.length === 0) return out;
  const per = buf.length / columns;
  for (let c = 0; c < columns; ++c) {
    const start = Math.floor(c * per);
    const end = Math.min(buf.length, Math.floor((c + 1) * per));
    let peak = 0;
    for (let i = start; i < end; ++i) {
      const a = Math.abs(buf[i]);
      if (a > peak) peak = a;
    }
    out[c] = peak;
  }
  return out;
}

export interface CompareMetrics {
  /** Relative RMS-envelope error in percent (0 = identical energy contour). */
  rmsErrorPct: number;
  /** Spectral-envelope similarity in percent (100 = identical timbre). */
  specSimPct: number;
}

/**
 * Compare the adjusted render against a target (oracle or original). Both are
 * assumed aligned at note-on (frame 0) and rendered at the same sample rate.
 */
export function computeMetrics(
  adjusted: Float32Array,
  target: Float32Array,
  sampleRate: number,
): CompareMetrics {
  // Spectral similarity over a mid window, past the initial transient.
  const from = Math.min(
    Math.floor(sampleRate * 0.06),
    Math.max(0, Math.min(adjusted.length, target.length) - 16384),
  );
  const specCorr = correlation(
    spectralEnvelope(adjusted, from, sampleRate),
    spectralEnvelope(target, from, sampleRate),
  );
  const specSimPct = Math.max(0, Math.min(100, specCorr * 100));

  // Relative L2 error of the energy contour (seed-robust, unlike raw samples).
  const hop = 512;
  const adjEnv = rmsEnvelope(adjusted, hop);
  const tgtEnv = rmsEnvelope(target, hop);
  const n = Math.min(adjEnv.length, tgtEnv.length);
  let errSq = 0;
  let refSq = 0;
  for (let i = 0; i < n; ++i) {
    const d = adjEnv[i] - tgtEnv[i];
    errSq += d * d;
    refSq += tgtEnv[i] * tgtEnv[i];
  }
  const rmsErrorPct = refSq > 0 ? Math.min(999, Math.sqrt(errSq / refSq) * 100) : 0;

  return { rmsErrorPct, specSimPct };
}
