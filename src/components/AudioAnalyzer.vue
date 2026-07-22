<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import {
  ANALYZER_TERM_SLUGS,
  type AnalyzerTermKey,
  enCopy as analyzerEnCopy,
  jaCopy as analyzerJaCopy,
} from '@/components/analyzer/analyzerCopy';
import {
  calculateNormalizationGain,
  mixToMono,
  splitMelBands,
} from '@/components/analyzer/audioAnalyzerProcessing';
import { MetricItem, TechPanel, TermLabel, Tooltip, TransportButton } from '@/components/ui';
import { useAudioAnalysis } from '@/composables/useAudioAnalysis';
import { useAudioPlayer } from '@/composables/useAudioPlayer';
import { useI18n } from '@/composables/useI18n';
import { useStreamAnalyzer } from '@/composables/useStreamAnalyzer';
import DataConsole from './DataConsole.vue';
import DropZone from './DropZone.vue';
import SynesthesiaVisualizer from './SynesthesiaVisualizer.vue';
import WaveformVisualizer from './WaveformVisualizer.vue';

defineProps<{
  libVersion?: string;
}>();

const { t, locale, localizedPath, alternateLocalePath, localizedValue } = useI18n();

const termCopy = computed(() => localizedValue({ en: analyzerEnCopy, ja: analyzerJaCopy }));
const glossaryBase = computed(() => localizedPath('/docs/glossary'));

/** Build rich-tooltip props for a metric from the copy + slug tables. */
function term(key: AnalyzerTermKey) {
  const c = termCopy.value;
  const item = c.items[key];
  const slug = ANALYZER_TERM_SLUGS[key];
  return {
    eyebrow: c.eyebrow,
    title: item.title,
    body: item.body,
    tip: item.tip,
    tipLabel: c.tipLabel,
    href: slug ? `${glossaryBase.value}/${slug}` : undefined,
    linkLabel: c.linkLabel,
  };
}
const isLoadingDemo = ref(false);
const isStreamingMode = ref(true); // Enable streaming by default

const decodeErrorMessage = computed(() =>
  localizedValue({
    en: 'Could not decode this audio file. Try a different WAV, MP3, or FLAC file.',
    ja: 'この音声ファイルをデコードできませんでした。別の WAV・MP3・FLAC ファイルをお試しください。',
  }),
);

const {
  isAnalyzing,
  progress,
  progressStage,
  result,
  error: analysisError,
  analyze,
} = useAudioAnalysis();

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
} = useAudioPlayer();

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
  sampleRate: 44100, // Will be updated when audio is loaded
  nFft: 2048,
  hopLength: 512, // Changed from 1024 for better time resolution
  nMels: 128,
  computeMel: true,
  computeChroma: true,
  computeOnset: true,
});

const fileName = ref('');
const beats = ref<Float32Array | null>(null);
const rmsData = ref<Float32Array | null>(null);
const chromaData = ref<{ features: Float32Array; nFrames: number; nChroma: number } | null>(null);
const bandData = ref<{ low: Float32Array; high: Float32Array } | null>(null);
const sampleRate = ref(44100);

const isLoadingFile = ref(false);
const fileProgress = ref(0);
const fileProgressStage = ref('');
const hasUserFile = ref(false); // Track if user uploaded a file

