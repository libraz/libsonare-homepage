// @vitest-environment node
import { describe, expect, it } from 'vitest';
import * as wasm from '@/wasm/index.js';

/**
 * The acoustic-analysis page says a material preset covers every surface, so an
 * all-carpet room barely absorbs at 125 Hz and rings there for seconds. This
 * holds that to a synthesized room.
 */

const SAMPLE_RATE = 48_000;

const studio = {
  lengthM: 6.5,
  widthM: 4.8,
  heightM: 3,
  absorption: 0.26,
  sourceX: 1.4,
  sourceY: 1.2,
  sourceZ: 1.4,
  listenerX: 4.8,
  listenerY: 3.4,
  listenerZ: 1.5,
  ismOrder: 2,
  seed: 1337,
  maxSeconds: 12,
  sampleRate: SAMPLE_RATE,
};

function lowBandRt60(materialPreset: number): number {
  const { rir } = wasm.synthesizeRir({ ...studio, materialPreset });
  return wasm.analyzeImpulseResponse(rir, SAMPLE_RATE, 6).rt60Bands[0];
}

describe('material presets', () => {
  it('leaves an all-carpet room ringing for seconds at 125 Hz', async () => {
    await wasm.init();
    // The scalar absorption the preset replaces decays in well under a second.
    expect(lowBandRt60(0)).toBeLessThan(1);
    expect(lowBandRt60(4)).toBeGreaterThan(4);
  }, 60_000);
});
