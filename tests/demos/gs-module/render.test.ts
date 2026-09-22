// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import {
  defaultModuleState,
  type GsModuleState,
  RHYTHM_CHANNEL,
  withEfxType,
} from '@/demos/gs-module/gsState';
import { auditionSmf, bounceFiles, drumKitsOf } from '@/demos/gs-module/useGsModule';
import * as wasm from '@/wasm/index.js';

/**
 * The state layer is only worth anything if the frames it emits reach the
 * audio. These bounce for real, so they also fail when a refreshed engine
 * stops acting on a control the panels expose.
 */

const SECONDS = 1.6;
/** One quantum of float32 mantissa: below this, two renders are the same render. */
const ULP = 2 ** -24;

function render(mutate: (state: GsModuleState) => void, channel = 0): Float32Array {
  const state = defaultModuleState();
  mutate(state);
  return bounceFiles(wasm, [auditionSmf(state, channel)], SECONDS);
}

function maxDeviation(a: Float32Array, b: Float32Array): number {
  let max = 0;
  for (let i = 0; i < a.length; i++) max = Math.max(max, Math.abs(a[i] - b[i]));
  return max;
}

function rms(buffer: Float32Array): number {
  let sum = 0;
  for (const x of buffer) sum += x * x;
  return Math.sqrt(sum / buffer.length);
}

let base: Float32Array;

beforeAll(async () => {
  await wasm.init();
  base = render(() => {});
}, 60_000);

describe('the audition renders', () => {
  it('produces audio at all', () => {
    expect(rms(base)).toBeGreaterThan(1e-3);
  });

  it('follows a program change', () => {
    const strings = render((state) => {
      state.parts[0].program = 48;
    });
    expect(maxDeviation(strings, base)).toBeGreaterThan(ULP);
  });

  it('reaches a bank variation, which needs the program resent to latch', () => {
    // Bank 8 on program 0 is one the engine reports as voiced apart, and the
    // part is already sitting on program 0 — the case where a setup that only
    // emits changed values would send the bank and no program change at all.
    const variation = render((state) => {
      state.parts[0].bankMsb = 8;
    });
    expect(maxDeviation(variation, base)).toBeGreaterThan(ULP);
  });

  it('follows a part level, and downward', () => {
    const quiet = render((state) => {
      state.parts[0].level = 30;
    });
    expect(rms(quiet)).toBeLessThan(rms(base) * 0.9);
  });

  it('realizes the insertion effect the setup frames select', () => {
    const driven = render((state) => {
      state.efx = withEfxType(state.efx, 0x0110);
      state.parts[0].efxAssigned = true;
    });
    // Overdrive on a fallback piano comes back far quieter than dry, which is
    // the shape of the change rather than an incidental one.
    expect(rms(driven)).toBeLessThan(rms(base) * 0.5);
  });

  it('leaves the render alone when a part is routed to an effect set to Thru', () => {
    const routed = render((state) => {
      state.parts[0].efxAssigned = true;
    });
    expect(maxDeviation(routed, base)).toBeLessThanOrEqual(ULP);
  });

  it('sounds the rhythm part on its own channel', () => {
    const drums = render(() => {}, RHYTHM_CHANNEL);
    expect(rms(drums)).toBeGreaterThan(1e-3);
    expect(maxDeviation(drums, base)).toBeGreaterThan(ULP);
  });
});

describe('drumKitsOf', () => {
  it('returns only the programs that carry a set', () => {
    const kits = drumKitsOf(wasm);
    expect(kits.length).toBeGreaterThan(1);
    expect(kits.length).toBeLessThan(128);
    for (const kit of kits) expect(kit.name).not.toBe('');
  });

  it('keeps the programs in order and unique', () => {
    const programs = drumKitsOf(wasm).map((kit) => kit.program);
    expect(programs).toEqual([...programs].sort((a, b) => a - b));
    expect(new Set(programs).size).toBe(programs.length);
  });

  it('collapses the three-state query so no unset program reads as a fallback set', () => {
    // The query answers null for a program with no set at all, which `if (!x)`
    // would sweep in with the sets that fall back to Standard.
    const kits = drumKitsOf(wasm);
    for (const kit of kits) expect(wasm.synthGsDrumKitIsVoicedApart(kit.program)).not.toBeNull();
  });

  it('reports at least one set that is not voiced apart', () => {
    // If this ever goes empty the browser's fallback tag is dead UI, not a
    // build where every set became distinct.
    expect(drumKitsOf(wasm).some((kit) => !kit.voicedApart)).toBe(true);
  });
});
