import { onUnmounted, ref } from 'vue';
import type { BarChord, ProgressiveEstimate, StreamAnalyzer, StreamConfig } from '@/wasm/index';

export interface BarChordInfo {
  barIndex: number;
  chord: string;
  startTime: number;
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
  /** The engine's voted bar-chord loop, e.g. ['C', 'G', 'Am', 'F']. */
  votedPattern: string[];
  /** The engine's name for the matched common pattern, e.g. 'royalRoad'. */
  detectedPatternName: string;
  detectedPatternScore: number;
  currentBar: number;
  barDuration: number;
  accumulatedSeconds: number;
}

function barChordToInfo(bc: BarChord): BarChordInfo {
  return {
    barIndex: bc.barIndex,
    chord: bc.name,
    startTime: bc.startTime,
    confidence: bc.confidence,
  };
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

  /**
   * Load the WASM module and construct the native analyzer. A failure is
   * recorded in `error` and rethrown, so an awaiting caller sees it where it
   * happened instead of at the next call that assumes the module exists.
   */
  async function init(): Promise<void> {
    if (isInitialized.value) return;

    try {
      const mod = await import('@/wasm/index');
      await mod.init();
      analyzer = new mod.StreamAnalyzer(defaultConfig);
      // Only a fully initialised module is kept, so a retry starts from scratch.
      wasmModule = mod;
      isInitialized.value = true;
      error.value = null;
    } catch (e) {
      error.value = `Failed to initialize StreamAnalyzer: ${e}`;
      console.error(error.value);
      throw e;
    }
  }

  async function reinit(newSampleRate: number): Promise<void> {
    if (!wasmModule) {
      await init();
    }
    if (!wasmModule) {
      throw new Error('StreamAnalyzer is not initialized');
    }

    analyzer?.delete();

    // Use the actual sample rate from AudioContext
    // C++ StreamAnalyzer handles resampling internally for high sample rates
    defaultConfig.sampleRate = newSampleRate;
    defaultConfig.nFft = options.nFft ?? 2048;
    defaultConfig.hopLength = options.hopLength ?? 512;

    analyzer = new wasmModule.StreamAnalyzer(defaultConfig);

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
    const votedPattern = (progressiveEstimate.votedPattern || []).map((bc) => bc.name);

    estimate.value = {
      bpm: Math.round(progressiveEstimate.bpm * 10) / 10,
      bpmConfidence: progressiveEstimate.bpmConfidence,
      key:
        progressiveEstimate.keyConfidence > 0.3 && progressiveEstimate.keyShortName
          ? progressiveEstimate.keyShortName
          : '-',
      keyConfidence: progressiveEstimate.keyConfidence,
      chord: progressiveEstimate.chordConfidence > 0.3 ? progressiveEstimate.chordName : '-',
      chordConfidence: progressiveEstimate.chordConfidence,
      barChordProgression: barChords.map(barChordToInfo),
      votedPattern,
      detectedPatternName: progressiveEstimate.detectedPatternName || '',
      detectedPatternScore: progressiveEstimate.detectedPatternScore || 0,
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

  function setTuningRefHz(refHz: number): void {
    if (analyzer) {
      analyzer.setTuningRefHz(refHz);
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
      currentBar: -1,
      barDuration: 0,
      accumulatedSeconds: 0,
    };
  }

  function destroy(): void {
    // Release the native StreamAnalyzer before dropping the reference so its
    // WASM-heap allocation does not leak on every route leave.
    analyzer?.delete();
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
    setTuningRefHz,
    reset,
    destroy,
  };
}
