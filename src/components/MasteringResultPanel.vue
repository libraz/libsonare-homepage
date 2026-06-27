<script setup lang="ts">
import { computed, ref } from 'vue';
import MasteringWaveform from '@/components/MasteringWaveform.vue';
import { AudioTransport, MetricItem, Tooltip } from '@/components/ui';
import { useI18n } from '@/composables/useI18n';
import type { DecodedMasteringAudio, RenderedMasteringAudio } from '@/composables/useMastering';

interface SourceMetrics {
  duration: string;
  sampleRate: string;
  channels: string;
  peak: string;
}

interface MasterMetrics {
  peak: string;
}

const props = defineProps<{
  source: DecodedMasteringAudio | null;
  sourceMetrics: SourceMetrics | null;
  masterMetrics: MasterMetrics | null;
  resultWaveAudio: DecodedMasteringAudio | RenderedMasteringAudio | null;
  resultWaveCompare: DecodedMasteringAudio | RenderedMasteringAudio | null;
  resultWaveVariant: 'source' | 'master';
  resultWaveLabel?: string;
  playbackUrl: string | null;
  listenTarget: 'source' | 'master' | 'reference';
  loudnessMatched: boolean;
  sourceUrl: string | null;
  outputUrl: string | null;
  referenceUrl: string | null;
  reportUrl: string | null;
  renderResultStages: string;
  error: string | null;
}>();

const emit = defineEmits<{
  'update:listenTarget': [value: 'source' | 'master' | 'reference'];
  'update:loudnessMatched': [value: boolean];
}>();

const { t } = useI18n();
const transport = ref<InstanceType<typeof AudioTransport> | null>(null);
const playProgress = ref(0);
const loudnessMatchNote = computed(() => {
  if (props.loudnessMatched) return t('master.result.loudnessMatchNote');
  return t('master.result.rawCompareNote');
});

function setVolume(volume: number) {
  transport.value?.setVolume(volume);
}

function seekTo(fraction: number) {
  transport.value?.seekFraction(fraction);
}

function togglePlayback() {
  transport.value?.togglePlayback();
}

defineExpose({ setVolume, togglePlayback });
</script>

<template>
  <section class="master-result">
    <div class="result-grid">
      <div class="meter-stack">
        <MetricItem :label="t('master.meters.file')" :value="source?.fileName || '-'" />
        <MetricItem :label="t('master.meters.duration')" :value="sourceMetrics?.duration || '-'" />
        <MetricItem :label="t('master.meters.sampleRate')" :value="sourceMetrics?.sampleRate || '-'" />
        <MetricItem :label="t('master.meters.channels')" :value="sourceMetrics?.channels || '-'" />
        <MetricItem :label="t('master.meters.sourcePeak')" :value="sourceMetrics?.peak || '-'" />
        <MetricItem :label="t('master.meters.masterPeak')" :value="masterMetrics?.peak || '-'" variant="success" />
      </div>
      <div class="result-player">
        <div class="ab-controls">
          <Tooltip
            :title="t('master.result.before')"
            :body="t('master.result.beforeHint')"
          >
            <button
              type="button"
              class="ab-controls__button"
              :class="{ 'ab-controls__button--active': listenTarget === 'source' }"
              :disabled="!sourceUrl"
              @click="emit('update:listenTarget', 'source')"
            >
              {{ t('master.result.before') }}
            </button>
          </Tooltip>
          <Tooltip
            :title="t('master.result.after')"
            :body="t('master.result.afterHint')"
          >
            <button
              type="button"
              class="ab-controls__button"
              :class="{ 'ab-controls__button--active': listenTarget === 'master' }"
              :disabled="!outputUrl"
              @click="emit('update:listenTarget', 'master')"
            >
              {{ t('master.result.after') }}
            </button>
          </Tooltip>
          <Tooltip
            :title="t('master.result.reference')"
            :body="t('master.result.referenceHint')"
          >
            <button
              type="button"
              class="ab-controls__button"
              :class="{ 'ab-controls__button--active': listenTarget === 'reference' }"
              :disabled="!referenceUrl"
              @click="emit('update:listenTarget', 'reference')"
            >
              {{ t('master.result.reference') }}
            </button>
          </Tooltip>
          <Tooltip
            :title="t('master.result.loudnessMatch')"
            :body="t('master.result.loudnessMatchTooltip')"
          >
            <label class="ab-controls__toggle">
              <input
                type="checkbox"
                :checked="loudnessMatched"
                @change="emit('update:loudnessMatched', ($event.target as HTMLInputElement).checked)"
              >
              <span>{{ t('master.result.loudnessMatch') }}</span>
            </label>
          </Tooltip>
        </div>
        <MasteringWaveform
          v-if="source"
          :audio="resultWaveAudio"
          :compare="resultWaveCompare"
          :variant="resultWaveVariant"
          :mode-label="resultWaveLabel"
          :height="96"
          :progress="playProgress"
          @seek="seekTo"
        />
        <p v-else class="result-empty">{{ t('master.result.empty') }}</p>
        <AudioTransport ref="transport" :src="playbackUrl" @progress="playProgress = $event" />
        <div class="result-actions">
          <Tooltip
            :title="t('master.result.download')"
            :body="t('master.result.downloadHint')"
          >
            <a
              class="master-download"
              :class="{ 'master-download--disabled': !outputUrl }"
              :href="outputUrl || undefined"
              download="libsonare-master.wav"
            >
              {{ t('master.result.download') }}
            </a>
          </Tooltip>
          <Tooltip
            :title="t('master.result.report')"
            :body="t('master.result.reportHint')"
          >
            <a
              class="master-download"
              :class="{ 'master-download--disabled': !reportUrl }"
              :href="reportUrl || undefined"
              download="libsonare-master-report.json"
            >
              {{ t('master.result.report') }}
            </a>
          </Tooltip>
        </div>
        <p class="result-note">
          {{ loudnessMatchNote }}
        </p>
        <p v-if="renderResultStages" class="result-stages">
          {{ renderResultStages }}
        </p>
        <p v-if="error" class="master-error">
          {{ error }}
        </p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.master-result {
  margin-top: 14px;
}

