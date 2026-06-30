import type {
  MasteringModuleSettings,
  MasteringPlatformId,
  MasteringPresetId,
} from '@/composables/useMastering';
import type { MasteringModuleSettingKey } from '@/utils/masteringUi';

export interface MasteringAssistantPreviewRow {
  ceilingRisk?: boolean;
  safeCeilingDb?: number;
}

export interface MasteringPresetOption {
  id: MasteringPresetId;
}

export interface ApplyMasteringAssistantSettingsOptions {
  currentSettings: MasteringModuleSettings;
  params: Record<string, unknown> | null;
  insightPreview: MasteringAssistantPreviewRow[];
  presets: readonly MasteringPresetOption[];
}

export interface ApplyMasteringAssistantSettingsResult {
  applied: boolean;
  moduleSettings: MasteringModuleSettings;
  selectedPlatform?: MasteringPlatformId;
  customLufs?: number;
  selectedPreset?: MasteringPresetId;
  activeModule?: string;
}

export function numericParam(params: Record<string, unknown>, key: string): number | null {
  const value = params[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function applyParam(
  next: MasteringModuleSettings,
  params: Record<string, unknown>,
  key: string,
  setting: MasteringModuleSettingKey,
  min: number,
  max: number,
) {
  const value = numericParam(params, key);
  if (value !== null) next[setting] = clamp(value, min, max);
}

export function normalizeAssistantPreset(
  value: unknown,
  presets: readonly MasteringPresetOption[],
): MasteringPresetId | null {
  if (typeof value !== 'string') return null;
  const normalized = value.toLowerCase().replace(/[-_\s]/g, '');
  const match = presets.find((preset) => preset.id.toLowerCase() === normalized);
  return match?.id ?? null;
}

export function assistantParamsFromSuggestions(
  suggestions: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  const chainConfig = suggestions?.chainConfig as Record<string, unknown> | undefined;
  const params = chainConfig?.params;
  return params && typeof params === 'object' ? (params as Record<string, unknown>) : null;
}

export function applyMasteringAssistantSettings({
  currentSettings,
  params,
  insightPreview,
  presets,
}: ApplyMasteringAssistantSettingsOptions): ApplyMasteringAssistantSettingsResult {
  if (!params && !insightPreview.some((row) => row.ceilingRisk)) {
    return { applied: false, moduleSettings: currentSettings };
  }

  const result: ApplyMasteringAssistantSettingsResult = {
    applied: true,
    moduleSettings: { ...currentSettings },
  };
  const next = result.moduleSettings;

  if (params) {
    applyParam(next, params, 'eq.tilt.tiltDb', 'tiltDb', -12, 12);
    applyParam(next, params, 'dynamics.compressor.thresholdDb', 'compressorThresholdDb', -40, 0);
    applyParam(next, params, 'dynamics.compressor.ratio', 'compressorRatio', 1, 10);
    applyParam(next, params, 'dynamics.compressor.attackMs', 'compressorAttackMs', 0.5, 100);
    applyParam(next, params, 'dynamics.compressor.releaseMs', 'compressorReleaseMs', 20, 600);
    applyParam(next, params, 'dynamics.transientShaper.attackGainDb', 'transientAttackDb', -6, 6);
    applyParam(next, params, 'spectral.airBand.amount', 'airBandAmount', 0, 1);
    applyParam(next, params, 'stereo.imager.width', 'stereoWidth', 0.6, 1.6);
    applyParam(next, params, 'stereo.monoMaker.amount', 'monoMakerAmount', 0, 1);
    applyParam(next, params, 'maximizer.truePeakLimiter.ceilingDb', 'limiterCeilingDb', -3, -0.1);
    applyParam(next, params, 'loudness.ceilingDb', 'limiterCeilingDb', -3, -0.1);
    applyParam(next, params, 'maximizer.truePeakLimiter.lookaheadMs', 'limiterLookaheadMs', 1, 20);

    const target = numericParam(params, 'loudness.targetLufs');
    if (target !== null) {
      result.selectedPlatform = 'custom';
      result.customLufs = clamp(target, -24, -8);
    }

    const candidates = params.genreCandidates;
    if (Array.isArray(candidates)) {
      const first = candidates[0] as Record<string, unknown> | undefined;
      const preset = normalizeAssistantPreset(first?.name, presets);
      if (preset) result.selectedPreset = preset;
    }
  }

  const safeCeiling = Math.min(
    ...insightPreview
      .filter((row) => row.ceilingRisk && Number.isFinite(row.safeCeilingDb))
      .map((row) => row.safeCeilingDb as number),
  );
  if (Number.isFinite(safeCeiling)) {
    next.limiterCeilingDb = Math.min(next.limiterCeilingDb, clamp(safeCeiling, -3, -0.1));
    result.activeModule = 'limiter';
  }

  return result;
}
