<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from '@/composables/useI18n'
import {
  defaultModuleSettings,
  type DecodedMasteringAudio,
  type MasteringModuleSettings,
  type MasteringPlatformId,
  type MasteringPresetId,
  useMastering,
} from '@/composables/useMastering'
import { useTheme } from '@/composables/useTheme'
import { CornerBrackets, GridOverlay, MetricItem, ScanLine, StatusIndicator, TechPanel, Tooltip } from '@/components/ui'
import MasterKnob from '@/components/MasterKnob.vue'
import MasteringWaveform from '@/components/MasteringWaveform.vue'

type Mode = 'quick' | 'studio'
type ModuleSettingKey = keyof MasteringModuleSettings
type MasteringSessionSettings = {
  mode: Mode
  selectedPreset: MasteringPresetId
  selectedPlatform: MasteringPlatformId
  customLufs: number
  tone: number
  width: number
  dynamics: number
  showFineTune: boolean
  activeModule: string
  loudnessMatched: boolean
  moduleSettings: MasteringModuleSettings
}

const sessionStorageKey = 'libsonare-mastering-session-v1'
const chainPresetStorageKey = 'libsonare-mastering-chain-preset-v1'
let urlModeSyncReady = false
let applyingModeFromHistory = false

const { t, locale } = useI18n()
const mastering = useMastering()
const { isDark, toggle: toggleTheme } = useTheme()

const libVersion = ref<string>('')
const homePath = computed(() => (locale.value === 'ja' ? '/ja/' : '/'))
const analyzerPath = computed(() => (locale.value === 'ja' ? '/ja/analyzer' : '/analyzer'))
const docsPath = computed(() => (locale.value === 'ja' ? '/ja/docs/glossary/mastering' : '/docs/glossary/mastering'))
const glossaryBasePath = computed(() => (locale.value === 'ja' ? '/ja/docs/glossary' : '/docs/glossary'))
const otherLocalePath = computed(() => (locale.value === 'ja' ? '/mastering' : '/ja/mastering'))
const otherLocaleLabel = computed(() => (locale.value === 'ja' ? 'EN' : 'JA'))

function switchLocale(event: Event) {
  event.preventDefault()
  event.stopPropagation()
  if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation()
  if (typeof window === 'undefined') return
  window.location.assign(otherLocalePath.value)
}

const mode = ref<Mode>('quick')
const selectedPreset = ref<MasteringPresetId>('pop')
const selectedPlatform = ref<MasteringPlatformId>('youtube')
const customLufs = ref(-14)
const tone = ref(50)
const width = ref(50)
const dynamics = ref(50)
const showFineTune = ref(false)
const activeModule = ref('input')
const sourceUrl = ref<string | null>(null)
const outputUrl = ref<string | null>(null)
const reportUrl = ref<string | null>(null)
const chainSettingsUrl = ref<string | null>(null)
const localError = ref<string | null>(null)
const audioElement = ref<HTMLAudioElement | null>(null)
const listenTarget = ref<'source' | 'master'>('master')
const loudnessMatched = ref(true)
const showIntroModal = ref(false)
const reference = ref<DecodedMasteringAudio | null>(null)
const referenceUrl = ref<string | null>(null)
const moduleSettings = ref<MasteringModuleSettings>(defaultModuleSettings())
const chainDefaults = defaultModuleSettings()

const presets: Array<{ id: MasteringPresetId; icon: string }> = [
  { id: 'pop', icon: 'POP' },
  { id: 'edm', icon: 'EDM' },
  { id: 'acoustic', icon: 'AC' },
  { id: 'hiphop', icon: 'HH' },
  { id: 'aiMusic', icon: 'AI' },
  { id: 'speech', icon: 'VO' },
]

const platforms: Array<{ id: MasteringPlatformId; lufs: number }> = [
  { id: 'spotify', lufs: -14 },
  { id: 'youtube', lufs: -14 },
  { id: 'apple', lufs: -16 },
  { id: 'tiktok', lufs: -16 },
  { id: 'custom', lufs: -14 },
]

const modules = [
  'input',
  'repair',
  'eq',
  'dynamics',
  'multiband',
  'exciter',
  'stereo',
  'limiter',
  'loudness',
  'output',
]

const activeStage = computed(() => modules.indexOf(activeModule.value) + 1)
const totalStages = computed(() => modules.length)

const LED_SEGMENTS = 48
const LED_PEAK_SEGMENTS = 5 // top ~10% lights amber when active
const LED_MAJOR_EVERY = 12 // tick every quarter (25/50/75/100%)

function ledClass(percent: number, index: number, total: number): Record<string, boolean> {
  const fraction = (index / total) * 100
  const on = fraction <= percent
  const peakBand = index > total - LED_PEAK_SEGMENTS
  const majorTick = index % LED_MAJOR_EVERY === 0
  return {
    'led-meter__seg--on': on,
    'led-meter__seg--peak': on && peakBand,
    'led-meter__seg--major': majorTick,
  }
}

const meterTargets: Record<string, string> = {
  lufs: 'loudness',
  peak: 'limiter',
  crest: 'dynamics',
  correlation: 'stereo',
}

function jumpToModule(moduleId: string | undefined) {
  if (!moduleId) return
  if (modules.includes(moduleId)) activeModule.value = moduleId
}

const parameterGuideSlugs: Partial<Record<ModuleSettingKey | 'tone' | 'width' | 'dynamics', string>> = {
  tone: 'mastering/tone-air#tilt-eq',
  width: 'mastering/stereo-limiter-loudness#stereo-width',
  dynamics: 'mastering/dynamics#threshold-ratio-attack-release-knee',
  inputGainDb: 'mastering/repair#input-gain',
  tiltDb: 'mastering/tone-air#tilt-eq',
  compressorThresholdDb: 'mastering/dynamics#threshold-ratio-attack-release-knee',
  compressorRatio: 'mastering/dynamics#threshold-ratio-attack-release-knee',
  compressorAttackMs: 'mastering/dynamics#attack-and-release',
  compressorReleaseMs: 'mastering/dynamics#attack-and-release',
  deesserAmount: 'mastering/dynamics',
  transientAttackDb: 'mastering/dynamics',
  multibandLowAmount: 'mastering/dynamics',
  multibandMidAmount: 'mastering/dynamics',
  multibandHighAmount: 'mastering/dynamics',
  denoiseAmount: 'mastering/repair#denoise-amount',
  declickAmount: 'mastering/repair',
  dereverbAmount: 'mastering/repair',
  tapeDriveDb: 'mastering/tone-air',
  tapeSaturation: 'mastering/tone-air',
  exciterAmount: 'mastering/tone-air#exciter-amount',
  airBandAmount: 'mastering/tone-air#air-band-amount',
  stereoWidth: 'mastering/stereo-limiter-loudness#stereo-width',
  monoMakerAmount: 'mastering/stereo-limiter-loudness#stereo-width',
  limiterCeilingDb: 'mastering/stereo-limiter-loudness#limiter-ceiling',
  limiterLookaheadMs: 'mastering/stereo-limiter-loudness#lookahead-and-true-peak-safety',
}

const moduleGuideSlugs: Record<string, string> = {
  input: 'mastering/repair#input-gain',
  repair: 'mastering/repair',
  eq: 'mastering/tone-air#tilt-eq',
  dynamics: 'mastering/dynamics',
  multiband: 'mastering/dynamics',
  exciter: 'mastering/tone-air',
  stereo: 'mastering/stereo-limiter-loudness#stereo-width',
  limiter: 'mastering/stereo-limiter-loudness#true-peak-limiter',
  loudness: 'mastering/stereo-limiter-loudness#loudness-target',
  output: 'mastering/stereo-limiter-loudness#output-render',
}

const targetLufs = computed(() => (
  selectedPlatform.value === 'custom'
    ? customLufs.value
    : platforms.find((platform) => platform.id === selectedPlatform.value)?.lufs ?? -14
))

function formatStageLabel(stage: string): string {
  if (!stage) return ''
  switch (stage) {
    case 'Queued': return t('master.renderStages.queued')
    case 'Preparing audio buffers': return t('master.renderStages.preparing')
    case 'Loading libsonare WASM': return t('master.renderStages.loadingWasm')
    case 'Running mastering chain': return t('master.renderStages.runningChain')
    case 'Finalizing render': return t('master.renderStages.finalizing')
    case 'Complete': return t('master.renderStages.complete')
  }
  if (stage.startsWith('match.applyMatchEq')) {
    return stage.endsWith('right')
      ? t('master.renderStages.matchEqRight')
      : t('master.renderStages.matchEqLeft')
  }
  // WASM emits dotted stage IDs like "eq.tilt", "dynamics.compressor" — pretty-print
  if (stage.includes('.')) {
    return stage
      .split('.')
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(' · ')
  }
  return stage
}

const renderStageLabel = computed(() => formatStageLabel(mastering.renderStage.value))

const renderResultStages = computed(() => {
  const stages = mastering.rendered.value?.stages
  if (!stages?.length) return ''
  return stages.map(formatStageLabel).join(' / ')
})

const resultWaveAudio = computed(() => {
  const rendered = mastering.rendered.value
  const source = mastering.source.value
  if (listenTarget.value === 'master' && rendered) return rendered
  return source ?? rendered
})

const resultWaveCompare = computed(() => {
  const rendered = mastering.rendered.value
  const source = mastering.source.value
  if (!rendered || !source) return null
  return listenTarget.value === 'master' ? source : rendered
})

const resultWaveVariant = computed<'source' | 'master'>(() =>
  listenTarget.value === 'master' && mastering.rendered.value ? 'master' : 'source',
)

function docHref(slug: string | null | undefined): string | undefined {
  if (!slug) return undefined
  return `${glossaryBasePath.value}/${slug}`
}

function moduleNameOf(stageId: string | null | undefined): string {
  if (!stageId) return ''
  return t(`master.modules.${stageId}.name`)
}

function resetActiveModule() {
  const controls = moduleControls.value
  if (!controls.length) return
  const next: MasteringModuleSettings = { ...moduleSettings.value }
  for (const control of controls) {
    next[control.key] = chainDefaults[control.key]
  }
  moduleSettings.value = next
}

const canResetActiveModule = computed(() => {
  const controls = moduleControls.value
  if (!controls.length) return false
  return controls.some((control) => moduleSettings.value[control.key] !== chainDefaults[control.key])
})

const statusLabel = computed(() => {
  if (mastering.isRendering.value) return t('master.status.rendering')
  if (mastering.rendered.value) return t('master.status.ready')
  if (mastering.source.value) return t('master.status.loaded')
  return t('master.status.idle')
})

const statusVariant = computed<'idle' | 'active' | 'warning'>(() => {
  if (mastering.isRendering.value) return 'warning'
  if (mastering.source.value) return 'active'
  return 'idle'
})

const statusBarFile = computed(() => mastering.source.value?.fileName || '—')
const statusBarDuration = computed(() => (
  mastering.source.value ? formatDuration(mastering.source.value.duration) : '—:——'
))
const statusBarRate = computed(() => {
  const sr = mastering.source.value?.sampleRate
  if (!sr) return '—'
  const k = sr / 1000
  return `${Number.isInteger(k) ? k.toFixed(0) : k.toFixed(1)}k`
})
const statusBarChannels = computed(() => {
  const ch = mastering.source.value?.channels
  if (ch === 1) return 'MONO'
  if (ch === 2) return 'STEREO'
  return '—'
})
const statusBarTarget = computed(() => {
  const platform = selectedPlatform.value
  const label = platform === 'custom' ? 'CUSTOM' : t(`master.platforms.${platform}`).toUpperCase()
  return `${label} · ${targetLufs.value.toFixed(1)} LUFS`
})
const statusBarLoudness = computed(() => {
  const r = mastering.rendered.value
  if (!r) return '—'
  return `${r.inputLufs.toFixed(1)} → ${r.outputLufs.toFixed(1)}`
})
const statusBarGain = computed(() => {
  const r = mastering.rendered.value
  if (!r) return '—'
  const sign = r.appliedGainDb >= 0 ? '+' : ''
  return `${sign}${r.appliedGainDb.toFixed(1)} dB`
})

const canRender = computed(() => Boolean(mastering.source.value) && !mastering.isRendering.value)
const playbackUrl = computed(() => {
  if (listenTarget.value === 'source') return sourceUrl.value
  return outputUrl.value || sourceUrl.value
})

