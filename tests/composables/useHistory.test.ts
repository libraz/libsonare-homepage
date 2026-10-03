import { describe, expect, it, vi } from 'vitest';
import { HISTORY_LIMIT, useHistory } from '@/composables/useHistory';

/*
 * Parameter model for the pairwise case table (state is `{ n }`, initial `{ n: 0 }`):
 *   final operation : commit | undo | redo | reset | end-only
 *   overflow        : no (limit 200) | yes (limit 2, history already past the limit)
 *   drag at the op  : none | closed (drag finished before) | open (begin() without end())
 * Every pair of values appears in at least one case below; the expected values
 * are worked out by hand from the operation scripts.
 */

interface S {
  n: number;
}

type Script = (h: ReturnType<typeof make>['h']) => void;

function make(limit?: number) {
  const changes: Array<[number, number]> = [];
  const h = useHistory<S>({ n: 0 }, { limit, onChange: (p, n) => changes.push([p.n, n.n]) });
  return { h, changes };
}

const c =
  (n: number): Script =>
  (h) =>
    h.commit({ n });
const drag =
  (...ns: number[]): Script =>
  (h) => {
    h.begin();
    for (const n of ns) h.commit({ n });
    h.end();
  };

interface Case {
  name: string;
  limit?: number;
  steps: Script[];
  state: number;
  canUndo: boolean;
  canRedo: boolean;
}

const cases: Case[] = [
  {
    name: 'commit / no overflow / no drag',
    steps: [c(1), c(2)],
    state: 2,
    canUndo: true,
    canRedo: false,
  },
  {
    name: 'undo / no overflow / no drag',
    steps: [c(1), c(2), (h) => h.undo()],
    state: 1,
    canUndo: true,
    canRedo: true,
  },
  {
    name: 'redo / no overflow / no drag',
    steps: [c(1), (h) => h.undo(), (h) => h.redo()],
    state: 1,
    canUndo: true,
    canRedo: false,
  },
  {
    name: 'reset / no overflow / no drag',
    steps: [c(1), c(2), (h) => h.reset({ n: 9 })],
    state: 9,
    canUndo: false,
    canRedo: false,
  },
  {
    name: 'commit / overflow / closed drag',
    limit: 2,
    steps: [c(1), drag(2, 3, 4), c(5), (h) => h.undo(), (h) => h.undo(), (h) => h.undo()],
    state: 1,
    canUndo: false,
    canRedo: true,
  },
  {
    name: 'undo / overflow / open drag',
    limit: 2,
    steps: [c(1), c(2), c(3), (h) => h.begin(), c(4), c(5), (h) => h.undo()],
    state: 3,
    canUndo: true,
    canRedo: true,
  },
  {
    name: 'redo / overflow / closed drag',
    limit: 2,
    steps: [
      c(1),
      c(2),
      c(3),
      drag(),
      (h) => h.undo(),
      (h) => h.undo(),
      (h) => h.undo(),
      (h) => h.redo(),
    ],
    state: 2,
    canUndo: true,
    canRedo: true,
  },
  {
    name: 'reset / overflow / open drag',
    limit: 2,
    steps: [c(1), c(2), c(3), (h) => h.begin(), c(4), (h) => h.reset({ n: 7 })],
    state: 7,
    canUndo: false,
    canRedo: false,
  },
  {
    name: 'commit / no overflow / open drag',
    steps: [(h) => h.begin(), c(1), c(2), c(3)],
    state: 3,
    canUndo: true,
    canRedo: false,
  },
  {
    name: 'undo / no overflow / closed drag',
    steps: [drag(1, 2, 3), (h) => h.undo()],
    state: 0,
    canUndo: false,
    canRedo: true,
  },
  {
    name: 'redo / no overflow / open drag',
    steps: [c(1), (h) => h.undo(), (h) => h.begin(), c(5), (h) => h.redo()],
    state: 5,
    canUndo: true,
    canRedo: false,
  },
  {
    name: 'end-only / no overflow / closed drag',
    steps: [drag(), (h) => h.end()],
    state: 0,
    canUndo: false,
    canRedo: false,
  },
  {
    name: 'end-only / overflow / open drag',
    limit: 2,
    steps: [c(1), (h) => h.begin(), (h) => h.end()],
    state: 1,
    canUndo: true,
    canRedo: false,
  },
];

