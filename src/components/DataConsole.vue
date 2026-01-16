<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { TechPanel, StatusIndicator } from '@/components/ui'

const props = defineProps<{
  chromaData: {
    features: Float32Array
    nFrames: number
    nChroma: number
  } | null
  rmsData: Float32Array | null
  bandData: {
    low: Float32Array
    high: Float32Array
  } | null
  currentTime: number
  duration: number
  isPlaying: boolean
  sampleRate?: number
}>()

const consoleRef = ref<HTMLDivElement | null>(null)
const logs = ref<{ text: string; type: 'data' | 'info' | 'metric' | 'note' }[]>([])
const maxLogs = 50

const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

let lastLogTime = 0
let frameCount = 0
let intervalId: ReturnType<typeof setInterval> | null = null

const currentFrame = computed(() => {
  if (!props.chromaData || props.duration === 0) return 0
  const progress = props.currentTime / props.duration
  return Math.floor(progress * props.chromaData.nFrames)
})

function formatValue(val: number, decimals = 3): string {
  return val.toFixed(decimals).padStart(7, ' ')
}

function formatHex(val: number): string {
  const hex = Math.floor(val * 255).toString(16).toUpperCase().padStart(2, '0')
  return `0x${hex}`
}

function getDominantNote(): { name: string; value: number } | null {
  if (!props.chromaData) return null
  const frame = currentFrame.value
  const { features, nChroma } = props.chromaData

  let maxIdx = 0
  let maxVal = 0
  for (let i = 0; i < nChroma; i++) {
    const v = features[frame * nChroma + i] || 0
    if (v > maxVal) {
      maxVal = v
      maxIdx = i
    }
  }

  return maxVal > 0.1 ? { name: noteNames[maxIdx], value: maxVal } : null
}

function addLog(text: string, type: 'data' | 'info' | 'metric' | 'note' = 'data') {
  logs.value.push({ text, type })
  if (logs.value.length > maxLogs) {
    logs.value.shift()
  }
}

function generateLog() {
  if (!props.isPlaying) return

  const now = Date.now()
  if (now - lastLogTime < 80) return // throttle
  lastLogTime = now
  frameCount++

  const frame = currentFrame.value
  const timestamp = props.currentTime.toFixed(3).padStart(8, '0')

  // Cycle through different log types
  const logType = frameCount % 6

  if (props.rmsData && logType === 0) {
    const rmsFrame = Math.floor((frame / (props.chromaData?.nFrames || 1)) * props.rmsData.length)
    const rms = props.rmsData[rmsFrame] || 0
    addLog(`[${timestamp}] RMS_PWR: ${formatValue(rms)} ${formatHex(rms)} ▐${'█'.repeat(Math.floor(rms * 20))}${'░'.repeat(20 - Math.floor(rms * 20))}▌`, 'metric')
  }

  if (props.bandData && logType === 1) {
    const bandFrame = Math.floor((frame / (props.chromaData?.nFrames || 1)) * props.bandData.low.length)
    const low = props.bandData.low[bandFrame] || 0
    addLog(`[${timestamp}] LO_BAND: ${formatValue(low)} ◄ ${formatHex(low)}`, 'data')
  }

  if (props.bandData && logType === 2) {
    const bandFrame = Math.floor((frame / (props.chromaData?.nFrames || 1)) * props.bandData.high.length)
    const high = props.bandData.high[bandFrame] || 0
    addLog(`[${timestamp}] HI_BAND: ${formatValue(high)} ◄ ${formatHex(high)}`, 'data')
  }

  if (props.chromaData && logType === 3) {
    const { features, nChroma } = props.chromaData
    const chromaStr = Array.from({ length: nChroma }, (_, i) => {
      const v = features[frame * nChroma + i] || 0
      return v > 0.3 ? '█' : v > 0.1 ? '▓' : v > 0.05 ? '░' : '·'
    }).join('')
    addLog(`[${timestamp}] CHROMA:  ${chromaStr}`, 'data')
  }

  if (logType === 4) {
    const dominant = getDominantNote()
    if (dominant) {
      addLog(`[${timestamp}] NOTE_DT: ${dominant.name.padEnd(3, ' ')} [${formatValue(dominant.value)}]`, 'note')
    }
  }

  if (logType === 5) {
    addLog(`[${timestamp}] FRM_IDX: ${frame.toString().padStart(6, '0')} / ${(props.chromaData?.nFrames || 0).toString().padStart(6, '0')}`, 'info')
  }
}

