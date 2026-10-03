import { onBeforeUnmount, onMounted } from 'vue';

/** Frame interval while the visitor prefers reduced motion. */
export const REDUCED_MOTION_INTERVAL_MS = 250;

/** Handle returned by {@link useMeterClock}. */
export interface MeterClock {
  /** Start the frame loop if it is idle; call whenever a new reading arrives. */
  wake: () => void;
}

/**
 * Drive a meter's ballistics on requestAnimationFrame.
 *
 * The loop runs only while `step` reports motion, pauses while the document is
 * hidden, and drops to 4 Hz under `prefers-reduced-motion`.
 *
 * @param step Advances the meter to `timeSec`; returns true while still moving.
 *   `resumed` is true on the first frame after the loop idled, so the caller can
 *   restart its dt from zero instead of replaying the idle gap as fall time.
 */
export function useMeterClock(step: (timeSec: number, resumed: boolean) => boolean): MeterClock {
  let frame = 0;
  let resumed = true;
  let lastStepMs = Number.NEGATIVE_INFINITY;
  let mounted = false;
  const reduceMotion =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;

  function onFrame(nowMs: number): void {
    frame = 0;
    if (document.hidden) {
      resumed = true;
      return;
    }
    if (reduceMotion?.matches && nowMs - lastStepMs < REDUCED_MOTION_INTERVAL_MS) {
      frame = requestAnimationFrame(onFrame);
      return;
    }
    lastStepMs = nowMs;
    const moving = step(nowMs / 1000, resumed);
    resumed = !moving;
    if (moving) frame = requestAnimationFrame(onFrame);
  }

  function wake(): void {
    if (!mounted || frame || typeof requestAnimationFrame !== 'function') return;
    frame = requestAnimationFrame(onFrame);
  }

  function onVisibility(): void {
    if (!document.hidden) wake();
  }

  onMounted(() => {
    mounted = true;
    document.addEventListener('visibilitychange', onVisibility);
    wake();
  });

  onBeforeUnmount(() => {
    mounted = false;
    document.removeEventListener('visibilitychange', onVisibility);
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  });

  return { wake };
}
