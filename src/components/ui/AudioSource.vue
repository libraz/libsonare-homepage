<script setup lang="ts">
import { computed, ref } from 'vue';
import { CornerBrackets, ScanLine } from '@/components/ui';

const props = withDefaults(
  defineProps<{
    accept?: string;
    dropTitle?: string;
    dropHint?: string;
    formats?: string;
    showDemo?: boolean;
    demoLabel?: string;
    demoActive?: boolean;
    sourceName?: string;
    playable?: boolean;
    isPlaying?: boolean;
    progress?: number;
    currentTime?: number;
    duration?: number;
    busy?: boolean;
  }>(),
  {
    accept: 'audio/*',
    dropTitle: 'Drop audio file here',
    dropHint: 'or click to browse',
    formats: 'MP3 WAV FLAC OGG',
    showDemo: false,
    demoLabel: 'Demo audio',
    demoActive: false,
    sourceName: '',
    playable: false,
    isPlaying: false,
    progress: 0,
    currentTime: 0,
    duration: 0,
    busy: false,
  },
);

const emit = defineEmits<{
  (e: 'file', file: File): void;
  (e: 'demo'): void;
  (e: 'clear'): void;
  (e: 'playpause'): void;
  (e: 'seek', fraction: number): void;
}>();

const acceptedTypes = [
  'audio/mpeg',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/flac',
  'audio/ogg',
  'audio/mp3',
];

const fileInput = ref<HTMLInputElement | null>(null);
const isDragging = ref(false);
const isHovering = ref(false);

const fillPercent = computed(() => Math.max(0, Math.min(1, props.progress)) * 100);
const scrubberValue = computed(() => Math.round(Math.max(0, Math.min(1, props.progress)) * 1000));
const playLabel = computed(() => (props.isPlaying ? 'Pause' : 'Play'));

function isValidAudioFile(file: File): boolean {
  return (
    acceptedTypes.includes(file.type) ||
    file.name.endsWith('.mp3') ||
    file.name.endsWith('.wav') ||
    file.name.endsWith('.flac') ||
    file.name.endsWith('.ogg')
  );
}

function handleDragEnter(e: DragEvent) {
  if (props.busy) return;
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
  if (props.busy) return;
  const files = e.dataTransfer?.files;
  if (files && files.length > 0) {
    const file = files[0];
    if (isValidAudioFile(file)) emit('file', file);
  }
}

function handleClick() {
  if (props.busy) return;
  fileInput.value?.click();
}

function handleKeydown(e: KeyboardEvent) {
  if (props.busy) return;
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    fileInput.value?.click();
  }
}

function handleFileSelect(e: Event) {
  const input = e.target as HTMLInputElement;
  const files = input.files;
  if (files && files.length > 0) emit('file', files[0]);
  input.value = '';
}

