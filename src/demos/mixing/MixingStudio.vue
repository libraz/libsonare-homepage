<script setup lang="ts">
/**
 * /mixing: an eight-track console on the realtime engine. Arrangement on top,
 * the console with its returns, VCAs and master section below, the selected
 * strip's inspector beside it, and the mix assistant and export underneath.
 * Every control edits one project state through the controller, so it plays
 * live and the bounce renders the same mix.
 */
import { computed, onMounted, onUnmounted, provide, ref } from 'vue';
import ToolShell from '@/components/ToolShell.vue';
import ToolStatusBar, { type ToolStatusField } from '@/components/ToolStatusBar.vue';
import { DemoNotice, TermLabel } from '@/components/ui';
import { useI18n } from '@/composables/useI18n';
import { isMacPlatform, useShortcuts } from '@/composables/useShortcuts';
import { useWasmBoot } from '@/composables/useWasmBoot';
import MixArrangement from '@/demos/mixing/MixArrangement.vue';
import MixAssistantPanel from '@/demos/mixing/MixAssistantPanel.vue';
import MixConsole from '@/demos/mixing/MixConsole.vue';
import MixExportPanel from '@/demos/mixing/MixExportPanel.vue';
import MixInspector from '@/demos/mixing/MixInspector.vue';
import MixMasterSection from '@/demos/mixing/MixMasterSection.vue';
import { MAX_TRACKS } from '@/demos/mixing/mixingConstants';
import { enCopy, jaCopy, MIXING_COPY } from '@/demos/mixing/mixingCopy';
import { createMixingTerm, MIXING_TERM } from '@/demos/mixing/mixingTerms';
import { audioBudget, formatClock, formatNumber } from '@/demos/mixing/mixingUi';
import { useMixingStudio } from '@/demos/mixing/useMixingStudio';
import { fill } from '@/utils/template';

const { localizedPath, alternateLocalePath, localizedValue } = useI18n();
const copy = computed(() => localizedValue({ en: enCopy, ja: jaCopy }));
const glossaryBase = computed(() => localizedPath('/docs/glossary'));
const term = createMixingTerm(copy, glossaryBase);
provide(MIXING_COPY, copy);
provide(MIXING_TERM, term);

const { version: libVersion, module: wasmModule } = useWasmBoot();
const m = useMixingStudio({ copy, wasm: wasmModule });
const {
  state,
  job,
  loading,
  error,
  notices,
  missingAudio,
  hasAudio,
  ab,
  lastRender,
  duration,
  sonare,
  editLocked,
} = m;

const docsPath = computed(() => localizedPath('/docs/use-cases/browser-mixer'));
const otherLocalePath = computed(() => alternateLocalePath('/mixing'));

const fileInput = ref<HTMLInputElement | null>(null);
const inspectorOpen = ref(false);
const dragOver = ref(false);

function chooseFiles(): void {
  fileInput.value?.click();
}

async function onFiles(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  input.value = '';
  await m.addFiles(files);
}

async function onDrop(event: DragEvent): Promise<void> {
  dragOver.value = false;
  const files = Array.from(event.dataTransfer?.files ?? []).filter(
    (file) =>
      !file.type ||
      file.type.startsWith('audio/') ||
      /\.(wav|mp3|flac|ogg|m4a|aac|aiff?)$/i.test(file.name),
  );
  await m.addFiles(files);
}

const mac = isMacPlatform();
const mod = mac ? '⌘' : 'Ctrl';
const shift = mac ? '⇧' : 'Shift';
const shortcuts = computed(() => {
  const label = copy.value.header.shortcuts;
  return [
    { keys: ['Space'], label: label.play },
    { keys: ['Home'], label: label.home },
    { keys: ['L'], label: label.loop },
    { keys: ['M', 'S'], label: label.muteSolo },
    { keys: [mod, 'Z'], label: label.undo },
    { keys: [shift, mod, 'Z'], label: label.redo },
  ];
});

