/**
 * Pure helpers behind the /mixing console: the fader taper, the control ranges
 * of every slot, export options, automation readout, the channel-delay hold
 * and the meter-target table. Nothing here touches Vue or the engine.
 */
import { MAX_TRACKS } from '@/demos/mixing/mixingConstants';
import { DISCRETE_PARAMS } from '@/demos/mixing/mixingEngine';
import {
  AUX_BUS_PROCESSORS,
  AUX_BUSES,
  type AutomationPoint,
  type AuxBusName,
  GROUP_BUSES,
  type GroupBusName,
  MASTER_SLOT_PROCESSORS,
  MAX_TOTAL_TRACK_SECONDS,
  type MasterSlotName,
  type MixingState,
  type MixTrackState,
  TRACK_SLOT_PROCESSORS,
  type TrackSlotName,
} from '@/demos/mixing/mixingState';
import type { EngineOp } from '@/utils/engineApply';
import type { MasteringInsertParamDependency } from '@/wasm/index.js';

// ---------------------------------------------------------------------------
// Fader taper

export const FADER_MIN_DB = -60;
export const FADER_MAX_DB = 12;

/** dB → travel; 0 dB sits at three quarters of the throw, as on a console. */
const FADER_TAPER: ReadonlyArray<readonly [number, number]> = [
  [-60, 0],
  [-40, 0.14],
  [-30, 0.25],
  [-20, 0.4],
  [-10, 0.58],
  [-5, 0.67],
  [0, 0.75],
  [6, 0.875],
  [12, 1],
];

/** Scale marks printed beside a fader. */
export const FADER_MARKS: readonly number[] = [12, 6, 0, -5, -10, -20, -30, -40, -60];

function interpolate(table: ReadonlyArray<readonly [number, number]>, x: number, from: 0 | 1) {
  const to = from === 0 ? 1 : 0;
  if (x <= table[0][from]) return table[0][to];
  for (let i = 1; i < table.length; i++) {
    const [a, b] = [table[i - 1], table[i]];
    if (x <= b[from]) return a[to] + ((x - a[from]) / (b[from] - a[from])) * (b[to] - a[to]);
  }
  return table[table.length - 1][to];
}

/** Fader travel in [0, 1] for a level in dB. */
export function faderPosition(db: number): number {
  return interpolate(FADER_TAPER, db, 0);
}

/** Level in dB at fader travel `position`. */
export function faderDbAt(position: number): number {
  return interpolate(FADER_TAPER, position, 1);
}

// ---------------------------------------------------------------------------
// Controls

export type ParamScale = 'linear' | 'log';

/** One continuous parameter as a control shows it. */
export interface ParamControl {
  name: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  scale?: ParamScale;
  /** Shown as a percentage of 1. */
  percent?: boolean;
}

const ms = (name: string, min: number, max: number): ParamControl => ({
  name,
  min,
  max,
  step: 0.1,
  unit: 'ms',
  scale: 'log',
});
const db = (name: string, min: number, max: number, step = 0.5): ParamControl => ({
  name,
  min,
  max,
  step,
  unit: 'dB',
});
const ratio = (max: number): ParamControl => ({
  name: 'ratio',
  min: 1,
  max,
  step: 0.1,
  unit: ':1',
  scale: 'log',
});

const COMPRESSOR_CONTROLS: readonly ParamControl[] = [
  db('thresholdDb', -60, 0),
  ratio(20),
  ms('attackMs', 0.1, 100),
  ms('releaseMs', 10, 1000),
  db('kneeDb', 0, 12),
  db('makeupGainDb', 0, 24),
];

/** Dynamics slots the inspector edits, in signal order. */
export type DynamicsSlot = 'gate' | 'comp' | 'deess' | 'duck';
export const DYNAMICS_SLOTS: readonly DynamicsSlot[] = ['gate', 'comp', 'deess', 'duck'];

export const TRACK_SLOT_CONTROLS: Readonly<Record<DynamicsSlot, readonly ParamControl[]>> = {
  // Open and close thresholds bound each other; see boundedControl.
  gate: [
    db('thresholdDb', -50, 0),
    db('rangeDb', -80, 0, 1),
    ms('attackMs', 0.1, 50),
    ms('releaseMs', 5, 1000),
    { name: 'holdMs', min: 0, max: 500, step: 1, unit: 'ms' },
    db('closeThresholdDb', -80, 0),
    { name: 'keyHpfHz', min: 0, max: 500, step: 1, unit: 'Hz' },
  ],
  comp: COMPRESSOR_CONTROLS,
  deess: [
    { name: 'frequencyHz', min: 2000, max: 12000, step: 10, unit: 'Hz', scale: 'log' },
    db('thresholdDb', -60, 0),
    ratio(10),
    db('rangeDb', 0, 24),
    ms('attackMs', 0.1, 20),
    ms('releaseMs', 10, 500),
    { name: 'bandpassQ', min: 0.5, max: 4, step: 0.05, unit: '' },
  ],
  duck: [
    db('thresholdDb', -60, 0),
    ratio(20),
    db('rangeDb', 0, 40),
    ms('attackMs', 0.1, 50),
    ms('releaseMs', 10, 1000),
  ],
};

