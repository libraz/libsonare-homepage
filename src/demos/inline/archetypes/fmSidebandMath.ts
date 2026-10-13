/**
 * Two-operator FM note and its measured spectrum, for the `fm-sidebands` archetype.
 *
 * The note is bounced through NativeSynth's `fm` engine with algorithm 0
 * (operator 1 modulates operator 0): `ops1.ratio` is the modulator ratio and
 * `ops1.level` the modulation index in radians. Both operators sustain at full
 * level so the spectrum is steady over the analysed window.
 */

type WasmModule = typeof import('@/wasm/index');

export const FM_SAMPLE_RATE = 44_100;
/** A3, so the harmonic grid sits at multiples of 220 Hz. */
export const FM_NOTE = 57;
export const FM_F0 = 220;
const HOLD_SEC = 1.5;
const TAIL_SEC = 0.3;
const SPECTRUM_FFT = 8192;

// The `.d.ts` re-exports `Project` under an opaque alias, so the slice used here is typed locally.
interface MidiEvent {
  __brand?: 'midi';
}
interface ProjectLike {
  setSampleRate(sr: number): void;
  addMidiClip(startPpq: number, lengthPpq: number): { trackId: number; clipId: number };
  setMidiEvents(clipId: number, events: MidiEvent[]): void;
  bounceWithSynthInstrument(
    instrument: Record<string, unknown>,
    options: { numChannels: number; sampleRate: number; totalFrames: number },
  ): Float32Array;
  delete(): void;
}
interface ProjectCtor {
  new (): ProjectLike;
  midiNoteOn(ppq: number, group: number, channel: number, note: number, vel: number): MidiEvent;
  midiNoteOff(ppq: number, group: number, channel: number, note: number, vel?: number): MidiEvent;
}

/** The `fm` patch for one carrier (op0, ratio 1) and one modulator (op1). */
export function fmPatch(ratio: number, index: number): Record<string, unknown> {
  const engineParams: Record<string, number> = {
    algorithm: 0,
    'ops0.ratio': 1,
    'ops0.level': 1,
    'ops1.ratio': ratio,
    'ops1.level': index,
    'ops2.level': 0,
    'ops3.level': 0,
  };
  for (const op of ['ops0', 'ops1']) {
    engineParams[`${op}.velToLevel`] = 0;
    engineParams[`${op}.keyRateScale`] = 0;
    engineParams[`${op}.env.attackMs`] = 5;
    engineParams[`${op}.env.decayMs`] = 10;
    engineParams[`${op}.env.sustain`] = 1;
    engineParams[`${op}.env.releaseMs`] = 60;
  }
  return {
    engineMode: 'fm',
    cutoffHz: 20_000,
    resonanceQ: Math.SQRT1_2,
    ampAttackMs: 5,
    ampDecayMs: 10,
    ampSustain: 1,
    ampReleaseMs: 80,
    gain: 0.5,
    engineParams,
  };
}

/** Bounce one held A3 through the FM engine, peak-normalized to 0.85. */
export function renderFmNote(wasm: WasmModule, ratio: number, index: number): Float32Array {
  const Project = (wasm as unknown as { Project: ProjectCtor }).Project;
  const project = new Project();
  try {
    project.setSampleRate(FM_SAMPLE_RATE);
    // Quarter-note units at the default 120 BPM: one quarter is 0.5 s.
    const offQuarters = HOLD_SEC / 0.5;
    const { clipId } = project.addMidiClip(0, offQuarters + 4);
    project.setMidiEvents(clipId, [
      Project.midiNoteOn(0, 0, 0, FM_NOTE, 100),
      Project.midiNoteOff(offQuarters, 0, 0, FM_NOTE, 0),
    ]);
    const pcm = project.bounceWithSynthInstrument(fmPatch(ratio, index), {
      numChannels: 1,
      sampleRate: FM_SAMPLE_RATE,
      totalFrames: Math.round(FM_SAMPLE_RATE * (HOLD_SEC + TAIL_SEC)),
    });
    let peak = 0;
    for (const v of pcm) peak = Math.max(peak, Math.abs(v));
    if (peak > 0) for (let i = 0; i < pcm.length; i++) pcm[i] *= 0.85 / peak;
    return pcm;
  } finally {
    project.delete();
  }
}

export interface FmSpectrum {
  /** Magnitude in dB relative to the strongest bin. */
  db: Float32Array;
  binHz: number;
}

/** Frame-averaged magnitude spectrum over the sustained part of the note. */
export function fmSpectrum(wasm: WasmModule, pcm: Float32Array): FmSpectrum {
  const seg = pcm.subarray(Math.round(0.2 * FM_SAMPLE_RATE), Math.round(1.3 * FM_SAMPLE_RATE));
  const { nBins, nFrames, magnitude } = wasm.stft(seg, FM_SAMPLE_RATE, SPECTRUM_FFT, 2048);
  const sum = new Float32Array(nBins);
  // Skip the edge frames, which the centred STFT pads.
  for (let b = 0; b < nBins; b++) {
    let acc = 0;
    for (let f = 1; f < nFrames - 1; f++) acc += magnitude[b * nFrames + f];
    sum[b] = acc;
  }
  let max = 1e-12;
  for (const v of sum) max = Math.max(max, v);
  const db = new Float32Array(nBins);
  for (let b = 0; b < nBins; b++) db[b] = 20 * Math.log10(Math.max(1e-9, sum[b] / max));
  return { db, binHz: FM_SAMPLE_RATE / SPECTRUM_FFT };
}

export interface Partial {
  hz: number;
  db: number;
}

/** Local spectral peaks no more than `floorDb` below the strongest one. */
export function findPartials(spec: FmSpectrum, floorDb = -40): Partial[] {
  const out: Partial[] = [];
  const { db, binHz } = spec;
  for (let b = 2; b < db.length - 2; b++) {
    if (db[b] > floorDb && db[b] > db[b - 1] && db[b] >= db[b + 1]) {
      out.push({ hz: b * binHz, db: db[b] });
    }
  }
  return out;
}

/** Spectral centroid of the power spectrum, in Hz. */
export function spectralCentroidHz(spec: FmSpectrum): number {
  let num = 0;
  let den = 0;
  for (let b = 0; b < spec.db.length; b++) {
    const p = 10 ** (spec.db[b] / 10);
    num += b * spec.binHz * p;
    den += p;
  }
  return den > 0 ? num / den : 0;
}
