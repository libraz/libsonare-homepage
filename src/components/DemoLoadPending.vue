<script setup lang="ts">
import SignalLoader from '@/components/ui/SignalLoader.vue';
import { DEFAULT_LOCALE, localeMessages, normalizeLocale } from '@/locales';

// The inline-demo registry imports this statically and must stay free of VitePress,
// so the locale comes from the page's lang attribute (a loading state only renders client-side).
const locale = normalizeLocale(
  typeof document === 'undefined' ? undefined : document.documentElement.lang,
);
const messages = (localeMessages[locale] ?? localeMessages[DEFAULT_LOCALE]).ui as {
  loadingDemo: string;
};
</script>

<template>
  <SignalLoader class="demo-load-pending" compact :stage="messages.loadingDemo" />
</template>

<style scoped>
.demo-load-pending { min-height: 8rem; }
</style>
