<script setup lang="ts">
import { computed, ref, watch } from 'vue';

const props = defineProps<{
  src: string | null;
}>();

const emit = defineEmits<{
  progress: [fraction: number];
}>();

const audioElement = ref<HTMLAudioElement | null>(null);
const isPlaying = ref(false);
const currentTime = ref(0);
const duration = ref(0);

// When src swaps (e.g. A/B before/after) keep the playhead and play state so the
// comparison stays in sync instead of restarting from 0.
let resumeAt: number | null = null;
let resumePlaying = false;

watch(
  () => props.src,
  () => {
    if (currentTime.value > 0) {
      resumeAt = currentTime.value;
      resumePlaying = isPlaying.value;
    } else {
      resumeAt = null;
      resumePlaying = false;
    }
  },
);

const progress = computed(() => {
  if (!duration.value) return 0;
  return Math.min(100, (currentTime.value / duration.value) * 100);
});

watch([currentTime, duration], () => {
  emit('progress', duration.value ? Math.min(1, currentTime.value / duration.value) : 0);
});

function seekFraction(fraction: number) {
  const audio = audioElement.value;
  if (!audio || !duration.value) return;
  const target = Math.max(0, Math.min(1, fraction)) * duration.value;
  audio.currentTime = target;
  currentTime.value = target;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return '0:00';
  const total = Math.floor(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function togglePlayback() {
  const audio = audioElement.value;
  if (!audio || !props.src) return;
  if (audio.paused) void audio.play();
  else audio.pause();
}

function setVolume(volume: number) {
  if (audioElement.value) audioElement.value.volume = volume;
}

function onSeek(event: Event) {
  const audio = audioElement.value;
  if (!audio) return;
  const value = Number((event.target as HTMLInputElement).value);
  audio.currentTime = value;
  currentTime.value = value;
}

function onLoadedMetadata() {
  const audio = audioElement.value;
  if (!audio) return;
  duration.value = audio.duration;
  if (resumeAt !== null) {
    const target = Math.min(resumeAt, audio.duration);
    audio.currentTime = target;
    currentTime.value = target;
    if (resumePlaying) void audio.play();
    resumeAt = null;
    resumePlaying = false;
  }
}

function onTimeUpdate() {
  currentTime.value = audioElement.value?.currentTime ?? 0;
}

function onEnded() {
  isPlaying.value = false;
  currentTime.value = 0;
}

defineExpose({ setVolume, togglePlayback, seekFraction });
</script>

<template>
  <div class="transport" :class="{ 'transport--disabled': !src }">
    <audio
      ref="audioElement"
      :src="src || undefined"
      @loadedmetadata="onLoadedMetadata"
      @timeupdate="onTimeUpdate"
      @play="isPlaying = true"
      @pause="isPlaying = false"
      @ended="onEnded"
    ></audio>

    <button
      type="button"
      class="transport__play"
      :disabled="!src"
      :aria-label="isPlaying ? 'Pause' : 'Play'"
      @click="togglePlayback"
    >
      <svg v-if="isPlaying" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="6" y="5" width="4" height="14" rx="1" />
        <rect x="14" y="5" width="4" height="14" rx="1" />
      </svg>
      <svg v-else viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 5.5v13l11-6.5z" />
      </svg>
    </button>

    <span class="transport__time">{{ formatTime(currentTime) }}</span>

    <div class="transport__seek">
      <div class="transport__track">
        <div class="transport__fill" :style="{ width: `${progress}%` }"></div>
        <div class="transport__knob" :style="{ left: `${progress}%` }"></div>
      </div>
      <input
        class="transport__range"
        type="range"
        min="0"
        :max="duration || 0"
        step="0.01"
        :value="currentTime"
        :disabled="!src"
        aria-label="Seek"
        @input="onSeek"
      >
    </div>

    <span class="transport__time transport__time--total">{{ formatTime(duration) }}</span>
  </div>
</template>

<style scoped>
.transport {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border: 1px solid var(--demo-border);
  border-radius: 8px;
  background: var(--master-surface, var(--demo-bg-elevated));
}

.transport--disabled {
  opacity: 0.5;
}

.transport audio {
  display: none;
}

.transport__play {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid var(--demo-accent-border, var(--demo-border));
  border-radius: 50%;
  background: color-mix(in srgb, var(--demo-accent) 16%, transparent);
  color: var(--demo-text-strong);
  cursor: pointer;
  transition: background-color 0.16s ease, border-color 0.16s ease, transform 0.1s ease;
}

.transport__play:not(:disabled):hover {
  background: color-mix(in srgb, var(--demo-accent) 28%, transparent);
  border-color: var(--demo-accent);
}

.transport__play:not(:disabled):active {
  transform: scale(0.94);
}

.transport__play:disabled {
  cursor: not-allowed;
}

.transport__play svg {
  width: 18px;
  height: 18px;
  fill: currentColor;
}

.transport__time {
  flex-shrink: 0;
  min-width: 34px;
  color: var(--demo-text-muted);
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.transport__time--total {
  text-align: right;
}

.transport__seek {
  position: relative;
  flex: 1;
  height: 18px;
  display: flex;
  align-items: center;
}

.transport__track {
  position: relative;
  width: 100%;
  height: 4px;
  border-radius: 999px;
  background: var(--master-surface-strong, var(--demo-track-bg));
  overflow: visible;
}

.transport__fill {
  position: absolute;
  inset: 0 auto 0 0;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--demo-cyan), var(--demo-accent));
}

.transport__knob {
  position: absolute;
  top: 50%;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: var(--demo-text-strong);
  box-shadow: 0 0 8px color-mix(in srgb, var(--demo-accent) 60%, transparent);
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.transport__range {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
  background: transparent;
}

.transport__range:disabled {
  cursor: not-allowed;
}

.transport__range::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: transparent;
}

.transport__range::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border: none;
  border-radius: 50%;
  background: transparent;
}

.transport__range:focus-visible {
  outline: none;
}

.transport:focus-within .transport__knob {
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--demo-accent) 35%, transparent);
}
</style>
