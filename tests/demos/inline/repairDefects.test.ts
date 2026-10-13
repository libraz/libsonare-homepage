// @vitest-environment node
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { injectDefect, renderAbProcess } from '@/demos/inline/archetypes/abProcessPipeline';
import { masteringDemos } from '@/demos/inline/registry/mastering';
import * as wasm from '@/wasm/index.js';

function readClip(name: string): { samples: Float32Array; sampleRate: number } {
  const bytes = readFileSync(
    new URL(`../../../src/public/demo-clips/${name}.wav`, import.meta.url),
  );
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const sampleRate = view.getUint32(24, true);
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const id = String.fromCharCode(...bytes.subarray(offset, offset + 4));
    const size = view.getUint32(offset + 4, true);
    if (id === 'data') {
      const samples = new Float32Array(size / 2);
      for (let i = 0; i < samples.length; i++)
        samples[i] = view.getInt16(offset + 8 + 2 * i, true) / 32768;
      return { samples, sampleRate };
    }
    offset += 8 + size + (size & 1);
  }
  throw new Error(`no data chunk in ${name}`);
}

/** Level in dBFS of one sinusoid component of the signal. */
function toneDb(x: Float32Array, hz: number, sampleRate: number): number {
  const w = (2 * Math.PI * hz) / sampleRate;
  let re = 0;
  let im = 0;
  for (let i = 0; i < x.length; i++) {
    re += x[i]! * Math.cos(w * i);
    im += x[i]! * Math.sin(w * i);
  }
  return 20 * Math.log10((Math.hypot(re, im) * 2) / x.length + 1e-12);
}

function rmsDiff(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i]! - b[i]!) ** 2;
  return Math.sqrt(sum / a.length);
}

const HARMONICS = [50, 100, 150, 200];

function demoModes(id: string, key: string): string[] {
  const def = masteringDemos.find((d) => d.id === id);
  const param = def?.params?.find((p) => p.key === key);
  if (!param || param.kind !== 'select') throw new Error(`${id} has no ${key} select`);
  return param.options.map((o) => o.value);
}

beforeAll(async () => {
  await wasm.init();
}, 30_000);

describe('repair-dehum', () => {
  it('removes injected mains hum, and every offered mode changes the result', () => {
    const { samples, sampleRate } = readClip('pad');
    const hummed = injectDefect('hum', samples, sampleRate);
    const levels = (x: Float32Array) => HARMONICS.map((hz) => toneDb(x, hz, sampleRate));
    const before = levels(hummed);
    const clean = levels(samples);
    for (let k = 0; k < HARMONICS.length; k++) expect(before[k]! - clean[k]!).toBeGreaterThan(40);

    const outputs = demoModes('repair-dehum', 'mode').map((mode) => {
      const out = renderAbProcess(wasm, 'repair-dehum', hummed, sampleRate, mode);
      const after = levels(out);
      // The fundamental falls by at least 25 dB in every mode.
      expect(before[0]! - after[0]!).toBeGreaterThan(25);
      return { mode, out, after };
    });

    const byMode = Object.fromEntries(outputs.map((o) => [o.mode, o]));
    // Cancelling only the fundamental leaves the third harmonic; four harmonics remove it.
    expect(byMode.fundamental!.after[2]! - byMode.subtract!.after[2]!).toBeGreaterThan(40);
    expect(before[2]! - byMode.subtract!.after[2]!).toBeGreaterThan(40);
    // A notch removes less of the fundamental than cancellation does.
    expect(byMode.notch!.after[0]! - byMode.subtract!.after[0]!).toBeGreaterThan(10);
  }, 30_000);
});

describe('repair-dehum readout', () => {
  it('scores the 40-250 Hz band: full removal falls by over 8 dB, fundamental-only by under 4 dB', () => {
    const { samples, sampleRate } = readClip('pad');
    const hummed = injectDefect('hum', samples, sampleRate);
    const bandMean = (x: Float32Array): number => {
      const { nBins, nFrames, magnitude } = wasm.stft(x, sampleRate, 2048, 512);
      const binHz = sampleRate / 2048;
      let sum = 0;
      let count = 0;
      for (let b = Math.ceil(40 / binHz); b <= Math.floor(250 / binHz) && b < nBins; b++) {
        for (let f = 0; f < nFrames; f++) sum += magnitude[b * nFrames + f]!;
        count += nFrames;
      }
      return sum / count;
    };
    const base = bandMean(hummed);
    const drop = (mode: string) =>
      20 *
      Math.log10(bandMean(renderAbProcess(wasm, 'repair-dehum', hummed, sampleRate, mode)) / base);
    expect(drop('subtract')).toBeLessThan(-8);
    expect(drop('notch')).toBeLessThan(-8);
    expect(drop('fundamental')).toBeGreaterThan(-4);
    expect(drop('fundamental')).toBeLessThan(-1);
  }, 30_000);
});

describe('repair-crackle', () => {
  it('removes injected pops, and a lower threshold removes more of them', () => {
    const { samples, sampleRate } = readClip('pad');
    const crackled = injectDefect('crackle', samples, sampleRate);
    const damage = rmsDiff(crackled, samples);
    expect(damage).toBeGreaterThan(0.01);

    const thresholds = demoModes('repair-crackle', 'mode').map(Number);
    const errors = thresholds.map((threshold) => {
      const out = renderAbProcess(wasm, 'repair-crackle', crackled, sampleRate, String(threshold));
      return rmsDiff(out, samples);
    });
    // thresholds are listed from the default downward; each step must repair more.
    for (let i = 1; i < errors.length; i++) expect(errors[i]!).toBeLessThan(errors[i - 1]! * 0.9);
    expect(errors[errors.length - 1]!).toBeLessThan(damage * 0.6);

    const untouched = renderAbProcess(wasm, 'repair-crackle', samples, sampleRate, '0.1');
    expect(rmsDiff(untouched, samples)).toBeLessThan(1e-6);
  }, 30_000);
});
