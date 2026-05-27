<script setup lang="ts">
export interface ToolModeOption {
  id: string;
  label: string;
}

defineProps<{
  modelValue: string;
  ariaLabel: string;
  options: ToolModeOption[];
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();
</script>

<template>
  <nav class="tool-mode-tabs" :aria-label="ariaLabel">
    <button
      v-for="option in options"
      :key="option.id"
      type="button"
      class="tool-mode-tabs__button"
      :class="{ 'tool-mode-tabs__button--active': modelValue === option.id }"
      @click="emit('update:modelValue', option.id)"
    >
      {{ option.label }}
    </button>
  </nav>
</template>

<style scoped>
.tool-mode-tabs {
  display: inline-flex;
  gap: 4px;
  padding: 3px;
  border: 1px solid var(--demo-border);
  border-radius: 8px;
  background: var(--master-code-bg);
}

html:not(.dark) .tool-mode-tabs {
  background: rgba(255, 255, 255, 0.55);
}

.tool-mode-tabs__button {
  min-width: 130px;
  height: 30px;
  padding: 0 12px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--demo-text-muted);
  cursor: pointer;
  font: inherit;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.05em;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.tool-mode-tabs__button:hover {
  color: var(--demo-text-strong);
}

.tool-mode-tabs__button--active {
  background: var(--demo-accent);
  color: #fff;
}
</style>
