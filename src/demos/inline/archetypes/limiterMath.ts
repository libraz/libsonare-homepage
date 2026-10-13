/**
 * Drive a clip into `maximizer.truePeakLimiter` and measure what came out.
 *
 * The gain-reduction trace is measured, not modelled: per short window it is the
 * output RMS over the driven input RMS, which the limiter returns time-aligned
 * (its reported latency is already compensated). True peaks are read with the
 * engine's own 4x true-peak meter.
 */

type WasmModule = typeof import('@/wasm/index');

/** The limiter's own default ceiling, in dBTP. */
export const LIMITER_CEILING_DB = -1;
/** Analysis window for the envelopes and gain-reduction trace, in seconds. */
export const LIMITER_WINDOW_SEC = 0.01;
/** Windows quieter than this keep the previous gain reading rather than divide noise by noise. */
const GATE_DB = -60;

export interface LimiterRun {
  /** Driven input and limited output, same length and sample rate as the clip. */
  input: Float32Array;
  output: Float32Array;
  sampleRate: number;
  inputTruePeakDb: number;
  outputTruePeakDb: number;
  inputRmsDb: number;
  outputRmsDb: number;
  /** Per-window peak level in dBFS. */
  inputPeakDb: Float32Array;
  outputPeakDb: Float32Array;
  /** Per-window output/input RMS ratio in dB (0 or below). */
  gainReductionDb: Float32Array;
}

function rmsDb(x: Float32Array, start: number, end: number): number {
  let acc = 0;
  for (let i = start; i < end; i++) acc += x[i] * x[i];
  return 10 * Math.log10(Math.max(1e-20, acc / Math.max(1, end - start)));
}

function peakDb(x: Float32Array, start: number, end: number): number {
  let p = 0;
  for (let i = start; i < end; i++) p = Math.max(p, Math.abs(x[i]));
  return 20 * Math.log10(Math.max(1e-10, p));
}

/** Run the limiter at `driveDb` of input gain into a `ceilingDb` ceiling. */
export function runLimiter(
  wasm: WasmModule,
  samples: Float32Array,
  sampleRate: number,
  driveDb: number,
  ceilingDb = LIMITER_CEILING_DB,
): LimiterRun {
  const g = 10 ** (driveDb / 20);
  const input = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) input[i] = samples[i] * g;
  const output = wasm.masteringProcess('maximizer.truePeakLimiter', input, sampleRate, {
    ceilingDb,
  }).samples;

  const win = Math.max(1, Math.round(LIMITER_WINDOW_SEC * sampleRate));
  const n = Math.floor(input.length / win);
  const inputPeakDb = new Float32Array(n);
  const outputPeakDb = new Float32Array(n);
  const gainReductionDb = new Float32Array(n);
  let last = 0;
  for (let w = 0; w < n; w++) {
    const s = w * win;
    const e = s + win;
    inputPeakDb[w] = peakDb(input, s, e);
    outputPeakDb[w] = peakDb(output, s, e);
    const inRms = rmsDb(input, s, e);
    if (inRms > GATE_DB) last = Math.min(0, rmsDb(output, s, e) - inRms);
    gainReductionDb[w] = last;
  }

  return {
    input,
    output,
    sampleRate,
    inputTruePeakDb: wasm.meteringTruePeakDb(input, sampleRate, 4),
    outputTruePeakDb: wasm.meteringTruePeakDb(output, sampleRate, 4),
    inputRmsDb: rmsDb(input, 0, input.length),
    outputRmsDb: rmsDb(output, 0, output.length),
    inputPeakDb,
    outputPeakDb,
    gainReductionDb,
  };
}
