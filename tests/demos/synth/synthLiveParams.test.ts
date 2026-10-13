// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import { LIVE_TWEAKS } from '@/demos/synth/synthPatchState';
import { SYNTH_DESTINATION } from '@/demos/synth/useSynthEngine';
import * as wasm from '@/wasm/index.js';

/**
 * A filter, envelope or voice knob moves the notes already sounding through the
 * field's automation id, where rebinding the instrument would cut them. These
 * turn a headless `RealtimeEngine` block by block, the way the worklet does,
 * with a held note.
 */

const SAMPLE_RATE = 48_000;
const BLOCK = 128;
const NOTE = 48;
/** The block the knob turns at, half a second into the held note. */
const CHANGE_BLOCK = Math.round((SAMPLE_RATE * 0.5) / BLOCK);
/** `retrigger: 'note'` seeds every voice from its note, so two renders match sample for sample. */
const PATCH: wasm.SynthPatch = { preset: 'saw-lead', retrigger: 'note' };

type Engine = InstanceType<typeof wasm.RealtimeEngine>;

function render(patch: wasm.SynthPatch, at: Map<number, (engine: Engine) => void>): Float32Array {
  const engine = new wasm.RealtimeEngine(SAMPLE_RATE, BLOCK, 1024, 1024);
  try {
    engine.setSynthInstrument(patch, SYNTH_DESTINATION);
    engine.setMidiInputSource(SYNTH_DESTINATION);
    const blocks = Math.ceil((SAMPLE_RATE * 1.5) / BLOCK);
    const out = new Float32Array(blocks * BLOCK);
    const left = new Float32Array(BLOCK);
    const right = new Float32Array(BLOCK);
    for (let block = 0; block < blocks; block++) {
      at.get(block)?.(engine);
      left.fill(0);
      right.fill(0);
      out.set(engine.process([left, right])[0], block * BLOCK);
    }
    return out;
  } finally {
    engine.destroy();
  }
}

function peak(a: Float32Array, from: number, to: number): number {
  let max = 0;
  for (let i = from; i < to; i++) max = Math.max(max, Math.abs(a[i]));
  return max;
}

function maxDiff(a: Float32Array, b: Float32Array, from = 0, to = a.length): number {
  let max = 0;
  for (let i = from; i < to; i++) max = Math.max(max, Math.abs(a[i] - b[i]));
  return max;
}

const holdNote = (engine: Engine) => engine.pushMidiInputNoteOn(0, 0, NOTE, 100, 0);
const turnCutoff = (engine: Engine) =>
  engine.setParameterSmoothed(
    engine.resolveInstrumentAutomationId(SYNTH_DESTINATION, 'cutoffHz'),
    400,
  );

beforeAll(async () => {
  await wasm.init();
}, 30_000);

describe('live synth knobs', () => {
  it('resolves an automation id for every knob the deck moves live', () => {
    const engine = new wasm.RealtimeEngine(SAMPLE_RATE, BLOCK, 1024, 1024);
    try {
      engine.setSynthInstrument(PATCH, SYNTH_DESTINATION);
      for (const name of LIVE_TWEAKS) {
        expect(
          engine.resolveInstrumentAutomationId(SYNTH_DESTINATION, name),
          name,
        ).toBeGreaterThanOrEqual(0);
      }
      // Structural fields have no id: they need a rebind.
      expect(engine.resolveInstrumentAutomationId(SYNTH_DESTINATION, 'waveform')).toBe(-1);
    } finally {
      engine.destroy();
    }
  });

  it('changes a held note in place, without cutting or restriking it', () => {
    const reference = render(PATCH, new Map([[0, holdNote]]));
    const live = render(
      PATCH,
      new Map([
        [0, holdNote],
        [CHANGE_BLOCK, turnCutoff],
      ]),
    );
    const change = CHANGE_BLOCK * BLOCK;
    const after = change + SAMPLE_RATE * 0.3;
    const window: [number, number] = [after, after + SAMPLE_RATE * 0.3];

    expect(maxDiff(reference, live, 0, change)).toBe(0);
    expect(maxDiff(reference, live, after)).toBeGreaterThan(0.01);
    expect(peak(live, ...window)).toBeGreaterThan(0.5 * peak(reference, ...window));
  });

  it('lands on the same sound the patch value gives', () => {
    const viaKnob = render(
      { ...PATCH, cutoffHz: 2000 },
      new Map([
        [
          0,
          (engine: Engine) =>
            engine.setParameter(
              engine.resolveInstrumentAutomationId(SYNTH_DESTINATION, 'cutoffHz'),
              400,
            ),
        ],
        [2, holdNote],
      ]),
    );
    const viaPatch = render({ ...PATCH, cutoffHz: 400 }, new Map([[2, holdNote]]));
    expect(maxDiff(viaKnob, viaPatch)).toBe(0);
  });

  it('cuts a held note when the instrument is rebound, which is why structural edits restrike', () => {
    const rebound = render(
      PATCH,
      new Map([
        [0, holdNote],
        [
          CHANGE_BLOCK,
          (engine: Engine) =>
            engine.setSynthInstrument({ ...PATCH, waveform: 'square' }, SYNTH_DESTINATION),
        ],
      ]),
    );
    const change = CHANGE_BLOCK * BLOCK;
    expect(peak(rebound, change + SAMPLE_RATE * 0.05, change + SAMPLE_RATE * 0.6)).toBe(0);
  });
});
