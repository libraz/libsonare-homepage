<script setup lang="ts">
import { useData } from 'vitepress';
import { computed } from 'vue';
import ToolShell from '@/components/ToolShell.vue';
import SignalLoader from '@/components/ui/SignalLoader.vue';
import { useI18n } from '@/composables/useI18n';
import type { DemoId } from '@/demos/manifest';

/** Page-level stand-in while a demo chunk loads: the site shell stays up, the loader fills the body. */
const props = defineProps<{ demoId: DemoId }>();

const { frontmatter } = useData();
const { t } = useI18n();
const title = computed(() => String(frontmatter.value.title ?? '').replace(/^libsonare\s+/, ''));
</script>

<template>
  <ToolShell :demo-id="props.demoId" :title="title">
    <SignalLoader class="demo-page-pending" :stage="t('ui.loadingDemo')" />
  </ToolShell>
</template>

<style scoped>
.demo-page-pending {
  min-height: 60vh;
}
</style>
