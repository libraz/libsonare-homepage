// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  BODIES,
  CLASSIC_PARAMS,
  defaultPatch,
  destinationOf,
  detuneHasEffect,
  FILTER_MODELS,
  FILTER_OUTPUTS,
  MAX_MOD_ROUTINGS,
  MOD_DESTINATIONS,
  MOD_SOURCES,
  type ModDestinationName,
  type NumericParamKey,
  offersFilterOutput,
  PHRASES,
  paramOf,
  patchFromPreset,
  phraseOf,
  toSynthPatch,
  unmetRequirement,
  WAVEFORMS,
} from '@/demos/classic-synth/classicSynthState';
import * as wasm from '@/wasm/index.js';

const PARAM_KEYS = CLASSIC_PARAMS.map((param) => param.key);

describe('CLASSIC_PARAMS', () => {
  it('describes each field once', () => {
    expect(new Set(PARAM_KEYS).size).toBe(PARAM_KEYS.length);
  });

  it('gives every range a usable span and step', () => {
    for (const param of CLASSIC_PARAMS) {
      expect(param.max).toBeGreaterThan(param.min);
      expect(param.step).toBeGreaterThan(0);
      expect(param.step).toBeLessThanOrEqual(param.max - param.min);
    }
  });

  it('keeps a logarithmic knob off zero, which it could never travel from', () => {
    for (const param of CLASSIC_PARAMS) {
      if (param.log) expect(param.min).toBeGreaterThan(0);
    }
  });

  it('finds a described field by key and refuses an undescribed one', () => {
    for (const key of PARAM_KEYS) expect(paramOf(key).key).toBe(key);
    expect(() => paramOf('nope' as NumericParamKey)).toThrow();
  });
});

describe('defaultPatch', () => {
  it('sets every described field, within its own range', () => {
    const patch = defaultPatch();
    for (const param of CLASSIC_PARAMS) {
      const value = patch[param.key];
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(param.min);
      expect(value).toBeLessThanOrEqual(param.max);
    }
  });

  it('picks its enum fields from the offered lists', () => {
    const patch = defaultPatch();
    expect(WAVEFORMS).toContain(patch.waveform);
    expect(FILTER_MODELS).toContain(patch.filterModel);
    expect(FILTER_OUTPUTS).toContain(patch.filterOutput);
    expect(BODIES).toContain(patch.body);
  });

  it('offers no "default" in any enum list, since there is no base to keep', () => {
    for (const list of [WAVEFORMS, FILTER_MODELS, FILTER_OUTPUTS, BODIES]) {
      expect(list as readonly string[]).not.toContain('default');
    }
  });

  it('starts with an empty matrix, which the mod chapter fills', () => {
    expect(defaultPatch().modRoutings).toEqual([]);
  });
});

describe('patchFromPreset', () => {
  it('clamps a value past the offered range rather than carrying it', () => {
    const patch = patchFromPreset({ cutoffHz: 999_999, resonanceQ: -4 });
    expect(patch.cutoffHz).toBe(paramOf('cutoffHz').max);
    expect(patch.resonanceQ).toBe(paramOf('resonanceQ').min);
  });

  it('falls back to the default for an enum the page does not offer', () => {
    const base = defaultPatch();
    const patch = patchFromPreset({ waveform: 'default', filterModel: 'default' });
    expect(patch.waveform).toBe(base.waveform);
    expect(patch.filterModel).toBe(base.filterModel);
  });

  it('keeps no more routings than the engine holds', () => {
    const tooMany = Array.from({ length: MAX_MOD_ROUTINGS + 3 }, () => ({
      source: 'lfo1' as const,
      destination: 'cutoff-cents' as const,
      depth: 100,
    }));
    expect(patchFromPreset({ modRoutings: tooMany }).modRoutings).toHaveLength(MAX_MOD_ROUTINGS);
  });

  it('copies routings rather than aliasing the preset it read', () => {
    const routings = [{ source: 'lfo1' as const, destination: 'pitch-cents' as const, depth: 30 }];
    const patch = patchFromPreset({ modRoutings: routings });
    patch.modRoutings[0].depth = 999;
    expect(routings[0].depth).toBe(30);
  });

  it('reads every preset this build ships into a fully valid patch', async () => {
    await wasm.init();
    const names = wasm.synthPresetNames();
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      const patch = patchFromPreset(wasm.synthPresetPatch(name));
      for (const param of CLASSIC_PARAMS) {
        expect(patch[param.key]).toBeGreaterThanOrEqual(param.min);
        expect(patch[param.key]).toBeLessThanOrEqual(param.max);
      }
      expect(WAVEFORMS).toContain(patch.waveform);
      expect(FILTER_MODELS).toContain(patch.filterModel);
      expect(FILTER_OUTPUTS).toContain(patch.filterOutput);
      expect(BODIES).toContain(patch.body);
      expect(patch.modRoutings.length).toBeLessThanOrEqual(MAX_MOD_ROUTINGS);
    }
  });
});

describe('toSynthPatch', () => {
  it('sends every field, so nothing is left to a base the page does not have', () => {
    const sent = toSynthPatch(defaultPatch());
    for (const key of PARAM_KEYS) expect(sent).toHaveProperty(key);
    expect(sent).toHaveProperty('waveform');
    expect(sent).toHaveProperty('filterModel');
    expect(sent).toHaveProperty('body');
    expect(sent).toHaveProperty('modRoutings');
  });

  it('sends no field the page does not show', () => {
    const sent = toSynthPatch(defaultPatch()) as Record<string, unknown>;
    for (const key of ['preset', 'engineMode', 'polyphony', 'sampleBank', 'destinationId']) {
      expect(sent[key]).toBeUndefined();
    }
  });

  it('copies the matrix, so editing the patch after sending changes nothing sent', () => {
    const patch = defaultPatch();
    patch.modRoutings = [{ source: 'lfo1', destination: 'cutoff-cents', depth: 600 }];
    const sent = toSynthPatch(patch);
    patch.modRoutings[0].depth = 0;
    expect(sent.modRoutings?.[0].depth).toBe(600);
  });
});

