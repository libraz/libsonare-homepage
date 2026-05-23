<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from '@/composables/useI18n'

type WaveAudio = {
  left: Float32Array
  right: Float32Array
  sampleRate: number
  duration?: number
  channels?: number
  fileName?: string
}

const props = defineProps<{
  audio: WaveAudio | null
  /** Optional second buffer shown as a ghost outline behind `audio`. Both are normalized to the shared max so loudness changes are visible. */
  compare?: WaveAudio | null
  /** Optional label for source / master overlay context */
  variant?: 'source' | 'master'
  /** Drawing area height in px */
  height?: number
}>()

const { t } = useI18n()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const bodyRef = ref<HTMLElement | null>(null)

let primaryPeaks: Float32Array | null = null
let comparePeaks: Float32Array | null = null
let cachedPrimary: WaveAudio | null = null
let cachedCompare: WaveAudio | null = null
let cachedSamplesPerPx = 0
let rafId: number | null = null
let resizeObserver: ResizeObserver | null = null
let themeObserver: MutationObserver | null = null

const drawHeight = computed(() => props.height ?? 132)

const variantLabel = computed(() => {
  if (props.compare) return props.variant === 'master' ? 'A/B · MASTER' : 'A/B · SOURCE'
  return props.variant === 'master' ? 'MASTER · DT' : 'SOURCE · DT'
})

const titleLabel = computed(() => {
  const a = props.audio
  if (!a) return t('master.studio.waveformIdle')
  if (a.fileName) return a.fileName
  return props.variant === 'master' ? 'Master render' : 'Source'
})

const durationLabel = computed(() => {
  const a = props.audio
  if (!a) return '--:--'
  const total = Number.isFinite(a.duration) && a.duration != null
    ? a.duration
    : a.left.length / a.sampleRate
  if (!Number.isFinite(total) || total <= 0) return '--:--'
  const m = Math.floor(total / 60)
  const s = Math.floor(total % 60).toString().padStart(2, '0')
  return `${m}:${s}`
})

const subReadout = computed(() => {
  const a = props.audio
  if (!a) return '—'
  const sr = a.sampleRate / 1000
  const ch = a.channels != null
    ? (a.channels === 1 ? 'MONO' : a.channels === 2 ? 'STEREO' : `${a.channels}CH`)
    : (a.right && a.right !== a.left ? 'STEREO' : 'MONO')
  const rate = Number.isInteger(sr) ? `${sr.toFixed(0)}k` : `${sr.toFixed(1)}k`
  return `${rate} · ${ch}`
})

function computePeaksRaw(buf: WaveAudio, samplesPerPx: number): { peaks: Float32Array; max: number } {
  const len = Math.min(buf.left.length, buf.right.length || buf.left.length)
  const totalPixels = Math.ceil(len / samplesPerPx)
  const peaks = new Float32Array(totalPixels * 2)
  let globalMax = 0
  for (let i = 0; i < totalPixels; i++) {
    const start = i * samplesPerPx
    const end = Math.min(start + samplesPerPx, len)
    let min = 1
    let max = -1
    for (let j = start; j < end; j++) {
      const r = buf.right ? buf.right[j] : buf.left[j]
      const v = (buf.left[j] + (r ?? buf.left[j])) * 0.5
      if (v < min) min = v
      if (v > max) max = v
    }
    peaks[i * 2] = min
    peaks[i * 2 + 1] = max
    const absMax = Math.max(Math.abs(min), Math.abs(max))
    if (absMax > globalMax) globalMax = absMax
  }
  return { peaks, max: globalMax }
}

function applyScale(peaks: Float32Array, scale: number): void {
  for (let i = 0; i < peaks.length; i++) peaks[i] *= scale
}

