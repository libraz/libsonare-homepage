<script setup lang="ts">
/** Empty state for a panel that has nothing to show yet, centred in its parent. */
withDefaults(
  defineProps<{
    title: string;
    compact?: boolean;
  }>(),
  { compact: false },
);
</script>

<template>
  <div class="demo-empty" :class="{ 'demo-empty--compact': compact }">
    <svg class="demo-empty__icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M2 12h3l2-5 3 10 3-14 3 12 2-3h4" />
    </svg>
    <p class="demo-empty__title">{{ title }}</p>
    <div v-if="$slots.default" class="demo-empty__body"><slot /></div>
    <div v-if="$slots.action" class="demo-empty__action"><slot name="action" /></div>
  </div>
</template>

<style scoped>
.demo-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 100%;
  padding: 32px 20px;
  color: var(--demo-text-muted);
  text-align: center;
}

.demo-empty--compact {
  gap: 6px;
  padding: 16px 12px;
}

.demo-empty__icon {
  color: var(--demo-text-faint);
}

.demo-empty--compact .demo-empty__icon {
  width: 18px;
  height: 18px;
}

.demo-empty__title {
  margin: 0;
  color: var(--demo-text);
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.demo-empty__body {
  max-width: 42ch;
  font-size: 12px;
  line-height: 1.5;
}

.demo-empty__body :deep(p) {
  margin: 0;
}

.demo-empty__action {
  margin-top: 4px;
}
</style>
