/**
 * Maps chain-config values onto the /mastering project state. Three things
 * arrive in chain-config form — the Quick genre × venue presets, the
 * assistant's suggestion (`masteringAssistantSuggestChainStereo`) and presets
 * saved by the earlier page — and all three go through one table:
 *
 * | chain key                                           | state                                 |
 * |-----------------------------------------------------|---------------------------------------|
 * | `repair.<stage>.*`                                  | repair preprocess                     |
 * | `eq.tilt.*`                                         | slot 1                                |
 * | `dynamics.{deesser,transientShaper,compressor}.*`   | slots 2 / 3 / 4                       |
 * | `dynamics.multibandComp.*`                          | slot 5 band0–2 and the two crossovers |
 * | `saturation.{tape,exciter}.*`, `spectral.airBand.*` | slots 6 / 7 / 8                       |
 * | `stereo.{imager,monoMaker}.*`                       | slots 9 / 10                          |
 * | `maximizer.truePeakLimiter.*`, `loudness.ceilingDb` | slot 12 (the lower ceiling wins)      |
 * | `loudness.targetLufs`                               | loudness-fit target                   |
 *
 * Slot numbers are the lane-1 insert layout in `masteringState.ts`. The Quick
 * presets are the earlier chain builder's values at neutral fine-tune.
 */
import type { MasteringRepairStage } from '@/demos/mastering/masteringState';
import type { MasteringPresetId, MasteringVenueId } from '@/demos/mastering/useMastering';

type ChainParams = Record<string, number | boolean>;

/** Where one chain-config key lands in the state. */
export type ChainParamTarget =
  | { kind: 'insertParam'; key: string; slot: number; param: string; value: number | boolean }
  | { kind: 'insertBypass'; key: string; slot: number; bypassed: boolean }
  | { kind: 'repairEnabled'; key: string; stage: MasteringRepairStage; enabled: boolean }
  | {
      kind: 'repairParam';
      key: string;
      stage: MasteringRepairStage;
      param: string;
      value: number | boolean;
    }
  | { kind: 'targetLufs'; key: string; value: number }
  | { kind: 'unmapped'; key: string };

/** Chain stage → lane-1 insert slot. */
export const CHAIN_STAGE_SLOTS: Readonly<Record<string, number>> = {
  'eq.tilt': 1,
  'dynamics.deesser': 2,
  'dynamics.transientShaper': 3,
  'dynamics.compressor': 4,
  'dynamics.multibandComp': 5,
  'saturation.tape': 6,
  'saturation.exciter': 7,
  'spectral.airBand': 8,
  'stereo.imager': 9,
  'stereo.monoMaker': 10,
  'maximizer.truePeakLimiter': 12,
};

const LIMITER = 'maximizer.truePeakLimiter';
const LIMITER_SLOT = CHAIN_STAGE_SLOTS[LIMITER];
const REPAIR_STAGES: readonly MasteringRepairStage[] = [
  'declip',
  'declick',
  'decrackle',
  'dehum',
  'denoise',
  'dereverb',
];

const MULTIBAND_BANDS: Readonly<Record<string, number>> = { low: 0, mid: 1, high: 2 };
const MULTIBAND_CROSSOVERS: Readonly<Record<string, string>> = {
  lowCutoffHz: 'cutoff0Hz',
  highCutoffHz: 'cutoff1Hz',
};

/** `dynamics.multibandComp` leaf → `multiband.compressor` parameter. */
function multibandParam(leaf: string): string | undefined {
  if (MULTIBAND_CROSSOVERS[leaf]) return MULTIBAND_CROSSOVERS[leaf];
  const match = leaf.match(/^(low|mid|high)([A-Z]\w*)$/);
  if (!match) return undefined;
  const field = match[2][0].toLowerCase() + match[2].slice(1);
  return `band${MULTIBAND_BANDS[match[1]]}.${field}`;
}

function splitKey(key: string): { stage: string; leaf: string } {
  const dot = key.lastIndexOf('.');
  return { stage: key.slice(0, dot), leaf: key.slice(dot + 1) };
}

