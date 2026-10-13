/**
 * The /mastering project state: one plain, structured-cloneable object that
 * the live engine, the export Worker, history and session storage all read.
 * It holds no PCM — audio is referenced by id and kept in a separate registry.
 *
 * Lane 1 ("After") carries a fixed 13-slot insert layout plus an 8-band strip
 * EQ; ON/OFF is bypass, so insert indices and automation ids never move. The
 * repair stages are offline and only change the clip lanes 1 and 2 play.
 *
 * Every edit goes through a mutator in {@link masteringMutators}: a pure
 * `(state, ...args) => state` that never mutates its input, so each call is
 * exactly one history entry.
 */
import type { LoudnessFitResult } from '@/demos/mastering/masteringLoudnessFit';
import {
  MASTERING_MACROS,
  type MasteringMacroId,
  type MasteringMacros,
  macroChainParams,
  neutralMacros,
} from '@/demos/mastering/masteringMacros';
import {
  chainParamTargets,
  chainStageDisabled,
  LEGACY_MODULE_DEFAULTS,
  LEGACY_MODULE_RANGES,
  type LegacyModuleSettings,
  legacyChainParams,
  type MatchEqFit,
  presetChainParams,
} from '@/demos/mastering/masteringPresetMap';
import type { MasteringMode } from '@/demos/mastering/masteringUi';
import {
  MASTERING_PLATFORMS,
  MASTERING_PRESETS,
  MASTERING_VENUES,
} from '@/demos/mastering/masteringUi';
import type {
  MasteringPlatformId,
  MasteringPresetId,
  MasteringVenueId,
} from '@/demos/mastering/useMastering';

/** Version written by {@link serializeMasteringState}. */
export const MASTERING_STATE_VERSION = 1;
/** localStorage key of the saved project state. */
export const MASTERING_STATE_STORAGE_KEY = 'libsonare-mastering-state-v2';
/** localStorage key of the chain preset the earlier page saved (22-field format). */
export const MASTERING_LEGACY_PRESET_STORAGE_KEY = 'libsonare-mastering-chain-preset-v1';

export type { MasteringMacroId, MasteringMacros } from '@/demos/mastering/masteringMacros';

/** The three engine lanes A/B/R switches between. */
export type MasteringLane = 'after' | 'before' | 'reference';
export const MASTERING_LANES: readonly MasteringLane[] = ['after', 'before', 'reference'];

/** A decoded audio file, by id; the PCM lives in the page's audio registry. */
export interface MasteringAudioRef {
  id: string;
  fileName: string;
  sampleRate: number;
  frames: number;
  channels: number;
}

export type MasteringParamValue = number | boolean;
export type MasteringParams = Record<string, MasteringParamValue>;

/** Offline repair stages, in the order the chain runs them. */
export type MasteringRepairStage =
  | 'declip'
  | 'declick'
  | 'decrackle'
  | 'dehum'
  | 'denoise'
  | 'dereverb';
export const MASTERING_REPAIR_STAGES: readonly MasteringRepairStage[] = [
  'declip',
  'declick',
  'decrackle',
  'dehum',
  'denoise',
  'dereverb',
];

/** One repair stage; `params` are `repair.<stage>.*` chain keys, unset = engine default. */
export interface MasteringRepairStageState {
  enabled: boolean;
  params: MasteringParams;
}
export type MasteringRepair = Record<MasteringRepairStage, MasteringRepairStageState>;

/** One lane-1 insert: every construction parameter, plus its bypass flag. */
export interface MasteringInsert {
  params: MasteringParams;
  bypassed: boolean;
}

export type MasteringEqBandType = 'HighPass' | 'LowShelf' | 'Peak' | 'HighShelf' | 'LowPass';

/** One strip EQ band; the type of each index is fixed by {@link MASTERING_EQ_LAYOUT}. */
export interface MasteringEqBand {
  type: MasteringEqBandType;
  frequencyHz: number;
  gainDb: number;
  q: number;
  enabled: boolean;
}

/** The last loudness fit, and the lane-1 configuration it was measured on. */
export interface MasteringLoudnessFitRecord {
  targetLufs: number;
  driveDb: number;
  measuredLufs: number;
  /** `targetLufs - measuredLufs`. */
  residualLu: number;
  bounces: number;
  /** The limiter could not bring the master within the reach tolerance of the target. */
  limited: boolean;
  /** {@link masteringFitFingerprint} of the state the drive was fitted on. */
  fingerprint: string;
}

/** Where the four Peak bands of the strip EQ came from, when a match EQ wrote them. */
export interface MasteringMatchEq {
  referenceId: string;
  /** Residual RMS deviation after the fit over the deviation before it. */
  residualRatio: number;
}

export interface MasteringQuick {
  preset: MasteringPresetId;
  venue: MasteringVenueId;
  platform: MasteringPlatformId;
  /** Loudness target when `platform` is `custom`. */
  customLufs: number;
  macros: MasteringMacros;
}

