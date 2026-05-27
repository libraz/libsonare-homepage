import { nextTick, type Ref, watch } from 'vue';
import type { MasteringMode } from '@/utils/masteringUi';

export function useMasteringModeUrlSync(mode: Ref<MasteringMode>) {
  let ready = false;
  let applyingFromHistory = false;

  watch(mode, (value) => {
    if (!ready || applyingFromHistory || typeof window === 'undefined') return;
    writeModeToUrl(value, 'push');
  });

  function readModeFromUrl(): MasteringMode | null {
    const value = new URLSearchParams(window.location.search).get('mode');
    return value === 'studio' || value === 'quick' ? value : null;
  }

  function applyModeFromUrl() {
    const urlMode = readModeFromUrl();
    if (!urlMode) return;
    setModeFromUrl(urlMode);
  }

  function replaceModeInUrl() {
    writeModeToUrl(mode.value, 'replace');
  }

  function enableModeUrlSync() {
    if (typeof window === 'undefined') return;
    ready = true;
    window.addEventListener('popstate', handlePopState);
  }

  function disableModeUrlSync() {
    ready = false;
    if (typeof window !== 'undefined') {
      window.removeEventListener('popstate', handlePopState);
    }
  }

  function writeModeToUrl(value: MasteringMode, method: 'push' | 'replace') {
    const url = new URL(window.location.href);
    if (value === 'quick') {
      url.searchParams.delete('mode');
    } else {
      url.searchParams.set('mode', value);
    }
    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextUrl === currentUrl) return;
    const state = { ...(window.history.state || {}), masteringMode: value };
    if (method === 'push') {
      window.history.pushState(state, '', nextUrl);
    } else {
      window.history.replaceState(state, '', nextUrl);
    }
  }

  function handlePopState() {
    setModeFromUrl(readModeFromUrl() || 'quick');
  }

  function setModeFromUrl(nextMode: MasteringMode) {
    applyingFromHistory = true;
    mode.value = nextMode;
    void nextTick(() => {
      applyingFromHistory = false;
    });
  }

  return {
    applyModeFromUrl,
    replaceModeInUrl,
    enableModeUrlSync,
    disableModeUrlSync,
  };
}
