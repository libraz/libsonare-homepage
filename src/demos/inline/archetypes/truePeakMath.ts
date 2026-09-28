export interface TruePeakSampleModel {
  phases: number[];
  values: number[];
  samplePeak: number;
  continuousPeak: number;
  truePeakDb: number;
  positivePeak: number;
  negativePeak: number;
}

/** The fixed rate used by the true-peak visual and its audition buffer. */
export const TRUE_PEAK_SAMPLE_RATE = 44_100;

const TRUE_PEAK_DURATION_SECONDS = 1.4;
const TRUE_PEAK_FADE_SAMPLES = 600;

function truePeakSampleCount(sampleRate: number): number {
  return Math.max(1, Math.round(sampleRate * TRUE_PEAK_DURATION_SECONDS));
}

function finiteToneContinuousPeak(
  samplePeakDb: number,
  nyquistFraction: number,
  sampleRate: number,
): number {
  const targetSamplePeak = 10 ** (samplePeakDb / 20);
  const phaseStep = Math.PI * nyquistFraction;
  const sampleCount = truePeakSampleCount(sampleRate);
  let rawPeak = 0;
  for (let i = 0; i < sampleCount; i++) {
    const env = Math.min(
      1,
      i / TRUE_PEAK_FADE_SAMPLES,
      (sampleCount - 1 - i) / TRUE_PEAK_FADE_SAMPLES,
    );
    rawPeak = Math.max(rawPeak, Math.abs(env * Math.cos(phaseStep / 2 + i * phaseStep)));
  }
  return targetSamplePeak / Math.max(1e-6, rawPeak);
}

export interface TruePeakAudio {
  samples: Float32Array;
  sampleRate: number;
  /** The generated tone frequency, in Hz. */
  frequencyHz: number;
  /** Phase of sample zero relative to the cosine crest in the visual. */
  phaseRad: number;
  /** Peak of the stored PCM, in linear amplitude. */
  samplePeak: number;
  /** Continuous cosine peak before the output fade, in linear amplitude. */
  continuousPeak: number;
  truePeakDb: number;
}

/** Convert the UI's Nyquist fraction to the frequency used by the oscillator. */
export function truePeakFrequencyHz(
  nyquistFraction: number,
  sampleRate = TRUE_PEAK_SAMPLE_RATE,
): number {
  return (sampleRate * nyquistFraction) / 2;
}

/**
 * Build the exact PCM sent to the browser's AudioBufferSourceNode.
 *
 * The visual places the continuous cosine crest halfway between two samples.
 * Sample zero therefore starts at +half a sample of phase. A short linear fade
 * avoids a click, and the generated finite buffer is peak-normalized afterwards
 * so the stored sample peak remains the level selected in the control.
 */
export function buildTruePeakAudio(
  samplePeakDb: number,
  nyquistFraction: number,
  sampleRate = TRUE_PEAK_SAMPLE_RATE,
): TruePeakAudio {
  const phaseStep = Math.PI * nyquistFraction;
  const frequencyHz = truePeakFrequencyHz(nyquistFraction, sampleRate);
  const phaseRad = phaseStep / 2;
  const sampleCount = truePeakSampleCount(sampleRate);
  const raw = new Float32Array(sampleCount);

  for (let i = 0; i < sampleCount; i++) {
    const env = Math.min(
      1,
      i / TRUE_PEAK_FADE_SAMPLES,
      (sampleCount - 1 - i) / TRUE_PEAK_FADE_SAMPLES,
    );
    const value = env * Math.cos(phaseRad + i * phaseStep);
    raw[i] = value;
  }

  const continuousPeak = finiteToneContinuousPeak(samplePeakDb, nyquistFraction, sampleRate);
  const samples = new Float32Array(sampleCount);
  let samplePeak = 0;
  for (let i = 0; i < sampleCount; i++) {
    samples[i] = raw[i] * continuousPeak;
    samplePeak = Math.max(samplePeak, Math.abs(samples[i]));
  }

  return {
    samples,
    sampleRate,
    frequencyHz,
    phaseRad,
    samplePeak,
    continuousPeak,
    truePeakDb: 20 * Math.log10(continuousPeak),
  };
}

/** Build the displayed sample column using the same finite-tone normalization
 * as the audition. This avoids assuming that the two dots nearest the centre
 * are also the largest dots elsewhere in the finite PCM. */
export function buildTruePeakSampleModel(
  samplePeakDb: number,
  nyquistFraction: number,
  cycles = 2.4,
): TruePeakSampleModel {
  const phaseStep = Math.PI * nyquistFraction;
  const halfSpan = cycles * Math.PI;
  const phases: number[] = [];
  const raw: number[] = [];
  for (let k = -200; k <= 200; k++) {
    const phase = (k + 0.5) * phaseStep;
    if (Math.abs(phase) > halfSpan) continue;
    phases.push(phase);
    raw.push(Math.cos(phase));
  }
  const continuousPeak = finiteToneContinuousPeak(
    samplePeakDb,
    nyquistFraction,
    TRUE_PEAK_SAMPLE_RATE,
  );
  const values = raw.map((value) => value * continuousPeak);
  return {
    phases,
    values,
    samplePeak: Math.max(...values.map((value) => Math.abs(value))),
    continuousPeak,
    truePeakDb: 20 * Math.log10(continuousPeak),
    positivePeak: Math.max(...values),
    negativePeak: Math.min(...values),
  };
}
