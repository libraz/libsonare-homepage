// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import { SYNTH_DESTINATION } from '@/demos/synth/useSynthEngine';
import * as wasm from '@/wasm/index.js';

const SAMPLE_RATE = 44_100;
const BLOCK = 128;

/** Peak of a short render after pushing `words` to the live input source. */
function peakAfter(words: number[]): number {
  const engine = new wasm.RealtimeEngine(SAMPLE_RATE, BLOCK, 1024, 1024);
  try {
    engine.setSynthInstrument('acoustic-piano', SYNTH_DESTINATION);
    engine.setMidiInputSource(SYNTH_DESTINATION);
    engine.pushMidiInputUmp(Uint32Array.from(words), 0);
    let peak = 0;
    for (let i = 0; i < 40; i++) {
      const left = new Float32Array(BLOCK);
      const right = new Float32Array(BLOCK);
      for (const plane of engine.process([left, right])) {
        for (const v of plane) peak = Math.max(peak, Math.abs(v));
      }
    }
    return peak;
  } finally {
    engine.destroy();
  }
}

beforeAll(async () => {
  await wasm.init();
}, 30_000);

describe('MIDI 2.0 note-on routing', () => {
  it('sounds regardless of the packet group and channel', () => {
    const own = peakAfter([0x40903c00, 0xc0000000]);
    const other = peakAfter([0x41953c00, 0xc0000000]);
    expect(own).toBeGreaterThan(0);
    expect(other).toBeCloseTo(own, 6);
  });
});
