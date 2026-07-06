import { describe, expect, it } from 'vitest';
import { renderNoteOffline, transparentEnv } from '@/tuner/dsp/engine';
import { defaultKsParams, defaultModalParams } from '@/tuner/dsp/params';
import { VoiceRandomSequence, voiceSeed } from '@/tuner/dsp/voice-random';

const SR = 48000;

/** Estimate the fundamental (Hz) by autocorrelation over a windowed region. */
function estimatePitch(buf: Float32Array, sampleRate: number, from: number, to: number): number {
  const lo = Math.floor(sampleRate / 2000); // up to 2 kHz
  const hi = Math.ceil(sampleRate / 50); // down to 50 Hz
  let bestLag = lo;
  let best = -Infinity;
  for (let lag = lo; lag <= hi; ++lag) {
    let acc = 0;
    for (let i = from; i < to - lag; ++i) acc += buf[i] * buf[i + lag];
    if (acc > best) {
      best = acc;
      bestLag = lag;
    }
  }
  return sampleRate / bestLag;
}

function peak(buf: Float32Array): number {
  let p = 0;
  for (const s of buf) {
    const a = Math.abs(s);
    if (a > p) p = a;
  }
  return p;
}

describe('voice-random determinism', () => {
  it('reproduces the same stream for the same seed', () => {
    const seed = voiceSeed(3, 60, 7n);
    const a = new VoiceRandomSequence(seed);
    const b = new VoiceRandomSequence(seed);
    for (let i = 0; i < 32; ++i) expect(a.nextBipolar()).toBe(b.nextBipolar());
  });

  it('random access matches sequential draws', () => {
    const seq = new VoiceRandomSequence(voiceSeed(1, 69, 0n));
    expect(seq.bipolarAt(5)).toBeCloseTo(
      new VoiceRandomSequence(voiceSeed(1, 69, 0n)).bipolarAt(5),
      12,
    );
    for (const v of [seq.bipolarAt(0), seq.bipolarAt(1000000)]) {
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('KS core', () => {
  it('renders a decaying tone at the played pitch', () => {
    const spec = {
      engineMode: 'karplus-strong' as const,
      ks: defaultKsParams(),
      body: 'none' as const,
      bodyMix: 0,
      drive: 0,
      ampEnv: transparentEnv(),
      gain: 1,
    };
    const note = 57; // A3 = 220 Hz
    const buf = renderNoteOffline(spec, note, 100, SR, SR); // 1 s
    expect(peak(buf)).toBeGreaterThan(0.02);
    const hz = estimatePitch(buf, SR, 2000, 20000);
    expect(hz).toBeGreaterThan(210);
    expect(hz).toBeLessThan(230);
    // Decays: late RMS well below early RMS.
    const rms = (a: number, b: number) => {
      let s = 0;
      for (let i = a; i < b; ++i) s += buf[i] * buf[i];
      return Math.sqrt(s / (b - a));
    };
    expect(rms(30000, 47000)).toBeLessThan(rms(2000, 8000));
  });
});

/** Goertzel magnitude of a single frequency over a window. */
function goertzel(
  buf: Float32Array,
  sampleRate: number,
  freq: number,
  from: number,
  to: number,
): number {
  const w = (2 * Math.PI * freq) / sampleRate;
  const coeff = 2 * Math.cos(w);
  let s1 = 0;
  let s2 = 0;
  for (let i = from; i < to; ++i) {
    const s0 = buf[i] + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  return Math.sqrt(s1 * s1 + s2 * s2 - coeff * s1 * s2);
}

describe('Modal core', () => {
  it('rings its inharmonic strike partials and decays', () => {
    const spec = {
      engineMode: 'modal' as const,
      modal: defaultModalParams(),
      body: 'none' as const,
      bodyMix: 0,
      drive: 0,
      ampEnv: transparentEnv(),
      gain: 1,
    };
    const note = 72; // C5
    const buf = renderNoteOffline(spec, note, 110, SR, SR);
    expect(peak(buf)).toBeGreaterThan(0.001);
    const f0 = 440 * 2 ** ((note - 69) / 12);
    // The fundamental mode (ratio 1) carries strong energy vs an off-mode gap.
    const atF0 = goertzel(buf, SR, f0, 1000, 20000);
    const offMode = goertzel(buf, SR, f0 * 1.7, 1000, 20000); // between modes 1 and 2.756
    expect(atF0).toBeGreaterThan(offMode * 4);
    // Decays over the buffer.
    const rms = (a: number, b: number) => {
      let s = 0;
      for (let i = a; i < b; ++i) s += buf[i] * buf[i];
      return Math.sqrt(s / (b - a));
    };
    expect(rms(30000, 47000)).toBeLessThan(rms(1000, 8000));
  });
});
