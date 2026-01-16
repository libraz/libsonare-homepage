<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from '@/composables/useI18n'
import { useAudioAnalysis } from '@/composables/useAudioAnalysis'
import { useAudioPlayer } from '@/composables/useAudioPlayer'
import { useStreamAnalyzer } from '@/composables/useStreamAnalyzer'
import { TechPanel, MetricItem, TransportButton } from '@/components/ui'
import DropZone from './DropZone.vue'
import WaveformVisualizer from './WaveformVisualizer.vue'
import SynesthesiaVisualizer from './SynesthesiaVisualizer.vue'
import DataConsole from './DataConsole.vue'

defineProps<{
  libVersion?: string
}>()

const { t } = useI18n()
const isLoadingDemo = ref(false)
const isStreamingMode = ref(true) // Enable streaming by default

const {
  isAnalyzing,
  progress,
  progressStage,
  result,
  error: analysisError,
  analyze,
} = useAudioAnalysis()

const {
  audioBuffer,
  isPlaying,
  isPaused,
  currentTime,
  duration,
  loadAudio,
  loadAudioFromArrayBuffer,
  play,
  pause,
  resume,
  stop,
  seek,
  formatTime,
  setProcessCallback,
  getAudioContext,
} = useAudioPlayer()

const {
  isInitialized: isStreamInitialized,
  estimate: streamEstimate,
  streamingData,
  init: initStreamAnalyzer,
  reinit: reinitStreamAnalyzer,
  process: processAudioChunk,
  setExpectedDuration,
  setNormalizationGain,
  reset: resetStreamAnalyzer,
} = useStreamAnalyzer({
  sampleRate: 44100,  // Will be updated when audio is loaded
  nFft: 2048,
  hopLength: 512,  // Changed from 1024 for better time resolution
  nMels: 128,
  computeMel: true,
  computeChroma: true,
  computeOnset: true,
})

const fileName = ref('')
const beats = ref<Float32Array | null>(null)
const rmsData = ref<Float32Array | null>(null)
const chromaData = ref<{ features: Float32Array; nFrames: number; nChroma: number } | null>(null)
const bandData = ref<{ low: Float32Array; high: Float32Array } | null>(null)
const sampleRate = ref(44100)

const isLoadingFile = ref(false)
const fileProgress = ref(0)
const fileProgressStage = ref('')
const hasUserFile = ref(false)  // Track if user uploaded a file