useShortcuts({
  Space: () => m.togglePlay(),
  Home: () => m.seek(0),
  KeyL: () => m.toggleLoop(),
  KeyM: () => m.toggleSelected('muted'),
  KeyS: () => m.toggleSelected('soloed'),
  'Mod+KeyZ': () => m.undo(),
  'Mod+Shift+KeyZ': () => m.redo(),
});

// ---------------------------------------------------------------------------
// Status bar

const budget = computed(() => audioBudget(state.value.tracks));

const statusFields = computed<ToolStatusField[]>(() => {
  const keys = copy.value.statusFields;
  const rate = sonare.context.value?.sampleRate;
  const render = lastRender.value?.result;
  return [
    { key: keys.tracks, value: `${state.value.tracks.length}/${MAX_TRACKS}` },
    {
      key: keys.budget,
      value: fill(copy.value.budget.left, { min: formatNumber(budget.value.remainingSec / 60, 1) }),
      wide: true,
    },
    { key: keys.length, value: duration.value > 0 ? formatClock(duration.value) : '—' },
    { key: keys.rate, value: rate ? `${formatNumber(rate / 1000, rate % 1000 ? 1 : 0)}k` : '—' },
    {
      key: keys.render,
      value: render
        ? `${formatNumber(render.integratedLufs, 1)} LUFS · ${formatNumber(render.truePeakDb, 1)} dBTP`
        : '—',
      wide: true,
    },
  ];
});

const status = computed<{ variant: 'idle' | 'active' | 'warning' | 'error'; label: string }>(() => {
  const text = copy.value.status;
  if (error.value) return { variant: 'error', label: text.error };
  if (loading.value) return { variant: 'warning', label: text.loading };
  if (job.value) return { variant: 'warning', label: text[job.value.kind] };
  if (ab.value === 'b') return { variant: 'warning', label: text.auditioning };
  if (missingAudio.value.length > 0) return { variant: 'idle', label: text.pending };
  if (sonare.playing.value) return { variant: 'active', label: text.playing };
  if (hasAudio.value) return { variant: 'active', label: text.ready };
  return { variant: 'idle', label: text.idle };
});

const budgetHint = computed(() =>
  budget.value.perFreeSlotSec > 0
    ? fill(copy.value.budget.perSlot, {
        sec: Math.floor(Math.min(300, budget.value.perFreeSlotSec)),
      })
    : copy.value.budget.full,
);

const noticeText = computed(() =>
  notices.value.map((notice) => fill(copy.value.notices[notice.key], notice.values)),
);

onMounted(() => {
  m.restore();
});

onUnmounted(() => {
  m.dispose();
});
</script>

