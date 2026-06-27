export type LocaleMessages = Record<string, unknown>;

export const DEFAULT_LOCALE = 'en';

const localeModules = import.meta.glob<LocaleMessages>('./*.json', {
  eager: true,
  import: 'default',
});

function localeFromModulePath(path: string): string {
  return path.replace(/^.*\//, '').replace(/\.json$/, '');
}

export const localeMessages = Object.fromEntries(
  Object.entries(localeModules).map(([path, messages]) => [localeFromModulePath(path), messages]),
) as Record<string, LocaleMessages>;

if (!(DEFAULT_LOCALE in localeMessages)) {
  throw new Error(`Missing default locale messages: ${DEFAULT_LOCALE}`);
}

export type SupportedLocale = string;

export type LocalizedValueMap<T> = { [DEFAULT_LOCALE]: T } & Partial<Record<string, T>>;

export const supportedLocales = [
  DEFAULT_LOCALE,
  ...Object.keys(localeMessages)
    .filter((locale) => locale !== DEFAULT_LOCALE)
    .sort(),
] as SupportedLocale[];

function labelForLocale(locale: string): string {
  return new Intl.DisplayNames([locale], { type: 'language' }).of(locale) ?? locale;
}

function shortLabelForLocale(locale: string): string {
  return locale.split('-')[0].toUpperCase();
}

export const localeLabels = Object.fromEntries(
  supportedLocales.map((locale) => [
    locale,
    { label: labelForLocale(locale), shortLabel: shortLabelForLocale(locale) },
  ]),
) as Record<SupportedLocale, { label: string; shortLabel: string }>;

export function isSupportedLocale(locale: string): locale is SupportedLocale {
  return locale in localeMessages;
}

export function normalizeLocale(value: string | undefined): SupportedLocale {
  if (!value) return DEFAULT_LOCALE;
  if (isSupportedLocale(value)) return value;

  const baseLocale = value.split('-')[0];
  return isSupportedLocale(baseLocale) ? baseLocale : DEFAULT_LOCALE;
}

export function alternateLocaleFor(locale: string): SupportedLocale {
  const normalizedLocale = normalizeLocale(locale);
  return supportedLocales.find((candidate) => candidate !== normalizedLocale) ?? DEFAULT_LOCALE;
}

export function localePathPrefix(locale: string): string {
  const normalizedLocale = normalizeLocale(locale);
  return normalizedLocale === DEFAULT_LOCALE ? '' : `/${normalizedLocale}`;
}

function stripLocalePathPrefix(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const [, firstSegment, ...rest] = normalizedPath.split('/');
  return firstSegment && isSupportedLocale(firstSegment) ? `/${rest.join('/')}` : normalizedPath;
}

export function localizedRoute(path: string, locale: string): string {
  return `${localePathPrefix(locale)}${stripLocalePathPrefix(path)}`;
}
