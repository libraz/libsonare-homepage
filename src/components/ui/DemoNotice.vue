<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';

/**
 * The one callout for hints, degradations and errors. `error` is announced
 * as an alert, `warn` / `info` / `success` as a status, `hint` is static help.
 */
const props = withDefaults(
  defineProps<{
    tone: 'hint' | 'info' | 'warn' | 'error' | 'success';
    title?: string;
    dismissible?: boolean;
  }>(),
  { title: undefined, dismissible: false },
);

const emit = defineEmits<{ dismiss: [] }>();

const { t } = useI18n();

const role = computed(() => {
  if (props.tone === 'error') return 'alert';
  if (props.tone === 'hint') return undefined;
  return 'status';
});
</script>

<template>
  <Transition name="demo-rise" appear>
    <div class="demo-notice" :class="`demo-notice--${tone}`" :role="role">
      <svg class="demo-notice__icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <template v-if="tone === 'error'">
          <circle cx="12" cy="12" r="9" /><path d="M15 9l-6 6M9 9l6 6" />
        </template>
        <template v-else-if="tone === 'warn'">
          <path d="M12 3.5 2.5 20h19L12 3.5z" /><path d="M12 10v4.5M12 17.5v.01" />
        </template>
        <template v-else-if="tone === 'success'">
          <circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.7 2.7L16 10" />
        </template>
        <template v-else-if="tone === 'hint'">
          <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" />
        </template>
        <template v-else>
          <circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8v.01" />
        </template>
      </svg>
      <div class="demo-notice__body">
        <strong v-if="title" class="demo-notice__title">{{ title }}</strong>
        <div class="demo-notice__text"><slot /></div>
      </div>
      <div v-if="$slots.action" class="demo-notice__action"><slot name="action" /></div>
      <button
        v-if="dismissible"
        type="button"
        class="demo-notice__dismiss"
        :aria-label="t('ui.dismiss')"
        @click="emit('dismiss')"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
    </div>
  </Transition>
</template>

<style scoped>
.demo-notice {
  --notice-fg: var(--demo-accent);
  --notice-text: var(--demo-text);
  --notice-bg: var(--demo-accent-subtle);
  --notice-border: var(--demo-accent-border);

  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 9px 12px;
  border: 1px solid var(--notice-border);
  border-radius: var(--demo-radius-sm);
  background: var(--notice-bg);
  color: var(--notice-text);
  font-size: 12px;
  line-height: 1.5;
}

/* Static help reads as an annotation, not a box: only the tones that report
   something carry a border and tint. */
.demo-notice--hint {
  --notice-fg: var(--demo-text-faint);
  --notice-text: var(--demo-text-muted);
  --notice-bg: transparent;
  --notice-border: transparent;

  padding: 2px 0;
}

.demo-notice--info {
  --notice-fg: var(--demo-info-fg);
  --notice-text: var(--demo-info-text);
  --notice-bg: var(--demo-info-bg);
  --notice-border: var(--demo-info-border);
}

.demo-notice--warn {
  --notice-fg: var(--demo-warn);
  --notice-text: var(--demo-warn-text);
  --notice-bg: var(--demo-warn-bg);
  --notice-border: var(--demo-warn-border);
}

.demo-notice--error {
  --notice-fg: var(--demo-error-fg);
  --notice-text: var(--demo-error-text);
  --notice-bg: var(--demo-error-bg);
  --notice-border: var(--demo-error-border);
}

.demo-notice--success {
  --notice-fg: var(--demo-success);
  --notice-text: var(--demo-success-text);
  --notice-bg: var(--demo-success-bg);
  --notice-border: var(--demo-success-border);
}

.demo-notice__icon {
  flex: none;
  margin-top: 2px;
  color: var(--notice-fg);
}

.demo-notice__body {
  display: grid;
  flex: 1 1 auto;
  gap: 2px;
  min-width: 0;
}

.demo-notice__title {
  color: var(--notice-text);
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.demo-notice__text :deep(p) {
  margin: 0;
}

.demo-notice__action {
  flex: none;
  align-self: center;
}

.demo-notice__dismiss {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  margin: -3px -6px -3px 0;
  padding: 0;
  border: 0;
  border-radius: calc(var(--demo-radius-sm) - 2px);
  background: transparent;
  color: var(--notice-text);
  cursor: pointer;
  opacity: 0.7;
  transition: opacity var(--demo-dur-fast) var(--demo-ease-standard);
}

.demo-notice__dismiss:hover {
  opacity: 1;
}

.demo-notice__dismiss:focus-visible {
  outline: 2px solid var(--demo-accent);
  outline-offset: 1px;
  opacity: 1;
}
</style>
