import { onBeforeUnmount } from 'vue';

/**
 * Whether the owning component has begun unmounting.
 *
 * Archetypes load WASM and clips across several awaits, and an unmount can land
 * between any two of them. Every continuation that writes state or arms an
 * animation frame checks this first, so a torn-down demo never paints, never
 * reports a late failure, and never leaves a stray rAF loop running.
 */
export function useDisposed(): () => boolean {
  let disposed = false;
  onBeforeUnmount(() => {
    disposed = true;
  });
  return () => disposed;
}
