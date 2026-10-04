import type { AutomationParam } from '@/demos/mixing/mixingState';

export const MAX_TRACKS = 8;
export const MAX_DURATION_SECONDS = 300;
export const VCA_GROUP_IDS = ['A', 'B', 'C'] as const;

/** Value range of each automation lane, in the lane's own unit (dB, pan, width). */
export const AUTOMATION_RANGES: Record<AutomationParam, { min: number; max: number }> = {
  fader: { min: -60, max: 12 },
  pan: { min: -1, max: 1 },
  width: { min: 0, max: 2 },
};
