<script setup lang="ts">
import Tooltip from './Tooltip.vue';

withDefaults(
  defineProps<{
    /** Visible label text (fallback when no default slot is provided). */
    label?: string;
    eyebrow?: string;
    title?: string;
    body?: string;
    tip?: string;
    tipLabel?: string;
    defaultValue?: string;
    defaultRationale?: string;
    defaultLabel?: string;
    href?: string;
    linkLabel?: string;
    placement?: 'auto' | 'top' | 'bottom';
    maxWidth?: number;
    /** Visual weight of the label. */
    tone?: 'muted' | 'strong';
    /** Mono uppercase styling (matches metric/control labels). */
    mono?: boolean;
    /** Hide the info dot (underline-only) for dense / repeated contexts. */
    compact?: boolean;
  }>(),
  {
    placement: 'auto',
    maxWidth: 296,
    tone: 'muted',
    mono: true,
    compact: false,
  },
);
</script>

<template>
  <Tooltip
    :eyebrow="eyebrow"
    :title="title || label"
    :body="body"
    :tip="tip"
    :tip-label="tipLabel"
    :default-value="defaultValue"
    :default-rationale="defaultRationale"
    :default-label="defaultLabel"
    :href="href"
    :link-label="linkLabel"
    :placement="placement"
    :max-width="maxWidth"
    :aria-label="title || label"
  >
    <span
      class="term-label"
      :class="[`term-label--${tone}`, { 'term-label--mono': mono }]"
      tabindex="0"
      role="button"
    >
      <span class="term-label__text"><slot>{{ label }}</slot></span>
      <span v-if="!compact" class="term-label__dot" aria-hidden="true">i</span>
    </span>
  </Tooltip>
</template>

<style scoped>
.term-label {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  cursor: help;
  outline: none;
}

.term-label__text {
  border-bottom: 1px dotted color-mix(in srgb, var(--demo-accent, #8B5CF6) 55%, transparent);
  transition: border-color 0.18s ease, color 0.18s ease;
}

.term-label--mono .term-label__text {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 400;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.term-label--muted .term-label__text {
  color: var(--demo-text-muted, rgba(255, 255, 255, 0.4));
}

.term-label--strong .term-label__text {
  color: var(--demo-text-strong, rgba(255, 255, 255, 0.85));
}

.term-label__dot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 12px;
  height: 12px;
  border: 1px solid color-mix(in srgb, var(--demo-accent, #8B5CF6) 45%, transparent);
  border-radius: 50%;
  color: var(--demo-accent-light, #A78BFA);
  font-family: 'JetBrains Mono', monospace;
  font-size: 8px;
  font-weight: 700;
  font-style: italic;
  line-height: 1;
  transition: background-color 0.18s ease, color 0.18s ease, border-color 0.18s ease;
}

.term-label:hover .term-label__text,
.term-label:focus-visible .term-label__text {
  color: var(--demo-accent-light, #A78BFA);
  border-bottom-color: var(--demo-accent, #8B5CF6);
}

.term-label:hover .term-label__dot,
.term-label:focus-visible .term-label__dot {
  background: var(--demo-accent, #8B5CF6);
  border-color: var(--demo-accent, #8B5CF6);
  color: #fff;
}

html:not(.dark) .term-label__dot {
  color: var(--demo-accent, #7C3AED);
}
</style>
