// @vitest-environment node
/**
 * Percussion parity harness: renders the same drum strike through the real
 * libsonare WASM core (offline bounce) and through the TS percussion port,
 * then asserts matching spectral and decay envelopes.
 *
 * Fixture: the GM drum kit's LOW-MID TOM (drum key 47). The JS `SynthPatch`
 * surface exposes no deep percussion fields and the only percussion preset is
 * the GM kit (the engine default bank is empty, so a
 * `transparentPatch('percussion')` bounce is silent), so the whole voice is
 * transcribed by hand from the C++ drum table in `gm_fallback_drums.cpp`:
 * the shared `piece` scaffolding, the `d.tom` archetype the six tom keys start
 * from, and the per-key overrides key 47 carries on top of it — which are what
 * make this key a one-mode membrane with a re-fitted strike point, a dense FDN
 * plate, a direct contact transient, a wire rattle and a three-mode shell,
 * rather than the archetype's five-mode Rayleigh set.
 *
 * Because the strike is only half the voice, the harness also mirrors the
 * post-core chain `native_synth_voice.cpp` applies, in its order: the
 * gain-compensated tanh drive, the patch SVF lowpass, the DAHDSR amp envelope
 * (attack 1.5172 ms, decay 50 ms to a 0.1259 sustain — the note is held for six
 * beats and the piece is one-shot, so the release never runs inside the window),
 * then the percussion velocity curve and the patch gain. The contact transient
 * joins past the envelope, since it radiates straight from the strike and each
 * of the drive, the filter and the envelope would swallow it.
 *
 * The noise layer stays ON for both sides: it is seeded from the same
 * (voice 0, note, age 0) stream, so it is deterministic, not stochastic.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import {
  defaultPercussionParams,
  type PercussionPatchParams,
  PercussionVoiceCore,
  TptSvf,
} from '@/demos/tuner/dsp/percussion-voice';
import { voiceSeed } from '@/demos/tuner/dsp/voice-random';

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

/** The DAHDSR stage times a kit piece carries (C++ `DahdsrConfig`). */
interface AmpEnvConfig {
  attackMs: number;
  decayMs: number;
  sustain: number;
  releaseMs: number;
}

/** The patch-level fields the post-core chain reads (C++ `NativeSynthPatch`). */
interface KitPiece {
  percussion: PercussionPatchParams;
  ampEnv: AmpEnvConfig;
  cutoffHz: number;
  resonanceQ: number;
  drive: number;
  gain: number;
}

/**
 * Exponent of the SoundFont velocity-to-amplitude curve on the kit
 * (`kPercussionVelocityExponent` in native_synth_voice.cpp). The kit takes an
 * exponent rather than the spec's 2.0 or the piano's opt-out.
 */
const PERCUSSION_VELOCITY_EXPONENT = 1.1;

/**
 * GM drum key 47 (low-mid tom), 1:1 transcription of `t[47]` in
 * `gm_fallback_drums.cpp`: the shared `piece` scaffolding, the `d.tom`
 * archetype the six tom keys are assigned from, and every per-key override
 * applied on top. Values reflect `clamp_synth_patch`, which the table runs over
 * every entry — the only field it moves here is `shell_t60_s`, whose unset
 * upper modes are raised from 0 to the 0.005 s floor.
 */
