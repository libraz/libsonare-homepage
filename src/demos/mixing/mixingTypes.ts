/**
 * The v1 project-settings file (the page's earlier JSON format), validated
 * before `mixingProjectV1.ts` converts it to the current state.
 */
import { AUTOMATION_RANGES } from '@/demos/mixing/mixingConstants';

/** One v1 automation point; v1 kept every lane in one list keyed by `param`. */
export interface AutomationNode {
  id: string;
  param: string;
  timeSec: number;
  value: number;
  curve: string;
}

export interface SceneTrackSettings {
  id: string;
  name: string;
  offsetSeconds: number;
  inputTrimDb: number;
  faderDb: number;
  pan: number;
  width: number;
  panLaw?: number;
  panMode?: number;
  dualPanLeft?: number;
  dualPanRight?: number;
  channelDelayMs?: number;
  eqEnabled?: boolean;
  eqTiltDb?: number;
  eqAirDb?: number;
  reverbSendDb?: number;
  vcaGroup?: string;
  automation?: AutomationNode[];
  muted: boolean;
  soloed: boolean;
  soloSafe?: boolean;
  polarityLeft: boolean;
  polarityRight: boolean;
}

/** Settings that can be saved by the browser mixer without embedding audio. */
export interface MixingProjectSettings {
  version?: 1;
  masterFaderDb?: number;
  reverb?: {
    enabled?: boolean;
    decaySec?: number;
    preDelayMs?: number;
  };
  vcaGains?: Record<string, unknown>;
  tracks?: MixingProjectTrackSettings[];
}

/** A project may contain only the track controls it needs to restore. */
export type MixingProjectTrackSettings = Partial<SceneTrackSettings>;

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasUsableString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.hasOwn(value, key);
}

function validateProjectReverb(value: unknown): value is MixingProjectSettings['reverb'] {
  if (!isObjectRecord(value)) return false;
  if (hasOwn(value, 'enabled') && typeof value.enabled !== 'boolean') return false;
  if (hasOwn(value, 'decaySec') && !isFiniteNumber(value.decaySec)) return false;
  if (hasOwn(value, 'preDelayMs') && !isFiniteNumber(value.preDelayMs)) return false;
  return true;
}

function validateProjectVcaGains(value: unknown): value is Record<string, unknown> {
  return isObjectRecord(value) && Object.values(value).every(isFiniteNumber);
}

function validateProjectAutomation(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  return value.every((point) => {
    if (!isObjectRecord(point)) return false;
    if (typeof point.param !== 'string' || !Object.hasOwn(AUTOMATION_RANGES, point.param)) {
      return false;
    }
    if (hasOwn(point, 'id') && typeof point.id !== 'string') return false;
    if (hasOwn(point, 'timeSec') && !isFiniteNumber(point.timeSec)) return false;
    if (hasOwn(point, 'value') && !isFiniteNumber(point.value)) return false;
    if (hasOwn(point, 'curve') && typeof point.curve !== 'string') return false;
    return true;
  });
}

function validateProjectTrack(value: unknown): value is MixingProjectTrackSettings {
  if (!isObjectRecord(value)) return false;
  if (!hasUsableString(value.id) && !hasUsableString(value.name)) return false;

  for (const key of [
    'offsetSeconds',
    'inputTrimDb',
    'faderDb',
    'pan',
    'width',
    'panLaw',
    'panMode',
    'dualPanLeft',
    'dualPanRight',
    'channelDelayMs',
    'eqTiltDb',
    'eqAirDb',
    'reverbSendDb',
  ]) {
    if (hasOwn(value, key) && !isFiniteNumber(value[key])) return false;
  }
  for (const key of ['eqEnabled', 'muted', 'soloed', 'soloSafe', 'polarityLeft', 'polarityRight']) {
    if (hasOwn(value, key) && typeof value[key] !== 'boolean') return false;
  }
  for (const key of ['id', 'name', 'vcaGroup']) {
    if (hasOwn(value, key) && typeof value[key] !== 'string') return false;
  }
  if (hasOwn(value, 'automation') && !validateProjectAutomation(value.automation)) return false;
  return true;
}

/** Parse and validate the small UI project format before applying any state. */
export function parseMixingProjectSettings(value: unknown): MixingProjectSettings | null {
  if (!isObjectRecord(value)) return null;

  // The engine's scene format has a different root shape. Never apply it as UI settings.
  if (['strips', 'buses', 'connections'].some((key) => hasOwn(value, key))) return null;
  if (hasOwn(value, 'version') && value.version !== 1) return null;

  const payloadKeys = ['masterFaderDb', 'reverb', 'vcaGains', 'tracks'];
  if (!payloadKeys.some((key) => hasOwn(value, key))) return null;

  if (
    hasOwn(value, 'masterFaderDb') &&
    (typeof value.masterFaderDb !== 'number' || !Number.isFinite(value.masterFaderDb))
  ) {
    return null;
  }
  if (hasOwn(value, 'reverb') && !validateProjectReverb(value.reverb)) return null;
  if (hasOwn(value, 'vcaGains') && !validateProjectVcaGains(value.vcaGains)) return null;

  let tracks: MixingProjectTrackSettings[] | undefined;
  if (hasOwn(value, 'tracks')) {
    if (!Array.isArray(value.tracks)) return null;
    if (!value.tracks.every(validateProjectTrack)) return null;
    tracks = value.tracks as MixingProjectTrackSettings[];
  }

  const project: MixingProjectSettings = {};
  if (hasOwn(value, 'version')) project.version = 1;
  if (hasOwn(value, 'masterFaderDb')) project.masterFaderDb = value.masterFaderDb as number;
  if (hasOwn(value, 'reverb')) project.reverb = value.reverb as MixingProjectSettings['reverb'];
  if (hasOwn(value, 'vcaGains')) project.vcaGains = value.vcaGains as Record<string, unknown>;
  if (tracks) project.tracks = tracks;
  return project;
}