export interface MasteringState {
  version: typeof MASTERING_STATE_VERSION;
  mode: MasteringMode;
  source: MasteringAudioRef | null;
  reference: MasteringAudioRef | null;
  repair: MasteringRepair;
  eq: MasteringEqBand[];
  inserts: MasteringInsert[];
  loudness: { fit: MasteringLoudnessFitRecord | null };
  monitor: { lane: MasteringLane; matchLoudness: boolean };
  matchEq: MasteringMatchEq | null;
  quick: MasteringQuick;
}

export type MasteringSlotId =
  | 'input'
  | 'tone'
  | 'deesser'
  | 'transient'
  | 'compressor'
  | 'multiband'
  | 'tape'
  | 'exciter'
  | 'air'
  | 'stereo'
  | 'monoBass'
  | 'drive'
  | 'limiter';

export interface MasteringInsertLayoutEntry {
  id: MasteringSlotId;
  processor: string;
  /** The full parameter set the slot carries, at its default values. */
  params: Readonly<MasteringParams>;
  bypassed: boolean;
}

const bandParams = (band: number, threshold: number, attackMs: number, releaseMs: number) => ({
  [`band${band}.thresholdDb`]: threshold,
  [`band${band}.ratio`]: 2.4,
  [`band${band}.attackMs`]: attackMs,
  [`band${band}.releaseMs`]: releaseMs,
  [`band${band}.makeupGainDb`]: 0,
  [`band${band}.kneeDb`]: 0,
});

/**
 * Lane 1's insert column, all `pre`, in signal order. A slot a preset leaves
 * off keeps the values the earlier chain used for a moderate setting, so
 * un-bypassing it in Studio starts somewhere musical.
 */
export const MASTERING_INSERT_LAYOUT: readonly MasteringInsertLayoutEntry[] = [
  { id: 'input', processor: 'utility.gain', params: { levelDb: 0 }, bypassed: false },
  { id: 'tone', processor: 'eq.tilt', params: { tiltDb: 0, pivotHz: 1000 }, bypassed: false },
  {
    id: 'deesser',
    processor: 'dynamics.deesser',
    params: {
      frequencyHz: 6500,
      thresholdDb: -21,
      ratio: 4,
      attackMs: 1.5,
      releaseMs: 60,
      rangeDb: 12,
      bandpassQ: 1.5,
    },
    bypassed: true,
  },
  {
    id: 'transient',
    processor: 'dynamics.transientShaper',
    params: {
      attackGainDb: 2,
      sustainGainDb: 0,
      fastAttackMs: 1.5,
      fastReleaseMs: 18,
      slowAttackMs: 25,
      slowReleaseMs: 220,
      sensitivity: 0.6,
      maxGainDb: 8,
      gainSmoothingMs: 6,
      lookaheadMs: 1.5,
    },
    bypassed: true,
  },
  {
    id: 'compressor',
    processor: 'dynamics.compressor',
    params: {
      thresholdDb: -18,
      ratio: 2.2,
      attackMs: 18,
      releaseMs: 160,
      makeupGainDb: 0,
      kneeDb: 4,
      autoMakeup: true,
      detector: 1,
      sidechainHpfEnabled: false,
      sidechainHpfHz: 100,
      pdrTimeMs: 0,
      pdrReleaseScale: 1,
    },
    bypassed: false,
  },
  {
    id: 'multiband',
    processor: 'multiband.compressor',
    params: {
      ...bandParams(0, -18, 12, 220),
      ...bandParams(1, -19, 18, 160),
      ...bandParams(2, -21, 6, 90),
      cutoff0Hz: 220,
      cutoff1Hz: 4500,
    },
    bypassed: true,
  },
  {
    id: 'tape',
    processor: 'saturation.tape',
    params: {
      driveDb: 2,
      saturation: 0.3,
      hysteresis: 0.25,
      outputGainDb: 0,
      speedIps: 15,
      headBumpDb: 1.2,
      bias: 0,
      gapLoss: 0.25,
      oversampleFactor: 1,
    },
    bypassed: true,
  },
  {
    id: 'exciter',
    processor: 'saturation.exciter',
    params: {
      frequencyHz: 9000,
      driveDb: 1.25,
      amount: 0.1,
      q: 0.8,
      evenOddMix: 0.65,
      aliasing: 0,
    },
    bypassed: true,
  },
  {
    id: 'air',
    processor: 'spectral.airBand',
    params: { amount: 0.28, shelfFrequencyHz: 12000, dynamicThresholdDb: -36, dynamicRangeDb: 3 },
    bypassed: false,
  },
  {
    id: 'stereo',
    processor: 'stereo.imager',
    params: { width: 1.15, outputGainDb: 0, decorrelationAmount: 0.04, preserveEnergy: true },
    bypassed: false,
  },
  {
    id: 'monoBass',
    processor: 'stereo.monoMaker',
    params: { amount: 0.25, frequencyHz: 120 },
    bypassed: true,
  },
  { id: 'drive', processor: 'utility.gain', params: { levelDb: 0 }, bypassed: false },
  {
    id: 'limiter',
    processor: 'maximizer.truePeakLimiter',
    params: {
      ceilingDb: -1,
      releaseMs: 120,
      applyGainAtInputRate: false,
      lookaheadMs: 5,
      oversampleFactor: 4,
    },
    bypassed: false,
  },
];

