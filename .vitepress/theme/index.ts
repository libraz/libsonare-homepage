import type { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import './custom.css';
import AudioAnalyzer from '@/components/AudioAnalyzer.vue';
import SonareDemo from '@/components/demos/SonareDemo.vue';
import BenchChart from './components/BenchChart.vue';
import FlowDiagram from './components/diagrams/FlowDiagram.vue';
import SequenceDiagram from './components/diagrams/SequenceDiagram.vue';
import Layout from './Layout.vue';

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) {
    app.component('AudioAnalyzer', AudioAnalyzer);
    app.component('BenchChart', BenchChart);
    app.component('FlowDiagram', FlowDiagram);
    app.component('SequenceDiagram', SequenceDiagram);
    app.component('SonareDemo', SonareDemo);
  },
} satisfies Theme;
