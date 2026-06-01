<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import MasteringChainPanel from '@/components/MasteringChainPanel.vue';
import MasteringFineTune from '@/components/MasteringFineTune.vue';
import MasteringInsights from '@/components/MasteringInsights.vue';
import MasteringMetersPanel from '@/components/MasteringMetersPanel.vue';
import MasteringModuleEditor from '@/components/MasteringModuleEditor.vue';
import MasteringPlatformSelector from '@/components/MasteringPlatformSelector.vue';
import MasteringPresetGrid from '@/components/MasteringPresetGrid.vue';
import MasteringReferencePanel from '@/components/MasteringReferencePanel.vue';
import MasteringResultPanel from '@/components/MasteringResultPanel.vue';
import MasteringVenueSelector from '@/components/MasteringVenueSelector.vue';
import ToolModeTabs, { type ToolModeOption } from '@/components/ToolModeTabs.vue';
import ToolShell from '@/components/ToolShell.vue';
import ToolStatusBar, { type ToolStatusField } from '@/components/ToolStatusBar.vue';
import { ScanLine, TechPanel } from '@/components/ui';
import { useI18n } from '@/composables/useI18n';
import {
  type DecodedMasteringAudio,
  defaultDiagnosticBypass,
  defaultModuleSettings,
  type MasteringDiagnosticBypass,
  type MasteringModuleSettings,
  type MasteringPlatformId,
  type MasteringPresetId,
  type MasteringVenueId,
  useMastering,
} from '@/composables/useMastering';
import { useMasteringInsights } from '@/composables/useMasteringInsights';
import { useMasteringMetering } from '@/composables/useMasteringMetering';
import { useMasteringModeUrlSync } from '@/composables/useMasteringModeUrlSync';
import { useMasteringSession } from '@/composables/useMasteringSession';
import { dbToLinear, formatMasteringDuration } from '@/utils/masteringMetrics';
import { createMasteringReportUrl } from '@/utils/masteringReport';
import {
  MASTERING_METER_TARGETS,
  MASTERING_MODULE_GUIDE_SLUGS,
  MASTERING_MODULES,
  MASTERING_PLATFORMS,
  MASTERING_PRESET_TARGETS,
  MASTERING_PRESETS,
  MASTERING_VENUES,
  type MasteringMode,
  type MasteringModuleSettingKey,
  moduleControlsFor,
} from '@/utils/masteringUi';

const { t, locale } = useI18n();
const mastering = useMastering();

const libVersion = ref<string>('');
const docsPath = computed(() =>
  locale.value === 'ja' ? '/ja/docs/glossary/mastering' : '/docs/glossary/mastering',
);
const glossaryBasePath = computed(() =>
  locale.value === 'ja' ? '/ja/docs/glossary' : '/docs/glossary',
);
const otherLocalePath = computed(() => (locale.value === 'ja' ? '/mastering' : '/ja/mastering'));

const mode = ref<MasteringMode>('quick');
const selectedPreset = ref<MasteringPresetId>('pop');
const selectedVenue = ref<MasteringVenueId>('studio');
const selectedPlatform = ref<MasteringPlatformId>('youtube');
const customLufs = ref(-14);
const tone = ref(50);
const width = ref(50);
const dynamics = ref(50);
const showFineTune = ref(false);
const activeModule = ref('input');
const sourceUrl = ref<string | null>(null);
const outputUrl = ref<string | null>(null);
const reportUrl = ref<string | null>(null);
const chainSettingsUrl = ref<string | null>(null);
const localError = ref<string | null>(null);
const resultPanel = ref<InstanceType<typeof MasteringResultPanel> | null>(null);
const listenTarget = ref<'source' | 'master' | 'reference'>('master');
const loudnessMatched = ref(true);
const reference = ref<DecodedMasteringAudio | null>(null);
const referenceUrl = ref<string | null>(null);
const referenceLufs = ref<number | null>(null);
const moduleSettings = ref<MasteringModuleSettings>(defaultModuleSettings());
const diagnosticBypass = ref<MasteringDiagnosticBypass>(defaultDiagnosticBypass());
const chainDefaults = defaultModuleSettings();
const currentCeilingDb = computed(() => moduleSettings.value.limiterCeilingDb);
const {
  insightReport,
  isAnalyzingInsights,
  insightProfileItems,
  insightSuggestions,
  insightPreview,
  analyzeSourceInsights,
  resetInsights,
} = useMasteringInsights(mastering, currentCeilingDb);

