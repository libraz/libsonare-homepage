import { ref, shallowRef } from 'vue'

export interface AnalysisResult {
  bpm: number
  bpmConfidence: number
  key: {
    root: number
    mode: number
    confidence: number
    name: string
    shortName: string
  }
  beats: Array<{ time: number; strength: number }>
  chords: Array<{
    root: number
    quality: number
    start: number
    end: number
    confidence: number
    name: string
  }>
  sections: Array<{
    type: number
    start: number
    end: number
    energyLevel: number
    confidence: number
    name: string
  }>
  timbre: {
    brightness: number
    warmth: number
    density: number
    roughness: number
    complexity: number
  }
  dynamics: {
    dynamicRangeDb: number
    loudnessRangeDb: number
    crestFactor: number
    isCompressed: boolean
  }
  timeSignature: {
    numerator: number
    denominator: number
    confidence: number
  }
  rhythm: {
    syncopation: number
    grooveType: string
    patternRegularity: number
  }
  form: string
}

export function useAudioAnalysis() {
  const isInitialized = ref(false)
  const isAnalyzing = ref(false)
  const progress = ref(0)
  const progressStage = ref('')
  const result = shallowRef<AnalysisResult | null>(null)
  const error = ref<string | null>(null)

  let wasmModule: any = null

  async function initWasm() {
    if (isInitialized.value) return

    try {
      wasmModule = await import('@/wasm/index.js')
      await wasmModule.init()
      isInitialized.value = true
    } catch (e) {
      console.error('Failed to initialize WASM:', e)
      error.value = 'Failed to initialize audio analysis module'
      throw e
    }
  }

  function getVersion(): string {
    if (!wasmModule) return ''
    return wasmModule.version()
  }

  async function analyze(audioBuffer: AudioBuffer): Promise<AnalysisResult> {
    if (!isInitialized.value) {
      await initWasm()
    }

    isAnalyzing.value = true
    progress.value = 0
    progressStage.value = 'Preparing...'
    error.value = null

    try {
      // Convert to mono Float32Array
      const samples = audioBuffer.numberOfChannels > 1
        ? mixToMono(audioBuffer)
        : audioBuffer.getChannelData(0)

      const sampleRate = audioBuffer.sampleRate

      // Analyze with progress callback
      const analysisResult = wasmModule.analyzeWithProgress(
        samples,
        sampleRate,
        (prog: number, stage: string) => {
          progress.value = prog
          progressStage.value = stage
        }
      )

      result.value = analysisResult
      return analysisResult
    } catch (e) {
      console.error('Analysis failed:', e)
      error.value = 'Analysis failed'
      throw e
    } finally {
      isAnalyzing.value = false
      progress.value = 1
      progressStage.value = 'Complete'
    }
  }

  async function detectBpm(audioBuffer: AudioBuffer): Promise<number> {
    if (!isInitialized.value) {
      await initWasm()
    }

    const samples = audioBuffer.numberOfChannels > 1
      ? mixToMono(audioBuffer)
      : audioBuffer.getChannelData(0)

    return wasmModule.detectBpm(samples, audioBuffer.sampleRate)
  }

  async function detectBeats(audioBuffer: AudioBuffer): Promise<Float32Array> {
    if (!isInitialized.value) {
      await initWasm()
    }

    const samples = audioBuffer.numberOfChannels > 1
      ? mixToMono(audioBuffer)
      : audioBuffer.getChannelData(0)

    return wasmModule.detectBeats(samples, audioBuffer.sampleRate)
  }

  function mixToMono(audioBuffer: AudioBuffer): Float32Array {
    const length = audioBuffer.length
    const mono = new Float32Array(length)
    const channels = audioBuffer.numberOfChannels

    for (let i = 0; i < length; i++) {
      let sum = 0
      for (let ch = 0; ch < channels; ch++) {
        sum += audioBuffer.getChannelData(ch)[i]
      }
      mono[i] = sum / channels
    }

    return mono
  }

  return {
    isInitialized,
    isAnalyzing,
    progress,
    progressStage,
    result,
    error,
    initWasm,
    getVersion,
    analyze,
    detectBpm,
    detectBeats,
  }
}
