import {
  AUTOMATION_CURVES,
  AUTOMATION_RANGES,
  MAX_DURATION_SECONDS,
  REVERB_SEND_FLOOR,
  VCA_GROUP_IDS,
} from '@/components/mixing/mixingConstants';
import type { MixTrack, SceneTrackSettings } from '@/components/mixing/mixingTypes';
import type { DecodedStereoAudio } from '@/utils/audio';
import { downsampleWaveform } from '@/utils/audio';
import { buildSceneJson, type SceneStripInput } from '@/utils/mixingScene';
import { clamp } from '@/utils/scale';
import type {
  AutomationCurve,
  AutomationParam,
  MixingTrackRenderState,
} from '@/workers/mixing.worker';

export function createMixTrack(
  fileName: string,
  audio: DecodedStereoAudio,
  index: number,
): MixTrack {
  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return {
    id,
    name: fileName.replace(/\.[^.]+$/, ''),
    audio,
    waveform: downsampleWaveform(audio.left, audio.right, 220),
    offsetSeconds: index ? Math.min(MAX_DURATION_SECONDS - audio.duration, index * 2) : 0,
    inputTrimDb: 0,
    faderDb: 0,
    pan: 0,
    width: 1,
    panLaw: 0,
    panMode: 0,
    dualPanLeft: -1,
    dualPanRight: 1,
    channelDelayMs: 0,
    eqEnabled: false,
    eqTiltDb: 0,
    eqAirDb: 0,
    reverbSendDb: REVERB_SEND_FLOOR,
    vcaGroup: '',
    automation: [],
    muted: false,
    soloed: false,
    soloSafe: false,
    polarityLeft: false,
    polarityRight: false,
  };
}

export function resetMixTrack(track: MixTrack) {
  track.inputTrimDb = 0;
  track.faderDb = 0;
  track.pan = 0;
  track.width = 1;
  track.panLaw = 0;
  track.panMode = 0;
  track.dualPanLeft = -1;
  track.dualPanRight = 1;
  track.channelDelayMs = 0;
  track.eqEnabled = false;
  track.eqTiltDb = 0;
  track.eqAirDb = 0;
  track.reverbSendDb = REVERB_SEND_FLOOR;
  track.vcaGroup = '';
  track.automation = [];
  track.offsetSeconds = 0;
  track.muted = false;
  track.soloed = false;
  track.soloSafe = false;
  track.polarityLeft = false;
  track.polarityRight = false;
}

export function toSceneTrack(track: MixTrack): SceneTrackSettings {
  return {
    id: track.id,
    name: track.name,
    inputTrimDb: track.inputTrimDb,
    faderDb: track.faderDb,
    pan: track.pan,
    width: track.width,
    panLaw: track.panLaw,
    panMode: track.panMode,
    dualPanLeft: track.dualPanLeft,
    dualPanRight: track.dualPanRight,
    channelDelayMs: track.channelDelayMs,
    eqEnabled: track.eqEnabled,
    eqTiltDb: track.eqTiltDb,
    eqAirDb: track.eqAirDb,
    reverbSendDb: track.reverbSendDb,
    vcaGroup: track.vcaGroup,
    automation: track.automation.map((point) => ({ ...point })),
    offsetSeconds: track.offsetSeconds,
    muted: track.muted,
    soloed: track.soloed,
    soloSafe: track.soloSafe,
    polarityLeft: track.polarityLeft,
    polarityRight: track.polarityRight,
  };
}