export const TRIM_CONTROL: ParamControl = db('levelDb', -24, 24);
export const WIDTH_CONTROL: ParamControl = {
  name: 'width',
  min: 0,
  max: 2,
  step: 0.01,
  unit: '%',
  percent: true,
};
export const PAN_CONTROL: ParamControl = { name: 'pan', min: -1, max: 1, step: 0.01, unit: '' };
export const SEND_CONTROL: ParamControl = db('levelDb', -60, 6);
export const BUS_GAIN_CONTROL: ParamControl = db('gainDb', -24, 6);
export const CHANNEL_DELAY_CONTROL: ParamControl = {
  name: 'channelDelayMs',
  min: 0,
  max: 50,
  step: 0.1,
  unit: 'ms',
};

export const MASTER_SLOT_CONTROLS: Readonly<Record<MasterSlotName, readonly ParamControl[]>> = {
  glue: COMPRESSOR_CONTROLS,
  limiter: [db('ceilingDb', -6, 0, 0.1), ms('releaseMs', 1, 500)],
};

/** The plate's live `decay` is edited as its tail length in seconds. */
export const PLATE_DECAY_SECONDS: ParamControl = {
  name: 'decay',
  min: 0.2,
  max: 8,
  step: 0.1,
  unit: 's',
  scale: 'log',
};

export const BUS_CONTROLS: Readonly<Record<AuxBusName, readonly ParamControl[]>> = {
  reverb: [
    PLATE_DECAY_SECONDS,
    { name: 'preDelayMs', min: 0, max: 200, step: 1, unit: 'ms' },
    { name: 'damping', min: 0, max: 1, step: 0.01, unit: '%', percent: true },
  ],
  delay: [
    { name: 'delayTimeLMs', min: 1, max: 2000, step: 1, unit: 'ms', scale: 'log' },
    { name: 'delayTimeRMs', min: 1, max: 2000, step: 1, unit: 'ms', scale: 'log' },
    { name: 'feedback', min: 0, max: 0.95, step: 0.01, unit: '%', percent: true },
  ],
};

// Inverse of the plate model in mixingState's plateDecayFromSeconds.
const PLATE_TANK_LOOP_SECONDS = 21589 / 29761;

/** Tail length in seconds that the plate's live `decay` feedback gives. */
export function plateSecondsFromDecay(decay: number): number {
  const feedback = Math.min(0.98, Math.max(1e-6, decay));
  return (-Math.log(1000) * PLATE_TANK_LOOP_SECONDS) / (4 * Math.log(feedback));
}

/**
 * `control` with its travel narrowed by the siblings the engine catalogue says
 * bound it (`dependsOn`, read as `this <relation> factor * sibling`), at their
 * values in `params`.
 */
export function boundedControl(
  control: ParamControl,
  params: Readonly<Record<string, number>>,
  dependsOn: readonly MasteringInsertParamDependency[],
): ParamControl {
  let { min, max } = control;
  for (const { key, relation, factor } of dependsOn) {
    const bound = factor * params[key];
    if (relation === 'ge' || relation === 'gt') min = Math.max(min, bound);
    else max = Math.min(max, bound);
  }
  return min === control.min && max === control.max ? control : { ...control, min, max };
}

/** Whether a parameter only takes effect by rebuilding its strip. */
export function isDiscreteParam(processor: string, name: string): boolean {
  return (DISCRETE_PARAMS[processor] ?? []).includes(name);
}

export const trackSlotProcessor = (slot: TrackSlotName) => TRACK_SLOT_PROCESSORS[slot];
export const masterSlotProcessor = (slot: MasterSlotName) => MASTER_SLOT_PROCESSORS[slot];
export const busProcessor = (bus: AuxBusName) => AUX_BUS_PROCESSORS[bus];

// ---------------------------------------------------------------------------
// Export

// ---------------------------------------------------------------------------
// Automation readout

/** Shape of one segment at fraction `f` of its length. */
function curveAt(curve: AutomationPoint['curve'], f: number): number {
  switch (curve) {
    case 'hold':
      return 0;
    case 'exponential':
      return f * f;
    case 's-curve':
      return f * f * (3 - 2 * f);
    default:
      return f;
  }
}

