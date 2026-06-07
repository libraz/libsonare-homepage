/**
 * In-browser generation of cheap test signals for `source.kind === 'generate'` demos.
 *
 * These are deterministic oscillators / noise — no WASM, no committed asset. WASM is
 * reserved for the *analysis/processing* the demo illustrates, not for producing the
 * test tone itself. Musical material (band/drum/pad/vowel) instead comes from
 * pre-rendered clips under `src/public/demo-clips/`.
 */

import type { DemoSource } from './types';

const TAU = Math.PI * 2;

/** Deterministic value-noise generator (no Math.random — stable across renders). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Render a generated test signal to mono PCM.
 *
 * @param source A `generate` demo source. Passing a `clip` source throws.
 * @returns Mono samples plus the sample rate they were generated at.
 */
export function generateSignal(source: DemoSource): {
  samples: Float32Array;
  sampleRate: number;
} {
  if (source.kind !== 'generate') {
    throw new Error('generateSignal: expected a "generate" source');
  }
  const sampleRate = source.sampleRate ?? 44100;
  const duration = source.duration ?? 2;
  const gain = source.gain ?? 0.6;
  const f0 = source.freq ?? 220;
  const n = Math.max(1, Math.round(sampleRate * duration));
  const out = new Float32Array(n);

  switch (source.signal) {
    case 'sine':
      for (let i = 0; i < n; i++) out[i] = gain * Math.sin((TAU * f0 * i) / sampleRate);
      break;
    case 'saw':
      for (let i = 0; i < n; i++) {
        const phase = ((f0 * i) / sampleRate) % 1;
        out[i] = gain * (2 * phase - 1);
      }
      break;
    case 'square':
      for (let i = 0; i < n; i++) {
        const phase = ((f0 * i) / sampleRate) % 1;
        out[i] = gain * (phase < 0.5 ? 1 : -1);
      }
      break;
    case 'triangle':
      for (let i = 0; i < n; i++) {
        const phase = ((f0 * i) / sampleRate) % 1;
        out[i] = gain * (4 * Math.abs(phase - 0.5) - 1);
      }
      break;
    case 'sweep': {
      // Linear-frequency chirp from freq to freqEnd over the duration.
      const f1 = source.freqEnd ?? Math.min(sampleRate / 2, f0 * 16);
      let phase = 0;
      for (let i = 0; i < n; i++) {
        const t = i / n;
        const f = f0 + (f1 - f0) * t;
        phase += (TAU * f) / sampleRate;
        out[i] = gain * Math.sin(phase);
      }
      break;
    }
    case 'noise': {
      const rng = mulberry32(0x9e3779b9);
      for (let i = 0; i < n; i++) out[i] = gain * (rng() * 2 - 1);
      break;
    }
  }

  // Short fade in/out to avoid clicks on playback.
  const fade = Math.min(Math.round(sampleRate * 0.005), Math.floor(n / 2));
  for (let i = 0; i < fade; i++) {
    const k = i / fade;
    out[i] *= k;
    out[n - 1 - i] *= k;
  }
  return { samples: out, sampleRate };
}
