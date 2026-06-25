import { describe, expect, it } from 'vitest';
import { allDemos, demoIds, getDemo } from '@/demos/registry';
import type { I18nText, SonareDemoDef } from '@/demos/types';

const ARCHETYPES = new Set([
  'transform',
  'detector',
  'ab-process',
  'meters',
  'param-sweep',
  'synth',
  'signal',
  'room',
  'contour',
  'lane-mixer',
  'spectral-edit',
  'piano-roll',
  'compressor',
]);

function expectBilingual(text: I18nText | undefined, where: string) {
  expect(text, `${where} missing`).toBeTruthy();
  expect(text?.en?.trim(), `${where}.en empty`).toBeTruthy();
  expect(text?.ja?.trim(), `${where}.ja empty`).toBeTruthy();
}

describe('demo registry', () => {
  it('has unique kebab-case ids', () => {
    const ids = demoIds();
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it.each(allDemos)('def "$id" is well-formed and bilingual', (def: SonareDemoDef) => {
    expect(ARCHETYPES.has(def.archetype)).toBe(true);
    expectBilingual(def.title, `${def.id}.title`);
    if (def.caption) expectBilingual(def.caption, `${def.id}.caption`);

    for (const param of def.params ?? []) {
      expectBilingual(param.label, `${def.id}.param[${param.key}].label`);
      for (const opt of param.options ?? []) {
        expectBilingual(opt.label, `${def.id}.param[${param.key}].option[${opt.value}].label`);
      }
    }

    if (def.source.kind === 'generate') {
      expect(def.source.signal).toBeTruthy();
    } else {
      expect(def.source.clip).toBeTruthy();
    }

    expect(getDemo(def.id)).toBe(def);
  });
});
