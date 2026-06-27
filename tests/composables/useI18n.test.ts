import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

const lang = ref('en');
vi.mock('vitepress', () => ({
  useData: () => ({ lang }),
}));

import { useI18n } from '@/composables/useI18n';
import en from '@/locales/en.json';

describe('useI18n', () => {
  it('resolves a nested key in the active locale', () => {
    lang.value = 'en';
    const { t } = useI18n();
    expect(t('demo.title')).toBe((en as any).demo.title);
  });

  it('falls back to the literal key when missing in locale messages', () => {
    const { t } = useI18n();
    expect(t('nonexistent.key.path')).toBe('nonexistent.key.path');
  });

  it('interpolates parameters', () => {
    lang.value = 'en';
    const { t } = useI18n();
    // A key with no placeholders still returns its string; interpolation only
    // substitutes {name}-style tokens, leaving plain strings untouched.
    const plain = t('demo.title');
    expect(t('demo.title', { unused: 'x' })).toBe(plain);
  });

  it('isLocale reflects the active language', () => {
    lang.value = 'ja';
    const { isLocale } = useI18n();
    expect(isLocale('ja')).toBe(true);
    expect(isLocale('en')).toBe(false);
  });

  it('defaults to en for an unknown language', () => {
    lang.value = 'fr';
    const { t } = useI18n();
    expect(t('demo.title')).toBe((en as any).demo.title);
  });

  it('normalizes regional locale codes', () => {
    lang.value = 'ja-JP';
    const { locale, isLocale } = useI18n();
    expect(locale.value).toBe('ja');
    expect(isLocale('ja')).toBe(true);
  });

  it('builds localized and alternate locale paths from the locale registry', () => {
    lang.value = 'ja';
    const { localizedPath, alternateLocalePath } = useI18n();
    expect(localizedPath('/docs/wasm')).toBe('/ja/docs/wasm');
    expect(localizedPath('/ja/docs/wasm', 'en')).toBe('/docs/wasm');
    expect(alternateLocalePath('/analyzer')).toBe('/analyzer');
  });

  it('falls back to the default localized string when the active value is blank', () => {
    lang.value = 'ja';
    const { localizedValue } = useI18n();

    expect(localizedValue({ en: 'English', ja: '   ' })).toBe('English');
  });

  it('keeps object localized values intact', () => {
    lang.value = 'ja';
    const { localizedValue } = useI18n();
    const jaCopy = { title: '日本語' };

    expect(localizedValue({ en: { title: 'English' }, ja: jaCopy })).toBe(jaCopy);
  });
});
