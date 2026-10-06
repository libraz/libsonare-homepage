/**
 * The chain-config → state map: every Quick preset lands entirely on the
 * insert layout with the earlier chain builder's values, the assistant's flat
 * suggestion maps with only the loudness-stage extras left over, and the
 * match-EQ fit recovers the curve it is given.
 */
import { describe, expect, it } from 'vitest';
import {
  CHAIN_STAGE_SLOTS,
  chainParamTargets,
  fitMatchEqPeaks,
  MATCH_EQ_MAX_GAIN_DB,
  peakingResponseDb,
  presetChainParams,
} from '@/demos/mastering/masteringPresetMap';
import {
  defaultMasteringState,
  MASTERING_INSERT_LAYOUT,
  MASTERING_SLOT,
  type MasteringState,
  masteringMutators as m,
  unmappedChainParams,
} from '@/demos/mastering/masteringState';
import { MASTERING_PRESETS, MASTERING_VENUES } from '@/demos/mastering/masteringUi';
import type { MasteringPresetId, MasteringVenueId } from '@/demos/mastering/useMastering';

const STAGE_PROCESSOR: Record<string, string> = {
  'eq.tilt': 'eq.tilt',
  'dynamics.deesser': 'dynamics.deesser',
  'dynamics.transientShaper': 'dynamics.transientShaper',
  'dynamics.compressor': 'dynamics.compressor',
  'dynamics.multibandComp': 'multiband.compressor',
  'saturation.tape': 'saturation.tape',
  'saturation.exciter': 'saturation.exciter',
  'spectral.airBand': 'spectral.airBand',
  'stereo.imager': 'stereo.imager',
  'stereo.monoMaker': 'stereo.monoMaker',
  'maximizer.truePeakLimiter': 'maximizer.truePeakLimiter',
};

const param = (state: MasteringState, slot: keyof typeof MASTERING_SLOT, name: string) =>
  state.inserts[MASTERING_SLOT[slot]].params[name];
const bypassed = (state: MasteringState, slot: keyof typeof MASTERING_SLOT) =>
  state.inserts[MASTERING_SLOT[slot]].bypassed;

it('each chain stage maps onto the slot running that processor', () => {
  expect(Object.keys(CHAIN_STAGE_SLOTS).sort()).toEqual(Object.keys(STAGE_PROCESSOR).sort());
  for (const [stage, slot] of Object.entries(CHAIN_STAGE_SLOTS)) {
    expect(MASTERING_INSERT_LAYOUT[slot].processor, stage).toBe(STAGE_PROCESSOR[stage]);
  }
});

// The earlier chain builder at neutral fine-tune, by genre (studio venue).
const GENRE: Record<
  MasteringPresetId,
  {
    tilt: [number, number];
    comp: [number, number, number, number, number];
    air: [number, number];
    width: number;
    decorrelation: number;
    release: number;
    denoise: boolean;
  }
> = {
  pop: {
    tilt: [0, 1000],
    comp: [-20, 2.6, 18, 160, 4],
    air: [0.28, 12000],
    width: 1.15,
    decorrelation: 0.04,
    release: 120,
    denoise: false,
  },
  edm: {
    tilt: [0, 1000],
    comp: [-20, 2.6, 18, 120, 4],
    air: [0.28, 12000],
    width: 1.15,
    decorrelation: 0.04,
    release: 80,
    denoise: false,
  },
  acoustic: {
    tilt: [0, 1000],
    comp: [-16, 1.5, 24, 220, 6],
    air: [0.28, 12000],
    width: 1.15,
    decorrelation: 0.04,
    release: 120,
    denoise: false,
  },
  liveSmall: {
    tilt: [0.2, 900],
    comp: [-20, 2.1, 18, 180, 6],
    air: [0.28, 12000],
    width: 1.15,
    decorrelation: 0.04,
    release: 120,
    denoise: false,
  },
  liveLarge: {
    tilt: [0.1, 700],
    comp: [-20, 1.9, 24, 240, 6],
    air: [0.28, 12000],
    width: 1.2,
    decorrelation: 0.04,
    release: 120,
    denoise: false,
  },
  hiphop: {
    tilt: [-0.5, 850],
    comp: [-20, 3.1, 18, 160, 4],
    air: [0.28, 12000],
    width: 1.15,
    decorrelation: 0.04,
    release: 120,
    denoise: false,
  },
  aiMusic: {
    tilt: [0, 1000],
    comp: [-20, 2.6, 18, 160, 4],
    air: [0.55, 15500],
    width: 1.15,
    decorrelation: 0.04,
    release: 120,
    denoise: true,
  },
  speech: {
    tilt: [0, 1000],
    comp: [-20, 2.6, 8, 160, 4],
    air: [0.28, 12000],
    width: 0.95,
    decorrelation: 0,
    release: 120,
    denoise: true,
  },
};

