import { describe, expect, it, vi } from 'vitest';
import {
  fillParamSweepSpectrum,
  fillParamSweepWavePeaks,
  PARAM_SWEEP_BASE_F0,
} from '@/components/demos/archetypes/paramSweepData';
import {
  type ParamSweepProcessorWasm,
  renderParamSweepAudio,
} from '@/components/demos/archetypes/paramSweepProcessing';

function fakeWasm(): ParamSweepProcessorWasm {
  return {
    stft: vi.fn((_samples: Float32Array) => ({
      nBins: 4,
      nFrames: 2,
      magnitude: new Float32Array([1, 2, 2, 1, 0.5, 1, 0.25, 0.5]),
    })),
    timeStretch: vi.fn((samples: Float32Array) => Float32Array.from([...samples, ...samples])),
    voiceChange: vi.fn((samples: Float32Array) => Float32Array.from(samples)),
    melSpectrogram: vi.fn(() => ({
      power: new Float32Array([1, 0.5]),
      nMels: 1,
      nFrames: 2,
    })),
    melToAudio: vi.fn(() => new Float32Array([0.1, -0.2, 0.3])),
    pitchShift: vi.fn((samples: Float32Array) => Float32Array.from(samples)),
  };
}

const baseClip = {
  samples: new Float32Array([0.1, -0.4, 0.2, 0.8, -0.2, 0.1]),
  sampleRate: 44_100,
};

describe('param sweep helpers', () => {
  it('fills normalized waveform peaks', () => {
    const peaks = new Float32Array(3);

    fillParamSweepWavePeaks(baseClip.samples, peaks);

    expect(Array.from(peaks)).toEqual([0.5, 1, 0.25]);
  });

  it('fills a finite compressed spectrum target', () => {
    const wasm = fakeWasm();
    const spectrum = new Float32Array(5);

    fillParamSweepSpectrum(wasm, baseClip.samples, baseClip.sampleRate, spectrum);

    expect(wasm.stft).toHaveBeenCalledWith(baseClip.samples, baseClip.sampleRate, 2048, 512);
    expect(Array.from(spectrum).every(Number.isFinite)).toBe(true);
  });

  it('renders pitch-shift metadata without changing duration', () => {
    const wasm = fakeWasm();

    const audio = renderParamSweepAudio(wasm, baseClip, {
      processor: 'pitch-shift',
      semitones: 12,
      rate: 1,
      formant: 1,
      iters: 8,
      tilt: 0,
      minRate: 0.5,
    });

    expect(wasm.pitchShift).toHaveBeenCalledWith(baseClip.samples, baseClip.sampleRate, 12);
    expect(audio.fundHz).toBeCloseTo(PARAM_SWEEP_BASE_F0 * 2);
    expect(audio.outDur).toBeCloseTo(baseClip.samples.length / baseClip.sampleRate);
    expect(audio.widthFrac).toBe(1);
  });

  it('reports stretched duration and normalized width for time-stretch', () => {
    const audio = renderParamSweepAudio(fakeWasm(), baseClip, {
      processor: 'time-stretch',
      semitones: 0,
      rate: 0.5,
      formant: 1,
      iters: 8,
      tilt: 0,
      minRate: 0.5,
    });

    expect(audio.samples).toHaveLength(baseClip.samples.length * 2);
    expect(audio.outDur).toBeCloseTo(audio.samples.length / baseClip.sampleRate);
    expect(audio.widthFrac).toBeCloseTo(1);
  });
});
