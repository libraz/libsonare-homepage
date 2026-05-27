<script setup lang="ts">
import { computed } from 'vue';
import MasteringPlatformSelector from '@/components/MasteringPlatformSelector.vue';
import MasteringWaveform from '@/components/MasteringWaveform.vue';
import MasterKnob from '@/components/MasterKnob.vue';
import { Tooltip } from '@/components/ui';
import { useI18n } from '@/composables/useI18n';
import type {
  DecodedMasteringAudio,
  MasteringModuleSettings,
  MasteringPlatformId,
  RenderedMasteringAudio,
} from '@/composables/useMastering';
import {
  MASTERING_MODULE_GUIDE_SLUGS,
  MASTERING_PARAMETER_GUIDE_SLUGS,
  type MasteringModuleControl,
  type MasteringModuleSettingKey,
} from '@/utils/masteringUi';

defineProps<{
  activeModule: string;
  activeStage: number;
  totalStages: number;
  source: DecodedMasteringAudio | null;
  rendered: RenderedMasteringAudio | null;
  moduleControls: MasteringModuleControl[];
  moduleSettings: MasteringModuleSettings;
  chainDefaults: MasteringModuleSettings;
  canResetActiveModule: boolean;
  targetLufs: number;
  selectedPlatform: MasteringPlatformId;
  customLufs: number;
  platforms: Array<{ id: MasteringPlatformId; lufs: number }>;
}>();

const emit = defineEmits<{
  'update:moduleSetting': [key: MasteringModuleSettingKey, value: number];
  'update:selectedPlatform': [value: MasteringPlatformId];
  'update:customLufs': [value: number];
  reset: [];
}>();

const { t, locale } = useI18n();
const glossaryBasePath = computed(() =>
  locale.value === 'ja' ? '/ja/docs/glossary' : '/docs/glossary',
);

function docHref(slug: string | null | undefined): string | undefined {
  return slug ? `${glossaryBasePath.value}/${slug}` : undefined;
}
</script>

<template>
  <div class="module-editor">
    <header class="module-editor__head">
      <div class="module-editor__stage" :aria-label="t('master.studio.graph')">
        <em>{{ t('master.studio.stageLabel') }}</em>
        <strong>{{ String(activeStage).padStart(2, '0') }}</strong>
        <small>/ {{ String(totalStages).padStart(2, '0') }}</small>
      </div>
      <div class="module-editor__id">
        <span class="module-editor__led" aria-hidden="true"></span>
        <h3>{{ t(`master.modules.${activeModule}.name`) }}</h3>
        <small>{{ t(`master.modules.${activeModule}.description`) }}</small>
      </div>
      <Tooltip
        v-if="MASTERING_MODULE_GUIDE_SLUGS[activeModule]"
        :eyebrow="t('master.studio.chain')"
        :title="t(`master.modules.${activeModule}.name`)"
        :body="t(`master.modules.${activeModule}.description`)"
        :tip="t(`master.modules.${activeModule}.tip`)"
        :tip-label="t('master.tips.useWhen')"
        :href="docHref(MASTERING_MODULE_GUIDE_SLUGS[activeModule])"
        :link-label="t('master.glossary.moduleGuide')"
      >
        <button
          type="button"
          class="module-editor__info"
          :aria-label="t('master.glossary.moduleGuide')"
        >
          <span aria-hidden="true">i</span>
        </button>
      </Tooltip>
    </header>

    <MasteringWaveform
      :audio="rendered || source"
      :compare="rendered && source ? source : null"
      :variant="rendered ? 'master' : 'source'"
    />

    <div v-if="moduleControls.length" class="module-editor__knobs">
      <MasterKnob
        v-for="control in moduleControls"
        :key="control.key"
        :model-value="moduleSettings[control.key]"
        :min="control.min"
        :max="control.max"
        :step="control.step"
        :unit="control.unit"
        :label="t(`master.parameters.${control.key}`)"
        :hint="t(`master.hints.${control.key}`)"
        :tip="t(`master.tips.${control.key}`)"
        :tip-label="t('master.tips.useWhen')"
        :default="chainDefaults[control.key]"
        :default-rationale="t(`master.defaults.${control.key}`)"
        :default-label="t('master.defaults.label')"
        :default-off-label="t('master.defaults.off')"
        :docs-href="docHref(MASTERING_PARAMETER_GUIDE_SLUGS[control.key])"
        :docs-link-label="t('master.glossary.openGuide')"
        @update:model-value="emit('update:moduleSetting', control.key, $event)"
      />
    </div>

    <div v-if="moduleControls.length" class="module-editor__reset">
      <Tooltip
        :title="t('master.studio.resetModule')"
        :body="t('master.studio.resetModuleHint')"
        :tip="t('master.studio.resetModuleUseWhen')"
        :tip-label="t('master.tips.useWhen')"
      >
        <button
          type="button"
          class="module-editor__reset-btn"
          :disabled="!canResetActiveModule"
          :aria-label="t('master.studio.resetModuleAria')"
          @click="emit('reset')"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M3 12a9 9 0 1 0 3-6.7" />
            <path d="M3 4v5h5" />
          </svg>
          <span>{{ t('master.studio.resetModule') }}</span>
        </button>
      </Tooltip>
    </div>

    <div v-if="activeModule === 'loudness'" class="module-editor__platform">
      <p class="module-editor__note">
        {{ t('master.modules.loudness.note') }} <strong>{{ targetLufs }} LUFS</strong>
      </p>
      <MasteringPlatformSelector
        :model-value="selectedPlatform"
        :custom-lufs="customLufs"
        :platforms="platforms"
        :eyebrow="t('master.modules.loudness.name')"
        studio
        @update:model-value="emit('update:selectedPlatform', $event)"
        @update:custom-lufs="emit('update:customLufs', $event)"
      />
    </div>
    <p v-if="activeModule === 'output'" class="module-editor__note">
      {{ t('master.modules.output.note') }}
    </p>
  </div>
