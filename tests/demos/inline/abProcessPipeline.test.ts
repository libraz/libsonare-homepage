// @vitest-environment node
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { renderAbProcess } from '@/demos/inline/archetypes/abProcessPipeline';
import { averagedSpectrum } from '@/demos/inline/audio/processors';
import * as wasm from '@/wasm/index.js';

const VOWELS = ['0', '1', '2', '3', '4'];
const SAMPLE_RATES = [44_100, 32_000];

function formantProbe(sampleRate: number, frames = 8192): Float32Array {
  const frequencies = [180, 320, 510, 700, 950, 1_280, 1_900, 2_600, 3_400, 4_800];
  const samples = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    const t = i / sampleRate;
    let value = 0;
    for (let f = 0; f < frequencies.length; f++) {
      value += (0.04 / (1 + f * 0.08)) * Math.sin(2 * Math.PI * frequencies[f]! * t);
    }
    samples[i] = value;
  }
  return samples;
}

function maxAbs(samples: Float32Array): number {
  let peak = 0;
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
  return peak;
}

function nmfProbe(sampleRate: number, frames = 8192): Float32Array {
  const samples = new Float32Array(frames);
  const events = [0.18, 0.42, 0.67, 0.84].map((position, index) => ({
    center: Math.round(position * frames),
    frequency: 620 + index * 230,
  }));
  for (let i = 0; i < frames; i++) {
    const t = i / sampleRate;
    let value =
      0.14 * Math.sin(2 * Math.PI * 190 * t) +
      0.11 * Math.sin(2 * Math.PI * 380 * t) +
      0.08 * Math.sin(2 * Math.PI * 760 * t);
    for (const event of events) {
      const distance = (i - event.center) / (sampleRate * 0.035);
      const envelope = Math.exp(-(distance * distance));
      value += envelope * Math.sin(2 * Math.PI * event.frequency * t) * 0.22;
    }
    samples[i] = value;
  }
  return samples;
}

beforeAll(async () => {
  await wasm.init();
}, 30_000);

describe('A/B process pipeline', () => {
  it('renders five finite, audible vowel voices with distinct spectra', () => {
    const sampleRate = SAMPLE_RATES[0]!;
    const source = formantProbe(sampleRate);
    const outputs = VOWELS.map((mode) =>
      renderAbProcess(wasm, 'vowel-filter', source, sampleRate, mode),
    );

    for (const output of outputs) {
      expect(output).toHaveLength(source.length);
      expect(Array.from(output).every(Number.isFinite)).toBe(true);
      expect(maxAbs(output)).toBeGreaterThan(1e-4);
    }

    const spectra = outputs.map((output) => {
      const spectrum = new Float32Array(96);
      const peak = averagedSpectrum(wasm, output, sampleRate, spectrum, 8_000, 1);
      expect(peak).toBeGreaterThan(0);
      expect(Array.from(spectrum).every(Number.isFinite)).toBe(true);
      return spectrum;
    });

    for (let left = 0; left < spectra.length; left++) {
      for (let right = left + 1; right < spectra.length; right++) {
        let difference = 0;
        for (let column = 0; column < spectra[left]!.length; column++) {
          difference = Math.max(
            difference,
            Math.abs(spectra[left]![column]! - spectra[right]![column]!),
          );
        }
        expect(difference, `vowel ${left} vs ${right}`).toBeGreaterThan(1e-4);
      }
    }
  });

  it.each(SAMPLE_RATES)('keeps the dry source untouched at %s Hz', (sampleRate) => {
    const source = formantProbe(sampleRate);
    const dry = new Float32Array(source);

    const filtered = renderAbProcess(wasm, 'vowel-filter', source, sampleRate, '2');

    expect(source).toEqual(dry);
    expect(filtered).toHaveLength(dry.length);
    expect(maxAbs(filtered)).toBeGreaterThan(1e-4);
  });

  it('rejects a mode outside the five registered voices', () => {
    expect(() => renderAbProcess(wasm, 'vowel-filter', formantProbe(44_100), 44_100, '5')).toThrow(
      /integer from 0 to 4/,
    );
  });

  it('renders four finite, audible NMF components that reconstruct the source', () => {
    for (const sampleRate of SAMPLE_RATES) {
      const source = nmfProbe(sampleRate);
      const components = ['0', '1', '2', '3'].map((mode) =>
        renderAbProcess(wasm, 'nmf-stems', source, sampleRate, mode),
      );

      for (const component of components) {
        expect(component).toHaveLength(source.length);
        expect(Array.from(component).every(Number.isFinite)).toBe(true);
        expect(maxAbs(component)).toBeGreaterThan(1e-5);
      }

      let squaredError = 0;
      let squaredSource = 0;
      for (let i = 1024; i < source.length - 1024; i++) {
        let sum = 0;
        for (const component of components) sum += component[i]!;
        squaredError += (sum - source[i]!) ** 2;
        squaredSource += source[i]! ** 2;
      }
      expect(Math.sqrt(squaredError / squaredSource)).toBeLessThan(0.05);

      const spectra = components.map((component) => {
        const spectrum = new Float32Array(64);
        averagedSpectrum(wasm, component, sampleRate, spectrum, 8_000, 1);
        return spectrum;
      });
      for (let left = 0; left < spectra.length; left++) {
        for (let right = left + 1; right < spectra.length; right++) {
          let difference = 0;
          for (let column = 0; column < spectra[left]!.length; column++) {
            difference = Math.max(
              difference,
              Math.abs(spectra[left]![column]! - spectra[right]![column]!),
            );
          }
          expect(difference, `NMF component ${left} vs ${right}`).toBeGreaterThan(1e-4);
        }
      }
    }
  });

  it('does not rerun NMF when selecting another component', () => {
    const source = nmfProbe(SAMPLE_RATES[0]!);
    const decomposeStems = vi.fn(wasm.decomposeStems);
    const instrumentedWasm = { ...wasm, decomposeStems } as typeof wasm;

    const first = renderAbProcess(instrumentedWasm, 'nmf-stems', source, SAMPLE_RATES[0]!, '0');
    const last = renderAbProcess(instrumentedWasm, 'nmf-stems', source, SAMPLE_RATES[0]!, '3');

    expect(decomposeStems).toHaveBeenCalledTimes(1);
    expect(first).not.toBe(last);
  });
});
