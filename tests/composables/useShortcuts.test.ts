import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { type ShortcutMap, useShortcuts } from '@/composables/useShortcuts';

/*
 * Model (pairwise over six discrete parameters, rows built by the greedy
 * generator below and checked for full pair coverage):
 *   focus     body | input | textarea | select | contenteditable
 *   code      Space | KeyL | KeyZ
 *   modifiers none | meta | ctrl | shift | meta+shift | ctrl+shift
 *   platform  mac | other
 *   repeat    false | true
 *   composing false | true
 * Expected outcome comes from an independent oracle, not the implementation.
 */
const PARAMS = {
  focus: ['body', 'input', 'textarea', 'select', 'contenteditable'],
  code: ['Space', 'KeyL', 'KeyZ'],
  mods: ['none', 'meta', 'ctrl', 'shift', 'meta+shift', 'ctrl+shift'],
  platform: ['mac', 'other'],
  repeat: [false, true],
  composing: [false, true],
} as const;

type Row = { [K in keyof typeof PARAMS]: (typeof PARAMS)[K][number] };
const KEYS = Object.keys(PARAMS) as (keyof typeof PARAMS)[];

function pairwise(): Row[] {
  const pairKey = (a: number, x: unknown, b: number, y: unknown) => `${a}:${x}|${b}:${y}`;
  const uncovered = new Set<string>();
  for (let i = 0; i < KEYS.length; i++)
    for (let j = i + 1; j < KEYS.length; j++)
      for (const x of PARAMS[KEYS[i]])
        for (const y of PARAMS[KEYS[j]]) uncovered.add(pairKey(i, x, j, y));

  const rows: Row[] = [];
  const gain = (vals: unknown[]) => {
    let n = 0;
    for (let i = 0; i < vals.length; i++)
      for (let j = i + 1; j < vals.length; j++)
        if (uncovered.has(pairKey(i, vals[i], j, vals[j]))) n++;
    return n;
  };
  while (uncovered.size > 0) {
    // Seed with the first uncovered pair, then extend greedily.
    const [seed] = uncovered;
    const [a, b] = seed.split('|').map((s) => s.split(':'));
    const vals: unknown[] = KEYS.map(() => undefined);
    const parse = (k: number, s: string) =>
      (PARAMS[KEYS[k]] as readonly unknown[]).find((v) => String(v) === s);
    vals[Number(a[0])] = parse(Number(a[0]), a[1]);
    vals[Number(b[0])] = parse(Number(b[0]), b[1]);
    for (let k = 0; k < KEYS.length; k++) {
      if (vals[k] !== undefined) continue;
      let best = PARAMS[KEYS[k]][0] as unknown;
      let bestGain = -1;
      for (const cand of PARAMS[KEYS[k]]) {
        const trial = vals.slice();
        trial[k] = cand;
        const g = gain(trial.map((v, i) => (v === undefined && i > k ? '*' : v)));
        if (g > bestGain) {
          bestGain = g;
          best = cand;
        }
      }
      vals[k] = best;
    }
    for (let i = 0; i < vals.length; i++)
      for (let j = i + 1; j < vals.length; j++) uncovered.delete(pairKey(i, vals[i], j, vals[j]));
    rows.push(Object.fromEntries(KEYS.map((k, i) => [k, vals[i]])) as Row);
  }
  return rows;
}

const ROWS = pairwise();

function oracle(r: Row): string | null {
  if (r.focus !== 'body' || r.composing || r.repeat) return null;
  const mod = r.platform === 'mac' ? 'meta' : 'ctrl';
  const table: Record<string, string> = {
    'Space|none': 'Space',
    'KeyL|none': 'KeyL',
    [`KeyZ|${mod}`]: 'Mod+KeyZ',
    [`KeyZ|${mod}+shift`]: 'Mod+Shift+KeyZ',
  };
  return table[`${r.code}|${r.mods}`] ?? null;
}

const COMBOS = ['Space', 'KeyL', 'Mod+KeyZ', 'Mod+Shift+KeyZ'];