</template>

<style scoped>
.module-editor {
  display: grid;
  gap: 14px;
  padding: 16px;
}

.module-editor__note {
  margin: 0;
  padding: 12px 14px;
  border: 1px solid var(--demo-border);
  border-radius: 8px;
  background: var(--master-surface);
  color: var(--demo-text);
  font-family: 'Space Grotesk', sans-serif;
  font-size: 12.5px;
  line-height: 1.55;
}

.module-editor__note strong {
  color: var(--demo-cyan);
  font-family: 'JetBrains Mono', ui-monospace, monospace;
}

.module-editor__platform {
  display: grid;
  gap: 10px;
}

.module-editor__head {
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
  padding: 14px 14px 14px 18px;
  border: 1px solid var(--demo-border);
  border-radius: 8px;
  background: var(--master-surface);
}

.module-editor__head::before {
  content: '';
  position: absolute;
  left: 4px;
  top: 10px;
  bottom: 10px;
  width: 2px;
  border-radius: 2px;
  background: var(--demo-accent);
  opacity: 0.7;
  pointer-events: none;
}

.module-editor__stage {
  display: inline-flex;
  align-items: baseline;
  gap: 5px;
  padding: 6px 10px;
  border: 1px solid var(--demo-accent-border);
  border-radius: 6px;
  background: var(--demo-accent-subtle);
  font-family: 'JetBrains Mono', monospace;
  font-variant-numeric: tabular-nums;
}

.module-editor__stage em {
  color: var(--demo-text-muted);
  font-size: 8px;
  font-style: normal;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.module-editor__stage strong {
  color: var(--demo-accent-light);
  font-size: 15px;
  font-weight: 700;
}

html:not(.dark) .module-editor__stage strong {
  color: var(--demo-accent);
}

.module-editor__stage small {
  color: var(--demo-text-muted);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.module-editor__id {
  display: grid;
  grid-template-columns: 10px minmax(0, 1fr);
  column-gap: 12px;
  row-gap: 2px;
  align-items: center;
  min-width: 0;
}

.module-editor__led {
  grid-row: 1 / span 2;
  align-self: center;
  display: block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--demo-accent);
  box-shadow: 0 0 8px color-mix(in srgb, var(--demo-accent) 70%, transparent);
  animation: led-pulse 2.4s ease-in-out infinite;
}

@keyframes led-pulse {
  0%, 100% { opacity: 0.9; }
  50%      { opacity: 0.55; }
}

.module-editor__id h3 {
  margin: 0;
  color: var(--demo-text-strong);
  font-family: 'Space Grotesk', sans-serif;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.01em;
  line-height: 1.2;
}

.module-editor__id small {
  color: var(--demo-text);
  font-family: 'Space Grotesk', sans-serif;
  font-size: 11.5px;
  font-weight: 400;
  line-height: 1.45;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.module-editor__info {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 1px solid var(--demo-border);
  border-radius: 50%;
  background: var(--master-code-bg);
  color: var(--demo-text-muted);
  cursor: pointer;
  transition: color 0.18s ease, border-color 0.18s ease, background-color 0.18s ease;
}

.module-editor__info > span {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 11px;
  font-style: italic;
  font-weight: 700;
  transform: translateY(-0.5px);
}

.module-editor__info:hover,
.module-editor__info:focus-visible {
  color: var(--demo-accent);
  border-color: var(--demo-accent);
  background: var(--demo-accent-subtle);
  outline: none;
}

.module-editor__knobs {
  display: flex;
  flex-wrap: wrap;
  gap: 18px 22px;
  padding: 18px 16px;
  border: 1px solid var(--demo-border);
  border-radius: 8px;
  background: var(--demo-bg-elevated);
}

.module-editor__reset {
  display: flex;
  justify-content: flex-end;
  margin-top: 4px;
}

.module-editor__reset-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 28px;
  padding: 0 12px;
  border: 1px solid var(--demo-border-strong);
  border-radius: 6px;
  background: var(--master-surface);
  color: var(--demo-text-muted);
  cursor: pointer;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  transition: color 0.18s ease, border-color 0.18s ease, background-color 0.18s ease;
}

.module-editor__reset-btn:hover:not(:disabled),
.module-editor__reset-btn:focus-visible:not(:disabled) {
  color: var(--demo-accent);
  border-color: var(--demo-accent);
  background: var(--demo-accent-subtle);
  outline: none;
}

.module-editor__reset-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.module-editor__reset-btn svg {
  flex-shrink: 0;
}
</style>
