<script setup lang="ts">
defineProps<{
  status?: 'online' | 'offline' | 'idle' | 'active' | 'warning' | 'error'
  label?: string
  pulse?: boolean
}>()
</script>

<template>
  <div class="status-indicator" :class="[`status-indicator--${status || 'idle'}`, { 'status-indicator--pulse': pulse }]">
    <span class="status-indicator__dot"></span>
    <span v-if="label" class="status-indicator__label">{{ label }}</span>
    <slot />
  </div>
</template>

<style scoped>
.status-indicator {
  --status-color: rgba(255, 255, 255, 0.3);

  display: inline-flex;
  align-items: center;
  gap: 8px;
}

/* Status colors */
.status-indicator--online,
.status-indicator--active {
  --status-color: #22C55E;
}

.status-indicator--offline {
  --status-color: rgba(255, 255, 255, 0.2);
}

.status-indicator--idle {
  --status-color: rgba(255, 255, 255, 0.4);
}

.status-indicator--warning {
  --status-color: #F59E0B;
}

.status-indicator--error {
  --status-color: #EF4444;
}

.status-indicator__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--status-color);
  box-shadow: 0 0 10px var(--status-color);
  flex-shrink: 0;
}

.status-indicator--pulse .status-indicator__dot {
  animation: status-pulse 2s ease-in-out infinite;
}

.status-indicator__label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 500;
  letter-spacing: 0.15em;
  color: var(--status-color);
  text-transform: uppercase;
  opacity: 0.9;
}

@keyframes status-pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(0.9);
  }
}
</style>
