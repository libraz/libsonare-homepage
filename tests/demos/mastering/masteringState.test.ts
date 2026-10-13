/**
 * The /mastering project state: the fixed lane-1 layout, the mutator list
 * every UI edit goes through (pure, one history entry each), Quick macros,
 * loudness-fit staleness, and save/restore including the earlier page's
 * saved chain presets.
 */
import { describe, expect, it } from 'vitest';
import { useHistory } from '@/composables/useHistory';
import { MASTERING_MACROS } from '@/demos/mastering/masteringMacros';
import { presetChainParams } from '@/demos/mastering/masteringPresetMap';
import {
  convertLegacyMasteringPreset,
  defaultMasteringState,
  deserializeMasteringState,
  isLoudnessFitStale,
  MASTERING_EQ_LAYOUT,
  MASTERING_INSERT_LAYOUT,
  MASTERING_SLOT,
  type MasteringMutatorName,
  type MasteringState,
  masteringMutators as m,
  masteringTargetLufs,
  serializeMasteringState,
} from '@/demos/mastering/masteringState';

const SOURCE = {
  id: 'src-1',
  fileName: 'mix.wav',
  sampleRate: 48_000,
  frames: 480_000,
  channels: 2,
};
const REFERENCE = {
  id: 'ref-1',
  fileName: 'ref.wav',
  sampleRate: 48_000,
  frames: 240_000,
  channels: 2,
};
const FIT = {
  targetLufs: -14,
  driveDb: 3.25,
  measuredLufs: -14.1,
  residualLu: 0.1,
  bounces: 2,
  limited: false,
};

function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

describe('layout', () => {
  it('is the design insert column in signal order', () => {
    expect(MASTERING_INSERT_LAYOUT.map((entry) => entry.processor)).toEqual([
      'utility.gain',
      'eq.tilt',
      'dynamics.deesser',
      'dynamics.transientShaper',
      'dynamics.compressor',
      'multiband.compressor',
      'saturation.tape',
      'saturation.exciter',
      'spectral.airBand',
      'stereo.imager',
      'stereo.monoMaker',
      'utility.gain',
      'maximizer.truePeakLimiter',
    ]);
    expect(MASTERING_SLOT.drive).toBe(11);
    expect(MASTERING_SLOT.limiter).toBe(12);
  });

  it('has an 8-band strip EQ with fixed band types', () => {
    expect(MASTERING_EQ_LAYOUT.map((band) => band.type)).toEqual([
      'HighPass',
      'LowShelf',
      'Peak',
      'Peak',
      'Peak',
      'Peak',
      'HighShelf',
      'LowPass',
    ]);
  });

  it('starts as Pop in a studio, delivered at the YouTube target', () => {
    const state = defaultMasteringState();
    expect(state.quick).toMatchObject({ preset: 'pop', venue: 'studio', platform: 'youtube' });
    expect(masteringTargetLufs(state)).toBe(-14);
    expect(state.monitor).toEqual({ lane: 'after', matchLoudness: true });
    expect(isLoudnessFitStale(state)).toBe(true);
  });
});

