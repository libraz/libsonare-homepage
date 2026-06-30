import type { SynthPatch } from '@/wasm/index';

export const CUTOFF_MIN_HZ = 80;
export const CUTOFF_MAX_HZ = 16_000;
export const ATTACK_MIN_MS = 1;
export const ATTACK_MAX_MS = 2_000;
export const RELEASE_MIN_MS = 10;
export const RELEASE_MAX_MS = 5_000;

export type SynthTweakKey =
  | 'waveform'
  | 'filterModel'
  | 'cutoffHz'
  | 'resonanceQ'
  | 'ampAttackMs'
  | 'ampReleaseMs'
  | 'glideMs'
  | 'stereoSpread';

export interface SynthPatchControls {
  waveform: string;
  filterModel: string;
  cutoffNorm: number;
  resonanceQ: number;
  attackNorm: number;
  releaseNorm: number;
  glideMs: number;
  stereoSpread: number;
}

export interface SynthPatchBaseValues {
  cutoffNorm: number;
  resonanceQ: number;
  attackNorm: number;
  releaseNorm: number;
  glideMs: number;
  stereoSpread: number;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function logKnobHz(norm: number, min: number, max: number): number {
  return Math.round(min * (max / min) ** norm);
}

export function hzToNorm(hz: number, min: number, max: number): number {
  return clamp(Math.log(hz / min) / Math.log(max / min), 0, 1);
}

export function msLabel(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`;
}

export function controlsFromPreset(base: Partial<SynthPatch>): {
  controls: SynthPatchControls;
  baseValues: SynthPatchBaseValues;
} {
  const controls: SynthPatchControls = {
    waveform: String(base.waveform ?? 'default'),
    filterModel: String(base.filterModel ?? 'default'),
    cutoffNorm: hzToNorm(base.cutoffHz ?? CUTOFF_MAX_HZ, CUTOFF_MIN_HZ, CUTOFF_MAX_HZ),
    resonanceQ: clamp(base.resonanceQ ?? 0.7, 0.5, 12),
    attackNorm: hzToNorm(
      clamp(base.ampAttackMs ?? 1, ATTACK_MIN_MS, ATTACK_MAX_MS),
      ATTACK_MIN_MS,
      ATTACK_MAX_MS,
    ),
    releaseNorm: hzToNorm(
      clamp(base.ampReleaseMs ?? 300, RELEASE_MIN_MS, RELEASE_MAX_MS),
      RELEASE_MIN_MS,
      RELEASE_MAX_MS,
    ),
    glideMs: clamp(base.glideMs ?? 0, 0, 300),
    stereoSpread: clamp(base.stereoSpread ?? 0, 0, 1),
  };

  return {
    controls,
    baseValues: {
      cutoffNorm: controls.cutoffNorm,
      resonanceQ: controls.resonanceQ,
      attackNorm: controls.attackNorm,
      releaseNorm: controls.releaseNorm,
      glideMs: controls.glideMs,
      stereoSpread: controls.stereoSpread,
    },
  };
}

export function buildSynthPatch(
  preset: string,
  dirtyTweaks: Set<SynthTweakKey>,
  controls: SynthPatchControls,
): string | SynthPatch {
  if (dirtyTweaks.size === 0) return preset;

  const patch: SynthPatch = { preset };
  for (const key of dirtyTweaks) {
    if (key === 'waveform') patch.waveform = controls.waveform as SynthPatch['waveform'];
    else if (key === 'filterModel')
      patch.filterModel = controls.filterModel as SynthPatch['filterModel'];
    else if (key === 'cutoffHz')
      patch.cutoffHz = logKnobHz(controls.cutoffNorm, CUTOFF_MIN_HZ, CUTOFF_MAX_HZ);
    else if (key === 'resonanceQ') patch.resonanceQ = controls.resonanceQ;
    else if (key === 'ampAttackMs')
      patch.ampAttackMs = logKnobHz(controls.attackNorm, ATTACK_MIN_MS, ATTACK_MAX_MS);
    else if (key === 'ampReleaseMs')
      patch.ampReleaseMs = logKnobHz(controls.releaseNorm, RELEASE_MIN_MS, RELEASE_MAX_MS);
    else if (key === 'glideMs') patch.glideMs = controls.glideMs;
    else if (key === 'stereoSpread') patch.stereoSpread = controls.stereoSpread;
  }
  return patch;
}
