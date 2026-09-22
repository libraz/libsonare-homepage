// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  BODIES,
  type ClassicPatch,
  defaultPatch,
  MAX_MOD_ROUTINGS,
  MOD_DESTINATIONS,
  PHRASE_GESTURE,
  PHRASE_STACCATO,
  PHRASE_SUSTAIN,
} from '@/demos/classic-synth/classicSynthState';
import {
  phraseEvents,
  phraseSmf,
  renderKey,
  renderPhrase,
  subtractivePresets,
} from '@/demos/classic-synth/useClassicSynth';
import * as wasm from '@/wasm/index.js';

/**
 * float32 carries about 5.96e-8 per unit in the last place, so two renders
 * within this of each other did not change the signal — they are the same
 * numbers arrived at along a slightly different route.
 */
const UNCHANGED = 1e-7;

function maxDiff(a: Float32Array, b: Float32Array): number {
  expect(a.length).toBe(b.length);
  let worst = 0;
  for (let i = 0; i < a.length; i++) {
    const d = Math.abs(a[i] - b[i]);
    if (d > worst) worst = d;
  }
  return worst;
}

function peak(samples: Float32Array): number {
  let worst = 0;
  for (const sample of samples) {
    const a = Math.abs(sample);
    if (a > worst) worst = a;
  }
  return worst;
}

// biome-ignore lint/suspicious/noExplicitAny: the Project statics are untyped here on purpose
type AnyProject = any;

describe('phraseEvents', () => {
  it('orders a note-off ahead of a note-on landing on the same beat', async () => {
    await wasm.init();
    const Project = (wasm as unknown as { Project: AnyProject }).Project;
    const phrase = {
      id: 'repeat',
      notes: [
        { note: 60, beat: 0, beats: 1, velocity: 100 },
        { note: 60, beat: 1, beats: 1, velocity: 100 },
      ],
      beats: 3,
    };
    const events = phraseEvents(Project, phrase) as { ppq: number; data0: number }[];
    // The status nibble sits in the third byte of the packed word.
    const status = events.map((event) => (event.data0 >>> 16) & 0xf0);
    expect(events.map((event) => event.ppq)).toEqual([0, 1, 1, 2]);
    // The middle pair both land on beat 1: the note-off must be realized first
    // or the second note silences itself the instant it starts.
    expect(status).toEqual([0x90, 0x80, 0x90, 0x80]);
  });

  it('draws a controller ramp as many steps, not as two endpoints', async () => {
    await wasm.init();
    const Project = (wasm as unknown as { Project: AnyProject }).Project;
    const plain = phraseEvents(Project, PHRASE_SUSTAIN);
    const gesture = phraseEvents(Project, PHRASE_GESTURE);
    expect(gesture.length).toBeGreaterThan(plain.length + 100);
  });
});

describe('renderPhrase', () => {
  it('renders the same patch and phrase to the same samples', async () => {
    await wasm.init();
    const patch = defaultPatch();
    const first = renderPhrase(wasm, patch, PHRASE_SUSTAIN);
    const second = renderPhrase(wasm, patch, PHRASE_SUSTAIN);
    expect(maxDiff(first.interleaved, second.interleaved)).toBe(0);
  });

  it('renders stereo of the length the phrase asks for', async () => {
    await wasm.init();
    const rendered = renderPhrase(wasm, defaultPatch(), PHRASE_SUSTAIN);
    expect(rendered.channels).toBe(2);
    expect(rendered.interleaved.length).toBe(rendered.frames * rendered.channels);
    expect(rendered.frames).toBeGreaterThan(rendered.sampleRate);
  });

  it('makes a sound with the patch a reader meets first', async () => {
    await wasm.init();
    expect(peak(renderPhrase(wasm, defaultPatch(), PHRASE_SUSTAIN).interleaved)).toBeGreaterThan(
      0.01,
    );
  });

  it('hears the cutoff close', async () => {
    await wasm.init();
    const open = renderPhrase(wasm, defaultPatch(), PHRASE_SUSTAIN);
    const shut: ClassicPatch = { ...defaultPatch(), cutoffHz: 120 };
    const closed = renderPhrase(wasm, shut, PHRASE_SUSTAIN);
    expect(maxDiff(open.interleaved, closed.interleaved)).toBeGreaterThan(UNCHANGED);
  });

  it('hears an amp release lengthen, which only the tail can show', async () => {
    await wasm.init();
    const short = renderPhrase(wasm, { ...defaultPatch(), ampReleaseMs: 20 }, PHRASE_STACCATO);
    const long = renderPhrase(wasm, { ...defaultPatch(), ampReleaseMs: 2000 }, PHRASE_STACCATO);
    expect(maxDiff(short.interleaved, long.interleaved)).toBeGreaterThan(UNCHANGED);
  });
});

