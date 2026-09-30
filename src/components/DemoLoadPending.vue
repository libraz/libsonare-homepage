<script setup lang="ts">
import SignalLoader from '@/components/ui/SignalLoader.vue';
</script>

<template>
  <SignalLoader class="demo-load-pending" compact stage="Loading demo…" />
</template>

<style scoped>
.demo-load-pending { min-height: 8rem; }
</style>
