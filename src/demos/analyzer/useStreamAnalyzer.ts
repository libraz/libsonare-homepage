import { onUnmounted, ref } from 'vue';
import type { BarChord, ProgressiveEstimate, StreamAnalyzer, StreamConfig } from '@/wasm/index';

export interface BarChordInfo {
  barIndex: number;
  chord: string;
  startTime: number;
  confidence: number;
}

export interface ChordProgressionPattern {
  key: string; // i18n key for the pattern name
  degrees: string; // e.g., "I-V-VIm-IV"
  confidence: number;
}

export interface StreamEstimate {
  bpm: number;
  bpmConfidence: number;
  key: string;
  keyConfidence: number;
  chord: string;
  chordConfidence: number;
  barChordProgression: BarChordInfo[];
  votedPattern: string[]; // C++ computed voted pattern (e.g., ['C', 'G', 'F', 'F'])
  detectedPatternName: string; // C++ detected pattern name (e.g., 'royalRoad')
  detectedPatternScore: number;
  progressionPattern: ChordProgressionPattern | null; // Fallback JS detection
  currentBar: number;
  barDuration: number;
  accumulatedSeconds: number;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
// ChordQuality: Major=0, Minor=1, Diminished=2, Augmented=3, Dominant7=4, Major7=5,
// Minor7=6, Sus2=7, Sus4=8, Unknown=9, Add9=10, MinorAdd9=11, Dim7=12, HalfDim7=13,
// Major9=14, Dominant9=15, Sus2Add4=16
const CHORD_QUALITY_NAMES = [
  '',
  'm',
  'dim',
  'aug',
  '7',
  'M7',
  'm7',
  'sus2',
  'sus4',
  '',
  'add9',
  'm(add9)',
  'dim7',
  'm7b5',
  'M9',
  '9',
  'sus2add4',
];

function keyToName(keyIndex: number, isMinor: boolean): string {
  const note = NOTE_NAMES[keyIndex % 12];
  return isMinor ? `${note}m` : note;
}

function chordToName(root: number, quality: number): string {
  if (root < 0 || root > 11) return '-';
  const note = NOTE_NAMES[root];
  const suffix = CHORD_QUALITY_NAMES[quality] || '';
  return `${note}${suffix}`;
}

function barChordToInfo(bc: BarChord): BarChordInfo {
  return {
    barIndex: bc.barIndex,
    chord: chordToName(bc.root, bc.quality),
    startTime: bc.startTime,
    confidence: bc.confidence,
  };
}

// Roman numeral names for scale degrees
const DEGREE_NAMES = ['I', 'bII', 'II', 'bIII', 'III', 'IV', 'bV', 'V', 'bVI', 'VI', 'bVII', 'VII'];

// Known chord progression patterns (4-bar patterns)
interface ProgressionDef {
  key: string; // i18n key (demo.patterns.{key})
  // Pattern as array of [degree, quality] pairs
  // degree: 0=I, 1=bII, 2=II, 3=bIII, 4=III, 5=IV, 6=bV, 7=V, 8=bVI, 9=VI, 10=bVII, 11=VII
  // quality: 0=Major, 1=Minor, 2=Dim
  pattern: Array<[number, number]>;
}

const PROGRESSION_PATTERNS: ProgressionDef[] = [
  {
    key: 'royalRoad',
    pattern: [
      [0, 0],
      [7, 0],
      [9, 1],
      [5, 0],
    ],
  }, // I-V-VIm-IV
  {
    key: 'komuro',
    pattern: [
      [9, 1],
      [5, 0],
      [7, 0],
      [0, 0],
    ],
  }, // VIm-IV-V-I
  {
    key: 'canon',
    pattern: [
      [0, 0],
      [7, 0],
      [9, 1],
      [4, 1],
    ],
  }, // I-V-VIm-IIIm
  {
    key: 'popPunk',
    pattern: [
      [0, 0],
      [7, 0],
      [5, 0],
      [9, 1],
    ],
  }, // I-V-IV-VIm
  {
    key: 'fifties',
    pattern: [
      [0, 0],
      [9, 1],
      [5, 0],
      [7, 0],
    ],
  }, // I-VIm-IV-V
  {
    key: 'sad',
    pattern: [
      [9, 1],
      [5, 0],
      [0, 0],
      [7, 0],
    ],
  }, // VIm-IV-I-V
  {
    key: 'blues',
    pattern: [
      [0, 0],
      [5, 0],
      [0, 0],
      [7, 0],
    ],
  }, // I-IV-I-V (simplified)
];

/**
 * Convert chord root to scale degree based on key
 * @param chordRoot Chord root (0-11, C=0)
 * @param keyRoot Key root (0-11, C=0)
 * @returns Scale degree (0-11, I=0)
 */
function chordToDegree(chordRoot: number, keyRoot: number): number {
  return (chordRoot - keyRoot + 12) % 12;
}

/**
 * Detect chord progression pattern from bar chords
 * @param barChords Array of bar chord info
 * @param keyRoot Key root (0-11)
 * @returns Detected pattern or null
 */
function detectProgressionPattern(
  barChords: Array<{ root: number; quality: number }>,
  keyRoot: number,
): ChordProgressionPattern | null {
  if (barChords.length < 4) return null;

  // Convert to degrees (use last 4 or 8 bars for pattern matching)
  const recentChords = barChords.slice(-8);
  const degrees = recentChords.map((bc) => ({
    degree: chordToDegree(bc.root, keyRoot),
    quality: bc.quality,
  }));

  // Try to match 4-bar patterns
  let bestMatch: { pattern: ProgressionDef; confidence: number } | null = null;

  for (const patternDef of PROGRESSION_PATTERNS) {
    const patternLen = patternDef.pattern.length;

    // Slide through the chord sequence
    for (let start = 0; start <= degrees.length - patternLen; start++) {
      let matches = 0;
      for (let i = 0; i < patternLen; i++) {
        const [expectedDegree, expectedQuality] = patternDef.pattern[i];
        const actual = degrees[start + i];

        // Degree match (exact or enharmonic equivalent)
        if (actual.degree === expectedDegree) {
          // Quality match (allow some flexibility: major/minor only for simplicity)
          const qualityMatch =
            actual.quality === expectedQuality || (expectedQuality <= 1 && actual.quality <= 1); // Allow major/minor flexibility
          if (qualityMatch) {
            matches++;
          } else {
            matches += 0.5; // Partial credit for correct degree, wrong quality
          }
        }
      }

      const confidence = matches / patternLen;
      if (confidence >= 0.5 && (!bestMatch || confidence > bestMatch.confidence)) {
        bestMatch = { pattern: patternDef, confidence };
      }
    }
  }

  if (bestMatch) {
    const degreeStr = bestMatch.pattern.pattern
      .map(([deg, qual]) => {
        const base = DEGREE_NAMES[deg];
        return qual === 1 ? `${base.toLowerCase()}m` : base;
      })
      .join('-');

    return {
      key: bestMatch.pattern.key,
      degrees: degreeStr,
      confidence: bestMatch.confidence,
    };
  }

  return null;
}

export function useStreamAnalyzer(options: StreamConfig = { sampleRate: 44100 }) {
  const isInitialized = ref(false);
  const isProcessing = ref(false);
  const error = ref<string | null>(null);

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
  });

  let analyzer: StreamAnalyzer | null = null;
  let wasmModule: typeof import('@/wasm/index') | null = null;
  let nextExpectedSampleOffset: number | null = null;

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
  };

  async function init(): Promise<void> {
    if (isInitialized.value) return;

    try {
      wasmModule = await import('@/wasm/index');
      await wasmModule.init();
      analyzer = new wasmModule.StreamAnalyzer(defaultConfig);
      isInitialized.value = true;
      error.value = null;
    } catch (e) {
      error.value = `Failed to initialize StreamAnalyzer: ${e}`;
      console.error(error.value);
    }
  }

  async function reinit(newSampleRate: number): Promise<void> {
    if (!wasmModule) {
      await init();
    }

    // Dispose existing analyzer
    if (analyzer) {
      analyzer.dispose();
    }

    // Use the actual sample rate from AudioContext
    // C++ StreamAnalyzer handles resampling internally for high sample rates
    defaultConfig.sampleRate = newSampleRate;
    defaultConfig.nFft = options.nFft ?? 2048;
    defaultConfig.hopLength = options.hopLength ?? 512;

    analyzer = new wasmModule!.StreamAnalyzer(defaultConfig);

    reset();
  }

  function process(samples: Float32Array, sampleOffset?: number): void {
    if (!analyzer || !isInitialized.value) return;

    isProcessing.value = true;

    // Keep StreamAnalyzer synchronized with the AudioWorklet timeline.
    // If playback seeks or resumes from a non-contiguous point, reset analysis
    // state so overlap/chord accumulators do not mix unrelated audio regions.
    if (sampleOffset !== undefined) {
      if (nextExpectedSampleOffset !== null && sampleOffset !== nextExpectedSampleOffset) {
        reset(sampleOffset);
      }

      analyzer.processWithOffset(samples, sampleOffset);
      nextExpectedSampleOffset = sampleOffset + samples.length;
    } else {
      analyzer.process(samples);
      nextExpectedSampleOffset = null;
    }

    // Read available frames
    const availableFrames = analyzer.availableFrames();
    if (availableFrames > 0) {
      // Drain native frame telemetry. The page consumes progressive estimates,
      // not the full feature history; retaining and re-flattening ~30 seconds of
      // mel/chroma on every chunk only created growing GC pressure.
      analyzer.readFrames(availableFrames);
    }

    // Update progressive estimates
    const stats = analyzer.stats();
    updateEstimate(stats.estimate);

    isProcessing.value = false;
  }

  function updateEstimate(progressiveEstimate: ProgressiveEstimate): void {
    if (!progressiveEstimate.updated) return;

    const barChords = progressiveEstimate.barChordProgression || [];
    const keyRoot = progressiveEstimate.key;

    // Get C++ computed voted pattern
    const votedPatternFromCpp = (progressiveEstimate.votedPattern || []).map((bc) =>
      chordToName(bc.root, bc.quality),
    );

    // Fallback: Detect chord progression pattern in JS (if C++ pattern not available)
    const pattern = detectProgressionPattern(
      barChords.map((bc) => ({ root: bc.root, quality: bc.quality })),
      keyRoot,
    );

    estimate.value = {
      bpm: Math.round(progressiveEstimate.bpm * 10) / 10,
      bpmConfidence: progressiveEstimate.bpmConfidence,
      key:
        progressiveEstimate.keyConfidence > 0.3
          ? keyToName(progressiveEstimate.key, progressiveEstimate.keyMinor)
          : '-',
      keyConfidence: progressiveEstimate.keyConfidence,
      chord:
        progressiveEstimate.chordConfidence > 0.3
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
    };
  }

  function setExpectedDuration(durationSeconds: number): void {
    if (analyzer) {
      analyzer.setExpectedDuration(durationSeconds);
    }
  }

  function setNormalizationGain(gain: number): void {
    if (analyzer) {
      analyzer.setNormalizationGain(gain);
    }
  }

  function reset(baseSampleOffset = 0): void {
    if (analyzer) {
      analyzer.reset(baseSampleOffset);
    }

    nextExpectedSampleOffset = baseSampleOffset;

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
    };
  }

  function destroy(): void {
    // Release the native StreamAnalyzer before dropping the reference so its
    // WASM-heap allocation does not leak on every route leave.
    analyzer?.dispose();
    analyzer = null;
    wasmModule = null;
    isInitialized.value = false;
    reset();
  }

  onUnmounted(() => {
    destroy();
  });

  return {
    isInitialized,
    isProcessing,
    error,
    estimate,
    init,
    reinit,
    process,
    setExpectedDuration,
    setNormalizationGain,
    reset,
    destroy,
  };
}