export function applySceneTrack(track: MixTrack, setting: SceneTrackSettings) {
  track.name = setting.name || track.name;
  track.inputTrimDb = clamp(setting.inputTrimDb ?? 0, -24, 24);
  track.faderDb = clamp(setting.faderDb ?? 0, -60, 12);
  track.pan = clamp(setting.pan ?? 0, -1, 1);
  track.width = clamp(setting.width ?? 1, 0, 2);
  track.panLaw = clamp(Math.round(setting.panLaw ?? 0), 0, 3);
  track.panMode = clamp(Math.round(setting.panMode ?? 0), 0, 2);
  track.dualPanLeft = clamp(setting.dualPanLeft ?? -1, -1, 1);
  track.dualPanRight = clamp(setting.dualPanRight ?? 1, -1, 1);
  track.channelDelayMs = clamp(setting.channelDelayMs ?? 0, 0, 50);
  track.eqEnabled = Boolean(setting.eqEnabled);
  track.eqTiltDb = clamp(setting.eqTiltDb ?? 0, -12, 12);
  track.eqAirDb = clamp(setting.eqAirDb ?? 0, 0, 12);
  track.reverbSendDb = clamp(setting.reverbSendDb ?? REVERB_SEND_FLOOR, REVERB_SEND_FLOOR, 0);
  track.vcaGroup = VCA_GROUP_IDS.includes(setting.vcaGroup as (typeof VCA_GROUP_IDS)[number])
    ? setting.vcaGroup!
    : '';
  track.automation = Array.isArray(setting.automation)
    ? setting.automation
        .filter((point) => point && point.param in AUTOMATION_RANGES)
        .map((point) => {
          const param = point.param as AutomationParam;
          return {
            id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            param,
            timeSec: Math.max(0, point.timeSec ?? 0),
            value: clamp(
              point.value ?? 0,
              AUTOMATION_RANGES[param].min,
              AUTOMATION_RANGES[param].max,
            ),
            curve: AUTOMATION_CURVES.includes(point.curve as AutomationCurve)
              ? point.curve
              : 'linear',
          };
        })
    : [];
  track.offsetSeconds = clamp(
    setting.offsetSeconds ?? 0,
    0,
    Math.max(0, MAX_DURATION_SECONDS - track.audio.duration),
  );
  track.muted = Boolean(setting.muted);
  track.soloed = Boolean(setting.soloed);
  track.soloSafe = Boolean(setting.soloSafe);
  track.polarityLeft = Boolean(setting.polarityLeft);
  track.polarityRight = Boolean(setting.polarityRight);
}

export function toRenderTrack(track: MixTrack): MixingTrackRenderState {
  return {
    id: track.id,
    name: track.name,
    left: new Float32Array(track.audio.left),
    right: new Float32Array(track.audio.right),
    inputTrimDb: track.inputTrimDb,
    faderDb: track.faderDb,
    pan: track.pan,
    width: track.width,
    panLaw: track.panLaw,
    panMode: track.panMode,
    dualPanLeft: track.dualPanLeft,
    dualPanRight: track.dualPanRight,
    channelDelaySamples: Math.round(
      (track.channelDelayMs / 1000) * (track.audio.sampleRate || 48000),
    ),
    eqEnabled: track.eqEnabled,
    eqTiltDb: track.eqTiltDb,
    eqAirDb: track.eqAirDb,
    reverbSendDb: track.reverbSendDb,
    vcaGroup: track.vcaGroup,
    automation: track.automation
      .slice()
      .sort((a, b) => a.timeSec - b.timeSec)
      .map(({ param, timeSec, value, curve }) => ({ param, timeSec, value, curve })),
    offsetSeconds: track.offsetSeconds,
    muted: track.muted,
    soloed: track.soloed,
    soloSafe: track.soloSafe,
    polarityLeft: track.polarityLeft,
    polarityRight: track.polarityRight,
  };
}

export function toSceneStrip(track: MixTrack): SceneStripInput {
  return {
    id: track.id,
    inputTrimDb: track.inputTrimDb,
    faderDb: track.faderDb,
    pan: track.pan,
    width: track.width,
    panLaw: track.panLaw,
    panMode: track.panMode,
    dualPanLeft: track.dualPanLeft,
    dualPanRight: track.dualPanRight,
    channelDelaySamples: Math.round(
      (track.channelDelayMs / 1000) * (track.audio.sampleRate || 48000),
    ),
    eqEnabled: track.eqEnabled,
    eqTiltDb: track.eqTiltDb,
    eqAirDb: track.eqAirDb,
    reverbSendDb: track.reverbSendDb,
    vcaGroup: track.vcaGroup,
    polarityLeft: track.polarityLeft,
    polarityRight: track.polarityRight,
  };
}

export function buildCurrentSceneJson(
  tracks: MixTrack[],
  reverb: { enabled: boolean; decaySec: number; preDelayMs: number },
  vcaGains: Record<string, number>,
): string {
  const strips = tracks.map(toSceneStrip);
  const groups = VCA_GROUP_IDS.map((id) => ({ id, gainDb: vcaGains[id] }));
  return buildSceneJson(strips, { ...reverb }, groups);
}

export function currentGates(tracks: MixTrack[]): boolean[] {
  const soloActive = tracks.some((track) => track.soloed);
  return tracks.map((track) => (soloActive ? track.soloed || track.soloSafe : !track.muted));
}