// One representative call per mutator: `from` builds a state the call changes.
type Case = {
  from?: (s: MasteringState) => MasteringState;
  run: (s: MasteringState) => MasteringState;
};
const CASES: Record<MasteringMutatorName, Case> = {
  setMode: { run: (s) => m.setMode(s, 'studio') },
  setSource: { run: (s) => m.setSource(s, SOURCE) },
  setReference: { run: (s) => m.setReference(s, REFERENCE) },
  setRepairStageEnabled: { run: (s) => m.setRepairStageEnabled(s, 'declick', true) },
  setRepairParam: { run: (s) => m.setRepairParam(s, 'dehum', 'fundamentalHz', 60) },
  setEqBand: { run: (s) => m.setEqBand(s, 1, { gainDb: 2.5, enabled: true }) },
  setInsertParam: { run: (s) => m.setInsertParam(s, MASTERING_SLOT.compressor, 'ratio', 4) },
  setInsertBypassed: { run: (s) => m.setInsertBypassed(s, MASTERING_SLOT.tape, false) },
  resetInsert: {
    from: (s) => m.setInsertParam(s, MASTERING_SLOT.air, 'amount', 0.9),
    run: (s) => m.resetInsert(s, MASTERING_SLOT.air),
  },
  applyLoudnessFit: { run: (s) => m.applyLoudnessFit(s, FIT) },
  setMonitorLane: { run: (s) => m.setMonitorLane(s, 'before') },
  setMatchLoudness: { run: (s) => m.setMatchLoudness(s, false) },
  applyMatchEq: {
    run: (s) =>
      m.applyMatchEq(
        s,
        {
          bands: [
            { frequencyHz: 200, gainDb: 1, q: 1 },
            { frequencyHz: 800, gainDb: -1, q: 2 },
            { frequencyHz: 2500, gainDb: 2, q: 1 },
            { frequencyHz: 9000, gainDb: -2, q: 0.7 },
          ],
          residualRatio: 0.3,
        },
        'ref-1',
      ),
  },
  clearMatchEq: {
    from: (s) => m.setEqBand(s, 3, { gainDb: 4, enabled: true }),
    run: (s) => m.clearMatchEq(s),
  },
  selectPreset: { run: (s) => m.selectPreset(s, 'acoustic') },
  selectVenue: { run: (s) => m.selectVenue(s, 'livehouseLarge') },
  selectPlatform: { run: (s) => m.selectPlatform(s, 'apple') },
  setCustomLufs: { run: (s) => m.setCustomLufs(s, -11) },
  setMacro: { run: (s) => m.setMacro(s, 'tone', 1.5) },
  applyAssistant: { run: (s) => m.applyAssistant(s, { 'dynamics.compressor.ratio': 3.5 }) },
  applyRepairSuggestion: {
    run: (s) => m.applyRepairSuggestion(s, { dehum: { fundamentalHz: 60, harmonics: 4 } }),
  },
};

describe('mutators', () => {
  it('the case table covers exactly the exported mutators', () => {
    expect(Object.keys(CASES).sort()).toEqual(Object.keys(m).sort());
  });

  it.each(Object.entries(CASES))('%s is pure and is one history entry', (_name, { from, run }) => {
    const start = freeze(structuredClone((from ?? ((s) => s))(defaultMasteringState())));
    const snapshot = JSON.stringify(start);
    const next = run(start);
    expect(JSON.stringify(start)).toBe(snapshot);
    expect(JSON.stringify(next)).not.toBe(snapshot);
    // Still plain data: it survives the snapshot copy and a save/restore.
    expect(structuredClone(next)).toEqual(next);
    expect(deserializeMasteringState(serializeMasteringState(next))).toEqual({
      state: next,
      notices: [],
    });

    const history = useHistory(start);
    history.commit(next);
    expect(history.state.value).toEqual(next);
    expect(history.undo()).toEqual(start);
    expect(history.canUndo.value).toBe(false);
    expect(history.redo()).toEqual(next);
  });

  it('a drag of many edits is one history entry', () => {
    const history = useHistory(defaultMasteringState());
    history.begin();
    for (const ratio of [2.5, 3, 3.5, 4]) {
      history.commit(
        m.setInsertParam(history.state.value, MASTERING_SLOT.compressor, 'ratio', ratio),
      );
    }
    history.end();
    expect(history.state.value.inserts[MASTERING_SLOT.compressor].params.ratio).toBe(4);
    history.undo();
    expect(history.canUndo.value).toBe(false);
    expect(history.state.value).toEqual(defaultMasteringState());
  });

  it('refuses edits the layout does not have', () => {
    const state = defaultMasteringState();
    expect(() => m.setInsertParam(state, 13, 'levelDb', 0)).toThrow(RangeError);
    expect(() => m.setInsertParam(state, MASTERING_SLOT.limiter, 'noSuchParam', 0)).toThrow(
      RangeError,
    );
    expect(() => m.setInsertParam(state, MASTERING_SLOT.limiter, 'ceilingDb', Number.NaN)).toThrow(
      RangeError,
    );
    expect(() => m.setInsertParam(state, MASTERING_SLOT.compressor, 'autoMakeup', 1)).toThrow(
      RangeError,
    );
    expect(() => m.setEqBand(state, 8, { gainDb: 1 })).toThrow(RangeError);
    expect(() => m.selectPreset(state, 'noSuchPreset' as never)).toThrow(RangeError);
  });

  it('cannot monitor a reference that is not loaded', () => {
    const state = defaultMasteringState();
    expect(m.setMonitorLane(state, 'reference')).toBe(state);
    const loaded = m.setMonitorLane(m.setReference(state, REFERENCE), 'reference');
    expect(loaded.monitor.lane).toBe('reference');
    expect(m.setReference(loaded, null).monitor.lane).toBe('after');
  });

  it('keeps an EQ band type fixed', () => {
    const state = m.setEqBand(defaultMasteringState(), 0, { type: 'Peak', gainDb: 1 } as never);
    expect(state.eq[0].type).toBe('HighPass');
  });
});

