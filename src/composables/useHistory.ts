import { type ComputedRef, computed, shallowRef } from 'vue';

/** Maximum number of undoable entries kept; the oldest is dropped beyond it. */
export const HISTORY_LIMIT = 200;

export interface HistoryOptions<T> {
  /** Undo entries kept before the oldest is dropped. Defaults to `HISTORY_LIMIT`. */
  limit?: number;
  /**
   * Called after every change of the current state: `commit` (including each commit
   * inside a drag), `undo`, `redo` and `reset`. This is the single stream an engine
   * applier diffs `prev -> next` from, so undo and redo reach the engine like an edit.
   */
  onChange?: (prev: T, next: T) => void;
}

export interface History<T> {
  /** Current state. A deep-frozen snapshot: replace it through `commit`, never mutate it. */
  state: ComputedRef<T>;
  canUndo: ComputedRef<boolean>;
  canRedo: ComputedRef<boolean>;
  /** Record `next` as the new state (one entry) and clear redo. `next` is copied, not aliased. */
  commit(next: T): void;
  /** Start a drag: commits until `end()` fold into one history entry. Idempotent. */
  begin(): void;
  /** Close the drag opened by `begin()`. A drag with no commit leaves no entry. */
  end(): void;
  /** Step back; returns the restored state, or `undefined` when there is nothing to undo. Closes an open drag. */
  undo(): T | undefined;
  /** Step forward; returns the restored state, or `undefined` when there is nothing to redo. Closes an open drag. */
  redo(): T | undefined;
  /** Replace the state and clear all history (used on load). Closes an open drag. */
  reset(state: T): void;
}

function freezeDeep<V>(value: V): V {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeDeep(child);
    Object.freeze(value);
  }
  return value;
}

function snapshot<V>(value: V): V {
  return freezeDeep(structuredClone(value));
}

/**
 * Undo/redo over immutable snapshots of a plain, structured-cloneable project state.
 *
 * Every stored state is a deep-frozen copy, so history never aliases live objects.
 */
export function useHistory<T>(initial: T, options: HistoryOptions<T> = {}): History<T> {
  const limit = options.limit ?? HISTORY_LIMIT;
  const current = shallowRef<T>(snapshot(initial));
  const past = shallowRef<T[]>([]);
  const future = shallowRef<T[]>([]);
  let dragging = false;
  let dragRecorded = false;

  function setCurrent(next: T): void {
    const prev = current.value;
    current.value = next;
    options.onChange?.(prev, next);
  }

  function pushPast(entry: T): void {
    const next = [...past.value, entry];
    past.value = next.length > limit ? next.slice(next.length - limit) : next;
  }

  function begin(): void {
    if (dragging) return;
    dragging = true;
    dragRecorded = false;
  }

  function end(): void {
    dragging = false;
    dragRecorded = false;
  }

  function commit(next: T): void {
    if (!dragging || !dragRecorded) {
      pushPast(current.value);
      dragRecorded = dragging;
    }
    future.value = [];
    setCurrent(snapshot(next));
  }

  function undo(): T | undefined {
    end();
    const entry = past.value.at(-1);
    if (entry === undefined) return undefined;
    past.value = past.value.slice(0, -1);
    future.value = [...future.value, current.value];
    setCurrent(entry);
    return entry;
  }

  function redo(): T | undefined {
    end();
    const entry = future.value.at(-1);
    if (entry === undefined) return undefined;
    future.value = future.value.slice(0, -1);
    pushPast(current.value);
    setCurrent(entry);
    return entry;
  }

  function reset(state: T): void {
    end();
    past.value = [];
    future.value = [];
    setCurrent(snapshot(state));
  }

  return {
    state: computed(() => current.value),
    canUndo: computed(() => past.value.length > 0),
    canRedo: computed(() => future.value.length > 0),
    commit,
    begin,
    end,
    undo,
    redo,
    reset,
  };
}
