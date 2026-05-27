import { describe, expect, it } from 'vitest';
import en from '@/locales/en.json';
import ja from '@/locales/ja.json';

function flattenKeys(value: unknown, prefix = ''): string[] {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
      flattenKeys(child, prefix ? `${prefix}.${key}` : key),
    );
  }
  return [prefix];
}

describe('locale parity', () => {
  const enKeys = new Set(flattenKeys(en));
  const jaKeys = new Set(flattenKeys(ja));

  it('ja has every en key', () => {
    expect([...enKeys].filter((k) => !jaKeys.has(k))).toEqual([]);
  });

  it('en has every ja key', () => {
    expect([...jaKeys].filter((k) => !enKeys.has(k))).toEqual([]);
  });

  it('has a non-trivial number of keys', () => {
    expect(enKeys.size).toBeGreaterThan(100);
  });
});
