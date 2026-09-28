/**
 * PCM model for the mono-fold demo.
 *
 * Both channels share one amplitude envelope. The right channel is the same
 * sine wave offset by `phaseRadians`, so the signal being measured and the
 * signal being auditioned are the same finite PCM arrays.
 */

export interface MonoFoldOptions {
  sampleRate: number;
  duration: number;
  frequency: number;
  phaseRadians: number;
  amplitude?: number;
  fadeSeconds?: number;
}

export interface MonoFoldSignal {
  left: Float32Array;
  right: Float32Array;
  mono: Float32Array;
  sampleRate: number;
}

export interface MonoFoldMetrics {
  leftRms: number;
  rightRms: number;
  monoRms: number;
  /** Mono RMS relative to the left-channel RMS, in dB. */
  monoRelativeDb: number;
  /** Pearson correlation of the two finite PCM channels. */
  correlation: number;
}

function rms(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (const sample of samples) sum += sample * sample;
  return Math.sqrt(sum / samples.length);
}

/**
 * Generate the exact PCM pair used by the demo.
 *
 * Mono fold uses the conventional equal-power-neutral arithmetic average,
 * `(L + R) / 2`. At a 90° phase offset that is `cos(45°)` of one channel,
 * which is −3.0103 dB in RMS.
 */
export function buildMonoFoldSignal(options: MonoFoldOptions): MonoFoldSignal {
  const sampleRate = Math.max(1, Math.round(options.sampleRate));
  const length = Math.max(1, Math.round(Math.max(0, options.duration) * sampleRate));
  const frequency = Math.max(0, options.frequency);
  const phase = options.phaseRadians;
  const amplitude = Number.isFinite(options.amplitude)
    ? Math.max(0, options.amplitude ?? 0.7)
    : 0.7;
  const fadeSamples = Math.min(
    Math.floor(length / 2),
    Math.max(0, Math.round(Math.max(0, options.fadeSeconds ?? 0.05) * sampleRate)),
  );
  const left = new Float32Array(length);
  const right = new Float32Array(length);
  const mono = new Float32Array(length);
  const angularFrequency = (2 * Math.PI * frequency) / sampleRate;
  const exactAntiphase = Math.abs(phase - Math.PI) < 1e-12;

  for (let i = 0; i < length; i++) {
    const envelope =
      fadeSamples > 0 ? Math.min(1, i / fadeSamples, (length - 1 - i) / fadeSamples) : 1;
    const l = amplitude * Math.max(0, envelope) * Math.sin(angularFrequency * i);
    // The exact branch keeps the 180° control at true sample cancellation,
    // rather than leaving floating-point residue in an otherwise silent fold.
    const r = exactAntiphase
      ? -l
      : amplitude * Math.max(0, envelope) * Math.sin(angularFrequency * i + phase);
    left[i] = l;
    right[i] = r;
    mono[i] = (l + r) * 0.5;
  }

  return { left, right, mono, sampleRate };
}

/** Correlation of two finite PCM arrays, with their DC means removed. */
export function pcmCorrelation(left: Float32Array, right: Float32Array): number {
  const length = Math.min(left.length, right.length);
  if (length === 0) return 0;

  let leftMean = 0;
  let rightMean = 0;
  for (let i = 0; i < length; i++) {
    leftMean += left[i];
    rightMean += right[i];
  }
  leftMean /= length;
  rightMean /= length;

  let numerator = 0;
  let leftEnergy = 0;
  let rightEnergy = 0;
  for (let i = 0; i < length; i++) {
    const l = left[i] - leftMean;
    const r = right[i] - rightMean;
    numerator += l * r;
    leftEnergy += l * l;
    rightEnergy += r * r;
  }
  const denominator = Math.sqrt(leftEnergy * rightEnergy);
  if (!(denominator > 0)) return 0;
  return Math.max(-1, Math.min(1, numerator / denominator));
}

export function measureMonoFold(signal: MonoFoldSignal): MonoFoldMetrics {
  const leftRms = rms(signal.left);
  const rightRms = rms(signal.right);
  const monoRms = rms(signal.mono);
  const ratio = leftRms > 0 ? monoRms / leftRms : 0;
  return {
    leftRms,
    rightRms,
    monoRms,
    monoRelativeDb: ratio > 0 ? 20 * Math.log10(ratio) : Number.NEGATIVE_INFINITY,
    correlation: pcmCorrelation(signal.left, signal.right),
  };
}
