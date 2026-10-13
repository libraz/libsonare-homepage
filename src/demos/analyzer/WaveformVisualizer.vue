<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useTheme } from '@/composables/useTheme';
import { useWaveform } from '@/demos/analyzer/useWaveform';

const props = defineProps<{
  audioBuffer: AudioBuffer | null;
  beats?: Float32Array | number[];
  currentTime?: number;
  duration?: number;
}>();

const emit = defineEmits<(e: 'seek', time: number) => void>();

const { isDark } = useTheme();
const canvasRef = ref<HTMLCanvasElement | null>(null);

// Canvas colors are the demo tokens, read off the live element when it mounts
// and whenever the theme flips: the screen surface behind, the accent at two
// strengths for the bars before and after the playhead.
const bgColor = ref('');
const barCol = ref('');
const progCol = ref('');

function syncColors() {
  if (!canvasRef.value) return;
  const styles = getComputedStyle(canvasRef.value);
  const accent = styles.getPropertyValue('--demo-accent').trim();
  bgColor.value = styles.getPropertyValue('--demo-screen-bg').trim();
  barCol.value = `color-mix(in srgb, ${accent} 28%, transparent)`;
  progCol.value = `color-mix(in srgb, ${accent} 85%, transparent)`;
}

const { setAudioBuffer, setBeats, setProgress, draw } = useWaveform(canvasRef, {
  barWidth: 2,
  barGap: 1,
  barColor: barCol,
  progressColor: progCol,
  backgroundColor: bgColor,
});

// Re-read tokens and redraw when theme changes
watch(isDark, () => {
  syncColors();
  draw();
});

watch(
  () => props.audioBuffer,
  (buffer) => {
    if (buffer) {
      setAudioBuffer(buffer);
    }
  },
);

watch(
  [() => props.beats, () => props.duration],
  ([beats, duration]) => setBeats(beats ?? [], duration ?? 0),
  { immediate: true },
);

watch([() => props.currentTime, () => props.duration], ([current, total]) => {
  if (typeof current === 'number' && typeof total === 'number' && total > 0) {
    setProgress(current / total);
  }
});

function handleClick(e: MouseEvent) {
  if (!canvasRef.value || !props.duration) return;

  const rect = canvasRef.value.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const progress = x / rect.width;
  const time = progress * props.duration;

  emit('seek', time);
}

onMounted(() => {
  syncColors();
  if (props.audioBuffer) {
    setAudioBuffer(props.audioBuffer);
  }
});
</script>

<template>
  <div class="waveform" @click="handleClick">
    <canvas ref="canvasRef" class="waveform__canvas"></canvas>
    <!-- Playhead: a full-width layer slid by transform, cursor at its left edge -->
    <div class="waveform__playhead-track" :style="{ transform: `translateX(${((currentTime || 0) / (duration || 1)) * 100}%)` }">
      <div class="waveform__playhead"></div>
    </div>
    <!-- Grid overlay -->
    <div class="waveform__grid"></div>
  </div>
</template>

<style scoped>
.waveform {
  position: relative;
  width: 100%;
  height: 100px;
  background: var(--demo-screen-bg);
  border: 1px solid var(--demo-border-strong);
  overflow: hidden;
  cursor: pointer;
  transition: border-color var(--demo-dur-fast) var(--demo-ease-standard);
}

.waveform::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--demo-accent) 2%, transparent) 0%,
    transparent 30%,
    transparent 70%,
    color-mix(in srgb, var(--demo-accent) 2%, transparent) 100%
  );
  pointer-events: none;
  z-index: 1;
}

.waveform__canvas {
  width: 100%;
  height: 100%;
  display: block;
}

.waveform__playhead-track {
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
}

.waveform__playhead {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 2px;
  margin-left: -1px;
  background: var(--demo-playhead);
  box-shadow:
    0 0 12px color-mix(in srgb, var(--demo-playhead) 80%, transparent),
    0 0 24px color-mix(in srgb, var(--demo-playhead) 40%, transparent);
}

.waveform__playhead::before {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 7px solid var(--demo-playhead);
  filter: drop-shadow(0 0 4px color-mix(in srgb, var(--demo-playhead) 80%, transparent));
}

.waveform__playhead::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-bottom: 7px solid var(--demo-playhead);
  filter: drop-shadow(0 0 4px color-mix(in srgb, var(--demo-playhead) 80%, transparent));
}

.waveform__grid {
  position: absolute;
  inset: 0;
  background-image:
    repeating-linear-gradient(
      90deg,
      color-mix(in srgb, var(--demo-accent) 3%, transparent) 0px,
      color-mix(in srgb, var(--demo-accent) 3%, transparent) 1px,
      transparent 1px,
      transparent 10%
    ),
    repeating-linear-gradient(
      0deg,
      color-mix(in srgb, var(--demo-accent) 3%, transparent) 0px,
      color-mix(in srgb, var(--demo-accent) 3%, transparent) 1px,
      transparent 1px,
      transparent 50%
    );
  pointer-events: none;
  z-index: 2;
}

.waveform:hover {
  border-color: var(--demo-accent-dim);
}

.waveform:hover .waveform__playhead {
  box-shadow:
    0 0 16px var(--demo-playhead),
    0 0 32px color-mix(in srgb, var(--demo-playhead) 60%, transparent);
}
</style>
