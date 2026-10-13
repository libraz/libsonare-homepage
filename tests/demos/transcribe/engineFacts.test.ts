// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  type DetectorSettings,
  NOTE_DIVISIONS,
  toTranscribeOptions,
  withMode,
} from '@/demos/transcribe/detectorSettings';
import { eventsToNotes, maxPolyphony, type RollNote } from '@/demos/transcribe/transcribedNotes';
import { noteOffWord, noteOnWord } from '@/utils/ump';
import * as wasm from '@/wasm/index.js';

/**
 * What the page says about the detector, measured on a piano passage rendered
 * by the same built-in piano the page plays back through. A refreshed engine
 * that changes any of these fails here instead of leaving a false sentence on
 * the page.
 */

const SAMPLE_RATE = 48_000;
const BPM = 120;
/** C major triad, a held bass note, then the same key struck twice. */
const PASSAGE: Array<[pitch: number, startPpq: number, endPpq: number]> = [
  [60, 0, 2],
  [64, 0, 2],
  [67, 0, 2],
  [48, 2, 4],
  [72, 4, 4.9],
  [72, 5, 6],
];

let audio: Float32Array;

function report(label: string, value: unknown): void {
  console.info(`  ${label}: ${typeof value === 'object' ? JSON.stringify(value) : value}`);
}

function run(settings: DetectorSettings | null): ReturnType<typeof wasm.transcribe> {
  return wasm.transcribe({
    samples: audio,
    sampleRate: SAMPLE_RATE,
    tempoBpm: BPM,
    ...(settings ? toTranscribeOptions(settings) : {}),
  });
}

const timing = (notes: RollNote[]) =>
  notes.map((n) => `${n.pitch}@${n.startSec.toFixed(4)}-${n.endSec.toFixed(4)}`);

/** One note through the same built-in piano, on its own. */
function renderNote(pitch: number, seconds: number): Float32Array {
  const project = new wasm.Project();
  try {
    project.setSampleRate(SAMPLE_RATE);
    project.setTempoSegments([{ startPpq: 0, bpm: BPM }]);
    const { clipId } = project.addMidiClip(0, 4);
    project.setMidiEvents(clipId, [
      { ppq: 0, data0: noteOnWord(pitch, 96), data1: 0 },
      { ppq: 0.8, data0: noteOffWord(pitch), data1: 0 },
    ]);
    return new Float32Array(
      project.bounceWithSynthInstrument('acoustic-piano', {
        numChannels: 1,
        sampleRate: SAMPLE_RATE,
        totalFrames: Math.round(SAMPLE_RATE * seconds),
      }),
    );
  } finally {
    project.delete();
  }
}

beforeAll(async () => {
  await wasm.init();
  const project = new wasm.Project();
  try {
    project.setSampleRate(SAMPLE_RATE);
    project.setTempoSegments([{ startPpq: 0, bpm: BPM }]);
    const { clipId } = project.addMidiClip(0, 8);
    const events = PASSAGE.flatMap(([pitch, start, end]) => [
      { ppq: start, data0: noteOnWord(pitch, 96), data1: 0, order: 1 },
      { ppq: end, data0: noteOffWord(pitch), data1: 0, order: 0 },
    ])
      .sort((a, b) => a.ppq - b.ppq || a.order - b.order)
      .map(({ ppq, data0, data1 }) => ({ ppq, data0, data1 }));
    project.setMidiEvents(clipId, events);
    audio = new Float32Array(
      project.bounceWithSynthInstrument('acoustic-piano', {
        numChannels: 1,
        sampleRate: SAMPLE_RATE,
        totalFrames: SAMPLE_RATE * 4,
      }),
    );
  } finally {
    project.delete();
  }
});

