import type { Ref } from 'vue';
import type {
  MasteringModuleSettings,
  MasteringPlatformId,
  MasteringPresetId,
  MasteringVenueId,
} from '@/composables/useMastering';
import { clamp } from '@/utils/masteringMetrics';
import {
  MASTERING_MODULES,
  MASTERING_PLATFORMS,
  MASTERING_PRESETS,
  MASTERING_VENUES,
  type MasteringMode,
  type MasteringSessionSettings,
  moduleControlsFor,
} from '@/utils/masteringUi';

const sessionStorageKey = 'libsonare-mastering-session-v1';
const chainPresetStorageKey = 'libsonare-mastering-chain-preset-v1';
const MAX_CHAIN_SETTINGS_BYTES = 1_000_000;
const MODULE_RANGES = new Map(
  MASTERING_MODULES.flatMap((moduleId) => moduleControlsFor(moduleId)).map((control) => [
    control.key,
    { min: control.min, max: control.max },
  ]),
);

interface MasteringSessionRefs {
  mode: Ref<MasteringMode>;
  selectedPreset: Ref<MasteringPresetId>;
  selectedVenue: Ref<MasteringVenueId>;
  selectedPlatform: Ref<MasteringPlatformId>;
  customLufs: Ref<number>;
  tone: Ref<number>;
  width: Ref<number>;
  dynamics: Ref<number>;
  showFineTune: Ref<boolean>;
  activeModule: Ref<string>;
  loudnessMatched: Ref<boolean>;
  moduleSettings: Ref<MasteringModuleSettings>;
  chainSettingsUrl: Ref<string | null>;
  localError: Ref<string | null>;
  t: (key: string) => string;
}

export function useMasteringSession(state: MasteringSessionRefs) {
  function currentSessionSettings(): MasteringSessionSettings {
    return {
      mode: state.mode.value,
      selectedPreset: state.selectedPreset.value,
      selectedVenue: state.selectedVenue.value,
      selectedPlatform: state.selectedPlatform.value,
      customLufs: state.customLufs.value,
      tone: state.tone.value,
      width: state.width.value,
      dynamics: state.dynamics.value,
      showFineTune: state.showFineTune.value,
      activeModule: state.activeModule.value,
      loudnessMatched: state.loudnessMatched.value,
      moduleSettings: { ...state.moduleSettings.value },
    };
  }

  function applySessionSettings(settings: Partial<MasteringSessionSettings>) {
    if (settings.mode === 'quick' || settings.mode === 'studio') state.mode.value = settings.mode;
    if (isMasteringPresetId(settings.selectedPreset))
      state.selectedPreset.value = settings.selectedPreset;
    if (isMasteringVenueId(settings.selectedVenue))
      state.selectedVenue.value = settings.selectedVenue;
    if (isMasteringPlatformId(settings.selectedPlatform))
      state.selectedPlatform.value = settings.selectedPlatform;
    if (Number.isFinite(settings.customLufs))
      state.customLufs.value = clamp(Number(settings.customLufs), -24, -8);
    if (Number.isFinite(settings.tone)) state.tone.value = clamp(Number(settings.tone), 0, 100);
    if (Number.isFinite(settings.width)) state.width.value = clamp(Number(settings.width), 0, 100);
    if (Number.isFinite(settings.dynamics))
      state.dynamics.value = clamp(Number(settings.dynamics), 0, 100);
    if (typeof settings.showFineTune === 'boolean')
      state.showFineTune.value = settings.showFineTune;
    if (settings.activeModule && MASTERING_MODULES.includes(settings.activeModule))
      state.activeModule.value = settings.activeModule;
    if (typeof settings.loudnessMatched === 'boolean')
      state.loudnessMatched.value = settings.loudnessMatched;
    if (settings.moduleSettings && typeof settings.moduleSettings === 'object') {
      const current = state.moduleSettings.value;
      const incoming = settings.moduleSettings as unknown as Record<string, unknown>;
      const next = { ...current };
      for (const key of Object.keys(current) as (keyof MasteringModuleSettings)[]) {
        const value = incoming[key];
        const range = MODULE_RANGES.get(key);
        if (typeof value !== 'number' || !Number.isFinite(value) || !range) continue;
        next[key] = clamp(value, range.min, range.max);
      }
      state.moduleSettings.value = next;
    }
  }

  function saveSession() {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.setItem(sessionStorageKey, JSON.stringify(currentSessionSettings()));
    } catch {
      // Storage can be unavailable in private mode; session persistence is optional.
    }
  }

  function restoreSession() {
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(sessionStorageKey);
    } catch {
      return;
    }
    if (!raw) return;
    try {
      applySessionSettings(JSON.parse(raw));
    } catch {
      sessionStorage.removeItem(sessionStorageKey);
    }
  }

  function saveChainPreset() {
    try {
      localStorage.setItem(chainPresetStorageKey, JSON.stringify(currentSessionSettings()));
      state.localError.value = null;
    } catch {
      state.localError.value = state.t('master.errors.presetSaveFailed');
    }
  }

  function loadChainPreset() {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(chainPresetStorageKey);
    } catch {
      state.localError.value = state.t('master.errors.presetLoadFailed');
      return;
    }
    if (!raw) {
      state.localError.value = state.t('master.errors.noSavedPreset');
      return;
    }
    try {
      applySessionSettings(JSON.parse(raw));
      state.localError.value = null;
    } catch {
      state.localError.value = state.t('master.errors.presetLoadFailed');
    }
  }

  function exportChainSettings() {
    if (state.chainSettingsUrl.value) URL.revokeObjectURL(state.chainSettingsUrl.value);
    const payload = {
      exportedAt: new Date().toISOString(),
      settings: currentSessionSettings(),
    };
    state.chainSettingsUrl.value = URL.createObjectURL(
      new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      }),
    );
  }

  async function handleChainImport(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      if (file.size > MAX_CHAIN_SETTINGS_BYTES) throw new Error('settings file too large');
      const payload = JSON.parse(await file.text());
      applySessionSettings(payload.settings || payload);
      state.localError.value = null;
    } catch {
      state.localError.value = state.t('master.errors.presetLoadFailed');
    } finally {
      input.value = '';
    }
  }

  return {
    currentSessionSettings,
    applySessionSettings,
    saveSession,
    restoreSession,
    saveChainPreset,
    loadChainPreset,
    exportChainSettings,
    handleChainImport,
  };
}

function isMasteringPresetId(value: unknown): value is MasteringPresetId {
  return typeof value === 'string' && MASTERING_PRESETS.some((preset) => preset.id === value);
}

function isMasteringVenueId(value: unknown): value is MasteringVenueId {
  return typeof value === 'string' && MASTERING_VENUES.some((venue) => venue.id === value);
}

function isMasteringPlatformId(value: unknown): value is MasteringPlatformId {
  return typeof value === 'string' && MASTERING_PLATFORMS.some((platform) => platform.id === value);
}
