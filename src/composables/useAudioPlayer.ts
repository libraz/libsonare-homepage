import { ref, computed, onUnmounted } from 'vue'

export type AudioProcessCallback = (samples: Float32Array, sampleOffset: number) => void

export function useAudioPlayer() {
  const audioContext = ref<AudioContext | null>(null)
  const sourceNode = ref<AudioBufferSourceNode | null>(null)
  const audioBuffer = ref<AudioBuffer | null>(null)
  const startTime = ref(0)
  const pauseTime = ref(0)
  const isPlaying = ref(false)
  const isPaused = ref(false)
  const currentTime = ref(0)
  const duration = ref(0)

  let animationFrame: number | null = null
  let workletNode: AudioWorkletNode | null = null
  let processCallback: AudioProcessCallback | null = null
  let workletReady = false

  function getAudioContext(): AudioContext {
    if (!audioContext.value) {
      audioContext.value = new AudioContext()
    }
    return audioContext.value
  }

  async function ensureWorkletReady(): Promise<void> {
    if (workletReady) return

    const ctx = getAudioContext()
    try {
      await ctx.audioWorklet.addModule('/audio-stream-processor.js')
      workletReady = true
    } catch (e) {
      console.error('Failed to load AudioWorklet:', e)
      throw e
    }
  }

  async function loadAudio(file: File): Promise<AudioBuffer> {
    const ctx = getAudioContext()
    const arrayBuffer = await file.arrayBuffer()
    const buffer = await ctx.decodeAudioData(arrayBuffer)
    audioBuffer.value = buffer
    duration.value = buffer.duration
    return buffer
  }

  async function loadAudioFromArrayBuffer(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
    const ctx = getAudioContext()
    const buffer = await ctx.decodeAudioData(arrayBuffer)
    audioBuffer.value = buffer
    duration.value = buffer.duration
    return buffer
  }

  async function play(offset = 0) {
    if (!audioBuffer.value) return

    const ctx = getAudioContext()

    // Resume context if suspended
    if (ctx.state === 'suspended') {
      await ctx.resume()
    }

    // Stop current playback
    if (sourceNode.value) {
      sourceNode.value.stop()
      sourceNode.value.disconnect()
    }

    // Clean up old worklet
    stopProcessing()

    // Create new source
    const source = ctx.createBufferSource()
    source.buffer = audioBuffer.value

    // Set up audio processing chain with AudioWorklet
    if (processCallback) {
      try {
        await ensureWorkletReady()

        // Create AudioWorkletNode
        workletNode = new AudioWorkletNode(ctx, 'audio-stream-processor')

        // Set initial sample offset based on playback position
        const initialSampleOffset = Math.floor(offset * ctx.sampleRate)
        workletNode.port.postMessage({
          type: 'reset',
          sampleOffset: initialSampleOffset,
        })

        // Handle messages from worklet (sample data)
        workletNode.port.onmessage = (event) => {
          if (event.data.type === 'samples' && processCallback) {
            processCallback(event.data.samples, event.data.sampleOffset)
          }
        }

        // Connect: source -> worklet -> destination
        source.connect(workletNode)
        workletNode.connect(ctx.destination)
      } catch (e) {
        // Fallback to direct connection if AudioWorklet fails
        console.warn('AudioWorklet not available, audio processing disabled:', e)
        source.connect(ctx.destination)
      }
    } else {
      source.connect(ctx.destination)
    }

    source.onended = () => {
      if (isPlaying.value && !isPaused.value) {
        isPlaying.value = false
        currentTime.value = 0
        stopProcessing()
      }
    }

    sourceNode.value = source
    startTime.value = ctx.currentTime - offset
    source.start(0, offset)
    isPlaying.value = true
    isPaused.value = false

    updateTime()
  }

  function stopProcessing() {
    if (workletNode) {
      workletNode.port.postMessage({ type: 'stop' })
      workletNode.disconnect()
      workletNode = null
    }
  }

  function pause() {
    if (!isPlaying.value || !audioContext.value) return

    pauseTime.value = audioContext.value.currentTime - startTime.value

    if (sourceNode.value) {
      sourceNode.value.stop()
      sourceNode.value.disconnect()
      sourceNode.value = null
    }

    stopProcessing()

    isPlaying.value = false
    isPaused.value = true

    if (animationFrame) {
      cancelAnimationFrame(animationFrame)
      animationFrame = null
    }
  }

  function resume() {
    if (!isPaused.value) return
    play(pauseTime.value)
  }

  function stop() {
    if (sourceNode.value) {
      sourceNode.value.stop()
      sourceNode.value.disconnect()
      sourceNode.value = null
    }

    stopProcessing()

    isPlaying.value = false
    isPaused.value = false
    currentTime.value = 0
    pauseTime.value = 0

    if (animationFrame) {
      cancelAnimationFrame(animationFrame)
      animationFrame = null
    }
  }

  function setProcessCallback(callback: AudioProcessCallback | null): void {
    processCallback = callback
  }

  function seek(time: number) {
    const wasPlaying = isPlaying.value
    stop()
    if (wasPlaying) {
      play(time)
    } else {
      pauseTime.value = time
      currentTime.value = time
      isPaused.value = true
    }
  }

  function updateTime() {
    if (!isPlaying.value || !audioContext.value) return

    currentTime.value = audioContext.value.currentTime - startTime.value

    if (currentTime.value >= duration.value) {
      stop()
      return
    }

    animationFrame = requestAnimationFrame(updateTime)
  }

  const progress = computed(() => {
    if (duration.value === 0) return 0
    return currentTime.value / duration.value
  })

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  onUnmounted(() => {
    stop()
    stopProcessing()
    processCallback = null
    if (audioContext.value) {
      audioContext.value.close()
    }
  })

  return {
    audioBuffer,
    isPlaying,
    isPaused,
    currentTime,
    duration,
    progress,
    loadAudio,
    loadAudioFromArrayBuffer,
    play,
    pause,
    resume,
    stop,
    seek,
    formatTime,
    getAudioContext,
    setProcessCallback,
  }
}