/**
 * The page states these as measurements, so they are tested as measurements. A
 * refreshed engine build that changes any of them makes a sentence on screen
 * false, and this is where that shows up.
 */
describe('what the chapters claim about this build', () => {
  /** A patch with everything that would blur a comparison turned off. */
  function bench(): ClassicPatch {
    return {
      ...defaultPatch(),
      waveform: 'saw',
      cutoffHz: 1200,
      resonanceQ: 4,
      envToCutoffCents: 0,
      velToCutoffCents: 0,
      unison: 1,
      detuneCents: 0,
      driftCents: 0,
      stereoSpread: 0,
      body: 'none',
      bodyMix: 0,
    };
  }

  it('gives the four filter models four different sounds', async () => {
    await wasm.init();
    const models = ['svf', 'moog-ladder', 'diode-ladder', 'sallen-key'] as const;
    const renders = models.map(
      (filterModel) => renderPhrase(wasm, { ...bench(), filterModel }, PHRASE_SUSTAIN).interleaved,
    );
    for (let a = 0; a < models.length; a++) {
      for (let b = a + 1; b < models.length; b++) {
        expect(maxDiff(renders[a], renders[b])).toBeGreaterThan(UNCHANGED);
      }
    }
  });

  it('answers the output mode on the state-variable filter and on no other', async () => {
    await wasm.init();
    for (const filterModel of ['svf', 'moog-ladder', 'diode-ladder', 'sallen-key'] as const) {
      const lowpass = renderPhrase(wasm, { ...bench(), filterModel }, PHRASE_SUSTAIN).interleaved;
      for (const filterOutput of ['bandpass', 'highpass'] as const) {
        const other = renderPhrase(
          wasm,
          { ...bench(), filterModel, filterOutput },
          PHRASE_SUSTAIN,
        ).interleaved;
        const moved = maxDiff(lowpass, other);
        if (filterModel === 'svf') expect(moved).toBeGreaterThan(UNCHANGED);
        else expect(moved).toBeLessThanOrEqual(UNCHANGED);
      }
    }
  });

  it('gates every body behind the mix, so zero mix is exactly no body', async () => {
    await wasm.init();
    const dry = renderPhrase(wasm, bench(), PHRASE_SUSTAIN).interleaved;
    for (const body of BODIES) {
      if (body === 'none') continue;
      const gated = renderPhrase(wasm, { ...bench(), body }, PHRASE_SUSTAIN).interleaved;
      expect(maxDiff(dry, gated)).toBeLessThanOrEqual(UNCHANGED);
      const open = renderPhrase(
        wasm,
        { ...bench(), body, bodyMix: 0.6 },
        PHRASE_SUSTAIN,
      ).interleaved;
      expect(maxDiff(dry, open)).toBeGreaterThan(UNCHANGED);
    }
  });

  it('leaves detune inert with one voice in the stack, and audible with two', async () => {
    await wasm.init();
    const single = renderPhrase(wasm, bench(), PHRASE_SUSTAIN).interleaved;
    expect(
      maxDiff(
        single,
        renderPhrase(wasm, { ...bench(), detuneCents: 40 }, PHRASE_SUSTAIN).interleaved,
      ),
    ).toBeLessThanOrEqual(UNCHANGED);
    const stacked = renderPhrase(wasm, { ...bench(), unison: 3 }, PHRASE_SUSTAIN).interleaved;
    expect(
      maxDiff(
        stacked,
        renderPhrase(wasm, { ...bench(), unison: 3, detuneCents: 40 }, PHRASE_SUSTAIN).interleaved,
      ),
    ).toBeGreaterThan(UNCHANGED);
  });

  it('drifts a single voice, which detune cannot', async () => {
    await wasm.init();
    const still = renderPhrase(wasm, bench(), PHRASE_SUSTAIN).interleaved;
    const drifting = renderPhrase(wasm, { ...bench(), driftCents: 20 }, PHRASE_SUSTAIN).interleaved;
    expect(maxDiff(still, drifting)).toBeGreaterThan(UNCHANGED);
  });

  it('moves the sound for every destination the matrix offers', async () => {
    await wasm.init();
    const base: ClassicPatch = { ...bench(), envToCutoffCents: 1800, lfoToPitchCents: 40 };
    const reference = renderPhrase(wasm, base, PHRASE_GESTURE).interleaved;
    for (const destination of MOD_DESTINATIONS) {
      const depth = destination.max;
      const routed = renderPhrase(
        wasm,
        { ...base, modRoutings: [{ source: 'mod-wheel', destination: destination.key, depth }] },
        PHRASE_GESTURE,
      ).interleaved;
      expect(maxDiff(reference, routed), `${destination.key} did nothing`).toBeGreaterThan(
        UNCHANGED,
      );
    }
  });

  it('reaches nothing through the four destinations the page leaves out', async () => {
    await wasm.init();
    const base = bench();
    const reference = renderPhrase(wasm, base, PHRASE_GESTURE).interleaved;
    for (const destination of [
      'excitation-force',
      'excitation-position',
      'excitation-brightness',
      'spectrum-morph',
    ] as const) {
      for (const depth of [0.5, 1]) {
        const routed = renderPhrase(
          wasm,
          { ...base, modRoutings: [{ source: 'mod-wheel', destination, depth }] },
          PHRASE_GESTURE,
        ).interleaved;
        expect(maxDiff(reference, routed), `${destination} moved the sound`).toBeLessThanOrEqual(
          UNCHANGED,
        );
      }
    }
  });

  it('silences the filter-envelope destination while there is nothing to scale', async () => {
    await wasm.init();
    const base: ClassicPatch = { ...bench(), envToCutoffCents: 0 };
    const reference = renderPhrase(wasm, base, PHRASE_GESTURE).interleaved;
    const routed = renderPhrase(
      wasm,
      {
        ...base,
        modRoutings: [{ source: 'mod-wheel', destination: 'filter-env-depth', depth: 2 }],
      },
      PHRASE_GESTURE,
    ).interleaved;
    expect(maxDiff(reference, routed)).toBeLessThanOrEqual(UNCHANGED);
  });

  it('refuses a ninth routing rather than dropping it, which is why the matrix caps at eight', async () => {
    await wasm.init();
    const routing = { source: 'mod-wheel', destination: 'cutoff-cents', depth: 100 } as const;
    const eight = Array.from({ length: MAX_MOD_ROUTINGS }, () => ({ ...routing }));
    expect(() =>
      renderPhrase(wasm, { ...bench(), modRoutings: eight }, PHRASE_SUSTAIN),
    ).not.toThrow();
    expect(() =>
      renderPhrase(wasm, { ...bench(), modRoutings: [...eight, { ...routing }] }, PHRASE_SUSTAIN),
    ).toThrow();
  });
});

