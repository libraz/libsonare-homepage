// @vitest-environment node
/**
 * Parity harness for the brass (lip-reed) core: renders a sustained note through
 * the real libsonare WASM core (offline bounce) and through the TS port with the
 * same deep params, then asserts they are the SAME instrument over a steady-state
 * window (a seed-robust spectral envelope). Brass SUSTAINS, so only the spectral
 * envelope is asserted; the RMS-envelope correlation is logged for diagnostics.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { BrassVoiceCore, defaultBrassParams } from '@/tuner/dsp/brass-voice';
import { voiceSeed } from '@/tuner/dsp/voice-random';

const SR = 48000;

let wasm: any;

beforeAll(async () => {
  wasm = await import('@/wasm/index.js');
  await wasm.init();
});

/** A wrapper that leaves the exciter core as bare as possible. */
function transparentPatch(engineMode: string) {
  return {
    engineMode,
    unison: 1,
    detuneCents: 0,
    driftCents: 0,
    drive: 0,
    cutoffHz: 20000,
    resonanceQ: 0.5,
    ampAttackMs: 1,
    ampDecayMs: 100000,
    ampSustain: 1,
    ampReleaseMs: 60,
    body: 'none',
    bodyMix: 0,
    stereoSpread: 0,
    gain: 1,
    polyphony: 1,
    busDrive: 0,
  };
}

/** Bounce one sustained note through a full patch object to mono PCM. */
function bounceWasm(patch: object, note: number, velocity: number, seconds: number): Float32Array {
  const project = new wasm.Project();
  try {
    project.setSampleRate(SR);
    const { clipId } = project.addMidiClip(0, 8);
    project.setMidiEvents(clipId, [
      wasm.Project.midiNoteOn(0, 0, 0, note, velocity),
      wasm.Project.midiNoteOff(6, 0, 0, note, 0),
    ]);
    return project.bounceWithSynthInstrument(patch, {
      numChannels: 1,
      sampleRate: SR,
      totalFrames: Math.round(SR * seconds),
    });
  } finally {
    project.delete();
  }
}

// ---- metrics --------------------------------------------------------------

/** In-place iterative radix-2 FFT (re/im length must be a power of two). */
function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; ++i) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curRe = 1;
      let curIm = 0;
      for (let k = 0; k < len >> 1; ++k) {
        const uRe = re[i + k];
        const uIm = im[i + k];
        const vRe = re[i + k + (len >> 1)] * curRe - im[i + k + (len >> 1)] * curIm;
        const vIm = re[i + k + (len >> 1)] * curIm + im[i + k + (len >> 1)] * curRe;
        re[i + k] = uRe + vRe;
        im[i + k] = uIm + vIm;
        re[i + k + (len >> 1)] = uRe - vRe;
        im[i + k + (len >> 1)] = uIm - vIm;
        const nRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nRe;
      }
    }
  }
}

/**
 * Seed-robust log spectral envelope: Hann-windowed FFT of an N-sample segment,
 * magnitudes accumulated into log-spaced bands from 80 Hz to 16 kHz.
 */
function spectralEnvelope(buf: Float32Array, from: number, n = 16384): number[] {
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  const avail = Math.min(n, buf.length - from);
  for (let i = 0; i < avail; ++i) {
    const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
    re[i] = buf[from + i] * w;
  }
  fft(re, im);
  const bands = 28;
  const fLo = 80;
  const fHi = 16000;
  const energy = new Float64Array(bands);
  const half = n >> 1;
  for (let k = 1; k < half; ++k) {
    const f = (k * SR) / n;
    if (f < fLo || f > fHi) continue;
    const b = Math.min(bands - 1, Math.floor((bands * Math.log(f / fLo)) / Math.log(fHi / fLo)));
    energy[b] += Math.sqrt(re[k] * re[k] + im[k] * im[k]);
  }
  return Array.from(energy, (e) => Math.log(e + 1e-9));
}

/** Coarse RMS envelope (one value per `hop` samples). */
function rmsEnvelope(buf: Float32Array, hop: number): number[] {
  const out: number[] = [];
  for (let i = 0; i + hop <= buf.length; i += hop) {
    let s = 0;
    for (let j = i; j < i + hop; ++j) s += buf[j] * buf[j];
    out.push(Math.sqrt(s / hop));
  }
  return out;
}

/** Pearson correlation of two vectors. */
function correlation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let ma = 0;
  let mb = 0;
  for (let i = 0; i < n; ++i) {
    ma += a[i];
    mb += b[i];
  }
  ma /= n;
  mb /= n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; ++i) {
    const xa = a[i] - ma;
    const xb = b[i] - mb;
    num += xa * xb;
    da += xa * xa;
    db += xb * xb;
  }
  return da > 0 && db > 0 ? num / Math.sqrt(da * db) : 0;
}

/**
 * Drive the TS brass core directly with an inline amp envelope (attack ~5 ms,
 * sustain 1, release ~60 ms), matching the WASM wrapper's amp VCA. The note is
 * never released within the window, so the tone sustains.
 */
function renderPort(
  params: import('@/tuner/dsp/brass-voice').BrassPatchParams,
  note: number,
  velocity: number,
  frames: number,
  seed: bigint,
): Float32Array {
  const core = new BrassVoiceCore(SR);
  core.start(params, SR, note, velocity, seed);
  const attackCoeff = 1 - Math.exp(-1 / (0.005 * SR));
  const out = new Float32Array(frames);
  let env = 0;
  for (let i = 0; i < frames; ++i) {
    env += attackCoeff * (1 - env);
    out[i] = env * core.render(1);
  }
  return out;
}

// ---- fixture --------------------------------------------------------------

describe('Brass parity vs WASM core', () => {
  it('matches spectral envelope over the steady state', () => {
    const note = 57; // A3 = 220 Hz
    const velocity = 100;
    const seconds = 1.0;
    const frames = Math.round(SR * seconds);
    const seed = voiceSeed(0, note, 0n);

    const ref = bounceWasm(transparentPatch('brass'), note, velocity, seconds);
    const port = renderPort(defaultBrassParams(), note, velocity, frames, seed);

    const from = 4000;
    const specCorr = correlation(spectralEnvelope(ref, from), spectralEnvelope(port, from));
    const envCorr = correlation(rmsEnvelope(ref, 512), rmsEnvelope(port, 512));
    const refPeak = Math.max(...Array.from(ref, Math.abs));
    const portPeak = Math.max(...Array.from(port, Math.abs));
    // biome-ignore lint/suspicious/noConsole: parity diagnostics are the point of the harness.
    console.log(
      `[parity brass] specCorr=${specCorr.toFixed(3)} envCorr=${envCorr.toFixed(3)} refPeak=${refPeak.toFixed(3)} portPeak=${portPeak.toFixed(3)}`,
    );

    expect(refPeak).toBeGreaterThan(0.005);
    expect(portPeak).toBeGreaterThan(0.005);
    expect(specCorr).toBeGreaterThan(0.85);
  });
});
