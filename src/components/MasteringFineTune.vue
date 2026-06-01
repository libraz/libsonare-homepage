<script setup lang="ts">
import { computed } from 'vue';
import { Tooltip } from '@/components/ui';
import { useI18n } from '@/composables/useI18n';
import type { MasteringDiagnosticBypass } from '@/composables/useMastering';
import { MASTERING_PARAMETER_GUIDE_SLUGS } from '@/utils/masteringUi';

type FineTuneKey = 'tone' | 'width' | 'dynamics';
type DiagnosticBypassKey = keyof MasteringDiagnosticBypass;

const props = defineProps<{
  show: boolean;
  tone: number;
  width: number;
  dynamics: number;
  ceilingDb: number;
  diagnosticBypass: MasteringDiagnosticBypass;
}>();

const emit = defineEmits<{
  'update:show': [value: boolean];
  'update:tone': [value: number];
  'update:width': [value: number];
  'update:dynamics': [value: number];
  'update:ceilingDb': [value: number];
  'update:diagnosticBypass': [key: DiagnosticBypassKey, value: boolean];
}>();

const { t, locale } = useI18n();
const glossaryBasePath = computed(() =>
  locale.value === 'ja' ? '/ja/docs/glossary' : '/docs/glossary',
);
const controls: FineTuneKey[] = ['tone', 'width', 'dynamics'];
const diagnosticBypassControls: DiagnosticBypassKey[] = [
  'repair',
  'dynamics',
  'saturation',
  'airBand',
  'stereo',
  'loudnessLimiter',
];

function docHref(key: keyof typeof MASTERING_PARAMETER_GUIDE_SLUGS): string | undefined {
  const slug = MASTERING_PARAMETER_GUIDE_SLUGS[key];
  return slug ? `${glossaryBasePath.value}/${slug}` : undefined;
}

function valueFor(
  key: FineTuneKey,
  props: { tone: number; width: number; dynamics: number },
): number {
  return props[key];
}

function updateValue(key: FineTuneKey, value: number) {
  emit(`update:${key}`, value);
}

function updateCeiling(value: number) {
  emit('update:ceilingDb', value);
}

function updateDiagnosticBypass(key: DiagnosticBypassKey, value: boolean) {
  emit('update:diagnosticBypass', key, value);
}
</script>

<template>
  <button type="button" class="master-disclosure" @click="emit('update:show', !show)">
    {{ show ? t('master.quick.hideFineTune') : t('master.quick.showFineTune') }}
  </button>
  <div v-if="show" class="fine-tune">
    <label v-for="control in controls" :key="control" class="master-slider">
      <span class="master-slider__label">
        {{ t(`master.parameters.${control}`) }}
        <Tooltip
          :title="t(`master.parameters.${control}`)"
          :body="t(`master.hints.${control}`)"
          :tip="t(`master.tips.${control}`)"
          :tip-label="t('master.tips.useWhen')"
          default-value="50"
          :default-label="t('master.defaults.label')"
          :default-rationale="t(`master.defaults.${control}`)"
          :href="docHref(control)"
          :link-label="t('master.glossary.openGuide')"
        >
          <button
            type="button"
            class="master-param-info"
            :aria-label="t('master.glossary.openGuide')"
            @click.stop.prevent
          >
            <span aria-hidden="true">i</span>
          </button>
        </Tooltip>
      </span>
      <input
        type="range"
        min="0"
        max="100"
        :value="valueFor(control, { tone, width, dynamics })"
        @input="updateValue(control, Number(($event.target as HTMLInputElement).value))"
      >
      <strong>{{ valueFor(control, { tone, width, dynamics }) }}</strong>
    </label>

    <label class="master-slider">
      <span class="master-slider__label">
        {{ t('master.parameters.limiterCeilingDb') }}
        <Tooltip
          :title="t('master.parameters.limiterCeilingDb')"
          :body="t('master.hints.limiterCeilingDb')"
          :tip="t('master.tips.limiterCeilingDb')"
          :tip-label="t('master.tips.useWhen')"
          default-value="-1.0 dBTP"
          :default-label="t('master.defaults.label')"
          :default-rationale="t('master.defaults.limiterCeilingDb')"
          :href="docHref('limiterCeilingDb')"
          :link-label="t('master.glossary.openGuide')"
        >
          <button
            type="button"
            class="master-param-info"
            :aria-label="t('master.glossary.openGuide')"
            @click.stop.prevent
          >
            <span aria-hidden="true">i</span>
          </button>
        </Tooltip>
      </span>
      <input
        type="range"
        min="-3"
        max="-0.1"
        step="0.1"
        :value="props.ceilingDb"
        @input="updateCeiling(Number(($event.target as HTMLInputElement).value))"
      >
      <strong>{{ props.ceilingDb.toFixed(1) }} dBTP</strong>
    </label>

    <section class="diagnostic-bypass" :aria-label="t('master.diagnostics.title')">
      <div class="diagnostic-bypass__head">
        <strong>{{ t('master.diagnostics.title') }}</strong>
        <span>{{ t('master.diagnostics.help') }}</span>
      </div>
      <div class="diagnostic-bypass__items">
        <label
          v-for="control in diagnosticBypassControls"
          :key="control"
          class="diagnostic-bypass__item"
        >
          <input
            type="checkbox"
            :checked="props.diagnosticBypass[control]"
            @change="updateDiagnosticBypass(control, ($event.target as HTMLInputElement).checked)"
          >
          <span>{{ t(`master.diagnostics.${control}`) }}</span>
        </label>
      </div>
    </section>
  </div>
