import { ref, readonly, onMounted, onUnmounted, provide, inject, type Ref, type DeepReadonly } from 'vue'

const THEME_KEY = Symbol('theme')

export interface ThemeContext {
  isDark: DeepReadonly<Ref<boolean>>
  toggle: () => void
}

/**
 * Create a reactive isDark ref that stays in sync with <html class="dark">.
 *
 * VitePress's useData().isDark does not reliably sync with the DOM in
 * production SSR builds, so we observe the <html> element directly via
 * MutationObserver for a source-of-truth that works everywhere.
 */
function useDomDark() {
  const isDark = ref(false)
  let observer: MutationObserver | null = null

  function sync() {
    if (typeof document !== 'undefined') {
      isDark.value = document.documentElement.classList.contains('dark')
    }
  }

  onMounted(() => {
    sync()
    observer = new MutationObserver(sync)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })
  })

  onUnmounted(() => {
    observer?.disconnect()
  })

  return isDark
}

/** Call once in the root layout to create and provide theme state */
export function createTheme(): ThemeContext {
  const isDark = useDomDark()

  function toggle() {
    document.documentElement.classList.toggle('dark')
  }

  const ctx: ThemeContext = { isDark: readonly(isDark), toggle }
  provide(THEME_KEY, ctx)
  return ctx
}

/** Inject theme state in child components */
export function useTheme(): ThemeContext {
  const theme = inject<ThemeContext>(THEME_KEY)
  if (!theme) {
    // Fallback: create own DOM-based dark detection
    const isDark = useDomDark()
    return {
      isDark: readonly(isDark),
      toggle: () => document.documentElement.classList.toggle('dark'),
    }
  }
  return theme
}
