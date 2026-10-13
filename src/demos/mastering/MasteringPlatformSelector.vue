<script setup lang="ts">
/**
 * Delivery target: a platform's loudness, or a custom value. Shows the genre's
 * recommendation and warns when the target is louder than it.
 */
import { computed } from 'vue';
import { DemoNotice, Tooltip } from '@/components/ui';
import MasterKnob from '@/demos/mastering/MasterKnob.vue';
import { useMasteringCopy } from '@/demos/mastering/masteringCopy';
import {
  formatNumber,
  MASTERING_LOUD_WARNING_LU,
  MASTERING_PLATFORMS,
} from '@/demos/mastering/masteringUi';
import type { MasteringPlatformId } from '@/demos/mastering/useMastering';
import { fill } from '@/utils/template';

const props = defineProps<{
  platform: MasteringPlatformId;
  customLufs: number;
  targetLufs: number;
  recommendedLufs: number;
  presetName: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  platform: [id: MasteringPlatformId];
  customLufs: [lufs: number];
  begin: [];
  end: [];
}>();

const copy = useMasteringCopy();

const louder = computed(
  () => props.targetLufs - props.recommendedLufs >= MASTERING_LOUD_WARNING_LU,
);

const options: (HTMLButtonElement | null)[] = [];

function onKeydown(event: KeyboardEvent, index: number): void {
  const delta =
    event.key === 'ArrowRight' || event.key === 'ArrowDown'
      ? 1
      : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
        ? -1
        : 0;
  if (delta === 0) return;
  event.preventDefault();
  const next = (index + delta + MASTERING_PLATFORMS.length) % MASTERING_PLATFORMS.length;
  emit('platform', MASTERING_PLATFORMS[next].id);
  options[next]?.focus();
}
</script>

<template>
  <div class="platforms">
    <div class="platforms__grid" role="radiogroup" :aria-label="copy.quick.steps.platform">
      <div v-for="(option, index) in MASTERING_PLATFORMS" :key="option.id" class="platforms__item">
        <button
          :ref="(el) => (options[index] = el as HTMLButtonElement | null)"
          type="button"
          role="radio"
          class="platforms__option"
          :aria-checked="platform === option.id"
          :tabindex="platform === option.id ? 0 : -1"
          :disabled="disabled"
          @click="emit('platform', option.id)"
          @keydown="onKeydown($event, index)"
        >
          <span>{{ copy.platforms.names[option.id] }}</span>
          <strong>{{ formatNumber(option.id === 'custom' ? customLufs : option.lufs, 1) }} LUFS</strong>
        </button>
        <span class="platforms__info">
          <Tooltip
            :title="copy.platforms.names[option.id]"
            :body="copy.platforms.descriptions[option.id]"
            :aria-label="copy.platforms.names[option.id]"
          />
        </span>
      </div>
    </div>
    <Transition name="demo-rise">
      <MasterKnob
        v-if="platform === 'custom'"
        class="platforms__custom"
        :model-value="customLufs"
        :min="-24"
        :max="-8"
        :step="0.5"
        unit="LUFS"
        :default="-14"
        :label="copy.quick.customTarget"
        :disabled="disabled"
        @begin="emit('begin')"
        @end="emit('end')"
        @update:model-value="emit('customLufs', $event)"
      />
    </Transition>
    <DemoNotice tone="hint">
      {{ fill(copy.platforms.recommended, { preset: presetName, lufs: formatNumber(recommendedLufs, 0) }) }}
    </DemoNotice>
    <DemoNotice v-if="louder" tone="warn">
      {{ fill(copy.platforms.loudWarning, { preset: presetName }) }}
    </DemoNotice>
  </div>
</template>

<style scoped>
.platforms {
  display: grid;
  gap: 10px;
}

.platforms__grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 6px;
}

.platforms__item {
  position: relative;
  display: flex;
}

.platforms__option {
  display: grid;
  gap: 2px;
  width: 100%;
  padding: 8px 26px 8px 10px;
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

.platforms__option:hover:not(:disabled) {
  border-color: var(--demo-border-strong);
}

.platforms__option:active:not(:disabled) {
  transform: scale(0.97);
}

.platforms__option span {
  font-size: 12.5px;
  font-weight: 600;
}

.platforms__option strong {
  color: var(--demo-text-muted);
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.platforms__option[aria-checked='true'] {
  border-color: var(--demo-accent);
  background: var(--demo-accent-subtle);
}

.platforms__option[aria-checked='true'] strong {
  color: var(--demo-accent);
}

.platforms__option:disabled {
  opacity: var(--demo-disabled-opacity);
  cursor: not-allowed;
}

.platforms__option:focus-visible {
  outline: 2px solid var(--demo-accent);
  outline-offset: 2px;
}

.platforms__info {
  position: absolute;
  top: 7px;
  right: 7px;
  display: inline-flex;
}

.platforms__custom {
  max-width: 320px;
}

@media (max-width: 720px) {
  .platforms__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
