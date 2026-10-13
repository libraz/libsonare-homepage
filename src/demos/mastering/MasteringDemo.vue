<script setup lang="ts">
/**
 * /mastering: a master chain on the realtime engine (repair preprocess, strip
 * EQ and 13 fixed inserts on lane 1, with Before and Reference lanes for
 * A/B/R), in a Quick flow and a Studio view over the same project state.
 */
import { computed, onMounted, onUnmounted, provide, ref, watch } from 'vue';
import ToolShell from '@/components/ToolShell.vue';
import ToolStatusBar, { type ToolStatusField } from '@/components/ToolStatusBar.vue';
import SegmentedControl, { type SegmentedOption } from '@/components/ui/SegmentedControl.vue';
import { useI18n } from '@/composables/useI18n';
import { isMacPlatform, useShortcuts } from '@/composables/useShortcuts';
import { useUrlState } from '@/composables/useUrlState';
import { useWasmBoot } from '@/composables/useWasmBoot';
import MasteringQuick from '@/demos/mastering/MasteringQuick.vue';
import MasteringStudio from '@/demos/mastering/MasteringStudio.vue';
import { enCopy, jaCopy, MASTERING_COPY } from '@/demos/mastering/masteringCopy';
import { MASTERING_REPAIR_STAGES } from '@/demos/mastering/masteringState';
import { formatNumber, type MasteringMode } from '@/demos/mastering/masteringUi';
import { useMastering } from '@/demos/mastering/useMastering';
import { formatClipLength } from '@/utils/audio';
import { fill } from '@/utils/template';

const { localizedPath, alternateLocalePath, localizedValue } = useI18n();
const copy = computed(() => localizedValue({ en: enCopy, ja: jaCopy }));
provide(MASTERING_COPY, copy);

const m = useMastering({ copy });
const {
  state,
  job,
  fitStale,
  sourceInfo,
  lastRender,
  now,
  pendingRestore,
  error,
  loading,
  hasProgram,
} = m;

const { version: libVersion } = useWasmBoot();
const docsPath = computed(() => localizedPath('/docs/glossary/mastering'));
const glossaryBase = computed(() => localizedPath('/docs/glossary'));
const otherLocalePath = computed(() => alternateLocalePath('/mastering'));

const mode = computed<MasteringMode>({
  get: () => state.value.mode,
  set: (next) => {
    if (next !== state.value.mode) m.edit('setMode', next);
  },
});
const modeOptions = computed<SegmentedOption[]>(() => [
  { id: 'quick', label: copy.value.modes.quick },
  { id: 'studio', label: copy.value.modes.studio },
]);

// Quick is the silent default, so only Studio spells itself out in the query.
const modeUrl = useUrlState([
  {
    key: 'mode',
    state: mode,
    defaultValue: 'quick' as MasteringMode,
    parse: (raw: string) => (raw === 'studio' || raw === 'quick' ? raw : null),
  },
]);

// Holds the page height across a Quick/Studio switch, so the crossfade does not scroll the page.
const viewRef = ref<HTMLElement | null>(null);
const reservedHeight = ref<number | null>(null);
watch(mode, () => {
  reservedHeight.value = viewRef.value?.offsetHeight ?? null;
});

const mac = isMacPlatform();
const shortcuts = computed(() => {
  const label = copy.value.header.shortcuts;
  const mod = mac ? '⌘' : 'Ctrl';
  const shift = mac ? '⇧' : 'Shift';
  return [
    { keys: ['Space'], label: label.play },
    { keys: ['Home'], label: label.start },
    { keys: ['L'], label: label.loop },
    { keys: ['A', 'B', 'R'], label: label.monitor },
    { keys: [mod, 'Z'], label: label.undo },
    { keys: [shift, mod, 'Z'], label: label.redo },
  ];
});

useShortcuts({
  Space: () => m.togglePlay(),
  Home: () => m.seek(0),
  KeyL: () => m.toggleLoop(),
  KeyA: () => m.setLane('after'),
  KeyB: () => m.setLane('before'),
  KeyR: () => m.setLane('reference'),
  'Mod+KeyZ': () => m.undo(),
  'Mod+Shift+KeyZ': () => m.redo(),
});

// ---------------------------------------------------------------------------
// Status bar

const platformName = computed(() => copy.value.platforms.names[state.value.quick.platform]);

const fitField = computed(() => {
  const text = copy.value.fit;
  const fit = state.value.loudness.fit;
  if (!fit) return text.none;
  if (fitStale.value) return text.stale;
  if (fit.limited) return fill(text.limited, { lu: formatNumber(Math.abs(fit.residualLu), 1) });
  return fill(text.fitted, { lufs: formatNumber(fit.measuredLufs, 1) });
});

const prepField = computed(() => {
  const text = copy.value.prep;
  if (job.value?.kind === 'prepare')
    return fill(text.running, { pct: Math.round(job.value.progress * 100) });
  if (m.prepareFailed.value) return text.failed;
  const on = MASTERING_REPAIR_STAGES.filter((stage) => state.value.repair[stage].enabled).length;
  return on ? fill(copy.value.rack.repairSummary, { n: on }) : text.off;
});

