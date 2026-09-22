import { type Theme, useData, useRouter } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import { defineAsyncComponent, onMounted, onUnmounted } from 'vue';
import { defineDemoAsync } from '@/components/defineDemoAsync';
import SearchBox from '@/components/search/SearchBox.vue';
import { localizedRoute, normalizeLocale } from '@/locales';
import './custom.css';
import Layout from './Layout.vue';

const AudioAnalyzer = defineDemoAsync(() => import('@/demos/analyzer/AudioAnalyzer.vue'));
const SonareDemo = defineDemoAsync(() => import('@/demos/inline/SonareDemo.vue'));
const BenchChart = defineAsyncComponent(() => import('./components/BenchChart.vue'));
const FlowDiagram = defineAsyncComponent(() => import('./components/diagrams/FlowDiagram.vue'));
const SequenceDiagram = defineAsyncComponent(
  () => import('./components/diagrams/SequenceDiagram.vue'),
);
const MaturityNote = defineAsyncComponent(() => import('./components/MaturityNote.vue'));
const SearchResultsView = defineAsyncComponent(
  () => import('@/components/search/SearchResultsView.vue'),
);

/** A field the reader can actually see — the nav one collapses when narrow. */
function visibleSearchInput(): HTMLInputElement | null {
  for (const selector of ['.search-page .sb-field__input', '.VPNavBar .sb-field__input']) {
    const input = document.querySelector<HTMLInputElement>(selector);
    if (input?.offsetParent) return input;
  }
  return null;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
}

/**
 * Hand-authored SVG concept figures. Unlike FlowDiagram/SequenceDiagram these
 * are per-topic: each computes its own geometry from semantic props and takes
 * every string through `labels`, so a locale page passes translated text
 * rather than duplicating the drawing.
 */
const figure = (name: string) =>
  defineAsyncComponent(() => import(`./components/figures/${name}.vue`));

const FIGURES = [
  'AnalysisPipelineFigure',
  'BandMapFigure',
  'BinSpacingFigure',
  'BlindDecayFigure',
  'CallbackBudgetFigure',
  'ClarityWindowFigure',
  'CrestFactorFigure',
  'DistanceBalanceFigure',
  'GainLadderFigure',
  'GsAddressFigure',
  'GsEfxRoutingFigure',
  'LoudnessGateFigure',
  'MasteringChainFigure',
  'MelBankFigure',
  'MixerRoutingFigure',
  'ProjectModelFigure',
  'RoomDecayFigure',
  'RoomEquivalenceFigure',
  'SectionMatrixFigure',
  'SoundSourceCostFigure',
  'StftFramingFigure',
  'SynthSignalPathFigure',
  'WarpMapFigure',
  'WaveguideLoopFigure',
] as const;

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) {
    app.component('AudioAnalyzer', AudioAnalyzer);
    app.component('BenchChart', BenchChart);
    app.component('FlowDiagram', FlowDiagram);
    app.component('MaturityNote', MaturityNote);
    app.component('SearchBox', SearchBox);
    app.component('SearchResultsView', SearchResultsView);
    app.component('SequenceDiagram', SequenceDiagram);
    app.component('SonareDemo', SonareDemo);
    for (const name of FIGURES) app.component(name, figure(name));
  },
  setup() {
    const router = useRouter();
    const { lang } = useData();

    // Cmd/Ctrl-K anywhere, and a bare slash when the reader is not already
    // typing. Both reach the visible field, or the search page when the
    // viewport is too narrow to show one.
    function onSearchShortcut(event: KeyboardEvent) {
      const isFind =
        (event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 'k';
      const isSlash =
        event.key === '/' &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !isTypingTarget(event.target);
      if (!isFind && !isSlash) return;

      event.preventDefault();
      const input = visibleSearchInput();
      if (input) {
        input.focus();
        input.select();
        return;
      }
      router.go(`${localizedRoute('/search', normalizeLocale(lang.value))}.html`);
    }

    onMounted(() => window.addEventListener('keydown', onSearchShortcut));
    onUnmounted(() => window.removeEventListener('keydown', onSearchShortcut));
  },
} satisfies Theme;
