<script setup lang="ts">
import { useData } from 'vitepress'
import { computed } from 'vue'
import DefaultTheme from 'vitepress/theme'
import DemoLayout from './DemoLayout.vue'

const DefaultLayout = DefaultTheme.Layout
const { frontmatter } = useData()
const isDemo = computed(() => frontmatter.value.layout === 'demo')
</script>

<template>
  <DemoLayout v-if="isDemo" />
  <DefaultLayout v-else />
</template>
