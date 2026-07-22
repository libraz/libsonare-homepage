import type { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import { defineAsyncComponent } from 'vue';
import { defineDemoAsync } from '@/components/demos/defineDemoAsync';
import './custom.css';
import Layout from './Layout.vue';

const AudioAnalyzer = defineDemoAsync(() => import('@/components/AudioAnalyzer.vue'));
const SonareDemo = defineDemoAsync(() => import('@/components/demos/SonareDemo.vue'));
const BenchChart = defineAsyncComponent(() => import('./components/BenchChart.vue'));
const FlowDiagram = defineAsyncComponent(() => import('./components/diagrams/FlowDiagram.vue'));
const SequenceDiagram = defineAsyncComponent(
  () => import('./components/diagrams/SequenceDiagram.vue'),
);

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