const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/**
 * Resolves every key of a flat chain-config map. The two ceilings and the two
 * enable flags of the limiter and the loudness stage fold into one target
 * each, since one limiter slot carries both.
 */
export function chainParamTargets(flat: Readonly<ChainParams>): ChainParamTarget[] {
  const targets: ChainParamTarget[] = [];
  const ceilings: number[] = [];
  let limiterOn: boolean | undefined;
  for (const [key, value] of Object.entries(flat)) {
    const { stage, leaf } = splitKey(key);
    if (stage === 'loudness' || stage === LIMITER) {
      if (leaf === 'enabled' && typeof value === 'boolean') {
        limiterOn = (limiterOn ?? false) || value;
        continue;
      }
      if (leaf === 'ceilingDb' && finite(value)) {
        ceilings.push(value);
        continue;
      }
      if (stage === 'loudness') {
        if (leaf === 'targetLufs' && finite(value))
          targets.push({ kind: 'targetLufs', key, value });
        else targets.push({ kind: 'unmapped', key });
        continue;
      }
    }
    const repairStage = REPAIR_STAGES.find((name) => stage === `repair.${name}`);
    if (repairStage) {
      if (leaf === 'enabled' && typeof value === 'boolean') {
        targets.push({ kind: 'repairEnabled', key, stage: repairStage, enabled: value });
      } else if (typeof value === 'boolean' || finite(value)) {
        targets.push({ kind: 'repairParam', key, stage: repairStage, param: leaf, value });
      } else {
        targets.push({ kind: 'unmapped', key });
      }
      continue;
    }
    const slot = CHAIN_STAGE_SLOTS[stage];
    if (slot === undefined) {
      targets.push({ kind: 'unmapped', key });
      continue;
    }
    if (leaf === 'enabled' && typeof value === 'boolean') {
      targets.push({ kind: 'insertBypass', key, slot, bypassed: !value });
      continue;
    }
    const param = stage === 'dynamics.multibandComp' ? multibandParam(leaf) : leaf;
    // Tape bias stays at 0: engine 1.8.1 bounces a non-zero bias differently from live playback.
    const heldAtDefault = stage === 'saturation.tape' && leaf === 'bias';
    if (heldAtDefault || param === undefined || !(typeof value === 'boolean' || finite(value))) {
      targets.push({ kind: 'unmapped', key });
    } else {
      targets.push({ kind: 'insertParam', key, slot, param, value });
    }
  }
  if (ceilings.length > 0) {
    targets.push({
      kind: 'insertParam',
      key: `${LIMITER}.ceilingDb`,
      slot: LIMITER_SLOT,
      param: 'ceilingDb',
      value: Math.min(...ceilings),
    });
  }
  if (limiterOn !== undefined) {
    targets.push({
      kind: 'insertBypass',
      key: `${LIMITER}.enabled`,
      slot: LIMITER_SLOT,
      bypassed: !limiterOn,
    });
  }
  return targets;
}

/** True when `key`'s stage is switched off in `flat`, so its values do not matter. */
export function chainStageDisabled(flat: Readonly<ChainParams>, key: string): boolean {
  return flat[`${splitKey(key).stage}.enabled`] === false;
}

// ---------------------------------------------------------------------------
// The earlier chain builder, kept as the source of the Quick presets and of
// the conversion of presets the earlier page saved.

/** The earlier page's per-module settings (its saved-preset `moduleSettings`). */
export interface LegacyModuleSettings {
  inputGainDb: number;
  denoiseAmount: number;
  declickAmount: number;
  dereverbAmount: number;
  tiltDb: number;
  compressorThresholdDb: number;
  compressorRatio: number;
  compressorAttackMs: number;
  compressorReleaseMs: number;
  deesserAmount: number;
  transientAttackDb: number;
  multibandLowAmount: number;
  multibandMidAmount: number;
  multibandHighAmount: number;
  tapeDriveDb: number;
  tapeSaturation: number;
  exciterAmount: number;
  airBandAmount: number;
  stereoWidth: number;
  monoMakerAmount: number;
  limiterCeilingDb: number;
  limiterLookaheadMs: number;
}

