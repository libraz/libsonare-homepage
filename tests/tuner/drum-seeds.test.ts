/**
 * Drum-seed + GS-kit unit coverage. The seed table is a hand-transcription of
 * the core's `build_drum_note_table`, so these lock the transcription (a drift
 * detector) and prove every seed renders an audible strike. The GS-kit tests
 * lock the `apply_gs_drum_kit` transform and the render-time (non-mutating)
 * application path.
 */
import { describe, expect, it } from 'vitest';
import { buildDrumSeedSpec, drumCategoryFor } from '@/tuner/dsp/drum-seeds';
import { renderNoteOffline } from '@/tuner/dsp/engine';
import { applyGsDrumKit, gsDrumKitIndex, withGsDrumKit } from '@/tuner/dsp/gs-kit';

const SR = 48000;

function peak(buf: Float32Array): number {
  let m = 0;
  for (const v of buf) m = Math.max(m, Math.abs(v));
  return m;
}

describe('buildDrumSeedSpec', () => {
  it('always seeds the percussion engine as a one-shot (sustain 0)', () => {
    for (const note of [35, 38, 42, 46, 47, 49, 60, 70, 73, 90]) {
      const spec = buildDrumSeedSpec(note);
      expect(spec.engineMode).toBe('percussion');
      expect(spec.percussion).toBeDefined();
      expect(spec.ampEnv.sustain).toBe(0);
      expect(spec.body).toBe('none');
    }
  });

  it('seeds the note-specific layer from the core recipe', () => {
    // Kick (36): membrane + low-pass beater thud, note-tracked.
    const kick = buildDrumSeedSpec(36).percussion!;
    expect(kick.numModes).toBe(2);
    expect(kick.noiseOutput).toBe('lowpass');
    expect(kick.shellFreqHz[0]).toBe(80);

    // Snare (38): the wire crack band is ON — the key distinction a generic
    // tom seed lacked.
    const snare = buildDrumSeedSpec(38).percussion!;
    expect(snare.wireBuzz).toBeCloseTo(0.9, 5);
    expect(snare.baseFreqHz).toBe(185);
    expect(snare.noiseGain).toBeCloseTo(1.1, 5);

    // Closed hi-hat (42): pure high-passed noise, no membrane, mute group 1.
    const hat = buildDrumSeedSpec(42).percussion!;
    expect(hat.numModes).toBe(0);
    expect(hat.noiseOutput).toBe('highpass');
    expect(hat.exclusiveClass).toBe(1);

    // Crash (49): inharmonic ring + blooming shimmer wash.
    const cymbal = buildDrumSeedSpec(49).percussion!;
    expect(cymbal.shimmer).toBeCloseTo(6, 5);
    expect(cymbal.noiseOutput).toBe('highpass');

    // Maracas (70): PhISEM shaker grains, no membrane.
    const maracas = buildDrumSeedSpec(70).percussion!;
    expect(maracas.phisemBeans).toBe(20);
    expect(maracas.phisemResHz).toBe(3200);

    // Open cuica (79): scraper with an upward resonance glide, mute group 2.
    const cuica = buildDrumSeedSpec(79).percussion!;
    expect(cuica.phisemScrapeHz).toBe(40);
    expect(cuica.phisemPitchGlide).toBeCloseTo(0.5, 5);
    expect(cuica.exclusiveClass).toBe(2);
  });

  it('renders an audible strike for every mechanism category', () => {
    // One representative note per category: silence here means a broken seed.
    for (const note of [36, 38, 42, 46, 47, 49, 37, 56, 64, 71, 39, 70, 73, 90]) {
      const buf = renderNoteOffline(buildDrumSeedSpec(note), note, 110, SR, SR);
      expect(peak(buf), `note ${note} is silent`).toBeGreaterThan(0.01);
    }
  });

  it('classifies representative notes', () => {
    expect(drumCategoryFor(36)).toBe('kick');
    expect(drumCategoryFor(38)).toBe('snare');
    expect(drumCategoryFor(47)).toBe('tom');
    expect(drumCategoryFor(42)).toBe('closed-hat');
    expect(drumCategoryFor(46)).toBe('open-hat');
    expect(drumCategoryFor(49)).toBe('cymbal');
    expect(drumCategoryFor(37)).toBe('wood');
    expect(drumCategoryFor(56)).toBe('metal');
    expect(drumCategoryFor(64)).toBe('membrane');
    expect(drumCategoryFor(71)).toBe('whistle');
    expect(drumCategoryFor(39)).toBe('clap');
    expect(drumCategoryFor(70)).toBe('shaker');
    expect(drumCategoryFor(73)).toBe('scraper');
    expect(drumCategoryFor(90)).toBe('generic');
  });
});

