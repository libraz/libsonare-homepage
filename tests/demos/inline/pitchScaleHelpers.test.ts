// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import * as wasm from '@/wasm/index.js';

/**
 * The pitch-correct and contour widgets ask the engine for scale masks, the
 * distance to the nearest scale tone and Hz-to-MIDI. These pin that the engine
 * answers match the arithmetic the widgets used to carry, so a changed engine
 * fails here rather than moving a figure on the page.
 */

const MASKS = { major: 0xab5, minor: 0x5ad } as const;

/** Nearest-scale-tone distance in cents, by search over the octaves around `m`. */
function searchedCents(m: number, mask: number): number {
  let best = Number.POSITIVE_INFINITY;
  const base = Math.round(m / 12) * 12;
  for (let oct = -1; oct <= 1; oct++) {
    for (let d = 0; d < 12; d++) {
      if (mask & (1 << d)) best = Math.min(best, Math.abs((m - (base + oct * 12 + d)) * 100));
    }
  }
  return best;
}

beforeAll(async () => {
  await wasm.init();
});

describe('engine scale helpers against the arithmetic they replace', () => {
  it('resolves the same 12-bit masks for major and natural minor', () => {
    expect(wasm.scaleMaskForMode(0, 'major')).toBe(MASKS.major);
    expect(wasm.scaleMaskForMode(0, 'minor')).toBe(MASKS.minor);
  });

  it('enables the same pitch classes the mask bits name', () => {
    for (const mask of Object.values(MASKS)) {
      for (let pc = 0; pc < 12; pc++) {
        expect(wasm.scalePitchClassEnabled(0, mask, pc)).toBe(Boolean(mask & (1 << pc)));
      }
    }
  });

  it('measures the same distance to the nearest scale tone', () => {
    // Measured worst case 3.8e-4 cents: float32 inside the engine.
    for (const mask of Object.values(MASKS)) {
      let worst = 0;
      for (let m = 40; m <= 90; m += 0.0137) {
        const engine = Math.abs(wasm.scaleCorrectionSemitones(0, mask, m)) * 100;
        worst = Math.max(worst, Math.abs(engine - searchedCents(m, mask)));
      }
      expect(worst).toBeLessThan(1e-3);
    }
  });

  it('converts Hz to the same fractional MIDI note', () => {
    // Measured worst case 7.1e-6 semitones over 30 Hz to 4 kHz.
    let worst = 0;
    for (let hz = 30; hz < 4000; hz *= 1.0007) {
      worst = Math.max(worst, Math.abs(wasm.hzToMidi(hz) - (69 + 12 * Math.log2(hz / 440))));
    }
    expect(worst).toBeLessThan(1e-5);
    // Unvoiced frames stay guarded at the call site.
    expect(Number.isFinite(wasm.hzToMidi(0))).toBe(false);
  });
});
