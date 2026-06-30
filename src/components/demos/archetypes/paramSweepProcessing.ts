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
    samples = peakNormalize(
      wasm.melToAudio(
        mel.power,
        mel.nMels,
        mel.nFrames,
        sampleRate,
        2048,
        512,
        0,
        0,
        options.iters,
      ),
      0.7,
    );
    outDur = samples.length / sampleRate;
  } else if (options.processor === 'tilt-eq') {
    let tilted: Float32Array;
    if (options.tilt === 0) {
      tilted = Float32Array.from(baseClip.samples);
    } else {
      tilted = shelfFilter(
        baseClip.samples,
        sampleRate,
        'low',
        PARAM_SWEEP_TILT_PIVOT_HZ,
        -options.tilt / 2,
      );
      tilted = shelfFilter(tilted, sampleRate, 'high', PARAM_SWEEP_TILT_PIVOT_HZ, options.tilt / 2);
    }
    samples = peakNormalize(tilted, 0.7);
    pivotHz = PARAM_SWEEP_TILT_PIVOT_HZ;
  } else {
    samples =
      options.semitones === 0
        ? baseClip.samples
        : wasm.pitchShift(baseClip.samples, sampleRate, options.semitones);
    fundHz = PARAM_SWEEP_BASE_F0 * 2 ** (options.semitones / 12);
  }

  return { samples, sampleRate, fundHz, pivotHz, outDur, widthFrac };
}