describe('useHistory pairwise sequences', () => {
  it.each(cases)('$name', ({ limit, steps, state, canUndo, canRedo }) => {
    const { h } = make(limit);
    for (const step of steps) step(h);
    expect(h.state.value).toEqual({ n: state });
    expect(h.canUndo.value).toBe(canUndo);
    expect(h.canRedo.value).toBe(canRedo);
  });
});

describe('useHistory', () => {
  it('starts empty', () => {
    const { h } = make();
    expect(h.state.value).toEqual({ n: 0 });
    expect(h.canUndo.value).toBe(false);
    expect(h.canRedo.value).toBe(false);
    expect(h.undo()).toBeUndefined();
    expect(h.redo()).toBeUndefined();
  });

  it('commit clears redo', () => {
    const { h } = make();
    h.commit({ n: 1 });
    h.undo();
    expect(h.canRedo.value).toBe(true);
    h.commit({ n: 2 });
    expect(h.canRedo.value).toBe(false);
    expect(h.redo()).toBeUndefined();
  });

  it('a whole drag is exactly one entry', () => {
    const { h } = make();
    h.commit({ n: 1 });
    h.begin();
    for (const n of [2, 3, 4, 5]) h.commit({ n });
    h.end();
    expect(h.undo()).toEqual({ n: 1 });
    expect(h.undo()).toEqual({ n: 0 });
    expect(h.undo()).toBeUndefined();
    expect(h.redo()).toEqual({ n: 1 });
    expect(h.redo()).toEqual({ n: 5 });
  });

  it('begin with no commit leaves no entry, and begin is idempotent', () => {
    const { h } = make();
    h.begin();
    h.begin();
    h.end();
    expect(h.canUndo.value).toBe(false);
    h.begin();
    h.commit({ n: 1 });
    h.begin();
    h.commit({ n: 2 });
    h.end();
    expect(h.undo()).toEqual({ n: 0 });
    expect(h.canUndo.value).toBe(false);
  });

  it('keeps the newest 200 entries by default', () => {
    expect(HISTORY_LIMIT).toBe(200);
    const { h } = make();
    for (let n = 1; n <= 201; n++) h.commit({ n });
    let undone = 0;
    while (h.undo()) undone++;
    expect(undone).toBe(200);
    expect(h.state.value).toEqual({ n: 1 });
  });

  it('does not alias the committed or initial object', () => {
    const live = { n: 1, nested: { v: [1] } };
    const h = useHistory<typeof live>({ n: 0, nested: { v: [] } });
    h.commit(live);
    live.nested.v.push(2);
    live.n = 99;
    expect(h.state.value).toEqual({ n: 1, nested: { v: [1] } });
    expect(h.state.value).not.toBe(live);
    expect(Object.isFrozen(h.state.value)).toBe(true);
    expect(Object.isFrozen(h.state.value.nested.v)).toBe(true);
  });

  it('undo returns the earlier snapshot unchanged after later commits', () => {
    const { h } = make();
    const live = { n: 1 };
    h.commit(live);
    h.commit({ n: 2 });
    live.n = 50;
    expect(h.undo()).toEqual({ n: 1 });
  });

  it('emits onChange(prev, next) for commit, drag commits, undo, redo and reset', () => {
    const { h, changes } = make();
    h.commit({ n: 1 });
    h.begin();
    h.commit({ n: 2 });
    h.commit({ n: 3 });
    h.end();
    h.undo();
    h.redo();
    h.reset({ n: 8 });
    expect(changes).toEqual([
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 1],
      [1, 3],
      [3, 8],
    ]);
  });

  it('does not emit when there is nothing to undo or redo', () => {
    const onChange = vi.fn();
    const h = useHistory<S>({ n: 0 }, { onChange });
    h.undo();
    h.redo();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('reset clears history and closes an open drag', () => {
    const { h } = make();
    h.commit({ n: 1 });
    h.begin();
    h.commit({ n: 2 });
    h.reset({ n: 5 });
    h.commit({ n: 6 });
    h.commit({ n: 7 });
    expect(h.undo()).toEqual({ n: 6 });
    expect(h.undo()).toEqual({ n: 5 });
    expect(h.undo()).toBeUndefined();
  });
});
