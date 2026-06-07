<script setup lang="ts">
import { MetricItem, StatusIndicator, TechPanel, Tooltip } from '@/components/ui';
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
  canApply?: boolean;
  qualityTargetLufs?: number | null;
}>();

const emit = defineEmits<{
  refresh: [];
  apply: [];
}>();

const { locale, t } = useI18n();

function formatGain(value: number): string {
  if (!Number.isFinite(value)) return '-';
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(1)} dB`;
}

function formatCeiling(value: number): string {
  if (!Number.isFinite(value)) return '-';
  return `${value.toFixed(1)} dBTP`;
}

function formatLufs(value: number): string {
  if (!Number.isFinite(value)) return '-';
  return `${value.toFixed(1)} LUFS`;
}

function formatSuggestion(move: string): string {
  if (locale.value !== 'ja') return move;

  const genre = move.match(/^base preset selected from top genre candidate:\s*(.+)$/i);
  if (genre) return `最上位ジャンル候補からベースプリセットを選択: ${genre[1]}`;

  const translations: Record<string, string> = {
    'target loudness and ceiling applied from AssistantConfig':
      '目標ラウドネスとシーリングをアシスタント設定から適用',
    'air band enabled because the spectral profile is dark':
      'スペクトルが暗いため、Air Band を有効化',
    'transient shaper enabled for dense attacks':
      'アタックが密なため、トランジェントシェイパーを有効化',
    'bass-heavy fast material gets mild tilt and tape drive':
      '低域が強く速い素材のため、軽い Tilt とテープドライブを適用',
    'Trim low end': '低域を整理',
    'Limit true peak': 'True Peak を制御',
    'Add air': 'Air を追加',
    'Lower the limiter ceiling': 'リミッターのシーリングを下げる',
    'Narrow the low end': '低域の広がりを抑える',
  };

  return translations[move] ?? move;
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

        <div class="master-insights__panel master-insights__panel--suggestions">
          <header class="master-insights__head">
            <span>{{ t('master.insights.suggestions') }}</span>
            <span class="master-insights__actions">
              <button
                type="button"
                class="master-insights__button master-insights__button--apply"
                :disabled="analyzing || !canApply"
                @click="emit('apply')"
              >
                {{ t('master.insights.apply') }}
              </button>
              <button
                type="button"
                class="master-insights__button master-insights__button--refresh"
                :disabled="analyzing"
                @click="emit('refresh')"
              >
                {{ t('master.insights.refresh') }}
              </button>
            </span>
          </header>
          <div class="master-insights__body">
            <p v-if="qualityTargetLufs != null" class="master-insights__quality">
              {{ t('master.insights.qualityGuard', { value: formatLufs(qualityTargetLufs) }) }}
            </p>
            <ul v-if="suggestions.length" class="master-insights__moves">
              <li v-for="(move, index) in suggestions" :key="index">{{ formatSuggestion(move) }}</li>
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
              <span class="master-insights__platform-gain" :class="{ 'is-down': row.normalizationGainDb < 0 }">
                {{ formatGain(row.normalizationGainDb) }}
              </span>
              <span v-if="row.ceilingRisk" class="master-insights__platform-risk">
                <Tooltip
                  :title="t('master.insights.ceilingRisk')"
                  :body="t('master.insights.ceilingRiskBody')"
                  :tip="t('master.insights.ceilingRiskTip')"
                  :tip-label="t('master.insights.ceilingRiskTipLabel')"
                >
                  <span class="master-insights__ceiling">{{ t('master.insights.ceilingRisk') }}</span>
                </Tooltip>
                <span class="master-insights__safe-ceiling">
                  {{ t('master.insights.safeCeiling', { value: formatCeiling(row.safeCeilingDb) }) }}
                </span>
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
  grid-template-rows: 32px minmax(0, 1fr);
  align-content: start;
  gap: 12px;
  min-height: 190px;
  padding: 12px;
  border-left: 1px solid var(--demo-border);
  background: transparent;
}

.master-insights__panel:first-child {
  border-left: 0;
}

/* The suggestions column carries the primary "apply" action — give it a
   faint accent wash so the eye lands on the actionable payoff. */
.master-insights__panel--suggestions {
  border-left: 0;
  border-radius: 8px;
  padding: 12px;
  background: var(--demo-accent-subtle);
}

.master-insights__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 32px;
  min-width: 0;
}

.master-insights__head > span {
  color: var(--demo-text-strong);
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.master-insights__actions {
  display: inline-flex;
  flex: 0 0 auto;
  gap: 6px;
}

.master-insights__body {
  display: grid;
  align-content: start;
  gap: 10px;
}

.master-insights__body :deep(.metric-item) {
  min-height: 22px;
}

.master-insights__empty {
  margin: 0;
  color: var(--demo-text-muted);
  font-size: 12px;
  line-height: 1.6;
}

.master-insights__quality {
  margin: 0;
  padding: 8px 10px;
  border: 1px solid var(--demo-warn-border, var(--demo-border-strong));
  border-radius: 6px;
  background: var(--demo-warn-bg, transparent);
  color: var(--demo-warn-text);
  font-size: 11px;
  line-height: 1.5;
}

.master-insights__moves {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.master-insights__moves li {
  position: relative;
  min-height: 22px;
  padding-left: 16px;
  color: var(--demo-text);
  font-size: 12px;
  line-height: 1.45;
}

.master-insights__moves li::before {
  content: '›';
  position: absolute;
  left: 2px;
  color: var(--demo-accent-light);
  font-weight: 700;
}

.master-insights__platform {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 3px 10px;
  padding: 5px 0;
}

.master-insights__platform + .master-insights__platform {
  border-top: 1px solid var(--demo-border);
}

.master-insights__platform-name {
  grid-column: 1;
  min-width: 0;
  color: var(--demo-text);
  font-size: 12px;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.master-insights__platform-gain {
  grid-column: 2;
  justify-self: end;
  min-width: 52px;
  color: var(--demo-text-strong);
  font-family: var(--font-mono);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.master-insights__platform-gain.is-down {
  color: var(--demo-warn-text);
}

.master-insights__platform-risk {
  grid-column: 1 / -1;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.master-insights__ceiling {
  flex: none;
  padding: 1px 6px;
  border: 1px solid var(--demo-warn-border);
  border-radius: 999px;
  background: var(--demo-warn-bg);
  color: var(--demo-warn-text);
  font-family: var(--font-mono);
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  white-space: nowrap;
  cursor: help;
}

.master-insights__safe-ceiling {
  min-width: 0;
  color: var(--demo-text-muted);
  font-family: var(--font-mono);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.master-insights__button {
  min-width: 72px;
  min-height: 28px;
  padding: 0 10px;
  border: 1px solid var(--demo-border);
  border-radius: 6px;
  background: var(--demo-bg-elevated);
  color: var(--demo-text);
  cursor: pointer;
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.master-insights__button--apply {
  border-color: var(--demo-accent-border);
  background: var(--demo-accent);
  color: var(--demo-on-accent);
}

.master-insights__button--refresh {
  border-color: color-mix(in srgb, var(--demo-cyan) 32%, transparent);
  background: var(--demo-bg-elevated);
  color: var(--demo-cyan);
}

.master-insights__button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

/* Staggered reveal so the insight columns compose in with the result panels. */
.master-insights__panel {
  animation: insights-rise 0.35s ease both;
}

.master-insights__panel:nth-child(2) { animation-delay: 0.05s; }
.master-insights__panel:nth-child(3) { animation-delay: 0.1s; }

@keyframes insights-rise {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: none; }
}

@media (prefers-reduced-motion: reduce) {
  .master-insights__panel {
    animation: none;
  }
}

@media (max-width: 980px) {
  .master-insights__grid {
    grid-template-columns: 1fr;
  }

  .master-insights__panel {
    border-top: 1px solid var(--demo-border);
    border-left: 0;
    padding-top: 14px;
  }

  .master-insights__panel:first-child {
    border-top: 0;
  }
}

@media (max-width: 560px) {
  .master-insights__head {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
