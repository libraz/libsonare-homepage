<script setup lang="ts">
import { Tooltip } from '@/components/ui';
import { useI18n } from '@/composables/useI18n';
import type { MasteringVenueId } from '@/composables/useMastering';

defineProps<{
  modelValue: MasteringVenueId;
  venues: Array<{ id: MasteringVenueId; icon: string }>;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: MasteringVenueId];
}>();

const { t } = useI18n();
</script>

<template>
  <div class="venue-row">
    <p class="venue-row__hint">{{ t('master.venue.hint') }}</p>
    <div class="venue-grid">
      <div
        v-for="venue in venues"
        :key="venue.id"
        class="venue-option-wrap"
      >
        <button
          type="button"
          class="venue-option"
          :class="{ 'venue-option--active': modelValue === venue.id }"
          @click="emit('update:modelValue', venue.id)"
        >
          <span class="venue-option__icon">{{ venue.icon }}</span>
          <span class="venue-option__name">{{ t(`master.venues.${venue.id}.name`) }}</span>
          <span class="venue-option__tagline">{{ t(`master.venues.${venue.id}.tagline`) }}</span>
        </button>
        <Tooltip
          :eyebrow="t('master.venue.label')"
          :title="t(`master.venues.${venue.id}.name`)"
          :body="t(`master.venues.${venue.id}.description`)"
          :tip="t(`master.venues.${venue.id}.tip`)"
          :tip-label="t('master.tips.useWhen')"
        >
          <button
            type="button"
            class="venue-option__info"
            :aria-label="t('master.glossary.openGuide')"
            @click.stop.prevent
          >
            <span aria-hidden="true">i</span>
          </button>
        </Tooltip>
      </div>
    </div>
  </div>
</template>

<style scoped>
.venue-row {
  display: grid;
  gap: 10px;
  padding: 14px;
}

.venue-row__hint {
  margin: 0;
  color: var(--demo-text-muted);
  font-size: 11px;
  line-height: 1.45;
}

.venue-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.venue-option-wrap {
  position: relative;
  display: flex;
}

.venue-option-wrap > .venue-option {
  width: 100%;
}

.venue-option {
  display: grid;
  grid-template-rows: 16px auto;
  gap: 4px;
  padding: 10px 10px 12px;
  border: 1px solid var(--demo-border);
  border-radius: 8px;
  background: var(--master-surface);
  color: var(--demo-text);
  cursor: pointer;
  text-align: left;
}

.venue-option {
  transition: border-color 0.16s ease, background-color 0.16s ease, transform 0.16s ease;
}

.venue-option:hover {
  border-color: var(--demo-accent);
  transform: translateY(-2px);
}

.venue-option:focus-visible {
  outline: 2px solid var(--demo-accent);
  outline-offset: 2px;
}

.venue-option--active {
  border-color: var(--demo-accent-border);
  background: var(--demo-accent-subtle);
}

@media (prefers-reduced-motion: reduce) {
  .venue-option {
    transition: none;
  }
}

.venue-option__icon {
  align-self: start;
  color: var(--demo-cyan);
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 800;
  line-height: 1.2;
}

.venue-option__name {
  color: var(--demo-text-strong);
  font-size: 12px;
  font-weight: 700;
  line-height: 1.3;
}

.venue-option__tagline {
  color: var(--demo-text-muted);
  font-size: 10px;
  line-height: 1.4;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.venue-option__info {
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

.venue-option-wrap:hover .venue-option__info,
.venue-option__info:focus-visible {
  opacity: 1;
}

.venue-option__info:hover,
.venue-option__info:focus-visible {
  border-color: var(--demo-accent-border);
  color: var(--demo-accent-light);
}

.venue-option__info > span {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 800;
}

@media (max-width: 900px) {
  .venue-grid {
    grid-template-columns: 1fr;
  }
}
</style>
