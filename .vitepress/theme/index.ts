import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import './custom.css'
import Layout from './Layout.vue'
import AudioAnalyzer from '@/components/AudioAnalyzer.vue'
import BenchChart from './components/BenchChart.vue'

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) {
    app.component('AudioAnalyzer', AudioAnalyzer)
    app.component('BenchChart', BenchChart)
  }
} satisfies Theme