describe('Quick macros', () => {
  const base = presetChainParams('pop', 'studio');
  const comp = (s: MasteringState, name: string) =>
    s.inserts[MASTERING_SLOT.compressor].params[name] as number;

  it('tone offsets the preset tilt', () => {
    const state = m.setMacro(m.setMacro(defaultMasteringState(), 'tone', 2), 'tone', -1);
    expect(state.inserts[MASTERING_SLOT.tone].params.tiltDb).toBeCloseTo(
      (base['eq.tilt.tiltDb'] as number) - 1,
      9,
    );
  });

  it('dynamics moves threshold by 6 dB and ratio by 30% per unit, ratio floored at 1', () => {
    const looser = m.setMacro(defaultMasteringState(), 'dynamics', 1);
    expect(comp(looser, 'thresholdDb')).toBeCloseTo(
      (base['dynamics.compressor.thresholdDb'] as number) + 6,
      9,
    );
    expect(comp(looser, 'ratio')).toBeCloseTo(
      (base['dynamics.compressor.ratio'] as number) * 0.7,
      9,
    );
    const tighter = m.setMacro(defaultMasteringState(), 'dynamics', -1);
    expect(comp(tighter, 'ratio')).toBeCloseTo(
      (base['dynamics.compressor.ratio'] as number) * 1.3,
      9,
    );
    const acoustic = m.setMacro(m.selectPreset(defaultMasteringState(), 'acoustic'), 'dynamics', 1);
    expect(comp(acoustic, 'ratio')).toBeCloseTo(1.05, 9);
  });

  it('width and ceiling set their slot directly, clamped to the macro range', () => {
    let state = m.setMacro(defaultMasteringState(), 'width', 2);
    expect(state.inserts[MASTERING_SLOT.stereo].params.width).toBe(MASTERING_MACROS.width.max);
    state = m.setMacro(state, 'ceiling', -0.5);
    expect(state.inserts[MASTERING_SLOT.limiter].params.ceilingDb).toBe(-0.5);
    expect(state.quick.macros).toMatchObject({ width: 1.3, ceiling: -0.5 });
  });

  it('one macro leaves the slots of the others alone', () => {
    const edited = m.setInsertParam(defaultMasteringState(), MASTERING_SLOT.compressor, 'ratio', 5);
    expect(comp(m.setMacro(edited, 'tone', 1), 'ratio')).toBe(5);
  });

  it('a new preset resets the macros', () => {
    const state = m.selectPreset(m.setMacro(defaultMasteringState(), 'tone', 3), 'speech');
    expect(state.quick.macros).toEqual({ tone: 0, width: 0.95, dynamics: 0, ceiling: -1 });
  });
});

describe('loudness-fit staleness', () => {
  const fitted = m.applyLoudnessFit(m.setSource(defaultMasteringState(), SOURCE), FIT);

  it('a fresh fit writes the drive and is current', () => {
    expect(fitted.inserts[MASTERING_SLOT.drive].params.levelDb).toBe(3.25);
    expect(isLoudnessFitStale(fitted)).toBe(false);
  });

  it.each([
    [
      'an insert parameter',
      (s: MasteringState) => m.setInsertParam(s, MASTERING_SLOT.compressor, 'ratio', 3),
    ],
    ['a bypass', (s: MasteringState) => m.setInsertBypassed(s, MASTERING_SLOT.tape, false)],
    ['an EQ band', (s: MasteringState) => m.setEqBand(s, 2, { gainDb: 1, enabled: true })],
    ['the repair', (s: MasteringState) => m.setRepairStageEnabled(s, 'denoise', true)],
    ['the target', (s: MasteringState) => m.selectPlatform(s, 'apple')],
    ['the source', (s: MasteringState) => m.setSource(s, { ...SOURCE, id: 'src-2' })],
  ])('changing %s makes it stale', (_label, edit) => {
    expect(isLoudnessFitStale(edit(fitted))).toBe(true);
  });

  it.each([
    ['the monitored lane', (s: MasteringState) => m.setMonitorLane(s, 'before')],
    ['loudness matching', (s: MasteringState) => m.setMatchLoudness(s, false)],
    ['the mode', (s: MasteringState) => m.setMode(s, 'studio')],
    ['the reference', (s: MasteringState) => m.setReference(s, REFERENCE)],
  ])('changing %s keeps it current', (_label, edit) => {
    expect(isLoudnessFitStale(edit(fitted))).toBe(false);
  });

  it('survives a save and restore', () => {
    const { state } = deserializeMasteringState(serializeMasteringState(fitted));
    expect(isLoudnessFitStale(state)).toBe(false);
  });
});