.result-grid {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 14px;
  padding: 14px;
}

.meter-stack {
  display: grid;
  gap: 14px;
  padding: 14px;
}

.result-player {
  display: grid;
  gap: 12px;
  align-content: start;
}

.ab-controls,
.result-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.ab-controls__button {
  min-width: 88px;
  height: 34px;
  border: 1px solid var(--demo-border);
  border-radius: 6px;
  background: var(--master-surface);
  color: var(--demo-text);
  cursor: pointer;
  font: inherit;
  font-size: 10px;
  font-weight: 800;
}

.ab-controls__button {
  transition: border-color 0.16s ease, background-color 0.16s ease, color 0.16s ease;
}

.ab-controls__button:not(.ab-controls__button--active):not(:disabled):hover {
  border-color: var(--demo-accent);
  background: var(--demo-accent-subtle);
  color: var(--demo-text-strong);
}

.ab-controls__button:focus-visible {
  outline: 2px solid var(--demo-accent);
  outline-offset: 2px;
}

.ab-controls__button--active {
  border-color: var(--demo-accent);
  background: color-mix(in srgb, var(--demo-accent) 16%, transparent);
  color: var(--demo-text-strong);
}

.ab-controls__button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.ab-controls__toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--demo-text-muted);
  font-size: 10px;
}

.ab-controls__toggle input {
  accent-color: var(--demo-accent);
}

.master-download {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 38px;
  width: fit-content;
  padding: 0 16px;
  border: 1px solid var(--demo-border-strong);
  border-radius: 8px;
  color: var(--demo-text-strong);
  text-decoration: none;
  font-size: 10px;
  font-weight: 800;
}

.master-download {
  transition: border-color 0.16s ease, background-color 0.16s ease, color 0.16s ease;
}

.master-download:not(.master-download--disabled):hover {
  border-color: var(--demo-accent);
  background: var(--demo-accent-subtle);
  color: var(--demo-accent);
}

.master-download:focus-visible {
  outline: 2px solid var(--demo-accent);
  outline-offset: 2px;
}

.master-download--disabled {
  pointer-events: none;
  opacity: 0.45;
}

.result-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 96px;
  margin: 0;
  padding: 0 16px;
  border: 1px dashed var(--demo-border);
  border-radius: 8px;
  color: var(--demo-text-muted);
  font-size: 12px;
  text-align: center;
}

.result-note,
.result-stages,
.master-error {
  margin: 0;
  color: var(--demo-text-muted);
  font-size: 11px;
  line-height: 1.6;
}

.master-error {
  padding: 8px 12px;
  border: 1px solid color-mix(in srgb, var(--demo-danger) 55%, transparent);
  border-radius: 6px;
  background: color-mix(in srgb, var(--demo-danger) 12%, transparent);
  color: var(--demo-danger);
}

/* Staggered reveal once a master render lands. */
.meter-stack :deep(.metric-item) {
  animation: result-rise 0.35s ease both;
}

.meter-stack :deep(.metric-item:nth-child(2)) { animation-delay: 0.05s; }
.meter-stack :deep(.metric-item:nth-child(3)) { animation-delay: 0.1s; }
.meter-stack :deep(.metric-item:nth-child(4)) { animation-delay: 0.15s; }
.meter-stack :deep(.metric-item:nth-child(5)) { animation-delay: 0.2s; }
.meter-stack :deep(.metric-item:nth-child(6)) { animation-delay: 0.25s; }

.result-player {
  animation: result-rise 0.35s ease both;
}

@keyframes result-rise {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: none; }
}

@media (prefers-reduced-motion: reduce) {
  .ab-controls__button,
  .master-download {
    transition: none;
  }

  .meter-stack :deep(.metric-item),
  .result-player {
    animation: none;
  }
}

@media (max-width: 900px) {
  .result-grid {
    grid-template-columns: 1fr;
  }
}
</style>