export const LEGACY_MODULE_DEFAULTS: Readonly<LegacyModuleSettings> = {
  inputGainDb: 0,
  denoiseAmount: 0,
  declickAmount: 0,
  dereverbAmount: 0,
  tiltDb: 0,
  compressorThresholdDb: -18,
  compressorRatio: 2.2,
  compressorAttackMs: 18,
  compressorReleaseMs: 160,
  deesserAmount: 0,
  transientAttackDb: 0,
  multibandLowAmount: 0,
  multibandMidAmount: 0,
  multibandHighAmount: 0,
  tapeDriveDb: 0,
  tapeSaturation: 0,
  exciterAmount: 0,
  airBandAmount: 0.22,
  stereoWidth: 1.05,
  monoMakerAmount: 0,
  limiterCeilingDb: -1,
  limiterLookaheadMs: 5,
};

/** Control ranges the earlier page clamped a saved value into. */
export const LEGACY_MODULE_RANGES: Readonly<
  Record<keyof LegacyModuleSettings, { min: number; max: number }>
> = {
  inputGainDb: { min: -12, max: 12 },
  denoiseAmount: { min: 0, max: 1 },
  declickAmount: { min: 0, max: 1 },
  dereverbAmount: { min: 0, max: 1 },
  tiltDb: { min: -6, max: 6 },
  compressorThresholdDb: { min: -36, max: -6 },
  compressorRatio: { min: 1, max: 6 },
  compressorAttackMs: { min: 1, max: 80 },
  compressorReleaseMs: { min: 40, max: 500 },
  deesserAmount: { min: 0, max: 1 },
  transientAttackDb: { min: -6, max: 6 },
  multibandLowAmount: { min: 0, max: 1 },
  multibandMidAmount: { min: 0, max: 1 },
  multibandHighAmount: { min: 0, max: 1 },
  tapeDriveDb: { min: 0, max: 8 },
  tapeSaturation: { min: 0, max: 1 },
  exciterAmount: { min: 0, max: 0.8 },
  airBandAmount: { min: 0, max: 1 },
  stereoWidth: { min: 0.6, max: 1.6 },
  monoMakerAmount: { min: 0, max: 1 },
  limiterCeilingDb: { min: -3, max: -0.1 },
  limiterLookaheadMs: { min: 1, max: 20 },
};

export interface LegacyChainOptions {
  preset: MasteringPresetId;
  venue: MasteringVenueId;
  /** The earlier 0..100 Tone / Width / Dynamics sliders; 50 is neutral. */
  tuning: { tone: number; width: number; dynamics: number };
  moduleSettings: Readonly<LegacyModuleSettings>;
}

/**
 * The earlier chain builder's output as flat chain keys, every stage listed
 * with its `enabled` flag. Input gain and the loudness target are not chain
 * stages and are not included.
 */