describe('the modulation tables', () => {
  it('offers no "none" on either axis, which the engine takes and ignores', () => {
    expect(MOD_SOURCES as readonly string[]).not.toContain('none');
    expect(MOD_DESTINATIONS.map((entry) => entry.key)).not.toContain('none');
  });

  it('leaves out the four destinations this voice provably cannot reach', () => {
    const offered = MOD_DESTINATIONS.map((entry) => entry.key);
    for (const key of [
      'excitation-force',
      'excitation-position',
      'excitation-brightness',
      'spectrum-morph',
    ]) {
      expect(offered).not.toContain(key as ModDestinationName);
    }
    expect(MOD_SOURCES).toHaveLength(12);
    expect(MOD_DESTINATIONS).toHaveLength(8);
  });

  it('gives every destination a usable depth range and finds it by key', () => {
    for (const destination of MOD_DESTINATIONS) {
      expect(destination.max).toBeGreaterThan(destination.min);
      expect(destination.step).toBeGreaterThan(0);
      expect(destinationOf(destination.key)).toBe(destination);
    }
    expect(() => destinationOf('nope' as ModDestinationName)).toThrow();
  });

  it('reaches a hard pan inside the range it offers, which a unit slider would not', () => {
    expect(destinationOf('pan-units').max).toBeGreaterThanOrEqual(1000);
  });

  it('stops each clamping destination at the depth past which nothing changes', () => {
    expect(destinationOf('amp-gain').max).toBeLessThanOrEqual(3);
    expect(destinationOf('filter-env-depth').max).toBeLessThanOrEqual(2);
  });
});

describe('unmetRequirement', () => {
  it('calls the filter-envelope destination silent while there is nothing to scale', () => {
    const patch = defaultPatch();
    expect(patch.envToCutoffCents).toBe(0);
    expect(unmetRequirement(patch, destinationOf('filter-env-depth'))).toBe('filter-env');
    patch.envToCutoffCents = 1800;
    expect(unmetRequirement(patch, destinationOf('filter-env-depth'))).toBeNull();
  });

  it('calls the LFO rate destination silent while LFO 1 drives nothing', () => {
    const patch = defaultPatch();
    expect(unmetRequirement(patch, destinationOf('lfo1-rate-scale'))).toBe('lfo1-audible');
    patch.lfoToPitchCents = 40;
    expect(unmetRequirement(patch, destinationOf('lfo1-rate-scale'))).toBeNull();
  });

  it('counts a routing out of LFO 1 as waking it, but not one back into its own rate', () => {
    const selfOnly = defaultPatch();
    selfOnly.modRoutings = [{ source: 'lfo1', destination: 'lfo1-rate-scale', depth: 1 }];
    expect(unmetRequirement(selfOnly, destinationOf('lfo1-rate-scale'))).toBe('lfo1-audible');
    const routed = defaultPatch();
    routed.modRoutings = [{ source: 'lfo1', destination: 'cutoff-cents', depth: 600 }];
    expect(unmetRequirement(routed, destinationOf('lfo1-rate-scale'))).toBeNull();
  });

  it('has nothing to say about a destination with no requirement', () => {
    for (const destination of MOD_DESTINATIONS) {
      if (!destination.requires) {
        expect(unmetRequirement(defaultPatch(), destination)).toBeNull();
      }
    }
  });
});

describe('the dependencies a control would otherwise hide', () => {
  it('reports detune as dead until the stack has more than one voice', () => {
    expect(detuneHasEffect({ ...defaultPatch(), unison: 1 })).toBe(false);
    expect(detuneHasEffect({ ...defaultPatch(), unison: 2 })).toBe(true);
  });

  it('offers a filter output only on the model that answers it', () => {
    expect(offersFilterOutput('svf')).toBe(true);
    for (const model of FILTER_MODELS) {
      if (model !== 'svf') expect(offersFilterOutput(model)).toBe(false);
    }
  });
});

describe('the phrases', () => {
  it('give each phrase a distinct id that phraseOf finds', () => {
    const ids = PHRASES.map((phrase) => phrase.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(phraseOf(id).id).toBe(id);
    expect(() => phraseOf('nope')).toThrow();
  });

  it('leave room after the last note for a release to finish', () => {
    for (const phrase of PHRASES) {
      const lastOff = Math.max(...phrase.notes.map((note) => note.beat + note.beats));
      expect(phrase.beats).toBeGreaterThan(lastOff);
    }
  });

  it('keep every note in the MIDI range and every velocity audible', () => {
    for (const phrase of PHRASES) {
      for (const note of phrase.notes) {
        expect(note.note).toBeGreaterThanOrEqual(0);
        expect(note.note).toBeLessThanOrEqual(127);
        expect(note.velocity).toBeGreaterThan(0);
        expect(note.velocity).toBeLessThanOrEqual(127);
        expect(note.beats).toBeGreaterThan(0);
      }
    }
  });

  it('keep every controller ramp inside the phrase it belongs to', () => {
    for (const phrase of PHRASES) {
      for (const control of phrase.controls ?? []) {
        expect(control.beat).toBeGreaterThanOrEqual(0);
        expect(control.beat + control.beats).toBeLessThanOrEqual(phrase.beats);
      }
    }
  });
});
