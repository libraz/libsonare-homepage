<script setup lang="ts">
import SignalLoader from '@/components/ui/SignalLoader.vue';
</script>

<template>
  <div class="site-page-pending">
    <SignalLoader stage="Loading…" />
  </div>
</template>

<style scoped>
.site-page-pending {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--demo-bg);
  color: var(--demo-text);
}
</style>
