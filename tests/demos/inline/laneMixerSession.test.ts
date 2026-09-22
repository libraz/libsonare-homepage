// @vitest-environment node
import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
  applyLaneMixerControls,
  createLaneMixerEngine,
  createSharedBoot,
  type LaneMixerEngine,
  renderLaneMixerLoop,
} from '@/demos/inline/archetypes/laneMixerSession';
import { getDemo } from '@/demos/inline/registry';
import { MASTER_LIMITER_CEILING } from '@/utils/masterLimiter';
import * as wasm from '@/wasm/index.js';

/**
 * The lane-mixer archetype plays its master render raw, so the registry's
 * slider ranges are the only thing standing between the reader and full scale.
 * These render the archetype's own session and pin that its defaults sit in
 * balance and its extremes stay under the ceiling.
 */

function peakOf(samples: Float32Array): number {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const a = Math.abs(samples[i]);
    if (a > peak) peak = a;
  }
  return peak;
}

function rmsDb(samples: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return 20 * Math.log10(Math.sqrt(sum / samples.length));
}

/** The registry's fader params, in lane order. */
function faderParams() {
  const def = getDemo('engine-lane-mixer');
  if (!def) throw new Error('engine-lane-mixer not registered');
  return ['leadDb', 'bassDb', 'drumsDb'].map((key) => {
    const param = def.params?.find((p) => p.key === key);
    if (!param || param.kind !== 'range') throw new Error(`${key} is not a range param`);
    return param;
  });
}

let engine: LaneMixerEngine;

beforeAll(async () => {
  await wasm.init();
  engine = createLaneMixerEngine(wasm);
  // The first render settles the strips; the demo re-renders on every move.
  applyLaneMixerControls(engine, [0, 0, 0], [false, false, false]);
  renderLaneMixerLoop(engine);
}, 30_000);

describe('lane-mixer session', () => {
  it('stays under full scale with every fader at the slider maximum', () => {
    applyLaneMixerControls(
      engine,
      faderParams().map((p) => p.max),
      [false, false, false],
    );
    const peak = peakOf(renderLaneMixerLoop(engine));
    expect(peak).toBeLessThan(1);
    expect(peak).toBeLessThanOrEqual(MASTER_LIMITER_CEILING * 1.02);
  });

  it('balances the three lanes at the slider defaults', () => {
    const defaults = faderParams().map((p) => Number(p.default));
    const levels = [0, 1, 2].map((lane) => {
      applyLaneMixerControls(
        engine,
        defaults,
        [0, 1, 2].map((other) => other !== lane),
      );
      return rmsDb(renderLaneMixerLoop(engine));
    });
    applyLaneMixerControls(engine, defaults, [false, false, false]);
    const peak = peakOf(renderLaneMixerLoop(engine));
    expect(Math.max(...levels) - Math.min(...levels)).toBeLessThan(8);
    expect(peak).toBeLessThan(MASTER_LIMITER_CEILING);
    expect(peak).toBeGreaterThan(0.1);
  });
});

describe('createSharedBoot', () => {
  it('shares one in-flight boot between callers', async () => {
    const start = vi.fn(async () => ({ id: 1 }));
    const boot = createSharedBoot(start);
    const [a, b] = await Promise.all([boot.ensure(), boot.ensure()]);
    expect(a).toBe(b);
    expect(start).toHaveBeenCalledTimes(1);
  });

  it('retries after a rejected boot instead of replaying the failure', async () => {
    let attempt = 0;
    const boot = createSharedBoot(async () => {
      attempt++;
      if (attempt === 1) throw new Error('wasm fetch failed');
      return { attempt };
    });
    await expect(boot.ensure()).rejects.toThrow('wasm fetch failed');
    await expect(boot.ensure()).resolves.toEqual({ attempt: 2 });
    expect(attempt).toBe(2);
  });

  it('forgets the booted value on reset so the next call boots again', async () => {
    const start = vi.fn(async () => ({}));
    const boot = createSharedBoot(start);
    await boot.ensure();
    boot.reset();
    await boot.ensure();
    expect(start).toHaveBeenCalledTimes(2);
  });
});
