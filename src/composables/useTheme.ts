import { ref, provide, inject, readonly, type Ref, type DeepReadonly } from 'vue'

const THEME_KEY = Symbol('theme')
const STORAGE_KEY = 'libsonare-theme'

export interface ThemeContext {
  isDark: DeepReadonly<Ref<boolean>>
  toggle: () => void
}

/** Call once in the root layout to create and provide theme state */
export function createTheme(): ThemeContext {
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
  const isDark = ref(stored ? stored === 'dark' : false)

  function toggle() {
    isDark.value = !isDark.value
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, isDark.value ? 'dark' : 'light')
    }
  }

  const ctx: ThemeContext = { isDark: readonly(isDark), toggle }
  provide(THEME_KEY, ctx)
  return ctx
}

/** Inject theme state in child components */
export function useTheme(): ThemeContext {
  const theme = inject<ThemeContext>(THEME_KEY)
  if (!theme) {
    return { isDark: readonly(ref(true)), toggle: () => {} }
  }
  return theme
}