// The venue layer on top: tilt delta, pivot, compressor floors, mono fold, dereverb.
const VENUE: Record<
  MasteringVenueId,
  {
    tiltDelta: number;
    pivot?: number;
    attack: number;
    release: number;
    mono: number;
    dereverb: number;
  }
> = {
  studio: { tiltDelta: 0, attack: 0, release: 0, mono: 0, dereverb: 0 },
  livehouseSmall: {
    tiltDelta: 0.4,
    pivot: 600,
    attack: 20,
    release: 160,
    mono: 0.25,
    dereverb: 0.25,
  },
  livehouseLarge: {
    tiltDelta: 0.2,
    pivot: 500,
    attack: 24,
    release: 220,
    mono: 0.45,
    dereverb: 0.45,
  },
};

const PRESET_CASES = MASTERING_PRESETS.flatMap(({ id: preset }) =>
  MASTERING_VENUES.map(({ id: venue }) => [preset, venue] as const),
);

describe('Quick presets', () => {
  it.each(PRESET_CASES)('%s in %s maps without leftovers', (preset, venue) => {
    expect(unmappedChainParams(presetChainParams(preset, venue))).toEqual([]);
  });

  it.each(PRESET_CASES)('%s in %s carries the earlier chain values', (preset, venue) => {
    const g = GENRE[preset];
    const v = VENUE[venue];
    const state = m.selectVenue(m.selectPreset(defaultMasteringState(), preset), venue);
    expect(param(state, 'tone', 'tiltDb')).toBeCloseTo(g.tilt[0] + v.tiltDelta, 9);
    expect(param(state, 'tone', 'pivotHz')).toBe(v.pivot ?? g.tilt[1]);
    expect(param(state, 'compressor', 'thresholdDb')).toBeCloseTo(g.comp[0], 9);
    expect(param(state, 'compressor', 'ratio')).toBeCloseTo(g.comp[1], 9);
    expect(param(state, 'compressor', 'attackMs')).toBe(Math.max(g.comp[2], v.attack));
    expect(param(state, 'compressor', 'releaseMs')).toBe(Math.max(g.comp[3], v.release));
    expect(param(state, 'compressor', 'kneeDb')).toBe(g.comp[4]);
    expect(param(state, 'compressor', 'autoMakeup')).toBe(true);
    expect(param(state, 'air', 'amount')).toBeCloseTo(g.air[0], 9);
    expect(param(state, 'air', 'shelfFrequencyHz')).toBe(g.air[1]);
    expect(param(state, 'stereo', 'width')).toBeCloseTo(g.width, 9);
    expect(param(state, 'stereo', 'decorrelationAmount')).toBeCloseTo(g.decorrelation, 9);
    expect(param(state, 'limiter', 'ceilingDb')).toBe(-1);
    expect(param(state, 'limiter', 'lookaheadMs')).toBe(5);
    expect(param(state, 'limiter', 'releaseMs')).toBe(g.release);
    expect(bypassed(state, 'monoBass')).toBe(v.mono === 0);
    if (v.mono > 0) expect(param(state, 'monoBass', 'amount')).toBe(v.mono);
    for (const slot of [
      'tone',
      'compressor',
      'air',
      'stereo',
      'drive',
      'limiter',
      'input',
    ] as const) {
      expect(bypassed(state, slot), slot).toBe(false);
    }
    for (const slot of ['deesser', 'transient', 'multiband', 'tape', 'exciter'] as const) {
      expect(bypassed(state, slot), slot).toBe(true);
    }
    expect(state.repair.denoise.enabled).toBe(g.denoise);
    if (g.denoise) {
      expect(state.repair.denoise.params.ddAlpha).toBe(preset === 'speech' ? 0.96 : 0.98);
      expect(state.repair.denoise.params.reductionDb).toBeCloseTo(-20 * Math.log10(0.16), 9);
    }
    expect(state.repair.dereverb.enabled).toBe(v.dereverb > 0);
    if (v.dereverb > 0) expect(state.repair.dereverb.params.attenuation).toBe(v.dereverb);
    expect(state.inserts[MASTERING_SLOT.drive].params.levelDb).toBe(0);
    expect(state.quick.macros).toMatchObject({ tone: 0, dynamics: 0, ceiling: -1 });
    expect(state.quick.macros.width).toBeCloseTo(g.width, 9);
  });
});