export function legacyChainParams(options: LegacyChainOptions): ChainParams {
  const { preset, venue, tuning, moduleSettings: s } = options;
  const warm = tuning.tone / 100;
  const wide = tuning.width / 100;
  const compressed = (100 - tuning.dynamics) / 100;
  const isLivehouse = venue === 'livehouseSmall' || venue === 'livehouseLarge';
  const out: ChainParams = {};
  const stage = (name: string, enabled: boolean, params: ChainParams = {}) => {
    out[`${name}.enabled`] = enabled;
    if (!enabled) return;
    for (const [key, value] of Object.entries(params)) out[`${name}.${key}`] = value;
  };

  let tiltDb = s.tiltDb + (warm - 0.5) * -2.5;
  let pivotHz = 1000;
  const comp = {
    thresholdDb: s.compressorThresholdDb - compressed * 4,
    ratio: s.compressorRatio + compressed * 0.8,
    attackMs: preset === 'speech' ? Math.min(s.compressorAttackMs, 8) : s.compressorAttackMs,
    releaseMs: preset === 'edm' ? Math.min(s.compressorReleaseMs, 120) : s.compressorReleaseMs,
    kneeDb: 4,
    autoMakeup: true,
  };
  let width = preset === 'speech' ? Math.min(s.stereoWidth, 0.95) : s.stereoWidth + wide * 0.2;
  let monoAmount = s.monoMakerAmount;

  if (preset === 'acoustic') {
    comp.thresholdDb = -16;
    comp.ratio = 1.5;
    comp.attackMs = Math.max(24, s.compressorAttackMs);
    comp.releaseMs = Math.max(220, s.compressorReleaseMs);
    comp.kneeDb = 6;
  }
  if (preset === 'hiphop') {
    tiltDb -= 0.5;
    pivotHz = 850;
    comp.ratio = 2.6 + compressed;
  }
  if (preset === 'liveSmall') {
    tiltDb += 0.2;
    pivotHz = 900;
    comp.ratio = 1.8 + compressed * 0.6;
    comp.attackMs = Math.max(18, s.compressorAttackMs);
    comp.releaseMs = Math.max(180, s.compressorReleaseMs);
    comp.kneeDb = 6;
  }
  if (preset === 'liveLarge') {
    tiltDb += 0.1;
    pivotHz = 700;
    comp.ratio = 1.6 + compressed * 0.6;
    comp.attackMs = Math.max(24, s.compressorAttackMs);
    comp.releaseMs = Math.max(240, s.compressorReleaseMs);
    comp.kneeDb = 6;
    width += 0.05;
  }
  // The venue is a room-repair layer on top of the genre: re-centred pivot,
  // a de-boxing tilt, a slower compressor floor and a bass mono fold.
  if (isLivehouse) {
    const room =
      venue === 'livehouseSmall'
        ? { pivotHz: 600, tiltDelta: 0.4, monoFloor: 0.25, attackFloor: 20, releaseFloor: 160 }
        : { pivotHz: 500, tiltDelta: 0.2, monoFloor: 0.45, attackFloor: 24, releaseFloor: 220 };
    tiltDb += room.tiltDelta;
    pivotHz = room.pivotHz;
    comp.attackMs = Math.max(comp.attackMs, room.attackFloor);
    comp.releaseMs = Math.max(comp.releaseMs, room.releaseFloor);
    monoAmount = Math.max(monoAmount, room.monoFloor);
  }

  const repairActive =
    preset === 'aiMusic' ||
    preset === 'speech' ||
    isLivehouse ||
    s.denoiseAmount > 0 ||
    s.declickAmount > 0 ||
    s.dereverbAmount > 0;
  stage(
    'repair.denoise',
    repairActive && (s.denoiseAmount > 0 || preset === 'aiMusic' || preset === 'speech'),
    {
      nFft: 2048,
      hopLength: 512,
      ddAlpha: preset === 'speech' ? 0.96 : 0.98,
      reductionDb: -20 * Math.log10(Math.max(0.04, 0.16 - s.denoiseAmount * 0.12)),
    },
  );
  stage('repair.declick', repairActive && s.declickAmount > 0, {
    threshold: Math.max(0.08, 0.5 - s.declickAmount * 0.4),
    neighborRatio: 4,
    maxClickSamples: 96,
  });
  const roomDereverb = venue === 'livehouseSmall' ? 0.25 : venue === 'livehouseLarge' ? 0.45 : 0;
  stage('repair.dereverb', repairActive && (s.dereverbAmount > 0 || roomDereverb > 0), {
    threshold: 0.08,
    attenuation: s.dereverbAmount > 0 ? s.dereverbAmount : roomDereverb,
    nFft: 2048,
    hopLength: 512,
    overSubtraction: 1.2,
  });

  stage('eq.tilt', true, { tiltDb, pivotHz });
  stage('dynamics.deesser', s.deesserAmount > 0, {
    frequencyHz: 6500,
    thresholdDb: -30 + (1 - s.deesserAmount) * 18,
    ratio: 2 + s.deesserAmount * 4,
    attackMs: 1.5,
    releaseMs: 60,
    rangeDb: 12,
  });
  stage('dynamics.transientShaper', s.transientAttackDb !== 0, {
    attackGainDb: s.transientAttackDb,
    sustainGainDb: 0,
    fastAttackMs: 1.5,
    fastReleaseMs: 18,
    slowAttackMs: 25,
    slowReleaseMs: 220,
    sensitivity: 0.6,
    maxGainDb: 8,
    gainSmoothingMs: 6,
    lookaheadMs: 1.5,
  });
  stage('dynamics.compressor', true, comp);
  const mb = { low: s.multibandLowAmount, mid: s.multibandMidAmount, high: s.multibandHighAmount };
  stage('dynamics.multibandComp', mb.low > 0 || mb.mid > 0 || mb.high > 0, {
    lowCutoffHz: 220,
    highCutoffHz: 4500,
    lowThresholdDb: -10 - mb.low * 16,
    lowRatio: 1.4 + mb.low * 2,
    lowAttackMs: 12,
    lowReleaseMs: 220,
    midThresholdDb: -12 - mb.mid * 14,
    midRatio: 1.4 + mb.mid * 2,
    midAttackMs: 18,
    midReleaseMs: 160,
    highThresholdDb: -14 - mb.high * 14,
    highRatio: 1.4 + mb.high * 2,
    highAttackMs: 6,
    highReleaseMs: 90,
  });
  stage('saturation.tape', s.tapeDriveDb > 0 || s.tapeSaturation > 0, {
    driveDb: s.tapeDriveDb,
    saturation: s.tapeSaturation,
    hysteresis: 0.25,
    outputGainDb: 0,
    speedIps: 15,
    headBumpDb: 1.2,
    gapLoss: 0.25,
  });
  stage('saturation.exciter', s.exciterAmount > 0, {
    frequencyHz: preset === 'aiMusic' ? 14500 : 9000,
    driveDb: warm * 2.5,
    amount: preset === 'aiMusic' ? s.exciterAmount + 0.08 : s.exciterAmount,
    q: 0.8,
    evenOddMix: 0.65,
  });
  stage('spectral.airBand', true, {
    amount: preset === 'aiMusic' ? Math.max(s.airBandAmount, 0.55) : s.airBandAmount + warm * 0.12,
    shelfFrequencyHz: preset === 'aiMusic' ? 15500 : 12000,
  });
  stage('stereo.imager', true, {
    width,
    decorrelationAmount: preset === 'speech' ? 0 : wide * 0.08,
    preserveEnergy: true,
  });
  stage('stereo.monoMaker', monoAmount > 0, { amount: monoAmount });
  stage(LIMITER, true, {
    ceilingDb: s.limiterCeilingDb,
    lookaheadMs: s.limiterLookaheadMs,
    releaseMs: preset === 'edm' ? 80 : 120,
    oversampleFactor: 4,
    applyGainAtInputRate: false,
  });
  return out;
}

