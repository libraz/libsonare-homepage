import { describe, expect, it } from 'vitest';
import { buildDefaultSpec, renderNoteOffline } from '@/tuner/dsp/engine';
import { ENGINE_ORDER } from '@/tuner/dsp/params';

const SR = 48000;

function peak(buf: Float32Array): number {
  let p = 0;
  for (const s of buf) {
    const a = Math.abs(s);
    if (a > p) p = a;
  }
  return p;
}

describe('engine dispatch — all models play from their default spec', () => {
  for (const mode of ENGINE_ORDER) {
    it(`${mode} renders an audible note`, () => {
      const spec = buildDefaultSpec(mode);
      // A mid-register note in every instrument's range.
      const buf = renderNoteOffline(spec, 60, 100, SR, Math.round(SR * 0.5));
      expect(peak(buf)).toBeGreaterThan(0.001);
      expect(Number.isFinite(peak(buf))).toBe(true);
    });
  }
});
