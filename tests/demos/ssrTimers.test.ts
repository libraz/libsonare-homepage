// @vitest-environment node
/**
 * Every demo page is server-rendered by `vitepress build`, and nothing unmounts
 * there: a timer started during setup outlives the render and keeps the build
 * process from exiting. Rendering each page must leave no timer behind.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type Component, createSSRApp, ref } from 'vue';
import { renderToString } from 'vue/server-renderer';

const lang = ref('en');
const frontmatter = ref({ title: 'libsonare Demo' });
vi.mock('vitepress', () => ({
  useData: () => ({ lang, frontmatter, isDark: ref(false), page: ref({ relativePath: '' }) }),
  useRoute: () => ({ path: '/' }),
  useRouter: () => ({ go: vi.fn() }),
  withBase: (path: string) => path,
  inBrowser: false,
}));

const PAGES: Record<string, () => Promise<{ default: Component }>> = {
  analyzer: () => import('@/demos/analyzer/AnalyzerDemo.vue'),
  mastering: () => import('@/demos/mastering/MasteringDemo.vue'),
  mixing: () => import('@/demos/mixing/MixingStudio.vue'),
  analysis: () => import('@/demos/music-analysis/MusicAnalysisStudio.vue'),
  'gs-module': () => import('@/demos/gs-module/GsModuleDemo.vue'),
  'step-bass': () => import('@/demos/step-bass/StepBassDemo.vue'),
  transcribe: () => import('@/demos/transcribe/TranscribeDemo.vue'),
  practice: () => import('@/demos/practice/PianoPracticeDemo.vue'),
  fx: () => import('@/demos/realtime-fx/RealtimeFxLab.vue'),
  spatial: () => import('@/demos/spatial/SpatialScanner.vue'),
  studio: () => import('@/demos/studio/StudioDemo.vue'),
  synth: () => import('@/demos/synth/SynthDemo.vue'),
};

describe('server rendering a demo page', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  for (const [id, load] of Object.entries(PAGES)) {
    it(`leaves no timer behind on ${id}`, async () => {
      const page = (await load()).default;
      await renderToString(createSSRApp(page));
      expect(vi.getTimerCount()).toBe(0);
    });
  }
});
