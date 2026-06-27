import { describe, expect, it } from 'vitest';
import { type I18nText, localized } from '@/demos/types';

const copy = {
  en: 'English copy',
  ja: '日本語コピー',
  fr: 'Copie francaise',
} satisfies I18nText;

describe('demo type helpers', () => {
  it('resolves exact and regional locale copy', () => {
    expect(localized(copy, 'ja')).toBe('日本語コピー');
    expect(localized(copy, 'fr-CA')).toBe('Copie francaise');
  });

  it('falls back to English for missing or blank locale copy', () => {
    expect(localized(copy, 'de')).toBe('English copy');
    expect(localized({ ...copy, fr: '   ' }, 'fr')).toBe('English copy');
  });

  it('returns an empty string when optional copy is absent', () => {
    expect(localized(undefined, 'ja')).toBe('');
  });
});
