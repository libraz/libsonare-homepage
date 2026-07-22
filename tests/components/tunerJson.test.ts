import { describe, expect, it } from 'vitest';
import { jsonToSpec } from '@/components/tuner/tunerJson';
import { buildDefaultSpec, renderNoteOffline } from '@/tuner/dsp/engine';
import type { ModalPatchParams } from '@/tuner/dsp/modal-voice';
import { MAX_MODAL_MODES } from '@/tuner/dsp/modal-voice';

const SR = 48000;

/**
 * Import validation for {@link jsonToSpec}: a hand-edited or corrupt patch must
 * be clamped/coerced into a renderable spec instead of throwing at render (which
 * previously escaped as an unhandled rejection and silently stopped the A/B
 * compare). Range/finiteness is enforced without weakening the values a valid
 * patch round-trips.
 */
describe('jsonToSpec import validation (M-21)', () => {
  it('does not throw and stays renderable when a modal patch declares more modes than it lists', () => {
    // numModes says 8 but the modes table is missing entirely — the old
    // Object.assign left `modes` undefined and render() threw on `src.ratio`.
    const patch = {
      format: 'libsonare-physical-model',
      version: 1,
      engine: 'modal',
      params: { numModes: 8 },
    };
    let spec: ReturnType<typeof jsonToSpec> | undefined;
    expect(() => {
      spec = jsonToSpec(patch);
    }).not.toThrow();
    const modal = spec?.modal as ModalPatchParams;
    // The table is sized to the struct capacity so every index < numModes exists.
    expect(modal.modes).toHaveLength(MAX_MODAL_MODES);
    expect(modal.numModes).toBe(8);
    expect(() => renderNoteOffline(spec!, 60, 100, SR, Math.round(SR * 0.25))).not.toThrow();
  });

  it('sizes a short modes table up to the declared count and renders', () => {
    const patch = {
      engine: 'modal',
      params: {
        numModes: 6,
        modes: [
          { ratio: 1.0, gain: 1.0, decayScale: 1.0 },
          { ratio: 2.7, gain: 0.6, decayScale: 0.7 },
        ],
      },
    };
    const spec = jsonToSpec(patch);
    const modal = spec.modal as ModalPatchParams;
    expect(modal.modes).toHaveLength(MAX_MODAL_MODES);
    // Supplied entries are kept verbatim.
    expect(modal.modes[0].ratio).toBe(1.0);
    expect(modal.modes[1].ratio).toBe(2.7);
    // Missing entries fall back to the default table element (finite numbers).
    for (const m of modal.modes) {
      expect(Number.isFinite(m.ratio)).toBe(true);
      expect(Number.isFinite(m.gain)).toBe(true);
      expect(Number.isFinite(m.decayScale)).toBe(true);
    }
    expect(() => renderNoteOffline(spec, 60, 100, SR, Math.round(SR * 0.25))).not.toThrow();
  });

  it('drops modes past the struct capacity', () => {
    const modes = Array.from({ length: 20 }, () => ({ ratio: 1, gain: 0.1, decayScale: 1 }));
    const spec = jsonToSpec({ engine: 'modal', params: { numModes: 8, modes } });
    expect((spec.modal as ModalPatchParams).modes).toHaveLength(MAX_MODAL_MODES);
  });

  it('clamps out-of-range scalars to the parameter range', () => {
    const spec = jsonToSpec({
      engine: 'karplus-strong',
      params: {
        brightness: 5, // range [0, 1]
        pickPosition: 9, // range [0, 0.5]
        decayStretch: -3, // range [0, 1]
      },
    });
    const ks = spec.ks!;
    expect(ks.brightness).toBe(1);
    expect(ks.pickPosition).toBe(0.5);
    expect(ks.decayStretch).toBe(0);
  });

  it('clamps an out-of-range integer count', () => {
    const spec = jsonToSpec({ engine: 'modal', params: { numModes: 999 } });
    expect((spec.modal as ModalPatchParams).numModes).toBe(MAX_MODAL_MODES);
    const spec2 = jsonToSpec({ engine: 'modal', params: { numModes: -4 } });
    expect((spec2.modal as ModalPatchParams).numModes).toBe(0);
  });

  it('coerces non-finite values back to the engine defaults', () => {
    const defaults = buildDefaultSpec('karplus-strong').ks!;
    const spec = jsonToSpec({
      engine: 'karplus-strong',
      params: {
        decayS: Number.NaN,
        excBrightness: Number.POSITIVE_INFINITY,
        pickPosition: 'nope',
      },
    });
    const ks = spec.ks!;
    expect(ks.decayS).toBe(defaults.decayS);
    expect(ks.excBrightness).toBe(defaults.excBrightness);
    expect(ks.pickPosition).toBe(defaults.pickPosition);
  });

  it('coerces non-finite wrapper fields back to the defaults', () => {
    const defaults = buildDefaultSpec('karplus-strong');
    const spec = jsonToSpec({
      engine: 'karplus-strong',
      wrapper: {
        gain: Number.NaN,
        bodyMix: Number.POSITIVE_INFINITY,
        drive: 'x',
        ampEnv: { attackMs: Number.NaN, releaseMs: 42 },
      },
    });
    expect(spec.gain).toBe(defaults.gain);
    expect(spec.bodyMix).toBe(defaults.bodyMix);
    expect(spec.drive).toBe(defaults.drive);
    expect(spec.ampEnv.attackMs).toBe(defaults.ampEnv.attackMs);
    expect(spec.ampEnv.releaseMs).toBe(42);
  });

  it('preserves a valid in-range patch verbatim', () => {
    const spec = jsonToSpec({
      engine: 'karplus-strong',
      params: { brightness: 0.42, decayS: 2.5, sympathetic: true },
    });
    expect(spec.ks!.brightness).toBe(0.42);
    expect(spec.ks!.decayS).toBe(2.5);
    expect(spec.ks!.sympathetic).toBe(true);
  });

  it('still rejects a patch with an unknown engine', () => {
    expect(() => jsonToSpec({ engine: 'theremin', params: {} })).toThrow();
  });
});
