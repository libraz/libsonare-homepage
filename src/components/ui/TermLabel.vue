<script setup lang="ts">
import InfoDot from './InfoDot.vue';
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
  >
    <template #default="{ describedBy, expanded, controls }">
      <span
        class="term-label"
        :class="[`term-label--${tone}`, { 'term-label--mono': mono }]"
        tabindex="0"
        role="button"
        :aria-describedby="describedBy"
        :aria-expanded="expanded"
        :aria-controls="controls"
      >
        <span class="term-label__text"><slot>{{ label }}</slot></span>
        <InfoDot v-if="!compact" decorative size="sm" />
      </span>
    </template>
  </Tooltip>
</template>

<style scoped>
.term-label {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  outline: none;
}

.term-label__text {
  border-bottom: 1px dotted color-mix(in srgb, var(--demo-accent, #8B5CF6) 55%, transparent);
  transition:
    border-color var(--demo-dur-fast) var(--demo-ease-standard),
    color var(--demo-dur-fast) var(--demo-ease-standard);
}

.term-label--mono .term-label__text {
  font-family: var(--font-mono);
  font-size: var(--demo-label-size);
  font-weight: var(--demo-label-weight);
  letter-spacing: var(--demo-label-tracking);
  text-transform: uppercase;
}

.term-label--muted .term-label__text {
  color: var(--demo-text-muted, rgba(255, 255, 255, 0.4));
}

.term-label--strong .term-label__text {
  color: var(--demo-text-strong, rgba(255, 255, 255, 0.85));
}

.term-label:hover .term-label__text,
.term-label:focus-visible .term-label__text {
  color: var(--demo-accent-light, #A78BFA);
  border-bottom-color: var(--demo-accent, #8B5CF6);
}
</style>
