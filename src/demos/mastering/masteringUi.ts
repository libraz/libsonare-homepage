/**
 * Static definitions the /mastering UI reads: the Quick axes (genre, venue,
 * platform), the signal-chain rack rows and the control range of every insert
 * parameter Studio exposes. Ranges here are UI ranges; the engine's own
 * construction limits are wider.
 */
import type { MasteringSlotId } from '@/demos/mastering/masteringState';
import type {
  MasteringPlatformId,
  MasteringPresetId,
  MasteringVenueId,
} from '@/demos/mastering/useMastering';

export type MasteringMode = 'quick' | 'studio';

export const MASTERING_PRESETS: Array<{ id: MasteringPresetId; icon: string }> = [
  { id: 'pop', icon: 'POP' },
  { id: 'edm', icon: 'EDM' },
  { id: 'acoustic', icon: 'AC' },
  { id: 'liveSmall', icon: 'LV-S' },
  { id: 'liveLarge', icon: 'LV-L' },
  { id: 'hiphop', icon: 'HH' },
  { id: 'aiMusic', icon: 'AI' },
  { id: 'speech', icon: 'VO' },
];

/** Recording-condition axis, orthogonal to the genre: it drives the room-repair layer. */
export const MASTERING_VENUES: Array<{ id: MasteringVenueId; icon: string }> = [
  { id: 'studio', icon: 'STU' },
  { id: 'livehouseSmall', icon: 'RM-S' },
  { id: 'livehouseLarge', icon: 'RM-L' },
];

/**
 * Recommended integrated loudness per genre. Streaming normalisation only
 * turns loud masters down, so dynamic material is mastered quieter.
 */
export const MASTERING_PRESET_TARGETS: Record<MasteringPresetId, number> = {
  pop: -14,
  edm: -14,
  acoustic: -16,
  liveSmall: -16,
  liveLarge: -18,
  hiphop: -14,
  aiMusic: -14,
  speech: -16,
};

/** Warn once the chosen target is this many LU louder than the recommendation. */
export const MASTERING_LOUD_WARNING_LU = 1;

export const MASTERING_PLATFORMS: Array<{ id: MasteringPlatformId; lufs: number }> = [
  { id: 'spotify', lufs: -14 },
  { id: 'youtube', lufs: -14 },
  { id: 'apple', lufs: -16 },
  { id: 'tiktok', lufs: -16 },
  { id: 'custom', lufs: -14 },
];

/** Longest source or reference the page accepts, in seconds. */
export const MASTERING_MAX_SECONDS = 600;

/** How a value is shown and stepped. */
export type ParamScale = 'linear' | 'log';

/** One continuous insert parameter as a control. */
export interface MasteringParamControl {
  /** Parameter name in the insert's params. */
  name: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  scale?: ParamScale;
}

/** One boolean insert parameter as a switch. */
export interface MasteringParamToggle {
  name: string;
  toggle: true;
}

export type MasteringParamSpec = MasteringParamControl | MasteringParamToggle;

/** A titled group of controls inside one module editor. */
export interface MasteringParamGroup {
  /** Copy key under `copy.groups`, or null for the module's only group. */
  group: 'main' | 'band0' | 'band1' | 'band2' | 'crossover' | 'detail';
  params: MasteringParamSpec[];
}

const db = (name: string, min: number, max: number, step = 0.1): MasteringParamControl => ({
  name,
  min,
  max,
  step,
  unit: 'dB',
});
const ms = (name: string, min: number, max: number, step = 0.1): MasteringParamControl => ({
  name,
  min,
  max,
  step,
  unit: 'ms',
  scale: min > 0 ? 'log' : 'linear',
});
const hz = (name: string, min: number, max: number): MasteringParamControl => ({
  name,
  min,
  max,
  step: 1,
  unit: 'Hz',
  scale: 'log',
});
const amount = (name: string, max = 1): MasteringParamControl => ({
  name,
  min: 0,
  max,
  step: 0.01,
  unit: '',
});
const ratio = (name: string): MasteringParamControl => ({
  name,
  min: 1,
  max: 10,
  step: 0.05,
  unit: ':1',
  scale: 'log',
});

function bandGroup(band: 0 | 1 | 2): MasteringParamGroup {
  return {
    group: `band${band}`,
    params: [
      db(`band${band}.thresholdDb`, -48, 0),
      ratio(`band${band}.ratio`),
      ms(`band${band}.attackMs`, 0.5, 100),
      ms(`band${band}.releaseMs`, 10, 1000, 1),
      db(`band${band}.makeupGainDb`, -12, 12),
    ],
  };
}

/**
 * Controls of each insert slot. The drive slot is written only by the loudness fit.
 */
