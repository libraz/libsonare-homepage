<script setup lang="ts">
/**
 * Source loading: drop or choose a file (or the demo clip), the loaded file's
 * facts, and the notes a restored session leaves until its audio is back.
 */
import { computed, ref } from 'vue';
import { fill, useMasteringCopy } from '@/demos/mastering/masteringCopy';
import { formatNumber } from '@/demos/mastering/masteringUi';
import type { MasteringFileInfo } from '@/demos/mastering/useMastering';
import { formatClipLength } from '@/utils/audio';

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
      <span class="source__cta">{{ info ? copy.source.replace : copy.source.choose }}</span>
    </label>
    <button v-if="!info" type="button" class="source__demo" :disabled="disabled || loading" @click="emit('demo')">
      {{ copy.source.demo }}
    </button>
    <p v-if="pendingRestore" class="source__note" role="status">
      {{ copy.source.restored }}<template v-if="restoredName"> ({{ restoredName }})</template>
    </p>
    <p v-if="notices.length" class="source__note" role="status">
      {{ fill(copy.source.notices, { list: notices.join(', ') }) }}
      <button type="button" @click="emit('dismissNotices')">{{ copy.source.dismiss }}</button>
    </p>
    <p v-if="error" class="source__error" role="alert">{{ error }}</p>
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
  border-radius: 6px;
  background: var(--demo-dropzone-bg);
  cursor: pointer;
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
  padding: 5px 10px;
  border: 1px solid var(--demo-border-strong);
  border-radius: 4px;
  color: var(--demo-text);
  font-family: var(--font-mono);
  font-size: 11px;
}

.source__demo,
.source__note button {
  padding: 6px 12px;
  border: 1px solid var(--demo-border-strong);
  border-radius: 6px;
  background: transparent;
  color: var(--demo-text);
  font-family: var(--font-mono);
  font-size: 11px;
  cursor: pointer;
}

.source__demo:focus-visible,
.source__note button:focus-visible {
  outline: 2px solid var(--demo-accent);
  outline-offset: 2px;
}

.source__note,
.source__error {
  grid-column: 1 / -1;
  margin: 0;
  padding: 8px 12px;
  border: 1px solid var(--demo-accent-border);
  border-radius: 6px;
  background: var(--demo-accent-subtle);
  color: var(--demo-text);
  font-size: 12.5px;
  line-height: 1.5;
}

.source__note button {
  margin-left: 8px;
  padding: 2px 8px;
}

.source__error {
  border-color: var(--demo-warn-border);
  background: var(--demo-warn-bg);
  color: var(--demo-warn-text);
}

.source--compact .source__drop {
  padding: 8px 12px;
}
</style>