// A suggestion in the shape `masteringAssistantSuggestChainStereo` returns, with
// one representative of each kind of key the map handles, multiband and dehum included.
const ASSISTANT = {
  'dynamics.compressor.attackMs': 5,
  'dynamics.compressor.autoMakeup': false,
  'dynamics.compressor.detector': 1,
  'dynamics.compressor.enabled': true,
  'dynamics.compressor.ratio': 2.5,
  'dynamics.compressor.releaseMs': 50,
  'dynamics.compressor.thresholdDb': -18,
  'dynamics.deesser.enabled': false,
  'dynamics.deesser.frequencyHz': 6000,
  'dynamics.multibandComp.enabled': true,
  'dynamics.multibandComp.highCutoffHz': 2000,
  'dynamics.multibandComp.lowCutoffHz': 120,
  'dynamics.multibandComp.midRatio': 3,
  'dynamics.multibandComp.lowThresholdDb': -24,
  'eq.tilt.enabled': true,
  'eq.tilt.tiltDb': 0.5,
  'loudness.applyGainAtInputRate': false,
  'loudness.ceilingDb': -1.5,
  'loudness.enabled': true,
  'loudness.maxLimiterGainReductionDb': 12,
  'loudness.releaseMs': 50,
  'loudness.targetLufs': -12,
  'loudness.truePeakOversample': 4,
  'maximizer.truePeakLimiter.ceilingDb': -1,
  'maximizer.truePeakLimiter.enabled': false,
  'maximizer.truePeakLimiter.lookaheadMs': 1,
  'repair.dehum.enabled': true,
  'repair.dehum.fundamentalHz': 50,
  'repair.declip.enabled': false,
  'repair.declip.clipThreshold': 0.98,
  'saturation.exciter.enabled': true,
  'saturation.exciter.amount': 0.15,
  'spectral.airBand.enabled': false,
  'stereo.imager.enabled': true,
  'stereo.imager.width': 1.1,
};

describe('assistant suggestion', () => {
  const before = m.setInsertBypassed(defaultMasteringState(), MASTERING_SLOT.limiter, true);
  const after = m.applyAssistant(before, ASSISTANT);

  it('lands each stage on its slot', () => {
    expect(param(after, 'compressor', 'attackMs')).toBe(5);
    expect(param(after, 'compressor', 'autoMakeup')).toBe(false);
    expect(param(after, 'compressor', 'ratio')).toBe(2.5);
    expect(param(after, 'tone', 'tiltDb')).toBe(0.5);
    expect(param(after, 'exciter', 'amount')).toBe(0.15);
    expect(param(after, 'stereo', 'width')).toBe(1.1);
    expect(bypassed(after, 'exciter')).toBe(false);
    expect(bypassed(after, 'deesser')).toBe(true);
    expect(bypassed(after, 'air')).toBe(true);
    expect(after.repair.dehum).toEqual({ enabled: true, params: { fundamentalHz: 50 } });
    expect(after.repair.declip.enabled).toBe(false);
  });

  it('renames the multiband keys onto band0–2 and the crossovers', () => {
    expect(param(after, 'multiband', 'cutoff0Hz')).toBe(120);
    expect(param(after, 'multiband', 'cutoff1Hz')).toBe(2000);
    expect(param(after, 'multiband', 'band1.ratio')).toBe(3);
    expect(param(after, 'multiband', 'band0.thresholdDb')).toBe(-24);
    expect(bypassed(after, 'multiband')).toBe(false);
  });

  it('runs the limiter for the loudness stage, at the lower of the two ceilings', () => {
    expect(bypassed(after, 'limiter')).toBe(false);
    expect(param(after, 'limiter', 'ceilingDb')).toBe(-1.5);
    expect(param(after, 'limiter', 'lookaheadMs')).toBe(1);
  });

  it('takes the loudness target as a custom target', () => {
    expect(after.quick.platform).toBe('custom');
    expect(after.quick.customLufs).toBe(-12);
  });

  it('lists only the loudness-stage extras as not applied', () => {
    expect(unmappedChainParams(ASSISTANT).sort()).toEqual([
      'loudness.applyGainAtInputRate',
      'loudness.maxLimiterGainReductionDb',
      'loudness.releaseMs',
      'loudness.truePeakOversample',
    ]);
  });

  it('lists keys of an unknown stage or parameter, but not of a stage it switches off', () => {
    expect(
      unmappedChainParams({
        'dynamics.gate.enabled': true,
        'dynamics.compressor.noSuchParam': 1,
        'dynamics.compressor.ratio': true,
        'saturation.tape.enabled': false,
        'saturation.tape.noSuchParam': 1,
      }).sort(),
    ).toEqual([
      'dynamics.compressor.noSuchParam',
      'dynamics.compressor.ratio',
      'dynamics.gate.enabled',
    ]);
  });
});