</template>

<style scoped>
.master-disclosure {
  margin: 14px;
  height: 34px;
  border: 1px solid var(--demo-border);
  border-radius: 6px;
  background: var(--master-surface);
  color: var(--demo-text);
  cursor: pointer;
  font: inherit;
  font-size: 10px;
  font-weight: 700;
}

.fine-tune {
  display: grid;
  gap: 12px;
  padding: 0 14px 14px;
}

.master-slider {
  display: grid;
  grid-template-columns: minmax(120px, 180px) minmax(0, 1fr) 64px;
  gap: 14px;
  align-items: center;
  color: var(--demo-text);
  font-size: 11px;
}

.master-slider__label {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
}

.master-slider strong {
  color: var(--demo-cyan);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}

.master-slider input {
  width: 100%;
  accent-color: var(--demo-accent);
}

.diagnostic-bypass {
  display: grid;
  gap: 8px;
  padding-top: 4px;
}

.diagnostic-bypass__head {
  display: grid;
  gap: 3px;
  padding-top: 4px;
  border-top: 1px solid var(--demo-border);
}

.diagnostic-bypass__head strong {
  color: var(--demo-text);
  font-size: 11px;
}

.diagnostic-bypass__head span {
  color: var(--demo-text-muted);
  font-size: 10px;
  line-height: 1.5;
}

.diagnostic-bypass__items {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px 16px;
}

.diagnostic-bypass__item {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 28px;
  padding: 0 8px;
  margin: 0 -8px;
  border-radius: 6px;
  color: var(--demo-text);
  font-size: 11px;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.diagnostic-bypass__item:hover {
  background: var(--master-surface);
}

.diagnostic-bypass__item input {
  flex: none;
  width: 14px;
  height: 14px;
  margin: 0;
  accent-color: var(--demo-accent);
}

@media (max-width: 560px) {
  .diagnostic-bypass__items {
    grid-template-columns: 1fr;
  }
}

.master-param-info {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  margin: 0 0 0 2px;
  border: 1px solid var(--demo-border);
  border-radius: 50%;
  background: transparent;
  color: var(--demo-text-muted);
  cursor: pointer;
  vertical-align: middle;
  transition: color 0.18s ease, border-color 0.18s ease, background-color 0.18s ease;
}

.master-param-info > span {
  display: block;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 10px;
  font-weight: 700;
  font-style: italic;
  line-height: 1;
  letter-spacing: 0;
  transform: translateY(-0.5px);
}

.master-param-info:hover,
.master-param-info:focus-visible {
  color: var(--demo-accent);
  border-color: var(--demo-accent);
  background: var(--demo-accent-subtle);
  outline: none;
}

@media (max-width: 900px) {
  .master-slider {
    grid-template-columns: 1fr;
  }
}
</style>
