import { computed } from 'vue'
import { useData } from 'vitepress'
import enMessages from '@/locales/en.json'
import jaMessages from '@/locales/ja.json'

const messages: Record<string, Record<string, any>> = {
  en: enMessages,
  ja: jaMessages,
}

export function useI18n() {
  const { lang } = useData()

  const locale = computed(() => lang.value || 'en')

  const currentMessages = computed(() => messages[locale.value] || messages.en)

  function t(key: string, params?: Record<string, string>): string {
    const keys = key.split('.')
    let value: any = currentMessages.value

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k]
      } else {
        // Fallback to English
        value = messages.en
        for (const fallbackKey of keys) {
          if (value && typeof value === 'object' && fallbackKey in value) {
            value = value[fallbackKey]
          } else {
            return key
          }
        }
        break
      }
    }

    if (typeof value !== 'string') {
      return key
    }

    // Parameter interpolation
    if (params) {
      return value.replace(/\{(\w+)\}/g, (_, paramKey) => params[paramKey] ?? `{${paramKey}}`)
    }

    return value
  }

  function isLocale(checkLocale: string): boolean {
    return locale.value === checkLocale
  }

  return {
    locale,
    t,
    isLocale,
    messages: currentMessages,
  }
}