function draw() {
  const canvas = canvasRef.value
  const body = bodyRef.value
  if (!canvas || !body) return
  const w = Math.floor(body.clientWidth)
  const h = drawHeight.value
  if (w <= 0) return

  const dpr = window.devicePixelRatio || 1
  canvas.width = w * dpr
  canvas.height = h * dpr
  canvas.style.width = `${w}px`
  canvas.style.height = `${h}px`

  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, w, h)

  const cs = getComputedStyle(body)
  const fillColor = cs.getPropertyValue('--wave-fill').trim() || 'rgba(139, 92, 246, 0.32)'
  const lineColor = cs.getPropertyValue('--wave-line').trim() || 'rgba(139, 92, 246, 0.2)'
  const compareColor = cs.getPropertyValue('--wave-compare').trim() || 'rgba(148, 163, 184, 0.5)'
  const placeholderColor = cs.getPropertyValue('--wave-placeholder').trim() || 'rgba(255, 255, 255, 0.22)'

  const mid = h / 2

  // Center axis
  ctx.strokeStyle = lineColor
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, mid)
  ctx.lineTo(w, mid)
  ctx.stroke()

  if (!props.audio) {
    ctx.fillStyle = placeholderColor
    ctx.font = '600 9px "JetBrains Mono", ui-monospace, monospace'
    ctx.letterSpacing = '0.16em' as unknown as string
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('NO AUDIO LOADED', w / 2, mid + 2)
    return
  }

  const samplesPerPx = Math.max(1, Math.floor(props.audio.left.length / w))
  const compareSamplesPerPx = props.compare
    ? Math.max(1, Math.floor(props.compare.left.length / w))
    : 0
  const needRecompute =
    cachedPrimary !== props.audio ||
    cachedCompare !== (props.compare ?? null) ||
    cachedSamplesPerPx !== samplesPerPx
  if (needRecompute) {
    const primary = computePeaksRaw(props.audio, samplesPerPx)
    const secondary = props.compare ? computePeaksRaw(props.compare, compareSamplesPerPx) : null
    const sharedMax = Math.max(primary.max, secondary?.max ?? 0) || 1
    const scale = 1 / sharedMax
    applyScale(primary.peaks, scale)
    if (secondary) applyScale(secondary.peaks, scale)
    primaryPeaks = primary.peaks
    comparePeaks = secondary?.peaks ?? null
    cachedPrimary = props.audio
    cachedCompare = props.compare ?? null
    cachedSamplesPerPx = samplesPerPx
  }
  if (!primaryPeaks) return

  // Ghost: draw compare buffer first (hollow outline)
  if (comparePeaks) {
    const cmpCols = Math.min(w, comparePeaks.length / 2)
    ctx.fillStyle = compareColor
    ctx.beginPath()
    for (let i = 0; i < cmpCols; i++) {
      const min = comparePeaks[i * 2]
      const max = comparePeaks[i * 2 + 1]
      const y1 = mid - max * mid
      const y2 = mid - min * mid
      ctx.rect(i, y1, 1, Math.max(1, y2 - y1))
    }
    ctx.fill()
  }

  // Primary on top
  const cols = Math.min(w, primaryPeaks.length / 2)
  ctx.fillStyle = fillColor
  ctx.beginPath()
  for (let i = 0; i < cols; i++) {
    const min = primaryPeaks[i * 2]
    const max = primaryPeaks[i * 2 + 1]
    const y1 = mid - max * mid
    const y2 = mid - min * mid
    ctx.rect(i, y1, 1, Math.max(1, y2 - y1))
  }
  ctx.fill()
}

function requestDraw() {
  if (rafId !== null) return
  rafId = requestAnimationFrame(() => {
    rafId = null
    draw()
  })
}

watch(() => [props.audio, props.compare, props.height, props.variant], requestDraw, { deep: false })

onMounted(() => {
  requestDraw()
  if (bodyRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => requestDraw())
    resizeObserver.observe(bodyRef.value)
  }
  if (typeof MutationObserver !== 'undefined') {
    themeObserver = new MutationObserver(() => requestDraw())
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  }
})

onBeforeUnmount(() => {
  if (rafId !== null) cancelAnimationFrame(rafId)
  resizeObserver?.disconnect()
  themeObserver?.disconnect()
})
</script>