async function handleFile(file: File) {
  // Stop current playback and reset state
  if (isPlaying.value) {
    stop()
  }
  resetStreamAnalyzer()
  setProcessCallback(null)

  hasUserFile.value = true  // Mark that user uploaded a file
  fileName.value = file.name
  isLoadingFile.value = true
  fileProgress.value = 0
  fileProgressStage.value = 'DECODING AUDIO'

  try {
    // Initialize WASM and StreamAnalyzer if needed
    fileProgress.value = 5
    await initStreamAnalyzer()
    await yieldToMain()

    fileProgress.value = 15
    fileProgressStage.value = 'DECODING AUDIO'
    const buffer = await loadAudio(file)
    await yieldToMain()

    fileProgress.value = 35
    fileProgressStage.value = 'INITIALIZING ANALYZER'
    // Reinitialize stream analyzer with AudioContext sample rate
    const ctx = getAudioContext()
    sampleRate.value = ctx.sampleRate
    await reinitStreamAnalyzer(ctx.sampleRate)

    // Set expected duration for pattern lock timing
    setExpectedDuration(buffer.duration)

    // Set normalization gain for loud audio
    const normGain = calculateNormalizationGain(buffer)
    setNormalizationGain(normGain)

    // Set up streaming callback
    setProcessCallback((samples, sampleOffset) => {
      processAudioChunk(samples)
    })
    await yieldToMain()

    fileProgress.value = 45
    fileProgressStage.value = 'EXTRACTING SAMPLES'
    // Pre-compute visualization data
    const wasm = await import('@/wasm/index.js')
    const maxSamples = Math.min(buffer.length, buffer.sampleRate * 30)
    const samples = buffer.numberOfChannels > 1
      ? mixToMono(buffer, maxSamples)
      : buffer.getChannelData(0).slice(0, maxSamples)
    await yieldToMain()

    fileProgress.value = 55
    fileProgressStage.value = 'COMPUTING RMS'
    const rms = wasm.rmsEnergy(samples, buffer.sampleRate, 2048, 1024)
    await yieldToMain()

    fileProgress.value = 70
    fileProgressStage.value = 'COMPUTING CHROMA'
    const chromaResult = wasm.chroma(samples, buffer.sampleRate, 2048, 1024)
    await yieldToMain()

    fileProgress.value = 85
    fileProgressStage.value = 'COMPUTING SPECTROGRAM'
    const melResult = wasm.melSpectrogram(samples, buffer.sampleRate, 2048, 1024, 128)
    await yieldToMain()

    fileProgress.value = 95
    fileProgressStage.value = 'FINALIZING'
    const { nMels, nFrames: melFrames } = melResult
    const lowBandRms = new Float32Array(melFrames)
    const highBandRms = new Float32Array(melFrames)
    const lowEnd = Math.floor(nMels * 0.25)
    const highStart = Math.floor(nMels * 0.5)

    for (let f = 0; f < melFrames; f++) {
      let lowSum = 0, highSum = 0
      for (let m = 0; m < lowEnd; m++) {
        lowSum += melResult.power[f * nMels + m]
      }
      for (let m = highStart; m < nMels; m++) {
        highSum += melResult.power[f * nMels + m]
      }
      lowBandRms[f] = Math.sqrt(lowSum / lowEnd)
      highBandRms[f] = Math.sqrt(highSum / (nMels - highStart))
    }

    rmsData.value = rms
    chromaData.value = {
      features: chromaResult.features,
      nFrames: chromaResult.nFrames,
      nChroma: chromaResult.nChroma,
    }
    bandData.value = {
      low: lowBandRms,
      high: highBandRms,
    }

    // Set minimal result to show UI
    result.value = {
      bpm: 0,
      bpmConfidence: 0,
      key: { root: 0, mode: 0, confidence: 0, name: '-', shortName: '-' },
      timeSignature: { numerator: 4, denominator: 4, confidence: 0 },
      beats: [],
      chords: [],
      sections: [],
      timbre: { brightness: 0, warmth: 0, density: 0, roughness: 0, complexity: 0 },
      dynamics: { dynamicRangeDb: 0, loudnessRangeDb: 0, crestFactor: 0, isCompressed: false },
      rhythm: { syncopation: 0, grooveType: '', patternRegularity: 0 },
      form: '',
    }

    fileProgress.value = 100
    isLoadingFile.value = false
  } catch (e) {
    console.error('Failed to process audio:', e)
    isLoadingFile.value = false
  }
}

function togglePlayback() {
  if (isPlaying.value) {
    pause()
  } else if (isPaused.value) {
    resume()
  } else {
    play()
  }
}

function rewind() {
  seek(0)
  // Don't reset here - will reset when play is pressed at position 0
}

function handleSeek(time: number) {
  seek(time)
}

function resetFile() {
  audioBuffer.value = null
  result.value = null
  resetStreamAnalyzer()
  setProcessCallback(null)
}

// Use streaming estimates when available, fallback to batch analysis
const displayBpm = computed(() => {
  if (isStreamingMode.value && streamEstimate.value.bpm > 0) {
    return streamEstimate.value.bpm
  }
  return result.value?.bpm ?? 0
})

const displayKey = computed(() => {
  if (isStreamingMode.value && streamEstimate.value.key !== '-') {
    return streamEstimate.value.key
  }
  return result.value?.key?.name ?? '-'
})

const displayBpmConfidence = computed(() => {
  if (isStreamingMode.value) {
    return Math.round(streamEstimate.value.bpmConfidence * 100)
  }
  return result.value?.bpmConfidence ? Math.round(result.value.bpmConfidence * 100) : 0
})

