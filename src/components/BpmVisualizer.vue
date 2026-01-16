<script setup lang="ts">
import { ref, watch, computed, onUnmounted } from 'vue'

const props = defineProps<{
  bpm: number
  isPlaying: boolean
  currentTime: number
  beats?: Float32Array | number[]
}>()

const pulseScale = ref(1)
const isBeating = ref(false)

let animationFrame: number | null = null
let lastBeatIndex = -1

const beatInterval = computed(() => {
  if (props.bpm <= 0) return 0
  return 60 / props.bpm
})

// Beat-synced animation
watch([() => props.isPlaying, () => props.currentTime, () => props.beats], ([playing, time, beats]) => {
  if (!playing || !beats || beats.length === 0) {
    isBeating.value = false
    return
  }

  // Find the closest beat
  const beatsArray = Array.from(beats)
  let closestIndex = -1
  let minDiff = Infinity

  for (let i = 0; i < beatsArray.length; i++) {
    const diff = Math.abs(beatsArray[i] - time)
    if (diff < minDiff) {
      minDiff = diff
      closestIndex = i
    }
  }

  // Trigger pulse on beat
  if (closestIndex !== lastBeatIndex && minDiff < 0.05) {
    lastBeatIndex = closestIndex
    triggerPulse()
  }
})

function triggerPulse() {
  isBeating.value = true
  pulseScale.value = 1.15

  setTimeout(() => {
    pulseScale.value = 1
  }, 100)

  setTimeout(() => {
    isBeating.value = false
  }, 200)
}

// Fallback: BPM-based pulse when no beats detected
watch(() => props.isPlaying, (playing) => {
  if (playing && (!props.beats || props.beats.length === 0)) {
    startBpmPulse()
  } else if (!playing) {
    stopBpmPulse()
  }
})

let bpmInterval: number | null = null

function startBpmPulse() {
  if (bpmInterval) return
  if (beatInterval.value <= 0) return

  bpmInterval = window.setInterval(() => {
    if (props.isPlaying) {
      triggerPulse()
    }
  }, beatInterval.value * 1000)
}

function stopBpmPulse() {
  if (bpmInterval) {
    clearInterval(bpmInterval)
    bpmInterval = null
  }
}

onUnmounted(() => {
  stopBpmPulse()
  if (animationFrame) {
    cancelAnimationFrame(animationFrame)
  }
})
</script>

<template>
  <div class="bpm-visualizer">
    <div
      class="bpm-circle"
      :class="{ 'bpm-circle--beating': isBeating }"
      :style="{ transform: `scale(${pulseScale})` }"
    >
      <span class="bpm-value">{{ Math.round(bpm) }}</span>
      <span class="bpm-label">BPM</span>
    </div>

    <div class="bpm-bars">
      <div
        v-for="i in 4"
        :key="i"
        class="bpm-bar"
        :class="{ 'bpm-bar--active': isBeating && (i - 1) % 2 === 0 }"
        :style="{ animationDelay: `${(i - 1) * 0.1}s` }"
      />
    </div>
  </div>
</template>

<style scoped>
.bpm-visualizer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  padding: 2rem;
}

.bpm-circle {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 140px;
  height: 140px;
  background: radial-gradient(circle, rgba(139, 92, 246, 0.2) 0%, rgba(139, 92, 246, 0.05) 70%);
  border: 2px solid rgba(139, 92, 246, 0.4);
  border-radius: 50%;
  transition: transform 0.1s ease-out, box-shadow 0.1s ease-out;
}

.bpm-circle--beating {
  box-shadow: 0 0 40px rgba(139, 92, 246, 0.5);
  border-color: #8B5CF6;
}

.bpm-value {
  font-family: 'JetBrains Mono', monospace;
  font-size: 2.5rem;
  font-weight: 700;
  color: #fff;
  line-height: 1;
}

.bpm-label {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 0.85rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-top: 0.25rem;
}

.bpm-bars {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  height: 40px;
}

.bpm-bar {
  width: 8px;
  height: 20px;
  background: rgba(139, 92, 246, 0.3);
  border-radius: 4px;
  transition: all 0.15s ease;
}

.bpm-bar--active {
  height: 40px;
  background: #8B5CF6;
  box-shadow: 0 0 12px rgba(139, 92, 246, 0.6);
}

.bpm-bar:nth-child(1) { height: 15px; }
.bpm-bar:nth-child(2) { height: 25px; }
.bpm-bar:nth-child(3) { height: 20px; }
.bpm-bar:nth-child(4) { height: 30px; }

.bpm-bar--active:nth-child(1) { height: 30px; }
.bpm-bar--active:nth-child(2) { height: 40px; }
.bpm-bar--active:nth-child(3) { height: 35px; }
.bpm-bar--active:nth-child(4) { height: 45px; }
</style>
