import { useData } from 'vitepress';
import { computed } from 'vue';
import {
  alternateLocaleFor,
  DEFAULT_LOCALE,
  type LocalizedValueMap,
  localeMessages,
  normalizeLocale,
} from '@/locales';

function ensureLeadingSlash(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

function stripLocalePrefix(path: string): string {
  const normalizedPath = ensureLeadingSlash(path);
  const segments = normalizedPath.split('/');
  return segments[1] && segments[1] in localeMessages
    ? ensureLeadingSlash(segments.slice(2).join('/'))
    : normalizedPath;
}

function prefixFor(locale: string): string {
  return locale === DEFAULT_LOCALE ? '' : `/${locale}`;
}

export function useI18n() {
  const { lang } = useData();

  const locale = computed(() => normalizeLocale(lang.value));

  const currentMessages = computed(
    () => localeMessages[locale.value] || localeMessages[DEFAULT_LOCALE],
  );

  function resolveMessage(messages: Record<string, unknown>, keys: string[]): unknown {
    let value: unknown = messages;
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = (value as Record<string, unknown>)[key];
      } else {
        return undefined;
      }
    }
    return value;
  }

  function t(key: string, params?: Record<string, string>): string {
    const keys = key.split('.');
    const value = resolveMessage(currentMessages.value, keys);
    const fallbackValue = resolveMessage(localeMessages[DEFAULT_LOCALE], keys);
    const message = typeof value === 'string' && value.trim().length > 0 ? value : fallbackValue;

    if (typeof message !== 'string' || message.trim().length === 0) {
      return key;
    }

    // Parameter interpolation
    if (params) {
      return message.replace(/\{(\w+)\}/g, (_, paramKey) => params[paramKey] ?? `{${paramKey}}`);
    }

    return message;
  }

  function isLocale(checkLocale: string): boolean {
    return locale.value === normalizeLocale(checkLocale);
  }

  function localizedPath(path: string, targetLocale = locale.value): string {
    const normalizedLocale = normalizeLocale(targetLocale);
    const basePath = stripLocalePrefix(path);
    return `${prefixFor(normalizedLocale)}${basePath}`;
  }

  function alternateLocalePath(path: string, targetLocale?: string): string {
    const normalizedLocale = targetLocale ?? alternateLocaleFor(locale.value);
    return localizedPath(path, normalizedLocale);
  }

  function localizedValue<T>(values: LocalizedValueMap<T>): T {
    const value = values[locale.value];
    if (typeof value === 'string' && value.trim().length === 0) return values[DEFAULT_LOCALE];
    return value ?? values[DEFAULT_LOCALE];
  }

  return {
    locale,
    t,
    isLocale,
    localizedPath,
    alternateLocalePath,
    localizedValue,
    messages: currentMessages,
  };
}
