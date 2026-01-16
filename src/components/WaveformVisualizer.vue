<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useWaveform } from '@/composables/useWaveform'

const props = defineProps<{
  audioBuffer: AudioBuffer | null
  beats?: Float32Array | number[]
  currentTime?: number
  duration?: number
}>()

const emit = defineEmits<{
  (e: 'seek', time: number): void
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)

const { setAudioBuffer, setBeats, setProgress } = useWaveform(canvasRef, {
  barWidth: 2,
  barGap: 1,
  barColor: 'rgba(139, 92, 246, 0.25)',
  progressColor: 'rgba(139, 92, 246, 0.85)',
  backgroundColor: 'rgba(6, 8, 12, 1)',
})

watch(() => props.audioBuffer, (buffer) => {
  if (buffer) {
    setAudioBuffer(buffer)
  }
})

watch([() => props.beats, () => props.duration], ([beats, duration]) => {
  if (beats && duration && duration > 0) {
    setBeats(beats, duration)
  }
})

watch([() => props.currentTime, () => props.duration], ([current, total]) => {
  if (typeof current === 'number' && typeof total === 'number' && total > 0) {
    setProgress(current / total)
  }
})

function handleClick(e: MouseEvent) {
  if (!canvasRef.value || !props.duration) return

  const rect = canvasRef.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const progress = x / rect.width
  const time = progress * props.duration

  emit('seek', time)
}

onMounted(() => {
  if (props.audioBuffer) {
    setAudioBuffer(props.audioBuffer)
  }
})
</script>

<template>
  <div class="waveform" @click="handleClick">
    <canvas ref="canvasRef" class="waveform__canvas"></canvas>
    <!-- Playhead indicator -->
    <div class="waveform__playhead" :style="{ left: `${((currentTime || 0) / (duration || 1)) * 100}%` }"></div>
    <!-- Grid overlay -->
    <div class="waveform__grid"></div>
  </div>
</template>

<style scoped>
.waveform {
  position: relative;
  width: 100%;
  height: 100px;
  background: rgba(6, 8, 12, 1);
  border: 1px solid rgba(139, 92, 246, 0.15);
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
}

.waveform::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    rgba(139, 92, 246, 0.02) 0%,
    transparent 30%,
    transparent 70%,
    rgba(139, 92, 246, 0.02) 100%
  );
  pointer-events: none;
  z-index: 1;
}

.waveform__canvas {
  width: 100%;
  height: 100%;
  display: block;
}

.waveform__playhead {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #ef4444;
  box-shadow: 0 0 12px rgba(239, 68, 68, 0.8), 0 0 24px rgba(239, 68, 68, 0.4);
  z-index: 3;
  pointer-events: none;
  transition: left 0.05s linear;
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
  border-top: 7px solid #ef4444;
  filter: drop-shadow(0 0 4px rgba(239, 68, 68, 0.8));
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
  border-bottom: 7px solid #ef4444;
  filter: drop-shadow(0 0 4px rgba(239, 68, 68, 0.8));
}

.waveform__grid {
  position: absolute;
  inset: 0;
  background-image:
    repeating-linear-gradient(
      90deg,
      rgba(139, 92, 246, 0.03) 0px,
      rgba(139, 92, 246, 0.03) 1px,
      transparent 1px,
      transparent 10%
    ),
    repeating-linear-gradient(
      0deg,
      rgba(139, 92, 246, 0.03) 0px,
      rgba(139, 92, 246, 0.03) 1px,
      transparent 1px,
      transparent 50%
    );
  pointer-events: none;
  z-index: 2;
}

.waveform:hover {
  border-color: rgba(139, 92, 246, 0.25);
}

.waveform:hover .waveform__playhead {
  box-shadow: 0 0 16px rgba(239, 68, 68, 1), 0 0 32px rgba(239, 68, 68, 0.6);
}
</style>
