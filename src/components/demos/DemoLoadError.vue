<script setup lang="ts">
import { useI18n } from '@/composables/useI18n';

const { t } = useI18n();

function reload() {
  if (typeof window !== 'undefined') window.location.reload();
}
</script>

<template>
  <div class="demo-load-error" role="alert">
    <strong>{{ t('demo.inline.loadError.title') }}</strong>
    <span>{{ t('demo.inline.loadError.body') }}</span>
    <button type="button" @click="reload">{{ t('demo.inline.loadError.reload') }}</button>
  </div>
</template>

<style scoped>
.demo-load-error { display: grid; place-items: center; gap: .75rem; min-height: 12rem; padding: 2rem; text-align: center; color: var(--vp-c-text-1); }
.demo-load-error span { color: var(--vp-c-text-2); }
.demo-load-error button { padding: .5rem 1.25rem; border: 1px solid var(--vp-c-brand-1); border-radius: 8px; background: var(--vp-c-brand-1); color: white; cursor: pointer; }
</style>
