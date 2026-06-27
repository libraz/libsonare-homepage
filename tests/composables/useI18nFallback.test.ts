import { afterEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

async function loadUseI18nWithLang(langValue: string) {
  const lang = ref(langValue);
  vi.doMock('vitepress', () => ({
    useData: () => ({ lang }),
  }));
  vi.doMock('@/locales', () => {
    const DEFAULT_LOCALE = 'en';
    const localeMessages = {
      en: {
        common: {
          save: 'Save {name}',
        },
      },
      ja: {
        common: {
          save: '   ',
        },
      },
    };

    function normalizeLocale(value: string | undefined) {
      if (!value) return DEFAULT_LOCALE;
      if (value in localeMessages) return value;
      const baseLocale = value.split('-')[0];
      return baseLocale in localeMessages ? baseLocale : DEFAULT_LOCALE;
    }

    return {
      DEFAULT_LOCALE,
      alternateLocaleFor: () => DEFAULT_LOCALE,
      localeMessages,
      normalizeLocale,
    };
  });

  return import('@/composables/useI18n');
}

describe('useI18n fallback behavior', () => {
  afterEach(() => {
    vi.doUnmock('vitepress');
    vi.doUnmock('@/locales');
    vi.resetModules();
  });

  it('falls back to the default locale when the active locale value is blank', async () => {
    const { useI18n } = await loadUseI18nWithLang('ja');
    const { t } = useI18n();

    expect(t('common.save', { name: 'track' })).toBe('Save track');
  });

  it('returns the key when both active and default locale values are missing', async () => {
    const { useI18n } = await loadUseI18nWithLang('ja');
    const { t } = useI18n();

    expect(t('common.cancel')).toBe('common.cancel');
  });
});
