// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { inertTweaks, type SynthTweakKey } from '@/demos/synth/synthPatchState';
import * as wasm from '@/wasm/index.js';

/**
 * `/synth` dims the controls an engine does not use. These render every catalog
 * preset with and without each control and hold the dimming to what the engine
 * does, so a build that starts honouring one fails here instead of leaving a
 * working control greyed out.
 */

const SAMPLE_RATE = 48_000;
const NO_CHANGE = 1e-7;

const TWEAK_VALUES: Record<SynthTweakKey, (base: wasm.SynthPatch) => Partial<wasm.SynthPatch>> = {
  waveform: (base) => ({ waveform: String(base.waveform) === 'square' ? 'saw' : 'square' }),
  filterModel: (base) => ({
    filterModel: String(base.filterModel) === 'moog-ladder' ? 'svf' : 'moog-ladder',
  }),
  cutoffHz: () => ({ cutoffHz: 300 }),
  resonanceQ: () => ({ cutoffHz: 1200, resonanceQ: 8 }),
  ampAttackMs: () => ({ ampAttackMs: 800 }),
  ampReleaseMs: () => ({ ampReleaseMs: 3000 }),
  glideMs: () => ({ glideMs: 250 }),
  stereoSpread: (base) => ({ stereoSpread: (base.stereoSpread ?? 0) > 0.5 ? 0 : 1 }),
};

/** Overlapping notes across the kit's pieces and a melodic range, so glide has somewhere to go. */
function render(instrument: string | wasm.SynthPatch): Float32Array {
  const project = new wasm.Project();
  try {
    project.setSampleRate(SAMPLE_RATE);
    project.setTempoSegments([{ startPpq: 0, bpm: 120 }]);
    const { clipId } = project.addMidiClip(0, 4);
    project.setMidiEvents(clipId, [
      wasm.Project.midiNoteOn(0, 0, 0, 38, 110),
      wasm.Project.midiNoteOn(0, 0, 0, 48, 100),
      wasm.Project.midiNoteOn(1, 0, 0, 60, 100),
      wasm.Project.midiNoteOff(1.1, 0, 0, 48, 0),
      wasm.Project.midiNoteOff(1.2, 0, 0, 38, 0),
      wasm.Project.midiNoteOff(2, 0, 0, 60, 0),
    ]);
    return project.bounceWithSynthInstrument(instrument, {
      numChannels: 2,
      sampleRate: SAMPLE_RATE,
    });
  } finally {
    project.delete();
  }
}

function maxDiff(a: Float32Array, b: Float32Array): number {
  let max = 0;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    max = Math.max(max, Math.abs((a[i] ?? 0) - (b[i] ?? 0)));
  }
  return max;
}

describe('which controls each engine uses', () => {
  it('renders every preset unchanged by the controls its engine dims', async () => {
    await wasm.init();
    const wrong: string[] = [];
    for (const name of new Set(wasm.synthPresetNames())) {
      const base = wasm.synthPresetPatch(name);
      const dimmed = inertTweaks(String(base.engineMode));
      if (dimmed.size === 0) continue;
      const reference = render(name);
      for (const key of dimmed) {
        const diff = maxDiff(reference, render({ preset: name, ...TWEAK_VALUES[key](base) }));
        if (diff > NO_CHANGE) wrong.push(`${name} ${key} ${diff.toExponential(2)}`);
      }
    }
    expect(wrong).toEqual([]);
  }, 120_000);

  it('changes a preset with the controls its engine keeps live', async () => {
    await wasm.init();
    const dead: string[] = [];
    for (const name of new Set(wasm.synthPresetNames())) {
      const base = wasm.synthPresetPatch(name);
      const dimmed = inertTweaks(String(base.engineMode));
      const reference = render(name);
      // The waveform and the cutoff stand for the oscillator and the shared filter.
      for (const key of ['waveform', 'cutoffHz'] as const) {
        if (dimmed.has(key)) continue;
        const diff = maxDiff(reference, render({ preset: name, ...TWEAK_VALUES[key](base) }));
        if (diff <= NO_CHANGE) dead.push(`${name} ${key}`);
      }
    }
    expect(dead).toEqual([]);
  }, 120_000);

  it('lets only the bus and voice-count fields reach the kit', async () => {
    await wasm.init();
    const kit = [...new Set(wasm.synthPresetNames())].find(
      (name) => String(wasm.synthPresetPatch(name).engineMode) === 'percussion',
    )!;
    const reference = render(kit);
    const effect = (fields: Partial<wasm.SynthPatch>) =>
      maxDiff(reference, render({ preset: kit, ...fields }));

    for (const fields of [
      { lfoRateHz: 6, lfoToPitchCents: 100 },
      { body: 'guitar', bodyMix: 1 },
      { pitchOffsetCents: 700 },
      { modRoutings: [{ source: 'lfo1', destination: 'amp-gain', depth: 1 }] },
    ] as Partial<wasm.SynthPatch>[]) {
      expect(effect(fields), JSON.stringify(fields)).toBeLessThanOrEqual(NO_CHANGE);
    }
    for (const fields of [{ gain: 0.3 }, { busDrive: 1 }, { polyphony: 1 }]) {
      expect(effect(fields), JSON.stringify(fields)).toBeGreaterThan(NO_CHANGE);
    }
  }, 60_000);
});