function tomParams(): KitPiece {
  const p = defaultPercussionParams();
  // --- d.tom archetype ---
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
  // --- key 47 overrides ---
  p.numModes = 1;
  p.modeRatios = [0.920847, 0.661637, 7.8434, 3.75206, 2.18956, 0];
  p.modeDecayS = 0.357981;
  p.toneGain = 2.87243;
  p.pitchDrop = 1.9615;
  p.pitchDropMs = 14.7123;
  p.strikeR = 0.876996;
  p.strikeTheta = 0.638249;
  p.noiseGain = 0.578683;
  p.noiseDecayMs = 4.75026;
  p.noiseCutoffHz = 228.362;
  p.noiseQ = 1.81726;
  p.shellMix = 0.549229;
  p.shellNumModes = 3;
  p.shellT60S = [0.0528995, 0.06, 0.005, 0.005];
  p.shellWeight = [0.464666, 2.8029, 0, 0];
  p.wireBuzz = 0.888697;
  p.contact = 0.347392;
  p.plateGain = 0.767737;
  return {
    percussion: p,
    // fallback_env(0.5, 400, 0, 120) on the archetype; the key re-fits the
    // attack, the decay and the sustain and keeps the release.
    ampEnv: { attackMs: 1.5172, decayMs: 50, sustain: 0.125947, releaseMs: 120 },
    cutoffHz: 4404.95,
    resonanceQ: 1.23387,
    drive: 0.356028,
    gain: 1.7579,
  };
}

/**
 * The piece's DAHDSR amp stage, mirroring the C++ `DahdsrEnvelope`: a one-pole
 * attack overshooting toward 1.3 that crosses 1.0 in attack_ms, then a one-pole
 * decay toward the sustain level with tau = decay_ms / 3, pinned once it has
 * effectively converged. The piece is one-shot and the note is held past the
 * render window, so the release stage never runs here.
 */
function dahdsrEnv(cfg: AmpEnvConfig): () => number {
  const attackTarget = 1.3;
  const attackTauScale = Math.log(attackTarget / (attackTarget - 1));
  const decayTauScale = 3;
  const stageRate = (timeMs: number, tauScale: number) =>
    timeMs <= 0 ? 1 : 1 - Math.exp(-1 / Math.max((SR * (timeMs / tauScale)) / 1000, 1));
  const attackRate = stageRate(cfg.attackMs, attackTauScale);
  const decayRate = stageRate(cfg.decayMs, decayTauScale);
  const sustain = Math.min(1, Math.max(0, cfg.sustain));
  let level = 0;
  let stage: 'attack' | 'decay' | 'sustain' = 'attack';
  return () => {
    if (stage === 'attack') {
      level += attackRate * (attackTarget - level);
      if (level >= 1) {
        level = 1;
        stage = 'decay';
      }
    } else if (stage === 'decay') {
      level += decayRate * (sustain - level);
      // Within the 5% landing window (relative to full scale) -> sustain, but
      // pinned only once effectively converged, so the exponential glide holds.
      if (level - sustain <= 0.05 * (1 - sustain) || decayRate >= 1) {
        if (level - sustain <= 1e-3 || decayRate >= 1) {
          level = sustain;
          stage = 'sustain';
        }
      }
    } else {
      level = sustain;
    }
    return level;
  };
}

/**
 * Renders the piece through the same chain `NativeSynthVoice::render()` runs:
 * core -> gain-compensated tanh drive -> patch SVF lowpass -> amp envelope,
 * with the contact transient summed past the envelope, then the percussion
 * velocity curve and the patch gain. The body resonator, the series highpass
 * and the converter stages are all inert on this patch.
 */
function renderPort(note: number, velocity: number, frames: number): Float32Array {
  const piece = tomParams();
  const core = new PercussionVoiceCore(SR);
  core.start(piece.percussion, SR, note, velocity, voiceSeed(0, note, 0n));
  const env = dahdsrEnv(piece.ampEnv);
  const filter = new TptSvf();
  filter.prepare(SR);
  filter.set(piece.cutoffHz, piece.resonanceQ);
  const driveGain = piece.drive > 0 ? 1 + 9 * piece.drive : 0;
  const driveMakeup = driveGain > 0 ? 1 / Math.tanh(driveGain) : 1;
  const velocityGain = ((velocity & 0x7f) / 127) ** PERCUSSION_VELOCITY_EXPONENT;
  const out = new Float32Array(frames);
  for (let i = 0; i < frames; ++i) {
    let s = core.render(1);
    const contact = core.nextContact();
    if (driveGain > 0) s = Math.tanh(driveGain * s) * driveMakeup;
    s = filter.process(s).lp;
    out[i] = (s * env() + contact) * velocityGain * piece.gain;
  }
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
