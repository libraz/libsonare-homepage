import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  decodeMidiEvent,
  decodeTranscribedNotes,
  renderTranscription,
  type TranscribeMidiEvent,
} from '@/demos/inline/archetypes/transcribePipeline';
import * as wasm from '@/wasm/index.js';

interface LeadClip {
  samples: Float32Array;
  sampleRate: number;
}

function loadWav(): LeadClip {
  const bytes = readFileSync(join(process.cwd(), 'src', 'public', 'demo-clips', 'lead.wav'));
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let channels = 0;
  let sampleRate = 0;
  let dataOffset = 0;
  let dataSize = 0;
  for (let offset = 12; offset + 8 <= bytes.length; ) {
    const id = bytes.toString('ascii', offset, offset + 4);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (id === 'fmt ') {
      channels = view.getUint16(body + 2, true);
      sampleRate = view.getUint32(body + 4, true);
    } else if (id === 'data') {
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
      sum += view.getInt16(dataOffset + (frame * channels + channel) * 2, true) / 32768;
    }
    samples[frame] = sum / channels;
  }
  return { samples, sampleRate };
}

function midiEvent(
  ppq: number,
  status: number,
  note: number,
  velocity: number,
): TranscribeMidiEvent {
  return {
    ppq,
    data0: (0x2 << 28) | (status << 20) | (note << 8) | velocity,
  };
}

let lead: LeadClip;

beforeAll(async () => {
  await wasm.init({ wasmBinary: readFileSync(join(process.cwd(), 'src', 'wasm', 'sonare.wasm')) });
  lead = loadWav();
}, 30_000);

describe('transcription event decoding', () => {
  it('pairs note-on/off events and accepts note-on velocity zero as note-off', () => {
    const events = [
      midiEvent(0, 0x9, 60, 100),
      midiEvent(1.5, 0x9, 60, 0),
      midiEvent(2, 0x9, 64, 90),
      midiEvent(3, 0x8, 64, 0),
    ];
    expect(decodeMidiEvent(events[0])).toMatchObject({ status: 0x9, note: 60, velocity: 100 });
    expect(decodeTranscribedNotes(events)).toEqual([
      { startPpq: 0, endPpq: 1.5, midi: 60, velocity: 100, group: 0, channel: 0 },
      { startPpq: 2, endPpq: 3, midi: 64, velocity: 90, group: 0, channel: 0 },
    ]);
  });
});

describe('real lead transcription and piano bounce', () => {
  it('recognizes the shipped lead without mutating the source and renders finite piano audio', () => {
    const before = lead.samples.slice();
    const result = renderTranscription(wasm, lead.samples, lead.sampleRate);

    expect(lead.sampleRate).toBe(32_000);
    expect(lead.samples).toEqual(before);
    expect(result.noteCount).toBe(14);
    expect(result.events).toHaveLength(28);
    expect(result.notes).toHaveLength(14);
    expect(result.notes.map((note) => note.midi)).toEqual([
      72, 74, 76, 79, 76, 74, 72, 69, 72, 76, 77, 74, 72, 67,
    ]);
    expect(result.tempoBpm).toBeCloseTo(120.4217, 3);
    expect(result.piano.length).toBeGreaterThan(lead.samples.length);
    expect(result.piano.every(Number.isFinite)).toBe(true);
    expect(result.piano.some((sample) => Math.abs(sample) > 1e-5)).toBe(true);
    expect(result.pianoDurationSec).toBeCloseTo(result.piano.length / lead.sampleRate, 8);
  }, 30_000);
});
