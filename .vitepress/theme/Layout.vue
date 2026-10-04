<script setup lang="ts">
import { useData } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import { computed } from 'vue';
import { defineDemoPageAsync, defineSitePageAsync } from '@/components/defineDemoPageAsync';
import NavSearch from '@/components/search/NavSearch.vue';
import { createTheme } from '@/composables/useTheme';

// Each custom route is a standalone application. Keep it out of the shared
// documentation theme and load only the application selected by frontmatter.
// A shared errorComponent turns a failed chunk load (flaky network, stale
// deploy) into a retry panel instead of a permanently blank route. Demo pages
// keep the site shell on screen while their chunk loads; the landing and demo
// index pages, which carry their own header, show a full-viewport loader.
const AnalyzerDemo = defineDemoPageAsync(
  'analyzer',
  () => import('@/demos/analyzer/AnalyzerDemo.vue'),
);
const MasteringDemo = defineDemoPageAsync(
  'mastering',
  () => import('@/demos/mastering/MasteringDemo.vue'),
);
const MixingStudio = defineDemoPageAsync('mixing', () => import('@/demos/mixing/MixingStudio.vue'));
const MusicAnalysisStudio = defineDemoPageAsync(
  'analysis',
  () => import('@/demos/music-analysis/MusicAnalysisStudio.vue'),
);
const GsModuleDemo = defineDemoPageAsync(
  'gs-module',
  () => import('@/demos/gs-module/GsModuleDemo.vue'),
);
const StepBassDemo = defineDemoPageAsync(
  'step-bass',
  () => import('@/demos/step-bass/StepBassDemo.vue'),
);
const PianoPracticeDemo = defineDemoPageAsync(
  'practice',
  () => import('@/demos/practice/PianoPracticeDemo.vue'),
);
const RealtimeFxLab = defineDemoPageAsync(
  'fx',
  () => import('@/demos/realtime-fx/RealtimeFxLab.vue'),
);
const SpatialScanner = defineDemoPageAsync(
  'spatial',
  () => import('@/demos/spatial/SpatialScanner.vue'),
);
const StudioDemo = defineDemoPageAsync('studio', () => import('@/demos/studio/StudioDemo.vue'));
const SynthDemo = defineDemoPageAsync('synth', () => import('@/demos/synth/SynthDemo.vue'));
const DemosLayout = defineSitePageAsync(() => import('./DemosLayout.vue'));
const LandingLayout = defineSitePageAsync(() => import('./LandingLayout.vue'));

defineOptions({ name: 'ThemeLayout' });

const DefaultLayout = DefaultTheme.Layout;
const { frontmatter } = useData();

// Provide a single theme context so every demo shares one toggle + isDark state.
createTheme();
const isLanding = computed(() => frontmatter.value.layout === 'landing');
const isDemos = computed(() => frontmatter.value.layout === 'demos');
const isDemo = computed(() => frontmatter.value.layout === 'demo');
const isMaster = computed(() => frontmatter.value.layout === 'master');
const isAnalysisStudio = computed(() => frontmatter.value.layout === 'analysis-studio');
const isMixingStudio = computed(() => frontmatter.value.layout === 'mixing-studio');
const isRealtimeFx = computed(() => frontmatter.value.layout === 'realtime-fx');
const isSpatial = computed(() => frontmatter.value.layout === 'spatial');
const isSynth = computed(() => frontmatter.value.layout === 'synth');
const isStudio = computed(() => frontmatter.value.layout === 'studio');
const isPractice = computed(() => frontmatter.value.layout === 'practice');
const isGsModule = computed(() => frontmatter.value.layout === 'gs-module');
const isStepBass = computed(() => frontmatter.value.layout === 'step-bass');
</script>

<template>
  <LandingLayout v-if="isLanding" />
  <DemosLayout v-else-if="isDemos" />
  <AnalyzerDemo v-else-if="isDemo" />
  <MasteringDemo v-else-if="isMaster" />
  <MusicAnalysisStudio v-else-if="isAnalysisStudio" />
  <MixingStudio v-else-if="isMixingStudio" />
  <RealtimeFxLab v-else-if="isRealtimeFx" />
  <SpatialScanner v-else-if="isSpatial" />
  <SynthDemo v-else-if="isSynth" />
  <StudioDemo v-else-if="isStudio" />
  <PianoPracticeDemo v-else-if="isPractice" />
  <GsModuleDemo v-else-if="isGsModule" />
  <StepBassDemo v-else-if="isStepBass" />
  <DefaultLayout v-else>
    <template #nav-bar-content-before>
      <NavSearch />
    </template>
  </DefaultLayout>
</template>
