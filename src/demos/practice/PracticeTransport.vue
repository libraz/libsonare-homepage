<script setup lang="ts">
import { computed } from 'vue';
import { SegmentedControl, TermLabel } from '@/components/ui';
import { type PracticeCopy, type SoundSource, SPEED_OPTIONS } from '@/demos/practice/practiceCopy';

const props = defineProps<{
  copy: PracticeCopy;
  isBusy: boolean;
  hasMidi: boolean;
  isPlaying: boolean;
  speed: number;
  source: SoundSource;
  muted: boolean;
  volume: number;
}>();

defineEmits<{
  prefetch: [];
  play: [];
  restart: [];
  speed: [speed: number];
  source: [source: SoundSource];
  mute: [];
  volume: [event: Event];
}>();

const speedOptions = computed(() =>
  SPEED_OPTIONS.map((option) => ({
    id: String(option),
    label: `${option}×`,
    disabled: props.isBusy,
  })),
);
const sourceOptions = computed(() => [
  { id: 'sf2', label: props.copy.controls.sourceSampled, disabled: props.isBusy },
  { id: 'synth', label: props.copy.controls.sourceSynth, disabled: props.isBusy },
]);
</script>

<template>
  <div class="practice__controls">
    <div class="practice__transport">
      <button
        type="button"
        class="demo-btn demo-btn--primary practice__play"
        :class="{ 'is-busy': isBusy }"
        :disabled="isBusy || !hasMidi"
        :aria-label="isBusy ? copy.controls.preparing : isPlaying ? copy.controls.pause : copy.controls.play"
        :aria-busy="isBusy"
        @pointerenter="$emit('prefetch')"
        @focus="$emit('prefetch')"
        @click="$emit('play')"
      >
        <span v-if="isBusy" class="practice__play-spinner" aria-hidden="true"></span>
        <svg
          v-else-if="!isPlaying"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M8 5v14l11-7z" />
        </svg>
        <svg
          v-else
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
        </svg>
        <span>{{ isBusy ? copy.controls.preparing : isPlaying ? copy.controls.pause : copy.controls.play }}</span>
      </button>
      <button
        type="button"
        class="demo-btn demo-btn--icon practice__icon-btn"
        :aria-label="copy.controls.restart"
        :title="copy.controls.restart"
        :disabled="!hasMidi || isBusy"
        @click="$emit('restart')"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M3 2v6h6" />
          <path d="M3 13a9 9 0 1 0 3-7.7L3 8" />
        </svg>
      </button>
    </div>

    <div class="practice__group">
      <TermLabel :label="copy.controls.speed" :title="copy.help.speed.title" :body="copy.help.speed.body" />
      <SegmentedControl
        :model-value="String(speed)"
        :options="speedOptions"
        :ariaLabel="copy.controls.speed"
        :fill="false"
        @update:model-value="$emit('speed', Number($event))"
      />
    </div>

    <div class="practice__group">
      <TermLabel :label="copy.controls.sound" :title="copy.help.sound.title" :body="copy.help.sound.body" />
      <SegmentedControl
        :model-value="source"
        :options="sourceOptions"
        :ariaLabel="copy.controls.sourceAria"
        :fill="false"
        @pointerenter="$emit('prefetch')"
        @update:model-value="$emit('source', $event as SoundSource)"
      />
    </div>

    <div class="practice__group practice__group--volume">
      <button
        type="button"
        class="demo-btn demo-btn--icon practice__icon-btn"
        :aria-label="muted ? copy.controls.unmute : copy.controls.mute"
        :title="muted ? copy.controls.unmute : copy.controls.mute"
        @click="$emit('mute')"
      >
        <svg
          v-if="!muted && volume > 0"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M11 5 6 9H2v6h4l5 4z" />
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          <path d="M19 5a9 9 0 0 1 0 14" />
        </svg>
        <svg
          v-else
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M11 5 6 9H2v6h4l5 4z" />
          <line x1="22" y1="9" x2="16" y2="15" />
          <line x1="16" y1="9" x2="22" y2="15" />
        </svg>
      </button>
      <input
        class="demo-range practice__volume"
        type="range"
        min="0"
        max="1"
        step="0.01"
        :value="muted ? 0 : volume"
        :aria-label="copy.controls.volume"
        @input="$emit('volume', $event)"
      />
    </div>
  </div>
</template>
