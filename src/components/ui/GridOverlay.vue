<script setup lang="ts">
defineProps<{
  variant?: 'default' | 'dense' | 'sparse'
  color?: string
  opacity?: number
  scanlines?: boolean
}>()
</script>

<template>
  <div class="grid-overlay" :class="[variant && `grid-overlay--${variant}`, { 'grid-overlay--scanlines': scanlines }]">
    <div class="grid-overlay__grid" :style="color ? { '--grid-color': color } : {}"></div>
    <div v-if="scanlines" class="grid-overlay__scanlines"></div>
  </div>
</template>

<style scoped>
.grid-overlay {
  --grid-color: rgba(139, 92, 246, 0.04);
  --grid-size-major: 80px;
  --grid-size-minor: 16px;

  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.grid-overlay--dense {
  --grid-size-major: 40px;
  --grid-size-minor: 10px;
}

.grid-overlay--sparse {
  --grid-size-major: 120px;
  --grid-size-minor: 24px;
}

.grid-overlay__grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(var(--grid-color) 1px, transparent 1px),
    linear-gradient(90deg, var(--grid-color) 1px, transparent 1px),
    linear-gradient(rgba(139, 92, 246, 0.02) 1px, transparent 1px),
    linear-gradient(90deg, rgba(139, 92, 246, 0.02) 1px, transparent 1px);
  background-size:
    var(--grid-size-major) var(--grid-size-major),
    var(--grid-size-major) var(--grid-size-major),
    var(--grid-size-minor) var(--grid-size-minor),
    var(--grid-size-minor) var(--grid-size-minor);
  mask-image: radial-gradient(ellipse 90% 80% at 50% 50%, black 20%, transparent 70%);
  -webkit-mask-image: radial-gradient(ellipse 90% 80% at 50% 50%, black 20%, transparent 70%);
}

.grid-overlay__scanlines {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(0, 0, 0, 0.03) 2px,
    rgba(0, 0, 0, 0.03) 4px
  );
}
</style>
