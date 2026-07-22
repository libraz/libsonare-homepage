export interface TruePeakSampleModel {
  phases: number[];
  values: number[];
  samplePeak: number;
  continuousPeak: number;
  truePeakDb: number;
  positivePeak: number;
  negativePeak: number;
}

/** Build the exact finite sample column drawn by the demo, then normalize that
 * column to the requested sample peak. This avoids assuming that the two dots
 * nearest the centre are also the largest dots elsewhere in the panel. */
export function buildTruePeakSampleModel(
  samplePeakDb: number,
  nyquistFraction: number,
  cycles = 2.4,
): TruePeakSampleModel {
  const targetSamplePeak = 10 ** (samplePeakDb / 20);
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
  const rawPeak = Math.max(1e-6, ...raw.map((value) => Math.abs(value)));
  const continuousPeak = targetSamplePeak / rawPeak;
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
