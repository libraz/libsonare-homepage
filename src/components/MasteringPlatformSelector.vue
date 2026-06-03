<script setup lang="ts">
import { computed } from 'vue';
import { Tooltip } from '@/components/ui';
import { useI18n } from '@/composables/useI18n';
import type { MasteringPlatformId } from '@/composables/useMastering';
import { MASTERING_LOUD_WARNING_LU } from '@/utils/masteringUi';

const props = defineProps<{
  modelValue: MasteringPlatformId;
  customLufs: number;
  platforms: Array<{ id: MasteringPlatformId; lufs: number }>;
  eyebrow: string;
  studio?: boolean;
  recommendedLufs?: number;
  currentLufs?: number;
  presetName?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: MasteringPlatformId];
  'update:customLufs': [value: number];
}>();

const { t } = useI18n();

const hasRecommendation = computed(() => typeof props.recommendedLufs === 'number');

// Streaming only attenuates, so "louder than recommended" (numerically higher
// LUFS) is what risks the loudness stage flattening dynamic material.
const isLouderThanRecommended = computed(
  () =>
    hasRecommendation.value &&
    typeof props.currentLufs === 'number' &&
    props.currentLufs - (props.recommendedLufs as number) >= MASTERING_LOUD_WARNING_LU,
);
</script>

<template>
  <div class="platform-grid" :class="{ 'platform-grid--studio': studio }">
    <div
      v-for="platform in platforms"
      :key="platform.id"
      class="platform-option-wrap"
    >
      <label
        class="platform-option"
        :class="{ 'platform-option--active': modelValue === platform.id }"
      >
        <input
          type="radio"
          :value="platform.id"
          :checked="modelValue === platform.id"
          @change="emit('update:modelValue', platform.id)"
        >
        <span>{{ t(`master.platforms.${platform.id}`) }}</span>
        <strong>{{ platform.id === 'custom' ? `${customLufs} LUFS` : `${platform.lufs} LUFS` }}</strong>
      </label>
      <Tooltip
        :eyebrow="eyebrow"
        :title="t(`master.platforms.${platform.id}`)"
        :body="t(`master.platforms.descriptions.${platform.id}`)"
        :tip="t(`master.platforms.useWhen.${platform.id}`)"
        :tip-label="t('master.tips.useWhen')"
      >
        <button
          type="button"
          class="platform-option__info"
          :aria-label="t('master.glossary.openGuide')"
          @click.stop.prevent
        >
          <span aria-hidden="true">i</span>
        </button>
      </Tooltip>
    </div>
  </div>

  <div v-if="hasRecommendation" class="platform-rec" :class="{ 'platform-rec--inline': studio }">
    <span class="platform-rec__badge">
      {{ t('master.platforms.recommended', { preset: presetName, lufs: recommendedLufs }) }}
    </span>
    <p v-if="isLouderThanRecommended" class="platform-rec__warning" role="status">
      {{ t('master.platforms.loudWarning', { preset: presetName }) }}
    </p>
  </div>

  <label v-if="modelValue === 'custom'" class="master-slider" :class="{ 'master-slider--inline': studio }">
    <span>{{ t('master.quick.customTarget') }}</span>
    <input
      type="range"
      min="-24"
      max="-8"
      step="0.5"
      :value="customLufs"
      @input="emit('update:customLufs', Number(($event.target as HTMLInputElement).value))"
    >
    <strong>{{ customLufs }} LUFS</strong>
  </label>
</template>

<style scoped>
.platform-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
  padding: 14px;
}

.platform-grid--studio {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  padding: 0;
}

.platform-option-wrap {
  position: relative;
  display: flex;
}

.platform-option-wrap > .platform-option {
  width: 100%;
}

.platform-option {
  display: grid;
  gap: 5px;
  min-height: 72px;
  padding: 12px;
  border: 1px solid var(--demo-border);
  border-radius: 8px;
  background: var(--master-surface);
  color: var(--demo-text);
  cursor: pointer;
}

.platform-option {
  transition: border-color 0.16s ease, background-color 0.16s ease, transform 0.16s ease;
}

.platform-option:hover {
  border-color: var(--demo-accent);
  transform: translateY(-2px);
}

.platform-option:focus-within {
  outline: 2px solid var(--demo-accent);
  outline-offset: 2px;
}

.platform-option--active {
  border-color: var(--demo-accent-border);
  background: var(--demo-accent-subtle);
}

/* Visually hidden but still keyboard-focusable so the label gets :focus-within. */
.platform-option input {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  border: 0;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  overflow: hidden;
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  .platform-option {
    transition: none;
  }
}

.platform-option span {
  color: var(--demo-text-strong);
  font-size: 12px;
  font-weight: 700;
}

.platform-option strong,
.master-slider strong {
  color: var(--demo-cyan);
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
}

.platform-option__info {
  position: absolute;
  top: 7px;
  right: 7px;
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border: 1px solid var(--demo-border);
  border-radius: 999px;
  background: var(--demo-bg-elevated);
  color: var(--demo-text-muted);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.18s ease, border-color 0.18s ease, color 0.18s ease;
}

.platform-option-wrap:hover .platform-option__info,
.platform-option__info:focus-visible {
  opacity: 1;
}

.platform-option__info:hover,
.platform-option__info:focus-visible {
  border-color: var(--demo-accent-border);
  color: var(--demo-accent-light);
}

.platform-option__info > span {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 800;
}

.platform-rec {
  display: grid;
  gap: 8px;
  padding: 0 14px 12px;
}

.platform-rec--inline {
  padding: 10px 0 0;
}

.platform-rec__badge {
  justify-self: start;
  padding: 4px 10px;
  border: 1px solid var(--demo-accent-border);
  border-radius: 999px;
  background: var(--demo-accent-subtle);
  color: var(--demo-accent-light);
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 700;
}

.platform-rec__warning {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  padding: 8px 10px;
  border: 1px solid var(--demo-warn-border);
  border-radius: 6px;
  background: var(--demo-warn-bg);
  color: var(--demo-warn-text);
  font-size: 11px;
  line-height: 1.45;
}

.platform-rec__warning::before {
  content: '!';
  flex: none;
  display: grid;
  place-items: center;
  width: 16px;
  height: 16px;
  margin-top: 1px;
  border-radius: 999px;
  background: var(--demo-warn);
  color: var(--demo-bg);
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 800;
  line-height: 1;
}

.master-slider {
  display: grid;
  grid-template-columns: minmax(130px, 0.8fr) minmax(160px, 1.5fr) minmax(58px, auto);
  gap: 12px;
  align-items: center;
  padding: 12px 14px 16px;
}

.master-slider--inline {
  padding: 10px 0 0;
}

.master-slider input {
  width: 100%;
  accent-color: var(--demo-accent);
}

@media (max-width: 900px) {
  .platform-grid,
  .platform-grid--studio,
  .master-slider {
    grid-template-columns: 1fr;
  }
}
</style>
