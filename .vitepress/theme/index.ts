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

/**
 * Hand-authored SVG concept figures. Unlike FlowDiagram/SequenceDiagram these
 * are per-topic: each computes its own geometry from semantic props and takes
 * every string through `labels`, so a locale page passes translated text
 * rather than duplicating the drawing.
 */
const figure = (name: string) =>
  defineAsyncComponent(() => import(`./components/figures/${name}.vue`));

const FIGURES = [
  'BandMapFigure',
  'BinSpacingFigure',
  'BlindDecayFigure',
  'CallbackBudgetFigure',
  'ClarityWindowFigure',
  'CrestFactorFigure',
  'DistanceBalanceFigure',
  'GainLadderFigure',
  'LoudnessGateFigure',
  'MelBankFigure',
  'RoomDecayFigure',
  'RoomEquivalenceFigure',
  'SectionMatrixFigure',
  'StftFramingFigure',
  'WarpMapFigure',
] as const;

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) {
    app.component('AudioAnalyzer', AudioAnalyzer);
    app.component('BenchChart', BenchChart);
    app.component('FlowDiagram', FlowDiagram);
    app.component('SequenceDiagram', SequenceDiagram);
    app.component('SonareDemo', SonareDemo);
    for (const name of FIGURES) app.component(name, figure(name));
  },
} satisfies Theme;