async function handleFile(file: File) {
  // Stop current playback and reset state
  if (isPlaying.value) {
    stop();
  }
  resetStreamAnalyzer();
  setProcessCallback(null);

  hasUserFile.value = true; // Mark that user uploaded a file
  fileName.value = file.name;
  isLoadingFile.value = true;
  fileProgress.value = 0;
  fileProgressStage.value = 'DECODING AUDIO';
  analysisError.value = null;

  try {
    // Initialize WASM and StreamAnalyzer if needed
    fileProgress.value = 5;
    await initStreamAnalyzer();
    await yieldToMain();

    fileProgress.value = 15;
    fileProgressStage.value = 'DECODING AUDIO';
    const buffer = await loadAudio(file);
    await yieldToMain();

    fileProgress.value = 35;
    fileProgressStage.value = 'INITIALIZING ANALYZER';
    // Reinitialize stream analyzer with AudioContext sample rate
    const ctx = getAudioContext();
    sampleRate.value = ctx.sampleRate;
    await reinitStreamAnalyzer(ctx.sampleRate);

    // Set expected duration for pattern lock timing
    setExpectedDuration(buffer.duration);

    // Set normalization gain for loud audio
    const normGain = calculateNormalizationGain(buffer);
    setNormalizationGain(normGain);

    // Set up streaming callback
    setProcessCallback((samples, sampleOffset) => {
      processAudioChunk(samples, sampleOffset);
    });
    await yieldToMain();

    fileProgress.value = 45;
    fileProgressStage.value = 'EXTRACTING SAMPLES';
    // Pre-compute visualization data
    const wasm = await import('@/wasm/index.js');
    const samples =
      buffer.numberOfChannels > 1 ? mixToMono(buffer) : buffer.getChannelData(0).slice();
    await yieldToMain();

    fileProgress.value = 55;
    fileProgressStage.value = 'COMPUTING RMS';
    const rms = wasm.rmsEnergy(samples, buffer.sampleRate, 2048, 1024);
    await yieldToMain();

    fileProgress.value = 70;
    fileProgressStage.value = 'COMPUTING CHROMA';
    const chromaResult = wasm.chroma(samples, buffer.sampleRate, 2048, 1024);
    await yieldToMain();

    fileProgress.value = 85;
    fileProgressStage.value = 'COMPUTING SPECTROGRAM';
    const melResult = wasm.melSpectrogram(samples, buffer.sampleRate, 2048, 1024, 128);
    await yieldToMain();

    fileProgress.value = 95;
    fileProgressStage.value = 'FINALIZING';
    const bands = splitMelBands(melResult);

    rmsData.value = rms;
    chromaData.value = {
      features: chromaResult.features,
      nFrames: chromaResult.nFrames,
      nChroma: chromaResult.nChroma,
    };
    bandData.value = {
      low: bands.low,
      high: bands.high,
    };

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
    };

    fileProgress.value = 100;
    isLoadingFile.value = false;
  } catch (e) {
    console.error('Failed to process audio:', e);
    isLoadingFile.value = false;
    // Surface the failure and roll back the upload state so the drop zone
    // reappears with an explanation instead of silently showing a bare zone.
    analysisError.value = decodeErrorMessage.value;
    hasUserFile.value = false;
    fileName.value = '';
    resetStreamAnalyzer();
    setProcessCallback(null);
  }
}

function togglePlayback() {
  if (isPlaying.value) {
    pause();
  } else if (isPaused.value) {
    resume();
  } else {
    play();
  }
}

function rewind() {
  seek(0);
  // Don't reset here - will reset when play is pressed at position 0
}

function handleSeek(time: number) {
  seek(time);
}

function resetFile() {
  audioBuffer.value = null;
  result.value = null;
  resetStreamAnalyzer();
  setProcessCallback(null);
}

// Use streaming estimates when available, fallback to batch analysis
const displayBpm = computed(() => {
  if (isStreamingMode.value && streamEstimate.value.bpm > 0) {
    return streamEstimate.value.bpm;
  }
  return result.value?.bpm ?? 0;
});

const displayKey = computed(() => {
  if (isStreamingMode.value && streamEstimate.value.key !== '-') {
    return streamEstimate.value.key;
  }
  return result.value?.key?.name ?? '-';
});

const displayBpmConfidence = computed(() => {
  if (isStreamingMode.value) {
    return Math.round(streamEstimate.value.bpmConfidence * 100);
  }
  return result.value?.bpmConfidence ? Math.round(result.value.bpmConfidence * 100) : 0;
});

const displayKeyConfidence = computed(() => {
  if (isStreamingMode.value) {
    return Math.round(streamEstimate.value.keyConfidence * 100);
  }
  return result.value?.key?.confidence ? Math.round(result.value.key.confidence * 100) : 0;
});

// While streaming playback is running, the BPM/key estimators need a few
// seconds of audio before they produce a value. Surface that warm-up as a
// pending state instead of a bare "-", which reads as broken.
const bpmPending = computed(() => isStreamingMode.value && isPlaying.value && !displayBpm.value);
const keyPending = computed(
  () => isStreamingMode.value && isPlaying.value && displayKey.value === '-',
);

const displayChord = computed(() => {
  if (isStreamingMode.value && streamEstimate.value.chord !== '-') {
    return streamEstimate.value.chord;
  }
  return '-';
});

const displayChordConfidence = computed(() => {
  if (isStreamingMode.value) {
    return Math.round(streamEstimate.value.chordConfidence * 100);
  }
  return 0;
});

const displayTimeSignature = computed(() => {
  if (!result.value?.timeSignature) return '-';
  const ts = result.value.timeSignature;
  return `${ts.numerator}/${ts.denominator}`;
});

// Bar chord progression
const displayCurrentBar = computed(() => {
  if (isStreamingMode.value && streamEstimate.value.currentBar >= 0) {
    return streamEstimate.value.currentBar + 1; // 1-indexed for display
  }
  return 0;
});

const displayBarChordProgression = computed(() => {
  if (isStreamingMode.value) {
    return streamEstimate.value.barChordProgression;
  }
  return [];
});

