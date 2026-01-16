<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  chromaData: {
    features: Float32Array
    nFrames: number
    nChroma: number
  } | null
  rmsData: Float32Array | null
  bandData: {
    low: Float32Array   // drums/bass
    high: Float32Array  // melody
  } | null
  currentTime: number
  duration: number
  isPlaying: boolean
}>()

const canvas = ref<HTMLCanvasElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null
let animationFrame: number | null = null
let canvasSize = 520

// Note names - chromatic circle
const noteNames = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']

// Refined color palette - warmer, more sophisticated
const noteColors = [
  { h: 355, s: 75, l: 58 },   // C - Rose
  { h: 20, s: 85, l: 52 },    // C# - Burnt orange
  { h: 38, s: 90, l: 50 },    // D - Amber
  { h: 52, s: 85, l: 48 },    // D# - Gold
  { h: 75, s: 70, l: 45 },    // E - Olive
  { h: 150, s: 60, l: 42 },   // F - Emerald
  { h: 175, s: 65, l: 45 },   // F# - Teal
  { h: 195, s: 75, l: 50 },   // G - Cyan
  { h: 215, s: 70, l: 55 },   // G# - Steel blue
  { h: 255, s: 60, l: 58 },   // A - Lavender
  { h: 285, s: 65, l: 52 },   // A# - Orchid
  { h: 330, s: 70, l: 55 },   // B - Fuchsia
]

// Frequency band colors
const DRUMS_HUE = 28   // Warm amber
const MELODY_HUE = 190 // Cool cyan

// Smoothed values for animation
const smoothedChroma = new Float32Array(12)
const smoothedRms = ref(0)
const smoothedLow = ref(0)
const smoothedHigh = ref(0)
const peakHistory: { time: number; type: 'low' | 'high' | 'peak' }[] = []

// Spiral particle burst storage
interface BurstParticle {
  angle: number        // Starting angle
  startTime: number
  radius: number       // Target radius (0-1 normalized)
  size: number         // Particle size
  hue: number
  spin: number         // Spiral rotation direction & speed
  layer: number        // 0 = core, 1 = mid, 2 = outer glow
}
const burstParticles: BurstParticle[] = []
let lastBurstTime = 0

// Latency compensation (in seconds) - positive = look ahead
const LATENCY_COMPENSATION = 0.05

const currentFrame = computed(() => {
  if (!props.chromaData || props.duration === 0) return 0
  // Add latency compensation for better perceived sync
  const compensatedTime = Math.min(props.currentTime + LATENCY_COMPENSATION, props.duration)
  const progress = compensatedTime / props.duration
  return Math.min(Math.floor(progress * props.chromaData.nFrames), props.chromaData.nFrames - 1)
})

