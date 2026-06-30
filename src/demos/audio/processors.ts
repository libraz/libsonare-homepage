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
