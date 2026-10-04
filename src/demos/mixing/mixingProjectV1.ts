/**
 * Reads a mixing project file of either version. v2 is the state itself; a v1
 * settings file (validated by `parseMixingProjectSettings`, so it is rejected
 * or accepted exactly as before) is converted onto the current tracks with the
 * v1 rules: tracks match by id or name, supplied tracks take defaults for what
 * they omit, values are clamped to the v1 ranges, and omitted top-level
 * settings keep the current ones.
 *
 * v1 tone becomes strip EQ: the tilt is the two-shelf pair `eq.tilt` itself is
 * built from (low shelf -tilt/2, high shelf +tilt/2 at its pivot), and the air
 * lift a high shelf at the air band's shelf frequency in the second Peak slot.
 * The reverb send becomes the REVERB send; a disabled v1 reverb turns those
 * sends off. Decay time becomes the plate's live `decay`.
 */
import {
  AUTOMATION_RANGES,
  MAX_DURATION_SECONDS,
  VCA_GROUP_IDS,
} from '@/demos/mixing/mixingConstants';
import {
  AUTOMATION_CURVES,
  AUTOMATION_PARAMS,
  type AutomationCurve,
  type AutomationParam,
  type AutomationPoint,
  createTrackState,
  defaultEqBands,
  type MixingState,
  type MixTrackState,
  parseMixingState,
  plateDecayFromSeconds,
  SEND_OFF_DB,
  type StripEqBand,
  type VcaGroupId,
} from '@/demos/mixing/mixingState';
import {
  type MixingProjectSettings,
  type MixingProjectTrackSettings,
  parseMixingProjectSettings,
} from '@/demos/mixing/mixingTypes';
import { clamp } from '@/utils/scale';

/** `eq.tilt`'s default pivot; a test pins it to the engine. */
export const V1_TILT_PIVOT_HZ = 1000;
/** `spectral.airBand`'s default shelf frequency; a test pins it to the engine. */
export const V1_AIR_SHELF_HZ = 12000;
/** Strip EQ slots the v1 tone lands in. */
const LOW_SHELF_SLOT = 1;
const AIR_SLOT = 3;
const HIGH_SHELF_SLOT = 4;

export interface MixingProjectLoad {
  state: MixingState;
  /** Version of the file that was read. */
  fromVersion: 1 | 2;
  /** v1 track entries (id or name) that matched no current track. */
  unmatched: string[];
}

function v1Eq(setting: MixingProjectTrackSettings): StripEqBand[] {
  const eq = defaultEqBands();
  if (!setting.eqEnabled) return eq;
  const tilt = clamp(setting.eqTiltDb ?? 0, -12, 12);
  const air = clamp(setting.eqAirDb ?? 0, 0, 12);
  if (tilt !== 0) {
    const shelf = (type: StripEqBand['type'], gainDb: number): StripEqBand => ({
      type,
      frequencyHz: V1_TILT_PIVOT_HZ,
      gainDb,
      q: Math.SQRT1_2,
      enabled: true,
    });
    eq[LOW_SHELF_SLOT] = shelf('LowShelf', -tilt / 2);
    eq[HIGH_SHELF_SLOT] = shelf('HighShelf', tilt / 2);
  }
  if (air > 0) {
    eq[AIR_SLOT] = {
      type: 'HighShelf',
      frequencyHz: V1_AIR_SHELF_HZ,
      gainDb: air,
      q: Math.SQRT1_2,
      enabled: true,
    };
  }
  return eq;
}

/** A v1 automation entry as `parseMixingProjectSettings` admits it: one list for every parameter. */
interface V1AutomationPoint {
  param: string;
  timeSec?: number;
  value?: number;
  curve?: string;
}

function v1Automation(
  setting: MixingProjectTrackSettings,
): Record<AutomationParam, AutomationPoint[]> {
  const lanes: Record<AutomationParam, AutomationPoint[]> = { fader: [], pan: [], width: [] };
  const points = (setting.automation ?? []) as unknown as V1AutomationPoint[];
  points.forEach((point, i) => {
    const param = point.param as AutomationParam;
    if (!AUTOMATION_PARAMS.includes(param)) return;
    const range = AUTOMATION_RANGES[param];
    lanes[param].push({
      id: `v1-${param}-${i}`,
      timeSec: Math.max(0, point.timeSec ?? 0),
      value: clamp(point.value ?? 0, range.min, range.max),
      curve: AUTOMATION_CURVES.includes(point.curve as AutomationCurve)
        ? (point.curve as AutomationCurve)
        : 'linear',
    });
  });
  for (const param of AUTOMATION_PARAMS) lanes[param].sort((a, b) => a.timeSec - b.timeSec);
  return lanes;
}

