import type { Ref } from 'vue';
import type {
  MasteringModuleSettings,
  MasteringPlatformId,
  MasteringPresetId,
} from '@/composables/useMastering';
import { clamp } from '@/utils/masteringMetrics';
import {
  MASTERING_MODULES,
  MASTERING_PLATFORMS,
  MASTERING_PRESETS,
  type MasteringMode,
  type MasteringSessionSettings,
} from '@/utils/masteringUi';

const sessionStorageKey = 'libsonare-mastering-session-v1';
const chainPresetStorageKey = 'libsonare-mastering-chain-preset-v1';

interface MasteringSessionRefs {
  mode: Ref<MasteringMode>;
  selectedPreset: Ref<MasteringPresetId>;
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
      state.moduleSettings.value = {
        ...state.moduleSettings.value,
        ...settings.moduleSettings,
      };
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

function isMasteringPlatformId(value: unknown): value is MasteringPlatformId {
  return typeof value === 'string' && MASTERING_PLATFORMS.some((platform) => platform.id === value);
}
