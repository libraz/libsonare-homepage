<script setup lang="ts">
import MasteringWaveform from '@/components/MasteringWaveform.vue';
import { AudioTransport, MetricItem, Tooltip } from '@/components/ui';
import { useI18n } from '@/composables/useI18n';
import type { DecodedMasteringAudio } from '@/composables/useMastering';

interface ReferenceMetrics {
  duration: string;
  peak: string;
  crest: string;
  correlation: string;
}

defineProps<{
  reference: DecodedMasteringAudio | null;
  referenceMetrics: ReferenceMetrics | null;
  referenceUrl: string | null;
  masterCrest: string | null;
  isRendering: boolean;
  canMatch: boolean;
}>();

const emit = defineEmits<{
  file: [event: Event];
  match: [];
}>();

const { t } = useI18n();
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
  </div>
</template>

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

@media (max-width: 900px) {
  .reference-panel__row {
    grid-template-columns: 1fr;
  }
}
</style>