<template>
  <ToolShell
    demo-id="mixing"
    :title="copy.header.title"
    :subtitle="copy.header.subtitle"
    :version="libVersion"
    status="active"
    :status-label="copy.header.privacy"
    :docs-path="docsPath"
    :guide-title="copy.help.title"
    :guide-body="copy.help.body"
    :guide-link-label="copy.help.docs"
    :opposite-locale-path="otherLocalePath"
  >
    <template #modes>
      <div class="mix-page mix-page__chrome">
        <div class="mix-page__actions">
          <button
            type="button"
            class="demo-btn demo-btn--primary"
            :disabled="loading || editLocked || state.tracks.length >= MAX_TRACKS && missingAudio.length === 0"
            @click="chooseFiles"
          >{{ copy.header.addTracks }}</button>
          <button
            v-if="state.tracks.length === 0 || missingAudio.length > 0"
            type="button"
            class="demo-btn"
            :disabled="loading || editLocked"
            @click="m.loadDemo"
          >{{ copy.header.loadDemo }}</button>
          <span class="mix-page__budget">
            <TermLabel v-bind="term('budget', true)">{{ fill(copy.budget.left, { min: formatNumber(budget.remainingSec / 60, 1) }) }}</TermLabel>
            <span>{{ budgetHint }}</span>
          </span>
        </div>
        <div class="mix-page__history">
          <button type="button" class="demo-btn demo-btn--sm" :disabled="!m.canUndo.value || editLocked" :aria-keyshortcuts="mac ? 'Meta+Z' : 'Control+Z'" @click="m.undo">
            {{ copy.header.undo }}
          </button>
          <button type="button" class="demo-btn demo-btn--sm" :disabled="!m.canRedo.value || editLocked" :aria-keyshortcuts="mac ? 'Meta+Shift+Z' : 'Control+Shift+Z'" @click="m.redo">
            {{ copy.header.redo }}
          </button>
          <button type="button" class="demo-btn demo-btn--sm mix-page__drawer-toggle" :aria-expanded="inspectorOpen" @click="inspectorOpen = !inspectorOpen">
            {{ copy.header.inspector }}
          </button>
        </div>
        <input ref="fileInput" class="mix-page__file" type="file" accept="audio/*" multiple @change="onFiles">
      </div>
    </template>

    <template #statusbar>
      <div class="mix-page">
        <ToolStatusBar :status="status.variant" :label="status.label" :pulse="job !== null || loading" :fields="statusFields" />
      </div>
    </template>

    <div
      class="mix-page mix-page__main"
      :class="{ 'mix-page__main--drop': dragOver }"
      @dragover.prevent="dragOver = true"
      @dragleave.self="dragOver = false"
      @drop.prevent="onDrop"
    >
      <DemoNotice v-if="error" tone="error">{{ copy.errors[error] }}</DemoNotice>
      <DemoNotice v-if="noticeText.length" tone="warn" dismissible @dismiss="m.dismissNotices">
        <ul class="mix-page__notices">
          <li v-for="(text, i) in noticeText" :key="i">{{ text }}</li>
        </ul>
      </DemoNotice>
      <DemoNotice v-if="missingAudio.length > 0" tone="info" class="mix-page__restore" :title="copy.restore.title">
        {{ fill(copy.restore.body, { n: missingAudio.length }) }}
        <template #action>
          <div class="mix-page__notice-actions">
            <button type="button" class="demo-btn demo-btn--sm" :disabled="loading" @click="chooseFiles">{{ copy.header.addTracks }}</button>
            <button type="button" class="demo-btn demo-btn--sm" :disabled="loading" @click="m.loadDemo">{{ copy.header.loadDemo }}</button>
          </div>
        </template>
      </DemoNotice>
      <DemoNotice v-if="job && job.kind === 'export'" tone="info">{{ copy.jobs.locked }}</DemoNotice>

      <button v-if="state.tracks.length === 0" type="button" class="mix-page__drop" @click="chooseFiles">
        <strong>{{ copy.import.dropTitle }}</strong>
        <span>{{ copy.import.dropBody }}</span>
      </button>

      <MixArrangement :m="m" />

      <div class="mix-page__desk">
        <div class="mix-page__console">
          <MixConsole :m="m" @add="chooseFiles" />
        </div>
        <MixMasterSection class="mix-page__master" :m="m" />
        <aside class="mix-page__inspector" :class="{ 'mix-page__inspector--open': inspectorOpen }">
          <MixInspector :m="m" @close="inspectorOpen = false" />
        </aside>
      </div>

      <div class="mix-page__lower">
        <MixAssistantPanel :m="m" />
        <MixExportPanel :m="m" />
      </div>

      <p class="mix-page__keys">
        <span v-for="shortcut in shortcuts" :key="shortcut.label" class="mix-page__key">
          <kbd v-for="key in shortcut.keys" :key="key" class="demo-kbd">{{ key }}</kbd>
          {{ shortcut.label }}
        </span>
      </p>
    </div>
  </ToolShell>
</template>

<style scoped src="./mixingStudio.css"></style>
