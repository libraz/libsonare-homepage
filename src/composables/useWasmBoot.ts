import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';

export type SonareWasmModule = typeof import('@/wasm/index.js');

let sharedModule: Promise<SonareWasmModule> | null = null;

/** One process-wide WASM boot and one authoritative runtime-version source. */
export function bootWasm(): Promise<SonareWasmModule> {
  if (!sharedModule) {
    sharedModule = import('@/wasm/index.js').catch((error) => {
      sharedModule = null;
      throw error;
    });
  }
  return sharedModule.then(async (wasm) => {
    // init() is idempotent in the generated binding. Calling it through this
    // shared gateway also lets a prior transient initialization failure retry.
    await wasm.init();
    return wasm;
  });
}

export function useWasmBoot(options: { auto?: boolean; delayMs?: number } = {}) {
  const version = ref('');
  const error = shallowRef<unknown>(null);
  const loading = ref(false);
  const module = shallowRef<SonareWasmModule | null>(null);
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let idleId: number | null = null;

  async function boot(): Promise<SonareWasmModule | null> {
    if (module.value) return module.value;
    loading.value = true;
    error.value = null;
    try {
      const wasm = await bootWasm();
      if (disposed) return null;
      module.value = wasm;
      version.value = wasm.version();
      return wasm;
    } catch (cause) {
      if (!disposed) {
        error.value = cause;
        console.warn('Failed to initialize libsonare WASM:', cause);
      }
      return null;
    } finally {
      if (!disposed) loading.value = false;
    }
  }

  onMounted(() => {
    if (options.auto === false) return;
    if ('requestIdleCallback' in window) {
      idleId = window.requestIdleCallback(() => void boot(), { timeout: 2000 });
    } else {
      timer = setTimeout(() => void boot(), options.delayMs ?? 100);
    }
  });

  onBeforeUnmount(() => {
    disposed = true;
    if (timer) clearTimeout(timer);
    if (idleId !== null && 'cancelIdleCallback' in window) window.cancelIdleCallback(idleId);
  });

  return { version, error, loading, module, boot };
}
