import { describe, expect, it } from 'vitest';
import {
  GM_DRUM_NAMES_JA,
  GM_DRUM_NOTES,
  GM_FAMILIES,
  GM_FAMILY_NAMES_JA,
  GM_PROGRAM_NAMES,
  GM_PROGRAM_NAMES_JA,
  GS_DRUM_KIT_NAMES_JA,
  GS_DRUM_KITS,
  gmBody,
  gmEngineFor,
  gmNoteFor,
  gmVoicing,
} from '@/components/tuner/gmTargets';
import { specToJson, type TunerTarget, targetFromJson } from '@/components/tuner/tunerJson';
import type { BodyType } from '@/tuner/dsp/body-resonator';
import { buildDefaultSpec } from '@/tuner/dsp/engine';
import { ENGINE_INFO } from '@/tuner/dsp/params';

describe('GM target map', () => {
  it('names all 128 GM programs', () => {
    expect(GM_PROGRAM_NAMES).toHaveLength(128);
    expect(GM_PROGRAM_NAMES[0]).toBe('Acoustic Grand Piano');
    expect(GM_PROGRAM_NAMES[40]).toBe('Violin');
    expect(GM_PROGRAM_NAMES[127]).toBe('Gunshot');
    expect(GM_PROGRAM_NAMES.every((n) => n.length > 0)).toBe(true);
  });

  it('has 16 families that tile the program space', () => {
    expect(GM_FAMILIES).toHaveLength(16);
    expect(GM_FAMILIES[0].start).toBe(0);
    for (let i = 1; i < GM_FAMILIES.length; ++i) {
      expect(GM_FAMILIES[i].start).toBe(GM_FAMILIES[i - 1].start + 8);
    }
  });

  it('covers the full GM drum map (35-81)', () => {
    expect(GM_DRUM_NOTES[0].note).toBe(35);
    expect(GM_DRUM_NOTES[GM_DRUM_NOTES.length - 1].note).toBe(81);
    expect(GM_DRUM_NOTES.find((d) => d.note === 38)?.name).toBe('Acoustic Snare');
  });

  it('maps every program to a real physical engine and note', () => {
    for (let p = 0; p < 128; ++p) {
      const engine = gmEngineFor(p);
      expect(ENGINE_INFO[engine]).toBeDefined();
      const note = gmNoteFor(p);
      expect(note).toBeGreaterThanOrEqual(0);
      expect(note).toBeLessThanOrEqual(127);
    }
  });

  it('routes representative programs to the expected engine', () => {
    expect(gmEngineFor(0)).toBe('piano'); // Acoustic Grand
    expect(gmEngineFor(24)).toBe('karplus-strong'); // Nylon guitar
    expect(gmEngineFor(40)).toBe('bowed-string'); // Violin
    expect(gmEngineFor(56)).toBe('brass'); // Trumpet
    expect(gmEngineFor(73)).toBe('flute'); // Flute
    expect(gmEngineFor(104)).toBe('plucked-string'); // Sitar (buzzing bridge)
    expect(gmEngineFor(47)).toBe('percussion'); // Timpani (override)
  });
});

describe('GM slot voicing (physical vs non-physical)', () => {
  it('flags electric pianos as FM (not the acoustic piano model)', () => {
    expect(gmVoicing(4)).toEqual({ kind: 'synth', mode: 'fm' }); // Electric Piano 1
    expect(gmVoicing(5)).toEqual({ kind: 'synth', mode: 'fm' }); // Electric Piano 2
  });

  it('keeps acoustic pianos physical and routes plucked keyboards to KS', () => {
    expect(gmVoicing(0)).toEqual({ kind: 'physical', engine: 'piano' }); // Acoustic Grand
    expect(gmVoicing(6)).toEqual({ kind: 'physical', engine: 'karplus-strong' }); // Harpsichord
    expect(gmVoicing(7)).toEqual({ kind: 'physical', engine: 'karplus-strong' }); // Clavi
  });

  it('flags the wholly-synth families as out of scope', () => {
    for (const p of [80, 87, 88, 95, 96, 103, 120, 127]) {
      expect(gmVoicing(p).kind, `program ${p}`).toBe('synth');
    }
  });

  it('marks tonewheel organs additive but keeps church organ physical', () => {
    expect(gmVoicing(16)).toEqual({ kind: 'synth', mode: 'additive' }); // Drawbar Organ
    expect(gmVoicing(19)).toEqual({ kind: 'physical', engine: 'pipe-organ' }); // Church Organ
    expect(gmVoicing(21)).toEqual({ kind: 'physical', engine: 'free-reed' }); // Accordion
  });

  it('routes the new physical families to their dedicated cores', () => {
    expect(gmVoicing(52)).toEqual({ kind: 'physical', engine: 'vocal' }); // Choir Aahs
    expect(gmVoicing(54)).toEqual({ kind: 'physical', engine: 'vocal' }); // Synth Voice
    expect(gmVoicing(22)).toEqual({ kind: 'physical', engine: 'free-reed' }); // Harmonica
    expect(gmVoicing(104)).toEqual({ kind: 'physical', engine: 'plucked-string' }); // Sitar
    expect(gmVoicing(107)).toEqual({ kind: 'physical', engine: 'plucked-string' }); // Koto
    expect(gmVoicing(105)).toEqual({ kind: 'physical', engine: 'karplus-strong' }); // Banjo
  });

  it('agrees with gmEngineFor whenever the slot is physical', () => {
    for (let p = 0; p < 128; ++p) {
      const v = gmVoicing(p);
      if (v.kind === 'physical') expect(v.engine).toBe(gmEngineFor(p));
    }
  });
});

