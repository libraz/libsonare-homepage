// @vitest-environment node
// The gate bundles the TS preset map with esbuild, whose TextEncoder invariant
// fails under jsdom; the node environment is also how `yarn check:mastering` runs.
import { describe, expect, it } from 'vitest';
import {
  MASTERING_PRESET_TARGETS,
  MASTERING_PRESETS,
  MASTERING_VENUES,
} from '@/demos/mastering/masteringUi';
import * as wasm from '@/wasm/index.js';
import {
  assertFinite,
  buildPresetEntries,
  length,
  loadMasteringModule,
  makeReferenceMix,
  makeSyntheticMix,
  maxAbs,
  sampleRate,
  validateMasteringPresets,
} from '../../scripts/validate-mastering-presets.mjs';

async function entries(names: string[]) {
  const all = await buildPresetEntries();
  return all.filter(([name]: [string]) => names.includes(name));
}

describe('validate-mastering-presets helpers', () => {
  it('builds deterministic, bounded 48 kHz test mixes', () => {
    const source = makeSyntheticMix();
    const reference = makeReferenceMix();
    expect(sampleRate).toBe(48_000);
    expect(source.left.length).toBe(length);
    expect(source.right.length).toBe(length);
    expect(reference.left.length).toBe(length);
    expect(maxAbs(source.left)).toBeGreaterThan(0.1);
    expect(maxAbs(source.left)).toBeLessThan(1);
    expect(maxAbs(reference.right)).toBeLessThan(1);
    expect(makeSyntheticMix().left).toEqual(source.left);
  });

  it('throws for a non-finite measurement', () => {
    expect(() => assertFinite('x', Number.NaN)).toThrow('x is not finite');
    expect(() => assertFinite('x', -14)).not.toThrow();
  });

  it('enumerates every genre preset in every venue at the genre target', async () => {
    const all = await buildPresetEntries();
    expect(all.map(([name]: [string]) => name)).toEqual(
      MASTERING_PRESETS.flatMap(({ id: preset }) =>
        MASTERING_VENUES.map(({ id: venue }) => `${preset}/${venue}`),
      ),
    );
    const { masteringTargetLufs } = await loadMasteringModule();
    for (const [name, state] of all) {
      expect(masteringTargetLufs(state), name).toBe(
        MASTERING_PRESET_TARGETS[state.quick.preset as keyof typeof MASTERING_PRESET_TARGETS],
      );
      expect(state.quick.venue, name).toBe(name.split('/')[1]);
    }
  });
});

describe('validateMasteringPresets', () => {
  it('passes presets that reach their target under the ceiling, and logs each', {
    timeout: 60_000,
  }, async () => {
    const log: string[] = [];
    const failures = await validateMasteringPresets({
      presetEntries: await entries([
        'pop/studio',
        'aiMusic/livehouseLarge',
        'liveLarge/livehouseSmall',
      ]),
      log: (line: string) => log.push(line),
    });
    expect(failures).toEqual([]);
    expect(log[0]).toBe(`libsonare ${wasm.version()}`);
    expect(
      log.filter((line) => /^\w+\/\w+: -\d+\.\d\d LUFS \(target -\d+\), true peak/.test(line)),
    ).toHaveLength(3);
    expect(log.some((line) => line.startsWith('reference match EQ: residual'))).toBe(true);
  });

  it('fails a preset whose target the limiter cannot reach', { timeout: 60_000 }, async () => {
    const { masteringMutators: m, MASTERING_SLOT } = await loadMasteringModule();
    const [[, pop]] = await entries(['pop/studio']);
    const unreachable = m.setInsertParam(
      m.setCustomLufs(pop, -8),
      MASTERING_SLOT.limiter,
      'ceilingDb',
      -9,
    );
    const failures = await validateMasteringPresets({
      presetEntries: [['pop/unreachable', unreachable]],
    });
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatch(
      /^pop\/unreachable: output -\d+\.\d\d LUFS misses target -8 by more than 0.5 LU/,
    );
  });

  it('fails a master whose true peak exceeds the ceiling', { timeout: 60_000 }, async () => {
    const api = { ...wasm, meteringTruePeakDb: () => 0.4 };
    const failures = await validateMasteringPresets({
      api,
      presetEntries: await entries(['acoustic/studio']),
    });
    expect(failures).toEqual(['acoustic/studio: true peak 0.40 dBTP exceeds ceiling -1 dBTP']);
  });

  it('reports a failing reference analysis', { timeout: 60_000 }, async () => {
    const api = {
      ...wasm,
      masteringPairAnalyze: () => {
        throw new Error('pair analysis unavailable');
      },
    };
    const failures = await validateMasteringPresets({ api, presetEntries: [] });
    expect(failures).toEqual(['reference analysis: pair analysis unavailable']);
  });
});
