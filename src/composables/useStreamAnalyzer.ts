import { ref, shallowRef, onUnmounted } from 'vue'
import type {
  StreamAnalyzer,
  StreamConfig,
  FrameBuffer,
  ProgressiveEstimate,
  BarChord,
} from '@/wasm/index'

export interface StreamingData {
  chroma: Float32Array
  rms: Float32Array
  mel: Float32Array
  spectralCentroid: Float32Array
  spectralFlatness: Float32Array
  onsetStrength: Float32Array
  timestamps: Float32Array
  nFrames: number
  nMels: number
  nChroma: number
}

export interface BarChordInfo {
  barIndex: number
  chord: string
  startTime: number
  confidence: number
}

export interface ChordProgressionPattern {
  key: string      // i18n key for the pattern name
  degrees: string  // e.g., "I-V-VIm-IV"
  confidence: number
}

export interface StreamEstimate {
  bpm: number
  bpmConfidence: number
  key: string
  keyConfidence: number
  chord: string
  chordConfidence: number
  barChordProgression: BarChordInfo[]
  votedPattern: string[]  // C++ computed voted pattern (e.g., ['C', 'G', 'F', 'F'])
  detectedPatternName: string  // C++ detected pattern name (e.g., 'royalRoad')
  detectedPatternScore: number
  progressionPattern: ChordProgressionPattern | null  // Fallback JS detection
  currentBar: number
  barDuration: number
  accumulatedSeconds: number
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
// ChordQuality: Major=0, Minor=1, Diminished=2, Augmented=3, Dominant7=4, Major7=5, Minor7=6, Sus2=7, Sus4=8
const CHORD_QUALITY_NAMES = ['', 'm', 'dim', 'aug', '7', 'M7', 'm7', 'sus2', 'sus4']

function keyToName(keyIndex: number, isMinor: boolean): string {
  const note = NOTE_NAMES[keyIndex % 12]
  return isMinor ? `${note}m` : note
}

function chordToName(root: number, quality: number): string {
  if (root < 0 || root > 11) return '-'
  const note = NOTE_NAMES[root]
  const suffix = CHORD_QUALITY_NAMES[quality] || ''
  return `${note}${suffix}`
}

function barChordToInfo(bc: BarChord): BarChordInfo {
  return {
    barIndex: bc.barIndex,
    chord: chordToName(bc.root, bc.quality),
    startTime: bc.startTime,
    confidence: bc.confidence,
  }
}

// Roman numeral names for scale degrees
const DEGREE_NAMES = ['I', 'bII', 'II', 'bIII', 'III', 'IV', 'bV', 'V', 'bVI', 'VI', 'bVII', 'VII']

// Known chord progression patterns (4-bar patterns)
interface ProgressionDef {
  key: string  // i18n key (demo.patterns.{key})
  // Pattern as array of [degree, quality] pairs
  // degree: 0=I, 1=bII, 2=II, 3=bIII, 4=III, 5=IV, 6=bV, 7=V, 8=bVI, 9=VI, 10=bVII, 11=VII
  // quality: 0=Major, 1=Minor, 2=Dim
  pattern: Array<[number, number]>
}

const PROGRESSION_PATTERNS: ProgressionDef[] = [
  { key: 'royalRoad', pattern: [[0, 0], [7, 0], [9, 1], [5, 0]] },  // I-V-VIm-IV
  { key: 'komuro', pattern: [[9, 1], [5, 0], [7, 0], [0, 0]] },  // VIm-IV-V-I
  { key: 'canon', pattern: [[0, 0], [7, 0], [9, 1], [4, 1]] },  // I-V-VIm-IIIm
  { key: 'popPunk', pattern: [[0, 0], [7, 0], [5, 0], [9, 1]] },  // I-V-IV-VIm
  { key: 'fifties', pattern: [[0, 0], [9, 1], [5, 0], [7, 0]] },  // I-VIm-IV-V
  { key: 'sad', pattern: [[9, 1], [5, 0], [0, 0], [7, 0]] },  // VIm-IV-I-V
  { key: 'blues', pattern: [[0, 0], [5, 0], [0, 0], [7, 0]] },  // I-IV-I-V (simplified)
]

/**
 * Convert chord root to scale degree based on key
 * @param chordRoot Chord root (0-11, C=0)
 * @param keyRoot Key root (0-11, C=0)
 * @returns Scale degree (0-11, I=0)
 */
function chordToDegree(chordRoot: number, keyRoot: number): number {
  return (chordRoot - keyRoot + 12) % 12
}

/**
 * Detect chord progression pattern from bar chords
 * @param barChords Array of bar chord info
 * @param keyRoot Key root (0-11)
 * @returns Detected pattern or null
 */
function detectProgressionPattern(
  barChords: Array<{ root: number; quality: number }>,
  keyRoot: number
): ChordProgressionPattern | null {
  if (barChords.length < 4) return null

  // Convert to degrees (use last 4 or 8 bars for pattern matching)
  const recentChords = barChords.slice(-8)
  const degrees = recentChords.map(bc => ({
    degree: chordToDegree(bc.root, keyRoot),
    quality: bc.quality,
  }))

  // Try to match 4-bar patterns
  let bestMatch: { pattern: ProgressionDef; confidence: number } | null = null

  for (const patternDef of PROGRESSION_PATTERNS) {
    const patternLen = patternDef.pattern.length

    // Slide through the chord sequence
    for (let start = 0; start <= degrees.length - patternLen; start++) {
      let matches = 0
      for (let i = 0; i < patternLen; i++) {
        const [expectedDegree, expectedQuality] = patternDef.pattern[i]
        const actual = degrees[start + i]

        // Degree match (exact or enharmonic equivalent)
        if (actual.degree === expectedDegree) {
          // Quality match (allow some flexibility: major/minor only for simplicity)
          const qualityMatch =
            actual.quality === expectedQuality ||
            (expectedQuality <= 1 && actual.quality <= 1)  // Allow major/minor flexibility
          if (qualityMatch) {
            matches++
          } else {
            matches += 0.5  // Partial credit for correct degree, wrong quality
          }
        }
      }

      const confidence = matches / patternLen
      if (confidence >= 0.5 && (!bestMatch || confidence > bestMatch.confidence)) {
        bestMatch = { pattern: patternDef, confidence }
      }
    }
  }

  if (bestMatch) {
    const degreeStr = bestMatch.pattern.pattern
      .map(([deg, qual]) => {
        const base = DEGREE_NAMES[deg]
        return qual === 1 ? base.toLowerCase() + 'm' : base
      })
      .join('-')

    return {
      key: bestMatch.pattern.key,
      degrees: degreeStr,
      confidence: bestMatch.confidence,
    }
  }

  return null
}

export function useStreamAnalyzer(options: StreamConfig = { sampleRate: 44100 }) {
  const isInitialized = ref(false)
  const isProcessing = ref(false)
  const error = ref<string | null>(null)

  const estimate = ref<StreamEstimate>({
    bpm: 0,
    bpmConfidence: 0,
    key: '-',
    keyConfidence: 0,
    chord: '-',
    chordConfidence: 0,
    barChordProgression: [],
    votedPattern: [],
    detectedPatternName: '',
    detectedPatternScore: 0,
    progressionPattern: null,
    currentBar: -1,
    barDuration: 0,
    accumulatedSeconds: 0,
  })

  // Use shallowRef for large typed arrays to avoid deep reactivity overhead
  const streamingData = shallowRef<StreamingData>({
    chroma: new Float32Array(0),
    rms: new Float32Array(0),
    mel: new Float32Array(0),
    spectralCentroid: new Float32Array(0),
    spectralFlatness: new Float32Array(0),
    onsetStrength: new Float32Array(0),
    timestamps: new Float32Array(0),
    nFrames: 0,
    nMels: options.nMels ?? 128,
    nChroma: 12,
  })

  // Accumulated frame buffers for visualization
  const chromaHistory: Float32Array[] = []
  const rmsHistory: Float32Array[] = []
  const melHistory: Float32Array[] = []
  const timestampHistory: Float32Array[] = []
  const spectralCentroidHistory: Float32Array[] = []
  const spectralFlatnessHistory: Float32Array[] = []
  const onsetStrengthHistory: Float32Array[] = []

  let analyzer: StreamAnalyzer | null = null
  let wasmModule: typeof import('@/wasm/index') | null = null

  const defaultConfig: StreamConfig = {
    sampleRate: 44100,
    nFft: 2048,
    hopLength: 512,
    nMels: 128,
    computeMel: true,
    computeChroma: true,
    computeOnset: true,
    emitEveryNFrames: 1,
    ...options,
  }

  async function init(): Promise<void> {
    if (isInitialized.value) return

    try {
      wasmModule = await import('@/wasm/index')
      await wasmModule.init()
      analyzer = new wasmModule.StreamAnalyzer(defaultConfig)
      isInitialized.value = true
      error.value = null
    } catch (e) {
      error.value = `Failed to initialize StreamAnalyzer: ${e}`
      console.error(error.value)
    }
  }

  async function reinit(newSampleRate: number): Promise<void> {
    if (!wasmModule) {
      await init()
    }

    // Dispose existing analyzer
    if (analyzer) {
      analyzer.dispose()
    }

    // Use the actual sample rate from AudioContext
    // C++ StreamAnalyzer handles resampling internally for high sample rates
    defaultConfig.sampleRate = newSampleRate
    defaultConfig.nFft = options.nFft ?? 2048
    defaultConfig.hopLength = options.hopLength ?? 512

    analyzer = new wasmModule!.StreamAnalyzer(defaultConfig)

    // Clear accumulated data
    chromaHistory.length = 0
    rmsHistory.length = 0
    melHistory.length = 0
    timestampHistory.length = 0
    spectralCentroidHistory.length = 0
    spectralFlatnessHistory.length = 0
    onsetStrengthHistory.length = 0
  }

  function process(samples: Float32Array): void {
    if (!analyzer || !isInitialized.value) return

    isProcessing.value = true

    // Pass samples directly to C++ analyzer
    // (C++ handles resampling internally if needed for high sample rates)
    analyzer.process(samples)

    // Read available frames
    const availableFrames = analyzer.availableFrames()
    if (availableFrames > 0) {
      const frames = analyzer.readFrames(availableFrames)
      accumulateFrames(frames)
      updateStreamingData()
    }

    // Update progressive estimates
    const stats = analyzer.stats()
    updateEstimate(stats.estimate)

    isProcessing.value = false
  }

  function accumulateFrames(frames: FrameBuffer): void {
    if (frames.nFrames === 0) return

    const nChroma = 12
    const nMels = defaultConfig.nMels ?? 128

    // Accumulate chroma (12 values per frame)
    chromaHistory.push(new Float32Array(frames.chroma))

    // Accumulate RMS
    rmsHistory.push(new Float32Array(frames.rmsEnergy))

    // Accumulate mel (nMels values per frame)
    melHistory.push(new Float32Array(frames.mel))

    // Accumulate timestamps
    timestampHistory.push(new Float32Array(frames.timestamps))

    // Accumulate spectral features
    spectralCentroidHistory.push(new Float32Array(frames.spectralCentroid))
    spectralFlatnessHistory.push(new Float32Array(frames.spectralFlatness))
    onsetStrengthHistory.push(new Float32Array(frames.onsetStrength))

    // Limit history length (keep ~30 seconds worth at 44100/512 ≈ 86 fps)
    const maxChunks = 300
    while (chromaHistory.length > maxChunks) {
      chromaHistory.shift()
      rmsHistory.shift()
      melHistory.shift()
      timestampHistory.shift()
      spectralCentroidHistory.shift()
      spectralFlatnessHistory.shift()
      onsetStrengthHistory.shift()
    }
  }

  function updateStreamingData(): void {
    const nChroma = 12
    const nMels = defaultConfig.nMels ?? 128

    // Calculate total frames
    let totalFrames = 0
    for (const chunk of rmsHistory) {
      totalFrames += chunk.length
    }

    if (totalFrames === 0) return

    // Flatten arrays
    const flatChroma = new Float32Array(totalFrames * nChroma)
    const flatRms = new Float32Array(totalFrames)
    const flatMel = new Float32Array(totalFrames * nMels)
    const flatTimestamps = new Float32Array(totalFrames)
    const flatSpectralCentroid = new Float32Array(totalFrames)
    const flatSpectralFlatness = new Float32Array(totalFrames)
    const flatOnsetStrength = new Float32Array(totalFrames)

    let frameOffset = 0
    for (let i = 0; i < rmsHistory.length; i++) {
      const chunkFrames = rmsHistory[i].length

      // Copy RMS
      flatRms.set(rmsHistory[i], frameOffset)

      // Copy timestamps
      flatTimestamps.set(timestampHistory[i], frameOffset)

      // Copy spectral features
      flatSpectralCentroid.set(spectralCentroidHistory[i], frameOffset)
      flatSpectralFlatness.set(spectralFlatnessHistory[i], frameOffset)
      flatOnsetStrength.set(onsetStrengthHistory[i], frameOffset)

      // Copy chroma (interleaved)
      const chromaChunk = chromaHistory[i]
      for (let f = 0; f < chunkFrames; f++) {
        for (let c = 0; c < nChroma; c++) {
          flatChroma[(frameOffset + f) * nChroma + c] = chromaChunk[f * nChroma + c] || 0
        }
      }

      // Copy mel (interleaved)
      const melChunk = melHistory[i]
      for (let f = 0; f < chunkFrames; f++) {
        for (let m = 0; m < nMels; m++) {
          flatMel[(frameOffset + f) * nMels + m] = melChunk[f * nMels + m] || 0
        }
      }

      frameOffset += chunkFrames
    }

    streamingData.value = {
      chroma: flatChroma,
      rms: flatRms,
      mel: flatMel,
      spectralCentroid: flatSpectralCentroid,
      spectralFlatness: flatSpectralFlatness,
      onsetStrength: flatOnsetStrength,
      timestamps: flatTimestamps,
      nFrames: totalFrames,
      nMels,
      nChroma,
    }
  }

  function updateEstimate(progressiveEstimate: ProgressiveEstimate): void {
    if (!progressiveEstimate.updated) return

    const barChords = progressiveEstimate.barChordProgression || []
    const keyRoot = progressiveEstimate.key

    // Get C++ computed voted pattern
    const votedPatternFromCpp = (progressiveEstimate.votedPattern || [])
      .map(bc => chordToName(bc.root, bc.quality))

    // Fallback: Detect chord progression pattern in JS (if C++ pattern not available)
    const pattern = detectProgressionPattern(
      barChords.map(bc => ({ root: bc.root, quality: bc.quality })),
      keyRoot
    )

    estimate.value = {
      bpm: Math.round(progressiveEstimate.bpm * 10) / 10,
      bpmConfidence: progressiveEstimate.bpmConfidence,
      key: progressiveEstimate.keyConfidence > 0.3
        ? keyToName(progressiveEstimate.key, progressiveEstimate.keyMinor)
        : '-',
      keyConfidence: progressiveEstimate.keyConfidence,
      chord: progressiveEstimate.chordConfidence > 0.3
        ? chordToName(progressiveEstimate.chordRoot, progressiveEstimate.chordQuality)
        : '-',
      chordConfidence: progressiveEstimate.chordConfidence,
      barChordProgression: barChords.map(barChordToInfo),
      votedPattern: votedPatternFromCpp,
      detectedPatternName: progressiveEstimate.detectedPatternName || '',
      detectedPatternScore: progressiveEstimate.detectedPatternScore || 0,
      progressionPattern: pattern,
      currentBar: progressiveEstimate.currentBar,
      barDuration: progressiveEstimate.barDuration,
      accumulatedSeconds: progressiveEstimate.accumulatedSeconds,
    }
  }

  function setExpectedDuration(durationSeconds: number): void {
    if (analyzer) {
      analyzer.setExpectedDuration(durationSeconds)
    }
  }

  function setNormalizationGain(gain: number): void {
    if (analyzer) {
      analyzer.setNormalizationGain(gain)
    }
  }

  function reset(): void {
    if (analyzer) {
      analyzer.reset()
    }

    chromaHistory.length = 0
    rmsHistory.length = 0
    melHistory.length = 0
    timestampHistory.length = 0
    spectralCentroidHistory.length = 0
    spectralFlatnessHistory.length = 0
    onsetStrengthHistory.length = 0

    streamingData.value = {
      chroma: new Float32Array(0),
      rms: new Float32Array(0),
      mel: new Float32Array(0),
      spectralCentroid: new Float32Array(0),
      spectralFlatness: new Float32Array(0),
      onsetStrength: new Float32Array(0),
      timestamps: new Float32Array(0),
      nFrames: 0,
      nMels: defaultConfig.nMels ?? 128,
      nChroma: 12,
    }

    estimate.value = {
      bpm: 0,
      bpmConfidence: 0,
      key: '-',
      keyConfidence: 0,
      chord: '-',
      chordConfidence: 0,
      barChordProgression: [],
      votedPattern: [],
      detectedPatternName: '',
      detectedPatternScore: 0,
      progressionPattern: null,
      currentBar: -1,
      barDuration: 0,
      accumulatedSeconds: 0,
    }
  }

  function destroy(): void {
    analyzer = null
    wasmModule = null
    isInitialized.value = false
    reset()
  }

  onUnmounted(() => {
    destroy()
  })

  return {
    isInitialized,
    isProcessing,
    error,
    estimate,
    streamingData,
    init,
    reinit,
    process,
    setExpectedDuration,
    setNormalizationGain,
    reset,
    destroy,
  }
}
