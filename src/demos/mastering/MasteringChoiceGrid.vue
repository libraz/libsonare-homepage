<script setup lang="ts" generic="T extends string">
/**
 * A single-choice card grid for the Quick axes (recording condition, genre).
 * Each card names the choice and its one-line intent; the details sit behind
 * the info button.
 */
import { Tooltip } from '@/components/ui';
import { useMasteringCopy } from '@/demos/mastering/masteringCopy';

export interface MasteringChoice<Id extends string> {
  id: Id;
  icon: string;
  name: string;
  tagline: string;
  description: string;
  tip: string;
}

defineProps<{
  modelValue: T;
  options: MasteringChoice<T>[];
  label: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: T] }>();

const copy = useMasteringCopy();
</script>

<template>
  <div class="choices" role="radiogroup" :aria-label="label">
    <div v-for="option in options" :key="option.id" class="choice">
      <button
        type="button"
        role="radio"
        class="choice__card"
        :aria-checked="modelValue === option.id"
        :disabled="disabled"
        @click="emit('update:modelValue', option.id)"
      >
        <span class="choice__icon">{{ option.icon }}</span>
        <span class="choice__name">{{ option.name }}</span>
        <span class="choice__tagline">{{ option.tagline }}</span>
      </button>
      <Tooltip
        :eyebrow="label"
        :title="option.name"
        :body="option.description"
        :tip="option.tip"
        :tip-label="copy.tips.useWhen"
      >
        <button type="button" class="choice__info" :aria-label="`${option.name}: ${option.description}`" @click.stop.prevent>
          <span aria-hidden="true">i</span>
        </button>
      </Tooltip>
    </div>
  </div>
</template>

<style scoped>
.choices {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 8px;
}

.choice {
  position: relative;
  display: flex;
}

.choice__card {
  display: grid;
  grid-template-rows: auto auto 1fr;
  gap: 4px;
  width: 100%;
  min-height: 96px;
  padding: 10px 12px;
  border: 1px solid var(--demo-border);
  border-radius: 6px;
  background: transparent;
  color: var(--demo-text);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.choice__card:hover {
  border-color: var(--demo-border-strong);
}

.choice__card[aria-checked='true'] {
  border-color: var(--demo-accent);
  background: var(--demo-accent-subtle);
}

.choice__card:disabled {
  opacity: var(--demo-disabled-opacity);
  cursor: not-allowed;
}

.choice__card:focus-visible,
.choice__info:focus-visible {
  outline: 2px solid var(--demo-accent);
  outline-offset: 2px;
}

.choice__icon {
  color: var(--demo-text-faint);
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

[aria-checked='true'] .choice__icon {
  color: var(--demo-accent);
}

.choice__name {
  color: var(--demo-text-strong);
  font-size: 13px;
  font-weight: 650;
  line-height: 1.3;
}

.choice__tagline {
  color: var(--demo-text-muted);
  font-size: 11px;
  line-height: 1.45;
}

.choice__info {
  position: absolute;
  top: 8px;
  right: 8px;
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: 1px solid var(--demo-border);
  border-radius: 50%;
  background: var(--demo-bg-elevated);
  color: var(--demo-text-muted);
  font-family: var(--font-mono);
  font-size: 10px;
  cursor: help;
}

@media (prefers-reduced-motion: reduce) {
  .choice__card {
    transition: none;
  }
}
</style>
