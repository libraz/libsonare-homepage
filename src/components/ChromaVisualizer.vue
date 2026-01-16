<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  chromaData: {
    features: Float32Array
    nFrames: number
    nChroma: number
  } | null
  currentTime: number
  duration: number
}>()

const canvas = ref<HTMLCanvasElement | null>(null)
const ctx = ref<CanvasRenderingContext2D | null>(null)

// Note names for 12 pitch classes
const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

// Colors for each pitch class (rainbow-ish)
const noteColors = [
  '#ff6b6b', // C - red
  '#ff8e72', // C#
  '#ffa94d', // D - orange
  '#ffd43b', // D#
  '#a9e34b', // E - yellow-green
  '#69db7c', // F - green
  '#38d9a9', // F#
  '#3bc9db', // G - cyan
  '#4dabf7', // G#
  '#748ffc', // A - blue
  '#9775fa', // A#
  '#da77f2', // B - purple
]

function drawChroma() {
  if (!canvas.value || !ctx.value || !props.chromaData) return

  const { features, nFrames, nChroma } = props.chromaData
  const width = canvas.value.width
  const height = canvas.value.height

  // Clear
  ctx.value.fillStyle = 'rgba(10, 10, 15, 0.95)'
  ctx.value.fillRect(0, 0, width, height)

  const barWidth = width / nFrames
  const barHeight = height / nChroma

  // Draw chroma grid
  for (let frame = 0; frame < nFrames; frame++) {
    for (let pitch = 0; pitch < nChroma; pitch++) {
      const value = features[frame * nChroma + pitch]
      const alpha = Math.min(1, value * 2) // Boost visibility

      ctx.value.fillStyle = noteColors[pitch]
      ctx.value.globalAlpha = alpha * 0.8 + 0.1

      // Draw from bottom (C at bottom, B at top)
      const y = height - (pitch + 1) * barHeight
      ctx.value.fillRect(frame * barWidth, y, barWidth + 1, barHeight)
    }
  }

  // Reset alpha
  ctx.value.globalAlpha = 1

  // Draw playhead
  if (props.duration > 0) {
    const progress = props.currentTime / props.duration
    const x = progress * width

    ctx.value.strokeStyle = '#fff'
    ctx.value.lineWidth = 2
    ctx.value.beginPath()
    ctx.value.moveTo(x, 0)
    ctx.value.lineTo(x, height)
    ctx.value.stroke()
  }

  // Draw note labels on left
  ctx.value.fillStyle = 'rgba(255, 255, 255, 0.7)'
  ctx.value.font = '10px monospace'
  ctx.value.textAlign = 'left'
  ctx.value.textBaseline = 'middle'
  for (let pitch = 0; pitch < nChroma; pitch++) {
    const y = height - (pitch + 0.5) * barHeight
    ctx.value.fillText(noteNames[pitch], 4, y)
  }
}

function setupCanvas() {
  if (!canvas.value) return
  ctx.value = canvas.value.getContext('2d')

  // Set canvas size
  const rect = canvas.value.getBoundingClientRect()
  canvas.value.width = rect.width * window.devicePixelRatio
  canvas.value.height = rect.height * window.devicePixelRatio
  ctx.value?.scale(window.devicePixelRatio, window.devicePixelRatio)

  drawChroma()
}

let animationFrame: number | null = null

function animate() {
  drawChroma()
  animationFrame = requestAnimationFrame(animate)
}

watch(() => props.chromaData, () => {
  if (props.chromaData) {
    drawChroma()
  }
})

onMounted(() => {
  setupCanvas()
  animate()
  window.addEventListener('resize', setupCanvas)
})

onUnmounted(() => {
  if (animationFrame) {
    cancelAnimationFrame(animationFrame)
  }
  window.removeEventListener('resize', setupCanvas)
})
</script>

<template>
  <div class="chroma-visualizer">
    <canvas ref="canvas" class="chroma-canvas"></canvas>
  </div>
</template>

<style scoped>
.chroma-visualizer {
  width: 100%;
  height: 120px;
  border-radius: 8px;
  overflow: hidden;
  background: rgba(10, 10, 15, 0.6);
}

.chroma-canvas {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
