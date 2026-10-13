/**
 * A voice keying `dynamics.sidechainRouter` on a music bed, rendered by a `Mixer`.
 *
 * The scene is the shape of the `commentaryDucking` preset cut to two strips: a
 * `host` voice and a `bed` whose post-fader sidechain router is keyed to `host`.
 * The master is a plain sum, so the ducked bed is recovered exactly by rendering
 * three times — with the duck, without it, and the bed alone — and taking
 * `withDuck − withoutDuck + bedAlone`. Gain reduction is that bed over the
 * unducked bed, per short window.
 */

type WasmModule = typeof import('@/wasm/index');

export interface DuckParams {
  thresholdDb: number;
  ratio: number;
  attackMs: number;
  releaseMs: number;
  rangeDb: number;
}

/** Talk spans in seconds: three phrases split by short word gaps, a pause, then two more. */
export const DUCK_PHRASES: ReadonlyArray<readonly [number, number]> = [
  [0.3, 1.0],
  [1.15, 1.8],
  [1.95, 2.6],
  [3.4, 4.1],
  [4.25, 4.75],
];
export const DUCK_WINDOW_SEC = 0.01;
const VOICE_GAIN = 0.35;
const BED_FADER_DB = -6;
const BLOCK = 512;

/** Gate the voice clip into the phrase pattern, over the bed's length. */
export function buildDuckKey(
  voice: Float32Array,
  length: number,
  sampleRate: number,
): Float32Array {
  const key = new Float32Array(length);
  const fade = Math.round(0.01 * sampleRate);
  for (const [a, b] of DUCK_PHRASES) {
    const s = Math.round(a * sampleRate);
    const e = Math.min(length, Math.round(b * sampleRate));
    for (let i = s; i < e; i++) {
      const g = Math.min(1, (i - s) / fade, (e - i) / fade);
      key[i] = VOICE_GAIN * g * voice[i % voice.length];
    }
  }
  return key;
}

function scene(params: DuckParams | null): string {
  return JSON.stringify({
    version: 1,
    strips: [
      { id: 'host', faderDb: 0, pan: 0, width: 1, metering: { enabled: false } },
      {
        id: 'bed',
        faderDb: BED_FADER_DB,
        pan: 0,
        width: 1,
        metering: { enabled: false },
        inserts: params
          ? [{ processor: 'dynamics.sidechainRouter', slot: 'post', sidechainKey: 'host', params }]
          : [],
      },
    ],
    buses: [{ id: 'master', role: 'master' }],
    connections: [
      { source: 'host', destination: 'master' },
      { source: 'bed', destination: 'master' },
    ],
  });
}

function render(
  wasm: WasmModule,
  json: string,
  key: Float32Array,
  bed: Float32Array,
  sampleRate: number,
): Float32Array {
  const n = bed.length;
  const out = new Float32Array(n);
  const mixer = wasm.Mixer.fromSceneJson(json, sampleRate, BLOCK);
  try {
    const h = new Float32Array(BLOCK);
    const b = new Float32Array(BLOCK);
    for (let s = 0; s < n; s += BLOCK) {
      const len = Math.min(BLOCK, n - s);
      h.fill(0);
      b.fill(0);
      h.set(key.subarray(s, s + len));
      b.set(bed.subarray(s, s + len));
      out.set(mixer.processStereo([h, b], [h, b]).left.subarray(0, len), s);
    }
  } finally {
    mixer.delete();
  }
  return out;
}

export interface DuckRun {
  /** Host plus ducked bed, the master as rendered. */
  mix: Float32Array;
  sampleRate: number;
  /** Per-window RMS in dBFS of the key, the unducked bed and the ducked bed. */
  keyDb: Float32Array;
  bedDb: Float32Array;
  duckedDb: Float32Array;
  /** Per-window ducked-over-unducked bed level in dB (0 or below). */
  gainReductionDb: Float32Array;
}

function windowRmsDb(x: Float32Array, win: number, count: number): Float32Array {
  const out = new Float32Array(count);
  for (let w = 0; w < count; w++) {
    let acc = 0;
    for (let i = w * win; i < (w + 1) * win; i++) acc += x[i] * x[i];
    out[w] = 10 * Math.log10(Math.max(1e-12, acc / win));
  }
  return out;
}

/** Render the duck with `params` and measure it against the unducked bed. */
export function runDuck(
  wasm: WasmModule,
  key: Float32Array,
  bed: Float32Array,
  sampleRate: number,
  params: DuckParams,
): DuckRun {
  const silent = new Float32Array(bed.length);
  const mix = render(wasm, scene(params), key, bed, sampleRate);
  const unducked = render(wasm, scene(null), key, bed, sampleRate);
  const bedAlone = render(wasm, scene(null), silent, bed, sampleRate);
  const ducked = new Float32Array(bed.length);
  for (let i = 0; i < ducked.length; i++) ducked[i] = mix[i] - unducked[i] + bedAlone[i];

  const win = Math.round(DUCK_WINDOW_SEC * sampleRate);
  const count = Math.floor(bed.length / win);
  const bedDb = windowRmsDb(bedAlone, win, count);
  const duckedDb = windowRmsDb(ducked, win, count);
  const gainReductionDb = new Float32Array(count);
  for (let w = 0; w < count; w++) {
    gainReductionDb[w] = bedDb[w] > -80 ? Math.min(0, duckedDb[w] - bedDb[w]) : 0;
  }
  return {
    mix,
    sampleRate,
    keyDb: windowRmsDb(key, win, count),
    bedDb,
    duckedDb,
    gainReductionDb,
  };
}

export interface DuckSummary {
  /** Mean gain reduction inside the phrases, 50 ms in from each edge. */
  underVoiceDb: number;
  /** Shallowest gain reduction reached in the short gaps between phrases (the pumping). */
  inGapsDb: number;
}

/** Summarize a run over {@link DUCK_PHRASES}: depth under the voice, recovery in word gaps. */
export function duckSummary(run: DuckRun): DuckSummary {
  const at = (t: number) => Math.round(t / DUCK_WINDOW_SEC);
  const gr = run.gainReductionDb;
  let sum = 0;
  let count = 0;
  let inGaps = Number.NEGATIVE_INFINITY;
  for (let p = 0; p < DUCK_PHRASES.length; p++) {
    const [a, b] = DUCK_PHRASES[p];
    for (let w = at(a + 0.05); w < at(b - 0.05); w++) {
      sum += gr[w];
      count++;
    }
    const next = DUCK_PHRASES[p + 1];
    if (next && next[0] - b < 0.3) {
      for (let w = at(b); w < at(next[0]); w++) inGaps = Math.max(inGaps, gr[w]);
    }
  }
  return {
    underVoiceDb: count > 0 ? sum / count : 0,
    inGapsDb: Number.isFinite(inGaps) ? inGaps : 0,
  };
}
