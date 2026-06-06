<script setup lang="ts">
import { computed } from 'vue';
import MasteringWaveform from '@/components/MasteringWaveform.vue';
import { AudioTransport, MetricItem, Tooltip } from '@/components/ui';
import { useI18n } from '@/composables/useI18n';
import type { DecodedMasteringAudio, ReferenceAnalysisReport } from '@/composables/useMastering';

interface ReferenceMetrics {
  duration: string;
  peak: string;
  crest: string;
  correlation: string;
}

const props = defineProps<{
  reference: DecodedMasteringAudio | null;
  referenceMetrics: ReferenceMetrics | null;
  referenceAnalysis: ReferenceAnalysisReport | null;
  referenceUrl: string | null;
  masterCrest: string | null;
  isRendering: boolean;
  isAnalyzing: boolean;
  canMatch: boolean;
}>();

const emit = defineEmits<{
  file: [event: Event];
  match: [];
}>();

const { t } = useI18n();

const analysis = computed(() => buildAnalysisItems(props.referenceAnalysis, t));
</script>

<template>
  <div class="reference-panel">
    <MasteringWaveform
      v-if="reference"
      class="reference-panel__wave"
      :audio="reference"
      variant="source"
      :mode-label="t('master.reference.title')"
      :height="72"
    />
    <AudioTransport v-if="reference" :src="referenceUrl" />
    <div class="reference-panel__row">
      <label class="reference-panel__drop">
        <input type="file" accept="audio/*" @change="emit('file', $event)">
        <span>{{ reference?.fileName || t('master.reference.drop') }}</span>
      </label>
      <div class="meter-stack">
        <MetricItem :label="t('master.meters.duration')" :value="referenceMetrics?.duration || '-'" />
        <MetricItem :label="t('master.meters.peak')" :value="referenceMetrics?.peak || '-'" />
        <MetricItem :label="t('master.meters.crest')" :value="referenceMetrics?.crest || '-'" />
        <MetricItem :label="t('master.meters.correlation')" :value="referenceMetrics?.correlation || '-'" />
      </div>
      <div class="reference-panel__compare">
        <span>{{ t('master.reference.masterDelta') }}</span>
        <strong>{{ masterCrest && referenceMetrics ? `${masterCrest} / ${referenceMetrics.crest}` : '-' }}</strong>
        <Tooltip
          :title="t('master.reference.match')"
          :body="t('master.reference.matchHint')"
        >
          <button
            type="button"
            class="reference-panel__button"
            :disabled="!canMatch || isRendering"
            @click="emit('match')"
          >
            {{ isRendering ? t('master.reference.matching') : t('master.reference.match') }}
          </button>
        </Tooltip>
      </div>
    </div>
    <div
      v-if="reference"
      class="reference-panel__analysis"
      :class="{ 'reference-panel__analysis--busy': isAnalyzing }"
    >
      <div class="reference-panel__analysis-head">
        <span class="reference-panel__analysis-title">{{ t('master.reference.analysisTitle') }}</span>
        <span
          class="reference-panel__analysis-state"
          :class="{ 'is-busy': isAnalyzing }"
        >
          <i aria-hidden="true"></i>
          {{ isAnalyzing ? t('master.reference.analyzing') : analysis.status }}
        </span>
      </div>
      <div class="reference-panel__analysis-grid">
        <MetricItem
          layout="column"
          :label="t('master.reference.loudnessDelta')"
          :value="analysis.loudness"
          variant="accent"
        />
        <MetricItem
          layout="column"
          :label="t('master.reference.tonalDelta')"
          :value="analysis.tonal"
        />
        <MetricItem
          layout="column"
          :label="t('master.reference.monoCompat')"
          :value="analysis.mono"
        />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
type Translate = (key: string) => string;

interface TonalBand {
  lowHz?: number;
  highHz?: number;
  deviationDb?: number;
}

