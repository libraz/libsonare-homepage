<script setup lang="ts">
defineProps<{
  title?: string
  variant?: 'default' | 'transparent'
}>()
</script>

<template>
  <div class="tech-panel" :class="[variant && `tech-panel--${variant}`]">
    <div v-if="title" class="tech-panel__header">
      <span class="tech-panel__title">{{ title }}</span>
      <slot name="header-right" />
    </div>
    <div class="tech-panel__body">
      <slot />
    </div>
    <div v-if="$slots.footer" class="tech-panel__footer">
      <slot name="footer" />
    </div>
  </div>
</template>

<style scoped>
.tech-panel {
  --panel-bg: rgba(8, 10, 14, 0.85);
  --panel-border: rgba(139, 92, 246, 0.15);
  --panel-header-bg: rgba(20, 22, 28, 0.8);
  --panel-text: rgba(255, 255, 255, 0.4);

  display: flex;
  flex-direction: column;
  background: var(--panel-bg);
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  overflow: hidden;
  backdrop-filter: blur(10px);
}

.tech-panel--transparent {
  --panel-bg: transparent;
  border: none;
  backdrop-filter: none;
}

.tech-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--panel-header-bg);
  border-bottom: 1px solid var(--panel-border);
}

.tech-panel__title {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.15em;
  color: var(--panel-text);
  text-transform: uppercase;
}

.tech-panel__body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.tech-panel__body::-webkit-scrollbar {
  display: none;
}

.tech-panel__footer {
  padding: 8px 12px;
  border-top: 1px solid var(--panel-border);
  background: var(--panel-header-bg);
}
</style>