const displayKeyConfidence = computed(() => {
  if (isStreamingMode.value) {
    return Math.round(streamEstimate.value.keyConfidence * 100)
  }
  return result.value?.key?.confidence ? Math.round(result.value.key.confidence * 100) : 0
})

const displayChord = computed(() => {
  if (isStreamingMode.value && streamEstimate.value.chord !== '-') {
    return streamEstimate.value.chord
  }
  return '-'
})

const displayChordConfidence = computed(() => {
  if (isStreamingMode.value) {
    return Math.round(streamEstimate.value.chordConfidence * 100)
  }
  return 0
})

const displayTimeSignature = computed(() => {
  if (!result.value?.timeSignature) return '-'
  const ts = result.value.timeSignature
  return `${ts.numerator}/${ts.denominator}`
})

// Bar chord progression
const displayCurrentBar = computed(() => {
  if (isStreamingMode.value && streamEstimate.value.currentBar >= 0) {
    return streamEstimate.value.currentBar + 1 // 1-indexed for display
  }
  return 0
})

const displayBarChordProgression = computed(() => {
  if (isStreamingMode.value) {
    return streamEstimate.value.barChordProgression
  }
  return []
})

// C++ computed voted pattern (more accurate than barChordProgression.slice(-4))
const displayVotedPattern = computed(() => {
  if (isStreamingMode.value) {
    return streamEstimate.value.votedPattern
  }
  return []
})

const displayDetectedPatternName = computed(() => {
  if (isStreamingMode.value) {
    return streamEstimate.value.detectedPatternName
  }
  return ''
})

const displayDetectedPatternScore = computed(() => {
  if (isStreamingMode.value) {
    return Math.round(streamEstimate.value.detectedPatternScore * 100)
  }
  return 0
})

// Calculate normalization gain for loud audio
function calculateNormalizationGain(buffer: AudioBuffer): number {
  const TARGET_PEAK = 0.5  // Target peak level (~-6dB)
  const THRESHOLD = 0.8   // Only normalize if peak > this

  // Find peak across all channels
  let maxPeak = 0
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch)
    for (let i = 0; i < data.length; i++) {
      const abs = Math.abs(data[i])
      if (abs > maxPeak) maxPeak = abs
    }
  }

  // If audio is loud (peak > threshold), apply normalization
  if (maxPeak > THRESHOLD) {
    return TARGET_PEAK / maxPeak
  }

  return 1.0  // No normalization needed
}

// Yield to main thread for animation
const yieldToMain = () => new Promise(resolve => setTimeout(resolve, 0))