const NEUTRAL_TUNING = { tone: 50, width: 50, dynamics: 50 } as const;

/** Chain values of one Quick genre preset in one recording venue, before any macro. */
export function presetChainParams(preset: MasteringPresetId, venue: MasteringVenueId): ChainParams {
  return legacyChainParams({
    preset,
    venue,
    tuning: NEUTRAL_TUNING,
    moduleSettings: LEGACY_MODULE_DEFAULTS,
  });
}

// ---------------------------------------------------------------------------
// Match EQ: `match.matchEqCurve` fitted with four Peak bands

/** One fitted Peak band. */
export interface MatchEqPeak {
  frequencyHz: number;
  gainDb: number;
  q: number;
}

export interface MatchEqFit {
  /** Four Peak bands, ascending in frequency. */
  bands: MatchEqPeak[];
  /** Residual RMS deviation after the fit over the smoothed deviation before it. */
  residualRatio: number;
}

export const MATCH_EQ_BANDS = 4;
export const MATCH_EQ_MAX_GAIN_DB = 6;
const MATCH_EQ_MIN_Q = 0.3;
const MATCH_EQ_MAX_Q = 8;
// Half-width of the smoothing window applied before fitting, in octaves (1/6 octave in total).
const MATCH_EQ_SMOOTHING_OCTAVES = 1 / 12;

