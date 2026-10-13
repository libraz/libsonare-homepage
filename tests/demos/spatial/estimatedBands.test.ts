// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import { PRESET_GEOMETRY } from '@/demos/spatial/spatialCopy';
import * as wasm from '@/wasm/index.js';

/**
 * The morph rebuilds the scanned room from the estimate. The estimate's bands
 * with its volume reproduce the measured decay; collapsing them to one mean
 * absorption does not, so the page passes the bands.
 */

const SR = 48_000;

function rt60(geometry: Record<string, unknown>): number {
  const { rir } = wasm.synthesizeRir({ ...geometry, sampleRate: SR });
  return wasm.analyzeImpulseResponse(rir, SR, 6).rt60;
}

describe('a room rebuilt from its estimate', () => {
  beforeAll(async () => {
    await wasm.init();
  });

  it.each(['hall', 'cathedral'] as const)(
    'keeps the %s decay closer with bands than with their mean',
    (id) => {
      const truth = PRESET_GEOMETRY[id];
      const estimate = wasm.estimateRoom(wasm.synthesizeRir({ ...truth, sampleRate: SR }).rir, SR, {
        nOctaveBands: 6,
      });
      const bands = Array.from(estimate.bandAbsorption);
      expect(bands.every(Number.isFinite)).toBe(true);
      const inside = (v: number, max: number) => Math.min(Math.max(v, 0.05), max - 0.05);
      const rebuilt = {
        lengthM: estimate.lengthM,
        widthM: estimate.widthM,
        heightM: estimate.heightM,
        sourceX: inside(truth.sourceX, estimate.lengthM),
        sourceY: inside(truth.sourceY, estimate.widthM),
        sourceZ: inside(truth.sourceZ, estimate.heightM),
        listenerX: inside(truth.listenerX, estimate.lengthM),
        listenerY: inside(truth.listenerY, estimate.widthM),
        listenerZ: inside(truth.listenerZ, estimate.heightM),
      };
      const target = rt60(truth);
      const mean = bands.reduce((sum, v) => sum + v, 0) / bands.length;
      const withBands = Math.abs(
        rt60({ ...rebuilt, absorption: mean, bandAbsorption: bands }) - target,
      );
      const withMean = Math.abs(rt60({ ...rebuilt, absorption: mean }) - target);
      expect(withBands).toBeLessThan(withMean);
    },
    60_000,
  );

  it.each(['bedroom', 'hall', 'cathedral'] as const)(
    'rebuilds the %s as the page used to assemble it by hand',
    (id) => {
      const truth = PRESET_GEOMETRY[id];
      const estimate = wasm.estimateRoom(wasm.synthesizeRir({ ...truth, sampleRate: SR }).rir, SR, {
        nOctaveBands: 6,
      });
      // The page's own placement: the listener as scanned, the source on the room's inside.
      const listener = { x: truth.listenerX, y: truth.listenerY, z: truth.listenerZ };
      const source = {
        x: Math.min(Math.max(truth.sourceX, 0.05), estimate.lengthM - 0.05),
        y: Math.min(Math.max(truth.sourceY, 0.05), estimate.widthM - 0.05),
        z: Math.min(Math.max(truth.sourceZ, 0.05), estimate.heightM - 0.05),
      };
      // What the page passed before: dimensions, the mean of the positive bands,
      // the bands when every one was usable, then source and listener.
      const bands = Array.from(estimate.bandAbsorption);
      const positive = bands.filter((v) => v > 0);
      const byHand = {
        lengthM: estimate.lengthM,
        widthM: estimate.widthM,
        heightM: estimate.heightM,
        absorption: positive.reduce((sum, v) => sum + v, 0) / positive.length,
        bandAbsorption: positive.length === bands.length ? positive : undefined,
        sourceX: source.x,
        sourceY: source.y,
        sourceZ: source.z,
        listenerX: listener.x,
        listenerY: listener.y,
        listenerZ: listener.z,
      };

      const helper = wasm.roomGeometryFromEstimate(
        {
          lengthM: estimate.lengthM,
          widthM: estimate.widthM,
          heightM: estimate.heightM,
          bandAbsorption: bands,
        },
        { source, listener },
      );

      expect(positive.length).toBe(bands.length);
      for (const key of [
        'lengthM',
        'widthM',
        'heightM',
        'sourceX',
        'sourceY',
        'sourceZ',
        'listenerX',
        'listenerY',
        'listenerZ',
      ] as const) {
        expect(helper[key], key).toBe(byHand[key]);
      }
      expect(helper.absorption).toBeCloseTo(byHand.absorption, 6);
      expect(Array.from(helper.bandAbsorption ?? [])).toEqual(byHand.bandAbsorption);
    },
    60_000,
  );
});