function v1Track(
  track: MixTrackState,
  setting: MixingProjectTrackSettings,
  reverbEnabled: boolean,
): MixTrackState {
  const fresh = createTrackState(track.id, setting.name || track.name, track.sourceDurationSec);
  const vca = VCA_GROUP_IDS.includes(setting.vcaGroup as VcaGroupId)
    ? (setting.vcaGroup as VcaGroupId)
    : null;
  return {
    ...fresh,
    clip: {
      ...fresh.clip,
      startSec: clamp(
        setting.offsetSeconds ?? 0,
        0,
        Math.max(0, MAX_DURATION_SECONDS - track.sourceDurationSec),
      ),
    },
    faderDb: clamp(setting.faderDb ?? 0, -60, 12),
    pan: clamp(setting.pan ?? 0, -1, 1),
    panLaw: clamp(Math.round(setting.panLaw ?? 0), 0, 3),
    panMode: clamp(Math.round(setting.panMode ?? 0), 0, 2),
    dualPanLeft: clamp(setting.dualPanLeft ?? -1, -1, 1),
    dualPanRight: clamp(setting.dualPanRight ?? 1, -1, 1),
    channelDelayMs: clamp(setting.channelDelayMs ?? 0, 0, 50),
    polarityLeft: Boolean(setting.polarityLeft),
    polarityRight: Boolean(setting.polarityRight),
    muted: Boolean(setting.muted),
    soloed: Boolean(setting.soloed),
    soloSafe: Boolean(setting.soloSafe),
    vcaGroup: vca,
    eq: v1Eq(setting),
    slots: {
      ...fresh.slots,
      trim: { bypassed: false, params: { levelDb: clamp(setting.inputTrimDb ?? 0, -24, 24) } },
      width: { bypassed: false, params: { width: clamp(setting.width ?? 1, 0, 2) } },
    },
    sends: {
      ...fresh.sends,
      reverb: {
        levelDb: reverbEnabled
          ? clamp(setting.reverbSendDb ?? SEND_OFF_DB, SEND_OFF_DB, 0)
          : SEND_OFF_DB,
        timing: 'postFader',
      },
    },
    automation: v1Automation(setting),
  };
}

/** Converts validated v1 settings onto `base`, which supplies the tracks and the omitted settings. */
export function convertMixingProjectV1(
  settings: MixingProjectSettings,
  base: MixingState,
): MixingProjectLoad {
  const reverbEnabled = settings.reverb ? Boolean(settings.reverb.enabled) : true;
  const matched = new Set<MixingProjectTrackSettings>();
  const tracks = base.tracks.map((track) => {
    const setting = settings.tracks?.find(
      (entry) =>
        !matched.has(entry) && (entry.id === String(track.id) || entry.name === track.name),
    );
    if (!setting) return track;
    matched.add(setting);
    return v1Track(track, setting, reverbEnabled);
  });
  const state: MixingState = { ...base, tracks };
  if (settings.masterFaderDb !== undefined) {
    state.master = { ...base.master, faderDb: clamp(settings.masterFaderDb, -24, 12) };
  }
  if (settings.reverb) {
    state.buses = {
      ...base.buses,
      reverb: {
        ...base.buses.reverb,
        params: {
          ...base.buses.reverb.params,
          decay: plateDecayFromSeconds(clamp(settings.reverb.decaySec ?? 2.2, 0.2, 8)),
          preDelayMs: clamp(settings.reverb.preDelayMs ?? 20, 0, 120),
        },
      },
    };
  }
  if (settings.vcaGains) {
    const gains = { ...base.vcaGains };
    for (const id of VCA_GROUP_IDS) {
      const gain = settings.vcaGains[id];
      if (typeof gain === 'number') gains[id] = clamp(gain, -24, 12);
    }
    state.vcaGains = gains;
  }
  return {
    state,
    fromVersion: 1,
    unmatched: (settings.tracks ?? [])
      .filter((entry) => !matched.has(entry))
      .map((entry) => entry.id ?? entry.name ?? ''),
  };
}

/** Reads a v2 project, or converts a v1 one onto `base`; `null` when the file is neither. */
export function parseMixingProject(value: unknown, base: MixingState): MixingProjectLoad | null {
  let source = value;
  if (typeof value === 'string') {
    try {
      source = JSON.parse(value);
    } catch {
      return null;
    }
  }
  const v2 = parseMixingState(source);
  if (v2) return { state: v2, fromVersion: 2, unmatched: [] };
  const v1 = parseMixingProjectSettings(source);
  return v1 ? convertMixingProjectV1(v1, base) : null;
}
