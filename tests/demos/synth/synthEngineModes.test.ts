// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import {
  ATTACK_MAX_MS,
  ATTACK_MIN_MS,
  activeModelFields,
  CUTOFF_MAX_HZ,
  CUTOFF_MIN_HZ,
  fieldDefault,
  GLIDE_MAX_MS,
  hasBaseVoice,
  initPatchValues,
  isKnobField,
  RELEASE_MAX_MS,
  RELEASE_MIN_MS,
  RESONANCE_MAX,
  RESONANCE_MIN,
} from '@/demos/synth/synthPatchState';
import * as wasm from '@/wasm/index.js';

/**
 * `/synth` lists each engine's base voice — a patch naming only the engine
 * mode — and draws that engine's model section from `synthEngineParamInfo()`.
 * These render offline and hold those claims to the engine: the base voices
 * sound, their knobs start where the voice is, and the curated knob travel
 * stays inside what the engine accepts.
 */

const SAMPLE_RATE = 24_000;
const NO_CHANGE = 1e-7;

/** Notes a probe plays. The keybed span also reaches above F4, where some
 *  timbre fields (an organ rank's brightness) clear a fixed filter floor. */
const LOW_NOTES = [48, 38];
const KEYBED_NOTES = [38, 48, 72];

function render(instrument: string | wasm.SynthPatch, notes = LOW_NOTES): Float32Array {
  const project = new wasm.Project();
  try {
    project.setSampleRate(SAMPLE_RATE);
    project.setTempoSegments([{ startPpq: 0, bpm: 120 }]);
    const { clipId } = project.addMidiClip(0, 2);
    project.setMidiEvents(
      clipId,
      notes.flatMap((note) => [
        wasm.Project.midiNoteOn(0, 0, 0, note, 100),
        wasm.Project.midiNoteOff(1, 0, 0, note, 0),
      ]),
    );
    return project.bounceWithSynthInstrument(instrument, {
      numChannels: 1,
      sampleRate: SAMPLE_RATE,
    });
  } finally {
    project.delete();
  }
}

function peak(a: Float32Array): number {
  let max = 0;
  for (const x of a) max = Math.max(max, Math.abs(x));
  return max;
}

function maxDiff(a: Float32Array, b: Float32Array): number {
  let max = 0;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    max = Math.max(max, Math.abs((a[i] ?? 0) - (b[i] ?? 0)));
  }
  return max;
}

/**
 * Whether moving one field changes the render. Both ends of its range are
 * tried: an engine may cap a field below its published maximum, so a single
 * step off the default can land on the same capped value.
 */
function alters(
  reference: Float32Array,
  engine: string,
  base: Record<string, number>,
  field: wasm.SynthParamInfo,
  notes = LOW_NOTES,
): boolean {
  const start = base[field.name] ?? fieldDefault(field);
  // Without a published range, half and one-and-a-half times the start stay in bounds.
  const candidates =
    field.type === 'boolean'
      ? [start === 0 ? 1 : 0]
      : [field.min ?? start * 0.5, field.max ?? (start === 0 ? 1 : start * 1.5)];
  return candidates
    .filter((value) => value !== start)
    .some((value) => {
      const engineParams = { ...base, [field.name]: value };
      return maxDiff(reference, render({ ...mode(engine), engineParams }, notes)) > NO_CHANGE;
    });
}

const mode = (engine: string) => ({ engineMode: engine as wasm.SynthEngineMode });

beforeAll(async () => {
  await wasm.init();
}, 30_000);

describe('base voices', () => {
  it('sounds fm, modal and percussion from a mode-only patch, each its own voice', () => {
    const voices = ['fm', 'modal', 'percussion'].map((engine) => render(mode(engine)));
    for (const voice of voices) expect(peak(voice)).toBeGreaterThan(0.01);
    expect(maxDiff(voices[0], voices[1])).toBeGreaterThan(0.05);
    expect(maxDiff(voices[0], voices[2])).toBeGreaterThan(0.05);
    expect(maxDiff(voices[1], voices[2])).toBeGreaterThan(0.05);
  }, 30_000);

  it('leaves the sample engine silent without a bank, so it gets no base voice', () => {
    expect(hasBaseVoice('sample')).toBe(false);
    expect(peak(render(mode('sample')))).toBe(0);
  }, 30_000);

  it('plays the init wrapper values synthPatchParamInfo() reports, which seed its knobs', () => {
    const init = initPatchValues(wasm.synthPatchParamInfo());
    const knobs = {
      cutoffHz: init.cutoffHz,
      resonanceQ: init.resonanceQ,
      ampAttackMs: init.ampAttackMs,
      ampReleaseMs: init.ampReleaseMs,
      glideMs: init.glideMs,
      stereoSpread: init.stereoSpread,
    };
    for (const engine of ['subtractive', 'fm', 'piano']) {
      expect(
        maxDiff(render(mode(engine)), render({ ...mode(engine), ...knobs })),
      ).toBeLessThanOrEqual(NO_CHANGE);
    }
  }, 60_000);
});