async function loadDemoFile() {
  isLoadingDemo.value = true

  // Wait for loading animation to render
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))

  // Abort if user uploaded a file
  if (hasUserFile.value) {
    isLoadingDemo.value = false
    return
  }

  const timings: Record<string, number> = {}
  let t0 = performance.now()

  try {
    // Initialize WASM and StreamAnalyzer
    t0 = performance.now()
    await initStreamAnalyzer()
    timings['StreamAnalyzer init'] = performance.now() - t0

    // Abort if user uploaded a file
    if (hasUserFile.value) {
      isLoadingDemo.value = false
      return
    }

    await yieldToMain()

    t0 = performance.now()
    const response = await fetch('/demo.mp3')
    if (!response.ok) {
      throw new Error('Failed to load demo file')
    }
    const arrayBuffer = await response.arrayBuffer()
    timings['Fetch MP3'] = performance.now() - t0

    // Abort if user uploaded a file
    if (hasUserFile.value) {
      isLoadingDemo.value = false
      return
    }

    await yieldToMain()

    fileName.value = 'demo.mp3'

    t0 = performance.now()
    const buffer = await loadAudioFromArrayBuffer(arrayBuffer.slice(0))
    timings['Decode audio'] = performance.now() - t0

    await yieldToMain()

    // Reinitialize stream analyzer with AudioContext sample rate
    // (AnalyserNode outputs at AudioContext rate, not buffer rate)
    const ctx = getAudioContext()
    sampleRate.value = ctx.sampleRate
    await reinitStreamAnalyzer(ctx.sampleRate)

    // Set expected duration for pattern lock timing
    setExpectedDuration(buffer.duration)

    // Set normalization gain for loud audio
    const normGain = calculateNormalizationGain(buffer)
    setNormalizationGain(normGain)

    // Set up streaming callback
    setProcessCallback((samples, sampleOffset) => {
      processAudioChunk(samples)
    })

    // Pre-compute initial visualization data for immediate display
    // (streaming will update this in real-time during playback)
    t0 = performance.now()
    const wasm = await import('@/wasm/index.js')
    const maxSamples = Math.min(buffer.length, buffer.sampleRate * 30)
    const samples = buffer.numberOfChannels > 1
      ? mixToMono(buffer, maxSamples)
      : buffer.getChannelData(0).slice(0, maxSamples)
    timings['Mix to mono'] = performance.now() - t0

    await yieldToMain()

    t0 = performance.now()
    const rms = wasm.rmsEnergy(samples, buffer.sampleRate, 2048, 1024)
    timings['rmsEnergy'] = performance.now() - t0

    await yieldToMain()

    t0 = performance.now()
    const chromaResult = wasm.chroma(samples, buffer.sampleRate, 2048, 1024)
    timings['chroma'] = performance.now() - t0

    await yieldToMain()

    t0 = performance.now()
    const melResult = wasm.melSpectrogram(samples, buffer.sampleRate, 2048, 1024, 128)
    timings['melSpectrogram'] = performance.now() - t0

    await yieldToMain()

    t0 = performance.now()
    const { nMels, nFrames: melFrames } = melResult
    const lowBandRms = new Float32Array(melFrames)
    const highBandRms = new Float32Array(melFrames)
    const lowEnd = Math.floor(nMels * 0.25)
    const highStart = Math.floor(nMels * 0.5)

    for (let f = 0; f < melFrames; f++) {
      let lowSum = 0, highSum = 0
      for (let m = 0; m < lowEnd; m++) {
        lowSum += melResult.power[f * nMels + m]
      }
      for (let m = highStart; m < nMels; m++) {
        highSum += melResult.power[f * nMels + m]
      }
      lowBandRms[f] = Math.sqrt(lowSum / lowEnd)
      highBandRms[f] = Math.sqrt(highSum / (nMels - highStart))
    }
    timings['band separation'] = performance.now() - t0

    // Abort if user uploaded a file - don't overwrite their data
    if (hasUserFile.value) {
      isLoadingDemo.value = false
      return
    }

    rmsData.value = rms
    chromaData.value = {
      features: chromaResult.features,
      nFrames: chromaResult.nFrames,
      nChroma: chromaResult.nChroma,
    }
    bandData.value = {
      low: lowBandRms,
      high: highBandRms,
    }

    result.value = {
      bpm: 0,
      bpmConfidence: 0,
      key: { root: 0, mode: 0, confidence: 0, name: '-', shortName: '-' },
      timeSignature: { numerator: 4, denominator: 4, confidence: 0 },
      beats: [],
      chords: [],
      sections: [],
      timbre: { brightness: 0, warmth: 0, density: 0, roughness: 0, complexity: 0 },
      dynamics: { dynamicRangeDb: 0, loudnessRangeDb: 0, crestFactor: 0, isCompressed: false },
      rhythm: { syncopation: 0, grooveType: '', patternRegularity: 0 },
      form: '',
    }

    isLoadingDemo.value = false
  } catch (e) {
    console.error('Failed to load demo file:', e)
    isLoadingDemo.value = false
  }
}

function mixToMono(audioBuffer: AudioBuffer, maxLength?: number): Float32Array {
  const length = maxLength ? Math.min(audioBuffer.length, maxLength) : audioBuffer.length
  const channels = audioBuffer.numberOfChannels

  const channelData: Float32Array[] = []
  for (let ch = 0; ch < channels; ch++) {
    channelData.push(audioBuffer.getChannelData(ch))
  }

  if (channels === 2) {
    const left = channelData[0]
    const right = channelData[1]
    const mono = new Float32Array(length)
    for (let i = 0; i < length; i++) {
      mono[i] = (left[i] + right[i]) * 0.5
    }
    return mono
  }

  const mono = new Float32Array(length)
  const scale = 1 / channels
  for (let i = 0; i < length; i++) {
    let sum = 0
    for (let ch = 0; ch < channels; ch++) {
      sum += channelData[ch][i]
    }
    mono[i] = sum * scale
  }
  return mono
}

