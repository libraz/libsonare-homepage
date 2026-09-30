// @vitest-environment node
import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
  defaultModuleState,
  type GsModuleState,
  RHYTHM_CHANNEL,
  setupEvents,
  withEfxType,
} from '@/demos/gs-module/gsState';
import {
  auditionPhrase,
  auditionSmf,
  bounceFiles,
  drumKitsOf,
  type GsStereoRender,
} from '@/demos/gs-module/useGsModule';
import { buildSmf, noteEvents } from '@/utils/gsSysex';
import * as wasm from '@/wasm/index.js';

/**
 * The state layer is only worth anything if the frames it emits reach the
 * audio. These bounce for real, so they also fail when a refreshed engine
 * stops acting on a control the panels expose.
 */

const SECONDS = 1.6;
/** One quantum of float32 mantissa: below this, two renders are the same render. */
const ULP = 2 ** -24;

function render(mutate: (state: GsModuleState) => void, channel = 0): GsStereoRender {
  const state = defaultModuleState();
  mutate(state);
  return bounceFiles(wasm, [auditionSmf(state, channel)], SECONDS);
}

function maxDeviation(a: GsStereoRender, b: GsStereoRender): number {
  expect(a.frames).toBe(b.frames);
  let max = 0;
  for (let i = 0; i < a.frames; i++) {
    max = Math.max(max, Math.abs(a.left[i] - b.left[i]), Math.abs(a.right[i] - b.right[i]));
  }
  return max;
}

function rms(buffer: Float32Array): number {
  let sum = 0;
  for (const x of buffer) sum += x * x;
  return Math.sqrt(sum / buffer.length);
}

function stereoRms(rendered: GsStereoRender): number {
  return Math.max(rms(rendered.left), rms(rendered.right));
}

let base: GsStereoRender;

beforeAll(async () => {
  await wasm.init();
  base = render(() => {});
}, 60_000);

describe('the audition renders', () => {
  it('produces audio at all', () => {
    expect(stereoRms(base)).toBeGreaterThan(1e-3);
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
    expect(stereoRms(quiet)).toBeLessThan(stereoRms(base) * 0.9);
  });

  it('realizes the insertion effect the setup frames select', () => {
    const driven = render((state) => {
      state.efx = withEfxType(state.efx, 0x0110);
      state.parts[0].efxAssigned = true;
    });
    // Overdrive on a fallback piano comes back far quieter than dry, which is
    // the shape of the change rather than an incidental one.
    expect(stereoRms(driven)).toBeLessThan(stereoRms(base) * 0.5);
  });

  it('leaves the render alone when a part is routed to an effect set to Thru', () => {
    const routed = render((state) => {
      state.parts[0].efxAssigned = true;
    });
    expect(maxDeviation(routed, base)).toBeLessThanOrEqual(ULP);
  });

  it('keeps deterministic extreme pan energy on opposite sides', () => {
    // Use CC#10 here: unlike the GS 40 10 1C address, whose 00 means RANDOM,
    // the MIDI controller's 00 and 7F are deterministic hard-pan endpoints.
    const panRender = (pan: number) => {
      const state = defaultModuleState();
      state.parts[0].program = 40;
      const file = buildSmf(
        [...setupEvents(state), { beat: 0, bytes: [0xb0, 0x0a, pan] }, ...auditionPhrase(0)],
        5,
      );
      return bounceFiles(wasm, [file], SECONDS);
    };
    const left = panRender(0);
    const right = panRender(127);
    const pan0Balance = rms(left.left) - rms(left.right);
    const pan127Balance = rms(right.left) - rms(right.right);
    expect(Math.abs(pan0Balance)).toBeGreaterThan(0.005);
    expect(Math.abs(pan127Balance)).toBeGreaterThan(0.005);
    expect(pan0Balance * pan127Balance).toBeLessThan(0);
  });

  it('renders distinct modern and classic insertion effects from the same MIDI', () => {
    const state = defaultModuleState();
    state.efx = withEfxType(state.efx, 0x0110);
    state.parts[0].efxAssigned = true;
    const file = auditionSmf(state, 0);
    const modern = bounceFiles(wasm, [file], SECONDS, 'modern');
    const classic = bounceFiles(wasm, [file], SECONDS, 'classic');
    expect(classic.frames).toBe(modern.frames);
    expect(stereoRms(modern)).toBeGreaterThan(1e-5);
    expect(stereoRms(classic)).toBeGreaterThan(1e-5);
    expect(maxDeviation(classic, modern)).toBeGreaterThan(1e-4);
  });

  it('sounds the rhythm part on its own channel', () => {
    const drums = render(() => {}, RHYTHM_CHANNEL);
    expect(stereoRms(drums)).toBeGreaterThan(1e-3);
    expect(maxDeviation(drums, base)).toBeGreaterThan(ULP);
  });

  it('renders an imported arrangement after the three-second audition preview', () => {
    // At the default 120 BPM this note starts at four seconds. An imported
    // file must derive its length from the arrangement, including the release
    // tail, instead of inheriting the built-in audition's fixed preview.
    const imported = buildSmf(noteEvents(0, 60, 100, 8, 8.5), 9);
    const full = bounceFiles(wasm, [imported]);
    expect(full.frames).toBeGreaterThan(Math.round(9 * 0.5 * 44100));
    const afterNoteOnset = full.left.subarray(Math.round(4 * 44100), Math.round(4.5 * 44100));
    expect(rms(afterNoteOnset)).toBeGreaterThan(1e-3);
  });

  it('omits the fixed frame limit when bouncing an imported file', () => {
    const bounce = vi.fn(() => new Float32Array(2));
    class ProjectMock {
      setSampleRate = vi.fn();
      importSmf = vi.fn(() => 0);
      bounceWithSf2Instrument = bounce;
      delete = vi.fn();
    }
    const importedWasm = { Project: ProjectMock } as never;

    bounceFiles(importedWasm, [new Uint8Array([0x4d, 0x49, 0x44, 0x49])]);

    expect(bounce).toHaveBeenCalledWith(
      { gsEfxRealization: 'modern' },
      { numChannels: 2, sampleRate: 44100 },
    );
  });

  it('rejects empty and malformed stereo bounce output', () => {
    for (const [samples, message] of [
      [new Float32Array(), /playable/i],
      [new Float32Array(1), /odd number of samples/i],
    ] as const) {
      class ProjectMock {
        setSampleRate = vi.fn();
        importSmf = vi.fn(() => 0);
        bounceWithSf2Instrument = vi.fn(() => samples);
        delete = vi.fn();
      }
      const importedWasm = { Project: ProjectMock } as never;
      expect(() => bounceFiles(importedWasm, [new Uint8Array([0x4d, 0x49, 0x44, 0x49])])).toThrow(
        message,
      );
    }
  });

  it('rejects an imported file with no notes before Web Audio playback', () => {
    const setup = buildSmf(setupEvents(defaultModuleState()), 0.01);
    const emptyFile = buildSmf([], 1);
    expect(() => bounceFiles(wasm, [setup, emptyFile])).toThrow(/playable/i);
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