describe('save and restore', () => {
  it('round-trips a full project', () => {
    let state = m.setSource(defaultMasteringState(), SOURCE);
    state = m.setReference(state, REFERENCE);
    state = m.selectVenue(m.selectPreset(state, 'liveLarge'), 'livehouseSmall');
    state = m.applyLoudnessFit(m.setMacro(state, 'dynamics', -0.5), FIT);
    state = m.setMonitorLane(m.setMode(state, 'studio'), 'reference');
    expect(deserializeMasteringState(serializeMasteringState(state))).toEqual({
      state,
      notices: [],
    });
  });

  it('carries no audio', () => {
    const json = serializeMasteringState(m.setSource(defaultMasteringState(), SOURCE));
    expect(json).not.toMatch(/Float32Array|"left"|"right"/);
  });

  it('replaces unusable values with defaults and lists them', () => {
    const saved = JSON.parse(serializeMasteringState(m.setMode(defaultMasteringState(), 'studio')));
    saved.inserts[MASTERING_SLOT.compressor].params.ratio = 'hard';
    saved.inserts[MASTERING_SLOT.limiter].bypassed = 'no';
    saved.eq[2].gainDb = null;
    saved.quick.preset = 'polka';
    saved.monitor.lane = 'side';
    saved.repair.denoise.params.reductionDb = 'lots';
    const { state, notices } = deserializeMasteringState(JSON.stringify(saved));
    const defaults = defaultMasteringState();
    expect(state.mode).toBe('studio');
    expect(state.inserts[MASTERING_SLOT.compressor].params.ratio).toBe(
      defaults.inserts[MASTERING_SLOT.compressor].params.ratio,
    );
    expect(state.inserts[MASTERING_SLOT.limiter].bypassed).toBe(false);
    expect(state.eq[2].gainDb).toBe(0);
    expect(state.quick.preset).toBe('pop');
    expect(state.monitor.lane).toBe('after');
    expect(state.repair.denoise.params).toEqual({});
    expect(notices.sort()).toEqual(
      [
        'eq.2.gainDb',
        'inserts.12.bypassed',
        'inserts.4.params.ratio',
        'monitor.lane',
        'quick.preset',
        'repair.denoise.params.reductionDb',
      ].sort(),
    );
  });

  it('falls back to a fresh project for unreadable input or an unknown version', () => {
    expect(deserializeMasteringState('{not json')).toEqual({
      state: defaultMasteringState(),
      notices: ['json'],
    });
    expect(deserializeMasteringState('{"version":9}')).toEqual({
      state: defaultMasteringState(),
      notices: ['version'],
    });
  });
});

