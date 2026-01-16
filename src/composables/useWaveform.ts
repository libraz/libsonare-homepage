import { ref, onMounted, onUnmounted, watch } from 'vue'

export interface WaveformOptions {
  barWidth?: number
  barGap?: number
  barColor?: string
  progressColor?: string
  backgroundColor?: string
}

export function useWaveform(
  canvasRef: { value: HTMLCanvasElement | null },
  options: WaveformOptions = {}
) {
  const {
    barWidth = 3,
    barGap = 1,
    barColor = 'rgba(139, 92, 246, 0.4)',
    progressColor = 'rgba(139, 92, 246, 1)',
    backgroundColor = 'rgba(6, 8, 12, 1)',
  } = options

  const waveformData = ref<number[]>([])
  const progress = ref(0)
  const beatMarkers = ref<number[]>([])

  let resizeObserver: ResizeObserver | null = null

  function extractWaveformData(audioBuffer: AudioBuffer, numBars = 200): number[] {
    const rawData = audioBuffer.numberOfChannels > 1
      ? mixToMono(audioBuffer)
      : audioBuffer.getChannelData(0)

    const samplesPerBar = Math.floor(rawData.length / numBars)
    const bars: number[] = []

    for (let i = 0; i < numBars; i++) {
      const start = i * samplesPerBar
      const end = start + samplesPerBar
      let max = 0

      for (let j = start; j < end; j++) {
        const absValue = Math.abs(rawData[j])
        if (absValue > max) max = absValue
      }

      bars.push(max)
    }

    // Normalize
    const maxValue = Math.max(...bars)
    if (maxValue > 0) {
      for (let i = 0; i < bars.length; i++) {
        bars[i] = bars[i] / maxValue
      }
    }

    return bars
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

  function setAudioBuffer(audioBuffer: AudioBuffer) {
    const canvas = canvasRef.value
    if (!canvas) return

    const numBars = Math.floor(canvas.width / (barWidth + barGap))
    waveformData.value = extractWaveformData(audioBuffer, numBars)
    draw()
  }

  function setBeats(beats: Float32Array | number[], duration: number) {
    beatMarkers.value = Array.from(beats).map(t => t / duration)
  }

  function setProgress(p: number) {
    progress.value = p
    draw()
  }

  function draw() {
    const canvas = canvasRef.value
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { width, height } = canvas
    const data = waveformData.value

    // Clear
    ctx.fillStyle = backgroundColor
    ctx.fillRect(0, 0, width, height)

    if (data.length === 0) return

    const totalBarWidth = barWidth + barGap
    const centerY = height / 2

    // Draw bars
    for (let i = 0; i < data.length; i++) {
      const x = i * totalBarWidth
      const barHeight = data[i] * height * 0.8
      const y = centerY - barHeight / 2

      const barProgress = i / data.length
      ctx.fillStyle = barProgress <= progress.value ? progressColor : barColor

      ctx.beginPath()
      ctx.roundRect(x, y, barWidth, barHeight, 2)
      ctx.fill()
    }

    // Draw beat markers
    if (beatMarkers.value.length > 0) {
      ctx.strokeStyle = 'rgba(236, 72, 153, 0.5)'
      ctx.lineWidth = 1

      for (const beatPos of beatMarkers.value) {
        const x = beatPos * width
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, height)
        ctx.stroke()
      }
    }

  }

  function handleResize() {
    const canvas = canvasRef.value
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1

    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr

    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.scale(dpr, dpr)
    }

    draw()
  }

  onMounted(() => {
    if (canvasRef.value) {
      resizeObserver = new ResizeObserver(handleResize)
      resizeObserver.observe(canvasRef.value)
      handleResize()
    }
  })

  onUnmounted(() => {
    if (resizeObserver) {
      resizeObserver.disconnect()
    }
  })

  watch(() => canvasRef.value, (canvas) => {
    if (canvas && resizeObserver) {
      resizeObserver.observe(canvas)
      handleResize()
    }
  })

  return {
    waveformData,
    progress,
    beatMarkers,
    setAudioBuffer,
    setBeats,
    setProgress,
    draw,
  }
}