<template>
  <div class="wave-panel" :class="`wave-panel--${variant || 'source'}`">
    <header class="wave-panel__head">
      <div class="wave-panel__id">
        <span class="wave-panel__dot" :class="{ 'wave-panel__dot--on': !!audio }" aria-hidden="true"></span>
        <span class="wave-panel__title" :title="titleLabel">{{ titleLabel }}</span>
      </div>
      <div class="wave-panel__time">
        <strong>{{ durationLabel }}</strong>
        <em>{{ subReadout }}</em>
      </div>
      <span v-if="compare" class="wave-panel__legend" aria-hidden="true">
        <span class="wave-panel__swatch wave-panel__swatch--compare"></span>SRC
        <span class="wave-panel__swatch wave-panel__swatch--primary"></span>{{ variant === 'master' ? 'MST' : 'PRI' }}
      </span>
      <span class="wave-panel__mode">{{ variantLabel }}</span>
    </header>
    <div ref="bodyRef" class="wave-panel__body">
      <canvas ref="canvasRef" class="wave-panel__canvas"></canvas>
      <div class="wave-panel__grid" aria-hidden="true">
        <span v-for="i in 7" :key="i"></span>
      </div>
      <div class="wave-panel__edge" aria-hidden="true"></div>
    </div>
  </div>
</template>

<style scoped>
.wave-panel {
  --wave-fill: rgba(167, 139, 250, 0.55);
  --wave-line: rgba(139, 92, 246, 0.28);
  --wave-compare: rgba(148, 163, 184, 0.32);
  --wave-placeholder: rgba(255, 255, 255, 0.22);

  display: grid;
  grid-template-rows: auto 1fr;
  border: 1px solid var(--demo-border);
  border-radius: 8px;
  background: var(--master-scope-bg);
  overflow: hidden;
  font-family: 'JetBrains Mono', monospace;
}

html:not(.dark) .wave-panel {
  --wave-fill: rgba(124, 58, 237, 0.5);
  --wave-line: rgba(124, 58, 237, 0.22);
  --wave-compare: rgba(71, 85, 105, 0.28);
  --wave-placeholder: rgba(0, 0, 0, 0.28);
}

.wave-panel__head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto auto;
  align-items: center;
  gap: 12px;
  height: 32px;
  padding: 0 12px;
  background: var(--demo-bg-elevated);
  border-bottom: 1px solid var(--demo-border);
  position: relative;
}

.wave-panel__legend {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--demo-text-muted);
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.14em;
}

.wave-panel__swatch {
  display: inline-block;
  width: 10px;
  height: 3px;
  border-radius: 2px;
  margin-right: 2px;
}

.wave-panel__swatch--compare {
  background: var(--wave-compare);
}

.wave-panel__swatch--primary {
  background: var(--wave-fill);
}

.wave-panel__head::after {
  content: '';
  position: absolute;
  inset: auto 0 -1px 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--demo-accent-border), transparent);
  opacity: 0.45;
}

.wave-panel__id {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.wave-panel__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 1px solid var(--demo-border-strong);
  background: var(--master-code-bg);
  flex-shrink: 0;
  transition: background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}

.wave-panel__dot--on {
  background: var(--demo-accent);
  border-color: var(--demo-accent);
  box-shadow: 0 0 6px color-mix(in srgb, var(--demo-accent) 70%, transparent);
}

.wave-panel__title {
  color: var(--demo-text-strong);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wave-panel__time {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  flex-shrink: 0;
}

.wave-panel__time strong {
  color: var(--demo-text-strong);
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
}

.wave-panel__time em {
  color: var(--demo-text-muted);
  font-size: 9px;
  font-style: normal;
  font-weight: 600;
  letter-spacing: 0.08em;
}

.wave-panel__mode {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  border: 1px solid var(--demo-border);
  border-radius: 4px;
  background: var(--master-code-bg);
  color: var(--demo-cyan);
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 0.22em;
}

.wave-panel__body {
  position: relative;
  height: 132px;
  background:
    radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--demo-accent) 6%, transparent), transparent 70%);
}

.wave-panel__canvas {
  display: block;
  width: 100%;
  height: 100%;
  position: relative;
  z-index: 1;
}

.wave-panel__grid {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  pointer-events: none;
  z-index: 0;
}

.wave-panel__grid span {
  border-left: 1px dashed var(--demo-border);
  opacity: 0.4;
}

.wave-panel__grid span:first-child {
  border-left: 0;
}

.wave-panel__edge {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--demo-accent-border), transparent);
  opacity: 0.35;
  pointer-events: none;
  z-index: 2;
}
</style>