function host(bindings: (calls: string[]) => ShortcutMap, mac: boolean) {
  const calls: string[] = [];
  const Comp = defineComponent({
    setup() {
      useShortcuts(bindings(calls), { mac });
      return () => h('div');
    },
  });
  return { calls, wrapper: mount(Comp, { attachTo: document.body }) };
}

function simple(mac: boolean) {
  return host(
    (calls) => Object.fromEntries(COMBOS.map((c) => [c, () => calls.push(c)])) as ShortcutMap,
    mac,
  );
}

function makeTarget(kind: Row['focus']): HTMLElement {
  if (kind === 'body') return document.body;
  const el = document.createElement(kind === 'contenteditable' ? 'div' : kind);
  if (kind === 'contenteditable') el.setAttribute('contenteditable', 'true');
  document.body.appendChild(el);
  return el;
}

function press(target: HTMLElement, code: string, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('useShortcuts pairwise matrix', () => {
  it('covers every parameter pair', () => {
    const seen = new Set<string>();
    for (const r of ROWS)
      for (let i = 0; i < KEYS.length; i++)
        for (let j = i + 1; j < KEYS.length; j++) seen.add(`${i}:${r[KEYS[i]]}|${j}:${r[KEYS[j]]}`);
    let total = 0;
    for (let i = 0; i < KEYS.length; i++)
      for (let j = i + 1; j < KEYS.length; j++)
        total += PARAMS[KEYS[i]].length * PARAMS[KEYS[j]].length;
    expect(seen.size).toBe(total);
  });

  it.each(ROWS.map((r) => [JSON.stringify(r), r] as const))('%s', (_name, r) => {
    const { calls, wrapper } = simple(r.platform === 'mac');
    const target = makeTarget(r.focus);
    const event = press(target, r.code, {
      metaKey: r.mods.includes('meta'),
      ctrlKey: r.mods.includes('ctrl'),
      shiftKey: r.mods.includes('shift'),
      repeat: r.repeat,
      isComposing: r.composing,
    });
    const expected = oracle(r);
    expect(calls).toEqual(expected ? [expected] : []);
    expect(event.defaultPrevented).toBe(expected !== null);
    wrapper.unmount();
  });
});

describe('useShortcuts behaviour', () => {
  it('removes the listener on unmount', () => {
    const { calls, wrapper } = simple(false);
    wrapper.unmount();
    press(document.body, 'Space');
    expect(calls).toEqual([]);
  });

  it('honours a reactive enabled flag and leaves the key alone when disabled', () => {
    const enabled = ref(false);
    const handler = vi.fn();
    const { wrapper } = host(() => ({ Space: { handler, enabled } }), false);
    expect(press(document.body, 'Space').defaultPrevented).toBe(false);
    expect(handler).not.toHaveBeenCalled();
    enabled.value = true;
    expect(press(document.body, 'Space').defaultPrevented).toBe(true);
    expect(handler).toHaveBeenCalledOnce();
    wrapper.unmount();
  });

  it('fires on repeat only when the binding opts in', () => {
    const plain = vi.fn();
    const opted = vi.fn();
    const { wrapper } = host(
      () => ({ KeyL: plain, KeyM: { handler: opted, repeat: true } }),
      false,
    );
    press(document.body, 'KeyL', { repeat: true });
    press(document.body, 'KeyM', { repeat: true });
    expect(plain).not.toHaveBeenCalled();
    expect(opted).toHaveBeenCalledOnce();
    wrapper.unmount();
  });

  it('matches by code, not by the produced character', () => {
    const handler = vi.fn();
    const { wrapper } = host(() => ({ KeyA: handler }), false);
    press(document.body, 'KeyA', { key: 'q' });
    expect(handler).toHaveBeenCalledOnce();
    wrapper.unmount();
  });

  it('ignores keys from inside a contenteditable descendant', () => {
    const handler = vi.fn();
    const { wrapper } = host(() => ({ KeyS: handler }), false);
    const outer = makeTarget('contenteditable');
    const inner = document.createElement('span');
    outer.appendChild(inner);
    press(inner, 'KeyS');
    expect(handler).not.toHaveBeenCalled();
    wrapper.unmount();
  });
});
