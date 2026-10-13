<script setup lang="ts">
/**
 * The one "i" help trigger. A button by default; `decorative` renders a
 * plain mark for a parent that is itself the focusable trigger (TermLabel).
 */
withDefaults(
  defineProps<{
    /** Accessible name; required unless `decorative`. */
    label?: string;
    size?: 'sm' | 'md';
    decorative?: boolean;
  }>(),
  { label: undefined, size: 'md', decorative: false },
);
</script>

<template>
  <span v-if="decorative" class="info-dot info-dot--decorative" :class="`info-dot--${size}`" aria-hidden="true">i</span>
  <button v-else type="button" class="info-dot" :class="`info-dot--${size}`" :aria-label="label">
    <span aria-hidden="true">i</span>
  </button>
</template>

<style scoped>
.info-dot {
  --info-dot-size: 14px;

  position: relative;
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--info-dot-size);
  height: var(--info-dot-size);
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--demo-accent) 45%, transparent);
  border-radius: 50%;
  background: transparent;
  color: var(--demo-accent-light);
  font-family: var(--font-body);
  font-size: 8px;
  font-style: italic;
  font-weight: 700;
  line-height: 1;
  transition:
    background-color var(--demo-dur-fast) var(--demo-ease-standard),
    border-color var(--demo-dur-fast) var(--demo-ease-standard),
    color var(--demo-dur-fast) var(--demo-ease-standard);
}

html:not(.dark) .info-dot {
  color: var(--demo-accent);
}

.info-dot--sm {
  --info-dot-size: 12px;
}

button.info-dot {
  cursor: pointer;
}

/* 24px hit area around the visible dot. */
button.info-dot::after {
  content: '';
  position: absolute;
  inset: calc((var(--info-dot-size) - 24px) / 2);
  border-radius: 50%;
}

/* A decorative dot lights up with the parent that owns the interaction. */
button.info-dot:hover,
button.info-dot:focus-visible,
:hover > .info-dot--decorative,
:focus-visible > .info-dot--decorative {
  border-color: var(--demo-accent);
  background: var(--demo-accent);
  color: var(--demo-on-accent);
}

button.info-dot:focus-visible {
  outline: 2px solid var(--demo-accent);
  outline-offset: 2px;
}
</style>