// C++ computed voted pattern (more accurate than barChordProgression.slice(-4))
const displayVotedPattern = computed(() => {
  if (isStreamingMode.value) {
    return streamEstimate.value.votedPattern;
  }
  return [];
});

const displayDetectedPatternName = computed(() => {
  if (isStreamingMode.value) {
    return streamEstimate.value.detectedPatternName;
  }
  return '';
});

const displayDetectedPatternScore = computed(() => {
  if (isStreamingMode.value) {
    return Math.round(streamEstimate.value.detectedPatternScore * 100);
  }
  return 0;
});

// Yield to main thread for animation
const yieldToMain = () => new Promise((resolve) => setTimeout(resolve, 0));

async function loadDemoFile() {
  isLoadingDemo.value = true;

  // Wait for loading animation to render
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  // Abort if user uploaded a file
  if (hasUserFile.value) {
    isLoadingDemo.value = false;
    return;
  }

  const timings: Record<string, number> = {};
  let t0 = performance.now();

  try {
    // Initialize WASM and StreamAnalyzer
    t0 = performance.now();
    await initStreamAnalyzer();
    timings['StreamAnalyzer init'] = performance.now() - t0;

    // Abort if user uploaded a file
    if (hasUserFile.value) {
      isLoadingDemo.value = false;
      return;
    }

    await yieldToMain();

    t0 = performance.now();
    const response = await fetch('/demo.mp3');
    if (!response.ok) {
      throw new Error('Failed to load demo file');
    }
    const arrayBuffer = await response.arrayBuffer();
    timings['Fetch MP3'] = performance.now() - t0;

    // Abort if user uploaded a file
    if (hasUserFile.value) {
      isLoadingDemo.value = false;
      return;
    }

    await yieldToMain();

    fileName.value = 'demo.mp3';

    t0 = performance.now();
    const buffer = await loadAudioFromArrayBuffer(arrayBuffer.slice(0));
    timings['Decode audio'] = performance.now() - t0;

    await yieldToMain();

    // Reinitialize stream analyzer with AudioContext sample rate
    // (AnalyserNode outputs at AudioContext rate, not buffer rate)
    const ctx = getAudioContext();
    sampleRate.value = ctx.sampleRate;
    await reinitStreamAnalyzer(ctx.sampleRate);

    // Set expected duration for pattern lock timing
    setExpectedDuration(buffer.duration);

    // Set normalization gain for loud audio
    const normGain = calculateNormalizationGain(buffer);
    setNormalizationGain(normGain);

    // Set up streaming callback
    setProcessCallback((samples, sampleOffset) => {
      processAudioChunk(samples, sampleOffset);
    });

    // Pre-compute initial visualization data for immediate display
    // (streaming will update this in real-time during playback)
    t0 = performance.now();
    const wasm = await import('@/wasm/index.js');
    const samples =
      buffer.numberOfChannels > 1 ? mixToMono(buffer) : buffer.getChannelData(0).slice();
    timings['Mix to mono'] = performance.now() - t0;

    await yieldToMain();

    t0 = performance.now();
    const rms = wasm.rmsEnergy(samples, buffer.sampleRate, 2048, 1024);
    timings['rmsEnergy'] = performance.now() - t0;

    await yieldToMain();

    t0 = performance.now();
    const chromaResult = wasm.chroma(samples, buffer.sampleRate, 2048, 1024);
    timings['chroma'] = performance.now() - t0;

    await yieldToMain();

    t0 = performance.now();
    const melResult = wasm.melSpectrogram(samples, buffer.sampleRate, 2048, 1024, 128);
    timings['melSpectrogram'] = performance.now() - t0;

    await yieldToMain();

    t0 = performance.now();
    const bands = splitMelBands(melResult);
    timings['band separation'] = performance.now() - t0;

    // Abort if user uploaded a file - don't overwrite their data
    if (hasUserFile.value) {
      isLoadingDemo.value = false;
      return;
    }

    rmsData.value = rms;
    chromaData.value = {
      features: chromaResult.features,
      nFrames: chromaResult.nFrames,
      nChroma: chromaResult.nChroma,
    };
    bandData.value = {
      low: bands.low,
      high: bands.high,
    };

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
    };

    isLoadingDemo.value = false;
  } catch (e) {
    console.error('Failed to load demo file:', e);
    isLoadingDemo.value = false;
  }
}

// Reset stream analyzer when starting fresh playback from the beginning
watch(isPlaying, (playing, wasPlaying) => {
  if (playing && !wasPlaying && currentTime.value === 0) {
    // Starting new playback from beginning - reset analyzer
    resetStreamAnalyzer();
  }
});