const moduleControls = computed<Array<{
  key: ModuleSettingKey
  min: number
  max: number
  step: number
  unit: string
}>>(() => {
  switch (activeModule.value) {
    case 'input':
      return [{ key: 'inputGainDb', min: -12, max: 12, step: 0.5, unit: 'dB' }]
    case 'repair':
      return [
        { key: 'denoiseAmount', min: 0, max: 1, step: 0.01, unit: '' },
        { key: 'declickAmount', min: 0, max: 1, step: 0.01, unit: '' },
        { key: 'dereverbAmount', min: 0, max: 1, step: 0.01, unit: '' },
      ]
    case 'eq':
      return [{ key: 'tiltDb', min: -6, max: 6, step: 0.25, unit: 'dB' }]
    case 'dynamics':
      return [
        { key: 'compressorThresholdDb', min: -36, max: -6, step: 0.5, unit: 'dB' },
        { key: 'compressorRatio', min: 1, max: 6, step: 0.1, unit: 'x' },
        { key: 'compressorAttackMs', min: 1, max: 80, step: 1, unit: 'ms' },
        { key: 'compressorReleaseMs', min: 40, max: 500, step: 5, unit: 'ms' },
        { key: 'deesserAmount', min: 0, max: 1, step: 0.01, unit: '' },
        { key: 'transientAttackDb', min: -6, max: 6, step: 0.25, unit: 'dB' },
      ]
    case 'multiband':
      return [
        { key: 'multibandLowAmount', min: 0, max: 1, step: 0.01, unit: '' },
        { key: 'multibandMidAmount', min: 0, max: 1, step: 0.01, unit: '' },
        { key: 'multibandHighAmount', min: 0, max: 1, step: 0.01, unit: '' },
      ]
    case 'exciter':
      return [
        { key: 'tapeDriveDb', min: 0, max: 8, step: 0.25, unit: 'dB' },
        { key: 'tapeSaturation', min: 0, max: 1, step: 0.01, unit: '' },
        { key: 'exciterAmount', min: 0, max: 0.8, step: 0.01, unit: '' },
        { key: 'airBandAmount', min: 0, max: 1, step: 0.01, unit: '' },
      ]
    case 'stereo':
      return [
        { key: 'stereoWidth', min: 0.6, max: 1.6, step: 0.01, unit: 'x' },
        { key: 'monoMakerAmount', min: 0, max: 1, step: 0.01, unit: '' },
      ]
    case 'limiter':
      return [
        { key: 'limiterCeilingDb', min: -3, max: -0.1, step: 0.1, unit: 'dBTP' },
        { key: 'limiterLookaheadMs', min: 1, max: 20, step: 0.5, unit: 'ms' },
      ]
    case 'loudness':
      return []
    default:
      return []
  }
})

const sourceMetrics = computed(() => {
  const audio = mastering.source.value
  if (!audio) return null
  const stats = analyzeSignal(audio.left, audio.right)
  return {
    duration: formatDuration(audio.duration),
    sampleRate: `${Math.round(audio.sampleRate / 1000)} kHz`,
    channels: audio.channels === 1 ? 'Mono' : 'Stereo',
    peak: `${stats.peakDb.toFixed(1)} dBFS`,
    rms: `${stats.rmsDb.toFixed(1)} dBFS`,
    crest: `${stats.crestDb.toFixed(1)} dB`,
    correlation: stats.correlation.toFixed(2),
  }
})

const masterMetrics = computed(() => {
  const audio = mastering.rendered.value
  if (!audio) return null
  const stats = analyzeSignal(audio.left, audio.right)
  return {
    peak: `${stats.peakDb.toFixed(1)} dBFS`,
    rms: `${stats.rmsDb.toFixed(1)} dBFS`,
    crest: `${stats.crestDb.toFixed(1)} dB`,
    correlation: stats.correlation.toFixed(2),
  }
})

const referenceMetrics = computed(() => {
  const audio = reference.value
  if (!audio) return null
  const stats = analyzeSignal(audio.left, audio.right)
  return {
    fileName: audio.fileName,
    duration: formatDuration(audio.duration),
    peak: `${stats.peakDb.toFixed(1)} dBFS`,
    rms: `${stats.rmsDb.toFixed(1)} dBFS`,
    crest: `${stats.crestDb.toFixed(1)} dB`,
    correlation: stats.correlation.toFixed(2),
  }
})

const meterReadings = computed(() => {
  const rendered = mastering.rendered.value
  const outputLufs = rendered?.outputLufs ?? targetLufs.value
  const peakValue = Number.parseFloat((masterMetrics.value?.peak || sourceMetrics.value?.peak || '-60').replace(' dBFS', ''))
  const crestValue = Number.parseFloat((masterMetrics.value?.crest || sourceMetrics.value?.crest || '0').replace(' dB', ''))
  const corrValue = Number.parseFloat(masterMetrics.value?.correlation || sourceMetrics.value?.correlation || '0')

  return [
    {
      id: 'lufs',
      label: t('master.meters.outputLufs'),
      value: `${outputLufs.toFixed(1)} LUFS`,
      percent: normalizeRange(outputLufs, -24, -8),
    },
    {
      id: 'peak',
      label: t('master.meters.peak'),
      value: `${peakValue.toFixed(1)} dBFS`,
      percent: normalizeRange(peakValue, -24, 0),
    },
    {
      id: 'crest',
      label: t('master.meters.crest'),
      value: `${crestValue.toFixed(1)} dB`,
      percent: normalizeRange(crestValue, 4, 18),
    },
    {
      id: 'correlation',
      label: t('master.meters.correlation'),
      value: corrValue.toFixed(2),
      percent: normalizeRange(corrValue, -1, 1),
    },
  ]
})

const phasePoints = computed(() => {
  const audio = mastering.rendered.value || mastering.source.value
  if (!audio) return []

  const points: Array<{ x: number; y: number; opacity: number }> = []
  const stride = Math.max(1, Math.floor(audio.left.length / 96))
  for (let i = 0; i < audio.left.length && points.length < 96; i += stride) {
    const left = audio.left[i]
    const right = audio.right[i] ?? left
    points.push({
      x: 50 + Math.max(-1, Math.min(1, (left - right) * 0.75)) * 44,
      y: 50 - Math.max(-1, Math.min(1, (left + right) * 0.5)) * 44,
      opacity: 0.28 + Math.min(0.7, Math.abs(left) + Math.abs(right)),
    })
  }
  return points
})

const stereoImage = computed(() => {
  const correlation = Number.parseFloat(masterMetrics.value?.correlation || sourceMetrics.value?.correlation || '0')
  return {
    width: `${Math.max(12, Math.min(100, (1 - correlation) * 50 + 22))}%`,
    label: correlation > 0.85 ? t('master.meters.stereoNarrow') : correlation > 0.25 ? t('master.meters.stereoBalanced') : t('master.meters.stereoWide'),
  }
})

watch([listenTarget, loudnessMatched, () => mastering.rendered.value], () => {
  void nextTick(updatePlaybackVolume)
})

watch([
  mode,
  selectedPreset,
  selectedPlatform,
  customLufs,
  tone,
  width,
  dynamics,
  showFineTune,
  activeModule,
  loudnessMatched,
  moduleSettings,
], saveSession, { deep: true })

watch(mode, (value) => {
  if (!urlModeSyncReady || applyingModeFromHistory || typeof window === 'undefined') return
  writeModeToUrl(value, 'push')
})

async function loadLibVersion() {
  if (typeof window === 'undefined' || libVersion.value) return
  try {
    const wasm = await import('@/wasm/index.js')
    await wasm.init()
    libVersion.value = wasm.version()
  } catch (e) {
    console.warn('Failed to read WASM version:', e)
  }
}

onMounted(() => {
  if (typeof window === 'undefined') return
  restoreSession()
  applyModeFromUrl()
  writeModeToUrl(mode.value, 'replace')
  urlModeSyncReady = true
  window.addEventListener('popstate', handlePopState)
  window.addEventListener('keydown', handleKeyboardShortcuts)
  showIntroModal.value = localStorage.getItem('libsonare-mastering-intro-seen') !== '1'

  const ric = (window as any).requestIdleCallback
  if (ric) {
    ric(loadLibVersion, { timeout: 2000 })
  } else {
    setTimeout(loadLibVersion, 100)
  }
})

function readModeFromUrl(): Mode | null {
  const value = new URLSearchParams(window.location.search).get('mode')
  return value === 'studio' || value === 'quick' ? value : null
}

function applyModeFromUrl() {
  const urlMode = readModeFromUrl()
  if (!urlMode) return
  setModeFromUrl(urlMode)
}