describe('model section', () => {
  it('starts every knob at the value the base voice plays', () => {
    const moved: string[] = [];
    for (const engine of wasm.synthEnumTables().engineModes) {
      if (!hasBaseVoice(engine)) continue;
      const fields = wasm.synthEngineParamInfo(engine as wasm.SynthEngineMode).filter(isKnobField);
      if (fields.length === 0) continue;
      // Booleans are reported as true/false; engineParams takes numbers.
      const engineParams = Object.fromEntries(fields.map((f) => [f.name, fieldDefault(f)]));
      const diff = maxDiff(render(mode(engine)), render({ ...mode(engine), engineParams }));
      if (diff > NO_CHANGE) moved.push(`${engine} ${diff.toExponential(2)}`);
    }
    expect(moved).toEqual([]);
  }, 120_000);

  it('moves the base voice with a model field', () => {
    const reference = render(mode('fm'));
    expect(
      maxDiff(reference, render({ ...mode('fm'), engineParams: { algorithm: 0 } })),
    ).toBeGreaterThan(0.01);
  }, 30_000);

  it('shows exactly the percussion fields whose change alters the render', () => {
    const info = wasm.synthEngineParamInfo('percussion');
    for (const gmKit of [1, 0]) {
      const base = { gmKit };
      const reference = render({ ...mode('percussion'), engineParams: base });
      const shown = new Set(activeModelFields(info, base).map((f) => f.name));
      const altering = info
        .filter((f) => f.name !== 'gmKit' && alters(reference, 'percussion', base, f))
        .map((f) => f.name);
      expect([...shown].filter((name) => name !== 'gmKit').sort()).toEqual(altering.sort());
      if (gmKit === 1) {
        expect(altering).toEqual([]);
      } else {
        expect(altering.sort()).toEqual(['contact', 'noiseGain', 'numModes', 'phisemBeans']);
      }
    }
    // With the kit off the base voice is silent until one of those fields opens.
    expect(peak(render({ ...mode('percussion'), engineParams: { gmKit: 0 } }))).toBe(0);
  }, 120_000);

  it('opens a gated field when the value it reads crosses its threshold', () => {
    const info = wasm.synthEngineParamInfo('percussion');
    const names = (values: Record<string, number>) =>
      activeModelFields(info, values).map((f) => f.name);
    // The shell needs both its mix and an exciter that reaches it.
    expect(names({ gmKit: 0, shellMix: 0.5 })).not.toContain('shellNumModes');
    expect(names({ gmKit: 0, shellMix: 0.5, noiseGain: 0.5 })).toContain('shellNumModes');
    expect(names({ gmKit: 0 })).toContain('numModes');
  });

  it('shows a gated field exactly when it alters the base voice, on every engine', () => {
    const leaked: string[] = [];
    const inert: string[] = [];
    for (const engine of wasm.synthEnumTables().engineModes) {
      if (!hasBaseVoice(engine) || engine === 'percussion') continue;
      const info = wasm.synthEngineParamInfo(engine as wasm.SynthEngineMode);
      if (!info.some((f) => f.activeWhen)) continue;
      const shown = new Set(activeModelFields(info, {}).map((f) => f.name));
      const reference = render(mode(engine), KEYBED_NOTES);
      for (const field of info.filter((f) => isKnobField(f) && f.activeWhen)) {
        const audible = alters(reference, engine, {}, field, KEYBED_NOTES);
        if (audible && !shown.has(field.name)) leaked.push(`${engine}.${field.name}`);
        if (!audible && shown.has(field.name)) inert.push(`${engine}.${field.name}`);
      }
    }
    expect(leaked).toEqual([]);
    expect(inert).toEqual([]);
  }, 120_000);
});

describe('knob travel', () => {
  it('keeps each curated range inside the range the engine publishes', () => {
    const info = new Map(wasm.synthPatchParamInfo().map((field) => [field.name, field]));
    const travel: [string, number, number][] = [
      ['cutoffHz', CUTOFF_MIN_HZ, CUTOFF_MAX_HZ],
      ['resonanceQ', RESONANCE_MIN, RESONANCE_MAX],
      ['ampAttackMs', ATTACK_MIN_MS, ATTACK_MAX_MS],
      ['ampReleaseMs', RELEASE_MIN_MS, RELEASE_MAX_MS],
      ['glideMs', 0, GLIDE_MAX_MS],
      ['stereoSpread', 0, 1],
    ];
    for (const [name, min, max] of travel) {
      const field = info.get(name);
      expect(field, name).toBeDefined();
      expect(min, name).toBeGreaterThanOrEqual(field?.min ?? Number.NEGATIVE_INFINITY);
      expect(max, name).toBeLessThanOrEqual(field?.max ?? Number.POSITIVE_INFINITY);
    }
  });
});