// Reset stream analyzer when starting fresh playback from the beginning
watch(isPlaying, (playing, wasPlaying) => {
  if (playing && !wasPlaying && currentTime.value === 0) {
    // Starting new playback from beginning - reset analyzer
    resetStreamAnalyzer()
  }
})

onMounted(() => {
  loadDemoFile()
})
</script>

<template>
  <div class="analyzer">
    <!-- Loading State -->
    <div v-if="isLoadingDemo || isLoadingFile" class="analyzer__loading">
      <!-- Audio waveform bars with center icon -->
      <div class="analyzer__loading-bars">
        <div class="analyzer__loading-bar" v-for="i in 12" :key="i" :style="{ animationDelay: `${(i - 1) * 0.08}s` }"></div>
        <!-- Center icon (inside bars for proper positioning) -->
        <div class="analyzer__loading-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M9 18V5l12-2v13" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="6" cy="18" r="3"/>
            <circle cx="18" cy="16" r="3"/>
          </svg>
        </div>
      </div>

      <!-- Loading text -->
      <div class="analyzer__loading-text-container">
        <span class="analyzer__loading-label">LIBSONARE</span>
        <span class="analyzer__loading-text">
          {{ isLoadingFile ? fileProgressStage : 'INITIALIZING SIGNAL PROCESSOR...' }}
        </span>
      </div>

      <!-- File progress bar (when loading file) -->
      <div v-if="isLoadingFile" class="analyzer__loading-progress">
        <div class="analyzer__loading-progress-bar">
          <div class="analyzer__loading-progress-fill" :style="{ width: `${fileProgress}%` }"></div>
        </div>
        <span class="analyzer__loading-progress-text">{{ fileProgress }}%</span>
      </div>

      <!-- Progress dots (when loading demo) -->
      <div v-else class="analyzer__loading-dots">
        <span class="analyzer__loading-dot" v-for="i in 3" :key="i" :style="{ animationDelay: `${(i - 1) * 0.2}s` }"></span>
      </div>
    </div>

    <!-- Drop Zone (no file) -->
    <DropZone v-else-if="!audioBuffer" @file="handleFile" />

    <!-- Analysis Progress -->
    <div v-else-if="isAnalyzing" class="analyzer__progress">
      <div class="analyzer__progress-bar">
        <div class="analyzer__progress-fill" :style="{ width: `${progress * 100}%` }"></div>
      </div>
      <span class="analyzer__progress-text">{{ progressStage }} {{ Math.round(progress * 100) }}%</span>
    </div>

    <!-- Main Interface -->
    <div v-else-if="result" class="analyzer__main">
      <!-- Central Oscilloscope Area -->
      <div class="analyzer__center">
        <!-- Oscilloscope Hero -->
        <div class="analyzer__scope-container">
          <SynesthesiaVisualizer
            :chroma-data="chromaData"
            :rms-data="rmsData"
            :band-data="bandData"
            :current-time="currentTime"
            :duration="duration"
            :is-playing="isPlaying"
          />
        </div>

        <!-- Waveform & Transport -->
        <div class="analyzer__transport">
          <WaveformVisualizer
            :audio-buffer="audioBuffer"
            :beats="beats ?? undefined"
            :current-time="currentTime"
            :duration="duration"
            @seek="handleSeek"
          />

          <div class="analyzer__controls">
            <div class="analyzer__controls-left">
              <TransportButton size="sm" @click="rewind" aria-label="Rewind">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/>
                </svg>
              </TransportButton>
              <TransportButton variant="primary" round @click="togglePlayback" :aria-label="isPlaying ? 'Pause' : 'Play'">
                <svg v-if="!isPlaying" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z"/>
                </svg>
                <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                </svg>
              </TransportButton>
              <TransportButton size="sm" @click="stop" aria-label="Stop">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 6h12v12H6z"/>
                </svg>
              </TransportButton>
            </div>

            <div class="analyzer__time">
              <span class="analyzer__time-current">{{ formatTime(currentTime) }}</span>
              <span class="analyzer__time-sep">/</span>
              <span class="analyzer__time-total">{{ formatTime(duration) }}</span>
            </div>

            <div class="analyzer__controls-right">
              <TransportButton size="sm" @click="resetFile">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 15v4c0 1.1.9 2 2 2h14a2 2 0 002-2v-4M17 8l-5-5-5 5M12 3v12"/>
                </svg>
                <span>FILE</span>
              </TransportButton>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Panel: Data Console -->
      <aside class="analyzer__sidebar analyzer__sidebar--right">
        <DataConsole
          :chroma-data="chromaData"
          :rms-data="rmsData"
          :band-data="bandData"
          :current-time="currentTime"
          :duration="duration"
          :is-playing="isPlaying"
          :sample-rate="sampleRate"
        />
      </aside>

      <!-- Left Panel: Metrics -->
      <aside class="analyzer__sidebar analyzer__sidebar--left">
        <TechPanel :title="t('demo.panel.title')" class="analyzer__metrics">
          <div class="analyzer__metrics-body">
            <!-- Primary Analysis Results -->
            <div class="analyzer__metric-hero">
              <span class="analyzer__metric-hero-label">{{ t('demo.panel.bpm') }}</span>
              <span class="analyzer__metric-hero-value">{{ displayBpm || '-' }}</span>
              <span v-if="displayBpmConfidence > 0" class="analyzer__metric-hero-conf">{{ displayBpmConfidence }}%</span>
            </div>
            <div class="analyzer__metric-hero">
              <span class="analyzer__metric-hero-label">{{ t('demo.panel.key') }}</span>
              <span class="analyzer__metric-hero-value">{{ displayKey }}</span>
              <span v-if="displayKeyConfidence > 0" class="analyzer__metric-hero-conf">{{ displayKeyConfidence }}%</span>
            </div>
            <!-- Chord Progression Pattern (C++ computed) -->
            <div v-if="displayVotedPattern.length >= 4" class="analyzer__pattern">
              <div class="analyzer__pattern-header">
                <span class="analyzer__pattern-label">{{ t('demo.panel.pattern') }}</span>
                <span v-if="displayDetectedPatternName" class="analyzer__pattern-name">{{ displayDetectedPatternName }}</span>
              </div>
              <div class="analyzer__pattern-chords">
                {{ displayVotedPattern.join('→') }}
              </div>
              <span v-if="displayDetectedPatternName && displayDetectedPatternScore > 0" class="analyzer__pattern-score">{{ displayDetectedPatternScore }}%</span>
            </div>
            <div class="analyzer__metrics-divider"></div>
            <!-- Secondary Info -->
            <MetricItem :label="t('demo.panel.timeSig')" :value="displayTimeSignature" />
            <MetricItem :label="t('demo.panel.duration')" :value="formatTime(duration)" />
            <MetricItem :label="t('demo.panel.rate')" :value="`${(sampleRate / 1000).toFixed(1)}kHz`" />
            <div class="analyzer__metrics-divider"></div>
            <!-- Source -->
            <MetricItem :label="t('demo.panel.source')" :value="fileName" variant="success" />
          </div>
        </TechPanel>
      </aside>
    </div>

    <!-- Error State -->
    <div v-if="analysisError" class="analyzer__error">
      <span class="analyzer__error-icon">!</span>
      <span>{{ analysisError }}</span>
    </div>
  </div>
