<script setup lang="ts">
/**
 * Delivery target: a platform's loudness, or a custom value. Shows the genre's
 * recommendation and warns when the target is louder than it.
 */
import { computed } from 'vue';
import { Tooltip } from '@/components/ui';
import MasterKnob from '@/demos/mastering/MasterKnob.vue';
import { fill, useMasteringCopy } from '@/demos/mastering/masteringCopy';
import {
  formatNumber,
  MASTERING_LOUD_WARNING_LU,
  MASTERING_PLATFORMS,
} from '@/demos/mastering/masteringUi';
import type { MasteringPlatformId } from '@/demos/mastering/useMastering';

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
</script>

<template>
  <div class="platforms">
    <div class="platforms__grid" role="radiogroup" :aria-label="copy.quick.steps.platform">
      <div v-for="option in MASTERING_PLATFORMS" :key="option.id" class="platforms__item">
        <button
          type="button"
          role="radio"
          class="platforms__option"
          :aria-checked="platform === option.id"
          :disabled="disabled"
          @click="emit('platform', option.id)"
        >
          <span>{{ copy.platforms.names[option.id] }}</span>
          <strong>{{ formatNumber(option.id === 'custom' ? customLufs : option.lufs, 1) }} LUFS</strong>
        </button>
        <Tooltip :title="copy.platforms.names[option.id]" :body="copy.platforms.descriptions[option.id]">
          <button type="button" class="platforms__info" :aria-label="copy.platforms.descriptions[option.id]" @click.stop.prevent>
            <span aria-hidden="true">i</span>
          </button>
        </Tooltip>
      </div>
    </div>
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
    <p class="platforms__rec">
      {{ fill(copy.platforms.recommended, { preset: presetName, lufs: formatNumber(recommendedLufs, 0) }) }}
    </p>
    <p v-if="louder" class="platforms__warn" role="note">
      {{ fill(copy.platforms.loudWarning, { preset: presetName }) }}
    </p>
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
  padding: 8px 10px;
  border: 1px solid var(--demo-border);
  border-radius: 6px;
  background: transparent;
  color: var(--demo-text);
  text-align: left;
  cursor: pointer;
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

.platforms__option:focus-visible,
.platforms__info:focus-visible {
  outline: 2px solid var(--demo-accent);
  outline-offset: 2px;
}

.platforms__info {
  position: absolute;
  top: 6px;
  right: 6px;
  display: grid;
  place-items: center;
  width: 16px;
  height: 16px;
  padding: 0;
  border: 1px solid var(--demo-border);
  border-radius: 50%;
  background: var(--demo-bg-elevated);
  color: var(--demo-text-muted);
  font-family: var(--font-mono);
  font-size: 9px;
  cursor: help;
}

.platforms__custom {
  max-width: 320px;
}

.platforms__rec,
.platforms__warn {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
}

.platforms__rec {
  color: var(--demo-text-muted);
  font-family: var(--font-mono);
  font-size: 11px;
}

.platforms__warn {
  padding: 8px 10px;
  border: 1px solid var(--demo-warn-border);
  border-radius: 6px;
  background: var(--demo-warn-bg);
  color: var(--demo-warn-text);
}

@media (max-width: 720px) {
  .platforms__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
