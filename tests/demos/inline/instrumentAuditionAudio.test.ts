// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import { deinterleaveStereo, peakNormalizeStereo } from '@/demos/inline/instrumentAuditionAudio';
import { buildSmf, dt1, noteEvents } from '@/utils/gsSysex';
import * as wasm from '@/wasm/index.js';

const SAMPLE_RATE = 44_100;
const RENDER_FRAMES = Math.round(SAMPLE_RATE * 1.7);

function renderGsEffect(type: number, realization: 'modern' | 'classic'): Float32Array {
  const project = new wasm.Project();
  try {
    project.setSampleRate(SAMPLE_RATE);
    project.importSmf(
      buildSmf(
        [
          { beat: 0, sysex: dt1([0x40, 0x03, 0x00, (type >> 8) & 0x7f, type & 0x7f]) },
          { beat: 0, sysex: dt1([0x40, 0x41, 0x22, 1]) },
          ...noteEvents(0, 60, 112, 0, 1.2),
        ],
        1.5,
      ),
    );
    return project.bounceWithSf2Instrument(
      { gsEfxRealization: realization },
      { numChannels: 2, sampleRate: SAMPLE_RATE, totalFrames: RENDER_FRAMES },
    );
  } finally {
    project.delete();
  }
}

describe('embedded instrument audition audio', () => {
  beforeAll(async () => {
    await wasm.init();
  }, 60_000);

  it('deinterleaves exact frames into their original left and right channels', () => {
    const audio = deinterleaveStereo(new Float32Array([1, 10, 2, 20, 3, 30]), 3, SAMPLE_RATE);

    expect(audio.sampleRate).toBe(SAMPLE_RATE);
    expect(audio.left).toEqual(new Float32Array([1, 2, 3]));
    expect(audio.right).toEqual(new Float32Array([10, 20, 30]));
  });

  it('uses one peak gain for both channels', () => {
    const audio = peakNormalizeStereo({
      left: new Float32Array([0.25, -0.5]),
      right: new Float32Array([1, -0.25]),
      sampleRate: SAMPLE_RATE,
    });

    expect(audio.left).toEqual(new Float32Array([0.225, -0.45]));
    expect(audio.right).toEqual(new Float32Array([0.9, -0.225]));
  });

  it('keeps the native 3D effect as a real stereo render', () => {
    const events = [
      { beat: 0, sysex: dt1([0x40, 0x03, 0x00, 0x01, 0x71]) },
      { beat: 0, sysex: dt1([0x40, 0x41, 0x22, 1]) },
      ...noteEvents(0, 60, 112, 0, 1.2),
    ];
    const project = new wasm.Project();
    try {
      project.setSampleRate(SAMPLE_RATE);
      expect(project.importSmf(buildSmf(events, 1.5))).toBeGreaterThanOrEqual(0);
      const interleaved = project.bounceWithSf2Instrument(
        { gsEfxRealization: 'modern' },
        { numChannels: 2, sampleRate: SAMPLE_RATE, totalFrames: RENDER_FRAMES },
      );
      expect(interleaved.length).toBe(RENDER_FRAMES * 2);
      const audio = deinterleaveStereo(interleaved, RENDER_FRAMES, SAMPLE_RATE);
      let difference = 0;
      let energy = 0;
      for (let i = 0; i < RENDER_FRAMES; i++) {
        difference = Math.max(difference, Math.abs(audio.left[i] - audio.right[i]));
        energy = Math.max(energy, Math.abs(audio.left[i]), Math.abs(audio.right[i]));
      }
      expect(energy).toBeGreaterThan(1e-5);
      expect(difference).toBeGreaterThan(1e-6);
    } finally {
      project.delete();
    }
  });

  it('passes the selected modern or classic EFX realization to the native bounce', () => {
    const modern = renderGsEffect(0x0110, 'modern');
    const classic = renderGsEffect(0x0110, 'classic');
    expect(modern.length).toBe(RENDER_FRAMES * 2);
    expect(classic.length).toBe(RENDER_FRAMES * 2);
    let maximumDifference = 0;
    for (let i = 0; i < modern.length; i++) {
      maximumDifference = Math.max(maximumDifference, Math.abs(modern[i] - classic[i]));
    }
    expect(maximumDifference).toBeGreaterThan(1e-4);
  });
});