function buildAnalysisItems(report: ReferenceAnalysisReport | null, t: Translate) {
  if (!report) {
    return {
      loudness: '-',
      tonal: '-',
      mono: '-',
      status: t('master.reference.analysisPending'),
    };
  }

  const loudness = objectValue(report.loudness);
  const gainToMatchDb = numberValue(loudness.gainToMatchDb);
  const tonalBalance = objectValue(report.tonalBalance);
  const bands = Array.isArray(tonalBalance.bands) ? (tonalBalance.bands as TonalBand[]) : [];
  const deviations = bands
    .map((band) => ({ ...band, deviationDb: numberValue(band.deviationDb) }))
    .filter((band): band is TonalBand & { deviationDb: number } => band.deviationDb !== null);
  const avgDeviation =
    deviations.length > 0
      ? deviations.reduce((sum, band) => sum + Math.abs(band.deviationDb), 0) / deviations.length
      : null;
  const strongest = deviations.reduce<TonalBand & { deviationDb: number } | null>(
    (current, band) =>
      !current || Math.abs(band.deviationDb) > Math.abs(current.deviationDb) ? band : current,
    null,
  );

  const mono = objectValue(report.monoCompatibility);
  const correlation = numberValue(mono.correlation);
  const width = numberValue(mono.width);
  const monoOk = typeof mono.likelyMonoCompatible === 'boolean' ? mono.likelyMonoCompatible : null;

  return {
    loudness:
      gainToMatchDb === null
        ? '-'
        : `${formatSignedDb(gainToMatchDb)} ${t('master.reference.toMatch')}`,
    tonal:
      avgDeviation === null
        ? '-'
        : strongest
          ? `${avgDeviation.toFixed(1)} dB avg / ${formatBand(strongest)} ${formatSignedDb(strongest.deviationDb)}`
          : `${avgDeviation.toFixed(1)} dB avg`,
    mono:
      correlation === null
        ? '-'
        : `${monoOk === false ? t('master.reference.monoRisk') : t('master.reference.monoOk')} / r ${correlation.toFixed(2)}${width === null ? '' : ` / w ${width.toFixed(2)}`}`,
    status: t('master.reference.analysisReady'),
  };
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function formatSignedDb(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)} dB`;
}

function formatBand(band: TonalBand): string {
  const low = numberValue(band.lowHz);
  const high = numberValue(band.highHz);
  if (low === null || high === null) return '';
  if (high >= 1000) return `${Math.round(low)}-${(high / 1000).toFixed(high >= 10000 ? 0 : 1)}k`;
  return `${Math.round(low)}-${Math.round(high)}`;
}
</script>

<style scoped>
.reference-panel {
  display: grid;
  gap: 14px;
  padding: 14px;
}

.reference-panel__row {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) minmax(260px, 1fr) minmax(180px, 0.7fr);
  gap: 14px;
  align-items: stretch;
}

.reference-panel__drop {
  display: grid;
  place-items: center;
  min-height: 116px;
  padding: 16px;
  border: 1px dashed var(--demo-border-strong);
  border-radius: 8px;
  color: var(--demo-text-strong);
  cursor: pointer;
  text-align: center;
  overflow-wrap: anywhere;
}

.reference-panel__drop input {
  display: none;
}

.reference-panel__compare {
  display: grid;
  align-content: center;
  gap: 8px;
  padding: 14px;
  border: 1px solid var(--demo-border);
  border-radius: 8px;
  background: var(--master-surface);
}

.reference-panel__compare span {
  color: var(--demo-text-muted);
  font-size: 10px;
}

.reference-panel__compare strong {
  color: var(--demo-cyan);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.reference-panel__button {
  min-height: 34px;
  width: 100%;
  border: 1px solid var(--demo-border-strong);
  border-radius: 8px;
  background: rgba(139, 92, 246, 0.14);
  color: var(--demo-text-strong);
  cursor: pointer;
  font: inherit;
  font-size: 10px;
  font-weight: 800;
}

.reference-panel__button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.meter-stack {
  display: grid;
  gap: 14px;
  padding: 14px;
}

.reference-panel__analysis {
  position: relative;
  display: grid;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--demo-border);
  border-left: 2px solid var(--demo-accent-border);
  border-radius: 8px;
  background: var(--master-surface, var(--demo-control-bg));
  overflow: hidden;
}

.reference-panel__analysis-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.reference-panel__analysis-title {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--demo-text-faint);
}

.reference-panel__analysis-state {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 9px 3px 7px;
  border: 1px solid var(--demo-border);
  border-radius: 999px;
  background: var(--demo-control-bg-strong);
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--demo-text-muted);
}

.reference-panel__analysis-state i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--demo-success);
  box-shadow: 0 0 6px var(--demo-success);
}

.reference-panel__analysis-state.is-busy {
  color: var(--demo-text-strong);
  border-color: var(--demo-accent-border);
}

.reference-panel__analysis-state.is-busy i {
  background: var(--demo-accent);
  box-shadow: 0 0 6px var(--demo-accent);
  animation: reference-blink 1s ease-in-out infinite;
}

.reference-panel__analysis-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

/* Subtle sweep across the panel while the reference is being analysed. */
.reference-panel__analysis--busy::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    100deg,
    transparent 30%,
    var(--demo-accent-subtle) 50%,
    transparent 70%
  );
  background-size: 220% 100%;
  animation: reference-sweep 1.4s linear infinite;
  pointer-events: none;
}

@keyframes reference-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

@keyframes reference-sweep {
  0% { background-position: 130% 0; }
  100% { background-position: -130% 0; }
}

@media (prefers-reduced-motion: reduce) {
  .reference-panel__analysis-state.is-busy i {
    animation: none;
  }

  .reference-panel__analysis--busy::after {
    animation: none;
    background: var(--demo-accent-subtle);
  }
}

@media (max-width: 900px) {
  .reference-panel__row {
    grid-template-columns: 1fr;
  }

  .reference-panel__analysis-grid {
    grid-template-columns: 1fr;
  }
}
</style>
