import { describe, expect, it } from 'vitest';
import { activeParams } from '@/components/tuner/tunerJson';
import { buildDrumSeedSpec } from '@/tuner/dsp/drum-seeds';
import { buildDefaultSpec } from '@/tuner/dsp/engine';
import { MACROS } from '@/tuner/dsp/macros';
import { ENGINE_ORDER, type PhysicalEngineMode, paramSpecsFor } from '@/tuner/dsp/params';

/**
 * The knob descriptors are derived from name-suffix heuristics plus an override
 * table transcribed from the C++ clamps. A range that disagrees with the core is
 * silently lossy rather than loud: the knob quantizes to `round(v / step) * step`
 * and clamps to `[min, max]`, and the JSON importer clamps to the same range, so
 * a value the range cannot represent is destroyed on a patch round-trip and its
 * knob travel does nothing. These tests pin the three ways a value reaches the
 * UI — the engine defaults, the seeded drum patches, and the macro sweeps — to
 * ranges that can actually hold them.
 */

/** Every scalar of `params` that its knob descriptor cannot represent. */
function unrepresentable(
  params: Record<string, unknown>,
  engine: PhysicalEngineMode,
  checkGrid: boolean,
  label: string,
): string[] {
  const bad: string[] = [];
  for (const ps of paramSpecsFor(params, engine)) {
    const v = params[ps.key];
    if (typeof v !== 'number' || ps.bool) continue;
    if (v < ps.min || v > ps.max) {
      bad.push(`${label}.${ps.key}=${v} outside [${ps.min}, ${ps.max}]`);
      continue;
    }
    if (checkGrid && Math.abs(Math.round(v / ps.step) * ps.step - v) > 1e-9) {
      bad.push(`${label}.${ps.key}=${v} off the step-${ps.step} grid`);
    }
  }
  return bad;
}

describe('knob ranges hold every value the tuner produces', () => {
  it('each engine default is in range and lands on its step grid', () => {
    const bad: string[] = [];
    for (const mode of ENGINE_ORDER) {
      const params = activeParams(buildDefaultSpec(mode)) as Record<string, unknown>;
      bad.push(...unrepresentable(params, mode, true, mode));
    }
    expect(bad).toEqual([]);
  });

  it('every seeded drum patch is in range', () => {
    const bad: string[] = [];
    // The GM drum map's full key span.
    for (let note = 27; note <= 87; ++note) {
      const params = activeParams(buildDrumSeedSpec(note)) as Record<string, unknown>;
      bad.push(...unrepresentable(params, 'percussion', false, `note ${note}`));
    }
    expect(bad).toEqual([]);
  });

  it('every macro sweeps between values its knob can hold', () => {
    const bad: string[] = [];
    for (const mode of ENGINE_ORDER) {
      const params = activeParams(buildDefaultSpec(mode)) as Record<string, unknown>;
      const specs = new Map(paramSpecsFor(params, mode).map((s) => [s.key, s] as const));
      for (const def of MACROS[mode]) {
        for (const p of def.params) {
          const ps = specs.get(p.key);
          if (!ps) continue;
          for (const v of [p.at0, p.at1]) {
            if (v < ps.min || v > ps.max) {
              bad.push(`${mode}.${def.id}.${p.key}=${v} outside [${ps.min}, ${ps.max}]`);
            }
          }
        }
      }
    }
    expect(bad).toEqual([]);
  });
});

describe('engine-scoped range overrides', () => {
  it('caps the mode count per engine at what the core allocates', () => {
    const modal = paramSpecsFor(
      activeParams(buildDefaultSpec('modal')) as Record<string, unknown>,
      'modal',
    );
    const perc = paramSpecsFor(
      activeParams(buildDefaultSpec('percussion')) as Record<string, unknown>,
      'percussion',
    );
    // kMaxModalModes = 8, kMaxPercussionModes = 6.
    expect(modal.find((s) => s.key === 'numModes')?.max).toBe(8);
    expect(perc.find((s) => s.key === 'numModes')?.max).toBe(6);
  });
});
