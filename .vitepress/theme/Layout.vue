<script setup lang="ts">
import { useData } from 'vitepress'
import { computed } from 'vue'
import DefaultTheme from 'vitepress/theme'
import DemoLayout from './DemoLayout.vue'
import LandingLayout from './LandingLayout.vue'
import MasteringDemo from '@/components/MasteringDemo.vue'

const DefaultLayout = DefaultTheme.Layout
const { frontmatter } = useData()
const isLanding = computed(() => frontmatter.value.layout === 'landing')
const isDemo = computed(() => frontmatter.value.layout === 'demo')
const isMaster = computed(() => frontmatter.value.layout === 'master')
</script>

<template>
  <LandingLayout v-if="isLanding" />
  <DemoLayout v-else-if="isDemo" />
  <MasteringDemo v-else-if="isMaster" />
  <DefaultLayout v-else />
</template>