</template>

<style scoped>
.analyzer {
  width: 100%;
  height: 100%;
  max-width: 1400px;
  max-height: calc(100vh - 120px);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'JetBrains Mono', monospace;
}

/* ===== LOADING ===== */
.analyzer__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 32px;
  position: relative;
  padding: 60px;
}

/* Audio waveform bars wrapper */
.analyzer__loading-bars {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 80px;
  position: relative;
  z-index: 1;
}

.analyzer__loading-bar {
  width: 4px;
  height: 48px;
  background: linear-gradient(to top, #8B5CF6, #A78BFA);
  border-radius: 2px;
  will-change: transform, opacity;
  animation: wave-bar 1.2s ease-in-out infinite;
}

@keyframes wave-bar {
  0%, 100% { transform: scaleY(0.25); opacity: 0.4; }
  50% { transform: scaleY(1); opacity: 1; }
}

/* Center icon - positioned relative to bars container */
.analyzer__loading-icon {
  position: absolute;
  width: 36px;
  height: 36px;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 10;
  will-change: transform;
  animation: icon-pulse 2s ease-in-out infinite;
}

.analyzer__loading-icon svg {
  width: 100%;
  height: 100%;
  fill: none;
  stroke: rgba(255, 255, 255, 0.9);
  stroke-width: 2;
  filter: drop-shadow(0 0 8px rgba(139, 92, 246, 0.8)) drop-shadow(0 0 16px rgba(139, 92, 246, 0.5));
}

@keyframes icon-pulse {
  0%, 100% { transform: translate(-50%, -50%) scale(1); }
  50% { transform: translate(-50%, -50%) scale(1.05); }
}

/* Loading text container */
.analyzer__loading-text-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  position: relative;
  z-index: 1;
}

