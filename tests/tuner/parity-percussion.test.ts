// @vitest-environment node
/**
 * Percussion parity harness: renders the same drum strike through the real
 * libsonare WASM core (offline bounce) and through the TS percussion port,
 * then asserts matching spectral and decay envelopes.
 *
 * Fixture: the GM drum kit's TOM (drum key 47), the most membrane-dominant
 * kit piece — a note-tracked circular-membrane bank (full Rayleigh set) with
 * a pitch drop, a modest band-passed noise burst, and a note-tracked shell.
 * The JS `SynthPatch` surface exposes no deep percussion fields and the only
 * percussion preset is the GM kit (the engine default bank is empty, so a
 * `transparentPatch('percussion')` bounce is silent); the kit piece params are
 * transcribed 1:1 from `gm_fallback_map.cpp` and the piece's percussive
 * DAHDSR amp stage (attack 0.5 ms, decay 400 ms to zero) is mirrored inline.
 * The noise layer stays ON for both sides: it is seeded from the same
 * (voice 0, note, age 0) stream, so it is deterministic, not stochastic.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import {
  defaultPercussionParams,
  type PercussionPatchParams,
  PercussionVoiceCore,
} from '@/tuner/dsp/percussion-voice';
import { voiceSeed } from '@/tuner/dsp/voice-random';

const SR = 48000;

let wasm: any;

beforeAll(async () => {
  wasm = await import('@/wasm/index.js');
  await wasm.init();
});

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

// ---- fixture --------------------------------------------------------------

/** GM kit tom piece (`d.tom` in gm_fallback_map.cpp), 1:1 transcription. */
function tomParams(): PercussionPatchParams {
  const p = defaultPercussionParams();
  p.numModes = 5;
  p.modeDecayS = 0.3;
  p.pitchDrop = 0.6;
  p.pitchDropMs = 55;
  p.noiseGain = 0.25;
  p.noiseDecayMs = 30;
  p.noiseCutoffHz = 1500;
  p.strikeR = 0.6;
  p.shellMix = 0.25;
  p.shellNumModes = 2;
  p.shellFreqHz = [0, 330, 0, 0];
  p.shellT60S = [0.12, 0.06, 0.005, 0.005];
  p.shellWeight = [1, 0.4, 0, 0];
  return p;
}

/**
 * The tom piece's percussive DAHDSR amp stage (`env(0.5, 400, 0, 120)`),
 * mirroring the C++ `DahdsrEnvelope`: a one-pole attack overshooting toward
 * 1.3 that crosses 1.0 in attack_ms, then a one-pole decay toward zero with
 * tau = decay_ms / 3, ending at the -60 dB floor.
 */
function dahdsrPercussiveEnv(attackMs: number, decayMs: number): () => number {
  const attackTarget = 1.3;
  const attackTauScale = Math.log(attackTarget / (attackTarget - 1));
  const rate = (timeMs: number) => 1 - Math.exp(-1 / Math.max((timeMs / 1000) * SR, 1));
  const attackRate = rate(attackMs / attackTauScale);
  const decayRate = rate(decayMs / 3);
  let level = 0;
  let stage: 'attack' | 'decay' | 'idle' = 'attack';
  return () => {
    if (stage === 'attack') {
      level += attackRate * (attackTarget - level);
      if (level >= 1) {
        level = 1;
        stage = 'decay';
      }
    } else if (stage === 'decay') {
      level += decayRate * (0 - level);
      if (level <= 1e-3) {
        level = 0;
        stage = 'idle';
      }
    }
    return level;
  };
}

function renderPort(note: number, velocity: number, frames: number): Float32Array {
  const core = new PercussionVoiceCore(SR);
  core.start(tomParams(), SR, note, velocity, voiceSeed(0, note, 0n));
  const env = dahdsrPercussiveEnv(0.5, 400);
  const out = new Float32Array(frames);
  for (let i = 0; i < frames; ++i) out[i] = core.render(1) * env();
  return out;
}

describe('Percussion parity vs WASM core (GM kit tom)', () => {
  it('matches spectral envelope and decay', () => {
    const note = 47; // GM drum key 47 = low-mid tom, note-tracked membrane (~123.5 Hz)
    const seconds = 1.0;
    const ref = bounceWasm(wasm.synthPresetPatch('drum-kit'), note, 100, seconds);
    const port = renderPort(note, 100, Math.round(SR * seconds));
    const m = report('percussion', ref, port, 1500);
    expect(m.refPeak).toBeGreaterThan(0.005);
    expect(m.specCorr).toBeGreaterThan(0.8);
    expect(m.envCorr).toBeGreaterThan(0.8);
  });
});