/** Slot index of each insert in {@link MASTERING_INSERT_LAYOUT}. */
export const MASTERING_SLOT = Object.fromEntries(
  MASTERING_INSERT_LAYOUT.map((entry, index) => [entry.id, index]),
) as Readonly<Record<MasteringSlotId, number>>;

/** Lane 1's strip EQ: the band type of each index is fixed. */
export const MASTERING_EQ_LAYOUT: readonly MasteringEqBand[] = [
  { type: 'HighPass', frequencyHz: 30, gainDb: 0, q: Math.SQRT1_2, enabled: false },
  { type: 'LowShelf', frequencyHz: 120, gainDb: 0, q: Math.SQRT1_2, enabled: false },
  { type: 'Peak', frequencyHz: 300, gainDb: 0, q: 1, enabled: false },
  { type: 'Peak', frequencyHz: 1000, gainDb: 0, q: 1, enabled: false },
  { type: 'Peak', frequencyHz: 3000, gainDb: 0, q: 1, enabled: false },
  { type: 'Peak', frequencyHz: 6000, gainDb: 0, q: 1, enabled: false },
  { type: 'HighShelf', frequencyHz: 10000, gainDb: 0, q: Math.SQRT1_2, enabled: false },
  { type: 'LowPass', frequencyHz: 20000, gainDb: 0, q: Math.SQRT1_2, enabled: false },
];

/** Strip EQ indices of the four Peak bands a match EQ writes. */
export const MASTERING_MATCH_EQ_BANDS: readonly number[] = [2, 3, 4, 5];

const DEFAULT_PLATFORM: MasteringPlatformId = 'youtube';
const CUSTOM_LUFS_RANGE = { min: -24, max: -8 } as const;

function defaultInserts(): MasteringInsert[] {
  return MASTERING_INSERT_LAYOUT.map((entry) => ({
    params: { ...entry.params },
    bypassed: entry.bypassed,
  }));
}

function defaultRepair(): MasteringRepair {
  return Object.fromEntries(
    MASTERING_REPAIR_STAGES.map((stage) => [stage, { enabled: false, params: {} }]),
  ) as MasteringRepair;
}

function baseState(): MasteringState {
  return {
    version: MASTERING_STATE_VERSION,
    mode: 'quick',
    source: null,
    reference: null,
    repair: defaultRepair(),
    eq: MASTERING_EQ_LAYOUT.map((band) => ({ ...band })),
    inserts: defaultInserts(),
    loudness: { fit: null },
    monitor: { lane: 'after', matchLoudness: true },
    matchEq: null,
    quick: {
      preset: 'pop',
      venue: 'studio',
      platform: DEFAULT_PLATFORM,
      customLufs: -14,
      macros: { tone: 0, width: 1, dynamics: 0, ceiling: -1 },
    },
  };
}

/** A fresh project: Pop in a studio, delivered to the default platform. */
export function defaultMasteringState(): MasteringState {
  return selectPreset(baseState(), 'pop');
}