describe('gsDrumKitIndex', () => {
  it('maps channel-10 programs to kit indices', () => {
    expect(gsDrumKitIndex(0)).toBe(0); // Standard
    expect(gsDrumKitIndex(8)).toBe(1); // Room
    expect(gsDrumKitIndex(16)).toBe(2); // Power
    expect(gsDrumKitIndex(24)).toBe(3); // Electronic
    expect(gsDrumKitIndex(25)).toBe(4); // TR-808
    expect(gsDrumKitIndex(32)).toBe(5); // Jazz
    expect(gsDrumKitIndex(40)).toBe(6); // Brush
    expect(gsDrumKitIndex(48)).toBe(7); // Orchestra
    expect(gsDrumKitIndex(56)).toBe(8); // SFX
    expect(gsDrumKitIndex(1)).toBe(0); // unmapped → Standard
  });
});

describe('applyGsDrumKit', () => {
  it('Power lowers and lengthens a membrane snare', () => {
    const perc = buildDrumSeedSpec(38).percussion!;
    const amp = { ...buildDrumSeedSpec(38).ampEnv };
    const gain = applyGsDrumKit(perc, amp, 2, 38);
    expect(perc.baseFreqHz).toBeCloseTo(185 * 0.86, 3);
    expect(perc.modeDecayS).toBeCloseTo(0.12 * 1.4, 5);
    expect(gain).toBeCloseTo(1.2, 5);
  });

  it('Brush softens the snare wire rattle into a swish', () => {
    const perc = buildDrumSeedSpec(38).percussion!;
    const amp = { ...buildDrumSeedSpec(38).ampEnv };
    applyGsDrumKit(perc, amp, 6, 38);
    expect(perc.wireBuzz).toBeCloseTo(0.9 * 0.4, 5);
    expect(perc.noiseDecayMs).toBeCloseTo(160 * 2.5, 3);
  });

  it('TR-808 collapses the kick to a single decaying sine', () => {
    const perc = buildDrumSeedSpec(36).percussion!;
    const amp = { ...buildDrumSeedSpec(36).ampEnv };
    const gain = applyGsDrumKit(perc, amp, 4, 36);
    expect(perc.numModes).toBe(1);
    expect(perc.pitchDrop).toBeCloseTo(1.0, 5);
    expect(gain).toBeCloseTo(1.2, 5);
  });

  it('SFX and Standard leave the voicing untouched', () => {
    for (const kit of [0, 8]) {
      const perc = buildDrumSeedSpec(38).percussion!;
      const amp = { ...buildDrumSeedSpec(38).ampEnv };
      const before = JSON.stringify(perc);
      const gain = applyGsDrumKit(perc, amp, kit, 38);
      expect(JSON.stringify(perc)).toBe(before);
      expect(gain).toBe(1);
    }
  });
});

describe('withGsDrumKit', () => {
  it('does not mutate the input spec', () => {
    const spec = buildDrumSeedSpec(38);
    const before = JSON.stringify(spec);
    withGsDrumKit(spec, 40, 38); // Brush
    expect(JSON.stringify(spec)).toBe(before);
  });

  it('folds the kit gain into the wrapper gain', () => {
    const spec = buildDrumSeedSpec(38); // gain 0.8
    const powered = withGsDrumKit(spec, 16, 38); // Power → 1.2×
    expect(powered.gain).toBeCloseTo(0.8 * 1.2, 5);
  });

  it('Standard kit passes through by identity', () => {
    const spec = buildDrumSeedSpec(38);
    expect(withGsDrumKit(spec, 0, 38)).toBe(spec);
  });
});
