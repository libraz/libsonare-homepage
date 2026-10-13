<script setup lang="ts">
/**
 * Source loading: drop or choose a file (or the demo clip), the loaded file's
 * facts, and the notes a restored session leaves until its audio is back.
 */
import { computed, ref } from 'vue';
import { DemoNotice } from '@/components/ui';
import { useMasteringCopy } from '@/demos/mastering/masteringCopy';
import { formatNumber } from '@/demos/mastering/masteringUi';
import type { MasteringFileInfo } from '@/demos/mastering/useMastering';
import { formatClipLength } from '@/utils/audio';
import { fill } from '@/utils/template';

const props = defineProps<{
  info: MasteringFileInfo | null;
  loading: boolean;
  disabled?: boolean;
  pendingRestore: boolean;
  /** Name of the file the restored session was made with. */
  restoredName: string | null;
  notices: string[];
  /** Visitor-facing error text, or null. */
  error: string | null;
  compact?: boolean;
}>();

const emit = defineEmits<{
  file: [file: File];
  demo: [];
  dismissNotices: [];
}>();

const copy = useMasteringCopy();
const dragging = ref(false);

const facts = computed(() => {
  const info = props.info;
  if (!info) return '';
  const rate = `${formatNumber(info.sampleRate / 1000, info.sampleRate % 1000 ? 1 : 0)} kHz`;
  const channels =
    info.channels === 1
      ? copy.value.source.mono
      : fill(copy.value.source.channels, { n: info.channels });
  return `${formatClipLength(info.duration)} · ${rate} · ${channels}`;
});

function onInput(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (file) emit('file', file);
}

function onDrop(event: DragEvent): void {
  dragging.value = false;
  const file = event.dataTransfer?.files?.[0];
  if (file && !props.disabled) emit('file', file);
}
</script>

<template>
  <section class="source" :class="{ 'source--compact': compact }" :aria-label="copy.source.title">
    <label
      class="source__drop"
      :class="{ 'is-dragging': dragging, 'is-loaded': info, 'is-disabled': disabled }"
      @dragover.prevent="dragging = true"
      @dragleave="dragging = false"
      @drop.prevent="onDrop"
    >
      <input type="file" accept="audio/*" :disabled="disabled || loading" @change="onInput">
      <span class="source__name">
        {{ loading ? copy.source.loading : (info?.fileName ?? copy.source.drop) }}
      </span>
      <span class="source__facts">{{ info ? facts : copy.source.dropHint }}</span>
      <span class="demo-btn demo-btn--sm source__cta" aria-hidden="true">{{ info ? copy.source.replace : copy.source.choose }}</span>
    </label>
    <button v-if="!info" type="button" class="demo-btn source__demo" :disabled="disabled || loading" @click="emit('demo')">
      {{ copy.source.demo }}
    </button>
    <DemoNotice v-if="pendingRestore" class="source__notice" tone="info">
      {{ copy.source.restored }}<template v-if="restoredName"> ({{ restoredName }})</template>
    </DemoNotice>
    <DemoNotice v-if="notices.length" class="source__notice" tone="warn" dismissible @dismiss="emit('dismissNotices')">
      {{ fill(copy.source.notices, { list: notices.join(', ') }) }}
    </DemoNotice>
    <DemoNotice v-if="error" class="source__notice" tone="error">{{ error }}</DemoNotice>
  </section>
</template>

<style scoped>
.source {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px 10px;
  align-items: stretch;
}

.source__drop {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-rows: auto auto;
  column-gap: 12px;
  align-items: center;
  padding: 10px 14px;
  border: 1px dashed var(--demo-border-strong);
  border-radius: var(--demo-radius-sm);
  background: var(--demo-dropzone-bg);
  cursor: pointer;
  transition:
    border-color var(--demo-dur-fast) var(--demo-ease-standard),
    background-color var(--demo-dur-fast) var(--demo-ease-standard);
}

.source__drop:hover:not(.is-disabled) {
  border-color: var(--demo-accent);
}

.source__drop.is-loaded {
  border-style: solid;
  border-color: var(--demo-border);
}

.source__drop.is-dragging {
  border-color: var(--demo-accent);
  background: var(--demo-accent-subtle);
}

.source__drop.is-disabled {
  opacity: var(--demo-disabled-opacity);
  cursor: not-allowed;
}

.source__drop input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: inherit;
}

.source__drop:focus-within {
  outline: 2px solid var(--demo-accent);
  outline-offset: 2px;
}

.source__name {
  overflow: hidden;
  color: var(--demo-text-strong);
  font-family: var(--font-body);
  font-size: 14px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.source__facts {
  grid-column: 1;
  color: var(--demo-text-muted);
  font-family: var(--font-mono);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  line-height: 1.5;
}

.source__cta {
  grid-column: 2;
  grid-row: 1 / span 2;
  pointer-events: none;
}

.source__demo {
  min-height: 100%;
}

.source__notice {
  grid-column: 1 / -1;
}

.source--compact .source__drop {
  padding: 8px 12px;
}
</style>
