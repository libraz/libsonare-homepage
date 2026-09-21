export const PARAM_SWEEP_BASE_F0 = 220;
export const PARAM_SWEEP_TILT_PIVOT_HZ = 800;
export const PARAM_SWEEP_WAVE_COLS = 420;
export const PARAM_SWEEP_SPEC_COLS = 300;
export const PARAM_SWEEP_SPEC_MAX_HZ = 4500;

export interface ParamSweepWasm {
  stft(
    samples: Float32Array,
    sampleRate: number,
    nFft: number,
    hop: number,
  ): { nBins: number; nFrames: number; magnitude: Float32Array };
}

export function fillParamSweepWavePeaks(samples: Float32Array, out: Float32Array): void {
  const n = samples.length;
  let max = 1e-6;
  for (let c = 0; c < out.length; c++) {
    const start = Math.floor((c / out.length) * n);
    const end = Math.max(start + 1, Math.floor(((c + 1) / out.length) * n));
    let peak = 0;
    for (let i = start; i < end && i < n; i++) {
      const amplitude = Math.abs(samples[i]);
      if (amplitude > peak) peak = amplitude;
    }
    out[c] = peak;
    if (peak > max) max = peak;
  }
  for (let c = 0; c < out.length; c++) out[c] /= max;
}

export function fillParamSweepSpectrum(
  wasm: ParamSweepWasm,
  samples: Float32Array,
  sampleRate: number,
  out: Float32Array,
): void {
  const result = wasm.stft(samples, sampleRate, 2048, 512);
  const { nBins, nFrames, magnitude } = result;
  const binHz = sampleRate / 2048;
  const avg = new Float32Array(nBins);
  let max = 1e-6;
  for (let binIndex = 0; binIndex < nBins; binIndex++) {
    let sum = 0;
    for (let frame = 0; frame < nFrames; frame++) sum += magnitude[binIndex * nFrames + frame];
    avg[binIndex] = sum / nFrames;
    if (avg[binIndex] > max) max = avg[binIndex];
  }
  for (let c = 0; c < out.length; c++) {
    const hz = (c / (out.length - 1)) * PARAM_SWEEP_SPEC_MAX_HZ;
    const bin = hz / binHz;
    const b0 = Math.floor(bin);
    const frac = bin - b0;
    const value = b0 + 1 < nBins ? avg[b0] * (1 - frac) + avg[b0 + 1] * frac : (avg[b0] ?? 0);
    out[c] = (value / max) ** 0.6;
  }
}
