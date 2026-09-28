import type { MasteringModuleSettingKey } from '@/demos/mastering/masteringUi';
import type { MasteringModuleSettings } from '@/demos/mastering/useMastering';
import { clamp } from '@/utils/scale';

export interface MasteringAssistantPreviewRow {
  ceilingRisk?: boolean;
  safeCeilingDb?: number;
}

export interface ApplyMasteringAssistantSettingsOptions {
  currentSettings: MasteringModuleSettings;
  params: Record<string, unknown> | null;
  insightPreview: MasteringAssistantPreviewRow[];
}

export interface ApplyMasteringAssistantSettingsResult {
  applied: boolean;
  moduleSettings: MasteringModuleSettings;
  activeModule?: string;
}

export function numericParam(params: Record<string, unknown>, key: string): number | null {
  const value = params[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
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

function applyTighterCeiling(
  next: MasteringModuleSettings,
  params: Record<string, unknown>,
  key: string,
) {
  const value = numericParam(params, key);
  if (value !== null) {
    next.limiterCeilingDb = Math.min(next.limiterCeilingDb, clamp(value, -3, -0.1));
  }
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
    applyTighterCeiling(next, params, 'maximizer.truePeakLimiter.ceilingDb');
    applyTighterCeiling(next, params, 'loudness.ceilingDb');
    applyParam(next, params, 'maximizer.truePeakLimiter.lookaheadMs', 'limiterLookaheadMs', 1, 20);
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