function handleSeek(e: Event) {
  const value = Number((e.target as HTMLInputElement).value);
  emit('seek', value / 1000);
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
</script>

<template>
  <div class="audio-source" :class="{ 'audio-source--busy': busy }">
    <div
      class="audio-source__drop"
      :class="{
        'audio-source__drop--dragging': isDragging,
        'audio-source__drop--hover': isHovering,
      }"
      role="button"
      tabindex="0"
      :aria-label="dropTitle"
      :aria-disabled="busy"
      @click="handleClick"
      @keydown="handleKeydown"
      @dragenter="handleDragEnter"
      @dragleave="handleDragLeave"
      @dragover="handleDragOver"
      @drop="handleDrop"
      @mouseenter="isHovering = true"
      @mouseleave="isHovering = false"
    >
      <input
        ref="fileInput"
        type="file"
        :accept="accept"
        class="audio-source__input"
        @change="handleFileSelect"
      />

      <CornerBrackets :color="isDragging ? 'var(--demo-accent)' : undefined" />
      <div class="audio-source__grid" />

      <div class="audio-source__content">
        <div class="audio-source__icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
            <path d="M3 15v4c0 1.1.9 2 2 2h14a2 2 0 002-2v-4M17 8l-5-5-5 5M12 3v12" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>
        <div class="audio-source__text">
          <span class="audio-source__title">{{ dropTitle }}</span>
          <span class="audio-source__hint">{{ dropHint }}</span>
        </div>
        <div v-if="formats" class="audio-source__formats">
          <span class="audio-source__formats-label">SUPPORTED:</span>
          <span class="audio-source__formats-list">{{ formats }}</span>
        </div>
      </div>

      <ScanLine :active="(isHovering || isDragging) && !busy" :duration="3" />
    </div>

    <button
      v-if="showDemo"
      type="button"
      class="audio-source__demo"
      :class="{ 'audio-source__demo--active': demoActive }"
      :disabled="busy"
      :aria-pressed="demoActive"
      @click="emit('demo')"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
        <path d="M9 18V5l12-2v13" stroke-linecap="round" stroke-linejoin="round" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
      {{ demoLabel }}
    </button>

    <div v-if="sourceName" class="audio-source__chip">
      <svg class="audio-source__chip-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
        <path d="M9 18V5l12-2v13" stroke-linecap="round" stroke-linejoin="round" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
      <span class="audio-source__chip-name">{{ sourceName }}</span>
      <button
        type="button"
        class="audio-source__chip-clear"
        :disabled="busy"
        aria-label="Clear source"
        @click="emit('clear')"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" stroke-linecap="round" />
        </svg>
      </button>
    </div>

    <div v-if="playable" class="audio-source__transport">
      <button
        type="button"
        class="audio-source__play"
        :disabled="busy"
        :aria-label="playLabel"
        @click="emit('playpause')"
      >
        <svg v-if="isPlaying" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="6" y="5" width="4" height="14" rx="1" />
          <rect x="14" y="5" width="4" height="14" rx="1" />
        </svg>
        <svg v-else viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 5.5v13l11-6.5z" />
        </svg>
      </button>

      <span class="audio-source__time">{{ formatTime(currentTime) }}</span>

      <div class="audio-source__seek">
        <div class="audio-source__track">
          <div class="audio-source__fill" :style="{ width: `${fillPercent}%` }" />
          <div class="audio-source__knob" :style="{ left: `${fillPercent}%` }" />
        </div>
        <input
          class="audio-source__range"
          type="range"
          min="0"
          max="1000"
          step="1"
          :value="scrubberValue"
          :disabled="busy"
          aria-label="Seek"
          @input="handleSeek"
        />
      </div>

      <span class="audio-source__time audio-source__time--total">{{ formatTime(duration) }}</span>
    </div>
  </div>
</template>

<style scoped>
.audio-source {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  font-family: var(--font-mono);
}

.audio-source--busy {
  pointer-events: none;
  opacity: 0.7;
}

/* Drop area */
.audio-source__drop {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 130px;
  padding: 1.5rem 1.25rem;
  background: var(--demo-control-bg);
  border: 1px solid var(--demo-border);
  border-radius: 8px;
  cursor: pointer;
  overflow: hidden;
  transition: border-color var(--transition-fast), background-color var(--transition-fast),
    transform var(--transition-fast), box-shadow var(--transition-fast);
}

.audio-source__drop:hover,
.audio-source__drop:focus-visible {
  border-color: var(--demo-accent-dim);
  outline: none;
}

.audio-source__drop:focus-visible {
  box-shadow: 0 0 0 2px var(--demo-accent-border);
}

.audio-source__drop:hover .audio-source__icon {
  transform: translateY(-3px);
  color: var(--demo-accent);
}

.audio-source__drop--dragging {
  border-color: var(--demo-accent);
  background: var(--demo-accent-subtle);
  transform: scale(1.005);
  box-shadow: var(--demo-shadow-glow, 0 0 40px -12px var(--demo-accent-dim));
}

.audio-source__drop--dragging .audio-source__icon {
  transform: translateY(-5px) scale(1.08);
  color: var(--demo-accent);
}

.audio-source__input {
  display: none;
}

.audio-source__grid {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(var(--demo-grid-minor) 1px, transparent 1px),
    linear-gradient(90deg, var(--demo-grid-minor) 1px, transparent 1px);
  background-size: 20px 20px;
  opacity: 0.5;
  pointer-events: none;
}

.audio-source__content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  text-align: center;
}

.audio-source__icon {
  color: var(--demo-accent-light);
  transition: transform 0.3s ease, color 0.3s ease;
}

.audio-source__text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.audio-source__title {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.1em;
  color: var(--demo-text-strong);
  text-transform: uppercase;
}

.audio-source__hint {
  font-size: 11px;
  font-weight: 400;
  letter-spacing: 0.05em;
  color: var(--demo-text-muted);
}

.audio-source__formats {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 11px;
  background: var(--demo-accent-subtle);
  border: 1px solid var(--demo-border);
  border-radius: 4px;
}

.audio-source__formats-label {
  font-size: 8px;
  font-weight: 500;
  letter-spacing: 0.1em;
  color: var(--demo-text-faint);
}

.audio-source__formats-list {
  font-size: 9px;
  font-weight: 500;
  letter-spacing: 0.15em;
  color: var(--demo-accent);
}

