/**
 * localStorage persistence of the /mastering project state. The state carries
 * no audio, so a restored project waits for its audio before it reaches the
 * engine. The earlier page's chain preset is converted once and the earlier
 * sessionStorage session is discarded.
 */
import {
  deserializeMasteringState,
  MASTERING_LEGACY_PRESET_STORAGE_KEY,
  MASTERING_STATE_STORAGE_KEY,
  type MasteringRestore,
  type MasteringState,
  serializeMasteringState,
} from '@/demos/mastering/masteringState';

/** sessionStorage key of the earlier page's session; read by nothing, removed on load. */
export const MASTERING_LEGACY_SESSION_KEY = 'libsonare-mastering-session-v1';

/** Quiet period after the last edit before the state is written. */
export const MASTERING_SAVE_DELAY_MS = 250;

export interface MasteringSession {
  /** The saved project (or the converted earlier preset); null when nothing is stored. */
  restore(): MasteringRestore | null;
  /** Schedules a write of `state`; edits within the delay coalesce into one write. */
  save(state: MasteringState): void;
  /** Writes a pending save now. */
  flush(): void;
  /** Cancels a pending save. */
  dispose(): void;
}

function storage(kind: 'localStorage' | 'sessionStorage'): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window[kind];
  } catch {
    return null;
  }
}

export function useMasteringSession(delayMs = MASTERING_SAVE_DELAY_MS): MasteringSession {
  let pending: MasteringState | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function write(state: MasteringState): void {
    try {
      storage('localStorage')?.setItem(MASTERING_STATE_STORAGE_KEY, serializeMasteringState(state));
    } catch {
      // Storage may be full or disabled; persistence is best-effort.
    }
  }

  function flush(): void {
    if (timer) clearTimeout(timer);
    timer = null;
    if (pending) write(pending);
    pending = null;
  }

  function save(state: MasteringState): void {
    pending = state;
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, delayMs);
  }

  function restore(): MasteringRestore | null {
    const local = storage('localStorage');
    try {
      storage('sessionStorage')?.removeItem(MASTERING_LEGACY_SESSION_KEY);
    } catch {
      // Nothing to discard.
    }
    if (!local) return null;
    try {
      const current = local.getItem(MASTERING_STATE_STORAGE_KEY);
      if (current !== null) return deserializeMasteringState(current);
      const legacy = local.getItem(MASTERING_LEGACY_PRESET_STORAGE_KEY);
      if (legacy === null) return null;
      const converted = deserializeMasteringState(legacy);
      write(converted.state);
      local.removeItem(MASTERING_LEGACY_PRESET_STORAGE_KEY);
      return converted;
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
