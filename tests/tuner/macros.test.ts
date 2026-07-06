import { describe, expect, it } from 'vitest';
import { enCopy, jaCopy } from '@/components/tuner/tunerCopy';
import { activeParams } from '@/components/tuner/tunerJson';
import { buildDefaultSpec } from '@/tuner/dsp/engine';
import { applyMacro, deriveMacroValue, MACROS, macrosFor } from '@/tuner/dsp/macros';
import { ENGINE_ORDER, type PhysicalEngineMode } from '@/tuner/dsp/params';

const ENGINES = ENGINE_ORDER;

describe('macro maps', () => {
  it('every engine has macros', () => {
    for (const mode of ENGINES) expect(macrosFor(mode).length).toBeGreaterThan(0);
  });

  it('every mapped param exists on its engine default params', () => {
    for (const mode of ENGINES) {
      const params = activeParams(buildDefaultSpec(mode)) as Record<string, unknown>;
      for (const def of MACROS[mode]) {
        for (const p of def.params) {
          expect(typeof params[p.key], `${mode}.${def.id}.${p.key}`).toBe('number');
        }
      }
    }
  });

  it('macro ids are unique within an engine and own disjoint params', () => {
    for (const mode of ENGINES) {
      const ids = new Set<string>();
      const owned = new Set<string>();
      for (const def of MACROS[mode]) {
        expect(ids.has(def.id), `dup id ${mode}.${def.id}`).toBe(false);
        ids.add(def.id);
        for (const p of def.params) {
          expect(owned.has(p.key), `shared param ${mode}.${p.key}`).toBe(false);
          owned.add(p.key);
        }
      }
    }
  });

  it('every macro id has EN + JA copy', () => {
    const en = enCopy.macros.items as Record<string, unknown>;
    const ja = jaCopy.macros.items as Record<string, unknown>;
    for (const mode of ENGINES) {
      for (const def of MACROS[mode]) {
        expect(en[def.id], `EN copy for ${def.id}`).toBeTruthy();
        expect(ja[def.id], `JA copy for ${def.id}`).toBeTruthy();
      }
    }
  });
});

describe('applyMacro / deriveMacroValue round-trip', () => {
  it('apply then derive recovers the value for every macro', () => {
    for (const mode of ENGINES) {
      for (const def of MACROS[mode]) {
        for (const v of [0, 0.25, 0.5, 0.75, 1]) {
          const params = activeParams(buildDefaultSpec(mode)) as Record<string, number>;
          Object.assign(params, applyMacro(def, v));
          expect(deriveMacroValue(params, def), `${mode}.${def.id}@${v}`).toBeCloseTo(v, 5);
        }
      }
    }
  });

  it('clamps out-of-range macro input', () => {
    const def = MACROS['karplus-strong'][0];
    const lo = applyMacro(def, -1);
    const hi = applyMacro(def, 2);
    const key = def.params[0].key;
    expect(lo[key]).toBeCloseTo(def.params[0].at0, 5);
    expect(hi[key]).toBeCloseTo(def.params[0].at1, 5);
  });

  it('default spec derives a macro value inside [0,1]', () => {
    for (const mode of ENGINES) {
      const params = activeParams(buildDefaultSpec(mode)) as Record<string, unknown>;
      for (const def of MACROS[mode]) {
        const v = deriveMacroValue(params, def);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });
});

// Type guard: MACROS covers exactly the PhysicalEngineMode union.
it('MACROS keys match the engine union', () => {
  const keys = Object.keys(MACROS) as PhysicalEngineMode[];
  expect(keys.sort()).toEqual([...ENGINE_ORDER].sort());
});
