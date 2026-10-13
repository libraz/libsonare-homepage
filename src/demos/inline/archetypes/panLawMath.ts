/**
 * Pan-law curves and pan-sweep audition, both read from a real `Mixer` strip.
 *
 * Gains are measured, not re-derived: a constant L = R block goes through one
 * strip at each pan position (settled, so the 5 ms pan smoother is not in the
 * reading) and the output sample is the gain the strip applied.
 */
import type { StereoAudio } from '@/demos/inline/useSonareDemoAudio';

type WasmModule = typeof import('@/wasm/index');

export const PAN_LAWS = ['const3dB', 'const4.5dB', 'const6dB', 'linear0dB'] as const;
export type PanLawId = (typeof PAN_LAWS)[number];
export const PAN_MODES = ['balance', 'stereoPan'] as const;
export type PanModeId = (typeof PAN_MODES)[number];

/** Left/right gain per pan position, positions evenly spaced over −1…+1. */
export interface PanCurve {
  positions: Float32Array;
  left: Float32Array;
  right: Float32Array;
}

const BLOCK = 256;
const PROBE = 0.5;

function oneStripMixer(wasm: WasmModule, sampleRate: number) {
  const scene = JSON.stringify({
    version: 1,
    strips: [{ id: 'src', faderDb: 0, pan: 0, width: 1, metering: { enabled: false } }],
    buses: [{ id: 'master', role: 'master' }],
    connections: [],
  });
  return wasm.Mixer.fromSceneJson(scene, sampleRate, BLOCK);
}

/** Measure the strip's L/R gains at `points` pan positions for one law and mode. */
export function measurePanCurve(
  wasm: WasmModule,
  law: PanLawId,
  mode: PanModeId,
  points = 41,
  sampleRate = 48_000,
): PanCurve {
  const positions = new Float32Array(points);
  const left = new Float32Array(points);
  const right = new Float32Array(points);
  const probe = new Float32Array(BLOCK).fill(PROBE);
  const mixer = oneStripMixer(wasm, sampleRate);
  try {
    mixer.setPanLaw(0, law);
    for (let i = 0; i < points; i++) {
      const pan = -1 + (2 * i) / (points - 1);
      mixer.setPan(0, pan, mode);
      mixer.settle(0);
      const out = mixer.processStereo([probe], [probe]);
      positions[i] = pan;
      left[i] = Math.max(0, out.left[BLOCK - 1] / PROBE);
      right[i] = Math.max(0, out.right[BLOCK - 1] / PROBE);
    }
  } finally {
    mixer.delete();
  }
  return { positions, left, right };
}

/** Total power of the two channels in dB; a hard pan reads 0 dB. */
export function powerDb(left: number, right: number): number {
  return 10 * Math.log10(Math.max(1e-12, left * left + right * right));
}

/** Coherent mono sum (L + R) in dB; a hard pan reads 0 dB. */
export function monoSumDb(left: number, right: number): number {
  return 20 * Math.log10(Math.max(1e-6, left + right));
}

/**
 * Pan a mono source from hard left to hard right across its length through the
 * strip, moving the pan once per block (the strip's smoother keeps it click-free).
 */
export function renderPanSweep(
  wasm: WasmModule,
  law: PanLawId,
  mode: PanModeId,
  source: Float32Array,
  sampleRate: number,
): StereoAudio {
  const n = source.length;
  const left = new Float32Array(n);
  const right = new Float32Array(n);
  const mixer = oneStripMixer(wasm, sampleRate);
  try {
    mixer.setPanLaw(0, law);
    mixer.setPan(0, -1, mode);
    mixer.settle(0);
    const block = new Float32Array(BLOCK);
    for (let start = 0; start < n; start += BLOCK) {
      const len = Math.min(BLOCK, n - start);
      block.fill(0);
      block.set(source.subarray(start, start + len));
      mixer.setPan(0, -1 + (2 * (start + len / 2)) / n, mode);
      const out = mixer.processStereo([block], [block]);
      left.set(out.left.subarray(0, len), start);
      right.set(out.right.subarray(0, len), start);
    }
  } finally {
    mixer.delete();
  }
  return { left, right, sampleRate };
}
