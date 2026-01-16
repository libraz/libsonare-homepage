<script setup lang="ts">
defineProps<{
  active?: boolean
  duration?: number
  color?: string
}>()
</script>

<template>
  <div
    class="scan-line"
    :class="{ 'scan-line--active': active }"
    :style="{
      '--scan-duration': duration ? `${duration}s` : undefined,
      '--scan-color': color
    }"
  ></div>
</template>

<style scoped>
.scan-line {
  --scan-color: #8B5CF6;
  --scan-duration: 3s;

  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--scan-color), transparent);
  opacity: 0;
  pointer-events: none;
  z-index: 10;
}

.scan-line--active {
  animation: scan var(--scan-duration) ease-in-out infinite;
}

@keyframes scan {
  0% {
    top: 0;
    opacity: 0;
  }
  10% {
    opacity: 0.6;
  }
  90% {
    opacity: 0.6;
  }
  100% {
    top: calc(100% - 2px);
    opacity: 0;
  }
}
</style>