onMounted(() => {
  loadDemoFile();
});
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
          <Tooltip v-bind="term('visualizer')" class="analyzer__overlay-tip">
            <button type="button" class="analyzer__info" :aria-label="term('visualizer').title">
              <span aria-hidden="true">i</span>
            </button>
          </Tooltip>
        </div>

        <!-- Waveform & Transport -->
        <div class="analyzer__transport">
          <Tooltip v-bind="term('waveform')" class="analyzer__overlay-tip">
            <button type="button" class="analyzer__info" :aria-label="term('waveform').title">
              <span aria-hidden="true">i</span>
            </button>
          </Tooltip>
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
              <span class="analyzer__metric-hero-label">
                {{ t('demo.panel.bpm') }}
                <Tooltip v-bind="term('bpm')">
                  <button type="button" class="analyzer__info" :aria-label="term('bpm').title">
                    <span aria-hidden="true">i</span>
                  </button>
                </Tooltip>
              </span>
              <span class="analyzer__metric-hero-value">
                <span v-if="bpmPending" class="analyzer__metric-pending" role="status" :aria-label="t('demo.analyzing')">
                  <i></i><i></i><i></i>
                </span>
                <template v-else>{{ displayBpm || '-' }}</template>
              </span>
              <span v-if="bpmPending" class="analyzer__metric-hero-conf analyzer__metric-hero-conf--pending">{{ t('demo.analyzing') }}</span>
              <span v-else-if="displayBpmConfidence > 0" class="analyzer__metric-hero-conf">{{ displayBpmConfidence }}%</span>
            </div>
            <div class="analyzer__metric-hero">
              <span class="analyzer__metric-hero-label">
                {{ t('demo.panel.key') }}
                <Tooltip v-bind="term('key')">
                  <button type="button" class="analyzer__info" :aria-label="term('key').title">
                    <span aria-hidden="true">i</span>
                  </button>
                </Tooltip>
              </span>
              <span class="analyzer__metric-hero-value">
                <span v-if="keyPending" class="analyzer__metric-pending" role="status" :aria-label="t('demo.analyzing')">
                  <i></i><i></i><i></i>
                </span>
                <template v-else>{{ displayKey }}</template>
              </span>
              <span v-if="keyPending" class="analyzer__metric-hero-conf analyzer__metric-hero-conf--pending">{{ t('demo.analyzing') }}</span>
              <span v-else-if="displayKeyConfidence > 0" class="analyzer__metric-hero-conf">{{ displayKeyConfidence }}%</span>
            </div>
            <!-- Chord Progression Pattern (C++ computed) -->
            <div v-if="displayVotedPattern.length >= 4" class="analyzer__pattern">
              <div class="analyzer__pattern-header">
                <span class="analyzer__pattern-label">
                  {{ t('demo.panel.pattern') }}
                  <Tooltip v-bind="term('pattern')">
                    <button type="button" class="analyzer__info" :aria-label="term('pattern').title">
                      <span aria-hidden="true">i</span>
                    </button>
                  </Tooltip>
                </span>
                <span v-if="displayDetectedPatternName" class="analyzer__pattern-name">{{ displayDetectedPatternName }}</span>
              </div>
              <div class="analyzer__pattern-chords">
                {{ displayVotedPattern.join('→') }}
              </div>
              <span v-if="displayDetectedPatternName && displayDetectedPatternScore > 0" class="analyzer__pattern-score">{{ displayDetectedPatternScore }}%</span>
            </div>
            <div class="analyzer__metrics-divider"></div>
            <!-- Secondary Info -->
            <MetricItem :value="displayTimeSignature">
              <template #label><TermLabel v-bind="term('timeSig')">{{ t('demo.panel.timeSig') }}</TermLabel></template>
            </MetricItem>
            <MetricItem :value="formatTime(duration)">
              <template #label><TermLabel v-bind="term('duration')">{{ t('demo.panel.duration') }}</TermLabel></template>
            </MetricItem>
            <MetricItem :value="`${(sampleRate / 1000).toFixed(1)}kHz`">
              <template #label><TermLabel v-bind="term('rate')">{{ t('demo.panel.rate') }}</TermLabel></template>
            </MetricItem>
            <div class="analyzer__metrics-divider"></div>
            <!-- Source -->
            <MetricItem :value="fileName" variant="success">
              <template #label><TermLabel v-bind="term('source')">{{ t('demo.panel.source') }}</TermLabel></template>
            </MetricItem>
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

<style scoped src="./analyzer/audioAnalyzerLoading.css"></style>
<style scoped src="./analyzer/audioAnalyzerLayout.css"></style>
<style scoped src="./analyzer/audioAnalyzerMetrics.css"></style>
<style scoped src="./analyzer/audioAnalyzerResponsive.css"></style>

<style scoped src="./analyzer/audioAnalyzerTooltips.css"></style>