describe('the earlier saved chain preset', () => {
  const legacy = {
    mode: 'studio',
    selectedPreset: 'hiphop',
    selectedVenue: 'livehouseSmall',
    selectedPlatform: 'apple',
    customLufs: -12,
    tone: 50,
    width: 50,
    dynamics: 50,
    showFineTune: true,
    activeModule: 'dynamics',
    loudnessMatched: false,
    moduleSettings: {
      inputGainDb: -3,
      denoiseAmount: 0,
      declickAmount: 0.5,
      dereverbAmount: 0,
      tiltDb: 1,
      compressorThresholdDb: -22,
      compressorRatio: 3,
      compressorAttackMs: 10,
      compressorReleaseMs: 200,
      deesserAmount: 0.5,
      transientAttackDb: 0,
      multibandLowAmount: 0.5,
      multibandMidAmount: 0,
      multibandHighAmount: 0,
      tapeDriveDb: 0,
      tapeSaturation: 0,
      exciterAmount: 0,
      airBandAmount: 0.22,
      stereoWidth: 1.05,
      monoMakerAmount: 0,
      limiterCeilingDb: -2,
      limiterLookaheadMs: 3,
    },
  };

  it('converts the 22 module settings onto the insert layout', () => {
    const { state, notices } = convertLegacyMasteringPreset(legacy);
    expect(notices).toEqual([]);
    const p = (slot: keyof typeof MASTERING_SLOT) => state.inserts[MASTERING_SLOT[slot]];
    expect(state.mode).toBe('studio');
    expect(state.quick).toMatchObject({
      preset: 'hiphop',
      venue: 'livehouseSmall',
      platform: 'apple',
      customLufs: -12,
    });
    expect(state.monitor.matchLoudness).toBe(false);
    expect(p('input').params.levelDb).toBe(-3);
    // hiphop -0.5 and the small room +0.4 on top of the saved 1 dB tilt, room pivot.
    expect(p('tone').params).toMatchObject({ pivotHz: 600 });
    expect(p('tone').params.tiltDb).toBeCloseTo(0.9, 9);
    // threshold -22 - 0.5·4; hiphop ratio 2.6 + 0.5; attack floored by the room.
    expect(p('compressor').params).toMatchObject({
      thresholdDb: -24,
      ratio: 3.1,
      attackMs: 20,
      releaseMs: 200,
    });
    expect(p('deesser').bypassed).toBe(false);
    expect(p('deesser').params).toMatchObject({ thresholdDb: -21, ratio: 4 });
    expect(p('multiband').bypassed).toBe(false);
    expect(p('multiband').params).toMatchObject({
      'band0.thresholdDb': -18,
      'band0.ratio': 2.4,
      cutoff0Hz: 220,
    });
    expect(p('limiter').params).toMatchObject({ ceilingDb: -2, lookaheadMs: 3 });
    expect(p('monoBass').bypassed).toBe(false);
    expect(state.repair.declick).toEqual({
      enabled: true,
      params: { threshold: 0.3, neighborRatio: 4, maxClickSamples: 96 },
    });
    expect(state.repair.dereverb.params.attenuation).toBe(0.25);
    expect(state.quick.macros).toMatchObject({ tone: 0, dynamics: 0, ceiling: -2 });
  });

  it('a neutral earlier preset converts to the same state as picking the preset now', () => {
    for (const preset of ['pop', 'speech', 'liveLarge'] as const) {
      const { state } = convertLegacyMasteringPreset({
        selectedPreset: preset,
        selectedPlatform: 'youtube',
      });
      const now = m.selectPreset(defaultMasteringState(), preset);
      expect(state.inserts).toEqual(now.inserts);
      expect(state.repair).toEqual(now.repair);
    }
  });

  it('reads the exported-file wrapper and the stored JSON alike', () => {
    const fromFile = convertLegacyMasteringPreset({
      exportedAt: '2026-01-01T00:00:00Z',
      settings: legacy,
    });
    expect(fromFile).toEqual(convertLegacyMasteringPreset(legacy));
    expect(deserializeMasteringState(JSON.stringify(legacy))).toEqual(
      convertLegacyMasteringPreset(legacy),
    );
  });

  it('replaces an unusable value with its default and lists it', () => {
    const broken = {
      ...legacy,
      selectedPreset: 'polka',
      tone: 'warm',
      moduleSettings: { ...legacy.moduleSettings, compressorRatio: 'heavy', limiterCeilingDb: -9 },
    };
    const { state, notices } = convertLegacyMasteringPreset(broken);
    expect(notices.sort()).toEqual(
      ['moduleSettings.compressorRatio', 'selectedPreset', 'tone'].sort(),
    );
    expect(state.quick.preset).toBe('pop');
    // Out of range is clamped as the earlier page did on load, not reported.
    expect(state.inserts[MASTERING_SLOT.limiter].params.ceilingDb).toBe(-3);
  });

  it('turns an unreadable payload into a fresh project', () => {
    expect(convertLegacyMasteringPreset('nonsense')).toEqual({
      state: defaultMasteringState(),
      notices: ['settings'],
    });
  });
});
