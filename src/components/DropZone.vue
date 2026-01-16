<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from '@/composables/useI18n'
import { CornerBrackets, ScanLine } from '@/components/ui'

const emit = defineEmits<{
  (e: 'file', file: File): void
}>()

const { t } = useI18n()
const isDragging = ref(false)
const isHovering = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

const acceptedTypes = [
  'audio/mpeg',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/flac',
  'audio/ogg',
  'audio/mp3',
]

function handleDragEnter(e: DragEvent) {
  e.preventDefault()
  isDragging.value = true
}

function handleDragLeave(e: DragEvent) {
  e.preventDefault()
  isDragging.value = false
}

function handleDragOver(e: DragEvent) {
  e.preventDefault()
}

function handleDrop(e: DragEvent) {
  e.preventDefault()
  isDragging.value = false

  const files = e.dataTransfer?.files
  if (files && files.length > 0) {
    const file = files[0]
    if (isValidAudioFile(file)) {
      emit('file', file)
    }
  }
}

function handleClick() {
  fileInput.value?.click()
}

function handleFileSelect(e: Event) {
  const input = e.target as HTMLInputElement
  const files = input.files
  if (files && files.length > 0) {
    emit('file', files[0])
  }
}

function isValidAudioFile(file: File): boolean {
  return acceptedTypes.includes(file.type) ||
    file.name.endsWith('.mp3') ||
    file.name.endsWith('.wav') ||
    file.name.endsWith('.flac') ||
    file.name.endsWith('.ogg')
}
</script>

<template>
  <div
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
    <input
      ref="fileInput"
      type="file"
      accept="audio/*"
      class="dropzone__input"
      @change="handleFileSelect"
    />

    <!-- Corner brackets using shared component -->
    <CornerBrackets :color="isDragging ? '#8B5CF6' : undefined" />

    <!-- Grid background -->
    <div class="dropzone__grid"></div>

    <!-- Content -->
    <div class="dropzone__content">
      <div class="dropzone__icon">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M3 15v4c0 1.1.9 2 2 2h14a2 2 0 002-2v-4M17 8l-5-5-5 5M12 3v12" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <div class="dropzone__text">
        <span class="dropzone__title">{{ t('demo.dropzone.title') }}</span>
        <span class="dropzone__subtitle">{{ t('demo.dropzone.subtitle') }}</span>
      </div>
      <div class="dropzone__formats">
        <span class="dropzone__format-label">SUPPORTED:</span>
        <span class="dropzone__format-list">MP3 WAV FLAC OGG</span>
      </div>
    </div>

    <!-- Scan line effect using shared component -->
    <ScanLine :active="isHovering || isDragging" :duration="3" />
  </div>
</template>

<style scoped>
.dropzone {
  --accent: #8B5CF6;
  --accent-dim: rgba(139, 92, 246, 0.3);
  --bg: rgba(8, 10, 14, 0.9);
  --border: rgba(139, 92, 246, 0.2);

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
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.25s ease;
  font-family: 'JetBrains Mono', monospace;
  overflow: hidden;
}

.dropzone__grid {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(rgba(139, 92, 246, 0.02) 1px, transparent 1px),
    linear-gradient(90deg, rgba(139, 92, 246, 0.02) 1px, transparent 1px);
  background-size: 20px 20px;
  opacity: 0.5;
  pointer-events: none;
}

.dropzone:hover {
  border-color: var(--accent-dim);
  box-shadow: 0 0 40px -10px rgba(139, 92, 246, 0.2);
}

.dropzone:hover .dropzone__icon {
  transform: translateY(-4px);
}

.dropzone--dragging {
  border-color: var(--accent);
  background: rgba(139, 92, 246, 0.08);
  transform: scale(1.01);
  box-shadow: 0 0 60px -10px rgba(139, 92, 246, 0.3);
}

.dropzone--dragging .dropzone__icon {
  transform: translateY(-8px) scale(1.1);
  color: var(--accent);
}

.dropzone__input {
  display: none;
}

/* Content */
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
  color: rgba(139, 92, 246, 0.7);
  transition: all 0.3s ease;
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
  color: rgba(255, 255, 255, 0.85);
  text-transform: uppercase;
}

.dropzone__subtitle {
  font-size: 11px;
  font-weight: 400;
  letter-spacing: 0.05em;
  color: rgba(255, 255, 255, 0.4);
}

.dropzone__formats {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: rgba(139, 92, 246, 0.1);
  border: 1px solid var(--border);
  border-radius: 4px;
}

.dropzone__format-label {
  font-size: 8px;
  font-weight: 500;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.35);
}

.dropzone__format-list {
  font-size: 9px;
  font-weight: 500;
  letter-spacing: 0.15em;
  color: var(--accent);
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
