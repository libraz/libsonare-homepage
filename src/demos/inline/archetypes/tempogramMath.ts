/**
 * Onset envelope → autocorrelation tempogram → reported tempo, for the
 * `tempogram` archetype.
 *
 * Everything runs at 22050 Hz with a 512-sample hop, the rate `analyzeBpm`
 * analyses at. `tempogram` returns one autocorrelation per frame, lag-major
 * (`data[lag * nFrames + frame]`); averaging it over frames gives the global
 * autocorrelation whose peaks are the candidate tempos.
 */

type WasmModule = typeof import('@/wasm/index');

export const TEMPO_SR = 22_050;
export const TEMPO_HOP = 512;
const TEMPO_WIN = 384;
const CLICK_SEC = 8;

/** Tempo of a lag in frames, in BPM. */
export function lagToBpm(lag: number): number {
  return (60 * TEMPO_SR) / (TEMPO_HOP * lag);
}

/** A click track at `bpm`, 8 s long, at {@link TEMPO_SR}. */
export function clickTrack(wasm: WasmModule, bpm: number): Float32Array {
  const times: number[] = [];
  for (let t = 0.1; t < CLICK_SEC - 0.05; t += 60 / bpm) times.push(t);
  return wasm.clicks(new Float32Array(times), TEMPO_SR, Math.round(TEMPO_SR * CLICK_SEC));
}

export interface TempoAnalysis {
  samples: Float32Array;
  /** Per-frame autocorrelation, lag-major. */
  tempogram: Float32Array;
  nFrames: number;
  winLength: number;
  /** Autocorrelation averaged over frames, indexed by lag. */
  globalAc: Float32Array;
  /** What `analyzeBpm` reports, and its confidence. */
  bpm: number;
  confidence: number;
}

/** Analyse `samples` (resampled to {@link TEMPO_SR} if needed). */
export function analyzeTempo(
  wasm: WasmModule,
  samples: Float32Array,
  sampleRate: number,
): TempoAnalysis {
  const x = sampleRate === TEMPO_SR ? samples : wasm.resample(samples, sampleRate, TEMPO_SR);
  const env = wasm.onsetEnvelope(x, TEMPO_SR, 2048, TEMPO_HOP);
  const tg = wasm.tempogram(env, TEMPO_SR, TEMPO_HOP, TEMPO_WIN, 'autocorrelation');
  const globalAc = new Float32Array(tg.winLength);
  for (let lag = 0; lag < tg.winLength; lag++) {
    let acc = 0;
    for (let f = 0; f < tg.nFrames; f++) acc += tg.data[lag * tg.nFrames + f];
    globalAc[lag] = acc / Math.max(1, tg.nFrames);
  }
  const r = wasm.analyzeBpm(x, TEMPO_SR);
  return {
    samples: x,
    tempogram: tg.data,
    nFrames: tg.nFrames,
    winLength: tg.winLength,
    globalAc,
    bpm: r.bpm,
    confidence: r.confidence,
  };
}

/** Linear interpolation of a lag-indexed array at the lag of `bpm`. */
export function valueAtBpm(byLag: ArrayLike<number>, length: number, bpm: number): number {
  const lag = (60 * TEMPO_SR) / (TEMPO_HOP * bpm);
  const i = Math.floor(lag);
  if (i < 1 || i + 1 >= length) return 0;
  const t = lag - i;
  return byLag[i] * (1 - t) + byLag[i + 1] * t;
}

/** Local maxima of the global autocorrelation inside `[minBpm, maxBpm]`, strongest first. */
export function acPeaks(
  a: TempoAnalysis,
  minBpm = 30,
  maxBpm = 300,
): Array<{ bpm: number; value: number }> {
  const out: Array<{ bpm: number; value: number }> = [];
  const ac = a.globalAc;
  for (let lag = 2; lag < ac.length - 1; lag++) {
    const bpm = lagToBpm(lag);
    if (bpm < minBpm || bpm > maxBpm) continue;
    if (ac[lag] > ac[lag - 1] && ac[lag] >= ac[lag + 1]) out.push({ bpm, value: ac[lag] });
  }
  return out.sort((p, q) => q.value - p.value);
}
