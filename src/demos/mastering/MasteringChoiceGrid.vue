<script setup lang="ts" generic="T extends string">
/**
 * A single-choice card grid for the Quick axes (recording condition, genre).
 * Each card names the choice and its one-line intent; the details sit behind
 * the info dot. Arrow keys move the choice, as in any radiogroup.
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

const props = defineProps<{
  modelValue: T;
  options: MasteringChoice<T>[];
  label: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: T] }>();

const copy = useMasteringCopy();
const cards: (HTMLButtonElement | null)[] = [];

function onKeydown(event: KeyboardEvent, index: number): void {
  const delta =
    event.key === 'ArrowRight' || event.key === 'ArrowDown'
      ? 1
      : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
        ? -1
        : 0;
  if (delta === 0) return;
  event.preventDefault();
  const next = (index + delta + props.options.length) % props.options.length;
  emit('update:modelValue', props.options[next].id);
  cards[next]?.focus();
}
</script>

<template>
  <div class="choices" role="radiogroup" :aria-label="label">
    <div v-for="(option, index) in options" :key="option.id" class="choice">
      <button
        :ref="(el) => (cards[index] = el as HTMLButtonElement | null)"
        type="button"
        role="radio"
        class="choice__card"
        :aria-checked="modelValue === option.id"
        :tabindex="modelValue === option.id ? 0 : -1"
        :disabled="disabled"
        @click="emit('update:modelValue', option.id)"
        @keydown="onKeydown($event, index)"
      >
        <span class="choice__icon">{{ option.icon }}</span>
        <span class="choice__name">{{ option.name }}</span>
        <span class="choice__tagline">{{ option.tagline }}</span>
      </button>
      <span class="choice__info">
        <Tooltip
          :eyebrow="label"
          :title="option.name"
          :body="option.description"
          :tip="option.tip"
          :tip-label="copy.tips.useWhen"
          :aria-label="option.name"
        />
      </span>
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
  border-radius: var(--demo-radius-sm);
  background: transparent;
  color: var(--demo-text);
  text-align: left;
  cursor: pointer;
  transition:
    border-color var(--demo-dur-fast) var(--demo-ease-standard),
    background-color var(--demo-dur-fast) var(--demo-ease-standard),
    transform var(--demo-dur-instant) var(--demo-ease-standard);
}

.choice__card:hover:not(:disabled) {
  border-color: var(--demo-border-strong);
}

.choice__card:active:not(:disabled) {
  transform: scale(0.97);
}

.choice__card[aria-checked='true'] {
  border-color: var(--demo-accent);
  background: var(--demo-accent-subtle);
}

.choice__card:disabled {
  opacity: var(--demo-disabled-opacity);
  cursor: not-allowed;
}

.choice__card:focus-visible {
  outline: 2px solid var(--demo-accent);
  outline-offset: 2px;
}

.choice__icon {
  color: var(--demo-text-faint);
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  transition: color var(--demo-dur-fast) var(--demo-ease-standard);
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
  top: 9px;
  right: 9px;
  display: inline-flex;
}
</style>