/** The lane's value at `timeSec`, or `fallback` when the lane is empty. */
export function automationValueAt(
  points: readonly AutomationPoint[],
  timeSec: number,
  fallback: number,
): number {
  if (points.length === 0) return fallback;
  if (timeSec <= points[0].timeSec) return points[0].value;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (timeSec <= b.timeSec) {
      const span = b.timeSec - a.timeSec;
      const f = span > 0 ? (timeSec - a.timeSec) / span : 1;
      return a.value + (b.value - a.value) * curveAt(a.curve, f);
    }
  }
  return points[points.length - 1].value;
}

// ---------------------------------------------------------------------------
// Engine-side helpers

/** Existing track strips an op list rebuilds (a discrete edit resets their inserts). */
export function rebuiltTrackIds(ops: readonly EngineOp[], previous: MixingState): Set<number> {
  const known = new Set(previous.tracks.map((track) => track.id));
  const ids = new Set<number>();
  for (const op of ops) {
    if (op.type === 'strip' && op.strip.kind === 'track' && known.has(op.strip.trackId)) {
      ids.add(op.strip.trackId);
    }
  }
  return ids;
}

/** Meter target of the master bus. */
export const MASTER_METER_TARGET = 0;
/** Lanes report as 1 + lane index, in declaration order. */
const LANE_METER_BASE = 1;
/** Buses report as 33 + bus index, after the 32 lane targets. */
const BUS_METER_BASE = 33;

/** Every metered bus, in the order the topology declares them: aux returns, then groups. */
export type MixBusName = AuxBusName | GroupBusName;
export const METERED_BUSES: readonly MixBusName[] = [...AUX_BUSES, ...GROUP_BUSES];

export type MeterSource =
  | { kind: 'master' }
  | { kind: 'track'; trackId: number }
  | { kind: 'bus'; bus: MixBusName };

/** Which strip each meter target id belongs to, for lanes declared in `trackIds` order. */
export function meterSources(trackIds: readonly number[]): Map<number, MeterSource> {
  const map = new Map<number, MeterSource>([[MASTER_METER_TARGET, { kind: 'master' }]]);
  trackIds.forEach((trackId, i) => {
    map.set(LANE_METER_BASE + i, { kind: 'track', trackId });
  });
  METERED_BUSES.forEach((bus, i) => {
    map.set(BUS_METER_BASE + i, { kind: 'bus', bus });
  });
  return map;
}

// ---------------------------------------------------------------------------
// Budget, time and numbers

export interface AudioBudgetSummary {
  usedSec: number;
  remainingSec: number;
  /** Longest source each free track slot could still take. */
  perFreeSlotSec: number;
}

export function audioBudget(tracks: readonly MixTrackState[]): AudioBudgetSummary {
  const usedSec = tracks.reduce((sum, track) => sum + track.sourceDurationSec, 0);
  const remainingSec = Math.max(0, MAX_TOTAL_TRACK_SECONDS - usedSec);
  const free = MAX_TRACKS - tracks.length;
  return { usedSec, remainingSec, perFreeSlotSec: free > 0 ? remainingSec / free : 0 };
}

/** Ruler step in seconds giving at least `minPx` between marks. */
export function rulerStep(pxPerSec: number, minPx = 64): number {
  const steps = [0.5, 1, 2, 5, 10, 15, 30, 60];
  return steps.find((step) => step * pxPerSec >= minPx) ?? 120;
}

/** A number for a readout: fixed digits, a true minus sign, `—` when not finite. */
export function formatNumber(value: number, digits = 1, signed = false): string {
  if (!Number.isFinite(value)) return '—';
  const text = Math.abs(value).toFixed(digits);
  if (Number(text) === 0) return (0).toFixed(digits);
  if (value < 0) return `−${text}`;
  return signed ? `+${text}` : text;
}

/** A parameter value with the precision its step implies. */
export function formatParam(value: number, control: ParamControl): string {
  if (control.percent) return `${Math.round(value * 100)}`;
  const decimals = control.step >= 1 ? 0 : Math.min(3, Math.ceil(-Math.log10(control.step) - 1e-9));
  return formatNumber(value, decimals);
}

/** Pan as a console prints it: C, L30, R100. */
export function formatPan(pan: number): string {
  const amount = Math.round(Math.abs(pan) * 100);
  if (amount === 0) return 'C';
  return `${pan < 0 ? 'L' : 'R'}${amount}`;
}

/** Fader level; the bottom of the throw reads as −∞. */
export function formatFader(db: number): string {
  return db <= FADER_MIN_DB ? '−∞' : formatNumber(db, 1, true);
}

/** m:ss for the ruler and clip readouts. */
export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function fileBase(name: string): string {
  return name.replace(/\.[^.]+$/, '') || 'track';
}
