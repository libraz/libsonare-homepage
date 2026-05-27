import type { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import './custom.css';
import AudioAnalyzer from '@/components/AudioAnalyzer.vue';
import BenchChart from './components/BenchChart.vue';
import Layout from './Layout.vue';

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) {
    app.component('AudioAnalyzer', AudioAnalyzer);
    app.component('BenchChart', BenchChart);
  },
} satisfies Theme;
