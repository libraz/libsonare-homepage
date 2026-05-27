import type { DecodedStereoAudio, WaveformPeak } from '@/utils/audio';
import type { AutomationPoint, MixingBounceResult } from '@/workers/mixing.worker';

export interface AutomationNode extends AutomationPoint {
  id: string;
}

export type MixingWorkerMessage =
  | { type: 'progress'; id: number; progress: number; stage: string }
  | { type: 'done'; id: number; result: MixingBounceResult }
  | { type: 'error'; id: number; error: string; recoverable?: boolean };

export interface MixTrack {
  id: string;
  name: string;
  audio: DecodedStereoAudio;
  waveform: WaveformPeak[];
  offsetSeconds: number;
  inputTrimDb: number;
  faderDb: number;
  pan: number;
  width: number;
  panLaw: number;
  panMode: number;
  dualPanLeft: number;
  dualPanRight: number;
  channelDelayMs: number;
  eqEnabled: boolean;
  eqTiltDb: number;
  eqAirDb: number;
  reverbSendDb: number;
  vcaGroup: string;
  automation: AutomationNode[];
  muted: boolean;
  soloed: boolean;
  soloSafe: boolean;
  polarityLeft: boolean;
  polarityRight: boolean;
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
