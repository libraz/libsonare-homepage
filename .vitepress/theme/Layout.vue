<script setup lang="ts">
import { useData } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import { computed } from 'vue';
import { defineDemoAsync } from '@/components/demos/defineDemoAsync';
import { createTheme } from '@/composables/useTheme';

// Each custom route is a standalone application. Keep it out of the shared
// documentation theme and load only the application selected by frontmatter.
// A shared errorComponent turns a failed chunk load (flaky network, stale
// deploy) into a retry panel instead of a permanently blank route.
const AnalyzerDemo = defineDemoAsync(() => import('@/components/AnalyzerDemo.vue'));
const MasteringDemo = defineDemoAsync(() => import('@/components/MasteringDemo.vue'));
const MixingStudio = defineDemoAsync(() => import('@/components/MixingStudio.vue'));
const MusicAnalysisStudio = defineDemoAsync(() => import('@/components/MusicAnalysisStudio.vue'));
const PhysicalModelTuner = defineDemoAsync(() => import('@/components/PhysicalModelTuner.vue'));
const PianoPracticeDemo = defineDemoAsync(() => import('@/components/PianoPracticeDemo.vue'));
const RealtimeFxLab = defineDemoAsync(() => import('@/components/RealtimeFxLab.vue'));
const SpatialScanner = defineDemoAsync(() => import('@/components/SpatialScanner.vue'));
const StudioDemo = defineDemoAsync(() => import('@/components/StudioDemo.vue'));
const SynthDemo = defineDemoAsync(() => import('@/components/SynthDemo.vue'));
const DemosLayout = defineDemoAsync(() => import('./DemosLayout.vue'));
const LandingLayout = defineDemoAsync(() => import('./LandingLayout.vue'));

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
const isTuner = computed(() => frontmatter.value.layout === 'tuner');
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
  <PhysicalModelTuner v-else-if="isTuner" />
  <DefaultLayout v-else />
</template>
