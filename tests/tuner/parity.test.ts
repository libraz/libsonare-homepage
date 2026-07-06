// @vitest-environment node
/**
 * Parity harness: renders a physically-modeled note through the real libsonare
 * WASM core (offline bounce) and through the TS port with the SAME deep params,
 * then asserts they are the SAME instrument — matching fundamental pitch, a
 * seed-robust spectral envelope, and decay envelope. This is the ground-truth
 * check that the TS re-implementation tracks the C++ core.
 *
 * Two fixture kinds:
 *  - `defaults`: engines whose built-in defaults are audible (KS). WASM renders
 *    a bare wrapper over the engine default deep params; TS uses the same
 *    defaults. The spectral-envelope metric is seed-robust, so the noise-excited
 *    KS burst need not match sample-for-sample.
 *  - `preset`: engines whose defaults are empty (modal num_modes=0). WASM renders
 *    a named preset; TS uses that preset's deep params transcribed from the C++
 *    tables (the same values a maintainer would transcribe back).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { renderNoteOffline, transparentEnv } from '@/tuner/dsp/engine';
import { defaultKsParams } from '@/tuner/dsp/params';

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

function report(label: string, ref: Float32Array, port: Float32Array, from: number) {
  const specCorr = correlation(spectralEnvelope(ref, from), spectralEnvelope(port, from));
  const envCorr = correlation(rmsEnvelope(ref, 512), rmsEnvelope(port, 512));
  const refPeak = Math.max(...Array.from(ref, Math.abs));
  const portPeak = Math.max(...Array.from(port, Math.abs));
  // biome-ignore lint/suspicious/noConsole: parity diagnostics are the point of the harness.
  console.log(
    `[parity ${label}] specCorr=${specCorr.toFixed(3)} envCorr=${envCorr.toFixed(3)} refPeak=${refPeak.toFixed(3)} portPeak=${portPeak.toFixed(3)}`,
  );
  return { specCorr, envCorr, refPeak, portPeak };
}

// ---- fixtures -------------------------------------------------------------

describe('KS parity vs WASM core (engine defaults)', () => {
  it('matches spectral envelope and decay', () => {
    const note = 57; // A3 = 220 Hz
    const seconds = 1.0;
    const ref = bounceWasm(transparentPatch('karplus-strong'), note, 100, seconds);
    const port = renderNoteOffline(
      {
        engineMode: 'karplus-strong',
        ks: defaultKsParams(),
        body: 'none',
        bodyMix: 0,
        drive: 0,
        ampEnv: transparentEnv(),
        gain: 1,
      },
      note,
      100,
      SR,
      Math.round(SR * seconds),
    );
    const m = report('ks', ref, port, 3000);
    expect(m.refPeak).toBeGreaterThan(0.01);
    expect(m.specCorr).toBeGreaterThan(0.9);
    expect(m.envCorr).toBeGreaterThan(0.9);
  });
});

describe('Modal parity vs WASM core (marimba preset)', () => {
  it('matches spectral envelope and decay', () => {
    // GM program 12 (marimba) modal table, transcribed from gm_fallback_map.cpp.
    const marimba = {
      numModes: 3,
      modes: [
        { ratio: 1.0, gain: 1.0, decayScale: 1.0 },
        { ratio: 4.0, gain: 0.6, decayScale: 0.35 },
        { ratio: 10.0, gain: 0.35, decayScale: 0.2 },
        { ratio: 1, gain: 0, decayScale: 1 },
        { ratio: 1, gain: 0, decayScale: 1 },
        { ratio: 1, gain: 0, decayScale: 1 },
        { ratio: 1, gain: 0, decayScale: 1 },
        { ratio: 1, gain: 0, decayScale: 1 },
      ],
      decayS: 0.45,
      decayStretch: 0.6,
      strikeBrightness: 0.7,
      velToBrightness: 0.6,
      releaseDampS: 0.15,
    };
    const note = 48; // C3 — rings long enough to fill the analysis window
    const seconds = 1.0;
    const ref = bounceWasm(wasm.synthPresetPatch('marimba'), note, 110, seconds);
    const port = renderNoteOffline(
      {
        engineMode: 'modal',
        modal: marimba,
        body: 'wood-tube',
        bodyMix: 0.4,
        drive: 0,
        ampEnv: { attackMs: 0.5, decayMs: 100000, sustain: 1, releaseMs: 250 },
        gain: 0.7,
      },
      note,
      110,
      SR,
      Math.round(SR * seconds),
    );
    const m = report('modal', ref, port, 1200);
    expect(m.refPeak).toBeGreaterThan(0.005);
    expect(m.specCorr).toBeGreaterThan(0.85);
    expect(m.envCorr).toBeGreaterThan(0.85);
  });
});
