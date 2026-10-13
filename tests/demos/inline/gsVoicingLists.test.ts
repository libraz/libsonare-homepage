// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import { getDemo } from '@/demos/inline/registry';
import * as wasm from '@/wasm/index.js';

/**
 * The GS audition pickers offer a selection of the drum kits and organ
 * variations this build voices apart from the standard sound, never one that
 * would sound identical. The engine answers which those are, so a refreshed
 * build that stops voicing an offered set fails here.
 */

const ORGAN_PROGRAM = 16;

function offered(id: string): number[] {
  const demo = getDemo(id);
  const param = demo?.params?.find((p) => p.key === 'variant');
  if (param?.kind !== 'select') throw new Error(`${id} has no variant picker`);
  return param.options.map((option) => Number(option.value)).filter((value) => value !== 0);
}

beforeAll(async () => {
  await wasm.init();
}, 30_000);

describe('GS audition lists against the engine', () => {
  it('offers only drum kits the engine voices apart from Standard', () => {
    for (const program of offered('gs-drum-kits')) {
      expect(wasm.synthGsDrumKitIsVoicedApart(program), `kit ${program}`).toBe(true);
    }
  });

  it('offers only organ variations the engine voices apart from the capital tone', () => {
    for (const bank of offered('gs-variation-tones')) {
      expect(wasm.synthGsVariationIsVoicedApart(bank, ORGAN_PROGRAM), `MSB ${bank}`).toBe(true);
    }
  });
});
