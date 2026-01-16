import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import { h } from 'vue'
import { useData } from 'vitepress'
import './custom.css'
import DemoLayout from './DemoLayout.vue'
import AudioAnalyzer from '@/components/AudioAnalyzer.vue'

export default {
  extends: DefaultTheme,
  Layout: () => {
    const { frontmatter } = useData()
    if (frontmatter.value.layout === 'demo') {
      return h(DemoLayout)
    }
    return h(DefaultTheme.Layout, null, {})
  },
  enhanceApp({ app }) {
    app.component('AudioAnalyzer', AudioAnalyzer)
  }
} satisfies Theme