const { applyModeFromUrl, replaceModeInUrl, enableModeUrlSync, disableModeUrlSync } =
  useMasteringModeUrlSync(mode);

const {
  currentSessionSettings,
  saveSession,
  restoreSession,
  saveChainPreset,
  loadChainPreset,
  exportChainSettings,
  handleChainImport,
} = useMasteringSession({
  mode,
  selectedPreset,
  selectedVenue,
  selectedPlatform,
  customLufs,
  tone,
  width,
  dynamics,
  showFineTune,
  activeModule,
  loudnessMatched,
  moduleSettings,
  chainSettingsUrl,
  localError,
  t,
});

const presets = MASTERING_PRESETS;
const venues = MASTERING_VENUES;
const platforms = MASTERING_PLATFORMS;
const modules = MASTERING_MODULES;

const activeStage = computed(() => modules.indexOf(activeModule.value) + 1);
const totalStages = computed(() => modules.length);

const meterTargets = MASTERING_METER_TARGETS;

function jumpToModule(moduleId: string | undefined) {
  if (!moduleId) return;
  if (modules.includes(moduleId)) activeModule.value = moduleId;
}

const moduleGuideSlugs = MASTERING_MODULE_GUIDE_SLUGS;

const targetLufs = computed(() =>
  selectedPlatform.value === 'custom'
    ? customLufs.value
    : (platforms.find((platform) => platform.id === selectedPlatform.value)?.lufs ?? -14),
);

const recommendedLufs = computed(() => MASTERING_PRESET_TARGETS[selectedPreset.value]);
const selectedPresetName = computed(() => t(`master.presets.${selectedPreset.value}.name`));
const effectiveTargetLufs = computed(() => targetLufs.value);
const qualityGuardLufs = computed<number | null>(() => null);

const { sourceMetrics, masterMetrics, referenceMetrics, meterReadings, phasePoints, stereoImage } =
  useMasteringMetering({
    mastering,
    reference,
    targetLufs: effectiveTargetLufs,
    t,
  });

const modeOptions = computed<ToolModeOption[]>(() => [
  { id: 'quick', label: t('master.quick.title') },
  { id: 'studio', label: t('master.studio.title') },
]);

function formatStageLabel(stage: string): string {
  if (!stage) return '';
  switch (stage) {
    case 'Queued':
      return t('master.renderStages.queued');
    case 'Preparing audio buffers':
      return t('master.renderStages.preparing');
    case 'Loading libsonare WASM':
      return t('master.renderStages.loadingWasm');
    case 'Running mastering chain':
      return t('master.renderStages.runningChain');
    case 'Finalizing render':
      return t('master.renderStages.finalizing');
    case 'Complete':
      return t('master.renderStages.complete');
  }
  if (stage.startsWith('match.applyMatchEq')) {
    return stage.endsWith('right')
      ? t('master.renderStages.matchEqRight')
      : t('master.renderStages.matchEqLeft');
  }
  // WASM emits dotted stage IDs like "eq.tilt", "dynamics.compressor" — pretty-print
  if (stage.includes('.')) {
    return stage
      .split('.')
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(' · ');
  }
  return stage;
}

const renderStageLabel = computed(() => formatStageLabel(mastering.renderStage.value));

const renderResultStages = computed(() => {
  const stages = mastering.rendered.value?.stages;
  if (!stages?.length) return '';
  return stages.map(formatStageLabel).join(' / ');
});

const resultWaveAudio = computed(() => {
  const rendered = mastering.rendered.value;
  const source = mastering.source.value;
  if (listenTarget.value === 'reference' && reference.value) return reference.value;
  if (listenTarget.value === 'master' && rendered) return rendered;
  return source ?? rendered;
});

const resultWaveCompare = computed(() => {
  const rendered = mastering.rendered.value;
  const source = mastering.source.value;
  if (listenTarget.value === 'reference') return rendered ?? source ?? null;
  if (!rendered || !source) return null;
  return listenTarget.value === 'master' ? source : rendered;
});

