/**
 * The shoebox room the room demos share: one size value mapped to dimensions and
 * a fixed source/listener placement, synthesized by `synthesizeRir`, plus the
 * short clap the demos audition through it.
 */

type WasmModule = typeof import('@/wasm/index');

function shoebox(size: number) {
  const lengthM = size;
  const widthM = size * 0.72;
  const heightM = Math.min(6, Math.max(2.4, size * 0.42));
  return { lengthM, widthM, heightM };
}

/** Sabine RT60 estimate for the shoebox, in seconds (used to size the render). */
export function shoeboxSabineSec(size: number, absorption: number): number {
  const { lengthM, widthM, heightM } = shoebox(size);
  const volume = lengthM * widthM * heightM;
  const surface = 2 * (lengthM * widthM + lengthM * heightM + widthM * heightM);
  return (0.161 * volume) / Math.max(0.01, surface * absorption);
}

/** Synthesize the mono RIR of the shoebox for `size` metres at 48 kHz. */
export function synthesizeShoeboxRir(
  wasm: WasmModule,
  size: number,
  absorption: number,
  maxSeconds: number,
): { rir: Float32Array; sampleRate: number } {
  const { lengthM, widthM, heightM } = shoebox(size);
  const r = wasm.synthesizeRir({
    lengthM,
    widthM,
    heightM,
    absorption,
    sourceX: lengthM * 0.28,
    sourceY: widthM * 0.3,
    sourceZ: 1.3,
    listenerX: lengthM * 0.68,
    listenerY: widthM * 0.62,
    listenerZ: 1.3,
    sampleRate: 48000,
    maxSeconds,
  });
  return { rir: r.rir, sampleRate: r.sampleRate };
}

/** Convolve a brief synthesized clap with `rir`; peak-normalized to 0.75 for play. */
export function clapThroughRir(rir: Float32Array, sr: number): Float32Array {
  const bn = Math.round(sr * 0.006);
  const burst = new Float32Array(bn);
  let s = 0x9e3779b9 >>> 0;
  const rand = (): number => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = 0; i < bn; i++) burst[i] = (rand() * 2 - 1) * (1 - i / bn);

  const out = new Float32Array(rir.length + bn - 1);
  for (let i = 0; i < bn; i++) {
    const b = burst[i];
    if (Math.abs(b) < 1e-5) continue;
    for (let j = 0; j < rir.length; j++) out[i + j] += b * rir[j];
  }
  let pk = 1e-6;
  for (let i = 0; i < out.length; i++) pk = Math.max(pk, Math.abs(out[i]));
  const g = 0.75 / pk;
  for (let i = 0; i < out.length; i++) out[i] *= g;
  return out;
}