describe('the detector the transcription page drives', () => {
  it('departs from the engine defaults only in the shortest note, as the page says', () => {
    const engine = (polyphonic: boolean) =>
      wasm.transcribe({ samples: audio, sampleRate: SAMPLE_RATE, tempoBpm: BPM, polyphonic });
    // The engine's own polyphonic shortest note is 60 ms; the page starts at 120.
    expect(DEFAULT_SETTINGS.minNoteMs).toBe(120);
    expect(run({ ...DEFAULT_SETTINGS, minNoteMs: 60 }).events).toEqual(engine(true).events);
    expect(run(withMode({ ...DEFAULT_SETTINGS }, 'mono')).events).toEqual(engine(false).events);
  });

  it('holds a sustained piano note in one piece', () => {
    const notes = eventsToNotes(run({ ...DEFAULT_SETTINGS }).events, BPM);
    report('notes at the page start', notes.length);
    expect(notes.filter((n) => n.pitch === 48)).toHaveLength(1);
  });

  it('finds the chord on the polyphonic path and a single line on the other', () => {
    const poly = eventsToNotes(run({ ...DEFAULT_SETTINGS }).events, BPM);
    const mono = eventsToNotes(run(withMode({ ...DEFAULT_SETTINGS }, 'mono')).events, BPM);
    const chord = poly.filter((n) => n.startSec < 0.2).map((n) => n.pitch);
    report('poly chord pitches', chord);
    report('poly / mono most at once', [maxPolyphony(poly), maxPolyphony(mono)]);
    expect(chord).toEqual(expect.arrayContaining([60, 64, 67]));
    expect(maxPolyphony(mono)).toBeLessThanOrEqual(1);
  });

  it('ignores the pitch split on the polyphonic path', () => {
    const tight = run({ ...DEFAULT_SETTINGS, splitCents: 10 });
    const loose = run({ ...DEFAULT_SETTINGS, splitCents: 200 });
    // The page omits the field on this path; written anyway, it still changes nothing.
    const written = wasm.transcribe({
      samples: audio,
      sampleRate: SAMPLE_RATE,
      tempoBpm: BPM,
      ...toTranscribeOptions(DEFAULT_SETTINGS),
      segmentationThresholdCents: 10,
    });
    expect(tight.events).toEqual(loose.events);
    expect(written.events).toEqual(loose.events);
  });

  it('maps velocity from the floor without dropping a note', () => {
    const low = eventsToNotes(run({ ...DEFAULT_SETTINGS, velocityFloorDb: -80 }).events, BPM);
    const mid = eventsToNotes(run({ ...DEFAULT_SETTINGS, velocityFloorDb: -36 }).events, BPM);
    report('notes at -80 / -36 dB', [low.length, mid.length]);
    // The same notes at the same times; a raised floor only plays them softer.
    expect(timing(mid)).toEqual(timing(low));
    mid.forEach((note, i) => {
      expect(note.velocity).toBeLessThanOrEqual(low[i].velocity);
    });
    expect(mid.some((note, i) => note.velocity < low[i].velocity)).toBe(true);
  });

  it('drops a note far under the loudest whatever the floor', () => {
    // A lone E5 mixed in after the passage: kept at -30 dB, gone at -50 dB
    // (measured: kept at -40, dropped from -45), under every floor.
    const quiet = renderNote(76, 0.6);
    const at = Math.round(3.3 * SAMPLE_RATE);
    const withQuiet = (db: number) => {
      const mix = audio.slice();
      const gain = 10 ** (db / 20);
      for (let i = 0; i < quiet.length && at + i < mix.length; i++) mix[at + i] += quiet[i] * gain;
      return mix;
    };
    for (const floor of [-80, -48, -36]) {
      const found = (db: number) =>
        eventsToNotes(
          wasm.transcribe({
            samples: withQuiet(db),
            sampleRate: SAMPLE_RATE,
            tempoBpm: BPM,
            ...toTranscribeOptions({ ...DEFAULT_SETTINGS, velocityFloorDb: floor }),
          }).events,
          BPM,
        ).some((n) => n.pitch === 76 && n.startSec > 3.1);
      expect(found(-30), `kept at floor ${floor}`).toBe(true);
      expect(found(-50), `dropped at floor ${floor}`).toBe(false);
    }
  });

  it('reads a note-value floor as the same floor in milliseconds at the run tempo', () => {
    // 1/n at BPM lasts 240000 / (BPM * n) ms; 1/16 at 120 BPM is 125 ms.
    for (const mode of ['poly', 'mono'] as const) {
      for (const division of NOTE_DIVISIONS.filter((n) => n > 0)) {
        const base = withMode({ ...DEFAULT_SETTINGS }, mode);
        const byValue = run({ ...base, minNoteDivision: division });
        const byTime = run({ ...base, minNoteMs: 240_000 / (BPM * division) });
        expect(byValue.events, `${mode} 1/${division}`).toEqual(byTime.events);
      }
    }
    expect(() =>
      wasm.transcribe({
        samples: audio,
        sampleRate: SAMPLE_RATE,
        tempoBpm: BPM,
        minNoteDivision: 16,
        minNoteMs: 125,
      }),
    ).toThrow();
  });

  it('folds stereo input to the plain channel average', () => {
    // The page reads one channel through the engine downmix; on stereo that is (L + R) / 2.
    const left = audio.subarray(0, 48_000);
    const right = audio.subarray(48_000, 96_000);
    const [mono] = wasm.downmix([left, right], 0);
    let worst = 0;
    for (let i = 0; i < mono.length; i++) {
      worst = Math.max(worst, Math.abs(mono[i] - (left[i] + right[i]) * 0.5));
    }
    report('stereo fold vs average, max sample difference', worst);
    expect(worst).toBeLessThanOrEqual(1e-7);
  });

  it('refuses a polyphonic limit on the single-line path', () => {
    expect(() =>
      wasm.transcribe({ samples: audio, sampleRate: SAMPLE_RATE, tempoBpm: BPM, maxPolyphony: 4 }),
    ).toThrow();
  });
});
