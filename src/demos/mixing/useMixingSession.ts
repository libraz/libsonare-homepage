/**
 * localStorage persistence of the /mixing project state. The state carries no
 * audio, so a restored project waits for its audio before it reaches the
 * engine.
 */
import {
  type MixingState,
  parseMixingState,
  serializeMixingState,
} from '@/demos/mixing/mixingState';

export const MIXING_STATE_STORAGE_KEY = 'libsonare-mixing-project-v2';

/** Quiet period after the last edit before the state is written. */
export const MIXING_SAVE_DELAY_MS = 250;

export interface MixingSession {
  /** The saved project; null when nothing valid is stored. */
  restore(): MixingState | null;
  /** Schedules a write of `state`; edits within the delay coalesce into one write. */
  save(state: MixingState): void;
  /** Writes a pending save now. */
  flush(): void;
  /** Cancels a pending save. */
  dispose(): void;
}

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function useMixingSession(delayMs = MIXING_SAVE_DELAY_MS): MixingSession {
  let pending: MixingState | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function flush(): void {
    if (timer) clearTimeout(timer);
    timer = null;
    if (!pending) return;
    try {
      storage()?.setItem(MIXING_STATE_STORAGE_KEY, serializeMixingState(pending));
    } catch {
      // Storage may be full or disabled; persistence is best-effort.
    }
    pending = null;
  }

  function save(state: MixingState): void {
    pending = state;
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, delayMs);
  }

  function restore(): MixingState | null {
    try {
      const text = storage()?.getItem(MIXING_STATE_STORAGE_KEY);
      return text ? parseMixingState(text) : null;
    } catch {
      return null;
    }
  }

  function dispose(): void {
    if (timer) clearTimeout(timer);
    timer = null;
    pending = null;
  }

  return { restore, save, flush, dispose };
}