/* Demo toggle button */
.audio-source__demo {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  gap: 8px;
  padding: 7px 14px;
  font-family: inherit;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--demo-text);
  background: var(--demo-accent-subtle);
  border: 1px solid var(--demo-accent-border);
  border-radius: 6px;
  cursor: pointer;
  transition: background-color var(--transition-fast), border-color var(--transition-fast),
    color var(--transition-fast);
}

.audio-source__demo:hover:not(:disabled) {
  border-color: var(--demo-accent);
  color: var(--demo-text-strong);
}

.audio-source__demo--active {
  color: var(--demo-text-strong);
  background: color-mix(in srgb, var(--demo-accent) 22%, transparent);
  border-color: var(--demo-accent);
}

.audio-source__demo:disabled {
  cursor: not-allowed;
}

.audio-source__demo svg {
  color: var(--demo-accent);
}

/* Loaded-source chip */
.audio-source__chip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px 6px 11px;
  background: var(--demo-control-bg-strong);
  border: 1px solid var(--demo-border);
  border-radius: 6px;
}

.audio-source__chip-icon {
  flex-shrink: 0;
  color: var(--demo-accent);
}

.audio-source__chip-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: 11px;
  color: var(--demo-text);
  letter-spacing: 0.02em;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.audio-source__chip-clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  padding: 0;
  color: var(--demo-text-muted);
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.16s ease, color 0.16s ease;
}

.audio-source__chip-clear:hover:not(:disabled) {
  color: var(--demo-text-strong);
  background: var(--demo-accent-subtle);
}

.audio-source__chip-clear:disabled {
  cursor: not-allowed;
}

/* Transport bar */
.audio-source__transport {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: var(--demo-control-bg);
  border: 1px solid var(--demo-border);
  border-radius: 8px;
}

.audio-source__play {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  padding: 0;
  color: var(--demo-text-strong);
  background: color-mix(in srgb, var(--demo-accent) 16%, transparent);
  border: 1px solid var(--demo-accent-border);
  border-radius: 50%;
  cursor: pointer;
  transition: background-color 0.16s ease, border-color 0.16s ease, transform 0.1s ease;
}

.audio-source__play:hover:not(:disabled) {
  background: color-mix(in srgb, var(--demo-accent) 28%, transparent);
  border-color: var(--demo-accent);
}

.audio-source__play:active:not(:disabled) {
  transform: scale(0.94);
}

.audio-source__play:disabled {
  cursor: not-allowed;
}

.audio-source__play svg {
  width: 18px;
  height: 18px;
  fill: currentColor;
}

.audio-source__time {
  flex-shrink: 0;
  min-width: 34px;
  color: var(--demo-text-muted);
  font-family: inherit;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.audio-source__time--total {
  text-align: right;
}

.audio-source__seek {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1;
  height: 18px;
}

.audio-source__track {
  position: relative;
  width: 100%;
  height: 4px;
  background: var(--demo-track-bg);
  border-radius: 999px;
  overflow: visible;
}

.audio-source__fill {
  position: absolute;
  inset: 0 auto 0 0;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--demo-cyan), var(--demo-accent));
}

.audio-source__knob {
  position: absolute;
  top: 50%;
  width: 11px;
  height: 11px;
  background: var(--demo-text-strong);
  border-radius: 50%;
  box-shadow: 0 0 8px color-mix(in srgb, var(--demo-accent) 60%, transparent);
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.audio-source__range {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  background: transparent;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
}

.audio-source__range:disabled {
  cursor: not-allowed;
}

.audio-source__range::-webkit-slider-thumb {
  width: 16px;
  height: 16px;
  background: transparent;
  border-radius: 50%;
  -webkit-appearance: none;
  appearance: none;
}

.audio-source__range::-moz-range-thumb {
  width: 16px;
  height: 16px;
  background: transparent;
  border: none;
  border-radius: 50%;
}

.audio-source__range:focus-visible {
  outline: none;
}

.audio-source__transport:focus-within .audio-source__knob {
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--demo-accent) 35%, transparent);
}

@media (prefers-reduced-motion: reduce) {
  .audio-source__drop,
  .audio-source__icon,
  .audio-source__play {
    transition: none;
  }

  .audio-source__drop--dragging {
    transform: none;
  }
}

@media (max-width: 600px) {
  .audio-source__drop {
    min-height: 110px;
    padding: 1.25rem 1rem;
  }

  .audio-source__title {
    font-size: 12px;
  }

  .audio-source__hint {
    font-size: 10px;
  }
}
</style>
