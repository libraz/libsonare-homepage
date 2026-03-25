import { provide, inject, readonly, type Ref, type DeepReadonly } from 'vue'
import { useData } from 'vitepress'

const THEME_KEY = Symbol('theme')

export interface ThemeContext {
  isDark: DeepReadonly<Ref<boolean>>
  toggle: () => void
}

/** Call once in the root layout to create and provide theme state */
export function createTheme(): ThemeContext {
  const { isDark } = useData()

  function toggle() {
    isDark.value = !isDark.value
  }

  const ctx: ThemeContext = { isDark: readonly(isDark), toggle }
  provide(THEME_KEY, ctx)
  return ctx
}

/** Inject theme state in child components */
export function useTheme(): ThemeContext {
  const theme = inject<ThemeContext>(THEME_KEY)
  if (!theme) {
    // Fallback: use VitePress isDark directly
    const { isDark } = useData()
    return { isDark: readonly(isDark), toggle: () => { isDark.value = !isDark.value } }
  }
  return theme
}