describe('tape bias', () => {
  it('is applied from a chain config', () => {
    expect(
      unmappedChainParams({ 'saturation.tape.enabled': true, 'saturation.tape.bias': 0.5 }),
    ).toEqual([]);
    expect(chainParamTargets({ 'saturation.tape.bias': 0.5 })).toContainEqual({
      kind: 'insertParam',
      key: 'saturation.tape.bias',
      slot: 6,
      param: 'bias',
      value: 0.5,
    });
  });
});

describe('match EQ fit', () => {
  const SR = 48_000;
  const grid = Array.from({ length: 767 }, (_, i) => 46.875 + i * 23.4375);
  const curveOf = (peaks: { frequencyHz: number; gainDb: number; q: number }[]) => ({
    frequencies: grid,
    gainDb: grid.map((f) => peaks.reduce((sum, p) => sum + peakingResponseDb(f, p, SR), 0)),
  });

  it('recovers the peaks a curve is made of', () => {
    const truth = [
      { frequencyHz: 250, gainDb: 4, q: 1.2 },
      { frequencyHz: 3000, gainDb: -3, q: 1.5 },
    ];
    const fit = fitMatchEqPeaks(curveOf(truth), SR);
    expect(fit.bands).toHaveLength(4);
    expect(fit.bands.map((b) => b.frequencyHz)).toEqual(
      [...fit.bands.map((b) => b.frequencyHz)].sort((a, b) => a - b),
    );
    for (const peak of truth) {
      const nearest = fit.bands.reduce((best, b) =>
        Math.abs(Math.log2(b.frequencyHz / peak.frequencyHz)) <
        Math.abs(Math.log2(best.frequencyHz / peak.frequencyHz))
          ? b
          : best,
      );
      expect(Math.abs(Math.log2(nearest.frequencyHz / peak.frequencyHz))).toBeLessThan(1 / 6);
      expect(nearest.gainDb).toBeCloseTo(peak.gainDb, 0);
    }
    // P2 holds: the residual is well under half of the deviation.
    expect(fit.residualRatio).toBeLessThan(0.5);
  });

  it('clips each band to ±6 dB', () => {
    const fit = fitMatchEqPeaks(curveOf([{ frequencyHz: 1000, gainDb: 12, q: 1 }]), SR);
    for (const band of fit.bands)
      expect(Math.abs(band.gainDb)).toBeLessThanOrEqual(MATCH_EQ_MAX_GAIN_DB);
    expect(Math.max(...fit.bands.map((b) => b.gainDb))).toBe(MATCH_EQ_MAX_GAIN_DB);
  });

  it('writes the four Peak bands of the strip EQ', () => {
    const fit = fitMatchEqPeaks(curveOf([{ frequencyHz: 500, gainDb: 2, q: 1 }]), SR);
    const state = m.applyMatchEq(defaultMasteringState(), fit, 'ref-1');
    expect(state.eq.slice(2, 6).map((b) => b.type)).toEqual(['Peak', 'Peak', 'Peak', 'Peak']);
    expect(state.eq.slice(2, 6).every((b) => b.enabled)).toBe(true);
    expect(state.eq.slice(2, 6).map((b) => b.frequencyHz)).toEqual(
      fit.bands.map((b) => b.frequencyHz),
    );
    expect(state.matchEq).toEqual({ referenceId: 'ref-1', residualRatio: fit.residualRatio });
    expect(m.clearMatchEq(state).eq).toEqual(defaultMasteringState().eq);
  });
});
