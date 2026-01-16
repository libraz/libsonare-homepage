<script setup lang="ts">
defineProps<{
  size?: 'sm' | 'md' | 'lg'
  offset?: 'sm' | 'md' | 'lg'
  color?: string
}>()
</script>

<template>
  <div class="corner-brackets" :class="[size && `corner-brackets--${size}`, offset && `corner-brackets--offset-${offset}`]">
    <div class="corner-brackets__bracket corner-brackets__bracket--tl" :style="color ? { borderColor: color } : {}"></div>
    <div class="corner-brackets__bracket corner-brackets__bracket--tr" :style="color ? { borderColor: color } : {}"></div>
    <div class="corner-brackets__bracket corner-brackets__bracket--bl" :style="color ? { borderColor: color } : {}"></div>
    <div class="corner-brackets__bracket corner-brackets__bracket--br" :style="color ? { borderColor: color } : {}"></div>
  </div>
</template>

<style scoped>
.corner-brackets {
  --bracket-size: 20px;
  --bracket-offset: 10px;
  --bracket-color: rgba(139, 92, 246, 0.2);
  --bracket-width: 2px;

  position: absolute;
  inset: 0;
  pointer-events: none;
}

/* Size variants */
.corner-brackets--sm {
  --bracket-size: 12px;
  --bracket-width: 1px;
}

.corner-brackets--lg {
  --bracket-size: 30px;
  --bracket-width: 2px;
}

/* Offset variants */
.corner-brackets--offset-sm {
  --bracket-offset: 6px;
}

.corner-brackets--offset-lg {
  --bracket-offset: 16px;
}

.corner-brackets__bracket {
  position: absolute;
  width: var(--bracket-size);
  height: var(--bracket-size);
  border: var(--bracket-width) solid var(--bracket-color);
  transition: border-color 0.25s ease;
}

.corner-brackets__bracket--tl {
  top: var(--bracket-offset);
  left: var(--bracket-offset);
  border-right: none;
  border-bottom: none;
}

.corner-brackets__bracket--tr {
  top: var(--bracket-offset);
  right: var(--bracket-offset);
  border-left: none;
  border-bottom: none;
}

.corner-brackets__bracket--bl {
  bottom: var(--bracket-offset);
  left: var(--bracket-offset);
  border-right: none;
  border-top: none;
}

.corner-brackets__bracket--br {
  bottom: var(--bracket-offset);
  right: var(--bracket-offset);
  border-left: none;
  border-top: none;
}
</style>