export const MASTERING_SLOT_CONTROLS: Readonly<Record<MasteringSlotId, MasteringParamGroup[]>> = {
  input: [{ group: 'main', params: [db('levelDb', -24, 24)] }],
  tone: [{ group: 'main', params: [db('tiltDb', -6, 6, 0.05), hz('pivotHz', 200, 4000)] }],
  deesser: [
    {
      group: 'main',
      params: [
        hz('frequencyHz', 2000, 12000),
        db('thresholdDb', -48, 0),
        ratio('ratio'),
        db('rangeDb', 0, 24),
      ],
    },
    {
      group: 'detail',
      params: [ms('attackMs', 0.1, 20), ms('releaseMs', 10, 400, 1), amount('bandpassQ', 4)],
    },
  ],
  transient: [
    {
      group: 'main',
      params: [
        db('attackGainDb', -12, 12),
        db('sustainGainDb', -12, 12),
        amount('sensitivity'),
        db('maxGainDb', 0, 24),
      ],
    },
    { group: 'detail', params: [ms('lookaheadMs', 0, 10)] },
  ],
  compressor: [
    {
      group: 'main',
      params: [
        db('thresholdDb', -48, 0),
        ratio('ratio'),
        ms('attackMs', 0.1, 100),
        ms('releaseMs', 10, 1000, 1),
        db('kneeDb', 0, 18),
        db('makeupGainDb', -12, 12),
      ],
    },
    {
      group: 'detail',
      params: [
        { name: 'autoMakeup', toggle: true },
        { name: 'sidechainHpfEnabled', toggle: true },
        hz('sidechainHpfHz', 20, 400),
      ],
    },
  ],
  multiband: [
    bandGroup(0),
    bandGroup(1),
    bandGroup(2),
    { group: 'crossover', params: [hz('cutoff0Hz', 40, 1000), hz('cutoff1Hz', 1000, 12000)] },
  ],
  tape: [
    {
      group: 'main',
      params: [
        db('driveDb', 0, 18),
        amount('saturation'),
        amount('hysteresis'),
        db('outputGainDb', -12, 12),
      ],
    },
    {
      group: 'detail',
      params: [
        { name: 'speedIps', min: 7.5, max: 30, step: 0.5, unit: 'ips' },
        db('headBumpDb', 0, 6),
        amount('bias'),
        amount('gapLoss'),
      ],
    },
  ],
  exciter: [
    {
      group: 'main',
      params: [
        hz('frequencyHz', 1000, 16000),
        db('driveDb', 0, 18),
        amount('amount'),
        amount('evenOddMix'),
      ],
    },
    {
      group: 'detail',
      params: [{ name: 'q', min: 0.3, max: 4, step: 0.01, unit: '', scale: 'log' }],
    },
  ],
  air: [
    {
      group: 'main',
      params: [amount('amount'), hz('shelfFrequencyHz', 6000, 20000)],
    },
    { group: 'detail', params: [db('dynamicThresholdDb', -60, 0), db('dynamicRangeDb', 0, 12)] },
  ],
  stereo: [
    {
      group: 'main',
      params: [
        { name: 'width', min: 0, max: 2, step: 0.01, unit: '×' },
        amount('decorrelationAmount'),
        db('outputGainDb', -12, 12),
      ],
    },
  ],
  monoBass: [{ group: 'main', params: [amount('amount'), hz('frequencyHz', 40, 300)] }],
  drive: [],
  limiter: [
    {
      group: 'main',
      params: [
        { name: 'ceilingDb', min: -6, max: 0, step: 0.1, unit: 'dBTP' },
        ms('releaseMs', 5, 1000, 1),
      ],
    },
    { group: 'detail', params: [ms('lookaheadMs', 0.5, 10)] },
  ],
};

/** Rows of the Studio rack: the repair preprocess, the strip EQ, then the 13 inserts. */
export type MasteringModuleId = 'repair' | 'eq' | MasteringSlotId;

/** Slots with no bypass switch in the rack. */
export const MASTERING_FIXED_SLOTS: readonly MasteringSlotId[] = ['drive'];

/** Slots whose processor reports its own gain reduction under a driven signal. */
export const MASTERING_GR_SLOTS: readonly MasteringSlotId[] = [
  'deesser',
  'compressor',
  'multiband',
  'limiter',
];

/** Glossary page (under `/docs/glossary/`) of each rack module. */
export const MASTERING_MODULE_GUIDES: Readonly<Record<MasteringModuleId, string>> = {
  repair: 'mastering/repair',
  eq: 'mastering/tone-air',
  input: 'mastering/repair#input-gain',
  tone: 'mastering/tone-air#tilt-eq',
  deesser: 'mastering/dynamics',
  transient: 'mastering/dynamics',
  compressor: 'mastering/dynamics#threshold-ratio-attack-release-knee',
  multiband: 'mastering/dynamics#multiband-compression',
  tape: 'mastering/tone-air',
  exciter: 'mastering/tone-air#exciter-amount',
  air: 'mastering/tone-air#air-band-amount',
  stereo: 'mastering/stereo-limiter-loudness#stereo-width',
  monoBass: 'mastering/stereo-limiter-loudness#stereo-width',
  drive: 'mastering/stereo-limiter-loudness#loudness-target',
  limiter: 'mastering/stereo-limiter-loudness#true-peak-limiter',
};

/** A number for a readout: fixed digits, a true minus sign, `—` when not finite. */
export function formatNumber(value: number, digits = 1, signed = false): string {
  if (!Number.isFinite(value)) return '—';
  const text = Math.abs(value).toFixed(digits);
  if (Number(text) === 0) return (0).toFixed(digits);
  if (value < 0) return `−${text}`;
  return signed ? `+${text}` : text;
}

/** A parameter value with the precision its step implies. */
export function formatParam(value: number, step: number): string {
  const decimals = step >= 1 ? 0 : Math.min(3, Math.ceil(-Math.log10(step)));
  return formatNumber(value, decimals);
}
