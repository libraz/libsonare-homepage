import type { AutomationCurve, AutomationParam } from '@/workers/mixing.worker';

export const MAX_TRACKS = 8;
export const MAX_DURATION_SECONDS = 300;
export const REVERB_SEND_FLOOR = -60;
export const VCA_GROUP_IDS = ['A', 'B', 'C'] as const;

export const AUTOMATION_RANGES: Record<AutomationParam, { min: number; max: number }> = {
  fader: { min: -60, max: 12 },
  pan: { min: -1, max: 1 },
  width: { min: 0, max: 2 },
};

export const AUTOMATION_CURVES: AutomationCurve[] = ['linear', 'exponential', 'hold', 's-curve'];
export const AUTOMATION_PARAM_IDS: AutomationParam[] = ['fader', 'pan', 'width'];
