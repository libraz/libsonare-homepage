// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import {
  SYNTH_DESTINATION,
  SYNTH_MASTER_STRIP_JSON,
  SYNTH_OUTPUT_GAIN_DEFAULT,
  SYNTH_OUTPUT_GAIN_MAX,
} from '@/demos/synth/useSynthEngine';
import { MASTER_LIMITER_CEILING } from '@/utils/masterLimiter';
import * as wasm from '@/wasm/index.js';

/**
 * The worklet multiplies the engine's output by a monitor gain and writes it to
 * the destination with nothing after it, so the engine's master-strip limiter
 * is the only thing between an eight-note fortissimo chord and the DAC. These
 * render exactly what the worklet renders — same engine construction, master
 * strip, live MIDI input path and block size — and pin that the loudest
 * programs at the knob's own maximum stay under full scale, while a program
 * that never reaches the ceiling is left alone.
 */

const SAMPLE_RATE = 44_100;
const BLOCK = 128;
const SECONDS = 2;
/** A wide eight-note chord (C3 to G5) and eight kit voices. */
const CHORD = [48, 55, 60, 64, 67, 72, 76, 79];
const KIT = [36, 38, 42, 46, 49, 51, 45, 47];

interface Rendered {
  peak: number;
}

/** Render a held chord through the worklet's engine setup, at `gain`. */
function render(
  preset: string,
  notes: number[],
  velocity: number,
  gain: number,
  limiter = true,
): Rendered {
  const engine = new wasm.RealtimeEngine(SAMPLE_RATE, BLOCK, 1024, 1024);
  try {
    if (limiter) engine.setMasterStripJson(SYNTH_MASTER_STRIP_JSON);
    engine.setSynthInstrument(preset, SYNTH_DESTINATION);
    engine.setMidiInputSource(SYNTH_DESTINATION);
    for (const note of notes) engine.pushMidiInputNoteOn(0, 0, note, velocity, 0);
    const left = new Float32Array(BLOCK);
    const right = new Float32Array(BLOCK);
    let peak = 0;
    for (let rendered = 0; rendered < SAMPLE_RATE * SECONDS; rendered += BLOCK) {
      left.fill(0);
      right.fill(0);
      const out = engine.process([left, right]);
      for (const plane of out) {
        for (let i = 0; i < BLOCK; i++) {
          const a = Math.abs(plane[i] * gain);
          if (a > peak) peak = a;
        }
      }
    }
    return { peak };
  } finally {
    engine.destroy();
  }
}

beforeAll(async () => {
  await wasm.init();
}, 30_000);

describe('synth output level', () => {
  it.each([
    ['acoustic-piano', CHORD],
    ['drum-kit', KIT],
    ['bell', CHORD],
    ['violin', CHORD],
  ])(
    '%s: an eight-note fortissimo chord at the knob maximum stays under full scale',
    (preset, notes) => {
      const { peak } = render(preset, notes, 127, SYNTH_OUTPUT_GAIN_MAX);
      expect(peak).toBeLessThan(1);
      // The limiter, not luck: the same chord without it overshoots.
      expect(render(preset, notes, 127, SYNTH_OUTPUT_GAIN_MAX, false).peak).toBeGreaterThan(1);
    },
  );

  it('holds the ceiling the master strip declares, so the monitor gain cannot undo it', () => {
    const { peak } = render('violin', CHORD, 127, 1);
    expect(peak).toBeLessThanOrEqual(MASTER_LIMITER_CEILING * 1.02);
    expect(MASTER_LIMITER_CEILING * SYNTH_OUTPUT_GAIN_MAX).toBeLessThan(1);
  });

  it('leaves a program that never reaches the ceiling at the level it renders', () => {
    const withLimiter = render('e-piano', CHORD, 127, SYNTH_OUTPUT_GAIN_DEFAULT).peak;
    const without = render('e-piano', CHORD, 127, SYNTH_OUTPUT_GAIN_DEFAULT, false).peak;
    expect(without).toBeLessThan(MASTER_LIMITER_CEILING);
    expect(Math.abs(withLimiter - without)).toBeLessThan(1e-3);
  });
});