const resultWaveVariant = computed<'source' | 'master'>(() =>
  listenTarget.value === 'master' && mastering.rendered.value ? 'master' : 'source',
);

const resultWaveLabel = computed<string | undefined>(() =>
  listenTarget.value === 'reference' ? t('master.result.reference') : undefined,
);

function docHref(slug: string | null | undefined): string | undefined {
  if (!slug) return undefined;
  return `${glossaryBasePath.value}/${slug}`;
}

function moduleNameOf(stageId: string | null | undefined): string {
  if (!stageId) return '';
  return t(`master.modules.${stageId}.name`);
}

function resetActiveModule() {
  const controls = moduleControls.value;
  if (!controls.length) return;
  const next: MasteringModuleSettings = { ...moduleSettings.value };
  for (const control of controls) {
    next[control.key] = chainDefaults[control.key];
  }
  moduleSettings.value = next;
}

function updateModuleSetting(key: MasteringModuleSettingKey, value: number) {
  moduleSettings.value = {
    ...moduleSettings.value,
    [key]: value,
  };
}

function updateDiagnosticBypass(key: keyof MasteringDiagnosticBypass, value: boolean) {
  diagnosticBypass.value = {
    ...diagnosticBypass.value,
    [key]: value,
  };
}

function numericParam(params: Record<string, unknown>, key: string): number | null {
  const value = params[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function applyParam(
  next: MasteringModuleSettings,
  params: Record<string, unknown>,
  key: string,
  setting: MasteringModuleSettingKey,
  min: number,
  max: number,
) {
  const value = numericParam(params, key);
  if (value !== null) next[setting] = clamp(value, min, max);
}

function normalizeAssistantPreset(value: unknown): MasteringPresetId | null {
  if (typeof value !== 'string') return null;
  const normalized = value.toLowerCase().replace(/[-_\s]/g, '');
  const match = presets.find((preset) => preset.id.toLowerCase() === normalized);
  return match?.id ?? null;
}

function assistantParams(): Record<string, unknown> | null {
  const suggestions = insightReport.value?.suggestions as Record<string, unknown> | null;
  const chainConfig = suggestions?.chainConfig as Record<string, unknown> | undefined;
  const params = chainConfig?.params;
  return params && typeof params === 'object' ? (params as Record<string, unknown>) : null;
}

function applyAssistantSettings() {
  const params = assistantParams();
  if (!params && !insightPreview.value.some((row) => row.ceilingRisk)) return;

  const next: MasteringModuleSettings = { ...moduleSettings.value };
  if (params) {
    applyParam(next, params, 'eq.tilt.tiltDb', 'tiltDb', -12, 12);
    applyParam(next, params, 'dynamics.compressor.thresholdDb', 'compressorThresholdDb', -40, 0);
    applyParam(next, params, 'dynamics.compressor.ratio', 'compressorRatio', 1, 10);
    applyParam(next, params, 'dynamics.compressor.attackMs', 'compressorAttackMs', 0.5, 100);
    applyParam(next, params, 'dynamics.compressor.releaseMs', 'compressorReleaseMs', 20, 600);
    applyParam(next, params, 'dynamics.transientShaper.attackGainDb', 'transientAttackDb', -6, 6);
    // Do not auto-apply color stages from the source assistant. Exciter/tape
    // can add grit or clicks on some sources, so keep them opt-in from Studio.
    applyParam(next, params, 'spectral.airBand.amount', 'airBandAmount', 0, 1);
    applyParam(next, params, 'stereo.imager.width', 'stereoWidth', 0.6, 1.6);
    applyParam(next, params, 'stereo.monoMaker.amount', 'monoMakerAmount', 0, 1);
    applyParam(next, params, 'maximizer.truePeakLimiter.ceilingDb', 'limiterCeilingDb', -3, -0.1);
    applyParam(next, params, 'loudness.ceilingDb', 'limiterCeilingDb', -3, -0.1);
    applyParam(next, params, 'maximizer.truePeakLimiter.lookaheadMs', 'limiterLookaheadMs', 1, 20);

    const target = numericParam(params, 'loudness.targetLufs');
    if (target !== null) {
      selectedPlatform.value = 'custom';
      customLufs.value = clamp(target, -24, -8);
    }

    const suggestions = insightReport.value?.suggestions as Record<string, unknown> | null;
    const candidates = suggestions?.genreCandidates;
    if (Array.isArray(candidates)) {
      const first = candidates[0] as Record<string, unknown> | undefined;
      const preset = normalizeAssistantPreset(first?.name);
      if (preset) selectedPreset.value = preset;
    }
  }

  const safeCeiling = Math.min(
    ...insightPreview.value
      .filter((row) => row.ceilingRisk && Number.isFinite(row.safeCeilingDb))
      .map((row) => row.safeCeilingDb),
  );
  if (Number.isFinite(safeCeiling)) {
    next.limiterCeilingDb = Math.min(next.limiterCeilingDb, clamp(safeCeiling, -3, -0.1));
  }

  moduleSettings.value = next;
  showFineTune.value = true;
  if (mode.value === 'studio') activeModule.value = 'limiter';
}

const canResetActiveModule = computed(() => {
  const controls = moduleControls.value;
  if (!controls.length) return false;
  return controls.some(
    (control) => moduleSettings.value[control.key] !== chainDefaults[control.key],
  );
});

const statusLabel = computed(() => {
  if (mastering.isRendering.value) return t('master.status.rendering');
  if (mastering.rendered.value) return t('master.status.ready');
  if (mastering.source.value) return t('master.status.loaded');
  return t('master.status.idle');
});

const statusVariant = computed<'idle' | 'active' | 'warning'>(() => {
  if (mastering.isRendering.value) return 'warning';
  if (mastering.source.value) return 'active';
  return 'idle';
});

const statusBarFile = computed(() => mastering.source.value?.fileName || '—');
const statusBarDuration = computed(() =>
  mastering.source.value ? formatMasteringDuration(mastering.source.value.duration) : '—:——',
);
const statusBarRate = computed(() => {
  const sr = mastering.source.value?.sampleRate;
  if (!sr) return '—';
  const k = sr / 1000;
  return `${Number.isInteger(k) ? k.toFixed(0) : k.toFixed(1)}k`;
});
const statusBarChannels = computed(() => {
  const ch = mastering.source.value?.channels;
  if (ch === 1) return 'MONO';
  if (ch === 2) return 'STEREO';
  return '—';
});
const statusBarTarget = computed(() => {
  const platform = selectedPlatform.value;
  const label = platform === 'custom' ? 'CUSTOM' : t(`master.platforms.${platform}`).toUpperCase();
  return `${label} · ${targetLufs.value.toFixed(1)} LUFS`;
});
const statusBarLoudness = computed(() => {
  const r = mastering.rendered.value;
  if (!r) return '—';
  return `${r.inputLufs.toFixed(1)} → ${r.outputLufs.toFixed(1)}`;
});
const statusBarGain = computed(() => {
  const r = mastering.rendered.value;
  if (!r) return '—';
  const sign = r.appliedGainDb >= 0 ? '+' : '';
  return `${sign}${r.appliedGainDb.toFixed(1)} dB`;
});
const statusBarFields = computed<ToolStatusField[]>(() => [
  { key: 'SRC', value: statusBarFile.value, wide: true },
  { key: 'LEN', value: statusBarDuration.value },
  { key: 'SR', value: statusBarRate.value },
  { key: 'CH', value: statusBarChannels.value },
  { key: 'TARGET', value: statusBarTarget.value },
  { key: 'LUFS', value: statusBarLoudness.value },
  { key: 'GAIN', value: statusBarGain.value },
]);

const canRender = computed(() => Boolean(mastering.source.value) && !mastering.isRendering.value);
const playbackUrl = computed(() => {
  if (listenTarget.value === 'reference') return referenceUrl.value;
  if (listenTarget.value === 'source') return sourceUrl.value;
  return outputUrl.value || sourceUrl.value;
});

const moduleControls = computed(() => moduleControlsFor(activeModule.value));

watch([listenTarget, loudnessMatched, () => mastering.rendered.value], () => {
  void nextTick(updatePlaybackVolume);
});

watch(
  [
    mode,
    selectedPreset,
    selectedVenue,
    selectedPlatform,
    customLufs,
    tone,
    width,
    dynamics,
    showFineTune,
    activeModule,
    loudnessMatched,
    moduleSettings,
  ],
  saveSession,
  { deep: true },
);

async function loadLibVersion() {
  if (typeof window === 'undefined' || libVersion.value) return;
  try {
    const wasm = await import('@/wasm/index.js');
    await wasm.init();
    libVersion.value = wasm.version();
  } catch (e) {
    console.warn('Failed to read WASM version:', e);
  }
}

onMounted(() => {
  if (typeof window === 'undefined') return;
  restoreSession();
  applyModeFromUrl();
  replaceModeInUrl();
  enableModeUrlSync();
  window.addEventListener('keydown', handleKeyboardShortcuts);

  const ric = (window as any).requestIdleCallback;
  if (ric) {
    ric(loadLibVersion, { timeout: 2000 });
  } else {
    setTimeout(loadLibVersion, 100);
  }
});

function handleKeyboardShortcuts(event: KeyboardEvent) {
  if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return;

  const key = event.key.toLowerCase();
  if (key === 'a' && sourceUrl.value) {
    listenTarget.value = 'source';
    return;
  }
  if (key === 'b' && outputUrl.value) {
    listenTarget.value = 'master';
    return;
  }
  if (event.key === ' ' && playbackUrl.value && resultPanel.value) {
    event.preventDefault();
    resultPanel.value.togglePlayback();
    return;
  }
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

async function handleFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  await loadFile(file);
  input.value = '';
}

async function handleDrop(event: DragEvent) {
  event.preventDefault();
  const file = event.dataTransfer?.files?.[0];
  if (file) {
    await loadFile(file);
  }
}

async function loadFile(file: File) {
  localError.value = null;
  resetInsights();
  releaseUrls();
  try {
    const loaded = await mastering.loadFile(file);
    sourceUrl.value = mastering.createSourceAudioUrl(loaded);
    listenTarget.value = 'source';
    activeModule.value = modules[0];
    void analyzeSourceInsights();
  } catch {
    localError.value = t('master.errors.loadFailed');
  }
}

async function loadDemo() {
  try {
    const response = await fetch('/demo.mp3');
    const blob = await response.blob();
    await loadFile(new File([blob], 'demo.mp3', { type: blob.type || 'audio/mpeg' }));
  } catch {
    localError.value = t('master.errors.loadFailed');
  }
}

async function renderMaster() {
  localError.value = null;
  releaseOutputUrl();
  try {
    const result = await mastering.render({
      preset: selectedPreset.value,
      venue: selectedVenue.value,
      targetLufs: effectiveTargetLufs.value,
      tuning: {
        tone: tone.value,
        width: width.value,
        dynamics: dynamics.value,
      },
      moduleSettings: moduleSettings.value,
      qualityMode: 'studio',
      diagnosticBypass: diagnosticBypass.value,
    });
    outputUrl.value = mastering.createAudioUrl(result);
    reportUrl.value = createReportUrl();
    listenTarget.value = 'master';
    await nextTick();
    updatePlaybackVolume();
  } catch {
    localError.value = t('master.errors.renderFailed');
  }
}

async function handleReferenceFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  localError.value = null;

  try {
    if (referenceUrl.value) {
      URL.revokeObjectURL(referenceUrl.value);
      referenceUrl.value = null;
    }
    reference.value = await mastering.decodeFile(file);
    referenceUrl.value = mastering.createSourceAudioUrl(reference.value);
    referenceLufs.value = await mastering.measureIntegratedLufs(reference.value);
  } catch {
    localError.value = t('master.errors.loadFailed');
  } finally {
    input.value = '';
  }
}

async function renderReferenceMatch() {
  if (!reference.value) return;
  localError.value = null;
  releaseOutputUrl();
  try {
    const result = await mastering.renderReferenceMatch(reference.value, {
      targetLufs: effectiveTargetLufs.value,
      ceilingDb: moduleSettings.value.limiterCeilingDb,
      lookaheadMs: moduleSettings.value.limiterLookaheadMs,
    });
    outputUrl.value = mastering.createAudioUrl(result);
    reportUrl.value = createReportUrl();
    listenTarget.value = 'master';
    await nextTick();
    updatePlaybackVolume();
  } catch {
    localError.value = t('master.errors.referenceFailed');
  }
}

function updatePlaybackVolume() {
  if (!resultPanel.value || !mastering.rendered.value || !loudnessMatched.value) {
    resultPanel.value?.setVolume(1);
    return;
  }

  // Attenuate whichever side is playing down to the quietest of the loaded
  // sources so the A/B (incl. the reference) is not biased by raw level.
  const input = mastering.rendered.value.inputLufs;
  const output = mastering.rendered.value.outputLufs;
  const ref = referenceLufs.value;
  const anchor = Math.min(input, output, ref ?? Infinity);
  const current =
    listenTarget.value === 'source'
      ? input
      : listenTarget.value === 'reference'
        ? (ref ?? anchor)
        : output;
  resultPanel.value.setVolume(dbToLinear(Math.min(0, anchor - current)));
}

function releaseOutputUrl() {
  if (outputUrl.value) {
    URL.revokeObjectURL(outputUrl.value);
    outputUrl.value = null;
  }
  if (reportUrl.value) {
    URL.revokeObjectURL(reportUrl.value);
    reportUrl.value = null;
  }
}

function releaseUrls() {
  if (sourceUrl.value) {
    URL.revokeObjectURL(sourceUrl.value);
    sourceUrl.value = null;
  }
  releaseOutputUrl();
  if (referenceUrl.value) {
    URL.revokeObjectURL(referenceUrl.value);
    referenceUrl.value = null;
  }
  if (chainSettingsUrl.value) {
    URL.revokeObjectURL(chainSettingsUrl.value);
    chainSettingsUrl.value = null;
  }
  reference.value = null;
  referenceLufs.value = null;
}

onUnmounted(() => {
  disableModeUrlSync();
  if (typeof window !== 'undefined') window.removeEventListener('keydown', handleKeyboardShortcuts);
  releaseUrls();
  mastering.dispose();
});

function createReportUrl(): string {
  if (reportUrl.value) URL.revokeObjectURL(reportUrl.value);

  return createMasteringReportUrl({
    preset: selectedPreset.value,
    venue: selectedVenue.value,
    platform: selectedPlatform.value,
    targetLufs: targetLufs.value,
    effectiveTargetLufs: effectiveTargetLufs.value,
    tuning: {
      tone: tone.value,
      width: width.value,
      dynamics: dynamics.value,
    },
    source: {
      fileName: mastering.source.value?.fileName,
      sampleRate: mastering.source.value?.sampleRate,
      duration: mastering.source.value?.duration,
      metrics: sourceMetrics.value,
    },
    rendered: {
      inputLufs: mastering.rendered.value?.inputLufs,
      outputLufs: mastering.rendered.value?.outputLufs,
      appliedGainDb: mastering.rendered.value?.appliedGainDb,
      stages: mastering.rendered.value?.stages,
      metrics: masterMetrics.value,
    },
    reference: referenceMetrics.value,
  });
}
</script>

<template>
  <ToolShell
    demo-id="mastering"
    :title="t('master.header.title')"
    :version="libVersion"
    status="active"
    :status-label="t('master.header.privacy')"
    :docs-path="docsPath"
    :opposite-locale-path="otherLocalePath"
  >
    <template #modes>
      <div class="master-page master-page__chrome">
        <ToolModeTabs
          v-model="mode"
          :aria-label="t('master.header.mode')"
          :options="modeOptions"
        />
      </div>
    </template>

    <template #statusbar>
      <div class="master-page">
        <ToolStatusBar
          :status="statusVariant"
          :label="statusLabel"
          :pulse="mastering.isRendering.value"
          :fields="statusBarFields"
        />
      </div>
    </template>

    <div class="master-page master-page__main">
      <section v-if="mode === 'quick'" class="master-quick" @drop="handleDrop" @dragover.prevent>
        <TechPanel :title="t('master.quick.step1')">
          <label class="master-drop">
            <input type="file" accept="audio/*" @change="handleFile">
            <span class="master-drop__icon">WAV</span>
            <span class="master-drop__title">
              {{ mastering.source.value?.fileName || t('master.quick.dropTitle') }}
            </span>
            <span class="master-drop__subtitle">{{ t('master.quick.dropSubtitle') }}</span>
            <ScanLine :active="!mastering.source.value" :duration="4" />
          </label>
          <button
            v-if="!mastering.source.value"
            type="button"
            class="master-demo-button"
            @click="loadDemo"
          >
            {{ t('master.studio.loadDemo') }}
          </button>
        </TechPanel>

        <MasteringInsights
          v-if="mastering.source.value"
          :analyzing="isAnalyzingInsights"
          :has-report="!!insightReport"
          :profile-items="insightProfileItems"
          :suggestions="insightSuggestions"
          :preview="insightPreview"
          :can-apply="!!insightReport"
          :quality-target-lufs="qualityGuardLufs"
          @apply="applyAssistantSettings"
          @refresh="analyzeSourceInsights"
        />

        <TechPanel :title="t('master.quick.step2')">
          <MasteringVenueSelector v-model="selectedVenue" :venues="venues" />
        </TechPanel>

        <TechPanel :title="t('master.quick.step3')">
          <MasteringPresetGrid v-model="selectedPreset" :presets="presets" />
        </TechPanel>

        <TechPanel :title="t('master.quick.step4')">
          <MasteringPlatformSelector
            v-model="selectedPlatform"
            v-model:custom-lufs="customLufs"
            :platforms="platforms"
            :eyebrow="t('master.quick.step4')"
            :recommended-lufs="recommendedLufs"
            :current-lufs="targetLufs"
            :preset-name="selectedPresetName"
          />
        </TechPanel>

        <TechPanel :title="t('master.quick.step5')">
          <MasteringFineTune
            v-model:show="showFineTune"
            v-model:tone="tone"
            v-model:width="width"
            v-model:dynamics="dynamics"
            :ceiling-db="moduleSettings.limiterCeilingDb"
            :diagnostic-bypass="diagnosticBypass"
            @update:ceiling-db="updateModuleSetting('limiterCeilingDb', $event)"
            @update:diagnostic-bypass="updateDiagnosticBypass"
          />
        </TechPanel>

        <div class="master-actions">
          <button type="button" class="master-action" :disabled="!canRender" @click="renderMaster">
            {{ mastering.isRendering.value ? t('master.quick.processing') : t('master.quick.processButton') }}
          </button>
          <div class="render-progress" :class="{ 'render-progress--active': mastering.isRendering.value }">
            <span>{{ mastering.isRendering.value ? renderStageLabel : t('master.quick.processingEta', { seconds: mastering.source.value ? '12' : '--' }) }}</span>
            <div class="render-progress__track" aria-hidden="true">
              <span :style="{ width: `${Math.round(mastering.renderProgress.value * 100)}%` }"></span>
            </div>
          </div>
        </div>
      </section>

      <section v-else class="master-studio" @drop="handleDrop" @dragover.prevent>
        <div class="studio-source">
          <label class="studio-source__drop">
            <input type="file" accept="audio/*" @change="handleFile">
            <span class="studio-source__icon" aria-hidden="true">AUD</span>
            <span class="studio-source__meta">
              <strong>{{ mastering.source.value?.fileName || t('master.quick.dropTitle') }}</strong>
              <em>{{ mastering.source.value ? statusBarDuration + ' · ' + statusBarRate + ' · ' + statusBarChannels : t('master.quick.dropSubtitle') }}</em>
            </span>
            <span class="studio-source__cta">
              {{ mastering.source.value ? t('master.studio.replaceSource') : t('master.studio.loadSource') }}
            </span>
          </label>
          <button
            v-if="!mastering.source.value"
            type="button"
            class="studio-source__demo"
            @click="loadDemo"
          >
            {{ t('master.studio.loadDemo') }}
          </button>
        </div>

        <MasteringInsights
          v-if="mastering.source.value"
          :analyzing="isAnalyzingInsights"
          :has-report="!!insightReport"
          :profile-items="insightProfileItems"
          :suggestions="insightSuggestions"
          :preview="insightPreview"
          :can-apply="!!insightReport"
          :quality-target-lufs="qualityGuardLufs"
          @apply="applyAssistantSettings"
          @refresh="analyzeSourceInsights"
        />

        <TechPanel :title="t('master.studio.chain')">
          <MasteringChainPanel
            v-model:active-module="activeModule"
            :modules="modules"
            :chain-settings-url="chainSettingsUrl"
            @save="saveChainPreset"
            @load="loadChainPreset"
            @export="exportChainSettings"
            @import="handleChainImport"
          />
        </TechPanel>

        <TechPanel :title="t(`master.modules.${activeModule}.name`)">
          <MasteringModuleEditor
            :active-module="activeModule"
            :active-stage="activeStage"
            :total-stages="totalStages"
            :source="mastering.source.value"
            :rendered="mastering.rendered.value"
            :module-controls="moduleControls"
            :module-settings="moduleSettings"
            :chain-defaults="chainDefaults"
            :can-reset-active-module="canResetActiveModule"
            :target-lufs="effectiveTargetLufs"
            :selected-platform="selectedPlatform"
            :custom-lufs="customLufs"
            :platforms="platforms"
            @update:module-setting="updateModuleSetting"
            @update:selected-platform="selectedPlatform = $event"
            @update:custom-lufs="customLufs = $event"
            @reset="resetActiveModule"
          />
        </TechPanel>

        <TechPanel :title="t('master.studio.meters')">
          <MasteringMetersPanel
            :readings="meterReadings"
            :meter-targets="meterTargets"
            :module-guide-slugs="moduleGuideSlugs"
            :active-module="activeModule"
            :status-label="statusLabel"
            :rendered="mastering.rendered.value"
            :source-metrics="sourceMetrics"
            :master-metrics="masterMetrics"
            :target-lufs="effectiveTargetLufs"
            :phase-points="phasePoints"
            :stereo-image="stereoImage"
            :glossary-base-path="glossaryBasePath"
            @jump="jumpToModule"
          />
        </TechPanel>

        <div class="studio-render" role="group">
          <TechPanel :title="t('master.reference.title')">
            <MasteringReferencePanel
              :reference="reference"
              :reference-metrics="referenceMetrics"
              :reference-url="referenceUrl"
              :master-crest="masterMetrics?.crest || null"
              :is-rendering="mastering.isRendering.value"
              :can-match="!!mastering.source.value && !!reference"
              @file="handleReferenceFile"
              @match="renderReferenceMatch"
            />
          </TechPanel>

          <div class="studio-output" role="group" :aria-label="t('master.studio.render')">
            <div class="studio-output__meta">
              <em>OUT</em>
              <span :title="mastering.isRendering.value ? renderStageLabel : t('master.studio.renderHint')">{{ mastering.isRendering.value ? renderStageLabel : t('master.studio.renderHint') }}</span>
            </div>
            <div class="studio-output__bar render-progress" :class="{ 'render-progress--active': mastering.isRendering.value }" aria-hidden="true">
              <div class="render-progress__track">
                <span :style="{ width: `${Math.round(mastering.renderProgress.value * 100)}%` }"></span>
              </div>
            </div>
            <button type="button" class="master-action studio-output__cta" :disabled="!canRender" @click="renderMaster">
              {{ mastering.isRendering.value ? t('master.studio.rendering') : t('master.studio.render') }}
            </button>
          </div>
        </div>
      </section>

      <TechPanel :title="t('master.result.title')">
        <MasteringResultPanel
          ref="resultPanel"
          v-model:listen-target="listenTarget"
          v-model:loudness-matched="loudnessMatched"
          :source="mastering.source.value"
          :source-metrics="sourceMetrics"
          :master-metrics="masterMetrics"
          :result-wave-audio="resultWaveAudio"
          :result-wave-compare="resultWaveCompare"
          :result-wave-variant="resultWaveVariant"
          :result-wave-label="resultWaveLabel"
          :playback-url="playbackUrl"
          :source-url="sourceUrl"
          :output-url="outputUrl"
          :reference-url="referenceUrl"
          :report-url="reportUrl"
          :render-result-stages="renderResultStages"
          :error="localError || mastering.error.value"
        />
      </TechPanel>

    </div>
  </ToolShell>
</template>

<style scoped src="./mastering/masteringDemoBase.css"></style>
<style scoped src="./mastering/masteringDemoQuick.css"></style>
<style scoped src="./mastering/masteringDemoStudio.css"></style>
<style scoped src="./mastering/masteringDemoResponsive.css"></style>


<style src="./mastering/masteringDemoGlobal.css"></style>