function writeModeToUrl(value: Mode, method: 'push' | 'replace') {
  const url = new URL(window.location.href)
  if (value === 'quick') {
    url.searchParams.delete('mode')
  } else {
    url.searchParams.set('mode', value)
  }
  const nextUrl = `${url.pathname}${url.search}${url.hash}`
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`
  if (nextUrl === currentUrl) return
  const state = { ...(window.history.state || {}), masteringMode: value }
  if (method === 'push') {
    window.history.pushState(state, '', nextUrl)
  } else {
    window.history.replaceState(state, '', nextUrl)
  }
}

function handlePopState() {
  setModeFromUrl(readModeFromUrl() || 'quick')
}

function setModeFromUrl(nextMode: Mode) {
  applyingModeFromHistory = true
  mode.value = nextMode
  void nextTick(() => {
    applyingModeFromHistory = false
  })
}

function handleKeyboardShortcuts(event: KeyboardEvent) {
  if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return

  const key = event.key.toLowerCase()
  if (key === 'a' && sourceUrl.value) {
    listenTarget.value = 'source'
    return
  }
  if (key === 'b' && outputUrl.value) {
    listenTarget.value = 'master'
    return
  }
  if (event.key === ' ' && playbackUrl.value && audioElement.value) {
    event.preventDefault()
    if (audioElement.value.paused) {
      void audioElement.value.play()
    } else {
      audioElement.value.pause()
    }
    return
  }
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

async function handleFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  await loadFile(file)
  input.value = ''
}

async function handleDrop(event: DragEvent) {
  event.preventDefault()
  const file = event.dataTransfer?.files?.[0]
  if (file) {
    await loadFile(file)
  }
}

async function loadFile(file: File) {
  localError.value = null
  releaseUrls()
  try {
    const loaded = await mastering.loadFile(file)
    sourceUrl.value = mastering.createSourceAudioUrl(loaded)
    listenTarget.value = 'source'
    activeModule.value = modules[0]
  } catch {
    localError.value = t('master.errors.loadFailed')
  }
}

async function renderMaster() {
  localError.value = null
  releaseOutputUrl()
  try {
    const result = await mastering.render({
      preset: selectedPreset.value,
      targetLufs: targetLufs.value,
      tuning: {
        tone: tone.value,
        width: width.value,
        dynamics: dynamics.value,
      },
      moduleSettings: moduleSettings.value,
    })
    outputUrl.value = mastering.createAudioUrl(result)
    reportUrl.value = createReportUrl()
    listenTarget.value = 'master'
    await nextTick()
    updatePlaybackVolume()
  } catch {
    localError.value = t('master.errors.renderFailed')
  }
}

async function handleReferenceFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  localError.value = null

  try {
    if (referenceUrl.value) {
      URL.revokeObjectURL(referenceUrl.value)
      referenceUrl.value = null
    }
    reference.value = await mastering.decodeFile(file)
    referenceUrl.value = mastering.createSourceAudioUrl(reference.value)
  } catch {
    localError.value = t('master.errors.loadFailed')
  } finally {
    input.value = ''
  }
}

async function renderReferenceMatch() {
  if (!reference.value) return
  localError.value = null
  releaseOutputUrl()
  try {
    const result = await mastering.renderReferenceMatch(reference.value)
    outputUrl.value = mastering.createAudioUrl(result)
    reportUrl.value = createReportUrl()
    listenTarget.value = 'master'
    await nextTick()
    updatePlaybackVolume()
  } catch {
    localError.value = t('master.errors.referenceFailed')
  }
}

function updatePlaybackVolume() {
  if (!audioElement.value || !mastering.rendered.value || !loudnessMatched.value) {
    if (audioElement.value) audioElement.value.volume = 1
    return
  }

  const input = mastering.rendered.value.inputLufs
  const output = mastering.rendered.value.outputLufs
  const sourceGain = output < input ? dbToLinear(output - input) : 1
  const masterGain = input < output ? dbToLinear(input - output) : 1
  audioElement.value.volume = listenTarget.value === 'source' ? sourceGain : masterGain
}

function closeIntroModal() {
  showIntroModal.value = false
  localStorage.setItem('libsonare-mastering-intro-seen', '1')
}

function currentSessionSettings(): MasteringSessionSettings {
  return {
    mode: mode.value,
    selectedPreset: selectedPreset.value,
    selectedPlatform: selectedPlatform.value,
    customLufs: customLufs.value,
    tone: tone.value,
    width: width.value,
    dynamics: dynamics.value,
    showFineTune: showFineTune.value,
    activeModule: activeModule.value,
    loudnessMatched: loudnessMatched.value,
    moduleSettings: { ...moduleSettings.value },
  }
}

function applySessionSettings(settings: Partial<MasteringSessionSettings>) {
  if (settings.mode === 'quick' || settings.mode === 'studio') mode.value = settings.mode
  if (isMasteringPresetId(settings.selectedPreset)) selectedPreset.value = settings.selectedPreset
  if (isMasteringPlatformId(settings.selectedPlatform)) selectedPlatform.value = settings.selectedPlatform
  if (Number.isFinite(settings.customLufs)) customLufs.value = clamp(Number(settings.customLufs), -24, -8)
  if (Number.isFinite(settings.tone)) tone.value = clamp(Number(settings.tone), 0, 100)
  if (Number.isFinite(settings.width)) width.value = clamp(Number(settings.width), 0, 100)
  if (Number.isFinite(settings.dynamics)) dynamics.value = clamp(Number(settings.dynamics), 0, 100)
  if (typeof settings.showFineTune === 'boolean') showFineTune.value = settings.showFineTune
  if (settings.activeModule && modules.includes(settings.activeModule)) activeModule.value = settings.activeModule
  if (typeof settings.loudnessMatched === 'boolean') loudnessMatched.value = settings.loudnessMatched
  if (settings.moduleSettings && typeof settings.moduleSettings === 'object') {
    moduleSettings.value = {
      ...moduleSettings.value,
      ...settings.moduleSettings,
    }
  }
}

function saveSession() {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(sessionStorageKey, JSON.stringify(currentSessionSettings()))
}

function restoreSession() {
  const raw = sessionStorage.getItem(sessionStorageKey)
  if (!raw) return
  try {
    applySessionSettings(JSON.parse(raw))
  } catch {
    sessionStorage.removeItem(sessionStorageKey)
  }
}

function saveChainPreset() {
  localStorage.setItem(chainPresetStorageKey, JSON.stringify(currentSessionSettings()))
}

function loadChainPreset() {
  const raw = localStorage.getItem(chainPresetStorageKey)
  if (!raw) {
    localError.value = t('master.errors.noSavedPreset')
    return
  }
  try {
    applySessionSettings(JSON.parse(raw))
    localError.value = null
  } catch {
    localError.value = t('master.errors.presetLoadFailed')
  }
}

function exportChainSettings() {
  if (chainSettingsUrl.value) URL.revokeObjectURL(chainSettingsUrl.value)
  const payload = {
    exportedAt: new Date().toISOString(),
    settings: currentSessionSettings(),
  }
  chainSettingsUrl.value = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  }))
}

async function handleChainImport(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const payload = JSON.parse(await file.text())
    applySessionSettings(payload.settings || payload)
    localError.value = null
  } catch {
    localError.value = t('master.errors.presetLoadFailed')
  } finally {
    input.value = ''
  }
}

function isMasteringPresetId(value: unknown): value is MasteringPresetId {
  return typeof value === 'string' && presets.some((preset) => preset.id === value)
}

function isMasteringPlatformId(value: unknown): value is MasteringPlatformId {
  return typeof value === 'string' && platforms.some((platform) => platform.id === value)
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function dbToLinear(db: number): number {
  return Math.max(0, Math.min(1, 10 ** (db / 20)))
}

function normalizeRange(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))
}

function releaseOutputUrl() {
  if (outputUrl.value) {
    URL.revokeObjectURL(outputUrl.value)
    outputUrl.value = null
  }
  if (reportUrl.value) {
    URL.revokeObjectURL(reportUrl.value)
    reportUrl.value = null
  }
}

function releaseUrls() {
  if (sourceUrl.value) {
    URL.revokeObjectURL(sourceUrl.value)
    sourceUrl.value = null
  }
  releaseOutputUrl()
  if (referenceUrl.value) {
    URL.revokeObjectURL(referenceUrl.value)
    referenceUrl.value = null
  }
  if (chainSettingsUrl.value) {
    URL.revokeObjectURL(chainSettingsUrl.value)
    chainSettingsUrl.value = null
  }
  reference.value = null
}

onUnmounted(() => {
  urlModeSyncReady = false
  if (typeof window !== 'undefined') {
    window.removeEventListener('popstate', handlePopState)
    window.removeEventListener('keydown', handleKeyboardShortcuts)
  }
  releaseUrls()
  mastering.dispose()
})

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const rest = Math.round(seconds % 60).toString().padStart(2, '0')
  return `${minutes}:${rest}`
}

function analyzeSignal(left: Float32Array, right: Float32Array) {
  let peak = 0
  let sumSquares = 0
  let sumLeftSquares = 0
  let sumRightSquares = 0
  let sumProduct = 0
  let count = 0
  const stride = Math.max(1, Math.floor(left.length / 200000))
  for (let i = 0; i < left.length; i += stride) {
    const leftSample = left[i]
    const rightSample = right[i] ?? leftSample
    peak = Math.max(peak, Math.abs(leftSample), Math.abs(rightSample))
    sumSquares += (leftSample * leftSample + rightSample * rightSample) / 2
    sumLeftSquares += leftSample * leftSample
    sumRightSquares += rightSample * rightSample
    sumProduct += leftSample * rightSample
    count++
  }

  const rms = Math.sqrt(sumSquares / Math.max(1, count))
  const peakDb = 20 * Math.log10(Math.max(peak, 0.000001))
  const rmsDb = 20 * Math.log10(Math.max(rms, 0.000001))
  const correlation = sumProduct / Math.sqrt(Math.max(0.000001, sumLeftSquares * sumRightSquares))

  return {
    peakDb,
    rmsDb,
    crestDb: peakDb - rmsDb,
    correlation: Math.max(-1, Math.min(1, correlation)),
  }
}

function createReportUrl(): string {
  if (reportUrl.value) URL.revokeObjectURL(reportUrl.value)

  const report = {
    preset: selectedPreset.value,
    platform: selectedPlatform.value,
    targetLufs: targetLufs.value,
    tuning: {
      tone: tone.value,
      width: width.value,
      dynamics: dynamics.value,
    },
    source: {
      fileName: mastering.source.value?.fileName,
      sampleRate: mastering.source.value?.sampleRate,
      duration: mastering.source.value?.duration,
      metrics: sourceMetrics.value,
    },
    rendered: {
      inputLufs: mastering.rendered.value?.inputLufs,
      outputLufs: mastering.rendered.value?.outputLufs,
      appliedGainDb: mastering.rendered.value?.appliedGainDb,
      stages: mastering.rendered.value?.stages,
      metrics: masterMetrics.value,
    },
    reference: referenceMetrics.value,
  }

  return URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], {
    type: 'application/json',
  }))
}
</script>

<template>
  <div class="master-page" :class="`master-page--${locale}`">
    <div class="master-page__backdrop">
      <GridOverlay scanlines />
      <CornerBrackets size="lg" offset="lg" />
    </div>

    <header class="master-page__header">
      <div class="master-page__header-left">
        <a :href="homePath" class="master-page__brand">LIBSONARE</a>
        <span class="master-page__tagline">{{ t('master.header.title') }}</span>
        <StatusIndicator status="active" :label="t('master.header.privacy')" class="master-page__privacy" />
      </div>
      <div class="master-page__header-right">
        <span class="master-page__version">v{{ libVersion || '-.-.--' }}</span>
        <a :href="docsPath" class="master-page__docs-link">
          {{ t('master.header.docs') }}
        </a>
        <a
          :href="otherLocalePath"
          class="master-page__lang-switch"
          :aria-label="`Switch to ${otherLocaleLabel}`"
          @click.capture.stop.prevent="switchLocale"
        >
          {{ otherLocaleLabel }}
        </a>
        <button
          type="button"
          class="master-page__theme-toggle"
          :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
          @click="toggleTheme"
        >
          <svg class="master-page__icon-sun" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
          <svg class="master-page__icon-moon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        </button>
        <a :href="analyzerPath" class="master-page__cta">
          {{ t('master.header.openAnalyzer') }}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </a>
      </div>
    </header>

    <div class="master-page__chrome">
      <nav class="master-page__modes" :aria-label="t('master.header.mode')">
        <button
          type="button"
          class="master-page__mode"
          :class="{ 'master-page__mode--active': mode === 'quick' }"
          @click="mode = 'quick'"
        >
          {{ t('master.quick.title') }}
        </button>
        <button
          type="button"
          class="master-page__mode"
          :class="{ 'master-page__mode--active': mode === 'studio' }"
          @click="mode = 'studio'"
        >
          {{ t('master.studio.title') }}
        </button>
      </nav>
    </div>

    <div class="master-page__statusbar" role="status" aria-live="polite">
      <div class="master-page__statusbar-inner">
        <StatusIndicator
          :status="statusVariant"
          :label="statusLabel"
          :pulse="mastering.isRendering.value"
          class="master-page__statusbar-status"
        />
        <span class="master-page__statusbar-divider" aria-hidden="true"></span>
        <span class="master-page__statusbar-field">
          <span class="master-page__statusbar-key">SRC</span>
          <span class="master-page__statusbar-value master-page__statusbar-value--file">{{ statusBarFile }}</span>
        </span>
        <span class="master-page__statusbar-field">
          <span class="master-page__statusbar-key">LEN</span>
          <span class="master-page__statusbar-value">{{ statusBarDuration }}</span>
        </span>
        <span class="master-page__statusbar-field">
          <span class="master-page__statusbar-key">SR</span>
          <span class="master-page__statusbar-value">{{ statusBarRate }}</span>
        </span>
        <span class="master-page__statusbar-field">
          <span class="master-page__statusbar-key">CH</span>
          <span class="master-page__statusbar-value">{{ statusBarChannels }}</span>
        </span>
        <span class="master-page__statusbar-divider" aria-hidden="true"></span>
        <span class="master-page__statusbar-field master-page__statusbar-field--target">
          <span class="master-page__statusbar-key">TARGET</span>
          <span class="master-page__statusbar-value master-page__statusbar-value--accent">{{ statusBarTarget }}</span>
        </span>
        <span class="master-page__statusbar-divider" aria-hidden="true"></span>
        <span class="master-page__statusbar-field">
          <span class="master-page__statusbar-key">LUFS</span>
          <span
            class="master-page__statusbar-value"
            :class="{ 'master-page__statusbar-value--success': !!mastering.rendered.value }"
          >{{ statusBarLoudness }}</span>
        </span>
        <span class="master-page__statusbar-field">
          <span class="master-page__statusbar-key">GAIN</span>
          <span class="master-page__statusbar-value">{{ statusBarGain }}</span>
        </span>
      </div>
    </div>

    <main class="master-page__main">
      <section v-if="mode === 'quick'" class="master-quick" @drop="handleDrop" @dragover.prevent>
        <TechPanel :title="t('master.quick.step1')">
          <label class="master-drop">
            <input type="file" accept="audio/*" @change="handleFile">
            <span class="master-drop__icon">WAV</span>
            <span class="master-drop__title">
              {{ mastering.source.value?.fileName || t('master.quick.dropTitle') }}
            </span>
            <span class="master-drop__subtitle">{{ t('master.quick.dropSubtitle') }}</span>
            <ScanLine :active="!mastering.source.value" :duration="4" />
          </label>
        </TechPanel>

        <TechPanel :title="t('master.quick.step2')">
          <div class="preset-grid">
            <div
              v-for="preset in presets"
              :key="preset.id"
              class="preset-card-wrap"
            >
              <button
                type="button"
                class="preset-card"
                :class="{ 'preset-card--active': selectedPreset === preset.id }"
                @click="selectedPreset = preset.id"
              >
                <span class="preset-card__icon">{{ preset.icon }}</span>
                <span class="preset-card__name">{{ t(`master.presets.${preset.id}.name`) }}</span>
                <span class="preset-card__tagline">{{ t(`master.presets.${preset.id}.tagline`) }}</span>
              </button>
              <Tooltip
                :eyebrow="t('master.quick.step2')"
                :title="t(`master.presets.${preset.id}.name`)"
                :body="t(`master.presets.${preset.id}.description`)"
                :tip="t(`master.presets.${preset.id}.tip`)"
                :tip-label="t('master.tips.useWhen')"
              >
                <button
                  type="button"
                  class="preset-card__info"
                  :aria-label="t('master.glossary.openGuide')"
                  @click.stop.prevent
                >
                  <span aria-hidden="true">i</span>
                </button>
              </Tooltip>
            </div>
          </div>
        </TechPanel>

        <TechPanel :title="t('master.quick.step3')">
          <div class="platform-grid">
            <div
              v-for="platform in platforms"
              :key="platform.id"
              class="platform-option-wrap"
            >
              <label
                class="platform-option"
                :class="{ 'platform-option--active': selectedPlatform === platform.id }"
              >
                <input v-model="selectedPlatform" type="radio" :value="platform.id">
                <span>{{ t(`master.platforms.${platform.id}`) }}</span>
                <strong>{{ platform.id === 'custom' ? `${customLufs} LUFS` : `${platform.lufs} LUFS` }}</strong>
              </label>
              <Tooltip
                :eyebrow="t('master.quick.step3')"
                :title="t(`master.platforms.${platform.id}`)"
                :body="t(`master.platforms.descriptions.${platform.id}`)"
                :tip="t(`master.platforms.useWhen.${platform.id}`)"
                :tip-label="t('master.tips.useWhen')"
              >
                <button
                  type="button"
                  class="platform-option__info"
                  :aria-label="t('master.glossary.openGuide')"
                  @click.stop.prevent
                >
                  <span aria-hidden="true">i</span>
                </button>
              </Tooltip>
            </div>
          </div>
          <label v-if="selectedPlatform === 'custom'" class="master-slider">
            <span>{{ t('master.quick.customTarget') }}</span>
            <input v-model.number="customLufs" type="range" min="-24" max="-8" step="0.5">
            <strong>{{ customLufs }} LUFS</strong>
          </label>
        </TechPanel>

        <TechPanel :title="t('master.quick.step4')">
          <button type="button" class="master-disclosure" @click="showFineTune = !showFineTune">
            {{ showFineTune ? t('master.quick.hideFineTune') : t('master.quick.showFineTune') }}
          </button>
          <div v-if="showFineTune" class="fine-tune">
            <label class="master-slider">
              <span class="master-slider__label">
                {{ t('master.parameters.tone') }}
                <Tooltip
                  :title="t('master.parameters.tone')"
                  :body="t('master.hints.tone')"
                  :tip="t('master.tips.tone')"
                  :tip-label="t('master.tips.useWhen')"
                  default-value="50"
                  :default-label="t('master.defaults.label')"
                  :default-rationale="t('master.defaults.tone')"
                  :href="docHref(parameterGuideSlugs.tone)"
                  :link-label="t('master.glossary.openGuide')"
                >
                  <button
                    type="button"
                    class="master-param-info"
                    :aria-label="t('master.glossary.openGuide')"
                    @click.stop.prevent
                  >
                    <span aria-hidden="true">i</span>
                  </button>
                </Tooltip>
              </span>
              <input v-model.number="tone" type="range" min="0" max="100">
              <strong>{{ tone }}</strong>
            </label>
            <label class="master-slider">
              <span class="master-slider__label">
                {{ t('master.parameters.width') }}
                <Tooltip
                  :title="t('master.parameters.width')"
                  :body="t('master.hints.width')"
                  :tip="t('master.tips.width')"
                  :tip-label="t('master.tips.useWhen')"
                  default-value="50"
                  :default-label="t('master.defaults.label')"
                  :default-rationale="t('master.defaults.width')"
                  :href="docHref(parameterGuideSlugs.width)"
                  :link-label="t('master.glossary.openGuide')"
                >
                  <button
                    type="button"
                    class="master-param-info"
                    :aria-label="t('master.glossary.openGuide')"
                    @click.stop.prevent
                  >
                    <span aria-hidden="true">i</span>
                  </button>
                </Tooltip>
              </span>
              <input v-model.number="width" type="range" min="0" max="100">
              <strong>{{ width }}</strong>
            </label>
            <label class="master-slider">
              <span class="master-slider__label">
                {{ t('master.parameters.dynamics') }}
                <Tooltip
                  :title="t('master.parameters.dynamics')"
                  :body="t('master.hints.dynamics')"
                  :tip="t('master.tips.dynamics')"
                  :tip-label="t('master.tips.useWhen')"
                  default-value="50"
                  :default-label="t('master.defaults.label')"
                  :default-rationale="t('master.defaults.dynamics')"
                  :href="docHref(parameterGuideSlugs.dynamics)"
                  :link-label="t('master.glossary.openGuide')"
                >
                  <button
                    type="button"
                    class="master-param-info"
                    :aria-label="t('master.glossary.openGuide')"
                    @click.stop.prevent
                  >
                    <span aria-hidden="true">i</span>
                  </button>
                </Tooltip>
              </span>
              <input v-model.number="dynamics" type="range" min="0" max="100">
              <strong>{{ dynamics }}</strong>
            </label>
          </div>
        </TechPanel>

        <div class="master-actions">
          <button type="button" class="master-action" :disabled="!canRender" @click="renderMaster">
            {{ mastering.isRendering.value ? t('master.quick.processing') : t('master.quick.processButton') }}
          </button>
          <div class="render-progress" :class="{ 'render-progress--active': mastering.isRendering.value }">
            <span>{{ mastering.isRendering.value ? renderStageLabel : t('master.quick.processingEta', { seconds: mastering.source.value ? '12' : '--' }) }}</span>
            <div class="render-progress__track" aria-hidden="true">
              <span :style="{ width: `${Math.round(mastering.renderProgress.value * 100)}%` }"></span>
            </div>
          </div>
        </div>
      </section>

      <section v-else class="master-studio" @drop="handleDrop" @dragover.prevent>
        <div class="studio-source">
          <label class="studio-source__drop">
            <input type="file" accept="audio/*" @change="handleFile">
            <span class="studio-source__icon" aria-hidden="true">AUD</span>
            <span class="studio-source__meta">
              <strong>{{ mastering.source.value?.fileName || t('master.quick.dropTitle') }}</strong>
              <em>{{ mastering.source.value ? statusBarDuration + ' · ' + statusBarRate + ' · ' + statusBarChannels : t('master.quick.dropSubtitle') }}</em>
            </span>
            <span class="studio-source__cta">
              {{ mastering.source.value ? t('master.studio.replaceSource') : t('master.studio.loadSource') }}
            </span>
          </label>
        </div>

        <TechPanel :title="t('master.studio.chain')">
          <ol class="signal-flow" :aria-label="t('master.studio.graph')">
            <li
              v-for="(moduleId, index) in modules"
              :key="moduleId"
              class="signal-flow__row"
              :class="{ 'signal-flow__row--active': activeModule === moduleId }"
            >
              <button
                type="button"
                class="signal-flow__btn"
                @click="activeModule = moduleId"
              >
                <span class="signal-flow__stage">{{ String(index + 1).padStart(2, '0') }}</span>
                <span class="signal-flow__led" aria-hidden="true"></span>
                <span class="signal-flow__label">{{ t(`master.modules.${moduleId}.name`) }}</span>
                <span class="signal-flow__chev" aria-hidden="true">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </span>
              </button>
            </li>
          </ol>
          <div class="studio-actions" :aria-label="t('master.studio.chainSettings')">
            <Tooltip
              :title="t('master.studio.savePreset')"
              :body="t('master.studio.tooltips.savePreset')"
            >
              <button type="button" class="studio-actions__button" @click="saveChainPreset">
                {{ t('master.studio.savePreset') }}
              </button>
            </Tooltip>
            <Tooltip
              :title="t('master.studio.loadPreset')"
              :body="t('master.studio.tooltips.loadPreset')"
            >
              <button type="button" class="studio-actions__button" @click="loadChainPreset">
                {{ t('master.studio.loadPreset') }}
              </button>
            </Tooltip>
            <Tooltip
              :title="t('master.studio.exportPreset')"
              :body="t('master.studio.tooltips.exportPreset')"
            >
              <button type="button" class="studio-actions__button" @click="exportChainSettings">
                {{ t('master.studio.exportPreset') }}
              </button>
            </Tooltip>
            <a
              v-if="chainSettingsUrl"
              class="studio-actions__button studio-actions__button--link"
              :href="chainSettingsUrl"
              download="libsonare-mastering-chain.json"
            >
              {{ t('master.studio.downloadPreset') }}
            </a>
            <Tooltip
              :title="t('master.studio.importPreset')"
              :body="t('master.studio.tooltips.importPreset')"
            >
              <label class="studio-actions__button studio-actions__button--import">
                <input type="file" accept="application/json,.json" @change="handleChainImport">
                <span>{{ t('master.studio.importPreset') }}</span>
              </label>
            </Tooltip>
          </div>
        </TechPanel>

        <TechPanel :title="t(`master.modules.${activeModule}.name`)">
          <div class="module-editor">
            <header class="module-editor__head">
              <div class="module-editor__stage" :aria-label="t('master.studio.graph')">
                <em>{{ t('master.studio.stageLabel') }}</em>
                <strong>{{ String(activeStage).padStart(2, '0') }}</strong>
                <small>/ {{ String(totalStages).padStart(2, '0') }}</small>
              </div>
              <div class="module-editor__id">
                <span class="module-editor__led" aria-hidden="true"></span>
                <h3>{{ t(`master.modules.${activeModule}.name`) }}</h3>
                <small>{{ t(`master.modules.${activeModule}.description`) }}</small>
              </div>
              <Tooltip
                v-if="moduleGuideSlugs[activeModule]"
                :eyebrow="t('master.studio.chain')"
                :title="t(`master.modules.${activeModule}.name`)"
                :body="t(`master.modules.${activeModule}.description`)"
                :tip="t(`master.modules.${activeModule}.tip`)"
                :tip-label="t('master.tips.useWhen')"
                :href="docHref(moduleGuideSlugs[activeModule])"
                :link-label="t('master.glossary.moduleGuide')"
              >
                <button
                  type="button"
                  class="module-editor__info"
                  :aria-label="t('master.glossary.moduleGuide')"
                >
                  <span aria-hidden="true">i</span>
                </button>
              </Tooltip>
            </header>

            <MasteringWaveform
              :audio="mastering.rendered.value || mastering.source.value"
              :compare="mastering.rendered.value && mastering.source.value ? mastering.source.value : null"
              :variant="mastering.rendered.value ? 'master' : 'source'"
            />

            <div v-if="moduleControls.length" class="module-editor__knobs">
              <MasterKnob
                v-for="control in moduleControls"
                :key="control.key"
                v-model="moduleSettings[control.key]"
                :min="control.min"
                :max="control.max"
                :step="control.step"
                :unit="control.unit"
                :label="t(`master.parameters.${control.key}`)"
                :hint="t(`master.hints.${control.key}`)"
                :tip="t(`master.tips.${control.key}`)"
                :tip-label="t('master.tips.useWhen')"
                :default="chainDefaults[control.key]"
                :default-rationale="t(`master.defaults.${control.key}`)"
                :default-label="t('master.defaults.label')"
                :default-off-label="t('master.defaults.off')"
                :docs-href="docHref(parameterGuideSlugs[control.key])"
                :docs-link-label="t('master.glossary.openGuide')"
              />
            </div>

            <div v-if="moduleControls.length" class="module-editor__reset">
              <Tooltip
                :title="t('master.studio.resetModule')"
                :body="t('master.studio.resetModuleHint')"
                :tip="t('master.studio.resetModuleUseWhen')"
                :tip-label="t('master.tips.useWhen')"
              >
                <button
                  type="button"
                  class="module-editor__reset-btn"
                  :disabled="!canResetActiveModule"
                  :aria-label="t('master.studio.resetModuleAria')"
                  @click="resetActiveModule"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M3 12a9 9 0 1 0 3-6.7" />
                    <path d="M3 4v5h5" />
                  </svg>
                  <span>{{ t('master.studio.resetModule') }}</span>
                </button>
              </Tooltip>
            </div>

            <div v-if="activeModule === 'loudness'" class="module-editor__platform">
              <p class="module-editor__note">
                {{ t('master.modules.loudness.note') }} <strong>{{ targetLufs }} LUFS</strong>
              </p>
              <div class="platform-grid platform-grid--studio">
                <div
                  v-for="platform in platforms"
                  :key="platform.id"
                  class="platform-option-wrap"
                >
                  <label
                    class="platform-option"
                    :class="{ 'platform-option--active': selectedPlatform === platform.id }"
                  >
                    <input v-model="selectedPlatform" type="radio" :value="platform.id">
                    <span>{{ t(`master.platforms.${platform.id}`) }}</span>
                    <strong>{{ platform.id === 'custom' ? `${customLufs} LUFS` : `${platform.lufs} LUFS` }}</strong>
                  </label>
                  <Tooltip
                    :eyebrow="t('master.modules.loudness.name')"
                    :title="t(`master.platforms.${platform.id}`)"
                    :body="t(`master.platforms.descriptions.${platform.id}`)"
                    :tip="t(`master.platforms.useWhen.${platform.id}`)"
                    :tip-label="t('master.tips.useWhen')"
                  >
                    <button
                      type="button"
                      class="platform-option__info"
                      :aria-label="t('master.glossary.openGuide')"
                      @click.stop.prevent
                    >
                      <span aria-hidden="true">i</span>
                    </button>
                  </Tooltip>
                </div>
              </div>
              <label v-if="selectedPlatform === 'custom'" class="master-slider master-slider--inline">
                <span>{{ t('master.quick.customTarget') }}</span>
                <input v-model.number="customLufs" type="range" min="-24" max="-8" step="0.5">
                <strong>{{ customLufs }} LUFS</strong>
              </label>
            </div>
            <p v-if="activeModule === 'output'" class="module-editor__note">
              {{ t('master.modules.output.note') }}
            </p>

          </div>
        </TechPanel>

        <TechPanel :title="t('master.studio.meters')">
          <div class="meter-stack">
            <Tooltip
              v-for="reading in meterReadings"
              :key="reading.id"
              :eyebrow="t('master.studio.meters')"
              :title="reading.label"
              :body="t(`master.meters.descriptions.${reading.id}`)"
              :tip="t(`master.meters.useWhen.${reading.id}`)"
              :tip-label="t('master.tips.useWhen')"
              :href="meterTargets[reading.id] ? docHref(moduleGuideSlugs[meterTargets[reading.id]]) : undefined"
              :link-label="t('master.glossary.moduleGuide')"
            >
              <button
                type="button"
                class="led-meter led-meter--jump"
                :class="{ 'led-meter--active': meterTargets[reading.id] && activeModule === meterTargets[reading.id] }"
                :disabled="!meterTargets[reading.id]"
                @click="jumpToModule(meterTargets[reading.id])"
              >
                <header class="led-meter__head">
                  <span>{{ reading.label }}</span>
                  <strong>{{ reading.value }}</strong>
                </header>
                <div class="led-meter__leds" aria-hidden="true">
                  <span
                    v-for="i in LED_SEGMENTS"
                    :key="i"
                    class="led-meter__seg"
                    :class="ledClass(reading.percent, i, LED_SEGMENTS)"
                  />
                </div>
              </button>
            </Tooltip>
            <MetricItem :label="t('master.meters.status')" :value="statusLabel" variant="accent" />
            <button type="button" class="meter-jump" :title="`Open ${t('master.modules.input.name')} stage`" @click="jumpToModule('input')">
              <MetricItem :label="t('master.meters.inputLufs')" :value="mastering.rendered.value ? mastering.rendered.value.inputLufs.toFixed(1) : '-'" />
            </button>
            <button type="button" class="meter-jump" :title="`Open ${t('master.modules.loudness.name')} stage`" @click="jumpToModule('loudness')">
              <MetricItem :label="t('master.meters.outputLufs')" :value="mastering.rendered.value ? mastering.rendered.value.outputLufs.toFixed(1) : `${targetLufs}`" variant="success" />
            </button>
            <button type="button" class="meter-jump" :title="`Open ${t('master.modules.loudness.name')} stage`" @click="jumpToModule('loudness')">
              <MetricItem :label="t('master.meters.gain')" :value="mastering.rendered.value ? `${mastering.rendered.value.appliedGainDb.toFixed(1)} dB` : '-'" />
            </button>
            <button type="button" class="meter-jump" :title="`Open ${t('master.modules.limiter.name')} stage`" @click="jumpToModule('limiter')">
              <MetricItem :label="t('master.meters.peak')" :value="sourceMetrics?.peak || '-'" />
            </button>
            <button type="button" class="meter-jump" :title="`Open ${t('master.modules.dynamics.name')} stage`" @click="jumpToModule('dynamics')">
              <MetricItem :label="t('master.meters.crest')" :value="masterMetrics?.crest || sourceMetrics?.crest || '-'" />
            </button>
            <button type="button" class="meter-jump" :title="`Open ${t('master.modules.stereo.name')} stage`" @click="jumpToModule('stereo')">
              <MetricItem :label="t('master.meters.correlation')" :value="masterMetrics?.correlation || sourceMetrics?.correlation || '-'" />
            </button>
            <Tooltip
              :eyebrow="t('master.studio.meters')"
              :title="t('master.meters.stereoBalanced')"
              :body="t('master.meters.descriptions.phase')"
              :tip="t('master.meters.useWhen.phase')"
              :tip-label="t('master.tips.useWhen')"
              :href="docHref(moduleGuideSlugs.stereo)"
              :link-label="t('master.glossary.moduleGuide')"
            >
              <button type="button" class="meter-jump meter-jump--block" @click="jumpToModule('stereo')">
                <div class="phase-scope" aria-hidden="true">
                  <span
                    v-for="(point, index) in phasePoints"
                    :key="index"
                    :style="{ left: `${point.x}%`, top: `${point.y}%`, opacity: point.opacity }"
                  ></span>
                </div>
                <div class="stereo-image">
                  <div class="stereo-image__bar">
                    <span :style="{ width: stereoImage.width }"></span>
                  </div>
                  <strong>{{ stereoImage.label }}</strong>
                </div>
              </button>
            </Tooltip>
          </div>
        </TechPanel>

        <div class="studio-render" role="group">
          <TechPanel :title="t('master.reference.title')">
            <div class="reference-panel">
              <label class="reference-panel__drop">
                <input type="file" accept="audio/*" @change="handleReferenceFile">
                <span>{{ reference?.fileName || t('master.reference.drop') }}</span>
              </label>
              <div class="meter-stack">
                <MetricItem :label="t('master.meters.duration')" :value="referenceMetrics?.duration || '-'" />
                <MetricItem :label="t('master.meters.peak')" :value="referenceMetrics?.peak || '-'" />
                <MetricItem :label="t('master.meters.crest')" :value="referenceMetrics?.crest || '-'" />
                <MetricItem :label="t('master.meters.correlation')" :value="referenceMetrics?.correlation || '-'" />
              </div>
              <div class="reference-panel__compare">
                <span>{{ t('master.reference.masterDelta') }}</span>
                <strong>{{ masterMetrics && referenceMetrics ? `${masterMetrics.crest} / ${referenceMetrics.crest}` : '-' }}</strong>
                <Tooltip
                  :title="t('master.reference.match')"
                  :body="t('master.reference.matchHint')"
                >
                  <button
                    type="button"
                    class="reference-panel__button"
                    :disabled="!mastering.source.value || !reference || mastering.isRendering.value"
                    @click="renderReferenceMatch"
                  >
                    {{ mastering.isRendering.value ? t('master.reference.matching') : t('master.reference.match') }}
                  </button>
                </Tooltip>
              </div>
            </div>
          </TechPanel>

          <div class="studio-output" role="group" :aria-label="t('master.studio.render')">
            <div class="studio-output__meta">
              <em>OUT</em>
              <span>{{ mastering.isRendering.value ? renderStageLabel : t('master.studio.renderHint') }}</span>
            </div>
            <div class="studio-output__bar render-progress" :class="{ 'render-progress--active': mastering.isRendering.value }" aria-hidden="true">
              <div class="render-progress__track">
                <span :style="{ width: `${Math.round(mastering.renderProgress.value * 100)}%` }"></span>
              </div>
            </div>
            <button type="button" class="master-action studio-output__cta" :disabled="!canRender" @click="renderMaster">
              {{ mastering.isRendering.value ? t('master.studio.rendering') : t('master.studio.render') }}
            </button>
          </div>
        </div>
      </section>

      <section class="master-result">
        <TechPanel :title="t('master.result.title')">
          <div class="result-grid">
            <div class="meter-stack">
              <MetricItem :label="t('master.meters.file')" :value="mastering.source.value?.fileName || '-'" />
              <MetricItem :label="t('master.meters.duration')" :value="sourceMetrics?.duration || '-'" />
              <MetricItem :label="t('master.meters.sampleRate')" :value="sourceMetrics?.sampleRate || '-'" />
              <MetricItem :label="t('master.meters.channels')" :value="sourceMetrics?.channels || '-'" />
              <MetricItem :label="t('master.meters.sourcePeak')" :value="sourceMetrics?.peak || '-'" />
              <MetricItem :label="t('master.meters.masterPeak')" :value="masterMetrics?.peak || '-'" variant="success" />
            </div>
            <div class="result-player">
              <div class="ab-controls">
                <Tooltip
                  :title="t('master.result.before')"
                  :body="t('master.result.beforeHint')"
                >
                  <button
                    type="button"
                    class="ab-controls__button"
                    :class="{ 'ab-controls__button--active': listenTarget === 'source' }"
                    :disabled="!sourceUrl"
                    @click="listenTarget = 'source'"
                  >
                    {{ t('master.result.before') }}
                  </button>
                </Tooltip>
                <Tooltip
                  :title="t('master.result.after')"
                  :body="t('master.result.afterHint')"
                >
                  <button
                    type="button"
                    class="ab-controls__button"
                    :class="{ 'ab-controls__button--active': listenTarget === 'master' }"
                    :disabled="!outputUrl"
                    @click="listenTarget = 'master'"
                  >
                    {{ t('master.result.after') }}
                  </button>
                </Tooltip>
                <Tooltip
                  :title="t('master.result.loudnessMatch')"
                  :body="t('master.result.loudnessMatchTooltip')"
                >
                  <label class="ab-controls__toggle">
                    <input v-model="loudnessMatched" type="checkbox">
                    <span>{{ t('master.result.loudnessMatch') }}</span>
                  </label>
                </Tooltip>
              </div>
              <MasteringWaveform
                v-if="mastering.source.value"
                :audio="resultWaveAudio"
                :compare="resultWaveCompare"
                :variant="resultWaveVariant"
                :height="96"
              />
              <audio ref="audioElement" :src="playbackUrl || undefined" controls></audio>
              <div class="result-actions">
                <Tooltip
                  :title="t('master.result.download')"
                  :body="t('master.result.downloadHint')"
                >
                  <a
                    class="master-download"
                    :class="{ 'master-download--disabled': !outputUrl }"
                    :href="outputUrl || undefined"
                    download="libsonare-master.wav"
                  >
                    {{ t('master.result.download') }}
                  </a>
                </Tooltip>
                <Tooltip
                  :title="t('master.result.report')"
                  :body="t('master.result.reportHint')"
                >
                  <a
                    class="master-download"
                    :class="{ 'master-download--disabled': !reportUrl }"
                    :href="reportUrl || undefined"
                    download="libsonare-master-report.json"
                  >
                    {{ t('master.result.report') }}
                  </a>
                </Tooltip>
              </div>
              <p class="result-note">
                {{ loudnessMatched ? t('master.result.loudnessMatchNote') : t('master.result.rawCompareNote') }}
              </p>
              <p v-if="renderResultStages" class="result-stages">
                {{ renderResultStages }}
              </p>
              <p v-if="localError || mastering.error.value" class="master-error">
                {{ localError || mastering.error.value }}
              </p>
            </div>
          </div>
        </TechPanel>
      </section>

    </main>

    <div v-if="showIntroModal" class="intro-modal" role="dialog" aria-modal="true" :aria-label="t('master.intro.title')">
      <div class="intro-modal__panel">
        <h2>{{ t('master.intro.title') }}</h2>
        <p>{{ t('master.intro.body') }}</p>
        <ul>
          <li>{{ t('master.intro.pointLoudness') }}</li>
          <li>{{ t('master.intro.pointTone') }}</li>
          <li>{{ t('master.intro.pointPeaks') }}</li>
          <li>{{ t('master.intro.pointPrivacy') }}</li>
        </ul>
        <div class="intro-modal__actions">
          <button type="button" class="master-action master-action--small" @click="closeIntroModal">
            {{ t('master.intro.start') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap');

/* ===== THEME TOKENS (Dark - default) ===== */
.master-page {
  --demo-bg: #030405;
  --demo-bg-overlay: rgba(10, 12, 18, 0.95);
  --demo-bg-elevated: rgba(8, 10, 14, 0.85);
  --demo-bg-header: rgba(20, 22, 28, 0.8);
  --demo-text-strong: #ffffff;
  --demo-text: rgba(255, 255, 255, 0.7);
  --demo-text-muted: rgba(255, 255, 255, 0.35);
  --demo-text-faint: rgba(255, 255, 255, 0.2);
  --demo-accent: #8B5CF6;
  --demo-accent-light: #A78BFA;
  --demo-accent-dim: rgba(139, 92, 246, 0.3);
  --demo-accent-subtle: rgba(139, 92, 246, 0.08);
  --demo-accent-border: rgba(139, 92, 246, 0.2);
  --demo-cyan: #22D3EE;
  --demo-amber: #F59E0B;
  --demo-success: rgba(100, 200, 180, 0.9);
  --demo-danger: #FCA5A5;
  --demo-border: rgba(139, 92, 246, 0.12);
  --demo-border-strong: rgba(139, 92, 246, 0.25);
  --demo-shadow: rgba(0, 0, 0, 0.4);
  --demo-shadow-glow: 0 0 40px -10px rgba(139, 92, 246, 0.2);
  --demo-grid-color: rgba(139, 92, 246, 0.04);
  --demo-grid-minor: rgba(139, 92, 246, 0.02);
  --demo-scanline: rgba(0, 0, 0, 0.03);
  --demo-screen-bg: rgb(6, 8, 12);
  --demo-screen-bg-alpha: rgba(6, 8, 12, 0.6);

  /* Surface variants used by master-specific affordances */
  --master-surface: rgba(255, 255, 255, 0.025);
  --master-surface-strong: rgba(255, 255, 255, 0.04);
  --master-track-bg: rgba(255, 255, 255, 0.035);
  --master-code-bg: rgba(0, 0, 0, 0.28);
  --master-scope-bg: rgba(0, 0, 0, 0.24);

  min-height: 100vh;
  background: var(--demo-bg);
  color: var(--demo-text);
  font-family: 'JetBrains Mono', monospace;
  transition: background-color 0.3s ease, color 0.3s ease;
}

/* ===== THEME TOKENS (Light) ===== */
html:not(.dark) .master-page {
  --demo-bg: #f8f6ff;
  --demo-bg-overlay: rgba(248, 246, 255, 0.95);
  --demo-bg-elevated: rgba(245, 243, 255, 0.85);
  --demo-bg-header: rgba(250, 248, 255, 0.85);
  --demo-text-strong: #1a1a2e;
  --demo-text: rgba(0, 0, 0, 0.6);
  --demo-text-muted: rgba(0, 0, 0, 0.42);
  --demo-text-faint: rgba(0, 0, 0, 0.22);
  --demo-accent: #7C3AED;
  --demo-accent-light: #8B5CF6;
  --demo-accent-dim: rgba(124, 58, 237, 0.28);
  --demo-accent-subtle: rgba(124, 58, 237, 0.07);
  --demo-accent-border: rgba(124, 58, 237, 0.22);
  --demo-cyan: #0891B2;
  --demo-amber: #B45309;
  --demo-success: rgba(16, 132, 110, 0.95);
  --demo-danger: #B91C1C;
  --demo-border: rgba(0, 0, 0, 0.08);
  --demo-border-strong: rgba(0, 0, 0, 0.15);
  --demo-shadow: rgba(0, 0, 0, 0.08);
  --demo-shadow-glow: 0 4px 24px -6px rgba(124, 58, 237, 0.18);
  --demo-grid-color: transparent;
  --demo-grid-minor: transparent;
  --demo-scanline: transparent;
  --demo-screen-bg: rgb(245, 243, 255);
  --demo-screen-bg-alpha: rgba(245, 243, 255, 0.6);

  --master-surface: rgba(124, 58, 237, 0.04);
  --master-surface-strong: rgba(124, 58, 237, 0.07);
  --master-track-bg: rgba(124, 58, 237, 0.07);
  --master-code-bg: rgba(255, 255, 255, 0.7);
  --master-scope-bg: rgba(255, 255, 255, 0.65);
}

/* Hide decorative grid/brackets in light mode for a cleaner editorial feel */
html:not(.dark) .master-page .master-page__backdrop {
  display: none;
}

.master-page__backdrop {
  position: fixed;
  inset: 0;
  pointer-events: none;
}

.master-page__header {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 24px;
  background: linear-gradient(to bottom, var(--demo-bg-overlay), transparent);
  border-bottom: 1px solid var(--demo-border);
  backdrop-filter: blur(16px);
}

html:not(.dark) .master-page .master-page__header {
  background: var(--demo-bg-overlay);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.master-page__header-left,
.master-page__header-right {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.master-page__brand {
  color: var(--demo-text-strong);
  font-family: 'Space Grotesk', sans-serif;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.15em;
  text-decoration: none;
}

.master-page__tagline {
  color: var(--demo-text-muted);
  font-size: 10px;
  font-weight: 400;
  letter-spacing: 0.05em;
}

.master-page__privacy {
  font-size: 9px;
}

.master-page__version {
  padding: 4px 8px;
  background: var(--demo-accent-subtle);
  border-radius: 4px;
  color: var(--demo-text-muted);
  font-size: 10px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.master-page__docs-link {
  padding: 6px 10px;
  border-radius: 6px;
  color: var(--demo-text);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-decoration: none;
  transition: color 0.2s ease, background-color 0.2s ease;
}

.master-page__docs-link:hover {
  color: var(--demo-accent);
  background: var(--demo-accent-subtle);
}

.master-page__lang-switch {
  display: inline-flex;
  align-items: center;
  height: 32px;
  padding: 0 10px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--demo-text-muted);
  text-decoration: none;
  background: var(--demo-accent-subtle);
  border: 1px solid var(--demo-accent-border);
  border-radius: 6px;
  transition: all 0.2s ease;
}

.master-page__lang-switch:hover {
  color: var(--demo-accent);
  background: var(--demo-accent-dim);
  border-color: var(--demo-accent);
}

.master-page__theme-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid var(--demo-accent-border);
  border-radius: 6px;
  background: var(--demo-accent-subtle);
  color: var(--demo-text-muted);
  cursor: pointer;
  transition: all 0.2s ease;
}

.master-page__theme-toggle:hover {
  color: var(--demo-accent);
  background: var(--demo-accent-dim);
  border-color: var(--demo-accent);
}

.master-page__icon-sun { display: none; }
.master-page__icon-moon { display: block; }

.master-page__cta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 6px;
  background: var(--demo-accent);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-decoration: none;
  transition: all 0.2s ease;
}

.master-page__cta:hover {
  background: var(--demo-accent-light);
  transform: translateX(2px);
}

.master-page__cta svg {
  transition: transform 0.2s ease;
}

.master-page__cta:hover svg {
  transform: translateX(3px);
}

.master-page__chrome {
  position: sticky;
  top: 57px;
  z-index: 9;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 24px;
  background: var(--demo-bg-overlay);
  border-bottom: 1px solid var(--demo-border);
  backdrop-filter: blur(16px);
}

.master-page__modes {
  display: inline-flex;
  gap: 4px;
  padding: 3px;
  border: 1px solid var(--demo-border);
  border-radius: 8px;
  background: var(--master-code-bg);
}

html:not(.dark) .master-page .master-page__modes {
  background: rgba(255, 255, 255, 0.55);
}

.master-page__mode {
  min-width: 130px;
  height: 30px;
  padding: 0 12px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--demo-text-muted);
  cursor: pointer;
  font: inherit;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.05em;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.master-page__mode:hover {
  color: var(--demo-text-strong);
}

.master-page__mode--active {
  background: var(--demo-accent);
  color: #fff;
}

/* ===== STATUS BAR (tool-style readout) ===== */
.master-page__statusbar {
  position: relative;
  z-index: 8;
  background: var(--demo-bg-overlay);
  border-bottom: 1px solid var(--demo-border);
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.master-page__statusbar::-webkit-scrollbar {
  display: none;
}

.master-page__statusbar::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--demo-accent-border), transparent);
  opacity: 0.7;
  pointer-events: none;
}

.master-page__statusbar-inner {
  display: flex;
  align-items: center;
  gap: 18px;
  min-width: max-content;
  padding: 8px 24px;
  font-family: 'JetBrains Mono', monospace;
  white-space: nowrap;
}

.master-page__statusbar-status {
  flex-shrink: 0;
}

.master-page__statusbar-divider {
  width: 1px;
  height: 14px;
  background: var(--demo-border-strong);
  opacity: 0.6;
  flex-shrink: 0;
}

.master-page__statusbar-field {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  flex-shrink: 0;
}

.master-page__statusbar-field--target {
  gap: 8px;
}

.master-page__statusbar-key {
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.14em;
  color: var(--demo-text-muted);
  text-transform: uppercase;
}

.master-page__statusbar-value {
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.04em;
  color: var(--demo-text-strong);
  font-variant-numeric: tabular-nums;
}

.master-page__statusbar-value--file {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: inline-block;
  vertical-align: bottom;
}

.master-page__statusbar-value--accent {
  color: var(--demo-accent-light);
  font-weight: 600;
}

html:not(.dark) .master-page .master-page__statusbar-value--accent {
  color: var(--demo-accent);
}

.master-page__statusbar-value--success {
  color: var(--demo-success);
}

.master-page__main {
  position: relative;
  z-index: 1;
  width: min(1180px, calc(100% - 48px));
  margin: 0 auto;
  padding: 28px 0 48px;
}

.master-quick {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 14px;
}

.master-drop {
  position: relative;
  display: grid;
  place-items: center;
  gap: 10px;
  min-height: 190px;
  padding: 28px;
  border: 1px dashed var(--demo-border-strong);
  border-radius: 8px;
  background:
    linear-gradient(rgba(139, 92, 246, 0.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(139, 92, 246, 0.035) 1px, transparent 1px);
  background-size: 24px 24px;
  cursor: pointer;
  overflow: hidden;
}

.master-drop input {
  display: none;
}

.master-drop__icon {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  border: 1px solid var(--demo-border-strong);
  border-radius: 8px;
  color: var(--demo-cyan);
  font-size: 10px;
  font-weight: 800;
}

.master-drop__title {
  color: var(--demo-text-strong);
  font-family: 'Space Grotesk', sans-serif;
  font-size: 20px;
  font-weight: 700;
  text-align: center;
  overflow-wrap: anywhere;
}

.master-drop__subtitle {
  color: var(--demo-text-muted);
  font-size: 11px;
  text-align: center;
}

.preset-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 8px;
  padding: 14px;
}

.preset-card,
.platform-option {
  border: 1px solid var(--demo-border);
  border-radius: 8px;
  background: var(--master-surface);
  color: var(--demo-text);
}

.preset-card-wrap,
.platform-option-wrap {
  position: relative;
  display: flex;
}

.preset-card-wrap > .preset-card,
.platform-option-wrap > .platform-option {
  flex: 1;
  width: 100%;
}

.preset-card__info,
.platform-option__info {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: 1px solid var(--demo-border);
  border-radius: 50%;
  background: var(--demo-bg-elevated);
  color: var(--demo-text-muted);
  cursor: pointer;
  opacity: 0.55;
  transition: opacity 0.18s ease, color 0.18s ease, border-color 0.18s ease, background-color 0.18s ease;
}

.preset-card-wrap:hover .preset-card__info,
.platform-option-wrap:hover .platform-option__info,
.preset-card__info:focus-visible,
.platform-option__info:focus-visible {
  opacity: 1;
}

.preset-card__info:hover,
.preset-card__info:focus-visible,
.platform-option__info:hover,
.platform-option__info:focus-visible {
  color: var(--demo-accent);
  border-color: var(--demo-accent);
  background: var(--demo-accent-subtle);
  outline: none;
}

.preset-card__info > span,
.platform-option__info > span {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 10px;
  font-style: italic;
  font-weight: 700;
  line-height: 1;
  transform: translateY(-0.5px);
}

.preset-card {
  display: grid;
  gap: 8px;
  min-height: 126px;
  padding: 14px 12px;
  padding-right: 30px;
  text-align: left;
  cursor: pointer;
}

.preset-card--active,
.platform-option--active {
  border-color: var(--demo-accent);
  background: rgba(139, 92, 246, 0.12);
  box-shadow: 0 0 24px rgba(139, 92, 246, 0.12);
}

.preset-card__icon {
  color: var(--demo-cyan);
  font-size: 10px;
  font-weight: 800;
}

.preset-card__name {
  color: var(--demo-text-strong);
  font-family: 'Space Grotesk', sans-serif;
  font-size: 15px;
  font-weight: 700;
}

.preset-card__tagline {
  color: var(--demo-text-muted);
  font-size: 10px;
  line-height: 1.5;
}

.platform-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
  padding: 14px;
}

.platform-grid--studio {
  padding: 8px 0 0;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
}

.module-editor__platform {
  display: grid;
  gap: 10px;
}

.master-slider--inline {
  margin-top: 4px;
}

.platform-option {
  display: grid;
  gap: 4px;
  padding: 12px;
  padding-right: 28px;
  cursor: pointer;
}

.platform-option input {
  position: absolute;
  opacity: 0;
}

.platform-option span {
  color: var(--demo-text-strong);
  font-size: 11px;
  font-weight: 700;
}

.platform-option strong,
.master-slider strong {
  color: var(--demo-cyan);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}

.master-disclosure {
  margin: 14px;
  height: 34px;
  border: 1px solid var(--demo-border);
  border-radius: 6px;
  background: var(--master-surface);
  color: var(--demo-text);
  cursor: pointer;
  font: inherit;
  font-size: 10px;
  font-weight: 700;
}

.fine-tune {
  display: grid;
  gap: 12px;
  padding: 0 14px 14px;
}

.master-slider {
  display: grid;
  grid-template-columns: minmax(120px, 180px) minmax(0, 1fr) 64px;
  gap: 14px;
  align-items: center;
  color: var(--demo-text);
  font-size: 11px;
}

.master-slider__label {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
}

.master-param-info {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  margin: 0 0 0 2px;
  border: 1px solid var(--demo-border);
  border-radius: 50%;
  background: transparent;
  color: var(--demo-text-muted);
  cursor: pointer;
  vertical-align: middle;
  transition: color 0.18s ease, border-color 0.18s ease, background-color 0.18s ease;
}

.master-param-info > span {
  display: block;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 10px;
  font-weight: 700;
  font-style: italic;
  line-height: 1;
  letter-spacing: 0;
  transform: translateY(-0.5px);
}

.master-param-info:hover,
.master-param-info:focus-visible {
  color: var(--demo-accent);
  border-color: var(--demo-accent);
  background: var(--demo-accent-subtle);
  outline: none;
}

.module-editor__guide {
  color: var(--demo-cyan);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-decoration: none;
  text-transform: uppercase;
  cursor: pointer;
  font-family: inherit;
}

button.module-editor__guide::after {
  content: '→';
  margin-left: 6px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  transition: transform 0.2s ease;
  display: inline-block;
}

button.module-editor__guide:hover {
  color: var(--demo-accent-light);
  text-decoration: none;
  border-color: var(--demo-accent-border);
}

button.module-editor__guide:hover::after {
  transform: translateX(2px);
}

.master-slider input {
  width: 100%;
  accent-color: var(--demo-accent);
}

.master-actions {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px;
  border: 1px solid var(--demo-border-strong);
  border-radius: 8px;
  background: var(--demo-bg-elevated);
}

.master-action {
  min-height: 44px;
  border: 1px solid var(--demo-accent);
  border-radius: 8px;
  background: var(--demo-accent);
  color: #fff;
  cursor: pointer;
  font: inherit;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.06em;
  padding: 0 20px;
}

.master-action--small {
  width: fit-content;
  min-height: 36px;
}

.master-action:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.master-actions span {
  color: var(--demo-text-muted);
  font-size: 10px;
}

.render-progress {
  display: grid;
  gap: 8px;
  min-width: min(360px, 100%);
}

.render-progress__track {
  height: 6px;
  overflow: hidden;
  border: 1px solid var(--demo-border);
  border-radius: 999px;
  background: var(--master-surface-strong);
}

.render-progress__track span {
  display: block;
  height: 100%;
  width: 0;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--demo-cyan), var(--demo-accent));
  transition: width 180ms ease;
}

.render-progress:not(.render-progress--active) .render-progress__track {
  opacity: 0.35;
}

.studio-render {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: minmax(280px, 1fr) minmax(0, 1.4fr);
  gap: 14px;
  align-items: stretch;
}

@media (max-width: 880px) {
  .studio-render {
    grid-template-columns: minmax(0, 1fr);
  }
}

.studio-output {
  display: grid;
  grid-template-columns: minmax(160px, 0.9fr) minmax(0, 1.6fr) auto;
  align-items: center;
  gap: 14px;
  padding: 12px 16px;
  border: 1px solid var(--demo-border);
  border-radius: 10px;
  background: var(--master-surface-strong);
  box-shadow: inset 0 1px 0 color-mix(in srgb, white 4%, transparent);
}

.studio-output__meta {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.studio-output__meta em {
  flex: none;
  padding: 2px 8px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--demo-accent) 18%, transparent);
  color: var(--demo-accent);
  font-style: normal;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.16em;
}

.studio-output__meta span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--demo-text-muted);
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 11px;
  letter-spacing: 0.04em;
}

.studio-output__bar {
  min-width: 0;
}

.studio-output__cta {
  white-space: nowrap;
}

.studio-output:has(.render-progress--active) .studio-output__meta span {
  color: var(--demo-accent);
}

.master-studio {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr) 260px;
  gap: 14px;
}

.studio-source {
  grid-column: 1 / -1;
}

.studio-source__drop {
  position: relative;
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
  min-height: 64px;
  padding: 10px 14px;
  border: 1px dashed var(--demo-border-strong);
  border-radius: 10px;
  background:
    linear-gradient(rgba(139, 92, 246, 0.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(139, 92, 246, 0.035) 1px, transparent 1px);
  background-size: 24px 24px;
  cursor: pointer;
  transition: border-color 0.2s ease, background-color 0.2s ease;
}

.studio-source__drop:hover {
  border-color: var(--demo-accent-border);
  background-color: var(--demo-accent-subtle);
}

.studio-source__drop input {
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
}

.studio-source__icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border: 1px solid var(--demo-border-strong);
  border-radius: 8px;
  color: var(--demo-accent-light);
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.06em;
}

html:not(.dark) .master-page .studio-source__icon {
  color: var(--demo-accent);
}

.studio-source__meta {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.studio-source__meta strong {
  color: var(--demo-text-strong);
  font-family: 'Space Grotesk', sans-serif;
  font-size: 13px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.studio-source__meta em {
  color: var(--demo-text-muted);
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-style: normal;
  letter-spacing: 0.04em;
}

.studio-source__cta {
  padding: 8px 16px;
  border: 1px solid var(--demo-accent-border);
  border-radius: 6px;
  background: var(--demo-accent-subtle);
  color: var(--demo-accent-light);
  font-family: 'Space Grotesk', sans-serif;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.01em;
  white-space: nowrap;
  transition: background-color 0.18s ease, color 0.18s ease, border-color 0.18s ease;
}

html:not(.dark) .master-page .studio-source__cta {
  color: var(--demo-accent);
}

.studio-source__drop:hover .studio-source__cta {
  background: color-mix(in srgb, var(--demo-accent) 22%, transparent);
  border-color: var(--demo-accent);
  color: var(--demo-text-strong);
}

.signal-flow {
  display: grid;
  gap: 6px;
  padding: 12px;
  margin: 0;
  list-style: none;
}

.signal-flow__row {
  position: relative;
}

.signal-flow__row + .signal-flow__row::before {
  content: '';
  position: absolute;
  top: -7px;
  left: 22px;
  width: 1px;
  height: 8px;
  background: var(--demo-border-strong);
  opacity: 0.6;
}

.signal-flow__btn {
  position: relative;
  display: grid;
  grid-template-columns: 32px 10px 1fr 14px;
  align-items: center;
  gap: 10px;
  width: 100%;
  height: 38px;
  padding: 0 10px 0 6px;
  border: 1px solid var(--demo-border);
  border-radius: 6px;
  background: var(--master-surface);
  cursor: pointer;
  font: inherit;
  text-align: left;
  color: var(--demo-text);
  transition: background-color 0.18s ease, border-color 0.18s ease;
}

/* Active-tab style accent rail flush with the button's left edge — sits over the border
   instead of floating beside the stage badge. */
.signal-flow__btn::before {
  content: '';
  position: absolute;
  left: -1px;
  top: -1px;
  bottom: -1px;
  width: 3px;
  border-radius: 6px 0 0 6px;
  background: var(--demo-accent);
  opacity: 0;
  transform: scaleY(0.45);
  transform-origin: center;
  transition: opacity 0.18s ease, transform 0.22s cubic-bezier(0.32, 0.72, 0.24, 1);
  pointer-events: none;
}

.signal-flow__btn:hover {
  background: var(--master-surface-strong);
  border-color: var(--demo-border-strong);
}

.signal-flow__btn:hover::before {
  opacity: 0.35;
  transform: scaleY(0.7);
}

.signal-flow__row--active .signal-flow__btn {
  background: var(--demo-accent-subtle);
  border-color: var(--demo-accent-border);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--demo-accent) 12%, transparent);
}

.signal-flow__row--active .signal-flow__btn::before {
  opacity: 1;
  transform: scaleY(1);
  box-shadow: 0 0 8px color-mix(in srgb, var(--demo-accent) 55%, transparent);
}

.signal-flow__stage {
  display: inline-grid;
  place-items: center;
  height: 22px;
  border: 1px solid var(--demo-border-strong);
  border-radius: 4px;
  background: var(--master-code-bg);
  color: var(--demo-cyan);
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.04em;
  font-variant-numeric: tabular-nums;
}

.signal-flow__row--active .signal-flow__stage {
  border-color: var(--demo-accent);
  background: var(--demo-accent);
  color: #fff;
}

.signal-flow__led {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 1px solid var(--demo-border-strong);
  background: var(--master-code-bg);
  transition: background-color 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.signal-flow__row--active .signal-flow__led {
  background: var(--demo-accent);
  border-color: var(--demo-accent);
  box-shadow: 0 0 6px color-mix(in srgb, var(--demo-accent) 70%, transparent);
}

.signal-flow__label {
  overflow: hidden;
  color: var(--demo-text-strong);
  font-family: 'Space Grotesk', sans-serif;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: -0.005em;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.signal-flow__chev {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--demo-text-faint);
  transition: color 0.18s ease, transform 0.18s ease;
}

.signal-flow__row--active .signal-flow__chev {
  color: var(--demo-accent);
  transform: translateX(2px);
}

.studio-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  padding: 0 12px 12px;
}

/* Tooltip wrappers must fill the grid cell so all action buttons share the same width. */
.studio-actions > :deep(.tt-trigger) {
  display: block;
  width: 100%;
}

.studio-actions > :deep(.tt-trigger > .studio-actions__button) {
  display: flex;
  width: 100%;
}

.studio-actions__button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 34px;
  padding: 0 10px;
  border: 1px solid var(--demo-border);
  border-radius: 6px;
  background: var(--master-surface);
  color: var(--demo-text);
  cursor: pointer;
  font: inherit;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.01em;
  text-align: center;
  text-decoration: none;
  transition: background-color 0.18s ease, color 0.18s ease, border-color 0.18s ease;
}

.studio-actions__button:hover,
.studio-actions__button:focus-visible {
  border-color: var(--demo-accent);
  color: var(--demo-text-strong);
  background: color-mix(in srgb, var(--demo-accent) 10%, transparent);
  outline: none;
}

.studio-actions__button--link {
  grid-column: 1 / -1;
  background: var(--demo-accent-subtle);
  color: var(--demo-accent-light);
  border-color: var(--demo-accent-border);
}

html:not(.dark) .master-page .studio-actions__button--link {
  color: var(--demo-accent);
}

.studio-actions__button--link:hover {
  background: color-mix(in srgb, var(--demo-accent) 22%, transparent);
  color: var(--demo-text-strong);
  border-color: var(--demo-accent);
}

.studio-actions__button--import input {
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
}

.module-editor {
  display: grid;
  gap: 14px;
  padding: 16px;
}

.module-editor__note {
  margin: 0;
  padding: 12px 14px;
  border: 1px solid var(--demo-border);
  border-radius: 8px;
  background: var(--master-surface);
  color: var(--demo-text);
  font-family: 'Space Grotesk', sans-serif;
  font-size: 12.5px;
  line-height: 1.55;
}

.module-editor__head {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 16px;
  padding: 12px 14px;
  border: 1px solid var(--demo-border);
  border-radius: 8px;
  background: var(--demo-bg-elevated);
  position: relative;
}

.module-editor__head::before {
  content: '';
  position: absolute;
  left: 4px;
  top: 10px;
  bottom: 10px;
  width: 2px;
  border-radius: 2px;
  background: var(--demo-accent);
  opacity: 0.7;
  pointer-events: none;
}

.module-editor__stage {
  display: inline-flex;
  align-items: baseline;
  gap: 5px;
  padding: 6px 10px;
  border: 1px solid var(--demo-accent-border);
  border-radius: 6px;
  background: var(--demo-accent-subtle);
  font-family: 'JetBrains Mono', monospace;
  font-variant-numeric: tabular-nums;
}

.module-editor__stage em {
  color: var(--demo-text-muted);
  font-size: 8px;
  font-style: normal;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.module-editor__stage strong {
  color: var(--demo-accent-light);
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.01em;
}

html:not(.dark) .master-page .module-editor__stage strong {
  color: var(--demo-accent);
}

.module-editor__stage small {
  color: var(--demo-text-muted);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.module-editor__id {
  display: grid;
  grid-template-columns: 10px minmax(0, 1fr);
  column-gap: 12px;
  row-gap: 2px;
  align-items: center;
  min-width: 0;
}

.module-editor__led {
  grid-row: 1 / span 2;
  align-self: center;
  display: block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--demo-accent);
  box-shadow: 0 0 8px color-mix(in srgb, var(--demo-accent) 70%, transparent);
  animation: led-pulse 2.4s ease-in-out infinite;
}

@keyframes led-pulse {
  0%, 100% { opacity: 0.9; }
  50%      { opacity: 0.55; }
}

.module-editor__id h3 {
  margin: 0;
  color: var(--demo-text-strong);
  font-family: 'Space Grotesk', sans-serif;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.01em;
  line-height: 1.2;
}

.module-editor__id small {
  color: var(--demo-text);
  font-family: 'Space Grotesk', sans-serif;
  font-size: 11.5px;
  font-weight: 400;
  line-height: 1.45;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.module-editor__info {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 1px solid var(--demo-border);
  border-radius: 50%;
  background: var(--master-code-bg);
  color: var(--demo-text-muted);
  cursor: pointer;
  transition: color 0.18s ease, border-color 0.18s ease, background-color 0.18s ease;
}

.module-editor__info > span {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 11px;
  font-style: italic;
  font-weight: 700;
  transform: translateY(-0.5px);
}

.module-editor__info:hover,
.module-editor__info:focus-visible {
  color: var(--demo-accent);
  border-color: var(--demo-accent);
  background: var(--demo-accent-subtle);
  outline: none;
}

.module-editor__knobs {
  display: flex;
  flex-wrap: wrap;
  gap: 18px 22px;
  padding: 18px 16px;
  border: 1px solid var(--demo-border);
  border-radius: 8px;
  background: var(--demo-bg-elevated);
}

.module-editor__reset {
  display: flex;
  justify-content: flex-end;
  margin-top: 4px;
}

.module-editor__reset-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 28px;
  padding: 0 12px;
  border: 1px solid var(--demo-border-strong);
  border-radius: 6px;
  background: var(--master-surface);
  color: var(--demo-text-muted);
  cursor: pointer;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  transition: color 0.18s ease, border-color 0.18s ease, background-color 0.18s ease;
}

.module-editor__reset-btn:hover:not(:disabled),
.module-editor__reset-btn:focus-visible:not(:disabled) {
  color: var(--demo-accent);
  border-color: var(--demo-accent);
  background: var(--demo-accent-subtle);
  outline: none;
}

.module-editor__reset-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.module-editor__reset-btn svg {
  flex-shrink: 0;
}

.meter-stack {
  display: grid;
  gap: 14px;
  padding: 14px;
}

/* Tooltip wraps LED meters; let them stretch across the grid cell instead of shrinking. */
.meter-stack > :deep(.tt-trigger) {
  display: block;
  width: 100%;
}

.meter-stack > :deep(.tt-trigger > button) {
  width: 100%;
}

.led-meter {
  display: grid;
  gap: 6px;
}

button.led-meter {
  margin: 0;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.18s ease, background-color 0.18s ease, box-shadow 0.18s ease;
}

button.led-meter:disabled {
  cursor: default;
}

button.led-meter:not(:disabled):hover,
button.led-meter:not(:disabled):focus-visible {
  outline: none;
  border-color: var(--demo-accent-border);
  background: color-mix(in srgb, var(--demo-accent) 8%, transparent);
}

.led-meter--active {
  border-color: var(--demo-accent) !important;
  background: color-mix(in srgb, var(--demo-accent) 12%, transparent) !important;
}

.meter-jump {
  display: block;
  margin: 0;
  padding: 4px 8px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.18s ease, background-color 0.18s ease;
}

.meter-jump:hover,
.meter-jump:focus-visible {
  outline: none;
  border-color: var(--demo-accent-border);
  background: color-mix(in srgb, var(--demo-accent) 8%, transparent);
}

.meter-jump--block {
  display: grid;
  gap: 10px;
  padding: 8px;
}

.led-meter__head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  color: var(--demo-text-muted);
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.led-meter__head strong {
  color: var(--demo-text-strong);
  font-weight: 700;
  text-transform: none;
  letter-spacing: 0.02em;
  font-variant-numeric: tabular-nums;
}

.led-meter__leds {
  display: grid;
  grid-template-columns: repeat(48, 1fr);
  gap: 1px;
  height: 14px;
  padding: 2px;
  border: 1px solid var(--demo-border);
  border-radius: 4px;
  background: var(--master-code-bg);
}

.led-meter__seg {
  height: 100%;
  background: color-mix(in srgb, var(--demo-accent) 10%, transparent);
  transition: background-color 0.18s ease, box-shadow 0.18s ease;
}

/* Every 10th segment carries a brighter top edge to act as a major tick mark. */
.led-meter__seg.led-meter__seg--major {
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--demo-text-muted) 35%, transparent);
}

.led-meter__seg.led-meter__seg--on {
  background: var(--demo-accent);
  box-shadow: 0 0 3px color-mix(in srgb, var(--demo-accent) 50%, transparent);
}

.led-meter__seg.led-meter__seg--on.led-meter__seg--major {
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, white 35%, transparent),
    0 0 4px color-mix(in srgb, var(--demo-accent) 60%, transparent);
}

.led-meter__seg.led-meter__seg--peak {
  background: var(--demo-amber);
  box-shadow: 0 0 4px color-mix(in srgb, var(--demo-amber) 60%, transparent);
}

.led-meter__seg.led-meter__seg--peak.led-meter__seg--major {
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, white 40%, transparent),
    0 0 5px color-mix(in srgb, var(--demo-amber) 70%, transparent);
}

html:not(.dark) .master-page .led-meter__seg {
  background: color-mix(in srgb, var(--demo-accent) 14%, transparent);
}

html:not(.dark) .master-page .led-meter__seg.led-meter__seg--on {
  background: var(--demo-accent);
}

.phase-scope {
  position: relative;
  aspect-ratio: 1;
  min-height: 170px;
  overflow: hidden;
  border: 1px solid var(--demo-border);
  border-radius: 8px;
  background:
    linear-gradient(rgba(139, 92, 246, 0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(139, 92, 246, 0.08) 1px, transparent 1px),
    radial-gradient(circle at center, rgba(34, 211, 238, 0.08), transparent 68%);
  background-size: 25% 25%, 25% 25%, 100% 100%;
}

.phase-scope::before,
.phase-scope::after {
  content: "";
  position: absolute;
  background: var(--demo-border-strong);
}

.phase-scope::before {
  left: 50%;
  top: 0;
  width: 1px;
  height: 100%;
}

.phase-scope::after {
  left: 0;
  top: 50%;
  width: 100%;
  height: 1px;
}

.phase-scope span {
  position: absolute;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--demo-accent-light);
  box-shadow: 0 0 8px -1px color-mix(in srgb, var(--demo-accent) 60%, transparent);
  transform: translate(-50%, -50%);
}

.stereo-image {
  display: grid;
  gap: 8px;
}

.stereo-image__bar {
  display: grid;
  place-items: center;
  height: 28px;
  border: 1px solid var(--demo-border);
  border-radius: 999px;
  background: var(--master-track-bg);
}

.stereo-image__bar span {
  display: block;
  height: 10px;
  border-radius: 999px;
  background: var(--demo-accent);
  opacity: 0.78;
}

.stereo-image strong {
  color: var(--demo-text-muted);
  font-size: 10px;
  text-align: center;
}

.master-result {
  margin-top: 14px;
}

.reference-panel {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) minmax(260px, 1fr) minmax(180px, 0.7fr);
  gap: 14px;
  padding: 14px;
  align-items: stretch;
}

.reference-panel__drop {
  display: grid;
  place-items: center;
  min-height: 116px;
  padding: 16px;
  border: 1px dashed var(--demo-border-strong);
  border-radius: 8px;
  color: var(--demo-text-strong);
  cursor: pointer;
  text-align: center;
  overflow-wrap: anywhere;
}

.reference-panel__drop input {
  display: none;
}

.reference-panel__compare {
  display: grid;
  align-content: center;
  gap: 8px;
  padding: 14px;
  border: 1px solid var(--demo-border);
  border-radius: 8px;
  background: var(--master-surface);
}

.reference-panel__compare span {
  color: var(--demo-text-muted);
  font-size: 10px;
}

.reference-panel__compare strong {
  color: var(--demo-cyan);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.reference-panel__button {
  min-height: 34px;
  width: 100%;
  border: 1px solid var(--demo-border-strong);
  border-radius: 8px;
  background: rgba(139, 92, 246, 0.14);
  color: var(--demo-text-strong);
  cursor: pointer;
  font: inherit;
  font-size: 10px;
  font-weight: 800;
}

.reference-panel__button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.result-grid {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 14px;
  padding: 14px;
}

.result-player {
  display: grid;
  gap: 12px;
  align-content: start;
}

.ab-controls,
.result-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.ab-controls__button {
  min-width: 88px;
  height: 34px;
  border: 1px solid var(--demo-border);
  border-radius: 6px;
  background: var(--master-surface);
  color: var(--demo-text);
  cursor: pointer;
  font: inherit;
  font-size: 10px;
  font-weight: 800;
}

.ab-controls__button--active {
  border-color: var(--demo-accent);
  background: rgba(139, 92, 246, 0.16);
  color: var(--demo-text-strong);
}

.ab-controls__button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.ab-controls__toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--demo-text-muted);
  font-size: 10px;
}

.ab-controls__toggle input {
  accent-color: var(--demo-accent);
}

.result-player audio {
  width: 100%;
}

.master-download {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 38px;
  width: fit-content;
  padding: 0 16px;
  border: 1px solid var(--demo-border-strong);
  border-radius: 8px;
  color: var(--demo-text-strong);
  text-decoration: none;
  font-size: 10px;
  font-weight: 800;
}

.master-download--disabled {
  pointer-events: none;
  opacity: 0.4;
}

.result-stages {
  margin: 0;
  color: var(--demo-text-muted);
  font-size: 10px;
  line-height: 1.6;
}

.result-note {
  margin: 0;
  color: var(--demo-text-muted);
  font-size: 10px;
  line-height: 1.6;
}

.master-error {
  margin: 0;
  color: var(--demo-danger);
  font-size: 11px;
}

.intro-modal {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(4, 5, 9, 0.7);
  backdrop-filter: blur(10px);
}

html:not(.dark) .master-page .intro-modal {
  background: rgba(40, 30, 70, 0.42);
}

.intro-modal__panel {
  width: min(520px, 100%);
  padding: 22px;
  border: 1px solid var(--demo-border-strong);
  border-radius: 10px;
  background: var(--demo-bg-elevated);
  box-shadow: 0 24px 64px -16px rgba(0, 0, 0, 0.45), var(--demo-shadow-glow);
  backdrop-filter: blur(20px);
}

html:not(.dark) .master-page .intro-modal__panel {
  background: rgba(255, 255, 255, 0.96);
}

.intro-modal__panel h2 {
  margin: 0 0 12px;
  color: var(--demo-text-strong);
  font-family: 'Space Grotesk', sans-serif;
  font-size: 24px;
  letter-spacing: 0;
}

.intro-modal__panel p,
.intro-modal__panel li {
  color: var(--demo-text);
  font-size: 13px;
  line-height: 1.65;
}

.intro-modal__panel ul {
  display: grid;
  gap: 8px;
  padding-left: 18px;
  margin: 14px 0 0;
}

.intro-modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  align-items: center;
  margin-top: 18px;
}

.intro-modal__actions a {
  color: var(--demo-cyan);
  font-size: 11px;
  font-weight: 800;
  text-decoration: none;
  cursor: pointer;
  background: transparent;
  border: 0;
  padding: 4px 2px;
  font-family: inherit;
  letter-spacing: 0.02em;
}

.intro-modal__actions a:hover {
  color: var(--demo-accent-light);
  text-decoration: underline;
}

@media (max-width: 900px) {
  .master-page__header {
    flex-wrap: wrap;
    gap: 10px;
  }

  .master-page__header-left,
  .master-page__header-right {
    gap: 8px;
  }

  .master-page__tagline,
  .master-page__privacy,
  .master-page__version {
    display: none;
  }

  .master-page__chrome {
    top: auto;
    position: static;
    flex-wrap: wrap;
  }

  .master-page__main {
    width: min(100% - 28px, 720px);
  }

  .preset-grid,
  .platform-grid,
  .master-studio,
  .reference-panel,
  .result-grid {
    grid-template-columns: 1fr;
  }

  .master-slider {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .master-page__header {
    padding: 10px 16px;
  }

  .master-page__chrome {
    padding: 8px 16px;
  }

  .master-page__statusbar-inner {
    padding: 7px 16px;
    gap: 12px;
  }

  .master-page__statusbar-value--file {
    max-width: 120px;
  }

  .master-page__cta svg {
    display: none;
  }

  .master-page__docs-link {
    display: none;
  }
}
</style>

<style>
/* Global (non-scoped) — toggle sun/moon icons via html.dark, mirroring DemoLayout */
html.dark .master-page__icon-sun { display: block; }
html.dark .master-page__icon-moon { display: none; }
</style>
