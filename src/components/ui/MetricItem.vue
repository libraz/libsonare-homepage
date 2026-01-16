<script setup lang="ts">
defineProps<{
  label: string
  value?: string | number
  variant?: 'default' | 'accent' | 'success' | 'muted'
  layout?: 'row' | 'column'
}>()
</script>

<template>
  <div class="metric-item" :class="[layout && `metric-item--${layout}`]">
    <span class="metric-item__label">{{ label }}</span>
    <span class="metric-item__value" :class="[variant && `metric-item__value--${variant}`]">
      <slot>{{ value ?? '-' }}</slot>
    </span>
  </div>
</template>

<style scoped>
.metric-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.metric-item--column {
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}

.metric-item__label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 400;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
  flex-shrink: 0;
}

.metric-item__value {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.8);
  font-variant-numeric: tabular-nums;
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.metric-item__value--accent {
  color: #8B5CF6;
  font-weight: 600;
}

.metric-item__value--success {
  color: rgba(100, 200, 180, 0.9);
}

.metric-item__value--muted {
  color: rgba(255, 255, 255, 0.4);
}

.metric-item--column .metric-item__value {
  text-align: left;
}
</style>
