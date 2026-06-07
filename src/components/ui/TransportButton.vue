<script setup lang="ts">
defineProps<{
  variant?: 'default' | 'primary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  round?: boolean;
  disabled?: boolean;
}>();

defineEmits<(e: 'click') => void>();
</script>

<template>
  <button
    class="transport-btn"
    :class="[
      variant && `transport-btn--${variant}`,
      size && `transport-btn--${size}`,
      { 'transport-btn--round': round, 'transport-btn--disabled': disabled }
    ]"
    :disabled="disabled"
    @click="$emit('click')"
  >
    <slot />
  </button>
</template>

<style scoped>
.transport-btn {
  --btn-bg: var(--demo-accent-subtle, rgba(139, 92, 246, 0.1));
  --btn-border: var(--demo-accent-border, rgba(139, 92, 246, 0.15));
  --btn-color: var(--demo-text-strong, rgba(255, 255, 255, 0.8));
  --btn-size: 40px;
  --btn-radius: 6px;

  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: var(--btn-size);
  height: var(--btn-size);
  padding: 8px;
  background: var(--btn-bg);
  border: 1px solid var(--btn-border);
  border-radius: var(--btn-radius);
  color: var(--btn-color);
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 500;
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: background-color var(--transition-fast), border-color var(--transition-fast),
    color var(--transition-fast), box-shadow var(--transition-fast), transform var(--transition-fast);
}

.transport-btn:hover:not(:disabled) {
  background: var(--demo-accent-dim, rgba(139, 92, 246, 0.2));
  border-color: var(--demo-accent, rgba(139, 92, 246, 0.4));
}

.transport-btn:active:not(:disabled) {
  transform: scale(0.96);
}

/* Variants */
.transport-btn--primary {
  --btn-bg: var(--demo-accent);
  --btn-border: var(--demo-accent);
  --btn-color: var(--demo-on-accent);
}

.transport-btn--primary:hover:not(:disabled) {
  background: var(--demo-accent-light);
  border-color: var(--demo-accent-light);
  box-shadow: 0 0 20px var(--demo-accent-dim);
}

/* The bloom on the primary button is a dark-mode effect; drop it on light panels. */
html:not(.dark) .transport-btn--primary:hover:not(:disabled) {
  box-shadow: none;
}

.transport-btn--ghost {
  --btn-bg: transparent;
  --btn-border: transparent;
}

.transport-btn--ghost:hover:not(:disabled) {
  --btn-bg: var(--demo-accent-subtle, rgba(139, 92, 246, 0.1));
}

/* Sizes */
.transport-btn--sm {
  --btn-size: 32px;
  padding: 6px;
}

.transport-btn--lg {
  --btn-size: 48px;
  padding: 10px;
}

/* Round */
.transport-btn--round {
  --btn-radius: 50%;
}

/* Disabled */
.transport-btn--disabled,
.transport-btn:disabled {
  opacity: var(--demo-disabled-opacity);
  cursor: not-allowed;
}
</style>