function hsl(h: number, s: number, l: number, a = 1) {
  return `hsla(${h}, ${s}%, ${l}%, ${a})`
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

// Spawn spiral particle burst from center
function spawnBurstParticles(intensity: number, hue: number) {
  const now = Date.now()
  // Throttle burst spawning
  if (now - lastBurstTime < 120) return
  lastBurstTime = now

  // Number of particles based on intensity (3 layers)
  const coreCount = Math.floor(3 + intensity * 5)
  const midCount = Math.floor(5 + intensity * 8)
  const outerCount = Math.floor(4 + intensity * 6)

  // Core particles - bright, small, fast
  for (let i = 0; i < coreCount; i++) {
    const angle = (i / coreCount) * Math.PI * 2 + Math.random() * 0.5
    burstParticles.push({
      angle,
      startTime: now + Math.random() * 30,
      radius: 0.25 + Math.random() * 0.35,
      size: 2 + Math.random() * 2,
      hue: hue + (Math.random() - 0.5) * 20,
      spin: (Math.random() > 0.5 ? 1 : -1) * (0.8 + Math.random() * 0.6),
      layer: 0
    })
  }

  // Mid particles - medium brightness, spiral outward
  for (let i = 0; i < midCount; i++) {
    const angle = (i / midCount) * Math.PI * 2 + Math.random() * 0.8
    burstParticles.push({
      angle,
      startTime: now + Math.random() * 60,
      radius: 0.35 + Math.random() * 0.4,
      size: 3 + Math.random() * 3,
      hue: hue + (Math.random() - 0.5) * 40,
      spin: (Math.random() > 0.5 ? 1 : -1) * (0.4 + Math.random() * 0.8),
      layer: 1
    })
  }

  // Outer glow particles - soft, large, slow
  for (let i = 0; i < outerCount; i++) {
    const angle = (i / outerCount) * Math.PI * 2 + Math.random() * 1.2
    burstParticles.push({
      angle,
      startTime: now + Math.random() * 80,
      radius: 0.5 + Math.random() * 0.3,
      size: 6 + Math.random() * 6,
      hue: hue + (Math.random() - 0.5) * 30,
      spin: (Math.random() > 0.5 ? 1 : -1) * (0.2 + Math.random() * 0.4),
      layer: 2
    })
  }

  // Cleanup old particles
  while (burstParticles.length > 100) {
    burstParticles.shift()
  }
}

// Draw spiral particle burst effect
function drawBurstParticles(centerX: number, centerY: number, maxRadius: number) {
  if (!ctx || burstParticles.length === 0) return

  const now = Date.now()
  const durations = [500, 700, 900] // Duration per layer

  for (let i = burstParticles.length - 1; i >= 0; i--) {
    const p = burstParticles[i]
    const age = now - p.startTime
    const duration = durations[p.layer]

    if (age < 0) continue
    if (age > duration) {
      burstParticles.splice(i, 1)
      continue
    }

    const progress = age / duration
    // Ease out with slight bounce back for organic feel
    const easeOut = 1 - Math.pow(1 - progress, 2.5)

    // Spiral motion: radius expands while angle rotates
    const currentRadius = easeOut * p.radius * maxRadius * 0.75 // Stay within 75% of maxRadius
    const spiralAngle = p.angle + easeOut * p.spin * Math.PI * 0.8

    const x = centerX + Math.cos(spiralAngle) * currentRadius
    const y = centerY + Math.sin(spiralAngle) * currentRadius

    // Alpha: fade in quickly, fade out slowly
    const fadeIn = Math.min(progress * 5, 1)
    const fadeOut = 1 - Math.pow(progress, 1.5)
    const baseAlpha = fadeIn * fadeOut

    // Layer-specific rendering
    if (p.layer === 2) {
      // Outer glow - soft, blurred circles
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, p.size * (1 + easeOut * 0.5))
      gradient.addColorStop(0, `hsla(${p.hue}, 60%, 70%, ${baseAlpha * 0.25})`)
      gradient.addColorStop(0.5, `hsla(${p.hue}, 50%, 60%, ${baseAlpha * 0.12})`)
      gradient.addColorStop(1, `hsla(${p.hue}, 40%, 50%, 0)`)

      ctx.beginPath()
      ctx.arc(x, y, p.size * (1 + easeOut * 0.5), 0, Math.PI * 2)
      ctx.fillStyle = gradient
      ctx.fill()

    } else if (p.layer === 1) {
      // Mid particles - glowing dots with trail
      const trailLength = 3
      for (let t = 0; t < trailLength; t++) {
        const trailProgress = Math.max(0, progress - t * 0.05)
        const trailEase = 1 - Math.pow(1 - trailProgress, 2.5)
        const trailRadius = trailEase * p.radius * maxRadius * 0.75
        const trailAngle = p.angle + trailEase * p.spin * Math.PI * 0.8
        const tx = centerX + Math.cos(trailAngle) * trailRadius
        const ty = centerY + Math.sin(trailAngle) * trailRadius
        const trailAlpha = baseAlpha * (1 - t / trailLength) * 0.4

        ctx.beginPath()
        ctx.arc(tx, ty, p.size * (0.6 - t * 0.15), 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${p.hue}, 70%, 65%, ${trailAlpha})`
        ctx.fill()
      }

      // Core of mid particle
      ctx.beginPath()
      ctx.arc(x, y, p.size * 0.7, 0, Math.PI * 2)
      ctx.fillStyle = `hsla(${p.hue}, 75%, 75%, ${baseAlpha * 0.6})`
      ctx.fill()

    } else {
      // Core particles - bright, sharp
      // Glow
      const glowGradient = ctx.createRadialGradient(x, y, 0, x, y, p.size * 2)
      glowGradient.addColorStop(0, `hsla(${p.hue}, 80%, 85%, ${baseAlpha * 0.5})`)
      glowGradient.addColorStop(0.4, `hsla(${p.hue}, 70%, 70%, ${baseAlpha * 0.2})`)
      glowGradient.addColorStop(1, `hsla(${p.hue}, 60%, 60%, 0)`)

      ctx.beginPath()
      ctx.arc(x, y, p.size * 2, 0, Math.PI * 2)
      ctx.fillStyle = glowGradient
      ctx.fill()

      // Bright core
      ctx.beginPath()
      ctx.arc(x, y, p.size * 0.5, 0, Math.PI * 2)
      ctx.fillStyle = `hsla(${p.hue}, 60%, 95%, ${baseAlpha * 0.9})`
      ctx.fill()
    }
  }
}

function drawScanLines(size: number) {
  if (!ctx) return
  ctx.save()
  ctx.globalAlpha = 0.015
  for (let y = 0; y < size; y += 4) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
    ctx.fillRect(0, y, size, 1)
  }
  ctx.restore()
}

function drawGrid(centerX: number, centerY: number, maxRadius: number) {
  if (!ctx) return

  // Concentric circles with varying opacity
  const rings = [0.25, 0.45, 0.65, 0.85]
  rings.forEach((r, i) => {
    ctx!.beginPath()
    ctx!.arc(centerX, centerY, maxRadius * r, 0, Math.PI * 2)
    ctx!.strokeStyle = `rgba(255, 255, 255, ${0.03 + i * 0.01})`
    ctx!.lineWidth = 1
    ctx!.stroke()
  })

  // Radial lines (every 30 degrees)
  for (let i = 0; i < 12; i++) {
    const angle = (i * Math.PI * 2) / 12 - Math.PI / 2
    ctx!.beginPath()
    ctx!.moveTo(centerX + Math.cos(angle) * maxRadius * 0.2, centerY + Math.sin(angle) * maxRadius * 0.2)
    ctx!.lineTo(centerX + Math.cos(angle) * maxRadius * 0.9, centerY + Math.sin(angle) * maxRadius * 0.9)
    ctx!.strokeStyle = 'rgba(255, 255, 255, 0.04)'
    ctx!.lineWidth = 1
    ctx!.stroke()
  }
}

function draw() {
  if (!canvas.value || !ctx) return

  const size = canvasSize
  const centerX = size / 2
  const centerY = size / 2
  const maxRadius = size * 0.40

  // Clear with subtle fade for trails
  ctx.fillStyle = 'rgba(6, 8, 12, 0.35)'
  ctx.fillRect(0, 0, size, size)

  const frame = currentFrame.value
  const hasData = props.chromaData && props.rmsData
  const time = Date.now() / 1000

  // Always draw grid and scan lines for atmosphere
  drawGrid(centerX, centerY, maxRadius)

  if (hasData && props.chromaData && props.rmsData) {
    const { features, nChroma } = props.chromaData

    // Update smoothed chroma values (higher = more responsive)
    for (let i = 0; i < nChroma; i++) {
      const value = features[frame * nChroma + i] || 0
      const smoothing = props.isPlaying ? 0.45 : 0.1
      smoothedChroma[i] = lerp(smoothedChroma[i], value, smoothing)
    }

    // RMS smoothing - more responsive for better sync
    const rmsFrame = Math.floor((frame / props.chromaData.nFrames) * props.rmsData.length)
    const currentRms = props.rmsData[rmsFrame] || 0
    smoothedRms.value = lerp(smoothedRms.value, currentRms, 0.4)

    // Band smoothing - increased responsiveness
    if (props.bandData) {
      const bandFrame = Math.floor((frame / props.chromaData.nFrames) * props.bandData.low.length)
      const currentLow = props.bandData.low[bandFrame] || 0
      const currentHigh = props.bandData.high[bandFrame] || 0
      smoothedLow.value = lerp(smoothedLow.value, currentLow, 0.4)
      smoothedHigh.value = lerp(smoothedHigh.value, currentHigh, 0.4)

      // Track peaks for ripple effects
      if (currentLow > 0.4 && Math.random() > 0.7) {
        peakHistory.push({ time: Date.now(), type: 'low' })
      }
      if (currentHigh > 0.3 && Math.random() > 0.7) {
        peakHistory.push({ time: Date.now(), type: 'high' })
      }
    }

    // Trigger radial burst on strong peaks
    if (currentRms > 0.5 && Math.random() > 0.6) {
      // Choose hue based on dominant frequency band
      const burstHue = smoothedLow.value > smoothedHigh.value ? DRUMS_HUE : MELODY_HUE
      spawnBurstParticles(currentRms, burstHue)
    }

    // Cleanup old peaks
    while (peakHistory.length > 0 && Date.now() - peakHistory[0].time > 1200) {
      peakHistory.shift()
    }

    // === FREQUENCY BAND VISUALIZATION (inner rings) ===
    const drumIntensity = Math.min(smoothedLow.value * 1.8, 1)
    const melodyIntensity = Math.min(smoothedHigh.value * 1.8, 1)

    // Drums ring (inner, left-biased arc)
    if (drumIntensity > 0.02) {
      const drumRadius = maxRadius * 0.32
      const drumArcStart = Math.PI * 0.6
      const drumArcEnd = Math.PI * 1.4

      // Outer glow
      ctx.save()
      ctx.filter = 'blur(12px)'
      ctx.beginPath()
      ctx.arc(centerX, centerY, drumRadius, drumArcStart, drumArcEnd)
      ctx.strokeStyle = hsl(DRUMS_HUE, 85, 55, drumIntensity * 0.5)
      ctx.lineWidth = 8 + drumIntensity * 16
      ctx.lineCap = 'round'
      ctx.stroke()
      ctx.restore()

      // Core arc
      ctx.beginPath()
      ctx.arc(centerX, centerY, drumRadius, drumArcStart, drumArcEnd)
      const drumGrad = ctx.createLinearGradient(
        centerX - drumRadius, centerY,
        centerX, centerY + drumRadius
      )
      drumGrad.addColorStop(0, hsl(DRUMS_HUE - 10, 90, 45, drumIntensity * 0.9))
      drumGrad.addColorStop(0.5, hsl(DRUMS_HUE, 95, 55, drumIntensity))
      drumGrad.addColorStop(1, hsl(DRUMS_HUE + 10, 85, 50, drumIntensity * 0.8))
      ctx.strokeStyle = drumGrad
      ctx.lineWidth = 5 + drumIntensity * 8
      ctx.lineCap = 'round'
      ctx.stroke()
    }

    // Melody ring (inner, right-biased arc)
    if (melodyIntensity > 0.02) {
      const melodyRadius = maxRadius * 0.32
      const melodyArcStart = -Math.PI * 0.4
      const melodyArcEnd = Math.PI * 0.4

      // Outer glow
      ctx.save()
      ctx.filter = 'blur(12px)'
      ctx.beginPath()
      ctx.arc(centerX, centerY, melodyRadius, melodyArcStart, melodyArcEnd)
      ctx.strokeStyle = hsl(MELODY_HUE, 80, 55, melodyIntensity * 0.5)
      ctx.lineWidth = 8 + melodyIntensity * 16
      ctx.lineCap = 'round'
      ctx.stroke()
      ctx.restore()

      // Core arc
      ctx.beginPath()
      ctx.arc(centerX, centerY, melodyRadius, melodyArcStart, melodyArcEnd)
      const melodyGrad = ctx.createLinearGradient(
        centerX + melodyRadius, centerY,
        centerX, centerY - melodyRadius
      )
      melodyGrad.addColorStop(0, hsl(MELODY_HUE - 15, 85, 50, melodyIntensity * 0.9))
      melodyGrad.addColorStop(0.5, hsl(MELODY_HUE, 90, 58, melodyIntensity))
      melodyGrad.addColorStop(1, hsl(MELODY_HUE + 15, 80, 55, melodyIntensity * 0.8))
      ctx.strokeStyle = melodyGrad
      ctx.lineWidth = 5 + melodyIntensity * 8
      ctx.lineCap = 'round'
      ctx.stroke()
    }

    // === CHROMA ARCS (outer ring) ===
    const arcAngle = (Math.PI * 2) / 12
    const arcGap = 0.025

    for (let i = 0; i < 12; i++) {
      const value = smoothedChroma[i]
      const color = noteColors[i]
      const startAngle = i * arcAngle - Math.PI / 2 + arcGap
      const endAngle = (i + 1) * arcAngle - Math.PI / 2 - arcGap

      if (value > 0.02) {
        // Glow layer
        ctx.save()
        ctx.filter = 'blur(8px)'
        ctx.beginPath()
        ctx.arc(centerX, centerY, maxRadius * 0.92, startAngle, endAngle)
        ctx.strokeStyle = hsl(color.h, color.s, color.l + 15, value * 0.4)
        ctx.lineWidth = 16 + value * 12
        ctx.lineCap = 'round'
        ctx.stroke()
        ctx.restore()

        // Main arc
        ctx.beginPath()
        ctx.arc(centerX, centerY, maxRadius * 0.92, startAngle, endAngle)
        ctx.strokeStyle = hsl(color.h, color.s, color.l + value * 15, 0.3 + value * 0.7)
        ctx.lineWidth = 10 + value * 10
        ctx.lineCap = 'round'
        ctx.stroke()

        // Inner radial bars
        const barAngle = (startAngle + endAngle) / 2
        const barLength = value * maxRadius * 0.35
        const innerStart = maxRadius * 0.50

        const x1 = centerX + Math.cos(barAngle) * innerStart
        const y1 = centerY + Math.sin(barAngle) * innerStart
        const x2 = centerX + Math.cos(barAngle) * (innerStart + barLength)
        const y2 = centerY + Math.sin(barAngle) * (innerStart + barLength)

        const barGrad = ctx.createLinearGradient(x1, y1, x2, y2)
        barGrad.addColorStop(0, hsl(color.h, color.s - 10, color.l - 10, 0.2))
        barGrad.addColorStop(1, hsl(color.h, color.s, color.l + 10, value * 0.9))

        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.strokeStyle = barGrad
        ctx.lineWidth = 3 + value * 3
        ctx.lineCap = 'round'
        ctx.stroke()
      }

      // Note labels (always visible, intensity varies)
      const labelRadius = maxRadius * 1.10
      const labelAngle = (startAngle + endAngle) / 2
      const labelX = centerX + Math.cos(labelAngle) * labelRadius
      const labelY = centerY + Math.sin(labelAngle) * labelRadius
      const labelAlpha = 0.25 + value * 0.75

      ctx.font = `${value > 0.35 ? '600' : '400'} 11px "IBM Plex Mono", monospace`
      ctx.fillStyle = hsl(color.h, color.s - 20, 65 + value * 25, labelAlpha)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(noteNames[i], labelX, labelY)
    }

    // === CENTER HUB ===
    const peakThreshold = 0.55
    const peakIntensity = smoothedRms.value > peakThreshold
      ? Math.min((smoothedRms.value - peakThreshold) / 0.45, 1)
      : 0

    const hubRadius = 22 + peakIntensity * 4

    // Hub glow (subtle purple instead of white)
    if (peakIntensity > 0.3) {
      ctx.save()
      ctx.filter = 'blur(12px)'
      ctx.beginPath()
      ctx.arc(centerX, centerY, hubRadius + 6, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(139, 92, 246, ${peakIntensity * 0.08})`
      ctx.fill()
      ctx.restore()
    }

    // Hub background
    const hubGrad = ctx.createRadialGradient(
      centerX, centerY, 0,
      centerX, centerY, hubRadius
    )
    hubGrad.addColorStop(0, `rgba(20, 25, 35, 0.95)`)
    hubGrad.addColorStop(0.7, `rgba(15, 18, 28, 0.95)`)
    hubGrad.addColorStop(1, `rgba(10, 12, 20, 0.9)`)

    ctx.beginPath()
    ctx.arc(centerX, centerY, hubRadius, 0, Math.PI * 2)
    ctx.fillStyle = hubGrad
    ctx.fill()

    // Hub border (subtle)
    ctx.beginPath()
    ctx.arc(centerX, centerY, hubRadius, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(139, 92, 246, ${0.15 + peakIntensity * 0.1})`
    ctx.lineWidth = 1
    ctx.stroke()

    // === SPIRAL PARTICLE BURST ===
    drawBurstParticles(centerX, centerY, maxRadius)

    // === SUBTLE RIPPLE EFFECTS (colored only, for low/high bands) ===
    const now = Date.now()
    for (const peak of peakHistory) {
      if (peak.type === 'peak') continue

      const age = (now - peak.time) / 1000
      if (age < 0.8) {
        const progress = age / 0.8
        const rippleRadius = maxRadius * 0.4 + progress * maxRadius * 0.4
        const alpha = (1 - progress) * 0.1

        let rippleColor = ''
        if (peak.type === 'low') {
          rippleColor = `hsla(${DRUMS_HUE}, 60%, 45%`
        } else if (peak.type === 'high') {
          rippleColor = `hsla(${MELODY_HUE}, 55%, 45%`
        }

        if (rippleColor) {
          ctx.beginPath()
          ctx.arc(centerX, centerY, rippleRadius, 0, Math.PI * 2)
          ctx.strokeStyle = `${rippleColor}, ${alpha})`
          ctx.lineWidth = 0.8 - progress * 0.4
          ctx.stroke()
        }
      }
    }

  } else {
    // === IDLE STATE ===
    for (let i = 0; i < 12; i++) {
      const color = noteColors[i]
      const arcAngle = (Math.PI * 2) / 12
      const startAngle = i * arcAngle - Math.PI / 2 + 0.025
      const endAngle = (i + 1) * arcAngle - Math.PI / 2 - 0.025
      const pulse = 0.08 + Math.sin(time * 1.5 + i * 0.52) * 0.04

      ctx.beginPath()
      ctx.arc(centerX, centerY, maxRadius * 0.92, startAngle, endAngle)
      ctx.strokeStyle = hsl(color.h, color.s - 20, color.l - 10, pulse)
      ctx.lineWidth = 6
      ctx.lineCap = 'round'
      ctx.stroke()
    }

    // Idle center
    const idlePulse = 0.5 + Math.sin(time * 2) * 0.1
    ctx.beginPath()
    ctx.arc(centerX, centerY, 20, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(15, 18, 28, 0.9)`
    ctx.fill()
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.05 * idlePulse})`
    ctx.lineWidth = 1
    ctx.stroke()
  }

  // Scan lines overlay (very subtle)
  drawScanLines(size)

  animationFrame = requestAnimationFrame(draw)
}

function setupCanvas() {
  if (!canvas.value) return

  const container = canvas.value.parentElement
  if (!container) return

  const size = Math.min(container.clientWidth, container.clientHeight, 520)
  canvasSize = size
  const dpr = window.devicePixelRatio || 1

  canvas.value.style.width = size + 'px'
  canvas.value.style.height = size + 'px'
  canvas.value.width = size * dpr
  canvas.value.height = size * dpr

  ctx = canvas.value.getContext('2d')
  if (ctx) {
    ctx.scale(dpr, dpr)
  }
}

function resetVisualizer() {
  // Clear smoothed values
  smoothedChroma.fill(0)
  smoothedRms.value = 0
  smoothedLow.value = 0
  smoothedHigh.value = 0

  // Clear particles and history
  burstParticles.length = 0
  peakHistory.length = 0
  lastBurstTime = 0
}

// Reset when playback stops
watch(() => props.isPlaying, (playing, wasPlaying) => {
  if (!playing && wasPlaying) {
    resetVisualizer()
  }
})

onMounted(() => {
  setupCanvas()
  draw()
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
  <div class="scope">
    <div class="scope__bezel">
      <div class="scope__screen">
        <canvas ref="canvas" class="scope__canvas"></canvas>
      </div>
      <div class="scope__indicators">
        <div class="scope__indicator scope__indicator--drums">
          <span class="scope__indicator-dot"></span>
          <span class="scope__indicator-label">LOW</span>
        </div>
        <div class="scope__indicator scope__indicator--melody">
          <span class="scope__indicator-dot"></span>
          <span class="scope__indicator-label">HIGH</span>
        </div>
      </div>
    </div>
    <div class="scope__footer">
      <span class="scope__model">CHROMA-12</span>
      <span class="scope__type">SPECTRAL ANALYZER</span>
    </div>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&display=swap');

.scope {
  --drums-color: hsl(28, 85%, 55%);
  --melody-color: hsl(190, 75%, 55%);
  --bezel-color: #080a0e;
  --screen-bg: #040608;
  --accent: rgba(139, 92, 246, 0.3);

  position: relative;
  width: 100%;
  max-width: 640px;
  margin: 0 auto;
  font-family: 'IBM Plex Mono', monospace;
}

.scope__bezel {
  position: relative;
  background: linear-gradient(145deg, #10131a 0%, var(--bezel-color) 50%, #060810 100%);
  border-radius: 16px;
  padding: 14px;
  border: 1px solid var(--accent);
  box-shadow:
    0 2px 0 rgba(255, 255, 255, 0.02) inset,
    0 -2px 0 rgba(0, 0, 0, 0.4) inset,
    0 20px 40px -10px rgba(0, 0, 0, 0.7),
    0 0 60px -10px rgba(139, 92, 246, 0.1);
}

.scope__screen {
  position: relative;
  background: var(--screen-bg);
  border-radius: 12px;
  overflow: hidden;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.8) inset,
    0 0 30px rgba(0, 0, 0, 0.5) inset,
    0 0 60px rgba(100, 180, 255, 0.02) inset;
}

.scope__screen::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 30% 20%, rgba(139, 92, 246, 0.008) 0%, transparent 50%);
  pointer-events: none;
  z-index: 10;
}

.scope__canvas {
  display: block;
}

.scope__indicators {
  position: absolute;
  top: 24px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 24px;
  z-index: 20;
}

.scope__indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 4px;
  backdrop-filter: blur(4px);
}

.scope__indicator-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  animation: pulse 2s ease-in-out infinite;
}

.scope__indicator--drums .scope__indicator-dot {
  background: var(--drums-color);
  box-shadow: 0 0 8px var(--drums-color);
}

.scope__indicator--melody .scope__indicator-dot {
  background: var(--melody-color);
  box-shadow: 0 0 8px var(--melody-color);
  animation-delay: 0.5s;
}

.scope__indicator-label {
  font-size: 9px;
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.scope__indicator--drums .scope__indicator-label {
  color: var(--drums-color);
}

.scope__indicator--melody .scope__indicator-label {
  color: var(--melody-color);
}

.scope__footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 8px 0;
}

.scope__model {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.15em;
  color: rgba(255, 255, 255, 0.5);
}

.scope__type {
  font-size: 9px;
  font-weight: 400;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.25);
  text-transform: uppercase;
}

@keyframes pulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}

@media (max-width: 680px) {
  .scope {
    max-width: 480px;
  }
}

@media (max-width: 520px) {
  .scope {
    max-width: 380px;
  }

  .scope__bezel {
    padding: 12px;
    border-radius: 14px;
  }

  .scope__indicators {
    gap: 16px;
    top: 18px;
  }

  .scope__indicator {
    padding: 3px 8px;
  }

  .scope__indicator-label {
    font-size: 8px;
  }
}

@media (max-width: 400px) {
  .scope {
    max-width: 300px;
  }
}
</style>