.analyzer__loading-label {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.3em;
  color: #8B5CF6;
  text-shadow: 0 0 20px rgba(139, 92, 246, 0.5);
  margin-top: 5px;
}

.analyzer__loading-text {
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.15em;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
}

/* Loading dots */
.analyzer__loading-dots {
  display: flex;
  gap: 6px;
  position: relative;
  z-index: 1;
}

.analyzer__loading-dot {
  width: 6px;
  height: 6px;
  background: rgba(139, 92, 246, 0.4);
  border-radius: 50%;
  will-change: transform;
  animation: dot-bounce 1.4s ease-in-out infinite;
}

@keyframes dot-bounce {
  0%, 80%, 100% { transform: translateY(0); background: rgba(139, 92, 246, 0.4); }
  40% { transform: translateY(-8px); background: #8B5CF6; }
}

/* Loading progress bar */
.analyzer__loading-progress {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 240px;
  position: relative;
  z-index: 1;
}

.analyzer__loading-progress-bar {
  width: 100%;
  height: 3px;
  background: rgba(139, 92, 246, 0.15);
  border-radius: 2px;
  overflow: hidden;
}

.analyzer__loading-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #8B5CF6, #A78BFA);
  border-radius: 2px;
  transition: width 0.2s ease-out;
  box-shadow: 0 0 8px rgba(139, 92, 246, 0.5);
}

.analyzer__loading-progress-text {
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: #A78BFA;
  letter-spacing: 0.05em;
}

/* ===== PROGRESS ===== */
.analyzer__progress {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  width: 300px;
}

.analyzer__progress-bar {
  width: 100%;
  height: 4px;
  background: rgba(139, 92, 246, 0.15);
  border-radius: 2px;
  overflow: hidden;
}

.analyzer__progress-fill {
  height: 100%;
  background: #8B5CF6;
  transition: width 0.3s ease;
}

.analyzer__progress-text {
  font-size: 10px;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.4);
}

/* ===== MAIN LAYOUT ===== */
.analyzer__main {
  display: grid;
  grid-template-columns: 220px 1fr 280px;
  grid-template-rows: 1fr;
  gap: 16px;
  width: 100%;
  height: 100%;
  max-height: 700px;
}

/* ===== CENTER ===== */
.analyzer__center {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  grid-column: 2;
  min-height: 0;
}

.analyzer__scope-container {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.analyzer__scope-container :deep(.scope) {
  max-width: 100%;
  height: auto;
  margin: 0;
}

/* ===== TRANSPORT ===== */
.analyzer__transport {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: rgba(8, 10, 14, 0.85);
  border: 1px solid rgba(139, 92, 246, 0.15);
  border-radius: 8px;
  backdrop-filter: blur(10px);
}

.analyzer__controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 4px;
}