const renderField = computed(() => {
  const render = lastRender.value;
  if (!render) return copy.value.render.never;
  const seconds = Math.max(0, Math.round((now.value - render.at) / 1000));
  return seconds < 120
    ? fill(copy.value.render.secondsAgo, { n: seconds })
    : fill(copy.value.render.minutesAgo, { n: Math.round(seconds / 60) });
});

const statusFields = computed<ToolStatusField[]>(() => {
  const keys = copy.value.statusFields;
  const info = sourceInfo.value;
  return [
    { key: keys.source, value: info?.fileName ?? '—', wide: true },
    { key: keys.length, value: info ? formatClipLength(info.duration) : '—' },
    {
      key: keys.rate,
      value: info
        ? `${formatNumber(info.sampleRate / 1000, info.sampleRate % 1000 ? 1 : 0)}k`
        : '—',
    },
    {
      key: keys.target,
      value: `${platformName.value} · ${formatNumber(m.targetLufs.value, 1)} LUFS`,
    },
    { key: keys.fit, value: fitField.value },
    { key: keys.prep, value: prepField.value, divider: true },
    { key: keys.render, value: renderField.value },
  ];
});

const status = computed<{ variant: 'idle' | 'active' | 'warning' | 'error'; label: string }>(() => {
  const text = copy.value.status;
  if (error.value) return { variant: 'error', label: text.error };
  if (loading.value) return { variant: 'warning', label: text.loading };
  if (job.value && job.value.kind !== 'assist' && job.value.kind !== 'preview') {
    return { variant: 'warning', label: text.busy };
  }
  if (!hasProgram.value)
    return { variant: 'idle', label: pendingRestore.value ? text.pending : text.idle };
  if (fitStale.value) return { variant: 'warning', label: text.stale };
  return { variant: 'active', label: text.ready };
});

const backgroundJob = computed(() =>
  job.value && (job.value.kind === 'prepare' || job.value.kind === 'reference') ? job.value : null,
);

onMounted(() => {
  m.restore();
  modeUrl.applyFromUrl();
  modeUrl.replaceInUrl();
  modeUrl.enable();
});

onUnmounted(() => {
  modeUrl.disable();
  m.dispose();
});
</script>

<template>
  <ToolShell
    demo-id="mastering"
    :title="copy.header.title"
    :version="libVersion"
    status="active"
    :status-label="copy.header.privacy"
    :docs-path="docsPath"
    :guide-title="copy.header.guideTitle"
    :guide-body="copy.header.guideBody"
    :guide-link-label="copy.header.guideLink"
    :opposite-locale-path="otherLocalePath"
  >
    <template #modes>
      <div class="master-page master-page__chrome">
        <SegmentedControl
          :model-value="mode"
          :ariaLabel="copy.header.modeLabel"
          :options="modeOptions"
          @update:model-value="(next: string) => (mode = next as MasteringMode)"
        />
        <div class="master-page__history">
          <button type="button" class="demo-btn demo-btn--sm" :disabled="!m.canUndo.value" :aria-keyshortcuts="mac ? 'Meta+Z' : 'Control+Z'" @click="m.undo">
            {{ copy.header.undo }}
          </button>
          <button type="button" class="demo-btn demo-btn--sm" :disabled="!m.canRedo.value" :aria-keyshortcuts="mac ? 'Meta+Shift+Z' : 'Control+Shift+Z'" @click="m.redo">
            {{ copy.header.redo }}
          </button>
        </div>
      </div>
    </template>

    <template #statusbar>
      <div class="master-page">
        <ToolStatusBar
          :status="status.variant"
          :label="status.label"
          :pulse="job !== null"
          :fields="statusFields"
        />
      </div>
    </template>

    <div class="master-page master-page__main">
      <Transition name="demo-rise">
        <div v-if="backgroundJob" class="master-page__job">
          <span>{{ copy.jobs[backgroundJob.kind] }} {{ Math.round(backgroundJob.progress * 100) }}%</span>
          <span
            class="master-page__bar"
            role="progressbar"
            :aria-label="copy.jobs[backgroundJob.kind]"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-valuenow="Math.round(backgroundJob.progress * 100)"
          ><i :style="{ transform: `scaleX(${backgroundJob.progress})` }"></i></span>
          <button type="button" class="demo-btn demo-btn--sm" @click="m.cancelJob">{{ copy.jobs.cancel }}</button>
        </div>
      </Transition>
      <div
        ref="viewRef"
        :style="reservedHeight === null ? undefined : { minBlockSize: `${reservedHeight}px` }"
      >
        <Transition name="demo-fade" mode="out-in" @after-enter="reservedHeight = null">
          <MasteringQuick v-if="mode === 'quick'" :m="m" />
          <MasteringStudio v-else :m="m" :glossary-base="glossaryBase" />
        </Transition>
      </div>
      <p class="master-page__keys" :aria-label="copy.header.shortcutsLabel">
        <span v-for="shortcut in shortcuts" :key="shortcut.label" class="master-page__key">
          <kbd v-for="key in shortcut.keys" :key="key" class="demo-kbd">{{ key }}</kbd>
          {{ shortcut.label }}
        </span>
      </p>
    </div>
  </ToolShell>
</template>

<style scoped src="./masteringDemo.css"></style>
