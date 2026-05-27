import type {
  MasteringModuleSettings,
  MasteringPlatformId,
  MasteringPresetId,
} from '@/composables/useMastering';

export type MasteringMode = 'quick' | 'studio';
export type MasteringModuleSettingKey = keyof MasteringModuleSettings;

export interface MasteringSessionSettings {
  mode: MasteringMode;
  selectedPreset: MasteringPresetId;
  selectedPlatform: MasteringPlatformId;
  customLufs: number;
  tone: number;
  width: number;
  dynamics: number;
  showFineTune: boolean;
  activeModule: string;
  loudnessMatched: boolean;
  moduleSettings: MasteringModuleSettings;
}

export interface MasteringModuleControl {
  key: MasteringModuleSettingKey;
  min: number;
  max: number;
  step: number;
  unit: string;
}

export const MASTERING_PRESETS: Array<{ id: MasteringPresetId; icon: string }> = [
  { id: 'pop', icon: 'POP' },
  { id: 'edm', icon: 'EDM' },
  { id: 'acoustic', icon: 'AC' },
  { id: 'hiphop', icon: 'HH' },
  { id: 'aiMusic', icon: 'AI' },
  { id: 'speech', icon: 'VO' },
];

export const MASTERING_PLATFORMS: Array<{ id: MasteringPlatformId; lufs: number }> = [
  { id: 'spotify', lufs: -14 },
  { id: 'youtube', lufs: -14 },
  { id: 'apple', lufs: -16 },
  { id: 'tiktok', lufs: -16 },
  { id: 'custom', lufs: -14 },
];

export const MASTERING_MODULES = [
  'input',
  'repair',
  'eq',
  'dynamics',
  'multiband',
  'exciter',
  'stereo',
  'limiter',
  'loudness',
  'output',
];

export const MASTERING_METER_TARGETS: Record<string, string> = {
  lufs: 'loudness',
  peak: 'limiter',
  crest: 'dynamics',
  correlation: 'stereo',
};

export const MASTERING_PARAMETER_GUIDE_SLUGS: Partial<
  Record<MasteringModuleSettingKey | 'tone' | 'width' | 'dynamics', string>
> = {
  tone: 'mastering/tone-air#tilt-eq',
  width: 'mastering/stereo-limiter-loudness#stereo-width',
  dynamics: 'mastering/dynamics#threshold-ratio-attack-release-knee',
  inputGainDb: 'mastering/repair#input-gain',
  tiltDb: 'mastering/tone-air#tilt-eq',
  compressorThresholdDb: 'mastering/dynamics#threshold-ratio-attack-release-knee',
  compressorRatio: 'mastering/dynamics#threshold-ratio-attack-release-knee',
  compressorAttackMs: 'mastering/dynamics#attack-and-release',
  compressorReleaseMs: 'mastering/dynamics#attack-and-release',
  deesserAmount: 'mastering/dynamics',
  transientAttackDb: 'mastering/dynamics',
  multibandLowAmount: 'mastering/dynamics',
  multibandMidAmount: 'mastering/dynamics',
  multibandHighAmount: 'mastering/dynamics',
  denoiseAmount: 'mastering/repair#denoise-amount',
  declickAmount: 'mastering/repair',
  dereverbAmount: 'mastering/repair',
  tapeDriveDb: 'mastering/tone-air',
  tapeSaturation: 'mastering/tone-air',
  exciterAmount: 'mastering/tone-air#exciter-amount',
  airBandAmount: 'mastering/tone-air#air-band-amount',
  stereoWidth: 'mastering/stereo-limiter-loudness#stereo-width',
  monoMakerAmount: 'mastering/stereo-limiter-loudness#stereo-width',
  limiterCeilingDb: 'mastering/stereo-limiter-loudness#limiter-ceiling',
  limiterLookaheadMs: 'mastering/stereo-limiter-loudness#lookahead-and-true-peak-safety',
};

export const MASTERING_MODULE_GUIDE_SLUGS: Record<string, string> = {
  input: 'mastering/repair#input-gain',
  repair: 'mastering/repair',
  eq: 'mastering/tone-air#tilt-eq',
  dynamics: 'mastering/dynamics',
  multiband: 'mastering/dynamics',
  exciter: 'mastering/tone-air',
  stereo: 'mastering/stereo-limiter-loudness#stereo-width',
  limiter: 'mastering/stereo-limiter-loudness#true-peak-limiter',
  loudness: 'mastering/stereo-limiter-loudness#loudness-target',
  output: 'mastering/stereo-limiter-loudness#output-render',
};

export function moduleControlsFor(moduleId: string): MasteringModuleControl[] {
  switch (moduleId) {
    case 'input':
      return [{ key: 'inputGainDb', min: -12, max: 12, step: 0.5, unit: 'dB' }];
    case 'repair':
      return [
        { key: 'denoiseAmount', min: 0, max: 1, step: 0.01, unit: '' },
        { key: 'declickAmount', min: 0, max: 1, step: 0.01, unit: '' },
        { key: 'dereverbAmount', min: 0, max: 1, step: 0.01, unit: '' },
      ];
    case 'eq':
      return [{ key: 'tiltDb', min: -6, max: 6, step: 0.25, unit: 'dB' }];
    case 'dynamics':
      return [
        { key: 'compressorThresholdDb', min: -36, max: -6, step: 0.5, unit: 'dB' },
        { key: 'compressorRatio', min: 1, max: 6, step: 0.1, unit: 'x' },
        { key: 'compressorAttackMs', min: 1, max: 80, step: 1, unit: 'ms' },
        { key: 'compressorReleaseMs', min: 40, max: 500, step: 5, unit: 'ms' },
        { key: 'deesserAmount', min: 0, max: 1, step: 0.01, unit: '' },
        { key: 'transientAttackDb', min: -6, max: 6, step: 0.25, unit: 'dB' },
      ];
    case 'multiband':
      return [
        { key: 'multibandLowAmount', min: 0, max: 1, step: 0.01, unit: '' },
        { key: 'multibandMidAmount', min: 0, max: 1, step: 0.01, unit: '' },
        { key: 'multibandHighAmount', min: 0, max: 1, step: 0.01, unit: '' },
      ];
    case 'exciter':
      return [
        { key: 'tapeDriveDb', min: 0, max: 8, step: 0.25, unit: 'dB' },
        { key: 'tapeSaturation', min: 0, max: 1, step: 0.01, unit: '' },
        { key: 'exciterAmount', min: 0, max: 0.8, step: 0.01, unit: '' },
        { key: 'airBandAmount', min: 0, max: 1, step: 0.01, unit: '' },
      ];
    case 'stereo':
      return [
        { key: 'stereoWidth', min: 0.6, max: 1.6, step: 0.01, unit: 'x' },
        { key: 'monoMakerAmount', min: 0, max: 1, step: 0.01, unit: '' },
      ];
    case 'limiter':
      return [
        { key: 'limiterCeilingDb', min: -3, max: -0.1, step: 0.1, unit: 'dBTP' },
        { key: 'limiterLookaheadMs', min: 1, max: 20, step: 0.5, unit: 'ms' },
      ];
    default:
      return [];
  }
}
