<script setup lang="ts">
import { Tooltip } from '@/components/ui';
import { useI18n } from '@/composables/useI18n';
import type { MasteringPresetId } from '@/composables/useMastering';

defineProps<{
  modelValue: MasteringPresetId;
  presets: Array<{ id: MasteringPresetId; icon: string }>;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: MasteringPresetId];
}>();

const { t } = useI18n();
</script>

<template>
  <div class="preset-grid">
    <div
      v-for="preset in presets"
      :key="preset.id"
      class="preset-card-wrap"
    >
      <button
        type="button"
        class="preset-card"
        :class="{ 'preset-card--active': modelValue === preset.id }"
        @click="emit('update:modelValue', preset.id)"
      >
        <span class="preset-card__icon">{{ preset.icon }}</span>
        <span class="preset-card__name">{{ t(`master.presets.${preset.id}.name`) }}</span>
        <span class="preset-card__tagline">{{ t(`master.presets.${preset.id}.tagline`) }}</span>
      </button>
      <Tooltip
        :eyebrow="t('master.quick.step3')"
        :title="t(`master.presets.${preset.id}.name`)"
        :body="t(`master.presets.${preset.id}.description`)"
        :tip="t(`master.presets.${preset.id}.tip`)"
        :tip-label="t('master.tips.useWhen')"
      >
        <button
          type="button"
          class="preset-card__info"
          :aria-label="t('master.glossary.openGuide')"
          @click.stop.prevent
        >
          <span aria-hidden="true">i</span>
        </button>
      </Tooltip>
    </div>
  </div>
</template>

<style scoped>
.preset-grid {
  display: flex;
  gap: 10px;
  min-width: 0;
  padding: 14px;
  overflow-x: auto;
  overflow-y: hidden;
  scroll-padding-inline: 14px;
  scroll-snap-type: x proximity;
  overscroll-behavior-x: contain;
  scrollbar-width: thin;
}

.preset-card-wrap {
  flex: 0 0 clamp(150px, 18vw, 176px);
  position: relative;
  display: flex;
  scroll-snap-align: start;
}

.preset-card-wrap > .preset-card {
  width: 100%;
}

.preset-card {
  display: grid;
  grid-template-rows: 16px 36px 42px;
  gap: 8px;
  height: 136px;
  padding: 14px 10px 12px;
  border: 1px solid var(--demo-border);
  border-radius: 8px;
  background: var(--master-surface);
  color: var(--demo-text);
  cursor: pointer;
  text-align: left;
}

.preset-card--active {
  border-color: var(--demo-accent-border);
  background: var(--demo-accent-subtle);
}

.preset-card__icon {
  align-self: start;
  color: var(--demo-cyan);
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 800;
  line-height: 1.2;
}

.preset-card__name {
  align-self: center;
  color: var(--demo-text-strong);
  font-size: 13px;
  font-weight: 700;
  line-height: 1.35;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow-wrap: anywhere;
}

.preset-card__tagline {
  align-self: end;
  color: var(--demo-text-muted);
  font-size: 10px;
  line-height: 1.4;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.preset-card__info {
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

.preset-card-wrap:hover .preset-card__info,
.preset-card__info:focus-visible {
  opacity: 1;
}

.preset-card__info:hover,
.preset-card__info:focus-visible {
  border-color: var(--demo-accent-border);
  color: var(--demo-accent-light);
}

.preset-card__info > span {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 800;
}

@media (max-width: 900px) {
  .preset-grid {
    padding-inline: 12px;
  }

  .preset-card-wrap {
    flex-basis: clamp(146px, 46vw, 172px);
  }
}
</style>
