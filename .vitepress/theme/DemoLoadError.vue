<script setup lang="ts">
import { useData } from 'vitepress';
import { computed } from 'vue';

// Shown by Layout.vue's async demo routes when the demo chunk fails to load
// (flaky connection, stale deploy). Without it a failed import leaves the route
// permanently blank with no retry.
const { lang } = useData();
const isJa = computed(() => lang.value.startsWith('ja'));

function reload() {
  if (typeof window !== 'undefined') window.location.reload();
}
</script>

<template>
  <div class="demo-load-error" role="alert">
    <p class="demo-load-error__title">
      {{ isJa ? 'デモの読み込みに失敗しました' : 'Failed to load this demo' }}
    </p>
    <p class="demo-load-error__body">
      {{
        isJa
          ? '通信状況を確認して、もう一度お試しください。'
          : 'Check your connection and try again.'
      }}
    </p>
    <button type="button" class="demo-load-error__button" @click="reload">
      {{ isJa ? '再読み込み' : 'Reload' }}
    </button>
  </div>
</template>

<style scoped>
.demo-load-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  min-height: 60vh;
  padding: 2rem;
  text-align: center;
  color: var(--vp-c-text-1);
}

.demo-load-error__title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
}

.demo-load-error__body {
  margin: 0;
  color: var(--vp-c-text-2);
}

.demo-load-error__button {
  margin-top: 0.5rem;
  padding: 0.5rem 1.25rem;
  border: 1px solid var(--vp-c-brand-1);
  border-radius: 8px;
  background: var(--vp-c-brand-1);
  color: var(--vp-c-white);
  font: inherit;
  cursor: pointer;
}

.demo-load-error__button:hover {
  background: var(--vp-c-brand-2);
  border-color: var(--vp-c-brand-2);
}

.demo-load-error__button:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
}
</style>