describe('renderKey', () => {
  it('is the same for two patches that differ only in the order keys were set', () => {
    const a = defaultPatch();
    const b: ClassicPatch = { ...defaultPatch() };
    expect(renderKey(a, PHRASE_SUSTAIN)).toBe(renderKey(b, PHRASE_SUSTAIN));
  });

  it('changes when any field changes', () => {
    const base = defaultPatch();
    expect(renderKey({ ...base, cutoffHz: 500 }, PHRASE_SUSTAIN)).not.toBe(
      renderKey(base, PHRASE_SUSTAIN),
    );
    expect(
      renderKey(
        { ...base, modRoutings: [{ source: 'lfo1', destination: 'cutoff-cents', depth: 600 }] },
        PHRASE_SUSTAIN,
      ),
    ).not.toBe(renderKey(base, PHRASE_SUSTAIN));
  });

  it('separates the same patch on two phrases', () => {
    const patch = defaultPatch();
    expect(renderKey(patch, PHRASE_SUSTAIN)).not.toBe(renderKey(patch, PHRASE_STACCATO));
  });
});

describe('phraseSmf', () => {
  it('writes a Standard MIDI File a reader can take away', async () => {
    await wasm.init();
    const bytes = phraseSmf(wasm, PHRASE_STACCATO);
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('MThd');
    expect(bytes.length).toBeGreaterThan(22);
  });
});

describe('subtractivePresets', () => {
  it('offers only presets the panel on screen actually describes', async () => {
    await wasm.init();
    const names = subtractivePresets(wasm);
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      expect(wasm.synthPresetPatch(name).engineMode).toBe('subtractive');
    }
  });

  it('leaves out the presets built on another engine', async () => {
    await wasm.init();
    expect(subtractivePresets(wasm).length).toBeLessThan(wasm.synthPresetNames().length);
  });
});
