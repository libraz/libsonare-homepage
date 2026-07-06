import { describe, expect, it } from 'vitest';
import { reactive } from 'vue';
import { specToJson } from '@/components/tuner/tunerJson';
import { buildDefaultSpec } from '@/tuner/dsp/engine';
import { ENGINE_ORDER } from '@/tuner/dsp/params';

/**
 * The tuner posts the model spec to its AudioWorklet via `postMessage`, which
 * structured-clones it. The page holds the spec in a Vue `ref`, so it arrives as
 * a reactive Proxy — structured clone of that Proxy throws DataCloneError. The
 * engine deep-clones to a plain object (JSON round-trip) before posting; these
 * tests guard that (a) every engine's default spec stays pure, clonable data and
 * (b) the round-trip strips reactivity without losing values.
 */
describe('tuner spec is structured-cloneable', () => {
  for (const mode of ENGINE_ORDER) {
    it(`${mode} default spec survives structuredClone after de-proxying`, () => {
      const spec = reactive(buildDefaultSpec(mode));
      // A raw reactive proxy is what previously broke postMessage; the plain
      // round-trip the engine performs must yield a clonable, equal object.
      const plain = JSON.parse(JSON.stringify(spec));
      expect(() => structuredClone(plain)).not.toThrow();
      expect(plain).toEqual(JSON.parse(JSON.stringify(buildDefaultSpec(mode))));
      expect(plain.engineMode).toBe(mode);
    });
  }
});

describe('specToJson handles a reactive spec (patch export)', () => {
  for (const mode of ENGINE_ORDER) {
    it(`${mode} exports without a DataCloneError`, () => {
      const spec = reactive(buildDefaultSpec(mode));
      let json: ReturnType<typeof specToJson> | undefined;
      expect(() => {
        json = specToJson(spec);
      }).not.toThrow();
      expect(json?.engine).toBe(mode);
      expect(() => structuredClone(json)).not.toThrow();
      expect(() => JSON.stringify(json)).not.toThrow();
    });
  }
});
