import { describe, expect, it } from 'vitest';
import {
  alternateLocaleFor,
  DEFAULT_LOCALE,
  localeLabels,
  localePathPrefix,
  localizedRoute,
  normalizeLocale,
  supportedLocales,
} from '@/locales';

describe('locale utilities', () => {
  it('keeps the default locale first and labels every supported locale', () => {
    expect(supportedLocales[0]).toBe(DEFAULT_LOCALE);
    for (const locale of supportedLocales) {
      expect(localeLabels[locale].label).toBeTruthy();
      expect(localeLabels[locale].shortLabel).toBeTruthy();
    }
  });

  it('normalizes regional and unknown locale values', () => {
    expect(normalizeLocale('ja-JP')).toBe('ja');
    expect(normalizeLocale('unknown')).toBe(DEFAULT_LOCALE);
    expect(normalizeLocale(undefined)).toBe(DEFAULT_LOCALE);
  });

  it('builds locale prefixes and localized routes', () => {
    expect(localePathPrefix(DEFAULT_LOCALE)).toBe('');
    expect(localePathPrefix('ja')).toBe('/ja');
    expect(localizedRoute('docs/wasm', 'ja')).toBe('/ja/docs/wasm');
    expect(localizedRoute('/docs/wasm', DEFAULT_LOCALE)).toBe('/docs/wasm');
    expect(localizedRoute('/ja/docs/wasm', 'ja')).toBe('/ja/docs/wasm');
    expect(localizedRoute('/ja/docs/wasm', DEFAULT_LOCALE)).toBe('/docs/wasm');
  });

  it('selects a different alternate locale', () => {
    expect(alternateLocaleFor(DEFAULT_LOCALE)).not.toBe(DEFAULT_LOCALE);
    expect(alternateLocaleFor('unknown')).not.toBe(DEFAULT_LOCALE);
  });
});
