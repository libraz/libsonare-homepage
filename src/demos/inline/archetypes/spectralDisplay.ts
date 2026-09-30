/**
 * Convert raw FFT magnitudes into a display scale relative to a reference peak.
 *
 * The core STFT returns the magnitude of the unnormalised FFT. Those values are
 * an implementation scale, not dBFS, so a heatmap must choose its reference
 * explicitly before mapping it to colour. A reference peak of the full mix lets
 * HPSS layers retain their relative attenuation while still keeping the display
 * readable.
 */
export function magnitudePeak(values: ArrayLike<number>): number {
  let peak = 0;
  for (let i = 0; i < values.length; i++) {
    const value = values[i] ?? 0;
    if (Number.isFinite(value)) peak = Math.max(peak, Math.abs(value));
  }
  return peak;
}

/**
 * Map magnitudes to a 0..1 colour scale using relative dB below a peak.
 * `floorDb` is a relative floor (normally -90 dB), never a dBFS claim.
 */
export function normalizeMagnitudeRelativeDb(
  values: ArrayLike<number>,
  referencePeak = magnitudePeak(values),
  floorDb = -90,
): Float32Array {
  const normalized = new Float32Array(values.length);
  if (!Number.isFinite(referencePeak) || referencePeak <= 0 || !Number.isFinite(floorDb)) {
    return normalized;
  }

  const floor = Math.min(-1e-6, floorDb);
  const floorRatio = 10 ** (floor / 20);
  for (let i = 0; i < values.length; i++) {
    const value = values[i] ?? 0;
    const ratio = Number.isFinite(value) ? Math.max(0, value) / referencePeak : 0;
    const relativeDb = ratio > 0 ? 20 * Math.log10(Math.max(ratio, floorRatio)) : floor;
    normalized[i] = Math.max(0, Math.min(1, (relativeDb - floor) / -floor));
  }
  return normalized;
}
