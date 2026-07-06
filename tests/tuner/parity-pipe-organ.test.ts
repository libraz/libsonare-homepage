// @vitest-environment node
/**
 * Parity harness for the pipe-organ (self-oscillating flue pipe) core: renders
 * the `church-flute` preset (an open flute — a single implicit 8' rank,
 * rank_count == 0) through the real libsonare WASM core and through the TS port
 * with the SAME deep params transcribed from `synth_presets.cpp`, then asserts
 * the two speak the same spectrum over a steady window. An organ SUSTAINS while
 * keyed, so the RMS-envelope correlation is logged for diagnostics but not
 * asserted (both sides sit at their sustain plateau).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { defaultPipeOrganParams, PipeOrganVoiceCore } from '@/tuner/dsp/pipe-organ-voice';
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

describe('Pipe-organ parity vs WASM core (church-flute preset)', () => {
  it('matches spectral envelope over the sustain', () => {
    // The church-flute deep params, transcribed from synth_presets.cpp: an open
    // single-rank flute (rank_count == 0 uses the top-level pipe fields).
    const params = defaultPipeOrganParams();
    params.stopped = false;
    params.brightness = 0.4;
    params.toneDecayS = 8.0;
    params.breath = 0.45;
    params.chiff = 0.3;
    params.radiation = 0.4;

    const note = 60; // C4
    const velocity = 100;
    const seconds = 1.0;
    const frames = Math.round(SR * seconds);
    const ref = bounceWasm(wasm.synthPresetPatch('church-flute'), note, velocity, seconds);

    // TS side: drive the core directly under the preset's wrapper — a linear
    // 12 ms attack into sustain 1 (the 120 ms release never fires inside the
    // render window) and the preset's 0.7 gain.
    const core = new PipeOrganVoiceCore(SR);
    core.start(params, SR, note, velocity, voiceSeed(0, note, 0n));
    const port = new Float32Array(frames);
    const attackFrames = Math.max(1, Math.round(SR * 0.012));
    const gain = 0.7;
    for (let i = 0; i < frames; ++i) {
      const env = i < attackFrames ? (i + 1) / attackFrames : 1;
      port[i] = core.render(1) * env * gain;
    }

    // Steady window well past the chiff and the speech swell's knee. The organ
    // sustains, so envCorr is diagnostic only.
    const m = report('pipe-organ', ref, port, 8000);
    expect(m.refPeak).toBeGreaterThan(0.005);
    expect(m.specCorr).toBeGreaterThan(0.85);
  });
});
