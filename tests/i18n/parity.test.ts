import { describe, expect, it } from 'vitest';
import { DEFAULT_LOCALE, localeMessages, supportedLocales } from '@/locales';

function flattenKeys(value: unknown, prefix = ''): string[] {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
      flattenKeys(child, prefix ? `${prefix}.${key}` : key),
    );
  }
  return [prefix];
}

describe('locale parity', () => {
  const defaultKeys = new Set(flattenKeys(localeMessages[DEFAULT_LOCALE]));

  for (const locale of supportedLocales) {
    if (locale === DEFAULT_LOCALE) continue;

    it(`${locale} has every ${DEFAULT_LOCALE} key`, () => {
      const localeKeys = new Set(flattenKeys(localeMessages[locale]));
      expect([...defaultKeys].filter((key) => !localeKeys.has(key))).toEqual([]);
    });

    it(`${DEFAULT_LOCALE} has every ${locale} key`, () => {
      const localeKeys = new Set(flattenKeys(localeMessages[locale]));
      expect([...localeKeys].filter((key) => !defaultKeys.has(key))).toEqual([]);
    });
  }

  it('has a non-trivial number of keys', () => {
    expect(defaultKeys.size).toBeGreaterThan(100);
  });
});
