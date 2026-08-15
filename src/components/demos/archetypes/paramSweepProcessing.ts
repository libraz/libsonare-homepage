import { peakNormalize, shelfFilter } from '@/demos/audio/processors';
import {
  PARAM_SWEEP_BASE_F0,
  PARAM_SWEEP_TILT_PIVOT_HZ,
  type ParamSweepWasm,
} from './paramSweepData';

export type ParamSweepProcessor =
  | 'pitch-shift'
  | 'time-stretch'
  | 'formant-shift'
  | 'griffin-lim'
  | 'tilt-eq';

export interface ParamSweepAudio {
  samples: Float32Array;
  sampleRate: number;
  fundHz: number;
  pivotHz: number;
  outDur: number;
  widthFrac: number;
}

export interface ParamSweepRenderOptions {
  processor: ParamSweepProcessor;
  semitones: number;
  rate: number;
  formant: number;
  iters: number;
  tilt: number;
  minRate: number;
}

export interface ParamSweepProcessorWasm extends ParamSweepWasm {
  timeStretch(samples: Float32Array, sampleRate: number, rate: number): Float32Array;
  voiceChange(
    samples: Float32Array,
    sampleRate: number,
    options: { formantFactor: number },
  ): Float32Array;
  melSpectrogram(
    samples: Float32Array,
    sampleRate: number,
    nFft: number,
    hop: number,
    nMels: number,
  ): { power: Float32Array; nMels: number; nFrames: number };
  melToAudio(
    power: Float32Array,
    nMels: number,
    nFrames: number,
    sampleRate: number,
    nFft: number,
    hop: number,
    fMin: number,
    fMax: number,
    iterations: number,
  ): Float32Array;
  pitchShift(samples: Float32Array, sampleRate: number, semitones: number): Float32Array;
}

export function renderParamSweepAudio(
  wasm: ParamSweepProcessorWasm,
  baseClip: { samples: Float32Array; sampleRate: number },
  options: ParamSweepRenderOptions,
): ParamSweepAudio {
  const sampleRate = baseClip.sampleRate;
  const baseDur = baseClip.samples.length / sampleRate;
  let samples: Float32Array;
  let fundHz = 0;
  let pivotHz = 0;
  let outDur = baseDur;
  let widthFrac = 1;

  if (options.processor === 'time-stretch') {
    samples =
      options.rate === 1
        ? baseClip.samples
        : wasm.timeStretch(baseClip.samples, sampleRate, options.rate);
    fundHz = PARAM_SWEEP_BASE_F0;
    outDur = samples.length / sampleRate;
    const refDur = baseDur / options.minRate;
    widthFrac = Math.max(0.04, Math.min(1, outDur / refDur));
  } else if (options.processor === 'formant-shift') {
    samples =
      options.formant === 1
        ? baseClip.samples
        : wasm.voiceChange(baseClip.samples, sampleRate, { formantFactor: options.formant });
    fundHz = PARAM_SWEEP_BASE_F0;
  } else if (options.processor === 'griffin-lim') {
    const mel = wasm.melSpectrogram(baseClip.samples, sampleRate, 2048, 512, 128);
    samples = wasm.melToAudio(
      mel.power,
      mel.nMels,
      mel.nFrames,
      sampleRate,
      2048,
      512,
      0,
      0,
      options.iters,
    );
    outDur = samples.length / sampleRate;
  } else if (options.processor === 'tilt-eq') {
    if (options.tilt === 0) {
      samples = Float32Array.from(baseClip.samples);
    } else {
      const low = shelfFilter(
        baseClip.samples,
        sampleRate,
        'low',
        PARAM_SWEEP_TILT_PIVOT_HZ,
        -options.tilt / 2,
      );
      samples = shelfFilter(low, sampleRate, 'high', PARAM_SWEEP_TILT_PIVOT_HZ, options.tilt / 2);
    }
    pivotHz = PARAM_SWEEP_TILT_PIVOT_HZ;
  } else {
    samples =
      options.semitones === 0
        ? baseClip.samples
        : wasm.pitchShift(baseClip.samples, sampleRate, options.semitones);
    fundHz = PARAM_SWEEP_BASE_F0 * 2 ** (options.semitones / 12);
  }

  // Every render is peak-normalized to the same target, for two reasons that split
  // across the five processors. Four of them run past 0 dBFS somewhere in their
  // slider range and would clip on playback: measured on the clips these demos ship
  // with, `pitchShift` reaches about 1.34, `melToAudio` about 1.28, the tilt shelf
  // pair about 1.77 at +12 dB, and `voiceChange` about 2.25 at formant 1.4 — that
  // last one holds its level (RMS stays within roughly 1.7 dB of the input across
  // the range) but its resynthesis sharpens the crest factor. `timeStretch` is the
  // opposite case: it never clips here, yet it loses up to about 10 dB at the
  // fastest rates, so an un-normalized render would simply arrive quieter than its
  // neighbours. One fixed peak target covers both and keeps the sweep an A/B of the
  // transform rather than of the level. It matches peaks, not loudness — integrated
  // LUFS still moves by a couple of units across a sweep. Copy first when a branch
  // passed the cached clip through untouched, since normalization is in place and
  // the clip cache is shared page-wide.
  const out = samples === baseClip.samples ? Float32Array.from(samples) : samples;
  return { samples: peakNormalize(out, 0.7), sampleRate, fundHz, pivotHz, outDur, widthFrac };
}
