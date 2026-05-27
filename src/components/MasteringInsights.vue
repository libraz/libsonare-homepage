<script setup lang="ts">
import { MetricItem, StatusIndicator, TechPanel } from '@/components/ui';
import { useI18n } from '@/composables/useI18n';
import type { MasteringPreviewRow } from '@/composables/useMasteringInsights';

export interface MasteringInsightItem {
  label: string;
  value: string;
}

defineProps<{
  analyzing: boolean;
  hasReport: boolean;
  profileItems: MasteringInsightItem[];
  suggestions: string[];
  preview: MasteringPreviewRow[];
}>();

const emit = defineEmits<{
  refresh: [];
}>();

const { t } = useI18n();

function formatGain(value: number): string {
  if (!Number.isFinite(value)) return '-';
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(1)} dB`;
}
</script>

<template>
  <section class="master-insights">
    <TechPanel :title="t('master.insights.title')">
      <div class="master-insights__grid">
        <div class="master-insights__panel">
          <header class="master-insights__head">
            <span>{{ t('master.insights.profile') }}</span>
            <StatusIndicator
              :status="analyzing ? 'warning' : hasReport ? 'active' : 'idle'"
              :label="analyzing ? t('master.insights.analyzing') : t('master.insights.ready')"
              :pulse="analyzing"
            />
          </header>
          <div class="master-insights__body">
            <MetricItem
              v-for="item in profileItems"
              :key="item.label"
              :label="item.label"
              :value="item.value"
            />
            <p v-if="!profileItems.length" class="master-insights__empty">
              {{ t('master.insights.empty') }}
            </p>
          </div>
        </div>

        <div class="master-insights__panel master-insights__panel--accent">
          <header class="master-insights__head">
            <span>{{ t('master.insights.suggestions') }}</span>
            <button
              type="button"
              class="master-insights__refresh"
              :disabled="analyzing"
              @click="emit('refresh')"
            >
              {{ t('master.insights.refresh') }}
            </button>
          </header>
          <div class="master-insights__body">
            <ul v-if="suggestions.length" class="master-insights__moves">
              <li v-for="(move, index) in suggestions" :key="index">{{ move }}</li>
            </ul>
            <p v-else class="master-insights__empty">
              {{ t('master.insights.suggestionHint') }}
            </p>
          </div>
        </div>

        <div class="master-insights__panel">
          <header class="master-insights__head">
            <span>{{ t('master.insights.deliveryPreview') }}</span>
          </header>
          <div class="master-insights__body">
            <div
              v-for="row in preview"
              :key="row.name"
              class="master-insights__platform"
              :class="{ 'master-insights__platform--risk': row.ceilingRisk }"
            >
              <span class="master-insights__platform-name">{{ row.name }}</span>
              <span
                v-if="row.ceilingRisk"
                class="master-insights__ceiling"
                :title="t('master.insights.ceilingRisk')"
              >{{ t('master.insights.ceilingRisk') }}</span>
              <span class="master-insights__platform-gain" :class="{ 'is-down': row.normalizationGainDb < 0 }">
                {{ formatGain(row.normalizationGainDb) }}
              </span>
            </div>
            <p v-if="!preview.length" class="master-insights__empty">
              {{ t('master.insights.previewHint') }}
            </p>
          </div>
        </div>
      </div>
    </TechPanel>
  </section>
</template>

<style scoped>
.master-insights {
  margin-top: 14px;
}

.master-insights__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  padding: 14px;
}

.master-insights__panel {
  display: grid;
  gap: 10px;
  min-height: 190px;
  padding: 12px;
  border: 1px solid var(--demo-border);
  border-radius: 8px;
  background: var(--master-surface);
}

.master-insights__panel--accent {
  border-color: var(--demo-accent-border);
  background: var(--demo-accent-subtle);
}

.master-insights__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
}

.master-insights__head > span {
  color: var(--demo-text-strong);
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.master-insights__body {
  display: grid;
  align-content: start;
  gap: 9px;
}

.master-insights__empty {
  margin: 0;
  color: var(--demo-text-muted);
  font-size: 12px;
  line-height: 1.6;
}

.master-insights__moves {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.master-insights__moves li {
  position: relative;
  padding-left: 16px;
  color: var(--demo-text);
  font-size: 12px;
  line-height: 1.5;
}

.master-insights__moves li::before {
  content: '›';
  position: absolute;
  left: 2px;
  color: var(--demo-accent-light);
  font-weight: 700;
}

.master-insights__platform {
  display: flex;
  align-items: center;
  gap: 8px;
}

.master-insights__platform-name {
  color: var(--demo-text);
  font-size: 12px;
}

.master-insights__platform-gain {
  margin-left: auto;
  color: var(--demo-text-strong);
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.master-insights__platform-gain.is-down {
  color: var(--demo-warn-text);
}

.master-insights__ceiling {
  padding: 1px 6px;
  border: 1px solid var(--demo-warn-border);
  border-radius: 999px;
  background: var(--demo-warn-bg);
  color: var(--demo-warn-text);
  font-family: 'JetBrains Mono', monospace;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  white-space: nowrap;
}

.master-insights__refresh {
  min-height: 28px;
  border: 1px solid var(--demo-border);
  border-radius: 6px;
  background: var(--demo-bg-elevated);
  color: var(--demo-text);
  cursor: pointer;
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.master-insights__refresh:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

@media (max-width: 980px) {
  .master-insights__grid {
    grid-template-columns: 1fr;
  }
}
</style>