// Initial boot sequence
function bootSequence() {
  const bootLogs = [
    { text: '══════════════════════════════════════════════', type: 'info' as const },
    { text: '  LIBSONARE AUDIO ANALYSIS ENGINE v1.0.0', type: 'info' as const },
    { text: '══════════════════════════════════════════════', type: 'info' as const },
    { text: '[BOOT] Initializing WebAudio context...', type: 'info' as const },
    { text: '[BOOT] Loading WASM module...', type: 'info' as const },
    { text: '[BOOT] FFT engine ready (2048 bins)', type: 'info' as const },
    { text: '[BOOT] Chroma extractor initialized', type: 'info' as const },
    { text: '[BOOT] Signal analyzer online', type: 'info' as const },
    { text: '[READY] Awaiting audio signal...', type: 'metric' as const },
    { text: '──────────────────────────────────────────────', type: 'info' as const },
  ]

  bootLogs.forEach((log, i) => {
    setTimeout(() => addLog(log.text, log.type), i * 100)
  })
}

watch(() => props.isPlaying, (playing) => {
  if (playing) {
    addLog('──────────────────────────────────────────────', 'info')
    addLog('[STREAM] Audio playback started', 'info')
    addLog('[STREAM] Real-time analysis active', 'metric')
    addLog('──────────────────────────────────────────────', 'info')
  } else {
    addLog('[STREAM] Playback paused', 'info')
  }
})

// Auto-scroll to bottom
watch(logs, () => {
  if (consoleRef.value) {
    consoleRef.value.scrollTop = consoleRef.value.scrollHeight
  }
}, { flush: 'post' })

onMounted(() => {
  bootSequence()
  intervalId = setInterval(generateLog, 80)
})

onUnmounted(() => {
  if (intervalId) clearInterval(intervalId)
})
</script>

<template>
  <TechPanel title="SIGNAL_TELEMETRY" class="console">
    <template #header-right>
      <StatusIndicator
        :status="isPlaying ? 'active' : 'idle'"
        :label="isPlaying ? 'LIVE' : 'IDLE'"
        :pulse="isPlaying"
      />
    </template>

    <div ref="consoleRef" class="console__body">
      <div
        v-for="(log, i) in logs"
        :key="i"
        class="console__line"
        :class="`console__line--${log.type}`"
      >
        {{ log.text }}
      </div>
      <span class="console__cursor">█</span>
    </div>
  </TechPanel>
</template>

<style scoped>
.console {
  --console-text: rgba(180, 200, 220, 0.7);
  --console-data: rgba(100, 200, 180, 0.85);
  --console-info: rgba(120, 140, 160, 0.5);
  --console-metric: rgba(139, 92, 246, 0.9);
  --console-note: rgba(255, 180, 100, 0.9);

  height: 100%;
  font-family: 'JetBrains Mono', monospace;
}

.console__body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 8px 10px;
  font-size: 10px;
  line-height: 1.5;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.console__body::-webkit-scrollbar {
  display: none;
}

.console__line {
  color: var(--console-text);
  white-space: pre;
  opacity: 0;
  animation: fade-in 0.15s ease-out forwards;
}

.console__line--data {
  color: var(--console-data);
}

.console__line--info {
  color: var(--console-info);
}

.console__line--metric {
  color: var(--console-metric);
}

.console__line--note {
  color: var(--console-note);
}

@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.console__cursor {
  display: inline-block;
  color: var(--console-metric);
  animation: blink 1s step-end infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

@media (max-width: 768px) {
  .console__body {
    font-size: 8px;
    padding: 6px 8px;
  }
}
</style>
