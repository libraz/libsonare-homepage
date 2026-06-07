<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useTheme } from '@/composables/useTheme';
import { useWaveform } from '@/composables/useWaveform';

const props = defineProps<{
  audioBuffer: AudioBuffer | null;
  beats?: Float32Array | number[];
  currentTime?: number;
  duration?: number;
}>();

const emit = defineEmits<(e: 'seek', time: number) => void>();

const { isDark } = useTheme();
const canvasRef = ref<HTMLCanvasElement | null>(null);

// Canvas colors track the global demo tokens so the waveform recolors with the
// theme; read them off the live element (tokens flip on html.dark) instead of
// hard-coding per-theme RGBA. The bg uses the screen surface; the bars/progress
// derive from the accent at fixed alphas.
const bgColor = ref('rgb(6, 8, 12)');
const barCol = ref('rgba(139, 92, 246, 0.25)');
const progCol = ref('rgba(139, 92, 246, 0.85)');

/**
 * Resolves a CSS color into "r, g, b" channels via a probe element so the
 * accent (any format) can be re-emitted at custom alphas.
 */
function rgbChannels(color: string): string {
  const probe = document.createElement('span');
  probe.style.color = color;
  probe.style.display = 'none';
  document.body.appendChild(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  const match = resolved.match(/rgba?\(([^)]+)\)/);
  if (!match) return '139, 92, 246';
  const [r, g, b] = match[1].split(',');
  return `${r.trim()}, ${g.trim()}, ${b.trim()}`;
}

function syncColors() {
  if (!canvasRef.value) return;
  const styles = getComputedStyle(canvasRef.value);
  const screen = styles.getPropertyValue('--demo-screen-bg').trim();
  const accent = styles.getPropertyValue('--demo-accent').trim();
  if (screen) bgColor.value = screen;
  if (accent) {
    const ch = rgbChannels(accent);
    barCol.value = `rgba(${ch}, 0.28)`;
    progCol.value = `rgba(${ch}, 0.85)`;
  }
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

watch([() => props.beats, () => props.duration], ([beats, duration]) => {
  if (beats && duration && duration > 0) {
    setBeats(beats, duration);
  }
});

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
  background: var(--demo-screen-bg, rgba(6, 8, 12, 1));
  border: 1px solid var(--demo-border-strong, rgba(139, 92, 246, 0.15));
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
  background: var(--demo-playhead);
  box-shadow:
    0 0 12px color-mix(in srgb, var(--demo-playhead) 80%, transparent),
    0 0 24px color-mix(in srgb, var(--demo-playhead) 40%, transparent);
  z-index: 3;
  pointer-events: none;
  transition: left 0.03s linear;
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
  border-color: var(--demo-accent-dim, rgba(139, 92, 246, 0.25));
}

.waveform:hover .waveform__playhead {
  box-shadow:
    0 0 16px var(--demo-playhead),
    0 0 32px color-mix(in srgb, var(--demo-playhead) 60%, transparent);
}
</style>
