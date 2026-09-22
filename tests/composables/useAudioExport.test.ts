import { describe, expect, it } from 'vitest';
import { useAudioExport } from '@/composables/useAudioExport';

const { mixStems, exportWav, exportMidi } = useAudioExport();

async function wavHeader(blob: Blob) {
  const view = new DataView(await blob.arrayBuffer());
  return { channels: view.getUint16(22, true), sampleRate: view.getUint32(24, true) };
}

describe('mixStems', () => {
  it('runs as long as the longest stem, so a release tail survives', () => {
    const mix = mixStems([new Float32Array([0.1, 0.1]), new Float32Array([0.2, 0.2, 0.2, 0.2])]);
    expect(mix).toHaveLength(4);
    expect(mix![0]).toBeCloseTo(0.3, 6);
    expect(mix![3]).toBeCloseTo(0.2, 6);
  });

  it('scales each stem by its gain and the sum by the master gain', () => {
    const mix = mixStems([new Float32Array([1]), new Float32Array([1])], {
      gains: [0.5, 0.25],
      masterGain: 2,
    });
    expect(mix![0]).toBeCloseTo(1.5, 6);
  });

  it('treats a missing gain as unity', () => {
    const mix = mixStems([new Float32Array([0.3]), new Float32Array([0.3])], { gains: [0] });
    expect(mix![0]).toBeCloseTo(0.3, 6);
  });

  it('has nothing to mix from no stems or empty ones', () => {
    expect(mixStems([])).toBeNull();
    expect(mixStems([new Float32Array(0)])).toBeNull();
  });
});

describe('exportWav', () => {
  it('encodes the mix at the stated rate and channel count', async () => {
    const blob = exportWav([new Float32Array([0.1, -0.1, 0.2, -0.2])], {
      sampleRate: 44_100,
      numChannels: 2,
    })!;
    expect(blob.type).toBe('audio/wav');
    expect(await wavHeader(blob)).toEqual({ channels: 2, sampleRate: 44_100 });
    // A 44-byte header and two frames of two 16-bit samples.
    expect(blob.size).toBe(44 + 2 * 2 * 2);
  });

  it('hands back nothing rather than an empty file', () => {
    expect(exportWav([], { sampleRate: 48_000, numChannels: 2 })).toBeNull();
  });
});

describe('exportMidi', () => {
  it('wraps the SMF bytes untouched', async () => {
    const smf = new Uint8Array([0x4d, 0x54, 0x68, 0x64]);
    const blob = exportMidi(smf);
    expect(blob.type).toBe('audio/midi');
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(smf);
  });
});