/** The integrated loudness the loudness fit aims at. */
export function masteringTargetLufs(state: MasteringState): number {
  const { platform, customLufs } = state.quick;
  if (platform === 'custom') return customLufs;
  return MASTERING_PLATFORMS.find((entry) => entry.id === platform)?.lufs ?? customLufs;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`,
      );
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * Everything that changes what lane 1 renders, plus the target: a fit recorded
 * under a different fingerprint no longer describes the master.
 */
export function masteringFitFingerprint(state: MasteringState): string {
  return stableStringify({
    source: state.source?.id ?? null,
    repair: state.repair,
    eq: state.eq,
    inserts: state.inserts,
    targetLufs: masteringTargetLufs(state),
  });
}

/** True when there is no fit, or lane 1 / the target changed since the last one. */
export function isLoudnessFitStale(state: MasteringState): boolean {
  const fit = state.loudness.fit;
  return !fit || fit.fingerprint !== masteringFitFingerprint(state);
}

// ---------------------------------------------------------------------------
// Validation helpers shared by mutators

function requireFinite(value: number, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new RangeError(`${label} must be a finite number, got ${String(value)}`);
  }
  return value;
}

function requireSlot(slot: number): MasteringInsertLayoutEntry {
  const entry = MASTERING_INSERT_LAYOUT[slot];
  if (!Number.isInteger(slot) || !entry) throw new RangeError(`no insert slot ${slot}`);
  return entry;
}

function requireParamValue(
  entry: MasteringInsertLayoutEntry,
  name: string,
  value: MasteringParamValue,
): MasteringParamValue {
  const current = entry.params[name];
  if (current === undefined) {
    throw new RangeError(`${entry.processor} in slot ${entry.id} has no parameter ${name}`);
  }
  if (typeof current === 'boolean') {
    if (typeof value !== 'boolean') throw new RangeError(`${entry.id}.${name} is a boolean`);
    return value;
  }
  return requireFinite(value as number, `${entry.id}.${name}`);
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function withInsert(
  state: MasteringState,
  slot: number,
  update: (insert: MasteringInsert) => MasteringInsert,
): MasteringState {
  requireSlot(slot);
  return {
    ...state,
    inserts: state.inserts.map((insert, i) => (i === slot ? update(insert) : insert)),
  };
}

// ---------------------------------------------------------------------------
// Applying chain-config keys (presets, macros, the assistant, legacy presets)

function withKey<T>(record: Record<string, T>, key: string, value: T): Record<string, T> {
  return { ...record, [key]: value };
}

/**
 * Applies a flat `{ 'stage.param': value }` chain-config map onto the state
 * through the mapping table in `masteringPresetMap.ts`. Keys the table cannot
 * place are skipped; `unmappedChainParams` lists them.
 */
function applyChainMap(state: MasteringState, flat: Readonly<MasteringParams>): MasteringState {
  let next: MasteringState = state;
  for (const target of chainParamTargets(flat)) {
    if (target.kind === 'insertParam') {
      const entry = MASTERING_INSERT_LAYOUT[target.slot];
      if (typeof entry.params[target.param] !== typeof target.value) continue;
      next = withInsert(next, target.slot, (insert) => ({
        ...insert,
        params: withKey(insert.params, target.param, target.value),
      }));
    } else if (target.kind === 'insertBypass') {
      next = withInsert(next, target.slot, (insert) => ({ ...insert, bypassed: target.bypassed }));
    } else if (target.kind === 'repairEnabled') {
      next = {
        ...next,
        repair: {
          ...next.repair,
          [target.stage]: { ...next.repair[target.stage], enabled: target.enabled },
        },
      };
    } else if (target.kind === 'repairParam') {
      const stage = next.repair[target.stage];
      next = {
        ...next,
        repair: {
          ...next.repair,
          [target.stage]: { ...stage, params: withKey(stage.params, target.param, target.value) },
        },
      };
    } else if (target.kind === 'targetLufs') {
      if (target.value !== masteringTargetLufs(next)) {
        next = {
          ...next,
          quick: {
            ...next.quick,
            platform: 'custom',
            customLufs: clamp(target.value, CUSTOM_LUFS_RANGE.min, CUSTOM_LUFS_RANGE.max),
          },
        };
      }
    }
  }
  return next;
}

/**
 * Keys of a flat chain-config map that the state cannot carry, for listing as
 * "not applied". Keys of a stage the map switches off are left out: their
 * values change nothing.
 */
export function unmappedChainParams(flat: Readonly<MasteringParams>): string[] {
  return chainParamTargets(flat)
    .filter((target) => {
      if (target.kind === 'unmapped') return true;
      if (target.kind !== 'insertParam') return false;
      const current = MASTERING_INSERT_LAYOUT[target.slot].params[target.param];
      return typeof current !== typeof target.value;
    })
    .map((target) => target.key)
    .filter((key) => !chainStageDisabled(flat, key));
}

/** Inserts and repair rebuilt from the layout defaults plus the preset × venue chain values. */
function presetState(state: MasteringState, preset: MasteringPresetId, venue: MasteringVenueId) {
  const base = presetChainParams(preset, venue);
  const applied = applyChainMap(
    { ...state, inserts: defaultInserts(), repair: defaultRepair() },
    base,
  );
  return {
    ...applied,
    quick: { ...applied.quick, preset, venue, macros: neutralMacros(base) },
  };
}

// ---------------------------------------------------------------------------
// Mutators

function setMode(state: MasteringState, mode: MasteringMode): MasteringState {
  return { ...state, mode };
}

function setSource(state: MasteringState, source: MasteringAudioRef | null): MasteringState {
  return { ...state, source: source && { ...source } };
}

function setReference(state: MasteringState, reference: MasteringAudioRef | null): MasteringState {
  const lane = !reference && state.monitor.lane === 'reference' ? 'after' : state.monitor.lane;
  return {
    ...state,
    reference: reference && { ...reference },
    monitor: { ...state.monitor, lane },
  };
}

function setRepairStageEnabled(
  state: MasteringState,
  stage: MasteringRepairStage,
  enabled: boolean,
): MasteringState {
  if (!MASTERING_REPAIR_STAGES.includes(stage)) throw new RangeError(`no repair stage ${stage}`);
  return { ...state, repair: { ...state.repair, [stage]: { ...state.repair[stage], enabled } } };
}

function setRepairParam(
  state: MasteringState,
  stage: MasteringRepairStage,
  name: string,
  value: MasteringParamValue,
): MasteringState {
  if (!MASTERING_REPAIR_STAGES.includes(stage)) throw new RangeError(`no repair stage ${stage}`);
  if (typeof value === 'number') requireFinite(value, `repair.${stage}.${name}`);
  const current = state.repair[stage];
  return {
    ...state,
    repair: {
      ...state.repair,
      [stage]: { ...current, params: { ...current.params, [name]: value } },
    },
  };
}

/**
 * Turns on exactly the stages a repair detection recommends, each with the
 * settings it came with; every other stage goes off.
 */
function applyRepairSuggestion(
  state: MasteringState,
  recommended: Readonly<Partial<Record<MasteringRepairStage, MasteringParams>>>,
): MasteringState {
  const repair = { ...state.repair };
  for (const stage of MASTERING_REPAIR_STAGES) {
    const params = recommended[stage];
    if (params) {
      for (const [name, value] of Object.entries(params)) {
        if (typeof value === 'number') requireFinite(value, `repair.${stage}.${name}`);
      }
    }
    repair[stage] = params
      ? { enabled: true, params: { ...params } }
      : { ...state.repair[stage], enabled: false };
  }
  return { ...state, repair };
}

function setEqBand(
  state: MasteringState,
  index: number,
  patch: Partial<Pick<MasteringEqBand, 'frequencyHz' | 'gainDb' | 'q' | 'enabled'>>,
): MasteringState {
  const band = state.eq[index];
  if (!band) throw new RangeError(`no EQ band ${index}`);
  for (const key of ['frequencyHz', 'gainDb', 'q'] as const) {
    if (patch[key] !== undefined) requireFinite(patch[key], `eq[${index}].${key}`);
  }
  return {
    ...state,
    eq: state.eq.map((b, i) => (i === index ? { ...band, ...patch, type: band.type } : b)),
  };
}

function setInsertParam(
  state: MasteringState,
  slot: number,
  name: string,
  value: MasteringParamValue,
): MasteringState {
  const checked = requireParamValue(requireSlot(slot), name, value);
  return withInsert(state, slot, (insert) => ({
    ...insert,
    params: { ...insert.params, [name]: checked },
  }));
}

function setInsertBypassed(state: MasteringState, slot: number, bypassed: boolean): MasteringState {
  return withInsert(state, slot, (insert) => ({ ...insert, bypassed }));
}

/** Back to the layout default of the slot (parameters and bypass). */
function resetInsert(state: MasteringState, slot: number): MasteringState {
  const entry = requireSlot(slot);
  return withInsert(state, slot, () => ({ params: { ...entry.params }, bypassed: entry.bypassed }));
}

/** Writes the fitted drive into slot `drive` and records what it was fitted on. */
function applyLoudnessFit(state: MasteringState, fit: LoudnessFitResult): MasteringState {
  requireFinite(fit.driveDb, 'fit.driveDb');
  const withDrive = withInsert(state, MASTERING_SLOT.drive, (insert) => ({
    ...insert,
    params: { ...insert.params, levelDb: fit.driveDb },
  }));
  return {
    ...withDrive,
    loudness: {
      fit: {
        targetLufs: fit.targetLufs,
        driveDb: fit.driveDb,
        measuredLufs: fit.measuredLufs,
        residualLu: fit.residualLu,
        bounces: fit.bounces,
        limited: fit.limited,
        fingerprint: masteringFitFingerprint(withDrive),
      },
    },
  };
}

function setMonitorLane(state: MasteringState, lane: MasteringLane): MasteringState {
  if (!MASTERING_LANES.includes(lane)) throw new RangeError(`no lane ${lane}`);
  if (lane === 'reference' && !state.reference) return state;
  return { ...state, monitor: { ...state.monitor, lane } };
}

function setMatchLoudness(state: MasteringState, matchLoudness: boolean): MasteringState {
  return { ...state, monitor: { ...state.monitor, matchLoudness } };
}

/** Writes a match-EQ fit into the four Peak bands. */
function applyMatchEq(state: MasteringState, fit: MatchEqFit, referenceId: string): MasteringState {
  if (fit.bands.length !== MASTERING_MATCH_EQ_BANDS.length) {
    throw new RangeError(`a match EQ fit has ${MASTERING_MATCH_EQ_BANDS.length} bands`);
  }
  const eq = state.eq.map((band) => ({ ...band }));
  fit.bands.forEach((peak, i) => {
    const index = MASTERING_MATCH_EQ_BANDS[i];
    eq[index] = {
      ...eq[index],
      frequencyHz: requireFinite(peak.frequencyHz, 'match frequencyHz'),
      gainDb: requireFinite(peak.gainDb, 'match gainDb'),
      q: requireFinite(peak.q, 'match q'),
      enabled: true,
    };
  });
  return { ...state, eq, matchEq: { referenceId, residualRatio: fit.residualRatio } };
}

/** Returns the four Peak bands to their layout defaults. */
function clearMatchEq(state: MasteringState): MasteringState {
  const eq = state.eq.map((band, i) =>
    MASTERING_MATCH_EQ_BANDS.includes(i) ? { ...MASTERING_EQ_LAYOUT[i] } : band,
  );
  return { ...state, eq, matchEq: null };
}

/** Resets inserts and repair to the genre preset for the current venue. */
function selectPreset(state: MasteringState, preset: MasteringPresetId): MasteringState {
  if (!MASTERING_PRESETS.some((entry) => entry.id === preset))
    throw new RangeError(`no preset ${preset}`);
  return presetState(state, preset, state.quick.venue);
}

/** Resets inserts and repair to the current genre preset for `venue`. */
function selectVenue(state: MasteringState, venue: MasteringVenueId): MasteringState {
  if (!MASTERING_VENUES.some((entry) => entry.id === venue))
    throw new RangeError(`no venue ${venue}`);
  return presetState(state, state.quick.preset, venue);
}

function selectPlatform(state: MasteringState, platform: MasteringPlatformId): MasteringState {
  if (!MASTERING_PLATFORMS.some((entry) => entry.id === platform)) {
    throw new RangeError(`no platform ${platform}`);
  }
  return { ...state, quick: { ...state.quick, platform } };
}

/** Sets a custom loudness target (and selects the custom platform). */
function setCustomLufs(state: MasteringState, lufs: number): MasteringState {
  const customLufs = clamp(
    requireFinite(lufs, 'customLufs'),
    CUSTOM_LUFS_RANGE.min,
    CUSTOM_LUFS_RANGE.max,
  );
  return { ...state, quick: { ...state.quick, platform: 'custom', customLufs } };
}

/** Moves one Quick macro; the slots it drives are recomputed from the preset values. */
function setMacro(state: MasteringState, macro: MasteringMacroId, value: number): MasteringState {
  const range = MASTERING_MACROS[macro];
  if (!range) throw new RangeError(`no macro ${macro}`);
  const macros = {
    ...state.quick.macros,
    [macro]: clamp(requireFinite(value, macro), range.min, range.max),
  };
  const base = presetChainParams(state.quick.preset, state.quick.venue);
  const applied = applyChainMap(state, macroChainParams(base, macros, macro));
  return { ...applied, quick: { ...applied.quick, macros } };
}

/** Applies an assistant chain suggestion (`masteringAssistantSuggestChainStereo`). */
function applyAssistant(state: MasteringState, flat: Readonly<MasteringParams>): MasteringState {
  return applyChainMap(state, flat);
}

/**
 * Every way the UI may change the project. Each is pure and returns a new
 * state, so one call is one history entry.
 */
export const masteringMutators = {
  setMode,
  setSource,
  setReference,
  setRepairStageEnabled,
  setRepairParam,
  applyRepairSuggestion,
  setEqBand,
  setInsertParam,
  setInsertBypassed,
  resetInsert,
  applyLoudnessFit,
  setMonitorLane,
  setMatchLoudness,
  applyMatchEq,
  clearMatchEq,
  selectPreset,
  selectVenue,
  selectPlatform,
  setCustomLufs,
  setMacro,
  applyAssistant,
} as const;

export type MasteringMutatorName = keyof typeof masteringMutators;

export {
  applyAssistant,
  applyLoudnessFit,
  applyMatchEq,
  applyRepairSuggestion,
  clearMatchEq,
  resetInsert,
  selectPlatform,
  selectPreset,
  selectVenue,
  setCustomLufs,
  setEqBand,
  setInsertBypassed,
  setInsertParam,
  setMacro,
  setMatchLoudness,
  setMode,
  setMonitorLane,
  setReference,
  setRepairParam,
  setRepairStageEnabled,
  setSource,
};

// ---------------------------------------------------------------------------
// Serialization

/** Result of reading a saved project: the state plus every value that fell back to its default. */
export interface MasteringRestore {
  state: MasteringState;
  /** Dotted paths of saved values that could not be used and were replaced by defaults. */
  notices: string[];
}

/** JSON for localStorage; carries no audio. */
export function serializeMasteringState(state: MasteringState): string {
  return JSON.stringify(state);
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

function readAudioRef(raw: unknown): MasteringAudioRef | null | undefined {
  if (raw === null) return null;
  if (!isRecord(raw)) return undefined;
  const { id, fileName, sampleRate, frames, channels } = raw;
  if (
    typeof id !== 'string' ||
    typeof fileName !== 'string' ||
    !isFiniteNumber(sampleRate) ||
    !isFiniteNumber(frames) ||
    !isFiniteNumber(channels)
  ) {
    return undefined;
  }
  return { id, fileName, sampleRate, frames, channels };
}

function readParams(
  raw: unknown,
  defaults: Readonly<MasteringParams>,
  path: string,
  notices: string[],
): MasteringParams {
  const params: MasteringParams = { ...defaults };
  if (!isRecord(raw)) {
    notices.push(path);
    return params;
  }
  for (const [name, value] of Object.entries(defaults)) {
    const saved = raw[name];
    if (typeof value === 'boolean' ? typeof saved === 'boolean' : isFiniteNumber(saved)) {
      params[name] = saved as MasteringParamValue;
    } else {
      notices.push(`${path}.${name}`);
    }
  }
  return params;
}

function readOpenParams(raw: unknown, path: string, notices: string[]): MasteringParams {
  if (!isRecord(raw)) {
    notices.push(path);
    return {};
  }
  const params: MasteringParams = {};
  for (const [name, value] of Object.entries(raw)) {
    if (typeof value === 'boolean' || isFiniteNumber(value)) params[name] = value;
    else notices.push(`${path}.${name}`);
  }
  return params;
}

function readCurrent(raw: Record<string, unknown>, notices: string[]): MasteringState {
  const state = defaultMasteringState();
  const read = <T>(path: string, value: T | undefined, fallback: T): T => {
    if (value === undefined) {
      notices.push(path);
      return fallback;
    }
    return value;
  };

  const mode = raw.mode === 'quick' || raw.mode === 'studio' ? raw.mode : undefined;
  const quick = isRecord(raw.quick) ? raw.quick : {};
  const preset = MASTERING_PRESETS.find((entry) => entry.id === quick.preset)?.id;
  const venue = MASTERING_VENUES.find((entry) => entry.id === quick.venue)?.id;
  const platform = MASTERING_PLATFORMS.find((entry) => entry.id === quick.platform)?.id;
  const macrosRaw = isRecord(quick.macros) ? quick.macros : {};
  const macros = { ...state.quick.macros };
  for (const key of Object.keys(MASTERING_MACROS) as MasteringMacroId[]) {
    const value = macrosRaw[key];
    if (isFiniteNumber(value))
      macros[key] = clamp(value, MASTERING_MACROS[key].min, MASTERING_MACROS[key].max);
    else notices.push(`quick.macros.${key}`);
  }

  const insertsRaw = Array.isArray(raw.inserts) ? raw.inserts : [];
  if (insertsRaw.length !== MASTERING_INSERT_LAYOUT.length) notices.push('inserts');
  const inserts = state.inserts.map((fallback, slot) => {
    const saved = insertsRaw[slot];
    if (!isRecord(saved)) return fallback;
    return {
      params: readParams(saved.params, fallback.params, `inserts.${slot}.params`, notices),
      bypassed: read(
        `inserts.${slot}.bypassed`,
        typeof saved.bypassed === 'boolean' ? saved.bypassed : undefined,
        fallback.bypassed,
      ),
    };
  });

  const eqRaw = Array.isArray(raw.eq) ? raw.eq : [];
  if (eqRaw.length !== MASTERING_EQ_LAYOUT.length) notices.push('eq');
  const eq = MASTERING_EQ_LAYOUT.map((layout, i) => {
    const saved = eqRaw[i];
    if (!isRecord(saved)) return { ...layout };
    const band = { ...layout };
    for (const key of ['frequencyHz', 'gainDb', 'q'] as const) {
      if (isFiniteNumber(saved[key])) band[key] = saved[key] as number;
      else notices.push(`eq.${i}.${key}`);
    }
    if (typeof saved.enabled === 'boolean') band.enabled = saved.enabled;
    else notices.push(`eq.${i}.enabled`);
    return band;
  });

  const repairRaw = isRecord(raw.repair) ? raw.repair : {};
  const repair = defaultRepair();
  for (const stage of MASTERING_REPAIR_STAGES) {
    const saved = repairRaw[stage];
    if (!isRecord(saved)) {
      notices.push(`repair.${stage}`);
      continue;
    }
    repair[stage] = {
      enabled: read(
        `repair.${stage}.enabled`,
        typeof saved.enabled === 'boolean' ? saved.enabled : undefined,
        false,
      ),
      params: readOpenParams(saved.params, `repair.${stage}.params`, notices),
    };
  }

  const monitorRaw = isRecord(raw.monitor) ? raw.monitor : {};
  const lane = MASTERING_LANES.find((entry) => entry === monitorRaw.lane);
  const source = readAudioRef(raw.source);
  const reference = readAudioRef(raw.reference);
  const fitRaw = isRecord(raw.loudness) ? raw.loudness.fit : undefined;
  const fit = readFit(fitRaw);
  if (fit === undefined) notices.push('loudness.fit');
  const matchEq = readMatchEq(raw.matchEq);
  if (matchEq === undefined) notices.push('matchEq');

  const restored: MasteringState = {
    version: MASTERING_STATE_VERSION,
    mode: read('mode', mode, state.mode),
    source: read('source', source, null),
    reference: read('reference', reference, null),
    repair,
    eq,
    inserts,
    loudness: { fit: fit ?? null },
    monitor: {
      lane: read('monitor.lane', lane, 'after'),
      matchLoudness: read(
        'monitor.matchLoudness',
        typeof monitorRaw.matchLoudness === 'boolean' ? monitorRaw.matchLoudness : undefined,
        true,
      ),
    },
    matchEq: matchEq ?? null,
    quick: {
      preset: read('quick.preset', preset, state.quick.preset),
      venue: read('quick.venue', venue, state.quick.venue),
      platform: read('quick.platform', platform, state.quick.platform),
      customLufs: read(
        'quick.customLufs',
        isFiniteNumber(quick.customLufs)
          ? clamp(quick.customLufs, CUSTOM_LUFS_RANGE.min, CUSTOM_LUFS_RANGE.max)
          : undefined,
        state.quick.customLufs,
      ),
      macros,
    },
  };
  return restored.monitor.lane === 'reference' && !restored.reference
    ? { ...restored, monitor: { ...restored.monitor, lane: 'after' } }
    : restored;
}

function readFit(raw: unknown): MasteringLoudnessFitRecord | null | undefined {
  if (raw === null) return null;
  if (!isRecord(raw)) return undefined;
  const numbers = ['targetLufs', 'driveDb', 'measuredLufs', 'residualLu', 'bounces'] as const;
  if (!numbers.every((key) => isFiniteNumber(raw[key]))) return undefined;
  if (typeof raw.limited !== 'boolean' || typeof raw.fingerprint !== 'string') return undefined;
  return {
    targetLufs: raw.targetLufs as number,
    driveDb: raw.driveDb as number,
    measuredLufs: raw.measuredLufs as number,
    residualLu: raw.residualLu as number,
    bounces: raw.bounces as number,
    limited: raw.limited,
    fingerprint: raw.fingerprint,
  };
}

function readMatchEq(raw: unknown): MasteringMatchEq | null | undefined {
  if (raw === null) return null;
  if (!isRecord(raw) || typeof raw.referenceId !== 'string' || !isFiniteNumber(raw.residualRatio)) {
    return undefined;
  }
  return { referenceId: raw.referenceId, residualRatio: raw.residualRatio };
}

/**
 * Converts the earlier page's saved chain preset (`selectedPreset`, `tuning`
 * 0..100 sliders and the 22 `moduleSettings` fields). The values are replayed
 * through the earlier chain builder and mapped onto the insert layout, so the
 * converted project renders the same settings; an unusable value falls back
 * to its default and is listed.
 */
export function convertLegacyMasteringPreset(raw: unknown): MasteringRestore {
  const notices: string[] = [];
  const settings = isRecord(raw) && isRecord(raw.settings) ? raw.settings : raw;
  if (!isRecord(settings)) return { state: defaultMasteringState(), notices: ['settings'] };

  const pick = <T>(key: string, value: T | undefined, fallback: T): T => {
    if (value === undefined) {
      if (key in settings) notices.push(key);
      return fallback;
    }
    return value;
  };
  const preset = pick(
    'selectedPreset',
    MASTERING_PRESETS.find((entry) => entry.id === settings.selectedPreset)?.id,
    'pop' as MasteringPresetId,
  );
  const venue = pick(
    'selectedVenue',
    MASTERING_VENUES.find((entry) => entry.id === settings.selectedVenue)?.id,
    'studio' as MasteringVenueId,
  );
  const platform = pick(
    'selectedPlatform',
    MASTERING_PLATFORMS.find((entry) => entry.id === settings.selectedPlatform)?.id,
    DEFAULT_PLATFORM,
  );
  const sliderOf = (key: 'tone' | 'width' | 'dynamics') =>
    pick(
      key,
      isFiniteNumber(settings[key]) ? clamp(settings[key] as number, 0, 100) : undefined,
      50,
    );
  const tuning = {
    tone: sliderOf('tone'),
    width: sliderOf('width'),
    dynamics: sliderOf('dynamics'),
  };

  const moduleRaw = isRecord(settings.moduleSettings) ? settings.moduleSettings : {};
  if ('moduleSettings' in settings && !isRecord(settings.moduleSettings))
    notices.push('moduleSettings');
  const moduleSettings: LegacyModuleSettings = { ...LEGACY_MODULE_DEFAULTS };
  for (const key of Object.keys(LEGACY_MODULE_DEFAULTS) as (keyof LegacyModuleSettings)[]) {
    if (!(key in moduleRaw)) continue;
    const value = moduleRaw[key];
    const range = LEGACY_MODULE_RANGES[key];
    // The earlier page clamped a saved value into its control range on load.
    if (isFiniteNumber(value)) moduleSettings[key] = clamp(value, range.min, range.max);
    else notices.push(`moduleSettings.${key}`);
  }

  let state = presetState(
    { ...baseState(), quick: { ...baseState().quick, platform } },
    preset,
    venue,
  );
  state = applyChainMap(state, legacyChainParams({ preset, venue, tuning, moduleSettings }));
  state = withInsert(state, MASTERING_SLOT.input, (insert) => ({
    ...insert,
    params: { ...insert.params, levelDb: moduleSettings.inputGainDb },
  }));
  const image = state.inserts[MASTERING_SLOT.stereo].params.width as number;
  const ceiling = state.inserts[MASTERING_SLOT.limiter].params.ceilingDb as number;
  state = {
    ...state,
    mode: settings.mode === 'studio' ? 'studio' : 'quick',
    monitor: {
      ...state.monitor,
      matchLoudness:
        typeof settings.loudnessMatched === 'boolean' ? settings.loudnessMatched : true,
    },
    quick: {
      ...state.quick,
      customLufs: isFiniteNumber(settings.customLufs)
        ? clamp(settings.customLufs, CUSTOM_LUFS_RANGE.min, CUSTOM_LUFS_RANGE.max)
        : state.quick.customLufs,
      macros: {
        tone: 0,
        width: clamp(image, MASTERING_MACROS.width.min, MASTERING_MACROS.width.max),
        dynamics: 0,
        ceiling: clamp(ceiling, MASTERING_MACROS.ceiling.min, MASTERING_MACROS.ceiling.max),
      },
    },
  };
  return { state, notices };
}

/**
 * Reads a saved project. The current format is validated field by field;
 * the earlier chain-preset format is converted.
 */
export function deserializeMasteringState(json: string): MasteringRestore {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { state: defaultMasteringState(), notices: ['json'] };
  }
  if (!isRecord(raw)) return { state: defaultMasteringState(), notices: ['json'] };
  if (raw.version === undefined) return convertLegacyMasteringPreset(raw);
  if (raw.version !== MASTERING_STATE_VERSION) {
    return { state: defaultMasteringState(), notices: ['version'] };
  }
  const notices: string[] = [];
  return { state: readCurrent(raw, notices), notices };
}
