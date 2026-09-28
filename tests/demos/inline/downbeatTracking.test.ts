import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { getDemo } from '@/demos/inline/registry';
import * as wasm from '@/wasm/index.js';

interface Wav {
  samples: Float32Array;
  sampleRate: number;
}

function loadWav(name: string): Wav {
  const bytes = readFileSync(join(process.cwd(), 'src', 'public', 'demo-clips', `${name}.wav`));
  let channels = 0;
  let sampleRate = 0;
  let dataOffset = 0;
  let dataSize = 0;
  for (let offset = 12; offset + 8 <= bytes.length; ) {
    const chunk = bytes.toString('ascii', offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (chunk === 'fmt ') {
      channels = bytes.readUInt16LE(body + 2);
      sampleRate = bytes.readUInt32LE(body + 4);
    } else if (chunk === 'data') {
      dataOffset = body;
      dataSize = size;
      break;
    }
    offset = body + size + (size & 1);
  }

  const frames = Math.floor(dataSize / (channels * 2));
  const samples = new Float32Array(frames);
  for (let frame = 0; frame < frames; frame++) {
    let sum = 0;
    for (let channel = 0; channel < channels; channel++) {
      sum += bytes.readInt16LE(dataOffset + (frame * channels + channel) * 2) / 32768;
    }
    samples[frame] = sum / channels;
  }
  return { samples, sampleRate };
}

beforeAll(async () => {
  await wasm.init({ wasmBinary: readFileSync(join(process.cwd(), 'src', 'wasm', 'sonare.wasm')) });
}, 30_000);

describe('downbeat tracking on the shipped grooves', () => {
  it('uses the meter groove and keeps its downbeats stable across browser rates', () => {
    const registered = getDemo('downbeat-tracking');
    if (registered?.source.kind !== 'clip') {
      throw new Error('downbeat demo is missing or not registered on a clip');
    }
    expect(registered.source.clip).toBe('meter-groove');
    expect(registered.config).toBeUndefined();
    expect(registered.params?.find((param) => param.key === 'view')?.default).toBe('downbeat');

    const { samples, sampleRate } = loadWav(registered.source.clip);
    const expected = [2.02, 4.017, 6.014];
    for (const rate of [32_000, 44_100, 48_000]) {
      const rateSamples = rate === sampleRate ? samples : wasm.resample(samples, sampleRate, rate);
      const downbeats = Array.from(wasm.detectDownbeats(rateSamples, rate));
      expect(downbeats).toHaveLength(expected.length);
      for (const [index, time] of downbeats.entries()) {
        expect(time).toBeCloseTo(expected[index], 2);
      }
    }
  }, 30_000);

  it('keeps the three-beat groove phase stable at the same rates', () => {
    const { samples, sampleRate } = loadWav('meter-groove-three');
    const expected = [1.533, 3.019, 4.528, 6.014, 7.523, 9.033, 10.519, 12.028, 13.514];
    for (const rate of [32_000, 44_100, 48_000]) {
      const rateSamples = rate === sampleRate ? samples : wasm.resample(samples, sampleRate, rate);
      const downbeats = Array.from(wasm.detectDownbeats(rateSamples, rate));
      expect(downbeats).toHaveLength(expected.length);
      for (const [index, time] of downbeats.entries()) {
        expect(time).toBeCloseTo(expected[index], 2);
      }
    }
  }, 30_000);
});