/** Magnitude in dB of an RBJ peaking biquad at `frequencyHz`. */
export function peakingResponseDb(
  frequencyHz: number,
  peak: MatchEqPeak,
  sampleRate: number,
): number {
  const a = 10 ** (peak.gainDb / 40);
  const w0 = (2 * Math.PI * peak.frequencyHz) / sampleRate;
  const alpha = Math.sin(w0) / (2 * peak.q);
  const cos = Math.cos(w0);
  const num = [1 + alpha * a, -2 * cos, 1 - alpha * a];
  const den = [1 + alpha / a, -2 * cos, 1 - alpha / a];
  const w = (2 * Math.PI * frequencyHz) / sampleRate;
  const mag2 = (c: number[]) => {
    const re = c[0] + c[1] * Math.cos(w) + c[2] * Math.cos(2 * w);
    const im = -c[1] * Math.sin(w) - c[2] * Math.sin(2 * w);
    return re * re + im * im;
  };
  return 10 * Math.log10(mag2(num) / mag2(den));
}

function rmsOf(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return Math.sqrt(values.reduce((sum, v) => sum + v * v, 0) / values.length);
}

/**
 * Greedy fit: put a Peak at the frequency of the largest remaining deviation,
 * take Q from the deviation's half-height width, clip the gain to ±6 dB,
 * subtract the band's response and repeat four times. The curve is smoothed
 * over 1/6 octave first so the fit follows the trend rather than single bins.
 */
export function fitMatchEqPeaks(
  curve: { frequencies: readonly number[]; gainDb: readonly number[] },
  sampleRate: number,
): MatchEqFit {
  const top = Math.min(20000, (sampleRate / 2) * 0.95);
  const points = curve.frequencies
    .map((frequencyHz, i) => ({ frequencyHz, gainDb: curve.gainDb[i] }))
    .filter(
      (p) =>
        finite(p.frequencyHz) && finite(p.gainDb) && p.frequencyHz >= 20 && p.frequencyHz < top,
    );
  if (points.length === 0) {
    return {
      bands: Array.from({ length: MATCH_EQ_BANDS }, () => ({ frequencyHz: 1000, gainDb: 0, q: 1 })),
      residualRatio: 0,
    };
  }
  const freqs = points.map((p) => p.frequencyHz);
  const spread = 2 ** MATCH_EQ_SMOOTHING_OCTAVES;
  const residual = points.map((p) => {
    const window = points.filter(
      (q) => q.frequencyHz >= p.frequencyHz / spread && q.frequencyHz <= p.frequencyHz * spread,
    );
    return window.reduce((sum, q) => sum + q.gainDb, 0) / window.length;
  });
  const initialRms = rmsOf(residual);
  const bands: MatchEqPeak[] = [];
  for (let k = 0; k < MATCH_EQ_BANDS; k++) {
    let at = 0;
    for (let i = 1; i < residual.length; i++) {
      if (Math.abs(residual[i]) > Math.abs(residual[at])) at = i;
    }
    const height = residual[at];
    const half = Math.abs(height) / 2;
    const inside = (i: number) =>
      Math.sign(residual[i]) === Math.sign(height) && Math.abs(residual[i]) >= half;
    let lo = at;
    while (lo > 0 && inside(lo - 1)) lo--;
    let hi = at;
    while (hi < residual.length - 1 && inside(hi + 1)) hi++;
    const span = 2 ** Math.max(1 / 12, Math.log2(freqs[hi] / freqs[lo]));
    const peak = {
      frequencyHz: freqs[at],
      gainDb: Math.max(-MATCH_EQ_MAX_GAIN_DB, Math.min(MATCH_EQ_MAX_GAIN_DB, height)),
      q: Math.min(MATCH_EQ_MAX_Q, Math.max(MATCH_EQ_MIN_Q, Math.sqrt(span) / (span - 1))),
    };
    bands.push(peak);
    for (let i = 0; i < residual.length; i++) {
      residual[i] -= peakingResponseDb(freqs[i], peak, sampleRate);
    }
  }
  bands.sort((a, b) => a.frequencyHz - b.frequencyHz);
  return { bands, residualRatio: initialRms > 0 ? rmsOf(residual) / initialRms : 0 };
}