.analyzer__controls-left,
.analyzer__controls-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.analyzer__time {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: rgba(255, 255, 255, 0.8);
}

.analyzer__time-current {
  color: #8B5CF6;
  font-weight: 600;
}

.analyzer__time-sep {
  color: rgba(255, 255, 255, 0.4);
  margin: 0 4px;
}

.analyzer__time-total {
  color: rgba(255, 255, 255, 0.4);
}

/* ===== SIDEBAR ===== */
.analyzer__sidebar {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.analyzer__sidebar--left {
  grid-column: 1;
  grid-row: 1;
}

.analyzer__sidebar--right {
  grid-column: 3;
  grid-row: 1;
}

/* ===== METRICS PANEL ===== */
.analyzer__metrics {
  height: 100%;
}

.analyzer__metrics-body {
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.analyzer__metrics-divider {
  height: 1px;
  background: rgba(139, 92, 246, 0.15);
  margin: 4px 0;
}

/* ===== HERO METRICS ===== */
.analyzer__metric-hero {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 6px 0;
}

.analyzer__metric-hero-label {
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.4);
  min-width: 50px;
}

.analyzer__metric-hero-value {
  font-size: 20px;
  font-weight: 600;
  color: #A78BFA;
  font-variant-numeric: tabular-nums;
  min-width: 60px;
}

.analyzer__metric-hero-value--chord {
  min-width: 45px;
  font-size: 18px;
}

.analyzer__metric-hero-conf {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.3);
  margin-left: auto;
}

/* ===== CHORD PATTERN ===== */
.analyzer__pattern {
  margin-top: 4px;
  padding: 8px 10px;
  background: rgba(139, 92, 246, 0.08);
  border: 1px solid rgba(139, 92, 246, 0.15);
  border-radius: 6px;
}

.analyzer__pattern-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.analyzer__pattern-label {
  font-size: 9px;
  font-weight: 500;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.35);
}

.analyzer__pattern-bar {
  font-size: 9px;
  font-weight: 600;
  color: #A78BFA;
  letter-spacing: 0.05em;
}

.analyzer__pattern-name {
  font-size: 10px;
  font-weight: 600;
  color: #10B981;
  letter-spacing: 0.05em;
  text-transform: capitalize;
}

.analyzer__pattern-chords {
  font-size: 13px;
  font-weight: 600;
  color: #A78BFA;
  letter-spacing: 0.02em;
}

.analyzer__pattern-score {
  font-size: 9px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.4);
  margin-top: 4px;
  display: block;
}

/* ===== ERROR ===== */
.analyzer__error {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 8px;
  color: #ef4444;
  font-size: 12px;
}

.analyzer__error-icon {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(239, 68, 68, 0.2);
  border-radius: 50%;
  font-weight: 700;
  font-size: 11px;
}

/* ===== RESPONSIVE ===== */
@media (max-width: 1100px) {
  .analyzer__main {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr auto;
    max-height: none;
  }

  .analyzer__sidebar--left {
    grid-column: 1;
    grid-row: 3;
    max-height: 200px;
  }

  .analyzer__sidebar--right {
    display: none;
  }

  .analyzer__center {
    grid-column: 1;
    grid-row: 1 / 3;
  }

  .analyzer__metrics-body {
    flex-direction: row;
    flex-wrap: wrap;
    gap: 16px;
  }

  .analyzer__metrics-body :deep(.metric-item) {
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    min-width: 80px;
  }

  .analyzer__metrics-divider {
    display: none;
  }
}

@media (max-width: 600px) {
  .analyzer__main {
    gap: 10px;
  }

  .analyzer__time {
    font-size: 11px;
  }

  .analyzer__sidebar--left {
    max-height: 160px;
  }

  .analyzer__metrics-body {
    padding: 8px 10px;
    gap: 12px;
  }

  .analyzer__metrics-body :deep(.metric-item) {
    min-width: 70px;
  }
}
</style>
