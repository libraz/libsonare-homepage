import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import { h } from 'vue'
import { useData } from 'vitepress'
import './custom.css'
import DemoLayout from './DemoLayout.vue'
import AudioAnalyzer from '@/components/AudioAnalyzer.vue'
import BenchChart from './components/BenchChart.vue'

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
    app.component('BenchChart', BenchChart)
  }
} satisfies Theme
