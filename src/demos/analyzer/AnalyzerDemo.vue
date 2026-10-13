<script setup lang="ts">
import { computed, ref } from 'vue';
import ToolShell from '@/components/ToolShell.vue';
import ToolStatusBar from '@/components/ToolStatusBar.vue';
import { useI18n } from '@/composables/useI18n';
import { useWasmBoot } from '@/composables/useWasmBoot';
import AudioAnalyzer, { type AnalyzerStatus } from '@/demos/analyzer/AudioAnalyzer.vue';
import { enCopy, jaCopy } from '@/demos/analyzer/analyzerCopy';

const { localizedPath, alternateLocalePath, localizedValue } = useI18n();

const { version: libVersion, error: initError } = useWasmBoot();
const initFailed = computed(() => Boolean(initError.value));

const copy = computed(() => localizedValue({ en: enCopy, ja: jaCopy }).page);

/** The player reports its state; this page renders it in the shell's status bar. */
const analyzerStatus = ref<AnalyzerStatus | null>(null);

const statusKind = computed<'active' | 'error'>(() => (initFailed.value ? 'error' : 'active'));
const statusLabel = computed(() =>
  initFailed.value ? copy.value.initError : copy.value.localOnly,
);
const docsPath = computed(() => localizedPath('/docs/wasm'));
const oppositeLocalePath = computed(() => alternateLocalePath('/analyzer'));
</script>

<template>
  <ToolShell
    demo-id="analyzer"
    :title="copy.title"
    :subtitle="copy.subtitle"
    :version="libVersion"
    :status="statusKind"
    :status-label="statusLabel"
    :docs-path="docsPath"
    :guide-title="copy.guideTitle"
    :guide-body="copy.guideBody"
    :guide-link-label="copy.guideDocs"
    :opposite-locale-path="oppositeLocalePath"
  >
    <template #statusbar>
      <ToolStatusBar
        v-if="analyzerStatus"
        :status="analyzerStatus.status"
        :label="analyzerStatus.label"
        :pulse="analyzerStatus.pulse"
        :fields="analyzerStatus.fields"
      />
    </template>
    <AudioAnalyzer :lib-version="libVersion" @status="analyzerStatus = $event" />
  </ToolShell>
</template>