describe('GM slot body derivation', () => {
  const VALID: BodyType[] = ['none', 'guitar', 'violin', 'wood-tube', 'brass-bell', 'vocal'];

  it('gives every program a valid body and an in-range mix', () => {
    for (let p = 0; p < 128; ++p) {
      const { body, mix } = gmBody(p);
      expect(VALID, `program ${p}`).toContain(body);
      expect(mix).toBeGreaterThanOrEqual(0);
      expect(mix).toBeLessThanOrEqual(1);
    }
  });

  it('gives plucked acoustic strings a guitar corpus the bare KS loop lacks', () => {
    // These route to Karplus-Strong (defaultBody 'none') but need a soundbox.
    for (const p of [24, 25, 26, 32, 46, 105]) {
      expect(gmEngineFor(p)).toBe('karplus-strong');
      expect(gmBody(p).body, `program ${p}`).toBe('guitar');
      expect(gmBody(p).mix).toBeGreaterThan(0);
    }
    // The buzzing-bridge ethnic strings route to the plucked-string core; they
    // still get a wooden corpus.
    for (const p of [104, 106, 107]) {
      expect(gmEngineFor(p)).toBe('plucked-string');
      expect(gmBody(p).body, `program ${p}`).toBe('guitar');
      expect(gmBody(p).mix).toBeGreaterThan(0);
    }
  });

  it('inherits the engine default when the program implies nothing stronger', () => {
    expect(gmBody(40).body).toBe('violin'); // Violin — bowed-string default
    expect(gmBody(56).body).toBe('brass-bell'); // Trumpet — brass default
    expect(gmBody(6).body).toBe('none'); // Harpsichord — KS, no soundbox override
    expect(gmBody(0).body).toBe('none'); // Acoustic Grand — piano default
  });
});

describe('Japanese name tables', () => {
  it('localizes every program and family with no gaps', () => {
    expect(GM_PROGRAM_NAMES_JA).toHaveLength(GM_PROGRAM_NAMES.length);
    expect(GM_PROGRAM_NAMES_JA.every((n) => n.trim().length > 0)).toBe(true);
    expect(GM_FAMILY_NAMES_JA).toHaveLength(GM_FAMILIES.length);
    expect(GM_FAMILY_NAMES_JA.every((n) => n.trim().length > 0)).toBe(true);
  });

  it('localizes every GM drum note and GS kit', () => {
    for (const d of GM_DRUM_NOTES) expect(GM_DRUM_NAMES_JA[d.note]?.length).toBeGreaterThan(0);
    for (const k of GS_DRUM_KITS)
      expect(GS_DRUM_KIT_NAMES_JA[k.program]?.length).toBeGreaterThan(0);
  });
});

describe('tuner patch target round-trip', () => {
  it('tags a melodic target into the exported JSON', () => {
    const spec = buildDefaultSpec('bowed-string');
    const target: TunerTarget = { standard: 'GM', kind: 'melodic', program: 40, name: 'Violin' };
    const json = specToJson(spec, target);
    expect(json.target).toEqual(target);
    expect(targetFromJson(json)).toEqual(target);
  });

  it('tags a GS variation-bank melodic target', () => {
    const spec = buildDefaultSpec('reed');
    const target: TunerTarget = {
      standard: 'GS',
      kind: 'melodic',
      program: 64,
      bankMsb: 8,
      bankLsb: 0,
      name: 'Soprano Sax',
    };
    const json = specToJson(spec, target);
    expect(json.target).toEqual(target);
    expect(targetFromJson(json)).toEqual(target);
  });

  it('tags a GS drum-kit target', () => {
    const spec = buildDefaultSpec('percussion');
    const target: TunerTarget = {
      standard: 'GS',
      kind: 'drum',
      drumNote: 38,
      drumKit: 8,
      name: 'Acoustic Snare',
    };
    const json = specToJson(spec, target);
    expect(json.target).toEqual(target);
    expect(targetFromJson(json)).toEqual(target);
  });

  it('omits the target block when none is set', () => {
    const json = specToJson(buildDefaultSpec('karplus-strong'), null);
    expect(json.target).toBeUndefined();
    expect(targetFromJson(json)).toBeNull();
  });

  it('rejects a malformed target on import', () => {
    expect(targetFromJson({ target: { standard: 'XG', kind: 'melodic' } })).toBeNull();
    expect(targetFromJson({ target: { kind: 'other' } })).toBeNull();
    expect(targetFromJson({})).toBeNull();
  });
});
