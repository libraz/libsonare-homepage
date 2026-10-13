<script setup lang="ts">
import { ref } from 'vue';
import { CornerBrackets, ScanLine } from '@/components/ui';
import { useI18n } from '@/composables/useI18n';

const emit = defineEmits<(e: 'file', file: File) => void>();

const { t } = useI18n();
const isDragging = ref(false);
const isHovering = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

const acceptedTypes = [
  'audio/mpeg',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/flac',
  'audio/ogg',
  'audio/mp3',
];

function handleDragEnter(e: DragEvent) {
  e.preventDefault();
  isDragging.value = true;
}

function handleDragLeave(e: DragEvent) {
  e.preventDefault();
  isDragging.value = false;
}

function handleDragOver(e: DragEvent) {
  e.preventDefault();
}

function handleDrop(e: DragEvent) {
  e.preventDefault();
  isDragging.value = false;

  const files = e.dataTransfer?.files;
  if (files && files.length > 0) {
    const file = files[0];
    if (isValidAudioFile(file)) {
      emit('file', file);
    }
  }
}

function handleClick() {
  fileInput.value?.click();
}

function handleFileSelect(e: Event) {
  const input = e.target as HTMLInputElement;
  const files = input.files;
  if (files && files.length > 0) {
    emit('file', files[0]);
  }
}

function isValidAudioFile(file: File): boolean {
  return (
    acceptedTypes.includes(file.type) ||
    file.name.endsWith('.mp3') ||
    file.name.endsWith('.wav') ||
    file.name.endsWith('.flac') ||
    file.name.endsWith('.ogg')
  );
}
</script>

<template>
  <input
    ref="fileInput"
    type="file"
    accept="audio/*"
    class="dropzone__input"
    @change="handleFileSelect"
  />
  <button
    type="button"
    class="dropzone"
    :class="{ 'dropzone--dragging': isDragging, 'dropzone--hover': isHovering }"
    @dragenter="handleDragEnter"
    @dragleave="handleDragLeave"
    @dragover="handleDragOver"
    @drop="handleDrop"
    @click="handleClick"
    @mouseenter="isHovering = true"
    @mouseleave="isHovering = false"
  >
    <CornerBrackets :color="isDragging ? 'var(--demo-accent)' : undefined" />

    <span class="dropzone__grid" aria-hidden="true"></span>

    <span class="dropzone__content">
      <span class="dropzone__icon" aria-hidden="true">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M3 15v4c0 1.1.9 2 2 2h14a2 2 0 002-2v-4M17 8l-5-5-5 5M12 3v12" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>
      <span class="dropzone__text">
        <span class="dropzone__title">{{ t('demo.dropzone.title') }}</span>
        <span class="dropzone__subtitle">{{ t('demo.dropzone.subtitle') }}</span>
      </span>
      <span class="dropzone__formats">{{ t('demo.dropzone.formats') }}</span>
    </span>

    <ScanLine :active="isHovering || isDragging" :duration="3" />
  </button>
</template>

<style scoped>
.dropzone {
  --accent: var(--demo-accent);
  --accent-dim: var(--demo-accent-dim);
  --bg: var(--demo-dropzone-bg);
  --border: var(--demo-accent-border);

  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  max-width: 500px;
  min-height: 220px;
  padding: 2.5rem 2rem;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--demo-radius-lg);
  color: inherit;
  cursor: pointer;
  transition:
    border-color var(--demo-dur-fast) var(--demo-ease-standard),
    background-color var(--demo-dur-fast) var(--demo-ease-standard),
    box-shadow var(--demo-dur-base) var(--demo-ease-standard),
    transform var(--demo-dur-base) var(--demo-ease-standard);
  font-family: var(--font-mono);
  overflow: hidden;
}

.dropzone:focus-visible {
  outline: 2px solid var(--demo-accent);
  outline-offset: 3px;
}

.dropzone__grid {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(var(--demo-grid-minor) 1px, transparent 1px),
    linear-gradient(90deg, var(--demo-grid-minor) 1px, transparent 1px);
  background-size: 20px 20px;
  opacity: 0.5;
  pointer-events: none;
}

.dropzone:hover {
  border-color: var(--accent-dim);
  box-shadow: var(--demo-shadow-glow);
}

.dropzone:hover .dropzone__icon {
  transform: translateY(-4px);
}

.dropzone--dragging {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--demo-accent) 8%, var(--demo-dropzone-bg));
  transform: scale(1.01);
  box-shadow: 0 0 60px -10px var(--demo-accent-dim);
}

.dropzone--dragging .dropzone__icon {
  transform: translateY(-8px) scale(1.1);
  color: var(--accent);
}

.dropzone__input {
  display: none;
}

/* Content */
.dropzone__grid,
.dropzone__content,
.dropzone__icon,
.dropzone__text,
.dropzone__title,
.dropzone__subtitle,
.dropzone__formats {
  display: block;
}

.dropzone__content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  text-align: center;
}

.dropzone__icon {
  color: color-mix(in srgb, var(--demo-accent) 70%, transparent);
  transition:
    color var(--demo-dur-base) var(--demo-ease-standard),
    transform var(--demo-dur-base) var(--demo-ease-enter);
}

.dropzone__text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dropzone__title {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.1em;
  color: var(--demo-text-strong);
  text-transform: uppercase;
}

.dropzone__subtitle {
  font-size: 11px;
  font-weight: 400;
  letter-spacing: 0.05em;
  color: var(--demo-text-muted);
}

.dropzone__formats {
  max-width: 36ch;
  padding: 6px 12px;
  background: var(--demo-accent-subtle);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--accent);
  font-size: 9px;
  font-weight: 500;
  letter-spacing: 0.04em;
  line-height: 1.5;
}

@media (max-width: 600px) {
  .dropzone {
    min-height: 180px;
    padding: 2rem 1.5rem;
  }

  .dropzone__icon svg {
    width: 32px;
    height: 32px;
  }

  .dropzone__title {
    font-size: 12px;
  }

  .dropzone__subtitle {
    font-size: 10px;
  }

  .dropzone__formats {
    padding: 4px 10px;
  }
}
</style>
