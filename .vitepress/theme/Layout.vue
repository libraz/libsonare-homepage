<script setup lang="ts">
import { useData } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import { computed } from 'vue';
import AnalyzerDemo from '@/components/AnalyzerDemo.vue';
import MasteringDemo from '@/components/MasteringDemo.vue';
import MixingStudio from '@/components/MixingStudio.vue';
import MusicAnalysisStudio from '@/components/MusicAnalysisStudio.vue';
import RealtimeFxLab from '@/components/RealtimeFxLab.vue';
import SpatialScanner from '@/components/SpatialScanner.vue';
import StudioDemo from '@/components/StudioDemo.vue';
import SynthDemo from '@/components/SynthDemo.vue';
import { createTheme } from '@/composables/useTheme';
import DemosLayout from './DemosLayout.vue';
import LandingLayout from './LandingLayout.vue';

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
  <DefaultLayout v-else />
</template>
